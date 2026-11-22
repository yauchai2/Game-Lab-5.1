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
    $('btnMute').onclick = () => { game.audio.init(); const m = game.audio.toggleMute(); $('btnMute').textContent = m ? '🔇' : '🔊'; };
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('lv_prof') || '{}'); } catch (e) { /* ignore */ }
    $('inName').value = saved.name || ''; game.hoodIdx = saved.hood || 0;
    const swatch = $('swatches'); const HC = ['#2f8a7e', '#d9543a', '#6a6ad0', '#e0a030', '#c060b0', '#58a858', '#4aa0d8', '#8a6a50'];
    HC.forEach((c, i) => { const b = document.createElement('button'); b.style.background = c; b.className = i === game.hoodIdx ? 'on' : ''; b.onclick = () => { game.hoodIdx = i; swatch.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i)); game.audio.sfx('ui'); }; swatch.appendChild(b); });
    $('btnTown2').onclick = () => { $('dead').classList.add('hide'); game.party = ''; game.enterTown(); };
    $('btnTown3').onclick = () => { $('win').classList.add('hide'); game.enterTown(); };
    $('btnStart').onclick = () => {
      game.audio.init(); game.audio.sfx('ui');
      game.playerName = ($('inName').value.trim() || '旅人').slice(0, 12); game.party = $('inParty').value.trim().slice(0, 12);
      try { localStorage.setItem('lv_prof', JSON.stringify({ name: $('inName').value.trim(), hood: game.hoodIdx })); } catch (e) { /* ignore */ }
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
    el.textContent = { item: '前路：稀有裝備', boon: '前路：天賦祝福', heal: '前路：溫泉休憩', run: '出發：燈谷冒險' }[near.type];
    el.className = 'exitHint ' + near.type;
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
    cd('sk-rmb', p.cds.bolt, 0.38);
    cd('sk-roll', p.cds.roll, 0.85);
    cd('sk-q', p.cds.slam, 5 * (1 - S.cdr / 100), !p.skills.slam);
    cd('sk-e', p.cds.wisp, 12 * (1 - S.cdr / 100), !p.skills.wisp);
    $('sk-r').querySelector('.cnt').textContent = `${p.flask.charges}/${p.flask.max}`;
    $('sk-r').classList.toggle('locked', p.flask.charges === 0);
    $('sk-r').querySelector('.cd').style.height = (p.flask.charges >= p.flask.max ? 0 : (1 - p.flask.prog) * 100) + '%';
    const stage = Math.floor(g.depth / 3) + 1, room = g.depth % 3 + 1;
    $('roomInfo').textContent = g.depth < 0 ? '燈谷鎮 · 安全區' : g.depth === 9 ? '最終 · 鹿王林地' : `${g.biome.name}  ${stage}-${room}`;
    $('killInfo').textContent = `擊敗 ${p.kills}`;
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
    const rows = [
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
  showDead(g) { $('deadSum').textContent = this.runSummary(g); $('dead').classList.remove('hide'); this.saveBest(g); }
  showWin(g) { $('winSum').textContent = this.runSummary(g); $('win').classList.remove('hide'); this.saveBest(g, true); }
  saveBest(g, won) {
    try {
      const best = JSON.parse(localStorage.getItem('lv_best') || '{"depth":0,"wins":0}');
      best.depth = Math.max(best.depth, g.depth); if (won) best.wins++;
      localStorage.setItem('lv_best', JSON.stringify(best));
    } catch (e) { /* storage unavailable */ }
  }
}
