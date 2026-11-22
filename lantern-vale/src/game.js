import { Weather } from './weather.js';
import { bindGuild, updateRaid } from './guild.js';
import { FIELDS, fieldBiome, awardKill, setupField, tickField, useFieldSpot, leaveGrave, rememberGear, restoreGear } from './frontier.js';
import { CLASSES, ensurePuzzle, computeBoard } from './puzzle.js';
import { dayInfo, findSecondClass, buildDungeonLandmark, tickSkyFeatures, buildInterior } from './world_alive.js';
import { buildHarborTown, buildFerryBoat } from './harbor.js';
import { addGearToBag } from './physbag.js';
import { t } from './i18n.js';
import * as THREE from 'three';
import { World, toonMat, HALF, windU } from './world.js';
import { BIOMES, mulberry32, clamp, lerp, angleLerp, rand, pick } from './util.js';
import { buildTownScenery } from './town.js';
import { loadSettings, applySettings, buildSettingsUI } from './settings.js';
import { showWeapon, applyCosmetics, buildPlayer, buildSlime, buildThorn, buildBoar, buildMoth, buildSkyRay, buildStag, buildArch, buildHouse, buildFountain, buildBoard, buildStall } from './models.js';
import { Net } from './net.js';
import { Meta } from './meta.js';
import { buildPanels } from './panels.js';
const EMOTES = ['嗨～', '♥', '哈哈', 'zZ'];
import { HOODS } from './characters.js';
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
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 2, 190);
    pipe.onResize = (w, h) => { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
    pipe.onResize(pipe.w, pipe.h);
    this.hemi = new THREE.HemisphereLight(0xb9c9ff, 0xd9b07a, 0.6);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 1.05);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 110;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.lampLight = new THREE.PointLight(0xffb85a, 1.6, 3.5, 1.5);
    this.scene.add(this.lampLight);
    this.world = new World(this.scene);
    this.fx = new Particles(this.scene, 700, false);
    this.puffs = new Particles(this.scene, 300, true);
    this.weather = new Weather(this.scene);
    this.enemies = []; this.projs = []; this.eprojs = []; this.drops = []; this.decals = []; this.exits = []; this.slashes = []; this.rings = [];
    this.keys = {}; this.mouse = { x: 0, y: 0, l: false, r: false }; this.aim = new V3();
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new V3(0, 1, 0), 0);
    this.state = 'title'; this.time = 0; this.shake = 0; this.hitstop = 0; this.hurtFlash = 0; this.fade = 0;
    this.camPos = new V3(0, 20, 14);
    this.flowTimer = 0;
    this.net = new Net(); this.remotes = new Map(); this.townGroup = null; this.party = ''; this.bots = [];
    this.meta = new Meta(); this.pickups = []; this.spots = []; this.talked = new Set();
    this.playerName = '旅人'; this.hoodIdx = 0; this.posT = 0;
    this.dayTime = 0.28; this.isNight = false; this.campfires = []; this.prisms = []; this.interior = null; this.photoMode = false;
    this.recallT = 0; this.sailing = null; this.lastTown = -1; this.waypoint = null; this.worldBoxes = [];
    this.zoneStates = new Map(); this.camZoom = 1.0;
    this.bindInput();
    this.setupNet(); bindGuild(this);
    // title scene: a pretty room in the background
    this.player = this.makePlayer();
    this.loadRoom(0, null, true);
  }

  // ---------------- input ----------------
  bindInput() {
    const CODE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift', KeyQ: 'q', KeyE: 'e', KeyC: 'c', KeyK: 'k', KeyR: 'r', KeyF: 'f', KeyI: 'i', KeyM: 'm', KeyB: 'b', KeyP: 'p', KeyH: 'h', KeyG: 'g', KeyV: 'v', Tab: 'tab', Escape: 'escape', Enter: 'enter', KeyT: 't', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0' };
    const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
    addEventListener('keydown', e => {
      if (this.raid && e.code === 'Escape') { this.net.send({t:'raidLeave'}); return; }
      if (this.ui.mapDialog?.open) {
        if (e.code === 'KeyM' || e.code === 'Escape') {
          e.preventDefault();
          if (!e.repeat) this.ui.mapDialog.close();
        }
        return;
      }
      if (this.state === 'title' && e.code !== 'Escape') return;
      if (typing()) { if (e.code === 'Escape' || e.code === 'Enter') this.ui.chatKey?.(e); return; }
      const k = CODE[e.code] ?? e.key.toLowerCase();
      if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      const fresh = !this.keys[k]; this.keys[k] = true;
      this.audio.init();
      if (!fresh) return;
      if (this.gatherActive) {
        if (k === 'f' || k === ' ') { this.gatherActive.trigger(); return; }
        if (k === 'escape') { this.gatherActive.cancel(); return; }
        return;
      }
      if (this.ui.puzzleOpen) {
        if (k === 'r') { this.ui.rotateHeldGem?.(); return; }
        if (k === 'k' || k === 'escape') { this.ui.closePuzzle?.(); return; }
        return;
      }
      if (k === 'm') { if (!e.repeat) this.ui.openMap?.(); return; }
      if (this.state === 'play') {
        if (this.sailing) return;
        if (k === 'p' && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen) { this.togglePhotoMode(); return; }
        if (k === 'b' && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen) { this.placeCampfire(); return; }
        if (k === 'tab' && !this.ui.panelOpen && !this.ui.setOpen) { this.ui.toggleRegionMap?.(this); return; }
        if (k === 'k' && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen) { this.ui.openPuzzle?.(); return; }
        if (k === ' ') {
          const now = performance.now(), dbl = now - (this.lastSpace || 0) < 280; this.lastSpace = now;
          if (this.player.air || this.player.climbing) this.tryJump();          // 空中/攀爬：維持原本行為（按住滑翔）
          else if (dbl) { this.lastSpace = 0; this.player.roll = 0; this.tryJump(); } // 連按兩下：取消翻滾、跳起（按住第二下＝滑翔）
          else this.tryRoll();                                                  // 單擊：翻滾
        }
        const kb = this.settings?.keybinds || { sk0: 'rmb', sk1: 'q', sk2: 'e', sk3: 'c', flask: 'r', recall: 'h' };
        let usedBind = false;
        if (!this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen) {
          if (k === kb.sk0 && kb.sk0 !== 'rmb') { this.castHotbar(0); usedBind = true; }
          else if (k === kb.sk1) { this.castHotbar(1); usedBind = true; }
          else if (k === kb.sk2) { this.castHotbar(2); usedBind = true; }
          else if (k === kb.sk3) { this.castHotbar(3); usedBind = true; }
          else if (k === kb.flask) { this.tryFlask(); usedBind = true; }
          else if (k === kb.recall) { this.startRecall(); usedBind = true; }
        }
        if (k === 'f' && !this.ui.panelOpen) { if (!this.tryInteract()) this.tryPickup(); }
        if (!usedBind && ['1', '2', '3', '4'].includes(k)) this.emote(+k - 1);
        if (k === 'enter' || (k === 't' && !usedBind)) { if (this.ui.focusChat?.()) e.preventDefault(); }
        if (k === 'i' && !this.ui.setOpen && !this.ui.panelOpen) this.ui.toggleInv(this);
        if (k === 'escape') { if (this.photoMode) this.togglePhotoMode(); else if (this.ui.regionMapOpen) this.ui.toggleRegionMap?.(this); else if (this.ui.panelOpen) this.ui.closePanel(); else if (this.ui.setOpen) this.ui.closeSettings(); else if (this.ui.invOpen) this.ui.toggleInv(this); else this.ui.toggleSettings(); }
      } else if (this.state === 'boon' && ['1', '2', '3'].includes(k)) this.ui.pickBoonIndex(+k - 1);
    });
    addEventListener('keyup', e => { const k = CODE[e.code] ?? e.key.toLowerCase(); this.keys[k] = false; this.keys[e.key.toLowerCase()] = false; });
    const cv = this.pipe.renderer.domElement;
    addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    cv.addEventListener('mousedown', e => { this.audio.init(); window.focus(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); if (e.button === 0) this.mouse.l = true; if (e.button === 2) this.mouse.r = true; cv.classList.add('aiming'); });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; if (!this.mouse.l && !this.mouse.r) cv.classList.remove('aiming'); });
    addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      if (this.state !== 'play' || this.ui.invOpen || this.ui.setOpen || this.ui.panelOpen || this.ui.puzzleOpen || this.ui.mapDialog?.open) return;
      e.preventDefault();
      this.camZoom = clamp((this.camZoom || 1) + Math.sign(e.deltaY) * 0.08, 0.72, 1.48);
    }, { passive: false });
    addEventListener('blur', () => { this.keys = {}; this.mouse.l = this.mouse.r = false; });
    document.addEventListener('visibilitychange', () => { this.keys = {}; });
  }

  // ---------------- player ----------------
  makePlayer() {
    const m = buildPlayer(...HOODS[this.hoodIdx], undefined, this.character);
    m.root.scale.setScalar(1.25);
    this.scene.add(m.root);
    const p = {
      m, pos: new V3(), vel: new V3(), facing: 0, hp: 100, mana: 50, equip: { staff: null, cloak: null, charm: null },
      boons: [], skills: { slam: false, wisp: false }, cds: { atk: 0, bolt: 0, roll: 0, slam: 0, wisp: 0 }, skillCds: [0, 0, 0, 0], hotbar: [],
      roll: 0, rollDir: new V3(), iframes: 0, flask: { charges: 2, max: 3, prog: 0 }, healOver: 0,
      y: 0, vy: 0, air: false, climbing: false, gliding: false, wall: false, stamina: 100, lastLow: new V3(), stepT: 0, swing: 0, swingT: 0, swingCount: 0, galeBuff: false, wisps: [], wispT: 0, walkT: 0, kills: 0, dmgDealt: 0, stats: {},
    };
    p.equip.staff = makeItem(mulberry32(5), 0, 0, 'staff');
    const hl = this.meta.heirloom; if (hl) p.equip[hl.slot] = hl;
    restoreGear(this, p);
    return p;
  }
  recalc() {
    const p = this.player;
    const s = { baseDmg: 10, dmgPct: 0, addFire: 0, atkSpd: 0, crit: 5, critMult: 150, maxHp: 100, lifeOnHit: 0, moveSpd: 0, cdr: 0, mana: 50, manaRegen: 0, area: 0, armor: 0, proj: 1, regen: 0, rollCdr: 0 };
    const cls = CLASSES[this.character?.job ?? 0] || CLASSES[0];
    for (const [k, v] of Object.entries(cls.bonuses)) s[k] = (s[k] || 0) + v;
    const profile = this.meta.p;
    const sc = findSecondClass(profile.secondClass);
    if (sc) for (const [k, v] of Object.entries(sc.bonuses)) s[k] = (s[k] || 0) + v;
    if (p.m?.aura) { p.m.aura.visible = !!sc; if (sc && p.m.auraMat) p.m.auraMat.color.setHex(sc.aura); }
    const pz = ensurePuzzle(profile, cls.id);
    p.hotbar = computeBoard(pz.presets[pz.activePreset] || []);
    showWeapon(p.m, profile.weapon);
    applyCosmetics(p.m, profile.cosmetics);
    const attackName={staff:'杖',bow:'弓',blades:'刃',shield:'盾'}[profile.weapon] || '杖';
    const attackSlot=document.getElementById('sk-lmb');
    if (attackSlot) { const ic = attackSlot.querySelector('.ic'); if (ic) ic.textContent = attackName; attackSlot.title = attackName + '擊'; }
    s.maxHp += (profile.level - 1) * 5; s.baseDmg += profile.level - 1;
    if (profile.weapon === 'blades') s.atkSpd += 40;
    if (profile.weapon === 'shield') s.armor += 15;
    if (profile.gem) { s.addFire += 4; p.skills.slam = true; }
    if (profile.mealUntil > Date.now()) s.regen += 2;
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

  // ---------------- run / rooms & MMORPG persistent zones ----------------
  saveFieldState() {
    if (!this.field || this.state === 'title') return;
    this.zoneStates.set(this.field, {
      savedAt: Date.now(),
      enemies: this.enemies.filter(e => !e.dead && !e.rival).map(e => ({
        type: e.type, x: e.pos.x, z: e.pos.z, hp: e.hp, maxHp: e.maxHp,
        elite: !!e.elite, spawnIndex: e.spawnIndex, level: e.level, legendary: !!e.legendary,
      })),
      respawns: (this.respawns || []).map(r => ({ ...r })),
      drops: this.drops.filter(d => d.kind === 'item').map(d => ({ x: d.g.position.x, z: d.g.position.z, item: d.item })),
      campfires: (this.campfires || []).map(c => ({ x: c.x, y: c.y, z: c.z })),
      hiddenSpots: (this.spots || []).map((s, i) => s.mesh?.visible === false ? i : -1).filter(i => i >= 0),
      playerPos: { x: this.player.pos.x, z: this.player.pos.z },
    });
  }
  restoreFieldState(id) {
    const st = this.zoneStates.get(id);
    if (!st) return false;
    if (st.playerPos && this.world.isLand(st.playerPos.x, st.playerPos.z)) {
      this.player.pos.set(st.playerPos.x, this.world.gh(st.playerPos.x, st.playerPos.z), st.playerPos.z);
      this.player.y = this.player.pos.y;
      this.camPos.set(this.player.pos.x, 0, this.player.pos.z);
    }
    this.respawns = (st.respawns || []).map(r => ({ ...r }));
    for (const se of st.enemies || []) {
      const e = this.spawnEnemy(se.type, { x: se.x, z: se.z }, se.elite);
      e.hp = Math.max(1, se.hp); e.maxHp = se.maxHp || e.maxHp;
      e.spawnIndex = se.spawnIndex; e.level = se.level; e.legendary = se.legendary;
    }
    for (const sd of st.drops || []) this.dropItem(sd.x, sd.z, sd.item, true);
    for (const cf of st.campfires || []) this.spawnCampfireAt(cf.x, cf.y, cf.z);
    for (const idx of st.hiddenSpots || []) if (this.spots[idx]?.mesh) this.spots[idx].mesh.visible = false;
    return true;
  }
  enterField(id) {
    if (!FIELDS[id]) return;
    if (this.field && this.field !== id) this.saveFieldState();
    if (!this.field && this.depth >= 0 && !this.runEnded) this.bankRun(1);
    this.worldEvent = null; this.field = id; this.originField = id; this.state = 'play';
    const restored = this.zoneStates.has(id);
    this.loadRoom(FIELDS[id].biome * 3, null);
    setupField(this, restored);
    if (restored) this.restoreFieldState(id);
  }
  startRun() {
    if (this.field) this.saveFieldState();
    this.originField = this.field || 1;
    this.field = 0;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer();
    this.recalc(); this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.runSeed = this.party ? [...this.party].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000000 : (Math.random() * 1e6) | 0;
    this.runSeed += (this.originField-1)*997;
    this.runStart = performance.now(); this.meta.runShards = 0; this.meta.p.runs++; this.meta.save(); this.runEnded = false;
    this.state = 'play';
    this.loadRoom(0, null);
  }
  enterTown() {
    if (this.field) this.saveFieldState();
    if (this.state === 'play' && !this.field && this.depth >= 0 && this.runStart && !this.runEnded) this.bankRun(1);
    this.field = 0; this.lastTown = -1; this.recallT = 0;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer(); this.recalc();
    this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.state = 'play'; this.player.m.root.visible = true;
    this.loadRoom(-1, null);
  }
  enterHarbor() {
    if (this.field) this.saveFieldState();
    if (this.state === 'play' && !this.field && this.depth >= 0 && this.runStart && !this.runEnded) this.bankRun(1);
    this.field = 0; this.lastTown = -2; this.recallT = 0;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer(); this.recalc();
    this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.state = 'play'; this.player.m.root.visible = true;
    this.loadRoom(-2, null);
  }
  startRecall() {
    if (this.state !== 'play' || this.sailing) return;
    if (this.depth < 0 && !this.field && !this.interior) { this.ui.toast('已在城鎮中，無須回城', '#ffe08a'); return; }
    if (this.recallT > 0) return;
    this.recallT = 2.5;
    this.audio.sfx('wisp');
    this.ui.toast('🐚 吹響歸途海螺，2.5 秒後返城（移動或受擊會中斷）', '#7ae8ff');
  }
  sailTo(dest) {
    if (this.sailing) return;
    const boat = buildFerryBoat();
    const sx = 0, sz = this.depth === -2 ? 15.8 : 13.6;
    const tx = 0, tz = sz + 14;
    boat.position.set(sx, 0.05, sz);
    this.scene.add(boat);
    this.sailing = { dest, t: 0, dur: 2.5, boat, sx, sz, tx, tz };
    this.audio.sfx('glide');
    this.ui.banner(dest === 'harbor' ? '⛵ 揚帆啟航 · 海風港鎮' : '⛵ 乘風返航 · 燈谷鎮', '沿著海風波浪航行中…');
  }
  get zone() { if (this.field) return 'field:' + this.field; return this.state === 'title' ? 'title' : this.depth === -2 ? 'harbor' : this.depth < 0 ? 'town' : `run:${this.party || 'solo' + (this.net.id || '')}:${this.depth}`; }
  biomeFor(depth) { return depth >= 9 ? 3 : ((Math.floor(depth / 3) + (FIELDS[this.originField]?.biome || 0)) % 4); }
  loadRoom(depth, reward, title = false, extra = {}) {
    this.depth = depth; this.reward = reward;
    if (this.interior) { this.scene.remove(this.interior.group); this.interior = null; }
    if (this.sailing?.boat) { this.scene.remove(this.sailing.boat); } this.sailing = null; this.recallT = 0;
    if (this.world?.group) this.world.group.visible = true;
    for (const cf of this.campfires || []) { this.scene.remove(cf.grp); } this.campfires = [];
    for (const pr of this.prisms || []) { this.scene.remove(pr.mesh); } this.prisms = [];
    for (const e of this.enemies) this.scene.remove(e.m.root);
    for (const a of [...this.projs, ...this.eprojs, ...this.decals, ...this.slashes, ...this.rings]) this.scene.remove(a.mesh);
    for (const d of this.drops) this.scene.remove(d.g);
    for (const k of this.pickups) this.scene.remove(k.g); this.pickups = [];
    this.spots = []; this.worldBoxes = [];
    for (const x of this.exits) this.scene.remove(x.g);
    for (const w of this.player.wisps) this.scene.remove(w.mesh);
    this.player.wisps = [];
    this.enemies = []; this.projs = []; this.eprojs = []; this.decals = []; this.drops = []; this.exits = []; this.slashes = []; this.rings = [];
    this.fx.clear(); this.puffs.clear();
    const town = depth === -1, harbor = depth === -2, anyTown = town || harbor;
    if (this.townGroup) { this.scene.remove(this.townGroup); this.townGroup = null; this.chimneys = null; }
    for (const b of this.bots) this.removeRemote(b); this.bots = [];
    const bi = (title || anyTown) ? 0 : this.biomeFor(depth);
    const B = this.field ? fieldBiome(this.field) : harbor ? { ...BIOMES[0], name: '海風港鎮', ground: 0xe6d29a, sky: 0x9ed8ff, sun: 0xfff5d6 } : BIOMES[bi]; this.biome = B;
    this.boss = null; this.ui.bossBar(false);
    const weather = FIELDS[this.field]?.fog;
    // 改用線性遠距霧效（近中景 100% 清晰，只柔和遠景地平線）
    this.scene.fog = weather ? new THREE.Fog(weather, 40, 118) : null;
    const boss = depth === 9 && !title && !this.field;
    const seed = this.field ? 7201 + this.field * 319 : title ? 4242 : harbor ? 9002 : town ? 9001 : (this.runSeed || 1) + depth * 101;
    this.rng = mulberry32(seed + 77);
    const { spawn, exits } = this.world.generate(seed, B, { boss, town: anyTown, raid: !!extra.raid, size: FIELDS[this.field]?.size, exitCount: extra.raid ? 0 : this.field ? (FIELDS[this.field + 1] ? 3 : 2) : town ? 1 : harbor ? 0 : boss ? 0 : (depth === 0 ? 2 : (this.rng() < 0.5 ? 2 : 3)) });
    // 校正光照倍率避免白晝過曝（特別是雪原與沙灘）
    this.sun.color.set(B.sun); this.sun.intensity = B.sunI * 1.45;
    this.hemi.color.set(B.sky); this.hemi.groundColor.set(B.ground); this.hemi.intensity = B.ambient * 1.15;
    this.pipe.postMat.uniforms.uGrade.value.set(...B.grade);
    this.pipe.postMat.uniforms.uShaft.value.set(...B.shaft);
    // player
    const p = this.player;
    p.pos.set(spawn.x, 0, harbor ? 8.5 : spawn.z); p.vel.set(0, 0, 0); p.facing = Math.PI; p.roll = 0;
    this.camPos.set(p.pos.x, 0, p.pos.z);
    // exits (inactive until cleared in dungeons; always open in town & persistent normal maps)
    const types = ['item', 'boon', 'heal'];
    const pool = depth === 0 ? ['boon', 'item'] : types.slice().sort(() => this.rng() - 0.5);
    if (town) { this.makeExit(exits[0], 'run'); this.exits[0].on = true; this.buildTown(); }
    else if (harbor) { this.buildHarbor(); }
    else if (this.field) {
      this.makeExit(exits[0], 'dungeon'); this.exits[0].on = true;
      if (exits[1]) { this.makeExit(exits[1], 'town'); this.exits[1].on = true; }
      if (exits[2] && FIELDS[this.field + 1]) { this.makeExit(exits[2], 'nextField'); this.exits[2].on = true; }
    }
    else exits.forEach((e, i) => this.makeExit(e, pool[i % pool.length]));
    this.weather.reset(B);
    // waves
    this.waves = [];
    if (town) {
      this.cleared = true; this.waveIdx = 0; this.waves = [];
      this.ui.banner('燈谷鎮', '北門前往野外 · 南碼頭可乘船前往海風港鎮');
      this.fade = 1;
    } else if (harbor) {
      this.cleared = true; this.waveIdx = 0; this.waves = [];
      this.ui.banner('海風港鎮', '第二城鎮 · 乘船返航或探索浮空遺跡與珊瑚海灣');
      this.fade = 1;
    } else if (this.field) { this.waveIdx = 0; this.cleared = true; this.fade = 1; } else if (!title) {
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
    if (!anyTown && !title && !this.field) { this.meta.event('depth', depth + 1); if (depth + 1 > this.meta.p.best.depth) { this.meta.p.best.depth = depth + 1; this.meta.save(); } this.placePickups(); }
    p.y = 0; p.vy = 0; p.air = false; p.climbing = false; p.stamina = 100; p.lastLow.set(p.pos.x, 0, p.pos.z);
    this.world.computeFlow(p.pos.x, p.pos.z);
    this.musicKey = title ? 'title' : anyTown ? 'town' : boss ? 'boss' : B.key; this.audio.setMusic(this.musicKey, 0);
  }

  makeExit(e, type) {
    const g = (type === 'dungeon' && this.field) ? buildDungeonLandmark(this.biome, this.field) : buildArch(this.biome);
    g.position.set(e.x, 0, e.z);
    const toC = Math.atan2(-e.x, -e.z); g.rotation.y = toC;
    const col = { item: 0xffd85a, boon: 0xc08cff, heal: 0xff6b6b, dungeon: 0xb399ec, run: 0x6fe0d0, town: 0x58c896, nextField: 0x62e0a8 }[type];
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
    const cnt = Math.round(wv.n * (this.meta.has('swarm') ? 1.4 : 1));
    for (let i = 0; i < cnt; i++) {
      const t = pick(this.rng, pool);
      const pos = this.world.randomWalkable(this.rng, p.pos, 7);
      const elite = this.rng() < 0.06 + d * 0.025 + (this.meta.has('elite') ? 0.22 : 0);
      // warning puff, then spawn
      this.addDecal('circle', pos.x, pos.z, 0.9, 0xfff2c0, 0.7, null, () => this.spawnEnemy(t, pos, elite), 2);
    }
  }

  spawnEnemy(type, pos, elite) {
    const d = this.field ? FIELDS[this.field].level / 2 : this.depth, scale = 1 + d * 0.22;
    const DEF = {
      slime: { hp: 30, spd: 2.7, dmg: 9, r: 0.45, build: () => buildSlime(pick(this.rng, [0x7fc35a, 0x9bd06a, 0x6fb86a])) },
      thorn: { hp: 26, spd: 2.2, dmg: 10, r: 0.4, build: buildThorn },
      boar: { hp: 58, spd: 2.6, dmg: 16, r: 0.55, build: buildBoar },
      moth: { hp: 36, spd: 3.0, dmg: 14, r: 0.45, build: buildMoth },
      skyray: { hp: 44, spd: 3.4, dmg: 15, r: 0.55, flying: true, alt: 2.35, build: buildSkyRay },
      stag: { hp: 1100, spd: 2.4, dmg: 18, r: 1.2, build: buildStag },
    }[type];
    if (type !== 'stag') { if (this.meta.has('swift')) DEF.spd *= 1.25; if (this.meta.has('tough')) DEF.hp *= 1.5; }
    const m = DEF.build();
    const s = elite ? 1.35 : 1;
    m.root.scale.setScalar(s);
    this.scene.add(m.root);
    const e = {
      type, m, pos: new V3(pos.x, 0, pos.z), vel: new V3(), knock: new V3(), facing: Math.random() * 6,
      hp: DEF.hp * scale * (elite ? 2.6 : 1) * (type === 'stag' && !this.field ? 1 / scale : 1), dmg: DEF.dmg * (1 + d * 0.12) * (elite ? 1.3 : 1),
      spd: DEF.spd * (elite ? 1.15 : 1), r: DEF.r * s, flying: !!DEF.flying, alt: DEF.alt || 0, groundedT: 0,
      state: 'move', t: 0, cd: 1 + Math.random() * 1.5, stun: 0, slow: 0, flash: 0, elite, ph: Math.random() * 10,
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
    const p = this.player;
    let dmg = e.vuln > 0 ? Math.round(hit.dmg * 1.3) : hit.dmg;
    // 空中截擊與擊落機制：滯空攻擊對空中怪物造成 1.5 倍暴擊、擊落眩暈並踏跳反彈回復體力
    if (opts.aerial && e.flying && e.groundedT <= 0) {
      dmg = Math.round(dmg * 1.5);
      e.groundedT = 4.2;
      e.stun = Math.max(e.stun, 1.5);
      p.vy = Math.max(p.vy, 7.8);
      p.stamina = Math.min(100, p.stamina + 40);
      this.audio.sfx('perfect');
      this.ui.toast('🦅 空中破翼擊落！體力 +40 · 踏跳反彈', '#7ae8ff');
      this.fx.burst(e.pos.x, e.pos.y + 0.6, e.pos.z, 14, { c: [0x7ae8ff, 0xffe480, 0xffffff], s: 0.14, speed: 6, up: 4, life: 0.5 });
    }
    e.hp -= dmg; e.flash = 0.12; this.audio.sfx(hit.crit ? 'crit' : 'hit');
    const kb = e.type === 'stag' ? 0.15 : 1;
    e.knock.x += kx * kb; e.knock.z += kz * kb;
    if (opts.stun && e.type !== 'stag') e.stun = Math.max(e.stun, opts.stun);
    if (opts.slow) e.slow = Math.max(e.slow || 0, opts.slow);
    p.dmgDealt += dmg;
    this.ui.dmgNum(e.pos.x, e.pos.y + 1.2 * e.m.root.scale.x + (e.type === 'stag' ? 2.5 : 0), e.pos.z, dmg, (hit.crit || opts.aerial) ? 'crit' : hit.fire ? 'fire' : '');
    this.fx.burst(e.pos.x, e.pos.y + 0.6, e.pos.z, hit.crit ? 8 : 4, { c: hit.fire ? [0xffb040, 0xff7030] : [0xffffff, 0xfff2b0], s: 0.1, speed: 5, up: 3, life: 0.35 });
    if (p.stats.lifeOnHit) this.heal(p.stats.lifeOnHit, false);
    if (opts.leech) this.heal(opts.leech, false);
    if (opts.hitstop) this.hitstop = Math.max(this.hitstop, opts.hitstop);
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e) {
    if (e.dead) return;
    if (e.rival) { this.dueling=false; this.ui.toast('演武勝利'); }
    e.dead = true; this.audio.sfx(e.type === 'stag' ? 'bossDie' : 'enemyDie');
    this.scene.remove(e.m.root);
    const col = { slime: [0x7fc35a, 0xb5e080], thorn: [0x8a5a3b, 0x6aa84a], boar: [0x9a6a4a, 0x5a3b2c], moth: [0xb48ae0, 0xffd27a], skyray: [0x58d4e8, 0xffe480], stag: [0xffb050, 0xe8dcc8] }[e.type];
    this.puffs.burst(e.pos.x, 0.4, e.pos.z, e.type === 'stag' ? 40 : 10, { c: col, s: 0.22, speed: 4, up: 4, life: 0.8 });
    this.puffs.burst(e.pos.x, 0.3, e.pos.z, 6, { c: 0xffffff, s: 0.4, speed: 1.5, up: 1, g: -1, life: 0.8, grow: 1.4, drag: 3 });
    this.shake = Math.max(this.shake, e.type === 'stag' ? 1 : 0.18);
    const p = this.player; p.kills++;
    this.onKillMeta(e); awardKill(this, e);
    p.flask.prog += (e.elite ? 1 : 0.25) * (this.meta.has('fortune') ? 0.5 : 1);
    while (p.flask.prog >= 1 && p.flask.charges < p.flask.max) { p.flask.prog -= 1; p.flask.charges++; }
    if (p.flask.charges >= p.flask.max) p.flask.prog = 0;
    if (this.has('feast')) this.heal(4 * p.boons.filter(b => b === 'feast').length, false);
    // drops
    const r = Math.random();
    const dropChance = e.elite ? 1 : e.type === 'stag' ? 1 : 0.075;
    if (r < dropChance && this.field) this.dropItem(e.pos.x,e.pos.z,makeItem(Math.random,Math.floor(this.meta.p.level/4),e.elite?2:1));
    else if (r < dropChance) this.dropItem(e.pos.x, e.pos.z, makeItem(Math.random, this.depth + this.meta.dropBonus, e.type === 'stag' ? 3 : e.elite ? (Math.random() < 0.3 ? 3 : 2) : null));
    if (Math.random() < 0.16) this.dropOrb(e.pos.x, e.pos.z);
    if (e.type === 'stag') { this.boss = null; this.ui.bossBar(false); if (!this.field) { const seed = this.runSeed; setTimeout(() => { if (!this.field && this.state === 'play' && this.depth === 9 && this.runSeed === seed) this.victory(); }, 2500); } }
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
    if (this.recallT > 0) { this.recallT = 0; this.ui.toast('受到攻擊，回城中斷！', '#ff8a8a'); }
    this.audio.sfx('hurt');
    dmg = Math.round(dmg * (1 - p.stats.armor / 100) * (this.meta.has('fragile') ? 1.35 : 1));
    p.hp -= dmg; p.iframes = 0.6;
    this.hurtFlash = 0.5; this.shake = Math.max(this.shake, 0.35); this.hitstop = 0.06;
    this.ui.dmgNum(p.pos.x, 1.5, p.pos.z, dmg, 'hurt');
    this.fx.burst(p.pos.x, 0.6, p.pos.z, 8, { c: [0xff5a5a, 0xffffff], s: 0.1, speed: 4, life: 0.4 });
    if (this.has('bramble')) for (const e of this.enemies) if (!e.dead && e.pos.distanceTo(p.pos) < 2.5) this.hitEnemy(e, { dmg: 20, crit: false });
    if (src) { tmp3.subVectors(p.pos, src).setY(0).normalize(); p.vel.addScaledVector(tmp3, 6); }
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }
  die() {
    if (this.state !== 'play') return;
    this.state = 'dead'; if (!this.field) this.bankRun(1);
    const lost = leaveGrave(this); this.audio.sfx('dead'); this.audio.setMusic('title', 0);
    this.puffs.burst(this.player.pos.x, 0.5, this.player.pos.z, 20, { c: [0x2f8a7e, 0xd9543a, 0xffd36e], s: 0.2, speed: 4, life: 1 });
    this.player.m.root.visible = false;
    setTimeout(() => {
      this.enterTown();
      this.ui.banner('在燈谷鎮甦醒', lost ? '墓碑保管了 ' + lost + ' 份素材 · ' + FIELDS[this.originField || 1].name : '裝備與星砂已保留');
    }, 900);
  }
  victory() { this.bankRun(1); this.meta.p.best.wins++; this.meta.save(); this.audio.sfx('win'); this.state = 'win'; this.ui.showWin(this); }

  dropItem(x, z, item, quiet = false) {
    const g = new THREE.Group();
    const R = RARITY[item.rarity]; if (!quiet) this.audio.sfx('drop' + item.rarity);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: R.beam }));
    gem.position.y = 0.5; g.add(gem);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, item.rarity >= 2 ? 6 : 2.5, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: R.beam, transparent: true, opacity: item.rarity >= 2 ? 0.45 : 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = item.rarity >= 2 ? 3 : 1.25; beam.userData.noNormal = true; g.add(beam);
    g.position.set(x, this.world.groundY(x, z), z);
    this.scene.add(g);
    const a = Math.random() * 6.28;
    this.drops.push({ g, gem, item, kind: 'item', vx: quiet ? 0 : Math.cos(a) * 2, vz: quiet ? 0 : Math.sin(a) * 2, vy: quiet ? 0 : 5, y: 0.5 });
    if (!quiet && item.rarity >= 2) this.ui.toast(`${RARITY[item.rarity].name}物品掉落！`, R.color);
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
    let best = null, bd = 1.6;
    for (const d of this.drops) if (d.kind === 'item') { const dd = Math.hypot(d.g.position.x - this.player.pos.x, d.g.position.z - this.player.pos.z); if (dd < bd && Math.abs(d.g.position.y - this.player.y) < 1.8) { bd = dd; best = d; } }
    return best;
  }
  tryPickup() {
    const d = this.nearestDrop(); if (!d) return;
    const p = this.player, it = d.item;
    const existing = p.equip[it.slot]; this.audio.sfx('pickup');
    this.scene.remove(d.g); this.drops.splice(this.drops.indexOf(d), 1);
    if (!existing) {
      // 欄位為空時才自動穿戴；已有裝備時改收入物理背包，絕不強制覆蓋或丟棄到地上
      p.equip[it.slot] = it; rememberGear(this);
      const hpFrac = p.hp / p.stats.maxHp;
      this.recalc(); p.hp = Math.max(1, Math.round(hpFrac * p.stats.maxHp));
      this.ui.toast(`裝備了 ${it.name}`, RARITY[it.rarity].color);
    } else {
      addGearToBag(this.meta.p, it); this.meta.save();
      this.ui.toast(`🎒 已收入物理背包：${it.name}（按 I 鍵檢視／換裝）`, RARITY[it.rarity].color);
    }
    this.fx.burst(p.pos.x, p.y + 0.8, p.pos.z, 12, { c: RARITY[it.rarity].beam, s: 0.1, speed: 3, up: 4, life: 0.6 });
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
    // 滑翔俯衝斬擊（Gliding Plunge Dive）：滑翔中按左鍵急速俯衝落地引發大範圍衝擊波
    if (p.gliding && this.meta.p.weapon !== 'bow' && !p.plunge) {
      p.plunge = true; p.vy = -19; p.gliding = false;
      this.audio.sfx('roll');
      this.fx.burst(p.pos.x, p.y + 0.5, p.pos.z, 10, { c: [0x7ae8ff, 0xffffff], s: 0.12, speed: 4, up: 1, life: 0.35 });
    }
    if (this.meta.p.weapon === 'bow') {
      this.fireProj(p.pos, dir, { speed: 21, mult: p.air ? 1.15 : .85, color: p.air ? 0x8ef0ff : 0xebd69f, size: .09, life: .85, airShot: p.air }); return;
    }
    const range = (p.air ? 2.9 : 2.3) * (1 + p.stats.area / 100);
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
      const flyingHigh = e.flying && e.groundedT <= 0;
      if (flyingHigh && !p.air) {
        // 地面普攻難以完整命中高空目標，提示跳躍／滑翔空戰
        this.hitEnemy(e, this.rollDamage(mult * 0.45), tmp2.x * 2, tmp2.y * 2, { hitstop: 0.02 });
        if (!this._airHintT || this.time - this._airHintT > 6) {
          this._airHintT = this.time;
          this.ui.toast('💡 連按兩下空白鍵跳躍或乘氣流滑翔，可擊落空中怪物並觸發 1.5 倍暴擊！', '#7ae8ff');
        }
      } else {
        this.hitEnemy(e, this.rollDamage(mult), tmp2.x * 5, tmp2.y * 5, { hitstop: 0.035, aerial: p.air });
      }
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
  shockRing(x, z, radius, hit, color, stun = 0, opts = {}) {
    const geo = new THREE.RingGeometry(0.85, 1, 32); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    mesh.position.set(x, 0.12, z); mesh.userData.noNormal = true;
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, max: 0.3, radius });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < radius + e.r) { const k = 6 / Math.max(d, 0.3); this.hitEnemy(e, hit.dmg ? { ...hit, dmg: Math.round(hit.dmg * (0.9 + Math.random() * 0.2)) } : hit, (e.pos.x - x) * k * 0.3, (e.pos.z - z) * k * 0.3, { stun, slow: opts.slow, leech: opts.leech }); }
    }
  }
  castHotbar(slotIdx) {
    const p = this.player, sk = p.hotbar?.[slotIdx];
    if (!sk) {
      if (slotIdx === 0) this.tryBolt();
      else if (slotIdx === 1) this.trySlam();
      else if (slotIdx === 2) this.tryWisp();
      return;
    }
    if ((p.skillCds[slotIdx] || 0) > 0 || p.roll > 0) return;
    const { def, mod } = sk;
    if (def.mana && p.mana < def.mana) {
      if (!this._noManaT || this.time - this._noManaT > 1) { this.ui.toast('法力不足', '#7fb2ff'); this._noManaT = this.time; }
      return;
    }
    if (def.mana) p.mana -= def.mana;
    p.skillCds[slotIdx] = Math.max(0.12, def.cd * (1 - p.stats.cdr / 100) * (1 - mod.cdr));
    const run = (echoScale = 1) => this.execPuzzleSkill(def.id, mod, echoScale);
    run(1);
    for (let i = 1; i <= mod.echo; i++) setTimeout(() => { if (this.state === 'play') run(0.65); }, i * 240);
  }
  execPuzzleSkill(id, mod, scale = 1) {
    const p = this.player, dir = this.aimDir();
    p.facing = Math.atan2(dir.x, dir.y);
    this.meta.p.deeds = this.meta.p.deeds || {}; this.meta.p.deeds.casts = (this.meta.p.deeds.casts || 0) + 1;
    const slow = mod.frost ? 2.2 : 0, leech = mod.leech || 0;
    const areaMul = (1 + p.stats.area / 100) * (1 + mod.area);
    const dmgMul = mod.dmgMult * scale;
    if (id === 'bolt') {
      this.audio.sfx('bolt');
      const n = p.stats.proj + mod.multi, spread = 0.18;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * spread, d = dir.clone().rotateAround(new V2(), a);
        this.fireProj(p.pos, d, { speed: 17, mult: 1.35 * dmgMul, fire: true, color: 0xffb347, size: 0.18, chain: (this.has('chain') ? 1 : 0) + mod.chain, split: p.specials.has('splitBolt'), slow, leech });
      }
      p.swing = 1; p.swingT = 0.15;
    } else if (id === 'slam') {
      this.audio.sfx('slam');
      const R = 3.2 * areaMul * (this.has('quake') ? 1.35 : 1), cx = p.pos.x + dir.x * 1.2, cz = p.pos.z + dir.y * 1.2;
      this.shockRing(cx, cz, R, this.rollDamage(2.2 * dmgMul, mod.fire), mod.fire ? 0xffa050 : 0xffe3a0, 1.1, { slow, leech });
      this.puffs.burst(cx, 0.2, cz, 16, { c: [this.biome.rock, this.biome.rockDark, this.biome.dirt], s: 0.25, speed: 5, up: 6, life: 0.8 });
      this.shake = 0.45; p.swing = 1; p.swingT = 0.28;
    } else if (id === 'wisp') {
      this.audio.sfx('wisp');
      for (const w of p.wisps) this.scene.remove(w.mesh); p.wisps = [];
      const n = 3 + mod.multi + (this.has('swarm') ? 3 : 0) + (p.specials.has('moreWisps') ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: mod.fire ? 0xff9a4a : 0xfff27a }));
        this.scene.add(mesh);
        p.wisps.push({ mesh, a: i / n * Math.PI * 2, cd: Math.random() * 0.4, mult: 0.48 * dmgMul, fire: mod.fire, slow, leech });
      }
      p.wispT = 7 + (this.has('swarm') ? 3 : 0);
    } else if (id === 'rain') {
      this.audio.sfx('bolt');
      const tx = this.aim.x, tz = this.aim.z, waves = 2 + Math.floor(mod.multi / 2), R = 2.6 * areaMul;
      for (let w = 0; w < waves; w++) {
        this.addDecal('circle', tx + (Math.random() - 0.5) * 1.4, tz + (Math.random() - 0.5) * 1.4, R, mod.fire ? 0xff9a4a : 0x6cb8ff, 0.45 + w * 0.28, null, () => {
          this.shockRing(tx, tz, R, this.rollDamage(1.45 * dmgMul, mod.fire), mod.fire ? 0xffa850 : 0x8cd0ff, 0, { slow, leech });
          this.fx.burst(tx, 1.5, tz, 14, { c: [0xfff4d0, 0x6cb8ff], s: 0.12, speed: 4, up: -2, life: 0.45 });
        });
      }
      p.swing = 1; p.swingT = 0.2;
    } else if (id === 'trap') {
      this.audio.sfx('ui');
      const dist = Math.min(6, Math.hypot(this.aim.x - p.pos.x, this.aim.z - p.pos.z));
      const tx = p.pos.x + dir.x * dist, tz = p.pos.z + dir.y * dist;
      const R = 2.8 * areaMul;
      this.addDecal('circle', tx, tz, R, 0xa882e8, 0.9, null, () => {
        this.audio.sfx('slam');
        this.shockRing(tx, tz, R, this.rollDamage(2.1 * dmgMul, mod.fire), 0xc09aff, 0.5, { slow: Math.max(slow, 2.5), leech });
        this.puffs.burst(tx, 0.3, tz, 14, { c: [0xa882e8, 0x8ae0a0], s: 0.24, speed: 4, up: 4, life: 0.65 });
      });
    } else if (id === 'whirl') {
      this.audio.sfx('swing');
      const R = 3.1 * areaMul;
      this.shockRing(p.pos.x, p.pos.z, R, this.rollDamage(1.9 * dmgMul, mod.fire), mod.fire ? 0xff7a50 : 0xff8ab0, 0, { slow, leech });
      this.makeSlash(p.pos, dir, R); this.makeSlash(p.pos, dir.clone().negate(), R);
      p.swing = 1; p.swingT = 0.25;
    } else if (id === 'mark') {
      this.audio.sfx('boon');
      const tx = this.aim.x, tz = this.aim.z, R = 3.2 * areaMul;
      this.addDecal('circle', tx, tz, R, 0xd06cff, 0.4, null, () => {
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.pos.x - tx, e.pos.z - tz) < R + e.r) {
          e.vuln = 6;
          if (slow) e.slow = Math.max(e.slow || 0, slow);
        }
        this.ui.toast('已標記目標（易傷 +30%）', '#e0a0ff');
      });
    } else if (id === 'meteor') {
      this.audio.sfx('meteor');
      const tx = this.aim.x, tz = this.aim.z, count = 3 + Math.min(3, mod.multi), R = 2.7 * areaMul;
      for (let i = 0; i < count; i++) {
        const ox = i === 0 ? 0 : (Math.random() - 0.5) * 3.8, oz = i === 0 ? 0 : (Math.random() - 0.5) * 3.8;
        const mx = tx + ox, mz = tz + oz;
        this.addDecal('circle', mx, mz, R, 0xff6a30, 0.55 + i * 0.22, null, () => {
          this.audio.sfx('slam');
          this.shockRing(mx, mz, R, this.rollDamage(2.5 * dmgMul, true), 0xff8c40, 0.8, { slow, leech });
          this.fx.burst(mx, 0.8, mz, 22, { c: [0xff6a30, 0xffd85a, 0xffffff], s: 0.16, speed: 6, up: 6, life: 0.65 });
          this.puffs.burst(mx, 0.3, mz, 12, { c: [0xffa040, 0x5c3c2e], s: 0.3, speed: 4, up: 4, life: 0.8 });
          this.shake = Math.max(this.shake, 0.55);
        });
      }
      p.swing = 1; p.swingT = 0.3;
    } else if (id === 'nova') {
      this.audio.sfx('nova');
      const R = 4.6 * areaMul;
      this.shockRing(p.pos.x, p.pos.z, R, this.rollDamage(2.0 * dmgMul, mod.fire), 0x7ae8ff, 0.6, { slow: Math.max(slow, 3.2), leech });
      this.shockRing(p.pos.x, p.pos.z, R * 0.65, this.rollDamage(0.8 * dmgMul, false), 0xd8a8ff, 0, { slow: 2.5 });
      this.fx.burst(p.pos.x, p.y + 0.9, p.pos.z, 26, { c: [0x7ae8ff, 0xd8a8ff, 0xffffff], s: 0.14, speed: 6.5, up: 3, life: 0.65 });
      this.heal(p.stats.maxHp * 0.08, true);
      p.swing = 1; p.swingT = 0.25;
    } else if (id === 'prism') {
      this.audio.sfx('prism');
      const dist = Math.min(5, Math.hypot(this.aim.x - p.pos.x, this.aim.z - p.pos.z));
      const tx = p.pos.x + dir.x * dist, tz = p.pos.z + dir.y * dist, ty = this.world.gh(tx, tz);
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
      mesh.position.set(tx, ty + 1.2, tz); this.scene.add(mesh);
      this.prisms.push({ mesh, x: tx, y: ty + 1.2, z: tz, life: 8 + mod.multi, cd: 0.2, dmgMul, chain: mod.chain, slow, leech });
      this.fx.burst(tx, ty + 1.2, tz, 14, { c: [0xffe07a, 0x8ae8ff, 0xffffff], s: 0.12, speed: 4, up: 3, life: 0.5 });
      p.swing = 1; p.swingT = 0.2;
    } else if (id === 'phantom') {
      this.audio.sfx('roll');
      const ox = p.pos.x, oz = p.pos.z;
      this.movePlayer(dir.x * 4.5, dir.y * 4.5);
      p.iframes = Math.max(p.iframes, 0.65);
      const R = 3.4 * areaMul;
      this.shockRing(ox, oz, R, this.rollDamage(2.1 * dmgMul, mod.fire), 0xb48ae0, 0.4, { slow: Math.max(slow, 2.5), leech });
      this.makeSlash(p.pos, dir, 3.0 * areaMul);
      this.puffs.burst(ox, p.y + 0.5, oz, 16, { c: [0xb48ae0, 0x5c3e80, 0xffd27a], s: 0.24, speed: 4, up: 2, life: 0.7 });
      this.fx.burst(p.pos.x, p.y + 0.6, p.pos.z, 14, { c: [0xff7aa8, 0xb48ae0], s: 0.12, speed: 5, up: 2, life: 0.45 });
      p.swing = 1; p.swingT = 0.24;
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
    p.roll = 0.3; p.cds.roll = 0.85 * (this.has('gale') ? 0.65 : 1) * (1 - (p.stats.rollCdr || 0) / 100) * (1 - p.stats.cdr / 100);
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

  resolveBoxCollisions(pos, r, y = 0) {
    for (const b of this.worldBoxes || []) {
      if (Math.abs((b.h || 0) - y) > 1.8) continue;
      const cx = clamp(pos.x, b.x - b.hw, b.x + b.hw);
      const cz = clamp(pos.z, b.z - b.hd, b.z + b.hd);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2);
        if (d > 0.0001) {
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          const px = (b.hw + r) - Math.abs(pos.x - b.x);
          const pz = (b.hd + r) - Math.abs(pos.z - b.z);
          if (px < pz) pos.x = b.x + Math.sign(pos.x - b.x || 1) * (b.hw + r);
          else pos.z = b.z + Math.sign(pos.z - b.z || 1) * (b.hd + r);
        }
      }
    }
  }

  moveEntity(pos, dx, dz, r, y = 0) {
    // axis-separated movement on walk grid + circular & AABB obstacles
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
    this.resolveBoxCollisions(pos, r, y);
  }

  movePlayer(dx, dz) {
    const p = this.player, W = this.world, pos = p.pos, r = 0.38;
    if (this.interior) {
      pos.x = clamp(pos.x + dx, -this.interior.halfW, this.interior.halfW);
      pos.z = clamp(pos.z + dz, -this.interior.halfD, this.interior.halfD);
      return;
    }
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
    this.resolveBoxCollisions(pos, r, p.y);
  }
  updateVertical(dt, mv) {
    const p = this.player, W = this.world;
    const g = W.gh(p.pos.x, p.pos.z);
    const want = mv.lengthSq() > 0.01;
    // grab a wall
    if (p.wall && want && p.roll <= 0 && p.stamina > 4 && !p.climbing && g - p.y <= 3.8) { p.climbing = true; p.air = false; p.vy = 0; p.climbH = p.wallH; this.audio.sfx('climb'); }
    p.gliding = false;
    if (p.climbing) {
      p.stamina -= 20 * dt * this.meta.staminaK; p.y += 3.4 * dt;
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
        p.vy = Math.max(p.vy, -1.6); p.stamina -= 10 * dt * this.meta.staminaK; p.gliding = true;
      }
      p.gliding0 = glide;
      const vyBefore = p.vy;
      p.y += p.vy * dt;
      if (p.y <= g) {
        p.y = g; p.air = false; p.vy = 0; p.gliding0 = false;
        if (p.plunge) {
          p.plunge = false;
          this.audio.sfx('slam');
          this.shockRing(p.pos.x, p.pos.z, 4.2 * (1 + (p.stats.area || 0) / 100), this.rollDamage(2.2, true), 0x7ae8ff, 1.2);
          this.puffs.burst(p.pos.x, p.y + 0.2, p.pos.z, 18, { c: [0x7ae8ff, 0xffe480, 0xf4ecd8], s: 0.3, speed: 5, up: 4, life: 0.65 });
          this.shake = Math.max(this.shake, 0.45);
          this.ui.toast('⚡ 滑翔俯衝重擊！', '#7ae8ff');
        } else if (vyBefore < -4) { this.audio.sfx('land'); this.puffs.burst(p.pos.x, p.y + 0.1, p.pos.z, 6, { c: 0xf4ecd8, s: 0.25, speed: 2, up: 0.5, g: -0.3, life: 0.45, grow: 1, drag: 3 }); }
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


  // ---------------- meta：碎片、羽毛、貝殼、互動 ----------------
  onKillMeta(e) {
    const m = this.meta, d = this.depth;
    m.event('kill'); if (e.elite) m.event('elite'); if (e.type === 'stag') m.event('boss');
    m.p.kills++;
    let n = e.type === 'stag' ? 120 : e.elite ? 6 + d : (Math.random() < 0.4 ? 1 + (d >> 1) : 0);
    n = Math.round(n * m.shardMult);
    if (n > 0) { if (this.field) m.p.shards += n; else m.runShards += n; if (e.elite || e.type === 'stag') this.ui.toast(`✦ 星砂 +${n}`, '#ffe08a'); }
  }
  bankRun(frac) {
    if (this.runEnded) return; this.runEnded = true;
    const m = this.meta, n = Math.round(m.runShards * frac);
    m.p.shards += n; m.save(); this.bankedShards = n; this.lostShards = m.runShards - n; m.runShards = 0;
  }
  placePickups() {
    const W = this.world, p = this.player, r = Math.random;
    const mk = (kind, x, z) => {
      const g = new THREE.Group();
      if (kind === 'feather') {
        const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xffd23a })); f.scale.set(0.45, 1.5, 0.25); f.position.y = 0.9; g.add(f);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 5, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 2.5; beam.userData.noNormal = true; g.add(beam);
        g.userData.gem = f;
      } else {
        const sh = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 7), new THREE.MeshBasicMaterial({ color: 0xffb8c8 })); sh.rotation.x = Math.PI; sh.position.y = 0.3; g.add(sh);
        g.userData.gem = sh;
      }
      g.position.set(x, W.gh(x, z), z); this.scene.add(g); this.pickups.push({ g, kind, x, z, ph: Math.random() * 6 });
    };
    // 金羽毛：藏在高處平台上
    if (r() < 0.55) for (let i = 0; i < 70; i++) { const q = W.randomWalkable(r, p.pos, 8); if (W.gh(q.x, q.z) > 1.2) { mk('feather', q.x, q.z); break; } }
    // 貝殼：低處
    let ns = 2 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < 80 && ns > 0; i++) { const q = W.randomWalkable(r, p.pos, 5); if (W.gh(q.x, q.z) < 0.5) { mk('shell', q.x, q.z); ns--; } }
  }
  updatePickups(dt) {
    const p = this.player;
    for (const k of this.pickups) {
      k.ph += dt * 3; k.g.userData.gem.rotation.y += dt * 2; k.g.userData.gem.position.y = (k.kind === 'feather' ? 0.9 : 0.3) + Math.sin(k.ph) * 0.08;
      if (Math.hypot(p.pos.x - k.x, p.pos.z - k.z) < 1.1 && Math.abs(k.g.position.y - p.y) < 1.8) {
        k.got = true; this.scene.remove(k.g); const m = this.meta;
        if (k.kind === 'feather') { m.p.feathers++; m.event('feather'); this.ui.toast('找到金羽毛！攀爬與滑翔更省力', '#ffd23a'); this.audio.sfx('exit'); }
        else { m.p.shells++; m.event('shell'); this.ui.toast('貝殼 +1', '#ffb8c8'); this.audio.sfx('orb'); }
        m.save(); this.puffs.burst(k.x, 0.8, k.z, 10, { c: k.kind === 'feather' ? 0xffd23a : 0xffb8c8, s: 0.12, speed: 3, up: 3, life: 0.6 });
      }
    }
    this.pickups = this.pickups.filter(k => !k.got);
  }
  nearSpot() {
    if (this.depth >= 0 && !this.field && !this.interior) return null;
    const p = this.player; let best = null, bd = 2.8;
    for (const s of this.spots) { if (s.mesh?.visible === false) continue; const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z); if (d < bd) { bd = d; best = { ...s, bx: s.x, bz: s.z }; } }
    if (!this.interior) for (const r of this.remotes.values()) if (r.bot) { const d = Math.hypot(r.x - p.pos.x, r.z - p.pos.z); if (d < Math.min(bd, 2.2)) { bd = d; best = { kind: 'talk', label: r.name.replace(' (鎮民)', ''), x: r.x, z: r.z, top: 2.4, bot: r }; } }
    return best;
  }
  tryInteract() {
    const s = this.nearSpot(); if (!s) return false;
    if (s.kind === 'ferry_harbor') { this.sailTo('harbor'); return true; }
    if (s.kind === 'ferry_town') { this.sailTo('town'); return true; }
    if (s.kind === 'open_stash') { this.audio.sfx('ui'); this.ui.openInvTab?.(this, 'stash'); return true; }
    if (s.kind === 'open_cosmetics') { this.audio.sfx('ui'); this.ui.openInvTab?.(this, 'cosmetics'); return true; }
    if (s.kind.startsWith('goto_field_')) {
      const fid = +s.kind.replace('goto_field_', '');
      this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.enterField(fid)); return true;
    }
    if (s.kind === 'enter_home') { this.enterInterior('home'); return true; }
    if (s.kind === 'enter_tavern') { this.enterInterior('tavern'); return true; }
    if (s.kind === 'exit_house') { this.exitInterior(); return true; }
    if (s.kind === 'rest_time') {
      this.dayTime = (this.dayTime + 0.35) % 1;
      this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
      this.audio.sfx('perfect');
      this.ui.toast(`已休息回滿狀態 · 時辰轉為 ${dayInfo(this.dayTime).icon} ${dayInfo(this.dayTime).label}`, '#ffe08a');
      return true;
    }
    if (this.field) return useFieldSpot(this, s);
    if (s.kind === 'talk') { const r = s.bot; this.say(r.id, r.lines[(Math.random() * r.lines.length) | 0]); r.tf = Math.atan2(this.player.pos.x - r.x, this.player.pos.z - r.z); r.wait = Math.max(r.wait, 4);
      if (!this.talked.has(r.id)) { this.talked.add(r.id); this.meta.event('talk'); } this.audio.sfx('ui'); return true; }
    this.audio.sfx('ui'); this.ui.openPanel(s.kind); return true;
  }
  enterInterior(kind) {
    this.audio.sfx('door');
    this.savedTown = { pos: this.player.pos.clone(), spots: this.spots };
    if (this.world.group) this.world.group.visible = false;
    if (this.townGroup) this.townGroup.visible = false;
    for (const x of this.exits) x.g.visible = false;
    for (const r of this.remotes.values()) { r.m.root.visible = false; r.tag.style.display = 'none'; r.bub.style.display = 'none'; }
    this.interior = buildInterior(this, kind);
    this.scene.add(this.interior.group);
    this.spots = this.interior.spots;
    this.player.pos.set(0, 0, this.interior.halfD - 0.6); this.player.y = 0; this.player.facing = Math.PI;
    this.camPos.set(0, 0, 0);
    this.fade = 0.85;
    this.ui.banner(kind === 'tavern' ? '楓之酒館 · 室內' : '旅人小屋 · 室內', '按 F 與室內設施互動，走回門口可離開');
  }
  exitInterior() {
    if (!this.interior) return;
    this.audio.sfx('door');
    this.scene.remove(this.interior.group); this.interior = null;
    if (this.world.group) this.world.group.visible = true;
    if (this.townGroup) this.townGroup.visible = true;
    for (const x of this.exits) x.g.visible = true;
    for (const r of this.remotes.values()) { r.m.root.visible = true; r.tag.style.display = ''; r.bub.style.display = ''; }
    if (this.savedTown) { this.player.pos.copy(this.savedTown.pos); this.spots = this.savedTown.spots; this.savedTown = null; }
    this.fade = 0.85;
  }
  spawnCampfireAt(x, y, z) {
    const grp = new THREE.Group();
    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), toonMat({ color: 0x6b4530 })); log1.rotation.z = Math.PI / 2; log1.rotation.y = 0.6; log1.position.y = 0.1;
    const log2 = log1.clone(); log2.rotation.y = -0.6;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 5), new THREE.MeshBasicMaterial({ color: 0xffa030 })); flame.position.y = 0.35;
    const light = new THREE.PointLight(0xffa040, 2.2, 8, 1.4); light.position.y = 1.0;
    grp.add(log1, log2, flame, light); grp.position.set(x, y, z);
    this.scene.add(grp);
    this.campfires.push({ grp, light, x, y, z });
  }
  placeCampfire() {
    if (this.interior || !this.field) { this.ui.toast('野外地圖才可生起營火', '#ffe08a'); return; }
    if ((this.meta.p.goods?.wood || 0) < 1) { this.ui.toast('需要 1 份香杉木才可生火（砍伐樹木取得）', '#ffb08a'); return; }
    this.meta.p.goods.wood -= 1; this.meta.save();
    const p = this.player, x = p.pos.x + Math.sin(p.facing) * 1.4, z = p.pos.z + Math.cos(p.facing) * 1.4, y = this.world.gh(x, z);
    this.spawnCampfireAt(x, y, z);
    this.audio.sfx('campfire');
    this.ui.toast('🔥 已生起野外營火！靠近可持續回復生命與法力', '#ffb86a');
  }
  togglePhotoMode() {
    this.photoMode = !this.photoMode;
    document.body.classList.toggle('photo-mode', this.photoMode);
    this.audio.sfx('photo');
    if (this.photoMode) this.ui.toast('📷 拍照模式已開啟（按 P 或 Esc 返回）', '#fff8e4');
  }

  // ---------------- town ----------------
  buildTown() {
    const P = this.biome, g = new THREE.Group(); this.townGroup = g; this.scene.add(g);
    const add = (o, x, z, ry = 0, obst = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; g.add(o); if (obst) this.world.obstacles.push({ x, z, r: obst, h: 0 }); return o; };
    add(buildFountain(), 0, -1, 0, 2.0);
    const sc = buildTownScenery({ gh: (x, z) => this.world.gh(x, z), rng: Math.random });
    g.add(sc.group); this.world.obstacles.push(...sc.obstacles); this.chimneys = sc.chimneys; this.spots = sc.spots; this.smokeT = 0;
    // portal sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), toonMat({ color: 0xfff1d0 }));
    const ex = this.exits[0]; sign.position.set(ex.x, 3.4, ex.z); sign.rotation.y = ex.g.rotation.y; g.add(sign);
    // 南碼頭渡船與城鎮建築合理矩形物理碰撞（AABB）
    const ferry = buildFerryBoat(); ferry.position.set(0, 0.05, 13.8); g.add(ferry);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.75), toonMat({ color: 0x9a643a }));
    chest.position.set(3.6, 0.38, 7.4); chest.castShadow = true; g.add(chest);
    this.worldBoxes.push(
      { x: -6, z: 10, hw: 1.5, hd: 1.3, h: 0 },
      { x: 8, z: 4, hw: 1.2, hd: 0.8, h: 0 },
      { x: 3.6, z: 7.4, hw: 0.65, hd: 0.45, h: 0 },
    );
    this.spots.push(
      { kind: 'market', label: '溪畔拍賣行', x: 8, z: 4, top: 2.5 },
      { kind: 'enter_home', label: '推門進入旅人小屋（室內）', x: -6, z: 7.4, top: 2.5 },
      { kind: 'enter_tavern', label: '推門進入楓之酒館（室內）', x: -10.5, z: -2.5, top: 2.5 },
      { kind: 'guild', label: '燈谷公會大廳（加入公會／討伐）', x: 6.5, z: -6.5, top: 2.5 },
      { kind: 'ascend', label: '星燈覺醒祭壇（二轉職業覺醒）', x: -2.2, z: -6.5, top: 2.6 },
      { kind: 'ferry_harbor', label: '乘船前往海風港鎮（3D 航行）', x: 0, z: 11.8, top: 2.5 },
      { kind: 'open_stash', label: '燈谷公共倉庫（重力整理箱）', x: 3.6, z: 7.4, top: 2.2 },
      { kind: 'open_cosmetics', label: '造型衣櫃（更換外觀造型）', x: -3.2, z: 7.4, top: 2.2 },
    );
    this.updateHome();
    // offline villagers
    if (!this.net.url) this.spawnBots();
  }
  buildHarbor() {
    const hb = buildHarborTown(this);
    this.townGroup = hb.group; this.scene.add(hb.group);
    this.world.obstacles.push(...hb.obstacles);
    this.worldBoxes.push(...hb.boxes);
    this.spots = hb.spots;
    if (!this.net.url) {
      const harborBots = [
        ['老船長 浪花', 2, ['海風港鎮的渡船隨時為旅人起航！', '北邊的三塊木牌通往浮空遺跡、珊瑚灣與沉沒電光都。'], [1.8, 11.2, 1.4]],
        ['裁縫師 歐蕾', 4, ['要不要試試海風草帽或滑翔星翼？', '造型工坊裡的外觀都會即時顯示在身上喔！'], [-7.2, 5.2, 1.5]],
        ['倉管員 阿桶', 6, ['倉庫跟你的背包一樣，可以把東西丟進去堆疊整理！', '按搖一搖可以把壓在底下的裝備震出來。'], [7.2, -1.8, 1.4]],
      ];
      harborBots.forEach(([name, col, lines, home], i) => {
        const id = 'hbot' + i;
        const r = this.addRemote(id, name, col);
        r.bot = true; r.lines = lines; r.home = home; r.x = r.tx = home[0]; r.z = r.tz = home[1]; r.wait = 1 + i;
        this.bots.push(id);
      });
    }
  }
  updateHome() {
    if (!this.townGroup) return;
    if (this.homeModel) this.townGroup.remove(this.homeModel);
    const rank = this.meta.p.home;
    this.homeModel = buildHouse([0x84705a,0xa6754f,0x64885b,0xdeae69][rank], 0xf4dcaa, 2.3+rank*.4, 2.2);
    this.homeModel.position.set(-6,0,10); this.townGroup.add(this.homeModel);
  }
  spawnBots() {
    const defs = [['米糕 (鎮民)', 1, ['歡迎來到燈谷鎮！', '北邊的拱門通往燈谷，小心鹿王。', '空白鍵連按兩下可以跳，按住第二下就能滑翔喔。']],
      ['阿杏 (鎮民)', 5, ['頂著懸崖不放就能攀爬，但會耗體力。', '聽說傳奇裝備很稀有……', '多喝蜜藥瓶，少受傷。']],
      ['老燈 (鎮民)', 3, ['一個人也能走完，找朋友一起更熱鬧。', '輸入 Enter 可以聊天。', '噓……森林深處有東西在動。']]];
    defs.push(['酒館老闆娘 楓', 4, ['今天的蘋果酒剛釀好！', '冒險回來記得來坐坐。', '聽說有人在雪原看見發光的鹿角。'], [-10, -4, 1.5]],
      ['市集商人 豆豆', 2, ['新鮮的漿果，一個銅幣！', '下次我會進一些好裝備。', '傘下的位子最涼快。'], [8, 2.5, 2]],
      ['守門人 石頭', 6, ['北門外就是燈谷，祝你好運。', '別在懸崖邊逗留太久。', '回來的路，燈會替你亮著。'], [0, -11.5, 1.2]],
      ['園丁 小芽', 7, ['白色小花最近開得特別好。', '水池裡有小魚喔。', '踩到花圃我會哭的。'], [-4, 9.5, 2]]);
    defs.forEach(([name, col, lines, home], i) => {
      const id = 'bot' + i; const a = Math.random() * 6.28;
      const r = this.addRemote(id, name, col); r.bot = true; r.lines = lines; r.x = r.tx = Math.cos(a) * 4 + 2; r.z = r.tz = Math.sin(a) * 4 + 1; r.wait = Math.random() * 3; if (home) { r.home = home; r.x = r.tx = home[0]; r.z = r.tz = home[1]; }
      this.bots.push(id);
    });
  }
  // ---------------- multiplayer ----------------
  setupNet() {
    const n = this.net;
    n.on('status', s => { if (s.ok) this.identifyGuild(); else { this.wallet=null; this.exitRaid?.(); } this.ui.netStatus(s); if (!s.ok && this.depth === -1 && !this.bots.length && s.reason !== 'no-server') this.spawnBots(); });
    n.on('welcome', m => { for (const h of m.history || []) this.ui.addChat(h.name, h.text, false, h.zone); this.ui.addChat('', `已連線，你的編號 #${m.id}`, true); });
    n.on('online', m => this.ui.setOnline(m.n));
    n.on('sys', m => this.ui.addChat('', m.text, true));
    n.on('chat', m => { this.ui.addChat(m.name, m.text, false, m.zone); this.audio.sfx('chat'); if (m.id === n.id) this.say('me', m.text); else if (this.remotes.has(m.id)) this.say(m.id, m.text); });
    n.on('emote', m => { if (this.remotes.has(m.id)) this.say(m.id, EMOTES[m.e % EMOTES.length]); });
    n.on('gone', m => this.removeRemote(m.id));
    n.on('snap', m => {
      if(this.raid) return;
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
          if (r.wait <= 0) { r.wait = 3 + Math.random() * 5; const hm = r.home || [0, 2, 8], a = Math.random() * 6.28, d = (r.home ? 0.3 : 3) + Math.random() * hm[2]; r.tx = hm[0] + Math.cos(a) * d; r.tz = hm[1] + Math.sin(a) * d * 0.8; if (Math.random() < 0.45) this.say(r.id, r.lines[(Math.random() * r.lines.length) | 0]); }
        } else { const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz); r.x += dx / d * 2.2 * dt; r.z += dz / d * 2.2 * dt; r.tf = Math.atan2(dx, dz); r.a = 1; if (Math.hypot(r.x, r.z + 1) < 2.3) { r.x += (r.x / 2) * dt; r.z += ((r.z + 1) / 2) * dt; } }
        r.y = this.world.gh(r.x, r.z);
        if (Math.hypot(p.pos.x - r.x, p.pos.z - r.z) < 4.5 && r.a === 0) r.tf = Math.atan2(p.pos.x - r.x, p.pos.z - r.z);
        r.f = angleLerp(r.f, r.tf, 1 - Math.exp(-dt * 10));
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
    if (this.raid) { updateRaid(this,dt); return; }
    if (this.ui.mapDialog?.open) return;
    this.time += dt;
    if (this.meta.p.mealUntil && this.meta.p.mealUntil <= Date.now()) { this.meta.p.mealUntil=0; this.recalc(); this.meta.save(); }
    if (this.chimneys && this.townGroup) { this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.35; const c = this.chimneys[(Math.random() * this.chimneys.length) | 0];
      if (c) this.puffs.burst(c.x, c.y, c.z, 1, { c: 0xeeeae2, s: 0.28, speed: 0.15, up: 0.9, g: -0.6, life: 2.4, grow: 2.2, drag: 0.6 }); } }
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.08; }
    const p = this.player, S = p.stats;
    // aim
    const ndc = new V2(this.mouse.x / innerWidth * 2 - 1, -(this.mouse.y / innerHeight) * 2 + 1);
    this.plane.constant = -p.y; this.ray.setFromCamera(ndc, this.camera); this.ray.ray.intersectPlane(this.plane, this.aim);

    if (this.state === 'play' && this.sailing) {
      const s = this.sailing; s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const bx = lerp(s.sx, s.tx, k), bz = lerp(s.sz, s.tz, k);
      s.boat.position.set(bx, 0.08 + Math.sin(this.time * 5) * 0.08, bz);
      s.boat.rotation.z = Math.sin(this.time * 3.5) * 0.06;
      p.pos.set(bx, 0.72, bz - 0.3); p.y = 0.72; p.facing = 0;
      if (Math.random() < dt * 16) this.puffs.emit(bx + (Math.random() - 0.5) * 1.4, 0.05, bz - 1.8, { c: 0xdff8ff, s: 0.24, g: -0.2, life: 0.6, grow: 1.2 });
      if (k >= 1 && !s.done) {
        s.done = true;
        this.ui.wipe(() => s.dest === 'harbor' ? this.enterHarbor() : this.enterTown());
      }
      this.animatePlayer(dt); this.updateCamera(dt); this.fx.update(dt); this.puffs.update(dt); this.ui.update(this);
      return;
    }

    if (this.state === 'play') {
      for (const k in p.cds) p.cds[k] = Math.max(0, p.cds[k] - dt);
      for (let i = 0; i < 4; i++) p.skillCds[i] = Math.max(0, (p.skillCds[i] || 0) - dt);
      p.iframes = Math.max(0, p.iframes - dt);
      p.mana = Math.min(S.mana, p.mana + dt * 7 * (1 + (S.manaRegen || 0) / 100));
      if (S.regen) this.heal(S.regen * dt, false);
      if (p.specials.has('mossRegen')) this.heal(S.maxHp * 0.02 * dt, false);
      if (p.healOver > 0) { p.healOver -= dt; this.heal(p.healRate * dt, false); }
      if (!this.ui.invOpen && !this.ui.setOpen && !this.ui.panelOpen && !this.ui.puzzleOpen) {
        if (this.mouse.l) this.tryAttack();
        const kb = this.settings?.keybinds;
        if (this.mouse.r && (!kb || kb.sk0 === 'rmb')) this.castHotbar(0);
      }
      // movement (3D: walk, sprint, jump, climb walls, glide)
      const mv = this.moveInput();
      if (this.recallT > 0) {
        if (mv.lengthSq() > 0.05 || p.roll > 0 || p.swingT > 0) {
          this.recallT = 0;
          this.ui.toast('移動或攻擊中斷了回城', '#ffd85a');
        } else {
          this.recallT -= dt;
          if (Math.random() < dt * 18) this.fx.emit(p.pos.x + (Math.random() - 0.5) * 1.4, p.y + 0.3, p.pos.z + (Math.random() - 0.5) * 1.4, { c: [0x7ae8ff, 0xffe47a], s: 0.1, g: -2.2, up: 1.5, life: 0.65 });
          if (this.recallT <= 0) {
            this.recallT = 0; this.audio.sfx('warp');
            this.ui.wipe(() => this.lastTown === -2 ? this.enterHarbor() : this.enterTown());
          }
        }
      }
      const spd = 5.4 * (1 + S.moveSpd / 100);
      p.wall = false; p.wallH = 0;
      p.sprinting = false;
      if (p.roll > 0) {
        p.roll -= dt;
        this.movePlayer(p.rollDir.x * 13 * dt, p.rollDir.z * 13 * dt);
        if (Math.random() < 0.5) this.puffs.emit(p.pos.x, p.y + 0.1, p.pos.z, { c: 0xf4ecd8, s: 0.18, g: -0.4, life: 0.4, grow: 1 });
      } else {
        const attacking = p.swingT > 0;
        const canSprint = !!(this.keys.shift && mv.lengthSq() > 0.01 && !p.air && !p.climbing && !attacking && p.stamina > 2);
        if (canSprint) { p.sprinting = true; p.stamina = Math.max(0, p.stamina - 16 * dt * this.meta.staminaK); }
        const f = (attacking ? 0.55 : 1) * (p.climbing ? 0.22 : 1) * (p.gliding ? 1.35 : 1) * (canSprint ? 1.35 : 1);
        p.vel.x = lerp(p.vel.x, mv.x * spd * f, 1 - Math.exp(-dt * (p.air ? 6 : 14)));
        p.vel.z = lerp(p.vel.z, mv.y * spd * f, 1 - Math.exp(-dt * (p.air ? 6 : 14)));
        this.movePlayer(p.vel.x * dt, p.vel.z * dt);
        if (mv.lengthSq() > 0.01 && !attacking) p.facing = angleLerp(p.facing, Math.atan2(mv.x, mv.y), 1 - Math.exp(-dt * 14));
        if (mv.lengthSq() > 0.01 && !p.air && !p.climbing) {
          const stride = canSprint ? 15 : 11;
          p.walkT += dt * stride; p.stepT += dt * stride;
          if (p.stepT > Math.PI) { p.stepT -= Math.PI; this.audio.sfx('step'); }
          if (Math.random() < dt * (canSprint ? 10 : 4)) this.puffs.emit(p.pos.x, p.y + 0.05, p.pos.z, { c: 0xf4ecd8, s: canSprint ? 0.16 : 0.12, g: -0.3, life: 0.35, grow: 1 });
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
      if (this.field) tickField(this, dt);
      tickSkyFeatures(this, dt);
      // 折光棱鏡自動射擊
      for (const pr of this.prisms) {
        pr.life -= dt; pr.cd -= dt; pr.mesh.rotation.y += dt * 3; pr.mesh.position.y = pr.y + Math.sin(this.time * 4) * 0.15;
        if (pr.cd <= 0) {
          let best = null, bd = 9;
          for (const e of this.enemies) if (!e.dead) { const d = Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z); if (d < bd) { bd = d; best = e; } }
          if (best) {
            pr.cd = 0.7;
            const d = new V2(best.pos.x - pr.x, best.pos.z - pr.z).normalize();
            this.fireProj({ x: pr.x, y: pr.y - 0.5, z: pr.z }, d, { speed: 19, mult: 0.9 * pr.dmgMul, color: 0xffe07a, size: 0.14, chain: 1 + (pr.chain || 0), slow: pr.slow, leech: pr.leech, life: 0.9 });
          }
        }
        if (pr.life <= 0) this.scene.remove(pr.mesh);
      }
      this.prisms = this.prisms.filter(pr => pr.life > 0);
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
      if (!this.interior) for (const x of this.exits) if (x.on && Math.hypot(p.pos.x - x.x, p.pos.z - x.z) < 1.3) { this.goExit(x); break; }
      this.ui.exitHint(this);
      // flow field
      this.flowTimer -= dt;
      if (this.flowTimer <= 0) { this.world.computeFlow(p.lastLow.x, p.lastLow.z); this.flowTimer = 0.25; }
    }
    // 超慢漸進晝夜循環（完整循環 20 分鐘，白晝長達約 70%）與校正光影氛圍
    if (this.state === 'play' && !this.interior) {
      this.dayTime = (this.dayTime + dt / 1200) % 1;
      const di = dayInfo(this.dayTime);
      this.isNight = di.isNight;
      if (this.isNight && this.field) { this.meta.p.deeds = this.meta.p.deeds || {}; this.meta.p.deeds.nightExplore = 1; }
      if (this.biome) {
        this.sun.intensity = this.biome.sunI * 1.45 * di.sunMult;
        this.hemi.intensity = this.biome.ambient * 1.15 * di.hemiMult;
        this.pipe.postMat.uniforms.uGrade.value.set(this.biome.grade[0] * di.tint[0], this.biome.grade[1] * di.tint[1], this.biome.grade[2] * di.tint[2]);
      }
      this.lampLight.distance = this.isNight ? 7.5 : 3.8;
      this._lampBoost = di.lampBoost;
      if (this.isNight && Math.random() < dt * 7) {
        this.fx.emit(p.pos.x + (Math.random() - 0.5) * 16, p.y + 0.6 + Math.random() * 2.2, p.pos.z + (Math.random() - 0.5) * 16, { c: [0xd8ff78, 0xffe880], s: 0.08, g: -0.2, up: 0.4, life: 1.8 });
      }
    } else if (this.interior) {
      this.interior.fireLight.intensity = 2.2 + Math.sin(this.time * 11) * 0.3;
      this._lampBoost = 1.4;
    }

    const mKey = this.interior ? 'interior' : (this.isNight && (this.depth === -1 || this.field) && !this.enemies.length ? 'night' : this.musicKey);
    if (this.state === 'play' && mKey) this.audio.setMusic(mKey, this.enemies.length ? 1 : 0);
    this.updatePickups(dt);
    if (this.state === 'play') this.ui.spotHint(this);
    if (!this.interior) this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateMisc(dt);
    this.animatePlayer(dt);
    this.updateCamera(dt);
    this.updateHover();
    this.fx.update(dt); this.puffs.update(dt);
    this.updateNet(dt);
    this.ui.update(this);
  }

  updateHover() {
    const cv = this.pipe?.renderer?.domElement;
    const badge = document.getElementById('hoverBadge');
    if (!cv || !badge) return;
    if (this.state !== 'play' || this.ui.invOpen || this.ui.setOpen || this.ui.panelOpen || this.ui.puzzleOpen || this.ui.mapDialog?.open) {
      cv.classList.remove('hover-enemy', 'hover-interact');
      badge.classList.remove('show');
      return;
    }
    const ax = this.aim.x, az = this.aim.z;
    let hitE = null, hitS = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.pos.x - ax, e.pos.z - az) < (e.r || 0.6) + 0.85) { hitE = e; break; }
    }
    if (!hitE) {
      for (const s of this.spots) {
        if (s.mesh?.visible === false) continue;
        if (Math.hypot(s.x - ax, s.z - az) < 1.35) { hitS = s; break; }
      }
    }
    cv.classList.toggle('hover-enemy', !!hitE);
    cv.classList.toggle('hover-interact', !hitE && !!hitS);
    if (hitE) {
      const names = { slime: '青苔史萊姆', thorn: '棘芽射手', boar: '衝鋒野豬', moth: '月影飛蛾', skyray: '雲翼飛鰩（空中）', stag: '古樹鹿王' };
      badge.textContent = `⚔ ${hitE.elite ? '★ ' : ''}${names[hitE.type] || hitE.type} · ${Math.ceil(hitE.hp)}/${Math.ceil(hitE.maxHp)}`;
      badge.style.left = (this.mouse.x + 18) + 'px'; badge.style.top = (this.mouse.y - 12) + 'px';
      badge.classList.add('show');
    } else if (hitS) {
      badge.textContent = `✦ ${hitS.label || '互動'}`;
      badge.style.left = (this.mouse.x + 18) + 'px'; badge.style.top = (this.mouse.y - 12) + 'px';
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
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
    if (x.type === 'town') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.lastTown === -2 ? this.enterHarbor() : this.enterTown()); return; }
    if (x.type === 'nextField') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.enterField(this.field + 1)); return; }
    if (x.type === 'dungeon') {
      if (this.meta.p.keys < 1) {
        if (!this.keyHint || this.time > this.keyHint) { this.ui.toast('需要鑰石 · 擊敗精英可取得'); this.keyHint = this.time + 3; } return;
      }
      this.meta.p.keys--; this.meta.save();
    }
    if (x.type === 'run') { this.state = 'transition'; this.ui.wipe(() => this.enterField(1)); return; }
    if (x.type === 'dungeon') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.startRun()); return; }
    this.state = 'transition'; this.audio.sfx('warp');
    this.ui.wipe(() => { this.state = 'play'; this.loadRoom(this.depth + 1, x.type); });
  }

  updateEnemies(dt) {
    const p = this.player, W = this.world;
    const playing = this.state === 'play';
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt); e.hitCd = Math.max(0, e.hitCd - dt);
      e.slow = Math.max(0, e.slow - dt); e.vuln = Math.max(0, (e.vuln || 0) - dt);
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
      if (e.stun > 0 || !playing || (this.field && dist > (e.legendary ? 9 : 12))) {
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
      } else if (e.type === 'skyray') {
        e.groundedT = Math.max(0, (e.groundedT || 0) - dt);
        e.cd -= dt;
        if (e.groundedT <= 0) {
          // 空中盤旋與俯衝襲擊
          if (dist > 8) { mvx = dirP.x * spd; mvz = dirP.y * spd; }
          else if (dist < 3.6) { mvx = -dirP.x * spd * 0.7; mvz = -dirP.y * spd * 0.7; }
          else { mvx = -dirP.y * spd * 0.85; mvz = dirP.x * spd * 0.85; }
          if (e.cd <= 0 && dist < 13) {
            e.cd = 2.6 + Math.random();
            const n = e.elite ? 3 : 1;
            for (let i = 0; i < n; i++) {
              const d = dirP.clone().rotateAround(new V2(), (i - (n - 1) / 2) * 0.25);
              this.fireEnemyProj({ x: e.pos.x, y: e.pos.y, z: e.pos.z }, d, 9.5, e.dmg, 0x7ae8ff, 0.22);
            }
          }
        }
        const fl = Math.sin(e.t * (e.groundedT > 0 ? 4 : 11)) * (e.groundedT > 0 ? 0.15 : 0.45);
        if (e.m.wings) { e.m.wings[0].rotation.z = fl; e.m.wings[1].rotation.z = -fl; }
      } else if (e.type === 'stag') this.updateBoss(e, dt, dist, dirP, follow, (x, z) => { mvx = x; mvz = z; });

      if (mvx || mvz) {
        // separation from other enemies
        for (const o of this.enemies) if (o !== e && !o.dead) {
          const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d = Math.hypot(ox, oz), m = e.r + o.r;
          if (d < m && d > 0.01) { mvx += ox / d * 2; mvz += oz / d * 2; }
        }
        if (e.flying && e.groundedT <= 0) { e.pos.x += mvx * dt; e.pos.z += mvz * dt; }
        else this.moveEntity(e.pos, mvx * dt, mvz * dt, e.r);
        if (e.type !== 'boar') e.facing = angleLerp(e.facing, Math.atan2(mvx, mvz), 1 - Math.exp(-dt * 8));
      }
      // contact damage & 空中踏跳反彈（從上方踩踏空中怪物觸發踏跳＋擊落）
      if (playing && e.type !== 'boar' && dist < e.r + 0.45 && e.hitCd <= 0 && e.stun <= 0) {
        if (e.flying && e.groundedT <= 0 && p.air && p.y > e.pos.y - 0.5) {
          this.hitEnemy(e, this.rollDamage(1.4), 0, 0, { aerial: true, hitstop: 0.04 });
          e.hitCd = 0.6;
        } else if (!e.flying || e.groundedT > 0 || Math.abs(p.y - e.pos.y) < 1.1) {
          this.hurtPlayer(e.dmg * (e.type === 'stag' ? 0.8 : 1), e.pos); e.hitCd = 0.8;
        }
      }
      // visuals
      const flyH = (e.flying && e.groundedT <= 0) ? (e.alt + Math.sin(e.t * 3.2 + e.ph) * 0.25) : 0;
      e.pos.y = W.groundY(e.pos.x, e.pos.z) + flyH;
      e.m.root.position.set(e.pos.x, e.pos.y, e.pos.z);
      if (e.m.shadowRing) e.m.shadowRing.position.y = -flyH + 0.06;
      e.m.root.rotation.y = e.facing;
      const fl = e.flash > 0 ? 1 : 0;
      e.m.mat.emissive.setRGB(fl * 0.9, fl * 0.85, fl * 0.8);
      if (e.stun > 0) e.m.body.rotation.z = Math.sin(this.time * 20) * 0.1; else e.m.body.rotation.z = 0;
    }
    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.boss) this.ui.bossBar(!this.field || this.boss.pos.distanceTo(p.pos)<10, null, this.boss.hp / this.boss.maxHp);
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
        const vTol = e.flying ? 3.8 : 2.4;
        if (d < e.r + (pr.wave ? 0.8 : 0.25) && Math.abs(pr.mesh.position.y - (e.pos.y + 0.6)) < vTol) {
          pr.hit.add(e);
          const n = new V2(pr.vx, pr.vz).normalize();
          this.hitEnemy(e, this.rollDamage(pr.mult, pr.fire), n.x * 3, n.y * 3, { hitstop: 0.02, slow: pr.slow, leech: pr.leech, aerial: !!pr.airShot });
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
    windU.uTime.value = this.time; if (this.world.waterMat) this.world.waterMat.uniforms.uWater.value = this.settings.water ? 1 : 0;
    this.weather.update(this.time,dt,this.camPos,this.field===4 && this.worldEvent);
    // lantern flicker
    this.lampLight.position.set(p.pos.x, p.y + 1.6, p.pos.z);
    this.lampLight.intensity = (1.6 + Math.sin(this.time * 9) * 0.15 + Math.sin(this.time * 23) * 0.1) * (this._lampBoost || 1);
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
    m.legL.position.z = moving ? sw * (p.sprinting ? 0.17 : 0.12) : 0; m.legR.position.z = moving ? -sw * (p.sprinting ? 0.17 : 0.12) : 0;
    m.body.position.y = moving ? Math.abs(Math.sin(p.walkT)) * (p.sprinting ? 0.09 : 0.06) : Math.sin(this.time * 2) * 0.015;
    m.body.rotation.x = moving ? (p.sprinting ? 0.24 : 0.12) : 0;
    m.head.rotation.z = moving ? Math.sin(p.walkT) * 0.05 : 0;
    if (p.roll > 0) { m.body.rotation.x = (1 - p.roll / 0.3) * Math.PI * 2; m.body.position.y = 0.25; }
    else if (p.gliding) { m.body.rotation.x = 0.9; m.body.position.y = 0.3; m.staff.rotation.z = 1.2; }
    else if (p.climbing) { m.body.rotation.x = -0.35; m.body.position.y = 0.05 + Math.sin(this.time * 14) * 0.04; }
    else if (p.air) { m.body.rotation.x = p.vy > 0 ? -0.15 : 0.15; m.body.position.y = 0.1; }
    else if (!moving) m.body.rotation.x = 0;
    // 依武器類型演繹不同攻擊動作
    if (p.swingT > 0) {
      const k = 1 - p.swingT / 0.22, wp = this.meta.p.weapon;
      if (wp === 'bow') { m.staff.rotation.set(-0.35 * Math.sin(k * Math.PI), 0, 0.2); m.body.rotation.y = -0.35 * Math.sin(k * Math.PI); }
      else if (wp === 'blades') { const sgn = p.swingCount % 2 ? 1 : -1; m.staff.rotation.set(1.5 * Math.sin(k * Math.PI), sgn * k * 2.2, sgn * (-1.4 + k * 2.8)); }
      else if (wp === 'shield') { m.staff.rotation.set(0.8 * Math.sin(k * Math.PI), 0, -0.5); m.body.position.z = 0.18 * Math.sin(k * Math.PI); }
      else { m.staff.rotation.set(1.2 * Math.sin(k * Math.PI), 0, -1.6 + k * 3.2); }
    } else {
      m.staff.rotation.x = lerp(m.staff.rotation.x, 0, 0.2); m.staff.rotation.y = lerp(m.staff.rotation.y, 0, 0.2); m.staff.rotation.z = lerp(m.staff.rotation.z, 0.15, 0.2);
      m.body.rotation.y = lerp(m.body.rotation.y, 0, 0.2); m.body.position.z = lerp(m.body.position.z, 0, 0.2);
    }
    if (m.aura?.visible) m.aura.rotation.z += dt * 1.4;
    // 人物被遮擋時顯示暖金透視剪影（X-Ray silhouette）
    if (m.xray) {
      let occluded = false;
      if (!this.interior && this.state === 'play') {
        for (const o of this.world.obstacles) {
          if (o.z > p.pos.z + 0.1 && o.z < p.pos.z + 5.2 && Math.abs(o.x - p.pos.x) < (o.r || 1) + 1.15) { occluded = true; break; }
        }
      }
      m.xray.visible = occluded;
    }
    // blink when invulnerable
    m.root.visible = this.state !== 'dead' && !(p.iframes > 0 && Math.floor(this.time * 20) % 2 === 0);
    m.lantern.material.color.setHex(Math.sin(this.time * 9) > 0.8 ? 0xffe9a0 : 0xffd36e);
  }

  updateCamera(dt) {
    const p = this.player;
    let tx = p.pos.x, tz = p.pos.z;
    if (this.state === 'title') { tx = Math.sin(this.time * 0.08) * 6; tz = Math.cos(this.time * 0.06) * 4; }
    else if (!this.photoMode) { const a = this.aim; tx += clamp(a.x - p.pos.x, -6, 6) * 0.12; tz += clamp(a.z - p.pos.z, -6, 6) * 0.12; }
    this.camPos.x = lerp(this.camPos.x, tx, 1 - Math.exp(-dt * 5));
    this.camPos.z = lerp(this.camPos.z, tz, 1 - Math.exp(-dt * 5));
    this.camY = lerp(this.camY || 0, this.state === 'title' ? 0 : p.y * 0.85, 1 - Math.exp(-dt * 4));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 0.6 * (this.settings.shake ? 1 : 0);
    // 3 種鏡頭仰角預設（預設 0：PoE 2 風格斜 45°，兼顧宏偉遠景與 ARPG 走位判讀）＋滾輪縮放
    const preset = [
      { yK: 0.68, zK: 0.73, fov: 34 },
      { yK: 0.80, zK: 0.58, fov: 30 },
      { yK: 0.52, zK: 0.85, fov: 38 },
    ][this.settings?.camAngle ?? 0] || { yK: 0.68, zK: 0.73, fov: 34 };
    if (Math.abs(this.camera.fov - preset.fov) > 0.1) {
      this.camera.fov = lerp(this.camera.fov, preset.fov, 1 - Math.exp(-dt * 6));
      this.camera.updateProjectionMatrix();
    }
    const baseDist = this.camDistOverride || (this.interior ? 17 : this.photoMode ? 18 : this.state === 'title' ? 34 : 29);
    const dist = baseDist * (this.interior ? 1 : (this.camZoom || 1));
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camY + dist * preset.yK, this.camPos.z + dist * preset.zK + (Math.random() - 0.5) * s);
    this.camera.lookAt(this.camPos.x, this.camY + (preset.fov >= 34 ? 0.5 : 0), this.camPos.z);
    this.sun.position.set(this.camPos.x - 12, 26, this.camPos.z + 8);
    this.sun.target.position.set(this.camPos.x, 0, this.camPos.z);
  }
}
