// Dev Tuner → data/flame.json（只在本機 localhost 且非 playtest gate 時可用）
// 只接受「已存在於 flame.json 的數字／布林欄位」，其他一律忽略，避免被亂寫。
const fs = require('node:fs');
const path = require('node:path');
const { isLocalDevRequest } = require('./dev_diagnostics.cjs');

const FLAME_FILE = path.join(__dirname, '..', 'data', 'flame.json');
const maxBytes = 64 * 1024;

function merge(target, patch, state) {
  for (const key of Object.keys(target)) {
    if (key === 'variants' || key.startsWith('_') || !(key in (patch || {}))) continue;
    const cur = target[key], next = patch[key];
    if (cur && typeof cur === 'object' && next && typeof next === 'object') merge(cur, next, state);
    else if (typeof cur === 'number' && typeof next === 'number' && Number.isFinite(next) && cur !== next) { target[key] = next; state.changed++; }
    else if (typeof cur === 'boolean' && typeof next === 'boolean' && cur !== next) { target[key] = next; state.changed++; }
  }
}

async function receiveDevTune(req, res) {
  if (!isLocalDevRequest(req)) return res.writeHead(404).end();
  if (req.method !== 'POST') return res.writeHead(405, { Allow: 'POST' }).end();
  if (req.headers.origin !== 'http://' + req.headers.host) return res.writeHead(403).end();
  if (req.headers['content-type'] !== 'application/json') return res.writeHead(415).end();
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) return res.writeHead(413, { Connection: 'close' }).end();
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return res.writeHead(400).end(); }
  if (!body || typeof body.flame !== 'object') return res.writeHead(400).end();
  const data = JSON.parse(fs.readFileSync(FLAME_FILE, 'utf8'));
  const state = { changed: 0 };
  merge(data, body.flame, state);
  if (state.changed) fs.writeFileSync(FLAME_FILE, JSON.stringify(data, null, 2) + '\n');
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, changed: state.changed }));
}

module.exports = { receiveDevTune, merge };
