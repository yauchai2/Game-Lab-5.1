import { pick, rand } from './util.js';
import { MMO_SETS, MMO_SET_IDS } from './mmo_rpg.js';
import { getRuneDef } from './mmo_world.js';
import { formatPotentialLines } from './mmo_endgame.js';
import { pickCatalogGear } from './itemdb.js';

export const RARITY = [
  { key: 'normal', name: '普通', color: '#e8e2d4', beam: 0xe8e2d4 },
  { key: 'magic', name: '魔法', color: '#7fb2ff', beam: 0x7fb2ff },
  { key: 'rare', name: '稀有', color: '#ffd85a', beam: 0xffd85a },
  { key: 'unique', name: '傳奇', color: '#ff9a4a', beam: 0xff9a4a },
];

export const TIERS = [
  null,
  { tier: 1, tag: 'T1', name: '旅人階', reqLevel: 1,  color: '#d8d2c5', mult: 1.0 },
  { tier: 2, tag: 'T2', name: '精鋼階', reqLevel: 5,  color: '#8ad896', mult: 1.25 },
  { tier: 3, tag: 'T3', name: '星銀階', reqLevel: 10, color: '#7fc4ff', mult: 1.55 },
  { tier: 4, tag: 'T4', name: '秘光階', reqLevel: 16, color: '#c88cff', mult: 1.9 },
  { tier: 5, tag: 'T5', name: '傳世階', reqLevel: 22, color: '#ffd85a', mult: 2.3 },
  { tier: 6, tag: 'T6', name: '穹頂階', reqLevel: 27, color: '#ff8a50', mult: 2.75 },
];
export function tierInfo(tier = 1) { return TIERS[Math.max(1, Math.min(6, Math.round(tier || 1)))] || TIERS[1]; }
export function itemReqLevel(it) {
  if (!it) return 1;
  if (Number.isInteger(it.reqLevel) && it.reqLevel >= 1) return it.reqLevel;
  return tierInfo(it.tier || 1).reqLevel || 1;
}
export function canEquipItem(it, playerLevel = 1) {
  return (playerLevel || 1) >= itemReqLevel(it);
}

export const SLOTS = {
  head:  { name: '頭部', icon: '盔', bases: ['旅人兜帽'] },
  staff: { name: '武器', icon: '杖', bases: ['樺木短杖', '苔紋手杖', '燈芯長杖', '古橡法杖'] },
  body:  { name: '身體', icon: '甲', bases: ['旅人獵裝'] },
  cloak: { name: '斗篷', icon: '袍', bases: ['亞麻斗篷', '羊毛披風', '雨林蓑衣', '星紋大氅'] },
  hands: { name: '手部', icon: '手', bases: ['旅人皮手套'] },
  feet:  { name: '腳部', icon: '靴', bases: ['旅人獵靴'] },
  charm: { name: '護符', icon: '符', bases: ['松果護符', '貝殼墜飾', '琥珀吊墜', '螢石護符'] },
  relic: { name: '聖物', icon: '聖', bases: ['古董鑰匙串'] },
};
// 後加欄位（頭/身/手/腳/聖物）可出現的詞綴
const EXTRA_SLOT_AFFIX = {
  dmgPct: ['hands', 'relic'], atkSpd: ['hands'], crit: ['head', 'hands'], critMult: ['head'], lifeOnHit: ['hands'],
  maxHp: ['head', 'body', 'feet'], moveSpd: ['feet'], cdr: ['head', 'feet', 'relic'], mana: ['head', 'relic'], area: ['relic'],
  armor: ['body', 'head', 'feet'], regen: ['body', 'feet'],
  resFire: ['head', 'body', 'hands', 'feet', 'relic'], resIce: ['head', 'body', 'hands', 'feet', 'relic'],
  resLightning: ['body', 'head', 'relic'], resPoison: ['body', 'feet', 'relic'], allRes: ['body', 'relic'],
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
  { k: 'resFire', fmt: v => `🔥 火焰抗性 +${v}%`, roll: t => 8 + t * 4, slots: ['cloak', 'charm'] },
  { k: 'resIce', fmt: v => `❄️ 寒冰抗性 +${v}%`, roll: t => 8 + t * 4, slots: ['cloak', 'charm'] },
  { k: 'resLightning', fmt: v => `⚡ 雷電抗性 +${v}%`, roll: t => 8 + t * 4, slots: ['cloak', 'charm'] },
  { k: 'resPoison', fmt: v => `☠️ 劇毒抗性 +${v}%`, roll: t => 8 + t * 4, slots: ['cloak', 'charm'] },
  { k: 'allRes', fmt: v => `🌈 全元素抗性 +${v}%`, roll: t => 5 + t * 3, slots: ['cloak', 'charm'], rare: true },
  { k: 'proj', fmt: v => `餘燼彈 +${v} 發`, roll: () => 1, slots: ['staff', 'charm'], rare: true },
];

for (const a of AFFIXES) for (const sl of EXTRA_SLOT_AFFIX[a.k] || []) a.slots.push(sl);

const IMPLICIT = {
  head: t => ({ k: 'maxHp', v: 6 + t * 4, fmt: v => `+${v} 最大生命` }),
  body: t => ({ k: 'armor', v: 2 + t, fmt: v => `受到傷害 -${v}%` }),
  hands: t => ({ k: 'atkSpd', v: 3 + t * 2, fmt: v => `+${v}% 攻擊速度` }),
  feet: t => ({ k: 'moveSpd', v: 3 + t * 2, fmt: v => `+${v}% 移動速度` }),
  relic: t => ({ k: 'cdr', v: 2 + t * 2, fmt: v => `+${v}% 冷卻縮減` }),
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
  // 新增的頭／身／手／腳／聖物欄位還沒有傳奇範本：指定這些欄位時改出稀有品
  if (rarity === 3 && forceSlot && !UNIQUES.some(q => q.slot === forceSlot)) rarity = 2;
  if (rarity === 3) {
    const u = pick(r, forceSlot ? UNIQUES.filter(q => q.slot === forceSlot) : UNIQUES);
    const setId = r() < 0.8 ? pick(r, MMO_SET_IDS) : null;
    return { id: _id++, slot: u.slot, rarity: 3, tier, enhance: 0, setId, name: u.name, base: u.base, art: pickCatalogGear(r, u.slot, tier)?.id || null, special: u.special, desc: u.desc,
      implicit: IMPLICIT[u.slot](tier), mods: u.mods.map(m => ({ ...m, fmt: AFFIXES.find(a => a.k === m.k)?.fmt || (v => `基礎傷害 +${v}`) })) };
  }
  const slot = forceSlot || pick(r, Object.keys(SLOTS));
  const cat = pickCatalogGear(r, slot, tier);
  const base = cat ? cat.name : SLOTS[slot].bases[Math.min(SLOTS[slot].bases.length - 1, Math.floor(tier / 2))];
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
  const setId = rarity >= 2 && r() < 0.5 ? pick(r, MMO_SET_IDS) : null;
  return { id: _id++, slot, rarity, tier, enhance: 0, setId, name, base, art: cat?.id || null, implicit: IMPLICIT[slot](tier), mods };
}

export function itemLines(it) {
  const out = [];
  const reqLv = itemReqLevel(it);
  if (reqLv > 1) out.push({ t: `🔒 穿戴需求：等級 Lv.${reqLv} 以上`, imp: true });
  if ((it.enhance || 0) > 0) out.push({ t: `✨ 精煉強化 +${it.enhance}（主詞綴大幅增幅）`, special: true });
  if (it.corruptImplicit) out.push({ t: `☠️ ${it.corruptImplicit.fmt(it.corruptImplicit.v)}`, corrupt: true });
  if (it.implicit) out.push({ t: it.implicit.fmt(it.implicit.v), imp: true });
  for (const m of it.mods) out.push({ t: m.fmt(m.v) });
  const rDef = getRuneDef(it.rune);
  if (rDef) out.push({ t: `💠 鑲嵌符文【${rDef.icon} ${rDef.name}】：${rDef.desc}`, special: true });
  for (const pl of formatPotentialLines(it.potential)) out.push(pl);
  if (it.desc) out.push({ t: it.desc, special: true });
  if (it.setId && MMO_SETS[it.setId]) {
    const sd = MMO_SETS[it.setId];
    out.push({ t: `套裝【${sd.icon} ${sd.name}】${sd.b2Desc} ｜ ${sd.b3Desc}`, special: true });
  }
  if (it.bricked) out.push({ t: '☠️ 已腐化 · 結構碎裂（無法再改造）', corrupt: true });
  else if (it.corrupted) out.push({ t: '☠️ 已腐化（不可逆定型）', corrupt: true });
  return out;
}

export function itemScore(it) {
  if (!it) return 0;
  const W = { baseDmg: 3, dmgPct: 1, addFire: 2.5, atkSpd: 1.2, crit: 1.5, critMult: 0.5, maxHp: 0.6, lifeOnHit: 3, moveSpd: 1.2, cdr: 1, mana: 0.3, area: 0.7, armor: 2, regen: 3, proj: 20 };
  let s = 0;
  const all = [...(it.corruptImplicit ? [it.corruptImplicit] : []), ...(it.implicit ? [it.implicit] : []), ...it.mods];
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
export const fmtOf = k => AFFIXES.find(a => a.k === k)?.fmt || IMP_FMT[k] || (v => `${k} +${v}`);
export function serializeItem(it) {
  if (!it) return null;
  return {
    slot: it.slot, rarity: it.rarity, tier: it.tier, enhance: it.enhance || 0, setId: it.setId || null, rune: it.rune || null,
    potential: it.potential ? { tier: it.potential.tier, lines: (it.potential.lines || []).map(l => ({ k: l.k, v: l.v, label: l.label })) } : null,
    name: it.name, base: it.base, art: it.art || null, special: it.special, desc: it.desc,
    corrupted: !!it.corrupted, bricked: !!it.bricked,
    corruptImplicit: it.corruptImplicit ? { k: it.corruptImplicit.k, v: it.corruptImplicit.v } : null,
    implicit: it.implicit ? { k: it.implicit.k, v: it.implicit.v } : null,
    mods: it.mods.map(m => ({ k: m.k, v: m.v })), reforged: it.reforged || 0,
  };
}
export function rememberGear(game) {
  game.meta.p.gear = Object.fromEntries(
    Object.entries(game.player.equip).map(([slot, item]) => [slot, serializeItem(item)])
  );
  game.meta.save();
}

export function deserializeItem(o) {
  if (!o) return null;
  return {
    id: _id++, slot: o.slot, rarity: o.rarity, tier: o.tier || 1, enhance: o.enhance || 0, setId: o.setId || null, rune: o.rune || null,
    potential: o.potential ? { tier: o.potential.tier, lines: (o.potential.lines || []).map(l => ({ k: l.k, v: l.v, label: l.label })) } : null,
    name: o.name, base: o.base, art: o.art || null, special: o.special, desc: o.desc, reforged: o.reforged || 0,
    corrupted: !!o.corrupted, bricked: !!o.bricked,
    corruptImplicit: o.corruptImplicit ? { ...o.corruptImplicit, fmt: fmtOf(o.corruptImplicit.k) } : null,
    implicit: o.implicit ? { ...o.implicit, fmt: IMP_FMT[o.implicit.k] || fmtOf(o.implicit.k) } : null,
    mods: o.mods.map(m => ({ k: m.k, v: m.v, fmt: fmtOf(m.k) })),
  };
}
// ---------- 裝備「腐化」不可逆高風險改造（Vaal Orb 風格） ----------
export const CORRUPT_COST = 15;
export const CORRUPT_IMPLICITS = [
  { k: 'proj',     v: 2,  fmt: v => `【神諭腐化】投射物額外 +${v} 發` },
  { k: 'dmgPct',   v: 45, fmt: v => `【神諭腐化】全傷害 +${v}%` },
  { k: 'crit',     v: 18, fmt: v => `【神諭腐化】暴擊率 +${v}%` },
  { k: 'cdr',      v: 25, fmt: v => `【神諭腐化】所有冷卻縮減 +${v}%` },
  { k: 'maxHp',    v: 95, fmt: v => `【神諭腐化】最大生命 +${v}` },
  { k: 'atkSpd',   v: 32, fmt: v => `【神諭腐化】攻擊速度 +${v}%` },
];
export function corruptItem(it, r = Math.random) {
  if (!it) return { ok: false, reason: 'missing' };
  if (it.corrupted) return { ok: false, reason: 'already_corrupted' };
  const n = {
    ...it,
    implicit: it.implicit ? { ...it.implicit } : null,
    mods: it.mods.map(m => ({ ...m })),
    corrupted: true,
    bricked: false,
  };
  const roll = r();
  if (roll < 0.25) {
    const ci = pick(r, CORRUPT_IMPLICITS);
    n.corruptImplicit = { ...ci };
    n.rarity = Math.max(2, n.rarity);
    if (!n.name.startsWith('【腐化】')) n.name = `【腐化】${n.name}`;
    return { ok: true, outcome: 'godroll', label: '☠️ 神諭異變！誕生毀天滅地腐化詞綴！', item: n };
  } else if (roll < 0.50) {
    n.tier = Math.min(6, (n.tier || 1) + 1);
    if (n.implicit) n.implicit.v = Math.max(1, Math.round(n.implicit.v * 1.45));
    for (const m of n.mods) m.v = Math.max(1, Math.round(m.v * 1.45));
    if (!n.name.startsWith('【超頻】')) n.name = `【超頻】${n.name}`;
    return { ok: true, outcome: 'supercharge', label: '⚡ 極限超頻！全詞綴數值暴漲 1.45 倍！', item: n };
  } else if (roll < 0.75) {
    if (n.implicit) n.implicit.v = Math.max(1, Math.round(n.implicit.v * 1.15));
    return { ok: true, outcome: 'stable', label: '✦ 虛空穩固：基底 +15% 並永久定型。', item: n };
  } else {
    n.bricked = true;
    n.rarity = 0;
    n.special = null;
    n.desc = '這件神裝在腐化儀式中徹底崩解，只剩下微微發燙的虛空殘渣。';
    n.name = `碎裂的${SLOTS[n.slot]?.name || '殘骸'}`;
    n.implicit = { k: 'maxHp', v: 1, fmt: v => `+${v} 最大生命（碎裂）` };
    n.mods = [{ k: 'dmgPct', v: -15, fmt: v => `${v}% 傷害（虛空反噬）` }];
    return { ok: true, outcome: 'brick', label: '💀 腐化失控！裝備徹底碎裂報廢！', item: n };
  }
}
// ---------- 鐵匠：重鑄／增幅／升階 ----------
function rollMod(r, it, taken) {
  const pool = AFFIXES.filter(a => a.slots.includes(it.slot) && !taken.includes(a.k) && (!a.rare || it.rarity === 2));
  if (!pool.length) return null;
  const a = pool[Math.floor(r() * pool.length)];
  return { k: a.k, v: Math.round(a.roll(it.tier) * rand(r, 0.75, 1.15)), fmt: a.fmt };
}
export const FORGE = {
  reroll: { name: '重鑄詞綴', desc: '重新隨機所有詞綴（傳奇／已腐化裝備不可）', cost: it => 10 + (it.tier || 1) * 6, ok: it => !it.corrupted && it.rarity < 3 && it.mods.length > 0 },
  add: { name: '增幅詞綴', desc: '新增一條詞綴（上限 4 條，已腐化不可）', cost: it => 12 + (it.tier || 1) * 8, ok: it => !it.corrupted && it.rarity < 3 && it.mods.length < 4 },
  tier: { name: '提升階級', desc: '階級 +1，數值依新階級重新計算（已腐化不可）', cost: it => 22 + (it.tier || 1) * 14, ok: it => !it.corrupted && it.tier < 6 },
  upgrade: { name: '晉升稀有度', desc: '普通→魔法→稀有，並補足詞綴（已腐化不可）', cost: it => 15 + (it.tier || 1) * 10, ok: it => !it.corrupted && it.rarity < 2 },
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
    n.base = n.base || SLOTS[n.slot]?.bases[0] || n.name || '裝備';
    n.name = n.rarity === 1 ? `${pick(r, PREFIX)}${n.base}` : `${pick(r, PREFIX)}${pick(r, SUFFIX)}`;
  }
  return n;
}
