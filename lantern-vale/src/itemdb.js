// 物品資料庫（來自「裝備物品系統企劃」item_master，共 339 項）＋ Figma 生成圖示對照。
// 圖示放在 game/assets/items/{128,256}/{id}.png（透明背景）；沒有圖的物品用欄位剪影頂替，清單見 data/item_art_missing.txt。
import ITEMS from '../data/items.json' with { type: 'json' };
import ART_MAP from '../data/item_art_map.json' with { type: 'json' };

export const ITEM_DB = ITEMS;
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const BY_NAME = Object.fromEntries(ITEMS.map(i => [i.name, i]));

// 企劃欄位 → 遊戲欄位（weapon 沿用舊的 staff 欄位鍵，存檔相容）
export const PLAN_SLOT_TO_GAME = { weapon: 'staff', head: 'head', body: 'body', hands: 'hands', feet: 'feet', cloak: 'cloak', charm: 'charm', relic: 'relic' };
const GAME_TO_PLAN = Object.fromEntries(Object.entries(PLAN_SLOT_TO_GAME).map(([a, b]) => [b, a]));

export function hasArt(id) { return !!ART_MAP[id]; }
export function itemIconUrl(id, size = 128) { return hasArt(id) ? `assets/items/${size}/${id}.png` : null; }

// 依裝備欄位與品階抽一個企劃物品（優先挑有圖的）
export function pickCatalogGear(r, gameSlot, tier) {
  const planSlot = GAME_TO_PLAN[gameSlot];
  const pool = ITEMS.filter(i => i.slot === planSlot);
  if (!pool.length) return null;
  const t = Math.max(1, Math.min(6, tier || 1));
  let tiers = pool.filter(i => i.tier === t);
  if (!tiers.length) { const best = Math.max(...pool.filter(i => i.tier <= t).map(i => i.tier), 1); tiers = pool.filter(i => i.tier === best); }
  const withArt = tiers.filter(i => hasArt(i.id));
  const use = withArt.length ? withArt : tiers;
  return use[Math.floor(r() * use.length)];
}

// 解析任何背包/裝備物件的圖示 id：item.art > 名稱對照 > 舊 emoji 對照 > 欄位最接近 Figma 圖示保底（避免出現文字方塊佔位）
const ICON_TO_ART = { '🍓': 'con_berry', '🍺': 'con_cider', '🐚': 'con_conch_recall', '🍯': 'con_honey_crate', '🍹': 'con_berry_cocktail', '🥧': 'con_honey_pie', '🧿': 'con_tide_charm', '🍗': 'con_feast_box', '🧥': 'clk_t1', '🪄': 'wpn_staff_t1', '🍵': 'con_hp_dew' };
const SLOT_FALLBACK_ART = { head: 'arm_leather_head_t1', body: 'arm_leather_body_t1', hands: 'arm_leather_hands_t1', feet: 'arm_leather_feet_t1', cloak: 'clk_t1', charm: 'chm_t1', relic: 'relic_brass_spyglass', staff: 'wpn_staff_t1', weapon: 'wpn_sword_t1' };
export function resolveArtId(o) {
  if (!o) return null;
  const it = o.item || o;
  if (o.art && hasArt(o.art)) return o.art;
  if (it.art && hasArt(it.art)) return it.art;
  const nm = it.base || it.name || o.name || '';
  const hit = BY_NAME[nm] || BY_NAME[o.name];
  if (hit && hasArt(hit.id)) return hit.id;
  const e = ICON_TO_ART[o.icon];
  if (e && hasArt(e)) return e;
  const slot = it.slot || o.slot;
  if (slot === 'staff' || slot === 'weapon') {
    if (/弓/.test(nm) && hasArt('wpn_bow_t1')) return 'wpn_bow_t1';
    if (/刃|匕|雙/.test(nm) && hasArt('wpn_blades_t1')) return 'wpn_blades_t1';
    if (/劍|盾/.test(nm) && hasArt('wpn_sword_t1')) return 'wpn_sword_t1';
    if (/棍|棒/.test(nm) && hasArt('wpn_bo_t1')) return 'wpn_bo_t1';
  }
  const fb = SLOT_FALLBACK_ART[slot];
  return fb && hasArt(fb) ? fb : null;
}

// 圖片快取（Canvas 與 DOM 共用）
const _imgs = new Map();
export function loadItemImage(id, size = 128, onLoad) {
  if (typeof Image === 'undefined' || !id || !hasArt(id)) return null;
  const key = id + '@' + size;
  let im = _imgs.get(key);
  if (!im) {
    im = new Image(); im.decoding = 'async'; im.src = itemIconUrl(id, size);
    im._ready = false; im.onload = () => { im._ready = true; onLoad?.(); };
    _imgs.set(key, im);
  } else if (!im._ready && onLoad) { const prev = im.onload; im.onload = () => { prev?.(); onLoad(); }; }
  return im;
}

// 從透明去背 PNG 萃取真實物理輪廓（24×24 Alpha 遮罩＋多圓輪廓碰撞代理＋真實視覺重心）
let _silCanvas = null, _silCtx = null;
const DEFAULT_SIL = {
  size: 24, mask: null, cx: 0, cy: 0, w: 0.78, h: 0.78,
  circles: [{ x: 0, y: 0, r: 0.36 }],
};
export function getItemSilhouette(im) {
  if (!im || !im._ready) return null;
  if (im._sil) return im._sil;
  const N = 24;
  try {
    if (!_silCanvas && typeof document !== 'undefined') {
      _silCanvas = document.createElement('canvas');
      _silCanvas.width = _silCanvas.height = N;
      _silCtx = _silCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!_silCtx) { im._sil = DEFAULT_SIL; return DEFAULT_SIL; }
    _silCtx.clearRect(0, 0, N, N);
    _silCtx.drawImage(im, 0, 0, N, N);
    const data = _silCtx.getImageData(0, 0, N, N).data;
    const mask = new Uint8Array(N * N);
    let minX = N, maxX = -1, minY = N, maxY = -1, sumX = 0, sumY = 0, count = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (data[(y * N + x) * 4 + 3] > 42) {
          mask[y * N + x] = 1;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          sumX += x + 0.5; sumY += y + 0.5; count++;
        }
      }
    }
    if (count < 4) { im._sil = DEFAULT_SIL; return DEFAULT_SIL; }
    const cxPx = sumX / count, cyPx = sumY / count;
    const cx = cxPx / N - 0.5, cy = cyPx / N - 0.5;
    const w = Math.max(0.2, (maxX - minX + 1) / N);
    const h = Math.max(0.2, (maxY - minY + 1) / N);
    // 6×6 子格掃描：將每個含不透明像素的子區塊轉成貼合輪廓的圓形碰撞體（最多保留 10 個）
    const G = 6, step = N / G;
    const rawCircles = [];
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        let sx = 0, sy = 0, c = 0;
        for (let py = gy * step; py < (gy + 1) * step; py++) {
          for (let px = gx * step; px < (gx + 1) * step; px++) {
            if (mask[py * N + px]) { sx += px + 0.5; sy += py + 0.5; c++; }
          }
        }
        if (c >= 3) {
          const fillRatio = Math.sqrt(c / (step * step));
          rawCircles.push({
            x: (sx / c - cxPx) / N,
            y: (sy / c - cyPx) / N,
            r: Math.max(0.065, (step / N) * 0.52 * Math.max(0.65, fillRatio)),
            c,
          });
        }
      }
    }
    const circles = [];
    rawCircles.sort((a, b) => b.c - a.c);
    for (const rc of rawCircles) {
      const merged = circles.find(o => Math.hypot(o.x - rc.x, o.y - rc.y) < (o.r + rc.r) * 0.48);
      if (merged) {
        const tot = merged.c + rc.c;
        merged.x = (merged.x * merged.c + rc.x * rc.c) / tot;
        merged.y = (merged.y * merged.c + rc.y * rc.c) / tot;
        merged.r = Math.min(0.26, Math.max(merged.r, Math.hypot(merged.x - rc.x, merged.y - rc.y) + rc.r * 0.55));
        merged.c = tot;
      } else if (circles.length < 10) {
        circles.push({ ...rc });
      }
    }
    if (!circles.length) circles.push({ x: 0, y: 0, r: Math.max(w, h) * 0.4 });
    im._sil = { size: N, mask, cx, cy, w, h, circles: circles.map(({ x, y, r }) => ({ x, y, r })) };
    return im._sil;
  } catch {
    im._sil = DEFAULT_SIL;
    return DEFAULT_SIL;
  }
}
