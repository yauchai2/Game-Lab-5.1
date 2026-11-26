import * as THREE from 'three';
import { FIELDS } from './frontier.js';
import { tierPower } from './loot.js';

// ============================================================================
// 1. 高威脅精英詞綴系統（8 種立體壓迫詞綴：Lv.1+ 精英即帶 1 種，Lv.10+ 或 Wave 2+ 帶 2 種）
// ============================================================================
export const ELITE_AFFIXES = [
  { id: 'arcane_beam',    icon: '🔥', name: '旋轉熔岩柱', color: '#ff6a30', desc: '週期召喚三段掃描火焰雷射封鎖走位' },
  { id: 'frost_waller',   icon: '❄️', name: '冰霜牢籠',   color: '#7ae8ff', desc: '在玩家周圍升起寒霜牢籠（須跳躍翻越）' },
  { id: 'volatile_death', icon: '☠️', name: '死後劇毒爆', color: '#8cf07a', desc: '陣亡後 0.85 秒原地炸出致命劇毒新星' },
  { id: 'vampiric',       icon: '🩸', name: '鮮血汲取',   color: '#ff5268', desc: '命中玩家時回復自身 10% 最大生命' },
  { id: 'splitter',       icon: '⚡', name: '感電分身',   color: '#c88cff', desc: '血量低於 50% 時分裂出 2 隻強化分身' },
  { id: 'shielding',      icon: '🛡', name: '周期無敵盾', color: '#ffd85a', desc: '每 9 秒張開 2.8 秒減傷 80% 黃金護盾' },
  { id: 'mortar',         icon: '☄️', name: '隕石迫擊炮', color: '#ff8a48', desc: '向玩家預測落點拋射紅圈高傷隕石' },
  { id: 'vortex',         icon: '🌀', name: '重力牽引',   color: '#b07aff', desc: '週期釋放紫光衝擊波將玩家拉向身旁' },
];

export function assignEliteAffixes(enemy, level = 1, waveStreak = 1, rng = Math.random) {
  if (!enemy || !enemy.elite) return [];
  const count = (level >= 10 || waveStreak >= 2) ? 2 : 1;
  const pool = [...ELITE_AFFIXES];
  const picked = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  enemy.affixes = picked;
  enemy.affixCds = {};
  for (const a of picked) enemy.affixCds[a.id] = 1.6 + rng() * 1.8;
  enemy.affixSplitDone = false;
  enemy.shieldT = 0;
  return picked;
}

export function hasAffix(enemy, id) {
  return !!(enemy?.affixes && enemy.affixes.some(a => a.id === id));
}

export function tickEliteAffixes(g, e, dt, dist) {
  if (!e?.affixes?.length || e.dead || e.stun > 0) return;
  const p = g.player;
  if (!p) return;

  if (e.shieldT > 0) {
    e.shieldT = Math.max(0, e.shieldT - dt);
    if (e._shieldMesh) {
      e._shieldMesh.visible = e.shieldT > 0;
      e._shieldMesh.rotation.y += dt * 3;
    }
  }

  if (hasAffix(e, 'splitter') && !e.affixSplitDone && e.hp > 0 && e.hp <= e.maxHp * 0.5 && !e.isSplitClone) {
    e.affixSplitDone = true;
    g.ui.dmgNum(e.pos.x, g.world.gh(e.pos.x, e.pos.z) + 1.8, e.pos.z, '⚡ 分身!', 'comic');
    g.fx.burst(e.pos.x, 0.8, e.pos.z, 14, { c: [0xc88cff, 0xffffff], s: 0.14, speed: 5, up: 3, life: 0.45 });
    for (let k = -1; k <= 1; k += 2) {
      const sx = e.pos.x + k * 1.4, sz = e.pos.z + k * 0.9;
      if (!g.world.isLand(sx, sz)) continue;
      const cl = g.spawnEnemy(e.type === 'stag' ? 'boar' : e.type, { x: sx, z: sz }, false);
      if (cl) {
        cl.isSplitClone = true;
        cl.tideAggro = true;
        cl.hp = Math.max(24, Math.round(e.maxHp * 0.40));
        cl.maxHp = cl.hp;
        cl.dmg = Math.round(e.dmg * 0.85);
        cl.spd = e.spd * 1.18;
        cl.m.root.scale.setScalar(0.88);
      }
    }
  }

  if (dist > 18) return;

  for (const af of e.affixes) {
    if (af.id === 'volatile_death' || af.id === 'vampiric' || af.id === 'splitter') continue;
    e.affixCds[af.id] = (e.affixCds[af.id] ?? 2.2) - dt;
    if (e.affixCds[af.id] > 0) continue;

    if (af.id === 'shielding') {
      e.affixCds[af.id] = 9.0;
      e.shieldT = 2.8;
      if (!e._shieldMesh && e.m?.root) {
        const sh = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.85, e.r * 1.45), 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xffd85a, transparent: true, opacity: 0.34, wireframe: true }),
        );
        sh.position.y = 0.7;
        e.m.root.add(sh);
        e._shieldMesh = sh;
      }
      if (e._shieldMesh) e._shieldMesh.visible = true;
      g.ui.dmgNum(e.pos.x, g.world.gh(e.pos.x, e.pos.z) + 1.8, e.pos.z, '🛡 護盾', 'norm');
    } else if (af.id === 'mortar') {
      e.affixCds[af.id] = 3.8;
      const tx = p.pos.x + (p.vel?.x || 0) * 0.6 + (Math.random() - 0.5) * 1.4;
      const tz = p.pos.z + (p.vel?.z || 0) * 0.6 + (Math.random() - 0.5) * 1.4;
      const mdmg = e.dmg * 1.3;
      g.addDecal('circle', tx, tz, 2.35, 0xff6a30, 0.95, null, () => {
        g.audio.sfx('slam');
        g.puffs.burst(tx, 0.5, tz, 14, { c: [0xff6a30, 0xffd85a], s: 0.24, speed: 5, up: 4, life: 0.5 });
        if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 2.45) g.hurtPlayer(mdmg, { x: tx, y: p.y, z: tz }, 'burn');
      });
    } else if (af.id === 'vortex') {
      e.affixCds[af.id] = 7.2;
      const vx = e.pos.x, vz = e.pos.z;
      g.addDecal('circle', vx, vz, 6.5, 0xb07aff, 0.72, null, () => {
        const dx = vx - p.pos.x, dz = vz - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 6.6 && d > 0.8 && p.roll <= 0 && p.iframes <= 0) {
          p.vel.x += (dx / d) * 12.5;
          p.vel.z += (dz / d) * 12.5;
          g.ui.dmgNum(p.pos.x, p.y + 1.7, p.pos.z, '🌀 牽引!', 'hurt');
        }
        g.fx.burst(vx, 0.7, vz, 14, { c: [0xb07aff, 0xffffff], s: 0.14, speed: 5.5, up: 2, life: 0.4 });
      });
    } else if (af.id === 'frost_waller') {
      e.affixCds[af.id] = 7.5;
      const px = p.pos.x, pz = p.pos.z;
      g.addDecal('circle', px, pz, 3.3, 0x7ae8ff, 0.65, null, () => {
        g.spawnGroundZone('ice', px, pz, 3.4, 4.8, 0.3, { color: 0x7ae8ff, slow: 2.4 });
        g.fx.burst(px, 0.7, pz, 16, { c: [0x7ae8ff, 0xffffff], s: 0.16, speed: 4.5, up: 3, life: 0.5 });
        if (Math.hypot(p.pos.x - px, p.pos.z - pz) < 3.3 && (p.y - g.world.gh(p.pos.x, p.pos.z)) < 0.7) {
          g.hurtPlayer(e.dmg * 0.9, { x: px, y: p.y, z: pz }, 'freeze');
        }
      });
    } else if (af.id === 'arcane_beam') {
      e.affixCds[af.id] = 5.8;
      const bx = e.pos.x, bz = e.pos.z, bdmg = e.dmg * 1.1;
      const startAng = Math.atan2(p.pos.z - bz, p.pos.x - bx) - 0.5;
      for (let step = 0; step < 3; step++) {
        const ang = startAng + step * 0.52;
        const tx = bx + Math.cos(ang) * 4.6, tz = bz + Math.sin(ang) * 4.6;
        g.addDecal('circle', tx, tz, 1.9, 0xff5a28, 0.65 + step * 0.32, null, () => {
          g.spawnBeam(bx, g.world.gh(bx, bz) + 0.9, bz, tx, g.world.gh(tx, tz) + 0.6, tz, 0xff6a30);
          g.fx.burst(tx, 0.6, tz, 8, { c: [0xff6a30, 0xffd85a], s: 0.14, speed: 4, up: 2.5, life: 0.35 });
          if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 2.0) g.hurtPlayer(bdmg, { x: tx, y: p.y, z: tz }, 'burn');
        });
      }
    }
  }
}

export function onEliteDeathAffix(g, e) {
  if (!e) return;
  if (hasAffix(e, 'volatile_death')) {
    const mx = e.pos.x, mz = e.pos.z, dmg = e.dmg * 1.45;
    g.addDecal('circle', mx, mz, 3.2, 0x8cf07a, 0.85, null, () => {
      g.audio.sfx('slam');
      g.puffs.burst(mx, 0.5, mz, 16, { c: [0x8cf07a, 0xd8ff7a], s: 0.25, speed: 5.5, up: 3.5, life: 0.55 });
      if (Math.hypot(g.player.pos.x - mx, g.player.pos.z - mz) < 3.25) {
        g.hurtPlayer(dmg, { x: mx, y: g.player.y, z: mz }, 'poison');
      }
    });
  }
  if (e.isVolatileSwarm) {
    const mx = e.pos.x, mz = e.pos.z;
    g.addDecal('circle', mx, mz, 2.5, 0xff4858, 0.52, null, () => {
      g.audio.sfx('slam');
      g.fx.burst(mx, 0.5, mz, 14, { c: [0xff4858, 0xffd85a, 0xffffff], s: 0.18, speed: 6, up: 3.5, life: 0.4 });
      if (Math.hypot(g.player.pos.x - mx, g.player.pos.z - mz) < 2.55) {
        g.hurtPlayer(e.dmg * 1.35, { x: mx, y: g.player.y, z: mz }, 'burn');
      }
      for (const other of g.enemies) {
        if (other.dead || other === e) continue;
        const d = Math.hypot(other.pos.x - mx, other.pos.z - mz);
        if (d < 3.0 + other.r) {
          g.hitEnemy(other, { dmg: Math.max(16, Math.round(e.maxHp * 0.9)), crit: false, fire: true }, 0, 0, { isTrigger: true });
        }
      }
    });
  }
}

// ============================================================================
// 2. 六大高壓怪物戰術陣型（Swarm Formations — 逼迫走位、破陣與閃避）
// ============================================================================
export const SWARM_FORMATIONS = [
  { id: 'encircle',       icon: '⭕', name: '縮圈包圍陣', minPhase: 2, desc: '360° 怪物圓環同步向內收縮，打穿缺口或跳躍突圍！' },
  { id: 'stampede',       icon: '⚡', name: '疾風穿刺列', minPhase: 1, desc: '高速野豬／飛鰩沿紅色警示跑道橫掃戰場！' },
  { id: 'volatile_swarm', icon: '💣', name: '餘燼自爆群', minPhase: 2, desc: '發光自爆蟲蜂擁而至，近身自爆高傷！' },
  { id: 'phalanx',        icon: '🛡', name: '盾牆方陣',   minPhase: 1, desc: '重甲巨像前排舉盾減傷＋後排遠程齊射，必須繞背或空戰破陣！' },
  { id: 'snipers',        icon: '👁', name: '軌道狙擊陣', minPhase: 2, desc: '遠程狙擊手拉出紅線蓄力齊射，善用翻滾閃避！' },
  { id: 'twin_lords',     icon: '👑', name: '雙王夾擊',   minPhase: 3, desc: '連潮高壓雙潮汐領主同時空降！' },
];

export function pickFormation(phase = 1, waveStreak = 1, rng = Math.random) {
  const elig = SWARM_FORMATIONS.filter(f => f.minPhase <= phase && (f.id !== 'twin_lords' || waveStreak >= 3));
  if (!elig.length) return SWARM_FORMATIONS[1];
  return elig[Math.floor(rng() * elig.length)];
}

export function spawnSwarmFormation(g, formationId) {
  const p = g.player, td = g.tide;
  if (!g.world || !p || !td) return 0;
  const fDef = SWARM_FORMATIONS.find(f => f.id === formationId) || SWARM_FORMATIONS[0];
  let spawned = 0;
  const lv = FIELDS[g.field]?.level || 1;
  const esc = getEscalationProfile(td.sv?.survivalSec || 0);
  const curSwarm = g.enemies.filter(e => !e.dead && e.isSwarmlet).length;
  const maxRoom = Math.max(4, 46 - curSwarm);

  if (formationId === 'encircle') {
    const n = Math.min(18, maxRoom);
    const radius = 12.2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const sx = p.pos.x + Math.cos(ang) * radius;
      const sz = p.pos.z + Math.sin(ang) * radius;
      if (!g.world.isLand(sx, sz)) continue;
      const e = g.spawnEnemy(i % 4 === 0 ? 'golem' : 'slime', { x: sx, z: sz }, false);
      if (!e) continue;
      e.isSwarmlet = true; e.tideAggro = true; e.tideLife = 25; e.level = lv;
      e.hp = Math.round(e.hp * 0.85 * esc.hpMult); e.maxHp = e.hp;
      e.dmg = Math.round(e.dmg * 1.05 * esc.dmgMult);
      e.spd *= 1.15 * esc.spdMult;
      spawned++;
    }
  } else if (formationId === 'stampede') {
    const dirAng = Math.random() * Math.PI * 2;
    const dx = Math.cos(dirAng), dz = Math.sin(dirAng);
    const px = -dz, pz = dx;
    const count = Math.min(8, maxRoom);
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * 1.9;
      const sx = p.pos.x - dx * 13 + px * off;
      const sz = p.pos.z - dz * 13 + pz * off;
      const tx = p.pos.x + dx * 8 + px * off;
      const tz = p.pos.z + dz * 8 + pz * off;
      if (!g.world.isLand(sx, sz)) continue;
      g.addDecal('circle', tx, tz, 1.4, 0xff4858, 1.0, null, null);
      const e = g.spawnEnemy(i % 2 === 0 ? 'boar' : 'skyray', { x: sx, z: sz }, false);
      if (!e) continue;
      e.isSwarmlet = true; e.tideAggro = true; e.tideLife = 25; e.level = lv;
      e.hp = Math.round(e.hp * 0.8 * esc.hpMult); e.maxHp = e.hp;
      e.dmg = Math.round(e.dmg * 1.1 * esc.dmgMult);
      e.spd *= 1.5 * esc.spdMult;
      spawned++;
    }
  } else if (formationId === 'volatile_swarm') {
    const n = Math.min(12, maxRoom);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const sx = p.pos.x + Math.cos(ang) * (10 + Math.random() * 3.5);
      const sz = p.pos.z + Math.sin(ang) * (10 + Math.random() * 3.5);
      if (!g.world.isLand(sx, sz)) continue;
      const e = g.spawnEnemy('slime', { x: sx, z: sz }, false);
      if (!e) continue;
      e.isSwarmlet = true; e.isVolatileSwarm = true; e.tideAggro = true; e.level = lv;
      e.hp = Math.round(e.hp * 0.65 * esc.hpMult); e.maxHp = e.hp;
      e.dmg = Math.round(e.dmg * 1.15 * esc.dmgMult);
      e.spd *= 1.48 * esc.spdMult;
      e.m.root.scale.setScalar(0.84);
      const glow = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshBasicMaterial({ color: 0xff3b4e }),
      );
      glow.position.y = 0.85;
      e.m.root.add(glow);
      spawned++;
    }
  } else if (formationId === 'phalanx') {
    const baseAng = Math.random() * Math.PI * 2;
    const dx = Math.cos(baseAng), dz = Math.sin(baseAng), px = -dz, pz = dx;
    for (let i = -1; i <= 1; i++) {
      const sx = p.pos.x + dx * 10 + px * i * 2.1;
      const sz = p.pos.z + dz * 10 + pz * i * 2.1;
      if (g.world.isLand(sx, sz)) {
        const tank = g.spawnEnemy('golem', { x: sx, z: sz }, i === 0);
        if (tank) {
          tank.tideAggro = true; tank.tideLife = 28; tank.isPhalanxShield = true; tank.level = lv;
          tank.hp = Math.round(tank.hp * esc.hpMult); tank.maxHp = tank.hp;
          spawned++;
        }
      }
      const rx = p.pos.x + dx * 13 + px * i * 2.0;
      const rz = p.pos.z + dz * 13 + pz * i * 2.0;
      if (g.world.isLand(rx, rz)) {
        const ranged = g.spawnEnemy('thorn', { x: rx, z: rz }, false);
        if (ranged) {
          ranged.isSwarmlet = true; ranged.tideAggro = true; ranged.level = lv;
          ranged.hp = Math.round(ranged.hp * esc.hpMult); ranged.maxHp = ranged.hp;
          spawned++;
        }
      }
    }
  } else if (formationId === 'snipers') {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sx = p.pos.x + Math.cos(ang) * 13.5, sz = p.pos.z + Math.sin(ang) * 13.5;
      if (!g.world.isLand(sx, sz)) continue;
      const sn = g.spawnEnemy('moth', { x: sx, z: sz }, i === 0);
      if (!sn) continue;
      sn.tideAggro = true; sn.tideLife = 26; sn.level = lv;
      spawned++;
      const tx = p.pos.x, tz = p.pos.z, sdmg = sn.dmg * 1.35 * esc.dmgMult;
      g.addDecal('circle', tx, tz, 1.6, 0xff3b58, 1.15, null, () => {
        if (sn.dead) return;
        g.spawnBeam(sn.pos.x, g.world.gh(sn.pos.x, sn.pos.z) + 1.0, sn.pos.z, tx, g.world.gh(tx, tz) + 0.6, tz, 0xff3b58);
        if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 1.7) g.hurtPlayer(sdmg, { x: tx, y: p.y, z: tz }, 'shock');
      });
    }
  }

  if (spawned > 0) {
    g.ui.toast(`${fDef.icon} 戰術陣型：【${fDef.name}】${fDef.desc}`, '#ff7842');
  }
  return spawned;
}

// ============================================================================
// 3. MMO 永久成長：星燈聖殿天賦樹（紮實累積、無免費白嫖，需用星砂一步步點亮）
// ============================================================================
export const SANCTUARY_TALENTS = [
  { id: 'vitality',  icon: '❤️', name: '生命湧泉', max: 5, baseCost: 35, stepCost: 40, desc: '永久最大生命 +10 / 級' },
  { id: 'mastery',   icon: '⚔️', name: '戰技精通', max: 5, baseCost: 40, stepCost: 48, desc: '永久全傷害 +7% / 級' },
  { id: 'precision', icon: '🎯', name: '弱點穿透', max: 5, baseCost: 40, stepCost: 45, desc: '永久暴擊率 +3% / 級、暴傷 +8% / 級' },
  { id: 'haste',     icon: '🪶', name: '疾風步履', max: 5, baseCost: 35, stepCost: 42, desc: '永久移速 +4% / 級、冷卻縮減 +3% / 級' },
  { id: 'magnet',    icon: '🧲', name: '星磁領域', max: 5, baseCost: 30, stepCost: 35, desc: '經驗寶石吸取範圍 +18% / 級' },
  { id: 'greed',     icon: '🏆', name: '貪婪之火', max: 5, baseCost: 45, stepCost: 55, desc: '掉寶率與戰利品袋收益 +15% / 級（同時提高怪海密度 +12%）' },
  { id: 'revive',    icon: '✨', name: '星燈復甦', max: 2, baseCost: 90, stepCost: 130, desc: '每趟遠征原地滿血復活並清場震波 +1 次 / 級' },
];

export function ensureTalents(profile) {
  if (!profile) return {};
  if (!profile.talents || typeof profile.talents !== 'object') profile.talents = {};
  return profile.talents;
}

export function talentCost(id, curLv = 0) {
  const def = SANCTUARY_TALENTS.find(t => t.id === id);
  if (!def || curLv >= def.max) return Infinity;
  return def.baseCost + curLv * def.stepCost;
}

export function buyTalent(profile, id) {
  const t = ensureTalents(profile);
  const def = SANCTUARY_TALENTS.find(x => x.id === id);
  if (!def) return { ok: false, reason: '未知天賦' };
  const cur = t[id] || 0;
  if (cur >= def.max) return { ok: false, reason: '已達最高等級' };
  const cost = talentCost(id, cur);
  if ((profile.shards || 0) < cost) return { ok: false, reason: `需要 ${cost} 星砂` };
  profile.shards -= cost;
  t[id] = cur + 1;
  return { ok: true, level: t[id], cost, def };
}

export function respecTalents(profile) {
  const t = ensureTalents(profile);
  let refund = 0;
  for (const def of SANCTUARY_TALENTS) {
    const lv = t[def.id] || 0;
    for (let i = 0; i < lv; i++) refund += talentCost(def.id, i);
    t[def.id] = 0;
  }
  profile.shards = (profile.shards || 0) + refund;
  return refund;
}

export function computeTalentBonuses(profile) {
  const t = ensureTalents(profile);
  return {
    maxHp: (t.vitality || 0) * 10,
    dmgPct: (t.mastery || 0) * 7,
    crit: (t.precision || 0) * 3,
    critMult: (t.precision || 0) * 8,
    moveSpd: (t.haste || 0) * 4,
    cdr: (t.haste || 0) * 3,
    magnetMult: 1 + (t.magnet || 0) * 0.18,
    greedLootMult: 1 + (t.greed || 0) * 0.15,
    greedDensityMult: 1 + (t.greed || 0) * 0.12,
    revives: t.revive || 0,
  };
}

// ============================================================================
// 4. 硬核潮汐狀態：10 分鐘壓迫時鐘、動態難度導演、連殺狂熱、撤離戰利品袋、血月蝕、戰力評分
// ============================================================================
export function getBloodEclipseField(nowMs = Date.now()) {
  const cycleMs = 20 * 60 * 1000;
  const phaseMs = nowMs % cycleMs;
  const active = phaseMs < 5 * 60 * 1000;
  const cycleIdx = Math.floor(nowMs / cycleMs);
  const fieldId = (cycleIdx % 20) + 1;
  const remainSec = active ? Math.ceil((5 * 60 * 1000 - phaseMs) / 1000) : Math.ceil((cycleMs - phaseMs) / 1000);
  return { active, fieldId, remainSec };
}

export function recordBestTide(profile, waveStreak = 1, streakKills = 0, survivalMin = 0) {
  if (!profile) return null;
  if (!profile.bestTide) profile.bestTide = { maxWave: 1, maxStreak: 0, maxMin: 0 };
  let updated = false;
  if (waveStreak > (profile.bestTide.maxWave || 1)) { profile.bestTide.maxWave = waveStreak; updated = true; }
  if (streakKills > (profile.bestTide.maxStreak || 0)) { profile.bestTide.maxStreak = streakKills; updated = true; }
  if (survivalMin > (profile.bestTide.maxMin || 0)) { profile.bestTide.maxMin = survivalMin; updated = true; }
  return updated ? profile.bestTide : null;
}

export function createSurvivorState(profile = null) {
  const tb = computeTalentBonuses(profile);
  return {
    revivesLeft: tb.revives,
    // 動態難度導演
    killWindow: [],
    directorLevel: 0,
    formationCd: 15,
    curseStacks: 0,
    // 連殺狂熱
    streakKills: 0,
    streakTimer: 0,
    // 未結算戰利品袋（撤離風險機制）
    spoils: { coins: 0, shards: 0, chests: 0 },
    // 10 分鐘硬核生存波次時鐘
    survivalSec: 0,
    nextMiniBossSec: 90,
    reaperSpawned5: false,
    reaperSpawned10: false,
  };
}

export function getEscalationProfile(survivalSec = 0) {
  const min = Math.floor(Math.max(0, survivalSec) / 60);
  const hpMult = +(1 + min * 0.30 + (min >= 5 ? (min - 4) * 0.28 : 0)).toFixed(2);
  const dmgMult = +(1 + min * 0.22 + (min >= 5 ? (min - 4) * 0.16 : 0)).toFixed(2);
  const spdMult = +(1 + Math.min(0.50, min * 0.06)).toFixed(2);
  const densityMult = +(1 + Math.min(1.25, min * 0.16)).toFixed(2);
  const label = min >= 10 ? '☠️ 深淵死神降臨' : min >= 5 ? '🔥 血月死鬥' : min >= 3 ? '⚡ 狂潮加速' : min >= 1 ? '🟠 威脅升溫' : '🟢 初入戰場';
  return { min, hpMult, dmgMult, spdMult, densityMult, label };
}

export function getKillStreakTier(kills = 0) {
  if (kills >= 500) return { tier: 4, label: '🔥 神域狂熱', color: '#ff4858', moveSpd: 14, crit: 14, lootBonus: 0.45 };
  if (kills >= 300) return { tier: 3, label: '⚡ 熾炎連斬', color: '#ff8a3a', moveSpd: 10, crit: 10, lootBonus: 0.30 };
  if (kills >= 150) return { tier: 2, label: '✨ 狂潮覺醒', color: '#ffd85a', moveSpd: 7,  crit: 6,  lootBonus: 0.18 };
  if (kills >= 50)  return { tier: 1, label: '🌟 炙熱手感', color: '#7fe08a', moveSpd: 4,  crit: 3,  lootBonus: 0.08 };
  return { tier: 0, label: '', color: '#fff', moveSpd: 0, crit: 0, lootBonus: 0 };
}

export function computeSurvivorStatBonuses(sv) {
  const b = { moveSpd: 0, crit: 0, lootMult: 1 };
  if (!sv) return b;
  if (sv.curseStacks > 0) b.lootMult += sv.curseStacks * 0.35;
  const st = getKillStreakTier(sv.streakKills || 0);
  if (st.tier > 0) { b.moveSpd += st.moveSpd; b.crit += st.crit; b.lootMult += st.lootBonus; }
  return b;
}

export function recordSpoils(sv, coins = 0, shards = 0, chests = 0) {
  if (!sv?.spoils) return;
  sv.spoils.coins += coins;
  sv.spoils.shards += shards;
  sv.spoils.chests += chests;
}

export function cashOutSpoils(sv, profile) {
  if (!sv?.spoils || !profile) return { coins: 0, shards: 0 };
  const out = { coins: Math.round(sv.spoils.coins), shards: Math.round(sv.spoils.shards) };
  profile.coins = (profile.coins || 0) + out.coins;
  profile.shards = (profile.shards || 0) + out.shards;
  sv.spoils = { coins: 0, shards: 0, chests: 0 };
  return out;
}

export function loseSpoilsOnDeath(sv) {
  if (!sv?.spoils) return { lostCoins: 0, lostShards: 0 };
  const lostCoins = Math.floor(sv.spoils.coins * 0.5);
  const lostShards = Math.floor(sv.spoils.shards * 0.5);
  sv.spoils.coins -= lostCoins;
  sv.spoils.shards -= lostShards;
  return { lostCoins, lostShards };
}

export function updateDifficultyDirector(sv, nowSec, killedNow = false) {
  if (!sv) return 0;
  if (!sv.killWindow) sv.killWindow = [];
  if (killedNow) sv.killWindow.push(nowSec);
  const cutoff = nowSec - 15;
  while (sv.killWindow.length && sv.killWindow[0] < cutoff) sv.killWindow.shift();
  const kps = sv.killWindow.length / 15;
  sv.directorLevel = kps >= 1.5 ? 3 : kps >= 0.9 ? 2 : kps >= 0.45 ? 1 : 0;
  return sv.directorLevel;
}

export function computeCombatPower(profile, stats, equip = {}) {
  const lv = profile?.level || 1;
  const dmg = (stats?.baseDmg || 5) * (1 + (stats?.dmgPct || 0) / 100);
  const critFactor = 1 + ((stats?.crit || 5) / 100) * (((stats?.critMult || 150) - 100) / 100);
  const spdFactor = 1 + (stats?.atkSpd || 0) / 100;
  const offense = dmg * critFactor * spdFactor * 6.5;
  const defense = (stats?.maxHp || 62) * (1 + (stats?.armor || 0) / 80) * 1.4;
  let gearBonus = 0;
  for (const it of Object.values(equip || {})) {
    if (!it) continue;
    gearBonus += (it.rarity + 1) * 28 + Math.round(tierPower(it.tier) * 18) + (it.corrupted ? 45 : 0);
  }
  const talSum = Object.values(profile?.talents || {}).reduce((s, v) => s + (v || 0), 0);
  return Math.max(10, Math.round(offense + defense + gearBonus + lv * 15 + talSum * 22));
}
