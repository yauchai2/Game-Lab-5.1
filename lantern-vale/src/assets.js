// 精選 Stylized Nature MegaKit 3D glTF 資產非同步載入與像素賽璐璐（Pixel-Toon）風吹材質管線
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonMat, windPatch } from './world.js';

export const NATURE_FILES = {
  tree:   { file: 'CommonTree_5.gltf',        targetH: 4.2,  sink: 0.16 },
  pine:   { file: 'Pine_5.gltf',              targetH: 4.5,  sink: 0.16 },
  bush:   { file: 'Bush_Common_Flowers.gltf', targetH: 1.25, sink: 0.08 },
  rock1:  { file: 'Rock_Medium_1.gltf',       targetH: 1.2,  sink: 0.14 },
  rock2:  { file: 'Rock_Medium_2.gltf',       targetH: 1.1,  sink: 0.14 },
  shroom: { file: 'Mushroom_Common.gltf',     targetH: 0.5,  sink: 0.04 },
  fern:   { file: 'Fern_1.gltf',              targetH: 0.56, sink: 0.04 },
  flower: { file: 'Flower_3_Group.gltf',      targetH: 0.48, sink: 0.04 },
  pine2:  { file: 'Pine_2.gltf',              targetH: 4.2,  sink: 0.16 },
  tree2:  { file: 'CommonTree_2.gltf',        targetH: 4.0,  sink: 0.16 },
  tree3:  { file: 'CommonTree_3.gltf',        targetH: 3.8,  sink: 0.16 },
  rock3:  { file: 'Rock_Medium_3.gltf',       targetH: 1.0,  sink: 0.14 },
  tuft:   { file: 'Grass_Common_Short.gltf',  targetH: 0.42, sink: 0.02 },
};

export const natureAssets = {};
let _started = false;
let _ready = false;
const _listeners = [];

export function isNatureReady() { return _ready; }

function prepTexture(tex) {
  if (!tex) return null;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function classifyPart(matName, meshName, key) {
  const n = `${matName || ''} ${meshName || ''}`.toLowerCase();
  if (/flower|petal|blossom/.test(n)) return 'flower';
  if (/leaf|leaves|foliage|pine|fern|bush|grass/.test(n)) return 'foliage';
  if (/bark|trunk|wood/.test(n)) return 'bark';
  if (/rock|stone/.test(n)) return 'rock';
  if (/mushroom|shroom/.test(n)) return 'shroom';
  if (key === 'rock1' || key === 'rock2' || key === 'rock3') return 'rock';
  if (key === 'fern' || key === 'tuft') return 'foliage';
  if (key === 'flower') return 'flower';
  if (key === 'shroom') return 'shroom';
  return 'foliage';
}

function normalizeScene(scene, targetH, sink, key) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = size.y > 0.001 ? targetH / size.y : 1;
  const normMtx = new THREE.Matrix4()
    .makeTranslation(-center.x * scale, -box.min.y * scale - sink, -center.z * scale)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  const parts = [];
  scene.traverse(obj => {
    if (!obj.isMesh || !obj.geometry) return;
    const geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    geo.applyMatrix4(normMtx);
    geo.computeVertexNormals();

    const srcMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const role = classifyPart(srcMat?.name, obj.name, key);
    const map = prepTexture(srcMat?.map || null);
    const alphaTest = (role === 'foliage' || role === 'flower' || srcMat?.alphaTest > 0 || srcMat?.transparent) ? 0.45 : 0;
    const doubleSide = role === 'foliage' || role === 'flower' || srcMat?.side === THREE.DoubleSide;

    parts.push({ geo, map, role, alphaTest, doubleSide });
  });
  return { key, parts };
}

function liftBright(hex, minL = 0.72) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(0.85, hsl.s * 1.08), Math.max(minL, hsl.l + 0.22));
  return c;
}

export function buildAssetMaterial(part, opts = {}) {
  const col = new THREE.Color(0xffffff);
  let emissive = new THREE.Color(0x000000);
  let emissiveIntensity = 0;

  if (part.role === 'foliage') {
    const raw = new THREE.Color(opts.tint ?? 0x76b852);
    const lifted = liftBright(opts.tint ?? 0x76b852, 0.74);
    col.lerp(lifted, opts.tintMix ?? 0.42);
    emissive.copy(raw);
    emissiveIntensity = 0.58;
  } else if (part.role === 'rock') {
    const raw = new THREE.Color(opts.rockTint ?? 0x9e978e);
    const lifted = liftBright(opts.rockTint ?? 0x9e978e, 0.78);
    col.lerp(lifted, 0.6);
    emissive.copy(raw);
    emissiveIntensity = 0.55;
  } else if (part.role === 'bark') {
    col.setHex(0xf6e6d4);
    emissive.setHex(0x6b4a32);
    emissiveIntensity = 0.28;
  } else if (part.role === 'flower' || part.role === 'shroom') {
    col.setHex(0xffffff);
    emissive.setHex(0xfff0dc);
    emissiveIntensity = 0.24;
  }

  const mat = toonMat({
    color: col,
    map: part.map || null,
    emissive,
    emissiveIntensity,
    alphaTest: part.alphaTest || 0,
    side: part.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (opts.wind) windPatch(mat, opts.wind);
  return mat;
}

export const LANDMARK_FILES = {
  windmill:        'assets/landmarks/windmill.glb',
  windmill_blades: 'assets/landmarks/windmill_blades.glb',
  cottage:         'assets/landmarks/cottage.glb',
  stonehenge:      'assets/landmarks/stonehenge.glb',
  snow_house:      'assets/landmarks/snow_house.glb',
  snow_tower:      'assets/landmarks/snow_tower.glb',
  ice_crystal:     'assets/landmarks/ice_crystal.glb',
  cave_arch:       'assets/landmarks/cave_arch.glb',
  lighthouse:      'assets/landmarks/lighthouse.glb',
  island_house:    'assets/landmarks/island_house.glb',
  torii_gate:      'assets/landmarks/torii_gate.glb',
  sakura_tree:     'assets/landmarks/sakura_tree.glb',
  beach_house:     'assets/landmarks/beach_house.glb',
  coconut_tree:    'assets/landmarks/coconut_tree.glb',
  pirate_boat:     'assets/landmarks/pirate_boat.glb',
  forest_cabin:    'assets/landmarks/forest_cabin.glb',
  mine_cart:       'assets/landmarks/mine_cart.glb',
  forge_furnace:   'assets/landmarks/forge_furnace.glb',
  red_crystal:     'assets/landmarks/red_crystal.glb',
  giant_shroom:    'assets/landmarks/giant_shroom.glb',
  blacksmith:      'assets/landmarks/blacksmith.glb',
};

export const MONSTER_FILES = {
  plant_chewer:  'assets/monsters/plant_chewer.glb',
  golem_ice:     'assets/monsters/golem_ice.glb',
  golem_fire:    'assets/monsters/golem_fire.glb',
  golem_earth:   'assets/monsters/golem_earth.glb',
  scorpion_king: 'assets/monsters/scorpion_king.glb',
  spore:         'assets/monsters/spore.glb',
  beholder:      'assets/monsters/beholder.glb',
  flying_demon:  'assets/monsters/flying_demon.glb',
  crab_monster:  'assets/monsters/crab_monster.glb',
  chest_monster: 'assets/monsters/chest_monster.glb',
  werewolf:      'assets/monsters/werewolf.glb',
  black_knight:  'assets/monsters/black_knight.glb',
  specter:       'assets/monsters/specter.glb',
};

const _glbCache = new Map();
const _glbPending = new Map();
let _sharedLoader = null;

function getSharedLoader() {
  if (!_sharedLoader) _sharedLoader = new GLTFLoader();
  return _sharedLoader;
}

function bakePixelToonScene(srcScene, opts = {}) {
  const clone = srcScene.clone(true);
  const tint = opts.tint ? new THREE.Color(opts.tint) : new THREE.Color(0xffffff);
  let primaryMat = null;
  clone.traverse(o => {
    if (!o.isMesh) return;
    const srcMat = Array.isArray(o.material) ? o.material[0] : o.material;
    const map = (!opts.flatTint && srcMat?.map) ? prepTexture(srcMat.map) : null;
    const baseCol = opts.flatTint
      ? new THREE.Color(opts.flatTint)
      : (map ? tint.clone() : (srcMat?.color ? srcMat.color.clone().multiply(tint) : tint.clone()));
    const mat = toonMat({
      color: baseCol,
      map,
      emissive: new THREE.Color(opts.emissive ?? 0x2c2822),
      emissiveIntensity: opts.emissiveIntensity ?? 0.28,
    });
    o.material = mat;
    o.castShadow = true;
    o.receiveShadow = true;
    if (!primaryMat) primaryMat = mat;
  });
  return { root: clone, mat: primaryMat };
}

export function loadGlbAsset(url) {
  if (typeof window === 'undefined' || window.location?.protocol === 'file:') return Promise.resolve(null);
  if (_glbCache.has(url)) return Promise.resolve(_glbCache.get(url));
  if (_glbPending.has(url)) return _glbPending.get(url);
  const p = new Promise(resolve => {
    getSharedLoader().load(
      url,
      gltf => {
        _glbCache.set(url, gltf.scene);
        _glbPending.delete(url);
        resolve(gltf.scene);
      },
      undefined,
      () => {
        _glbPending.delete(url);
        resolve(null);
      },
    );
  });
  _glbPending.set(url, p);
  return p;
}

export function attachLandmarkGlb(holder, key, fallbackObj, opts = {}) {
  if (fallbackObj) holder.add(fallbackObj);
  const url = LANDMARK_FILES[key];
  if (!url) return holder;
  loadGlbAsset(url).then(scene => {
    if (!scene || !holder.parent) return;
    if (fallbackObj) holder.remove(fallbackObj);
    const { root } = bakePixelToonScene(scene, opts);
    if (opts.scale) root.scale.setScalar(opts.scale);
    if (opts.rotY) root.rotation.y = opts.rotY;
    if (opts.yOffset) root.position.y = opts.yOffset;
    holder.add(root);
  });
  return holder;
}

export function attachMonsterGlb(modelObj, key, opts = {}) {
  const url = MONSTER_FILES[key];
  if (!url) return;
  loadGlbAsset(url).then(scene => {
    if (!scene || !modelObj?.body || !modelObj.root?.parent) return;
    while (modelObj.body.children.length) modelObj.body.remove(modelObj.body.children[0]);
    const { root, mat } = bakePixelToonScene(scene, { emissive: 0x201c18, emissiveIntensity: 0.18, ...opts });
    if (opts.scale) root.scale.setScalar(opts.scale);
    if (opts.rotY) root.rotation.y = opts.rotY;
    if (opts.yOffset) root.position.y = opts.yOffset;
    modelObj.body.add(root);
    if (mat) modelObj.mat = mat;
  });
}

export function preloadNatureAssets(onReady) {
  if (onReady) {
    if (_ready) { onReady(natureAssets); return; }
    _listeners.push(onReady);
  }
  if (_started) return;
  _started = true;

  // Node.js 測試環境或本機 file:// 開啟時自動採用內建程序化幾何體，避免 CORS 報錯
  if (typeof window === 'undefined' || window.location?.protocol === 'file:') return;

  // 預載最常用的起手怪物實模，其餘生態專屬怪進入對應地圖時按需瞬載快取
  for (const k of ['plant_chewer', 'golem_ice', 'golem_fire', 'beholder']) loadGlbAsset(MONSTER_FILES[k]);

  const loader = new GLTFLoader();
  const basePath = 'assets/nature/';
  const entries = Object.entries(NATURE_FILES);
  let loadedCount = 0;

  Promise.allSettled(
    entries.map(([key, cfg]) => new Promise((resolve, reject) => {
      loader.load(
        basePath + cfg.file,
        gltf => {
          natureAssets[key] = normalizeScene(gltf.scene, cfg.targetH, cfg.sink, key);
          loadedCount++;
          resolve(key);
        },
        undefined,
        err => reject(err),
      );
    })),
  ).then(() => {
    if (loadedCount > 0) {
      _ready = true;
      while (_listeners.length) {
        const fn = _listeners.shift();
        try { fn(natureAssets); } catch (_) {}
      }
    }
  });
}
