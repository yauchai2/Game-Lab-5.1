# Beaconfall Phase 3: region text, bosses, quests, NPCs, Lore Fragments

All text is in `data/lore.json`. Logic and the shared entry points are in `src/lore.js`. Display text only: field ids, item ids and `lv_*` save keys are unchanged.

## What is covered
Six regions (field ids 1-6): Dawnmeadow, Whisperwood, Mirefog Marsh, Rimewind Tundra, Cinderreach, Elderwood. Each has a lamp conflict, a faction, a Morvane reveal stage, one boss, 2 field NPCs, 7 quests (Elderwood 8) and 8 Lore Fragments. Town: Captain Hale (new, Emberhearth) and rewritten one-liners for the 7 town NPCs and 3 harbor NPCs.

Not covered here (later Phase 3 tasks): the 14 outer islands (3.7), rewriting the existing `STORY_CHAPTERS` in `mmo_rpg.js` (3.8), Ember Tide story beats (3.9), renaming `FIELDS[n].name` and the Chinese zone names scattered in `worldmap.js` and the tests. In-game zone names still show the legacy Chinese; the lore layer shows `English · legacy`.

## Rules the text follows (plan section 7)
Quest title is at most 5 English words. Description is at most 2 sentences. At most 3 goals. Reward is fixed and always shown. Fragments are 1-2 sentences. NPC lines are short, with at most one joke or mood. `tests/lore_logic.cjs` enforces these.

## Morvane reveal
Regions 1-2: he is the monster that wrecked the Beacon. Regions 3-4: he was the chief keeper Morvane Ashgrave (Elder diary fragments). Region 5: he stole light so the next generation would not watch the lamps go out (forge letters). Region 6: his daughter died on the last unlit night (Orld's last memory). The final choice stays in Phase 8.

## Bosses
Boss bar and boss toasts use the lore name, for example `Cleaver Tusk · 裂地獠牙`. The 3D models are still the old per-field ones (`FIELD_BOSS_SPEC`), so Cleaver Tusk is currently drawn as the sunflower boss and Orld as the earth golem. Art for these is a Phase 6 task. Orld is the Elderwood boss, not the final boss.

## Quest lines
Each region has a linear chain; only the first unfinished quest progresses. Goals: `kill`, `elite`, `boss`, `gather`, `chest` (high-platform chest), `talk` (NPC id), `lantern` (lit star lanterns beyond the first in that region), `fragment` (fragments found in that region). `talk` goals may set `"at": "town"` (region 1's first quest talks to Hale). Quests complete automatically, pay coins, Starshards and keys at once, and grant XP through the normal level-up path. Rewards are tunable in `data/lore.json`. The HUD tracker shows a second blue line with the active region quest. The Codex tab "傳說與任務" lists all regions, quests, NPCs and fragments (unfound fragments show their source hint).

## Lore Fragment sources
`quest`, `boss`, `lantern` (nth new lantern), `elite` (nth elite kill in the region), `gather`, `chest`, `kill`, `talk`. Phase 5 can add drop sources by calling `loreHook(g, { kind: ... })` or by extending `recordLoreEvent`.

## Save data (no schema bump)
`p.loreFragments` (array of ids, existed since schema v2) and `p.storyFlags.rq = { q, stats, talked }`. `ensureLoreState` fills defaults, so old profiles load unchanged.

## Public API (`src/lore.js`)
`recordLoreEvent(profile, { field, kind, elite?, boss?, npc?, idx? })` is pure and tested. `loreHook(g, ev)` wraps it for live game code (toasts, XP, save). Also: `activeQuest`, `questProgress`, `trackerLine`, `loreCards`, `bossDisplayName`, `regionNpcs`, `townLines`.

## Also fixed on the way
Field NPC bots were removed on the first frame after entering a field (`updateNet` zone-change cleanup removed every remote whose id did not start with `bot`). They are now kept, so the existing field NPCs actually appear and wander.

## Tests
`node tests/lore_logic.cjs` (in `npm test`) checks text rules, glossary names, quest and fragment reachability, a full region 1 playthrough, every region's quest line, and save round-trip. `npm run test:lore` runs the built game: Hale, both NPCs and a chest in each region, boss name, tracker line, talk path and the Codex tab.
