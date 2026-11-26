import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat } from './world.js';
import { buildPlayer } from './models.js';
import { mulberry32, clamp, lerp } from './util.js';
import { GOODS, FIELDS } from './frontier.js';
import { uvToWorld } from './field_blueprints.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { makeItem } from './loot.js';

// ======================== 1. 超慢漸進晝夜系統（日頭長 70%、平滑色溫過渡） ========================
export function dayInfo(dayTime) {
  // 完整週期預設 1200 秒（20 分鐘）：
  // 0.00-0.08 晨曦（8%）, 0.08-0.74 漫長白晝（66%）, 0.74-0.86 金黃黃昏（12%）, 0.86-1.00 靜謐星夜（14%）
  const t = ((dayTime % 1) + 1) % 1;
  const sm = x => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
  const keys = [
    { t: 0.00, sunAngle: -0.65, sunMult: 0.72, hemiMult: 0.78, tint: [1.02, 0.92, 0.92], lamp: 1.85 },
    { t: 0.08, sunAngle: -0.10, sunMult: 0.98, hemiMult: 0.98, tint: [1.02, 0.99, 0.96], lamp: 1.05 },
    { t: 0.40, sunAngle:  0.35, sunMult: 1.02, hemiMult: 1.00, tint: [1.00, 1.00, 1.00], lamp: 0.95 },
    { t: 0.74, sunAngle:  0.62, sunMult: 0.98, hemiMult: 0.96, tint: [1.03, 0.98, 0.94], lamp: 1.15 },
    { t: 0.82, sunAngle:  1.05, sunMult: 0.78, hemiMult: 0.82, tint: [1.09, 0.88, 0.80], lamp: 1.65 },
    { t: 0.88, sunAngle:  1.25, sunMult: 0.56, hemiMult: 0.68, tint: [0.84, 0.84, 1.04], lamp: 2.25 },
    { t: 0.94, sunAngle: -0.40, sunMult: 0.44, hemiMult: 0.60, tint: [0.74, 0.80, 1.12], lamp: 2.65 },
    { t: 1.00, sunAngle: -0.65, sunMult: 0.72, hemiMult: 0.78, tint: [1.02, 0.92, 0.92], lamp: 1.85 },
  ];
  let a = keys[0], b = keys[1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const k = sm((t - a.t) / Math.max(0.0001, b.t - a.t));
  const phase = t < 0.08 ? 'dawn' : t < 0.74 ? 'day' : t < 0.86 ? 'dusk' : 'night';
  const meta = {
    dawn:  { label: '晨曦', icon: '🌅', isNight: false },
    day:   { label: '白晝', icon: '☀️', isNight: false },
    dusk:  { label: '黃昏', icon: '🌇', isNight: false },
    night: { label: '星夜', icon: '🌙', isNight: true },
  }[phase];
  return {
    phase, ...meta,
    sunAngle: lerp(a.sunAngle, b.sunAngle, k),
    sunMult: lerp(a.sunMult, b.sunMult, k),
    hemiMult: lerp(a.hemiMult, b.hemiMult, k),
    tint: [lerp(a.tint[0], b.tint[0], k), lerp(a.tint[1], b.tint[1], k), lerp(a.tint[2], b.tint[2], k)],
    lampBoost: lerp(a.lamp, b.lamp, k),
  };
}

// ======================== 2. 十大原創二轉覺醒職業（MMORPG 嚴格試煉：Lv.12 + 擊殺 + 精英 + 專屬試煉 + 覺醒儀式費用） ========================
export const ASCEND_REQ = {
  level: 12,
  kills: 40,
  elites: 3,
  coins: 300,
  shards: 45,
};

function eliteCountOf(p) {
  return Math.max(p?.totalElites || 0, p?.bountyProg?.eliteKills || 0);
}

export const SECOND_CLASSES = {
  0: [
    { id: 'bastion', name: '聖光堡壘', title: '⚜ 聖光壁壘', icon: '⚜', aura: 0xffe07a, auraTheme: 'holy', gem: 'spear_cage', trial: '完成 2 次完美採集', trialCheck: p => ({ ok: (p?.deeds?.perfectGather || 0) >= 2, label: `完美採集 ${p?.deeds?.perfectGather || 0}/2` }), bonuses: { armor: 12, maxHp: 45 }, desc: '化身堅不可摧的光輝壁壘，解鎖 3D 招牌寶石「🔱 雷槍聖牢」。' },
    { id: 'earthwalker', name: '大地行者', title: '⛰ 山谷鎮守者', icon: '⛰', aura: 0x8cd06a, auraTheme: 'earth', gem: 'paladin_sword', trial: '累計擊敗 60 隻魔物', trialCheck: p => ({ ok: (p?.kills || 0) >= 60, label: `魔物討伐 ${p?.kills || 0}/60` }), bonuses: { area: 35, baseDmg: 8 }, desc: '與山谷地脈共鳴，解鎖 3D 招牌寶石「⚔️ 聖劍天降」。' },
  ],
  1: [
    { id: 'skywarden', name: '蒼穹馭風者', title: '🪽 馭風領航者', icon: '🪽', aura: 0x8ae8ff, auraTheme: 'wind', gem: 'thunder_phoenix', trial: '滑翔穿過 2 個空中星環', trialCheck: p => ({ ok: (p?.deeds?.skyRing || 0) >= 2, label: `空中星環 ${p?.deeds?.skyRing || 0}/2` }), bonuses: { moveSpd: 18, atkSpd: 15 }, desc: '駕馭高空上升氣流，解鎖 3D 召喚寶石「🦅 雷霆鳳凰」。' },
    { id: 'starhunter', name: '星痕獵手', title: '🌠 星痕狩獵者', icon: '🌠', aura: 0xffc864, auraTheme: 'thunder', gem: 'spear_cage', trial: '討伐 5 隻高危精英魔物', trialCheck: p => ({ ok: eliteCountOf(p) >= 5, label: `精英討伐 ${eliteCountOf(p)}/5` }), bonuses: { crit: 15, critMult: 40, proj: 1 }, desc: '箭矢化為星軌連射，解鎖 3D 控場寶石「🔱 雷槍聖牢」。' },
  ],
  2: [
    { id: 'starcaller', name: '焚星賢者', title: '☄ 焚星大賢者', icon: '☄', aura: 0xff7a40, auraTheme: 'fire', gem: 'fire_whale', trial: '施放拼圖技能 25 次', trialCheck: p => ({ ok: (p?.deeds?.casts || 0) >= 25, label: `拼圖施法 ${p?.deeds?.casts || 0}/25` }), bonuses: { addFire: 8, dmgPct: 22 }, desc: '引動天穹熾炎，解鎖 3D 巨獸寶石「🐋 熾炎巨鯨」。' },
    { id: 'frostweaver', name: '霜燈織夢師', title: '❄ 霜燈織夢者', icon: '❄', aura: 0x7ac8ff, auraTheme: 'bluefire', gem: 'black_hole', trial: '於星夜探索野外並踏足 3 區', trialCheck: p => ({ ok: !!(p?.deeds?.nightExplore) && (p?.visitedFields?.length || 0) >= 3, label: `星夜探索 ${p?.deeds?.nightExplore ? '✔' : '0/1'} · 區域 ${p?.visitedFields?.length || 0}/3` }), bonuses: { mana: 40, manaRegen: 50, cdr: 15 }, desc: '編織幽藍星域，解鎖 3D 聚怪寶石「🕳️ 星域黑洞」。' },
  ],
  3: [
    { id: 'crimsonblade', name: '緋月劍舞者', title: '🌙 緋月舞劍士', icon: '🌙', aura: 0xff6a8a, auraTheme: 'arcane', gem: 'sword_beams', trial: '討伐 5 隻高危精英魔物', trialCheck: p => ({ ok: eliteCountOf(p) >= 5, label: `精英討伐 ${eliteCountOf(p)}/5` }), bonuses: { atkSpd: 25, critMult: 45 }, desc: '在月影中疾斬如風，解鎖 3D 劍波寶石「🌙 附魔劍氣」。' },
    { id: 'mistphantom', name: '夜霧幻影師', title: '🌫 夜霧幽影', icon: '🌫', aura: 0xb48ae0, auraTheme: 'death', gem: 'dark_wolf', trial: '完成 2 次完美採集', trialCheck: p => ({ ok: (p?.deeds?.perfectGather || 0) >= 2, label: `完美採集 ${p?.deeds?.perfectGather || 0}/2` }), bonuses: { rollCdr: 20, moveSpd: 15, crit: 12 }, desc: '操縱冥界巨影吞噬群敵，解鎖 3D 召喚寶石「🐺 暗影巨狼」。' },
  ],
  4: [
    { id: 'lotussage', name: '蓮華禪師', title: '🪷 蓮華淨者', icon: '🪷', aura: 0x8ef0b8, auraTheme: 'lotus', gem: 'healing_tree', trial: '完成 2 次完美採集', trialCheck: p => ({ ok: (p?.deeds?.perfectGather || 0) >= 2, label: `完美採集 ${p?.deeds?.perfectGather || 0}/2` }), bonuses: { regen: 4, maxHp: 40, cdr: 12 }, desc: '展開綻放蓮華氣場持續治癒隊友，解鎖 3D 領域寶石「🌳 繁花聖樹」。' },
    { id: 'thunderfist', name: '雷鳴拳聖', title: '⚡ 雷鳴武聖', icon: '⚡', aura: 0xffd24a, auraTheme: 'thunder', gem: 'candle_ward', trial: '累計擊敗 60 隻魔物', trialCheck: p => ({ ok: (p?.kills || 0) >= 60, label: `魔物討伐 ${p?.kills || 0}/60` }), bonuses: { atkSpd: 24, baseDmg: 9, crit: 10 }, desc: '以魂火燭陣與迅雷連擊震盪大地，解鎖 3D 寶石「🕯️ 魂火燭陣」。' },
  ],
};

export function findSecondClass(id) {
  if (!id) return null;
  for (const list of Object.values(SECOND_CLASSES)) {
    const f = list.find(c => c.id === id);
    if (f) return f;
  }
  return null;
}

export function checkAscendEligibility(profile, sc, devOn = false) {
  const p = profile || {};
  const lv = p.level || 1;
  const kills = p.kills || 0;
  const elites = eliteCountOf(p);
  const coins = p.coins || 0;
  const shards = p.shards || 0;
  const spec = sc?.trialCheck ? sc.trialCheck(p) : { ok: true, label: '專屬試煉' };
  const checks = [
    { label: `旅人等級 Lv.${lv}/${ASCEND_REQ.level}`, ok: lv >= ASCEND_REQ.level },
    { label: `累計討伐魔物 ${kills}/${ASCEND_REQ.kills}`, ok: kills >= ASCEND_REQ.kills },
    { label: `討伐高危精英 ${elites}/${ASCEND_REQ.elites}`, ok: elites >= ASCEND_REQ.elites },
    { label: `專屬試煉：${spec.label}`, ok: !!spec.ok },
    { label: `覺醒費用 🪙${coins}/${ASCEND_REQ.coins}`, ok: coins >= ASCEND_REQ.coins },
    { label: `覺醒星砂 💎${shards}/${ASCEND_REQ.shards}`, ok: shards >= ASCEND_REQ.shards },
  ];
  const passed = checks.filter(c => c.ok).length;
  const eligible = devOn || passed === checks.length;
  return { eligible, checks, passed, total: checks.length, prog: passed / checks.length, cost: { coins: ASCEND_REQ.coins, shards: ASCEND_REQ.shards } };
}

export function performAscend(profile, scId, devOn = false) {
  const sc = findSecondClass(scId);
  if (!profile || !sc) return { ok: false, reason: '未知二轉職業' };
  if (profile.secondClass === scId) return { ok: false, reason: '已覺醒此職業' };
  const res = checkAscendEligibility(profile, sc, devOn);
  if (!res.eligible) return { ok: false, reason: '尚未達成全部二轉試煉與儀式費用', checks: res.checks };
  if (!devOn) {
    profile.coins = Math.max(0, (profile.coins || 0) - ASCEND_REQ.coins);
    profile.shards = Math.max(0, (profile.shards || 0) - ASCEND_REQ.shards);
  }
  profile.secondClass = sc.id;
  if (sc.title) profile.activeTitle = sc.title;
  addGemToBag(profile, sc.gem);
  return { ok: true, sc };
}

// ======================== 3. 野外 NPC 與支線任務 ========================
export const FIELD_NPCS = {
  1: { name: '採風畫家 柚子', col: 3, lines: ['晨光草原的雲影最美了！', '試著乘著上升氣流滑翔穿過空中星環吧！'], quest: { id: 'q_f1', title: '草原寫生委託', desc: '在晨光草原擊敗 3 隻敵人或採集 1 次素材', need: 3, rewardCoins: 20, rewardXp: 45 } },
  2: { name: '林木學者 阿松', col: 5, lines: ['古木林冠之間藏著不少高台寶箱。', '砍伐香杉木時抓準金色區間能收穫雙倍！'], quest: { id: 'q_f2', title: '林間生態調查', desc: '擊敗 4 隻森林怪物協助觀察生態', need: 4, rewardCoins: 28, rewardXp: 65 } },
  3: { name: '尋寶蛙客 咕嚕', col: 6, lines: ['霧潮沼澤的遺跡入口閃著紫光，帶著鑰石就能進副本！', '夜晚的沼澤螢火超漂亮，星砂也掉更多喔。'], quest: { id: 'q_f3', title: '沼澤秘聞收集', desc: '擊敗 4 隻沼澤怪物尋找古老碎片', need: 4, rewardCoins: 35, rewardXp: 85 } },
  4: { name: '觀星者 露露', col: 2, lines: ['雪原的暴風雪會讓採集收穫更豐富。', '在星夜抬頭看，連極光都好像近在咫尺。'], quest: { id: 'q_f4', title: '雪原星象觀測', desc: '擊敗 5 隻雪原怪物保護觀測站', need: 5, rewardCoins: 42, rewardXp: 110 } },
  5: { name: '鑄火匠 炎叔', col: 1, lines: ['火岩區的星紋礦品質最高！', '想切磋武藝的話，打開地圖可以開啟演武挑戰。'], quest: { id: 'q_f5', title: '熔岩礦脈清理', desc: '擊敗 5 隻火岩怪物確保採礦安全', need: 5, rewardCoins: 50, rewardXp: 140 } },
  6: { name: '古樹守望者 苔翁', col: 0, lines: ['你已走過整個燈谷……鹿王樹心就在前方。', '善用技能拼圖的相鄰連動，能發揮驚人力量。'], quest: { id: 'q_f6', title: '古樹淨化試煉', desc: '擊敗 6 隻古樹林怪物守護樹心', need: 6, rewardCoins: 65, rewardXp: 180 } },
  7: { name: '風翼旅人 嵐', col: 2, lines: ['浮空遺跡的上升氣流能帶你直衝雲端！', '連按空白滑翔擊落雲翼飛鰩吧！'], quest: { id: 'q_f7', title: '空域氣流巡查', desc: '在浮空遺跡群擊敗 4 隻魔物', need: 4, rewardCoins: 40, rewardXp: 95 } },
  8: { name: '海灘釣客 阿浪', col: 4, lines: ['遮陽傘下乘涼最愜意了！', '潮汐灣的溪銀魚肥美又值錢喔。'], quest: { id: 'q_f8', title: '潮汐海灣護漁', desc: '在珊瑚潮汐灣擊敗 5 隻魔物', need: 5, rewardCoins: 48, rewardXp: 125 } },
  9: { name: '電工學徒 伏特', col: 6, lines: ['太陽能屋頂還在發電呢！', '小心雷電感電狀態，承受傷害會增加。'], quest: { id: 'q_f9', title: '電光浮台維修', desc: '在沉沒電光都擊敗 5 隻魔物', need: 5, rewardCoins: 58, rewardXp: 165 } },
  10: { name: '花都琴師 緋櫻', col: 7, lines: ['櫻花運河的倒影美得像一幅畫。', '試著在寶石商人那裡入手「🌸 櫻吹雪」吧！'], quest: { id: 'q_f10', title: '櫻花大道除障', desc: '在櫻花水都擊敗 4 隻魔物守護花季', need: 4, rewardCoins: 45, rewardXp: 110 } },
  11: { name: '天環測量師 穹', col: 2, lines: ['那三道巨型碧藍天環是遠古星穹留下的奇蹟！', '穿過天環下方說不定能找到高階寶箱。'], quest: { id: 'q_f11', title: '巨環谷地勘查', desc: '在蒼穹巨環谷擊敗 5 隻魔物', need: 5, rewardCoins: 56, rewardXp: 155 } },
  12: { name: '紅楓大匠 鐵楓', col: 1, lines: ['白樺楓紅下打鐵最講究火候！', '這裡的星晶巨像會掉落頂級高階裝備喔。'], quest: { id: 'q_f12', title: '紅楓工坊巨像試煉', desc: '在紅楓工坊谷擊敗 6 隻魔物', need: 6, rewardCoins: 75, rewardXp: 210 } },
};

// ======================== 4. 特設副本入口地標 ========================
export function buildDungeonLandmark(biome, fieldId) {
  const g = new THREE.Group();
  const accent = [0x9c7cff, 0x58d88a, 0x6ac8d8, 0x80d8ff, 0xff7a42, 0xffd268][(fieldId - 1) % 6];
  const stone = new THREE.Mesh(mergeGeometries([
    part(new THREE.CylinderGeometry(0.45, 0.65, 3.0, 6), biome.rock, -1.45, 1.5, 0),
    part(new THREE.CylinderGeometry(0.45, 0.65, 3.0, 6), biome.rock, 1.45, 1.5, 0),
    part(new THREE.BoxGeometry(3.8, 0.65, 0.9), biome.rockDark, 0, 3.1, 0),
    part(new THREE.ConeGeometry(0.55, 1.1, 5), accent, -1.45, 3.5, 0),
    part(new THREE.ConeGeometry(0.55, 1.1, 5), accent, 1.45, 3.5, 0),
    part(new THREE.OctahedronGeometry(0.55, 0), accent, 0, 4.15, 0),
  ]), toonMat({ vertexColors: true }));
  stone.castShadow = true; stone.receiveShadow = true;
  g.add(stone);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.45, 11, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 5.5; beam.userData.noNormal = true;
  g.add(beam);
  return g;
}

// ======================== 5. 上升氣流、空中星環與高台寶箱 ========================
export function spawnSkyFeatures(g) {
  g.updrafts = []; g.skyRings = []; g.chests = [];
  if (!g.field) return;
  const r = mulberry32(4100 + g.field * 97);
  const addUpdraftAt = (pos, ringPos, ringRotY) => {
    const y = g.world.gh(pos.x, pos.z);
    const grp = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 0.85, 8.5, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcff8ff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    col.position.y = 4.25; col.userData.noNormal = true; grp.add(col);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.08, 4, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; ring.userData.noNormal = true; grp.add(ring);
    grp.position.set(pos.x, y, pos.z);
    g.world.group.add(grp);
    g.updrafts.push({ x: pos.x, y, z: pos.z, grp, ring });

    const rx = ringPos.x, rz = ringPos.z;
    const ry = y + 3.8 + r() * 1.2;
    const sring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.14, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdc5e }),
    );
    sring.position.set(rx, ry, rz); sring.rotation.y = ringRotY; sring.userData.noNormal = true;
    g.world.group.add(sring);
    g.skyRings.push({ x: rx, y: ry, z: rz, mesh: sring, got: false });
  };

  const bp = g.world.bp;
  if (bp?.glides?.length) {
    // v5 藍圖單向滑翔捷徑：起點擺放上升氣流柱，中點擺放金色高空星環
    for (const gl of bp.glides) {
      const p0 = uvToWorld(gl[0], gl[1], g.world.half);
      const pm = uvToWorld(gl[2], gl[3], g.world.half);
      const p1 = uvToWorld(gl[4], gl[5], g.world.half);
      const rotY = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      addUpdraftAt(p0, pm, rotY);
    }
  } else {
    // 3 座上升氣流柱
    for (let i = 0; i < 3; i++) {
      const pos = g.world.randomWalkable(r, g.player.pos, 7);
      addUpdraftAt(pos, { x: pos.x + (r() - 0.5) * 10, z: pos.z + (r() - 0.5) * 10 }, r() * Math.PI);
    }
  }
  // 高台秘寶箱（找高處平台放 2 個寶箱）
  let placedChests = 0;
  for (let tries = 0; tries < 220 && placedChests < 2; tries++) {
    const x = (r() - 0.5) * g.world.half * 1.6, z = (r() - 0.5) * g.world.half * 1.6;
    if (!g.world.isLand(x, z)) continue;
    const y = g.world.gh(x, z);
    if (y < 1.2) continue;
    const mesh = new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.95, 0.55, 0.65), 0x8f5634, 0, 0.28, 0),
      part(new THREE.BoxGeometry(1.0, 0.16, 0.7), 0xffcf4a, 0, 0.58, 0),
      part(new THREE.BoxGeometry(0.18, 0.2, 0.12), 0xfff3c0, 0, 0.45, 0.34),
    ]), toonMat({ vertexColors: true }));
    mesh.position.set(x, y, z); mesh.castShadow = true;
    g.world.group.add(mesh);
    g.chests.push({ x, y, z, mesh, opened: false });
    g.spots.push({ kind: 'chest', label: '開啟高台秘寶箱', x, z, top: y + 2.0, mesh, chestIdx: placedChests });
    placedChests++;
  }
  // 野外 NPC
  const npcDef = FIELD_NPCS[g.field];
  if (npcDef) {
    const pos = g.world.randomWalkable(r, g.player.pos, 5);
    const bot = g.addRemote('field_npc_' + g.field, npcDef.name, npcDef.col);
    bot.bot = true; bot.fieldNpc = true; bot.lines = npcDef.lines;
    bot.x = bot.tx = pos.x; bot.z = bot.tz = pos.z; bot.y = g.world.gh(pos.x, pos.z);
    bot.home = [pos.x, pos.z, 1.5]; bot.wait = 4;
    g.bots.push(bot.id);
    g.spots.push({ kind: 'field_quest', label: `與 ${npcDef.name} 接取野外委託`, x: pos.x, z: pos.z, top: bot.y + 2.4, npcDef, bot });
  }
}

export function tickSkyFeatures(g, dt) {
  const p = g.player;
  for (const sp of g.spinners || []) {
    if (sp.obj) sp.obj.rotation[sp.axis || 'z'] += (sp.speed || 0.5) * dt;
  }
  for (const u of g.updrafts || []) {
    u.ring.position.y = 0.5 + ((g.time * 3.5) % 7.5);
    u.ring.rotation.z = g.time * 2;
    if (Math.hypot(p.pos.x - u.x, p.pos.z - u.z) < 1.55 && p.y < u.y + 7.5) {
      if (p.air || p.gliding || g.keys[' ']) {
        if (!u._sfx || g.time - u._sfx > 1.2) { g.audio.sfx('updraft'); u._sfx = g.time; }
        p.air = true; p.vy = Math.max(p.vy, 9.2); p.stamina = Math.min(100, p.stamina + 40 * dt);
        g.puffs.emit(p.pos.x, p.y, p.pos.z, { c: 0xe6fbff, s: 0.2, up: 3, g: -3, life: 0.4 });
      }
    }
  }
  for (const sr of g.skyRings || []) {
    if (sr.got) continue;
    sr.mesh.rotation.y += dt * 1.4;
    if (Math.hypot(p.pos.x - sr.x, p.pos.z - sr.z) < 1.7 && Math.abs(p.y + 0.6 - sr.y) < 1.8) {
      sr.got = true; sr.mesh.visible = false;
      p.stamina = 100; p.vy = Math.max(p.vy, 5.5);
      g.meta.p.coins += 8; g.meta.p.shards += 10;
      g.meta.p.deeds = g.meta.p.deeds || {}; g.meta.p.deeds.skyRing = (g.meta.p.deeds.skyRing || 0) + 1;
      g.meta.save();
      g.audio.sfx('ring');
      g.ui.toast('✨ 穿過空中星環！金幣 +8 · 星砂 +10 · 體力全滿', '#ffdc5e');
      g.fx.burst(sr.x, sr.y, sr.z, 18, { c: [0xffdc5e, 0xffffff, 0x8ae8ff], s: 0.14, speed: 5, up: 3, life: 0.6 });
    }
  }
  // 營火回血
  for (const cf of g.campfires || []) {
    cf.light.intensity = 2.0 + Math.sin(g.time * 12) * 0.35;
    if (Math.random() < dt * 6) g.fx.emit(cf.x + (Math.random() - 0.5) * 0.3, cf.y + 0.5, cf.z + (Math.random() - 0.5) * 0.3, { c: [0xffa040, 0xffe07a], s: 0.09, up: 2.2, g: -1.5, life: 0.6 });
    if (Math.hypot(p.pos.x - cf.x, p.pos.z - cf.z) < 3.6) {
      g.heal(p.stats.maxHp * 0.08 * dt, false);
      p.mana = Math.min(p.stats.mana, p.mana + 12 * dt);
    }
  }
}

export function openHighChest(g, spot) {
  const ch = g.chests?.[spot.chestIdx];
  if (!ch || ch.opened) return false;
  ch.opened = true; ch.mesh.visible = false;
  g.spots = g.spots.filter(s => s !== spot);
  g.meta.p.coins += 18;
  const pool = Object.keys(ALL_GEMS);
  const gemId = pool[Math.floor(Math.random() * pool.length)];
  addGemToBag(g.meta.p, gemId);
  g.meta.save();
  g.dropItem(ch.x, ch.z, makeItem(Math.random, Math.floor(g.meta.p.level / 3) + 1, 2));
  g.audio.sfx('perfect');
  g.ui.toast(`高台秘寶箱！金幣 +18 · 寶石「${ALL_GEMS[gemId].name}」`, '#ffd85a');
  return true;
}

// ======================== 6. 採集節奏小遊戲 ========================
export function startGatherMini(g, spot, onFinish) {
  const root = document.getElementById('gatherMini');
  if (!root) { onFinish(false); return; }
  const label = root.querySelector('.gm-title');
  const needle = root.querySelector('.gm-needle');
  const icon = { wood: '🪓 砍伐香杉木', ore: '⛏ 開採星紋礦', fish: '🎣 垂釣溪銀魚' }[spot.kind] || '採集';
  label.textContent = `${icon} — 在金色區間按 [F] 或 [空白] 觸發完美採集！`;
  root.classList.remove('hide');
  const start = performance.now();
  const dur = 1350;
  let done = false;
  let raf = 0;

  const finish = (hit) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add('hide');
    g.gatherActive = null;
    const t = ((performance.now() - start) % dur) / dur;
    const pos = t < 0.5 ? t * 2 : (1 - t) * 2;
    const perfect = hit && pos >= 0.36 && pos <= 0.64;
    if (perfect) {
      g.audio.sfx('perfect');
      g.meta.p.deeds = g.meta.p.deeds || {};
      g.meta.p.deeds.perfectGather = (g.meta.p.deeds.perfectGather || 0) + 1;
    } else {
      g.audio.sfx(spot.kind === 'fish' ? 'splash' : spot.kind === 'ore' ? 'mine' : 'chop');
    }
    onFinish(perfect);
  };

  g.gatherActive = { trigger: () => finish(true), cancel: () => finish(false) };
  root.onclick = () => finish(true);
  const step = () => {
    if (done) return;
    const elapsed = performance.now() - start;
    if (elapsed > 2600) { finish(false); return; }
    const t = (elapsed % dur) / dur;
    const pos = t < 0.5 ? t * 2 : (1 - t) * 2;
    needle.style.left = (pos * 100).toFixed(1) + '%';
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

// ======================== 7. 可進入的室內房屋場景 ========================
export function buildInterior(g, kind) {
  const grp = new THREE.Group();
  const isTavern = kind === 'tavern';
  const W = isTavern ? 11 : 8, D = isTavern ? 9 : 7;
  // 木地板與溫馨牆面
  const parts = [
    part(new THREE.BoxGeometry(W, 0.25, D), isTavern ? 0x8d5b3c : 0xa5744e, 0, -0.12, 0),
    part(new THREE.BoxGeometry(W + 0.4, 3.2, 0.35), 0xf3e2c0, 0, 1.6, -D / 2),
    part(new THREE.BoxGeometry(0.35, 3.2, D), 0xebd4aa, -W / 2, 1.6, 0),
    part(new THREE.BoxGeometry(0.35, 3.2, D), 0xebd4aa, W / 2, 1.6, 0),
    // 地毯
    part(new THREE.BoxGeometry(W * 0.52, 0.04, D * 0.45), isTavern ? 0xb5483a : 0x4f8a7e, 0, 0.03, 0.2),
    // 門口墊子（走出回燈谷鎮）
    part(new THREE.BoxGeometry(2.0, 0.05, 0.9), 0xd8a85a, 0, 0.04, D / 2 - 0.55),
    // 壁爐
    part(new THREE.BoxGeometry(1.9, 2.2, 0.8), 0x8d837d, -W / 2 + 1.5, 1.1, -D / 2 + 0.5),
    part(new THREE.BoxGeometry(1.1, 0.9, 0.5), 0x342422, -W / 2 + 1.5, 0.45, -D / 2 + 0.72),
  ];
  if (isTavern) {
    // 酒館吧檯與酒桶
    parts.push(
      part(new THREE.BoxGeometry(4.4, 1.0, 0.9), 0x6b4530, 1.6, 0.5, -D / 2 + 1.5),
      part(new THREE.CylinderGeometry(0.35, 0.35, 0.85, 8), 0x9a643d, 3.9, 0.42, -D / 2 + 1.0),
      part(new THREE.BoxGeometry(1.8, 0.7, 1.2), 0x7a4c33, -2.5, 0.35, 1.2),
    );
  } else {
    // 旅人小屋床鋪、書架與烹飪鍋
    parts.push(
      part(new THREE.BoxGeometry(1.5, 0.55, 2.3), 0x7a4c33, 2.5, 0.28, -1.6),
      part(new THREE.BoxGeometry(1.35, 0.28, 1.7), 0xe8734a, 2.5, 0.65, -1.35),
      part(new THREE.BoxGeometry(1.25, 0.22, 0.45), 0xfff8e4, 2.5, 0.68, -2.4),
      part(new THREE.BoxGeometry(1.4, 2.0, 0.45), 0x6b4530, 0.2, 1.0, -D / 2 + 0.4),
    );
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), toonMat({ vertexColors: true }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  grp.add(mesh);

  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 5), new THREE.MeshBasicMaterial({ color: 0xffa83a }));
  fire.position.set(-W / 2 + 1.5, 0.35, -D / 2 + 0.8);
  grp.add(fire);
  const fl = new THREE.PointLight(0xffa048, 2.4, 9, 1.4);
  fl.position.set(-W / 2 + 1.5, 1.2, -D / 2 + 1.2);
  grp.add(fl);

  // 室內 NPC
  const npc = buildPlayer(isTavern ? 0xc060b0 : 0x6a6ad0, isTavern ? 0x904488 : 0x4a4aa0, 0xffd27a);
  npc.root.scale.setScalar(1.25);
  npc.root.position.set(isTavern ? 1.6 : 0.2, 0, isTavern ? -D / 2 + 0.7 : -D / 2 + 1.3);
  grp.add(npc.root);

  const spots = [
    { kind: 'exit_house', label: '推門回到燈谷鎮', x: 0, z: D / 2 - 0.6, top: 2.0 },
  ];
  if (isTavern) {
    spots.push(
      { kind: 'guild', label: '與酒館老闆娘楓管理公會／副本', x: 1.6, z: -D / 2 + 1.7, top: 2.4 },
      { kind: 'rest_time', label: '在壁爐旁小酌休息（回滿並切換晝夜）', x: -W / 2 + 1.5, z: -D / 2 + 1.5, top: 2.2 },
    );
  } else {
    spots.push(
      { kind: 'home', label: '家園升級、料理與轉職', x: 0.2, z: -D / 2 + 1.5, top: 2.4 },
      { kind: 'ascend', label: '向星燈導師進行二轉覺醒', x: -2.0, z: -1.0, top: 2.4 },
      { kind: 'rest_time', label: '在床鋪休息（回滿狀態並切換晝夜）', x: 2.5, z: -1.3, top: 2.2 },
    );
  }
  return { kind, group: grp, halfW: W / 2 - 0.7, halfD: D / 2 - 0.7, spots, fire, fireLight: fl };
}
