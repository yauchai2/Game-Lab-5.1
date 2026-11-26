// Beaconfall class wicks and advancement stances (Phase 4).
//
// Pure game logic, no DOM and no THREE, so it runs unchanged under Node tests.
// All numbers and story text live in data/wicks.json. See docs/beaconfall/WICKS.md.
//
//   Class wick  how a class lights the lamp (5 classes). Built from CLASSES[job] and data/wicks.json.
//   Stance      the story choice made at the awakening altar (10 advanced classes). It is merged onto
//               the class wick, so the choice changes how the lamp behaves, not just a stat line.
//
// Output: player.wick (merged data), player.flameWick (the part flame.js reads) and
// player.wickFx (per-frame dynamic bonuses: dmgPct, crit, armor, manaRegen, speedOffset).
import CFG from '../data/wicks.json' with { type: 'json' };
import { addFlame, spendFlame, canSpend, onFlame, flameSnapshot, isDarkZone, lightAt } from './flame.js';

export const WICK_CFG = CFG;

const MUL_KEYS = ['gainMul', 'costMul', 'drainMul', 'lightRegenMul', 'killGainMul'];
const ADD_KEYS = ['maxBonus'];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------- lookup ----------
export function classWickByJob(job) {
  return Object.entries(CFG.classes).map(([key, w]) => ({ key, ...w })).find(w => w.job === job) || null;
}
export function stanceById(id) {
  const s = id ? CFG.stances[id] : null;
  return s ? { id, ...s } : null;
}
export function stancesForJob(job) {
  const cw = classWickByJob(job);
  return Object.entries(CFG.stances).filter(([, s]) => cw && s.pair === cw.key).map(([id, s]) => ({ id, ...s }));
}

// ---------- merge ----------
function neutralWick() {
  return {
    flameWick: { gainMul: 1, costMul: 1, drainMul: 1, lightRegenMul: 1, killGainMul: 1, maxBonus: 0 },
    perDim: { dmgPct: 0, crit: 0, armor: 0, speedOffset: 0 },
    tiers: [], moveGainPerSec: 0,
    onEnterLight: { healPct: 0, flame: 0, classRes: 0 },
    onMechFull: { flame: 0, spend: 0, mana: 0, healPct: 0 },
  };
}
function mergeInto(out, src) {
  if (!src) return out;
  for (const k of MUL_KEYS) if (src.flameWick?.[k] != null) out.flameWick[k] *= src.flameWick[k];
  for (const k of ADD_KEYS) if (src.flameWick?.[k] != null) out.flameWick[k] += src.flameWick[k];
  for (const [k, v] of Object.entries(src.perDim || {})) out.perDim[k] = (out.perDim[k] || 0) + v;
  for (const t of src.tiers || []) out.tiers.push({ ...t });
  out.moveGainPerSec += src.moveGainPerSec || 0;
  for (const [k, v] of Object.entries(src.onEnterLight || {})) out.onEnterLight[k] = (out.onEnterLight[k] || 0) + v;
  for (const [k, v] of Object.entries(src.onMechFull || {})) out.onMechFull[k] = (out.onMechFull[k] || 0) + v;
  return out;
}
/** Class wick plus (optional) stance for a job and advanced class id. Never throws on unknown ids. */
export function buildWick(job, scId) {
  const cw = classWickByJob(job), st = stanceById(scId);
  const w = neutralWick();
  mergeInto(w, cw);
  // a stance only applies to the class it belongs to (guards against hand-edited saves)
  if (st && cw && st.pair === cw.key) mergeInto(w, st.mods);
  w.onEnterLight.healPct = clamp(w.onEnterLight.healPct, 0, CFG.limits.healPctMax);
  w.onMechFull.healPct = clamp(w.onMechFull.healPct, 0, CFG.limits.healPctMax);
  for (const k of MUL_KEYS) w.flameWick[k] = clamp(w.flameWick[k], 0.2, 3);
  w.id = cw ? cw.id : 'none';
  w.classKey = cw?.key || null;
  w.stanceId = st && cw && st.pair === cw.key ? st.id : null;
  return w;
}

/** Sets player.wick / player.flameWick from the class and advanced class. Call from recalc(). */
export function refreshWick(g) {
  const p = g.player; if (!p) return null;
  const w = buildWick(g.character?.job ?? 0, g.meta?.p?.secondClass || null);
  p.wick = w; p.flameWick = w.flameWick;
  if (!p.wickFx) p.wickFx = neutralFx();
  return w;
}

// ---------- dynamic effects ----------
export function neutralFx() { return { dmgPct: 0, crit: 0, armor: 0, manaRegen: 0, speedOffset: 0 }; }
function tierActive(t, snap) {
  const inLight = snap.safe, inDark = snap.dark && !snap.safe;
  switch (t.when) {
    case 'flameAbove': return snap.pct >= (t.at ?? 0);
    case 'flameBelow': return snap.pct <= (t.at ?? 1);
    case 'inLight': return inLight;
    case 'inDark': return inDark;
    default: return false;
  }
}
/** Pure: dynamic bonuses from a wick and a flame snapshot. */
export function computeWickFx(wick, snap) {
  const fx = neutralFx();
  if (!wick || !snap) return fx;
  const dim = snap.dim || 0, L = CFG.limits;
  for (const k of Object.keys(fx)) fx[k] += (wick.perDim[k] || 0) * dim;
  for (const t of wick.tiers) if (tierActive(t, snap)) for (const k of Object.keys(fx)) fx[k] += t[k] || 0;
  fx.dmgPct = clamp(fx.dmgPct, L.dmgPctMin, L.dmgPctMax);
  fx.crit = clamp(fx.crit, 0, L.critMax);
  fx.armor = clamp(fx.armor, -L.armorMax, L.armorMax);
  fx.manaRegen = clamp(fx.manaRegen, 0, 200);
  fx.speedOffset = clamp(fx.speedOffset, 0, L.speedOffsetMax);
  return fx;
}
/** Per frame, after updateFlame(). */
export function updateWick(g, dt) {
  const p = g.player; if (!p) return;
  const wick = p.wick; if (!wick) return;
  const snap = flameSnapshot(g);
  p.wickFx = computeWickFx(wick, snap);
  // Windlit-style wicks: running in the dark keeps the flame alive
  if (wick.moveGainPerSec > 0 && isDarkZone(g) && !lightAt(g, p.pos.x, p.pos.z)) {
    const sp = Math.hypot(p.vel?.x || 0, p.vel?.z || 0);
    if (sp > 0.5) addFlame(g, wick.moveGainPerSec * dt, 'wind');
  }
}
/** Applies a wick speedOffset to a Dimming speed multiplier (1 = no slow). */
export function offsetSpeedMul(speedMul, offset) {
  return 1 - (1 - speedMul) * (1 - (offset || 0));
}

// ---------- events ----------
let current = null, bound = false;
/** Registers the lamp event handlers once; the latest game wins. */
export function bindWick(g) {
  current = g;
  if (bound) return;
  bound = true;
  onFlame('enterLight', () => { if (current) wickEnterLight(current); });
}
export function wickEnterLight(g) {
  const w = g.player?.wick; if (!w || g.state !== 'play') return null;
  const e = w.onEnterLight, p = g.player, out = { heal: 0, flame: 0, classRes: 0 };
  if (e.healPct > 0 && g.heal) { g.heal(p.stats.maxHp * e.healPct, true); out.heal = e.healPct; }
  if (e.flame > 0) out.flame = addFlame(g, e.flame, 'wick');
  if (e.classRes > 0 && g.gainClassRes) { g.gainClassRes(e.classRes); out.classRes = e.classRes; }
  return out;
}
/** Called when the class mechanic (classMech) fills. Returns what was applied. */
export function wickMechFull(g) {
  const w = g.player?.wick; if (!w) return null;
  const m = w.onMechFull, p = g.player, out = { flame: 0, spent: 0, mana: 0, heal: 0 };
  if (m.flame > 0) out.flame = addFlame(g, m.flame, 'wick');
  if (m.spend > 0) {
    if (!canSpend(g, m.spend)) return out;                 // not enough lamp oil: the burn (and its reward) is skipped
    out.spent = spendFlame(g, m.spend, 'wickBurn');
  }
  if (m.mana > 0 && (m.spend <= 0 || out.spent > 0)) { p.mana = Math.min(p.stats.mana, p.mana + m.mana); out.mana = m.mana; }
  if (m.healPct > 0 && (m.spend <= 0 || out.spent > 0) && g.heal) { g.heal(p.stats.maxHp * m.healPct, true); out.heal = m.healPct; }
  return out;
}

// ---------- text for UI ----------
export function wickSummary(job, scId) {
  const cw = classWickByJob(job), st = stanceById(scId);
  return { class: cw, stance: st && cw && st.pair === cw.key ? st : null };
}
