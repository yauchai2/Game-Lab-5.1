import { nextGrowthField, growthFieldCleared } from './growth_journey.js';

export const EMBER_CORE = 'ember_inferno_core';
export const SLAM_CORE = 'root_quake_core';
export const EVOLUTION_CORES = new Set([EMBER_CORE, SLAM_CORE]);
export const EMBER_MASTERY_TRIAL = {
  name: '餘燼精通 · 鹿王火線',
  hint: '用手動餘燼飛彈命中至少四名試煉敵人，再擊倒鹿王。全場限用一次藥瓶。',
  waves: [
    [['thorn', 6, -3], ['thorn', 6, 3], ['golem', 5, 0]],
    [['boar', 5, -3], ['stag', 9, 0]],
  ],
};

export const SLAM_MASTERY_TRIAL = {
  name: '根鬚精通 · 鹿王震線',
  hint: '用手動根鬚震擊命中至少四名試煉敵人，再擊倒鹿王。全場限用一次藥瓶。',
  waves: [
    [['boar', 4, -2], ['boar', 4, 2], ['golem', 7, 0]],
    [['golem', 6, -3], ['stag', 9, 0]],
  ],
};

export function canAttemptEmberMastery(profile, awakened) {
  return profile.level >= 30 && !!awakened && profile.meadowCave?.clears?.normal > 0 &&
    nextGrowthField(profile) === null;
}

export function emberStage(profile, awakened, mastery = 'emberMastery') {
  if (canAttemptEmberMastery(profile, awakened) && profile.growthJourney?.[mastery]) return 4;
  if (profile.level >= 20 && awakened && growthFieldCleared(profile, 5)) return 3;
  if (profile.level >= 12 && awakened && growthFieldCleared(profile, 2)) return 2;
  return profile.level >= 6 && profile.meadowCave?.clears?.normal > 0 ? 1 : 0;
}
