const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: process.env.LV_SOFTWARE_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
        isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1,
        reducedMotion: mobile ? 'reduce' : 'no-preference',
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const openTracker = () => mobile ? page.locator('#touchDetails').tap() : page.locator('#questTracker').click();
      const visibleGuide = () => page.waitForFunction(() => __game.questGuide.root?.visible && __game.questGuide.points.length > 1);
      const at = async position => page.evaluate(({ x, z }) => {
        const g = __game;
        g.player.pos.set(x, g.world.gh(x, z), z);
        g.player.y = g.player.pos.y;
      }, position);

      await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/', { waitUntil: 'domcontentloaded' });
      await page.locator('#btnHeroNext').click();
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => __game.zone === 'town' && __game.state === 'play');
      await visibleGuide();
      assert.match(await page.evaluate(() => __game.questGuide.target.label), /晨光草原/);
      const dir = process.env.LV_SCREENSHOT_DIR;
      if (dir) {
        await page.waitForFunction(() => __game.exitCooldown <= 0.05);
        await page.screenshot({ path: path.join(dir, mobile ? 'quest-guide-mobile.png' : 'quest-guide-desktop.png') });
      }

      await openTracker();
      assert.equal(await page.locator('[data-quest-guide-follow]').textContent(), '跟燈去草原');
      assert.match(await page.locator('[data-opening-practice]').textContent(), /直接傳送/);
      await page.waitForFunction(() => !__game.questGuide.root.visible);
      await page.locator('[data-quest-guide-follow]').click();
      await visibleGuide();
      assert.match(await page.evaluate(() => __game.questGuide.target.label), /晨光草原/);
      assert.equal(await page.evaluate(() => __game.questGuide.reducedMotion.matches), mobile);

      await page.waitForFunction(() => __game.exitCooldown <= 0.05);
      await at(await page.evaluate(() => {
        const gate = __game.exits.find(exit => exit.type === 'run');
        return { x: gate.x, z: gate.z };
      }));
      await page.waitForFunction(() => __game.zone === 'field:1');
      await visibleGuide();
      await page.waitForFunction(() => __game.questGuide.target?.label === '點亮南門路燈');

      await openTracker();
      await page.locator('[data-quest-guide-toggle]').click();
      await page.locator('#btnPanelX').click();
      assert.equal(await page.evaluate(() => __game.questGuide.enabled), false);
      assert.equal(await page.evaluate(() => __game.questGuide.root.visible), false);
      await openTracker();
      assert.equal(await page.locator('[data-quest-guide-toggle]').textContent(), '開啟光路');
      await page.locator('#btnPanelX').click();
      assert.equal(await page.evaluate(() => __game.questGuide.enabled), false);
      await openTracker();
      await page.locator('[data-quest-guide-follow]').click();
      await visibleGuide();

      await at(await page.evaluate(() => {
        const lamp = __game.spots.find(spot => spot.expeditionId === 'opening-lamp');
        return { x: lamp.x, z: lamp.z };
      }));
      await page.keyboard.press('KeyF');
      await page.waitForFunction(() => __game.questGuide.target?.label.includes('幼狂豬') && __game.questGuide.root.visible);
      await page.evaluate(() => {
        const g = __game;
        const boar = g.enemies.find(enemy => enemy.openingPractice);
        const x = boar.pos.x + 3, z = boar.pos.z;
        g.player.pos.set(x, g.world.gh(x, z), z);
        g.player.y = g.player.pos.y;
        g.camPos.copy(g.player.pos);
      });
      await page.locator('#openingCombatCue[data-action=dodge]').waitFor();
      assert.match(await page.locator('#openingCombatCue').textContent(), mobile ? /搖桿/ : /空白鍵/);
      assert.match(await page.locator('#fieldTarget').textContent(), /幼狂豬 · Lv\.1/);
      assert.equal(await page.evaluate(() => __game.questGuide.root.visible), false);
      if (dir) await page.screenshot({ path: path.join(dir, mobile ? 'opening-combat-mobile.png' : 'opening-combat-desktop.png') });
      await page.locator('#openingCombatCue[data-action=counter]').waitFor();
      assert.match(await page.locator('#openingCombatCue').textContent(), /反擊/);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#btnQuickStart').click();
      await visibleGuide();
      assert.match(await page.evaluate(() => __game.questGuide.target.label), /晨光草原/);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`Quest guide OK (${mobile ? 'mobile / reduced motion' : 'desktop'})`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
