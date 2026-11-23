// Lantern Vale multiplayer server: static hosting + WebSocket presence/chat.
// Run:  npm i ws  &&  node server/server.js   (then open http://localhost:8080 — share your LAN/public URL with friends)
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const guild = require('./guild.cjs')(process.env.LV_DATABASE || path.join(__dirname, 'data', 'guild.sqlite'));
const { SpatialGrid, ZoneTide, pickHotspots } = require('./zone_engine.cjs');
const zoneTides = new Map();
const getZoneTide = z => { let t = zoneTides.get(z); if (!t) { t = new ZoneTide(z); zoneTides.set(z, t); } return t; };
const PORT = +process.env.PORT || 8080;
const GAME = path.join(__dirname, '..', 'game', 'index.html');
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/?') || req.url === '/index.html') {
    let html = fs.readFileSync(GAME, 'utf8').replace('<script>', '<script>window.LV_SERVER=true;');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
  } else if (req.url === '/health') { res.writeHead(200); res.end('ok'); }
  else { res.writeHead(404); res.end('not found'); }
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const players = new Map(); let nextId = 1;
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
const num = v => (Number.isFinite(+v) ? Math.round(+v * 100) / 100 : 0);
const history = [];
function broadcast(obj, filter) { const m = JSON.stringify(obj); for (const p of players.values()) if (p.ws.readyState === 1 && (!filter || filter(p))) p.ws.send(m); }
wss.on('connection', ws => {
  const me = { id: nextId++, ws, name: '旅人' + Math.floor(Math.random() * 900 + 100), col: 0, zone: 'town', x: 0, y: 0, z: 0, f: 0, a: 0, last: 0, chatT: [] };
  players.set(me.id, me);
  ws.send(JSON.stringify({ t: 'welcome', id: me.id, history, hotspots: pickHotspots() }));
  broadcast({ t: 'online', n: players.size });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (['guildHello','trade','raidJoin','raidLeave','raidInput'].includes(m.t)) { guild.message(me,m); return; }
    if (m.t === 'hello') { me.name = clean(m.name, 12) || me.name; me.col = Math.max(0, (+m.color | 0) % 8); broadcast({ t: 'sys', text: `${me.name} 來到了燈谷` }); }
    else if (m.t === 'pos') { me.zone = clean(m.zone, 40); me.x = num(m.x); me.y = num(m.y); me.z = num(m.z); me.f = num(m.f); me.a = m.a | 0; }
    else if (m.t === 'tide_kill') {
      const zPlayers = [...players.values()].filter(p => p.zone === me.zone).length;
      const snap = getZoneTide(me.zone).addKill(Math.max(1, Math.min(5, +m.weight || 1)), zPlayers);
      broadcast({ t: 'tide_sync', ...snap }, p => p.zone === me.zone);
    }
    else if (m.t === 'chat') {
      const now = Date.now(); me.chatT = me.chatT.filter(t => now - t < 8000); if (me.chatT.length >= 5) return; me.chatT.push(now);
      const text = clean(m.text, 120); if (!text) return;
      const msg = { t: 'chat', id: me.id, name: me.name, text, zone: me.zone }; history.push(msg); if (history.length > 30) history.shift(); broadcast(msg);
    } else if (m.t === 'emote') broadcast({ t: 'emote', id: me.id, e: m.e | 0 }, p => p.zone === me.zone);
  });
  ws.on('close', () => { guild.disconnect(me); players.delete(me.id); broadcast({ t: 'online', n: players.size }); broadcast({ t: 'gone', id: me.id }); });
  ws.on('error', () => { });
});
setInterval(() => { // 10 Hz snapshots, per zone with 30m×30m AOI spatial culling
  guild.tick();
  for (const t of zoneTides.values()) t.tick(0.1);
  const zones = new Map();
  for (const p of players.values()) { if (!zones.has(p.zone)) zones.set(p.zone, []); zones.get(p.zone).push(p); }
  for (const [zoneName, list] of zones.entries()) {
    const grid = new SpatialGrid();
    for (const p of list) grid.insert(p);
    const useAoi = zoneName.startsWith('field:') && list.length > 8;
    for (const me of list) {
      if (me.ws.readyState !== 1) continue;
      const peers = (useAoi ? grid.queryNearby(me.x, me.z, 1) : list).filter(o => o !== me);
      me.ws.send(JSON.stringify({ t: 'snap', players: peers.map(o => ({ id: o.id, name: o.name, col: o.col, x: o.x, y: o.y, z: o.z, f: o.f, a: o.a })) }));
    }
  }
}, 100);
server.listen(PORT, () => console.log(`Lantern Vale server on http://localhost:${server.address().port}`));
