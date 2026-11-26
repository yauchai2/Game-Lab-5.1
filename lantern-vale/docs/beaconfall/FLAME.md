# Beaconfall Flame API (Phase 2)

The lamp is a real mechanic. This file is the contract for Phase 4 (class lamp-wick abilities) and later phases.
Code: `src/flame.js` (logic, no DOM/THREE), `src/flame_hud.js` (HUD), `src/flame_fx.js` (ground light rings). Tuning: `data/flame.json`.

## Rules in one screen
| Piece | Behaviour |
|---|---|
| **Flame** | New resource next to HP and mana (mana is untouched). Max 100. Starts full. Shown as the orange bar under MP. |
| **Gain** | Basic melee hit +1.2, bow shot +0.5, kill +3, elite +6, boss +25. Standing in light +10/s, in town +25/s. |
| **Cost** | Ultimate (`V`) burns 20 (soft cost, never blocks the cast unless `cost.ultimateGate` is turned on). Every enemy hit on the player burns 4% of max. |
| **Drain** | Outside all light: -0.5/s (x difficulty x zone variant). |
| **Light** | Safe zones with a radius: lit star lantern (checkpoint) 14, campfire 8, field gate 10. Entering light autosaves, restores a little HP/mana, and decays Dimming. Towns, harbor, dungeons, towers, interiors and cave runs are always lit. |
| **Dimming** | Outside light for 14 s -> stack 1, then +1 every 10 s up to 3 (cozy: max 1). Empty Flame floors it at 2. Each stack: -5% move speed, -25% natural HP/mana regen, narrower view (dark vignette). Leaving a stack costs 2 s inside light. |
| **Zone variants** | Same numbers, different flavour per field/biome: Spore Fog (field 3), Blizzard (4), Ashfall (5), Grave Gloom, Deep Murk, Sandveil, Blackout, Hive Dark. Default is "Dimming". |
| **Respawn** | Death in a field wakes you at the nearest *lit* star lantern in that field (same map, enemies pushed back, 3 s i-frames, HP/mana full, Flame >= 60%, Dimming cleared). No lit lantern: town, as before. 25% of materials still go to the gravestone (now created where you fell). Gear and starshards are never lost. |

## Saved data (schemaVersion 3)
`meta.p.flame = { v }` (`v: null` means "start full") and `meta.p.litLanterns = ['<field>:<idx>', ...]`.
v1/v2 saves migrate on load (`src/save_schema.js`): `litLanterns` is back-filled from the existing `unlockedCps`, nothing is dropped, and a `<key>.bak_v<from>` backup is written. Storage keys are unchanged.
Runtime-only state lives in `game.flameRt` (Dimming stacks, timers, current modifiers).

## API (import from `./flame.js`)
```js
getFlame(g)                       // current value
flameMax(g)                       // max after wick bonus
addFlame(g, n, reason)            // returns gained; applies wick gainMul
spendFlame(g, n, reason)          // returns spent (clamped to current); applies wick costMul
canSpend(g, n)
flameSnapshot(g)                  // { value, max, pct, dim, maxDim, variant, fx, safe, zone, dark }
isDarkZone(g), isSafeAt(g,x,z), lightAt(g,x,z), lightSources(g)
findRespawn(g)                    // nearest lit lantern in this field or null
markLanternLit(g, field, idx)     // idempotent
onFlame(event, fn) -> unsubscribe // 'gain' | 'spend' | 'empty' | 'dim' | 'enterLight' | 'leaveLight' | 'respawn'
FLAME_CFG                         // parsed data/flame.json
```
Game hooks already wired in `game.js` / `tide.js`: `onBasicHit`, `onKill`, `onUltimate`, `onPlayerHurt`, `updateFlame` (per frame), `respawnAtLantern`.

## How Phase 4 plugs in (class "lamp wick")
Set `g.player.flameWick` when the player is built (e.g. in `makePlayer`/`recalc`, from class and second class). All fields are optional:
```js
g.player.flameWick = {
  gainMul: 1.0,    // multiplies every addFlame
  costMul: 1.0,    // multiplies every spendFlame
  maxBonus: 0,     // added to max Flame
  drainMul: 1.0,   // multiplies outside-light drain (Duskblade: < 1 in the dark, etc.)
  lightRegenMul: 1.0, // multiplies in-light refill (Phase 4)
  killGainMul: 1.0,   // multiplies Flame from kills (Phase 4)
};
```
Class abilities should cost Flame with `spendFlame(g, n, 'skillId')` and gate themselves with `canSpend`. React to the lamp with `onFlame(...)` (for example Lotus Monk purifies on `enterLight`, Duskblade empowers on `dim`). Merge each `classMech` into its wick by reading `flameSnapshot(g)` next to `p.classRes`; the HUD already keeps both bars.
Keep Flame numbers in `data/flame.json` (or a new `data/wicks.json`), never inline.

Phase 4 is implemented: see `WICKS.md` (class wicks and advancement stances, `src/wick.js`).

## Balance notes
- A full bar lasts about 200 s outside light, and combat gains offset drain, so a fight-heavy route never starves. Stacks only appear after 14 s of standing in the dark.
- Max Dimming costs 15% speed, 75% regen and a visibly narrower view. Combat damage is untouched on purpose.
- Everything is data: `radius.*`, `gain.*`, `drain.*`, `dimming.*`, `difficulty.*`, `respawn.*`, `variants.*`. `tests/flame_logic.cjs` only asserts invariants (light out-regens drain, caps stay playable), so tuning does not break tests.
- Manual playtest wanted from Alan: marsh (field 3) and the gothic graveyard (field 16) for feel.

## Tests
`node tests/flame_logic.cjs` (in `npm test`) covers config invariants, light/campfire/gate, Dimming stacks/decay/floor, gain/spend/events/wick, respawn point choice, schema v1/v2 -> v3.
`npm run test:flame` runs the built game in Chromium (set `PW_CHROMIUM=/opt/pw-browsers/chromium` if Playwright's own browser is missing) and writes `shots/flame_*.png`.
