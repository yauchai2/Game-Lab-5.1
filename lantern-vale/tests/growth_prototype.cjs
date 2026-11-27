const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
  try {
    async function sample(job, mode, scenario = 'spread') {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(new URL(mode ? '?growth=' + mode : '/', base).href);
        if (job === 1) await page.locator('#btnHeroNext').click();
        await page.locator(job === 1 ? '#btnStart' : '#btnQuickStart').click();
        const result = await page.evaluate(({ mode, scenario }) => {
          const game = __game;
          game.enterField(1);
          const player = game.player;
          const job = game.character.job;
          const bow = job === 1;
          const direction = game.aimDir().set(1, 0);
          game.aimDir = () => direction.clone();
          const lamp = game.spots.find(spot => spot.expeditionId === 'opening-lamp');
          player.pos.x = lamp.x;
          player.pos.z = lamp.z;
          game.tryInteract();
          const practiceHP = game.enemies.find(enemy => enemy.openingPractice).maxHp;
          const offsets = scenario === 'overlap' ? [[1.2, 0]]
            : bow ? [[5, 0], [5, 1.43], [5, -1.43]] : [[1, 0], [-1.9, 0], [-2.8, 0]];
          const fixture = offsets.map(([x, z]) => {
            const enemy = game.spawnEnemy('boar', { x: player.pos.x + x, z: player.pos.z + z }, false);
            enemy.pos.y = player.pos.y;
            enemy.r = 0.28;
            return enemy;
          });
          game.enemies = fixture;
          game.world.groundY = () => player.y;
          player.swingCount = bow ? 0 : 2;
          const random = Math.random;
          let projectileCount;
          let ringCount;
          let beforeRelease;
          let cooldownBlocked;
          let queueAfterRoomChange;
          let result;
          const hits = fixture.map(() => 0);
          const events = fixture.map(() => 0);
          const originalHit = game.hitEnemy.bind(game);
          game.hitEnemy = (enemy, ...args) => {
            const index = fixture.indexOf(enemy);
            hits[index] += args[0].dmg;
            events[index]++;
            return originalHit(enemy, ...args);
          };
          try {
            Math.random = () => 0.5;
            game.tryAttack();
            projectileCount = game.projs.length;
            ringCount = game.rings.length;
            // Change where the player stands and aims after firing. Delayed
            // effects must originate at the original position and angle.
            if (mode === 'advanced') {
              game.aimDir = () => direction.clone().negate();
              player.pos.z += 6;
            }
            for (let tick = 0; tick < 20; tick++) game.updateProjs(1 / 60);
            beforeRelease = [...events];
            if (mode === 'advanced' && !bow) {
              // Move a target hit by the inner ring into the outer ring.
              fixture[1].pos.x -= 0.7;
            }
            for (let tick = 0; tick < 24; tick++) game.updateProjs(1 / 60);
            if (mode === 'advanced' && bow) {
              player.cds.atk = player.cds.action = 0;
              game.tryAttack();
              cooldownBlocked = game.growthEffects.length === 0;
            }
            result = { hits: [...hits], events: [...events], damage: fixture.map(enemy => enemy.maxHp - enemy.hp) };
            if (mode === 'advanced' && scenario === 'room-change') {
              player.cds.atk = player.cds.action = 0;
              player.growthEchoReadyAt = 0;
              if (!bow) player.swingCount = 2;
              game.tryAttack();
              if (game.growthEffects.length !== 1) throw new Error('Expected a pending effect before room change');
              game.enterField(2);
              queueAfterRoomChange = game.growthEffects.length;
              game.updateProjs(0.5);
            }
          } finally {
            Math.random = random;
          }
          return { job, weapon: game.meta.p.weapon, hp: player.stats.maxHp, practiceHP,
            atkCd: Number(player.cds.atk.toFixed(3)), projectileCount, ringCount, ...result, beforeRelease, cooldownBlocked, queueAfterRoomChange };
        }, { mode, scenario });
        if (mode === 'advanced' && job === 0 && scenario === 'spread' && process.env.LV_GROWTH_SCREENSHOT) {
          await page.screenshot({ path: process.env.LV_GROWTH_SCREENSHOT });
        }
        assert.deepEqual(errors, []);
        return result;
      } finally {
        await page.close();
      }
    }
    const [guard, growthGuard, bow, growthBow] = await Promise.all([
      sample(0, null), sample(0, 'prototype'), sample(1, null), sample(1, 'prototype'),
    ]);
    assert.equal(guard.weapon, 'shield');
    assert.equal(bow.weapon, 'bow');
    assert.equal(bow.projectileCount, 1);
    assert.equal(growthBow.projectileCount, 3);
    assert.deepEqual(growthBow.events, [1, 1, 1]);
    assert.equal(growthBow.hits[0], bow.hits[0]);
    assert.deepEqual(bow.hits.slice(1), [0, 0]);
    assert.ok(growthBow.hits.slice(1).every(damage => damage > 0 && damage < bow.hits[0]));
    assert.equal(growthGuard.ringCount, guard.ringCount + 1);
    assert.equal(growthGuard.hits[0], guard.hits[0]);
    assert.equal(growthGuard.events[0], guard.events[0]);
    assert.equal(guard.hits[1], 0);
    assert.ok(growthGuard.hits[1] > 0);
    const close = await sample(1, 'prototype', 'overlap');
    assert.deepEqual(close.events, [1]);
    assert.deepEqual(close.damage, [bow.damage[0]]);
    assert.equal(growthGuard.damage[0], guard.damage[0]);
    assert.equal(growthBow.damage[0], bow.damage[0]);
    const [advancedBow, advancedGuard] = await Promise.all([
      sample(1, 'advanced', 'room-change'), sample(0, 'advanced', 'room-change'),
    ]);
    assert.deepEqual(advancedBow.beforeRelease, growthBow.events);
    assert.deepEqual(advancedBow.events, [2, 1, 1]);
    assert.equal(advancedBow.damage[0], growthBow.damage[0] + 2);
    assert.equal(advancedBow.cooldownBlocked, true);
    assert.deepEqual(advancedGuard.beforeRelease, growthGuard.events);
    assert.deepEqual(advancedGuard.damage.slice(0, 2), growthGuard.damage.slice(0, 2));
    assert.ok(advancedGuard.damage[2] > 0, 'Outer wave reaches the additional target');
    assert.deepEqual(advancedGuard.events, [2, 1, 1]);
    assert.equal(advancedBow.queueAfterRoomChange, 0);
    assert.equal(advancedGuard.queueAfterRoomChange, 0);
    const attacksPerEcho = Math.ceil(5.5 / advancedBow.atkCd);
    const fixedCycleGain = (advancedBow.damage[0] - bow.damage[0]) / (attacksPerEcho * bow.damage[0]);
    assert.ok(fixedCycleGain <= 0.05, 'Fixed single-target cadence stays within the 5% budget');
    if (process.env.LV_GROWTH_SCREENSHOT) await sample(0, 'advanced');
    console.log(JSON.stringify({ guard, growthGuard, bow, growthBow, close, advancedBow, advancedGuard, fixedCycleGain }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
