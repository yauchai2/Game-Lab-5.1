// 設定：存在 localStorage，套用到音訊、渲染管線、特效
import { windU } from './world.js';
export const DEFAULTS = { master: 9, music: 6, sfx: 8, pixel: 3, wind: 1, water: 1, shafts: 1, shake: 1, dmg: 1, chat: 1 };
export function loadSettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('lv_settings') || '{}'); } catch (e) { /* ignore */ }
  return { ...DEFAULTS, ...s };
}
export function saveSettings(s) { try { localStorage.setItem('lv_settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }
export function applySettings(g) {
  const s = g.settings;
  g.audio.setVolumes(s.master / 10, s.music / 10, s.sfx / 10);
  if (g.pipe.pixelScale !== s.pixel) g.pipe.setPixelScale(s.pixel);
  windU.uWindStr.value = [0, 1, 1.8][s.wind] ?? 1;
  g.pipe.postMat.uniforms.uShaftK.value = s.shafts ? 1 : 0;
  if (g.world && g.world.waterMat) g.world.waterMat.uniforms.uWater.value = s.water ? 1 : 0;
  const chat = document.getElementById('chat'); if (chat) chat.style.display = s.chat ? '' : 'none';
}
const ROWS = {
  audio: [['master', '主音量', 'num'], ['music', '音樂', 'num'], ['sfx', '音效', 'num']],
  video: [['pixel', '像素大小', ['', '', '細', '標準', '粗']], ['wind', '風吹草動', ['關', '微風', '強風']], ['water', '水波特效', ['關', '開']], ['shafts', '光柱與風線', ['關', '開']], ['shake', '畫面震動', ['關', '開']], ['dmg', '傷害數字', ['關', '開']], ['chat', '聊天視窗', ['關', '開']]],
};
const KEYS = [['WASD', '移動'], ['Shift', '按住疾步衝刺（耗體力）'], ['左鍵', '主武器攻擊（按住連擊）'], ['右鍵 / Q / E / C', '施放拼圖主動技能欄 1–4'], ['空白', '單擊翻滾／連按兩下跳起（按住第二下滑翔）／頂牆攀爬'], ['K', '開啟技能拼圖與寶石商人'], ['R', '蜜藥瓶回血'], ['F', '互動、採集、撿起物品'], ['Tab / I', '角色、職業與裝備'], ['Enter', '聊天'], ['1–4', '表情'], ['M', '世界地圖與傳送'], ['Esc', '設定']];
export function buildSettingsUI(g) {
  const root = document.getElementById('settings'), body = root.querySelector('.sbody'), tabs = root.querySelector('.stabs');
  let tab = 'video';
  const set = (k, v) => { g.settings[k] = v; saveSettings(g.settings); applySettings(g); g.audio.sfx('ui'); render(); };
  const render = () => {
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    body.innerHTML = '';
    if (tab === 'keys') { KEYS.forEach(([k, d]) => { const r = document.createElement('div'); r.className = 'srow'; r.innerHTML = `<span><b class="kb">${k}</b></span><span>${d}</span>`; body.appendChild(r); }); return; }
    if (tab === 'about') { body.innerHTML = '<div class="sabout">燈谷行 Lantern Vale<br>像素風 3D 動作冒險原型<br>風格靈感：A Short Hike 等。所有角色與素材皆為原創。<br><br>設定會自動儲存在這個瀏覽器。</div>'; const b = document.createElement('button'); b.className = 'btn'; b.textContent = '重設所有設定'; b.onclick = () => { g.settings = { ...DEFAULTS }; saveSettings(g.settings); applySettings(g); render(); }; body.appendChild(b); return; }
    ROWS[tab].forEach(([key, label, opts]) => {
      const r = document.createElement('div'); r.className = 'srow'; const v = g.settings[key];
      const lo = opts === 'num' ? 0 : (key === 'pixel' ? 2 : 0), hi = opts === 'num' ? 10 : (key === 'pixel' ? 4 : opts.length - 1);
      const txt = opts === 'num' ? String(v) : opts[v];
      r.innerHTML = `<span class="sl">${label}</span><span class="sv"><button class="arr" data-d="-1">◀</button><b class="sval">${txt}</b><button class="arr" data-d="1">▶</button></span>`;
      r.querySelectorAll('.arr').forEach(b => b.onclick = () => { const nv = Math.max(lo, Math.min(hi, v + +b.dataset.d)); if (nv !== v) set(key, nv); });
      body.appendChild(r);
    });
    if (tab === 'audio') { const r = document.createElement('div'); r.className = 'srow'; r.innerHTML = '<span class="sl">靜音</span><span class="sv"></span>'; const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = g.audio.muted ? '已靜音 · 點擊開啟' : '開啟中 · 點擊靜音'; b.onclick = () => { g.audio.init(); g.audio.toggleMute(); document.getElementById('btnMute').textContent = g.audio.muted ? '🔇' : '🔊'; render(); }; r.querySelector('.sv').appendChild(b); body.appendChild(r); }
  };
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; g.audio.sfx('ui'); render(); });
  const open = (v) => { g.ui.setOpen = v; root.classList.toggle('hide', !v); if (v) { g.audio.init(); g.audio.sfx('ui'); render(); } };
  document.getElementById('btnClose').onclick = () => open(false);
  g.ui.toggleSettings = () => open(!g.ui.setOpen);
  g.ui.closeSettings = () => open(false);
  ['btnSet', 'btnSetTitle'].forEach(id => { const el = document.getElementById(id); if (el) el.onclick = () => { open(!g.ui.setOpen); el.blur(); }; });
  render();
}
