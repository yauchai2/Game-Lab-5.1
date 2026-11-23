import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, mulberry32 } from './util.js';
import { toonMat, part } from './world.js';
import { attachLandmarkGlb } from './assets.js';
import { FIELD_BLUEPRINTS, uvToWorld } from './field_blueprints.js';
import { makeItem, serializeItem, deserializeItem } from './loot.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { spawnSkyFeatures, startGatherMini, openHighChest, FIELD_NPCS } from './world_alive.js';
import { buildZoneLandmarks } from './harbor.js';
import { addGearToBag } from './physbag.js';

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
  const level = enemy.level || Math.min(30, g.depth * 2 + 1);
  const mult = (g.isNight ? 1.25 : 1) * (p.guildName ? 1.1 : 1);
  p.xp += Math.round((10 + level * (enemy.elite ? 4 : 2)) * mult);
  p.coins += enemy.elite ? 5 : 2;
  p.species[enemy.type] = (p.species[enemy.type] || 0) + 1;
  if (g.field && FIELD_NPCS[g.field]) {
    const qid = FIELD_NPCS[g.field].quest.id;
    p.fieldQuests = p.fieldQuests || {};
    const st = p.fieldQuests[qid] || { have: 0, done: false };
    if (!st.done) { st.have++; p.fieldQuests[qid] = st; }
  }
  while (p.level < 30 && p.xp >= p.level * 40) {
    p.xp -= p.level * 40; p.level++;
    g.ui.toast('旅人等級提升至 ' + p.level, '#ffdc80'); g.recalc();
  }
  if (p.level === 30) p.xp = 0;
  if (g.field) {
    const material = ['wood','ore','fish'][(enemy.spawnIndex ?? 0) % 3];
    p.goods[material] += enemy.elite ? 3 : 1;
    if (enemy.elite || enemy.legendary) {
      p.keys++;
      const pool = Object.keys(ALL_GEMS);
      const gemId = pool[Math.floor(Math.random() * pool.length)];
      addGemToBag(p, gemId);
      g.ui.toast(`獲得拼圖寶石：${ALL_GEMS[gemId].name}`, '#c08cff');
    }
    g.ui.toast(GOODS[material] + (enemy.elite ? ' +3 · 鑰石 +1' : ' +1'), '#ffe5a5');
    if (enemy.spawnIndex != null) p.timers[g.field + ':mob:' + enemy.spawnIndex] = Date.now() + (enemy.legendary ? 90000 : 16000);
  }
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

  for (const poi of bp.pois || []) {
    const pos = uvToWorld(poi.x, poi.y, half);
    // 副本地城入口：統一加上低面立體岩洞拱門（4130）
    if (poi.k === 'dungeon') {
      placeGlb('cave_arch', pos.x, pos.z - 4.2, null, { scale: 1.15, rotY: 0, yOffset: -0.25 }, 0);
    }
    if (!poi.landmark) continue;
    if (poi.landmark === 'teapot_hill') {
      // #01 東北高丘：巨型溫暖陶瓷茶壺屋＋紅白蘑菇群＋4167 巨石陣環繞前庭
      const teapot = new THREE.Mesh(mergeGeometries([
        part(new THREE.SphereGeometry(4.2, 12, 8), 0xf3e4c8, 0, 3.2, 0),
        part(new THREE.CylinderGeometry(2.6, 3.2, 0.8, 10), 0xd85a42, 0, 6.9, 0),
        part(new THREE.SphereGeometry(0.75, 8, 6), 0xffd268, 0, 7.6, 0),
        part(new THREE.CylinderGeometry(0.55, 0.95, 3.6, 7), 0xf3e4c8, 4.3, 3.6, 0, 0, 0, -0.75),
        part(new THREE.TorusGeometry(1.9, 0.42, 6, 12, Math.PI), 0xd85a42, -3.9, 3.4, 0, 0, 0, Math.PI / 2),
        part(new THREE.BoxGeometry(1.5, 2.2, 0.4), 0x7c4c30, 0, 1.1, 3.85),
        part(new THREE.CylinderGeometry(0.45, 0.65, 2.2, 6), 0xfff0d4, -5.8, 1.1, 3.2),
        part(new THREE.SphereGeometry(1.65, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe24a3c, -5.8, 2.1, 3.2),
        part(new THREE.CylinderGeometry(0.32, 0.45, 1.5, 6), 0xfff0d4, 5.2, 0.75, 2.8),
        part(new THREE.SphereGeometry(1.15, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe86248, 5.2, 1.45, 2.8),
      ]), toonMat({ vertexColors: true }));
      teapot.castShadow = true; teapot.receiveShadow = true;
      place(teapot, pos.x, pos.z, 4.3);
      placeGlb('stonehenge', pos.x - 11.2, pos.z + 6.5, null, { scale: 1.0, rotY: 0.35, yOffset: -0.15 }, 2.2);
      placeGlb('stonehenge', pos.x + 10.8, pos.z + 7.2, null, { scale: 0.95, rotY: -0.45, yOffset: -0.15 }, 2.0);
    } else if (poi.landmark === 'cable_summit') {
      // #04 西北雪峰站：4137 雪頂瞭望纜車塔＋雪山木屋站＋橘白滑雪旗門
      const fallbackStation = new THREE.Mesh(mergeGeometries([
        part(new THREE.BoxGeometry(5.6, 3.4, 4.2), 0x8f5d3c, 0, 1.7, 0),
        part(new THREE.ConeGeometry(4.4, 2.3, 4), 0xf2f7fc, 0, 4.4, 0, 0, Math.PI / 4, 0),
      ]), toonMat({ vertexColors: true }));
      placeGlb('snow_tower', pos.x, pos.z, fallbackStation, { scale: 1.05, rotY: 0.35, yOffset: -0.15 }, 2.8);
      placeGlb('snow_house', pos.x - 7.0, pos.z + 3.2, null, { scale: 1.05, rotY: 0.6, yOffset: -0.15 }, 2.6);
      // 橘白滑雪道出發旗門
      const gate = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.12, 0.12, 3.0, 5), 0xff6a38, -3.5, 1.5, 0),
        part(new THREE.CylinderGeometry(0.12, 0.12, 3.0, 5), 0xff6a38, 3.5, 1.5, 0),
        part(new THREE.BoxGeometry(7.3, 0.65, 0.14), 0xff6a38, 0, 2.7, 0),
      ]), toonMat({ vertexColors: true }));
      gate.castShadow = true;
      place(gate, pos.x + 5.2, pos.z + 5.4, 0);
    } else if (poi.landmark === 'ice_spires') {
      // #04 東北：4130 清透淡冰藍晶尖塔群環繞寒霜冰窟
      const offsets = [[-6.5, -2.5, 1.2, 0.3], [6.5, -2.0, 1.1, 1.4], [-5.0, 4.5, 0.85, 2.2], [5.2, 4.2, 0.95, -0.8]];
      for (const [ox, oz, sc, ry] of offsets) {
        const fb = new THREE.Mesh(new THREE.ConeGeometry(1.4 * sc, 6.2 * sc, 5), toonMat({ color: 0x9ceeff }));
        fb.position.y = 3.1 * sc;
        placeGlb('ice_crystal', pos.x + ox, pos.z + oz, fb, { scale: sc, rotY: ry, yOffset: -0.2, flatTint: 0xa4ecff, emissive: 0x3b8ec4, emissiveIntensity: 0.42 }, 1.5);
      }
    } else if (poi.landmark === 'snow_cabin') {
      // #04 西側裂谷雪屋（4137 雪地木屋實模）
      const fb = new THREE.Mesh(mergeGeometries([
        part(new THREE.BoxGeometry(3.8, 2.4, 3.2), 0x9b6b46, 0, 1.2, 0),
        part(new THREE.ConeGeometry(3.1, 1.9, 4), 0xf4f9ff, 0, 3.2, 0, 0, Math.PI / 4, 0),
      ]), toonMat({ vertexColors: true }));
      placeGlb('snow_house', pos.x, pos.z, fb, { scale: 1.05, rotY: 0.45, yOffset: -0.15 }, 2.6);
    } else if (poi.landmark === 'cliff_lighthouse') {
      // #07 東側巨崖：4379 浮空島燈塔＋守塔海島木屋（明亮日光 Pixel-Toon）
      const fbTower = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(1.3, 2.1, 3.2, 10), 0xfff4e2, 0, 1.6, 0),
        part(new THREE.CylinderGeometry(1.15, 1.3, 2.6, 10), 0xdc4438, 0, 4.5, 0),
        part(new THREE.CylinderGeometry(1.0, 1.15, 2.6, 10), 0xfff4e2, 0, 7.1, 0),
        part(new THREE.ConeGeometry(1.35, 1.5, 10), 0xdc4438, 0, 9.4, 0),
      ]), toonMat({ vertexColors: true }));
      placeGlb('lighthouse', pos.x, pos.z, fbTower, { scale: 1.05, rotY: -0.4, yOffset: -0.2, emissive: 0x5c5246, emissiveIntensity: 0.48 }, 2.6);
      placeGlb('island_house', pos.x - 7.0, pos.z + 4.4, null, { scale: 1.0, rotY: 0.55, yOffset: -0.15, emissive: 0x564c40, emissiveIntensity: 0.46 }, 2.6);
    } else if (poi.landmark === 'star_aqueduct') {
      // #07 北端星穹斷柱水道：4167 巨石陣門柱
      placeGlb('stonehenge', pos.x - 6.0, pos.z + 2.5, null, { scale: 1.1, rotY: 0.2, yOffset: -0.15 }, 2.0);
      placeGlb('stonehenge', pos.x + 6.0, pos.z + 2.5, null, { scale: 1.1, rotY: -0.2, yOffset: -0.15 }, 2.0);
    } else if (poi.landmark === 'birch_cabin') {
      // #02 西南：白樺封板廢屋（4379 森林木屋）
      placeGlb('forest_cabin', pos.x, pos.z, null, { scale: 1.1, rotY: 0.4, yOffset: -0.15, emissive: 0x3a3428, emissiveIntensity: 0.36 }, 2.8);
      placeGlb('giant_shroom', pos.x + 5.8, pos.z + 2.5, null, { scale: 0.9, rotY: 0.8, yOffset: -0.1 }, 1.2);
    } else if (poi.landmark === 'canopy_vault') {
      // #02 東北樹冠吊橋秘庫
      placeGlb('windmill', pos.x, pos.z, null, { scale: 0.92, rotY: -0.3, yOffset: -0.2 }, 2.6);
      placeGlb('stonehenge', pos.x - 6.5, pos.z + 4.5, null, { scale: 0.85, rotY: 0.5, yOffset: -0.15 }, 1.8);
    } else if (poi.landmark === 'forest_tomb') {
      // #02 東南古墓毒霧凹地
      placeGlb('stonehenge', pos.x - 6.8, pos.z - 2.0, null, { scale: 1.05, rotY: 0.2, yOffset: -0.15 }, 2.0);
      placeGlb('stonehenge', pos.x + 6.8, pos.z - 2.0, null, { scale: 1.05, rotY: -0.2, yOffset: -0.15 }, 2.0);
      placeGlb('giant_shroom', pos.x, pos.z + 6.2, null, { scale: 1.15, rotY: 1.2, yOffset: -0.1, tint: 0x9ef0b8, emissive: 0x206844, emissiveIntensity: 0.42 }, 1.4);
    } else if (poi.landmark === 'kraken_wreck') {
      // #03 中央：海怪觸手沉船礁（4379 海盜船＋4 條赤紅巨型章魚觸手實體弧牆）
      placeGlb('pirate_boat', pos.x, pos.z, null, { scale: 1.35, rotY: 0.65, yOffset: -0.1, emissive: 0x423026, emissiveIntensity: 0.36 }, 2.8);
      const tentParts = [];
      for (let t = 0; t < 4; t++) {
        const a = t * 1.57 + 0.45;
        tentParts.push(
          part(new THREE.TorusGeometry(3.2, 0.58, 6, 12, Math.PI * 0.85), 0xd84438, Math.cos(a) * 6.5, 1.4, Math.sin(a) * 6.5, 0.25, a, 0),
          part(new THREE.ConeGeometry(0.62, 3.6, 6), 0xe85a48, Math.cos(a) * 8.4, 3.6, Math.sin(a) * 8.4, 0.3, a, -0.2),
        );
      }
      const tents = new THREE.Mesh(mergeGeometries(tentParts), toonMat({ vertexColors: true }));
      tents.castShadow = true;
      place(tents, pos.x, pos.z, 0);
    } else if (poi.landmark === 'stilt_village') {
      // #03 東側：高腳吊橋木屋村
      placeGlb('beach_house', pos.x, pos.z, null, { scale: 1.05, rotY: -0.45, yOffset: -0.15, emissive: 0x3a342a, emissiveIntensity: 0.36 }, 2.8);
      placeGlb('giant_shroom', pos.x - 6.2, pos.z + 3.8, null, { scale: 1.0, rotY: 0.3, yOffset: -0.1 }, 1.2);
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
      // #05 西崖：礦車棧橋站
      placeGlb('mine_cart', pos.x, pos.z, null, { scale: 1.45, rotY: 0.25, yOffset: -0.05 }, 1.6);
      placeGlb('mine_cart', pos.x + 3.8, pos.z + 2.6, null, { scale: 1.4, rotY: 0.3, yOffset: -0.05 }, 1.6);
      placeGlb('forge_furnace', pos.x - 5.5, pos.z - 2.2, null, { scale: 1.1, rotY: 0.6, yOffset: -0.15, emissive: 0x5c2414, emissiveIntensity: 0.42 }, 2.2);
    } else if (poi.landmark === 'redrock_oasis') {
      // #05 東南：紅岩瀑布綠洲（4379 棕櫚椰子樹群）
      placeGlb('coconut_tree', pos.x - 4.2, pos.z - 2.2, null, { scale: 1.15, rotY: 0.4, yOffset: -0.15, emissive: 0x364228, emissiveIntensity: 0.34 }, 1.0);
      placeGlb('coconut_tree', pos.x + 4.8, pos.z - 1.5, null, { scale: 1.05, rotY: 2.1, yOffset: -0.15, emissive: 0x364228, emissiveIntensity: 0.34 }, 1.0);
      placeGlb('coconut_tree', pos.x + 1.2, pos.z + 4.8, null, { scale: 0.95, rotY: -1.0, yOffset: -0.15, emissive: 0x364228, emissiveIntensity: 0.34 }, 1.0);
    } else if (poi.landmark === 'ancient_pagoda') {
      // #06 西北：五重古塔峰
      placeGlb('windmill', pos.x, pos.z, null, { scale: 1.25, rotY: 0.2, yOffset: -0.2 }, 3.2);
      placeGlb('stonehenge', pos.x - 7.5, pos.z + 5.0, null, { scale: 1.0, rotY: 0.5, yOffset: -0.15 }, 2.0);
    } else if (poi.landmark === 'spirit_terrace') {
      // #06 東坡：三疊螢光靈泉梯田
      placeGlb('giant_shroom', pos.x - 4.5, pos.z - 2.0, null, { scale: 1.35, rotY: 0.3, yOffset: -0.1, tint: 0x9cf8e4, emissive: 0x268276, emissiveIntensity: 0.48 }, 1.5);
      placeGlb('giant_shroom', pos.x + 5.2, pos.z + 2.5, null, { scale: 1.15, rotY: 1.8, yOffset: -0.1, tint: 0x9cf8e4, emissive: 0x268276, emissiveIntensity: 0.48 }, 1.4);
    } else if (poi.landmark === 'world_tree_core') {
      // #06 中央：盤根神樹核（宏偉世界巨樹＋古石陣）
      const wTree = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(2.4, 3.8, 12.5, 8), 0x623e28, 0, 6.2, 0),
        part(new THREE.IcosahedronGeometry(7.6, 1), 0x458858, 0, 14.2, 0),
        part(new THREE.IcosahedronGeometry(5.5, 1), 0x6cb868, 4.2, 12.2, 2.2),
        part(new THREE.IcosahedronGeometry(5.0, 1), 0x58a25a, -4.0, 12.6, -2.0),
      ]), toonMat({ vertexColors: true }));
      wTree.castShadow = true;
      place(wTree, pos.x, pos.z, 3.8);
      placeGlb('stonehenge', pos.x - 9.0, pos.z + 5.5, null, { scale: 1.05, rotY: 0.4, yOffset: -0.15 }, 2.0);
    } else if (poi.landmark === 'forest_camp') {
      placeGlb('forest_cabin', pos.x, pos.z, null, { scale: 1.05, rotY: -0.4, yOffset: -0.15, emissive: 0x3a3428, emissiveIntensity: 0.35 }, 2.6);
    } else if (poi.landmark === 'pirate_fort') {
      // #08 西側：擱淺海盜帆船崖堡（4379 海盜帆船＋瞭望燈塔＋椰子樹）
      placeGlb('lighthouse', pos.x, pos.z, null, { scale: 1.0, rotY: 0.3, yOffset: -0.2, emissive: 0x4a4236, emissiveIntensity: 0.42 }, 2.6);
      placeGlb('pirate_boat', pos.x - 6.5, pos.z + 5.8, null, { scale: 1.45, rotY: 0.55, yOffset: -0.1, emissive: 0x44362a, emissiveIntensity: 0.38 }, 2.8);
      placeGlb('coconut_tree', pos.x + 5.5, pos.z + 4.2, null, { scale: 1.1, rotY: -0.6, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
    } else if (poi.landmark === 'coconut_beach') {
      // #08 東南：椰林釣魚金沙灘
      placeGlb('beach_house', pos.x, pos.z, null, { scale: 1.05, rotY: -0.5, yOffset: -0.15, emissive: 0x443c32, emissiveIntensity: 0.38 }, 2.8);
      placeGlb('coconut_tree', pos.x - 6.2, pos.z + 3.2, null, { scale: 1.2, rotY: 0.3, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
      placeGlb('coconut_tree', pos.x + 5.8, pos.z - 2.5, null, { scale: 1.1, rotY: 2.0, yOffset: -0.15, emissive: 0x38462c, emissiveIntensity: 0.36 }, 1.0);
    } else if (poi.landmark === 'coral_reef') {
      placeGlb('pirate_boat', pos.x, pos.z, null, { scale: 1.2, rotY: -0.8, yOffset: -0.1, emissive: 0x44362a, emissiveIntensity: 0.38 }, 2.4);
    } else if (poi.landmark === 'tesla_tower') {
      // #09 西北：水沒變電巨塔（燈塔塔體＋電光晶柱）
      placeGlb('lighthouse', pos.x, pos.z - 3.5, null, { scale: 1.15, rotY: 0.1, yOffset: -0.2, tint: 0xb8e6ff, emissive: 0x26547a, emissiveIntensity: 0.45 }, 2.6);
      placeGlb('ice_crystal', pos.x - 5.5, pos.z + 2.5, null, { scale: 1.05, rotY: 0.4, yOffset: -0.15, flatTint: 0x62e2ff, emissive: 0x2896d8, emissiveIntensity: 0.55 }, 1.4);
      placeGlb('ice_crystal', pos.x + 5.5, pos.z + 2.5, null, { scale: 1.05, rotY: -0.4, yOffset: -0.15, flatTint: 0x62e2ff, emissive: 0x2896d8, emissiveIntensity: 0.55 }, 1.4);
    } else if (poi.landmark === 'stilt_plaza' || poi.landmark === 'market_pier') {
      // #09 水上高腳港屋群
      placeGlb('beach_house', pos.x, pos.z, null, { scale: 1.05, rotY: -0.45, yOffset: -0.15, emissive: 0x3c444e, emissiveIntensity: 0.38 }, 2.8);
      placeGlb('island_house', pos.x + 7.2, pos.z - 3.5, null, { scale: 0.95, rotY: 0.55, yOffset: -0.15, emissive: 0x3c444e, emissiveIntensity: 0.38 }, 2.4);
    } else if (poi.landmark === 'clock_roof') {
      placeGlb('snow_tower', pos.x, pos.z, null, { scale: 1.05, rotY: 0.3, yOffset: -0.15, tint: 0xc8dce8, emissive: 0x2e465c, emissiveIntensity: 0.38 }, 2.6);
    } else if (poi.landmark === 'sakura_shrine') {
      // #10 西北：巨櫻山頂水宮（4379 朱紅鳥居＋粉嫩春櫻樹群）
      placeGlb('torii_gate', pos.x, pos.z + 5.2, null, { scale: 1.2, rotY: 0, yOffset: -0.15, tint: 0xffc8c0, emissive: 0x7c2620, emissiveIntensity: 0.46 }, 0);
      placeGlb('sakura_tree', pos.x - 6.8, pos.z + 1.5, null, { scale: 1.25, rotY: 0.4, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.4);
      placeGlb('sakura_tree', pos.x + 6.8, pos.z + 1.5, null, { scale: 1.2, rotY: -0.5, yOffset: -0.15, flatTint: 0xffcce6, emissive: 0xc86492, emissiveIntensity: 0.52 }, 1.4);
    } else if (poi.landmark === 'sakura_bridge') {
      // #10 中央：朱紅橋頭鳥居與粉嫩櫻花樹
      placeGlb('torii_gate', pos.x - 6.5, pos.z + 3.2, null, { scale: 1.05, rotY: 0.25, yOffset: -0.15, tint: 0xffc8c0, emissive: 0x7c2620, emissiveIntensity: 0.46 }, 0);
      placeGlb('sakura_tree', pos.x + 6.5, pos.z - 2.8, null, { scale: 1.15, rotY: 1.1, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.4);
    } else if (poi.landmark === 'sea_torii_island') {
      // #10 西南：海上鳥居孤島
      placeGlb('torii_gate', pos.x, pos.z + 3.5, null, { scale: 1.15, rotY: 0.4, yOffset: -0.15, tint: 0xffc8c0, emissive: 0x7c2620, emissiveIntensity: 0.46 }, 0);
      placeGlb('island_house', pos.x, pos.z - 2.5, null, { scale: 1.0, rotY: 0.2, yOffset: -0.15, emissive: 0x52423c, emissiveIntensity: 0.42 }, 2.5);
      placeGlb('sakura_tree', pos.x - 5.2, pos.z - 1.0, null, { scale: 1.1, rotY: 0.8, yOffset: -0.15, flatTint: 0xffc4e0, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.3);
    } else if (poi.landmark === 'tea_house') {
      // #10 東北：九曲竹林茶屋
      placeGlb('island_house', pos.x, pos.z, null, { scale: 1.0, rotY: -0.45, yOffset: -0.15, emissive: 0x52463e, emissiveIntensity: 0.42 }, 2.5);
      placeGlb('sakura_tree', pos.x + 5.8, pos.z + 2.4, null, { scale: 1.1, rotY: 0.3, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.3);
    } else if (poi.landmark === 'canyon_train') {
      // #11 西段：峽谷蒸汽火車棧橋（礦車列車＋斜嵌碧藍巨環）
      placeGlb('mine_cart', pos.x - 3.5, pos.z, null, { scale: 1.65, rotY: 0.5, yOffset: -0.05 }, 1.8);
      placeGlb('mine_cart', pos.x + 0.5, pos.z - 2.0, null, { scale: 1.6, rotY: 0.5, yOffset: -0.05 }, 1.8);
      placeGlb('mine_cart', pos.x + 4.5, pos.z - 4.0, null, { scale: 1.55, rotY: 0.5, yOffset: -0.05 }, 1.8);
    } else if (poi.landmark === 'mega_sky_ring') {
      // #11 中段：標誌性斜嵌碧藍加速巨環
      const ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 1.35, 8, 24, Math.PI), toonMat({ color: 0x58c8f8, emissive: 0x1e6ca8, emissiveIntensity: 0.35 }));
      ring.rotation.y = 0.25; ring.castShadow = true;
      place(ring, pos.x, pos.z, 0);
    } else if (poi.landmark === 'sky_sanctum') {
      // #11 東北：白雪尖峰天環聖殿
      placeGlb('snow_tower', pos.x - 5.5, pos.z + 2.5, null, { scale: 1.05, rotY: 0.35, yOffset: -0.15 }, 2.6);
      placeGlb('ice_crystal', pos.x + 6.0, pos.z + 2.2, null, { scale: 1.15, rotY: -0.3, yOffset: -0.15, flatTint: 0xa4ecff, emissive: 0x3b8ec4, emissiveIntensity: 0.42 }, 1.5);
    } else if (poi.landmark === 'alpine_camp') {
      placeGlb('forest_cabin', pos.x, pos.z, null, { scale: 1.0, rotY: -0.5, yOffset: -0.15, emissive: 0x3c362c, emissiveIntensity: 0.36 }, 2.6);
    } else if (poi.landmark === 'maple_foundry') {
      // #12 東北：紅楓鍛造爐高台（4137 秋楓鐵匠工坊＋4130 鍛造熔爐＋火紅晶簇）
      placeGlb('blacksmith', pos.x - 6.2, pos.z + 3.2, null, { scale: 1.1, rotY: 0.4, yOffset: -0.15, emissive: 0x483024, emissiveIntensity: 0.36 }, 3.0);
      placeGlb('forge_furnace', pos.x + 6.2, pos.z + 2.5, null, { scale: 1.2, rotY: -0.5, yOffset: -0.15, emissive: 0x622614, emissiveIntensity: 0.45 }, 2.4);
    } else if (poi.landmark === 'forge_plaza') {
      // #12 東側：巨像鍛造廣場（秋楓鍛造屋＋立體火紅星晶）
      placeGlb('blacksmith', pos.x - 8.5, pos.z - 3.5, null, { scale: 1.15, rotY: 0.35, yOffset: -0.15, emissive: 0x583c2c, emissiveIntensity: 0.44 }, 3.0);
      placeGlb('red_crystal', pos.x + 8.0, pos.z - 2.8, null, { scale: 1.1, rotY: -0.5, yOffset: -0.15, tint: 0xffc6a8, emissive: 0x9e2c14, emissiveIntensity: 0.44 }, 1.6);
    } else if (poi.landmark === 'sheep_barn') {
      // #12 西南：風車穀倉綿羊牧場（旋轉風車塔＋秋楓農舍）
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
      placeGlb('cottage', pos.x + 8.5, pos.z + 4.5, null, { scale: 1.05, rotY: -0.6, yOffset: -0.15 }, 2.8);
    } else if (poi.landmark === 'maple_onsen') {
      // #12 西北：三疊秋楓露天溫泉
      placeGlb('forest_cabin', pos.x - 6.0, pos.z - 3.2, null, { scale: 1.0, rotY: 0.5, yOffset: -0.15, emissive: 0x463428, emissiveIntensity: 0.36 }, 2.6);
      placeGlb('sakura_tree', pos.x + 5.8, pos.z - 2.0, null, { scale: 1.15, rotY: 0.6, yOffset: -0.15, tint: 0xff9248, emissive: 0x622e18, emissiveIntensity: 0.40 }, 1.3);
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
    // #10 東南落櫻南堤起點：朱紅迎賓鳥居＋粉嫩櫻花樹
    const startP = uvToWorld(0.80, 0.78, half);
    placeGlb('torii_gate', startP.x, startP.z, null, { scale: 1.15, rotY: 0.45, yOffset: -0.15, tint: 0xffc8c0, emissive: 0x7c2620, emissiveIntensity: 0.46 }, 0);
    placeGlb('sakura_tree', startP.x - 6.0, startP.z - 2.0, null, { scale: 1.15, rotY: 0.3, yOffset: -0.15, flatTint: 0xffb8da, emissive: 0xc4588a, emissiveIntensity: 0.52 }, 1.3);
    placeGlb('sakura_tree', startP.x + 5.8, startP.z - 3.0, null, { scale: 1.05, rotY: 1.6, yOffset: -0.15, flatTint: 0xffcce6, emissive: 0xc86492, emissiveIntensity: 0.52 }, 1.3);
  } else if (bp.id === 13) {
    // #13 黃金風沙原：綠洲民居、方尖碑與紅砂石棺（4351 POLY - Egypt）
    const pOasis = uvToWorld(0.28, 0.34, half);
    placeGlb('egypt_house', pOasis.x - 6.5, pOasis.z - 4.0, null, { scale: 1.15, rotY: 0.5, yOffset: -0.15, tint: 0xffe4b8, emissive: 0x624628, emissiveIntensity: 0.38 }, 2.6);
    placeGlb('egypt_obelisk', pOasis.x + 7.0, pOasis.z - 5.5, null, { scale: 1.1, rotY: -0.3, yOffset: -0.15, tint: 0xf6cf92, emissive: 0x5c4224, emissiveIntensity: 0.36 }, 1.6);
    const pStart = uvToWorld(0.22, 0.78, half);
    placeGlb('egypt_obelisk', pStart.x - 6.5, pStart.z - 6.0, null, { scale: 1.05, rotY: 0.4, yOffset: -0.15, tint: 0xf4cc8c, emissive: 0x5c4224, emissiveIntensity: 0.38 }, 1.5);
    placeGlb('egypt_house', pStart.x + 8.0, pStart.z - 5.0, null, { scale: 1.05, rotY: -0.7, yOffset: -0.15, tint: 0xffe6bc, emissive: 0x604426, emissiveIntensity: 0.38 }, 2.4);
    const pTower = uvToWorld(0.78, 0.68, half);
    placeGlb('egypt_sphinx', pTower.x, pTower.z - 4.5, null, { scale: 1.0, rotY: -0.8, yOffset: -0.15, tint: 0xf5cc88, emissive: 0x604624, emissiveIntensity: 0.36 }, 3.0);
  } else if (bp.id === 14) {
    // #14 太陽金字塔聖殿：中央巨型金字塔、人面獅身像、雙側方尖碑與法老石棺（4351 POLY - Egypt）
    const pMid = uvToWorld(0.50, 0.48, half);
    placeGlb('egypt_pyramid', pMid.x, pMid.z - 6.0, null, { scale: 1.45, rotY: 0.0, yOffset: -0.25, tint: 0xf8d89c, emissive: 0x6a4e26, emissiveIntensity: 0.38 }, 6.5);
    placeGlb('egypt_sphinx', pMid.x - 12.5, pMid.z + 6.5, null, { scale: 1.15, rotY: 0.6, yOffset: -0.15, tint: 0xf6d08e, emissive: 0x624824, emissiveIntensity: 0.38 }, 3.2);
    placeGlb('egypt_obelisk', pMid.x + 12.0, pMid.z + 6.0, null, { scale: 1.15, rotY: -0.4, yOffset: -0.15, tint: 0xf8d698, emissive: 0x644a26, emissiveIntensity: 0.38 }, 1.6);
    const pSouth = uvToWorld(0.50, 0.82, half);
    placeGlb('egypt_pyramid', pSouth.x + 11.5, pSouth.z - 12.5, null, { scale: 1.05, rotY: 0.2, yOffset: -0.2, tint: 0xf8d89c, emissive: 0x6a4e26, emissiveIntensity: 0.38 }, 4.5);
    placeGlb('egypt_sphinx', pSouth.x - 8.5, pSouth.z - 7.5, null, { scale: 1.05, rotY: 0.75, yOffset: -0.15, tint: 0xf6d08e, emissive: 0x624824, emissiveIntensity: 0.38 }, 2.8);
    placeGlb('egypt_sarcophagus', pSouth.x + 6.5, pSouth.z - 4.5, null, { scale: 1.25, rotY: -0.5, yOffset: -0.1, tint: 0xffd87c, emissive: 0x6e4c1e, emissiveIntensity: 0.44 }, 1.5);
  } else if (bp.id === 15) {
    // #15 失落藤蔓神廟：古神廟石牆、石像、石柱與空中石磚棧道（4352 Jungle ＋ 4118 Lost Lands）
    const pMid = uvToWorld(0.50, 0.52, half);
    placeGlb('jungle_ruin_wall', pMid.x, pMid.z - 6.0, null, { scale: 1.15, rotY: 0.15, yOffset: -0.2, tint: 0xc8c0a6, emissive: 0x3a4830, emissiveIntensity: 0.38 }, 3.0);
    placeGlb('jungle_statue', pMid.x - 7.5, pMid.z - 3.5, null, { scale: 1.1, rotY: 0.5, yOffset: -0.15, tint: 0xd0c6aa, emissive: 0x3e4c32, emissiveIntensity: 0.40 }, 1.8);
    placeGlb('jungle_pillar', pMid.x + 7.5, pMid.z - 3.0, null, { scale: 1.1, rotY: -0.3, yOffset: -0.15, tint: 0xcac2a8, emissive: 0x3c4830, emissiveIntensity: 0.38 }, 1.4);
    const pStart = uvToWorld(0.20, 0.80, half);
    placeGlb('jungle_statue', pStart.x - 6.0, pStart.z - 5.5, null, { scale: 1.05, rotY: 0.6, yOffset: -0.15, tint: 0xd0c6aa, emissive: 0x3e4c32, emissiveIntensity: 0.40 }, 1.6);
    placeGlb('jungle_ruin_wall', pStart.x + 7.5, pStart.z - 7.5, null, { scale: 0.95, rotY: -0.5, yOffset: -0.2, tint: 0xc8c0a6, emissive: 0x3a4830, emissiveIntensity: 0.38 }, 2.6);
    placeGlb('lost_stonewalk', pStart.x - 1.5, pStart.z - 8.5, null, { scale: 0.55, rotY: 0.4, yOffset: -0.25, tint: 0xd8cca8, emissive: 0x443c2c, emissiveIntensity: 0.34 }, 0);
  } else if (bp.id === 16 || bp.id === 17) {
    // #16 幽霧哥德墓園 ＆ #17 深淵哥德古堡：暗紫哥德鐘樓、巨型骷髏祭壇、紫晶柱與燃燒火炬
    const pStart = uvToWorld(bp.id === 16 ? 0.22 : 0.16, bp.id === 16 ? 0.78 : 0.80, half);
    placeGlb('bell_tower', pStart.x - 7.5, pStart.z - 7.0, null, { scale: 1.15, rotY: 0.5, yOffset: -0.2, flatTint: 0x5c547c, emissive: 0x362a5c, emissiveIntensity: 0.48 }, 2.6);
    placeGlb('cave_skull', pStart.x + 8.5, pStart.z - 8.5, null, { scale: 1.1, rotY: -0.6, yOffset: -0.15, flatTint: 0x6a628c, emissive: 0x463274, emissiveIntensity: 0.50 }, 2.8);
    placeGlb('purple_crystal', pStart.x + 5.5, pStart.z - 3.5, null, { scale: 0.95, rotY: 0.4, yOffset: -0.1, flatTint: 0xb872ff, emissive: 0x7c38d8, emissiveIntensity: 0.62 }, 1.2);
    placeGlb('fire_torch', pStart.x - 3.8, pStart.z - 4.2, null, { scale: 1.15, rotY: 0, yOffset: -0.1, emissive: 0xff8c38, emissiveIntensity: 0.65 }, 0.5);
    const pBoss = uvToWorld(0.50, bp.id === 16 ? 0.50 : 0.20, half);
    placeGlb('bell_tower', pBoss.x, pBoss.z - 7.5, null, { scale: 1.35, rotY: 0, yOffset: -0.2, flatTint: 0x544c72, emissive: 0x3c2c66, emissiveIntensity: 0.52 }, 3.0);
    placeGlb('stonehenge', pBoss.x - 8.0, pBoss.z - 3.0, null, { scale: 1.05, rotY: 0.3, yOffset: -0.15, flatTint: 0x625a82, emissive: 0x382858, emissiveIntensity: 0.46 }, 2.2);
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
    // #19 星際白銀前哨站：星艦登陸平台、太空飛艇與量子反應爐（4123 Alien Planets Vol2）
    const pStart = uvToWorld(0.22, 0.76, half);
    placeGlb('scifi_platform', pStart.x - 7.5, pStart.z - 7.0, null, { scale: 1.1, rotY: 0.4, yOffset: -0.15, tint: 0xdff6ff, emissive: 0x2c6c98, emissiveIntensity: 0.50 }, 2.8);
    placeGlb('sky_flyer', pStart.x + 6.5, pStart.z - 6.5, null, { scale: 1.15, rotY: -0.7, yOffset: 1.6, tint: 0xeaf8ff, emissive: 0x3888c4, emissiveIntensity: 0.54 }, 2.0);
    placeGlb('scifi_reactor', pStart.x + 0.5, pStart.z - 12.0, null, { scale: 1.1, rotY: 0, yOffset: -0.15, tint: 0xd4f0ff, emissive: 0x3084b8, emissiveIntensity: 0.52 }, 2.6);
    const pMid = uvToWorld(0.50, 0.50, half);
    placeGlb('scifi_reactor', pMid.x, pMid.z - 6.5, null, { scale: 1.35, rotY: 0.3, yOffset: -0.15, tint: 0xdcf4ff, emissive: 0x3894cc, emissiveIntensity: 0.56 }, 3.2);
    placeGlb('sky_flyer', pMid.x - 9.0, pMid.z - 3.0, null, { scale: 1.1, rotY: 0.9, yOffset: 2.8, tint: 0xf0faff, emissive: 0x4298d4, emissiveIntensity: 0.56 }, 0);
  } else if (bp.id === 20) {
    // #20 異星蜂巢裂谷：巨型紫紅異星塔、共鳴結晶群與墜落太空飛艇（4123 ＋ 4384 Polyworks）
    const pStart = uvToWorld(0.50, 0.82, half);
    placeGlb('alien_hive_tower', pStart.x - 7.5, pStart.z - 8.5, null, { scale: 1.15, rotY: 0.4, yOffset: -0.15, tint: 0xf4b8ff, emissive: 0x7c2c9c, emissiveIntensity: 0.56 }, 2.6);
    placeGlb('purple_crystal', pStart.x + 6.5, pStart.z - 5.0, null, { scale: 1.15, rotY: -0.4, yOffset: -0.1, flatTint: 0xe068ff, emissive: 0x9c32d8, emissiveIntensity: 0.65 }, 1.5);
    placeGlb('sky_flyer', pStart.x + 9.0, pStart.z - 10.0, null, { scale: 1.05, rotY: 1.2, yOffset: 0.6, tint: 0xf0c8ff, emissive: 0x6a3288, emissiveIntensity: 0.50 }, 2.2);
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
    if (legendary) g.ui.bossBar(true, f.name + '守護獸');
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
