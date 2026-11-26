const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const url = process.env.LV_GAME_URL || 'http://localhost:8080/';
  const screenshotDir = process.env.LV_SCREENSHOT_DIR;
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: process.env.LV_SOFTWARE_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.stack); console.error(error.stack); });
    const openTracker = async () => {
      const details = page.locator('#touchDetails');
      if (await details.isVisible() && !await page.locator('#questTracker').isVisible()) {
        await details.tap();
        if (await page.locator('#panelM').isVisible()) return;
      }
      await page.locator('#questTracker').click();
    };
    const start = async () => {
      await page.locator('#btnHeroNext').click();
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
    };
    const at = async position => page.evaluate(({ x, z }) => {
      const g = __game;
      g.player.pos.set(x, g.world.gh(x, z), z);
      g.player.y = g.player.pos.y;
    }, position);
    const enter = async (gateType, zone) => {
      await page.waitForFunction(() => __game.exitCooldown < 0.05);
      const gate = await page.evaluate(type => {
        const g = __game;
        const x = g.exits.find(exit => exit.type === type);
        return { x: x.x, z: x.z };
      }, gateType);
      await at(gate);
      await page.waitForFunction(zone => __game.zone === zone && __game.state === 'play', zone);
    };
    const lamp = async id => {
      const spot = await page.evaluate(id => {
        const spot = __game.spots.find(s => s.expeditionId === id);
        return { x: spot.x, z: spot.z };
      }, id);
      await at(spot);
      await page.keyboard.press('KeyF');
      await page.waitForFunction(id => __game.meta.p.meadowExpedition?.active?.completed.includes(id), id);
    };
    const defeat = async () => {
      await page.evaluate(() => {
        const g = __game;
        const enemy = g.enemies.find(e => !e.dead && e.expeditionId === 'champion');
        g.hitEnemy(enemy, { dmg: 100000, crit: false, fire: false }, 0, 0);
      });
      await page.waitForFunction(() => __game.meta.p.meadowExpedition.active.championDown);
    };
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await start();
    console.log('Started character');
    await openTracker();
    await page.locator('[data-opening-skip]').click();
    await page.locator('[data-exp-tier="1"][data-exp-route="survey"]').click();
    await page.locator('[data-exp-warp]').click();
    await page.waitForFunction(() => __game.zone === 'field:1' && __game.state === 'play');
    await lamp('lamp-0');
    await lamp('lamp-1');
    await defeat();
    console.log('Completed grassland objectives');
    await openTracker();
    await page.locator('[data-exp-gem="leech"]').click();
    await page.locator('[data-exp-fit]').waitFor();
    const receipt = await page.evaluate(() => [__game.meta.p.coins, __game.meta.p.keys, __game.meta.p.meadowExpedition.cleared[1].gemUid]);
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await start();
    await openTracker();
    assert.deepEqual(await page.evaluate(() => [__game.meta.p.coins, __game.meta.p.keys, __game.meta.p.meadowExpedition.cleared[1].gemUid]), receipt);
    await page.locator('[data-exp-fit]').click();
    await page.keyboard.press('Escape');
    await openTracker();
    assert.equal(await page.locator('[data-exp-fit]').count(), 0);
    assert.equal(await page.evaluate(() => __game.meta.p.puzzle.presets[0].filter(g => g.id === 'leech').length), 1);
    await page.locator('[data-exp-next]').click();

    await page.setViewportSize({ width: 390, height: 844 });
    const forestRoute = page.locator('[data-exp-tier="3"][data-exp-route="survey"]');
    await forestRoute.scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#panelM').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'lantern-expedition-mobile.png') });
    await forestRoute.tap();
    await page.waitForFunction(() => document.getElementById('qtDesc').textContent === '前往低語森林');
    await page.locator('[data-exp-warp]').tap();
    await page.waitForFunction(() => __game.zone === 'field:2' && __game.state === 'play');
    await lamp('lamp-0');
    console.log('Reached forest and repaired one lamp');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await start();
    await enter('run', 'field:1');
    await enter('nextField', 'field:2');
    assert.equal(await page.evaluate(() => __game.spots.some(s => s.expeditionId === 'lamp-0')), false);
    await lamp('lamp-1');
    await page.evaluate(() => {
      const g = __game;
      const e = g.enemies.find(e => e.expeditionId === 'champion');
      g.player.pos.set(e.pos.x + 3, g.world.gh(e.pos.x + 3, e.pos.z), e.pos.z);
      g.player.y = g.player.pos.y;
    });
    await page.waitForFunction(() => __game.enemies.some(e => e.expeditionName === '鉤棘老根' && e.state === 'meadow-strike'));
    await page.waitForFunction(() => __game.enemies.some(e => e.expeditionName === '鉤棘老根' && e.state === 'aim'));
    await defeat();
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTracker();
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'lantern-forest-reward.png') });
    await page.locator('[data-exp-gem="area"]').click();
    await page.locator('[data-exp-fit]').click();
    const progress = await page.evaluate(() => __game.meta.p.meadowExpedition);
    assert.equal(progress.active, null);
    assert.equal(progress.cleared[3].gemId, 'area');
    assert.equal(await page.evaluate(() => __game.meta.p.puzzle.presets[0].some(g => g.id === 'area')), true);
    assert.deepEqual(errors, []);
    console.log('Passed meadow → installed support → forest travel → resume → boss patterns → reward.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
