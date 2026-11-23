import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, Noise, clamp, smooth, rand, pick, lerp } from './util.js';
import { natureAssets, buildAssetMaterial } from './assets.js';

export const HALF = 30;          // world spans -30..30
export const RES = 1 / 3;        // 更高密度的地形網格解析度，告別大地圖巨大鋸齒三角
export const GW = Math.round(HALF * 2 / RES) + 1; // 181

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


// ---------- wind (vertex sway shared by toon + normal pass) ----------
export const windU = { uTime: { value: 0 }, uWindStr: { value: 1 } };
export function windPatch(mat, w) {
  // w = [strength, y0, span]
  mat.userData.wind = w;
  mat.customProgramCacheKey = () => 'wind' + w.join(',');
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU.uTime; sh.uniforms.uWindStr = windU.uWindStr;
    sh.vertexShader = 'uniform float uTime; uniform float uWindStr;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wpos = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wpos = instanceMatrix * wpos;
      #endif
      wpos = modelMatrix * wpos;
      float hf = clamp((transformed.y - ${w[1].toFixed(3)}) / ${w[2].toFixed(3)}, 0.0, 1.6);
      hf *= hf;
      float ph = wpos.x * 0.35 + wpos.z * 0.27;
      float gust = smoothstep(0.2, 1.0, 0.5 + 0.5 * sin(uTime * 0.7 - wpos.x * 0.11 - wpos.z * 0.07));
      float sway = sin(uTime * 2.1 + ph) * 0.55 + sin(uTime * 3.6 + ph * 1.7) * 0.22;
      wpos.xz += vec2(0.82, 0.48) * (sway * 0.6 + gust * 0.9) * hf * ${w[0].toFixed(3)} * uWindStr;
      vec4 mvPosition = viewMatrix * wpos;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}
export function windMat(opts, w) { return windPatch(toonMat(opts), w); }

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
  const parts = [part(new THREE.CylinderGeometry(0.11, 0.19, 1.35, 5), P.trunk, 0, 0.67, 0, 0, 0, 0.06)];
  const baseC = new THREE.Color(leafHex);
  const hiC = baseC.clone().offsetHSL(-0.02, 0.06, 0.09).getHex();
  const loC = baseC.clone().offsetHSL(0.02, 0.04, -0.09).getHex();
  const blobs = 6 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = (i / Math.max(1, blobs - 1)) * Math.PI * 2 + r() * 0.4;
    const d = i === 0 ? 0 : 0.42 + r() * 0.34;
    const s = i === 0 ? 0.92 : 0.48 + r() * 0.28;
    const yy = i === 0 ? 2.15 : 1.55 + r() * 0.55;
    let g = new THREE.IcosahedronGeometry(s, 0);
    g = jitterGeo(g, r, 0.14);
    const colHex = yy > 1.95 ? hiC : (yy < 1.65 ? loC : leafHex);
    parts.push(part(g, colHex, Math.cos(a) * d, yy, Math.sin(a) * d));
  }
  return mergeGeometries(parts);
}
// 白樺秋楓樹（致敬參考圖：潔白樺樹幹帶深色樹皮環＋溫暖珊瑚紅/金橘團簇樹冠）
function birchMapleGeo(r, palette) {
  const parts = [
    part(new THREE.CylinderGeometry(0.09, 0.15, 1.6, 5), 0xf3eee3, 0, 0.8, 0, 0, 0, 0.04),
    part(new THREE.CylinderGeometry(0.125, 0.13, 0.09, 5), 0x3b3836, 0, 0.45, 0),
    part(new THREE.CylinderGeometry(0.115, 0.12, 0.08, 5), 0x3b3836, 0, 0.92, 0),
    part(new THREE.CylinderGeometry(0.105, 0.11, 0.07, 5), 0x3b3836, 0, 1.28, 0),
  ];
  const cols = palette || [0xe95c3f, 0xf39237, 0xd84032];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.15 + r() * 0.35, d = i === 0 ? 0 : 0.42 + r() * 0.32;
    const s = i === 0 ? 0.88 : 0.46 + r() * 0.24;
    let g = new THREE.IcosahedronGeometry(s, 0);
    g = jitterGeo(g, r, 0.14);
    parts.push(part(g, cols[i % cols.length], Math.cos(a) * d, (i === 0 ? 2.3 : 1.7 + r() * 0.55), Math.sin(a) * d));
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
    this.scene = scene; this.half = HALF; this.res = RES;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.walk = new Uint8Array(GW * GW);
    this.land = new Uint8Array(GW * GW);
    this.height = new Float32Array(GW * GW);
    this.flow = new Int32Array(GW * GW);
    this.obstacles = [];
    this.lanterns = [];
    this.trees = [];
    this.pierBounds = [];
    this.occludables = [];
    this.buoys = [];
    this.waterMat = null;
  }

  idx(x, z) {
    const i = Math.round((x + this.half) / this.res), j = Math.round((z + this.half) / this.res);
    if (i < 0 || j < 0 || i >= GW || j >= GW) return -1;
    return j * GW + i;
  }
  isPier(x, z) {
    for (const p of this.pierBounds) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return p;
    return null;
  }
  isWalk(x, z) { if (this.isPier(x, z)) return true; const k = this.idx(x, z); return k >= 0 && this.walk[k] === 1; }
  groundY(x, z) { const pr = this.isPier(x, z); if (pr) return pr.y; const k = this.idx(x, z); return k < 0 ? -2 : Math.max(this.height[k], -0.3); }
  gh(x, z) {
    const pr = this.isPier(x, z);
    if (pr) return pr.y;
    const fx = (x + this.half) / this.res, fz = (z + this.half) / this.res;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= GW - 1 || j >= GW - 1) return -2;
    const tx = fx - i, tz = fz - j, H = this.height, k = j * GW + i;
    const h = (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + GW] * (1 - tx) + H[k + GW + 1] * tx) * tz;
    return Math.max(h, -0.3);
  }
  isLand(x, z) { if (this.isPier(x, z)) return true; const k = this.idx(x, z); return k >= 0 && this.height[k] > -0.2 && this.RR[k] < 1.0; }

  clear() {
    this.waterMat?.uniforms.uShore.value.dispose();
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !o.userData?.sharedGeo) o.geometry.dispose(); if (o.material && o.material.dispose && !o.userData?.sharedMat) o.material.dispose(); });
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.obstacles = [];
    this.lanterns = [];
    this.trees = [];
    this.pierBounds = [];
    this.occludables = [];
    this.buoys = [];
  }

  generate(seed, biome, opts = {}) {
    this.clear();
    this.half = (opts.size || 60) / 2; this.res = this.half * 2 / (GW - 1);
    const P = biome;
    this.P = P;
    const r = mulberry32(seed * 7919 + 13);
    const N = new Noise(seed);
    const R = opts.size ? this.half * .76 : opts.town ? 25 : opts.boss ? 17 : 18 + r() * 4;
    const ax = opts.town ? 1 : 0.8 + r() * 0.4, az = opts.town ? 1 : 0.8 + r() * 0.4;
    const nAmp = opts.town ? 0.16 : 0.55;
    const so = r() * 100;
    const T = new Uint8Array(GW * GW); // 0 water, 1 ground, 2 plateau, 3 high
    const RR = new Float32Array(GW * GW);
    const H = this.height;

    for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) {
      const x = -this.half + i * this.res, z = -this.half + j * this.res, k = j * GW + i;
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
        const i = k % GW, j = (k / GW) | 0, x = -this.half + i * this.res, z = -this.half + j * this.res;
        const d = Math.hypot(x, z);
        // need open space around
        let ok = true;
        for (let dj = -3; dj <= 3 && ok; dj++) for (let di = -3; di <= 3; di++) {
          const nk = (j + dj) * GW + (i + di); if (!walk[nk]) { ok = false; break; }
        }
        if (ok && d > 9 && z < 4) cands.push({ x, z, d, a: Math.atan2(z, x) });
      }
      if (opts.cardinalExits && exitCount >= 2) {
        const pickNear = (tx, tz) => {
          let best = null, bd = 1e9;
          for (const c of cands) {
            if (exits.some(e => Math.hypot(e.x - c.x, e.z - c.z) < 12)) continue;
            const d = Math.hypot(c.x - tx, c.z - tz);
            if (d < bd) { bd = d; best = c; }
          }
          return best;
        };
        const R0 = R * 0.72;
        const nEx = pickNear(0, -R0) || cands[0]; if (nEx) exits.push({ ...nEx, dir: 'north' });
        const sEx = pickNear(0, R0 * 0.85) || cands[1]; if (sEx) exits.push({ ...sEx, dir: 'south' });
        if (exitCount >= 3) { const eEx = pickNear(R0, 0) || cands[2]; if (eEx) exits.push({ ...eEx, dir: 'east' }); }
      } else {
        if (opts.town) cands.sort((a, b) => Math.hypot(a.x, a.z + 18) - Math.hypot(b.x, b.z + 18)); else cands.sort((a, b) => b.d - a.d);
        for (const c of cands) {
          if (exits.length >= exitCount) break;
          if (exits.every(e => Math.hypot(e.x - c.x, e.z - c.z) > 9)) exits.push(c);
        }
      }
      if (exits.length === 0 && exitCount > 0) exits.push({ x: 0, z: -6, dir: 'north' });
    }
    this.exits = exits;
    // spawn point: walkable near centre-south
    let spawn = { x: 0, z: 0 };
    { let bd = 1e9; for (let k = 0; k < GW * GW; k++) if (walk[k]) {
      const x = -this.half + (k % GW) * this.res, z = -this.half + ((k / GW) | 0) * this.res;
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
      const x = -this.half + (k % GW) * this.res, z = -this.half + ((k / GW) | 0) * this.res;
      let dp = 9; for (const [p0, p1] of paths) dp = Math.min(dp, distSeg(x, z, p0, p1));
      if (dp < 2.1) T[k] = 1;
    }
    floodWalk();
    this.T = T;
    // heights
    for (let k = 0; k < GW * GW; k++) {
      const i = k % GW, j = (k / GW) | 0, x = -this.half + i * this.res, z = -this.half + j * this.res;
      const t = T[k], rr = RR[k];
      const nz = N.n2(x * 0.6, z * 0.6);
      if (t === 0 || t === 1) {
        const base = 0.04 * nz;
        H[k] = lerp(-1.5, base, smooth(1.08, 0.97, rr));
      } else if (t === 2) H[k] = 1.5 + nz * 0.2;
      else H[k] = 2.7 + nz * 0.25;
    }

    // ---------- terrain mesh (fine flat-shaded grid + smooth path feathering) ----------
    const pos = [], col = [];
    const vx = new Float32Array(GW * GW), vz = new Float32Array(GW * GW);
    const jitAmt = Math.min(0.36, this.res * 0.24);
    for (let k = 0; k < GW * GW; k++) {
      const i = k % GW, j = (k / GW) | 0;
      const edge = i === 0 || j === 0 || i === GW - 1 || j === GW - 1;
      vx[k] = -this.half + i * this.res + (edge ? 0 : (r() - 0.5) * jitAmt);
      vz[k] = -this.half + j * this.res + (edge ? 0 : (r() - 0.5) * jitAmt);
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
        if (pn > 0.56) tmp.copy(cGL).lerp(cPl, 0.35); else if (pn < 0.41) tmp.copy(cGD);
      } else if (cy < -0.35) {
        tmp.copy(cWet);
      } else if (rr > 0.955 || cy < -0.05) {
        tmp.copy(cSand);
      } else {
        const pn = N.fbm(cx * 0.11 + 3, cz * 0.11 + 7);
        tmp.copy(cGrass);
        if (pn > 0.56) tmp.lerp(cGL, smooth(0.56, 0.72, pn));
        else if (pn < 0.43) tmp.lerp(cGD, smooth(0.43, 0.28, pn));
        if (rr > 0.91) tmp.lerp(cSand, smooth(0.91, 0.96, rr) * 0.65);
        let dp = 9;
        for (const [p0, p1] of paths) dp = Math.min(dp, distSeg(cx, cz, p0, p1));
        const wob = (N.n2(cx * 0.75, cz * 0.75) - 0.5) * 0.75;
        const pMix = 1 - smooth(0.7, 1.95, dp + wob);
        if (pMix > 0.01) tmp.lerp(cDirt, pMix * 0.92);
      }
      // 柔和的微調色差，避免大型色塊斷裂
      const jv = 1 + (N.h(Math.floor(cx * 9) & 255, Math.floor(cz * 9) & 255) - 0.5) * 0.035;
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
    const tmat = toonMat({ vertexColors: true });
    tmat.customProgramCacheKey = () => 'terrainGustV2';
    tmat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windU.uTime; sh.uniforms.uWindStr = windU.uWindStr;
      sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vGW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform float uTime; uniform float uWindStr; varying vec3 vGW;\n float gh2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n float gn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(gh2(i),gh2(i+vec2(1,0)),f.x), mix(gh2(i+vec2(0,1)),gh2(i+vec2(1,1)),f.x), f.y); }\n' +
        sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float isG = smoothstep(0.02, 0.12, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
          float isDirt = smoothstep(0.05, 0.16, diffuseColor.r - diffuseColor.b) * (1.0 - isG);
          // 像素手繪質感：草葉細點與泥土碎石點綴（告別大三角平滑單調感）
          vec2 pixCell = floor(vGW.xz * 3.4);
          float tuft = step(0.84, gh2(pixCell)) * 0.085 - step(gh2(pixCell + 19.3), 0.14) * 0.055;
          float peb = (step(0.86, gh2(pixCell * 1.3 + 5.1)) * 0.09 - step(gh2(pixCell * 1.3 + 13.7), 0.14) * 0.07) * isDirt;
          // 隨風草浪
          vec2 gp = vGW.xz * 0.09 - vec2(0.82, 0.48) * uTime * 0.22;
          float gn = gn2(gp) * 0.65 + gn2(gp * 2.3 + 7.0) * 0.35;
          float band = step(0.60, gn) * 0.10 - step(gn, 0.30) * 0.06;
          // 陽光與冷青藍雲影對比（致敬 Pin on Vibe 與手繪像素風格）
          vec2 cp = vGW.xz * 0.028 - vec2(0.7, 0.45) * uTime * 0.055;
          float cn = gn2(cp) * 0.65 + gn2(cp * 2.1 + 3.4) * 0.35;
          float cloudShade = smoothstep(0.53, 0.72, cn);
          vec3 baseCol = diffuseColor.rgb * (1.0 + (band * uWindStr + tuft) * isG + peb);
          diffuseColor.rgb = mix(baseCol * vec3(1.03, 1.02, 0.98), baseCol * vec3(0.78, 0.88, 0.97), cloudShade * 0.46);`);
    };
    const terrain = new THREE.Mesh(tg, tmat);
    terrain.receiveShadow = true; terrain.castShadow = true;
    this.group.add(terrain);

    // ---------- water ----------
    this.buildWater(P, T, H);

    // ---------- props ----------
    const snow = P.key === 'snow';
    const inst = (geo, list, opts2 = {}) => {
      if (!list.length) return null;
      const m = new THREE.InstancedMesh(geo, opts2.wind ? windMat({ vertexColors: true }, opts2.wind) : toonMat({ vertexColors: true }), list.length);
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
    const instAsset = (assetKey, fallbackGeo, list, opts2 = {}) => {
      if (!list.length) return null;
      const asset = natureAssets[assetKey];
      if (!asset?.parts?.length) return inst(fallbackGeo, list, opts2);
      const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
      for (const part of asset.parts) {
        const mat = buildAssetMaterial(part, opts2);
        const m = new THREE.InstancedMesh(part.geo, mat, list.length);
        m.userData.sharedGeo = true;
        list.forEach((it, idx) => {
          e.set(it.rx || 0, it.ry || 0, it.rz || 0); q4.setFromEuler(e);
          s.set(it.s, it.sy ?? it.s, it.s); p.set(it.x, it.y, it.z);
          mtx.compose(p, q4, s); m.setMatrixAt(idx, mtx);
        });
        m.castShadow = opts2.cast !== false; m.receiveShadow = true;
        this.group.add(m);
      }
      return true;
    };

    const pineT = [pineGeo(P, r, snow), pineGeo(P, r, snow)];
    const roundT = P.leaf.slice(0, 3).map(h => roundTreeGeo(P, r, h));
    const birchPal = P.key === 'snow' ? [0xd8f0ff, 0xf4f8ff, 0x9fd0ee] : P.key === 'ember' ? [0xff7838, 0xffb84a, 0xd83828] : [0xe95c3f, 0xf39237, 0xf6c445];
    const birchT = birchMapleGeo(r, birchPal);
    const pines = [[], []], rounds = [[], [], []], birches = [], rocks = [], bushes = [], grass = [], grass2 = [], flowers = [], shrooms = [], pillars = [], logs = [], posts = [];
    const occupied = (x, z, rad) => this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rad);
    const nearExitOrSpawn = (x, z, d) => Math.hypot(x - spawn.x, z - spawn.z) < d || exits.some(e => Math.hypot(e.x - x, e.z - z) < d);
    const nearPath = (x, z, d) => paths.some(([p0, p1]) => distSeg(x, z, p0, p1) < d);
    const pineBias = P.key === 'snow' ? 0.8 : P.key === 'autumn' ? 0.45 : P.key === 'ember' ? 0.5 : 0.55;

    const areaScale = Math.max(1, (this.half / 30) * 1.4);
    const propTries = Math.min(6800, Math.round(2600 * areaScale));
    const treeRate = opts.size >= 200 ? 0.11 : 0.045;
    for (let tries = 0; tries < propTries; tries++) {
      const x = rand(r, -this.half + 1, this.half - 1), z = rand(r, -this.half + 1, this.half - 1);
      const k = this.idx(x, z); if (k < 0) continue;
      const t = T[k], y = H[k], rr = RR[k];
      if (t >= 2) {
        // dense canopy on plateaus — only on flat tops
        const kk = [k + 1, k - 1, k + GW, k - GW, k + 2, k - 2, k + 2 * GW, k - 2 * GW];
        if (kk.some(q2 => T[q2] !== t)) continue;
        if (r() < 0.78) {
          const s = 0.75 + r() * 0.65;
          const isPine = r() < pineBias;
          if (isPine) pines[Math.floor(r() * 2)].push({ x, y, z, s, ry: r() * 6 });
          else rounds[Math.floor(r() * 3)].push({ x, y, z, s, ry: r() * 6 });
          this.obstacles.push({ x, z, r: 0.4 * s + 0.15, h: y });
          this.trees.push({ x, y, z, r: 1.45 * s, leafCol: isPine ? P.pine[0] : P.leaf[0], rustleT: 0 });
        } else if (r() < 0.5) rocks.push({ x, y, z, s: 0.7 + r() * 1.1, ry: r() * 6 });
        else bushes.push({ x, y, z, s: 0.85 + r() * 0.65, ry: r() * 6 });
      } else if (t === 1 && rr < 1.0) {
        const isW = walk[k];
        if (opts.town && Math.hypot(x, z) < 16) continue;
        if (opts.raid && Math.hypot(x, z) < 8) continue;
        if (isW && (nearExitOrSpawn(x, z, 3.8) || nearPath(x, z, 1.8))) continue;
        const roll = r();
        if (!isW && rr > 0.95) { if (roll < 0.22) rocks.push({ x, y: y - 0.1, z, s: 0.6 + r() * 0.85, ry: r() * 6 }); continue; }
        if (roll < treeRate && !occupied(x, z, 1.3)) {
          const s = 0.8 + r() * 0.7;
          const isPine = r() < pineBias;
          if (isPine) pines[Math.floor(r() * 2)].push({ x, y, z, s, ry: r() * 6 });
          else rounds[Math.floor(r() * 3)].push({ x, y, z, s, ry: r() * 6 });
          if (isW) this.obstacles.push({ x, z, r: 0.45 * s + 0.2, h: y });
          this.trees.push({ x, y, z, r: 1.55 * s, leafCol: isPine ? P.pine[0] : P.leaf[0], rustleT: 0 });
        } else if (roll < treeRate + 0.045 && !occupied(x, z, 1.1)) {
          const s = 0.6 + r() * 1.15;
          rocks.push({ x, y, z, s, ry: r() * 6 });
          if (isW && s > 0.8) this.obstacles.push({ x, z, r: 0.5 * s, h: y });
        } else if (roll < treeRate + 0.11) bushes.push({ x, y, z, s: 0.65 + r() * 0.6, ry: r() * 6 });
        else if (roll < treeRate + 0.13 && !occupied(x, z, 1.1)) {
          if (P.key === 'ember' || r() < 0.5) { pillars.push({ x, y, z, s: 0.95 + r() * 0.4, ry: r() * 6 }); if (isW) this.obstacles.push({ x, z, r: 0.5, h: y }); }
          else { logs.push({ x, y, z, s: 0.95, ry: r() * 6 }); }
        } else if (roll < treeRate + 0.15) shrooms.push({ x, y, z, s: 0.85 + r() * 0.85, ry: r() * 6 });
      }
    }
    // 聚落式森林群組（Art-directed Forest Groves：每群 4~7 棵樹＋白樺楓紅點綴＋林下灌木與野花，消除空曠感）
    if (!opts.town && !opts.raid) {
      const groveCount = Math.min(54, Math.round(18 * areaScale));
      for (let g = 0; g < groveCount; g++) {
        const gx = rand(r, -this.half + 5, this.half - 5), gz = rand(r, -this.half + 5, this.half - 5);
        const gk = this.idx(gx, gz); if (gk < 0 || !walk[gk]) continue;
        if (nearExitOrSpawn(gx, gz, 9) || nearPath(gx, gz, 4.5)) continue;
        const cnt = 4 + Math.floor(r() * 4);
        for (let m = 0; m < cnt; m++) {
          const a = (m / cnt) * Math.PI * 2 + r() * 0.6, rad = m === 0 ? 0.4 : 2.1 + r() * 2.8;
          const x = gx + Math.cos(a) * rad, z = gz + Math.sin(a) * rad;
          const kk = this.idx(x, z); if (kk < 0 || !walk[kk] || nearPath(x, z, 2.4) || occupied(x, z, 1.35)) continue;
          const y = H[kk], s = 0.85 + r() * 0.65;
          const tRoll = r();
          if (tRoll < 0.28) birches.push({ x, y, z, s: s * 1.05, ry: r() * 6 });
          else if (tRoll < 0.62) pines[Math.floor(r() * 2)].push({ x, y, z, s, ry: r() * 6 });
          else rounds[Math.floor(r() * 3)].push({ x, y, z, s, ry: r() * 6 });
          this.obstacles.push({ x, z, r: 0.45 * s + 0.18, h: y });
          this.trees.push({ x, y, z, r: 1.55 * s, leafCol: tRoll < 0.28 ? birchPal[0] : P.leaf[0], rustleT: 0 });
          if (r() < 0.65) bushes.push({ x: x + (r() - 0.5) * 1.8, y, z: z + (r() - 0.5) * 1.8, s: 0.7 + r() * 0.5, ry: r() * 6 });
        }
      }
    }
    // grass & flowers in clumps (scaled with map area for lush A Short Hike vibe)
    const clumpCount = Math.min(1150, Math.round(320 * areaScale));
    for (let i = 0; i < clumpCount; i++) {
      const cx = rand(r, -this.half + 2, this.half - 2), cz = rand(r, -this.half + 2, this.half - 2);
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
    instAsset('pine', pineT[0], pines[0], { wind: [0.20, 0.7, 2.4], tint: P.pine[0], tintMix: P.key === 'snow' ? 0.65 : 0.45 });
    instAsset('pine', pineT[1], pines[1], { wind: [0.20, 0.7, 2.4], tint: P.pine[1] ?? P.pine[0], tintMix: P.key === 'snow' ? 0.65 : 0.45 });
    rounds.forEach((l, i) => instAsset('tree', roundT[i], l, { wind: [0.24, 0.8, 2.2], tint: P.leaf[i], tintMix: P.key === 'meadow' ? 0.32 : 0.58 }));
    inst(birchT, birches, { wind: [0.26, 0.8, 2.2] });
    const rocksA = rocks.filter((_, i) => i % 2 === 0), rocksB = rocks.filter((_, i) => i % 2 === 1);
    instAsset('rock1', rockGeo(P, r), rocksA, { rockTint: P.rock });
    instAsset('rock2', rockGeo(P, r), rocksB, { rockTint: P.rockDark });
    instAsset('bush', bushGeo(P, r), bushes, { wind: [0.18, 0.08, 0.75], tint: P.leaf[0], tintMix: 0.35 });
    inst(grassGeo(P.grassDark), grass, { cast: false, wind: [0.32, 0.0, 0.42] });
    instAsset('fern', grassGeo(P.leaf[0]), grass2, { cast: false, wind: [0.30, 0.0, 0.48], tint: P.leaf[0], tintMix: 0.38 });
    instAsset('flower', flowerGeo(), flowers, { cast: false, wind: [0.24, 0.0, 0.35] });
    instAsset('shroom', mushroomGeo(), shrooms);
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
    for (let k = 0; k < GW * GW; k++) this.land[k] = (T[k] >= 1 && RR[k] < 0.96) ? 1 : 0;
    this.paths = paths;
    this.buildShoreBuoys(r, opts.town ? 6 : 10);
    if (!opts.town && !opts.raid && (opts.size || 60) >= 120) this.buildScenicLandmarks(P, r, spawn, exits, paths);
    return { spawn, exits };
  }

  // 多層次特別景觀建築與自然地標：巨樹、巨石、遺跡八角噴泉石柱、木造瞭望塔、海岸遮陽傘與林間營地
  buildScenicLandmarks(P, r, spawn, exits, paths) {
    const placeSpot = (minD = 14) => {
      for (let i = 0; i < 120; i++) {
        const p = this.randomWalkable(r, spawn, minD);
        if (exits.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 11)) continue;
        if (this.obstacles.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + 3.8)) continue;
        return p;
      }
      return null;
    };
    const addLandmark = (grp, x, z, obstR = 2.0, occlude = true) => {
      const y = this.gh(x, z);
      grp.position.set(x, y, z);
      this.group.add(grp);
      if (obstR > 0) this.obstacles.push({ x, z, r: obstR, h: y });
      if (occlude) this.occludables.push(grp);
      return grp;
    };
    const scScale = this.half >= 160 ? 2 : 1;
    // 1. 巨樹（Colossal Ancient Trees，帶板根、雙層巨冠與暖色吊燈）
    for (let i = 0; i < 4 * scScale; i++) {
      const pt = placeSpot(16); if (!pt) continue;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.15, 5.8, 7), toonMat({ color: P.trunk }));
      trunk.position.y = 2.9; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
      for (let b = 0; b < 4; b++) {
        const root = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 5), toonMat({ color: P.trunk }));
        const a = b * 1.57 + r() * 0.4;
        root.position.set(Math.cos(a) * 0.9, 0.7, Math.sin(a) * 0.9); root.rotation.z = -Math.cos(a) * 0.55; root.rotation.x = Math.sin(a) * 0.55;
        g.add(root);
      }
      const canopyCols = [P.leaf[0], P.leaf[1] || P.pine[0], P.leaf[2] || P.pine[1]];
      for (let c = 0; c < 6; c++) {
        const ca = c * 1.05, cr = c === 0 ? 0 : 1.85 + r() * 0.7;
        const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(c === 0 ? 2.8 : 1.9 + r() * 0.4, 1), toonMat({ color: canopyCols[c % canopyCols.length] }));
        dome.position.set(Math.cos(ca) * cr, (c === 0 ? 7.2 : 5.6 + r() * 1.1), Math.sin(ca) * cr);
        dome.castShadow = true; dome.receiveShadow = true; g.add(dome);
      }
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.32), new THREE.MeshBasicMaterial({ color: 0xffdc7a }));
      lamp.position.set(1.25, 3.6, 0.4); g.add(lamp);
      addLandmark(g, pt.x, pt.z, 1.35, true);
    }
    // 2. 巨石與層狀苔岩（Towering Megalith Boulders）
    for (let i = 0; i < 5 * scScale; i++) {
      const pt = placeSpot(14); if (!pt) continue;
      const g = new THREE.Group();
      const main = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3 + r() * 0.9, 0), toonMat({ color: P.rock }));
      main.scale.set(1.15, 1.35, 1.0); main.position.y = 1.6; main.rotation.set(r() * 0.3, r() * 6, r() * 0.3);
      main.castShadow = true; main.receiveShadow = true; g.add(main);
      const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), toonMat({ color: P.grass }));
      cap.scale.set(1.1, 0.45, 1.1); cap.position.y = 3.2; g.add(cap);
      for (let s = 0; s < 2; s++) {
        const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 + r() * 0.4, 0), toonMat({ color: P.rockDark }));
        sub.position.set((s ? 1 : -1) * 1.8, 0.7, (r() - 0.5) * 1.4); sub.castShadow = true; g.add(sub);
      }
      addLandmark(g, pt.x, pt.z, 2.3, true);
    }
    // 3. 遺跡八角水池與斷柱聖壇（致敬參考圖：八角石池、清澈水心與四根苔蘚斷柱）
    for (let i = 0; i < 2 * scScale; i++) {
      const pt = placeSpot(20); if (!pt) continue;
      const g = new THREE.Group();
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 0.75, 8), toonMat({ color: 0xc8c2b4 }));
      basin.position.y = 0.38; basin.receiveShadow = true; basin.castShadow = true; g.add(basin);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0x58b8dc }));
      water.position.y = 0.4; g.add(water);
      const core = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 1.15), toonMat({ color: 0xb2ac9e }));
      core.position.y = 0.72; core.castShadow = true; g.add(core);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0x9cf2ff }));
      orb.position.y = 1.65; g.add(orb);
      for (let c = 0; c < 4; c++) {
        const a = c * 1.57 + 0.4, ch = 2.6 + (c % 2) * 1.4;
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.85, ch, 0.85), toonMat({ color: c % 2 ? 0xc2bcb0 : 0x9fa398 }));
        col.position.set(Math.cos(a) * 4.7, ch / 2, Math.sin(a) * 4.7); col.castShadow = true; g.add(col);
        const moss = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.25, 0.95), toonMat({ color: P.grass }));
        moss.position.set(Math.cos(a) * 4.7, ch + 0.08, Math.sin(a) * 4.7); g.add(moss);
      }
      addLandmark(g, pt.x, pt.z, 3.6, true);
    }
    // 4. 山谷木造瞭望塔（Cozy Wooden Lookout Watchtower）
    for (let i = 0; i < 2; i++) {
      const pt = placeSpot(22); if (!pt) continue;
      const g = new THREE.Group();
      for (const [lx, lz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 5.2, 0.24), toonMat({ color: 0x7c5032 }));
        leg.position.set(lx, 2.6, lz); leg.castShadow = true; g.add(leg);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.26, 2.9), toonMat({ color: 0xa87446 }));
      deck.position.y = 3.6; deck.castShadow = true; g.add(deck);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.8, 4), toonMat({ color: 0xc95a42 }));
      roof.position.y = 5.9; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xffe480 }));
      beacon.position.y = 4.4; g.add(beacon);
      addLandmark(g, pt.x, pt.z, 1.65, true);
    }
    // 5. A Short Hike 風格林間野餐休憩點＆沙灘遮陽傘（木桌、遮陽傘、營火與圓木椅）
    const umbCols = [0xff5e78, 0x3fa7d6, 0xffc857, 0x6fd08c];
    for (let i = 0; i < 3 * scScale; i++) {
      const pt = placeSpot(14); if (!pt) continue;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), toonMat({ color: 0xf0e6d2 }));
      pole.position.set(-1.1, 1.2, -0.4); g.add(pole);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.65, 6), toonMat({ color: umbCols[i % umbCols.length] }));
      canopy.position.set(-1.1, 2.35, -0.4); canopy.castShadow = true; g.add(canopy);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.9), toonMat({ color: 0xc24838 }));
      top.position.set(0.6, 0.72, 0); top.castShadow = true; g.add(top);
      const bench1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.3), toonMat({ color: 0xa63c2e }));
      bench1.position.set(0.6, 0.42, 0.72); g.add(bench1);
      const bench2 = bench1.clone(); bench2.position.z = -0.72; g.add(bench2);
      for (let f = -1; f <= 1; f++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.14), toonMat({ color: 0xb07c48 }));
        post.position.set(f * 1.1, 0.4, -1.8); g.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.08), toonMat({ color: 0xc8925a }));
      rail.position.set(0, 0.62, -1.8); g.add(rail);
      addLandmark(g, pt.x, pt.z, 1.3, false);
    }
    // 6. 溫暖林間石圈營火、圓木椅與木路牌（致敬 A Short Hike 營地）
    for (let i = 0; i < 3 * scScale; i++) {
      const pt = placeSpot(15); if (!pt) continue;
      const g = new THREE.Group();
      for (let s = 0; s < 7; s++) {
        const a = (s / 7) * Math.PI * 2;
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), toonMat({ color: P.rockDark }));
        st.position.set(Math.cos(a) * 0.72, 0.12, Math.sin(a) * 0.72); g.add(st);
      }
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 5), new THREE.MeshBasicMaterial({ color: 0xff8c30 }));
      fire.position.y = 0.34; g.add(fire);
      for (const sgn of [-1, 1]) {
        const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 6), toonMat({ color: P.trunk }));
        bench.rotation.z = Math.PI / 2; bench.rotation.y = sgn * 0.35; bench.position.set(sgn * 1.35, 0.22, 0.6); bench.castShadow = true; g.add(bench);
      }
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.14), toonMat({ color: 0x7a4e32 }));
      post.position.set(-1.7, 0.68, -1.1); g.add(post);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.08), toonMat({ color: 0xf4dfba }));
      board.position.set(-1.7, 1.12, -1.06); board.rotation.y = 0.25; g.add(board);
      addLandmark(g, pt.x, pt.z, 1.1, false);
    }
    // 7. 飛瀑岩池與跨溪木板橋（致敬 A Short Hike 瀑布橋）
    for (let i = 0; i < 2; i++) {
      const pt = placeSpot(22); if (!pt) continue;
      const g = new THREE.Group();
      const cliff = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.6, 2.4), toonMat({ color: P.rock }));
      cliff.position.set(0, 2.3, -2.8); cliff.castShadow = true; cliff.receiveShadow = true; g.add(cliff);
      const fall = new THREE.Mesh(new THREE.BoxGeometry(1.75, 4.65, 0.32), new THREE.MeshBasicMaterial({ color: 0x62d6f0 }));
      fall.position.set(0, 2.3, -1.55); g.add(fall);
      const foam = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.9, 0.24, 10), new THREE.MeshBasicMaterial({ color: 0xeaffff }));
      foam.position.set(0, 0.14, -1.1); g.add(foam);
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0x42b8d8 }));
      pool.position.set(0, 0.08, 0.4); g.add(pool);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 3.8), toonMat({ color: 0xc88446 }));
      bridge.position.set(0, 0.28, 1.4); bridge.rotation.y = Math.PI / 2; bridge.castShadow = true; g.add(bridge);
      addLandmark(g, pt.x, pt.z, 2.4, true);
    }
    // 8. 雙巨柱石階清泉遺跡（致敬 Pin on Vibe 參考圖：層疊石階、雙高柱、湛藍倒影池與漂浮白蓮）
    for (let i = 0; i < 2 * scScale; i++) {
      const pt = placeSpot(24); if (!pt) continue;
      const g = new THREE.Group();
      const step1 = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.36, 5.4), toonMat({ color: 0xd6d0c4 }));
      step1.position.y = 0.18; step1.receiveShadow = true; step1.castShadow = true; g.add(step1);
      const step2 = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.36, 4.4), toonMat({ color: 0xc8c2b4 }));
      step2.position.y = 0.52; step2.receiveShadow = true; g.add(step2);
      const pond = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 3.2), new THREE.MeshBasicMaterial({ color: 0x3ec6e8 }));
      pond.position.y = 0.72; g.add(pond);
      for (const [lx, lz] of [[-1.1, 0.5], [1.2, -0.4], [0.2, 0.7]]) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 6), toonMat({ color: 0x6ac86e }));
        pad.position.set(lx, 0.8, lz); g.add(pad);
      }
      for (const sx of [-2.4, 2.4]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.2, 0.95), toonMat({ color: 0xd0cac0 }));
        col.position.set(sx, 2.9, -1.6); col.castShadow = true; g.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.35, 1.25), toonMat({ color: 0xbcb6aa }));
        cap.position.set(sx, 5.6, -1.6); g.add(cap);
        const vine = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.4, 1.02), toonMat({ color: P.grass }));
        vine.position.set(sx, 5.8, -1.6); g.add(vine);
      }
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xffe680 }));
      rune.position.set(0, 2.2, -1.6); g.add(rune);
      addLandmark(g, pt.x, pt.z, 3.4, true);
    }
  }

  // 海岸水域漂浮橘白航標與救生圈（致敬海面水波參考影片）
  buildShoreBuoys(r, count = 8) {
    for (let i = 0, tries = 0; i < count && tries < 220; tries++) {
      const x = rand(r, -this.half * 0.96, this.half * 0.96), z = rand(r, -this.half * 0.96, this.half * 0.96);
      const k = this.idx(x, z); if (k < 0) continue;
      if (this.RR[k] < 1.04 || this.RR[k] > 1.24) continue;
      const g = new THREE.Group();
      if (i % 2 === 0) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.45, 10), toonMat({ color: 0xf0542c }));
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.14, 10), toonMat({ color: 0xfff8ec }));
        stripe.position.y = 0.06;
        const mast = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 4), toonMat({ color: 0xf0542c }));
        mast.position.y = 0.8; mast.castShadow = true;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe47a }));
        tip.position.y = 1.4;
        g.add(base, stripe, mast, tip);
      } else {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.15, 6, 12), toonMat({ color: 0xf05a2c }));
        ring.rotation.x = Math.PI / 2;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.155, 6, 4), toonMat({ color: 0xfff8ec }));
        band.rotation.x = Math.PI / 2;
        g.add(ring, band);
      }
      g.position.set(x, WATER_Y + 0.08, z);
      this.group.add(g);
      this.buoys.push({ mesh: g, y0: WATER_Y + 0.08, ph: r() * 6.28 });
      i++;
    }
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
      const v = clamp(D[k] * this.res / 8, 0, 1); // 0..8 world units
      data[k * 4] = v * 255; data[k * 4 + 1] = clamp((H[k] - WATER_Y + 1.5) / 1.5, 0, 1) * 255; data[k * 4 + 2] = 0; data[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, GW, GW, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uShore: { value: tex }, uTime: { value: 0 }, uWater: { value: 1 },
        uDeep: { value: new THREE.Vector3(...P.waterDeep) }, uShallow: { value: new THREE.Vector3(...P.waterShallow) },
        uLine: { value: new THREE.Vector3(...P.waterLine) }, uHalf: { value: this.half },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform sampler2D uShore; uniform float uTime, uHalf, uWater; uniform vec3 uDeep, uShallow, uLine; varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }
        vec2 h22(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
        // F2-F1 voronoi edges (shallow-water caustic network)
        float vor(vec2 p, float t){ vec2 g=floor(p), f=fract(p); float d1=8.0, d2=8.0;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 r=h22(g+o); r=0.5+0.45*sin(t+6.2831*r); float d=length(o+r-f); if(d<d1){d2=d1;d1=d;} else if(d<d2){d2=d;} }
          return d2-d1; }
        // sparse expanding ripple rings scattered over open water
        float rings(vec2 p, float t){ vec2 g=floor(p), f=fract(p); float acc=0.0;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 id=g+o; vec2 r=h22(id); float on=step(0.55,h22(id+3.7).x);
            float ph=fract(t*0.22+r.x*3.0+h22(id+9.1).y); vec2 c=o+0.2+r*0.6; float dd=length(c-f); float rad=ph*1.15;
            float ring=1.0-smoothstep(0.0,0.045,abs(dd-rad)); float ring2=1.0-smoothstep(0.0,0.035,abs(dd-rad*0.62));
            acc+=on*(ring+ring2*0.7)*(1.0-ph)*(1.0-ph); }
          return clamp(acc,0.0,1.0); }
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
          // shallow-water voronoi network + open-water ripple rings
          float shallowT = (1.0 - smoothstep(0.7, 3.2, d)) * smoothstep(0.35, 0.8, d);
          float vl = 1.0 - smoothstep(0.03, 0.11, vor(vW.xz*0.55 + vec2(uTime*0.03, 0.0), uTime*0.5));
          col = mix(col, vec3(0.9,0.98,1.0), vl * shallowT * 0.55 * uWater);
          float rg = rings(vW.xz*0.22, uTime) * smoothstep(1.2, 4.0, d);
          col = mix(col, vec3(0.92,0.98,1.0), rg * 0.6 * uWater);
          // sparkles + 參考圖風格：水平像素白色水光短線（—）
          float sp = step(0.985, noise(vW.xz*3.0 + vec2(uTime*0.6,-uTime*0.4))) * depthT;
          vec2 dashCell = vec2(floor(vW.x * 0.65 + sin(floor(vW.z * 2.2) + uTime * 0.55) * 0.35), floor(vW.z * 2.2));
          vec2 dashUv = vec2(fract(vW.x * 0.65 + sin(floor(vW.z * 2.2) + uTime * 0.55) * 0.35), fract(vW.z * 2.2));
          float dashOn = step(0.86, hash(dashCell)) * step(0.18, dashUv.x) * step(dashUv.x, 0.82) * step(0.38, dashUv.y) * step(dashUv.y, 0.62);
          col = mix(col, vec3(0.98, 1.0, 1.0), clamp(dashOn * 0.72 * smoothstep(0.6, 2.0, d), 0.0, 0.8));
          col += sp*0.35;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const g = new THREE.PlaneGeometry(1500, 1500); g.rotateX(-Math.PI / 2);
    const w = new THREE.Mesh(g, mat);
    w.position.y = WATER_Y; w.renderOrder = -1;
    w.receiveShadow = false;
    this.group.add(w);
    this.waterMat = mat;
  }

  // BFS distance field toward target for enemy navigation (traverses plateaus & hills)
  computeFlow(tx, tz) {
    const F = this.flow; F.fill(-1);
    const s = this.idx(tx, tz); if (s < 0) return;
    const q = new Int32Array(GW * GW); let h = 0, t = 0;
    q[t++] = s; F[s] = 0;
    const W = this.land;
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
    out.set(-this.half + (bk % GW) * this.res - x, -this.half + ((bk / GW) | 0) * this.res - z).normalize();
    return true;
  }

  randomWalkable(r, minDistFrom, minD) {
    for (let i = 0; i < 400; i++) {
      const x = rand(r, -this.half, this.half), z = rand(r, -this.half, this.half);
      if (!this.isWalk(x, z)) continue;
      if (minDistFrom && Math.hypot(x - minDistFrom.x, z - minDistFrom.z) < minD) continue;
      if (this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.6)) continue;
      return { x, z };
    }
    return { x: this.spawn.x, z: this.spawn.z - 4 };
  }
}
