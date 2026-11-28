const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const WebSocket = require('ws');
const { once } = require('node:events');

(async () => {
  const { computeBoard, autoBuildBoard } = await import('../src/puzzle.js');
  const { readClassTalent, chooseClassTalent } = await import('../src/class_talents.js');
  const board = [
    { id: 'bolt', uid: 1, x: 2, y: 2, rot: 0, supportPriority: [3], keepPosition: true },
    { id: 'ember', uid: 2, x: 2, y: 1, rot: 0 },
    { id: 'haste', uid: 3, x: 2, y: 3, rot: 0 },
  ];
  assert.deepEqual(computeBoard(board, null, 5)[0].mod.supportUids, [3]);
  assert.equal(autoBuildBoard(board, [], 5, 'boss').placed[0].x, 2);
  assert.equal(autoBuildBoard(board, [], 5, 'boss').placed[0].keepPosition, true);

  const forBridge = [
    { id: 'bolt', uid: 4, x: 1, y: 2, rot: 0, triggerTarget: 'rain' },
    { id: 'coh', uid: 5, x: 1, y: 1, rot: 0 },
    { id: 'rain', uid: 6, x: 2, y: 0, rot: 0 },
    { id: 'mark', uid: 7, x: 0, y: 1, rot: 0 },
  ];
  assert.deepEqual(computeBoard(forBridge, null, 30)[0].mod.triggerOnHit, ['rain']);
  const profile = { growthJourney: { clears: { 1: true, 2: true, 3: true, 5: true, 6: true } } };
  for (let job = 0; job < 5; job++) {
    assert.equal(chooseClassTalent(profile, job, false, '0'), false);
    assert.equal(chooseClassTalent(profile, job, false, 'root'), true);
    assert.equal(chooseClassTalent(profile, job, false, '0'), true);
    assert.equal(chooseClassTalent(profile, job, false, '1'), false);
    assert.equal(chooseClassTalent(profile, job, false, '0'), true);
    assert.equal(chooseClassTalent(profile, job, false, '0'), false);
    assert.equal(chooseClassTalent(profile, job, true, '0'), true);
    assert.equal(chooseClassTalent(profile, job, true, '0'), true);
    assert.equal(readClassTalent(profile, job, true).rank, 4);
    assert.equal(chooseClassTalent(profile, job, true, 'reset'), true);
  }

  const base = process.env.LV_GAME_URL || 'http://localhost:18114/';
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const sockets = [];
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('?growth=progression', base).href);
    await page.locator('#btnQuickStart').click();
    await page.evaluate(() => {
      const g = __game;
      g.character.job = 0;
      g.meta.p.growthLessons = { 0: 2 };
      g.meta.p.growthJourney = { clears: { 1: true, 2: true } };
      g.enterField(2);
      const spot = g.spots.find(s => s.kind === 'growthStation');
      g.player.pos.set(spot.x, g.world.gh(spot.x, spot.z), spot.z);
      g.openGrowthStation(spot);
    });
    await page.getByRole('button', { name: /職業天賦/ }).click();
    await page.getByRole('button', { name: /燈芯扎根/ }).click();
    await page.getByRole('button', { name: /守燈陣式/ }).click();
    if (process.env.LV_TALENT_SCREENSHOT) await page.screenshot({ path: process.env.LV_TALENT_SCREENSHOT });
    await page.getByRole('button', { name: /返回/ }).click();
    await page.evaluate(() => __game.gainClassRes(100));
    assert.ok(await page.evaluate(() => __game.player.talentWard > 0));
    await page.getByRole('button', { name: /構築練習/ }).click();
    await page.getByRole('button', { name: /單體木樁/ }).click();
    assert.equal(await page.evaluate(() => {
      const g = __game, trial = g.growthTrial;
      const dummy = g.enemies.find(e => e.growthTrial === trial);
      if (!dummy) return 0;
      const coins = g.meta.p.coins;
      g.hitEnemy(dummy, { dmg: 42 });
      return g.meta.p.coins === coins && !dummy.dead ? trial.damage : -1;
    }), 42);
    assert.deepEqual(errors, []);

    const url = new URL('/ws', base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    async function peer(party, job) {
      const ws = new WebSocket(url);
      sockets.push(ws);
      const received = [];
      ws.on('message', raw => received.push(JSON.parse(raw)));
      await once(ws, 'open');
      ws.send(JSON.stringify({ t: 'pos', zone: 'field:1', party, job, x: 1, y: 0, z: 1 }));
      return { ws, received };
    }
    const source = await peer('test-party', 0);
    const ally = await peer('test-party', 1);
    const other = await peer('other-party', 1);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await wait(150);
    source.ws.send(JSON.stringify({ t: 'class_ward', zone: 'field:1' }));
    source.ws.send(JSON.stringify({ t: 'evolution_fx', zone: 'field:1', kind: 'slam', x: 3, z: 1 }));
    source.ws.send(JSON.stringify({ t: 'evolution_fx', zone: 'field:1', kind: 'slam', x: 3, z: 1 }));
    await wait(250);
    assert.equal(ally.received.filter(m => m.t === 'class_ward').length, 1);
    assert.equal(other.received.filter(m => m.t === 'class_ward').length, 0);
    assert.equal(ally.received.filter(m => m.t === 'evolution_fx').length, 1);
    console.log('Combat builds: support priorities, directed triggers, pinned packing, class progression, practice and multiplayer relay passed.');
  } finally {
    for (const socket of sockets) socket.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
