// 海風港鎮（第二城鎮）、3D 乘船航行系統、新創意地圖地標與外觀造型系統
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat } from './world.js';
import { buildHouse, buildStall } from './models.js';
import { mulberry32 } from './util.js';

// ======================== 1. 外觀造型系統（Cosmetics） ========================
export const COSMETICS = {
  hats: [
    { id: 'hood', name: '經典尖帽', icon: '🧙', color: 0x2f8a7e },
    { id: 'straw', name: '海風草帽', icon: '👒', color: 0xebd07a },
    { id: 'crown', name: '星燈皇冠', icon: '👑', color: 0xffd24a },
    { id: 'frog', name: '旅人蛙帽', icon: '🐸', color: 0x62b85a },
    { id: 'beanie', name: '雪原毛帽', icon: '🧶', color: 0xd96459 },
  ],
  backs: [
    { id: 'none', name: '輕裝無背飾', icon: '—' },
    { id: 'pack', name: '孤山行囊', icon: '🎒' },
    { id: 'wings', name: '滑翔星翼', icon: '🪽' },
    { id: 'lanterns', name: '雙燈背架', icon: '🏮' },
  ],
  auras: [
    { id: 'none', name: '原木微光', icon: '—', color: 0xffd36e },
    { id: 'gold', name: '暖金星輝', icon: '✨', color: 0xffe26a },
    { id: 'ocean', name: '海藍潮光', icon: '🌊', color: 0x6ee8ff },
    { id: 'sakura', name: '櫻花飛瓣', icon: '🌸', color: 0xffa6c9 },
    { id: 'violet', name: '紫電星芒', icon: '⚡', color: 0xc88cff },
  ],
};

// ======================== 2. 3D 木造渡船（Ferry Boat） ========================
export function buildFerryBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(mergeGeometries([
    part(new THREE.BoxGeometry(1.9, 0.55, 3.8), 0x8f5934, 0, 0.28, 0),
    part(new THREE.BoxGeometry(1.5, 0.2, 3.2), 0xc48b55, 0, 0.52, 0),
    part(new THREE.ConeGeometry(1.05, 1.1, 4), 0x8f5934, 0, 0.35, 2.35, Math.PI / 2, Math.PI / 4, 0),
    part(new THREE.BoxGeometry(1.6, 0.18, 0.45), 0x6e4326, 0, 0.65, -0.7),
    part(new THREE.BoxGeometry(1.6, 0.18, 0.45), 0x6e4326, 0, 0.65, 0.6),
    part(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), 0x6e4326, 0, 1.5, -1.2),
    part(new THREE.BoxGeometry(1.5, 1.0, 0.08), 0xfff3d4, 0, 2.0, -1.15),
  ]), toonMat({ vertexColors: true }));
  hull.castShadow = true; hull.receiveShadow = true;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), new THREE.MeshBasicMaterial({ color: 0xffd86b }));
  lamp.position.set(0, 1.15, 2.15);
  g.add(hull, lamp);
  return g;
}

// ======================== 3. 第二城鎮：海風港鎮（Sea-Breeze Harbor） ========================
export function buildHarborTown(g) {
  const grp = new THREE.Group();
  const boxes = []; // 合理矩形碰撞（AABB）
  const obs = [];   // 圓形碰撞
  const addBox = (x, z, hw, hd) => boxes.push({ x, z, hw, hd, h: 0 });

  // 海港主碼頭木棧道（延伸向南側海面）
  const pier = new THREE.Mesh(mergeGeometries([
    part(new THREE.BoxGeometry(5.6, 0.32, 9.5), 0xb88252, 0, 0.12, 10.5),
    part(new THREE.BoxGeometry(0.28, 1.1, 0.28), 0x6b4530, -2.5, 0.4, 6.5),
    part(new THREE.BoxGeometry(0.28, 1.1, 0.28), 0x6b4530, 2.5, 0.4, 6.5),
    part(new THREE.BoxGeometry(0.28, 1.1, 0.28), 0x6b4530, -2.5, 0.4, 14.5),
    part(new THREE.BoxGeometry(0.28, 1.1, 0.28), 0x6b4530, 2.5, 0.4, 14.5),
  ]), toonMat({ vertexColors: true }));
  pier.receiveShadow = true; pier.castShadow = true;
  grp.add(pier);

  // 停泊中的渡船
  const boat = buildFerryBoat();
  boat.position.set(0, 0.05, 16.2);
  grp.add(boat);

  // 紅白條紋燈塔（海風港鎮地標）
  const lh = new THREE.Mesh(mergeGeometries([
    part(new THREE.CylinderGeometry(1.1, 1.5, 2.2, 10), 0xfff5e0, 0, 1.1, 0),
    part(new THREE.CylinderGeometry(0.95, 1.1, 1.8, 10), 0xd94f42, 0, 3.1, 0),
    part(new THREE.CylinderGeometry(0.85, 0.95, 1.8, 10), 0xfff5e0, 0, 4.9, 0),
    part(new THREE.CylinderGeometry(1.1, 1.0, 0.35, 10), 0x3b2a2a, 0, 5.95, 0),
    part(new THREE.CylinderGeometry(0.65, 0.65, 0.9, 8), 0xffe47a, 0, 6.55, 0),
    part(new THREE.ConeGeometry(1.05, 1.1, 8), 0xd94f42, 0, 7.5, 0),
  ]), toonMat({ vertexColors: true }));
  lh.position.set(-9.5, 0, -5.5); lh.castShadow = true;
  grp.add(lh);
  obs.push({ x: -9.5, z: -5.5, r: 1.8, h: 0 });

  // 海濱倉庫、外觀裁縫坊與漁夫酒館（附精準 AABB 矩形碰撞）
  const warehouse = buildHouse(0x4b7ea8, 0xf4e8ce, 3.8, 3.0);
  warehouse.position.set(8.5, 0, -4.5); grp.add(warehouse);
  addBox(8.5, -4.5, 2.0, 1.6);

  const tailor = buildHouse(0xe0785a, 0xfff2dc, 3.2, 2.8);
  tailor.position.set(-8.5, 0, 4.0); grp.add(tailor);
  addBox(-8.5, 4.0, 1.7, 1.5);

  const fishStall = buildStall(0x3ca6b8);
  fishStall.position.set(7.5, 0, 4.5); fishStall.rotation.y = -0.4; grp.add(fishStall);
  addBox(7.5, 4.5, 1.3, 0.8);

  // A Short Hike 風格彩色沙灘遮陽傘與野餐桌
  const umbrellaCols = [0xf26457, 0x3fa7d6, 0xf6c244];
  [[-3.8, 6.2], [4.2, 6.6], [10.5, 8.5]].forEach(([ux, uz], i) => {
    const umb = new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), 0x8a5a3b, 0, 1.1, 0),
      part(new THREE.ConeGeometry(1.35, 0.55, 8), umbrellaCols[i % 3], 0, 2.2, 0),
    ]), toonMat({ vertexColors: true }));
    umb.position.set(ux, 0, uz); umb.castShadow = true;
    grp.add(umb);
    obs.push({ x: ux, z: uz, r: 0.45, h: 0 });
  });

  const spots = [
    { kind: 'ferry_town', label: '乘船返航燈谷鎮（3D 航行）', x: 0, z: 13.5, top: 2.5 },
    { kind: 'open_stash', label: '海風港公共倉庫（重力整理箱）', x: 8.5, z: -2.2, top: 2.5 },
    { kind: 'open_cosmetics', label: '海鷗造型工坊（更換外觀造型）', x: -8.5, z: 6.2, top: 2.5 },
    { kind: 'market', label: '海風漁市拍賣行', x: 7.2, z: 5.8, top: 2.4 },
    { kind: 'guild', label: '港口公會分部', x: -6.8, z: -4.2, top: 2.5 },
    { kind: 'goto_field_7', label: '前往 浮空遺跡群（Lv.12）', x: -12.5, z: -10.5, top: 2.6 },
    { kind: 'goto_field_8', label: '前往 珊瑚潮汐灣（Lv.18）', x: 0, z: -13.0, top: 2.6 },
    { kind: 'goto_field_9', label: '前往 沉沒電光都（Lv.24）', x: 12.5, z: -10.5, top: 2.6 },
  ];

  // 三座出海探索指示木牌
  [[-12.5, -10.5, 0x8ae8ff], [0, -13.0, 0xffdc5e], [12.5, -10.5, 0xff9a4a]].forEach(([sx, sz, col]) => {
    const post = new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.2, 2.2, 0.2), 0x6b4530, 0, 1.1, 0),
      part(new THREE.BoxGeometry(1.8, 0.65, 0.14), 0xf6e6c2, 0, 2.0, 0),
      part(new THREE.OctahedronGeometry(0.24, 0), col, 0, 2.65, 0),
    ]), toonMat({ vertexColors: true }));
    post.position.set(sx, 0, sz); post.castShadow = true;
    grp.add(post);
  });

  return { group: grp, spots, obstacles: obs, boxes, boat };
}

// ======================== 4. 新創意地圖專屬 3D 地標裝飾（Zones 7–9） ========================
export function buildZoneLandmarks(g) {
  if (!g.field || g.field < 7) return;
  const r = mulberry32(8800 + g.field * 73);
  const grp = new THREE.Group();
  if (g.field === 7) {
    // 浮空遺跡群：巨大拱門與浮石（Kirby / Foliage Ruins 靈感）
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4, dist = 12 + r() * 8;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist, y = g.world.gh(x, z);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.48, 6, 14, Math.PI), toonMat({ color: 0x7ac8e0 }));
      arch.position.set(x, y + 0.3, z); arch.rotation.y = r() * Math.PI; arch.castShadow = true;
      grp.add(arch);
    }
  } else if (g.field === 8) {
    // 珊瑚潮汐灣：彩色沙灘傘、浮標與珊瑚礁
    const cols = [0xff6b6b, 0x3ec1d3, 0xffd166, 0xff9f43];
    for (let i = 0; i < 6; i++) {
      const pos = g.world.randomWalkable(r, g.player.pos, 6);
      const y = g.world.gh(pos.x, pos.z);
      const umb = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6), 0x8a5a3b, 0, 1.05, 0),
        part(new THREE.ConeGeometry(1.3, 0.55, 8), cols[i % cols.length], 0, 2.15, 0),
      ]), toonMat({ vertexColors: true }));
      umb.position.set(pos.x, y, pos.z); umb.castShadow = true;
      grp.add(umb);
      g.world.obstacles.push({ x: pos.x, z: pos.z, r: 0.4, h: y });
    }
  } else if (g.field === 9) {
    // 沉沒電光都：水面上發光的電線桿與太陽能屋頂浮台（Hypervoltaic Chronicles 靈感）
    for (let i = 0; i < 5; i++) {
      const pos = g.world.randomWalkable(r, g.player.pos, 7);
      const y = g.world.gh(pos.x, pos.z);
      const pole = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6), 0x7a543c, 0, 2.1, 0),
        part(new THREE.BoxGeometry(1.6, 0.12, 0.12), 0x7a543c, 0, 3.6, 0),
        part(new THREE.BoxGeometry(0.28, 0.32, 0.28), 0xffcf56, -0.65, 3.4, 0),
        part(new THREE.BoxGeometry(0.28, 0.32, 0.28), 0x58e0ff, 0.65, 3.4, 0),
      ]), toonMat({ vertexColors: true }));
      pole.position.set(pos.x, y, pos.z); pole.castShadow = true;
      grp.add(pole);
      g.world.obstacles.push({ x: pos.x, z: pos.z, r: 0.35, h: y });
    }
  }
  g.world.group.add(grp);
}
