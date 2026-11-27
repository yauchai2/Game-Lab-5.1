const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('?growth=progression', base).href);
    await page.locator('#btnQuickStart').click();
    await page.waitForFunction(() => __game.wallet && __game.net.dungeonLobbies);
    await page.evaluate(() => {
      const game = __game;
      game.meta.p.growthLessons = { 0: 2 };
      game.meta.p.growthJourney = { clears: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } };
      game.meta.save();
      game.dungeon.open({ kind: 'raid' }, '共鳴樹庭');
    });
    await page.locator('[data-dungeon-start]').click();
    await page.waitForFunction(() => __game.state === 'raid');
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => __game.player.pos.z < 2.7);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('Space');
    await page.waitForFunction(() => __game.state === 'play' && __game.meta.load().growthJourney?.guildClear === true);
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => __game.wallet.amber), 1);
    await page.evaluate(() => {
      const game = __game;
      game.enterField(1);
      const spot = game.spots.find(spot => spot.kind === 'growthStation');
      game.player.pos.set(spot.x, game.world.gh(spot.x, spot.z), spot.z);
      game.tryInteract();
    });
    await page.getByRole('heading', { name: '第一章完成 · 共鳴樹庭已完成' }).waitFor();
    if (process.env.LV_GROWTH_SCREENSHOT) await page.screenshot({ path: process.env.LV_GROWTH_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log('Passed live guild raid, contributor result and saved chapter endgame record.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
