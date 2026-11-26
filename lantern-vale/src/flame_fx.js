// Beaconfall Flame: ground rings that show the safe light radius of lit star lanterns, campfires and gates.
import * as THREE from 'three';
import { lightSources, isDarkZone } from './flame.js';

const SEG = 72;
const COLORS = { lantern: 0xffd36e, campfire: 0xffa040, gate: 0xcfe8ff };

function ringGeo(g, cx, cz, r) {
  const pos = new Float32Array((SEG + 1) * 2 * 3), idx = [];
  const w = 0.34;
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    for (let k = 0; k < 2; k++) {
      const rr = k ? r : r - w, x = cx + c * rr, z = cz + s * rr;
      const o = (i * 2 + k) * 3;
      pos[o] = x; pos[o + 1] = g.world.gh(x, z) + 0.12; pos[o + 2] = z;
    }
    if (i < SEG) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

function clearRings(g) {
  for (const r of g._lightRings?.values() || []) { r.mesh.parent?.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
  g._lightRings = new Map();
}

/** Call every frame in play. Cheap: rings are rebuilt only when the set of light sources changes. */
export function syncLightRings(g, dt) {
  const grp = g.world?.group;
  if (!grp || !isDarkZone(g)) { if (g._lightRings?.size) clearRings(g); g._ringOwner = null; return; }
  if (g._ringOwner !== grp) { clearRings(g); g._ringOwner = grp; g._ringT = 0; }
  g._ringT = (g._ringT || 0) - dt;
  if (g._ringT <= 0) {
    g._ringT = 0.5;
    const want = new Map(lightSources(g).map(s => [s.id, s]));
    for (const [id, r] of [...g._lightRings]) if (!want.has(id)) { grp.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); g._lightRings.delete(id); }
    for (const [id, s] of want) {
      if (g._lightRings.has(id)) continue;
      const mat = new THREE.MeshBasicMaterial({ color: COLORS[s.kind] || 0xffd36e, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(ringGeo(g, s.x, s.z, s.r), mat);
      mesh.userData.noNormal = true; mesh.frustumCulled = false;
      grp.add(mesh); g._lightRings.set(id, { mesh, phase: Math.random() * 6 });
    }
  }
  const t = g.time || 0;
  for (const r of g._lightRings.values()) r.mesh.material.opacity = 0.34 + Math.sin(t * 1.6 + r.phase) * 0.12;
}
