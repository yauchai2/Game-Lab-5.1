// Export engine-neutral game data to data/*.json.  Run: node tools/export_data.mjs
// Bundles src modules with esbuild (they import three) and executes them in node.
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const entry = `
export * as loot from '${root}/src/loot.js';
export * as util from '${root}/src/util.js';
export * as meta from '${root}/src/meta.js';
export * as frontier from '${root}/src/frontier.js';
export * as wm from '${root}/src/worldmap.js';
export * as town from '${root}/src/town.js';
`;
const out = path.join(root, 'node_modules/.cache-export.mjs');
await build({ stdin: { contents: entry, resolveDir: root }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.svg': 'text' },
  banner: { js: "globalThis.window=globalThis.window||{addEventListener(){},innerWidth:1280,innerHeight:720};globalThis.document=globalThis.document||{createElement(){return{getContext(){return null},style:{}}},addEventListener(){}};globalThis.localStorage=globalThis.localStorage||{getItem(){return null},setItem(){}};" } });
const M = await import(pathToFileURL(out).href);
const hex = n => '#' + n.toString(16).padStart(6, '0');
const w = (name, obj) => { mkdirSync(path.join(root, 'data'), { recursive: true }); writeFileSync(path.join(root, 'data', name), JSON.stringify(obj, null, 2) + '\n'); console.log('wrote data/' + name); };

// ---- loot ----
const { RARITY, TIERS, SLOTS, AFFIXES, UNIQUES, BOONS, FORGE } = M.loot;
const tpl = f => f('{v}');
w('loot.json', {
  _note: 'Engine-neutral. Affix values are rolled as roll(tier) * uniform(0.75,1.15), rounded. rollByTier lists the pre-variance base for tier 1..6.',
  rarity: RARITY.map(r => ({ key: r.key, name: r.name, color: r.color })),
  tiers: TIERS.filter(Boolean).map(t => ({ tier: t.tier, tag: t.tag, name: t.name, color: t.color, mult: t.mult })),
  slots: SLOTS,
  affixes: AFFIXES.map(a => ({ key: a.k, text: tpl(a.fmt), slots: a.slots, rare: !!a.rare, rollByTier: [1, 2, 3, 4, 5, 6].map(t => a.roll(t)) })),
  implicitByTier: { staff: '4+3t baseDmg', cloak: '10+6t maxHp', charm: '2+t crit' },
  itemScoreWeights: { baseDmg: 3, dmgPct: 1, addFire: 2.5, atkSpd: 1.2, crit: 1.5, critMult: 0.5, maxHp: 0.6, lifeOnHit: 3, moveSpd: 1.2, cdr: 1, mana: 0.3, area: 0.7, armor: 2, regen: 3, proj: 20, uniqueBonus: 40 },
  uniques: UNIQUES,
  forge: Object.fromEntries(Object.entries(FORGE).map(([k, f]) => [k, { name: f.name, desc: f.desc,
    cost: { base: f.cost({ tier: 0 }), perTier: f.cost({ tier: 1 }) - f.cost({ tier: 0 }) } }])),
  forgeCostFormula: 'cost = base + perTier * item.tier',
});
// ---- talents (boons) ----
w('talents.json', { _note: 'Boons = passive picks offered between rooms. weight 0 = guaranteed skill unlock. needs = required unlocked skill. stack = may be taken repeatedly.',
  boons: BOONS.map(b => ({ id: b.id, name: b.name, icon: b.icon, desc: b.desc, weight: b.weight, stack: !!b.stack, skill: b.skill || null, needs: b.needs || null })),
  offerCount: 3 });
// ---- zones ----
const biomes = M.util.BIOMES.map(b => {
  const o = {};
  for (const [k, v] of Object.entries(b)) o[k] = (Number.isInteger(v) && v > 1) ? hex(v) : Array.isArray(v) && v.every(Number.isInteger) && Math.max(...v) > 1 ? v.map(hex) : v;
  return o;
});
w('biomes.json', { _note: 'Colours are #rrggbb sRGB. Float arrays (water*, grade, shaft, fog) are linear 0-1 RGB multipliers/colours. ambient/sunI are three.js r155+ intensities BEFORE the x1.75 hemi / x2.3 sun physical-light multipliers.', biomes });
w('zones.json', {
  fields: M.frontier.FIELDS.filter(Boolean).map((f, i) => ({ id: i + 1, ...f, grass: f.grass != null ? hex(f.grass) : null, fog: f.fog != null ? hex(f.fog) : null })),
  goods: M.frontier.GOODS,
  worldRegions: M.wm.WORLD_REGIONS,
  progression: { maxLevel: 30, xpToNext: 'level * 40', killXp: '(10 + lvl*(elite?4:2)) * (night?1.25:1) * (guild?1.1:1)', coins: { normal: 2, elite: 5 } },
});
// ---- meta ----
w('meta.json', { mods: M.meta.MODS, modMax: M.meta.MOD_MAX, profileDefaults: M.meta.DEFAULT_PROFILE });
// ---- town ----
w('town.json', {
  _note: 'Units are world metres, x east / z south, origin = central plaza. Y comes from the terrain height fn (flat town plateau).',
  layout: M.town.TOWN_LAYOUT,
  plaza: { radius: 8.0, innerRadius: 3.45, fountainSegments: 8 },
  streets: [
    { from: [0, -7.4], to: [0, -18.5], width: 4.0, name: 'north main' },
    { from: [0, 7.4], to: [0, 19.2], width: 4.0, name: 'south main' },
    { from: [-7.4, 0], to: [-17, 0], width: 3.0, name: 'west cross' },
    { from: [7.4, 0], to: [17, 0], width: 3.0, name: 'east cross' },
  ],
  paving: ['#d9cdb4', '#cabda3', '#e4d8c0', '#bfb299', '#d2c6ac'],
  homes: [
    { pos: [-19, 0], rotY: 90, roof: '#ffb840', w: 3.6, d: 3.2, floors: 2 },
    { pos: [19, 0], rotY: -90, roof: '#58a0e0', w: 3.6, d: 3.2, floors: 2 },
    { pos: [15.5, -12], rotY: -90, roof: '#e0553c', w: 3.6, d: 3.0, floors: 2 },
    { pos: [13, 10.5], rotY: -90, roof: '#5aae60', w: 3.4, d: 3.0, floors: 1 },
    { pos: [-15.5, -12.5], rotY: 90, roof: '#5aae60', w: 3.2, d: 2.8, floors: 1 },
  ],
  wallColor: '#f6ebd0',
  lampPosts: [[-2.7, -11], [2.7, -11], [-2.7, -16], [2.7, -16], [-2.7, 11], [2.7, 11], [-2.7, 16.5], [2.7, 16.5], [-11.5, -2.2], [-11.5, 2.2], [11.5, -2.2], [11.5, 2.2]],
  benches: [[-5.6, 3.4], [5.6, 3.4], [-3.4, 5.6], [3.4, 5.6]],
  roundTrees: [[-20.5, -6], [-21, 6], [20.5, -7], [21, 6.5], [-17.5, 10.5], [17.5, 12.5], [-8, -17.5], [8.5, -18], [-12.5, -16.5], [13, -16.5], [-19, 13]],
  cypress: [[-5.5, -20.5], [5.5, -20.5], [-10, -20], [10.5, -20], [-15, -18.5], [16, -18.5], [-22, -1], [22.5, 0.5]],
  blossom: [{ pos: [-17.5, -8.5], color: null }, { pos: [9.5, 13.5], color: '#f7b0cf' }],
  interactions: [
    { kind: 'quest', label: '任務布告欄', at: M.town.TOWN_LAYOUT.board },
    { kind: 'forge', label: '鐵匠鋪', at: M.town.TOWN_LAYOUT.forge },
    { kind: 'map', label: '出發地圖桌', at: M.town.TOWN_LAYOUT.mapTable },
    { kind: 'well_drink', label: '汲取甘泉', at: M.town.TOWN_LAYOUT.well },
    { kind: 'fountain_wish', label: '許願噴泉', at: [0, -1] },
    { kind: 'sit', label: '坐下休憩', at: 'benches' },
  ],
});
