// 設定：存在 localStorage，套用到音訊、渲染管線、多語系與自訂技能按鍵
import { windU } from './world.js';
import { LANGS, t, applyDOMLanguage } from './i18n.js';

export const KEY_PRESETS = {
  arpg: { sk0: 'rmb', sk1: 'q', sk2: 'e', sk3: 'c', flask: 'r', recall: 'h' },
  poe:  { sk0: 'q', sk1: 'e', sk2: 'r', sk3: 't', flask: '1', recall: 'h' },
  mmo:  { sk0: '1', sk1: '2', sk2: '3', sk3: '4', flask: '5', recall: 'h' },
};

export const DEFAULTS = {
  master: 9, music: 6, sfx: 8, pixel: 3, camAngle: 0, wind: 1, water: 1, shafts: 1, shake: 1, dmg: 1, chat: 1,
  lang: 'zh-TW',
  keybinds: { ...KEY_PRESETS.arpg },
};

export function formatKey(k) {
  if (!k) return '—';
  if (k === 'rmb') return '右鍵';
  if (k === ' ') return '空白';
  return k.toUpperCase();
}

export function loadSettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('lv_settings') || '{}'); } catch (e) { /* ignore */ }
  return { ...DEFAULTS, ...s, keybinds: { ...DEFAULTS.keybinds, ...(s.keybinds || {}) } };
}
export function saveSettings(s) { try { localStorage.setItem('lv_settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }

export function syncHotbarKeyLabels(g) {
  if (typeof document === 'undefined') return;
  const kb = g.settings?.keybinds || DEFAULTS.keybinds;
  for (let i = 0; i < 4; i++) {
    const el = document.querySelector(`#sk-s${i} .key`);
    if (el) el.textContent = formatKey(kb['sk' + i]);
  }
  const rf = document.querySelector('#sk-r .key'); if (rf) rf.textContent = formatKey(kb.flask);
  const rh = document.querySelector('#sk-recall .key'); if (rh) rh.textContent = formatKey(kb.recall);
}

export function applySettings(g) {
  const s = g.settings;
  g.audio.setVolumes(s.master / 10, s.music / 10, s.sfx / 10);
  if (g.pipe.pixelScale !== s.pixel) g.pipe.setPixelScale(s.pixel);
  windU.uWindStr.value = [0, 1, 1.8][s.wind] ?? 1;
  g.pipe.postMat.uniforms.uShaftK.value = s.shafts ? 1 : 0;
  if (g.world && g.world.waterMat) g.world.waterMat.uniforms.uWater.value = s.water ? 1 : 0;
  const chat = document.getElementById('chat'); if (chat) chat.style.display = s.chat ? '' : 'none';
  applyDOMLanguage(s.lang || 'zh-TW');
  syncHotbarKeyLabels(g);
}

const ROWS = {
  audio: [['master', '主音量', 'num'], ['music', '音樂', 'num'], ['sfx', '音效', 'num']],
  video: [['pixel', '像素大小', ['', '', '細', '標準', '粗']], ['camAngle', '鏡頭視角', ['斜 45°（PoE 2 推薦）', '高俯視 55°（經典）', '低仰角 36°（宏偉風景）']], ['wind', '風吹草動', ['關', '微風', '強風']], ['water', '水波特效', ['關', '開']], ['shafts', '光柱與風線', ['關', '開']], ['shake', '畫面震動', ['關', '開']], ['dmg', '傷害數字', ['關', '開']], ['chat', '聊天視窗', ['關', '開']]],
};

const BIND_LABELS = [
  ['sk0', '技能欄 1'], ['sk1', '技能欄 2'], ['sk2', '技能欄 3'], ['sk3', '技能欄 4'],
  ['flask', '蜜藥瓶回血'], ['recall', '快捷回城（歸途海螺）'],
];

const STATIC_KEYS = [
  ['WASD', '移動'], ['Shift', '疾步衝刺'], ['左鍵', '主武器攻擊'],
  ['空白', '翻滾／連按跳躍滑翔／攀爬'], ['I', '物理背包／裝備／倉庫／外觀'],
  ['K', '技能拼圖'], ['M', '世界總圖（設導航目標，不可直接傳送）'], ['Tab', '地區小地圖'],
  ['F', '互動／採集／推門／登船'], ['B', '野外營火'], ['P', '拍照模式'], ['Esc', '設定'],
];

export function buildSettingsUI(g) {
  const root = document.getElementById('settings'), body = root.querySelector('.sbody'), tabs = root.querySelector('.stabs');
  let tab = 'video', listeningKey = null;
  const set = (k, v) => { g.settings[k] = v; saveSettings(g.settings); applySettings(g); g.audio.sfx('ui'); render(); };
  const onRebind = e => {
    if (!listeningKey) return;
    e.preventDefault(); e.stopPropagation();
    const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
    if (k !== 'escape') {
      g.settings.keybinds[listeningKey] = k;
      saveSettings(g.settings); syncHotbarKeyLabels(g); g.audio.sfx('pickup');
    }
    listeningKey = null;
    removeEventListener('keydown', onRebind, true);
    render();
  };
  const render = () => {
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    body.innerHTML = '';
    if (tab === 'keys') {
      const lang = g.settings.lang || 'zh-TW';
      const preRow = document.createElement('div');
      preRow.className = 'srow';
      preRow.style.flexWrap = 'wrap'; preRow.style.gap = '6px';
      [['arpg', t(lang, 'keyPresetArpg')], ['poe', t(lang, 'keyPresetPoe')], ['mmo', t(lang, 'keyPresetMmo')]].forEach(([pid, plab]) => {
        const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = plab;
        b.onclick = () => { g.settings.keybinds = { ...KEY_PRESETS[pid] }; saveSettings(g.settings); syncHotbarKeyLabels(g); g.audio.sfx('ui'); render(); };
        preRow.appendChild(b);
      });
      body.appendChild(preRow);
      BIND_LABELS.forEach(([id, label]) => {
        const r = document.createElement('div'); r.className = 'srow';
        const cur = g.settings.keybinds[id];
        r.innerHTML = `<span class="sl">${label}</span><span class="sv"></span>`;
        const b = document.createElement('button'); b.className = 'arr wide';
        b.textContent = listeningKey === id ? t(lang, 'pressKey') : formatKey(cur);
        b.onclick = () => {
          listeningKey = id; render();
          addEventListener('keydown', onRebind, true);
        };
        r.querySelector('.sv').appendChild(b);
        body.appendChild(r);
      });
      STATIC_KEYS.forEach(([k, d]) => {
        const r = document.createElement('div'); r.className = 'srow';
        r.innerHTML = `<span><b class="kb">${k}</b></span><span>${d}</span>`;
        body.appendChild(r);
      });
      return;
    }
    if (tab === 'about') {
      body.innerHTML = '<div class="sabout">燈谷行 Lantern Vale<br>像素風 3D 動作冒險原型<br>風格靈感：A Short Hike、孤山獨影等。所有角色與素材皆為原創。<br><br>設定、物理背包、倉庫與外觀皆自動儲存在瀏覽器。</div>';
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = '重設所有設定';
      b.onclick = () => { g.settings = { ...DEFAULTS, keybinds: { ...KEY_PRESETS.arpg } }; saveSettings(g.settings); applySettings(g); render(); };
      body.appendChild(b); return;
    }
    if (tab === 'video') {
      const lr = document.createElement('div'); lr.className = 'srow';
      lr.innerHTML = `<span class="sl">${t(g.settings.lang, 'language')}</span><span class="sv"></span>`;
      const curIdx = Math.max(0, LANGS.findIndex(x => x.id === g.settings.lang));
      const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = LANGS[curIdx].label;
      b.onclick = () => set('lang', LANGS[(curIdx + 1) % LANGS.length].id);
      lr.querySelector('.sv').appendChild(b);
      body.appendChild(lr);
    }
    ROWS[tab].forEach(([key, label, opts]) => {
      const r = document.createElement('div'); r.className = 'srow'; const v = g.settings[key];
      const lo = opts === 'num' ? 0 : (key === 'pixel' ? 2 : 0), hi = opts === 'num' ? 10 : (key === 'pixel' ? 4 : opts.length - 1);
      const txt = opts === 'num' ? String(v) : opts[v];
      r.innerHTML = `<span class="sl">${label}</span><span class="sv"><button class="arr" data-d="-1">◀</button><b class="sval">${txt}</b><button class="arr" data-d="1">▶</button></span>`;
      r.querySelectorAll('.arr').forEach(b => b.onclick = () => { const nv = Math.max(lo, Math.min(hi, v + +b.dataset.d)); if (nv !== v) set(key, nv); });
      body.appendChild(r);
    });
    if (tab === 'audio') {
      const r = document.createElement('div'); r.className = 'srow'; r.innerHTML = '<span class="sl">靜音</span><span class="sv"></span>';
      const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = g.audio.muted ? '已靜音 · 點擊開啟' : '開啟中 · 點擊靜音';
      b.onclick = () => { g.audio.init(); g.audio.toggleMute(); document.getElementById('btnMute').textContent = g.audio.muted ? '🔇' : '🔊'; render(); };
      r.querySelector('.sv').appendChild(b); body.appendChild(r);
    }
  };
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; g.audio.sfx('ui'); render(); });
  const open = (v) => { g.ui.setOpen = v; root.classList.toggle('hide', !v); if (v) { g.audio.init(); g.audio.sfx('ui'); render(); } };
  document.getElementById('btnClose').onclick = () => open(false);
  g.ui.toggleSettings = () => open(!g.ui.setOpen);
  g.ui.closeSettings = () => open(false);
  ['btnSet', 'btnSetTitle'].forEach(id => { const el = document.getElementById(id); if (el) el.onclick = () => { open(!g.ui.setOpen); el.blur(); }; });
  render();
}
