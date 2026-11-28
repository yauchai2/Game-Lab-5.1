const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/');
  await page.click('#btnHeroNext');
  await page.click('#btnStart');
  await page.waitForFunction(() => __game.state === 'play' && __game.zone === 'town');
  await page.waitForFunction(() => __game.player.heroRig?.animator?.clips.has('RunBack'));
  const locomotion = await page.evaluate(() => {
    const { clips } = __game.player.heroRig.animator;
    return ['Walk', 'Run', 'RunBack', 'RunL', 'RunR'].map(name =>
      clips.get(name)?.tracks.some(track => track.name.startsWith('Leg') && track.times.length > 1));
  });
  assert.deepEqual(locomotion, [true, true, true, true, true], 'five retargeted loops animate the hero legs');
  const st = () => page.evaluate(() => { const p=__game.player; return { roll: +p.roll.toFixed(2), air: p.air, y: +p.y.toFixed(2) }; });
  await page.evaluate(() => { __game.fade=0; });
  await page.keyboard.press('Space');
  const single = await st(); console.log('single', single);
  assert.ok(single.roll > 0 && !single.air, 'a single Space press rolls');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Space');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => __game.player.air && __game.player.y > 0.08, null, { timeout: 3000 });
  const double = await st(); console.log('double', double);
  assert.ok(double.air && double.y > 0 && !double.roll, 'a double Space press jumps');
  await page.waitForFunction(() => __game.player.gliding && __game.audio.glideActive, null, { timeout: 6000 });
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !__game.player.gliding && !__game.audio.glideActive && !__game.player.air);
  assert.deepEqual(errs, []);
  console.log('Glide engaged while holding Space and stopped on release, then landed.');
  await b.close();
})().catch(error => { console.error(error); process.exit(1); });
