import { NEW_ACTIVE_GEMS, NEW_SUPPORT_GEMS } from './gem_catalog.js';

// 原創職業系統與 6×6 技能拼圖（聚方塊相鄰連動，A Short Hike 奶油像素風格）
export const GRID = 6;

export const CLASSES = [
  {
    id: 0, key: 'warden', name: '守燈衛士', icon: '🛡', weapon: 'shield',
    summary: '護甲 +8～15 · 生命 +25',
    desc: '持盾鎮守谷口，累積【堅壁戰意】自動展開聖光護盾，開局配備聖劍天降與裂地重擊。',
    classMech: { id: 'resolve', name: '堅壁戰意', icon: '🛡️', max: 100, color: '#ffcf4a', desc: '普攻／受擊累積戰意，滿 100 自動展開聖光護盾並強化下招範圍 +30%。' },
    classUlt: 'dragon',
    auraTheme: 'holy',
    bonuses: { armor: 15, maxHp: 25 },
    starter: [
      { id: 'paladin_sword', x: 1, y: 1, rot: 0 },
      { id: 'area', x: 3, y: 1, rot: 1 },
      { id: 'leech', x: 3, y: 3, rot: 0 },
      { id: 'slam', x: 1, y: 3, rot: 0 },
    ],
    bag: ['spear_cage', 'coh', 'ember'],
  },
  {
    id: 1, key: 'ranger', name: '林風遊俠', icon: '🏹', weapon: 'bow',
    summary: '移速 +12% · 暴擊 +10%',
    desc: '穿梭林冠的弓手，疊滿【順風連羽】觸發必暴疾風，以 3D 星羽箭雨與雷霆鳳凰橫掃敵陣。',
    classMech: { id: 'feathers', name: '順風連羽', icon: '🪶', max: 5, color: '#5ce0a8', desc: '普攻與移動疊加風羽，滿 5 層展開疾風氣流環並使下次技能必暴！' },
    classUlt: 'phoenix',
    auraTheme: 'wind',
    bonuses: { moveSpd: 12, crit: 10 },
    starter: [
      { id: 'rain', x: 1, y: 1, rot: 0 },
      { id: 'multi', x: 2, y: 3, rot: 0 },
      { id: 'haste', x: 1, y: 3, rot: 0 },
      { id: 'nova', x: 3, y: 2, rot: 0 },
    ],
    bag: ['thunder_phoenix', 'split', 'chain'],
  },
  {
    id: 2, key: 'mystic', name: '餘燼秘術師', icon: '🔥', weapon: 'staff',
    summary: '法力 +25 · 回魔 +40% · 火傷 +4',
    desc: '駕馭【雙焰共鳴（熾金↔幽藍）】，以幽藍龍捲、星域黑洞與熾炎巨鯨交織元素連鎖。',
    classMech: { id: 'duality', name: '雙焰共鳴', icon: '🔵', max: 100, color: '#42b8ff', desc: '施法在熾金餘燼與幽藍魂火間交替，滿層觸發雙焰過載爆破（1.8× 傷）！' },
    classUlt: 'whale',
    auraTheme: 'bluefire',
    bonuses: { mana: 25, manaRegen: 40, addFire: 4 },
    starter: [
      { id: 'bolt', x: 1, y: 1, rot: 0 },
      { id: 'coh', x: 1, y: 2, rot: 0 },
      { id: 'blue_tornado', x: 3, y: 2, rot: 0 },
      { id: 'bluefire', x: 3, y: 1, rot: 0 },
    ],
    bag: ['fire_whale', 'black_hole', 'multi'],
  },
  {
    id: 3, key: 'strider', name: '影刃行者', icon: '⚔', weapon: 'blades',
    summary: '攻速 +25% · 暴傷 +35% · 翻滾更快',
    desc: '雙刃疾行的獵手，以【暗影印記】引爆汲血暗爆，搭配附魔劍氣與冥界巨狼收割殘敵。',
    classMech: { id: 'shadow', name: '暗影印記', icon: '🌙', max: 3, color: '#b86cff', desc: '普攻與暴擊凝聚暗影印記，滿 3 層引爆汲血暗潮並回復生命與法力！' },
    classUlt: 'wolf',
    auraTheme: 'death',
    bonuses: { atkSpd: 25, critMult: 35, rollCdr: 25 },
    starter: [
      { id: 'whirl', x: 1, y: 1, rot: 0 },
      { id: 'sword_beams', x: 3, y: 2, rot: 0 },
      { id: 'phantom', x: 1, y: 3, rot: 0 },
      { id: 'vamp', x: 1, y: 4, rot: 0 },
    ],
    bag: ['dark_wolf', 'coc', 'echo'],
  },
  {
    id: 4, key: 'monk', name: '禪燈武僧', icon: '🥋', weapon: 'staff',
    summary: '攻速 +18% · 生命 +20 · 每秒回血 +2',
    desc: '手持聖燈法杖凝聚【蓮華禪韻】，滿 3 蓮印自動綻放全隊治療領域，兼具繁花聖樹與雷鳴連擊。',
    classMech: { id: 'lotus', name: '蓮華禪韻', icon: '🪷', max: 3, color: '#ff8eb8', desc: '近戰命中凝聚蓮印，滿 3 枚自動綻放蓮華治癒領域回復全隊並加速！' },
    classUlt: 'spirit_sun',
    auraTheme: 'lotus',
    bonuses: { atkSpd: 18, maxHp: 20, regen: 2 },
    starter: [
      { id: 'sakura', x: 1, y: 1, rot: 0 },
      { id: 'healing_tree', x: 2, y: 2, rot: 0 },
      { id: 'echo', x: 1, y: 3, rot: 0 },
      { id: 'leech', x: 3, y: 1, rot: 0 },
    ],
    bag: ['candle_ward', 'thunder', 'haste'],
  },
];

export const ACTIVE_GEMS = {
  bolt:  { id: 'bolt',  type: 'active', name: '餘燼飛彈', short: '焰彈', icon: '🔥', color: '#e26a3c', price: 14, cd: 0.42, mana: 8,  shape: [[0,0],[1,0]], desc: '發射熾熱餘燼彈命中敵人（消耗法力 8）。' },
  slam:  { id: 'slam',  type: 'active', name: '根鬚震擊', short: '震擊', icon: '🌿', color: '#5fa85a', price: 16, cd: 4.5,  mana: 0,  shape: [[0,0],[1,0],[0,1],[1,1]], desc: '撼動地面造成範圍傷害並暈眩敵人 1.1 秒。' },
  wisp:  { id: 'wisp',  type: 'active', name: '螢火護衛', short: '光螢', icon: '✦',  color: '#e5b83b', price: 18, cd: 10.0, mana: 10, shape: [[0,0],[1,0],[2,0]], desc: '召喚環繞自身並自動追蹤敵人的光螢。' },
  rain:  { id: 'rain',  type: 'active', name: '星羽箭雨', short: '箭雨', icon: '🏹', color: '#4c94d8', price: 18, cd: 5.0,  mana: 12, shape: [[0,0],[0,1],[1,1]], desc: '在瞄準區域降下多波星羽流星造成範圍傷害。' },
  trap:  { id: 'trap',  type: 'active', name: '苔霧陷阱', short: '陷阱', icon: '🪤', color: '#8d6cc8', price: 16, cd: 4.0,  mana: 8,  shape: [[0,0],[1,0],[0,1],[1,1]], desc: '在目標地點投出燈苔陷阱，引爆並減速敵人。' },
  whirl:   { id: 'whirl',   type: 'active', name: '旋風燈舞', short: '燈舞', icon: '🌀', color: '#d85a7a', price: 18, cd: 4.2,  mana: 10, shape: [[0,0],[1,0],[2,0],[1,1]], desc: '以自身為中心釋放旋轉熾焰燈環斬擊周圍敵人。' },
  mark:    { id: 'mark',    type: 'active', name: '微弱印記', short: '印記', icon: '🎯', color: '#a84ec8', price: 12, cd: 6.0,  mana: 6,  shape: [[0,0]], desc: '詛咒目標區域，使敵人 6 秒內受到傷害 +16%。' },
  meteor:  { id: 'meteor',  type: 'active', name: '星隕天降', short: '星隕', icon: '☄',  color: '#e04f2c', price: 28, cd: 6.5,  mana: 14, shape: [[0,0],[1,0],[0,1],[1,1]], desc: '召喚燃燒隕石轟擊目標區域並留下烈焰震波。' },
  nova:    { id: 'nova',    type: 'active', name: '極光新星', short: '極光', icon: '❄',  color: '#46b0e8', price: 26, cd: 5.8,  mana: 12, shape: [[1,0],[0,1],[1,1],[2,1]], desc: '爆發雙層冰晶極光環，重創並深度冰緩周圍敵人。' },
  prism:   { id: 'prism',   type: 'active', name: '折光棱鏡', short: '棱鏡', icon: '💎', color: '#38b5a0', price: 26, cd: 7.0,  mana: 12, shape: [[0,0],[0,1],[1,1]], desc: '立起旋轉折光水晶，自動向周圍敵人折射光束。' },
  phantom: { id: 'phantom', type: 'active', name: '影霧幻陣', short: '幻陣', icon: '🌫', color: '#9c5ad8', price: 26, cd: 5.5,  mana: 10, shape: [[0,0],[1,0],[1,1]], desc: '原地留下發光幻影並瞬移閃避，片刻後引爆重創敵人。' },
  sakura:  { id: 'sakura',  type: 'active', name: '櫻吹雪',   short: '櫻雪', icon: '🌸', color: '#eb7aa8', price: 24, cd: 5.2,  mana: 11, shape: [[1,0],[0,1],[1,1]], desc: '捲起漫天櫻花旋風斬擊敵人並留下持續回復與傷害的花瓣領域。' },
  thunder: { id: 'thunder', type: 'active', name: '雷霆落雷', short: '落雷', icon: '⚡', color: '#5c84e8', price: 26, cd: 4.8,  mana: 12, shape: [[0,0],[0,1],[1,1],[1,2]], desc: '自天穹召喚多道連鎖雷霆劈擊附近敵人，施加感電（易傷 +25%）。' },
  quakeg:  { id: 'quakeg',  type: 'active', name: '星晶震盪', short: '星震', icon: '🗿', color: '#64a89e', price: 28, cd: 6.2,  mana: 14, shape: [[0,0],[1,0],[0,1],[1,1]], desc: '召喚星晶巨像之力連續重擊地面 2 波，大幅擊退並暈眩群敵。' },
  // Phase V4：10 顆全新 3D 召喚／招牌主動寶石（Piloto Studio 四大技能包實機網格！）
  paladin_sword:   { id: 'paladin_sword',   type: 'active', name: '聖劍天降', short: '聖劍', icon: '⚔️', color: '#f2b830', price: 26, cd: 5.2, mana: 11, shape: [[0,0],[0,1],[0,2]], desc: '召喚巨型 3D 聖光英雄劍從天垂直插地，引發聖環震波並暈眩周圍敵人。' },
  fire_whale:      { id: 'fire_whale',      type: 'active', name: '熾炎巨鯨', short: '火鯨', icon: '🐋', color: '#e85a2a', price: 34, cd: 7.2, mana: 16, shape: [[0,0],[1,0],[2,0],[1,1]], desc: '召喚 3D 火焰巨鯨自地面破土躍擊重砸目標區域，留下大片熔岩火海！' },
  thunder_phoenix: { id: 'thunder_phoenix', type: 'active', name: '雷霆鳳凰', short: '雷鳳', icon: '🦅', color: '#5698f0', price: 34, cd: 6.8, mana: 15, shape: [[1,0],[0,1],[1,1],[2,1]], desc: '召喚 3D 雷霆巨鳳展翅向前貫穿衝鋒，沿途劈落連鎖感電雷弧！' },
  dark_wolf:       { id: 'dark_wolf',       type: 'active', name: '暗影巨狼', short: '冥狼', icon: '🐺', color: '#8a3ec8', price: 32, cd: 6.0, mana: 13, shape: [[0,0],[1,0],[1,1]], desc: '召喚 3D 冥界巨狼破影猛咬目標區域，重創敵人並施加 6 秒易傷（+30%）。' },
  healing_tree:    { id: 'healing_tree',    type: 'active', name: '繁花聖樹', short: '聖樹', icon: '🌳', color: '#52b868', price: 28, cd: 9.0, mana: 14, shape: [[0,0],[1,0],[0,1]], desc: '種下 3D 綻放花樹 6.5 秒，持續治療範圍內友軍、驅散異常並緩速敵人！' },
  black_hole:      { id: 'black_hole',      type: 'active', name: '星域黑洞', short: '黑洞', icon: '🕳️', color: '#7848d8', price: 32, cd: 7.5, mana: 15, shape: [[0,0],[1,0],[0,1],[1,1]], desc: '展開 3D 重力黑洞持續向心牽引周圍怪海，結束時引爆空間震波！' },
  blue_tornado:    { id: 'blue_tornado',    type: 'active', name: '幽藍龍捲', short: '藍捲', icon: '🌪️', color: '#2ea8e8', price: 28, cd: 5.8, mana: 12, shape: [[0,0],[0,1],[1,1]], desc: '召喚 3D 幽藍魂火龍捲向前捲起敵群，與水窪／毒霧連攜可觸發廣域元素反應！' },
  spear_cage:      { id: 'spear_cage',      type: 'active', name: '雷槍聖牢', short: '雷牢', icon: '🔱', color: '#4c88e0', price: 30, cd: 6.5, mana: 13, shape: [[0,0],[1,0],[0,1],[1,1]], desc: '召喚 8 根 3D 騎士雷槍環形插地困住敵群並持續感電傷害！' },
  sword_beams:     { id: 'sword_beams',     type: 'active', name: '附魔劍氣', short: '劍氣', icon: '🌙', color: '#d85898', price: 24, cd: 3.8, mana: 9,  shape: [[0,0],[1,0],[2,0]], desc: '揮出三道穿透 3D 月牙附魔劍氣波，專精高速直線清掃怪海。' },
  candle_ward:     { id: 'candle_ward',     type: 'active', name: '魂火燭陣', short: '燭陣', icon: '🕯️', color: '#38b8d8', price: 26, cd: 8.5, mana: 10, shape: [[0,0],[1,0]], desc: '展開 6 支 3D 幽藍蠟燭法陣 6 秒，站於陣內持續回血回魔並灼燒踏入敵人！' },
  ...NEW_ACTIVE_GEMS,
};

export const SUPPORT_GEMS = {
  multi: { id: 'multi', type: 'support', name: '多重投射', short: '多重', icon: '⇶', color: '#c4843d', price: 15, shape: [[0,0],[0,1],[1,1]], desc: '適用投射物、螢火護衛或箭雨，增加一發或一波，傷害 -12%。' },
  echo:  { id: 'echo',  type: 'support', name: '連發迴響', short: '連發', icon: '⟳', color: '#7a5cc4', price: 18, shape: [[0,0],[1,0],[2,0]], desc: '相鄰攻擊技能延後重施一次（35% 傷害），耗魔 +22%。' },
  area:  { id: 'area',  type: 'support', name: '擴大範圍', short: '擴域', icon: '◎', color: '#3f9688', price: 14, shape: [[0,0],[1,0]], desc: '相鄰主動技能作用範圍 +35%。' },
  ember: { id: 'ember', type: 'support', name: '熾炎增幅', short: '熾炎', icon: '✴', color: '#d9543a', price: 14, shape: [[0,0]], desc: '相鄰技能傷害 +9%，並附加火焰。' },
  chain: { id: 'chain', type: 'support', name: '連鎖跳躍', short: '連鎖', icon: '⚡', color: '#4f7ed6', price: 16, shape: [[0,0],[1,0],[1,1],[2,1]], desc: '相鄰投射物命中後額外彈跳 +2 個目標，附短暫感電，傷害 -8%。' },
  haste: { id: 'haste', type: 'support', name: '極速詠唱', short: '極速', icon: '⏩', color: '#58a858', price: 13, shape: [[0,0]], desc: '相鄰主動技能冷卻時間縮減 8%。' },
  frost: { id: 'frost', type: 'support', name: '霜緩附魔', short: '霜緩', icon: '❄', color: '#5aa0e0', price: 14, shape: [[0,0],[1,0]], desc: '相鄰主動技能命中時緩速敵人 45%。' },
  leech: { id: 'leech', type: 'support', name: '生命汲取', short: '汲血', icon: '♥', color: '#c84862', price: 14, shape: [[0,0]], desc: '相鄰主動技能命中回復 4 點生命，汲血每秒最多觸發一次。' },
  vamp:  { id: 'vamp',  type: 'support', name: '血月汲取', short: '血月', icon: '🩸', color: '#a8324c', price: 20, shape: [[0,0],[0,1]], desc: '相鄰主動技能傷害 +6%，命中回復 5 點生命，汲血每秒最多觸發一次。' },
  storm: { id: 'storm', type: 'support', name: '雷鳴連鎖', short: '雷鳴', icon: '🌩', color: '#4a6cd8', price: 20, shape: [[0,0],[1,0]], desc: '相鄰主動技能附加感電（+25% 易傷）且額外連鎖 +1 目標。' },
  split: { id: 'split', type: 'support', name: '分裂稜鏡', short: '分裂', icon: '⑂',  color: '#e88c38', price: 22, shape: [[0,0],[1,0],[0,1]], desc: '相鄰投射物命中目標時向四周分裂出 3 枚低傷次級火花，技能傷害 -10%。' },
  coh:   { id: 'coh',   type: 'support', name: '命中觸發器', short: '命中觸發', icon: '🔗', color: '#b85cf0', price: 26, shape: [[0,0],[1,0]], desc: '【邏輯電路】橋接兩顆主動技能：前招命中時自動觸發相鄰另一招（消耗 65% 法力，與其他觸發共用間隔，技能本身至少冷卻 1.25 秒）。' },
  coc:   { id: 'coc',   type: 'support', name: '暴擊觸發器', short: '暴擊觸發', icon: '💥', color: '#f04878', price: 28, shape: [[0,0],[0,1]], desc: '【邏輯電路】橋接兩顆主動技能：暴擊時自動觸發相鄰另一招（消耗 65% 法力，與其他觸發共用間隔，技能本身至少冷卻 1.25 秒）。' },
  orbit:    { id: 'orbit',    type: 'support', name: '環繞軌道核',   short: '軌道', icon: '🪐', color: '#3ec6d8', price: 24, shape: [[0,0],[1,0]], desc: '【魔杖改造】相鄰投射物改為環繞角色高速旋轉的軌道切割彈幕！' },
  bluefire: { id: 'bluefire', type: 'support', name: '幽藍魂火轉化', short: '藍火', icon: '🔵', color: '#2a98f0', price: 22, shape: [[0,0]], desc: '【視覺演化】將相鄰主動技能轉化為幽藍魂火特效，耗魔 -12% 且傷害 +5%！' },
  vortex:   { id: 'vortex',   type: 'support', name: '聚能引力核',   short: '聚怪', icon: '🌀', color: '#8a5cf0', price: 24, shape: [[0,0],[0,1]], desc: '【視覺演化】相鄰範圍技能命中時產生向心引力，將周圍怪海拉向中心！' },
  sv_ember_core:  { id: 'sv_ember_core',  type: 'support', name: '餘燼火種核', short: '火種核', icon: '☄️', color: '#ff6a30', price: 32, shape: [[0,0],[1,0]], desc: '【倖存者聯動】裝備於拼盤時，狂潮開局自帶 Lv.2 餘燼飛彈且超武傷害 +25%！' },
  sv_resonance:   { id: 'sv_resonance',   type: 'support', name: '超武共鳴核', short: '共鳴核', icon: '🌟', color: '#ffd85a', price: 36, shape: [[0,0],[0,1]], desc: '【倖存者聯動】裝備於拼盤時，擁有至少 2 把超武時觸發星穹共鳴（暴傷 +40%、冷卻 -15%）！' },
  sv_magnet_core: { id: 'sv_magnet_core', type: 'support', name: '貪婪星磁核', short: '星磁核', icon: '🧲', color: '#c87aff', price: 34, shape: [[0,0]], desc: '【倖存者聯動】裝備於拼盤時，狂潮開局自帶 Lv.1 貪婪金杯與星磁懷錶！' },
  ...NEW_SUPPORT_GEMS,
};

export const ALL_GEMS = { ...ACTIVE_GEMS, ...SUPPORT_GEMS };
const LEGACY_LEVELS = {
  meteor: 5, nova: 5, prism: 6, phantom: 6, thunder: 6, quakeg: 8,
  fire_whale: 10, thunder_phoenix: 10, dark_wolf: 10, healing_tree: 7, black_hole: 10,
  blue_tornado: 7, spear_cage: 8, sword_beams: 6, candle_ward: 7,
  echo: 6, split: 6, orbit: 6, vortex: 7, coh: 8, coc: 12,
};

export function gemLevel(id) {
  return ALL_GEMS[id]?.level ?? LEGACY_LEVELS[id] ?? 1;
}

export function supportLimit(level) {
  return level >= 20 ? 4 : level >= 12 ? 3 : level >= 6 ? 2 : 1;
}

function activeLimit(level) {
  return level >= 12 ? 4 : level >= 6 ? 3 : 2;
}

const TRIGGER_IDS = new Set(['coh', 'coc']);
const LEGACY_TAGS = {
  bolt: ['projectile'], sword_beams: ['projectile'],
  slam: ['area'], rain: ['area'], trap: ['area'], whirl: ['area'], mark: ['area'],
  meteor: ['area'], nova: ['area'], prism: ['area'], phantom: ['area'], sakura: ['area'],
  thunder: ['area'], quakeg: ['area'], paladin_sword: ['area'], fire_whale: ['area'],
  thunder_phoenix: ['area'], dark_wolf: ['area'], healing_tree: ['area'],
  black_hole: ['area'], blue_tornado: ['area'], spear_cage: ['area'], candle_ward: ['area'],
};

function supportsSkill(support, skill) {
  const tags = skill.tags || LEGACY_TAGS[skill.id] || [];
  if (support.tag === 'impact') return skill.family === 'impact' || skill.family === 'pulse' || skill.family === 'trail';
  if (support.tag) return tags.includes(support.tag);
  if (support.id === 'multi') return tags.includes('projectile') || ['rain', 'wisp'].includes(skill.id);
  if (['chain', 'split', 'orbit'].includes(support.id)) return tags.includes('projectile');
  if (support.id === 'area') return tags.includes('area') || tags.includes('projectile');
  if (support.id === 'vortex') return tags.includes('area');
  if (support.id === 'echo') return !['dash', 'ward'].includes(skill.family) && !['healing_tree', 'candle_ward'].includes(skill.id);
  return !support.id.startsWith('sv_');
}

export function pickGemDrop({ playerLevel = 1, enemyLevel = 1, boss = false, rng = Math.random } = {}) {
  const maxLevel = Math.min(playerLevel + (boss ? 3 : 1), enemyLevel + (boss ? 4 : 2));
  const available = Object.keys(ALL_GEMS).filter(id => gemLevel(id) <= maxLevel);
  const recent = available.filter(id => gemLevel(id) >= Math.max(1, maxLevel - 7));
  const pool = recent.length && rng() < 0.65 ? recent : available;
  return pool[Math.floor(rng() * pool.length)];
}

// 6×6 棋盤由中央 4×4（16 格）螺旋向外解鎖至全 36 格
export const SPIRAL_ORDER = [
  [2,2],[3,2],[3,3],[2,3],[1,3],[1,2],[1,1],[2,1],[3,1],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],
  [0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5],[1,5],[0,5],
];

export function unlockedCount(level = 1) {
  return Math.min(36, 16 + Math.floor(Math.max(1, level) / 1.4));
}

export function unlockedSet(level = 1) {
  const n = unlockedCount(level);
  const set = new Set();
  for (let i = 0; i < n; i++) set.add(SPIRAL_ORDER[i][0] + ',' + SPIRAL_ORDER[i][1]);
  return set;
}

export function rotateCells(shape, rot = 0) {
  let pts = shape.map(([x, y]) => [x, y]);
  const turns = ((rot % 4) + 4) % 4;
  for (let t = 0; t < turns; t++) pts = pts.map(([x, y]) => [-y, x]);
  const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
  return pts.map(([x, y]) => [x - minX, y - minY]);
}

export function defaultPuzzle(classId = 0) {
  const cls = CLASSES[classId] || CLASSES[0];
  let uid = 1;
  // 硬核循序成長：Lv.1 僅攜帶 1 顆職業基礎主動技，0 顆輔助寶石、背包 0 顆免費贈送；其餘技能皆需透過討伐精英／首領、委託或購買取得！
  const firstActive = cls.starter[0] || { id: 'bolt', x: 1, y: 1, rot: 0 };
  const placed = [{ uid: uid++, id: firstActive.id, x: firstActive.x, y: firstActive.y, rot: firstActive.rot || 0 }];
  return {
    activePreset: 0,
    nextUid: uid,
    presets: [placed, [], []],
    bag: [],
    initializedClass: cls.id,
  };
}

export function ensurePuzzle(profile, classId = 0) {
  if (!profile.puzzle || !Array.isArray(profile.puzzle.presets)) {
    profile.puzzle = defaultPuzzle(classId);
  }
  const puzzle = profile.puzzle;
  for (let i = 0; i < 3; i++) if (!Array.isArray(puzzle.presets[i])) puzzle.presets[i] = [];
  if (!Number.isInteger(puzzle.activePreset) || !Array.isArray(puzzle.presets[puzzle.activePreset])) {
    puzzle.activePreset = 0;
  }
  if (!Array.isArray(puzzle.bag)) puzzle.bag = [];
  if (!profile.puzzle.nextUid) profile.puzzle.nextUid = 100;
  if (!('partyGem' in profile.puzzle)) profile.puzzle.partyGem = null;
  return profile.puzzle;
}

export function addGemToBag(profile, gemId) {
  const pz = ensurePuzzle(profile, 0);
  if (!ALL_GEMS[gemId]) return null;
  const entry = { uid: pz.nextUid++, id: gemId, rot: 0 };
  pz.bag.push(entry);
  return entry;
}

export function occupiedMap(placed) {
  const map = new Map();
  for (const item of placed) {
    const def = ALL_GEMS[item.id];
    if (!def) continue;
    for (const [dx, dy] of rotateCells(def.shape, item.rot)) {
      map.set((item.x + dx) + ',' + (item.y + dy), item);
    }
  }
  return map;
}

export function canPlace(placed, gemId, x, y, rot, level = 1, ignoreUid = null) {
  const def = ALL_GEMS[gemId];
  if (!def) return false;
  const open = unlockedSet(level);
  const occ = occupiedMap(placed.filter(p => p.uid !== ignoreUid));
  for (const [dx, dy] of rotateCells(def.shape, rot)) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return false;
    const key = cx + ',' + cy;
    if (!open.has(key) || occ.has(key)) return false;
  }
  return true;
}

// 計算棋盤上所有主動技能與相鄰（上下左右邊相連）的輔助寶石加成與邏輯電路觸發鏈
// Phase M4B：支援 partyGemId（小隊羈絆插座，自動共享給全盤主動技能與同隊隊友）
export function computeBoard(placed, partyGemId = null, level = 30) {
  const actives = new Set();
  placed = placed.filter(item => {
    if (gemLevel(item.id) > level) return false;
    if (!ACTIVE_GEMS[item.id]) return true;
    if (actives.size >= activeLimit(level) || actives.has(item.id)) return false;
    actives.add(item.id);
    return true;
  });
  const occ = occupiedMap(placed);
  const partySup = SUPPORT_GEMS[partyGemId] && !TRIGGER_IDS.has(partyGemId) && gemLevel(partyGemId) <= level
    ? SUPPORT_GEMS[partyGemId] : null;
  const supportToActives = new Map();
  for (const item of placed) {
    if (!SUPPORT_GEMS[item.id]) continue;
    const actSet = new Set();
    for (const [dx, dy] of rotateCells(SUPPORT_GEMS[item.id].shape, item.rot)) {
      const cx = item.x + dx, cy = item.y + dy;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        const nb = occ.get(nx + ',' + ny);
        if (nb && ACTIVE_GEMS[nb.id]) actSet.add(nb.id);
      }
    }
    supportToActives.set(item.uid, [...actSet]);
  }
  const skills = [];
  for (const item of placed) {
    const def = ACTIVE_GEMS[item.id];
    if (!def) continue;
    const linkedFamilies = new Set();
    const linkedUids = [];
    const linkedDefs = [];
    const triggerOnHit = new Set();
    const triggerOnCrit = new Set();
    for (const [dx, dy] of rotateCells(def.shape, item.rot)) {
      const cx = item.x + dx, cy = item.y + dy;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        const nb = occ.get(nx + ',' + ny);
        const support = SUPPORT_GEMS[nb?.id];
        if (!support || !supportsSkill(support, def)) continue;
        const family = support.family || support.id;
        if (linkedFamilies.has(family) || linkedDefs.length >= supportLimit(level)) continue;
        if (TRIGGER_IDS.has(nb.id)) {
          const receivers = (supportToActives.get(nb.uid) || []).filter(otherId => otherId !== def.id);
          if (!receivers.length) continue;
          const targets = nb.id === 'coh' ? triggerOnHit : triggerOnCrit;
          for (const target of receivers) targets.add(target);
        }
        linkedFamilies.add(family);
        linkedUids.push(nb.uid);
        linkedDefs.push(support);
      }
    }
    const shared = partySup && linkedDefs.length < supportLimit(level) &&
      !linkedFamilies.has(partySup.family || partySup.id) && supportsSkill(partySup, def) ? partySup : null;
    if (shared) linkedDefs.push(shared);
    const mod = {
      multi: 0, echo: 0, area: 0, dmgMult: 1, fire: def.id === 'bolt', chain: 0, cdr: 0, frost: 0, leech: 0, shock: 0,
      split: false, orbit: false, bluefire: false, vortex: false, vfxTheme: null,
      partyShared: shared?.id || null, mana: 0, reach: 0, spread: 0, speed: 0, duration: 0, pierce: 0, slow: 0, heal: 0, stun: 0,
      triggerOnHit: [...triggerOnHit], triggerOnCrit: [...triggerOnCrit],
      supports: linkedDefs, supportUids: linkedUids,
    };
    for (const s of linkedDefs) {
      if (s.effects) {
        const { power = 0, radius = 0, extra = 0, ...effects } = s.effects;
        mod.dmgMult += power;
        mod.area += radius;
        mod.multi += extra;
        for (const [key, value] of Object.entries(effects)) mod[key] += value;
        continue;
      }
      if (s.id === 'multi') { mod.multi += 1; mod.dmgMult -= 0.12; }
      if (s.id === 'echo') { mod.echo = 1; mod.mana += 0.22; }
      if (s.id === 'area') mod.area += 0.35;
      if (s.id === 'ember') { mod.dmgMult = +(mod.dmgMult + 0.09).toFixed(2); mod.fire = true; }
      if (s.id === 'chain') { mod.chain += 2; mod.dmgMult = +(mod.dmgMult - 0.08).toFixed(2); mod.shock += 2.5; }
      if (s.id === 'haste') mod.cdr = Math.min(0.6, +(mod.cdr + 0.08).toFixed(2));
      if (s.id === 'frost') mod.frost += 1;
      if (s.id === 'leech') mod.leech += 4;
      if (s.id === 'vamp') { mod.dmgMult = +(mod.dmgMult + 0.06).toFixed(2); mod.leech += 5; }
      if (s.id === 'storm') { mod.shock += 4.5; mod.chain += 1; }
      if (s.id === 'split') { mod.split = true; mod.dmgMult = +(mod.dmgMult - 0.10).toFixed(2); }
      if (s.id === 'orbit') mod.orbit = true;
      if (s.id === 'bluefire') { mod.bluefire = true; mod.dmgMult = +(mod.dmgMult + 0.05).toFixed(2); mod.fire = true; }
      if (s.id === 'vortex') { mod.vortex = true; mod.area += 0.15; }
    }
    mod.dmgMult = +Math.min(1.30, Math.max(0.45, mod.dmgMult)).toFixed(3);
    mod.cdr = Math.min(0.24, mod.cdr);
    mod.leech = Math.min(6, mod.leech);
    mod.chain = Math.min(2, mod.chain);
    mod.multi = Math.min(2, mod.multi);
    // 輔助寶石視覺變異主題（優先序：幽藍魂火 > 雷鳴 > 霜緩 > 熾炎）
    mod.vfxTheme = mod.bluefire ? 'bluefire' : mod.shock > 0 ? 'thunder' : mod.frost > 0 ? 'frost' : (mod.fire && def.id !== 'bolt') ? 'fire' : null;
    const chainTags = [];
    if (shared) chainTags.push(`🤝羈絆:${shared.short}`);
    if (mod.bluefire) chainTags.push('🔵藍火');
    if (mod.vortex) chainTags.push('🌀聚怪');
    if (mod.split) chainTags.push('分裂');
    if (mod.chain) chainTags.push(`連鎖+${mod.chain}`);
    if (mod.orbit) chainTags.push('軌道');
    for (const tid of mod.triggerOnHit) chainTags.push(`命中觸發→${ACTIVE_GEMS[tid]?.short || tid}`);
    for (const tid of mod.triggerOnCrit) chainTags.push(`暴擊觸發→${ACTIVE_GEMS[tid]?.short || tid}`);
    mod.circuitLabel = chainTags.length ? `${def.icon}${def.short} [${chainTags.join(' + ')}]` : `${def.icon}${def.short}`;
    skills.push({ uid: item.uid, id: def.id, def, mod });
  }
  return skills;
}

// Propose a fit for one support gem. Existing pieces and other presets stay in place.
export function suggestSupportFit(profile, gemId) {
  const puzzle = profile.puzzle;
  const placed = puzzle?.presets[puzzle.activePreset];
  if (!placed?.length || !SUPPORT_GEMS[gemId] || gemLevel(gemId) > (profile.level || 1)) return null;
  const occupied = occupiedMap(placed);
  const level = profile.level || 1;
  const current = computeBoard(placed, puzzle.partyGem?.id, level);
  const eligible = new Set(current.filter(skill => skill.mod.supports.length < supportLimit(level) &&
    !skill.mod.supports.some(support => (support.family || support.id) === (SUPPORT_GEMS[gemId].family || gemId)))
    .map(skill => skill.uid));
  let best = null;
  for (let rot = 0; rot < 4; rot++) {
    const cells = rotateCells(SUPPORT_GEMS[gemId].shape, rot);
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      if (!canPlace(placed, gemId, x, y, rot, level)) continue;
      const linked = new Map();
      for (const [dx, dy] of cells) {
        const cx = x + dx, cy = y + dy;
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          const item = occupied.get(nx + ',' + ny);
          if (item && ACTIVE_GEMS[item.id] && eligible.has(item.uid) && supportsSkill(SUPPORT_GEMS[gemId], ACTIVE_GEMS[item.id])) linked.set(item.uid, ACTIVE_GEMS[item.id].name);
        }
      }
      if (linked.size && linked.size > (best?.skills.length || 0)) best = { x, y, rot, skills: [...linked.values()] };
    }
  }
  return best;
}

export function linkedSupportSkills(profile, uid) {
  const puzzle = profile.puzzle;
  const placed = puzzle?.presets?.[puzzle.activePreset];
  const support = placed?.find(item => item.uid === uid);
  const def = SUPPORT_GEMS[support?.id];
  if (!def) return [];
  return computeBoard(placed, puzzle.partyGem?.id, profile.level || 1)
    .filter(skill => skill.mod.supportUids.includes(uid)).map(skill => skill.def.name);
}

export function applySupportFit(profile, uid) {
  const puzzle = profile.puzzle;
  const index = puzzle?.bag.findIndex(gem => gem.uid === uid) ?? -1;
  if (index < 0) return null;
  const entry = puzzle.bag[index];
  const fit = suggestSupportFit(profile, entry.id);
  if (!fit) return null;
  const { x, y, rot } = fit;
  puzzle.presets[puzzle.activePreset].push({ ...entry, x, y, rot });
  puzzle.bag.splice(index, 1);
  return fit;
}

// 一鍵推薦構築：自動將現有棋盤＋背包寶石以最高邏輯電路與輔助相鄰度排入解鎖格
export function autoBuildBoard(placed = [], bag = [], level = 1) {
  const pool = [...new Map([...placed, ...bag].map(item => [item.uid, item])).values()];
  const seenIds = new Set();
  const candidates = pool.filter(gem => {
    if (!ALL_GEMS[gem.id] || gemLevel(gem.id) > level || seenIds.has(gem.id)) return false;
    seenIds.add(gem.id);
    return true;
  });
  const SUP_PRIO = ['split', 'orbit', 'multi', 'chain', 'storm', 'ember', 'echo', 'area', 'vamp', 'haste', 'frost', 'leech'];
  const actives = candidates.filter(gem => ACTIVE_GEMS[gem.id]);
  const bridges = candidates.filter(g => TRIGGER_IDS.has(g.id)).slice(0, actives.length >= 2 ? 1 : 0);
  const supports = candidates.filter(g => SUPPORT_GEMS[g.id] && !TRIGGER_IDS.has(g.id))
    .sort((a, b) => (SUP_PRIO.indexOf(a.id) === -1 ? 99 : SUP_PRIO.indexOf(a.id)) - (SUP_PRIO.indexOf(b.id) === -1 ? 99 : SUP_PRIO.indexOf(b.id)));
  const nextPlaced = [];
  const used = new Set();

  const placeBest = (gem, scoreFn) => {
    let best = null, bestScore = -Infinity;
    for (let rot = 0; rot < 4; rot++) {
      for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
        if (!canPlace(nextPlaced, gem.id, x, y, rot, level)) continue;
        const sc = scoreFn(x, y, rot);
        if (sc > bestScore) { bestScore = sc; best = { uid: gem.uid, id: gem.id, x, y, rot }; }
      }
    }
    if (best && Number.isFinite(bestScore)) { nextPlaced.push(best); used.add(gem.uid); return true; }
    return false;
  };

  const adjCount = (gemId, x, y, rot, pred) => {
    const occ = occupiedMap(nextPlaced);
    const seen = new Set();
    for (const [dx, dy] of rotateCells(ALL_GEMS[gemId].shape, rot)) {
      for (const [nx, ny] of [[x + dx + 1, y + dy], [x + dx - 1, y + dy], [x + dx, y + dy + 1], [x + dx, y + dy - 1]]) {
        const nb = occ.get(nx + ',' + ny);
        if (nb && pred(nb)) seen.add(nb.uid);
      }
    }
    return seen.size;
  };

  if (actives[0]) {
    placeBest(actives[0], (x, y) => -Math.hypot(x - 2, y - 2));
  }
  for (const br of bridges) {
    placeBest(br, (x, y, rot) => adjCount(br.id, x, y, rot, nb => !!ACTIVE_GEMS[nb.id]) * 10 - Math.hypot(x - 2, y - 2));
  }
  for (const act of actives.slice(1, activeLimit(level))) {
    placeBest(act, (x, y, rot) => adjCount(act.id, x, y, rot, nb => TRIGGER_IDS.has(nb.id)) * 15 - Math.hypot(x - 2, y - 2));
  }
  const activeLinks = computeBoard(nextPlaced, null, level);
  if (bridges[0] && !activeLinks.some(skill => skill.mod.supportUids.includes(bridges[0].uid))) {
    const index = nextPlaced.findIndex(item => item.uid === bridges[0].uid);
    if (index >= 0) nextPlaced.splice(index, 1);
    used.delete(bridges[0].uid);
  }
  const occupiedSlots = new Set(activeLinks.filter(skill => skill.mod.supports.length < supportLimit(level)).map(skill => skill.uid));
  for (const sup of supports) {
    if (!occupiedSlots.size) break;
    placeBest(sup, (x, y, rot) => {
      const a = adjCount(sup.id, x, y, rot, nb => occupiedSlots.has(nb.uid) && supportsSkill(SUPPORT_GEMS[sup.id], ACTIVE_GEMS[nb.id]));
      if (!a) return -Infinity;
      const proposal = [...nextPlaced, { ...sup, x, y, rot }];
      const links = computeBoard(proposal, null, level).filter(skill =>
        skill.mod.supports.some(support => support.id === sup.id)).length;
      return links ? links * 12 - Math.hypot(x - 2.5, y - 2.5) : -Infinity;
    });
    for (const skill of computeBoard(nextPlaced, null, level)) {
      if (skill.mod.supports.length >= supportLimit(level)) occupiedSlots.delete(skill.uid);
    }
  }
  const leftover = pool.filter(g => !used.has(g.uid)).map(({ uid, id, rot }) => ({ uid, id, rot: rot || 0 }));
  return { placed: nextPlaced, bag: leftover };
}

export function skillManaCost(def, mod) {
  return Math.round((def.mana || 0) * Math.max(0.60, 1 + mod.mana - (mod.bluefire ? 0.12 : 0)));
}

export function skillCooldown(def, mod, pace, cdr, overload = false) {
  return Math.max(0.12, def.cd * pace.cooldown * (1 - cdr / 100) * (1 - mod.cdr) * (overload ? 0.92 : 1));
}

export function bindPuzzleUI(g) {
  const modal = document.getElementById('puzzleM');
  if (!modal) return;
  const panel = modal.querySelector('.pzp');
  const grid = modal.querySelector('.pz-grid');
  const bag = modal.querySelector('.pz-bag');
  const shop = modal.querySelector('.pz-shop');
  const search = modal.querySelector('#pzSearch');
  const clearSearch = modal.querySelector('#pzSearchClear');
  const presets = modal.querySelector('.pz-presets');
  const detail = modal.querySelector('.pz-info');
  const feedback = modal.querySelector('.pz-feedback');
  const party = modal.querySelector('#pzPartySlot');
  const rotate = modal.querySelector('#pzRotate');
  const take = modal.querySelector('#pzTake');
  const pack = modal.querySelector('#pzAuto');
  const clear = modal.querySelector('#pzClear');
  const ghost = modal.querySelector('.pz-drag-ghost');
  const level = () => g.meta.p.level || 1;
  const puzzle = () => ensurePuzzle(g.meta.p, g.character?.job ?? 0);
  const board = () => puzzle().presets[puzzle().activePreset];
  const cells = new Map();
  const origins = new WeakMap();
  let selected = null;
  let pointer = null;
  let suppressClick = false;
  let tab = 'bag';
  let filter = 'all';
  let previewKey = '';
  let hoverCell = null;
  let inspected = null;
  let composing = false;
  let scrollFrame = 0;

  function report(message, tone = '') {
    if (feedback.textContent !== message) feedback.textContent = message;
    feedback.dataset.tone = tone;
  }

  function inspect(item, links = []) {
    const gem = ALL_GEMS[item?.id];
    detail.replaceChildren();
    if (!gem) {
      detail.textContent = '拖曳寶石形狀，或點選寶石後點棋盤。';
      return;
    }
    const name = document.createElement('strong');
    name.textContent = `${gem.icon} ${gem.name} · ${gem.type === 'active' ? '主動' : '輔助'} · Lv.${gemLevel(gem.id)}`;
    const note = document.createElement('span');
    note.textContent = links.length ? `${gem.desc}　連動 ${links.join('、')}` : gem.desc;
    detail.append(name, note);
  }

  function updateSelection() {
    document.body.classList.toggle('holding-gem', !!selected);
    rotate.disabled = !selected;
    take.disabled = !selected;
    grid.classList.toggle('holding', !!selected);
    for (const element of modal.querySelectorAll('[data-gem-uid]')) {
      const picked = origins.get(element)?.uid === selected?.uid &&
        origins.get(element)?.source === selected?.source;
      element.classList.toggle('pz-picked', picked);
      if (element.classList.contains('pz-gem') || element === party) element.setAttribute('aria-pressed', String(picked));
    }
    inspect(selected || inspected, selected ? [] : inspected?.links);
  }

  function clearPreview() {
    for (const cell of grid.querySelectorAll('.preview-ok,.preview-bad')) cell.classList.remove('preview-ok', 'preview-bad');
    grid.classList.remove('invalid-drop');
    party.classList.remove('preview-ok', 'preview-bad');
    previewKey = '';
  }

  function allowedOnBoard(item, x, y) {
    return gemLevel(item.id) <= level() &&
      canPlace(board(), item.id, x, y, item.rot, level(), item.source === 'board' ? item.uid : null);
  }

  function allowedInParty(item) {
    return !!SUPPORT_GEMS[item.id] && !TRIGGER_IDS.has(item.id) && gemLevel(item.id) <= level();
  }

  function preview(destination) {
    if (!selected || !destination) { clearPreview(); return; }
    const { kind, x, y } = destination;
    const key = `${kind}:${x},${y}:${selected.rot}`;
    if (key === previewKey) return;
    clearPreview();
    previewKey = key;
    if (kind === 'board') {
      const works = allowedOnBoard(selected, x, y);
      grid.classList.toggle('invalid-drop', !works);
      for (const [dx, dy] of rotateCells(ALL_GEMS[selected.id].shape, selected.rot)) {
        cells.get(`${x + dx},${y + dy}`)?.classList.add(works ? 'preview-ok' : 'preview-bad');
      }
      if (pointer?.dragging) report(works ? '鬆開放入棋盤' : '此處放不下，鬆開會回到原位', works ? 'ok' : 'error');
    } else if (kind === 'party') {
      const works = allowedInParty(selected);
      party.classList.add(works ? 'preview-ok' : 'preview-bad');
      if (pointer?.dragging) report(works ? '鬆開鑲嵌到小隊羈絆' : '這顆寶石無法鑲嵌到小隊羈絆', works ? 'ok' : 'error');
    } else if (pointer?.dragging) {
      report('鬆開放回背包');
    }
  }

  function select(origin, grabX = 0, grabY = 0) {
    selected = { ...origin, grabX, grabY };
    inspected = null;
    clearPreview();
    updateSelection();
    report(`拿起 ${ALL_GEMS[selected.id].name}。選擇落點、旋轉或放回背包。`);
  }

  function cancel(message = '') {
    selected = null;
    clearPreview();
    ghost.hidden = true;
    updateSelection();
    if (message) report(message);
  }

  function place(destination, { fromDrag = false, keyboard = false } = {}) {
    if (!selected) return false;
    const { id, uid, source, rot, owner, preset } = selected;
    const name = ALL_GEMS[id].name;
    const pz = puzzle();
    if (owner !== pz || preset !== pz.activePreset) { cancel('構築已切換，已取消移動。'); return false; }
    const list = source === 'board' ? board() : pz.bag;
    const index = source === 'party' ? -1 : list.findIndex(item => item.uid === uid && item.id === id);
    if (source === 'party' ? pz.partyGem?.uid !== uid : index === -1) {
      cancel('這顆寶石的位置已更新，請重新選擇。');
      render();
      return false;
    }
    const { kind, x, y } = destination;
    if ((kind === 'board' && !allowedOnBoard(selected, x, y)) || (kind === 'party' && !allowedInParty(selected))) {
      if (fromDrag) cancel();
      report(kind === 'board' ? '此處無法放置，請試其他位置或旋轉寶石。' : '小隊羈絆只接受可用的一般輔助寶石。', 'error');
      return false;
    }
    if ((source === 'bag' && kind === 'bag') || (source === 'party' && kind === 'party')) {
      cancel(source === 'bag' ? `${name} 已在背包` : `${name} 已在小隊羈絆`);
      return true;
    }
    // Commit only after the entire piece has a valid destination. Moving inside
    // the board keeps its array position because that is also the hotbar order.
    if (source === 'board' && kind === 'board') {
      list[index] = { uid, id, x, y, rot };
    } else {
      if (source === 'party') pz.partyGem = null;
      else list.splice(index, 1);
      if (kind === 'party') {
        if (pz.partyGem) pz.bag.push({ ...pz.partyGem, rot: pz.partyGem.rot || 0 });
        pz.partyGem = { uid, id, rot };
      } else if (kind === 'board') {
        board().push({ uid, id, x, y, rot });
      } else {
        pz.bag.push({ uid, id, rot });
      }
    }
    selected = null;
    ghost.hidden = true;
    g.meta.save();
    g.recalc();
    g.audio.sfx(kind === 'bag' ? 'ui' : 'pickup');
    render();
    const destName = kind === 'board' ? `棋盤第 ${y + 1} 列、第 ${x + 1} 欄` : kind === 'party' ? '小隊羈絆' : '背包';
    report(`${name} 已放入${destName}`, 'ok');
    if (keyboard) {
      const cell = kind === 'board' ? grid.querySelector(`[data-gem-uid="${uid}"]`) : null;
      (cell || (kind === 'party' ? party : bag.querySelector(`[data-gem-uid="${uid}"]`)) || pack).focus({ preventScroll: true });
    }
    return true;
  }

  function makeShape(gem, rot = 0) {
    const offsets = rotateCells(gem.shape, rot);
    const shape = document.createElement('span');
    shape.className = `pz-mini ${gem.type}`;
    shape.setAttribute('aria-hidden', 'true');
    shape.style.setProperty('--gem-color', gem.color);
    shape.style.setProperty('--shape-columns', Math.max(...offsets.map(([x]) => x)) + 1);
    for (const [x, y] of offsets) {
      const tile = document.createElement('i');
      tile.style.gridArea = `${y + 1}/${x + 1}`;
      shape.append(tile);
    }
    return shape;
  }

  function destinationAt(x, y) {
    const target = document.elementFromPoint(x, y);
    const cell = target?.closest('.pz-cell');
    if (grid.contains(target)) {
      const first = cells.get('0,0').getBoundingClientRect();
      const step = cells.get('1,0').getBoundingClientRect().left - first.left;
      const snap = relative => Math.max(0, Math.min(GRID - 1, Math.round(relative / step)));
      const col = cell ? Number(cell.dataset.x) : snap(x - first.left - first.width / 2);
      const row = cell ? Number(cell.dataset.y) : snap(y - first.top - first.height / 2);
      return { kind: 'board', x: col - selected.grabX, y: row - selected.grabY };
    }
    if (target?.closest('#pzPartySlot') === party) return { kind: 'party' };
    return { kind: 'bag' };
  }

  function drawDrag({ clientX, clientY }) {
    const x = Math.min(clientX + 13, innerWidth - ghost.offsetWidth - 8);
    const y = Math.max(5, Math.min(clientY - ghost.offsetHeight - 10, innerHeight - ghost.offsetHeight - 8));
    ghost.style.transform = `translate3d(${x}px,${y}px,0)`;
    const destination = destinationAt(clientX, clientY);
    ghost.dataset.target = destination.kind;
    preview(destination);
  }

  function scrollDuringDrag() {
    scrollFrame = 0;
    if (!pointer?.dragging || !selected) return;
    const { clientX, clientY } = pointer.last;
    const { left, right, top, bottom } = panel.getBoundingClientRect();
    if (clientX >= left && clientX <= right) {
      const band = 35;
      const delta = clientY < top + band ? -7 : clientY > bottom - band ? 7 : 0;
      const previous = panel.scrollTop;
      if (delta) panel.scrollTop += delta;
      if (panel.scrollTop !== previous) drawDrag(pointer.last);
    }
    scrollFrame = requestAnimationFrame(scrollDuringDrag);
  }

  modal.addEventListener('pointerdown', event => {
    if (!g.ui.puzzleOpen || pointer || !event.isPrimary || event.button !== 0) return;
    const source = event.target.closest('[data-gem-uid]');
    const origin = origins.get(source);
    if (!origin || source.disabled) return;
    // On touch, the shape is the drag handle. The rest of the card can scroll.
    if (event.pointerType === 'touch' && origin.source === 'bag' && !event.target.closest('.pz-grip')) return;
    pointer = {
      id: event.pointerId, x: event.clientX, y: event.clientY, origin,
      grabX: origin.source === 'board' ? Number(source.dataset.x) - origin.x : 0,
      grabY: origin.source === 'board' ? Number(source.dataset.y) - origin.y : 0,
      dragging: false,
    };
  });

  window.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    pointer.last = { clientX: event.clientX, clientY: event.clientY };
    if (!pointer.dragging) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
      pointer.dragging = true;
      modal.setPointerCapture(event.pointerId);
      select(pointer.origin, pointer.grabX, pointer.grabY);
      ghost.replaceChildren(makeShape(ALL_GEMS[selected.id], selected.rot));
      ghost.hidden = false;
      scrollFrame = requestAnimationFrame(scrollDuringDrag);
    }
    if (event.cancelable) event.preventDefault();
    drawDrag(event);
  }, { passive: false });

  window.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    const dragging = pointer.dragging;
    pointer = null;
    if (!dragging || !selected) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (modal.hasPointerCapture(event.pointerId)) modal.releasePointerCapture(event.pointerId);
    cancelAnimationFrame(scrollFrame);
    place(destinationAt(event.clientX, event.clientY), { fromDrag: true });
  });

  function abortPointer(event) {
    if (pointer?.id !== event.pointerId) return;
    const dragging = pointer.dragging;
    pointer = null;
    if (dragging) {
      cancelAnimationFrame(scrollFrame);
      cancel('已取消拖曳，寶石留在原位。');
    }
  }

  window.addEventListener('pointercancel', abortPointer);
  modal.addEventListener('lostpointercapture', event => {
    // Touch first has implicit capture on the handle. Its bubbling loss during
    // transfer to the modal is normal; only losing the modal's capture cancels.
    if (event.target === modal) abortPointer(event);
  });
  window.addEventListener('blur', () => {
    if (!pointer) return;
    const id = pointer.id;
    abortPointer({ pointerId: id });
    if (modal.hasPointerCapture(id)) modal.releasePointerCapture(id);
  });
  modal.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);

  function render() {
    const pz = puzzle();
    const placed = board();
    const open = unlockedSet(level());
    const occ = occupiedMap(placed);
    const skills = computeBoard(placed, pz.partyGem?.id, level());
    const linkedBySkill = new Map(skills.map((skill, slot) => [skill.uid, { ...skill.mod, slot }]));
    const linkedSupports = new Set(skills.flatMap(skill => skill.mod.supportUids));
    const skillKeys = ['右鍵', 'Q', 'E', 'C'];
    const effectiveNames = new Map(skills.map(skill => [skill.uid, skill.mod.supports.map(support => support.name)]));
    for (const skill of skills) for (const uid of skill.mod.supportUids) {
      const links = effectiveNames.get(uid) || [];
      links.push(skill.def.name);
      effectiveNames.set(uid, links);
    }
    const origin = (item, source) => ({ ...item, source, owner: pz, preset: pz.activePreset });
    inspected = null;
    hoverCell = null;
    clearPreview();
    modal.querySelector('.pz-unlock').textContent = `${unlockedCount(level())}/36 格 · ${skills.length}/${activeLimit(level())} 招 · 每招最多 ${supportLimit(level())} 輔助`;
    modal.querySelector('.pz-coins').textContent = `🪙 ${g.meta.p.coins}`;

    modal.querySelector('.pz-equipped').textContent = skills.length
      ? skills.map((skill, slot) => `${skillKeys[slot]} ${skill.def.short}`).join('　·　')
      : '尚未配置主動技能';

    presets.replaceChildren();
    for (let i = 0; i < pz.presets.length; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn small' + (i === pz.activePreset ? ' on' : '');
      button.setAttribute('aria-pressed', String(i === pz.activePreset));
      button.textContent = `構築 ${i + 1}`;
      button.onclick = () => {
        cancel();
        pz.activePreset = i;
        g.meta.save();
        g.recalc();
        render();
        presets.children[i].focus({ preventScroll: true });
        report(`已切換至構築 ${i + 1}`);
      };
      presets.append(button);
    }

    const partyGem = ALL_GEMS[pz.partyGem?.id];
    party.classList.toggle('filled', !!partyGem);
    party.innerHTML = partyGem
      ? `<small>小隊羈絆</small><b>${partyGem.icon} ${partyGem.name}</b>`
      : '<small>小隊羈絆</small><b>＋ 放入輔助寶石</b>';
    party.style.setProperty('--gem-color', partyGem?.color || '#8aac9d');
    delete party.dataset.gemUid;
    if (partyGem) {
      party.dataset.gemUid = pz.partyGem.uid;
      origins.set(party, origin(pz.partyGem, 'party'));
    } else {
      origins.delete(party);
    }
    party.onclick = event => {
      if (selected && selected.source !== 'party') place({ kind: 'party' }, { keyboard: event.detail === 0 });
      else if (partyGem && !selected) select(origins.get(party));
      else if (selected) cancel('已取消移動。');
    };

    grid.replaceChildren();
    cells.clear();
    let firstFocus = true;
    const anchors = new Set();
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const key = `${x},${y}`;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'pz-cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cells.set(key, cell);
      const item = occ.get(key);
      const coords = `第 ${y + 1} 列、第 ${x + 1} 欄`;
      if (!open.has(key) && !item) {
        cell.classList.add('locked');
        cell.disabled = true;
        cell.setAttribute('aria-label', `${coords}，未解鎖`);
      } else if (item) {
        const gem = ALL_GEMS[item.id];
        const link = linkedBySkill.get(item.uid);
        const isAnchor = !anchors.has(item.uid);
        anchors.add(item.uid);
        cell.classList.add('filled', gem.type);
        cell.dataset.gemUid = item.uid;
        origins.set(cell, origin(item, 'board'));
        cell.style.setProperty('--gem-color', gem.color);
        cell.setAttribute('aria-label', `${coords}，${gem.name}，${gem.type === 'active' ? '主動' : '輔助'}`);
        if (isAnchor) {
          cell.innerHTML = `<span class="pz-glyph">${gem.icon}</span><span class="pz-gem-label">${gem.short}</span><span class="pz-type">${gem.type === 'active' ? (skillKeys[link?.slot] || '主') : linkedSupports.has(item.uid) ? '輔' : '◇'}</span>`;
        } else {
          cell.innerHTML = '<span class="pz-facet"></span>';
        }
        for (const [dx, dy, side] of [[1, 0, 'east'], [0, 1, 'south']]) {
          const next = occ.get(`${x + dx},${y + dy}`);
          if (!next) continue;
          if (next.uid === item.uid) {
            cell.classList.add(`join-${side}`);
            continue;
          }
          const active = ACTIVE_GEMS[item.id] ? item : next;
          const support = active === item ? next : item;
          if (!linkedBySkill.get(active.uid)?.supportUids.includes(support.uid)) continue;
          const edge = document.createElement('span');
          edge.className = `pz-link ${side}`;
          edge.dataset.support = support.id;
          cell.append(edge);
        }
      } else {
        cell.setAttribute('aria-label', `${coords}，空格`);
      }
      cell.tabIndex = !cell.disabled && firstFocus ? 0 : -1;
      if (!cell.disabled) firstFocus = false;
      cell.onclick = () => {
        if (selected) {
          place({ kind: 'board', x, y }, { keyboard: document.activeElement === cell });
        } else if (item) {
          select(origins.get(cell));
        }
      };
      const inspectCell = () => {
        hoverCell = { kind: 'board', x, y };
        if (selected && !pointer?.dragging) preview(hoverCell);
        if (!selected) {
          inspected = item ? { ...item, links: effectiveNames.get(item.uid) } : null;
          inspect(inspected, inspected?.links);
        }
      };
      cell.addEventListener('pointerenter', inspectCell);
      cell.addEventListener('focus', () => {
        const previous = grid.querySelector('.pz-cell[tabindex="0"]');
        if (previous && previous !== cell) previous.tabIndex = -1;
        cell.tabIndex = 0;
        inspectCell();
      });
      grid.append(cell);
    }

    modal.querySelectorAll('[data-pztab]').forEach(button => {
      button.classList.toggle('on', button.dataset.pztab === tab);
      button.setAttribute('aria-pressed', String(button.dataset.pztab === tab));
    });
    modal.querySelectorAll('[data-pzflt]').forEach(button => {
      button.classList.toggle('on', button.dataset.pzflt === filter);
      button.setAttribute('aria-pressed', String(button.dataset.pzflt === filter));
    });
    bag.hidden = tab !== 'bag';
    shop.hidden = tab !== 'shop';
    renderInventory();
    pack.disabled = !placed.length && !pz.bag.length;
    clear.disabled = !placed.length;
  }

  function renderInventory() {
    const pz = puzzle();
    const q = search.value.trim().toLowerCase();
    const matches = gem => gem && (filter === 'all' || gem.type === filter) &&
      (gem.name + ' ' + gem.desc + ' ' + gem.id).toLowerCase().includes(q);
    const content = tab === 'bag' ? bag : shop;
    clearSearch.hidden = clearSearch.disabled = !search.value;
    const scroll = content.scrollTop;
    content.replaceChildren();
    if (tab === 'bag') {
      for (const item of pz.bag) {
        const gem = ALL_GEMS[item.id];
        if (!matches(gem)) continue;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'pz-gem';
        card.dataset.gemUid = item.uid;
        card.style.setProperty('--gem-color', gem.color);
        card.disabled = gemLevel(item.id) > level();
        origins.set(card, { ...item, source: 'bag', preset: pz.activePreset, owner: pz });
        const grip = document.createElement('span');
        grip.className = 'pz-grip';
        grip.append(makeShape(gem, item.rot));
        const label = document.createElement('span');
        label.className = 'pz-gem-name';
        label.innerHTML = `<b>${gem.name}</b><small>${gem.type === 'active' ? '主動' : '輔助'} · Lv.${gemLevel(item.id)}</small>`;
        card.append(grip, label);
        card.onclick = event => {
          if (selected?.uid === item.uid && selected.source === 'bag') cancel('已取消選取。');
          else {
            select(origins.get(card));
            if (event.detail === 0) [...cells.values()].find(cell => !cell.disabled &&
              allowedOnBoard(selected, Number(cell.dataset.x), Number(cell.dataset.y)))?.focus();
          }
        };
        const peek = () => { if (!selected) { inspected = item; inspect(item); } };
        card.addEventListener('pointerenter', peek);
        card.addEventListener('focus', peek);
        content.append(card);
      }
    } else {
      for (const gem of Object.values(ALL_GEMS).sort((a, b) => gemLevel(a.id) - gemLevel(b.id))) {
        if (!matches(gem)) continue;
        const card = document.createElement('div');
        card.className = 'pz-shop-item';
        const head = document.createElement('div');
        head.className = 'pz-shop-head';
        head.append(makeShape(gem));
        const label = document.createElement('span');
        label.innerHTML = `<b>${gem.name}</b> <small>${gem.type === 'active' ? '主動' : '輔助'} · Lv.${gemLevel(gem.id)}</small><br><small>${gem.desc}</small>`;
        head.append(label);
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'btn small';
        buy.textContent = `🪙 ${gem.price}`;
        buy.setAttribute('aria-label', `購買${gem.name}，${gem.price} 金幣`);
        buy.disabled = level() < gemLevel(gem.id) || g.meta.p.coins < gem.price;
        buy.onclick = () => {
          if (level() < gemLevel(gem.id) || g.meta.p.coins < gem.price) return;
          g.meta.p.coins -= gem.price;
          addGemToBag(g.meta.p, gem.id);
          g.meta.save();
          g.audio.sfx('pickup');
          render();
          search.focus({ preventScroll: true });
          report(`${gem.name} 已放入背包`, 'ok');
        };
        card.append(head, buy);
        content.append(card);
      }
    }
    if (!content.childElementCount) {
      const empty = document.createElement('p');
      empty.className = 'pz-empty';
      empty.textContent = q || filter !== 'all' ? '沒有符合的寶石。試試其他關鍵字或類型。' : '背包沒有未放置的寶石。';
      content.append(empty);
    }
    content.scrollTop = scroll;
    updateSelection();
  }

  grid.addEventListener('pointerleave', () => {
    hoverCell = null;
    if (!pointer?.dragging) clearPreview();
  });

  grid.addEventListener('keydown', event => {
    const cell = event.target.closest('.pz-cell');
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!cell || !direction) return;
    event.preventDefault();
    const [dx, dy] = direction;
    let x = Number(cell.dataset.x) + dx;
    let y = Number(cell.dataset.y) + dy;
    while (x >= 0 && x < GRID && y >= 0 && y < GRID) {
      const next = cells.get(`${x},${y}`);
      if (!next.disabled) { next.focus(); break; }
      x += dx;
      y += dy;
    }
  });

  g.ui.rotateHeldGem = () => {
    if (!g.ui.puzzleOpen || !selected) return false;
    const offsets = rotateCells(ALL_GEMS[selected.id].shape, selected.rot);
    const height = Math.max(...offsets.map(([, y]) => y)) + 1;
    [selected.grabX, selected.grabY] = [height - 1 - selected.grabY, selected.grabX];
    selected.rot = (selected.rot + 1) % 4;
    if (pointer?.dragging) {
      ghost.replaceChildren(makeShape(ALL_GEMS[selected.id], selected.rot));
      drawDrag(pointer.last);
    } else {
      preview(hoverCell);
    }
    g.audio.sfx('ui');
    report(`已旋轉 ${ALL_GEMS[selected.id].name}`);
    return true;
  };
  grid.addEventListener('contextmenu', event => {
    if (g.ui.rotateHeldGem()) event.preventDefault();
  });
  rotate.onclick = () => g.ui.rotateHeldGem();
  take.onclick = () => place({ kind: 'bag' }, { keyboard: true });
  clear.onclick = () => {
    const pz = puzzle();
    cancel();
    for (const { uid, id, rot } of board().splice(0)) pz.bag.push({ uid, id, rot });
    g.meta.save();
    g.recalc();
    g.audio.sfx('ui');
    render();
    report('棋盤上的寶石已全部放回背包。', 'ok');
    pack.focus({ preventScroll: true });
  };
  pack.onclick = () => {
    cancel();
    const pz = puzzle();
    const result = autoBuildBoard(board(), pz.bag, level());
    pz.presets[pz.activePreset] = result.placed;
    pz.bag = result.bag;
    g.meta.save();
    g.recalc();
    g.audio.sfx('classup');
    render();
    const skills = computeBoard(result.placed, pz.partyGem?.id, level());
    const links = skills.reduce((sum, skill) => sum + skill.mod.supports.length, 0);
    report(skills.length ? `已排入 ${skills.length} 招，建立 ${links} 個輔助連結` : '背包沒有目前可用的主動寶石。', skills.length ? 'ok' : '');
  };

  modal.querySelectorAll('[data-pztab]').forEach(button => button.onclick = () => {
    tab = button.dataset.pztab;
    cancel();
    render();
  });
  modal.querySelectorAll('[data-pzflt]').forEach(button => button.onclick = () => {
    filter = button.dataset.pzflt;
    render();
  });
  search.oncompositionstart = () => { composing = true; };
  search.oncompositionend = () => { composing = false; renderInventory(); };
  search.oninput = () => { if (!composing) renderInventory(); };
  clearSearch.onclick = () => {
    search.value = '';
    renderInventory();
    search.focus();
  };

  g.ui.openPuzzle = () => {
    if (g.state !== 'play') return;
    g.keys = {};
    g.mouse.l = g.mouse.r = false;
    g.ui.puzzleOpen = true;
    modal.classList.remove('hide');
    render();
    report('拖寶石形狀入棋盤，拖離棋盤可放回背包。');
  };
  g.ui.closePuzzle = () => {
    const id = pointer?.id;
    pointer = null;
    cancelAnimationFrame(scrollFrame);
    if (id !== undefined && modal.hasPointerCapture(id)) modal.releasePointerCapture(id);
    cancel();
    g.ui.puzzleOpen = false;
    modal.classList.add('hide');
  };
}
