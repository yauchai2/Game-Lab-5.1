// Beaconfall Flame — the lamp as a real mechanic (Phase 2).
//
// Pure game logic, no DOM and no THREE, so it runs unchanged under Node tests.
// All tuning lives in data/flame.json. See docs/beaconfall/FLAME.md for the public API.
//
//   Flame      lamp resource, alongside HP and mana (it never replaces mana).
//   Light      lit star lanterns, campfires and field gates are safe zones with a radius.
//   Dimming    stacking debuff outside the light (slower, weaker regen, narrower view).
//   Respawn    death in a field returns the player to the nearest lit star lantern.
//
// State that is saved:    meta.p.flame = { v }   and   meta.p.litLanterns = ['<field>:<idx>', ...]
// State that is runtime:  g.flameRt   (dimming stacks, timers, current modifiers)
import CFG from '../data/flame.json' with { type: 'json' };

export const FLAME_CFG = CFG;

// ---------- events (Phase 4 class wicks subscribe here) ----------
const listeners = new Map();
/** Subscribe to 'gain' | 'spend' | 'empty' | 'dim' | 'enterLight' | 'leaveLight' | 'respawn'. Returns an unsubscribe fn. */
export function onFlame(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}
function emit(event, payload) {
  for (const fn of listeners.get(event) || []) { try { fn(payload); } catch (e) { /* a listener must never break the game loop */ } }
}

// ---------- helpers ----------
const clamp01 = x => Math.max(0, Math.min(1, x));
const mods = g => g?.player?.flameWick || null;           // Phase 4 extension point (see FLAME.md)

export function difficultyCfg(g) {
  return CFG.difficulty[g?.settings?.difficulty] || CFG.difficulty.standard;
}
export function flameMax(g) {
  return Math.max(1, Math.round(CFG.max + (mods(g)?.maxBonus || 0)));
}
/** Saved Flame record; created lazily so old profiles keep working. */
export function flameRecord(g) {
  const p = g.meta.p;
  if (!p.flame || typeof p.flame !== 'object') p.flame = { v: null };
  if (!Number.isFinite(p.flame.v)) p.flame.v = Math.round(flameMax(g) * CFG.startPct);
  return p.flame;
}
export function getFlame(g) { return flameRecord(g).v; }
function runtime(g) {
  if (!g.flameRt) g.flameRt = { dim: 0, outT: 0, stackT: 0, decayT: 0, wasSafe: true, saveGuard: 0, fx: neutralFx(), variant: CFG.variants.default };
  return g.flameRt;
}
export function neutralFx() { return { speedMul: 1, regenMul: 1, viewMul: 1 }; }

// ---------- zones & variants ----------
/** Darkness only exists in open fields. Towns, harbor, dungeons, towers, interiors and cave runs are always lit. */
export function isDarkZone(g) {
  return !!(g.field > 0 && !g.interior && !g.caveRun && g.state !== 'title');
}
export function variantFor(fieldId, biomeKey) {
  const v = CFG.variants;
  return v.byField[String(fieldId)] || v.byBiome[biomeKey] || v.default;
}

// ---------- light sources ----------
/** All currently active light sources: [{ kind, id, x, z, r, name }]. */
export function lightSources(g) {
  const out = [];
  for (const cp of g.checkpoints || []) {
    if (cp.unlocked) out.push({ kind: 'lantern', id: `${g.field}:${cp.idx}`, x: cp.x, z: cp.z, r: CFG.radius.starLantern, name: cp.name });
  }
  for (const cf of g.campfires || []) out.push({ kind: 'campfire', id: `cf:${cf.x.toFixed(1)},${cf.z.toFixed(1)}`, x: cf.x, z: cf.z, r: CFG.radius.campfire, name: 'Campfire' });
  for (const ex of g.exits || []) {
    if (ex.type === 'town' || ex.type === 'prevField') out.push({ kind: 'gate', id: `gate:${ex.type}`, x: ex.x, z: ex.z, r: CFG.radius.gate, name: 'Gate' });
  }
  return out;
}
/** Innermost-nearest light covering (x, z), or null. Returns { src, dist }. */
export function lightAt(g, x, z) {
  let best = null;
  for (const s of lightSources(g)) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d <= s.r && (!best || d / s.r < best.dist / best.src.r)) best = { src: s, dist: d };
  }
  return best;
}
export function isSafeAt(g, x, z) { return !isDarkZone(g) || !!lightAt(g, x, z); }

// ---------- lit star lanterns (respawn points) ----------
export function lanternId(field, idx) { return `${field}:${idx}`; }
/** Records a lantern as lit in the profile. Returns true if it was newly lit. */
export function markLanternLit(g, field, idx) {
  const p = g.meta.p;
  if (!Array.isArray(p.litLanterns)) p.litLanterns = [];
  const id = lanternId(field, idx);
  if (p.litLanterns.includes(id)) return false;
  p.litLanterns.push(id);
  return true;
}
/** Nearest lit star lantern in the current field, or null (then death falls back to town). */
export function findRespawn(g, from = g.player?.pos) {
  if (!(g.field > 0) || !from) return null;
  let best = null;
  for (const cp of g.checkpoints || []) {
    if (!cp.unlocked) continue;
    const d = Math.hypot(cp.x - from.x, cp.z - from.z);
    if (!best || d < best.dist) best = { id: lanternId(g.field, cp.idx), idx: cp.idx, x: cp.x, z: cp.z, name: cp.name, dist: d };
  }
  return best;
}

// ---------- resource ----------
function wickGain(g) { return mods(g)?.gainMul ?? 1; }
function wickCost(g) { return mods(g)?.costMul ?? 1; }
/** Add Flame (after the class wick gain multiplier). Returns the amount actually gained. */
export function addFlame(g, n, reason = 'misc') {
  const rec = flameRecord(g), max = flameMax(g);
  const want = n * wickGain(g);
  const before = rec.v;
  rec.v = Math.max(0, Math.min(max, rec.v + want));
  const gained = rec.v - before;
  if (gained > 0.0001) emit('gain', { amount: gained, reason, value: rec.v, max });
  return gained;
}
/** Spend up to n Flame (after the class wick cost multiplier). Returns the amount actually spent. */
export function spendFlame(g, n, reason = 'misc') {
  const rec = flameRecord(g);
  const want = n * wickCost(g);
  const spent = Math.min(rec.v, want);
  rec.v -= spent;
  if (spent > 0.0001) emit('spend', { amount: spent, reason, value: rec.v, max: flameMax(g) });
  if (rec.v <= 0.0001 && spent > 0) { rec.v = 0; emit('empty', { reason }); }
  return spent;
}
export function canSpend(g, n) { return getFlame(g) >= n * wickCost(g) - 1e-6; }

// ---------- combat hooks (called from game.js) ----------
export function onBasicHit(g, kind = 'melee') { return addFlame(g, kind === 'bow' ? CFG.gain.bowShot : CFG.gain.basicHit, 'basicHit'); }
export function onKill(g, enemy) {
  const n = enemy?.type === 'stag' || enemy?.isWorldBoss || enemy?.isTideBoss ? CFG.gain.bossKill : enemy?.elite ? CFG.gain.eliteKill : CFG.gain.kill;
  return addFlame(g, n, 'kill');
}
/** Returns false (and spends nothing) only when ultimateGate is on and Flame is short. */
export function onUltimate(g) {
  const c = CFG.cost.ultimate;
  if (CFG.cost.ultimateGate && !canSpend(g, c)) return false;
  spendFlame(g, c, 'ultimate');
  return true;
}
export function onPlayerHurt(g, dmg) {
  if (!(dmg > 0)) return 0;
  return spendFlame(g, flameMax(g) * CFG.cost.hollowHitPct, 'hollowHit');
}

// ---------- per-frame update ----------
/** Current effective numbers for the player's Dimming (also exposed to HUD / tests). */
export function dimmingFx(g, dim, variant) {
  const per = { ...CFG.dimming.perStack, ...(variant?.perStack || {}) };
  return {
    speedMul: Math.max(0.5, 1 - per.speedMul * dim),
    regenMul: Math.max(0, 1 - per.regenMul * dim),
    viewMul: Math.max(0.3, 1 - per.viewMul * dim),
  };
}
export function dimmingMaxStacks(g) {
  return Math.max(0, Math.min(CFG.dimming.maxStacks, difficultyCfg(g).maxStacks ?? CFG.dimming.maxStacks));
}

/** Advance the lamp by dt seconds. Call once per frame while state === 'play'. */
export function updateFlame(g, dt) {
  const p = g.player; if (!p) return;
  const rt = runtime(g), rec = flameRecord(g), max = flameMax(g);
  rec.v = Math.min(rec.v, max);

  if (!isDarkZone(g)) {
    rec.v = Math.min(max, rec.v + CFG.regen.townPerSec * dt);
    if (rt.dim) emit('dim', { from: rt.dim, to: 0, variant: rt.variant });
    rt.dim = 0; rt.outT = rt.stackT = rt.decayT = 0; rt.wasSafe = true; rt.fx = neutralFx(); rt.zone = null;
    return;
  }

  rt.variant = variantFor(g.field, g.biome?.key);
  const lit = lightAt(g, p.pos.x, p.pos.z);
  rt.zone = lit ? lit.src : null;
  const maxStacks = dimmingMaxStacks(g);

  if (lit) {
    rec.v = Math.min(max, rec.v + CFG.regen.insideLightPerSec * dt);
    rt.outT = rt.stackT = 0;
    if (rt.dim > 0) {
      rt.decayT += dt;
      if (rt.decayT >= CFG.dimming.decayInsideEverySec) { rt.decayT = 0; const from = rt.dim; rt.dim--; emit('dim', { from, to: rt.dim, variant: rt.variant }); }
    }
    if (!rt.wasSafe) {
      rt.wasSafe = true;
      emit('enterLight', { src: lit.src });
      if (CFG.safe.autosave && g.meta?.save) g.meta.save();      // safe zones are save points
    }
    // light restores a little HP / mana
    if (g.state === 'play') {
      if (p.hp < p.stats.maxHp) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * CFG.safe.hpPctPerSec * dt);
      if (p.mana < p.stats.mana) p.mana = Math.min(p.stats.mana, p.mana + CFG.safe.manaPerSec * dt);
    }
  } else {
    if (rt.wasSafe) { rt.wasSafe = false; emit('leaveLight', {}); }
    rt.decayT = 0;
    const drain = CFG.drain.outsideLightPerSec * (difficultyCfg(g).drainMul ?? 1) * (rt.variant.drainMul ?? 1) * (mods(g)?.drainMul ?? 1);
    if (rec.v > 0) { rec.v = Math.max(0, rec.v - drain * dt); if (rec.v <= 0) emit('empty', { reason: 'drain' }); }
    rt.outT += dt;
    if (rt.outT >= CFG.dimming.graceSec && rt.dim === 0 && maxStacks > 0) { rt.dim = 1; rt.stackT = 0; emit('dim', { from: 0, to: 1, variant: rt.variant }); }
    else if (rt.dim > 0 && rt.dim < maxStacks) {
      rt.stackT += dt;
      if (rt.stackT >= CFG.dimming.stackEverySec) { rt.stackT = 0; const from = rt.dim; rt.dim++; emit('dim', { from, to: rt.dim, variant: rt.variant }); }
    }
    if (rec.v <= 0 && rt.dim < Math.min(CFG.dimming.emptyFlameMinStacks, maxStacks)) {
      const from = rt.dim; rt.dim = Math.min(CFG.dimming.emptyFlameMinStacks, maxStacks); emit('dim', { from, to: rt.dim, variant: rt.variant });
    }
  }
  rt.fx = dimmingFx(g, rt.dim, rt.variant);
}

// ---------- respawn ----------
/** Applies the numeric side of a lantern respawn (position and scene work stay in game.js). */
export function applyRespawnState(g) {
  const p = g.player, R = CFG.respawn, rt = runtime(g);
  p.hp = Math.max(1, Math.round(p.stats.maxHp * R.hpPct));
  p.mana = Math.round(p.stats.mana * R.manaPct);
  p.iframes = Math.max(p.iframes || 0, R.iframes);
  const rec = flameRecord(g);
  rec.v = Math.max(rec.v, Math.round(flameMax(g) * R.flamePct));
  rt.dim = 0; rt.outT = rt.stackT = rt.decayT = 0; rt.fx = neutralFx();
  emit('respawn', { flame: rec.v });
}

// ---------- snapshot for HUD / tests / Phase 4 ----------
export function flameSnapshot(g) {
  const rec = flameRecord(g), rt = runtime(g), max = flameMax(g);
  return {
    value: rec.v, max, pct: clamp01(rec.v / max),
    dim: rt.dim, maxDim: dimmingMaxStacks(g),
    variant: rt.variant, fx: rt.fx,
    safe: !isDarkZone(g) || !!rt.zone, zone: rt.zone, dark: isDarkZone(g),
  };
}
