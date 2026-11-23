// 城鎮俯瞰＋各分區截圖
const { chromium } = require('playwright');
const tag = process.argv[2] || 'tw';
const url = process.argv[3] || ('file://' + process.cwd() + '/dist/index.html');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('#btnStart'); await page.waitForTimeout(2500);
  const go = async (x, z, d, name) => { await page.evaluate(([x, z, d]) => { const g = __game; g.fade = 0; g.player.pos.x = x; g.player.pos.z = z; g.camDistOverride = d; for (let i = 0; i < 60; i++) g.update(1 / 30); }, [x, z, d]); await page.waitForTimeout(600); await page.screenshot({ path: `shots/${tag}_${name}.png` }); };
  await go(0, 2, 62, 'over'); await go(0, 0, 0, 'plaza'); await go(0, -12, 0, 'north'); await go(-12, 3, 0, 'west'); await go(12, 0, 0, 'east'); await go(2, 15, 0, 'south');
  console.log(JSON.stringify(await page.evaluate(() => ({ depth: __game.depth, state: __game.state, spots: (__game.spots || []).map(s => s.kind).join(',') }))), 'ERR', errs.join('\n'));
  await b.close();
})();
