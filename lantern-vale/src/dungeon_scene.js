// Phase 3B：副本地城與終局 Boss 房專屬低面 3D 實模場景引擎
// 確保競技場核心半徑（r < 10.5m）完全暢通，於外環配置骷髏岩門、發光晶柱、燃燒火把與主題遺跡
import * as THREE from 'three';
import { attachLandmarkGlb } from './assets.js';

const THEME_CFG = {
  meadow: {
    crystalTint: 0x7ef0a8,
    crystalEmissive: 0x268c54,
    ringCol: 0x86f0a8,
    northKey: 'cave_arch',
    sideProps: ['stonehenge', 'giant_shroom'],
  },
  autumn: {
    crystalTint: 0xffc66e,
    crystalEmissive: 0xa85c1e,
    ringCol: 0xffc864,
    northKey: 'cave_arch',
    sideProps: ['forge_furnace', 'giant_shroom'],
  },
  snow: {
    crystalTint: 0x9ceeff,
    crystalEmissive: 0x368cc8,
    ringCol: 0x7ae8ff,
    northKey: 'cave_arch',
    sideProps: ['ice_crystal', 'stonehenge'],
  },
  ember: {
    crystalTint: 0xff7c48,
    crystalEmissive: 0xc43416,
    ringCol: 0xff7838,
    northKey: 'cave_skull',
    sideProps: ['forge_furnace', 'mine_cart'],
  },
  boss: {
    crystalTint: 0xd69cff,
    crystalEmissive: 0x7c38b8,
    ringCol: 0xffd268,
    northKey: 'cave_skull',
    sideProps: ['stonehenge', 'stonehenge'],
  },
};

export function buildDungeonScenery(g, { depth = 0, boss = false, biome } = {}) {
  const grp = new THREE.Group();
  const themeKey = boss ? 'boss' : (biome?.key || 'meadow');
  const cfg = THEME_CFG[themeKey] || THEME_CFG.meadow;

  const placeGlb = (key, x, z, ry = 0, opts = {}, obstR = 0) => {
    const holder = new THREE.Group();
    const y = Math.max(0, g.world.gh(x, z));
    holder.position.set(x, y, z);
    holder.rotation.y = ry;
    grp.add(holder);
    attachLandmarkGlb(holder, key, null, { emissive: 0x38322c, emissiveIntensity: 0.36, yOffset: -0.15, ...opts });
    if (obstR > 0) g.world.obstacles.push({ x, z, r: obstR, h: y });
    return holder;
  };

  const addTorch = (x, z, ry = 0) => {
    const holder = placeGlb('fire_torch', x, z, ry, { scale: 1.05, emissive: 0x5c3418, emissiveIntensity: 0.45 }, 0.45);
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb84a }),
    );
    flame.position.y = 2.65;
    flame.userData.noNormal = true;
    holder.add(flame);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.position.y = 2.65;
    glow.userData.noNormal = true;
    holder.add(glow);
    return holder;
  };

  // 1. 地面遠古魔法陣圓環（不擋走位，襯托 Boss 與副本競技場核心）
  const arenaR = boss ? 9.2 : 7.5;
  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(arenaR - 0.32, arenaR, 36),
    new THREE.MeshBasicMaterial({ color: cfg.ringCol, transparent: true, opacity: boss ? 0.55 : 0.34, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = Math.max(0, g.world.gh(0, 0)) + 0.08;
  ring1.userData.noNormal = true;
  grp.add(ring1);

  if (boss) {
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(4.4, 4.68, 28),
      new THREE.MeshBasicMaterial({ color: 0xd69cff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = ring1.position.y + 0.01;
    ring2.userData.noNormal = true;
    grp.add(ring2);
  }

  // 2. 正北主視覺聖殿／岩洞大門（避開既有出口門位置）
  const northZ = boss ? -13.2 : -14.0;
  const nearAnyExit = (x, z, minD = 4.6) => (g.exits || []).some(e => Math.hypot(e.x - x, e.z - z) < minD);
  if (!nearAnyExit(0, northZ, 4.2)) {
    placeGlb(cfg.northKey, 0, northZ, 0, {
      scale: boss ? 1.15 : 1.0,
      emissive: boss ? 0x483254 : 0x3a3430,
      emissiveIntensity: boss ? 0.44 : 0.36,
    }, 0);
  }

  // 3. 外環發光晶柱（Boss 房 6 根、一般地城房 4 根）＋火把柱
  const pillarCount = boss ? 6 : 4;
  const pillarR = boss ? 12.6 : 13.4;
  for (let i = 0; i < pillarCount; i++) {
    const ang = (i / pillarCount) * Math.PI * 2 + (boss ? Math.PI / 6 : Math.PI / 4);
    const px = Math.cos(ang) * pillarR, pz = Math.sin(ang) * pillarR;
    if (!g.world.isLand(px, pz) || nearAnyExit(px, pz, 4.4)) continue;
    const h = placeGlb('crystal_pillar', px, pz, -ang, {
      scale: boss ? 1.05 : 0.92,
      flatTint: cfg.crystalTint,
      emissive: cfg.crystalEmissive,
      emissiveIntensity: 0.48,
    }, 1.3);
    if (boss) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.35, 9.5, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: cfg.crystalTint, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      beam.position.y = 4.8;
      beam.userData.noNormal = true;
      h.add(beam);
    }
    // 每根晶柱內側微偏移擺放一支燃燒火把
    const tx = Math.cos(ang + 0.22) * (pillarR - 2.0), tz = Math.sin(ang + 0.22) * (pillarR - 2.0);
    if (g.world.isLand(tx, tz) && !nearAnyExit(tx, tz, 3.2)) addTorch(tx, tz, -ang);
  }

  // 4. 左右兩翼主題奇觀裝飾（巨石陣／鍛造爐／冰尖塔／礦車／營火）
  const wings = boss
    ? [[-8.8, -10.5, 0.35, 'stonehenge', 0.95], [8.8, -10.5, -0.35, 'stonehenge', 0.95]]
    : [[-10.2, -7.8, 0.4, cfg.sideProps[0], 0.9], [10.2, -7.8, -0.4, cfg.sideProps[1], 0.95]];
  for (const [wx, wz, ry, key, sc] of wings) {
    if (!g.world.isLand(wx, wz) || nearAnyExit(wx, wz, 4.4)) continue;
    const extra = key === 'ice_crystal'
      ? { flatTint: 0xa4ecff, emissive: 0x3b8ec4, emissiveIntensity: 0.44 }
      : key === 'forge_furnace'
        ? { emissive: 0x622614, emissiveIntensity: 0.46 }
        : {};
    placeGlb(key, wx, wz, ry, { scale: sc, ...extra }, 1.8);
  }

  // 5. 玩家進場點側邊放置低面石圈營火（一般房作為溫馨起點地標）
  if (!boss) {
    const cx = (g.player?.pos?.x || 0) + 4.4, cz = (g.player?.pos?.z || 4) - 1.5;
    if (g.world.isLand(cx, cz) && !nearAnyExit(cx, cz, 3.2)) {
      placeGlb('cave_campfire', cx, cz, 0.2, { scale: 1.05, emissive: 0x7a3a16, emissiveIntensity: 0.48 }, 0.9);
    }
  }

  g.world.group.add(grp);
  return grp;
}
