const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = new URL('?growth=progression', process.env.LV_GAME_URL || 'http://localhost:8080/').href;
    await page.goto(url);
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

    async function openStation(field) {
      await page.evaluate(field => {
        const game = __game;
        if (game.field !== field) game.enterField(field);
        const spot = game.spots.find(spot => spot.kind === 'growthStation');
        game.player.pos.set(spot.x, game.world.gh(spot.x, spot.z), spot.z);
        game.tryInteract();
      }, field);
    }

    async function clearWaves() {
      return page.evaluate(() => {
        const game = __game;
        const trial = game.growthTrial;
        if (!trial) throw new Error('No trial');
        const waves = [];
        while (game.growthTrial === trial) {
          const enemies = game.enemies.filter(enemy => enemy.growthTrial === trial && !enemy.dead);
          if (!enemies.length) throw new Error('Trial stalled');
          waves.push(enemies.map(enemy => enemy.type));
          for (const enemy of enemies) game.hitEnemy(enemy, { dmg: 100000, crit: false, fire: false });
        }
        return waves;
      });
    }

    // A player who enters the forest early cannot skip the first milestone.
    await openStation(2);
    assert.equal(await page.getByRole('button', { name: /林間列陣/ }).count(), 0);
    await page.getByRole('button', { name: /返回/ }).click();

    await openStation(1);
    await page.getByRole('button', { name: /南門守燈/ }).click();
    assert.deepEqual(await clearWaves(), [['slime', 'thorn'], ['boar']]);
    await page.getByRole('button', { name: /學會回射/ }).click();
    await page.waitForFunction(() => __game.state === 'play' && __game.attackGrowthRank() === 2);
    assert.equal(await page.evaluate(() => __game.meta.p.meadowCave?.clears?.normal || 0), 0);

    await openStation(2);
    await page.getByRole('button', { name: /林間列陣/ }).click();
    assert.deepEqual(await clearWaves(), [['slime', 'thorn'], ['thorn', 'thorn']]);
    await openStation(2);
    await page.getByRole('button', { name: /切換至穿列/ }).click();
    assert.equal(await page.evaluate(() => __game.meta.load().growthJourney.loadouts[1].alternate), true);

    await page.reload();
    await page.locator('#btnQuickStart').click();
    await page.evaluate(() => __game.enterField(2));
    const piercing = await page.evaluate(() => {
      const game = __game;
      const p = game.player;
      const dir = game.aimDir().set(1, 0);
      game.aimDir = () => dir.clone();
      const targets = [3, 6].map(dx => {
        const enemy = game.spawnEnemy('slime', { x: p.pos.x + dx, z: p.pos.z }, false);
        enemy.pos.y = p.pos.y;
        return enemy;
      });
      game.enemies = targets;
      game.world.groundY = () => p.y;
      const random = Math.random;
      try {
        Math.random = () => 0.5;
        game.tryAttack();
        const arrows = game.projs.length;
        for (let i = 0; i < 32; i++) game.updateProjs(1 / 60);
        return { arrows, damage: targets.map(enemy => enemy.maxHp - enemy.hp) };
      } finally {
        Math.random = random;
      }
    });
    assert.equal(piercing.arrows, 1);
    assert.ok(piercing.damage[1] > 0 && piercing.damage[1] < piercing.damage[0]);

    for (const [field, label] of [[3, '沼澤窄口'], [4, '雪原反擊'], [5, '火岩夾擊'], [6, '鹿王樹心']]) {
      await openStation(field);
      await page.getByRole('button', { name: new RegExp(label) }).click();
      await clearWaves();
    }
    assert.deepEqual(await page.evaluate(() => __game.meta.load().growthJourney.clears),
      { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true });
    await openStation(2);
    await page.getByRole('heading', { name: '第一章完成 · 進階試煉' }).waitFor();
    if (process.env.LV_GROWTH_SCREENSHOT) await page.screenshot({ path: process.env.LV_GROWTH_SCREENSHOT });
    await page.getByRole('button', { name: /林間列陣 · 進階/ }).click();
    assert.deepEqual(await clearWaves(), [['slime', 'thorn', 'thorn', 'thorn']]);
    await openStation(2);
    await page.getByRole('button', { name: /林間列陣 · 進階/ }).click();
    assert.deepEqual(await clearWaves(), [['slime', 'thorn'], ['thorn', 'thorn']]);
    assert.equal(await page.evaluate(() => __game.meta.load().growthJourney.repeats[2]), 2);
    const guard = await browser.newPage();
    guard.on('pageerror', error => errors.push(error.message));
    await guard.goto(url);
    await guard.locator('#btnQuickStart').click();
    await guard.evaluate(() => {
      const game = __game;
      game.meta.p.growthLessons = { 0: 1 };
      game.meta.p.growthJourney = { clears: { 1: true, 2: true } };
      game.enterField(2);
      const spot = game.spots.find(spot => spot.kind === 'growthStation');
      game.player.pos.set(spot.x, game.world.gh(spot.x, spot.z), spot.z);
      game.tryInteract();
    });
    await guard.getByRole('button', { name: /切換至前推劍氣/ }).click();
    const forwardWave = await guard.evaluate(() => {
      const game = __game;
      const p = game.player;
      const dir = game.aimDir().set(1, 0);
      game.aimDir = () => dir.clone();
      game.enemies = [1, 4.8].map(dx => {
        const enemy = game.spawnEnemy('slime', { x: p.pos.x + dx, z: p.pos.z }, false);
        enemy.pos.y = p.pos.y;
        return enemy;
      });
      p.swingCount = 2;
      game.tryAttack();
      const before = game.enemies.map(enemy => enemy.hp);
      const count = game.projs.length;
      for (let i = 0; i < 28; i++) game.updateProjs(1 / 60);
      return { count, extra: game.enemies.map((enemy, i) => before[i] - enemy.hp) };
    });
    assert.equal(forwardWave.count, 1);
    assert.equal(forwardWave.extra[0], 0);
    assert.ok(forwardWave.extra[1] > 0);
    assert.deepEqual(errors, []);
    console.log('Passed field route, persisted loadout, piercing, guard wave, chapter clear, and advanced repeats.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
