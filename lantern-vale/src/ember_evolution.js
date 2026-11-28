import { nextGrowthField, growthFieldCleared } from './growth_journey.js';

export const EMBER_CORE = 'ember_inferno_core';
export const EMBER_MASTERY_TRIAL = {
  name: '餘燼精通 · 鹿王火線',
  hint: '用手動餘燼飛彈命中至少四名試煉敵人，再擊倒鹿王。',
  waves: [
    [['thorn', 6, -3], ['thorn', 6, 3], ['golem', 5, 0]],
    [['boar', 5, -3], ['stag', 9, 0]],
  ],
};

export function canAttemptEmberMastery(profile, awakened) {
  return profile.level >= 30 && !!awakened && profile.meadowCave?.clears?.normal > 0 &&
    nextGrowthField(profile) === null;
}

export function emberStage(profile, awakened) {
  if (canAttemptEmberMastery(profile, awakened) && profile.growthJourney?.emberMastery) return 4;
  if (profile.level >= 20 && awakened && growthFieldCleared(profile, 5)) return 3;
  if (profile.level >= 12 && awakened && growthFieldCleared(profile, 2)) return 2;
  return profile.level >= 6 && profile.meadowCave?.clears?.normal > 0 ? 1 : 0;
}
