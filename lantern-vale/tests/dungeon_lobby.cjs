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
    const leaderId = await leader.evaluate(() => __game.net.id);
    await guest.waitForFunction(id => __game.remotes.has(id), leaderId);
    await guest.evaluate(() => {
      const g = __game, attack = g.companionAttack.bind(g), sound = g.audio.sfx.bind(g.audio);
      window.teamActions = [];
      window.spatialCues = [];
      g.companionAttack = (actor, kind) => { teamActions.push([actor.id, kind]); attack(actor, kind); };
      g.audio.sfx = (name, volume, pan) => {
        if (pan != null) spatialCues.push([name, volume, pan]);
        sound(name, volume, pan);
      };
    });
    await leader.evaluate(() => {
      const g = __game;
      g.player.pos.x += 2;
      g.meta.p.weapon = 'bow';
      g.player.cds.atk = g.player.cds.action = 0;
      g.tryAttack();
    });
    await guest.waitForFunction(id => teamActions.some(([actor, kind]) => actor === id && kind === 'bow'), leaderId);
    await guest.waitForFunction(() => spatialCues.some(([name, volume, pan]) => name === 'bowRelease' && volume < 0.55 && Math.abs(pan) > 0.01));
    await leader.evaluate(() => { __game.player.cds.action = __game.player.cds.bolt = 0; __game.tryBolt(); });
    await guest.waitForFunction(id => teamActions.some(([actor, kind]) => actor === id && kind === 'cast'), leaderId);
    assert.deepEqual(await guest.evaluate(id => teamActions.filter(e => e[0] === id).map(e => e[1]), leaderId), ['bow', 'cast']);
    await leader.evaluate(() => __game.enterField(1));
    await guest.waitForFunction(id => !__game.remotes.has(id), leaderId);
    await leader.evaluate(() => { __game.player.cds.atk = __game.player.cds.action = 0; __game.tryAttack(); });
    await guest.waitForTimeout(500);
    assert.equal(await guest.evaluate(id => teamActions.filter(e => e[0] === id).length, leaderId), 2);

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
    assert.equal(await guest.evaluate(() => __game.dungeon.run.attackSync), true);
    await guest.evaluate(() => {
      const g = __game;
      const resolve = g.resolveMeadowImpact.bind(g);
      window.sharedImpacts = [];
      g.resolveMeadowImpact = (enemy, x, z, radius, multiplier) => {
        sharedImpacts.push({ x, z, radius, multiplier });
        resolve(enemy, x, z, radius, multiplier);
      };
    });
    const startHp = await leader.evaluate(() => __game.player.hp);
    const circle = await leader.evaluate(() => {
      const g = __game, enemy = g.enemies.find(e => e.meadowPounce), p = g.player;
      for (const actor of g.enemies) { actor.cd = 5; actor.stun = 0; }
      const { x, z } = p.pos;
      p.iframes = 0;
      g.queueMeadowStrike(enemy, x, z, 1.45, 1.35, 1);
      return { x, z, radius: 1.45, multiplier: 1 };
    });
    await guest.waitForFunction(circle => __game.enemies.some(e => {
      const a = e.incomingAttack;
      return a && !a.charge && a.x === circle.x && a.z === circle.z && a.size === circle.radius;
    }), circle);
    const spectatorHp = await guest.evaluate(({ x, z }) => {
      const g = __game, p = g.player;
      const side = [2.9, -2.9].find(offset => g.world.isLand(x + offset, z));
      if (side !== undefined) {
        p.pos.set(x + side, g.world.gh(x + side, z), z);
        p.y = p.pos.y;
        g.camPos.copy(p.pos);
      }
      return p.hp;
    }, circle);
    if (dir) await guest.screenshot({ path: path.join(dir, 'beaconfall-shared-cave-warning.png') });
    await guest.waitForFunction(() => sharedImpacts.length > 0);
    assert.deepEqual(await guest.evaluate(() => sharedImpacts), [circle]);
    assert.equal(await guest.evaluate(() => __game.player.hp), spectatorHp);
    await leader.waitForFunction(hp => __game.player.hp < hp, startHp);
    await leader.evaluate(() => {
      const g = __game, enemy = g.enemies.find(e => e.meadowPounce);
      g.queueMeadowStrike(enemy, enemy.pos.x, enemy.pos.z, 1.45, 1, 1);
    });
    await guest.waitForFunction(() => __game.enemies.some(e => e.incomingAttack && !e.incomingAttack.charge));
    await leader.evaluate(() => { __game.enemies.find(e => e.meadowPounce).stun = 1.5; });
    await guest.waitForFunction(() => __game.enemies.every(e => !e.incomingAttack));
    await guest.waitForTimeout(1100);
    assert.equal(await guest.evaluate(() => sharedImpacts.length), 1);


    await leader.evaluate(() => {
      const g = __game;
      g.hitEnemy(g.enemies[0], { dmg: 6 });
    });
    await guest.waitForFunction(() => spatialCues.some(([name, volume]) => name === 'hit' && volume > 0 && volume <= 0.57));
    await leader.evaluate(() => {
      const g = __game;
      const ally = g.dungeon.bots[0];
      ally.actor.tx = g.enemies[0].pos.x;
      ally.actor.tz = g.enemies[0].pos.z;
    });
    await guest.waitForFunction(() => __game.enemies[0].hp < __game.enemies[0].maxHp - 6);
    await guest.waitForFunction(() => teamActions.some(([id, kind]) => id === 'bot-dungeon-0' && kind === 'shield'));
    const hp = page => page.evaluate(() => __game.enemies[0].hp / __game.enemies[0].maxHp);
    await leader.waitForFunction(expected => Math.abs(__game.enemies[0].hp / __game.enemies[0].maxHp - expected) < 1e-8, await hp(guest));

    await guest.evaluate(() => {
      const g = __game;
      g.enemies.forEach(enemy => g.hitEnemy(enemy, { dmg: 100000 }));
    });
    await Promise.all([leader, guest].map(page => page.waitForFunction(() => __game.caveRun?.stage === 1)));
    for (const page of [leader, guest]) await page.waitForFunction(() => __game.dungeon.run.enemies?.some(e => e.type === 'boar' && !e.dead));
    const direction = await leader.evaluate(() => {
      const g = __game, e = g.enemies.find(enemy => enemy.type === 'boar');
      e.stun = 0; e.state = 'move'; e.cd = 0; e.t = 0; e.chargeWindS = 1.5;
      const x = e.pos.x + 3, z = e.pos.z;
      g.player.pos.set(x, g.world.gh(x, z), z); g.player.y = g.player.pos.y;
      g.updateEnemies(1 / 60);
      return Math.atan2(e.cdir.x, e.cdir.y);
    });
    await guest.waitForFunction(direction => __game.enemies.some(e => {
      const a = e.incomingAttack;
      return a?.charge && Math.abs(a.extra - direction) < 1e-8 && e.state === 'wind';
    }), direction);
    await guest.waitForFunction(() => __game.enemies.some(e => e.incomingAttack?.charge && e.state === 'charge'));
    await guest.waitForFunction(() => __game.enemies.filter(e => e.type === 'boar').every(e => !e.incomingAttack));


    await leader.evaluate(() => {
      const g = __game, boar = g.enemies.find(e => e.type === 'boar');
      boar.stun = 0;
      g.queueMeadowStrike(boar, boar.pos.x, boar.pos.z, 1.7, 1.8, 1);
    });
    await guest.waitForFunction(() => __game.enemies.some(e => e.incomingAttack && !e.incomingAttack.charge));
    await leader.close();
    await guest.waitForFunction(() => __game.dungeon.run.count === 1 && __game.dungeon.run.leader === __game.net.id
      && __game.enemies.every(e => !e.incomingAttack));
    assert.equal(await guest.evaluate(() => sharedImpacts.length), 1);
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
    // Exercise the normal boss-room wave and attack loop without clearing another eight rooms.
    for (const page of [atlasLeader, atlasGuest]) {
      await page.evaluate(() => {
        const g = __game;
        g.dungeon.run.path = 'entry:boss';
        g.runSeed = 428;
        g.loadRoom(9, 'item');
        g.camZoom = 1.3;
      });
    }
    await Promise.all([ready(atlasLeader), ready(atlasGuest)]);
    for (const page of [atlasLeader, atlasGuest]) {
      assert.equal(await page.evaluate(() => {
        const g = __game;
        g.boss.cd = 60;
        // Keep the test's level-one characters below the automatic revive threshold.
        g.boss.dmg = 12;
        g.boss.spd = 0;
        g.boss.hitCd = 60;
        g.boss.pos.set(0, g.world.gh(0, 0), 0);
        const impact = g.resolveBossGroundImpact.bind(g);
        g.resolveBossGroundImpact = (enemy, attack) => {
          const hp = g.player.hp;
          impact(enemy, attack);
          window.lastStagImpact = { shape: attack.shape, hp, after: g.player.hp };
        };
        return g.dungeon.run.attackSync && g.dungeon.run.rootSync && g.dungeon.run.burstSync;
      }), true);
    }
    await atlasGuest.waitForTimeout(2200);
    const prepareStagAttack = (kind, offset) => atlasLeader.evaluate(({ kind, offset }) => {
      const g = __game, e = g.boss, p = g.player;
      const { x, z } = e.pos;
      const y = g.world.gh(x, z);
      p.pos.set(x + offset, g.world.gh(x + offset, z), z);
      p.y = p.pos.y;
      p.vel.set(0, 0, 0);
      p.iframes = 0;
      e.state = kind;
      e.t = e.step = e.stun = 0;
      return { x, z, y };
    }, { kind, offset });
    const ring = await prepareStagAttack('donut', -2.5);
    await atlasGuest.waitForFunction(({ x, z }) => {
      const a = __game.boss.incomingAttack;
      const uniforms = a?.decal.mesh.material.uniforms;
      return a?.shape === 2 && a.x === x && a.z === z && a.size === 9.5 && a.extra === 3.5
        && uniforms.uShape.value === 3 && uniforms.uInner.value === 3.5 / 9.5;
    }, ring);
    await atlasGuest.evaluate(({ x, z, y }) => {
      const g = __game, p = g.player;
      const points = [[x + 6, z], [x - 6, z], [x, z + 6], [x, z - 6]];
      const point = points.find(([px, pz]) => g.world.isLand(px, pz) && Math.abs(g.world.gh(px, pz) - y) < 1);
      if (!point) throw new Error('Expected a walkable outer ring');
      p.pos.set(point[0], g.world.gh(...point), point[1]);
      p.y = p.pos.y;
      p.vel.set(0, 0, 0);
      p.iframes = 0;
      g.camPos.set(x, y, z);
    }, ring);
    if (dir) await atlasGuest.screenshot({ path: path.join(dir, 'beaconfall-shared-stag-ring.png') });
    await atlasGuest.waitForFunction(() => window.lastStagImpact?.shape === 2);
    const ringImpact = await atlasGuest.evaluate(() => lastStagImpact);
    assert.ok(ringImpact.after < ringImpact.hp, JSON.stringify(ringImpact));
    await atlasLeader.waitForFunction(() => window.lastStagImpact?.shape === 2);
    const safeRing = await atlasLeader.evaluate(() => lastStagImpact);
    assert.equal(safeRing.after, safeRing.hp);

    const stomp = await prepareStagAttack('stomp', -2.5);
    await atlasGuest.waitForFunction(({ x, z }) => {
      const a = __game.boss.incomingAttack;
      return a?.shape === 3 && a.x === x && a.z === z && a.size === 4.2;
    }, stomp);
    await atlasGuest.waitForFunction(() => window.lastStagImpact?.shape === 3);
    const stompImpact = await atlasGuest.evaluate(() => lastStagImpact);
    assert.equal(stompImpact.after, stompImpact.hp);
    await atlasLeader.waitForFunction(() => window.lastStagImpact?.shape === 3);
    const hitStomp = await atlasLeader.evaluate(() => lastStagImpact);
    assert.ok(hitStomp.after < hitStomp.hp);

    await atlasGuest.evaluate(() => {
      const g = __game, resolve = g.resolveStagRootRow.bind(g);
      window.stagRootPulses = [];
      g.resolveStagRootRow = (enemy, row, step) => {
        const hp = g.player.hp;
        resolve(enemy, row, step);
        stagRootPulses.push({ step, damage: hp - g.player.hp });
      };
    });
    await prepareStagAttack('roots', 5);
    await atlasGuest.waitForFunction(() => __game.boss.incomingAttack?.shape === 4);
    const rootRows = page => page.evaluate(() => {
      const e = __game.boss;
      return (e.incomingAttack || e.sharedAttack).roots.map(row =>
        row.map(({ x, z, decal }) => [x, z, decal.dur, decal.hold]));
    });
    assert.deepEqual(await rootRows(atlasGuest), await rootRows(atlasLeader));
    await atlasGuest.evaluate(() => {
      const g = __game, p = g.player;
      const { x, y, z } = g.boss.incomingAttack.roots[3][0];
      p.pos.set(x, y, z);
      p.y = y;
      p.vel.set(0, 0, 0);
      p.iframes = 0;
      g.camPos.copy(p.pos);
    });
    if (dir) await atlasGuest.screenshot({ path: path.join(dir, 'beaconfall-shared-stag-roots.png') });
    await atlasGuest.waitForFunction(() => stagRootPulses.length === 7 && !__game.boss.incomingAttack);
    const pulses = await atlasGuest.evaluate(() => stagRootPulses);
    assert.deepEqual(pulses.map(pulse => pulse.step), [1, 2, 3, 4, 5, 6, 7]);
    assert.ok(pulses[3].damage > 0);
    assert.ok(pulses.filter(pulse => pulse.damage > 0).length === 1);

    await atlasLeader.evaluate(() => { __game.boss.phase = 2; });
    await prepareStagAttack('roots', 5);
    await atlasGuest.waitForFunction(() => __game.boss.incomingAttack?.shape === 4);
    assert.ok((await rootRows(atlasGuest)).some(row => row.length === 3));
    const cancelledWarnings = await atlasGuest.evaluate(() => {
      window.cancelledRootWarnings = __game.boss.incomingAttack.roots.flat().map(point => point.decal);
      return cancelledRootWarnings.length;
    });
    assert.ok(cancelledWarnings > 0);
    await atlasLeader.evaluate(() => { __game.boss.stun = 1.6; });
    await atlasGuest.waitForFunction(() => !__game.boss.incomingAttack && cancelledRootWarnings.every(decal => decal.dead));
    await atlasGuest.waitForTimeout(1600);
    assert.equal(await atlasGuest.evaluate(() => stagRootPulses.length), 7);
    await atlasLeader.evaluate(() => { __game.boss.phase = 1; });
    for (const page of [atlasLeader, atlasGuest]) {
      await page.evaluate(() => {
        const g = __game, original = g.resolveStagBurst.bind(g);
        window.stagVolleys = [];
        g.resolveStagBurst = (enemy, attack, step) => {
          const previousCount = g.eprojs.length;
          original(enemy, attack, step);
          stagVolleys.push({ step, projectiles: g.eprojs.slice(previousCount).map(shot =>
            [shot.mesh.position.x, shot.mesh.position.y, shot.mesh.position.z, shot.vx, shot.vz]) });
        };
      });
    }
    await prepareStagAttack('burst', 5);
    await atlasGuest.waitForFunction(() => {
      const a = __game.boss.incomingAttack;
      return a?.shape === 5 && a.pulseCount === 2 && a.decal.mat.uniforms.uRays.value === 14;
    });
    const burstHp = await atlasGuest.evaluate(() => {
      const g = __game, p = g.player, { x, z } = g.boss.incomingAttack.origin;
      const px = x + Math.cos(0.2) * 3.2, pz = z + Math.sin(0.2) * 3.2;
      p.pos.set(px, g.world.gh(px, pz), pz);
      p.y = p.pos.y;
      p.vel.set(0, 0, 0);
      p.iframes = 0;
      g.camPos.copy(p.pos);
      return p.hp;
    });
    if (dir) await atlasGuest.screenshot({ path: path.join(dir, 'beaconfall-shared-stag-burst.png') });
    await atlasGuest.waitForFunction(() => stagVolleys.length === 2 && !__game.boss.incomingAttack);
    const volleyLog = page => page.evaluate(() => stagVolleys);
    const volleys = await volleyLog(atlasGuest);
    assert.deepEqual(await volleyLog(atlasLeader), volleys);
    assert.deepEqual(volleys.map(({ step, projectiles }) => [step, projectiles.length]), [[1, 14], [2, 14]]);
    assert.notDeepEqual(volleys[0].projectiles[0], volleys[1].projectiles[0]);
    await atlasGuest.waitForFunction(hp => __game.player.hp < hp, burstHp);

    await atlasLeader.evaluate(() => {
      const e = __game.boss;
      e.phase = 2;
      e.brokenWeakens = new Set(['burst']);
    });
    await prepareStagAttack('burst', 5);
    await atlasGuest.waitForFunction(() => {
      const a = __game.boss.incomingAttack;
      return a?.shape === 5 && a.pulseCount === 3 && a.decal.mat.uniforms.uRays.value === 7;
    });
    await atlasGuest.waitForFunction(() => stagVolleys.length === 3);
    await atlasLeader.evaluate(() => { __game.boss.stun = 1.6; });
    await atlasGuest.waitForFunction(() => !__game.boss.incomingAttack);
    await atlasGuest.waitForTimeout(1250);
    assert.deepEqual((await volleyLog(atlasGuest)).slice(2).map(({ step, projectiles }) => [step, projectiles.length]), [[1, 7]]);
    await atlasLeader.evaluate(() => { __game.boss.phase = 1; });
    await prepareStagAttack('charge', 5);
    await atlasGuest.waitForFunction(() => __game.boss.incomingAttack?.shape === 1 && __game.boss.state === 'wind');
    await atlasGuest.waitForFunction(() => __game.boss.incomingAttack?.shape === 1 && __game.boss.state === 'charge');
    await atlasGuest.waitForFunction(() => __game.boss.incomingAttack?.shape === 1 && __game.boss.state === 'wind');
    await atlasGuest.waitForFunction(() => __game.boss.incomingAttack?.shape === 1 && __game.boss.state === 'charge');
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
      const g = __game, original = g.enemyCue.bind(g);
      window.raidCues = [];
      g.enemyCue = (name, pos) => { raidCues.push(name); original(name, pos); };
      g.keys.w = true;
      g.mouse.l = true;
    });
    await solo.waitForFunction(() => __game.player.swingT > 0);
    await solo.evaluate(() => { __game.keys = {}; __game.mouse.l = false; });
    await solo.waitForFunction(() => raidCues.includes('enemyWind'));
    if (dir) await solo.screenshot({ path: path.join(dir, 'beaconfall-raid-windup.png'), animations: 'disabled' });
    await solo.waitForFunction(() => raidCues.includes('enemyRelease'));
    assert.deepEqual(await solo.evaluate(() => raidCues.slice(0, 2)), ['enemyWind', 'enemyRelease']);
    await solo.evaluate(() => {
      const g = __game;
      g.net.disconnect();
      g.queueRun({ kind: 'run' }, '離線冒險副本');
    });
    await solo.locator('[data-dungeon-start]').click();
    await solo.waitForFunction(() => __game.dungeon.run?.id == null && __game.depth === 0 && __game.dungeon.bots.length === 2);
    assert.deepEqual(solo.errors, []);
    await solo.close();
    console.log('Passed cross-device waiting, cancel and rejoin, shared cave and HP, AI damage, checkpoint, leader transfer, Atlas branch consensus, raid AI, one-shot player/AI feedback, zone isolation, synced cave circles and charges, shared stag ground attacks, root pulses, projectile volleys, interruptions, and charge chains, and raid telegraph timing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
