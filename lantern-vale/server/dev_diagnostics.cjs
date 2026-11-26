const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { redactDevText } = require('../src/dev_log_sanitize.cjs');

const filename = process.env.LV_DEV_LOG_DB || path.join(__dirname, 'data', 'dev-diagnostics.sqlite');
const retention = 7 * 24 * 60 * 60 * 1000;
const maxEvents = 5000;
const maxBytes = 64 * 1024;
const idPattern = /^[a-f0-9]{32}:[1-9]\d{0,9}$/;
const levels = new Set(['debug', 'info', 'log', 'warn', 'error']);
const kinds = new Set(['mode', 'console', 'uncaught', 'resource', 'promise', 'game', 'performance']);

function isLocalDevRequest(req) {
  const address = req.socket.remoteAddress;
  return process.env.LV_DEV_LOGS !== '0' &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(req.headers.host || '') &&
    !req.headers.forwarded && !req.headers['x-forwarded-for'];
}

function openDevLog(readOnly = false) {
  if (readOnly) return new DatabaseSync(filename, { readOnly: true });
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    // SQLite can otherwise create the evidence file with the process's default umask.
    fs.closeSync(fs.openSync(filename, 'a', 0o600));
  }
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=3000;
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      received INTEGER NOT NULL, event TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review (id INTEGER PRIMARY KEY CHECK (id = 1), cursor INTEGER NOT NULL);
  `);
  return db;
}

function normalize(event, now) {
  if (!levels.has(event.level) || !kinds.has(event.kind) || !Number.isFinite(event.time) ||
      event.time < now - retention || event.time > now + 300000) return null;
  const text = redactDevText(event.text, 1600);
  if (!text) return null;
  const result = {
    id: event.id, time: event.time, level: event.level, kind: event.kind, text,
    build: /^[a-f0-9]{12}$/.test(event.build) ? event.build : 'unknown',
  };
  for (const key of ['zone', 'shard', 'state', 'viewport']) {
    if (typeof event[key] === 'string' && /^[\w:#-]{1,60}$/.test(event[key])) result[key] = event[key];
  }
  for (const key of ['fps', 'frameMs', 'drawCalls', 'triangles', 'geometries', 'textures']) {
    if (Number.isFinite(event[key]) && event[key] >= 0 && event[key] <= 10000000) result[key] = event[key];
  }
  return result;
}

let store;
async function receiveDevEvents(req, res) {
  if (!isLocalDevRequest(req)) return res.writeHead(404).end();
  if (req.method !== 'POST') return res.writeHead(405, { Allow: 'POST' }).end();
  if (req.headers.origin !== 'http://' + req.headers.host) return res.writeHead(403).end();
  if (req.headers['content-type'] !== 'application/json') return res.writeHead(415).end();
  if (Number(req.headers['content-length']) > maxBytes) return res.writeHead(413, { Connection: 'close' }).end();

  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      res.writeHead(413, { Connection: 'close' }).end();
      return;
    }
    chunks.push(chunk);
  }
  let events;
  try { events = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) { return res.writeHead(400).end(); }
  if (!Array.isArray(events) || events.length > 8) return res.writeHead(400).end();

  store ||= openDevLog();
  const now = Date.now();
  const handled = [];
  const insert = store.prepare('INSERT OR IGNORE INTO events(id, received, event) VALUES (?, ?, ?)');
  store.exec('BEGIN IMMEDIATE');
  try {
    for (const event of events) {
      if (!event || typeof event.id !== 'string' || !idPattern.test(event.id)) continue;
      const clean = normalize(event, now);
      if (clean) insert.run(event.id, now, JSON.stringify(clean));
      handled.push(event.id);
    }
    store.prepare('DELETE FROM events WHERE received < ?').run(now - retention);
    store.prepare('DELETE FROM events WHERE seq < (SELECT seq FROM events ORDER BY seq DESC LIMIT 1 OFFSET ?)').run(maxEvents - 1);
    store.exec('COMMIT');
  } catch (error) {
    store.exec('ROLLBACK');
    throw error;
  }
  return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    .end(JSON.stringify({ handled }));
}

module.exports = { isLocalDevRequest, receiveDevEvents, openDevLog, filename, retention };
