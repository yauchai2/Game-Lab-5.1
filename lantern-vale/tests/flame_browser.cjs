// Beaconfall Phase 2: Flame in the real built game (HUD, Dimming veil, light rings, lantern respawn) + screenshots.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const OUT = process.env.FLAME_SHOTS || 'shots';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
    await page.waitForSelector('#btnStart', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(1500); await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForTimeout(1500);
    const step = (sec) => page.evaluate(s => { for (let t = 0; t < s; t += 1 / 30) __game.update(1 / 30); }, sec);
    const snap = () => page.evaluate(() => {
      const g = __game, rt = g.flameRt || {};
      return { field: g.field, state: g.state, flame: g.meta.p.flame.v, dim: rt.dim || 0, hp: g.player.hp, maxHp: g.player.stats.maxHp,
        x: g.player.pos.x, z: g.player.pos.z, lit: g.meta.p.litLanterns.length, veil: document.getElementById('dimVeil').classList.contains('on'),
        num: document.getElementById('pcFlameNum')?.textContent, rings: g._lightRings?.size || 0, speedMul: rt.fx?.speedMul, graves: g.spots.filter(s => s.kind === 'grave').length };
    });

    // town: bar visible, Flame full, no Dimming
    await page.evaluate(() => { __game.fade = 0; }); await step(1); await page.waitForTimeout(300);
    let s = await snap(); assert.equal(s.dim, 0); assert.equal(s.flame, 100); assert.match(s.num, /^100\/100$/);
    await page.screenshot({ path: `${OUT}/flame_1_town_hud.png` });

    // field 3 (Mirefog Marsh): start inside the lantern light
    await page.evaluate(() => __game.enterField(3)); await page.waitForTimeout(600);
    await page.evaluate(() => { __game.fade = 0; }); await step(2);
    s = await snap(); assert.equal(s.field, 3); assert.ok(s.rings >= 1, 'light rings drawn'); assert.equal(s.dim, 0);
    await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/flame_2_field_in_light.png` });

    // walk out of every light: Dimming appears and stacks, Flame burns down
    const away = await page.evaluate(() => {
      const g = __game; const srcs = [...g.checkpoints.filter(c => c.unlocked), ...g.exits.map(e => ({ x: e.x, z: e.z }))];
      let best = null;
      for (let i = 0; i < 400; i++) { const w = g.world.randomWalkable(g.rng || Math.random, g.player.pos, 20 + (i % 40)); const d = Math.min(...srcs.map(c => Math.hypot(c.x - w.x, c.z - w.z))); if (!best || d > best.d) best = { x: w.x, z: w.z, d }; }
      g.player.pos.set(best.x, g.world.gh(best.x, best.z), best.z); g.player.y = g.player.pos.y; g.camPos.set(best.x, 0, best.z);
      g.enemies.forEach(e => { e.dead = true; e.m.root.visible = false; }); g.enemies.length = 0;
      return best.d;
    });
    assert.ok(away > 15, 'found a spot outside all light, distance ' + away);
    await step(12); s = await snap(); assert.equal(s.dim, 0, 'still in grace');
    await step(6); s = await snap(); assert.equal(s.dim, 1); assert.ok(s.speedMul < 1);
    await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/flame_3_dimming_1.png` });
    await step(25); s = await snap(); assert.equal(s.dim, 3); assert.ok(s.flame < 100); assert.equal(s.veil, true);
    await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/flame_4_dimming_3.png` });

    // die outside the light: respawn at nearest lit lantern, same field, grave where we fell
    const fell = { x: s.x, z: s.z };
    await page.evaluate(() => { __game.meta.p.goods.ore = 12; __game.die(); });
    await page.waitForTimeout(1500);
    s = await snap();
    assert.equal(s.state, 'play'); assert.equal(s.field, 3, 'stays in the field'); assert.equal(s.hp, s.maxHp);
    assert.ok(s.dim === 0 && s.flame >= 60, 'respawn clears Dimming and refills Flame to >= 60%');
    assert.ok(Math.hypot(s.x - fell.x, s.z - fell.z) > 15, 'moved to a lantern');
    assert.equal(s.graves, 1, 'gravestone spot created where we fell');
    assert.equal(await page.evaluate(() => __game.meta.p.goods.ore), 9, '25% materials kept in the grave');
    await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/flame_5_respawn_lantern.png` });

    // no lit lantern at all: falls back to town like before
    await page.evaluate(() => { for (const c of __game.checkpoints) c.unlocked = false; __game.die(); });
    await page.waitForFunction(() => __game.depth === -1, null, { timeout: 8000 });
    s = await snap(); assert.equal(s.field, 0);

    // Dimming veil off in town; mobile layout still fits
    await page.waitForTimeout(600); s = await snap(); assert.equal(s.veil, false);
    await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/flame_6_phone.png` });
    assert.deepEqual(errors, [], 'no page errors');
    console.log('flame_browser: ok');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
