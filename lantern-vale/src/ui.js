import { FIELDS } from './frontier.js';
import { bindTouch } from './touch.js';
import { bindWorldMap } from './worldmap.js';
import { bindCharacters } from './characters.js';
import { buildPanels } from './panels.js';
import { loadSettings, applySettings, buildSettingsUI, syncHotbarKeyLabels } from './settings.js';
import { CLASSES, bindPuzzleUI } from './puzzle.js';
import { dayInfo, findSecondClass, drawRegionMap } from './world_alive.js';
import { COSMETICS } from './harbor.js';
import { applyCosmetics } from './models.js';
import { PhysicsContainer, ensurePhysicsStorage, useBagItem, transferBagItem, synthesizeBagItems } from './physbag.js';
import { bindCodexUI } from './codex.js';
import { StatusCard } from './statuscard.js';
import { t } from './i18n.js';
import * as THREE from 'three';
import { RARITY, SLOTS, itemLines, itemScore, BOONS, deserializeItem, tierInfo } from './loot.js';
import { mountStatuses } from './mounts.js';

const $ = id => document.getElementById(id);
const v3 = new THREE.Vector3();

export class UI {
  constructor() {
    this.nums = [];
    this.invOpen = false;
    this.invTab = 'bag';
    this.boonChoices = null;
  }
  bind(game) {
    this.game = game;
    this.atStash = false;
    this.status = new StatusCard(this);
    game.settings = loadSettings(); buildPanels(game); buildSettingsUI(game); applySettings(game);
    const menuBtn = $('btnMenu'), menuPop = $('menuPop');
    if (menuBtn && menuPop) {
      menuBtn.onclick = e => { e.stopPropagation(); game.audio.sfx('ui'); menuPop.classList.toggle('hide'); };
      menuPop.addEventListener('click', () => menuPop.classList.add('hide'));
      addEventListener('click', e => { if (!menuPop.contains(e.target) && e.target !== menuBtn) menuPop.classList.add('hide'); });
    }
    $('btnMute').onclick = () => { game.audio.init(); const m = game.audio.toggleMute(); $('btnMute').textContent = m ? '🔇 音效：關' : '🔊 音效：開'; };
    $('btnMute').textContent = game.audio.muted ? '🔇 音效：關' : '🔊 音效：開';
    bindWorldMap(game); bindTouch(game); bindPuzzleUI(game); bindCodexUI(game);
    const pzBtn = $('sk-puzzle'); if (pzBtn) pzBtn.onclick = () => { if (this.puzzleOpen) this.closePuzzle(); else this.openPuzzle(); };
    const bagBtn = $('sk-bag'); if (bagBtn) bagBtn.onclick = () => this.toggleInv(game, 'bag');
    const recBtn = $('sk-recall'); if (recBtn) recBtn.onclick = () => game.startRecall?.();
    const mntBtn = $('sk-mount'); if (mntBtn) mntBtn.onclick = () => game.toggleMount?.();
    const dayBtn = $('dayInfo'); if (dayBtn) dayBtn.onclick = () => { game.dayTime = ((game.dayTime || 0) + 0.25) % 1; const d = dayInfo(game.dayTime); game.ui.toast(`時間推進至 ${d.icon} ${d.label}`, '#ffe9a0'); };
    for (let i = 0; i < 4; i++) { const el = $('sk-s' + i); if (el) el.onclick = () => game.castHotbar(i); }
    this._bindInvTabs(game);
    const enterCharacter = bindCharacters(game);
    $('btnTown2').onclick = () => { $('dead').classList.add('hide'); game.party = ''; game.enterTown(); };
    $('btnTown3').onclick = () => { $('win').classList.add('hide'); game.enterTown(); };
    $('btnStart').onclick = () => {
      game.audio.init(); game.audio.sfx('ui');
      game.playerName = ($('inName').value.trim() || '旅人').slice(0, 12); game.party = $('inParty').value.trim().slice(0, 12);
      enterCharacter();
      game.net.connect(game.playerName, game.hoodIdx);
      $('title').classList.add('hide'); $('hud').classList.remove('hide'); game.enterTown();
      syncHotbarKeyLabels(game);
    };
    $('btnRetry').onclick = () => { $('dead').classList.add('hide'); game.startRun(); };
    $('btnAgain').onclick = () => { $('win').classList.add('hide'); game.startRun(); };
    document.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => {
      game.pipe.setPixelScale(+b.dataset.scale);
      document.querySelectorAll('[data-scale]').forEach(x => x.classList.toggle('on', x === b));
    });
  }
  _bindInvTabs(game) {
    const bagCv = $('bagCanvas'), stashCv = $('stashCanvas');
    const showSel = (boxId, btnsId, item, fromKey) => {
      const info = $(boxId), btns = $(btnsId);
      if (!info || !btns) return;
      const lang = game.settings?.lang || 'zh-TW';
      if (!item) { info.textContent = t(lang, 'bagEmpty'); btns.innerHTML = ''; return; }
      if (item.kind === 'gear' && item.item) {
        const gear = deserializeItem(item.item);
        info.innerHTML = this.itemHTML(gear, game.player.equip[gear.slot]);
      } else {
        const ti = tierInfo(item.tier || 1);
        info.innerHTML = `<div><span class="tier-tag" style="color:${ti.color}">${ti.tag} ${ti.name}</span><b>${item.icon || ''} ${item.name}</b></div><div style="margin-top:4px;font-size:12.5px">${item.desc || '物理背包物品'}</div>`;
      }
      btns.innerHTML = '';
      const act = document.createElement('button'); act.className = 'btn small';
      act.textContent = item.kind === 'gear' ? t(lang, 'equipItem') : t(lang, 'useItem');
      act.onclick = () => { useBagItem(game, item, fromKey); this.syncPhysBags(game); this.renderBagEquipStrip(game); this.renderInv(game, true); showSel(boxId, btnsId, null, fromKey); };
      btns.appendChild(act);
      if (this.atStash) {
        const otherKey = fromKey === 'bagItems' ? 'stashItems' : 'bagItems';
        const mv = document.createElement('button'); mv.className = 'btn small'; mv.style.background = 'var(--teal)';
        mv.textContent = otherKey === 'stashItems' ? t(lang, 'toStash') : t(lang, 'toBag');
        mv.onclick = () => { transferBagItem(game, item, fromKey, otherKey); this.syncPhysBags(game); showSel(boxId, btnsId, null, fromKey); };
        btns.appendChild(mv);
      }
    };
    if (bagCv) {
      this.bagPhys = new PhysicsContainer(bagCv, {
        theme: 'bag',
        onSelect: it => showSel('bagSelInfo', 'bagBtns', it, 'bagItems'),
        onDoubleClick: it => { useBagItem(game, it, 'bagItems'); this.syncPhysBags(game); this.renderBagEquipStrip(game); this.renderInv(game, true); },
        onSynthesize: (a, b, mx, my) => { synthesizeBagItems(game, a, b, 'bagItems', mx, my); this.syncPhysBags(game); showSel('bagSelInfo', 'bagBtns', null, 'bagItems'); },
      });
    }
    if (stashCv) {
      this.stashPhys = new PhysicsContainer(stashCv, {
        theme: 'stash',
        onSelect: it => showSel('stashSelInfo', 'stashBtns', it, 'stashItems'),
        onDoubleClick: it => { transferBagItem(game, it, 'stashItems', 'bagItems'); this.syncPhysBags(game); },
        onSynthesize: (a, b, mx, my) => { synthesizeBagItems(game, a, b, 'stashItems', mx, my); this.syncPhysBags(game); showSel('stashSelInfo', 'stashBtns', null, 'stashItems'); },
      });
    }
    const sb = $('btnShakeBag'); if (sb) sb.onclick = () => { this.bagPhys?.shake(); game.audio.sfx('roll'); };
    const ss = $('btnShakeStash'); if (ss) ss.onclick = () => { this.stashPhys?.shake(); game.audio.sfx('roll'); };
    const bc = $('btnInvClose'); if (bc) bc.onclick = () => this.toggleInv(game);
    document.querySelectorAll('[data-invtab]').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.invtab === 'stash' && !this.atStash) {
          game.audio.sfx('ui');
          this.toast(t(game.settings?.lang, 'stashLocked'), '#ffd85a');
          return;
        }
        this.setInvTab(game, btn.dataset.invtab); game.audio.sfx('ui');
      };
    });
  }
  renderBagEquipStrip(game) {
    const el = $('bagEquipStrip'); if (!el) return;
    const eq = game.player.equip;
    el.innerHTML = Object.keys(SLOTS).map(k => {
      const it = eq[k];
      if (!it) return `<button type="button" class="eq-mini" data-eqslot="${k}"><b>${SLOTS[k].icon} ${SLOTS[k].name}</b><br><span style="opacity:.6">（空欄位）</span></button>`;
      const ti = tierInfo(it.tier || 1), R = RARITY[it.rarity];
      return `<button type="button" class="eq-mini" data-eqslot="${k}"><span class="tier-tag" style="color:${ti.color}">${ti.tag}</span><b style="color:${R.color};text-shadow:0 1px 0 #2b1d22">${it.name}</b><br><small>${SLOTS[k].name} · 戰力 ${itemScore(it)}</small></button>`;
    }).join('');
    el.querySelectorAll('.eq-mini').forEach(b => {
      b.onclick = () => {
        const it = eq[b.dataset.eqslot], info = $('bagSelInfo'), btns = $('bagBtns');
        if (!info) return;
        if (btns) btns.innerHTML = '';
        info.innerHTML = it ? `<div style="font-size:11px;color:#7a5a46;margin-bottom:3px">🛡️ 目前已穿戴裝備詳情</div>` + this.itemHTML(it) : '此裝備欄位目前為空。';
      };
    });
  }
  renderMounts(game) {
    const root = $('mountsRoot'); if (!root) return;
    const list = mountStatuses(game.meta.p);
    const curId = game.meta.p.mountId || list.find(m => m.status.unlocked)?.id;
    root.innerHTML = `<div style="margin-bottom:10px;font-size:13px;color:#5a3826">達成對應冒險里程碑即可永久解鎖坐騎！遊戲中按 <b>G 鍵</b>（或下方坐騎鈕）隨時召喚／收起。</div><div class="mount-grid">${list.map(m => {
      const u = m.status.unlocked, on = u && curId === m.id;
      return `<div class="mount-card ${on ? 'on' : ''} ${u ? '' : 'locked'}">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:28px">${m.icon}</span><div><span class="tier-tag" style="color:#ffd85a">T${m.tier}</span><b>${m.name}</b><div style="font-size:11px;color:#7a5a46">${m.status.text}</div></div></div>
        <div class="mount-prog"><i style="width:${Math.round(m.status.prog * 100)}%"></i></div>
        <div style="font-size:12px"><b>里程碑：</b>${m.milestone}</div>
        <div style="font-size:12px;color:#2c5a9a"><b>坐騎特性：</b>${m.perk}</div>
        <div>${u ? `<button type="button" class="btn small" data-mid="${m.id}">${on ? '✓ 使用中（點此召喚）' : '選擇並召喚'}</button>` : '<span style="font-size:12px;opacity:.7">🔒 尚未達成里程碑</span>'}</div>
      </div>`;
    }).join('')}</div>`;
    root.querySelectorAll('[data-mid]').forEach(b => {
      b.onclick = () => {
        game.meta.p.mountId = b.dataset.mid; game.meta.save();
        if (game.mount) game.toggleMount(true);
        this.toggleInv(game);
        game.toggleMount();
      };
    });
  }
  openInvTab(game, tab) {
    const mapped = tab === 'cosmetics' ? 'cos' : tab;
    this.atStash = (mapped === 'stash');
    this.invOpen = true;
    $('inv').classList.remove('hide');
    this.setInvTab(game, mapped);
  }
  setInvTab(game, tab) {
    if (tab === 'stash' && !this.atStash) tab = 'bag';
    this.invTab = tab;
    const stBtn = document.querySelector('[data-invtab="stash"]');
    if (stBtn) stBtn.style.display = this.atStash ? '' : 'none';
    document.querySelectorAll('[data-invtab]').forEach(b => b.classList.toggle('on', b.dataset.invtab === tab));
    ['bag', 'gear', 'mounts', 'stash', 'cos'].forEach(k => {
      const pane = $('pane-' + k);
      if (pane) pane.classList.toggle('hide', k !== tab);
    });
    if (tab === 'bag') { this.syncPhysBags(game); this.renderBagEquipStrip(game); }
    if (tab === 'stash') this.syncPhysBags(game);
    if (tab === 'gear') this.renderInv(game, true);
    if (tab === 'mounts') this.renderMounts(game);
    if (tab === 'cos') this.renderCosmetics(game);
  }
  refreshLanguage(game) {
    const lang = game.settings?.lang || 'zh-TW';
    const bi = $('bagSelInfo'); if (bi && !this.bagPhys?.selectedUid) bi.textContent = t(lang, 'bagEmpty');
    if (this.invOpen && this.invTab === 'gear') this.renderInv(game, true);
  }
  syncPhysBags(game) {
    const st = ensurePhysicsStorage(game.meta.p);
    this.bagPhys?.sync(st.bag);
    this.stashPhys?.sync(st.stash);
  }
  renderCosmetics(game) {
    const root = $('cosmeticsRoot'); if (!root) return;
    const p = game.meta.p; p.cosmetics = p.cosmetics || { hat: 'hood', back: 'none', aura: 'none' };
    const section = (title, key, list) => `<h3>${title}</h3><div class="cos-grid">${list.map(c =>
      `<button type="button" class="cos-btn ${p.cosmetics[key] === c.id ? 'on' : ''}" data-ckey="${key}" data-cid="${c.id}"><div style="font-size:22px">${c.icon}</div><div>${c.name}</div></button>`
    ).join('')}</div>`;
    root.innerHTML = section('🎩 帽子與頭飾', 'hat', COSMETICS.hats) + section('🎒 背飾與羽翼', 'back', COSMETICS.backs) + section('✨ 提燈與武器光效', 'aura', COSMETICS.auras);
    root.querySelectorAll('.cos-btn').forEach(b => {
      b.onclick = () => {
        p.cosmetics[b.dataset.ckey] = b.dataset.cid;
        game.meta.save();
        applyCosmetics(game.player.m, p.cosmetics);
        game.audio.sfx('pickup');
        this.renderCosmetics(game);
      };
    });
  }
  netStatus(s) {
    const el = $('netStat');
    if (s.ok) { el.textContent = '● 線上'; el.className = 'net on'; el.classList.remove('hide'); }
    else if (s.reason === 'no-server') { el.classList.add('hide'); }
    else { el.textContent = '○ 連線中斷'; el.className = 'net off'; el.classList.remove('hide'); if (s.reason === 'closed') this.addChat('', '與伺服器的連線中斷了', true); }
  }
  setOnline(n) { $('onlineN').textContent = `線上 ${n} 人`; }
  addChat(name, text, sys, zone) {
    const log = $('chatLog'); const d = document.createElement('div'); d.className = 'cl' + (sys ? ' sys' : '');
    if (sys) d.textContent = text; else { const b = document.createElement('b'); b.textContent = name + '：'; d.append(b, document.createTextNode(text)); }
    log.appendChild(d); while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = 1e6;
    setTimeout(() => d.classList.add('old'), 12000);
  }
  focusChat() { const i = $('chatIn'); i.classList.remove('hide'); i.focus(); $('chatLog').classList.add('open'); return true; }
  chatKey(e) {
    const i = $('chatIn');
    if (e.code === 'Enter') { const t = i.value.trim(); i.value = ''; if (t) this.game.sendChat(t); }
    i.blur(); i.classList.add('hide'); $('chatLog').classList.remove('open'); e.preventDefault();
  }
  screenPos(x, y, z) {
    v3.set(x, y, z).project(this.game.camera);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }
  dmgNum(x, y, z, val, cls) {
    if (this.game && this.game.settings && !this.game.settings.dmg) return;
    const el = document.createElement('div');
    el.className = 'num ' + (cls || '');
    el.textContent = cls === 'crit' ? `${val}!` : val;
    $('nums').appendChild(el);
    this.nums.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z, t: 0 });
  }
  toast(text, color = '#fff') {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; el.style.color = color;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  banner(title, sub) {
    const b = $('banner'); b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  bossBar(on, name, frac) {
    const b = $('boss'); b.classList.toggle('hide', !on);
    if (name) b.querySelector('.name').textContent = name;
    if (frac !== undefined) b.querySelector('.fill').style.width = (Math.max(0, frac) * 100) + '%';
  }
  wipe(mid) {
    const w = $('wipe'); w.classList.add('in');
    setTimeout(() => { mid(); w.classList.remove('in'); }, 450);
  }
  exitHint(g) {
    const el = $('exitHint');
    let near = null;
    for (const x of g.exits) if (x.on && Math.hypot(g.player.pos.x - x.x, g.player.pos.z - x.z) < 5) near = x;
    if (!near) { el.style.display = 'none'; return; }
    const [sx, sy] = this.screenPos(near.x, 4.4, near.z);
    el.style.display = 'block'; el.style.left = sx + 'px'; el.style.top = sy + 'px';
    const nextF = FIELDS[(g.field || 1) + 1];
    const prevF = FIELDS[(g.field || 1) - 1];
    el.textContent = {
      item: '前路：稀有裝備', boon: '前路：天賦祝福', heal: '前路：溫泉休憩',
      run: '前往晨光草原（常駐普通地圖）', town: '返回燈谷鎮（免清怪）',
      prevField: prevF ? `返回上一區：${prevF.name}（Lv.${prevF.level}）` : '返回燈谷鎮',
      nextField: nextF ? `前往下一區：${nextF.name}（Lv.${nextF.level}）` : '返回海風港鎮',
      dungeon: '消耗 1 鑰石 · 進入副本地圖',
    }[near.type] || '傳送門';
    if (near.type === 'dungeon' && FIELDS[g.field]) el.textContent = '【副本地圖】' + FIELDS[g.field].dungeon + ' · 鑰石 ×1';
    el.className = 'exitHint ' + near.type;
  }
  spotHint(g) {
    const el = $('spotHint'), s = this.panelOpen || this.invOpen || this.setOpen || this.puzzleOpen || g.sailing ? null : g.nearSpot();
    if (!s) { el.style.display = 'none'; return; }
    const [sx, sy] = this.screenPos(s.x, s.top || 2.6, s.z);
    el.style.display = 'block'; el.style.left = sx + 'px'; el.style.top = sy + 'px';
    el.textContent = s.kind === 'talk' ? `[F] 與 ${s.label} 交談` : `[F] ${s.label}`;
  }
  heirUI(g, id) {
    const box = $(id); box.innerHTML = '';
    const sh = g.bankedShards ?? 0;
    const info = document.createElement('div'); info.className = 'heirInfo';
    info.textContent = `星砂 +${sh}${g.lostShards ? `（陣亡損失 ${g.lostShards}）` : ''} · 挑一件裝備作為傳家寶，下次出發就帶著它：`; box.appendChild(info);
    const cur = g.meta.p.heirloom;
    for (const it of Object.values(g.player.equip)) if (it) {
      const b = document.createElement('button'); b.className = 'btn small heirBtn'; b.style.color = RARITY[it.rarity].color;
      b.textContent = it.name + (cur && cur.name === it.name ? ' ✔' : '');
      b.onclick = () => { g.meta.setHeirloom(it); g.audio.sfx('pickup'); this.heirUI(g, id); };
      box.appendChild(b);
    }
  }
  update(g) {
    // 物理背包／倉庫 60fps 重力模擬
    if (this.invOpen) {
      if (this.invTab === 'bag' && this.bagPhys) { this.bagPhys.step(1 / 60); this.bagPhys.draw(); }
      if (this.invTab === 'stash' && this.stashPhys) { this.stashPhys.step(1 / 60); this.stashPhys.draw(); }
    }
    // floating numbers
    for (const n of this.nums) {
      n.t += 1 / 60;
      const [sx, sy] = this.screenPos(n.x, n.y + n.t * 1.6, n.z);
      n.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${n.t < 0.1 ? 1.4 : 1})`;
      n.el.style.opacity = n.t > 0.55 ? 1 - (n.t - 0.55) / 0.3 : 1;
      if (n.t > 0.85) n.el.remove();
    }
    this.nums = this.nums.filter(n => n.t <= 0.85);
    if (g.state === 'title') return;
    const p = g.player, S = p.stats;
    const st = p.statuses || {};
    if (this.status) this.status.update(g);
    $('hpText').textContent = `${Math.ceil(p.hp)}/${S.maxHp}`;
    $('mpText').textContent = `${Math.floor(p.mana)}/${S.mana}`;
    { const c0 = CLASSES[g.character?.job ?? 0] || CLASSES[0], c2 = findSecondClass(g.meta.p.secondClass), ic = (c2 || c0).icon;
      const ie = $('pcIcon'); if (ie && ie._v !== ic) { ie.textContent = ic; ie._v = ic; }
      const lv = $('pcLv'); if (lv) lv.textContent = g.meta.p.level;
      const nm = $('pcName'); const nv = g.character?.name || (c2 || c0).name; if (nm && nm._v !== nv) { nm.textContent = nv; nm._v = nv; } }
    const sbEl = $('statusBar');
    if (sbEl) {
      const lang = g.settings?.lang || 'zh-TW';
      const pills = [];
      if (st.poison > 0) pills.push(`<span class="st-pill st-poison">${t(lang, 'statusPoison')} ${Math.ceil(st.poison)}s</span>`);
      if (st.freeze > 0) pills.push(`<span class="st-pill st-freeze">${t(lang, 'statusFreeze')} ${st.freeze.toFixed(1)}s</span>`);
      else if (st.chill > 0) pills.push(`<span class="st-pill st-chill">${t(lang, 'statusChill')} ${Math.ceil(st.chill)}s</span>`);
      if (st.burn > 0) pills.push(`<span class="st-pill st-burn">${t(lang, 'statusBurn')} ${Math.ceil(st.burn)}s</span>`);
      if (st.shock > 0) pills.push(`<span class="st-pill st-shock">${t(lang, 'statusShock')} ${Math.ceil(st.shock)}s</span>`);
      if (st.overload > 0) pills.push(`<span class="st-pill st-overload">${t(lang, 'statusOverload')} ${Math.ceil(st.overload)}s</span>`);
      const html = pills.join('');
      if (sbEl._last !== html) { sbEl.innerHTML = html; sbEl._last = html; }
    }
    const cd = (id, cur, max, locked) => {
      const el = $(id); if (!el) return;
      el.classList.toggle('locked', !!locked);
      const c = el.querySelector('.cd'); if (c) c.style.height = (max > 0 ? Math.min(1, cur / max) * 100 : 0) + '%';
    };
    const hotbar = p.hotbar || [];
    const lang = g.settings?.lang || 'zh-TW';
    for (let i = 0; i < 4; i++) {
      const el = $('sk-s' + i); if (!el) continue;
      const sk = hotbar[i];
      const ic = el.querySelector('.ic'), sn = el.querySelector('.sname'), sup = el.querySelector('.sup');
      if (sk) {
        ic.textContent = sk.def.icon; sn.textContent = sk.def.short;
        const sc = sk.mod.supports.length;
        sup.hidden = !sc; if (sc) sup.textContent = '+' + sc;
        el.title = `${sk.def.name}：${sk.def.desc}${sc ? '（連動輔助：' + sk.mod.supports.map(s => s.name).join('、') + '）' : ''}`;
        const maxCd = sk.def.cd * (1 - S.cdr / 100) * (1 - sk.mod.cdr);
        cd('sk-s' + i, p.skillCds?.[i] || 0, Math.max(0.1, maxCd), false);
      } else {
        ic.textContent = '—'; sn.textContent = t(lang, 'skEmpty'); sup.hidden = true; el.title = t(lang, 'puzzle');
        cd('sk-s' + i, 0, 1, true);
      }
    }
    $('sk-r').querySelector('.cnt').textContent = `${p.flask.charges}/${p.flask.max}`;
    $('sk-r').classList.toggle('locked', p.flask.charges === 0);
    $('sk-r').querySelector('.cd').style.height = (p.flask.charges >= p.flask.max ? 0 : (1 - p.flask.prog) * 100) + '%';
    // 回城吟唱進度條
    const rbar = $('recallBar');
    if (rbar) {
      rbar.classList.toggle('hide', !(g.recallT > 0));
      if (g.recallT > 0) {
        rbar.querySelector('.rtxt').textContent = '🐚 ' + t(g.settings?.lang, 'recallCast');
        rbar.querySelector('.rfill').style.width = ((1 - g.recallT / 2.5) * 100) + '%';
      }
    }
    const stage = Math.floor(g.depth / 3) + 1, room = g.depth % 3 + 1;
    const cls = CLASSES[g.character?.job ?? 0] || CLASSES[0];
    const sc2 = findSecondClass(g.meta.p.secondClass);
    const roleTag = sc2 ? `${sc2.icon}${sc2.name}` : `${cls.icon}${cls.name}`;
    $('roomInfo').textContent = g.sailing ? '⛵ 航行於海灣中' : g.interior ? `🏠 ${g.interior.kind === 'tavern' ? '楓的蘋果酒館' : '旅人小屋'}（室內）` : g.depth === -2 ? `⛵ 海風港鎮 · ${roleTag} Lv.${g.meta.p.level}` : g.field ? `【常駐區】${g.biome.name} · ${roleTag} Lv.${g.meta.p.level}` : g.depth < 0 ? `燈谷鎮 · ${roleTag} Lv.${g.meta.p.level}` : g.depth === 9 ? '【副本最終】鹿王林地' : `【副本】${g.biome.name} ${stage}-${room}`;
    const dayEl = $('dayInfo'); if (dayEl) { const di = dayInfo(g.dayTime || 0.3); dayEl.textContent = `${di.icon} ${di.label}`; }
    if (this.regionMapOpen) {
      this._rmT = (this._rmT || 0) + 1;
      if (this._rmT % 4 === 0) {
        const rmt = $('rmTitle'); if (rmt) rmt.textContent = g.interior ? '室內平面圖' : g.depth === -2 ? '海風港鎮 · 地區地圖' : g.field ? `${g.biome.name} · 地區地圖` : g.depth < 0 ? '燈谷鎮 · 地區地圖' : '副本房間地圖';
        drawRegionMap(g, $('regionMapCanvas'));
      }
    }
    $('killInfo').textContent = `${t(lang, 'kills')} ${p.kills}`;
    const cbEl = $('comboBadge');
    if (cbEl) {
      const cnt = g.combo?.count || 0;
      const show = cnt >= 2 && (g.combo?.timer || 0) > 0;
      cbEl.classList.toggle('hide', !show);
      if (show && cbEl._last !== cnt) {
        cbEl._last = cnt;
        cbEl.innerHTML = `🔥 ${cnt} 連擊！<small>攻速 +${Math.min(30, cnt * 2)}% · 暴擊 +${Math.min(22, Math.round(cnt * 1.5))}%</small>`;
        cbEl.style.transform = 'scale(1.12)';
        setTimeout(() => { cbEl.style.transform = 'scale(1)'; }, 110);
      }
    }
    const target = $('fieldTarget');
    let nearest = null, distance = 7;
    if (g.field && g.state === 'play') for (const enemy of g.enemies) {
      const d = enemy.pos.distanceTo(p.pos);
      if (!enemy.dead && d < distance) { nearest = enemy; distance = d; }
    }
    target.hidden = !nearest;
    if (nearest) target.textContent = (nearest.rival ? '演武旅人' : nearest.legendary ? '傳奇' : nearest.elite ? '精英' : '普通') + ' · Lv.' + nearest.level + '　' + Math.ceil(nearest.hp) + ' / ' + Math.ceil(nearest.maxHp);
    const M = g.meta, pr = M.p;
    $('shardInfo').textContent = `✦ ${pr.shards}${M.runShards ? ` (+${M.runShards})` : ''}` + (g.depth >= 0 && pr.mods.length ? ' · ' + M.activeMods().map(m => m.name).join('') : '');
    const coinEl = $('coinInfo'); if (coinEl) coinEl.textContent = `🪙 ${pr.coins}`;
    const mealEl = $('mealInfo');
    if (mealEl) {
      const left = pr.mealUntil ? Math.ceil((pr.mealUntil - Date.now()) / 1000) : 0;
      mealEl.hidden = left <= 0;
      if (left > 0) mealEl.textContent = `🐟 回血 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }
    const compass = $('fieldCompass');
    if (compass) {
      if (g.waypoint) {
        compass.hidden = false;
        compass.textContent = `🧭 導航：${g.waypoint.name} · ${g.waypoint.route}`;
      } else if (g.field && g.state === 'play') {
        const grave = pr.graves[g.field];
        const poi = grave ? { x: grave.x, z: grave.z, label: '🪦 墓碑' }
          : (g.exits[0] ? { x: g.exits[0].x, z: g.exits[0].z, label: '⛩ ' + FIELDS[g.field].dungeon } : null);
        if (poi) {
          const dx = poi.x - p.pos.x, dz = poi.z - p.pos.z, d = Math.round(Math.hypot(dx, dz));
          const dirs = ['東', '東南', '南', '西南', '西', '西北', '北', '東北'];
          const dir = dirs[Math.round(Math.atan2(dz, dx) / (Math.PI / 4) + 8) % 8];
          compass.hidden = false;
          compass.textContent = `${poi.label} · ${dir} ${d}m`;
        } else compass.hidden = true;
      } else compass.hidden = true;
    }
    // ground item tooltip
    const d = g.state === 'play' && !this.invOpen ? g.nearestDrop() : null;
    const tip = $('tip');
    if (d) { tip.classList.remove('hide'); if (tip.dataset.id != d.item.id) { tip.dataset.id = d.item.id; tip.innerHTML = this.itemHTML(d.item, p.equip[d.item.slot]); } }
    else { tip.classList.add('hide'); tip.dataset.id = ''; }
    if (this.invOpen && this.invTab === 'gear') this.renderInv(g);
  }
  itemHTML(it, cur) {
    const R = RARITY[it.rarity], ti = tierInfo(it.tier || 1);
    const lines = itemLines(it).map(l => `<div class="${l.imp ? 'imp' : l.special ? 'spc' : 'mod'}">${l.t}</div>`).join('');
    let cmp = '';
    if (cur !== undefined) {
      const diff = itemScore(it) - itemScore(cur);
      cmp = `<div class="cmp ${diff >= 0 ? 'up' : 'down'}">${cur ? (diff >= 0 ? `▲ 比目前好 ${diff}` : `▼ 比目前差 ${-diff}`) : '▲ 空欄位'}</div><div class="hint">雙擊或點擊按鈕裝備（舊裝備自動收入物理背包）</div>`;
    }
    return `<div class="iname" style="color:${R.color}"><span class="tier-tag" style="color:${ti.color}">${ti.tag}</span>${it.name}</div><div class="ibase">${ti.name} · ${R.name} · ${SLOTS[it.slot].name} · ${it.base} · 戰力 ${itemScore(it)}</div><div class="sep"></div>${lines}${cmp}`;
  }
  toggleRegionMap(g) {
    this.regionMapOpen = !this.regionMapOpen;
    const el = $('regionMap'); if (el) el.classList.toggle('hide', !this.regionMapOpen);
    if (this.regionMapOpen) drawRegionMap(g, $('regionMapCanvas'));
  }
  toggleInv(g, tab) {
    if (tab && this.invOpen && this.invTab !== tab) { this.setInvTab(g, tab); return; }
    this.invOpen = !this.invOpen;
    this.atStash = false;
    $('inv').classList.toggle('hide', !this.invOpen);
    if (this.invOpen) this.setInvTab(g, tab || (this.invTab === 'stash' ? 'bag' : this.invTab) || 'bag');
  }
  renderInv(g, force) {
    if (!force && (this._invT = (this._invT || 0) + 1) % 15) return;
    const p = g.player, S = p.stats;
    $('invEquip').innerHTML = Object.keys(SLOTS).map(k => {
      const it = p.equip[k];
      return `<div class="slot"><div class="slotname">${SLOTS[k].icon}</div><div>${it ? this.itemHTML(it) : '<div class="empty">（空）</div>'}</div></div>`;
    }).join('');
    const progress = g.meta.p, cls = CLASSES[g.character?.job ?? 0] || CLASSES[0], sc2 = findSecondClass(progress.secondClass);
    const rows = [
      ['職業', sc2 ? `${cls.icon} ${cls.name} → ${sc2.icon} ${sc2.name}` : `${cls.icon} ${cls.name}`],
      ['公會', progress.guildName || '未加入（可至公會大廳創立）'],
      ['職業被動', cls.summary],
      ['等級 / 經驗', progress.level === 30 ? '30 · 滿級' : progress.level + ' · ' + progress.xp + '/' + (progress.level * 40)],
      ['金幣 / 鑰石', progress.coins + ' / ' + progress.keys],
      ['木材 / 礦石 / 魚', progress.goods.wood + ' / ' + progress.goods.ore + ' / ' + progress.goods.fish],
      ['生命', `${Math.ceil(p.hp)} / ${S.maxHp}`], ['法力', `${S.mana}`], ['基礎傷害', `${S.baseDmg + S.addFire}`], ['傷害加成', `+${S.dmgPct}%`],
      ['攻擊速度', `+${S.atkSpd}%`], ['暴擊', `${S.crit}% × ${S.critMult}%`], ['範圍', `+${S.area}%`], ['移動速度', `+${S.moveSpd}%`],
      ['冷卻縮減', `${S.cdr}%`], ['減傷', `${S.armor}%`], ['擊中回復', `${S.lifeOnHit}`], ['餘燼彈數', `${S.proj}`],
    ];
    $('invStats').innerHTML = rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    const counts = {}; p.boons.forEach(b => counts[b] = (counts[b] || 0) + 1);
    $('invBoons').innerHTML = Object.entries(counts).map(([id, n]) => { const b = BOONS.find(x => x.id === id); return `<span class="chip" title="${b.desc}">${b.icon} ${b.name}${n > 1 ? ' ×' + n : ''}</span>`; }).join('') || '<span class="empty">尚無天賦</span>';
  }
  showBoons(g, choices) {
    this.boonChoices = choices;
    const el = $('boons'); el.classList.remove('hide');
    el.querySelector('.cards').innerHTML = choices.map((b, i) => `<button class="card" data-i="${i}"><div class="bicon">${b.icon}</div><div class="bname">${b.name}</div><div class="bdesc">${b.desc}</div><div class="key">${i + 1}</div></button>`).join('');
    el.querySelectorAll('.card').forEach(c => c.onclick = () => this.pickBoonIndex(+c.dataset.i));
  }
  pickBoonIndex(i) {
    if (!this.boonChoices || !this.boonChoices[i]) return;
    const b = this.boonChoices[i]; this.boonChoices = null;
    $('boons').classList.add('hide');
    this.game.takeBoon(b);
  }
  runSummary(g) {
    const p = g.player; const secs = Math.round((performance.now() - g.runStart) / 1000);
    return `抵達 ${Math.floor(g.depth / 3) + 1}-${g.depth % 3 + 1} · 擊敗 ${p.kills} · 總傷害 ${p.dmgDealt} · ${Math.floor(secs / 60)}分${secs % 60}秒`;
  }
  showDead(g) { this.heirUI(g, 'deadHeir'); $('deadSum').textContent = this.runSummary(g); $('dead').classList.remove('hide'); this.saveBest(g); }
  showWin(g) { this.heirUI(g, 'winHeir'); $('winSum').textContent = this.runSummary(g); $('win').classList.remove('hide'); this.saveBest(g, true); }
  saveBest(g, won) {
    try {
      const key = g.slot ? 'lv_best_' + g.slot : 'lv_best';
      const best = JSON.parse(localStorage.getItem(key) || '{"depth":0,"wins":0}');
      best.depth = Math.max(best.depth, g.depth); if (won) best.wins++;
      localStorage.setItem(key, JSON.stringify(best));
    } catch (e) { /* storage unavailable */ }
  }
}
