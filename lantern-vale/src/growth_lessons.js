// Permanent practice rewards for the local growth playtest.
const LESSONS = {
  0: [
    { icon: '環', name: '學會收尾震波', desc: '持盾普攻第三擊多一圈腳下震波，補打原招未命中的敵人。' },
    { icon: '◎', name: '學會雙環', desc: '震波稍後再擴一圈，同一次出招不會疊打已命中的敵人。' },
  ],
  1: [
    { icon: '⇶', name: '學會扇射', desc: '地面普攻由一支箭變三支，外側箭較弱，對同一目標只結算一支。' },
    { icon: '↪', name: '學會回射', desc: '短時間後沿原方向補一支弱箭，每 5.5 秒最多一次。' },
  ],
};

export function growthLessonRank(profile, job) {
  const rank = profile?.growthLessons?.[job];
  return Object.hasOwn(LESSONS, job) && (rank === 1 || rank === 2) ? rank : 0;
}

export function availableGrowthLesson(profile, job) {
  const rank = growthLessonRank(profile, job);
  const firstClear = profile.meadowCave?.clears?.normal > 0;
  const eligible = rank === 0
    ? profile.opening?.practice === 'done' || firstClear || !!profile.meadowExpedition?.cleared?.[1]
    : rank === 1 && firstClear;
  const lesson = LESSONS[job]?.[rank];
  return eligible && lesson ? { ...lesson, rank: rank + 1 } : null;
}

export function mergeGrowthLessons(profile, saved) {
  for (const job of [0, 1]) {
    const rank = Math.max(growthLessonRank(profile, job), growthLessonRank(saved, job));
    if (rank) profile.growthLessons = { ...profile.growthLessons, [job]: rank };
  }
}
