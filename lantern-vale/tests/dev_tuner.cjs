// Dev Tuner（開發者調校面板）：熱鍵、?dev 閘門、滑桿即時生效、生怪/清怪、儲存/匯出/匯入、離線外線上鎖定。
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const OUT = process.env.TUNER_SHOTS || 'shots';
const base = pathToFileURL(process.cwd() + '/dist/index.html').href;

async function start(browser, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('#btnStart', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { __game.fade = 0; });
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // 1) 公開版閘門：?dev=0 等同公開版 → 沒有面板、沒有按鈕、反引號無效
    {
      const { ctx, page } = await start(browser, base + '?dev=0');
      assert.equal(await page.locator('#devTune').count(), 0, '?dev=0 不應建立面板');
      assert.equal(await page.locator('#devTuneBtn').count(), 0);
      assert.equal(await page.locator('#dbgDock').count(), 0);
      await page.keyboard.press('Backquote');
      assert.equal(await page.locator('#devTune').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('lv_dev_unlock')), null);
      await ctx.close();
    }
    // 2) ?dev 開啟並記住；其後不帶參數仍可用，?dev=0 再清除
    {
      const { ctx, page, errors } = await start(browser, base + '?dev');
      assert.equal(await page.evaluate(() => localStorage.getItem('lv_dev_unlock')), '1');
      assert.equal(await page.locator('#devTuneBtn').count(), 1);
      assert.ok(await page.locator('#devTune.hide').count() === 1, '預設收起');
      await page.keyboard.press('Backquote');
      await page.waitForSelector('#devTune:not(.hide)');
      const g = () => page.evaluate(() => ({ fov: __game.camera.fov, sat: __game.pipe.postMat.uniforms.uSat.value, sun: __game.devTune.sunMul, kill: __FLAME().gain.kill }));
      await page.evaluate(() => { window.__FLAME = () => __game.dbg.tuner.buildExport().flame || null; });
      // 滑桿即時生效
      const setRange = async (id, v) => page.evaluate(([id, v]) => { const el = document.querySelector(`#devTune .dt-row`); const rows = [...document.querySelectorAll('#devTune .dt-row')]; return rows.length; }, [id, v]);
      const setBy = async (label, v) => {
        const ok = await page.evaluate(([label, v]) => {
          const row = [...document.querySelectorAll('#devTune .dt-row')].find(r => r.querySelector('label')?.textContent.startsWith(label));
          if (!row) return false;
          const r = row.querySelector('input[type=range]'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); return true;
        }, [label, v]);
        assert.ok(ok, 'row ' + label);
      };
      await setBy('視野 FOV', 50);
      await setBy('色彩飽和度', 0.3);
      await setBy('太陽強度', 1.7);
      await setBy('gain · kill', 7);
      await page.waitForTimeout(250);
      await page.evaluate(() => __game.update(1 / 30));
      const live = await page.evaluate(() => ({ fovOverride: __game.devTune.cam.fov, sat: __game.pipe.postMat.uniforms.uSat.value, sun: __game.devTune.sunMul }));
      assert.equal(live.fovOverride, 50); assert.ok(Math.abs(live.sat - 0.3) < 1e-6); assert.equal(live.sun, 1.7);
      const exp = await page.evaluate(() => __game.dbg.tuner.buildExport());
      assert.equal(exp.format, 'beaconfall-devtune');
      assert.equal(exp.values['cam.fov'], 50); assert.equal(exp.values['flame.gain.kill'], 7);
      assert.equal(exp.flame.gain.kill, 7, '匯出含完整 flame 設定');
      assert.ok(!('time.dayTime' in exp.values) && !('dev.god' in exp.values), '揮發值不進預設');
      // 儲存 → 新頁面自動套用
      await page.click('#dtSave');
      const store = await page.evaluate(() => JSON.parse(localStorage.getItem('lv_dev_tune')));
      assert.equal(store.values['render.sat'], 0.3);
      // 進野外生怪 / 清怪
      await page.evaluate(() => __game.enterField(3)); await page.waitForTimeout(700);
      await page.evaluate(() => { __game.fade = 0; for (let i = 0; i < 20; i++) __game.update(1 / 30); });
      const before = await page.evaluate(() => __game.enemies.filter(e => !e.dead).length);
      await page.evaluate(() => { const d = [...document.querySelectorAll('#devTune details')].find(x => x.textContent.includes('戰鬥測試')); d.querySelector('select').value = 'slime'; d.querySelector('input[type=number]').value = 6; });
      await page.evaluate(() => [...document.querySelectorAll('#devTune button')].find(b => b.textContent.includes('生成')).click());
      const spawned = await page.evaluate(() => { const l = __game.enemies.filter(e => !e.dead); window.__mine = l.filter(e => e.type === 'slime').slice(-6); return l.length; });
      assert.equal(spawned - before, 6, '生成 6 隻');
      await page.evaluate(() => [...document.querySelectorAll('#devTune button')].find(b => b.textContent.includes('清空敵人')).click());
      await page.evaluate(() => { for (let i = 0; i < 5; i++) __game.update(1 / 30); });
      assert.equal(await page.evaluate(() => window.__mine.every(e => e.dead)), true, '清空後生成的怪都死亡');
      // 切區域後調校仍在（場景重建後重套）
      await page.waitForTimeout(300);
      assert.ok(Math.abs(await page.evaluate(() => __game.pipe.postMat.uniforms.uSat.value) - 0.3) < 1e-6);
      // 匯入
      await page.evaluate(() => __game.dbg.tuner.resetAll());
      assert.equal(await page.evaluate(() => __game.devTune.cam.fov), undefined);
      assert.equal(await page.evaluate(t => __game.dbg.tuner.importJson(t), JSON.stringify({ format: 'beaconfall-devtune', version: 1, values: { 'cam.fov': 44, 'render.sat': 1.5, 'nope.x': 3 } })), true);
      assert.equal(await page.evaluate(() => __game.devTune.cam.fov), 44);
      // 線上鎖定
      await page.evaluate(() => { __game.net.ok = true; });
      await page.waitForTimeout(400);
      const lockedBtns = await page.evaluate(() => [...document.querySelectorAll('#devTune [data-online]')].every(b => b.disabled));
      assert.ok(lockedBtns, '線上時危險按鈕停用');
      assert.equal(await page.evaluate(() => !document.querySelector('#dtBanner').classList.contains('hide')), true);
      await page.evaluate(() => { __game.net.ok = false; });
      assert.deepEqual(errors, [], '無頁面錯誤');
      await ctx.close();
    }
    // 3) 美術風格：後製 uniform、水面、色盤、預設、A/B
    {
      const { ctx, page, errors } = await start(browser, base + '?dev');
      await page.evaluate(() => __game.enterField(3)); await page.waitForTimeout(700);
      await page.evaluate(() => { __game.fade = 0; for (let i = 0; i < 20; i++) __game.update(1 / 30); });
      await page.keyboard.press('Backquote'); await page.waitForSelector('#devTune:not(.hide)');
      const T = () => page.evaluate(() => __game.dbg.tuner);
      const U = n => page.evaluate(k => { const v = __game.pipe.postMat.uniforms[k].value; return v.x !== undefined ? [v.x, v.y, v.z] : v; }, n);
      // 預設值＝原畫面
      assert.equal(await U('uSteps'), 9); assert.equal(await U('uEdgeStr'), 0.85); assert.equal(await U('uVig'), 0.22); assert.equal(await U('uContrast'), 1);
      const ok = await page.evaluate(() => {
        const t = __game.dbg.tuner;
        t.applyValues({ 'art.hueDeg': 30, 'art.steps': 5, 'art.edgeColor': '#ff0000', 'art.bloomStr': 0.4, 'art.contour': 0.1, 'art.headScale': 1.4, 'art.uiRadius': 9, 'art.uiPaper': '#ffeedd' });
        return t.snapshot();
      });
      assert.equal(ok['art.steps'], 5); assert.equal(await U('uSteps'), 5);
      assert.deepEqual((await U('uOutline')).map(v => Math.round(v * 255)), [255, 0, 0]);
      assert.ok(Math.abs((await U('uHue')) - 30 * Math.PI / 180) < 1e-6);
      assert.equal(await page.evaluate(() => __game.world.waterMat.uniforms.uContour.value), 0.1);
      assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--paper')), '#ffeedd');
      assert.ok((await page.evaluate(() => document.getElementById('dtUiStyle').textContent)).includes('9px'));
      // 色盤：水色即時、草色需重建
      await page.evaluate(() => __game.dbg.tuner.applyValues({ 'pal.all.waterDeep': '#ff0000', 'pal.all.grass': '#112233' }));
      assert.deepEqual(await page.evaluate(() => [...__game.world.waterMat.uniforms.uDeep.value.toArray()].map(v => Math.round(v * 255))), [255, 0, 0]);
      await page.waitForTimeout(1500); // 自動重建
      assert.equal(await page.evaluate(() => __game.biome.grass), 0x112233, '重建後群系草色套用');
      // 預設：載入新參考 → 還原現行
      await page.evaluate(() => { const t = __game.dbg.tuner; t.resetAll(); });
      assert.equal(await U('uSteps'), 9);
      await page.waitForTimeout(1500);
      assert.notEqual(await page.evaluate(() => __game.biome.grass), 0x112233, '還原後重建，群系色回原值');
      await page.evaluate(() => [...document.querySelectorAll('#dtArt select')][0].value = '新參考（batch5 方向）');
      await page.evaluate(() => [...document.querySelectorAll('#dtArt button')].find(b => b.textContent.includes('載入')).click());
      assert.equal(await U('uSteps'), 7); assert.ok((await U('uSat')) > 1.19);
      // 自訂預設存取
      await page.evaluate(() => { document.querySelector('#dtArt input[type=text]').value = 'T1'; [...document.querySelectorAll('#dtArt button')].find(b => b.textContent.includes('另存為預設')).click(); });
      assert.ok(await page.evaluate(() => 'T1' in JSON.parse(localStorage.getItem('lv_dev_art_presets'))));
      // A/B：現行 ⇄ 新參考
      await page.evaluate(() => { const t = __game.dbg.tuner; t.resetAll(); });
      await page.evaluate(() => { document.querySelector('#dtArt select').value = '新參考（batch5 方向）'; [...document.querySelectorAll('#dtArt button')].find(b => b.textContent.includes('與目前對照')).click(); [...document.querySelectorAll('#dtArt button')].find(b => b.textContent.includes('切換 A⇄B')).click(); });
      assert.equal(await U('uSteps'), 7, '切到 B（新參考）');
      await page.evaluate(() => [...document.querySelectorAll('#dtArt button')].find(b => b.textContent.includes('切換 A⇄B')).click());
      assert.equal(await U('uSteps'), 9, '切回 A（現行）');
      // 匯出含色盤
      await page.evaluate(() => __game.dbg.tuner.applyValues({ 'pal.snow.sky': '#00ff00' }));
      assert.equal(await page.evaluate(() => __game.dbg.tuner.buildExport().values['pal.snow.sky']), '#00ff00');
      assert.deepEqual(errors, [], '無頁面錯誤');
      await ctx.close();
    }
    console.log('dev_tuner OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
