const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium, devices } = require('playwright');

const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
const trialURL = order => new URL(`?playtest=ambush&order=${order}`, base).href;

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || undefined,
    args: process.env.LV_SOFTWARE_GL === '0' ? []
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let socketOpened = false;
    page.on('websocket', () => { socketOpened = true; });
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      localStorage.setItem('lv_profile', '{"level":19,"coins":345,"keys":7}');
    });
    await page.goto(trialURL('BA'));
    await page.getByRole('button', { name: '開始第一場' }).click();
    await page.waitForFunction(() => __game.enemies.length === 2);
    await page.keyboard.down('KeyW');
    await page.evaluate(() => __game.update(1 / 30));
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    const b = await page.evaluate(() => {
      const g = __game;
      const p = g.player;
      const cover = g.ambushTrial.cover;
      const thorn = g.enemies.find(e => e.type === 'thorn');
      const stats = g.enemies.map(e => [e.type, e.maxHp, e.dmg, e.spd]);
      // Use a fixed ray from the actual shooter through the center of the cover.
      const direction = { x: cover.x - thorn.pos.x, y: cover.z - thorn.pos.z };
      const length = Math.hypot(direction.x, direction.y);
      direction.x /= length;
      direction.y /= length;
      p.y = 0;
      p.roll = p.iframes = 0;
      p.pos.set(cover.x + direction.x * 2, 0, cover.z + direction.y * 2);
      const hp = p.hp;
      g.fireEnemyProj(thorn.pos, direction, 8.5, thorn.dmg, 0x9bd85a);
      for (let i = 0; i < 35; i++) g.updateProjs(1 / 30);
      return { stats, variant: g.ambushTrial.active.variant, hpBefore: hp, hpAfter: p.hp,
        events: g.ambushTrial.active.events.map(e => e.kind), shots: g.eprojs.length };
    });
    assert.equal(b.variant, 'B');
    assert.equal(b.hpAfter, b.hpBefore);
    assert.equal(b.shots, 0);
    for (const event of ['move', 'roll', 'coverBlocked']) assert.ok(b.events.includes(event), event);
    await page.getByRole('button', { name: '結束此場' }).click();
    await page.getByRole('button', { name: '重試這一場' }).click();
    await page.waitForFunction(() => __game.enemies.length === 2);
    await page.evaluate(() => {
      const g = __game;
      // Advance the live AI while the player stands in the charge lane.
      for (let i = 0; i < 420 && g.state === 'play'; i++) g.update(1 / 30);
    });
    await page.getByRole('button', { name: '開始第二場' }).click();
    await page.waitForFunction(() => __game.enemies.length === 2);
    const a = await page.evaluate(() => {
      const g = __game;
      const stats = g.enemies.map(e => [e.type, e.maxHp, e.dmg, e.spd]);
      const p = g.player;
      const boar = g.enemies.find(e => e.type === 'boar');
      const hpBefore = p.hp;
      p.roll = p.iframes = 0;
      g.fireEnemyProj(p.pos.clone().setZ(p.pos.z - 1.8), { x: 0, y: 1 }, 8.5, 20, 0x9bd85a);
      for (let i = 0; i < 10; i++) g.updateProjs(1 / 30);
      const hpAfter = p.hp;
      const thorn = g.enemies.find(e => e.type === 'thorn');
      p.iframes = 0;
      p.pos.copy(thorn.pos);
      thorn.hitCd = 0;
      g.updateEnemies(1 / 60);
      // At a tiny timestep a moving boar must not be treated as blocked.
      boar.pos.set(0, 0, 0);
      boar.cdir = g.moveInput().set(1, 0);
      boar.state = 'charge';
      boar.t = 0;
      p.pos.set(0, 0, -1.8);
      g.ambushTrial.beginCharge(boar, p);
      g.updateEnemies(1 / 2000);
      const tinyStepState = boar.state;
      boar.t = 0.599;
      g.updateEnemies(0.002);
      const recovery = g.ambushTrial.active.events.find(e => e.kind === 'boarRecovery');
      boar.t = 1.01;
      g.updateEnemies(1 / 60);
      g.ui.update(g);
      const badgeVisible = !!document.querySelector('.ebar-recovery:not([hidden])');
      p.cds.atk = 0;
      g.aim.copy(boar.pos);
      g.tryAttack();
      const punish = g.ambushTrial.active.events.find(e => e.kind === 'boarPunish');
      boar.t = 1.25;
      boar.stun = 0.5;
      g.updateEnemies(1 / 60);
      g.ui.update(g);
      const badgeAfter = !!document.querySelector('.ebar-recovery:not([hidden])');
      // Place the player within reach and use normal attacks to clear consistently.
      for (const enemy of g.enemies) {
        let swings = 0;
        while (!enemy.dead && swings++ < 24) {
          p.cds.atk = 0;
          g.aim.copy(enemy.pos);
          p.pos.copy(enemy.pos).add({ x: 0, y: 0, z: 0.9 });
          g.tryAttack();
        }
      }
      const data = { stats, hpBefore, hpAfter, recovery, punish, tinyStepState, badgeVisible, badgeAfter,
        variant: g.ambushTrial.active.variant,
        cover: g.ambushTrial.cover, boarDead: boar.dead, kills: p.kills };
      for (let i = 0; i < 100 && g.state === 'play'; i++) g.update(1 / 30);
      return data;
    });
    assert.equal(a.variant, 'A');
    assert.equal(a.cover, null);
    assert.deepEqual(a.stats, b.stats);
    assert.ok(a.hpAfter < a.hpBefore && a.boarDead && a.kills === 2);
    assert.equal(a.tinyStepState, 'charge');
    assert.equal(a.recovery.windowMs, 1250);
    assert.equal(a.recovery.chargeEnd, 'completed');
    assert.equal(a.recovery.withinMeleeReach, true);
    assert.ok(a.punish.recoveryElapsedMs > 900 && a.punish.recoveryElapsedMs < 1250);
    assert.equal(a.badgeVisible, true);
    assert.equal(a.badgeAfter, false);
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: '下載戰報' }).click();
    const download = await downloadReady;
    const report = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(report.version, 2);
    assert.equal(report.order, 'BA');
    assert.ok(report.build);
    assert.deepEqual(report.attempts.map(row => [row.variant, row.outcome]), [
      ['B', 'abandoned'], ['B', 'defeated'], ['A', 'cleared'],
    ]);
    assert.equal(report.attempts[1].retryOf, 1);
    assert.ok(report.attempts[1].retryAfterMs >= 0);
    assert.ok(report.attempts[1].damageTaken > 0);
    assert.ok(report.attempts[1].events.some(e => e.kind === 'boarTelegraph'));
    assert.deepEqual(report.attempts[2].killOrder, ['boar', 'thorn']);
    const thornHits = report.attempts[2].events.filter(e => e.kind === 'playerHit' && e.enemy === 'thorn');
    assert.deepEqual(thornHits.map(e => e.attack), ['projectile', 'contact']);
    assert.equal(socketOpened, false);
    assert.equal(await page.evaluate(() => localStorage.getItem('lv_profile')), '{"level":19,"coins":345,"keys":7}');
    await page.close();

    const mobile = await browser.newPage({ ...devices['iPhone 13'] });
    mobile.on('pageerror', error => errors.push(String(error)));
    await mobile.goto(trialURL('AB'));
    await mobile.getByRole('button', { name: '開始第一場' }).tap();
    assert.equal(await mobile.evaluate(() => __game.ambushTrial.active.variant), 'A');
    for (const selector of ['#touchMove', '#touchAttack', '#touchRoll', '#sk-r', '#sk-s0']) {
      assert.ok(await mobile.locator(selector).isVisible(), selector);
      const box = await mobile.locator(selector).boundingBox();
      assert.ok(box.width >= 42 && box.height >= 42 && box.x >= 0 && box.x + box.width <= 390, selector);
    }
    await mobile.locator('#sk-s0').tap();
    await mobile.locator('#touchAttack').tap();
    await mobile.locator('#touchRoll').tap();
    const input = await mobile.evaluate(() => {
      const t = __game.ambushTrial;
      return { type: t.report().input, events: t.active.events.map(e => e.kind) };
    });
    assert.equal(input.type, 'touch-layout');
    assert.ok(input.events.includes('attack') && input.events.includes('roll') && input.events.includes('skill'));
    await mobile.getByRole('button', { name: '結束此場' }).tap();
    await mobile.evaluate(() => __game.ui.dmgNum(0, 1, 0, 99));
    assert.ok(await mobile.evaluate(() => __game.ui.nums.length > 0));
    await mobile.getByRole('button', { name: '開始第二場' }).tap();
    await mobile.waitForFunction(() => __game.enemies.length === 2);
    assert.equal(await mobile.evaluate(() => __game.ui.nums.length), 0);
    const saveScreenshots = process.env.LV_AMBUSH_SCREENSHOTS === '1';
    if (saveScreenshots) {
      await mobile.evaluate(() => {
        const g = __game;
        const boar = g.enemies.find(e => e.type === 'boar');
        boar.state = 'rest';
        boar.t = 0.22;
        g.ui.update(g);
      });
      await mobile.screenshot({ path: 'shots/ambush-mobile.png' });
    }
    await mobile.close();
    if (saveScreenshots) {
      const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await desktop.goto(trialURL('BA'));
      await desktop.getByRole('button', { name: '開始第一場' }).click();
      await desktop.waitForFunction(() => __game.enemies.length === 2);
      await desktop.screenshot({ path: 'shots/ambush-desktop.png' });
    }
    assert.deepEqual(errors, []);
    console.log('Passed ambush AB/BA, cover, real inputs, combat logging, retry, download and save isolation.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
