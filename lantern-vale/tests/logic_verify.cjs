// Pure Node.js logic & authoritative server integration tests (no Chromium required)
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const createGuild = require('../server/guild.cjs');

(async () => {
  const src = p => pathToFileURL(path.resolve(__dirname, '../src', p)).href;
  const frontier = await import(src('frontier.js'));
  const lodge = await import(src('lodge.js'));

  // 1. Nine ultra-grand persistent regions (2x expanded again: 240–400) & status affinities
  assert.equal(frontier.FIELDS.length, 10);
  assert.deepEqual(
    frontier.FIELDS.slice(1).map(f => [f.name, f.level, f.size]),
    [
      ['晨光草原', 1, 240],
      ['低語森林', 5, 360],
      ['霧潮沼澤', 10, 240],
      ['霜冬雪原', 15, 360],
      ['燼煙火岩區', 20, 240],
      ['古樹林', 25, 400],
      ['浮空遺跡群', 12, 320],
      ['珊瑚潮汐灣', 18, 320],
      ['沉沒電光都', 24, 320],
    ],
  );
  assert.equal(frontier.FIELDS[3].status, 'poison');
  assert.equal(frontier.FIELDS[4].status, 'freeze');
  assert.equal(frontier.FIELDS[5].status, 'burn');
  assert.equal(frontier.FIELDS[9].status, 'shock');
  assert.equal(frontier.FIELDS[7].beast, 'skyray', 'Zone 7 features aerial skyray mobs');
  assert.equal(frontier.FIELDS[8].beast, 'skyray', 'Zone 8 features aerial skyray mobs');

  // 2. Character leveling (capped at 30), material drops, keys & elite rewards
  const toasts = [];
  let recalced = 0;
  const mockGame = {
    field: 1,
    depth: 0,
    player: { pos: { x: 4, z: -5 }, equip: { staff: null, cloak: null, charm: null } },
    meta: { p: structuredClone(frontier.progressDefaults), save() {} },
    ui: { toast(msg) { toasts.push(msg); } },
    recalc() { recalced++; },
  };
  frontier.awardKill(mockGame, { type: 'slime', level: 5, elite: true, spawnIndex: 5 });
  assert.equal(mockGame.meta.p.keys, 2, 'Elite kill grants +1 keystone');
  assert.equal(mockGame.meta.p.goods.fish, 3, 'Elite kill grants +3 material');
  assert.equal(mockGame.meta.p.species.slime, 1, 'Species codex records kill');
  for (let i = 0; i < 600; i++) frontier.awardKill(mockGame, { type: 'stag', level: 30, elite: true, spawnIndex: 0 });
  assert.equal(mockGame.meta.p.level, 30, 'Character level caps at 30');
  assert.equal(mockGame.meta.p.xp, 0, 'XP resets cleanly at cap');
  assert.ok(recalced >= 29, 'recalc called on level-ups');

  // 3. Death drops exact 25% of total materials into grave without touching gear/shards
  mockGame.meta.p.goods = { wood: 5, ore: 5, fish: 2 }; // total = 12 -> 25% = 3
  const lost = frontier.leaveGrave(mockGame);
  assert.equal(lost, 3, 'Drops exact floor(25%) of total materials');
  assert.equal(
    mockGame.meta.p.goods.wood + mockGame.meta.p.goods.ore + mockGame.meta.p.goods.fish,
    9,
  );
  assert.ok(mockGame.meta.p.graves[1], 'Grave saved for current field');
  const gGoods = mockGame.meta.p.graves[1].goods;
  assert.equal(gGoods.wood + gGoods.ore + gGoods.fish, 3, 'Grave holds exact dropped materials');

  // 4. Crafting consumes 2 wood + 3 ore, equips rare item & preserves replaced gear in physics backpack
  mockGame.meta.p.goods = { wood: 4, ore: 6, fish: 0 };
  mockGame.player.equip.staff = { name: '舊木燈杖', slot: 'staff', rarity: 0, mods: [] };
  mockGame.player.equip.cloak = { name: '舊斗篷', slot: 'cloak', rarity: 0, mods: [] };
  mockGame.player.equip.charm = { name: '舊護符', slot: 'charm', rarity: 0, mods: [] };
  const crafted = frontier.craft(mockGame);
  assert.ok(typeof crafted === 'string' && crafted.length > 0, 'Crafting returns item name');
  assert.equal(mockGame.meta.p.goods.wood, 2);
  assert.equal(mockGame.meta.p.goods.ore, 3);
  assert.ok(Object.values(mockGame.player.equip).some(it => it && it.rarity === 2));
  assert.ok((mockGame.meta.p.bagItems || []).some(b => b.kind === 'gear' && b.name.startsWith('舊')), 'Replaced gear saved to physics backpack');

  // 5. Auction house quotes differentiate goods and return trend labels
  const t0 = 1700000000000;
  const prices = ['wood', 'ore', 'fish'].map(k => lodge.quote(k, t0));
  assert.ok(prices.every(p => p >= 2 && p <= 12), 'Prices in valid range');
  assert.ok(new Set(prices).size >= 2, 'Goods do not all collide on the same price');
  assert.ok(['▲ 高價', '▼ 低價', '● 平盤'].includes(lodge.trendLabel('ore', prices[1])));

  // 6. Server-authoritative guild raid & SQLite exchange
  const guild = createGuild(':memory:');
  const makeClient = (id, name) => {
    const msgs = [];
    return {
      id,
      name,
      msgs,
      ws: { readyState: 1, send(raw) { msgs.push(JSON.parse(raw)); } },
    };
  };
  const c1 = makeClient(1, '旅人一');
  const c2 = makeClient(2, '旅人二');
  guild.message(c1, { t: 'guildHello', secret: 'a'.repeat(64) });
  guild.message(c2, { t: 'guildHello', secret: 'b'.repeat(64) });
  assert.equal(c1.msgs.at(-1).t, 'wallet');
  guild.message(c1, { t: 'raidJoin', code: '測試隊' });
  guild.message(c2, { t: 'raidJoin', code: '測試隊' });
  assert.ok(c1.msgs.some(m => m.t === 'raidStart'));
  assert.ok(c2.msgs.some(m => m.t === 'raidStart'));
  for (let i = 0; i < 80; i++) {
    const moveZ = i < 5 ? -1 : 0;
    guild.message(c1, { t: 'raidInput', x: 0, z: moveZ, attack: true });
    guild.message(c2, { t: 'raidInput', x: 0, z: moveZ, attack: true });
    guild.tick();
  }
  const w1 = c1.msgs.filter(m => m.t === 'wallet').at(-1);
  const w2 = c2.msgs.filter(m => m.t === 'wallet').at(-1);
  assert.equal(w1.coins, 12, 'Raid victory grants 12 guild coins');
  assert.equal(w1.amber, 1, 'Raid victory grants 1 resonance amber');
  assert.equal(w2.amber, 1);

  // List 1 amber for 10 coins (10% tax = 1 coin), c2 buys it -> c1 gets 9, c2 pays 10
  c1.guildAt = 0; c2.guildAt = 0;
  guild.message(c1, { t: 'trade', op: 'list', price: 10 });
  const lotId = c2.msgs.filter(m => m.t === 'wallet').at(-1).lots[0].id;
  guild.message(c2, { t: 'trade', op: 'buy', id: lotId });
  const w1After = c1.msgs.filter(m => m.t === 'wallet').at(-1);
  const w2After = c2.msgs.filter(m => m.t === 'wallet').at(-1);
  assert.equal(w1After.coins, 21, 'Seller receives price minus 10% tax (12 + 9)');
  assert.equal(w1After.amber, 0);
  assert.equal(w2After.coins, 2, 'Buyer pays 10 guild coins (12 - 10)');
  assert.equal(w2After.amber, 2, 'Buyer receives amber');

  // 7. Class system & 6x6 Skill Puzzle mechanics
  const puzzle = await import(src('puzzle.js'));
  assert.equal(puzzle.CLASSES.length, 4, 'Four distinct original classes defined');
  assert.equal(puzzle.unlockedCount(1), 16, 'Lv.1 unlocks 16 center puzzle cells');
  assert.equal(puzzle.unlockedCount(30), 36, 'Lv.30 unlocks full 6x6 (36) cells');
  const rot1 = puzzle.rotateCells([[0, 0], [1, 0], [2, 0]], 1);
  assert.deepEqual(rot1, [[0, 0], [0, 1], [0, 2]], '90-degree polyomino rotation normalizes cleanly');

  const pzProfile = { puzzle: null };
  const pz = puzzle.ensurePuzzle(pzProfile, 1); // 林風遊俠
  const board = puzzle.computeBoard(pz.presets[0]);
  assert.equal(board.length, 1, 'Ranger starts with 1 active skill (星羽箭雨) on board');
  assert.equal(board[0].id, 'rain');
  assert.equal(board[0].mod.multi, 2, 'Adjacent 多重投射 adds +2 projectiles/waves');
  assert.ok(board[0].mod.cdr > 0, 'Adjacent 極速詠唱 reduces cooldown');
  // Stack a second 熾炎增幅 adjacent to rain at (2, 1)
  assert.equal(puzzle.canPlace(pz.presets[0], 'ember', 2, 1, 0, 1), true);
  pz.presets[0].push({ uid: 99, id: 'ember', x: 2, y: 1, rot: 0 });
  const board2 = puzzle.computeBoard(pz.presets[0]);
  assert.equal(board2[0].mod.dmgMult, 1.25, 'Adjacent 熾炎增幅 boosts active skill damage +25%');
  assert.equal(board2[0].mod.supports.length, 3, 'Three adjacent support gems linked simultaneously');

  // 8. World Alive expansion: Ultra-slow smooth Day/Night (long daytime ~70%), 8 Second Classes, 4 Flashy Skills, 6 Field NPCs
  const alive = await import(src('world_alive.js'));
  assert.equal(alive.dayInfo(0.05).phase, 'dawn');
  assert.equal(alive.dayInfo(0.42).phase, 'day');
  assert.equal(alive.dayInfo(0.68).phase, 'day', 'Daytime stays long & bright well into afternoon');
  assert.equal(alive.dayInfo(0.80).phase, 'dusk');
  assert.equal(alive.dayInfo(0.92).isNight, true, 'Night phase sets isNight=true');
  assert.ok(Math.abs(alive.dayInfo(0.75).sunMult - alive.dayInfo(0.74).sunMult) < 0.1, 'Day/Night lighting transitions smoothly');
  assert.equal(Object.values(alive.SECOND_CLASSES).flat().length, 8, 'Eight 2nd-tier classes defined');
  assert.equal(Object.keys(alive.FIELD_NPCS).length, 6, 'Six unique field NPCs & quests defined');
  for (const id of ['meteor', 'nova', 'prism', 'phantom']) {
    assert.ok(puzzle.ACTIVE_GEMS[id], `Flashy creative skill ${id} registered in puzzle gems`);
  }

  // 9. Full i18n, Multi-Shape Physics Backpack, Town-Only Stash, 2D Fluid Vials & Custom Keybinds
  const i18n = await import(src('i18n.js'));
  assert.equal(i18n.LANGS.length, 3, 'Three languages supported (zh-TW, en, ja)');
  assert.equal(i18n.t('en', 'bag'), 'Physics Bag');
  assert.equal(i18n.t('en', 'tabVideo'), 'Video');
  assert.equal(i18n.t('ja', 'stash'), '街の倉庫');
  assert.ok(i18n.t('en', 'stashLocked').includes('not carried'), 'Town-only stash warning localized');

  const physbag = await import(src('physbag.js'));
  assert.equal(physbag.shapeForItem({ kind: 'gear', slot: 'staff' }).shape, 'capsule');
  assert.equal(physbag.shapeForItem({ kind: 'gear', slot: 'cloak' }).shape, 'rect');
  assert.equal(physbag.shapeForItem({ kind: 'gear', slot: 'charm' }).shape, 'diamond');
  const bagProfile = {};
  const store = physbag.ensurePhysicsStorage(bagProfile);
  assert.ok(store.bag.length >= 3, 'Starter supplies populated in physics backpack');
  assert.ok(new Set(store.bag.map(x => x.shape)).size >= 3, 'Backpack items have distinct physical shapes');
  const fakeCanvas = { width: 320, height: 240, getContext: () => ({}), addEventListener: () => {} };
  const pc = new physbag.PhysicsContainer(fakeCanvas);
  pc.sync(store.bag);
  const y0 = pc.bodies[0].y;
  for (let i = 0; i < 40; i++) pc.step(1 / 60);
  assert.ok(pc.bodies[0].y > y0, 'Gravity pulls multi-shape physics backpack items downward');
  pc.shake();
  assert.ok(pc.bodies[0].vy < 0, 'Shake launches physics items upward for reorganizing');

  // 10. 2D Fluid-Physics HP/MP Glass Vials (slosh, splashes, poison bubbles, overload cork rattling)
  const vials = await import(src('vials.js'));
  const hpVial = new vials.FluidVial(null, 'hp');
  hpVial.impulse(2.0, 1.5);
  assert.ok(hpVial.splashes.length > 0, 'Impulse creates fluid splash droplets');
  for (let i = 0; i < 30; i++) hpVial.step(1 / 60, 0.75, { poison: true });
  assert.ok(hpVial.bubbles.some(b => b.kind === 'poison'), 'Poison status generates viscous toxic bubbles');
  for (let i = 0; i < 40; i++) hpVial.step(1 / 60, 0.85, { overload: true });
  assert.ok(hpVial.corkY < 0 || Math.abs(hpVial.corkVy) > 0, 'Overload boiling rattles the cork stopper');

  const harbor = await import(src('harbor.js'));
  assert.equal(harbor.COSMETICS.hats.length, 5, 'Five 3D hat cosmetics defined');
  assert.equal(harbor.COSMETICS.backs.length, 4, 'Four 3D back cosmetics defined');
  assert.equal(harbor.COSMETICS.auras.length, 5, 'Five weapon/lantern aura cosmetics defined');
  const pier = harbor.buildWoodenPier(19, 27.6, 5.2);
  assert.ok(pier.bounds.z1 > 27, 'Wooden pier extends past town shoreline into open water');

  const settings = await import(src('settings.js'));
  assert.deepEqual(Object.keys(settings.KEY_PRESETS), ['arpg', 'poe', 'mmo']);
  assert.equal(settings.KEY_PRESETS.arpg.recall, 'h', 'Default recall hotkey is H');
  assert.equal(settings.DEFAULTS.camAngle, 0, 'Default camera angle is PoE 2 45-degree oblique');

  // 11. Cairn-style Physics Backpack Collision Synthesis & PoE2/AutoWanderer Encyclopedia + Changelog
  assert.ok(physbag.BAG_RECIPES.length >= 3, 'At least 3 physics collision synthesis recipes defined');
  const berry = { uid: 'b1', kind: 'consumable', icon: '🍓', name: '山谷甜莓' };
  const cider = { uid: 'c1', kind: 'consumable', icon: '🍺', name: '楓糖蘋果酒' };
  const rec = physbag.findRecipe(berry, cider);
  assert.ok(rec && rec.type === 'recipe' && rec.recipe.out.icon === '🍹', 'Berry + Cider matches 微醺莓果特調 recipe');
  const synthMockGame = {
    meta: { p: { level: 5, bagItems: [berry, cider] }, save() {} },
    audio: { sfx() {} },
    ui: { toast() {} },
  };
  const fused = physbag.synthesizeBagItems(synthMockGame, berry, cider, 'bagItems');
  assert.equal(fused.name, '微醺莓果特調', 'Collision synthesis produces 微醺莓果特調');
  assert.equal(synthMockGame.meta.p.bagItems.length, 1, 'Consumes both source items and inserts fused item');
  const gA = { uid: 'g1', kind: 'gear', name: '木杖', item: { name: '木杖', slot: 'staff', rarity: 0, mods: [] } };
  const gB = { uid: 'g2', kind: 'gear', name: '布袍', item: { name: '布袍', slot: 'cloak', rarity: 0, mods: [] } };
  synthMockGame.meta.p.bagItems = [gA, gB];
  const upgraded = physbag.synthesizeBagItems(synthMockGame, gA, gB, 'bagItems');
  assert.equal(upgraded.item.rarity, 1, 'Two same-rarity gears collide and fuse into higher rarity');

  const codex = await import(src('codex.js'));
  assert.equal(codex.GAME_VERSION, 'v1.0.0', 'Codex exports current version v1.0.0');
  assert.ok(codex.CHANGELOG.length >= 7, 'Changelog contains structured version history through v1.0.0');

  // 12. Tier System (T1-T6) & 3D Mount Milestone System
  const loot = await import(src('loot.js'));
  assert.equal(loot.tierInfo(1).tag, 'T1');
  assert.equal(loot.tierInfo(5).name, '傳世階');
  const mounts = await import(src('mounts.js'));
  assert.equal(mounts.MOUNTS.length, 3, 'Three original mounts defined');
  assert.equal(mounts.activeMountDef({ level: 1, kills: 0 }), null, 'New player starts with mounts locked');
  assert.equal(mounts.activeMountDef({ level: 5, kills: 0 }).id, 'stag', 'Lv.5 unlocks Forest Stag mount');
  assert.equal(mounts.activeMountDef({ level: 1, visitedFields: [1, 2, 3], mountId: 'alpaca' }).id, 'alpaca', 'Exploring 3 fields unlocks Cloud Alpaca mount');
  assert.equal(mounts.activeMountDef({ level: 10, secondClass: 'sunblade', mountId: 'manta' }).id, 'manta', 'Second-class awakening unlocks Starwing Manta mount');

  // 13. v1.0.0 Art, Terrain Smoothness (GW=181), Sheep & Ancient Blessing Shrines
  const world = await import(src('world.js'));
  assert.equal(world.GW, 181, 'Terrain grid upgraded to 181x181 for smooth non-jagged large fields');
  const town = await import(src('town.js'));
  assert.equal(typeof town.buildSheep, 'function', 'Pettable fluffy sheep builder exported from town.js');
  assert.equal(i18n.t('zh-TW', 'skMount'), '坐騎', 'Bottom bar mount label stays crisp 2-char');
  assert.equal(i18n.t('en', 'skMount'), 'Mount', 'English mount short label defined');
  const shrineMock = {
    meta: { p: { coins: 0, shards: 0 }, save() {} },
    audio: { sfx() {} },
    fx: { burst() {} },
    ui: { toast() {} },
    shrineBuffs: { fury: 0, frost: 0, gold: 0, sheep: 0 },
  };
  assert.equal(frontier.useFieldSpot(shrineMock, { kind: 'shrine_fury', x: 0, z: 0, mesh: { visible: true } }), true);
  assert.equal(shrineMock.shrineBuffs.fury, 25, 'Fury shrine activates 25s combat buff');

  console.log('ALL 13 LOGIC, ART, SHRINES, SHEEP, MOUNTS, TIERS, COLLISION-SYNTHESIS, CODEX, FLUID-VIAL, MULTI-SHAPE BAG, I18N, PIER & GUILD SERVER CHECKS PASSED');
})();
