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
    waterDeep: [0.18, 0.52, 0.78], waterShallow: [0.38, 0.82, 0.88], waterLine: [0.66, 0.92, 0.98],
    sun: 0xfff4da, sky: 0xc6dcff, ground: 0xe6be88, ambient: 0.84, sunI: 1.15,
    grade: [1.04, 1.02, 0.96], shaft: [1.0, 0.94, 0.70], fog: [0.92, 0.96, 1.0],
  },
  {
    key: 'autumn', name: '楓紅山徑',
    grass: 0xc0bc5c, grassLight: 0xdcd26c, grassDark: 0x98a250, plateau: 0xb0ac56,
    sand: 0xf2d896, sandWet: 0xcfb280, dirt: 0xd2844c,
    rock: 0xc0a898, rockDark: 0x927c6b,
    pine: [0x448250, 0x568c4c, 0x346848], leaf: [0xe65c32, 0xf29c3e, 0xf8cc4c, 0xc8462e],
    trunk: 0x825038, flower: [0xffe490, 0xffa470, 0xffffff, 0xf67262],
    waterDeep: [0.18, 0.48, 0.74], waterShallow: [0.38, 0.78, 0.86], waterLine: [0.62, 0.88, 0.96],
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
  // 4: 黃金沙漠（POLY - Egypt）
  {
    key: 'desert', name: '黃金沙漠', foliageStyle: 'desert',
    grass: 0xebd084, grassLight: 0xf8e4a2, grassDark: 0xd4ad5e, plateau: 0xdfb96e,
    sand: 0xf6de98, sandWet: 0xcfa462, dirt: 0xc98a4a,
    rock: 0xd29a6c, rockDark: 0x9e6a46,
    pine: [0x4c9e48, 0x62b454, 0x3a823c], leaf: [0x58a848, 0x76bc56, 0x428c3e, 0xd8a852],
    trunk: 0x9e6c42, flower: [0xffd25a, 0xff8a5a, 0xfff0b8, 0x72d488],
    waterDeep: [0.14, 0.56, 0.66], waterShallow: [0.30, 0.82, 0.84], waterLine: [0.76, 0.96, 0.94],
    sun: 0xfff0c0, sky: 0xaad8ff, ground: 0xf2c87e, ambient: 0.92, sunI: 1.24,
    grade: [1.08, 1.02, 0.90], shaft: [1.0, 0.92, 0.64], fog: [1.0, 0.94, 0.80],
  },
  // 5: 失落叢林（POLY - Jungle + Lost Lands）
  {
    key: 'jungle', name: '失落叢林', foliageStyle: 'jungle',
    grass: 0x54a84c, grassLight: 0x78c458, grassDark: 0x387c3e, plateau: 0x4a9448,
    sand: 0xdac286, sandWet: 0xa8925c, dirt: 0x966e46,
    rock: 0xa69b84, rockDark: 0x756c5a,
    pine: [0x2c7c42, 0x3e964a, 0x206236], leaf: [0x52b44a, 0x82cc4c, 0x2e8c48, 0xe8b84a],
    trunk: 0x6e4a32, flower: [0xff6a7a, 0xffd64a, 0xff9248, 0xb878ff],
    waterDeep: [0.12, 0.44, 0.52], waterShallow: [0.28, 0.76, 0x70 / 255], waterLine: [0.64, 0.94, 0.86],
    sun: 0xfff0c8, sky: 0xa8e0d8, ground: 0x7cb868, ambient: 0.82, sunI: 1.12,
    grade: [0.98, 1.05, 0.96], shaft: [0.96, 0.98, 0.72], fog: [0.80, 0.95, 0.88],
  },
  // 6: 幽霧哥德（Polyworks Graveyard / GothicPalace / Dark Fantasy）
  {
    key: 'gothic', name: '幽霧哥德', foliageStyle: 'gothic',
    grass: 0x4b4e68, grassLight: 0x646886, grassDark: 0x363850, plateau: 0x42445e,
    sand: 0x5c5870, sandWet: 0x3e3a52, dirt: 0x4a4256,
    rock: 0x6c6a84, rockDark: 0x48465e,
    pine: [0x3b354c, 0x4e4462, 0x2c283c], leaf: [0x6e5a8c, 0x8a72aa, 0x50426a, 0x9c88c4],
    trunk: 0x342c3e, flower: [0x9c7eff, 0x6ae8ff, 0xe0b8ff, 0x88ffaa],
    waterDeep: [0.14, 0.14, 0.30], waterShallow: [0.28, 0.30, 0.56], waterLine: [0.58, 0.62, 0.92],
    sun: 0xc8c0ff, sky: 0x38365c, ground: 0x3a3652, ambient: 0.58, sunI: 0.88,
    grade: [0.94, 0.94, 1.08], shaft: [0.74, 0.72, 1.0], fog: [0.36, 0.34, 0.52],
  },
  // 7: 深海螢光（Alien Planets Depth + Underwater Temple）
  {
    key: 'deep_sea', name: '深海螢光', foliageStyle: 'deep_sea',
    grass: 0x3aa8b4, grassLight: 0x5cccd4, grassDark: 0x267c8c, plateau: 0x3092a4,
    sand: 0x62c4cc, sandWet: 0x3a8c9a, dirt: 0x4a7698,
    rock: 0x8668a8, rockDark: 0x5a447c,
    pine: [0xff6a3c, 0xffc83c, 0xd858c8], leaf: [0x4cf0e8, 0xff824c, 0xffd24c, 0xc868ff],
    trunk: 0x6a4e8c, flower: [0x4cf8ff, 0xff88cc, 0xffe45c, 0x7affb8],
    waterDeep: [0.08, 0.36, 0.54], waterShallow: [0.22, 0.76, 0.86], waterLine: [0.56, 0.98, 1.0],
    sun: 0xb8f8ff, sky: 0x42a8b8, ground: 0x366c88, ambient: 0.86, sunI: 1.06,
    grade: [0.92, 1.04, 1.08], shaft: [0.62, 0.98, 1.0], fog: [0.36, 0.78, 0.86],
  },
  // 8: 星際白銀（Polyworks SciFi）
  {
    key: 'scifi', name: '星際白銀', foliageStyle: 'scifi',
    grass: 0xdce6f2, grassLight: 0xf2f7ff, grassDark: 0xb6c6dc, plateau: 0xcad8ea,
    sand: 0xc2d4e8, sandWet: 0x90a8c4, dirt: 0x7a8ea8,
    rock: 0x8c9cb4, rockDark: 0x5c6a82,
    pine: [0x4ad8ff, 0x6ef0ff, 0x2aa4d8], leaf: [0xe8f2ff, 0x5ce8ff, 0x82b4ff, 0xffffff],
    trunk: 0x5a6880, flower: [0x4cf0ff, 0x78b8ff, 0xffffff, 0xff80d0],
    waterDeep: [0.10, 0.28, 0.52], waterShallow: [0.24, 0.74, 0.96], waterLine: [0.68, 0.96, 1.0],
    sun: 0xeaf6ff, sky: 0x28385c, ground: 0x8aa4c4, ambient: 0.94, sunI: 1.18,
    grade: [0.96, 1.01, 1.08], shaft: [0.74, 0.92, 1.0], fog: [0.72, 0.84, 0.98],
  },
  // 9: 異星裂谷（Alien Planets Hive / Sky + Crystals）
  {
    key: 'alien', name: '異星裂谷', foliageStyle: 'alien',
    grass: 0x8e569c, grassLight: 0xb272c0, grassDark: 0x663a76, plateau: 0x7c488c,
    sand: 0xc47a96, sandWet: 0x945270, dirt: 0x784266,
    rock: 0x6a447c, rockDark: 0x462a58,
    pine: [0xff5898, 0xc864ff, 0x6cf0ff], leaf: [0xff6aa8, 0xd478ff, 0xffb85c, 0x64f0e8],
    trunk: 0x542c62, flower: [0xff72b8, 0x72f8ff, 0xffe46a, 0xd084ff],
    waterDeep: [0.26, 0.12, 0.44], waterShallow: [0.66, 0.26, 0.72], waterLine: [0.98, 0.62, 0.94],
    sun: 0xffcce8, sky: 0x5a327c, ground: 0x6e3a7a, ambient: 0.80, sunI: 1.12,
    grade: [1.06, 0.94, 1.08], shaft: [1.0, 0.68, 0.92], fog: [0.64, 0.42, 0.76],
  },
];
