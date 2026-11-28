export const CLASS_TALENTS = [
  [
    ['守燈陣式', '滿戰意時展開六秒護盾，盾量隨這條路線深化，有附近隊友時可分一部分護盾。'],
    ['反擊誓式', '滿戰意後，下一次完美閃避在腳下引發短震波。'],
  ],
  [
    ['疾行散羽', '風羽滿後，移動中射擊會展開一輪低傷扇射。'],
    ['定點凝羽', '風羽滿後，站定施放的下一道攻擊技能威力提高。'],
  ],
  [
    ['留火成陣', '雙焰滿後，在滿層時的落點留下小火圈。'],
    ['聚焰即燃', '雙焰滿時立刻以較窄的爆破換取較集中的傷害。'],
  ],
  [
    ['影步卸勢', '暗影印記滿層時，縮短下一次翻滾等待，保留少量回復。'],
    ['收影突襲', '暗影印記滿層時，在前方較窄範圍引爆。'],
  ],
  [
    ['沿途留蓮', '蓮印滿後留下蓮域，可踏入獲得一次回復。'],
    ['聚蓮收勢', '蓮印滿時立即回復，並向面前打出一段短蓮波。'],
  ],
];

export function classTalentPoints(profile) {
  const clears = profile.growthJourney?.clears || {};
  return Number(!!clears[1]) + Number(!!clears[2]) + Number(!!clears[3]) +
    Number(!!clears[5]) + Number(!!clears[6]);
}

export function readClassTalent(profile, job, awakened) {
  const ordered = profile.growthJourney?.classTalents?.[job];
  const branch = ordered?.branch === 0 || ordered?.branch === 1 ? ordered.branch : null;
  const limit = awakened ? 4 : 2;
  const rank = branch === null ? 0 : Math.max(0, Math.min(limit, classTalentPoints(profile) - 1, Math.floor(ordered.rank) || 0));
  return { branch, rank, root: !!ordered?.root && classTalentPoints(profile) > 0 };
}

export function chooseClassTalent(profile, job, awakened, action) {
  if (!CLASS_TALENTS[job]) return false;
  const points = classTalentPoints(profile);
  const previous = readClassTalent(profile, job, awakened);
  let next = previous;
  if (action === 'reset' && previous.root) next = { root: false, branch: null, rank: 0 };
  else if (action === 'root' && points && !previous.root) next = { ...previous, root: true };
  else if (previous.root && previous.rank + 1 < points && previous.rank < (awakened ? 4 : 2)) {
    const branch = Number(action);
    if (![0, 1].includes(branch) || (previous.branch !== null && previous.branch !== branch)) return false;
    next = { root: true, branch, rank: previous.rank + 1 };
  }
  if (next === previous) return false;
  const journey = profile.growthJourney;
  (journey.classTalents ||= {})[job] = { ...next, changed: Date.now() };
  return true;
}
