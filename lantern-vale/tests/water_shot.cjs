const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1000);
  await page.click('#btnStart'); await page.waitForTimeout(1000);
  for (const [i, t] of [[0, 'town'], [1, 'run']]) {
    if (i) await page.evaluate(() => { __game.startRun(); });
    await page.evaluate(() => { const g = __game; g.fade = 0; for (let k=0;k<40;k++) g.update(1/30); });
    const pos = await page.evaluate(() => { const g = __game, w = g.world; let best = null, bd = 1e9;
      for (let x = -28; x <= 28; x += 1) for (let z = -28; z <= 28; z += 1) { if (!w.isLand(x, z)) continue; let wat = 1e9; for (let a = 0; a < 6.28; a += 0.4) for (let r = 1; r < 6; r += 1) if (!w.isLand(x + Math.cos(a) * r, z + Math.sin(a) * r)) { wat = Math.min(wat, r); break; } if (wat < 3 && Math.hypot(x, z) < bd) { bd = 0; best = [x, z]; } if (best) break; if (best) break; }
      if (!best) return null; g.player.pos.x = best[0]; g.player.pos.z = best[1]; g.camDistOverride = 22; for (let k = 0; k < 90; k++) g.update(1/30); return best; });
    console.log(t, pos); await page.waitForTimeout(500); await page.screenshot({ path: `shots/fx_water_${t}.png` });
  }
  console.log(errs.join('\n')); await b.close();
})();
