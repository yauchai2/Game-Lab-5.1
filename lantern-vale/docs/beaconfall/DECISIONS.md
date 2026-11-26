# Beaconfall — locked decisions (2026-11-26)

Alan approved "go with recommendations". These are final unless Alan changes them.

| Topic | Decision |
|---|---|
| Name | **Beaconfall** (English only, no Chinese title). Legacy names 燈谷行 / Lantern Vale are retired from player-facing text |
| Classes | Keep **5 classes / 10 advanced classes** (repo reality). Names in `data/glossary.json` |
| Ancient stag king Orld | Zone-6 (Elderwood) boss, corrupted guardian, not the final boss. Final boss is Morvane, the Unlit King |
| Flame vs mana | **Flame is a new resource alongside mana** (not a replacement); merges with each class `classMech` as the "class wick" |
| Death | Respawn at the nearest **lit star lantern** (town if none). Keep 25% material drop and gravestone; gear and starshards are never lost |
| Advanced-class names | As in glossary (`subclasses`); chosen at the awakening altar as a story choice |
| Logo direction | Fallen lighthouse silhouette + starshards, warm amber on deep navy; text logo first, art in Phase 6 |
| Repo / folder naming | Keep `lantern-vale/` folder and `lv_*` storage keys for now; no repo rename |
| Relight endgame | Build **solo/offline simulation first**; server-wide shared progress is Phase 8 |
| Save compatibility | Storage keys unchanged. Profile gets `schemaVersion` (v3 since Phase 2); v1/v2 saves migrate on load and a backup is written to `<key>.bak_v<from>` |

## Phase status
- Phase 0: done (glossary, string audit script and report, decisions, save schema).
- Phase 1: done for branding/title/about/boot splash/server and test strings; Flame HUD placeholder deferred to Phase 2 (a bar with no data would mislead).
- Phase 2: done (Flame, light radius, lantern respawn, Dimming). API and tuning guide: `docs/beaconfall/FLAME.md`, numbers in `data/flame.json`. Phase 4 hooks in through `player.flameWick` and `onFlame()`.
- Phase 4: done for class wicks (5) and advancement stances (10) with the altar vow scene. Guide: `docs/beaconfall/WICKS.md`, numbers and story text in `data/wicks.json`.
- Not changed yet: zone/island/boss names, NPC text, quests, class/skill names, items (Phases 3–5).
