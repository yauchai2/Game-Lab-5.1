// Phase C3–D5：雙舞台 3D 角色劇院（Low Poly 沉船秘島實景選角舞台 + 圖 1 冒險手帳 + 圖 2 暖光木屋換裝間）
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Meta } from './meta.js';
import { getActiveAccount, listAccounts, loginAccount, registerAccount, logoutAccount, deleteCharacterSlot, slotKeys, slotHasData, getAccountSummary, exportAccountData, importAccountData } from './account.js';
import { CLASSES, ALL_GEMS, defaultPuzzle, ensurePuzzle } from './puzzle.js';
import { CHAR_CATALOG, JOB_ARCHETYPES, normalizeCharacterLook, createModularHero, preloadAllCharacterAnims } from './char_rig.js';
import { openTextDialog } from './ui_layers.js';
import { VfxEngine } from './vfx_engine.js';

export const HOODS = [[0x2f8a7e,0x23695f],[0xd9543a,0xa83f2c],[0x6a6ad0,0x4a4aa0],[0xe0a030,0xb07f20],[0xc060b0,0x904488],[0x58a858,0x3f823f],[0x4aa0d8,0x3478a8],[0x8a6a50,0x65503c]];

const $ = id => document.getElementById(id);
const key = slot => slotKeys(slot).charKey;
function read(id) { try { return JSON.parse(localStorage.getItem(id)); } catch { return null; } }
function clampIdx(value, count) { return Number.isInteger(value) && value >= 0 && value < count ? value : 0; }

// Phase D5：5 位英雄於《Location mountain ship》沉船海島沙灘與草坡的站位（載入 GLB 後自動 Raycast 貼地！）
// 衛士／法師／武僧自然循環播放 CombatIdle（生動呼吸＋雙手握緊武器不硬直）；弓手維持拉弓搭箭、影刃持骨刃微呼吸
const ISLAND_SPOTS = [
  { job: 0, x:  0.02, y: 0.24, z:  2.15, rotY:  0.12, camAng:  0.04, focusDist: 3.95, focusY: 0.84, en: 'Fighter',     pose: null },
  { job: 1, x: -1.18, y: 0.24, z:  2.08, rotY:  0.34, camAng: -0.26, focusDist: 3.95, focusY: 0.84, en: 'Archer',      pose: { state: 'attack', t: 0.42, amp: 0.006 } },
  { job: 2, x:  0.62, y: 0.72, z:  0.88, rotY:  0.04, camAng:  0.06, focusDist: 4.10, focusY: 1.32, en: 'Mage',        pose: null },
  { job: 3, x:  1.45, y: 0.24, z:  1.62, rotY: -0.32, camAng:  0.30, focusDist: 3.95, focusY: 0.84, en: 'Necromancer', pose: { state: 'cast',   t: 0.35, amp: 0.008 } },
  { job: 4, x: -0.82, y: 0.62, z:  0.82, rotY:  0.18, camAng: -0.18, focusDist: 4.10, focusY: 1.22, en: 'Monk',        pose: null },
];

// 手繪卡通動態海水 Shader（參考 Zelda Wind Waker / A Short Hike：明亮蔚藍海面＋有機流動浪花輪廓＋岸邊白沫＋點擊漣漪）
function createCreatorOceanMaterial() {
  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uRipple: { value: new THREE.Vector4(0, 0, -99, 0) }, // x, z, startTime, strength
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float dist = length(wp.xz);
        float shoreDamp = smoothstep(2.2, 6.2, dist);
        float w1 = sin(wp.x * 0.55 + uTime * 1.45) * cos(wp.z * 0.48 + uTime * 1.15);
        float w2 = sin((wp.x * 0.35 - wp.z * 0.42) + uTime * 1.85);
        float wave = (w1 * 0.085 + w2 * 0.05) * (0.28 + 0.72 * shoreDamp);
        wp.y += wave;
        vWorldPos = wp.xyz;
        vWave = wave;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec4 uRipple;
      varying vec3 vWorldPos;
      varying float vWave;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.58 * vnoise(p);
        v += 0.28 * vnoise(p * 2.05 + vec2(4.1, 1.7));
        v += 0.14 * vnoise(p * 4.10 - vec2(2.3, 5.2));
        return v;
      }

      void main() {
        vec2 uv = vWorldPos.xz;
        float dist = length(uv);

        // 雙層有機扭曲海流場（重現手繪卡通海浪輪廓線！）
        vec2 drift1 = uv * 0.24 + vec2(uTime * 0.09, uTime * 0.055);
        vec2 warp = vec2(fbm(drift1 + vec2(1.7, 9.2)), fbm(drift1 + vec2(8.3, 2.8)));
        float field = fbm(uv * 0.28 + warp * 1.35 - vec2(uTime * 0.06, -uTime * 0.045));

        // 基礎色帶：近岸碧綠淺海 → 明亮蔚藍 → 遠海柔和天際漸層
        vec3 shallowCol = vec3(0.24, 0.72, 0.92);
        vec3 midCol     = vec3(0.14, 0.56, 0.85);
        vec3 deepCol    = vec3(0.11, 0.48, 0.78);
        vec3 horizonCol = vec3(0.68, 0.88, 0.96);

        vec3 col = mix(shallowCol, midCol, smoothstep(3.0, 8.5, dist));
        col = mix(col, deepCol, smoothstep(10.0, 26.0, dist));

        // 柔和深藍水波區塊層次
        float patchMask = smoothstep(0.54, 0.58, field);
        col = mix(col, col * 0.90, patchMask * 0.55);

        // 卡通手繪淺藍／純白浪花輪廓線（雙等高線條帶）
        float band1 = 1.0 - smoothstep(0.018, 0.036, abs(field - 0.52));
        float band2 = 1.0 - smoothstep(0.010, 0.022, abs(field - 0.66));
        float rim1  = 1.0 - smoothstep(0.005, 0.014, abs(field - 0.52));
        vec3 foamCyan  = vec3(0.56, 0.86, 0.98);
        vec3 foamWhite = vec3(0.86, 0.97, 1.00);
        col = mix(col, foamCyan, clamp(band1 * 0.85 + band2 * 0.65, 0.0, 1.0));
        col = mix(col, foamWhite, rim1 * 0.75);

        // 岸邊呼吸白浪圈（貼合沉船小島與周邊礁岩）
        float shoreWave = sin(dist * 3.6 - uTime * 2.3 + warp.x * 2.2);
        float shoreMask = (1.0 - smoothstep(3.2, 6.4, dist)) * smoothstep(2.1, 3.3, dist);
        float shoreFoam = smoothstep(0.52, 0.78, shoreWave) * shoreMask;
        col = mix(col, foamWhite, shoreFoam * 0.85);

        // 零星海面日照小亮點
        float glint = step(0.986, hash21(floor(uv * 2.2 + vec2(floor(uTime * 1.5) * 0.13, 0.0))));
        col = mix(col, vec3(1.0), glint * 0.55 * (1.0 - smoothstep(14.0, 32.0, dist)));

        // 點擊海面擴散卡通水波漣漪
        float ripAge = uTime - uRipple.z;
        if (ripAge >= 0.0 && ripAge < 1.8 && uRipple.w > 0.01) {
          float rDist = length(uv - uRipple.xy);
          float rRad = ripAge * 3.2;
          float rRing = 1.0 - smoothstep(0.08, 0.24, abs(rDist - rRad));
          float rRing2 = 1.0 - smoothstep(0.06, 0.18, abs(rDist - max(0.0, rRad - 0.55)));
          float fade = (1.0 - ripAge / 1.8) * uRipple.w;
          col = mix(col, vec3(0.95, 0.99, 1.0), clamp((rRing + rRing2 * 0.65) * fade, 0.0, 1.0));
        }

        // 遠景天際線柔焦融合（消除平面方形邊界）
        float fog = smoothstep(24.0, 68.0, dist);
        col = mix(col, horizonCol, fog);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// 載入 Low Poly Locations Ultimate Pack 的《Location mountain ship》實景 GLB＋動態卡通海洋＋可互動島嶼物件
function buildMountainShipStage(onReady) {
  const grp = new THREE.Group();

  // 會動的卡通海洋（細分網格支撐海浪起伏＋有機浪花輪廓＋點擊漣漪）
  const seaMat = createCreatorOceanMaterial();
  const seaPlane = new THREE.Mesh(new THREE.PlaneGeometry(180, 180, 92, 92), seaMat);
  seaPlane.rotation.x = -Math.PI / 2;
  seaPlane.position.y = 0.015;
  seaPlane.userData.interactKind = 'ocean';
  grp.add(seaPlane);

  // 島嶼動態物件註冊表（持續微風動畫＋點擊彈性互動！）
  const animItems = [];
  const interactMeshes = [seaPlane];

  // 山頂瞭望塔暖金星燈（呼吸搖擺＋點擊爆亮信號光柱）
  const towerLanternGrp = new THREE.Group();
  const lanternCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe478 }),
  );
  const lanternHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  const lanternLight = new THREE.PointLight(0xffcf6a, 1.8, 7.5, 1.4);
  towerLanternGrp.add(lanternCore, lanternHalo, lanternLight);
  towerLanternGrp.position.set(0.75, 4.35, -1.65);
  towerLanternGrp.visible = false; // GLB 載入後對齊瞭望塔頂位置再顯示
  grp.add(towerLanternGrp);

  // 3 隻高空盤旋 Low Poly 海鷗（雙翅拍動＋點擊加速翻滾灑羽毛）
  const gulls = [];
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.8 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf08c30, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const gRoot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 5), gullMat);
    body.rotation.x = Math.PI / 2;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), beakMat);
    beak.rotation.x = Math.PI / 2; beak.position.z = 0.2;
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.12), gullMat);
    wingL.position.set(-0.16, 0.02, 0);
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.12), gullMat);
    wingR.position.set(0.16, 0.02, 0);
    const hitG = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hitG.userData.interactKind = 'gull';
    hitG.userData.gullIdx = i;
    gRoot.add(body, beak, wingL, wingR, hitG);
    grp.add(gRoot);
    interactMeshes.push(hitG);
    gulls.push({
      root: gRoot, wingL, wingR,
      radius: 3.1 + i * 0.95,
      height: 4.1 + i * 0.65,
      speed: 0.42 + i * 0.11,
      ang: (i / 3) * Math.PI * 2,
      flapPh: i * 2.1,
      boostT: 0,
    });
  }

  // 4 朵低面蓬鬆漂浮白雲（營造 A Short Hike / 風之律動明信片層次感！）
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfffcf4, roughness: 0.95, metalness: 0.0 });
  const cloudSpecs = [
    { x: -6.2, y: 5.6, z: -7.5, s: 1.05, spd: 0.24 },
    { x:  4.8, y: 6.3, z: -9.0, s: 1.25, spd: 0.18 },
    { x: -1.5, y: 6.8, z: -10.5, s: 0.95, spd: 0.21 },
    { x:  7.8, y: 5.2, z: -6.5, s: 0.85, spd: 0.26 },
  ];
  for (const cs of cloudSpecs) {
    const cg = new THREE.Group();
    const puffs = [
      [0, 0, 0, 0.72], [-0.62, -0.08, 0.08, 0.52], [0.64, -0.06, -0.05, 0.55], [0.18, 0.26, 0.04, 0.48],
    ];
    for (const [px, py, pz, r] of puffs) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
      m.position.set(px, py, pz);
      cg.add(m);
    }
    cg.scale.setScalar(cs.s);
    cg.position.set(cs.x, cs.y, cs.z);
    grp.add(cg);
    clouds.push({ group: cg, baseY: cs.y, spd: cs.spd, ph: Math.random() * Math.PI * 2 });
  }

  // 2 座隨海浪起伏的紅白航海浮標（可點擊濺起水花！）
  const buoys = [];
  const buoyRed = new THREE.MeshStandardMaterial({ color: 0xd95442, roughness: 0.75 });
  const buoyCream = new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.8 });
  const buoyCoords = [[-4.8, 2.2], [4.9, 1.6]];
  buoyCoords.forEach(([bx, bz], idx) => {
    const bg = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.34, 8), buoyRed);
    base.position.y = 0.08;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 8), buoyCream);
    stripe.position.y = 0.34;
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffe478 }));
    lamp.position.y = 0.56;
    const hitB = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hitB.position.y = 0.28;
    hitB.userData.interactKind = 'buoy';
    hitB.userData.buoyIdx = idx;
    bg.add(base, stripe, lamp, hitB);
    bg.position.set(bx, 0.04, bz);
    grp.add(bg);
    interactMeshes.push(hitB);
    buoys.push({ group: bg, x: bx, z: bz, ph: idx * 2.4, bounceT: 0 });
  });

  // 3D 浮島極簡低面佔位體（下載 1.3MB 島嶼模型前先托住沙灘與五位英雄，避免空海漂浮）
  let placeholderIsland = new THREE.Group();
  const phSand = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.55, 16), new THREE.MeshStandardMaterial({ color: 0xe6d2a4, roughness: 0.92 }));
  phSand.position.set(0, -0.1, 0.3); phSand.receiveShadow = true;
  const phPeak = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.7, 7), new THREE.MeshStandardMaterial({ color: 0x9aa498, roughness: 0.95 }));
  phPeak.position.set(0.45, 1.35, -0.75);
  const phTree1 = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.05, 6), new THREE.MeshStandardMaterial({ color: 0x6ea858, roughness: 0.9 }));
  phTree1.position.set(-1.35, 0.72, -0.2);
  const phTree2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x7cb862, roughness: 0.9 }));
  phTree2.position.set(1.65, 0.65, 0.1);
  placeholderIsland.add(phSand, phPeak, phTree1, phTree2);
  grp.add(placeholderIsland);
  const loadPill = typeof document !== 'undefined' ? document.getElementById('titleLoadPill') : null;
  const setLoadPct = pct => {
    if (!loadPill) return;
    const txt = loadPill.querySelector('span');
    if (txt) txt.textContent = pct >= 100 ? '島嶼就緒' : `載入島嶼與英雄… ${pct}%`;
  };

  const SCENE_SCALE = 0.22;
  const loader = new GLTFLoader();
  loader.load('assets/scenes/creator_mountain_ship.glb', gltf => {
    if (placeholderIsland) {
      grp.remove(placeholderIsland);
      placeholderIsland.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      placeholderIsland = null;
    }
    if (loadPill) { setLoadPct(100); loadPill.classList.add('done'); }
    const model = gltf.scene;
    model.scale.setScalar(SCENE_SCALE);
    model.position.set(0, -4.69 * SCENE_SCALE, 0);
    // 旋轉 -0.66 rad 使船首、瞭望塔、沙灘與參考圖完全同角呈現！
    model.rotation.y = -0.66;
    const walkMeshes = [];
    let towerObj = null;

    model.traverse(obj => {
      if (!obj.isMesh) return;
      const n = (obj.name || '').toLowerCase();
      const isWater = n.includes('water');
      if (isWater) {
        // 隱藏原 GLB 靜止平面水層，統一由動態卡通海浪 Shader 呈現零穿模！
        obj.visible = false;
        return;
      }
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        obj.material.roughness = 0.88;
        obj.material.metalness = 0.0;
      }
      // 僅將島嶼沙灘、山坡、船體與階梯加入貼地 Raycast 目標
      if (n.includes('island') || n.includes('mountain') || n.includes('ship') || n.includes('steps') || n.includes('stair')) {
        walkMeshes.push(obj);
      }

      // 依物件種類自動綁定持續自然動畫與點擊互動標籤！
      let kind = null;
      if (n.includes('palm')) kind = 'palm';
      else if (n.includes('tree')) kind = 'tree';
      else if (n.includes('shrub')) kind = 'shrub';
      else if (n.includes('barrel')) kind = 'barrel';
      else if (n.includes('box')) kind = 'box';
      else if (n.includes('rope')) kind = 'rope';
      else if (n.includes('observation') || n.includes('tower')) { kind = 'tower'; towerObj = obj; }
      else if (n.includes('destroyed ship') || n.includes('ship')) kind = 'ship';

      if (kind) {
        const entry = {
          obj, kind,
          baseRotX: obj.rotation.x, baseRotY: obj.rotation.y, baseRotZ: obj.rotation.z,
          basePosY: obj.position.y,
          baseScaleX: obj.scale.x, baseScaleY: obj.scale.y, baseScaleZ: obj.scale.z,
          phase: Math.random() * Math.PI * 2,
          shakeT: 0,
          bounceT: 0,
        };
        animItems.push(entry);
        obj.userData.interactKind = kind;
        obj.userData.animEntry = entry;
        interactMeshes.push(obj);
      }
    });

    grp.add(model);
    model.updateMatrixWorld(true);

    // 將暖金星燈精準對齊山頂紅頂瞭望塔頂端
    if (towerObj) {
      const box = new THREE.Box3().setFromObject(towerObj);
      const center = new THREE.Vector3();
      box.getCenter(center);
      towerLanternGrp.position.set(center.x, box.max.y + 0.12, center.z);
      towerLanternGrp.visible = true;
    }

    onReady?.(walkMeshes, { animItems, interactMeshes, towerLanternGrp });
  }, xhr => {
    if (xhr?.total > 0) setLoadPct(Math.min(99, Math.round((xhr.loaded / xhr.total) * 100)));
  }, err => {
    if (loadPill) loadPill.classList.add('done');
    console.warn('[CreatorScene] Failed to load creator_mountain_ship.glb:', err);
  });

  grp.userData.oceanMat = seaMat;
  grp.userData.animItems = animItems;
  grp.userData.interactMeshes = interactMeshes;
  grp.userData.gulls = gulls;
  grp.userData.clouds = clouds;
  grp.userData.buoys = buoys;
  grp.userData.towerLantern = { group: towerLanternGrp, core: lanternCore, halo: lanternHalo, light: lanternLight, flareT: 0 };
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

  const isMobileNet = typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: coarse)').matches;
  if (!isMobileNet) preloadAllCharacterAnims();
  else setTimeout(() => preloadAllCharacterAnims(), 2200);

  let slot = clampIdx(read(slotKeys(0).activeSlotKey), 3);
  function refreshSlotsUI(keepSlot = true) {
    const acct = getActiveAccount();
    const acctBtn = $('btnAccount');
    if (acctBtn) {
      acctBtn.textContent = acct.isGuest ? '👤 訪客登入' : `👤 ${acct.username}`;
      acctBtn.style.background = acct.isGuest ? '#5a463a' : '#2f7a58';
    }
    if (!keepSlot) slot = clampIdx(read(slotKeys(0).activeSlotKey), 3);
    if (slotsSel) {
      slotsSel.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const sk = slotKeys(i);
        const savedChar = read(sk.charKey);
        const savedProf = read(sk.profileKey);
        const lvTag = savedProf?.level ? ` Lv.${savedProf.level}` : '';
        const label = savedChar?.name
          ? `${savedChar.name}${lvTag}`
          : savedProf?.level
            ? `旅人欄位 ${i + 1}${lvTag}`
            : `旅人欄位 ${i + 1}（空）`;
        slotsSel.add(new Option(label, i));
      }
      slotsSel.value = slot;
    }
  }
  refreshSlotsUI(true);

  // 統一 A Short Hike 像素渲染管線（關閉抗鋸齒＋依遊戲像素倍率縮放＋pixelated 清晰放大！）
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 180);

  const hemi = new THREE.HemisphereLight(0xfffaf0, 0x8ec6d8, 1.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dc, 1.9);
  sun.position.set(9.5, 15.5, 11.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xa8e8ff, 0.55);
  rimLight.position.set(-7, 6, -8);
  scene.add(rimLight);

  // 舞台 1：《Location mountain ship》低多邊形沉船秘島實景 + Piloto 3D 技能預演引擎
  const islandStage = new THREE.Group();
  let islandHeroes = [];
  const groundRay = new THREE.Raycaster();
  const islandGeo = buildMountainShipStage(walkMeshes => {
    if (!walkMeshes?.length) return;
    // 自動 Raycast 向下偵測沙灘／草坡高度，確保 5 位英雄雙腳精準踏地零浮空！
    const down = new THREE.Vector3(0, -1, 0);
    for (let i = 0; i < islandHeroes.length; i++) {
      const h = islandHeroes[i];
      const sp = ISLAND_SPOTS[i];
      groundRay.set(new THREE.Vector3(sp.x, 8.0, sp.z), down);
      const hits = groundRay.intersectObjects(walkMeshes, true);
      if (hits.length) {
        // 選取位於合理地面高度（0.02 ~ 1.65）的最高表面，避免誤踩懸空桅桿或船帆
        const valid = hits.find(hit => hit.point.y >= 0.02 && hit.point.y <= 1.65) || hits[hits.length - 1];
        const gy = Math.max(0.05, valid.point.y);
        sp.y = gy;
        sp.focusY = gy + 0.62;
        h.y = gy;
        h.hero.root.position.y = gy;
      }
    }
    if (islandHeroes[selectedJob]) {
      selRing.position.set(islandHeroes[selectedJob].x, islandHeroes[selectedJob].y + 0.04, islandHeroes[selectedJob].z);
    }
    computeCameraGoal();
  });
  islandStage.add(islandGeo);
  scene.add(islandStage);
  const theaterVfx = new VfxEngine(islandStage);

  // 漂浮發光海風星火粒子
  const sparkPos = new Float32Array(28 * 3);
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.8 + Math.random() * 2.8;
    sparkPos[i * 3] = Math.cos(a) * r;
    sparkPos[i * 3 + 1] = 0.6 + Math.random() * 4.2;
    sparkPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff5c0, size: 0.09, transparent: true, opacity: 0.72 }));
  islandStage.add(sparks);

  // 舞台 2：暖光木屋圓形地毯換裝間
  const dressupStage = new THREE.Group();
  dressupStage.visible = false;
  dressupStage.add(buildDressupRug());
  scene.add(dressupStage);

  // 5 位英雄實機 3D 角色（各自呈現招牌展示 Pose：弓手拉弓搭箭、戰士橫斧、法師舉杖、影刃亮刃、武僧執聖杖）
  islandHeroes = ISLAND_SPOTS.map(sp => {
    const presetLook = normalizeCharacterLook(CHAR_CATALOG.classPresets[sp.job], sp.job);
    const hero = createModularHero(presetLook, { scale: 0.68, initialState: 'combatIdle', showcasePose: sp.pose });
    hero.root.position.set(sp.x, sp.y, sp.z);
    hero.root.rotation.y = sp.rotY;
    // 點擊透明碰撞盒（Raycaster 命中更精準）
    const hitBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 1.45, 8),
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

  // 選中腳底暖金發光環 ＋ 柔和聖光聚焦光柱（取代拉近縮放，讓被選中英雄一眼聚焦又保留全島美感！）
  const selRing = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.64, 28),
    new THREE.MeshBasicMaterial({ color: 0xffdf6a, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
  );
  selRing.rotation.x = -Math.PI / 2;
  islandStage.add(selRing);
  const selBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.62, 4.4, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe896, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  selBeam.visible = false;
  islandStage.add(selBeam);

  // 狀態控制
  let stageMode = 'overview'; // 'overview' | 'focus' | 'dressup'
  let dressCat = 'preset';    // 'preset' | 'face' | 'hat' | 'body' | 'cloak' | 'boots' | 'weapon'
  let selectedJob = 0;
  let activeSlotLook = normalizeCharacterLook(null, 0);
  let activeGemDetail = null;
  let running = true;
  let inTownWardrobe = false;

  // 鎖定黃金明信片視角（禁止拖曳旋轉島嶼角度，點擊角色不縮近、僅優雅微移鏡頭＋滑鼠微視差！）
  let orbitYaw = 0.0, orbitVel = 0, dressRotY = 0;
  let mouseNdcX = 0, mouseNdcY = 0;
  const camCurPos = new THREE.Vector3(0.0, 7.65, 14.35);
  const camCurTarget = new THREE.Vector3(0.0, 2.08, -0.15);
  const camGoalPos = new THREE.Vector3(0.0, 7.65, 14.35);
  const camGoalTarget = new THREE.Vector3(0.0, 2.08, -0.15);
  let camCurFov = 32, camGoalFov = 32;

  function computeCameraGoal() {
    if (stageMode === 'dressup') {
      camGoalPos.set(0.72, 1.15, 4.10);
      camGoalTarget.set(0.72, 0.72, 0.0);
      camGoalFov = 30;
      return;
    }
    if (stageMode === 'focus') {
      const sp = ISLAND_SPOTS[selectedJob] || ISLAND_SPOTS[0];
      // 不縮近！保持完整沉船海島構圖，只輕微向左讓出右側卡片空間＋極柔和朝向選中英雄的微鏡頭傾斜
      camGoalTarget.set(1.05 + sp.x * 0.14, 2.02 + (sp.y - 0.3) * 0.15, -0.12 + sp.z * 0.08);
      camGoalPos.set(1.05 + sp.x * 0.22, 7.45, 13.85);
      camGoalFov = 31.2;
      return;
    }
    // Overview：寬闊俯瞰整座沉船海島（完整桅桿黑旗、紅頂瞭望塔、藍海浮標、漂浮白雲與 5 位英雄）！
    camGoalTarget.set(0.0, 2.08, -0.15);
    camGoalPos.set(0.0, 7.65, 14.35);
    camGoalFov = 32;
  }

  function syncHeroMeshes() {
    const h = islandHeroes[selectedJob];
    if (h) {
      h.hero.setLook(activeSlotLook, CLASSES[selectedJob]?.weapon || 'staff');
      selRing.position.set(h.x, h.y + 0.04, h.z);
      selBeam.position.set(h.x, h.y + 2.2, h.z);
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
    orbitYaw = 0;
    orbitVel = 0;
    syncHeroMeshes();
    if (triggerAnim) {
      const sp = ISLAND_SPOTS[selectedJob];
      const hObj = islandHeroes[selectedJob];
      if (hObj) hObj.hopT = 0.55; // 可愛雀躍小跳反應！
      // Phase V5：選角聚焦時於英雄腳下綻放專屬 Piloto 3D 法陣與招牌迷你特效（不再播跳躍 Buff 導致彈跳或歸零硬直！）
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
    if (pill) pill.textContent = cls.name;
    document.querySelectorAll('.hero-pin-btn,.hero-pin-3d').forEach((b, i) => b.classList.toggle('on', i === selectedJob));
    selRing.visible = stageMode === 'focus';
    selBeam.visible = stageMode === 'focus';
    computeCameraGoal();
  }

  // ---------------- 右側 Stage 1：冒險手帳（參考圖 1） ----------------
  function renderScrapbook() {
    const cls = CLASSES[selectedJob] || CLASSES[0];
    const tag = $('sbClassTag');
    if (tag) tag.textContent = `${cls.icon} ${cls.name}`;
    const desc = $('sbClassDesc');
    if (desc) desc.textContent = cls.desc;

    const startingPuzzle = defaultPuzzle(cls.id);
    const gemIds = [...startingPuzzle.presets[0], ...startingPuzzle.bag].map(gem => gem.id);
    // 三格顯示職業特色與實際初始寶石。
    const statsEl = $('sbStats');
    if (statsEl) {
      const b = cls.bonuses || {};
      const stat1 = b.armor ? `🛡️ +${b.armor}%` : b.maxHp ? `❤️ +${b.maxHp}` : b.mana ? `💧 +${b.mana}` : b.moveSpd ? `➜ +${b.moveSpd}%` : '—';
      const stat2 = b.atkSpd ? `⚔️ +${b.atkSpd}%` : b.crit ? `🎯 +${b.crit}%` : b.addFire ? `🔥 +${b.addFire}` : b.regen ? `🪷 +${b.regen}/s` : '⚔️ 均衡';
      const stat3 = `💎 ×${gemIds.length}`;
      statsEl.innerHTML = `
        <div class="sb-stat"><span class="sb-st-val">${stat1}</span><small>體質</small></div>
        <div class="sb-stat"><span class="sb-st-val">${stat2}</span><small>專長</small></div>
        <div class="sb-stat"><span class="sb-st-val">${stat3}</span><small>起始</small></div>`;
    }

    // 4×2 初始拼圖寶石網格（點擊看底部紙條說明，呼應圖 1！）
    const grid = $('sbGemGrid');
    const note = $('sbGemNote');
    if (grid) {
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

  // ---------------- 島嶼互動粒子池（落葉、金幣、水花、羽毛、螢火） ----------------
  const islFxPool = [];
  const islFxGeo = new THREE.OctahedronGeometry(0.085, 0);
  function burstIslandFx(worldPt, colors, count = 12, spread = 2.0, up = 2.6) {
    const localPt = islandStage.worldToLocal(worldPt.clone());
    for (let i = 0; i < count; i++) {
      if (islFxPool.length >= 90) {
        const old = islFxPool.shift();
        islandStage.remove(old.mesh);
        old.mesh.material.dispose();
      }
      const c = colors[i % colors.length];
      const m = new THREE.Mesh(islFxGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1 }));
      m.position.copy(localPt);
      m.position.y += 0.15;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 0.8) * spread;
      islandStage.add(m);
      islFxPool.push({
        mesh: m,
        vx: Math.cos(a) * sp,
        vy: up * (0.65 + Math.random() * 0.65),
        vz: Math.sin(a) * sp,
        life: 0.75 + Math.random() * 0.45,
        maxLife: 1.0,
      });
    }
  }

  // ---------------- 滑鼠 360° 旋轉 ＋ 3D 點擊選英雄 ＋ 島嶼物件互動 ----------------
  const raycaster = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let drag = null;
  let oceanClock = 0;
  let hoverCheckCd = 0;
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseNdcX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    mouseNdcY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    if (!drag) {
      // 懸停偵測：指到英雄或可互動島嶼物件時顯示手型游標（選角頁鎖定視角，不顯示抓手）
      if (stageMode !== 'dressup' && (performance.now() - hoverCheckCd) > 70) {
        hoverCheckCd = performance.now();
        ptr.set(mouseNdcX, mouseNdcY);
        raycaster.setFromCamera(ptr, camera);
        const heroHit = raycaster.intersectObjects(islandHeroes.map(h => h.hitBox), false);
        const propMeshes = (islandGeo.userData.interactMeshes || []).filter(m => m.userData.interactKind !== 'ocean');
        const propHit = heroHit.length ? heroHit : raycaster.intersectObjects(propMeshes, false);
        canvas.style.cursor = propHit.length ? 'pointer' : 'default';
      }
      return;
    }
    const dx = e.clientX - drag.lx;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    drag.lx = e.clientX;
    // 僅在換裝間允許旋轉檢視角色；選角島嶼頁鎖定最佳美感構圖，禁止拖曳移動角度！
    if (stageMode === 'dressup') {
      dressRotY += dx * 0.012;
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
      } else {
        // 偵測點擊島上可互動元件（木桶、木箱、棕櫚樹、闊葉樹、灌木、沉船、瞭望塔、海鷗、動態海面！）
        const propHits = raycaster.intersectObjects(islandGeo.userData.interactMeshes || [], false);
        const hit = propHits[0];
        if (hit) {
          const kind = hit.object.userData.interactKind;
          const entry = hit.object.userData.animEntry;
          const pt = hit.point;
          if (kind === 'barrel' || kind === 'box') {
            if (entry) entry.bounceT = 1.0;
            burstIslandFx(pt, [0xffd85a, 0xffe89a, 0xffffff], 14, 1.8, 2.8);
            game.audio?.sfx?.('pickup');
          } else if (kind === 'palm' || kind === 'tree') {
            if (entry) entry.shakeT = 1.25;
            burstIslandFx(pt, [0x7fe06a, 0xa8ec78, 0xffd85a], 15, 2.1, 2.2);
            game.audio?.sfx?.('perfect');
          } else if (kind === 'shrub') {
            if (entry) entry.bounceT = 1.0;
            burstIslandFx(pt, [0x8ef08a, 0xfff07a, 0x98f8ff], 12, 1.6, 2.4);
            game.audio?.sfx?.('xpGem');
          } else if (kind === 'ship' || kind === 'rope') {
            if (entry) entry.shakeT = 1.1;
            burstIslandFx(pt, [0xffffff, 0x8eeeff, 0xffd85a], 16, 2.4, 2.6);
            game.audio?.sfx?.('tideHorn');
            // 船上英雄開心揮手／蓄力回應
            islandHeroes[4]?.hero?.play?.('buff', { once: true, force: true });
          } else if (kind === 'tower') {
            if (entry) entry.bounceT = 0.85;
            const tl = islandGeo.userData.towerLantern;
            if (tl) tl.flareT = 1.6;
            const tlWorld = tl?.group ? tl.group.getWorldPosition(new THREE.Vector3()) : pt;
            burstIslandFx(tlWorld, [0xffe87a, 0xffa83a, 0xffffff], 18, 2.2, 3.2);
            theaterVfx.spawnDecal('holy_ring', tlWorld.x, tlWorld.y - 0.1, tlWorld.z, { theme: 'holy', scaleStart: 0.4, scaleEnd: 1.8, dur: 1.0 });
            game.audio?.sfx?.('ultReady');
          } else if (kind === 'gull') {
            const gItem = (islandGeo.userData.gulls || [])[hit.object.userData.gullIdx];
            if (gItem) gItem.boostT = 1.5;
            burstIslandFx(pt, [0xffffff, 0xfff8e6, 0x8eeeff], 12, 1.8, 1.8);
            game.audio?.sfx?.('ui');
          } else if (kind === 'buoy') {
            const bItem = (islandGeo.userData.buoys || [])[hit.object.userData.buoyIdx];
            if (bItem) bItem.bounceT = 1.1;
            const oceanMat = islandGeo.userData.oceanMat;
            if (oceanMat?.uniforms?.uRipple) oceanMat.uniforms.uRipple.value.set(pt.x, pt.z, oceanClock, 1.0);
            burstIslandFx(pt, [0xffffff, 0xaef6ff, 0xffe478], 14, 1.8, 2.5);
            game.audio?.sfx?.('pickup');
          } else if (kind === 'ocean') {
            const oceanMat = islandGeo.userData.oceanMat;
            if (oceanMat?.uniforms?.uRipple) {
              oceanMat.uniforms.uRipple.value.set(pt.x, pt.z, oceanClock, 1.0);
            }
            burstIslandFx(pt, [0xffffff, 0xaef6ff, 0x62d8ff], 14, 1.9, 2.5);
            game.audio?.sfx?.('xpGem');
            if (stageMode === 'focus') setOverview();
          }
        } else if (stageMode === 'focus') {
          setOverview();
        }
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

  // ---------------- 帳號登入／註冊／切換／備份彈窗 ----------------
  let acctMode = 'login'; // 'login' | 'register'
  const syncDelBtn = () => {
    const bd = $('btnDelChar');
    if (!bd) return;
    const has = slotHasData(slot);
    bd.disabled = !has;
    bd.title = has ? '永久刪除此欄位角色存檔' : '目前欄位為空白存檔';
  };
  const origSelectSlot = selectSlot;
  if (slotsSel) slotsSel.onchange = () => { origSelectSlot(); syncDelBtn(); };
  syncDelBtn();

  const setAcctMode = (mode) => {
    acctMode = mode;
    $('tabAcctLogin')?.classList.toggle('on', mode === 'login');
    $('tabAcctReg')?.classList.toggle('on', mode === 'register');
    $('acctPass2Wrap')?.classList.toggle('hide', mode !== 'register');
    const sub = $('btnAcctSubmit');
    if (sub) sub.textContent = mode === 'register' ? '✨ 註冊並登入' : '🔑 登入帳號';
    if ($('acctMsg')) $('acctMsg').textContent = '';
  };

  const renderAccountChips = () => {
    const box = $('acctList');
    if (!box) return;
    const all = Object.values(listAccounts());
    const cur = getActiveAccount();
    if (!all.length) {
      box.innerHTML = '<span style="font-size:11.5px;color:#7a5a42">尚無本地註冊帳號，點「註冊新帳號」建立專屬存檔空間！</span>';
      return;
    }
    box.innerHTML = all.map(a => {
      const isMe = !cur.isGuest && cur.username.toLowerCase() === a.username.toLowerCase();
      return `<button type="button" class="acct-chip${isMe ? ' on' : ''}" data-pickacct="${a.username}">👤 ${a.username}${isMe ? ' (目前)' : ''}</button>`;
    }).join('');
    box.querySelectorAll('[data-pickacct]').forEach(btn => {
      btn.onclick = () => {
        setAcctMode('login');
        if ($('acctUser')) $('acctUser').value = btn.dataset.pickacct;
        $('acctPass')?.focus?.();
      };
    });
  };

  function refreshAccountStatus() {
    const sum = getAccountSummary();
    $('acctStatus').textContent = sum.isGuest
      ? `訪客 · ${sum.usedSlots} / 3 個角色`
      : `${sum.username} · ${sum.usedSlots} / 3 個角色`;
    syncDelBtn();
    return sum;
  }

  const openAccountModal = () => {
    const acctModal = $('accountModal');
    if (!acctModal) return;
    const sum = refreshAccountStatus();
    const lo = $('btnAcctLogout');
    if (lo) lo.classList.toggle('hide', sum.isGuest);
    setAcctMode('login');
    renderAccountChips();
    if ($('acctUser')) $('acctUser').value = sum.isGuest ? '' : sum.username;
    if ($('acctPass')) $('acctPass').value = '';
    if ($('acctPass2')) $('acctPass2').value = '';
    acctModal.classList.remove('hide');
    $('acctUser')?.focus?.();
  };
  const closeAccountModal = () => { $('accountModal')?.classList.add('hide'); };
  const onAccountChanged = (msg) => {
    refreshSlotsUI(false);
    selectSlot();
    syncDelBtn();
    game.zoneStates?.clear?.();
    game.meta = new Meta(slot);
    closeAccountModal();
    game.audio?.sfx?.('classup');
    game.ui?.toast?.(msg, '#7fe08a');
  };

  const btnAcct = $('btnAccount'); if (btnAcct) btnAcct.onclick = () => { game.audio?.sfx?.('ui'); openAccountModal(); };
  const btnAcctClose = $('btnAcctClose'); if (btnAcctClose) btnAcctClose.onclick = closeAccountModal;
  $('accountModal')?.addEventListener('click', e => { if (e.target === $('accountModal')) closeAccountModal(); });
  $('tabAcctLogin')?.addEventListener('click', () => { game.audio?.sfx?.('ui'); setAcctMode('login'); });
  $('tabAcctReg')?.addEventListener('click', () => { game.audio?.sfx?.('ui'); setAcctMode('register'); });

  const doAcctSubmit = () => {
    const u = $('acctUser')?.value || '';
    const p1 = $('acctPass')?.value || '';
    const p2 = $('acctPass2')?.value || '';
    const msgEl = $('acctMsg');
    if (acctMode === 'register') {
      if (p1 !== p2) { if (msgEl) msgEl.textContent = '兩次輸入的密碼不一致，請重新確認'; game.audio?.sfx?.('ui'); return; }
      const res = registerAccount(u, p1);
      if (!res.ok) { if (msgEl) msgEl.textContent = res.reason; game.audio?.sfx?.('ui'); return; }
      onAccountChanged(`✨ 帳號「${res.account.username}」註冊並登入成功！`);
    } else {
      const res = loginAccount(u, p1);
      if (!res.ok) { if (msgEl) msgEl.textContent = res.reason; game.audio?.sfx?.('ui'); return; }
      onAccountChanged(`👤 歡迎回來，${res.account.username}！已載入專屬角色存檔`);
    }
  };
  $('btnAcctSubmit')?.addEventListener('click', doAcctSubmit);
  $('acctPass')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) doAcctSubmit(); });
  $('acctPass2')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) doAcctSubmit(); });
  $('btnAcctLogout')?.addEventListener('click', () => {
    logoutAccount();
    onAccountChanged('已登出帳號，切換回訪客模式');
  });
  $('btnAcctExport')?.addEventListener('click', async () => {
    const dump = exportAccountData();
    try {
      await navigator.clipboard.writeText(dump);
      $('acctMsg').textContent = '已複製存檔備份碼。';
    } catch (_) {
      openTextDialog({ title: '匯出存檔', description: '複製備份碼並留在安全的位置。', value: dump, readOnly: true });
    }
  });
  $('btnAcctImport')?.addEventListener('click', () => {
    openTextDialog({
      title: '還原存檔',
      description: '貼上先前匯出的備份碼。備份內有資料的角色欄位會覆蓋目前的存檔。',
      value: '',
      action: '還原角色欄位',
      danger: true,
      submit(raw) {
        if (!raw.trim()) return '請貼上備份碼。';
        const res = importAccountData(raw);
        if (!res.ok) return res.reason;
        onAccountChanged(`已還原 ${res.restored} 個角色欄位。`);
      },
    });
  });

  // ---------------- 刪除角色確認彈窗 ----------------
  const openDelModal = () => {
    const delModal = $('delCharModal');
    if (!delModal) return;
    if (!slotHasData(slot)) {
      game.audio?.sfx?.('ui');
      game.ui?.toast?.(`欄位 #${slot + 1} 目前已是空白角色，無需刪除`, '#ffd85a');
      return;
    }
    const sk = slotKeys(slot);
    const savedChar = read(sk.charKey);
    const savedProf = read(sk.profileKey);
    const cname = savedChar?.name || `旅人欄位 ${slot + 1}`;
    const clsDef = CLASSES[clampIdx(savedChar?.job, CLASSES.length)] || CLASSES[0];
    const lvStr = savedProf?.level ? `${clsDef.icon}${clsDef.name} · Lv.${savedProf.level} · 🪙${savedProf.coins || 0} · 💎${savedProf.shards || 0}` : `${clsDef.icon}${clsDef.name}`;
    const info = $('delCharInfo');
    if (info) info.textContent = `目標欄位：#${slot + 1} ${cname}（${lvStr}）`;
    delModal.classList.remove('hide');
  };
  const closeDelModal = () => { $('delCharModal')?.classList.add('hide'); };
  const btnDel = $('btnDelChar'); if (btnDel) btnDel.onclick = () => { game.audio?.sfx?.('ui'); openDelModal(); };
  $('btnDelCancel')?.addEventListener('click', closeDelModal);
  $('btnDelCancelTop')?.addEventListener('click', closeDelModal);
  $('delCharModal')?.addEventListener('click', e => { if (e.target === $('delCharModal')) closeDelModal(); });
  $('btnDelConfirm')?.addEventListener('click', () => {
    deleteCharacterSlot(slot);
    game.zoneStates?.clear?.();
    if (game._companionMesh) { game.scene?.remove?.(game._companionMesh.root); game._companionMesh = null; }
    refreshSlotsUI(true);
    selectSlot();
    refreshAccountStatus();
    game.meta = new Meta(slot);
    closeDelModal();
    game.audio?.sfx?.('corruptBrick');
    $('acctMsg').textContent = `已刪除欄位 #${slot + 1} 的角色存檔。`;
  });

  // 允許遊戲內從設定頁一鍵返回 3D 選角／帳號登入畫面！
  game.ui.returnToCharSelect = () => {
    game.meta?.save?.();
    game.net.disconnect();
    game.ui.closeSettings?.();
    inTownWardrobe = false;
    titleEl.classList.remove('hide', 'wardrobe-overlay');
    $('hud')?.classList.add('hide');
    refreshSlotsUI(true);
    selectSlot();
    syncDelBtn();
    stageMode = 'overview';
    updateStageClasses();
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  };
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
        game.dayTime = 0.50;
        if (qs.get('hd') === '1') {
          if (game.settings) game.settings.pixel = 1;
          game.pipe?.setPixelScale?.(1);
        }
        if (pv === 'field' || pv === 'vfx_demo') {
          const fid = +(qs.get('fid') || 1);
          game.enterTown?.(); game.enterField?.(fid);
          const posQ = qs.get('pos');
          if (posQ && game.player && game.world) {
            const [pu, pv2] = posQ.split(',').map(Number);
            if (Number.isFinite(pu) && Number.isFinite(pv2)) {
              const wx = (pu - 0.5) * game.world.half * 2, wz = (pv2 - 0.5) * game.world.half * 2;
              game.player.pos.set(wx, 0, wz); game.player.y = game.world.gh(wx, wz);
              game.player.iframes = 999;
              game.camPos?.set?.(wx, 0, wz);
            }
          }
        }
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

  // 動畫與平滑運鏡迴圈（同步套用遊戲內像素倍率，讓選角頁與 A Short Hike 風格完全一致！）
  let lastT = performance.now();
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const pxScale = Math.max(2, Math.min(4, game.settings?.pixel || 3));
    const w = Math.max(240, Math.round(rect.width / pxScale));
    const h = Math.max(150, Math.round(rect.height / pxScale));
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
    }
    const aspect = rect.width / Math.max(1, rect.height);
    if (aspect > 0 && camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    resize();

    // 選角島嶼鎖定黃金構圖角度（不可旋轉，畫面穩重優雅）
    islandStage.rotation.y = 0;
    islandGeo.position.y = 0;
    sparks.rotation.y += dt * 0.16;
    selRing.scale.setScalar(1 + Math.sin(now * 0.004) * 0.05);
    if (selBeam.visible) {
      selBeam.rotation.y += dt * 0.6;
      selBeam.material.opacity = 0.15 + Math.sin(now * 0.0035) * 0.04;
    }

    // 1. 動態卡通海水 Shader 時間驅動（持續海浪起伏＋浪花輪廓流動＋點擊漣漪）
    oceanClock += dt;
    const oceanMat = islandGeo.userData.oceanMat;
    if (oceanMat?.uniforms?.uTime) oceanMat.uniforms.uTime.value = oceanClock;

    // 2. 島嶼物件自然風吹動畫＋點擊彈性回饋動畫
    const breeze = 0.75 + 0.35 * Math.sin(oceanClock * 0.65);
    for (const it of islandGeo.userData.animItems || []) {
      const o = it.obj;
      if (it.shakeT > 0) it.shakeT = Math.max(0, it.shakeT - dt);
      if (it.bounceT > 0) it.bounceT = Math.max(0, it.bounceT - dt);
      const shakeOsc = it.shakeT > 0 ? Math.sin(it.shakeT * 28) * it.shakeT * 0.16 : 0;
      const bSq = it.bounceT > 0 ? Math.sin(it.bounceT * Math.PI * 3) * it.bounceT * 0.22 : 0;

      if (it.kind === 'palm' || it.kind === 'tree') {
        const amp = it.kind === 'palm' ? 0.048 : 0.026;
        o.rotation.z = it.baseRotZ + Math.sin(oceanClock * 1.85 + it.phase) * amp * breeze + shakeOsc;
        o.rotation.x = it.baseRotX + Math.cos(oceanClock * 1.45 + it.phase) * (amp * 0.6) * breeze;
      } else if (it.kind === 'shrub') {
        o.rotation.z = it.baseRotZ + Math.sin(oceanClock * 2.4 + it.phase) * 0.035 * breeze;
        o.scale.set(it.baseScaleX * (1 + bSq * 0.7), it.baseScaleY * (1 - bSq * 0.6), it.baseScaleZ * (1 + bSq * 0.7));
      } else if (it.kind === 'rope') {
        o.rotation.z = it.baseRotZ + Math.sin(oceanClock * 2.2 + it.phase) * 0.04 * breeze + shakeOsc * 0.6;
      } else if (it.kind === 'ship') {
        o.rotation.z = it.baseRotZ + Math.sin(oceanClock * 1.1) * 0.008 + shakeOsc * 0.25;
      } else if (it.kind === 'barrel' || it.kind === 'box') {
        o.position.y = it.basePosY + Math.max(0, Math.sin(it.bounceT * Math.PI * 2) * it.bounceT * 1.6);
        o.scale.set(it.baseScaleX * (1 - bSq * 0.45), it.baseScaleY * (1 + bSq * 0.65), it.baseScaleZ * (1 - bSq * 0.45));
      } else if (it.kind === 'tower') {
        o.scale.set(it.baseScaleX * (1 - bSq * 0.12), it.baseScaleY * (1 + bSq * 0.16), it.baseScaleZ * (1 - bSq * 0.12));
      }
    }

    // 3. 山頂瞭望塔暖金星燈呼吸＋點擊信號爆發
    const tl = islandGeo.userData.towerLantern;
    if (tl?.group?.visible) {
      if (tl.flareT > 0) tl.flareT = Math.max(0, tl.flareT - dt);
      const pulse = 1 + Math.sin(oceanClock * 3.4) * 0.12 + tl.flareT * 0.85;
      tl.core.rotation.y += dt * (2.0 + tl.flareT * 8);
      tl.halo.scale.setScalar(pulse);
      tl.light.intensity = 1.8 + Math.sin(oceanClock * 3.4) * 0.35 + tl.flareT * 3.5;
    }

    // 4. 高空盤旋海鷗（雙翅拍動＋點擊翻滾加速）
    for (const gu of islandGeo.userData.gulls || []) {
      if (gu.boostT > 0) gu.boostT = Math.max(0, gu.boostT - dt);
      const spdMul = 1 + gu.boostT * 1.6;
      gu.ang += dt * gu.speed * spdMul;
      const x = Math.cos(gu.ang) * gu.radius;
      const z = Math.sin(gu.ang) * gu.radius;
      const y = gu.height + Math.sin(oceanClock * 1.6 + gu.flapPh) * 0.28 + gu.boostT * 0.35;
      gu.root.position.set(x, y, z);
      gu.root.rotation.y = -gu.ang;
      gu.root.rotation.z = gu.boostT > 0 ? Math.sin(gu.boostT * 12) * 0.65 : 0.14;
      const flap = Math.sin(oceanClock * (8.5 + gu.boostT * 7) + gu.flapPh) * 0.48;
      gu.wingL.rotation.z = flap;
      gu.wingR.rotation.z = -flap;
    }

    // 5. 漂浮白雲與海面紅白浮標動畫
    for (const cl of islandGeo.userData.clouds || []) {
      cl.group.position.x += dt * cl.spd;
      if (cl.group.position.x > 11.5) cl.group.position.x = -11.5;
      cl.group.position.y = cl.baseY + Math.sin(oceanClock * 0.7 + cl.ph) * 0.14;
    }
    for (const bu of islandGeo.userData.buoys || []) {
      if (bu.bounceT > 0) bu.bounceT = Math.max(0, bu.bounceT - dt);
      const bob = Math.sin(oceanClock * 2.1 + bu.ph) * 0.09 + Math.max(0, Math.sin(bu.bounceT * Math.PI * 3) * bu.bounceT * 0.35);
      bu.group.position.y = 0.04 + bob;
      bu.group.rotation.z = Math.sin(oceanClock * 1.6 + bu.ph) * 0.12;
      bu.group.rotation.x = Math.cos(oceanClock * 1.3 + bu.ph) * 0.08;
    }

    // 6. 島嶼互動粒子物理更新
    for (let i = islFxPool.length - 1; i >= 0; i--) {
      const pt = islFxPool[i];
      pt.life -= dt;
      pt.vy -= 6.5 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      pt.mesh.rotation.x += dt * 5;
      pt.mesh.rotation.y += dt * 6;
      pt.mesh.material.opacity = Math.max(0, pt.life / pt.maxLife);
      if (pt.life <= 0) {
        islandStage.remove(pt.mesh);
        pt.mesh.material.dispose();
        islFxPool.splice(i, 1);
      }
    }

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
      for (const h of islandHeroes) {
        h.hero.update(dt);
        if (h.hopT > 0) {
          h.hopT = Math.max(0, h.hopT - dt);
          const hopY = Math.sin((h.hopT / 0.55) * Math.PI) * 0.28;
          h.hero.root.position.y = h.y + hopY;
        } else {
          h.hero.root.position.y = h.y;
        }
      }
      theaterVfx.update(dt, camera);
    }

    // 絲滑運鏡插值 ＋ 輕微電影感滑鼠視差與呼吸微動（點擊角色不縮近！）
    const k = 1 - Math.exp(-dt * 5.2);
    const parX = stageMode === 'dressup' ? 0 : (mouseNdcX * 0.32 + Math.sin(oceanClock * 0.45) * 0.12);
    const parY = stageMode === 'dressup' ? 0 : (mouseNdcY * 0.14 + Math.cos(oceanClock * 0.38) * 0.06);
    camCurPos.lerp(camGoalPos, k);
    camCurTarget.lerp(camGoalTarget, k);
    camCurFov += (camGoalFov - camCurFov) * k;
    camera.position.set(camCurPos.x + parX, camCurPos.y + parY, camCurPos.z);
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
    game.toggleMount(true);
    game.slot = slot;
    game.meta = new Meta(slot);
    game.character = { ...activeSlotLook, job: selectedJob };
    const cls = CLASSES[selectedJob] || CLASSES[0];
    const isNew = !game.meta.p.puzzle;
    ensurePuzzle(game.meta.p, cls.id);
    if (isNew) { game.meta.p.weapon = cls.weapon; game.meta.save(); }
    try {
      localStorage.setItem(key(slot), JSON.stringify({ ...game.character, name: game.playerName, hood: game.hoodIdx }));
      localStorage.setItem(slotKeys(0).activeSlotKey, JSON.stringify(slot));
    } catch { /* ignore */ }
  };
}
