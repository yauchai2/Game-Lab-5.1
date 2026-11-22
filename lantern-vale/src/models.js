import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { part, toonMat } from './world.js';

// All characters are original, built from primitives (no external assets).

function mesh(geo, opts = {}) {
  const m = new THREE.Mesh(geo, toonMat({ vertexColors: true, ...opts }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Player: "Wick" — a small lantern-bearer in a teal hood and rust scarf.
export function buildPlayer(hood = 0x2f8a7e, hoodDark = 0x23695f, scarfCol = 0xd9543a, look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const cloak = mesh(mergeGeometries([
    part(new THREE.ConeGeometry(0.38, 0.62, 7), hood, 0, 0.36, 0),
    part(new THREE.CylinderGeometry(0.33, 0.39, 0.08, 7), hoodDark, 0, 0.07, 0),
  ]));
  body.add(cloak);
  const head = new THREE.Group(); head.position.y = 0.78; body.add(head);
  const skin = [0xf6e3c8,0xd9ab79,0xb97c57,0x79503f][look?.skin ?? 0];
  const hair = [0x70452e,0x392e35,0xd6a54f,0xbcb8b5][look?.hair ?? 0];
  const face = new THREE.SphereGeometry(0.22, 8, 6);
  if (look?.face === 1) face.scale(0.94, 1.16, 1);
  if (look?.face === 2) face.scale(1.15, 0.94, 1);
  if (look) {
    const fringe = new THREE.SphereGeometry(0.19, 8, 5);
    fringe.scale(1, 0.48, 0.54);
    const parts = [part(fringe, hair, 0, 0.15, 0.21, 0, 0, look.style === 1 ? 0.38 : 0)];
    for (const side of [-1, 1]) {
      parts.push(part(new THREE.BoxGeometry(0.078, look.brow === 2 ? 0.032 : 0.019, 0.024), hair, side * 0.08, 0.083, 0.309, 0, 0, look.brow === 1 ? side * 0.32 : 0));
      if (look.style === 2) parts.push(part(new THREE.IcosahedronGeometry(0.11, 1), hair, side * 0.23, 0.16, 0.1));
    }
    head.add(mesh(mergeGeometries(parts)));
  }
  head.add(mesh(mergeGeometries([
    part(new THREE.SphereGeometry(0.3, 8, 6), hood, 0, 0.02, -0.03),           // hood
    part(new THREE.ConeGeometry(0.12, 0.3, 5), hood, 0, 0.3, -0.12, -0.6, 0, 0), // hood tip
    part(face, skin, 0, -0.01, 0.1),           // face
    part(new THREE.BoxGeometry(0.05, 0.08, 0.03), 0x1d1626, -0.08, 0.02, 0.31),       // eyes
    part(new THREE.BoxGeometry(0.05, 0.08, 0.03), 0x1d1626, 0.08, 0.02, 0.31),
    part(new THREE.BoxGeometry(0.06, 0.03, 0.02), 0xf29a8a, -0.14, -0.06, 0.28),     // blush
    part(new THREE.BoxGeometry(0.06, 0.03, 0.02), 0xf29a8a, 0.14, -0.06, 0.28),
  ])));
  const scarf = mesh(mergeGeometries([
    part(new THREE.TorusGeometry(0.24, 0.07, 4, 8), scarfCol, 0, 0.6, 0, Math.PI / 2, 0, 0),
    part(new THREE.BoxGeometry(0.1, 0.3, 0.05), scarfCol, 0.12, 0.48, -0.24, 0.3, 0, 0.2),
  ]));
  body.add(scarf);
  const legL = mesh(part(new THREE.BoxGeometry(0.11, 0.16, 0.14), 0x5a3b2c, 0, -0.04, 0));
  const legR = legL.clone();
  legL.position.set(-0.13, 0.08, 0); legR.position.set(0.13, 0.08, 0);
  body.add(legL, legR);
  // staff with lantern
  const staff = new THREE.Group(); staff.position.set(0.36, 0.45, 0.05); body.add(staff);
  staff.add(mesh(mergeGeometries([
    part(new THREE.CylinderGeometry(0.035, 0.04, 1.1, 5), 0x8a5a3b, 0, 0.2, 0),
    part(new THREE.TorusGeometry(0.1, 0.025, 3, 6, Math.PI), 0x6b4530, 0, 0.8, 0, 0, 0, 0),
  ])));
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.14), new THREE.MeshBasicMaterial({ color: 0xffd36e }));
  lantern.position.set(0, 0.72, 0); staff.add(lantern);
  return { root, body, head, legL, legR, staff, lantern, cloak };
}

// --- Enemies ---
function eyes(y, z, sep = 0.1, s = 1) {
  return [
    part(new THREE.BoxGeometry(0.07 * s, 0.1 * s, 0.03), 0x1d1626, -sep, y, z),
    part(new THREE.BoxGeometry(0.07 * s, 0.1 * s, 0.03), 0x1d1626, sep, y, z),
  ];
}

export function buildSlime(color = 0x7fc35a) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const g = new THREE.IcosahedronGeometry(0.45, 1);
  g.scale(1, 0.75, 1);
  const m = mesh(mergeGeometries([
    part(g, color, 0, 0.32, 0),
    part(new THREE.IcosahedronGeometry(0.16, 0), 0x5fa34a, 0.08, 0.68, -0.05),       // moss tuft
    part(new THREE.ConeGeometry(0.05, 0.22, 3), 0x5fa34a, -0.1, 0.72, 0, 0, 0, 0.4),
    ...eyes(0.4, 0.4, 0.12),
  ]));
  body.add(m);
  return { root, body, mat: m.material };
}

export function buildThorn() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const parts = [
    part(new THREE.CylinderGeometry(0.28, 0.36, 0.7, 6), 0x8a5a3b, 0, 0.35, 0),
    part(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 6), 0xe0b07a, 0, 0.71, 0),
    part(new THREE.IcosahedronGeometry(0.3, 0), 0x6aa84a, 0, 0.95, 0),
    part(new THREE.ConeGeometry(0.08, 0.3, 4), 0x6aa84a, 0.15, 1.15, 0, 0, 0, -0.5),
    ...eyes(0.45, 0.33, 0.1),
  ];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    parts.push(part(new THREE.ConeGeometry(0.05, 0.22, 3), 0xc9a06a, Math.cos(a) * 0.33, 0.25 + (i % 2) * 0.2, Math.sin(a) * 0.33, Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4));
  }
  const m = mesh(mergeGeometries(parts)); body.add(m);
  return { root, body, mat: m.material };
}

export function buildBoar() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const parts = [
    part(new THREE.BoxGeometry(0.75, 0.55, 1.05), 0x9a6a4a, 0, 0.5, 0),
    part(new THREE.BoxGeometry(0.55, 0.45, 0.4), 0x8a5a3e, 0, 0.55, 0.65),
    part(new THREE.BoxGeometry(0.3, 0.2, 0.12), 0xe7a58e, 0, 0.48, 0.88),
    part(new THREE.ConeGeometry(0.05, 0.25, 4), 0xfff4dc, -0.2, 0.45, 0.85, -1.2, 0, 0),
    part(new THREE.ConeGeometry(0.05, 0.25, 4), 0xfff4dc, 0.2, 0.45, 0.85, -1.2, 0, 0),
    part(new THREE.BoxGeometry(0.12, 0.25, 0.08), 0x6e4a33, -0.22, 0.85, 0.55, -0.3, 0, 0),
    part(new THREE.BoxGeometry(0.12, 0.25, 0.08), 0x6e4a33, 0.22, 0.85, 0.55, -0.3, 0, 0),
    part(new THREE.BoxGeometry(0.2, 0.15, 0.7), 0x5a3b2c, 0, 0.82, -0.05), // bristle ridge
    ...eyes(0.66, 0.86, 0.14),
  ];
  for (const [x, z] of [[-0.25, 0.35], [0.25, 0.35], [-0.25, -0.35], [0.25, -0.35]]) parts.push(part(new THREE.BoxGeometry(0.16, 0.3, 0.16), 0x6e4a33, x, 0.15, z));
  const m = mesh(mergeGeometries(parts)); body.add(m);
  return { root, body, mat: m.material };
}

export function buildMoth() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const m = mesh(mergeGeometries([
    part(new THREE.CapsuleGeometry(0.16, 0.4, 2, 6), 0x6a5a8a, 0, 0, 0, Math.PI / 2, 0, 0),
    part(new THREE.SphereGeometry(0.17, 6, 4), 0xe9e0f8, 0, 0.05, 0.3),
    part(new THREE.ConeGeometry(0.03, 0.3, 3), 0xe9e0f8, -0.08, 0.25, 0.38, -0.5, 0, 0.3),
    part(new THREE.ConeGeometry(0.03, 0.3, 3), 0xe9e0f8, 0.08, 0.25, 0.38, -0.5, 0, -0.3),
    ...eyes(0.08, 0.45, 0.07, 0.8),
  ]));
  body.add(m);
  const wingGeo = mergeGeometries([
    part(new THREE.CircleGeometry(0.55, 5), 0xb48ae0, 0.5, 0, 0, -Math.PI / 2, 0, 0),
    part(new THREE.CircleGeometry(0.22, 5), 0xffd27a, 0.6, 0.01, 0.05, -Math.PI / 2, 0, 0),
  ]);
  const wm = toonMat({ vertexColors: true, side: THREE.DoubleSide });
  const wL = new THREE.Mesh(wingGeo, wm), wR = new THREE.Mesh(wingGeo, wm);
  wR.scale.x = -1; wL.castShadow = wR.castShadow = true;
  body.add(wL, wR);
  return { root, body, mat: m.material, wings: [wL, wR], wingMat: wm };
}

export function buildStag() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const parts = [
    part(new THREE.BoxGeometry(1.3, 1.0, 2.2), 0x7a5a4a, 0, 1.6, 0),
    part(new THREE.BoxGeometry(1.1, 0.25, 1.9), 0x5f8a4a, 0, 2.2, -0.1),      // moss back
    part(new THREE.BoxGeometry(0.55, 1.0, 0.55), 0x6e4e40, 0, 2.2, 1.0, -0.5, 0, 0), // neck
    part(new THREE.BoxGeometry(0.6, 0.55, 0.85), 0xe8dcc8, 0, 2.75, 1.45),     // skull face
    part(new THREE.BoxGeometry(0.12, 0.16, 0.05), 0xffa040, -0.18, 2.82, 1.88),
    part(new THREE.BoxGeometry(0.12, 0.16, 0.05), 0xffa040, 0.18, 2.82, 1.88),
  ];
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.CylinderGeometry(0.06, 0.08, 1.0, 4), 0x5e3a30, s * 0.35, 3.4, 1.3, 0, 0, s * -0.5));
    parts.push(part(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 4), 0x5e3a30, s * 0.8, 3.75, 1.3, 0, 0, s * -1.2));
    parts.push(part(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 4), 0x5e3a30, s * 0.55, 3.95, 1.2, 0.3, 0, s * -0.1));
    parts.push(part(new THREE.IcosahedronGeometry(0.16, 0), 0xffb050, s * 1.05, 3.95, 1.3));
    parts.push(part(new THREE.IcosahedronGeometry(0.12, 0), 0xe0703a, s * 0.6, 4.2, 1.25));
  }
  for (const [x, z] of [[-0.45, 0.8], [0.45, 0.8], [-0.45, -0.8], [0.45, -0.8]]) parts.push(part(new THREE.BoxGeometry(0.28, 1.2, 0.28), 0x5e3a30, x, 0.6, z));
  const m = mesh(mergeGeometries(parts)); body.add(m);
  return { root, body, mat: m.material };
}

// exit arch
export function buildArch(P) {
  const g = new THREE.Group();
  const stone = mesh(mergeGeometries([
    part(new THREE.BoxGeometry(0.6, 2.4, 0.6), P.rock, -1.2, 1.2, 0),
    part(new THREE.BoxGeometry(0.6, 2.4, 0.6), P.rock, 1.2, 1.2, 0),
    part(new THREE.BoxGeometry(3.2, 0.5, 0.75), P.rockDark, 0, 2.6, 0),
    part(new THREE.BoxGeometry(0.8, 0.25, 0.8), P.rockDark, -1.2, 0.12, 0),
    part(new THREE.BoxGeometry(0.8, 0.25, 0.8), P.rockDark, 1.2, 0.12, 0),
    part(new THREE.IcosahedronGeometry(0.25, 0), P.leaf[0], -1.4, 2.95, 0.1),
    part(new THREE.IcosahedronGeometry(0.2, 0), P.leaf[1], 1.0, 2.9, -0.1),
  ]));
  g.add(stone);
  return g;
}

// ---------- town props ----------
export function buildHouse(roof, wall = 0xf3e2c0, w = 3.2, d = 2.8) {
  const g = new THREE.Group();
  const body = mesh(mergeGeometries([
    part(new THREE.BoxGeometry(w, 1.8, d), wall, 0, 0.9, 0),
    part(new THREE.BoxGeometry(w + 0.3, 0.15, d + 0.3), 0x8a6a50, 0, 0.07, 0),
    part(new THREE.BoxGeometry(0.7, 1.2, 0.08), 0x7a4a33, 0, 0.6, d / 2 + 0.02),          // door
    part(new THREE.BoxGeometry(0.5, 0.5, 0.08), 0x4a3a5a, -w / 2 + 0.7, 1.15, d / 2 + 0.02), // windows
    part(new THREE.BoxGeometry(0.5, 0.5, 0.08), 0xffd88a, w / 2 - 0.7, 1.15, d / 2 + 0.02),
    part(new THREE.BoxGeometry(0.35, 1.0, 0.35), 0x9a8f86, w / 2 - 0.5, 2.4, -d / 4),       // chimney
  ]));
  const roofG = new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.4, 4); roofG.rotateY(Math.PI / 4); roofG.scale(w / Math.max(w, d) * 1.05, 1, d / Math.max(w, d) * 1.05);
  const roofM = mesh(mergeGeometries([part(roofG, roof, 0, 2.5, 0)]));
  g.add(body, roofM);
  return g;
}
export function buildFountain() {
  const g = new THREE.Group();
  g.add(mesh(mergeGeometries([
    part(new THREE.CylinderGeometry(1.7, 1.9, 0.5, 10), 0xcfc4b0, 0, 0.25, 0),
    part(new THREE.CylinderGeometry(1.45, 1.45, 0.52, 10), 0x4aa8d8, 0, 0.27, 0),
    part(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 7), 0xcfc4b0, 0, 0.9, 0),
    part(new THREE.SphereGeometry(0.45, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0d6c2, 0, 1.45, 0),
  ])));
  return g;
}
export function buildBoard() {
  const g = new THREE.Group();
  g.add(mesh(mergeGeometries([
    part(new THREE.BoxGeometry(0.12, 1.6, 0.12), 0x6b4530, -0.8, 0.8, 0), part(new THREE.BoxGeometry(0.12, 1.6, 0.12), 0x6b4530, 0.8, 0.8, 0),
    part(new THREE.BoxGeometry(1.9, 1.1, 0.1), 0xe9cf9a, 0, 1.25, 0),
    part(new THREE.BoxGeometry(0.4, 0.5, 0.04), 0xfff6e2, -0.4, 1.3, 0.07), part(new THREE.BoxGeometry(0.35, 0.4, 0.04), 0xf6b8a0, 0.35, 1.2, 0.07),
  ])));
  return g;
}
export function buildStall(color) {
  const g = new THREE.Group();
  g.add(mesh(mergeGeometries([
    part(new THREE.BoxGeometry(2.2, 0.8, 1.0), 0x8a5a3b, 0, 0.4, 0),
    part(new THREE.BoxGeometry(0.1, 1.8, 0.1), 0x6b4530, -1.0, 0.9, -0.5), part(new THREE.BoxGeometry(0.1, 1.8, 0.1), 0x6b4530, 1.0, 0.9, -0.5),
    part(new THREE.BoxGeometry(2.6, 0.12, 1.5), color, 0, 1.85, -0.15, 0.25, 0, 0),
    part(new THREE.IcosahedronGeometry(0.18, 0), 0xe0453a, -0.5, 0.95, 0.1), part(new THREE.IcosahedronGeometry(0.18, 0), 0xf4c542, 0, 0.95, 0.1), part(new THREE.IcosahedronGeometry(0.18, 0), 0x86bd3f, 0.5, 0.95, 0.1),
  ])));
  return g;
}

// Original equipment silhouettes share the staff pivot so existing swing animation still applies.
export function showWeapon(model, style) {
  if (model.weaponStyle===style) return;
  model.weaponStyle=style;
  if (!model.weaponForms) {
    const make=parts=>mesh(mergeGeometries(parts));
    model.weaponForms={
      bow:make([
        part(new THREE.TorusGeometry(.38,.035,4,12,Math.PI),0x945f37,0,.28,0,0,0,Math.PI/2),
        part(new THREE.BoxGeometry(.013,.76,.013),0xf2e2b9,0,.28,0),
      ]),
      shield:make([
        part(new THREE.CylinderGeometry(.32,.27,.09,6),0x8d5d43,0,.12,.1,Math.PI/2),
        part(new THREE.CylinderGeometry(.24,.24,.1,6),0xe0b570,0,.12,.13,Math.PI/2),
      ]),
      blades:make([
        part(new THREE.OctahedronGeometry(.17),0xbcd4cf,0,.21,0),
        part(new THREE.BoxGeometry(.17,.045,.085),0xb18a49,0,.02,0),
      ]),
    };
    model.offhand=model.weaponForms.blades.clone();model.offhand.position.set(-.35,.46,.12);model.body.add(model.offhand);
    for(const form of Object.values(model.weaponForms)) model.staff.add(form);
  }
  for(const child of model.staff.children) child.visible=style==='staff';
  for(const [id,form] of Object.entries(model.weaponForms)) form.visible=id===style;
  model.offhand.visible=style==='blades';
}
