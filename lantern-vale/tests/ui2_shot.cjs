const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1200);
  await page.click('#btnStart'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = __game; g.fade = 0; for (let i=0;i<120;i++) g.update(1/30); g.player.stamina = 55; g.ui.toast('拾獲 ◎ 螢火碎片！'); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/ui2_town.png' });
  await b.close();
})();
