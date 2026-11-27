// Phase B2：循序漸進系統解鎖、里程碑引導與地圖危險度評級

export const CORRUPT_UNLOCK_LV = 8;
export const ATLAS_UNLOCK_LV = 10;

export const PROGRESSION_MILESTONES = [
  { lv: 1,  title: '晨光草原啟程',         desc: '熟悉移動、揮擊、採集、屬性配點與物理背包' },
  { lv: 3,  title: '技能拼圖入門',         desc: '棋盤格擴充，可串聯第一顆輔助寶石' },
  { lv: 5,  title: 'T2 精鋼裝 · 藥劑上限 +1', desc: '開放 2 瓶藥劑與 T2 怪物素材鍛造，前往【低語森林】' },
  { lv: 8,  title: '鐵匠腐化改造解鎖',     desc: '開放裝備不可逆腐化賭博與進階強化共鳴' },
  { lv: 10, title: 'T1 坐騎馴養 · 異界地圖', desc: '達 60 殺可鍛造【林間巨鹿】鞍具，並解鎖 T3 星銀裝與異界地圖' },
  { lv: 12, title: '職業二轉覺醒試煉',     desc: '完成精英與專屬試煉後，於星燈祭壇覺醒二轉與 3D 招牌寶石' },
  { lv: 15, title: 'T2 雲絨角獸 · 深淵門檻', desc: '藥劑上限 3 瓶、T2 坐騎門檻，進軍 Lv.15+ 深淵抗性區域' },
  { lv: 20, title: 'T3 星翼浮鰩解鎖門檻',  desc: '二轉＋討伐守護獸 2 次可鍛造低空懸浮坐騎' },
  { lv: 25, title: 'T4 櫻風神狐 · 終局遠征', desc: '探索 12 區＋300 殺可鍛造頂級坐騎，進軍紅楓工坊與深淵古堡' },
];

// Enemy scaling uses the encounter level; attack pacing follows the character.
const LEGACY_PACE = { attacksPerSecond: 1.45, cooldown: 1, recovery: 0, damage: 1, manaRegen: 1, animation: 1, enemyHp: 1, enemyDamage: 1 };
const EARLY_PACE = { attacksPerSecond: 0.94, cooldown: 1.55, recovery: 0.9, damage: 0.82, manaRegen: 0.66, animation: 0.75, enemyHp: 1.22, enemyDamage: 1.30 };
const MID_PACE = { attacksPerSecond: 1.10, cooldown: 1.35, recovery: 0.72, damage: 0.90, manaRegen: 0.79, animation: 0.84, enemyHp: 1.16, enemyDamage: 1.22 };
const LATE_PACE = { attacksPerSecond: 1.25, cooldown: 1.18, recovery: 0.55, damage: 0.97, manaRegen: 0.90, animation: 0.92, enemyHp: 1.12, enemyDamage: 1.16 };

export function combatPace(level = 1, fixedBenchmark = false) {
  if (fixedBenchmark) return LEGACY_PACE;
  if (level <= 5) return EARLY_PACE;
  if (level <= 10) return MID_PACE;
  return LATE_PACE;
}

export function getFieldDanger(fieldLevel, playerLevel = 1) {
  const diff = (fieldLevel || 1) - (playerLevel || 1);
  if (diff >= 6) {
    return {
      tier: 'danger',
      icon: '🔴',
      label: `極危 (高出 ${diff} 級)`,
      short: '極危',
      color: '#c83434',
      desc: '越級警戒：敵方具 45% 減傷且傷害 ×1.5，建議升級或強化裝備後再挑戰',
      xpBonus: 0,
      redZone: true,
    };
  }
  if (diff >= 3) {
    return {
      tier: 'challenge',
      icon: '🟠',
      label: `挑戰 (+25% XP)`,
      short: '挑戰',
      color: '#d97a26',
      desc: '略高於目前等級，手動擊殺可獲得 +25% 越級經驗獎勵',
      xpBonus: 0.25,
      redZone: false,
    };
  }
  if (diff <= -3) {
    return {
      tier: 'easy',
      icon: '🟢',
      label: '輕鬆巡遊',
      short: '輕鬆',
      color: '#2f8a58',
      desc: '適合輕鬆採集素材或開啟提燈自動巡遊',
      xpBonus: 0,
      redZone: false,
    };
  }
  return {
    tier: 'normal',
    icon: '🟡',
    label: '適中推薦',
    short: '適中',
    color: '#a87d28',
    desc: '與目前等級相符的推薦探險區域',
    xpBonus: 0,
    redZone: false,
  };
}

export function canCorruptGear(g) {
  if (g?.dev?.on) return true;
  return (g?.meta?.p?.level || 1) >= CORRUPT_UNLOCK_LV;
}

export function nextMilestone(playerLevel = 1) {
  return PROGRESSION_MILESTONES.find(m => m.lv > playerLevel) || null;
}

export function milestoneText(lv) {
  const hit = PROGRESSION_MILESTONES.find(m => m.lv === lv);
  return hit ? `🎯 里程碑解鎖：${hit.title} — ${hit.desc}` : null;
}

/** P0 漸近護甲減傷公式：Armor / (Armor + 80)，硬上限 72% */
export function effectiveArmorMitigation(armor = 0) {
  const a = Math.max(0, armor || 0);
  return Math.min(0.72, a / (a + 80));
}

/** P0 攻速軟／硬上限：80% 以內線性，80% 以上折半，硬上限 120% */
export function effectiveAttackSpeed(rawAtkSpd = 0) {
  const r = Math.max(-50, rawAtkSpd || 0);
  return r <= 80 ? r : Math.min(120, +(80 + (r - 80) * 0.5).toFixed(2));
}

/** P0 暴擊溢位 1:1 轉暴傷；強制暴擊期間額外將基礎暴擊率（上限 100%）的 50% 轉為暴傷 */
export function effectiveCritProfile(rawCrit = 0, baseCritMult = 150, forceCrit = false) {
  const rc = Math.max(0, rawCrit || 0);
  const normalOverflow = Math.max(0, rc - 100);
  const forcedBonus = forceCrit ? Math.round(Math.min(100, rc) * 0.5) : 0;
  return {
    chance: forceCrit ? 100 : Math.min(100, rc),
    critMult: baseCritMult + normalOverflow + forcedBonus,
    overflow: normalOverflow + forcedBonus,
  };
}

/** P0 前期怪物倍率平滑化：Lv.1-4 1.15x/1.10x，Lv.5-14 線性爬升至 1.60x/1.45x，Lv.15+ 維持終局標準 */
export function enemyStageMultipliers(lv = 1) {
  const n = Math.max(1, lv || 1);
  if (n <= 4) return { hpMul: 1.15, dmgMul: 1.10 };
  if (n >= 15) return { hpMul: 1.60, dmgMul: 1.45 };
  const t = (n - 4) / 11;
  return {
    hpMul: +(1.15 + 0.45 * t).toFixed(3),
    dmgMul: +(1.10 + 0.35 * t).toFixed(3),
  };
}

/** P1 多重投射單發係數：單發 1.0×，多發時每發 0.78×（防止 proj+1 直接翻倍） */
export function multiProjDamageScale(count = 1) {
  return (count || 1) > 1 ? 0.78 : 1;
}

/** P1 CoH/CoC 邏輯電路防架空：消耗原技能 40% 法力，獨立冷卻 MAX(0.45s, 原 CD × 35%) */
export function triggerCircuitCostAndIcd(gemDef = {}) {
  const manaCost = Math.round((gemDef?.mana || 0) * 0.4);
  const icdMs = Math.round(Math.max(0.45, (gemDef?.cd || 0) * 0.35) * 1000);
  return { manaCost, icdMs };
}

/** 近戰非數值機制：普攻第 1 刀或翻滾後 0.45s 內附帶自動踏步貼身距離（公尺） */
export function meleeLungeDistance(comboStep = 1, postRollT = 0) {
  if ((postRollT || 0) > 0) return 2.0;
  return comboStep === 1 ? 1.6 : 0;
}

/** 星燈照域＋部位破壞效率：超出星燈光照圈無法累積部位破壞；近戰 1.5×、遠程燈圈內 0.85× */
export function partBreakEfficiency({ isMelee = false, dist = 0, lampRange = 9.0 } = {}) {
  if ((dist || 0) > (lampRange || 9.0)) return 0;
  return isMelee ? 1.5 : 0.85;
}

/** 精英外環風障（Proximity Shield）：結界外遠程投射物偏折剩 20%，踏入 4.5m 內全額命中 */
export function proximityShieldFactor(hasShield = false, shooterDist = 0, shieldRadius = 4.5) {
  if (!hasShield || (shooterDist || 0) <= (shieldRadius || 4.5)) return 1;
  return 0.2;
}

/** 首領外環星雷（Donut AoE）內圈安全區判定：貼身 0–3.5m 免傷 */
export function isInDonutSafeZone(dist = 0, innerRadius = 3.5) {
  return (dist || 0) <= (innerRadius || 3.5);
}

/** 遠程開火移速折減（走 A 操作紀律）：射擊瞬間移速降至 55% */
export function rangedMoveCommitScale(rangedCommitT = 0) {
  return (rangedCommitT || 0) > 0 ? 0.55 : 1;
}

/** 星燈照域破綻判定：超距盲射無法觸發破綻必暴，須近戰或於星燈圈內 */
export function canTriggerOpeningCrit(dist = 0, isMelee = false, lampRange = 9.0) {
  return !!isMelee || (dist || 0) <= (lampRange || 9.0);
}
