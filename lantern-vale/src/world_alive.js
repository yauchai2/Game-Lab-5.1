import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat } from './world.js';
import { buildPlayer } from './models.js';
import { mulberry32, clamp, lerp } from './util.js';
import { GOODS, FIELDS } from './frontier.js';
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

// ======================== 2. 八大原創二轉覺醒職業 ========================
export const SECOND_CLASSES = {
  0: [
    { id: 'bastion', name: '聖光堡壘', icon: '⚜', aura: 0xffe07a, gem: 'prism', trial: 'Lv.10 或完成 1 次完美採集', bonuses: { armor: 12, maxHp: 45 }, desc: '化身堅不可摧的光輝壁壘，解鎖「折光棱鏡」寶石。' },
    { id: 'earthwalker', name: '大地行者', icon: '⛰', aura: 0x8cd06a, gem: 'meteor', trial: 'Lv.10 或擊敗 5 隻敵人', bonuses: { area: 35, baseDmg: 8 }, desc: '與山谷地脈共鳴，解鎖「星隕天降」寶石。' },
  ],
  1: [
    { id: 'skywarden', name: '蒼穹馭風者', icon: '🪽', aura: 0x8ae8ff, gem: 'nova', trial: 'Lv.10 或滑翔穿過 1 個空中星環', bonuses: { moveSpd: 18, atkSpd: 15 }, desc: '駕馭高空上升氣流，解鎖「極光新星」寶石。' },
    { id: 'starhunter', name: '星痕獵手', icon: '🌠', aura: 0xffc864, gem: 'prism', trial: 'Lv.10 或擊敗 5 隻敵人', bonuses: { crit: 15, critMult: 40, proj: 1 }, desc: '箭矢化為星軌連射，解鎖「折光棱鏡」寶石。' },
  ],
  2: [
    { id: 'starcaller', name: '焚星賢者', icon: '☄', aura: 0xff7a40, gem: 'meteor', trial: 'Lv.10 或施放拼圖技能 5 次', bonuses: { addFire: 8, dmgPct: 22 }, desc: '引動天穹熾炎，解鎖「星隕天降」寶石。' },
    { id: 'frostweaver', name: '霜燈織夢師', icon: '❄', aura: 0x7ac8ff, gem: 'nova', trial: 'Lv.10 或在星夜探索一次', bonuses: { mana: 40, manaRegen: 50, cdr: 15 }, desc: '編織寒霜極光，解鎖「極光新星」寶石。' },
  ],
  3: [
    { id: 'crimsonblade', name: '緋月劍舞者', icon: '🌙', aura: 0xff6a8a, gem: 'phantom', trial: 'Lv.10 或擊敗 5 隻敵人', bonuses: { atkSpd: 25, critMult: 45 }, desc: '在月影中疾斬如風，解鎖「影霧幻陣」寶石。' },
    { id: 'mistphantom', name: '夜霧幻影師', icon: '🌫', aura: 0xb48ae0, gem: 'phantom', trial: 'Lv.10 或完成 1 次完美採集', bonuses: { rollCdr: 20, moveSpd: 15, crit: 12 }, desc: '操縱迷霧分身迷惑群敵，解鎖「影霧幻陣」寶石。' },
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

// ======================== 3. 野外 NPC 與支線任務 ========================
export const FIELD_NPCS = {
  1: { name: '採風畫家 柚子', col: 3, lines: ['晨光草原的雲影最美了！', '試著乘著上升氣流滑翔穿過空中星環吧！'], quest: { id: 'q_f1', title: '草原寫生委託', desc: '在晨光草原擊敗 3 隻敵人或採集 1 次素材', need: 3, rewardCoins: 20, rewardXp: 45 } },
  2: { name: '林木學者 阿松', col: 5, lines: ['古木林冠之間藏著不少高台寶箱。', '砍伐香杉木時抓準金色區間能收穫雙倍！'], quest: { id: 'q_f2', title: '林間生態調查', desc: '擊敗 4 隻森林怪物協助觀察生態', need: 4, rewardCoins: 28, rewardXp: 65 } },
  3: { name: '尋寶蛙客 咕嚕', col: 6, lines: ['霧潮沼澤的遺跡入口閃著紫光，帶著鑰石就能進副本！', '夜晚的沼澤螢火超漂亮，星砂也掉更多喔。'], quest: { id: 'q_f3', title: '沼澤秘聞收集', desc: '擊敗 4 隻沼澤怪物尋找古老碎片', need: 4, rewardCoins: 35, rewardXp: 85 } },
  4: { name: '觀星者 露露', col: 2, lines: ['雪原的暴風雪會讓採集收穫更豐富。', '在星夜抬頭看，連極光都好像近在咫尺。'], quest: { id: 'q_f4', title: '雪原星象觀測', desc: '擊敗 5 隻雪原怪物保護觀測站', need: 5, rewardCoins: 42, rewardXp: 110 } },
  5: { name: '鑄火匠 炎叔', col: 1, lines: ['火岩區的星紋礦品質最高！', '想切磋武藝的話，打開地圖可以開啟演武挑戰。'], quest: { id: 'q_f5', title: '熔岩礦脈清理', desc: '擊敗 5 隻火岩怪物確保採礦安全', need: 5, rewardCoins: 50, rewardXp: 140 } },
  6: { name: '古樹守望者 苔翁', col: 0, lines: ['你已走過整個燈谷……鹿王樹心就在前方。', '善用技能拼圖的相鄰連動，能發揮驚人力量。'], quest: { id: 'q_f6', title: '古樹淨化試煉', desc: '擊敗 6 隻古樹林怪物守護樹心', need: 6, rewardCoins: 65, rewardXp: 180 } },
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
  // 3 座上升氣流柱
  for (let i = 0; i < 3; i++) {
    const pos = g.world.randomWalkable(r, g.player.pos, 7);
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

    // 氣流附近的高空星環（滑翔穿過領獎！）
    const rx = pos.x + (r() - 0.5) * 10, rz = pos.z + (r() - 0.5) * 10;
    const ry = y + 3.6 + r() * 1.4;
    const sring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.14, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdc5e }),
    );
    sring.position.set(rx, ry, rz); sring.rotation.y = r() * Math.PI; sring.userData.noNormal = true;
    g.world.group.add(sring);
    g.skyRings.push({ x: rx, y: ry, z: rz, mesh: sring, got: false });
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
  return { group: grp, halfW: W / 2 - 0.7, halfD: D / 2 - 0.7, spots, fire, fireLight: fl };
}

// ======================== 8. 地區性地圖（Tab Minimap） ========================
export function drawRegionMap(g, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#3b2a2a';
  ctx.fillRect(0, 0, W, H);
  if (g.interior) {
    ctx.fillStyle = '#a5744e';
    ctx.fillRect(28, 28, W - 56, H - 56);
    ctx.fillStyle = '#ffd85a';
    ctx.beginPath();
    ctx.arc(W / 2 + g.player.pos.x * 16, H / 2 + g.player.pos.z * 16, 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const half = g.world.half || 30;
  const toX = x => ((x + half) / (half * 2)) * W;
  const toY = z => ((z + half) / (half * 2)) * H;

  // 地形底圖
  const step = 3;
  for (let py = 0; py < H; py += step) {
    const wz = (py / H) * half * 2 - half;
    for (let px = 0; px < W; px += step) {
      const wx = (px / W) * half * 2 - half;
      const k = g.world.idx(wx, wz);
      const t = k >= 0 ? g.world.T?.[k] : 0;
      ctx.fillStyle = t === 0 ? '#5b9ea8' : t === 1 ? '#8cb862' : t === 2 ? '#6e9450' : '#b2a288';
      ctx.fillRect(px, py, step, step);
    }
  }
  const dot = (x, z, col, r = 4) => {
    ctx.fillStyle = '#2b1d33'; ctx.beginPath(); ctx.arc(toX(x), toY(z), r + 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2); ctx.fill();
  };
  for (const u of g.updrafts || []) dot(u.x, u.z, '#9ef6ff', 3.5);
  for (const s of g.spots || []) {
    if (s.mesh?.visible === false) continue;
    const c = s.kind === 'grave' ? '#ff7070' : s.kind === 'chest' ? '#ffd85a' : s.kind === 'field_quest' ? '#ff9be0' : '#ffe9a0';
    dot(s.x, s.z, c, 3.5);
  }
  for (const cf of g.campfires || []) dot(cf.x, cf.z, '#ff8830', 4);
  for (const x of g.exits || []) dot(x.x, x.z, x.type === 'dungeon' ? '#c08cff' : x.type === 'town' ? '#58e09a' : '#6fe0d0', 5);
  for (const e of g.enemies || []) if (!e.dead) dot(e.pos.x, e.pos.z, e.legendary ? '#ff4a4a' : e.elite ? '#ffa83a' : '#e05050', e.legendary ? 5 : 2.8);
  // 玩家方向箭頭
  const px = toX(g.player.pos.x), py = toY(g.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-g.player.facing + Math.PI);
  ctx.fillStyle = '#fff8e4'; ctx.strokeStyle = '#2b1d33'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
