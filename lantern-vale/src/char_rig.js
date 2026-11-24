// Phase C2：Modular Cute Fantasy 角色工廠（36 組統一骨架網格即時換裝 + 5 套獨立骨骼動畫）
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CharAnimator } from './char_anim.js';

export const JOB_ARCHETYPES = ['fighter', 'archer', 'mage', 'necromancer', 'monk'];

export const CHAR_CATALOG = {
  skinTones: [
    { id: 0, name: '白皙', hex: '#fde2c8', suffix: 'A' },
    { id: 1, name: '暖米', hex: '#e6b88a', suffix: 'B' },
    { id: 2, name: '蜜銅', hex: '#b87d56', suffix: 'C' },
  ],
  eyeColors: [
    { id: 0, name: '湖藍', hex: '#4898c8', suffix: 'A' },
    { id: 1, name: '翠綠', hex: '#4aa86a', suffix: 'B' },
    { id: 2, name: '秘紫', hex: '#8862d8', suffix: 'C' },
    { id: 3, name: '暖棕', hex: '#7a4e32', suffix: 'D' },
  ],
  hairStyles: [
    { id: 0, mesh: 'hair_001', name: '俐落短髮', icon: '💇' },
    { id: 1, mesh: 'hair_002', name: '蓬鬆層次', icon: '✂️' },
    { id: 2, mesh: 'hair_003', name: '俏麗瀏海', icon: '🎀' },
    { id: 3, mesh: 'hair_004', name: '柔順中長', icon: '🌿' },
    { id: 4, mesh: 'hair_005', name: '精靈微捲', icon: '✨' },
  ],
  hairTints: [
    { id: 0, name: '原色', hex: '#ffffff', swatch: '#c49a6c' },
    { id: 1, name: '栗棕', hex: '#a87654', swatch: '#8a5a3c' },
    { id: 2, name: '炭黑', hex: '#524b58', swatch: '#39323e' },
    { id: 3, name: '蜜金', hex: '#ffe496', swatch: '#e6b84a' },
    { id: 4, name: '櫻粉', hex: '#ffb4ca', swatch: '#f082a4' },
    { id: 5, name: '銀藍', hex: '#b8d8ff', swatch: '#7caee8' },
    { id: 6, name: '赤紅', hex: '#eb8070', swatch: '#c84b3a' },
    { id: 7, name: '苔綠', hex: '#9ad89e', swatch: '#589c62' },
  ],
  hats: [
    { id: 'none',       name: '不戴帽子',   icon: '—',  mesh: null },
    { id: 'fighter_01', name: '旅人額帶',   icon: '🎗️', mesh: 'outfit_fighter_hat_001' },
    { id: 'mage_01',    name: '星夜巫師帽', icon: '🧙', mesh: 'outfit_mage_hat_001' },
    { id: 'mage_02',    name: '典雅大法帽', icon: '🎩', mesh: 'outfit_mage_hat_002' },
    { id: 'necro_01',   name: '暗影大兜帽', icon: '🥷', mesh: 'outfit_necromancer_hat_001' },
    { id: 'monk_01',    name: '雲遊竹斗笠', icon: '👒', mesh: 'outfit_monk_hat_001' },
  ],
  bodies: [
    { id: 'fighter_01', name: '衛士輕甲',   icon: '🛡️', mesh: 'outfit_fighter_body_001' },
    { id: 'archer_01',  name: '林風獵裝',   icon: '🏹', mesh: 'outfit_archer_body_001' },
    { id: 'mage_01',    name: '晨曦法袍',   icon: '🔮', mesh: 'outfit_mage_body_001', tex: 'mage_body_001.png' },
    { id: 'mage_02',    name: '星夜秘袍',   icon: '🌌', mesh: 'outfit_mage_body_001', tex: 'mage_body_002.png' },
    { id: 'necro_01',   name: '幽霧影袍',   icon: '🌙', mesh: 'outfit_necromancer_body_001' },
    { id: 'monk_01',    name: '禪燈僧服',   icon: '🥋', mesh: 'outfit_monk_body_001' },
  ],
  cloaks: [
    { id: 'none',          name: '輕裝無背飾', icon: '—',  meshes: [] },
    { id: 'archer_full',   name: '林風披風＋箭袋', icon: '🏹', meshes: ['outfit_archer_cloak_001', 'outfit_archer_quiver_001'] },
    { id: 'archer_cloak',  name: '林風短披風', icon: '🧣', meshes: ['outfit_archer_cloak_001'] },
    { id: 'archer_quiver', name: '羽箭箭袋',   icon: '🎯', meshes: ['outfit_archer_quiver_001'] },
    { id: 'mage_cloak',    name: '星辰斗篷',   icon: '✨', meshes: ['outfit_mage_cloak_001'] },
    { id: 'monk_cloak',    name: '雲遊禪披',   icon: '🍃', meshes: ['outfit_monk_cloak_001'] },
  ],
  boots: [
    { id: 'fighter_01', name: '鐵扣戰靴', icon: '🥾', mesh: 'outfit_fighter_boots_001' },
    { id: 'archer_01',  name: '林間軟靴', icon: '👢', mesh: 'outfit_archer_boots_001' },
    { id: 'mage_01',    name: '星紋法靴', icon: '👟', mesh: 'outfit_mage_boots_001' },
    { id: 'necro_01',   name: '幽影長靴', icon: '🖤', mesh: 'outfit_necromancer_boots_001' },
    { id: 'monk_01',    name: '草編禪履', icon: '🩴', mesh: 'outfit_monk_boots_001' },
  ],
  gloves: [
    { id: 'none',       name: '無護腕',   icon: '—',  mesh: null },
    { id: 'fighter_01', name: '戰士護腕', icon: '🥊', mesh: 'outfit_fighter_gloves_001' },
  ],
  weapons: [
    { id: 'auto',     name: '依裝備自動', icon: '✨', meshes: [] },
    { id: 'axe_01',   name: '古銅雙刃斧', icon: '🪓', meshes: ['weapon_fighteraxe_001'] },
    { id: 'axe_02',   name: '精鋼戰斧',   icon: '⚔️', meshes: ['weapon_fighteraxe_002'] },
    { id: 'bow_01',   name: '樺木獵弓',   icon: '🏹', meshes: ['weapon_archerbow_001', 'weapon_archerarrow_001'] },
    { id: 'staff_01', name: '藍晶法杖',   icon: '🪄', meshes: ['weapon_magestaff_001'], tex: 'mage_staff_A.png' },
    { id: 'staff_02', name: '秘火法杖',   icon: '🔥', meshes: ['weapon_magestaff_001'], tex: 'mage_staff_B.png' },
    { id: 'blade_01', name: '幽霧秘刃',   icon: '🗡️', meshes: ['weapon_necromancerblade_001'] },
    { id: 'monk_01',  name: '禪燈長棍',   icon: '🥢', meshes: ['weapon_monkstaff_001'] },
  ],
  classPresets: [
    // 0: 守燈衛士 Fighter
    { job: 0, skinTone: 1, eyeColor: 1, hairStyle: 0, hairTint: 0, hat: 'fighter_01', body: 'fighter_01', cloak: 'none',        boots: 'fighter_01', gloves: 'fighter_01', weaponSkin: 'axe_01' },
    // 1: 林風遊俠 Archer
    { job: 1, skinTone: 0, eyeColor: 0, hairStyle: 1, hairTint: 0, hat: 'none',       body: 'archer_01',  cloak: 'archer_full', boots: 'archer_01',  gloves: 'none',       weaponSkin: 'bow_01' },
    // 2: 餘燼秘術師 Mage
    { job: 2, skinTone: 0, eyeColor: 0, hairStyle: 2, hairTint: 3, hat: 'mage_01',    body: 'mage_01',    cloak: 'mage_cloak',  boots: 'mage_01',    gloves: 'none',       weaponSkin: 'staff_01' },
    // 3: 影刃行者 Necromancer
    { job: 3, skinTone: 0, eyeColor: 2, hairStyle: 3, hairTint: 5, hat: 'necro_01',   body: 'necro_01',   cloak: 'none',        boots: 'necro_01',   gloves: 'none',       weaponSkin: 'blade_01' },
    // 4: 禪燈武僧 Monk
    { job: 4, skinTone: 1, eyeColor: 3, hairStyle: 4, hairTint: 1, hat: 'monk_01',    body: 'monk_01',    cloak: 'monk_cloak',  boots: 'monk_01',    gloves: 'none',       weaponSkin: 'monk_01' },
  ],
};

export function normalizeCharacterLook(raw, jobOverride = null) {
  const job = Number.isInteger(jobOverride) ? jobOverride : (Number.isInteger(raw?.job) ? Math.max(0, Math.min(4, raw.job)) : 0);
  const preset = CHAR_CATALOG.classPresets[job] || CHAR_CATALOG.classPresets[0];
  if (!raw || raw.version !== 2) {
    return {
      version: 2,
      ...preset,
      skinTone: Number.isInteger(raw?.skin) ? Math.min(2, raw.skin) : preset.skinTone,
      hairTint: Number.isInteger(raw?.hair) ? Math.min(7, raw.hair) : preset.hairTint,
      hairStyle: Number.isInteger(raw?.style) ? Math.min(4, raw.style) : preset.hairStyle,
      favorites: Array.isArray(raw?.favorites) ? raw.favorites : [],
    };
  }
  return { ...preset, ...raw, version: 2, job };
}

export function resolveWeaponMeshes(weaponSkin, equipWeapon = 'staff', job = 0) {
  if (weaponSkin && weaponSkin !== 'auto') {
    const def = CHAR_CATALOG.weapons.find(w => w.id === weaponSkin);
    if (def) return def;
  }
  if (equipWeapon === 'bow') return CHAR_CATALOG.weapons.find(w => w.id === 'bow_01');
  if (equipWeapon === 'blades') return CHAR_CATALOG.weapons.find(w => w.id === 'blade_01');
  if (equipWeapon === 'shield') return CHAR_CATALOG.weapons.find(w => w.id === 'axe_01');
  if (job === 4) return CHAR_CATALOG.weapons.find(w => w.id === 'monk_01');
  return CHAR_CATALOG.weapons.find(w => w.id === 'staff_01');
}

// ---------------- 共享資源快取 ----------------
let _basePromise = null;
let _baseScene = null;
const _animPromises = new Map();
const _animClips = new Map();
const _texCache = new Map();

function canLoadAssets() {
  return typeof window !== 'undefined' && typeof fetch !== 'undefined' && location.protocol !== 'file:';
}

function getTex(filename) {
  if (!filename || typeof THREE === 'undefined') return null;
  if (_texCache.has(filename)) return _texCache.get(filename);
  const loader = new THREE.TextureLoader();
  const tex = loader.load(`assets/char/tex/${filename}`);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(filename, tex);
  return tex;
}

export function loadBaseCharacter() {
  if (_baseScene) return Promise.resolve(_baseScene);
  if (_basePromise) return _basePromise;
  if (typeof window === 'undefined') return Promise.resolve(null);
  const loader = new GLTFLoader();
  _basePromise = new Promise(resolve => {
    loader.load(
      'assets/char/adventurer_base.glb',
      gltf => { _baseScene = gltf.scene; resolve(_baseScene); },
      undefined,
      err => { console.warn('[CharRig] Failed to load adventurer_base.glb:', err?.message || err); resolve(null); }
    );
  });
  return _basePromise;
}

export function loadArchetypeAnims(archetype = 'fighter') {
  const key = JOB_ARCHETYPES.includes(archetype) ? archetype : 'fighter';
  if (_animClips.has(key)) return Promise.resolve(_animClips.get(key));
  if (_animPromises.has(key)) return _animPromises.get(key);
  if (typeof window === 'undefined') return Promise.resolve([]);
  const loader = new GLTFLoader();
  const p = new Promise(resolve => {
    loader.load(
      `assets/char/anim_${key}.glb`,
      gltf => {
        const clips = gltf.animations || [];
        _animClips.set(key, clips);
        resolve(clips);
      },
      undefined,
      err => { console.warn(`[CharRig] Failed to load anim_${key}.glb:`, err?.message || err); resolve([]); }
    );
  });
  _animPromises.set(key, p);
  return p;
}

export function preloadAllCharacterAnims() {
  loadBaseCharacter();
  JOB_ARCHETYPES.forEach(k => loadArchetypeAnims(k));
}

/**
 * 切換模組化角色全部 36 組蒙皮網格的可見度、膚色／瞳色／法袍貼圖與髮色
 */
export function applyModularLook(rigRoot, lookInput, equipWeapon = 'staff') {
  if (!rigRoot) return;
  const look = normalizeCharacterLook(lookInput);
  const hairMesh = CHAR_CATALOG.hairStyles[look.hairStyle]?.mesh || 'hair_001';
  const hairTintHex = CHAR_CATALOG.hairTints[look.hairTint]?.hex || '#ffffff';
  const hatDef = CHAR_CATALOG.hats.find(h => h.id === look.hat) || CHAR_CATALOG.hats[0];
  const bodyDef = CHAR_CATALOG.bodies.find(b => b.id === look.body) || CHAR_CATALOG.bodies[0];
  const cloakDef = CHAR_CATALOG.cloaks.find(c => c.id === look.cloak) || CHAR_CATALOG.cloaks[0];
  const bootsDef = CHAR_CATALOG.boots.find(b => b.id === look.boots) || CHAR_CATALOG.boots[0];
  const glovesDef = CHAR_CATALOG.gloves.find(g => g.id === look.gloves) || CHAR_CATALOG.gloves[0];
  const weaponDef = resolveWeaponMeshes(look.weaponSkin, equipWeapon, look.job);

  const visibleSet = new Set([
    'skin_body', 'skin_head', 'skin_brow', 'skin_nose',
    hairMesh,
    bodyDef?.mesh,
    bootsDef?.mesh,
    hatDef?.mesh,
    glovesDef?.mesh,
    ...(cloakDef?.meshes || []),
    ...(weaponDef?.meshes || []),
  ].filter(Boolean));

  const skinSuf = CHAR_CATALOG.skinTones[look.skinTone]?.suffix || 'A';
  const eyeSuf = CHAR_CATALOG.eyeColors[look.eyeColor]?.suffix || 'A';

  rigRoot.traverse(o => {
    if (!o.isMesh) return;
    const baseName = o.name.split('.')[0];
    o.visible = visibleSet.has(o.name) || visibleSet.has(baseName);
    if (!o.visible) return;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const mn = (m.name || '').split('.')[0];
      if (baseName.startsWith('hair_') || baseName === 'skin_brow') {
        m.color.set(hairTintHex);
      } else if (mn === 'Mat_skin_body_001') {
        const tx = getTex(`skin_body_${skinSuf}.png`);
        if (tx) { m.map = tx; m.needsUpdate = true; }
      } else if (mn === 'Mat_skin_face_001') {
        const tx = getTex(`skin_face_${skinSuf}.png`);
        if (tx) { m.map = tx; m.needsUpdate = true; }
      } else if (mn === 'Mat_skin_nose') {
        const tx = getTex(`skin_nose_${skinSuf}.png`);
        if (tx) { m.map = tx; m.needsUpdate = true; }
      } else if (mn === 'Mat_skin_eyes') {
        const tx = getTex(`skin_eyes_${eyeSuf}.png`);
        if (tx) { m.map = tx; m.needsUpdate = true; }
      } else if (mn === 'Mat_outfit_mage_body_001' && bodyDef?.tex) {
        const tx = getTex(bodyDef.tex);
        if (tx) { m.map = tx; m.needsUpdate = true; }
      } else if (mn.startsWith('Mat_weapon_magestaff_001') && weaponDef?.tex) {
        const tx = getTex(weaponDef.tex);
        if (tx) { m.map = tx; m.needsUpdate = true; }
      }
    }
  });
}

/**
 * 建立一個獨立的模組化 3D 角色控制器（自動共用幾何體、獨立材質與骨骼動畫機）
 */
export function createModularHero(lookInput, opts = {}) {
  const root = new THREE.Group();
  const rigHolder = new THREE.Group();
  root.add(rigHolder);

  let look = normalizeCharacterLook(lookInput);
  let equipWeapon = opts.weapon || 'staff';
  let rig = null;
  let animator = null;
  let disposed = false;
  let pendingState = opts.initialState || 'idle';
  const scale = opts.scale ?? 0.68;

  const ctrl = {
    root,
    rigHolder,
    ready: false,
    get animator() { return animator; },
    get look() { return look; },
    setLook(nextLook, nextWeapon) {
      look = normalizeCharacterLook(nextLook);
      if (nextWeapon !== undefined) equipWeapon = nextWeapon;
      if (rig) applyModularLook(rig, look, equipWeapon);
      const arch = JOB_ARCHETYPES[look.job] || 'fighter';
      if (animator && animator.archetype !== arch) {
        loadArchetypeAnims(arch).then(clips => {
          if (!disposed && animator) {
            animator.setClips(clips, arch);
            animator.play(pendingState, { force: true, fade: 0.08 });
          }
        });
      }
    },
    play(state, playOpts) {
      pendingState = state;
      return animator ? animator.play(state, playOpts) : false;
    },
    update(dt) {
      if (animator) animator.update(dt);
    },
    dispose() {
      disposed = true;
      if (animator) { animator.dispose(); animator = null; }
      if (rig) {
        rig.traverse(o => {
          if (o.isMesh && o.material) {
            // 只釋放每個角色 clone 出來的獨立材質，絕不釋放共享幾何體與共享貼圖！
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
            else o.material.dispose?.();
          }
        });
        rigHolder.remove(rig);
        rig = null;
      }
    },
  };

  loadBaseCharacter().then(baseScene => {
    if (disposed || !baseScene) return;
    rig = cloneSkinned(baseScene);
    rig.scale.setScalar(scale);
    // 依據 Blender 實測腳底座標微調貼地高度
    rig.position.y = opts.yOffset ?? 0.0;
    rig.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = opts.castShadow !== false;
      o.receiveShadow = opts.receiveShadow !== false;
      o.frustumCulled = false; // 避免骨骼動畫導致誤剔除
      if (Array.isArray(o.material)) {
        o.material = o.material.map(m => m.clone());
      } else if (o.material) {
        o.material = o.material.clone();
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        m.roughness = 0.88;
        m.metalness = 0.02;
      }
    });
    rigHolder.add(rig);
    applyModularLook(rig, look, equipWeapon);
    animator = new CharAnimator(rig);
    ctrl.ready = true;
    const arch = JOB_ARCHETYPES[look.job] || 'fighter';
    loadArchetypeAnims(arch).then(clips => {
      if (!disposed && animator) {
        animator.setClips(clips, arch);
        animator.play(pendingState, { force: true, fade: 0.05 });
      }
    });
    opts.onReady?.(ctrl);
  });

  return ctrl;
}
