// 部位破壞與精準掉落系統（Monster Hunter / The Surge 風格）
// 針對頭目與重型魔物的特定方位部位集中攻擊，斬斷後弱化對應招式並必定掉落專屬神裝！
import { AFFIXES } from './loot.js';

const fmtOf = k => AFFIXES.find(a => a.k === k)?.fmt || (k === 'baseDmg' ? (v => `基礎傷害 +${v}`) : (v => `${k} +${v}`));

export const PART_DEFS = {
  stag: [
    {
      id: 'antlers', name: '黃金古樹鹿角', icon: '🦌', hitSide: 'front',
      localOffset: { x: 0, z: 1.35 }, hpFrac: 0.34, weaken: 'burst',
      weakenDesc: '鹿王彈幕數量減半',
      drop: {
        slot: 'staff', rarity: 3, tier: 5, name: '鹿王斷角星杖', base: '斷裂古樹鹿角',
        special: 'splitBolt', desc: '【部位破壞限定】餘燼彈分裂 3 枚火花，來自斬斷的古樹鹿角。',
        implicit: { k: 'baseDmg', v: 22 },
        mods: [{ k: 'dmgPct', v: 32 }, { k: 'area', v: 28 }, { k: 'crit', v: 10 }],
      },
    },
    {
      id: 'hindLegs', name: '古木踏風後肢', icon: '🪵', hitSide: 'rear',
      localOffset: { x: 0, z: -0.95 }, hpFrac: 0.30, weaken: 'charge',
      weakenDesc: '鹿王衝鋒與踐踏變慢 30%',
      drop: {
        slot: 'cloak', rarity: 3, tier: 5, name: '古木踏風大氅', base: '古樹苔皮披風',
        special: 'mossRegen', desc: '【部位破壞限定】每秒回復 2% 最大生命，來自擊破鹿王後肢。',
        implicit: { k: 'maxHp', v: 60 },
        mods: [{ k: 'moveSpd', v: 18 }, { k: 'armor', v: 16 }, { k: 'cdr', v: 14 }],
      },
    },
  ],
  golem: [
    {
      id: 'rightArm', name: '星晶光刃右臂', icon: '⚔️', hitSide: 'right',
      localOffset: { x: 0.85, z: 0.15 }, hpFrac: 0.42, weaken: 'slam',
      weakenDesc: '巨像震地範圍縮小 35%',
      drop: {
        slot: 'staff', rarity: 3, tier: 4, name: '星晶光刃法杖', base: '斬斷星晶右臂',
        special: 'sweepWave', desc: '【部位破壞限定】普攻揮出星晶劍氣波，來自斬斷巨像右臂。',
        implicit: { k: 'baseDmg', v: 18 },
        mods: [{ k: 'atkSpd', v: 22 }, { k: 'crit', v: 9 }, { k: 'dmgPct', v: 24 }],
      },
    },
    {
      id: 'core', name: '胸口星晶核心', icon: '💎', hitSide: 'front',
      localOffset: { x: 0, z: 0.55 }, hpFrac: 0.38, weaken: 'armor',
      weakenDesc: '核心碎裂，巨像承受傷害 +30%',
      drop: {
        slot: 'charm', rarity: 3, tier: 4, name: '星晶共振護符', base: '碎裂星晶核心',
        special: 'moreWisps', desc: '【部位破壞限定】螢火伴數量 +3，來自擊碎巨像胸口核心。',
        implicit: { k: 'crit', v: 8 },
        mods: [{ k: 'cdr', v: 18 }, { k: 'dmgPct', v: 26 }, { k: 'mana', v: 35 }],
      },
    },
  ],
  boar: [
    {
      id: 'tusks', name: '白牙衝鋒長牙', icon: '🦷', hitSide: 'front',
      localOffset: { x: 0, z: 0.90 }, hpFrac: 0.48, weaken: 'charge',
      weakenDesc: '野豬衝鋒傷害降低 35%',
      drop: {
        slot: 'charm', rarity: 2, tier: 3, name: '白牙戰豬護符', base: '斷裂野豬長牙',
        special: null, desc: '【部位破壞限定】來自正面斬斷衝鋒野豬的巨型長牙。',
        implicit: { k: 'crit', v: 6 },
        mods: [{ k: 'critMult', v: 35 }, { k: 'dmgPct', v: 18 }, { k: 'atkSpd', v: 12 }],
      },
    },
  ],
};

export function initParts(enemy, defs = PART_DEFS[enemy.type]) {
  if (!defs) { enemy.parts = []; return []; }
  const maxHp = Math.max(10, enemy.maxHp || enemy.hp || 100);
  enemy.parts = defs.map(d => ({
    ...d,
    maxHp: Math.max(12, Math.round(maxHp * d.hpFrac)),
    hp: Math.max(12, Math.round(maxHp * d.hpFrac)),
    broken: false,
  }));
  enemy.brokenWeakens = new Set();
  return enemy.parts;
}

// 依據攻擊來源座標與敵人朝向，計算命中哪一個未破壞部位
export function resolveHitPart(enemy, hitX, hitZ) {
  if (!enemy?.parts?.length) return null;
  const active = enemy.parts.filter(p => !p.broken);
  if (!active.length) return null;
  const f = enemy.facing || 0;
  const fx = Math.sin(f), fz = Math.cos(f);     // 敵人正前方向量
  const rx = Math.cos(f), rz = -Math.sin(f);    // 敵人右側向量（局部 +X）
  const dx = hitX - enemy.pos.x, dz = hitZ - enemy.pos.z;
  const localFwd = dx * fx + dz * fz;
  const localRight = dx * rx + dz * rz;

  let best = null, bestScore = -Infinity;
  for (const part of active) {
    let score = 0;
    if (part.hitSide === 'front') score = localFwd;
    else if (part.hitSide === 'rear') score = -localFwd;
    else if (part.hitSide === 'right') score = localRight;
    else if (part.hitSide === 'left') score = -localRight;
    // 兼顧空間距離權重
    const dist = Math.hypot(localRight - part.localOffset.x, localFwd - part.localOffset.z);
    if (part.minSide !== undefined && score < part.minSide) continue;
    const total = score * 1.4 - dist * 0.5;
    if (total > bestScore) { bestScore = total; best = part; }
  }
  return best;
}

let _partDropUid = 90000;
export function buildPartDropItem(part) {
  const d = part.drop;
  return {
    id: _partDropUid++,
    slot: d.slot,
    rarity: d.rarity,
    tier: d.tier,
    name: d.name,
    base: d.base,
    special: d.special || null,
    desc: d.desc || null,
    partDrop: true,
    implicit: { ...d.implicit, fmt: fmtOf(d.implicit.k) },
    mods: d.mods.map(m => ({ ...m, fmt: fmtOf(m.k) })),
  };
}

export function damagePart(enemy, part, dmg) {
  if (!part || part.broken || dmg <= 0) return { hit: false, broken: false };
  part.hp = Math.max(0, part.hp - Math.round(dmg));
  if (part.hp <= 0) {
    part.broken = true;
    enemy.brokenWeakens = enemy.brokenWeakens || new Set();
    enemy.brokenWeakens.add(part.weaken);
    return { hit: true, broken: true, part, dropItem: part.drop ? buildPartDropItem(part) : null };
  }
  return { hit: true, broken: false, part };
}

export function partStatusText(enemy) {
  if (!enemy?.parts?.length) return '';
  return enemy.parts
    .map(pt => pt.broken ? `✂️${pt.name}(已斷)` : `${pt.icon}${pt.name}:${Math.ceil(pt.hp / pt.maxHp * 100)}%`)
    .join(' · ');
}
