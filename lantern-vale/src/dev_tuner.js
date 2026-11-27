// 開發者調校面板（Dev Tuner）：邊玩邊調參數，滿意後存檔 / 匯出 JSON。
// 靈感：「AI 寫程式，人用手感調參數」—— 把常用參數做成滑桿、開關和按鈕。
// 與 debugger.js 的 F3 底部工具列並存：F3 = 日誌與效能，` (反引號) = 本面板（畫面右側，不遮遊戲）。
// 只在 Dev 允許時安裝（見 debugger.js 的 devAllowed）。公開版需加 ?dev 才會出現。
import { FLAME_CFG, findRespawn } from './flame.js';
import { FIELDS } from './frontier.js';
import { makeItem, RARITY } from './loot.js';
import { windU } from './world.js';
import { ENEMY_NAMES } from './hover.js';
import { createArt, ART_GROUPS, BUILTIN_PRESETS } from './dev_art.js';

const STORE_KEY = 'lv_dev_tune';
const PRESET_KEY = 'lv_dev_art_presets';
const FORMAT = 'beaconfall-devtune';
const SPAWN_TYPES = ['slime', 'thorn', 'boar', 'moth', 'skyray', 'golem', 'stag'];

const clone = o => JSON.parse(JSON.stringify(o));
const isLocalHost = () => /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);

function niceMax(def) {
  if (!(def > 0)) return 1;
  const raw = def * 3, e = Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.ceil(raw / e) * e;
}
function niceStep(max, def) {
  if (Number.isInteger(def) && def >= 5) return 1;
  const s = max / 200, e = Math.pow(10, Math.floor(Math.log10(s)));
  return s >= 5 * e ? 5 * e : s >= 2 * e ? 2 * e : e;
}
const fmt = v => (typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v));

/** @param {object} game  @param {{ensureDev:()=>void, toast:(m:string,c?:string)=>void, getStats:()=>object}} hooks */
export function installDevTuner(game, hooks) {
  const toast = (m, c) => hooks.toast?.(m, c);
  game.devTune = game.devTune || { cam: {}, freezeTime: false, sunMul: 1, hemiMul: 1 };
  const dt = game.devTune;

  // ───────────── 參數表 ─────────────
  const params = [];
  const byId = new Map();
  let defsReady = false;
  const add = p => { params.push(p); byId.set(p.id, p); return p; };

  let art = null;
  // 需要重建場景才看得到的改動（群系頂點色、植被大小/密度）
  let rebuildCount = 0, rebuildTimer = 0;
  function markRebuild() {
    rebuildCount++;
    if (dt.autoRebuild === false) { refresh(false); return; }
    clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 900);
    refresh(false);
  }
  function rebuild() {
    clearTimeout(rebuildTimer);
    if (!rebuildCount) return;
    if (game.state !== 'play' && game.state !== 'title') return;
    const z = game.zone || '';
    try {
      if (/^town/.test(z)) game.enterTown(); else if (/^harbor/.test(z)) game.enterHarbor(); else if (game.field > 0) game.enterField(game.field);
      else { toast('目前是副本／試煉場景，請手動重新進入以套用場景顏色', '#ffd85a'); return; }
      rebuildCount = 0; toast('🔄 已重建場景，套用新顏色／植被', '#7ae8ff');
    } catch (e) { console.warn('[DevTuner] 重建場景失敗', e); }
    refresh(false);
  }

  const lockOnline = () => !!(game.net?.ok && !isLocalHost());

  function buildParams() {
    // 🔥 Flame：data/flame.json 的所有數字／布林（直接改 FLAME_CFG 物件，下一幀就生效）
    const walk = (obj, path) => {
      for (const k of Object.keys(obj)) {
        if (k === 'variants' || k.startsWith('_')) continue;
        const v = obj[k], p = [...path, k];
        if (v && typeof v === 'object') walk(v, p);
        else if (typeof v === 'number' || typeof v === 'boolean') {
          const holder = () => p.slice(0, -1).reduce((o, key) => o[key], FLAME_CFG);
          const max = typeof v === 'number' ? niceMax(Math.abs(v)) : 0;
          add({
            id: 'flame.' + p.join('.'), group: 'flame', label: p.join(' · '),
            type: typeof v === 'boolean' ? 'toggle' : 'range',
            min: 0, max, step: typeof v === 'number' ? niceStep(max, v) : 1,
            get: () => holder()[k], set: x => { holder()[k] = x; },
          });
        }
      }
    };
    walk(FLAME_CFG, []);

    // 🎥 鏡頭
    const camP = (key, label, min, max, step, defGet) => add({
      id: 'cam.' + key, group: 'cam', label, type: 'range', min, max, step,
      get: () => dt.cam[key] ?? defGet(), set: x => { if (Math.abs(x - defGet()) < 1e-9) delete dt.cam[key]; else dt.cam[key] = x; },
    });
    const preset = () => (game.settings?.camAngle ? { yK: 0.52, zK: 0.85, fov: 38 } : { yK: 0.68, zK: 0.73, fov: 34 });
    camP('yaw', '水平角度 yaw (rad)', 0, 6.28, 0.01, () => 0.62);
    camP('yK', '仰角高度係數', 0.15, 1.4, 0.01, () => preset().yK);
    camP('zK', '後退距離係數', 0.3, 1.4, 0.01, () => preset().zK);
    camP('fov', '視野 FOV', 18, 75, 0.5, () => preset().fov);
    camP('dist', '鏡頭距離倍率', 0.4, 2, 0.01, () => 1);

    // 💡 光照 / 時辰
    add({ id: 'light.sunMul', group: 'light', label: '太陽強度 ×', type: 'range', min: 0, max: 3, step: 0.01, get: () => dt.sunMul, set: x => { dt.sunMul = x; } });
    add({ id: 'light.hemiMul', group: 'light', label: '環境光強度 ×', type: 'range', min: 0, max: 3, step: 0.01, get: () => dt.hemiMul, set: x => { dt.hemiMul = x; } });
    add({ id: 'light.freezeTime', group: 'light', label: '凍結晝夜流動', type: 'toggle', get: () => dt.freezeTime, set: x => { dt.freezeTime = x; } });
    add({ id: 'time.dayTime', group: 'light', label: '時辰 (0 晨 → 0.4 午 → 0.82 昏 → 0.94 夜)', type: 'range', min: 0, max: 0.999, step: 0.005, volatile: true, get: () => game.dayTime ?? 0.28, set: x => { game.dayTime = x; } });
    add({ id: 'light.shadows', group: 'light', label: '即時陰影', type: 'toggle', get: () => !!game.sun?.castShadow, set: x => { if (game.sun) game.sun.castShadow = x; } });

    // 🖥 渲染 / 像素
    const U = () => game.pipe?.postMat?.uniforms;
    add({ id: 'render.pixel', group: 'render', label: '像素倍率（1 = 高清，2+ = 低解析像素）', type: 'range', min: 1, max: 6, step: 1, get: () => game.pipe?.pixelScale ?? 2, set: x => { if (game.pipe && game.pipe.pixelScale !== x) game.pipe.setPixelScale(x); } });
    add({ id: 'render.sat', group: 'render', label: '色彩飽和度', type: 'range', min: 0, max: 2.5, step: 0.01, get: () => U()?.uSat.value ?? 1.13, set: x => { if (U()) U().uSat.value = x; } });
    add({ id: 'render.shafts', group: 'render', label: '光柱強度', type: 'range', min: 0, max: 4, step: 0.05, get: () => U()?.uShaftK.value ?? 1, set: x => { if (U()) U().uShaftK.value = x; } });
    add({ id: 'render.cloud', group: 'render', label: '雲影濃度', type: 'range', min: 0, max: 1.5, step: 0.01, get: () => U()?.uCloud.value ?? 1, set: x => { if (U()) U().uCloud.value = x; } });
    add({ id: 'render.wind', group: 'render', label: '風吹草動強度', type: 'range', min: 0, max: 4, step: 0.05, get: () => windU.uWindStr.value, set: x => { windU.uWindStr.value = x; } });
    add({ id: 'render.water', group: 'render', label: '水面特效', type: 'toggle', get: () => (game.world?.waterMat?.uniforms?.uWater?.value ?? 1) > 0, set: x => { const m = game.world?.waterMat; if (m) m.uniforms.uWater.value = x ? 1 : 0; } });

    // 🔊 音量（0–10，與設定頁同刻度；不改寫設定頁存檔）
    const vol = (key, label, idx) => add({
      id: 'audio.' + key, group: 'audio', label, type: 'range', min: 0, max: 10, step: 1,
      get: () => dt.vol?.[key] ?? game.settings?.[key] ?? 8,
      set: x => {
        dt.vol = { ...(dt.vol || {}), [key]: x };
        const v = k => (dt.vol[k] ?? game.settings?.[k] ?? 8) / 10;
        game.audio?.setVolumes(v('master'), v('music'), v('sfx'));
      },
    });
    vol('master', '主音量', 0); vol('music', '音樂', 1); vol('sfx', '音效', 2);

    // ⚔️ 玩家
    const dev = () => (game.dev || (game.dev = { on: false, god: false, noCd: false, fastMove: false }));
    add({ id: 'dev.god', group: 'player', label: '🛡️ 無敵', type: 'toggle', online: true, volatile: true, get: () => !!dev().god, set: x => { hooks.ensureDev(); dev().god = x; hooks.sync(); } });
    add({ id: 'dev.noCd', group: 'player', label: '⚡ 零冷卻＆無限魔力', type: 'toggle', online: true, volatile: true, get: () => !!dev().noCd, set: x => { hooks.ensureDev(); dev().noCd = x; hooks.sync(); } });
    add({ id: 'dev.speedMul', group: 'player', label: '🚀 移動速度倍率', type: 'range', min: 0.3, max: 5, step: 0.05, online: true, get: () => dev().speedMul ?? 1, set: x => { hooks.ensureDev(); if (Math.abs(x - 1) < 1e-9) delete dev().speedMul; else dev().speedMul = x; hooks.sync(); } });
    add({ id: 'player.level', group: 'player', label: '旅人等級', type: 'range', min: 1, max: 30, step: 1, online: true, volatile: true, get: () => game.meta?.p?.level || 1, set: x => { game.meta.p.level = x; game.meta.save(); game.recalc?.(); } });

    // 🎨 美術風格模組（dev_art.js）：同 id 的舊參數由新版取代
    art = createArt(game, dt, { markRebuild, windU });
    for (const p of art.params) {
      const old = byId.get(p.id);
      if (old) params.splice(params.indexOf(old), 1);
      add(p);
    }
    const wt = byId.get('render.water'); if (wt) wt.group = 'art-water';
  }

  function ensureDefs() {
    if (defsReady) return;
    buildParams();
    for (const p of params) p.def = p.get();
    defsReady = true;
  }

  // desired：使用者想要的調校值（場景重建會重設 uniform，所以要記著，載入區域後重套）
  const desired = {};
  const sameVal = (a, b) => (typeof a === 'string' || typeof b === 'string') ? String(a).toLowerCase() === String(b).toLowerCase() : Math.abs(Number(a) - Number(b)) < 1e-9;
  function setParam(p, x) {
    p.set(x);
    if (p.volatile) return;
    if (sameVal(x, p.def)) delete desired[p.id]; else desired[p.id] = x;
  }
  /** 群系色盤項：id = pal.<all|biomeKey>.<prop> */
  function setPalId(id, val) {
    const [, scope, key] = id.split('.');
    if (val === null || val === undefined) { art.clearPal(scope, key); delete desired[id]; } else if (art.setPal(scope, key, val)) desired[id] = val;
  }
  function snapshot() { ensureDefs(); return { ...desired }; }
  function applyValues(values) {
    ensureDefs();
    let n = 0;
    for (const [id, val] of Object.entries(values || {})) {
      if (id.startsWith('pal.')) { try { setPalId(id, val); n++; } catch (_) {} continue; }
      const p = byId.get(id);
      if (!p || p.volatile) continue;
      const x = p.type === 'toggle' ? !!val : p.type === 'color' ? String(val) : Number(val);
      if (p.type === 'range' && !Number.isFinite(x)) continue;
      try { setParam(p, x); n++; } catch (_) { /* 場景尚未就緒，略過 */ }
    }
    return n;
  }
  function resetAll() {
    ensureDefs();
    for (const p of params) if (!p.volatile) { try { setParam(p, p.def); } catch (_) {} }
    dt.cam = {}; dt.vol = undefined;
    art?.clearAllPal();
    for (const k of Object.keys(desired)) delete desired[k];
  }
  const flameChanged = () => Object.keys(desired).some(id => id.startsWith('flame.'));

  // ───────────── 儲存 / 匯出 / 匯入 ─────────────
  function buildExport() {
    const out = {
      format: FORMAT, version: 1,
      build: document.querySelector('meta[name="lv-build"]')?.content || null,
      savedAt: new Date().toISOString(),
      values: snapshot(),
    };
    if (flameChanged()) out.flame = clone(FLAME_CFG); // 可直接整份貼回 data/flame.json
    return out;
  }
  function readStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) { return null; } }
  function saveLocal() {
    const prev = readStore();
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ auto: prev?.auto !== false, values: snapshot() })); } catch (_) { toast('⚠️ 無法寫入 localStorage', '#ff8a8a'); return; }
    toast(`💾 已儲存 ${Object.keys(snapshot()).length} 項調校到本機（重新整理後${prev?.auto === false ? '不會' : '會'}自動套用）`, '#7fe08a');
  }
  function importJson(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (_) { toast('⚠️ JSON 格式錯誤', '#ff8a8a'); return false; }
    const values = obj?.format === FORMAT ? obj.values : obj?.values || obj;
    if (!values || typeof values !== 'object') { toast('⚠️ 找不到可匯入的內容', '#ff8a8a'); return false; }
    const n = applyValues(values);
    toast(`📥 已匯入 ${n} 項調校`, '#7fe08a');
    refresh(true);
    return true;
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportJson() {
    const text = JSON.stringify(buildExport(), null, 2);
    try { await navigator.clipboard?.writeText(text); } catch (_) {}
    download('beaconfall-devtune.json', text);
    toast('📤 已匯出並複製到剪貼簿（beaconfall-devtune.json）', '#7ae8ff');
  }
  async function writeFlameToServer() {
    try {
      const r = await fetch('/__dev/tune', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ flame: clone(FLAME_CFG) }) });
      if (!r.ok) throw Error(String(r.status));
      const j = await r.json();
      toast(`🖥 已寫入 data/flame.json（${j.changed} 項改動），請 npm run build 後生效`, '#7fe08a');
    } catch (e) { toast('⚠️ 寫入失敗：只有本機伺服器（localhost）支援 · ' + e.message, '#ff8a8a'); }
  }

  // A/B 即時對照
  let slotA = null, slotB = null, curAB = '';
  function abSet(which) { if (which === 'A') slotA = snapshot(); else slotB = snapshot(); toast(`📌 已記為 ${which} 組（${Object.keys(which === 'A' ? slotA : slotB).length} 項）`, '#ffd85a'); refresh(true); }
  function abToggle() {
    if (!slotA || !slotB) { toast('請先分別記錄 A、B 兩組', '#ff8a8a'); return; }
    const next = curAB === 'A' ? 'B' : 'A';
    resetAll(); applyValues(next === 'A' ? slotA : slotB);
    curAB = next; toast(`🔀 目前顯示：${next} 組`, '#ffd85a'); refresh(true);
  }

  // ───────────── 動作（按鈕）─────────────
  const isTownLike = () => /^(town|harbor|title)/.test(game.zone || '');
  const around = (r0, r1) => {
    const p = game.player, ang = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0);
    const pos = { x: p.pos.x + Math.cos(ang) * r, z: p.pos.z + Math.sin(ang) * r };
    return game.world?.isWalk?.(pos.x, pos.z) === false ? game.world.randomWalkable(Math.random, p.pos, r1) : pos;
  };
  function spawn(type, count, elite) {
    if (game.state !== 'play' || isTownLike()) { toast('請先進入野外或副本再生怪', '#ff8a8a'); return; }
    for (let i = 0; i < count; i++) game.spawnEnemy?.(type, around(5, 11), elite);
    toast(`👾 已生成 ${count} 隻 ${ENEMY_NAMES?.[type] || type}${elite ? '（精英）' : ''}`, '#ffd85a');
  }
  function killAll() {
    let n = 0;
    for (const e of game.enemies || []) if (!e.dead) { game.hitEnemy?.(e, { dmg: 999999, crit: true, fire: false }, 0, 0); n++; }
    toast(`💥 已清空場上 ${n} 隻魔物`, '#ffd85a');
  }
  function tpTo(x, z) {
    const p = game.player, y = game.world?.gh?.(x, z) ?? 0;
    p.pos.set(x, y, z); p.y = y; p.vel?.set(0, 0, 0); p.vy = 0;
    p.air = p.climbing = p.gliding = false; p.roll = 0; p.sitting = null;
    p.lastLow?.set(x, y, z); game.camPos?.set?.(x, 0, z);
  }
  function goZone(v) {
    if (v === 'town') game.enterTown(); else if (v === 'harbor') game.enterHarbor(); else if (v.startsWith('f:')) game.enterField(Number(v.slice(2)));
  }

  // ───────────── DOM ─────────────
  const css = document.createElement('style');
  css.textContent = `
#devTuneBtn{position:fixed;right:8px;top:calc(104px + env(safe-area-inset-top,0px));opacity:.8;z-index:995;width:38px;height:38px;border-radius:50%;border:2px solid #58d4ff;background:#163848e6;color:#bff4ff;font-size:19px;line-height:1;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.45);padding:0;touch-action:manipulation}
#devTuneBtn.on{background:#236c8a}
#devTune{position:fixed;top:0;right:0;bottom:0;width:min(372px,100vw);z-index:996;background:#14171ef2;color:#dfe4ee;border-left:2px solid #4c5264;display:flex;flex-direction:column;font:12px/1.35 var(--font-ui,system-ui,sans-serif);box-shadow:-6px 0 24px rgba(0,0,0,.55);pointer-events:auto;touch-action:pan-y}
#devTune.hide{display:none}
#devTune *{box-sizing:border-box}
#devTune header{display:flex;align-items:center;gap:8px;padding:7px 10px;background:#0f1218;border-bottom:1px solid #353947;flex-shrink:0}
#devTune header b{font-size:13px;flex:1;white-space:nowrap}
#dtPerf{color:#8fe3a8;font-variant-numeric:tabular-nums;font-size:10.5px;white-space:nowrap}
#devTune button{font:inherit;font-weight:700;color:#e8edf8;background:#2a3040;border:1px solid #4c5264;border-radius:5px;padding:5px 8px;cursor:pointer;min-height:28px}
#devTune button:hover:not(:disabled){background:#364058}
#devTune button.on{background:#236c8a;border-color:#7ef0ff}
#devTune button:disabled{opacity:.4;cursor:not-allowed}
#dtBody{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:6px 8px 10px}
#dtBanner{margin:4px 0 6px;padding:5px 8px;border-radius:5px;background:#5a2a14;border:1px solid #ff9a4a;color:#ffd9b8}
#dtBanner.hide{display:none}
#devTune details{margin:0 0 6px;border:1px solid #333a4a;border-radius:6px;background:#1a1e28}
#devTune summary{cursor:pointer;padding:6px 9px;font-weight:800;font-size:12.5px;list-style:none;user-select:none}
#devTune summary::-webkit-details-marker{display:none}
#devTune summary::before{content:'▸ ';color:#7ef0ff}
#devTune details[open] summary::before{content:'▾ '}
.dt-sec{padding:2px 9px 9px;display:flex;flex-direction:column;gap:6px}
.dt-row{display:grid;grid-template-columns:1fr auto auto;gap:2px 6px;align-items:center}
.dt-row input[type=color]{width:100%;height:26px;padding:0;border:1px solid #4c5264;border-radius:4px;background:none;cursor:pointer}
.dt-row .dt-hex{width:76px;background:#0f1218;color:#dfe4ee;border:1px solid #4c5264;border-radius:4px;padding:3px 4px;font:11px monospace}
.dt-row .dt-reset{min-height:24px;padding:2px 7px}
#dtArt summary{font-size:13.5px;color:#ffd85a}
#devTune details details{background:#151922;margin-top:4px}
.dt-row label{grid-column:1/-1;color:#b9c1d4;font-size:11px;overflow-wrap:anywhere}
.dt-row.mod label::after{content:' ●';color:#ffd25a}
.dt-row input[type=range]{width:100%;min-width:0;height:22px;accent-color:#58d4ff}
.dt-row input[type=number]{width:70px;background:#0f1218;color:#dfe4ee;border:1px solid #4c5264;border-radius:4px;padding:3px 4px;font:inherit}
.dt-row .dt-tg{grid-column:1/-1}
.dt-btns{display:flex;flex-wrap:wrap;gap:5px}
.dt-btns select,.dt-btns input[type=number]{background:#0f1218;color:#dfe4ee;border:1px solid #4c5264;border-radius:4px;padding:4px;font:inherit;min-width:0}
.dt-btns label{display:flex;align-items:center;gap:3px}
.dt-reset{margin-left:auto}
#dtImport{width:100%;height:90px;background:#0f1218;color:#dfe4ee;border:1px solid #4c5264;border-radius:4px;font:11px/1.3 monospace;padding:4px}
#devTune footer{flex-shrink:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:#0f1218;border-top:1px solid #353947;display:flex;flex-wrap:wrap;gap:5px}
@media(max-width:600px){#devTune{width:100vw}}`;
  document.head.appendChild(css);

  const panel = document.createElement('div');
  panel.id = 'devTune'; panel.className = 'hide';
  panel.innerHTML = `
    <header><b>🎛 開發者調校面板</b><span id="dtPerf">—</span><button type="button" id="dtClose" title="關閉（反引號鍵）">✕</button></header>
    <div id="dtBody"></div>
    <footer>
      <button type="button" id="dtSave" title="存到瀏覽器 localStorage，重新整理後自動套用">💾 儲存</button>
      <button type="button" id="dtExport" title="下載 JSON 並複製，可傳給 Alan／AI 套回 data">📤 匯出</button>
      <button type="button" id="dtImportBtn">📥 匯入</button>
      <button type="button" id="dtAuto" title="重新整理後是否自動套用已儲存的調校">自動套用：開</button>
      <button type="button" id="dtResetAll">↩ 全部還原</button>
    </footer>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('#dtBody');
  const q = s => panel.querySelector(s);

  const GROUPS = [
    ['flame', '🔥 Flame / 光圈（data/flame.json）', false],
    ['cam', '🎥 鏡頭', true],
    ['light', '⏱ 時辰', false],
    ['audio', '🔊 音量', false],
    ['player', '🧙 玩家（無敵、速度、等級）', false],
  ];
  const rows = new Map(); // id → {row, input, num, mark}
  const ctlHtml = id => `data-id="${id}"`;

  function rowFor(p) {
    const row = document.createElement('div');
    row.className = 'dt-row';
    if (p.type === 'toggle') {
      row.innerHTML = `<button type="button" class="dt-tg" ${ctlHtml(p.id)}></button>`;
      const b = row.querySelector('button');
      b.onclick = () => { if (p.online && lockOnline()) return; setParam(p, !p.get()); refresh(true); };
      rows.set(p.id, { row, input: b, p });
    } else if (p.type === 'color') {
      row.innerHTML = `<label></label><input type="color" class="dt-col"><input type="text" class="dt-hex" maxlength="7" spellcheck="false">`;
      row.querySelector('label').textContent = p.label;
      const c = row.querySelector('.dt-col'), t = row.querySelector('.dt-hex');
      const apply = v => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; setParam(p, v); c.value = v; t.value = v; row.classList.toggle('mod', p.id in desired); };
      c.oninput = () => apply(c.value);
      t.onchange = () => apply(t.value.startsWith('#') ? t.value : '#' + t.value);
      rows.set(p.id, { row, input: c, num: t, p });
    } else {
      row.innerHTML = `<label></label><input type="range" min="${p.min}" max="${p.max}" step="${p.step}"><input type="number" step="${p.step}"><button type="button" class="dt-reset" hidden>↺</button>`;
      row.querySelector('label').textContent = p.label;
      const r = row.querySelector('input[type=range]'), n = row.querySelector('input[type=number]');
      const apply = v => { if (p.online && lockOnline()) return; if (!Number.isFinite(v)) return; setParam(p, v); r.value = v; n.value = fmt(v); row.classList.toggle('mod', p.id in desired); };
      r.oninput = () => apply(Number(r.value));
      n.onchange = () => { const v = Number(n.value); if (v > Number(r.max)) r.max = v; apply(v); };
      rows.set(p.id, { row, input: r, num: n, p });
    }
    return row;
  }

  function actionBtn(label, fn, { online = false, title = '' } = {}) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; if (title) b.title = title;
    if (online) b.dataset.online = '1';
    b.onclick = () => { if (online && lockOnline()) return; fn(); };
    return b;
  }


  // ───────────── 🎨 美術風格區 + 風格預設 ─────────────
  const presetStore = () => { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); } catch (_) { return {}; } };
  const allPresets = () => ({ ...BUILTIN_PRESETS, ...presetStore() });
  function loadPreset(name) {
    const pr = allPresets()[name]; if (!pr) return;
    resetAll(); applyValues(pr.values || {}); curAB = '';
    toast(`🎨 已載入風格預設「${name}」`, '#7ae8ff'); refresh(true);
  }
  function savePreset(name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) { toast('請先輸入預設名稱', '#ff8a8a'); return false; }
    if (BUILTIN_PRESETS[name]) { toast('不能覆蓋內建預設，請換個名稱', '#ff8a8a'); return false; }
    const st = presetStore(); st[name] = { values: snapshot(), note: '自訂預設', savedAt: new Date().toISOString() };
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(st)); } catch (_) { toast('⚠️ 無法寫入 localStorage', '#ff8a8a'); return false; }
    toast(`💾 已儲存風格預設「${name}」（${Object.keys(st[name].values).length} 項）`, '#7fe08a'); return true;
  }
  function deletePreset(name) {
    const st = presetStore(); if (!(name in st)) { toast('內建預設不能刪除', '#ff8a8a'); return; }
    delete st[name]; try { localStorage.setItem(PRESET_KEY, JSON.stringify(st)); } catch (_) {}
    toast(`🗑 已刪除預設「${name}」`, '#e8dcc8');
  }
  function compareWithPreset(name) {
    const pr = allPresets()[name]; if (!pr) return;
    slotA = snapshot(); slotB = { ...(pr.values || {}) }; curAB = 'A';
    toast(`🔀 A＝目前設定，B＝「${name}」；按「切換 A⇄B」即時對照`, '#ffd85a'); refresh(true);
  }

  let presetSel, presetName, scopeSel, palRows = [];
  function fillPresets() {
    if (!presetSel) return;
    const keep = presetSel.value, st = presetStore();
    presetSel.innerHTML = `<optgroup label="內建">${Object.keys(BUILTIN_PRESETS).map(n => `<option>${n}</option>`).join('')}</optgroup>` +
      (Object.keys(st).length ? `<optgroup label="自訂">${Object.keys(st).map(n => `<option>${n.replace(/</g, '&lt;')}</option>`).join('')}</optgroup>` : '');
    if (keep && [...presetSel.options].some(o => o.value === keep)) presetSel.value = keep;
  }
  function paletteRow(p) {
    const type = art.palType(p), row = document.createElement('div'); row.className = 'dt-row';
    const scope = () => scopeSel.value;
    const id = () => `pal.${scope()}.${p.key}`;
    if (type === 'color') {
      row.innerHTML = '<label></label><input type="color" class="dt-col"><input type="text" class="dt-hex" maxlength="7" spellcheck="false"><button type="button" class="dt-reset" title="清除此項覆寫">↺</button>';
      const c = row.querySelector('.dt-col'), t = row.querySelector('.dt-hex');
      const apply = v => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; setPalId(id(), v); c.value = v; t.value = v; row.classList.add('mod'); };
      c.oninput = () => apply(c.value); t.onchange = () => apply(t.value.startsWith('#') ? t.value : '#' + t.value);
      palRows.push({ row, p, c, t });
    } else {
      row.innerHTML = `<label></label><input type="range" min="${p.min}" max="${p.max}" step="${p.step}"><input type="number" step="${p.step}"><button type="button" class="dt-reset" title="清除此項覆寫">↺</button>`;
      const r = row.querySelector('input[type=range]'), n = row.querySelector('input[type=number]');
      const apply = v => { if (!Number.isFinite(v)) return; setPalId(id(), v); r.value = v; n.value = fmt(v); row.classList.add('mod'); };
      r.oninput = () => apply(Number(r.value)); n.onchange = () => apply(Number(n.value));
      palRows.push({ row, p, r, n });
    }
    row.querySelector('label').textContent = p.label + (p.live ? '' : ' 🔄');
    row.querySelector('.dt-reset').onclick = () => { setPalId(id(), null); refresh(true); };
    return row;
  }
  function refreshPalette(force) {
    for (const o of palRows) {
      const v = art.palShow(scopeSel.value, o.p);
      const foc = document.activeElement;
      if (o.c) { if (force || (foc !== o.c && foc !== o.t)) { o.c.value = v; o.t.value = v; } } else if (force || (foc !== o.r && foc !== o.n)) { o.r.value = v; o.n.value = fmt(v); }
      o.row.classList.toggle('mod', art.palOverridden(scopeSel.value, o.p.key));
    }
    const info = q('#dtRebuildInfo');
    if (info) { info.textContent = rebuildCount ? `⏳ ${rebuildCount} 項改動需重建場景` : '✔ 場景已是最新'; q('#dtRebuildBtn').disabled = !rebuildCount; }
  }
  function buildArtSection() {
    palRows = [];
    const d = document.createElement('details'); d.open = true; d.id = 'dtArt';
    d.innerHTML = '<summary>🎨 美術風格控制台</summary><div class="dt-sec"></div>';
    const sec = d.querySelector('.dt-sec');
    // 預設列
    const pr = document.createElement('div'); pr.className = 'dt-btns';
    presetSel = document.createElement('select'); presetSel.style.maxWidth = '170px'; fillPresets();
    presetName = document.createElement('input'); presetName.type = 'text'; presetName.placeholder = '另存名稱…'; presetName.style.cssText = 'width:110px;background:#0f1218;color:#dfe4ee;border:1px solid #4c5264;border-radius:4px;padding:4px';
    pr.append(presetSel,
      actionBtn('📂 載入', () => loadPreset(presetSel.value), { title: '先還原再套用該預設' }),
      actionBtn('🔀 與目前對照', () => compareWithPreset(presetSel.value), { title: 'A＝目前、B＝選中預設，之後用「切換 A⇄B」' }),
      actionBtn('🗑', () => { deletePreset(presetSel.value); fillPresets(); }, { title: '刪除自訂預設' }));
    sec.appendChild(pr);
    const pr2 = document.createElement('div'); pr2.className = 'dt-btns';
    pr2.append(presetName, actionBtn('💾 另存為預設', () => { if (savePreset(presetName.value)) { fillPresets(); presetSel.value = presetName.value.trim(); } }),
      actionBtn('🔀 切換 A⇄B', abToggle), actionBtn('📌 目前→A', () => abSet('A')), actionBtn('📌 目前→B', () => abSet('B')));
    sec.appendChild(pr2);
    const note = document.createElement('div'); note.style.cssText = 'color:#8a93a8;font-size:11px';
    note.textContent = '「現行（改前）」＝目前遊戲畫面；「新參考」＝依 09 差距清單朝 batch5 參考圖調整。🔄 標記的項目為建場景時烘焙，需重建場景。';
    sec.appendChild(note);
    // 重建列
    const rb = document.createElement('div'); rb.className = 'dt-btns';
    const info = document.createElement('span'); info.id = 'dtRebuildInfo'; info.style.alignSelf = 'center';
    const autoLb = document.createElement('label'); const autoCb = document.createElement('input'); autoCb.type = 'checkbox'; autoCb.checked = dt.autoRebuild !== false; autoCb.onchange = () => { dt.autoRebuild = autoCb.checked; }; autoLb.append(autoCb, '自動重建');
    const rbBtn = actionBtn('🔄 重建場景', rebuild, { title: '重新進入目前的城鎮／野外，套用烘焙在場景裡的顏色與植被' }); rbBtn.id = 'dtRebuildBtn';
    rb.append(info, rbBtn, autoLb); sec.appendChild(rb);
    // 各參數子群
    for (const [key, title, open] of ART_GROUPS) {
      const ps = params.filter(p => p.group === key); if (!ps.length) continue;
      const sd = document.createElement('details'); if (open) sd.open = true;
      sd.innerHTML = `<summary>${title}</summary><div class="dt-sec"></div>`;
      const ss = sd.querySelector('.dt-sec');
      for (const p of ps) ss.appendChild(rowFor(p));
      const b = document.createElement('div'); b.className = 'dt-btns';
      b.append(actionBtn('↺ 還原此組', () => { for (const p of ps) if (!p.volatile) setParam(p, p.def); refresh(true); }));
      ss.appendChild(b); sec.appendChild(sd);
    }
    // 群系色盤
    const pd = document.createElement('details');
    pd.innerHTML = '<summary>🌈 場景色盤（草 / 樹 / 水 / 天空 / 光色，可全域或指定群系）</summary><div class="dt-sec"></div>';
    const ps = pd.querySelector('.dt-sec');
    const sr = document.createElement('div'); sr.className = 'dt-btns';
    scopeSel = document.createElement('select');
    scopeSel.innerHTML = '<option value="all">🌐 全部群系（顯示目前群系的值）</option>' + art.biomes().map(b => `<option value="${b.key}">${b.name}</option>`).join('');
    scopeSel.onchange = () => refresh(true);
    sr.append(scopeSel, actionBtn('📍 目前群系', () => { const k = game.biome?.key; if ([...scopeSel.options].some(o => o.value === k)) { scopeSel.value = k; refresh(true); } }),
      actionBtn('↺ 清除全部色盤覆寫', () => { art.clearAllPal(); for (const k of Object.keys(desired)) if (k.startsWith('pal.')) delete desired[k]; markRebuild(); refresh(true); }));
    ps.appendChild(sr);
    for (const p of art.PAL_PROPS) ps.appendChild(paletteRow(p));
    sec.appendChild(pd);
    return d;
  }

  let zoneSel, cpSel, spawnType, spawnCount, spawnElite, rarSel, tierRange;
  function buildDom() {
    body.innerHTML = '<div id="dtBanner" class="hide"></div>';
    body.appendChild(buildArtSection());
    // 動作區（置頂，最常用）
    const act = document.createElement('details'); act.open = true;
    act.innerHTML = '<summary>⚔️ 戰鬥測試：生怪 / 清場 / 傳送</summary><div class="dt-sec"></div>';
    const sec = act.querySelector('.dt-sec');
    const spawnRow = document.createElement('div'); spawnRow.className = 'dt-btns';
    spawnType = document.createElement('select');
    spawnType.innerHTML = SPAWN_TYPES.map(t => `<option value="${t}">${ENEMY_NAMES?.[t] || t}</option>`).join('');
    spawnCount = document.createElement('input'); spawnCount.type = 'number'; spawnCount.min = 1; spawnCount.max = 60; spawnCount.value = 5; spawnCount.style.width = '54px';
    const eliteLb = document.createElement('label'); spawnElite = document.createElement('input'); spawnElite.type = 'checkbox'; eliteLb.append(spawnElite, '精英');
    spawnRow.append(spawnType, spawnCount, eliteLb,
      actionBtn('👾 生成', () => spawn(spawnType.value, Math.max(1, Math.min(60, Number(spawnCount.value) || 1)), spawnElite.checked), { online: true }),
      actionBtn('👑 生 Boss', () => spawn('stag', 1, false), { online: true }),
      actionBtn('💥 清空敵人', killAll, { online: true }));
    sec.appendChild(spawnRow);
    const tpRow = document.createElement('div'); tpRow.className = 'dt-btns';
    zoneSel = document.createElement('select');
    const opts = [['town', '🏠 燈谷鎮'], ['harbor', '⛵ 海風港鎮']];
    for (let i = 1; i < FIELDS.length; i++) opts.push(['f:' + i, `#${String(i).padStart(2, '0')} ${FIELDS[i].name} Lv.${FIELDS[i].level}`]);
    zoneSel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    tpRow.append(zoneSel, actionBtn('⚡ 傳送區域', () => goZone(zoneSel.value)));
    sec.appendChild(tpRow);
    const cpRow = document.createElement('div'); cpRow.className = 'dt-btns';
    cpSel = document.createElement('select'); cpSel.style.maxWidth = '190px';
    cpRow.append(cpSel,
      actionBtn('🏮 傳到星燈', () => { const cp = (game.checkpoints || [])[Number(cpSel.value)]; if (cp) { tpTo(cp.x + 1.8, cp.z); toast('🏮 已傳送到星燈：' + (cp.name || cp.idx), '#ffd85a'); } else toast('此區域沒有星燈', '#ff8a8a'); }),
      actionBtn('最近', () => { const rp = findRespawn(game, game.player.pos); if (rp) { tpTo(rp.x + 1.8, rp.z); toast('🏮 已傳到最近星燈', '#ffd85a'); } else toast('此區域沒有已點亮星燈', '#ff8a8a'); }));
    sec.appendChild(cpRow);
    body.appendChild(act);

    // 資源 / 道具
    const res = document.createElement('details');
    res.innerHTML = '<summary>🎒 資源與道具發放</summary><div class="dt-sec"></div>';
    const rs = res.querySelector('.dt-sec');
    const r1 = document.createElement('div'); r1.className = 'dt-btns';
    const grant = (key, n, label) => actionBtn(label, () => { const p = game.meta.p; p[key] = (p[key] || 0) + n; game.meta.save(); toast(`${label}`, '#ffd85a'); }, { online: true });
    r1.append(grant('coins', 100, '+100 金幣'), grant('coins', 10000, '+10000 金幣'), grant('shards', 1000, '+1000 星砂'), grant('keys', 10, '+10 鑰石'),
      actionBtn('❤️ 補滿', () => { const p = game.player; p.hp = p.stats.maxHp; p.mana = p.stats.mana; if (p.flask) p.flask.charges = p.flask.max; toast('❤️ 已補滿', '#7fe08a'); }, { online: true }),
      actionBtn('🔥 補滿 Flame', () => { game.meta.p.flame = { v: FLAME_CFG.max }; toast('🔥 Flame 已補滿', '#ffb050'); }, { online: true }));
    rs.appendChild(r1);
    const r2 = document.createElement('div'); r2.className = 'dt-btns';
    rarSel = document.createElement('select'); rarSel.innerHTML = RARITY.map((r, i) => `<option value="${i}" ${i === 3 ? 'selected' : ''}>${r.name}</option>`).join('');
    tierRange = document.createElement('input'); tierRange.type = 'number'; tierRange.min = 1; tierRange.max = 16; tierRange.value = 6; tierRange.style.width = '52px'; tierRange.title = '裝備階 1–16';
    r2.append(rarSel, tierRange, actionBtn('🎁 掉落裝備', () => {
      const p = game.player, it = makeItem(Math.random, 8, Number(rarSel.value), null, Math.max(1, Math.min(16, Number(tierRange.value) || 6)));
      game.dropItem?.(p.pos.x + 1.5, p.pos.z + 1.5, it); toast('🎁 已掉落：' + it.name, '#ffaa38');
    }, { online: true }));
    rs.appendChild(r2);
    body.appendChild(res);

    // 參數群組
    for (const [key, title, open] of GROUPS) {
      const ps = params.filter(p => p.group === key);
      if (!ps.length) continue;
      const d = document.createElement('details'); if (open) d.open = true;
      d.innerHTML = `<summary>${title}</summary><div class="dt-sec"></div>`;
      const s = d.querySelector('.dt-sec');
      for (const p of ps) s.appendChild(rowFor(p));
      const rb = document.createElement('div'); rb.className = 'dt-btns';
      rb.append(actionBtn('↺ 還原此組', () => { for (const p of ps) if (!p.volatile) setParam(p, p.def); refresh(true); }));
      if (key === 'flame') {
        const w = actionBtn('🖥 寫入 data/flame.json', writeFlameToServer, { title: '只有本機 node server/server.js（localhost）可用；寫完請 npm run build' });
        w.id = 'dtWriteFlame'; rb.append(w);
      }
      s.appendChild(rb);
      body.appendChild(d);
    }

    // A/B 對照 + 匯入
    const ab = document.createElement('details'); ab.open = true;
    ab.innerHTML = '<summary>🔀 A / B 即時對照 · 匯入</summary><div class="dt-sec"></div>';
    const as = ab.querySelector('.dt-sec');
    const abRow = document.createElement('div'); abRow.className = 'dt-btns';
    abRow.append(actionBtn('📌 記為 A', () => abSet('A')), actionBtn('📌 記為 B', () => abSet('B')), actionBtn('🔀 切換 A⇄B', abToggle));
    const abLbl = document.createElement('span'); abLbl.id = 'dtAB'; abLbl.style.alignSelf = 'center'; abRow.appendChild(abLbl);
    as.appendChild(abRow);
    const ta = document.createElement('textarea'); ta.id = 'dtImport'; ta.placeholder = '貼上匯出的 JSON…'; ta.hidden = true;
    const impRow = document.createElement('div'); impRow.className = 'dt-btns'; impRow.hidden = true; impRow.id = 'dtImpRow';
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    file.onchange = async () => { const f = file.files?.[0]; if (f) { ta.value = await f.text(); } };
    impRow.append(actionBtn('✅ 套用貼上的 JSON', () => importJson(ta.value)), actionBtn('📂 選檔…', () => file.click()), file);
    as.append(ta, impRow);
    body.appendChild(ab);
  }

  function refreshCheckpoints() {
    if (!cpSel) return;
    const sig = (game.checkpoints || []).map(c => c.idx).join(',') + '|' + game.zone;
    if (cpSel.dataset.sig === sig) return;
    cpSel.dataset.sig = sig;
    cpSel.innerHTML = (game.checkpoints || []).map((c, i) => `<option value="${i}">${c.unlocked ? '🏮' : '▫️'} ${c.name || '星燈 ' + c.idx}</option>`).join('') || '<option value="-1">（此區域無星燈）</option>';
  }

  let built = false, open = false, timer = 0;
  function refresh(force) {
    if (!built) return;
    const locked = lockOnline();
    const banner = q('#dtBanner');
    banner.classList.toggle('hide', !locked);
    if (locked) banner.textContent = '🌐 已連線線上伺服器：生怪／清怪／無敵／零冷卻／發放資源／改等級已停用（戰鬥非伺服器權威，會影響其他玩家）。鏡頭、光照、渲染、音量與傳送仍可用。離線或 localhost 才能全開。';
    panel.querySelectorAll('[data-online]').forEach(b => { b.disabled = locked; });
    for (const { row, input, num, p } of rows.values()) {
      const v = p.get();
      if (p.type === 'toggle') {
        input.textContent = `${p.label}：${v ? '開' : '關'}`; input.classList.toggle('on', !!v);
        input.disabled = !!(p.online && locked);
        row.classList.toggle('mod', p.id in desired);
      } else if (p.type === 'color') {
        if (force || document.activeElement !== input && document.activeElement !== num) { input.value = v; num.value = v; }
        row.classList.toggle('mod', p.id in desired);
      } else {
        const focused = document.activeElement === input || document.activeElement === num;
        if (force || !focused) { input.value = v; if (num && document.activeElement !== num) num.value = fmt(v); }
        input.disabled = !!(p.online && locked); if (num) num.disabled = input.disabled;
        row.classList.toggle('mod', p.id in desired);
      }
    }
    q('#dtAB').textContent = `${slotA ? 'A✔' : 'A–'} ${slotB ? 'B✔' : 'B–'} ${curAB ? '· 目前 ' + curAB : ''}`;
    q('#dtWriteFlame') && (q('#dtWriteFlame').disabled = !window.LV_DEV_DIAGNOSTICS);
    const st = readStore();
    q('#dtAuto').textContent = `自動套用：${st?.auto === false ? '關' : '開'}`;
    refreshCheckpoints();
    refreshPalette(force);
  }
  function perf() {
    const s = hooks.getStats?.() || {};
    q('#dtPerf').textContent = `${Math.round(s.fps || 0)} FPS · ${(s.frameMs || 0).toFixed(1)}ms · ${s.drawCalls ?? '—'} calls · ${(s.triangles ?? 0).toLocaleString()} tris`;
  }

  const btn = document.createElement('button');
  btn.id = 'devTuneBtn'; btn.type = 'button'; btn.textContent = '🎛'; btn.title = '開發者調校面板（`）';
  btn.onclick = () => toggle();
  document.body.appendChild(btn);

  function toggle(force) {
    open = typeof force === 'boolean' ? force : !open;
    if (open) {
      ensureDefs();
      if (!built) { buildDom(); built = true; }
      refresh(true); perf();
      clearInterval(timer); timer = setInterval(() => { refresh(false); perf(); }, 250);
    } else clearInterval(timer);
    panel.classList.toggle('hide', !open); btn.classList.toggle('on', open);
    return open;
  }

  q('#dtClose').onclick = () => toggle(false);
  q('#dtSave').onclick = saveLocal;
  q('#dtExport').onclick = exportJson;
  q('#dtImportBtn').onclick = () => { const h = q('#dtImport').hidden; q('#dtImport').hidden = !h; q('#dtImpRow').hidden = !h; if (h) body.scrollTop = body.scrollHeight; };
  q('#dtResetAll').onclick = () => { resetAll(); curAB = ''; refresh(true); toast('↩ 已全部還原預設（已儲存的本機調校仍在，按「儲存」才會覆蓋）', '#e8dcc8'); };
  q('#dtAuto').onclick = () => {
    const st = readStore() || { values: {} };
    st.auto = st.auto === false; try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (_) {}
    refresh(false);
  };
  panel.addEventListener('keydown', e => e.stopPropagation()); // 在面板內打字時不觸發遊戲熱鍵
  panel.addEventListener('pointerdown', e => e.stopPropagation());

  // 啟動時套用已儲存調校；每次載入區域後重套（水面、光源會被場景重建）
  function reapply() {
    const st = readStore();
    if (!st || st.auto === false) return;
    applyValues(st.values);
  }
  setInterval(() => { if (defsReady && art && (dt.charT?.head !== 1 || dt.charT?.body !== 1)) art.applyChar(); }, 1000);
  setTimeout(() => { try { ensureDefs(); reapply(); } catch (e) { console.warn('[DevTuner] 套用已存調校失敗', e); } }, 0);

  return {
    toggle, isOpen: () => open,
    reapply: () => { if (!defsReady) return; for (const [id, v] of Object.entries(desired)) { try { if (!id.startsWith('pal.')) byId.get(id)?.set(v); } catch (_) {} } art?.applyPalette(); art?.applyChar(); art?.applyFilter(); },
    button: btn, snapshot, applyValues, importJson, buildExport, resetAll,
  };
}
