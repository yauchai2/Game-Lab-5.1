const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const errors = [];
  try {
    const url = new URL('?growth=progression', process.env.LV_GAME_URL || 'http://localhost:8080/').href;
    async function join() {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('#btnQuickStart').click();
      await page.waitForFunction(() => __game.wallet && __game.net.growthWorld);
      await page.evaluate(() => {
        __game.meta.p.growthLessons = { 0: 1 };
        __game.enterField(1);
      });
      await page.waitForFunction(() => __game.growthWatch && __game.state === 'play');
      return page;
    }

    async function approach(page, index) {
      await page.evaluate(index => {
        const game = __game;
        const spot = game.spots.find(spot => spot.kind === 'growthWatch' && spot.index === index);
        if (!game.world.isLand(spot.x, spot.z)) throw new Error('Watch marker is off land');
        const y = game.world.gh(spot.x, spot.z);
        game.player.pos.set(spot.x, y, spot.z);
        game.player.y = y;
        game.player.vel.set(0, 0, 0);
        game.posT = 0;
        game.updateNet(0);
      }, index);
    }

    const first = await join();
    const second = await join();
    await approach(second, null);
    // Confirm the second player is already visible at the station before the first starts.
    await first.waitForFunction(() => [...__game.remotes.values()].some(player =>
      !player.bot && Math.hypot(player.tx + 67.5, player.tz - 79.1) < 1));
    await approach(first, null);
    await first.keyboard.press('KeyF');
    await Promise.all([first, second].map(page => page.waitForFunction(() =>
      __game.growthWatch?.state === 'active' && __game.growthWatch.total === 3)));

    await approach(first, 0);
    await first.keyboard.press('KeyF');
    await second.waitForFunction(() => __game.growthWatch.lit === 1);
    const spectator = await join();
    assert.deepEqual(await spectator.evaluate(() => [__game.growthWatch.lit, __game.growthWatch.total]), [1, 3]);

    if (process.env.LV_GROWTH_SCREENSHOT) {
      await approach(second, null);
      await second.keyboard.press('KeyF');
      await second.screenshot({ path: process.env.LV_GROWTH_SCREENSHOT });
    }
    await approach(second, 1);
    await second.keyboard.press('KeyF');
    await first.waitForFunction(() => __game.growthWatch.lit === 2);
    await first.evaluate(() => __game.net.disconnect());
    await first.waitForFunction(() => !__game.growthWatch);
    await approach(second, 2);
    await second.keyboard.press('KeyF');
    await spectator.waitForFunction(() => __game.growthWatch.state === 'cleared');
    assert.equal(await first.evaluate(() => !!__game.meta.load().growthJourney?.clears?.[1]), false);
    await first.evaluate(() => __game.net.connect(__game.playerName, __game.hoodIdx, __game.party));
    await Promise.all([first, second].map(async page => {
      await page.getByRole('heading', { name: '深化永久招式' }).waitFor();
      assert.ok(await page.evaluate(() => __game.meta.load().growthJourney?.clears?.[1]));
    }));
    assert.equal(await spectator.evaluate(() => !!__game.meta.load().growthJourney?.clears?.[1]), false);
    assert.deepEqual(errors, []);
    console.log('Shared watch passed two contributors using F, a late spectator, and saved milestone credit after reconnect.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
