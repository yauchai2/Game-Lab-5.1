const { chromium } = require('playwright');
const tag = process.argv[2] || 'b';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1500);
  await page.click('#btnStart'); await page.waitForTimeout(800);
  await page.evaluate(() => __game.startRun()); await page.waitForTimeout(600);
  for (const d of [0,3,6]) {
    await page.evaluate(d => { __game.loadRoom(d,'item'); __game.fade=0; for(let i=0;i<40;i++) __game.update(1/30); }, d);
    await page.waitForTimeout(700); await page.screenshot({ path: `shots/${tag}_d${d}.png` });
  }
  console.log('ERR', errs.join('\n')); await b.close();
})();
