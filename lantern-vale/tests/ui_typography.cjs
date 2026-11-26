const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(60000);
    const errors = [];
    const fontRequests = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => {
      if (req.resourceType() === 'font') fontRequests.add(req.url());
    });
    await page.addInitScript(() => {
      const fill = CanvasRenderingContext2D.prototype.fillText;
      window.drawnUiFonts = {};
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        if (this.canvas.id === 'dbgChart' || /^\[T\d+\] /.test(text)) {
          window.drawnUiFonts[this.canvas.id] = this.font;
        }
        return fill.call(this, text, ...args);
      };
    });
    const session = await page.context().newCDPSession(page);
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const url = process.env.LV_GAME_URL || 'http://localhost:8080/';
    const shot = async name => {
      if (process.env.LV_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, name) });
    };
    const checkStack = async selector => {
      const root = page.locator(selector);
      await root.waitFor();
      await root.evaluate(async el => {
        await document.fonts.ready;
        const expected = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim();
        const canonical = expected.split(',')[0].replaceAll('"', '');
        const publicText = [...el.querySelectorAll('*'), el].filter(node =>
          node.checkVisibility() && (node.matches('input,select,textarea,button') ||
          [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())));
        if (!publicText.length) throw new Error('No rendered text in ' + el.id);
        const drift = publicText.filter(node => !getComputedStyle(node).fontFamily.startsWith('"' + canonical + '"'));
        if (drift.length) throw new Error('Font drift: ' + drift.map(node => node.outerHTML.slice(0, 130)).join(' | '));
      });
    };
    const assertGlyphs = async (locale, specimen) => {
      await page.evaluate(async ({ locale, specimen }) => {
        document.documentElement.lang = locale;
        let sample = document.getElementById('font-check');
        if (!sample) {
          sample = Object.assign(document.createElement('span'), { id: 'font-check' });
          sample.style.cssText = 'position:fixed;left:8px;top:8px;background:white;color:black;z-index:9999;font-size:16px';
          document.body.append(sample);
        }
        sample.textContent = specimen;
        const loaded = await document.fonts.load(getComputedStyle(sample).font, specimen);
        if (!loaded.some(font => font.status === 'loaded')) throw new Error('Pixel font failed to load for ' + locale);
        sample.getBoundingClientRect();
      }, { locale, specimen });
      await page.locator('#font-check').screenshot();
      const { root } = await session.send('DOM.getDocument');
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#font-check' });
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      assert.ok(fonts.length > 0);
      assert.ok(fonts.every(font => font.isCustomFont && font.familyName === (locale === 'ja' ? 'Fusion Pixel 12px Prop ja' : 'Fusion Pixel 12px Prop zh-TW')),
        `${locale} specimen used fallback: ${JSON.stringify(fonts)}`);
      await page.locator('#font-check').evaluate(el => el.remove());
    };

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await checkStack('#title');
    await assertGlyphs('zh-TW', '燈谷行 碎石獠牙 鰩魚衝鋒 擲骰霜凍 聖護攻擊 ×1.25');
    await assertGlyphs('en', 'Lantern Vale – Weapon Atlas +275 XP');
    await assertGlyphs('ja', '灯火の谷・装備と鍛冶、破壊した部位と収穫');
    await page.evaluate(() => { document.documentElement.lang = 'zh-TW'; });
    await page.locator('#btnHeroNext').click();
    assert.ok((await page.locator('#inName').boundingBox()).width > 160, 'Character name spans a readable input width');
    await shot('lantern-pixel-title.png');
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
    await checkStack('#hud');
    await page.keyboard.press('i');
    await checkStack('#inv');
    await page.evaluate(() => {
      const bag = __game.ui.bagPhys;
      bag.hover = { data: { tier: 2, name: '霜凍星燈護符' }, x: 50, y: 50, hh: 12 };
      bag.draw();
    });
    assert.ok(Object.values(await page.evaluate(() => window.drawnUiFonts)).some(font => font.includes('Fusion Pixel TW')));
    await shot('lantern-pixel-inventory.png');
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    await checkStack('#puzzleM');
    await page.keyboard.press('Escape');
    await page.locator('#btnMap').click();
    await checkStack('#worldMap');
    await page.keyboard.press('Escape');
    await page.keyboard.press('F3');
    await page.locator('#dbgDock [data-tab="monitors"]').click();
    await checkStack('#dbgDock');
    await page.waitForFunction(() => window.drawnUiFonts.dbgChart?.includes('Fusion Pixel TW'));
    await page.keyboard.press('F3');
    console.log('Passed custom glyphs for Traditional Chinese, English and Japanese, plus HUD, character, inventory, map, puzzle, and both canvases.');

    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#btnMenu').click();
    await checkStack('#menuPop');
    await page.locator('#btnMeadowExpedition').click();
    await checkStack('#panelM');
    const panel = await page.locator('#panelM .panel').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 390);
    await shot('lantern-pixel-phone.png');
    assert.deepEqual(errors, []);
    assert.equal(fontRequests.size, 2, 'Only two local font variants should be requested');
    for (const font of fontRequests) assert.equal(new URL(font).origin, new URL(url).origin);
    console.log('Passed touch panel layout and same-origin font loading.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
