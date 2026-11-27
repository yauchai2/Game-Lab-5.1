// Multiplayer presence, chat and zone channels over WebSocket.
export const cleanPartyCode = value => String(value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);

export class Net {
  constructor() {
    this.ws = null; this.ok = false; this.id = null; this.online = 1; this.handlers = {};
    this.dungeonLobbies = false; this.zoneShards = false; this.shard = null; this.shardListing = null;
  }
  on(t, fn) { this.handlers[t] = fn; }
  get url() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
    if (window.LV_SERVER && /^https?:$/.test(location.protocol)) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    return null;
  }
  resetConnection() {
    const socket = this.ws;
    this.ws = null; this.ok = false; this.id = null; this.online = 1;
    this.dungeonLobbies = false; this.zoneShards = false; this.shard = null; this.shardListing = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
  }
  disconnect() {
    this.resetConnection();
    this.emit('status', { ok: false, reason: 'idle' });
  }
  connect(name, color, party = '') {
    this.resetConnection();
    const url = this.url;
    if (!url) { this.emit('status', { ok: false, reason: 'no-server' }); return; }
    let socket;
    try { socket = new WebSocket(url); } catch { this.emit('status', { ok: false, reason: 'error' }); return; }
    this.ws = socket;
    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.ok = true;
      this.send({ t: 'hello', name, color, party, dungeonAttacks: 2, dungeonRootAttacks: true, dungeonBurstAttacks: true, dungeonStagParts: true });
      this.emit('status', { ok: true });
    };
    socket.onclose = () => {
      if (this.ws !== socket) return;
      const was = this.ok;
      this.resetConnection();
      this.emit('status', { ok: false, reason: was ? 'closed' : 'error' });
    };
    socket.onmessage = ev => {
      if (this.ws !== socket) return;
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'welcome') { this.id = m.id; this.zoneShards = m.zoneShards === true; this.dungeonLobbies = m.dungeonLobbies === true; }
      if (m.t === 'online') this.online = m.n;
      this.emit(m.t, m);
    };
  }
  emit(t, m) { const h = this.handlers[t]; if (h) h(m); }
  send(data) {
    if (!this.ok || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }
}
