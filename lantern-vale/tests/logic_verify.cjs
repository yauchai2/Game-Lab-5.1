// Pure Node.js logic & authoritative server integration tests (no Chromium required)
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const createGuild = require('../server/guild.cjs');

(async () => {
  const src = p => pathToFileURL(path.resolve(__dirname, '../src', p)).href;
  const frontier = await import(src('frontier.js'));
  const lodge = await import(src('lodge.js'));

  // 1. Six persistent regions configured with expected sizes & levels
  assert.equal(frontier.FIELDS.length, 7);
  assert.deepEqual(
    frontier.FIELDS.slice(1).map(f => [f.name, f.level, f.size]),
    [
      ['晨光草原', 1, 60],
      ['低語森林', 5, 100],
      ['霧潮沼澤', 10, 60],
      ['霜冬雪原', 15, 100],
      ['燼煙火岩區', 20, 60],
      ['古樹林', 25, 100],
    ],
  );

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

  // 4. Crafting consumes 2 wood + 3 ore and equips a rare item
  mockGame.meta.p.goods = { wood: 4, ore: 6, fish: 0 };
  const crafted = frontier.craft(mockGame);
  assert.ok(typeof crafted === 'string' && crafted.length > 0, 'Crafting returns item name');
  assert.equal(mockGame.meta.p.goods.wood, 2);
  assert.equal(mockGame.meta.p.goods.ore, 3);
  assert.ok(Object.values(mockGame.player.equip).some(it => it && it.rarity === 2));

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

  console.log('ALL LOGIC, PUZZLE, CLASS & GUILD SERVER CHECKS PASSED');
})();
