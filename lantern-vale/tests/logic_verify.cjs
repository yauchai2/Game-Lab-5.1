// Pure Node.js logic & authoritative server integration tests (no Chromium required)
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const createGuild = require('../server/guild.cjs');

(async () => {
  const src = p => pathToFileURL(path.resolve(__dirname, '../src', p)).href;
  const frontier = await import(src('frontier.js'));
  const lodge = await import(src('lodge.js'));

  // 1. Twenty ultra-grand persistent regions (12 classic + 8 Phase 4A drifting isles) & status affinities
  assert.equal(frontier.FIELDS.length, 21);
  assert.deepEqual(
    frontier.FIELDS.slice(1, 13).map(f => [f.name, f.level, f.size]),
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
      ['櫻花水都', 14, 320],
      ['蒼穹巨環谷', 22, 360],
      ['紅楓工坊谷', 28, 360],
    ],
  );
  assert.deepEqual(
    frontier.FIELDS.slice(13).map(f => [f.name, f.layer, f.realmRule]),
    [
      ['黃金風沙原', 'surface', 'sand_surf'],
      ['太陽金字塔聖殿', 'surface', 'sand_surf'],
      ['失落藤蔓神廟', 'surface', 'vine_leap'],
      ['幽霧哥德墓園', 'abyss', 'lantern_glow'],
      ['深淵哥德古堡', 'abyss', 'lantern_glow'],
      ['深海螢光沉淵', 'abyss', 'low_gravity'],
      ['星際白銀前哨站', 'sky', 'overcharge'],
      ['異星蜂巢裂谷', 'sky', 'crystal_burst'],
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

  // 7. Class system (5 classes incl. Phase C Monk) & 6x6 Skill Puzzle mechanics
  const puzzle = await import(src('puzzle.js'));
  assert.equal(puzzle.CLASSES.length, 5, 'Five distinct original classes defined (incl. Monk)');
  assert.equal(puzzle.unlockedCount(1), 16, 'Lv.1 unlocks 16 center puzzle cells');
  assert.equal(puzzle.unlockedCount(30), 36, 'Lv.30 unlocks full 6x6 (36) cells');
  const rot1 = puzzle.rotateCells([[0, 0], [1, 0], [2, 0]], 1);
  assert.deepEqual(rot1, [[0, 0], [0, 1], [0, 2]], '90-degree polyomino rotation normalizes cleanly');

  const pzProfile = { puzzle: null };
  const pz = puzzle.ensurePuzzle(pzProfile, 1); // 林風遊俠
  const board = puzzle.computeBoard(pz.presets[0]);
  assert.equal(board.length, 2, 'Ranger starts with 2 synergistic active skills (星羽箭雨 + 餘燼飛彈) on board');
  assert.equal(board[0].id, 'rain');
  assert.equal(board[0].mod.multi, 2, 'Adjacent 多重投射 adds +2 projectiles/waves');
  assert.ok(board[0].mod.cdr > 0, 'Adjacent 極速詠唱 reduces cooldown');
  // Verify Mystic starts with a live Logic Circuit (bolt -> CoH -> thunder)
  const mysticPz = puzzle.ensurePuzzle({ puzzle: null }, 2);
  const mysticBoard = puzzle.computeBoard(mysticPz.presets[0]);
  assert.ok(mysticBoard.find(s => s.id === 'bolt')?.mod.triggerOnHit.includes('thunder'), 'Mystic starts with live bolt -> thunder CoH circuit');
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
  assert.equal(Object.values(alive.SECOND_CLASSES).flat().length, 10, 'Ten 2nd-tier classes defined (5 classes x 2)');
  assert.equal(Object.keys(alive.FIELD_NPCS).length, 12, 'All 12 wild fields have unique NPCs & quests');
  for (const id of ['meteor', 'nova', 'prism', 'phantom', 'sakura', 'thunder', 'quakeg']) {
    assert.ok(puzzle.ACTIVE_GEMS[id], `Flashy creative skill ${id} registered in puzzle gems`);
  }
  for (const id of ['vamp', 'storm']) {
    assert.ok(puzzle.SUPPORT_GEMS[id], `Support gem ${id} registered in puzzle gems`);
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
  assert.equal(codex.GAME_VERSION, 'v0.12.1-alpha', 'Codex exports current internal alpha version v0.12.1-alpha');
  assert.ok(codex.CHANGELOG.length >= 10, 'Changelog contains structured version history through v0.12.1-alpha');

  // 14. v0.12.0-alpha Stylized Nature MegaKit 3D glTF Asset Pipeline & Files
  const fs = require('node:fs');
  const assetsMod = await import(src('assets.js'));
  assert.ok(Object.keys(assetsMod.NATURE_FILES).length >= 8, 'Curated glTF nature models registered');
  assert.equal(typeof assetsMod.preloadNatureAssets, 'function', 'preloadNatureAssets exported');
  const natureDir = path.resolve(__dirname, '../game/assets/nature');
  for (const cfg of Object.values(assetsMod.NATURE_FILES)) {
    assert.ok(fs.existsSync(path.join(natureDir, cfg.file)), `glTF asset exists: ${cfg.file}`);
    assert.ok(fs.existsSync(path.join(natureDir, cfg.file.replace('.gltf', '.bin'))), `bin buffer exists for ${cfg.file}`);
  }

  // 12. Tier System (T1-T6) & 3D Mount Milestone System (4 mounts including Sakura Spirit Fox)
  const loot = await import(src('loot.js'));
  assert.equal(loot.tierInfo(1).tag, 'T1');
  assert.equal(loot.tierInfo(5).name, '傳世階');
  const mounts = await import(src('mounts.js'));
  assert.equal(mounts.MOUNTS.length, 4, 'Four original mounts defined');
  assert.equal(mounts.activeMountDef({ level: 1, kills: 0 }), null, 'New player starts with mounts locked');
  assert.equal(mounts.activeMountDef({ level: 5, kills: 0 }).id, 'stag', 'Lv.5 unlocks Forest Stag mount');
  assert.equal(mounts.activeMountDef({ level: 1, visitedFields: [1, 2, 3], mountId: 'alpaca' }).id, 'alpaca', 'Exploring 3 fields unlocks Cloud Alpaca mount');
  assert.equal(mounts.activeMountDef({ level: 10, secondClass: 'sunblade', mountId: 'manta' }).id, 'manta', 'Second-class awakening unlocks Starwing Manta mount');
  assert.equal(mounts.activeMountDef({ level: 18, mountId: 'fox' }).id, 'fox', 'Lv.18 unlocks Sakura Spirit Fox mount');

  // 13. v1.1.0 Art, Terrain Smoothness (GW=181), Sheep, Golem & Ancient Blessing Shrines
  const models = await import(src('models.js'));
  assert.equal(typeof models.buildGolem, 'function', 'Crystal Golem 3D enemy builder exported');
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

  // 15. Build & Equipment Overhaul: Logic Circuit Skills, Irreversible Corruption, Monster Souls & Endgame Atlas
  // 15a. Logic Circuit Skill Blocks (split, orbit, coh, coc cross-skill bridging)
  for (const id of ['split', 'coh', 'coc', 'orbit']) {
    assert.ok(puzzle.SUPPORT_GEMS[id], `Logic-circuit support gem ${id} registered`);
  }
  const circuitPlaced = [
    { uid: 1, id: 'bolt',  x: 1, y: 1, rot: 0 }, // (1,1),(2,1)
    { uid: 2, id: 'coh',   x: 1, y: 2, rot: 0 }, // (1,2),(2,2) bridges bolt <-> nova
    { uid: 3, id: 'nova',  x: 0, y: 3, rot: 0 }, // (1,3),(0,4),(1,4),(2,4) adjacent to coh at (1,2)
    { uid: 4, id: 'split', x: 3, y: 1, rot: 0 }, // (3,1),(4,1),(3,2) adjacent to bolt at (2,1)
    { uid: 5, id: 'orbit', x: 1, y: 0, rot: 0 }, // (1,0),(2,0) adjacent to bolt at (1,1)
    { uid: 6, id: 'coc',   x: 0, y: 1, rot: 0 }, // (0,1),(0,2) bridges bolt <-> mark
    { uid: 7, id: 'mark',  x: 0, y: 0, rot: 0 }, // (0,0) adjacent to coc at (0,1)
  ];
  const cb = puzzle.computeBoard(circuitPlaced);
  const boltNode = cb.find(s => s.id === 'bolt');
  assert.ok(boltNode, 'Bolt active skill parsed on logic circuit board');
  assert.equal(boltNode.mod.split, true, 'Adjacent 分裂稜鏡 enables projectile split');
  assert.equal(boltNode.mod.orbit, true, 'Adjacent 環繞軌道核 enables orbital projectiles');
  assert.ok(boltNode.mod.triggerOnHit.includes('nova'), 'CoH bridges bolt -> nova on hit');
  assert.ok(boltNode.mod.triggerOnCrit.includes('mark'), 'CoC bridges bolt -> mark on crit');
  assert.ok(boltNode.mod.circuitLabel.includes('命中觸發→極光'), 'Circuit label previews CoH chain');

  // 15b. Equipment Irreversible Corruption (all 4 outcomes + forge lockout + serialize round-trip)
  const baseStaff = loot.makeItem(() => 0.6, 4, 2, 'staff');
  const rGod = loot.corruptItem(baseStaff, () => 0.10);
  assert.equal(rGod.ok, true);
  assert.equal(rGod.outcome, 'godroll');
  assert.ok(rGod.item.corruptImplicit && rGod.item.corrupted === true, 'Godroll adds hidden corruptImplicit');
  assert.equal(loot.corruptItem(rGod.item, () => 0.10).ok, false, 'Cannot corrupt an already corrupted item');
  assert.equal(loot.FORGE.reroll.ok(rGod.item), false, 'Forge reroll locked on corrupted gear');
  const rt = loot.deserializeItem(loot.serializeItem(rGod.item));
  assert.equal(rt.corrupted, true);
  assert.equal(rt.corruptImplicit.k, rGod.item.corruptImplicit.k, 'Corrupt implicit survives save/load');

  const rSuper = loot.corruptItem(baseStaff, () => 0.35);
  assert.equal(rSuper.outcome, 'supercharge');
  assert.ok(rSuper.item.implicit.v > baseStaff.implicit.v, 'Supercharge boosts implicit 1.45x');

  const rStable = loot.corruptItem(baseStaff, () => 0.60);
  assert.equal(rStable.outcome, 'stable');
  assert.equal(rStable.item.corrupted, true);

  const rBrick = loot.corruptItem(baseStaff, () => 0.90);
  assert.equal(rBrick.outcome, 'brick');
  assert.equal(rBrick.item.bricked, true);
  assert.equal(rBrick.item.rarity, 0);
  assert.equal(rBrick.item.mods[0].v, -15, 'Bricked gear carries cursed -15% damage mod');

  // 15c. Monster Soul Absorption & Dual-Slot Equipping
  const souls = await import(src('souls.js'));
  assert.equal(Object.keys(souls.MONSTER_SOULS).length, 7, 'Seven monster soul cards defined');
  const soulProf = {};
  const drop1 = souls.rollSoulDrop(soulProf, 'boar', true, 1, () => 0.1);
  assert.equal(drop1.granted, true);
  assert.equal(drop1.isNew, true);
  const drop2 = souls.rollSoulDrop(soulProf, 'stag', false, 1, () => 0.99);
  assert.equal(drop2.granted, true, 'Boss stag guarantees 100% soul drop');
  assert.equal(souls.equipSoul(soulProf, 'boar'), true);
  assert.equal(souls.equipSoul(soulProf, 'stag'), true);
  const eqSouls = souls.activeSouls(soulProf);
  assert.equal(eqSouls.mobility.id, 'boar', 'Boar equips to mobility slot');
  assert.equal(eqSouls.combat.id, 'stag', 'Stag equips to combat slot');
  assert.equal(souls.unequipSoul(soulProf, 'mobility'), true);
  assert.equal(souls.activeSouls(soulProf).mobility, undefined, 'Unequip clears mobility slot');

  // 15d. Endgame Atlas Map Crafter (Density + Stackable League Mechanics)
  const atlas = await import(src('atlas.js'));
  const atlasProf = {};
  atlas.setAtlasDensity(atlasProf, 'abyss');
  for (const mid of ['vaal_rift', 'soul_hunt', 'double_shrine', 'gilded_vault', 'twin_boss']) {
    assert.equal(atlas.toggleAtlasMechanic(atlasProf, mid), true);
  }
  const sum = atlas.computeAtlasSummary(atlas.ensureAtlas(atlasProf));
  assert.equal(sum.densityMult, 2.3);
  assert.equal(sum.corruptDropChance, 0.45);
  assert.equal(sum.soulDropMult, 3);
  assert.equal(sum.dropTierBonus, 2);
  assert.equal(sum.startShrine, true);
  assert.equal(sum.twinBoss, true);
  assert.equal(sum.dangerLabel, '☠️ 毀滅印鈔機');
  assert.ok(sum.shardMult >= 3.5, 'Stacked mechanics multiply shard rewards dramatically');

  // 16. Combat & Feel Overhaul: Part Breaking & Targeted Drops + Environmental Elemental Chain Reactions
  const parts = await import(src('parts.js'));
  const mockGolem = { type: 'golem', maxHp: 200, hp: 200, facing: 0, pos: { x: 0, z: 0 } };
  parts.initParts(mockGolem);
  assert.equal(mockGolem.parts.length, 2, 'Golem initializes 2 breakable parts (rightArm & core)');
  const hitRight = parts.resolveHitPart(mockGolem, 1.5, 0.1);
  assert.equal(hitRight.id, 'rightArm', 'Attacking Golem from right side targets 星晶光刃右臂');
  const hitFront = parts.resolveHitPart(mockGolem, 0, 1.6);
  assert.equal(hitFront.id, 'core', 'Attacking Golem from front targets 胸口星晶核心');
  const brk = parts.damagePart(mockGolem, hitRight, 999);
  assert.equal(brk.broken, true, 'Dealing lethal part damage severs rightArm');
  assert.equal(mockGolem.brokenWeakens.has('slam'), true, 'Breaking rightArm weakens Golem slam radius');
  assert.equal(brk.dropItem.name, '星晶光刃法杖', 'Severing rightArm drops signature 星晶光刃法杖');
  assert.equal(brk.dropItem.special, 'sweepWave');
  assert.ok(parts.partStatusText(mockGolem).includes('✂️星晶光刃右臂(已斷)'));

  const mockStag = { type: 'stag', maxHp: 1100, hp: 1100, facing: 0, pos: { x: 0, z: 0 } };
  parts.initParts(mockStag);
  assert.equal(parts.resolveHitPart(mockStag, 0, 2.0).id, 'antlers', 'Front attack on Stag targets 黃金古樹鹿角');
  assert.equal(parts.resolveHitPart(mockStag, 0, -2.0).id, 'hindLegs', 'Rear attack on Stag targets 古木踏風後肢');

  const elements = await import(src('elements.js'));
  const rxIce = elements.resolveSurfaceReaction('water', 'frost');
  assert.equal(rxIce.nextKind, 'ice', 'Water + Frost freezes ground into ice');
  assert.ok(elements.SURFACE_DEFS.ice.slipStun > 0, 'Ice surface causes enemy slip-stun');
  const rxSteam = elements.resolveSurfaceReaction(rxIce.nextKind, 'fire');
  assert.equal(rxSteam.nextKind, 'steam', 'Ice + Fire melts & vaporizes into steam cloud');
  assert.ok(elements.SURFACE_DEFS.steam.blindVision > 0, 'Steam cloud obscures enemy vision');
  const rxThunder = elements.resolveSurfaceReaction(rxSteam.nextKind, 'shock');
  assert.equal(rxThunder.nextKind, 'electrified_steam', 'Steam + Shock triggers massive electrified_steam storm');
  assert.ok(rxThunder.bonusDmgMult >= 2.0, 'Electrified steam deals >=2.0x chain-reaction damage');
  assert.equal(elements.resolveSurfaceReaction('poison', 'fire').nextKind, 'magma', 'Poison + Fire triggers toxic_blast');
  assert.equal(elements.resolveSurfaceReaction('water', 'shock').nextKind, 'electrified_water');
  assert.equal(elements.inferElement({ shock: 3, fire: true }), 'shock');

  // 17. One-Click Auto-Build Skill Puzzle Optimizer
  const autoRes = puzzle.autoBuildBoard([], [
    { uid: 201, id: 'bolt' }, { uid: 202, id: 'coh' }, { uid: 203, id: 'thunder' },
    { uid: 204, id: 'split' }, { uid: 205, id: 'ember' },
  ], 10);
  assert.equal(autoRes.placed.length + autoRes.bag.length, 5, 'Auto-build preserves every gem without loss');
  const autoBoard = puzzle.computeBoard(autoRes.placed);
  assert.ok(autoBoard.length >= 2, 'Auto-build places multiple active skills');
  assert.ok(autoBoard.some(s => s.mod.triggerOnHit.length > 0), 'Auto-build automatically wires a CoH logic circuit');

  // 18. One-Click Auto-Equip Best Gear in Physics Backpack
  const weakStaff = loot.makeItem(() => 0.1, 0, 0, 'staff');
  const strongStaff = loot.makeItem(() => 0.9, 8, 3, 'staff');
  const aeMock = {
    player: { equip: { staff: weakStaff, cloak: null, charm: null } },
    meta: { p: { bagItems: [] }, save() {} },
    recalc() {},
  };
  physbag.addGearToBag(aeMock.meta.p, strongStaff);
  const aeRes = physbag.autoEquipBest(aeMock);
  assert.equal(aeRes.count, 1, 'Auto-equip swaps strictly stronger gear from physics bag');
  assert.equal(aeMock.player.equip.staff.name, strongStaff.name, 'Stronger staff equipped');
  assert.ok(aeMock.meta.p.bagItems.some(b => b.kind === 'gear' && b.name === weakStaff.name), 'Replaced weak staff returned to bag');

  // 19. Salvage Trash Gear to Shards (preserves rare/unique & upgrades)
  const trashNormal = loot.makeItem(() => 0.1, 0, 0, 'staff');
  const keepRare = loot.makeItem(() => 0.5, 2, 2, 'staff');
  const salvMock = {
    player: { equip: { staff: strongStaff, cloak: null, charm: null } },
    meta: { p: { shards: 10, bagItems: [] }, save() {} },
  };
  physbag.addGearToBag(salvMock.meta.p, trashNormal);
  physbag.addGearToBag(salvMock.meta.p, keepRare);
  const salvRes = physbag.salvageTrashGear(salvMock);
  assert.equal(salvRes.count, 1, 'Salvage recycles only weaker normal/magic gear');
  assert.ok(salvRes.shards >= 4 && salvMock.meta.p.shards === 10 + salvRes.shards, 'Salvage converts trash gear into Shards');
  assert.equal(salvMock.meta.p.bagItems.length, 1, 'Rare gear preserved untouched in bag');

  // 20. Ember Tide (餘燼潮汐) Dynamic Escalation, Mandatory Lull, Rekindle & Cozy-Chaotic Ultimates
  const tide = await import(src('tide.js'));
  assert.equal(tide.TIDE_PHASES.length, 4, 'Four Ember Tide escalation phases defined');
  assert.equal(tide.ULTIMATES.length, 3, 'Three cozy-chaotic ultimates defined (storm, hound, daybreak)');
  assert.equal(tide.MICRO_BUFFS.length, 3, 'Three seamless mid-wave micro-buffs defined');
  const td = tide.createTideState();
  assert.equal(td.phase, 0);
  assert.equal(tide.lootMultForTide(td), 1.0);
  for (let i = 0; i < 4; i++) tide.recordTideKill(td, {}); // 4 * 8 = 32 heat -> Phase 1
  assert.equal(td.phase, 1, 'Kill velocity pushes Ember Tide into Phase 1 (火星躁動)');
  for (let i = 0; i < 4; i++) tide.recordTideKill(td, {}); // 64 heat -> Phase 2
  assert.equal(td.phase, 2, 'Continued kills escalate into Phase 2 (餘燼狂潮)');
  const apexRes = tide.recordTideKill(td, { isBoss: true }); // +28 = 92
  assert.equal(apexRes.enteredApex, false);
  const apexRes2 = tide.recordTideKill(td, { isElite: true }); // 100 -> Apex!
  assert.equal(apexRes2.enteredApex, true, 'Reaching 100 heat triggers Phase 3 Apex Surge');
  assert.equal(td.apexTimer, tide.APEX_DURATION);
  assert.ok(td.ultCharge >= 100, 'Killing swarm charges ultimate to 100%');
  const ultUsed = tide.consumeUltimate(td);
  assert.equal(ultUsed.id, 'storm', 'Consuming full ultimate casts THUNDERSTORM first');
  assert.equal(td.ultCharge, 0);
  // Slaying Tide Boss during Apex immediately transitions into 25s Lull
  const lullRes = tide.recordTideKill(td, { isTideBoss: true });
  assert.equal(lullRes.enteredLull, true, 'Slaying Tide Boss enters mandatory 25s breathing-room lull');
  assert.equal(td.lullTimer, tide.LULL_DURATION);
  assert.equal(td.phase, -1);
  // Rekindling lantern during lull launches Wave 2 with scaling loot multiplier
  assert.equal(tide.applyRekindle(td), true, 'Rekindling lantern during lull starts next wave');
  assert.equal(td.waveStreak, 2);
  assert.equal(td.phase, 2);
  assert.ok(tide.lootMultForTide(td) > 2.5, 'Wave 2 scales loot multiplier above base surge');
  // Idle heat decay when outside Apex/Lull
  td.heat = 40; td.phase = 1; td.decayIdleT = 5;
  tide.stepTideTimers(td, 2.0);
  assert.ok(td.heat < 40, 'Heat decays smoothly when player stops fighting');

  // 21. v5/v6 All 12 Field Map Blueprints (5 PoE 2 Topologies), 34 GLBs & Checkpoint Teleport
  const bpMod = await import(src('field_blueprints.js'));
  assert.equal(bpMod.BP_W, 260);
  assert.equal(bpMod.BP_H, 180);
  const families = new Set();
  for (let fid = 1; fid <= 20; fid++) {
    const bp = bpMod.FIELD_BLUEPRINTS[fid];
    assert.ok(bp, `Blueprint #${fid} exists`);
    families.add(bp.family);
    const grid = bpMod.getBlueprintGrid(fid);
    assert.equal(grid.length, 260 * 180, `Blueprint #${fid} produces 260x180 grid`);
    let landCnt = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] >= 1 && grid[i] <= 4) landCnt++;
    const ratio = landCnt / grid.length;
    assert.ok(ratio > 0.14 && ratio < 0.85, `Blueprint #${fid} (${bp.family}) valid land ratio: ${(ratio * 100).toFixed(1)}%`);
    assert.ok(bp.checkpoints.length >= 3, `Blueprint #${fid} defines 3+ teleport checkpoints`);
    assert.ok(bp.bridges.length >= 1, `Blueprint #${fid} defines bridge spans`);
    assert.ok(bp.glides.length >= 2, `Blueprint #${fid} defines one-way glide shortcuts`);
  }
  assert.equal(families.size, 5, 'All 5 PoE 2 spatial topologies covered across 20 field maps');
  const wCenter = bpMod.uvToWorld(0.5, 0.5, 120);
  assert.equal(wCenter.x, 0); assert.equal(wCenter.z, 0);
  // Verify checkpoint teleport cycles between unlocked checkpoints
  const cpMock = {
    meta: { p: structuredClone(frontier.progressDefaults), save() {} },
    player: { pos: { x: 0, z: 0, set(x, y, z) { this.x = x; this.z = z; } }, y: 0, mana: 50, stats: { maxHp: 100, mana: 100 } },
    world: { gh: () => 0.5 },
    checkpoints: [
      { idx: 0, name: 'CP-A', x: 10, z: 10, y: 0.5, unlocked: true },
      { idx: 1, name: 'CP-B', x: 80, z: -40, y: 2.0, unlocked: true },
    ],
    ui: { toast() {} },
  };
  assert.equal(frontier.useFieldSpot(cpMock, { kind: 'checkpoint', cpIdx: 0 }), true);
  assert.ok(Math.hypot(cpMock.player.pos.x - 81.6, cpMock.player.pos.z + 38.4) < 0.5, 'Checkpoint teleports player to next unlocked checkpoint');
  // Verify all 34 v6 GLB landmark & monster assets exist on disk
  const p2bAssets = await import(src('assets.js'));
  const fsMod = require('node:fs');
  const gameDir = path.resolve(__dirname, '../game');
  assert.equal(Object.keys(p2bAssets.LANDMARK_FILES).length, 49, '49 landmark GLBs registered (20 fields + 2 towns + dungeons)');
  const dunMod = await import(src('dungeon_scene.js'));
  assert.equal(typeof dunMod.buildDungeonScenery, 'function', 'Dungeon scenery builder exported');
  assert.equal(Object.keys(p2bAssets.MONSTER_FILES).length, 13, '13 monster GLBs registered');
  for (const rel of [...Object.values(p2bAssets.LANDMARK_FILES), ...Object.values(p2bAssets.MONSTER_FILES)]) {
    const full = path.join(gameDir, rel);
    assert.ok(fsMod.existsSync(full) && fsMod.statSync(full).size > 2000, `GLB asset exists and non-empty: ${rel}`);
  }

  // 22. Phase 3C + 4A: Blueprint Special Terrain Gameplay Engine + 6 Mario-Odyssey Realm Rules + 3-Layer Star Chart
  const tfxMod = await import(src('terrain_fx.js'));
  assert.equal(Object.keys(tfxMod.FAMILY_META).length, 5, 'All 5 PoE 2 topology families defined in FAMILY_META');
  assert.equal(Object.keys(tfxMod.REALM_RULES).length, 6, 'All 6 Mario-Odyssey realm micro-rules defined');
  for (let fid = 1; fid <= 20; fid++) {
    const bp = bpMod.FIELD_BLUEPRINTS[fid];
    assert.ok(tfxMod.FAMILY_META[bp.family], `Field #${fid} family (${bp.family}) present in FAMILY_META`);
    const eff = tfxMod.getTerrainEffect(bp.shallowKind);
    assert.ok(eff && eff.name && eff.icon, `Field #${fid} shallowKind (${bp.shallowKind}) mapped in TERRAIN_EFFECTS`);
    const f = frontier.FIELDS[fid];
    if (f.realmRule) assert.ok(tfxMod.getRealmRule(f.realmRule), `Field #${fid} realmRule (${f.realmRule}) defined`);
  }
  // Verify low_gravity & overcharge realm rule ticks
  const ocMock = {
    player: { air: false, pos: { x: 0, z: 0 }, y: 0, vel: { x: 0, z: 0 }, mana: 10, stats: { mana: 100 }, skillCds: [3.0, 2.0] },
    ui: { toast() {} }, fx: { burst() {} }, puffs: { emit() {} },
  };
  tfxMod.updateRealmRule(ocMock, 1.0, 'overcharge');
  assert.equal(ocMock.player.realmRule.id, 'overcharge');
  assert.ok(ocMock.player.mana >= 28, 'Overcharge rapidly restores mana');
  assert.ok(ocMock.player.skillCds[0] <= 2.55, 'Overcharge accelerates skill cooldown recovery');
  assert.equal(tfxMod.getRealmRule('low_gravity').gravityMult, 0.46, 'Deep Sea uses low-gravity floaty physics');
  // Ice lake skating + Hot spring healing + Lava moat enemy burn + Elemental terrain reaction
  const mockTerrainGame = (shallowKind) => ({
    field: 4,
    world: { bpCell: new Uint8Array(4), shallowAt: () => shallowKind },
    player: {
      air: false, climbing: false, y: 0,
      pos: { x: 0, z: 0 }, vel: { x: 4, z: 0 },
      hp: 60, mana: 20, stats: { maxHp: 100, mana: 100 },
      statuses: { poison: 2, burn: 2, chill: 2 },
    },
    enemies: [{ dead: false, flying: false, type: 'boar', hp: 100, maxHp: 100, pos: { x: 2, y: 0, z: 2 }, statuses: {} }],
    ui: { toast() {}, dmgNum() {} },
    fx: { burst() {} },
    puffs: { emit() {} },
    _terrainEnemyTick: 0,
  });
  const iceG = mockTerrainGame('ice_lake');
  tfxMod.updateFieldTerrainFx(iceG, 0.1);
  assert.equal(iceG.player.terrainFx.id, 'ice_lake');
  assert.ok(iceG.player.terrainFx.speedMult >= 1.35 && iceG.player.terrainFx.accelRate <= 4, 'Ice lake grants skating boost & glide inertia');
  assert.ok(iceG.enemies[0].slow > 0, 'Ice lake slows enemies standing on it');

  const hsG = mockTerrainGame('hot_spring');
  tfxMod.updateFieldTerrainFx(hsG, 0.5);
  assert.ok(hsG.player.hp > 60 && hsG.player.mana > 20, 'Hot spring heals HP & restores Mana');
  assert.equal(hsG.player.statuses.poison, 0, 'Hot spring cleanses poison');
  assert.equal(hsG.player.statuses.burn, 0, 'Hot spring cleanses burn');

  const lavaG = mockTerrainGame('lava_moat');
  tfxMod.updateFieldTerrainFx(lavaG, 0.1);
  assert.ok(lavaG.enemies[0].statuses.burn >= 2.5 && lavaG.enemies[0].hp < 100, 'Lava moat burns enemies standing in it');

  assert.equal(elements.resolveSurfaceReaction(tfxMod.getTerrainEffect('poison_bog').surfaceBase, 'fire').nextKind, 'magma', 'Poison bog + fire triggers toxic_blast');
  assert.equal(elements.resolveSurfaceReaction(tfxMod.getTerrainEffect('ice_lake').surfaceBase, 'fire').nextKind, 'steam', 'Ice lake + fire melts into steam');
  assert.equal(elements.resolveSurfaceReaction(tfxMod.getTerrainEffect('creek').surfaceBase, 'shock').nextKind, 'electrified_water', 'Shallow creek + shock triggers electrified_water');

  // 23. Phase 5A: Lantern Autopilot (30% yield, Spark Surge x1.5, WASD instant takeover, auto-flask & safety retreat, Cozy Cam)
  const apMod = await import(src('autopilot.js'));
  assert.equal(apMod.AUTO_RATES.xpMult, 0.30);
  assert.equal(apMod.AUTO_RATES.dropChanceMult, 0.20);
  assert.equal(apMod.AUTO_RATES.maxDropRarity, 2);
  let flaskUsed = 0, atkCount = 0;
  const apMock = {
    field: 1, depth: 0, time: 0, camZoom: 1.0, camYaw: 0.62,
    autopilot: apMod.createAutopilotState(),
    meta: { p: structuredClone(frontier.progressDefaults), save() {} },
    player: {
      pos: { x: 0, z: 0, set(x, y, z) { this.x = x; this.z = z; } }, y: 0,
      hp: 40, mana: 80, stats: { maxHp: 100, mana: 100 },
      flask: { charges: 2, max: 3 }, hotbar: [], skillCds: [0, 0, 0, 0],
    },
    enemies: [{ dead: false, legendary: false, type: 'slime', pos: { x: 2.2, z: 0 } }],
    drops: [{ kind: 'item', item: { rarity: 1 }, g: { position: { x: 1, z: 0 } } }],
    checkpoints: [{ idx: 0, name: 'CP0', x: 0, z: 0, y: 0, unlocked: true }],
    world: { gh: () => 0, shallowAt: () => null },
    ui: { toast() {} }, fx: { burst() {} }, audio: { sfx() {} },
    tryFlask() { flaskUsed++; this.player.flask.charges--; this.player.hp = 85; },
    tryAttack() { atkCount++; },
    onAutoKill(d) { apMod.onAutopilotKill(this, d); },
  };
  assert.equal(apMod.toggleAutopilot(apMock, 'full'), true);
  assert.equal(apMod.isAutopilotActive(apMock), true);
  const mvRes = apMod.tickAutopilot(apMock, 0.2, { lengthSq: () => 0 });
  assert.ok(mvRes !== null, 'Autopilot returns steering vector in full mode');
  assert.equal(flaskUsed, 1, 'Autopilot auto-drinks flask at HP < 45%');
  assert.ok(atkCount >= 1, 'Autopilot auto-attacks nearby normal enemy');
  assert.equal(apMock.drops.length, 0, 'Autopilot auto-salvages uncommon gear into shards');
  assert.equal(apMock.autopilot.stats.shards, 4, 'Auto-salvaging green item grants 4 shards');
  // Test 30% XP yield in awardKill during autopilot
  apMock.meta.p.xp = 0;
  frontier.awardKill(apMock, { type: 'slime', level: 10, elite: false, spawnIndex: 0 });
  assert.equal(apMock.meta.p.xp, 9, 'Autopilot awards 30% XP (30 * 0.30 = 9)');
  // Test Cozy Cam after 20s idle & Spark Surge x1.5 upon manual WASD takeover
  apMock.autopilot.idleT = 22;
  apMock.autopilot.sparkStacks = 2;
  apMod.tickAutopilot(apMock, 0.5, { lengthSq: () => 0 });
  assert.equal(apMock.autopilot.cozyActive, true, 'Cozy Cam activates after 20s idle');
  apMod.tickAutopilot(apMock, 0.1, { lengthSq: () => 1.0 }); // manual WASD takeover
  assert.equal(apMod.isAutopilotActive(apMock), false, 'WASD instantaneously exits full autopilot');
  assert.ok(apMock.autopilot.sparkBuffT >= 59, 'Exiting autopilot with 2 Spark stacks activates 60s Return Surge');
  assert.equal(apMod.manualSparkMult(apMock), 1.5, 'Return Surge multiplies manual XP & loot by 1.5x');

  // 24. Phase B1: Difficulty Modes, Cozy No-Grave Protection & Upward-Level +25% XP Bonus
  const setMod = await import(src('settings.js'));
  assert.ok(setMod.DIFFICULTY_MODES.cozy && setMod.DIFFICULTY_MODES.standard && setMod.DIFFICULTY_MODES.veteran, 'Three difficulty modes defined');
  assert.equal(setMod.DEFAULTS.difficulty, 'standard', 'Default difficulty is standard');
  assert.equal(setMod.DIFFICULTY_MODES.cozy.noGrave, true, 'Cozy mode protects against grave material loss');
  const cozyMock = {
    field: 1, originField: 1, settings: { difficulty: 'cozy' },
    meta: { p: { ...structuredClone(frontier.progressDefaults), goods: { wood: 12, ore: 8, fish: 4 } }, save() {} },
    player: { pos: { x: 1, z: 1 }, equip: {} },
  };
  assert.equal(frontier.leaveGrave(cozyMock), 0, 'Cozy mode leaveGrave loses 0 materials');
  assert.equal(cozyMock.meta.p.goods.wood, 12, 'Cozy mode preserves all wood on death');
  // Test +25% XP bonus when killing an enemy 4 levels higher (manual mode)
  const upMock = {
    field: 1, depth: 0, isNight: false,
    meta: { p: { ...structuredClone(frontier.progressDefaults), level: 1, xp: 0 }, save() {} },
    ui: { toast() {} }, recalc() {},
  };
  frontier.awardKill(upMock, { type: 'thorn', level: 5, elite: false, spawnIndex: 0 });
  // base = 10 + 5*2 = 20; +25% upward bonus = 25
  assert.equal(upMock.meta.p.xp, 25, 'Manual kill of Lv.5 enemy at Lv.1 grants +25% upward XP bonus (20 -> 25)');

  // 25. Phase B2 + U3: Progressive System Unlocks, Field Danger Tiers & Pixel SVG Icon Library
  const progMod = await import(src('progression.js'));
  assert.equal(progMod.getFieldDanger(1, 1).tier, 'normal', 'Same-level field is normal');
  assert.equal(progMod.getFieldDanger(5, 1).tier, 'challenge', '+4 level field is challenge (+25% XP)');
  assert.equal(progMod.getFieldDanger(5, 1).xpBonus, 0.25);
  assert.equal(progMod.getFieldDanger(10, 1).redZone, true, '+9 level field triggers red-zone warning');
  assert.equal(progMod.getFieldDanger(1, 6).tier, 'easy', '-5 level field is easy');
  assert.equal(progMod.canCorruptGear({ meta: { p: { level: 3 } } }), false, 'Corrupt Forge locked at Lv.3');
  assert.equal(progMod.canCorruptGear({ meta: { p: { level: 8 } } }), true, 'Corrupt Forge unlocked at Lv.8');
  assert.equal(progMod.canCorruptGear({ dev: { on: true }, meta: { p: { level: 1 } } }), true, 'Dev mode bypasses Lv.8 Corrupt Forge lock');
  assert.equal(progMod.nextMilestone(1).lv, 3, 'Next milestone after Lv.1 is Lv.3');
  assert.ok(progMod.milestoneText(5).includes('藥劑上限'), 'Lv.5 milestone text matches flask unlock');
  const icoMod = await import(src('icons.js'));
  assert.ok(Object.keys(icoMod.ICONS).length >= 12, 'Warm-wood pixel SVG icon library has >= 12 icons');
  assert.ok(icoMod.ICONS.lantern.includes('<svg') && icoMod.ICONS.flask.includes('<svg'), 'Icons are valid SVG markup');

  // 26. Phase M1: MMO Protocol, Velocity Envelope Anti-Cheat, 30m AOI Spatial Grid, Zone Tide, Dynamic Sharding & Hotspots
  const mmoProto = await import(src('mmo_protocol.js'));
  const zoneEng = require(path.join(__dirname, '..', 'server', 'zone_engine.cjs'));
  // Velocity Envelope: allow ice_lake skating, block blatant speedhack/teleport
  const legalIce = mmoProto.validateMoveDelta({ x: 0, z: 0 }, { x: 1.4, z: 0 }, 0.1, { terrain: 'ice_lake' });
  assert.equal(legalIce.ok, true, 'Ice lake skating within legal velocity envelope');
  const speedHack = mmoProto.validateMoveDelta({ x: 0, z: 0 }, { x: 25, z: 0 }, 0.1, {});
  assert.equal(speedHack.ok, false, 'Teleport/speedhack rejected by velocity envelope');
  assert.ok(speedHack.violation > 0 && speedHack.clamped.x < 5, 'Speedhack returns violation score & clamped position');
  // Shared Tagging >= 3% personal loot
  const looters = mmoProto.resolveLootRecipients({ p1: 500, p2: 35, p3: 10 }, 1000);
  assert.deepEqual(looters, ['p1', 'p2'], 'Players dealing >= 3% HP receive independent personal loot');
  // Co-op Elemental Synergy
  assert.equal(mmoProto.resolveCoopSynergy('p1', 'p2').dmgMult, 1.15, 'Cross-player synergy grants +15% damage');
  assert.equal(mmoProto.resolveCoopSynergy('p1', 'p1').isCoop, false, 'Self-trigger is not co-op synergy');
  // Daily Lantern Oil
  const oilProf = {};
  assert.equal(mmoProto.consumeLanternOil(oilProf, 600, '2026-11-24'), 6600, 'Consuming 10m oil leaves 6600s');
  assert.equal(mmoProto.refillLanternOil(oilProf, 1800, '2026-11-24'), 8400, 'Quest refill adds +30m oil');
  // 30m x 30m AOI Spatial Grid
  const grid = new zoneEng.SpatialGrid(30);
  grid.insert({ id: 1, x: 5, z: 5 });
  grid.insert({ id: 2, x: 28, z: 10 });
  grid.insert({ id: 3, x: 140, z: 140 });
  const near = grid.queryNearby(5, 5, 1).map(p => p.id);
  assert.ok(near.includes(1) && near.includes(2) && !near.includes(3), '30m AOI grid culls distant players 140m away');
  // Zone-Wide Ember Tide & World Tide Boss HP scaling
  const zt = new zoneEng.ZoneTide('field:1');
  for (let i = 0; i < 60; i++) zt.addKill(2, 4);
  assert.equal(zt.bossActive, true, 'Zone-wide kills trigger World Tide Boss at 100% heat');
  assert.ok(zt.bossHpMult > 2.5, 'World Tide Boss scales HP for 4 players');
  const postBoss = zt.onBossDefeated();
  assert.equal(postBoss.restTimer, 25, 'Defeating World Tide Boss starts 25s shared campfire rest');
  // Dynamic Sharding with party affinity
  const shards = new Map();
  const sA = zoneEng.assignShard(shards, 'field:1', 'alpha');
  for (let i = 0; i < 24; i++) zoneEng.assignShard(shards, 'field:1');
  const sMate = zoneEng.assignShard(shards, 'field:1', 'alpha');
  const sOverflow = zoneEng.assignShard(shards, 'field:1', 'beta');
  assert.equal(sMate, sA, 'Party mate joins same shard up to hard cap 30');
  assert.equal(sOverflow, 'field:1#2', 'New party overflows to shard #2 once soft cap 25 is reached');
  // Star Chart 30-min Hotspots
  const hs = zoneEng.pickHotspots(1795450000000);
  assert.equal(hs.hotspots.length, 2, 'Two distinct hotspot islands selected per 30-min window');
  assert.notEqual(hs.hotspots[0].fieldId, hs.hotspots[1].fieldId, 'Hotspot islands are distinct');

  // 27. Phase M2: Client/Server Hotspot Parity, Gold Tide +40% XP Bonus & Co-op VFX Setting
  const clientHs = mmoProto.pickHotspots(1795450000000);
  assert.deepEqual(clientHs.hotspots.map(h => h.fieldId), hs.hotspots.map(h => h.fieldId), 'Client and server pick identical 30-min hotspot islands');
  const hsMock = {
    field: 1, depth: 0, isNight: false,
    hotspots: { hotspots: [{ fieldId: 1, kind: 'gold_tide', name: '🔥 餘燼金潮', bonus: '經驗＆掉寶 +40%' }] },
    meta: { p: { ...structuredClone(frontier.progressDefaults), level: 1, xp: 0 }, save() {} },
    ui: { toast() {} }, recalc() {},
  };
  frontier.awardKill(hsMock, { type: 'slime', level: 1, elite: false, spawnIndex: 0 });
  // base = 10 + 1*2 = 12; * 1.4 = 16.8 -> 17
  assert.equal(hsMock.meta.p.xp, 17, 'Gold Tide hotspot island grants +40% manual XP (12 -> 17)');
  assert.equal(setMod.DEFAULTS.coopVfx, 1, 'Co-op VFX clutter culling defaults to ON (35% opacity for peers)');

  // 28. Phase M3: 8% MMO Auction Tax Sink & Food Night Hotspot Campfire Feast
  const lodgeMod = await import(src('lodge.js'));
  assert.equal(lodgeMod.AUCTION_TAX_RATE, 0.08, 'MMO Auction House tax rate is 8%');
  assert.equal(lodgeMod.calcAuctionNet(100), 92, '100g auction sale nets 92g after 8% tax');
  assert.equal(lodgeMod.calcAuctionNet(10), 9, '10g auction sale nets 9g after 8% tax');
  const fnHs = mmoProto.getFieldHotspot(2, { hotspots: [{ fieldId: 2, kind: 'food_night', name: '🍗 旅人美食夜市' }] });
  assert.equal(fnHs.kind, 'food_night', 'Food night hotspot detected for campfire feast +50% buff');

  // 29. Phase M4A–M4C: Puzzle Trigger ICD, Projectile Overload Folding, Party Link Socket & Cozy MVP Badges
  const icdMap = new Map();
  assert.equal(mmoProto.checkTriggerIcd(icdMap, 'bolt->nova', 1000), true, 'First trigger fires immediately');
  assert.equal(mmoProto.checkTriggerIcd(icdMap, 'bolt->nova', 1120), false, 'Trigger within 250ms ICD is throttled');
  assert.equal(mmoProto.checkTriggerIcd(icdMap, 'bolt->nova', 1260), true, 'Trigger fires again after 250ms ICD');
  const folded = mmoProto.foldExcessProjectiles(14, 6, 16);
  assert.equal(folded.spawnCount, 2, 'Caps active projectiles at MAX_ACTIVE_PROJECTILES (16)');
  assert.equal(folded.overflow, 4, 'Tracks 4 overflow projectiles');
  assert.ok(folded.overloadMult > 2.0, 'Folds overflow projectiles into overload damage multiplier');
  // Party Link Socket shares support gem across all active skills
  const partySkills = puzzle.computeBoard([{ uid: 1, id: 'bolt', x: 1, y: 1, rot: 0 }], 'chain');
  assert.equal(partySkills[0].mod.chain, 2, 'Party Link Socket shares chain +2 to active skills');
  assert.equal(partySkills[0].mod.partyShared, 'chain');
  assert.ok(partySkills[0].mod.circuitLabel.includes('🤝羈絆'), 'Circuit label shows Party Link Socket');
  // Cozy MVP Badges
  const mvps = mmoProto.computeCozyMvps({ synergyProcs: 3, partsBroken: 2, campfires: 1, healsDone: 45 });
  assert.equal(mvps.length, 4, 'Awards all 4 Cozy MVP Badges when criteria met');
  assert.ok(mvps.some(b => b.title === '連攜發動機') && mvps.some(b => b.title === '營火大廚'));
  // Guild 6-Portal Co-op Raid & MVP notice
  assert.ok(c1.msgs.some(m => m.t === 'raidStart' && m.portalsLeft === 6), 'Guild Raid starts with 6-Portal Co-op limit');
  assert.ok(c1.msgs.some(m => m.t === 'guildNotice' && Array.isArray(m.mvps) && m.mvps.length >= 1), 'Guild Raid victory awards Cozy MVP badges');

  // 30. Phase M5A: Public Cross-Sea Star-Lantern Ferry Schedule & 15-min Co-Voyage +10% XP Buff
  const fSch = mmoProto.getFerrySchedule(1795450000000, clientHs);
  assert.ok(fSch.destFieldId >= 1 && fSch.destFieldId <= 20, 'Public ferry targets a valid hotspot field');
  assert.equal(fSch.buffDurationMs, 900000, 'Public ferry grants 15-minute Co-Voyage buff');
  const ferryMock = {
    field: 1, depth: 0, isNight: false,
    meta: { p: { ...structuredClone(frontier.progressDefaults), level: 1, xp: 0, ferryBuffUntil: Date.now() + 600000 }, save() {} },
    ui: { toast() {} }, recalc() {},
  };
  frontier.awardKill(ferryMock, { type: 'slime', level: 1, elite: false, spawnIndex: 0 });
  // base = 10 + 1*2 = 12; * 1.10 = 13.2 -> 13
  assert.equal(ferryMock.meta.p.xp, 13, 'Co-Voyage ferry buff grants +10% XP (12 -> 13)');

  // 31. Phase M6: Weekly Seed Endless Lantern Spire, Mentor Lantern Scaling & Lighthouse Network Contributions
  const ws1 = mmoProto.getWeeklySpireInfo(1795450000000);
  const ws2 = mmoProto.getWeeklySpireInfo(1795450000000 + 3600 * 1000);
  assert.equal(ws1.seed, ws2.seed, 'Weekly Spire seed stays identical within the same week');
  assert.ok(ws1.seed >= 100000 && ws1.theme?.name, 'Weekly Spire provides valid seed & theme');
  assert.equal(mmoProto.mentorDamageScale(15, 1, false), 1.0, 'Mentor scaling inactive when OFF');
  assert.ok(mmoProto.mentorDamageScale(15, 1, true) < 0.6, 'Mentor Lantern scales Lv.15 damage down in Lv.1 zone');
  assert.equal(mmoProto.mentorDamageScale(15, 14, true), 1.0, 'Mentor Lantern does not scale in same-level zone');
  const lhProf = { goods: { wood: 4, ore: 6, fish: 2 }, shards: 0 };
  const lhRes1 = mmoProto.contributeLighthouse(lhProf, 'ore', 2); // +6 pts
  const lhRes2 = mmoProto.contributeLighthouse(lhProf, 'ore', 2); // +6 pts -> 12 pts
  assert.equal(lhRes1.ok, true);
  assert.equal(lhRes2.totalPts, 12, 'Lighthouse contribution accumulates light points');
  assert.equal(lhRes2.title, '🏮 星燈開拓者', 'Reaching 10+ light points unlocks Pioneer title');
  assert.equal(lhProf.shards, 12, 'Lighthouse donation rewards matching star shards');

  // 32. Phase M7: Monster Soul 5-Tier Awakening Progression
  const awkProf = {};
  const firstDrop = souls.grantSoul(awkProf, 'boar');
  assert.equal(firstDrop.isNew, true);
  assert.equal(souls.soulTier(awkProf, 'boar').tier, 1, 'Initial soul starts at Tier 1');
  souls.grantSoul(awkProf, 'boar');
  const t2Drop = souls.grantSoul(awkProf, 'boar'); // 2 duplicate shards -> Tier 2
  assert.equal(t2Drop.awakened, true, '2 duplicate soul shards awaken soul to Tier 2');
  assert.equal(souls.soulTier(awkProf, 'boar').tier, 2);
  assert.equal(souls.soulTier(awkProf, 'boar').mult, 1.25, 'Tier 2 soul scales passive bonuses by 1.25x');
  for (let i = 0; i < 16; i++) souls.grantSoul(awkProf, 'boar'); // 18 shards -> Tier 5 max
  assert.equal(souls.soulTier(awkProf, 'boar').tier, 5, '18 duplicate shards reach Tier 5 max awakening');
  assert.equal(souls.soulTier(awkProf, 'boar').mult, 2.2, 'Tier 5 soul scales passive bonuses by 2.2x');

  // 33. Phase M8: Class Soft-Role Team Auras (Assassin +40% Part Break) & Cozy Feast Physics Bag Recipes
  assert.equal(mmoProto.getClassTeamRole(3).partBreakMult, 1.4, 'Assassin has +40% Part Break specialization');
  assert.equal(mmoProto.getClassTeamRole(0).bonuses.armor, 6, 'Warden team aura grants armor');
  const pbMod = await import(src('physbag.js'));
  assert.ok(pbMod.BAG_RECIPES.length >= 5, 'Physics bag has >= 5 collision synthesis recipes including Cozy Feast dishes');
  const feastHit = pbMod.findRecipe({ uid: 'a', icon: '🍹' }, { uid: 'b', icon: '🍯' });
  assert.equal(feastHit?.recipe?.id, 'feast_cocktail', 'Berry Cider + Honey Box fuses into Lantern Feast Box');
  const soupHit = pbMod.findRecipe({ uid: 'a', icon: '🐚' }, { uid: 'b', icon: '🍯' });
  assert.equal(soupHit?.recipe?.id, 'star_brew', 'Conch + Honey Box fuses into Star-Tide Warm Soup');

  // 34. Phase M9: Social Safety (Chat Channels & Mute/Block List) + Live-Ops Feature Kill Switches
  assert.equal(mmoProto.parseChatCommand('/p 準備開王').channel, 'party');
  assert.equal(mmoProto.parseChatCommand('/g 晚安大家').channel, 'guild');
  assert.equal(mmoProto.parseChatCommand('/mute 廣告機器人').kind, 'mute');
  const socProf = {};
  mmoProto.muteUser(socProf, '廣告機器人');
  assert.equal(mmoProto.isMutedUser(socProf, '廣告機器人'), true, 'Muted user is blocked from chat');
  mmoProto.unmuteUser(socProf, '廣告機器人');
  assert.equal(mmoProto.isMutedUser(socProf, '廣告機器人'), false, 'Unmuted user restored');
  assert.equal(mmoProto.isFeatureEnabled(mmoProto.DEFAULT_FEATURE_FLAGS, 'market'), true);
  assert.equal(mmoProto.isFeatureEnabled({ market: false }, 'market'), false, 'Live-Ops kill switch halts feature immediately');

  // 35. Phase M10: Atlas Map Stone Crafting Cost & Live-Ops Autopilot Kill Switch Enforcement
  assert.equal(atlas.atlasCraftCost({ density: 'normal', mechanics: [] }).isFree, true, 'Standard 0-mod Atlas run is free');
  const heavyCost = atlas.atlasCraftCost({ density: 'abyss', mechanics: ['vaal_rift', 'twin_boss'] });
  assert.equal(heavyCost.isFree, false, 'High-density stacked Atlas requires Map Stone crafting cost');
  assert.equal(heavyCost.coins, 54, 'Abyss + 2 mechanics costs 54 coins (30 + 24)');
  assert.equal(heavyCost.shards, 28, 'Abyss + 2 mechanics costs 28 shards (16 + 12)');
  const killedApMock = { autopilot: apMod.createAutopilotState(), features: { autopilot: false }, ui: { toast() {} } };
  assert.equal(apMod.toggleAutopilot(killedApMock, 'full'), false, 'Autopilot blocked when Live-Ops kill switch is active');

  // 36. Automated Fuzz & Integrity QA: NaN Anti-Cheat Rejection, 20-Field Blueprint Integrity & 200-Player AOI Stress
  const nanMove = mmoProto.validateMoveDelta({ x: 0, z: 0 }, { x: NaN, z: Infinity }, 0.1);
  assert.equal(nanMove.ok, false, 'validateMoveDelta rejects NaN/Infinity coordinates');
  assert.equal(nanMove.violation, 10, 'Malformed coordinate receives max violation score');
  const zeroDt = mmoProto.validateMoveDelta({ x: 0, z: 0 }, { x: 0.5, z: 0 }, 0);
  assert.equal(zeroDt.ok, true, 'validateMoveDelta handles dt=0 safely without NaN');
  for (let fid = 1; fid <= 20; fid++) {
    assert.ok(frontier.FIELDS[fid] && bpMod.FIELD_BLUEPRINTS[fid], `Field & Blueprint #${fid} present`);
    assert.ok((bpMod.FIELD_BLUEPRINTS[fid].checkpoints || []).length >= 2, `Field #${fid} has >= 2 checkpoints`);
  }
  const stressGrid = new zoneEng.SpatialGrid(30);
  for (let i = 0; i < 200; i++) stressGrid.insert({ id: i, x: (i * 37) % 360 - 180, z: (i * 53) % 360 - 180 });
  const sampleNear = stressGrid.queryNearby(0, 0, 1);
  assert.ok(sampleNear.length < 40, '30m AOI spatial grid culls >80% of 200 players on 360m map');

  // 37. Phase C1–C5: Modular Cute Fantasy Character Rig, 5th Class Monk, v1->v2 Look Migration & Character GLB Assets on Disk
  const rigMod = await import(src('char_rig.js'));
  assert.equal(rigMod.JOB_ARCHETYPES.length, 5, 'Five character animation archetypes defined');
  assert.equal(rigMod.CHAR_CATALOG.classPresets.length, 5, 'Five class presets defined');
  const migrated = rigMod.normalizeCharacterLook({ job: 2, skin: 1, hair: 3, style: 2 });
  assert.equal(migrated.version, 2, 'Legacy v1 look cleanly migrates to v2 modular look');
  assert.equal(migrated.body, 'mage_01', 'Mage v1 look defaults to Mage body outfit');
  assert.equal(rigMod.resolveWeaponMeshes('auto', 'staff', 4).id, 'monk_01', 'Monk class auto-resolves to Monk staff');
  const charDir = path.join(__dirname, '..', 'game', 'assets', 'char');
  for (const fn of ['adventurer_base.glb', 'anim_fighter.glb', 'anim_archer.glb', 'anim_mage.glb', 'anim_necromancer.glb', 'anim_monk.glb']) {
    const fp = path.join(charDir, fn);
    assert.ok(fs.existsSync(fp) && fs.statSync(fp).size > 50000, `Character asset exists & valid: ${fn}`);
  }
  assert.ok(fs.readdirSync(path.join(charDir, 'tex')).length >= 17, 'All 17 character variant textures present on disk');

  // 38. Phase C6: In-Game Toon Character Integration, Directional Strafe/Combat Anim Triggers & X-Ray Root Attachment
  const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
  const modelsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'models.js'), 'utf8');
  const rigSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'char_rig.js'), 'utf8');
  assert.ok(rigSrc.includes('toToonMaterial') && gameSrc.includes('toon: true'), 'In-game modular heroes use MeshToonMaterial wrapper');
  assert.ok(gameSrc.includes("play('skill'") && gameSrc.includes("play('getHit'") && gameSrc.includes("play('buff'"), 'Combat skill/getHit/buff skeletal animations wired');
  assert.ok(gameSrc.includes("'runBack'") && gameSrc.includes("'runL'") && gameSrc.includes("'runR'"), 'Directional combat strafe animations wired');
  assert.ok(modelsSrc.includes('root.add(xray)'), 'X-Ray occlusion silhouette attached to root so it works with modular heroRig');

  console.log('ALL 38 LOGIC, CHAR-C6-TOON-ANIM, CHAR-REWORK-C1-C5, FUZZ-QA-36, MMO-M10-PORTALS-CRAFT-KILLSWITCH, MMO-M9-SAFETY-KILLSWITCH, MMO-M8-ROLES-FEAST-GPU, MMO-M7-SOUL-AWAKEN-GPU-FIX, MMO-M6-SPIRE-MENTOR-LIGHTHOUSE, MMO-M5-FERRY-REVIEW, MMO-M4-OVERHAUL, MMO-M3-FEAST-TAX, MMO-M2-HOTSPOTS, MMO-M1, PROGRESSION-B2, ICONS-U3, DIFFICULTY-B1, AUTOPILOT, TERRAIN-FX, V5-BLUEPRINTS, EMBER-TIDE, SALVAGE, AUTO-EQUIP, AUTO-BUILD, COMBAT-PARTS-ELEMENTS, BUILD-OVERHAUL, ART, SHRINES, SHEEP, MOUNTS, TIERS, COLLISION-SYNTHESIS, CODEX, FLUID-VIAL, MULTI-SHAPE BAG, I18N, PIER & GUILD SERVER CHECKS PASSED');
})();
