// Test the shipped recordings, gain controls and track changes in the built game.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 680 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/');
    await page.locator('#btnHeroNext').click();
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => __game.audio.effects && __game.audio.trackName === 'town');
    const formats = await page.evaluate(() => ({ effects: __game.audio.effects.duration, music: __game.audio.music.source.buffer.duration }));
    assert.ok(formats.effects > 10 && formats.music > 30);

    const played = await page.evaluate(async () => {
      const audio = __game.audio;
      const analyser = audio.master.connect(audio.ctx.createAnalyser());
      const wave = new Float32Array(analyser.fftSize);
      const readPeak = () => {
        analyser.getFloatTimeDomainData(wave);
        return wave.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
      };
      audio.setVolumes(0.9, 0, 0.8);
      audio.sfx('bowRelease');
      let shot = 0;
      for (let i = 0; i < 9; i++) {
        await new Promise(resolve => setTimeout(resolve, 28));
        shot = Math.max(shot, readPeak());
      }
      audio.setVolumes(0.9, 0, 0);
      const before = audio.voices;
      audio.sfx('forge');
      const noVoice = audio.voices === before;
      audio.setVolumes(0.9, 0.5, 0.8);
      audio.master.disconnect(analyser);
      return { shot, noVoice };
    });
    assert.ok(played.shot > 0.003, 'Bow plays non-silent PCM');
    assert.equal(played.noVoice, true);

    await page.evaluate(() => __game.net.disconnect());
    for (const [id, track] of [[1, 'meadow'], [4, 'snow']]) {
      await page.evaluate(field => __game.enterField(field), id);
      await page.waitForFunction(track => __game.audio.trackName === track && !__game.audio.trackRequest, track);
    }
    await page.evaluate(() => {
      const g = __game;
      g.enterField(1);
      g.tide.heat = 100; g.tide.phase = 3; g.tide.apexTimer = 30;
    });
    await page.waitForFunction(() => __game.audio.trackName === 'battle' && !__game.audio.trackRequest);
    await page.evaluate(() => {
      const g = __game;
      g.flameRt.dim = 3;
      g.flameRt.decayT = 0;
      g.update(1 / 60);
      g.draftPause = true;
    });
    await page.waitForFunction(() => __game.audio.dim === 3 && __game.audio.dimFilter.frequency.value < 2500,
      null, { timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log('Packaged effects, gain controls, area tracks, Apex music and Dimming passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
