const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
  const errors = [];
  async function join(mobile) {
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: mobile, isMobile: mobile,
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('?growth=progression', base).href);
    await page.locator('#btnQuickStart').click();
    await page.waitForFunction(() => __game.net.dungeonLobbies && __game.net.shard?.zone === 'town');
    await page.evaluate(() => {
      const game = __game;
      game.meta.p.growthLessons = { 0: 1 };
      game.meta.p.keys = 1;
      game.enterField(1);
      const door = game.spots.find(spot => spot.kind === 'meadowCave');
      game.player.pos.set(door.x, game.world.gh(door.x, door.z), door.z);
      game.tryInteract();
    });
    await page.locator('[data-cave-tier="normal"]').click();
    return page;
  }

  try {
    const leader = await join(false);
    const follower = await join(true);
    await Promise.all([leader, follower].map(page =>
      page.waitForFunction(() => __game.dungeon.pending?.info?.members.length === 2)));
    await leader.locator('[data-dungeon-fill]').uncheck();
    await leader.locator('[data-dungeon-start]').click();

    for (let stage = 0; stage < 3; stage++) {
      await Promise.all([leader, follower].map(page => page.waitForFunction(stage => {
        const game = __game;
        return game.caveRun?.stage === stage && game.waveIdx === stage &&
          game.dungeon.run?.wave && game.enemies.some(enemy => !enemy.dead);
      }, stage)));
      assert.equal(await follower.evaluate(() => __game.attackGrowthRank()), 1);
      await leader.evaluate(() => {
        for (const enemy of __game.enemies) if (!enemy.dead) __game.hitEnemy(enemy, { dmg: 100000 });
      });
    }

    for (const page of [leader, follower]) {
      await page.waitForFunction(() => __game.meta.p.meadowCave?.clears?.normal === 1 && __game.cleared);
      assert.equal(await page.evaluate(() => __game.meta.load().growthJourney.clears[1]), true);
      await page.evaluate(() => __game.roomCleared());
      assert.equal(await page.evaluate(() => __game.meta.load().meadowCave.clears.normal), 1);
    }
    assert.deepEqual(errors, []);
    console.log('Desktop and mobile shared cave both earned the same one-time growth milestone.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
