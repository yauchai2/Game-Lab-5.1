// 終局副本自訂系統（Endgame Atlas Map Crafter — 自由疊加怪物密度與賽季機制）
export const DENSITY_TIERS = [
  { id: 'normal', name: '標準生態', icon: '🌿', densityMult: 1.0, lootBonus: 0,    shardBonus: 0,    danger: 1, desc: '預設怪物波次數量，適合輕鬆刷圖。' },
  { id: 'swarm',  name: '魔物獸潮', icon: '🌊', densityMult: 1.6, lootBonus: 0.35, shardBonus: 0.35, danger: 2, desc: '怪物密度 ×1.6，掉寶與星砂收益 +35%。' },
  { id: 'abyss',  name: '煉獄印鈔機', icon: '🔥', densityMult: 2.3, lootBonus: 0.85, shardBonus: 0.75, danger: 3, desc: '怪物密度 ×2.3，海量怪群與 +85% 掉寶率！' },
];

export const LEAGUE_MECHANICS = [
  {
    id: 'vaal_rift', name: '腐化裂隙', icon: '☠️',
    desc: '精英必定出現並有 45% 機率直接掉落「已腐化異變神裝」；敵人傷害 +25%。',
    shardBonus: 0.40, lootBonus: 0.30, enemyDmg: 0.25, corruptDropChance: 0.45, danger: 2,
  },
  {
    id: 'soul_hunt', name: '靈魂狩獵', icon: '👻',
    desc: '怪物靈魂卡掉落機率 ×3，每層必定混入靈魂精英；敵人移速 +15%。',
    shardBonus: 0.25, lootBonus: 0.20, soulDropMult: 3.0, enemySpd: 0.15, danger: 1,
  },
  {
    id: 'double_shrine', name: '雙重祭壇', icon: '⚡',
    desc: '每層進場即自動獲得 30 秒狂怒／黃金祝福，加快清圖節奏；敵人移速 +20%。',
    shardBonus: 0.20, lootBonus: 0.30, startShrine: true, enemySpd: 0.20, danger: 1,
  },
  {
    id: 'gilded_vault', name: '貪婪寶庫', icon: '💰',
    desc: '掉落裝備階級 +2、高階稀有度暴增；敵人生命 +40%。',
    shardBonus: 0.35, lootBonus: 0.65, dropTierBonus: 2, enemyHp: 0.40, danger: 2,
  },
  {
    id: 'twin_boss', name: '雙王試煉', icon: '🦌',
    desc: '最終層同時迎戰 2 隻古樹鹿王！星砂 +80%、掉寶 +50%。',
    shardBonus: 0.80, lootBonus: 0.50, twinBoss: true, danger: 3,
  },
];

export function ensureAtlas(profile) {
  if (!profile.atlas || typeof profile.atlas !== 'object') {
    profile.atlas = { density: 'normal', mechanics: [] };
  }
  if (!DENSITY_TIERS.some(d => d.id === profile.atlas.density)) profile.atlas.density = 'normal';
  if (!Array.isArray(profile.atlas.mechanics)) profile.atlas.mechanics = [];
  return profile.atlas;
}

export function setAtlasDensity(profile, densityId) {
  if (!DENSITY_TIERS.some(d => d.id === densityId)) return false;
  const a = ensureAtlas(profile);
  a.density = densityId;
  return true;
}

export function toggleAtlasMechanic(profile, mechId) {
  if (!LEAGUE_MECHANICS.some(m => m.id === mechId)) return false;
  const a = ensureAtlas(profile);
  const idx = a.mechanics.indexOf(mechId);
  if (idx >= 0) a.mechanics.splice(idx, 1);
  else a.mechanics.push(mechId);
  return true;
}

export function computeAtlasSummary(atlasInput) {
  const a = atlasInput || { density: 'normal', mechanics: [] };
  const tier = DENSITY_TIERS.find(d => d.id === a.density) || DENSITY_TIERS[0];
  const activeMechs = LEAGUE_MECHANICS.filter(m => (a.mechanics || []).includes(m.id));
  let shardMult = 1 + tier.shardBonus;
  let lootBonus = tier.lootBonus;
  let soulDropMult = 1;
  let enemyHpMult = 1;
  let enemyDmgMult = 1;
  let enemySpdMult = 1;
  let dropTierBonus = 0;
  let corruptDropChance = 0;
  let startShrine = false;
  let twinBoss = false;
  let danger = tier.danger;

  for (const m of activeMechs) {
    shardMult += m.shardBonus || 0;
    lootBonus += m.lootBonus || 0;
    if (m.soulDropMult) soulDropMult *= m.soulDropMult;
    enemyHpMult += m.enemyHp || 0;
    enemyDmgMult += m.enemyDmg || 0;
    enemySpdMult += m.enemySpd || 0;
    dropTierBonus += m.dropTierBonus || 0;
    corruptDropChance = Math.max(corruptDropChance, m.corruptDropChance || 0);
    if (m.startShrine) startShrine = true;
    if (m.twinBoss) twinBoss = true;
    danger += m.danger || 1;
  }

  return {
    densityTier: tier,
    activeMechs,
    densityMult: tier.densityMult,
    shardMult: +shardMult.toFixed(2),
    lootBonus: +lootBonus.toFixed(2),
    soulDropMult: +soulDropMult.toFixed(2),
    enemyHpMult: +enemyHpMult.toFixed(2),
    enemyDmgMult: +enemyDmgMult.toFixed(2),
    enemySpdMult: +enemySpdMult.toFixed(2),
    dropTierBonus,
    corruptDropChance,
    startShrine,
    twinBoss,
    danger,
    dangerLabel: danger >= 7 ? '☠️ 毀滅印鈔機' : danger >= 4 ? '🔥 高壓刷寶' : danger >= 2 ? '⚡ 進階挑戰' : '🌿 輕鬆探索',
  };
}

// Phase M10A：異界秘石鑄造成本（標準 0 詞綴免費，高密度＋賽季疊加消耗金幣與星砂作為終局經濟回收槽）
export function atlasCraftCost(atlasInput) {
  const a = atlasInput || { density: 'normal', mechanics: [] };
  const mechCnt = (a.mechanics || []).length;
  const densTier = a.density === 'abyss' ? 2 : a.density === 'swarm' ? 1 : 0;
  if (densTier === 0 && mechCnt === 0) return { coins: 0, shards: 0, isFree: true };
  return {
    coins: densTier * 15 + mechCnt * 12,
    shards: densTier * 8 + mechCnt * 6,
    isFree: false,
  };
}
