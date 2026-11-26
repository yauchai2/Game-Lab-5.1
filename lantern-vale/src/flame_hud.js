// Beaconfall Flame HUD: the Flame bar in the player card, the Dimming pill and the dark veil.
// DOM only; all numbers come from flameSnapshot() in src/flame.js.
import { flameSnapshot } from './flame.js';

const $ = id => document.getElementById(id);

export function flameHudHtmlPill(snap) {
  if (!snap.dark || snap.dim <= 0) return '';
  const v = snap.variant;
  return `<span class="st-pill st-dim" style="--dim-c:${v.color}">${v.icon} ${v.name} ×${snap.dim}</span>`;
}

export function updateFlameHud(g) {
  if (typeof document === 'undefined') return null;
  const s = flameSnapshot(g);
  const fill = $('pcFlameFill'), num = $('pcFlameNum'), row = $('pcFlameWrap'), veil = $('dimVeil');
  if (fill) {
    fill.style.width = `${(s.pct * 100).toFixed(1)}%`;
    fill.classList.toggle('low', s.pct < 0.25);
  }
  if (num) { const t = `${Math.ceil(s.value)}/${s.max}`; if (num._v !== t) { num.textContent = t; num._v = t; } }
  if (row) {
    row.classList.toggle('in-light', s.dark && s.safe);
    row.classList.toggle('dimmed', s.dim > 0);
    row.classList.toggle('empty', s.value <= 0);
  }
  if (veil) {
    // viewMul < 1 shrinks the clear centre of the vignette; veil colour comes from the zone variant
    const a = s.dim > 0 ? Math.min(0.78, 0.18 + s.dim * 0.17) : 0;
    const inner = Math.round(s.fx.viewMul * 78);
    veil.style.setProperty('--veil-a', a.toFixed(2));
    veil.style.setProperty('--veil-in', inner + '%');
    veil.style.setProperty('--veil-rgb', s.variant.veil || '6,8,20');
    veil.classList.toggle('on', a > 0);
  }
  return s;
}
