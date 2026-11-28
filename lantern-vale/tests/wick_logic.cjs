// Beaconfall Phase 4: class wicks and advancement stances (pure Node, no browser).
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const imp = f => import(pathToFileURL(path.join(__dirname, '../src/' + f)));
  const W = await imp('wick.js'), F = await imp('flame.js'), A = await imp('world_alive.js'), P = await imp('puzzle.js');
  const { migrateProfile, SAVE_SCHEMA_VERSION } = await imp('save_schema.js');
  const C = W.WICK_CFG;

  // ---- data: 5 class wicks, 10 stances, every advanced class has a story choice ----
  assert.equal(P.CLASSES.length, 5);
  assert.equal(Object.keys(C.classes).length, 5, 'one wick per class');
  const jobs = new Set();
  for (const cls of P.CLASSES) {
    const cw = W.classWickByJob(cls.id);
    assert.ok(cw, 'wick for ' + cls.key); jobs.add(cw.job);
    assert.equal(cw.key, cls.key, 'wick key matches class key');
    for (const k of ['name', 'nameEn', 'tagline', 'desc', 'icon']) assert.ok(cw[k], `${cls.key}.${k}`);
    assert.equal(W.stancesForJob(cls.id).length, 2, `${cls.key} has two stances`);
    assert.equal((A.SECOND_CLASSES[cls.id] || []).length, 2);
    // each wick must set at least one real lamp behaviour
    const w = W.buildWick(cls.id, null);
    const changes = Object.entries(w.flameWick).some(([k, v]) => v !== (k === 'maxBonus' ? 0 : 1))
      || w.tiers.length || w.moveGainPerSec || Object.values(w.perDim).some(Boolean) || Object.values(w.onEnterLight).some(Boolean) || Object.values(w.onMechFull).some(Boolean);
    assert.ok(changes, cls.key + ' wick does something');
  }
  assert.equal(jobs.size, 5);
  const ids = Object.keys(C.stances);
  assert.equal(ids.length, 10);
  for (const [job, list] of Object.entries(A.SECOND_CLASSES)) for (const sc of list) {
    const st = W.stanceById(sc.id);
    assert.ok(st, 'stance for ' + sc.id);
    assert.equal(st.pair, P.CLASSES[job].key, sc.id + ' belongs to its class');
    for (const k of ['name', 'nameEn', 'stance', 'scene', 'vow', 'gain', 'price', 'epilogue']) assert.ok(st[k] && st[k].length >= 4, `${sc.id}.${k}`);
    // a stance is a trade: it has a stated upside and a stated price
    assert.ok(st.mods && Object.keys(st.mods).length, sc.id + ' has mods');
  }
  // the two stances of one class are different
  for (const cls of P.CLASSES) {
    const [a, b] = W.stancesForJob(cls.id);
    assert.notDeepEqual(a.mods, b.mods);
  }

  // ---- merge ----
  const base = W.buildWick(0, null), bast = W.buildWick(0, 'bastion'), earth = W.buildWick(0, 'earthwalker');
  assert.equal(base.stanceId, null);
  assert.equal(bast.stanceId, 'bastion');
  assert.equal(bast.flameWick.maxBonus, base.flameWick.maxBonus + 15, 'maxBonus adds');
  assert.ok(Math.abs(bast.flameWick.costMul - base.flameWick.costMul * 0.8) < 1e-9, 'costMul multiplies');
  assert.equal(bast.tiers.length, base.tiers.length + 1, 'tiers concatenate');
  assert.equal(bast.perDim.dmgPct, -3); assert.equal(earth.perDim.dmgPct, 4);
  assert.equal(W.buildWick(0, 'skywarden').stanceId, null, 'a stance of another class is ignored');
  assert.equal(W.buildWick(0, 'nonsense').stanceId, null);
  assert.equal(W.buildWick(99, 'bastion').id, 'none', 'unknown job does not throw');
  const thunder = W.buildWick(4, 'thunderfist'), lotus = W.buildWick(4, 'lotussage'), monk = W.buildWick(4, null);
  assert.ok(thunder.onEnterLight.healPct >= 0 && thunder.onEnterLight.healPct < monk.onEnterLight.healPct, 'heal never negative');
  assert.ok(lotus.onEnterLight.healPct > monk.onEnterLight.healPct);
  // no combination breaks the sane limits
  for (const cls of P.CLASSES) for (const st of [null, ...W.stancesForJob(cls.id).map(s => s.id)]) {
    const w = W.buildWick(cls.id, st);
    for (const [k, v] of Object.entries(w.flameWick)) if (k !== 'maxBonus') assert.ok(v >= 0.2 && v <= 3, `${cls.key}/${st} ${k}`);
    for (const dim of [0, 1, 2, 3]) for (const pct of [0, 0.5, 1]) for (const safe of [true, false]) {
      const fx = W.computeWickFx(w, { dim, pct, safe, dark: true });
      assert.ok(fx.dmgPct <= C.limits.dmgPctMax && fx.dmgPct >= C.limits.dmgPctMin);
      assert.ok(fx.speedOffset >= 0 && fx.speedOffset <= C.limits.speedOffsetMax);
      assert.ok(fx.crit >= 0 && fx.crit <= C.limits.critMax);
    }
  }

  // ---- dynamic effects ----
  const strider = W.buildWick(3, null), crimson = W.buildWick(3, 'crimsonblade'), mist = W.buildWick(3, 'mistphantom');
  assert.equal(W.computeWickFx(strider, { dim: 0, pct: 1, safe: true, dark: true }).dmgPct, 0);
  assert.equal(W.computeWickFx(strider, { dim: 3, pct: 1, safe: false, dark: true }).dmgPct, 18, 'Duskblade grows stronger per Dimming stack');
  assert.ok(W.computeWickFx(crimson, { dim: 0, pct: 1, safe: true, dark: true }).dmgPct > 0, 'Moon Dancer: stronger in light');
  assert.equal(W.computeWickFx(crimson, { dim: 0, pct: 1, safe: false, dark: true }).dmgPct, 0);
  assert.ok(W.computeWickFx(mist, { dim: 0, pct: 1, safe: false, dark: true }).crit > 0, 'Mist Phantom: crit only in the dark');
  assert.equal(W.computeWickFx(mist, { dim: 0, pct: 1, safe: true, dark: true }).crit, 0);
  const mystic = W.buildWick(2, null);
  assert.equal(W.computeWickFx(mystic, { dim: 0, pct: 0.9, safe: true, dark: true }).dmgPct, 12, 'Twin Wick: gold flame');
  assert.equal(W.computeWickFx(mystic, { dim: 0, pct: 0.2, safe: true, dark: true }).manaRegen, 35, 'Twin Wick: blue flame');
  assert.equal(W.computeWickFx(mystic, { dim: 0, pct: 0.5, safe: true, dark: true }).dmgPct, 0);
  assert.ok(Math.abs(W.offsetSpeedMul(0.85, 0.5) - 0.925) < 1e-9);
  assert.equal(W.offsetSpeedMul(0.85, 0), 0.85); assert.equal(W.offsetSpeedMul(1, 0.9), 1);

  // ---- fake game (same shape as flame_logic.cjs) ----
  const mk = (job, sc, over = {}) => {
    const g = {
      state: 'play', field: 3, interior: null, caveRun: null, character: { job },
      settings: { difficulty: 'standard' }, biome: { key: 'meadow' },
      meta: { p: { flame: { v: null }, litLanterns: [], secondClass: sc || null }, save() {} },
      player: { pos: { x: 60, z: 0 }, vel: { x: 0, z: 0 }, hp: 50, mana: 10, iframes: 0, stats: { maxHp: 100, mana: 40 } },
      checkpoints: [{ idx: 0, x: 0, z: 0, unlocked: true, name: 'Lantern' }], campfires: [], exits: [],
      healed: 0, resGain: 0, heal(v) { this.healed += v; this.player.hp = Math.min(100, this.player.hp + v); }, gainClassRes(n) { this.resGain += n; },
      ...over,
    };
    W.refreshWick(g); W.bindWick(g);
    return g;
  };
  const run = (g, sec, step = 0.25) => { for (let t = 0; t < sec; t += step) { F.updateFlame(g, step); W.updateWick(g, step); } };

  // maxBonus feeds flame max; Keeper burns slower than the neutral wick
  let gw = mk(0), gn = mk(0); gn.player.wick = gn.player.flameWick = W.buildWick(99, null).flameWick && W.buildWick(99, null); gn.player.flameWick = W.buildWick(99, null).flameWick;
  assert.equal(F.flameMax(gw), F.FLAME_CFG.max + 25);
  assert.equal(F.getFlame(gw), F.FLAME_CFG.max + 25, 'starts full of the larger lamp');
  run(gw, 40); run(gn, 40);
  const lostK = F.flameMax(gw) - F.getFlame(gw), lostN = F.flameMax(gn) - F.getFlame(gn);
  assert.ok(lostK < lostN, 'Keeper loses less Flame in the dark than a neutral wick');

  // Duskblade burns only 40% in the dark, Frostlight Dreamweaver keeps more than the neutral one
  const gs = mk(3); run(gs, 40);
  assert.ok(F.flameMax(gs) - F.getFlame(gs) < lostN);
  const gf = mk(2, 'frostweaver'), gc = mk(2, 'starcaller'); run(gf, 60); run(gc, 60);
  assert.ok(F.getFlame(gf) > F.getFlame(gc), 'Oath of the Kept Ember outlasts Oath of Burning Out');

  // Ranger: running in the dark feeds the lamp; standing still does not
  const gr = mk(1), gr2 = mk(1);
  gr.meta.p.flame.v = gr2.meta.p.flame.v = 20;
  gr.player.vel.x = 4; run(gr, 20); run(gr2, 20);
  assert.ok(F.getFlame(gr) > F.getFlame(gr2), 'Windlit Wick gains Flame while running in the dark');
  const gsky = mk(1, 'skywarden'); gsky.meta.p.flame.v = 20; gsky.player.vel.x = 4; run(gsky, 20);
  assert.ok(F.getFlame(gsky) > F.getFlame(gr), 'Oath of the Tailwind feeds even more');
  assert.ok(gr.player.wickFx.speedOffset > 0 || gr.flameRt.dim === 0);

  // kill Flame: Starbrand Hunter > neutral ranger > Sky Pathfinder
  const kill = (g) => { g.meta.p.flame.v = 10; F.onKill(g, {}); return F.getFlame(g) - 10; };
  const kHunter = kill(mk(1, 'starhunter')), kRanger = kill(mk(1)), kSky = kill(mk(1, 'skywarden'));
  assert.ok(kHunter > kRanger && kRanger > kSky, `kill flame ${kHunter} > ${kRanger} > ${kSky}`);

  // Lotus: stepping back into light heals and feeds the lotus; Thunderfist heals less
  const gl = mk(4, 'lotussage'); gl.player.pos.x = 60; run(gl, 20);
  assert.ok(gl.flameRt.dim >= 1);
  gl.player.pos.x = 2; gl.player.hp = 10; run(gl, 0.5);
  assert.ok(gl.healed >= 100 * 0.18 - 1e-6, 'Lotus Sage heals 18% on returning to light, got ' + gl.healed);
  assert.equal(gl.resGain, 1, 'and gains a lotus mark');
  const gt = mk(4, 'thunderfist'); gt.player.pos.x = 60; run(gt, 20); gt.player.pos.x = 2; run(gt, 0.5);
  assert.ok(gt.healed < gl.healed && gt.healed > 0);
  const gd = mk(3); gd.player.pos.x = 60; run(gd, 20); gd.player.pos.x = 2; run(gd, 0.5);
  assert.equal(gd.healed, 0, 'Duskblade has no enter-light heal');
  // light regen: Lotus refills faster than Duskblade
  const a = mk(4), b = mk(3); a.meta.p.flame.v = b.meta.p.flame.v = 10; a.player.pos.x = b.player.pos.x = 2; run(a, 3); run(b, 3);
  assert.ok(F.getFlame(a) > F.getFlame(b), 'Lotus Wick refills faster in light');

  // classMech fills
  const gk = mk(0); gk.meta.p.flame.v = 20; const rK = W.wickMechFull(gk);
  assert.equal(rK.flame, 15); assert.equal(F.getFlame(gk), 35);
  const gm = mk(2); gm.meta.p.flame.v = 50; gm.player.mana = 0; const rM = W.wickMechFull(gm);
  assert.ok(rM.spent > 0 && gm.player.mana === 20, 'Twin Wick burns Flame for mana');
  const gm2 = mk(2); gm2.meta.p.flame.v = 3; gm2.player.mana = 0; const rM2 = W.wickMechFull(gm2);
  assert.equal(rM2.spent, 0); assert.equal(gm2.player.mana, 0); assert.equal(F.getFlame(gm2), 3, 'cannot afford the burn: nothing is taken and nothing is given');
  const gtf = mk(4, 'thunderfist'); gtf.meta.p.flame.v = 50; const rT = W.wickMechFull(gtf);
  assert.ok(rT.spent > 0 && rT.heal > 0);

  // no wick on the player (old code path) must not throw
  assert.equal(W.wickMechFull({ player: {} }), null);
  assert.doesNotThrow(() => W.updateWick({ player: {} }, 0.1));

  // ---- save: story choice is optional data, schema stays v3, old saves load ----
  assert.equal(SAVE_SCHEMA_VERSION, 3);
  for (const v of [undefined, 2, 3]) {
    const old = migrateProfile({ schemaVersion: v, secondClass: 'bastion', level: 14 }).profile;
    assert.equal(old.secondClass, 'bastion', 'advanced class survives migration from v' + v);
    assert.equal(old.schemaVersion, 3); assert.equal(old.vow, undefined, 'old saves have no vow and still get the right wick');
    assert.equal(W.buildWick(0, old.secondClass).stanceId, 'bastion');
  }
  const prof = { level: 20, kills: 99, totalElites: 9, coins: 999, shards: 999, deeds: { perfectGather: 5, skyRing: 5, casts: 99, nightExplore: 1 }, visitedFields: [1, 2, 3, 4], bag: [], gemBag: [] };
  const res = A.performAscend(prof, 'mistphantom', 3);
  assert.ok(res.ok, JSON.stringify(res));
  assert.equal(prof.secondClass, 'mistphantom'); assert.equal(prof.vow.sc, 'mistphantom');
  assert.equal(prof.coins, 999 - A.ASCEND_REQ.coins, 'still charged');
  const w2 = W.buildWick(3, prof.secondClass);
  assert.equal(w2.stanceId, 'mistphantom');

  // 6x6 skill puzzle still works for every class
  assert.equal(P.GRID, 6);
  for (const cls of P.CLASSES) {
    assert.ok(typeof P.computeBoard === 'function');
    const board = P.computeBoard(cls.starter, null);
    assert.ok(board, cls.key + ' starter board computes');
  }
  console.log('wick_logic ok');
})().catch(e => { console.error(e); process.exit(1); });
