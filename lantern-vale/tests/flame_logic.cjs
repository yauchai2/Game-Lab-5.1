// Beaconfall Phase 2: Flame / light / Dimming / respawn logic (pure Node, no browser).
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const F = await import(pathToFileURL(path.join(__dirname, '../src/flame.js')));
  const { migrateProfile, SAVE_SCHEMA_VERSION } = await import(pathToFileURL(path.join(__dirname, '../src/save_schema.js')));
  const C = F.FLAME_CFG;

  // ---- config invariants (values are tunable; shape and ordering are not) ----
  assert.ok(C.max > 0 && C.startPct > 0 && C.startPct <= 1);
  assert.ok(C.regen.insideLightPerSec > C.drain.outsideLightPerSec, 'light must out-regen the drain');
  assert.ok(C.radius.starLantern >= C.radius.campfire, 'star lantern radius >= campfire radius');
  assert.ok(C.dimming.maxStacks >= C.dimming.emptyFlameMinStacks);
  assert.ok(C.respawn.flamePct > 0 && C.respawn.flamePct <= 1);
  for (const [k, d] of Object.entries(C.difficulty)) assert.ok(d.maxStacks <= C.dimming.maxStacks, 'difficulty ' + k);
  const perStackFull = C.dimming.perStack;
  assert.ok(1 - perStackFull.speedMul * C.dimming.maxStacks > 0.5, 'max Dimming never makes speed unplayable');
  assert.ok(1 - perStackFull.viewMul * C.dimming.maxStacks > 0.3, 'view never fully closes');

  // ---- fake game ----
  const mk = (over = {}) => ({
    state: 'play', field: 3, interior: null, caveRun: null,
    settings: { difficulty: 'standard' }, biome: { key: 'meadow' },
    meta: { p: { flame: { v: null }, litLanterns: [] }, save() { this.saved = (this.saved || 0) + 1; } },
    player: { pos: { x: 0, z: 0 }, hp: 50, mana: 10, iframes: 0, stats: { maxHp: 100, mana: 40 } },
    checkpoints: [{ idx: 0, x: 0, z: 0, unlocked: true, name: 'Start Lantern' }, { idx: 1, x: 100, z: 0, unlocked: false, name: 'Far Lantern' }],
    campfires: [], exits: [], ...over,
  });
  const run = (g, sec, step = 0.25) => { for (let t = 0; t < sec; t += step) F.updateFlame(g, step); };

  let g = mk();
  assert.equal(F.getFlame(g), C.max * C.startPct, 'starts full');
  assert.equal(F.isDarkZone(g), true);
  assert.equal(F.isSafeAt(g, 5, 0), true, 'inside lit lantern radius');
  assert.equal(F.isSafeAt(g, 100, 0), false, 'unlit lantern gives no light');
  g.checkpoints[1].unlocked = true;
  assert.equal(F.isSafeAt(g, 100, 0), true, 'lighting it creates a safe zone');
  g.checkpoints[1].unlocked = false;

  // inside light: no Dimming, Flame stays full
  run(g, 30);
  assert.equal(g.flameRt.dim, 0); assert.equal(F.getFlame(g), C.max);

  // outside light: grace period, then stacks, then capped
  g.player.pos.x = 60;
  run(g, C.dimming.graceSec - 2);
  assert.equal(g.flameRt.dim, 0, 'no Dimming during grace');
  run(g, 3);
  assert.equal(g.flameRt.dim, 1, 'first stack after grace');
  assert.ok(g.flameRt.fx.speedMul < 1 && g.flameRt.fx.regenMul < 1 && g.flameRt.fx.viewMul < 1);
  run(g, C.dimming.stackEverySec * 5);
  assert.equal(g.flameRt.dim, F.dimmingMaxStacks(g), 'stacks cap at maxStacks');
  assert.ok(F.getFlame(g) < C.max, 'Flame drains outside the light');
  assert.equal(g.variantSeen, undefined);
  assert.equal(g.flameRt.variant.id, 'sporefog', 'marsh uses its own Dimming variant');

  // back into the light: Dimming decays, Flame refills, autosave fires, HP/mana trickle
  const savedBefore = g.meta.saved || 0, hp0 = g.player.hp;
  g.player.pos.x = 3;
  run(g, C.dimming.decayInsideEverySec * (C.dimming.maxStacks + 1));
  assert.equal(g.flameRt.dim, 0, 'Dimming decays inside the light');
  assert.ok(g.meta.saved > savedBefore, 'entering light autosaves');
  assert.ok(g.player.hp > hp0, 'light restores a little HP');
  run(g, 60); assert.equal(F.getFlame(g), C.max);

  // empty Flame forces a minimum Dimming floor outside the light
  g = mk(); g.player.pos.x = 80; F.spendFlame(g, 9999, 'test');
  assert.equal(F.getFlame(g), 0);
  run(g, 1);
  assert.ok(g.flameRt.dim >= Math.min(C.dimming.emptyFlameMinStacks, F.dimmingMaxStacks(g)), 'empty Flame floors Dimming');

  // cozy difficulty: gentler
  g = mk({ settings: { difficulty: 'cozy' } }); g.player.pos.x = 80; run(g, 200);
  assert.equal(g.flameRt.dim, C.difficulty.cozy.maxStacks);

  // towns / harbor / dungeon / interior are always lit
  g = mk({ field: 0 }); g.player.pos.x = 999; F.spendFlame(g, 50, 't'); run(g, 5);
  assert.equal(g.flameRt.dim, 0); assert.ok(F.getFlame(g) > 50, 'Flame refills in town');
  assert.equal(F.isSafeAt(g, 999, 0), true);
  g = mk({ interior: {} }); assert.equal(F.isDarkZone(g), false);

  // campfire and gate are light sources with their own radius
  g = mk(); g.player.pos.x = 50; g.campfires.push({ x: 50, z: 0 });
  assert.equal(F.isSafeAt(g, 50 + C.radius.campfire - 0.5, 0), true);
  assert.equal(F.isSafeAt(g, 50 + C.radius.campfire + 1, 0), false);
  g.exits.push({ type: 'town', x: -50, z: 0 }); assert.equal(F.isSafeAt(g, -50 + 2, 0), true);

  // gain / spend / events / class wick extension point
  g = mk(); const seen = []; const off = F.onFlame('spend', e => seen.push(e.reason));
  F.spendFlame(g, 30, 'unit'); assert.equal(F.getFlame(g), C.max - 30); assert.deepEqual(seen, ['unit']);
  off(); F.spendFlame(g, 1, 'unit'); assert.equal(seen.length, 1, 'unsubscribe works');
  F.onBasicHit(g); F.onKill(g, { type: 'slime' }); F.onKill(g, { elite: true }); F.onKill(g, { type: 'stag' });
  assert.ok(F.getFlame(g) > C.max - 31);
  g.player.flameWick = { gainMul: 2, costMul: 0.5, maxBonus: 20 };
  assert.equal(F.flameMax(g), C.max + 20);
  const before = F.getFlame(g); F.addFlame(g, 1, 'wick'); assert.ok(Math.abs(F.getFlame(g) - before - 2) < 1e-6 || F.getFlame(g) === F.flameMax(g));
  g.player.flameWick = null;
  g = mk(); assert.equal(F.onUltimate(g), true); assert.equal(F.getFlame(g), C.max - C.cost.ultimate);
  const hit = F.onPlayerHurt(g, 10); assert.ok(hit > 0 && hit <= C.max * C.cost.hollowHitPct + 1e-6);
  assert.equal(F.onPlayerHurt(g, 0), 0);

  // respawn point = nearest LIT lantern in this field, else null (town fallback)
  g = mk(); g.player.pos.x = 90; g.checkpoints[1].unlocked = false;
  assert.equal(F.findRespawn(g).idx, 0, 'unlit lanterns are never respawn points');
  g.checkpoints[1].unlocked = true; assert.equal(F.findRespawn(g).idx, 1, 'nearest lit lantern wins');
  g.checkpoints.forEach(c => { c.unlocked = false; }); assert.equal(F.findRespawn(g), null);
  g.field = 0; g.checkpoints[0].unlocked = true; assert.equal(F.findRespawn(g), null, 'no lantern respawn outside fields');
  g = mk(); F.spendFlame(g, 95, 't'); g.flameRt = undefined; F.updateFlame(g, 0.1); g.flameRt.dim = 3;
  F.applyRespawnState(g);
  assert.equal(g.player.hp, g.player.stats.maxHp); assert.equal(g.flameRt.dim, 0); assert.ok(F.getFlame(g) >= C.max * C.respawn.flamePct - 1e-6); assert.ok(g.player.iframes >= C.respawn.iframes);

  // lit lanterns are recorded once
  g = mk(); assert.equal(F.markLanternLit(g, 3, 0), true); assert.equal(F.markLanternLit(g, 3, 0), false); assert.deepEqual(g.meta.p.litLanterns, ['3:0']);

  // ---- schema v3 ----
  assert.equal(SAVE_SCHEMA_VERSION, 3);
  const v1 = { level: 9, shards: 5, unlockedCps: { 1: [0, 2], 3: [0] } };
  const m1 = migrateProfile(v1);
  assert.equal(m1.from, 1); assert.equal(m1.profile.schemaVersion, 3);
  assert.deepEqual(m1.profile.flame, { v: null }); assert.deepEqual(m1.profile.litLanterns.sort(), ['1:0', '1:2', '3:0']);
  assert.equal(m1.profile.level, 9); assert.equal(m1.profile.shards, 5);
  const v2 = { schemaVersion: 2, level: 4, flame: null, litLanterns: ['2:0'], unlockedCps: { 2: [0, 1] }, loreFragments: ['a'] };
  const m2 = migrateProfile(v2);
  assert.equal(m2.from, 2); assert.deepEqual(m2.profile.flame, { v: null });
  assert.deepEqual(m2.profile.litLanterns.sort(), ['2:0', '2:1']); assert.deepEqual(m2.profile.loreFragments, ['a']);
  assert.equal(migrateProfile(m2.profile).migrated, false, 'idempotent');
  const g2 = mk(); g2.meta.p = { ...m2.profile }; assert.equal(F.getFlame(g2), C.max, 'migrated null Flame starts full');
  // existing Flame value survives
  const g3 = mk(); g3.meta.p.flame = { v: 33 }; assert.equal(F.getFlame(g3), 33);

  // storage keys untouched
  assert.ok(fs.readFileSync(path.join(__dirname, '../src/account.js'), 'utf8').includes("'lv_profile'"));
  console.log('flame_logic: ok');
})().catch(e => { console.error(e); process.exit(1); });
