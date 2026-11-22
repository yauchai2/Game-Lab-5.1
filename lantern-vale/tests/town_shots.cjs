const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1200);
  await page.click('#btnStart'); await page.waitForTimeout(1200);
  const spots = [['overview', 0, 0, 62], ['tavern', -10, -6, 29], ['market_pond', 5, 9, 29], ['gate', 0, -13, 29]];
  for (const [n, x, z, d] of spots) {
    await page.evaluate(([x, z, d]) => { const g = __game; g.fade = 0; g.player.pos.x = x; g.player.pos.z = z; g.camDistOverride = d; for (let i=0;i<60;i++) g.update(1/30); }, [x, z, d]);
    await page.waitForTimeout(400); await page.screenshot({ path: `shots/town_${n}.png` });
  }
  console.log(errs.join('\n')); await b.close();
})();
