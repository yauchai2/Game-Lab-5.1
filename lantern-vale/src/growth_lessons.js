// Permanent practice rewards for the local growth playtest.
import { growthFieldCleared } from './growth_journey.js';
const LESSONS = {
  0: [
    { icon: '環', name: '學會收尾震波', desc: '持盾普攻第三擊多一圈腳下震波，補打原招未命中的敵人。' },
    { icon: '◎', name: '學會雙環', desc: '震波稍後再擴一圈，同一次出招不會疊打已命中的敵人。' },
  ],
  1: [
    { icon: '⇶', name: '學會扇射', desc: '地面普攻由一支箭變三支，外側箭較弱，對同一目標只結算一支。' },
    { icon: '↪', name: '學會回射', desc: '短時間後沿原方向補一支弱箭，每 5.5 秒最多一次。' },
  ],
  2: [
    { icon: '燼', name: '學會落地火種', desc: '杖擊尾擊命中後，在命中位置留下一次延遲爆波，只補打新目標。' },
    { icon: '◎', name: '學會燎原火種', desc: '火種波及範圍擴大，較易打中後排。' },
  ],
  3: [
    { icon: '影', name: '學會影返', desc: '雙刃尾擊命中後，在出手位置留下短暫殘影，補打一圈。' },
    { icon: '◎', name: '學會擴影', desc: '殘影補擊範圍擴大，較適合邊走邊打。' },
  ],
  4: [
    { icon: '蓮', name: '學會踏地蓮波', desc: '杖擊尾擊命中後，腳下稍後散開一圈蓮波，補打未命中目標。' },
    { icon: '◎', name: '學會緩行蓮波', desc: '蓮波範圍擴大，並短暫減慢新命中的敵人。' },
  ],
};

export const GROWTH_JOBS = Object.keys(LESSONS).map(Number);

const BRANCHES = [
  ['收尾震波', '前推劍氣', '持盾第三擊向前送出短劍氣，補打原招未命中的目標。'],
  ['扇射', '穿列', '一支箭先以原傷害命中，穿過後以較弱傷害再命中一個目標。'],
  ['落地火種', '遠置火種', '將火種放到第一個命中點前方，較適合打後排。'],
  ['影返', '側影', '殘影移到出手位置的右側，可打到側翼。'],
  ['踏地蓮波', '推蓮', '蓮波移到面向的前方，適合補打較遠的敵人。'],
];

export function growthSwitchChoice(job, alternate) {
  const [primary, secondary, description] = BRANCHES[job];
  return {
    name: '切換至' + (alternate ? primary : secondary),
    desc: alternate ? '切回角色已學的第一套招式。' : description,
  };
}
const FOLLOWUPS = {
  2: { atContact: true, forward: 1.65, side: 0, delay: 0.6, radius: 1.7, mult: 0.35, color: 0x68cbf2 },
  3: { atContact: false, forward: 0, side: 1.9, delay: 0.35, radius: 1.65, mult: 0.3, color: 0xac93e8 },
  4: { atContact: false, forward: 2, side: 0, delay: 0.25, radius: 1.9, mult: 0.28, color: 0xf09bc8 },
};

export function growthMeleeFollowup(job, rank, alternate, origin, hit, dir) {
  const move = FOLLOWUPS[job];
  if (!move || rank < 1 || !hit) return null;
  const point = move.atContact ? hit : origin;
  const forward = alternate ? move.forward : 0;
  const side = alternate ? move.side : 0;
  return {
    x: point.x + dir.x * forward + dir.y * side,
    z: point.z + dir.y * forward - dir.x * side,
    delay: move.delay, radius: move.radius + (rank === 2 ? 0.4 : 0),
    mult: move.mult, color: move.color, slow: job === 4 && rank === 2 ? 0.65 : 0,
  };
}

export function growthLessonRank(profile, job) {
  const rank = profile?.growthLessons?.[job];
  return Object.hasOwn(LESSONS, job) && (rank === 1 || rank === 2) ? rank : 0;
}

export function availableGrowthLesson(profile, job) {
  const rank = growthLessonRank(profile, job);
  const firstClear = profile.meadowCave?.clears?.normal > 0;
  const eligible = rank === 0
    ? profile.opening?.practice === 'done' || firstClear || !!profile.meadowExpedition?.cleared?.[1]
    : rank === 1 && (firstClear || growthFieldCleared(profile, 1));
  const lesson = LESSONS[job]?.[rank];
  return eligible && lesson ? { ...lesson, rank: rank + 1 } : null;
}

export function mergeGrowthLessons(profile, saved) {
  for (const job of GROWTH_JOBS) {
    const rank = Math.max(growthLessonRank(profile, job), growthLessonRank(saved, job));
    if (rank) profile.growthLessons = { ...profile.growthLessons, [job]: rank };
  }
}
