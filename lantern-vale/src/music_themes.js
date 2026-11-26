// Beaconfall music direction (data + pure logic, no WebAudio, Node-testable).
// Direction doc: docs/beaconfall/AUDIO.md. Everything is synthesized by audio.js, so no licensed audio.
//
// A theme is a small recipe the procedural sequencer reads:
//   root/steps   MIDI root + scale (semitone offsets)         bpm       tempo (eighth-note grid)
//   wave         pad/bass colour ('sawtooth' => square lead)  lead      lead oscillator override
//   prog         scale-degree root per bar (loops)            pat       lead pattern (scale-degree offsets)
//   density      0..1 chance a lead slot sounds               leadOct   octave offset of the lead
//   perc         'none' | 'light' | 'wood' | 'hand' | 'taiko' | 'pulse'
//   drone        {oct, vol} constant low pedal                choir     slow detuned swell pad (Elderwood)
//   bell         ring long, delayed bells instead of plucks     wind   true => filtered noise bed under the music
//   pluck, bubbles, heartbeat, war  extra colour switches (see audio.js playStep)
//   motif        optional fixed melody: [{bar, at, deg, len, oct}] over `motifBars` bars (title theme)

const T = (o) => Object.freeze(o);

export const THEMES = {
  // ---- regions (Phase 3 zones) ----
  meadow:      T({ label: 'Dawnmeadow',     root: 57, steps: [0, 2, 4, 7, 9],     bpm: 100, wave: 'triangle', prog: [0, 3, 4, 2, 0, 4, 3, 1], pat: [0, 2, 1, 3, 2, 4, 3, 2], density: 0.85, leadOct: 1, perc: 'light' }),
  autumn:      T({ label: 'Whisperwood',    root: 55, steps: [0, 2, 3, 7, 9],     bpm: 84,  wave: 'triangle', lead: 'sine', prog: [0, 2, 3, 1, 0, 3, 2, 4], pat: [0, 2, 1, 4, 3, 1, 2, 0], density: 0.6, leadOct: 1, perc: 'wood', wind: true }),
  mirefog:     T({ label: 'Mirefog Marsh',  root: 45, steps: [0, 3, 5, 6, 10],    bpm: 66,  wave: 'sine', lead: 'triangle', prog: [0, 0, 3, 2, 0, 0, 4, 1], pat: [0, 3, 2, 0, 4, 1, 2, 3], density: 0.38, leadOct: 0, perc: 'none', drone: { oct: -2, vol: 0.09 }, bubbles: true }),
  snow:        T({ label: 'Rimewind Tundra', root: 62, steps: [0, 2, 4, 7, 9],    bpm: 62,  wave: 'sine', prog: [0, 4, 2, 3, 0, 3, 4, 1], pat: [4, 2, 3, 0, 4, 1, 3, 2], density: 0.4, leadOct: 2, perc: 'none', bell: true, wind: true }),
  ember:       T({ label: 'Cinderreach',    root: 40, steps: [0, 1, 4, 7, 8],     bpm: 108, wave: 'sawtooth', prog: [0, 0, 1, 0, 0, 3, 2, 1], pat: [0, 0, 2, 0, 3, 2, 0, 4], density: 0.8, leadOct: 1, perc: 'taiko', drone: { oct: -2, vol: 0.07 } }),
  elderwood:   T({ label: 'Elderwood',      root: 50, steps: [0, 2, 3, 7, 10],    bpm: 56,  wave: 'sine', lead: 'sine', prog: [0, 3, 2, 4, 0, 4, 2, 1], pat: [0, 1, 2, 1, 3, 2, 1, 0], density: 0.3, leadOct: 1, perc: 'none', choir: true, drone: { oct: -2, vol: 0.08 } }),
  // ---- biome fallbacks for the other 14 outer islands ----
  desert:      T({ label: 'Sandveil',       root: 50, steps: [0, 1, 4, 5, 7],     bpm: 92,  wave: 'triangle', lead: 'square', prog: [0, 0, 1, 0, 3, 2, 1, 0], pat: [0, 1, 2, 1, 3, 2, 4, 2], density: 0.65, leadOct: 1, perc: 'hand' }),
  jungle:      T({ label: 'Lost Vines',     root: 52, steps: [0, 2, 3, 7, 8],     bpm: 112, wave: 'triangle', prog: [0, 2, 3, 2, 0, 4, 3, 1], pat: [0, 2, 4, 2, 1, 3, 2, 0], density: 0.8, leadOct: 1, perc: 'hand', pluck: true }),
  gothic:      T({ label: 'Grave Gloom',    root: 47, steps: [0, 2, 3, 5, 7, 8],  bpm: 60,  wave: 'sine', lead: 'square', prog: [0, 5, 3, 4, 0, 5, 2, 4], pat: [0, 2, 1, 3, 2, 0, 4, 1], density: 0.35, leadOct: 1, perc: 'none', drone: { oct: -2, vol: 0.1 } }),
  deep_sea:    T({ label: 'Deep Murk',      root: 53, steps: [0, 2, 4, 7, 11],    bpm: 56,  wave: 'sine', prog: [0, 2, 4, 1, 0, 3, 4, 2], pat: [0, 3, 1, 4, 2, 3, 0, 2], density: 0.4, leadOct: 1, perc: 'none', bell: true, drone: { oct: -2, vol: 0.07 } }),
  scifi:       T({ label: 'Blackout',       root: 57, steps: [0, 2, 4, 7, 9],     bpm: 118, wave: 'square', prog: [0, 3, 0, 4, 2, 3, 4, 1], pat: [0, 1, 2, 3, 4, 3, 2, 1], density: 0.95, leadOct: 1, perc: 'pulse' }),
  alien:       T({ label: 'Hive Dark',      root: 51, steps: [0, 2, 4, 6, 8, 10], bpm: 76,  wave: 'sawtooth', lead: 'sine', prog: [0, 2, 4, 1, 3, 5, 2, 0], pat: [0, 2, 4, 3, 1, 5, 2, 4], density: 0.5, leadOct: 1, perc: 'pulse', drone: { oct: -2, vol: 0.06 } }),
  // ---- places ----
  town:        T({ label: 'Emberhearth',    root: 60, steps: [0, 2, 4, 7, 9],     bpm: 98,  wave: 'triangle', prog: [0, 3, 4, 2, 0, 4, 3, 1], pat: [0, 2, 1, 3, 2, 4, 3, 2], density: 0.85, leadOct: 1, perc: 'light' }),
  night:       T({ label: 'Night',          root: 57, steps: [0, 2, 4, 7, 9],     bpm: 64,  wave: 'sine', prog: [0, 3, 4, 2, 0, 4, 3, 1], pat: [0, 2, 1, 3, 2, 4, 3, 2], density: 0.45, leadOct: 1, perc: 'none' }),
  interior:    T({ label: 'Indoors',        root: 62, steps: [0, 2, 4, 7, 9],     bpm: 80,  wave: 'triangle', prog: [0, 3, 4, 2, 0, 4, 3, 1], pat: [0, 2, 1, 3, 2, 4, 3, 2], density: 0.6, leadOct: 1, perc: 'none' }),
  boss:        T({ label: 'Boss',           root: 50, steps: [0, 3, 5, 6, 7, 10], bpm: 128, wave: 'sawtooth', prog: [0, 3, 4, 2, 0, 4, 3, 1], pat: [0, 2, 1, 3, 2, 4, 3, 2], density: 1, leadOct: 1, perc: 'taiko' }),
  // Phase 8 hook: The Fallen Beacon / Relight Event. Unused until the endgame lands, but tested.
  finale:      T({ label: 'The Fallen Beacon', root: 43, steps: [0, 3, 5, 6, 7, 10], bpm: 134, wave: 'sawtooth', prog: [0, 0, 5, 4, 0, 0, 3, 5], pat: [0, 3, 2, 5, 4, 2, 3, 1], density: 1, leadOct: 1, perc: 'taiko', drone: { oct: -2, vol: 0.1 }, heartbeat: true }),
  // Title: a fallen lighthouse (falling line), a held star (silence + one bell), then the light climbing back.
  title:       T({
    label: 'Beaconfall (title)', root: 57, steps: [0, 2, 4, 7, 9], bpm: 72, wave: 'sine', lead: 'triangle',
    prog: [0, 3, 0, 3, 2, 4, 0, 0], pat: [0], density: 0, leadOct: 1, perc: 'none', drone: { oct: -2, vol: 0.06 }, bell: true, choir: true,
    motifBars: 8,
    motif: [
      // bars 0-1: the beacon falls (descending line)
      { bar: 0, at: 0, deg: 9, len: 3 }, { bar: 0, at: 4, deg: 7, len: 3 }, { bar: 0, at: 8, deg: 6, len: 3 }, { bar: 0, at: 12, deg: 4, len: 4 },
      { bar: 1, at: 0, deg: 5, len: 3 }, { bar: 1, at: 4, deg: 3, len: 3 }, { bar: 1, at: 8, deg: 2, len: 6 },
      // bars 2-3: stillness, one star-bell
      { bar: 3, at: 4, deg: 11, len: 12, oct: 1 },
      // bars 4-7: the light climbs back
      { bar: 4, at: 0, deg: 2, len: 2 }, { bar: 4, at: 2, deg: 4, len: 2 }, { bar: 4, at: 4, deg: 6, len: 2 }, { bar: 4, at: 6, deg: 7, len: 6 },
      { bar: 5, at: 0, deg: 4, len: 2 }, { bar: 5, at: 2, deg: 6, len: 2 }, { bar: 5, at: 4, deg: 7, len: 2 }, { bar: 5, at: 6, deg: 9, len: 6 },
      { bar: 6, at: 0, deg: 7, len: 3 }, { bar: 6, at: 4, deg: 9, len: 3 }, { bar: 6, at: 8, deg: 11, len: 6 },
      { bar: 7, at: 0, deg: 14, len: 14, oct: 0 },
    ],
  }),
};

// Fields that have their own region theme (field id -> theme). Others use their biome key.
export const FIELD_THEME = { 1: 'meadow', 2: 'autumn', 3: 'mirefog', 4: 'snow', 5: 'ember', 6: 'elderwood' };

// Ember Tide: per-phase tempo and layers, applied on top of whichever region theme is playing.
//  -1 = Calm Ebb (lull), 0 = calm, 1 = Spark, 2 = Surge, 3 = Apex.
export const TIDE_LAYERS = {
  '-1': { bpmMul: 0.82, density: 0.55, perc: 'none',  warm: true },
  '0':  { bpmMul: 1.0 },
  '1':  { bpmMul: 1.06, perc: 'light', war: 0 },
  '2':  { bpmMul: 1.14, perc: 'taiko', war: 1, minor: true },
  '3':  { bpmMul: 1.26, perc: 'taiko', war: 2, minor: true, lead: 'sawtooth', density: 1 },
};

// Dimming (darkness stacks) shapes the *same* music instead of replacing it: the music bus is low-passed and a cold
// beating pedal fades in. Stack 0 is fully open.
export const DIM_FILTER_HZ = [18000, 5200, 2600, 1200];
export const DIM_DRONE_VOL = [0, 0.035, 0.06, 0.09];

/** Which theme key plays for a place. Pure; mirrors what game.js passes in. */
export function themeKeyFor({ title = false, town = false, boss = false, field = 0, biomeKey = 'meadow', interior = false, night = false } = {}) {
  if (interior) return 'interior';
  if (title) return 'title';
  if (town) return 'town';
  if (boss) return 'boss';
  if (night && field) return 'night';
  if (field && FIELD_THEME[field]) return FIELD_THEME[field];
  return THEMES[biomeKey] ? biomeKey : 'meadow';
}

/** Tide phase to feed the sequencer. Only fields have a tide; town/interior/boss rooms never get the layer. */
export function tideLayerFor(key, phase) {
  if (key === 'town' || key === 'interior' || key === 'title' || key === 'boss' || key === 'finale') return null;
  return TIDE_LAYERS[String(phase)] || null;
}

/** Combine a theme and an optional tide layer into the recipe the sequencer reads this bar. */
export function effectiveTheme(key, tidePhase = 0) {
  const base = THEMES[key] || THEMES.meadow;
  const layer = tideLayerFor(key, tidePhase);
  if (!layer || tidePhase === 0) return base;
  let steps = base.steps;
  if (layer.minor) steps = base.steps.map((s, i) => (i === 2 ? Math.min(s, 3) : s)); // lower the third: darker colour for Surge/Apex
  return {
    ...base,
    steps,
    bpm: base.bpm * layer.bpmMul,
    perc: layer.perc || base.perc,
    density: layer.density ?? base.density,
    lead: layer.lead || base.lead,
    war: layer.war || 0,
    warm: !!layer.warm,
  };
}
