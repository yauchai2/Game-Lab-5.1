#!/usr/bin/env node
/**
 * Phase V2-Wave2: Merge 12 newly extracted Piloto Studio FBX meshes into game/assets/vfx/vfx_meshes.glb
 * Preserves all 28 existing Wave 1 meshes verbatim, normalizes each new mesh to max dimension = 2.0 centered at origin,
 * strips materials (dynamic shader coloring via src/vfx_shader.js), and round-trip verifies with Three.js GLTFLoader.
 */
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Minimal globals for Three.js loaders in Node.js
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.document === 'undefined') {
  const mkEl = () => ({ style: {}, getContext: () => null, addEventListener: () => {}, removeEventListener: () => {} });
  globalThis.document = { createElementNS: mkEl, createElement: mkEl };
}

const GLB_PATH = path.resolve('game/assets/vfx/vfx_meshes.glb');
const BACKUP_PATH = '/tmp/vfx_meshes_wave1_backup.glb';
const FBX_DIR = '/tmp/lantern_vale_vfx_wave2_fbx';

const WAVE2_NAMES = [
  'claw_slash', 'aura_ki', 'poison_wall', 'vfx_twirl', 'water_sphere',
  'elemental_spear', 'tnt_bundle', 'potion_vial', 'totem_antlers',
  'octacircle', 'magic_losangles', 'small_fish',
];

function normalizeGeometry(geo) {
  let g = geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  // Ensure UV exists so vfx_shader.js never crashes on missing vUv
  const count = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  // Keep only position, normal, uv
  for (const attr of Object.keys(g.attributes)) {
    if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
      g.deleteAttribute(attr);
    }
  }
  // Convert to non-indexed for safe merging if needed, or normalize in place
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bb.getCenter(center);
  bb.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
  const inv = 2.0 / maxDim;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      (pos.getX(i) - center.x) * inv,
      (pos.getY(i) - center.y) * inv,
      (pos.getZ(i) - center.z) * inv
    );
  }
  pos.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function loadExistingGlb(glbPath) {
  return new Promise((resolve, reject) => {
    const buf = fs.readFileSync(glbPath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const loader = new GLTFLoader();
    loader.parse(ab, '', gltf => {
      const meshes = new Map();
      gltf.scene.traverse(o => {
        if (o.isMesh && o.geometry) {
          const k = (o.name || '').split('.')[0];
          if (k && !meshes.has(k)) {
            meshes.set(k, o.geometry);
          }
        }
      });
      resolve(meshes);
    }, reject);
  });
}

function loadFbxAsSingleGeo(fbxPath) {
  const buf = fs.readFileSync(fbxPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new FBXLoader();
  const group = loader.parse(ab, '');
  group.updateMatrixWorld(true);
  const parts = [];
  group.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes?.position?.count > 0) {
      let g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes.normal) g.computeVertexNormals();
      const cnt = g.attributes.position.count;
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
      }
      for (const attr of Object.keys(g.attributes)) {
        if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
          g.deleteAttribute(attr);
        }
      }
      parts.push(g);
    }
  });
  if (!parts.length) return null;
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  return normalizeGeometry(merged);
}

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

function writeGlb(meshMap, outPath) {
  const chunks = [];
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];

  function appendTypedArray(arr, target) {
    const raw = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const pad = pad4(raw.length);
    const viewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: raw.length,
      ...(target ? { target } : {}),
    });
    chunks.push(raw);
    if (pad) chunks.push(Buffer.alloc(pad));
    byteOffset += raw.length + pad;
    return viewIndex;
  }

  for (const [name, geo] of meshMap.entries()) {
    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;
    const uvAttr = geo.attributes.uv;

    const posArr = new Float32Array(posAttr.count * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      posArr[i * 3] = x; posArr[i * 3 + 1] = y; posArr[i * 3 + 2] = z;
      if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
    }

    const posView = appendTypedArray(posArr, 34962);
    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView, componentType: 5126, count: posAttr.count, type: 'VEC3', min, max,
    });

    const attributes = { POSITION: posAcc };

    if (normAttr) {
      const normArr = new Float32Array(normAttr.count * 3);
      for (let i = 0; i < normAttr.count; i++) {
        normArr[i * 3] = normAttr.getX(i);
        normArr[i * 3 + 1] = normAttr.getY(i);
        normArr[i * 3 + 2] = normAttr.getZ(i);
      }
      const normView = appendTypedArray(normArr, 34962);
      const normAcc = accessors.length;
      accessors.push({ bufferView: normView, componentType: 5126, count: normAttr.count, type: 'VEC3' });
      attributes.NORMAL = normAcc;
    }

    if (uvAttr) {
      const uvArr = new Float32Array(uvAttr.count * 2);
      for (let i = 0; i < uvAttr.count; i++) {
        uvArr[i * 2] = uvAttr.getX(i);
        uvArr[i * 2 + 1] = uvAttr.getY(i);
      }
      const uvView = appendTypedArray(uvArr, 34962);
      const uvAcc = accessors.length;
      accessors.push({ bufferView: uvView, componentType: 5126, count: uvAttr.count, type: 'VEC2' });
      attributes.TEXCOORD_0 = uvAcc;
    }

    const prim = { attributes, mode: 4 };
    if (geo.index) {
      const idx = geo.index.array;
      const use32 = posAttr.count > 65535;
      const idxArr = use32 ? new Uint32Array(idx) : new Uint16Array(idx);
      const idxView = appendTypedArray(idxArr, 34963);
      const idxAcc = accessors.length;
      accessors.push({
        bufferView: idxView,
        componentType: use32 ? 5125 : 5123,
        count: idxArr.length,
        type: 'SCALAR',
      });
      prim.indices = idxAcc;
    }

    const meshIdx = meshes.length;
    meshes.push({ name, primitives: [prim] });
    nodes.push({ name, mesh: meshIdx });
  }

  const binBuf = Buffer.concat(chunks);
  const gltfJson = {
    asset: { version: '2.0', generator: 'LanternVale-VFX-Wave2-Packer' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuf.length }],
  };

  let jsonBuf = Buffer.from(JSON.stringify(gltfJson), 'utf8');
  const jsonPad = pad4(jsonBuf.length);
  if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' '.repeat(jsonPad), 'utf8')]);

  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHdr = Buffer.alloc(8);
  jsonChunkHdr.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHdr.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHdr = Buffer.alloc(8);
  binChunkHdr.writeUInt32LE(binBuf.length, 0);
  binChunkHdr.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  fs.writeFileSync(outPath, Buffer.concat([header, jsonChunkHdr, jsonBuf, binChunkHdr, binBuf]));
}

async function main() {
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(GLB_PATH, BACKUP_PATH);
  }
  const meshMap = await loadExistingGlb(BACKUP_PATH);
  console.log(`[PackWave2] Loaded Wave 1 meshes: ${meshMap.size}`);

  let added = 0;
  for (const name of WAVE2_NAMES) {
    const fbxPath = path.join(FBX_DIR, `${name}.fbx`);
    if (!fs.existsSync(fbxPath)) {
      console.warn(`[PackWave2] Missing FBX: ${fbxPath}`);
      continue;
    }
    const geo = loadFbxAsSingleGeo(fbxPath);
    if (!geo) {
      console.warn(`[PackWave2] Empty geometry for ${name}`);
      continue;
    }
    meshMap.set(name, geo);
    added++;
  }

  writeGlb(meshMap, GLB_PATH);
  const szKb = (fs.statSync(GLB_PATH).size / 1024).toFixed(1);
  console.log(`[PackWave2] Wrote ${meshMap.size} meshes (+${added} Wave 2) -> ${GLB_PATH} (${szKb} KB)`);

  // Round-trip verify with GLTFLoader
  const verified = await loadExistingGlb(GLB_PATH);
  const missing = WAVE2_NAMES.filter(n => !verified.has(n));
  console.log(`[PackWave2] Round-trip verify: ${verified.size} meshes loaded, missing=${missing.length}`);
  if (missing.length) {
    console.error('Missing meshes:', missing);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
