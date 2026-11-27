const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

async function assertReadable(label, surfaceSelector) {
  const ratio = await label.evaluate(async (element, selector) => {
    const colors = value => value.match(/[\d.]+/g).map(Number);
    const surface = getComputedStyle(element.closest(selector));
    let background = colors(surface.backgroundColor);
    if (surface.borderImageSlice.includes('fill')) {
      const texture = new Image();
      texture.src = surface.borderImageSource.slice(5, -2);
      await texture.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      // The center of the nine-slice paints over backgroundColor.
      context.drawImage(texture, Math.floor(texture.width / 2), Math.floor(texture.height / 2), 1, 1, 0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      background = [r, g, b].map((channel, i) => (channel * alpha + background[i] * (255 - alpha)) / 255);
    }
    const luminance = rgb => rgb.slice(0, 3).reduce((sum, value, i) => {
      const channel = value / 255;
      const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    const text = luminance(colors(getComputedStyle(element).color));
    const bg = luminance(background);
    return (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05);
  }, surfaceSelector);
  assert.ok(ratio >= 4.5, `Expected readable text for "${await label.textContent()}", got ${ratio.toFixed(2)}:1`);
}


(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(60000);
    const pageErrors = [];
    page.on('pageerror', error => { pageErrors.push(error.message); console.error(error.stack); });
    const visible = selector => page.locator(selector).waitFor({ state: 'visible' });
    const hidden = selector => page.locator(selector).waitFor({ state: 'hidden' });
    const active = selector => page.waitForFunction(selector => document.activeElement.matches(selector), selector);
    const shot = async name => {
      if (process.env.LV_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, name) });
    };
    await page.addInitScript(() => {
      if (!localStorage.getItem('lv_settings')) localStorage.setItem('lv_settings', JSON.stringify({ pixel: 4 }));
    });
    await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/', { waitUntil: 'domcontentloaded' });
    await page.locator('#characterSlot').selectOption('2');
    await page.locator('#btnAccount').click();
    await active('#acctUser');
    assert.equal(await page.locator('#btnDelChar').isVisible(), false);
    await page.locator('.account-tools summary').click();
    await visible('#btnDelChar');
    assert.equal(await page.locator('#btnDelChar').isDisabled(), true);
    await page.locator('#btnAcctImport').click();
    await page.locator('#textDialog textarea').fill('invalid');
    await page.locator('#textDialog [type=submit]').click();
    assert.match(await page.locator('#textDialogError').textContent(), /JSON/);
    await page.keyboard.press('Escape');
    await hidden('#textDialog');
    await active('#btnAcctImport');
    await page.keyboard.press('Escape');
    await active('#btnAccount');
    await page.locator('#characterSlot').selectOption('0');
    await page.locator('#btnAccount').click();
    await active('#acctUser');
    if (!await page.locator('.account-tools').evaluate(el => el.open)) await page.locator('.account-tools summary').click();
    await page.locator('#btnDelChar').click();
    await active('#btnDelCancel');
    await page.keyboard.press('Escape');
    await active('#btnDelChar');
    await page.keyboard.press('Escape');
    await active('#btnAccount');
    console.log('Passed account dialog, backup validation, deletion cancellation and focus restoration.');

    await page.locator('#btnHeroNext').click();
    await shot('lantern-ui-character.png');
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
    await page.locator('#btnMenu').click();
    assert.equal(await page.locator('#btnMenu').getAttribute('aria-expanded'), 'true');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await active('#btnMeadowExpedition');
    await page.keyboard.press('Enter');
    await visible('#panelM');
    await page.keyboard.press('Escape');
    await active('#btnMenu');
    await page.locator('#btnMenu').click();
    await page.locator('[data-menu-page="party"]').click();
    await visible('#btnSimRoster');
    await hidden('#btnMeadowExpedition');
    await page.locator('[data-menu-page="system"]').click();
    await page.locator('#btnSet').click();
    await active('#btnSettingsX');
    const pixels = page.locator('#settings .srow').filter({ hasText: '像素大小' });
    const decreasePixelSize = pixels.locator('[data-d="-1"]');
    const increasePixelSize = pixels.locator('[data-d="1"]');
    assert.equal(await pixels.locator('.sval').textContent(), '細');
    await assertReadable(pixels.locator('.sval'), '.srow');
    assert.equal(await page.evaluate(() => __game.pipe.pixelScale), 2);
    assert.equal(await increasePixelSize.isDisabled(), true);
    await decreasePixelSize.click();
    assert.equal(await pixels.locator('.sval').textContent(), '關閉');
    assert.equal(await page.evaluate(() => __game.pipe.pixelScale), 1);
    assert.equal(await decreasePixelSize.isDisabled(), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lv_settings')).pixel), 1);
    await increasePixelSize.click();
    assert.equal(await pixels.locator('.sval').textContent(), '細');
    await shot('lantern-pixel-settings.png');
    await page.locator('#btnSettingsX').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#settings').evaluate(root => root.contains(document.activeElement)), true);
    await page.keyboard.down('q');
    assert.equal(await page.evaluate(() => Boolean(__game.keys.q)), false);
    await page.keyboard.up('q');
    await page.keyboard.press('Escape');
    await hidden('#settings');
    await active('#btnMenu');
    await page.keyboard.press('i');
    await visible('#inv');
    await visible('#bagItemPicker');
    await hidden('#invStats');
    await page.locator('.detail-fold').filter({ has: page.locator('#invStats') }).locator('summary').click();
    await visible('#invStats');
    await page.locator('#btnSalvageBag').click();
    await active('#textDialog [data-dialog-cancel]');
    await page.keyboard.press('Escape');
    await active('#btnSalvageBag');
    await page.locator('[data-invtab="souls"]').click();
    await visible('#pane-souls');
    await page.locator('[data-invtab="atlas"]').click();
    await visible('#pane-atlas');
    await page.locator('[data-invtab="style"]').click();
    const defaultHat = page.locator('.cos-btn[data-ckey="hat"][aria-pressed="true"]');
    const otherHat = page.locator('.cos-btn[data-ckey="hat"][aria-pressed="false"]').first();
    await assertReadable(defaultHat.locator('div').last(), '.cos-btn');
    await assertReadable(otherHat.locator('div').last(), '.cos-btn');
    await otherHat.hover();
    await assertReadable(otherHat.locator('div').last(), '.cos-btn');
    const otherHatId = await otherHat.getAttribute('data-cid');
    await otherHat.click();
    assert.equal(await defaultHat.getAttribute('data-cid'), otherHatId);
    await assertReadable(defaultHat.locator('div').last(), '.cos-btn');
    await shot('lantern-ui-cosmetics.png');
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    await visible('#puzzleM');
    await shot('lantern-ui-puzzle.png');
    await page.keyboard.press('Escape');
    console.log('Passed menu keyboard flow, settings and two inventory tabs, puzzle and Escape.');

    await page.locator('#btnMap').click();
    await visible('#worldMap');
    await hidden('.map-legend');
    await page.locator('.map-legend-fold summary').click();
    await visible('.map-legend');
    await page.locator('.map-search').fill('Unmatched island');
    await visible('.map-empty');
    await hidden('.map-actions');
    await page.locator('.map-clear').click();
    await active('.map-search');
    await hidden('.map-empty');
    await page.locator('.map-search').fill('晨光草原');
    await page.waitForFunction(() => document.querySelector('.region-name').textContent.includes('晨光草原'));
    await page.keyboard.press('Escape');
    await hidden('#worldMap');

    await page.evaluate(() => { __game.enterField(1); });
    await visible('#questTracker');
    await visible('#roomInfo');
    await hidden('#sk-s1');
    await hidden('#sk-bag');
    await hidden('#tideHud');
    await hidden('#quickTideUlt');
    await page.evaluate(() => { __game.tide.ultCharge = 100; });
    await visible('#quickTideUlt');
    await page.locator('#quickTideUlt').click();
    await hidden('#quickTideUlt');
    await page.evaluate(() => __game.toggleAutopilot('assist'));
    await visible('#apStop');
    await hidden('#apStats');
    await page.locator('#apStop').click();
    await hidden('#apStop');
    await visible('#worldActivity summary');
    assert.equal(await page.locator('#worldBossBanner').isVisible(), false);
    await page.locator('#worldActivity summary').click();
    await visible('#worldBossBanner');
    await visible('#dynEventBanner');
    await visible('#tideHud');
    await page.locator('#worldActivity summary').click();
    await shot('lantern-ui-compact-hud.png');
    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) __game.ui.toast('介面驗證 ' + i);
      __game.ui.toast('介面驗證 0');
    });
    assert.equal(await page.locator('#toasts .toast').count() <= 2, true);

    // Switch this page to touch input without reloading its saved game.
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await visible('#roomInfo');
      const skills = await page.locator('#skills').boundingBox();
      const move = await page.locator('#touchMovement').boundingBox();
      assert.ok(move.x + move.width <= skills.x, 'Touch movement and combat controls clear each other');
      await page.locator('#btnMenu').click();
      await visible('#menuPop');
      const bounds = await page.locator('#menuPop').boundingBox();
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.height <= viewport.height);
      assert.ok((await page.locator('#btnMeadowExpedition').boundingBox()).height >= 44);
      assert.equal(await page.locator('#toasts').evaluate(el => getComputedStyle(el).opacity), '0');
      if (viewport.width === 390) await shot('lantern-ui-compact-phone.png');
      await page.locator('#btnMeadowExpedition').click();
      await visible('#panelM');
      await page.locator('#btnPanelX').click();
      await hidden('#panelM');
    }
    assert.deepEqual(pageErrors, []);
    console.log('Passed map search, field HUD disclosure, notifications and 390×844 / 844×390 / 320×568 touch layouts.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
