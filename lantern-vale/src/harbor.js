// 海風港鎮（第二城鎮）、3D 乘船航行系統、新創意地圖地標與外觀造型系統
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat } from './world.js';
import { attachLandmarkGlb, attachPalmovProp } from './assets.js';
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

// ======================== 2. 3D 紅白海港拖船（致敬 A Short Hike 經典紅頂拖船） ========================
export function buildFerryBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(mergeGeometries([
    part(new THREE.BoxGeometry(2.3, 0.65, 4.4), 0xd85a3a, 0, 0.32, 0),
    part(new THREE.BoxGeometry(2.4, 0.2, 4.5), 0xf0a838, 0, 0.16, 0),
    part(new THREE.BoxGeometry(1.9, 0.16, 3.9), 0xd89d60, 0, 0.66, 0),
    part(new THREE.ConeGeometry(1.25, 1.35, 4), 0xd85a3a, 0, 0.36, 2.75, Math.PI / 2, Math.PI / 4, 0),
    part(new THREE.BoxGeometry(1.65, 1.2, 1.85), 0xf8ebd0, 0, 1.3, -0.35),
    part(new THREE.BoxGeometry(1.85, 0.24, 2.05), 0xc83e32, 0, 1.98, -0.35),
    part(new THREE.BoxGeometry(0.45, 0.38, 0.08), 0x3b2a2a, -0.4, 1.42, 0.59),
    part(new THREE.BoxGeometry(0.45, 0.38, 0.08), 0x3b2a2a, 0.4, 1.42, 0.59),
    part(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6), 0xf2b830, 0, 2.45, -0.7),
    part(new THREE.TorusGeometry(0.26, 0.08, 6, 10), 0xfff8ec, 1.18, 0.72, -0.2, 0, Math.PI / 2, 0),
    part(new THREE.TorusGeometry(0.26, 0.08, 6, 10), 0xfff8ec, -1.18, 0.72, -0.2, 0, Math.PI / 2, 0),
    part(new THREE.BoxGeometry(0.55, 0.45, 0.55), 0xb8783e, -0.45, 0.92, 1.35),
    part(new THREE.BoxGeometry(0.45, 0.38, 0.45), 0xc98a4a, 0.48, 0.88, -1.65),
  ]), toonMat({ vertexColors: true }));
  hull.castShadow = true; hull.receiveShadow = true;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), new THREE.MeshBasicMaterial({ color: 0xffdf7a }));
  lamp.position.set(0, 1.2, 2.35);
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

  const placeGlb = (key, fb, x, z, ry = 0, opts = {}) => {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = ry;
    grp.add(holder);
    attachLandmarkGlb(holder, key, fb, { emissive: 0x4c4438, emissiveIntensity: 0.42, yOffset: -0.1, ...opts });
    return holder;
  };

  const placePalmov = (key, fb, x, z, ry = 0, opts = {}) => {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = ry;
    grp.add(holder);
    attachPalmovProp(holder, key, fb, { yOffset: -0.05, ...opts });
    return holder;
  };

  // 海港燈塔（Palmov 統一低多邊形海港燈塔）
  placePalmov('lighthouse', null, -9.5, -5.5, -0.35, { scale: 1.0 });
  obs.push({ x: -9.5, z: -5.5, r: 1.8, h: 0 });

  // 海濱倉庫、海鷗造型工坊與漁市帳篷（全套 Palmov 統一海港建築群）
  placePalmov('wooden_house_2', buildHouse(0x4b7ea8, 0xf4e8ce, 3.8, 3.0), 8.5, -4.5, -0.4, { scale: 1.0 });
  addBox(8.5, -4.5, 2.0, 1.6);

  placePalmov('village_house_2', buildHouse(0xe0785a, 0xfff2dc, 3.2, 2.8), -8.5, 4.0, 0.45, { scale: 0.95 });
  addBox(-8.5, 4.0, 1.7, 1.5);

  placePalmov('food_tent_1', buildStall(0x3ca6b8), 7.5, 4.5, -0.4, { scale: 0.72 });
  addBox(7.5, 4.5, 1.3, 0.8);
  placePalmov('wooden_house_1', null, 11.8, 5.8, -0.65, { scale: 0.95 });
  addBox(11.8, 5.8, 2.0, 1.8);

  // 港灣路燈、長椅、營火與停泊帆船／漁船
  [[-3.2, 12.0], [3.2, 12.0], [-4.5, 1.5], [4.5, 1.5]].forEach(([lx, lz]) => {
    placePalmov('lamppost', null, lx, lz, lx < 0 ? Math.PI / 2 : -Math.PI / 2, { scale: 1.0 });
    obs.push({ x: lx, z: lz, r: 0.25, h: 0 });
  });
  placePalmov('bonfire', null, 0, 2.2, 0, { scale: 0.95 });
  obs.push({ x: 0, z: 2.2, r: 0.7, h: 0 });
  placePalmov('bench', null, -2.5, 3.8, 0.6, { scale: 0.46 });
  placePalmov('bench', null, 2.5, 3.8, -0.6, { scale: 0.46 });

  // 熱帶椰子樹與停泊近海的 Palmov 帆船／漁船
  [[-13.5, 8.5, 0.3], [-4.5, 12.2, 1.4], [12.5, 11.8, -0.8], [14.0, -2.5, 2.1]].forEach(([cx, cz, ry]) => {
    placeGlb('coconut_tree', null, cx, cz, ry, { scale: 1.05, emissive: 0x38482c, emissiveIntensity: 0.38 });
    obs.push({ x: cx, z: cz, r: 0.7, h: 0 });
  });
  placePalmov('ship_dock', null, -8.8, 22.0, 0.5, { scale: 0.98, yOffset: -0.45 });
  placePalmov('fishing_boat', null, 9.5, 21.0, -0.7, { scale: 1.05, yOffset: -0.35 });

  // 海濱彩色帳篷與木桶貨箱
  [[-3.8, 6.8, 'camp_tent_red'], [4.2, 6.8, 'camp_tent_blue'], [10.5, 8.5, 'camp_tent_yellow']].forEach(([ux, uz, tk]) => {
    placePalmov(tk, null, ux, uz, ux < 0 ? 0.4 : -0.4, { scale: 0.95 });
    obs.push({ x: ux, z: uz, r: 0.9, h: 0 });
  });
  placePalmov('barrel', null, 5.2, 3.4, 0.3, { scale: 1.1 });
  placePalmov('box', null, 6.0, 2.8, 0.8, { scale: 1.0 });

  const spots = [
    { kind: 'ferry_town', label: '登船返航燈谷鎮（碼頭啟航）', x: 0, z: 26.2, top: 2.8 },
    { kind: 'open_stash', label: '海風港公共倉庫（重力整理箱）', x: 8.5, z: -2.2, top: 2.5 },
    { kind: 'open_cosmetics', label: '海鷗造型工坊（更換外觀造型）', x: -8.5, z: 6.2, top: 2.5 },
    { kind: 'market', label: '海風漁市拍賣行', x: 7.2, z: 5.8, top: 2.4 },
    { kind: 'guild', label: '港口公會分部', x: -6.8, z: -4.2, top: 2.5 },
    { kind: 'goto_field_7', label: '前往 浮空遺跡群（Lv.12）', x: -12.5, z: -10.5, top: 2.6 },
    { kind: 'goto_field_8', label: '前往 珊瑚潮汐灣（Lv.18）', x: 0, z: -13.0, top: 2.6 },
    { kind: 'goto_field_9', label: '前往 沉沒電光都（Lv.24）', x: 12.5, z: -10.5, top: 2.6 },
    { kind: 'goto_field_10', label: '前往 🌸 櫻花水都（Lv.14）', x: -15.5, z: -3.5, top: 2.6 },
    { kind: 'goto_field_11', label: '前往 🌀 蒼穹巨環谷（Lv.22）', x: -6.5, z: -14.2, top: 2.6 },
    { kind: 'goto_field_12', label: '前往 🍁 紅楓工坊谷（Lv.28）', x: 6.5, z: -14.2, top: 2.6 },
  ];

  // 六座出海探索指示木牌（直達全 6 張海灣與新大陸區域）
  [[-12.5, -10.5, 0x8ae8ff], [0, -13.0, 0xffdc5e], [12.5, -10.5, 0xff9a4a], [-15.5, -3.5, 0xffa6c9], [-6.5, -14.2, 0x58d4f0], [6.5, -14.2, 0xe95c3f]].forEach(([sx, sz, col]) => {
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
    // 太陽能屋頂水上小屋與小黃船（致敬沉沒太陽能城市參考圖）
    for (let k = 0; k < 2; k++) {
      const pt = g.world.randomWalkable(r, g.player.pos, 18 + k * 14);
      const y = g.world.gh(pt.x, pt.z);
      const roofHut = new THREE.Mesh(mergeGeometries([
        part(new THREE.BoxGeometry(5.2, 1.4, 4.4), 0x46788e, 0, 0.7, 0),
        part(new THREE.BoxGeometry(3.4, 2.2, 2.8), 0x8e6b54, 0.4, 2.4, 0),
        part(new THREE.BoxGeometry(3.8, 0.16, 3.2), 0x3b72c8, 0.4, 3.85, 0, 0.35, 0, 0),
        part(new THREE.BoxGeometry(2.6, 0.14, 1.4), 0xc88a4a, -1.6, 1.5, 1.4),
        part(new THREE.BoxGeometry(0.9, 0.35, 2.1), 0xf6c445, -3.5, 0.25, 2.2, 0, 0.4, 0),
      ]), toonMat({ vertexColors: true }));
      roofHut.position.set(pt.x, y, pt.z); roofHut.castShadow = true; grp.add(roofHut);
      addBox(pt.x, pt.z, 2.8, 2.4, y);
    }
    buildSeaBuoy(H * 0.65, H * 0.55);
  } else if (g.field === 10) {
    // 櫻花水都：對稱碧藍運河大道、中央噴泉、雙翼雕像與櫻花林蔭
    const canal = new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(5.6, 0.28, 18), 0xd8d2c6, 0, 0.14, 0),
      part(new THREE.BoxGeometry(4.2, 0.32, 16.8), 0x4cc4ec, 0, 0.16, 0),
      part(new THREE.BoxGeometry(5.8, 0.36, 2.6), 0xe6dfd2, 0, 0.32, 0),
      part(new THREE.BoxGeometry(5.8, 0.36, 2.6), 0xe6dfd2, 0, 0.32, -6.5),
      part(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 10), 0xeae4d8, 0, 0.55, 4.5),
      part(new THREE.OctahedronGeometry(0.55, 0), 0xffb3d1, 0, 1.55, 4.5),
      ...[-3.8, 3.8].flatMap(sx => [
        part(new THREE.BoxGeometry(1.4, 0.6, 1.4), 0xd8d2c6, sx, 0.3, 6.2),
        part(new THREE.CylinderGeometry(0.32, 0.44, 1.7, 6), 0xf4efe6, sx, 1.45, 6.2),
        part(new THREE.BoxGeometry(1.3, 1.1, 0.12), 0xffffff, sx, 1.9, 5.9, 0, sx > 0 ? -0.4 : 0.4, 0),
        part(new THREE.BoxGeometry(0.1, 3.6, 0.1), 0x3b2a2a, sx * 1.25, 1.8, 7.6),
        part(new THREE.BoxGeometry(0.75, 1.6, 0.06), 0xd9483b, sx * 1.25, 2.4, 7.6),
        part(new THREE.BoxGeometry(0.45, 0.45, 0.08), 0xffd85a, sx * 1.25, 2.55, 7.64),
      ]),
    ]), toonMat({ vertexColors: true }));
    canal.position.set(0, g.world.gh(0, -14), -14); canal.castShadow = true; canal.receiveShadow = true;
    grp.add(canal);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, dist = 14 + (i % 3) * 14;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      if (!g.world.isWalk(x, z)) continue;
      const y = g.world.gh(x, z);
      const sk = new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6), 0x6b4530, 0, 1.1, 0),
        part(new THREE.IcosahedronGeometry(1.6, 1), i % 2 ? 0xffa6c9 : 0xffc4dc, 0, 2.9, 0),
        part(new THREE.IcosahedronGeometry(1.1, 1), 0xffe0ec, 0.9, 3.2, 0.4),
      ]), toonMat({ vertexColors: true }));
      sk.position.set(x, y, z); sk.castShadow = true; grp.add(sk);
      g.world.obstacles.push({ x, z, r: 0.7, h: y });
    }
  } else if (g.field === 11) {
    // 蒼穹巨環谷：地平線三重巨型碧藍天環＋山坡圓頂白屋
    buildMegaSkyRing(0, -H * 0.42, 0, 19.5, 0x58b8f0, 0.08);
    buildMegaSkyRing(H * 0.14, -H * 0.25, 2.5, 13.5, 0x68caf8, 0.22);
    buildMegaSkyRing(-H * 0.16, -H * 0.56, 4.0, 11.0, 0x7ad6ff, -0.18);
    for (let i = 0; i < 4; i++) {
      const pt = g.world.randomWalkable(r, g.player.pos, 16 + i * 10);
      const y = g.world.gh(pt.x, pt.z);
      const dome = new THREE.Mesh(mergeGeometries([
        part(new THREE.SphereGeometry(2.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf6f4ee, 0, 0, 0),
        part(new THREE.CylinderGeometry(2.3, 2.4, 0.25, 10), 0xa87448, 0, 0.12, 0),
        part(new THREE.BoxGeometry(0.85, 1.1, 0.2), 0xd85842, 0, 0.55, 2.15),
        part(new THREE.CylinderGeometry(0.28, 0.32, 1.2, 6), 0x9a8f86, 0.7, 2.2, -0.4),
      ]), toonMat({ vertexColors: true }));
      dome.position.set(pt.x, y, pt.z); dome.castShadow = true; grp.add(dome);
      g.world.obstacles.push({ x: pt.x, z: pt.z, r: 2.3, h: y });
    }
  } else if (g.field === 12) {
    // 紅楓工坊谷：黑白棋盤石磚廣場、發光熔爐與木工桌（挑選 6.5m 內無樹木遮擋的空曠平地）
    let pt = g.world.randomWalkable(r, g.player.pos, 18);
    for (let t = 0; t < 160; t++) {
      const cand = g.world.randomWalkable(r, g.player.pos, 18);
      if (!g.world.obstacles.some(o => Math.hypot(o.x - cand.x, o.z - cand.z) < o.r + 6.5)) { pt = cand; break; }
    }
    const y = g.world.gh(pt.x, pt.z);
    const tiles = [];
    for (let ix = -3; ix <= 3; ix++) for (let iz = -3; iz <= 3; iz++) {
      tiles.push(part(new THREE.BoxGeometry(1.15, 0.12, 1.15), (ix + iz) % 2 === 0 ? 0xf2e4cc : 0x625046, ix * 1.18, 0.06, iz * 1.18));
    }
    tiles.push(
      part(new THREE.CylinderGeometry(1.1, 1.45, 2.2, 8), 0x9e978e, 0, 1.1, -3.2),
      part(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 6), 0x867f76, 0, 2.8, -3.2),
      part(new THREE.BoxGeometry(0.8, 0.7, 0.2), 0xffb838, 0, 0.75, -2.0),
      part(new THREE.BoxGeometry(2.4, 0.85, 1.0), 0x9a643a, -2.8, 0.42, 1.5),
      part(new THREE.BoxGeometry(2.4, 0.85, 1.0), 0x9a643a, 2.8, 0.42, 1.5),
    );
    const yard = new THREE.Mesh(mergeGeometries(tiles), toonMat({ vertexColors: true }));
    yard.position.set(pt.x, y, pt.z); yard.castShadow = true; yard.receiveShadow = true;
    grp.add(yard);
    g.world.obstacles.push({ x: pt.x, z: pt.z - 3.2, r: 1.6, h: y });
    buildAncientFountain(pt.x + 14, pt.z + 10, g.world.gh(pt.x + 14, pt.z + 10));
  }
  g.world.group.add(grp);
}
