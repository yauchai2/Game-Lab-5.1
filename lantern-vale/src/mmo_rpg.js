import * as THREE from 'three';
import { buildPlayer } from './models.js';
import { grantLifeXp, addDailyActivity } from './mmo_world.js';
import { getPartyIds } from './mmo_endgame.js';

// ============================================================================
// 1. 經典 MMORPG 角色四維屬性配點（每升 1 級獲得 3 點屬性點，可免費重置）
// ============================================================================
export const STAT_DEFS = [
  { id: 'str', icon: '⚔️', name: '力量 STR', desc: '每點：基礎傷害 +1.2 · 全傷害 +1.5%' },
  { id: 'dex', icon: '🏹', name: '敏捷 DEX', desc: '每點：攻速 +2% · 暴擊率 +0.8% · 移速 +0.6%' },
  { id: 'int', icon: '🔮', name: '智力 INT', desc: '每點：法力上限 +5 · 冷卻縮減 +0.8% · 火傷 +0.6' },
  { id: 'vit', icon: '🛡️', name: '體質 VIT', desc: '每點：最大生命 +9 · 減傷 +0.6% · 每秒回血 +0.2' },
];

export function ensureMmoState(profile) {
  if (!profile) return {};
  if (!profile.allocStats || typeof profile.allocStats !== 'object') {
    profile.allocStats = { str: 0, dex: 0, int: 0, vit: 0 };
  }
  if (!profile.bestiary || typeof profile.bestiary !== 'object') {
    profile.bestiary = {};
  }
  if (!profile.story || typeof profile.story !== 'object') {
    profile.story = { chapter: 0, progress: {}, claimed: [] };
  }
  if (typeof profile.companionId === 'undefined') profile.companionId = null;
  return profile;
}

export function totalStatPoints(profile) {
  const lv = Math.max(1, profile?.level || 1);
  return (lv - 1) * 3;
}

export function spentStatPoints(profile) {
  const a = ensureMmoState(profile).allocStats || {};
  return (a.str || 0) + (a.dex || 0) + (a.int || 0) + (a.vit || 0);
}

export function availableStatPoints(profile) {
  return Math.max(0, totalStatPoints(profile) - spentStatPoints(profile));
}

export function allocateStat(profile, statId, amount = 1) {
  ensureMmoState(profile);
  if (!['str', 'dex', 'int', 'vit'].includes(statId)) return { ok: false };
  const avail = availableStatPoints(profile);
  const add = Math.min(avail, Math.max(1, amount));
  if (add <= 0) return { ok: false, reason: '無可用屬性點' };
  profile.allocStats[statId] = (profile.allocStats[statId] || 0) + add;
  return { ok: true, value: profile.allocStats[statId], left: availableStatPoints(profile) };
}

export function resetStatPoints(profile) {
  ensureMmoState(profile);
  profile.allocStats = { str: 0, dex: 0, int: 0, vit: 0 };
  return availableStatPoints(profile);
}

export function computeAllocatedBonuses(profile) {
  const a = ensureMmoState(profile).allocStats || {};
  const str = a.str || 0, dex = a.dex || 0, intel = a.int || 0, vit = a.vit || 0;
  return {
    baseDmg: Math.floor(str * 1.2),
    dmgPct: Math.round(str * 1.5),
    atkSpd: dex * 2,
    crit: +(dex * 0.8).toFixed(1),
    moveSpd: +(dex * 0.6).toFixed(1),
    mana: intel * 5,
    cdr: Math.min(35, +(intel * 0.8).toFixed(1)),
    addFire: Math.floor(intel * 0.6),
    maxHp: vit * 9,
    armor: Math.min(25, +(vit * 0.6).toFixed(1)),
    regen: +(vit * 0.2).toFixed(1),
  };
}

// ============================================================================
// 2. 經典 MMORPG 裝備精煉強化（+0 → +10，疊層保底 Failstack ＋ 全身強化共鳴！）
// ============================================================================
export const FAILSTACK_PER_FAIL = 0.06; // 每次精煉失敗 +6% 保底成功率（成功後歸零）

export const ENHANCE_RESONANCE_TIERS = [
  { minLv: 3, name: '精鋼共鳴 (+3)', icon: '🔷', color: '#7ab8ff', bonuses: { maxHp: 20, dmgPct: 6 } },
  { minLv: 5, name: '星銀共鳴 (+5)', icon: '💎', color: '#62e8ff', bonuses: { maxHp: 45, dmgPct: 12, crit: 4 } },
  { minLv: 7, name: '燦金宗師共鳴 (+7)', icon: '🌟', color: '#ffd85a', bonuses: { maxHp: 80, dmgPct: 20, crit: 8, atkSpd: 10 } },
  { minLv: 9, name: '緋紅神話共鳴 (+9)', icon: '🔥', color: '#ff5a88', bonuses: { maxHp: 130, dmgPct: 32, crit: 12, atkSpd: 16, allRes: 8 } },
];

export function computeEnhanceResonance(equip = {}) {
  const slots = ['staff', 'cloak', 'charm'];
  const levels = slots.map(k => equip?.[k] ? (equip[k].enhance || 0) : 0);
  const allEquipped = slots.every(k => !!equip?.[k]);
  const minLv = allEquipped ? Math.min(...levels) : 0;
  let active = null;
  for (const tier of ENHANCE_RESONANCE_TIERS) {
    if (minLv >= tier.minLv) active = tier;
  }
  const next = ENHANCE_RESONANCE_TIERS.find(t => t.minLv > minLv) || null;
  return { minLv, active, next, bonuses: active ? { ...active.bonuses } : {} };
}

export function enhanceInfo(curLv = 0, failstack = 0, smithLv = 1) {
  const lv = Math.max(0, Math.min(10, curLv || 0));
  if (lv >= 10) return { max: true, baseRate: 0, failstack: 0, bonusRate: 0, smithBonus: 0, rate: 0, coins: 0, ore: 0, shards: 0, risk: '已達最高精煉' };
  const baseRate = lv < 4 ? 1.0 : lv < 7 ? 0.65 : lv < 9 ? 0.42 : 0.28;
  const fs = Math.max(0, Math.floor(failstack || 0));
  const smithBonus = baseRate >= 1 ? 0 : Math.min(0.16, Math.max(0, (smithLv || 1) - 1) * 0.008);
  const bonusRate = baseRate >= 1 ? 0 : Math.min(0.95 - baseRate, fs * FAILSTACK_PER_FAIL);
  const rate = Math.min(baseRate >= 1 ? 1 : 0.98, +(baseRate + bonusRate + smithBonus).toFixed(4));
  const coins = 35 + lv * 45 + lv * lv * 14;
  const ore = 1 + Math.floor(lv / 2);
  const shards = lv >= 5 ? (lv - 3) * 8 : 0;
  const extraPct = Math.round((bonusRate + smithBonus) * 100);
  const fsTxt = extraPct > 0 ? `（含保底/鍛造加成 +${extraPct}%）` : '';
  const risk = lv < 4 ? '100% 安全精煉' : lv < 7 ? `${Math.round(rate * 100)}% 成功${fsTxt}（失敗維持原階並 +6% 保底）` : `${Math.round(rate * 100)}% 成功${fsTxt}（⚠️ 失敗將降 1 階並 +6% 保底！）`;
  return { max: false, nextLv: lv + 1, baseRate, failstack: fs, bonusRate, smithBonus, rate, coins, ore, shards, risk, downgradeOnFail: lv >= 7 };
}

export function enhanceItem(profile, item, rng = Math.random, useCharm = false) {
  if (!profile || !item) return { ok: false, reason: '無裝備可精煉' };
  if (item.bricked) return { ok: false, reason: '已碎裂裝備無法精煉' };
  const cur = item.enhance || 0;
  const curFs = profile.enhanceFailstack || 0;
  const smithLv = profile.lifeSkills?.smith?.lv || 1;
  const info = enhanceInfo(cur, curFs, smithLv);
  if (info.max) return { ok: false, reason: '已達 +10 最高精煉' };
  const mats = profile.mats || (profile.mats = {});
  if ((profile.coins || 0) < info.coins) return { ok: false, reason: `需要 🪙${info.coins} 金幣` };
  if ((mats.ore || 0) < info.ore) return { ok: false, reason: `需要 ⛏️${info.ore} 星紋礦` };
  if ((profile.shards || 0) < info.shards) return { ok: false, reason: `需要 💎${info.shards} 星砂` };
  const wantCharm = useCharm && info.downgradeOnFail && (profile.protectCharms || 0) > 0;

  profile.coins -= info.coins;
  mats.ore -= info.ore;
  profile.shards -= info.shards;
  if (wantCharm) profile.protectCharms--;

  profile.bountyProg = profile.bountyProg || {};
  profile.bountyProg.enhances = (profile.bountyProg.enhances || 0) + 1;
  const lifeUp = grantLifeXp(profile, 'smith', 14);
  addDailyActivity(profile, 8);

  const success = rng() < info.rate;
  if (success) {
    item.enhance = cur + 1;
    if (info.baseRate < 1) profile.enhanceFailstack = 0;
    if (item.implicit) item.implicit.v = Math.max(item.implicit.v + 1, Math.round(item.implicit.v * 1.14));
    return { ok: true, success: true, enhance: item.enhance, failstack: profile.enhanceFailstack || 0, lifeUp, msg: `✨ 精煉成功！裝備躍升至 +${item.enhance}！` };
  }
  profile.enhanceFailstack = curFs + 1;
  if (info.downgradeOnFail && !wantCharm) {
    item.enhance = Math.max(0, cur - 1);
    if (item.implicit) item.implicit.v = Math.max(1, Math.round(item.implicit.v / 1.14));
    return { ok: true, success: false, downgraded: true, enhance: item.enhance, failstack: profile.enhanceFailstack, lifeUp, msg: `💥 精煉失敗降為 +${item.enhance}… 疊層保底 +1（下次 +${Math.round(profile.enhanceFailstack * FAILSTACK_PER_FAIL * 100)}%）` };
  }
  return {
    ok: true, success: false, downgraded: false, protected: wantCharm, enhance: cur, failstack: profile.enhanceFailstack, lifeUp,
    msg: wantCharm
      ? `🛡️ 祝福保護符保住 +${cur}！疊層保底 +1（下次 +${Math.round(profile.enhanceFailstack * FAILSTACK_PER_FAIL * 100)}%）`
      : `💨 精煉失敗但維持 +${cur}，疊層保底 +1（下次 +${Math.round(profile.enhanceFailstack * FAILSTACK_PER_FAIL * 100)}%）`,
  };
}

export function enhanceGlowColor(enhanceLv = 0) {
  if (enhanceLv >= 9) return 0xff4878; // +9/+10 緋紅神話光暈
  if (enhanceLv >= 7) return 0xffd85a; // +7/+8 燦金宗師光暈
  if (enhanceLv >= 5) return 0x62e8ff; // +5/+6 湛藍精煉光暈
  return null;
}

// 公會聲望系統（Lv.1 → Lv.10，由完成懸賞累積永久戰力與掉寶加成）
export const GUILD_REP_LEVELS = [
  { lv: 1,  needRep: 0,    title: '見習委託人',   dmgPct: 0,  maxHp: 0,  shardBonus: 0 },
  { lv: 2,  needRep: 50,   title: '燈谷巡邏員',   dmgPct: 2,  maxHp: 8,  shardBonus: 5 },
  { lv: 3,  needRep: 120,  title: '公會銀牌獵人', dmgPct: 4,  maxHp: 16, shardBonus: 10 },
  { lv: 4,  needRep: 220,  title: '星燈執法者',   dmgPct: 6,  maxHp: 26, shardBonus: 15 },
  { lv: 5,  needRep: 360,  title: '遠征小隊長',   dmgPct: 9,  maxHp: 38, shardBonus: 20 },
  { lv: 6,  needRep: 540,  title: '深淵討伐官',   dmgPct: 12, maxHp: 52, shardBonus: 25 },
  { lv: 7,  needRep: 760,  title: '榮譽星輝騎士', dmgPct: 15, maxHp: 68, shardBonus: 30 },
  { lv: 8,  needRep: 1020, title: '星燈守護團長', dmgPct: 19, maxHp: 86, shardBonus: 36 },
  { lv: 9,  needRep: 1350, title: '穹頂遠征統帥', dmgPct: 23, maxHp: 108, shardBonus: 42 },
  { lv: 10, needRep: 1750, title: '燈谷大元帥',   dmgPct: 28, maxHp: 135, shardBonus: 50 },
];

export function getGuildRepInfo(profile) {
  const rep = Math.max(0, profile?.guildRep || 0);
  let cur = GUILD_REP_LEVELS[0];
  for (const r of GUILD_REP_LEVELS) if (rep >= r.needRep) cur = r;
  const next = GUILD_REP_LEVELS.find(r => r.lv === cur.lv + 1) || null;
  const prog = next ? Math.min(1, (rep - cur.needRep) / Math.max(1, next.needRep - cur.needRep)) : 1;
  return { ...cur, rep, next, prog };
}

export const GUILD_BOUNTIES = [
  { id: 'b_hunt',    icon: '⚔️', name: '野外魔物清剿令',   desc: '在野外累積討伐 20 隻魔物',           statKey: 'kills',      need: 20, reward: { coins: 130, ore: 2, charms: 0, rep: 25 } },
  { id: 'b_gather',  icon: '🪵', name: '燈谷物資徵收令',   desc: '完成 6 次野外採集（伐木／採礦／垂釣）', statKey: 'gathers',    need: 6,  reward: { coins: 140, ore: 3, charms: 0, rep: 30 } },
  { id: 'b_enhance', icon: '🔨', name: '工匠精煉試煉',     desc: '在鐵匠鋪執行 3 次裝備精煉',           statKey: 'enhances',   need: 3,  reward: { coins: 180, ore: 4, charms: 1, rep: 35 } },
  { id: 'b_elite',   icon: '☠️', name: '高危詞綴精英懸賞', desc: '累積擊殺 5 隻高危詞綴精英魔物',       statKey: 'eliteKills', need: 5,  reward: { coins: 240, ore: 4, charms: 1, rep: 45 } },
  { id: 'b_boss',    icon: '👑', name: '守護巨獸討伐令',   desc: '討伐 2 隻區域守護獸或潮汐領主',       statKey: 'bossKills',  need: 2,  reward: { coins: 450, ore: 8, charms: 2, rep: 85 } },
];

export function claimGuildBounty(profile, bountyId) {
  const def = GUILD_BOUNTIES.find(b => b.id === bountyId);
  if (!def || !profile) return { ok: false };
  profile.bountyProg = profile.bountyProg || { kills: 0, gathers: 0, enhances: 0, eliteKills: 0, bossKills: 0 };
  if ((profile.bountyProg[def.statKey] || 0) < def.need) return { ok: false, reason: '進度未達標' };
  profile.bountyProg[def.statKey] -= def.need;
  profile.coins = (profile.coins || 0) + def.reward.coins;
  profile.mats = profile.mats || {};
  profile.mats.ore = (profile.mats.ore || 0) + def.reward.ore;
  profile.protectCharms = (profile.protectCharms || 0) + (def.reward.charms || 0);
  const prevLv = getGuildRepInfo(profile).lv;
  profile.guildRep = (profile.guildRep || 0) + (def.reward.rep || 0);
  addDailyActivity(profile, 15);
  const nextInfo = getGuildRepInfo(profile);
  return { ok: true, reward: def.reward, def, repUp: nextInfo.lv > prevLv ? nextInfo : null };
}

// ============================================================================
// 7. 怪物專屬掉落材料（7 種種族素材）＋ 9 大裝備鍛造藍圖（從開荒裝 → 抗性套裝 → 極罕傳奇神裝！）
// ============================================================================
export const MONSTER_MATS = {
  slime_gel:   { id: 'slime_gel',   icon: '🟢', name: '史萊姆凝膠', from: 'slime',  rate: 0.36 },
  thorn_bark:  { id: 'thorn_bark',  icon: '🌿', name: '荊棘硬木',   from: 'thorn',  rate: 0.36 },
  boar_tusk:   { id: 'boar_tusk',   icon: '🐗', name: '狂豬利牙',   from: 'boar',   rate: 0.34 },
  moth_dust:   { id: 'moth_dust',   icon: '🦋', name: '月蛾鱗粉',   from: 'moth',   rate: 0.32 },
  sky_feather: { id: 'sky_feather', icon: '🦅', name: '雲翼風羽',   from: 'skyray', rate: 0.30 },
  golem_core:  { id: 'golem_core',  icon: '🪨', name: '重岩魔核',   from: 'golem',  rate: 0.28 },
  boss_heart:  { id: 'boss_heart',  icon: '👑', name: '巨獸星心',   from: 'stag',   rate: 0.65 },
};

export function rollMonsterMatDrop(profile, enemyType, isElite = false, isBoss = false, rng = Math.random) {
  if (!profile) return null;
  profile.mMats = profile.mMats || {};
  // 區域守護獸／潮汐領主有機會掉落最珍稀的「巨獸星心」
  if (isBoss && rng() < MONSTER_MATS.boss_heart.rate) {
    profile.mMats.boss_heart = (profile.mMats.boss_heart || 0) + 1;
    return { def: MONSTER_MATS.boss_heart, count: 1 };
  }
  const def = Object.values(MONSTER_MATS).find(m => m.from === enemyType) || (isElite ? MONSTER_MATS.golem_core : null);
  if (!def) return null;
  const chance = isElite ? Math.min(0.85, def.rate * 1.8) : def.rate;
  if (rng() < chance) {
    const count = isElite && rng() < 0.4 ? 2 : 1;
    profile.mMats[def.id] = (profile.mMats[def.id] || 0) + count;
    return { def, count };
  }
  return null;
}

// 各階級裝備對應「穿戴等級限制」與「指定專屬鍛造材料」
export const TIER_CRAFT_MATS = {
  1: { reqLevel: 1,  label: 'T1 旅人階 (Lv.1+)',  mats: ['slime_gel', 'wood'] },
  2: { reqLevel: 5,  label: 'T2 精鋼階 (Lv.5+)',  mats: ['thorn_bark', 'boar_tusk', 'ore'] },
  3: { reqLevel: 10, label: 'T3 星銀階 (Lv.10+)', mats: ['moth_dust', 'sky_feather', 'ore'] },
  4: { reqLevel: 16, label: 'T4 秘光階 (Lv.16+)', mats: ['golem_core', 'sky_feather'] },
  5: { reqLevel: 22, label: 'T5 傳世階 (Lv.22+)', mats: ['boss_heart', 'golem_core'] },
  6: { reqLevel: 27, label: 'T6 穹頂階 (Lv.27+)', mats: ['boss_heart', 'golem_core', 'moth_dust'] },
};

export const GEAR_RECIPES = [
  // --- T1 旅人階（Lv.1+ 穿戴 · 專屬材料：史萊姆凝膠＋香杉木）---
  {
    id: 'rec_t1_cloak', tier: 1, reqLevel: 1, rarity: 1, slot: 'cloak', setId: null,
    name: '凝膠抗毒斗篷', base: '亞麻斗篷',
    cost: { coins: 65, goods: { wood: 2 }, mMats: { slime_gel: 3 } },
    implicit: { k: 'maxHp', v: 22 },
    mods: [{ k: 'resPoison', v: 18 }, { k: 'regen', v: 2 }],
    desc: '【T1 Lv.1+】開荒必備：史萊姆凝膠鍛造，抗毒回血',
  },
  // --- T2 精鋼階（Lv.5+ 穿戴 · 專屬材料：荊棘硬木＋狂豬利牙＋星紋礦）---
  {
    id: 'rec_tusk_staff', tier: 2, reqLevel: 5, rarity: 1, slot: 'staff', setId: null,
    name: '狂豬利牙戰杖', base: '苔紋手杖',
    cost: { coins: 120, goods: { ore: 2 }, mMats: { boar_tusk: 4, thorn_bark: 3 } },
    implicit: { k: 'baseDmg', v: 13 },
    mods: [{ k: 'dmgPct', v: 18 }, { k: 'crit', v: 6 }],
    desc: '【T2 Lv.5+】荊棘硬木與狂豬利牙鑲嵌，大幅提升前期輸出',
  },
  {
    id: 'rec_moth_charm', tier: 2, reqLevel: 5, rarity: 1, slot: 'charm', setId: null,
    name: '荊棘堅盾護符', base: '貝殼墜飾',
    cost: { coins: 110, goods: { ore: 2 }, mMats: { thorn_bark: 4, slime_gel: 3 } },
    implicit: { k: 'crit', v: 5 },
    mods: [{ k: 'resPoison', v: 20 }, { k: 'armor', v: 6 }],
    desc: '【T2 Lv.5+】提升物防與毒抗，低語森林／沼澤開荒良伴',
  },
  // --- T3 星銀階（Lv.10+ 穿戴 · 專屬材料：月蛾鱗粉＋雲翼風羽＋星紋礦）---
  {
    id: 'rec_gale_charm', tier: 3, reqLevel: 10, rarity: 2, slot: 'charm', setId: 'gale_hunter',
    name: '疾風獵影羽符', base: '琥珀吊墜',
    cost: { coins: 300, shards: 30, goods: { ore: 3 }, mMats: { sky_feather: 5, moth_dust: 4 } },
    implicit: { k: 'crit', v: 8 },
    mods: [{ k: 'atkSpd', v: 18 }, { k: 'moveSpd', v: 12 }, { k: 'resLightning', v: 24 }],
    desc: '【T3 Lv.10+】⚡ 疾風獵影套裝 · 極速走位與雷抗',
  },
  {
    id: 'rec_ember_staff', tier: 3, reqLevel: 10, rarity: 2, slot: 'staff', setId: 'ember_conqueror',
    name: '熾炎征服者之杖', base: '燈芯長杖',
    cost: { coins: 320, shards: 35, goods: { ore: 4 }, mMats: { boar_tusk: 6, moth_dust: 4 } },
    implicit: { k: 'baseDmg', v: 18 },
    mods: [{ k: 'dmgPct', v: 28 }, { k: 'addFire', v: 8 }, { k: 'resFire', v: 22 }],
    desc: '【T3 Lv.10+】🔥 熾炎征服者套裝 · 高火傷＋火抗',
  },
  // --- T4 秘光階（Lv.16+ 穿戴 · 專屬材料：重岩魔核＋雲翼風羽＋星砂）---
  {
    id: 'rec_frost_cloak', tier: 4, reqLevel: 16, rarity: 2, slot: 'cloak', setId: 'frost_warden',
    name: '霜穹守護者大氅', base: '雨林蓑衣',
    cost: { coins: 520, shards: 55, goods: { ore: 5 }, mMats: { golem_core: 5, sky_feather: 5 } },
    implicit: { k: 'maxHp', v: 64 },
    mods: [{ k: 'armor', v: 12 }, { k: 'resIce', v: 30 }, { k: 'resFire', v: 22 }],
    desc: '【T4 Lv.16+】❄️ 霜穹守護者套裝 · 雙抗重甲生存核心',
  },
  // --- T5 傳世階（Lv.22+ 穿戴 · 專屬材料：巨獸星心＋重岩魔核＋星砂）---
  {
    id: 'rec_mythic_staff', tier: 5, reqLevel: 22, rarity: 3, slot: 'staff', setId: 'ember_conqueror',
    name: '焚天餘燼古杖', base: '古橡法杖', special: 'splitBolt',
    cost: { coins: 1200, shards: 110, mMats: { boss_heart: 3, golem_core: 6, boar_tusk: 8 } },
    implicit: { k: 'baseDmg', v: 30 },
    mods: [{ k: 'dmgPct', v: 45 }, { k: 'addFire', v: 14 }, { k: 'critMult', v: 45 }, { k: 'resFire', v: 28 }],
    desc: '【T5 Lv.22+ 極罕傳奇】餘燼彈分裂 3 枚火花，終極火力象徵！',
  },
  {
    id: 'rec_mythic_cloak', tier: 5, reqLevel: 22, rarity: 3, slot: 'cloak', setId: 'frost_warden',
    name: '永冬聖壁大氅', base: '星紋大氅', special: 'mossRegen',
    cost: { coins: 1200, shards: 110, mMats: { boss_heart: 3, golem_core: 8, slime_gel: 10 } },
    implicit: { k: 'maxHp', v: 95 },
    mods: [{ k: 'armor', v: 16 }, { k: 'allRes', v: 24 }, { k: 'regen', v: 5 }],
    desc: '【T5 Lv.22+ 極罕傳奇】全元素抗性 +24% 且每秒回血 2%，深淵生還神裝！',
  },
  // --- T6 穹頂階（Lv.27+ 穿戴 · 專屬材料：巨獸星心×4＋重岩魔核＋月蛾鱗粉＋星砂）---
  {
    id: 'rec_mythic_charm', tier: 6, reqLevel: 27, rarity: 3, slot: 'charm', setId: 'star_sage',
    name: '星穹全抗聖符', base: '螢石護符', special: 'moreWisps',
    cost: { coins: 1600, shards: 150, mMats: { boss_heart: 4, golem_core: 6, moth_dust: 8 } },
    implicit: { k: 'crit', v: 14 },
    mods: [{ k: 'allRes', v: 28 }, { k: 'cdr', v: 20 }, { k: 'proj', v: 1 }],
    desc: '【T6 Lv.27+ 終極傳奇】全元素抗性 +28% · 投射物 +1 · 螢火伴 +3！',
  },
];

export function missingRecipeCosts(profile, recipe) {
  const cost = recipe.cost || {};
  const requirements = [
    { key: 'coins', need: cost.coins || 0, have: profile.coins || 0 },
    { key: 'shards', need: cost.shards || 0, have: profile.shards || 0 },
    ...Object.entries(cost.goods || {}).map(([key, need]) => ({ key, need, have: profile.goods?.[key] || 0 })),
    ...Object.entries(cost.mMats || {}).map(([key, need]) => ({ key, need, have: profile.mMats?.[key] || 0 })),
  ];
  return requirements.filter(cost => cost.have < cost.need)
    .map(({ key, need, have }) => ({ key, count: need - have }));
}

export function canCraftRecipe(profile, recipe) {
  return !!(profile && recipe && missingRecipeCosts(profile, recipe).length === 0);
}

export function craftMonsterGear(profile, recipeId, fmtResolver = (k => v => `${k} +${v}`)) {
  const rec = GEAR_RECIPES.find(r => r.id === recipeId);
  if (!rec) return { ok: false, reason: '未知藍圖' };
  if (!canCraftRecipe(profile, rec)) return { ok: false, reason: '材料或貨幣不足' };
  const c = rec.cost || {};
  profile.coins = (profile.coins || 0) - (c.coins || 0);
  profile.shards = (profile.shards || 0) - (c.shards || 0);
  profile.goods = profile.goods || { wood: 0, ore: 0, fish: 0 };
  for (const [k, need] of Object.entries(c.goods || {})) profile.goods[k] -= need;
  profile.mMats = profile.mMats || {};
  for (const [k, need] of Object.entries(c.mMats || {})) profile.mMats[k] -= need;
  const item = {
    id: Math.floor(Math.random() * 1e9),
    slot: rec.slot,
    rarity: rec.rarity,
    tier: rec.tier,
    reqLevel: rec.reqLevel || 1,
    enhance: 0,
    setId: rec.setId || null,
    name: rec.name,
    base: rec.base,
    special: rec.special || null,
    desc: rec.desc,
    implicit: { k: rec.implicit.k, v: rec.implicit.v, fmt: fmtResolver(rec.implicit.k) },
    mods: rec.mods.map(m => ({ k: m.k, v: m.v, fmt: fmtResolver(m.k) })),
  };
  const lifeUp = grantLifeXp(profile, 'smith', 22);
  addDailyActivity(profile, 10);
  return { ok: true, item, recipe: rec, lifeUp };
}

// ============================================================================
// 3. 四大 MMORPG 裝備套裝（2 件套 / 3 件全套特效，驅動刷裝與拍賣行交易！）
// ============================================================================
export const MMO_SETS = {
  ember_conqueror: {
    id: 'ember_conqueror', icon: '🔥', name: '熾炎征服者', color: '#ff7a3a',
    b2Desc: '(2) 全傷害 +18% · 火焰傷害 +5',
    b3Desc: '(3) 暴擊率 +12% · 暴傷 +35%（攻擊機率引爆烈焰）',
    b2: { dmgPct: 18, addFire: 5 },
    b3: { crit: 12, critMult: 35 },
  },
  frost_warden: {
    id: 'frost_warden', icon: '❄️', name: '霜穹守護者', color: '#7ae8ff',
    b2Desc: '(2) 最大生命 +45 · 減傷 +8%',
    b3Desc: '(3) 每秒回血 +4 · 受擊時寒霜反擊凍結近身敵人',
    b2: { maxHp: 45, armor: 8 },
    b3: { regen: 4, armor: 6 },
  },
  gale_hunter: {
    id: 'gale_hunter', icon: '⚡', name: '疾風獵影', color: '#7fe08a',
    b2Desc: '(2) 攻速 +18% · 移速 +10%',
    b3Desc: '(3) 暴擊率 +10% · 翻滾冷卻 -25%',
    b2: { atkSpd: 18, moveSpd: 10 },
    b3: { crit: 10, rollCdr: 25 },
  },
  star_sage: {
    id: 'star_sage', icon: '🌟', name: '星燈賢者', color: '#d898ff',
    b2Desc: '(2) 冷卻縮減 +14% · 最大法力 +30',
    b3Desc: '(3) 範圍 +22% · 回魔 +40%',
    b2: { cdr: 14, mana: 30 },
    b3: { area: 22, manaRegen: 40 },
  },
};

export const MMO_SET_IDS = Object.keys(MMO_SETS);

export function computeSetBonuses(equip = {}) {
  const counts = {};
  for (const it of Object.values(equip || {})) {
    if (it?.setId && MMO_SETS[it.setId]) counts[it.setId] = (counts[it.setId] || 0) + 1;
  }
  const stats = {};
  const active = [];
  for (const [sid, n] of Object.entries(counts)) {
    const def = MMO_SETS[sid];
    if (n >= 2) {
      for (const [k, v] of Object.entries(def.b2)) stats[k] = (stats[k] || 0) + v;
      active.push({ id: sid, def, count: n, full: n >= 3 });
    }
    if (n >= 3) {
      for (const [k, v] of Object.entries(def.b3)) stats[k] = (stats[k] || 0) + v;
    }
  }
  return { counts, stats, active };
}

// ============================================================================
// 4. 怪物圖鑑精通系統（每隻擊殺累積永久賬號屬性，刷怪永遠有進度！）
// ============================================================================
export const BESTIARY_DEFS = {
  slime:  { name: '草地史萊姆', icon: '🟢', thresholds: [10, 30, 70, 140, 260], bonus: { maxHp: 6 },   bonusText: '每階 最大生命 +6' },
  thorn:  { name: '荊棘射手',   icon: '🌿', thresholds: [8,  25, 60, 120, 220], bonus: { crit: 1 },    bonusText: '每階 暴擊率 +1%' },
  boar:   { name: '狂奔野豬',   icon: '🐗', thresholds: [8,  24, 55, 110, 200], bonus: { baseDmg: 1 }, bonusText: '每階 基礎傷害 +1' },
  moth:   { name: '毒霧妖蛾',   icon: '🦋', thresholds: [6,  20, 50, 100, 180], bonus: { mana: 6 },    bonusText: '每階 最大法力 +6' },
  skyray: { name: '雲翼飛鰩',   icon: '🦅', thresholds: [5,  16, 40, 80,  150], bonus: { moveSpd: 2 }, bonusText: '每階 移速 +2%' },
  golem:  { name: '重岩巨像',   icon: '🪨', thresholds: [5,  15, 35, 75,  140], bonus: { armor: 2 },   bonusText: '每階 減傷 +2%' },
  stag:   { name: '守護巨獸',   icon: '👑', thresholds: [1,  3,  7,  15,  30],  bonus: { dmgPct: 5 },  bonusText: '每階 全傷害 +5%' },
};

export function bestiaryRank(type, kills = 0) {
  const def = BESTIARY_DEFS[type];
  if (!def) return 0;
  let r = 0;
  for (const th of def.thresholds) if (kills >= th) r++;
  return r;
}

export function recordBestiaryKill(profile, type) {
  ensureMmoState(profile);
  const def = BESTIARY_DEFS[type];
  if (!def) return null;
  const prev = profile.bestiary[type] || 0;
  const prevRank = bestiaryRank(type, prev);
  const next = prev + 1;
  profile.bestiary[type] = next;
  const nextRank = bestiaryRank(type, next);
  if (nextRank > prevRank) {
    return { type, def, rank: nextRank, kills: next };
  }
  return null;
}

export function computeBestiaryBonuses(profile) {
  const b = ensureMmoState(profile).bestiary || {};
  const stats = {};
  let totalRank = 0;
  for (const [type, def] of Object.entries(BESTIARY_DEFS)) {
    const r = bestiaryRank(type, b[type] || 0);
    if (r <= 0) continue;
    totalRank += r;
    for (const [k, v] of Object.entries(def.bonus)) stats[k] = (stats[k] || 0) + v * r;
  }
  return { stats, totalRank };
}

// ============================================================================
// 5. MMORPG 主線章節任務線（右側常駐追蹤器，明確引導成長目標！）
// ============================================================================
export const STORY_CHAPTERS = [
  { id: 'ch1', title: '第一章：初踏燈谷',     desc: '前往野外討伐 8 隻魔物，熟悉走位與閃避',         ev: 'kill',    need: 8,  reward: { coins: 80,  shards: 15, xp: 60,  gem: 'area' } },
  { id: 'ch2', title: '第二章：鍛骨與精煉',   desc: '在角色頁分配 3 點屬性點，並精煉裝備 1 次',      ev: 'enhance', need: 1,  reward: { coins: 120, shards: 25, xp: 90,  gem: 'haste' } },
  { id: 'ch3', title: '第三章：菁英詞綴獵人', desc: '擊敗 3 隻攜帶高危詞綴的精英魔物',               ev: 'elite',   need: 3,  reward: { coins: 180, shards: 40, xp: 140, gem: 'multi' } },
  { id: 'ch4', title: '第四章：組隊與遠征',   desc: '在燈谷公會招募 1 位 AI 隊友，並擊敗 25 隻魔物', ev: 'kill25',  need: 25, reward: { coins: 260, shards: 55, xp: 200, gem: 'leech' } },
  { id: 'ch5', title: '第五章：巨獸討伐令',   desc: '討伐 1 隻區域守護獸或潮汐領主',                 ev: 'boss',    need: 1,  reward: { coins: 400, shards: 80, xp: 320, gem: 'coh' } },
  { id: 'ch6', title: '第六章：星燈二轉覺醒', desc: '在燈谷鎮東北祭壇完成職業二轉覺醒',              ev: 'ascend',  need: 1,  reward: { coins: 550, shards: 110, xp: 450, gem: 'echo' } },
  { id: 'ch7', title: '終章：深淵征服者',     desc: '討伐 3 隻區域守護獸或潮汐領主，登頂 S 級冒險者', ev: 'boss3',   need: 3,  reward: { coins: 900, shards: 200, xp: 700, gem: 'coc' } },
];

export function getCurrentChapter(profile) {
  const st = ensureMmoState(profile).story;
  const idx = Math.min(STORY_CHAPTERS.length, st.chapter || 0);
  if (idx >= STORY_CHAPTERS.length) return null;
  const def = STORY_CHAPTERS[idx];
  const have = st.progress?.[def.id] || 0;
  return { idx, def, have, done: have >= def.need };
}

export function recordStoryEvent(profile, evName, amount = 1) {
  const cur = getCurrentChapter(profile);
  if (!cur || cur.done) return null;
  const { def } = cur;
  const match = def.ev === evName
    || (def.ev === 'kill25' && evName === 'kill')
    || (def.ev === 'boss3' && evName === 'boss');
  if (!match) return null;
  const st = profile.story;
  st.progress[def.id] = Math.min(def.need, (st.progress[def.id] || 0) + amount);
  return { def, have: st.progress[def.id], justCompleted: st.progress[def.id] >= def.need };
}

export function claimChapterReward(profile) {
  const cur = getCurrentChapter(profile);
  if (!cur || !cur.done) return null;
  const { def } = cur;
  profile.coins = (profile.coins || 0) + (def.reward.coins || 0);
  profile.shards = (profile.shards || 0) + (def.reward.shards || 0);
  profile.xp = (profile.xp || 0) + (def.reward.xp || 0);
  profile.story.claimed.push(def.id);
  profile.story.chapter = (profile.story.chapter || 0) + 1;
  return def.reward;
}

// ============================================================================
// 6. 冒險者公會階級（F → SS 含晉升領獎）與可招募 AI 隊友羈絆系統（Lv.1 → Lv.10！）
// ============================================================================
export const ADVENTURER_RANKS = [
  { rank: 'F',  name: '見習旅人',   minScore: 0,    color: '#d8d2c5', bonusDmgPct: 0,  promoReward: null },
  { rank: 'E',  name: '銅燈冒險者', minScore: 120,  color: '#c89a6a', bonusDmgPct: 3,  promoReward: { coins: 120, shards: 15, charms: 0 } },
  { rank: 'D',  name: '鐵盾守衛',   minScore: 260,  color: '#98c4e0', bonusDmgPct: 6,  promoReward: { coins: 220, shards: 25, charms: 1 } },
  { rank: 'C',  name: '銀翼獵人',   minScore: 480,  color: '#7fe08a', bonusDmgPct: 10, promoReward: { coins: 350, shards: 45, charms: 1 } },
  { rank: 'B',  name: '星輝騎士',   minScore: 800,  color: '#7ab8ff', bonusDmgPct: 14, promoReward: { coins: 520, shards: 70, charms: 2 } },
  { rank: 'A',  name: '緋焰討伐者', minScore: 1300, color: '#d88aff', bonusDmgPct: 19, promoReward: { coins: 800, shards: 110, charms: 2 } },
  { rank: 'S',  name: '星穹英雄',   minScore: 2000, color: '#ffd85a', bonusDmgPct: 25, promoReward: { coins: 1300, shards: 180, charms: 3 } },
  { rank: 'SS', name: '燈谷傳奇',   minScore: 3000, color: '#ff6848', bonusDmgPct: 32, promoReward: { coins: 2200, shards: 300, charms: 5 } },
];

export function computeAdventurerRank(profile, combatPower = 100) {
  const st = ensureMmoState(profile);
  const { totalRank } = computeBestiaryBonuses(profile);
  const chDone = (st.story?.claimed?.length || 0);
  const repLv = getGuildRepInfo(profile).lv;
  const score = Math.round(combatPower + totalRank * 28 + chDone * 95 + (profile?.level || 1) * 14 + (repLv - 1) * 45);
  let cur = ADVENTURER_RANKS[0];
  for (const r of ADVENTURER_RANKS) if (score >= r.minScore) cur = r;
  return { ...cur, score };
}

export function claimRankReward(profile, rankCode, combatPower = 100) {
  if (!profile) return { ok: false };
  const target = ADVENTURER_RANKS.find(r => r.rank === rankCode);
  if (!target || !target.promoReward) return { ok: false, reason: '此階級無晉升獎勵' };
  const cur = computeAdventurerRank(profile, combatPower);
  if (cur.score < target.minScore) return { ok: false, reason: `尚未達到 ${rankCode} 級（需積分 ${target.minScore}）` };
  profile.claimedRanks = Array.isArray(profile.claimedRanks) ? profile.claimedRanks : [];
  if (profile.claimedRanks.includes(rankCode)) return { ok: false, reason: '已領取此階級晉升獎勵' };
  profile.claimedRanks.push(rankCode);
  profile.coins = (profile.coins || 0) + (target.promoReward.coins || 0);
  profile.shards = (profile.shards || 0) + (target.promoReward.shards || 0);
  profile.protectCharms = (profile.protectCharms || 0) + (target.promoReward.charms || 0);
  return { ok: true, rank: target, reward: target.promoReward };
}

export const AI_COMPANIONS = [
  { id: 'vanguard', icon: '🛡️', name: '巴爾克 · 鐵壁衛士', role: '前排坦克', hood: [0x3a6a9a, 0x264a70], weapon: 'shield', cost: 120, bondDesc: '每羈絆等級：減傷 +1.5% · 生命 +8', desc: '衝鋒嘲諷附近精英怪並吸收火力，為你創造安全輸出空間！' },
  { id: 'healer',   icon: '🪷', name: '澄音 · 禪燈治療師', role: '輔助補師', hood: [0xd87a98, 0xa8526e], weapon: 'staff',  cost: 150, bondDesc: '每羈絆等級：每秒回血 +0.6 · 回魔 +5%', desc: '每 6 秒為你施放聖燈治癒（回復 18% 生命）並發射遠程光彈！' },
  { id: 'ranger',   icon: '🏹', name: '希爾 · 林風神射手', role: '遠程輸出', hood: [0x4c9a58, 0x306e3a], weapon: 'bow',    cost: 150, bondDesc: '每羈絆等級：攻速 +2% · 暴擊率 +0.8%', desc: '遠距離精準連射箭矢並減速追擊你的敵人！' },
];

export function companionXpForLevel(lv = 1) {
  return 60 + (lv - 1) * 55;
}

export function getCompanionBondInfo(profile, cid = null) {
  const id = cid || profile?.companionId;
  if (!id) return { lv: 1, xp: 0, need: companionXpForLevel(1), mult: 1, prog: 0 };
  const map = profile?.companionBond || {};
  const rec = map[id] || { lv: 1, xp: 0 };
  const lv = Math.max(1, Math.min(10, rec.lv || 1));
  const need = lv >= 10 ? 0 : companionXpForLevel(lv);
  return { lv, xp: rec.xp || 0, need, mult: +(1 + (lv - 1) * 0.14).toFixed(2), prog: need ? Math.min(1, (rec.xp || 0) / need) : 1 };
}

export function grantCompanionXp(profile, amount = 10) {
  const ids = getPartyIds(profile);
  if (!ids.length || amount <= 0) return null;
  profile.companionBond = profile.companionBond || {};
  let firstUp = null;
  for (const cid of ids) {
    const rec = profile.companionBond[cid] || (profile.companionBond[cid] = { lv: 1, xp: 0 });
    if (rec.lv >= 10) continue;
    rec.xp = (rec.xp || 0) + amount;
    let leveled = false;
    while (rec.lv < 10 && rec.xp >= companionXpForLevel(rec.lv)) {
      rec.xp -= companionXpForLevel(rec.lv);
      rec.lv++;
      leveled = true;
    }
    if (rec.lv >= 10) rec.xp = 0;
    if (leveled && !firstUp) firstUp = { cid, def: AI_COMPANIONS.find(c => c.id === cid), lv: rec.lv };
  }
  return firstUp;
}

export function computeCompanionBondBonuses(profile) {
  const ids = getPartyIds(profile);
  if (!ids.length) return {};
  const out = {};
  for (const cid of ids) {
    const { lv } = getCompanionBondInfo(profile, cid);
    if (cid === 'vanguard') { out.armor = +((out.armor || 0) + lv * 1.5).toFixed(1); out.maxHp = (out.maxHp || 0) + lv * 8; }
    else if (cid === 'healer') { out.regen = +((out.regen || 0) + lv * 0.6).toFixed(1); out.manaRegen = (out.manaRegen || 0) + lv * 5; }
    else if (cid === 'ranger') { out.atkSpd = (out.atkSpd || 0) + lv * 2; out.crit = +((out.crit || 0) + lv * 0.8).toFixed(1); }
  }
  return out;
}

export const WORLD_CHAT_LINES = [
  '[世界] 晨風劍士：剛在低語森林遇到雙詞綴精英（旋轉熔岩＋冰霜牢籠），差點滅團！',
  '[世界] 星語法師：鐵匠鋪疊了 3 層保底終於衝 +7 成功！！全身共鳴亮金光啦！',
  '[世界] 影月遊俠：終於湊齊 60 殺＋香杉木馴養林間巨鹿，跑圖超爽！',
  '[世界] 燈谷老鐵匠：星紋礦缺貨中～今天拍賣行行情不錯喔！',
  '[世界] 楓的酒館：公會聲望升到 Lv.5 了，星砂加成超有感！',
  '[世界] 旅團長艾倫：試煉秘境塔衝到 15F 了！魔方剛洗出 UR 雙詞綴神裝！',
];

export function spawnCompanion3D(g) {
  if (Array.isArray(g._companionMeshes)) {
    for (const cm of g._companionMeshes) if (cm?.root) g.scene.remove(cm.root);
  }
  if (g._companionMesh?.root) g.scene.remove(g._companionMesh.root);
  g._companionMeshes = [];
  g._companionMesh = null;
  const ids = getPartyIds(g.meta?.p);
  if (!ids.length || !g.player || !g.world) return null;
  ids.forEach((cid, idx) => {
    const def = AI_COMPANIONS.find(c => c.id === cid);
    if (!def) return;
    const m = buildPlayer(def.hood);
    m.root.scale.setScalar(0.92);
    const side = idx === 0 ? 1 : -1;
    const px = g.player.pos.x + 1.8 * side, pz = g.player.pos.z + 1.2 + idx * 0.5;
    const py = g.world.isLand(px, pz) ? g.world.gh(px, pz) : g.player.y;
    m.root.position.set(px, py, pz);
    g.scene.add(m.root);
    g._companionMeshes.push({ def, idx, root: m.root, m, pos: new THREE.Vector3(px, py, pz), cd: 0.8 + idx * 0.4, healCd: 4.5, facing: 0 });
  });
  g._companionMesh = g._companionMeshes[0] || null;
  return g._companionMesh;
}

export function tickCompanion3D(g, dt) {
  const list = Array.isArray(g._companionMeshes) && g._companionMeshes.length
    ? g._companionMeshes
    : (g._companionMesh ? [g._companionMesh] : []);
  const p = g.player;
  if (!list.length || !p || g.state !== 'play' || g.interior) return;

  // 尋找 13.5m 內最近的敵人
  let target = null, bestD = 13.5;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    if (d < bestD) { bestD = d; target = e; }
  }

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    c.cd = Math.max(0, c.cd - dt);
    c.healCd = Math.max(0, c.healCd - dt);
    const bond = getCompanionBondInfo(g.meta?.p, c.def.id);
    const side = i === 0 ? 1 : -1;

    // 跟隨玩家左右翼或迎戰目標
    const wantX = (c.def.id === 'vanguard' && target) ? target.pos.x : (p.pos.x - Math.sin(p.facing) * 2.1 + 1.35 * side);
    const wantZ = (c.def.id === 'vanguard' && target) ? target.pos.z : (p.pos.z - Math.cos(p.facing) * 2.1 + 0.9 * (i === 0 ? 1 : -0.6));
    const dx = wantX - c.pos.x, dz = wantZ - c.pos.z, dist = Math.hypot(dx, dz);
    if (dist > 14) {
      c.pos.set(p.pos.x + 1.6 * side, p.y, p.pos.z + 1.2);
    } else if (dist > 1.35) {
      const spd = 5.6;
      c.pos.x += (dx / dist) * spd * dt;
      c.pos.z += (dz / dist) * spd * dt;
      c.facing = Math.atan2(dx, dz);
    }
    c.pos.y = g.world.isLand(c.pos.x, c.pos.z) ? g.world.gh(c.pos.x, c.pos.z) : p.y;
    c.root.position.set(c.pos.x, c.pos.y + Math.abs(Math.sin(g.time * 8 + i * 2.1)) * (dist > 1.5 ? 0.08 : 0.02), c.pos.z);
    c.root.rotation.y = c.facing;

    // 治療師每 6.5 秒幫受傷玩家回血（隨羈絆等級成長）
    if (c.def.id === 'healer' && c.healCd <= 0 && p.hp < p.stats.maxHp * 0.88) {
      c.healCd = 6.5;
      const amt = Math.round(p.stats.maxHp * Math.min(0.32, 0.16 + (bond.lv - 1) * 0.018));
      g.heal(amt, true);
      g.fx.burst(p.pos.x, p.y + 1.0, p.pos.z, 12, { c: [0x7fe08a, 0xffe87a, 0xffffff], s: 0.12, speed: 3.5, up: 2.5, life: 0.5 });
      g.ui.dmgNum(c.pos.x, c.pos.y + 1.8, c.pos.z, `🪷 聖燈治癒 Lv.${bond.lv}!`, 'heal');
    }

    // 隊友攻擊邏輯（協助輸出與牽制，傷害隨羈絆等級成長）
    if (target && c.cd <= 0) {
      const tDist = Math.hypot(target.pos.x - c.pos.x, target.pos.z - c.pos.z);
      if (c.def.id === 'vanguard' && tDist < 2.8) {
        c.cd = 1.45;
        g.hitEnemy(target, g.rollDamage(0.55 * bond.mult, false), (target.pos.x - c.pos.x) * 2, (target.pos.z - c.pos.z) * 2, { stun: 0.45, isTrigger: true });
        g.fx.burst(target.pos.x, target.pos.y + 0.6, target.pos.z, 6, { c: [0x7ab8ff, 0xffffff], s: 0.1, speed: 3, life: 0.35 });
      } else if (c.def.id !== 'vanguard' && tDist < 12.5) {
        c.cd = c.def.id === 'ranger' ? 1.35 : 1.8;
        const d = new THREE.Vector2(target.pos.x - c.pos.x, target.pos.z - c.pos.z).normalize();
        g.fireProj(c.pos, d, {
          speed: 17, mult: (c.def.id === 'ranger' ? 0.55 : 0.42) * bond.mult,
          color: c.def.id === 'ranger' ? 0x7fe08a : 0xffd85a,
          size: 0.13, slow: c.def.id === 'ranger' ? 1.5 : 0, life: 1.0, isTrigger: true,
        });
      }
    }
  }
}
