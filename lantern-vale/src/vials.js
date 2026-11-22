// 2D 流體物理動態晃動玻璃試管／藥劑瓶（取代傳統靜態血條與魔力球）
// 支援：角色衝刺／急停／跳躍／受擊慣性晃動與濺水花、中毒黏稠氣泡、冰凍霜晶、狂暴／魔力過載沸騰頂起瓶塞

export class FluidVial {
  constructor(canvas, kind = 'hp') {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.kind = kind; // 'hp' | 'mp'
    this.W = canvas ? canvas.width : 64;
    this.H = canvas ? canvas.height : 96;
    this.N = 16;
    this.h = new Float32Array(this.N);
    this.v = new Float32Array(this.N);
    this.fill = 1.0;
    this.targetFill = 1.0;
    this.tilt = 0;
    this.tiltV = 0;
    this.corkY = 0;
    this.corkVy = 0;
    this.corkRot = 0;
    this.bubbles = [];
    this.splashes = [];
    this.t = 0;
  }

  // 施加慣性衝量（fx：左右加速度或急停、fy：垂直衝擊或受擊濺水）
  impulse(fx = 0, fy = 0) {
    this.tiltV += fx * 0.9;
    const mid = Math.floor(this.N / 2);
    for (let i = 0; i < this.N; i++) {
      const side = (i / (this.N - 1)) * 2 - 1;
      this.v[i] += side * fx * 28 + (Math.random() - 0.5) * Math.abs(fy) * 18;
      if (Math.abs(i - mid) <= 2) this.v[i] -= fy * 22;
    }
    const power = Math.hypot(fx, fy);
    if (power > 0.35 && this.fill > 0.06) {
      const cnt = Math.min(8, Math.ceil(power * 3.2));
      const baseY = this._surfaceY();
      for (let k = 0; k < cnt; k++) {
        this.splashes.push({
          x: 16 + Math.random() * (this.W - 32),
          y: baseY - 2,
          vx: (Math.random() - 0.5) * 45 + fx * 26,
          vy: -(28 + Math.random() * 44 + Math.abs(fy) * 28),
          r: 1.8 + Math.random() * 2.1,
          life: 0.45 + Math.random() * 0.35,
        });
      }
    }
  }

  _surfaceY() {
    const top = 26, bot = this.H - 12;
    return bot - (bot - top) * Math.max(0, Math.min(1, this.fill));
  }

  step(dt, frac, states = {}) {
    dt = Math.min(0.05, dt || 1 / 60);
    this.t += dt;
    this.targetFill = Math.max(0, Math.min(1, frac));
    const diff = this.targetFill - this.fill;
    if (Math.abs(diff) > 0.03) {
      // 血量或法力瞬間變化時也會引起液面波動
      this.v[Math.floor(this.N / 2)] += diff * 65;
    }
    this.fill += diff * Math.min(1, dt * 8);

    const frozen = !!(states.freeze || states.chill);
    const poisoned = !!(this.kind === 'hp' && states.poison);
    const boiling = !!(states.overload || states.frenzy);
    const shock = !!(states.shock);

    // 瓶身傾斜阻尼回復
    this.tiltV += (-this.tilt * 42 - this.tiltV * 6.5) * dt;
    this.tilt = Math.max(-0.28, Math.min(0.28, this.tilt + this.tiltV * dt));

    // 1D 淺水波方程（冰凍時阻尼極大、液面黏滯；沸騰時底部持續劇烈翻滾）
    const kSpring = frozen ? 18 : 68;
    const damp = frozen ? 0.82 : 0.94;
    const spread = frozen ? 0.10 : 0.26;
    for (let i = 0; i < this.N; i++) {
      const side = (i / (this.N - 1)) * 2 - 1;
      const targetH = side * this.tilt * 26;
      const acc = kSpring * (targetH - this.h[i]);
      this.v[i] = (this.v[i] + acc * dt) * damp;
      if (boiling && this.fill > 0.05) {
        this.v[i] += Math.sin(this.t * 28 + i * 1.9) * 32 * dt + (Math.random() - 0.5) * 48 * dt;
      }
      this.h[i] += this.v[i] * dt;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.N; i++) {
        if (i > 0) { const d = spread * (this.h[i] - this.h[i - 1]); this.v[i - 1] += d; }
        if (i < this.N - 1) { const d = spread * (this.h[i] - this.h[i + 1]); this.v[i + 1] += d; }
      }
    }

    // 沸騰／過載時蒸氣壓力把軟木瓶塞頂得喀喀作響
    if (boiling) {
      if (this.corkY >= -0.2 && Math.random() < dt * 14) {
        this.corkVy = -(34 + Math.random() * 26);
        this.corkRot = (Math.random() - 0.5) * 0.28;
      }
      this.corkVy += 190 * dt;
      this.corkY += this.corkVy * dt;
      if (this.corkY > 0) { this.corkY = 0; this.corkVy = -Math.abs(this.corkVy) * 0.35; this.corkRot *= 0.6; }
      if (this.corkY < -7.5) { this.corkY = -7.5; this.corkVy = Math.abs(this.corkVy) * 0.2; }
    } else {
      this.corkY *= 0.8; this.corkVy = 0; this.corkRot *= 0.8;
    }

    // 氣泡生成（中毒：黏稠綠紫大氣泡；沸騰：高速密集氣泡；平時：微量星光氣泡）
    const surfY = this._surfaceY();
    const rate = boiling ? 26 : poisoned ? 14 : shock ? 10 : 2.2;
    if (this.fill > 0.08 && Math.random() < dt * rate) {
      this.bubbles.push({
        x: 16 + Math.random() * (this.W - 32),
        y: this.H - 14 - Math.random() * 6,
        vy: -(boiling ? 48 + Math.random() * 34 : poisoned ? 18 + Math.random() * 14 : 22 + Math.random() * 12),
        r: poisoned ? 2.6 + Math.random() * 2.4 : boiling ? 1.8 + Math.random() * 2.2 : 1.4 + Math.random() * 1.2,
        wob: Math.random() * 6.28,
        kind: boiling ? 'boil' : poisoned ? 'poison' : shock ? 'shock' : 'idle',
      });
    }
    for (const b of this.bubbles) {
      b.y += b.vy * dt;
      b.x += Math.sin(this.t * 6 + b.wob) * 10 * dt;
    }
    this.bubbles = this.bubbles.filter(b => b.y > surfY + 1);

    // 濺起水花水滴更新
    for (const s of this.splashes) {
      s.vy += 155 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.x < 13) { s.x = 13; s.vx = Math.abs(s.vx) * 0.5; }
      if (s.x > this.W - 13) { s.x = this.W - 13; s.vx = -Math.abs(s.vx) * 0.5; }
    }
    this.splashes = this.splashes.filter(s => s.life > 0 && s.y < surfY + 6);

    this.states = { frozen, poisoned, boiling, shock };
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.W, H = this.H;
    const { frozen, poisoned, boiling, shock } = this.states || {};
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(this.tilt * 0.35);
    ctx.translate(-W / 2, -H / 2);

    const x0 = 11, x1 = W - 11, yTop = 22, yBot = H - 8, rad = 16;

    // 1. 軟木瓶塞（過載／狂暴時會被蒸氣頂得喀喀跳動）
    ctx.save();
    ctx.translate(W / 2, 14 + this.corkY);
    ctx.rotate(this.corkRot);
    ctx.fillStyle = '#b9824e';
    ctx.strokeStyle = '#2b1d22';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-11, -7); ctx.lineTo(11, -7); ctx.lineTo(9, 7); ctx.lineTo(-9, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9a46c';
    ctx.fillRect(-7, -5, 4, 9);
    ctx.restore();

    // 2. 玻璃試管外廓路徑（先畫暗底再裁切流體）
    const traceTube = () => {
      ctx.beginPath();
      ctx.moveTo(W / 2 - 11, 18);
      ctx.lineTo(W / 2 - 11, yTop + 4);
      ctx.quadraticCurveTo(x0, yTop + 8, x0, yTop + 18);
      ctx.lineTo(x0, yBot - rad);
      ctx.arcTo(x0, yBot, x0 + rad, yBot, rad);
      ctx.lineTo(x1 - rad, yBot);
      ctx.arcTo(x1, yBot, x1, yBot - rad, rad);
      ctx.lineTo(x1, yTop + 18);
      ctx.quadraticCurveTo(x1, yTop + 8, W / 2 + 11, yTop + 4);
      ctx.lineTo(W / 2 + 11, 18);
      ctx.closePath();
    };

    traceTube();
    ctx.fillStyle = 'rgba(22, 16, 24, 0.82)';
    ctx.fill();

    // 3. 裁切區域內繪製 2D 流體波浪、氣泡、水花與冰霜結晶
    ctx.save();
    traceTube();
    ctx.clip();

    const surfY = this._surfaceY();
    const pal = this.kind === 'hp'
      ? (poisoned ? { top: '#6fe06a', bot: '#3c7a4e', foam: '#c8ff8a' }
        : boiling ? { top: '#ff9040', bot: '#d92626', foam: '#fff08a' }
        : frozen ? { top: '#78d8ff', bot: '#467ca8', foam: '#e6fbff' }
        : { top: '#ff6e78', bot: '#b8253a', foam: '#ffc8d0' })
      : (boiling ? { top: '#c87aff', bot: '#4a28b8', foam: '#f0d8ff' }
        : shock ? { top: '#7ef6ff', bot: '#2878c8', foam: '#ffffff' }
        : frozen ? { top: '#a8ecff', bot: '#386e9e', foam: '#ffffff' }
        : { top: '#68b4ff', bot: '#2552a8', foam: '#c8e8ff' });

    if (this.fill > 0.01) {
      const grad = ctx.createLinearGradient(0, surfY - 6, 0, yBot);
      grad.addColorStop(0, pal.top);
      grad.addColorStop(1, pal.bot);
      ctx.beginPath();
      ctx.moveTo(x0 - 2, yBot + 4);
      for (let i = 0; i < this.N; i++) {
        const px = x0 + (i / (this.N - 1)) * (x1 - x0);
        const py = surfY + this.h[i];
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x1 + 2, yBot + 4);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 液面高光浪峰線
      ctx.beginPath();
      for (let i = 0; i < this.N; i++) {
        const px = x0 + (i / (this.N - 1)) * (x1 - x0);
        const py = surfY + this.h[i];
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = pal.foam;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 氣泡
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.kind === 'poison' ? 'rgba(186, 255, 110, 0.78)'
        : b.kind === 'boil' ? 'rgba(255, 245, 180, 0.85)'
        : 'rgba(255, 255, 255, 0.55)';
      ctx.fill();
    }

    // 濺起水滴
    ctx.fillStyle = pal.top;
    for (const s of this.splashes) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 冰凍狀態：瓶壁結霜冰晶
    if (frozen) {
      ctx.strokeStyle = 'rgba(220, 248, 255, 0.9)';
      ctx.lineWidth = 2;
      for (let y = yTop + 14; y < yBot - 12; y += 14) {
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 7, y - 4); ctx.moveTo(x1, y + 6); ctx.lineTo(x1 - 7, y + 2); ctx.stroke();
      }
    }

    // 4. 玻璃反光與刻度線
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x0 + 4, yTop + 14, 4, yBot - yTop - 28);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 1; k <= 3; k++) {
      const ty = yTop + 16 + k * ((yBot - yTop - 26) / 4);
      ctx.fillRect(x1 - 9, ty, 6, 2);
    }
    ctx.restore();

    // 5. 瓶身粗像素輪廓與金屬瓶口環
    traceTube();
    ctx.lineWidth = 3;
    ctx.strokeStyle = boiling ? '#ffd85a' : poisoned ? '#8cf07a' : frozen ? '#9ae8ff' : '#2b1d22';
    ctx.stroke();

    ctx.fillStyle = '#c9a66b';
    ctx.strokeStyle = '#2b1d22';
    ctx.lineWidth = 2;
    ctx.fillRect(W / 2 - 14, 17, 28, 5);
    ctx.strokeRect(W / 2 - 14, 17, 28, 5);
    ctx.restore();
  }
}
