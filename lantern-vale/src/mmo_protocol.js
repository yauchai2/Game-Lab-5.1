// Phase M1：MMO 共享通訊協定、速度包絡線反作弊校驗、共享標記與提燈油量管理
// 此模組採純函式設計，可同時被瀏覽器前端與 Node.js 權威伺服器複用

export const PROTOCOL_VERSION = 1;

export const MSG = {
  HELLO:        'hello',
  POS:          'pos',
  INTENT_SKILL: 'intent_skill',
  INTENT_LOOT:  'intent_loot',
  TIDE_KILL:    'tide_kill',
  ZONE_SNAP:    'snap',
  TIDE_SYNC:    'tide_sync',
  HOTSPOT_SYNC: 'hotspot_sync',
  SYNERGY_PROC: 'synergy_proc',
  PARTY_REVIVE: 'party_revive',
};

// 每日提燈油量（MMO 模式下防 24 小時掛機工作室；單機模式不受限）
export const OIL_DAILY_SECONDS = 7200; // 2 小時免費額度
export const OIL_QUEST_REFILL  = 1800; // 完成手動每日委託 +30 分鐘

export function ensureLanternOil(profile, dayKey = new Date().toISOString().slice(0, 10)) {
  if (!profile.lanternOil || profile.lanternOil.day !== dayKey) {
    profile.lanternOil = { day: dayKey, remaining: OIL_DAILY_SECONDS };
  }
  return profile.lanternOil;
}

export function consumeLanternOil(profile, dtSec, dayKey) {
  const oil = ensureLanternOil(profile, dayKey);
  oil.remaining = Math.max(0, oil.remaining - Math.max(0, dtSec));
  return oil.remaining;
}

export function refillLanternOil(profile, bonusSec = OIL_QUEST_REFILL, dayKey) {
  const oil = ensureLanternOil(profile, dayKey);
  oil.remaining = Math.min(OIL_DAILY_SECONDS * 1.5, oil.remaining + bonusSec);
  return oil.remaining;
}

/**
 * 速度包絡線反作弊校驗（Velocity Envelope）
 * 允許冰湖滑冰、滑沙、低重力與翻滾的寬鬆前端預測，但攔截加速外掛／瞬移
 */
export function validateMoveDelta(prev, next, dtSec, ctx = {}) {
  const dt = Math.max(0.05, Math.min(2.0, dtSec || 0.1));
  const dx = (next.x || 0) - (prev.x || 0);
  const dz = (next.z || 0) - (prev.z || 0);
  const dist = Math.hypot(dx, dz);

  let maxSpeed = 8.2; // 基礎移動 + 疾步上限
  if (ctx.mounted) maxSpeed *= 1.48;
  if (ctx.terrain === 'ice_lake') maxSpeed *= 1.42;
  if (ctx.realmRule === 'sand_surf') maxSpeed *= 1.26;
  if (ctx.realmRule === 'low_gravity') maxSpeed *= 1.18;
  if (ctx.rolling) maxSpeed *= 1.55;
  // 預留 25% 網路抖動寬容度避免誤拉回（Rubber-banding）
  const allowedDist = maxSpeed * dt * 1.25 + 0.85;

  if (dist <= allowedDist) {
    return { ok: true, dist, allowedDist, violation: 0 };
  }
  const ratio = dist / allowedDist;
  return {
    ok: false,
    dist,
    allowedDist,
    violation: Math.min(10, Math.round((ratio - 1) * 5 * 10) / 10),
    clamped: {
      x: (prev.x || 0) + (dx / dist) * allowedDist,
      z: (prev.z || 0) + (dz / dist) * allowedDist,
    },
  };
}

/**
 * 共享標記與個人獨立掉落資格（Shared Tagging & Personal Loot）
 * 凡對目標造成 >= 3% 最大生命傷害的玩家，皆獲得 100% 獨立經驗與個人戰利品
 */
export function resolveLootRecipients(damageMap, enemyMaxHp, minShare = 0.03) {
  if (!damageMap || !enemyMaxHp || enemyMaxHp <= 0) return [];
  const threshold = Math.max(1, enemyMaxHp * minShare);
  const eligible = [];
  for (const [playerId, dmg] of Object.entries(damageMap)) {
    if (dmg >= threshold) eligible.push(playerId);
  }
  return eligible;
}

/**
 * 跨玩家元素協同連攜結算（Non-destructive Co-op Synergy）
 */
export function resolveCoopSynergy(casterId, surfaceOwnerId) {
  if (!surfaceOwnerId || surfaceOwnerId === casterId) {
    return { isCoop: false, dmgMult: 1.0, assistScore: 0 };
  }
  return {
    isCoop: true,
    dmgMult: 1.15,
    assistScore: 10,
    banner: '✨ 跨玩家協同連攜！傷害 +15%',
  };
}

/**
 * 三層星圖巡迴聚焦熱點（前後端確定性同步演算法，每 30 分鐘輪換 2 座熱門島嶼）
 */
export function pickHotspots(nowMs = Date.now(), totalFields = 20) {
  const slot = Math.floor(nowMs / (30 * 60 * 1000));
  const fieldA = ((slot * 7 + 3) % totalFields) + 1;
  let fieldB = ((slot * 13 + 9) % totalFields) + 1;
  if (fieldB === fieldA) fieldB = (fieldB % totalFields) + 1;
  const nextSwitchMs = (slot + 1) * 30 * 60 * 1000;
  return {
    slot,
    nextSwitchMs,
    hotspots: [
      { fieldId: fieldA, kind: 'gold_tide',  name: '🔥 餘燼金潮',   bonus: '經驗＆掉寶 +40%' },
      { fieldId: fieldB, kind: 'food_night', name: '🍗 旅人美食夜市', bonus: '營火料理 Buff +50%' },
    ],
  };
}

export function getFieldHotspot(fieldId, activePayload = null) {
  if (!fieldId) return null;
  const data = activePayload || pickHotspots();
  return (data.hotspots || []).find(h => h.fieldId === fieldId) || null;
}

// Phase M4A：6×6 拼圖邏輯電路防炸服保護（強制 250ms ICD + 投射物上限過載折算）
export const PUZZLE_ICD_MS = 250;
export const MAX_ACTIVE_PROJECTILES = 16;

export function checkTriggerIcd(icdMap, triggerKey, nowMs = Date.now(), icdMs = PUZZLE_ICD_MS) {
  const last = icdMap.get(triggerKey) || 0;
  if (nowMs - last < icdMs) return false;
  icdMap.set(triggerKey, nowMs);
  return true;
}

export function foldExcessProjectiles(activeCount, requestedCount, maxActive = MAX_ACTIVE_PROJECTILES) {
  const room = Math.max(0, maxActive - activeCount);
  const spawnCount = Math.min(requestedCount, room);
  const overflow = Math.max(0, requestedCount - spawnCount);
  // 超出上限的投射物不生成實體，直接折算為「過載傷害倍率」保護伺服器 Tick
  const overloadMult = overflow > 0 ? Math.round((1 + (overflow / Math.max(1, spawnCount)) * 0.85) * 100) / 100 : 1.0;
  return { spawnCount, overflow, overloadMult };
}

// Phase M4C：溫馨高光徽章（Cozy MVP Badges — 取代內捲 DPS 傷害榜）
export function computeCozyMvps(stats = {}) {
  const badges = [];
  if ((stats.synergyProcs || 0) >= 1) badges.push({ icon: '🔥', title: '連攜發動機', detail: `觸發 ${stats.synergyProcs} 次元素連攜` });
  if ((stats.partsBroken || 0) >= 1)  badges.push({ icon: '🦌', title: '精準破位王', detail: `破壞 ${stats.partsBroken} 處強敵部位` });
  if ((stats.campfires || 0) >= 1)    badges.push({ icon: '🍗', title: '營火大廚',   detail: `生起 ${stats.campfires} 座溫暖營火` });
  if ((stats.healsDone || 0) >= 30 || (stats.dmgMitigated || 0) >= 40) {
    badges.push({ icon: '🏮', title: '救命提燈人', detail: '穩健守護隊伍續航' });
  }
  if (!badges.length) badges.push({ icon: '🌿', title: '星燈探索者', detail: '平安完成本次燈谷探險' });
  return badges;
}
