const assert = require('node:assert/strict');
const { reviewRun } = require('../scripts/playtest_review.cjs');

function run(strategy, order, damage, changes = {}) {
  return {
    build: 'baseline', strategy, order, diagnostics: [],
    attempts: ['A', 'B'].map((variant, i) => ({
      variant, damageTaken: damage[i], outcome: 'cleared', events: [{ kind: 'attack' }],
      frame: { p95Ms: 17 },
    })),
    ...changes,
  };
}

const records = [run('boar', 'AB', [35, 40]), run('boar', 'BA', [30, 25]), run('thorn', 'AB', [20, 15])];
const missingOrder = reviewRun(records, records[2], 'boar');
assert.equal(missingOrder.leader, 'boar');
assert.equal(missingOrder.eligible, true);

const improvement = run('thorn', 'BA', [22, 17]);
assert.equal(reviewRun([...records, improvement], improvement, 'boar').leader, 'thorn');

const tradeoff = run('thorn', 'BA', [0, 60]);
assert.equal(reviewRun([...records, tradeoff], tradeoff, 'boar').leader, 'boar');

const differentBuild = { ...improvement, build: 'new' };
assert.equal(reviewRun([...records, differentBuild], differentBuild, 'boar').leader, 'boar');

const clientError = { ...improvement, diagnostics: [{ level: 'error' }] };
assert.equal(reviewRun([...records, clientError], clientError, 'boar').eligible, false);

const slow = run('thorn', 'BA', [22, 17]);
slow.attempts[0].frame.p95Ms = 61;
assert.equal(reviewRun([...records, slow], slow, 'boar').eligible, false);

const timeout = run('thorn', 'BA', [22, 17]);
timeout.attempts[1].outcome = 'abandoned';
assert.equal(reviewRun([...records, timeout], timeout, 'boar').eligible, false);
const speedRuns = ['AB', 'BA'].flatMap(order => {
  return ['boar', 'thorn'].map(strategy => {
    const record = run(strategy, order, [0, 0]);
    for (const attempt of record.attempts) attempt.frame.simulatedMs = strategy === 'boar' ? 20000 : 16000;
    return record;
  });
});
assert.equal(reviewRun(speedRuns, speedRuns.at(-1), 'boar').leader, 'thorn');
speedRuns[1].attempts[0].frame.simulatedMs = 28000;
assert.equal(reviewRun(speedRuns, speedRuns.at(-1), 'boar').leader, 'boar');
console.log('Passed AB/BA review, build isolation, promotion and rejection gates.');
