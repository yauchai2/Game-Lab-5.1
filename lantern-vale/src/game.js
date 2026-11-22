import * as THREE from 'three';
import { World, toonMat, HALF } from './world.js';
import { BIOMES, mulberry32, clamp, lerp, angleLerp, rand, pick } from './util.js';
import { buildPlayer, buildSlime, buildThorn, buildBoar, buildMoth, buildStag, buildArch, buildHouse, buildFountain, buildBoard, buildStall } from './models.js';
import { Net } from './net.js';
const EMOTES = ['嗨～', '♥', '哈哈', 'zZ'];
const HOODS = [[0x2f8a7e, 0x23695f], [0xd9543a, 0xa83f2c], [0x6a6ad0, 0x4a4aa0], [0xe0a030, 0xb07f20], [0xc060b0, 0x904488], [0x58a858, 0x3f823f], [0x4aa0d8, 0x3478a8], [0x8a6a50, 0x65503c]];
import { makeItem, itemLines, itemScore, RARITY, SLOTS, rollBoons, BOONS } from './loot.js';

const V2 = THREE.Vector2, V3 = THREE.Vector3;
const tmp2 = new V2(), tmp3 = new V3();

// ---------------- particles ----------------
class Particles {
  constructor(scene, max, lit) {
    this.max = max;
    const geo = lit ? new THREE.IcosahedronGeometry(0.5, 0) : new THREE.BoxGeometry(1, 1, 1);
    const mat = lit ? toonMat({}) : new THREE.MeshBasicMaterial({});
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.userData.noNormal = true;
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    scene.add(this.mesh);
    this.p = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, g: 0, grow: 0, drag: 0 }));
    this.i = 0; this.m = new THREE.Matrix4(); this.c = new THREE.Color();
  }
  emit(x, y, z, o = {}) {
    const p = this.p[this.i]; const idx = this.i; this.i = (this.i + 1) % this.max;
    p.x = x; p.y = y; p.z = z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life || 0.6; p.s = o.s || 0.12; p.g = o.g ?? 9; p.grow = o.grow || 0; p.drag = o.drag || 0;
    this.c.set(o.c ?? 0xffffff); this.mesh.setColorAt(idx, this.c); this.mesh.instanceColor.needsUpdate = true;
  }
  burst(x, y, z, n, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 4) * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, { ...o, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up ?? 3) * (0.5 + Math.random()), c: Array.isArray(o.c) ? pick(Math.random, o.c) : o.c, s: (o.s || 0.12) * (0.6 + Math.random() * 0.8) });
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); continue; }
      p.life -= dt;
      p.vy -= p.g * dt; const dr = 1 - p.drag * dt;
      p.vx *= dr; p.vz *= dr; p.vy *= (p.drag ? dr : 1);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.g > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const t = p.life / p.max;
      const s = p.s * (p.grow ? (1 + (1 - t) * p.grow) * Math.min(1, t * 3) : Math.min(1, t * 2.5));
      this.m.makeScale(s, s, s); this.m.setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const p of this.p) p.life = 0; }
}

// ---------------- telegraph decals ----------------
const decalVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const decalFS = `uniform vec3 uColor; uniform float uProg, uShape, uAlpha; varying vec2 vUv;
  void main(){
    float a = 0.0;
    if (uShape < 0.5) { float d = length(vUv-0.5)*2.0; if (d>1.0) discard;
      a = smoothstep(0.86,0.9,d)*0.9 + step(d,uProg)*0.32 + step(abs(d-uProg),0.04)*0.5; }
    else if (uShape < 1.5) { float edge = step(0.92, max(abs(vUv.x-0.5)*2.0, 0.0)) ;
      a = edge*0.8 + step(vUv.y, uProg)*0.3 + step(abs(vUv.y-uProg),0.02)*0.5; }
    else { float d = length(vUv-0.5)*2.0; if (d>1.0) discard; a = smoothstep(0.6,1.0,d)*(1.0-smoothstep(0.95,1.0,d))*1.2; }
    gl_FragColor = vec4(uColor, a*uAlpha);
  }`;

export class Game {
  constructor(pipe, ui, audio) {
    this.pipe = pipe; this.ui = ui; this.audio = audio;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 4, 90);
    pipe.onResize = (w, h) => { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
    pipe.onResize(pipe.w, pipe.h);
    this.hemi = new THREE.HemisphereLight(0xb9c9ff, 0xd9b07a, 0.6);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 1.05);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.lampLight = new THREE.PointLight(0xffb85a, 1.6, 3.5, 1.5);
    this.scene.add(this.lampLight);
    this.world = new World(this.scene);
    this.fx = new Particles(this.scene, 700, false);
    this.puffs = new Particles(this.scene, 300, true);
    this.motes = [];
    this.enemies = []; this.projs = []; this.eprojs = []; this.drops = []; this.decals = []; this.exits = []; this.slashes = []; this.rings = [];
    this.keys = {}; this.mouse = { x: 0, y: 0, l: false, r: false }; this.aim = new V3();
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new V3(0, 1, 0), 0);
    this.state = 'title'; this.time = 0; this.shake = 0; this.hitstop = 0; this.hurtFlash = 0; this.fade = 0;
    this.camPos = new V3(0, 20, 14);
    this.flowTimer = 0;
    this.net = new Net(); this.remotes = new Map(); this.townGroup = null; this.party = ''; this.bots = [];
    this.playerName = '旅人'; this.hoodIdx = 0; this.posT = 0;
    this.bindInput();
    this.setupNet();
    // title scene: a pretty room in the background
    this.player = this.makePlayer();
    this.loadRoom(0, null, true);
  }

  // ---------------- input ----------------
  bindInput() {
    const CODE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift', KeyQ: 'q', KeyE: 'e', KeyR: 'r', KeyF: 'f', KeyI: 'i', KeyM: 'm', Tab: 'tab', Escape: 'escape', Enter: 'enter', KeyT: 't', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4' };
    const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
    addEventListener('keydown', e => {
      if (typing()) { if (e.code === 'Escape' || e.code === 'Enter') this.ui.chatKey?.(e); return; }
      const k = CODE[e.code] ?? e.key.toLowerCase();
      if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      const fresh = !this.keys[k]; this.keys[k] = true;
      this.audio.init();
      if (!fresh) return;
      if (k === 'm') { this.ui.toast(this.audio.toggleMute() ? '音效：關' : '音效：開', '#fff'); return; }
      if (this.state === 'play') {
        if (k === 'shift') this.tryRoll();
        if (k === ' ') this.tryJump();
        if (k === 'q') this.trySlam();
        if (k === 'e') this.tryWisp();
        if (k === 'r') this.tryFlask();
        if (k === 'f') this.tryPickup();
        if (['1', '2', '3', '4'].includes(k)) this.emote(+k - 1);
        if (k === 'enter' || k === 't') { if (this.ui.focusChat?.()) e.preventDefault(); }
        if (k === 'tab' || k === 'i') this.ui.toggleInv(this);
        if (k === 'escape') this.ui.toggleInv(this);
      } else if (this.state === 'boon' && ['1', '2', '3'].includes(k)) this.ui.pickBoonIndex(+k - 1);
    });
    addEventListener('keyup', e => { const k = CODE[e.code] ?? e.key.toLowerCase(); this.keys[k] = false; this.keys[e.key.toLowerCase()] = false; });
    const cv = this.pipe.renderer.domElement;
    addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    cv.addEventListener('mousedown', e => { this.audio.init(); window.focus(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); if (e.button === 0) this.mouse.l = true; if (e.button === 2) this.mouse.r = true; });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => { this.keys = {}; this.mouse.l = this.mouse.r = false; });
    document.addEventListener('visibilitychange', () => { this.keys = {}; });
  }

  // ---------------- player ----------------
  makePlayer() {
    const m = buildPlayer(...HOODS[this.hoodIdx]);
    m.root.scale.setScalar(1.25);
    this.scene.add(m.root);
    const p = {
      m, pos: new V3(), vel: new V3(), facing: 0, hp: 100, mana: 50, equip: { staff: null, cloak: null, charm: null },
      boons: [], skills: { slam: false, wisp: false }, cds: { atk: 0, bolt: 0, roll: 0, slam: 0, wisp: 0 },
      roll: 0, rollDir: new V3(), iframes: 0, flask: { charges: 2, max: 3, prog: 0 }, healOver: 0,
      y: 0, vy: 0, air: false, climbing: false, gliding: false, wall: false, stamina: 100, lastLow: new V3(), stepT: 0, swing: 0, swingT: 0, swingCount: 0, galeBuff: false, wisps: [], wispT: 0, walkT: 0, kills: 0, dmgDealt: 0, stats: {},
    };
    p.equip.staff = makeItem(mulberry32(5), 0, 0, 'staff');
    return p;
  }
  recalc() {
    const p = this.player;
    const s = { baseDmg: 10, dmgPct: 0, addFire: 0, atkSpd: 0, crit: 5, critMult: 150, maxHp: 100, lifeOnHit: 0, moveSpd: 0, cdr: 0, mana: 50, area: 0, armor: 0, proj: 1, regen: 0 };
    const specials = new Set();
    for (const it of Object.values(p.equip)) if (it) {
      for (const m of [it.implicit, ...it.mods]) if (m) s[m.k] = (s[m.k] || 0) + m.v;
      if (it.special) specials.add(it.special);
    }
    const B = id => p.boons.filter(b => b === id).length;
    s.maxHp += 30 * B('thick');
    s.proj += B('multi');
    s.moveSpd += 12 * B('swift'); s.atkSpd += 12 * B('swift');
    s.crit += 8 * B('sharp'); s.critMult += 30 * B('sharp');
    if (B('glass')) { s.dmgPct += 40; s.maxHp = Math.round(s.maxHp * 0.85); }
    p.flask.max = 3 + B('flask');
    s.cdr = Math.min(60, s.cdr);
    s.armor = Math.min(60, s.armor);
    p.stats = s; p.specials = specials;
    p.hp = Math.min(p.hp, s.maxHp); p.mana = Math.min(p.mana, s.mana);
  }
  has(id) { return this.player.boons.includes(id); }

  // ---------------- run / rooms ----------------
  startRun() {
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer();
    this.recalc(); this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.runSeed = this.party ? [...this.party].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000000 : (Math.random() * 1e6) | 0;
    this.runStart = performance.now();
    this.state = 'play';
    this.loadRoom(0, null);
  }
  enterTown() {
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer(); this.recalc();
    this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.state = 'play'; this.player.m.root.visible = true;
    this.loadRoom(-1, null);
  }
  get zone() { return this.state === 'title' ? 'title' : this.depth < 0 ? 'town' : `run:${this.party || 'solo' + (this.net.id || '')}:${this.depth}`; }
  biomeFor(depth) { return depth >= 9 ? 3 : Math.floor(depth / 3); }
  loadRoom(depth, reward, title = false) {
    this.depth = depth; this.reward = reward;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    for (const a of [...this.projs, ...this.eprojs, ...this.decals, ...this.slashes, ...this.rings]) this.scene.remove(a.mesh);
    for (const d of this.drops) this.scene.remove(d.g);
    for (const x of this.exits) this.scene.remove(x.g);
    for (const w of this.player.wisps) this.scene.remove(w.mesh);
    this.player.wisps = [];
    this.enemies = []; this.projs = []; this.eprojs = []; this.decals = []; this.drops = []; this.exits = []; this.slashes = []; this.rings = [];
    this.fx.clear(); this.puffs.clear();
    const town = depth === -1;
    if (this.townGroup) { this.scene.remove(this.townGroup); this.townGroup = null; }
    for (const b of this.bots) this.removeRemote(b); this.bots = [];
    const bi = (title || town) ? 0 : this.biomeFor(depth);
    const B = BIOMES[bi]; this.biome = B;
    const boss = depth === 9 && !title;
    const seed = title ? 4242 : town ? 9001 : (this.runSeed || 1) + depth * 101;
    this.rng = mulberry32(seed + 77);
    const { spawn, exits } = this.world.generate(seed, B, { boss, town, exitCount: town ? 1 : boss ? 0 : (depth === 0 ? 2 : (this.rng() < 0.5 ? 2 : 3)) });
    // lights per biome
    this.sun.color.set(B.sun); this.sun.intensity = B.sunI * 2.3;
    this.hemi.color.set(B.sky); this.hemi.groundColor.set(B.ground); this.hemi.intensity = B.ambient * 1.75;
    this.pipe.postMat.uniforms.uGrade.value.set(...B.grade);
    this.pipe.postMat.uniforms.uShaft.value.set(...B.shaft);
    // player
    const p = this.player;
    p.pos.set(spawn.x, 0, spawn.z); p.vel.set(0, 0, 0); p.facing = Math.PI; p.roll = 0;
    this.camPos.set(p.pos.x, 0, p.pos.z);
    // exits (inactive until cleared)
    const types = ['item', 'boon', 'heal'];
    const pool = depth === 0 ? ['boon', 'item'] : types.slice().sort(() => this.rng() - 0.5);
    if (town) { this.makeExit(exits[0], 'run'); this.exits[0].on = true; this.buildTown(); }
    else exits.forEach((e, i) => this.makeExit(e, pool[i % pool.length]));
    // motes (fireflies / pollen / snow)
    for (const mo of this.motes) this.scene.remove(mo);
    this.motes = [];
    const moteGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const moteCol = B.key === 'snow' ? 0xffffff : B.key === 'ember' ? 0xffa050 : 0xfff2a0;
    for (let i = 0; i < (B.key === 'snow' ? 140 : 60); i++) {
      const mo = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({ color: moteCol }));
      mo.userData = { noNormal: true, ph: Math.random() * 10, base: new V3(rand(Math.random, -22, 22), rand(Math.random, 0.5, B.key === 'snow' ? 8 : 3), rand(Math.random, -22, 22)) };
      this.scene.add(mo); this.motes.push(mo);
    }
    // waves
    this.waves = [];
    if (town) {
      this.cleared = true; this.waveIdx = 0; this.waves = [];
      this.ui.banner('燈谷鎮', '與旅人交談，準備出發');
      this.fade = 1;
    } else if (!title) {
      if (boss) this.waves = [{ boss: true }];
      else {
        const nW = depth === 0 ? 1 : 2 + (depth >= 5 ? 1 : 0);
        for (let w = 0; w < nW; w++) this.waves.push({ n: Math.round(3 + depth * 0.7 + w + (depth === 0 ? 0 : 1)) });
      }
      this.waveIdx = -1; this.waveDelay = 1.2; this.cleared = false;
      const stage = Math.floor(depth / 3) + 1, room = depth % 3 + 1;
      this.ui.banner(boss ? '古樹鹿王的林地' : B.name, boss ? '最終之戰' : `第 ${stage} 區 · 第 ${room} 間`);
      this.fade = 1;
    } else { this.cleared = true; this.waveIdx = 0; }
    p.y = 0; p.vy = 0; p.air = false; p.climbing = false; p.stamina = 100; p.lastLow.set(p.pos.x, 0, p.pos.z);
    this.world.computeFlow(p.pos.x, p.pos.z);
    this.musicKey = title ? 'title' : town ? 'town' : boss ? 'boss' : B.key; this.audio.setMusic(this.musicKey, 0);
  }

  makeExit(e, type) {
    const g = buildArch(this.biome);
    g.position.set(e.x, 0, e.z);
    const toC = Math.atan2(-e.x, -e.z); g.rotation.y = toC;
    const col = { item: 0xffd85a, boon: 0xc08cff, heal: 0xff6b6b, run: 0x6fe0d0 }[type];
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.2), new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(col) }, uOn: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: decalVS,
      fragmentShader: `uniform float uT, uOn; uniform vec3 uC; varying vec2 vUv;
        void main(){ vec2 p=vUv-vec2(0.5,0.45); p.x*=1.2; float d=length(p); float a=atan(p.y,p.x);
          float sw = sin(a*3.0 + d*18.0 - uT*4.0)*0.5+0.5; float m = 1.0-smoothstep(0.42,0.5,d);
          vec3 c = mix(uC, vec3(1.0), sw*0.5*(1.0-d*1.5)); gl_FragColor=vec4(c, m*uOn*(0.55+sw*0.35)); }`,
    }));
    disc.position.y = 1.15; disc.userData.noNormal = true;
    g.add(disc);
    let icon;
    if (type === 'item') icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: col }));
    else if (type === 'boon') icon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: col }));
    else icon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), new THREE.MeshBasicMaterial({ color: col }));
    icon.position.y = 3.6; g.add(icon);
    this.scene.add(g);
    this.exits.push({ g, disc, icon, type, x: e.x, z: e.z, on: false });
  }

  spawnWave() {
    const wv = this.waves[this.waveIdx];
    const p = this.player;
    if (wv.boss) { this.spawnEnemy('stag', this.world.randomWalkable(this.rng, p.pos, 9), false); return; }
    const d = this.depth;
    const pool = ['slime', 'slime', 'thorn'];
    if (d >= 1) pool.push('boar');
    if (d >= 2) pool.push('thorn');
    if (d >= 3) pool.push('moth', 'boar');
    if (d >= 6) pool.push('moth');
    for (let i = 0; i < wv.n; i++) {
      const t = pick(this.rng, pool);
      const pos = this.world.randomWalkable(this.rng, p.pos, 7);
      const elite = this.rng() < 0.06 + d * 0.025;
      // warning puff, then spawn
      this.addDecal('circle', pos.x, pos.z, 0.9, 0xfff2c0, 0.7, null, () => this.spawnEnemy(t, pos, elite), 2);
    }
  }

  spawnEnemy(type, pos, elite) {
    const d = this.depth, scale = 1 + d * 0.22;
    const DEF = {
      slime: { hp: 30, spd: 2.7, dmg: 9, r: 0.45, build: () => buildSlime(pick(this.rng, [0x7fc35a, 0x9bd06a, 0x6fb86a])) },
      thorn: { hp: 26, spd: 2.2, dmg: 10, r: 0.4, build: buildThorn },
      boar: { hp: 58, spd: 2.6, dmg: 16, r: 0.55, build: buildBoar },
      moth: { hp: 36, spd: 3.0, dmg: 14, r: 0.45, build: buildMoth },
      stag: { hp: 1100, spd: 2.4, dmg: 18, r: 1.2, build: buildStag },
    }[type];
    const m = DEF.build();
    const s = elite ? 1.35 : 1;
    m.root.scale.setScalar(s);
    this.scene.add(m.root);
    const e = {
      type, m, pos: new V3(pos.x, 0, pos.z), vel: new V3(), knock: new V3(), facing: Math.random() * 6,
      hp: DEF.hp * scale * (elite ? 2.6 : 1) * (type === 'stag' ? 1 / scale * 1.0 : 1), dmg: DEF.dmg * (1 + d * 0.12) * (elite ? 1.3 : 1),
      spd: DEF.spd * (elite ? 1.15 : 1), r: DEF.r * s, state: 'move', t: 0, cd: 1 + Math.random() * 1.5, stun: 0, slow: 0, flash: 0, elite, ph: Math.random() * 10,
      hitCd: 0,
    };
    e.maxHp = e.hp;
    if (type === 'stag') { e.phase = 1; e.cd = 2; this.boss = e; this.ui.bossBar(true, '古樹鹿王 · 歐爾德'); }
    if (elite) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 16), new THREE.MeshBasicMaterial({ color: 0xffd85a, transparent: true, opacity: 0.8, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.userData.noNormal = true; m.root.add(ring);
    }
    this.puffs.burst(e.pos.x, 0.3, e.pos.z, 8, { c: 0xffffff, s: 0.35, speed: 2, up: 1, g: -0.5, life: 0.7, grow: 1.5, drag: 3 });
    this.enemies.push(e);
    return e;
  }

  // ---------------- combat ----------------
  rollDamage(mult, fire = false) {
    const s = this.player.stats;
    let dmg = (s.baseDmg + s.addFire) * (1 + s.dmgPct / 100) * mult;
    const crit = Math.random() * 100 < s.crit;
    if (crit) dmg *= s.critMult / 100;
    return { dmg: Math.round(dmg * (0.9 + Math.random() * 0.2)), crit, fire };
  }
  hitEnemy(e, hit, kx = 0, kz = 0, opts = {}) {
    if (e.dead) return;
    e.hp -= hit.dmg; e.flash = 0.12; this.audio.sfx(hit.crit ? 'crit' : 'hit');
    const kb = e.type === 'stag' ? 0.15 : 1;
    e.knock.x += kx * kb; e.knock.z += kz * kb;
    if (opts.stun && e.type !== 'stag') e.stun = Math.max(e.stun, opts.stun);
    this.player.dmgDealt += hit.dmg;
    this.ui.dmgNum(e.pos.x, 1.2 * e.m.root.scale.x + (e.type === 'stag' ? 2.5 : 0), e.pos.z, hit.dmg, hit.crit ? 'crit' : hit.fire ? 'fire' : '');
    this.fx.burst(e.pos.x, 0.6, e.pos.z, hit.crit ? 8 : 4, { c: hit.fire ? [0xffb040, 0xff7030] : [0xffffff, 0xfff2b0], s: 0.1, speed: 5, up: 3, life: 0.35 });
    if (this.player.stats.lifeOnHit) this.heal(this.player.stats.lifeOnHit, false);
    if (opts.hitstop) this.hitstop = Math.max(this.hitstop, opts.hitstop);
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e) {
    e.dead = true; this.audio.sfx(e.type === 'stag' ? 'bossDie' : 'enemyDie');
    this.scene.remove(e.m.root);
    const col = { slime: [0x7fc35a, 0xb5e080], thorn: [0x8a5a3b, 0x6aa84a], boar: [0x9a6a4a, 0x5a3b2c], moth: [0xb48ae0, 0xffd27a], stag: [0xffb050, 0xe8dcc8] }[e.type];
    this.puffs.burst(e.pos.x, 0.4, e.pos.z, e.type === 'stag' ? 40 : 10, { c: col, s: 0.22, speed: 4, up: 4, life: 0.8 });
    this.puffs.burst(e.pos.x, 0.3, e.pos.z, 6, { c: 0xffffff, s: 0.4, speed: 1.5, up: 1, g: -1, life: 0.8, grow: 1.4, drag: 3 });
    this.shake = Math.max(this.shake, e.type === 'stag' ? 1 : 0.18);
    const p = this.player; p.kills++;
    p.flask.prog += e.elite ? 1 : 0.25;
    while (p.flask.prog >= 1 && p.flask.charges < p.flask.max) { p.flask.prog -= 1; p.flask.charges++; }
    if (p.flask.charges >= p.flask.max) p.flask.prog = 0;
    if (this.has('feast')) this.heal(4 * p.boons.filter(b => b === 'feast').length, false);
    // drops
    const r = Math.random();
    const dropChance = e.elite ? 1 : e.type === 'stag' ? 1 : 0.075;
    if (r < dropChance) this.dropItem(e.pos.x, e.pos.z, makeItem(Math.random, this.depth, e.type === 'stag' ? 3 : e.elite ? (Math.random() < 0.3 ? 3 : 2) : null));
    if (Math.random() < 0.16) this.dropOrb(e.pos.x, e.pos.z);
    if (e.type === 'stag') { this.boss = null; this.ui.bossBar(false); setTimeout(() => this.victory(), 2500); }
  }
  heal(v, show = true) {
    const p = this.player; const before = p.hp;
    p.hp = Math.min(p.stats.maxHp, p.hp + v);
    if (show && p.hp > before) this.ui.dmgNum(p.pos.x, 1.6, p.pos.z, `+${Math.round(p.hp - before)}`, 'heal');
  }
  hurtPlayer(dmg, src) {
    const p = this.player;
    if (p.iframes > 0 || p.roll > 0 || this.state !== 'play' || this.depth < 0) return;
    const air = p.y - this.world.gh(p.pos.x, p.pos.z);
    if (air > 0.8 && !p.gliding) return; // jumping dodges ground attacks
    if (src && Math.abs(src.y - p.y) > 1.7 && air <= 0.8) return; // different height level
    this.audio.sfx('hurt');
    dmg = Math.round(dmg * (1 - p.stats.armor / 100));
    p.hp -= dmg; p.iframes = 0.6;
    this.hurtFlash = 0.5; this.shake = Math.max(this.shake, 0.35); this.hitstop = 0.06;
    this.ui.dmgNum(p.pos.x, 1.5, p.pos.z, dmg, 'hurt');
    this.fx.burst(p.pos.x, 0.6, p.pos.z, 8, { c: [0xff5a5a, 0xffffff], s: 0.1, speed: 4, life: 0.4 });
    if (this.has('bramble')) for (const e of this.enemies) if (!e.dead && e.pos.distanceTo(p.pos) < 2.5) this.hitEnemy(e, { dmg: 20, crit: false });
    if (src) { tmp3.subVectors(p.pos, src).setY(0).normalize(); p.vel.addScaledVector(tmp3, 6); }
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }
  die() {
    this.state = 'dead'; this.audio.sfx('dead'); this.audio.setMusic('title', 0);
    this.puffs.burst(this.player.pos.x, 0.5, this.player.pos.z, 20, { c: [0x2f8a7e, 0xd9543a, 0xffd36e], s: 0.2, speed: 4, life: 1 });
    this.player.m.root.visible = false;
    setTimeout(() => this.ui.showDead(this), 900);
  }
  victory() { this.audio.sfx('win'); this.state = 'win'; this.ui.showWin(this); }

  dropItem(x, z, item) {
    const g = new THREE.Group();
    const R = RARITY[item.rarity]; this.audio.sfx('drop' + item.rarity);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: R.beam }));
    gem.position.y = 0.5; g.add(gem);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, item.rarity >= 2 ? 6 : 2.5, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: R.beam, transparent: true, opacity: item.rarity >= 2 ? 0.45 : 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = item.rarity >= 2 ? 3 : 1.25; beam.userData.noNormal = true; g.add(beam);
    g.position.set(x, this.world.groundY(x, z), z);
    this.scene.add(g);
    // pop out
    const a = Math.random() * 6.28;
    this.drops.push({ g, gem, item, kind: 'item', vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 5, y: 0.5 });
    if (item.rarity >= 2) this.ui.toast(`${RARITY[item.rarity].name}物品掉落！`, R.color);
  }
  dropOrb(x, z) {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff5a6a }));
    orb.position.y = 0.3; g.add(orb); g.position.set(x, this.world.groundY(x, z), z);
    this.scene.add(g);
    const a = Math.random() * 6.28;
    this.drops.push({ g, gem: orb, kind: 'orb', vx: Math.cos(a) * 2.5, vz: Math.sin(a) * 2.5, vy: 4, y: 0.3 });
  }
  nearestDrop() {
    let best = null, bd = 1.4;
    for (const d of this.drops) if (d.kind === 'item') { const dd = Math.hypot(d.g.position.x - this.player.pos.x, d.g.position.z - this.player.pos.z); if (dd < bd && Math.abs(d.g.position.y - this.player.y) < 1.6) { bd = dd; best = d; } }
    return best;
  }
  tryPickup() {
    const d = this.nearestDrop(); if (!d) return;
    const p = this.player, it = d.item;
    const old = p.equip[it.slot]; this.audio.sfx('pickup');
    p.equip[it.slot] = it;
    this.scene.remove(d.g); this.drops.splice(this.drops.indexOf(d), 1);
    if (old) this.dropItem(p.pos.x, p.pos.z, old);
    const hpFrac = p.hp / p.stats.maxHp;
    this.recalc(); p.hp = Math.max(1, Math.round(hpFrac * p.stats.maxHp));
    this.ui.toast(`裝備了 ${it.name}`, RARITY[it.rarity].color);
    this.fx.burst(p.pos.x, 0.8, p.pos.z, 12, { c: RARITY[it.rarity].beam, s: 0.1, speed: 3, up: 4, life: 0.6 });
  }

  addDecal(shape, x, z, size, color, dur, rot, onDone, shapeId) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uProg: { value: 0 }, uShape: { value: shapeId ?? (shape === 'circle' ? 0 : 1) }, uAlpha: { value: 1 } },
      vertexShader: decalVS, fragmentShader: decalFS, transparent: true, depthWrite: false,
    });
    let geo;
    if (shape === 'circle') { geo = new THREE.PlaneGeometry(size * 2, size * 2); geo.rotateX(-Math.PI / 2); }
    else { geo = new THREE.PlaneGeometry(size.w, size.l); geo.translate(0, size.l / 2, 0); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI); }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.06, z); if (rot !== null && rot !== undefined) mesh.rotation.y = rot;
    mesh.userData.noNormal = true; mesh.renderOrder = 2;
    this.scene.add(mesh);
    const d = { mesh, mat, t: 0, dur, onDone };
    this.decals.push(d);
    return d;
  }

  // ---------------- skills ----------------
  aimDir() { const p = this.player; tmp2.set(this.aim.x - p.pos.x, this.aim.z - p.pos.z); if (tmp2.lengthSq() < 0.01) tmp2.set(Math.sin(p.facing), Math.cos(p.facing)); return tmp2.normalize().clone(); }
  tryAttack() {
    const p = this.player; if (p.cds.atk > 0 || p.roll > 0) return;
    const aps = 2.0 * (1 + p.stats.atkSpd / 100);
    p.cds.atk = 1 / aps;
    const dir = this.aimDir(); p.facing = Math.atan2(dir.x, dir.y);
    p.swing = 1; p.swingT = 0.22; p.swingCount++; this.audio.sfx('swing');
    const range = 2.3 * (1 + p.stats.area / 100);
    let mult = 1;
    if (p.galeBuff) { mult += 0.6; p.galeBuff = false; }
    let hitAny = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      tmp2.set(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      const dist = tmp2.length() - e.r;
      if (dist > range) continue;
      const ang = Math.acos(clamp(tmp2.normalize().dot(dir), -1, 1));
      if (ang > 1.25 && dist > 0.4) continue;
      this.hitEnemy(e, this.rollDamage(mult), tmp2.x * 5, tmp2.y * 5, { hitstop: 0.035 });
      hitAny = true;
    }
    if (hitAny) this.shake = Math.max(this.shake, 0.12);
    this.makeSlash(p.pos, dir, range);
    if (this.has('moon') && p.swingCount % 4 === 0) this.shockRing(p.pos.x, p.pos.z, 4.5 * (1 + p.stats.area / 100), this.rollDamage(0.8), 0xd8e0ff);
    if (p.specials.has('sweepWave')) this.fireProj(p.pos, dir, { speed: 13, mult: 0.8, pierce: 99, color: 0xfff2c0, size: 0.4, wave: true, life: 0.6 });
  }
  makeSlash(pos, dir, range) {
    const geo = new THREE.RingGeometry(range * 0.45, range, 14, 1, -1.2, 2.4);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff8e0, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.55, pos.z);
    mesh.rotation.y = Math.atan2(dir.x, dir.y) - Math.PI / 2;
    mesh.userData.noNormal = true;
    this.scene.add(mesh);
    this.slashes.push({ mesh, t: 0.16, max: 0.16 });
  }
  shockRing(x, z, radius, hit, color, stun = 0) {
    const geo = new THREE.RingGeometry(0.85, 1, 32); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    mesh.position.set(x, 0.12, z); mesh.userData.noNormal = true;
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, max: 0.3, radius });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < radius + e.r) { const k = 6 / Math.max(d, 0.3); this.hitEnemy(e, hit.dmg ? { ...hit, dmg: Math.round(hit.dmg * (0.9 + Math.random() * 0.2)) } : hit, (e.pos.x - x) * k * 0.3, (e.pos.z - z) * k * 0.3, { stun }); }
    }
  }
  tryBolt() {
    const p = this.player; if (p.cds.bolt > 0 || p.roll > 0) return;
    if (p.mana < 8) { if (!this._noManaT || this.time - this._noManaT > 1) { this.ui.toast('法力不足', '#7fb2ff'); this._noManaT = this.time; } return; }
    this.audio.sfx('bolt'); p.mana -= 8; p.cds.bolt = 0.38 / (1 + p.stats.atkSpd / 200);
    const dir = this.aimDir(); p.facing = Math.atan2(dir.x, dir.y);
    const n = p.stats.proj, spread = 0.2;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * spread;
      const d = dir.clone().rotateAround(new V2(), a);
      this.fireProj(p.pos, d, { speed: 17, mult: 1.35, fire: true, color: 0xffb347, size: 0.18, chain: this.has('chain') ? 1 : 0, split: p.specials.has('splitBolt') });
    }
    p.swing = 1; p.swingT = 0.15;
  }
  fireProj(pos, dir, o) {
    const geo = o.wave ? new THREE.BoxGeometry(1.6, 0.1, 0.3) : new THREE.IcosahedronGeometry(o.size, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.color, transparent: !!o.wave, opacity: 0.8 }));
    mesh.position.set(pos.x + dir.x * 0.5, (pos.y || 0) + 0.6, pos.z + dir.y * 0.5);
    if (o.wave) { mesh.rotation.y = Math.atan2(dir.x, dir.y); mesh.userData.noNormal = true; }
    this.scene.add(mesh);
    this.projs.push({ mesh, vx: dir.x * o.speed, vz: dir.y * o.speed, life: o.life || 1.1, ...o, hit: new Set() });
  }
  tryRoll() {
    const p = this.player; if (p.cds.roll > 0 || p.roll > 0 || p.air || p.climbing) return;
    this.audio.sfx('roll');
    const mv = this.moveInput();
    if (mv.lengthSq() < 0.01) { const a = this.aimDir(); mv.set(a.x, a.y); }
    p.rollDir.set(mv.x, 0, mv.y).normalize();
    p.roll = 0.3; p.cds.roll = 0.85 * (this.has('gale') ? 0.65 : 1) * (1 - p.stats.cdr / 100);
    p.facing = Math.atan2(mv.x, mv.y);
    if (this.has('gale')) p.galeBuff = true;
    this.puffs.burst(p.pos.x, 0.15, p.pos.z, 5, { c: 0xf4ecd8, s: 0.25, speed: 1.5, up: 0.5, g: -0.5, life: 0.5, grow: 1, drag: 4 });
    if (p.specials.has('frostRoll')) {
      const d = this.addDecal('circle', p.pos.x, p.pos.z, 2.2, 0xbfe6ff, 2.0, null, null, 2);
      d.frost = true;
    }
  }
  trySlam() {
    const p = this.player; if (!p.skills.slam || p.cds.slam > 0 || p.roll > 0) return;
    this.audio.sfx('slam');
    p.cds.slam = 5 * (this.has('quake') ? 0.8 : 1) * (1 - p.stats.cdr / 100);
    const R = 3.2 * (1 + p.stats.area / 100) * (this.has('quake') ? 1.35 : 1);
    const a = this.aimDir();
    const cx = p.pos.x + a.x * 1.2, cz = p.pos.z + a.y * 1.2;
    this.shockRing(cx, cz, R, this.rollDamage(2.2), 0xffe3a0, 1.1);
    this.puffs.burst(cx, 0.2, cz, 18, { c: [this.biome.rock, this.biome.rockDark, this.biome.dirt], s: 0.25, speed: 5, up: 6, life: 0.8 });
    this.puffs.burst(cx, 0.2, cz, 10, { c: 0xfff4e0, s: 0.5, speed: 3, up: 0.5, g: -0.6, life: 0.6, grow: 1.5, drag: 4 });
    this.shake = 0.5; this.hitstop = 0.05;
    p.swing = 1; p.swingT = 0.3;
  }
  tryWisp() {
    const p = this.player; if (!p.skills.wisp || p.cds.wisp > 0) return;
    this.audio.sfx('wisp');
    p.cds.wisp = 12 * (1 - p.stats.cdr / 100);
    for (const w of p.wisps) this.scene.remove(w.mesh);
    p.wisps = [];
    const n = 3 + (this.has('swarm') ? 3 : 0) + (p.specials.has('moreWisps') ? 3 : 0);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xfff27a }));
      this.scene.add(mesh);
      p.wisps.push({ mesh, a: i / n * Math.PI * 2, cd: Math.random() * 0.5 });
    }
    p.wispT = 7 + (this.has('swarm') ? 3 : 0);
  }
  tryFlask() {
    const p = this.player; if (p.flask.charges <= 0 || p.hp >= p.stats.maxHp) return;
    p.flask.charges--; p.healOver = 1.0; this.audio.sfx('flask');
    p.healRate = p.stats.maxHp * 0.42 * (1 + 0.25 * p.boons.filter(b => b === 'flask').length);
    this.fx.burst(p.pos.x, 1, p.pos.z, 10, { c: [0xff7a8a, 0xffd0d8], s: 0.1, speed: 2, up: 3, life: 0.6, g: -1 });
  }
  takeBoon(b) {
    const p = this.player;
    p.boons.push(b.id); this.audio.sfx('boon');
    if (b.skill) p.skills[b.skill] = true;
    this.recalc();
    if (b.id === 'thick') p.hp = p.stats.maxHp;
    this.state = 'play';
    this.ui.toast(`獲得天賦：${b.name}`, '#c08cff');
    this.activateExits();
  }

  moveInput() {
    const k = this.keys; const v = new V2((k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0), (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0));
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  moveEntity(pos, dx, dz, r, y = 0) {
    // axis-separated movement on walk grid + circular obstacles
    const W = this.world;
    const nx = pos.x + dx;
    if (W.isWalk(nx + Math.sign(dx) * r * 0.6, pos.z)) pos.x = nx;
    const nz = pos.z + dz;
    if (W.isWalk(pos.x, nz + Math.sign(dz) * r * 0.6)) pos.z = nz;
    for (const o of W.obstacles) {
      if (Math.abs((o.h || 0) - y) > 1.3) continue;
      const ox = pos.x - o.x, oz = pos.z - o.z, d = Math.hypot(ox, oz), m = o.r + r * 0.7;
      if (d < m && d > 0.001) { pos.x = o.x + ox / d * m; pos.z = o.z + oz / d * m; }
    }
  }

  movePlayer(dx, dz) {
    const p = this.player, W = this.world, pos = p.pos, r = 0.35;
    const ok = (cx, cz) => {
      if (!W.isLand(cx, cz)) return false;
      const g = W.gh(cx, cz);
      if (g > p.y + 0.55 && !p.climbing) { p.wall = true; p.wallH = Math.max(p.wallH || 0, g); return false; }
      return true;
    };
    const nx = pos.x + dx; if (dx && ok(nx + Math.sign(dx) * r * 0.6, pos.z)) pos.x = nx;
    const nz = pos.z + dz; if (dz && ok(pos.x, nz + Math.sign(dz) * r * 0.6)) pos.z = nz;
    for (const o of W.obstacles) {
      if (Math.abs((o.h || 0) - p.y) > 1.3) continue;
      const ox = pos.x - o.x, oz = pos.z - o.z, d = Math.hypot(ox, oz), m = o.r + r * 0.7;
      if (d < m && d > 0.001) { pos.x = o.x + ox / d * m; pos.z = o.z + oz / d * m; }
    }
  }
  updateVertical(dt, mv) {
    const p = this.player, W = this.world;
    const g = W.gh(p.pos.x, p.pos.z);
    const want = mv.lengthSq() > 0.01;
    // grab a wall
    if (p.wall && want && p.roll <= 0 && p.stamina > 4 && !p.climbing && g - p.y <= 3.8) { p.climbing = true; p.air = false; p.vy = 0; p.climbH = p.wallH; this.audio.sfx('climb'); }
    p.gliding = false;
    if (p.climbing) {
      p.stamina -= 20 * dt; p.y += 3.4 * dt;
      p.climbT = (p.climbT || 0) + dt; if (p.climbT > 0.22) { p.climbT = 0; this.audio.sfx('climb'); }
      if (p.y >= Math.max(g, p.climbH) - 0.4) { p.climbing = false; p.air = true; p.vy = 4.2; p.vel.x *= 3; p.vel.z *= 3; }
      else if (!want || p.stamina <= 0) { p.climbing = false; p.air = true; p.vy = 0; }
    } else if (!p.air) {
      if (g >= p.y) p.y += (g - p.y) * Math.min(1, dt * 25);
      else if (p.y - g > 0.55) { p.air = true; p.vy = 0; }
      else p.y = g;
      if (p.y < g) p.y = g - (g - p.y) * 0.5;
      p.stamina = Math.min(100, p.stamina + 38 * dt);
      if (p.y < 0.7) p.lastLow.set(p.pos.x, 0, p.pos.z);
    }
    if (p.air && !p.climbing) {
      const glide = (this.keys[' '] && p.vy < 0 && p.stamina > 0 && p.roll <= 0);
      p.vy -= 24 * dt;
      if (glide) {
        if (!p.gliding0) this.audio.sfx('glide');
        p.vy = Math.max(p.vy, -1.6); p.stamina -= 10 * dt; p.gliding = true;
      }
      p.gliding0 = glide;
      const vyBefore = p.vy;
      p.y += p.vy * dt;
      if (p.y <= g) {
        p.y = g; p.air = false; p.vy = 0; p.gliding0 = false;
        if (vyBefore < -4) { this.audio.sfx('land'); this.puffs.burst(p.pos.x, p.y + 0.1, p.pos.z, 6, { c: 0xf4ecd8, s: 0.25, speed: 2, up: 0.5, g: -0.3, life: 0.45, grow: 1, drag: 3 }); }
      }
    }
    p.pos.y = p.y;
    if (p.y < -0.1 && !W.isLand(p.pos.x, p.pos.z)) { p.pos.x = p.lastLow.x; p.pos.z = p.lastLow.z; p.y = W.gh(p.pos.x, p.pos.z); }
  }
  tryJump() {
    const p = this.player;
    if (p.climbing) { p.climbing = false; p.air = true; p.vy = 6.5; this.audio.sfx('jump'); return; }
    if (p.air || p.roll > 0) return;
    p.air = true; p.vy = 8.2; this.audio.sfx('jump');
    this.puffs.burst(p.pos.x, p.y + 0.1, p.pos.z, 4, { c: 0xf4ecd8, s: 0.2, speed: 1.5, up: 0.3, g: -0.3, life: 0.35, grow: 1, drag: 3 });
  }


  // ---------------- town ----------------
  buildTown() {
    const P = this.biome, g = new THREE.Group(); this.townGroup = g; this.scene.add(g);
    const add = (o, x, z, ry = 0, obst = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; g.add(o); if (obst) this.world.obstacles.push({ x, z, r: obst, h: 0 }); return o; };
    // cobble plaza
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.4, 0.12, 20), toonMat({ color: 0xe3d3b0 }));
    plaza.position.set(0, 0.03, 0); plaza.receiveShadow = true; g.add(plaza);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.16, 20), toonMat({ color: 0xd2bf98 })); ring.position.set(0, 0.04, 0); ring.receiveShadow = true; g.add(ring);
    add(buildFountain(), 0, -1, 0, 2.0);
    const roofs = [0xd9543a, 0x3f8ab0, 0xe0a030, 0x8a5ab8, 0xd9543a, 0x58a858];
    [[-11, 3, 0.5], [11, 3, -0.5], [-10, -8, 0.3], [10, -8, -0.3], [-15, -2, 1.2], [15, -2, -1.2]].forEach(([x, z, ry], i) => {
      add(buildHouse(roofs[i], 0xf3e2c0, 3.4, 3.0), x, z, ry, 2.0);
    });
    add(buildBoard(), -4.5, 6, 0.3, 0.9);
    add(buildStall(0xd9543a), 5, 6, -0.4, 1.4);
    add(buildStall(0x3f8ab0), 8.5, 4, -0.8, 1.4);
    // bonfire-ish lantern post cluster
    for (const [x, z] of [[-6.5, 0], [6.5, 0], [-3, -5], [3, -5]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.7, 5), toonMat({ color: 0x6b4530 })); post.position.set(x, 0.85, z); post.castShadow = true; g.add(post);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd27a })); lamp.position.set(x, 1.85, z); lamp.userData.noNormal = false; g.add(lamp);
      this.world.obstacles.push({ x, z, r: 0.25, h: 0 });
    }
    // portal sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), toonMat({ color: 0xfff1d0 }));
    const ex = this.exits[0]; sign.position.set(ex.x, 3.4, ex.z); sign.rotation.y = ex.g.rotation.y; g.add(sign);
    // offline villagers
    if (!this.net.url) this.spawnBots();
  }
  spawnBots() {
    const defs = [['米糕 (鎮民)', 1, ['歡迎來到燈谷鎮！', '北邊的拱門通往燈谷，小心鹿王。', '空白鍵可以跳，按住就能滑翔喔。']],
      ['阿杏 (鎮民)', 5, ['頂著懸崖不放就能攀爬，但會耗體力。', '聽說傳奇裝備很稀有……', '多喝蜜藥瓶，少受傷。']],
      ['老燈 (鎮民)', 3, ['一個人也能走完，找朋友一起更熱鬧。', '輸入 Enter 可以聊天。', '噓……森林深處有東西在動。']]];
    defs.forEach(([name, col, lines], i) => {
      const id = 'bot' + i; const a = Math.random() * 6.28;
      const r = this.addRemote(id, name, col); r.bot = true; r.lines = lines; r.x = r.tx = Math.cos(a) * 4 + 2; r.z = r.tz = Math.sin(a) * 4 + 1; r.wait = Math.random() * 3;
      this.bots.push(id);
    });
  }
  // ---------------- multiplayer ----------------
  setupNet() {
    const n = this.net;
    n.on('status', s => { this.ui.netStatus(s); if (!s.ok && this.depth === -1 && !this.bots.length && s.reason !== 'no-server') this.spawnBots(); });
    n.on('welcome', m => { for (const h of m.history || []) this.ui.addChat(h.name, h.text, false, h.zone); this.ui.addChat('', `已連線，你的編號 #${m.id}`, true); });
    n.on('online', m => this.ui.setOnline(m.n));
    n.on('sys', m => this.ui.addChat('', m.text, true));
    n.on('chat', m => { this.ui.addChat(m.name, m.text, false, m.zone); this.audio.sfx('chat'); if (m.id === n.id) this.say('me', m.text); else if (this.remotes.has(m.id)) this.say(m.id, m.text); });
    n.on('emote', m => { if (this.remotes.has(m.id)) this.say(m.id, EMOTES[m.e % EMOTES.length]); });
    n.on('gone', m => this.removeRemote(m.id));
    n.on('snap', m => {
      const seen = new Set();
      for (const p of m.players) {
        seen.add(p.id);
        let r = this.remotes.get(p.id);
        if (r && r.col !== p.col) { this.removeRemote(p.id); r = null; }
        if (!r) { r = this.addRemote(p.id, p.name, p.col); }
        if (r.name !== p.name) { r.name = p.name; r.tag.textContent = p.name; }
        r.tx = p.x; r.ty = p.y; r.tz = p.z; r.tf = p.f; r.a = p.a;
      }
      for (const id of [...this.remotes.keys()]) if (!seen.has(id) && !String(id).startsWith('bot')) this.removeRemote(id);
    });
  }
  addRemote(id, name, col) {
    const hood = HOODS[col % HOODS.length]; const m = buildPlayer(hood[0], hood[1], 0xf0d070);
    m.root.scale.setScalar(1.25); this.scene.add(m.root);
    const tag = document.createElement('div'); tag.className = 'ptag'; tag.textContent = name;
    const bub = document.createElement('div'); bub.className = 'pbub';
    document.getElementById('tags').append(tag, bub);
    const r = { id, name, col, m, tag, bub, x: 0, y: 0, z: 0, f: 0, tx: 0, ty: 0, tz: 0, tf: 0, a: 0, walkT: 0, say: 0, init: false };
    this.remotes.set(id, r); return r;
  }
  removeRemote(id) { const r = this.remotes.get(id); if (!r) return; this.scene.remove(r.m.root); r.tag.remove(); r.bub.remove(); this.remotes.delete(id); }
  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); }
  say(id, text) {
    if (id === 'me') { this.mySay = { text, t: 4.5 }; return; }
    const r = this.remotes.get(id); if (!r) return; r.bub.textContent = text; r.say = 4.5;
  }
  sendChat(text) {
    if (!text) return;
    if (this.net.ok) this.net.send({ t: 'chat', text });
    else { this.ui.addChat(this.playerName, text, false, 'town'); this.say('me', text); }
  }
  emote(i) {
    this.audio.sfx('emote'); const e = EMOTES[i % EMOTES.length];
    this.say('me', e); this.net.send({ t: 'emote', e: i });
  }
  updateNet(dt) {
    const p = this.player, n = this.net;
    this.posT -= dt;
    if (this.posT <= 0 && this.state !== 'title') {
      this.posT = 0.1;
      const a = p.roll > 0 ? 5 : p.climbing ? 3 : p.gliding ? 4 : p.air ? 2 : p.walkT > 0 ? 1 : 0;
      n.send({ t: 'pos', zone: this.zone, x: p.pos.x, y: p.y, z: p.pos.z, f: p.facing, a });
    }
    if (this.zone !== this._lastZone) { this._lastZone = this.zone; for (const id of [...this.remotes.keys()]) if (!String(id).startsWith('bot')) this.removeRemote(id); }
    for (const r of this.remotes.values()) {
      if (r.bot) {
        r.wait -= dt;
        if (Math.hypot(r.tx - r.x, r.tz - r.z) < 0.4) {
          r.a = 0;
          if (r.wait <= 0) { r.wait = 3 + Math.random() * 5; const a = Math.random() * 6.28, d = 3 + Math.random() * 8; r.tx = Math.cos(a) * d; r.tz = Math.sin(a) * d * 0.8 + 2; if (Math.random() < 0.45) this.say(r.id, r.lines[(Math.random() * r.lines.length) | 0]); }
        } else { const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz); r.x += dx / d * 2.2 * dt; r.z += dz / d * 2.2 * dt; r.tf = Math.atan2(dx, dz); r.a = 1; if (Math.hypot(r.x, r.z + 1) < 2.3) { r.x += (r.x / 2) * dt; r.z += ((r.z + 1) / 2) * dt; } }
        r.y = 0;
        if (Math.hypot(p.pos.x - r.x, p.pos.z - r.z) < 4 && Math.random() < dt * 0.3) r.tf = Math.atan2(p.pos.x - r.x, p.pos.z - r.z);
      } else {
        const k = 1 - Math.exp(-dt * 12);
        if (!r.init) { r.x = r.tx; r.y = r.ty; r.z = r.tz; r.f = r.tf; r.init = true; }
        r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; r.f = angleLerp(r.f, r.tf, k);
      }
      const m = r.m;
      m.root.position.set(r.x, r.y, r.z); m.root.rotation.y = r.f;
      if (r.a === 1) r.walkT += dt * 11;
      const sw = Math.sin(r.walkT), moving = r.a === 1;
      m.legL.position.z = moving ? sw * 0.12 : 0; m.legR.position.z = moving ? -sw * 0.12 : 0;
      m.body.position.y = moving ? Math.abs(sw) * 0.06 : r.a === 2 ? 0.1 : r.a === 4 ? 0.3 : 0;
      m.body.rotation.x = r.a === 4 ? 0.9 : r.a === 5 ? (this.time * 20) % 6.28 : r.a === 3 ? -0.35 : moving ? 0.12 : 0;
      // labels
      r.say = Math.max(0, r.say - dt);
      const [sx, sy] = this.ui.screenPos(r.x, r.y + 2.0, r.z);
      r.tag.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-100%)`;
      r.bub.style.transform = `translate(${sx}px, ${sy - 22}px) translate(-50%,-100%)`; r.bub.style.opacity = r.say > 0 ? 1 : 0;
    }
    // own label + bubble
    const me = document.getElementById('myTag'), mb = document.getElementById('myBub');
    if (me) {
      me.textContent = this.playerName; const [sx, sy] = this.ui.screenPos(p.pos.x, p.y + 2.0, p.pos.z);
      me.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-100%)`; me.style.display = this.state === 'title' ? 'none' : 'block';
      if (this.mySay) { this.mySay.t -= dt; mb.textContent = this.mySay.text; mb.style.transform = `translate(${sx}px, ${sy - 22}px) translate(-50%,-100%)`; mb.style.opacity = this.mySay.t > 0 ? 1 : 0; }
    }
  }

  // ---------------- update ----------------
  update(dt) {
    this.time += dt;
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.08; }
    const p = this.player, S = p.stats;
    // aim
    const ndc = new V2(this.mouse.x / innerWidth * 2 - 1, -(this.mouse.y / innerHeight) * 2 + 1);
    this.plane.constant = -p.y; this.ray.setFromCamera(ndc, this.camera); this.ray.ray.intersectPlane(this.plane, this.aim);

    if (this.state === 'play') {
      for (const k in p.cds) p.cds[k] = Math.max(0, p.cds[k] - dt);
      p.iframes = Math.max(0, p.iframes - dt);
      p.mana = Math.min(S.mana, p.mana + dt * 7);
      if (S.regen) this.heal(S.regen * dt, false);
      if (p.specials.has('mossRegen')) this.heal(S.maxHp * 0.02 * dt, false);
      if (p.healOver > 0) { p.healOver -= dt; this.heal(p.healRate * dt, false); }
      if (!this.ui.invOpen) {
        if (this.mouse.l) this.tryAttack();
        if (this.mouse.r) this.tryBolt();
      }
      // movement (3D: walk, jump, climb walls, glide)
      const mv = this.moveInput();
      const spd = 5.4 * (1 + S.moveSpd / 100);
      p.wall = false; p.wallH = 0;
      if (p.roll > 0) {
        p.roll -= dt;
        this.movePlayer(p.rollDir.x * 13 * dt, p.rollDir.z * 13 * dt);
        if (Math.random() < 0.5) this.puffs.emit(p.pos.x, p.y + 0.1, p.pos.z, { c: 0xf4ecd8, s: 0.18, g: -0.4, life: 0.4, grow: 1 });
      } else {
        const attacking = p.swingT > 0;
        const f = (attacking ? 0.55 : 1) * (p.climbing ? 0.22 : 1) * (p.gliding ? 1.35 : 1);
        p.vel.x = lerp(p.vel.x, mv.x * spd * f, 1 - Math.exp(-dt * (p.air ? 6 : 14)));
        p.vel.z = lerp(p.vel.z, mv.y * spd * f, 1 - Math.exp(-dt * (p.air ? 6 : 14)));
        this.movePlayer(p.vel.x * dt, p.vel.z * dt);
        if (mv.lengthSq() > 0.01 && !attacking) p.facing = angleLerp(p.facing, Math.atan2(mv.x, mv.y), 1 - Math.exp(-dt * 14));
        if (mv.lengthSq() > 0.01 && !p.air && !p.climbing) {
          p.walkT += dt * 11; p.stepT += dt * 11;
          if (p.stepT > Math.PI) { p.stepT -= Math.PI; this.audio.sfx('step'); }
          if (Math.random() < dt * 4) this.puffs.emit(p.pos.x, p.y + 0.05, p.pos.z, { c: 0xf4ecd8, s: 0.12, g: -0.3, life: 0.35, grow: 1 });
        } else p.walkT = 0;
      }
      this.updateVertical(dt, mv);
      p.swingT = Math.max(0, p.swingT - dt);
      // wisps
      if (p.wispT > 0) {
        p.wispT -= dt;
        p.wisps.forEach((w, i) => {
          w.a += dt * 2.6;
          w.mesh.position.set(p.pos.x + Math.cos(w.a) * 1.4, 1 + Math.sin(this.time * 4 + i) * 0.2, p.pos.z + Math.sin(w.a) * 1.4);
          w.cd -= dt;
          if (w.cd <= 0) {
            let best = null, bd = 7;
            for (const e of this.enemies) if (!e.dead) { const d = e.pos.distanceTo(w.mesh.position); if (d < bd) { bd = d; best = e; } }
            if (best) {
              w.cd = 0.55;
              const d = new V2(best.pos.x - w.mesh.position.x, best.pos.z - w.mesh.position.z).normalize();
              this.fireProj(w.mesh.position, d, { speed: 14, mult: 0.45, color: 0xfff27a, size: 0.09, homing: best, life: 1 });
            }
          }
        });
        if (p.wispT <= 0) { for (const w of p.wisps) this.scene.remove(w.mesh); p.wisps = []; }
      }
      // waves
      if (!this.cleared) {
        const alive = this.enemies.some(e => !e.dead) || this.decals.some(d => d.onDone);
        if (!alive) {
          this.waveDelay -= dt;
          if (this.waveDelay <= 0) {
            this.waveIdx++;
            if (this.waveIdx < this.waves.length) { this.spawnWave(); this.waveDelay = 0.8; }
            else this.roomCleared();
          }
        }
      }
      // exits
      for (const x of this.exits) if (x.on && Math.hypot(p.pos.x - x.x, p.pos.z - x.z) < 1.3) { this.goExit(x); break; }
      this.ui.exitHint(this);
      // flow field
      this.flowTimer -= dt;
      if (this.flowTimer <= 0) { this.world.computeFlow(p.lastLow.x, p.lastLow.z); this.flowTimer = 0.25; }
    }

    if (this.state === 'play' && this.musicKey) this.audio.setMusic(this.musicKey, this.enemies.length ? 1 : 0);
    this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateMisc(dt);
    this.animatePlayer(dt);
    this.updateCamera(dt);
    this.fx.update(dt); this.puffs.update(dt);
    this.updateNet(dt);
    this.ui.update(this);
  }

  roomCleared() {
    this.cleared = true;
    this.ui.toast('區域已淨化 ✦', '#fff2c0');
    const p = this.player;
    // reward of this room
    if (this.reward === 'item') this.dropItem(p.pos.x + 1, p.pos.z, makeItem(this.rng, this.depth + 1, this.rng() < 0.2 ? 3 : 2));
    if (this.reward === 'heal') { this.heal(p.stats.maxHp * 0.5); p.flask.charges = p.flask.max; this.ui.toast('生命與藥瓶已回復', '#ff8a8a'); }
    if (this.reward === 'boon' || this.depth === 0) {
      this.state = 'boon';
      setTimeout(() => this.ui.showBoons(this, rollBoons(this.rng, p.boons, p.skills)), 500);
      return;
    }
    this.activateExits();
  }
  activateExits() {
    this.audio.sfx('exit');
    for (const x of this.exits) { x.on = true; this.puffs.burst(x.x, 1.2, x.z, 12, { c: 0xffffff, s: 0.3, speed: 2, up: 1, g: -0.5, life: 0.8, grow: 1.4, drag: 3 }); }
  }
  goExit(x) {
    if (this.state !== 'play') return;
    if (x.type === 'run') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.startRun()); return; }
    this.state = 'transition'; this.audio.sfx('warp');
    this.ui.wipe(() => { this.state = 'play'; this.loadRoom(this.depth + 1, x.type); });
  }

  updateEnemies(dt) {
    const p = this.player, W = this.world;
    const playing = this.state === 'play';
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt); e.hitCd = Math.max(0, e.hitCd - dt);
      e.slow = Math.max(0, e.slow - dt);
      const toP = tmp2.set(p.pos.x - e.pos.x, p.pos.z - e.pos.z); const dist = toP.length();
      const dirP = toP.clone().normalize();
      let mvx = 0, mvz = 0;
      const spd = e.spd * (e.slow > 0 ? 0.45 : 1);
      // knockback
      if (e.knock.lengthSq() > 0.01) { this.moveEntity(e.pos, e.knock.x * dt, e.knock.z * dt, e.r); e.knock.multiplyScalar(Math.exp(-dt * 9)); }
      const follow = (s = 1) => {
        const fd = new V2();
        if (dist > 1.5 && W.flowDir(e.pos.x, e.pos.z, fd)) { mvx = fd.x * spd * s; mvz = fd.y * spd * s; }
        else { mvx = dirP.x * spd * s; mvz = dirP.y * spd * s; }
      };
      if (e.stun > 0 || !playing) {
        // idle
      } else if (e.type === 'slime') {
        follow(0.6 + 0.6 * Math.max(0, Math.sin(e.t * 6 + e.ph)));
        e.m.body.position.y = Math.abs(Math.sin(e.t * 6 + e.ph)) * 0.25;
        const sq = 1 + Math.sin(e.t * 12 + e.ph) * 0.08;
        e.m.body.scale.set(sq, 2 - sq, sq);
      } else if (e.type === 'thorn') {
        e.cd -= dt;
        if (e.state === 'move') {
          if (dist > 8) follow(); else if (dist < 4.5) { mvx = -dirP.x * spd; mvz = -dirP.y * spd; }
          else { mvx = -dirP.y * spd * 0.4 * Math.sign(Math.sin(e.ph)); mvz = dirP.x * spd * 0.4 * Math.sign(Math.sin(e.ph)); }
          if (e.cd <= 0 && dist < 12) { e.state = 'aim'; e.t = 0; }
        } else if (e.state === 'aim') {
          const s = 1 + Math.sin(e.t * 40) * 0.08; e.m.body.scale.set(s, s, s);
          e.flash = Math.max(e.flash, 0.05);
          if (e.t > 0.55) {
            const n = e.elite ? 3 : 1;
            for (let i = 0; i < n; i++) {
              const d = dirP.clone().rotateAround(new V2(), (i - (n - 1) / 2) * 0.3);
              this.fireEnemyProj(e.pos, d, 8.5, e.dmg, 0x9bd85a);
            }
            e.state = 'move'; e.cd = 2.0 + Math.random(); e.m.body.scale.set(1, 1, 1);
          }
        }
      } else if (e.type === 'boar') {
        e.cd -= dt;
        if (e.state === 'move') {
          follow(0.8);
          if (dist < 7.5 && e.cd <= 0) {
            e.state = 'wind'; e.t = 0; e.cdir = dirP.clone();
            e.dec = this.addDecal('rect', e.pos.x, e.pos.z, { w: 1.2 * e.m.root.scale.x, l: 9 }, 0xff5040, 0.75, Math.atan2(e.cdir.x, e.cdir.y));
          }
        } else if (e.state === 'wind') {
          e.m.body.position.x = Math.sin(e.t * 60) * 0.05;
          if (e.t > 0.75) { e.state = 'charge'; e.t = 0; }
        } else if (e.state === 'charge') {
          const before = e.pos.clone();
          this.moveEntity(e.pos, e.cdir.x * 14 * dt, e.cdir.y * 14 * dt, e.r);
          if (Math.random() < 0.6) this.puffs.emit(e.pos.x, 0.1, e.pos.z, { c: 0xf4ecd8, s: 0.25, g: -0.3, life: 0.4, grow: 1 });
          if (e.t > 0.6 || before.distanceTo(e.pos) < 0.01) { e.state = 'rest'; e.t = 0; }
          if (dist < e.r + 0.5) this.hurtPlayer(e.dmg, e.pos);
        } else if (e.state === 'rest') { if (e.t > 0.9) { e.state = 'move'; e.cd = 1.5 + Math.random() * 1.5; } }
        if (e.state === 'move' || e.state === 'wind') e.facing = angleLerp(e.facing, Math.atan2(dirP.x, dirP.y), 1 - Math.exp(-dt * 8));
        else if (e.state === 'charge') e.facing = Math.atan2(e.cdir.x, e.cdir.y);
      } else if (e.type === 'moth') {
        e.cd -= dt;
        if (dist > 7) follow(); else if (dist < 5) { mvx = -dirP.x * spd; mvz = -dirP.y * spd; }
        else { mvx = -dirP.y * spd * 0.6; mvz = dirP.x * spd * 0.6; }
        if (e.cd <= 0 && dist < 11) {
          e.cd = 3.4 + Math.random();
          const n = e.elite ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const ox = i === 0 ? p.vel.x * 0.5 : (Math.random() - 0.5) * 5, oz = i === 0 ? p.vel.z * 0.5 : (Math.random() - 0.5) * 5;
            const cx = p.pos.x + ox, cz = p.pos.z + oz;
            this.addDecal('circle', cx, cz, 1.3, 0xc070ff, 1.15, null, () => {
              this.puffs.burst(cx, 0.3, cz, 10, { c: [0xc08cff, 0xffd27a], s: 0.18, speed: 3, up: 4, life: 0.5 });
              if (Math.hypot(p.pos.x - cx, p.pos.z - cz) < 1.4) this.hurtPlayer(e.dmg, new V3(cx, 0, cz));
            });
          }
        }
        e.m.body.position.y = 0.9 + Math.sin(e.t * 3 + e.ph) * 0.15;
        const fl = Math.sin(e.t * 22) * 0.6;
        e.m.wings[0].rotation.z = fl; e.m.wings[1].rotation.z = -fl;
      } else if (e.type === 'stag') this.updateBoss(e, dt, dist, dirP, follow, (x, z) => { mvx = x; mvz = z; });

      if (mvx || mvz) {
        // separation from other enemies
        for (const o of this.enemies) if (o !== e && !o.dead) {
          const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d = Math.hypot(ox, oz), m = e.r + o.r;
          if (d < m && d > 0.01) { mvx += ox / d * 2; mvz += oz / d * 2; }
        }
        this.moveEntity(e.pos, mvx * dt, mvz * dt, e.r);
        if (e.type !== 'boar') e.facing = angleLerp(e.facing, Math.atan2(mvx, mvz), 1 - Math.exp(-dt * 8));
      }
      // contact damage
      if (playing && e.type !== 'boar' && dist < e.r + 0.35 && e.hitCd <= 0 && e.stun <= 0) { this.hurtPlayer(e.dmg * (e.type === 'stag' ? 0.8 : 1), e.pos); e.hitCd = 0.8; }
      // visuals
      e.pos.y = W.groundY(e.pos.x, e.pos.z);
      e.m.root.position.set(e.pos.x, e.pos.y, e.pos.z);
      e.m.root.rotation.y = e.facing;
      const fl = e.flash > 0 ? 1 : 0;
      e.m.mat.emissive.setRGB(fl * 0.9, fl * 0.85, fl * 0.8);
      if (e.stun > 0) e.m.body.rotation.z = Math.sin(this.time * 20) * 0.1; else e.m.body.rotation.z = 0;
    }
    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.boss) this.ui.bossBar(true, null, this.boss.hp / this.boss.maxHp);
  }

  updateBoss(e, dt, dist, dirP, follow, setMv) {
    const p = this.player;
    e.cd -= dt;
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; this.ui.toast('鹿王憤怒了！', '#ff9a4a'); this.shake = 0.8; e.spd *= 1.25; }
    const fast = e.phase === 2 ? 0.75 : 1;
    if (e.state === 'move') {
      follow(0.8);
      e.m.body.position.y = Math.abs(Math.sin(e.t * 5)) * 0.1;
      if (e.cd <= 0) {
        const moves = ['charge', 'burst', 'roots', dist < 4 ? 'stomp' : 'charge'];
        if (this.enemies.length < 4) moves.push('summon');
        e.state = pick(Math.random, moves); e.t = 0; e.step = 0;
      }
    } else if (e.state === 'charge') {
      if (e.step === 0) { e.cdir = dirP.clone(); this.addDecal('rect', e.pos.x, e.pos.z, { w: 2.4, l: 14 }, 0xff5040, 0.9 * fast, Math.atan2(e.cdir.x, e.cdir.y)); e.step = 1; e.facing = Math.atan2(e.cdir.x, e.cdir.y); }
      if (e.step === 1 && e.t > 0.9 * fast) { e.step = 2; e.t = 0; }
      if (e.step === 2) {
        const b = e.pos.clone();
        this.moveEntity(e.pos, e.cdir.x * 16 * dt, e.cdir.y * 16 * dt, 1);
        if (Math.random() < 0.8) this.puffs.emit(e.pos.x + (Math.random() - 0.5), 0.1, e.pos.z, { c: 0xf4ecd8, s: 0.4, g: -0.3, life: 0.5, grow: 1 });
        if (dist < 1.8) this.hurtPlayer(e.dmg * 1.3, e.pos);
        if (e.t > 0.85 || b.distanceTo(e.pos) < 0.01) { this.shake = 0.4; e.charges = (e.charges || 0) + 1; if (e.charges < (e.phase === 2 ? 3 : 2)) { e.step = 0; e.t = 0; } else { e.charges = 0; e.state = 'move'; e.cd = 1.6 * fast; } }
      }
    } else if (e.state === 'burst') {
      e.flash = Math.max(e.flash, Math.sin(e.t * 30) > 0 ? 0.03 : 0);
      if (e.t > 0.7 * fast && e.step < (e.phase === 2 ? 3 : 2)) {
        e.t = 0.2; e.step++;
        const n = 14, off = e.step * 0.2;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + off; this.fireEnemyProj(e.pos, new V2(Math.cos(a), Math.sin(a)), 6.5, e.dmg * 0.8, 0xffa040, 0.25); }
        this.shake = 0.2;
      }
      if (e.step >= (e.phase === 2 ? 3 : 2) && e.t > 0.8) { e.state = 'move'; e.cd = 1.4 * fast; }
    } else if (e.state === 'roots') {
      if (e.step === 0) {
        e.step = 1;
        for (let k = 0; k < (e.phase === 2 ? 3 : 2); k++) {
          const a = Math.atan2(dirP.x, dirP.y) + (k - 0.5) * 0.5 * (e.phase === 2 ? 1.4 : 1);
          for (let i = 1; i <= 7; i++) {
            const cx = e.pos.x + Math.sin(a) * i * 1.6, cz = e.pos.z + Math.cos(a) * i * 1.6;
            this.addDecal('circle', cx, cz, 0.9, 0xff7040, 0.6 + i * 0.12, null, () => {
              this.puffs.burst(cx, 0.2, cz, 6, { c: [0x6e4a33, 0x6aa84a], s: 0.25, speed: 2, up: 6, life: 0.6 });
              if (Math.hypot(p.pos.x - cx, p.pos.z - cz) < 1) this.hurtPlayer(e.dmg, new V3(cx, 0, cz));
            });
          }
        }
      }
      if (e.t > 1.6) { e.state = 'move'; e.cd = 1.2 * fast; }
    } else if (e.state === 'stomp') {
      if (e.step === 0) { e.step = 1; this.addDecal('circle', e.pos.x, e.pos.z, 4, 0xff5040, 0.8 * fast); }
      e.m.body.position.y = Math.min(1, e.t * 2) * 0.8;
      if (e.t > 0.8 * fast && e.step === 1) {
        e.step = 2; e.m.body.position.y = 0; this.shake = 0.7;
        this.puffs.burst(e.pos.x, 0.2, e.pos.z, 20, { c: 0xf4ecd8, s: 0.5, speed: 5, up: 1, g: -0.4, life: 0.7, grow: 1.4, drag: 3 });
        if (dist < 4.2) this.hurtPlayer(e.dmg * 1.4, e.pos);
      }
      if (e.t > 1.4) { e.state = 'move'; e.cd = 1.2 * fast; }
    } else if (e.state === 'summon') {
      if (e.step === 0) { e.step = 1; for (let i = 0; i < 3; i++) { const pos = this.world.randomWalkable(Math.random, p.pos, 4); this.addDecal('circle', pos.x, pos.z, 0.9, 0xfff2c0, 0.8, null, () => this.spawnEnemy(Math.random() < 0.5 ? 'slime' : 'thorn', pos, false), 2); } }
      if (e.t > 1) { e.state = 'move'; e.cd = 1.5 * fast; }
    }
  }

  fireEnemyProj(pos, dir, speed, dmg, color, size = 0.2) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(pos.x + dir.x * 0.6, (pos.y || 0) + 0.6, pos.z + dir.y * 0.6);
    this.scene.add(mesh);
    this.eprojs.push({ mesh, vx: dir.x * speed, vz: dir.y * speed, life: 3.2, dmg });
  }

  updateProjs(dt) {
    const p = this.player;
    for (const pr of this.projs) {
      if (pr.homing && !pr.homing.dead) {
        const d = new V2(pr.homing.pos.x - pr.mesh.position.x, pr.homing.pos.z - pr.mesh.position.z).normalize();
        const sp = Math.hypot(pr.vx, pr.vz);
        pr.vx = lerp(pr.vx, d.x * sp, 1 - Math.exp(-dt * 8)); pr.vz = lerp(pr.vz, d.y * sp, 1 - Math.exp(-dt * 8));
      }
      pr.mesh.position.x += pr.vx * dt; pr.mesh.position.z += pr.vz * dt; pr.life -= dt;
      pr.mesh.rotation.x += dt * 10; if (!pr.wave) pr.mesh.rotation.y += dt * 7;
      if (pr.fire && Math.random() < 0.7) this.fx.emit(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, { c: Math.random() < 0.5 ? 0xffd27a : 0xff7a30, s: 0.09, g: -1, life: 0.25 });
      for (const e of this.enemies) {
        if (e.dead || pr.hit.has(e)) continue;
        const d = Math.hypot(e.pos.x - pr.mesh.position.x, e.pos.z - pr.mesh.position.z);
        if (d < e.r + (pr.wave ? 0.8 : 0.25) && Math.abs(pr.mesh.position.y - (e.pos.y + 0.6)) < 2.4) {
          pr.hit.add(e);
          const n = new V2(pr.vx, pr.vz).normalize();
          this.hitEnemy(e, this.rollDamage(pr.mult, pr.fire), n.x * 3, n.y * 3, { hitstop: 0.02 });
          if (pr.split) {
            for (let i = 0; i < 3; i++) { const a = Math.atan2(n.y, n.x) + (i - 1) * 0.7; this.fireProj(pr.mesh.position, new V2(Math.cos(a), Math.sin(a)), { speed: 12, mult: 0.45, fire: true, color: 0xffd27a, size: 0.1, life: 0.5, hit0: e }); }
            this.projs[this.projs.length - 1].hit?.add(e);
          }
          if (pr.chain > 0) {
            let best = null, bd = 7;
            for (const o of this.enemies) if (!o.dead && !pr.hit.has(o)) { const dd = o.pos.distanceTo(e.pos); if (dd < bd) { bd = dd; best = o; } }
            if (best) { pr.chain--; const nd = new V2(best.pos.x - e.pos.x, best.pos.z - e.pos.z).normalize(); const sp = Math.hypot(pr.vx, pr.vz); pr.vx = nd.x * sp; pr.vz = nd.y * sp; pr.life = 0.8; continue; }
          }
          if ((pr.pierce || 0) <= 0) { pr.life = 0; break; } else pr.pierce--;
        }
      }
      if (pr.hit0) { pr.hit.add(pr.hit0); pr.hit0 = null; }
      if (!pr.wave && this.world.groundY(pr.mesh.position.x, pr.mesh.position.z) > pr.mesh.position.y - 0.05) pr.life = 0;
      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        if (pr.fire) this.fx.burst(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, 5, { c: [0xffd27a, 0xff7a30], s: 0.08, speed: 3, up: 2, life: 0.3 });
      }
    }
    this.projs = this.projs.filter(pr => pr.life > 0);
    for (const pr of this.eprojs) {
      pr.mesh.position.x += pr.vx * dt; pr.mesh.position.z += pr.vz * dt; pr.life -= dt;
      pr.mesh.rotation.y += dt * 8;
      if (this.state === 'play' && Math.hypot(p.pos.x - pr.mesh.position.x, p.pos.z - pr.mesh.position.z) < 0.45 && Math.abs(pr.mesh.position.y - (p.y + 0.6)) < 1.3) {
        if (p.roll <= 0 && p.iframes <= 0) { this.hurtPlayer(pr.dmg, pr.mesh.position); pr.life = 0; }
      }
      if (this.world.groundY(pr.mesh.position.x, pr.mesh.position.z) > pr.mesh.position.y - 0.1) pr.life = 0; // hit cliffs
      if (pr.life <= 0) { this.scene.remove(pr.mesh); this.fx.burst(pr.mesh.position.x, 0.6, pr.mesh.position.z, 4, { c: pr.mesh.material.color.getHex(), s: 0.08, speed: 2, life: 0.3 }); }
    }
    this.eprojs = this.eprojs.filter(pr => pr.life > 0);
  }

  updateMisc(dt) {
    const p = this.player;
    for (const d of this.decals) {
      d.t += dt; d.mat.uniforms.uProg.value = Math.min(1, d.t / d.dur);
      if (d.frost) { d.mat.uniforms.uAlpha.value = 1 - d.t / d.dur; for (const e of this.enemies) if (e.pos.distanceTo(d.mesh.position) < 2.4) e.slow = 0.5; }
      if (d.t >= d.dur) { this.scene.remove(d.mesh); d.mat.dispose(); if (d.onDone) d.onDone(); d.dead = true; }
    }
    this.decals = this.decals.filter(d => !d.dead);
    for (const s of this.slashes) { s.t -= dt; s.mesh.material.opacity = Math.max(0, s.t / s.max) * 0.85; s.mesh.scale.setScalar(1 + (1 - s.t / s.max) * 0.15); if (s.t <= 0) this.scene.remove(s.mesh); }
    this.slashes = this.slashes.filter(s => s.t > 0);
    for (const r of this.rings) { r.t += dt; const k = r.t / r.max; r.mesh.scale.setScalar(Math.max(0.01, k * r.radius)); r.mesh.material.opacity = 0.9 * (1 - k); if (k >= 1) this.scene.remove(r.mesh); }
    this.rings = this.rings.filter(r => r.t < r.max);
    // drops
    for (const d of this.drops) {
      if (d.vy !== 0 || d.y > (d.kind === 'orb' ? 0.3 : 0.5)) {
        d.vy -= 18 * dt; d.y += d.vy * dt;
        const nx = d.g.position.x + d.vx * dt, nz = d.g.position.z + d.vz * dt;
        if (this.world.isLand(nx, nz)) { d.g.position.x = nx; d.g.position.z = nz; d.g.position.y = this.world.groundY(nx, nz); }
        const rest = d.kind === 'orb' ? 0.3 : 0.5;
        if (d.y < rest) { d.y = rest; d.vy = 0; d.vx = d.vz = 0; }
      }
      d.gem.position.y = d.y + (d.vy === 0 ? Math.sin(this.time * 3 + d.g.id) * 0.08 : 0);
      d.gem.rotation.y += dt * 2;
      if (d.kind === 'orb' && this.state === 'play') {
        const dx = p.pos.x - d.g.position.x, dz = p.pos.z - d.g.position.z, dist = Math.hypot(dx, dz);
        if (dist < 2.5 && d.vy === 0 && Math.abs(d.g.position.y - p.y) < 1.6) { d.g.position.x += dx / dist * dt * 8; d.g.position.z += dz / dist * dt * 8; }
        if (dist < 0.6 && Math.abs(d.g.position.y - p.y) < 1.6) { this.audio.sfx('orb'); this.heal(p.stats.maxHp * 0.12); d.taken = true; this.scene.remove(d.g); }
      }
    }
    this.drops = this.drops.filter(d => !d.taken);
    // exits
    for (const x of this.exits) {
      x.disc.material.uniforms.uT.value = this.time;
      x.disc.material.uniforms.uOn.value = lerp(x.disc.material.uniforms.uOn.value, x.on ? 1 : 0, 1 - Math.exp(-dt * 3));
      x.icon.position.y = 3.6 + Math.sin(this.time * 2) * 0.15; x.icon.rotation.y += dt * 1.5;
      x.icon.visible = x.on;
    }
    // water & motes
    if (this.world.waterMat) this.world.waterMat.uniforms.uTime.value = this.time;
    const snow = this.biome.key === 'snow';
    for (const mo of this.motes) {
      const u = mo.userData;
      if (snow) {
        u.base.y -= dt * 1.2; u.base.x += dt * 0.5;
        if (u.base.y < 0) { u.base.y = 8; u.base.x = this.camPos.x + rand(Math.random, -22, 22); u.base.z = this.camPos.z + rand(Math.random, -18, 18); }
        mo.position.set(u.base.x + Math.sin(this.time + u.ph) * 0.3, u.base.y, u.base.z);
      } else {
        mo.position.set(u.base.x + Math.sin(this.time * 0.5 + u.ph) * 1.2, u.base.y + Math.sin(this.time * 0.9 + u.ph * 2) * 0.4, u.base.z + Math.cos(this.time * 0.4 + u.ph) * 1.2);
        mo.visible = Math.sin(this.time * 1.5 + u.ph * 3) > -0.3;
      }
    }
    // lantern flicker
    this.lampLight.position.set(p.pos.x, p.y + 1.6, p.pos.z);
    this.lampLight.intensity = 1.6 + Math.sin(this.time * 9) * 0.15 + Math.sin(this.time * 23) * 0.1;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    this.fade = Math.max(0, this.fade - dt * 1.6);
    const u = this.pipe.postMat.uniforms; u.uHurt.value = this.hurtFlash * 0.5 + (this.state === 'play' && p.hp / p.stats.maxHp < 0.3 ? 0.18 + Math.sin(this.time * 5) * 0.06 : 0); u.uFade.value = this.fade;
  }

  animatePlayer(dt) {
    const p = this.player, m = p.m;
    m.root.position.set(p.pos.x, p.y, p.pos.z);
    m.root.rotation.y = p.facing;
    const moving = p.walkT > 0 && !p.air;
    const sw = Math.sin(p.walkT);
    m.legL.position.z = moving ? sw * 0.12 : 0; m.legR.position.z = moving ? -sw * 0.12 : 0;
    m.body.position.y = moving ? Math.abs(Math.sin(p.walkT)) * 0.06 : Math.sin(this.time * 2) * 0.015;
    m.body.rotation.x = moving ? 0.12 : 0;
    m.head.rotation.z = moving ? Math.sin(p.walkT) * 0.05 : 0;
    if (p.roll > 0) { m.body.rotation.x = (1 - p.roll / 0.3) * Math.PI * 2; m.body.position.y = 0.25; }
    else if (p.gliding) { m.body.rotation.x = 0.9; m.body.position.y = 0.3; m.staff.rotation.z = 1.2; }
    else if (p.climbing) { m.body.rotation.x = -0.35; m.body.position.y = 0.05 + Math.sin(this.time * 14) * 0.04; }
    else if (p.air) { m.body.rotation.x = p.vy > 0 ? -0.15 : 0.15; m.body.position.y = 0.1; }
    else if (!moving) m.body.rotation.x = 0;
    // staff swing
    if (p.swingT > 0) { const k = 1 - p.swingT / 0.22; m.staff.rotation.set(1.2 * Math.sin(k * Math.PI), 0, -1.6 + k * 3.2); }
    else { m.staff.rotation.x = lerp(m.staff.rotation.x, 0, 0.2); m.staff.rotation.z = lerp(m.staff.rotation.z, 0.15, 0.2); }
    // blink when invulnerable
    m.root.visible = this.state !== 'dead' && !(p.iframes > 0 && Math.floor(this.time * 20) % 2 === 0);
    m.lantern.material.color.setHex(Math.sin(this.time * 9) > 0.8 ? 0xffe9a0 : 0xffd36e);
  }

  updateCamera(dt) {
    const p = this.player;
    let tx = p.pos.x, tz = p.pos.z;
    if (this.state === 'title') { tx = Math.sin(this.time * 0.08) * 6; tz = Math.cos(this.time * 0.06) * 4; }
    else { const a = this.aim; tx += clamp(a.x - p.pos.x, -6, 6) * 0.12; tz += clamp(a.z - p.pos.z, -6, 6) * 0.12; }
    this.camPos.x = lerp(this.camPos.x, tx, 1 - Math.exp(-dt * 5));
    this.camPos.z = lerp(this.camPos.z, tz, 1 - Math.exp(-dt * 5));
    this.camY = lerp(this.camY || 0, this.state === 'title' ? 0 : p.y * 0.85, 1 - Math.exp(-dt * 4));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 0.6;
    const dist = this.state === 'title' ? 34 : 29;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camY + dist * 0.8, this.camPos.z + dist * 0.58 + (Math.random() - 0.5) * s);
    this.camera.lookAt(this.camPos.x, this.camY, this.camPos.z);
    this.sun.position.set(this.camPos.x - 10, 22, this.camPos.z + 6);
    this.sun.target.position.set(this.camPos.x, 0, this.camPos.z);
  }
}
