const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 720 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', err => { errors.push(err.message); console.error(err.stack); });
    const url = process.env.LV_GAME_URL || 'http://localhost:8080/';
    const screenshot = name => process.env.LV_SCREENSHOT_DIR &&
      page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, name) });
    const start = async () => {
      await page.locator('#btnHeroNext').click();
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => __game.zone === 'town');
    };
    const goTo = async field => {
      await page.evaluate(field => __game.enterField(field), field);
      await page.waitForFunction(field => __game.field === field && __game.state === 'play', field);
    };
    const ignite = async id => {
      await page.evaluate(id => {
        const g = __game;
        const point = g.spots.find(s => s.expeditionId === id);
        if (!point || !g.world.isWalk(point.x, point.z)) throw Error('Expedition spot is not walkable');
        g.player.pos.set(point.x, g.world.gh(point.x, point.z), point.z);
        g.player.y = g.player.pos.y;
      }, id);
      await page.keyboard.press('KeyF');
      await page.waitForFunction(id => __game.meta.p.meadowExpedition.active?.completed.includes(id), id);
      assert.ok(await page.evaluate(() => __game.groundZones.some(z => z.kind === 'magma')));
    };
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await start();
    // Seed prior quest completion in this isolated browser. The swamp itself uses live interactions.
    await page.evaluate(() => {
      const g = __game;
      g.meta.p.level = 10;
      g.meta.p.meadowExpedition = { active: null, cleared: {
        1: { route: 'survey', gemId: 'leech' }, 3: { route: 'survey', gemId: 'area' },
      } };
      g.meta.save();
      g.recalc();
    });
    await page.locator('#btnMenu').click();
    await page.locator('#btnMeadowExpedition').click();
    await page.locator('[data-exp-tier="4"][data-exp-route="survey"]').click();
    await goTo(2);
    await page.waitForFunction(() => document.getElementById('fieldCompass').textContent.includes('霧潮沼澤'));
    await goTo(3);
    await ignite('lamp-0');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await start();
    await goTo(3);
    assert.equal(await page.evaluate(() => __game.spots.some(s => s.expeditionId === 'lamp-0')), false);
    await ignite('lamp-1');
    console.log('Passed swamp unlock, both vents, fire reaction and reload resume.');

    await page.evaluate(() => {
      const g = __game;
      const enemy = g.enemies.find(e => e.sporeGuardian);
      const x = enemy.pos.x + 4, z = enemy.pos.z;
      g.player.pos.set(x, g.world.gh(x, z), z);
      g.player.y = g.player.pos.y;
      enemy.cd = 0;
    });
    await page.waitForFunction(() => __game.groundZones.some(z => z.sporeSource));
    const preBreakRadius = await page.evaluate(() => {
      const g = __game;
      const poison = g.groundZones.find(zone => zone.sporeSource);
      g.fireProj({ x: poison.x - poison.r - 0.2, y: poison.y, z: poison.z }, { x: 1, y: 0 },
        { speed: 15, mult: 0.25, color: 0xffb347, size: 0.18, fire: true });
      window.testBarrel = poison;
      return poison.r;
    });
    await page.waitForFunction(() => window.testBarrel.kind === 'magma' && !window.testBarrel.sporeSource);
    const fight = await page.evaluate(() => {
      const g = __game;
      const enemy = g.enemies.find(e => e.sporeGuardian && !e.dead);
      // Real hit resolution, from behind. Keep enough HP to test the weakened cast.
      enemy.hp = enemy.maxHp;
      const hit = { dmg: Math.ceil(enemy.maxHp * 0.48), fire: false, crit: false };
      const hx = enemy.pos.x - Math.sin(enemy.facing) * 1.4;
      const hz = enemy.pos.z - Math.cos(enemy.facing) * 1.4;
      g.hitEnemy(enemy, hit, 0, 0, { hitPos: { x: hx, z: hz } });
      const broken = enemy.brokenWeakens.has('spores');
      g.queueSporeBurst(enemy);
      enemy.stun = 0;
      return broken;
    });
    assert.equal(fight, true);
    await page.waitForFunction(() => __game.groundZones.some(z => z.sporeSource));
    assert.ok(await page.evaluate(radius => __game.groundZones.some(z => z.sporeSource && z.r < radius), preBreakRadius));
    await screenshot('lantern-swamp-battle.png');
    const before = await page.evaluate(() => __game.meta.p.mMats?.moth_dust || 0);
    await page.evaluate(() => {
      const g = __game;
      g.hitEnemy(g.enemies.find(e => !e.dead && e.sporeGuardian), { dmg: 100000, fire: false, crit: false }, 0, 0);
    });
    await page.locator('#questTracker').click();
    assert.match(await page.locator('#panelM').textContent(), /孢囊破壞獎勵/);
    await screenshot('lantern-swamp-reward.png');
    await page.locator('[data-exp-gem="ember"]').click();
    assert.equal(await page.evaluate(() => __game.meta.p.mMats.moth_dust), before + 4);
    assert.equal(await page.evaluate(() => __game.meta.p.meadowExpedition.cleared[4].gemId), 'ember');
    assert.deepEqual(errors, []);
    console.log('Passed hostile pool, ignition, rear part break, weakened pool and guaranteed materials.');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
