const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForTimeout(1200);
  await page.click('#btnStart'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = __game, W = g.world, p = g.player; g.fade = 0; for (const e of g.enemies) g.killEnemy(e); g.enemies = []; g.waves = []; g.cleared = true;
    let found = null;
    for (let k = 0; k < W.walk.length && !found; k++) if (W.walk[k]) { const i = k % 121, j = (k / 121) | 0; if (j < 8 || i < 8 || i > 112 || j > 112) continue;
      if (W.height[(j-3)*121+i] > 2.4) found = { x: -30 + i * 0.5, z: -30 + j * 0.5 }; }
    p.pos.set(found.x, 0, found.z + 0.5); g.keys = { w: true };
    for (let i = 0; i < 14; i++) g.update(1/30);
  });
  await page.mouse.move(640, 200); await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/v_climb.png' });
  await page.evaluate(() => { const g = __game; for (let i = 0; i < 60; i++) g.update(1/30); g.keys = { s: true, ' ': true }; g.tryJump(); for (let i = 0; i < 16; i++) g.update(1/30); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/v_glide.png' });
  await browser.close();
})();
