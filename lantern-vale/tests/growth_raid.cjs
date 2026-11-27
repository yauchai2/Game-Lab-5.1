const assert = require('node:assert/strict');
const createGuild = require('../server/guild.cjs');

(async () => {
  const { creditGrowthGuild } = await import('../src/growth_journey.js');
  const guild = createGuild(':memory:', { scaleRaidPopulation: true });
  const player = (id, ch = String(id)) => ({
    id, name: 'Player ' + id, messages: [],
    ws: { readyState: 1, send(raw) { clientMessages.get(id).push(JSON.parse(raw)); } },
    secret: ch.repeat(64),
  });
  const clientMessages = new Map();
  const clients = [1, 2, 3, 4].map(id => player(id));
  for (const client of clients) {
    clientMessages.set(client.id, client.messages);
    guild.message(client, { t: 'guildHello', secret: client.secret });
  }
  const [leader, guest, third, fourth] = clients;
  const frame = client => client.messages.filter(message => message.t === 'raidFrame').at(-1);
  guild.startDungeonRaid([leader], 'solo', 2);
  guild.tick();
  assert.equal(frame(leader).maxHp, 112, 'AI does not increase boss HP');
  guild.message(leader, { t: 'raidLeave' });
  guild.startDungeonRaid(clients, 'group', 0);
  guild.tick();
  assert.equal(frame(leader).maxHp, 208);
  guild.message(fourth, { t: 'raidLeave' });
  guild.message(third, { t: 'raidLeave' });
  guild.tick();
  assert.equal(frame(leader).maxHp, 144, 'Scale changes before the first hit');

  for (let tick = 0; tick < 7; tick++) {
    guild.message(leader, { t: 'raidInput', x: 0, z: tick < 5 ? -1 : 0, attack: true });
    guild.tick();
  }
  assert.ok(frame(leader).hp < 144);
  const wounded = frame(leader).hp;
  guild.message(guest, { t: 'raidLeave' });
  guild.tick();
  assert.equal(frame(leader).maxHp, 144, 'Scale stays locked when a teammate leaves after combat starts');
  assert.ok(frame(leader).hp <= wounded);
  guild.startDungeonRaid([guest], 'group', 0);

  for (let tick = 0; tick < 130 && leader.raid; tick++) {
    // Move out for the impact tick, then move back into attack range.
    const cycle = leader.raid.clock % 40;
    const z = cycle >= 32 ? 1 : cycle < 7 ? -1 : 0;
    guild.message(leader, { t: 'raidInput', x: 0, z, attack: true });
    guild.tick();
  }
  const result = client => client.messages.find(message => message.t === 'raidResult');
  assert.deepEqual(result(leader), { t: 'raidResult', won: true, contributed: true });
  assert.deepEqual(result(guest), { t: 'raidResult', won: true, contributed: false });
  const profile = { growthJourney: { clears: { 6: true } } };
  assert.equal(creditGrowthGuild(profile, result(guest)), false);
  assert.equal(creditGrowthGuild(profile, result(leader)), true);
  assert.equal(creditGrowthGuild(profile, result(leader)), false);
  assert.equal(creditGrowthGuild({}, result(leader)), false);
  assert.equal(leader.messages.filter(message => message.t === 'wallet').at(-1).coins, 12);
  assert.equal(guest.messages.filter(message => message.t === 'wallet').at(-1).coins, 0);
  console.log('Passed population scaling, combat HP lock, contribution, and one-time raid record.');
})().catch(error => { console.error(error); process.exitCode = 1; });
