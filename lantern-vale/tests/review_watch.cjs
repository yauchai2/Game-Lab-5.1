const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const gameDir = path.join(rootDir, 'game');
const reviewDir = path.join(rootDir, 'review');
const outDir = path.join(reviewDir, 'output');
const reqFile = path.join(reviewDir, 'request.json');
const doneFile = path.join(reviewDir, 'done.json');

fs.mkdirSync(outDir, { recursive: true });

let playwright;
for (const p of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
  try { playwright = require(p); break; } catch (_) {}
}
if (!playwright) {
  console.error('Missing playwright. Install with: npm i -g playwright');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function startStaticServer() {
  const srv = http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const fp = path.join(gameDir, rel === '/' ? 'index.html' : rel);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}

async function runCapture(req) {
  const id = req.id || String(Date.now());
  const width = req.width || 1280;
  const height = req.height || 720;
  const shots = req.shots || ['title', 'town', 'field:1', 'field:10', 'field:12'];
  const recordVideo = req.recordVideo !== false;
  const runDir = path.join(outDir, id);
  fs.mkdirSync(runDir, { recursive: true });

  const { srv, url } = await startStaticServer();
  const errors = [];
  const savedShots = [];
  let videoFile = null;

  console.log(`\n[${id}] Starting capture (${shots.join(', ')})...`);
  const browser = await playwright.chromium.launch({
    channel: 'chromium',
    headless: req.headless !== false,
    args: ['--ignore-gpu-blocklist', '--enable-webgl'],
  });

  try {
    const ctxOpts = { viewport: { width, height } };
    if (recordVideo) ctxOpts.recordVideo = { dir: runDir, size: { width, height } };
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();

    page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__game), { timeout: 15000 });
    await page.waitForTimeout(2600);

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const safeName = `${String(i + 1).padStart(2, '0')}_${shot.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      if (shot === 'title') {
        await page.waitForTimeout(600);
      } else if (shot === 'town') {
        await page.evaluate(() => {
          const btn = document.getElementById('btnStart');
          if (btn && !document.getElementById('title')?.classList.contains('hide')) btn.click();
          else window.__game.enterTown();
        });
        await page.waitForTimeout(2000);
      } else if (shot === 'harbor') {
        await page.evaluate(() => {
          const btn = document.getElementById('btnStart');
          if (btn && !document.getElementById('title')?.classList.contains('hide')) btn.click();
          window.__game.enterHarbor();
        });
        await page.waitForTimeout(1800);
      } else if (shot.startsWith('field:')) {
        const fid = Number(shot.split(':')[1]) || 1;
        await page.evaluate((n) => {
          const btn = document.getElementById('btnStart');
          if (btn && !document.getElementById('title')?.classList.contains('hide')) btn.click();
          window.__game.enterField(n);
        }, fid);
        await page.waitForTimeout(1800);
        if (recordVideo) {
          await page.keyboard.down('KeyW');
          await page.waitForTimeout(550);
          await page.keyboard.up('KeyW');
          await page.keyboard.press('KeyQ');
          await page.waitForTimeout(650);
        }
      } else if (shot === 'ui:map') {
        await page.evaluate(() => window.__game.ui.openMap?.());
        await page.waitForTimeout(600);
      } else if (shot === 'ui:bag') {
        await page.evaluate(() => { window.__game.ui.mapDialog?.close(); window.__game.ui.toggleInv(window.__game); });
        await page.waitForTimeout(600);
      } else if (shot === 'ui:puzzle') {
        await page.evaluate(() => { if (window.__game.ui.invOpen) window.__game.ui.toggleInv(window.__game); window.__game.ui.openPuzzle?.(); });
        await page.waitForTimeout(600);
      }

      const filePath = path.join(runDir, safeName);
      await page.screenshot({ path: filePath });
      savedShots.push(filePath);
      console.log(`  Captured: ${safeName}`);

      if (shot.startsWith('ui:')) {
        await page.evaluate(() => {
          const g = window.__game;
          g.ui.mapDialog?.close();
          if (g.ui.invOpen) g.ui.toggleInv(g);
          if (g.ui.puzzleOpen) g.ui.closePuzzle?.();
        });
      }
    }

    const vid = recordVideo ? page.video() : null;
    await ctx.close();
    if (vid) {
      const webmPath = await vid.path();
      const mp4Path = path.join(runDir, 'gameplay.mp4');
      try {
        execFileSync('ffmpeg', ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path], { stdio: 'ignore' });
        fs.unlinkSync(webmPath);
        videoFile = mp4Path;
        console.log('  Video saved: gameplay.mp4');
      } catch (_) {
        videoFile = webmPath;
        console.log(`  Video saved: ${path.basename(webmPath)}`);
      }
    }
  } finally {
    await browser.close();
    srv.close();
  }

  const result = { id, completedAt: new Date().toISOString(), shots: savedShots, video: videoFile, errors };
  fs.writeFileSync(doneFile, JSON.stringify(result, null, 2));
  console.log(`DONE [${id}] errors=${errors.length} -> review/done.json`);
}

(async () => {
  const mode = process.argv.includes('--watch') ? 'watch' : 'once';
  if (mode === 'once') {
    const req = fs.existsSync(reqFile) ? JSON.parse(fs.readFileSync(reqFile, 'utf8')) : { id: 'latest' };
    await runCapture(req);
  } else {
    console.log('Lantern Vale Review Watcher started!');
    console.log(`Watching: ${reqFile}`);
    console.log('Keep this window open; press Ctrl+C to stop.');
    let lastKey = null;
    let busy = false;
    const poll = async () => {
      if (busy || !fs.existsSync(reqFile)) return;
      try {
        const req = JSON.parse(fs.readFileSync(reqFile, 'utf8'));
        const key = `${req.id || ''}_${fs.statSync(reqFile).mtimeMs}`;
        if (key !== lastKey) {
          lastKey = key;
          busy = true;
          await runCapture(req);
          busy = false;
        }
      } catch (e) {
        busy = false;
        console.error('Task error:', e.message);
      }
    };
    setInterval(poll, 1000);
    await poll();
  }
})();
