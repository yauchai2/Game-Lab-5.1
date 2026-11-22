const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'shots';
  const mode = process.argv[3] || 'title';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForTimeout(2500);
  require('fs').mkdirSync(out, { recursive: true });
  if (mode === 'title') {
    await page.screenshot({ path: `${out}/title.png` });
  } else {
    await page.click('#btnStart');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/play0.png` });
    // move & attack
    await page.mouse.move(800, 300);
    await page.keyboard.down('w'); await page.waitForTimeout(700); await page.keyboard.up('w');
    await page.waitForTimeout(2500);
    await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
    await page.mouse.down({button:'right'}); await page.waitForTimeout(400); await page.mouse.up({button:'right'});
    await page.screenshot({ path: `${out}/play1.png` });
    const info = await page.evaluate(() => { const g = window.__game; return { state: g.state, enemies: g.enemies.length, hp: g.player.hp, depth: g.depth, decals: g.decals.length }; });
    console.log(JSON.stringify(info));
    if (process.argv[4]) {
      for (const step of process.argv[4].split('|||')) {
        const r = await page.evaluate(step);
        await page.waitForTimeout(1200);
      }
      await page.screenshot({ path: `${out}/play2.png` });
    }
  }
  console.log(errs.slice(0, 15).join('\n'));
  await browser.close();
})();
