const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: wait } = require('node:timers/promises');
const { chromium } = require('playwright');
const { redactDevText } = require('../src/dev_log_sanitize.cjs');
const { STRATEGIES, reviewRun } = require('./playtest_review.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'review', 'output', 'live');
const driver = path.join(__dirname, 'playtest_driver.js');
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--rounds='));
const rounds = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const headless = args.includes('--headless');
const latest = path.join(output, headless ? 'latest-headless.json' : 'latest.json');
const initialUrl = new URL(process.env.LV_GAME_URL || 'http://localhost:8080/');
if (initialUrl.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(initialUrl.hostname) ||
    initialUrl.username || initialUrl.password || args.some(arg => arg !== '--headless' && arg !== limitArg) ||
    (limitArg && (!Number.isSafeInteger(rounds) || rounds < 1))) {
  console.error('用法：npm run playtest:live -- [--headless] [--rounds=正整數]。遊戲網址需為本機 HTTP。');
  process.exit(2);
}

let browser, ownedServer, stopping = false;
function stop() {
  stopping = true;
  browser?.close().catch(() => {});
  ownedServer?.kill();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function checkServer(url) {
  try {
    const response = await fetch(new URL('/health', url), { method: 'HEAD', signal: AbortSignal.timeout(750) });
    return response.ok && response.headers.get('X-Lantern-Vale-Server') === 'zone-shards';
  } catch { return false; }
}

async function serverUrl() {
  if (await checkServer(initialUrl)) return initialUrl;
  // An independent ephemeral port avoids taking over another local service.
  ownedServer = spawn(process.execPath, ['server/server.js'], {
    cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', LV_DATABASE: ':memory:' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('等候本機遊戲伺服器逾時')), 5000);
    const fail = error => { clearTimeout(timer); reject(error); };
    ownedServer.once('error', fail);
    ownedServer.once('exit', code => fail(new Error(`本機伺服器結束（${code}）`)));
    ownedServer.stdout.on('data', chunk => {
      buffer = (buffer + chunk).slice(-4000);
      const port = buffer.match(/localhost:(\d+)\s/);
      if (port) { clearTimeout(timer); resolve(new URL(`http://127.0.0.1:${port[1]}/`)); }
    });
  });
  if (!await checkServer(url)) throw new Error('本機遊戲伺服器健康檢查失敗');
  return url;
}

async function saveJSON(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n');
  await fs.rename(temp, file);
}

async function watchAttempt(page) {
  let activeWallTime = 0;
  let previous = performance.now();
  while (!stopping && !page.isClosed()) {
    const { done, paused, hidden } = await page.evaluate(() => ({
      done: __game.state === 'trial-result', ...__qaPlaytest.progress(),
    }));
    if (done) return;
    const now = performance.now();
    if (!paused && !hidden) activeWallTime += now - previous;
    previous = now;
    if (activeWallTime > 105000) throw new Error('單場有效執行時間超出 105 秒');
    await wait(400);
  }
  throw new Error('試玩已停止');
}

async function runPair(page, url, strategy, order, diagnostics) {
  const target = new URL(url);
  target.searchParams.set('playtest', 'ambush');
  target.searchParams.set('order', order);
  await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__game?.ambushTrial);
  await page.addScriptTag({ path: driver });
  const read = () => page.evaluate(() => __game.ambushTrial.report());
  const start = await read();
  const attempts = [];
  for (const [i, name] of ['開始第一場', '開始第二場'].entries()) {
    await page.evaluate(next => __qaPlaytest.setStrategy(next), { ...strategy, limitMs: 44000 });
    await page.getByRole('button', { name, exact: true }).click();
    await watchAttempt(page);
    const report = await read();
    attempts.push({ ...report.attempts[i], frame: await page.evaluate(() => __qaPlaytest.timings()) });
    await page.evaluate(({ last, entries }) => {
      const text = `${last.variant} 版 · ${last.outcome === 'cleared' ? '通關' : last.outcome === 'defeated' ? '倒下' : '超時'} · 扣血 ${last.damageTaken}\n` +
        entries.map(row => `[${row.level}] ${row.text.split('\n')[0]}`).join('\n');
      __qaPlaytest.show(text);
    }, { last: attempts.at(-1), entries: diagnostics.slice(-3) });
    await wait(1200);
  }
  return { build: start.build, strategy: strategy.id, order, attempts, diagnostics };
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const url = await serverUrl();
  const softwareGL = process.env.LV_SOFTWARE_GL === '1' ||
    (headless && process.platform !== 'darwin' && process.env.LV_SOFTWARE_GL !== '0');
  browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || (process.platform === 'darwin' ? 'chrome' : undefined),
    headless,
    args: softwareGL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
      : headless ? [] : ['--window-position=24,40', '--disable-backgrounding-occluded-windows'],
  });
  const page = await browser.newPage({ viewport: { width: 1160, height: 720 } });
  page.setDefaultTimeout(60000);
  await page.addInitScript(() => localStorage.setItem('lv_dev_mode', '1'));
  page.on('close', () => { stopping = true; });
  let diagnostics = [];
  function record(level, text) {
    const entry = { level, time: new Date().toISOString(), text: redactDevText(text, 600) };
    if (diagnostics.length >= 100) {
      const oldestWarning = diagnostics.findIndex(row => row.level !== 'error');
      if (oldestWarning < 0 && level !== 'error') return;
      diagnostics.splice(Math.max(oldestWarning, 0), 1);
    }
    diagnostics.push(entry);
    if (level !== 'error' && level !== 'warn') return;
    console.log(`[${level}] ${entry.text.split('\n')[0]}`);
    if (!page.isClosed()) page.evaluate(line => window.__qaPlaytest?.show(line),
      `[${level}] ${entry.text.split('\n')[0]}`).catch(() => {});
  }
  page.on('pageerror', error => record('error', error.stack || error.message));
  page.on('console', message => {
    const type = message.type();
    if (type === 'error' || type === 'warning') record(type === 'warning' ? 'warn' : type, message.text());
  });
  const history = [];
  let leader = STRATEGIES[0].id;
  let previousBuild;
  let plan = [];
  console.log('自動試玩已開啟。關閉觀戰視窗或按 Ctrl+C 可結束。');
  for (let round = 0; round < rounds && !stopping; round++) {
    if (!plan.length) {
      // Retest the current leader, then run each alternative in both orders.
      plan = [leader, ...STRATEGIES.map(s => s.id).filter(id => id !== leader)]
        .flatMap(id => [{ id, order: 'AB' }, { id, order: 'BA' }]);
    }
    const next = plan.shift();
    const strategy = STRATEGIES.find(item => item.id === next.id);
    diagnostics = [];
    const stem = `${Date.now()}-${process.pid}-${round + 1}`;
    console.log(`第 ${round + 1} 輪 · ${strategy.label} · ${next.order}`);
    try {
      const run = await runPair(page, url, strategy, next.order, diagnostics);
      if (run.build !== previousBuild && previousBuild !== undefined) {
        leader = STRATEGIES[0].id;
        plan = [];
      }
      previousBuild = run.build;
      history.push(run);
      if (history.length > 24) history.shift();
      run.review = reviewRun(history, run, leader);
      leader = run.review.leader;
      if (headless && rounds < Infinity && !run.review.eligible) process.exitCode = 1;
      await saveJSON(path.join(output, stem + '.json'), run);
      await saveJSON(latest, run);
      if (diagnostics.some(row => row.level === 'error')) {
        await page.screenshot({ path: path.join(output, stem + '.png'), timeout: 5000 }).catch(() => {});
      }
      const notes = run.review.notes.join('\n');
      console.log(notes);
      await page.evaluate(notes => __qaPlaytest.show(notes), notes);
      if (round + 1 < rounds) await wait(2800);

    } catch (error) {
      if (stopping) break;
      const failure = { status: 'error', strategy: strategy.id, order: next.order,
        message: redactDevText(error.message, 1200), diagnostics };
      await saveJSON(path.join(output, stem + '.json'), failure);
      await saveJSON(latest, failure);
      if (!page.isClosed()) await page.screenshot({ path: path.join(output, stem + '.png'), timeout: 5000 }).catch(() => {});
      console.log(`[error] ${failure.message}`);
      if (rounds < Infinity) {
        process.exitCode = 1;
        break;
      }
      if (!stopping) {
        console.log('已保存失敗證據。五秒後重新開啟試玩頁。');
        plan.unshift(next);
        await wait(5000);
      }
    }
  }
}

main().catch(error => {
  if (stopping) return;
  console.error(redactDevText(error.message, 1200));
  process.exitCode = 1;
}).finally(stop);
