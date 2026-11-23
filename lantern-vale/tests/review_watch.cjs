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
  '.glb': 'model/gltf-binary',
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
  const DEFAULT_SHOTS = ['title', 'town', 'ui:bag', 'ui:puzzle', 'ui:souls', 'ui:atlas', 'ui:forge', 'ui:map', 'field:1', 'combat:elements', 'combat:tide', 'field:12', 'boss'];
  const rawShots = req.shots || DEFAULT_SHOTS;
  const isLegacyAuto = Array.isArray(rawShots) && ((rawShots.length === 5 && rawShots[0] === 'title' && rawShots[3] === 'field:10') || (rawShots.length === 12 && !rawShots.includes('combat:tide')));
  const shots = isLegacyAuto ? DEFAULT_SHOTS : rawShots;
  const recordVideo = req.recordVideo !== false;
  const runDir = path.join(outDir, id);
  fs.mkdirSync(runDir, { recursive: true });

  const { srv, url } = await startStaticServer();
  const errors = [];
  const savedShots = [];
  let videoFile = null;
  let tideClipStart = null;
  let tideClipEnd = null;
  const recStartMs = Date.now();

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
    await page.waitForTimeout(2200);

    const ensureStarted = async () => {
      await page.evaluate(() => {
        const btn = document.getElementById('btnStart');
        if (btn && !document.getElementById('title')?.classList.contains('hide')) btn.click();
      });
    };

    const closeAllUI = async () => {
      await page.evaluate(() => {
        const g = window.__game;
        g.ui.mapDialog?.close();
        if (g.ui.panelOpen) g.ui.closePanel?.();
        if (g.ui.invOpen) g.ui.toggleInv(g);
        if (g.ui.puzzleOpen) g.ui.closePuzzle?.();
      });
    };

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const safeName = `${String(i + 1).padStart(2, '0')}_${shot.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      if (shot === 'title') {
        await page.waitForTimeout(500);
      } else if (shot === 'town') {
        await page.evaluate(() => {
          const btn = document.getElementById('btnStart');
          if (btn && !document.getElementById('title')?.classList.contains('hide')) btn.click();
          else window.__game.enterTown();
        });
        await page.waitForTimeout(1600);
      } else if (shot === 'harbor') {
        await ensureStarted();
        await page.evaluate(() => window.__game.enterHarbor());
        await page.waitForTimeout(1500);
      } else if (shot.startsWith('spot:')) {
        const [, fidStr, uStr, vStr] = shot.split(':');
        const fid = Number(fidStr) || 1;
        const u = Number(uStr) || 0.5;
        const v = Number(vStr) || 0.5;
        await ensureStarted();
        await closeAllUI();
        await page.evaluate(({ n, uu, vv }) => {
          const g = window.__game;
          if (g.field !== n) g.enterField(n);
          const half = g.world.half || 120;
          const x = (uu - 0.5) * half * 2;
          const z = (vv - 0.5) * half * 2 + 8.5;
          const y = g.world.gh(x, z);
          g.player.pos.set(x, y, z);
          g.player.y = y;
          g.player.facing = Math.PI;
          g.camPos.set(x, 0, z - 4.5);
        }, { n: fid, uu: u, vv: v });
        await page.waitForTimeout(1600);
      } else if (shot.startsWith('field:')) {
        const fid = Number(shot.split(':')[1]) || 1;
        await ensureStarted();
        await closeAllUI();
        await page.evaluate((n) => window.__game.enterField(n), fid);
        await page.waitForTimeout(1500);
        if (fid === 1) {
          // 額外拍攝 Phase 2B 首批三張重製地圖地標與專屬低面怪物特寫（不影響原 13 鏡頭清單）
          const snapSpot = async (fname, fNum, u, v, dz = 9.0, spawnNear = null) => {
            await page.evaluate(({ n, uu, vv, offZ, sn }) => {
              const g = window.__game;
              if (g.field !== n) g.enterField(n);
              const half = g.world.half || 120;
              const x = (uu - 0.5) * half * 2;
              const z = (vv - 0.5) * half * 2 + offZ;
              const y = g.world.gh(x, z);
              g.player.pos.set(x, y, z);
              g.player.y = y;
              g.player.facing = Math.PI;
              g.camPos.set(x, 0, z - 4.0);
              if (sn) {
                const e = g.spawnEnemy(sn.type, { x: x + (sn.dx || 2.8), z: z + (sn.dz || -3.6) }, !!sn.elite);
                e.level = [0, 3, 7, 12, 16, 22, 26, 14, 20, 26, 16, 24, 29][n] || 10;
                e.hp = e.maxHp;
              }
            }, { n: fNum, uu: u, vv: v, offZ: dz, sn: spawnNear });
            await page.waitForTimeout(1100);
            await page.screenshot({ path: path.join(runDir, fname) });
          };
          await snapSpot('p2b_01_f1_windmill.png', 1, 0.24, 0.74, 10.5, { type: 'slime', elite: true, dx: 3.5, dz: -3.2 });
          await snapSpot('p2b_02_f1_teapot.png', 1, 0.84, 0.27, 11.5);
          await snapSpot('p2b_03_f4_summit.png', 4, 0.21, 0.22, 11.0, { type: 'boar', elite: false, dx: 3.6, dz: -3.0 });
          await snapSpot('p2b_04_f4_icespires.png', 4, 0.85, 0.20, 11.5, { type: 'boar', elite: true, dx: -3.2, dz: -3.5 });
          await snapSpot('p2b_05_f7_lighthouse.png', 7, 0.74, 0.56, 11.5, { type: 'skyray', elite: false, dx: 3.2, dz: -3.2 });
          await snapSpot('p2b_06_f7_aqueduct.png', 7, 0.54, 0.17, 11.0, { type: 'skyray', elite: true, dx: -2.8, dz: -3.5 });
          // Phase 2C：其餘全部 9 張重製野外地圖實機奇觀與專屬怪物特寫
          await snapSpot('p2c_f02_whisper_forest.png', 2, 0.15, 0.80, 10.5, { type: 'thorn', elite: true, dx: 3.2, dz: -3.0 });
          await snapSpot('p2c_f03_mist_marsh.png', 3, 0.50, 0.54, 11.5, { type: 'moth', elite: true, dx: 3.4, dz: -3.2 });
          await snapSpot('p2c_f05_ember_volcano.png', 5, 0.51, 0.53, 12.0, { type: 'boar', elite: true, dx: 3.4, dz: -3.2 });
          await snapSpot('p2c_f06_ancient_woods.png', 6, 0.52, 0.52, 14.0, { type: 'golem', elite: false, dx: 4.0, dz: -3.5 });
          await snapSpot('p2c_f08_coral_bay.png', 8, 0.24, 0.43, 12.0, { type: 'skyray', elite: false, dx: 3.2, dz: -3.0 });
          await snapSpot('p2c_f09_sunken_city.png', 9, 0.66, 0.54, 11.5, { type: 'thorn', elite: false, dx: 3.2, dz: -3.0 });
          await snapSpot('p2c_f10_sakura_city.png', 10, 0.19, 0.22, 12.0, { type: 'moth', elite: false, dx: 3.2, dz: -3.2 });
          await snapSpot('p2c_f11_sky_rings.png', 11, 0.56, 0.34, 12.5, { type: 'skyray', elite: false, dx: 3.2, dz: -3.0 });
          await snapSpot('p2c_f12_maple_forge.png', 12, 0.66, 0.48, 12.0, { type: 'golem', elite: true, dx: 3.5, dz: -3.2 });
          // 切回 field:1 正常狀態，確保 09_field_1.png 與後續鏡頭一致
          await page.evaluate(() => window.__game.enterField(1));
          await page.waitForTimeout(1000);
        }
        if (recordVideo) {
          await page.keyboard.down('KeyW');
          await page.waitForTimeout(450);
          await page.keyboard.up('KeyW');
          await page.keyboard.press('KeyQ');
          await page.waitForTimeout(550);
          await page.keyboard.press('Space');
          await page.waitForTimeout(350);
        }
      } else if (shot === 'combat:elements') {
        await ensureStarted();
        await closeAllUI();
        await page.evaluate(() => {
          const g = window.__game;
          if (!g.field) g.enterField(1);
          const p = g.player;
          g.spawnGroundZone('water', p.pos.x, p.pos.z - 2.6, 3.0, 9, 0.2);
          g.applyElementAt(p.pos.x, p.pos.z - 2.6, 'frost', 3.0);
        });
        await page.waitForTimeout(450);
        await page.evaluate(() => {
          const g = window.__game, p = g.player;
          g.applyElementAt(p.pos.x, p.pos.z - 2.6, 'fire', 3.0);
        });
        await page.waitForTimeout(450);
        await page.evaluate(() => {
          const g = window.__game, p = g.player;
          g.applyElementAt(p.pos.x, p.pos.z - 2.6, 'shock', 3.4);
        });
        await page.waitForTimeout(500);
      } else if (shot === 'combat:tide') {
        await ensureStarted();
        await closeAllUI();
        await page.evaluate(() => window.__game.enterField(1));
        await page.waitForTimeout(600);
        tideClipStart = Math.max(0, (Date.now() - recStartMs) / 1000 - 0.3);
        await page.evaluate(() => window.__game.triggerTideDemo?.('storm'));
        await page.waitForTimeout(1600);
        await page.screenshot({ path: path.join(runDir, 'tide_01_lantern_storm.png') });
        await page.keyboard.press('KeyQ');
        await page.waitForTimeout(900);
        await page.evaluate(() => window.__game.triggerTideDemo?.('hound'));
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(runDir, 'tide_02_big_puppy.png') });
        await page.waitForTimeout(1100);
        await page.evaluate(() => window.__game.triggerTideDemo?.('daybreak'));
        await page.waitForTimeout(650);
        await page.screenshot({ path: path.join(runDir, 'tide_03_daybreak.png') });
        await page.waitForTimeout(1100);
        await page.evaluate(() => window.__game.triggerTideDemo?.('apex'));
        await page.waitForTimeout(1800);
        await page.screenshot({ path: path.join(runDir, 'tide_04_apex_boss.png') });
        await page.evaluate(() => window.__game.triggerTideDemo?.('lull'));
        await page.waitForTimeout(1800);
        await page.screenshot({ path: path.join(runDir, 'tide_05_lull_camp.png') });
        tideClipEnd = (Date.now() - recStartMs) / 1000 + 0.3;
      } else if (shot === 'boss') {
        await ensureStarted();
        await closeAllUI();
        await page.evaluate(() => {
          const g = window.__game;
          g.field = 0; g.state = 'play';
          g.loadRoom(9, null, false);
          g.waveIdx = 0; g.spawnWave();
        });
        await page.waitForTimeout(1400);
        if (recordVideo) {
          await page.keyboard.press('KeyQ');
          await page.waitForTimeout(500);
          await page.keyboard.press('Space');
          await page.waitForTimeout(450);
        }
      } else if (shot === 'ui:map') {
        await ensureStarted(); await closeAllUI();
        await page.evaluate(() => window.__game.ui.openMap?.());
        await page.waitForTimeout(550);
      } else if (shot === 'ui:bag') {
        await ensureStarted(); await closeAllUI();
        await page.evaluate(() => window.__game.ui.openInvTab?.(window.__game, 'bag'));
        await page.waitForTimeout(650);
      } else if (shot === 'ui:souls') {
        await ensureStarted(); await closeAllUI();
        await page.evaluate(() => window.__game.ui.openInvTab?.(window.__game, 'souls'));
        await page.waitForTimeout(550);
      } else if (shot === 'ui:atlas') {
        await ensureStarted(); await closeAllUI();
        await page.evaluate(() => window.__game.ui.openInvTab?.(window.__game, 'atlas'));
        await page.waitForTimeout(550);
      } else if (shot === 'ui:puzzle') {
        await ensureStarted(); await closeAllUI();
        await page.evaluate(() => window.__game.ui.openPuzzle?.());
        await page.waitForTimeout(650);
      } else if (shot === 'ui:forge') {
        await ensureStarted(); await closeAllUI();
        await page.evaluate(() => window.__game.ui.openPanel?.('forge'));
        await page.waitForTimeout(600);
      }

      const filePath = path.join(runDir, safeName);
      await page.screenshot({ path: filePath });
      savedShots.push(filePath);
      console.log(`  Captured: ${safeName}`);

      if (shot.startsWith('ui:')) await closeAllUI();
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
        if (tideClipStart !== null && tideClipEnd !== null && tideClipEnd > tideClipStart + 1) {
          const tideMp4 = path.join(runDir, 'ember_tide_demo.mp4');
          execFileSync('ffmpeg', ['-y', '-ss', tideClipStart.toFixed(2), '-to', tideClipEnd.toFixed(2), '-i', mp4Path, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tideMp4], { stdio: 'ignore' });
          console.log('  Video saved: ember_tide_demo.mp4');
        }
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
