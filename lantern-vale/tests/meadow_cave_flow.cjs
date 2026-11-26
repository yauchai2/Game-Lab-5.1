const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { xpForNextLevel } = await import('../src/frontier.js');
  const url = process.env.LV_GAME_URL || 'http://localhost:8080/';
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: process.env.LV_SOFTWARE_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });

    const screenshot = async name => {
      if (process.env.LV_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, name) });
    };
    const start = async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnHeroNext').click();
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
    };
    const moveTo = async ({ kind, expeditionId, exitType }) => {
      await page.evaluate(({ kind, expeditionId, exitType }) => {
        const g = __game;
        const spot = exitType ? g.exits.find(exit => exit.type === exitType)
          : g.spots.find(s => kind ? s.kind === kind : s.expeditionId === expeditionId);
        const y = g.world.gh(spot.x, spot.z);
        g.player.pos.set(spot.x, y, spot.z);
        g.player.y = y;
      }, { kind, expeditionId, exitType });
    };
    const openTracker = async () => {
      const details = page.locator('#touchDetails');
      if (await details.isVisible() && !await page.locator('#questTracker').isVisible()) {
        await details.tap();
        if (await page.locator('#panelM').isVisible()) return;
      }
      await page.locator('#questTracker').click();
    };
    const openCave = async (touch = false) => {
      await moveTo({ kind: 'meadowCave' });
      if (touch) await page.locator('#touchInteract').tap();
      else await page.keyboard.press('f');
      await page.locator('#panelM').waitFor();
      assert.equal(await page.locator('#panelM h3').textContent(), '草原洞窟');
    };
    const field = async () => {
      await page.waitForFunction(() => __game.exitCooldown < 0.05);
      await moveTo({ exitType: 'run' });
      await page.waitForFunction(() => __game.zone === 'field:1');
    };
    const stage = async n => page.waitForFunction(n => {
      const g = __game;
      return g.caveRun?.stage === n && g.waveIdx === n && g.enemies.some(enemy => !enemy.dead);
    }, n);
    const defeat = async () => page.evaluate(() => {
      for (const enemy of __game.enemies.filter(e => !e.dead)) __game.hitEnemy(enemy, { dmg: 100000, crit: false, fire: false });
      const mats = __game.meta.p.mMats;
      return [mats.boar_tusk || 0, mats.thorn_bark || 0];
    });

    await start();
    await page.evaluate(() => { __game.meta.p.keys = 0; __game.meta.save(); });
    await openTracker();
    await page.locator('[data-opening-practice]').click();
    await page.waitForFunction(() => __game.zone === 'field:1' && __game.state === 'play');
    await moveTo({ expeditionId: 'opening-lamp' });
    await page.keyboard.press('f');
    await page.waitForFunction(() => __game.enemies.some(enemy => enemy.openingPractice));
    assert.deepEqual(await page.evaluate(() => [
      __game.meta.p.opening.practice,
      __game.enemies.find(enemy => enemy.openingPractice).parts.length,
    ]), ['spar', 0]);
    await start();
    await openTracker();
    await page.locator('[data-opening-practice]').click();
    await page.waitForFunction(() => __game.enemies.some(enemy => enemy.openingPractice));
    await page.evaluate(() => __game.hitEnemy(__game.enemies.find(enemy => enemy.openingPractice), { dmg: 100000 }));
    assert.equal(await page.evaluate(() => __game.meta.p.opening.practice), 'done');
    await openTracker();
    await page.locator('[data-exp-tier="1"][data-exp-route="survey"]').click();
    console.log('Entered the grassland');
    await openCave();
    assert.ok(await page.locator('[data-cave-tier="normal"]').isDisabled());
    await page.keyboard.press('Escape');

    for (const expeditionId of ['lamp-0', 'lamp-1']) {
      await moveTo({ expeditionId });
      await page.keyboard.press('f');
    }
    await page.evaluate(() => {
      __game.hitEnemy(__game.enemies.find(e => e.expeditionId === 'champion'), { dmg: 100000 });
    });
    await openTracker();
    await page.locator('[data-exp-gem="leech"]').click();
    await page.waitForFunction(() => __game.meta.p.meadowExpedition.cleared[1]?.gemUid != null);
    await page.keyboard.press('Escape');
    await openCave();
    assert.ok(await page.locator('[data-cave-tier="elite"]').isDisabled());
    await screenshot('lantern-cave-entry.png');
    await page.evaluate(() => { __game.party = 'testcave'; });
    await page.locator('[data-cave-tier="normal"]').click();
    await stage(0);
    await page.waitForFunction(() => __game.net.shard?.zone === __game.zone && __game.zone.startsWith('run:solo'));
    console.log('Cave entered with the expedition key');
    assert.equal(await page.evaluate(() => __game.meta.p.keys), 0);
    assert.deepEqual(await page.evaluate(() => __game.enemies.map(e => e.type)), ['slime', 'thorn']);
    await defeat();
    await stage(1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(__game.meta.key)).meadowCave.active.stage), 1);

    console.log('First checkpoint written to the character save');
    await start();
    await field();
    await openCave();
    await page.locator('[data-cave-tier="normal"]').click();
    await stage(1);
    assert.equal(await page.evaluate(() => __game.meta.p.keys), 0);
    assert.deepEqual(await page.evaluate(() => __game.enemies.map(e => e.type)), ['boar', 'thorn']);
    assert.equal(await page.evaluate(() => __game.enemies.find(e => e.type === 'boar').chargeRecoveryS), 1.25);
    await defeat();
    await stage(2);
    console.log('Reached the champion after resuming');
    await page.evaluate(() => {
      const g = __game;
      const boss = g.boss;
      g.player.pos.copy(boss.pos);
      g.player.pos.z += 3;
      g.player.y = g.world.gh(g.player.pos.x, g.player.pos.z);
      g.camPos.copy(g.player.pos);
    });
    await page.waitForFunction(() => __game.boss?.state === 'meadow-strike');
    await screenshot('lantern-cave-boss.png');
    // Enemy drops are independent of the guaranteed clear reward.
    const normalMats = await defeat();
    await page.waitForFunction(() => __game.cleared && __game.exits.some(exit => exit.type === 'caveReturn' && exit.on));
    const rewards = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return [p.meadowCave.active, p.meadowCave.clears.normal, p.mMats.boar_tusk, p.mMats.thorn_bark, p.keys];
    });
    assert.deepEqual(rewards, [null, 1, normalMats[0] + 3, normalMats[1] + 3, 0]);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(__game.meta.key)).opening.badge), 'ready');
    await page.evaluate(() => __game.roomCleared());
    assert.equal(await page.evaluate(() => __game.meta.p.mMats.boar_tusk), rewards[2]);
    await moveTo({ exitType: 'caveReturn' });
    await page.waitForFunction(() => __game.zone === 'field:1' && __game.caveRun === null);

    await page.evaluate(() => {
      __game.meta.p.keys = 1;
      __game.meta.p.goods.ore = 0;
      __game.meta.save();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await openCave(true);
    assert.match(await page.locator('#panelM').textContent(), /各 ×4/);
    await screenshot('lantern-cave-mobile.png');
    await page.locator('[data-cave-tier="elite"]').tap();
    await stage(0);
    assert.deepEqual(await page.evaluate(() => __game.enemies.map(e => e.type)), ['slime', 'slime', 'thorn']);
    await defeat();
    await stage(1);
    assert.deepEqual(await page.evaluate(() => __game.enemies.map(e => e.type)), ['boar', 'boar', 'thorn']);
    await defeat();
    await stage(2);
    const eliteMats = await defeat();
    await page.waitForFunction(() => __game.meta.p.meadowCave.clears.elite === 1);
    assert.deepEqual(await page.evaluate(() => [__game.meta.p.keys, __game.meta.p.mMats.boar_tusk, __game.meta.p.mMats.thorn_bark]), [0, eliteMats[0] + 4, eliteMats[1] + 4]);
    await page.evaluate(xp => {
      __game.meta.p.level = 4;
      __game.meta.p.xp = xp;
      __game.recalc();
      __game.meta.save();
    }, xpForNextLevel(4) - 1);
    await page.locator('[data-cc-forge]').tap();
    const badge = page.locator('[data-opening-badge="ready"]');
    const initialDamage = await page.evaluate(() => __game.player.stats.baseDmg);
    await badge.getByRole('button', { name: '打造並穿戴' }).tap();
    await page.locator('[data-opening-next]').waitFor();
    const badgeState = await page.evaluate(() => {
      const g = __game, p = JSON.parse(localStorage.getItem(g.meta.key));
      return [p.opening.badge, p.gear.charm?.name, g.player.stats.baseDmg];
    });
    assert.deepEqual(badgeState, ['crafted', '巡燈徽章', initialDamage + 2]);
    await page.locator('[data-opening-next]').tap();
    assert.ok(await page.locator('[data-opening-forest]').isVisible());
    await page.keyboard.press('Escape');
    await page.locator('#touchDetails').tap();
    await page.locator('[data-opening-forest]').waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(() => __game.ui.openPanel('workshop', { recipeId: 'rec_tusk_staff' }));
    const recipe = page.locator('#panelM [data-recipe-id]').first();
    assert.equal(await recipe.getAttribute('data-recipe-id'), 'rec_tusk_staff');
    assert.match(await recipe.textContent(), /還差 星紋礦 ×2/);
    assert.ok(await recipe.getByRole('button', { name: '鍛造' }).isDisabled());
    assert.equal(await page.locator('#panelM').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.getElementById('wipe'));
      return style.clipPath === 'none' ? Number(style.opacity) === 0 : style.clipPath.startsWith('circle(0%');
    });
    await screenshot('lantern-cave-workshop-mobile.png');
    const offer = page.locator('[data-recipe-ore="2"]');
    const purchaseCost = Number((await offer.textContent()).match(/共 (\d+) 金幣/)[1]);
    const coinsBefore = await page.evaluate(() => __game.meta.p.coins);
    await offer.getByRole('button', { name: '買入 ×2' }).tap();
    assert.equal(await offer.count(), 0);
    assert.deepEqual(await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return [p.goods.ore, p.coins];
    }), [2, coinsBefore - purchaseCost]);
    assert.match(await recipe.textContent(), /材料齊備 · Lv.5 才能穿戴/);
    console.log('Purchased the exact ore shortage inside the workshop');
    await recipe.getByRole('button', { name: '鍛造' }).tap();
    const crafted = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return [p.goods.ore, p.mMats.boar_tusk, p.mMats.thorn_bark, p.coins,
        p.bagItems.some(item => item.name.includes('狂豬利牙戰杖'))];
    });
    assert.deepEqual(crafted, [0, eliteMats[0], eliteMats[1] + 1, coinsBefore - purchaseCost - 120, true]);
    console.log('Crafted the staff and confirmed its cost and inventory entry');
    await page.keyboard.press('Escape');
    const itemName = '狂豬利牙戰杖';
    const itemUid = await page.evaluate(name => __game.meta.p.bagItems.find(item => item.name === name).uid, itemName);
    const equipCrafted = async () => {
      await page.locator('#btnMenu').tap();
      await page.locator('[data-hud-action="sk-bag"]').tap();
      await page.locator('#bagItemPicker').selectOption(itemUid);
      await page.locator('#bagBtns').getByRole('button', { name: '裝備' }).tap();
    };
    await equipCrafted();
    assert.equal(await page.evaluate(() => __game.player.equip.staff.name === '狂豬利牙戰杖'), false);
    await page.locator('#btnInvClose').tap();
    await field();
    await defeat();
    await page.waitForFunction(() => __game.meta.p.level >= 5);
    await equipCrafted();
    assert.deepEqual(await page.evaluate(name => {
      const p = JSON.parse(localStorage.getItem(__game.meta.key));
      return [p.gear.staff.name, p.bagItems.some(item => item.name === name)];
    }, itemName), [itemName, false]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await start();
    assert.deepEqual(await page.evaluate(() => [__game.player.equip.staff.name, __game.player.equip.charm.name]), [itemName, '巡燈徽章']);
    assert.deepEqual(errors, []);
    console.log('Passed expedition key, cave entrance, all waves, boss telegraph, saved checkpoint across reload, one-time payout, mobile market purchase, crafting, gear level gate and equip persistence.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
