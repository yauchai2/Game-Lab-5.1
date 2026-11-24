// Phase C3–C4：雙舞台 3D 角色劇院（影片級浮空英雄小島平滑聚焦 + 圖 1 冒險手帳 + 圖 2 暖光木屋換裝間）
import * as THREE from 'three';
import { Meta } from './meta.js';
import { CLASSES, ALL_GEMS, ensurePuzzle } from './puzzle.js';
import { CHAR_CATALOG, JOB_ARCHETYPES, normalizeCharacterLook, createModularHero, preloadAllCharacterAnims } from './char_rig.js';
import { VfxEngine } from './vfx_engine.js';

export const HOODS = [[0x2f8a7e,0x23695f],[0xd9543a,0xa83f2c],[0x6a6ad0,0x4a4aa0],[0xe0a030,0xb07f20],[0xc060b0,0x904488],[0x58a858,0x3f823f],[0x4aa0d8,0x3478a8],[0x8a6a50,0x65503c]];

const $ = id => document.getElementById(id);
const key = slot => slot === 0 ? 'lv_prof' : 'lv_prof_' + slot;
function read(id) { try { return JSON.parse(localStorage.getItem(id)); } catch { return null; } }
function clampIdx(value, count) { return Number.isInteger(value) && value >= 0 && value < count ? value : 0; }

// Phase D2：光滑有機起伏草地微丘高度場（1:1 還原參考影片中央柔坡＋四周緩降草盤）
function meadowHeight(x, z) {
  const r2 = x * x + z * z;
  const rimFall = Math.max(0, 1 - r2 / (2.22 * 2.22));
  // 後方柔和寬闊草丘（供法師與武僧自然居高並立、零遮擋）
  const hill = 0.52 * Math.exp(-((x - 0.08) ** 2 + (z + 0.78) ** 2) / 1.38);
  const bumpL = 0.10 * Math.exp(-((x + 1.25) ** 2 + (z - 0.15) ** 2) / 0.72);
  return 0.04 + (hill + bumpL) * Math.min(1, rimFall * 1.9);
}

// 5 位英雄群像站位（完全不互擋＋各自外向焦點運鏡通道 camAng＋招牌展示 Pose！）
const ISLAND_SPOTS = [
  { job: 0, x: -0.10, y: meadowHeight(-0.10,  0.96), z:  0.96, rotY:  0.10, camAng: -0.05, focusDist: 2.38, focusY: 0.64, en: 'Fighter',     pose: { state: 'combatIdle', t: 0.16, amp: 0.035 } },
  { job: 1, x: -1.38, y: meadowHeight(-1.38,  0.22), z:  0.22, rotY:  0.42, camAng: -0.42, focusDist: 2.42, focusY: 0.66, en: 'Archer',      pose: { state: 'attack',     t: 0.42, amp: 0.022 } },
  { job: 2, x: -0.44, y: meadowHeight(-0.44, -0.82), z: -0.82, rotY:  0.08, camAng: -0.28, focusDist: 2.48, focusY: 1.06, en: 'Mage',        pose: { state: 'combatIdle', t: 0.25, amp: 0.032 } },
  { job: 3, x:  1.32, y: meadowHeight( 1.32,  0.34), z:  0.34, rotY: -0.40, camAng:  0.40, focusDist: 2.42, focusY: 0.64, en: 'Necromancer', pose: { state: 'cast',       t: 0.35, amp: 0.032 } },
  { job: 4, x:  0.68, y: meadowHeight( 0.68, -0.84), z: -0.84, rotY: -0.18, camAng: -0.02, focusDist: 2.48, focusY: 1.04, en: 'Monk',        pose: { state: 'combatIdle', t: 0.20, amp: 0.032 } },
];

function makeMeadowTexture() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  // 鮮嫩手繪草皮漸層（中央暖黃綠 → 外圍柔和翠綠）
  const rg = ctx.createRadialGradient(252, 215, 24, 256, 256, 252);
  rg.addColorStop(0.0, '#b2ea4a');
  rg.addColorStop(0.55, '#89d638');
  rg.addColorStop(0.88, '#68b92e');
  rg.addColorStop(1.0, '#559e26');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, 512, 512);

  // 柔和草地筆觸色斑（增添手繪溫潤感）
  for (let i = 0; i < 180; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = Math.sqrt(i / 180) * 235;
    ctx.fillStyle = i % 2 ? 'rgba(186,242,96,0.22)' : 'rgba(84,162,42,0.18)';
    ctx.beginPath();
    ctx.ellipse(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 10 + (i % 9), 5 + (i % 5), a, 0, Math.PI * 2);
    ctx.fill();
  }

  // 參考影片同款：向右前方蜿蜒的暖米色泥土小徑
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(232, 370);
  ctx.bezierCurveTo(285, 345, 315, 305, 355, 275);
  ctx.bezierCurveTo(395, 245, 418, 290, 400, 352);
  ctx.lineWidth = 64;
  ctx.strokeStyle = 'rgba(166,184,96,0.55)';
  ctx.stroke();
  ctx.lineWidth = 42;
  ctx.strokeStyle = '#d7c69c';
  ctx.stroke();
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#e2d4b0';
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildSculptedMeadowDiorama() {
  const grp = new THREE.Group();
  const R = 2.18, rings = 18, segs = 48;
  const pos = [], uvs = [], idx = [];

  // 中心點
  pos.push(0, meadowHeight(0, 0), 0);
  uvs.push(0.5, 0.5);
  for (let ri = 1; ri <= rings; ri++) {
    const t = ri / rings;
    const rad = t * R;
    const edgeDrop = ri === rings ? -0.14 : (ri === rings - 1 ? -0.04 : 0);
    for (let si = 0; si < segs; si++) {
      const a = (si / segs) * Math.PI * 2;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const y = ri === rings ? edgeDrop : Math.max(-0.04, meadowHeight(x, z) + edgeDrop);
      pos.push(x, y, z);
      uvs.push(0.5 + x / (R * 2), 0.5 + z / (R * 2));
    }
  }
  for (let si = 0; si < segs; si++) {
    const nxt = (si + 1) % segs;
    idx.push(0, 1 + nxt, 1 + si);
  }
  for (let ri = 1; ri < rings; ri++) {
    const row0 = 1 + (ri - 1) * segs;
    const row1 = 1 + ri * segs;
    for (let si = 0; si < segs; si++) {
      const nxt = (si + 1) % segs;
      idx.push(row0 + si, row0 + nxt, row1 + nxt);
      idx.push(row0 + si, row1 + nxt, row1 + si);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const meadowMat = new THREE.MeshStandardMaterial({
    map: makeMeadowTexture(),
    roughness: 0.94,
    metalness: 0.0,
  });
  const mound = new THREE.Mesh(geo, meadowMat);
  mound.receiveShadow = true;
  grp.add(mound);

  // 清透淺水藍底環（緊貼草盤外緣，還原影片淺水邊框！）
  const waterDisc = new THREE.Mesh(
    new THREE.RingGeometry(R * 0.92, R * 1.07, 56),
    new THREE.MeshBasicMaterial({ color: 0x5cd8ea, transparent: true, opacity: 0.62, side: THREE.DoubleSide })
  );
  waterDisc.rotation.x = -Math.PI / 2;
  waterDisc.position.y = -0.11;
  grp.add(waterDisc);

  // 貼邊圓潤低矮苔石（自然嵌入坡腳與外緣）
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa0987e, roughness: 0.95 });
  const stoneSpots = [
    [-1.42, 0.78, 0.34, 1.35, 0.42, 0.85, 0.4],
    [-1.12, 1.15, 0.28, 1.45, 0.38, 0.78, 0.6],
    [-0.58, 1.56, 0.30, 1.55, 0.36, 0.72, 0.15],
    [ 0.12, 1.62, 0.26, 1.40, 0.34, 0.70, -0.1],
    [-0.68, 0.18, 0.24, 1.15, 0.55, 0.92, 0.3],
    [ 1.38, -0.15, 0.30, 1.25, 0.44, 0.85, -0.4],
  ];
  for (const [sx, sz, sr, scx, scy, scz, ry] of stoneSpots) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(sr, 10, 7), stoneMat);
    b.position.set(sx, meadowHeight(sx, sz) + sr * scy * 0.35, sz);
    b.scale.set(scx, scy, scz);
    b.rotation.y = ry;
    b.castShadow = true; b.receiveShadow = true;
    grp.add(b);
  }

  // 纖細五瓣小黃花叢（成簇點綴於英雄腳邊與石旁，告別粗大蘑菇感！）
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4ca232, roughness: 0.9 });
  const petalY = new THREE.MeshBasicMaterial({ color: 0xffe44d });
  const petalC = new THREE.MeshBasicMaterial({ color: 0xf49d28 });
  const clusters = [
    [-1.48, 0.42], [-1.32, 0.54], [-1.62, -0.25], [-0.45, 1.22],
    [ 0.58, 1.16], [ 0.78, 1.06], [ 1.12,  0.88], [ 1.45,  0.32],
    [ 1.38, -0.82], [-0.88, -1.18], [-0.15, 0.12],
  ];
  for (const [cx, cz] of clusters) {
    const cnt = 2 + (Math.abs(Math.round(cx * 10)) % 2);
    for (let i = 0; i < cnt; i++) {
      const fx = cx + (i - 0.5) * 0.16, fz = cz + ((i % 2) ? 0.1 : -0.08);
      const fy = meadowHeight(fx, fz);
      const fl = new THREE.Group();
      fl.position.set(fx, fy, fz);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.14, 4), stemMat);
      st.position.y = 0.07; fl.add(st);
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 4), petalC);
      center.position.y = 0.145; fl.add(center);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const pt = new THREE.Mesh(new THREE.SphereGeometry(0.026, 5, 4), petalY);
        pt.position.set(Math.cos(pa) * 0.038, 0.142, Math.sin(pa) * 0.038);
        pt.scale.set(1.1, 0.45, 1.1);
        fl.add(pt);
      }
      grp.add(fl);
    }
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

  // 舞台 1：有機起伏手繪草地群像小島 + Piloto 3D 技能預演引擎
  const islandStage = new THREE.Group();
  const islandGeo = buildSculptedMeadowDiorama();
  islandStage.add(islandGeo);
  scene.add(islandStage);
  const theaterVfx = new VfxEngine(islandStage);

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

  // 5 位英雄實機 3D 角色（各自呈現招牌展示 Pose：弓手拉弓搭箭、戰士橫斧、法師舉杖、影刃亮刃、武僧執聖杖）
  const islandHeroes = ISLAND_SPOTS.map(sp => {
    const presetLook = normalizeCharacterLook(CHAR_CATALOG.classPresets[sp.job], sp.job);
    const hero = createModularHero(presetLook, { scale: 0.72, initialState: 'combatIdle', showcasePose: sp.pose });
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

  // 平滑電影運鏡（Camera Dolly & Orbit）— 總覽正中留白呈現草地群像，聚焦絲滑推近臉部特寫！
  let orbitYaw = 0.0, orbitVel = 0, dressRotY = 0;
  const camCurPos = new THREE.Vector3(0.0, 2.35, 5.25);
  const camCurTarget = new THREE.Vector3(0.0, 0.52, 0);
  const camGoalPos = new THREE.Vector3(0.0, 2.35, 5.25);
  const camGoalTarget = new THREE.Vector3(0.0, 0.52, 0);
  let camCurFov = 30, camGoalFov = 30;

  function computeCameraGoal() {
    if (stageMode === 'dressup') {
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
      // 沿各英雄專屬無遮擋外向通道 camAng 推近，徹底杜絕鄰近英雄擋鏡！
      const worldCamAng = (sp.camAng ?? sp.rotY) + orbitYaw;
      const fx = Math.sin(worldCamAng), fz = Math.cos(worldCamAng);
      // 略微右偏讓英雄特寫居於黃金左中位置，右側留給輕量英雄卡
      const rx = fz * 0.28, rz = -fx * 0.28;
      camGoalTarget.set(wx + rx, sp.focusY, wz + rz);
      camGoalPos.set(wx + rx + fx * sp.focusDist, sp.focusY + 0.28, wz + rz + fz * sp.focusDist);
      camGoalFov = 28;
      return;
    }
    // Overview：純淨居中群像（完全對齊參考影片！）
    camGoalTarget.set(0.0, 0.52, 0.0);
    camGoalPos.set(0.0, 2.35, 5.25);
    camGoalFov = 30;
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
    orbitYaw = -(sp.camAng ?? sp.rotY) * 0.35;
    orbitVel = 0;
    syncHeroMeshes();
    if (triggerAnim) {
      const h = islandHeroes[selectedJob]?.hero;
      h?.play('buff', { once: true, force: true });
      // Phase V5：選角聚焦時於英雄腳下綻放專屬 Piloto 3D 法陣與招牌迷你特效！
      const th = CLASSES[selectedJob]?.auraTheme || 'holy';
      theaterVfx.spawnDecal(selectedJob === 4 || selectedJob === 0 ? 'holy_ring' : 'magic_circle', sp.x, sp.y, sp.z, { theme: th, scaleStart: 0.8, scaleEnd: 1.75, dur: 1.2, spinY: 1.8 });
      if (selectedJob === 4) theaterVfx.spawnSummon('lotus_burst', sp.x, sp.y, sp.z, 0, 1, { theme: 'lotus' });
      else if (selectedJob === 2) theaterVfx.spawnMesh('tornado', { x: sp.x, y: sp.y + 0.55, z: sp.z, theme: 'bluefire', scaleStart: 0.4, scaleEnd: 0.65, dur: 1.1, spinY: 5 });
      else if (selectedJob === 1) theaterVfx.spawnMesh('ring_wind', { x: sp.x, y: sp.y + 0.45, z: sp.z, theme: 'wind', scaleStart: 0.55, scaleEnd: 0.9, dur: 1.0, spinY: 6 });
      else if (selectedJob === 3) theaterVfx.spawnDecal('mana_runes', sp.x, sp.y, sp.z, { theme: 'death', scaleStart: 0.6, scaleEnd: 1.9, dur: 1.1 });
      else theaterVfx.spawnSlash(sp.x, sp.y, sp.z, sp.rotY, { theme: 'holy', scale: 0.95 });
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
    document.querySelectorAll('.hero-pin-btn,.hero-pin-3d').forEach((b, i) => b.classList.toggle('on', i === selectedJob));
    selRing.visible = stageMode === 'focus';
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
      } else if (stageMode === 'focus') {
        setOverview();
      }
    }
    drag = null;
  });

  // 真 3D 腳邊投影編號點（1–5 隨小島 360° 旋轉跟動，完全還原參考影片！）
  const pins3dEl = $('heroPins3d');
  const pin3dBtns = [];
  if (pins3dEl) {
    pins3dEl.innerHTML = CLASSES.map((c, i) => `<button type="button" class="hero-pin-3d" data-pin="${i}" data-tip="${c.name} · ${ISLAND_SPOTS[i]?.en || ''}">${i + 1}</button>`).join('');
    pins3dEl.querySelectorAll('[data-pin]').forEach(b => {
      b.onclick = () => { game.audio?.sfx?.('ui'); focusHero(+b.dataset.pin, true); };
      pin3dBtns.push(b);
    });
  }
  const _pinProj = new THREE.Vector3();
  const _pinWorld = new THREE.Vector3();
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
    } else if (pv === 'town' || pv === 'field' || pv === 'inv' || pv === 'puzzle' || pv === 'map' || pv === 'vfx_demo') {
      const targetJob = qJob ?? (pv === 'town' ? 4 : 0);
      selectedJob = targetJob;
      activeSlotLook = normalizeCharacterLook(CHAR_CATALOG.classPresets[targetJob], targetJob);
      game.character = { ...activeSlotLook, job: targetJob };
      running = false;
      titleEl.classList.add('hide');
      $('hud')?.classList.remove('hide');
      setTimeout(() => {
        game.dayTime = 0.36;
        if (pv === 'field' || pv === 'vfx_demo') { game.enterTown?.(); game.enterField?.(1); }
        else game.enterTown?.();
        game.fade = 0;
        if (game.camZoom) game.camZoom = 0.85;
        if (pv === 'inv') setTimeout(() => game.ui?.toggleInv?.(game), 140);
        else if (pv === 'puzzle') setTimeout(() => game.ui?.openPuzzle?.(game), 140);
        else if (pv === 'map') setTimeout(() => game.ui?.openMap?.(), 140);
        else if (pv === 'vfx_demo') {
          // 實機截圖展示各職業 3D 大絕＋招牌召喚技！
          setTimeout(() => {
            if (game.tide) { game.tide.ultCharge = 100; game.tide.ultIndex = targetJob; }
            const p = game.player;
            if (p) {
              p.classRes = Math.round((CLASSES[targetJob]?.classMech?.max || 100) * 0.7);
              const summons = ['dragon_head', 'thunder_phoenix', 'fire_whale', 'wolf_head', 'healing_tree'];
              const themes = ['fire', 'thunder', 'fire', 'death', 'lotus'];
              game.vfx?.spawnSummon(summons[targetJob] || 'fire_whale', p.pos.x + 2.2, p.y, p.pos.z + 1.4, 0.85, 0.52, { theme: themes[targetJob], dur: 4.5 });
              game.vfx?.spawnDecal('holy_ring', p.pos.x, p.y, p.pos.z, { theme: CLASSES[targetJob]?.auraTheme || 'holy', scaleStart: 3.4, scaleEnd: 3.8, dur: 4.0 });
            }
          }, 900);
        }
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
      theaterVfx.update(dt, camera);
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
    // 更新 5 顆真 3D 腳邊投影編號點座標
    if (pin3dBtns.length) {
      const showPins = stageMode === 'overview';
      const rw = canvas.clientWidth || window.innerWidth, rh = canvas.clientHeight || window.innerHeight;
      for (let i = 0; i < pin3dBtns.length; i++) {
        const btn = pin3dBtns[i], sp = ISLAND_SPOTS[i];
        if (!showPins || !sp) { btn.style.display = 'none'; continue; }
        _pinWorld.set(sp.x, sp.y + 0.08, sp.z).applyMatrix4(islandStage.matrixWorld);
        _pinProj.copy(_pinWorld).project(camera);
        const sx = (_pinProj.x * 0.5 + 0.5) * rw;
        const sy = (-_pinProj.y * 0.5 + 0.5) * rh;
        btn.style.display = 'flex';
        btn.style.left = `${sx.toFixed(1)}px`;
        btn.style.top = `${sy.toFixed(1)}px`;
        btn.style.zIndex = String(Math.round((1 - _pinProj.z) * 100));
      }
    }
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
