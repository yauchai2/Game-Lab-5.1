const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || 'chrome' });
  const errors = [];
  try {
    const base = process.env.LV_GAME_URL || 'http://localhost:8080/';
    async function open(viewport, touch = false) {
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.locator('#btnQuickStart').click();
      await page.evaluate(() => {
        const game = __game;
        game.meta.p.level = 12;
        game.meta.p.puzzle = {
          nextUid: 8, activePreset: 0, partyGem: null,
          presets: [[{ uid: 1, id: 'bolt', x: 1, y: 1, rot: 0 }, { uid: 2, id: 'slam', x: 3, y: 3, rot: 0 }], [], []],
          bag: [{ uid: 3, id: 'ember', rot: 0 }, { uid: 4, id: 'frost', rot: 0 }, { uid: 5, id: 'black_hole', rot: 0 },
            { uid: 6, id: 'haste', rot: 0 }, { uid: 7, id: 'survey', rot: 0 }],
        };
        game.meta.save();
        game.recalc();
        game.ui.openPuzzle();
      });
      return page;
    }
    const cell = (page, x, y) => page.locator(`.pz-cell[data-x="${x}"][data-y="${y}"]`);
    const gem = (page, uid) => page.locator(`.pz-bag [data-gem-uid="${uid}"]`);
    const data = (page, persisted = false) => page.evaluate(saved => {
      const formula = (saved ? __game.meta.load() : __game.meta.p).puzzle;
      return { board: formula.presets[formula.activePreset], party: formula.partyGem, bag: formula.bag.map(item => item.uid).sort() };
    }, persisted);
    async function center(locator) {
      const box = await locator.boundingBox();
      assert.ok(box, 'Drop target is visible');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    async function pull(page, source, dest, { valid, beforeDrop, point } = {}) {
      await source.scrollIntoViewIfNeeded();
      const from = await center(source);
      const to = point || await center(dest);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      if (valid !== undefined) assert.ok(await page.locator(`.pz-cell.preview-${valid ? 'ok' : 'bad'}`).count() > 0);
      if (beforeDrop) await beforeDrop();
      await page.mouse.up();
      assert.equal(await page.locator('.pz-drag-ghost').isVisible(), false);
    }

    const desktop = await open({ width: 1440, height: 920 });
    const initial = await data(desktop);
    await pull(desktop, gem(desktop, 3), cell(desktop, 2, 2), {
      valid: true,
      beforeDrop: async () => {
        assert.deepEqual(await data(desktop, true), initial, 'Dragging previews without changing saved layout');
      },
    });
    let state = await data(desktop, true);
    assert.ok(state.board.some(item => item.uid === 3 && item.x === 2 && item.y === 2));
    assert.equal(await desktop.locator('.pz-link').count(), 1);
    await pull(desktop, gem(desktop, 4), cell(desktop, 5, 5), { valid: false });
    assert.deepEqual(await data(desktop), state, 'Locked or overhanging drop preserves the bag');
    await pull(desktop, cell(desktop, 3, 3), cell(desktop, 1, 1), { valid: false });
    assert.deepEqual(await data(desktop), state, 'Occupied drop preserves the previous location');

    // Moving by the second cell preserves the grab offset and skill-bar ordering.
    await pull(desktop, cell(desktop, 2, 1), cell(desktop, 3, 1), { valid: true });
    state = await data(desktop, true);
    assert.equal(state.board[0].uid, 1);
    assert.equal(state.board[0].x, 2);
    await pull(desktop, cell(desktop, 2, 2), desktop.locator('#pzPartySlot'));
    assert.equal((await data(desktop, true)).party.uid, 3);
    await pull(desktop, desktop.locator('#pzPartySlot'), null, { point: { x: 15, y: 20 } });
    assert.ok((await data(desktop, true)).bag.includes(3));
    assert.equal(await desktop.locator('#puzzleM').isVisible(), true, 'Drop on backdrop keeps the panel open');

    await gem(desktop, 4).focus();
    await desktop.keyboard.press('Enter');
    await desktop.keyboard.press('r');
    await cell(desktop, 1, 1).focus();
    await desktop.keyboard.press('ArrowDown');
    await desktop.keyboard.press('Enter');
    assert.ok((await data(desktop, true)).board.some(item => item.uid === 4 && item.rot === 1 && item.y === 2));
    const beforeCancel = await data(desktop, true);
    const grabbed = await center(cell(desktop, 1, 2));
    await desktop.mouse.move(grabbed.x, grabbed.y);
    await desktop.mouse.down();
    await desktop.mouse.move(grabbed.x + 42, grabbed.y, { steps: 4 });
    await desktop.keyboard.press('Escape');
    await desktop.mouse.up();
    assert.deepEqual(await data(desktop, true), beforeCancel, 'Closing mid-drag leaves equipment intact');
    await desktop.evaluate(() => __game.ui.openPuzzle());

    const shots = process.env.LV_SCREENSHOT_DIR;
    await pull(desktop, gem(desktop, 3), cell(desktop, 2, 2), { valid: true });
    if (shots) await desktop.screenshot({ path: path.join(shots, 'gem-workbench-desktop.png') });
    await pull(desktop, cell(desktop, 2, 2), null, { point: { x: 15, y: 20 } });
    assert.ok((await data(desktop, true)).bag.includes(3), 'Board gem dropped off the board is returned to the bag');
    await desktop.locator('#pzSearch').fill('無符合的測試字');
    await desktop.getByText('沒有符合的寶石。試試其他關鍵字或類型。').waitFor();
    await desktop.getByRole('button', { name: '清除寶石搜尋' }).click();
    assert.equal(await desktop.locator('#pzSearch').inputValue(), '');

    const phone = await open({ width: 390, height: 844 }, true);
    const touch = await phone.context().newCDPSession(phone);
    async function slide(source, dest, cancel = false) {
      await source.scrollIntoViewIfNeeded();
      const from = await center(source);
      const to = await center(dest);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove',
          touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }] });
      }
      await touch.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    }
    await slide(gem(phone, 3).locator('.pz-grip'), cell(phone, 2, 2));
    assert.ok((await data(phone, true)).board.some(item => item.uid === 3));
    const beforeTouchCancel = await data(phone, true);
    await slide(cell(phone, 2, 2), cell(phone, 2, 3), true);
    assert.deepEqual(await data(phone, true), beforeTouchCancel);
    assert.equal(await phone.locator('.pz-drag-ghost').isVisible(), false);
    if (shots) await phone.screenshot({ path: path.join(shots, 'gem-workbench-mobile.png') });
    await slide(cell(phone, 2, 2), phone.locator('.pz-bag'));
    assert.ok((await data(phone, true)).bag.includes(3));
    assert.equal(await phone.locator('#puzzleM').isVisible(), true);
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await phone.setViewportSize(viewport);
      const grid = await phone.locator('.pz-grid').boundingBox();
      assert.ok(grid.x >= 0 && grid.x + grid.width <= viewport.width, 'Full board fits horizontally');
    }
    assert.deepEqual(errors, []);
    console.log('Gem drag passed logical previews, drop, invalid recovery, party transfers, cancel, keyboard, touch and responsive geometry.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
