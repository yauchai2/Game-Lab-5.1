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
    milestone: '旅人達 Lv.5 或累計擊敗 20 隻魔物',
    perk: '移速 +45% · 跳躍高度提升 · 奔跑不消耗耐力',
    check: p => {
      const lv = p.level || 1, kills = p.kills || 0;
      const unlocked = lv >= 5 || kills >= 20;
      const prog = Math.max(Math.min(1, lv / 5), Math.min(1, kills / 20));
      const text = unlocked ? '已解鎖' : `Lv.${lv}/5 或 擊殺 ${kills}/20`;
      return { unlocked, prog, text };
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
    milestone: '探索 3 個野外區域 或 收集 3 根金羽毛',
    perk: '移速 +55% · 免疫寒霜緩速 · 騎乘衝撞可彈飛小怪',
    check: p => {
      const visited = (p.visitedFields || []).length;
      const feathers = p.feathers || 0;
      const unlocked = visited >= 3 || feathers >= 3;
      const prog = Math.max(Math.min(1, visited / 3), Math.min(1, feathers / 3));
      const text = unlocked ? '已解鎖' : `探索 ${visited}/3 區 或 金羽毛 ${feathers}/3`;
      return { unlocked, prog, text };
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
    milestone: '完成二轉職業覺醒 或 擊敗古樹鹿王',
    perk: '移速 +65% · 滑翔耗耐 -60% · 可於水面低空懸浮滑行',
    check: p => {
      const asc = !!p.secondClass;
      const boss = (p.best?.wins || 0) >= 1 || (p.species?.stag || 0) >= 1;
      const unlocked = asc || boss;
      const prog = unlocked ? 1 : Math.min(0.85, ((p.level || 1) / 10) * 0.85);
      const text = unlocked ? '已解鎖' : '需完成二轉覺醒或擊敗古樹鹿王';
      return { unlocked, prog, text };
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
    milestone: '探索 6 個野外區域 或 旅人達 Lv.18',
    perk: '移速 +72% · 超高跳躍 · 水面疾行並灑落櫻花瓣軌跡',
    check: p => {
      const visited = (p.visitedFields || []).length;
      const lv = p.level || 1;
      const unlocked = visited >= 6 || lv >= 18;
      const prog = Math.max(Math.min(1, visited / 6), Math.min(1, lv / 18));
      const text = unlocked ? '已解鎖' : `探索 ${visited}/6 區 或 Lv.${lv}/18`;
      return { unlocked, prog, text };
    },
  },
];

export function mountStatuses(metaP) {
  return MOUNTS.map(m => ({ ...m, status: m.check(metaP || {}) }));
}

export function activeMountDef(metaP) {
  if (!metaP) return null;
  const list = mountStatuses(metaP);
  if (metaP.mountId) {
    const picked = list.find(m => m.id === metaP.mountId && m.status.unlocked);
    if (picked) return picked;
  }
  return list.find(m => m.status.unlocked) || null;
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
