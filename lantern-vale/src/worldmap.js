import { buildPlayer } from './models.js';
import { FIELDS, teleportToCheckpoint } from './frontier.js';
import { FIELD_BLUEPRINTS } from './field_blueprints.js';
import { FAMILY_META, getTerrainEffect, getRealmRule } from './terrain_fx.js';
import { getFieldDanger } from './progression.js';
import { pickHotspots, getFieldHotspot } from './mmo_protocol.js';
import { t } from './i18n.js';

// Phase 4A（點子 1）：三層「星燈雲海浮島」航海星圖（表界 / 沉淵 / 星穹）
export const MAP_LAYERS = [
  { id: 'surface', icon: '☀️', name: '中層 · 燈谷表界', bg: '#b8dbd6', bg2: '#d8ece2', lineLit: '#f5b832', lineDim: '#6a847e', starCol: '#ffffff', desc: '溫暖的草原、森林、雪原、火山與東方金沙古文明。' },
  { id: 'abyss',   icon: '🌊', name: '下層 · 沉淵暗域', bg: '#1e324a', bg2: '#2d2446', lineLit: '#58e8ff', lineDim: '#5c6a88', starCol: '#7ef8ff', desc: '海風港鎮深處的珊瑚海域、深海螢光沉淵與幽霧哥德古堡群。' },
  { id: 'sky',     icon: '✨', name: '上層 · 星穹外境', bg: '#262450', bg2: '#462a68', lineLit: '#ffd86b', lineDim: '#7a689c', starCol: '#ffe89c', desc: '雲海之上的浮空遺跡、櫻花水都、星際白銀基地與異星裂谷。' },
];

export const WORLD_REGIONS = [
  // === ☀️ 中層 · 燈谷表界（11 座島嶼）===
  { id: 0,  layer: 'surface', kind: 'town',  name: '🏠 燈谷鎮',       level: '主城安全區', desc: '大燈塔所在的溫暖木屋樞紐，設有公會、覺醒祭壇與渡船碼頭。', route: '任何野外按 H 吹響歸途海螺回城。', x: 35, y: 54 },
  { id: 1,  layer: 'surface', kind: 'field', name: '晨光草原',        level: 'Lv.1–5',     desc: '開闊風車草原與清澈溪流，通往各區域的起點。', route: '由燈谷鎮北門步行或星燈航線啟航。', x: 35, y: 78 },
  { id: 2,  layer: 'surface', kind: 'field', name: '低語森林',        level: 'Lv.5–10',    desc: '高低交錯林道與古老樹洞的立體森域。', route: '經由晨光草原西側林道。', x: 14, y: 62 },
  { id: 3,  layer: 'surface', kind: 'field', name: '霧潮沼澤',        level: 'Lv.10–15',   desc: '濃霧瀰漫的毒霧濕地與古老沼澤遺跡。', route: '由燈谷鎮東側濕地進入。', x: 54, y: 66 },
  { id: 4,  layer: 'surface', kind: 'field', name: '霜冬雪原',        level: 'Lv.15–20',   desc: '純白雪嶺與可高速滑行的極寒冰湖。', route: '由低語森林北上雪山。', x: 16, y: 24 },
  { id: 6,  layer: 'surface', kind: 'field', name: '古樹林',          level: 'Lv.25–30',   desc: '北方巨木環抱的鹿王樹心秘境與療癒靈泉。', route: '經由霜冬雪原東側。', x: 38, y: 22 },
  { id: 5,  layer: 'surface', kind: 'field', name: '燼煙火岩區',      level: 'Lv.20–25',   desc: '赤紅火山岩壁、熔岩護城河與火岩演武場。', route: '由古樹林向東進入火山帶。', x: 60, y: 26 },
  { id: 12, layer: 'surface', kind: 'field', name: '🍁 紅楓工坊谷',   level: 'Lv.28–30',   desc: '秋楓環抱的鍛造工坊、三疊溫泉與綿羊牧場。', route: '位於東北高地，由火山北徑前往。', x: 82, y: 18 },
  { id: 15, layer: 'surface', kind: 'field', name: '🏛️ 失落藤蔓神廟', level: 'Lv.16–20',   desc: '藤蔓纏繞的古神廟高塔、空中石磚棧道與熱帶巨棕櫚。', route: '經由霧潮沼澤向東南深入熱帶叢林。', x: 64, y: 82 },
  { id: 13, layer: 'surface', kind: 'field', name: '🏜️ 黃金風沙原',   level: 'Lv.18–22',   desc: '炙熱金黃沙丘、翡翠棕櫚綠洲與紅砂岩哨塔。', route: '跨越霧潮沼澤東界進入東方沙海。', x: 76, y: 52 },
  { id: 14, layer: 'surface', kind: 'field', name: '🔺 太陽金字塔聖殿', level: 'Lv.26–30', desc: '宏偉古埃及金字塔、神像長廊、金色流沙與法老秘陵。', route: '由黃金風沙原向東直抵太陽聖殿。', x: 88, y: 74 },

  // === 🌊 下層 · 沉淵暗域（6 座島嶼）===
  { id: 100, layer: 'abyss', kind: 'harbor', name: '⛵ 海風港鎮',     level: '第二城鎮',   desc: '陽光海港與跨海燈塔，通往沉淵暗域與星穹外境的港口。', route: '由燈谷鎮南側碼頭乘渡船或星燈啟航。', x: 18, y: 26 },
  { id: 8,   layer: 'abyss', kind: 'field',  name: '珊瑚潮汐灣',      level: 'Lv.18–22',   desc: '金色沙灘、泡沫潮池與通往深海的潛流入口。', route: '由海風港鎮出發沿海岸探索。', x: 42, y: 24 },
  { id: 9,   layer: 'abyss', kind: 'field',  name: '沉沒電光都',      level: 'Lv.24–30',   desc: '半淹深海的太陽能浮台與充能電光運河。', route: '由珊瑚潮汐灣向東航行。', x: 74, y: 24 },
  { id: 18,  layer: 'abyss', kind: 'field',  name: '🫧 深海螢光沉淵', level: 'Lv.24–28',   desc: '青紫發光巨菇、飄浮水母與海底神殿，全場低重力漂浮！', route: '由珊瑚潮汐灣潛入深海海溝。', x: 52, y: 68 },
  { id: 16,  layer: 'abyss', kind: 'field',  name: '🪦 幽霧哥德墓園', level: 'Lv.22–26',   desc: '紫灰濃霧、發光墓碑與枯木祭壇，需靠星燈光圈驅暗破盾！', route: '由海風港鎮南側暗礁霧道前往。', x: 22, y: 72 },
  { id: 17,  layer: 'abyss', kind: 'field',  name: '🏰 深淵哥德古堡', level: 'Lv.28–30',   desc: '暗黑石造哥德堡壘、薔薇中庭與血月騎士王座。', route: '穿過幽霧哥德墓園直衝古堡吊橋。', x: 82, y: 72 },

  // === ✨ 上層 · 星穹外境（5 座島嶼）===
  { id: 7,  layer: 'sky', kind: 'field', name: '浮空遺跡群',          level: 'Lv.12–16',   desc: '雲海浮石拱門、白紅燈塔與強力上升氣流。', route: '乘上升氣流或由星燈航線升空抵達。', x: 18, y: 66 },
  { id: 10, layer: 'sky', kind: 'field', name: '🌸 櫻花水都',         level: 'Lv.14–18',   desc: '漫天櫻花飛瓣、對稱碧藍運河與和風鳥居。', route: '由浮空遺跡群順雲流東行。', x: 42, y: 30 },
  { id: 11, layer: 'sky', kind: 'field', name: '🌀 蒼穹巨環谷',       level: 'Lv.22–26',   desc: '三重巨型碧藍天環橫跨地平線的奇幻高山谷。', route: '由浮空遺跡群或櫻花水都飛躍抵達。', x: 48, y: 74 },
  { id: 19, layer: 'sky', kind: 'field', name: '🚀 星際白銀前哨站',   level: 'Lv.27–30',   desc: '純白與霓虹青未來太空基地，光能過載場讓回魔與冷卻極速狂飆！', route: '由櫻花水都高空星門躍遷進入。', x: 74, y: 30 },
  { id: 20, layer: 'sky', kind: 'field', name: '🌌 異星蜂巢裂谷',     level: 'Lv.30 終局', desc: '紫紅外星結晶裂谷與母巢核心，暴擊引發全場結晶連鎖爆破！', route: '穿過星際白銀前哨站北閘門。', x: 82, y: 74 },
];

// 各層島嶼之間的星燈航線（點亮一端即可解鎖並沿航線啟航至相鄰未探索島嶼！）
export const LANTERN_LINKS = {
  surface: [
    [0, 1], [1, 2], [2, 4], [4, 6], [6, 5], [5, 12],
    [0, 3], [3, 15], [3, 13], [13, 14], [5, 13],
  ],
  abyss: [
    [100, 8], [8, 9], [8, 18], [100, 16], [16, 18], [18, 17], [9, 17],
  ],
  sky: [
    [7, 10], [7, 11], [10, 11], [10, 19], [11, 20], [19, 20],
  ],
};

// 預設每層的起始燈塔（確保玩家隨時可看到並探索三個海空層級）
const DEFAULT_LIT = new Set([0, 100, 1, 7, 8]);

function isRegionLit(game, id) {
  if (DEFAULT_LIT.has(id)) return true;
  if (game.field === id) return true;
  const visited = game.meta?.p?.visitedFields || [];
  return visited.includes(id);
}

function isRegionReachable(game, reg) {
  if (isRegionLit(game, reg.id)) return true;
  const links = LANTERN_LINKS[reg.layer] || [];
  for (const [a, b] of links) {
    if (a === reg.id && isRegionLit(game, b)) return true;
    if (b === reg.id && isRegionLit(game, a)) return true;
  }
  return false;
}

function buildStarChartSvg(game, layerId, regions) {
  const layer = MAP_LAYERS.find(l => l.id === layerId) || MAP_LAYERS[0];
  const links = LANTERN_LINKS[layerId] || [];
  const byId = Object.fromEntries(regions.map(r => [r.id, r]));

  const linesSvg = links.map(([a, b]) => {
    const ra = byId[a], rb = byId[b];
    if (!ra || !rb) return '';
    const bothLit = isRegionLit(game, a) && isRegionLit(game, b);
    const oneLit = isRegionLit(game, a) || isRegionLit(game, b);
    const stroke = bothLit ? layer.lineLit : oneLit ? layer.lineLit : layer.lineDim;
    const opacity = bothLit ? 0.92 : oneLit ? 0.55 : 0.25;
    const dash = bothLit ? '' : 'stroke-dasharray="2.2 1.6"';
    const w = bothLit ? 0.95 : 0.65;
    return `<line x1="${ra.x}" y1="${ra.y}" x2="${rb.x}" y2="${rb.y}" stroke="${stroke}" stroke-width="${w}" stroke-opacity="${opacity}" ${dash} stroke-linecap="round"/>`;
  }).join('');

  // 雲海與星光點綴（手繪航海星圖氛圍）
  const stars = [];
  for (let i = 0; i < 24; i++) {
    const sx = ((i * 37 + 11) % 94) + 3;
    const sy = ((i * 53 + 7) % 88) + 6;
    const sr = (i % 3 === 0) ? 0.65 : 0.38;
    stars.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${layer.starCol}" fill-opacity="${layerId === 'surface' ? 0.35 : 0.65}"/>`);
  }
  const clouds = `
    <g fill="#ffffff" fill-opacity="${layerId === 'surface' ? 0.42 : 0.14}">
      <ellipse cx="6" cy="10" rx="14" ry="7"/><ellipse cx="94" cy="12" rx="15" ry="7"/>
      <ellipse cx="8" cy="92" rx="16" ry="8"/><ellipse cx="92" cy="90" rx="16" ry="8"/>
    </g>
    <g stroke="${layer.starCol}" stroke-opacity="0.16" fill="none" stroke-width="0.35">
      <circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="42" stroke-dasharray="1.5 2"/>
    </g>`;

  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg_${layerId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${layer.bg}"/><stop offset="100%" stop-color="${layer.bg2}"/>
    </linearGradient></defs>
    <rect width="100" height="100" fill="url(#bg_${layerId})"/>
    ${clouds}${stars.join('')}${linesSvg}
  </svg>`;
}

export function bindWorldMap(game) {
  const dialog = document.getElementById('worldMap');
  const atlas = dialog.querySelector('.atlas');
  const layersEl = dialog.querySelector('.map-layers');
  const searchInput = dialog.querySelector('.map-search');
  const name = dialog.querySelector('.region-name');
  const detail = dialog.querySelector('.region-detail');

  let activeLayer = 'surface';
  let selected = WORLD_REGIONS[0];
  let query = '';
  let nodeButtons = [];

  // 拓撲圖例列
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = Object.values(FAMILY_META).map(f =>
    `<span class="map-leg-item" title="${f.desc}"><i class="map-leg-dot" style="background:${f.color}"></i>${f.icon} ${f.name}</span>`
  ).join('');
  atlas.insertAdjacentElement('afterend', legend);

  const badgesEl = document.createElement('div'); badgesEl.className = 'map-badges';
  const cpRow = document.createElement('div'); cpRow.className = 'map-cp-row';
  name.insertAdjacentElement('afterend', badgesEl);
  detail.insertAdjacentElement('afterend', cpRow);

  const sailBtn = document.createElement('button'); sailBtn.className = 'btn small'; sailBtn.style.background = '#2b7ea8';
  const wpBtn = document.createElement('button'); wpBtn.className = 'btn small map-travel';
  const duel = document.createElement('button'); duel.className = 'btn small';
  const raid = document.createElement('button'); raid.className = 'btn small'; raid.textContent = '公會組隊副本';
  raid.onclick = () => game.net.send({ t: 'raidJoin', code: game.party });
  const actions = document.createElement('div'); actions.className = 'map-actions';
  actions.append(sailBtn, wpBtn, duel, raid); dialog.append(actions);

  sailBtn.onclick = () => {
    if (!selected) return;
    if (selected.kind === 'town') { dialog.close(); game.enterTown(); return; }
    if (selected.kind === 'harbor') { dialog.close(); game.enterHarbor(); return; }
    if (selected.kind === 'field') {
      dialog.close();
      game.enterField(selected.id);
      game.ui.toast(`🏮 沿星燈航線抵達「${selected.name}」，雲霧已驅散！`, '#ffd85a');
    }
  };

  wpBtn.onclick = () => {
    const lang = game.settings?.lang || 'zh-TW';
    if (game.waypoint?.id === selected.id) {
      game.waypoint = null;
      game.ui.toast(t(lang, 'clearWaypoint'), '#e8dcc8');
    } else {
      game.waypoint = selected;
      game.ui.toast(`🧭 ${t(lang, 'waypointSet')}：${selected.name}`, '#ffd85a');
    }
    select(selected);
  };

  duel.textContent = '接受演武挑戰';
  duel.onclick = () => {
    if (game.field !== 5 || game.dueling) return;
    dialog.close(); game.dueling = true;
    const pos = game.world.randomWalkable(game.rng, game.player.pos, 5);
    const rival = game.spawnEnemy('boar', pos, true); const actor = buildPlayer(0xb45441, 0x81412f);
    game.scene.remove(rival.m.root); rival.m = actor; rival.m.mat = actor.cloak.material;
    actor.root.scale.setScalar(1.45); game.scene.add(actor.root);
    rival.rival = true; rival.level = 20;
    game.ui.banner('火岩演武場', '已開啟模擬對戰 · 擊敗對手結束挑戰');
  };

  function matchesQuery(reg, q) {
    if (!q) return false;
    const f = reg.kind === 'field' ? FIELDS[reg.id] : null;
    const bp = reg.kind === 'field' ? FIELD_BLUEPRINTS[reg.id] : null;
    const rule = f?.realmRule ? getRealmRule(f.realmRule) : null;
    const tfx = bp?.shallowKind ? getTerrainEffect(bp.shallowKind) : null;
    const bossPoi = bp?.pois?.find(p => p.k === 'boss');
    const hay = [
      reg.name, reg.level, reg.desc, f?.dungeon, f?.beast,
      rule?.name, rule?.desc, tfx?.name, bossPoi?.t,
      bp ? FAMILY_META[bp.family]?.name : '',
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }

  function getCpUnlockedList(fieldId) {
    if (game.field === fieldId && game.checkpoints?.length) {
      return game.checkpoints.filter(c => c.unlocked).map(c => c.idx);
    }
    const saved = game.meta?.p?.unlockedCps?.[fieldId];
    if (Array.isArray(saved) && saved.length) return saved;
    const visited = game.meta?.p?.visitedFields || [];
    return visited.includes(fieldId) ? [0] : [];
  }

  function getCurrentRegion() {
    const isHarbor = game.depth === -2;
    const isTown = game.depth === -1;
    const inDungeon = !isHarbor && !isTown && !game.field;
    return WORLD_REGIONS.find(r =>
      (isHarbor && r.id === 100) || (isTown && r.id === 0) ||
      (game.field && r.id === game.field) || (inDungeon && r.id === (game.originField || 1))
    ) || WORLD_REGIONS[0];
  }

  function renderLayerTabs() {
    layersEl.innerHTML = '';
    const q = query.trim().toLowerCase();
    for (const lay of MAP_LAYERS) {
      const regs = WORLD_REGIONS.filter(r => r.layer === lay.id);
      const litCnt = regs.filter(r => isRegionLit(game, r.id)).length;
      const matchCnt = q ? regs.filter(r => matchesQuery(r, q)).length : 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-layer-btn' + (activeLayer === lay.id ? ' on' : '');
      btn.textContent = `${lay.icon} ${lay.name} (${litCnt}/${regs.length})` + (matchCnt ? ` · 符合 ${matchCnt}` : '');
      btn.onclick = () => {
        activeLayer = lay.id;
        renderAtlas();
        const first = regs.find(r => q && matchesQuery(r, q)) || regs.find(r => r.id === selected?.id) || regs[0];
        if (first) select(first);
      };
      layersEl.appendChild(btn);
    }
  }

  function renderAtlas() {
    const regs = WORLD_REGIONS.filter(r => r.layer === activeLayer);
    const curReg = getCurrentRegion();
    const q = query.trim().toLowerCase();
    atlas.innerHTML = buildStarChartSvg(game, activeLayer, regs);
    nodeButtons = [];

    for (const reg of regs) {
      const lit = isRegionLit(game, reg.id);
      const bp = reg.kind === 'field' ? FIELD_BLUEPRINTS[reg.id] : null;
      const fam = bp ? FAMILY_META[bp.family] : null;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.left = reg.x + '%';
      btn.style.top = reg.y + '%';
      if (fam) btn.style.borderLeft = `4px solid ${fam.color}`;
      const prefix = reg.id === curReg.id ? '📍 ' : lit ? '🏮 ' : '☁️ ';
      const f = reg.kind === 'field' ? FIELDS[reg.id] : null;
      const dng = f ? getFieldDanger(f.level, game.meta?.p?.level || 1) : null;
      const hs = f ? getFieldHotspot(reg.id, game.hotspots) : null;
      const dngTag = dng ? ` ${dng.icon}` : '';
      const hsTag = hs ? (hs.kind === 'gold_tide' ? ' 🔥金潮' : ' 🍗夜市') : '';
      btn.innerHTML = `${prefix}${reg.name}<span class="lv-sub">${reg.level}${dngTag}${hsTag}</span>`;
      btn.classList.toggle('map-hotspot', !!hs);
      btn.classList.toggle('here', reg.id === curReg.id);
      btn.classList.toggle('fogged', !lit);
      btn.classList.toggle('match', !!q && matchesQuery(reg, q));
      btn.setAttribute('aria-pressed', selected?.id === reg.id);
      btn.onclick = () => select(reg);
      atlas.appendChild(btn);
      nodeButtons.push({ btn, reg });
    }
    renderLayerTabs();
  }

  function select(reg) {
    selected = reg;
    const lang = game.settings?.lang || 'zh-TW';
    const lit = isRegionLit(game, reg.id);
    const reachable = isRegionReachable(game, reg);
    const curReg = getCurrentRegion();

    raid.hidden = !(reg.id === 0 && game.depth < 0 && game.wallet);
    duel.hidden = !(reg.id === 5 && game.field === 5 && !game.dueling);
    const isWp = game.waypoint?.id === reg.id;
    wpBtn.textContent = isWp ? t(lang, 'clearWaypoint') : `🧭 ${t(lang, 'setWaypoint')}`;

    // 星燈啟航按鈕：已點亮或與已點亮島嶼相連者可直接啟航（驅散雲霧！）
    const isHere = reg.id === curReg.id && !(game.depth >= 0 && !game.field);
    sailBtn.hidden = isHere;
    sailBtn.disabled = !reachable;
    sailBtn.style.opacity = reachable ? '1' : '0.55';
    sailBtn.textContent = lit
      ? `🏮 星燈航線前往「${reg.name}」`
      : reachable
        ? `⛵ 啟航驅霧 · 探索「${reg.name}」`
        : '☁️ 需先點亮相鄰島嶼燈塔';

    name.textContent = `${lit ? '🏮' : '☁️'} ${reg.name} · ${reg.level}`;

    const f = reg.kind === 'field' ? FIELDS[reg.id] : null;
    const bp = reg.kind === 'field' ? FIELD_BLUEPRINTS[reg.id] : null;
    if (bp) {
      const fam = FAMILY_META[bp.family] || FAMILY_META.open;
      const tfx = getTerrainEffect(bp.shallowKind);
      const rule = f?.realmRule ? getRealmRule(f.realmRule) : null;
      const totalCps = bp.checkpoints?.length || 0;
      const unlockedCount = Math.min(totalCps, getCpUnlockedList(reg.id).length);
      const dng = getFieldDanger(f.level, game.meta?.p?.level || 1);
      const hs = getFieldHotspot(reg.id, game.hotspots);
      const badges = [
        ...(hs ? [`<span class="map-badge" style="background:#d96a1c" title="${hs.bonus}">${hs.name} · ${hs.bonus}</span>`] : []),
        `<span class="map-badge" style="background:${dng.color}" title="${dng.desc}">${dng.icon} ${dng.label}</span>`,
        `<span class="map-badge" style="background:${fam.color}" title="${fam.desc}">${fam.icon} ${fam.name}</span>`,
      ];
      if (rule) badges.push(`<span class="map-badge" style="background:${rule.color}" title="${rule.desc}">${rule.icon} 規則：${rule.name}</span>`);
      if (tfx) badges.push(`<span class="map-badge soft" title="${tfx.desc}">${tfx.icon} ${tfx.name}</span>`);
      if (totalCps > 0) badges.push(`<span class="map-badge soft">🔵 檢查點 ${unlockedCount}/${totalCps}</span>`);
      badgesEl.innerHTML = badges.join('');
      badgesEl.hidden = false;

      if (game.field === reg.id && game.checkpoints?.length) {
        cpRow.innerHTML = '';
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:12px;font-weight:800;color:#2b5c72';
        lbl.textContent = '同圖檢查點瞬移：';
        cpRow.appendChild(lbl);
        for (const cp of game.checkpoints) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'map-cp-btn' + (cp.unlocked ? '' : ' locked');
          btn.textContent = cp.unlocked ? `🔵 ${cp.name}` : `🔒 ${cp.name}`;
          btn.disabled = !cp.unlocked;
          if (cp.unlocked) btn.onclick = () => { dialog.close(); teleportToCheckpoint(game, cp.idx); };
          cpRow.appendChild(btn);
        }
        cpRow.hidden = false;
      } else {
        cpRow.innerHTML = '';
        cpRow.hidden = true;
      }
    } else {
      badgesEl.innerHTML = reg.kind === 'town'
        ? `<span class="map-badge" style="background:#7a5a3a">🏠 主城樞紐</span>`
        : `<span class="map-badge" style="background:#2b7da8">⛵ 沉淵港口</span>`;
      badgesEl.hidden = false;
      cpRow.innerHTML = '';
      cpRow.hidden = true;
    }

    const grave = reg.kind === 'field' ? game.meta.p.graves[reg.id] : null;
    const bossPoi = bp?.pois?.find(p => p.k === 'boss');
    const ruleNote = f?.realmRule ? ` 【異界規則】${getRealmRule(f.realmRule)?.desc || ''}` : '';
    const bossNote = bossPoi ? ` 【區域守護獸】${bossPoi.t}` : '';
    detail.textContent = `${reg.desc}${ruleNote}${bossNote}${grave ? ' · 🪦 墓碑在此！' : ''}`;

    nodeButtons.forEach(({ btn, reg: r }) => {
      btn.setAttribute('aria-pressed', r.id === reg.id);
    });
  }

  searchInput.oninput = () => {
    query = searchInput.value || '';
    const q = query.trim().toLowerCase();
    if (q) {
      const hit = WORLD_REGIONS.find(r => matchesQuery(r, q));
      if (hit && hit.layer !== activeLayer) activeLayer = hit.layer;
      renderAtlas();
      if (hit) select(hit);
    } else {
      renderAtlas();
    }
  };

  function open() {
    if (game.state !== 'play' || game.ui.invOpen || game.ui.panelOpen || game.ui.setOpen) return;
    game.keys = {}; game.mouse.l = game.mouse.r = false;
    const curReg = getCurrentRegion();
    activeLayer = curReg.layer || 'surface';
    const litTotal = WORLD_REGIONS.filter(r => isRegionLit(game, r.id)).length;
    const inDungeon = game.depth >= 0 && !game.field;
    const hsData = game.hotspots || pickHotspots();
    const hsSummary = hsData.hotspots.map(h => `${h.kind === 'gold_tide' ? '🔥' : '🍗'}${FIELDS[h.fieldId]?.name || ''}`).join(' · ');
    dialog.querySelector('.map-location').textContent =
      `📍 ${inDungeon ? `副本第 ${game.depth + 1} 層` : curReg.name} ｜ 🏮 星燈 ${litTotal}/${WORLD_REGIONS.length} ｜ 本期熱點：${hsSummary}`;
    renderAtlas();
    select(curReg);
    dialog.showModal();
  }

  document.getElementById('btnMap').onclick = open;
  dialog.querySelector('.map-close').onclick = () => dialog.close();
  game.ui.mapDialog = dialog;
  game.ui.openMap = open;
}
