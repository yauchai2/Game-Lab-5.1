const ZONE = 'field:1';
const STATION = { x: -67.5, z: 79.1 };
const LAMPS = [
  { x: -74, z: 75 }, { x: -67, z: 73 }, { x: -73, z: 69 }, { x: -63, z: 74 },
];
const DURATION_MS = 90_000;
const RESULT_MS = 30_000;
const INTERACT_RADIUS = 3.4;
const distance = (member, point) => Math.hypot(member.x - point.x, member.z - point.z);

module.exports = function createGrowthWatch({ players, send, now = Date.now }) {
  const events = new Map();
  let nextId = 1;
  const inField = member => member.zone === ZONE && !!member.shard && !member.raid;
  const ready = member => inField(member) && !!member.member && Number.isFinite(member.lastPosAt) &&
    now() - member.lastPosAt <= 2_000;

  function sync(member) {
    if (!inField(member)) return;
    const event = events.get(member.shard);
    const payload = {
      t: 'growth_watch', shard: member.shard, station: STATION, id: event?.id ?? null,
      state: event?.state || 'idle', remaining: event ? Math.max(0, event.deadline - now()) : 0,
      lamps: event?.lamps ?? [],
      contributed: event?.contributors.has(member.member) ?? false,
    };
    send(member, payload);
  }

  function publish(shard) {
    for (const member of players.values()) if (member.shard === shard) sync(member);
  }

  function message(member, packet) {
    if (!ready(member)) return;
    const shard = member.shard;
    const event = events.get(shard);
    if (packet.t === 'growth_watch_start') {
      if (event || distance(member, STATION) > INTERACT_RADIUS) return;
      const nearby = new Set([...players.values()].filter(other =>
        other.shard === shard && ready(other) && distance(other, STATION) <= 18).map(other => other.member)).size;
      events.set(shard, {
        id: nextId++, state: 'active', deadline: now() + DURATION_MS,
        lamps: LAMPS.slice(0, Math.min(4, nearby + 1)).map(point => ({ ...point, lit: false })),
        contributors: new Set(),
      });
    } else {
      if (packet.t !== 'growth_watch_light' || !event || event.state !== 'active' ||
          packet.id !== event.id || now() >= event.deadline || !Number.isInteger(packet.index)) return;
      const lamp = event.lamps[packet.index];
      if (!lamp || lamp.lit || distance(member, lamp) > INTERACT_RADIUS) return;
      lamp.lit = true;
      event.contributors.add(member.member);
      if (event.lamps.every(point => point.lit)) {
        event.state = 'cleared';
        event.deadline = now() + RESULT_MS;
      }
    }
    publish(shard);
  }

  function tick() {
    for (const [shard, event] of events) {
      if (now() < event.deadline) continue;
      if (event.state === 'active') {
        event.state = 'expired';
        event.deadline = now() + RESULT_MS;
      } else events.delete(shard);
      publish(shard);
    }
  }

  return { message, sync, tick };
};
