const CAPACITY = 4;
const FILL_SIZE = 3;

module.exports = function createDungeonLobbies(send, startRaid, announce = () => {}) {
  const waiting = new Map();
  let serial = 0;

  function specFor(me, raw) {
    if (!raw || !me.shard || me.raid || me.dungeonRun) return null;
    if (raw.kind === 'cave' && me.zone === 'field:1' && ['normal', 'elite'].includes(raw.tier)
        && Number.isInteger(raw.stage) && raw.stage >= 0 && raw.stage <= 2) {
      return { kind: 'cave', tier: raw.tier, stage: raw.stage };
    }
    const variant = typeof raw.variant === 'string' && /^[a-z0-9_-]{1,128}$/.test(raw.variant) ? raw.variant : 'base';
    if (raw.kind === 'field' && Number.isInteger(raw.field) && me.zone === `field:${raw.field}`) {
      return { kind: 'field', field: raw.field, variant };
    }
    const town = me.zone === 'town' || me.zone === 'harbor';
    if (town || me.zone?.startsWith('field:')) {
      if (raw.kind === 'run') return { kind: 'run', variant };
      if (raw.kind === 'week' && Number.isSafeInteger(raw.seed) && raw.seed > 0) return { kind: 'week', seed: raw.seed, variant };
    }
    if (!town) return null;
    if (raw.kind === 'raid' && me.member) return { kind: 'raid' };
    if (raw.kind === 'tower' && Number.isInteger(raw.floor) && raw.floor >= 1 && raw.floor <= 50) return { kind: 'tower', floor: raw.floor, variant };
    return null;
  }

  function publish(room) {
    const members = [...room.members];
    const info = { t: 'dungeon_lobby', id: room.id, leader: members[0]?.id,
      capacity: CAPACITY, members: members.map(({ id, name }) => ({ id, name })) };
    for (const member of members) send(member, info);
  }

  function leaveWaiting(me) {
    const room = me.dungeonLobby;
    if (!room) return;
    me.dungeonLobby = null;
    room.members.delete(me);
    if (!room.members.size) waiting.delete(room.id);
    else publish(room);
  }

  function leaveRun(me) {
    const room = me.dungeonRun;
    if (!room) return;
    me.dungeonRun = null;
    me.dungeonWave = null;
    me.dungeonEntered = false;
    room.members.delete(me);
    const bots = room.fill ? Math.max(0, FILL_SIZE - room.members.size) : 0;
    for (const member of room.members) {
      send(member, { t: 'dungeon_team', id: room.id, leader: room.members.values().next().value.id, count: room.members.size, bots });
    }
  }

  function leave(me) {
    leaveWaiting(me);
    leaveRun(me);
  }

  function message(me, m) {
    if (m.t === 'dungeon_join') {
      const spec = specFor(me, m.spec);
      if (!spec) { send(me, { t: 'dungeon_error', message: '請在副本入口重新開啟等候室。' }); return; }
      const key = JSON.stringify([me.shard, spec]);
      if (me.dungeonLobby?.key === key) { publish(me.dungeonLobby); return; }
      leaveWaiting(me);
      let room = [...waiting.values()].find(value => value.key === key && value.members.size < CAPACITY);
      if (!room) {
        room = { id: ++serial, key, spec, shard: me.shard, members: new Set() };
        waiting.set(room.id, room);
        if (Date.now() - (me.dungeonAnnouncedAt || 0) > 10000) {
          me.dungeonAnnouncedAt = Date.now();
          announce(me);
        }
      }
      room.members.add(me);
      me.dungeonLobby = room;
      publish(room);
      return;
    }
    if (m.t === 'dungeon_leave') { leave(me); return; }
    if (m.t === 'dungeon_start') {
      const room = me.dungeonLobby;
      if (!room || room.id !== m.id || room.members.values().next().value !== me) return;
      waiting.delete(room.id);
      const members = [...room.members];
      room.fill = m.fill === true;
      const bots = room.fill ? Math.max(0, FILL_SIZE - members.length) : 0;
      for (const member of members) member.dungeonLobby = null;
      if (room.spec.kind === 'raid') { startRaid(members, room.id, bots); return; }
      room.waves = new Map();
      room.exits = new Map();
      for (const member of members) member.dungeonRun = room;
      const info = { t: 'dungeon_begin', id: room.id, leader: me.id, seed: Math.floor(Math.random() * 999999) + 1, bots, count: members.length };
      for (const member of members) send(member, info);
      return;
    }
    const room = me.dungeonRun;
    if (!room || room.id !== m.id || !me.zone?.startsWith(`dungeon:${room.id}:`)
        || typeof m.wave !== 'string' || !/^[a-z0-9:]{1,64}$/.test(m.wave)) return;
    if (m.t === 'dungeon_wave') {
      if (!Number.isInteger(m.count) || m.count < 1 || m.count > 48 || room.waves.size >= 192 && !room.waves.has(m.wave)) return;
      if (!room.waves.has(m.wave)) room.waves.set(m.wave, Array(m.count).fill(1));
      me.dungeonWave = m.wave;
      send(me, { t: 'dungeon_wave_state', id: room.id, wave: m.wave, hp: room.waves.get(m.wave) });
    }
    if (m.t === 'dungeon_exit' && me.dungeonWave === m.wave && Number.isInteger(m.exit)
        && m.exit >= 0 && m.exit <= 3 && room.waves.get(m.wave)?.every(hp => hp === 0)) {
      if (!room.exits.has(m.wave)) room.exits.set(m.wave, m.exit);
      const exit = room.exits.get(m.wave);
      for (const member of room.members) if (member.dungeonWave === m.wave) {
        send(member, { t: 'dungeon_exit', id: room.id, wave: m.wave, exit });
      }
    }
    if (m.t === 'dungeon_positions' && me.dungeonWave === m.wave && room.members.values().next().value === me
        && Array.isArray(m.points) && m.points.length === room.waves.get(m.wave)?.length
        && m.points.every(point => Array.isArray(point) && point.length === 2
          && point.every(value => Number.isFinite(value) && Math.abs(value) <= 1024))
        && Date.now() - (me.dungeonPositionAt || 0) >= 110) {
      me.dungeonPositionAt = Date.now();
      for (const member of room.members) if (member !== me && member.dungeonWave === m.wave) {
        send(member, { t: 'dungeon_positions', id: room.id, wave: m.wave, points: m.points });
      }
    }
    if (m.t === 'dungeon_hit' && me.dungeonWave === m.wave && Number.isInteger(m.enemy)
        && Number.isFinite(m.fraction) && m.fraction > 0) {
      const now = Date.now();
      if (now - (me.dungeonHitsAt || 0) >= 1000) { me.dungeonHitsAt = now; me.dungeonHits = 0; }
      if (++me.dungeonHits > 180) return;
      const bot = m.bot === true;
      if (bot && room.members.values().next().value !== me) return;
      const hp = room.waves.get(m.wave);
      if (!hp || !(hp[m.enemy] > 0)) return;
      hp[m.enemy] = Math.max(0, hp[m.enemy] - Math.min(1, m.fraction));
      for (const member of room.members) {
        if (member.dungeonWave === m.wave) {
          send(member, { t: 'dungeon_enemy', id: room.id, wave: m.wave, enemy: m.enemy, hp: hp[m.enemy], bot, by: me.id, impact: m.impact === true });
        }
      }
    }
  }

  function position(me, zone) {
    if (me.dungeonLobby && me.shard !== me.dungeonLobby.shard) {
      leaveWaiting(me);
      send(me, { t: 'dungeon_error', message: '你已離開等候室所在的分流。' });
    }
    if (me.dungeonRun && !zone.startsWith(`dungeon:${me.dungeonRun.id}:`) && me.dungeonEntered) leaveRun(me);
    me.dungeonEntered = !!me.dungeonRun && zone.startsWith(`dungeon:${me.dungeonRun.id}:`);
  }

  return { message, leave, position };
};
