# Beaconfall class wicks and advancement stances (Phase 4)

Every class lights the lamp in its own way (the **class wick**). Every advanced class is a **stance** toward the lamp, chosen at the awakening altar as a story decision, and it is merged on top of the class wick. Code: `src/wick.js` (logic, no DOM/THREE). Numbers and all story text: `data/wicks.json`. Built on the Flame API in `FLAME.md` (`player.flameWick`, `onFlame`).

## Class wicks
| Class | Wick | How it lights the lamp |
|---|---|---|
| Lightwarden | Keeper's Wick | +25 max Flame, drains x0.6 in the dark, hits burn x0.8; armor +6 above 70% Flame; mechanic fill +15 Flame |
| Galewatch Ranger | Windlit Wick | running in the dark gives +0.8 Flame/s, Dimming slow halved; mechanic fill +10 Flame |
| Emberseer | Twin Wick | gold flame above 60% (+12% damage), blue flame below 35% (+35% mana regen); gains x1.2, costs x1.3; mechanic fill burns 10 Flame for 20 mana |
| Duskblade | Shaded Wick | drains x0.4 in the dark, each Dimming stack gives +6% damage and +4% crit, 60% of the slow cancelled; light refills x0.8; mechanic fill +8 Flame |
| Lotus Monk | Lotus Wick | returning to light heals 10% and gives a lotus mark; light refills x1.4; mechanic fill +20 Flame |

## Stances (the story choice)
Each pair is two attitudes to the same lamp. Each has a stated gain and a stated price, plus a vow scene and an epilogue (shown at the altar and in the codex).

| Class | Choice A | Choice B |
|---|---|---|
| Lightwarden | Radiant Bastion, **Oath of Shelter**: guard the lamp (tanky, weaker in the dark) | Vale Sentinel, **Oath of Roots**: carry the light out (stronger in the dark, slow to refill) |
| Galewatch Ranger | Sky Pathfinder, **Oath of the Tailwind**: the lamp is the way home (runs feed it, kills feed less) | Starbrand Hunter, **Oath of the Brand**: the lamp is a mark (kills feed +50%, crit, burns faster) |
| Emberseer | Starburn Sage, **Oath of Burning Out**: burn it bright (+gain, +damage, burns +40%) | Frostlight Dreamweaver, **Oath of the Kept Ember**: keep it for last (slow burn, mana when low, slower gain) |
| Duskblade | Crimson Moon Dancer, **Oath of the Glare**: fight in the light (+damage and crit in light) | Mist Phantom, **Oath of the Unseen**: become the dark (crit in the dark, less slow) |
| Lotus Monk | Lotus Sage, **Oath of Tending**: care for the lamp (bigger return heal, faster refill) | Thunderfist, **Oath of the Spark**: strike the spark (+gain, +damage above 80%, burns Flame for heals) |

## Data shape (`data/wicks.json`)
`classes.<key>` and `stances.<scId>.mods` use the same fields. Multiplier keys multiply, number keys add, `tiers` concatenate.
- `flameWick`: `gainMul costMul drainMul lightRegenMul killGainMul` (multiply), `maxBonus` (add). `gainMul/costMul/maxBonus/drainMul` go to `player.flameWick`; `lightRegenMul/killGainMul` are read by `flame.js`.
- `perDim`: per Dimming stack `dmgPct crit armor speedOffset`.
- `tiers`: `[{ when: flameAbove|flameBelow|inLight|inDark, at, dmgPct, crit, armor, manaRegen, speedOffset }]`.
- `moveGainPerSec`, `onEnterLight {healPct flame classRes}`, `onMechFull {flame spend mana healPct}`.
- `limits` clamps every dynamic bonus.

## API (`src/wick.js`)
`buildWick(job, scId)`, `refreshWick(g)` (called from `recalc()`), `updateWick(g, dt)` (after `updateFlame`), `computeWickFx(wick, snap)`, `wickMechFull(g)`, `bindWick(g)`, `classWickByJob`, `stanceById`, `stancesForJob`.
Runtime output: `player.wick`, `player.flameWick`, `player.wickFx` (`rollDamage`, `hurtPlayer`, mana regen and move speed read it).

## Story choice and saves
The altar button is now "face the vow": it opens the vow scene (scene, vow, gain, price) and awakening happens on "swear the vow and awaken". The choice is stored as `meta.p.vow = { sc, at }`, an optional field next to `secondClass`, so the save schema stays **v3** and old saves load unchanged (the stance comes from `secondClass`). Re-choosing at the altar costs the awakening fee again, as before. A stance is ignored if it does not belong to the player's class.

## Unchanged on purpose
Class, advanced class and skill display names, awakening requirements and cost, trial checks, the 6x6 skill puzzle and `classMech` itself (the wick reacts when it fills, it does not replace it).

## Tests
`node tests/wick_logic.cjs` (in `npm test`): data invariants (5 wicks, 10 stances, two per class, every field present), merge rules, limits, tier/perDim effects, live Flame integration, enter-light heal, mechanic burn, awakening and `vow`, v1/v2/v3 saves, 6x6 starter boards. `npm run test:wick` runs the built game, takes the altar through a vow and writes `shots/wick_*.png` (copies in `docs/beaconfall/phase4/`).
