// 原創職業系統與 6×6 技能拼圖（聚方塊相鄰連動，A Short Hike 奶油像素風格）
export const GRID = 6;

export const CLASSES = [
  {
    id: 0, key: 'warden', name: '守燈衛士', icon: '🛡', weapon: 'shield',
    summary: '減傷 +15% · 生命 +25',
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
    classMech: { id: 'lotus', name: '蓮華禪韻', icon: '🪷', max: 3, color: '#ff8eb8', desc: '普攻與施法凝聚蓮印，滿 3 枚自動綻放蓮華治癒領域回復全隊並加速！' },
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
  mark:    { id: 'mark',    type: 'active', name: '微弱印記', short: '印記', icon: '🎯', color: '#a84ec8', price: 12, cd: 6.0,  mana: 6,  shape: [[0,0]], desc: '詛咒目標區域，使敵人 6 秒內受到傷害 +30%。' },
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
};

export const SUPPORT_GEMS = {
  multi: { id: 'multi', type: 'support', name: '多重投射', short: '多重', icon: '⇶', color: '#c4843d', price: 15, shape: [[0,0],[0,1],[1,1]], desc: '相鄰主動技能額外增加 +2 投射物或箭雨波數。' },
  echo:  { id: 'echo',  type: 'support', name: '連發迴響', short: '連發', icon: '⟳', color: '#7a5cc4', price: 18, shape: [[0,0],[1,0],[2,0]], desc: '相鄰主動技能額外觸發 1 次（65% 傷害）。' },
  area:  { id: 'area',  type: 'support', name: '擴大範圍', short: '擴域', icon: '◎', color: '#3f9688', price: 14, shape: [[0,0],[1,0]], desc: '相鄰主動技能作用範圍 +35%。' },
  ember: { id: 'ember', type: 'support', name: '熾炎增幅', short: '熾炎', icon: '✴', color: '#d9543a', price: 14, shape: [[0,0]], desc: '相鄰主動技能傷害 +25% 並附加火焰傷害。' },
  chain: { id: 'chain', type: 'support', name: '連鎖跳躍', short: '連鎖', icon: '⚡', color: '#4f7ed6', price: 16, shape: [[0,0],[1,0],[1,1],[2,1]], desc: '相鄰投射物命中後額外彈跳 +2 個目標。' },
  haste: { id: 'haste', type: 'support', name: '極速詠唱', short: '極速', icon: '⏩', color: '#58a858', price: 13, shape: [[0,0]], desc: '相鄰主動技能冷卻時間縮減 18%。' },
  frost: { id: 'frost', type: 'support', name: '霜緩附魔', short: '霜緩', icon: '❄', color: '#5aa0e0', price: 14, shape: [[0,0],[1,0]], desc: '相鄰主動技能命中時緩速敵人 45%。' },
  leech: { id: 'leech', type: 'support', name: '生命汲取', short: '汲血', icon: '♥', color: '#c84862', price: 14, shape: [[0,0]], desc: '相鄰主動技能命中敵人時回復 4 點生命。' },
  vamp:  { id: 'vamp',  type: 'support', name: '血月汲取', short: '血月', icon: '🩸', color: '#a8324c', price: 20, shape: [[0,0],[0,1]], desc: '相鄰主動技能傷害 +15% 且每次命中回復 6 點生命。' },
  storm: { id: 'storm', type: 'support', name: '雷鳴連鎖', short: '雷鳴', icon: '🌩', color: '#4a6cd8', price: 20, shape: [[0,0],[1,0]], desc: '相鄰主動技能附加感電（+25% 易傷）且額外連鎖 +1 目標。' },
  split: { id: 'split', type: 'support', name: '分裂稜鏡', short: '分裂', icon: '⑂',  color: '#e88c38', price: 22, shape: [[0,0],[1,0],[0,1]], desc: '相鄰投射物命中目標時向四周分裂出 3 枚次級火花！' },
  coh:   { id: 'coh',   type: 'support', name: '命中觸發器', short: '命中觸發', icon: '🔗', color: '#b85cf0', price: 26, shape: [[0,0],[1,0]], desc: '【邏輯電路】橋接兩顆主動技能：前招命中時自動觸發相鄰另一招（0.65 秒保護冷卻）。' },
  coc:   { id: 'coc',   type: 'support', name: '暴擊觸發器', short: '暴擊觸發', icon: '💥', color: '#f04878', price: 28, shape: [[0,0],[0,1]], desc: '【邏輯電路】橋接兩顆主動技能：暴擊時立即免費觸發相鄰另一招（0.45 秒保護冷卻）。' },
  orbit:    { id: 'orbit',    type: 'support', name: '環繞軌道核',   short: '軌道', icon: '🪐', color: '#3ec6d8', price: 24, shape: [[0,0],[1,0]], desc: '【魔杖改造】相鄰投射物改為環繞角色高速旋轉的軌道切割彈幕！' },
  bluefire: { id: 'bluefire', type: 'support', name: '幽藍魂火轉化', short: '藍火', icon: '🔵', color: '#2a98f0', price: 22, shape: [[0,0]], desc: '【視覺演化】將相鄰主動技能轉化為幽藍魂火特效，耗魔 -25% 且傷害 +18%！' },
  vortex:   { id: 'vortex',   type: 'support', name: '聚能引力核',   short: '聚怪', icon: '🌀', color: '#8a5cf0', price: 24, shape: [[0,0],[0,1]], desc: '【視覺演化】相鄰範圍技能命中時產生向心引力，將周圍怪海拉向中心！' },
  sv_ember_core:  { id: 'sv_ember_core',  type: 'support', name: '餘燼火種核', short: '火種核', icon: '☄️', color: '#ff6a30', price: 32, shape: [[0,0],[1,0]], desc: '【倖存者聯動】裝備於拼盤時，狂潮開局自帶 Lv.2 餘燼飛彈且超武傷害 +25%！' },
  sv_resonance:   { id: 'sv_resonance',   type: 'support', name: '超武共鳴核', short: '共鳴核', icon: '🌟', color: '#ffd85a', price: 36, shape: [[0,0],[0,1]], desc: '【倖存者聯動】裝備於拼盤時，擁有至少 2 把超武時觸發星穹共鳴（暴傷 +40%、冷卻 -15%）！' },
  sv_magnet_core: { id: 'sv_magnet_core', type: 'support', name: '貪婪星磁核', short: '星磁核', icon: '🧲', color: '#c87aff', price: 34, shape: [[0,0]], desc: '【倖存者聯動】裝備於拼盤時，狂潮開局自帶 Lv.1 貪婪金杯與星磁懷錶！' },
};

export const ALL_GEMS = { ...ACTIVE_GEMS, ...SUPPORT_GEMS };

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
export function computeBoard(placed, partyGemId = null) {
  const occ = occupiedMap(placed);
  const partySup = (partyGemId && SUPPORT_GEMS[partyGemId] && partyGemId !== 'coh' && partyGemId !== 'coc') ? SUPPORT_GEMS[partyGemId] : null;
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
    const linkedUids = new Set();
    const linkedDefs = [];
    const triggerOnHit = new Set();
    const triggerOnCrit = new Set();
    for (const [dx, dy] of rotateCells(def.shape, item.rot)) {
      const cx = item.x + dx, cy = item.y + dy;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        const nb = occ.get(nx + ',' + ny);
        if (nb && nb.uid !== item.uid && SUPPORT_GEMS[nb.id] && !linkedUids.has(nb.uid)) {
          linkedUids.add(nb.uid);
          linkedDefs.push(SUPPORT_GEMS[nb.id]);
          if (nb.id === 'coh' || nb.id === 'coc') {
            for (const otherId of supportToActives.get(nb.uid) || []) {
              if (otherId !== def.id) {
                if (nb.id === 'coh') triggerOnHit.add(otherId);
                if (nb.id === 'coc') triggerOnCrit.add(otherId);
              }
            }
          }
        }
      }
    }
    if (partySup && !linkedDefs.some(s => s.id === partySup.id)) {
      linkedDefs.push(partySup);
    }
    const mod = {
      multi: 0, echo: 0, area: 0, dmgMult: 1, fire: def.id === 'bolt', chain: 0, cdr: 0, frost: 0, leech: 0, shock: 0,
      split: false, orbit: false, bluefire: false, vortex: false, vfxTheme: null,
      partyShared: partySup ? partySup.id : null,
      triggerOnHit: [...triggerOnHit], triggerOnCrit: [...triggerOnCrit],
      supports: linkedDefs,
    };
    for (const s of linkedDefs) {
      if (s.id === 'multi') mod.multi += 2;
      if (s.id === 'echo') mod.echo += 1;
      if (s.id === 'area') mod.area += 0.35;
      if (s.id === 'ember') { mod.dmgMult += 0.25; mod.fire = true; }
      if (s.id === 'chain') mod.chain += 2;
      if (s.id === 'haste') mod.cdr = Math.min(0.6, mod.cdr + 0.18);
      if (s.id === 'frost') mod.frost += 1;
      if (s.id === 'leech') mod.leech += 4;
      if (s.id === 'vamp') { mod.dmgMult += 0.15; mod.leech += 6; }
      if (s.id === 'storm') { mod.shock += 4.5; mod.chain += 1; }
      if (s.id === 'split') mod.split = true;
      if (s.id === 'orbit') mod.orbit = true;
      if (s.id === 'bluefire') { mod.bluefire = true; mod.dmgMult += 0.18; mod.fire = true; }
      if (s.id === 'vortex') { mod.vortex = true; mod.area += 0.15; }
    }
    // 輔助寶石視覺變異主題（優先序：幽藍魂火 > 雷鳴 > 霜緩 > 熾炎）
    mod.vfxTheme = mod.bluefire ? 'bluefire' : mod.shock > 0 ? 'thunder' : mod.frost > 0 ? 'frost' : (mod.fire && def.id !== 'bolt') ? 'fire' : null;
    const chainTags = [];
    if (partySup) chainTags.push(`🤝羈絆:${partySup.short}`);
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
  if (!placed?.length || !SUPPORT_GEMS[gemId]) return null;
  const occupied = occupiedMap(placed);
  const level = profile.level || 1;
  const alreadyLinked = new Set(computeBoard(placed, puzzle.partyGem?.id)
    .filter(skill => skill.mod.supports.some(support => support.id === gemId))
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
          if (item && ACTIVE_GEMS[item.id] && !alreadyLinked.has(item.uid)) linked.set(item.uid, ACTIVE_GEMS[item.id].name);
        }
      }
      if (linked.size && linked.size > (best?.skills.length || 0)) best = { x, y, rot, skills: [...linked.values()] };
    }
  }
  return best;
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
  const pool = [...placed, ...bag].map(g => ({ uid: g.uid, id: g.id, rot: 0 })).filter(g => ALL_GEMS[g.id]);
  const BRIDGE_IDS = new Set(['coh', 'coc']);
  const SUP_PRIO = ['split', 'orbit', 'multi', 'chain', 'storm', 'ember', 'echo', 'area', 'vamp', 'haste', 'frost', 'leech'];
  const actives = pool.filter(g => ACTIVE_GEMS[g.id]);
  const bridges = pool.filter(g => BRIDGE_IDS.has(g.id));
  const supports = pool.filter(g => SUPPORT_GEMS[g.id] && !BRIDGE_IDS.has(g.id))
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
    if (best) { nextPlaced.push(best); used.add(gem.uid); return true; }
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

  const distinctActives = [];
  const seenActIds = new Set();
  for (const a of actives) { if (!seenActIds.has(a.id)) { seenActIds.add(a.id); distinctActives.push(a); } }
  if (distinctActives[0]) {
    placeBest(distinctActives[0], (x, y) => -Math.hypot(x - 2, y - 2));
  }
  for (const br of bridges) {
    placeBest(br, (x, y, rot) => adjCount(br.id, x, y, rot, nb => !!ACTIVE_GEMS[nb.id]) * 10 - Math.hypot(x - 2, y - 2));
  }
  for (const act of distinctActives.slice(1, 4)) {
    placeBest(act, (x, y, rot) => adjCount(act.id, x, y, rot, nb => BRIDGE_IDS.has(nb.id)) * 15 - Math.hypot(x - 2, y - 2));
  }
  for (const sup of supports) {
    placeBest(sup, (x, y, rot) => {
      const a = adjCount(sup.id, x, y, rot, nb => !!ACTIVE_GEMS[nb.id]);
      return a > 0 ? a * 12 - Math.hypot(x - 2.5, y - 2.5) : -100 - Math.hypot(x - 2.5, y - 2.5);
    });
  }
  const leftover = pool.filter(g => !used.has(g.uid));
  return { placed: nextPlaced, bag: leftover };
}

export function bindPuzzleUI(g) {
  const modal = document.getElementById('puzzleM');
  if (!modal) return;
  const gridEl = modal.querySelector('.pz-grid');
  const bagEl = modal.querySelector('.pz-bag');
  const shopEl = modal.querySelector('.pz-shop');
  const presetsEl = modal.querySelector('.pz-presets');
  const infoEl = modal.querySelector('.pz-info');
  const unlockEl = modal.querySelector('.pz-unlock');
  const coinsEl = modal.querySelector('.pz-coins');
  let holding = null; // { source:'bag'|'board', uid, id, rot, origX?, origY? }
  let modeTab = 'bag'; // 'bag' | 'shop'
  let gemFilter = 'all'; // 'all' | 'active' | 'support'

  const getPz = () => ensurePuzzle(g.meta.p, g.character?.job ?? 0);
  const currentPlaced = () => {
    const pz = getPz();
    return pz.presets[pz.activePreset] || (pz.presets[pz.activePreset] = []);
  };
  const setHolding = h => {
    holding = h;
    document.body.classList.toggle('holding-gem', !!h);
  };
  const returnHolding = () => {
    if (!holding) return;
    const pz = getPz();
    if (holding.source === 'board') {
      const placed = currentPlaced();
      if (canPlace(placed, holding.id, holding.origX, holding.origY, holding.origRot, g.meta.p.level)) {
        placed.push({ uid: holding.uid, id: holding.id, x: holding.origX, y: holding.origY, rot: holding.origRot });
      } else {
        pz.bag.push({ uid: holding.uid, id: holding.id, rot: 0 });
      }
    }
    setHolding(null);
  };

  function renderShapePreview(shape, rot, color) {
    const cells = rotateCells(shape, rot);
    const w = Math.max(...cells.map(c => c[0])) + 1;
    const h = Math.max(...cells.map(c => c[1])) + 1;
    const box = document.createElement('span');
    box.className = 'pz-mini';
    box.style.gridTemplateColumns = `repeat(${w}, 9px)`;
    box.style.gridTemplateRows = `repeat(${h}, 9px)`;
    const set = new Set(cells.map(c => c[0] + ',' + c[1]));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = document.createElement('i');
      if (set.has(x + ',' + y)) d.style.background = color;
      else d.style.opacity = '0';
      box.append(d);
    }
    return box;
  }

  function render() {
    const pz = getPz(), level = g.meta.p.level || 1;
    const placed = currentPlaced();
    const open = unlockedSet(level);
    const occ = occupiedMap(placed);
    const computed = computeBoard(placed, pz.partyGem?.id || null);
    const partySlotEl = modal.querySelector('#pzPartySlot');
    if (partySlotEl) {
      const pg = pz.partyGem && SUPPORT_GEMS[pz.partyGem.id] ? SUPPORT_GEMS[pz.partyGem.id] : null;
      partySlotEl.classList.toggle('filled', !!pg);
      partySlotEl.innerHTML = pg
        ? `<span>🤝 小隊羈絆共享：<b>${pg.icon} ${pg.name}</b>（全技能＋同隊隊友共享）</span><small>點擊卸下</small>`
        : `<span>🤝 小隊羈絆插座（空位）</span><small>手持輔助寶石點擊鑲嵌</small>`;
      partySlotEl.onclick = () => {
        if (holding) {
          if (!SUPPORT_GEMS[holding.id] || holding.id === 'coh' || holding.id === 'coc') {
            g.ui.toast('小隊羈絆插座僅可鑲嵌一般輔助寶石（不含觸發橋接）', '#ffb08a');
            return;
          }
          if (pz.partyGem) pz.bag.push({ uid: pz.partyGem.uid, id: pz.partyGem.id, rot: 0 });
          if (holding.source === 'bag') {
            const bi = pz.bag.findIndex(b => b.uid === holding.uid);
            if (bi >= 0) pz.bag.splice(bi, 1);
          }
          pz.partyGem = { uid: holding.uid, id: holding.id };
          setHolding(null);
          g.audio.sfx('pickup'); g.meta.save(); g.recalc(); render();
          g.ui.toast(`🤝 已鑲嵌小隊羈絆寶石：${SUPPORT_GEMS[pz.partyGem.id].name}！`, '#7fe08a');
        } else if (pz.partyGem) {
          pz.bag.push({ uid: pz.partyGem.uid, id: pz.partyGem.id, rot: 0 });
          pz.partyGem = null;
          g.audio.sfx('ui'); g.meta.save(); g.recalc(); render();
        }
      };
    }
    const linkCount = new Map(computed.map(s => [s.uid, s.mod.supports.length]));
    const linkedUids = new Set();
    for (const s of computed) {
      if (s.mod.supports.length > 0) linkedUids.add(s.uid);
    }
    for (const item of placed) {
      if (!SUPPORT_GEMS[item.id]) continue;
      for (const [dx, dy] of rotateCells(SUPPORT_GEMS[item.id].shape, item.rot)) {
        const cx = item.x + dx, cy = item.y + dy;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          const nb = occ.get(nx + ',' + ny);
          if (nb && ACTIVE_GEMS[nb.id]) linkedUids.add(item.uid);
        }
      }
    }

    unlockEl.textContent = `已解鎖 ${unlockedCount(level)}/36 格（升級自動擴充）· 棋盤上主動技能會自動裝備至下方技能欄`;
    coinsEl.textContent = `🪙 金幣 ${g.meta.p.coins}`;

    // Presets
    presetsEl.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.className = 'btn small' + (pz.activePreset === i ? ' on' : '');
      b.textContent = `構築 ${i + 1}`;
      b.onclick = () => {
        returnHolding();
        pz.activePreset = i;
        g.meta.save(); g.recalc(); render();
      };
      presetsEl.append(b);
    }

    // Info bar（即時顯示邏輯電路串聯預覽）
    if (holding) {
      const def = ALL_GEMS[holding.id];
      infoEl.innerHTML = `<b>手持：${def.icon} ${def.name}</b>（${def.type === 'active' ? '主動' : '輔助'}）— ${def.desc} <small>點棋盤放下 · 右鍵或按 R 旋轉</small>`;
    } else {
      const activeNames = computed.slice(0, 4).map((s, idx) => `${['右鍵','Q','E','C'][idx]} ${s.mod.circuitLabel}`);
      infoEl.textContent = activeNames.length
        ? '⚡ 邏輯電路：' + activeNames.join('　|　')
        : '點選下方寶石放入 6×6 棋盤；用「命中觸發器／暴擊觸發器」橋接兩招主動技能即可打造自動連招電路！';
    }

    // 6x6 Grid（含電路金色邊框高亮＋手持方塊懸停落點預覽）
    gridEl.replaceChildren();
    const anchorSeen = new Set();
    const cellEls = new Map();
    const clearPreview = () => {
      for (const el of cellEls.values()) el.classList.remove('preview-ok', 'preview-bad', 'pz-hover-hl');
    };
    const showPreview = (ax, ay) => {
      clearPreview();
      if (!holding) return;
      const def = ALL_GEMS[holding.id];
      if (!def) return;
      const ok = canPlace(placed, holding.id, ax, ay, holding.rot, level);
      for (const [dx, dy] of rotateCells(def.shape, holding.rot)) {
        const el = cellEls.get((ax + dx) + ',' + (ay + dy));
        if (el) el.classList.add(ok ? 'preview-ok' : 'preview-bad');
      }
    };
    gridEl.onmouseleave = clearPreview;

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pz-cell';
        const key = x + ',' + y;
        cellEls.set(key, cell);
        const isOpen = open.has(key);
        const item = occ.get(key);
        if (!isOpen) {
          cell.classList.add('locked');
          cell.disabled = true;
          cell.textContent = '🔒';
        } else if (item) {
          const def = ALL_GEMS[item.id];
          cell.classList.add('filled', def.type);
          if (linkedUids.has(item.uid)) cell.classList.add('linked');
          cell.style.background = def.color;
          cell.title = `${def.name}（${def.type === 'active' ? '主動' : '輔助'}）：${def.desc}`;
          if (!anchorSeen.has(item.uid)) {
            anchorSeen.add(item.uid);
            const lc = linkCount.get(item.uid) || 0;
            cell.innerHTML = `<span class="pz-ic">${def.icon}</span><span class="pz-lb">${def.short}${lc ? '+' + lc : ''}</span>`;
          } else {
            cell.innerHTML = `<span class="pz-dot"></span>`;
          }
          cell.onclick = () => {
            if (holding) return;
            const idx = placed.findIndex(p => p.uid === item.uid);
            if (idx >= 0) {
              const [removed] = placed.splice(idx, 1);
              setHolding({ source: 'board', uid: removed.uid, id: removed.id, rot: removed.rot, origX: removed.x, origY: removed.y, origRot: removed.rot });
              g.audio.sfx('ui'); g.meta.save(); g.recalc(); render();
            }
          };
        } else {
          if (holding && canPlace(placed, holding.id, x, y, holding.rot, level)) cell.classList.add('can');
          cell.onclick = () => {
            if (!holding) return;
            if (!canPlace(placed, holding.id, x, y, holding.rot, level)) { g.ui.toast('此位置無法放入該形狀', '#ff9a8a'); return; }
            if (holding.source === 'bag') {
              const bi = pz.bag.findIndex(b => b.uid === holding.uid);
              if (bi >= 0) pz.bag.splice(bi, 1);
            }
            placed.push({ uid: holding.uid, id: holding.id, x, y, rot: holding.rot });
            setHolding(null);
            g.audio.sfx('pickup'); g.meta.save(); g.recalc(); render();
          };
        }
        cell.onmouseenter = () => {
          showPreview(x, y);
          if (!holding && item) {
            for (const c of gridEl.querySelectorAll('.pz-hover-hl')) c.classList.remove('pz-hover-hl');
            for (const [k2, el2] of cellEls.entries()) {
              const o2 = occ.get(k2);
              if (o2 && o2.uid === item.uid) el2.classList.add('pz-hover-hl');
            }
          }
        };
        cell.oncontextmenu = e => {
          e.preventDefault();
          if (holding) { holding.rot = (holding.rot + 1) % 4; g.audio.sfx('ui'); render(); }
        };
        gridEl.append(cell);
      }
    }

    // Phase U2：SVG 發光邏輯電路連線（主動 ↔ 輔助／觸發橋接）
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'pz-svg');
    svg.setAttribute('viewBox', '0 0 291 291');
    const seenEdges = new Set();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const a = occ.get(x + ',' + y);
        if (!a) continue;
        const aAct = !!ACTIVE_GEMS[a.id], aSup = !!SUPPORT_GEMS[a.id];
        for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
          if (nx >= GRID || ny >= GRID) continue;
          const b = occ.get(nx + ',' + ny);
          if (!b || b.uid === a.uid) continue;
          const bAct = !!ACTIVE_GEMS[b.id], bSup = !!SUPPORT_GEMS[b.id];
          if (!((aAct && bSup) || (aSup && bAct))) continue;
          const edgeKey = `${x},${y}-${nx},${ny}`;
          if (seenEdges.has(edgeKey)) continue;
          seenEdges.add(edgeKey);
          const supId = aSup ? a.id : b.id;
          const stroke = supId === 'coh' ? '#62e8ff' : supId === 'coc' ? '#ff7ad8' : '#ffd85a';
          const x1 = 6 + x * 47 + 22, y1 = 6 + y * 47 + 22;
          const x2 = 6 + nx * 47 + 22, y2 = 6 + ny * 47 + 22;
          const glow = document.createElementNS(svgNS, 'line');
          glow.setAttribute('x1', x1); glow.setAttribute('y1', y1);
          glow.setAttribute('x2', x2); glow.setAttribute('y2', y2);
          glow.setAttribute('stroke', stroke); glow.setAttribute('stroke-width', '7');
          glow.setAttribute('stroke-linecap', 'round'); glow.setAttribute('opacity', '0.32');
          svg.append(glow);
          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', x1); line.setAttribute('y1', y1);
          line.setAttribute('x2', x2); line.setAttribute('y2', y2);
          line.setAttribute('stroke', stroke); line.setAttribute('stroke-width', '3');
          line.setAttribute('stroke-linecap', 'round');
          svg.append(line);
          for (const [px, py] of [[x1, y1], [x2, y2]]) {
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('r', '3.5');
            dot.setAttribute('fill', '#fff8e6'); dot.setAttribute('stroke', stroke); dot.setAttribute('stroke-width', '1.8');
            svg.append(dot);
          }
        }
      }
    }
    gridEl.append(svg);

    // Tabs visibility
    modal.querySelectorAll('[data-pztab]').forEach(b => b.classList.toggle('on', b.dataset.pztab === modeTab));
    modal.querySelectorAll('[data-pzflt]').forEach(b => b.classList.toggle('on', b.dataset.pzflt === gemFilter));
    bagEl.hidden = modeTab !== 'bag';
    shopEl.hidden = modeTab !== 'shop';

    // Bag
    bagEl.replaceChildren();
    const filteredBag = pz.bag.filter(b => {
      const def = ALL_GEMS[b.id];
      return def && (gemFilter === 'all' || def.type === gemFilter);
    });
    if (!filteredBag.length) {
      const empty = document.createElement('div');
      empty.className = 'psmall';
      empty.textContent = '目前背包沒有未放置的寶石，可切換至「寶石商人」購買或擊敗精英怪取得！';
      bagEl.append(empty);
    }
    for (const item of filteredBag) {
      const def = ALL_GEMS[item.id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pz-gem' + (holding?.uid === item.uid ? ' on' : '');
      card.title = def.desc;
      card.append(renderShapePreview(def.shape, 0, def.color));
      const txt = document.createElement('span');
      txt.innerHTML = `<b>${def.icon} ${def.name}</b><small>${def.type === 'active' ? '主動' : '輔助'}</small>`;
      card.append(txt);
      card.onclick = () => {
        if (holding?.uid === item.uid) { setHolding(null); render(); return; }
        returnHolding();
        setHolding({ source: 'bag', uid: item.uid, id: item.id, rot: item.rot || 0 });
        g.audio.sfx('ui'); render();
      };
      bagEl.append(card);
    }

    // Shop
    shopEl.replaceChildren();
    for (const def of Object.values(ALL_GEMS)) {
      if (gemFilter !== 'all' && def.type !== gemFilter) continue;
      const card = document.createElement('div');
      card.className = 'pz-shop-item';
      const head = document.createElement('div');
      head.className = 'pz-shop-head';
      head.append(renderShapePreview(def.shape, 0, def.color));
      const meta = document.createElement('div');
      meta.innerHTML = `<b>${def.icon} ${def.name}</b> <small>${def.type === 'active' ? '主動' : '輔助'}</small><br><small>${def.desc}</small>`;
      head.append(meta);
      const buy = document.createElement('button');
      buy.className = 'btn small';
      buy.textContent = `🪙 ${def.price}`;
      buy.disabled = g.meta.p.coins < def.price;
      buy.onclick = () => {
        if (g.meta.p.coins < def.price) return;
        g.meta.p.coins -= def.price;
        addGemToBag(g.meta.p, def.id);
        g.meta.save(); g.audio.sfx('pickup');
        g.ui.toast(`購得寶石：${def.name}`, '#ffd85a');
        render();
      };
      card.append(head, buy);
      shopEl.append(card);
    }
  }

  const autoBtn = modal.querySelector('#pzAuto');
  if (autoBtn) autoBtn.onclick = () => {
    returnHolding();
    const pz = getPz(), placed = currentPlaced();
    const res = autoBuildBoard(placed, pz.bag, g.meta.p.level || 1);
    pz.presets[pz.activePreset] = res.placed;
    pz.bag = res.bag;
    g.meta.save(); g.recalc(); g.audio.sfx('classup');
    const comp = computeBoard(res.placed);
    g.ui.toast(`⚡ 已套用推薦構築（${comp.map(s => s.mod.circuitLabel).join(' | ') || '完成'}）`, '#ffd85a');
    render();
  };
  modal.querySelector('#pzRotate').onclick = () => { if (holding) { holding.rot = (holding.rot + 1) % 4; g.audio.sfx('ui'); render(); } };
  modal.querySelector('#pzTake').onclick = () => {
    if (!holding) return;
    if (holding.source === 'board') {
      getPz().bag.push({ uid: holding.uid, id: holding.id, rot: 0 });
      setHolding(null); g.meta.save(); g.recalc(); g.audio.sfx('ui'); render();
    } else {
      setHolding(null); render();
    }
  };
  modal.querySelector('#pzClear').onclick = () => {
    returnHolding();
    const pz = getPz(), placed = currentPlaced();
    while (placed.length) {
      const it = placed.pop();
      pz.bag.push({ uid: it.uid, id: it.id, rot: 0 });
    }
    g.meta.save(); g.recalc(); g.audio.sfx('ui'); render();
  };
  modal.querySelectorAll('[data-pztab]').forEach(b => b.onclick = () => { modeTab = b.dataset.pztab; g.audio.sfx('ui'); render(); });
  modal.querySelectorAll('[data-pzflt]').forEach(b => b.onclick = () => { gemFilter = b.dataset.pzflt; g.audio.sfx('ui'); render(); });

  g.ui.openPuzzle = () => {
    if (g.state !== 'play') return;
    g.keys = {}; g.mouse.l = g.mouse.r = false;
    g.ui.puzzleOpen = true; modal.classList.remove('hide'); render();
  };
  g.ui.closePuzzle = () => {
    returnHolding();
    g.ui.puzzleOpen = false; modal.classList.add('hide');
  };
  g.ui.rotateHeldGem = () => {
    if (!g.ui.puzzleOpen || !holding) return false;
    holding.rot = (holding.rot + 1) % 4; g.audio.sfx('ui'); render(); return true;
  };
}
