import * as THREE from 'three';
import { BIOMES, mulberry32 } from './util.js';
import { makeItem, serializeItem, deserializeItem } from './loot.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';

export const GOODS = { wood: '香杉木', ore: '星紋礦', fish: '溪銀魚' };
export const FIELDS = [
  null,
  { name: '晨光草原', level: 1, biome: 0, size: 60, beast: 'slime', dungeon: '草原洞窟' },
  { name: '低語森林', level: 5, biome: 1, size: 100, beast: 'thorn', dungeon: '古木樹洞', grass: 0x719456 },
  { name: '霧潮沼澤', level: 10, biome: 0, size: 60, beast: 'moth', dungeon: '沼澤遺跡', grass: 0x718c6f, fog: 0xa1b9ad },
  { name: '霜冬雪原', level: 15, biome: 2, size: 100, beast: 'boar', dungeon: '寒霜冰窟', fog: 0xdde8f4 },
  { name: '燼煙火岩區', level: 20, biome: 3, size: 60, beast: 'boar', dungeon: '燼岩熔爐', grass: 0xad7153 },
  { name: '古樹林', level: 25, biome: 1, size: 100, beast: 'thorn', dungeon: '鹿王樹心', grass: 0x477252 },
];
export const progressDefaults = {
  level: 1, xp: 0, coins: 15, keys: 1, goods: { wood: 0, ore: 0, fish: 0 }, graves: {}, timers: {},
  gear: {}, species: {}, home: 0, mealUntil: 0, weapon: 'staff', gem: false, sales: [],
};
export function rememberGear(g) {
  g.meta.p.gear = Object.fromEntries(Object.entries(g.player.equip).map(([slot,it]) => [slot, serializeItem(it)]));
  g.meta.save();
}
export function restoreGear(g, player) {
  for (const [slot, item] of Object.entries(g.meta.p.gear)) {
    if (item && Object.hasOwn(player.equip, slot)) player.equip[slot] = deserializeItem(item);
  }
}
export function awardKill(g, enemy) {
  const p = g.meta.p;
  const level = enemy.level || Math.min(30, g.depth * 2 + 1);
  p.xp += 10 + level * (enemy.elite ? 4 : 2);
  p.coins += enemy.elite ? 5 : 2;
  p.species[enemy.type] = (p.species[enemy.type] || 0) + 1;
  while (p.level < 30 && p.xp >= p.level * 40) {
    p.xp -= p.level * 40; p.level++;
    g.ui.toast('旅人等級提升至 ' + p.level, '#ffdc80'); g.recalc();
  }
  if (p.level === 30) p.xp = 0;
  if (g.field) {
    const material = ['wood','ore','fish'][(enemy.spawnIndex ?? 0) % 3];
    p.goods[material] += enemy.elite ? 3 : 1;
    if (enemy.elite || enemy.legendary) {
      p.keys++;
      const pool = Object.keys(ALL_GEMS);
      const gemId = pool[Math.floor(Math.random() * pool.length)];
      addGemToBag(p, gemId);
      g.ui.toast(`獲得拼圖寶石：${ALL_GEMS[gemId].name}`, '#c08cff');
    }
    g.ui.toast(GOODS[material] + (enemy.elite ? ' +3 · 鑰石 +1' : ' +1'), '#ffe5a5');
    if (enemy.spawnIndex != null) p.timers[g.field + ':mob:' + enemy.spawnIndex] = Date.now() + (enemy.legendary ? 120000 : 25000);
  }
  g.meta.save();
}
export function fieldBiome(i) {
  const field = FIELDS[i], base = BIOMES[field.biome];
  return { ...base, name: field.name, grass: field.grass ?? base.grass };
}
function marker(kind) {
  const group = new THREE.Group();
  const part = (geometry, color, y) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, flatShading: true }));
    mesh.position.y = y; group.add(mesh); return mesh;
  };
  if (kind === 'wood') {
    part(new THREE.CylinderGeometry(.18,.24,1.5,6),0x835638,.75);
    part(new THREE.ConeGeometry(.95,2.1,7),0x527f56,1.8);
  } else if (kind === 'ore') {
    part(new THREE.IcosahedronGeometry(.8,0),0x82788f,.4);
    part(new THREE.OctahedronGeometry(.4),0xa9d3c9,1);
  } else if (kind === 'fish') {
    part(new THREE.CylinderGeometry(.9,1,.18,10),0x62aaa8,.12);
    part(new THREE.SphereGeometry(.28,6,4),0xe4c77f,.35).scale.set(1.6,.5,.7);
  } else {
    part(new THREE.BoxGeometry(.95,1.3,.42),0x76767b,.65);
    part(new THREE.OctahedronGeometry(.28),0xffd268,1.55);
  }
  return group;
}
function addSpot(g, kind, label, x, z) {
  const mesh = marker(kind);
  mesh.position.set(x, g.world.gh(x,z), z); g.world.group.add(mesh);
  g.spots.push({ kind, label, x, z, mesh, top: mesh.position.y + 2 });
}
export function setupField(g) {
  const f = FIELDS[g.field], r = mulberry32(919 + g.field);
  g.fieldSpawns = Array.from({length: 7}, () => g.world.randomWalkable(r, g.player.pos, 8));
  for (const kind of Object.keys(GOODS)) {
    const point = g.world.randomWalkable(r, g.player.pos, 3);
    const verb = { wood: '砍伐', ore: '開採', fish: '垂釣' }[kind];
    addSpot(g, kind, verb + GOODS[kind], point.x, point.z);
  }
  const grave = g.meta.p.graves[g.field];
  if (grave) addSpot(g,'grave','取回墓碑素材',grave.x,grave.z);
  g.fieldClock = 0; g.dueling = false;
  g.ui.banner(f.name,'常駐地區 · 等級 ' + f.level + ' 起');
}
export function tickField(g, dt) {
  g.fieldClock -= dt;
  if (g.fieldClock > 0) return;
  g.fieldClock = 1;
  const f = FIELDS[g.field], now = Date.now();
  const active = Math.floor(now / 60000) % 3 === g.field % 3;
  if (active !== g.worldEvent) {
    g.worldEvent = active;
    if (active) g.ui.toast(g.field===4?'暴風雪來臨 · 採集量提升':'山谷豐收 · 採集量提升', '#fff1ae');
    if (g.scene.fog) g.scene.fog.density=active?.052:.025;
  }
  g.fieldSpawns.forEach((pos,i) => {
    if (g.enemies.some(e => !e.dead && e.spawnIndex === i) || g.meta.p.timers[g.field + ':mob:' + i] > now) return;
    const legendary = i === 6;
    const e = g.spawnEnemy(legendary ? 'stag' : f.beast, pos, i >= 5);
    e.spawnIndex = i; e.legendary = legendary; e.level = Math.min(30, f.level + Math.floor(i / 2));
    const rankScale=1+(e.level-f.level)*.08;
    e.hp=Math.ceil(e.hp*rankScale);e.maxHp=e.hp;e.dmg*=rankScale;
    if (legendary) g.ui.bossBar(true, f.name + '守護獸');
  });
  for (const spot of g.spots) if (GOODS[spot.kind]) spot.mesh.visible = !(g.meta.p.timers[g.field + ':' + spot.kind] > now);
}
export function useFieldSpot(g,s) {
  const p = g.meta.p;
  if (s.kind === 'grave') {
    const grave = p.graves[g.field]; if (!grave) return false;
    for (const kind of Object.keys(GOODS)) p.goods[kind] += grave.goods[kind];
    delete p.graves[g.field]; s.mesh.visible = false; g.spots = g.spots.filter(it => it.mesh !== s.mesh);
    g.ui.toast('已取回墓碑中的素材', '#ffe08a');
  } else {
    const key = g.field + ':' + s.kind;
    if (!GOODS[s.kind] || p.timers[key] > Date.now()) return false;
    const yieldCount = g.worldEvent ? 4 : 3;
    p.goods[s.kind] += yieldCount; p.timers[key] = Date.now() + 30000; s.mesh.visible = false;
    g.ui.toast(GOODS[s.kind] + ' +' + yieldCount,'#ffe08a');
  }
  g.meta.save(); return true;
}
export function leaveGrave(g) {
  const p = g.meta.p, field = g.field || g.originField || 1;
  const goods = {};
  const kinds = Object.keys(GOODS);
  const target = Math.floor(kinds.reduce((sum, k) => sum + p.goods[k], 0) / 4);
  const losses = Object.fromEntries(kinds.map(k => [k, Math.floor(p.goods[k] / 4)]));
  let remainder = target - Object.values(losses).reduce((sum,n) => sum + n, 0);
  for (const k of [...kinds].sort((a,b) => p.goods[b]%4 - p.goods[a]%4)) {
    if (remainder-- <= 0) break;
    losses[k]++;
  }
  let total = 0;
  for (const kind of Object.keys(GOODS)) {
    const loss = losses[kind];
    p.goods[kind] -= loss; total += loss;
    goods[kind] = loss + (p.graves[field]?.goods[kind] || 0);
  }
  if (total) {
    const pos = g.field ? g.player.pos : {x:0,z:0};
    p.graves[field] = {x:pos.x,z:pos.z,goods};
  }
  rememberGear(g); return total;
}
export function craft(g) {
  const p = g.meta.p;
  if (p.goods.ore < 3 || p.goods.wood < 2) return false;
  p.goods.ore -= 3; p.goods.wood -= 2;
  const it = makeItem(Math.random, Math.floor(p.level / 3), 2);
  g.player.equip[it.slot] = it; rememberGear(g); g.recalc(); return it.name;
}
