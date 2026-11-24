import * as THREE from 'three';
import { toonMat } from './world.js';
import { clamp, lerp, pick } from './util.js';
import { makeItem } from './loot.js';
import { FIELDS } from './frontier.js';

export const TIDE_PHASES = [
  { id: 0, key: 'calm',   name: '晨光巡遊', minHeat: 0,   lootMult: 1.0,  color: '#7fe08a', spawnInterval: 0,   maxSwarm: 0,  waveSize: 0,  zoomBonus: 0 },
  { id: 1, key: 'spark',  name: '火星躁動', minHeat: 25,  lootMult: 1.35, color: '#ffd85a', spawnInterval: 4.4, maxSwarm: 14, waveSize: 5,  zoomBonus: 0.04 },
  { id: 2, key: 'surge',  name: '餘燼狂潮', minHeat: 55,  lootMult: 1.9,  color: '#ff8a3a', spawnInterval: 3.0, maxSwarm: 26, waveSize: 10, zoomBonus: 0.09 },
  { id: 3, key: 'apex',   name: '熾炎巔峰', minHeat: 100, lootMult: 2.6,  color: '#ff4858', spawnInterval: 2.4, maxSwarm: 34, waveSize: 14, zoomBonus: 0.15 },
];

export const ULTIMATES = [
  { id: 'storm',    icon: '⚡', name: '星燈雷雨風暴', shout: 'THUNDERSTORM!',  color: '#7ae8ff', desc: '頭頂召喚跟隨移動的星燈雷雲 5.5 秒，連環天雷轟擊怪海並觸發感電連鎖！' },
  { id: 'hound',    icon: '🐕', name: '巨型燈犬衝鋒', shout: 'WOOF!',          color: '#ffa83a', desc: '召喚巨型發光燈犬向前猛衝，撞飛並暈眩沿途所有敵人！' },
  { id: 'daybreak', icon: '☀️', name: '破曉大太陽',   shout: 'DAYBREAK!',      color: '#fff07a', desc: '升起破曉太陽淨化異常並回血，釋放全螢幕黃金清場震波！' },
];

export const MICRO_BUFFS = [
  { id: 'dice20',  icon: '🎲', name: '20面幸運骰', color: '#ffd85a', desc: '攻擊 22% 機率擲出 TWENTY!（2.2× 漫畫暴擊）', dur: 35 },
  { id: 'bouncer', icon: '🔴', name: '彈跳火球',   color: '#ff6a4a', desc: '每 2.4 秒自動發射彈跳熾炎球清掃怪海', dur: 35 },
  { id: 'cyclone', icon: '🌪', name: '環繞旋風',   color: '#7ae8ff', desc: '周身環繞氣流旋風，持續擊退並傷害逼近的怪海', dur: 35 },
];

export const APEX_DURATION = 35;
export const LULL_DURATION = 25;

// ---------------- pure state & logic (Node.js testable) ----------------
export function createTideState() {
  return {
    heat: 0,
    phase: 0,
    waveStreak: 1,
    apexTimer: 0,
    lullTimer: 0,
    bossSpawned: false,
    bossSlain: false,
    ultCharge: 0,
    ultIndex: 0,
    spawnCd: 1.5,
    decayIdleT: 0,
    zoomBonus: 0,
    microBuffs: { dice20: 0, bouncer: 0, cyclone: 0 },
    bouncerCd: 0,
    cycloneCd: 0,
    // runtime 3D entities
    xpGems: [],
    storms: [],
    hounds: [],
    suns: [],
    lullCamp: null,
    lullSpot: null,
  };
}

export function phaseForHeat(heat, state = null) {
  if (state && state.lullTimer > 0) return -1;
  if (state && state.apexTimer > 0) return 3;
  if (heat >= 100) return 3;
  if (heat >= 55) return 2;
  if (heat >= 25) return 1;
  return 0;
}

export function lootMultForTide(state) {
  if (!state) return 1.0;
  const p = TIDE_PHASES[Math.max(0, state.phase)] || TIDE_PHASES[0];
  const streakBonus = state.waveStreak > 1 ? 1 + (state.waveStreak - 1) * 0.45 : 1;
  return +(p.lootMult * streakBonus).toFixed(2);
}

export function recordTideKill(state, opts = {}) {
  if (!state) return { phaseChanged: false, enteredApex: false, enteredLull: false, ultReadyNow: false };
  const { isSwarmlet = false, isElite = false, isBoss = false, isTideBoss = false } = opts;
  const prevPhase = state.phase;
  const prevUlt = state.ultCharge;

  // 充能大絕（休整期外皆可累積）
  const ultGain = isTideBoss || isBoss ? 35 : isElite ? 18 : isSwarmlet ? 5 : 8;
  state.ultCharge = Math.min(100, state.ultCharge + ultGain);
  const ultReadyNow = prevUlt < 100 && state.ultCharge >= 100;

  if (state.lullTimer > 0) {
    return { phaseChanged: false, enteredApex: false, enteredLull: false, ultReadyNow };
  }

  state.decayIdleT = 0;

  // 若在熾炎巔峰擊殺潮汐王，直接凱旋進入 25 秒休整期
  if (state.apexTimer > 0 && isTideBoss) {
    state.bossSlain = true;
    state.apexTimer = 0;
    state.lullTimer = LULL_DURATION;
    state.heat = 0;
    state.phase = -1;
    return { phaseChanged: true, enteredApex: false, enteredLull: true, ultReadyNow };
  }

  if (state.apexTimer <= 0) {
    const heatGain = isBoss ? 28 : isElite ? 16 : isSwarmlet ? 4.5 : 8;
    state.heat = Math.min(100, state.heat + heatGain);
    if (state.heat >= 100) {
      state.apexTimer = APEX_DURATION;
      state.bossSpawned = false;
      state.bossSlain = false;
    }
  }

  state.phase = phaseForHeat(state.heat, state);
  return {
    phaseChanged: state.phase !== prevPhase,
    enteredApex: prevPhase !== 3 && state.phase === 3,
    enteredLull: false,
    ultReadyNow,
  };
}

export function stepTideTimers(state, dt) {
  if (!state) return { enteredLull: false, lullEnded: false };
  let enteredLull = false, lullEnded = false;

  for (const k of ['dice20', 'bouncer', 'cyclone']) {
    if (state.microBuffs[k] > 0) state.microBuffs[k] = Math.max(0, state.microBuffs[k] - dt);
  }

  if (state.lullTimer > 0) {
    state.lullTimer = Math.max(0, state.lullTimer - dt);
    state.phase = -1;
    if (state.lullTimer <= 0) {
      state.heat = 0;
      state.phase = 0;
      state.waveStreak = 1;
      state.bossSpawned = false;
      state.bossSlain = false;
      lullEnded = true;
    }
  } else if (state.apexTimer > 0) {
    state.apexTimer = Math.max(0, state.apexTimer - dt);
    state.phase = 3;
    if (state.apexTimer <= 0) {
      state.lullTimer = LULL_DURATION;
      state.heat = 0;
      state.phase = -1;
      enteredLull = true;
    }
  } else {
    state.decayIdleT += dt;
    if (state.decayIdleT > 4.5 && state.heat > 0) {
      const decayRate = state.phase >= 2 ? 3.2 : 2.2;
      state.heat = Math.max(0, state.heat - decayRate * dt);
      state.phase = phaseForHeat(state.heat, state);
    }
  }

  const targetZoom = state.phase >= 0 ? (TIDE_PHASES[state.phase]?.zoomBonus || 0) : 0;
  state.zoomBonus = lerp(state.zoomBonus || 0, targetZoom, Math.min(1, dt * 3));
  return { enteredLull, lullEnded };
}

export function consumeUltimate(state) {
  if (!state || state.ultCharge < 100) return null;
  state.ultCharge = 0;
  return ULTIMATES[state.ultIndex % ULTIMATES.length];
}

export function applyRekindle(state) {
  if (!state || state.lullTimer <= 0) return false;
  state.lullTimer = 0;
  state.waveStreak = Math.min(5, (state.waveStreak || 1) + 1);
  state.heat = 60;
  state.phase = 2;
  state.apexTimer = 0;
  state.bossSpawned = false;
  state.bossSlain = false;
  state.spawnCd = 0.6;
  return true;
}

// ---------------- 3D runtime director ----------------
const XP_GEM_GEO = new THREE.OctahedronGeometry(0.18, 0);
function dropTideObj(g, obj) {
  if (!obj) return;
  g.scene?.remove?.(obj);
  obj.traverse?.(o => {
    if (o.geometry && o.geometry !== XP_GEM_GEO && !o.userData?.sharedGeo) o.geometry.dispose?.();
    if (o.material && !o.userData?.sharedMat) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
      else o.material.dispose?.();
    }
  });
}

function clearLullCamp(g) {
  const td = g.tide;
  if (!td) return;
  if (td.lullCamp) { dropTideObj(g, td.lullCamp); td.lullCamp = null; }
  if (td.lullSpot) {
    const idx = g.spots.indexOf(td.lullSpot);
    if (idx >= 0) g.spots.splice(idx, 1);
    td.lullSpot = null;
  }
}

export function resetTide(g) {
  if (g.tide) {
    clearLullCamp(g);
    for (const gem of g.tide.xpGems || []) dropTideObj(g, gem.mesh);
    for (const st of g.tide.storms || []) dropTideObj(g, st.group);
    for (const h of g.tide.hounds || []) dropTideObj(g, h.mesh);
    for (const s of g.tide.suns || []) dropTideObj(g, s.mesh);
  }
  g.tide = createTideState();
}

export function cycleUltimate(g) {
  if (!g.tide) g.tide = createTideState();
  g.tide.ultIndex = (g.tide.ultIndex + 1) % ULTIMATES.length;
  const u = ULTIMATES[g.tide.ultIndex];
  g.audio.sfx('ui');
  g.ui.toast(`切換大絕：${u.icon} ${u.name}（${u.desc}）`, u.color);
}

export function spawnXpGems(g, x, z, count = 2) {
  if (!g.tide) return;
  const cols = [0x6cf0ff, 0xffe05a, 0xff8ad8, 0x8ef08a];
  const y0 = g.world.gh(x, z);
  for (let i = 0; i < count; i++) {
    if (g.tide.xpGems.length >= 65) {
      const old = g.tide.xpGems.shift();
      dropTideObj(g, old.mesh);
    }
    const col = cols[(Math.random() * cols.length) | 0];
    const mesh = new THREE.Mesh(
      XP_GEM_GEO,
      new THREE.MeshBasicMaterial({ color: col }),
    );
    const a = Math.random() * Math.PI * 2;
    const sp = 1.6 + Math.random() * 2.2;
    mesh.position.set(x, y0 + 0.45, z);
    g.scene.add(mesh);
    g.tide.xpGems.push({ mesh, x, z, y: y0 + 0.45, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 4.2 + Math.random() * 1.8, life: 18, xp: 6, col });
  }
}

function grantRandomMicroBuff(g) {
  const td = g.tide;
  if (!td) return;
  const def = pick(Math.random, MICRO_BUFFS);
  td.microBuffs[def.id] = Math.max(td.microBuffs[def.id] || 0, def.dur);
  g.audio.sfx('perfect');
  g.ui.toast(`✨ 狂潮強化：${def.icon} ${def.name}（${def.desc}）`, def.color);
  g.ui.dmgNum(g.player.pos.x, g.player.y + 2.3, g.player.pos.z, `${def.icon} ${def.name}!`, 'comic');
}

function enterLullVisuals(g, bossSlain = false) {
  const td = g.tide, p = g.player;
  g.audio.sfx('lullCalm');
  // 殘餘怪海全數化作經驗晶石與彩帶爆開
  for (const e of g.enemies) {
    if (!e.dead && e.isSwarmlet) {
      e.dead = true;
      g.scene.remove(e.m.root);
      spawnXpGems(g, e.pos.x, e.pos.z, 2);
      g.puffs.burst(e.pos.x, 0.5, e.pos.z, 5, { c: [0xffe480, 0x7ae8ff, 0xffa8d8], s: 0.2, speed: 3.5, up: 3.5, life: 0.55 });
    }
  }
  g.enemies = g.enemies.filter(e => !e.dead);

  // 在玩家旁 2.6m 處升起「休整營火＋續燃燈籠」
  clearLullCamp(g);
  const cx = p.pos.x + Math.sin(p.facing) * 2.6;
  const cz = p.pos.z + Math.cos(p.facing) * 2.6;
  const fx = g.world.isLand(cx, cz) ? cx : p.pos.x;
  const fz = g.world.isLand(cx, cz) ? cz : p.pos.z;
  const fy = g.world.gh(fx, fz);

  const grp = new THREE.Group();
  const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6), toonMat({ color: 0x6b4530 }));
  log1.rotation.z = Math.PI / 2; log1.rotation.y = 0.6; log1.position.y = 0.1;
  const log2 = log1.clone(); log2.rotation.y = -0.6;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 5), new THREE.MeshBasicMaterial({ color: 0xffa83a }));
  flame.position.y = 0.42;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), toonMat({ color: 0x5a3826 }));
  post.position.set(0.65, 0.9, 0);
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xffd85a }));
  lantern.position.set(0.65, 1.95, 0);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.8, 5.2, 28), new THREE.MeshBasicMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.userData.noNormal = true;
  const light = new THREE.PointLight(0xffb85a, 2.8, 11, 1.4);
  light.position.y = 1.3;
  grp.add(log1, log2, flame, post, lantern, ring, light);
  grp.position.set(fx, fy, fz);
  g.scene.add(grp);
  td.lullCamp = grp;

  const spot = {
    kind: 'rekindle_lantern',
    label: `🔥 點燃續燃燈籠 · 挑戰第 ${td.waveStreak + 1} 波狂潮（掉寶 ×${(2.6 * (1 + td.waveStreak * 0.45)).toFixed(1)}）`,
    x: fx, z: fz, top: 2.8,
  };
  g.spots.push(spot);
  td.lullSpot = spot;

  g.ui.banner(
    bossSlain ? '🎉 潮汐王擊破！潮退休整期' : '🌿 潮退休整期（25 秒）',
    '靠近營火快速回血 · 按 [F] 點燃續燃燈籠可直推下一波高倍率狂潮',
  );
  g.ui.toast('🌿 怪海暫歇 25 秒！可安心撿裝休息，或點燃續燃燈籠挑戰下一波', '#7fe08a');
}

function spawnSwarmWave(g, count, includeElite = false) {
  const p = g.player, td = g.tide;
  if (!g.world || !p) return;
  const curSwarm = g.enemies.filter(e => !e.dead && e.isSwarmlet).length;
  const maxSwarm = TIDE_PHASES[Math.max(0, td.phase)]?.maxSwarm || 20;
  const toSpawn = Math.min(count, Math.max(0, maxSwarm - curSwarm));
  if (toSpawn <= 0) return;

  const types = g.field >= 6 ? ['slime', 'boar', 'moth', 'thorn'] : ['slime', 'slime', 'boar', 'thorn'];
  for (let i = 0; i < toSpawn; i++) {
    const ang = (i / Math.max(1, toSpawn)) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const dist = 11.5 + Math.random() * 5.5;
    const sx = p.pos.x + Math.cos(ang) * dist;
    const sz = p.pos.z + Math.sin(ang) * dist;
    if (!g.world.isLand(sx, sz)) continue;
    const isEl = includeElite && i === 0;
    const tp = isEl ? pick(Math.random, ['boar', 'golem', 'moth']) : pick(Math.random, types);
    const e = g.spawnEnemy(tp, { x: sx, z: sz }, isEl);
    if (!e) continue;
    e.isSwarmlet = !isEl;
    e.tideAggro = true;
    e.level = FIELDS[g.field]?.level || 1;
    if (!isEl) {
      // 狂潮小怪：低血量、高移速、割草爽感
      e.hp = Math.max(14, Math.round(e.hp * 0.48));
      e.maxHp = e.hp;
      e.spd *= 1.32;
      e.dmg *= 0.72;
      e.m.root.scale.setScalar(0.84);
    }
  }
}

function spawnTideBoss(g) {
  const p = g.player, td = g.tide;
  td.bossSpawned = true;
  const ang = Math.random() * Math.PI * 2;
  let bx = p.pos.x + Math.cos(ang) * 11, bz = p.pos.z + Math.sin(ang) * 11;
  if (!g.world.isLand(bx, bz)) { const q = g.world.randomWalkable(Math.random, p.pos, 9); bx = q.x; bz = q.z; }
  const isSlimeKing = Math.random() < 0.55;
  const e = g.spawnEnemy(isSlimeKing ? 'slime' : 'boar', { x: bx, z: bz }, true);
  if (!e) return;
  e.isTideBoss = true;
  e.tideAggro = true;
  e.level = (FIELDS[g.field]?.level || 1) + 2;
  e.hp = Math.round(e.hp * (2.6 + (td.waveStreak - 1) * 0.7));
  e.maxHp = e.hp;
  e.spd *= 1.12;
  e.m.root.scale.setScalar(2.15);
  e.r *= 1.5;
  // 黃金王冠模型
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.24, 0.28, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd85a }),
  );
  crown.position.y = 1.18;
  e.m.root.add(crown);
  const title = isSlimeKing ? '👑 史萊姆王 · 餘燼潮主' : '👑 雷鳴野豬王 · 餘燼潮主';
  g.audio.sfx('tideHorn');
  g.ui.banner(`🔥 ${title} 入侵！`, `熾炎巔峰 35 秒 · 掉寶 ×${lootMultForTide(td)} · 擊破立即進入休整期`);
  g.ui.dmgNum(bx, g.world.gh(bx, bz) + 3.0, bz, isSlimeKing ? 'THE SLIME KING!' : 'BOAR KING!', 'comic');
}

export function onTideKill(g, e) {
  if (!g.field || g.state !== 'play') return;
  if (!g.tide) g.tide = createTideState();
  const td = g.tide;
  const res = recordTideKill(td, {
    isSwarmlet: !!e.isSwarmlet,
    isElite: !!e.elite,
    isBoss: e.type === 'stag',
    isTideBoss: !!e.isTideBoss,
  });

  // 掉落磁吸彩色經驗晶石
  const gemCount = e.isTideBoss ? 10 : e.elite ? 5 : (td.phase >= 1 ? 2 : 1);
  spawnXpGems(g, e.pos.x, e.pos.z, gemCount);

  // 狂潮高倍率額外掉寶（精英與潮汐王必掉稀有裝）
  if (e.isTideBoss) {
    for (let i = 0; i < 2; i++) {
      g.dropItem(e.pos.x + (i ? 1.2 : -1.2), e.pos.z, makeItem(Math.random, Math.floor(g.meta.p.level / 3) + td.waveStreak, 3));
    }
    grantRandomMicroBuff(g);
  } else if (e.elite && td.phase >= 1) {
    grantRandomMicroBuff(g);
  }

  if (res.ultReadyNow) {
    g.audio.sfx('ultReady');
    const u = ULTIMATES[td.ultIndex % ULTIMATES.length];
    g.ui.toast(`★ 大絕充能 100%！按 [V] 施放「${u.icon} ${u.name}」`, '#ffd85a');
  }
  if (res.enteredApex) {
    spawnTideBoss(g);
  } else if (res.enteredLull) {
    enterLullVisuals(g, true);
  } else if (res.phaseChanged && td.phase === 1) {
    g.audio.sfx('tideHorn');
    g.ui.toast('🔥 餘燼熱度升溫 → 【火星躁動】外圍怪群開始匯聚！', '#ffd85a');
  } else if (res.phaseChanged && td.phase === 2) {
    g.audio.sfx('tideHorn');
    g.ui.banner('🔥🔥 餘燼狂潮來襲！', '360° 怪海包圍 · 擊殺快速充能 [V] 溫馨荒誕大絕');
  }
}

export function rekindleTide(g) {
  const td = g.tide;
  if (!applyRekindle(td)) return false;
  clearLullCamp(g);
  g.audio.sfx('tideHorn');
  g.fx.burst(g.player.pos.x, g.player.y + 1.0, g.player.pos.z, 26, { c: [0xff8a3a, 0xffd85a, 0xffffff], s: 0.16, speed: 6.5, up: 4.5, life: 0.65 });
  g.ui.banner(`🔥 第 ${td.waveStreak} 波餘燼狂潮再啟！`, `掉寶倍率躍升至 ×${lootMultForTide(td)} · 迎戰更猛烈的怪海！`);
  spawnSwarmWave(g, 10, true);
  return true;
}

// ---------------- 溫馨荒誕大絕 [V] ----------------
function spawnLanternStorm(g) {
  const p = g.player, cx = p.pos.x, cz = p.pos.z, cy = g.world.gh(cx, cz);
  const grp = new THREE.Group();
  const cloudMat = toonMat({ color: 0x5c7298 });
  const rimMat = toonMat({ color: 0x8ef0ff });
  const puffs = [
    [0, 0.15, 0, 1.05], [-0.95, -0.05, 0.35, 0.78], [0.95, -0.02, -0.25, 0.82],
    [-0.45, 0.05, -0.75, 0.72], [0.55, 0.08, 0.72, 0.74],
  ];
  for (const [ox, oy, oz, r] of puffs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
    m.position.set(ox, oy, oz);
    grp.add(m);
  }
  // 雲底懸掛的發光星燈與電流光環
  for (const [ox, oz] of [[-0.55, 0.2], [0.55, -0.2]]) {
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: 0xffe87a }));
    orb.position.set(ox, -0.58, oz);
    grp.add(orb);
  }
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.07, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.7 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.35;
  grp.add(halo);
  const light = new THREE.PointLight(0x7ae8ff, 3.2, 12, 1.4);
  light.position.y = -0.5;
  grp.add(light);
  grp.position.set(cx, cy + 5.2, cz);
  g.scene.add(grp);
  g.tide.storms.push({ group: grp, life: 5.5, zapCd: 0.05, halo, rimMat });

  // 召喚瞬間釋放電脈衝擊退周圍怪海
  g.shockRing(cx, cz, 7.2, g.rollDamage(2.1, true), 0x7ae8ff, 1.0, { isTrigger: true });
  g.applyElementAt(cx, cz, 'shock', 4.5);
  g.fx.burst(cx, cy + 1.8, cz, 24, { c: [0x7ae8ff, 0xffe87a, 0xffffff], s: 0.18, speed: 7.5, up: 5, life: 0.65 });
  g.audio.sfx('ultFort');
  g.ui.dmgNum(cx, cy + 2.8, cz, '⚡ THUNDERSTORM!', 'comic');
  g.ui.toast('⚡ 星燈雷雨風暴降臨（5.5 秒）！跟隨移動並連環落雷清場', '#7ae8ff');
}

function spawnBigPuppy(g) {
  const p = g.player, dir = g.aimDir();
  const grp = new THREE.Group();
  const fur = toonMat({ color: 0xffc85a });
  const earMat = toonMat({ color: 0xb8682c });
  const noseMat = toonMat({ color: 0x2b1d22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.6), fur); body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.95), fur); head.position.set(0, 1.2, 0.95);
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.28), earMat); earL.position.set(-0.52, 1.25, 0.85);
  const earR = earL.clone(); earR.position.x = 0.52;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.2), noseMat); nose.position.set(0, 1.15, 1.48);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), fur); tail.position.set(0, 1.1, -0.88); tail.rotation.x = -0.5;
  grp.add(body, head, earL, earR, nose, tail);
  grp.scale.setScalar(2.15);
  const sx = p.pos.x - dir.x * 2.2, sz = p.pos.z - dir.y * 2.2;
  grp.position.set(sx, g.world.gh(sx, sz), sz);
  grp.rotation.y = Math.atan2(dir.x, dir.y);
  g.scene.add(grp);
  g.tide.hounds.push({ mesh: grp, x: sx, z: sz, dx: dir.x, dz: dir.y, life: 1.55, hit: new Set() });
  g.audio.sfx('ultHound');
  g.shake = Math.max(g.shake, 0.45);
  g.ui.dmgNum(p.pos.x, p.y + 2.8, p.pos.z, '🐕 WOOF!', 'comic');
  g.ui.toast('🐕 巨型燈犬衝鋒！撞飛沿途所有敵人！', '#ffa83a');
}

function spawnDaybreak(g) {
  const p = g.player;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 1),
    new THREE.MeshBasicMaterial({ color: 0xfff07a, transparent: true, opacity: 0.95 }),
  );
  mesh.position.set(p.pos.x, p.y + 1.5, p.pos.z);
  g.scene.add(mesh);
  g.tide.suns.push({ mesh, x: p.pos.x, z: p.pos.z, y0: p.y + 1.5, t: 0, max: 1.35, wave2: false });

  // 淨化異常並回復 35% HP
  if (p.statuses) for (const k of Object.keys(p.statuses)) p.statuses[k] = 0;
  g.heal(p.stats.maxHp * 0.35, true);
  g.shockRing(p.pos.x, p.pos.z, 12.5, g.rollDamage(3.4, true), 0xfff07a, 1.4, { isTrigger: true });
  g.fx.burst(p.pos.x, p.y + 2.2, p.pos.z, 34, { c: [0xfff07a, 0xffa83a, 0xffffff], s: 0.2, speed: 9.5, up: 6, life: 0.85 });
  g.audio.sfx('ultDaybreak');
  g.shake = Math.max(g.shake, 0.65);
  g.ui.dmgNum(p.pos.x, p.y + 3.1, p.pos.z, '☀️ DAYBREAK!', 'comic');
  g.ui.toast('☀️ 破曉大太陽升起！淨化異常並清場！', '#fff07a');
}

export function castUltimate(g) {
  if (!g.tide) g.tide = createTideState();
  const u = consumeUltimate(g.tide);
  if (!u) {
    g.audio.sfx('ui');
    g.ui.toast(`大絕充能中（${Math.floor(g.tide.ultCharge)}%）· 擊殺怪物累積熱度即可充能`, '#ffd85a');
    return false;
  }
  if (u.id === 'storm') spawnLanternStorm(g);
  else if (u.id === 'hound') spawnBigPuppy(g);
  else spawnDaybreak(g);
  // 施放後自動輪替至下一個大絕，讓玩家體驗三種截然不同的荒誕驚喜
  g.tide.ultIndex = (g.tide.ultIndex + 1) % ULTIMATES.length;
  return true;
}

export function tickTide(g, dt) {
  if (!g.field || g.state !== 'play' || g.interior) return;
  if (!g.tide) g.tide = createTideState();
  const td = g.tide, p = g.player;

  const { enteredLull, lullEnded } = stepTideTimers(td, dt);
  if (enteredLull) enterLullVisuals(g, false);
  if (lullEnded) {
    clearLullCamp(g);
    g.ui.toast('🌤 餘燼潮汐已平息，恢復平靜的晨光巡遊', '#bfe8ff');
  }

  // 休整營火回血回魔光環
  if (td.lullTimer > 0 && td.lullCamp) {
    td.lullCamp.children[4].rotation.y += dt * 3;
    const dCamp = Math.hypot(p.pos.x - td.lullCamp.position.x, p.pos.z - td.lullCamp.position.z);
    if (dCamp < 5.4) {
      g.heal(p.stats.maxHp * 0.12 * dt, false);
      p.mana = Math.min(p.stats.mana, p.mana + p.stats.mana * 0.22 * dt);
    }
  }

  // 狂潮生怪節奏（Phase 1/2/3）
  if (td.phase >= 1) {
    const def = TIDE_PHASES[td.phase];
    td.spawnCd -= dt;
    if (td.spawnCd <= 0 && def.spawnInterval > 0) {
      td.spawnCd = def.spawnInterval / (1 + (td.waveStreak - 1) * 0.14);
      const count = Math.round(def.waveSize * (1 + (td.waveStreak - 1) * 0.18));
      spawnSwarmWave(g, count, td.phase >= 2 && Math.random() < 0.55);
    }
    if (td.phase === 3 && !td.bossSpawned) spawnTideBoss(g);
  }

  // 磁吸經驗晶石更新
  for (const gem of td.xpGems) {
    gem.life -= dt;
    gem.mesh.rotation.y += dt * 5;
    if (gem.vy !== 0) {
      gem.vy -= 18 * dt;
      gem.x += gem.vx * dt; gem.z += gem.vz * dt; gem.y += gem.vy * dt;
      const gh = g.world.isLand(gem.x, gem.z) ? g.world.gh(gem.x, gem.z) : 0;
      if (gem.y < gh + 0.35) { gem.y = gh + 0.35; gem.vy = 0; gem.vx = gem.vz = 0; }
    }
    const dx = p.pos.x - gem.x, dz = p.pos.z - gem.z, dist = Math.hypot(dx, dz);
    if (dist < 8.5 && gem.vy === 0) {
      const pull = (14 + (8.5 - dist) * 2.2) * dt;
      gem.x += (dx / Math.max(dist, 0.05)) * pull;
      gem.z += (dz / Math.max(dist, 0.05)) * pull;
      gem.y = lerp(gem.y, p.y + 0.65, Math.min(1, dt * 10));
    }
    gem.mesh.position.set(gem.x, gem.y + Math.sin(g.time * 6 + gem.x) * 0.06, gem.z);
    if (dist < 0.95) {
      gem.taken = true;
      dropTideObj(g, gem.mesh);
      g.audio.sfx('xpGem');
      g.meta.p.coins = (g.meta.p.coins || 0) + 1;
      g.meta.p.xp = (g.meta.p.xp || 0) + gem.xp;
      const need = (g.meta.p.level || 1) * 40;
      if (g.meta.p.level < 30 && g.meta.p.xp >= need) {
        g.meta.p.xp -= need; g.meta.p.level++; g.recalc();
        g.audio.sfx('classup');
        g.ui.toast(`🎉 升級至 Lv.${g.meta.p.level}！`, '#ffd85a');
      }
    } else if (gem.life <= 0) {
      gem.taken = true;
      dropTideObj(g, gem.mesh);
    }
  }
  td.xpGems = td.xpGems.filter(gem => !gem.taken);

  // 星燈雷雨風暴：頭頂跟隨玩家、每 0.26 秒連環落雷清場，結束時釋放終結雷爆
  for (const st of td.storms || []) {
    st.life -= dt;
    st.zapCd -= dt;
    const sy = p.y + 5.2 + Math.sin(g.time * 5) * 0.22;
    st.group.position.set(p.pos.x, sy, p.pos.z);
    st.group.rotation.y += dt * 1.6;
    if (st.zapCd <= 0) {
      st.zapCd = 0.26;
      const targets = g.enemies
        .filter(e => !e.dead && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 11.5)
        .sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z))
        .slice(0, 3);
      if (targets.length > 0) {
        g.audio.sfx('hit');
        let prev = null;
        for (const t of targets) {
          const ty = g.world.isLand(t.pos.x, t.pos.z) ? g.world.gh(t.pos.x, t.pos.z) : p.y;
          g.spawnBeam(p.pos.x, sy - 0.5, p.pos.z, t.pos.x, ty + 0.5, t.pos.z, 0x8ef0ff);
          if (prev) {
            const py = g.world.isLand(prev.pos.x, prev.pos.z) ? g.world.gh(prev.pos.x, prev.pos.z) : p.y;
            g.spawnBeam(prev.pos.x, py + 0.7, prev.pos.z, t.pos.x, ty + 0.7, t.pos.z, 0xffe87a);
          }
          const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
          g.hitEnemy(t, g.rollDamage(1.85, false), (dx / d) * 6.5, (dz / d) * 6.5, { stun: 0.45, isTrigger: true });
          g.applyElementAt(t.pos.x, t.pos.z, 'shock', 2.4);
          g.fx.burst(t.pos.x, ty + 0.6, t.pos.z, 6, { c: [0x8ef0ff, 0xffe87a, 0xffffff], s: 0.14, speed: 4.5, up: 3.5, life: 0.35 });
          prev = t;
        }
      } else {
        // 周圍暫無敵人時，向隨機空地降下氛圍落雷
        const ang = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 4.5;
        const tx = p.pos.x + Math.cos(ang) * r, tz = p.pos.z + Math.sin(ang) * r;
        const ty = g.world.isLand(tx, tz) ? g.world.gh(tx, tz) : p.y;
        g.spawnBeam(p.pos.x, sy - 0.5, p.pos.z, tx, ty + 0.2, tz, 0x8ef0ff);
      }
    }
    if (st.life <= 0) {
      g.audio.sfx('slam');
      g.shockRing(p.pos.x, p.pos.z, 9.5, g.rollDamage(3.6, true), 0x7ae8ff, 1.3, { isTrigger: true });
      g.applyElementAt(p.pos.x, p.pos.z, 'shock', 5.5);
      g.puffs.burst(p.pos.x, p.y + 0.8, p.pos.z, 24, { c: [0x7ae8ff, 0xffe87a, 0xffffff], s: 0.26, speed: 7.5, up: 5, life: 0.65 });
      g.ui.dmgNum(p.pos.x, p.y + 2.6, p.pos.z, '⚡ ZAP!', 'comic');
      dropTideObj(g, st.group);
    }
  }
  td.storms = (td.storms || []).filter(st => st.life > 0);

  // 巨型燈犬衝鋒更新
  for (const h of td.hounds) {
    h.life -= dt;
    h.x += h.dx * 17 * dt;
    h.z += h.dz * 17 * dt;
    const hy = g.world.isLand(h.x, h.z) ? g.world.gh(h.x, h.z) : p.y;
    h.mesh.position.set(h.x, hy + Math.abs(Math.sin(g.time * 16)) * 0.45, h.z);
    if (Math.random() < dt * 24) g.puffs.emit(h.x, hy + 0.3, h.z, { c: 0xffe480, s: 0.3, g: -0.5, life: 0.45, grow: 1.3 });
    for (const e of g.enemies) {
      if (e.dead || h.hit.has(e)) continue;
      if (Math.hypot(e.pos.x - h.x, e.pos.z - h.z) < e.r + 2.4) {
        h.hit.add(e);
        g.hitEnemy(e, g.rollDamage(4.0, true), h.dx * 11, h.dz * 11, { stun: 1.8, hitstop: 0.03, isTrigger: true });
      }
    }
    if (h.life <= 0) dropTideObj(g, h.mesh);
  }
  td.hounds = td.hounds.filter(h => h.life > 0);

  // 破曉大太陽升空與二次清場波
  for (const s of td.suns) {
    s.t += dt;
    const k = Math.min(1, s.t / s.max);
    s.mesh.position.set(s.x, s.y0 + k * 4.5, s.z);
    s.mesh.rotation.y += dt * 4;
    s.mesh.scale.setScalar(1 + k * 0.9);
    s.mesh.material.opacity = 1 - Math.max(0, (k - 0.55) / 0.45);
    if (!s.wave2 && k >= 0.45) {
      s.wave2 = true;
      g.shockRing(s.x, s.z, 14.5, g.rollDamage(2.6, true), 0xffcf4a, 0.9, { isTrigger: true });
    }
    if (s.t >= s.max) dropTideObj(g, s.mesh);
  }
  td.suns = td.suns.filter(s => s.t < s.max);

  // 無縫小強化自動觸發（彈跳火球 / 環繞旋風）
  if (td.microBuffs.bouncer > 0) {
    td.bouncerCd -= dt;
    if (td.bouncerCd <= 0) {
      td.bouncerCd = 2.2;
      const target = g.enemies.find(e => !e.dead && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 13);
      if (target) {
        const d = new THREE.Vector2(target.pos.x - p.pos.x, target.pos.z - p.pos.z).normalize();
        g.fireProj(p.pos, d, { speed: 15, mult: 1.25, fire: true, color: 0xff6a4a, size: 0.22, chain: 2, life: 1.2, isTrigger: true });
      }
    }
  }
  if (td.microBuffs.cyclone > 0) {
    td.cycloneCd -= dt;
    if (Math.random() < dt * 14) {
      const a = g.time * 7 + Math.random();
      g.fx.emit(p.pos.x + Math.cos(a) * 2.4, p.y + 0.5, p.pos.z + Math.sin(a) * 2.4, { c: 0x7ae8ff, s: 0.1, g: -0.4, life: 0.35 });
    }
    if (td.cycloneCd <= 0) {
      td.cycloneCd = 0.75;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 3.1 + e.r) {
          g.hitEnemy(e, g.rollDamage(0.65, false), (dx / Math.max(d, 0.1)) * 5, (dz / Math.max(d, 0.1)) * 5, { isDoT: true });
        }
      }
    }
  }
}

export function triggerTideDemo(g, stage = 'storm') {
  if (!g.field) g.enterField(1);
  if (!g.tide) g.tide = createTideState();
  const td = g.tide, p = g.player;
  if (stage === 'storm' || stage === 'fort') {
    td.heat = 78;
    td.phase = 2;
    td.apexTimer = 0;
    td.lullTimer = 0;
    td.ultCharge = 100;
    td.ultIndex = 0; // THUNDERSTORM!
    td.microBuffs.dice20 = 30;
    td.microBuffs.cyclone = 30;
    td.microBuffs.bouncer = 30;
    spawnSwarmWave(g, 16, true);
    castUltimate(g);
    spawnXpGems(g, p.pos.x + 2.5, p.pos.z + 1.8, 10);
    g.ui.dmgNum(p.pos.x + 3.0, p.y + 2.2, p.pos.z - 1.2, '🎲 TWENTY!', 'comic');
  } else if (stage === 'hound') {
    td.ultCharge = 100;
    td.ultIndex = 1; // WOOF!
    spawnSwarmWave(g, 10, false);
    castUltimate(g);
  } else if (stage === 'daybreak') {
    td.ultCharge = 100;
    td.ultIndex = 2; // DAYBREAK!
    castUltimate(g);
  } else if (stage === 'apex') {
    td.heat = 100;
    td.phase = 3;
    td.apexTimer = APEX_DURATION;
    td.lullTimer = 0;
    td.bossSpawned = false;
    spawnSwarmWave(g, 14, true);
    spawnTideBoss(g);
  } else if (stage === 'lull') {
    td.apexTimer = 0;
    td.lullTimer = LULL_DURATION;
    td.heat = 0;
    td.phase = -1;
    enterLullVisuals(g, true);
  }
}
