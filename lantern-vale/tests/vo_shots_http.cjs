// 視覺檢查：城鎮 + 草原副本 + 近景，輸出 shots/<tag>_*.png
const { chromium } = require('playwright');
const tag = process.argv[2] || 'cur';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await page.goto('http://localhost:8123/index.html'); await page.waitForTimeout(1500);
  await page.click('#btnStart'); await page.waitForTimeout(1500);
  const go = async (x,z,d,name) => { await page.evaluate(([x,z,d]) => { const g=__game; g.fade=0; g.player.pos.x=x; g.player.pos.z=z; g.camDistOverride=d; for(let i=0;i<50;i++) g.update(1/30); }, [x,z,d]); await page.waitForTimeout(500); await page.screenshot({ path: `shots/${tag}_${name}.png` }); };
  await go(0,0,0,'town');
  await go(1,12,22,'town_pond');
  await page.evaluate(() => { __game.camDistOverride=0; __game.startRun && __game.startRun(); }); await page.waitForTimeout(1500);
  await page.evaluate(() => { __game.fade=0; __game.camDistOverride=0; for(let i=0;i<40;i++) __game.update(1/30); }); await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/${tag}_run.png` });
  console.log(JSON.stringify(await page.evaluate(()=>({depth:__game.depth,state:__game.state}))), 'ERR', errs.join('\n')); await b.close();
})();
