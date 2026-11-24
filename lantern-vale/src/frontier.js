import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, mulberry32 } from './util.js';
import { toonMat, part } from './world.js';
import { attachLandmarkGlb, attachPalmovPoi } from './assets.js';
import { FIELD_BLUEPRINTS, uvToWorld } from './field_blueprints.js';
import { makeItem, serializeItem, deserializeItem } from './loot.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { spawnSkyFeatures, startGatherMini, openHighChest, FIELD_NPCS } from './world_alive.js';
import { buildZoneLandmarks } from './harbor.js';
import { addGearToBag } from './physbag.js';
import { milestoneText } from './progression.js';
import { getFieldHotspot } from './mmo_protocol.js';

export const GOODS = { wood: '香杉木', ore: '星紋礦', fish: '溪銀魚' };
export const FIELDS = [
  null,
  { name: '晨光草原', level: 1, biome: 0, size: 240, beast: 'slime', dungeon: '草原洞窟', status: 'poison', layer: 'surface' },
  { name: '低語森林', level: 5, biome: 1, size: 360, beast: 'thorn', dungeon: '古木樹洞', grass: 0x719456, status: 'poison', layer: 'surface' },
  { name: '霧潮沼澤', level: 10, biome: 0, size: 240, beast: 'moth', dungeon: '沼澤遺跡', grass: 0x718c6f, fog: 0xa1b9ad, status: 'poison', layer: 'surface' },
  { name: '霜冬雪原', level: 15, biome: 2, size: 360, beast: 'boar', dungeon: '寒霜冰窟', fog: 0xdde8f4, status: 'freeze', layer: 'surface' },
  { name: '燼煙火岩區', level: 20, biome: 3, size: 240, beast: 'boar', dungeon: '燼岩熔爐', grass: 0xad7153, status: 'burn', layer: 'surface' },
  { name: '古樹林', level: 25, biome: 1, size: 400, beast: 'thorn', dungeon: '鹿王樹心', grass: 0x477252, status: 'poison', layer: 'surface' },
  { name: '浮空遺跡群', level: 12, biome: 0, size: 320, beast: 'skyray', dungeon: '星穹古塔', grass: 0x7bc87a, status: 'shock', layer: 'sky' },
  { name: '珊瑚潮汐灣', level: 18, biome: 0, size: 320, beast: 'skyray', dungeon: '潮汐海蝕洞', grass: 0xe8d089, status: 'freeze', layer: 'abyss' },
  { name: '沉沒電光都', level: 24, biome: 2, size: 320, beast: 'thorn', dungeon: '水沒變電塔', grass: 0x5c9ab0, fog: 0x7eb8d4, status: 'shock', layer: 'abyss' },
  { name: '櫻花水都', level: 14, biome: 0, size: 320, beast: 'moth', dungeon: '櫻花水宮', grass: 0x8cc868, status: 'chill', layer: 'sky' },
  { name: '蒼穹巨環谷', level: 22, biome: 0, size: 360, beast: 'skyray', dungeon: '天環聖殿', grass: 0x74c668, status: 'shock', layer: 'sky' },
  { name: '紅楓工坊谷', level: 28, biome: 1, size: 360, beast: 'golem', dungeon: '紅楓鍛造爐', grass: 0x98b44c, status: 'burn', layer: 'surface' },
  // Phase 4A：8 張截然不同風格的迷途漂流島（表界沙漠／叢林、沉淵哥德／深海、星穹科幻／異星）
  { name: '黃金風沙原', level: 18, biome: 4, size: 320, beast: 'boar', dungeon: '風沙神龕', status: 'burn', layer: 'surface', realmRule: 'sand_surf' },
  { name: '太陽金字塔聖殿', level: 26, biome: 4, size: 360, beast: 'golem', dungeon: '法老秘陵', status: 'burn', layer: 'surface', realmRule: 'sand_surf' },
  { name: '失落藤蔓神廟', level: 16, biome: 5, size: 320, beast: 'thorn', dungeon: '古藤地宮', status: 'poison', layer: 'surface', realmRule: 'vine_leap' },
  { name: '幽霧哥德墓園', level: 22, biome: 6, size: 320, beast: 'moth', dungeon: '亡靈地下墓穴', fog: 0x58527a, status: 'poison', layer: 'abyss', realmRule: 'lantern_glow' },
  { name: '深淵哥德古堡', level: 28, biome: 6, size: 360, beast: 'golem', dungeon: '古堡血月殿', fog: 0x4c446c, status: 'shock', layer: 'abyss', realmRule: 'lantern_glow' },
  { name: '深海螢光沉淵', level: 24, biome: 7, size: 340, beast: 'skyray', dungeon: '亞特蘭提斯海殿', fog: 0x52c4d4, status: 'freeze', layer: 'abyss', realmRule: 'low_gravity' },
  { name: '星際白銀前哨站', level: 27, biome: 8, size: 340, beast: 'golem', dungeon: '星艦核心反應爐', fog: 0xa8c8e8, status: 'shock', layer: 'sky', realmRule: 'overcharge' },
  { name: '異星蜂巢裂谷', level: 30, biome: 9, size: 360, beast: 'moth', dungeon: '異星母巢核心', fog: 0x9864b4, status: 'shock', layer: 'sky', realmRule: 'crystal_burst' },
];

// Phase v6：20 張野外地圖專屬巨型 Boss（2.2–2.8× 體型＋生態光環）
export const FIELD_BOSS_SPEC = {
  1:  { name: '🌻 晨光花靈王',   modelKey: 'boss_sunflora',         scale: 1.45, tint: 0xfff8dc, emissive: 0x5c4a1e, aura: 0xffe066 },
  2:  { name: '🐺 幽林巨狼王',   modelKey: 'werewolf',              scale: 1.85, tint: 0xd0e6c8, emissive: 0x2a4e36, aura: 0x56d884 },
  3:  { name: '🦀 沉船巨蟹王',   modelKey: 'crab_monster',          scale: 1.90, tint: 0xffd0c0, emissive: 0x5c2e24, aura: 0xff7852 },
  4:  { name: '❄️ 寒霜巨像王',   modelKey: 'golem_ice',             scale: 1.95, tint: 0xd8f4ff, emissive: 0x2c6896, aura: 0x72e4ff },
  5:  { name: '🐉 熾炎熔岩巨龍', modelKey: 'boss_dragon_inferno',   scale: 1.65, tint: 0xffe4cc, emissive: 0x8c2e14, aura: 0xff6228 },
  6:  { name: '🌳 磐岩古樹巨像', modelKey: 'golem_earth',           scale: 1.95, tint: 0xd6f0cc, emissive: 0x36623c, aura: 0x72e082 },
  7:  { name: '✨ 星穹風暴法王', modelKey: 'boss_wind_mage',        scale: 0.78, tint: 0xfff2c8, emissive: 0x6c5824, aura: 0xffdf70, rotX: -Math.PI / 2, yOffset: 2.1 },
  8:  { name: '🐚 潮汐寄居蟹王', modelKey: 'boss_hermit_king',      scale: 1.60, tint: 0xfff0dc, emissive: 0x3c5268, aura: 0x52d4f0 },
  9:  { name: '👁️ 雷鳴獨眼巨魔', modelKey: 'beholder',              scale: 1.95, tint: 0xc8ecff, emissive: 0x285c8c, aura: 0x48c8ff },
  10: { name: '👹 緋櫻惡鬼法師', modelKey: 'boss_evil_mage',        scale: 1.55, tint: 0xffd4e4, emissive: 0x782848, aura: 0xff82b4 },
  11: { name: '🌪️ 蒼穹疾風魔導', modelKey: 'boss_wind_mage',        scale: 0.80, tint: 0xd8f6ff, emissive: 0x286894, aura: 0x62d8ff, rotX: -Math.PI / 2, yOffset: 2.1 },
  12: { name: '🔥 鍛爐炎岩巨像', modelKey: 'golem_fire',            scale: 1.95, tint: 0xffd2b4, emissive: 0x843218, aura: 0xff7838 },
  13: { name: '🪱 沙暴巨蟲母皇', modelKey: 'boss_queen_worm',       scale: 1.65, tint: 0xffe6b8, emissive: 0x6e4820, aura: 0xf4c258 },
  14: { name: '🦂 黃金聖蠍王',   modelKey: 'scorpion_king',         scale: 1.95, tint: 0xffe4a0, emissive: 0x78521c, aura: 0xffd24a },
  15: { name: '🐍 叢林娜迦女王', modelKey: 'boss_snake_naga',       scale: 1.60, tint: 0xd6f6c4, emissive: 0x2e6434, aura: 0x6ee478 },
  16: { name: '💀 冥霧死神王',   modelKey: 'boss_grim_reaper',      scale: 1.65, tint: 0xdcc8ff, emissive: 0x543488, aura: 0xa66eff },
  17: { name: '⚔️ 血月黑騎士長', modelKey: 'black_knight',          scale: 1.95, tint: 0xe6d4ff, emissive: 0x6c2e54, aura: 0xff4c78 },
  18: { name: '🐙 深淵暗影魔龍', modelKey: 'boss_dragon_nightfall', scale: 1.65, tint: 0x98f2ff, emissive: 0x1e6c88, aura: 0x42e4ff },
  19: { name: '😈 軌道熾焰魔將', modelKey: 'flying_demon',          scale: 1.90, tint: 0xd8f0ff, emissive: 0x3072b4, aura: 0x58c4ff },
  20: { name: '🐉 異星暮光龍皇', modelKey: 'boss_dragon_nightfall', scale: 1.85, tint: 0xf4b4ff, emissive: 0x7e2ca4, aura: 0xe068ff },
};
export const progressDefaults = {
  level: 1, xp: 0, coins: 15, keys: 1, goods: { wood: 0, ore: 0, fish: 0 }, graves: {}, timers: {},
  gear: {}, species: {}, home: 0, mealUntil: 0, weapon: 'staff', gem: false, sales: [],
};
export function rememberGear(g) {
  g.meta.p.gear = Object.fromEntries(Object.entries(g.player.equip).map(([slot,it]) => [slot, serializeItem(it)]));
  g.meta.save();
}
export function restoreGear(g, player) {
  for (const [slot, item] of Object.entries(g.meta.p.gear)) {
    if (item && Object.hasOwn(player.equip, slot)) player.equip[slot] = deserializeItem(item);
  }
}
export function awardKill(g, enemy) {
  const p = g.meta.p;
  const autoOn = !!(g.autopilot && g.autopilot.mode !== 'off');
  const sparkMul = (!autoOn && (g.autopilot?.sparkBuffT || 0) > 0) ? 1.5 : 1;
  const level = enemy.level || Math.min(30, g.depth * 2 + 1);
  const lvDiff = level - (p.level || 1);
  const upwardMul = (!autoOn && lvDiff >= 3 && lvDiff <= 5) ? 1.25 : 1;
  const hotspotMul = (!autoOn && g.field && g.hotspots && getFieldHotspot(g.field, g.hotspots)?.kind === 'gold_tide') ? 1.4 : 1;
  const ferryMul = ((p.ferryBuffUntil || 0) > Date.now()) ? 1.1 : 1;
  const mult = (g.isNight ? 1.25 : 1) * (p.guildName ? 1.1 : 1) * (autoOn ? 0.30 : sparkMul) * upwardMul * hotspotMul * ferryMul;
  const xpGain = Math.max(1, Math.round((10 + level * (enemy.elite ? 4 : 2)) * mult));
  const rawCoins = enemy.elite ? 5 : 2;
  const coinGain = autoOn ? (Math.random() < 0.30 ? Math.max(1, Math.round(rawCoins * 0.5)) : 0) : Math.round(rawCoins * sparkMul);
  p.xp += xpGain;
  p.coins += coinGain;
  p.species[enemy.type] = (p.species[enemy.type] || 0) + 1;
  if (g.field && FIELD_NPCS[g.field]) {
    const qid = FIELD_NPCS[g.field].quest.id;
    p.fieldQuests = p.fieldQuests || {};
    const st = p.fieldQuests[qid] || { have: 0, done: false };
    if (!st.done) { st.have++; p.fieldQuests[qid] = st; }
  }
  while (p.level < 30 && p.xp >= p.level * 40) {
    p.xp -= p.level * 40; p.level++;
    g.ui.toast('旅人等級提升至 ' + p.level, '#ffdc80');
    const ms = milestoneText(p.level);
    if (ms) g.ui.toast(ms, '#7fe08a');
    g.recalc();
  }
  if (p.level === 30) p.xp = 0;
  let matGain = 0;
  if (g.field) {
    const material = ['wood','ore','fish'][(enemy.spawnIndex ?? 0) % 3];
    if (!autoOn) {
      matGain = enemy.elite ? 3 : 1;
      p.goods[material] += matGain;
      if (enemy.elite || enemy.legendary) {
        p.keys++;
        const pool = Object.keys(ALL_GEMS);
        const gemId = pool[Math.floor(Math.random() * pool.length)];
        addGemToBag(p, gemId);
        g.ui.toast(`獲得拼圖寶石：${ALL_GEMS[gemId].name}`, '#c08cff');
      }
      g.ui.toast(GOODS[material] + (enemy.elite ? ' +3 · 鑰石 +1' : ' +1'), '#ffe5a5');
    } else if (Math.random() < 0.35) {
      matGain = 1;
      p.goods[material] += 1;
    }
    if (enemy.spawnIndex != null) p.timers[g.field + ':mob:' + enemy.spawnIndex] = Date.now() + (enemy.legendary ? 90000 : 16000);
  }
  if (autoOn) g.onAutoKill?.({ xp: xpGain, coins: coinGain, mats: matGain });
  g.meta.save();
}
export function fieldBiome(i) {
  const field = FIELDS[i], base = BIOMES[field.biome];
  return { ...base, name: field.name, grass: field.grass ?? base.grass };
}
function marker(kind) {
  const group = new THREE.Group();
  const part = (geometry, color, y) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }));
    mesh.position.y = y; group.add(mesh); return mesh;
  };
  if (kind === 'wood') {
    part(new THREE.CylinderGeometry(.18,.24,1.5,6),0x835638,.75);
    part(new THREE.ConeGeometry(.95,2.1,7),0x527f56,1.8);
  } else if (kind === 'ore') {
    part(new THREE.IcosahedronGeometry(.8,0),0x82788f,.4);
    part(new THREE.OctahedronGeometry(.4),0xa9d3c9,1);
  } else if (kind === 'fish') {
    part(new THREE.CylinderGeometry(.9,1,.18,10),0x62aaa8,.12);
    part(new THREE.SphereGeometry(.28,6,4),0xe4c77f,.35).scale.set(1.6,.5,.7);
  } else if (kind.startsWith('shrine_')) {
    const col = kind === 'shrine_fury' ? 0xff6a38 : kind === 'shrine_frost' ? 0x62d8ff : 0xffd84a;
    part(new THREE.CylinderGeometry(0.75, 0.9, 0.32, 6), 0x8a857e, 0.16);
    part(new THREE.BoxGeometry(0.68, 1.95, 0.68), 0xaba59b, 1.15);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshBasicMaterial({ color: col }));
    crystal.position.y = 2.55; group.add(crystal);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 18), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.userData.noNormal = true; group.add(ring);
  } else if (kind === 'checkpoint') {
    part(new THREE.CylinderGeometry(1.15, 1.35, 0.28, 8), 0x8d95a0, 0.14);
    part(new THREE.CylinderGeometry(0.65, 0.8, 0.36, 8), 0xb8c4d0, 0.42);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), new THREE.MeshBasicMaterial({ color: 0x38d0ff }));
    crystal.position.y = 1.65; group.add(crystal);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.65, 22), new THREE.MeshBasicMaterial({ color: 0x38d0ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.userData.noNormal = true; group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.36, 7.5, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x52dcff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 4.0; beam.userData.noNormal = true; group.add(beam);
  } else {
    part(new THREE.BoxGeometry(.95,1.3,.42),0x76767b,.65);
    part(new THREE.OctahedronGeometry(.28),0xffd268,1.55);
  }
  return group;
}
function addSpot(g, kind, label, x, z) {
  const mesh = marker(kind);
  mesh.position.set(x, g.world.gh(x,z), z); g.world.group.add(mesh);
  g.spots.push({ kind, label, x, z, mesh, top: mesh.position.y + 2 });
}
function buildBlueprintLandmarks(g, bp) {
  const grp = new THREE.Group();
  const half = g.world.half;
  g.spinners = [];
  const place = (obj, x, z, obstR = 0) => {
    const y = g.world.gh(x, z);
    obj.position.set(x, y, z);
    grp.add(obj);
    if (obstR > 0) g.world.obstacles.push({ x, z, r: obstR, h: y });
    return obj;
  };
  const placeGlb = (key, x, z, fallbackObj, opts = {}, obstR = 0) => {
    const holder = new THREE.Group();
    place(holder, x, z, obstR);
    attachLandmarkGlb(holder, key, fallbackObj, opts);
    return holder;
  };
  const placePalmov = (key, x, z, opts = {}, obstR = 0) => {
    const holder = new THREE.Group();
    place(holder, x, z, obstR);
    attachPalmovPoi(holder, key, null, opts);
    return holder;
  };

  for (const poi of bp.pois || []) {
    const pos = uvToWorld(poi.x, poi.y, half);
    // 副本地城入口：統一加上低面立體岩洞拱門（4130）
    if (poi.k === 'dungeon') {
      placeGlb('cave_arch', pos.x, pos.z - 4.2, null, { scale: 1.15, rotY: 0, yOffset: -0.25 }, 0);
    }
    if (!poi.landmark) continue;
    if (poi.landmark === 'teapot_hill') {
      // #01 東北高丘：Palmov 真茶壺森林小屋＋蘑菇群（取代舊版幾何球拼裝茶壺）
      placePalmov('teapot_hill', pos.x, pos.z, { scale: 1.0, rotY: 0.25, yOffset: -0.25 }, 4.2);
    } else if (poi.landmark === 'waterfall_chest') {
      // #01 西北秘境：遠古巨石陣與林間秘寶木屋（撤除缺岩壁之藍塊瀑布）
      placeGlb('stonehenge', pos.x - 5.5, pos.z - 2.0, null, { scale: 1.0, rotY: 0.35, yOffset: -0.15 }, 2.0);
      placeGlb('cottage', pos.x + 6.0, pos.z + 2.5, null, { scale: 0.95, rotY: -0.5, yOffset: -0.15 }, 2.6);
    } else if (poi.landmark === 'cable_summit') {
      // #04 西北雪峰站：Palmov 滑雪纜車站
      placePalmov('ski_resort', pos.x, pos.z, { scale: 1.0, rotY: 0.35, yOffset: -0.25, emissive: 0x344252, emissiveIntensity: 0.28 }, 4.0);
    } else if (poi.landmark === 'ice_spires') {
      // #04 東北：Palmov 藍冰晶山峰群（偏移避開副本洞口 cave_arch，零封口穿模）
      placePalmov('crystal_mountain', pos.x - 11.5, pos.z + 5.0, { scale: 0.85, rotY: 0.25, yOffset: -0.25, emissive: 0x2c4e68, emissiveIntensity: 0.34 }, 3.4);
    } else if (poi.landmark === 'snow_cabin') {
      // #04 西側裂谷雪屋：著地雪山木屋（不放陸地船隻與碼頭）
      placeGlb('snow_house', pos.x, pos.z, null, { scale: 1.08, rotY: 0.45, yOffset: -0.15 }, 2.6);
    } else if (poi.landmark === 'cliff_lighthouse') {
      // #07 東側巨崖：著地燈塔＋守塔木屋（不因去底板導致浮空）
      placeGlb('lighthouse', pos.x, pos.z, null, { scale: 1.08, rotY: -0.4, yOffset: -0.2, emissive: 0x5c5246, emissiveIntensity: 0.45 }, 2.6);
      placeGlb('island_house', pos.x - 7.0, pos.z + 4.4, null, { scale: 1.0, rotY: 0.55, yOffset: -0.15, emissive: 0x564c40, emissiveIntensity: 0.42 }, 2.6);
    } else if (poi.landmark === 'star_aqueduct') {
      // #07 北端星穹斷柱水道：Palmov 古羅馬列柱遺址（偏移避開副本洞口 cave_arch，零穿模重疊）
      placePalmov('roman_ruins', pos.x - 10.5, pos.z + 7.5, { scale: 0.85, rotY: 0.25, yOffset: -0.25 }, 3.2);
    } else if (poi.landmark === 'birch_cabin') {
      // #02 西南：Palmov 白樺荒野廢屋（已剔除現代破轎車）
      placePalmov('abandoned_house', pos.x, pos.z, { scale: 1.0, rotY: 0.35, yOffset: -0.25 }, 3.2);
    } else if (poi.landmark === 'canopy_vault') {
      // #02 東北樹冠秘境：林間秘庫木屋＋發光巨菇群（撤除缺岩壁藍塊瀑布與舊風車）
      placeGlb('forest_cabin', pos.x, pos.z, null, { scale: 1.08, rotY: -0.35, yOffset: -0.15, emissive: 0x3a3428, emissiveIntensity: 0.36 }, 2.8);
      placeGlb('giant_shroom', pos.x - 6.2, pos.z + 3.5, null, { scale: 1.15, rotY: 0.5, yOffset: -0.1, tint: 0x9ef0b8, emissive: 0x206844, emissiveIntensity: 0.42 }, 1.4);
      placeGlb('giant_shroom', pos.x + 6.0, pos.z + 2.8, null, { scale: 0.95, rotY: 1.8, yOffset: -0.1, tint: 0x9ef0b8, emissive: 0x206844, emissiveIntensity: 0.42 }, 1.2);
    } else if (poi.landmark === 'forest_tomb') {
      // #02 東南古墓凹地：Palmov 哥德古墓石堂（已清除 [WALL] 鑿平）
      placePalmov('cemetery_church', pos.x, pos.z, { scale: 0.80, rotY: 0.2, yOffset: -0.25 }, 3.5);
    } else if (poi.landmark === 'kraken_wreck') {
      // #03 中央：Palmov 真海怪巨型觸手纏繞沉船（已剔除陸地散落小艇）
      placePalmov('kraken_wreck', pos.x, pos.z, { scale: 1.05, rotY: 0.35, yOffset: -0.25 }, 4.2);
    } else if (poi.landmark === 'stilt_village') {
      // #03 東側：著地沼澤木屋聚落＋螢光巨菇（徹底移除懸空吊橋與陸地船隻）
      placeGlb('beach_house', pos.x - 3.5, pos.z - 2.0, null, { scale: 1.05, rotY: -0.45, yOffset: -0.15, emissive: 0x3a342a, emissiveIntensity: 0.36 }, 2.8);
      placeGlb('fishing_hut', pos.x + 5.2, pos.z + 2.4, null, { scale: 1.0, rotY: 0.5, yOffset: -0.15, emissive: 0x3a342a, emissiveIntensity: 0.36 }, 2.6);
      placeGlb('giant_shroom', pos.x - 6.8, pos.z + 4.2, null, { scale: 1.05, rotY: 0.3, yOffset: -0.1, tint: 0xa4f4e0, emissive: 0x26786a, emissiveIntensity: 0.42 }, 1.2);
    } else if (poi.landmark === 'shroom_grove') {
      // #03 北礁螢光巨菇群
      placeGlb('giant_shroom', pos.x, pos.z, null, { scale: 1.35, rotY: 0.2, yOffset: -0.1, tint: 0xa4f4e0, emissive: 0x26786a, emissiveIntensity: 0.42 }, 1.6);
      placeGlb('giant_shroom', pos.x + 4.8, pos.z + 2.8, null, { scale: 1.0, rotY: 1.4, yOffset: -0.1, tint: 0xa4f4e0, emissive: 0x26786a, emissiveIntensity: 0.42 }, 1.2);
    } else if (poi.landmark === 'ember_furnace') {
      // #05 東北：燼岩熔爐高台
      placeGlb('forge_furnace', pos.x - 5.5, pos.z + 2.0, null, { scale: 1.2, rotY: 0.35, yOffset: -0.15, emissive: 0x622614, emissiveIntensity: 0.45 }, 2.4);
      placeGlb('red_crystal', pos.x + 5.8, pos.z + 1.5, null, { scale: 1.15, rotY: -0.4, yOffset: -0.15, tint: 0xffc6a8, emissive: 0xa42a12, emissiveIntensity: 0.44 }, 1.6);
    } else if (poi.landmark === 'lava_arena') {
      // #05 中央熔岩演武孤島：四方立體多面火紅晶簇
      for (const [ox, oz, ry] of [[-7.2, -5.5, 0.4], [7.2, -5.5, -0.5], [-7.0, 5.8, 1.2], [7.0, 5.8, -1.1]]) {
        placeGlb('red_crystal', pos.x + ox, pos.z + oz, null, { scale: 1.0, rotY: ry, yOffset: -0.2, tint: 0xffc4a2, emissive: 0x9e2810, emissiveIntensity: 0.42 }, 1.4);
      }
    } else if (poi.landmark === 'mine_trestle') {
      // #05 西崖：著地鍛造熔爐＋礦車列＋火紅晶簇（撤除過大中空灰岩外殼 coal_mine）
      placeGlb('forge_furnace', pos.x + 2.5, pos.z - 1.5, null, { scale: 1.15, rotY: 0.5, yOffset: -0.15, emissive: 0x622614, emissiveIntensity: 0.44 }, 2.2);
      placeGlb('mine_cart', pos.x + 6.5, pos.z + 1.5, null, { scale: 1.4, rotY: 0.3, yOffset: -0.05 }, 1.5);
      placeGlb('mine_cart', pos.x + 9.5, pos.z + 3.5, null, { scale: 1.35, rotY: 0.35, yOffset: -0.05 }, 1.5);
      placeGlb('red_crystal', pos.x + 3.5, pos.z + 4.8, null, { scale: 1.1, rotY: -0.4, yOffset: -0.15, tint: 0xffc6a8, emissive: 0xa42a12, emissiveIntensity: 0.44 }, 1.4);
    } else if (poi.landmark === 'redrock_oasis') {
      // #05 東南：Palmov 紅岩瀑布綠洲
      placePalmov('redrock_oasis', pos.x, pos.z, { scale: 1.0, rotY: -0.35, yOffset: -0.25, emissive: 0x3e2c22, emissiveIntensity: 0.26 }, 3.5);
    } else if (poi.landmark === 'ancient_pagoda') {
      // #06 西北：遠古巨石聖壇與螢光巨菇林（無違合日式寺廟、無缺壁藍塊）
      placeGlb('stonehenge', pos.x - 6.0, pos.z - 2.0, null, { scale: 1.15, rotY: 0.35, yOffset: -0.15 }, 2.2);
      placeGlb('stonehenge', pos.x + 6.5, pos.z + 2.5, null, { scale: 1.05, rotY: -0.45, yOffset: -0.15 }, 2.0);
      placeGlb('giant_shroom', pos.x, pos.z + 5.8, null, { scale: 1.25, rotY: 1.1, yOffset: -0.1, tint: 0x9cf8e4, emissive: 0x268276, emissiveIntensity: 0.46 }, 1.5);
    } else if (poi.landmark === 'spirit_terrace') {
      // #06 東坡：Palmov 天然三疊石泉池
      placePalmov('hot_springs', pos.x, pos.z, { scale: 0.95, rotY: 0.4, yOffset: -0.25 }, 3.2);
    } else if (poi.landmark === 'world_tree_core') {
      // #06 中央：Palmov 古木森山林核（置於 Boss 戰場北側作為壯闊背景山峰，不埋沒 Boss 與檢查點）
      placePalmov('mountain_forest', pos.x, pos.z - 13.5, { scale: 0.90, rotY: 0.25, yOffset: -0.25 }, 3.6);
    } else if (poi.landmark === 'forest_camp') {
      placeGlb('forest_cabin', pos.x, pos.z, null, { scale: 1.05, rotY: -0.4, yOffset: -0.15, emissive: 0x3a3428, emissiveIntensity: 0.35 }, 2.6);
    } else if (poi.landmark === 'pirate_fort') {
      // #08 西側：Palmov 擱淺海盜帆船崖堡（山崖瞭望台＋木梯帆船）
      placePalmov('mountain_ship', pos.x, pos.z, { scale: 1.05, rotY: 0.4, yOffset: -0.25 }, 4.2);
    } else if (poi.landmark === 'coconut_beach') {
      // #08 東南：椰林釣魚金沙灘
      placeGlb('beach_house', pos.x, pos.z, null, { scale: 1.05, rotY: -0.5, yOffset: -0.15, emissive: 0x443c32, emissiveIntensity: 0.38 }, 2.8);
      placeGlb('coconut_tree', pos.x - 6.2, pos.z + 3.2, null, { scale: 1.2, rotY: 0.3, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
      placeGlb('coconut_tree', pos.x + 5.8, pos.z - 2.5, null, { scale: 1.1, rotY: 2.0, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
    } else if (poi.landmark === 'coral_reef') {
      placeGlb('coconut_tree', pos.x - 3.5, pos.z - 2.0, null, { scale: 1.15, rotY: 0.6, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
      placeGlb('beach_house', pos.x + 3.5, pos.z + 1.5, null, { scale: 0.95, rotY: -0.6, yOffset: -0.15, emissive: 0x443c32, emissiveIntensity: 0.38 }, 2.4);
    } else if (poi.landmark === 'tesla_tower') {
      // #09 西北：水沒變電巨塔（燈塔往西側偏移避開副本岩洞 cave_arch，零穿模重疊）
      placeGlb('lighthouse', pos.x - 9.0, pos.z + 1.5, null, { scale: 1.12, rotY: 0.25, yOffset: -0.2, tint: 0xb8e6ff, emissive: 0x26547a, emissiveIntensity: 0.45 }, 2.6);
      placeGlb('ice_crystal', pos.x - 5.5, pos.z + 5.0, null, { scale: 1.0, rotY: 0.4, yOffset: -0.15, flatTint: 0x62e2ff, emissive: 0x2896d8, emissiveIntensity: 0.55 }, 1.4);
      placeGlb('ice_crystal', pos.x + 6.5, pos.z + 3.5, null, { scale: 1.0, rotY: -0.4, yOffset: -0.15, flatTint: 0x62e2ff, emissive: 0x2896d8, emissiveIntensity: 0.55 }, 1.4);
    } else if (poi.landmark === 'stilt_plaza' || poi.landmark === 'market_pier') {
      // #09 著地海灣電光屋舍廣場（徹底移除陸地大帆船與懸空木碼頭）
      placeGlb('island_house', pos.x - 4.5, pos.z - 2.5, null, { scale: 1.05, rotY: -0.45, yOffset: -0.15, tint: 0xd0e8f8, emissive: 0x2c465c, emissiveIntensity: 0.38 }, 2.6);
      placeGlb('fishing_hut', pos.x + 6.2, pos.z + 2.5, null, { scale: 1.0, rotY: 0.55, yOffset: -0.15, tint: 0xd0e8f8, emissive: 0x2c465c, emissiveIntensity: 0.38 }, 2.4);
    } else if (poi.landmark === 'clock_roof') {
      placeGlb('snow_tower', pos.x, pos.z, null, { scale: 1.05, rotY: 0.3, yOffset: -0.15, tint: 0xc8dce8, emissive: 0x2e465c, emissiveIntensity: 0.38 }, 2.6);
    } else if (poi.landmark === 'sakura_shrine') {
      // #10 西北：奇幻粉櫻林園與湖畔木屋（偏移避開副本岩洞，無違合日式城堡、無缺壁藍塊）
      placeGlb('island_house', pos.x - 8.5, pos.z + 2.5, null, { scale: 1.0, rotY: 0.5, yOffset: -0.15, emissive: 0x52463e, emissiveIntensity: 0.42 }, 2.5);
      placeGlb('sakura_tree', pos.x - 6.0, pos.z + 7.5, null, { scale: 1.25, rotY: 0.4, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.4);
      placeGlb('sakura_tree', pos.x + 7.5, pos.z + 3.5, null, { scale: 1.2, rotY: -0.5, yOffset: -0.15, flatTint: 0xffcce6, emissive: 0xc86492, emissiveIntensity: 0.52 }, 1.4);
    } else if (poi.landmark === 'sakura_bridge') {
      // #10 中央：花林水岸木屋與粉櫻樹群（無日式寺廟／鳥居圍牆）
      placeGlb('cottage', pos.x - 6.5, pos.z - 2.5, null, { scale: 1.0, rotY: 0.4, yOffset: -0.15 }, 2.6);
      placeGlb('sakura_tree', pos.x + 6.5, pos.z - 2.8, null, { scale: 1.18, rotY: 1.1, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.4);
    } else if (poi.landmark === 'sea_torii_island') {
      // #10 西南：花林湖心天然石泉
      placePalmov('hot_springs', pos.x, pos.z, { scale: 0.92, rotY: 0.35, yOffset: -0.25 }, 3.2);
      placeGlb('sakura_tree', pos.x - 6.0, pos.z + 2.5, null, { scale: 1.15, rotY: 0.8, yOffset: -0.15, flatTint: 0xffc4e0, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.3);
    } else if (poi.landmark === 'tea_house') {
      // #10 東北：花林湖畔茶舍木屋
      placeGlb('island_house', pos.x, pos.z, null, { scale: 1.0, rotY: -0.45, yOffset: -0.15, emissive: 0x52463e, emissiveIntensity: 0.42 }, 2.5);
      placeGlb('sakura_tree', pos.x + 5.8, pos.z + 2.4, null, { scale: 1.15, rotY: 0.3, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.3);
    } else if (poi.landmark === 'canyon_train') {
      // #11 西段：著地峽谷礦車列（不使用懸空水谷橋）
      placeGlb('mine_cart', pos.x - 3.5, pos.z, null, { scale: 1.55, rotY: 0.5, yOffset: -0.05 }, 1.8);
      placeGlb('mine_cart', pos.x + 0.5, pos.z - 2.0, null, { scale: 1.50, rotY: 0.5, yOffset: -0.05 }, 1.8);
      placeGlb('mine_cart', pos.x + 4.5, pos.z - 4.0, null, { scale: 1.45, rotY: 0.5, yOffset: -0.05 }, 1.8);
    } else if (poi.landmark === 'mega_sky_ring') {
      // #11 中段：保留標誌性卡比風斜嵌碧藍加速巨環
      const ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 1.35, 8, 24, Math.PI), toonMat({ color: 0x58c8f8, emissive: 0x1e6ca8, emissiveIntensity: 0.35 }));
      ring.rotation.y = 0.25; ring.castShadow = true;
      place(ring, pos.x, pos.z, 0);
    } else if (poi.landmark === 'sky_sanctum') {
      // #11 東北：白雪尖峰天環聖殿
      placeGlb('snow_tower', pos.x - 5.5, pos.z + 2.5, null, { scale: 1.05, rotY: 0.35, yOffset: -0.15 }, 2.6);
      placeGlb('ice_crystal', pos.x + 6.0, pos.z + 2.2, null, { scale: 1.15, rotY: -0.3, yOffset: -0.15, flatTint: 0xa4ecff, emissive: 0x3b8ec4, emissiveIntensity: 0.42 }, 1.5);
    } else if (poi.landmark === 'alpine_camp') {
      // #11 東南：Palmov 高山秋林帳篷營地（微調往草地高坡，避免帳篷踩水）
      placePalmov('alpine_camp', pos.x - 3.5, pos.z - 4.0, { scale: 0.88, rotY: -0.4, yOffset: -0.25 }, 3.2);
    } else if (poi.landmark === 'maple_foundry') {
      // #12 東北：紅楓鍛造爐高台（4137 秋楓鐵匠工坊＋4130 鍛造熔爐＋火紅晶簇）
      placeGlb('blacksmith', pos.x - 6.2, pos.z + 3.2, null, { scale: 1.1, rotY: 0.4, yOffset: -0.15, emissive: 0x483024, emissiveIntensity: 0.36 }, 3.0);
      placeGlb('forge_furnace', pos.x + 6.2, pos.z + 2.5, null, { scale: 1.2, rotY: -0.5, yOffset: -0.15, emissive: 0x622614, emissiveIntensity: 0.45 }, 2.4);
    } else if (poi.landmark === 'forge_plaza') {
      // #12 東側：巨像鍛造廣場（秋楓鍛造屋＋立體火紅星晶）
      placeGlb('blacksmith', pos.x - 8.5, pos.z - 3.5, null, { scale: 1.15, rotY: 0.35, yOffset: -0.15, emissive: 0x583c2c, emissiveIntensity: 0.44 }, 3.0);
      placeGlb('red_crystal', pos.x + 8.0, pos.z - 2.8, null, { scale: 1.1, rotY: -0.5, yOffset: -0.15, tint: 0xffc6a8, emissive: 0x9e2c14, emissiveIntensity: 0.44 }, 1.6);
    } else if (poi.landmark === 'sheep_barn') {
      // #12 西南：保留旋轉風車塔＋Palmov 豐收紅穀倉牧場（已剔除綠色 SUV）
      const millRig = new THREE.Group();
      const millY = g.world.gh(pos.x, pos.z);
      millRig.position.set(pos.x, millY, pos.z);
      millRig.rotation.y = 0.4;
      grp.add(millRig);
      g.world.obstacles.push({ x: pos.x, z: pos.z, r: 3.0, h: millY });
      attachLandmarkGlb(millRig, 'windmill', null, { scale: 1.0, yOffset: -0.2 });
      const bladeHub = new THREE.Group();
      bladeHub.position.set(0, 6.4, 2.35);
      millRig.add(bladeHub);
      attachLandmarkGlb(bladeHub, 'windmill_blades', null, { scale: 1.0 });
      g.spinners.push({ obj: bladeHub, axis: 'z', speed: -0.5 });
      placePalmov('autumn_harvest', pos.x + 11.5, pos.z + 5.5, { scale: 0.95, rotY: -0.5, yOffset: -0.25 }, 3.8);
    } else if (poi.landmark === 'maple_onsen') {
      // #12 西北：Palmov 三疊秋楓露天溫泉石池
      placePalmov('hot_springs', pos.x, pos.z, { scale: 1.0, rotY: 0.35, yOffset: -0.25 }, 3.5);
    }
  }

  // 各張地圖起點迎賓地標（讓玩家一進入地圖就看見高辨識度 3D 實模！）
  if (bp.id === 1) {
    // #01 西南風車南瓜農莊（4137 直立木石風車塔＋動態旋轉四翼大扇葉＋農舍木屋＋南瓜田）
    const farmPos = uvToWorld(0.24, 0.74, half);
    const millRig = new THREE.Group();
    const millY = g.world.gh(farmPos.x, farmPos.z);
    millRig.position.set(farmPos.x, millY, farmPos.z);
    millRig.rotation.y = 0.28;
    grp.add(millRig);
    g.world.obstacles.push({ x: farmPos.x, z: farmPos.z, r: 3.0, h: millY });

    const fbFarm = new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(1.5, 2.3, 6.2, 8), 0xf5e8d0, 0, 3.1, 0),
      part(new THREE.ConeGeometry(2.1, 2.1, 8), 0xd85842, 0, 7.2, 0),
    ]), toonMat({ vertexColors: true }));
    attachLandmarkGlb(millRig, 'windmill', fbFarm, { scale: 1.0, yOffset: -0.2 });

    // 直立旋轉四翼扇葉掛載於風車塔正面
    const bladeHub = new THREE.Group();
    bladeHub.position.set(0, 6.4, 2.35);
    millRig.add(bladeHub);
    attachLandmarkGlb(bladeHub, 'windmill_blades', null, { scale: 1.0 });
    g.spinners.push({ obj: bladeHub, axis: 'z', speed: -0.55 });

    placeGlb('cottage', farmPos.x - 9.0, farmPos.z + 6.8, null, { scale: 1.0, rotY: 0.8, yOffset: -0.15 }, 2.8);
    // 南瓜田
    const pumpkins = new THREE.Mesh(mergeGeometries([
      part(new THREE.SphereGeometry(0.6, 7, 5), 0xf08228, 4.4, 0.48, 2.4),
      part(new THREE.SphereGeometry(0.5, 7, 5), 0xe86c20, 5.5, 0.40, 3.2),
      part(new THREE.SphereGeometry(0.55, 7, 5), 0xf59234, 4.0, 0.44, 3.9),
      part(new THREE.SphereGeometry(0.48, 7, 5), 0xeb7624, 6.2, 0.38, 2.2),
    ]), toonMat({ vertexColors: true }));
    pumpkins.castShadow = true;
    place(pumpkins, farmPos.x, farmPos.z, 0);
  } else if (bp.id === 2) {
    const startP = uvToWorld(0.36, 0.82, half);
    placeGlb('giant_shroom', startP.x + 5.5, startP.z - 3.5, null, { scale: 1.1, rotY: 0.4, yOffset: -0.1 }, 1.2);
  } else if (bp.id === 4) {
    // #04 南坡雪營起點旁：雪山木屋＋淡冰晶標誌
    const campPos = uvToWorld(0.18, 0.78, half);
    placeGlb('snow_house', campPos.x, campPos.z, null, { scale: 1.0, rotY: -0.5, yOffset: -0.15 }, 2.6);
    placeGlb('ice_crystal', campPos.x + 6.5, campPos.z - 4.0, null, { scale: 0.75, rotY: 0.4, yOffset: -0.15, flatTint: 0xa4ecff, emissive: 0x3b8ec4, emissiveIntensity: 0.42 }, 1.2);
  } else if (bp.id === 5) {
    const startP = uvToWorld(0.26, 0.80, half);
    placeGlb('red_crystal', startP.x + 6.0, startP.z - 3.2, null, { scale: 0.95, rotY: 0.3, yOffset: -0.15, flatTint: 0xff6e38, emissive: 0xd43818, emissiveIntensity: 0.52 }, 1.4);
  } else if (bp.id === 7) {
    // #07 南島浮空碼頭起點：4379 浮空島木屋＋4167 古石陣
    const dockPos = uvToWorld(0.19, 0.82, half);
    placeGlb('island_house', dockPos.x, dockPos.z, null, { scale: 0.95, rotY: -0.5, yOffset: -0.15, emissive: 0x463e34, emissiveIntensity: 0.40 }, 2.5);
    placeGlb('stonehenge', dockPos.x - 6.8, dockPos.z - 3.0, null, { scale: 0.85, rotY: 0.5, yOffset: -0.15 }, 1.8);
  } else if (bp.id === 8) {
    // #08 南岸椰林迎賓金沙灘
    const startP = uvToWorld(0.46, 0.80, half);
    placeGlb('beach_house', startP.x + 6.5, startP.z - 2.0, null, { scale: 0.95, rotY: -0.45, yOffset: -0.15, emissive: 0x443c32, emissiveIntensity: 0.38 }, 2.6);
    placeGlb('coconut_tree', startP.x - 5.5, startP.z - 3.5, null, { scale: 1.15, rotY: 0.6, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
  } else if (bp.id === 10) {
    // #10 東南落櫻南堤起點：粉嫩櫻花樹林（不放違合鳥居寺廟）
    const startP = uvToWorld(0.80, 0.78, half);
    placeGlb('sakura_tree', startP.x - 6.0, startP.z - 2.0, null, { scale: 1.15, rotY: 0.3, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.3);
    placeGlb('sakura_tree', startP.x + 5.8, startP.z - 3.0, null, { scale: 1.05, rotY: 1.6, yOffset: -0.15, flatTint: 0xffcce6, emissive: 0xc86492, emissiveIntensity: 0.52 }, 1.3);
  } else if (bp.id === 13) {
    // #13 黃金風沙原：既有 4351 埃及遺跡 ＋ 東北阿拉伯沙城（arab castle）
    const pOasis = uvToWorld(0.28, 0.34, half);
    placeGlb('egypt_house', pOasis.x - 6.5, pOasis.z - 4.0, null, { scale: 1.15, rotY: 0.5, yOffset: -0.15, tint: 0xffe4b8, emissive: 0x624628, emissiveIntensity: 0.38 }, 2.6);
    placeGlb('egypt_obelisk', pOasis.x + 7.0, pOasis.z - 5.5, null, { scale: 1.1, rotY: -0.3, yOffset: -0.15, tint: 0xf6cf92, emissive: 0x5c4224, emissiveIntensity: 0.36 }, 1.6);
    const pCast = uvToWorld(0.76, 0.65, half);
    placePalmov('arab_castle', pCast.x, pCast.z, { scale: 0.95, rotY: -0.4, yOffset: -0.25 }, 4.2);
    const pStart = uvToWorld(0.22, 0.78, half);
    placeGlb('egypt_obelisk', pStart.x - 6.5, pStart.z - 6.0, null, { scale: 1.05, rotY: 0.4, yOffset: -0.15, tint: 0xf4cc8c, emissive: 0x5c4224, emissiveIntensity: 0.38 }, 1.5);
    placeGlb('egypt_house', pStart.x + 8.0, pStart.z - 5.0, null, { scale: 1.05, rotY: -0.7, yOffset: -0.15, tint: 0xffe6bc, emissive: 0x604426, emissiveIntensity: 0.38 }, 2.4);
    const pTower = uvToWorld(0.78, 0.68, half);
    placeGlb('egypt_sphinx', pTower.x, pTower.z - 4.5, null, { scale: 1.0, rotY: -0.8, yOffset: -0.15, tint: 0xf5cc88, emissive: 0x604624, emissiveIntensity: 0.36 }, 3.0);
  } else if (bp.id === 14) {
    // #14 太陽金字塔聖殿：主金字塔置於 Boss 祭壇北側（留出開闊儀式廣場，不吞沒黃金聖蠍王與玩家）
    const pMid = uvToWorld(0.50, 0.48, half);
    placeGlb('egypt_pyramid', pMid.x, pMid.z - 15.5, null, { scale: 1.25, rotY: 0.0, yOffset: -0.25, tint: 0xf8d89c, emissive: 0x6a4e26, emissiveIntensity: 0.38 }, 5.5);
    placeGlb('egypt_sphinx', pMid.x - 12.5, pMid.z + 4.5, null, { scale: 1.15, rotY: 0.6, yOffset: -0.15, tint: 0xf6d08e, emissive: 0x624824, emissiveIntensity: 0.38 }, 3.2);
    placeGlb('egypt_obelisk', pMid.x + 12.0, pMid.z + 4.0, null, { scale: 1.15, rotY: -0.4, yOffset: -0.15, tint: 0xf8d698, emissive: 0x644a26, emissiveIntensity: 0.38 }, 1.6);
    const pSouth = uvToWorld(0.50, 0.82, half);
    placeGlb('egypt_pyramid', pSouth.x + 11.5, pSouth.z - 12.5, null, { scale: 1.05, rotY: 0.2, yOffset: -0.2, tint: 0xf8d89c, emissive: 0x6a4e26, emissiveIntensity: 0.38 }, 4.5);
    placeGlb('egypt_sphinx', pSouth.x - 8.5, pSouth.z - 7.5, null, { scale: 1.05, rotY: 0.75, yOffset: -0.15, tint: 0xf6d08e, emissive: 0x624824, emissiveIntensity: 0.38 }, 2.8);
    placeGlb('egypt_sarcophagus', pSouth.x + 6.5, pSouth.z - 4.5, null, { scale: 1.25, rotY: -0.5, yOffset: -0.1, tint: 0xffd87c, emissive: 0x6e4c1e, emissiveIntensity: 0.44 }, 1.5);
  } else if (bp.id === 15) {
    // #15 失落藤蔓神廟：古神廟石牆、石像、石柱、棧道 ＋ Palmov 瀑布熱帶神廟（tropical ruins）
    const pMid = uvToWorld(0.50, 0.52, half);
    placeGlb('jungle_ruin_wall', pMid.x, pMid.z - 6.0, null, { scale: 1.15, rotY: 0.15, yOffset: -0.2, tint: 0xc8c0a6, emissive: 0x3a4830, emissiveIntensity: 0.38 }, 3.0);
    placeGlb('jungle_statue', pMid.x - 7.5, pMid.z - 3.5, null, { scale: 1.1, rotY: 0.5, yOffset: -0.15, tint: 0xd0c6aa, emissive: 0x3e4c32, emissiveIntensity: 0.40 }, 1.8);
    placeGlb('jungle_pillar', pMid.x + 7.5, pMid.z - 3.0, null, { scale: 1.1, rotY: -0.3, yOffset: -0.15, tint: 0xcac2a8, emissive: 0x3c4830, emissiveIntensity: 0.38 }, 1.4);
    placePalmov('tropical_ruins', pMid.x + 11.5, pMid.z - 10.5, { scale: 0.95, rotY: -0.35, yOffset: -0.25 }, 3.8);
    const pStart = uvToWorld(0.20, 0.80, half);
    placeGlb('jungle_statue', pStart.x - 6.0, pStart.z - 5.5, null, { scale: 1.05, rotY: 0.6, yOffset: -0.15, tint: 0xd0c6aa, emissive: 0x3e4c32, emissiveIntensity: 0.40 }, 1.6);
    placeGlb('jungle_ruin_wall', pStart.x + 7.5, pStart.z - 7.5, null, { scale: 0.95, rotY: -0.5, yOffset: -0.2, tint: 0xc8c0a6, emissive: 0x3a4830, emissiveIntensity: 0.38 }, 2.6);
    placeGlb('lost_stonewalk', pStart.x - 1.5, pStart.z - 8.5, null, { scale: 0.55, rotY: 0.4, yOffset: -0.25, tint: 0xd8cca8, emissive: 0x443c2c, emissiveIntensity: 0.34 }, 0);
  } else if (bp.id === 16 || bp.id === 17) {
    // #16 幽霧哥德墓園 ＆ #17 深淵哥德古堡：Palmov 真哥德教堂鬼屋墓園（拔除染紫主城鐘樓）＋骷髏祭壇＋紫晶柱
    const pStart = uvToWorld(bp.id === 16 ? 0.22 : 0.16, bp.id === 16 ? 0.78 : 0.80, half);
    placeGlb('cave_skull', pStart.x + 8.5, pStart.z - 8.5, null, { scale: 1.1, rotY: -0.6, yOffset: -0.15, flatTint: 0x6a628c, emissive: 0x463274, emissiveIntensity: 0.50 }, 2.8);
    placeGlb('purple_crystal', pStart.x + 5.5, pStart.z - 3.5, null, { scale: 0.95, rotY: 0.4, yOffset: -0.1, flatTint: 0xb872ff, emissive: 0x7c38d8, emissiveIntensity: 0.62 }, 1.2);
    placeGlb('fire_torch', pStart.x - 3.8, pStart.z - 4.2, null, { scale: 1.15, rotY: 0, yOffset: -0.1, emissive: 0xff8c38, emissiveIntensity: 0.65 }, 0.5);
    const pBoss = uvToWorld(0.50, bp.id === 16 ? 0.50 : 0.28, half);
    placePalmov('cemetery_church', pBoss.x, pBoss.z - 12.5, { scale: bp.id === 17 ? 0.98 : 0.92, rotY: 0.15, yOffset: -0.25, tint: 0xd8d0f0, emissive: 0x584680, emissiveIntensity: 0.50 }, 3.8);
    placeGlb('stonehenge', pBoss.x - 10.5, pBoss.z - 2.0, null, { scale: 1.05, rotY: 0.3, yOffset: -0.15, flatTint: 0x7c74a4, emissive: 0x4c3a74, emissiveIntensity: 0.52 }, 2.2);
  } else if (bp.id === 18) {
    // #18 深海螢光沉淵：飄浮巨型深海烏賊、發光巨型海菇與亞特蘭提斯海殿（4123 Alien Planets Vol2）
    const pStart = uvToWorld(0.22, 0.76, half);
    placeGlb('depth_shroom', pStart.x - 6.5, pStart.z - 5.0, null, { scale: 1.15, rotY: 0.3, yOffset: -0.15, emissive: 0x386a78, emissiveIntensity: 0.48 }, 1.8);
    placeGlb('depth_temple', pStart.x + 7.5, pStart.z - 7.5, null, { scale: 1.05, rotY: -0.5, yOffset: -0.15, emissive: 0x2c6880, emissiveIntensity: 0.46 }, 2.6);
    placeGlb('alien_squid', pStart.x + 1.5, pStart.z - 6.5, null, { scale: 1.0, rotY: 0.2, yOffset: 1.8, emissive: 0x6a3c88, emissiveIntensity: 0.56 }, 0);
    const pMid = uvToWorld(0.54, 0.62, half);
    placeGlb('depth_tower', pMid.x, pMid.z - 6.5, null, { scale: 1.25, rotY: 0.4, yOffset: -0.15, emissive: 0x2c7890, emissiveIntensity: 0.52 }, 2.6);
    placeGlb('alien_squid', pMid.x - 7.5, pMid.z - 4.0, null, { scale: 1.1, rotY: -0.5, yOffset: 2.2, emissive: 0x7a429c, emissiveIntensity: 0.58 }, 0);
  } else if (bp.id === 19) {
    // #19 星際白銀前哨站：既有 4123 星艦平台／飛艇／反應爐 ＋ 西北角 Palmov 火箭發射台（space shuttle launch）
    const pStart = uvToWorld(0.22, 0.76, half);
    placeGlb('scifi_platform', pStart.x - 7.5, pStart.z - 7.0, null, { scale: 1.1, rotY: 0.4, yOffset: -0.15, tint: 0xdff6ff, emissive: 0x2c6c98, emissiveIntensity: 0.50 }, 2.8);
    placeGlb('sky_flyer', pStart.x + 6.5, pStart.z - 6.5, null, { scale: 1.15, rotY: -0.7, yOffset: 1.6, tint: 0xeaf8ff, emissive: 0x3888c4, emissiveIntensity: 0.54 }, 2.0);
    placeGlb('scifi_reactor', pStart.x + 0.5, pStart.z - 12.0, null, { scale: 1.1, rotY: 0, yOffset: -0.15, tint: 0xd4f0ff, emissive: 0x3084b8, emissiveIntensity: 0.52 }, 2.6);
    const pOutpost = uvToWorld(0.76, 0.28, half);
    placeGlb('scifi_platform', pOutpost.x, pOutpost.z, null, { scale: 1.25, rotY: 0.3, yOffset: -0.15, tint: 0xdff6ff, emissive: 0x2c6c98, emissiveIntensity: 0.50 }, 3.0);
    placeGlb('sky_flyer', pOutpost.x + 6.5, pOutpost.z - 2.0, null, { scale: 1.15, rotY: -0.6, yOffset: 2.0, tint: 0xeaf8ff, emissive: 0x3888c4, emissiveIntensity: 0.54 }, 0);
    const pMid = uvToWorld(0.50, 0.50, half);
    placeGlb('scifi_reactor', pMid.x, pMid.z - 6.5, null, { scale: 1.35, rotY: 0.3, yOffset: -0.15, tint: 0xdcf4ff, emissive: 0x3894cc, emissiveIntensity: 0.56 }, 3.2);
    placeGlb('sky_flyer', pMid.x - 9.0, pMid.z - 3.0, null, { scale: 1.1, rotY: 0.9, yOffset: 2.8, tint: 0xf0faff, emissive: 0x4298d4, emissiveIntensity: 0.56 }, 0);
  } else if (bp.id === 20) {
    // #20 異星蜂巢裂谷：既有 4123/4384 異星母巢塔／紫晶／飛艇 ＋ 西環 Palmov 外星異星菌群（fantastic planet）
    const pStart = uvToWorld(0.50, 0.82, half);
    placeGlb('alien_hive_tower', pStart.x - 7.5, pStart.z - 8.5, null, { scale: 1.15, rotY: 0.4, yOffset: -0.15, tint: 0xf4b8ff, emissive: 0x7c2c9c, emissiveIntensity: 0.56 }, 2.6);
    placeGlb('purple_crystal', pStart.x + 6.5, pStart.z - 5.0, null, { scale: 1.15, rotY: -0.4, yOffset: -0.1, flatTint: 0xe068ff, emissive: 0x9c32d8, emissiveIntensity: 0.65 }, 1.5);
    placeGlb('sky_flyer', pStart.x + 9.0, pStart.z - 10.0, null, { scale: 1.05, rotY: 1.2, yOffset: 0.6, tint: 0xf0c8ff, emissive: 0x6a3288, emissiveIntensity: 0.50 }, 2.2);
    const pAlien = uvToWorld(0.18, 0.44, half);
    placePalmov('fantastic_planet', pAlien.x, pAlien.z, { scale: 1.0, rotY: 0.3, yOffset: -0.25, tint: 0xf4c4ff, emissive: 0x7c2c9c, emissiveIntensity: 0.42 }, 3.8);
    const pMid = uvToWorld(0.50, 0.50, half);
    placeGlb('alien_hive_tower', pMid.x, pMid.z - 6.5, null, { scale: 1.4, rotY: 0, yOffset: -0.15, tint: 0xffc0ff, emissive: 0x8e34b0, emissiveIntensity: 0.60 }, 3.2);
    placeGlb('purple_crystal', pMid.x - 8.0, pMid.z - 3.5, null, { scale: 1.25, rotY: 0.8, yOffset: -0.1, flatTint: 0x6ef0ff, emissive: 0x3098c8, emissiveIntensity: 0.62 }, 1.6);
  }
  g.world.group.add(grp);
}

export function setupField(g, restored = false) {
  const f = FIELDS[g.field], r = mulberry32(919 + g.field);
  const bp = FIELD_BLUEPRINTS[g.field] || null;
  // 記錄已探索區域（供坐騎里程碑解鎖判定）
  g.meta.p.visitedFields = g.meta.p.visitedFields || [];
  if (!g.meta.p.visitedFields.includes(g.field)) { g.meta.p.visitedFields.push(g.field); g.meta.save(); }
  // 高密度刷怪爽感：依藍圖聚落或面積生成 55–95 隻魔物
  const spawns = [];
  if (bp) {
    for (const [cu, cv] of bp.camps || []) {
      const w = uvToWorld(cu, cv, g.world.half);
      const center = g.world.isLand(w.x, w.z) ? w : g.world.randomWalkable(r, g.player.pos, 12);
      const packSize = 6 + Math.floor(r() * 3);
      for (let k = 0; k < packSize; k++) {
        const ang = (k / packSize) * Math.PI * 2 + r() * 0.55;
        const dist = k === 0 ? 0 : 2.0 + r() * 4.2;
        const px = center.x + Math.cos(ang) * dist, pz = center.z + Math.sin(ang) * dist;
        const valid = g.world.isLand(px, pz) ? { x: px, z: pz } : center;
        spawns.push({ ...valid, campLeader: k === 0, dense: true });
      }
    }
    const bossPoi = (bp.pois || []).find(p => p.k === 'boss');
    const bossW = bossPoi ? uvToWorld(bossPoi.x, bossPoi.y, g.world.half) : g.world.randomWalkable(r, g.player.pos, 26);
    spawns.push({ ...(g.world.isLand(bossW.x, bossW.z) ? bossW : g.world.randomWalkable(r, g.player.pos, 26)), legendary: true });
  } else {
    const campCount = f.size >= 360 ? 13 : f.size >= 300 ? 11 : 9;
    for (let c = 0; c < campCount; c++) {
      const center = g.world.randomWalkable(r, g.player.pos, 12);
      const packSize = 5 + Math.floor(r() * 4);
      for (let k = 0; k < packSize; k++) {
        const ang = (k / packSize) * Math.PI * 2 + r() * 0.55;
        const dist = k === 0 ? 0 : 1.8 + r() * 3.8;
        const px = center.x + Math.cos(ang) * dist, pz = center.z + Math.sin(ang) * dist;
        const valid = g.world.isLand(px, pz) ? { x: px, z: pz } : center;
        spawns.push({ ...valid, campLeader: k === 0, dense: true });
      }
    }
    for (let s = 0; s < 8; s++) spawns.push({ ...g.world.randomWalkable(r, g.player.pos, 11), campLeader: false });
    spawns.push({ ...g.world.randomWalkable(r, g.player.pos, 26), legendary: true });
  }
  g.fieldSpawns = spawns;

  // v5 藍光傳送檢查點（消除回頭路，已解鎖進度持久化至 meta.p.unlockedCps）
  g.checkpoints = [];
  if (bp?.checkpoints?.length) {
    g.meta.p.unlockedCps = g.meta.p.unlockedCps || {};
    const saved = Array.isArray(g.meta.p.unlockedCps[g.field]) ? g.meta.p.unlockedCps[g.field] : [0];
    if (!saved.includes(0)) saved.push(0);
    g.meta.p.unlockedCps[g.field] = saved;
    bp.checkpoints.forEach(([cu, cv, cpName], idx) => {
      const w = uvToWorld(cu, cv, g.world.half);
      const pt = g.world.isLand(w.x, w.z) ? w : g.world.randomWalkable(r, g.player.pos, 8);
      const mesh = marker('checkpoint');
      const y = g.world.gh(pt.x, pt.z);
      mesh.position.set(pt.x, y, pt.z);
      g.world.group.add(mesh);
      const cp = { idx, name: cpName || `檢查點 ${idx + 1}`, x: pt.x, z: pt.z, y, unlocked: saved.includes(idx), mesh };
      g.checkpoints.push(cp);
      g.spots.push({ kind: 'checkpoint', cpIdx: idx, label: `🔵 傳送檢查點 · ${cp.name}（[F] 瞬移）`, x: pt.x, z: pt.z, top: y + 2.4, mesh });
    });
  }

  for (const kind of Object.keys(GOODS)) {
    const count = f.size >= 320 ? 5 : 3;
    for (let n = 0; n < count; n++) {
      const point = g.world.randomWalkable(r, g.player.pos, 6 + n * 12);
      const verb = { wood: '砍伐', ore: '開採', fish: '垂釣' }[kind];
      addSpot(g, kind, verb + GOODS[kind], point.x, point.z);
    }
  }
  // 野外遠古祝福石碑（狂暴火碑／寒霜冰碑／黃金財富碑，互動獲得 25 秒強力祝福）
  const shrines = [
    ['shrine_fury', '🔥 遠古狂暴石碑（25秒 傷害+45% · 移速+20%）'],
    ['shrine_frost', '❄️ 遠古寒霜石碑（凍結周圍魔物 · 25秒 寒霜附魔）'],
    ['shrine_gold', '💰 遠古財富石碑（立即灑落金幣寶石 · 25秒 雙倍掉寶）'],
  ];
  shrines.forEach(([sk, lbl], idx) => {
    const pt = g.world.randomWalkable(r, g.player.pos, 18 + idx * 14);
    addSpot(g, sk, lbl, pt.x, pt.z);
  });
  const grave = g.meta.p.graves[g.field];
  if (grave) addSpot(g,'grave','取回墓碑素材',grave.x,grave.z);
  spawnSkyFeatures(g);
  if (bp) buildBlueprintLandmarks(g, bp);
  else buildZoneLandmarks(g);
  g.fieldClock = restored ? 1 : 0; g.dueling = false;
  const sub = restored
    ? '【常駐區域 · 已延續先前探索進度】'
    : bp
      ? `【v5 藍圖 · ${bp.planSize}】Lv.${f.level}+ · ${spawns.length} 隻魔物 · ${g.checkpoints.length} 座藍光檢查點`
      : `【常駐超大地圖】Lv.${f.level}+ · ${spawns.length} 隻魔物聚落出沒`;
  g.ui.banner(f.name, sub);
}
export function tickField(g, dt) {
  g.fieldClock -= dt;
  if (g.fieldClock > 0) return;
  g.fieldClock = 1;
  const f = FIELDS[g.field], now = Date.now();
  const active = Math.floor(now / 60000) % 3 === g.field % 3;
  if (active !== g.worldEvent) {
    g.worldEvent = active;
    if (active) g.ui.toast(g.field===4?'暴風雪來臨 · 採集量提升':'山谷豐收 · 採集量提升', '#fff1ae');
    if (g.scene.fog && g.scene.fog.isFog) { g.scene.fog.near = active ? 28 : 38; g.scene.fog.far = active ? 88 : 112; }
  }
  g.fieldSpawns.forEach((pos,i) => {
    if (g.enemies.some(e => !e.dead && e.spawnIndex === i) || g.meta.p.timers[g.field + ':mob:' + i] > now) return;
    const legendary = !!pos.legendary;
    const isSky = !legendary && (f.beast === 'skyray' || i % 5 === 2);
    const isElite = legendary || !!pos.campLeader;
    const e = g.spawnEnemy(legendary ? 'stag' : isSky ? 'skyray' : f.beast, pos, isElite);
    e.spawnIndex = i; e.legendary = legendary; e.level = Math.min(30, f.level + Math.floor(i / 4));
    e.statusAffinity = f.status || 'poison';
    const rankScale=1+(e.level-f.level)*.08;
    e.hp=Math.ceil(e.hp*rankScale);e.maxHp=e.hp;e.dmg*=rankScale;
    if (legendary) g.ui.bossBar(true, FIELD_BOSS_SPEC[g.field]?.name || (f.name + '守護獸'));
  });
  for (const spot of g.spots) if (GOODS[spot.kind]) spot.mesh.visible = !(g.meta.p.timers[g.field + ':' + spot.kind] > now);
  // 自動解鎖靠近的藍光傳送檢查點並寫入存檔
  for (const cp of g.checkpoints || []) {
    if (!cp.unlocked && Math.hypot(g.player.pos.x - cp.x, g.player.pos.z - cp.z) < 7.0) {
      cp.unlocked = true;
      g.meta.p.unlockedCps = g.meta.p.unlockedCps || {};
      const list = Array.isArray(g.meta.p.unlockedCps[g.field]) ? g.meta.p.unlockedCps[g.field] : [0];
      if (!list.includes(cp.idx)) { list.push(cp.idx); g.meta.p.unlockedCps[g.field] = list; g.meta.save(); }
      g.audio?.sfx?.('win');
      g.fx?.burst?.(cp.x, cp.y + 1.5, cp.z, 20, { c: [0x38d0ff, 0xffffff, 0x9cf2ff], s: 0.14, speed: 5, up: 4, life: 0.65 });
      g.ui?.toast?.(`🔵 已解鎖傳送檢查點：${cp.name}`, '#6ae8ff');
    }
  }
}

export function teleportToCheckpoint(g, cpIdx) {
  const cp = (g.checkpoints || []).find(c => c.idx === cpIdx);
  if (!cp || !cp.unlocked) return false;
  g.player.pos.set(cp.x + 1.6, cp.y, cp.z + 1.6);
  g.player.y = g.world.gh(cp.x + 1.6, cp.z + 1.6);
  g.camPos?.set?.(cp.x + 1.6, 0, cp.z + 1.6);
  g.audio?.sfx?.('wisp');
  g.fx?.burst?.(cp.x + 1.6, g.player.y + 1.2, cp.z + 1.6, 22, { c: [0x38d0ff, 0xffffff, 0xa8f2ff], s: 0.14, speed: 5, up: 4, life: 0.6 });
  g.ui?.toast?.(`🔵 瞬移至「${cp.name}」`, '#6ae8ff');
  return true;
}

export function useFieldSpot(g,s) {
  const p = g.meta.p;
  if (s.kind === 'checkpoint') {
    const cps = g.checkpoints || [];
    const cur = cps[s.cpIdx];
    if (cur && !cur.unlocked) {
      cur.unlocked = true;
      p.unlockedCps = p.unlockedCps || {};
      const list = Array.isArray(p.unlockedCps[g.field]) ? p.unlockedCps[g.field] : [0];
      if (!list.includes(cur.idx)) { list.push(cur.idx); p.unlockedCps[g.field] = list; g.meta.save(); }
    }
    const unlocked = cps.filter(c => c.unlocked);
    if (unlocked.length <= 1) {
      g.heal?.(g.player.stats.maxHp * 0.35, false);
      g.player.mana = Math.min(g.player.stats.mana, g.player.mana + g.player.stats.mana * 0.4);
      g.audio?.sfx?.('wisp');
      g.ui?.toast?.('🔵 藍光檢查點共鳴回復！探索並靠近其他藍光石陣即可相互瞬移', '#6ae8ff');
      return true;
    }
    const curPos = unlocked.findIndex(c => c.idx === s.cpIdx);
    const next = unlocked[(curPos + 1) % unlocked.length];
    return teleportToCheckpoint(g, next.idx);
  }
  if (s.kind.startsWith('shrine_')) {
    s.mesh.visible = false;
    g.shrineBuffs = g.shrineBuffs || { fury: 0, frost: 0, gold: 0, sheep: 0 };
    if (s.kind === 'shrine_fury') {
      g.shrineBuffs.fury = 25;
      g.audio.sfx('meteor');
      g.fx.burst(s.x, 1.5, s.z, 24, { c: [0xff6a38, 0xffd85a, 0xffffff], s: 0.14, speed: 6, up: 4, life: 0.65 });
      g.ui.toast('🔥 獲得遠古狂暴祝福！25 秒內傷害 +45% · 移速 +20%', '#ff8c4a');
    } else if (s.kind === 'shrine_frost') {
      g.shrineBuffs.frost = 25;
      g.audio.sfx('nova');
      g.shockRing(s.x, s.z, 12, g.rollDamage(1.8), 0x7ae8ff, 1.2, { slow: 4.5 });
      for (const e of g.enemies) if (!e.dead && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 12) { e.statuses = e.statuses || {}; e.statuses.freeze = 3.2; }
      g.ui.toast('❄️ 寒霜石碑爆發！周圍魔物全數冰凍 · 25 秒寒霜附魔', '#7ae8ff');
    } else {
      g.shrineBuffs.gold = 25;
      p.coins += 18; p.shards += 12;
      const pool = Object.keys(ALL_GEMS); const gid = pool[Math.floor(Math.random() * pool.length)];
      addGemToBag(p, gid); g.meta.save();
      g.audio.sfx('win');
      g.fx.burst(s.x, 1.6, s.z, 28, { c: [0xffd84a, 0xfff6c0, 0xc08cff], s: 0.14, speed: 6, up: 5, life: 0.75 });
      g.ui.toast(`💰 財富石碑降臨！金幣 +18 · 星砂 +12 · 寶石「${ALL_GEMS[gid].name}」`, '#ffd85a');
    }
    return true;
  }
  if (s.kind === 'chest') return openHighChest(g, s);
  if (s.kind === 'field_quest') {
    g._activeFieldNpc = s.npcDef;
    if (s.bot) { s.bot.tf = Math.atan2(g.player.pos.x - s.bot.x, g.player.pos.z - s.bot.z); s.bot.wait = 6; }
    g.audio.sfx('ui'); g.ui.openPanel('field_quest'); return true;
  }
  if (s.kind === 'grave') {
    const grave = p.graves[g.field]; if (!grave) return false;
    for (const kind of Object.keys(GOODS)) p.goods[kind] += grave.goods[kind];
    delete p.graves[g.field]; s.mesh.visible = false; g.spots = g.spots.filter(it => it.mesh !== s.mesh);
    g.ui.toast('已取回墓碑中的素材', '#ffe08a');
    g.meta.save(); return true;
  } else {
    const key = g.field + ':' + s.kind;
    if (!GOODS[s.kind] || p.timers[key] > Date.now() || g.gatherActive) return false;
    const collect = (perfect) => {
      const base = (g.worldEvent ? 4 : 3) + (p.guildName ? 1 : 0);
      const yieldCount = perfect ? base * 2 : base;
      p.goods[s.kind] += yieldCount; p.timers[key] = Date.now() + 30000; s.mesh.visible = false;
      if (perfect) {
        p.coins += 5;
        if (s.kind === 'ore' && Math.random() < 0.5) {
          const pool = Object.keys(ALL_GEMS); const gid = pool[Math.floor(Math.random() * pool.length)];
          addGemToBag(p, gid); g.ui.toast(`✨ 完美採集！${GOODS[s.kind]} +${yieldCount} · 寶石「${ALL_GEMS[gid].name}」`, '#ffd85a');
        } else {
          g.ui.toast(`✨ 完美採集！${GOODS[s.kind]} +${yieldCount} · 金幣 +5`, '#ffd85a');
        }
      } else {
        g.ui.toast(GOODS[s.kind] + ' +' + yieldCount, '#ffe08a');
      }
      if (g.field === 1 && FIELD_NPCS[1]) {
        p.fieldQuests = p.fieldQuests || {};
        const st = p.fieldQuests.q_f1 || { have: 0, done: false };
        if (!st.done) { st.have++; p.fieldQuests.q_f1 = st; }
      }
      g.meta.save();
    };
    if (typeof document !== 'undefined' && document.getElementById('gatherMini')) {
      g.player.swing = 1; g.player.swingT = 0.25;
      startGatherMini(g, s, collect);
    } else {
      collect(false);
    }
    return true;
  }
}
export function leaveGrave(g) {
  if (g.settings?.difficulty === 'cozy') { rememberGear(g); return 0; }
  const p = g.meta.p, field = g.field || g.originField || 1;
  const goods = {};
  const kinds = Object.keys(GOODS);
  const target = Math.floor(kinds.reduce((sum, k) => sum + p.goods[k], 0) / 4);
  const losses = Object.fromEntries(kinds.map(k => [k, Math.floor(p.goods[k] / 4)]));
  let remainder = target - Object.values(losses).reduce((sum,n) => sum + n, 0);
  for (const k of [...kinds].sort((a,b) => p.goods[b]%4 - p.goods[a]%4)) {
    if (remainder-- <= 0) break;
    losses[k]++;
  }
  let total = 0;
  for (const kind of Object.keys(GOODS)) {
    const loss = losses[kind];
    p.goods[kind] -= loss; total += loss;
    goods[kind] = loss + (p.graves[field]?.goods[kind] || 0);
  }
  if (total) {
    const pos = g.field ? g.player.pos : {x:0,z:0};
    p.graves[field] = {x:pos.x,z:pos.z,goods};
  }
  rememberGear(g); return total;
}
export function craft(g) {
  const p = g.meta.p;
  if (p.goods.ore < 3 || p.goods.wood < 2) return false;
  p.goods.ore -= 3; p.goods.wood -= 2;
  const it = makeItem(Math.random, Math.floor(p.level / 3), 2);
  const old = g.player.equip[it.slot];
  if (old) addGearToBag(p, old);
  g.player.equip[it.slot] = it; rememberGear(g); g.recalc(); return it.name;
}
