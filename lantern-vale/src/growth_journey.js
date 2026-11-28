// Local campaign trials. Each wave lists the enemy and its offset from the
// station, measured forward and sideways relative to the player's facing.
export const GROWTH_TRIALS = {
  1: { name: '南門守燈', hint: '先清外側射手，再攔截逼近的狂豬。', waves: [
    [['slime', 4, -2], ['thorn', 6, 2]], [['boar', 6, 0]],
  ] },
  2: { name: '林間列陣', hint: '將敵人引成一列，再沿狹窄方向出手。', waves: [
    [['slime', 4, 0], ['thorn', 7, 0]], [['thorn', 5, -2], ['thorn', 6, 2]],
  ] },
  3: { name: '沼澤窄口', hint: '留意兩批敵人到達的時間，預留第二次出手。', waves: [
    [['slime', 5, 0]], [['slime', 5, -1], ['moth', 8, 1]],
  ] },
  4: { name: '雪原反擊', hint: '側移避開衝鋒，再打收招中的敵人。', waves: [
    [['boar', 7, 0]], [['boar', 6, -2], ['thorn', 8, 2]],
  ] },
  5: { name: '火岩夾擊', hint: '先處理援軍，才有時間集中攻擊重裝敵人。', waves: [
    [['thorn', 6, -2], ['slime', 4, 2]], [['golem', 7, 0], ['thorn', 8, -3]],
  ] },
  6: { name: '鹿王樹心', hint: '應對側翼後，等鹿王露出破綻。', waves: [
    [['boar', 5, -3], ['thorn', 7, 3]], [['stag', 8, 0]],
  ] },
};

export function growthFieldCleared(profile, field) {
  return !!profile.growthJourney?.clears?.[field];
}

export function nextGrowthField(profile) {
  return [1, 2, 3, 4, 5, 6].find(field => !growthFieldCleared(profile, field)) ?? null;
}

export function growthTrialFor(profile, field) {
  if (nextGrowthField(profile) === field) return GROWTH_TRIALS[field];
  if (!growthFieldCleared(profile, 6) || !GROWTH_TRIALS[field]) return null;
  const { name, waves } = GROWTH_TRIALS[field];
  const split = (profile.growthJourney?.repeats?.[field] || 0) % 2 === 1;
  return split
    ? { name: name + ' · 進階', hint: '先後兩波從兩側進場，留意下一波出現的位置。',
      waves: waves.map((wave, index) =>
        wave.map(([type, forward, side]) => [type, forward, side + (index ? 3 : -3)])) }
    : { name: name + ' · 進階', hint: '兩路威脅同時出現，入場前可換配置。', waves: [waves.flat()] };
}

export function creditGrowthField(profile, field) {
  if (nextGrowthField(profile) !== field) return false;
  const state = profile.growthJourney ||= {};
  state.clears = { ...state.clears, [field]: true };
  return true;
}

export function recordGrowthRepeat(profile, field) {
  const state = profile.growthJourney;
  if (!growthFieldCleared(profile, 6) || !GROWTH_TRIALS[field]) return 0;
  state.repeats ||= {};
  state.repeats[field] = (state.repeats[field] || 0) + 1;
  return state.repeats[field];
}

export function growthUsesAlternate(profile, job) {
  return growthFieldCleared(profile, 2) && profile.growthJourney?.loadouts?.[job]?.alternate === true;
}

export function mergeGrowthJourney(profile, saved) {
  if (!saved?.growthJourney) return;
  const local = profile.growthJourney ||= {};
  if (saved.growthJourney.emberMastery === true) local.emberMastery = true;
  for (const field of [1, 2, 3, 4, 5, 6]) {
    if (growthFieldCleared(saved, field)) local.clears = { ...local.clears, [field]: true };
    const count = saved.growthJourney.repeats?.[field];
    if (Number.isSafeInteger(count) && count > (local.repeats?.[field] || 0)) {
      local.repeats = { ...local.repeats, [field]: count };
    }
  }
  for (const job of [0, 1]) {
    const loadout = saved.growthJourney.loadouts?.[job];
    if (loadout && loadout.changed > (local.loadouts?.[job]?.changed || 0)) {
      local.loadouts = { ...local.loadouts, [job]: loadout };
    }
  }
}
