// Phase 5B：Godot 風格底部除錯工具列（F3 開關；` 鍵開調校面板 dev_tuner.js）
// 提供：錯誤與警告攔截、輸出日誌過濾、即時 FPS/FrameTime 折線監視器、WebGL 顯存與 ObjectDB 統計、快捷除錯工具

import { canvasUiFont } from './ui_typography.js';
import { openTextDialog } from './ui_layers.js';
import { FIELDS } from './frontier.js';
import { FIELD_BLUEPRINTS } from './field_blueprints.js';
import { getGlbCacheCount } from './assets.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { makeItem } from './loot.js';
import { MONSTER_SOULS, grantSoul } from './souls.js';
import { MOUNTS } from './mounts.js';
import { getSimAdventurers, getSimConfig, setSimConfig, triggerSimEvent } from './mmo_world.js';

import { recordDevEvent, setDevContext, setDevRecording } from './dev_diagnostics.js';
import { installDevTuner } from './dev_tuner.js';

const MAX_LOGS = 250;
const HIST_LEN = 64;

/**
 * 開發者工具是否可用：
 *  - `?dev`（或 `?dev=1`）→ 開啟並記住（localStorage lv_dev_unlock），`?dev=0` → 關閉並清除記憶。
 *  - 否則只有非 --prod 建置在本機（localhost / 區網 / file://）才開。
 * GitHub Pages 的公開版沒有 ?dev 時，F3、`、除錯按鈕、調校面板全部不存在。
 */
export function devAllowed() {
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.has('dev')) {
      const off = ['0', 'off', 'false'].includes((qs.get('dev') || '').toLowerCase());
      try { off ? localStorage.removeItem('lv_dev_unlock') : localStorage.setItem('lv_dev_unlock', '1'); } catch (_) {}
      return !off;
    }
    try { if (localStorage.getItem('lv_dev_unlock') === '1') return true; } catch (_) {}
    if (typeof __LV_PROD__ !== 'undefined' && __LV_PROD__) return false;
    const h = location.hostname;
    return location.protocol === 'file:' || h === '' || h === 'localhost' || h === '[::1]' || /^127\./.test(h) || /^10\./.test(h) ||
      /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local');
  } catch (_) { return false; }
}

export function installDebugger(game) {
  if (!devAllowed()) {
    return { allowed: false, toggle: () => false, setDevMode() {}, openTools() {}, isOpen: () => false, getCounts: () => ({ errors: 0, warnings: 0, total: 0 }), log() {}, recordFrame() {}, onZoneLoaded() {} };
  }
  const logs = [];
  let errCount = 0, warnCount = 0;
  let open = false;
  let activeTab = 'errors';
  let filterText = '';
  let filterLevel = 'all';
  let lastRefresh = 0;

  const fpsHist = new Float32Array(HIST_LEN);
  const msHist = new Float32Array(HIST_LEN);
  let histPtr = 0;
  let lastUpdateMs = 0, lastRenderMs = 0, smoothFps = 60, smoothMs = 16.6;

  setDevContext(() => {
    const info = game.pipe?.renderer?.info;
    return {
      zone: game.zone, shard: game.net?.shard, state: game.state,
      viewport: `${innerWidth}x${innerHeight}`, fps: Math.round(smoothFps),
      frameMs: Math.round(smoothMs * 10) / 10,
      drawCalls: info?.render?.calls, triangles: info?.render?.triangles,
      geometries: info?.memory?.geometries, textures: info?.memory?.textures,
    };
  });

  function fmtTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  function pushLog(level, args) {
    const msg = args.map(a => {
      try {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object' && a !== null) return JSON.stringify(a);
        return String(a);
      } catch (_) { return '[無法顯示的物件]'; }
    }).join(' ');
    const entry = { t: fmtTime(), level, msg };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    if (level === 'error') errCount++;
    else if (level === 'warn') warnCount++;
    if (open && (activeTab === 'errors' || activeTab === 'output')) renderList();
    updateBadge();
  }

  // 攔截 console.log / warn / error 與全域未捕捉異常（保留原 console 輸出）
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origErr = console.error.bind(console);
  console.log = (...a) => { pushLog('log', a); origLog(...a); };
  console.warn = (...a) => { pushLog('warn', a); origWarn(...a); };
  console.error = (...a) => { pushLog('error', a); origErr(...a); };
  window.addEventListener('error', ev => {
    const location = `${ev.filename || ''}:${ev.lineno || 0}:${ev.colno || 0}`;
    const frames = ev.error?.stack?.split('\n').slice(1, 6).join('\n');
    pushLog('error', [`[Uncaught] ${ev.message} (${location})${frames ? '\n' + frames : ''}`]);
  });
  window.addEventListener('unhandledrejection', ev => {
    pushLog('error', [`[Promise] ${ev.reason?.message || ev.reason}`]);
  });

  // 建立 Godot 風格底部面板 DOM
  const dock = document.createElement('div');
  dock.id = 'dbgDock';
  dock.className = 'hide';
  dock.innerHTML = `
    <div class="dbg-tabs">
      <div class="dbg-tab-group">
        <button type="button" class="dbg-tab on" data-tab="errors">🚨 錯誤 <span id="dbgErrBadge">0</span></button>
        <button type="button" class="dbg-tab" data-tab="output">📜 輸出</button>
        <button type="button" class="dbg-tab" data-tab="monitors">📈 效能分析</button>
        <button type="button" class="dbg-tab" data-tab="vram">🧠 顯存 / ObjectDB</button>
        <button type="button" class="dbg-tab" data-tab="tools">🧪 開發者模式</button>
        <button type="button" class="dbg-tab" data-tab="mmo">👥 虛擬 MMO</button>
      </div>
      <div class="dbg-right">
        <button type="button" class="dbg-dev-sw" id="dbgTuneOpen" title="開發者調校面板（反引號鍵）">🎛 調校面板</button>
        <button type="button" class="dbg-dev-sw" id="dbgDevMaster" title="切換開發者模式 (Shift+F3)">🧪 DEV：關</button>
        <span id="dbgMiniFps">60 FPS · 16.6ms</span>
        <button type="button" class="dbg-x" id="dbgClose" title="關閉除錯面板 (F3)">✕</button>
      </div>
    </div>
    <div class="dbg-body">
      <div class="dbg-pane" data-pane="errors">
        <div class="dbg-bar">
          <button type="button" id="dbgClearErr">🧹 清空</button>
          <button type="button" id="dbgCopyRep">📋 複製診斷報告</button>
          <span class="dbg-hint">Dev Mode 開啟時，本機伺服器會自動保存診斷紀錄</span>
        </div>
        <div class="dbg-list" id="dbgErrList"></div>
      </div>
      <div class="dbg-pane hide" data-pane="output">
        <div class="dbg-bar">
          <input type="search" id="dbgFilter" placeholder="🔍 篩選日誌關鍵字…"/>
          <select id="dbgLvl"><option value="all">全部等級</option><option value="log">LOG</option><option value="warn">WARN</option><option value="error">ERROR</option></select>
          <button type="button" id="dbgClearLog">🧹 清空</button>
        </div>
        <div class="dbg-list" id="dbgOutList"></div>
      </div>
      <div class="dbg-pane hide" data-pane="monitors">
        <div class="dbg-mon-grid">
          <div class="dbg-chart-wrap"><canvas id="dbgChart" width="420" height="120"></canvas></div>
          <div class="dbg-kv" id="dbgPerfKv"></div>
        </div>
      </div>
      <div class="dbg-pane hide" data-pane="vram">
        <div class="dbg-kv" id="dbgVramKv"></div>
      </div>
      <div class="dbg-pane hide" data-pane="tools" style="overflow:auto">
        <div class="dbg-dev-grid">
          <div class="dbg-dev-box">
            <b>⚙️ 開發者常駐開關（需先開啟上方 🧪 DEV）</b>
            <div class="dbg-tools-row">
              <button type="button" id="devGod">🛡️ 無敵模式：關</button>
              <button type="button" id="devNoCd">⚡ 零冷卻＆無限魔力：關</button>
              <button type="button" id="devFast">🚀 跑圖 2.2× 速：關</button>
              <button type="button" id="devUnlockMap">🏮 解鎖全 22 島星燈＆檢查點</button>
              <button type="button" id="devResetAll" style="background:#8a242c;border-color:#ff6a78;color:#fff4f4">🧹 一鍵清檔 Reset 遊戲</button>
            </div>
          </div>
          <div class="dbg-dev-box">
            <b>🌍 場景、副本與天氣測試</b>
            <div class="dbg-tools-row">
              <select id="dbgZoneSel"></select>
              <button type="button" id="dbgGoZone">⚡ 瞬移</button>
              <button type="button" id="devDungeon">⛩ 進副本 1F</button>
              <button type="button" id="devBoss">👑 直衝 Boss 房</button>
              <button type="button" id="devDay">☀️/🌙 切換晝夜</button>
              <button type="button" id="devRain">🌧️ 切換降雨</button>
            </div>
          </div>
          <div class="dbg-dev-box">
            <b>🔥 餘燼潮汐、元素連鎖與生怪測試</b>
            <div class="dbg-tools-row">
              <button type="button" id="devTideSwarm">🌊 餘燼狂潮</button>
              <button type="button" id="devTideApex">👑 熾炎巔峰(潮汐王)</button>
              <button type="button" id="devTideLull">🏕️ 潮退休整營火</button>
              <button type="button" id="devElemTest">⚡ 生成水窪＋怪測連鎖</button>
              <button type="button" id="devSpawnElite">💀 生詞綴精英</button>
              <button type="button" id="devClearMobs">💥 清空敵人</button>
            </div>
          </div>
          <div class="dbg-dev-box">
            <b>🎒 角色、裝備、拼圖、靈魂與巡遊測試</b>
            <div class="dbg-tools-row">
              <button type="button" id="dbgHealFull">❤️ 滿血魔藥水</button>
              <button type="button" id="devLvUp">⬆️ 等級 +5</button>
              <button type="button" id="dbgGiveRes">💰 +1000 金幣/星砂/鑰石</button>
              <button type="button" id="devLegend">🎁 掉傳說裝備</button>
              <button type="button" id="devAllGems">💎 全套拼圖寶石</button>
              <button type="button" id="devAllSouls">👻 解鎖全靈魂</button>
              <button type="button" id="devAllMounts">🦌 解鎖全坐騎</button>
              <button type="button" id="dbgChargeUlt">⚡ 滿怒大絕</button>
              <button type="button" id="devSpark5">🔥 滿 5 層星火</button>
              <button type="button" id="dbgTogAuto">🏮 切換巡遊</button>
            </div>
          </div>
        </div>
      </div>
      <div class="dbg-pane hide" data-pane="mmo" style="overflow:auto">
        <div class="dbg-dev-grid">
          <div class="dbg-dev-box">
            <b>👥 全圖虛擬 MMO 玩家人數（三層 LOD 壓測）</b>
            <div class="dbg-tools-row">
              <button type="button" data-mmo-cnt="0">0 人（關）</button>
              <button type="button" data-mmo-cnt="12">12 人</button>
              <button type="button" data-mmo-cnt="24">24 人</button>
              <button type="button" data-mmo-cnt="36">36 人（預設）</button>
              <button type="button" data-mmo-cnt="48">48 人（極限壓測）</button>
              <span class="dbg-hint" id="dbgMmoStat">目前：—</span>
            </div>
          </div>
          <div class="dbg-dev-box">
            <b>🧭 虛擬玩家行為模式</b>
            <div class="dbg-tools-row">
              <button type="button" data-mmo-mode="ecosystem">🌿 全圖任務生態</button>
              <button type="button" data-mmo-mode="gather">🧲 全員集結我身邊</button>
              <button type="button" data-mmo-mode="boss">🐉 全員圍毆世界王</button>
              <button type="button" data-mmo-mode="party">🎉 城鎮熱鬧模式</button>
              <button type="button" id="dbgMmoChat">💬 世界頻：開</button>
            </div>
          </div>
          <div class="dbg-dev-box">
            <b>✨ 一鍵觸發 MMO 互動事件與分佈檢視</b>
            <div class="dbg-tools-row">
              <button type="button" data-mmo-ev="enhance_wave">✨ 全場強化金光</button>
              <button type="button" data-mmo-ev="chat_wave">📢 世界頻喊話潮</button>
              <button type="button" data-mmo-ev="wave_me">👋 附近玩家靠攏揮手</button>
              <button type="button" id="dbgMmoRoster">📋 線上名單與任務 (O)</button>
              <button type="button" id="dbgMmoMap">🗺️ 地區小地圖看分佈 (Tab)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

  const $d = id => dock.querySelector('#' + id);

  // 填充區域傳送下拉選單（2 主城 + 20 野外地圖）
  const zSel = $d('dbgZoneSel');
  if (zSel) {
    const opts = [['town', '🏠 燈谷鎮'], ['harbor', '⛵ 海風港鎮']];
    for (let i = 1; i < FIELDS.length; i++) opts.push(['f:' + i, `#${String(i).padStart(2, '0')} ${FIELDS[i].name} (Lv.${FIELDS[i].level})`]);
    zSel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  }

  function updateBadge() {
    const b = $d('dbgErrBadge');
    if (b) {
      b.textContent = errCount + warnCount;
      b.classList.toggle('has-err', errCount > 0);
      b.classList.toggle('has-warn', errCount === 0 && warnCount > 0);
    }
  }

  function renderList() {
    const errEl = $d('dbgErrList');
    const outEl = $d('dbgOutList');
    if (activeTab === 'errors' && errEl) {
      const items = logs.filter(l => l.level === 'error' || l.level === 'warn');
      errEl.innerHTML = items.length
        ? items.slice(-80).reverse().map(l => `<div class="dbg-row ${l.level}"><span class="dbg-t">${l.t}</span><span class="dbg-lv">${l.level.toUpperCase()}</span><span class="dbg-m"></span></div>`).join('')
        : '<div class="dbg-empty">✅ 目前 0 錯誤、0 警告（乾淨運行中）</div>';
      const rows = errEl.querySelectorAll('.dbg-m');
      items.slice(-80).reverse().forEach((l, idx) => { if (rows[idx]) rows[idx].textContent = l.msg; });
    }
    if (activeTab === 'output' && outEl) {
      const q = filterText.trim().toLowerCase();
      const items = logs.filter(l => (filterLevel === 'all' || l.level === filterLevel) && (!q || l.msg.toLowerCase().includes(q)));
      outEl.innerHTML = items.length
        ? items.slice(-100).reverse().map(l => `<div class="dbg-row ${l.level}"><span class="dbg-t">${l.t}</span><span class="dbg-lv">${l.level.toUpperCase()}</span><span class="dbg-m"></span></div>`).join('')
        : '<div class="dbg-empty">（尚無符合條件的輸出日誌）</div>';
      const rows = outEl.querySelectorAll('.dbg-m');
      items.slice(-100).reverse().forEach((l, idx) => { if (rows[idx]) rows[idx].textContent = l.msg; });
    }
  }

  function renderMonitors() {
    const cv = $d('dbgChart');
    if (cv) {
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      ctx.fillStyle = '#15171e';
      ctx.fillRect(0, 0, W, H);
      // 30 / 60 FPS 基準線
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(0, H * 0.25); ctx.lineTo(W, H * 0.25);
      ctx.moveTo(0, H * 0.62); ctx.lineTo(W, H * 0.62);
      ctx.stroke();
      // FPS 折線
      ctx.strokeStyle = smoothFps >= 52 ? '#5ae082' : smoothFps >= 35 ? '#ffd25a' : '#ff6060';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < HIST_LEN; i++) {
        const idx = (histPtr + i) % HIST_LEN;
        const fps = Math.min(75, fpsHist[idx] || 0);
        const x = (i / (HIST_LEN - 1)) * W;
        const y = H - (fps / 75) * (H - 12) - 6;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#d8deea';
      ctx.font = canvasUiFont(12, 700);
      ctx.fillText(`FPS: ${smoothFps.toFixed(1)}  |  Frame: ${smoothMs.toFixed(1)}ms`, 8, 15);
    }
    const kv = $d('dbgPerfKv');
    if (kv) {
      const info = game.pipe?.renderer?.info;
      const totalE = game.enemies?.length || 0;
      const visE = (game.enemies || []).filter(e => !e.dead && e.m?.root?.visible !== false).length;
      kv.innerHTML = [
        ['即時 FPS', `${smoothFps.toFixed(1)} fps`],
        ['總幀耗時', `${smoothMs.toFixed(2)} ms`],
        ['邏輯 Update', `${lastUpdateMs.toFixed(2)} ms`],
        ['渲染 Render', `${lastRenderMs.toFixed(2)} ms`],
        ['Draw Calls', `${info?.render?.calls ?? '—'}`],
        ['三角形數', `${(info?.render?.triangles ?? 0).toLocaleString()}`],
        ['活體敵人 (可見/總計)', `${visE} / ${totalE}`],
        ['目前區域', `${game.zone || '—'}`],
      ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    }
  }

  function renderVram() {
    const kv = $d('dbgVramKv');
    if (!kv) return;
    const info = game.pipe?.renderer?.info;
    let meshes = 0, insts = 0, lights = 0;
    game.scene?.traverse?.(o => {
      if (o.isInstancedMesh) insts++;
      else if (o.isMesh) meshes++;
      else if (o.isLight) lights++;
    });
    const mem = performance?.memory;
    const heapStr = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(1)} / ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB` : '瀏覽器未公開';
    kv.innerHTML = [
      ['GPU Geometries', `${info?.memory?.geometries ?? '—'}`],
      ['GPU Textures', `${info?.memory?.textures ?? '—'}`],
      ['Shader Programs', `${info?.programs?.length ?? '—'}`],
      ['GLB 資產快取數', `${getGlbCacheCount()}`],
      ['Scene Meshes', `${meshes} (+${insts} Instanced)`],
      ['Scene Lights', `${lights}`],
      ['投射物 / 掉落物', `${(game.projs?.length || 0) + (game.eprojs?.length || 0)} / ${game.drops?.length || 0}`],
      ['地表元素區 / 光束', `${game.groundZones?.length || 0} / ${game.beams?.length || 0}`],
      ['JS Heap 記憶體', heapStr],
      ['玩家座標', `${game.player?.pos?.x?.toFixed(1) ?? 0}, ${game.player?.y?.toFixed(1) ?? 0}, ${game.player?.pos?.z?.toFixed(1) ?? 0}`],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function setTab(tab) {
    activeTab = tab;
    dock.querySelectorAll('.dbg-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    dock.querySelectorAll('.dbg-pane').forEach(p => p.classList.toggle('hide', p.dataset.pane !== tab));
    if (tab === 'errors' || tab === 'output') renderList();
    else if (tab === 'monitors') renderMonitors();
    else if (tab === 'vram') renderVram();
    else if (tab === 'mmo') syncMmoTab();
  }

  function toggle(force) {
    open = typeof force === 'boolean' ? force : !open;
    dock.classList.toggle('hide', !open);
    if (open) setTab(activeTab);
    return open;
  }

  dock.querySelectorAll('.dbg-tab').forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
  $d('dbgClose').onclick = () => toggle(false);
  $d('dbgClearErr').onclick = () => { errCount = 0; warnCount = 0; for (let i = logs.length - 1; i >= 0; i--) if (logs[i].level !== 'log') logs.splice(i, 1); updateBadge(); renderList(); };
  $d('dbgClearLog').onclick = () => { logs.length = 0; errCount = 0; warnCount = 0; updateBadge(); renderList(); };
  $d('dbgFilter').oninput = e => { filterText = e.target.value || ''; renderList(); };
  $d('dbgLvl').onchange = e => { filterLevel = e.target.value; renderList(); };
  $d('dbgCopyRep').onclick = () => {
    const info = game.pipe?.renderer?.info;
    const rep = {
      build: document.querySelector('meta[name="lv-build"]')?.content,
      zone: game.zone, fps: Number(smoothFps.toFixed(1)), frameMs: Number(smoothMs.toFixed(2)),
      drawCalls: info?.render?.calls, triangles: info?.render?.triangles,
      geometries: info?.memory?.geometries, textures: info?.memory?.textures,
      errors: logs.filter(l => l.level === 'error' || l.level === 'warn').slice(-30),
    };
    navigator.clipboard?.writeText(JSON.stringify(rep, null, 2)).catch(() => {});
    game.ui?.toast?.('📋 已複製除錯診斷報告至剪貼簿', '#7ae8ff');
  };
  // 浮動 🧪 DEV MODE 小標籤（僅開發者模式開啟時顯示，點擊直開測試台）
  const devPill = document.createElement('button');
  devPill.id = 'devPill';
  devPill.type = 'button';
  devPill.className = 'hide';
  devPill.textContent = '🧪 DEV MODE';
  devPill.title = '開發者模式運作中 · 點擊開啟測試台 (F3 / Shift+F3)';
  devPill.onclick = () => { toggle(true); setTab('tools'); };
  document.body.appendChild(devPill);

  function syncDevUI() {
    const dev = game.dev || (game.dev = { on: false, god: false, noCd: false, fastMove: false });
    const mBtn = $d('dbgDevMaster');
    if (mBtn) {
      mBtn.textContent = dev.on ? '🧪 DEV：開' : '🧪 DEV：關';
      mBtn.classList.toggle('on', !!dev.on);
    }
    devPill.classList.toggle('hide', !dev.on);
    const flags = [dev.god && '無敵', dev.noCd && '零CD', dev.fastMove && '2.2×速'].filter(Boolean);
    devPill.textContent = flags.length ? `🧪 DEV · ${flags.join(' / ')}` : '🧪 DEV MODE';
    const gBtn = $d('devGod'); if (gBtn) { gBtn.textContent = `🛡️ 無敵模式：${dev.god ? '開' : '關'}`; gBtn.classList.toggle('on', !!(dev.on && dev.god)); }
    const cBtn = $d('devNoCd'); if (cBtn) { cBtn.textContent = `⚡ 零冷卻＆無限魔力：${dev.noCd ? '開' : '關'}`; cBtn.classList.toggle('on', !!(dev.on && dev.noCd)); }
    const fBtn = $d('devFast'); if (fBtn) { fBtn.textContent = `🚀 跑圖 2.2× 速：${dev.fastMove ? '開' : '關'}`; fBtn.classList.toggle('on', !!(dev.on && dev.fastMove)); }
  }

  function setDevMode(on) {
    game.dev = game.dev || { on: false, god: false, noCd: false, fastMove: false };
    game.dev.on = typeof on === 'boolean' ? on : !game.dev.on;
    try { localStorage.setItem('lv_dev_mode', game.dev.on ? '1' : '0'); } catch (_) {}
    setDevRecording(game.dev.on);
    syncDevUI();
    game.ui?.toast?.(game.dev.on ? '🧪 開發者模式已開啟（按 F3 開啟測試台）' : '🧪 開發者模式已關閉，還原正常遊玩', game.dev.on ? '#7ef0ff' : '#e8dcc8');
  }

  // 若上次儲存為開發者模式則自動恢復開關狀態
  try { if (localStorage.getItem('lv_dev_mode') === '1') { game.dev.on = true; } } catch (_) {}
  syncDevUI();

  $d('dbgDevMaster').onclick = () => setDevMode();
  $d('devGod').onclick = () => { if (!game.dev.on) setDevMode(true); game.dev.god = !game.dev.god; syncDevUI(); };
  $d('devNoCd').onclick = () => { if (!game.dev.on) setDevMode(true); game.dev.noCd = !game.dev.noCd; syncDevUI(); };
  $d('devFast').onclick = () => { if (!game.dev.on) setDevMode(true); game.dev.fastMove = !game.dev.fastMove; syncDevUI(); };
  $d('devUnlockMap').onclick = () => {
    game.meta.p.visitedFields = Array.from({ length: 20 }, (_, i) => i + 1);
    game.meta.p.unlockedCps = game.meta.p.unlockedCps || {};
    for (let i = 1; i <= 20; i++) {
      const n = FIELD_BLUEPRINTS[i]?.checkpoints?.length || 3;
      game.meta.p.unlockedCps[i] = Array.from({ length: n }, (_, k) => k);
    }
    for (const cp of game.checkpoints || []) cp.unlocked = true;
    game.meta.save();
    game.ui?.toast?.('🏮 已解鎖全 22 座島嶼星燈與全部藍光檢查點！', '#ffd85a');
  };
  $d('devResetAll').onclick = () => openTextDialog({
    title: '清空本機存檔',
    description: '所有本機帳號、角色、裝備、進度和設定都會刪除，遊戲會重新載入。此操作無法復原。',
    action: '清空全部存檔',
    danger: true,
    submit() {
      try {
        const keepDev = localStorage.getItem('lv_dev_mode');
        const toDel = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('lv_') || k.startsWith('acct_'))) toDel.push(k);
        }
        for (const k of toDel) localStorage.removeItem(k);
        if (keepDev === '1') localStorage.setItem('lv_dev_mode', '1');
      } catch (_) {}
      location.reload();
    },
  });
  $d('dbgGoZone').onclick = () => {
    const v = zSel?.value || 'town';
    if (v === 'town') game.enterTown();
    else if (v === 'harbor') game.enterHarbor();
    else if (v.startsWith('f:')) game.enterField(Number(v.slice(2)));
  };
  $d('devDungeon').onclick = () => { game.field = 0; game.startRun?.(); };
  $d('devBoss').onclick = () => { game.field = 0; game.state = 'play'; game.loadRoom(9, 'boss'); };
  $d('devDay').onclick = () => { game.dayTime = ((game.dayTime || 0) + 0.5) % 1; game.ui?.toast?.('🌗 已切換晝夜時段', '#ffe9a0'); };
  $d('devRain').onclick = () => {
    if (game.weather) { game.weather.isRaining = !game.weather.isRaining; game.ui?.toast?.(game.weather.isRaining ? '🌧️ 已強制開啟降雨天氣' : '☀️ 已切換為晴朗天氣', '#7ae8ff'); }
  };
  $d('devTideSwarm').onclick = () => game.triggerTideDemo?.('swarm');
  $d('devTideApex').onclick = () => game.triggerTideDemo?.('apex');
  $d('devTideLull').onclick = () => game.triggerTideDemo?.('lull');
  $d('devElemTest').onclick = () => {
    const p = game.player;
    const tx = p.pos.x + Math.sin(p.facing) * 3.5, tz = p.pos.z + Math.cos(p.facing) * 3.5;
    game.spawnGroundZone?.('water', tx, tz, 3.6, 12);
    game.spawnEnemy?.('slime', { x: tx + 1.0, z: tz }, false);
    game.spawnEnemy?.('boar', { x: tx - 1.0, z: tz }, false);
    game.ui?.toast?.('⚡ 已於前方生成潮濕水窪＋魔物，施放冰／火／雷即可測試連鎖反應！', '#7ae8ff');
  };
  $d('devSpawnElite').onclick = () => {
    const p = game.player;
    game.spawnEnemy?.('boar', { x: p.pos.x + Math.sin(p.facing) * 4.5, z: p.pos.z + Math.cos(p.facing) * 4.5 }, true);
    game.ui?.toast?.('💀 已於前方生成詞綴精英怪！', '#ff8a6a');
  };
  $d('devClearMobs').onclick = () => {
    let n = 0;
    for (const e of game.enemies || []) if (!e.dead) { game.hitEnemy?.(e, { dmg: 999999, crit: true, fire: false }, 0, 0); n++; }
    game.ui?.toast?.(`💥 已清空場上 ${n} 隻魔物`, '#ffd85a');
  };
  $d('dbgHealFull').onclick = () => {
    game.player.hp = game.player.stats.maxHp;
    game.player.mana = game.player.stats.mana;
    game.player.flask.charges = game.player.flask.max;
    game.ui?.toast?.('❤️ 已補滿生命、魔力與蜜藥瓶', '#7fe08a');
  };
  $d('devLvUp').onclick = () => {
    game.meta.p.level = Math.min(30, (game.meta.p.level || 1) + 5);
    game.meta.save(); game.recalc?.();
    game.ui?.toast?.(`⬆️ 旅人等級已提升至 Lv.${game.meta.p.level}`, '#ffd85a');
  };
  $d('dbgGiveRes').onclick = () => {
    game.meta.p.coins += 1000; game.meta.p.shards += 1000; game.meta.p.keys = (game.meta.p.keys || 0) + 10; game.meta.save();
    game.ui?.toast?.('💰 已增加 1000 金幣、1000 星砂與 10 把鑰石', '#ffd85a');
  };
  $d('devLegend').onclick = () => {
    const p = game.player;
    const it = makeItem(Math.random, 8, 3);
    game.dropItem?.(p.pos.x + 1.5, p.pos.z + 1.5, it);
    game.ui?.toast?.(`🎁 已掉落傳說裝備：${it.name}`, '#ffaa38');
  };
  $d('devAllGems').onclick = () => {
    for (const gid of Object.keys(ALL_GEMS)) addGemToBag(game.meta.p, gid);
    game.meta.save();
    game.ui?.toast?.(`💎 已獲得全套 ${Object.keys(ALL_GEMS).length} 顆拼圖寶石（按 K 檢視）`, '#c08cff');
  };
  $d('devAllSouls').onclick = () => {
    for (const sid of Object.keys(MONSTER_SOULS)) grantSoul(game.meta.p, sid);
    game.meta.save();
    game.ui?.toast?.(`👻 已解鎖全部 ${Object.keys(MONSTER_SOULS).length} 種怪物靈魂（按 I → 靈魂）`, '#d8a8ff');
  };
  $d('devAllMounts').onclick = () => {
    game.meta.p.visitedFields = Array.from({ length: 20 }, (_, i) => i + 1);
    game.meta.p.kills = Math.max(game.meta.p.kills || 0, 200);
    game.meta.p.best = game.meta.p.best || { depth: 0, wins: 0 };
    game.meta.p.best.wins = Math.max(game.meta.p.best.wins || 0, 1);
    game.meta.p.feathers = Math.max(game.meta.p.feathers || 0, 10);
    game.meta.save();
    game.ui?.toast?.(`🦌 已達成全部 ${MOUNTS.length} 種坐騎解鎖條件（按 G 或 I → 坐騎）`, '#7fe08a');
  };
  $d('dbgChargeUlt').onclick = () => {
    if (game.tide) game.tide.ultCharge = 100;
    game.ui?.toast?.('⚡ 餘燼大絕 [V] 已充能至 100%', '#ff984a');
  };
  $d('devSpark5').onclick = () => {
    if (game.autopilot) { game.autopilot.sparkStacks = 5; game.autopilot.sparkBuffT = 150; }
    game.ui?.toast?.('🔥 已獲得 5 層手動星火＆150 秒歸來爆發 ×1.5！', '#ffd85a');
  };
  $d('dbgTogAuto').onclick = () => game.toggleAutopilot?.();
  const syncMmoTab = () => {
    const list = getSimAdventurers(game), cfg = getSimConfig(game);
    const visN = list.filter(a => a.m?.root?.visible !== false).length;
    const st = $d('dbgMmoStat');
    if (st) st.textContent = `可見 ${visN} / 全圖 ${list.length} 位 · 模式：${cfg.mode} · ${smoothFps.toFixed(0)} FPS`;
    const ch = $d('dbgMmoChat');
    if (ch) { ch.textContent = `💬 世界頻：${cfg.worldChat ? '開' : '關'}`; ch.classList.toggle('on', !!cfg.worldChat); }
    dock.querySelectorAll('[data-mmo-mode]').forEach(b => b.classList.toggle('on', b.dataset.mmoMode === cfg.mode));
    dock.querySelectorAll('[data-mmo-cnt]').forEach(b => b.classList.toggle('on', Number(b.dataset.mmoCnt) === list.length));
  };
  dock.querySelectorAll('[data-mmo-cnt]').forEach(b => b.onclick = () => {
    const n = Number(b.dataset.mmoCnt);
    setSimConfig(game, { count: n });
    game.ui?.toast?.(n === 0 ? '👥 已關閉虛擬 MMO 玩家' : `👥 已於全圖生成 ${n} 位虛擬 MMO 玩家`, '#7ae8ff');
    syncMmoTab();
  });
  dock.querySelectorAll('[data-mmo-mode]').forEach(b => b.onclick = () => {
    setSimConfig(game, { mode: b.dataset.mmoMode });
    game.ui?.toast?.(`🧭 虛擬玩家模式切換為：${b.textContent}`, '#ffd85a');
    syncMmoTab();
  });
  dock.querySelectorAll('[data-mmo-ev]').forEach(b => b.onclick = () => {
    triggerSimEvent(game, b.dataset.mmoEv);
    syncMmoTab();
  });
  const mmoChatBtn = $d('dbgMmoChat');
  if (mmoChatBtn) mmoChatBtn.onclick = () => { const c = getSimConfig(game); setSimConfig(game, { worldChat: !c.worldChat }); syncMmoTab(); };
  const mmoRosBtn = $d('dbgMmoRoster');
  if (mmoRosBtn) mmoRosBtn.onclick = () => game.ui?.toggleSimRoster?.(game, true);
  const mmoMapBtn = $d('dbgMmoMap');
  if (mmoMapBtn) mmoMapBtn.onclick = () => game.ui?.toggleRegionMap?.(game);
  syncMmoTab();

  // 🎛 調校面板（滑桿 / 開關 / 按鈕 / 匯出匯入），見 dev_tuner.js
  const tuner = installDevTuner(game, {
    ensureDev: () => { if (!game.dev.on) setDevMode(true); },
    sync: syncDevUI,
    toast: (m, c) => game.ui?.toast?.(m, c),
    getStats: () => {
      const info = game.pipe?.renderer?.info;
      return { fps: smoothFps, frameMs: smoothMs, drawCalls: info?.render?.calls, triangles: info?.render?.triangles };
    },
  });
  $d('dbgTuneOpen').onclick = () => tuner.toggle(true);

  // 快捷鍵：F3 = 底部除錯列；` = 調校面板；Shift+F3 = 快速切換開發者模式
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (e.key === 'F3' && e.shiftKey) {
      e.preventDefault();
      setDevMode();
      return;
    }
    if (e.code === 'Backquote') {
      e.preventDefault();
      tuner.toggle();
      return;
    }
    if (e.key === 'F3') {
      e.preventDefault();
      toggle();
    }
  });

  return {
    allowed: true,
    tuner,
    toggle,
    setDevMode,
    onZoneLoaded: () => setTimeout(() => tuner.reapply(), 60),
    openTools: () => { toggle(true); setTab('tools'); },
    isOpen: () => open,
    getCounts: () => ({ errors: errCount, warnings: warnCount, total: logs.length }),
    log: (msg) => {
      pushLog('log', [msg]);
      recordDevEvent('log', 'game', [msg]);
    },
    recordFrame(dtSec, updateMs, renderMs) {
      const ms = Math.max(0.1, dtSec * 1000);
      const fps = 1000 / ms;
      smoothMs = smoothMs * 0.9 + ms * 0.1;
      smoothFps = smoothFps * 0.9 + fps * 0.1;
      lastUpdateMs = lastUpdateMs * 0.85 + updateMs * 0.15;
      lastRenderMs = lastRenderMs * 0.85 + renderMs * 0.15;
      fpsHist[histPtr] = fps;
      msHist[histPtr] = ms;
      histPtr = (histPtr + 1) % HIST_LEN;

      if (!open) return;
      const now = performance.now();
      if (now - lastRefresh < 220) return; // 面板展開時節流至 ~4.5Hz 更新，零卡頓
      lastRefresh = now;
      const mini = $d('dbgMiniFps');
      if (mini) mini.textContent = `${smoothFps.toFixed(0)} FPS · ${smoothMs.toFixed(1)}ms`;
      if (activeTab === 'monitors') renderMonitors();
      else if (activeTab === 'vram') renderVram();
    },
  };
}
