import * as THREE from 'three';
import { buildPlayer, applyCosmetics, showWeapon } from './models.js';
import { makeItem } from './loot.js';

const SIM_HOODS = [
  [0x3a6a9a, 0x264a70], [0xb84848, 0x7c2a2a], [0x6e4a9e, 0x482d6e],
  [0x4c9a58, 0x306e3a], [0xd88a3a, 0x9c5a1e], [0x2f8a7e, 0x1e5c54],
  [0xc85a8a, 0x8a345a], [0x5872a8, 0x364a74], [0x9a7838, 0x6a4e20],
];

// ============================================================================
// 1. 四大生活副職業系統（Lv.1 → Lv.20：採集鍛造同步累積永久戰鬥與強化加成）
// ============================================================================
export const LIFE_SKILLS = {
  wood:  { id: 'wood',  icon: '🪓', name: '伐木師',   desc: '砍伐香杉木升級 · 每級：最大生命 +5 · 雙倍木材率 +2.5%' },
  ore:   { id: 'ore',   icon: '⛏️', name: '採礦師',   desc: '開採星紋礦升級 · 每級：減傷 +0.5% · 雙倍礦石率 +2.5%' },
  fish:  { id: 'fish',  icon: '🎣', name: '垂釣大師', desc: '垂釣溪銀魚升級 · 每級：法力上限 +3 · 回血 +0.15/秒 · 雙倍魚獲 +2.5%' },
  smith: { id: 'smith', icon: '🔨', name: '鍛造宗師', desc: '精煉／鍛造／鑲嵌升級 · 每級：基礎傷害 +0.8 · 精煉成功率 +0.8%' },
};
export const LIFE_SKILL_IDS = Object.keys(LIFE_SKILLS);
export const MAX_LIFE_LV = 20;

export function lifeXpForLevel(lv = 1) {
  const n = Math.max(1, Math.floor(lv || 1));
  return 35 + (n - 1) * 28;
}

export function ensureLifeSkills(profile) {
  if (!profile) return {};
  if (!profile.lifeSkills || typeof profile.lifeSkills !== 'object') profile.lifeSkills = {};
  for (const id of LIFE_SKILL_IDS) {
    const rec = profile.lifeSkills[id];
    if (!rec || typeof rec !== 'object') profile.lifeSkills[id] = { lv: 1, xp: 0 };
    else {
      rec.lv = Math.max(1, Math.min(MAX_LIFE_LV, Math.floor(rec.lv || 1)));
      rec.xp = Math.max(0, Math.floor(rec.xp || 0));
    }
  }
  return profile.lifeSkills;
}

export function getLifeSkillInfo(profile, id) {
  const ls = ensureLifeSkills(profile);
  const rec = ls[id] || { lv: 1, xp: 0 };
  const need = rec.lv >= MAX_LIFE_LV ? 0 : lifeXpForLevel(rec.lv);
  return {
    id,
    def: LIFE_SKILLS[id],
    lv: rec.lv,
    xp: rec.xp,
    need,
    prog: need ? Math.min(1, rec.xp / need) : 1,
    doubleChance: Math.min(0.5, (rec.lv - 1) * 0.025),
    enhanceBonus: id === 'smith' ? Math.min(0.16, +((rec.lv - 1) * 0.008).toFixed(4)) : 0,
  };
}

export function grantLifeXp(profile, id, amount = 12) {
  if (!profile || !LIFE_SKILLS[id] || amount <= 0) return null;
  const ls = ensureLifeSkills(profile);
  const rec = ls[id];
  if (rec.lv >= MAX_LIFE_LV) return null;
  rec.xp += Math.round(amount);
  let leveled = false;
  while (rec.lv < MAX_LIFE_LV && rec.xp >= lifeXpForLevel(rec.lv)) {
    rec.xp -= lifeXpForLevel(rec.lv);
    rec.lv++;
    leveled = true;
  }
  if (rec.lv >= MAX_LIFE_LV) rec.xp = 0;
  return leveled ? { id, def: LIFE_SKILLS[id], lv: rec.lv } : null;
}

export function computeLifeSkillBonuses(profile) {
  const ls = ensureLifeSkills(profile);
  const w = Math.max(0, (ls.wood?.lv || 1) - 1);
  const o = Math.max(0, (ls.ore?.lv || 1) - 1);
  const f = Math.max(0, (ls.fish?.lv || 1) - 1);
  const sm = Math.max(0, (ls.smith?.lv || 1) - 1);
  return {
    maxHp: w * 5,
    armor: +(o * 0.5).toFixed(1),
    mana: f * 3,
    regen: +(f * 0.15).toFixed(2),
    baseDmg: Math.floor(sm * 0.8),
    enhanceRateBonus: Math.min(0.16, +(sm * 0.008).toFixed(4)),
  };
}

// ============================================================================
// 2. 裝備符文石鑲嵌系統（6 種符文石：野外／世界王／日課寶箱掉落，鐵匠鋪鑲嵌）
// ============================================================================
export const RUNE_DEFS = {
  fire:    { id: 'fire',    icon: '🔥', name: '熾焰符文石', color: '#ff7a3a', desc: '基礎傷害 +4 · 附加火焰傷害 +5', bonuses: { baseDmg: 4, addFire: 5 } },
  thunder: { id: 'thunder', icon: '⚡', name: '雷鳴符文石', color: '#ffd85a', desc: '攻擊速度 +8% · 暴擊率 +4%',    bonuses: { atkSpd: 8, crit: 4 } },
  ice:     { id: 'ice',     icon: '❄️', name: '寒霜符文石', color: '#7ae8ff', desc: '最大生命 +32 · 寒冰抗性 +14%', bonuses: { maxHp: 32, resIce: 14 } },
  stone:   { id: 'stone',   icon: '🪨', name: '磐岩符文石', color: '#b8a898', desc: '減傷 +5% · 全元素抗性 +8%',     bonuses: { armor: 5, allRes: 8 } },
  wind:    { id: 'wind',    icon: '💨', name: '疾風符文石', color: '#7fe08a', desc: '移動速度 +7% · 冷卻縮減 +6%',   bonuses: { moveSpd: 7, cdr: 6 } },
  greed:   { id: 'greed',   icon: '💰', name: '貪婪符文石', color: '#ffe47a', desc: '擊殺金幣 +18% · 星砂掉落 +18%', bonuses: { coinBonus: 18, shardBonus: 18 } },
};
export const RUNE_IDS = Object.keys(RUNE_DEFS);

export function getRuneDef(runeId) {
  return runeId ? (RUNE_DEFS[runeId] || null) : null;
}

export function ensureRunes(profile) {
  if (!profile) return {};
  if (!profile.runes || typeof profile.runes !== 'object') profile.runes = {};
  return profile.runes;
}

export function rollRuneDrop(profile, isElite = false, isBoss = false, rng = Math.random) {
  if (!profile) return null;
  const chance = isBoss ? 0.55 : isElite ? 0.14 : 0.015;
  if (rng() >= chance) return null;
  const id = RUNE_IDS[Math.floor(rng() * RUNE_IDS.length) % RUNE_IDS.length];
  const count = isBoss && rng() < 0.35 ? 2 : 1;
  const bag = ensureRunes(profile);
  bag[id] = (bag[id] || 0) + count;
  return { id, def: RUNE_DEFS[id], count };
}

export function socketRune(profile, item, runeId) {
  if (!profile || !item) return { ok: false, reason: '無裝備可鑲嵌' };
  if (item.bricked) return { ok: false, reason: '已碎裂裝備無法鑲嵌符文' };
  const def = RUNE_DEFS[runeId];
  if (!def) return { ok: false, reason: '未知符文石' };
  const bag = ensureRunes(profile);
  if ((bag[runeId] || 0) < 1) return { ok: false, reason: `背包中沒有 ${def.icon} ${def.name}` };
  if (item.rune === runeId) return { ok: false, reason: '此裝備已鑲嵌相同符文石' };
  bag[runeId]--;
  item.rune = runeId;
  const lifeUp = grantLifeXp(profile, 'smith', 16);
  return { ok: true, def, lifeUp, msg: `💠 成功鑲嵌【${def.icon} ${def.name}】！（${def.desc}）` };
}

export function computeRuneBonuses(equip = {}) {
  const stats = { coinBonus: 0, shardBonus: 0 };
  let socketedCount = 0;
  for (const it of Object.values(equip || {})) {
    const def = getRuneDef(it?.rune);
    if (!def) continue;
    socketedCount++;
    for (const [k, v] of Object.entries(def.bonuses)) {
      stats[k] = (stats[k] || 0) + v;
    }
  }
  return { stats, socketedCount };
}

// ============================================================================
// 3. 12 種可收集稱號圖鑑（頭頂顯示＋每解鎖 1 個永久全傷害 +1% · 最大生命 +5）
// ============================================================================
export const TITLE_DEFS = [
  { id: 'novice',       icon: '🌱', name: '初出茅廬',     cond: '踏入燈谷展開冒險',                 check: () => true },
  { id: 'hunter',       icon: '⚔️', name: '百斬獵手',     cond: '累計擊殺 100 隻魔物',              check: p => (p.kills || 0) >= 100 },
  { id: 'slayer',       icon: '☠️', name: '精英剋星',     cond: '累計擊敗 10 隻詞綴精英怪',         check: p => (p.totalElites || 0) >= 10 },
  { id: 'rider',        icon: '🦌', name: '馴鹿騎士',     cond: '馴養並擁有至少 1 隻專屬坐騎',      check: p => (p.ownedMounts?.length || 0) >= 1 },
  { id: 'awakened',     icon: '✨', name: '覺醒勇者',     cond: '完成職業二轉覺醒試煉',             check: p => !!p.secondClass },
  { id: 'artisan',      icon: '🔨', name: '神匠宗師',     cond: '裝備強化至 +5 或鍛造宗師 Lv.5',    check: (p, ctx) => (p.lifeSkills?.smith?.lv || 1) >= 5 || Object.values(ctx?.equip || {}).some(it => (it?.enhance || 0) >= 5) },
  { id: 'gatherer',     icon: '🌿', name: '採集達人',     cond: '伐木＋採礦＋垂釣總等級達 10',      check: p => ((p.lifeSkills?.wood?.lv || 1) + (p.lifeSkills?.ore?.lv || 1) + (p.lifeSkills?.fish?.lv || 1)) >= 10 },
  { id: 'world_slayer', icon: '🐉', name: '世界王討伐者', cond: '擊敗 1 次野外世界王',              check: p => (p.worldBossKills || 0) >= 1 },
  { id: 'marshal',      icon: '🎖️', name: '公會元帥',     cond: '公會聲望達 360（遠征小隊長以上）', check: p => (p.guildRep || 0) >= 360 },
  { id: 'runemaster',   icon: '💠', name: '符文大師',     cond: '全身同時鑲嵌 2 顆以上符文石',      check: (_p, ctx) => Object.values(ctx?.equip || {}).filter(it => !!it?.rune).length >= 2 },
  { id: 'star_hero',    icon: '🌟', name: '星穹英雄',     cond: '旅人等級達到 Lv.20',               check: p => (p.level || 1) >= 20 },
  { id: 'lantern_king', icon: '👑', name: '燈谷傳奇',     cond: '解鎖 8 個以上稱號或達 Lv.28',      check: p => (p.unlockedTitles?.length || 0) >= 8 || (p.level || 1) >= 28 },
];

export function ensureTitles(profile) {
  if (!profile) return { unlocked: ['novice'], active: 'novice' };
  if (!Array.isArray(profile.unlockedTitles)) profile.unlockedTitles = ['novice'];
  if (!profile.unlockedTitles.includes('novice')) profile.unlockedTitles.unshift('novice');
  if (typeof profile.activeTitle === 'undefined') profile.activeTitle = 'novice';
  return { unlocked: profile.unlockedTitles, active: profile.activeTitle };
}

export function syncUnlockedTitles(profile, ctx = {}) {
  if (!profile) return [];
  ensureTitles(profile);
  const newly = [];
  for (const def of TITLE_DEFS) {
    if (profile.unlockedTitles.includes(def.id)) continue;
    if (def.check(profile, ctx)) {
      profile.unlockedTitles.push(def.id);
      newly.push(def);
    }
  }
  return newly;
}

export function equipTitle(profile, titleId) {
  if (!profile) return { ok: false };
  ensureTitles(profile);
  if (!titleId) {
    profile.activeTitle = null;
    return { ok: true, def: null };
  }
  if (!profile.unlockedTitles.includes(titleId)) return { ok: false, reason: '尚未解鎖此稱號' };
  profile.activeTitle = titleId;
  return { ok: true, def: TITLE_DEFS.find(t => t.id === titleId) || null };
}

export function computeTitleBonuses(profile) {
  const { unlocked } = ensureTitles(profile);
  const count = unlocked.length;
  return { count, dmgPct: count * 1, maxHp: count * 5 };
}

export function getActiveTitleText(profile) {
  if (!profile?.activeTitle) return '';
  const def = TITLE_DEFS.find(t => t.id === profile.activeTitle);
  return def ? `${def.icon} ${def.name}` : '';
}

// ============================================================================
// 4. 每日活躍度四段寶箱（0 → 100 活躍度：25 / 50 / 75 / 100，跨日自動重置）
// ============================================================================
export const DAILY_CHESTS = [
  { pt: 25,  icon: '🎁', name: '銅燈活躍箱', reward: { coins: 150, shards: 25, ore: 3, charms: 0, runes: 0 } },
  { pt: 50,  icon: '📦', name: '銀輝活躍箱', reward: { coins: 260, shards: 45, ore: 4, charms: 0, runes: 1 } },
  { pt: 75,  icon: '💎', name: '星芒活躍箱', reward: { coins: 420, shards: 75, ore: 6, charms: 1, runes: 1 } },
  { pt: 100, icon: '👑', name: '穹頂滿貫箱', reward: { coins: 700, shards: 130, ore: 10, charms: 2, runes: 2 } },
];

export function todayDateKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ensureDailyActivity(profile, now = new Date()) {
  if (!profile) return { date: todayDateKey(now), pts: 0, claimed: [] };
  const key = todayDateKey(now);
  if (!profile.dailyAct || profile.dailyAct.date !== key) {
    profile.dailyAct = { date: key, pts: 0, claimed: [] };
  }
  if (!Array.isArray(profile.dailyAct.claimed)) profile.dailyAct.claimed = [];
  return profile.dailyAct;
}

export function addDailyActivity(profile, pts = 2, now = new Date()) {
  if (!profile || pts <= 0) return null;
  const da = ensureDailyActivity(profile, now);
  const prev = da.pts;
  da.pts = Math.min(100, da.pts + Math.round(pts));
  const newlyReady = DAILY_CHESTS.filter(c => prev < c.pt && da.pts >= c.pt && !da.claimed.includes(c.pt));
  return { pts: da.pts, newlyReady };
}

export function claimDailyChest(profile, pt, rng = Math.random, now = new Date()) {
  if (!profile) return { ok: false };
  const da = ensureDailyActivity(profile, now);
  const def = DAILY_CHESTS.find(c => c.pt === pt);
  if (!def) return { ok: false, reason: '未知寶箱' };
  if (da.pts < pt) return { ok: false, reason: `今日活躍度需達 ${pt}（目前 ${da.pts}）` };
  if (da.claimed.includes(pt)) return { ok: false, reason: '今日已領取此寶箱' };
  da.claimed.push(pt);
  profile.coins = (profile.coins || 0) + def.reward.coins;
  profile.shards = (profile.shards || 0) + def.reward.shards;
  profile.mats = profile.mats || {};
  profile.mats.ore = (profile.mats.ore || 0) + def.reward.ore;
  profile.protectCharms = (profile.protectCharms || 0) + def.reward.charms;
  const gainedRunes = [];
  const bag = ensureRunes(profile);
  for (let i = 0; i < (def.reward.runes || 0); i++) {
    const rid = RUNE_IDS[Math.floor(rng() * RUNE_IDS.length) % RUNE_IDS.length];
    bag[rid] = (bag[rid] || 0) + 1;
    gainedRunes.push(RUNE_DEFS[rid]);
  }
  return { ok: true, def, reward: def.reward, gainedRunes };
}

// ============================================================================
// 5. 野外世界王討伐事件（定時降臨 / 號角召喚，S/A/B 貢獻度分級領寶箱！）
// ============================================================================
export const WORLD_BOSS_DEFS = [
  { id: 'ember_behemoth',  icon: '🔥', name: '【世界王】滅世炎岩巨獸', color: 0xff5a28, hpMult: 1.45, status: 'burn',   quote: '大地在熔岩巨步下震顫！所有冒險者立即集結！' },
  { id: 'frost_leviathan', icon: '❄️', name: '【世界王】極寒冰穹主宰', color: 0x62e8ff, hpMult: 1.40, status: 'freeze', quote: '暴雪席捲野外！極寒冰穹主宰降臨戰場！' },
  { id: 'storm_valkyrie',  icon: '⚡', name: '【世界王】蒼穹雷暴古王', color: 0xc88cff, hpMult: 1.42, status: 'shock',  quote: '萬雷撕裂雲海！蒼穹雷暴古王現身野外！' },
  { id: 'abyss_sovereign', icon: '👑', name: '【世界王】沉淵星核魔皇', color: 0xffd85a, hpMult: 1.55, status: 'poison', quote: '星核裂隙開啟！沉淵魔皇攜帶傳奇秘寶降臨！' },
];

export function createWorldBossState() {
  return { active: false, enemy: null, def: null, timer: 165, playerDmg: 0, totalDmg: 0, spawnedAt: 0 };
}

export function spawnWorldBoss(g, forcedIdx = null) {
  if (!g || !g.field || !g.world || !g.player) return null;
  g.worldBoss = g.worldBoss || createWorldBossState();
  if (g.worldBoss.active && g.worldBoss.enemy && !g.worldBoss.enemy.dead) return g.worldBoss.enemy;
  const def = WORLD_BOSS_DEFS[(forcedIdx != null ? forcedIdx : Math.floor(Math.random() * WORLD_BOSS_DEFS.length)) % WORLD_BOSS_DEFS.length];
  const ang = Math.random() * Math.PI * 2;
  let sx = g.player.pos.x + Math.cos(ang) * 15, sz = g.player.pos.z + Math.sin(ang) * 15;
  if (!g.world.isLand(sx, sz)) {
    const pt = g.world.randomWalkable(Math.random, g.player.pos, 12);
    sx = pt.x; sz = pt.z;
  }
  const sy = g.world.gh(sx, sz);
  const e = g.spawnEnemy('stag', { x: sx, z: sz }, true);
  e.isWorldBoss = true;
  e.wbDef = def;
  e.bossName = def.name;
  e.statusAffinity = def.status;
  e.hp = Math.round(e.hp * def.hpMult);
  e.maxHp = e.hp;
  e.m.root.scale.multiplyScalar(1.22);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.75, 28),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.userData.noNormal = true;
  e.m.root.add(ring);

  g.worldBoss = { active: true, enemy: e, def, timer: 210, playerDmg: 0, totalDmg: 0, spawnedAt: Date.now() };
  g.vfx?.spawnEnemyCircle(sx, sy, sz, 'fire', 1.4);
  g.vfx?.spawnWarning(sx, sy, sz, 1.6, 5.2, 'fire');
  g.vfx?.spawnMaliceRift(sx, sy, sz, 'death');
  g.audio?.sfx?.('tideHorn');
  g.ui?.banner?.(`${def.icon} ${def.name} 降臨！`, '參與討伐即可依傷害貢獻獲得 S / A / B 級世界王寶箱！');
  g.ui?.chat?.(`[世界公告] ${def.icon} ${def.quote}`);
  g.fx?.burst?.(sx, sy + 1.5, sz, 32, { c: [def.color, 0xffd85a, 0xffffff], s: 0.18, speed: 7, up: 5, life: 0.9 });
  return e;
}

export function onWorldBossHit(g, enemy, dmg, fromPlayer = true) {
  if (!enemy?.isWorldBoss || !g?.worldBoss?.active) return;
  g.worldBoss.totalDmg += Math.max(1, dmg);
  if (fromPlayer) g.worldBoss.playerDmg += Math.max(1, dmg);
}

export function computeWorldBossReward(playerDmg, totalDmg) {
  const share = totalDmg > 0 ? Math.min(1, playerDmg / totalDmg) : 1;
  if (share >= 0.45) return { grade: 'S', coins: 650, shards: 120, charms: 1, runes: 2, rep: 70, gearRarity: 3 };
  if (share >= 0.20) return { grade: 'A', coins: 420, shards: 80,  charms: 1, runes: 1, rep: 50, gearRarity: 2 };
  return { grade: 'B', coins: 240, shards: 45, charms: 0, runes: 1, rep: 30, gearRarity: 2 };
}

export function onWorldBossDefeated(g, enemy) {
  if (!enemy?.isWorldBoss || !g?.worldBoss?.active) return null;
  const wb = g.worldBoss;
  const res = computeWorldBossReward(wb.playerDmg, Math.max(1, wb.totalDmg));
  const p = g.meta?.p;
  if (p) {
    p.coins = (p.coins || 0) + res.coins;
    p.shards = (p.shards || 0) + res.shards;
    p.protectCharms = (p.protectCharms || 0) + res.charms;
    p.guildRep = (p.guildRep || 0) + res.rep;
    p.worldBossKills = (p.worldBossKills || 0) + 1;
    p.mMats = p.mMats || {};
    p.mMats.boss_heart = (p.mMats.boss_heart || 0) + 1;
    const bag = ensureRunes(p);
    for (let i = 0; i < res.runes; i++) {
      const rid = RUNE_IDS[Math.floor(Math.random() * RUNE_IDS.length)];
      bag[rid] = (bag[rid] || 0) + 1;
    }
    addDailyActivity(p, 25);
    g.meta.save();
  }
  const drop = makeItem(Math.random, Math.max(2, Math.floor((p?.level || 1) / 4) + 1), res.gearRarity);
  g.dropItem?.(enemy.pos.x, enemy.pos.z, drop);
  g.audio?.sfx?.('win');
  g.ui?.banner?.(`🏆 世界王討伐成功！【貢獻評級 ${res.grade}】`, `🪙+${res.coins} · 💎+${res.shards} · 👑巨獸星心+1 · 💠符文石×${res.runes}${res.charms ? ` · 🛡️保護符×${res.charms}` : ''}`);
  g.ui?.chat?.(`[世界公告] 冒險者「${g.playerName || '旅人'}」以 ${res.grade} 級貢獻擊潰了 ${wb.def.name}！`);
  g.worldBoss = createWorldBossState();
  return res;
}

export function tickWorldBoss(g, dt) {
  if (!g || !g.field || g.state !== 'play' || g.interior) return;
  g.worldBoss = g.worldBoss || createWorldBossState();
  const wb = g.worldBoss;
  if (wb.active) {
    if (!wb.enemy || wb.enemy.dead) {
      wb.active = false;
      wb.enemy = null;
      wb.timer = 180;
    }
    return;
  }
  wb.timer -= dt;
  if (wb.timer <= 0) {
    spawnWorldBoss(g);
  }
}

// ============================================================================
// 6. Phase M11：活生生的虛擬 MMO 玩家生態（18 人多樣外觀 × 城鎮據點 × 野外技能共鬥 × 互動壓測）
// ============================================================================
export const SIM_ADVENTURER_POOL = [
  { id: 'sim_1',  name: '晨風劍士', job: '守燈衛士', guild: '星燈旅團', title: '⚔️ 百斬獵手',  lv: 14, cp: 640,  hoodIdx: 0, weapon: 'shield', cos: { hat: 'crown',  back: 'lanterns', aura: 'gold'   }, color: 0x7ab8ff, role: 'melee',  gear: '星紋聖盾 +6',   lines: ['前面那群怪讓我來扛！', '剛強化到 +6 發金光啦！', '世界王快出了吧？'] },
  { id: 'sim_2',  name: '星語法師', job: '星語法師', guild: '星燈旅團', title: '💠 符文大師',  lv: 16, cp: 785,  hoodIdx: 2, weapon: 'staff',  cos: { hat: 'hood',   back: 'wings',    aura: 'violet' }, color: 0xd88aff, role: 'ranged', gear: '星輝秘杖 +7',   lines: ['熾焰符文石傷害超有感～', '一起刷這波精英嗎？', '剛掉了一顆雷鳴符文石！'] },
  { id: 'sim_3',  name: '影月遊俠', job: '影月遊俠', guild: '海風遠征軍', title: '🦌 馴鹿騎士', lv: 12, cp: 520,  hoodIdx: 3, weapon: 'bow',    cos: { hat: 'straw',  back: 'pack',     aura: 'ocean'  }, color: 0x7fe08a, role: 'ranged', gear: '疾風獵弓 +4',   lines: ['伐木升到 Lv.6 血量變厚好多！', '今日活躍度 100 領完收工！', '幫你補一箭！'] },
  { id: 'sim_4',  name: '赤焰鍛匠', job: '守燈衛士', guild: '楓林商會', title: '🔨 神匠宗師',  lv: 19, cp: 940,  hoodIdx: 4, weapon: 'blades', cos: { hat: 'beanie', back: 'lanterns', aura: 'gold'   }, color: 0xff9a4a, role: 'melee',  gear: '熔岩雙刃 +8',   lines: ['鍛造宗師 Lv.8 強化成功率超香！', '世界王出了記得叫我！', '公會懸賞差最後一隻精英～'] },
  { id: 'sim_5',  name: '霧花祭司', job: '聖光牧師', guild: '星燈旅團', title: '✨ 覺醒勇者',  lv: 21, cp: 1080, hoodIdx: 6, weapon: 'staff',  cos: { hat: 'crown',  back: 'wings',    aura: 'sakura' }, color: 0xff9ad0, role: 'ranged', gear: '櫻語聖杖 +7',   lines: ['血量低記得靠近我的光環喔！', '二轉覺醒儀式特效超帥～', '有缺補師刷副本嗎？'] },
  { id: 'sim_6',  name: '浪花船長', job: '影月遊俠', guild: '海風遠征軍', title: '🌿 採集達人', lv: 11, cp: 465,  hoodIdx: 5, weapon: 'bow',    cos: { hat: 'straw',  back: 'pack',     aura: 'ocean'  }, color: 0x62e8ff, role: 'ranged', gear: '珊瑚長弓 +3',   lines: ['海風港鎮的魚超級好釣！', '剛從珊瑚潮汐灣搭船回來～', '這波潮汐掉好多星砂！'] },
  { id: 'sim_7',  name: '夜影刺客', job: '秘術師',   guild: '星穹守護隊', title: '☠️ 精英剋星', lv: 23, cp: 1260, hoodIdx: 2, weapon: 'blades', cos: { hat: 'hood',   back: 'wings',    aura: 'violet' }, color: 0xb87aff, role: 'melee',  gear: '幽冥短刃 +9',   lines: ['冰凍接碎冰爆發直接秒精英！', '有人要衝試煉之塔 20F 嗎？', '剛剛洗出 SSR 潛能詞綴！'] },
  { id: 'sim_8',  name: '青蛙旅人', job: '守燈衛士', guild: '楓林商會', title: '🌱 初出茅廬',  lv: 5,  cp: 230,  hoodIdx: 3, weapon: 'shield', cos: { hat: 'frog',   back: 'pack',     aura: 'none'   }, color: 0x8ef07a, role: 'melee',  gear: '橡木圓盾 +1',   lines: ['大家好！剛來燈谷鎮報到～', '這隻小綿羊摸起來好軟！', '請問鐵匠鋪在右邊嗎？'] },
  { id: 'sim_9',  name: '琥珀學者', job: '星語法師', guild: '星穹守護隊', title: '🌟 星穹英雄', lv: 25, cp: 1480, hoodIdx: 8, weapon: 'staff',  cos: { hat: 'crown',  back: 'lanterns', aura: 'gold'   }, color: 0xffd85a, role: 'ranged', gear: '穹頂星杖 +9',   lines: ['本週星穹塔低重力週超好玩！', '6 門異界副本開刷！', '全服星燈光網我剛捐了 20 礦！'] },
  { id: 'sim_10', name: '雪嶺毛球', job: '聖光牧師', guild: '楓林商會', title: '🌿 採集達人',  lv: 13, cp: 570,  hoodIdx: 1, weapon: 'staff',  cos: { hat: 'beanie', back: 'pack',     aura: 'sakura' }, color: 0xffb8a0, role: 'ranged', gear: '暖爐法杖 +4',   lines: ['霜冬雪原好冷，快生營火！', '蘋果酒配甜莓合成超賺！', '大家一起拍張合照吧～'] },
  { id: 'sim_11', name: '雷鳴獵手', job: '影月遊俠', guild: '星穹守護隊', title: '🐉 世界王討伐者', lv: 27, cp: 1690, hoodIdx: 7, weapon: 'bow', cos: { hat: 'hood',   back: 'wings',    aura: 'ocean'  }, color: 0x7ae8ff, role: 'ranged', gear: '蒼穹雷弓 +10',  lines: ['世界王 S 級貢獻拿下！', '雷暴接積水連鎖清屏超爽！', '準備收隊回燈谷鎮清背包。'] },
  { id: 'sim_12', name: '楓葉鐵衛', job: '守燈衛士', guild: '楓林商會', title: '🎖️ 公會元帥',  lv: 22, cp: 1180, hoodIdx: 1, weapon: 'shield', cos: { hat: 'crown',  back: 'lanterns', aura: 'gold'   }, color: 0xff7a50, role: 'melee',  gear: '紅楓巨盾 +8',   lines: ['楓林商會收活人！公會經驗 +10%！', '一起組 3 人小隊開陣型光環！', '這套裝備共鳴亮起來真帥！'] },
  { id: 'sim_13', name: '珊瑚歌姬', job: '聖光牧師', guild: '海風遠征軍', title: '💠 符文大師', lv: 15, cp: 710,  hoodIdx: 5, weapon: 'staff',  cos: { hat: 'straw',  back: 'wings',    aura: 'ocean'  }, color: 0x6ef0e0, role: 'ranged', gear: '潮汐韻杖 +5',   lines: ['海邊的配樂聽起來好療癒～', '剛拿到青苔史萊姆之魂！', '有人要搭公共星舟去古樹林嗎？'] },
  { id: 'sim_14', name: '星火見習', job: '星語法師', guild: '散人',     title: '🌱 初出茅廬',  lv: 4,  cp: 195,  hoodIdx: 4, weapon: 'staff',  cos: { hat: 'beanie', back: 'none',     aura: 'none'   }, color: 0xffc878, role: 'ranged', gear: '櫸木短杖 +1',   lines: ['技能拼圖串起來傷害翻倍了！', '原來按 K 可以拼寶石！', '前輩們帶帶我打精英～'] },
  { id: 'sim_15', name: '暗月術士', job: '秘術師',   guild: '星穹守護隊', title: '👑 燈谷傳奇', lv: 29, cp: 1920, hoodIdx: 2, weapon: 'staff',  cos: { hat: 'crown',  back: 'wings',    aura: 'violet' }, color: 0xd06cff, role: 'ranged', gear: '沉淵星核杖 +10', lines: ['腐化出神話詞綴！手氣爆棚！', '28 級紅楓工坊谷刷起來！', '有萌新需要導師壓等帶副本嗎？'] },
  { id: 'sim_16', name: '青苔蛙俠', job: '秘術師',   guild: '海風遠征軍', title: '⚔️ 百斬獵手', lv: 17, cp: 830,  hoodIdx: 3, weapon: 'blades', cos: { hat: 'frog',   back: 'lanterns', aura: 'ocean'  }, color: 0x72e098, role: 'melee',  gear: '毒牙雙刃 +6',   lines: ['呱！雙刃攻速拉滿超絲滑！', '史萊姆靈魂翻滾留毒池真好用', '這波連擊 30 了！'] },
  { id: 'sim_17', name: '暖燈廚師', job: '守燈衛士', guild: '楓林商會', title: '🌿 採集達人',  lv: 9,  cp: 390,  hoodIdx: 8, weapon: 'shield', cos: { hat: 'straw',  back: 'pack',     aura: 'gold'   }, color: 0xffe480, role: 'melee',  gear: '鑄鐵鍋盾 +3',   lines: ['酒館主廚的蘋果酒超好喝！', '生營火共食回血超快～', '今天先逛城鎮休息一下！'] },
  { id: 'sim_18', name: '雲翼弓手', job: '影月遊俠', guild: '星燈旅團', title: '✨ 覺醒勇者',  lv: 20, cp: 1020, hoodIdx: 0, weapon: 'bow',    cos: { hat: 'hood',   back: 'wings',    aura: 'sakura' }, color: 0x8ad8ff, role: 'ranged', gear: '櫻風長弓 +7',   lines: ['滑翔空中射擊暴擊 1.5 倍！', '雲翼飛鰩之魂配弓箭無敵～', '一起去櫻花水都拍照吧！'] },
];

const TOWN_HUBS = [
  { label: '噴泉廣場閒聊', x: 0,    z: 2.5,  r: 4.2 },
  { label: '鐵匠鋪強化裝備', x: 10.2, z: -6.8, r: 2.8, forge: true },
  { label: '公會大廳接懸賞', x: -8.2, z: -2.2, r: 3.0 },
  { label: '拍賣行逛攤位', x: 8.5,  z: 4.6,  r: 3.0 },
  { label: '南碼頭看海等船', x: 0,    z: 21.5, r: 2.4 },
];

export const SIM_FIELD_TASKS = [
  { id: 'hunt',          icon: '⚔️', name: '討伐魔物懸賞', need: 6 },
  { id: 'elite_squad',   icon: '💀', name: '精英獵殺小隊', need: 2 },
  { id: 'gather',        icon: '🪓', name: '採集資源委託', need: 4 },
  { id: 'patrol',        icon: '🔵', name: '巡禮藍光檢查點', need: 3 },
  { id: 'dungeon_lfg',   icon: '⛩', name: '副本門口組隊喊人', need: 3 },
  { id: 'campfire_rest', icon: '🔥', name: '營火休整補給', need: 2 },
];

function collectFieldAnchors(g) {
  const anchors = { checkpoints: [], dungeon: null, gathers: [], camps: [], monsters: [] };
  for (const cp of g.checkpoints || []) anchors.checkpoints.push({ x: cp.x, z: cp.z, name: cp.name });
  for (const ex of g.exits || []) if (ex.type === 'dungeon') anchors.dungeon = { x: ex.x, z: ex.z };
  for (const sp of g.spots || []) {
    if (sp.mesh?.visible === false) continue;
    if (['wood', 'ore', 'fish', 'chest', 'field_quest'].includes(sp.kind) || String(sp.kind || '').startsWith('shrine_')) {
      anchors.gathers.push({ x: sp.x, z: sp.z, kind: sp.kind, label: sp.label || '資源點' });
    }
  }
  for (const cf of g.campfires || []) anchors.camps.push({ x: cf.x, z: cf.z });
  const alive = (g.enemies || []).filter(e => !e.dead);
  const step = Math.max(1, Math.floor(alive.length / 10));
  for (let i = 0; i < alive.length; i += step) anchors.monsters.push({ x: alive[i].pos.x, z: alive[i].pos.z, elite: !!alive[i].elite });
  return anchors;
}

function pickRandomFieldLand(g, near = null, minR = 12, maxR = 95) {
  const half = (g.world?.half || 90) * 0.84;
  for (let tries = 0; tries < 24; tries++) {
    let x, z;
    if (near) {
      const ang = Math.random() * Math.PI * 2;
      const rad = minR + Math.random() * Math.max(4, maxR - minR);
      x = near.x + Math.cos(ang) * rad;
      z = near.z + Math.sin(ang) * rad;
    } else {
      x = (Math.random() * 2 - 1) * half;
      z = (Math.random() * 2 - 1) * half;
    }
    if (!g.world || g.world.isLand(x, z)) return { x, z };
  }
  if (g.world?.randomWalkable) return g.world.randomWalkable(Math.random, g.player?.pos || { x: 0, z: 0 }, 8);
  return { x: (g.player?.pos?.x || 0) + 8, z: (g.player?.pos?.z || 0) + 8 };
}

export function assignSimTask(g, adv, forceId = null) {
  if (!g?.field) {
    const hub = TOWN_HUBS[adv.hubIdx >= 0 ? adv.hubIdx % TOWN_HUBS.length : 0];
    adv.task = { id: 'town_life', icon: '🏮', name: hub.label, have: 0, need: 3, targetPt: { x: hub.x, z: hub.z } };
    adv.activity = hub.label;
    return adv.task;
  }
  const anchors = collectFieldAnchors(g);
  const pool = [...SIM_FIELD_TASKS];
  if (!anchors.dungeon) pool.splice(pool.findIndex(t => t.id === 'dungeon_lfg'), 1);
  if (!anchors.checkpoints.length) pool.splice(pool.findIndex(t => t.id === 'patrol'), 1);
  const chosen = (forceId && SIM_FIELD_TASKS.find(t => t.id === forceId))
    || pool[Math.floor(Math.random() * pool.length)]
    || SIM_FIELD_TASKS[0];

  let targetPt = null;
  if (chosen.id === 'gather' && anchors.gathers.length) {
    const nd = anchors.gathers[Math.floor(Math.random() * anchors.gathers.length)];
    targetPt = { x: nd.x, z: nd.z, label: nd.label };
  } else if (chosen.id === 'patrol' && anchors.checkpoints.length) {
    const cp = anchors.checkpoints[Math.floor(Math.random() * anchors.checkpoints.length)];
    targetPt = { x: cp.x, z: cp.z, label: cp.name };
  } else if (chosen.id === 'dungeon_lfg' && anchors.dungeon) {
    targetPt = { x: anchors.dungeon.x + (Math.random() - 0.5) * 5, z: anchors.dungeon.z + (Math.random() - 0.5) * 5, label: '副本入口' };
  } else if (chosen.id === 'campfire_rest') {
    const src = anchors.camps[0] || anchors.checkpoints[Math.floor(Math.random() * Math.max(1, anchors.checkpoints.length))];
    targetPt = src ? { x: src.x + (Math.random() - 0.5) * 4, z: src.z + (Math.random() - 0.5) * 4 } : pickRandomFieldLand(g);
  } else if (anchors.monsters.length) {
    const m = anchors.monsters[Math.floor(Math.random() * anchors.monsters.length)];
    targetPt = { x: m.x, z: m.z };
  } else {
    targetPt = pickRandomFieldLand(g);
  }

  adv.task = { id: chosen.id, icon: chosen.icon, name: chosen.name, have: 0, need: chosen.need, targetPt, workT: 0 };
  adv.tx = targetPt.x;
  adv.tz = targetPt.z;
  adv.activity = `${chosen.icon} ${chosen.name} (0/${chosen.need})`;
  return adv.task;
}

function advanceSimTask(g, adv, delta = 1, notifyText = null) {
  if (!adv?.task) return false;
  adv.task.have = Math.min(adv.task.need, adv.task.have + delta);
  adv.activity = `${adv.task.icon} ${adv.task.name} (${adv.task.have}/${adv.task.need})`;
  if (notifyText && adv.bub) { adv.bub.textContent = notifyText; adv.sayT = 4.0; }
  if (adv.task.have >= adv.task.need) {
    adv.tasksDone = (adv.tasksDone || 0) + 1;
    adv.hopT = 0.5;
    if (adv.m?.root?.visible) {
      g.fx?.burst?.(adv.x, adv.y + 1.2, adv.z, 12, { c: [0xffd85a, 0x7fe08a, 0xffffff], s: 0.13, speed: 4.2, up: 4, life: 0.65 });
    }
    if (adv.bub) { adv.bub.textContent = `🎉 【${adv.task.name}】完成！換下一個委託～`; adv.sayT = 4.5; }
    assignSimTask(g, adv);
    return true;
  }
  return false;
}

export const DEFAULT_SIM_COUNT = 36;

export function getSimConfig(g) {
  if (!g) return { count: null, mode: 'ecosystem', worldChat: true };
  if (!g._simCfg) g._simCfg = { count: null, mode: 'ecosystem', worldChat: true };
  return g._simCfg;
}

export function setSimConfig(g, patch = {}) {
  const cfg = getSimConfig(g);
  Object.assign(cfg, patch);
  if ('count' in patch && !g?.interior) spawnSimAdventurers(g);
  return cfg;
}

export function getSimAdventurers(g) {
  return g?._simAdvs || [];
}

export function clearSimAdventurers(g) {
  if (!g?._simAdvs) return;
  for (const a of g._simAdvs) {
    if (a.m?.root) {
      g.scene?.remove(a.m.root);
      a.m.root.traverse(node => {
        node.geometry?.dispose();
        node.material?.dispose();
      });
    }
    a.tag?.remove?.();
    a.bub?.remove?.();
  }
  g._simAdvs = [];
}

export function spawnSimAdventurers(g) {
  clearSimAdventurers(g);
  if (!g || g.interior || g.state === 'title') return;
  if (!g.field && g.depth !== -1 && g.depth !== -2) return;
  const cfg = getSimConfig(g);
  const count = Math.max(0, Math.min(48, Math.floor(cfg.count ?? DEFAULT_SIM_COUNT)));
  g._simAdvs = [];
  if (count === 0) return;
  const anchors = g.field ? collectFieldAnchors(g) : null;
  const tagsRoot = typeof document !== 'undefined' ? document.getElementById('tags') : null;
  const taskCycle = ['hunt', 'elite_squad', 'gather', 'patrol', 'dungeon_lfg', 'campfire_rest', 'hunt', 'gather'];

  for (let i = 0; i < count; i++) {
    const baseDef = SIM_ADVENTURER_POOL[i % SIM_ADVENTURER_POOL.length];
    const suffix = i >= SIM_ADVENTURER_POOL.length ? `·${Math.floor(i / SIM_ADVENTURER_POOL.length) + 1}` : '';
    const def = suffix ? { ...baseDef, id: `${baseDef.id}_${i}`, name: baseDef.name + suffix } : baseDef;
    const hood = SIM_HOODS[def.hoodIdx % SIM_HOODS.length];
    const m = buildPlayer(hood[0], hood[1]);
    showWeapon(m, def.weapon || 'staff');
    if (def.cos) applyCosmetics(m, def.cos);
    m.root.scale.setScalar(1.08);

    const hub = !g.field ? TOWN_HUBS[i % TOWN_HUBS.length] : null;
    const ang = (i / Math.max(1, count)) * Math.PI * 2 + 0.45;
    let sx = 0, sz = 0;
    if (!g.field) {
      sx = hub.x + Math.cos(ang) * (1.2 + (i % 3) * 0.9);
      sz = hub.z + Math.sin(ang) * (1.2 + (i % 3) * 0.9);
    } else if (i < 5) {
      // 抵達時可在入口附近遇到冒險者，其餘人在全區活動。
      const pt = pickRandomFieldLand(g, g.player?.pos || { x: 0, z: 0 }, 5, 11);
      sx = pt.x; sz = pt.z;
    } else if (anchors?.checkpoints?.length && i % 4 === 0) {
      const cp = anchors.checkpoints[i % anchors.checkpoints.length];
      sx = cp.x + (Math.random() - 0.5) * 10; sz = cp.z + (Math.random() - 0.5) * 10;
    } else if (anchors?.dungeon && i % 7 === 0) {
      sx = anchors.dungeon.x + (Math.random() - 0.5) * 8; sz = anchors.dungeon.z + (Math.random() - 0.5) * 8;
    } else if (anchors?.gathers?.length && i % 3 === 0) {
      const nd = anchors.gathers[i % anchors.gathers.length];
      sx = nd.x + (Math.random() - 0.5) * 6; sz = nd.z + (Math.random() - 0.5) * 6;
    } else {
      // 均勻散佈在整張 240–400m 野外地圖各處
      const pt = pickRandomFieldLand(g);
      sx = pt.x; sz = pt.z;
    }
    if (g.world && !g.world.isLand(sx, sz)) {
      const pt = pickRandomFieldLand(g, g.player?.pos || { x: 0, z: 0 }, 8, 40);
      sx = pt.x; sz = pt.z;
    }
    const sy = g.world?.isLand(sx, sz) ? g.world.gh(sx, sz) : 0;
    m.root.position.set(sx, sy, sz);
    g.scene.add(m.root);

    const squadId = (g.field && i >= 6 && i < 15) ? Math.floor((i - 6) / 3) + 1 : 0;
    const adv = {
      def, m, tag: null, bub: null,
      x: sx, y: sy, z: sz, tx: sx, tz: sz, f: Math.random() * Math.PI * 2,
      walkT: 0, wait: 1.0 + (i % 5) * 1.1, atkCd: 0.8 + (i % 4) * 0.35, skillCd: 3.5 + (i % 5) * 1.2,
      sayT: 0, chatCd: 11 + i * 3.5, hopT: 0, forgeCd: 12 + i * 3,
      hubIdx: hub ? i % TOWN_HUBS.length : -1,
      squadId,
      tasksDone: 0,
      task: null,
      activity: g.field ? '野外任務中' : (hub?.label || '城鎮漫步'),
      following: false,
      _lodTick: i % 10,
      _bgT: (i % 5) * 0.4,
    };
    assignSimTask(g, adv, g.field ? (squadId ? 'elite_squad' : taskCycle[i % taskCycle.length]) : null);

    if (tagsRoot) {
      const tag = document.createElement('div');
      tag.className = 'ptag sim-adv';
      tag.title = `虛擬冒險者 ${def.name}（${def.job} · Lv.${def.lv}）`;
      tag.innerHTML = `<span class="sim-ti">[${def.title}]</span> ${def.name} <span class="sim-lv">Lv.${def.lv}</span>`;
      tag.onclick = ev => { ev.stopPropagation(); g.audio?.sfx?.('ui'); g.ui?.openSimInspect?.(g, adv); };
      const bub = document.createElement('div');
      bub.className = 'pbub';
      tagsRoot.append(tag, bub);
      adv.tag = tag;
      adv.bub = bub;
    }
    g._simAdvs.push(adv);
  }
}

export function onPlayerHelpSimKill(g, enemy) {
  const list = g?._simAdvs;
  if (!list?.length || !enemy?.pos) return 0;
  let helped = 0;
  const now = Date.now();
  for (const a of list) {
    if (!a.task || (a.task.id !== 'hunt' && a.task.id !== 'elite_squad')) continue;
    if (Math.hypot(a.x - enemy.pos.x, a.z - enemy.pos.z) > 15) continue;
    const completed = advanceSimTask(g, a, 1, `🙌 謝啦旅人！幫大忙了（${Math.min(a.task.need, a.task.have + 1)}/${a.task.need}）`);
    a.hopT = 0.45;
    helped++;
    if (now - (g._lastSimHelpRewardMs || 0) > 8000 && g.meta?.p) {
      g._lastSimHelpRewardMs = now;
      const coinGain = completed ? 18 : 8, shardGain = completed ? 4 : 2;
      g.meta.p.coins = (g.meta.p.coins || 0) + coinGain;
      g.meta.p.shards = (g.meta.p.shards || 0) + shardGain;
      g.ui?.toast?.(`🤝 協助 ${a.def.name} 推進任務！友誼回饋 +🪙${coinGain} · +✦${shardGain}`, '#7fe08a');
    }
    if (helped >= 2) break;
  }
  return helped;
}

export function assistSimTask(g, adv) {
  if (!g || !adv || !adv.task) return false;
  adv.hopT = 0.5;
  const done = advanceSimTask(g, adv, 1, '🤝 太感謝你幫忙解任務了！');
  if (g.meta?.p) {
    g.meta.p.coins = (g.meta.p.coins || 0) + (done ? 20 : 10);
    g.meta.p.shards = (g.meta.p.shards || 0) + (done ? 5 : 2);
    g.meta.save?.();
  }
  g.audio?.sfx?.(done ? 'classup' : 'pickup');
  g.ui?.toast?.(done ? `🎉 與 ${adv.def.name} 協力完成委託！獲得 +🪙20 · +✦5` : `🤝 協助 ${adv.def.name} 推進任務！獲得 +🪙10 · +✦2`, '#7fe08a');
  return true;
}

export function reactSimToPlayerEmote(g, emoteText = '嗨～') {
  const list = g?._simAdvs;
  if (!list?.length || !g.player) return 0;
  const replies = ['嗨嗨～一起冒險嗎！', '👋 哈囉旅人！', '✨ 裝備看起來很強喔！', '哈哈～祝你掉傳說裝！', '一起去打世界王吧！'];
  let n = 0;
  for (const a of list) {
    const d = Math.hypot(a.x - g.player.pos.x, a.z - g.player.pos.z);
    if (d > 12) continue;
    a.f = Math.atan2(g.player.pos.x - a.x, g.player.pos.z - a.z);
    a.hopT = 0.45;
    a.wait = Math.max(a.wait, 3.0);
    if (a.bub) {
      a.bub.textContent = n === 0 ? `${emoteText} ${replies[Math.floor(Math.random() * replies.length)]}` : replies[Math.floor(Math.random() * replies.length)];
      a.sayT = 4.2;
    }
    n++;
    if (n >= 4) break;
  }
  return n;
}

export function triggerSimEvent(g, kind) {
  const list = g?._simAdvs || [];
  if (!list.length) { g.ui?.toast?.('目前沒有虛擬玩家在場，請先調高人數', '#ffd85a'); return 0; }
  if (kind === 'enhance_wave') {
    for (const a of list.slice(0, 8)) {
      a.hopT = 0.5;
      if (a.bub) { a.bub.textContent = `✨ ${a.def.gear} 強化成功發金光！`; a.sayT = 4.5; }
      if (a.m?.root?.visible) g.fx?.burst?.(a.x, a.y + 1.1, a.z, 12, { c: [0xffd85a, 0xfff4b0, 0xff9a4a], s: 0.13, speed: 4.5, up: 4, life: 0.65 });
    }
    const star = list[0];
    g.ui?.addChat?.('', `[世界播報] ✨ ${star.def.name} 成功將【${star.def.gear}】精煉強化至滿光共鳴！`, true);
    g.audio?.sfx?.('classup');
    return list.length;
  }
  if (kind === 'chat_wave') {
    const picked = list.slice(0, 4);
    picked.forEach((a, idx) => {
      const line = a.def.lines[Math.floor(Math.random() * a.def.lines.length)];
      if (a.bub) { a.bub.textContent = line; a.sayT = 4.5; }
      if (idx < 3) g.ui?.addChat?.(`[${a.def.guild}] ${a.def.name}`, line, false, 'world');
    });
    g.audio?.sfx?.('chat');
    return picked.length;
  }
  if (kind === 'wave_me') {
    const p = g.player;
    if (!p) return 0;
    list.slice(0, 6).forEach((a, i) => {
      const ang = (i / 6) * Math.PI * 2;
      a.tx = p.pos.x + Math.cos(ang) * 3.8;
      a.tz = p.pos.z + Math.sin(ang) * 3.8;
      a.wait = 0;
      a.hopT = 0.45;
      if (a.bub) { a.bub.textContent = `👋 ${g.playerName || '旅人'} 一起組隊刷圖嗎？`; a.sayT = 4.5; }
    });
    g.audio?.sfx?.('emote');
    return Math.min(6, list.length);
  }
  return 0;
}

export function tickSimAdventurers(g, dt) {
  const list = g?._simAdvs;
  if (!list?.length || g.state !== 'play' || g.interior) return;
  const p = g.player;
  const cfg = getSimConfig(g);
  const nearSq = 32 * 32;
  const midSq = 55 * 55;
  const wbActive = !!(g.worldBoss?.active && g.worldBoss.enemy && !g.worldBoss.enemy.dead);
  const evActive = !!(g.dynEvent?.active && g.dynEvent.pos);

  for (let idx = 0; idx < list.length; idx++) {
    const a = list[idx];
    const pdx = p ? (p.pos.x - a.x) : 0;
    const pdz = p ? (p.pos.z - a.z) : 0;
    const distSq = pdx * pdx + pdz * pdz;
    const forceNear = !!(a.following || cfg.mode === 'gather');

    // Tier 3（>55m）：隱藏 3D Mesh（零渲染開銷），2Hz 輕量背景模擬座標與任務進度（小地圖仍即時移動！）
    if (!forceNear && distSq > midSq) {
      if (a.m?.root) a.m.root.visible = false;
      if (a.tag) a.tag.style.display = 'none';
      if (a.bub) a.bub.style.opacity = 0;
      a._bgT = (a._bgT || 0) + dt;
      if (a._bgT < 0.5) continue;
      const bdt = a._bgT;
      a._bgT = 0;
      if (wbActive && Math.hypot(g.worldBoss.enemy.pos.x - a.x, g.worldBoss.enemy.pos.z - a.z) < 85) {
        a.tx = g.worldBoss.enemy.pos.x + (Math.random() - 0.5) * 6;
        a.tz = g.worldBoss.enemy.pos.z + (Math.random() - 0.5) * 6;
        a.activity = '🐉 趕往討伐世界王';
      }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      if (d > 1.2) {
        const nx = a.x + (dx / d) * 3.8 * bdt, nz = a.z + (dz / d) * 3.8 * bdt;
        if (!g.world || g.world.isLand(nx, nz)) { a.x = nx; a.z = nz; }
        else { const pt = pickRandomFieldLand(g); a.tx = pt.x; a.tz = pt.z; }
      } else {
        a.task.workT = (a.task.workT || 0) + bdt;
        if (a.task.workT >= 4.5) {
          a.task.workT = 0;
          advanceSimTask(g, a, 1);
          const pt = pickRandomFieldLand(g, { x: a.x, z: a.z }, 8, 28);
          a.tx = pt.x; a.tz = pt.z;
        }
      }
      continue;
    }

    // Tier 2（32m–55m）：顯示 3D 身影（15Hz 節流更新，隱藏名牌避免畫面雜亂）
    const isMid = !forceNear && distSq > nearSq;
    let stepDt = dt;
    if (isMid) {
      a._lodTick = ((a._lodTick || 0) + 1) & 3;
      if (a._lodTick !== 0) continue;
      stepDt = Math.min(0.16, dt * 4);
      if (a.tag) a.tag.style.display = 'none';
      if (a.bub) a.bub.style.opacity = 0;
    }
    if (a.m?.root && !a.m.root.visible) a.m.root.visible = true;

    a.wait -= stepDt;
    a.atkCd = Math.max(0, a.atkCd - stepDt);
    a.skillCd = Math.max(0, (a.skillCd || 0) - stepDt);
    a.sayT = Math.max(0, a.sayT - stepDt);
    a.hopT = Math.max(0, (a.hopT || 0) - stepDt);
    a.chatCd -= stepDt;

    let target = null;
    if (g.field && g.enemies?.length && cfg.mode !== 'gather') {
      if (wbActive && (cfg.mode === 'boss' || Math.hypot(g.worldBoss.enemy.pos.x - a.x, g.worldBoss.enemy.pos.z - a.z) < 85)) {
        target = g.worldBoss.enemy;
        a.activity = '🐉 圍毆世界王中';
      } else if (a.following || a.task?.id === 'hunt' || a.task?.id === 'elite_squad' || cfg.mode === 'boss') {
        let bestD = a.following ? 14 : 20;
        for (const e of g.enemies) {
          if (e.dead || e.expeditionId || e.openingPractice || e.openingHidden) continue;
          const d = Math.hypot(e.pos.x - a.x, e.pos.z - a.z);
          const pref = (a.task?.id === 'elite_squad' && e.elite) ? d * 0.55 : d;
          if (pref < bestD) { bestD = pref; target = e; }
        }
      }
    }

    let moving = false;
    if (target) {
      const dx = target.pos.x - a.x, dz = target.pos.z - a.z, d = Math.hypot(dx, dz) || 1;
      a.f = Math.atan2(dx, dz);
      const wantDist = a.def.role === 'melee' ? 2.1 : 7.2;
      if (d > wantDist) {
        const nx = a.x + (dx / d) * 4.5 * stepDt, nz = a.z + (dz / d) * 4.5 * stepDt;
        if (g.world.isLand(nx, nz)) { a.x = nx; a.z = nz; moving = true; }
      }
      if (a.atkCd <= 0 && d <= wantDist + 2.4) {
        a.atkCd = a.def.role === 'melee' ? 1.45 : 1.65;
        const isSkill = a.skillCd <= 0;
        if (isSkill) a.skillCd = 4.5 + Math.random() * 2.5;
        const dmg = Math.max(3, Math.round((g.player?.stats?.baseDmg || 8) * (isSkill ? 0.85 : 0.45)));
        if (target.isWorldBoss) onWorldBossHit(g, target, dmg, false);
        target.hp -= dmg;
        target.flash = 0.1;
        if (!isMid) {
          g.fx?.burst?.(target.pos.x, target.pos.y + 0.7, target.pos.z, isSkill ? 10 : 5, { c: [a.def.color, 0xffffff], s: isSkill ? 0.13 : 0.1, speed: 4.2, life: 0.35 });
          if (a.def.role === 'ranged') {
            g.spawnBeam?.(a.x, a.y + 1.0, a.z, target.pos.x, target.pos.y + 0.8, target.pos.z, a.def.color);
          }
          if (isSkill && g.vfx) {
            const theme = a.def.job === '聖光牧師' ? 'lotus' : a.def.job === '星語法師' ? 'arcane' : a.def.job === '秘術師' ? 'death' : a.def.job === '影月遊俠' ? 'wind' : 'holy';
            g.vfx.spawnHitImpact?.(target.pos.x, target.pos.y || 0, target.pos.z, theme, true);
          }
        }
        if (target.hp <= 0) {
          g.killEnemy?.(target);
          if (a.task?.id === 'hunt' || a.task?.id === 'elite_squad') advanceSimTask(g, a, 1);
        }
      }
    } else if ((a.following || cfg.mode === 'gather') && p) {
      const ang = (idx / Math.max(1, list.length)) * Math.PI * 2 + (g.time || 0) * 0.25;
      const rad = a.following ? 3.2 : 4.2 + (idx % 3) * 1.4;
      const gx = p.pos.x + Math.cos(ang) * rad, gz = p.pos.z + Math.sin(ang) * rad;
      const dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz);
      a.activity = a.following ? '💚 小隊跟隨中' : '🧲 集結待命中';
      if (d > 0.85) {
        const spd = d > 10 ? 7.5 : 4.6;
        const nx = a.x + (dx / d) * spd * stepDt, nz = a.z + (dz / d) * spd * stepDt;
        if (g.world.isLand(nx, nz)) { a.x = nx; a.z = nz; a.f = Math.atan2(dx, dz); moving = true; }
      } else {
        a.f = Math.atan2(p.pos.x - a.x, p.pos.z - a.z);
      }
    } else {
      // 動態奇遇事件進行時，附近玩家前往支援
      if (evActive && Math.hypot(g.dynEvent.pos.x - a.x, g.dynEvent.pos.z - a.z) < 60) {
        a.tx = g.dynEvent.pos.x + (Math.random() - 0.5) * 6;
        a.tz = g.dynEvent.pos.z + (Math.random() - 0.5) * 6;
      }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      if (d < 0.9) {
        if (!g.field && a.hubIdx >= 0 && TOWN_HUBS[a.hubIdx]?.forge) {
          a.forgeCd = (a.forgeCd || 10) - stepDt;
          if (a.forgeCd <= 0) {
            a.forgeCd = 16 + Math.random() * 14;
            a.hopT = 0.4;
            g.fx?.burst?.(a.x, a.y + 1.0, a.z, 10, { c: [0xffd85a, 0xff9a4a, 0xffffff], s: 0.12, speed: 4, up: 3.5, life: 0.6 });
            if (a.bub) { a.bub.textContent = `✨ ${a.def.gear} 精煉發光啦！`; a.sayT = 3.8; }
          }
        }
        // 野外非戰鬥任務（採集／檢查點巡禮／副本喊人／營火休整）到達定點後推進進度
        if (g.field && a.task && ['gather', 'patrol', 'dungeon_lfg', 'campfire_rest'].includes(a.task.id)) {
          a.task.workT = (a.task.workT || 0) + stepDt;
          if (a.task.workT >= 3.2) {
            a.task.workT = 0;
            const note = a.task.id === 'gather' ? '⛏️ 採集到手！資源 +1'
              : a.task.id === 'patrol' ? '🔵 檢查點巡查完成，前往下一座！'
              : a.task.id === 'dungeon_lfg' ? '⛩ 副本缺 1 輸出！有秘石直接進！'
              : '🔥 營火回滿狀態，準備再出發～';
            if (!isMid && a.task.id === 'gather') g.fx?.burst?.(a.x, a.y + 0.8, a.z, 7, { c: [0x7fe08a, 0xffd85a], s: 0.1, speed: 3, up: 3, life: 0.45 });
            if (!advanceSimTask(g, a, 1, note)) {
              const pt = pickRandomFieldLand(g, { x: a.x, z: a.z }, 8, 28);
              a.tx = pt.x; a.tz = pt.z;
            }
          }
        } else if (a.wait <= 0) {
          a.wait = (cfg.mode === 'party' ? 2.2 : 4.0) + Math.random() * 4.5;
          if (!g.field) {
            if (Math.random() < 0.35) a.hubIdx = Math.floor(Math.random() * TOWN_HUBS.length);
            const hub = TOWN_HUBS[a.hubIdx >= 0 ? a.hubIdx : 0];
            a.activity = hub.label;
            const ang = Math.random() * Math.PI * 2, rad = 0.8 + Math.random() * hub.r;
            const nx = hub.x + Math.cos(ang) * rad, nz = hub.z + Math.sin(ang) * rad;
            if (g.world.isLand(nx, nz)) { a.tx = nx; a.tz = nz; }
          } else {
            const pt = pickRandomFieldLand(g, { x: a.x, z: a.z }, 8, 26);
            a.tx = pt.x; a.tz = pt.z;
          }
        }
      } else {
        const nx = a.x + (dx / d) * 3.4 * stepDt, nz = a.z + (dz / d) * 3.4 * stepDt;
        if (g.world.isLand(nx, nz)) { a.x = nx; a.z = nz; a.f = Math.atan2(dx, dz); moving = true; }
        else { const pt = pickRandomFieldLand(g, { x: a.x, z: a.z }, 6, 18); a.tx = pt.x; a.tz = pt.z; }
      }
    }

    if (a.chatCd <= 0) {
      a.chatCd = 22 + Math.random() * 24;
      const line = wbActive ? '🐉 世界王出現了！大家快集合輸出！'
        : a.task?.id === 'dungeon_lfg' ? '⛩ 副本門口組隊！有秘石一起刷嗎？'
        : a.def.lines[Math.floor(Math.random() * a.def.lines.length)];
      if (!isMid && a.bub) { a.bub.textContent = line; a.sayT = 4.2; }
      if (cfg.worldChat && Math.random() < 0.22) {
        g.ui?.addChat?.(`[${a.def.guild}] ${a.def.name}`, line, false, 'world');
      }
    }

    a.y = g.world?.isLand(a.x, a.z) ? g.world.gh(a.x, a.z) : 0;
    if (moving) a.walkT += stepDt * 11;
    const sw = Math.sin(a.walkT);
    const hopY = a.hopT > 0 ? Math.sin((a.hopT / 0.45) * Math.PI) * 0.55 : 0;
    a.m.root.position.set(a.x, a.y + (moving ? Math.abs(sw) * 0.06 : 0) + hopY, a.z);
    a.m.root.rotation.y = a.f;
    if (a.m.legL) a.m.legL.position.z = moving ? sw * 0.12 : 0;
    if (a.m.legR) a.m.legR.position.z = moving ? -sw * 0.12 : 0;

    if (!isMid && a.tag && g.ui?.screenPos) {
      const showTag = !!(a.following || distSq <= 8.5 * 8.5);
      if (!showTag) {
        a.tag.style.display = 'none';
        if (a.bub) a.bub.style.opacity = 0;
      } else {
        const [sx, sy] = g.ui.screenPos(a.x, a.y + 2.15 + hopY, a.z);
        const vis = sx > -120 && sx < (typeof innerWidth !== 'undefined' ? innerWidth + 120 : 2000) && sy > -80 && sy < (typeof innerHeight !== 'undefined' ? innerHeight + 80 : 2000);
        a.tag.style.display = vis ? 'block' : 'none';
        a.tag.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-100%)`;
        a.tag.classList.toggle('following', !!a.following);
        if (a.bub) {
          a.bub.style.transform = `translate(${sx}px, ${sy - 22}px) translate(-50%,-100%)`;
          a.bub.style.opacity = vis && a.sayT > 0 ? 1 : 0;
        }
      }
    }
  }
}
