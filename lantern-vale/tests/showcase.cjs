const { chromium } = require('playwright');
(async () => {
  const depths = (process.argv[2] || '0,3,6,9').split(',').map(Number);
  const pre = process.argv[3] || 'sc';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForTimeout(1500);
  await page.click('#btnStart');
  for (const d of depths) {
    await page.evaluate(d => { const g = __game; g.runSeed = 1234; g.loadRoom(d, null); g.player.skills.slam = g.player.skills.wisp = true; g.fade = 0;
      for (let i = 0; i < 110; i++) { g.player.hp = 999; g.update(1/30); } }, d);
    await page.mouse.move(820, 300);
    await page.waitForTimeout(400);
    await page.evaluate(() => { const g = __game; g.keys = {}; g.tryBolt(); g.tryWisp(); });
    await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
    await page.screenshot({ path: `shots/${pre}${d}.png` });
  }
  await browser.close();
})();
