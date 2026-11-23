// v5 野外地圖離散雕塑藍圖引擎（1:1 對應 docs/field_maps_floorplan.html）
// 首批實作三大跨原型樣板圖：#01 晨光草原 (open)、#04 霜冬雪原 (linear)、#07 浮空遺跡群 (hybrid)
// 後續可直接擴充其餘 9 張地圖定義而無需更動引擎核心。

export const BP_W = 260;
export const BP_H = 180;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed) {
  return vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 17) * 0.30 + vnoise(x * 4.3, y * 4.3, seed + 53) * 0.15;
}

export function uvToWorld(u, v, half) {
  return { x: (u - 0.5) * half * 2, z: (v - 0.5) * half * 2 };
}

export function buildBlueprintGrid(def) {
  const g = new Uint8Array(BP_W * BP_H);
  const r = rng(def.seed);
  const idx = (x, y) => y * BP_W + x;
  const set = (x, y, v) => {
    if (x >= 3 && x < BP_W - 3 && y >= 3 && y < BP_H - 3) g[idx(x, y)] = Math.max(g[idx(x, y)], v);
  };
  const carve = (x, y, v = 0) => {
    if (x >= 2 && x < BP_W - 2 && y >= 2 && y < BP_H - 2) g[idx(x, y)] = v;
  };

  const chamber = (nx, ny, rx, ry, val = 2, rot = 0, jag = 0.42) => {
    const cx = nx * BP_W, cy = ny * BP_H, c = Math.cos(rot), s = Math.sin(rot);
    const R = Math.max(rx, ry) * 1.65;
    for (let y = Math.max(3, Math.floor(cy - R)); y < Math.min(BP_H - 3, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(3, Math.floor(cx - R)); x < Math.min(BP_W - 3, Math.ceil(cx + R)); x++) {
        const dx = x - cx, dy = y - cy;
        const lx = (dx * c + dy * s) / rx, ly = (-dx * s + dy * c) / ry;
        const n = 1 + (fbm(x * 0.095, y * 0.095, def.seed) - 0.48) * jag * 2.2;
        if (lx * lx + ly * ly <= n * n) set(x, y, val);
      }
    }
  };

  const corridor = (x0, y0, x1, y1, w = 6.5, val = 2, bend = 0.06) => {
    const ax = x0 * BP_W, ay = y0 * BP_H, bx = x1 * BP_W, by = y1 * BP_H;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (ax + bx) / 2 + nx * len * bend, my = (ay + by) / 2 + ny * len * bend;
    const steps = Math.ceil(len * 1.15);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const px = it * it * ax + 2 * it * t * mx + t * t * bx;
      const py = it * it * ay + 2 * it * t * my + t * t * by;
      const ww = w * (0.74 + 0.48 * fbm(px * 0.08, py * 0.08, def.seed + 91));
      const r2 = ww * ww;
      for (let y = Math.floor(py - ww - 1); y <= Math.ceil(py + ww + 1); y++) {
        for (let x = Math.floor(px - ww - 1); x <= Math.ceil(px + ww + 1); x++) {
          if ((x - px) * (x - px) + (y - py) * (y - py) <= r2) set(x, y, val);
        }
      }
    }
  };

  const chasm = (x0, y0, x1, y1, w = 4.2, toVal = 0, bend = 0.04) => {
    const ax = x0 * BP_W, ay = y0 * BP_H, bx = x1 * BP_W, by = y1 * BP_H;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (ax + bx) / 2 + nx * len * bend, my = (ay + by) / 2 + ny * len * bend;
    const steps = Math.ceil(len * 1.4);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const px = it * it * ax + 2 * it * t * mx + t * t * bx;
      const py = it * it * ay + 2 * it * t * my + t * t * by;
      const ww = w * (0.8 + 0.42 * fbm(px * 0.14, py * 0.14, def.seed + 31));
      for (let y = Math.floor(py - ww); y <= Math.ceil(py + ww); y++) {
        for (let x = Math.floor(px - ww); x <= Math.ceil(px + ww); x++) {
          if ((x - px) * (x - px) + (y - py) * (y - py) <= ww * ww) carve(x, y, toVal);
        }
      }
    }
  };

  const pillar = (nx, ny, rx, ry, rot = 0) => {
    const cx = nx * BP_W, cy = ny * BP_H, c = Math.cos(rot), s = Math.sin(rot);
    const R = Math.max(rx, ry) * 1.5;
    for (let y = Math.max(2, Math.floor(cy - R)); y < Math.min(BP_H - 2, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(2, Math.floor(cx - R)); x < Math.min(BP_W - 2, Math.ceil(cx + R)); x++) {
        const dx = x - cx, dy = y - cy;
        const lx = (dx * c + dy * s) / rx, ly = (-dx * s + dy * c) / ry;
        const n = 1 + (fbm(x * 0.18, y * 0.18, def.seed + 77) - 0.5) * 0.65;
        if (lx * lx + ly * ly <= n * n) carve(x, y, 0);
      }
    }
  };

  const ruin = (nx, ny, len, rot = 0, shape = 'L') => {
    const cx = nx * BP_W, cy = ny * BP_H, c = Math.cos(rot), s = Math.sin(rot);
    const drawSeg = (x0, y0, x1, y1) => {
      const st = 24;
      for (let i = 0; i <= st; i++) {
        const lx = x0 + (x1 - x0) * (i / st), ly = y0 + (y1 - y0) * (i / st);
        const wx = Math.round(cx + lx * c - ly * s), wy = Math.round(cy + lx * s + ly * c);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (wx + dx >= 2 && wx + dx < BP_W - 2 && wy + dy >= 2 && wy + dy < BP_H - 2 && g[idx(wx + dx, wy + dy)] > 0) {
              g[idx(wx + dx, wy + dy)] = 5;
            }
          }
        }
      }
    };
    drawSeg(-len, 0, len, 0);
    drawSeg(-len, 0, -len, len * 0.85);
    if (shape === 'U') drawSeg(len, 0, len, len * 0.85);
  };

  def.sculpt({ chamber, corridor, chasm, pillar, ruin, r });

  const safePts = [
    ...(def.pois || []).map(p => [p.x * BP_W, p.y * BP_H, 14]),
    ...(def.checkpoints || []).map(p => [p[0] * BP_W, p[1] * BP_H, 13]),
    ...(def.camps || []).map(p => [p[0] * BP_W, p[1] * BP_H, 10]),
    ...(def.bridges || []).flatMap(b => [
      [b[0] * BP_W, b[1] * BP_H, 10],
      [b[2] * BP_W, b[3] * BP_H, 10],
      [(b[0] + b[2]) * 0.5 * BP_W, (b[1] + b[3]) * 0.5 * BP_H, 10],
    ]),
  ];

  let placed = 0, tries = 0;
  const targetObs = def.obsCount ?? 16;
  const minDist = def.family === 'open' ? 18 : def.family === 'maze' ? 8 : 11;
  while (placed < targetObs && tries < 700) {
    tries++;
    const x = 12 + Math.floor(r() * (BP_W - 24)), y = 12 + Math.floor(r() * (BP_H - 24));
    const v = g[idx(x, y)];
    if (v < 2 || v > 4) continue;
    let openCnt = 0;
    for (let dy = -6; dy <= 6; dy += 3) for (let dx = -6; dx <= 6; dx += 3) if (g[idx(x + dx, y + dy)] === v) openCnt++;
    if (openCnt < (def.family === 'maze' ? 15 : 21)) continue;
    if (safePts.some(([sx, sy, sr]) => Math.hypot(x - sx, y - sy) < sr)) continue;
    const sc = def.family === 'open' ? 0.65 : def.family === 'maze' ? 1.15 : 0.9;
    const rx = (2.4 + r() * 3.4) * sc, ry = (1.8 + r() * 2.6) * sc, rot = r() * Math.PI;
    if (r() < (def.family === 'open' ? 0.15 : 0.30)) ruin(x / BP_W, y / BP_H, (3.2 + r() * 3.0) * sc, rot, r() < 0.4 ? 'U' : 'L');
    else pillar(x / BP_W, y / BP_H, rx, ry, rot);
    safePts.push([x, y, minDist]);
    placed++;
  }
  return g;
}

const _gridCache = new Map();
export function getBlueprintGrid(fieldId) {
  const def = FIELD_BLUEPRINTS[fieldId];
  if (!def) return null;
  if (!_gridCache.has(fieldId)) _gridCache.set(fieldId, buildBlueprintGrid(def));
  return _gridCache.get(fieldId);
}

export function sampleBlueprintCell(grid, u, v) {
  const gx = Math.max(0, Math.min(BP_W - 1, Math.round(u * (BP_W - 1))));
  const gy = Math.max(0, Math.min(BP_H - 1, Math.round(v * (BP_H - 1))));
  return grid[gy * BP_W + gx];
}

export const FIELD_BLUEPRINTS = {
  // ========= #01 晨光草原（① 大空曠原野型 Wide-Open Blaster）=========
  1: {
    id: 1,
    seed: 1105,
    family: 'open',
    name: '晨光草原',
    planSize: '540×540',
    obsCount: 9,
    shallowKind: 'creek',
    shallowColor: 0x4dbbd8,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor, chasm }) {
      chamber(0.46, 0.56, 76, 46, 2, -0.14, 0.36);
      chamber(0.24, 0.74, 38, 26, 2, -0.30, 0.34);
      chamber(0.76, 0.68, 36, 24, 2, 0.22, 0.34);
      chamber(0.84, 0.28, 28, 22, 3, 0.30, 0.35);
      chamber(0.44, 0.19, 32, 18, 3, -0.15, 0.32);
      corridor(0.18, 0.34, 0.34, 0.24, 7.5, 3, -0.12);
      chamber(0.16, 0.32, 13, 10, 4, -0.2, 0.32);
      chasm(0.26, 0.32, 0.66, 0.52, 3.6, 1, 0.10);
    },
    trails: [
      [[0.20, 0.84], [0.46, 0.56], [0.46, 0.18]],
      [[0.46, 0.56], [0.82, 0.68]],
      [[0.46, 0.56], [0.84, 0.28]],
    ],
    bridges: [
      [0.46, 0.40, 0.50, 0.44],
      [0.58, 0.46, 0.62, 0.50],
    ],
    glides: [
      [0.84, 0.28, 0.66, 0.16, 0.48, 0.18],
      [0.16, 0.32, 0.28, 0.22, 0.42, 0.20],
    ],
    checkpoints: [
      [0.22, 0.80, '風車南門營地'],
      [0.52, 0.56, '晨光溪心石陣'],
      [0.84, 0.28, '巨型茶壺丘頂'],
    ],
    camps: [
      [0.34, 0.68], [0.48, 0.66], [0.64, 0.62], [0.76, 0.70],
      [0.36, 0.44], [0.66, 0.40], [0.56, 0.28], [0.76, 0.46],
    ],
    pois: [
      { x: 0.18, y: 0.84, k: 'exit', dir: 'south', t: '南門←燈谷鎮' },
      { x: 0.88, y: 0.68, k: 'exit', dir: 'east', t: '東門→低語森林' },
      { x: 0.46, y: 0.16, k: 'dungeon', dir: 'north', t: '⛩ 草原洞窟' },
      { x: 0.84, y: 0.27, k: 'secret', landmark: 'teapot_hill', t: '🫖 巨型茶壺丘' },
      { x: 0.16, y: 0.31, k: 'secret', landmark: 'waterfall_chest', t: '💎 瀑頂羽箱' },
      { x: 0.54, y: 0.58, k: 'boss', t: '👑 草原守護獸' },
    ],
  },

  // ========= #04 霜冬雪原（② 狹長流暢線性型 Fast Linear）=========
  4: {
    id: 4,
    seed: 4415,
    family: 'linear',
    name: '霜冬雪原',
    planSize: '620×620',
    obsCount: 14,
    shallowKind: 'ice_lake',
    shallowColor: 0x7fd4f5,
    bridgeStyle: 'ice_log',
    sculpt({ chamber, corridor, chasm }) {
      chamber(0.14, 0.82, 18, 13, 2, -0.3);
      corridor(0.14, 0.82, 0.22, 0.26, 9.5, 3, -0.14);
      chamber(0.22, 0.24, 20, 15, 4, 0.3);
      corridor(0.22, 0.24, 0.56, 0.44, 11.0, 3, 0.08);
      corridor(0.56, 0.44, 0.84, 0.22, 9.5, 3, -0.08);
      corridor(0.56, 0.44, 0.80, 0.76, 10.5, 2, 0.10);
      chamber(0.84, 0.22, 22, 15, 3, -0.25);
      chamber(0.78, 0.76, 22, 15, 1, 0.15);
      chasm(0.10, 0.58, 0.30, 0.62, 3.6, 0);
    },
    trails: [
      [[0.14, 0.82], [0.22, 0.24], [0.56, 0.44], [0.84, 0.22]],
      [[0.56, 0.44], [0.78, 0.76]],
    ],
    bridges: [
      [0.17, 0.56, 0.21, 0.63],
    ],
    glides: [
      [0.23, 0.24, 0.54, 0.34, 0.76, 0.72],
      [0.24, 0.22, 0.56, 0.14, 0.82, 0.20],
    ],
    checkpoints: [
      [0.15, 0.80, '南坡雪營'],
      [0.22, 0.25, '纜車雪峰站'],
      [0.56, 0.44, '滑雪道中繼站'],
      [0.78, 0.75, '東南溜冰湖'],
    ],
    camps: [
      [0.18, 0.68], [0.18, 0.42], [0.40, 0.34],
      [0.68, 0.34], [0.68, 0.58], [0.78, 0.74],
    ],
    pois: [
      { x: 0.14, y: 0.84, k: 'exit', dir: 'south', t: '南雪營←沼澤' },
      { x: 0.84, y: 0.76, k: 'exit', dir: 'east', t: '東口→火岩區' },
      { x: 0.85, y: 0.20, k: 'dungeon', dir: 'north', landmark: 'ice_spires', t: '⛩ 藍冰尖塔·冰窟' },
      { x: 0.21, y: 0.22, k: 'secret', landmark: 'cable_summit', t: '🚡 纜車滑雪山頂' },
      { x: 0.76, y: 0.74, k: 'boss', t: '👑 溜冰湖守護獸' },
      { x: 0.15, y: 0.52, k: 'secret', landmark: 'snow_cabin', t: '🏔 裂谷雪屋橋' },
    ],
  },

  // ========= #07 浮空遺跡群（④ 開闊＋跳島／窄口混合型 Hybrid Island-Hopping）=========
  7: {
    id: 7,
    seed: 7717,
    family: 'hybrid',
    name: '浮空遺跡群',
    planSize: '560×560',
    obsCount: 15,
    shallowKind: 'cloud_sea',
    shallowColor: 0x38a2d4,
    bridgeStyle: 'rope',
    sculpt({ chamber, ruin }) {
      chamber(0.16, 0.86, 17, 12, 2, -0.2);
      chamber(0.11, 0.62, 12, 10, 2, 0.4);
      chamber(0.32, 0.74, 15, 11, 2, -0.3);
      chamber(0.16, 0.34, 14, 11, 3, 0.3);
      chamber(0.36, 0.48, 19, 14, 3, -0.2);
      chamber(0.56, 0.78, 15, 11, 2, 0.25);
      chamber(0.74, 0.56, 23, 17, 4, -0.3);
      chamber(0.90, 0.34, 12, 9, 3, 0.4);
      chamber(0.54, 0.18, 21, 13, 3, 0.1);
      chamber(0.30, 0.16, 11, 8, 4, -0.3);
      chamber(0.84, 0.82, 13, 9, 2, 0.2);
      chamber(0.56, 0.44, 11, 9, 3, -0.4);
      chamber(0.74, 0.22, 10, 8, 3, 0.3);
      ruin(0.54, 0.18, 8, 0.0, 'U');
    },
    trails: [
      [[0.16, 0.86], [0.32, 0.74], [0.36, 0.48], [0.56, 0.44], [0.74, 0.56]],
      [[0.56, 0.44], [0.54, 0.18]],
    ],
    bridges: [
      [0.21, 0.81, 0.28, 0.76],
      [0.12, 0.56, 0.15, 0.40],
      [0.33, 0.66, 0.35, 0.55],
      [0.44, 0.46, 0.53, 0.44],
      [0.61, 0.47, 0.69, 0.53],
      [0.55, 0.38, 0.54, 0.25],
    ],
    glides: [
      [0.75, 0.50, 0.84, 0.42, 0.89, 0.35],
      [0.74, 0.46, 0.74, 0.32, 0.74, 0.24],
      [0.72, 0.20, 0.64, 0.16, 0.58, 0.18],
      [0.30, 0.16, 0.42, 0.14, 0.48, 0.17],
      [0.56, 0.76, 0.44, 0.74, 0.36, 0.74],
    ],
    checkpoints: [
      [0.16, 0.85, '南島浮空碼頭'],
      [0.36, 0.48, '雲海守護獸柱'],
      [0.74, 0.56, '飛瀑燈塔巨崖'],
      [0.54, 0.18, '斷柱星穹古塔'],
    ],
    camps: [
      [0.11, 0.62], [0.32, 0.74], [0.16, 0.34],
      [0.56, 0.78], [0.84, 0.82], [0.56, 0.44], [0.74, 0.22],
    ],
    pois: [
      { x: 0.16, y: 0.87, k: 'exit', dir: 'south', t: '南島←海風港鎮' },
      { x: 0.54, y: 0.17, k: 'dungeon', dir: 'north', landmark: 'star_aqueduct', t: '⛩ 斷柱水道·星穹塔' },
      { x: 0.74, y: 0.56, k: 'secret', landmark: 'cliff_lighthouse', t: '🗼 飛瀑燈塔巨崖' },
      { x: 0.36, y: 0.48, k: 'boss', t: '👑 雲海守護獸柱' },
      { x: 0.90, y: 0.33, k: 'secret', landmark: 'east_pillar_chest', t: '💎 最東孤柱秘寶' },
      { x: 0.30, y: 0.15, k: 'secret', landmark: 'cloud_feather', t: '🪶 雲端金羽柱' },
    ],
  },

  // ========= #02 低語森林（⑤ 高密度立體迷宮型 Crypt / Mire 級）=========
  2: {
    id: 2,
    seed: 2212,
    family: 'maze',
    name: '低語森林',
    planSize: '580×580',
    obsCount: 36,
    shallowKind: 'poison_bog',
    shallowColor: 0x3f8c54,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor, chasm, ruin }) {
      chamber(0.15, 0.82, 16, 12, 2, -0.3);
      corridor(0.15, 0.82, 0.34, 0.86, 5.8, 2, 0.08);
      chamber(0.36, 0.86, 17, 11, 2, 0.1);
      corridor(0.36, 0.86, 0.26, 0.56, 6.4, 2, -0.10);
      corridor(0.36, 0.86, 0.62, 0.78, 6.2, 2, 0.08);
      chamber(0.26, 0.56, 19, 13, 2, -0.2);
      corridor(0.26, 0.56, 0.22, 0.26, 5.8, 3, -0.09);
      chamber(0.24, 0.24, 17, 12, 3, 0.2);
      corridor(0.26, 0.56, 0.56, 0.50, 6.8, 2, 0.06);
      chamber(0.56, 0.50, 21, 15, 2, -0.3);
      corridor(0.56, 0.50, 0.52, 0.18, 6.2, 3, -0.08);
      chamber(0.52, 0.18, 19, 12, 3, 0.15);
      corridor(0.56, 0.50, 0.80, 0.68, 6.8, 2, -0.07);
      chamber(0.80, 0.70, 21, 15, 1, 0.2);
      corridor(0.80, 0.70, 0.88, 0.44, 6.0, 2, 0.10);
      chamber(0.86, 0.24, 16, 12, 4, -0.25);
      chasm(0.38, 0.66, 0.56, 0.74, 4.0, 0);
      chasm(0.36, 0.36, 0.50, 0.38, 4.0, 0);
      chasm(0.66, 0.34, 0.82, 0.44, 4.4, 0);
      ruin(0.80, 0.70, 8, 0.2, 'U');
      ruin(0.56, 0.50, 7, -0.5, 'L');
    },
    trails: [
      [[0.36, 0.86], [0.26, 0.56], [0.56, 0.50], [0.52, 0.18]],
      [[0.56, 0.50], [0.80, 0.70], [0.88, 0.44]],
    ],
    bridges: [
      [0.33, 0.22, 0.43, 0.20],
      [0.62, 0.20, 0.78, 0.23],
      [0.74, 0.42, 0.82, 0.36],
    ],
    glides: [
      [0.86, 0.24, 0.88, 0.48, 0.82, 0.66],
      [0.24, 0.24, 0.20, 0.54, 0.16, 0.78],
    ],
    checkpoints: [
      [0.36, 0.84, '南口密林營地'],
      [0.56, 0.50, '低語古根廣場'],
      [0.24, 0.24, '西北高坡樹冠'],
      [0.80, 0.68, '東南古墓毒霧凹'],
    ],
    camps: [
      [0.26, 0.58], [0.46, 0.76], [0.68, 0.62], [0.86, 0.54],
      [0.42, 0.44], [0.66, 0.28], [0.24, 0.40], [0.72, 0.78],
    ],
    pois: [
      { x: 0.36, y: 0.88, k: 'exit', dir: 'south', t: '南口←晨光草原' },
      { x: 0.89, y: 0.44, k: 'exit', dir: 'east', t: '東徑→霧潮沼澤' },
      { x: 0.52, y: 0.16, k: 'dungeon', dir: 'north', t: '⛩ 古木樹洞' },
      { x: 0.15, y: 0.80, k: 'secret', landmark: 'birch_cabin', t: '🏚 白樺封板廢屋' },
      { x: 0.86, y: 0.23, k: 'secret', landmark: 'canopy_vault', t: '💎 樹冠吊橋秘庫' },
      { x: 0.80, y: 0.70, k: 'boss', landmark: 'forest_tomb', t: '👑 古墓守護獸' },
    ],
  },

  // ========= #03 霧潮沼澤（⑤ 高密度立體迷宮型 Azak Bog 級）=========
  3: {
    id: 3,
    seed: 3313,
    family: 'maze',
    name: '霧潮沼澤',
    planSize: '540×540',
    obsCount: 26,
    shallowKind: 'marsh',
    shallowColor: 0x3b7a80,
    bridgeStyle: 'rope',
    sculpt({ chamber, corridor, chasm }) {
      corridor(0.16, 0.86, 0.50, 0.54, 9.5, 1, -0.10);
      corridor(0.50, 0.54, 0.84, 0.34, 9.0, 1, 0.08);
      corridor(0.50, 0.54, 0.82, 0.74, 9.0, 1, -0.08);
      corridor(0.20, 0.22, 0.50, 0.54, 8.5, 1, 0.12);
      chamber(0.16, 0.86, 16, 11, 2, -0.3);
      chamber(0.36, 0.76, 12, 9, 2, 0.4);
      chamber(0.50, 0.54, 21, 15, 2, 0.25);
      chamber(0.20, 0.22, 19, 14, 3, -0.35);
      chamber(0.46, 0.22, 12, 9, 2, 0.2);
      chamber(0.70, 0.20, 13, 10, 3, -0.2);
      chamber(0.84, 0.36, 16, 12, 2, 0.3);
      chamber(0.86, 0.68, 16, 12, 2, -0.25);
      chamber(0.62, 0.82, 14, 10, 2, 0.15);
      chamber(0.22, 0.54, 12, 9, 2, -0.4);
      chamber(0.36, 0.40, 10, 8, 2, 0.3);
      chamber(0.68, 0.58, 10, 8, 2, -0.3);
      chasm(0.30, 0.32, 0.42, 0.38, 3.6, 0);
      chasm(0.62, 0.46, 0.70, 0.54, 3.6, 0);
    },
    trails: [
      [[0.16, 0.86], [0.50, 0.54], [0.84, 0.36]],
      [[0.50, 0.54], [0.20, 0.22]],
    ],
    bridges: [
      [0.24, 0.82, 0.32, 0.78],
      [0.42, 0.68, 0.47, 0.62],
      [0.60, 0.48, 0.76, 0.39],
      [0.85, 0.45, 0.86, 0.58],
      [0.27, 0.30, 0.39, 0.44],
      [0.58, 0.62, 0.62, 0.74],
      [0.26, 0.54, 0.34, 0.46],
    ],
    glides: [
      [0.70, 0.20, 0.46, 0.12, 0.24, 0.20],
      [0.84, 0.34, 0.78, 0.24, 0.72, 0.20],
    ],
    checkpoints: [
      [0.16, 0.85, '南礁霧潮渡口'],
      [0.50, 0.54, '海怪沉船中央礁'],
      [0.84, 0.36, '東翼高腳吊橋村'],
      [0.20, 0.22, '西北骷髏海蝕岩'],
    ],
    camps: [
      [0.36, 0.76], [0.62, 0.82], [0.86, 0.68],
      [0.46, 0.22], [0.22, 0.54], [0.68, 0.58], [0.36, 0.40],
    ],
    pois: [
      { x: 0.15, y: 0.87, k: 'exit', dir: 'south', t: '南礁←低語森林' },
      { x: 0.88, y: 0.70, k: 'exit', dir: 'east', t: '東棧→霜冬雪原' },
      { x: 0.19, y: 0.20, k: 'dungeon', dir: 'north', t: '⛩ 骷髏岩遺跡' },
      { x: 0.50, y: 0.54, k: 'boss', landmark: 'kraken_wreck', t: '🐙 海怪觸手沉船' },
      { x: 0.84, y: 0.34, k: 'secret', landmark: 'stilt_village', t: '🏘 高腳吊橋村' },
      { x: 0.70, y: 0.19, k: 'secret', landmark: 'shroom_grove', t: '💎 北礁沉船箱' },
    ],
  },

  // ========= #05 燼煙火岩區（③ 寬敞大環形競技場 Burial Bog 級）=========
  5: {
    id: 5,
    seed: 5515,
    family: 'ring',
    name: '燼煙火岩區',
    planSize: '580×580',
    obsCount: 14,
    shallowKind: 'lava_moat',
    shallowColor: 0xff6a28,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor, chasm }) {
      corridor(0.24, 0.82, 0.78, 0.80, 14, 2, 0.14);
      corridor(0.78, 0.80, 0.84, 0.24, 14, 2, 0.14);
      corridor(0.84, 0.24, 0.24, 0.26, 13, 3, 0.14);
      corridor(0.24, 0.26, 0.24, 0.82, 13, 3, 0.14);
      chasm(0.38, 0.40, 0.64, 0.66, 22, 1);
      chamber(0.51, 0.53, 22, 16, 3, -0.2, 0.24);
      chamber(0.84, 0.78, 18, 13, 2, 0.2);
      chamber(0.82, 0.20, 20, 14, 3, -0.2);
    },
    trails: [
      [[0.24, 0.82], [0.78, 0.80], [0.84, 0.24], [0.24, 0.26], [0.24, 0.82]],
    ],
    bridges: [
      [0.51, 0.34, 0.51, 0.43],
      [0.51, 0.63, 0.51, 0.72],
      [0.30, 0.53, 0.40, 0.53],
    ],
    glides: [
      [0.22, 0.28, 0.36, 0.38, 0.48, 0.50],
      [0.82, 0.22, 0.68, 0.36, 0.56, 0.48],
    ],
    checkpoints: [
      [0.24, 0.82, '南峽火山口'],
      [0.84, 0.78, '紅岩瀑布綠洲'],
      [0.82, 0.22, '燼岩熔爐高台'],
      [0.22, 0.28, '西崖礦車棧橋'],
    ],
    camps: [
      [0.50, 0.82], [0.84, 0.52], [0.52, 0.20],
      [0.18, 0.54], [0.74, 0.76], [0.32, 0.26],
    ],
    pois: [
      { x: 0.24, y: 0.86, k: 'exit', dir: 'south', t: '南峽←霜冬雪原' },
      { x: 0.88, y: 0.50, k: 'exit', dir: 'east', t: '東關→古樹林' },
      { x: 0.82, y: 0.18, k: 'dungeon', dir: 'north', landmark: 'ember_furnace', t: '⛩ 燼岩熔爐' },
      { x: 0.51, y: 0.53, k: 'boss', landmark: 'lava_arena', t: '⚔ 中央熔岩演武島' },
      { x: 0.18, y: 0.32, k: 'secret', landmark: 'mine_trestle', t: '⛏ 西崖礦車棧橋' },
      { x: 0.84, y: 0.78, k: 'secret', landmark: 'redrock_oasis', t: '🌴 紅岩瀑布綠洲' },
    ],
  },

  // ========= #06 古樹林（③ 寬敞大環形競技場 世界樹聖域）=========
  6: {
    id: 6,
    seed: 6616,
    family: 'ring',
    name: '古樹林',
    planSize: '660×660',
    obsCount: 18,
    shallowKind: 'spirit_spring',
    shallowColor: 0x3ea8b8,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor, chasm }) {
      corridor(0.24, 0.86, 0.78, 0.84, 15, 2, 0.14);
      corridor(0.78, 0.84, 0.84, 0.34, 15, 2, 0.12);
      corridor(0.84, 0.34, 0.52, 0.16, 13, 3, 0.10);
      corridor(0.52, 0.16, 0.18, 0.34, 13, 3, 0.10);
      corridor(0.18, 0.34, 0.24, 0.86, 14, 2, 0.14);
      chasm(0.38, 0.40, 0.64, 0.64, 20, 0);
      chamber(0.52, 0.52, 20, 15, 2, -0.2);
      chamber(0.18, 0.30, 20, 15, 4, 0.25);
      chamber(0.86, 0.50, 22, 18, 1, -0.2);
      chamber(0.52, 0.16, 24, 14, 3, 0.1);
    },
    trails: [
      [[0.24, 0.86], [0.78, 0.84], [0.84, 0.34], [0.52, 0.16], [0.18, 0.34], [0.24, 0.86]],
    ],
    bridges: [
      [0.52, 0.38, 0.52, 0.25],
      [0.52, 0.62, 0.52, 0.74],
      [0.32, 0.52, 0.42, 0.52],
      [0.62, 0.52, 0.72, 0.52],
    ],
    glides: [
      [0.19, 0.29, 0.36, 0.16, 0.50, 0.17],
      [0.85, 0.48, 0.70, 0.30, 0.56, 0.19],
    ],
    checkpoints: [
      [0.24, 0.84, '古樹林南門'],
      [0.18, 0.30, '西北古塔展望峰'],
      [0.86, 0.50, '東坡三疊靈泉'],
      [0.52, 0.52, '中央世界樹神核'],
    ],
    camps: [
      [0.50, 0.86], [0.78, 0.82], [0.82, 0.64], [0.16, 0.58],
      [0.32, 0.22], [0.72, 0.24], [0.52, 0.52], [0.78, 0.36],
    ],
    pois: [
      { x: 0.24, y: 0.88, k: 'exit', dir: 'south', t: '南門←火岩區' },
      { x: 0.52, y: 0.15, k: 'dungeon', dir: 'north', t: '⛩ 鹿王樹心（終局）' },
      { x: 0.18, y: 0.28, k: 'secret', landmark: 'ancient_pagoda', t: '🏯 五重古塔峰' },
      { x: 0.86, y: 0.50, k: 'secret', landmark: 'spirit_terrace', t: '♨ 三疊靈泉梯田' },
      { x: 0.52, y: 0.52, k: 'boss', landmark: 'world_tree_core', t: '👑 世界樹核守護獸' },
      { x: 0.78, y: 0.84, k: 'secret', landmark: 'forest_camp', t: '✦ 狂暴古根碑' },
    ],
  },

  // ========= #08 珊瑚潮汐灣（① 大空曠原野型 淺海金沙大灣）=========
  8: {
    id: 8,
    seed: 8815,
    family: 'open',
    name: '珊瑚潮汐灣',
    planSize: '560×560',
    obsCount: 10,
    shallowKind: 'lagoon',
    shallowColor: 0x45c8e0,
    bridgeStyle: 'wood',
    sculpt({ chamber }) {
      chamber(0.50, 0.56, 80, 50, 1, -0.10, 0.34);
      chamber(0.46, 0.78, 52, 24, 2, 0.12, 0.30);
      chamber(0.76, 0.62, 34, 26, 2, -0.25, 0.32);
      chamber(0.22, 0.48, 28, 22, 2, -0.30, 0.32);
      chamber(0.24, 0.44, 13, 11, 4, 0.20, 0.28);
      chamber(0.74, 0.20, 32, 16, 3, -0.18, 0.32);
      chamber(0.16, 0.20, 13, 10, 2, 0.3, 0.30);
    },
    trails: [
      [[0.42, 0.84], [0.58, 0.66], [0.76, 0.62]],
      [[0.42, 0.84], [0.24, 0.46]],
    ],
    bridges: [
      [0.18, 0.34, 0.16, 0.26],
    ],
    glides: [
      [0.25, 0.43, 0.48, 0.24, 0.70, 0.20],
      [0.26, 0.46, 0.54, 0.52, 0.76, 0.58],
    ],
    checkpoints: [
      [0.44, 0.82, '椰林金沙南灘'],
      [0.24, 0.46, '帆船瞭望崖堡'],
      [0.78, 0.60, '東側珊瑚沙洲'],
    ],
    camps: [
      [0.36, 0.66], [0.54, 0.58], [0.68, 0.70],
      [0.76, 0.48], [0.52, 0.36], [0.38, 0.42], [0.66, 0.32],
    ],
    pois: [
      { x: 0.42, y: 0.86, k: 'exit', dir: 'south', t: '南沙灘←港鎮' },
      { x: 0.75, y: 0.18, k: 'dungeon', dir: 'north', t: '⛩ 雙瀑海蝕洞' },
      { x: 0.24, y: 0.43, k: 'secret', landmark: 'pirate_fort', t: '🏴‍☠️ 帆船瞭望崖堡' },
      { x: 0.60, y: 0.52, k: 'boss', t: '👑 瀉湖守護獸' },
      { x: 0.16, y: 0.19, k: 'secret', landmark: 'coral_reef', t: '💎 西北礁秘寶' },
      { x: 0.78, y: 0.68, k: 'secret', landmark: 'coconut_beach', t: '⛱ 椰林釣魚灘' },
    ],
  },

  // ========= #09 沉沒電光都（④ 跳島混合型 水上高腳港／電光廢都）=========
  9: {
    id: 9,
    seed: 9919,
    family: 'hybrid',
    name: '沉沒電光都',
    planSize: '580×580',
    obsCount: 22,
    shallowKind: 'electric_canal',
    shallowColor: 0x3082a4,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor, chasm, ruin }) {
      corridor(0.22, 0.86, 0.84, 0.38, 12, 1, 0.04);
      corridor(0.36, 0.82, 0.86, 0.72, 10, 1, -0.06);
      corridor(0.28, 0.52, 0.68, 0.22, 10, 1, 0.06);
      chamber(0.26, 0.84, 28, 12, 2, -0.35, 0.14);
      chamber(0.46, 0.68, 17, 13, 3, -0.45, 0.16);
      chamber(0.66, 0.54, 18, 14, 3, -0.45, 0.16);
      chamber(0.84, 0.72, 16, 12, 3, -0.45, 0.16);
      chamber(0.82, 0.36, 15, 11, 3, -0.45, 0.16);
      chamber(0.56, 0.30, 15, 11, 3, -0.45, 0.16);
      chamber(0.32, 0.48, 13, 10, 2, -0.45, 0.18);
      chamber(0.17, 0.20, 20, 15, 3, -0.3, 0.22);
      chasm(0.28, 0.32, 0.44, 0.40, 4.4, 0);
      chasm(0.56, 0.62, 0.72, 0.74, 4.0, 0);
      ruin(0.46, 0.68, 7, -0.45, 'U');
      ruin(0.66, 0.54, 7, -0.45, 'L');
    },
    trails: [
      [[0.24, 0.84], [0.46, 0.68], [0.66, 0.54], [0.82, 0.36]],
    ],
    bridges: [
      [0.34, 0.76, 0.41, 0.72],
      [0.54, 0.62, 0.60, 0.58],
      [0.74, 0.60, 0.80, 0.66],
      [0.74, 0.46, 0.78, 0.40],
      [0.24, 0.30, 0.30, 0.40],
    ],
    glides: [
      [0.54, 0.28, 0.38, 0.18, 0.22, 0.20],
      [0.80, 0.34, 0.68, 0.28, 0.60, 0.28],
    ],
    checkpoints: [
      [0.24, 0.84, '淹水車站廣場'],
      [0.46, 0.68, '高腳木屋中街'],
      [0.66, 0.54, '彩柱天台戰場'],
      [0.18, 0.20, '水沒變電巨塔'],
    ],
    camps: [
      [0.38, 0.78], [0.58, 0.68], [0.84, 0.72],
      [0.82, 0.36], [0.44, 0.44], [0.32, 0.48], [0.68, 0.38],
    ],
    pois: [
      { x: 0.24, y: 0.88, k: 'exit', dir: 'south', t: '🚊 淹水車站←港鎮' },
      { x: 0.17, y: 0.18, k: 'dungeon', dir: 'north', landmark: 'tesla_tower', t: '⛩ 水沒變電巨塔' },
      { x: 0.66, y: 0.54, k: 'boss', landmark: 'stilt_plaza', t: '👑 彩柱天台守護獸' },
      { x: 0.56, y: 0.28, k: 'secret', landmark: 'clock_roof', t: '💎 鐘樓天台秘寶' },
      { x: 0.84, y: 0.72, k: 'secret', landmark: 'market_pier', t: '⛺ 水上高腳市集' },
    ],
  },

  // ========= #10 櫻花水都（② 狹長流暢線性型 S 型落櫻溪谷）=========
  10: {
    id: 10,
    seed: 1020,
    family: 'linear',
    name: '櫻花水都',
    planSize: '580×580',
    obsCount: 14,
    shallowKind: 'koi_pond',
    shallowColor: 0x4cc4e8,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor, chasm }) {
      chamber(0.82, 0.82, 18, 13, 2, -0.2);
      corridor(0.82, 0.82, 0.50, 0.62, 11, 2, 0.16);
      chamber(0.50, 0.58, 22, 16, 1, 0.15);
      corridor(0.50, 0.58, 0.72, 0.32, 10, 2, -0.14);
      chamber(0.74, 0.28, 19, 13, 2, -0.2);
      corridor(0.74, 0.28, 0.22, 0.24, 10.5, 3, -0.10);
      chamber(0.20, 0.24, 22, 15, 4, 0.25);
      chamber(0.18, 0.74, 15, 12, 3, -0.3);
      chasm(0.36, 0.48, 0.64, 0.68, 4.4, 1);
    },
    trails: [
      [[0.82, 0.82], [0.50, 0.58], [0.74, 0.28], [0.20, 0.24]],
    ],
    bridges: [
      [0.44, 0.56, 0.56, 0.60],
    ],
    glides: [
      [0.20, 0.25, 0.16, 0.50, 0.18, 0.70],
      [0.20, 0.74, 0.48, 0.82, 0.78, 0.82],
    ],
    checkpoints: [
      [0.82, 0.80, '東南落櫻南堤'],
      [0.50, 0.58, '中央朱紅拱橋'],
      [0.74, 0.28, '九曲竹林茶屋'],
      [0.20, 0.25, '巨櫻鳥居山頂'],
    ],
    camps: [
      [0.66, 0.74], [0.62, 0.44], [0.50, 0.28],
      [0.34, 0.24], [0.42, 0.62], [0.74, 0.34],
    ],
    pois: [
      { x: 0.84, y: 0.84, k: 'exit', dir: 'south', t: '南堤←海風港鎮' },
      { x: 0.19, y: 0.22, k: 'dungeon', dir: 'north', landmark: 'sakura_shrine', t: '⛩ 巨櫻山頂·水宮' },
      { x: 0.50, y: 0.53, k: 'boss', landmark: 'sakura_bridge', t: '🌉 大弧朱紅橋戰場' },
      { x: 0.18, y: 0.74, k: 'secret', landmark: 'sea_torii_island', t: '🏯 海上鳥居孤島' },
      { x: 0.75, y: 0.26, k: 'secret', landmark: 'tea_house', t: '🎋 九曲竹林茶屋' },
    ],
  },

  // ========= #11 蒼穹巨環谷（② 狹長流暢線性型 火車風洞峽谷）=========
  11: {
    id: 11,
    seed: 1121,
    family: 'linear',
    name: '蒼穹巨環谷',
    planSize: '620×620',
    obsCount: 13,
    shallowKind: 'alpine_lake',
    shallowColor: 0x45bae2,
    bridgeStyle: 'wood',
    sculpt({ chamber, corridor }) {
      chamber(0.14, 0.82, 18, 13, 2, -0.2);
      corridor(0.14, 0.82, 0.28, 0.44, 11, 2, -0.12);
      chamber(0.28, 0.44, 18, 13, 3, 0.25);
      corridor(0.28, 0.44, 0.56, 0.34, 12, 2, -0.08);
      chamber(0.56, 0.34, 21, 15, 2, -0.2);
      corridor(0.56, 0.34, 0.84, 0.22, 11, 3, -0.08);
      chamber(0.84, 0.22, 22, 16, 4, 0.2);
      corridor(0.56, 0.34, 0.80, 0.68, 9.5, 2, 0.14);
      chamber(0.82, 0.70, 20, 14, 1, -0.2);
    },
    trails: [
      [[0.14, 0.82], [0.28, 0.44], [0.56, 0.34], [0.84, 0.22]],
      [[0.56, 0.34], [0.82, 0.70]],
    ],
    bridges: [
      [0.25, 0.46, 0.33, 0.42],
    ],
    glides: [
      [0.16, 0.78, 0.24, 0.58, 0.29, 0.44],
      [0.30, 0.42, 0.46, 0.36, 0.56, 0.34],
      [0.84, 0.24, 0.86, 0.46, 0.82, 0.66],
    ],
    checkpoints: [
      [0.15, 0.80, '南谷風洞入口'],
      [0.28, 0.44, '峽谷火車棧橋'],
      [0.56, 0.34, '斜嵌巨環盆地'],
      [0.82, 0.70, '雪峰湖畔露營'],
    ],
    camps: [
      [0.22, 0.64], [0.42, 0.38], [0.70, 0.28],
      [0.70, 0.50], [0.82, 0.62], [0.36, 0.42],
    ],
    pois: [
      { x: 0.14, y: 0.84, k: 'exit', dir: 'south', t: '南谷←海風港鎮' },
      { x: 0.85, y: 0.19, k: 'dungeon', dir: 'north', landmark: 'sky_sanctum', t: '⛩ 雪峰·天環聖殿' },
      { x: 0.28, y: 0.42, k: 'secret', landmark: 'canyon_train', t: '🚂 峽谷蒸汽火車橋' },
      { x: 0.56, y: 0.34, k: 'boss', landmark: 'mega_sky_ring', t: '🌀 斜嵌巨環·守護獸' },
      { x: 0.82, y: 0.72, k: 'secret', landmark: 'alpine_camp', t: '⛺ 雪峰湖畔露營' },
    ],
  },

  // ========= #12 紅楓工坊谷（① 大空曠原野型 終局秋楓高原）=========
  12: {
    id: 12,
    seed: 1225,
    family: 'open',
    name: '紅楓工坊谷',
    planSize: '640×640',
    obsCount: 11,
    shallowKind: 'hot_spring',
    shallowColor: 0x48bed8,
    bridgeStyle: 'wood',
    sculpt({ chamber, chasm }) {
      chamber(0.50, 0.54, 84, 52, 2, 0.10, 0.34);
      chamber(0.22, 0.78, 36, 24, 2, -0.25, 0.30);
      chamber(0.24, 0.26, 30, 22, 1, 0.20, 0.30);
      chamber(0.66, 0.48, 34, 26, 3, -0.20, 0.22);
      chamber(0.84, 0.22, 26, 18, 4, -0.20, 0.30);
      chasm(0.84, 0.44, 0.88, 0.78, 4.0, 0, 0.12);
    },
    trails: [
      [[0.24, 0.84], [0.50, 0.54], [0.84, 0.22]],
      [[0.24, 0.84], [0.24, 0.26], [0.66, 0.48]],
    ],
    bridges: [
      [0.36, 0.34, 0.42, 0.38],
    ],
    glides: [
      [0.84, 0.22, 0.54, 0.16, 0.26, 0.26],
      [0.66, 0.46, 0.44, 0.66, 0.22, 0.78],
    ],
    checkpoints: [
      [0.22, 0.80, '紅穀倉綿羊牧場'],
      [0.24, 0.26, '三疊秋楓溫泉'],
      [0.66, 0.48, '紅楓鍛造廣場'],
    ],
    camps: [
      [0.38, 0.76], [0.54, 0.72], [0.72, 0.68], [0.46, 0.52],
      [0.64, 0.48], [0.48, 0.32], [0.72, 0.32], [0.32, 0.54],
    ],
    pois: [
      { x: 0.22, y: 0.86, k: 'exit', dir: 'south', t: '南道←海風港鎮' },
      { x: 0.84, y: 0.20, k: 'dungeon', dir: 'north', landmark: 'maple_foundry', t: '⛩ 紅楓鍛造爐' },
      { x: 0.24, y: 0.25, k: 'secret', landmark: 'maple_onsen', t: '♨ 三疊秋楓溫泉' },
      { x: 0.16, y: 0.74, k: 'secret', landmark: 'sheep_barn', t: '🐑 風車穀倉牧場' },
      { x: 0.66, y: 0.48, k: 'boss', landmark: 'forge_plaza', t: '👑 巨像鍛造廣場' },
      { x: 0.76, y: 0.74, k: 'secret', landmark: 'lava_channel', t: '🔥 熔渠遺產碑' },
    ],
  },
};
