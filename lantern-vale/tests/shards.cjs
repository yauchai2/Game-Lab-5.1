const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createInterface } = require('node:readline');
const { setTimeout: delay } = require('node:timers/promises');
const WebSocket = require('ws');

(async () => {
  const sockets = [];
  const server = spawn(process.execPath, ['server/server.js'], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', LV_DATABASE: ':memory:' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const stdout = createInterface({ input: server.stdout });
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Server did not start')), 5000);
      server.once('error', err => { clearTimeout(timeout); reject(err); });
      server.once('exit', () => { clearTimeout(timeout); reject(Error('Server exited')); });
      stdout.on('line', line => {
        const match = line.match(/localhost:(\d+)$/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
    });
    async function open(party = '') {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      const inbox = [];
      ws.on('message', bytes => inbox.push(JSON.parse(bytes)));
      await once(ws, 'open');
      const send = message => ws.send(JSON.stringify(message));
      const get = async match => {
        for (let i = 0; i < 160; i++) {
          const found = inbox.findIndex(match);
          if (found !== -1) return inbox.splice(found, 1)[0];
          await delay(15);
        }
        throw Error('Timed out waiting for server response');
      };
      const { id } = await get(m => m.t === 'welcome');
      send({ t: 'hello', name: 'T' + id, party });
      send({ t: 'pos', zone: 'field:1', party, x: 1, z: 1 });
      const first = await get(m => m.t === 'shard' && m.zone === 'field:1');
      return { id, inbox, send, get, first: first.id, close: async () => { ws.close(); await once(ws, 'close'); } };
    }
    const first = await open('friends');
    const filler = [];
    for (let i = 0; i < 24; i++) filler.push(await open());
    assert.ok(filler.every(p => p.first === first.first));
    const second = await open();
    assert.equal(second.first, 'field:1#2');
    for (let i = 0; i < 5; i++) filler.push(await open('friends'));
    assert.ok(filler.slice(24).every(p => p.first === 'field:1#1'));
    const overflowFriend = await open('friends');
    assert.equal(overflowFriend.first, 'field:1#2');

    second.send({ t: 'shard_list' });
    const listing = await second.get(m => m.t === 'shards');
    assert.deepEqual(listing.lines.map(l => l.count), [30, 2]);
    const snap = await second.get(m => m.t === 'snap' && m.shard === second.first && m.count === 2);
    assert.deepEqual(snap.players.map(p => p.id), [overflowFriend.id]);
    second.send({ t: 'shard_switch', zone: 'field:1', id: first.first });
    assert.equal((await second.get(m => m.t === 'shards')).error, 'full');

    second.send({ t: 'chat', text: 'line two only' });
    await overflowFriend.get(m => m.t === 'chat' && m.text === 'line two only');
    overflowFriend.send({ t: 'chat', channel: 'party', text: 'hello friends' });
    await first.get(m => m.t === 'chat' && m.text === 'hello friends');
    assert.ok(!first.inbox.some(m => m.t === 'chat' && m.text === 'line two only'));
    assert.ok(!second.inbox.some(m => m.t === 'chat' && m.text === 'hello friends'));
    overflowFriend.send({ t: 'tide_kill', weight: 2 });
    await second.get(m => m.t === 'tide_sync' && m.heat > 0);
    await delay(100);
    assert.ok(!first.inbox.some(m => m.t === 'tide_sync' && m.heat > 0));

    const departing = filler.pop();
    await departing.close();
    await first.get(m => m.t === 'gone' && m.id === departing.id);
    overflowFriend.send({ t: 'shard_switch', zone: 'field:1', id: 'field:1#1' });
    const switched = await overflowFriend.get(m => m.t === 'shard' && m.id === 'field:1#1');
    assert.ok(!switched.history.some(m => m.text === 'line two only'));
    const switchResult = await overflowFriend.get(m => m.t === 'shards');
    assert.equal(switchResult.current, 'field:1#1');
    assert.deepEqual(switchResult.lines.map(l => l.count), [30, 1]);
    // The local socket can close before the server releases its shard membership.
    for (let i = first.inbox.length - 1; i >= 0; i--) {
      if (first.inbox[i].t === 'online') first.inbox.splice(i, 1);
    }
    await second.close();
    await first.get(m => m.t === 'online' && m.n === 30);

    first.send({ t: 'shard_list' });
    assert.equal((await first.get(m => m.t === 'shards')).lines.length, 1);
    first.send({ t: 'pos', zone: 'harbor', party: 'friends' });
    assert.equal((await first.get(m => m.t === 'shard' && m.zone === 'harbor')).id, 'harbor#1');

    const base = `http://127.0.0.1:${port}`;
    assert.equal(await (await fetch(base + '/health')).text(), 'ok');
    assert.match(await (await fetch(base)).text(), /window\.LV_SERVER=true/);
    assert.equal((await fetch(base + '/assets/ui/crisp_pixel/wood/panel.png', { method: 'HEAD' })).headers.get('content-type'), 'image/png');
    console.log('Passed live WebSocket sharding, party affinity, capacity, switching, isolation and cleanup.');
  } finally {
    for (const ws of sockets) ws.terminate();
    stdout.close();
    const done = once(server, 'exit');
    if (server.exitCode === null && server.signalCode === null) { server.kill(); await done; }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
