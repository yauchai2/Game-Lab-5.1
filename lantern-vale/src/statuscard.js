// 旅人卡：HP（彈簧液體）、MP（燈火光點）、體力羽毛、經驗條，全部像素平塗＋物理效果
// 條內 Canvas 以低解析度繪製後 2 倍放大；飛濺／碎片／光點／羽毛畫在全螢幕 hudFx 畫布上。
const BW = 100, BH = 10;          // 條內部像素解析度（顯示為 200×20）
const FX = 2;                      // 全螢幕特效畫布縮放（像素感）
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const FEATHER = [ // 7×12 羽毛像素圖：1 金、2 亮、3 羽軸
  '...2...', '..212..', '.21311.', '.21311.', '211311.', '211311.', '211311.', '.11311.', '.11311.', '..131..', '...3...', '...3...',
];
function featherSprite(full) {
  const c = document.createElement('canvas'); c.width = 7; c.height = 12; const x = c.getContext('2d');
  const pal = full ? { 1: '#ffc83a', 2: '#fff0a8', 3: '#a8641e' } : { 1: '#5a4a60', 2: '#6e5c74', 3: '#3e3046' };
  FEATHER.forEach((row, y) => [...row].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, y, 1, 1); } }));
  return c;
}

export class StatusCard {
  constructor(ui) {
    this.ui = ui;
    const $ = id => document.getElementById(id);
    this.el = $('pcard'); this.hpC = $('pcHp'); this.mpC = $('pcMp'); this.ftC = $('pcFeather'); this.fx = $('hudFx');
    if (!this.el) return;
    this.hx = this.hpC.getContext('2d'); this.mx = this.mpC.getContext('2d'); this.fxx = this.fx.getContext('2d'); this.fx2 = this.ftC.getContext('2d');
    this.off = new Float32Array(BH); this.offV = new Float32Array(BH);
    this.bubbles = Array.from({ length: 7 }, () => ({ x: rnd(2, 90), y: rnd(0, BH), v: rnd(4, 9) }));
    this.motes = Array.from({ length: 26 }, () => ({ x: rnd(2, 90), y: rnd(1, BH - 1), vx: rnd(-8, 8), vy: rnd(-4, 4), tw: rnd(0, 6) }));
    this.parts = [];            // 全螢幕粒子
    this.hp = -1; this.lag = 1; this.lagHold = 0; this.mp = -1; this.st = 100;
    this.wave = -1; this.grey = 0; this.cardY = 0; this.cardV = 0; this.t = 0; this.prevS = null; this.prevV = [0, 0];
    this.fFull = featherSprite(true); this.fEmpty = featherSprite(false);
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    if (!this.fx) return;
    this.fx.width = Math.ceil(innerWidth / FX); this.fx.height = Math.ceil(innerHeight / FX);
    this.fxx.imageSmoothingEnabled = false;
  }
  rect(el) { const r = el.getBoundingClientRect(); return { x: r.left / FX, y: r.top / FX, w: r.width / FX, h: r.height / FX, b: r.bottom / FX }; }
  noMana() { this.grey = 0.35; for (const m of this.motes) { m.vx += rnd(-40, 40); m.vy += rnd(-20, 20); } }

  update(g, dt = 1 / 60) {
    if (!this.el) return;
    this.t += dt;
    const p = g.player, S = p.stats, shakeOn = g.settings?.shake !== 0;
    const hpF = clamp(p.hp / S.maxHp, 0, 1), mpF = clamp(p.mana / S.mana, 0, 1);
    // ---- 角色螢幕速度 → 液體慣性 ----
    const [sx, sy] = this.ui.screenPos(p.pos.x, (p.y || 0) + 1.2, p.pos.z);
    if (this.prevS) {
      const vx = (sx - this.prevS[0]) / dt, vy = (sy - this.prevS[1]) / dt;
      const ax = clamp((vx - this.prevV[0]) / dt, -4000, 4000), ay = clamp((vy - this.prevV[1]) / dt, -4000, 4000);
      for (let y = 0; y < BH; y++) this.offV[y] -= ax * 0.0009 * (0.4 + (BH - y) / BH) + (Math.abs(ay) > 1500 ? rnd(-3, 3) : 0);
      this.prevV = [vx * 0.5 + this.prevV[0] * 0.5, vy * 0.5 + this.prevV[1] * 0.5];
    }
    this.prevS = [sx, sy];
    // ---- 數值變化事件 ----
    const hpR = this.rect(this.hpC), mpR = this.rect(this.mpC), cardR = this.rect(this.el);
    if (this.hp >= 0) {
      const d = this.hp - hpF;
      if (d > 0.002) { // 受傷：飛濺＋延遲塊＋卡片下壓
        const n = Math.min(16, 3 + Math.round(d * 70)), fx0 = hpR.x + hpR.w * hpF;
        for (let i = 0; i < n; i++) this.parts.push({ k: 'drop', x: fx0 + rnd(-2, 4), y: hpR.y + rnd(1, hpR.h - 1), vx: rnd(-30, 90), vy: rnd(-150, -50), life: rnd(0.9, 1.4), floor: cardR.b - 3 });
        for (let y = 0; y < BH; y++) this.offV[y] += rnd(-30, 30) - 25;
        this.lagHold = 0.4; if (this.lag < this.hp) this.lag = this.hp;
        if (d > 0.05 && shakeOn) this.cardV += 60 + d * 300;
      } else if (d < -0.004) { this.wave = 0; for (let y = 0; y < BH; y++) this.offV[y] += 18; } // 回復：湧入波
    }
    this.hp = hpF;
    if (this.mp >= 0) {
      const d = this.mp - mpF;
      if (d > 0.01) { // 施法：光點飛向角色
        const n = Math.min(10, Math.ceil(d * 26)), fx0 = mpR.x + mpR.w * mpF;
        for (let i = 0; i < n; i++) this.parts.push({ k: 'mote', x0: fx0 - rnd(0, 6), y0: mpR.y + rnd(1, mpR.h - 1), x1: sx / FX, y1: sy / FX, t: -i * 0.03, dur: rnd(0.45, 0.65), arc: rnd(-40, 40) });
      }
    }
    this.mp = mpF;
    // 延遲塊：停 0.4 秒後收掉並碎裂
    if (this.lagHold > 0) this.lagHold -= dt;
    else if (this.lag > hpF) {
      const prev = this.lag; this.lag = Math.max(hpF, this.lag - dt * 0.6);
      const px0 = hpR.x + hpR.w * this.lag, w = (prev - this.lag) * hpR.w;
      if (Math.random() < w * 2.5) this.parts.push({ k: 'shard', x: px0 + rnd(0, 2), y: hpR.y + rnd(1, hpR.h - 2), vx: rnd(-10, 25), vy: rnd(-40, 0), life: rnd(0.7, 1.1), floor: cardR.b - 3 });
    } else this.lag = hpF;
    // ---- 卡片彈簧 ----
    this.cardV += (-this.cardY * 220 - this.cardV * 14) * dt; this.cardY += this.cardV * dt;
    this.el.style.transform = `translateY(${this.cardY.toFixed(1)}px)`;
    this.el.classList.toggle('low', hpF < 0.25 && hpF > 0);
    // ---- 液面彈簧（含鄰行耦合） ----
    const low = hpF < 0.25;
    for (let y = 0; y < BH; y++) {
      const nb = (y > 0 ? this.off[y - 1] : this.off[y]) + (y < BH - 1 ? this.off[y + 1] : this.off[y]) - 2 * this.off[y];
      this.offV[y] += (-this.off[y] * 90 + nb * 160 - this.offV[y] * 6) * dt + (low ? rnd(-14, 14) * dt * 10 : 0);
    }
    for (let y = 0; y < BH; y++) this.off[y] = clamp(this.off[y] + this.offV[y] * dt, -6, 6);
    this.drawHp(hpF, low);
    this.drawMp(mpF, dt);
    this.drawFeathers(p);
    this.stepFx(dt);
    const xp = this.el.querySelector('.pc-xp i'), pr = g.meta.p;
    if (xp) xp.style.width = (pr.level >= 30 ? 100 : Math.min(100, pr.xp / (pr.level * 40) * 100)) + '%';
  }

  drawHp(f, low) {
    const c = this.hx, fill = f * BW, lag = this.lag * BW;
    c.clearRect(0, 0, BW, BH);
    c.fillStyle = '#4a3a52'; c.fillRect(0, 0, BW, BH);
    c.fillStyle = '#3e3046'; c.fillRect(0, BH - 2, BW, 2);
    // 延遲塊
    if (lag > fill + 0.5) { c.fillStyle = (Math.floor(this.t * 20) % 2) ? '#ffd0a0' : '#ffbe86'; c.fillRect(Math.floor(fill), 1, Math.ceil(lag - fill), BH - 2); }
    if (f > 0) for (let y = 0; y < BH; y++) {
      const w = Math.round(clamp(fill + this.off[y] * (f > 0.98 ? 0.15 : 1), 0, BW));
      c.fillStyle = y < 2 ? '#ff8a7a' : y > BH - 3 ? '#b83a3a' : low ? (Math.floor(this.t * 6) % 2 ? '#f0584e' : '#e8504a') : '#e8504a';
      c.fillRect(0, y, w, 1);
      if (w > 1) { c.fillStyle = y < 2 ? '#ffc0b0' : '#ff7a6a'; c.fillRect(w - 1, y, 1, 1); } // 液面亮邊
    }
    // 流動高光
    c.fillStyle = 'rgba(255,230,220,.75)';
    for (let x = Math.floor((this.t * 18) % 26) - 26; x < fill - 2; x += 26) if (x > 0) c.fillRect(x, 2, 3, 1);
    // 氣泡（低血時沸騰）
    const nb = low ? 7 : 3;
    for (let i = 0; i < nb; i++) { const b = this.bubbles[i]; b.y -= b.v * (low ? 2.2 : 1) / 60; if (b.y < 1 || b.x > fill - 2) { b.y = BH - 2; b.x = rnd(1, Math.max(2, fill - 3)); } c.fillStyle = 'rgba(255,220,210,.8)'; c.fillRect(Math.floor(b.x), Math.floor(b.y), 1, 1); }
    // 回復波
    if (this.wave >= 0) { this.wave += 1.6; const wx = this.wave; c.fillStyle = 'rgba(170,255,150,.75)'; for (let y = 1; y < BH - 1; y++) c.fillRect(Math.floor(wx - Math.abs(y - BH / 2) * 0.6), y, 2, 1); if (wx > fill + 4) this.wave = -1; }
    // 刻度（每 10%）
    c.fillStyle = 'rgba(43,29,51,.35)'; for (let x = 10; x < BW; x += 10) c.fillRect(x, 0, 1, BH);
  }

  drawMp(f, dt) {
    const c = this.mx, fill = f * BW;
    c.clearRect(0, 0, BW, BH);
    c.fillStyle = '#4a3a52'; c.fillRect(0, 0, BW, BH);
    c.fillStyle = '#3e3046'; c.fillRect(0, BH - 2, BW, 2);
    if (f > 0) { c.fillStyle = this.grey > 0 ? '#7a7890' : '#3c6cc8'; c.fillRect(0, 0, Math.round(fill), BH); c.fillStyle = this.grey > 0 ? '#9a98b0' : '#5a90e8'; c.fillRect(0, 0, Math.round(fill), 2); }
    this.grey = Math.max(0, this.grey - dt);
    // 光點：互相推開、在液面內飄
    const n = Math.round(this.motes.length * f);
    for (let i = 0; i < n; i++) {
      const m = this.motes[i];
      for (let j = i + 1; j < n; j++) { const o = this.motes[j], dx = m.x - o.x, dy = m.y - o.y, d2 = dx * dx + dy * dy + 0.5; if (d2 < 30) { const k = 8 / d2; m.vx += dx * k; m.vy += dy * k; o.vx -= dx * k; o.vy -= dy * k; } }
      m.vx += rnd(-12, 12) * dt * 6; m.vy += rnd(-8, 8) * dt * 6; m.vx *= 0.96; m.vy *= 0.94;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < 1) { m.x = 1; m.vx = Math.abs(m.vx); } if (m.x > fill - 2) { m.x = Math.max(1, fill - 2); m.vx = -Math.abs(m.vx); }
      if (m.y < 1) { m.y = 1; m.vy = Math.abs(m.vy); } if (m.y > BH - 2) { m.y = BH - 2; m.vy = -Math.abs(m.vy); }
      m.tw += dt * 5; const lit = Math.sin(m.tw) > 0.3;
      c.fillStyle = this.grey > 0 ? '#d0d0dc' : lit ? '#e8f6ff' : '#a8d4ff'; c.fillRect(Math.floor(m.x), Math.floor(m.y), lit ? 2 : 1, lit ? 2 : 1);
    }
    c.fillStyle = 'rgba(43,29,51,.35)'; for (let x = 10; x < BW; x += 10) c.fillRect(x, 0, 1, BH);
  }

  drawFeathers(p) {
    const c = this.fx2, n = clamp(p.stamina / 20, 0, 5), show = p.stamina < 99.5 || p.air || p.climbing;
    this.ftC.style.opacity = show ? 1 : 0;
    c.clearRect(0, 0, this.ftC.width, this.ftC.height);
    const full = Math.floor(n + 1e-4);
    if (this.prevFull !== undefined && full < this.prevFull && show) { // 用掉一根：飄落
      const r = this.rect(this.ftC);
      for (let i = full; i < this.prevFull; i++) this.parts.push({ k: 'feather', x: r.x + i * 9 * (r.w / 45), y: r.y, vy: 10, ph: rnd(0, 6), life: 1.6 });
    }
    this.prevFull = full;
    for (let i = 0; i < 5; i++) {
      const x = i * 9;
      c.drawImage(this.fEmpty, x, 0);
      const part = clamp(n - i, 0, 1);
      if (part > 0) { const h = Math.ceil(12 * part); c.drawImage(this.fFull, 0, 12 - h, 7, h, x, 12 - h, 7, h); }
    }
  }

  stepFx(dt) {
    const c = this.fxx; c.clearRect(0, 0, this.fx.width, this.fx.height);
    for (const q of this.parts) {
      if (q.k === 'mote') {
        q.t += dt; const u = clamp(q.t / q.dur, 0, 1); if (q.t < 0) continue;
        const e = u * u * (3 - 2 * u), x = q.x0 + (q.x1 - q.x0) * e, y = q.y0 + (q.y1 - q.y0) * e - Math.sin(u * Math.PI) * (40 + q.arc);
        c.fillStyle = '#5a90e8'; c.fillRect(Math.floor(x) - 1, Math.floor(y) - 1, 3, 3);
        c.fillStyle = '#e8f6ff'; c.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        if (u >= 1) q.dead = true; continue;
      }
      if (q.k === 'feather') {
        q.life -= dt; q.ph += dt * 4; q.y += q.vy * dt; q.x += Math.sin(q.ph) * 0.6;
        c.globalAlpha = clamp(q.life, 0, 1); c.drawImage(this.fFull, Math.floor(q.x), Math.floor(q.y)); c.globalAlpha = 1;
        if (q.life <= 0) q.dead = true; continue;
      }
      q.life -= dt; q.vy += 320 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.y > q.floor) { q.y = q.floor; q.vy *= -0.35; q.vx *= 0.6; }
      const a = clamp(q.life * 2, 0, 1); c.globalAlpha = a;
      if (q.k === 'drop') { c.fillStyle = '#3b2a2a'; c.fillRect(Math.floor(q.x) - 1, Math.floor(q.y) - 1, 4, 4); c.fillStyle = '#e8504a'; c.fillRect(Math.floor(q.x), Math.floor(q.y), 2, 2); }
      else { c.fillStyle = '#ffbe86'; c.fillRect(Math.floor(q.x), Math.floor(q.y), 2, 2); }
      c.globalAlpha = 1;
      if (q.life <= 0) q.dead = true;
    }
    if (this.parts.length) this.parts = this.parts.filter(q => !q.dead);
  }
}
