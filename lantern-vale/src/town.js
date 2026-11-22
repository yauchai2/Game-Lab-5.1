// 燈谷鎮場景：石板廣場、酒館、山牆小屋、市集、花園、水池與小橋、雕像與旗幟
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat, windMat } from './world.js';

const M = (parts, opts = {}) => { const m = new THREE.Mesh(mergeGeometries(parts), opts.wind ? windMat({ vertexColors: true }, opts.wind) : toonMat({ vertexColors: true, ...opts })); m.castShadow = true; m.receiveShadow = true; return m; };
const B = (w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0) => part(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
const faceCenter = (x, z) => Math.atan2(-x, -z);

// 山牆屋頂：兩片斜板＋瓦片橫紋＋三角山牆
function gable(w, d, h, roof, roofDark, wall, y0) {
  const slope = Math.hypot(w / 2, h), ang = Math.atan2(h, w / 2), L = slope + 0.35, parts = [];
  for (const s of [-1, 1]) {
    const cx = s * w / 4, cy = y0 + h / 2 + 0.07;
    parts.push(B(L, 0.14, d + 0.5, roof, cx, cy, 0, 0, 0, -s * ang));
    const ux = s * Math.cos(ang), uy = -Math.sin(ang), nx = s * Math.sin(ang), ny = Math.cos(ang);
    for (let k = 0; k < 4; k++) { const t = ((k + 0.5) / 4 - 0.5) * L * 0.9; // 瓦片橫紋
      parts.push(B(L * 0.06, 0.05, d + 0.52, roofDark, cx + ux * t + nx * 0.08, cy + uy * t + ny * 0.08, 0, 0, 0, -s * ang)); }
  }
  parts.push(B(0.18, 0.14, d + 0.55, roofDark, 0, y0 + h + 0.08, 0)); // 屋脊
  // 前後三角山牆
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, h); tri.closePath();
  for (const z of [-d / 2 + 0.01, d / 2 - 0.01]) { const g = new THREE.ShapeGeometry(tri); if (z < 0) g.rotateY(Math.PI); parts.push(part(g, wall, 0, y0, z)); }
  return parts;
}
function window3(x, y, z, lit) { return [B(0.56, 0.56, 0.08, 0x6a4a32, x, y, z), B(0.42, 0.42, 0.1, lit ? 0xffd88a : 0x4a5a7a, x, y, z + 0.01), B(0.05, 0.42, 0.11, 0x6a4a32, x, y, z + 0.015), B(0.42, 0.05, 0.11, 0x6a4a32, x, y, z + 0.015)]; }
function flowerBox(x, y, z, cols) { const p = [B(0.7, 0.18, 0.22, 0x7a4a33, x, y, z)]; cols.forEach((c, i) => p.push(part(new THREE.IcosahedronGeometry(0.1, 0), c, x - 0.25 + i * 0.25, y + 0.16, z))); return p; }

export function buildCottage(roof, wall = 0xf3e2c0, w = 3.6, d = 3.0, floors = 1) {
  const g = new THREE.Group(), H = 1.7 * floors, parts = [];
  parts.push(B(w, H, d, wall, 0, H / 2, 0), B(w + 0.2, 0.3, d + 0.2, 0x8f8a82, 0, 0.15, 0)); // 牆身＋石基
  parts.push(B(0.8, 1.25, 0.1, 0x7a4a33, 0, 0.7, d / 2 + 0.03), B(0.9, 0.12, 0.2, 0x6a4a32, 0, 1.38, d / 2 + 0.08)); // 門＋門簷
  parts.push(...window3(-w / 2 + 0.75, 1.1, d / 2 + 0.03, true), ...window3(w / 2 - 0.75, 1.1, d / 2 + 0.03, false));
  parts.push(...flowerBox(w / 2 - 0.75, 0.72, d / 2 + 0.14, [0xff8fb0, 0xffd45a, 0xffffff]));
  if (floors > 1) { parts.push(...window3(-w / 4, 2.7, d / 2 + 0.03, true), ...window3(w / 4, 2.7, d / 2 + 0.03, true)); parts.push(B(w + 0.1, 0.12, d + 0.1, 0x6a4a32, 0, 1.7, 0)); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) parts.push(B(0.1, H, 0.1, 0x6a4a32, s * (w / 2 + 0.02), H / 2, -d / 2 + 0.05 + k * d / 2)); // 木樑
  parts.push(B(0.45, 1.1, 0.45, 0x9a8f86, w / 4, H + 1.25, -d / 4), B(0.55, 0.12, 0.55, 0x7a7068, w / 4, H + 1.85, -d / 4)); // 煙囪
  parts.push(...gable(w, d, 1.5, roof, new THREE.Color(roof).multiplyScalar(0.72).getHex(), wall, H));
  g.add(M(parts)); g.userData.chimney = [w / 4, H + 1.95, -d / 4];
  return g;
}
export function buildTavern() {
  const g = new THREE.Group(), parts = [], w = 6.0, d = 4.4, H = 2.4;
  parts.push(B(w, H, d, 0xefe0c2, 0, H / 2, 0), B(w + 0.3, 0.4, d + 0.3, 0x8f8a82, 0, 0.2, 0));
  for (let k = 0; k < 5; k++) parts.push(B(0.12, H, 0.12, 0x6a4a32, -w / 2 + k * w / 4, H / 2, d / 2 + 0.03));
  parts.push(B(w, 0.12, 0.12, 0x6a4a32, 0, H - 0.05, d / 2 + 0.03));
  parts.push(...window3(-2.1, 1.4, d / 2 + 0.04, true), ...window3(2.1, 1.4, d / 2 + 0.04, true), ...window3(-0.9, 1.4, d / 2 + 0.04, true));
  parts.push(B(0.9, 1.5, 0.12, 0x6a3f2a, 1.0, 0.85, d / 2 + 0.05));
  parts.push(...flowerBox(-2.1, 0.85, d / 2 + 0.16, [0xff8fb0, 0xffffff, 0xc59aff]), ...flowerBox(2.1, 0.85, d / 2 + 0.16, [0xffd45a, 0xff8fb0, 0xffffff]));
  parts.push(...gable(w, d, 2.0, 0xb8452f, 0x8e3524, 0xefe0c2, H));
  // 前廊雨篷（木瓦）
  parts.push(B(3.0, 0.14, 1.8, 0x9a6a3a, -1.2, 2.0, d / 2 + 0.8, 0.28, 0, 0), B(0.12, 2.0, 0.12, 0x6a4a32, -2.6, 1.0, d / 2 + 1.5), B(0.12, 2.0, 0.12, 0x6a4a32, 0.2, 1.0, d / 2 + 1.5));
  // 吧檯
  parts.push(B(2.4, 0.9, 0.7, 0x7a4a33, -1.2, 0.45, d / 2 + 1.1), B(2.6, 0.1, 0.9, 0xa8744a, -1.2, 0.95, d / 2 + 1.1));
  // 大酒桶招牌
  parts.push(part(new THREE.CylinderGeometry(0.85, 0.85, 1.4, 10), 0x8a5a3b, -w / 2 + 0.3, H + 1.35, d / 2 - 0.4, 0, 0, Math.PI / 2));
  for (const x of [-0.45, 0.45]) parts.push(part(new THREE.CylinderGeometry(0.87, 0.87, 0.1, 10), 0x4a4a52, -w / 2 + 0.3 + x, H + 1.35, d / 2 - 0.4, 0, 0, Math.PI / 2));
  parts.push(B(0.5, 1.4, 0.5, 0x9a8f86, 2.0, H + 1.7, -0.8));
  g.add(M(parts)); g.userData.chimney = [2.0, H + 2.5, -0.8];
  return g;
}
export function buildTable(umbrella) {
  const g = new THREE.Group(), parts = [part(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 10), 0x7a9ac0, 0, 0.75, 0), part(new THREE.CylinderGeometry(0.07, 0.1, 0.75, 5), 0x6a4a32, 0, 0.38, 0)];
  for (const a of [0, 2.1, 4.2]) parts.push(part(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 6), 0x7a4a33, Math.cos(a) * 1.0, 0.45, Math.sin(a) * 1.0), part(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 4), 0x6a4a32, Math.cos(a) * 1.0, 0.22, Math.sin(a) * 1.0));
  if (umbrella) parts.push(part(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 4), 0x6a4a32, 0, 1.0, 0), part(new THREE.ConeGeometry(0.95, 0.4, 8), umbrella, 0, 2.1, 0));
  g.add(M(parts)); return g;
}
function bench() { const g = new THREE.Group(); g.add(M([B(1.5, 0.1, 0.45, 0xa8744a, 0, 0.5, 0), B(1.5, 0.45, 0.08, 0x8a5a3b, 0, 0.8, -0.2), B(0.1, 0.5, 0.4, 0x4a3a32, -0.65, 0.25, 0), B(0.1, 0.5, 0.4, 0x4a3a32, 0.65, 0.25, 0)])); return g; }
function barrel(x = 0, z = 0) { return part(new THREE.CylinderGeometry(0.34, 0.3, 0.7, 8), 0x8a5a3b, x, 0.35, z); }
function crate(x, z, s = 0.6, y = 0) { return B(s, s, s, 0xb88a50, x, y + s / 2, z); }
function lampPost(x, z) { const g = new THREE.Group(); g.add(M([part(new THREE.CylinderGeometry(0.07, 0.1, 2.2, 5), 0x3a3a44, 0, 1.1, 0), part(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 6), 0x3a3a44, 0, 0.05, 0)]));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.32), new THREE.MeshBasicMaterial({ color: 0xffd27a })); lamp.position.y = 2.35; g.add(lamp, M([B(0.42, 0.08, 0.42, 0x3a3a44, 0, 2.62, 0), B(0.42, 0.08, 0.42, 0x3a3a44, 0, 2.12, 0)])); return g; }
function planter(x, z, cols) { const parts = [part(new THREE.CylinderGeometry(0.4, 0.3, 0.45, 7), 0x9a7a5a, 0, 0.22, 0), part(new THREE.SphereGeometry(0.42, 6, 4), 0x4f9a4a, 0, 0.62, 0)]; cols.forEach((c, i) => parts.push(part(new THREE.IcosahedronGeometry(0.12, 0), c, Math.cos(i * 2.1) * 0.3, 0.9 + (i % 2) * 0.05, Math.sin(i * 2.1) * 0.3))); const g = new THREE.Group(); g.add(M(parts)); return g; }
function cypress(s = 1) { const g = new THREE.Group(); g.add(M([part(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 5), 0x6b4530, 0, 0.25, 0), part(new THREE.ConeGeometry(0.62, 2.4, 6), 0x3f8a4f, 0, 1.6, 0), part(new THREE.ConeGeometry(0.46, 1.4, 6), 0x4e9a58, 0, 2.5, 0)], { wind: [0.22, 0.5, 2.2] })); g.scale.setScalar(s); return g; }
function blossom(col = 0xf59ac0) { const g = new THREE.Group(); g.add(M([part(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), 0x6b4530, 0, 0.8, 0), part(new THREE.IcosahedronGeometry(1.15, 1), col, 0, 2.2, 0), part(new THREE.IcosahedronGeometry(0.8, 1), new THREE.Color(col).offsetHSL(0, 0, 0.06).getHex(), 0.7, 2.7, 0.3), part(new THREE.IcosahedronGeometry(0.7, 1), new THREE.Color(col).offsetHSL(0, 0, -0.05).getHex(), -0.7, 2.0, -0.3)], { wind: [0.24, 1.2, 2.0] })); return g; }
function banner(col) { const g = new THREE.Group(); g.add(M([part(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 5), 0x3a3a44, 0, 1.7, 0), B(1.1, 0.06, 0.06, 0x3a3a44, 0.5, 3.2, 0), B(0.8, 1.9, 0.05, col, 0.5, 2.2, 0), B(0.5, 0.5, 0.06, 0xf2c04a, 0.5, 2.5, 0.01), B(0.8, 0.14, 0.06, 0xf2c04a, 0.5, 1.3, 0.01)])); return g; }
function statue() { const g = new THREE.Group(); g.add(M([B(1.3, 0.5, 1.3, 0xcfc8bc, 0, 0.25, 0), B(0.9, 0.7, 0.9, 0xdcd5c8, 0, 0.85, 0), part(new THREE.CylinderGeometry(0.28, 0.4, 1.2, 6), 0xece6da, 0, 1.8, 0), part(new THREE.SphereGeometry(0.28, 6, 5), 0xece6da, 0, 2.6, 0), B(0.9, 0.8, 0.08, 0xf4efe6, -0.6, 2.2, -0.2, 0, 0.4, 0.5), B(0.9, 0.8, 0.08, 0xf4efe6, 0.6, 2.2, -0.2, 0, -0.4, -0.5)])); return g; }
function well() { const g = new THREE.Group(); g.add(M([part(new THREE.CylinderGeometry(0.85, 0.9, 0.8, 9), 0xb0a89a, 0, 0.4, 0), part(new THREE.CylinderGeometry(0.62, 0.62, 0.82, 9), 0x4aa8d8, 0, 0.42, 0), B(0.12, 2.0, 0.12, 0x6a4a32, -0.85, 1.4, 0), B(0.12, 2.0, 0.12, 0x6a4a32, 0.85, 1.4, 0), B(2.2, 0.12, 1.2, 0xb8452f, 0, 2.5, 0, 0, 0, 0), B(1.2, 0.1, 1.2, 0xb8452f, -0.5, 2.7, 0, 0, 0, 0.4)])); return g; }
function bridge(len = 3.2) { const g = new THREE.Group(), p = []; for (let k = 0; k < 9; k++) p.push(B(1.4, 0.1, len / 9 - 0.03, k % 2 ? 0xb88a50 : 0xa8744a, 0, 0.35, -len / 2 + (k + 0.5) * len / 9)); for (const s of [-1, 1]) p.push(B(0.1, 0.5, len, 0x6a4a32, s * 0.7, 0.65, 0), B(0.12, 0.7, 0.12, 0x4a3a32, s * 0.7, 0.45, -len / 2), B(0.12, 0.7, 0.12, 0x4a3a32, s * 0.7, 0.45, len / 2)); g.add(M(p)); return g; }
function stall(awning) { const g = new THREE.Group(), p = [B(2.4, 0.8, 1.0, 0x8a5a3b, 0, 0.4, 0), B(0.1, 2.0, 0.1, 0x6a4a32, -1.1, 1.0, -0.5), B(0.1, 2.0, 0.1, 0x6a4a32, 1.1, 1.0, -0.5), B(0.1, 1.7, 0.1, 0x6a4a32, -1.1, 0.85, 0.55), B(0.1, 1.7, 0.1, 0x6a4a32, 1.1, 0.85, 0.55)];
  for (let k = 0; k < 6; k++) p.push(B(0.46, 0.08, 1.8, k % 2 ? 0xfff6e2 : awning, -1.15 + k * 0.46, 1.95 - 0.04, 0, 0.22, 0, 0));
  const cols = [0xe0453a, 0xf4c542, 0x86bd3f, 0xff9a3a]; for (let k = 0; k < 7; k++) p.push(part(new THREE.IcosahedronGeometry(0.14, 0), cols[k % 4], -0.9 + k * 0.3, 0.9, 0.05)); p.push(barrel(1.7, 0.2), crate(-1.7, 0.1, 0.5)); g.add(M(p)); return g; }


// ---- 互動設施：任務布告欄、鐵匠鋪（鐵砧＋爐火）、地圖桌 ----
export function buildBoard() {
  const g = new THREE.Group(), P = [];
  P.push(B(0.2, 2.4, 0.2, 0x6a4a30, -0.9, 1.2, 0), B(0.2, 2.4, 0.2, 0x6a4a30, 0.9, 1.2, 0));
  P.push(B(2.2, 1.3, 0.14, 0xa8794a, 0, 1.55, 0), B(2.4, 0.14, 0.3, 0x7a5436, 0, 2.5, 0));
  [[-0.55, 1.8, 0xfff1d0], [0.1, 1.6, 0xffe0a0], [0.6, 1.9, 0xf6d6d6], [-0.2, 1.3, 0xd8ecc8], [0.62, 1.35, 0xfff1d0]].forEach(([x, y, c], i) => P.push(B(0.42, 0.52, 0.03, c, x, y, 0.09, 0, 0, (i - 2) * 0.07), B(0.06, 0.06, 0.04, 0xd8402a, x, y + 0.2, 0.12)));
  g.add(M(P)); g.userData.top = 3.0; return g;
}
export function buildForge() {
  const g = new THREE.Group(), P = [], A = [];
  P.push(B(2.4, 0.9, 1.4, 0x9a9488, 0, 0.45, 0), B(2.0, 0.12, 1.1, 0x6a645a, 0, 0.96, 0));
  P.push(B(0.9, 0.7, 0.9, 0x6a4a30, -0.6, 1.3, 0, 0, 0.3, 0), B(0.8, 0.12, 0.5, 0x45403a, 0.55, 1.08, 0), B(0.5, 0.18, 0.34, 0x45403a, 0.55, 0.92 + 0.3, 0), B(0.25, 0.22, 0.25, 0x45403a, 0.55, 1.28, 0));
  P.push(B(0.3, 2.6, 0.3, 0x8a847a, 1.1, 1.3, -0.5), B(0.34, 0.2, 0.34, 0x5a544a, 1.1, 2.6, -0.5));
  g.add(M(P));
  const coal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.6), new THREE.MeshBasicMaterial({ color: 0xff7a30 })); coal.position.set(-0.6, 1.66, 0); coal.userData.noNormal = true; g.add(coal); g.userData.coal = coal;
  g.userData.top = 3.0; return g;
}
export function buildMapTable() {
  const g = new THREE.Group(), P = [];
  P.push(B(2.2, 0.14, 1.5, 0x9a6a42, 0, 1.0, 0));
  for (const x of [-0.95, 0.95]) for (const z of [-0.6, 0.6]) P.push(B(0.14, 1.0, 0.14, 0x6a4a30, x, 0.5, z));
  P.push(B(1.7, 0.03, 1.1, 0xf3e2c0, 0, 1.09, 0), B(0.9, 0.03, 0.05, 0xc0402a, 0.1, 1.11, 0.1, 0, 0.5, 0), B(0.05, 0.03, 0.7, 0x3a7aa8, -0.4, 1.11, -0.05, 0, 0.2, 0), B(0.18, 0.18, 0.18, 0xd8402a, 0.5, 1.2, -0.3));
  g.add(M(P)); g.userData.top = 2.0; return g;
}
export function buildGuildKiosk() {
  const g = new THREE.Group(), P = [];
  P.push(B(2.8, 0.26, 2.2, 0x9b9388, 0, 0.13, 0));
  for (const sx of [-1.2, 1.2]) for (const sz of [-0.9, 0.9]) P.push(B(0.16, 2.2, 0.16, 0x6a452e, sx, 1.2, sz));
  P.push(B(3.2, 0.22, 2.6, 0x3c6ca8, 0, 2.4, 0), B(2.6, 0.3, 2.0, 0x2c5284, 0, 2.65, 0));
  P.push(B(2.0, 0.88, 0.65, 0x8f5b38, 0, 0.66, 0.25), B(0.75, 1.15, 0.06, 0xd9483b, -1.5, 1.6, 0.8), B(0.45, 0.45, 0.08, 0xffd24a, -1.5, 1.75, 0.83));
  g.add(M(P));
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xffd85a }));
  emblem.position.set(0, 3.2, 0); g.add(emblem);
  return g;
}
export function buildAwakenAltar() {
  const g = new THREE.Group(), P = [];
  P.push(part(new THREE.CylinderGeometry(1.4, 1.65, 0.35, 8), 0x8a8298, 0, 0.17, 0));
  P.push(part(new THREE.CylinderGeometry(0.9, 1.1, 0.55, 8), 0x6e6680, 0, 0.58, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    P.push(B(0.24, 1.35, 0.24, 0x9f97b0, Math.cos(a) * 1.15, 0.85, Math.sin(a) * 1.15));
  }
  g.add(M(P));
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0x9ee8ff }));
  crystal.position.set(0, 1.75, 0); g.add(crystal);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 20), new THREE.MeshBasicMaterial({ color: 0xffd85a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.userData.noNormal = true; g.add(ring);
  return g;
}
export function buildWardrobe() {
  const g = new THREE.Group(), P = [];
  // 精緻裁縫試衣亭：弧頂暖木衣櫃＋湛藍穿衣鏡＋吊掛披風＋金邊飾條
  P.push(B(1.45, 0.16, 0.88, 0x6e452a, 0, 0.08, 0));
  P.push(B(1.32, 1.95, 0.72, 0x9a6440, 0, 1.1, 0), B(1.52, 0.18, 0.9, 0x6e452a, 0, 2.12, 0));
  P.push(B(1.12, 0.16, 0.78, 0xd85842, 0, 2.28, 0));
  P.push(B(0.62, 1.32, 0.08, 0x8fdcf8, -0.14, 1.16, 0.36), B(0.7, 1.4, 0.05, 0xf2c95e, -0.14, 1.16, 0.35));
  P.push(B(0.08, 0.24, 0.08, 0xffd24a, 0.38, 1.08, 0.38));
  P.push(B(0.45, 0.82, 0.08, 0xd9483b, 0.84, 1.25, 0, 0, 0, -0.08), B(0.32, 0.06, 0.06, 0x6e452a, 0.76, 1.66, 0));
  g.add(M(P));
  return g;
}
// 蓬鬆像素小綿羊（致敬螢幕擷圖 5 風格，可於城鎮與草原互動摸毛）
export function buildSheep() {
  const g = new THREE.Group(), P = [];
  P.push(B(0.66, 0.52, 0.88, 0xfbf8f0, 0, 0.56, 0));
  P.push(part(new THREE.IcosahedronGeometry(0.34, 0), 0xfffcf5, 0, 0.62, 0.2));
  P.push(part(new THREE.IcosahedronGeometry(0.32, 0), 0xf3eee2, 0, 0.58, -0.22));
  P.push(B(0.32, 0.3, 0.36, 0x3b3634, 0, 0.66, 0.52)); // 頭
  P.push(B(0.12, 0.14, 0.08, 0x3b3634, -0.22, 0.72, 0.48, 0, 0, 0.4), B(0.12, 0.14, 0.08, 0x3b3634, 0.22, 0.72, 0.48, 0, 0, -0.4));
  P.push(B(0.06, 0.06, 0.04, 0xffffff, -0.09, 0.7, 0.7), B(0.06, 0.06, 0.04, 0xffffff, 0.09, 0.7, 0.7));
  for (const [lx, lz] of [[-0.2, -0.26], [0.2, -0.26], [-0.2, 0.24], [0.2, 0.24]]) {
    P.push(B(0.12, 0.36, 0.12, 0x3b3634, lx, 0.18, lz));
  }
  g.add(M(P));
  return g;
}
function birchMapleTown(cols = [0xe95c3f, 0xf39237, 0xf6c445]) {
  const g = new THREE.Group();
  g.add(M([
    part(new THREE.CylinderGeometry(0.11, 0.18, 1.75, 5), 0xf3eee3, 0, 0.87, 0),
    part(new THREE.CylinderGeometry(0.15, 0.155, 0.09, 5), 0x3b3836, 0, 0.52, 0),
    part(new THREE.CylinderGeometry(0.135, 0.14, 0.08, 5), 0x3b3836, 0, 1.05, 0),
    part(new THREE.IcosahedronGeometry(1.12, 0), cols[0], 0, 2.35, 0),
    part(new THREE.IcosahedronGeometry(0.78, 0), cols[1], 0.72, 2.65, 0.28),
    part(new THREE.IcosahedronGeometry(0.72, 0), cols[2], -0.68, 2.1, -0.32),
  ], { wind: [0.26, 1.1, 2.1] }));
  return g;
}
function picketFence(len = 3.2) {
  const g = new THREE.Group(), P = [];
  const n = Math.max(3, Math.round(len / 0.55));
  for (let i = 0; i < n; i++) P.push(B(0.12, 0.78, 0.08, 0xf2e4cc, -len / 2 + (i + 0.5) * (len / n), 0.39, 0));
  P.push(B(len, 0.1, 0.06, 0xdec8a4, 0, 0.56, 0.03), B(len, 0.1, 0.06, 0xdec8a4, 0, 0.24, 0.03));
  g.add(M(P));
  return g;
}
export function buildTownScenery({ gh, rng }) {
  const g = new THREE.Group(), obstacles = [], chimneys = [], r = rng || Math.random;
  const place = (o, x, z, ry = 0, obs = 0, yoff = 0) => { o.position.set(x, gh(x, z) + yoff, z); o.rotation.y = ry; g.add(o); if (obs) obstacles.push({ x, z, r: obs, h: 0 }); if (o.userData.chimney) { const c = o.userData.chimney, cs = Math.cos(ry), sn = Math.sin(ry); chimneys.push({ x: x + c[0] * cs + c[2] * sn, y: o.position.y + c[1], z: z - c[0] * sn + c[2] * cs }); } return o; };
  // ---- 石板廣場與放射小徑 ----
  const stones = [], tone = [0xe6dcc4, 0xd8cdb2, 0xcfc4aa, 0xeee4cd, 0xc9bfa6];
  const stone = (x, z, s = 0.62) => { const y = gh(x, z) + 0.05; stones.push(part(new THREE.BoxGeometry(s * (0.8 + r() * 0.35), 0.08, s * (0.8 + r() * 0.35)), tone[(r() * tone.length) | 0], x, y, z, 0, r() * 3.14, 0)); };
  for (let a = 0; a < 6.283; a += 0.07) for (let rad = 2.6; rad < 7.4; rad += 0.62) { const aa = a + (rad * 7 % 1) * 0.07; stone(Math.cos(aa) * rad, Math.sin(aa) * rad); }
  const path = (x0, z0, x1, z1, wd = 1.5) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 0.75); for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, nx = -(z1 - z0) / L, nz = (x1 - x0) / L; for (let k = -1; k <= 1; k++) { if (Math.abs(k) * 0.62 > wd / 2 + 0.1) continue; stone(x + nx * k * 0.62 + (r() - .5) * .12, z + nz * k * 0.62 + (r() - .5) * .12, 0.58); } } };
  path(0, -7, 0, -17, 2.0); path(7, 0, 17, 1, 1.6); path(-7, 0, -14, 0, 1.6); path(0, 7, 0, 18, 1.6); path(6, -5, 12, -9, 1.2); path(-6, -5, -10, -8, 1.2);
  g.add(M(stones));
  // ---- 噴泉＋中央（沿用原噴泉在 game.js） ----
  // ---- 建築 ----
  place(buildTavern(), -13.5, -8, faceCenter(-13.5, -8) + 0.15, 3.4);
  obstacles.push({ x: -15.5, z: -9, r: 2.2, h: 0 }, { x: -11.5, z: -7, r: 2.2, h: 0 });
  const homes = [[12, -9, 0xd9543a, 0xf6e7c8, 3.8, 3.2, 2], [14.5, 1, 0x3f8ab0, 0xf0dfc0, 3.4, 3.0, 1], [-15.5, 3, 0xe0a030, 0xf6e7c8, 3.4, 3.0, 1], [-11, 11, 0x8a5ab8, 0xf2e2c4, 3.6, 3.0, 2], [11, 12, 0x58a858, 0xf6e7c8, 3.2, 2.8, 1], [17, -6, 0xc9503a, 0xefdcc0, 3.2, 2.8, 1]];
  homes.forEach(([x, z, roof, wall, w, d, fl]) => place(buildCottage(roof, wall, w, d, fl), x, z, faceCenter(x, z) + (r() - 0.5) * 0.25, Math.max(w, d) * 0.62));
  // ---- 酒館露天座 ----
  [[-8.6, -2.6, 0x58a8c0], [-7.6, -6.2, 0xe0a030], [-12.4, -2.4, 0xd9543a]].forEach(([x, z, u]) => place(buildTable(u), x, z, 0, 1.0));
  // ---- 市集 ----
  [[6.2, 5.5, 0x58a858, -0.5], [9.5, 3.8, 0xd9543a, -0.8], [11.6, -0.2, 0x58a858, -1.2]].forEach(([x, z, c, ry]) => place(stall(c), x, z, ry, 1.5));
  place(M([barrel(0, 0), barrel(0.6, 0.1), crate(0.3, 0.7, 0.55), crate(0.3, 0.7, 0.45, 0.55)]), 8, 6.8, 0.4, 0.9);
  // ---- 花園 ----
  const bed = (x, z, w, d) => { const p = [B(w, 0.22, d, 0xb0a89a, x, 0.11, z), B(w - 0.3, 0.26, d - 0.3, 0x6a8f3a, x, 0.13, z)]; for (let k = 0; k < 40; k++) p.push(part(new THREE.IcosahedronGeometry(0.08 + r() * 0.05, 0), [0xfff1f4, 0xffffff, 0xffe27a, 0xffb3c9][(r() * 4) | 0], x + (r() - .5) * (w - 0.6), 0.34, z + (r() - .5) * (d - 0.6))); const m = M(p); m.position.y = gh(x, z); g.add(m); obstacles.push({ x, z, r: Math.max(w, d) * 0.45, h: 0 }); };
  bed(-6.5, 9, 3.4, 1.6); bed(-2.5, 11.5, 2.8, 1.5); bed(4, 10.5, 3.0, 1.6);
  place(well(), -9.5, 7.5, 0, 1.1);
  // ---- 水池與小橋 ----
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.1, 18), new THREE.MeshBasicMaterial({ color: 0x59b8e6 })); pond.scale.set(1.3, 1, 0.8); pond.position.set(1, gh(1, 15) + 0.08, 15); g.add(pond);
  const rim = []; for (let a = 0; a < 6.283; a += 0.3) rim.push(part(new THREE.DodecahedronGeometry(0.35, 0), [0x9a948a, 0xb0a89a][(a * 3 | 0) % 2], 1 + Math.cos(a) * 3.9, 0.15, 15 + Math.sin(a) * 2.5)); const rm = M(rim); rm.position.y = gh(1, 15); g.add(rm);
  place(bridge(5.0), 1, 15, 1.5708, 0, 0.0); obstacles.push({ x: -2.4, z: 15, r: 0.5, h: 0 });
  // ---- 大門：旗幟與雕像 ----
  place(banner(0xd9543a), -3.2, -15.5, 0, 0.3); place(banner(0xd9543a), 3.2 + 1.0, -15.5, Math.PI, 0.3);
  place(statue(), -5, -13, 0.3, 0.9); place(statue(), 5, -13, -0.3, 0.9);
  // ---- 街燈、長椅、花盆、樹 ----
  [[-6.5, 0], [6.5, 0], [-3.2, -6], [3.2, -6], [0, 8], [-8, 6], [9, 8], [-10, -10], [10, -5]].forEach(([x, z]) => place(lampPost(), x, z, 0, 0.25));
  const spots = [];
  [[-5.5, 3.5, 0.6], [5.5, 3.5, -0.6], [0, -5.2, 0], [-4.2, -3.8, 0.4]].forEach(([x, z]) => {
    const ry = faceCenter(x, z);
    place(bench(), x, z, ry, 0.65);
    spots.push({ x, z, kind: 'sit', label: '坐下休憩（回復生命與法力）', top: 1.5, facing: ry });
  });
  spots.push({ x: -9.5, z: 7.5, kind: 'well_drink', label: '汲取甘泉（補滿蜜藥瓶）', top: 2.3 });
  spots.push({ x: 0, z: -1, kind: 'fountain_wish', label: '許願噴泉（投 1 金幣獲得祝福）', top: 2.3 });
  [[-1.8, -16.5, [0xff8fb0, 0xffffff]], [1.8, -16.5, [0xffd45a, 0xff8fb0]], [-10.5, -4.5, [0xc59aff, 0xffffff]], [8.5, -4, [0xff8fb0, 0xffd45a]], [3, 7.5, [0xffffff, 0xffb3c9]]].forEach(([x, z, c]) => place(planter(0, 0, c), x, z, 0, 0.5));
  [[-19, -12], [18, 8], [-18, 12], [20, -2], [-3, -22], [-19, 5]].forEach(([x, z], i) => place(i % 2 ? blossom(0xf59ac0) : birchMapleTown(), x, z, 0, 0.5));
  [[-4, -20], [4, -20], [-7.5, -17], [7.5, -17], [-20, -5], [-21, 8], [19, 14], [-12, 17]].forEach(([x, z], i) => place(i % 3 === 0 ? birchMapleTown([0xf39237, 0xf6c445, 0xe95c3f]) : cypress(1 + r() * 0.3), x, z, 0, 0.45));
  place(blossom(), -17, -15, 0, 0.6); place(blossom(0xf7b0cf), 14, 15, 0, 0.6);
  // 溫暖白木小柵欄點綴花園與牧草地邊緣
  place(picketFence(3.8), -8.6, 10.6, 0.25, 0.4); place(picketFence(3.2), 6.4, 11.4, -0.35, 0.4); place(picketFence(3.4), -13.2, 6.4, 1.35, 0.4);
  const spot = (o, x, z, ry, kind, label, rr = 1.1) => { place(o, x, z, ry, rr); spots.push({ x, z, kind, label, top: o.userData.top, o }); };
  spot(buildBoard(), -4.5, 6.8, faceCenter(-4.5, 6.8), 'quest', '任務布告欄', 1.2);
  spot(buildForge(), 12.5, -3.5, faceCenter(12.5, -3.5), 'forge', '鐵匠鋪', 1.5);
  spot(buildMapTable(), 2.8, -10.5, 0, 'map', '出發地圖桌', 1.2);
  return { group: g, obstacles, chimneys, spots };
}
