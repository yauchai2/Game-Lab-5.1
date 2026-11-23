import { buildPlayer } from './models.js';
import { FIELDS, teleportToCheckpoint } from './frontier.js';
import { FIELD_BLUEPRINTS } from './field_blueprints.js';
import { FAMILY_META, getTerrainEffect } from './terrain_fx.js';
import illustration from './worldmap.svg';
import { BIOMES } from './util.js';
import { t } from './i18n.js';

// 世界總圖節點（不可直接點擊傳送！僅供檢視路線、設定導航目標與查詢航線）
export const WORLD_REGIONS = [
  { id: 0, kind: 'town', name: '燈谷鎮', level: '主城安全區', desc: '鎮中心設有公會大廳、覺醒祭壇、可入屋小屋與南側渡船碼頭。', route: '任何野外按 H 吹響歸途海螺即可回城。', x: 48, y: 53 },
  { id: 1, kind: 'field', name: '晨光草原', level: 'Lv.1–5', desc: '從燈谷鎮北門踏入的開闊草原，藏有草原洞窟與上升氣流。', route: '由燈谷鎮北側拱門步行抵達。', x: 48, y: 78 },
  { id: 2, kind: 'field', name: '低語森林', level: 'Lv.5–10', desc: '西側林地的樹冠高低交錯，古老的樹洞通往地底。', route: '經由晨光草原的區域道路前往。', x: 22, y: 63 },
  { id: 3, kind: 'field', name: '霧潮沼澤', level: 'Lv.10–15', desc: '東側濕地常有濃霧，潮水間留有沼澤遺跡。', route: '經由低語森林的區域道路前往。', x: 76, y: 62 },
  { id: 4, kind: 'field', name: '霜冬雪原', level: 'Lv.15–20', desc: '西北高地時有暴風雪，山脊下方藏著冰窟。', route: '經由霧潮沼澤的區域道路前往。', x: 20, y: 28 },
  { id: 5, kind: 'field', name: '燼煙火岩區', level: 'Lv.20–25', desc: '東北方的赤色岩壁環抱著熔爐與演武場。', route: '經由霜冬雪原的區域道路前往。', x: 78, y: 27 },
  { id: 6, kind: 'field', name: '古樹林', level: 'Lv.25–30', desc: '北方密林深處，是通往鹿王樹心的入口。', route: '經由燼煙火岩區的區域道路前往。', x: 49, y: 18 },
  { id: 100, kind: 'harbor', name: '⛵ 海風港鎮', level: '第二城鎮', desc: '跨越碧藍海灣的陽光海港，設有紅白燈塔、公共倉庫與造型工坊！', route: '前往燈谷鎮南側碼頭搭乘木造渡船（3D 航行）抵達。', x: 86, y: 82 },
  { id: 7, kind: 'field', name: '浮空遺跡群', level: 'Lv.12–16', desc: '海灣上空的浮石拱門遺跡，富含強力上升氣流。', route: '乘船至海風港鎮後，由西北路牌進入。', x: 14, y: 86 },
  { id: 8, kind: 'field', name: '珊瑚潮汐灣', level: 'Lv.18–22', desc: '金色沙灘、彩色遮陽傘與清澈泡沫潮池的海濱原野。', route: '乘船至海風港鎮後，由正北路牌進入。', x: 66, y: 88 },
  { id: 9, kind: 'field', name: '沉沒電光都', level: 'Lv.24–30', desc: '半淹於深藍海水的太陽能屋頂小屋、滑輪纜線與電光浮台秘境。', route: '乘船至海風港鎮後，由東北路牌進入。', x: 90, y: 46 },
  { id: 10, kind: 'field', name: '🌸 櫻花水都', level: 'Lv.14–18', desc: '漫天櫻花飛瓣、對稱碧藍運河、雙翼雕像與旗幟大道的海濱花都。', route: '乘船至海風港鎮後，由櫻花大道木牌進入（或經沉沒電光都步行抵達）。', x: 34, y: 90 },
  { id: 11, kind: 'field', name: '🌀 蒼穹巨環谷', level: 'Lv.22–26', desc: '橫跨地平線的三重巨型碧藍天環、圓頂山坡小屋與星晶巨像出沒的奇幻山谷。', route: '乘船至海風港鎮後，由巨環路牌進入（或經櫻花水都步行抵達）。', x: 10, y: 46 },
  { id: 12, kind: 'field', name: '🍁 紅楓工坊谷', level: 'Lv.28–30', desc: '白樺秋楓林環抱的棋盤石磚鍛造工坊、熔爐與蓬鬆羊群棲息的終極秘境。', route: '乘船至海風港鎮後，由紅楓路牌進入（或經蒼穹巨環谷步行抵達）。', x: 88, y: 15 },
];

export function bindWorldMap(game) {
  const dialog = document.getElementById('worldMap');
  const atlas = dialog.querySelector('.atlas');
  const mapInfo = dialog.querySelector('.map-info');
  const name = dialog.querySelector('.region-name');
  const detail = dialog.querySelector('.region-detail');
  atlas.innerHTML = illustration;
  const buttons = [];
  let selected = WORLD_REGIONS[0];

  // PoE 2 五大拓撲圖例列（置於地圖正下方）
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = Object.values(FAMILY_META).map(f =>
    `<span class="map-leg-item" title="${f.desc}"><i class="map-leg-dot" style="background:${f.color}"></i>${f.icon} ${f.name}</span>`
  ).join('');
  atlas.insertAdjacentElement('afterend', legend);

  // 區域徽章列（拓撲／規模／特殊淺區地貌／檢查點進度）與同圖檢查點瞬移列
  const badgesEl = document.createElement('div'); badgesEl.className = 'map-badges';
  const cpRow = document.createElement('div'); cpRow.className = 'map-cp-row';
  name.insertAdjacentElement('afterend', badgesEl);
  detail.insertAdjacentElement('afterend', cpRow);

  const wpBtn = document.createElement('button'); wpBtn.className = 'btn small map-travel';
  const duel = document.createElement('button'); duel.className = 'btn small';
  const raid = document.createElement('button'); raid.className = 'btn small'; raid.textContent = '公會組隊副本';
  raid.onclick = () => game.net.send({ t: 'raidJoin', code: game.party });
  const actions = document.createElement('div'); actions.className = 'map-actions';
  actions.append(wpBtn, duel, raid); dialog.append(actions);

  wpBtn.onclick = () => {
    const lang = game.settings?.lang || 'zh-TW';
    if (game.waypoint?.id === selected.id) {
      game.waypoint = null;
      game.ui.toast(t(lang, 'clearWaypoint'), '#e8dcc8');
    } else {
      game.waypoint = selected;
      game.ui.toast(`🧭 ${t(lang, 'waypointSet')}：${selected.name}（${selected.route}）`, '#ffd85a');
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

  function getCpUnlockedList(fieldId) {
    if (game.field === fieldId && game.checkpoints?.length) {
      return game.checkpoints.filter(c => c.unlocked).map(c => c.idx);
    }
    const saved = game.meta?.p?.unlockedCps?.[fieldId];
    if (Array.isArray(saved) && saved.length) return saved;
    const visited = game.meta?.p?.visitedFields || [];
    return visited.includes(fieldId) ? [0] : [];
  }

  function select(reg) {
    selected = reg;
    const lang = game.settings?.lang || 'zh-TW';
    raid.hidden = !(reg.id === 0 && game.depth < 0 && game.wallet);
    duel.hidden = !(reg.id === 5 && game.field === 5 && !game.dueling);
    const isWp = game.waypoint?.id === reg.id;
    wpBtn.textContent = isWp ? t(lang, 'clearWaypoint') : `🧭 ${t(lang, 'setWaypoint')}`;
    name.textContent = `${reg.name} · ${reg.level}`;

    const bp = reg.kind === 'field' ? FIELD_BLUEPRINTS[reg.id] : null;
    if (bp) {
      const fam = FAMILY_META[bp.family] || FAMILY_META.open;
      const tfx = getTerrainEffect(bp.shallowKind);
      const totalCps = bp.checkpoints?.length || 0;
      const unlockedList = getCpUnlockedList(reg.id);
      const unlockedCount = Math.min(totalCps, unlockedList.length);
      const badges = [
        `<span class="map-badge" style="background:${fam.color}" title="${fam.desc}">${fam.icon} ${fam.name}</span>`,
        `<span class="map-badge soft">📐 ${bp.planSize}</span>`,
      ];
      if (tfx) badges.push(`<span class="map-badge soft" title="${tfx.desc}">${tfx.icon} ${tfx.name}</span>`);
      if (totalCps > 0) badges.push(`<span class="map-badge soft">🔵 檢查點 ${unlockedCount}/${totalCps}</span>`);
      badgesEl.innerHTML = badges.join('');
      badgesEl.hidden = false;

      // 若玩家正位於此野外地圖，提供同圖已解鎖藍光檢查點一鍵瞬移
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
          btn.title = cp.unlocked ? `瞬移至「${cp.name}」` : '尚未探索解鎖，靠近該藍光石陣即可開啟';
          if (cp.unlocked) {
            btn.onclick = () => { dialog.close(); teleportToCheckpoint(game, cp.idx); };
          }
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
        : `<span class="map-badge" style="background:#2b7da8">⛵ 跨海港口</span>`;
      badgesEl.hidden = false;
      cpRow.innerHTML = '';
      cpRow.hidden = true;
    }

    const grave = reg.kind === 'field' ? game.meta.p.graves[reg.id] : null;
    const terrainNote = bp && getTerrainEffect(bp.shallowKind) ? ` 【地貌互動】${getTerrainEffect(bp.shallowKind).desc}` : '';
    detail.textContent = `${reg.desc}${terrainNote} 【抵達方式】${reg.route}${grave ? ' · 🪦 墓碑在此！' : ''}`;
    buttons.forEach((button, j) => {
      button.setAttribute('aria-pressed', WORLD_REGIONS[j].id === reg.id);
      button.classList.toggle('wp', game.waypoint?.id === WORLD_REGIONS[j].id);
    });
  }

  WORLD_REGIONS.forEach(reg => {
    const button = document.createElement('button');
    const bp = reg.kind === 'field' ? FIELD_BLUEPRINTS[reg.id] : null;
    const fam = bp ? FAMILY_META[bp.family] : null;
    button.textContent = reg.name;
    button.style.left = reg.x + '%'; button.style.top = reg.y + '%';
    if (fam) {
      button.style.borderLeft = `4px solid ${fam.color}`;
      button.title = `${reg.name}（${fam.icon} ${fam.name}）`;
    }
    button.onclick = () => select(reg);
    atlas.appendChild(button); buttons.push(button);
  });
  const playerPin = document.createElement('div');
  playerPin.className = 'player-pin';
  playerPin.textContent = '📍 你在這裡';
  atlas.appendChild(playerPin);

  function open() {
    if (game.state !== 'play' || game.ui.invOpen || game.ui.panelOpen || game.ui.setOpen) return;
    game.keys = {}; game.mouse.l = game.mouse.r = false;
    const lang = game.settings?.lang || 'zh-TW';
    const isHarbor = game.depth === -2;
    const isTown = game.depth === -1;
    const inDungeon = !isHarbor && !isTown && !game.field;
    dialog.querySelector('.map-location').textContent =
      (isHarbor ? '📍 你目前位於 · 海風港鎮（第二城鎮）' : isTown ? '📍 你目前位於 · 燈谷鎮（主城）' : game.field ? `📍 你目前位於 · ${FIELDS[game.field].name}` : `📍 你目前位於 · 副本第 ${game.depth + 1} 層`)
      + ' ｜ ' + t(lang, 'noDirectTp');
    buttons.forEach((b, j) => {
      const r = WORLD_REGIONS[j];
      b.classList.toggle('here', (isHarbor && r.id === 100) || (isTown && r.id === 0) || (game.field && r.id === game.field) || (inDungeon && r.id === (game.originField || 1)));
    });
    const curReg = WORLD_REGIONS.find(r => (isHarbor && r.id === 100) || (isTown && r.id === 0) || (game.field && r.id === game.field) || (inDungeon && r.id === (game.originField || 1))) || WORLD_REGIONS[0];
    const half = game.world?.half || 30;
    const ox = Math.max(-3.5, Math.min(3.5, ((game.player?.pos?.x || 0) / half) * 3.5));
    const oy = Math.max(-3.5, Math.min(3.5, ((game.player?.pos?.z || 0) / half) * 3.5));
    playerPin.style.left = (curReg.x + ox) + '%';
    playerPin.style.top = (curReg.y + oy) + '%';
    playerPin.textContent = inDungeon ? `📍 你在副本 (${game.depth + 1}F)` : `📍 你在這裡（${game.playerName || '旅人'}）`;
    select(curReg);
    dialog.showModal();
  }

  document.getElementById('btnMap').onclick = open;
  dialog.querySelector('.map-close').onclick = () => dialog.close();
  game.ui.mapDialog = dialog;
  game.ui.openMap = open;
}
