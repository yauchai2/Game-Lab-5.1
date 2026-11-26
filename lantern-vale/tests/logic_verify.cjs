// Pure Node.js logic & authoritative server integration tests (no Chromium required)
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const createGuild = require('../server/guild.cjs');

(async () => {
  const src = p => pathToFileURL(path.resolve(__dirname, '../src', p)).href;
  const frontier = await import(src('frontier.js'));
  const lodge = await import(src('lodge.js'));

  const expedition = await import(src('expedition.js'));
  const opening = await import(src('opening.js'));
  let traveler = { level: 1, coins: 10, keys: 0 };
  assert.equal(expedition.startMeadowExpedition(traveler, 2, 'hunt'), false);
  assert.equal(expedition.startMeadowExpedition(traveler, 1, 'survey'), true);
  assert.equal(expedition.startMeadowExpedition(traveler, 1, 'hunt'), false);
  assert.equal(expedition.recordMeadowObjective(traveler, 'camp-0'), false);
  assert.equal(expedition.recordMeadowObjective(traveler, 'lamp-0'), true);
  assert.equal(expedition.recordMeadowObjective(traveler, 'lamp-0'), false);
  assert.equal(expedition.recordMeadowObjective(traveler, 'champion'), false);
  traveler = JSON.parse(JSON.stringify(traveler));
  assert.equal(expedition.recordMeadowObjective(traveler, 'lamp-1'), true);
  assert.equal(expedition.meadowStage(traveler.meadowExpedition.active), 'champion');
  assert.equal(expedition.recordMeadowObjective(traveler, 'champion'), true);
  assert.equal(expedition.claimMeadowReward(traveler, 'haste'), null);
  assert.equal(expedition.claimMeadowReward(traveler, 'frost').xp, 240);
  assert.equal(expedition.claimMeadowReward(traveler, 'leech'), null);
  assert.equal(opening.openingStep(traveler), 'support');
  assert.equal(opening.openingSupport(traveler).gemUid, traveler.puzzle.bag[0].uid);
  assert.deepEqual([traveler.keys, traveler.coins, traveler.puzzle.bag.map(g => g.id)], [1, 95, ['frost']]);
  assert.equal(expedition.startMeadowExpedition(traveler, 1, 'hunt'), false);
  assert.equal(expedition.startMeadowExpedition(traveler, 2, 'hunt'), true);
  for (const i of [0, 1, 2]) assert.equal(expedition.recordMeadowObjective(traveler, 'camp-' + i), true);
  assert.equal(expedition.meadowStage(traveler.meadowExpedition.active), 'champion');

  const cave = await import(src('meadow_cave.js'));
  let delver = { keys: 1, coins: 10 };
  assert.equal(cave.enterMeadowCave(delver, 'elite'), null);
  let ticket = cave.enterMeadowCave(delver, 'normal');
  assert.equal(delver.keys, 0);
  assert.equal(cave.advanceMeadowCave(delver, ticket, 2), null);
  assert.deepEqual(cave.advanceMeadowCave(delver, ticket, 0), { complete: false });
  assert.equal(cave.advanceMeadowCave(delver, ticket, 0), null);
  delver = JSON.parse(JSON.stringify(delver));
  assert.equal(cave.advanceMeadowCave(delver, ticket, 1), null);
  ticket = cave.enterMeadowCave(delver, 'normal');
  assert.equal(ticket.stage, 1);
  assert.equal(delver.keys, 0);
  assert.deepEqual(cave.advanceMeadowCave(delver, ticket, 1), { complete: false });
  assert.deepEqual(cave.advanceMeadowCave(delver, ticket, 2), {
    complete: true, firstClear: true, coins: 115, materials: 3, xp: 275,
  });
  assert.equal(cave.advanceMeadowCave(delver, ticket, 2), null);
  assert.deepEqual(delver.mMats, { boar_tusk: 3, thorn_bark: 3 });
  delver.keys = 2;
  const repeat = cave.enterMeadowCave(delver, 'normal');
  for (const stage of [0, 1]) cave.advanceMeadowCave(delver, repeat, stage);
  assert.equal(cave.advanceMeadowCave(delver, repeat, 2).materials, 1);
  assert.equal(cave.enterMeadowCave(delver, 'elite').stage, 0);
  assert.equal(delver.keys, 0);

  const firstRun = { level: 1, keys: 1, coins: 15 };
  opening.beginOpening(firstRun);
  assert.equal(opening.openingStep(firstRun), 'lamp');
  const firstTicket = cave.enterMeadowCave(firstRun, 'normal');
  assert.equal(opening.openingStep(firstRun), 'resume');
  for (const stage of [0, 1, 2]) cave.advanceMeadowCave(firstRun, firstTicket, stage);
  assert.equal(opening.openingStep(firstRun), 'badge');
  const openingBadge = opening.craftOpeningBadge(firstRun, () => String);
  assert.equal(openingBadge.implicit.v, 2);
  assert.equal(openingBadge.reqLevel, 2);
  assert.equal(opening.craftOpeningBadge(firstRun), null);
  assert.equal(opening.openingStep(firstRun), 'next');
  assert.equal(opening.openingStep(delver), 'resume');
  assert.equal(delver.opening, undefined, 'Existing cave clears are not retroactively awarded');

  const skills = await import(src('puzzle.js'));
  const veteran = { level: 5, puzzle: skills.defaultPuzzle(2), meadowExpedition: {
    active: null, cleared: { 1: { route: 'survey', gemId: 'leech' } },
  } };
  assert.deepEqual(expedition.availableExpeditions(veteran), [2, 3]);
  assert.equal(expedition.startMeadowExpedition(veteran, 3, 'hunt'), true);
  const objectives = expedition.expeditionRoute(3, 'hunt');
  assert.deepEqual(objectives.enemies, ['boar', 'thorn', 'moth']);
  for (const id of objectives.targets) assert.equal(expedition.recordMeadowObjective(veteran, id), true);
  assert.equal(expedition.recordMeadowObjective(veteran, 'champion'), true);
  const forestReward = expedition.claimMeadowReward(veteran, 'area');
  const before = veteran.puzzle.presets[0][0];
  assert.equal(forestReward.xp, 520);
  assert.deepEqual(expedition.availableExpeditions(veteran), [2, 4]);
  assert.ok(skills.applySupportFit(veteran, forestReward.gemUid));
  assert.equal(veteran.puzzle.presets[0][0], before);
  assert.equal(skills.computeBoard(veteran.puzzle.presets[0])[0].mod.area, 0.35);
  assert.equal(skills.applySupportFit(veteran, forestReward.gemUid), null);
  const duplicate = skills.addGemToBag(veteran, 'area');
  assert.equal(skills.applySupportFit(veteran, duplicate.uid), null);
  assert.equal(veteran.puzzle.bag[0].uid, duplicate.uid);
  veteran.puzzle.activePreset = 1;
  assert.equal(skills.suggestSupportFit(veteran, 'vamp'), null);

  assert.equal(expedition.startMeadowExpedition(traveler, 4, 'survey'), false);
  assert.equal(expedition.startMeadowExpedition(veteran, 4, 'survey'), true);
  assert.equal(expedition.recordMeadowObjective(veteran, 'lamp-0'), true);
  assert.equal(expedition.recordMeadowObjective(veteran, 'lamp-1'), true);
  const noBreak = JSON.parse(JSON.stringify(veteran));
  assert.equal(expedition.recordMeadowObjective(noBreak, 'champion'), true);
  assert.deepEqual(expedition.claimMeadowReward(noBreak, 'ember').materials, { moth_dust: 2 });
  assert.equal(expedition.recordMeadowObjective(veteran, 'champion', true), true);
  const resumed = JSON.parse(JSON.stringify(veteran));
  assert.deepEqual(expedition.claimMeadowReward(resumed, 'vortex').materials, { moth_dust: 4 });
  assert.equal(expedition.claimMeadowReward(resumed, 'ember'), null);
  assert.equal(resumed.mMats.moth_dust, 4);

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
  assert.ok(frontier.xpForNextLevel(1) >= 200, 'Slow MMORPG XP curve requires >= 200 XP for Lv.1 -> Lv.2');
  frontier.awardKill(mockGame, { type: 'slime', level: 5, elite: true, spawnIndex: 5 });
  assert.equal(mockGame.meta.p.level, 1, 'Single Lv.5 elite kill does NOT instantly level up Lv.1 player');
  assert.equal(mockGame.meta.p.species.slime, 1, 'Species codex records kill');
  for (let i = 0; i < 2500; i++) frontier.awardKill(mockGame, { type: 'stag', level: 30, elite: true, spawnIndex: 0 });
  assert.ok(mockGame.meta.p.keys > 1, 'Repeated elite kills drop scarce keystones');
  assert.ok(mockGame.meta.p.goods.wood > 0, 'Repeated kills drop scarce materials');
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
  for (const [slot, nm] of [['head', '舊頭盔'], ['body', '舊胸甲'], ['hands', '舊手套'], ['feet', '舊靴子'], ['relic', '舊聖物']]) mockGame.player.equip[slot] = { name: nm, slot, rarity: 0, mods: [] }; // 8 欄位都有舊裝，才確定被替換的一定進背包
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
  const pz = puzzle.ensurePuzzle(pzProfile, 1); // 林風遊俠（硬核開局：僅 1 顆基礎主動技，0 顆免費輔助！）
  const board = puzzle.computeBoard(pz.presets[0]);
  assert.equal(board.length, 1, 'Ranger starts lean with only 1 basic active skill (星羽箭雨) on board');
  assert.equal(board[0].id, 'rain');
  // Place 多重投射 & 極速詠唱 adjacent to verify puzzle adjacency linking still works
  pz.presets[0].push({ uid: 90, id: 'multi', x: 2, y: 3, rot: 0 }, { uid: 91, id: 'haste', x: 1, y: 3, rot: 0 });
  const boardLinked = puzzle.computeBoard(pz.presets[0]);
  assert.equal(boardLinked[0].mod.multi, 2, 'Adjacent 多重投射 adds +2 projectiles/waves');
  assert.ok(boardLinked[0].mod.cdr > 0, 'Adjacent 極速詠唱 reduces cooldown');
  // Verify Mystic CoH circuit works when manually assembled
  const mysticBoard = puzzle.computeBoard([
    { uid: 1, id: 'bolt', x: 1, y: 1, rot: 0 },
    { uid: 2, id: 'coh', x: 1, y: 2, rot: 0 },
    { uid: 3, id: 'blue_tornado', x: 3, y: 2, rot: 0 },
  ]);
  assert.ok(mysticBoard.find(s => s.id === 'bolt')?.mod.triggerOnHit.includes('blue_tornado'), 'Mystic bolt -> blue_tornado CoH circuit works');
  // Stack a third 熾炎增幅 adjacent to rain at (2, 1)
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
  assert.equal(loot.tierInfo(9).name, '傳世階');
  // 16 階階梯：舊 T1–T6 對應 1,3,5,7,9,11；Lv1–30 每 2–3 級一階，另有 4 階終局星燈階
  assert.equal(loot.TIERS.length - 1, 16, 'Sixteen-rank equipment ladder');
  assert.deepEqual([1, 3, 5, 7, 9, 11].map(k => loot.tierInfo(k).power), [1, 2, 3, 4, 5, 6], 'Legacy tiers keep their stat power');
  assert.equal(loot.rankForLevel(1), 1); assert.equal(loot.rankForLevel(13), 6); assert.equal(loot.rankForLevel(30), 12);
  { // 掉落階依等級；舊存檔階級換算；詞綴為整數
    let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 300; i++) {
      const it = loot.makeItem(r, 9, null); assert.ok(it.tier >= 1 && it.tier <= 12, 'drop tier within growth ranks');
      for (const m of [it.implicit, ...it.mods]) assert.ok(Number.isInteger(m.v), 'integer affix values');
    }
    const old = loot.deserializeItem({ slot: 'staff', rarity: 1, tier: 6, name: 'x', mods: [] });
    assert.equal(old.tier, 11, 'Legacy T6 save maps to rank 11');
    assert.equal(loot.deserializeItem(loot.serializeItem(loot.makeItem(r, 20, 1, 'head', 14))).tier, 14, 'Endgame rank survives save');
  }
  const mounts = await import(src('mounts.js'));
  assert.equal(mounts.MOUNTS.length, 4, 'Four original mounts defined');
  assert.equal(mounts.activeMountDef({ level: 1, kills: 0 }), null, 'New player starts with mounts locked');
  assert.equal(mounts.activeMountDef({ level: 10, kills: 60 }), null, 'Reaching milestone without crafting saddle does NOT auto-grant mount');
  const lockedRider = { level: 1, kills: 0, coins: 999, goods: { wood: 5 } };
  assert.equal(mounts.unlockMountSaddle(lockedRider, 'stag', true).ok, false, 'Former developer flag cannot bypass milestones');
  assert.equal(lockedRider.ownedMounts, undefined);
  const oldSave = { ...lockedRider, ownedMounts: ['stag'], mountId: 'stag' };
  assert.equal(mounts.activeMountDef(oldSave), null, 'Ineligible ownership from an old save cannot be ridden');
  const lackingSaddle = { level: 10, kills: 60, coins: 249, goods: { wood: 5 } };
  assert.equal(mounts.unlockMountSaddle(lackingSaddle, 'stag', true).ok, false, 'Former developer flag cannot bypass saddle costs');
  assert.equal(lackingSaddle.coins, 249);
  const mntProf = { level: 10, kills: 60, coins: 300, shards: 200, goods: { wood: 10, ore: 10 }, mMats: { sky_feather: 6, boss_heart: 3 }, visitedFields: [1, 2, 3, 4, 5], feathers: 3, secondClass: 'bastion', best: { wins: 2 } };
  assert.equal(mounts.unlockMountSaddle(mntProf, 'stag').ok, true, 'Lv.10 + 60 kills + saddle mats unlocks Forest Stag');
  assert.deepEqual([mntProf.coins, mntProf.goods.wood], [50, 5], 'Taming charges the saddle materials once');
  assert.equal(mounts.unlockMountSaddle(mntProf, 'stag').alreadyOwned, true);
  assert.deepEqual([mntProf.coins, mntProf.goods.wood], [50, 5]);
  assert.equal(mounts.activeMountDef(mntProf).id, 'stag', 'Owned Forest Stag is active');
  assert.equal(mounts.activeMountDef({ ...mntProf, ownedMounts: ['fox', 'stag'], mountId: 'fox' }).id, 'stag', 'Selection falls back to an eligible owned mount');
  assert.equal(mounts.unlockMountSaddle(mntProf, 'alpaca').ok, false, 'Lv.10 cannot unlock T2 Cloud Alpaca (needs Lv.15)');
  mntProf.level = 15; mntProf.coins = 1000;
  assert.equal(mounts.unlockMountSaddle(mntProf, 'alpaca').ok, true, 'Lv.15 + 5 fields + 3 feathers + ore unlocks Cloud Alpaca');
  mntProf.level = 20; mntProf.coins = 1500;
  assert.equal(mounts.unlockMountSaddle(mntProf, 'manta').ok, true, 'Lv.20 + 2nd class + 2 bosses + sky_feather unlocks Starwing Manta');
  mntProf.level = 25; mntProf.coins = 2500; mntProf.kills = 300; mntProf.visitedFields = [1,2,3,4,5,6,7,8,9,10,11,12];
  assert.equal(mounts.unlockMountSaddle(mntProf, 'fox').ok, true, 'Lv.25 + 12 fields + 300 kills + boss_heart unlocks Sakura Spirit Fox');

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
    meta: { p: { level: 1, bagItems: [] }, save() {} },
    recalc() {},
  };
  physbag.addGearToBag(aeMock.meta.p, strongStaff);
  assert.equal(physbag.autoEquipBest(aeMock).count, 0, 'Lv.1 player blocked from auto-equipping high-tier T5/T6 gear');
  aeMock.meta.p.level = 30;
  const aeRes = physbag.autoEquipBest(aeMock);
  assert.equal(aeRes.count, 1, 'Lv.30 player auto-equips strictly stronger gear from physics bag');
  assert.equal(aeMock.player.equip.staff.name, strongStaff.name, 'Stronger staff equipped');
  assert.ok(aeMock.meta.p.bagItems.some(b => b.kind === 'gear' && b.name === weakStaff.name), 'Replaced weak staff returned to bag');

  assert.equal(aeMock.meta.p.gear.staff.name, strongStaff.name, 'Auto-equip persists the upgraded weapon');
  const headBefore = loot.makeItem(() => 0.2, 0, 0, 'head');
  const headNext = loot.makeItem(() => 0.8, 4, 0, 'head');
  aeMock.player.equip.head = headBefore;
  aeMock.audio = { sfx() {} };
  aeMock.ui = { toast() {} };
  let savedGear;
  aeMock.meta.save = () => { savedGear = structuredClone(aeMock.meta.p); };
  physbag.addGearToBag(aeMock.meta.p, headNext);
  assert.ok(physbag.useBagItem(aeMock, aeMock.meta.p.bagItems.at(-1), 'bagItems'));
  assert.equal(savedGear.gear.head.name, headNext.name, 'Manual equip persists the new item on the character');
  assert.ok(savedGear.bagItems.some(entry => entry.name === headBefore.name), 'Previous gear is saved in the bag');
  assert.ok(savedGear.bagItems.every(entry => entry.name !== headNext.name), 'New gear is saved exactly once');
  for (const slot of ['head', 'body', 'hands', 'feet', 'relic']) {
    const item = loot.makeItem(() => 0.8, 4, 0, slot);
    assert.ok(loot.forgeItem('upgrade', item, () => 0.7).name.endsWith(item.base), 'Forge preserves the catalogue base');
    const legacy = { ...item, base: undefined };
    assert.ok(loot.forgeItem('upgrade', legacy, () => 0.7).name.endsWith(loot.SLOTS[slot].bases[0]));
  }

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
  assert.equal(tide.ULTIMATES.length, 8, 'Eight ultimates defined (5 Class-specific 3D ultimates + 3 shared tide ultimates)');
  assert.equal(tide.MICRO_BUFFS.length, 3, 'Three seamless mid-wave micro-buffs defined');
  const td = tide.createTideState();
  assert.equal(td.phase, 0);
  assert.equal(tide.lootMultForTide(td), 1.0);
  // Harder Tide trigger: 4 casual kills do NOT trigger Tide yet; 16 rapid kills push into Phase 1 (40%+)
  for (let i = 0; i < 4; i++) tide.recordTideKill(td, {}); // 4 * 2.5 = 10 heat -> still calm!
  assert.equal(td.phase, 0, 'Casual 4 kills stay calm and do NOT accidentally trigger Tide');
  for (let i = 0; i < 12; i++) tide.recordTideKill(td, {}); // +30 = 40 heat -> Phase 1
  assert.equal(td.phase, 1, 'Sustained 16 rapid kills push Ember Tide into Phase 1 (火星躁動)');
  for (let i = 0; i < 14; i++) tide.recordTideKill(td, {}); // +35 = 75 heat -> Phase 2
  assert.equal(td.phase, 2, 'Continued aggressive kills escalate into Phase 2 (餘燼狂潮)');
  const apexRes = tide.recordTideKill(td, { isBoss: true }); // +16 = 91
  assert.equal(apexRes.enteredApex, false);
  const apexRes2 = tide.recordTideKill(td, { isBoss: true }); // 100 -> Apex!
  assert.equal(apexRes2.enteredApex, true, 'Reaching 100 heat triggers Phase 3 Apex Surge');
  assert.equal(td.apexTimer, tide.APEX_DURATION);
  assert.ok(td.ultCharge >= 100, 'Killing swarm charges ultimate to 100%');
  const ultUsed = tide.consumeUltimate(td);
  assert.equal(ultUsed.id, 'dragon', 'Consuming full ultimate casts Fighter 3D DRAGON BREATH first');
  assert.equal(td.ultCharge, 0);
  // Slaying Tide Boss during Apex immediately transitions into 25s Lull
  const lullRes = tide.recordTideKill(td, { isTideBoss: true });
  assert.equal(lullRes.enteredLull, true, 'Slaying Tide Boss enters mandatory 25s breathing-room lull');
  assert.equal(td.lullTimer, tide.LULL_DURATION);
  assert.equal(td.phase, -1);
  // Rekindling lantern during lull launches Wave 2, capped strictly at MAX_WAVE_STREAK (3)
  assert.equal(tide.applyRekindle(td), true, 'Rekindling lantern during lull starts Wave 2');
  assert.equal(td.waveStreak, 2);
  assert.equal(td.phase, 2);
  assert.ok(tide.lootMultForTide(td) > 2.2, 'Wave 2 scales loot multiplier above base surge');
  td.lullTimer = 25; td.waveStreak = tide.MAX_WAVE_STREAK;
  assert.equal(tide.applyRekindle(td), false, 'Cannot rekindle past MAX_WAVE_STREAK (finite wave cap)');
  // Idle heat decay when outside Apex/Lull
  td.lullTimer = 0; td.heat = 40; td.phase = 1; td.decayIdleT = 4;
  tide.stepTideTimers(td, 2.0);
  assert.ok(td.heat < 40, 'Heat decays rapidly when player stops fighting');

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
  const { World } = await import(src('world.js'));
  const { Scene } = await import('three');
  const mapWorld = new World(new Scene());
  for (let id = 1; id <= 20; id++) {
    const exitCount = id < 20 ? 3 : 2;
    const { spawn, exits } = mapWorld.generate(7201 + id * 319, frontier.fieldBiome(id), {
      size: frontier.FIELDS[id].size, blueprint: bpMod.FIELD_BLUEPRINTS[id], cardinalExits: true, exitCount,
    });
    assert.deepEqual(exits.map(e => e.dir), id < 20 ? ['north', 'south', 'east'] : ['north', 'south']);
    assert.ok(exits.every(exit => mapWorld.isWalk(exit.x, exit.z)), `All exits are walkable in field ${id}`);
    if (id >= 6 && id < 20) {
      const east = exits[2];
      const goal = mapWorld.idx(east.x, east.z);
      mapWorld.computeFlow(exits[1].x, exits[1].z);
      if (mapWorld.flow[goal] < 0) mapWorld.computeFlow(spawn.x, spawn.z);
      assert.ok(mapWorld.flow[goal] >= 0, `Generated gate is connected in field ${id}`);
    }
  }
  mapWorld.clear();
  const wCenter = bpMod.uvToWorld(0.5, 0.5, 120);
  assert.equal(wCenter.x, 0); assert.equal(wCenter.z, 0);
  // Verify checkpoint teleport cycles between unlocked checkpoints
  const cpMock = {
    field: 1,
    meta: { p: structuredClone(frontier.progressDefaults), save() {} },
    player: { pos: { x: 0, z: 0, set(x, y, z) { this.x = x; this.z = z; } }, y: 0, mana: 50, stats: { maxHp: 100, mana: 100 } },
    world: { gh: () => 0.5, isWalk: () => true },
    checkpoints: [
      { idx: 0, name: 'CP-A', x: 10, z: 10, y: 0.5, unlocked: true },
      { idx: 1, name: 'CP-B', x: 80, z: -40, y: 2.0, unlocked: true },
    ],
    ui: { toast() {} },
  };
  assert.equal(frontier.useFieldSpot(cpMock, { kind: 'checkpoint', cpIdx: 0 }), true);
  assert.ok(Math.hypot(cpMock.player.pos.x - 81.6, cpMock.player.pos.z + 38.4) < 0.5, 'Checkpoint teleports player to next unlocked checkpoint');
  cpMock.world.isWalk = () => false;
  assert.equal(frontier.teleportToCheckpoint(cpMock, 1), true);
  assert.deepEqual([cpMock.player.pos.x, cpMock.player.pos.z], [80, -40], 'Blocked checkpoint offset falls back to the checkpoint');
  cpMock.field = 0;
  assert.equal(frontier.teleportToCheckpoint(cpMock, 1), false, 'Checkpoints cannot move players from a different scene');

  const { combatPace } = await import(src('progression.js'));
  const earlyCombat = combatPace(1);
  assert.ok(earlyCombat.attacksPerSecond / combatPace(1, true).attacksPerSecond < 0.7);
  assert.ok(earlyCombat.cooldown >= 1.5 && earlyCombat.recovery >= 0.9);
  assert.ok(earlyCombat.damage < 1 && earlyCombat.manaRegen < 1);
  assert.ok(earlyCombat.enemyHp >= 1.2 && earlyCombat.enemyDamage >= 1.3);
  assert.ok(combatPace(8).cooldown > combatPace(12).cooldown);

  const { findQuestRoute } = await import(src('quest_guide.js'));
  const wayFrom = { x: -4, z: 0 }, wayTo = { x: 4, z: 0 };
  const floor = { res: 0.5, half: 8, gh: () => 0, obstacles: [],
    isWalk: (x, z) => Math.abs(x) <= 8 && Math.abs(z) <= 8 };
  assert.deepEqual(findQuestRoute(floor, [], wayFrom, wayTo), [wayFrom, wayTo]);
  const wall = { x: 0, z: 0, hw: 0.8, hd: 2 };
  const aroundWall = findQuestRoute(floor, [wall], wayFrom, wayTo);
  assert.ok(aroundWall.some(point => Math.abs(point.z) > wall.hd));
  assert.deepEqual(aroundWall.at(-1), wayTo);
  assert.deepEqual(findQuestRoute(floor, [{ ...wall, hd: 8 }], wayFrom, wayTo), []);
  const shore = { ...floor, isWalk: (x, z) => floor.isWalk(x, z) && (Math.abs(x) > 1 || z > 2) };
  assert.ok(findQuestRoute(shore, [], wayFrom, wayTo).some(point => point.z > 2));
  const lampPost = { ...floor, obstacles: [{ ...wayTo, r: 0.7 }] };
  const approach = findQuestRoute(lampPost, [], wayFrom, wayTo).at(-1);
  assert.ok(Math.hypot(approach.x - wayTo.x, approach.z - wayTo.z) <= 1.65);
  assert.notDeepEqual(approach, wayTo);
  const longField = { res: 1, half: 120, gh: () => 0, obstacles: [], isWalk: (x, z) => Math.abs(x) <= 120 && Math.abs(z) <= 120 };
  const farGate = { x: 106, z: 0 };
  const pathToGate = findQuestRoute(longField, [{ x: 0, z: 0, hw: 2, hd: 35 }], { x: -106, z: 0 }, farGate);
  assert.deepEqual(pathToGate.at(-1), farGate);
  assert.ok(pathToGate.some(point => Math.abs(point.z) > 35));

  const maps = await import(src('map_navigation.js'));
  const waypoint = { depth: -1, field: 0, lastTown: -1, exits: [{ type: 'run', x: 0, z: -12, on: true }],
    spots: [{ kind: 'ferry_harbor', x: 0, z: 26 }], state: 'play' };
  assert.equal(maps.nextMapLeg(waypoint, 3).region, 1, 'Forest and swamp directions use the actual grassland gate');
  assert.equal(maps.nextMapLeg(waypoint, 20).region, 100, 'Far eastern route starts at the actual harbor dock');
  assert.equal(maps.nextMapLeg({ ...waypoint, interior: {}, spots: [{ kind: 'exit_house', x: 1, z: 2 }] }, 3).label, '先走到出口');
  assert.equal(maps.nextMapLeg({ ...waypoint, depth: 0, caveRun: {}, exits: [{ type: 'caveReturn', on: false }] }, 8), null);
  assert.equal(maps.describeMapTarget({ x: 0, z: 0 }, { x: 0, z: -12 }), '北 12m');
  const regionMap = await import(src('region_map.js'));
  const projection = regionMap.regionMapProjection({ interior: { halfW: 4.8, halfD: 3.8 } }, 320, 208);
  assert.deepEqual(projection.world(projection.x(2), projection.y(-3)), { x: 2, z: -3 });
  const interiorPins = regionMap.regionMapMarkers({ interior: {}, spots: [{ kind: 'exit_house', label: '門口', x: 1, z: 2 }],
    checkpoints: [{ idx: 2, x: 9, z: 9 }], _simAdvs: [{ def: { id: 1 }, x: 0, z: 0 }] });
  assert.deepEqual(interiorPins.map(pin => pin.label), ['門口']);
  // Verify all 34 v6 GLB landmark & monster assets exist on disk
  const p2bAssets = await import(src('assets.js'));
  const fsMod = require('node:fs');
  const gameDir = path.resolve(__dirname, '../game');
  assert.equal(Object.keys(p2bAssets.LANDMARK_FILES).length, 49, '49 landmark GLBs registered (20 fields + 2 towns + dungeons)');
  const dunMod = await import(src('dungeon_scene.js'));
  assert.equal(typeof dunMod.buildDungeonScenery, 'function', 'Dungeon scenery builder exported');
  assert.equal(Object.keys(p2bAssets.MONSTER_FILES).length, 22, '22 monster GLBs registered (13 base + 9 giant field bosses)');
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
  assert.equal(apMock.meta.p.xp, 5, 'Autopilot awards 30% XP (18 * 0.30 = 5)');
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
  // base = 6 + 5*1.2 = 12; +25% upward bonus = 15
  assert.equal(upMock.meta.p.xp, 15, 'Manual kill of Lv.5 enemy at Lv.1 grants +25% upward XP bonus (12 -> 15)');

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
  // base = 6 + 1*1.2 = 7.2; * 1.4 = 10.08 -> 10
  assert.equal(hsMock.meta.p.xp, 10, 'Gold Tide hotspot island grants +40% manual XP (7.2 -> 10)');
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
  // base = 6 + 1*1.2 = 7.2; * 1.10 = 7.92 -> 8
  assert.equal(ferryMock.meta.p.xp, 8, 'Co-Voyage ferry buff grants +10% XP (7.2 -> 8)');

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

  // 39. Phase U4b: Unified A Short Hike Pixel-Cozy UI System across Character Theater, HUD & All Modals
  const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  for (const tok of ['--ui-wood:', '--ui-cream:', '--ui-parchment:', '--ui-card:', '--ui-cta:', '--ui-ok:', '--ui-alt:', '--boxsh:']) {
    assert.ok(htmlSrc.includes(tok), `Unified A Short Hike UI token present: ${tok}`);
  }
  assert.ok(htmlSrc.includes('Phase U4b：全遊戲統一「A Short Hike 溫馨像素風」'), 'Phase U4b A Short Hike unified style block present in index.html');

  // 40. Phase V1–V6: Piloto 4-Pack VFX Assets, 24 Active / 16 Support Gems, 5 Class Mechanics & 8 Ultimates (5 Class + 3 Shared)
  const vfxDir = path.join(__dirname, '..', 'game', 'assets', 'vfx');
  const vfxGlb = path.join(vfxDir, 'vfx_meshes.glb');
  assert.ok(fs.existsSync(vfxGlb) && fs.statSync(vfxGlb).size > 1500000, 'Packed 40-mesh vfx_meshes.glb exists & valid');
  assert.ok(fs.readdirSync(path.join(vfxDir, 'tex')).filter(f => f.endsWith('.webp') || f.endsWith('.png')).length >= 32, 'All 32 stylized VFX textures (22 WebP + 10 Wave 2 PNG) present');
  assert.equal(Object.keys(puzzle.ACTIVE_GEMS).length, 24, 'Skill Puzzle 2.0 has 24 Active Gems (14 upgraded + 10 3D summons)');
  assert.ok(Object.keys(puzzle.SUPPORT_GEMS).length >= 19, 'Skill Puzzle 2.0 has 19 Support Gems (incl. bluefire, vortex & 3 Survivor Synergy Gems)');
  for (const cls of puzzle.CLASSES) {
    assert.ok(cls.classMech && cls.classMech.max > 0 && cls.classUlt, `Class ${cls.name} has signature classMech & classUlt`);
  }
  assert.equal(tide.ULTIMATES.length, 8, '8 Ultimates defined (5 Class-specific 3D Ultimates + 3 Shared Tide Ultimates)');
  const bfBoard = puzzle.computeBoard([{ uid: 1, id: 'fire_whale', x: 1, y: 1, rot: 0 }, { uid: 2, id: 'bluefire', x: 1, y: 2, rot: 0 }]);
  assert.equal(bfBoard[0].mod.vfxTheme, 'bluefire', 'Linking bluefire support gem mutates skill vfxTheme to bluefire');

  // 41. Phase D1–D5: Location Mountain Ship 3D Island Stage, 3D Foot Pin Projection & 5 Showcase Poses
  const animSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'char_anim.js'), 'utf8');
  const charPageSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'characters.js'), 'utf8');
  const shipGlb = path.join(__dirname, '..', 'game', 'assets', 'scenes', 'creator_mountain_ship.glb');
  assert.ok(fs.existsSync(shipGlb) && fs.statSync(shipGlb).size > 200000, 'creator_mountain_ship.glb exists & valid');
  assert.ok(animSrc.includes('setShowcasePose('), 'CharAnimator implements setShowcasePose for iconic hero poses');
  assert.ok(charPageSrc.includes('buildMountainShipStage') && charPageSrc.includes('creator_mountain_ship.glb'), 'Location mountain ship 3D stage wired');
  assert.ok(charPageSrc.includes('heroPins3d') && htmlSrc.includes('id="heroPins3d"'), '3D projected foot pins wired in Character Theater');

  // 42. Phase v6b: 19 Grounded HD-Verified Palmov POIs (zero boats on land, zero Japanese temples), 20 Giant Field Bosses, Zero-WALL POIs & HD Settings Toggle
  const bpV6 = await import('../src/field_blueprints.js');
  const { DEFAULTS: renderDefaults } = await import(src('settings.js'));
  assert.equal(renderDefaults.pixel, 2, 'Fine is the default pixel size');
  assert.equal(Object.keys(p2bAssets.PALMOV_POIS).length, 16, 'All 16 grounded HD-verified Palmov POI GLBs registered');
  for (const [k, rel] of Object.entries(p2bAssets.PALMOV_POIS)) {
    const fp = path.join(__dirname, '..', 'game', rel);
    assert.ok(fs.existsSync(fp) && fs.statSync(fp).size > 5000, `Palmov POI GLB exists & valid: ${k} (${rel})`);
  }
  assert.equal(Object.keys(frontier.FIELD_BOSS_SPEC).length, 20, 'FIELD_BOSS_SPEC covers all 20 field maps');
  for (let fid = 1; fid <= 20; fid++) {
    const spec = frontier.FIELD_BOSS_SPEC[fid];
    assert.ok(spec && spec.name && p2bAssets.MONSTER_FILES[spec.modelKey], `Field #${fid} giant boss model registered: ${spec?.modelKey}`);
    const bp = bpV6.FIELD_BLUEPRINTS[fid];
    const grid = bpV6.getBlueprintGrid(fid);
    for (const poi of bp.pois || []) {
      const gx = Math.max(0, Math.min(bpV6.BP_W - 1, Math.round(poi.x * (bpV6.BP_W - 1))));
      const gy = Math.max(0, Math.min(bpV6.BP_H - 1, Math.round(poi.y * (bpV6.BP_H - 1))));
      const cell = grid[gy * bpV6.BP_W + gx];
      assert.notEqual(cell, 5, `Field #${fid} POI "${poi.name}" (${poi.x},${poi.y}) must NOT be buried in WALL`);
    }
  }

  // 43. Hardcore Difficulty & MMO Scarcity Overhaul (NO 3-choose-1 drafts, NO jackpot chests, NO free auto-cast; 8 Elite Affixes, 6 Formations, 10-min Escalation, Sanctuary Talents, Spoils Pouch, Creator Island Ocean)
  const surv = await import('../src/survivor.js');
  const gameSrcV = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
  const htmlV6 = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  assert.ok(!gameSrcV.includes('s.maxHp += (profile.level - 1) * 5; s.baseDmg += profile.level - 1;'), 'recalc() double-scaling bug removed');
  assert.ok(!htmlV6.includes('id="draftModal"') && !htmlV6.includes('id="chestModal"') && !htmlV6.includes('id="svTopXp"'), 'VS 3-choose-1 draft modal, jackpot chest modal & top XP bar removed');
  assert.equal(surv.ELITE_AFFIXES.length, 8, '8 high-threat elite affixes defined');
  assert.equal(surv.SWARM_FORMATIONS.length, 6, '6 tactical swarm formations defined');
  assert.equal(surv.SANCTUARY_TALENTS.length, 7, '7 earned Starlight Sanctuary talents defined');

  // Elite affixes: Lv.1+ already gets 1 affix, Lv.10+ / Wave 2+ gets 2 affixes
  const dummyElLow = { elite: true };
  assert.equal(surv.assignEliteAffixes(dummyElLow, 3, 1).length, 1, 'Lv.3 elite gets 1 high-threat affix');
  const dummyElHigh = { elite: true };
  assert.equal(surv.assignEliteAffixes(dummyElHigh, 12, 2).length, 2, 'Lv.12 / Wave 2 elite gets 2 affixes');

  // Sanctuary Talents buy (higher earned cost) & free respec
  const mockProf = { shards: 250, coins: 0 };
  const buy1 = surv.buyTalent(mockProf, 'revive');
  assert.ok(buy1.ok && buy1.level === 1 && mockProf.shards === 160, 'Buy revive talent deducts 90 shards');
  const tb = surv.computeTalentBonuses(mockProf);
  assert.equal(tb.revives, 1, 'Revive talent grants 1 revive per run');
  const refund = surv.respecTalents(mockProf);
  assert.equal(refund, 90, 'Free respec refunds full shards');
  assert.equal(mockProf.shards, 250, 'Shards restored after respec');

  // Extraction Spoils Pouch risk/reward
  const sv = surv.createSurvivorState(mockProf);
  surv.recordSpoils(sv, 100, 20, 1);
  const lostS = surv.loseSpoilsOnDeath(sv);
  assert.equal(lostS.lostCoins, 50, 'Dying during Tide loses 50% unsettled coins');
  assert.equal(lostS.lostShards, 10, 'Dying during Tide loses 50% unsettled shards');
  const cashed = surv.cashOutSpoils(sv, mockProf);
  assert.equal(cashed.coins, 50, 'Remaining 50% cashes out cleanly');

  // Kill Streak Fever, Dynamic Difficulty Director & 10-Min Escalation Clock
  assert.equal(surv.getKillStreakTier(500).tier, 4, '500 kills reaches Tier 4 Fever');
  for (let i = 0; i < 25; i++) surv.updateDifficultyDirector(sv, 100 + i * 0.3, true);
  assert.equal(surv.updateDifficultyDirector(sv, 110, false), 3, 'High kill rate raises AI Director to Level 3');
  const esc0 = surv.getEscalationProfile(0);
  const esc5 = surv.getEscalationProfile(300);
  const esc10 = surv.getEscalationProfile(600);
  assert.ok(esc0.hpMult === 1 && esc5.hpMult > 2.5 && esc10.hpMult > 5.0 && esc10.dmgMult > 3.0, '10-min escalation clock ramps difficulty steeply');

  // Combat Power, Blood Eclipse, Endless Tide Records, Perfect Dodge & Creator Island Ocean
  const cp1 = surv.computeCombatPower({ level: 1, talents: {} }, { baseDmg: 5, dmgPct: 0, crit: 5, critMult: 150, atkSpd: 0, maxHp: 62, armor: 0 }, {});
  const cp2 = surv.computeCombatPower({ level: 20, talents: { vitality: 3, mastery: 3 } }, { baseDmg: 28, dmgPct: 60, crit: 30, critMult: 210, atkSpd: 35, maxHp: 210, armor: 28 }, { weapon: { rarity: 3, tier: 4, corrupted: true } });
  assert.ok(cp2 > cp1 * 4, `Combat Power scales strongly with MMO gear & progression (${cp1} -> ${cp2})`);
  const ec = surv.getBloodEclipseField(60 * 1000);
  assert.ok(ec.active && ec.fieldId >= 1 && ec.fieldId <= 20, 'Blood Eclipse active during first 5 minutes of 20-min cycle');
  const bt = surv.recordBestTide(mockProf, 4, 320, 8);
  assert.ok(bt && bt.maxWave === 4 && bt.maxStreak === 320 && bt.maxMin === 8, 'Endless Tide best records persisted');
  assert.ok(htmlV6.includes('id="svClock"') && htmlV6.includes('id="dangerVig"'), 'Survival clock & low-HP danger vignette present');
  assert.ok(gameSrcV.includes('極限閃避') && gameSrcV.includes('perfectCritT'), 'Perfect Dodge bullet-time counter wired');
  const charSrcOcean = fs.readFileSync(path.join(__dirname, '..', 'src', 'characters.js'), 'utf8');
  assert.ok(charSrcOcean.includes('createCreatorOceanMaterial') && charSrcOcean.includes('uRipple') && charSrcOcean.includes('burstIslandFx') && charSrcOcean.includes('towerLantern'), 'Creator Island animated toon ocean shader & interactive props wired');

  // 45. Pure MMORPG 6 Pillars (STR/DEX/INT/VIT Allocation, Gear Refinement +0..+10, 4 Gear Sets, 7-Chapter Main Story Quest Tracker, Bestiary Mastery, Adventurer Guild Rank & AI Party Companions)
  const mmoRpg = await import('../src/mmo_rpg.js');
  const mmoProf = { level: 5, coins: 2000, shards: 300, xp: 0, mats: { ore: 30 } };
  assert.equal(mmoRpg.availableStatPoints(mmoProf), 12, 'Lv.5 grants 12 allocatable stat points (3/lv)');
  assert.ok(mmoRpg.allocateStat(mmoProf, 'str', 5).ok && mmoRpg.allocateStat(mmoProf, 'vit', 4).ok, 'Stat allocation works');
  const allocB = mmoRpg.computeAllocatedBonuses(mmoProf);
  assert.ok(allocB.baseDmg >= 6 && allocB.maxHp === 36, 'Allocated STR & VIT grant expected stats');
  assert.equal(mmoRpg.resetStatPoints(mmoProf), 12, 'Free stat reset returns all 12 points');

  // Gear Refinement +0 -> +10 (safe +1..+4, downgrade at +7 fail)
  const testWeapon = { slot: 'staff', rarity: 2, tier: 2, enhance: 0, implicit: { k: 'baseDmg', v: 10 }, mods: [] };
  const enh1 = mmoRpg.enhanceItem(mmoProf, testWeapon, () => 0.99);
  assert.ok(enh1.ok && enh1.success && testWeapon.enhance === 1, '+0->+1 is 100% safe refinement');
  testWeapon.enhance = 7;
  const enhFail = mmoRpg.enhanceItem(mmoProf, testWeapon, () => 0.99);
  assert.ok(enhFail.ok && !enhFail.success && enhFail.downgraded && testWeapon.enhance === 6, '+7 fail downgrades to +6');

  // 4 Gear Sets (2-pc & 3-pc)
  const setEq = {
    staff: { setId: 'ember_conqueror' },
    cloak: { setId: 'ember_conqueror' },
    charm: { setId: 'ember_conqueror' },
  };
  const setOut = mmoRpg.computeSetBonuses(setEq);
  assert.ok(setOut.active.length === 1 && setOut.active[0].full && setOut.stats.dmgPct === 18 && setOut.stats.critMult === 35, '3-pc Ember Conqueror full set bonus activates');

  // Bestiary Mastery permanent account stats
  for (let i = 0; i < 10; i++) mmoRpg.recordBestiaryKill(mmoProf, 'slime');
  assert.equal(mmoRpg.bestiaryRank('slime', mmoProf.bestiary.slime), 1, '10 slime kills reaches Bestiary Lv.1');
  assert.equal(mmoRpg.computeBestiaryBonuses(mmoProf).stats.maxHp, 6, 'Slime Bestiary Lv.1 grants +6 permanent maxHp');

  // Main Story Chapter Questline & Claim
  for (let i = 0; i < 8; i++) mmoRpg.recordStoryEvent(mmoProf, 'kill', 1);
  assert.ok(mmoRpg.getCurrentChapter(mmoProf).done, 'Chapter 1 completes after 8 kills');
  const chRew = mmoRpg.claimChapterReward(mmoProf);
  assert.ok(chRew && chRew.gem === 'area' && mmoRpg.getCurrentChapter(mmoProf).def.id === 'ch2', 'Claiming Chapter 1 grants reward & advances to Chapter 2');

  // Adventurer Guild Rank & AI Companions & Quest Tracker HUD
  const rkLow = mmoRpg.computeAdventurerRank({ level: 1 }, 80);
  const rkHigh = mmoRpg.computeAdventurerRank(mmoProf, 2200);
  assert.ok(rkLow.rank === 'F' && (rkHigh.rank === 'S' || rkHigh.rank === 'SS'), `Adventurer Rank progresses from F to S/SS (${rkLow.rank} -> ${rkHigh.rank})`);
  assert.equal(mmoRpg.AI_COMPANIONS.length, 3, '3 AI Party Companions (Tank/Healer/Ranger) available');
  assert.ok(htmlV6.includes('id="questTracker"'), 'MMORPG right-side live quest tracker HUD present');

  // 46. Monster Materials, 9-Blueprint Gear Crafting (Starter -> Set -> Mythic Chase Gear) & 4 Elemental Resistances
  assert.equal(Object.keys(mmoRpg.MONSTER_MATS).length, 7, '7 species-specific monster crafting materials defined');
  assert.equal(mmoRpg.GEAR_RECIPES.length, 9, '9 tiered monster-material gear crafting recipes defined');
  const matProf = { coins: 5000, shards: 500, mMats: {} };
  const mDrop1 = mmoRpg.rollMonsterMatDrop(matProf, 'slime', false, false, () => 0.1);
  assert.ok(mDrop1 && mDrop1.def.id === 'slime_gel' && matProf.mMats.slime_gel === 1, 'Slime drops slime_gel crafting material');
  const dropBoss = mmoRpg.rollMonsterMatDrop(matProf, 'stag', false, true, () => 0.1);
  assert.ok(dropBoss && dropBoss.def.id === 'boss_heart' && matProf.mMats.boss_heart === 1, 'Boss drops ultra-rare boss_heart');
  matProf.mMats = { boss_heart: 4, golem_core: 8, boar_tusk: 8, slime_gel: 10, sky_feather: 8, moth_dust: 8 };
  const mCrafted = mmoRpg.craftMonsterGear(matProf, 'rec_mythic_cloak', loot.fmtOf);
  assert.ok(mCrafted.ok && mCrafted.item.rarity === 3 && mCrafted.item.setId === 'frost_warden' && mCrafted.item.mods.some(m => m.k === 'allRes'), 'Crafting mythic cloak succeeds with Frost Warden set & allRes');
  assert.ok(loot.AFFIXES.some(a => a.k === 'resFire') && loot.AFFIXES.some(a => a.k === 'resIce') && loot.AFFIXES.some(a => a.k === 'resLightning') && loot.AFFIXES.some(a => a.k === 'resPoison') && loot.AFFIXES.some(a => a.k === 'allRes'), 'All 4 elemental resistances + allRes registered in loot AFFIXES');
  assert.ok(gameSrcV.includes('abyssPen') && gameSrcV.includes('elemRes'), 'Elemental resistance damage mitigation & Lv.15+ abyss penetration wired in game.js');

  // 47. Account Login/Register/Logout + Per-Account Isolated Saves + Delete Character Slot
  const acctMod = await import('../src/account.js');
  const memMap = new Map();
  const mockStore = {
    getItem: k => (memMap.has(k) ? memMap.get(k) : null),
    setItem: (k, v) => memMap.set(k, String(v)),
    removeItem: k => memMap.delete(k),
  };
  assert.equal(acctMod.getActiveAccount(mockStore).isGuest, true, 'Defaults to guest mode');
  const regBad = acctMod.registerAccount('a', '123', mockStore);
  assert.equal(regBad.ok, false, 'Rejects too-short username/password');
  const regOk = acctMod.registerAccount('AlanHero', 'secret99', mockStore);
  assert.ok(regOk.ok && regOk.account.username === 'AlanHero' && !acctMod.getActiveAccount(mockStore).isGuest, 'Account registration logs in cleanly');
  assert.equal(acctMod.registerAccount('alanhero', 'other123', mockStore).ok, false, 'Prevents duplicate case-insensitive username');
  assert.equal(acctMod.loginAccount('AlanHero', 'wrongpw', mockStore).ok, false, 'Rejects wrong password');
  assert.ok(acctMod.loginAccount('AlanHero', 'secret99', mockStore).ok, 'Accepts valid credentials');

  const sk0 = acctMod.slotKeys(0, null, mockStore);
  const sk1 = acctMod.slotKeys(1, null, mockStore);
  assert.equal(sk0.profileKey, 'acct_alanhero_lv_profile', 'Logged-in account uses isolated save namespace');
  mockStore.setItem(sk0.charKey, '{"name":"亞蘭"}');
  mockStore.setItem(sk0.profileKey, '{"level":12}');
  mockStore.setItem(sk0.bestKey, '{"depth":5}');
  mockStore.setItem(sk1.charKey, '{"name":"副角"}');
  const delRes = acctMod.deleteCharacterSlot(0, null, mockStore);
  assert.ok(delRes.ok && mockStore.getItem(sk0.charKey) === null && mockStore.getItem(sk0.profileKey) === null && mockStore.getItem(sk0.bestKey) === null, 'deleteCharacterSlot wipes all 3 keys for target slot');
  assert.equal(mockStore.getItem(sk1.charKey), '{"name":"副角"}', 'Deleting slot 0 does not touch slot 1');
  acctMod.logoutAccount(mockStore);
  assert.equal(acctMod.getActiveAccount(mockStore).isGuest, true, 'Logout returns to guest mode');
  const scriptPos = htmlV6.indexOf('<script>/*__GAME__*/</script>');
  const acctPos = htmlV6.indexOf('id="accountModal"');
  const delPos = htmlV6.indexOf('id="delCharModal"');
  assert.ok(acctPos > 0 && acctPos < scriptPos && delPos > 0 && delPos < scriptPos, 'accountModal & delCharModal MUST appear before inline game script');
  assert.ok(htmlV6.includes('id="btnAccount"') && htmlV6.includes('id="btnDelChar"') && htmlV6.includes('id="btnSwitchChar"'), 'Account login, delete character & in-game switch char buttons wired');
  // Export & Import account backup roundtrip
  const backup = acctMod.exportAccountData('AlanHero', mockStore);
  acctMod.deleteCharacterSlot(1, 'AlanHero', mockStore);
  assert.equal(acctMod.slotHasData(1, 'AlanHero', mockStore), false, 'Slot 1 empty after delete');
  const impRes = acctMod.importAccountData(backup, 'AlanHero', mockStore);
  assert.ok(impRes.ok && impRes.restored >= 1 && acctMod.slotHasData(1, 'AlanHero', mockStore), 'Account backup export/import restores character slots');

  // 48. Equipment Level Restrictions (T1 Lv.1 -> T6 Lv.27) & Tier-Specific Crafting Materials
  // 16 階階梯：舊 T1–T6 為階梯 1,3,5,7,9,11（標示仍是 T1–T6），中間階標示為 T1+…T6+
  assert.equal(loot.itemReqLevel({ tier: 1 }), 1, 'T1 requires Lv.1');
  assert.equal(loot.itemReqLevel({ tier: 3 }), 5, 'T2 requires Lv.5');
  assert.equal(loot.itemReqLevel({ tier: 5 }), 10, 'T3 requires Lv.10');
  assert.equal(loot.itemReqLevel({ tier: 7 }), 16, 'T4 requires Lv.16');
  assert.equal(loot.itemReqLevel({ tier: 9 }), 22, 'T5 requires Lv.22');
  assert.equal(loot.itemReqLevel({ tier: 11 }), 27, 'T6 requires Lv.27');
  assert.equal(loot.itemReqLevel({ tier: 2 }), 3, 'Rank 2 (T1+) requires Lv.3');
  const restoredBadge = loot.deserializeItem(JSON.parse(JSON.stringify(loot.serializeItem(openingBadge))));
  assert.equal(loot.canEquipItem(restoredBadge, 1), false, 'Saved opening badge still requires Lv.2');
  assert.equal(loot.canEquipItem(restoredBadge, 2), true);
  assert.equal(loot.itemReqLevel(loot.deserializeItem({ ...loot.serializeItem(openingBadge), tv: undefined, reqLevel: undefined })), 2, 'Older opening badge saves recover the Lv.2 requirement');
  assert.equal(loot.itemReqLevel({ tier: 3, reqLevel: 2 }), 5, 'Upgrading rank cannot bypass the higher requirement');

  assert.deepEqual([1, 2, 3, 12, 13, 16].map(k => loot.tierInfo(k).tag), ['T1', 'T1+', 'T2', 'T6+', 'E1', 'E4']);
  assert.equal(loot.canEquipItem({ tier: 5 }, 9), false, 'Lv.9 player cannot equip T3 (Lv.10) gear');
  assert.equal(loot.canEquipItem({ tier: 5 }, 10), true, 'Lv.10 player can equip T3 gear');
  assert.equal(Object.keys(mmoRpg.TIER_CRAFT_MATS).length, 6, 'All 6 equipment tiers have dedicated crafting material definitions');
  const t1Rec = mmoRpg.GEAR_RECIPES.find(r => r.tier === 1);
  assert.ok(t1Rec && t1Rec.cost.goods?.wood > 0 && t1Rec.cost.mMats?.slime_gel > 0, 'T1 recipe requires wood + slime_gel');
  assert.equal(mmoRpg.canCraftRecipe({ coins: 500, goods: { wood: 0 }, mMats: { slime_gel: 5 } }, t1Rec), false, 'Cannot craft T1 without required tier goods (wood)');
  assert.equal(mmoRpg.canCraftRecipe({ coins: 500, goods: { wood: 2 }, mMats: { slime_gel: 3 } }, t1Rec), true, 'Can craft T1 with exact tier materials');
  const tuskRecipe = mmoRpg.GEAR_RECIPES.find(r => r.id === 'rec_tusk_staff');
  const firstClear = { level: 3, coins: 215, goods: { ore: 0 }, mMats: { boar_tusk: 3, thorn_bark: 3 } };
  assert.deepEqual(mmoRpg.missingRecipeCosts(firstClear, tuskRecipe), [
    { key: 'ore', count: 2 }, { key: 'boar_tusk', count: 1 },
  ], 'First cave clear exposes the exact recipe shortfall');
  firstClear.goods.ore = 2;
  firstClear.mMats.boar_tusk = 4;
  assert.ok(mmoRpg.canCraftRecipe(firstClear, tuskRecipe), 'Materials unlock crafting before Lv.5');
  const pbSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'physbag.js'), 'utf8');
  assert.ok(pbSrc.includes('canEquipItem(gear, p.level') && pbSrc.includes('canEquipItem(g, p.level'), 'physbag useBagItem & autoEquipBest enforce gear level gates');

  // 49. MMORPG Deep Progression Overhaul: Strict 2nd-Class Trials, Enhancement Failstack & Full-Body Resonance, Guild Rep & 5 Bounties, Companion Bond Lv.1-10 & Rank Promo Chests
  const lv1Prof = { level: 1, kills: 0, totalElites: 0, coins: 0, shards: 0, deeds: {} };
  const bastionSc = alive.findSecondClass('bastion');
  assert.equal(alive.checkAscendEligibility(lv1Prof, bastionSc).eligible, false, 'Lv.1 player CANNOT ascend to 2nd class');
  assert.equal(alive.performAscend(lv1Prof, 'bastion').ok, false, 'performAscend blocks unqualified Lv.1 player');
  const readyAscProf = { level: 12, kills: 45, totalElites: 3, coins: 350, shards: 60, deeds: { perfectGather: 2 } };
  const ascRes = alive.performAscend(readyAscProf, 'bastion');
  assert.ok(ascRes.ok && readyAscProf.secondClass === 'bastion' && readyAscProf.coins === 50 && readyAscProf.shards === 15, 'Qualified Lv.12 player completes 2nd-class trial, pays coins+shards & unlocks title');

  // Enhancement Failstack pity (+6% per fail) & Full-Body Resonance (+3/+5/+7/+9)
  const fsProf = { coins: 5000, shards: 500, mats: { ore: 50 }, enhanceFailstack: 0 };
  const fsItem = { slot: 'staff', rarity: 2, tier: 3, enhance: 5, implicit: { k: 'baseDmg', v: 15 }, mods: [] };
  const fFail = mmoRpg.enhanceItem(fsProf, fsItem, () => 0.99);
  assert.ok(fFail.ok && !fFail.success && fsProf.enhanceFailstack === 1, 'Failed enhancement increments failstack to 1');
  assert.ok(mmoRpg.enhanceInfo(5, 1).rate > mmoRpg.enhanceInfo(5, 0).rate, 'Failstack boosts next enhancement success rate');
  const fSucc = mmoRpg.enhanceItem(fsProf, fsItem, () => 0.01);
  assert.ok(fSucc.ok && fSucc.success && fsProf.enhanceFailstack === 0, 'Successful enhancement resets failstack to 0');
  const res3 = mmoRpg.computeEnhanceResonance({ staff: { enhance: 5 }, cloak: { enhance: 5 }, charm: { enhance: 5 } });
  assert.ok(res3.active && res3.active.minLv === 5 && res3.bonuses.dmgPct === 12 && res3.bonuses.crit === 4, 'Full +5 gear activates Star-Silver Enhancement Resonance');

  // Guild Reputation Lv.1->10 & 5 Repeatable Bounties + Companion Bond Lv.1->10 + Rank Promo Chest
  assert.equal(mmoRpg.GUILD_BOUNTIES.length, 5, '5 repeatable Guild Bounties defined');
  const repProf = { coins: 0, shards: 0, mats: { ore: 0 }, guildRep: 0, bountyProg: { kills: 20, gathers: 6, enhances: 3, eliteKills: 5, bossKills: 2 } };
  const bClaim = mmoRpg.claimGuildBounty(repProf, 'b_boss');
  assert.ok(bClaim.ok && repProf.guildRep === 85 && mmoRpg.getGuildRepInfo(repProf).lv === 2, 'Claiming Guild Bounty grants Guild Reputation and levels up Guild Rep Lv.2');
  const bondProf = { companionId: 'ranger' };
  const bUp = mmoRpg.grantCompanionXp(bondProf, 70);
  assert.ok(bUp && bUp.lv === 2 && mmoRpg.computeCompanionBondBonuses(bondProf).atkSpd === 4, 'Companion gains XP, levels up to Bond Lv.2 & grants player passive');
  const rkProf = { level: 10, coins: 0, shards: 0, protectCharms: 0 };
  const rkClaim = mmoRpg.claimRankReward(rkProf, 'D', 300);
  assert.ok(rkClaim.ok && rkProf.coins === 220 && rkProf.protectCharms === 1, 'Adventurer Rank D promotion chest awards coins, shards & protect charm');
  assert.equal(mmoRpg.claimRankReward(rkProf, 'D', 300).ok, false, 'Rank promotion chest cannot be claimed twice');

  // 50. MMORPG Living World Overhaul: 4 Life Skills (Lv.1-20), 6 Gear Runes (Drop/Socket/Serialize/Bonuses), 12 Collectible Titles, 4-Tier Daily Activity Chests, Field World Boss S/A/B Contribution & Simulated Adventurers
  const mmoW = await import('../src/mmo_world.js');
  assert.equal(mmoW.LIFE_SKILL_IDS.length, 4, '4 Life Skills defined (wood/ore/fish/smith)');
  const lwProf = { level: 1, kills: 120, totalElites: 12, worldBossKills: 1, guildRep: 400, ownedMounts: ['stag'], secondClass: 'bastion', coins: 0, shards: 0, mats: { ore: 0 } };
  const lsUp = mmoW.grantLifeXp(lwProf, 'smith', 40);
  assert.ok(lsUp && lsUp.lv === 2, 'Granting 40 smith XP levels Blacksmithing to Lv.2');
  const lsBon = mmoW.computeLifeSkillBonuses(lwProf);
  assert.ok(lsBon.enhanceRateBonus > 0, 'Blacksmithing Lv.2 grants permanent enhancement rate bonus');
  assert.ok(mmoRpg.enhanceInfo(5, 0, 10).rate > mmoRpg.enhanceInfo(5, 0, 1).rate, 'Higher Blacksmithing level boosts enhanceInfo success rate');

  // Gear Runes: 6 types, drop, socket, serialize roundtrip & stat bonuses
  assert.equal(mmoW.RUNE_IDS.length, 6, '6 Gear Runes defined');
  const rDrop = mmoW.rollRuneDrop(lwProf, false, true, () => 0.1);
  assert.ok(rDrop && lwProf.runes[rDrop.id] >= 1, 'Boss kill drops Rune Stone into profile bag');
  lwProf.runes.fire = 2; lwProf.runes.greed = 2;
  const rItem = loot.makeItem(() => 0.5, 2, 2, 'staff');
  const sockRes = mmoW.socketRune(lwProf, rItem, 'fire');
  assert.ok(sockRes.ok && rItem.rune === 'fire' && lwProf.runes.fire === 1, 'Socketing fire rune consumes 1 rune & attaches to gear');
  const rItem2 = loot.deserializeItem(loot.serializeItem(rItem));
  assert.equal(rItem2.rune, 'fire', 'Socketed rune survives serialize/deserialize');
  assert.ok(loot.itemLines(rItem2).some(l => l.t.includes('熾焰符文石')), 'itemLines displays socketed rune');
  const rBon = mmoW.computeRuneBonuses({ staff: rItem2, cloak: { rune: 'greed' } });
  assert.ok(rBon.stats.baseDmg === 4 && rBon.stats.addFire === 5 && rBon.stats.coinBonus === 18 && rBon.stats.shardBonus === 18, 'Rune bonuses sum combat & greed stats');

  // Collectible Titles (12) + Permanent Account Stats + Overhead Display
  assert.equal(mmoW.TITLE_DEFS.length, 12, '12 Collectible Titles defined');
  const unlockedNow = mmoW.syncUnlockedTitles(lwProf, { equip: { staff: rItem2, cloak: { rune: 'greed' } } });
  assert.ok(unlockedNow.length >= 5, 'Qualified adventurer unlocks multiple titles automatically');
  assert.ok(mmoW.equipTitle(lwProf, 'world_slayer').ok && mmoW.getActiveTitleText(lwProf).includes('世界王討伐者'), 'Equipping unlocked title formats overhead title tag');
  const tBon = mmoW.computeTitleBonuses(lwProf);
  assert.ok(tBon.dmgPct === tBon.count && tBon.maxHp === tBon.count * 5, 'Every unlocked title permanently grants +1% dmgPct & +5 maxHp');

  // Daily Activity 4-Tier Chests (25 / 50 / 75 / 100)
  assert.equal(mmoW.DAILY_CHESTS.length, 4, '4 Daily Activity Chests defined (25/50/75/100)');
  const daAdd = mmoW.addDailyActivity(lwProf, 60);
  assert.ok(daAdd.pts === 60 && daAdd.newlyReady.length === 2, 'Adding 60 daily activity unlocks 25 & 50 chests');
  const daClaim = mmoW.claimDailyChest(lwProf, 50, () => 0.2);
  assert.ok(daClaim.ok && daClaim.gainedRunes.length === 1 && lwProf.coins === 260, 'Claiming 50-pt Daily Chest awards coins, shards & random Rune Stone');
  assert.equal(mmoW.claimDailyChest(lwProf, 50).ok, false, 'Cannot claim same Daily Chest twice on same day');

  // World Boss S/A/B Contribution Grading & Simulated Adventurers
  assert.equal(mmoW.WORLD_BOSS_DEFS.length, 4, '4 rotating Field World Bosses defined');
  assert.equal(mmoW.computeWorldBossReward(500, 1000).grade, 'S', '>=45% World Boss damage earns S-grade reward');
  assert.equal(mmoW.computeWorldBossReward(250, 1000).grade, 'A', '20-44% World Boss damage earns A-grade reward');
  assert.equal(mmoW.computeWorldBossReward(50, 1000).grade, 'B', '<20% World Boss damage earns B-grade reward');
  assert.ok(mmoW.SIM_ADVENTURER_POOL.length >= 18, '18+ Simulated Living MMO Adventurers defined');
  for (const isLand of [true, false]) {
    const effects = [];
    const g = {
      state: 'play', field: 1, player: { pos: { x: 0, z: 0 } },
      world: { isLand: () => isLand, randomWalkable: () => ({ x: 3, z: 4 }), gh: () => 2 },
      worldBoss: { active: false, timer: 0 },
      spawnEnemy: (_type, pos) => ({ pos, hp: 10, m: { root: { scale: { multiplyScalar() {} }, add() {} } } }),
      vfx: Object.fromEntries(['spawnEnemyCircle', 'spawnWarning', 'spawnMaliceRift'].map(method => [
        method, (x, y, z) => effects.push([x, y, z]),
      ])),
    };
    mmoW.tickWorldBoss(g, 1);
    const { x, z } = g.worldBoss.enemy.pos;
    assert.equal(g.worldBoss.active, true);
    assert.deepEqual(effects, [[x, 2, z], [x, 2, z], [x, 2, z]], 'World Boss effects use the actual spawn point');
    if (!isLand) assert.deepEqual([x, z], [3, 4]);
  }
  assert.ok(htmlV6.includes('id="worldBossBanner"'), 'World Boss top HUD banner present in index.html');

  // 51. MMORPG Endgame Addictive Loop: Potential Cube (R->SR->SSR->UR), 4 Dynamic World Events, 50F Trial Tower, 3-Person Party Synergies & Offline Resting Rewards
  const mmoEnd = await import('../src/mmo_endgame.js');
  const endProf = { level: 12, coins: 1000, shards: 200, cubes: 2, mats: { ore: 0 }, xp: 0 };
  const potItem = loot.makeItem(() => 0.5, 2, 2, 'staff');
  const pRoll1 = mmoEnd.rollPotential(endProf, potItem, () => 0.1);
  assert.ok(pRoll1.ok && potItem.potential && potItem.potential.lines.length === 2 && endProf.cubes === 1, 'Rolling potential consumes 1 cube and awakens 2 lines');
  const potRt = loot.deserializeItem(loot.serializeItem(potItem));
  assert.equal(potRt.potential.tier, potItem.potential.tier, 'Potential survives serialize/deserialize');
  assert.ok(loot.itemLines(potRt).some(l => l.t.includes('潛能')), 'itemLines renders potential lines');
  const potBon = mmoEnd.computePotentialBonuses({ staff: potRt });
  assert.ok(potBon.awakenedCount === 1 && Object.keys(potBon.stats).length >= 2, 'computePotentialBonuses sums potential lines');

  // 4 Dynamic World Events
  assert.equal(mmoEnd.DYNAMIC_EVENT_IDS.length, 4, '4 Dynamic World Events defined');
  assert.ok(htmlV6.includes('id="dynEventBanner"') && htmlV6.includes('id="partyHud"'), 'Dynamic Event banner & Party HUD frame present in index.html');

  // 50F Endless Trial Tower
  assert.equal(mmoEnd.MAX_TOWER_FLOOR, 50, 'Trial Tower supports 50 floors');
  assert.equal(mmoEnd.towerFloorSpec(5).isBoss, true, 'Every 5th tower floor is a Boss floor');
  const twClear1 = mmoEnd.claimTowerFloorClear(endProf, 1);
  assert.ok(twClear1.ok && twClear1.firstClear && endProf.towerBest === 1, 'First-clear of Tower 1F updates best floor and grants rewards');
  const twBon = mmoEnd.computeTowerBonuses(endProf);
  assert.ok(twBon.dmgPct === 1.5 && twBon.maxHp === 6, 'Each cleared tower floor grants permanent +1.5% dmg & +6 maxHp');

  // 3-Person Party & 3 Synergy Auras
  assert.ok(mmoEnd.togglePartyMember(endProf, 'vanguard', 120).ok && mmoEnd.togglePartyMember(endProf, 'healer', 150).ok, 'Can recruit 2 AI companions into 3-person party');
  assert.equal(mmoEnd.getPartyIds(endProf).length, 2, 'Party has 2 active AI companions');
  assert.equal(mmoEnd.getActivePartySynergy(endProf)?.id, 'bastion', 'Vanguard + Healer activates Bastion synergy');
  const synBon = mmoEnd.computePartySynergyBonuses(endProf);
  assert.ok(synBon.bonuses.armor === 10 && synBon.bonuses.regen === 3, 'Bastion synergy grants armor +10 & regen +3');
  const bondSum = mmoRpg.computeCompanionBondBonuses(endProf);
  assert.ok(bondSum.armor > 0 && bondSum.regen > 0, '2-companion bond bonuses sum across both active companions');

  // Offline Resting Rewards
  const nowMs = Date.now();
  endProf.lastSeenAt = nowMs - 120 * 60 * 1000; // 2 hours away
  const offRes = mmoEnd.claimOfflineRewards(endProf, nowMs);
  assert.ok(offRes && offRes.mins === 120 && offRes.coins > 0 && offRes.xp > 0 && offRes.cubes >= 1, '2h offline grants coins, XP, shards & Potential Cube');

  // 52. 100% VFX Asset Utilization (Wave 1 + Wave 2): All 40 packed 3D meshes & 32 textures + all gameplay hooks wired
  const vfxMod = await import('../src/vfx_engine.js');
  assert.equal(vfxMod.VFX_MESH_KEYS.length, 40, '40 packed 3D VFX meshes registered (28 Wave 1 + 12 Wave 2)');
  assert.equal(vfxMod.VFX_TEX_KEYS.length, 32, '32 packed VFX textures registered (22 Wave 1 + 10 Wave 2)');
  const vfxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'vfx_engine.js'), 'utf8');
  const gameVfxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
  const panelsVfxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'panels.js'), 'utf8');
  const frontierVfxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'frontier.js'), 'utf8');
  const endVfxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'mmo_endgame.js'), 'utf8');
  const worldVfxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'mmo_world.js'), 'utf8');
  const gameplayVfxSrc = [gameVfxSrc, panelsVfxSrc, frontierVfxSrc, endVfxSrc, worldVfxSrc].join('\n');
  const allVfxCallers = vfxSrc + '\n' + gameplayVfxSrc;
  for (const mk of vfxMod.VFX_MESH_KEYS) {
    const used = (allVfxCallers.split(`'${mk}'`).length - 1) >= 2;
    assert.ok(used, `Packed 3D VFX mesh '${mk}' must be actively used (not just listed in VFX_MESH_KEYS)`);
  }
  for (const tk of vfxMod.VFX_TEX_KEYS) {
    const used = (allVfxCallers.split(`'${tk}'`).length - 1) >= 2;
    assert.ok(used, `Packed VFX texture '${tk}' must be actively used (not just listed in VFX_TEX_KEYS)`);
  }
  for (const fn of ['spawnLootBeam(', 'spawnEnemyCircle(', 'spawnWarning(', 'spawnArcanistCards(', 'spawnPeaceBlessing(', 'spawnClawSlash(', 'spawnKiAscension(', 'spawnPoisonWall(', 'spawnTwirlDash(', 'spawnWaterShield(', 'spawnElementalSpear(', 'spawnPotentialCubeBurst(', 'spawnMaliceRift(', 'spawnLifeSkillFx(']) {
    assert.ok(gameplayVfxSrc.includes(fn), `VfxEngine method ${fn} must be called in gameplay`);
  }

  // 53. CrispPixel_Sampler Design System Full UI Overhaul
  const cpWoodDir = path.join(__dirname, '..', 'game', 'assets', 'ui', 'crisp_pixel', 'wood');
  const cpIconDir = path.join(__dirname, '..', 'game', 'assets', 'ui', 'crisp_pixel', 'icons');
  assert.ok(fs.readdirSync(cpWoodDir).filter(f => f.endsWith('.png')).length >= 35, 'All 35+ CrispPixel wood 9-slice & cursor PNGs present');
  assert.ok(fs.readdirSync(cpIconDir).filter(f => f.endsWith('.png')).length >= 18, 'All 18 CrispPixel 3x icon PNGs present');
  const cpHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  for (const token of ['--cp-ink:#24141c', '--cp-wood:#8c4a30', '--cp-parchment:#e0b574', '--cp-gold:#f7c040', 'panel.png', 'window.png', 'panel_inset.png', 'tooltip.png', 'dialog_box.png', 'ribbon.png', 'button_medium_normal.png', 'button_close_normal.png', 'hotbar_slot.png', 'portrait_frame.png', 'quest_entry.png', 'currency_plate.png', 'input_normal.png', 'cursor_pointer_2x.png']) {
    assert.ok(cpHtml.includes(token), `CrispPixel Design System token/9-slice present in index.html: ${token}`);
  }
  const iconsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'icons.js'), 'utf8');
  assert.ok(iconsSrc.includes('CRISP_ICONS') && iconsSrc.includes('assets/ui/crisp_pixel/icons/'), 'src/icons.js wires CrispPixel 3x PNG icons');
  assert.ok(cpHtml.includes('Phase U5b：截圖全檢修微調'), 'Phase U5b UI polish block present in index.html');
  assert.ok(cpHtml.includes('--font-ui:"Fusion Pixel TW"') && cpHtml.includes('html:lang(ja){--font-ui:"Fusion Pixel JP"'), 'Pixel typography provides matching Traditional Chinese and Japanese variants');
  assert.doesNotMatch(cpHtml, /fonts\.googleapis\.com|cdn\.jsdelivr\.net.*Cubic|--font-pixel|PingFang/, 'Game text uses the local shared font stack');
  assert.ok(settingsSrc.includes("['camAngle', t(lang, 'rowCamAngle'), [off, on]]"), 'camAngle simplified to 2 options (off / on)');
  assert.ok(gameVfxSrc.includes('this._playerOccluded = hitMats.size > 0') && gameVfxSrc.includes('m.xray.visible = !!(this._playerOccluded'), 'm.xray gated strictly by actual camera raycast occlusion');

  // 54. Phase M11: Virtual MMO Players Ecosystem (18 diverse adventurers, inspect card, roster O-key, emote reactions & F3 stress controls)
  assert.equal(mmoW.SIM_ADVENTURER_POOL.length, 18, '18 diverse virtual MMO adventurers in pool');
  assert.ok(new Set(mmoW.SIM_ADVENTURER_POOL.map(a => a.job)).size >= 5, 'Virtual MMO pool covers all 5 classes');
  assert.ok(new Set(mmoW.SIM_ADVENTURER_POOL.map(a => a.guild)).size >= 4, 'Virtual MMO pool spans multiple guilds');
  assert.ok(mmoW.SIM_ADVENTURER_POOL.every(a => a.cos && a.gear && a.cp > 0), 'Every virtual MMO adventurer has cosmetics, gear & combat power');
  const simMock = {
    depth: -1, field: 0, state: 'play', interior: false, net: { ok: false },
    player: { pos: { x: 0, z: 0 } },
    world: { isLand: () => true, gh: () => 0, randomWalkable: () => ({ x: 2, z: 2 }) },
    scene: { add() {}, remove() {} },
    ui: { setOnline(n) { simMock._online = n; }, toast() {}, addChat() {} },
  };
  mmoW.spawnSimAdventurers(simMock);
  assert.equal(mmoW.getSimAdventurers(simMock).length, 36, 'Town defaults to 36 virtual MMO players');
  assert.equal(simMock._online, undefined, 'Virtual adventurers never update the server presence count');
  simMock.net.ws = { readyState: 0 };
  mmoW.spawnSimAdventurers(simMock);
  assert.equal(mmoW.getSimAdventurers(simMock).length, 36, 'Virtual MMO spawns while connecting to the server');
  simMock.net.ok = true;
  simMock.net.ws.readyState = 1;
  mmoW.spawnSimAdventurers(simMock);
  assert.equal(mmoW.getSimAdventurers(simMock).length, 36, 'Virtual MMO spawns while connected to the server');
  mmoW.setSimConfig(simMock, { count: 0 });
  assert.equal(mmoW.getSimAdventurers(simMock).length, 0, 'Online players can still turn off the virtual population');
  assert.equal(simMock._online, undefined, 'Changing the virtual population preserves the server presence count');
  mmoW.setSimConfig(simMock, { count: 24, mode: 'gather' });
  assert.equal(mmoW.getSimAdventurers(simMock).length, 24, 'Stress test config scales live virtual MMO players to 24');
  assert.ok(mmoW.reactSimToPlayerEmote(simMock, '嗨～') >= 1, 'Nearby virtual MMO players react to player emotes');
  assert.ok(cpHtml.includes('id="simInspectModal"') && cpHtml.includes('id="simRosterModal"') && cpHtml.includes('id="btnSimRoster"'), 'Virtual MMO inspect modal, roster modal & menu button present in index.html');

  // 55. Phase M12: Whole-map virtual players, active tasks, 3-tier LOD and bystander help
  assert.equal(mmoW.SIM_FIELD_TASKS.length, 6, '6 core field task types defined (+ dynamic World Boss override)');
  const fieldSimMock = {
    depth: 0, field: 1, state: 'play', interior: false, net: { ok: false },
    meta: { p: { coins: 0, shards: 0 }, save() {} },
    player: { pos: { x: 0, z: 0 }, stats: { baseDmg: 10 } },
    checkpoints: [{ x: 60, z: 40, name: 'CP1' }, { x: -75, z: -50, name: 'CP2' }],
    exits: [{ type: 'dungeon', x: 0, z: -85 }],
    spots: [{ kind: 'ore', x: 45, z: -30, label: '星紋礦' }, { kind: 'wood', x: -40, z: 55, label: '香杉木' }],
    enemies: [{ dead: false, elite: true, pos: { x: 12, y: 0, z: 10 }, hp: 100, maxHp: 100 }],
    world: { half: 120, isLand: () => true, gh: () => 0, randomWalkable: () => ({ x: 20, z: 20 }) },
    scene: { add() {}, remove() {} },
    ui: { setOnline(n) { fieldSimMock._online = n; }, toast() {}, addChat() {} },
  };
  mmoW.spawnSimAdventurers(fieldSimMock);
  const fAdvs = mmoW.getSimAdventurers(fieldSimMock);
  assert.equal(fAdvs.length, 36, 'Wild field defaults to 36 virtual MMO players spread across the whole map');
  assert.ok(fAdvs.every(a => a.task && a.task.need > 0 && a.activity), 'Every wild field virtual player has an active task & progress');
  assert.ok(fAdvs.some(a => Math.hypot(a.x, a.z) > 40), 'Virtual players genuinely spread across distant map anchors (>40m)');
  // Verify Tier-3 LOD hides meshes >55m while keeping near meshes visible
  fAdvs[0].x = 5; fAdvs[0].z = 5;
  fAdvs[1].x = 85; fAdvs[1].z = 85;
  mmoW.tickSimAdventurers(fieldSimMock, 0.55);
  assert.equal(fAdvs[0].m.root.visible, true, 'Near virtual player (<32m) stays visible');
  assert.equal(fAdvs[1].m.root.visible, false, 'Distant virtual player (>55m) hidden by Tier-3 LOD for 0 draw call overhead');
  // Verify bystander co-op help advances nearby hunting virtual player task & grants friendship reward
  fAdvs[0].task = { id: 'hunt', icon: '⚔️', name: '討伐魔物懸賞', have: 0, need: 6 };
  const helped = mmoW.onPlayerHelpSimKill(fieldSimMock, { pos: { x: 8, z: 8 } });
  assert.ok(helped >= 1 && fAdvs[0].task.have === 1 && fieldSimMock.meta.p.coins > 0, 'Helping kill a nearby virtual player mob advances their task & grants friendship reward');
  // Verify Region Map draws virtual player dots
  const regionMapSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'region_map.js'), 'utf8');
  assert.ok(regionMapSrc.includes('g._simAdvs') && regionMapSrc.includes('#48f0c8'), 'Region minimap renders cyan-mint virtual MMO player dots');

  console.log('ALL 55 LOGIC, WHOLE-MAP-VIRTUAL-MMO-M12, VIRTUAL-MMO-PLAYERS-M11, CRISP-PIXEL-UI-SYSTEM, VFX-100PCT-UTILIZATION, MMORPG-ENDGAME-POTENTIAL-TOWER-PARTY-EVENTS-OFFLINE, MMORPG-LIVING-WORLD-BOSS-LIFE-RUNES-TITLES-DAILY, MMORPG-PROGRESSION-OVERHAUL, GEAR-LEVEL-GATES-TIER-MATS, ACCOUNT-LOGIN-DELETE-CHAR, MONSTER-MATS-CRAFT-RESIST, MMORPG-6-PILLARS, HARDCORE-MMO-SCARCITY, CREATOR-OCEAN-INTERACT, V6-FIELD-POI-BOSS, DIORAMA-D1-D4, VFX-SKILL-REWORK-V1-V6, UI-UNIFIED-U4B, CHAR-C6-TOON-ANIM, CHAR-REWORK-C1-C5, FUZZ-QA-36, MMO-M10-PORTALS-CRAFT-KILLSWITCH, MMO-M9-SAFETY-KILLSWITCH, MMO-M8-ROLES-FEAST-GPU, MMO-M7-SOUL-AWAKEN-GPU-FIX, MMO-M6-SPIRE-MENTOR-LIGHTHOUSE, MMO-M5-FERRY-REVIEW, MMO-M4-OVERHAUL, MMO-M3-FEAST-TAX, MMO-M2-HOTSPOTS, MMO-M1, PROGRESSION-B2, ICONS-U3, DIFFICULTY-B1, AUTOPILOT, TERRAIN-FX, V5-BLUEPRINTS, EMBER-TIDE, SALVAGE, AUTO-EQUIP, AUTO-BUILD, COMBAT-PARTS-ELEMENTS, BUILD-OVERHAUL, ART, SHRINES, SHEEP, MOUNTS, TIERS, COLLISION-SYNTHESIS, CODEX, FLUID-VIAL, MULTI-SHAPE BAG, I18N, PIER & GUILD SERVER CHECKS PASSED');
})();
