const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (name, hood) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
    page.on('pageerror', e => console.log(name, 'PAGEERR', e.message));
    await page.goto('http://localhost:8099/'); await page.waitForTimeout(1000);
    await page.fill('#inName', name); await page.click(`#swatches button:nth-child(${hood})`); await page.click('#btnStart'); await page.waitForTimeout(1200);
    await page.evaluate(() => { __game.fade = 0; });
    return page;
  };
  const a = await mk('阿明', 2), b = await mk('小美', 5);
  await b.evaluate(() => { const g = __game; g.player.pos.set(g.player.pos.x + 2.5, 0, g.player.pos.z - 1); g.keys = { d: true }; });
  await a.waitForTimeout(500); await b.evaluate(() => { __game.keys = {}; });
  await a.keyboard.press('Enter'); await a.keyboard.type('哈囉小美'); await a.keyboard.press('Enter');
  await b.keyboard.press('1');
  await a.waitForTimeout(1500);
  console.log('A sees', await a.evaluate(() => [__game.net.ok, __game.net.online, [...__game.remotes.values()].map(r => [r.name, +r.x.toFixed(1), +r.z.toFixed(1)])]));
  console.log('B sees', await b.evaluate(() => [__game.net.ok, __game.net.online, [...__game.remotes.values()].map(r => [r.name, +r.x.toFixed(1), +r.z.toFixed(1)]), document.getElementById('chatLog').innerText]));
  await a.screenshot({ path: 'shots/mp_a.png' });
  await browser.close();
})();
