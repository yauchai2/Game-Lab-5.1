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

// Biome palettes — sunlit, crisp, warm A Short Hike & stylized gouache harmony
export const BIOMES = [
  {
    key: 'meadow', name: '晨光草原',
    grass: 0x9cd454, grassLight: 0xc2e668, grassDark: 0x74aa46, plateau: 0x8bc650,
    sand: 0xf4df9c, sandWet: 0xd4be84, dirt: 0xdc9e5a,
    rock: 0xd2c4b4, rockDark: 0xa49688,
    pine: [0x3c8a52, 0x509e58, 0x2e724a], leaf: [0x8ec842, 0xe87042, 0xf2c24a, 0x64b04a],
    trunk: 0x8e5d3e, flower: [0xffffff, 0xff9ec2, 0xffe46b, 0xb8a2f6],
    waterDeep: [0.09, 0.42, 0.74], waterShallow: [0.22, 0.78, 0.86], waterLine: [0.50, 0.86, 0.96],
    sun: 0xfff4da, sky: 0xc6dcff, ground: 0xe6be88, ambient: 0.72, sunI: 1.15,
    grade: [1.04, 1.02, 0.96], shaft: [1.0, 0.94, 0.70], fog: [0.92, 0.96, 1.0],
  },
  {
    key: 'autumn', name: '楓紅山徑',
    grass: 0xc0bc5c, grassLight: 0xdcd26c, grassDark: 0x98a250, plateau: 0xb0ac56,
    sand: 0xf2d896, sandWet: 0xcfb280, dirt: 0xd2844c,
    rock: 0xc0a898, rockDark: 0x927c6b,
    pine: [0x448250, 0x568c4c, 0x346848], leaf: [0xe65c32, 0xf29c3e, 0xf8cc4c, 0xc8462e],
    trunk: 0x825038, flower: [0xffe490, 0xffa470, 0xffffff, 0xf67262],
    waterDeep: [0.10, 0.38, 0.68], waterShallow: [0.24, 0.72, 0.82], waterLine: [0.46, 0.80, 0.92],
    sun: 0xffe8c2, sky: 0xcebfff, ground: 0xeaa878, ambient: 0.70, sunI: 1.16,
    grade: [1.06, 1.01, 0.92], shaft: [1.0, 0.85, 0.58], fog: [1.0, 0.92, 0.84],
  },
  {
    key: 'snow', name: '雪松高嶺',
    grass: 0xdfe9f8, grassLight: 0xf0f6ff, grassDark: 0xbccce6, plateau: 0xd4e0f4,
    sand: 0xe6e2ee, sandWet: 0xc4c4dc, dirt: 0xc0865a,
    rock: 0xc4c2de, rockDark: 0x9a98ba,
    pine: [0x386e60, 0x487e64, 0x2c5a52], leaf: [0x6e9a7c, 0xa0bcb0, 0x588870, 0xdce6f4],
    trunk: 0x784a3a, flower: [0xffffff, 0xc8e0ff, 0xffccde, 0xdcd4ff],
    waterDeep: [0.20, 0.46, 0.74], waterShallow: [0.42, 0.76, 0.90], waterLine: [0.78, 0.92, 1.0],
    sun: 0xfff8f0, sky: 0xdce4ff, ground: 0xe4dcf4, ambient: 0.92, sunI: 1.18,
    grade: [0.98, 0.99, 1.04], shaft: [0.92, 0.94, 1.0], fog: [0.90, 0.93, 0.99],
  },
  {
    key: 'ember', name: '餘燼古林',
    grass: 0xbca85a, grassLight: 0xd8c26c, grassDark: 0x968a50, plateau: 0xa89856,
    sand: 0xedc890, sandWet: 0xc2a47a, dirt: 0xe09652,
    rock: 0xc49ea6, rockDark: 0x94768a,
    pine: [0x387062, 0x447c60, 0x2e5e58], leaf: [0xf0763c, 0xfab048, 0xd0543e, 0xffd668],
    trunk: 0x70463a, flower: [0xffb868, 0xff7858, 0xffe6a8, 0xd888ff],
    waterDeep: [0.16, 0.28, 0.56], waterShallow: [0.34, 0.62, 0.76], waterLine: [0.98, 0.74, 0.54],
    sun: 0xffd6a2, sky: 0xc2a4ee, ground: 0xe8a47a, ambient: 0.68, sunI: 1.15,
    grade: [1.06, 0.99, 0.95], shaft: [1.0, 0.76, 0.48], fog: [1.0, 0.84, 0.74],
  },
];
