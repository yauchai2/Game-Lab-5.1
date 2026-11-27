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
      const splitter = audio.master.connect(audio.ctx.createChannelSplitter(2));
      const analysers = [0, 1].map(channel => {
        const analyser = audio.ctx.createAnalyser();
        splitter.connect(analyser, channel);
        return analyser;
      });
      const wave = new Float32Array(analysers[0].fftSize);
      const readPeak = analyser => {
        analyser.getFloatTimeDomainData(wave);
        return wave.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
      };
      audio.setVolumes(0.9, 0, 0.8);
      audio.sfx('bowRelease', 1, -0.8);
      const peaks = [0, 0];
      for (let i = 0; i < 9; i++) {
        await new Promise(resolve => setTimeout(resolve, 28));
        for (let ch = 0; ch < 2; ch++) peaks[ch] = Math.max(peaks[ch], readPeak(analysers[ch]));
      }
      audio.setVolumes(0.9, 0, 0);
      const before = audio.voices;
      audio.sfx('forge');
      const noVoice = audio.voices === before;
      audio.setVolumes(0.9, 0, 0.8);
      for (let i = 0; i < 22; i++) audio.playClip('bow', 0);
      const normalLimit = audio.voices;
      audio.sfx('enemyWind', 1, 0.6);
      const warningVoices = audio.voices;
      audio.setVolumes(0.9, 0.5, 0.8);
      audio.master.disconnect(splitter);
      splitter.disconnect();
      return { peaks, noVoice, normalLimit, warningVoices };
    });
    assert.ok(played.peaks[0] > 0.003, 'Bow plays non-silent PCM');
    assert.ok(played.peaks[0] > played.peaks[1] * 2, 'A left-side attack is louder on the left channel');
    assert.equal(played.noVoice, true);
    assert.equal(played.normalLimit, 20);
    assert.equal(played.warningVoices, 21, 'A warning remains audible with the normal voices filled');

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
    console.log('Packaged effects, gain controls, stereo position, warning reserve, area tracks, Apex music and Dimming passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
