const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message+'\n'+e.stack)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForTimeout(1200);
  await page.fill('#inName', '測試員'); await page.click('#btnStart'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = __game; g.fade = 0; for (let i=0;i<150;i++) g.update(1/30); g.emote(0); });
  await page.keyboard.press('Enter'); await page.keyboard.type('大家好！'); await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/town1.png' });
  console.log(await page.evaluate(() => { const g=__game; return [g.zone, g.depth, g.exits.map(x=>[x.type,x.on,x.x,x.z]), g.remotes.size]; }));
  console.log(errs.join('\n'));
  await browser.close();
})();
