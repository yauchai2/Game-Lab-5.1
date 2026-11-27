const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: process.env.LV_SOFTWARE_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const url = process.env.LV_GAME_URL || 'http://localhost:8080';
  try {
    for (const [width, height, touch] of [[1280, 800, false], [390, 844, true], [844, 390, true]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnQuickStart').click();
      await page.waitForFunction(() => __game.state === 'play' && __game.zone === 'town');
      await page.evaluate(() => {
        const g = __game, p = g.player.pos;
        g.dropItem(p.x + 1, p.z, __makeItem(() => 0.45, 1, 1, 'charm'), { quiet: true });
        g.dropOrb(p.x + 6, p.z);
        window.beforeDropTime = g.time;
      });
      await page.waitForFunction(() => __game.time > beforeDropTime + 0.25, null, { timeout: 6000 });
      assert.deepEqual(errors, []);
      if (!touch) {
        await page.close();
        continue;
      }

      const cdp = await page.context().newCDPSession(page);
      const slot = page.locator('#sk-s0');
      const zone = page.locator('#touchCancelZone');
      const center = async locator => {
        const box = await locator.boundingBox();
        assert.ok(box);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };
      const send = (type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
      const casts = () => page.evaluate(() => slotCasts);
      const ready = () => page.evaluate(() => {
        const g = __game, p = g.player;
        p.cds.action = p.cds.bolt = p.skillCds[0] = 0;
        p.mana = p.stats.mana;
        window.slotCasts = [];
        if (!g.recordedHotbar) {
          const cast = g.castHotbar.bind(g);
          g.castHotbar = (slot, aim) => { slotCasts.push({ slot, aim: aim?.toArray() }); cast(slot, aim); };
          g.recordedHotbar = true;
        }
        return p.pos.toArray();
      });
      const start = await center(slot);
      await ready();
      await send('touchStart', start);
      await send('touchMove', { x: start.x - 35, y: start.y - 5 });
      await zone.waitFor({ state: 'visible' });
      assert.deepEqual(await casts(), []);
      await send('touchMove', await center(zone));
      await page.waitForFunction(() => document.getElementById('touchCancelZone').classList.contains('hot'));
      if (process.env.LV_SCREENSHOT_DIR && width === 390) {
        await page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, 'touch-skill-cancel.png') });
      }
      await send('touchEnd');
      assert.deepEqual(await casts(), []);
      assert.equal(await page.evaluate(() => __game.player.skillCds[0] + __game.player.cds.bolt), 0);
      assert.equal(await page.evaluate(() => __game.player.mana), await page.evaluate(() => __game.player.stats.mana));

      await send('touchStart', start);
      await send('touchMove', { x: start.x - 35, y: start.y - 5 });
      await send('touchCancel');
      assert.deepEqual(await casts(), []);

      const pos = await ready();
      await send('touchStart', start);
      await send('touchMove', { x: start.x - 45, y: start.y });
      assert.deepEqual(await casts(), []);
      await send('touchEnd');
      await page.waitForFunction(() => slotCasts.length === 1);
      const [drag] = await casts();
      assert.equal(drag.slot, 0);
      assert.ok(drag.aim[0] < pos[0] - 2);
      assert.equal(await page.evaluate(() => __game.player.mana < __game.player.stats.mana), true);

      await ready();
      await slot.tap();
      await page.waitForFunction(() => slotCasts.length === 1);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Passed mixed drops on desktop, portrait and landscape, and touch tap, aim, cancel and interruption.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
