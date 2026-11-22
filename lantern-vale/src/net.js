// Multiplayer client: presence + chat + emotes over WebSocket. Falls back to offline (NPC villagers).
export class Net {
  constructor() { this.ws = null; this.ok = false; this.id = null; this.online = 1; this.handlers = {}; this.sendT = 0; }
  on(t, fn) { this.handlers[t] = fn; }
  get url() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
    if (window.LV_SERVER && /^https?:$/.test(location.protocol)) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    return null;
  }
  connect(name, color) {
    const url = this.url;
    if (!url) { this.emit('status', { ok: false, reason: 'no-server' }); return; }
    try { this.ws = new WebSocket(url); } catch (e) { this.emit('status', { ok: false, reason: 'error' }); return; }
    this.ws.onopen = () => { this.ok = true; this.send({ t: 'hello', name, color }); this.emit('status', { ok: true }); };
    this.ws.onclose = () => { const was = this.ok; this.ok = false; this.emit('status', { ok: false, reason: was ? 'closed' : 'error' }); };
    this.ws.onerror = () => { };
    this.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'welcome') { this.id = m.id; } if (m.t === 'online') this.online = m.n; this.emit(m.t, m); };
  }
  emit(t, m) { const h = this.handlers[t]; if (h) h(m); }
  send(o) { if (this.ws && this.ok && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
}
