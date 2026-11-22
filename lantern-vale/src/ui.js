import { FIELDS } from './frontier.js';
import { bindTouch } from './touch.js';
import { bindWorldMap } from './worldmap.js';
import { bindCharacters } from './characters.js';
import { buildPanels } from './panels.js';
import { loadSettings, applySettings, buildSettingsUI } from './settings.js';
import { CLASSES, bindPuzzleUI } from './puzzle.js';
import { dayInfo, findSecondClass, drawRegionMap } from './world_alive.js';
import * as THREE from 'three';
import { RARITY, SLOTS, itemLines, itemScore, BOONS } from './loot.js';

const $ = id => document.getElementById(id);
const v3 = new THREE.Vector3();

export class UI {
  constructor() {
    this.nums = [];
    this.invOpen = false;
    this.boonChoices = null;
  }
  bind(game) {
    this.game = game;
    game.settings = loadSettings(); buildPanels(game); buildSettingsUI(game); applySettings(game);
    $('btnMute').onclick = () => { game.audio.init(); const m = game.audio.toggleMute(); $('btnMute').textContent = m ? '🔇' : '🔊'; };
    $('btnMute').textContent = game.audio.muted ? '🔇' : '🔊';
    bindWorldMap(game); bindTouch(game); bindPuzzleUI(game);
    const pzBtn = $('sk-puzzle'); if (pzBtn) pzBtn.onclick = () => { if (this.puzzleOpen) this.closePuzzle(); else this.openPuzzle(); };
    const dayBtn = $('dayInfo'); if (dayBtn) dayBtn.onclick = () => { game.dayTime = ((game.dayTime || 0) + 0.25) % 1; const d = dayInfo(game.dayTime); game.ui.toast(`時間推進至 ${d.icon} ${d.label}`, '#ffe9a0'); };
    for (let i = 0; i < 4; i++) { const el = $('sk-s' + i); if (el) el.onclick = () => game.castHotbar(i); }
    const enterCharacter = bindCharacters(game);
    $('btnTown2').onclick = () => { $('dead').classList.add('hide'); game.party = ''; game.enterTown(); };
    $('btnTown3').onclick = () => { $('win').classList.add('hide'); game.enterTown(); };
    $('btnStart').onclick = () => {
      game.audio.init(); game.audio.sfx('ui');
      game.playerName = ($('inName').value.trim() || '旅人').slice(0, 12); game.party = $('inParty').value.trim().slice(0, 12);
      enterCharacter();
      game.net.connect(game.playerName, game.hoodIdx);
      $('title').classList.add('hide'); $('hud').classList.remove('hide'); game.enterTown();
    };
    $('btnRetry').onclick = () => { $('dead').classList.add('hide'); game.startRun(); };
    $('btnAgain').onclick = () => { $('win').classList.add('hide'); game.startRun(); };
    document.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => {
      game.pipe.setPixelScale(+b.dataset.scale);
      document.querySelectorAll('[data-scale]').forEach(x => x.classList.toggle('on', x === b));
    });
  }
  netStatus(s) {
    const el = $('netStat');
    if (s.ok) { el.textContent = '● 線上'; el.className = 'net on'; }
    else { el.textContent = s.reason === 'no-server' ? '○ 離線模式（鎮民 NPC 陪你）' : '○ 連線中斷'; el.className = 'net off'; if (s.reason === 'closed') this.addChat('', '與伺服器的連線中斷了', true); }
    $('netStat').classList.remove('hide');
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
    el.textContent = { item: '前路：稀有裝備', boon: '前路：天賦祝福', heal: '前路：溫泉休憩', run: '前往晨光草原（常駐普通地圖）', town: '返回燈谷鎮（免清怪）', dungeon: '消耗 1 鑰石 · 進入副本地圖' }[near.type];
    if(near.type==='dungeon') el.textContent='【副本地圖】'+FIELDS[g.field].dungeon+' · 鑰石 ×1';
    el.className = 'exitHint ' + near.type;
  }
  spotHint(g) {
    const el = $('spotHint'), s = this.panelOpen || this.invOpen || this.setOpen || this.puzzleOpen ? null : g.nearSpot();
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
    { const st = $('stam'); if (!st.children.length) for (let i = 0; i < 10; i++) st.appendChild(document.createElement('i'));
      const n = p.stamina / 10; for (let i = 0; i < 10; i++) st.children[i].classList.toggle('empty', i + 0.5 > n);
      st.classList.toggle('hide', p.stamina >= 99.5 && !p.air && !p.climbing); }
    $('hpFill').style.height = (p.hp / S.maxHp * 100) + '%';
    $('mpFill').style.height = (p.mana / S.mana * 100) + '%';
    $('hpText').textContent = `${Math.ceil(p.hp)}/${S.maxHp}`;
    $('mpText').textContent = `${Math.floor(p.mana)}/${S.mana}`;
    const cd = (id, cur, max, locked) => {
      const el = $(id); el.classList.toggle('locked', !!locked);
      el.querySelector('.cd').style.height = (max > 0 ? Math.min(1, cur / max) * 100 : 0) + '%';
    };
    cd('sk-lmb', p.cds.atk, 0.5);
    const hotbar = p.hotbar || [];
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
        ic.textContent = '—'; sn.textContent = '空位'; sup.hidden = true; el.title = '按 K 開啟技能拼圖放入主動技能';
        cd('sk-s' + i, 0, 1, true);
      }
    }
    cd('sk-roll', p.cds.roll, 0.85);
    $('sk-r').querySelector('.cnt').textContent = `${p.flask.charges}/${p.flask.max}`;
    $('sk-r').classList.toggle('locked', p.flask.charges === 0);
    $('sk-r').querySelector('.cd').style.height = (p.flask.charges >= p.flask.max ? 0 : (1 - p.flask.prog) * 100) + '%';
    const stage = Math.floor(g.depth / 3) + 1, room = g.depth % 3 + 1;
    const cls = CLASSES[g.character?.job ?? 0] || CLASSES[0];
    const sc2 = findSecondClass(g.meta.p.secondClass);
    const roleTag = sc2 ? `${sc2.icon}${sc2.name}` : `${cls.icon}${cls.name}`;
    $('roomInfo').textContent = g.interior ? `🏠 ${g.interior.kind === 'tavern' ? '楓的蘋果酒館' : '旅人小屋'}（室內）` : g.field ? `【常駐區】${g.biome.name} · ${roleTag} Lv.${g.meta.p.level}` : g.depth < 0 ? `燈谷鎮 · ${roleTag} Lv.${g.meta.p.level}` : g.depth === 9 ? '【副本最終】鹿王林地' : `【副本】${g.biome.name} ${stage}-${room}`;
    const dayEl = $('dayInfo'); if (dayEl) { const di = dayInfo(g.dayTime || 0.3); dayEl.textContent = `${di.icon} ${di.label}`; }
    if (this.regionMapOpen) {
      this._rmT = (this._rmT || 0) + 1;
      if (this._rmT % 4 === 0) {
        const rmt = $('rmTitle'); if (rmt) rmt.textContent = g.interior ? '室內平面圖' : g.field ? `${g.biome.name} · 地區地圖` : g.depth < 0 ? '燈谷鎮 · 地區地圖' : '副本房間地圖';
        drawRegionMap(g, $('regionMapCanvas'));
      }
    }
    $('killInfo').textContent = '擊敗 ' + p.kills;
    const target=$('fieldTarget');
    let nearest=null, distance=7;
    if (g.field && g.state==='play') for(const enemy of g.enemies) {
      const d=enemy.pos.distanceTo(p.pos);
      if(!enemy.dead && d<distance){nearest=enemy;distance=d;}
    }
    target.hidden=!nearest;
    if(nearest) target.textContent=(nearest.rival?'演武旅人':nearest.legendary?'傳奇':nearest.elite?'精英':'普通')+' · Lv.'+nearest.level+'　'+Math.ceil(nearest.hp)+' / '+Math.ceil(nearest.maxHp);
    const M = g.meta, pr = M.p;
    $('shardInfo').textContent = `✦ ${pr.shards}${M.runShards ? ` (+${M.runShards})` : ''}` + (g.depth >= 0 && pr.mods.length ? ' · ' + M.activeMods().map(m => m.name).join('') : '');
    const coinEl = $('coinInfo'); if (coinEl) coinEl.textContent = `🪙 ${pr.coins}`;
    const mealEl = $('mealInfo');
    if (mealEl) {
      const left = pr.mealUntil ? Math.ceil((pr.mealUntil - Date.now()) / 1000) : 0;
      mealEl.hidden = left <= 0;
      if (left > 0) mealEl.textContent = `🐟 回血 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }
    const xpFill = $('xpFill');
    if (xpFill) xpFill.style.width = (pr.level >= 30 ? 100 : Math.min(100, pr.xp / (pr.level * 40) * 100)) + '%';
    const compass = $('fieldCompass');
    if (compass) {
      if (g.field && g.state === 'play') {
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
    if (this.invOpen) this.renderInv(g);
  }
  itemHTML(it, cur) {
    const R = RARITY[it.rarity];
    const lines = itemLines(it).map(l => `<div class="${l.imp ? 'imp' : l.special ? 'spc' : 'mod'}">${l.t}</div>`).join('');
    let cmp = '';
    if (cur !== undefined) {
      const diff = itemScore(it) - itemScore(cur);
      cmp = `<div class="cmp ${diff >= 0 ? 'up' : 'down'}">${cur ? (diff >= 0 ? `▲ 比目前好 ${diff}` : `▼ 比目前差 ${-diff}`) : '▲ 空欄位'}</div><div class="hint">[F] 裝備</div>`;
    }
    return `<div class="iname" style="color:${R.color}">${it.name}</div><div class="ibase">${R.name} · ${SLOTS[it.slot].name} · ${it.base}</div><div class="sep"></div>${lines}${cmp}`;
  }
  toggleRegionMap(g) {
    this.regionMapOpen = !this.regionMapOpen;
    const el = $('regionMap'); if (el) el.classList.toggle('hide', !this.regionMapOpen);
    if (this.regionMapOpen) drawRegionMap(g, $('regionMapCanvas'));
  }
  toggleInv(g) {
    this.invOpen = !this.invOpen;
    $('inv').classList.toggle('hide', !this.invOpen);
    if (this.invOpen) this.renderInv(g, true);
  }
  renderInv(g, force) {
    if (!force && (this._invT = (this._invT || 0) + 1) % 15) return;
    const p = g.player, S = p.stats;
    $('invEquip').innerHTML = Object.keys(SLOTS).map(k => {
      const it = p.equip[k];
      return `<div class="slot"><div class="slotname">${SLOTS[k].icon}</div><div>${it ? this.itemHTML(it) : '<div class="empty">（空）</div>'}</div></div>`;
    }).join('');
    const progress=g.meta.p, cls = CLASSES[g.character?.job ?? 0] || CLASSES[0], sc2 = findSecondClass(progress.secondClass);
    const rows = [
      ['職業', sc2 ? `${cls.icon} ${cls.name} → ${sc2.icon} ${sc2.name}` : `${cls.icon} ${cls.name}`],
      ['公會', progress.guildName || '未加入（可至公會大廳創立）'],
      ['職業被動', cls.summary],
      ['等級 / 經驗', progress.level===30?'30 · 滿級':progress.level+' · '+progress.xp+'/'+(progress.level*40)],
      ['金幣 / 鑰石',progress.coins+' / '+progress.keys],
      ['木材 / 礦石 / 魚',progress.goods.wood+' / '+progress.goods.ore+' / '+progress.goods.fish],
      ['生命', `${Math.ceil(p.hp)} / ${S.maxHp}`], ['法力', `${S.mana}`], ['基礎傷害', `${S.baseDmg + S.addFire}`], ['傷害加成', `+${S.dmgPct}%`],
      ['攻擊速度', `+${S.atkSpd}%`], ['暴擊', `${S.crit}% × ${S.critMult}%`], ['範圍', `+${S.area}%`], ['移動速度', `+${S.moveSpd}%`],
      ['冷卻縮減', `${S.cdr}%`], ['減傷', `${S.armor}%`], ['擊中回復', `${S.lifeOnHit}`], ['餘燼彈數', `${S.proj}`],
    ];
    $('invStats').innerHTML = rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    const counts = {}; p.boons.forEach(b => counts[b] = (counts[b] || 0) + 1);
    {
      $('invBoons').innerHTML = Object.entries(counts).map(([id, n]) => { const b = BOONS.find(x => x.id === id); return `<span class="chip" title="${b.desc}">${b.icon} ${b.name}${n > 1 ? ' ×' + n : ''}</span>`; }).join('') || '<span class="empty">尚無天賦</span>';
    }
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
