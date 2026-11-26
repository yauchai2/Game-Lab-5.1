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
  if (!id || !hasArt(id)) return null;
  const key = id + '@' + size;
  let im = _imgs.get(key);
  if (!im) {
    im = new Image(); im.decoding = 'async'; im.src = itemIconUrl(id, size);
    im._ready = false; im.onload = () => { im._ready = true; onLoad?.(); };
    _imgs.set(key, im);
  } else if (!im._ready && onLoad) { const prev = im.onload; im.onload = () => { prev?.(); onLoad(); }; }
  return im;
}
