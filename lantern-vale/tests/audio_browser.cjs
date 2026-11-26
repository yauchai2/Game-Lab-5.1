// Beaconfall audio in the real built game: region theme selection, Ember Tide layers, Dimming filter, and a measured
// loudness / brightness check through an AnalyserNode (headless Chromium, no speakers needed).
// Run: node build.mjs && node tests/audio_browser.cjs   (set PW_CHROMIUM=/opt/pw-browsers/chromium if needed)
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
    await page.waitForSelector('#btnStart', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('btnStart').click()); await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const g = __game, a = g.audio; a.muted = false; a.init(); a.master.gain.value = 0.9;
      const an = a.ctx.createAnalyser(); an.fftSize = 2048; a.master.connect(an); window.__an = an; window.__buf = new Float32Array(an.fftSize); window.__fb = new Uint8Array(an.frequencyBinCount);
    });
    const step = s => page.evaluate(n => { for (let t = 0; t < n; t += 1 / 30) __game.update(1 / 30); }, s);
    // measure RMS + spectral centroid over ~2.4 s of real time (analyser sampled every 40 ms)
    const measure = () => page.evaluate(async () => {
      const an = __an, sr = __game.audio.ctx.sampleRate; let rmsSum = 0, cenSum = 0, n = 0;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 40));
        an.getFloatTimeDomainData(__buf); let e = 0; for (const v of __buf) e += v * v; rmsSum += Math.sqrt(e / __buf.length);
        an.getByteFrequencyData(__fb); let num = 0, den = 0; for (let b = 0; b < __fb.length; b++) { num += b * __fb[b]; den += __fb[b]; }
        if (den > 0) { cenSum += (num / den) * (sr / 2) / __fb.length; n++; }
      }
      return { rms: rmsSum / 60, centroid: n ? cenSum / n : 0 };
    });
    const info = () => page.evaluate(() => ({ key: __game.musicKey, mode: __game.audio.mode, tide: __game.audio.tide, dim: __game.audio.dim, ctx: __game.audio.ctx.state }));

    // title -> town
    let s = await info(); console.log('start', s);
    // regions
    const want = { 1: 'meadow', 2: 'autumn', 3: 'mirefog', 4: 'snow', 5: 'ember', 6: 'elderwood' };
    const out = {};
    for (const [id, key] of Object.entries(want)) {
      await page.evaluate(i => { __game.enterField(+i); __game.fade = 0; __game.enemies.forEach(e => { e.dead = true; e.m.root.visible = false; }); __game.enemies.length = 0; }, id);
      await page.waitForTimeout(700); await step(1); await page.waitForTimeout(900);
      s = await info(); assert.equal(s.key, key, 'field ' + id + ' musicKey'); assert.equal(s.mode, key, 'field ' + id + ' audio mode');
      out[key] = await measure(); console.log(key.padEnd(10), 'rms', out[key].rms.toFixed(4), 'centroid', Math.round(out[key].centroid), 'Hz');
    }
    if (s.ctx === 'running') { for (const k in out) assert.ok(out[k].rms > 0.0005, k + ' is audible'); }
    else console.log('AudioContext not running in this environment; skipped loudness asserts');

    // Ember Tide on Dawnmeadow: phase drives the sequencer, and the music gets busier
    await page.evaluate(() => { __game.enterField(1); __game.fade = 0; __game.enemies.forEach(e => { e.dead = true; e.m.root.visible = false; }); __game.enemies.length = 0; });
    await page.waitForTimeout(900); await step(1); await page.waitForTimeout(800);
    const calm = await measure();
    await page.evaluate(() => { const td = __game.tide; td.heat = 100; td.phase = 3; td.apexTimer = 30; });
    await step(0.1); await page.waitForTimeout(500);
    s = await info(); assert.equal(s.tide, 3, 'Apex reaches the sequencer'); assert.equal(s.mode, 'meadow', 'Apex keeps the region theme');
    const apex = await measure(); console.log('tide  calm rms', calm.rms.toFixed(4), 'apex rms', apex.rms.toFixed(4), '(informational: the analyser samples a few beats only)');
    await page.evaluate(() => { const td = __game.tide; td.apexTimer = 0; td.lullTimer = 20; td.phase = -1; });
    await step(0.1); await page.waitForTimeout(300); s = await info(); assert.equal(s.tide, -1, 'Calm Ebb reaches the sequencer');
    await page.evaluate(() => { const td = __game.tide; td.lullTimer = 0; td.heat = 0; td.phase = 0; });

    // Dimming closes the filter: brighter noise disappears, loudness drops
    await step(0.1); await page.waitForTimeout(300); const open = await measure();
    await page.evaluate(() => { __game.flameRt = __game.flameRt || {}; __game.flameRt.dim = 3; });
    await step(0.2); await page.waitForTimeout(2500); s = await info(); assert.equal(s.dim, 3, 'Dimming stacks reach the audio');
    const dark = await measure(); console.log('dim   open centroid', Math.round(open.centroid), 'dim3 centroid', Math.round(dark.centroid));
    if (open.centroid > 0) assert.ok(dark.centroid < open.centroid, 'Dimming makes the music darker');
    await page.evaluate(() => { __game.flameRt.dim = 0; });

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('audio_browser: ok');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
