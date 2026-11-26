// Beaconfall Phase 4: class wick + advancement vow flow in the real built game, with screenshots.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const OUT = process.env.WICK_SHOTS || 'shots';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
    await page.waitForSelector('#btnStart', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('btnStart').click()); await page.waitForTimeout(1500);
    const step = (sec) => page.evaluate(s => { for (let t = 0; t < s; t += 1 / 30) __game.update(1 / 30); }, sec);

    let s = await page.evaluate(() => { const g = __game; return { job: g.character.job, wick: g.player.wick?.id, fw: g.player.flameWick, stance: g.player.wick?.stanceId }; });
    assert.ok(s.wick && s.wick !== 'none', 'class wick present: ' + JSON.stringify(s));
    assert.equal(s.stance, null);

    // ready the profile for the altar, open the panel and read the vow scene
    await page.evaluate(() => { const p = __game.meta.p; Object.assign(p, { level: 15, kills: 120, totalElites: 9, coins: 2000, shards: 500, deeds: { perfectGather: 5, skyRing: 5, casts: 99, nightExplore: 1 }, visitedFields: [1, 2, 3, 4] }); __game.ui.openPanel('ascend'); });
    await page.waitForTimeout(400);
    const list = await page.evaluate(() => [...document.querySelectorAll('#panel .prow, .panel .prow')].map(e => e.innerText).join('\n---\n'));
    assert.ok(/誓/.test(list), 'altar lists the stances');
    await page.screenshot({ path: `${OUT}/wick_1_altar_choices.png` });
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('面對誓言') && !x.disabled); if (b) b.click(); return !!b; });
    assert.ok(clicked, 'vow button available');
    await page.waitForTimeout(300);
    const scene = await page.evaluate(() => document.querySelector('.psmall')?.innerText || '');
    assert.ok(scene.includes('立下') || scene.length > 40);
    await page.screenshot({ path: `${OUT}/wick_2_vow_scene.png` });
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent.includes('立下誓言'))?.click(); });
    await page.waitForTimeout(500);
    s = await page.evaluate(() => { const g = __game; return { sc: g.meta.p.secondClass, vow: g.meta.p.vow, stance: g.player.wick?.stanceId, ver: g.meta.p.schemaVersion }; });
    assert.ok(s.sc && s.vow?.sc === s.sc && s.stance === s.sc, JSON.stringify(s));
    assert.equal(s.ver, 3);
    await page.screenshot({ path: `${OUT}/wick_3_awakened.png` });

    // play on: no exceptions while the lamp and wick tick, in a field too
    await page.evaluate(() => { __game.ui.closePanel?.(); __game.enterField(3); }); await page.waitForTimeout(500);
    await page.evaluate(() => { __game.fade = 0; }); await step(30);
    const fx = await page.evaluate(() => __game.player.wickFx);
    assert.ok(fx && Number.isFinite(fx.dmgPct));
    // damage path uses wick bonus without NaN
    const dmg = await page.evaluate(() => __game.rollDamage(1).dmg);
    assert.ok(Number.isFinite(dmg) && dmg > 0);
    await page.screenshot({ path: `${OUT}/wick_4_field.png` });
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('wick_browser ok', JSON.stringify({ fx, dmg }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
