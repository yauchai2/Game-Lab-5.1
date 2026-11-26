import { FIELDS } from './frontier.js';
import { meadowObjective } from './expedition.js';

export const HARBOR_PORTALS = [7, 8, 9, 10, 11, 12];
export const mapRegionName = id => id === 0 ? '燈谷鎮' : id === 100 ? '海風港鎮' : FIELDS[id]?.name;

export function currentMapRegion(g) {
  return g.field || (g.depth === -2 ? 100 : g.depth === -1 ? 0 : (g.originField || 1));
}

export function mapAreaName(g) {
  if (g.interior) return g.interior.kind === 'tavern' ? '楓之酒館' : '旅人小屋';
  if (g.raid) return '共鳴樹庭';
  if (g.caveRun) return '草原洞窟';
  if (g.towerFloor > 0) return `試煉之塔 · 第 ${g.towerFloor} 層`;
  if (!g.field && g.depth >= 0) return `${mapRegionName(currentMapRegion(g))} · 副本第 ${g.depth + 1} 層`;
  return mapRegionName(currentMapRegion(g)) || '地區地圖';
}

export function mapExitDestination(g, exit) {
  switch (exit.type || exit.kind) {
    case 'run': case 'caveReturn': return 1;
    case 'town': return g.lastTown === -2 ? 100 : 0;
    case 'prevField': return g.field - 1;
    case 'nextField': return g.field + 1;
    case 'ferry_town': return 0;
    case 'ferry_harbor': return 100;
    default: return exit.kind?.startsWith('goto_field_') ? Number(exit.kind.slice(11)) : null;
  }
}

export function mapExitLabel(g, exit) {
  const destination = mapRegionName(mapExitDestination(g, exit));
  if (destination) return `前往${destination}`;
  return {
    dungeon: FIELDS[g.field]?.dungeon,
    item: '前往裝備房', boon: '前往祝福房', heal: '前往休憩房',
    nextTower: `前往第 ${g.towerFloor + 1} 層`,
  }[exit.type] || exit.label || '傳送門';
}

function connectionsFrom(region, lastTown) {
  if (region === 0) return [1, 100];
  if (region === 100) return [0, ...HARBOR_PORTALS];
  return [region === 1 ? lastTown : region - 1, ...(FIELDS[region + 1] ? [region + 1] : [])];
}

function legsFrom(start, destination, lastTown, exclude) {
  const seen = new Set([start, exclude]);
  const queue = [{ region: start, legs: 0 }];
  for (const { region, legs } of queue) {
    if (region === destination) return legs;
    for (const next of connectionsFrom(region, lastTown)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ region: next, legs: legs + 1 });
    }
  }
  return Infinity;
}

export function nextMapLeg(g, destination) {
  if (!mapRegionName(destination) || g.raid) return null;
  if (g.interior) {
    const door = g.spots?.find(spot => spot.kind === 'exit_house');
    return door ? { ...door, label: '先走到出口' } : null;
  }
  const current = currentMapRegion(g);
  if (!g.field && g.depth >= 0) {
    const exit = g.exits?.find(x => x.on && (x.type === 'caveReturn' || x.type === 'town'));
    return exit ? { x: exit.x, z: exit.z, label: mapExitLabel(g, exit) } : null;
  }
  if (current === destination) return null;

  const lastTown = g.lastTown === -2 ? 100 : 0;
  let best = null;
  let bestLegs = Infinity;
  for (const portal of [...(g.exits || []), ...(g.spots || [])]) {
    if ((portal.type && !portal.on) || portal.mesh?.visible === false) continue;
    const region = mapExitDestination(g, portal);
    if (!mapRegionName(region)) continue;
    const legs = legsFrom(region, destination, lastTown, current);
    if (legs >= bestLegs) continue;
    bestLegs = legs;
    best = { x: portal.x, z: portal.z, label: mapExitLabel(g, portal), region, legs: legs + 1 };
  }
  return best;
}

export function navigationTarget(g) {
  if (g.state !== 'play' || g.sailing) return null;
  if (g.mapPin) return g.mapPin;
  if (g.waypoint) {
    const leg = nextMapLeg(g, g.waypoint.id);
    return leg ? { ...leg, label: leg.region === g.waypoint.id ? leg.label : `${g.waypoint.name} · ${leg.label}` } : null;
  }
  const exit = g.exits?.find(x => x.type === 'caveReturn' && x.on);
  if (exit) return { x: exit.x, z: exit.z, label: '返回晨光草原' };
  if (g.interior) return null;
  const grave = g.field && g.meta.p.graves?.[g.field];
  if (grave) return { x: grave.x, z: grave.z, label: '墓碑' };
  return meadowObjective(g) || (g.field && g.exits?.[0] && {
    x: g.exits[0].x, z: g.exits[0].z, label: FIELDS[g.field].dungeon,
  }) || null;
}

export function describeMapTarget(player, target) {
  const dx = target.x - player.x, dz = target.z - player.z;
  const distance = Math.round(Math.hypot(dx, dz));
  const dirs = ['東', '東南', '南', '西南', '西', '西北', '北', '東北'];
  const direction = dirs[Math.round(Math.atan2(dz, dx) / (Math.PI / 4) + 8) % 8];
  return distance <= 3 ? '就在附近' : `${direction} ${distance}m`;
}
