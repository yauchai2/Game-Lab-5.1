// Lantern Vale multiplayer server. PORT and HOST are optional.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { WebSocketServer } = require('ws');
const { isLocalDevRequest, receiveDevEvents } = require('./dev_diagnostics.cjs');
const { createPlaytestGate } = require('./playtest_gate.cjs');
const playtestGate = createPlaytestGate(process.env.LV_PLAYTEST_PASS_FILE);
const guild = require('./guild.cjs')(process.env.LV_DATABASE || path.join(__dirname, 'data', 'guild.sqlite'));
const { SpatialGrid, ZoneTide, assignShard, changeShardParty, releaseShard, SHARD_HARD_CAP, pickHotspots } = require('./zone_engine.cjs');

const FEATURE_FLAGS = {
  market: process.env.LV_KILL_MARKET !== '1',
  corrupt: process.env.LV_KILL_CORRUPT !== '1',
  autopilot: process.env.LV_KILL_AUTOPILOT !== '1',
  weeklySpire: process.env.LV_KILL_SPIRE !== '1',
};
const PORT = Number(process.env.PORT ?? 8080);
const GAME_DIR = path.join(__dirname, '..', 'game');
const ASSET_DIR = fs.realpathSync(path.join(GAME_DIR, 'assets'));
const MIME = {
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (playtestGate && await playtestGate.block(req, res, url)) return;
    if (url.pathname === '/__dev/events') return await receiveDevEvents(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    } else if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Lantern-Vale-Server': 'zone-shards' }).end('ok');
    } else if (url.pathname === '/' || url.pathname === '/index.html') {
      const dev = !playtestGate && isLocalDevRequest(req) ? 'window.LV_DEV_DIAGNOSTICS=true;' : '';
      const html = (await fs.promises.readFile(path.join(GAME_DIR, 'index.html'), 'utf8'))
        .replace('<script>', '<script>window.LV_SERVER=true;' + dev);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': playtestGate ? 'private, no-store' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : html);
    } else if (url.pathname.startsWith('/assets/')) {
      const file = await fs.promises.realpath(path.resolve(GAME_DIR, '.' + decodeURIComponent(url.pathname)));
      if (!file.startsWith(ASSET_DIR + path.sep)) { res.writeHead(404).end(); return; }
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
      });
      if (req.method === 'HEAD') res.end();
      else await pipeline(fs.createReadStream(file), res);
    } else res.writeHead(404).end();
  } catch (error) {
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(error.code === 'ENOENT' || error instanceof URIError ? 404 : 500).end();
  }
});
const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 4096,
  verifyClient: playtestGate ? ({ req }) => playtestGate.authorized(req) : undefined,
});
const players = new Map();
const shards = new Map();
const lineState = new Map();
let nextId = 1;

const clean = (s, n) => typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '';
const num = value => typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(-1024, Math.min(1024, value)) * 100) / 100 : 0;
const send = (me, data) => {
  if (me.ws.readyState === 1 && me.ws.bufferedAmount < 256 * 1024) me.ws.send(JSON.stringify(data));
};
function broadcast(data, filter = () => true) {
  for (const me of players.values()) if (filter(me)) send(me, data);
}
function broadcastOnline() { broadcast({ t: 'online', n: players.size }); }

function closeShardMembership(me) {
  if (!me.shard) return;
  const previous = me.shard;
  if (releaseShard(shards, me.zone, previous, me.party)) lineState.delete(previous);
  else broadcast({ t: 'gone', id: me.id }, person => person !== me && person.shard === previous);
  me.shard = null;
}

function joinZone(me, zone, party = me.party, requested = null) {
  if (me.zone === zone && me.shard && !requested) {
    if (me.party === party) return true;
    const list = shards.get(zone);
    const own = list.find(line => line.id === me.shard);
    const mateLine = party && !own.parties.has(party)
      ? list.find(line => line.id !== me.shard && line.parties.has(party) && line.count < SHARD_HARD_CAP)
      : null;
    if (mateLine) requested = mateLine.id;
    else {
      changeShardParty(shards, zone, me.shard, me.party, party);
      me.party = party;
      return true;
    }
  }
  if (requested && me.zone === zone && me.shard === requested) return true;
  const next = assignShard(shards, zone, party, requested);
  if (!next) return false;
  closeShardMembership(me);
  me.zone = zone;
  me.party = party;
  me.shard = next;
  send(me, { t: 'shard', zone, id: next, history: lineState.get(next)?.history || [] });
  if (zone.startsWith('field:')) send(me, { t: 'tide_sync', zone, shard: next, ...(lineState.get(next)?.tide || new ZoneTide(next)).snapshot() });
  return true;
}

function currentZone(value, me, party) {
  if (value === 'town' || value === 'harbor') return value;
  if (typeof value !== 'string' || value.length > 40) return null;
  if (/^field:(?:[1-9]|1[0-9]|20)$/.test(value)) return value;
  const run = /^run:.+:([0-9]{1,2})$/.exec(value);
  const depth = Number(run?.[1]);
  if (run) return `run:${party || 'solo' + me.id}:${depth}`;
  return null;
}

function sendShards(me, error = null) {
  const list = me.shard ? shards.get(me.zone) || [] : [];
  send(me, {
    t: 'shards', zone: me.zone, current: me.shard, error,
    lines: list.map(s => ({ id: s.id, number: s.number, count: s.count, capacity: SHARD_HARD_CAP })).sort((a, b) => a.number - b.number),
  });
}

function getLineState(me) {
  let state = lineState.get(me.shard);
  if (!state) {
    state = { history: [], tide: new ZoneTide(me.shard) };
    lineState.set(me.shard, state);
  }
  return state;
}

wss.on('connection', ws => {
  const me = { id: nextId++, ws, name: '旅人', col: 0, zone: null, shard: null, party: '', x: 0, y: 0, z: 0, f: 0, a: 0, chatT: [] };
  players.set(me.id, me);
  send(me, { t: 'welcome', id: me.id, history: [], hotspots: pickHotspots(), features: FEATURE_FLAGS, zoneShards: true });
  joinZone(me, 'town');
  broadcastOnline();
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (['guildHello', 'trade', 'raidJoin', 'raidLeave', 'raidInput'].includes(m.t)) {
      guild.message(me, m);
      if (me.raid && me.shard) {
        closeShardMembership(me);
        me.zone = null;
        send(me, { t: 'shard', zone: null, id: null, history: [] });
      }
      return;
    }
    switch (m.t) {
      case 'hello': {
        me.name = clean(m.name, 12) || '旅人';
        me.col = typeof m.color === 'number' ? Math.min(7, Math.max(0, m.color | 0)) : 0;
        if (!me.raid) joinZone(me, me.zone || 'town', clean(m.party, 12));
        break;
      }
      case 'pos': {
        if (me.raid) break;
        const party = typeof m.party === 'string' ? clean(m.party, 12) : me.party;
        const zone = currentZone(m.zone, me, party);
        if (!zone) break;
        joinZone(me, zone, party);
        me.x = num(m.x); me.y = num(m.y); me.z = num(m.z); me.f = num(m.f);
        me.a = Number.isInteger(m.a) && m.a >= 0 && m.a <= 5 ? m.a : 0;
        break;
      }
      case 'shard_list':
        if (me.lastListedShard !== me.shard || Date.now() - (me.lastShardList ?? 0) >= 300) {
          me.lastListedShard = me.shard;
          me.lastShardList = Date.now();
          sendShards(me);
        }
        break;
      case 'shard_switch': {
        if (!me.shard || m.zone !== me.zone || typeof m.id !== 'string' || m.id.length > 48 || me.raid) {
          sendShards(me, 'unavailable');
        } else if (Date.now() - (me.lastShardSwitch ?? 0) < 1500) {
          sendShards(me, 'cooldown');
        } else {
          me.lastShardSwitch = Date.now();
          sendShards(me, joinZone(me, me.zone, me.party, m.id) ? null : 'full');
        }
        break;
      }
      case 'tide_kill': {
        const now = Date.now();
        if (!me.shard || !me.zone.startsWith('field:') || now - (me.lastTideKill ?? 0) < 200) break;
        me.lastTideKill = now;
        const count = shards.get(me.zone).find(s => s.id === me.shard).count;
        const snap = getLineState(me).tide.addKill(Math.max(1, Math.min(5, num(m.weight))), count);
        broadcast({ t: 'tide_sync', zone: me.zone, shard: me.shard, ...snap }, p => p.shard === me.shard);
        break;
      }
      case 'chat': {
        if (!me.shard && !me.raid) break;
        const text = clean(m.text, 120);
        if (!text) break;
        const now = Date.now();
        me.chatT = me.chatT.filter(t => now - t < 8000);
        if (me.chatT.length >= 5) break;
        me.chatT.push(now);
        const party = m.channel === 'party';
        if (party && !me.party) {
          send(me, { t: 'sys', text: '先設定組隊代碼，才能使用小隊聊天。' });
          break;
        }
        const chat = { t: 'chat', id: me.id, name: me.name, text, zone: me.zone, channel: party ? 'party' : 'zone' };
        if (!party && me.shard) {
          const { history } = getLineState(me);
          history.push(chat);
          if (history.length > 30) history.shift();
        }
        broadcast(chat, p => party ? p.party === me.party : me.shard ? p.shard === me.shard : p.raid === me.raid);
        break;
      }
      case 'emote':
        if (me.shard && Number.isInteger(m.e) && m.e >= 0 && m.e <= 3) {
          broadcast({ t: 'emote', id: me.id, e: m.e }, p => p.shard === me.shard);
        }
        break;
    }
  });
  ws.on('close', () => {
    guild.disconnect(me);
    closeShardMembership(me);
    players.delete(me.id);
    broadcastOnline();
  });
  ws.on('error', () => {});
});

setInterval(() => {
  guild.tick();
  for (const line of lineState.values()) line.tide.tick(0.1);
  const rooms = new Map();
  for (const p of players.values()) {
    if (!p.shard) continue;
    if (!rooms.has(p.shard)) rooms.set(p.shard, []);
    rooms.get(p.shard).push(p);
  }
  for (const [shard, list] of rooms.entries()) {
    const zone = list[0].zone;
    const grid = zone.startsWith('field:') && list.length > 8 ? new SpatialGrid() : null;
    if (grid) for (const p of list) grid.insert(p);
    for (const me of list) {
      const peers = (grid ? grid.queryNearby(me.x, me.z, 1) : list).filter(p => p !== me);
      send(me, { t: 'snap', zone, shard, count: list.length, players: peers.map(({ id, name, col, x, y, z, f, a }) => ({ id, name, col, x, y, z, f, a })) });
    }
  }
}, 100);

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) ws.terminate();
    else if (ws.readyState === 1) { ws.isAlive = false; ws.ping(); }
  }
}, 30_000);
wss.on('connection', ws => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
wss.on('close', () => clearInterval(heartbeat));
server.listen(PORT, process.env.HOST, () => console.log(`Lantern Vale server on http://localhost:${server.address().port}`));
