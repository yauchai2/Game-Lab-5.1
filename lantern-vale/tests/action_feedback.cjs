const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/');
    await page.locator('#btnHeroNext').click();
    await page.locator('#btnStart').click();
    await page.waitForFunction(() => __game.state === 'play' && __game.player.heroRig.animator?.clips.size > 0);

    const feedback = await page.evaluate(() => {
      const g = __game, p = g.player;
      const contacts = [], cues = [], poses = [];
      const contact = g.audio.contact.bind(g.audio), sfx = g.audio.sfx.bind(g.audio), play = p.heroRig.play.bind(p.heroRig);
      g.audio.contact = (surface, force, hoof) => { contacts.push({ surface, force, hoof }); contact(surface, force, hoof); };
      g.audio.sfx = (name, value) => { cues.push(name); sfx(name, value); };
      p.heroRig.play = (name, options) => { poses.push(name); return play(name, options); };
      try {
        p.pos.set(0, g.world.gh(0, 0), 0);
        p.vel.set(0, 0, 0);
        g.fade = 0;
        p.y = g.world.gh(p.pos.x, p.pos.z);
        const plaza = g.contactSurface();
        const pier = g.world.pierBounds[0];
        const saved = p.pos.clone();
        p.pos.set((pier.x0 + pier.x1) / 2, pier.y, (pier.z0 + pier.z1) / 2);
        const deck = g.contactSurface();
        p.pos.copy(saved);

        g.keys = { w: true };
        for (let i = 0; i < 23; i++) g.update(1 / 30);
        const walking = contacts.splice(0).map(event => event.surface);
        const movePlayer = g.movePlayer;
        g.movePlayer = () => {};
        try {
          for (let i = 0; i < 25; i++) g.update(1 / 30);
        } finally {
          g.movePlayer = movePlayer;
          g.keys = {};
        }
        const againstWall = contacts.length;

        p.pos.copy(saved); p.y = g.world.gh(p.pos.x, p.pos.z);
        p.air = false; p.roll = 0;
        g.tryJump();
        for (let i = 0; i < 7; i++) g.animatePlayer(1 / 60);
        const jumpTime = p.heroRig.animator.curAction.time;
        for (let i = 0; i < 35; i++) g.updateVertical(1 / 30, { lengthSq: () => 0 });

        p.cds.atk = p.cds.action = 0; poses.length = 0;
        g.tryAttack();
        for (let i = 0; i < 10; i++) g.animatePlayer(1 / 60);
        const attacks = poses.filter(name => name === 'attack' || name === 'runAttack');
        const originalX = p.pos.x;
        cues.length = 0;
        g.enemyCue('enemyWind', { x: originalX + 30, z: p.pos.z });
        g.enemyCue('enemyWind', p.pos);
        const audibleWarnings = cues.filter(name => name === 'enemyWind').length;
        return { plaza, deck, walking, againstWall, jumpTime, attacks, audibleWarnings, landing: contacts.at(-1) };
      } finally {
        g.audio.contact = contact; g.audio.sfx = sfx; p.heroRig.play = play;
      }
    });
    assert.equal(feedback.plaza, 'stone');
    assert.equal(feedback.deck, 'wood');
    assert.ok(feedback.walking.includes('stone'));
    assert.equal(feedback.againstWall, 0);
    assert.ok(feedback.jumpTime > 0.06, 'Jump clip advances while the key is held');
    assert.equal(feedback.attacks.length, 1, 'Attack clip starts once per action');
    assert.equal(feedback.audibleWarnings, 1);
    assert.ok(feedback.landing.force > 0.6);

    await page.evaluate(async () => {
      const a = __game.audio;
      await a.ctx.resume();
      a.setGlide(true);
      if (!a.glideActive) throw new Error('Glide loop did not start');
      a.setGlide(false);
      if (a.glideActive) throw new Error('Glide loop did not stop');
    });
    if (process.env.LV_SCREENSHOT_DIR) {
      await page.evaluate(() => {
        const g = __game;
        g.player.cds.roll = 0;
        g.tryRoll();
        g.player.roll = 0.20;
        g.animatePlayer(1 / 60);
      });
      await page.screenshot({ path: path.join(process.env.LV_SCREENSHOT_DIR, 'beaconfall-action-feedback.png') });
    }
    assert.deepEqual(errors, []);
    console.log('Action feedback passed for surfaces, collisions, jump, landing, attacks, enemy warning range and glide audio.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
