// 燈谷鎮場景：石板廣場、酒館、山牆小屋、市集、花園、水池與小橋、雕像與旗幟
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat, windMat, pondMat } from './world.js';
import { attachLandmarkGlb } from './assets.js';

const M = (parts, opts = {}) => { const m = new THREE.Mesh(mergeGeometries(parts), opts.wind ? windMat({ vertexColors: true }, opts.wind) : toonMat({ vertexColors: true, ...opts })); m.castShadow = true; m.receiveShadow = true; return m; };
const B = (w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0) => part(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
const faceCenter = (x, z) => Math.atan2(-x, -z);

// 山牆屋頂：兩片斜板＋交錯瓦片列＋屋脊帽＋三角山牆
function gable(w, d, h, roof, roofDark, wall, y0) {
  const slope = Math.hypot(w / 2, h), ang = Math.atan2(h, w / 2), L = slope + 0.55, parts = [], N = 6;
  const light = new THREE.Color(roof).offsetHSL(0, 0, 0.07).getHex();
  for (const s of [-1, 1]) {
    const cx = s * w / 4, cy = y0 + h / 2 + 0.07;
    parts.push(B(L, 0.14, d + 0.7, roof, cx, cy, 0, 0, 0, -s * ang));
    const ux = s * Math.cos(ang), uy = -Math.sin(ang), nx = s * Math.sin(ang), ny = Math.cos(ang);
    for (let k = 0; k < N; k++) { const t = ((k + 0.5) / N - 0.5) * L * 0.94; // 瓦片列
      parts.push(B(L / N * 0.86, 0.05, d + 0.72, k % 2 ? roofDark : light, cx + ux * t + nx * 0.08, cy + uy * t + ny * 0.08, 0, 0, 0, -s * ang)); }
    parts.push(B(0.12, 0.12, d + 0.72, 0x5a3a28, s * (w / 2 + 0.2), y0 - 0.02, 0)); // 屋簷木梁
  }
  parts.push(B(0.26, 0.16, d + 0.78, 0x5a3a28, 0, y0 + h + 0.1, 0)); // 屋脊木帽
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, h); tri.closePath();
  for (const z of [-d / 2 + 0.01, d / 2 - 0.01]) { const g = new THREE.ShapeGeometry(tri); if (z < 0) g.rotateY(Math.PI); parts.push(part(g, wall, 0, y0, z)); }
  // 山牆木樑（人字紋）
  for (const z of [-d / 2 - 0.02, d / 2 + 0.02]) for (const sg of [-1, 1]) parts.push(B(slope * 0.98, 0.1, 0.07, 0x5a3a28, sg * w / 4, y0 + h / 2 - 0.02, z, 0, 0, -sg * ang));
  return parts;
}
function timber(parts, w, y0, h, z, col) {
  const n = Math.max(2, Math.round(w / 1.05)), pw = w / n;
  parts.push(B(w + 0.16, 0.14, 0.1, col, 0, y0 + 0.07, z), B(w + 0.16, 0.14, 0.1, col, 0, y0 + h - 0.07, z));
  for (let i = 0; i <= n; i++) parts.push(B(0.13, h, 0.1, col, -w / 2 + i * pw, y0 + h / 2, z));
  const bl = Math.hypot(pw, h * 0.5), ba = Math.atan2(pw, h * 0.5);
  for (const [i, sg] of [[0, 1], [n - 1, -1]]) parts.push(B(0.09, bl, 0.08, col, -w / 2 + (i + 0.5) * pw, y0 + h * 0.5, z + 0.01, 0, 0, sg * ba));
}
function shutters(x, y, z, col) { return [B(0.2, 0.62, 0.07, col, x - 0.4, y, z), B(0.2, 0.62, 0.07, col, x + 0.4, y, z)]; }
function window3(x, y, z, lit) { return [B(0.56, 0.56, 0.08, 0x6a4a32, x, y, z), B(0.42, 0.42, 0.1, lit ? 0xffd88a : 0x4a5a7a, x, y, z + 0.01), B(0.05, 0.42, 0.11, 0x6a4a32, x, y, z + 0.015), B(0.42, 0.05, 0.11, 0x6a4a32, x, y, z + 0.015)]; }
function flowerBox(x, y, z, cols) { const p = [B(0.7, 0.18, 0.22, 0x7a4a33, x, y, z)]; cols.forEach((c, i) => p.push(part(new THREE.IcosahedronGeometry(0.1, 0), c, x - 0.25 + i * 0.25, y + 0.16, z))); return p; }

export function buildCottage(roof, wall = 0xf3e2c0, w = 3.6, d = 3.0, floors = 1) {
  const g = new THREE.Group(), parts = [], T = 0x5a3a28, shut = new THREE.Color(roof).multiplyScalar(0.85).getHex(), plaster = 0xf6ebd0;
  const upper = floors > 1, jet = upper ? 0.22 : 0, H = 1.7 * floors, W2 = w + jet * 2;
  parts.push(B(w + 0.22, 0.34, d + 0.22, 0x9a948a, 0, 0.17, 0)); // 石基
  parts.push(B(w, 1.7, d, plaster, 0, 0.85 + 0.0, 0)); // 一樓
  timber(parts, w, 0.34, 1.36, d / 2 + 0.03, T);
  for (const sx of [-1, 1]) { parts.push(B(0.1, 1.36, d, T, sx * (w / 2 + 0.03), 1.02, 0)); for (let k = 0; k < 3; k++) parts.push(B(0.1, 1.36, 0.12, T, sx * (w / 2 + 0.03), 1.02, -d / 2 + k * d / 2)); }
  parts.push(B(0.86, 1.2, 0.1, 0x7a4a33, 0, 0.94, d / 2 + 0.06), B(1.0, 0.14, 0.16, T, 0, 1.58, d / 2 + 0.06), B(0.07, 1.2, 0.12, T, -0.46, 0.94, d / 2 + 0.07), B(0.07, 1.2, 0.12, T, 0.46, 0.94, d / 2 + 0.07)); // 門
  parts.push(...window3(-w / 2 + 0.8, 1.2, d / 2 + 0.06, true), ...window3(w / 2 - 0.8, 1.2, d / 2 + 0.06, false));
  parts.push(...shutters(-w / 2 + 0.8, 1.2, d / 2 + 0.07, shut), ...shutters(w / 2 - 0.8, 1.2, d / 2 + 0.07, shut));
  parts.push(...flowerBox(w / 2 - 0.8, 0.84, d / 2 + 0.18, [0xff8fb0, 0xffd45a, 0xffffff]));
  if (upper) {
    parts.push(B(W2 + 0.1, 0.16, d + jet * 2 + 0.1, T, 0, 1.78, 0)); // 懸挑樓板
    parts.push(B(W2, 1.6, d + jet * 2, plaster, 0, 2.62, 0));
    timber(parts, W2, 1.86, 1.52, d / 2 + jet + 0.03, T);
    parts.push(...window3(-W2 / 4, 2.7, d / 2 + jet + 0.06, true), ...window3(W2 / 4, 2.7, d / 2 + jet + 0.06, true));
    parts.push(...shutters(-W2 / 4, 2.7, d / 2 + jet + 0.07, shut), ...shutters(W2 / 4, 2.7, d / 2 + jet + 0.07, shut));
    for (const sx of [-1, 1]) parts.push(B(0.1, 1.52, d + jet * 2, T, sx * (W2 / 2 + 0.03), 2.62, 0));
  }
  const top = upper ? 3.42 : 1.7;
  parts.push(B(0.5, 1.2, 0.5, 0xa89c92, w / 4, top + 1.2, -d / 4), B(0.62, 0.14, 0.62, 0x7a7068, w / 4, top + 1.84, -d / 4)); // 煙囪
  parts.push(...gable(upper ? W2 : w, upper ? d + jet * 2 : d, 1.6, roof, new THREE.Color(roof).multiplyScalar(0.9).getHex(), plaster, top));
  g.add(M(parts)); g.userData.chimney = [w / 4, top + 2.0, -d / 4];
  return g;
}
export function buildTavern() {
  const g = new THREE.Group(), parts = [], w = 6.0, d = 4.4, H = 2.4;
  parts.push(B(w, H, d, 0xf6ebd0, 0, H / 2, 0), B(w + 0.3, 0.4, d + 0.3, 0x9a948a, 0, 0.2, 0));
  timber(parts, w, 0.4, H - 0.4, d / 2 + 0.03, 0x5a3a28);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) parts.push(B(0.12, H - 0.4, 0.12, 0x5a3a28, sx * (w / 2 + 0.03), H / 2 + 0.2, -d / 2 + k * d / 3));
  parts.push(...window3(-2.1, 1.4, d / 2 + 0.04, true), ...window3(2.1, 1.4, d / 2 + 0.04, true), ...window3(-0.9, 1.4, d / 2 + 0.04, true));
  parts.push(B(0.9, 1.5, 0.12, 0x6a3f2a, 1.0, 0.85, d / 2 + 0.05));
  parts.push(...flowerBox(-2.1, 0.85, d / 2 + 0.16, [0xff8fb0, 0xffffff, 0xc59aff]), ...flowerBox(2.1, 0.85, d / 2 + 0.16, [0xffd45a, 0xff8fb0, 0xffffff]));
  parts.push(...gable(w, d, 2.0, 0xc2452f, 0x8e3524, 0xf6ebd0, H));
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
function roundTree(k = 1) {
  const g = new THREE.Group(), gs = [0x9ccf5a, 0xb2dc6c, 0x86c24e];
  g.add(M([part(new THREE.CylinderGeometry(0.16, 0.24, 1.9, 6), 0x7a5238, 0, 0.95, 0), part(new THREE.IcosahedronGeometry(1.35, 1), gs[0], 0, 2.7, 0), part(new THREE.IcosahedronGeometry(0.95, 1), gs[1], 0.85, 3.1, 0.3), part(new THREE.IcosahedronGeometry(0.9, 1), gs[2], -0.85, 2.5, -0.4)], { wind: [0.24, 1.2, 2.0] }));
  g.scale.setScalar(k); return g;
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
// ---- 新建築：公會大廳、燈塔、魚攤、祭壇石台、牧場圍欄 ----
function buildGuildHall() {
  const g = buildCottage(0x58a0e0, 0xf6ebd0, 5.2, 4.2, 2);
  const p = [];
  for (const sx of [-1.6, 1.6]) p.push(part(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 5), 0x5a3a28, sx, 4.6, 2.5), B(0.7, 1.2, 0.05, 0x3f78b8, sx + 0.38, 5.0, 2.5), B(0.3, 0.3, 0.06, 0xffd24a, sx + 0.38, 5.15, 2.53));
  p.push(B(1.6, 0.5, 0.1, 0x7a4a33, 0, 1.95, 2.25), B(1.3, 0.3, 0.06, 0xffe7a0, 0, 1.95, 2.31));
  g.add(M(p)); return g;
}
function lighthouse() {
  const g = new THREE.Group(), p = [];
  p.push(part(new THREE.CylinderGeometry(1.9, 2.1, 0.6, 10), 0x9a948a, 0, 0.3, 0));
  for (let k = 0; k < 5; k++) p.push(part(new THREE.CylinderGeometry(1.25 - k * 0.12, 1.37 - k * 0.12, 1.4, 10), k % 2 ? 0xe0553c : 0xf8f2e6, 0, 1.3 + k * 1.4, 0));
  p.push(part(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 10), 0x5a3a28, 0, 8.0, 0), part(new THREE.CylinderGeometry(0.62, 0.62, 1.0, 8), 0xfff0b0, 0, 8.6, 0), part(new THREE.ConeGeometry(0.85, 0.9, 8), 0xe0553c, 0, 9.55, 0));
  p.push(B(0.7, 1.1, 0.1, 0x7a4a33, 0, 1.15, 1.32));
  g.add(M(p)); g.userData.top = 10.5; return g;
}
function fishStall() {
  const g = new THREE.Group(), p = [B(2.2, 0.8, 1.0, 0x8a5a3b, 0, 0.4, 0), B(2.0, 0.08, 0.8, 0xbfe4f0, 0, 0.84, 0)];
  for (let i = 0; i < 4; i++) p.push(B(0.42, 0.1, 0.16, [0x7ab0c8, 0xe89a6a, 0x9ab8c8, 0xf0b070][i], -0.7 + i * 0.46, 0.92, 0.05, 0, 0.3, 0));
  for (const sx of [-1, 1]) p.push(B(0.1, 2.0, 0.1, 0x6a4a32, sx, 1.0, -0.45));
  p.push(B(2.4, 0.1, 1.3, 0x3f78b8, 0, 2.0, -0.05, 0.25, 0, 0), B(2.4, 0.1, 0.4, 0xf8f2e6, 0, 1.86, 0.55, 0.25, 0, 0));
  g.add(M(p)); return g;
}
function altarStage() {
  const g = new THREE.Group(), p = [];
  p.push(B(5.0, 0.5, 5.0, 0xb8b0a2, 0, 0.25, 0), B(4.2, 0.5, 4.2, 0xcac2b4, 0, 0.75, 0));
  for (let k = 0; k < 2; k++) p.push(B(1.8, 0.25, 0.5, 0xd8d0c2, 0, 0.12 + k * 0.5, 2.75 - k * 0.42));
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) p.push(B(0.42, 1.8, 0.42, 0xe8e0d0, x, 1.9, z), B(0.6, 0.18, 0.6, 0xd8d0c2, x, 2.85, z));
  g.add(M(p)); return g;
}
function fenceRing(rad = 3.2) {
  const g = new THREE.Group(), p = [], n = 22;
  for (let i = 0; i < n; i++) { if (i === 5 || i === 6) continue; const a = i / n * 6.283, x = Math.cos(a) * rad, z = Math.sin(a) * rad; p.push(B(0.12, 0.8, 0.12, 0xf2e4cc, x, 0.4, z)); const a2 = (i + 0.5) / n * 6.283, L = 2 * rad * Math.sin(Math.PI / n); p.push(B(L, 0.09, 0.06, 0xdec8a4, Math.cos(a2) * rad, 0.6, Math.sin(a2) * rad, 0, -a2 + Math.PI / 2, 0), B(L, 0.09, 0.06, 0xdec8a4, Math.cos(a2) * rad, 0.3, Math.sin(a2) * rad, 0, -a2 + Math.PI / 2, 0)); }
  g.add(M(p)); return g;
}
function crates() { return M([barrel(0, 0), barrel(0.65, 0.15), crate(0.3, 0.75, 0.55), crate(0.3, 0.75, 0.45, 0.55), crate(-0.6, 0.6, 0.5)]); }
function fishingNet() { const g = new THREE.Group(); g.add(M([B(0.1, 1.6, 0.1, 0x6a4a32, -1, 0.8, 0), B(0.1, 1.6, 0.1, 0x6a4a32, 1, 0.8, 0), B(2.1, 0.08, 0.08, 0x6a4a32, 0, 1.55, 0), B(1.9, 1.0, 0.03, 0xcfc0a0, 0, 1.0, 0)])); return g; }

// 燈谷鎮（依規劃重做）：中央廣場＋南北主街＋東西橫街；北冒險者台地、東北祭壇、西生活區、東工匠街、南碼頭、西南牧場
export const TOWN_LAYOUT = {
  board: [-5.2, -5.2], stash: [5.2, -5.2], mapTable: [-3.4, -11], guild: [-9, -12.5], altar: [9, -12.5],
  tavern: [-14, -5.5], home: [-14, 6.5], wardrobe: [-11.3, 9.2], well: [-9.2, 5.2],
  forge: [14, -5.5], market: [13.2, 3.4], pasture: [-12, 14.5], lighthouse: [15, 18],
};
export function buildTownScenery({ gh, rng }) {
  const g = new THREE.Group(), obstacles = [], chimneys = [], r = rng || Math.random, L = TOWN_LAYOUT;
  const PX = Math.PI / 2;
  const place = (o, x, z, ry = 0, obs = 0, yoff = 0) => { o.position.set(x, gh(x, z) + yoff, z); o.rotation.y = ry; g.add(o); if (obs) obstacles.push({ x, z, r: obs, h: 0 }); if (o.userData.chimney) { const c = o.userData.chimney, cs = Math.cos(ry), sn = Math.sin(ry); chimneys.push({ x: x + c[0] * cs + c[2] * sn, y: o.position.y + c[1], z: z - c[0] * sn + c[2] * cs }); } return o; };
  const boxObs = (x, z, w, d) => { const n = Math.max(1, Math.round(Math.max(w, d) / Math.min(w, d))); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; obstacles.push(w > d ? { x: x + t * w, z, r: d * 0.55, h: 0 } : { x, z: z + t * d, r: w * 0.55, h: 0 }); } };
  // ---- 鋪面 ----
  const stones = [], tone = [0xd9cdb4, 0xcabda3, 0xe4d8c0, 0xbfb299, 0xd2c6ac];
  const g0 = gh(0, 0);
  const stone = (x, z, s = 0.62) => { const y = gh(x, z) + 0.05; stones.push(part(new THREE.BoxGeometry(s * (0.8 + r() * 0.3), 0.08, s * (0.8 + r() * 0.3)), tone[(r() * tone.length) | 0], x, y, z, 0, r() * 3.14, 0)); };
  stones.push(part(new THREE.CylinderGeometry(8.0, 8.0, 0.05, 40), 0x8c8170, 0, g0 + 0.02, 0));
  for (let rad = 3.5; rad < 7.6; rad += 0.56) { const n = Math.round(rad * 6.283 / 0.66); for (let i = 0; i < n; i++) { const aa = (i + (rad * 3 % 1)) / n * 6.283; stone(Math.cos(aa) * rad, Math.sin(aa) * rad, 0.6); } }
  stones.push(part(new THREE.CylinderGeometry(3.45, 3.45, 0.09, 8), 0xe8dec6, 0, g0 + 0.06, 0));
  for (let i = 0; i < 8; i++) { const aa = i / 8 * 6.283 + 0.3927, rr = 3.3; stones.push(B(2.5, 0.42, 0.55, 0xf0e6cf, Math.cos(aa) * rr, g0 + 0.2, Math.sin(aa) * rr, 0, -aa - 1.5708, 0)); }
  // 主街（整齊石板，4 公尺寬）＋橫街（3 公尺）
  const street = (x0, z0, x1, z1, wd) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.62), m = Math.round(wd / 0.62); const ux = (x1 - x0) / len, uz = (z1 - z0) / len; for (let i = 0; i <= n; i++) for (let k = 0; k < m; k++) { const off = (k - (m - 1) / 2) * 0.62 + (i % 2) * 0.12; const x = x0 + ux * i * 0.62 - uz * off, z = z0 + uz * i * 0.62 + ux * off; const y = gh(x, z) + 0.05; stones.push(B(0.56, 0.08, 0.56, tone[(r() * tone.length) | 0], x, y, z, 0, Math.atan2(ux, uz), 0)); } };
  street(0, -7.4, 0, -18.5, 4.0); street(0, 7.4, 0, 19.2, 4.0); street(-7.4, 0, -17, 0, 3.0); street(7.4, 0, 17, 0, 3.0);
  // 小巷（圓卵石）：酒館露天座、家門口、魚攤
  const lane = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.7); for (let i = 0; i <= n; i++) { const t = i / n; for (const o of [-0.45, 0.45]) stone(x0 + (x1 - x0) * t + (r() - 0.5) * 0.2 + o * (z1 !== z0 ? 1 : 0), z0 + (z1 - z0) * t + o * (z1 === z0 ? 1 : 0), 0.5); } };
  lane(-10.5, 0, -10.5, 6.5); lane(10.5, 0, 10.5, -5.5); lane(0, 14, 5, 14);
  g.add(M(stones));

  const placeGlb = (key, fb, x, z, ry = 0, obs = 0, opts = {}) => {
    const holder = new THREE.Group();
    if (fb?.userData?.chimney) holder.userData.chimney = fb.userData.chimney;
    place(holder, x, z, ry, obs);
    attachLandmarkGlb(holder, key, fb, { emissive: 0x3c342a, emissiveIntensity: 0.34, yOffset: -0.1, ...opts });
    return holder;
  };
  // ---- 北：冒險者台地（4137 公會鐘樓大廳） ----
  placeGlb('bell_tower', buildGuildHall(), L.guild[0], L.guild[1], PX, 0, { scale: 1.05 }); boxObs(L.guild[0], L.guild[1], 4.8, 6.0);
  place(banner(0xe0553c), -3.0, -17.2, 0, 0.3); place(banner(0xe0553c), 4.0, -17.2, Math.PI, 0.3);
  // ---- 東北：祭壇石台 ----
  place(altarStage(), L.altar[0], L.altar[1], 0, 0);
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) obstacles.push({ x: L.altar[0] + x, z: L.altar[1] + z, r: 0.35, h: 0 });
  // ---- 西：生活區（4137 奇幻酒館主屋＋古石水井） ----
  placeGlb('cottage_b', buildTavern(), L.tavern[0], L.tavern[1], PX, 0, { scale: 1.25 }); boxObs(L.tavern[0], L.tavern[1], 4.6, 6.4);
  place(buildTable(0xe0553c), -10.2, -8.6, 0, 1.0); place(buildTable(0x58a0e0), -10.2, -2.6, 0, 1.0);
  placeGlb('town_well', well(), L.well[0], L.well[1], 0, 1.1, { scale: 1.0 });
  const bed = (x, z, w, d) => { const p = [B(w, 0.22, d, 0xb0a89a, x, 0.11, z), B(w - 0.3, 0.26, d - 0.3, 0x6a8f3a, x, 0.13, z)]; for (let k = 0; k < 30; k++) p.push(part(new THREE.IcosahedronGeometry(0.08 + r() * 0.05, 0), [0xfff1f4, 0xffffff, 0xffe27a, 0xffb3c9][(r() * 4) | 0], x + (r() - .5) * (w - 0.6), 0.34, z + (r() - .5) * (d - 0.6))); const m = M(p); m.position.y = gh(x, z); g.add(m); boxObs(x, z, w, d); };
  bed(-14.6, 10.6, 3.2, 1.4); bed(-4.2, 10, 1.6, 3.2); bed(4.2, 10, 1.6, 3.2);
  place(picketFence(4.4), -14.2, 3.4, 0, 0); boxObs(-14.2, 3.4, 4.4, 0.3);
  // ---- 東：工匠街（4137 正牌鐵匠工坊主屋） ----
  placeGlb('town_blacksmith', buildCottage(0xe0553c, 0xf6ebd0, 4.2, 3.4, 1), 16.8, -5.5, -PX, 0, { scale: 1.05 }); boxObs(16.8, -5.5, 3.6, 4.4);
  [[11.6, 4.6, 0xe0553c], [14.8, 4.6, 0x58a0e0]].forEach(([x, z, c]) => place(stall(c), x, z, Math.PI, 1.4));
  place(crates(), 16.6, 3.2, 0.4, 0.9);
  // ---- 民宅：街道兩端與邊緣，多元 4137 低面木屋群 ----
  const homes = [
    [-19, 0, PX, 0xffb840, 3.6, 3.2, 2, 'cottage_c'],
    [19, 0, -PX, 0x58a0e0, 3.6, 3.2, 2, 'cottage_b'],
    [15.5, -12, -PX, 0xe0553c, 3.6, 3.0, 2, 'cottage'],
    [13, 10.5, -PX, 0x5aae60, 3.4, 3.0, 1, 'forest_cabin'],
    [-15.5, -12.5, PX, 0x5aae60, 3.2, 2.8, 1, 'cottage'],
  ];
  homes.forEach(([x, z, ry, roof, w, d, fl, glbKey]) => {
    placeGlb(glbKey, buildCottage(roof, 0xf6ebd0, w, d, fl), x, z, ry, 0, { scale: fl > 1 ? 1.05 : 0.95 });
    boxObs(x, z, d + 0.4, w + 0.4);
  });
  // ---- 南：碼頭區（4137 漁夫小屋＋4379 海岸燈塔與停泊帆船） ----
  place(fishStall(), 5.2, 15.4, Math.PI, 1.3);
  placeGlb('fishing_hut', null, 8.8, 16.5, -0.5, 2.4, { scale: 0.95 });
  placeGlb('pirate_boat', null, -8.5, 22.8, 0.4, 0, { scale: 0.9, yOffset: -0.25, emissive: 0x48382c, emissiveIntensity: 0.38 });
  place(crates(), -3.6, 17.2, 0.2, 0.9); place(fishingNet(), -5.6, 15.2, 0.3, 0.6);
  placeGlb('lighthouse', lighthouse(), L.lighthouse[0], L.lighthouse[1], -0.4, 2.2, { scale: 0.85, emissive: 0x5c5246, emissiveIntensity: 0.48 });
  // ---- 西南：牧場 ----
  place(fenceRing(3.4), L.pasture[0], L.pasture[1], 0, 0);
  for (let i = 0; i < 22; i++) { if (i === 5 || i === 6) continue; const a = i / 22 * 6.283; obstacles.push({ x: L.pasture[0] + Math.cos(a) * 3.4, z: L.pasture[1] + Math.sin(a) * 3.4, r: 0.3, h: 0 }); }
  // ---- 街燈：沿主街與橫街，兩側對稱 ----
  [[-2.7, -11], [2.7, -11], [-2.7, -16], [2.7, -16], [-2.7, 11], [2.7, 11], [-2.7, 16.5], [2.7, 16.5], [-11.5, -2.2], [-11.5, 2.2], [11.5, -2.2], [11.5, 2.2]].forEach(([x, z]) => place(lampPost(), x, z, 0, 0.25));
  // ---- 廣場：長椅、布告欄、倉庫、花盆 ----
  const spots = [];
  [[-5.6, 3.4], [5.6, 3.4], [-3.4, 5.6], [3.4, 5.6]].forEach(([x, z]) => { const ry = faceCenter(x, z); place(bench(), x, z, ry, 0.65); spots.push({ x, z, kind: 'sit', label: '坐下休憩（回復生命與法力）', top: 1.5, facing: ry }); });
  [[-6.6, -2.4], [6.6, -2.4]].forEach(([x, z], i) => place(planter(0, 0, i ? [0xffd45a, 0xff8fb0] : [0xff8fb0, 0xffffff]), x, z, 0, 0.5));
  spots.push({ x: L.well[0], z: L.well[1], kind: 'well_drink', label: '汲取甘泉（補滿蜜藥瓶）', top: 2.3 });
  spots.push({ x: 0, z: -1, kind: 'fountain_wish', label: '許願噴泉（投 1 金幣獲得祝福）', top: 2.3 });
  // ---- 植被：只在外圍與岩壁上（圓潤闊葉樹為主，柏樹當背景，2 棵櫻花點綴） ----
  [[-20.5, -6], [-21, 6], [20.5, -7], [21, 6.5], [-17.5, 10.5], [17.5, 12.5], [-8, -17.5], [8.5, -18], [-12.5, -16.5], [13, -16.5], [-19, 13]].forEach(([x, z], i) => place(roundTree(1.0 + (i % 3) * 0.15), x, z, i, 0.6));
  [[-5.5, -20.5], [5.5, -20.5], [-10, -20], [10.5, -20], [-15, -18.5], [16, -18.5], [-22, -1], [22.5, 0.5]].forEach(([x, z], i) => place(cypress(1.3 + (i % 3) * 0.25), x, z, 0, 0.45));
  place(blossom(), -17.5, -8.5, 0, 0.6); place(blossom(0xf7b0cf), 9.5, 13.5, 0, 0.6);
  const spot = (o, x, z, ry, kind, label, rr = 1.1) => { place(o, x, z, ry, rr); spots.push({ x, z, kind, label, top: o.userData.top, o }); };
  spot(buildBoard(), L.board[0], L.board[1], faceCenter(L.board[0], L.board[1]), 'quest', '任務布告欄', 1.2);
  spot(buildForge(), L.forge[0], L.forge[1], -PX, 'forge', '鐵匠鋪', 1.5);
  spot(buildMapTable(), L.mapTable[0], L.mapTable[1], 0, 'map', '出發地圖桌', 1.2);
  return { group: g, obstacles, chimneys, spots };
}
