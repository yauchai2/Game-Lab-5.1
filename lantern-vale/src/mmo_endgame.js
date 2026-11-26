import * as THREE from 'three';

// ============================================================================
// 1. 裝備潛能覺醒與魔方洗詞綴系統（R → SR → SSR → UR，終局刷寶驅動核心）
// ============================================================================
export const POTENTIAL_TIERS = {
  R:   { id: 'R',   name: 'R 級潛能',   color: '#7fb2ff', mult: 1.0, next: 'SR',  upChance: 0.34 },
  SR:  { id: 'SR',  name: 'SR 級潛能',  color: '#c88cff', mult: 1.5, next: 'SSR', upChance: 0.24 },
  SSR: { id: 'SSR', name: 'SSR 級潛能', color: '#ffd85a', mult: 2.2, next: 'UR',  upChance: 0.14 },
  UR:  { id: 'UR',  name: 'UR 神話潛能', color: '#ff5a88', mult: 3.1, next: null,  upChance: 0 },
};

export const POTENTIAL_LINE_POOL = [
  { k: 'dmgPct',     base: 8,  fmt: v => `全傷害 +${v}%` },
  { k: 'critMult',   base: 14, fmt: v => `暴擊傷害 +${v}%` },
  { k: 'maxHp',      base: 22, fmt: v => `最大生命 +${v}` },
  { k: 'atkSpd',     base: 6,  fmt: v => `攻擊速度 +${v}%` },
  { k: 'cdr',        base: 5,  fmt: v => `冷卻縮減 +${v}%` },
  { k: 'allRes',     base: 5,  fmt: v => `全元素抗性 +${v}%` },
  { k: 'bossDmgPct', base: 10, fmt: v => `對首領／精英傷害 +${v}%` },
  { k: 'xpBonus',    base: 8,  fmt: v => `經驗值獲取 +${v}%` },
];

export const POTENTIAL_SHARD_COST = 25;

export function rollPotential(profile, item, rng = Math.random) {
  if (!profile || !item) return { ok: false, reason: '無裝備可覺醒潛能' };
  if (item.bricked) return { ok: false, reason: '已碎裂裝備無法洗鍊潛能' };
  const cubes = Math.max(0, profile.cubes || 0);
  const usedCube = cubes >= 1;
  if (!usedCube && (profile.shards || 0) < POTENTIAL_SHARD_COST) {
    return { ok: false, reason: `需要 🎲1 顆潛能魔方 或 💎${POTENTIAL_SHARD_COST} 星砂` };
  }
  if (usedCube) profile.cubes = cubes - 1;
  else profile.shards = (profile.shards || 0) - POTENTIAL_SHARD_COST;

  const prevTier = item.potential?.tier || null;
  let tier = prevTier || (rng() < 0.22 ? 'SR' : 'R');
  let tierUp = !prevTier;
  if (prevTier) {
    const curDef = POTENTIAL_TIERS[prevTier] || POTENTIAL_TIERS.R;
    if (curDef.next && rng() < curDef.upChance) {
      tier = curDef.next;
      tierUp = true;
    }
  }
  const tDef = POTENTIAL_TIERS[tier];
  const pool = [...POTENTIAL_LINE_POOL];
  const lines = [];
  for (let i = 0; i < 2 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length) % pool.length;
    const pickDef = pool.splice(idx, 1)[0];
    const v = Math.max(1, Math.round(pickDef.base * tDef.mult * (0.85 + rng() * 0.3)));
    lines.push({ k: pickDef.k, v, label: pickDef.fmt(v) });
  }
  item.potential = { tier, lines };
  const costTxt = usedCube ? '🎲潛能魔方×1' : `💎星砂×${POTENTIAL_SHARD_COST}`;
  const headline = !prevTier
    ? `✨ 潛能覺醒！【${tDef.name}】`
    : tierUp
      ? `🎉 潛能突破升階！${prevTier} → 【${tDef.name}】！`
      : `🎲 潛能洗鍊完成【${tDef.name}】`;
  return {
    ok: true, usedCube, tierUp, prevTier, tier, potential: item.potential,
    msg: `${headline}（消耗 ${costTxt}）`,
  };
}

export function formatPotentialLines(pot) {
  if (!pot || !pot.tier || !Array.isArray(pot.lines)) return [];
  const tDef = POTENTIAL_TIERS[pot.tier] || POTENTIAL_TIERS.R;
  return pot.lines.map(l => ({
    t: `🎲 [${tDef.id} 潛能] ${l.label || `${l.k} +${l.v}`}`,
    special: true,
    color: tDef.color,
  }));
}

export function computePotentialBonuses(equip = {}) {
  const stats = { bossDmgPct: 0, xpBonus: 0 };
  let awakenedCount = 0;
  let urCount = 0;
  for (const it of Object.values(equip || {})) {
    const pot = it?.potential;
    if (!pot || !Array.isArray(pot.lines)) continue;
    awakenedCount++;
    if (pot.tier === 'UR') urCount++;
    for (const l of pot.lines) {
      stats[l.k] = (stats[l.k] || 0) + (l.v || 0);
    }
  }
  return { stats, awakenedCount, urCount };
}

// ============================================================================
// 2. 野外 4 大動態隨機奇遇事件（Dynamic World Events / FATEs）
// ============================================================================
export const DYNAMIC_EVENTS = {
  goblin: {
    id: 'goblin', icon: '🪙', name: '寶藏哥布林逃竄', color: 0xffd85a, duration: 30,
    desc: '在寶藏哥布林逃入傳送門前將其擊倒，奪取滿袋金幣與潛能魔方！',
    reward: { coins: 380, shards: 65, cubes: 2, charms: 0, rep: 35, xp: 140 },
  },
  rift: {
    id: 'rift', icon: '🔮', name: '星核裂隙防衛戰', color: 0xc88cff, duration: 55,
    desc: '清除從星核裂隙湧出的魔物與精英守衛，封印裂隙領取秘寶！',
    reward: { coins: 300, shards: 55, cubes: 1, charms: 0, rep: 40, xp: 170 },
  },
  gold_slime: {
    id: 'gold_slime', icon: '🍄', name: '黃金史萊姆王國', color: 0xffe46b, duration: 48,
    desc: '大量黃金史萊姆聚集野外！清光整群即可獲得巨額金幣與星砂！',
    reward: { coins: 360, shards: 50, cubes: 1, charms: 0, rep: 30, xp: 150 },
  },
  dual_elite: {
    id: 'dual_elite', icon: '⚔️', name: '精英雙王決鬥場', color: 0xff6848, duration: 65,
    desc: '兩隻高危詞綴精英同時降臨！擊敗雙王贏得雙倍魔方與保護符！',
    reward: { coins: 440, shards: 80, cubes: 2, charms: 1, rep: 55, xp: 220 },
  },
};
export const DYNAMIC_EVENT_IDS = Object.keys(DYNAMIC_EVENTS);

export function createDynEventState() {
  return { active: false, def: null, targets: [], timer: 88, timeLeft: 0, total: 0, killed: 0 };
}

function addEventHalo(enemy, color, radius = 1.15) {
  if (!enemy?.m?.root) return;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 22),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.userData.noNormal = true;
  enemy.m.root.add(ring);
}

export function spawnDynamicEvent(g, forcedId = null) {
  if (!g || !g.field || !g.world || !g.player || g.interior) return null;
  g.dynEvent = g.dynEvent || createDynEventState();
  if (g.dynEvent.active) return g.dynEvent;

  const id = (forcedId && DYNAMIC_EVENTS[forcedId])
    ? forcedId
    : DYNAMIC_EVENT_IDS[Math.floor(Math.random() * DYNAMIC_EVENT_IDS.length)];
  const def = DYNAMIC_EVENTS[id];
  const targets = [];

  const pickSpot = (distMin = 7, distMax = 13) => {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = distMin + Math.random() * (distMax - distMin);
      const sx = g.player.pos.x + Math.cos(a) * d;
      const sz = g.player.pos.z + Math.sin(a) * d;
      if (g.world.isLand(sx, sz)) return { x: sx, z: sz };
    }
    return g.world.randomWalkable(Math.random, g.player.pos, 9);
  };

  if (id === 'goblin') {
    const pt = pickSpot(8, 12);
    const e = g.spawnEnemy('slime', pt, false);
    e.hp = Math.round(e.hp * 4.5);
    e.maxHp = e.hp;
    e.spd = Math.max(e.spd || 3.2, 4.4);
    e.m.root.scale.multiplyScalar(1.35);
    e.isDynEvent = id;
    e.isTreasureGoblin = true;
    addEventHalo(e, def.color, 1.35);
    targets.push(e);
  } else if (id === 'rift') {
    const types = ['thorn', 'moth', 'boar', 'skyray', 'slime'];
    for (let i = 0; i < 5; i++) {
      const e = g.spawnEnemy(types[i % types.length], pickSpot(7, 13), false);
      e.isDynEvent = id;
      addEventHalo(e, def.color, 0.95);
      targets.push(e);
    }
    const el = g.spawnEnemy('golem', pickSpot(9, 13), true);
    el.isDynEvent = id;
    addEventHalo(el, def.color, 1.45);
    targets.push(el);
  } else if (id === 'gold_slime') {
    for (let i = 0; i < 8; i++) {
      const e = g.spawnEnemy('slime', pickSpot(6, 13), false);
      e.hp = Math.round(e.hp * 1.15);
      e.maxHp = e.hp;
      e.m.root.scale.multiplyScalar(1.12);
      e.isDynEvent = id;
      addEventHalo(e, def.color, 0.95);
      targets.push(e);
    }
  } else if (id === 'dual_elite') {
    const elitePool = ['boar', 'golem', 'moth', 'skyray'];
    for (let i = 0; i < 2; i++) {
      const t = elitePool[Math.floor(Math.random() * elitePool.length)];
      const e = g.spawnEnemy(t, pickSpot(8, 12), true);
      e.isDynEvent = id;
      addEventHalo(e, def.color, 1.5);
      targets.push(e);
    }
  }

  g.dynEvent = {
    active: true, def, targets, timer: 95, timeLeft: def.duration,
    total: targets.length, killed: 0,
  };
  for (const t of targets.slice(0, 3)) {
    g.vfx?.spawnEnemyCircle(t.pos.x, t.pos.y || 0, t.pos.z, id === 'dual_elite' ? 'fire' : 'arcane', 1.1);
    g.vfx?.spawnMaliceRift(t.pos.x, t.pos.y || 0, t.pos.z, id === 'dual_elite' ? 'fire' : 'death');
  }
  g.audio?.sfx?.('tideHorn');
  g.ui?.banner?.(`${def.icon} 野外奇遇：${def.name}！`, def.desc);
  g.ui?.chat?.(`[野外奇遇] ${def.icon} ${def.name} 正在附近發生！（剩餘 ${def.duration} 秒）`);
  return g.dynEvent;
}

export function onDynEventEnemyKilled(g, enemy) {
  if (!enemy?.isDynEvent || !g?.dynEvent?.active) return null;
  const ev = g.dynEvent;
  if (ev.def?.id !== enemy.isDynEvent) return null;
  ev.killed++;
  if (ev.killed < ev.total) return null;

  const r = ev.def.reward;
  const p = g.meta?.p;
  if (p) {
    p.coins = (p.coins || 0) + r.coins;
    p.shards = (p.shards || 0) + r.shards;
    p.cubes = (p.cubes || 0) + r.cubes;
    p.protectCharms = (p.protectCharms || 0) + (r.charms || 0);
    p.guildRep = (p.guildRep || 0) + (r.rep || 0);
    p.dynEventsCleared = (p.dynEventsCleared || 0) + 1;
    g.grantXp?.(r.xp || 120);
    g.meta.save();
  }
  g.audio?.sfx?.('win');
  g.ui?.banner?.(
    `✨ 奇遇完成：${ev.def.icon} ${ev.def.name}！`,
    `🪙+${r.coins} · 💎+${r.shards} · 🎲潛能魔方+${r.cubes}${r.charms ? ` · 🛡️保護符+${r.charms}` : ''}`,
  );
  g.ui?.chat?.(`[野外奇遇] 你成功完成了【${ev.def.name}】，獲得 🎲潛能魔方×${r.cubes}！`);
  g.dynEvent = createDynEventState();
  return r;
}

export function tickDynamicEvent(g, dt) {
  if (!g || !g.field || g.state !== 'play' || g.interior) return;
  g.dynEvent = g.dynEvent || createDynEventState();
  const ev = g.dynEvent;
  if (ev.active) {
    ev.timeLeft -= dt;
    // 寶藏哥布林逃跑 AI：遠離玩家並沿途灑金光粒子
    if (ev.def?.id === 'goblin' && g.player) {
      for (const t of ev.targets) {
        if (!t || t.dead) continue;
        const dx = t.pos.x - g.player.pos.x;
        const dz = t.pos.z - g.player.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < 14) {
          const nx = t.pos.x + (dx / d) * 3.8 * dt;
          const nz = t.pos.z + (dz / d) * 3.8 * dt;
          if (g.world.isLand(nx, nz)) {
            t.pos.x = nx;
            t.pos.z = nz;
            t.pos.y = g.world.gh(nx, nz);
          }
        }
      }
    }
    const alive = ev.targets.filter(t => t && !t.dead);
    if (!alive.length) {
      ev.active = false;
      ev.timer = 95;
      return;
    }
    if (ev.timeLeft <= 0) {
      for (const t of alive) {
        t.dead = true;
        if (t.m?.root) g.scene?.remove(t.m.root);
      }
      g.ui?.toast?.(`💨 野外奇遇【${ev.def.name}】已結束，下次把握機會！`);
      g.dynEvent = createDynEventState();
    }
    return;
  }
  ev.timer -= dt;
  if (ev.timer <= 0) {
    spawnDynamicEvent(g);
  }
}

// ============================================================================
// 3. 50 層無盡試煉秘境塔（Endless Trial Tower 1F → 50F）
// ============================================================================
export const MAX_TOWER_FLOOR = 50;

export function towerFloorSpec(floor = 1) {
  const f = Math.max(1, Math.min(MAX_TOWER_FLOOR, Math.floor(floor || 1)));
  const isBoss = f % 5 === 0;
  const hpScale = +(1 + (f - 1) * 0.14).toFixed(2);
  const dmgScale = +(1 + (f - 1) * 0.08).toFixed(2);
  const waves = isBoss
    ? [{ boss: true, n: 2 + Math.min(4, Math.floor(f / 10)) }]
    : [
        { n: 4 + Math.min(6, Math.floor(f / 5)) },
        { n: 3 + Math.min(6, Math.floor(f / 6)), elite: f >= 3 },
      ];
  return {
    floor: f,
    isBoss,
    title: isBoss ? `🗼 試煉之塔 第 ${f} 層【守護首領】` : `🗼 試煉之塔 第 ${f} 層`,
    hpScale,
    dmgScale,
    waves,
    firstReward: {
      coins: 120 + f * 38,
      shards: 20 + f * 7,
      cubes: isBoss ? 3 : 1,
      charms: isBoss ? 1 : 0,
      rep: isBoss ? 45 : 15,
    },
    repeatReward: {
      coins: 45 + f * 12,
      shards: 8 + f * 2,
      cubes: isBoss ? 1 : 0,
      charms: 0,
      rep: 8,
    },
  };
}

export function computeTowerBonuses(profile) {
  const best = Math.max(0, Math.min(MAX_TOWER_FLOOR, Math.floor(profile?.towerBest || 0)));
  return {
    best,
    dmgPct: +(best * 1.5).toFixed(1),
    maxHp: best * 6,
  };
}

export function claimTowerFloorClear(profile, floor) {
  if (!profile) return { ok: false };
  const spec = towerFloorSpec(floor);
  const prevBest = Math.max(0, Math.floor(profile.towerBest || 0));
  const firstClear = spec.floor > prevBest;
  if (firstClear) profile.towerBest = spec.floor;
  const reward = firstClear ? spec.firstReward : spec.repeatReward;
  profile.coins = (profile.coins || 0) + reward.coins;
  profile.shards = (profile.shards || 0) + reward.shards;
  profile.cubes = (profile.cubes || 0) + reward.cubes;
  profile.protectCharms = (profile.protectCharms || 0) + (reward.charms || 0);
  profile.guildRep = (profile.guildRep || 0) + (reward.rep || 0);
  return {
    ok: true,
    floor: spec.floor,
    isBoss: spec.isBoss,
    firstClear,
    reward,
    towerBest: profile.towerBest || prevBest,
    nextFloor: spec.floor < MAX_TOWER_FLOOR ? spec.floor + 1 : null,
  };
}

// ============================================================================
// 4. 3 人 MMORPG 冒險小隊編成與三大陣型光環（玩家＋最多 2 名 AI 隊友同時出戰！）
// ============================================================================
export const MAX_PARTY_COMPANIONS = 2;

export const PARTY_SYNERGIES = [
  { id: 'bastion', pair: ['vanguard', 'healer'], icon: '🛡️', name: '聖盾不滅陣', desc: '減傷 +10% · 每秒回血 +3', bonuses: { armor: 10, regen: 3 } },
  { id: 'assault', pair: ['vanguard', 'ranger'], icon: '⚔️', name: '破陣強襲陣', desc: '全傷害 +14% · 暴擊率 +6%', bonuses: { dmgPct: 14, crit: 6 } },
  { id: 'zephyr',  pair: ['healer', 'ranger'],   icon: '🌟', name: '星風雙翼陣', desc: '攻速 +15% · 冷卻縮減 +10%', bonuses: { atkSpd: 15, cdr: 10 } },
];

export function getPartyIds(profile) {
  if (!profile) return [];
  if (Array.isArray(profile.partyCompanions)) {
    const clean = [...new Set(profile.partyCompanions.filter(Boolean))].slice(0, MAX_PARTY_COMPANIONS);
    profile.partyCompanions = clean;
    profile.companionId = clean[0] || null;
    return clean;
  }
  const init = profile.companionId ? [profile.companionId] : [];
  profile.partyCompanions = init;
  if (profile.companionId) {
    profile.ownedCompanions = Array.isArray(profile.ownedCompanions) ? profile.ownedCompanions : [];
    if (!profile.ownedCompanions.includes(profile.companionId)) profile.ownedCompanions.push(profile.companionId);
  }
  return init;
}

export function togglePartyMember(profile, cid, cost = 120) {
  if (!profile || !cid) return { ok: false, reason: '無效隊友' };
  const party = getPartyIds(profile);
  profile.ownedCompanions = Array.isArray(profile.ownedCompanions) ? profile.ownedCompanions : [];
  if (party.includes(cid)) {
    profile.partyCompanions = party.filter(x => x !== cid);
    profile.companionId = profile.partyCompanions[0] || null;
    return { ok: true, action: 'left', party: [...profile.partyCompanions], synergy: getActivePartySynergy(profile) };
  }
  const alreadyOwned = profile.ownedCompanions.includes(cid);
  if (!alreadyOwned) {
    if ((profile.coins || 0) < cost) return { ok: false, reason: `需要 🪙${cost} 金幣招募` };
    profile.coins -= cost;
    profile.ownedCompanions.push(cid);
  }
  const next = [...party];
  if (next.length >= MAX_PARTY_COMPANIONS) next.shift();
  next.push(cid);
  profile.partyCompanions = next;
  profile.companionId = next[0] || null;
  return { ok: true, action: 'joined', hired: !alreadyOwned, party: [...next], synergy: getActivePartySynergy(profile) };
}

export function getActivePartySynergy(profile) {
  const party = getPartyIds(profile);
  if (party.length < 2) return null;
  return PARTY_SYNERGIES.find(s => s.pair.every(id => party.includes(id))) || null;
}

export function computePartySynergyBonuses(profile) {
  const synergy = getActivePartySynergy(profile);
  return { synergy, bonuses: synergy ? { ...synergy.bonuses } : {} };
}

// ============================================================================
// 5. 離線修煉見聞收益（Offline Resting Rewards，最長累計 12 小時）
// ============================================================================
export function computeOfflineRewards(profile, nowMs = Date.now()) {
  if (!profile || !profile.lastSeenAt) return null;
  const elapsedSec = Math.floor((nowMs - profile.lastSeenAt) / 1000);
  if (elapsedSec < 60) return null;
  const cappedSec = Math.min(12 * 3600, elapsedSec);
  const mins = Math.floor(cappedSec / 60);
  const lv = Math.max(1, profile.level || 1);
  const tower = Math.max(0, profile.towerBest || 0);
  const coins = Math.round(mins * (2.5 + lv * 0.45 + tower * 0.35));
  const xp = Math.round(mins * (3.0 + lv * 0.5 + tower * 0.4));
  const shards = Math.max(1, Math.round(mins * (0.35 + tower * 0.05)));
  const ore = Math.floor(mins / 20);
  const cubes = mins >= 120 ? Math.min(3, Math.floor(mins / 120)) : 0;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const hoursText = hrs > 0 ? `${hrs} 小時 ${remMins} 分鐘` : `${mins} 分鐘`;
  return { mins, hoursText, coins, xp, shards, ore, cubes };
}

export function claimOfflineRewards(profile, nowMs = Date.now()) {
  if (!profile) return null;
  const res = computeOfflineRewards(profile, nowMs);
  profile.lastSeenAt = nowMs;
  if (!res) return null;
  profile.coins = (profile.coins || 0) + res.coins;
  profile.shards = (profile.shards || 0) + res.shards;
  profile.cubes = (profile.cubes || 0) + res.cubes;
  profile.mats = profile.mats || {};
  profile.mats.ore = (profile.mats.ore || 0) + res.ore;
  return res;
}
