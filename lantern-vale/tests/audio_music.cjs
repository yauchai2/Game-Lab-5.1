// Beaconfall music/audio direction: sound bank coverage, music routing, and Flame cue dispatch.
// Pure Node (no browser). Run: node tests/audio_music.cjs
const assert = require('node:assert/strict');
const path = require('node:path'); const { pathToFileURL } = require('node:url');
const imp = f => import(pathToFileURL(path.join(__dirname, '../src', f)));

(async () => {
  const M = await imp('music_themes.js');
  const { BIOMES } = await imp('util.js');
  const { FIELDS } = await imp('frontier.js').catch(() => ({ FIELDS: null }));

  const fs = require('node:fs');
  const { SFX, FOOTSTEPS, CAST_ACCENTS, WEAPON_CUES } = await imp('action_audio.js');
  const clips = require('../src/audio_clips.json');
  const audioDir = path.join(__dirname, '../game/assets/audio');

  for (const b of BIOMES) assert.ok(M.MUSIC[b.key], 'biome track ' + b.key);
  if (FIELDS) for (let i = 1; i < FIELDS.length; i++) {
    assert.ok(M.MUSIC[M.themeKeyFor({ field: i, biomeKey: BIOMES[FIELDS[i].biome].key })]);
  }
  const cueFiles = new Set(Object.values(M.MUSIC));
  const provenance = require('../game/assets/audio/SOURCES.json');
  assert.deepEqual(new Set(Object.keys(provenance.music)), cueFiles);
  assert.deepEqual(new Set(Object.keys(provenance.effects)), new Set(Object.keys(clips)));
  for (const entry of Object.values(provenance.effects)) assert.ok(provenance.sources[entry.pack]);
  for (const track of cueFiles) assert.ok(fs.statSync(path.join(audioDir, 'music', track + '.mp3')).size > 10000);
  assert.ok(fs.statSync(path.join(audioDir, 'effects.mp3')).size > 60000);
  assert.equal(M.themeKeyFor({ title: true }), 'title');
  assert.equal(M.themeKeyFor({ town: true }), 'town');
  assert.equal(M.musicTrackFor(M.themeKeyFor({ harbor: true })), 'port');
  assert.equal(M.musicTrackFor('interior'), 'interior');
  assert.equal(M.musicTrackFor('mirefog'), 'marsh');
  assert.equal(M.musicTrackFor(M.themeKeyFor({ cave: true })), 'cave');
  assert.equal(M.themeKeyFor({ field: 1, biomeKey: 'snow' }), 'meadow');
  assert.equal(M.themeKeyFor({ field: 2, interior: true }), 'interior');
  assert.equal(M.themeKeyFor({ field: 16, biomeKey: 'gothic' }), 'gothic');
  assert.equal(M.musicTrackFor('mirefog', 3), 'battle');
  assert.equal(M.musicTrackFor('town', 3), 'town');
  assert.equal(M.musicTrackFor('boss', 3), 'boss');
  assert.ok(M.DIM_FILTER_HZ.every((hz, i) => i === 0 || hz < M.DIM_FILTER_HZ[i - 1]));

  const requireClips = (label, names) => {
    assert.ok(names.length, label);
    for (const name of names) assert.ok(clips[name], label + ' maps to missing clip ' + name);
  };
  for (const [name, cue] of Object.entries(SFX)) {
    assert.ok(cue[0] > 0 && cue[0] <= 1, name + ' gain');
    requireClips(name, cue.slice(1));
  }
  for (const [label, names] of Object.entries({ ...FOOTSTEPS, ...CAST_ACCENTS })) requireClips(label, names);
  for (const cue of Object.values(WEAPON_CUES)) assert.ok(SFX[cue]);
  requireClips('glide loop', ['windLoop']);
  for (const file of fs.readdirSync(path.join(__dirname, '../src')).filter(name => name.endsWith('.js') && name !== 'audio.js')) {
    const code = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    for (const match of code.matchAll(/\.sfx(?:\?\.)?\(('|")([a-zA-Z0-9]+)\1(?=[,)]|\s*\))/g)) {
      assert.ok(SFX[match[2]], file + ': missing audio cue ' + match[2]);
    }
  }
  let lastEnd = 0;
  for (const [start, dur] of Object.values(clips)) {
    assert.ok(start >= lastEnd && dur > 0, 'sample slices are positive and do not overlap');
    lastEnd = start + dur;
  }
  const runtime = fs.readFileSync(path.join(__dirname, '../src/audio.js'), 'utf8');
  assert.doesNotMatch(runtime, /createOscillator|createBuffer\(/);

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

  console.log(`audio_music: ok (${cueFiles.size} recordings, ${Object.keys(SFX).length} cues, ${Object.keys(clips).length} clips)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
