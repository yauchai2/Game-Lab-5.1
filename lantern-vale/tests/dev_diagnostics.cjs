const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-dev-test-'));
  const env = { ...process.env, HOST: '127.0.0.1', PORT: '0', LV_DATABASE: ':memory:',
    LV_DEV_LOG_DB: path.join(directory, 'events.sqlite'), LV_DEV_LOGS: '1' };
  const server = spawn(process.execPath, ['server/server.js'], { cwd: root, env });
  server.stderr.resume();
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 5000);
      server.once('exit', () => { clearTimeout(timer); reject(Error('Server exited')); });
      server.once('error', err => { clearTimeout(timer); reject(err); });
      server.stdout.on('data', bytes => {
        const port = bytes.toString().match(/localhost:(\d+)/)?.[1];
        if (port) { clearTimeout(timer); resolve(port); }
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    const endpoint = origin + '/__dev/events';
    assert.equal((await fetch(endpoint)).status, 405);
    assert.equal((await fetch(endpoint, {
      method: 'POST', headers: { Origin: 'http://example.test', 'Content-Type': 'application/json' }, body: '[]',
    })).status, 403);
    assert.equal((await fetch(endpoint, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.1' }, body: '[]',
    })).status, 404);
    assert.equal((await fetch(endpoint, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'x'.repeat(70 * 1024),
    })).status, 413);
    const report = (...args) => execFileSync(process.execPath,
      ['scripts/review_dev_diagnostics.cjs', ...args], { cwd: root, env: { ...env, NODE_NO_WARNINGS: '1' } }).toString();

    browser = await chromium.launch({
      channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1152, height: 720 } });
    await page.goto(origin);
    await page.waitForFunction(() => window.__game?.dbg);
    await page.evaluate(() => console.error('lv-off-probe'));
    assert.match(report(), /尚無本機紀錄/);

    await page.route('**/__dev/events', route => route.abort());
    await page.keyboard.press('Shift+F3');
    await page.evaluate(() => {
      console.warn('lv-warning-probe token=exampleSecret');
      setTimeout(() => { throw new ReferenceError('lv-uncaught-probe'); }, 20);
      Promise.reject(new Error('lv-promise-probe'));
    });
    await page.waitForFunction(() => Object.values(localStorage).some(value => value.includes('lv-uncaught-probe')));
    assert.match(report(), /尚無本機紀錄/);
    const queued = await page.evaluate(() => Object.values(localStorage).filter(value => value.includes('lv-uncaught-probe')).map(JSON.parse));
    await page.unroute('**/__dev/events');
    await page.reload();
    await page.waitForFunction(() => Object.keys(localStorage).every(key => !key.startsWith('lantern-dev-event:')));
    const first = JSON.parse(report());
    assert.ok(first.issues.some(({ latest }) => latest.kind === 'uncaught' && latest.text.includes('lv-uncaught-probe') && latest.text.includes('at ')));
    assert.ok(first.issues.some(({ latest }) => latest.kind === 'promise' && latest.text.includes('lv-promise-probe')));
    assert.match(JSON.stringify(first), /lv-warning-probe token=\[redacted\]/);
    assert.doesNotMatch(JSON.stringify(first), /exampleSecret|lv-off-probe/);
    assert.match(first.issues.find(({ latest }) => latest.kind === 'uncaught').latest.build, /^[a-f0-9]{12}$/);

    const response = await fetch(endpoint, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(queued),
    });
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(report()).issues.find(({ latest }) => latest.kind === 'uncaught').count, 1);
    assert.equal(JSON.parse(report('--details', first.reviewThrough)).reviewThrough, first.reviewThrough);

    await page.keyboard.press('Shift+F3');
    await page.evaluate(() => console.error('lv-off-again-probe'));
    await page.waitForFunction(() => Object.keys(localStorage).every(key => !key.startsWith('lantern-dev-event:')));
    report('--reviewed-through', first.reviewThrough);
    const next = JSON.parse(report());
    assert.ok(next.reviewThrough > first.reviewThrough);
    assert.doesNotMatch(JSON.stringify(next), /lv-uncaught-probe|lv-off-again-probe/);
    report('--reviewed-through', next.reviewThrough);
    assert.match(report(), /沒有新的待審事件/);

    if (process.env.LV_TEST_SCREENSHOT) {
      await page.keyboard.press('Shift+F3');
      await page.keyboard.press('F3');
      await page.screenshot({ path: process.env.LV_TEST_SCREENSHOT });
    }
    console.log('Dev diagnostics: disabled, capture, stack, redaction, replay, dedupe and review cursor passed.');
  } finally {
    await browser?.close();
    if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
