// Utilities: seeded RNG, value noise, palettes
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Noise {
  constructor(seed = 1) {
    const r = mulberry32(seed);
    this.p = new Uint8Array(512);
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
    this.v = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.v[i] = r();
  }
  h(x, y) { return this.v[this.p[(this.p[x & 255] + y) & 511]]; }
  n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = this.h(xi, yi), b = this.h(xi + 1, yi), c = this.h(xi, yi + 1), d = this.h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, t = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n2(x * f, y * f); t += a; a *= 0.5; f *= 2.03; }
    return s / t;
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const rand = (r, a, b) => a + (b - a) * r();
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function angleLerp(a, b, t) {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Biome palettes — warm, saturated, few values per material (see docs/02_art_direction.md)
export const BIOMES = [
  {
    key: 'meadow', name: '晨光草原',
    grass: 0x93c24c, grassLight: 0xb5d65a, grassDark: 0x6e9c3f, plateau: 0x7fb447,
    sand: 0xecd391, sandWet: 0xc9b37a, dirt: 0xd39552,
    rock: 0xc4b6a6, rockDark: 0x958779,
    pine: [0x3f7f4c, 0x4f9152, 0x2f6a47], leaf: [0x86bd3f, 0xb7d04a, 0x5fa344, 0xe0c94a],
    trunk: 0x8a5a3b, flower: [0xffffff, 0xf2a2c0, 0xffe066, 0xb59cf0],
    waterDeep: [0.10, 0.36, 0.66], waterShallow: [0.24, 0.72, 0.80], waterLine: [0.42, 0.78, 0.92],
    sun: 0xfff0d2, sky: 0xb9c9ff, ground: 0xd9b07a, ambient: 0.62, sunI: 1.05,
    grade: [1.03, 1.0, 0.94], shaft: [1.0, 0.92, 0.65], fog: [0.9, 0.95, 1.0],
  },
  {
    key: 'autumn', name: '楓紅山徑',
    grass: 0xb4ae52, grassLight: 0xd0c460, grassDark: 0x8e9648, plateau: 0xa3a04c,
    sand: 0xebcf8c, sandWet: 0xc5a876, dirt: 0xc97b45,
    rock: 0xb39c8c, rockDark: 0x86705f,
    pine: [0x46784a, 0x557f45, 0x355f42], leaf: [0xd9572f, 0xe9963a, 0xf2c447, 0xc0432c],
    trunk: 0x7b4a33, flower: [0xffe08a, 0xff9f6b, 0xffffff, 0xf26b5b],
    waterDeep: [0.09, 0.33, 0.60], waterShallow: [0.22, 0.66, 0.76], waterLine: [0.40, 0.74, 0.88],
    sun: 0xffe2b8, sky: 0xc4b4ff, ground: 0xe0a070, ambient: 0.62, sunI: 1.08,
    grade: [1.06, 0.99, 0.9], shaft: [1.0, 0.82, 0.55], fog: [1.0, 0.9, 0.8],
  },
  {
    key: 'snow', name: '雪松高嶺',
    grass: 0xeef0fb, grassLight: 0xffffff, grassDark: 0xcdd2ee, plateau: 0xe4e8f8,
    sand: 0xd8d3e6, sandWet: 0xb6b2cc, dirt: 0xc88552,
    rock: 0x9f98b8, rockDark: 0x77708f,
    pine: [0x3f6f5f, 0x4a7d63, 0x2f5a52], leaf: [0x6f9a7a, 0xa6c0b0, 0x5b8a70, 0xe9eef8],
    trunk: 0x7a4a3a, flower: [0xffffff, 0xcfe3ff, 0xffd0e0, 0xe0d8ff],
    waterDeep: [0.12, 0.30, 0.60], waterShallow: [0.30, 0.64, 0.82], waterLine: [0.6, 0.82, 0.96],
    sun: 0xfff6ee, sky: 0xa8a8ff, ground: 0xc8c0e8, ambient: 0.7, sunI: 0.95,
    grade: [0.98, 0.98, 1.05], shaft: [0.9, 0.92, 1.0], fog: [0.92, 0.92, 1.0],
  },
  {
    key: 'ember', name: '餘燼古林',
    grass: 0xb0a052, grassLight: 0xcdb862, grassDark: 0x8c8048, plateau: 0x9c8e4e,
    sand: 0xe6c088, sandWet: 0xb89a70, dirt: 0xd88e4c,
    rock: 0xb8949c, rockDark: 0x8a6c80,
    pine: [0x35685a, 0x407458, 0x2c5650], leaf: [0xe86f38, 0xf4a844, 0xc8503a, 0xffd060],
    trunk: 0x6a4034, flower: [0xffb060, 0xff7050, 0xffe0a0, 0xd080ff],
    waterDeep: [0.14, 0.24, 0.50], waterShallow: [0.30, 0.56, 0.70], waterLine: [0.95, 0.70, 0.50],
    sun: 0xffcf98, sky: 0xb898e8, ground: 0xe09a70, ambient: 0.62, sunI: 1.1,
    grade: [1.06, 0.97, 0.94], shaft: [1.0, 0.72, 0.45], fog: [1.0, 0.8, 0.7],
  },
];
