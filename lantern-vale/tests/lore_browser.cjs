// Beaconfall Phase 3: lore layer in the real built game (NPCs, boss name, HUD line, Codex tab) + screenshots.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const OUT = process.env.LORE_SHOTS || 'shots';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
    await page.waitForSelector('#btnStart', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(1500); await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForTimeout(1500);
    const step = sec => page.evaluate(s => { for (let t = 0; t < s; t += 1 / 30) __game.update(1 / 30); }, sec);

    // town: Captain Hale exists, Order of the Wick quest shows in the tracker
    await page.evaluate(() => { __game.fade = 0; }); await step(1); await page.waitForTimeout(300);
    const town = await page.evaluate(() => ({
      hale: [...__game.remotes.values()].some(r => r.loreNpc === 'hale' && r.lines.length >= 3),
      region: document.getElementById('qtRegion').textContent, hidden: document.getElementById('qtRegion').hidden,
    }));
    assert.ok(town.hale, 'Captain Hale spawned in Emberhearth');
    assert.ok(!town.hidden && /Report to Hale/.test(town.region), 'tracker shows the first region quest in town: ' + town.region);

    // talk to Hale through the real interaction path
    const talked = await page.evaluate(() => {
      const g = __game; const hale = [...g.remotes.values()].find(r => r.loreNpc === 'hale');
      g.player.pos.set(hale.x + 1, g.world.gh(hale.x + 1, hale.z), hale.z); g.player.y = g.player.pos.y;
      g.spots = []; g.nearSpot(); const s = g.nearSpot(); if (!s) return 'no spot';
      return [s.kind, g.meta.p.xp];
    });
    assert.ok(Array.isArray(talked) && talked[0] === 'talk', 'Hale is a talk spot: ' + JSON.stringify(talked));
    await page.evaluate(() => { __game.tryInteract(); }); await step(0.2);
    const afterTalk = await page.evaluate(() => ({ frags: __game.meta.p.loreFragments, q: __game.meta.p.storyFlags.rq.q.r1q1 }));
    assert.ok(afterTalk.q?.done, 'talking to Hale completes Report to Hale'); assert.ok(afterTalk.frags.includes('lf_1_01'));

    const seen = {};
    for (let f = 1; f <= 6; f++) {
      await page.evaluate(n => __game.enterField(n), f); await page.waitForTimeout(500);
      await page.evaluate(() => { __game.fade = 0; }); await step(1.5);
      seen[f] = await page.evaluate(() => {
        const g = __game, r = id => document.getElementById(id);
        const boss = g.enemies.find(e => e.type === 'stag' && e.legendary);
        return {
          field: g.field, chests: g.chests?.length || 0,
          npcs: [...g.remotes.values()].filter(x => x.fieldNpc || x.loreNpc).map(x => x.name),
          loreNpcs: [...g.remotes.values()].filter(x => x.loreNpc).length,
          boss: boss?.bossName || null, bar: r('boss').querySelector('.name').textContent,
          tracker: r('qtRegion').hidden ? null : r('qtRegion').textContent,
        };
      });
      const s = seen[f];
      assert.equal(s.field, f); assert.ok(s.chests >= 1, `region ${f} has a reachable high chest (${s.chests})`);
      assert.ok(s.loreNpcs >= 1 && s.npcs.length >= 2, `region ${f} has 2 NPCs: ${s.npcs}`);
      assert.match(s.boss || '', /·/, `region ${f} boss uses lore name: ${s.boss}`);
      assert.ok(s.tracker, `region ${f} tracker line`);
      if (f === 3) await page.screenshot({ path: `${OUT}/lore_1_field_tracker.png` });
    }
    // second NPC of region 6 is reachable by the real interaction path and records the talk
    await page.evaluate(() => {
      const g = __game; const n = [...g.remotes.values()].find(r => r.loreNpc === 'veya');
      g.player.pos.set(n.x + 1, g.world.gh(n.x + 1, n.z), n.z); g.player.y = g.player.pos.y; g.nearSpot();
    });
    await page.evaluate(() => __game.tryInteract());
    assert.equal(await page.evaluate(() => __game.meta.p.storyFlags.rq.talked.veya), true, 'talking to Veya is recorded');
    assert.ok(await page.evaluate(() => __game.meta.p.loreFragments.includes('lf_6_02')));

    // Codex lore tab
    await page.evaluate(() => { __game.ui.openCodex('wiki'); });
    await page.waitForSelector('.cx-tab');
    await page.evaluate(() => { [...document.querySelectorAll('.cx-tab')].find(b => /傳說/.test(b.textContent)).click(); });
    await page.waitForTimeout(300);
    const cx = await page.evaluate(() => ({ cards: document.querySelectorAll('.cx-card').length, text: document.querySelector('.cx-body').textContent }));
    assert.ok(cx.cards > 60, 'codex lore cards ' + cx.cards); assert.match(cx.text, /Cleaver Tusk/); assert.match(cx.text, /Orld, the Antlered Elder/);
    await page.screenshot({ path: `${OUT}/lore_2_codex.png` });
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('lore_browser: ok', JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, { chests: v.chests, boss: v.boss }]))));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
