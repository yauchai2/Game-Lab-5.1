// A paid expedition ticket stays tied to the character until the run is cleared.
export const MEADOW_CAVE = {
  normal: {
    name: '普通', level: 3, xp: 275, coins: 75, firstCoins: 40, firstMaterials: 3, materials: 1,
    stages: [
      { name: '洞口巡哨', hint: '閃過黏怪落點，靠近棘芽射手。', enemies: ['slime', 'thorn'] },
      { name: '岔道伏擊', hint: '側閃衝鋒，趁狂豬露出破綻反擊。', enemies: ['boar', 'thorn'], boarChargeRecoveryS: 1.25 },
      { name: '碎石獠牙', hint: '離開重踏範圍，等首領收招再反擊。', enemies: ['boar'], champion: true },
    ],
  },
  elite: {
    name: '精英', level: 5, xp: 400, coins: 100, firstCoins: 60, firstMaterials: 4, materials: 2,
    stages: [
      { name: '洞口夾擊', hint: '閃過落點後，優先處理遠程威脅。', enemies: ['slime', 'slime', 'thorn'] },
      { name: '雙線伏擊', hint: '觀察兩隻野豬的衝鋒方向，留出退路。', enemies: ['boar', 'boar', 'thorn'] },
      { name: '碎石獠牙・精英', hint: '大範圍重踏和直線衝鋒會交替出現。', enemies: ['boar'], champion: true },
    ],
  },
};

export function meadowCaveProgress(profile) {
  return profile.meadowCave || { active: null, clears: {} };
}

export function enterMeadowCave(profile, tier) {
  if (!Object.hasOwn(MEADOW_CAVE, tier)) return null;
  const progress = meadowCaveProgress(profile);
  if (progress.active) return progress.active.tier === tier ? progress.active : null;
  if (!(profile.keys >= 1) || (tier === 'elite' && !progress.clears.normal)) return null;
  profile.keys--;
  progress.active = { tier, stage: 0 };
  profile.meadowCave = progress;
  return progress.active;
}

export function advanceMeadowCave(profile, run, stage) {
  const progress = meadowCaveProgress(profile);
  if (!run || progress.active !== run || stage !== run.stage) return null;
  const spec = MEADOW_CAVE[run.tier];
  if (stage < spec.stages.length - 1) {
    run.stage++;
    return { complete: false };
  }

  const firstClear = !progress.clears[run.tier];
  const coins = spec.coins + (firstClear ? spec.firstCoins : 0);
  const materials = firstClear ? spec.firstMaterials : spec.materials;
  profile.coins = (profile.coins || 0) + coins;
  profile.mMats ||= {};
  for (const material of ['boar_tusk', 'thorn_bark']) {
    profile.mMats[material] = (profile.mMats[material] || 0) + materials;
  }
  progress.clears[run.tier] = (progress.clears[run.tier] || 0) + 1;
  progress.active = null;
  return { complete: true, firstClear, coins, materials, xp: spec.xp };
}
