// 背包／英雄裝備／物理掉落截圖與檢查：node build.mjs 後執行 node tests/inventory_test.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const bad = []; page.on('requestfailed', r => { if (/assets\/items/.test(r.url())) bad.push(r.url()); });
  await page.goto(process.env.GAME_URL || 'http://localhost:8099/index.html'); await page.waitForTimeout(2000);
  await page.click('#btnHeroNext'); await page.click('#btnStart'); await page.waitForTimeout(2500);
  // 穿滿 8 個欄位（不同稀有度與階級），背包再丟進一批物品讓它們物理掉落
  const info = await page.evaluate(() => {
    const g = __game, mk = __makeItem, r = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const slots = ['head', 'staff', 'body', 'cloak', 'hands', 'feet', 'charm', 'relic'], rar = [1, 2, 0, 1, 2, 1, 0, 2];
    slots.forEach((s, i) => { g.player.equip[s] = mk(r, 1 + (i % 3) * 2, rar[i], s); });
    g.meta.p.level = 30; g.recalc();
    const bag = g.meta.p;
    bag.bagItems = null; // 重置為預設補給（含堆疊）
    const { addGearToBag } = { addGearToBag: null };
    return slots.map(s => g.player.equip[s].name + '|' + (g.player.equip[s].art || '-'));
  });
  console.log(info.join('\n'));
  await page.evaluate(() => {
    const g = __game, mk = __makeItem; let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.ui.toggleInv(g, 'bag');
    window.__bagAdd = n => { const st = g.meta.p; for (let i = 0; i < n; i++) { const it = mk(r, 1 + (i % 5), null); /* 與撿取相同入口 */ st.bagItems.push({ uid: 'g_' + Date.now() + '_' + i, kind: 'gear', icon: '', name: it.name, color: ['#e8e2d4', '#7fb2ff', '#ffd85a', '#ff9a4a'][it.rarity], art: it.art, item: { ...JSON.parse(JSON.stringify(it)), mods: it.mods.map(m => ({ k: m.k, v: m.v })), implicit: { k: it.implicit.k, v: it.implicit.v } } }); } g.ui.syncPhysBags(g); };
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { __game.ui.syncPhysBags(__game); });
  await page.evaluate(() => __bagAdd(6));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/inv_main.png' });
  // 點選一件裝備看提示框
  await page.click('[data-eqslot="staff"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/inv_equip_detail.png' });
  // 搖一搖＝物理掉落重現
  await page.click('#btnShakeBag'); await page.waitForTimeout(350);
  await page.screenshot({ path: 'shots/inv_shake_mid.png' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'shots/inv_shake_settled.png' });
  // 世界掉落：在玩家頭頂掉一批有圖的裝備，連拍落地過程（滑鼠移開避免提示框擋住）
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.mouse.move(5, 5);
  await page.evaluate(() => { const g = __game; g.ui.invOpen && g.ui.toggleInv(g); g.fade = 0; g.camDistOverride = 7; const p = g.player;
    [['staff', 2], ['cloak', 1], ['charm', 3], ['relic', 2], ['hands', 1]].forEach(([sl, rar], i) => { const it = __makeItem(() => 0.12 + i * 0.17, 2, rar, sl); g.dropItem(p.pos.x + Math.cos(i) * 0.4, p.pos.z + Math.sin(i) * 0.4, it); }); });
  await page.waitForTimeout(200); await page.screenshot({ path: 'shots/drop_air.png' });
  await page.waitForTimeout(2200); await page.screenshot({ path: 'shots/drop_landed.png' });
  console.log('art404', bad.join(','));
  console.log('ERR', errs.join('\n')); await b.close();
})();
