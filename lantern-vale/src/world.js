import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, Noise, clamp, smooth, rand, pick, lerp } from './util.js';

export const HALF = 30;          // world spans -30..30
export const RES = 0.5;          // grid resolution (world units per cell)
export const GW = Math.round(HALF * 2 / RES) + 1; // 121

const WATER_Y = -0.32;

// ---------- shared toon gradient ----------
let _grad = null;
export function toonGradient() {
  if (_grad) return _grad;
  const data = new Uint8Array([90, 170, 235, 255]);
  _grad = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.needsUpdate = true;
  return _grad;
}
export function toonMat(opts = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...opts });
}

function colorGeo(geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  return geo;
}
function jitterGeo(geo, r, amt) {
  const p = geo.attributes.position;
  // jitter shared positions consistently (hash by rounded position)
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]);
    const j = map.get(k);
    p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]);
  }
  geo.computeVertexNormals();
  return geo;
}
export function part(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const g = colorGeo(geo, hex);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  g.applyMatrix4(m);
  return g;
}

// ---------- prop templates (low-poly, vertex coloured) ----------
function pineGeo(P, r, snow) {
  const parts = [part(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 5), P.trunk, 0, 0.4, 0)];
  const c = P.pine;
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const rad = 1.0 - i * 0.24, h = 1.1 - i * 0.12, y = 0.7 + i * 0.62;
    let g = new THREE.ConeGeometry(rad, h, 7, 1);
    g = jitterGeo(g.index ? g.toNonIndexed() : g, r, 0.12);
    parts.push(part(g, c[i % c.length], 0, y + h / 2, 0, 0, r() * 6, 0));
    if (snow) parts.push(part(new THREE.ConeGeometry(rad * 0.55, h * 0.4, 7), 0xf4f6ff, 0, y + h * 0.82, 0));
  }
  return mergeGeometries(parts);
}
function roundTreeGeo(P, r, leafHex) {
  const parts = [part(new THREE.CylinderGeometry(0.1, 0.17, 1.2, 5), P.trunk, 0, 0.6, 0, 0, 0, 0.08)];
  const blobs = 4 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = r() * Math.PI * 2, d = i === 0 ? 0 : 0.45 + r() * 0.25;
    const s = i === 0 ? 0.85 : 0.5 + r() * 0.25;
    let g = new THREE.IcosahedronGeometry(s, 0);
    g = jitterGeo(g, r, 0.15);
    parts.push(part(g, leafHex, Math.cos(a) * d, 1.55 + r() * 0.45 + (i === 0 ? 0.25 : 0), Math.sin(a) * d));
  }
  return mergeGeometries(parts);
}
function rockGeo(P, r) {
  let g = new THREE.DodecahedronGeometry(0.6, 0);
  g = jitterGeo(g, r, 0.3);
  g.scale(1, 0.7, 1);
  // two-tone: lower facets darker
  g = colorGeo(g, P.rock);
  const col = g.attributes.color, pos = g.attributes.position, dark = new THREE.Color(P.rockDark);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    if (y < -0.05) for (let k = 0; k < 3; k++) col.setXYZ(i + k, dark.r, dark.g, dark.b);
  }
  g.translate(0, 0.2, 0);
  return g;
}
function bushGeo(P, r) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    let g = new THREE.IcosahedronGeometry(0.35 + r() * 0.15, 0);
    g = jitterGeo(g, r, 0.1);
    parts.push(part(g, P.leaf[i % 2 === 0 ? 0 : 2], (r() - 0.5) * 0.6, 0.3, (r() - 0.5) * 0.6));
  }
  return mergeGeometries(parts);
}
function grassGeo(hex) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.ConeGeometry(0.06, 0.4, 3, 1);
    parts.push(part(g, hex, (i - 1) * 0.08, 0.2, (i % 2) * 0.06, (i - 1) * 0.35, 0, (i - 1) * 0.3));
  }
  return mergeGeometries(parts);
}
function flowerGeo() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 3), 0x5f9a3a, 0, 0.12, 0),
    part(new THREE.OctahedronGeometry(0.08, 0), 0xffffff, 0, 0.27, 0),
  ]);
}
function mushroomGeo() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 5), 0xf3e6cf, 0, 0.12, 0),
    part(new THREE.SphereGeometry(0.18, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8483a, 0, 0.22, 0),
    part(new THREE.SphereGeometry(0.03, 3, 2), 0xffffff, 0.07, 0.33, 0.04),
  ]);
}
function lanternPostGeo() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), 0x6b4530, 0, 0.7, 0),
    part(new THREE.BoxGeometry(0.4, 0.06, 0.06), 0x6b4530, 0.15, 1.35, 0),
  ]);
}
function pillarGeo(P, r) {
  const parts = [];
  let y = 0;
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.5 + r() * 0.2;
    parts.push(part(new THREE.BoxGeometry(0.7, h, 0.7), i % 2 ? P.rock : P.rockDark, (r() - 0.5) * 0.08, y + h / 2, 0, 0, r() * 0.3, 0));
    y += h;
  }
  return mergeGeometries(parts);
}
function logGeo(P) {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.22, 0.22, 1.8, 6), P.trunk, 0, 0.22, 0, 0, 0, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.17, 0.17, 1.82, 6), 0xe0b07a, 0, 0.22, 0, 0, 0, Math.PI / 2, 1),
  ]);
}

// ---------- World ----------
export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.walk = new Uint8Array(GW * GW);
    this.height = new Float32Array(GW * GW);
    this.flow = new Int32Array(GW * GW);
    this.obstacles = [];
    this.lanterns = [];
    this.waterMat = null;
  }

  idx(x, z) {
    const i = Math.round((x + HALF) / RES), j = Math.round((z + HALF) / RES);
    if (i < 0 || j < 0 || i >= GW || j >= GW) return -1;
    return j * GW + i;
  }
  isWalk(x, z) { const k = this.idx(x, z); return k >= 0 && this.walk[k] === 1; }
  groundY(x, z) { const k = this.idx(x, z); return k < 0 ? -2 : Math.max(this.height[k], -0.3); }
  // smooth bilinear height for the 3D-moving player
  gh(x, z) {
    const fx = (x + HALF) / RES, fz = (z + HALF) / RES;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= GW - 1 || j >= GW - 1) return -2;
    const tx = fx - i, tz = fz - j, H = this.height, k = j * GW + i;
    const h = (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + GW] * (1 - tx) + H[k + GW + 1] * tx) * tz;
    return Math.max(h, -0.3);
  }
  isLand(x, z) { const k = this.idx(x, z); return k >= 0 && this.height[k] > -0.2 && this.RR[k] < 1.0; }

  clear() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.obstacles = [];
    this.lanterns = [];
  }

  generate(seed, biome, opts = {}) {
    this.clear();
    const P = biome;
    this.P = P;
    const r = mulberry32(seed * 7919 + 13);
    const N = new Noise(seed);
    const R = opts.town ? 25 : opts.boss ? 17 : 18 + r() * 4;
    const ax = opts.town ? 1 : 0.8 + r() * 0.4, az = opts.town ? 1 : 0.8 + r() * 0.4;
    const nAmp = opts.town ? 0.16 : 0.55;
    const so = r() * 100;
    const T = new Uint8Array(GW * GW); // 0 water, 1 ground, 2 plateau, 3 high
    const RR = new Float32Array(GW * GW);
    const H = this.height;

    for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) {
      const x = -HALF + i * RES, z = -HALF + j * RES, k = j * GW + i;
      const rr = Math.hypot(x * ax, z * az) / R + (N.fbm(x * 0.07 + so, z * 0.07) - 0.5) * nAmp;
      RR[k] = rr;
      let t = rr < 1 ? 1 : 0;
      const dc = Math.hypot(x, z);
      if (t === 1 && dc > 6.5 && !opts.town) {
        const p = N.fbm(x * 0.1 + 50 + so, z * 0.1 + 50);
        const edge = smooth(0.72, 0.95, rr) * 0.22;
        const v = p + edge - (opts.boss ? 0.12 : 0);
        if (v > 0.6) t = 2;
        if (v > 0.72) t = 3;
      }
      T[k] = t;
    }
    const walk = this.walk;
    const floodWalk = () => {
    walk.fill(0);
    let start = -1, best = 1e9;
    for (let k = 0; k < GW * GW; k++) if (T[k] === 1 && RR[k] < 0.94) {
      const i = k % GW, j = (k / GW) | 0;
      const d = Math.hypot(i - GW / 2, j - GW / 2);
      if (d < best) { best = d; start = k; }
    }
    const q = [start]; walk[start] = 1;
    while (q.length) {
      const k = q.pop(); const i = k % GW, j = (k / GW) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj; if (ni < 1 || nj < 1 || ni >= GW - 1 || nj >= GW - 1) continue;
        const nk = nj * GW + ni;
        if (!walk[nk] && T[nk] === 1 && RR[nk] < 0.94) { walk[nk] = 1; q.push(nk); }
      }
    }
    // erode walk 1 cell next to cliffs so the player doesn't clip into walls
    const w2 = walk.slice();
    for (let j = 1; j < GW - 1; j++) for (let i = 1; i < GW - 1; i++) {
      const k = j * GW + i; if (!walk[k]) continue;
      if (T[k + 1] >= 2 || T[k - 1] >= 2 || T[k + GW] >= 2 || T[k - GW] >= 2) w2[k] = 0;
    }
    walk.set(w2);
    };
    floodWalk();

    // dirt paths: centre -> exits
    const exits = [];
    const exitCount = opts.exitCount ?? 2;
    {
      // candidate walkable cells far from centre, pick spread apart (north-ish half)
      const cands = [];
      for (let k = 0; k < GW * GW; k++) if (walk[k]) {
        const i = k % GW, j = (k / GW) | 0, x = -HALF + i * RES, z = -HALF + j * RES;
        const d = Math.hypot(x, z);
        // need open space around
        let ok = true;
        for (let dj = -3; dj <= 3 && ok; dj++) for (let di = -3; di <= 3; di++) {
          const nk = (j + dj) * GW + (i + di); if (!walk[nk]) { ok = false; break; }
        }
        if (ok && d > 9 && z < 4) cands.push({ x, z, d, a: Math.atan2(z, x) });
      }
      if (opts.town) cands.sort((a, b) => Math.hypot(a.x, a.z + 18) - Math.hypot(b.x, b.z + 18)); else cands.sort((a, b) => b.d - a.d);
      for (const c of cands) {
        if (exits.length >= exitCount) break;
        if (exits.every(e => Math.hypot(e.x - c.x, e.z - c.z) > 9)) exits.push(c);
      }
      if (exits.length === 0 && exitCount > 0) exits.push({ x: 0, z: -6 });
    }
    this.exits = exits;
    // spawn point: walkable near centre-south
    let spawn = { x: 0, z: 0 };
    { let bd = 1e9; for (let k = 0; k < GW * GW; k++) if (walk[k]) {
      const x = -HALF + (k % GW) * RES, z = -HALF + ((k / GW) | 0) * RES;
      const d = Math.hypot(x, z - 5); if (d < bd) { bd = d; spawn = { x, z }; } } }
    this.spawn = spawn;
    const paths = exits.map(e => [spawn, e]);
    const distSeg = (px, pz, a, b) => {
      const vx = b.x - a.x, vz = b.z - a.z, wx = px - a.x, wz = pz - a.z;
      const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz + 1e-6), 0, 1);
      return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
    };

    // carve guaranteed wide corridors spawn -> exits (fixes pinched/blocked routes), then re-flood
    for (let k = 0; k < GW * GW; k++) {
      if (RR[k] > 0.95 || T[k] === 1) continue;
      const x = -HALF + (k % GW) * RES, z = -HALF + ((k / GW) | 0) * RES;
      let dp = 9; for (const [p0, p1] of paths) dp = Math.min(dp, distSeg(x, z, p0, p1));
      if (dp < 2.1) T[k] = 1;
    }
    floodWalk();
    this.T = T;
    // heights
    for (let k = 0; k < GW * GW; k++) {
      const i = k % GW, j = (k / GW) | 0, x = -HALF + i * RES, z = -HALF + j * RES;
      const t = T[k], rr = RR[k];
      const nz = N.n2(x * 0.6, z * 0.6);
      if (t === 0 || t === 1) {
        const base = 0.04 * nz;
        H[k] = lerp(-1.5, base, smooth(1.08, 0.97, rr));
      } else if (t === 2) H[k] = 1.5 + nz * 0.2;
      else H[k] = 2.7 + nz * 0.25;
    }

    // ---------- terrain mesh (flat-shaded, jittered grid) ----------
    const pos = [], col = [];
    const vx = new Float32Array(GW * GW), vz = new Float32Array(GW * GW);
    for (let k = 0; k < GW * GW; k++) {
      const i = k % GW, j = (k / GW) | 0;
      const edge = i === 0 || j === 0 || i === GW - 1 || j === GW - 1;
      vx[k] = -HALF + i * RES + (edge ? 0 : (r() - 0.5) * RES * 0.55);
      vz[k] = -HALF + j * RES + (edge ? 0 : (r() - 0.5) * RES * 0.55);
    }
    const C = (h) => new THREE.Color(h);
    const cGrass = C(P.grass), cGL = C(P.grassLight), cGD = C(P.grassDark), cPl = C(P.plateau),
      cSand = C(P.sand), cWet = C(P.sandWet), cDirt = C(P.dirt), cRock = C(P.rock), cRD = C(P.rockDark);
    const tmp = new THREE.Color();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const pushTri = (k0, k1, k2) => {
      a.set(vx[k0], H[k0], vz[k0]); b.set(vx[k1], H[k1], vz[k1]); c.set(vx[k2], H[k2], vz[k2]);
      n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      const rr = (RR[k0] + RR[k1] + RR[k2]) / 3;
      if (n.y < 0.6) {
        const band = Math.floor(cy * 2.6 + N.n2(cx * 0.8, cz * 0.8) * 1.6) % 2;
        tmp.copy(band ? cRock : cRD);
        if (N.n2(cx * 2.1, cy * 3.1 + cz) > 0.72) tmp.lerp(cRD, 0.5);
      } else if (cy > 1.1) {
        tmp.copy(cPl);
        const pn = N.fbm(cx * 0.15 + 9, cz * 0.15);
        if (pn > 0.58) tmp.copy(cGL).lerp(cPl, 0.4); else if (pn < 0.4) tmp.copy(cGD);
      } else if (cy < -0.35) {
        tmp.copy(cWet);
      } else if (rr > 0.955 || cy < -0.05) {
        tmp.copy(cSand);
      } else {
        const pn = N.fbm(cx * 0.11 + 3, cz * 0.11 + 7);
        tmp.copy(cGrass);
        if (pn > 0.57) tmp.copy(cGL); else if (pn < 0.4) tmp.copy(cGD);
        if (rr > 0.92) tmp.lerp(cSand, 0.35);
        let dp = 9;
        for (const [p0, p1] of paths) dp = Math.min(dp, distSeg(cx, cz, p0, p1));
        const wob = N.n2(cx * 0.9, cz * 0.9) * 0.6;
        if (dp < 0.85 + wob) tmp.copy(cDirt);
        else if (dp < 1.25 + wob) tmp.lerp(cDirt, 0.35);
      }
      // subtle per-face value jitter for hand-made feel
      const jv = 1 + (N.h(Math.floor(cx * 9) & 255, Math.floor(cz * 9) & 255) - 0.5) * 0.06;
      for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); col.push(tmp.r * jv, tmp.g * jv, tmp.b * jv); }
    };
    for (let j = 0; j < GW - 1; j++) for (let i = 0; i < GW - 1; i++) {
      const k00 = j * GW + i, k10 = k00 + 1, k01 = k00 + GW, k11 = k01 + 1;
      if ((i + j) % 2) { pushTri(k00, k01, k10); pushTri(k10, k01, k11); }
      else { pushTri(k00, k01, k11); pushTri(k00, k11, k10); }
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, toonMat({ vertexColors: true }));
    terrain.receiveShadow = true; terrain.castShadow = true;
    this.group.add(terrain);

    // ---------- water ----------
    this.buildWater(P, T, H);

    // ---------- props ----------
    const snow = P.key === 'snow';
    const inst = (geo, list, opts2 = {}) => {
      if (!list.length) return null;
      const m = new THREE.InstancedMesh(geo, toonMat({ vertexColors: true }), list.length);
      const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
      list.forEach((it, idx) => {
        e.set(it.rx || 0, it.ry || 0, it.rz || 0); q4.setFromEuler(e);
        s.set(it.s, it.sy ?? it.s, it.s); p.set(it.x, it.y, it.z);
        mtx.compose(p, q4, s); m.setMatrixAt(idx, mtx);
        if (it.c !== undefined) m.setColorAt(idx, new THREE.Color(it.c));
      });
      m.castShadow = opts2.cast !== false; m.receiveShadow = true;
      this.group.add(m);
      return m;
    };

    const pineT = [pineGeo(P, r, snow), pineGeo(P, r, snow)];
    const roundT = P.leaf.slice(0, 3).map(h => roundTreeGeo(P, r, h));
    const pines = [[], []], rounds = [[], [], []], rocks = [], bushes = [], grass = [], grass2 = [], flowers = [], shrooms = [], pillars = [], logs = [], posts = [];
    const occupied = (x, z, rad) => this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rad);
    const nearExitOrSpawn = (x, z, d) => Math.hypot(x - spawn.x, z - spawn.z) < d || exits.some(e => Math.hypot(e.x - x, e.z - z) < d);
    const nearPath = (x, z, d) => paths.some(([p0, p1]) => distSeg(x, z, p0, p1) < d);
    const pineBias = P.key === 'snow' ? 0.8 : P.key === 'autumn' ? 0.45 : P.key === 'ember' ? 0.5 : 0.55;

    for (let tries = 0; tries < 2600; tries++) {
      const x = rand(r, -HALF + 1, HALF - 1), z = rand(r, -HALF + 1, HALF - 1);
      const k = this.idx(x, z); if (k < 0) continue;
      const t = T[k], y = H[k], rr = RR[k];
      if (t >= 2) {
        // dense canopy on plateaus — only on flat tops
        const kk = [k + 1, k - 1, k + GW, k - GW, k + 2, k - 2, k + 2 * GW, k - 2 * GW];
        if (kk.some(q2 => T[q2] !== t)) continue;
        if (r() < 0.75) {
          const s = 0.7 + r() * 0.45;
          if (r() < pineBias) pines[Math.floor(r() * 2)].push({ x, y, z, s, ry: r() * 6 });
          else rounds[Math.floor(r() * 3)].push({ x, y, z, s, ry: r() * 6 });
          this.obstacles.push({ x, z, r: 0.4 * s + 0.15, h: y });
        } else if (r() < 0.5) rocks.push({ x, y, z, s: 0.6 + r() * 0.9, ry: r() * 6 });
        else bushes.push({ x, y, z, s: 0.8 + r() * 0.6, ry: r() * 6 });
      } else if (t === 1 && rr < 1.0) {
        const isW = walk[k];
        if (opts.town && Math.hypot(x, z) < 16) continue;
        if (isW && (nearExitOrSpawn(x, z, 3.5) || nearPath(x, z, 1.4))) continue;
        const roll = r();
        if (!isW && rr > 0.95) { if (roll < 0.15) rocks.push({ x, y: y - 0.1, z, s: 0.5 + r() * 0.6, ry: r() * 6 }); continue; }
        if (roll < 0.035 && !occupied(x, z, 1.2)) {
          const s = 0.75 + r() * 0.5;
          if (r() < pineBias) pines[Math.floor(r() * 2)].push({ x, y, z, s, ry: r() * 6 });
          else rounds[Math.floor(r() * 3)].push({ x, y, z, s, ry: r() * 6 });
          if (isW) this.obstacles.push({ x, z, r: 0.45 * s + 0.2, h: y });
        } else if (roll < 0.06 && !occupied(x, z, 1)) {
          const s = 0.5 + r() * 0.9;
          rocks.push({ x, y, z, s, ry: r() * 6 });
          if (isW && s > 0.8) this.obstacles.push({ x, z, r: 0.5 * s, h: y });
        } else if (roll < 0.1) bushes.push({ x, y, z, s: 0.6 + r() * 0.5, ry: r() * 6 });
        else if (roll < 0.11 && !occupied(x, z, 1)) {
          if (P.key === 'ember' || r() < 0.5) { pillars.push({ x, y, z, s: 0.9 + r() * 0.3, ry: r() * 6 }); if (isW) this.obstacles.push({ x, z, r: 0.5, h: y }); }
          else { logs.push({ x, y, z, s: 0.9, ry: r() * 6 }); }
        } else if (roll < 0.125) shrooms.push({ x, y, z, s: 0.8 + r() * 0.8, ry: r() * 6 });
      }
    }
    // grass & flowers in clumps (cheap instancing)
    for (let i = 0; i < 260; i++) {
      const cx = rand(r, -HALF + 2, HALF - 2), cz = rand(r, -HALF + 2, HALF - 2);
      const k = this.idx(cx, cz); if (k < 0 || T[k] === 0 || RR[k] > 0.96) continue;
      const isFlower = r() < 0.3;
      const cnt = 3 + Math.floor(r() * 6);
      for (let m = 0; m < cnt; m++) {
        const x = cx + (r() - 0.5) * 2, z = cz + (r() - 0.5) * 2;
        const kk = this.idx(x, z); if (kk < 0 || T[kk] === 0 || RR[kk] > 0.97) continue;
        // skip cliff faces
        if (Math.abs(H[kk] - H[kk + 1]) > 0.5 || Math.abs(H[kk] - H[kk + GW]) > 0.5) continue;
        const y = H[kk];
        if (isFlower) flowers.push({ x, y, z, s: 0.8 + r() * 0.6, ry: r() * 6, c: pick(r, P.flower) });
        else (r() < 0.5 ? grass : grass2).push({ x, y, z, s: 0.7 + r() * 0.8, ry: r() * 6 });
      }
    }
    // lantern posts along paths (cozy landmark + light source fiction)
    for (const [p0, p1] of paths) {
      const L = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      for (let d = 3; d < L - 2; d += 5.5) {
        const t2 = d / L, side = (Math.floor(d) % 2 ? 1 : -1) * 1.5;
        const nx = -(p1.z - p0.z) / L, nz = (p1.x - p0.x) / L;
        const x = p0.x + (p1.x - p0.x) * t2 + nx * side, z = p0.z + (p1.z - p0.z) * t2 + nz * side;
        if (!this.isWalk(x, z)) continue;
        posts.push({ x, y: this.groundY(x, z), z, s: 1, ry: Math.atan2(-nz * side, nx * side) });
        this.obstacles.push({ x, z, r: 0.25, h: 0 });
      }
    }
    inst(pineT[0], pines[0]); inst(pineT[1], pines[1]);
    rounds.forEach((l, i) => inst(roundT[i], l));
    inst(rockGeo(P, r), rocks);
    inst(bushGeo(P, r), bushes);
    inst(grassGeo(P.grassDark), grass, { cast: false });
    inst(grassGeo(P.leaf[0]), grass2, { cast: false });
    inst(flowerGeo(), flowers, { cast: false });
    inst(mushroomGeo(), shrooms);
    inst(pillarGeo(P, r), pillars);
    inst(logGeo(P), logs);
    const postM = inst(lanternPostGeo(), posts);
    // glowing lantern boxes (unlit, emissive look)
    if (posts.length) {
      const lg = new THREE.BoxGeometry(0.22, 0.26, 0.22);
      const lm = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffd27a }), posts.length);
      const mtx = new THREE.Matrix4();
      posts.forEach((p, i) => {
        const ox = Math.cos(-p.ry) * 0.3, oz = Math.sin(-p.ry) * 0.3;
        mtx.makeTranslation(p.x + ox, p.y + 1.18, p.z + oz); lm.setMatrixAt(i, mtx);
        this.lanterns.push(new THREE.Vector3(p.x + ox, p.y + 1.18, p.z + oz));
      });
      this.group.add(lm);
    }
    this.T = T; this.RR = RR;
    this.paths = paths;
    return { spawn, exits };
  }

  buildWater(P, T, H) {
    // distance-to-shore field (in cells) via multi-source BFS from land cells
    const D = new Float32Array(GW * GW).fill(999);
    const q = [];
    for (let k = 0; k < GW * GW; k++) if (H[k] >= WATER_Y) { D[k] = 0; q.push(k); }
    let head = 0;
    while (head < q.length) {
      const k = q[head++]; const i = k % GW, j = (k / GW) | 0;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]]) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GW) continue;
        const nk = nj * GW + ni, nd = D[k] + w;
        if (nd < D[nk]) { D[nk] = nd; q.push(nk); }
      }
    }
    const data = new Uint8Array(GW * GW * 4);
    for (let k = 0; k < GW * GW; k++) {
      const v = clamp(D[k] * RES / 8, 0, 1); // 0..8 world units
      data[k * 4] = v * 255; data[k * 4 + 1] = clamp((H[k] - WATER_Y + 1.5) / 1.5, 0, 1) * 255; data[k * 4 + 2] = 0; data[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, GW, GW, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uShore: { value: tex }, uTime: { value: 0 },
        uDeep: { value: new THREE.Vector3(...P.waterDeep) }, uShallow: { value: new THREE.Vector3(...P.waterShallow) },
        uLine: { value: new THREE.Vector3(...P.waterLine) }, uHalf: { value: HALF },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform sampler2D uShore; uniform float uTime, uHalf; uniform vec3 uDeep, uShallow, uLine; varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }
        void main(){
          vec2 uv = (vW.xz + uHalf) / (uHalf*2.0);
          float inside = step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
          float d = mix(1.0, texture2D(uShore, uv).r, inside) * 8.0; // world units from shore
          float depthT = smoothstep(0.0, 6.0, d);
          vec3 col = mix(uShallow, uDeep, depthT);
          // swirly contour lines (A Short Hike-like caustic doodles)
          vec2 p = vW.xz*0.16 + vec2(uTime*0.03, uTime*0.02);
          float n = fbm(p + fbm(p*1.3 - uTime*0.02)*1.2);
          float l = abs(fract(n*5.0) - 0.5);
          col = mix(col, uLine, (1.0-smoothstep(0.035,0.06,l))*0.55*(0.4+0.6*depthT));
          // shore foam: solid rim + travelling wave line
          float wob = (noise(vW.xz*1.7+uTime*0.4)-0.5)*0.25;
          float rim = 1.0 - smoothstep(0.3, 0.48, d + wob);
          float wave = fract(uTime*0.22);
          float wl = abs(d + wob - (0.45 + wave*1.3));
          float waveLine = (1.0 - smoothstep(0.05, 0.13, wl)) * (1.0-wave) * (1.0 - step(2.2, d));
          float band2 = (1.0 - smoothstep(0.32, 0.5, d+wob)) * 0.35;
          col = mix(col, uShallow*1.15, band2);
          col = mix(col, vec3(1.0,0.99,0.95), clamp(rim + waveLine*0.85, 0.0, 1.0));
          // sparkles
          float sp = step(0.985, noise(vW.xz*3.0 + vec2(uTime*0.6,-uTime*0.4))) * depthT;
          col += sp*0.35;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const g = new THREE.PlaneGeometry(400, 400); g.rotateX(-Math.PI / 2);
    const w = new THREE.Mesh(g, mat);
    w.position.y = WATER_Y; w.renderOrder = -1;
    w.receiveShadow = false;
    this.group.add(w);
    this.waterMat = mat;
  }

  // BFS distance field toward target for enemy navigation
  computeFlow(tx, tz) {
    const F = this.flow; F.fill(-1);
    const s = this.idx(tx, tz); if (s < 0) return;
    const q = new Int32Array(GW * GW); let h = 0, t = 0;
    q[t++] = s; F[s] = 0;
    const W = this.walk;
    while (h < t) {
      const k = q[h++]; const d = F[k] + 1;
      const n1 = k + 1, n2 = k - 1, n3 = k + GW, n4 = k - GW;
      if (W[n1] && F[n1] < 0) { F[n1] = d; q[t++] = n1; }
      if (W[n2] && F[n2] < 0) { F[n2] = d; q[t++] = n2; }
      if (W[n3] && F[n3] < 0) { F[n3] = d; q[t++] = n3; }
      if (W[n4] && F[n4] < 0) { F[n4] = d; q[t++] = n4; }
    }
  }
  flowDir(x, z, out) {
    const k = this.idx(x, z); out.set(0, 0);
    if (k < 0 || this.flow[k] < 0) return false;
    let best = this.flow[k], bk = -1;
    for (const nk of [k + 1, k - 1, k + GW, k - GW, k + GW + 1, k + GW - 1, k - GW + 1, k - GW - 1]) {
      const f = this.flow[nk]; if (f >= 0 && f < best) { best = f; bk = nk; }
    }
    if (bk < 0) return false;
    out.set(-HALF + (bk % GW) * RES - x, -HALF + ((bk / GW) | 0) * RES - z).normalize();
    return true;
  }

  randomWalkable(r, minDistFrom, minD) {
    for (let i = 0; i < 400; i++) {
      const x = rand(r, -HALF, HALF), z = rand(r, -HALF, HALF);
      if (!this.isWalk(x, z)) continue;
      if (minDistFrom && Math.hypot(x - minDistFrom.x, z - minDistFrom.z) < minD) continue;
      if (this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.6)) continue;
      return { x, z };
    }
    return { x: this.spawn.x, z: this.spawn.z - 4 };
  }
}
