const { randomBytes, timingSafeEqual } = require('node:crypto');
const { isIP } = require('node:net');
const { readFileSync } = require('node:fs');

const maxFailures = 5;
const windowMs = 10 * 60 * 1000;
const maxClients = 2048;
const cookieName = '__Host-lv-playtest';
const form = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>燈谷行試玩</title></head>
<body><main><h1>燈谷行試玩</h1><p>輸入邀請人給你的試玩密碼。</p>
<form method="post"><label>試玩密碼 <input type="password" name="pass" required autocomplete="off" autofocus></label>
<button type="submit">進入遊戲</button></form></main></body></html>`;

function createPlaytestGate(file) {
  if (!file) return null;
  const password = readFileSync(file, 'utf8').trim();
  const allowShortPin = process.env.LV_PLAYTEST_ALLOW_SHORT_PIN === '1';
  const validPass = /^[A-Za-z0-9_-]{22,64}$/.test(password) || (allowShortPin && /^[0-9]{4}$/.test(password));
  if (!validPass) throw new Error('Invalid playtest passcode file');
  const session = randomBytes(24).toString('base64url');
  const failures = new Map();
  const trustCloudflare = process.env.LV_PLAYTEST_TRUST_CLOUDFLARE === '1';

  function clientAddress(req) {
    const peer = req.socket.remoteAddress;
    const forwarded = req.headers['cf-connecting-ip'];
    if (trustCloudflare && (peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1') &&
        typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
    return peer;
  }

  function attemptWindow(client, now) {
    const current = failures.get(client);
    if (current && current.until > now) return current;
    if (current) failures.delete(client);
    if (failures.size < maxClients) return null;
    for (const [key, entry] of failures) if (entry.until <= now) failures.delete(key);
    return failures.size < maxClients ? null : { count: maxFailures, until: now + windowMs };
  }

  function blockRetry(res, entry, now) {
    if (!entry || entry.count < maxFailures) return false;
    res.writeHead(429, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': Math.ceil((entry.until - now) / 1000),
    }).end('登入嘗試過多，請稍後再試。');
    return true;
  }

  function same(value, expected) {
    const given = Buffer.from(value || '');
    const wanted = Buffer.from(expected);
    return given.length === wanted.length && timingSafeEqual(given, wanted);
  }
  function authorized(req) {
    return (req.headers.cookie || '').split(';').some(pair => {
      const [name, value] = pair.trim().split('=');
      return name === cookieName && same(value, session);
    });
  }
  async function block(req, res, url) {
    const entry = url.pathname === '/' || url.pathname === '/index.html';
    if (url.pathname === '/__dev/events') { res.setHeader('Cache-Control', 'private, no-store'); res.writeHead(404).end(); return true; }
    if (authorized(req)) return false;
    res.setHeader('Cache-Control', 'private, no-store');
    if (!entry) { res.writeHead(401).end(); return true; }

    if (req.method === 'POST') {
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
        res.writeHead(415).end(); return true;
      }
      const client = clientAddress(req);
      const start = Date.now();
      if (blockRetry(res, attemptWindow(client, start), start)) return true;
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024) { res.writeHead(413, { Connection: 'close' }).end(); return true; }
        chunks.push(chunk);
      }
      // Recheck after reading the body so concurrent attempts use the current count.
      const now = Date.now();
      const entry = attemptWindow(client, now);
      if (blockRetry(res, entry, now)) return true;
      const entered = new URLSearchParams(Buffer.concat(chunks).toString()).get('pass');
      if (same(entered, password)) {
        failures.delete(client);
        res.writeHead(303, {
          Location: url.pathname + url.search,
          'Set-Cookie': `${cookieName}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        }).end();
        return true;
      }
      failures.set(client, { count: (entry?.count || 0) + 1, until: entry?.until || now + windowMs });
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
      return true;
    }
    res.writeHead(req.method === 'POST' ? 401 : 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
    }).end(req.method === 'HEAD' ? undefined : form);
    return true;
  }
  return { authorized, block };
}

module.exports = { createPlaytestGate };
