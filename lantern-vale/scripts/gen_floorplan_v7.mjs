#!/usr/bin/env node
// 生成獨立互動總藍圖：docs/field_maps_floorplan_v7.html（完全不覆寫受保護的 docs/field_maps_floorplan.html）
// 直接由 src/field_blueprints.js + src/frontier.js + src/util.js + src/terrain_fx.js 1:1 輸出 20 張地圖資料

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD_BLUEPRINTS, getBlueprintGrid, BP_W, BP_H } from '../src/field_blueprints.js';
import { FIELDS } from '../src/frontier.js';
import { BIOMES } from '../src/util.js';
import { FAMILY_META, TERRAIN_EFFECTS, REALM_RULES } from '../src/terrain_fx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../docs/field_maps_floorplan_v7.html');

// Phase 4B 預計進駐 #13–#20 的新 6 套 scenes02 資產包大型 GLB 奇觀配置規劃
const PHASE4B_LANDMARKS = {
  13: [
    { x: 0.28, y: 0.34, label: '🌴 綠洲棕櫚神泉', asset: '4351 POLY - Egypt (Oasis Palms + House01b)' },
    { x: 0.78, y: 0.68, label: '🏛️ 紅砂岩神殿哨塔', asset: '4351 POLY - Egypt (Temple Gate + Statues)' },
    { x: 0.50, y: 0.20, label: '⛩ 風沙法老神龕', asset: '4351 POLY - Egypt (Sarcophagus + Obelisk)' },
  ],
  14: [
    { x: 0.50, y: 0.48, label: '🔺 巨型太陽金字塔', asset: '4351 POLY - Egypt (Great Pyramid + Sphinx)' },
    { x: 0.20, y: 0.50, label: '🗿 獅身神像西廊', asset: '4351 POLY - Egypt (Statue02 / Statue05)' },
    { x: 0.80, y: 0.50, label: '⚰️ 紅砂石棺東庭', asset: '4351 POLY - Egypt (Sarcophagus01 + Pillars)' },
  ],
  15: [
    { x: 0.50, y: 0.52, label: '🏛️ 失落藤蔓古神廟', asset: '4352 POLY - Jungle (Building01 + Vine Ruin)' },
    { x: 0.36, y: 0.66, label: '🪨 高架石磚空中棧道', asset: '4118 The Lost Lands (Stonewalk + Liana)' },
    { x: 0.80, y: 0.22, label: '🗿 叢林高塔秘壇', asset: '4352 POLY - Jungle (TreePalmLarge + Temple Tower)' },
  ],
  16: [
    { x: 0.50, y: 0.50, label: '🔔 哥德月光鐘樓禮拜堂', asset: '4384 Polyworks (GothicPalace / Graveyard Chapel)' },
    { x: 0.22, y: 0.78, label: '🪦 鐵柵守墓門樓', asset: '4384 Polyworks (Graves + Iron Fences)' },
    { x: 0.78, y: 0.24, label: '☠️ 暗黑骸骨祭壇', asset: '4384 Polyworks (Dark Fantasy + Bones)' },
  ],
  17: [
    { x: 0.50, y: 0.20, label: '🏰 深淵哥德古堡主殿', asset: '4384 Polyworks (GothicPalace Keep + Spires)' },
    { x: 0.46, y: 0.62, label: '🕯️ 薔薇中庭石拱門', asset: '4384 Polyworks (GothicDungeon Arches + Braziers)' },
    { x: 0.78, y: 0.48, label: '⚔️ 東塔黑曜尖頂', asset: '4384 Polyworks (Dark Fantasy Spikes + Tower)' },
  ],
  18: [
    { x: 0.54, y: 0.62, label: '🏛️ 亞特蘭提斯海底神殿', asset: '4384 Polyworks (Underwater Temple + Coral)' },
    { x: 0.22, y: 0.76, label: '🍄 巨型螢光海菇群', asset: '4123 Alien Planets Vol2 (Depth_plant + Depth_algue)' },
    { x: 0.46, y: 0.24, label: '🦑 飄浮深海巨蛸聖壇', asset: '4123 Alien Planets Vol2 (Depth Creature + Bubbles)' },
  ],
  19: [
    { x: 0.50, y: 0.50, label: '🚀 白銀星際中央指揮核', asset: '4384 Polyworks (SciFi Command Station + Panels)' },
    { x: 0.22, y: 0.76, label: '🛸 星艦登陸坪與飛艇', asset: '4123 Alien Planets Vol2 (Sky_flyer + SciFi Deck)' },
    { x: 0.78, y: 0.24, label: '⚡ 量子反應爐北閘', asset: '4384 Polyworks (SciFi Walls + Energy Core)' },
  ],
  20: [
    { x: 0.50, y: 0.50, label: '🌌 異星紫晶母巢核心', asset: '4123 Alien Planets Vol2 (Hive_terrain + Hive_Root)' },
    { x: 0.18, y: 0.50, label: '🛸 墜落外星飛艇殘骸', asset: '4123 Alien Planets Vol2 (Sky_flyer + Crystals)' },
    { x: 0.82, y: 0.50, label: '💎 巨型共鳴結晶群', asset: '4384 Polyworks (Crystals + Abstract Spires)' },
  ],
};

// 未來擴充預留席位（#21–#28）：善用現有 scenes02 尚未啟用的主題包，預留星圖槽位與原創物理微規則 Idea
const FUTURE_SLOTS = [
  { id: 21, name: '⚙️ 蒸氣齒輪工業城', layer: 'surface', family: 'linear', asset: '4384 Polyworks (Industrial)', rule: '彈射履帶＆蒸氣氣閥跳台：踩履帶高速衝鋒，氣閥定時把敵我噴上高空。', visual: '黃銅管線、巨型齒輪、蒸氣煙囪與鋼鐵棧道。' },
  { id: 22, name: '🎄 永冬聖誕糖果村', layer: 'surface', family: 'open', asset: '4384 Polyworks (Christmas) ＋ 4291 Food 1', rule: '禮盒驚喜爆破：擊碎巨型禮物盒隨機噴出增益蛋糕或迷你雪人助戰！', visual: '彩燈松樹、巨型禮物堆、拐杖糖與溫暖雪屋。' },
  { id: 23, name: '🏜️ 廢土部落峽谷', layer: 'surface', family: 'ring', asset: '4384 Polyworks (Wasteland / Tribal)', rule: '圖騰狂怒共鳴：點燃部落鼓陣圖騰，全圖攻速與暴擊層層疊加！', visual: '風化赤岩峽谷、部落帳篷、骨刺柵欄與火焰圖騰。' },
  { id: 24, name: '🛹 霓虹滑板奇境', layer: 'sky', family: 'open', asset: '4384 Polyworks (Skatepark)', rule: '半管坡道空中特技：沿 U 型坡起跳疊加連招倍率，落地釋放音浪震波！', visual: '彩色低面滑板U池、欄杆滑軌與塗鴉風格平台。' },
  { id: 25, name: '♟️ 巨型桌遊棋盤國', layer: 'sky', family: 'hybrid', asset: '4384 Polyworks (Boardgame)', rule: '黑白格屬性翻轉：白格傷害 +35%、黑格減傷 +35%，每 10 秒全盤翻轉！', visual: '巨型西洋棋子、骰子高塔、卡牌拱門與棋盤浮島。' },
  { id: 26, name: '🍰 巨食甜點王國', layer: 'sky', family: 'open', asset: '4291 Food 1 (放大 10x 場景化)', rule: '彈力布丁＆巨大化盛宴：踩巨型布丁超高彈跳，吃場上烤雞蛋糕變大撞飛怪群！', visual: '巨大烤雞山、草莓蛋糕塔、甜甜圈拱門與汽水瀑布。' },
  { id: 27, name: '🏮 東方雲頂百鬼城', layer: 'sky', family: 'maze', asset: '4384 Polyworks (Asian Additional)', rule: '朱紅鳥居瞬移陣：穿過成對鳥居瞬間空間摺疊傳送，並留下幻影斬擊！', visual: '多層飛簷寶塔、連綿千本鳥居、竹林與赤紅紙燈籠。' },
  { id: 28, name: '🌀 幾何抽象虛空（第 4 層入口）', layer: 'dream', family: 'ring', asset: '4384 Polyworks (Abstract)', rule: '第四層「🌌 夢境虛空」入口：預留重力翻轉、季節活動島與 30+ 張無限擴張！', visual: '純粹低面幾何漂浮體、霓虹光線與超現實階梯。' },
];

function hexStr(n) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

const mapsData = [];
for (let id = 1; id <= 20; id++) {
  const bp = FIELD_BLUEPRINTS[id];
  const f = FIELDS[id];
  const b = BIOMES[f.biome] || BIOMES[0];
  const grid = getBlueprintGrid(id);
  // RLE 壓縮 260x180 高度網格（檔案體積極小、零依賴瞬間還原）
  const rle = [];
  let cur = grid[0], cnt = 1;
  for (let i = 1; i < grid.length; i++) {
    if (grid[i] === cur) cnt++;
    else { rle.push(cur, cnt); cur = grid[i]; cnt = 1; }
  }
  rle.push(cur, cnt);

  const rule = f.realmRule ? REALM_RULES[f.realmRule] : null;
  const tfx = bp.shallowKind ? TERRAIN_EFFECTS[bp.shallowKind] : null;

  mapsData.push({
    id,
    name: f.name,
    level: `Lv.${f.level}+`,
    layer: f.layer || 'surface',
    isNew: id >= 13,
    family: bp.family,
    familyMeta: FAMILY_META[bp.family],
    planSize: bp.planSize,
    dungeon: f.dungeon,
    beast: f.beast,
    foliageStyle: b.foliageStyle || 'classic',
    palette: {
      void: b.key === 'gothic' ? '#171526' : b.key === 'deep_sea' ? '#0c2638' : b.key === 'scifi' ? '#1a263a' : b.key === 'alien' ? '#241236' : b.key === 'desert' ? '#3d2c1a' : '#12202c',
      shallow: hexStr(bp.shallowColor || 0x4dbbd8),
      l1: hexStr(f.grass ?? b.grass),
      l2: hexStr(b.grassLight),
      l3: hexStr(b.rock),
      wall: hexStr(b.rockDark),
    },
    realmRule: rule ? { icon: rule.icon, name: rule.name, color: rule.color, desc: rule.desc } : null,
    shallowFx: tfx ? { icon: tfx.icon, name: tfx.name, desc: tfx.desc } : null,
    trails: bp.trails || [],
    bridges: bp.bridges || [],
    glides: bp.glides || [],
    checkpoints: bp.checkpoints || [],
    camps: bp.camps || [],
    pois: bp.pois || [],
    phase4bLandmarks: PHASE4B_LANDMARKS[id] || [],
    rle,
  });
}

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>《燈谷行 Lantern Vale》v7 全 20 張三層星燈雲海浮島 · 戰術平面總藍圖</title>
<style>
:root{
  --ink:#2c1e1a; --paper:#fff8e8; --paper2:#f2e4c6;
  --accent:#d9543a; --gold:#e5a928; --muted:#6e5445;
}
*{box-sizing:border-box}
body{margin:0;background:#101218;color:var(--ink);font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;line-height:1.5}
header.hero{background:linear-gradient(135deg,#181a28,#362228,#1a2c38);color:#fff6e2;padding:18px 24px;border-bottom:4px solid #e5a928}
header.hero h1{margin:0 0 6px;font-size:22px;letter-spacing:.03em}
header.hero p{margin:0;color:#ebd8b8;font-size:13px;max-width:1320px}
.toolbar{position:sticky;top:0;z-index:20;background:#1a1b24;color:#fff6e2;padding:9px 22px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;border-bottom:2px solid #4d3830}
.filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.toolbar button{background:#2d262b;color:#fff2d6;border:2px solid #6b4f42;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px}
.toolbar button.on{background:#e5a928;color:#231612;border-color:#fff2d6}
.toolbar button.new-btn.on{background:#46d8ff;color:#0b1c26;border-color:#dff8ff}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11.8px;align-items:center;padding:7px 22px;background:#15161e;color:#dcd4c4;border-bottom:1px solid #322c38}
.leg{display:inline-flex;align-items:center;gap:4px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1.5px solid #111}
.dia{display:inline-block;width:10px;height:10px;transform:rotate(45deg);border:1.5px solid #111}
.wrap{max-width:1660px;margin:0 auto;padding:16px 20px 56px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(750px,1fr));gap:18px}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.map-card{background:var(--paper);border:3px solid #47322a;border-radius:12px;overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,.5);display:flex;flex-direction:column}
.map-card.is-new{border-color:#38c8f0;box-shadow:0 10px 30px rgba(42,188,240,.22)}
.map-card.hide{display:none}
.mc-head{background:#262028;color:#fff6e2;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.map-card.is-new .mc-head{background:linear-gradient(90deg,#1c2a3a,#2d2038)}
.mc-head h2{margin:0;font-size:16.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.badge{font-size:11px;padding:2px 8px;border-radius:99px;font-weight:800;color:#fff}
.badge.soft{background:#4f3c34;color:#fff2d6}
.badge.new{background:#28c4f0;color:#08202c}
.mc-body{display:grid;grid-template-columns:1.42fr 1fr;gap:12px;padding:12px 14px;align-items:start}
@media(max-width:740px){.mc-body{grid-template-columns:1fr}}
.cv-box{background:#0b0d14;border:2px solid #523b32;border-radius:8px;overflow:hidden;position:relative;cursor:zoom-in}
.cv-box canvas{display:block;width:100%;height:auto}
.cv-hint{position:absolute;right:8px;bottom:6px;background:rgba(10,12,18,.84);color:#ffe9a0;font-size:11px;padding:2px 7px;border-radius:4px;pointer-events:none}
.mc-info{font-size:12.2px;display:flex;flex-direction:column;gap:7px}
.mc-tag{background:var(--paper2);border-left:4px solid var(--accent);padding:6px 9px;border-radius:4px}
.mc-tag.rule{border-left-color:#38a8e8;background:#eef8ff}
.mc-tag.glb{border-left-color:#d89220;background:#fff4d4}
.mc-list{margin:4px 0 0;padding-left:16px;display:flex;flex-direction:column;gap:3px}
.mc-foot{padding:7px 14px 9px;border-top:1px dashed #c8b28c;font-size:11.5px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
#modal{position:fixed;inset:0;background:rgba(8,10,16,.92);backdrop-filter:blur(4px);z-index:100;display:none;align-items:center;justify-content:center;padding:16px}
#modal.open{display:flex}
.m-inner{background:var(--paper);border:3px solid #e5a928;border-radius:12px;max-width:1200px;width:96vw;max-height:95vh;overflow:auto;padding:14px}
.m-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px}
.m-top h3{margin:0;font-size:18px}
.m-top button{background:#d9543a;color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:700}
#bigCv{width:100%;height:auto;border-radius:8px;border:2px solid #4a332b;display:block;background:#0b0d14}
</style>
</head>
<body>
<header class="hero">
  <h1>🏮 《燈谷行 Lantern Vale》v7 全 20 張三層星燈雲海浮島 · 戰術平面總藍圖</h1>
  <p>完整保留 v5 原版 12 張地圖（<code>#01–#12</code>）並擴張 <b>8 張截然不同風格的 Phase 4 迷途漂流島（<code>#13–#20</code>）</b>：分佈於 <b>☀️ 中層・燈谷表界（10 張）</b>、<b>🌊 下層・沉淵暗域（5 張）</b> 與 <b>✨ 上層・星穹外境（5 張）</b>。每張俯視圖 1:1 由 <code>src/field_blueprints.js</code> 260×180 高度場生成，並於新 8 圖預先標註 <b>Phase 4B 新增 6 套 scenes02 資產包 GLB 奇觀擺放座標</b>。</p>
</header>

<div class="toolbar">
  <div class="filters" id="layerFilters">
    <button class="on" data-layer="all">全部地圖 (20)</button>
    <button class="new-btn" data-layer="new">🆕 Phase 4 新異界 #13–#20 (8)</button>
    <button data-layer="surface">☀️ 中層 · 燈谷表界 (10)</button>
    <button data-layer="abyss">🌊 下層 · 沉淵暗域 (5)</button>
    <button data-layer="sky">✨ 上層 · 星穹外境 (5)</button>
    <button data-layer="future" style="border-color:#c88cff;color:#f0d8ff">🔮 未來擴充預留 #21–#28 (8)</button>
  </div>
  <div class="filters" id="famFilters">
    <button class="on" data-fam="all">全部拓撲</button>
    <button data-fam="open">🌾 開闊爽刷</button>
    <button data-fam="linear">⚡ 高速線性</button>
    <button data-fam="ring">⭕ 開放環形</button>
    <button data-fam="hybrid">🏝️ 混合跳島</button>
    <button data-fam="maze">🌿 立體迷宮</button>
  </div>
</div>

<div class="legend">
  <span class="leg"><i class="dot" style="background:#38d0ff"></i>🔵 藍光傳送檢查點</span>
  <span class="leg"><i class="dot" style="background:#ff5a4a"></i>🔴 魔物營地</span>
  <span class="leg"><i class="dot" style="background:#ffd85a"></i>👑 區域守護獸</span>
  <span class="leg"><i class="dia" style="background:#ffae28"></i>🏛️ Phase 4B 預計 GLB 奇觀點位</span>
  <span class="leg"><span style="color:#6cf0ff;font-weight:800">- - ▶</span> 單向滑翔氣流捷徑</span>
  <span class="leg"><span style="color:#d4985a;font-weight:800">═══</span> 拱橋跨度</span>
  <span class="leg">💡 點擊任一張平面圖可全螢幕放大審閱</span>
</div>

<div class="wrap">
  <div class="grid" id="grid"></div>
  <section id="futureSec" style="margin-top:34px">
    <h2 style="color:#f0d8ff;margin:0 0 8px;font-size:19px">🔮 未來擴充預留席位（#21–#28 ＋ 第 4 層「夢境虛空」擴充槽）</h2>
    <p style="color:#c8bed8;font-size:13px;margin:0 0 14px">星燈航海星圖採<b>資料驅動＋海空分層設計</b>，日後擴充至 30–40+ 張地圖完全不需改動引擎核心。以下 8 個雲霧預留席位皆已對應您現有 <code>scenes02/</code> 內尚未啟用的低面素材包與原創物理微規則點子：</p>
    <div class="grid" id="futureGrid" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px"></div>
  </section>
</div>

<div id="modal"><div class="m-inner">
  <div class="m-top"><h3 id="mTitle"></h3><button id="mClose">✕ 關閉</button></div>
  <canvas id="bigCv" width="1040" height="720"></canvas>
</div></div>

<script>
const BP_W = ${BP_W}, BP_H = ${BP_H};
const LAYER_LABEL = { surface: '☀️ 中層・燈谷表界', abyss: '🌊 下層・沉淵暗域', sky: '✨ 上層・星穹外境', dream: '🌌 第四層・夢境虛空（預留）' };
const MAPS = ${JSON.stringify(mapsData)};
const FUTURE_SLOTS = ${JSON.stringify(FUTURE_SLOTS)};

function decodeRle(rle) {
  const out = new Uint8Array(BP_W * BP_H);
  let p = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const v = rle[i], c = rle[i + 1];
    out.fill(v, p, p + c);
    p += c;
  }
  return out;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function renderMap(cv, m) {
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');
  const grid = decodeRle(m.rle);

  // 1. 離散 260x180 高度場底圖
  const off = document.createElement('canvas');
  off.width = BP_W; off.height = BP_H;
  const octx = off.getContext('2d');
  const img = octx.createImageData(BP_W, BP_H);
  const d = img.data;
  const cols = [
    hexToRgb(m.palette.void),
    hexToRgb(m.palette.shallow),
    hexToRgb(m.palette.l1),
    hexToRgb(m.palette.l2),
    hexToRgb(m.palette.l3),
    hexToRgb(m.palette.wall),
  ];
  for (let y = 0; y < BP_H; y++) {
    for (let x = 0; x < BP_W; x++) {
      const idx = y * BP_W + x;
      const v = grid[idx];
      let [r, g, b] = cols[v] || cols[0];
      // 簡單邊緣等高線暗化，讓台階一目了然
      if (v >= 2 && x > 0 && y > 0 && (grid[idx - 1] < v || grid[idx - BP_W] < v)) {
        r = Math.max(0, r - 28); g = Math.max(0, g - 28); b = Math.max(0, b - 28);
      }
      const p = idx * 4;
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;

  const px = u => u * W, py = v => v * H;

  // 2. 主幹道路
  ctx.strokeStyle = 'rgba(255,244,210,0.48)';
  ctx.lineWidth = Math.max(2, W / 240);
  ctx.setLineDash([6, 4]);
  for (const tr of m.trails) {
    ctx.beginPath();
    tr.forEach(([u, v], i) => i ? ctx.lineTo(px(u), py(v)) : ctx.moveTo(px(u), py(v)));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 3. 拱橋
  ctx.strokeStyle = '#e0a058';
  ctx.lineWidth = Math.max(5, W / 100);
  ctx.lineCap = 'round';
  for (const [u0, v0, u1, v1] of m.bridges) {
    ctx.beginPath(); ctx.moveTo(px(u0), py(v0)); ctx.lineTo(px(u1), py(v1)); ctx.stroke();
  }

  // 4. 單向滑翔捷徑
  ctx.strokeStyle = '#6cf0ff';
  ctx.lineWidth = Math.max(2, W / 240);
  ctx.setLineDash([7, 5]);
  for (const [u0, v0, uc, vc, u1, v1] of m.glides) {
    ctx.beginPath();
    ctx.moveTo(px(u0), py(v0));
    ctx.quadraticCurveTo(px(uc), py(vc), px(u1), py(v1));
    ctx.stroke();
    ctx.fillStyle = '#6cf0ff';
    ctx.beginPath(); ctx.arc(px(u1), py(v1), Math.max(3.5, W / 160), 0, Math.PI * 2); ctx.fill();
  }
  ctx.setLineDash([]);

  // 5. 魔物營地
  for (const [u, v] of m.camps) {
    ctx.fillStyle = 'rgba(255,90,74,0.85)';
    ctx.strokeStyle = '#1a0c0a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px(u), py(v), Math.max(4, W / 130), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // 6. 藍光傳送檢查點
  for (const [u, v, label] of m.checkpoints) {
    ctx.fillStyle = '#38d0ff';
    ctx.strokeStyle = '#082436'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(u), py(v), Math.max(6, W / 95), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // 7. POI（出入口／副本／守護獸）
  ctx.font = \`bold \${Math.max(11, Math.round(W / 44))}px "PingFang TC",sans-serif\`;
  ctx.textAlign = 'center';
  for (const poi of m.pois) {
    const x = px(poi.x), y = py(poi.y);
    const col = poi.k === 'boss' ? '#ffd85a' : poi.k === 'dungeon' ? '#c88cff' : '#96f0a2';
    ctx.fillStyle = col; ctx.strokeStyle = '#140e0c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, Math.max(6, W / 90), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(14,12,18,0.82)';
    const tw = ctx.measureText(poi.t).width + 10;
    ctx.fillRect(x - tw / 2, y - 22, tw, 17);
    ctx.fillStyle = col;
    ctx.fillText(poi.t, x, y - 9);
  }

  // 8. Phase 4B 預計 GLB 奇觀菱形標記
  for (const lm of m.phase4bLandmarks) {
    const x = px(lm.x), y = py(lm.y), s = Math.max(7, W / 85);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffae28'; ctx.strokeStyle = '#241406'; ctx.lineWidth = 2;
    ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = 'rgba(28,18,6,0.88)';
    const tw = ctx.measureText(lm.label).width + 10;
    ctx.fillRect(x - tw / 2, y + 10, tw, 17);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(lm.label, x, y + 23);
  }
}

const gridEl = document.getElementById('grid');
const modal = document.getElementById('modal');
const bigCv = document.getElementById('bigCv');
const mTitle = document.getElementById('mTitle');

for (const m of MAPS) {
  const card = document.createElement('article');
  card.className = 'map-card' + (m.isNew ? ' is-new' : '');
  card.dataset.layer = m.layer;
  card.dataset.fam = m.family;
  card.dataset.new = m.isNew ? '1' : '0';

  const ruleHtml = m.realmRule
    ? \`<div class="mc-tag rule"><b>\${m.realmRule.icon} 異界物理微規則 · \${m.realmRule.name}</b><br>\${m.realmRule.desc}</div>\`
    : '';
  const glbHtml = m.phase4bLandmarks.length
    ? \`<div class="mc-tag glb"><b>🏛️ Phase 4B 預計進駐新實模 GLB（scenes02）</b><ul class="mc-list">\${m.phase4bLandmarks.map(l => \`<li><b>\${l.label}</b>：<code>\${l.asset}</code></li>\`).join('')}</ul></div>\`
    : '';

  card.innerHTML = \`
    <div class="mc-head">
      <h2>
        <span>#\${String(m.id).padStart(2, '0')} \${m.name}</span>
        \${m.isNew ? '<span class="badge new">NEW 異界</span>' : ''}
        <span class="badge" style="background:\${m.familyMeta.color}">\${m.familyMeta.icon} \${m.familyMeta.name}</span>
        <span class="badge soft">\${LAYER_LABEL[m.layer]}</span>
        <span class="badge soft">\${m.level} · \${m.planSize}</span>
      </h2>
    </div>
    <div class="mc-body">
      <div class="cv-box"><canvas width="520" height="360"></canvas><span class="cv-hint">點擊放大</span></div>
      <div class="mc-info">
        \${ruleHtml}
        \${m.shallowFx ? \`<div class="mc-tag"><b>\${m.shallowFx.icon} 特殊淺區地貌 · \${m.shallowFx.name}</b><br>\${m.shallowFx.desc}</div>\` : ''}
        \${glbHtml}
        <div class="mc-tag">
          <b>🔵 藍光檢查點（\${m.checkpoints.length} 座）</b>
          <ul class="mc-list">\${m.checkpoints.map(c => \`<li>\${c[2]}</li>\`).join('')}</ul>
        </div>
      </div>
    </div>
    <div class="mc-foot">
      <span>⛩ 副本入口：\${m.dungeon} ｜ 生態散佈：<code>\${m.foliageStyle}</code></span>
      <span>🔴 \${m.camps.length} 處營地 · 🌉 \${m.bridges.length} 座橋 · 🪂 \${m.glides.length} 條滑翔捷徑</span>
    </div>
  \`;
  const cv = card.querySelector('canvas');
  renderMap(cv, m);
  card.querySelector('.cv-box').onclick = () => {
    mTitle.textContent = \`#\${String(m.id).padStart(2, '0')} \${m.name}（\${LAYER_LABEL[m.layer]} · \${m.familyMeta.icon} \${m.familyMeta.name}）\`;
    renderMap(bigCv, m);
    modal.classList.add('open');
  };
  gridEl.appendChild(card);
}

document.getElementById('mClose').onclick = () => modal.classList.remove('open');
modal.onclick = e => { if (e.target === modal) modal.classList.remove('open'); };

const futureGrid = document.getElementById('futureGrid');
const futureSec = document.getElementById('futureSec');
for (const fs of FUTURE_SLOTS) {
  const c = document.createElement('article');
  c.className = 'map-card';
  c.style.cssText = 'border-style:dashed;border-color:#a878e8;background:#f8f2ff';
  c.innerHTML = \`
    <div class="mc-head" style="background:linear-gradient(90deg,#2c1e44,#3c2856)">
      <h2><span>#\${fs.id} \${fs.name}</span><span class="badge soft">\${LAYER_LABEL[fs.layer]}</span></h2>
    </div>
    <div class="mc-info" style="padding:12px 14px">
      <div class="mc-tag rule"><b>✨ 預留物理微規則 Idea</b><br>\${fs.rule}</div>
      <div class="mc-tag glb"><b>📦 對應現有資產包</b><br><code>\${fs.asset}</code></div>
      <div class="mc-tag"><b>🎨 視覺特色</b><br>\${fs.visual}</div>
    </div>
  \`;
  futureGrid.appendChild(c);
}

let curLayer = 'all', curFam = 'all';
function applyFilter() {
  const onlyFuture = curLayer === 'future';
  futureSec.style.display = (curLayer === 'all' || onlyFuture) ? 'block' : 'none';
  for (const card of gridEl.children) {
    if (onlyFuture) { card.classList.add('hide'); continue; }
    const okL = curLayer === 'all' || (curLayer === 'new' ? card.dataset.new === '1' : card.dataset.layer === curLayer);
    const okF = curFam === 'all' || card.dataset.fam === curFam;
    card.classList.toggle('hide', !(okL && okF));
  }
}
document.getElementById('layerFilters').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  curLayer = b.dataset.layer;
  document.querySelectorAll('#layerFilters button').forEach(x => x.classList.toggle('on', x === b));
  applyFilter();
};
document.getElementById('famFilters').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  curFam = b.dataset.fam;
  document.querySelectorAll('#famFilters button').forEach(x => x.classList.toggle('on', x === b));
  applyFilter();
};
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Generated ${outPath} (${(html.length / 1024).toFixed(1)} KB, ${mapsData.length} maps)`);
