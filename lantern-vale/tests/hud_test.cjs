// 旅人狀態卡（HP/MP 物理）截圖
const { chromium } = require('playwright');
const tag = process.argv[2] || 'hud';
const url = process.argv[3] || ('file://' + process.cwd() + '/dist/index.html');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('#btnStart'); await page.waitForTimeout(2500);
  const shot = async n => page.screenshot({ path: `shots/${tag}_${n}.png` });
  const clip = async n => page.screenshot({ path: `shots/${tag}_${n}_c.png`, clip: { x: 0, y: 470, width: 520, height: 250 } });
  await page.evaluate(() => { __game.fade = 0; }); await page.waitForTimeout(500); await shot('idle'); await clip('idle');
  await page.evaluate(() => { const p = __game.player; p.hp -= p.stats.maxHp * 0.3; }); await page.waitForTimeout(120); await clip('hit1');
  await page.waitForTimeout(450); await clip('hit2');
  await page.evaluate(() => { const p = __game.player; p.mana -= p.stats.mana * 0.4; }); await page.waitForTimeout(150); await shot('mana');
  await page.evaluate(() => { const p = __game.player; p.stamina = 46; p.mana = 0; __game.ui.status.noMana(); }); await page.waitForTimeout(120); await clip('stam');
  await page.evaluate(() => { const p = __game.player; p.hp = p.stats.maxHp * 0.15; }); await page.waitForTimeout(300); await clip('low');
  await page.evaluate(() => { const p = __game.player; p.hp = p.stats.maxHp; p.mana = p.stats.mana; }); await page.waitForTimeout(250); await clip('heal');
  await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(500); await page.screenshot({ path: `shots/${tag}_phone.png` });
  console.log('ERR', errs.join('\n'));
  await b.close();
})();
