const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    const shot = async name => {
      if (process.env.LV_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, name) });
    };
    const map = page.locator('#worldMap');
    const local = page.locator('#regionMap');
    const search = map.locator('.map-search');
    const compass = page.locator('#fieldCompass');
    const moveToGate = async type => {
      await page.waitForFunction(() => __game.exitCooldown < 0.05);
      await page.evaluate(type => {
        const g = __game;
        const gate = g.exits.find(exit => exit.type === type);
        g.player.pos.set(gate.x, g.world.gh(gate.x, gate.z), gate.z);
      }, type);
    };

    await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/', { waitUntil: 'domcontentloaded' });
    await page.locator('#btnHeroNext').click();
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
    await page.keyboard.press('m');
    assert.equal(await map.locator('.map-overview').textContent(), '探索 0/20');
    assert.equal(await map.locator('.map-location').textContent(), '燈谷鎮');
    assert.equal(await map.locator('.atlas button').count(), 11);
    await map.locator('[data-reg-id="2"]').click();
    assert.match(await map.locator('.map-route').textContent(), /前往晨光草原/);
    await shot('lantern-map-atlas.png');
    await map.locator('.map-travel').click();
    const time = await page.evaluate(() => __game.time);
    await page.keyboard.press('q');
    assert.equal(await page.evaluate(() => __game.time), time);
    await page.keyboard.press('Escape');
    await compass.waitFor();
    assert.match(await compass.textContent(), /低語森林 · 前往晨光草原/);

    await moveToGate('run');
    await page.waitForFunction(() => __game.zone === 'field:1');
    await page.waitForFunction(() => document.querySelector('#fieldCompass').textContent.includes('前往低語森林'));
    await page.keyboard.press('Tab');
    await local.waitFor();
    assert.equal(await local.locator('#rmTitle').textContent(), '晨光草原');
    await page.keyboard.press('Tab');
    assert.ok(await local.evaluate(root => root.contains(document.activeElement)));
    await local.locator('#rmPoi').selectOption('cp-1');
    assert.ok(await local.locator('#rmTravel').isHidden());
    await local.locator('#rmPin').click();
    await page.waitForFunction(() => __game.mapPin?.label === __game.checkpoints[1].name);
    await local.locator('#rmClear').click();
    assert.equal(await page.evaluate(() => __game.mapPin), null);
    await local.locator('#rmPoi').selectOption('cp-0');
    assert.ok(await local.locator('#rmTravel').isVisible());
    await shot('lantern-map-local.png');
    await local.locator('#rmTravel').click();
    assert.ok(await local.isHidden());
    assert.ok(await page.evaluate(() => {
      const g = __game;
      const cp = g.checkpoints[0];
      return Math.hypot(g.player.pos.x - cp.x, g.player.pos.z - cp.z) < 4;
    }));

    await page.keyboard.press('m');
    assert.equal(await map.locator('.map-overview').textContent(), '探索 1/20');
    for (const [index, count] of [[0, 11], [1, 6], [2, 5]]) {
      await map.locator('.map-layer-btn').nth(index).click();
      assert.equal(await map.locator('.atlas button').count(), count);
    }
    await search.fill('異星母巢核心');
    assert.equal(await map.locator('.atlas button').count(), 1);
    assert.match(await map.locator('.region-name').textContent(), /異星蜂巢裂谷/);
    assert.ok(await map.locator('.map-actions button').first().isDisabled());
    await search.fill('Missing landmark');
    assert.ok(await map.locator('.map-empty').isVisible());
    assert.ok(await map.locator('.map-actions').isHidden());
    await map.locator('.map-current').click();
    assert.match(await map.locator('.region-name').textContent(), /晨光草原/);
    assert.equal(await search.inputValue(), '');

    await sessionTouch(page);
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const bounds = await map.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.height <= viewport.height);
      await map.locator('.map-island-picker').selectOption('2');
      assert.match(await map.locator('.region-name').textContent(), /低語森林/);
      assert.ok((await map.locator('.map-island-picker').boundingBox()).height >= 44);
      if (viewport.width === 390) await shot('lantern-map-phone.png');
    }
    await map.locator('.map-local').click();
    await local.waitFor();
    await local.locator('[data-map-filter="people"]').click();
    assert.equal(await local.locator('[data-map-filter="people"]').getAttribute('aria-pressed'), 'true');
    await local.locator('#btnRegionMapClose').click();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => { __game.enterHarbor(); });
    await page.keyboard.press('Tab');
    await local.waitFor();
    assert.equal(await local.locator('#rmTitle').textContent(), '海風港鎮');
    assert.equal(await local.locator('#rmPoi option[value^="cp-"]').count(), 0);
    assert.match(await local.locator('#rmPoi').textContent(), /沉沒電光都/);
    await local.locator('#btnRegionMapClose').click();

    await page.evaluate(() => { __game.enterField(19); });
    await moveToGate('nextField');
    await page.waitForFunction(() => __game.zone === 'field:20');
    await moveToGate('prevField');
    await page.waitForFunction(() => __game.zone === 'field:19');

    await page.evaluate(() => { __game.enterTown(); __game.enterInterior('tavern'); });
    await page.keyboard.press('Tab');
    await local.waitFor();
    assert.equal(await local.locator('#rmTitle').textContent(), '楓之酒館');
    assert.match(await local.locator('#rmPoi').textContent(), /推門回到燈谷鎮/);
    assert.equal(await local.locator('#rmPoi option[value^="cp-"]').count(), 0);
    await local.locator('#btnRegionMapClose').click();
    await page.evaluate(() => { __game.exitInterior(); __game.startRun(); });
    await page.keyboard.press('m');
    assert.match(await map.locator('.map-location').textContent(), /副本第 1 層/);
    assert.deepEqual(errors, []);
    console.log('Passed world layer search, actual gate directions, field pins, checkpoint travel, responsive views, harbor, interiors and dungeon location.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

async function sessionTouch(page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
