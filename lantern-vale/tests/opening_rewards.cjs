const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const { MEADOW_TIERS } = await import('../src/expedition.js');
  const { xpForNextLevel } = await import('../src/frontier.js');
  const url = process.env.LV_GAME_URL || 'http://localhost:8080/';
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: process.env.LV_SOFTWARE_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const launch = async (page = null) => {
      page ||= await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnQuickStart').click();
      await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
      return page;
    };
    // Seed the same claimable record before either tab proceeds with the UI reward.
    const first = await launch();
    await first.evaluate(() => {
      const p = __game.meta.p;
      p.opening.practice = 'done';
      p.meadowExpedition = {
        active: { tier: 1, route: 'survey', completed: ['lamp-0', 'lamp-1'], championDown: true },
        cleared: {},
      };
      __game.meta.save();
    });
    const second = await launch();
    for (const tab of [first, second]) await tab.locator('#questTracker').click();
    await Promise.all([
      first.locator('[data-exp-gem=frost]').click(),
      second.locator('[data-exp-gem=leech]').click(),
    ]);
    await first.waitForFunction(() => !!JSON.parse(localStorage.getItem(__game.meta.key)).meadowExpedition.cleared[1]);
    const claimed = await first.evaluate(() => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return { coins: p.coins, keys: p.keys, gems: p.puzzle.bag.length, level: p.level, xp: p.xp };
    });
    const reward = MEADOW_TIERS[1];
    assert.deepEqual([claimed.coins, claimed.keys, claimed.gems], [15 + reward.coins, 1 + reward.keys, 1]);
    let earnedXp = claimed.xp;
    for (let level = 1; level < claimed.level; level++) earnedXp += xpForNextLevel(level);
    assert.equal(earnedXp, reward.xp);
    await second.close();
    await launch(first);

    await first.evaluate(() => {
      __game.meta.p.opening.badge = 'ready';
      __game.meta.save();
      __game.ui.openPanel('workshop');
    });
    const third = await launch();
    await third.evaluate(() => __game.ui.openPanel('workshop'));
    const observer = await launch();
    await Promise.all([
      first.locator('[data-opening-badge]').getByRole('button', { name: '打造並穿戴' }).click(),
      third.locator('[data-opening-badge]').getByRole('button', { name: '打造並穿戴' }).click(),
    ]);
    await first.waitForFunction(() => JSON.parse(localStorage.getItem(__game.meta.key)).opening.badge === 'crafted');
    const badge = await first.evaluate(() => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return [p.gear.charm.name, p.bagItems?.filter(item => item.name === '巡燈徽章').length || 0];
    });
    assert.deepEqual(badge, ['巡燈徽章', 0]);
    const stale = observer;
    // Viewing the workshop is read-only. A subsequent purchase must reject the old snapshot.
    await stale.evaluate(() => {
      __game.ui.openPanel('workshop');
      __game.ui.openPanel('market');
    });
    const conflict = stale.locator('#saveConflict');
    await stale.evaluate(() => {
      const g = __game;
      if (JSON.parse(localStorage.getItem(g.meta.key)).gear.charm.name !== '巡燈徽章') throw Error('Workshop overwrote the saved badge');
    });
    assert.equal(await conflict.isVisible(), false);
    await stale.getByRole('button', { name: '買入', exact: true }).first().click();
    await conflict.waitFor({ state: 'visible' });
    assert.equal(await stale.evaluate(() => JSON.parse(localStorage.getItem(__game.meta.key)).gear.charm.name), '巡燈徽章');
    const dir = process.env.LV_SCREENSHOT_DIR;
    if (dir) await conflict.screenshot({ path: require('node:path').join(dir, 'save-conflict.png') });
    await Promise.all([stale.waitForNavigation({ waitUntil: 'domcontentloaded' }), conflict.getByRole('button').click()]);
    await stale.locator('#btnQuickStart').click();
    await stale.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
    assert.equal(await stale.evaluate(() => __game.player.equip.charm.name), '巡燈徽章');
    await third.close();
    await observer.close();
    await launch(first);
    await first.evaluate(() => {
      const g = __game;
      g.meta.p.opening.badge = 'ready';
      const existing = __makeItem(() => 0.51, 1, 1, 'charm');
      existing.name = '原有測試飾品';
      g.player.equip.charm = existing;
      g.recalc();
      g.meta.save();
      g.ui.openPanel('openingBadge');
    });
    const occupied = first.locator('[data-opening-badge]');
    assert.match(await occupied.textContent(), /原有測試飾品/);
    await occupied.getByRole('button', { name: '打造並換上徽章' }).click();
    await first.locator('[data-opening-next]').click();
    const swapped = await first.evaluate(() => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return [p.gear.charm.name, p.bagItems.some(entry => entry.name === '原有測試飾品')];
    });
    assert.deepEqual(swapped, ['巡燈徽章', true]);
    assert.match(await first.locator('[data-opening-meadow]').textContent(), /推薦/);
    await first.locator('[data-opening-elite]').click();
    await first.waitForFunction(() => document.getElementById('qtDesc').textContent === '前往草原洞窟入口');
    await launch(first);
    await first.waitForFunction(() => __game.questGuide.target?.label === '前往晨光草原'
      && document.getElementById('qtDesc').textContent === '前往草原洞窟入口');
    assert.equal(await first.evaluate(() => __game.zone), 'town');
    console.log('Passed one-time rewards, stale-save protection and resuming the elite walking route.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
