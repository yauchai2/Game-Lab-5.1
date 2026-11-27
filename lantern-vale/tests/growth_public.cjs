const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const context = await browser.newContext();
    const base = process.env.LV_GROWTH_PUBLIC_URL || 'https://preview.beaconfall.test/Game-Lab-5.1/';
    if (!process.env.LV_GROWTH_PUBLIC_URL) {
      const local = process.env.LV_GAME_URL || 'http://localhost:8080/';
      await context.route('https://preview.beaconfall.test/**', async route => {
        const url = new URL(route.request().url());
        const relative = url.pathname.slice('/Game-Lab-5.1/'.length) + url.search;
        const response = await context.request.get(new URL(relative, local).href);
        await route.fulfill({ response });
      });
    }

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('?test', base).href);
    const preview = page.getByRole('link', { name: '試玩第一章成長' });
    assert.equal(new URL(await preview.getAttribute('href'), base).searchParams.get('growth'), 'progression');
    await preview.click();
    const note = page.locator('#growthPreviewNote');
    await note.waitFor();
    const isolation = await page.evaluate(() => {
      const { meta, net, growthPrototype } = __game;
      localStorage.setItem('lv_profile', JSON.stringify({ schemaVersion: 3, level: 17 }));
      return { key: meta.key, level: meta.p.level, mode: growthPrototype, onlineUrl: net.url };
    });
    assert.equal(isolation.mode, 'progression');
    assert.equal(isolation.onlineUrl, null);
    assert.equal(isolation.level, 1);
    assert.ok(isolation.key.startsWith('lv_growth_preview_'));

    await page.locator('#btnHeroNext').click();
    await page.locator('#btnStart').click();
    await page.evaluate(() => {
      const game = __game;
      game.enterField(1);
      const lamp = game.spots.find(spot => spot.expeditionId === 'opening-lamp');
      game.player.pos.set(lamp.x, game.world.gh(lamp.x, lamp.z), lamp.z);
      game.tryInteract();
      game.hitEnemy(game.enemies.find(enemy => enemy.openingPractice), { dmg: 10000 });
    });
    await page.getByRole('button', { name: /學會扇射/ }).click();
    await page.waitForFunction(() => __game.state === 'play' && __game.attackGrowthRank() === 1);
    await page.reload();
    await page.locator('#btnQuickStart').click();
    await page.evaluate(() => __game.enterField(2));
    assert.equal(await page.evaluate(() => __game.attackGrowthRank()), 1);

    await page.goto(base);
    await page.locator('#growthPreviewNote').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => __game.growthPrototype ?? null), null);
    assert.equal(await page.evaluate(() => __game.meta.p.level), 17);
    assert.equal(await page.evaluate(() => __game.meta.p.growthLessons?.[1] ?? null), null);
    assert.deepEqual(errors, []);
    console.log('Passed public preview entry, isolated saves, learning, cross-zone reload and standard entry.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
