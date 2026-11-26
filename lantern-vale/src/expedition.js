import * as THREE from 'three';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { mulberry32 } from './util.js';
import { FIELDS } from './frontier.js';
import { initParts } from './parts.js';

const grassland = {
  field: 1, champion: '裂地獠牙', championType: 'boar',
  tactics: '圓圈預警時離開範圍，直線預警時向側面閃。等牠收招再反擊。',
  routes: {
    hunt: { title: '清剿前哨', summary: '貼近射手，向側面閃開野豬衝鋒。', enemies: ['slime', 'thorn', 'boar'] },
    survey: { title: '重燃路燈', summary: '沿指引前進，到路燈旁互動。', lamps: ['南門路燈', '溪畔路燈'] },
  },
};
export const MEADOW_TIERS = {
  1: { ...grassland, name: '晨光遠征 · 護送航線', level: 1, xp: 240, coins: 85, keys: 1, gems: ['frost', 'leech'] },
  2: { ...grassland, name: '晨光遠征 · 精英', champion: '裂地獠牙・精英', level: 3, xp: 320, coins: 115, keys: 1, gems: ['haste', 'multi'] },
  3: {
    field: 2, name: '低語森林 · 鬆開根網', champion: '鉤棘老根', championType: 'thorn', level: 5,
    tactics: '落根圈會鎖定你站的位置。看見腳下預警就移位，再從側翼避開三連棘刺。',
    xp: 520, coins: 145, keys: 1, gems: ['area', 'vamp'],
    routes: {
      hunt: { title: '開闢伐木道', summary: '清掉掩護棘芽射手的野豬，以及封路的孢蛾。', enemies: ['boar', 'thorn', 'moth'] },
      survey: { title: '修復引路燈', summary: '到兩盞森林引路燈旁互動，追蹤蔓延的根網。', lamps: ['林口引路燈', '古樹引路燈'] },
    },
  },
  4: {
    field: 3, requires: 3, name: '霧潮沼澤 · 孢潮封鎖', champion: '孢囊巨像', championType: 'golem', level: 10,
    tactics: '離開落地圈，或用火焰引爆毒池反擊。趁巨像收招，從背後攻擊孢囊，打破後毒池會縮小。',
    xp: 900, coins: 210, keys: 1, gems: ['ember', 'vortex'],
    championHealth: 2.05, championDamage: 0.9,
    materials: { moth_dust: 2 }, partBonus: { id: 'moth_dust', count: 2, weakness: 'spores' },
    routes: {
      hunt: { title: '清除棧道伏擊', summary: '擊退孢蛾、棘芽與重岩守衛，打開通往巨像的棧道。', enemies: ['moth', 'thorn', 'golem'] },
      survey: { title: '引燃孢池', summary: '到兩處孢池旁互動，用提燈引爆孢子，熟悉火焰連鎖。', lamps: ['棧道孢池', '蘆葦孢池'], ignition: true },
    },
  },
};

export function expeditionRoute(tier, route) {
  const routes = MEADOW_TIERS[tier]?.routes;
  const def = routes && Object.hasOwn(routes, route) ? routes[route] : null;
  if (!def) return null;
  const targets = (def.enemies || def.lamps).map((_, i) => (def.enemies ? 'camp-' : 'lamp-') + i);
  return { ...def, targets, need: targets.length };
}

export function availableExpeditions(profile) {
  const { cleared } = meadowExpedition(profile);
  return Object.keys(MEADOW_TIERS).map(Number).filter(tier => {
    const requires = MEADOW_TIERS[tier].requires ?? (tier === 1 ? null : 1);
    return !cleared[tier] && (!requires || cleared[requires]);
  });
}

export function meadowExpedition(profile) {
  return profile.meadowExpedition || { active: null, cleared: {} };
}

export function isMeadowIntro(profile) {
  const expedition = meadowExpedition(profile);
  return !!expedition.active || (!expedition.cleared[1] && (profile.level || 1) <= 3 && !(profile.story?.chapter > 0));
}

export function startMeadowExpedition(profile, tier, route) {
  const { active, cleared } = meadowExpedition(profile);
  if (active || !availableExpeditions(profile).includes(tier) || !Object.hasOwn(MEADOW_TIERS[tier].routes, route)) return false;
  profile.meadowExpedition = { cleared, active: { tier, route, completed: [], championDown: false } };
  return true;
}

export function meadowStage(active) {
  if (!active) return 'choose';
  if (active.championDown) return 'reward';
  return active.completed.length >= expeditionRoute(active.tier, active.route).need ? 'champion' : 'route';
}

export function recordMeadowObjective(profile, objective, partBroken = false) {
  const { active } = meadowExpedition(profile);
  const stage = meadowStage(active);
  if (stage === 'champion' && objective === 'champion') {
    active.championDown = true;
    if (partBroken && MEADOW_TIERS[active.tier].partBonus) active.partBroken = true;
  } else if (stage === 'route' && expeditionRoute(active.tier, active.route).targets.includes(objective) && !active.completed.includes(objective)) {
    active.completed.push(objective);
  } else return false;
  return true;
}

export function claimMeadowReward(profile, gemId) {
  const { active, cleared } = meadowExpedition(profile);
  if (meadowStage(active) !== 'reward' || cleared[active.tier]) return null;
  const reward = MEADOW_TIERS[active.tier];
  if (!reward.gems.includes(gemId)) return null;
  const entry = addGemToBag(profile, gemId);
  profile.coins = (profile.coins || 0) + reward.coins;
  profile.keys = (profile.keys || 0) + reward.keys;
  const materials = { ...reward.materials };
  if (active.partBroken && reward.partBonus) {
    const { id, count } = reward.partBonus;
    materials[id] = (materials[id] || 0) + count;
  }
  if (Object.keys(materials).length) {
    profile.mMats ||= {};
    for (const [id, count] of Object.entries(materials)) profile.mMats[id] = (profile.mMats[id] || 0) + count;
  }
  cleared[active.tier] = { route: active.route, gemId };
  profile.meadowExpedition.active = null;
  return { ...reward, materials, gem: ALL_GEMS[gemId], gemUid: entry.uid };
}

function expeditionLocations(g) {
  const { world } = g;
  const port = g.exits.find(e => e.type === 'town' || e.type === 'prevField') || world.spawn;
  const facing = Math.atan2(-port.x, -port.z);
  const points = [];
  const random = mulberry32(1729);
  function find(distance, offset) {
    for (const delta of [0, -0.42, 0.42, -0.85, 0.85, -1.32, 1.32, Math.PI]) {
      const heading = facing + offset + delta;
      const x = port.x + Math.sin(heading) * distance;
      const z = port.z + Math.cos(heading) * distance;
      if (!world.isWalk(x, z) || world.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 1.3)) continue;
      if (points.some(p => Math.hypot(p.x - x, p.z - z) < 3.3)) continue;
      const point = { x, z };
      points.push(point);
      return point;
    }
    const point = world.randomWalkable(random, port, 6);
    points.push(point);
    return point;
  }
  return {
    'camp-0': find(14, -0.25), 'camp-1': find(20, -0.55), 'camp-2': find(19, 0.28),
    'lamp-0': find(13, 0.7), 'lamp-1': find(24, 0.35),
    champion: find(30, 0.05),
  };
}

function createTrailLamp(g, id, pos, name, ignition) {
  const mesh = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.8, 0.26), new THREE.MeshStandardMaterial({ color: 0x694025 }));
  post.position.y = 0.9;
  const light = new THREE.Mesh(new THREE.OctahedronGeometry(0.43), new THREE.MeshBasicMaterial({ color: 0xa98d59 }));
  light.position.y = 2.05;
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.94, 24), new THREE.MeshBasicMaterial({ color: 0xffcc63, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.06;
  mesh.add(post, light, halo);
  mesh.position.set(pos.x, g.world.gh(pos.x, pos.z), pos.z);
  g.world.group.add(mesh);
  const label = (ignition ? '引燃' : '點亮') + name;
  if (ignition) {
    light.material.color.setHex(0x90d856);
    halo.material.color.setHex(0x90d856);
    post.scale.y = 0.5;
    light.position.y = 1.2;
  }
  g.spots.push({ ...pos, kind: 'expedition_lamp', expeditionId: id, ignition, mesh, light, label, top: mesh.position.y + 2.7 });
}

export function syncMeadowExpedition(g) {
  const { active } = meadowExpedition(g.meta.p);
  const def = MEADOW_TIERS[active?.tier];
  if (!def || g.field !== def.field || g.interior) return;
  g.meadowLocations ||= expeditionLocations(g);
  const stage = meadowStage(active);
  const route = expeditionRoute(active.tier, active.route);
  const ids = stage === 'route' ? route.targets : stage === 'champion' ? ['champion'] : [];
  for (const id of ids) {
    if (active.completed.includes(id) || g.enemies.some(e => !e.dead && e.expeditionId === id) || g.spots.some(s => s.expeditionId === id)) continue;
    const pos = g.meadowLocations[id];
    const index = route.targets.indexOf(id);
    if (route.lamps && index >= 0) {
      createTrailLamp(g, id, pos, route.lamps[index], route.ignition);
      continue;
    }
    const champion = id === 'champion';
    const tier = active.tier;
    const e = g.spawnEnemy(champion ? def.championType : route.enemies[index], pos, false);
    e.expeditionId = id;
    e.expeditionTier = tier;
    e.expeditionName = champion ? def.champion : null;
    if (e.type === 'slime') e.meadowPounce = true;
    e.level = def.level;
    e.hp = e.maxHp = Math.round(e.maxHp * (champion ? (def.championHealth ?? (tier === 1 ? 2.05 : 3.0)) : tier === 1 ? 0.82 : 1.12));
    e.dmg *= champion ? (def.championDamage ?? (tier === 1 ? 1.08 : 1.22)) : (tier === 1 ? 0.75 : 0.95);
    if (champion) {
      e.m.root.scale.multiplyScalar(1.28);
      if (def.partBonus) {
        e.sporeGuardian = true;
        initParts(e, [{
          id: 'sporeSac', name: '蓄毒孢囊', icon: '✦', hitSide: 'rear',
          localOffset: { x: 0, z: -0.75 }, minSide: 0.25, hpFrac: 0.24, weaken: def.partBonus.weakness,
          weakenDesc: '孢池半徑縮小，首通追加月蛾鱗粉',
        }]);
        const sac = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43, 0), new THREE.MeshBasicMaterial({ color: 0x9be269 }));
        sac.position.set(0, 1.35, -0.85);
        e.m.root.add(sac);
        e.m.parts ||= {};
        e.m.parts.sporeSac = sac;
      }
    }
    if (def.field === 3 && e.type === 'moth') e.spd *= 1.16;
  }
}

export function meadowObjective(g) {
  const { active } = meadowExpedition(g.meta.p);
  const stage = meadowStage(active);
  if (!active || stage === 'reward' || g.interior) return null;
  const def = MEADOW_TIERS[active.tier];
  if (g.depth < 0 && !g.field && !g.interior) {
    const gate = g.exits.find(e => e.type === 'run' || e.type === 'goto_field_1');
    return gate && { ...gate, label: '遠征 · 前往晨光草原' };
  }
  if (g.field !== def.field) {
    if (!g.field) return null;
    const gate = g.exits.find(e => e.type === (g.field < def.field ? 'nextField' : 'prevField'));
    const next = FIELDS[g.field + Math.sign(def.field - g.field)];
    return gate && next && { ...gate, label: '遠征 · 前往' + next.name };
  }
  const route = expeditionRoute(active.tier, active.route);
  const missing = stage === 'champion' ? ['champion'] : route.targets.filter(id => !active.completed.includes(id));
  const candidates = [...g.enemies.filter(e => !e.dead), ...g.spots].filter(obj => missing.includes(obj.expeditionId));
  const player = g.player.pos;
  let point = null;
  let nearest = Infinity;
  for (const obj of candidates) {
    const pos = obj.pos || obj;
    const distance = Math.hypot(pos.x - player.x, pos.z - player.z);
    if (distance >= nearest) continue;
    nearest = distance;
    point = { x: pos.x, z: pos.z, label: obj.expeditionName || obj.label || '遠征 · ' + route.title };
  }
  return point;
}

export function completeMeadowObjective(g, objective, partBroken = false) {
  const { active } = meadowExpedition(g.meta.p);
  const def = MEADOW_TIERS[active?.tier];
  if (!def || g.field !== def.field || !recordMeadowObjective(g.meta.p, objective, partBroken)) return false;
  g.meta.save();
  const stage = meadowStage(active);
  if (stage === 'champion') {
    g.ui.banner(def.champion + '現身', def.tactics);
    syncMeadowExpedition(g);
  } else if (stage === 'reward') {
    g.ui.banner('遠征完成', '打開任務選擇寶石，並領取鑰石。');
  } else g.ui.toast('遠征進度已記錄', '#ffd885');
  return true;
}
