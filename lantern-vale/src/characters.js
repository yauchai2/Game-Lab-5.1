// Phase C3–C4：雙舞台 3D 角色劇院（影片級浮空英雄小島平滑聚焦 + 圖 1 冒險手帳 + 圖 2 暖光木屋換裝間）
import * as THREE from 'three';
import { Meta } from './meta.js';
import { CLASSES, ALL_GEMS, ensurePuzzle } from './puzzle.js';
import { CHAR_CATALOG, JOB_ARCHETYPES, normalizeCharacterLook, createModularHero, preloadAllCharacterAnims } from './char_rig.js';

export const HOODS = [[0x2f8a7e,0x23695f],[0xd9543a,0xa83f2c],[0x6a6ad0,0x4a4aa0],[0xe0a030,0xb07f20],[0xc060b0,0x904488],[0x58a858,0x3f823f],[0x4aa0d8,0x3478a8],[0x8a6a50,0x65503c]];

const $ = id => document.getElementById(id);
const key = slot => slot === 0 ? 'lv_prof' : 'lv_prof_' + slot;
function read(id) { try { return JSON.parse(localStorage.getItem(id)); } catch { return null; } }
function clampIdx(value, count) { return Number.isInteger(value) && value >= 0 && value < count ? value : 0; }

// 浮空小島上 5 位英雄的站位（還原影片群像構圖：法師在中央苔石高台，弓手／戰士／術士／武僧環繞）
const ISLAND_SPOTS = [
  { job: 0, x: -0.78, y: 0.08, z:  0.88, rotY:  0.22, focusDist: 2.85, focusY: 0.56, en: 'Fighter' },
  { job: 1, x: -1.18, y: 0.04, z: -0.25, rotY:  0.52, focusDist: 2.85, focusY: 0.56, en: 'Archer' },
  { job: 2, x:  0.02, y: 0.56, z: -0.68, rotY:  0.02, focusDist: 2.95, focusY: 1.06, en: 'Mage' },
  { job: 3, x:  0.96, y: 0.06, z:  0.68, rotY: -0.28, focusDist: 2.85, focusY: 0.56, en: 'Necromancer' },
  { job: 4, x:  1.12, y: 0.14, z: -0.45, rotY: -0.52, focusDist: 2.85, focusY: 0.62, en: 'Monk' },
];

function buildDioramaIsland() {
  const grp = new THREE.Group();
  // 青翠圓盤草皮與土石浮島底座
  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(2.38, 2.15, 0.34, 28),
    new THREE.MeshStandardMaterial({ color: 0x8cd85c, roughness: 0.92 })
  );
  grass.position.y = -0.15; grass.receiveShadow = true; grp.add(grass);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(2.42, 0.09, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0x52c8d8, roughness: 0.4, transparent: true, opacity: 0.55 })
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = -0.22; grp.add(rim);

  const rockBase = new THREE.Mesh(
    new THREE.ConeGeometry(2.1, 1.35, 11),
    new THREE.MeshStandardMaterial({ color: 0x9c8266, roughness: 0.95, flatShading: true })
  );
  rockBase.rotation.x = Math.PI; rockBase.position.y = -0.98; grp.add(rockBase);

  // 中央苔石高台（供法師站立，層次立體感！）
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 1.05, 0.58, 9),
    new THREE.MeshStandardMaterial({ color: 0x829068, roughness: 0.92, flatShading: true })
  );
  mound.position.set(0.02, 0.27, -0.68); mound.castShadow = true; mound.receiveShadow = true; grp.add(mound);
  const moundCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.82, 0.12, 9),
    new THREE.MeshStandardMaterial({ color: 0x94de62, roughness: 0.9 })
  );
  moundCap.position.set(0.02, 0.54, -0.68); moundCap.receiveShadow = true; grp.add(moundCap);

  // 周邊苔石與黃白小野花（呼應參考影片草地細節）
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9ca48e, roughness: 0.92, flatShading: true });
  for (const [sx, sy, sz, sr] of [[-1.7, 0.12, 0.65, 0.34], [1.62, 0.14, -0.1, 0.38], [0.25, 0.08, 1.55, 0.25], [-0.9, 0.1, -1.45, 0.32]]) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(sr, 0), stoneMat);
    b.position.set(sx, sy, sz); b.scale.set(1.2, 0.72, 1); b.castShadow = true; grp.add(b);
  }
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5ca442, roughness: 0.9 });
  const petalY = new THREE.MeshStandardMaterial({ color: 0xffe45a, roughness: 0.65 });
  const petalW = new THREE.MeshStandardMaterial({ color: 0xfff8e6, roughness: 0.65 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.18;
    const r = 1.55 + (i % 3) * 0.24;
    const fx = Math.cos(a) * r, fz = Math.sin(a) * r;
    const fl = new THREE.Group(); fl.position.set(fx, 0.02, fz);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.16, 4), stemMat); st.position.y = 0.08; fl.add(st);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), i % 3 === 0 ? petalW : petalY);
    hd.position.y = 0.17; hd.scale.set(1.2, 0.55, 1.2); fl.add(hd);
    grp.add(fl);
  }
  return grp;
}

function buildDressupRug() {
  const grp = new THREE.Group();
  const rugOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.22, 0.06, 36),
    new THREE.MeshStandardMaterial({ color: 0xe68894, roughness: 0.92 })
  );
  rugOuter.position.y = -0.02; rugOuter.receiveShadow = true; grp.add(rugOuter);
  const rugInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.86, 0.07, 32),
    new THREE.MeshStandardMaterial({ color: 0xfff0d4, roughness: 0.92 })
  );
  rugInner.position.y = -0.015; rugInner.receiveShadow = true; grp.add(rugInner);
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0xc98a52, roughness: 0.88 })
  );
  floor.position.y = -0.06; floor.receiveShadow = true; grp.add(floor);
  // 溫馨木屋立鏡與暖陽窗框裝飾（呼應參考圖 2！）
  const mirrorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 1.85, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xd97a82, roughness: 0.75 })
  );
  mirrorFrame.position.set(1.25, 0.92, -1.05); mirrorFrame.rotation.y = -0.35; grp.add(mirrorFrame);
  const mirrorGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 1.66, 0.09),
    new THREE.MeshStandardMaterial({ color: 0xffe8d2, roughness: 0.25, metalness: 0.15 })
  );
  mirrorGlass.position.set(1.25, 0.92, -1.04); mirrorGlass.rotation.y = -0.35; grp.add(mirrorGlass);
  const lampPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, 1.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x7c5034, roughness: 0.85 })
  );
  lampPost.position.set(-1.35, 0.72, -0.85); grp.add(lampPost);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.34, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe69a })
  );
  lampShade.position.set(-1.35, 1.52, -0.85); grp.add(lampShade);
  return grp;
}

export function bindCharacters(game) {
  const titleEl = $('title');
  const canvas = $('creatorCanvas');
  const slotsSel = $('characterSlot');
  if (!titleEl || !canvas) return () => {};

  preloadAllCharacterAnims();

  let slot = clampIdx(read('lv_active_slot'), 3);
  if (slotsSel) {
    slotsSel.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      slotsSel.add(new Option(read(key(i))?.name || ('旅人欄位 ' + (i + 1)), i));
    }
    slotsSel.value = slot;
  }

  // 高解析柔光抗鋸齒 3D 舞台（依使用者確認選項 A2）
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 60);

  const hemi = new THREE.HemisphereLight(0xfff8ec, 0xc9a882, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d4, 1.85);
  sun.position.set(3.5, 6.5, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xa8e8ff, 0.65);
  rimLight.position.set(-4, 3, -3.5);
  scene.add(rimLight);

  // 舞台 1：浮空草地英雄群像小島
  const islandStage = new THREE.Group();
  const islandGeo = buildDioramaIsland();
  islandStage.add(islandGeo);
  scene.add(islandStage);

  // 漂浮發光星火粒子
  const sparkPos = new Float32Array(28 * 3);
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.4 + Math.random() * 1.5;
    sparkPos[i * 3] = Math.cos(a) * r;
    sparkPos[i * 3 + 1] = 0.25 + Math.random() * 2.2;
    sparkPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff0a0, size: 0.08, transparent: true, opacity: 0.85 }));
  islandStage.add(sparks);

  // 舞台 2：暖光木屋圓形地毯換裝間
  const dressupStage = new THREE.Group();
  dressupStage.visible = false;
  dressupStage.add(buildDressupRug());
  scene.add(dressupStage);

  // 5 位英雄實機 3D 角色
  const islandHeroes = ISLAND_SPOTS.map(sp => {
    const presetLook = normalizeCharacterLook(CHAR_CATALOG.classPresets[sp.job], sp.job);
    const hero = createModularHero(presetLook, { scale: 0.72, initialState: 'combatIdle' });
    hero.root.position.set(sp.x, sp.y, sp.z);
    hero.root.rotation.y = sp.rotY;
    // 點擊透明碰撞盒（Raycaster 命中更精準）
    const hitBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.45, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.y = 0.72;
    hitBox.userData.heroJob = sp.job;
    hero.root.add(hitBox);
    islandStage.add(hero.root);
    return { ...sp, hero, hitBox };
  });

  // 換裝間單人展示角色 + 換裝星星粒子迸發（Phase C6）
  const dressHero = createModularHero(CHAR_CATALOG.classPresets[0], { scale: 0.92, initialState: 'idle' });
  dressupStage.add(dressHero.root);
  const DU_SPARK_N = 24;
  const duSparkPos = new Float32Array(DU_SPARK_N * 3);
  const duSparkVel = new Float32Array(DU_SPARK_N * 3);
  const duSparkGeo = new THREE.BufferGeometry();
  duSparkGeo.setAttribute('position', new THREE.BufferAttribute(duSparkPos, 3));
  const duSparkMat = new THREE.PointsMaterial({ color: 0xffe478, size: 0.11, transparent: true, opacity: 0, depthWrite: false });
  const duSparks = new THREE.Points(duSparkGeo, duSparkMat);
  dressupStage.add(duSparks);
  let duSparkLife = 0;

  // 選中腳底暖金發光環
  const selRing = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.62, 28),
    new THREE.MeshBasicMaterial({ color: 0xffdf6a, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
  );
  selRing.rotation.x = -Math.PI / 2;
  islandStage.add(selRing);

  // 狀態控制
  let stageMode = 'overview'; // 'overview' | 'focus' | 'dressup'
  let dressCat = 'preset';    // 'preset' | 'face' | 'hat' | 'body' | 'cloak' | 'boots' | 'weapon'
  let selectedJob = 0;
  let activeSlotLook = normalizeCharacterLook(null, 0);
  let activeGemDetail = null;
  let running = true;
  let inTownWardrobe = false;

  // 平滑電影運鏡（Camera Dolly & Orbit）— 將 3D 舞台居中於左側 64% 視覺區，角色正面朝向觀眾！
  let orbitYaw = 0.0, orbitVel = 0, dressRotY = 0;
  const camCurPos = new THREE.Vector3(0.95, 1.85, 6.20);
  const camCurTarget = new THREE.Vector3(0.88, 0.42, 0);
  const camGoalPos = new THREE.Vector3(0.95, 1.85, 6.20);
  const camGoalTarget = new THREE.Vector3(0.88, 0.42, 0);
  let camCurFov = 32, camGoalFov = 32;

  function computeCameraGoal() {
    if (stageMode === 'dressup') {
      // 左側 58% 舞台居中，角色全身站於暖色圓地毯正中央（帽頂留有充裕空間）
      camGoalPos.set(0.72, 1.08, 3.80);
      camGoalTarget.set(0.72, 0.72, 0.0);
      camGoalFov = 30;
      return;
    }
    if (stageMode === 'focus') {
      const sp = ISLAND_SPOTS[selectedJob] || ISLAND_SPOTS[0];
      const cos = Math.cos(orbitYaw), sin = Math.sin(orbitYaw);
      const wx = sp.x * cos + sp.z * sin;
      const wz = -sp.x * sin + sp.z * cos;
      const worldRot = sp.rotY + orbitYaw;
      const fx = Math.sin(worldRot), fz = Math.cos(worldRot);
      // 略向右偏移目標點，讓特寫英雄穩居畫面左側黃金構圖位
      const rx = fz * 0.46, rz = -fx * 0.46;
      camGoalTarget.set(wx + rx, sp.focusY, wz + rz);
      camGoalPos.set(wx + rx + fx * sp.focusDist, sp.focusY + 0.34, wz + rz + fz * sp.focusDist);
      camGoalFov = 28;
      return;
    }
    // Overview：全島 5 英雄正面群像（居中於左側開闊天空，視野完整又清晰！）
    camGoalTarget.set(0.88, 0.42, 0.0);
    camGoalPos.set(0.95, 1.85, 6.20);
    camGoalFov = 32;
  }

  function syncHeroMeshes() {
    const h = islandHeroes[selectedJob];
    if (h) {
      h.hero.setLook(activeSlotLook, CLASSES[selectedJob]?.weapon || 'staff');
      selRing.position.set(h.x, h.y + 0.04, h.z);
    }
    dressHero.setLook(activeSlotLook, CLASSES[selectedJob]?.weapon || 'staff');
    game.character = { ...activeSlotLook };
  }

  function focusHero(jobIdx, triggerAnim = true) {
    selectedJob = clampIdx(jobIdx, CLASSES.length);
    if (activeSlotLook.job !== selectedJob) {
      activeSlotLook = normalizeCharacterLook({
        ...CHAR_CATALOG.classPresets[selectedJob],
        skinTone: activeSlotLook.skinTone,
        eyeColor: activeSlotLook.eyeColor,
        hairTint: activeSlotLook.hairTint,
        favorites: activeSlotLook.favorites || [],
      }, selectedJob);
    }
    stageMode = 'focus';
    // 旋轉小島讓焦點英雄面向鏡頭中心，鏡頭再平滑飛近（完全還原影片順滑感！）
    const sp = ISLAND_SPOTS[selectedJob];
    orbitYaw = -sp.rotY * 0.45;
    orbitVel = 0;
    syncHeroMeshes();
    if (triggerAnim) {
      const h = islandHeroes[selectedJob]?.hero;
      h?.play('buff', { once: true, force: true });
    }
    renderScrapbook();
    updateStageClasses();
  }

  function setOverview() {
    stageMode = 'overview';
    updateStageClasses();
  }

  function enterDressup() {
    stageMode = 'dressup';
    dressRotY = 0;
    dressHero.root.rotation.y = 0;
    syncHeroMeshes();
    dressHero.play('buff', { once: true, force: true });
    renderDressupUI();
    updateStageClasses();
  }

  function exitDressup() {
    if (inTownWardrobe) {
      inTownWardrobe = false;
      titleEl.classList.add('hide');
      titleEl.classList.remove('wardrobe-overlay');
      running = false;
      game.character = { ...activeSlotLook };
      game.applyCharacterLook?.();
      try {
        localStorage.setItem(key(slot), JSON.stringify({ ...activeSlotLook, name: game.playerName, hood: game.hoodIdx }));
      } catch {}
      game.ui?.toast?.('✨ 已套用全新外觀造型！', '#ffd85a');
      return;
    }
    stageMode = 'focus';
    syncHeroMeshes();
    renderScrapbook();
    updateStageClasses();
  }

  function updateStageClasses() {
    titleEl.classList.toggle('mode-dressup', stageMode === 'dressup');
    titleEl.classList.toggle('mode-focus', stageMode === 'focus');
    islandStage.visible = stageMode !== 'dressup';
    dressupStage.visible = stageMode === 'dressup';
    const ovBtn = $('btnOverview');
    if (ovBtn) ovBtn.hidden = stageMode !== 'focus';
    const pill = $('heroPillName');
    const cls = CLASSES[selectedJob] || CLASSES[0];
    const sp = ISLAND_SPOTS[selectedJob] || ISLAND_SPOTS[0];
    if (pill) pill.textContent = `${selectedJob + 1}. ${cls.icon} ${cls.name} · ${sp.en}`;
    document.querySelectorAll('.hero-pin-btn').forEach((b, i) => b.classList.toggle('on', i === selectedJob));
    computeCameraGoal();
  }

  // ---------------- 右側 Stage 1：冒險手帳（參考圖 1） ----------------
  function renderScrapbook() {
    const cls = CLASSES[selectedJob] || CLASSES[0];
    const sp = ISLAND_SPOTS[selectedJob] || ISLAND_SPOTS[0];
    const tag = $('sbClassTag');
    if (tag) tag.textContent = `${cls.icon} ${cls.name} · ${sp.en}`;
    const desc = $('sbClassDesc');
    if (desc) desc.textContent = cls.desc;

    // 三格膠帶貼紙屬性徽章（防禦 / 輸出特性 / 初始拼圖）
    const statsEl = $('sbStats');
    if (statsEl) {
      const b = cls.bonuses || {};
      const stat1 = b.armor ? `🛡️ +${b.armor}%` : b.maxHp ? `❤️ +${b.maxHp}` : b.mana ? `💧 +${b.mana}` : '🛡️ 標準';
      const stat2 = b.atkSpd ? `⚔️ +${b.atkSpd}%` : b.crit ? `🎯 +${b.crit}%` : b.addFire ? `🔥 +${b.addFire}` : b.regen ? `🪷 +${b.regen}/s` : '⚔️ 均衡';
      const stat3 = `💎 ×${(cls.starter?.length || 0) + (cls.bag?.length || 0)}`;
      statsEl.innerHTML = `
        <div class="sb-stat"><span class="sb-st-val">${stat1}</span><small>體質特色</small></div>
        <div class="sb-stat"><span class="sb-st-val">${stat2}</span><small>戰鬥專長</small></div>
        <div class="sb-stat"><span class="sb-st-val">${stat3}</span><small>初始寶石</small></div>`;
    }

    // 4×2 初始拼圖寶石網格（點擊看底部紙條說明，呼應圖 1！）
    const grid = $('sbGemGrid');
    const note = $('sbGemNote');
    if (grid) {
      const gemIds = [...(cls.starter || []).map(s => s.id), ...(cls.bag || [])].slice(0, 8);
      if (!activeGemDetail || !gemIds.includes(activeGemDetail)) activeGemDetail = gemIds[0];
      grid.innerHTML = gemIds.map(gid => {
        const gDef = ALL_GEMS[gid];
        if (!gDef) return '<div class="sb-slot empty"></div>';
        return `<button type="button" class="sb-slot ${activeGemDetail === gid ? 'on' : ''}" data-sbgem="${gid}" title="${gDef.name}">
          <span class="sb-gic" style="background:${gDef.color}">${gDef.icon}</span>
          <small>${gDef.short}</small>
        </button>`;
      }).join('');
      grid.querySelectorAll('[data-sbgem]').forEach(btn => {
        btn.onclick = () => { activeGemDetail = btn.dataset.sbgem; game.audio?.sfx?.('ui'); renderScrapbook(); };
      });
      if (note && activeGemDetail && ALL_GEMS[activeGemDetail]) {
        const gd = ALL_GEMS[activeGemDetail];
        note.innerHTML = `<b>${gd.icon} ${gd.name}</b>（${gd.type === 'active' ? '主動技能' : '輔助寶石'}）<div style="margin-top:2px">${gd.desc}</div>`;
      }
    }
  }

  // ---------------- 右側 Stage 2：暖光木屋換裝間（參考圖 2） ----------------
  const DRESS_TABS = [
    { id: 'preset', icon: '✨', name: '套裝' },
    { id: 'face',   icon: '💇', name: '臉髮' },
    { id: 'hat',    icon: '👒', name: '帽飾' },
    { id: 'body',   icon: '👕', name: '服裝' },
    { id: 'cloak',  icon: '🧣', name: '披風' },
    { id: 'boots',  icon: '🥾', name: '靴手' },
    { id: 'weapon', icon: '⚔️', name: '武器' },
  ];

  function triggerTryOnPose(kind = 'buff') {
    dressHero.play(kind, { once: true, force: true });
    // 換裝時迸發暖金小星星粒子
    for (let i = 0; i < DU_SPARK_N; i++) {
      const a = (i / DU_SPARK_N) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.25 + Math.random() * 0.35;
      duSparkPos[i * 3] = Math.cos(a) * r;
      duSparkPos[i * 3 + 1] = 0.35 + Math.random() * 0.85;
      duSparkPos[i * 3 + 2] = Math.sin(a) * r;
      duSparkVel[i * 3] = Math.cos(a) * (0.45 + Math.random() * 0.6);
      duSparkVel[i * 3 + 1] = 0.65 + Math.random() * 0.9;
      duSparkVel[i * 3 + 2] = Math.sin(a) * (0.45 + Math.random() * 0.6);
    }
    duSparkGeo.attributes.position.needsUpdate = true;
    duSparkLife = 0.85;
    game.audio?.sfx?.('ui');
  }

  function renderDressupUI() {
    const tabsEl = $('duTabs');
    const gridEl = $('duGrid');
    const swatchesEl = $('duSwatches');
    if (!tabsEl || !gridEl) return;

    tabsEl.innerHTML = DRESS_TABS.map(t =>
      `<button type="button" class="du-tab ${dressCat === t.id ? 'on' : ''}" data-ducat="${t.id}" title="${t.name}"><span>${t.icon}</span><small>${t.name}</small></button>`
    ).join('');
    tabsEl.querySelectorAll('[data-ducat]').forEach(b => {
      b.onclick = () => { dressCat = b.dataset.ducat; game.audio?.sfx?.('ui'); renderDressupUI(); };
    });

    if (swatchesEl) swatchesEl.innerHTML = '';

    const card = (id, icon, name, isOn, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'du-card' + (isOn ? ' on' : '');
      btn.innerHTML = `<span class="du-ic">${icon}</span><span class="du-lb">${name}</span>${isOn ? '<i class="du-chk">✓</i>' : ''}`;
      btn.onclick = () => { onClick(); syncHeroMeshes(); renderDressupUI(); };
      return btn;
    };

    gridEl.innerHTML = '';
    if (dressCat === 'preset') {
      CHAR_CATALOG.classPresets.forEach((pr, idx) => {
        const cls = CLASSES[idx] || CLASSES[0];
        const isOn = activeSlotLook.body === pr.body && activeSlotLook.hat === pr.hat && activeSlotLook.cloak === pr.cloak;
        gridEl.append(card(idx, cls.icon, `${cls.name}套裝`, isOn, () => {
          activeSlotLook = normalizeCharacterLook({
            ...pr, job: selectedJob,
            skinTone: activeSlotLook.skinTone, eyeColor: activeSlotLook.eyeColor,
            hairStyle: activeSlotLook.hairStyle, hairTint: activeSlotLook.hairTint,
            favorites: activeSlotLook.favorites || [],
          }, selectedJob);
          triggerTryOnPose('buff');
        }));
      });
    } else if (dressCat === 'face') {
      CHAR_CATALOG.hairStyles.forEach(h => {
        gridEl.append(card(h.id, h.icon, h.name, activeSlotLook.hairStyle === h.id, () => {
          activeSlotLook.hairStyle = h.id; triggerTryOnPose('buff');
        }));
      });
      if (swatchesEl) {
        const mkRow = (title, items, curId, keyName, colorProp) => {
          const r = document.createElement('div'); r.className = 'du-sw-row';
          r.innerHTML = `<span class="du-sw-lb">${title}</span>`;
          const box = document.createElement('div'); box.className = 'du-sw-list';
          items.forEach(it => {
            const b = document.createElement('button'); b.type = 'button';
            b.className = 'du-dot' + (curId === it.id ? ' on' : '');
            b.style.background = it[colorProp];
            b.title = it.name;
            b.onclick = () => { activeSlotLook[keyName] = it.id; syncHeroMeshes(); renderDressupUI(); game.audio?.sfx?.('ui'); };
            box.append(b);
          });
          r.append(box); swatchesEl.append(r);
        };
        mkRow('膚色', CHAR_CATALOG.skinTones, activeSlotLook.skinTone, 'skinTone', 'hex');
        mkRow('瞳色', CHAR_CATALOG.eyeColors, activeSlotLook.eyeColor, 'eyeColor', 'hex');
        mkRow('髮色', CHAR_CATALOG.hairTints, activeSlotLook.hairTint, 'hairTint', 'swatch');
      }
    } else if (dressCat === 'hat') {
      CHAR_CATALOG.hats.forEach(h => {
        gridEl.append(card(h.id, h.icon, h.name, activeSlotLook.hat === h.id, () => {
          activeSlotLook.hat = h.id; triggerTryOnPose('buff');
        }));
      });
    } else if (dressCat === 'body') {
      CHAR_CATALOG.bodies.forEach(b => {
        gridEl.append(card(b.id, b.icon, b.name, activeSlotLook.body === b.id, () => {
          activeSlotLook.body = b.id; triggerTryOnPose('buff');
        }));
      });
    } else if (dressCat === 'cloak') {
      CHAR_CATALOG.cloaks.forEach(c => {
        gridEl.append(card(c.id, c.icon, c.name, activeSlotLook.cloak === c.id, () => {
          activeSlotLook.cloak = c.id; triggerTryOnPose('buff');
        }));
      });
    } else if (dressCat === 'boots') {
      CHAR_CATALOG.boots.forEach(b => {
        gridEl.append(card(b.id, b.icon, b.name, activeSlotLook.boots === b.id, () => {
          activeSlotLook.boots = b.id; triggerTryOnPose('jump');
        }));
      });
      CHAR_CATALOG.gloves.forEach(gl => {
        gridEl.append(card('gl_' + gl.id, gl.icon, gl.name, activeSlotLook.gloves === gl.id, () => {
          activeSlotLook.gloves = gl.id; triggerTryOnPose('buff');
        }));
      });
    } else if (dressCat === 'weapon') {
      CHAR_CATALOG.weapons.forEach(w => {
        gridEl.append(card(w.id, w.icon, w.name, activeSlotLook.weaponSkin === w.id, () => {
          activeSlotLook.weaponSkin = w.id; triggerTryOnPose('attack');
        }));
      });
    }
  }

  // ---------------- 滑鼠 360° 旋轉 ＋ 3D 點擊選英雄 ----------------
  const raycaster = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.lx;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    drag.lx = e.clientX;
    if (stageMode === 'dressup') {
      dressRotY += dx * 0.012;
    } else {
      orbitYaw += dx * 0.0085;
      orbitVel = dx * 0.004;
      computeCameraGoal();
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && !drag.moved && stageMode !== 'dressup') {
      const rect = canvas.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ptr, camera);
      const hits = raycaster.intersectObjects(islandHeroes.map(h => h.hitBox), false);
      if (hits.length) {
        const job = hits[0].object.userData.heroJob;
        if (Number.isInteger(job)) { game.audio?.sfx?.('ui'); focusHero(job, true); }
      }
    }
    drag = null;
  });

  // 底部 ◀ 職業名 ▶ 切換列與編號點（完全對齊參考影片！）
  const pinsEl = $('heroPins');
  if (pinsEl) {
    pinsEl.innerHTML = CLASSES.map((c, i) => `<button type="button" class="hero-pin-btn" data-pin="${i}" title="${c.name}">${i + 1}</button>`).join('');
    pinsEl.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { game.audio?.sfx?.('ui'); focusHero(+b.dataset.pin, true); });
  }
  const prevBtn = $('btnHeroPrev'), nextBtn = $('btnHeroNext'), ovBtn = $('btnOverview');
  if (prevBtn) prevBtn.onclick = () => { game.audio?.sfx?.('ui'); focusHero((selectedJob + CLASSES.length - 1) % CLASSES.length, true); };
  if (nextBtn) nextBtn.onclick = () => { game.audio?.sfx?.('ui'); focusHero((selectedJob + 1) % CLASSES.length, true); };
  if (ovBtn) ovBtn.onclick = () => { game.audio?.sfx?.('ui'); setOverview(); };

  // 換裝間按鈕事件
  const openDu = $('btnOpenDressup'), backDu = $('btnSaveDressup'), backDuTop = $('btnDressBack');
  if (openDu) openDu.onclick = () => { game.audio?.sfx?.('ui'); enterDressup(); };
  if (backDu) backDu.onclick = () => { game.audio?.sfx?.('pickup'); exitDressup(); };
  if (backDuTop) backDuTop.onclick = () => { game.audio?.sfx?.('ui'); exitDressup(); };

  const rotL = $('btnRotL'), rotR = $('btnRotR'), rotReset = $('btnRotReset');
  if (rotL) rotL.onclick = () => { dressRotY -= Math.PI / 4; game.audio?.sfx?.('ui'); };
  if (rotR) rotR.onclick = () => { dressRotY += Math.PI / 4; game.audio?.sfx?.('ui'); };
  if (rotReset) rotReset.onclick = () => { dressRotY = 0; game.audio?.sfx?.('ui'); };

  const rndBtn = $('randomLook');
  if (rndBtn) rndBtn.onclick = () => {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    activeSlotLook = {
      ...activeSlotLook,
      skinTone: pick(CHAR_CATALOG.skinTones).id,
      eyeColor: pick(CHAR_CATALOG.eyeColors).id,
      hairStyle: pick(CHAR_CATALOG.hairStyles).id,
      hairTint: pick(CHAR_CATALOG.hairTints).id,
      hat: pick(CHAR_CATALOG.hats).id,
      body: pick(CHAR_CATALOG.bodies).id,
      cloak: pick(CHAR_CATALOG.cloaks).id,
      boots: pick(CHAR_CATALOG.boots).id,
      gloves: pick(CHAR_CATALOG.gloves).id,
      weaponSkin: pick(CHAR_CATALOG.weapons).id,
    };
    syncHeroMeshes();
    triggerTryOnPose('buff');
    renderDressupUI();
  };

  const favBtn = $('btnFavOutfit');
  if (favBtn) favBtn.onclick = () => {
    activeSlotLook.favorites = Array.isArray(activeSlotLook.favorites) ? activeSlotLook.favorites : [];
    const snap = { hat: activeSlotLook.hat, body: activeSlotLook.body, cloak: activeSlotLook.cloak, boots: activeSlotLook.boots, gloves: activeSlotLook.gloves, weaponSkin: activeSlotLook.weaponSkin, hairStyle: activeSlotLook.hairStyle, hairTint: activeSlotLook.hairTint };
    if (activeSlotLook.favorites.length >= 3) activeSlotLook.favorites.shift();
    activeSlotLook.favorites.push(snap);
    game.audio?.sfx?.('pickup');
    game.ui?.toast?.(`⭐ 已將目前混搭儲存至「最愛套裝 #${activeSlotLook.favorites.length}」！`, '#ffd85a');
  };

  // 存檔欄位讀取
  function selectSlot() {
    slot = slotsSel ? +slotsSel.value : 0;
    const saved = read(key(slot)) || {};
    if ($('inName')) $('inName').value = saved.name || '';
    game.hoodIdx = clampIdx(saved.hood, HOODS.length);
    selectedJob = clampIdx(saved.job, CLASSES.length);
    activeSlotLook = normalizeCharacterLook(saved, selectedJob);
    syncHeroMeshes();
    renderScrapbook();
    stageMode = 'overview';
    updateStageClasses();
  }
  if (slotsSel) slotsSel.onchange = selectSlot;
  selectSlot();
  // 支援 ?preview=focus|dressup|town|field&job=0..4 快速預覽指定舞台或進遊戲實景
  try {
    const qs = new URLSearchParams(location.search);
    const pv = qs.get('preview');
    const qJob = qs.has('job') ? clampIdx(+qs.get('job'), CLASSES.length) : null;
    if (pv === 'focus') {
      focusHero(qJob ?? 1, false);
      camCurPos.copy(camGoalPos); camCurTarget.copy(camGoalTarget); camCurFov = camGoalFov;
    } else if (pv === 'dressup') {
      focusHero(qJob ?? 2, false); enterDressup();
      camCurPos.copy(camGoalPos); camCurTarget.copy(camGoalTarget); camCurFov = camGoalFov;
    } else if (pv === 'town' || pv === 'field') {
      const targetJob = qJob ?? (pv === 'town' ? 4 : 0);
      selectedJob = targetJob;
      activeSlotLook = normalizeCharacterLook(CHAR_CATALOG.classPresets[targetJob], targetJob);
      game.character = { ...activeSlotLook, job: targetJob };
      running = false;
      titleEl.classList.add('hide');
      $('hud')?.classList.remove('hide');
      setTimeout(() => {
        game.dayTime = 0.36;
        if (pv === 'town') game.enterTown?.();
        else { game.enterTown?.(); game.enterField?.(1); }
        game.fade = 0;
        if (game.camZoom) game.camZoom = 0.85;
      }, 60);
    }
  } catch {}

  // 允許遊戲中城鎮「造型工坊」無縫重開同一套 3D 木屋換裝間！
  game.ui.openWardrobe3D = () => {
    inTownWardrobe = true;
    selectedJob = clampIdx(game.character?.job, CLASSES.length);
    activeSlotLook = normalizeCharacterLook(game.character, selectedJob);
    titleEl.classList.remove('hide');
    titleEl.classList.add('wardrobe-overlay');
    running = true;
    enterDressup();
    lastT = performance.now();
    requestAnimationFrame(loop);
  };

  // 動畫與平滑運鏡迴圈
  let lastT = performance.now();
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width)), h = Math.max(240, Math.round(rect.height));
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    resize();

    if (stageMode === 'overview' && !drag) {
      // 輕柔微幅正面擺動（始終展示英雄可愛正面，玩家拖曳仍可自由 360° 旋轉）
      orbitYaw += orbitVel * dt;
      orbitVel *= Math.exp(-dt * 4);
      islandStage.rotation.y = orbitYaw + Math.sin(now * 0.00055) * 0.16;
      computeCameraGoal();
    } else if (stageMode === 'focus' && !drag) {
      orbitYaw += orbitVel * dt;
      orbitVel *= Math.exp(-dt * 6);
      islandStage.rotation.y = orbitYaw;
      computeCameraGoal();
    } else {
      islandStage.rotation.y = orbitYaw;
    }
    islandGeo.position.y = Math.sin(now * 0.0014) * 0.03;
    sparks.rotation.y += dt * 0.16;
    selRing.scale.setScalar(1 + Math.sin(now * 0.005) * 0.06);

    if (stageMode === 'dressup') {
      dressHero.root.rotation.y += (dressRotY - dressHero.root.rotation.y) * Math.min(1, dt * 10);
      dressHero.update(dt);
      if (duSparkLife > 0) {
        duSparkLife = Math.max(0, duSparkLife - dt);
        for (let i = 0; i < DU_SPARK_N; i++) {
          duSparkPos[i * 3] += duSparkVel[i * 3] * dt;
          duSparkPos[i * 3 + 1] += duSparkVel[i * 3 + 1] * dt;
          duSparkPos[i * 3 + 2] += duSparkVel[i * 3 + 2] * dt;
          duSparkVel[i * 3 + 1] -= 0.7 * dt;
        }
        duSparkGeo.attributes.position.needsUpdate = true;
        duSparkMat.opacity = Math.min(1, duSparkLife * 1.4);
      } else if (duSparkMat.opacity > 0) {
        duSparkMat.opacity = 0;
      }
    } else {
      for (const h of islandHeroes) h.hero.update(dt);
    }

    // 絲滑運鏡插值（0.65s 電影飛近聚焦感）
    const k = 1 - Math.exp(-dt * 6.5);
    camCurPos.lerp(camGoalPos, k);
    camCurTarget.lerp(camGoalTarget, k);
    camCurFov += (camGoalFov - camCurFov) * k;
    camera.position.copy(camCurPos);
    camera.lookAt(camCurTarget);
    if (Math.abs(camera.fov - camCurFov) > 0.02) {
      camera.fov = camCurFov;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  return () => {
    running = false;
    game.slot = slot;
    game.meta = new Meta(slot);
    game.character = { ...activeSlotLook, job: selectedJob };
    const cls = CLASSES[selectedJob] || CLASSES[0];
    const isNew = !game.meta.p.puzzle;
    ensurePuzzle(game.meta.p, cls.id);
    if (isNew) { game.meta.p.weapon = cls.weapon; game.meta.save(); }
    try {
      localStorage.setItem(key(slot), JSON.stringify({ ...game.character, name: game.playerName, hood: game.hoodIdx }));
      localStorage.setItem('lv_active_slot', JSON.stringify(slot));
    } catch { /* ignore */ }
  };
}
