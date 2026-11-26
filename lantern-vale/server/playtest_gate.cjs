const { randomBytes, timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');

const cookieName = '__Host-lv-playtest';
const form = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Beaconfall 試玩</title></head>
<body><main><h1>Beaconfall 試玩</h1><p>輸入邀請人給你的試玩密碼。</p>
<form method="post"><label>試玩密碼 <input type="password" name="pass" required autocomplete="off" autofocus></label>
<button type="submit">進入遊戲</button></form></main></body></html>`;

function createPlaytestGate(file) {
  if (!file) return null;
  const password = readFileSync(file, 'utf8').trim();
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(password)) throw new Error('Invalid playtest passcode file');
  const session = randomBytes(24).toString('base64url');
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
    res.setHeader('Cache-Control', 'private, no-store');
    if (url.pathname === '/__dev/events') { res.writeHead(404).end(); return true; }
    if (authorized(req)) return false;
    if (!entry) { res.writeHead(401).end(); return true; }

    if (req.method === 'POST') {
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
        res.writeHead(415).end(); return true;
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024) { res.writeHead(413, { Connection: 'close' }).end(); return true; }
        chunks.push(chunk);
      }
      const entered = new URLSearchParams(Buffer.concat(chunks).toString()).get('pass');
      if (same(entered, password)) {
        res.writeHead(303, {
          Location: url.pathname + url.search,
          'Set-Cookie': `${cookieName}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        }).end();
        return true;
      }
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
