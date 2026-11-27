const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: process.env.LV_SOFTWARE_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
  try {
    const open = async (mobile = false) => {
      const page = await browser.newPage({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
        hasTouch: mobile, isMobile: mobile,
      });
      page.errors = [];
      page.on('pageerror', error => page.errors.push(error.message));
      await page.goto(base);
      await page.locator('#btnQuickStart').click();
      await page.waitForFunction(() => __game.net.dungeonLobbies && __game.net.shard?.zone === 'town');
      return page;
    };
    const cave = async (page, mobile) => {
      await page.evaluate(() => {
        const g = __game;
        if (g.field !== 1) g.enterField(1);
        const door = g.spots.find(spot => spot.kind === 'meadowCave');
        g.player.pos.set(door.x, g.world.gh(door.x, door.z), door.z);
        g.player.y = g.player.pos.y;
      });
      if (mobile) await page.locator('#touchInteract').tap();
      else await page.keyboard.press('f');
      await page.locator('[data-cave-tier="normal"]').click();
    };
    const count = (page, n) => page.waitForFunction(n => __game.dungeon.pending?.info?.members.length === n, n);
    const leader = await open();
    const guest = await open(true);
    await cave(leader, false);
    await count(leader, 1);
    await cave(guest, true);
    await Promise.all([count(leader, 2), count(guest, 2)]);
    assert.equal(await guest.locator('[data-dungeon-start]').count(), 0);
    assert.equal(await leader.evaluate(() => __game.meta.p.keys), 1);
    assert.equal(await guest.evaluate(() => __game.meta.p.keys), 1);
    const dir = process.env.LV_SCREENSHOT_DIR;
    if (dir) await guest.screenshot({ path: path.join(dir, 'dungeon-lobby-mobile.png'), animations: 'disabled' });

    await guest.locator('[data-dungeon-cancel]').tap();
    await count(leader, 1);
    await cave(guest, true);
    await count(leader, 2);
    await leader.locator('[data-dungeon-start]').click();
    const ready = page => page.waitForFunction(() => __game.dungeon.run?.wave && __game.enemies.some(enemy => !enemy.dead));
    await Promise.all([ready(leader), ready(guest)]);
    const details = page => page.evaluate(() => {
      const g = __game;
      return [g.zone, g.runSeed, g.dungeon.run.bots, g.meta.p.keys, g.enemies.map(e => e.type)];
    });
    assert.deepEqual(await details(leader), await details(guest));
    assert.equal((await details(leader))[2], 1);
    assert.equal((await details(leader))[3], 0);
    await Promise.all([leader, guest].map(page => page.waitForFunction(() => __game.dungeon.bots.length === 1)));
    assert.match(await leader.locator('#tags').textContent(), /巡燈衛士（AI）/);

    await leader.evaluate(() => {
      const g = __game;
      g.hitEnemy(g.enemies[0], { dmg: 6 });
      const ally = g.dungeon.bots[0];
      ally.actor.tx = g.enemies[0].pos.x;
      ally.actor.tz = g.enemies[0].pos.z;
    });
    await guest.waitForFunction(() => __game.enemies[0].hp < __game.enemies[0].maxHp - 6);
    const hp = page => page.evaluate(() => __game.enemies[0].hp / __game.enemies[0].maxHp);
    await leader.waitForFunction(expected => Math.abs(__game.enemies[0].hp / __game.enemies[0].maxHp - expected) < 1e-8, await hp(guest));

    await guest.evaluate(() => {
      const g = __game;
      g.enemies.forEach(enemy => g.hitEnemy(enemy, { dmg: 100000 }));
    });
    await Promise.all([leader, guest].map(page => page.waitForFunction(() => __game.caveRun?.stage === 1)));

    await leader.close();
    await guest.waitForFunction(() => __game.dungeon.run.count === 1 && __game.dungeon.run.leader === __game.net.id);
    assert.deepEqual(leader.errors, []);
    assert.deepEqual(guest.errors, []);
    await guest.close();
    const atlasLeader = await open();
    const atlasGuest = await open();
    for (const page of [atlasLeader, atlasGuest]) {
      await page.evaluate(() => __game.queueRun({ kind: 'run' }, '冒險副本'));
    }
    await count(atlasLeader, 2);
    await atlasLeader.locator('[data-dungeon-fill]').uncheck();
    await atlasLeader.locator('[data-dungeon-start]').click();
    await Promise.all([ready(atlasLeader), ready(atlasGuest)]);
    assert.deepEqual(await atlasLeader.evaluate(() => __game.enemies.map(e => e.type)),
      await atlasGuest.evaluate(() => __game.enemies.map(e => e.type)));
    assert.equal(await atlasGuest.evaluate(() => __game.dungeon.run.bots), 0);
    await atlasGuest.evaluate(() => {
      const g = __game;
      for (const e of g.enemies) g.hitEnemy(e, { dmg: 100000 });
    });
    await Promise.all([atlasLeader, atlasGuest].map(async page => {
      await page.locator('#boons .card').first().click();
      await page.waitForFunction(() => __game.state === 'play' && __game.cleared && __game.exits.every(exit => exit.on));
    }));
    const selectExit = async (page, index) => page.evaluate(index => {
      const g = __game;
      const exit = g.exits[index];
      const y = g.world.gh(exit.x, exit.z);
      g.player.pos.set(exit.x, y, exit.z);
      g.player.y = y;
    }, index);
    await selectExit(atlasLeader, 0);
    await atlasGuest.waitForFunction(() => __game.dungeon.run.exit === 0 && __game.mapPin?.label === '隊伍選擇的出口');
    await selectExit(atlasGuest, 1);
    await atlasGuest.waitForFunction(() => !!document.querySelector('#toasts')?.textContent.includes('請使用地圖標記'));
    assert.equal(await atlasGuest.evaluate(() => __game.depth), 0);
    await selectExit(atlasGuest, 0);
    await Promise.all([atlasLeader, atlasGuest].map(page => page.waitForFunction(() => __game.depth === 1)));
    assert.deepEqual(atlasLeader.errors, []);
    assert.deepEqual(atlasGuest.errors, []);
    await atlasLeader.close();
    await atlasGuest.close();

    const solo = await open();
    await solo.waitForFunction(() => !!__game.wallet);
    await solo.evaluate(() => __game.dungeon.open({ kind: 'raid' }, '共鳴樹庭'));
    await count(solo, 1);
    await solo.locator('[data-dungeon-start]').click();
    await solo.waitForFunction(() => __game.raid?.allies.size === 2);
    await solo.evaluate(() => {
      const g = __game;
      g.net.disconnect();
      g.queueRun({ kind: 'run' }, '離線冒險副本');
    });
    await solo.locator('[data-dungeon-start]').click();
    await solo.waitForFunction(() => __game.dungeon.run?.id == null && __game.depth === 0 && __game.dungeon.bots.length === 2);
    assert.deepEqual(solo.errors, []);
    await solo.close();
    console.log('Passed cross-device waiting, cancel and rejoin, shared cave and HP, AI damage, checkpoint, leader transfer, Atlas branch consensus, and raid AI.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
