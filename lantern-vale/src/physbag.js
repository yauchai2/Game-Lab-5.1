// 孤山獨影（Cairn）風格 2D 重力物理掉落背包與倉庫系統（依物品類型呈現不同形狀與大小）
import { RARITY, SLOTS, serializeItem, deserializeItem, makeItem } from './loot.js';
import { t } from './i18n.js';

// 依物件類型回傳物理形狀與尺寸（capsule 長法杖、rect 寬披風、diamond 菱形飾品、flask 藥瓶、crate 木箱、circle 漿果）
export function shapeForItem(data) {
  if (data.shape && data.hw && data.hh) return { shape: data.shape, hw: data.hw, hh: data.hh, r: Math.max(data.hw, data.hh) * 0.92 };
  if (data.kind === 'gear') {
    const slot = data.item?.slot || data.slot;
    if (slot === 'staff') return { shape: 'capsule', hw: 13, hh: 30, r: 23 };
    if (slot === 'cloak') return { shape: 'rect', hw: 27, hh: 21, r: 25 };
    if (slot === 'charm') return { shape: 'diamond', hw: 20, hh: 22, r: 20 };
    return { shape: 'rect', hw: 22, hh: 22, r: 22 };
  }
  if (data.recall) return { shape: 'diamond', hw: 17, hh: 19, r: 17 };
  if (data.mana && data.heal) return { shape: 'crate', hw: 23, hh: 23, r: 23 };
  if (data.mana) return { shape: 'flask', hw: 15, hh: 23, r: 19 };
  if (data.heal) return { shape: 'circle', hw: 15, hh: 15, r: 15 };
  return { shape: 'circle', hw: 18, hh: 18, r: 18 };
}

export function ensurePhysicsStorage(metaP) {
  if (!Array.isArray(metaP.bagItems)) {
    metaP.bagItems = [
      { uid: 'sup_berry', kind: 'consumable', shape: 'circle', hw: 15, hh: 15, icon: '🍓', name: '山谷甜莓', desc: '立即回復 45% 生命', color: '#ff7a8a', r: 15, heal: 0.45 },
      { uid: 'sup_cider', kind: 'consumable', shape: 'flask', hw: 15, hh: 23, icon: '🍺', name: '楓糖蘋果酒', desc: '立即回復 60% 法力並解除中毒', color: '#f5b041', r: 19, mana: 0.6, cure: true },
      { uid: 'sup_scroll', kind: 'consumable', shape: 'diamond', hw: 17, hh: 19, icon: '🐚', name: '海風回城螺', desc: '使用後立即觸發快捷回城', color: '#7ad8e8', r: 17, recall: true },
    ];
  }
  if (!Array.isArray(metaP.stashItems)) {
    metaP.stashItems = [
      { uid: 'st_gem', kind: 'consumable', shape: 'crate', hw: 23, hh: 23, icon: '🍯', name: '陳年蜂王蜜箱', desc: '回復 100% 生命與法力並淨化所有異常', color: '#ffd85a', r: 23, heal: 1, mana: 1, cure: true },
      { uid: 'st_gear1', kind: 'gear', shape: 'rect', hw: 27, hh: 21, icon: '🧥', name: '海風旅人披風', color: '#6cb8ff', r: 25, item: serializeItem(makeItem(() => 0.42, 2, 1, 'cloak')) },
      { uid: 'st_staff1', kind: 'gear', shape: 'capsule', hw: 13, hh: 30, icon: '🪄', name: '遠航旅杖', color: '#ffd85a', r: 23, item: serializeItem(makeItem(() => 0.61, 3, 2, 'staff')) },
    ];
  }
  return { bag: metaP.bagItems, stash: metaP.stashItems };
}

export function addGearToBag(metaP, item) {
  ensurePhysicsStorage(metaP);
  const R = RARITY[item.rarity] || RARITY[0];
  const sh = shapeForItem({ kind: 'gear', slot: item.slot });
  metaP.bagItems.push({
    uid: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    kind: 'gear',
    shape: sh.shape,
    hw: sh.hw,
    hh: sh.hh,
    icon: SLOTS[item.slot]?.icon || '✨',
    name: item.name,
    color: R.color,
    r: sh.r,
    item: serializeItem(item),
  });
}

// 輕量 2D 剛體重力物理模擬（不同形狀與尺寸：長法杖、寬披風、菱形護符、圓形漿果、木箱、藥劑瓶）
export class PhysicsContainer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.bodies = [];
    this.drag = null;
    this.hover = null;
    this.selectedUid = null;
    this.onSelect = opts.onSelect || (() => {});
    this.onDoubleClick = opts.onDoubleClick || (() => {});
    this.bgTheme = opts.theme || 'bag';
    this._bind();
  }

  sync(items) {
    const map = new Map(this.bodies.map(b => [b.data.uid, b]));
    const next = [];
    items.forEach((it, idx) => {
      const sh = shapeForItem(it);
      const old = map.get(it.uid);
      if (old) {
        old.data = it;
        old.shape = sh.shape; old.hw = sh.hw; old.hh = sh.hh; old.r = sh.r;
        next.push(old);
      } else {
        next.push({
          data: it,
          shape: sh.shape, hw: sh.hw, hh: sh.hh, r: sh.r,
          x: 48 + ((idx * 63) % (this.W - 96)) + (Math.random() - 0.5) * 14,
          y: 34 + Math.floor(idx / 4) * 22,
          vx: (Math.random() - 0.5) * 90,
          vy: 10 + Math.random() * 40,
          ang: (Math.random() - 0.5) * 0.7,
          vang: (Math.random() - 0.5) * 2.2,
        });
      }
    });
    this.bodies = next;
    if (this.selectedUid && !this.bodies.some(b => b.data.uid === this.selectedUid)) {
      this.selectedUid = null;
      this.onSelect(null);
    }
  }

  shake() {
    for (const b of this.bodies) {
      b.vy = -(280 + Math.random() * 260);
      b.vx = (Math.random() - 0.5) * 320;
      b.vang = (Math.random() - 0.5) * 10;
    }
  }

  _extents(b) {
    const c = Math.abs(Math.cos(b.ang)), s = Math.abs(Math.sin(b.ang));
    return { ex: b.hw * c + b.hh * s, ey: b.hw * s + b.hh * c };
  }

  step(dt) {
    const g = 900, pad = 12, W = this.W, H = this.H;
    for (const b of this.bodies) {
      if (this.drag && this.drag.body === b) continue;
      b.vy += g * dt;
      b.vx *= 0.992; b.vy *= 0.995;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ang += b.vang * dt; b.vang *= 0.95;
      const { ex, ey } = this._extents(b);
      if (b.x - ex < pad) { b.x = pad + ex; b.vx = Math.abs(b.vx) * 0.42; }
      if (b.x + ex > W - pad) { b.x = W - pad - ex; b.vx = -Math.abs(b.vx) * 0.42; }
      if (b.y - ey < pad) { b.y = pad + ey; b.vy = Math.abs(b.vy) * 0.35; }
      if (b.y + ey > H - pad) {
        b.y = H - pad - ey;
        b.vy = -Math.abs(b.vy) * 0.3;
        if (Math.abs(b.vy) < 22) b.vy = 0;
        b.vx *= 0.82;
        // 非圓形物件落地後會自然傾向橫躺或放平
        if (b.shape === 'rect' || b.shape === 'crate' || b.shape === 'capsule') {
          const snap = Math.round(b.ang / (Math.PI / 2)) * (Math.PI / 2);
          b.vang += (snap - b.ang) * 4 * dt;
        } else {
          b.vang = b.vx * 0.025;
        }
      }
    }
    // 不同尺寸與形狀的互相推擠堆疊（2 次迭代）
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          const a = this.bodies[i], b = this.bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const ea = this._extents(a), eb = this._extents(b);
          const nx = dx / dist, ny = dy / dist;
          const ra = Math.abs(nx) * ea.ex + Math.abs(ny) * ea.ey;
          const rb = Math.abs(nx) * eb.ex + Math.abs(ny) * eb.ey;
          const minD = (ra + rb) * 0.78 + 2;
          if (dist < minD) {
            const overlap = (minD - dist) * 0.5;
            if (!this.drag || this.drag.body !== a) { a.x -= nx * overlap; a.y -= ny * overlap; }
            if (!this.drag || this.drag.body !== b) { b.x += nx * overlap; b.y += ny * overlap; }
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              const imp = -vn * 0.55;
              a.vx -= imp * nx; a.vy -= imp * ny;
              b.vx += imp * nx; b.vy += imp * ny;
            }
          }
        }
      }
    }
  }

  _traceShape(ctx, b) {
    const hw = b.hw, hh = b.hh;
    ctx.beginPath();
    if (b.shape === 'capsule') {
      const r = hw;
      ctx.moveTo(-hw, -hh + r);
      ctx.arc(0, -hh + r, r, Math.PI, 0);
      ctx.lineTo(hw, hh - r);
      ctx.arc(0, hh - r, r, 0, Math.PI);
      ctx.closePath();
    } else if (b.shape === 'rect' || b.shape === 'crate') {
      const cr = b.shape === 'crate' ? 4 : 8;
      ctx.roundRect ? ctx.roundRect(-hw, -hh, hw * 2, hh * 2, cr) : ctx.rect(-hw, -hh, hw * 2, hh * 2);
    } else if (b.shape === 'diamond') {
      ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath();
    } else if (b.shape === 'flask') {
      ctx.moveTo(-6, -hh); ctx.lineTo(6, -hh); ctx.lineTo(6, -hh + 10);
      ctx.quadraticCurveTo(hw, -4, hw, hh - 8);
      ctx.quadraticCurveTo(hw, hh, 0, hh);
      ctx.quadraticCurveTo(-hw, hh, -hw, hh - 8);
      ctx.quadraticCurveTo(-hw, -4, -6, -hh + 10);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, Math.min(hw, hh), 0, Math.PI * 2);
    }
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = this.bgTheme === 'stash' ? '#4a362a' : '#2e2524';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = this.bgTheme === 'stash' ? '#8c694a' : '#6c5848';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.setLineDash([]);

    for (const b of this.bodies) {
      const sel = b.data.uid === this.selectedUid;
      const hov = this.hover === b;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang);
      // 投影
      ctx.save();
      ctx.translate(2, 4);
      this._traceShape(ctx, b);
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fill();
      ctx.restore();
      // 主體
      this._traceShape(ctx, b);
      ctx.fillStyle = b.shape === 'crate' ? '#d9b07a' : b.shape === 'flask' ? '#e8f6ff' : '#fff5dc';
      ctx.fill();
      if (b.shape === 'crate') {
        ctx.strokeStyle = '#9a6e42'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-b.hw + 3, -b.hh + 3); ctx.lineTo(b.hw - 3, b.hh - 3); ctx.stroke();
      }
      this._traceShape(ctx, b);
      ctx.lineWidth = sel ? 4 : hov ? 3 : 2.5;
      ctx.strokeStyle = sel ? '#ffd85a' : b.data.color || '#7a5a40';
      ctx.stroke();
      ctx.font = `${Math.round(Math.min(b.hw, b.hh) * 1.15)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2d1e1e';
      ctx.fillText(b.data.icon || '📦', 0, 1);
      ctx.restore();
    }
    if (this.hover) {
      const d = this.hover.data;
      const txt = d.name;
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(txt).width + 14;
      const tx = Math.max(6, Math.min(W - tw - 6, this.hover.x - tw / 2));
      const ty = Math.max(6, this.hover.y - this.hover.hh - 26);
      ctx.fillStyle = 'rgba(43,29,34,0.92)';
      ctx.fillRect(tx, ty, tw, 20);
      ctx.strokeStyle = '#ffd85a'; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw, 20);
      ctx.fillStyle = '#fff8e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, tx + 7, ty + 10);
    }
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (this.W / rect.width), y: (e.clientY - rect.top) * (this.H / rect.height) };
  }

  _hit(x, y) {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      const dx = x - b.x, dy = y - b.y;
      const c = Math.cos(-b.ang), s = Math.sin(-b.ang);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= b.hw + 4 && Math.abs(ly) <= b.hh + 4) return b;
    }
    return null;
  }

  _bind() {
    let lastClickT = 0, lastClickUid = null;
    this.canvas.addEventListener('pointerdown', e => {
      const p = this._pos(e), b = this._hit(p.x, p.y);
      if (!b) return;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.drag = { body: b, ox: b.x - p.x, oy: b.y - p.y, lx: p.x, ly: p.y };
      this.selectedUid = b.data.uid;
      this.onSelect(b.data);
      document.body.classList.add('holding-gem');
      const now = performance.now();
      if (now - lastClickT < 340 && lastClickUid === b.data.uid) {
        this.onDoubleClick(b.data);
      }
      lastClickT = now; lastClickUid = b.data.uid;
    });
    this.canvas.addEventListener('pointermove', e => {
      const p = this._pos(e);
      if (this.drag) {
        const b = this.drag.body;
        b.vx = (p.x - this.drag.lx) * 28;
        b.vy = (p.y - this.drag.ly) * 28;
        b.x = Math.max(b.hw + 8, Math.min(this.W - b.hw - 8, p.x + this.drag.ox));
        b.y = Math.max(b.hh + 8, Math.min(this.H - b.hh - 8, p.y + this.drag.oy));
        this.drag.lx = p.x; this.drag.ly = p.y;
      } else {
        this.hover = this._hit(p.x, p.y);
        this.canvas.style.cursor = this.hover ? 'grab' : '';
      }
    });
    const end = () => {
      if (this.drag) { this.drag = null; document.body.classList.remove('holding-gem'); }
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('pointerleave', () => { this.hover = null; });
  }
}

export function useBagItem(game, itemData, fromListKey) {
  const p = game.meta.p;
  const list = p[fromListKey];
  const idx = list.findIndex(x => x.uid === itemData.uid);
  if (idx < 0) return false;
  if (itemData.kind === 'gear' && itemData.item) {
    const gear = deserializeItem(itemData.item);
    const old = game.player.equip[gear.slot];
    game.player.equip[gear.slot] = gear;
    list.splice(idx, 1);
    if (old) addGearToBag(p, old);
    game.recalc();
    game.audio.sfx('pickup');
    game.ui.toast(`已裝備 ${gear.name}`, itemData.color || '#ffe08a');
    game.meta.save();
    return true;
  }
  if (itemData.kind === 'consumable') {
    list.splice(idx, 1);
    if (itemData.heal) game.heal(game.player.stats.maxHp * itemData.heal, true);
    if (itemData.mana) game.player.mana = Math.min(game.player.stats.mana, game.player.mana + game.player.stats.mana * itemData.mana);
    if (itemData.cure && game.player.statuses) {
      game.player.statuses.poison = 0; game.player.statuses.freeze = 0; game.player.statuses.chill = 0; game.player.statuses.burn = 0;
    }
    if (itemData.recall) { game.ui.toggleInv(game); game.startRecall?.(); }
    game.audio.sfx('flask');
    game.ui.toast(`使用了 ${itemData.name}`, '#a8f0c0');
    game.meta.save();
    return true;
  }
  return false;
}

export function transferBagItem(game, itemData, fromKey, toKey) {
  const p = game.meta.p;
  const from = p[fromKey], to = p[toKey];
  const idx = from.findIndex(x => x.uid === itemData.uid);
  if (idx < 0) return false;
  const [moved] = from.splice(idx, 1);
  to.push(moved);
  game.audio.sfx('ui');
  game.meta.save();
  game.ui.toast(`${moved.name} → ${toKey === 'stashItems' ? t(game.settings?.lang, 'stash') : t(game.settings?.lang, 'bag')}`, '#ffe08a');
  return true;
}
