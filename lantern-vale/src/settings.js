// 設定：存在 localStorage，套用到音訊、渲染管線、多語系與自訂技能按鍵
import { windU } from './world.js';
import { LANGS, t, applyDOMLanguage } from './i18n.js';

export const KEY_PRESETS = {
  arpg: { sk0: 'rmb', sk1: 'q', sk2: 'e', sk3: 'c', flask: 'r', recall: 'h' },
  poe:  { sk0: 'q', sk1: 'e', sk2: 'r', sk3: 't', flask: '1', recall: 'h' },
  mmo:  { sk0: '1', sk1: '2', sk2: '3', sk3: '4', flask: '5', recall: 'h' },
};

export const DIFFICULTY_MODES = {
  cozy:     { id: 'cozy',     name: '🌿 旅人休閒', enemyDmg: 0.70, enemyHp: 0.85, lootBonus: 0,    noGrave: true,  desc: '敵傷 70% · 死亡不掉墓碑，輕鬆逛 20 座島嶼' },
  standard: { id: 'standard', name: '⚔️ 標準冒險', enemyDmg: 1.00, enemyHp: 1.00, lootBonus: 0,    noGrave: false, desc: '戰鬥講求讀招、閃避及出招時機（推薦）' },
  veteran:  { id: 'veteran',  name: '🔥 餘燼專家', enemyDmg: 1.35, enemyHp: 1.25, lootBonus: 0.25, noGrave: false, desc: '敵傷 135% · 敵血 125% · 掉寶 +25%' },
};

export const DEFAULTS = {
  master: 9, music: 6, sfx: 8, pixel: 2, camAngle: 0, wind: 1, water: 1, shafts: 1, shake: 0, dmg: 1, chat: 1, coopVfx: 1,
  difficulty: 'standard',
  lang: 'zh-TW',
  keybinds: { ...KEY_PRESETS.arpg },
};

export function formatKey(k, lang = 'zh-TW') {
  if (!k) return '—';
  if (k === 'rmb') return lang === 'en' ? 'RMB' : lang === 'ja' ? '右' : '右鍵';
  if (k === ' ') return lang === 'en' ? 'Space' : lang === 'ja' ? 'Space' : '空白';
  return k.toUpperCase();
}

export function loadSettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('lv_settings') || '{}'); } catch (e) { /* ignore */ }
  const merged = { ...DEFAULTS, ...s, keybinds: { ...DEFAULTS.keybinds, ...(s?.keybinds || {}) } };
  merged.pixel = Number(s?.pixel) === 1 ? 1 : DEFAULTS.pixel;
  merged.camAngle = merged.camAngle ? 1 : 0;
  return merged;
}
export function saveSettings(s) { try { localStorage.setItem('lv_settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }

export function syncHotbarKeyLabels(g) {
  if (typeof document === 'undefined') return;
  const kb = g.settings?.keybinds || DEFAULTS.keybinds;
  const lang = g.settings?.lang || 'zh-TW';
  for (let i = 0; i < 4; i++) {
    const el = document.querySelector(`#sk-s${i} .key`);
    if (el) el.textContent = formatKey(kb['sk' + i], lang);
  }
  const rf = document.querySelector('#sk-r .key'); if (rf) rf.textContent = formatKey(kb.flask, lang);
  const rh = document.querySelector('#sk-recall .key'); if (rh) rh.textContent = formatKey(kb.recall, lang);
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
  g.ui?.refreshLanguage?.(g);
}

function getRows(lang) {
  const off = t(lang, 'optOff'), on = t(lang, 'optOn');
  return {
    audio: [
      ['master', t(lang, 'rowMaster'), 'num'],
      ['music', t(lang, 'rowMusic'), 'num'],
      ['sfx', t(lang, 'rowSfx'), 'num'],
    ],
    video: [
      ['difficulty', '遊戲難度模式', ['cozy', 'standard', 'veteran']],
      ['pixel', t(lang, 'rowPixel'), ['', lang === 'zh-TW' ? '關閉' : off, t(lang, 'optFine')]],
      ['camAngle', t(lang, 'rowCamAngle'), [off, on]],
      ['wind', t(lang, 'rowWind'), [off, t(lang, 'optBreeze'), t(lang, 'optGale')]],
      ['water', t(lang, 'rowWater'), [off, on]],
      ['shafts', t(lang, 'rowShafts'), [off, on]],
      ['shake', t(lang, 'rowShake'), [off, on]],
      ['dmg', t(lang, 'rowDmg'), [off, on]],
      ['chat', t(lang, 'rowChat'), [off, on]],
      ['coopVfx', '多人特效降噪', ['全亮', '降噪 35%']],
    ],
  };
}

function getBindLabels(lang) {
  return [
    ['sk0', t(lang, 'bindSk0')], ['sk1', t(lang, 'bindSk1')], ['sk2', t(lang, 'bindSk2')], ['sk3', t(lang, 'bindSk3')],
    ['flask', t(lang, 'bindFlask')], ['recall', t(lang, 'bindRecall')],
  ];
}

const STATIC_KEYS = {
  'zh-TW': [
    ['WASD', '移動'], ['Shift', '疾步衝刺'], ['左鍵', '主武器攻擊'],
    ['空白', '翻滾／連按跳躍滑翔／攀爬'], ['I', '物理背包／裝備／外觀'],
    ['K', '技能拼圖'], ['M', '世界總圖（導航）'], ['Tab', '地區小地圖'],
    ['F', '互動／採集／推門／登船／開城鎮倉庫'], ['B', '野外營火'], ['P', '拍照模式'], ['Esc', '設定'],
  ],
  en: [
    ['WASD', 'Move'], ['Shift', 'Sprint'], ['LMB', 'Primary Attack'],
    ['Space', 'Roll / Double-Tap Jump & Glide / Climb'], ['I', 'Physics Bag / Gear / Cosmetics'],
    ['K', 'Skill Puzzle'], ['M', 'World Map (Waypoint)'], ['Tab', 'Region Minimap'],
    ['F', 'Interact / Gather / Board Ferry / Town Stash'], ['B', 'Field Campfire'], ['P', 'Photo Mode'], ['Esc', 'Settings'],
  ],
  ja: [
    ['WASD', '移動'], ['Shift', 'ダッシュ'], ['左クリック', '通常攻撃'],
    ['Space', '回避／2回押しでジャンプ＆滑空／崖登り'], ['I', '物理リュック／装備／見た目'],
    ['K', 'スキルパズル'], ['M', 'ワールドマップ（ナビ）'], ['Tab', '地域ミニマップ'],
    ['F', '調べる／採集／乗船／街の倉庫'], ['B', '焚き火'], ['P', 'フォトモード'], ['Esc', '設定'],
  ],
};

export function buildSettingsUI(g) {
  const root = document.getElementById('settings'), body = root.querySelector('.sbody'), tabs = root.querySelector('.stabs');
  let tab = 'video', listeningKey = null;
  const set = (k, v) => { g.settings[k] = v; saveSettings(g.settings); applySettings(g); g.audio.sfx('ui'); render(); };
  const onRebind = e => {
    if (!listeningKey || e.isComposing) return;
    e.preventDefault(); e.stopPropagation();
    const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
    if (k !== 'escape') {
      g.settings.keybinds[listeningKey] = k;
      saveSettings(g.settings); syncHotbarKeyLabels(g); g.audio.sfx('pickup');
    }
    cancelRebind();
  };
  const cancelRebind = () => {
    if (!listeningKey) return false;
    const binding = listeningKey;
    listeningKey = null;
    removeEventListener('keydown', onRebind, true);
    render();
    body.querySelector(`[data-binding="${binding}"]`)?.focus();
    return true;
  };
  g.ui.cancelSettingsRebind = cancelRebind;
  const render = () => {
    const lang = g.settings.lang || 'zh-TW';
    tabs.querySelectorAll('button').forEach(button => {
      const selected = button.dataset.tab === tab;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    body.innerHTML = '';
    if (tab === 'keys') {
      const preRow = document.createElement('div');
      preRow.className = 'srow';
      preRow.style.flexWrap = 'wrap'; preRow.style.gap = '6px';
      [['arpg', t(lang, 'keyPresetArpg')], ['poe', t(lang, 'keyPresetPoe')], ['mmo', t(lang, 'keyPresetMmo')]].forEach(([pid, plab]) => {
        const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = plab;
        b.onclick = () => { g.settings.keybinds = { ...KEY_PRESETS[pid] }; saveSettings(g.settings); syncHotbarKeyLabels(g); g.audio.sfx('ui'); render(); };
        preRow.appendChild(b);
      });
      body.appendChild(preRow);
      getBindLabels(lang).forEach(([id, label]) => {
        const r = document.createElement('div'); r.className = 'srow';
        const cur = g.settings.keybinds[id];
        r.innerHTML = `<span class="sl">${label}</span><span class="sv"></span>`;
        const b = document.createElement('button'); b.className = 'arr wide';
        b.dataset.binding = id;
        b.textContent = listeningKey === id ? t(lang, 'pressKey') : formatKey(cur, lang);
        b.onclick = () => {
          listeningKey = id; render();
          addEventListener('keydown', onRebind, true);
        };
        r.querySelector('.sv').appendChild(b);
        body.appendChild(r);
      });
      (STATIC_KEYS[lang] || STATIC_KEYS['zh-TW']).forEach(([k, d]) => {
        const r = document.createElement('div'); r.className = 'srow';
        r.innerHTML = `<span><b class="kb">${k}</b></span><span>${d}</span>`;
        body.appendChild(r);
      });
      return;
    }
    if (tab === 'about') {
      body.innerHTML = `<div class="sabout">${t(lang, 'aboutText')}</div>`;
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = t(lang, 'resetSettings');
      b.onclick = () => { g.settings = { ...DEFAULTS, keybinds: { ...KEY_PRESETS.arpg } }; saveSettings(g.settings); applySettings(g); render(); };
      body.appendChild(b); return;
    }
    if (tab === 'video') {
      const lr = document.createElement('div'); lr.className = 'srow';
      lr.innerHTML = `<span class="sl">${t(lang, 'language')}</span><span class="sv"></span>`;
      const curIdx = Math.max(0, LANGS.findIndex(x => x.id === lang));
      const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = LANGS[curIdx].label;
      b.onclick = () => set('lang', LANGS[(curIdx + 1) % LANGS.length].id);
      lr.querySelector('.sv').appendChild(b);
      body.appendChild(lr);
    }
    getRows(lang)[tab].forEach(([key, label, opts]) => {
      const r = document.createElement('div'); r.className = 'srow'; const v = g.settings[key];
      if (key === 'difficulty') {
        const idx = Math.max(0, opts.indexOf(v));
        const modeObj = DIFFICULTY_MODES[opts[idx]] || DIFFICULTY_MODES.standard;
        r.title = modeObj.desc;
        r.innerHTML = `<span class="sl">${label}<div style="font-size:10px;opacity:.68;margin-top:2px">${modeObj.desc}</div></span><span class="sv"><button class="arr" data-d="-1">◀</button><b class="sval" style="min-width:96px">${modeObj.name}</b><button class="arr" data-d="1">▶</button></span>`;
        r.querySelectorAll('.arr').forEach(b => b.onclick = () => {
          const ni = (idx + +b.dataset.d + opts.length) % opts.length;
          set(key, opts[ni]);
          g.ui?.toast?.(`已切換難度：${DIFFICULTY_MODES[opts[ni]].name}`, '#ffd85a');
        });
        body.appendChild(r);
        return;
      }
      const lo = opts === 'num' ? 0 : (key === 'pixel' ? 1 : 0), hi = opts === 'num' ? 10 : opts.length - 1;
      const txt = opts === 'num' ? String(v) : opts[v];
      r.innerHTML = `<span class="sl">${label}</span><span class="sv"><button class="arr" data-d="-1">◀</button><b class="sval">${txt}</b><button class="arr" data-d="1">▶</button></span>`;
      r.querySelectorAll('.arr').forEach(b => {
        const change = +b.dataset.d;
        const next = Math.max(lo, Math.min(hi, v + change));
        if (key === 'pixel') b.disabled = next === v;
        b.onclick = () => { if (next !== v) set(key, next); };
      });
      body.appendChild(r);
    });
    if (tab === 'audio') {
      const r = document.createElement('div'); r.className = 'srow'; r.innerHTML = `<span class="sl">${t(lang, 'rowMute')}</span><span class="sv"></span>`;
      const b = document.createElement('button'); b.className = 'arr wide'; b.textContent = g.audio.muted ? t(lang, 'muteOn') : t(lang, 'muteOff');
      b.onclick = () => { g.audio.init(); g.audio.toggleMute(); document.getElementById('btnMute').textContent = g.audio.muted ? '🔇' : '🔊'; render(); };
      r.querySelector('.sv').appendChild(b); body.appendChild(r);
    }
  };
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; g.audio.sfx('ui'); render(); });
  const open = (v) => { if (!v) cancelRebind(); g.ui.setOpen = v; root.classList.toggle('hide', !v); if (v) { g.audio.init(); g.audio.sfx('ui'); render(); } };
  document.getElementById('btnClose').onclick = () => open(false);
  document.getElementById('btnSettingsX').onclick = () => open(false);
  g.ui.toggleSettings = () => open(!g.ui.setOpen);
  g.ui.closeSettings = () => open(false);
  ['btnSet', 'btnSetTitle'].forEach(id => { const el = document.getElementById(id); if (el) el.onclick = () => open(!g.ui.setOpen); });
  render();
}
