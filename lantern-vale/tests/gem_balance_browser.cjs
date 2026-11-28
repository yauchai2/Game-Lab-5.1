const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const { NEW_ACTIVE_GEMS } = await import(pathToFileURL(path.join(__dirname, '../src/gem_catalog.js')));
  const url = new URL('?dev', process.env.LV_GAME_URL || 'http://localhost:8080/').href;
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const errors = [];
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    for (const page of [desktop, mobile]) {
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('#btnQuickStart').click();
      await page.evaluate(() => {
        const g = __game;
        g.dbg.setDevMode(true);
        g.dbg.openTools();
      });
      await page.locator('#devAllGems').click();
      await page.locator('#devAllGems').click();
      await page.keyboard.press('F3');
      await page.evaluate(() => __game.ui.openPuzzle());
      const before = await page.evaluate(() => {
        const p = __game.meta.p.puzzle;
        return [...p.bag, ...p.presets.flat()].map(gem => gem.uid).sort((a, b) => a - b);
      });
      assert.equal(before.length, 130);
      await page.locator('#pzAuto').click();
      const first = await page.evaluate(() => __game.player.hotbar.map(skill => ({
        id: skill.id, supports: skill.mod.supports.map(support => support.id),
      })));
      assert.ok(first.length >= 1 && first.length <= 2);
      assert.ok(first.every(skill => skill.supports.length <= 1));
      assert.ok(first.some(skill => skill.supports.length === 1));
      await page.evaluate(() => {
        const game = __game;
        game.meta.p.level = 30;
        game.recalc();
      });
      await page.locator('#pzAuto').click();
      const late = await page.evaluate(() => {
        const game = __game, p = game.meta.p.puzzle;
        return { skills: game.player.hotbar.length, supports: game.player.hotbar.flatMap(skill => skill.mod.supports).length,
          all: [...p.bag, ...p.presets.flat()].map(gem => gem.uid).sort((a, b) => a - b),
          saved: game.meta.load().puzzle.presets[p.activePreset].length === p.presets[p.activePreset].length };
      });
      assert.ok(late.skills >= 3 && late.skills <= 4 && late.supports > first.length);
      assert.deepEqual(late.all, before);
      assert.equal(late.saved, true);
      await page.locator('[data-pztab="shop"]').click();
      await page.locator('#pzSearch').fill('渡岸長明');
      await page.locator('.pz-shop-item').filter({ hasText: '渡岸長明' }).waitFor();
      assert.equal(await page.locator('.pz-shop-item').count(), 1);
      if (page === desktop && process.env.LV_SCREENSHOT) await page.screenshot({ path: process.env.LV_SCREENSHOT });
      await page.locator('#btnPuzzleX').click();
      await page.evaluate(() => {
        __game.meta.p.level = 1;
        __game.ui.openPanel('ascend');
      });
      assert.equal(await page.getByRole('button', { name: /試煉 [0-6]\/6/ }).count(), 2);
      assert.equal(await page.getByRole('button', { name: /試煉 [0-6]\/6/ }).first().isDisabled(), true);
      assert.equal(await page.evaluate(() => !!__game.meta.p.secondClass), false);
    }

    const sample = await desktop.evaluate(ids => {
      const g = __game;
      g.ui.closePanel();
      g.enterField(1);
      g.enemies.length = 0;
      const point = g.world.randomWalkable(() => 0.75, g.player.pos, 4);
      const spawn = (type, elite = false) => g.spawnEnemy(type, point, elite);
      const normal = spawn('boar'), elite = spawn('boar', true);
      const boss = spawn('stag');
      const p = g.player;
      g.enemies = [boss];
      const beforeHp = boss.hp;
      g.hitEnemy(boss, { dmg: 100, crit: false });
      const guarded = beforeHp - boss.hp;
      boss.state = 'stomp'; boss.t = 0; boss.step = 0;
      g.updateBoss(boss, 0, 2, new p.pos.constructor(1, 0), () => {}, () => {});
      const windup = g.decals.at(-1).dur;
      g.enemies = [];
      p.cds.atk = p.cds.action = 0;
      g.tryAttack();
      const earlyAttack = p.cds.atk;
      g.meta.p.level = 30;
      g.recalc();
      p.cds.atk = p.cds.action = 0;
      g.tryAttack();
      const lateAttack = p.cds.atk;

      const count = [];
      for (const id of ids) {
        g.meta.p.puzzle.presets[0] = [{ id, uid: 1, x: 1, y: 1, rot: 0 }];
        g.meta.p.puzzle.activePreset = 0;
        g.recalc();
        p.cds.action = p.skillCds[0] = p.roll = 0;
        p.mana = p.stats.mana;
        p.statuses.overload = 0;
        const before = g.projs.length + g.decals.length + g.rings.length + g.groundZones.length;
        g.castHotbar(0);
        const after = g.projs.length + g.decals.length + g.rings.length + g.groundZones.length;
        if (p.skillCds[0] > 0 && p.mana < p.stats.mana && after > before + 1) count.push(id);
        g.projs = [];
      }
      return { normal: normal.attackTempo, elite: elite.attackTempo, boss: boss.attackTempo,
        guarded, windup, earlyAttack, lateAttack, count };
    }, Object.keys(NEW_ACTIVE_GEMS));
    assert.deepEqual(sample.count, Object.keys(NEW_ACTIVE_GEMS));
    assert.ok(sample.earlyAttack > 1.5 && sample.lateAttack < 0.9);
    assert.ok(sample.normal < sample.elite && sample.elite < sample.boss);
    assert.equal(sample.guarded, 76);
    assert.ok(sample.windup >= 0.46 && sample.windup < 0.60);
    assert.deepEqual(errors, []);
    console.log('Desktop and touch auto-build, persistent inventory, Dev-mode ascension gate, 48 live skill casts, and boss sample passed.');
    console.log(JSON.stringify({ ...sample, count: sample.count.length }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
