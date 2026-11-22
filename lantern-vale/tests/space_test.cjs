const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1200);
  await page.click('#btnStart'); await page.waitForTimeout(1000);
  const st = () => page.evaluate(() => { const p=__game.player; return { roll: +p.roll.toFixed(2), air: p.air, y: +p.y.toFixed(2) }; });
  await page.evaluate(() => { __game.fade=0; });
  await page.keyboard.press(' '); await page.waitForTimeout(60); console.log('single', await st());
  await page.waitForTimeout(1200);
  await page.keyboard.press(' '); await page.waitForTimeout(80); await page.keyboard.down(' '); await page.waitForTimeout(150); console.log('double', await st());
  for (let i=0;i<5;i++){ await page.waitForTimeout(150); console.log('hold', await page.evaluate(()=>{const p=__game.player;return [p.gliding,p.air,+p.vy.toFixed(1),+p.y.toFixed(2),!!__game.keys[' ']]})); } await page.keyboard.up(' ');
  console.log('ERR', errs.join()); await b.close();
})();
