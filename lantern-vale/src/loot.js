import { pick, rand } from './util.js';

export const RARITY = [
  { key: 'normal', name: '普通', color: '#e8e2d4', beam: 0xe8e2d4 },
  { key: 'magic', name: '魔法', color: '#7fb2ff', beam: 0x7fb2ff },
  { key: 'rare', name: '稀有', color: '#ffd85a', beam: 0xffd85a },
  { key: 'unique', name: '傳奇', color: '#ff9a4a', beam: 0xff9a4a },
];

export const SLOTS = {
  staff: { name: '法杖', icon: '杖', bases: ['樺木短杖', '苔紋手杖', '燈芯長杖', '古橡法杖'] },
  cloak: { name: '斗篷', icon: '袍', bases: ['亞麻斗篷', '羊毛披風', '雨林蓑衣', '星紋大氅'] },
  charm: { name: '護符', icon: '符', bases: ['松果護符', '貝殼墜飾', '琥珀吊墜', '螢石護符'] },
};

// stat keys used by player.stats
// dmgPct, addFire, atkSpd, crit, critMult, maxHp, lifeOnHit, moveSpd, cdr, mana, area, armor, proj, regen
export const AFFIXES = [
  { k: 'dmgPct', fmt: v => `+${v}% 傷害`, roll: t => 8 + t * 7, slots: ['staff', 'charm'] },
  { k: 'addFire', fmt: v => `攻擊附加 ${v} 火焰傷害`, roll: t => 2 + t * 2, slots: ['staff'] },
  { k: 'atkSpd', fmt: v => `+${v}% 攻擊速度`, roll: t => 6 + t * 4, slots: ['staff', 'charm'] },
  { k: 'crit', fmt: v => `+${v}% 暴擊率`, roll: t => 2 + t * 2, slots: ['staff', 'charm'] },
  { k: 'critMult', fmt: v => `+${v}% 暴擊傷害`, roll: t => 12 + t * 10, slots: ['staff', 'charm'] },
  { k: 'maxHp', fmt: v => `+${v} 最大生命`, roll: t => 12 + t * 10, slots: ['cloak', 'charm'] },
  { k: 'lifeOnHit', fmt: v => `每次擊中回復 ${v} 生命`, roll: t => 1 + Math.floor(t * 0.8), slots: ['staff', 'charm'] },
  { k: 'moveSpd', fmt: v => `+${v}% 移動速度`, roll: t => 4 + t * 3, slots: ['cloak'] },
  { k: 'cdr', fmt: v => `+${v}% 冷卻縮減`, roll: t => 5 + t * 3, slots: ['cloak', 'charm'] },
  { k: 'mana', fmt: v => `+${v} 最大法力`, roll: t => 10 + t * 8, slots: ['cloak', 'staff'] },
  { k: 'area', fmt: v => `+${v}% 範圍`, roll: t => 8 + t * 6, slots: ['staff', 'cloak'] },
  { k: 'armor', fmt: v => `受到傷害 -${v}%`, roll: t => 3 + t * 2, slots: ['cloak'] },
  { k: 'regen', fmt: v => `每秒回復 ${v} 生命`, roll: t => 1 + Math.floor(t * 0.7), slots: ['cloak'] },
  { k: 'proj', fmt: v => `餘燼彈 +${v} 發`, roll: () => 1, slots: ['staff', 'charm'], rare: true },
];

const IMPLICIT = {
  staff: t => ({ k: 'baseDmg', v: 4 + t * 3, fmt: v => `基礎傷害 +${v}` }),
  cloak: t => ({ k: 'maxHp', v: 10 + t * 6, fmt: v => `+${v} 最大生命` }),
  charm: t => ({ k: 'crit', v: 2 + t, fmt: v => `+${v}% 暴擊率` }),
};

const PREFIX = ['晨露', '餘燼', '苔心', '松風', '琥珀', '月光', '野莓', '燈火', '霜語', '狐影', '暖陽', '山嵐'];
const SUFFIX = ['之歌', '之息', '守望', '低語', '迴響', '旅伴', '微光', '庇護', '心願', '足跡'];

export const UNIQUES = [
  { slot: 'staff', name: '野火之杖', base: '燒焦的長杖', special: 'splitBolt', desc: '餘燼彈擊中後分裂成 3 枚小火花', mods: [{ k: 'baseDmg', v: 10 }, { k: 'addFire', v: 6 }] },
  { slot: 'staff', name: '鹿骨權杖', base: '古鹿骨杖', special: 'sweepWave', desc: '揮擊時放出一道衝擊波', mods: [{ k: 'baseDmg', v: 8 }, { k: 'atkSpd', v: 15 }] },
  { slot: 'cloak', name: '苔心大氅', base: '活苔斗篷', special: 'mossRegen', desc: '每秒回復 2% 最大生命', mods: [{ k: 'maxHp', v: 40 }, { k: 'armor', v: 8 }] },
  { slot: 'charm', name: '月蛾護符', base: '銀粉吊墜', special: 'frostRoll', desc: '翻滾時留下凍結光環，減速敵人', mods: [{ k: 'cdr', v: 15 }, { k: 'moveSpd', v: 10 }] },
  { slot: 'charm', name: '螢火之心', base: '發光琥珀', special: 'moreWisps', desc: '螢火伴數量 +3', mods: [{ k: 'dmgPct', v: 25 }, { k: 'crit', v: 6 }] },
];

let _id = 1;
export function makeItem(r, depth, forceRarity = null, forceSlot = null) {
  const tier = Math.min(6, 1 + Math.floor(depth / 2) + (r() < 0.25 ? 1 : 0));
  let rarity = forceRarity;
  if (rarity === null) {
    const x = r() + depth * 0.025;
    rarity = x > 0.97 ? 3 : x > 0.72 ? 2 : x > 0.32 ? 1 : 0;
  }
  if (rarity === 3) {
    const u = pick(r, forceSlot ? UNIQUES.filter(q => q.slot === forceSlot) : UNIQUES);
    return { id: _id++, slot: u.slot, rarity: 3, tier, name: u.name, base: u.base, special: u.special, desc: u.desc,
      implicit: IMPLICIT[u.slot](tier), mods: u.mods.map(m => ({ ...m, fmt: AFFIXES.find(a => a.k === m.k)?.fmt || (v => `基礎傷害 +${v}`) })) };
  }
  const slot = forceSlot || pick(r, Object.keys(SLOTS));
  const base = SLOTS[slot].bases[Math.min(3, Math.floor(tier / 2))];
  const nMods = rarity === 0 ? 0 : rarity === 1 ? 1 + (r() < 0.5 ? 1 : 0) : 3 + (r() < 0.4 ? 1 : 0);
  const pool = AFFIXES.filter(a => a.slots.includes(slot) && (!a.rare || rarity === 2));
  const mods = [];
  for (let i = 0; i < nMods && pool.length; i++) {
    const idx = Math.floor(r() * pool.length);
    const a = pool.splice(idx, 1)[0];
    const v = Math.round(a.roll(tier) * rand(r, 0.75, 1.15));
    mods.push({ k: a.k, v, fmt: a.fmt });
  }
  let name = base;
  if (rarity === 1) name = `${pick(r, PREFIX)}${base}`;
  if (rarity === 2) name = `${pick(r, PREFIX)}${pick(r, SUFFIX)}`;
  return { id: _id++, slot, rarity, tier, name, base, implicit: IMPLICIT[slot](tier), mods };
}

export function itemLines(it) {
  const out = [];
  if (it.implicit) out.push({ t: it.implicit.fmt(it.implicit.v), imp: true });
  for (const m of it.mods) out.push({ t: m.fmt(m.v) });
  if (it.desc) out.push({ t: it.desc, special: true });
  return out;
}

export function itemScore(it) {
  if (!it) return 0;
  const W = { baseDmg: 3, dmgPct: 1, addFire: 2.5, atkSpd: 1.2, crit: 1.5, critMult: 0.5, maxHp: 0.6, lifeOnHit: 3, moveSpd: 1.2, cdr: 1, mana: 0.3, area: 0.7, armor: 2, regen: 3, proj: 20 };
  let s = 0;
  const all = [...(it.implicit ? [it.implicit] : []), ...it.mods];
  for (const m of all) s += (W[m.k] || 1) * m.v;
  if (it.special) s += 40;
  return Math.round(s);
}

// ---------- Boons (passive picks between rooms) ----------
export const BOONS = [
  { id: 'unlockSlam', name: '大地之根', icon: '根', desc: '解鎖技能 Q「根鬚重擊」：範圍傷害並暈眩敵人', skill: 'slam', weight: 0 },
  { id: 'unlockWisp', name: '螢火伴隨', icon: '螢', desc: '解鎖技能 E「螢火群」：召喚環繞的螢火蟲攻擊附近敵人', skill: 'wisp', weight: 0 },
  { id: 'chain', name: '連鎖火花', icon: '鏈', desc: '餘燼彈擊中後彈射到附近 1 名敵人', weight: 1 },
  { id: 'multi', name: '分焰', icon: '焰', desc: '餘燼彈 +1 發', weight: 1, stack: true },
  { id: 'thick', name: '厚苔', icon: '苔', desc: '+30 最大生命，回滿生命', weight: 1, stack: true },
  { id: 'gale', name: '疾風步', icon: '風', desc: '翻滾冷卻 -35%，翻滾後下一次揮擊 +60% 傷害', weight: 1 },
  { id: 'moon', name: '月相', icon: '月', desc: '每第 4 次揮擊釋放一圈衝擊波', weight: 1 },
  { id: 'feast', name: '野宴', icon: '宴', desc: '擊殺敵人回復 4 生命', weight: 1, stack: true },
  { id: 'glass', name: '玻璃燈罩', icon: '燈', desc: '傷害 +40%，最大生命 -15%', weight: 0.7 },
  { id: 'bramble', name: '荊棘外衣', icon: '棘', desc: '被擊中時對周圍敵人造成 20 傷害', weight: 1 },
  { id: 'quake', name: '餘震', icon: '震', desc: '根鬚重擊範圍 +35%，冷卻 -20%', weight: 1, needs: 'slam' },
  { id: 'swarm', name: '蜂擁', icon: '群', desc: '螢火群 +3 隻且持續時間 +3 秒', weight: 1, needs: 'wisp' },
  { id: 'flask', name: '蜜酒葫蘆', icon: '壺', desc: '藥瓶上限 +1，藥瓶回復量 +25%', weight: 1, stack: true },
  { id: 'swift', name: '輕盈', icon: '輕', desc: '+12% 移動速度 與 +12% 攻擊速度', weight: 1, stack: true },
  { id: 'sharp', name: '銳眼', icon: '眼', desc: '+8% 暴擊率，+30% 暴擊傷害', weight: 1, stack: true },
];

export function rollBoons(r, taken, skills, n = 3) {
  const out = [];
  // early: guarantee skill unlocks
  if (!skills.slam) out.push(BOONS[0]);
  if (!skills.wisp && out.length < 2 && (skills.slam || r() < 0.5)) out.push(BOONS[1]);
  const pool = BOONS.filter(b => b.weight > 0 && (b.stack || !taken.includes(b.id)) && (!b.needs || skills[b.needs]));
  while (out.length < n && pool.length) {
    const i = Math.floor(r() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

// ---------- 存檔用序列化（fmt 是函式，不能直接 JSON） ----------
const IMP_FMT = { baseDmg: v => `基礎傷害 +${v}`, maxHp: v => `+${v} 最大生命`, crit: v => `+${v}% 暴擊率` };
const fmtOf = k => AFFIXES.find(a => a.k === k)?.fmt || IMP_FMT[k] || (v => `${k} +${v}`);
export function serializeItem(it) {
  if (!it) return null;
  return { slot: it.slot, rarity: it.rarity, tier: it.tier, name: it.name, base: it.base, special: it.special, desc: it.desc,
    implicit: it.implicit ? { k: it.implicit.k, v: it.implicit.v } : null, mods: it.mods.map(m => ({ k: m.k, v: m.v })), reforged: it.reforged || 0 };
}
export function deserializeItem(o) {
  if (!o) return null;
  return { id: _id++, slot: o.slot, rarity: o.rarity, tier: o.tier, name: o.name, base: o.base, special: o.special, desc: o.desc, reforged: o.reforged || 0,
    implicit: o.implicit ? { ...o.implicit, fmt: IMP_FMT[o.implicit.k] || fmtOf(o.implicit.k) } : null,
    mods: o.mods.map(m => ({ k: m.k, v: m.v, fmt: fmtOf(m.k) })) };
}
// ---------- 鐵匠：重鑄／增幅／升階 ----------
function rollMod(r, it, taken) {
  const pool = AFFIXES.filter(a => a.slots.includes(it.slot) && !taken.includes(a.k) && (!a.rare || it.rarity === 2));
  if (!pool.length) return null;
  const a = pool[Math.floor(r() * pool.length)];
  return { k: a.k, v: Math.round(a.roll(it.tier) * rand(r, 0.75, 1.15)), fmt: a.fmt };
}
export const FORGE = {
  reroll: { name: '重鑄詞綴', desc: '重新隨機所有詞綴（傳奇裝備不可）', cost: it => 25 + it.tier * 10, ok: it => it.rarity < 3 && it.mods.length > 0 },
  add: { name: '增幅詞綴', desc: '新增一條詞綴（上限 4 條）', cost: it => 50 + it.tier * 12, ok: it => it.rarity < 3 && it.mods.length < 4 },
  tier: { name: '提升階級', desc: '階級 +1，數值依新階級重新計算', cost: it => 70 + it.tier * 20, ok: it => it.tier < 6 },
  upgrade: { name: '晉升稀有度', desc: '普通→魔法→稀有，並補足詞綴', cost: it => 60 + it.tier * 15, ok: it => it.rarity < 2 },
};
export function forgeItem(kind, it, r = Math.random) {
  const n = { ...it, mods: it.mods.map(m => ({ ...m })), reforged: (it.reforged || 0) + 1 };
  if (kind === 'reroll') { const cnt = n.mods.length; n.mods = []; for (let i = 0; i < cnt; i++) { const m = rollMod(r, n, n.mods.map(x => x.k)); if (m) n.mods.push(m); } }
  else if (kind === 'add') { const m = rollMod(r, n, n.mods.map(x => x.k)); if (m) n.mods.push(m); }
  else if (kind === 'tier') {
    n.tier++; const cnt = n.mods.length; n.mods = []; for (let i = 0; i < cnt; i++) { const m = rollMod(r, n, n.mods.map(x => x.k)); if (m) n.mods.push(m); }
    const imp = n.implicit && IMPLICIT[n.slot] ? IMPLICIT[n.slot](n.tier) : null; if (imp && n.rarity < 3) n.implicit = imp;
  } else if (kind === 'upgrade') {
    n.rarity++; const want = n.rarity === 1 ? 2 : 4; while (n.mods.length < want) { const m = rollMod(r, n, n.mods.map(x => x.k)); if (!m) break; n.mods.push(m); }
    const base = SLOTS[n.slot].bases[Math.min(3, Math.floor(n.tier / 2))];
    n.name = n.rarity === 1 ? `${pick(r, PREFIX)}${base}` : `${pick(r, PREFIX)}${pick(r, SUFFIX)}`;
  }
  return n;
}
