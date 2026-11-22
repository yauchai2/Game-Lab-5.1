// 孤山獨影（Cairn）風格 2D 重力物理掉落背包與倉庫系統
import { RARITY, SLOTS, serializeItem, deserializeItem, makeItem } from './loot.js';
import { t } from './i18n.js';

export function ensurePhysicsStorage(metaP) {
  if (!Array.isArray(metaP.bagItems)) {
    // 預先放入幾件可愛實用的旅人補給與裝備，讓物理背包一打開就很有手感
    const starter = [
      { uid: 'sup_berry', kind: 'consumable', icon: '🍓', name: '山谷甜莓', desc: '立即回復 45% 生命', color: '#ff7a8a', r: 19, heal: 0.45 },
      { uid: 'sup_cider', kind: 'consumable', icon: '🍺', name: '楓糖蘋果酒', desc: '立即回復 60% 法力並提振士氣', color: '#f5b041', r: 20, mana: 0.6 },
      { uid: 'sup_scroll', kind: 'consumable', icon: '🐚', name: '海風回城螺', desc: '使用後立即觸發快捷回城', color: '#7ad8e8', r: 18, recall: true },
    ];
    metaP.bagItems = starter;
  }
  if (!Array.isArray(metaP.stashItems)) {
    metaP.stashItems = [
      { uid: 'st_gem', kind: 'consumable', icon: '🍯', name: '陳年蜂王蜜', desc: '回復 100% 生命與法力', color: '#ffd85a', r: 21, heal: 1, mana: 1 },
      { uid: 'st_gear1', kind: 'gear', icon: '🧥', name: '海風旅人披風', color: '#6cb8ff', r: 23, item: serializeItem(makeItem(() => 0.42, 2, 1, 'cloak')) },
    ];
  }
  return { bag: metaP.bagItems, stash: metaP.stashItems };
}

export function addGearToBag(metaP, item) {
  ensurePhysicsStorage(metaP);
  const R = RARITY[item.rarity] || RARITY[0];
  metaP.bagItems.push({
    uid: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    kind: 'gear',
    icon: SLOTS[item.slot]?.icon || '✨',
    name: item.name,
    color: R.color,
    r: 22 + Math.min(4, item.rarity),
    item: serializeItem(item),
  });
}

// 輕量 2D 剛體重力物理模擬（支援拖曳、拋擲、搖一搖整理與堆疊碰撞）
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
    this.bgTheme = opts.theme || 'bag'; // 'bag' | 'stash'
    this._bind();
  }

  sync(items) {
    const map = new Map(this.bodies.map(b => [b.data.uid, b]));
    const next = [];
    items.forEach((it, idx) => {
      const old = map.get(it.uid);
      if (old) {
        old.data = it;
        next.push(old);
      } else {
        next.push({
          data: it,
          x: 44 + ((idx * 57) % (this.W - 88)) + (Math.random() - 0.5) * 14,
          y: 28 + Math.floor(idx / 5) * 18,
          vx: (Math.random() - 0.5) * 90,
          vy: 10 + Math.random() * 40,
          r: it.r || 20,
          ang: (Math.random() - 0.5) * 0.6,
          vang: (Math.random() - 0.5) * 2,
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

  step(dt) {
    const g = 880, pad = 12, W = this.W, H = this.H;
    for (const b of this.bodies) {
      if (this.drag && this.drag.body === b) continue;
      b.vy += g * dt;
      b.vx *= 0.992; b.vy *= 0.995;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ang += b.vang * dt; b.vang *= 0.96;
      // 牆壁與底部反彈
      if (b.x - b.r < pad) { b.x = pad + b.r; b.vx = Math.abs(b.vx) * 0.42; }
      if (b.x + b.r > W - pad) { b.x = W - pad - b.r; b.vx = -Math.abs(b.vx) * 0.42; }
      if (b.y - b.r < pad) { b.y = pad + b.r; b.vy = Math.abs(b.vy) * 0.35; }
      if (b.y + b.r > H - pad) {
        b.y = H - pad - b.r;
        b.vy = -Math.abs(b.vy) * 0.32;
        if (Math.abs(b.vy) < 22) b.vy = 0;
        b.vx *= 0.84;
        b.vang = b.vx * 0.025;
      }
    }
    // 物品互相碰撞堆疊（2 次迭代保持穩定不穿模）
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          const a = this.bodies[i], b = this.bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minD = a.r + b.r + 1.5;
          if (dist < minD) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = (minD - dist) * 0.5;
            if (!this.drag || this.drag.body !== a) { a.x -= nx * overlap; a.y -= ny * overlap; }
            if (!this.drag || this.drag.body !== b) { b.x += nx * overlap; b.y += ny * overlap; }
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              const imp = -vn * 0.58;
              a.vx -= imp * nx; a.vy -= imp * ny;
              b.vx += imp * nx; b.vy += imp * ny;
            }
          }
        }
      }
    }
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // 帆布背包／木箱內襯背景
    ctx.fillStyle = this.bgTheme === 'stash' ? '#4a362a' : '#2e2524';
    ctx.fillRect(0, 0, W, H);
    // 溫馨車縫線內框
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
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.arc(2, 4, b.r, 0, Math.PI * 2); ctx.fill();
      // 物品實體徽章
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = sel ? 4 : hov ? 3 : 2.5;
      ctx.strokeStyle = sel ? '#ffd85a' : b.data.color || '#7a5a40';
      ctx.stroke();
      // 圖示
      ctx.font = `${Math.round(b.r * 0.95)}px sans-serif`;
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
      const ty = Math.max(6, this.hover.y - this.hover.r - 24);
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
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 3) return b;
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
        b.x = Math.max(b.r + 8, Math.min(this.W - b.r - 8, p.x + this.drag.ox));
        b.y = Math.max(b.r + 8, Math.min(this.H - b.r - 8, p.y + this.drag.oy));
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
