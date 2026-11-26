const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const WebSocket = require('ws');
const { createPlaytestGate } = require('../server/playtest_gate.cjs');

(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lantern-gate-'));
  const file = path.join(dir, 'pass');
  const usePin = process.argv.includes('--pin');
  const pass = usePin ? '1234' : randomBytes(18).toString('base64url');
  await writeFile(file, '1234', { mode: 0o600 });
  assert.throws(() => createPlaytestGate(file), /Invalid playtest passcode/);
  await writeFile(file, pass);
  const server = spawn(process.execPath, ['server/server.js'], {
    cwd: path.join(__dirname, '..'), env: {
      ...process.env, HOST: '127.0.0.1', PORT: '0', LV_DATABASE: ':memory:',
      LV_PLAYTEST_PASS_FILE: file, LV_PLAYTEST_TRUST_CLOUDFLARE: '0', LV_PLAYTEST_ALLOW_SHORT_PIN: usePin ? '1' : '0',
    }, stdio: ['ignore', 'pipe', 'inherit'],
  });

  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Playtest server did not start')), 5000);
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.stdout.on('data', chunk => {
        const match = String(chunk).match(/localhost:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    const base = `http://127.0.0.1:${port}`;
    const trial = '/?playtest=ambush&order=BA';
    const image = '/assets/ui/crisp_pixel/wood/panel.png';
    const login = value => fetch(base + trial, {
      method: 'POST', body: new URLSearchParams({ pass: value }), redirect: 'manual',
    });
    assert.match(await (await fetch(base + trial)).text(), /試玩密碼/);
    assert.equal((await fetch(base + image)).status, 401);
    assert.equal((await login('wrong')).status, 401);
    const access = await login(pass);
    assert.equal(access.status, 303);
    assert.equal(access.headers.get('location'), trial);
    const cookie = access.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
    const headers = { cookie: cookie.split(';')[0] };
    assert.match(await (await fetch(base + trial, { headers })).text(), /window\.LV_SERVER=true/);
    assert.equal((await fetch(base + image, { headers })).headers.get('cache-control'), 'private, no-cache');
    assert.equal((await fetch(base + '/__dev/events', { headers })).status, 404);

    const socket = extra => new WebSocket(`ws://127.0.0.1:${port}/ws`, { ...extra, handshakeTimeout: 5000 });
    const anonymous = socket();
    try {
      const [, response] = await Promise.race([
        once(anonymous, 'unexpected-response'),
        once(anonymous, 'open').then(() => { throw Error('Anonymous WebSocket accepted'); }),
      ]);
      assert.equal(response.statusCode, 401);
    } finally { anonymous.terminate(); }
    const invited = socket({ headers });
    try {
      const [data] = await once(invited, 'message');
      assert.equal(JSON.parse(data).t, 'welcome');
    } finally { invited.close(); }
    const failed = await Promise.all(Array.from({ length: 6 }, () => login('wrong')));
    assert.equal(failed.filter(response => response.status === 401).length, 5);
    const denied = failed.find(response => response.status === 429);
    assert.ok(Number(denied.headers.get('retry-after')) > 0);
    assert.equal((await login(pass)).status, 429);
    console.log('Passed playtest authentication, concurrent login limits, Dev isolation, and WebSocket access.');
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const done = once(server, 'exit');
      server.kill();
      await done;
    }
    await rm(dir, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
