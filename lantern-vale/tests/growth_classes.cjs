const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
    const cases = [
      [2, '落地火種', '燎原火種', '遠置火種'],
      [3, '影返', '擴影', '側影'],
      [4, '踏地蓮波', '緩行蓮波', '推蓮'],
    ];
    for (const [job, first, second, alternate] of cases) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(new URL('?growth=progression', base).href);
        for (let i = 0; i < job; i++) await page.locator('#btnHeroNext').click();
        await page.locator('#btnStart').click();
        await page.evaluate(() => {
          const game = __game;
          game.enterField(1);
          const lamp = game.spots.find(spot => spot.expeditionId === 'opening-lamp');
          game.player.pos.set(lamp.x, game.world.gh(lamp.x, lamp.z), lamp.z);
          game.tryInteract();
          game.hitEnemy(game.enemies.find(enemy => enemy.openingPractice), { dmg: 10000 });
        });
        await page.getByRole('button', { name: new RegExp('學會' + first) }).click();
        await page.waitForFunction(() => __game.state === 'play' && __game.attackGrowthRank() === 1);
        const result = await page.evaluate(job => {
          const g = __game;
          g.enterField(2);
          const p = g.player;
          const dir = g.aimDir().set(1, 0);
          g.aimDir = () => dir.clone();
          g.world.groundY = () => p.y;
          function attack(mode) {
            for (const projectile of g.projs) g.scene.remove(projectile.mesh);
            g.projs = [];
            g.growthPrototype = mode;
            p.cds.atk = p.cds.action = 0;
            p.swingCount = 2;
            p.classRes = 0;
            const positions = job === 4 ? [[1, 0], [-1.8, 0]] : [[1, 0], [0, 1.4]];
            const targets = positions.map(([x, z]) => {
              const enemy = g.spawnEnemy('slime', { x: p.pos.x + x, z: p.pos.z + z }, false);
              enemy.pos.y = p.pos.y;
              return enemy;
            });
            g.enemies = targets;
            g.tryAttack();
            const pending = g.growthEffects.length;
            for (let i = 0; i < 43; i++) g.updateProjs(1 / 60);
            return { pending, damage: targets.map(enemy => enemy.maxHp - enemy.hp) };
          }
          const random = Math.random;
          try {
            Math.random = () => 0.5;
            const base = attack(undefined);
            const learned = attack('progression');
            return { job: g.character.job, base, learned };
          } finally { Math.random = random; }
        }, job);
        assert.equal(result.job, job);
        assert.equal(result.base.pending, 0);
        assert.equal(result.learned.pending, 1);
        assert.equal(result.learned.damage[0], result.base.damage[0]);
        assert.ok(result.learned.damage[1] > result.base.damage[1], first);

        await page.evaluate(() => {
          const game = __game;
          game.meta.p.growthJourney = { clears: { 1: true, 2: true } };
          game.meta.save();
          game.enterField(1);
        });
        await page.getByRole('button', { name: new RegExp('學會' + second) }).click();
        await page.waitForFunction(() => __game.state === 'play' && __game.attackGrowthRank() === 2);
        await page.evaluate(() => {
          const game = __game;
          game.enterField(2);
          const station = game.spots.find(spot => spot.kind === 'growthStation');
          game.player.pos.set(station.x, game.world.gh(station.x, station.z), station.z);
          game.tryInteract();
        });
        await page.getByRole('button', { name: new RegExp('切換至' + alternate) }).click();
        assert.equal(await page.evaluate(job => __game.meta.load().growthJourney.loadouts[job].alternate, job), true);
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ first, second, alternate, ...result }));
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
