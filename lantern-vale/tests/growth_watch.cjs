const assert = require('node:assert/strict');
const createGrowthWatch = require('../server/growth_watch.cjs');

const players = new Map();
let time = 0;
const service = createGrowthWatch({
  players, now: () => time,
  send: (player, update) => { player.update = structuredClone(update); },
});

function join(id, shard = 'field:1#1', member = id) {
  const player = { member, zone: 'field:1', shard };
  players.set(id, player);
  service.sync(player);
  return player;
}

function move(player, point) {
  Object.assign(player, { x: point.x, z: point.z, lastPosAt: time });
}

function start(player) {
  service.message(player, { t: 'growth_watch_start' });
}

function light(player, index, id = player.update.id) {
  service.message(player, { t: 'growth_watch_light', id, index });
}

const first = join('first');
const second = join('second');
const otherShard = join('otherShard', 'field:1#2');
const station = first.update.station;
move(first, { x: 0, z: 0 });
start(first);
assert.equal(first.update.state, 'idle');
move(first, station);
move(second, station);
const duplicateTab = join('sameMember', first.shard, first.member);
move(duplicateTab, station);
start(first);
assert.equal(first.update.lamps.length, 3);
assert.equal(second.update.id, first.update.id);
assert.equal(otherShard.update.state, 'idle');
move(otherShard, station);
start(otherShard);
assert.equal(otherShard.update.lamps.length, 2);
assert.notEqual(otherShard.update.id, first.update.id);
const eventId = first.update.id;
light(first, 0);
assert.equal(first.update.lamps[0].lit, false);
move(first, first.update.lamps[0]);
light(first, 0, otherShard.update.id);
assert.equal(first.update.lamps[0].lit, false);
light(first, 0);
assert.equal(second.update.lamps[0].lit, true);
move(second, first.update.lamps[0]);
light(second, 0);
assert.equal(second.update.contributed, false);

const late = join('late');
assert.equal(late.update.lamps[0].lit, true);
assert.equal(late.update.contributed, false);
players.delete('first');
time += 2001;
light(second, 1);
assert.equal(late.update.lamps[1].lit, false);
move(second, second.update.lamps[1]);
light(second, 1);
move(second, second.update.lamps[2]);
light(second, 2);
assert.equal(second.update.state, 'cleared');
assert.equal(second.update.contributed, true);
assert.equal(late.update.state, 'cleared');
assert.equal(late.update.contributed, false);
const reconnect = join('reconnected', second.shard, first.member);
assert.equal(reconnect.update.contributed, true);
assert.equal(reconnect.update.id, eventId);
move(second, station);
start(second);
assert.equal(second.update.state, 'cleared');

time += 30_000;
service.tick();
assert.equal(second.update.state, 'idle');
move(second, station);
start(second);
assert.equal(second.update.lamps.length, 2);
time += 90_000;
move(second, second.update.lamps[0]);
light(second, 0);
service.tick();
assert.equal(second.update.state, 'expired');
assert.equal(second.update.contributed, false);
assert.equal(otherShard.update.state, 'expired');
time += 30_000;
service.tick();
assert.equal(otherShard.update.state, 'idle');

// Larger gatherings retain an achievable cap.
for (let i = 0; i < 5; i++) move(join(`gathered-${i}`), station);
move(second, station);
start(second);
assert.equal(second.update.lamps.length, 4);
console.log('Shared watch passed solo and group sizing, shard isolation, contributions, reconnect, duplicate and deadline checks.');
