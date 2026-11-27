const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const context = await browser.newContext();
    const url = new URL('?growth=progression', process.env.LV_GAME_URL || 'http://localhost:8080/').href;
    const errors = [];
    async function start(page, { open = true, fresh = false } = {}) {
      if (open) {
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
      }
      if (fresh) await page.locator('#btnHeroNext').click();
      await page.locator(fresh ? '#btnStart' : '#btnQuickStart').click();
      await page.evaluate(() => __game.enterField(1));
      assert.equal(await page.evaluate(() => __game.character.job), 1);
    }

    const page = await context.newPage();
    await start(page, { fresh: true });
    assert.equal(await page.evaluate(() => __game.attackGrowthRank()), 0);
    await page.evaluate(() => {
      const game = __game;
      const lamp = game.spots.find(spot => spot.expeditionId === 'opening-lamp');
      game.player.pos.set(lamp.x, game.world.gh(lamp.x, lamp.z), lamp.z);
      game.tryInteract();
      const practice = game.enemies.find(enemy => enemy.openingPractice);
      game.hitEnemy(practice, { dmg: 10000 });
    });
    await page.getByRole('heading', { name: '學習永久招式' }).waitFor();
    if (process.env.LV_GROWTH_SCREENSHOT) await page.screenshot({ path: process.env.LV_GROWTH_SCREENSHOT });
    await page.getByRole('button', { name: /稍後再學/ }).click();
    assert.equal(await page.evaluate(() => __game.attackGrowthRank()), 0);

    const other = await context.newPage();
    await start(other);
    await page.evaluate(() => __game.enterField(1));
    await Promise.all([
      page.getByRole('button', { name: /學會扇射/ }).click(),
      other.getByRole('button', { name: /學會扇射/ }).click(),
    ]);
    await Promise.all([page, other].map(tab =>
      tab.waitForFunction(() => __game.state === 'play' && __game.attackGrowthRank() === 1)));
    await other.close();

    // Restart the app and use the learned effect in a different field.
    await page.reload();
    await start(page, { open: false });
    const forest = await page.evaluate(() => {
      const game = __game;
      game.enterField(2);
      game.tryAttack();
      return { rank: game.attackGrowthRank(), arrows: game.projs.length };
    });
    assert.deepEqual(forest, { rank: 1, arrows: 3 });

    const started = await page.evaluate(() => {
      const game = __game;
      game.enterField(1);
      game.meta.p.keys = 1;
      return game.beginMeadowCave('normal', { seed: 4242 });
    });
    assert.equal(started, true);
    for (let stage = 0; stage < 3; stage++) {
      await page.waitForFunction(stage => {
        const game = __game;
        return game.caveRun?.stage === stage && game.waveIdx === stage &&
          game.enemies.some(enemy => !enemy.dead);
      }, stage);
      assert.equal(await page.evaluate(() => __game.attackGrowthRank()), 1);
      await page.evaluate(() => {
        for (const enemy of __game.enemies) {
          if (!enemy.dead) __game.hitEnemy(enemy, { dmg: 100000, crit: false, fire: false });
        }
      });
    }
    await page.waitForFunction(() => __game.meta.p.meadowCave?.clears?.normal === 1 && __game.cleared);
    await page.evaluate(() => __game.enterField(1));
    await page.getByRole('heading', { name: '深化永久招式' }).waitFor();
    await page.getByRole('button', { name: /學會回射/ }).click();
    await page.waitForFunction(() => __game.state === 'play' && __game.attackGrowthRank() === 2);
    await page.reload();
    await start(page, { open: false });
    assert.equal(await page.evaluate(() => __game.attackGrowthRank()), 2);
    assert.deepEqual(errors, []);
    console.log('Passed first lesson, postponing, two-tab learning, reload, cross-zone use, and cave mastery.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
