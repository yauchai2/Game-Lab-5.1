// Beaconfall music/audio direction: theme data invariants, theme selection, sequencer + SFX smoke test on a mock AudioContext.
// Pure Node (no browser). Run: node tests/audio_music.cjs
const assert = require('node:assert/strict');
const path = require('node:path'); const { pathToFileURL } = require('node:url');
const imp = f => import(pathToFileURL(path.join(__dirname, '../src', f)));

(async () => {
  const M = await imp('music_themes.js');
  const { BIOMES } = await imp('util.js');
  const { FIELDS } = await imp('frontier.js').catch(() => ({ FIELDS: null }));

  // ---- theme data invariants (values are tunable; shape is not) ----
  const PERC = ['none', 'light', 'wood', 'hand', 'taiko', 'pulse'];
  for (const [k, T] of Object.entries(M.THEMES)) {
    assert.ok(T.root >= 28 && T.root <= 72, k + ' root');
    assert.ok(T.steps.length >= 5 && T.steps.every((s, i) => i === 0 || s > T.steps[i - 1]) && T.steps.at(-1) < 12, k + ' steps ascend inside an octave');
    assert.ok(T.bpm >= 50 && T.bpm <= 140, k + ' bpm');
    assert.ok(PERC.includes(T.perc), k + ' perc');
    assert.ok(T.prog.length >= 4 && T.prog.every(d => d >= 0 && d < T.steps.length), k + ' prog degrees valid');
    if (!T.motif) assert.ok(T.pat.length >= 4 && T.density > 0 && T.density <= 1, k + ' lead pattern');
  }
  // every biome and every region has a theme
  for (const b of BIOMES) assert.ok(M.THEMES[b.key], 'biome theme ' + b.key);
  for (const [id, key] of Object.entries(M.FIELD_THEME)) assert.ok(M.THEMES[key], 'field ' + id + ' theme ' + key);
  assert.ok(M.THEMES.finale && M.THEMES.title);

  // ---- direction: regions must sound different from each other ----
  const six = Object.values(M.FIELD_THEME).map(k => M.THEMES[k]);
  assert.equal(new Set(six.map(t => t.bpm)).size, 6, 'six regions, six tempos');
  assert.ok(M.THEMES.snow.perc === 'none' && M.THEMES.snow.density < M.THEMES.meadow.density, 'Rimewind is sparser than Dawnmeadow');
  assert.ok(M.THEMES.mirefog.root < M.THEMES.meadow.root - 8, 'Mirefog sits low');
  assert.equal(M.THEMES.ember.perc, 'taiko'); assert.ok(M.THEMES.elderwood.choir);
  assert.ok(M.THEMES.finale.bpm > M.THEMES.boss.bpm, 'finale is the tensest piece');
  assert.ok(M.THEMES.title.bpm < M.THEMES.meadow.bpm);
  for (const m of M.THEMES.title.motif) assert.ok(m.bar < M.THEMES.title.motifBars && m.at + 0 <= 15);

  // ---- theme selection ----
  const k = M.themeKeyFor;
  assert.equal(k({ title: true }), 'title'); assert.equal(k({ town: true }), 'town');
  assert.equal(k({ field: 3, biomeKey: 'meadow' }), 'mirefog');
  assert.equal(k({ field: 1, biomeKey: 'meadow' }), 'meadow');
  assert.equal(k({ field: 6, biomeKey: 'autumn' }), 'elderwood');
  assert.equal(k({ field: 16, biomeKey: 'gothic' }), 'gothic');
  assert.equal(k({ field: 22, biomeKey: 'nonsense' }), 'meadow');
  assert.equal(k({ field: 5, boss: true, biomeKey: 'ember' }), 'boss');
  assert.equal(k({ field: 2, interior: true }), 'interior');
  if (FIELDS) for (let i = 1; i < FIELDS.length; i++) assert.ok(M.THEMES[k({ field: i, biomeKey: BIOMES[FIELDS[i].biome].key })], 'field ' + i + ' resolves');

  // ---- Ember Tide layers ----
  const base = M.effectiveTheme('meadow', 0);
  assert.equal(base, M.THEMES.meadow, 'phase 0 is the plain theme');
  let prev = base.bpm;
  for (const ph of [1, 2, 3]) { const e = M.effectiveTheme('meadow', ph); assert.ok(e.bpm > prev, 'tide ' + ph + ' speeds up'); prev = e.bpm; }
  assert.ok(M.effectiveTheme('meadow', 3).war >= 2 && M.effectiveTheme('meadow', 3).perc === 'taiko');
  assert.ok(M.effectiveTheme('meadow', -1).bpm < base.bpm, 'Calm Ebb slows down');
  assert.equal(M.effectiveTheme('town', 3), M.THEMES.town, 'town ignores the tide');
  assert.ok(M.effectiveTheme('meadow', 2).steps[2] <= 3, 'Surge lowers the third');
  assert.ok(M.DIM_FILTER_HZ.length === 4 && M.DIM_FILTER_HZ.every((h, i) => i === 0 || h < M.DIM_FILTER_HZ[i - 1]), 'Dimming only closes the filter further');

  // ---- sequencer + SFX on a mock AudioContext ----
  const counts = { osc: 0, noise: 0, gains: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (kind) => ({ kind, gain: param(), frequency: param(), detune: param(), Q: param(), delayTime: param(), threshold: param(), ratio: param(), connect() {}, start() { if (kind === 'osc') counts.osc++; if (kind === 'src') counts.noise++; }, stop() {} });
  class MockCtx {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.state = 'running'; }
    createGain() { counts.gains++; return node('gain'); } createOscillator() { return node('osc'); }
    createBiquadFilter() { return node('filter'); } createDelay() { return node('delay'); } createDynamicsCompressor() { return node('comp'); }
    createBufferSource() { return node('src'); } createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; }
    resume() {}
  }
  global.window = { AudioContext: MockCtx }; global.localStorage = { getItem: () => null, setItem() {} };
  const realSetInterval = global.setInterval; global.setInterval = () => 0;
  const { Audio } = await imp('audio.js');
  const a = new Audio(); a.init();
  assert.ok(a.ctx && a.dimFilter && a.musicFade, 'graph built');

  const keys = Object.keys(M.THEMES);
  for (const key of keys) for (const tide of [0, 2, 3, -1]) for (const intensity of [0, 1]) {
    a.mode = null; a.setMusic(key, intensity, { tide }); assert.equal(a.mode, key);
    const before = counts.osc + counts.noise;
    for (let bar = 0; bar < 8 * 16; bar++) { const S = M.effectiveTheme(key, tide); a.playStep(S, a.nextT, 60 / S.bpm / 2); a.step++; }
    assert.ok(counts.osc + counts.noise > before, key + ' makes sound over 8 bars');
  }
  // mode change fades, then switches
  const realTimeout = global.setTimeout; let fired = null; global.setTimeout = (fn) => { fired = fn; return 1; };
  a.mode = 'meadow'; a.setMusic('mirefog', 0); assert.equal(a.mode, 'meadow'); assert.equal(a.nextMode, 'mirefog');
  a.setMusic('meadow', 0); assert.equal(a.nextMode, null, 'switching back cancels the fade');
  a.setMusic('snow', 0); fired(); assert.equal(a.mode, 'snow'); assert.equal(a.step, 0);
  global.setTimeout = realTimeout;
  // Dimming
  for (const d of [0, 1, 2, 3, 3, 0]) a.setDim(d);
  assert.equal(a.dim, 0); a.setDim(9); assert.equal(a.dim, 3);

  // every SFX name (old and new) runs without throwing
  const names = ['swing', 'hit', 'step', 'win', 'tideHorn', 'lullCalm', 'revive', 'flameGain', 'flameSpend', 'flameOut', 'dimIn', 'dimOut', 'enterLight', 'leaveLight', 'lanternLit', 'lanternRespawn', 'apexStart'];
  for (const n of names) { a.last = {}; const before = counts.osc + counts.noise; a.sfx(n, 2); assert.ok(counts.osc + counts.noise > before, 'sfx ' + n + ' sounds'); }
  a.last = {}; for (const v of [1, 2, 3]) { a.last = {}; a.sfx('dimIn', v); }

  // ---- flame events -> cues ----
  const F = await imp('flame.js'); const FA = await imp('flame_audio.js');
  const played = []; FA.wireFlameAudio({ sfx: (n) => played.push(n) });
  const fake = { state: 'play', field: 3, settings: { difficulty: 'standard' }, meta: { p: { flame: { v: 50 }, litLanterns: [] } }, player: { pos: { x: 500, z: 500 } }, checkpoints: [], biome: { key: 'meadow' } };
  F.addFlame(fake, 1.2, 'basicHit'); assert.deepEqual(played, [], 'basic hits stay silent');
  F.addFlame(fake, 6, 'kill'); assert.deepEqual(played, ['flameGain']);
  played.length = 0; F.spendFlame(fake, 4, 'hollowHit'); assert.deepEqual(played, [], 'Hollow hits stay silent');
  F.spendFlame(fake, 20, 'ultimate'); assert.deepEqual(played, ['flameSpend']);
  played.length = 0; F.spendFlame(fake, 999, 'x'); assert.ok(played.includes('flameOut'), 'empty gutters');
  FA.wireFlameAudio({ sfx: (n) => played.push('second:' + n) }); played.length = 0; F.addFlame(fake, 6, 'kill');
  assert.deepEqual(played, ['second:flameGain'], 're-wiring replaces the old listener, no doubles');

  global.setInterval = realSetInterval;
  console.log('audio_music: ok (' + keys.length + ' themes, ' + names.length + ' sfx)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
