// Dev Tuner 的「美術風格」模組：後製調色、描邊、色階、光影、霧/Bloom、水面、植被、角色比例、UI 主題、群系色盤與內建風格預設。
// 所有預設值＝目前畫面（不開面板時行為完全不變）。由 dev_tuner.js 呼叫，不會在公開版載入（debugger.js 的 devAllowed 擋住）。
import * as THREE from 'three';
import { BIOMES } from './util.js';
import { artTune, setToonRamp, toonGradient } from './world.js';
import { getToonGrad } from './char_rig.js';

export const ART_GROUPS = [
  ['art-grade', '🎨 調色：色相 / 對比 / 色調 / 陰影高光', true],
  ['art-edge', '✏️ 描邊 · 色階 · 邊緣光', false],
  ['art-light', '☀️ 光影 · 雲影 · 光柱', false],
  ['art-fog', '🌫 霧 · Bloom · 暈影 · 顆粒 · 濾鏡', false],
  ['art-water', '🌊 水面 shader', false],
  ['art-foliage', '🌿 植被：搖擺 / 密度 / 大小', false],
  ['art-char', '🧒 角色比例', false],
  ['art-ui', '🪟 UI 主題', false],
];

// ───────────── 工具 ─────────────
export const hexToVec = h => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const clamp01 = x => Math.max(0, Math.min(1, x));
export const vecToHex = v => '#' + [v.x ?? v[0], v.y ?? v[1], v.z ?? v[2]].map(c => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')).join('');
const intToHex = n => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
const hexToInt = h => parseInt(String(h).replace('#', ''), 16) || 0;

// 群系色盤可調欄位。kind: hex（0xRRGGBB 整數）| arr01（0–1 浮點 RGB 陣列）| list（陣列內第 i 個 hex）| num | gradeN（grade[i]）
// live：改了立刻看得到；其餘為建場景時烘進頂點色，需要「重建場景」。
export const PAL_PROPS = [
  { key: 'grass', label: '草地主色', kind: 'hex' }, { key: 'grassLight', label: '草地亮面', kind: 'hex' }, { key: 'grassDark', label: '草地暗面', kind: 'hex' },
  { key: 'plateau', label: '高台草色', kind: 'hex' }, { key: 'sand', label: '沙灘', kind: 'hex' }, { key: 'dirt', label: '泥土 / 路', kind: 'hex' },
  { key: 'rock', label: '岩石', kind: 'hex' }, { key: 'trunk', label: '樹幹', kind: 'hex' },
  { key: 'pine0', label: '樹冠色 1', kind: 'list', list: 'pine', i: 0 }, { key: 'pine1', label: '樹冠色 2', kind: 'list', list: 'pine', i: 1 },
  { key: 'leaf0', label: '闊葉色 1', kind: 'list', list: 'leaf', i: 0 }, { key: 'leaf1', label: '闊葉色 2', kind: 'list', list: 'leaf', i: 1 },
  { key: 'sky', label: '天空（半球光上色）', kind: 'hex', live: true }, { key: 'ground', label: '地面反光（半球光下色）', kind: 'hex', live: true },
  { key: 'sun', label: '太陽光色', kind: 'hex', live: true },
  { key: 'waterDeep', label: '水 · 深', kind: 'arr01', live: true }, { key: 'waterShallow', label: '水 · 淺', kind: 'arr01', live: true }, { key: 'waterLine', label: '水 · 線條', kind: 'arr01', live: true },
  { key: 'fog', label: '霧色', kind: 'arr01' },
  { key: 'shaft', label: '光柱色', kind: 'arr01', live: true },
  { key: 'ambient', label: '環境光強度', kind: 'num', min: 0, max: 2, step: 0.01, live: true },
  { key: 'sunI', label: '日光強度', kind: 'num', min: 0, max: 2.5, step: 0.01, live: true },
  { key: 'grade0', label: '色調 R（此群系）', kind: 'gradeN', i: 0, min: 0.6, max: 1.4, step: 0.005, live: true },
  { key: 'grade1', label: '色調 G（此群系）', kind: 'gradeN', i: 1, min: 0.6, max: 1.4, step: 0.005, live: true },
  { key: 'grade2', label: '色調 B（此群系）', kind: 'gradeN', i: 2, min: 0.6, max: 1.4, step: 0.005, live: true },
];
const palType = p => (p.kind === 'num' || p.kind === 'gradeN') ? 'num' : 'color';
export function palGet(b, p) {
  switch (p.kind) {
    case 'hex': return intToHex(b[p.key]);
    case 'arr01': return vecToHex(b[p.key]);
    case 'list': return intToHex(b[p.list][p.i]);
    case 'num': return b[p.key];
    case 'gradeN': return b.grade[p.i];
  }
}
function palSet(b, p, v) {
  switch (p.kind) {
    case 'hex': b[p.key] = hexToInt(v); break;
    case 'arr01': b[p.key] = hexToVec(v); break;
    case 'list': b[p.list] = b[p.list].slice(); b[p.list][p.i] = hexToInt(v); break;
    case 'num': b[p.key] = Number(v); break;
    case 'gradeN': b.grade = b.grade.slice(); b.grade[p.i] = Number(v); break;
  }
}
const palTop = p => (p.kind === 'list' ? p.list : p.kind === 'gradeN' ? 'grade' : p.key);

// ───────────── 內建風格預設 ─────────────
// previous：現行畫面（全部還原預設）。reference：依 docs/09 美術差距清單 + reference/batch5 的方向調整（清爽、暖黃綠主光、藍紫柔影、單一飽和青水面、大頭角色、奶油圓角 UI）。
export const BUILTIN_PRESETS = {
  '現行（改前）': { values: {}, note: '全部還原為目前遊戲畫面' },
  '新參考（batch5 方向）': {
    note: '依 09 差距清單：去紅橘暈邊、藍紫柔影、青色水面＋稀疏白短橫線、大頭角色、奶油圓角 UI',
    values: {
      'render.sat': 1.2, 'art.vig': 0.06, 'art.contrast': 1.05, 'art.tint': '#fff9ee',
      'art.splitStr': 0.6, 'art.shadowTint': '#c9d3ff', 'art.highTint': '#fff1cc',
      'art.edgeStr': 0.6, 'art.edgeColor': '#8d9cbd', 'art.rimStr': 0.22, 'art.steps': 7,
      'art.shadowSoft': 3, 'art.shadowStr': 0.8, 'art.cloudColor': '#9fb8f2',
      'art.bloomStr': 0.14, 'art.bloomThr': 0.78,
      'art.contour': 0.22, 'art.caustic': 0.2, 'art.sparkle': 0.08, 'art.dash': 0.7, 'art.foamW': 1.3,
      'art.headScale': 1.22, 'art.bodyScale': 1.08,
      'art.uiRadius': 10, 'art.uiPaper': '#fff2d6', 'art.uiPaper2': '#f6e2bd',
      'pal.all.waterDeep': '#27a9c4', 'pal.all.waterShallow': '#52d3d8', 'pal.all.waterLine': '#e2fcff',
      'pal.all.sun': '#fff0c8',
    },
  },
};

// ───────────── 建立模組 ─────────────
export function createArt(game, dt, hooks) {
  const U = () => game.pipe?.postMat?.uniforms;
  const WU = () => game.world?.waterMat?.uniforms;
  const params = [];
  const P = p => { params.push(p); return p; };
  dt.fog = dt.fog || { on: false, color: '#ebf5ff', near: 40, far: 118 };
  dt.charT = dt.charT || { head: 1, body: 1 };
  const rebuildMark = () => hooks.markRebuild();

  const rangeU = (id, group, label, min, max, step, uni, extra = {}) => P({ id, group, label, type: 'range', min, max, step, get: () => U()?.[uni].value ?? 0, set: x => { if (U()) U()[uni].value = x; }, ...extra });
  const colorU = (id, group, label, uni) => P({ id, group, label, type: 'color', get: () => (U() ? vecToHex(U()[uni].value) : '#ffffff'), set: x => { U()?.[uni].value.set(...hexToVec(x)); } });
  const rangeW = (id, label, min, max, step, uni, def) => P({ id, group: 'art-water', label, type: 'range', min, max, step, get: () => WU()?.[uni]?.value ?? def, set: x => { const u = WU(); if (u?.[uni]) u[uni].value = x; } });

  // 調色
  rangeU('art.hueDeg', 'art-grade', '色相旋轉（°）', -180, 180, 1, 'uHue', {});
  const hue = params[params.length - 1];
  hue.get = () => Math.round((U()?.uHue.value ?? 0) * 180 / Math.PI); hue.set = x => { if (U()) U().uHue.value = x * Math.PI / 180; };
  P({ id: 'render.sat', group: 'art-grade', label: '色彩飽和度', type: 'range', min: 0, max: 2.5, step: 0.01, get: () => U()?.uSat.value ?? 1.13, set: x => { if (U()) U().uSat.value = x; } });
  rangeU('art.contrast', 'art-grade', '對比', 0.5, 1.8, 0.01, 'uContrast');
  rangeU('art.bright', 'art-grade', '亮度 ×', 0.5, 1.6, 0.01, 'uBright');
  colorU('art.tint', 'art-grade', '整體色調（相乘）', 'uTint');
  rangeU('art.splitStr', 'art-grade', '陰影／高光分色強度', 0, 1, 0.01, 'uSplit');
  colorU('art.shadowTint', 'art-grade', '陰影色（相乘；藍紫＝柔影）', 'uShadowTint');
  colorU('art.highTint', 'art-grade', '高光色（相乘；暖黃＝日照）', 'uHighTint');

  // 描邊 / 色階 / 邊緣光
  rangeU('art.edgeStr', 'art-edge', '描邊強度', 0, 1, 0.01, 'uEdgeStr');
  rangeU('art.edgeThick', 'art-edge', '描邊粗細（像素倍率）', 0.5, 3, 0.05, 'uEdgeThick');
  rangeU('art.edgeSens', 'art-edge', '描邊敏感度（越高線越多）', 0.2, 5, 0.05, 'uEdgeSens');
  colorU('art.edgeColor', 'art-edge', '描邊色（相乘於原色；白＝無）', 'uOutline');
  rangeU('art.crease', 'art-edge', '折痕提亮', 0, 1.5, 0.01, 'uCrease');
  rangeU('art.steps', 'art-edge', '後製明度階數（9＝現況）', 2, 32, 1, 'uSteps');
  rangeU('art.stepMix', 'art-edge', '明度量化混合（0＝平滑，1＝平塗）', 0, 1, 0.01, 'uStepMix');
  rangeU('art.rimStr', 'art-edge', '邊緣光強度', 0, 1.5, 0.01, 'uRimStr');
  rangeU('art.rimPow', 'art-edge', '邊緣光集中度', 0.5, 8, 0.1, 'uRimPow');
  colorU('art.rimColor', 'art-edge', '邊緣光顏色', 'uRimCol');
  const ramp = (i, label) => P({ id: 'art.ramp' + i, group: 'art-edge', label, type: 'range', min: 0, max: 255, step: 1, get: () => toonGradient().image.data[i], set: x => { const d = Array.from(toonGradient().image.data); d[i] = x; setToonRamp(d); } });
  ramp(0, '場景 toon 色階 1（最暗）'); ramp(1, '場景 toon 色階 2'); ramp(2, '場景 toon 色階 3'); ramp(3, '場景 toon 色階 4（最亮）');
  const cramp = (i, label) => P({ id: 'art.cramp' + i, group: 'art-edge', label, type: 'range', min: 0, max: 255, step: 1, get: () => getToonGrad().image.data[i * 4], set: x => { const t = getToonGrad(); t.image.data[i * 4] = t.image.data[i * 4 + 1] = t.image.data[i * 4 + 2] = Math.round(x); t.needsUpdate = true; } });
  cramp(0, '角色 toon 色階 1（暗）'); cramp(1, '角色 toon 色階 2'); cramp(2, '角色 toon 色階 3（亮）');

  // 光影
  P({ id: 'light.sunMul', group: 'art-light', label: '太陽強度 ×', type: 'range', min: 0, max: 3, step: 0.01, get: () => dt.sunMul, set: x => { dt.sunMul = x; } });
  P({ id: 'light.hemiMul', group: 'art-light', label: '環境光強度 ×', type: 'range', min: 0, max: 3, step: 0.01, get: () => dt.hemiMul, set: x => { dt.hemiMul = x; } });
  P({ id: 'light.shadows', group: 'art-light', label: '即時陰影', type: 'toggle', get: () => !!game.sun?.castShadow, set: x => { if (game.sun) game.sun.castShadow = x; } });
  P({ id: 'art.shadowSoft', group: 'art-light', label: '陰影柔邊（blur 半徑）', type: 'range', min: 0, max: 12, step: 0.1, get: () => game.sun?.shadow.radius ?? 1, set: x => { if (game.sun) game.sun.shadow.radius = x; } });
  P({ id: 'art.shadowStr', group: 'art-light', label: '陰影濃度', type: 'range', min: 0, max: 1, step: 0.01, get: () => game.sun?.shadow.intensity ?? 1, set: x => { if (game.sun) game.sun.shadow.intensity = x; } });
  rangeU('render.cloud', 'art-light', '雲影濃度', 0, 1.5, 0.01, 'uCloud');
  colorU('art.cloudColor', 'art-light', '雲影顏色（相乘）', 'uCloudCol');
  P({ id: 'render.shafts', group: 'art-light', label: '光柱強度', type: 'range', min: 0, max: 4, step: 0.05, get: () => U()?.uShaftK.value ?? 1, set: x => { if (U()) U().uShaftK.value = x; } });

  // 霧 / Bloom / 暈影 / 顆粒 / 濾鏡
  const applyFog = () => {
    const f = dt.fog, sc = game.scene; if (!sc) return;
    if (f.on) {
      if (!sc.fog || !dt._fogOwn) { dt._fogPrev = sc.fog; dt._fogOwn = true; sc.fog = new THREE.Fog(0, f.near, f.far); }
      sc.fog.color.set(...hexToVec(f.color)); sc.fog.color.setRGB(...hexToVec(f.color)); sc.fog.near = f.near; sc.fog.far = f.far;
    } else if (dt._fogOwn) { sc.fog = dt._fogPrev || null; dt._fogOwn = false; }
  };
  P({ id: 'art.fogOn', group: 'art-fog', label: '強制霧（覆蓋此區原本的霧）', type: 'toggle', get: () => dt.fog.on, set: x => { dt.fog.on = x; applyFog(); } });
  P({ id: 'art.fogColor', group: 'art-fog', label: '霧色', type: 'color', get: () => dt.fog.color, set: x => { dt.fog.color = x; applyFog(); } });
  P({ id: 'art.fogNear', group: 'art-fog', label: '霧起點（越小越濃）', type: 'range', min: 0, max: 200, step: 1, get: () => dt.fog.near, set: x => { dt.fog.near = x; applyFog(); } });
  P({ id: 'art.fogFar', group: 'art-fog', label: '霧終點', type: 'range', min: 10, max: 400, step: 1, get: () => dt.fog.far, set: x => { dt.fog.far = x; applyFog(); } });
  rangeU('art.bloomStr', 'art-fog', 'Bloom 強度', 0, 1.5, 0.01, 'uBloom');
  rangeU('art.bloomThr', 'art-fog', 'Bloom 門檻', 0.2, 1, 0.01, 'uBloomThr');
  rangeU('art.bloomRad', 'art-fog', 'Bloom 半徑（像素）', 1, 12, 0.5, 'uBloomRad');
  rangeU('art.vig', 'art-fog', '暈影強度（0.22＝現況）', 0, 1.2, 0.01, 'uVig');
  rangeU('art.grain', 'art-fog', '膠片顆粒', 0, 0.3, 0.005, 'uGrain');
  P({ id: 'render.pixel', group: 'art-fog', label: '像素倍率（1＝高清，2+＝低解析像素）', type: 'range', min: 1, max: 6, step: 1, get: () => game.pipe?.pixelScale ?? 2, set: x => { if (game.pipe && game.pipe.pixelScale !== x) { game.pipe.setPixelScale(x); applyFilter(); } } });
  const applyFilter = () => {
    const p = game.pipe; if (!p?.rt) return;
    const smooth = !!dt.smooth, f = smooth ? THREE.LinearFilter : (p.pixelScale <= 1 ? THREE.LinearFilter : THREE.NearestFilter);
    p.rt.texture.minFilter = p.rt.texture.magFilter = f; p.rt.texture.needsUpdate = true;
    p.renderer.domElement.style.imageRendering = smooth || p.pixelScale <= 1 ? 'auto' : 'pixelated';
  };
  P({ id: 'art.smooth', group: 'art-fog', label: '貼圖/放大濾鏡：平滑（關＝最近鄰像素感）', type: 'toggle', get: () => !!dt.smooth, set: x => { dt.smooth = x; applyFilter(); } });

  // 水面
  rangeW('art.foam', '岸邊泡沫強度', 0, 1.5, 0.01, 'uFoam', 1);
  rangeW('art.foamW', '泡沫寬度', 0.3, 3, 0.01, 'uFoamW', 1);
  rangeW('art.waveSpd', '浪線速度', 0, 4, 0.05, 'uWaveSpd', 1);
  rangeW('art.contour', '漩渦等高線強度', 0, 1, 0.01, 'uContour', 0.55);
  rangeW('art.contourScale', '漩渦等高線尺度', 0.04, 0.5, 0.005, 'uContourScale', 0.16);
  rangeW('art.caustic', '淺水焦散網強度', 0, 1, 0.01, 'uCaustic', 0.55);
  rangeW('art.sparkle', '星點閃爍', 0, 1, 0.01, 'uSparkle', 0.28);
  rangeW('art.dash', '白色短橫線（參考圖風格）', 0, 1, 0.01, 'uDash', 0);
  rangeW('art.band1', '淺→中色帶距離（m）', 0.2, 6, 0.05, 'uBand1', 1.3);
  rangeW('art.band2', '中→深色帶距離（m）', 1, 12, 0.05, 'uBand2', 3.6);
  P({ id: 'art.waterAlpha', group: 'art-water', label: '水面透明度', type: 'range', min: 0.2, max: 1, step: 0.01, get: () => WU()?.uAlpha?.value ?? 1, set: x => { const m = game.world?.waterMat; if (m) { m.uniforms.uAlpha.value = x; m.transparent = x < 0.999; m.needsUpdate = true; } } });

  // 植被
  P({ id: 'render.wind', group: 'art-foliage', label: '搖擺強度（風）', type: 'range', min: 0, max: 4, step: 0.05, get: () => hooks.windU.uWindStr.value, set: x => { hooks.windU.uWindStr.value = x; } });
  P({ id: 'art.foliageSize', group: 'art-foliage', label: '植被大小 ×（需重建場景）', type: 'range', min: 0.3, max: 2, step: 0.01, get: () => artTune.foliageSize, set: x => { artTune.foliageSize = x; rebuildMark(); } });
  P({ id: 'art.foliageDensity', group: 'art-foliage', label: '植被密度（只能減；需重建場景）', type: 'range', min: 0, max: 1, step: 0.01, get: () => artTune.foliageDensity, set: x => { artTune.foliageDensity = x; rebuildMark(); } });

  // 角色（GLB 骨架：頭骨 / 整體縮放）
  const rigs = () => [game.player?.heroRig, ...[...(game.remotes?.values?.() || [])].map(r => r.heroRig)].filter(r => r?.root);
  const headBone = rig => { if (rig._dtHead === undefined) { rig._dtHead = null; rig.root.traverse(o => { if (o.isBone && /^head/i.test(o.name) && !rig._dtHead) rig._dtHead = o; }); } return rig._dtHead; };
  function applyChar() {
    for (const rig of rigs()) {
      if (rig._dtBase === undefined) rig._dtBase = rig.root.scale.x;
      rig.root.scale.setScalar(rig._dtBase * dt.charT.body);
      headBone(rig)?.scale.setScalar(dt.charT.head);
    }
  }
  P({ id: 'art.headScale', group: 'art-char', label: '頭部大小 ×（大頭風）', type: 'range', min: 0.6, max: 2, step: 0.01, get: () => dt.charT.head, set: x => { dt.charT.head = x; applyChar(); } });
  P({ id: 'art.bodyScale', group: 'art-char', label: '角色整體大小 ×', type: 'range', min: 0.6, max: 1.8, step: 0.01, get: () => dt.charT.body, set: x => { dt.charT.body = x; applyChar(); } });

  // UI 主題
  const root = document.documentElement;
  const cssVar = name => (getComputedStyle(root).getPropertyValue(name).trim() || '#fff8e4');
  const hex6 = v => { const h = String(v).trim(); return /^#[0-9a-f]{6}$/i.test(h) ? h : /^#[0-9a-f]{3}$/i.test(h) ? '#' + [...h.slice(1)].map(c => c + c).join('') : '#fff8e4'; };
  const uiColor = (id, label, name, fb) => P({ id, group: 'art-ui', label, type: 'color', get: () => hex6(dt.ui?.[name] ?? (cssVar(name) || fb)), set: x => { dt.ui = { ...(dt.ui || {}), [name]: x }; root.style.setProperty(name, x); } });
  uiColor('art.uiPaper', '面板底色 --paper', '--paper'); uiColor('art.uiPaper2', '次面板色 --paper2', '--paper2'); uiColor('art.uiInk', '文字 / 邊框色 --ink', '--ink'); uiColor('art.uiGold', '強調金色 --gold', '--gold'); uiColor('art.uiAccent', '強調紅橘 --accent', '--accent');
  let uiStyle = null;
  const ensureUiStyle = () => uiStyle || (uiStyle = Object.assign(document.head.appendChild(document.createElement('style')), { id: 'dtUiStyle' }));
  P({ id: 'art.uiRadius', group: 'art-ui', label: '面板圓角（px；0＝像素直角）', type: 'range', min: 0, max: 24, step: 1, get: () => dt.uiRadius || 0, set: x => { dt.uiRadius = x; ensureUiStyle().textContent = x > 0 ? `.panel,.card,.btn,.exitHint,.sk,.mute,#chatIn,.pbub,.scales button,.slot,.chip,.cx-box,.toast{border-radius:${x}px!important}` : ''; } });
  P({ id: 'art.uiFont', group: 'art-ui', label: '字體大小 ×', type: 'range', min: 0.8, max: 1.6, step: 0.01, get: () => dt.uiFont || 1, set: x => { dt.uiFont = x; root.style.setProperty('--ui-type-body', 14 * x + 'px'); root.style.setProperty('--ui-type-detail', 12 * x + 'px'); } });

  // ───────────── 群系色盤 ─────────────
  const orig = BIOMES.map(b => JSON.parse(JSON.stringify(b)));
  dt.pal = dt.pal || { all: {}, by: {} };
  const effective = i => {
    const out = JSON.parse(JSON.stringify(orig[i])), key = orig[i].key;
    for (const p of PAL_PROPS) {
      const v = dt.pal.by[key]?.[p.key] ?? dt.pal.all[p.key];
      if (v !== undefined) palSet(out, p, v);
    }
    return out;
  };
  const palTouchedFor = key => PAL_PROPS.filter(p => (dt.pal.by[key]?.[p.key] ?? dt.pal.all[p.key]) !== undefined);
  function syncLive() {
    const cur = game.biome; if (!cur) return;
    const idx = BIOMES.findIndex(b => b.key === cur.key); if (idx < 0) return;
    const eff = BIOMES[idx];
    const now = palTouchedFor(cur.key), nowKeys = new Set(now.map(p => p.key));
    const touched = [...new Map([...(dt._palPrev || []), ...now].map(p => [p.key, p])).values()]; // 剛清除的項目也要同步回原值
    dt._palPrev = now;
    let needRebuild = false;
    for (const p of touched) {
      const top = palTop(p);
      cur[top] = JSON.parse(JSON.stringify(eff[top]));
      if (!p.live) needRebuild = true;
    }
    if (touched.length) {
      if (touched.some(p => p.key === 'sun')) game.sun?.color.setRGB(...hexToVec(intToHex(eff.sun)));
      if (touched.some(p => p.key === 'sky')) game.hemi?.color.setRGB(...hexToVec(intToHex(eff.sky)));
      if (touched.some(p => p.key === 'ground')) game.hemi?.groundColor.setRGB(...hexToVec(intToHex(eff.ground)));
      if (touched.some(p => p.key === 'shaft') && U()) U().uShaft.value.set(...eff.shaft);
      const w = WU();
      if (w) { w.uDeep.value.set(...eff.waterDeep); w.uShallow.value.set(...eff.waterShallow); w.uLine.value.set(...eff.waterLine); }
    }
    return needRebuild;
  }
  function applyPalette() {
    BIOMES.forEach((b, i) => { const e = effective(i); for (const k of Object.keys(e)) b[k] = e[k]; });
    return syncLive();
  }
  function setPal(scope, key, val) {
    const p = PAL_PROPS.find(x => x.key === key); if (!p) return false;
    if (scope === 'all') dt.pal.all[key] = val; else (dt.pal.by[scope] = dt.pal.by[scope] || {})[key] = val;
    const needRebuild = applyPalette();
    if (!p.live || needRebuild) rebuildMark();
    return true;
  }
  function clearPal(scope, key) {
    if (scope === 'all') delete dt.pal.all[key]; else if (dt.pal.by[scope]) delete dt.pal.by[scope][key];
    applyPalette(); const p = PAL_PROPS.find(x => x.key === key); if (p && !p.live) rebuildMark();
  }
  function clearAllPal() { const had = Object.keys(dt.pal.all).length || Object.values(dt.pal.by).some(m => Object.keys(m).length); dt.pal = { all: {}, by: {} }; applyPalette(); if (had) rebuildMark(); }
  /** 顯示用：此 scope 目前有效值（scope all 顯示「目前所在群系」的值）。 */
  function palShow(scope, p) {
    const key = scope === 'all' ? (game.biome?.key || BIOMES[0].key) : scope;
    const i = Math.max(0, BIOMES.findIndex(b => b.key === key));
    return palGet(BIOMES[i], p);
  }
  const palOverridden = (scope, key) => (scope === 'all' ? dt.pal.all[key] : dt.pal.by[scope]?.[key]) !== undefined;

  return {
    params, PAL_PROPS, palType, palShow, palOverridden, setPal, clearPal, clearAllPal, applyPalette,
    palValues: () => { const o = {}; for (const [k, v] of Object.entries(dt.pal.all)) o[`pal.all.${k}`] = v; for (const [b, m] of Object.entries(dt.pal.by)) for (const [k, v] of Object.entries(m)) o[`pal.${b}.${k}`] = v; return o; },
    applyChar, applyFilter,
    biomes: () => BIOMES.map(b => ({ key: b.key, name: b.name })),
  };
}
