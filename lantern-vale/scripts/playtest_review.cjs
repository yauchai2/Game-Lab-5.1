const STRATEGIES = [
  { id: 'boar', label: '先打狂豬', priority: 'boar', rollAt: 0.46, shotLead: 1.6 },
  { id: 'thorn', label: '先打射手', priority: 'thorn', rollAt: 0.46, shotLead: 1.6 },
  { id: 'early', label: '優先閃避', priority: 'boar', rollAt: 0.24, shotLead: 2.35 },
];

function runProblems(run) {
  const { attempts, diagnostics } = run;
  const blocking = diagnostics?.some(row => row.level === 'error');
  const issues = [];
  if (blocking) issues.push('瀏覽器有錯誤，先用日誌和當輪截圖定位。');
  if (attempts.length !== 2 || new Set(attempts.map(a => a.variant)).size !== 2)
    issues.push('缺少一版結果，重新跑完整 A／B。');
  if (attempts.some(a => !a.events.some(event => event.kind === 'attack')))
    issues.push('至少一場沒有出手，檢查導航或輸入。');
  if (attempts.some(a => a.outcome === 'abandoned'))
    issues.push('至少一場超時，檢查卡位、達成條件或執行環境。');
  const slow = attempts.some(a => a.frame?.p95Ms > 50);
  if (slow)
    issues.push('至少一場 P95 幀間隔超過 50 ms，需同環境重測。');
  return {
    issues,
    eligible: !blocking && !slow && attempts.length === 2 && new Set(attempts.map(a => a.variant)).size === 2 &&
      attempts.every(a => ['cleared', 'defeated'].includes(a.outcome) && a.events.some(event => event.kind === 'attack')),
  };
}

function reviewRun(records, run, leaderId) {
  const current = runProblems(run);
  const notes = [...current.issues];
  // Require both start orders for every policy on this exact build.
  const paired = id => ['AB', 'BA'].map(order => records.findLast(r =>
    r.build === run.build && r.strategy === id && r.order === order && runProblems(r).eligible));
  const candidate = paired(run.strategy);
  const leader = paired(leaderId);
  if (current.eligible && run.strategy !== leaderId && [...candidate, ...leader].every(Boolean)) {
    const score = rows => ['A', 'B'].map(variant => {
      const attempts = rows.map(row => row.attempts.find(a => a.variant === variant));
      return {
        cleared: attempts.filter(a => a.outcome === 'cleared').length,
        damage: attempts.reduce((sum, a) => sum + a.damageTaken, 0),
        simulatedMs: attempts.every(a => a.frame?.simulatedMs > 0)
          ? attempts.reduce((sum, a) => sum + a.frame.simulatedMs, 0) : null,
      };
    });
    const old = score(leader), next = score(candidate);
    const coversBoth = next.every((value, i) => value.cleared >= old[i].cleared);
    const moreClears = next.some((value, i) => value.cleared > old[i].cleared);
    const lessDamage = next.every((value, i) => value.damage <= old[i].damage) &&
      next.reduce((sum, v) => sum + v.damage, 0) < 0.9 * old.reduce((sum, v) => sum + v.damage, 0);
    const faster = [...next, ...old].every(v => v.cleared === 2 && v.simulatedMs > 0)
      && next.every((v, i) => v.damage === old[i].damage && v.simulatedMs <= old[i].simulatedMs)
      && next.reduce((sum, v) => sum + v.simulatedMs, 0) < 0.85 * old.reduce((sum, v) => sum + v.simulatedMs, 0);
    if (coversBoth && (moreClears || (next.every(v => v.cleared > 0) && lessDamage) || faster)) {
      notes.push('候選策略在兩種順序復測後符合採用門檻，下個循環改用候選策略。');
      return { leader: run.strategy, eligible: true, notes, comparison: { old, next } };
    }
    notes.push('候選策略未達採用門檻，沿用原策略。');
    return { leader: leaderId, eligible: true, notes, comparison: { old, next } };
  }
  if (!notes.length) notes.push(run.strategy === leaderId
    ? '這輪已建立目前策略的基準資料。'
    : '等待同一版本的 AB 與 BA 配對結果。');
  return { leader: leaderId, eligible: current.eligible, notes };
}

module.exports = { STRATEGIES, reviewRun };
