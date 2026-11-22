// Lantern Vale multiplayer server: static hosting + WebSocket presence/chat.
// Run:  npm i ws  &&  node server/server.js   (then open http://localhost:8080 — share your LAN/public URL with friends)
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
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
  ws.send(JSON.stringify({ t: 'welcome', id: me.id, history }));
  broadcast({ t: 'online', n: players.size });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hello') { me.name = clean(m.name, 12) || me.name; me.col = (+m.color | 0) % 8; broadcast({ t: 'sys', text: `${me.name} 來到了燈谷` }); }
    else if (m.t === 'pos') { me.zone = clean(m.zone, 40); me.x = num(m.x); me.y = num(m.y); me.z = num(m.z); me.f = num(m.f); me.a = m.a | 0; }
    else if (m.t === 'chat') {
      const now = Date.now(); me.chatT = me.chatT.filter(t => now - t < 8000); if (me.chatT.length >= 5) return; me.chatT.push(now);
      const text = clean(m.text, 120); if (!text) return;
      const msg = { t: 'chat', id: me.id, name: me.name, text, zone: me.zone }; history.push(msg); if (history.length > 30) history.shift(); broadcast(msg);
    } else if (m.t === 'emote') broadcast({ t: 'emote', id: me.id, e: m.e | 0 }, p => p.zone === me.zone);
  });
  ws.on('close', () => { players.delete(me.id); broadcast({ t: 'online', n: players.size }); broadcast({ t: 'gone', id: me.id }); });
  ws.on('error', () => { });
});
setInterval(() => { // 10 Hz snapshots, per zone
  const zones = new Map();
  for (const p of players.values()) { if (!zones.has(p.zone)) zones.set(p.zone, []); zones.get(p.zone).push(p); }
  for (const list of zones.values()) for (const me of list) {
    if (me.ws.readyState !== 1) continue;
    me.ws.send(JSON.stringify({ t: 'snap', players: list.filter(o => o !== me).map(o => ({ id: o.id, name: o.name, col: o.col, x: o.x, y: o.y, z: o.z, f: o.f, a: o.a })) }));
  }
}, 100);
server.listen(PORT, () => console.log(`Lantern Vale server on http://localhost:${PORT}`));
