const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
    await page.click('#btnStart');
    const muted = await page.evaluate(() => __game.audio.muted);
    await page.keyboard.press('m');
    const map = page.locator('#worldMap');
    assert.equal(await map.isVisible(), true);
    assert.match(await map.locator('.map-location').innerText(), /燈谷鎮/);
    await page.screenshot({ path: 'shots/map-town.png' });
    await map.getByRole('button', { name: '霜冬雪原' }).click();
    assert.match(await map.locator('.region-name').innerText(), /15–20/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'shots/map-mobile.png' });
    await page.keyboard.press('Escape');
    assert.equal(await map.isVisible(), false);
    await page.evaluate(() => __game.startRun());
    await page.click('#btnMap');
    assert.match(await map.locator('.map-location').innerText(), /晨光草原 · 第 1 層/);
    const t = await page.evaluate(() => __game.time);
    await page.keyboard.press('q');
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => __game.time), t);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({ path: 'shots/map-run.png' });
    await page.keyboard.press('m');
    assert.equal(await map.isVisible(), false);
    assert.equal(await page.evaluate(() => __game.audio.muted), muted);
    assert.deepEqual(errors, []);
    console.log('World map interaction and input checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
