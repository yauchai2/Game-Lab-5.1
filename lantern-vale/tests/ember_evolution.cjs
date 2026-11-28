const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('?growth=progression', process.env.LV_GAME_URL || 'http://localhost:18113/').href);
    await page.locator('#btnQuickStart').click();
    await page.evaluate(() => {
      const g = __game, profile = g.meta.p;
      g.character.job = 0;
      profile.secondClass = 'bastion';
      profile.level = 29;
      profile.meadowCave = { clears: { normal: 1 } };
      profile.growthLessons = { 0: 2 };
      profile.growthJourney = { clears: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } };
      g.enterField(6);
      g.openGrowthStation(g.spots.find(spot => spot.kind === 'growthStation'));
    });
    const mastery = page.getByRole('button', { name: /餘燼精通 · 鹿王火線/ });
    assert.equal(await mastery.count(), 0);
    await page.getByRole('button', { name: /返回/ }).click();
    await page.evaluate(() => {
      __game.meta.p.level = 30;
      __game.openGrowthStation(__game.spots.find(spot => spot.kind === 'growthStation'));
    });
    async function finishTrial(markTargets) {
      await mastery.click();
      return page.evaluate(mark => {
        const g = __game, trial = g.growthTrial;
        while (g.growthTrial === trial) {
          const enemies = g.enemies.filter(enemy => enemy.growthTrial === trial && !enemy.dead);
          if (!enemies.length) throw new Error('Trial stalled');
          for (const enemy of enemies) {
            if (mark) g.resolveEmberHit({ stage: 3, hits: new Set() }, enemy, 1);
            g.hitEnemy(enemy, { dmg: 1e8, crit: false });
          }
        }
        return !!g.meta.load().growthJourney.emberMastery;
      }, markTargets);
    }
    assert.equal(await finishTrial(false), false);
    await page.evaluate(() => __game.openGrowthStation(__game.spots.find(spot => spot.kind === 'growthStation')));
    assert.equal(await finishTrial(true), true);
    const sample = await page.evaluate(() => {
      const g = __game, p = g.player, profile = g.meta.p;
      const core = profile.puzzle.bag.find(entry => entry.id === 'ember_inferno_core');
      g.growthEffects = [];
      profile.puzzle.activePreset = 0;
      profile.puzzle.presets[0] = [{ uid: 100, id: 'bolt', x: 1, y: 1, rot: 0 }, { ...core, x: 1, y: 2, rot: 0 }];
      const emit = (level, trigger = false) => {
        profile.level = level;
        g.recalc();
        const first = g.projs.length;
        g.execPuzzleSkill('bolt', p.hotbar[0].mod, 1, trigger);
        return g.projs.slice(first);
      };
      const early = emit(1);
      const mid = emit(12);
      p.emberCharge = 4;
      const trigger = emit(30, true);
      const charged = emit(30);
      const blocked = emit(30);
      const e = g.enemies[0];
      g.resolveEmberHit(charged[0].emberCast, e, 1);
      g.resolveEmberHit(charged[0].emberCast, e, 1);
      return { early: early.length, mid: mid[0].emberCast.stage, trigger: trigger[0].emberCast,
        charged: charged[0].emberCast.charged, blocked: blocked[0].emberCast.charged,
        pulses: g.growthEffects.length, cores: profile.puzzle.bag.filter(entry => entry.id === core.id).length };
    });
    assert.deepEqual(sample, { early: 1, mid: 2, trigger: null, charged: true, blocked: false, pulses: 3, cores: 1 });
    assert.deepEqual(errors, []);
    console.log('Ember evolution: level gate, mastery qualification, persisted core, manual-only fire tide and cooldown passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
