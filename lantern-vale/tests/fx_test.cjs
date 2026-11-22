const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1200);
  await page.click('#btnSetTitle'); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/set_title.png' });
  await page.click('#btnClose'); await page.click('#btnStart'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = __game; g.fade = 0; for (let i=0;i<60;i++) g.update(1/30); });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('.stabs button[data-tab="audio"]'); await page.waitForTimeout(200);
  await page.screenshot({ path: 'shots/set_audio.png' });
  await page.click('.stabs button[data-tab="video"]'); await page.click('.srow:nth-child(2) .arr[data-d="1"]'); await page.waitForTimeout(200);
  console.log(await page.evaluate(() => JSON.stringify(__game.settings)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  console.log('open?', await page.evaluate(() => __game.ui.setOpen));
  // start a run to see grass and water
  await page.evaluate(() => { const g = __game; g.startRun(); g.fade = 0; for (let i=0;i<90;i++) g.update(1/30); });
  await page.waitForTimeout(500); await page.screenshot({ path: 'shots/fx_run1.png' });
  await page.evaluate(() => { for (let i=0;i<45;i++) __game.update(1/30); });
  await page.screenshot({ path: 'shots/fx_run2.png' });
  console.log(errs.join('\n')); await b.close();
})();
