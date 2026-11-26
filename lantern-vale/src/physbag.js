// 孤山獨影（Cairn）風格 2D 重力物理掉落背包與倉庫系統（不同形狀大小＋物品物理碰撞合成）
import { RARITY, SLOTS, serializeItem, deserializeItem, makeItem, itemScore, canEquipItem, itemReqLevel, rememberGear } from './loot.js';
import { canvasUiFont } from './ui_typography.js';
import { t } from './i18n.js';
import { resolveArtId, loadItemImage } from './itemdb.js';

// 物理碰撞合成配方（在背包中拖曳或拋撞兩個相容物件即可當場融合！）
export const BAG_RECIPES = [
  {
    id: 'berry_cider',
    match: (a, b) => (a.icon === '🍓' && b.icon === '🍺') || (a.icon === '🍺' && b.icon === '🍓'),
    label: '🍓 山谷甜莓 + 🍺 楓糖蘋果酒',
    out: { kind: 'consumable', tier: 2, shape: 'flask', hw: 17, hh: 24, icon: '🍹', art: 'con_berry_cocktail', name: '微醺莓果特調', desc: '回復 80% 生命與法力、淨化全異常並提振速度！', color: '#ff70a6', r: 20, heal: 0.8, mana: 0.8, cure: true },
  },
  {
    id: 'honey_pie',
    match: (a, b) => (a.icon === '🍓' && b.icon === '🍯') || (a.icon === '🍯' && b.icon === '🍓'),
    label: '🍓 山谷甜莓 + 🍯 陳年蜂王蜜箱',
    out: { kind: 'consumable', tier: 3, shape: 'crate', hw: 23, hh: 21, icon: '🥧', art: 'con_honey_pie', name: '旅人蜂蜜莓果派', desc: '立即回滿生命與法力、淨化全異常並獲得滿溢能量！', color: '#ffbe4a', r: 22, heal: 1, mana: 1, cure: true },
  },
  {
    id: 'tide_charm',
    match: (a, b) => (a.icon === '🐚' && b.icon === '🍺') || (a.icon === '🍺' && b.icon === '🐚'),
    label: '🐚 海風回城螺 + 🍺 楓糖蘋果酒',
    out: { kind: 'consumable', tier: 3, shape: 'diamond', hw: 20, hh: 22, icon: '🧿', art: 'con_tide_charm', name: '星潮過載護符', desc: '立即回復 70% 法力並觸發 8 秒「魔力過載」沸騰狀態！', color: '#7ae8ff', r: 20, mana: 0.7, overload: 8 },
  },
  // Phase M8B：溫馨共製盛宴物理配方（可於背包或營火旁碰撞合成高階共享料理）
  {
    id: 'feast_cocktail',
    match: (a, b) => (a.icon === '🍹' && b.icon === '🍯') || (a.icon === '🍯' && b.icon === '🍹'),
    label: '🍹 微醺莓果特調 + 🍯 陳年蜂王蜜箱',
    out: { kind: 'consumable', tier: 4, shape: 'crate', hw: 24, hh: 22, icon: '🍗', art: 'con_feast_box', name: '燈谷星火盛宴盒', desc: '回復 100% 生命與法力、淨化全異常並觸發 10 秒魔力過載！', color: '#ff9a40', r: 23, heal: 1, mana: 1, cure: true, overload: 10 },
  },
  {
    id: 'star_brew',
    match: (a, b) => (a.icon === '🐚' && b.icon === '🍯') || (a.icon === '🍯' && b.icon === '🐚'),
    label: '🐚 海風回城螺 + 🍯 陳年蜂王蜜箱',
    out: { kind: 'consumable', tier: 4, shape: 'flask', hw: 18, hh: 25, icon: '🍵', name: '星潮暖心熱湯', desc: '回復 90% 生命與法力、淨化異常並提振 6 秒星火過載！', color: '#6ee8c8', r: 21, heal: 0.9, mana: 0.9, cure: true, overload: 6 },
  },
];

export function findRecipe(a, b) {
  if (!a || !b || a.uid === b.uid) return null;
  for (const r of BAG_RECIPES) if (r.match(a, b)) return { type: 'recipe', recipe: r };
  if (a.kind === 'gear' && b.kind === 'gear' && a.item && b.item && a.item.rarity === b.item.rarity && a.item.rarity < 3) {
    return { type: 'upgradeGear', nextRarity: a.item.rarity + 1, slot: a.item.slot };
  }
  return null;
}

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
      { uid: 'sup_berry', kind: 'consumable', art: 'con_berry', qty: 5, shape: 'circle', hw: 15, hh: 15, icon: '🍓', name: '山谷甜莓', desc: '立即回復 45% 生命（可與蘋果酒或蜂王蜜撞擊合成！）', color: '#ff7a8a', r: 15, heal: 0.45 },
      { uid: 'sup_cider', kind: 'consumable', art: 'con_cider', qty: 3, shape: 'flask', hw: 15, hh: 23, icon: '🍺', name: '楓糖蘋果酒', desc: '立即回復 60% 法力並解除中毒（可與甜莓／回城螺撞擊合成！）', color: '#f5b041', r: 19, mana: 0.6, cure: true },
      { uid: 'sup_scroll', kind: 'consumable', art: 'con_conch_recall', qty: 2, shape: 'diamond', hw: 17, hh: 19, icon: '🐚', name: '海風回城螺', desc: '使用後立即觸發快捷回城（可與蘋果酒撞擊合成護符）', color: '#7ad8e8', r: 17, recall: true },
    ];
  }
  if (!Array.isArray(metaP.stashItems)) {
    metaP.stashItems = [
      { uid: 'st_gem', kind: 'consumable', art: 'con_honey_crate', shape: 'crate', hw: 23, hh: 23, icon: '🍯', name: '陳年蜂王蜜箱', desc: '回復 100% 生命與法力並淨化所有異常', color: '#ffd85a', r: 23, heal: 1, mana: 1, cure: true },
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
    shape: sh.shape, hw: sh.hw, hh: sh.hh,
    icon: SLOTS[item.slot]?.icon || '✨',
    name: item.name, color: R.color, r: sh.r, art: item.art || null,
    item: serializeItem(item),
  });
}

// 輕量 2D 剛體重力物理模擬（不同形狀與尺寸＋物理碰撞合成火花）
export class PhysicsContainer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.bodies = [];
    this.sparks = [];
    this.drag = null;
    this.hover = null;
    this.selectedUid = null;
    this.onSelect = opts.onSelect || (() => {});
    this.onHover = opts.onHover || null;
    this.onDoubleClick = opts.onDoubleClick || (() => {});
    this.onSynthesize = opts.onSynthesize || null;
    this.bgTheme = opts.theme || 'bag';
    this._bind();
  }

  sync(items) {
    const map = new Map(this.bodies.map(b => [b.data.uid, b]));
    const next = [];
    items.forEach((it, idx) => {
      const sh0 = shapeForItem(it), K = 1.18;
      const sh = { shape: sh0.shape, hw: sh0.hw * K, hh: sh0.hh * K, r: sh0.r * K };
      const old = map.get(it.uid);
      if (old) {
        old.data = it;
        old.shape = sh.shape; old.hw = sh.hw; old.hh = sh.hh; old.r = sh.r;
        next.push(old);
      } else {
        next.push({
          data: it,
          shape: sh.shape, hw: sh.hw, hh: sh.hh, r: sh.r,
          x: it._sx ?? (48 + ((idx * 63) % (this.W - 96)) + (Math.random() - 0.5) * 14),
          y: it._sy ?? (34 + Math.floor(idx / 4) * 22),
          vx: (Math.random() - 0.5) * 90,
          vy: it._sy != null ? -140 : 10 + Math.random() * 40,
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

  burstSparks(x, y, color = '#ffd85a') {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.45 + Math.random() * 0.25, color });
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
        if (b.shape === 'rect' || b.shape === 'crate' || b.shape === 'capsule') {
          const snap = Math.round(b.ang / (Math.PI / 2)) * (Math.PI / 2);
          b.vang += (snap - b.ang) * 4 * dt;
        } else {
          b.vang = b.vx * 0.025;
        }
      }
    }
    // 碰撞解算與「高速撞擊物理合成」偵測
    let fusedPair = null;
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
            const relSpd = Math.hypot(b.vx - a.vx, b.vy - a.vy);
            if (!fusedPair && this.onSynthesize && relSpd > 145 && findRecipe(a.data, b.data)) {
              fusedPair = [a, b];
            }
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
    if (fusedPair) {
      const [a, b] = fusedPair;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.burstSparks(mx, my, '#ffd85a');
      this.onSynthesize(a.data, b.data, mx, my);
    }
    for (const sp of this.sparks) {
      sp.vy += 260 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt;
    }
    this.sparks = this.sparks.filter(sp => sp.life > 0);
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

  _img(b) {
    const id = b.data._art !== undefined ? b.data._art : (b.data._art = resolveArtId(b.data));
    if (!id) return null;
    const im = loadItemImage(id, 128, () => { this._dirty = true; });
    return im && im._ready ? im : null;
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // 背景：深棕磚面＋與參考圖一致的格線（42px 一格）
    ctx.fillStyle = this.bgTheme === 'stash' ? '#3a2422' : '#33191f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(247,192,64,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 8 + 42; x < W - 8; x += 42) { ctx.moveTo(x + .5, 8); ctx.lineTo(x + .5, H - 8); }
    for (let y = 8 + 42; y < H - 8; y += 42) { ctx.moveTo(8, y + .5); ctx.lineTo(W - 8, y + .5); }
    ctx.stroke();
    // 黃銅邊框＋四角鉚釘
    ctx.strokeStyle = '#d08622'; ctx.lineWidth = 3; ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
    ctx.strokeStyle = '#24141c'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.fillStyle = '#fff0a0';
    for (const [x, y] of [[7, 7], [W - 10, 7], [7, H - 10], [W - 10, H - 10]]) ctx.fillRect(x, y, 3, 3);

    const dragged = this.drag?.body || null;
    for (const b of this.bodies) {
      const sel = b.data.uid === this.selectedUid;
      const hov = this.hover === b;
      const canFuse = dragged && dragged !== b && !!findRecipe(dragged.data, b.data);
      const rc = canFuse || sel ? '#ffe36a' : (b.data.color || '#c99228');
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang);
      const hw = b.hw, hh = b.hh;
      // 硬陰影 → 墨色外框 → 稀有度色內框 → 深棕底（依物理形狀描邊）
      ctx.save(); ctx.translate(3, 4); this._traceShape(ctx, b); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.restore();
      this._traceShape(ctx, b);
      ctx.fillStyle = b.shape === 'crate' ? '#5a3826' : '#4a2a2c'; ctx.fill();
      ctx.lineJoin = 'miter';
      ctx.lineWidth = 7; ctx.strokeStyle = '#24141c'; ctx.stroke();
      ctx.lineWidth = 3.5; ctx.strokeStyle = rc; ctx.stroke();
      if (hov || sel || canFuse) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff0a0'; ctx.stroke(); }
      if (canFuse) { ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd85a'; ctx.beginPath(); ctx.arc(0, 0, b.r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      // 圖示（透明 PNG；沒有圖的物品用欄位字剪影）
      const im = this._img(b);
      const fit = { capsule: [2.5, 2.05], diamond: [1.55, 1.55], flask: [2.15, 2.0], circle: [1.95, 1.95] }[b.shape] || [2.0, 2.0];
      const iw = hw * fit[0], ih = hh * fit[1];
      if (im) {
        const k = Math.min(iw / im.naturalWidth, ih / im.naturalHeight);
        ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k);
      } else {
        ctx.font = canvasUiFont(Math.round(Math.min(hw, hh) * 1.1), 900);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,240,200,0.55)';
        const glyph = b.data.kind === 'gear' ? (SLOTS[b.data.item?.slot]?.icon || '?') : (b.data.icon || '?');
        ctx.fillText(glyph, 0, 1);
      }
      ctx.restore();
      // 堆疊數量（不隨物件旋轉，貼在格子右下角）
      const q = b.data.qty || 1;
      if (q > 1) {
        const ex = this._extents(b);
        const tx = b.x + ex.ex - 4, ty = b.y + ex.ey - 3;
        ctx.font = canvasUiFont(12, 900); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 3; ctx.strokeStyle = '#24141c'; ctx.strokeText(String(q), tx, ty);
        ctx.fillStyle = '#fff8e4'; ctx.fillText(String(q), tx, ty);
      }
    }
    // 合成火花粒子
    for (const sp of this.sparks) {
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x - 2, sp.y - 2, 4, 4);
    }
    if (this.hover) {
      const d = this.hover.data;
      const tierNum = d.item?.tier || d.tier || 1;
      const txt = `[T${tierNum}] ${d.name}`;
      ctx.font = canvasUiFont(12, 700);
      const tw = Math.min(W - 12, ctx.measureText(txt).width + 14);
      const tx = Math.max(6, Math.min(W - tw - 6, this.hover.x - tw / 2));
      const ty = Math.max(6, this.hover.y - this.hover.hh - 28);
      ctx.fillStyle = '#24141c'; ctx.fillRect(tx - 2, ty - 2, tw + 4, 24);
      ctx.fillStyle = '#33191f'; ctx.fillRect(tx, ty, tw, 20);
      ctx.strokeStyle = d.color || '#f7c040'; ctx.lineWidth = 2; ctx.strokeRect(tx + 1, ty + 1, tw - 2, 18);
      ctx.fillStyle = '#fff0c8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, tx + 7, ty + 10, tw - 14);
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
        const nextHover = this._hit(p.x, p.y);
        if (nextHover !== this.hover) {
          this.hover = nextHover;
          this.onHover?.(nextHover ? nextHover.data : null);
        }
        this.canvas.style.cursor = this.hover ? 'grab' : '';
      }
    });
    const end = () => {
      if (this.drag) {
        const b = this.drag.body;
        this.drag = null;
        document.body.classList.remove('holding-gem');
        // 放開時若正好疊在可合成的物品上，直接觸發物理碰撞合成！
        if (this.onSynthesize) {
          for (const other of this.bodies) {
            if (other === b) continue;
            if (Math.hypot(other.x - b.x, other.y - b.y) < b.r + other.r + 6 && findRecipe(b.data, other.data)) {
              const mx = (b.x + other.x) / 2, my = (b.y + other.y) / 2;
              this.burstSparks(mx, my, '#ffd85a');
              this.onSynthesize(b.data, other.data, mx, my);
              break;
            }
          }
        }
      }
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('pointerleave', () => {
      if (this.hover) { this.hover = null; this.onHover?.(null); }
    });
  }
}

export function synthesizeBagItems(game, itemA, itemB, listKey = 'bagItems', sx = 160, sy = 100) {
  const rec = findRecipe(itemA, itemB);
  if (!rec) return null;
  const list = game.meta.p[listKey];
  const iA = list.findIndex(x => x.uid === itemA.uid);
  const iB = list.findIndex(x => x.uid === itemB.uid);
  if (iA < 0 || iB < 0) return null;
  for (const idx of [iA, iB].sort((x, y) => y - x)) {
    const e = list[idx];
    if ((e.qty || 1) > 1) e.qty--; else list.splice(idx, 1);
  }

  let created = null;
  if (rec.type === 'recipe') {
    created = {
      ...rec.recipe.out,
      uid: 'syn_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      _sx: sx, _sy: sy,
    };
  } else if (rec.type === 'upgradeGear') {
    const newGear = makeItem(Math.random, Math.floor((game.meta.p.level || 1) / 3), rec.nextRarity, rec.slot);
    const R = RARITY[newGear.rarity] || RARITY[0];
    const sh = shapeForItem({ kind: 'gear', slot: newGear.slot });
    created = {
      uid: 'syn_g_' + Date.now(),
      kind: 'gear', shape: sh.shape, hw: sh.hw, hh: sh.hh, r: sh.r,
      icon: SLOTS[newGear.slot]?.icon || '✨',
      name: newGear.name, color: R.color, art: newGear.art || null, item: serializeItem(newGear),
      _sx: sx, _sy: sy,
    };
  }
  if (created) {
    const twin = created.kind === 'consumable' && list.find(x => x.kind === 'consumable' && x.name === created.name);
    if (twin) twin.qty = (twin.qty || 1) + 1; else list.push(created);
    game.audio.sfx('synth');
    game.meta.save();
    game.ui.toast(`⚗️ 物理碰撞合成成功：${created.name}！`, '#ffd85a');
  }
  return created;
}

export function useBagItem(game, itemData, fromListKey) {
  const p = game.meta.p;
  const list = p[fromListKey];
  const idx = list.findIndex(x => x.uid === itemData.uid);
  if (idx < 0) return false;
  if (itemData.kind === 'gear' && itemData.item) {
    const gear = deserializeItem(itemData.item);
    const reqLv = itemReqLevel(gear);
    if (!canEquipItem(gear, p.level || 1)) {
      game.audio?.sfx?.('ui');
      game.ui?.toast?.(`🔒 等級不足！需要 Lv.${reqLv} 才能穿戴【${gear.name}】（目前 Lv.${p.level || 1}）`, '#ff8a8a');
      return false;
    }
    const old = game.player.equip[gear.slot];
    game.player.equip[gear.slot] = gear;
    list.splice(idx, 1);
    if (old) addGearToBag(p, old);
    game.recalc();
    rememberGear(game);
    game.audio.sfx('pickup');
    game.ui.toast(`已裝備 ${gear.name}`, itemData.color || '#ffe08a');
    return true;
  }
  if (itemData.kind === 'consumable') {
    if ((itemData.qty || 1) > 1) itemData.qty--; else list.splice(idx, 1);
    if (itemData.heal) game.heal(game.player.stats.maxHp * itemData.heal, true);
    if (itemData.mana) game.player.mana = Math.min(game.player.stats.mana, game.player.mana + game.player.stats.mana * itemData.mana);
    if (itemData.cure && game.player.statuses) {
      game.player.statuses.poison = 0; game.player.statuses.freeze = 0; game.player.statuses.chill = 0; game.player.statuses.burn = 0;
    }
    if (itemData.overload && game.player.statuses) {
      game.player.statuses.overload = Math.max(game.player.statuses.overload || 0, itemData.overload);
      game.ui.hpVial?.impulse(0, 2.0); game.ui.mpVial?.impulse(0, 2.2);
    }
    if (itemData.recall) { game.ui.toggleInv(game); game.startRecall?.(); }
    game.audio.sfx('flask');
    game.ui.toast(`使用了 ${itemData.name}`, '#a8f0c0');
    game.meta.save();
    return true;
  }
  return false;
}

export function autoEquipBest(game) {
  const p = game.meta.p;
  ensurePhysicsStorage(p);
  const list = p.bagItems;
  let count = 0;
  const upgrades = [];
  for (const slot of Object.keys(SLOTS)) {
    let bestIdx = -1, bestScore = game.player.equip[slot] ? itemScore(game.player.equip[slot]) : -1;
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (entry.kind !== 'gear' || !entry.item) continue;
      const g = deserializeItem(entry.item);
      if (g.slot !== slot || !canEquipItem(g, p.level || 1)) continue;
      const sc = itemScore(g);
      if (sc > bestScore) { bestScore = sc; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      const [picked] = list.splice(bestIdx, 1);
      const newGear = deserializeItem(picked.item);
      const old = game.player.equip[slot];
      game.player.equip[slot] = newGear;
      if (old) addGearToBag(p, old);
      count++;
      upgrades.push({ slot, name: newGear.name, score: bestScore });
    }
  }
  if (count > 0) { game.recalc(); rememberGear(game); }
  return { count, upgrades };
}

export function salvageTrashGear(game) {
  const p = game.meta.p;
  ensurePhysicsStorage(p);
  const list = p.bagItems;
  let count = 0, shards = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const entry = list[i];
    if (entry.kind !== 'gear' || !entry.item) continue;
    const g = deserializeItem(entry.item);
    if (g.rarity > 1 || g.corrupted) continue;
    const eq = game.player?.equip?.[g.slot];
    if (!eq || itemScore(g) >= itemScore(eq)) continue;
    const val = (g.rarity === 0 ? 4 : 8) + Math.max(0, (g.tier || 1) - 1) * 2;
    list.splice(i, 1);
    count++;
    shards += val;
  }
  if (count > 0) {
    p.shards = (p.shards || 0) + shards;
    game.meta.save();
  }
  return { count, shards };
}

export function transferBagItem(game, itemData, fromKey, toKey) {
  const p = game.meta.p;
  const from = p[fromKey], to = p[toKey];
  const idx = from.findIndex(x => x.uid === itemData.uid);
  if (idx < 0) return false;
  const [moved] = from.splice(idx, 1);
  const twin = moved.kind === 'consumable' && to.find(x => x.kind === 'consumable' && x.name === moved.name);
  if (twin) twin.qty = (twin.qty || 1) + (moved.qty || 1); else to.push(moved);
  game.audio.sfx('ui');
  game.meta.save();
  game.ui.toast(`${moved.name} → ${toKey === 'stashItems' ? t(game.settings?.lang, 'stash') : t(game.settings?.lang, 'bag')}`, '#ffe08a');
  return true;
}
