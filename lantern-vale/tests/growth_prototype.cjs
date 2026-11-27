const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
  try {
    async function sample(job, prototype, overlap = false) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(new URL(prototype ? '?growth=prototype' : '/', base).href);
        if (job === 1) await page.locator('#btnHeroNext').click();
        await page.locator(job === 1 ? '#btnStart' : '#btnQuickStart').click();
        const result = await page.evaluate(overlap => {
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
          const offsets = overlap ? [[1.2, 0]] : bow ? [[5, 0], [5, 1.43], [5, -1.43]] : [[1, 0], [-1.9, 0]];
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
            for (let tick = 0; tick < 40; tick++) game.updateProjs(1 / 60);
          } finally {
            Math.random = random;
          }
          return { job, weapon: game.meta.p.weapon, hp: player.stats.maxHp, practiceHP,
            atkCd: Number(player.cds.atk.toFixed(3)), projectileCount, ringCount, hits, events,
            damage: fixture.map(enemy => enemy.maxHp - enemy.hp) };
        }, overlap);
        if (prototype && job === 0 && process.env.LV_GROWTH_SCREENSHOT) {
          await page.screenshot({ path: process.env.LV_GROWTH_SCREENSHOT });
        }
        assert.deepEqual(errors, []);
        return result;
      } finally {
        await page.close();
      }
    }
    const [guard, growthGuard, bow, growthBow] = await Promise.all([
      sample(0, false), sample(0, true), sample(1, false), sample(1, true),
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
    const close = await sample(1, true, true);
    assert.deepEqual(close.events, [1]);
    assert.deepEqual(close.damage, [bow.damage[0]]);
    assert.equal(growthGuard.damage[0], guard.damage[0]);
    assert.equal(growthBow.damage[0], bow.damage[0]);
    console.log(JSON.stringify({ guard, growthGuard, bow, growthBow, close }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
