// 燈谷行 3D 坐騎系統與里程碑解鎖規劃（按 G 鍵召喚／下馬）
import * as THREE from 'three';
import { toonMat } from './world.js';

export const MOUNTS = [
  {
    id: 'stag',
    name: '林間巨鹿',
    icon: '🦌',
    tier: 1,
    speedMult: 1.45,
    jumpBonus: 1.8,
    hoverWater: false,
    color: 0xb88454,
    accent: 0xffe49e,
    milestone: '旅人達 Lv.10 且累計討伐 60 隻魔物',
    saddleCost: { coins: 250, goods: { wood: 5 } },
    saddleText: '🪙250 金幣 + 🪵5 香杉木',
    perk: '移速 +45% · 跳躍高度提升 · 奔跑不消耗耐力',
    check: p => {
      const lv = p.level || 1, kills = p.kills || 0;
      const checks = [
        { label: `旅人等級 Lv.${lv}/10`, ok: lv >= 10 },
        { label: `討伐魔物 ${kills}/60`, ok: kills >= 60 },
      ];
      const unlocked = checks.every(c => c.ok);
      const prog = (Math.min(1, lv / 10) + Math.min(1, kills / 60)) / 2;
      const text = unlocked ? '里程碑已達成' : `Lv.${lv}/10 且 擊殺 ${kills}/60`;
      return { unlocked, prog, text, checks };
    },
  },
  {
    id: 'alpaca',
    name: '雲絨角獸',
    icon: '🦙',
    tier: 2,
    speedMult: 1.55,
    jumpBonus: 2.2,
    immuneChill: true,
    ramKnockback: true,
    hoverWater: false,
    color: 0xf4eee2,
    accent: 0x7ae8ff,
    milestone: '旅人達 Lv.15 且探索 5 區 且收集 3 根金羽毛',
    saddleCost: { coins: 550, goods: { ore: 6 } },
    saddleText: '🪙550 金幣 + ⛏️6 星紋礦',
    perk: '移速 +55% · 免疫寒霜緩速 · 騎乘衝撞可彈飛小怪',
    check: p => {
      const lv = p.level || 1;
      const visited = (p.visitedFields || []).length;
      const feathers = p.feathers || 0;
      const checks = [
        { label: `旅人等級 Lv.${lv}/15`, ok: lv >= 15 },
        { label: `探索野外區域 ${visited}/5`, ok: visited >= 5 },
        { label: `金羽毛 ${feathers}/3`, ok: feathers >= 3 },
      ];
      const unlocked = checks.every(c => c.ok);
      const prog = (Math.min(1, lv / 15) + Math.min(1, visited / 5) + Math.min(1, feathers / 3)) / 3;
      const text = unlocked ? '里程碑已達成' : `Lv.${lv}/15 · 探索 ${visited}/5 · 金羽毛 ${feathers}/3`;
      return { unlocked, prog, text, checks };
    },
  },
  {
    id: 'manta',
    name: '星翼浮鰩',
    icon: '🛸',
    tier: 3,
    speedMult: 1.65,
    jumpBonus: 2.8,
    glideSave: 0.6,
    hoverWater: true,
    color: 0x56b8e6,
    accent: 0xffd85a,
    milestone: '旅人達 Lv.20 且完成職業二轉覺醒 且討伐守護獸 2 次',
    saddleCost: { coins: 1000, shards: 60, mMats: { sky_feather: 5 } },
    saddleText: '🪙1000 金幣 + 💎60 星砂 + 🦅5 雲翼風羽',
    perk: '移速 +65% · 滑翔耗耐 -60% · 可於水面低空懸浮滑行',
    check: p => {
      const lv = p.level || 1;
      const asc = !!p.secondClass;
      const bosses = (p.best?.wins || 0) + (p.species?.stag || 0);
      const checks = [
        { label: `旅人等級 Lv.${lv}/20`, ok: lv >= 20 },
        { label: `職業二轉覺醒 ${asc ? '✔' : '未完成'}`, ok: asc },
        { label: `討伐守護獸 ${bosses}/2`, ok: bosses >= 2 },
      ];
      const unlocked = checks.every(c => c.ok);
      const prog = (Math.min(1, lv / 20) + (asc ? 1 : 0) + Math.min(1, bosses / 2)) / 3;
      const text = unlocked ? '里程碑已達成' : `Lv.${lv}/20 · 二轉${asc ? '✔' : '✖'} · 守護獸 ${bosses}/2`;
      return { unlocked, prog, text, checks };
    },
  },
  {
    id: 'fox',
    name: '櫻風神狐',
    icon: '🦊',
    tier: 4,
    speedMult: 1.72,
    jumpBonus: 3.1,
    hoverWater: true,
    color: 0xffb3cf,
    accent: 0xffd85a,
    milestone: '旅人達 Lv.25 且探索 12 個野外區域 且討伐 300 隻魔物',
    saddleCost: { coins: 1800, shards: 120, mMats: { boss_heart: 2 } },
    saddleText: '🪙1800 金幣 + 💎120 星砂 + 👑2 巨獸星心',
    perk: '移速 +72% · 超高跳躍 · 水面疾行並灑落櫻花瓣軌跡',
    check: p => {
      const lv = p.level || 1;
      const visited = (p.visitedFields || []).length;
      const kills = p.kills || 0;
      const checks = [
        { label: `旅人等級 Lv.${lv}/25`, ok: lv >= 25 },
        { label: `探索野外區域 ${visited}/12`, ok: visited >= 12 },
        { label: `討伐魔物 ${kills}/300`, ok: kills >= 300 },
      ];
      const unlocked = checks.every(c => c.ok);
      const prog = (Math.min(1, lv / 25) + Math.min(1, visited / 12) + Math.min(1, kills / 300)) / 3;
      const text = unlocked ? '里程碑已達成' : `Lv.${lv}/25 · 探索 ${visited}/12 · 擊殺 ${kills}/300`;
      return { unlocked, prog, text, checks };
    },
  },
];

export function isMountOwned(metaP, mountId) {
  return Array.isArray(metaP?.ownedMounts) && metaP.ownedMounts.includes(mountId);
}

export function canCraftMountSaddle(metaP, mountDef) {
  if (!metaP || !mountDef) return false;
  if (!mountDef.check(metaP).unlocked || isMountOwned(metaP, mountDef.id)) return false;
  const c = mountDef.saddleCost || {};
  if ((metaP.coins || 0) < (c.coins || 0)) return false;
  if ((metaP.shards || 0) < (c.shards || 0)) return false;
  const gd = metaP.goods || {};
  for (const [k, need] of Object.entries(c.goods || {})) if ((gd[k] || 0) < need) return false;
  const mm = metaP.mMats || {};
  for (const [k, need] of Object.entries(c.mMats || {})) if ((mm[k] || 0) < need) return false;
  return true;
}

export function unlockMountSaddle(metaP, mountId) {
  const def = MOUNTS.find(m => m.id === mountId);
  if (!metaP || !def) return { ok: false, reason: '未知坐騎' };
  if (!def.check(metaP).unlocked) return { ok: false, reason: `尚未達成「${def.name}」里程碑` };
  if (isMountOwned(metaP, mountId)) return { ok: true, mount: def, alreadyOwned: true };
  if (!canCraftMountSaddle(metaP, def)) return { ok: false, reason: `馴養／鍛造鞍具材料不足（需 ${def.saddleText}）` };
  const c = def.saddleCost || {};
  metaP.coins = (metaP.coins || 0) - (c.coins || 0);
  metaP.shards = (metaP.shards || 0) - (c.shards || 0);
  for (const [k, need] of Object.entries(c.goods || {})) metaP.goods[k] -= need;
  for (const [k, need] of Object.entries(c.mMats || {})) metaP.mMats[k] -= need;
  metaP.ownedMounts = Array.isArray(metaP.ownedMounts) ? metaP.ownedMounts : [];
  metaP.ownedMounts.push(mountId);
  metaP.mountId = mountId;
  return { ok: true, mount: def };
}

export function mountStatuses(metaP) {
  const p = metaP || {};
  return MOUNTS.map(m => {
    const status = m.check(p);
    const owned = isMountOwned(p, m.id);
    const canCraft = canCraftMountSaddle(p, m);
    return { ...m, status, owned, canCraft };
  });
}

export function activeMountDef(metaP) {
  if (!metaP) return null;
  const eligible = MOUNTS.filter(m => isMountOwned(metaP, m.id) && m.check(metaP).unlocked);
  return eligible.find(m => m.id === metaP.mountId) || eligible[0] || null;
}

// 建立原創風格化低多邊形 3D 坐騎模型
export function buildMountMesh(mountId) {
  const g = new THREE.Group();
  const legs = [];
  const wings = [];
  if (mountId === 'stag') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.56, 1.38), toonMat({ color: 0xb88454 }));
    body.position.set(0, 0.82, 0); body.castShadow = true; g.add(body);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.65), toonMat({ color: 0xc94a3c }));
    saddle.position.set(0, 1.12, -0.05); g.add(saddle);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 0.34), toonMat({ color: 0xb88454 }));
    neck.position.set(0, 1.24, 0.54); neck.rotation.x = 0.25; g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.52), toonMat({ color: 0xc89564 }));
    head.position.set(0, 1.56, 0.72); g.add(head);
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.58, 5), toonMat({ color: 0xffe49e }));
      ant.position.set(s * 0.22, 1.88, 0.66); ant.rotation.z = -s * 0.35; g.add(ant);
      const branch = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.32, 4), toonMat({ color: 0xffe49e }));
      branch.position.set(s * 0.34, 1.98, 0.74); branch.rotation.z = -s * 0.65; g.add(branch);
    }
    for (const [lx, lz] of [[-0.22, 0.48], [0.22, 0.48], [-0.22, -0.48], [0.22, -0.48]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.68, 0.14), toonMat({ color: 0x7c5234 }));
      leg.position.set(lx, 0.34, lz); leg.castShadow = true; g.add(leg); legs.push(leg);
    }
  } else if (mountId === 'alpaca') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.72, 1.32), toonMat({ color: 0xf4eee2 }));
    body.position.set(0, 0.8, 0); body.castShadow = true; g.add(body);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.14, 0.72), toonMat({ color: 0x3b8ea5 }));
    rug.position.set(0, 1.15, 0); g.add(rug);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.68, 0.36), toonMat({ color: 0xf4eee2 }));
    neck.position.set(0, 1.32, 0.48); g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.48), toonMat({ color: 0xfff8ec }));
    head.position.set(0, 1.68, 0.62); g.add(head);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), toonMat({ color: 0x7ae8ff }));
      horn.position.set(s * 0.18, 1.92, 0.56); horn.rotation.z = -s * 0.25; g.add(horn);
    }
    for (const [lx, lz] of [[-0.26, 0.42], [0.26, 0.42], [-0.26, -0.42], [0.26, -0.42]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.18), toonMat({ color: 0xd8cbb8 }));
      leg.position.set(lx, 0.28, lz); leg.castShadow = true; g.add(leg); legs.push(leg);
    }
  } else if (mountId === 'fox') {
    // 櫻風神狐（九尾靈狐風格，粉白蓬鬆毛髮＋金鈴項圈＋雙尾）
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 1.32), toonMat({ color: 0xfff2f6 }));
    body.position.set(0, 0.72, 0); body.castShadow = true; g.add(body);
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.56), toonMat({ color: 0xeb6a98 }));
    scarf.position.set(0, 0.98, 0.05); g.add(scarf);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.48), toonMat({ color: 0xfff6f8 }));
    head.position.set(0, 1.15, 0.68); g.add(head);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 4), toonMat({ color: 0xff9ec2 }));
      ear.position.set(s * 0.16, 1.46, 0.62); ear.rotation.z = -s * 0.2; g.add(ear);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.05, 6), toonMat({ color: 0xffb3cf }));
      tail.position.set(s * 0.22, 0.95, -0.95); tail.rotation.x = -0.95; tail.rotation.z = -s * 0.35; g.add(tail);
      wings.push(tail);
    }
    for (const [lx, lz] of [[-0.2, 0.44], [0.2, 0.44], [-0.2, -0.44], [0.2, -0.44]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.56, 0.13), toonMat({ color: 0xeb7aa8 }));
      leg.position.set(lx, 0.28, lz); leg.castShadow = true; g.add(leg); legs.push(leg);
    }
  } else {
    // 星翼浮鰩（低空懸浮坐騎）
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), toonMat({ color: 0x56b8e6 }));
    core.scale.set(1.1, 0.42, 1.55); core.position.set(0, 0.72, 0); core.castShadow = true; g.add(core);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.65), toonMat({ color: 0xffd85a }));
    crest.position.set(0, 0.96, 0); g.add(crest);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.92), toonMat({ color: 0x7adcf8 }));
      w.position.set(s * 0.85, 0.74, -0.05); w.rotation.y = s * 0.22; w.castShadow = true;
      g.add(w); wings.push(w);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 5), toonMat({ color: 0xffe480 }));
    tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.7, -1.15); g.add(tail);
  }
  return { root: g, legs, wings, seatY: mountId === 'manta' ? 0.92 : 1.05 };
}
