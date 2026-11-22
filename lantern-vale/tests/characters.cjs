const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
    await page.evaluate(() => {
      localStorage.setItem('lv_prof', JSON.stringify({ name: '阿燈', hood: 2 }));
      localStorage.setItem('lv_profile', JSON.stringify({ shards: 77 }));
    });
    await page.reload();
    assert.equal(await page.inputValue('#inName'), '阿燈');
    await page.selectOption('#characterSlot', '1');
    await page.fill('#inName', '青杉');
    await page.selectOption('#job', '1');
    await page.click('#randomLook');
    await page.selectOption('#style', '2');
    await page.screenshot({ path: 'shots/characters.png' });
    await page.click('#btnStart');
    assert.deepEqual(await page.evaluate(() => [__game.playerName, __game.character.style, __game.player.stats.moveSpd, __game.meta.p.shards]), ['青杉', 2, 8, 0]);
    await page.evaluate(() => { __game.meta.p.shards = 9; __game.meta.save(); });
    await page.reload();
    assert.equal(await page.inputValue('#characterSlot'), '1');
    assert.equal(await page.inputValue('#style'), '2');
    await page.selectOption('#characterSlot', '0');
    await page.click('#btnStart');
    assert.deepEqual(await page.evaluate(() => [__game.playerName, __game.meta.p.shards]), ['阿燈', 77]);
    assert.deepEqual(errors, []);
    console.log('Character selection, legacy save and slot isolation passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
