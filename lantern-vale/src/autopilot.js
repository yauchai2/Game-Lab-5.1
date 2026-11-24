// Phase 5A：🏮 提燈自動巡遊（Lantern Autopilot）
// 含：收益分層（XP/金幣 30% · 素材 35% · 裝掉 20% 上限紫裝）、領航小星燈、手動星火充能（歸來 ×1.5）、安全防呆、自動分解與桌寵觀賞鏡頭

import * as THREE from 'three';
import { getTerrainEffect } from './terrain_fx.js';
import { teleportToCheckpoint } from './frontier.js';
import { isFeatureEnabled, consumeLanternOil } from './mmo_protocol.js';

export const AUTO_RATES = {
  xpMult: 0.30,
  coinMult: 0.30,
  matMult: 0.35,
  dropChanceMult: 0.20,
  maxDropRarity: 2, // 0=白, 1=綠, 2=紫（傳說/神話/靈魂/部位破壞限定手動）
  sparkChargeSec: 120,
  sparkChargeKills: 15,
  sparkMax: 5,
  sparkBonusMult: 1.5,
  sparkDurPerStack: 30,
  tetherRadius: 28,
  cozyCamDelay: 20,
};

export function createAutopilotState() {
  return {
    mode: 'off', // 'off' | 'full' | 'assist'
    anchor: { x: 0, z: 0 },
    autoSalvage: true,
    cozyCam: true,
    cozyActive: false,
    idleT: 0,
    patrolA: 0,
    attackCd: 0,
    skillCd: 0,
    target: null,
    aimVec: null,
    sparkStacks: 0,
    sparkChargeT: 0,
    sparkKillProg: 0,
    sparkBuffT: 0,
    stats: { sec: 0, kills: 0, xp: 0, coins: 0, shards: 0, mats: 0 },
    wispMesh: null,
    _savedZoom: null,
  };
}

export function isAutopilotActive(g) {
  return !!(g?.autopilot && g.autopilot.mode !== 'off');
}

export function manualSparkMult(g) {
  if (isAutopilotActive(g)) return 1;
  return (g?.autopilot?.sparkBuffT || 0) > 0 ? AUTO_RATES.sparkBonusMult : 1;
}

function removeGuideWisp(g) {
  const ap = g.autopilot;
  if (ap?.wispMesh) {
    g.scene?.remove?.(ap.wispMesh);
    ap.wispMesh.traverse?.(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
    ap.wispMesh = null;
  }
}

function ensureGuideWisp(g) {
  const ap = g.autopilot;
  if (!ap || ap.wispMesh || !g.scene) return;
  const grp = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe478 })
  );
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc84a, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
  );
  halo.rotation.x = Math.PI / 2;
  grp.add(core, halo);
  grp.userData.noNormal = true;
  g.scene.add(grp);
  ap.wispMesh = grp;
}

export function toggleAutopilot(g, nextMode = null, reason = 'toggle') {
  const ap = g.autopilot || (g.autopilot = createAutopilotState());
  const targetMode = nextMode ?? (ap.mode === 'off' ? 'full' : 'off');
  if (targetMode !== 'off' && !isFeatureEnabled(g.features, 'autopilot')) {
    g.ui?.toast?.('⚠️ 伺服器維護中：提燈巡遊暫時關閉', '#ff9a8a');
    return false;
  }

  if (targetMode !== 'off' && g.depth < 0 && !g.field) {
    g.ui?.toast?.('🏮 請前往野外或副本地城再開啟「提燈自動巡遊」！', '#ffe08a');
    return false;
  }

  if (targetMode === 'off') {
    if (ap.mode === 'off') return false;
    ap.mode = 'off';
    ap.target = null;
    ap.aimVec = null;
    ap.cozyActive = false;
    if (ap._savedZoom != null) { g.camZoom = ap._savedZoom; ap._savedZoom = null; }
    removeGuideWisp(g);

    // 若已累積「手動星火」，切回手動立即引爆「✨ 歸來爆發 ×1.5」！
    if (ap.sparkStacks > 0) {
      const addDur = ap.sparkStacks * AUTO_RATES.sparkDurPerStack;
      ap.sparkBuffT = Math.min(180, (ap.sparkBuffT || 0) + addDur);
      const stacks = ap.sparkStacks;
      ap.sparkStacks = 0;
      g.audio?.sfx?.('win');
      g.fx?.burst?.(g.player.pos.x, g.player.y + 1.2, g.player.pos.z, 24, { c: [0xffd85a, 0xff9838, 0xffffff], s: 0.14, speed: 5.5, up: 4.5, life: 0.65 });
      g.ui?.toast?.(`✨ 歸來星火爆發（${stacks} 層）！接下來 ${Math.ceil(ap.sparkBuffT)} 秒手動經驗＆掉寶率 ×1.5！`, '#ffd85a');
    } else if (ap.stats.kills > 0) {
      const mins = Math.floor(ap.stats.sec / 60), secs = Math.floor(ap.stats.sec % 60);
      g.ui?.toast?.(`🏮 提燈巡遊結束（${mins}:${String(secs).padStart(2, '0')}）· 擊殺 ${ap.stats.kills} · 經驗 +${ap.stats.xp} · 金幣 +${ap.stats.coins}${ap.stats.shards ? ` · 星砂 +${ap.stats.shards}` : ''}`, '#ffe8a8');
    } else if (reason === 'manual') {
      g.ui?.toast?.('🕹️ 已瞬間接管為手動操作', '#e8dcc8');
    } else {
      g.ui?.toast?.('🏮 已關閉提燈自動巡遊', '#e8dcc8');
    }
    return true;
  }

  // 開啟全自動或半自動巡遊
  const wasOff = ap.mode === 'off';
  ap.mode = targetMode;
  ap.idleT = 0;
  ap.cozyActive = false;
  if (wasOff) {
    ap.anchor = { x: g.player.pos.x, z: g.player.pos.z };
    ap.stats = { sec: 0, kills: 0, xp: 0, coins: 0, shards: 0, mats: 0 };
    ap._savedZoom = g.camZoom ?? 1.0;
    ensureGuideWisp(g);
  }
  g.audio?.sfx?.('wisp');
  const label = targetMode === 'full' ? '全自動巡遊' : '半自動施法輔助';
  g.ui?.toast?.(`🏮 提燈${label}啟動（收益 30% · 累積手動星火）｜按 WASD 或 [Z] 立即接管`, '#ffd85a');
  return true;
}

export function onAutopilotKill(g, { xp = 0, coins = 0, mats = 0 } = {}) {
  const ap = g?.autopilot;
  if (!ap || ap.mode === 'off') return;
  ap.stats.kills++;
  ap.stats.xp += xp;
  ap.stats.coins += coins;
  ap.stats.mats += mats;
  ap.sparkKillProg++;
  if (ap.sparkKillProg >= AUTO_RATES.sparkChargeKills) {
    ap.sparkKillProg = 0;
    if (ap.sparkStacks < AUTO_RATES.sparkMax) {
      ap.sparkStacks++;
      g.ui?.toast?.(`🔥 手動星火充能 (${ap.sparkStacks}/${AUTO_RATES.sparkMax})！關閉巡遊接管手動即享 ×1.5 爆發`, '#ffb84a');
    }
  }
}

export function tickAutopilot(g, dt, manualMv) {
  const ap = g.autopilot;
  if (!ap) return null;

  // 手動歸來星火爆發倒數
  if (ap.mode === 'off') {
    if (ap.sparkBuffT > 0) ap.sparkBuffT = Math.max(0, ap.sparkBuffT - dt);
    return null;
  }

  // 進入城鎮自動關閉
  if (g.depth < 0 && !g.field) {
    toggleAutopilot(g, 'off', 'town');
    return null;
  }

  // 全自動模式下，玩家一按 WASD 立刻零摩擦切回手動
  if (ap.mode === 'full' && manualMv && manualMv.lengthSq() > 0.05) {
    toggleAutopilot(g, 'off', 'manual');
    return null;
  }

  const p = g.player;
  ap.stats.sec += dt;
  ap.idleT += dt;
  ap.attackCd = Math.max(0, ap.attackCd - dt);
  ap.skillCd = Math.max(0, ap.skillCd - dt);

  // 時間累積手動星火（每 2 分鐘 +1 層，上限 5 層）
  ap.sparkChargeT += dt;
  if (ap.sparkChargeT >= AUTO_RATES.sparkChargeSec) {
    ap.sparkChargeT -= AUTO_RATES.sparkChargeSec;
    if (ap.sparkStacks < AUTO_RATES.sparkMax) {
      ap.sparkStacks++;
      g.ui?.toast?.(`🔥 手動星火充能 (${ap.sparkStacks}/${AUTO_RATES.sparkMax})！接管手動即獲 ×1.5 歸來爆發`, '#ffb84a');
    }
  }

  // 線上 MMO 模式下消耗每日提燈油量（單機離線模式維持無限制）
  if (g.net?.ok && g.meta?.p) {
    const rem = consumeLanternOil(g.meta.p, dt);
    if (rem <= 0) {
      g.ui?.toast?.('🛢️ 今日線上提燈油量已用罄！完成手動每日委託可補充 +30 分鐘', '#ffd85a');
      toggleAutopilot(g, 'off', 'oil_empty');
      return null;
    }
  }
  // 領航小星燈漂浮動畫
  ensureGuideWisp(g);
  if (ap.wispMesh) {
    const t = g.time || ap.stats.sec;
    ap.wispMesh.position.set(
      p.pos.x + Math.cos(t * 2.4) * 0.55,
      (p.y || 0) + 1.85 + Math.sin(t * 3.8) * 0.16,
      p.pos.z + Math.sin(t * 2.4) * 0.55
    );
    ap.wispMesh.rotation.y = t * 2.6;
  }

  // 🎥 桌寵觀賞鏡頭（Cozy Cam）：20 秒無操作後自動微拉近並緩慢環繞
  if (ap.cozyCam && ap.idleT >= AUTO_RATES.cozyCamDelay) {
    ap.cozyActive = true;
    g.camZoom += (0.86 - (g.camZoom ?? 1)) * Math.min(1, dt * 1.8);
    g.camYaw = (g.camYaw || 0.62) + dt * 0.13;
  } else {
    ap.cozyActive = false;
  }

  // 🛡️ 安全機制 1：HP < 45% 自動喝蜜藥瓶
  if (p.hp < p.stats.maxHp * 0.45 && p.flask.charges > 0 && (p.healOver || 0) <= 0) {
    g.tryFlask?.();
  }
  // 🛡️ 安全機制 2：HP < 25% 且沒藥水 → 觸發「歸途庇護」撤退至最近已解鎖檢查點並休整，絕不掉墓碑！
  if (p.hp < p.stats.maxHp * 0.25 && p.flask.charges <= 0) {
    const unlocked = (g.checkpoints || []).filter(c => c.unlocked);
    if (unlocked.length) {
      unlocked.sort((a, b) => Math.hypot(a.x - p.pos.x, a.z - p.pos.z) - Math.hypot(b.x - p.pos.x, b.z - p.pos.z));
      teleportToCheckpoint(g, unlocked[0].idx);
    } else {
      p.pos.set(ap.anchor.x, g.world?.gh?.(ap.anchor.x, ap.anchor.z) || 0, ap.anchor.z);
    }
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.4);
    g.ui?.toast?.('🛡️ 觸發「歸途庇護」！血量危急已自動撤退至安全點並暫停巡遊', '#7ae8ff');
    toggleAutopilot(g, 'off', 'safety');
    return null;
  }

  // 🎒 自動拾取＆防爆包低階裝分解（白／綠裝自動轉星砂）
  if (g.drops?.length) {
    for (let i = g.drops.length - 1; i >= 0; i--) {
      const d = g.drops[i];
      if (d.kind !== 'item') continue;
      const dist = Math.hypot(d.g.position.x - p.pos.x, d.g.position.z - p.pos.z);
      if (dist < 3.4) {
        if (ap.autoSalvage && (d.item?.rarity ?? 0) <= 1) {
          const gain = d.item.rarity === 1 ? 4 : 2;
          g.meta.p.shards = (g.meta.p.shards || 0) + gain;
          ap.stats.shards += gain;
          g.meta.save?.();
          if (g.disposeDrop) g.disposeDrop(d); else g.scene?.remove?.(d.g);
          g.drops.splice(i, 1);
          g.fx?.burst?.(p.pos.x, p.y + 0.9, p.pos.z, 6, { c: [0xc08cff, 0xffe480], s: 0.09, speed: 3, up: 2.5, life: 0.4 });
        } else {
          g.tryPickup?.();
        }
        break;
      }
    }
  }

  // 🎯 鎖定巡航圈內最近普通敵人（不主動拉區域守護 Boss）
  let best = null, bestD = AUTO_RATES.tetherRadius;
  for (const e of g.enemies || []) {
    if (e.dead || e.legendary || e.type === 'stag') continue;
    const dAnchor = Math.hypot(e.pos.x - ap.anchor.x, e.pos.z - ap.anchor.z);
    if (dAnchor > AUTO_RATES.tetherRadius + 6) continue;
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    if (d < bestD) { bestD = d; best = e; }
  }
  ap.target = best;

  let mvX = 0, mvZ = 0;
  if (best) {
    const dx = best.pos.x - p.pos.x, dz = best.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    ap.aimVec = { x: dx / d, y: dz / d };

    const isRanged = g.meta?.p?.weapon === 'bow' || g.meta?.p?.weapon === 'staff';
    const wantDist = isRanged ? 6.2 : 2.3;
    if (ap.mode === 'full') {
      if (d > wantDist + 0.8) { mvX = dx / d; mvZ = dz / d; }
      else if (d < wantDist - 1.1) { mvX = -dx / d; mvZ = -dz / d; }
      else {
        // 靈活橫向環繞走位
        mvX = -dz / d * 0.55; mvZ = dx / d * 0.55;
      }
    }

    // 施放普攻與拼圖技能
    const attackRange = isRanged ? 11.5 : 3.4;
    if (d <= attackRange && ap.attackCd <= 0) {
      ap.attackCd = 0.24;
      g.tryAttack?.();
    }
    if (d <= 9.5 && ap.skillCd <= 0 && p.mana >= p.stats.mana * 0.3) {
      for (let s = 0; s < 4; s++) {
        if (p.hotbar?.[s] && (p.skillCds?.[s] || 0) <= 0) {
          g.castHotbar?.(s);
          ap.skillCd = 0.9;
          break;
        }
      }
    }
  } else {
    ap.aimVec = null;
    if (ap.mode === 'full') {
      // 沒敵人時在錨點周圍溫和巡邏
      ap.patrolA += dt * 0.45;
      const gx = ap.anchor.x + Math.cos(ap.patrolA) * 9.5;
      const gz = ap.anchor.z + Math.sin(ap.patrolA) * 9.5;
      const dx = gx - p.pos.x, dz = gz - p.pos.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.8) { mvX = (dx / d) * 0.72; mvZ = (dz / d) * 0.72; }
    }
  }

  // 🛡️ 避開危險淺區（熔岩／毒沼／異星酸池）與超界拉回
  if (ap.mode === 'full') {
    const sk = g.world?.shallowAt?.(p.pos.x, p.pos.z);
    const tfx = getTerrainEffect(sk);
    const dAnc = Math.hypot(p.pos.x - ap.anchor.x, p.pos.z - ap.anchor.z);
    if (tfx?.hazard || dAnc > AUTO_RATES.tetherRadius + 2) {
      const rx = ap.anchor.x - p.pos.x, rz = ap.anchor.z - p.pos.z, rd = Math.hypot(rx, rz) || 1;
      mvX = rx / rd; mvZ = rz / rd;
    }
    return { x: mvX, y: mvZ };
  }
  return null;
}
