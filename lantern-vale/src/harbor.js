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

// ======================== 2.5 3D 木造碼頭棧橋（從海岸延伸入深海，附木樁、繫船柱與暖黃燈柱） ========================
export function buildWoodenPier(startZ = 18.5, endZ = 27.6, width = 5.4) {
  const g = new THREE.Group();
  const len = endZ - startZ;
  const midZ = (startZ + endZ) / 2;
  const parts = [
    part(new THREE.BoxGeometry(width, 0.28, len), 0xa87448, 0, 0.14, midZ),
  ];
  // 橫向木板紋理與深水木樁
  const planks = Math.max(6, Math.round(len / 0.85));
  for (let i = 0; i < planks; i++) {
    const pz = startZ + (i + 0.5) * (len / planks);
    parts.push(part(new THREE.BoxGeometry(width + 0.08, 0.06, 0.62), i % 2 ? 0xb88454 : 0x9b693f, 0, 0.28, pz));
  }
  const hw = width / 2 - 0.25;
  for (let z = startZ + 0.6; z <= endZ - 0.3; z += 2.8) {
    for (const sx of [-hw, hw]) {
      parts.push(part(new THREE.CylinderGeometry(0.18, 0.22, 2.4, 6), 0x5c3a26, sx, -0.35, z));
      parts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 6), 0x7a5136, sx, 0.52, z)); // 繫船柱
    }
  }
  // 棧橋左右麻繩欄杆與盡頭燈柱
  for (const sx of [-hw, hw]) {
    parts.push(part(new THREE.BoxGeometry(0.1, 0.08, len - 1.2), 0xd4b684, sx, 0.72, midZ - 0.4));
    parts.push(part(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), 0x4b3224, sx, 1.35, endZ - 0.5));
  }
  const m = new THREE.Mesh(mergeGeometries(parts), toonMat({ vertexColors: true }));
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  for (const sx of [-hw, hw]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.32), new THREE.MeshBasicMaterial({ color: 0xffd86b }));
    lamp.position.set(sx, 2.48, endZ - 0.5);
    g.add(lamp);
  }
  const bounds = { x0: -width / 2 - 0.15, x1: width / 2 + 0.15, z0: startZ - 0.8, z1: endZ + 0.2, y: 0.3 };
  return { group: g, bounds, tipZ: endZ };
}

// ======================== 3. 第二城鎮：海風港鎮（Sea-Breeze Harbor） ========================
export function buildHarborTown(g) {
  const grp = new THREE.Group();
  const boxes = []; // 合理矩形碰撞（AABB）
  const obs = [];   // 圓形碰撞
  const addBox = (x, z, hw, hd) => boxes.push({ x, z, hw, hd, h: 0 });

  // 海港主碼頭木棧橋（由南岸 z=16.5 延伸出海至 z=27.6）
  const pierData = buildWoodenPier(16.5, 27.6, 5.6);
  grp.add(pierData.group);

  // 停泊於碼頭深水盡頭的渡船
  const boat = buildFerryBoat();
  boat.position.set(0, -0.02, 29.8);
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
    { kind: 'ferry_town', label: '登船返航燈谷鎮（碼頭啟航）', x: 0, z: 26.2, top: 2.8 },
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

  return { group: grp, spots, obstacles: obs, boxes, boat, pierBounds: pierData.bounds };
}

// ======================== 4. 全區域宏偉地標與建築裝飾（Zones 1–9，靈感源自巨型天環、八角古泉與碧藍聖樹礁島） ========================
export function buildZoneLandmarks(g) {
  if (!g.field) return;
  const r = mulberry32(8800 + g.field * 73);
  const grp = new THREE.Group();
  const addBox = (x, z, hw, hd, h = 0) => { g.worldBoxes = g.worldBoxes || []; g.worldBoxes.push({ x, z, hw, hd, h }); };

  const buildAncientFountain = (cx, cz, y) => {
    const f = new THREE.Group();
    const parts = [
      part(new THREE.CylinderGeometry(3.8, 4.1, 0.75, 8), 0xd2cab4, 0, 0.35, 0),
      part(new THREE.CylinderGeometry(3.15, 3.15, 0.58, 8), 0x4eb4e8, 0, 0.42, 0),
      part(new THREE.CylinderGeometry(0.65, 0.85, 1.5, 8), 0xc4bca6, 0, 0.9, 0),
      part(new THREE.OctahedronGeometry(0.58, 0), 0x9cf0ff, 0, 2.05, 0),
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(a) * 5.2, pz = Math.sin(a) * 5.2, ph = 2.6 + (i % 2) * 1.4;
      parts.push(part(new THREE.BoxGeometry(0.95, ph, 0.95), 0xbab29c, px, ph / 2, pz));
      parts.push(part(new THREE.BoxGeometry(1.15, 0.25, 1.15), 0x7ea85e, px, ph + 0.12, pz));
      g.world.obstacles.push({ x: cx + px, z: cz + pz, r: 0.65, h: y });
    }
    const m = new THREE.Mesh(mergeGeometries(parts), toonMat({ vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    f.add(m); f.position.set(cx, y, cz);
    g.world.obstacles.push({ x: cx, z: cz, r: 3.9, h: y });
    grp.add(f);
  };

  const buildMegaSkyRing = (cx, cz, y, radius, col, rotY) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.18, 7, 22, Math.PI), toonMat({ color: col }));
    ring.position.set(cx, y - 0.6, cz); ring.rotation.y = rotY; ring.castShadow = true; ring.receiveShadow = true;
    grp.add(ring);
    const pill = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, radius * 0.13, 6, 18, Math.PI), toonMat({ color: col }));
    pill.position.set(cx + Math.cos(rotY) * (radius * 0.55), y + radius * 0.58, cz - Math.sin(rotY) * (radius * 0.55));
    pill.rotation.y = rotY + 0.35; pill.castShadow = true;
    grp.add(pill);
  };

  const buildSeaBuoy = (bx, bz) => {
    const b = new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(0.85, 0.95, 0.55, 10), 0xf05228, 0, 0.05, 0),
      part(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 10), 0xfff6e5, 0, 0.18, 0),
      part(new THREE.ConeGeometry(0.65, 1.5, 4), 0xe64a22, 0, 1.05, 0),
      part(new THREE.SphereGeometry(0.18, 6, 5), 0xffe46b, 0, 1.85, 0),
      part(new THREE.TorusGeometry(0.45, 0.14, 6, 12), 0xf46036, 1.65, -0.05, 0.4, Math.PI / 2, 0, 0),
    ]), toonMat({ vertexColors: true }));
    b.position.set(bx, -0.22, bz); b.castShadow = true;
    grp.add(b);
  };

  const H = g.world.half;
  if (g.field === 1) {
    const p1 = g.world.randomWalkable(r, g.player.pos, 16);
    buildAncientFountain(p1.x, p1.z, g.world.gh(p1.x, p1.z));
    buildMegaSkyRing(0, -H * 0.58, 0, 11.5, 0x74c6d8, 0.15);
    const mill = buildHouse(0xd96846, 0xfff2dc, 4.2, 4.2);
    const p2 = g.world.randomWalkable(r, g.player.pos, 22);
    mill.position.set(p2.x, g.world.gh(p2.x, p2.z), p2.z); mill.scale.setScalar(1.35);
    grp.add(mill); addBox(p2.x, p2.z, 2.9, 2.9, mill.position.y);
  } else if (g.field === 2 || g.field === 6) {
    const p1 = g.world.randomWalkable(r, g.player.pos, 18);
    buildAncientFountain(p1.x, p1.z, g.world.gh(p1.x, p1.z));
    const tree = new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(2.2, 3.6, 12, 8), 0x6a442d, 0, 6, 0),
      part(new THREE.IcosahedronGeometry(7.2, 1), g.field === 6 ? 0x458056 : 0x5ea350, 0, 13.5, 0),
      part(new THREE.IcosahedronGeometry(5.2, 1), 0x8cc85a, 3.8, 11.5, 2.2),
      part(new THREE.IcosahedronGeometry(4.8, 1), 0x70b44e, -3.6, 12.0, -2.0),
    ]), toonMat({ vertexColors: true }));
    tree.position.set(H * 0.25, g.world.gh(H * 0.25, -H * 0.28), -H * 0.28); tree.castShadow = true;
    grp.add(tree); g.world.obstacles.push({ x: tree.position.x, z: tree.position.z, r: 3.4, h: tree.position.y });
  } else if (g.field === 3 || g.field === 5) {
    const col = g.field === 5 ? 0xff7a3c : 0x6ae8c8;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5, dist = H * 0.42;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist, y = g.world.gh(x, z);
      const ob = new THREE.Mesh(mergeGeometries([
        part(new THREE.BoxGeometry(2.2, 1.2, 2.2), 0x5d565e, 0, 0.6, 0),
        part(new THREE.CylinderGeometry(0.45, 1.05, 8.5, 4), 0x7a737c, 0, 5.2, 0),
        part(new THREE.OctahedronGeometry(0.85, 0), col, 0, 10.2, 0),
      ]), toonMat({ vertexColors: true }));
      ob.position.set(x, y, z); ob.castShadow = true; grp.add(ob);
      addBox(x, z, 1.2, 1.2, y);
    }
  } else if (g.field === 4) {
    const obs = new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(4.2, 4.8, 4.5, 10), 0xd8e2f4, 0, 2.25, 0),
      part(new THREE.SphereGeometry(4.0, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x5c84b8, 0, 4.4, 0),
      part(new THREE.CylinderGeometry(0.4, 0.5, 4.2, 6), 0xffd268, 2.2, 6.2, 1.2, 0.5, 0, -0.5),
    ]), toonMat({ vertexColors: true }));
    const p1 = g.world.randomWalkable(r, g.player.pos, 20);
    obs.position.set(p1.x, g.world.gh(p1.x, p1.z), p1.z); obs.castShadow = true;
    grp.add(obs); g.world.obstacles.push({ x: p1.x, z: p1.z, r: 4.5, h: obs.position.y });
    buildMegaSkyRing(-H * 0.25, -H * 0.45, 0, 10.5, 0x9ec8f2, -0.3);
  } else if (g.field === 7) {
    buildMegaSkyRing(0, -H * 0.48, 0, 14.5, 0x6ac6e8, 0.1);
    buildMegaSkyRing(-H * 0.42, H * 0.12, 0, 9.5, 0x8ad8c0, 1.2);
    buildMegaSkyRing(H * 0.40, -H * 0.10, 0, 10.5, 0x74b8e6, -0.9);
    const p1 = g.world.randomWalkable(r, g.player.pos, 18);
    buildAncientFountain(p1.x, p1.z, g.world.gh(p1.x, p1.z));
  } else if (g.field === 8) {
    const cols = [0xff6b6b, 0x3ec1d3, 0xffd166, 0xff9f43];
    for (let i = 0; i < 8; i++) {
      const pos = g.world.randomWalkable(r, g.player.pos, 8);
      const y = g.world.gh(pos.x, pos.z);
      const umb = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6), 0x8a5a3b, 0, 1.15, 0),
        part(new THREE.ConeGeometry(1.5, 0.6, 8), cols[i % cols.length], 0, 2.35, 0),
      ]), toonMat({ vertexColors: true }));
      umb.position.set(pos.x, y, pos.z); umb.castShadow = true; grp.add(umb);
      g.world.obstacles.push({ x: pos.x, z: pos.z, r: 0.45, h: y });
    }
    buildSeaBuoy(H * 0.68, H * 0.45);
    buildSeaBuoy(-H * 0.66, H * 0.35);
    buildSeaBuoy(0, H * 0.72);
    const p1 = g.world.randomWalkable(r, g.player.pos, 16);
    buildAncientFountain(p1.x, p1.z, g.world.gh(p1.x, p1.z));
  } else if (g.field === 9) {
    const tower = new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(1.2, 2.4, 15, 6), 0x627382, 0, 7.5, 0),
      part(new THREE.TorusGeometry(3.2, 0.28, 6, 12), 0x58e0ff, 0, 11.5, 0, Math.PI / 2, 0, 0),
      part(new THREE.TorusGeometry(2.2, 0.24, 6, 12), 0xffd25a, 0, 14.2, 0, Math.PI / 2, 0, 0),
      part(new THREE.OctahedronGeometry(1.1, 0), 0x8cf6ff, 0, 16.0, 0),
    ]), toonMat({ vertexColors: true }));
    tower.position.set(0, g.world.gh(0, -H * 0.36), -H * 0.36); tower.castShadow = true;
    grp.add(tower); g.world.obstacles.push({ x: 0, z: -H * 0.36, r: 2.6, h: tower.position.y });
    for (let i = 0; i < 8; i++) {
      const pos = g.world.randomWalkable(r, g.player.pos, 9);
      const y = g.world.gh(pos.x, pos.z);
      const pole = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.14, 0.18, 4.8, 6), 0x7a543c, 0, 2.4, 0),
        part(new THREE.BoxGeometry(1.9, 0.14, 0.14), 0x7a543c, 0, 4.1, 0),
        part(new THREE.BoxGeometry(0.32, 0.36, 0.32), 0xffcf56, -0.75, 3.85, 0),
        part(new THREE.BoxGeometry(0.32, 0.36, 0.32), 0x58e0ff, 0.75, 3.85, 0),
      ]), toonMat({ vertexColors: true }));
      pole.position.set(pos.x, y, pos.z); pole.castShadow = true; grp.add(pole);
      g.world.obstacles.push({ x: pos.x, z: pos.z, r: 0.4, h: y });
    }
    buildSeaBuoy(H * 0.65, H * 0.55);
  }
  g.world.group.add(grp);
}
