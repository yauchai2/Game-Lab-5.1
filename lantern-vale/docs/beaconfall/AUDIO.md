# Beaconfall music and sound direction (Phase 6.5)

Everything is synthesized in the browser (`src/audio.js`), so no audio files are downloaded or licensed. Recipes live in `src/music_themes.js`; lamp cues in `src/flame_audio.js`. Tests: `npm run test:audio` (pure Node, in `npm test`) and `npm run test:audio:browser` (built game, measures loudness and brightness).

## Direction in one paragraph
Warm and small, like a lantern in a big dark. Bright where the lamp is safe, sparse and low where it is not. Music never stops being tuneful: danger changes tempo, drums and colour, not the key family. Dimming does not swap the song, it closes a filter on the same song, so the player *hears* the light going out. Every cue is a short synth phrase; melody is pentatonic or a near-pentatonic scale so overlapping notes never clash.

## Region themes
| Place | Theme key | Colour | Tempo | Notes |
|---|---|---|---|---|
| Emberhearth (town), Dawnmeadow | `town`, `meadow` | A major pentatonic, triangle pluck | 98 / 100 | Brightest piece. Light hats. |
| Whisperwood | `autumn` | Minor pentatonic, flute-like sine lead | 84 | Wood knocks, wind bed. |
| Mirefog Marsh | `mirefog` | Low root (A2), sparse, minor with a flat fifth | 66 | Heavy pedal, random bubble plinks, no drums. |
| Rimewind Tundra | `snow` | High, sparse bells with long delay | 62 | No drums, wind bed. |
| Cinderreach | `ember` | Phrygian-ish, saw bass | 108 | Taiko every two beats. |
| Elderwood | `elderwood` | Choir: three detuned sines swelling per bar | 56 | No drums, deep pedal. Orld's zone is the slowest, biggest sound. |
| 14 outer islands | by biome: `desert`, `jungle`, `gothic`, `deep_sea`, `scifi`, `alien`, plus the base four | one recipe per biome | 56 to 118 | Hand drums, marimba-like plucks, organ drone, floating bells, machine ticks, whole-tone hive. |
| Boss rooms | `boss` | Saw, 128 bpm, taiko | 128 | Unchanged feel. |
| Night (field, no enemies) | `night` | Slow sine | 64 | As before. |
| The Fallen Beacon (Phase 8) | `finale` | Low saw, tritone, heartbeat thump | 134 | **Defined and tested, not wired.** Phase 8 calls `audio.setMusic('finale', ...)`. |

Field ids map to regions in `FIELD_THEME` (1 to 6); every other field uses its biome key.

## Title theme
A fixed 8-bar melody (`THEMES.title.motif`), 72 bpm. Bars 1 to 2: a falling line, the beacon falls. Bars 3 to 4: near silence, one high star-bell. Bars 5 to 8: a rising line that ends on a long held note, the light climbs back. A slow choir pad and a low pedal sit under it. The same recipe plays on the death screen.

## Ember Tide
The region theme keeps playing; the tide phase reshapes it (`TIDE_LAYERS`):
| Phase | Change |
|---|---|
| Calm | none |
| Spark | +6% tempo, light hats |
| Surge | +14% tempo, taiko, war toms, third lowered (darker) |
| Apex | +26% tempo, taiko, extra toms, brass stab each bar, sawtooth lead, full density. Also the `apexStart` brass hit when the Apex boss spawns. |
| Calm Ebb (lull) | -18% tempo, fewer notes, soft sine lead, no drums |
Town, interiors, boss rooms and the title ignore the tide.

## Flame and Dimming cues
| Event | Cue (`sfx` name) | When |
|---|---|---|
| Flame gain | `flameGain` | Only gains of 3 or more (kills, elites, bosses). Basic hits stay silent. |
| Flame spend | `flameSpend` | Spends of 10 or more (ultimates). Hollow hits stay silent. |
| Flame empty | `flameOut` | The lamp gutters. |
| Dimming deeper | `dimIn` | Lower and more dissonant each stack. |
| Dimming eases | `dimOut` | A stack drops. |
| Enter / leave light | `enterLight` / `leaveLight` | Warm chord up, two soft notes down. Rate limited to one per 1.2 s. |
| Star lantern lit | `lanternLit` | Four bells (replaces the generic win jingle). |
| Respawn at lantern | `lanternRespawn` | Rising warm phrase on top of `revive`. |

**Dimming on the music:** stack 1 / 2 / 3 low-passes the music bus to 5.2 / 2.6 / 1.2 kHz and fades in a beating cold pedal (two sines 1.4 Hz apart, tuned to the theme root). Leaving Dimming opens it back up. SFX are not filtered, so combat stays readable in the dark. Measured in the built game: spectral centroid fell from about 1.6 kHz to 1.1 kHz at stack 3.

## Where to change things
- Tempo, scale, drums, colours: `src/music_themes.js` (one object per theme, `TIDE_LAYERS`, `DIM_FILTER_HZ`).
- How a switch sounds (drum patterns, choir, bells): `percStep`, `swell`, `bellNote`, `playStep` in `src/audio.js`.
- Which events cue, and thresholds: `src/flame_audio.js` (`FLAME_AUDIO_RULES`).
- New region later (Phase 3 renames or new zones): add a theme, add the field id to `FIELD_THEME`. `tests/audio_music.cjs` fails if a biome or mapped field has no theme.

## Not done / for Alan to judge by ear
- Nobody has listened yet. Tests prove the themes sound, differ in tempo and brightness, and switch correctly; they cannot say if they are pleasant. Please play fields 1 to 6 and a Dimming stack 3 and tell me what to change (volume, drums too loud, bells too sharp).
- Music is still quiet overall (same master levels as before); raise the music slider or ask me to rebalance.
- Mode changes crossfade over about 0.4 s out and 1.1 s in; the new theme restarts from bar 1.
