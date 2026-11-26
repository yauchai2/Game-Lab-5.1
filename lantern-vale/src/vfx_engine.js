// Phase V2：Piloto Studio 3D 特效總控引擎（共享幾何體／貼圖快取＋零 GPU 洩漏生命週期管理）
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPilotoFxMaterial, VFX_THEMES } from './vfx_shader.js';

export const VFX_MESH_KEYS = [
  // Wave 1 (28 meshes)
  'fire_whale', 'thunder_phoenix', 'healing_tree', 'wolf_head', 'ice_puffer', 'dragon_head',
  'paladin_sword', 'knight_spear', 'shuriken', 'arrow', 'ice_shards', 'totem_rage', 'totem_heal',
  'black_hole', 'ring_wind', 'petal', 'tornado', 'slash_thick', 'slash_clean', 'ground_crack',
  'candle', 'magic_missile', 'fire_tower', 'sphere_flames', 'magic_circle_star', 'portal_ring',
  'mana_crystal', 'peace_emblem',
  // Wave 2 (12 meshes)
  'claw_slash', 'aura_ki', 'poison_wall', 'vfx_twirl', 'water_sphere', 'elemental_spear',
  'tnt_bundle', 'potion_vial', 'totem_antlers', 'octacircle', 'magic_losangles', 'small_fish',
];

export const VFX_TEX_KEYS = [
  // Wave 1 (22 WebP)
  'fire_flipbook', 'elec_flipbook', 'smoke_flipbook', 'magic_circle', 'holy_ring', 'mana_runes',
  'energy_circle', 'ground_crack', 'fire_dissolve', 'liquid_noise', 'lightning_beam', 'hit_punch',
  'shock_ring', 'anime_shock', 'flare_cross', 'flare_glow', 'ghost_trail', 'arcanist_cards',
  'arrows_mist', 'flowers', 'warning_icon', 'dragon_tex',
  // Wave 2 (10 PNG)
  'iced_crack', 'ground_slash', 'fire_ground', 'arcane_runes', 'malice_eyes', 'dark_decal',
  'star_flare', 'sparks_atlas', 'shock_zap', 'mana_aura',
];

const VFX_TEX_PNG = new Set([
  'iced_crack', 'ground_slash', 'fire_ground', 'arcane_runes', 'malice_eyes',
  'dark_decal', 'star_flare', 'sparks_atlas', 'shock_zap', 'mana_aura',
]);

const _geos = new Map();
const _texs = new Map();
let _loadPromise = null;
let _loaded = false;
let _planeGeo = null;
let _cylGeo = null;
let _sphereGeo = null;

function sharedPlane() {
  if (!_planeGeo) { _planeGeo = new THREE.PlaneGeometry(1, 1); _planeGeo.rotateX(-Math.PI / 2); }
  return _planeGeo;
}
function sharedBillboard() {
  if (!_geos.has('__quad')) _geos.set('__quad', new THREE.PlaneGeometry(1, 1));
  return _geos.get('__quad');
}
function sharedBeamCyl() {
  if (!_cylGeo) _cylGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 8, 1, true);
  return _cylGeo;
}
function sharedFallbackSphere() {
  if (!_sphereGeo) _sphereGeo = new THREE.IcosahedronGeometry(0.5, 1);
  return _sphereGeo;
}

export function getVfxTex(key) {
  if (!key || typeof window === 'undefined') return null;
  if (_texs.has(key)) return _texs.get(key);
  const loader = new THREE.TextureLoader();
  const ext = VFX_TEX_PNG.has(key) ? 'png' : 'webp';
  const tex = loader.load(`assets/vfx/tex/${key}.${ext}`, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _texs.set(key, tex);
  return tex;
}

export function preloadVfxAssets() {
  if (_loadPromise) return _loadPromise;
  if (typeof window === 'undefined') return Promise.resolve(false);
  // 預載最常用的核心貼圖（Wave 1 + Wave 2）
  ['magic_circle', 'holy_ring', 'fire_dissolve', 'fire_flipbook', 'elec_flipbook', 'smoke_flipbook', 'hit_punch', 'shock_ring', 'anime_shock', 'ground_crack', 'lightning_beam', 'arcanist_cards', 'warning_icon', 'flare_glow', 'liquid_noise', 'iced_crack', 'ground_slash', 'fire_ground', 'arcane_runes', 'malice_eyes', 'dark_decal', 'star_flare', 'sparks_atlas', 'shock_zap', 'mana_aura'].forEach(getVfxTex);
  const loader = new GLTFLoader();
  _loadPromise = new Promise(resolve => {
    loader.load(
      'assets/vfx/vfx_meshes.glb',
      gltf => {
        gltf.scene.traverse(o => {
          if (o.isMesh && o.geometry) {
            const k = (o.name || '').split('.')[0];
            if (k) _geos.set(k, o.geometry);
          }
        });
        _loaded = true;
        resolve(true);
      },
      undefined,
      err => {
        console.warn('[VfxEngine] Failed to load vfx_meshes.glb:', err?.message || err);
        resolve(false);
      }
    );
  });
  return _loadPromise;
}

export function isVfxReady() { return _loaded; }
export function getVfxGeometry(key) { return _geos.get(key) || sharedFallbackSphere(); }

/**
 * 掛載於場景上的 3D 特效控制器（單一實例管理所有活躍 VFX，支援零洩漏自動回收）
 */
export class VfxEngine {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.items = [];
    this.maxActive = 110;
    if (!opts.lazy) preloadVfxAssets();
  }

  preload() {
    return preloadVfxAssets();
  }

  _add(entry) {
    if (!_loadPromise) preloadVfxAssets();
    if (this.items.length >= this.maxActive) {
      this._removeAt(0);
    }
    entry.obj.userData.noNormal = true;
    this.scene.add(entry.obj);
    this.items.push(entry);
    return entry;
  }

  _removeAt(idx) {
    const it = this.items[idx];
    if (!it) return;
    this.scene.remove(it.obj);
    // 僅釋放動態建立的材質（幾何體與貼圖全域共享，絕不誤釋放！）
    it.mats?.forEach(m => m?.dispose?.());
    this.items.splice(idx, 1);
  }

  clear() {
    while (this.items.length) this._removeAt(this.items.length - 1);
  }

  /**
   * 播放 3D VFX 網格特效（支援移動、旋轉、跳躍拋物線、縮放曲線、噪點溶解）
   */
  spawnMesh(meshKey, opts = {}) {
    const geo = getVfxGeometry(meshKey);
    const mat = createPilotoFxMaterial({
      theme: opts.theme || 'fire',
      colorA: opts.colorA,
      colorB: opts.colorB,
      rimColor: opts.rimColor,
      map: opts.tex ? getVfxTex(opts.tex) : null,
      noise: opts.noise !== false ? getVfxTex(opts.noiseTex || 'fire_dissolve') : null,
      scrollX: opts.scrollX ?? 0.35,
      scrollY: opts.scrollY ?? 0.65,
      rimPow: opts.rimPow ?? 1.6,
      opacity: opts.opacity ?? 0.95,
      additive: opts.additive ?? true,
      solid: opts.solid ?? (opts.additive === false),
      depthWrite: opts.additive === false,
      pixelSnap: opts.pixelSnap ?? 64.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
    mesh.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
    const s0 = opts.scaleStart ?? opts.scale ?? 1.0;
    mesh.scale.setScalar(s0);
    mesh.renderOrder = opts.renderOrder ?? 8;

    return this._add({
      obj: mesh,
      mats: [mat],
      t: 0,
      dur: opts.dur || 0.75,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      vz: opts.vz || 0,
      gravity: opts.gravity || 0,
      spinX: opts.spinX || 0,
      spinY: opts.spinY || 0,
      spinZ: opts.spinZ || 0,
      s0,
      s1: opts.scaleEnd ?? (opts.scale ?? 1.0),
      dissolveStart: opts.dissolveStart ?? 0.55,
      baseOpacity: opts.opacity ?? 0.95,
      onTick: opts.onTick || null,
    });
  }

  /**
   * 貼地魔法陣／衝擊裂紋／預警圈貼花
   */
  spawnDecal(texKey, x, y, z, opts = {}) {
    const mat = createPilotoFxMaterial({
      theme: opts.theme || 'arcane',
      colorA: opts.colorA,
      colorB: opts.colorB,
      map: getVfxTex(texKey),
      noise: opts.dissolve ? getVfxTex('fire_dissolve') : null,
      rimPow: 0,
      opacity: opts.opacity ?? 0.9,
      additive: opts.additive ?? true,
      pixelSnap: opts.pixelSnap ?? 72.0,
    });
    const mesh = new THREE.Mesh(sharedPlane(), mat);
    mesh.position.set(x, y + 0.08, z);
    mesh.rotation.y = opts.ry ?? Math.random() * Math.PI * 2;
    const s0 = opts.scaleStart ?? opts.radius * 2 ?? 2.4;
    const s1 = opts.scaleEnd ?? s0 * 1.15;
    mesh.scale.set(s0, 1, s0);
    mesh.renderOrder = 3;

    return this._add({
      obj: mesh,
      mats: [mat],
      t: 0,
      dur: opts.dur || 0.7,
      spinY: opts.spinY ?? 0.85,
      s0, s1,
      flatScale: true,
      dissolveStart: opts.dissolveStart ?? 0.55,
      baseOpacity: opts.opacity ?? 0.9,
    });
  }

  /**
   * 3D 立體武器斬擊弧（取代舊平面 RingGeometry）
   */
  spawnSlash(x, y, z, angleY, opts = {}) {
    const meshKey = opts.clean ? 'slash_clean' : 'slash_thick';
    const r = opts.scale || 1.65;
    return this.spawnMesh(meshKey, {
      x, y: y + (opts.yOff ?? 0.65), z,
      ry: angleY + (opts.rotOff ?? 0),
      rz: opts.tilt ?? 0,
      scaleStart: r * 0.78,
      scaleEnd: r * 1.18,
      dur: opts.dur || 0.24,
      spinY: (opts.dir ?? 1) * 4.5,
      theme: opts.theme || 'fire',
      tex: 'ghost_trail',
      scrollX: 1.8,
      scrollY: 0,
      dissolveStart: 0.35,
      opacity: 0.96,
    });
  }

  /**
   * 元素化受擊爆花（含漫畫衝擊波＋序列幀電弧／火焰）
   */
  spawnHitImpact(x, y, z, theme = 'fire', isCrit = false) {
    const scale = isCrit ? 1.55 : 0.95;
    // 1) 放射衝擊貼圖（暴擊用漫畫 Hit_Punch_Outlined，一般用 anime_shock / flare_cross）
    const texKey = isCrit ? 'hit_punch' : (theme === 'thunder' ? 'elec_flipbook' : theme === 'fire' || theme === 'bluefire' ? 'fire_flipbook' : 'flare_cross');
    const isFlip = texKey === 'elec_flipbook' || texKey === 'fire_flipbook';
    const mat = createPilotoFxMaterial({
      theme,
      map: getVfxTex(texKey),
      cols: texKey === 'elec_flipbook' ? 4 : texKey === 'fire_flipbook' ? 4 : 1,
      rows: texKey === 'elec_flipbook' ? 2 : texKey === 'fire_flipbook' ? 4 : 1,
      rimPow: 0,
      opacity: 0.96,
      additive: !isCrit,
      pixelSnap: 64,
    });
    const mesh = new THREE.Mesh(sharedBillboard(), mat);
    mesh.position.set(x, y + 0.7, z);
    mesh.scale.setScalar(scale);
    mesh.renderOrder = 12;
    this._add({
      obj: mesh,
      mats: [mat],
      t: 0,
      dur: isCrit ? 0.34 : 0.26,
      s0: scale * 0.65,
      s1: scale * 1.35,
      billboard: true,
      flipSpeed: isFlip ? 28 : 0,
      dissolveStart: 0.55,
      baseOpacity: 0.96,
    });
    if (isCrit) {
      this.spawnDecal('shock_ring', x, y, z, { theme, scaleStart: 0.8, scaleEnd: 2.8, dur: 0.32, spinY: 2.5 });
    }
  }

  /**
   * 敵人刷怪預警法陣（餘燼狂潮／副本波次）
   */
  spawnEnemyCircle(x, y, z, theme = 'death', dur = 0.75) {
    this.spawnDecal('magic_circle', x, y, z, { theme, scaleStart: 0.5, scaleEnd: 2.4, dur, spinY: 2.2 });
    this.spawnMesh('portal_ring', { x, y: y + 0.15, z, theme, scaleStart: 0.4, scaleEnd: 1.15, dur, spinY: -3.0, opacity: 0.85 });
  }

  /**
   * 稀有／史詩／傳說裝備掉寶光柱
   */
  spawnLootBeam(x, y, z, colorHex = 0xffd85a, dur = 4.5) {
    const mat = createPilotoFxMaterial({
      colorA: 0xffffff,
      colorB: colorHex,
      rimColor: colorHex,
      map: getVfxTex('lightning_beam'),
      scrollY: -1.2,
      rimPow: 1.2,
      opacity: 0.72,
    });
    const beam = new THREE.Mesh(sharedBeamCyl(), mat);
    beam.position.set(x, y + 2.4, z);
    beam.scale.set(1.1, 4.8, 1.1);
    beam.renderOrder = 7;
    this._add({
      obj: beam,
      mats: [mat],
      t: 0,
      dur,
      spinY: 1.5,
      s0: 1, s1: 1,
      keepScale: true,
      dissolveStart: 0.75,
      baseOpacity: 0.72,
    });
    this.spawnDecal('holy_ring', x, y, z, { colorA: 0xffffff, colorB: colorHex, scaleStart: 1.4, scaleEnd: 1.6, dur: Math.min(dur, 2.5), spinY: 1.1 });
  }

  /**
   * 招牌 3D 召喚／大絕特效集合（火鯨、雷鳳、3D 龍頭、暗影巨狼、繁花聖樹、聖劍天降、黑洞、龍捲風、雷槍聖牢、冰河豚、燭火聖陣、破曉靈陽）
   */
  spawnSummon(kind, x, y, z, dirX = 0, dirZ = 1, opts = {}) {
    const yaw = Math.atan2(dirX, dirZ);
    const theme = opts.theme || null;

    if (kind === 'fire_whale') {
      const th = theme || 'fire';
      this.spawnDecal('ground_crack', x, y, z, { theme: th, scaleStart: 1.4, scaleEnd: 5.2, dur: 1.4 });
      this.spawnMesh('fire_whale', {
        x: x - dirX * 1.4, y: y + 0.4, z: z - dirZ * 1.4, ry: yaw,
        vx: dirX * 4.2, vy: 6.2, vz: dirZ * 4.2, gravity: 14.5,
        scaleStart: 1.2, scaleEnd: 2.35, dur: 1.15, theme: th,
        tex: 'fire_dissolve', scrollY: 1.1, additive: false, rimPow: 1.4,
        onTick: (it, p) => { it.obj.rotation.x = -0.6 + p * 1.35; },
      });
      this.spawnDecal('shock_ring', x + dirX * 1.6, y, z + dirZ * 1.6, { theme: th, scaleStart: 1.0, scaleEnd: 6.5, dur: 0.9 });
    } else if (kind === 'thunder_phoenix') {
      const th = theme || 'thunder';
      this.spawnMesh('thunder_phoenix', {
        x, y: y + 1.35, z, ry: yaw,
        vx: dirX * 13.5, vz: dirZ * 13.5,
        scaleStart: 1.5, scaleEnd: 2.2, dur: 1.05, theme: th,
        tex: 'elec_flipbook', scrollY: 1.4, rimPow: 1.5,
      });
      this.spawnDecal('magic_circle', x, y, z, { theme: th, scaleStart: 1.6, scaleEnd: 4.0, dur: 0.85, spinY: 2.6 });
    } else if (kind === 'dragon_head') {
      const th = theme || 'fire';
      this.spawnMesh('dragon_head', {
        x: x + dirX * 1.3, y: y + 1.6, z: z + dirZ * 1.3, ry: yaw,
        scaleStart: 1.8, scaleEnd: 2.4, dur: 1.8, theme: th,
        tex: 'dragon_tex', additive: false, rimPow: 1.6,
        onTick: (it, p) => { it.obj.position.y = y + 1.6 + Math.sin(p * Math.PI * 3) * 0.16; },
      });
      // 龍息錐形火海
      for (let i = 0; i < 4; i++) {
        const d = 2.4 + i * 1.6;
        this.spawnMesh('tornado', {
          x: x + dirX * d, y: y + 0.9, z: z + dirZ * d,
          rx: Math.PI / 2, ry: yaw,
          scaleStart: 0.7 + i * 0.35, scaleEnd: 1.3 + i * 0.45,
          dur: 1.4, theme: th, scrollY: 2.4, opacity: 0.82,
        });
      }
      this.spawnDecal('ground_crack', x + dirX * 3.5, y, z + dirZ * 3.5, { theme: th, scaleStart: 2.2, scaleEnd: 6.2, dur: 1.7 });
    } else if (kind === 'wolf_head') {
      const th = theme || 'death';
      this.spawnDecal('magic_circle', x, y, z, { theme: th, scaleStart: 1.5, scaleEnd: 4.8, dur: 1.0, spinY: -2.4 });
      this.spawnMesh('wolf_head', {
        x, y: y + 1.15, z, ry: yaw,
        vx: dirX * 3.5, vz: dirZ * 3.5,
        scaleStart: 1.1, scaleEnd: 2.25, dur: 0.85, theme: th,
        additive: false, rimPow: 1.8,
        onTick: (it, p) => { it.obj.scale.setScalar(1.1 + Math.sin(p * Math.PI) * 1.35); },
      });
      this.spawnDecal('mana_runes', x, y, z, { theme: th, scaleStart: 1.0, scaleEnd: 5.5, dur: 0.75 });
    } else if (kind === 'healing_tree') {
      const th = theme || 'lotus';
      this.spawnDecal('holy_ring', x, y, z, { theme: th, scaleStart: 2.0, scaleEnd: 5.8, dur: opts.dur || 6.5, spinY: 0.6 });
      this.spawnMesh('healing_tree', {
        x, y: y + 1.25, z,
        scaleStart: 0.25, scaleEnd: 1.85, dur: opts.dur || 6.5, theme: th,
        tex: 'flowers', additive: false, rimPow: 1.3, dissolveStart: 0.82,
        onTick: (it, p) => {
          const grow = Math.min(1, p * 4.5);
          it.obj.scale.setScalar(0.25 + grow * 1.55);
          it.obj.rotation.y += 0.004;
        },
      });
    } else if (kind === 'paladin_sword') {
      const th = theme || 'holy';
      this.spawnDecal('holy_ring', x, y, z, { theme: th, scaleStart: 1.4, scaleEnd: 4.8, dur: 1.2, spinY: 1.6 });
      this.spawnMesh('paladin_sword', {
        x, y: y + 6.5, z, rx: Math.PI, ry: yaw,
        vy: -22, scaleStart: 1.65, scaleEnd: 1.9, dur: 1.15, theme: th,
        additive: false, rimPow: 1.5,
        onTick: (it) => { if (it.obj.position.y < y + 1.2) { it.obj.position.y = y + 1.2; it.vy = 0; } },
      });
      this.spawnDecal('ground_crack', x, y, z, { theme: th, scaleStart: 1.0, scaleEnd: 4.6, dur: 1.25 });
    } else if (kind === 'black_hole') {
      const th = theme || 'arcane';
      this.spawnDecal('energy_circle', x, y, z, { theme: th, scaleStart: 5.4, scaleEnd: 1.2, dur: opts.dur || 3.8, spinY: 3.6 });
      this.spawnMesh('black_hole', {
        x, y: y + 1.05, z,
        scaleStart: 0.6, scaleEnd: 1.45, dur: opts.dur || 3.8, theme: th,
        spinY: 4.2, spinX: 1.8, additive: false, rimPow: 2.2, dissolveStart: 0.82,
      });
    } else if (kind === 'tornado') {
      const th = theme || 'bluefire';
      this.spawnMesh('tornado', {
        x, y: y + 1.3, z, vx: dirX * 3.2, vz: dirZ * 3.2,
        scaleStart: 1.0, scaleEnd: 1.65, dur: opts.dur || 3.6, theme: th,
        spinY: 6.5, scrollY: -1.8, rimPow: 1.5, dissolveStart: 0.78,
      });
      this.spawnDecal('shock_ring', x, y, z, { theme: th, scaleStart: 1.2, scaleEnd: 3.6, dur: 0.9, spinY: 3.0 });
    } else if (kind === 'spear_cage') {
      const th = theme || 'thunder';
      const R = opts.radius || 3.2;
      this.spawnDecal('magic_circle', x, y, z, { theme: th, scaleStart: R * 1.9, scaleEnd: R * 2.1, dur: 3.2, spinY: 1.2 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.spawnMesh('knight_spear', {
          x: x + Math.cos(a) * R, y: y + 1.1, z: z + Math.sin(a) * R,
          rx: Math.PI, ry: -a,
          scaleStart: 1.15, scaleEnd: 1.15, dur: 3.0, theme: th,
          additive: false, rimPow: 1.5, dissolveStart: 0.82,
        });
      }
    } else if (kind === 'ice_puffer') {
      const th = theme || 'frost';
      this.spawnMesh('ice_puffer', {
        x, y: y + 1.0, z, ry: yaw,
        scaleStart: 0.7, scaleEnd: 1.95, dur: 0.75, theme: th,
        additive: false, rimPow: 1.4,
      });
      this.spawnMesh('ice_shards', {
        x, y: y + 0.5, z, scaleStart: 0.8, scaleEnd: 2.8, dur: 0.9, theme: th, spinY: 2.2,
      });
      this.spawnDecal('shock_ring', x, y, z, { theme: th, scaleStart: 1.2, scaleEnd: 5.4, dur: 0.8 });
    } else if (kind === 'candle_ward') {
      const th = theme || 'bluefire';
      const R = opts.radius || 3.0;
      this.spawnDecal('holy_ring', x, y, z, { theme: th, scaleStart: R * 1.9, scaleEnd: R * 2.1, dur: opts.dur || 6.0, spinY: 0.7 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.spawnMesh('candle', {
          x: x + Math.cos(a) * R, y: y + 0.45, z: z + Math.sin(a) * R,
          scaleStart: 0.65, scaleEnd: 0.65, dur: opts.dur || 6.0, theme: th,
          additive: false, rimPow: 1.6, dissolveStart: 0.85,
        });
      }
    } else if (kind === 'spirit_sun') {
      const th = theme || 'holy';
      this.spawnMesh('sphere_flames', {
        x, y: y + 2.4, z, scaleStart: 0.8, scaleEnd: 2.6, dur: 2.2, theme: th,
        spinY: 2.4, spinX: 1.2, scrollY: 1.2, rimPow: 1.4,
      });
      this.spawnDecal('holy_ring', x, y, z, { theme: th, scaleStart: 1.8, scaleEnd: 8.5, dur: 1.5, spinY: 1.5 });
      this.spawnDecal('mana_runes', x, y, z, { theme: 'lotus', scaleStart: 1.5, scaleEnd: 7.0, dur: 1.2, spinY: -1.8 });
    } else if (kind === 'arrows_rain') {
      const th = theme || 'wind';
      this.spawnDecal('arrows_mist', x, y, z, { theme: th, scaleStart: 1.8, scaleEnd: 4.5, dur: 1.1, spinY: 0.5 });
      for (let i = 0; i < 7; i++) {
        const ox = (Math.random() - 0.5) * 3.4, oz = (Math.random() - 0.5) * 3.4;
        this.spawnMesh('arrow', {
          x: x + ox, y: y + 5.5 + i * 0.45, z: z + oz,
          rx: Math.PI * 0.5, vy: -16,
          scaleStart: 0.75, scaleEnd: 0.85, dur: 0.65, theme: th,
          additive: false, rimPow: 1.2,
        });
      }
    } else if (kind === 'ground_slam') {
      const th = theme || 'earth';
      this.spawnMesh('ground_crack', { x, y: y + 0.12, z, ry: yaw, scaleStart: 1.2, scaleEnd: 2.6, dur: 0.95, theme: th, additive: false });
      this.spawnDecal('ground_crack', x, y, z, { theme: th, scaleStart: 1.4, scaleEnd: 4.8, dur: 1.0 });
      this.spawnDecal('shock_ring', x, y, z, { theme: th, scaleStart: 1.0, scaleEnd: 5.2, dur: 0.55 });
    } else if (kind === 'totem') {
      const th = theme || 'holy';
      const mk = opts.heal ? 'totem_heal' : 'totem_rage';
      this.spawnMesh(mk, { x, y: y + 0.9, z, scaleStart: 0.9, scaleEnd: 1.1, dur: opts.dur || 6.0, theme: th, additive: false, spinY: 0.6, dissolveStart: 0.85 });
      this.spawnDecal('magic_circle', x, y, z, { theme: th, scaleStart: 2.2, scaleEnd: 2.8, dur: opts.dur || 6.0, spinY: 0.9 });
    } else if (kind === 'lotus_burst') {
      const th = theme || 'lotus';
      this.spawnDecal('holy_ring', x, y, z, { theme: th, scaleStart: 1.2, scaleEnd: 5.4, dur: 0.95, spinY: 2.0 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.spawnMesh('petal', {
          x: x + Math.cos(a) * 0.7, y: y + 0.7, z: z + Math.sin(a) * 0.7,
          vx: Math.cos(a) * 3.8, vy: 2.2, vz: Math.sin(a) * 3.8, gravity: 3.5,
          spinX: 5, spinY: 7, scaleStart: 0.55, scaleEnd: 0.35, dur: 0.95, theme: th, additive: false,
        });
      }
    }
  }

  /**
   * 頭頂高危預警標誌＋動漫衝擊預警圈（世界王降臨、Boss 轉階段狂暴）
   */
  spawnWarning(x, y, z, dur = 1.25, radius = 3.8, theme = 'fire') {
    const mat = createPilotoFxMaterial({
      theme, map: getVfxTex('warning_icon'), rimPow: 0, opacity: 0.98, additive: false, pixelSnap: 64,
    });
    const mesh = new THREE.Mesh(sharedBillboard(), mat);
    mesh.position.set(x, y + 2.5, z);
    mesh.renderOrder = 14;
    this._add({ obj: mesh, mats: [mat], t: 0, dur, s0: 0.9, s1: 1.55, billboard: true, dissolveStart: 0.72, baseOpacity: 0.98 });
    this.spawnDecal('anime_shock', x, y, z, { theme, scaleStart: radius * 0.6, scaleEnd: radius * 1.45, dur: Math.min(dur, 0.9), spinY: 3.5 });
  }

  /**
   * 序列幀煙霧爆散＋液體噪點地表擴散（毒霧陷阱、元素反應）
   */
  spawnSmokeBurst(x, y, z, theme = 'poison', radius = 2.8) {
    const mat = createPilotoFxMaterial({
      theme, map: getVfxTex('smoke_flipbook'), cols: 4, rows: 4, rimPow: 0, opacity: 0.9, additive: false, pixelSnap: 64,
    });
    const mesh = new THREE.Mesh(sharedBillboard(), mat);
    mesh.position.set(x, y + 1.15, z);
    mesh.renderOrder = 11;
    this._add({ obj: mesh, mats: [mat], t: 0, dur: 0.72, s0: radius * 0.7, s1: radius * 1.45, billboard: true, flipSpeed: 22, dissolveStart: 0.6, baseOpacity: 0.9 });
    this.spawnDecal('liquid_noise', x, y, z, { theme, scaleStart: radius * 0.9, scaleEnd: radius * 2.0, dur: 1.25, spinY: 1.4, dissolve: true });
  }

  /**
   * 秘術卡牌＋立體星芒陣（獵人標記、幻影突襲）
   */
  spawnArcanistCards(x, y, z, theme = 'arcane') {
    this.spawnMesh('magic_circle_star', { x, y: y + 0.16, z, theme, scaleStart: 0.85, scaleEnd: 1.85, dur: 0.95, spinY: 3.2 });
    this.spawnDecal('flare_glow', x, y, z, { theme, scaleStart: 1.2, scaleEnd: 3.6, dur: 0.65, spinY: 2.0 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const mat = createPilotoFxMaterial({ theme, map: getVfxTex('arcanist_cards'), rimPow: 0, opacity: 0.96, additive: true, pixelSnap: 64 });
      const card = new THREE.Mesh(sharedBillboard(), mat);
      card.position.set(x + Math.cos(a) * 1.1, y + 1.1, z + Math.sin(a) * 1.1);
      card.renderOrder = 12;
      this._add({ obj: card, mats: [mat], t: 0, dur: 0.85, vx: Math.cos(a) * 2.2, vy: 1.4, vz: Math.sin(a) * 2.2, s0: 0.75, s1: 1.1, billboard: true, dissolveStart: 0.58, baseOpacity: 0.96 });
    }
  }

  /**
   * 火焰高塔＋烈焰球體（隕星火雨落地引爆）
   */
  spawnFireTower(x, y, z, theme = 'fire') {
    this.spawnMesh('fire_tower', { x, y: y + 0.2, z, theme, scaleStart: 0.7, scaleEnd: 1.65, dur: 0.95, spinY: 2.8, scrollY: -1.6 });
    this.spawnMesh('sphere_flames', { x, y: y + 1.2, z, theme, scaleStart: 0.5, scaleEnd: 1.4, dur: 0.65, spinY: 4.5 });
    this.spawnDecal('ground_crack', x, y, z, { theme, scaleStart: 1.0, scaleEnd: 4.4, dur: 1.1 });
  }

  /**
   * 3D 魔力水晶＋柔光星芒（折光棱鏡）
   */
  spawnManaCrystal(x, y, z, dur = 8.0, theme = 'arcane') {
    this.spawnMesh('mana_crystal', { x, y: y + 1.15, z, theme, scaleStart: 0.75, scaleEnd: 0.95, dur, spinY: 2.2, additive: false, rimPow: 1.6, dissolveStart: 0.88 });
    this.spawnDecal('flare_glow', x, y, z, { theme, scaleStart: 1.8, scaleEnd: 2.6, dur: Math.min(dur, 2.5), spinY: 1.4 });
  }

  /**
   * 聖潔和平徽記＋光環（飲用藥瓶、復活祝福）
   */
  spawnPeaceBlessing(x, y, z, theme = 'lotus') {
    this.spawnMesh('peace_emblem', { x, y: y + 1.65, z, theme, scaleStart: 0.55, scaleEnd: 1.15, dur: 0.95, vy: 0.8, spinY: 2.8, additive: false, rimPow: 1.4 });
    this.spawnDecal('holy_ring', x, y, z, { theme, scaleStart: 1.1, scaleEnd: 3.0, dur: 0.85, spinY: 1.8 });
  }

  /**
   * 高速旋轉手裏劍扇形齊射（幻影突襲）
   */
  spawnShurikenFan(x, y, z, dirX = 0, dirZ = 1, theme = 'death') {
    const baseA = Math.atan2(dirX, dirZ);
    for (let i = -1; i <= 1; i++) {
      const a = baseA + i * 0.28;
      this.spawnMesh('shuriken', {
        x: x + Math.sin(a) * 0.6, y: y + 0.85, z: z + Math.cos(a) * 0.6,
        vx: Math.sin(a) * 14, vz: Math.cos(a) * 14,
        spinY: 18, scaleStart: 0.85, scaleEnd: 0.95, dur: 0.55, theme, additive: false, rimPow: 1.5,
      });
    }
  }

  /**
   * 3D 奧術飛彈拖尾（餘燼彈升級）
   */
  spawnMagicMissile(x, y, z, dirX = 0, dirZ = 1, theme = 'fire') {
    const yaw = Math.atan2(dirX, dirZ);
    this.spawnMesh('magic_missile', {
      x: x + dirX * 0.5, y: y + 0.72, z: z + dirZ * 0.5, ry: yaw,
      vx: dirX * 16.5, vz: dirZ * 16.5,
      scaleStart: 0.72, scaleEnd: 0.88, dur: 0.55, theme, scrollY: 1.4, rimPow: 1.5,
    });
  }

  /**
   * Wave 2：立體利爪撕裂斬＋裂地爪痕＋火花爆散（暗影巨狼、刺客暴擊、Boss 狂暴）
   */
  spawnClawSlash(x, y, z, yaw = 0, theme = 'death') {
    this.spawnMesh('claw_slash', { x, y: y + 0.9, z, ry: yaw, scaleStart: 1.1, scaleEnd: 2.3, dur: 0.42, theme, spinY: 2.4, rimPow: 1.8 });
    this.spawnDecal('ground_slash', x, y, z, { theme, ry: yaw, scaleStart: 1.5, scaleEnd: 4.2, dur: 0.85, spinY: 0 });
    const mat = createPilotoFxMaterial({ theme, map: getVfxTex('sparks_atlas'), rimPow: 0, opacity: 0.95, additive: true, pixelSnap: 64 });
    const sp = new THREE.Mesh(sharedBillboard(), mat);
    sp.position.set(x, y + 1.0, z); sp.renderOrder = 12;
    this._add({ obj: sp, mats: [mat], t: 0, dur: 0.36, s0: 1.0, s1: 2.4, billboard: true, dissolveStart: 0.5, baseOpacity: 0.95 });
  }

  /**
   * Wave 2：氣場升騰＋八芒星陣＋金星閃耀（升級、二轉覺醒、試煉之塔通關）
   */
  spawnKiAscension(x, y, z, theme = 'holy') {
    this.spawnMesh('aura_ki', { x, y: y + 1.1, z, theme, scaleStart: 0.7, scaleEnd: 2.2, dur: 1.35, spinY: 3.4, scrollY: -1.8, rimPow: 1.6 });
    this.spawnMesh('octacircle', { x, y: y + 0.14, z, theme, scaleStart: 1.0, scaleEnd: 2.8, dur: 1.4, spinY: -1.6 });
    this.spawnDecal('mana_aura', x, y, z, { theme, scaleStart: 1.6, scaleEnd: 4.6, dur: 1.35, spinY: 1.8 });
    const mat = createPilotoFxMaterial({ theme, map: getVfxTex('star_flare'), rimPow: 0, opacity: 0.98, additive: true, pixelSnap: 64 });
    const star = new THREE.Mesh(sharedBillboard(), mat);
    star.position.set(x, y + 2.2, z); star.renderOrder = 13;
    this._add({ obj: star, mats: [mat], t: 0, dur: 0.95, vy: 0.7, s0: 0.8, s1: 2.2, billboard: true, dissolveStart: 0.6, baseOpacity: 0.98 });
  }

  /**
   * Wave 2：3D 劇毒壁障＋深淵黑泥地面（毒霧陷阱、世界事件阻隔）
   */
  spawnPoisonWall(x, y, z, yaw = 0, theme = 'poison') {
    this.spawnMesh('poison_wall', { x, y: y + 0.85, z, ry: yaw, theme, scaleStart: 0.9, scaleEnd: 1.9, dur: 1.6, scrollY: -1.4, rimPow: 1.6, dissolveStart: 0.72 });
    this.spawnDecal('dark_decal', x, y, z, { theme, scaleStart: 1.8, scaleEnd: 4.2, dur: 1.65, spinY: 0.6 });
  }

  /**
   * Wave 2：螺旋氣旋衝刺＋4x4 電光瞬閃（翻滾閃避、疾風旋斬）
   */
  spawnTwirlDash(x, y, z, theme = 'wind') {
    this.spawnMesh('vfx_twirl', { x, y: y + 0.7, z, theme, scaleStart: 0.75, scaleEnd: 1.65, dur: 0.42, spinY: 9.0, scrollY: -2.0 });
    const mat = createPilotoFxMaterial({ theme, map: getVfxTex('shock_zap'), cols: 4, rows: 4, rimPow: 0, opacity: 0.9, additive: true, pixelSnap: 64 });
    const zap = new THREE.Mesh(sharedBillboard(), mat);
    zap.position.set(x, y + 0.8, z); zap.renderOrder = 11;
    this._add({ obj: zap, mats: [mat], t: 0, dur: 0.36, s0: 0.8, s1: 1.8, billboard: true, flipSpeed: 32, dissolveStart: 0.55, baseOpacity: 0.9 });
  }

  /**
   * Wave 2：3D 水幕護盾球體＋冰裂地面（極光新星、小隊陣型護盾）
   */
  spawnWaterShield(x, y, z, dur = 2.4, theme = 'frost') {
    this.spawnMesh('water_sphere', { x, y: y + 1.0, z, theme, scaleStart: 0.9, scaleEnd: 1.45, dur, spinY: 1.8, scrollY: 0.9, opacity: 0.62, rimPow: 2.0, dissolveStart: 0.8 });
    this.spawnDecal('iced_crack', x, y, z, { theme, scaleStart: 1.4, scaleEnd: 4.5, dur: Math.min(dur, 1.5), spinY: 0.3 });
  }

  /**
   * Wave 2：3D 元素聖槍穿刺＋焦灼火痕（雷槍聖牢、世界王）
   */
  spawnElementalSpear(x, y, z, dirX = 0, dirZ = 1, theme = 'thunder') {
    const yaw = Math.atan2(dirX, dirZ);
    this.spawnMesh('elemental_spear', { x: x + dirX * 0.6, y: y + 1.0, z: z + dirZ * 0.6, rx: Math.PI * 0.5, ry: yaw, vx: dirX * 15, vz: dirZ * 15, scaleStart: 1.15, scaleEnd: 1.45, dur: 0.72, theme, additive: false, rimPow: 1.6 });
    this.spawnDecal('fire_ground', x + dirX * 2.2, y, z + dirZ * 2.2, { theme, scaleStart: 1.4, scaleEnd: 3.8, dur: 1.2, spinY: 0.4 });
  }

  /**
   * Wave 2：潛能魔方洗煉／符文鑲嵌爆發（浮空菱形法陣＋奧術符文＋星芒）
   */
  spawnPotentialCubeBurst(x, y, z, tier = 'SSR') {
    const th = tier === 'UR' ? 'holy' : tier === 'SSR' ? 'fire' : 'arcane';
    this.spawnMesh('magic_losangles', { x, y: y + 1.35, z, theme: th, scaleStart: 0.75, scaleEnd: 2.1, dur: 1.15, spinY: 3.8, rimPow: 1.8 });
    this.spawnDecal('arcane_runes', x, y, z, { theme: th, scaleStart: 1.4, scaleEnd: 4.2, dur: 1.2, spinY: -2.0 });
    const mat = createPilotoFxMaterial({ theme: th, map: getVfxTex('star_flare'), rimPow: 0, opacity: 0.98, additive: true, pixelSnap: 64 });
    const star = new THREE.Mesh(sharedBillboard(), mat);
    star.position.set(x, y + 1.8, z); star.renderOrder = 13;
    this._add({ obj: star, mats: [mat], t: 0, dur: 0.75, s0: 0.9, s1: 2.5, billboard: true, dissolveStart: 0.55, baseOpacity: 0.98 });
  }

  /**
   * Wave 2：深淵惡意之眼＋黑暗裂隙＋八芒封印（世界王、動態事件、Boss 狂暴）
   */
  spawnMaliceRift(x, y, z, theme = 'death') {
    this.spawnMesh('octacircle', { x, y: y + 0.16, z, theme, scaleStart: 1.2, scaleEnd: 3.4, dur: 1.5, spinY: 2.2 });
    this.spawnDecal('dark_decal', x, y, z, { theme, scaleStart: 1.8, scaleEnd: 5.5, dur: 1.6, spinY: -0.9 });
    const mat = createPilotoFxMaterial({ theme, map: getVfxTex('malice_eyes'), rimPow: 0, opacity: 0.96, additive: false, pixelSnap: 64 });
    const eye = new THREE.Mesh(sharedBillboard(), mat);
    eye.position.set(x, y + 2.4, z); eye.renderOrder = 13;
    this._add({ obj: eye, mats: [mat], t: 0, dur: 1.35, vy: 0.35, s0: 1.0, s1: 2.1, billboard: true, dissolveStart: 0.68, baseOpacity: 0.96 });
  }

  /**
   * Wave 2：生活副職與城鎮探索專屬 3D 慶祝特效（垂釣靈魚、爆破採礦、煉金藥瓶、鹿角圖騰）
   */
  spawnLifeSkillFx(kind, x, y, z) {
    if (kind === 'fish') {
      this.spawnMesh('small_fish', { x, y: y + 0.6, z, vy: 4.5, gravity: 10.5, spinY: 6.0, scaleStart: 0.85, scaleEnd: 1.15, dur: 0.95, theme: 'frost', additive: false, rimPow: 1.4 });
      this.spawnWaterShield(x, y, z, 0.95, 'frost');
    } else if (kind === 'ore') {
      this.spawnMesh('tnt_bundle', { x, y: y + 0.85, z, vy: 3.2, gravity: 9.0, spinX: 5, spinY: 6, scaleStart: 0.75, scaleEnd: 1.0, dur: 0.8, theme: 'fire', additive: false, rimPow: 1.5 });
      this.spawnDecal('fire_ground', x, y, z, { theme: 'fire', scaleStart: 1.0, scaleEnd: 3.0, dur: 1.0, spinY: 0.8 });
    } else if (kind === 'brew' || kind === 'offline') {
      this.spawnMesh('potion_vial', { x, y: y + 1.35, z, vy: 0.9, spinY: 3.2, scaleStart: 0.75, scaleEnd: 1.1, dur: 1.15, theme: 'lotus', additive: false, rimPow: 1.5 });
      this.spawnDecal('mana_aura', x, y, z, { theme: 'lotus', scaleStart: 1.2, scaleEnd: 3.2, dur: 1.1, spinY: 1.5 });
    } else {
      this.spawnMesh('totem_antlers', { x, y: y + 1.0, z, spinY: 1.6, scaleStart: 0.85, scaleEnd: 1.25, dur: 1.45, theme: 'wind', additive: false, rimPow: 1.5 });
      this.spawnDecal('mana_aura', x, y, z, { theme: 'wind', scaleStart: 1.5, scaleEnd: 3.6, dur: 1.3, spinY: 1.2 });
    }
  }

  /**
   * 角色腳底持續法陣光環（供二轉覺醒與角色劇院英雄展示使用）
   */
  createHeroAura(theme = 'arcane', radius = 1.6) {
    const grp = new THREE.Group();
    const mat = createPilotoFxMaterial({
      theme,
      map: getVfxTex(theme === 'lotus' || theme === 'holy' ? 'holy_ring' : 'magic_circle'),
      rimPow: 0,
      opacity: 0.72,
      pixelSnap: 64,
    });
    const disc = new THREE.Mesh(sharedPlane(), mat);
    disc.scale.set(radius, 1, radius);
    disc.position.y = 0.06;
    disc.userData.noNormal = true;
    grp.add(disc);
    grp.userData.auraMat = mat;
    grp.userData.dispose = () => mat.dispose();
    return grp;
  }

  update(dt, camera = null) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t >= it.dur) {
        this._removeAt(i);
        continue;
      }
      const p = it.t / it.dur;
      if (it.vx || it.vy || it.vz) {
        it.obj.position.x += it.vx * dt;
        it.obj.position.y += it.vy * dt;
        it.obj.position.z += it.vz * dt;
      }
      if (it.gravity) it.vy -= it.gravity * dt;
      if (it.spinX) it.obj.rotation.x += it.spinX * dt;
      if (it.spinY) it.obj.rotation.y += it.spinY * dt;
      if (it.spinZ) it.obj.rotation.z += it.spinZ * dt;
      if (it.billboard && camera) it.obj.quaternion.copy(camera.quaternion);

      if (!it.keepScale) {
        const sc = it.s0 + (it.s1 - it.s0) * p;
        if (it.flatScale) it.obj.scale.set(sc, 1, sc);
        else it.obj.scale.setScalar(sc);
      }

      const fadeK = p > it.dissolveStart ? 1 - (p - it.dissolveStart) / Math.max(0.01, 1 - it.dissolveStart) : 1;
      for (const m of it.mats || []) {
        if (!m?.uniforms) continue;
        m.uniforms.uTime.value = it.t;
        m.uniforms.uOpacity.value = (it.baseOpacity ?? 0.95) * fadeK;
        if (p > it.dissolveStart) {
          m.uniforms.uDissolve.value = (p - it.dissolveStart) / Math.max(0.01, 1 - it.dissolveStart);
        }
        if (it.flipSpeed) m.uniforms.uFrame.value = it.t * it.flipSpeed;
      }
      if (it.onTick) it.onTick(it, p, dt);
    }
  }
}

export { VFX_THEMES };
