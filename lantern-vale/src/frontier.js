import * as THREE from 'three';
import { BIOMES, mulberry32 } from './util.js';
import { makeItem, serializeItem, deserializeItem } from './loot.js';
import { ALL_GEMS, addGemToBag } from './puzzle.js';
import { spawnSkyFeatures, startGatherMini, openHighChest, FIELD_NPCS } from './world_alive.js';
import { buildZoneLandmarks } from './harbor.js';
import { addGearToBag } from './physbag.js';

export const GOODS = { wood: '香杉木', ore: '星紋礦', fish: '溪銀魚' };
export const FIELDS = [
  null,
  { name: '晨光草原', level: 1, biome: 0, size: 240, beast: 'slime', dungeon: '草原洞窟', status: 'poison' },
  { name: '低語森林', level: 5, biome: 1, size: 360, beast: 'thorn', dungeon: '古木樹洞', grass: 0x719456, status: 'poison' },
  { name: '霧潮沼澤', level: 10, biome: 0, size: 240, beast: 'moth', dungeon: '沼澤遺跡', grass: 0x718c6f, fog: 0xa1b9ad, status: 'poison' },
  { name: '霜冬雪原', level: 15, biome: 2, size: 360, beast: 'boar', dungeon: '寒霜冰窟', fog: 0xdde8f4, status: 'freeze' },
  { name: '燼煙火岩區', level: 20, biome: 3, size: 240, beast: 'boar', dungeon: '燼岩熔爐', grass: 0xad7153, status: 'burn' },
  { name: '古樹林', level: 25, biome: 1, size: 400, beast: 'thorn', dungeon: '鹿王樹心', grass: 0x477252, status: 'poison' },
  { name: '浮空遺跡群', level: 12, biome: 0, size: 320, beast: 'skyray', dungeon: '星穹古塔', grass: 0x7bc87a, status: 'shock' },
  { name: '珊瑚潮汐灣', level: 18, biome: 0, size: 320, beast: 'skyray', dungeon: '潮汐海蝕洞', grass: 0xe8d089, status: 'freeze' },
  { name: '沉沒電光都', level: 24, biome: 2, size: 320, beast: 'thorn', dungeon: '水沒變電塔', grass: 0x5c9ab0, fog: 0x7eb8d4, status: 'shock' },
  { name: '櫻花水都', level: 14, biome: 0, size: 320, beast: 'moth', dungeon: '櫻花水宮', grass: 0x8cc868, status: 'chill' },
  { name: '蒼穹巨環谷', level: 22, biome: 0, size: 360, beast: 'skyray', dungeon: '天環聖殿', grass: 0x74c668, status: 'shock' },
  { name: '紅楓工坊谷', level: 28, biome: 1, size: 360, beast: 'golem', dungeon: '紅楓鍛造爐', grass: 0x98b44c, status: 'burn' },
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
  const mult = (g.isNight ? 1.25 : 1) * (p.guildName ? 1.1 : 1);
  p.xp += Math.round((10 + level * (enemy.elite ? 4 : 2)) * mult);
  p.coins += enemy.elite ? 5 : 2;
  p.species[enemy.type] = (p.species[enemy.type] || 0) + 1;
  if (g.field && FIELD_NPCS[g.field]) {
    const qid = FIELD_NPCS[g.field].quest.id;
    p.fieldQuests = p.fieldQuests || {};
    const st = p.fieldQuests[qid] || { have: 0, done: false };
    if (!st.done) { st.have++; p.fieldQuests[qid] = st; }
  }
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
    if (enemy.spawnIndex != null) p.timers[g.field + ':mob:' + enemy.spawnIndex] = Date.now() + (enemy.legendary ? 90000 : 16000);
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
  } else if (kind.startsWith('shrine_')) {
    const col = kind === 'shrine_fury' ? 0xff6a38 : kind === 'shrine_frost' ? 0x62d8ff : 0xffd84a;
    part(new THREE.CylinderGeometry(0.75, 0.9, 0.32, 6), 0x8a857e, 0.16);
    part(new THREE.BoxGeometry(0.68, 1.95, 0.68), 0xaba59b, 1.15);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshBasicMaterial({ color: col }));
    crystal.position.y = 2.55; group.add(crystal);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 18), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.userData.noNormal = true; group.add(ring);
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
export function setupField(g, restored = false) {
  const f = FIELDS[g.field], r = mulberry32(919 + g.field);
  // 記錄已探索區域（供坐騎里程碑解鎖判定）
  g.meta.p.visitedFields = g.meta.p.visitedFields || [];
  if (!g.meta.p.visitedFields.includes(g.field)) { g.meta.p.visitedFields.push(g.field); g.meta.save(); }
  // 高密度刷怪爽感：9–13 個魔物聚落（每群 5–8 隻＋精英頭領，總計 55–95 隻魔物！）
  const campCount = f.size >= 360 ? 13 : f.size >= 300 ? 11 : 9;
  const spawns = [];
  for (let c = 0; c < campCount; c++) {
    const center = g.world.randomWalkable(r, g.player.pos, 12);
    const packSize = 5 + Math.floor(r() * 4);
    for (let k = 0; k < packSize; k++) {
      const ang = (k / packSize) * Math.PI * 2 + r() * 0.55;
      const dist = k === 0 ? 0 : 1.8 + r() * 3.8;
      const px = center.x + Math.cos(ang) * dist, pz = center.z + Math.sin(ang) * dist;
      const valid = g.world.isLand(px, pz) ? { x: px, z: pz } : center;
      spawns.push({ ...valid, campLeader: k === 0, dense: true });
    }
  }
  for (let s = 0; s < 8; s++) spawns.push({ ...g.world.randomWalkable(r, g.player.pos, 11), campLeader: false });
  spawns.push({ ...g.world.randomWalkable(r, g.player.pos, 26), legendary: true });
  g.fieldSpawns = spawns;
  for (const kind of Object.keys(GOODS)) {
    const count = f.size >= 320 ? 5 : 3;
    for (let n = 0; n < count; n++) {
      const point = g.world.randomWalkable(r, g.player.pos, 6 + n * 12);
      const verb = { wood: '砍伐', ore: '開採', fish: '垂釣' }[kind];
      addSpot(g, kind, verb + GOODS[kind], point.x, point.z);
    }
  }
  // 野外遠古祝福石碑（狂暴火碑／寒霜冰碑／黃金財富碑，互動獲得 25 秒強力祝福）
  const shrines = [
    ['shrine_fury', '🔥 遠古狂暴石碑（25秒 傷害+45% · 移速+20%）'],
    ['shrine_frost', '❄️ 遠古寒霜石碑（凍結周圍魔物 · 25秒 寒霜附魔）'],
    ['shrine_gold', '💰 遠古財富石碑（立即灑落金幣寶石 · 25秒 雙倍掉寶）'],
  ];
  shrines.forEach(([sk, lbl], idx) => {
    const pt = g.world.randomWalkable(r, g.player.pos, 18 + idx * 14);
    addSpot(g, sk, lbl, pt.x, pt.z);
  });
  const grave = g.meta.p.graves[g.field];
  if (grave) addSpot(g,'grave','取回墓碑素材',grave.x,grave.z);
  spawnSkyFeatures(g);
  buildZoneLandmarks(g);
  g.fieldClock = restored ? 1 : 0; g.dueling = false;
  g.ui.banner(f.name, restored ? '【常駐區域 · 已延續先前探索進度】' : `【常駐超大地圖】Lv.${f.level}+ · ${spawns.length} 隻魔物聚落出沒`);
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
    if (g.scene.fog && g.scene.fog.isFog) { g.scene.fog.near = active ? 28 : 38; g.scene.fog.far = active ? 88 : 112; }
  }
  g.fieldSpawns.forEach((pos,i) => {
    if (g.enemies.some(e => !e.dead && e.spawnIndex === i) || g.meta.p.timers[g.field + ':mob:' + i] > now) return;
    const legendary = !!pos.legendary;
    const isSky = !legendary && (f.beast === 'skyray' || i % 5 === 2);
    const isElite = legendary || !!pos.campLeader;
    const e = g.spawnEnemy(legendary ? 'stag' : isSky ? 'skyray' : f.beast, pos, isElite);
    e.spawnIndex = i; e.legendary = legendary; e.level = Math.min(30, f.level + Math.floor(i / 4));
    e.statusAffinity = f.status || 'poison';
    const rankScale=1+(e.level-f.level)*.08;
    e.hp=Math.ceil(e.hp*rankScale);e.maxHp=e.hp;e.dmg*=rankScale;
    if (legendary) g.ui.bossBar(true, f.name + '守護獸');
  });
  for (const spot of g.spots) if (GOODS[spot.kind]) spot.mesh.visible = !(g.meta.p.timers[g.field + ':' + spot.kind] > now);
}
export function useFieldSpot(g,s) {
  const p = g.meta.p;
  if (s.kind.startsWith('shrine_')) {
    s.mesh.visible = false;
    g.shrineBuffs = g.shrineBuffs || { fury: 0, frost: 0, gold: 0, sheep: 0 };
    if (s.kind === 'shrine_fury') {
      g.shrineBuffs.fury = 25;
      g.audio.sfx('meteor');
      g.fx.burst(s.x, 1.5, s.z, 24, { c: [0xff6a38, 0xffd85a, 0xffffff], s: 0.14, speed: 6, up: 4, life: 0.65 });
      g.ui.toast('🔥 獲得遠古狂暴祝福！25 秒內傷害 +45% · 移速 +20%', '#ff8c4a');
    } else if (s.kind === 'shrine_frost') {
      g.shrineBuffs.frost = 25;
      g.audio.sfx('nova');
      g.shockRing(s.x, s.z, 12, g.rollDamage(1.8), 0x7ae8ff, 1.2, { slow: 4.5 });
      for (const e of g.enemies) if (!e.dead && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 12) { e.statuses = e.statuses || {}; e.statuses.freeze = 3.2; }
      g.ui.toast('❄️ 寒霜石碑爆發！周圍魔物全數冰凍 · 25 秒寒霜附魔', '#7ae8ff');
    } else {
      g.shrineBuffs.gold = 25;
      p.coins += 18; p.shards += 12;
      const pool = Object.keys(ALL_GEMS); const gid = pool[Math.floor(Math.random() * pool.length)];
      addGemToBag(p, gid); g.meta.save();
      g.audio.sfx('win');
      g.fx.burst(s.x, 1.6, s.z, 28, { c: [0xffd84a, 0xfff6c0, 0xc08cff], s: 0.14, speed: 6, up: 5, life: 0.75 });
      g.ui.toast(`💰 財富石碑降臨！金幣 +18 · 星砂 +12 · 寶石「${ALL_GEMS[gid].name}」`, '#ffd85a');
    }
    return true;
  }
  if (s.kind === 'chest') return openHighChest(g, s);
  if (s.kind === 'field_quest') {
    g._activeFieldNpc = s.npcDef;
    if (s.bot) { s.bot.tf = Math.atan2(g.player.pos.x - s.bot.x, g.player.pos.z - s.bot.z); s.bot.wait = 6; }
    g.audio.sfx('ui'); g.ui.openPanel('field_quest'); return true;
  }
  if (s.kind === 'grave') {
    const grave = p.graves[g.field]; if (!grave) return false;
    for (const kind of Object.keys(GOODS)) p.goods[kind] += grave.goods[kind];
    delete p.graves[g.field]; s.mesh.visible = false; g.spots = g.spots.filter(it => it.mesh !== s.mesh);
    g.ui.toast('已取回墓碑中的素材', '#ffe08a');
    g.meta.save(); return true;
  } else {
    const key = g.field + ':' + s.kind;
    if (!GOODS[s.kind] || p.timers[key] > Date.now() || g.gatherActive) return false;
    const collect = (perfect) => {
      const base = (g.worldEvent ? 4 : 3) + (p.guildName ? 1 : 0);
      const yieldCount = perfect ? base * 2 : base;
      p.goods[s.kind] += yieldCount; p.timers[key] = Date.now() + 30000; s.mesh.visible = false;
      if (perfect) {
        p.coins += 5;
        if (s.kind === 'ore' && Math.random() < 0.5) {
          const pool = Object.keys(ALL_GEMS); const gid = pool[Math.floor(Math.random() * pool.length)];
          addGemToBag(p, gid); g.ui.toast(`✨ 完美採集！${GOODS[s.kind]} +${yieldCount} · 寶石「${ALL_GEMS[gid].name}」`, '#ffd85a');
        } else {
          g.ui.toast(`✨ 完美採集！${GOODS[s.kind]} +${yieldCount} · 金幣 +5`, '#ffd85a');
        }
      } else {
        g.ui.toast(GOODS[s.kind] + ' +' + yieldCount, '#ffe08a');
      }
      if (g.field === 1 && FIELD_NPCS[1]) {
        p.fieldQuests = p.fieldQuests || {};
        const st = p.fieldQuests.q_f1 || { have: 0, done: false };
        if (!st.done) { st.have++; p.fieldQuests.q_f1 = st; }
      }
      g.meta.save();
    };
    if (typeof document !== 'undefined' && document.getElementById('gatherMini')) {
      g.player.swing = 1; g.player.swingT = 0.25;
      startGatherMini(g, s, collect);
    } else {
      collect(false);
    }
    return true;
  }
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
  const old = g.player.equip[it.slot];
  if (old) addGearToBag(p, old);
  g.player.equip[it.slot] = it; rememberGear(g); g.recalc(); return it.name;
}
