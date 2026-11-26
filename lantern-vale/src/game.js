import { Weather } from './weather.js';
import { bindGuild, updateRaid } from './guild.js';
import { loreHook, bossDisplayName, townLines, LORE_DATA } from './lore.js';
import { FIELDS, FIELD_BOSS_SPEC, fieldBiome, awardKill, grantExperience, setupField, tickField, useFieldSpot, leaveGrave, refreshGraveSpot, rememberGear, restoreGear } from './frontier.js';
import { FIELD_BLUEPRINTS } from './field_blueprints.js';
import { getTerrainEffect, updateFieldTerrainFx, updateRealmRule } from './terrain_fx.js';
import { updateFlame, onBasicHit, onKill as onFlameKill, onPlayerHurt as onFlameHurt, findRespawn, applyRespawnState, FLAME_CFG } from './flame.js';
import { syncLightRings } from './flame_fx.js';
import { buildDungeonScenery } from './dungeon_scene.js';
import { CLASSES, ensurePuzzle, computeBoard, ALL_GEMS, addGemToBag } from './puzzle.js';
import { dayInfo, findSecondClass, buildDungeonLandmark, tickSkyFeatures, buildInterior } from './world_alive.js';
import { buildHarborTown, buildFerryBoat, buildWoodenPier } from './harbor.js';
import { addGearToBag } from './physbag.js';
import { t } from './i18n.js';
import * as THREE from 'three';
import { World, toonMat, HALF, windU } from './world.js';
import { preloadNatureAssets, attachMonsterGlb, attachLandmarkGlb } from './assets.js';
import { BIOMES, mulberry32, clamp, lerp, angleLerp, rand, pick } from './util.js';
import { buildTownScenery, buildGuildKiosk, buildAwakenAltar, buildWardrobe, buildSheep, TOWN_LAYOUT, buildCottage } from './town.js';
import { loadSettings, applySettings, buildSettingsUI, DIFFICULTY_MODES } from './settings.js';
import { getFieldDanger } from './progression.js';
import { pickHotspots, getFieldHotspot, checkTriggerIcd, foldExcessProjectiles, getFerrySchedule, FERRY_BUFF_MS, getWeeklySpireInfo, mentorDamageScale, getClassTeamRole, parseChatCommand, muteUser, unmuteUser, isMutedUser, DEFAULT_FEATURE_FLAGS } from './mmo_protocol.js';
import { showWeapon, applyCosmetics, buildPlayer, buildNPC, buildSlime, buildThorn, buildBoar, buildMoth, buildSkyRay, buildGolem, buildStag, buildArch, buildHouse, buildFountain, buildBoard, buildStall } from './models.js';
import { Net } from './net.js';
import { Meta } from './meta.js';
import { AmbushTrial, AMBUSH_SEED, AMBUSH_START, AMBUSH_BOAR, AMBUSH_LAYOUTS, hitsAmbushCover } from './ambush_trial.js';
import { buildPanels } from './panels.js';
const EMOTES = ['嗨～', '♥', '哈哈', 'zZ'];
const meleeReach = p => (p.air ? 2.9 : 2.3) * (1 + p.stats.area / 100);
import { HOODS } from './characters.js';
import { createModularHero, CHAR_CATALOG, normalizeCharacterLook } from './char_rig.js';
import { VfxEngine } from './vfx_engine.js';
import { resolveArtId, itemIconUrl } from './itemdb.js';
import { makeItem, itemLines, itemScore, RARITY, SLOTS, rollBoons, BOONS, tierInfo, corruptItem, canEquipItem, itemReqLevel } from './loot.js';
import { activeMountDef, buildMountMesh } from './mounts.js';
import { rollSoulDrop, activeSouls, soulTier } from './souls.js';
import { ensureAtlas, computeAtlasSummary } from './atlas.js';
import { initParts, resolveHitPart, damagePart, partStatusText } from './parts.js';
import { SURFACE_DEFS, resolveSurfaceReaction, inferElement } from './elements.js';
import { createTideState, resetTide, cycleUltimate, onTideKill, rekindleTide, castUltimate, tickTide, triggerTideDemo } from './tide.js';
import { assignEliteAffixes, tickEliteAffixes, onEliteDeathAffix, hasAffix, computeSurvivorStatBonuses, computeTalentBonuses, cashOutSpoils, loseSpoilsOnDeath, computeCombatPower } from './survivor.js';
import { computeAllocatedBonuses, computeSetBonuses, computeBestiaryBonuses, recordBestiaryKill, recordStoryEvent, computeAdventurerRank, spawnCompanion3D, tickCompanion3D, WORLD_CHAT_LINES, enhanceGlowColor, rollMonsterMatDrop, computeEnhanceResonance, getGuildRepInfo, grantCompanionXp, computeCompanionBondBonuses } from './mmo_rpg.js';
import { computeLifeSkillBonuses, computeRuneBonuses, computeTitleBonuses, syncUnlockedTitles, getActiveTitleText, rollRuneDrop, addDailyActivity, createWorldBossState, tickWorldBoss, onWorldBossHit, onWorldBossDefeated, spawnSimAdventurers, tickSimAdventurers, clearSimAdventurers, getSimConfig, reactSimToPlayerEmote, onPlayerHelpSimKill } from './mmo_world.js';
import { computePotentialBonuses, computeTowerBonuses, computePartySynergyBonuses, getPartyIds, getActivePartySynergy, createDynEventState, tickDynamicEvent, onDynEventEnemyKilled, towerFloorSpec, claimTowerFloorClear, claimOfflineRewards, MAX_TOWER_FLOOR } from './mmo_endgame.js';
import { createAutopilotState, isAutopilotActive, manualSparkMult, toggleAutopilot, onAutopilotKill, tickAutopilot, AUTO_RATES } from './autopilot.js';
import { installDebugger } from './debugger.js';
import { MEADOW_CAVE, enterMeadowCave, advanceMeadowCave } from './meadow_cave.js';
import { completeMeadowObjective, syncMeadowExpedition, meadowExpedition } from './expedition.js';

function disposeObj3D(root) {
  if (!root || !root.traverse) return;
  root.traverse(o => {
    if (o.geometry && !o.userData?.sharedGeo && o.geometry.dispose) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.dispose && !o.userData?.sharedMat) m.dispose();
      }
    }
  });
}

export const ELITE_MODS = [
  { id: 'molten', name: '🔥 熔岩步', color: 0xff6a30, status: 'burn' },
  { id: 'storm',  name: '⚡ 雷鳴環', color: 0xc88cff, status: 'shock' },
  { id: 'frost',  name: '❄️ 霜甲護體', color: 0x7ae8ff, status: 'freeze' },
  { id: 'haste',  name: '💨 疾風狂暴', color: 0xffe480, status: null },
];

const V2 = THREE.Vector2, V3 = THREE.Vector3;
const tmp2 = new V2(), tmp3 = new V3(), _dirP = new V2(), _flowV = new V2();

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

const _dropIconMats = new Map();
function dropIconMaterial(artId) {
  let m = _dropIconMats.get(artId);
  if (!m) {
    const tex = new THREE.TextureLoader().load(itemIconUrl(artId, 128));
    tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    _dropIconMats.set(artId, m);
  }
  return m;
}

export class Game {
  constructor(pipe, ui, audio, trialOrder = null) {
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
    this.vfx = new VfxEngine(this.scene);
    this.keys = {}; this.mouse = { x: 0, y: 0, l: false, r: false }; this.aim = new V3();
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new V3(0, 1, 0), 0);
    this.state = 'title'; this.time = 0; this.shake = 0; this.hitstop = 0; this.hurtFlash = 0; this.fade = 0;
    this.camPos = new V3(0, 20, 14);
    this.flowTimer = 0;
    this.net = new Net(); this.remotes = new Map(); this.townGroup = null; this.party = ''; this.bots = [];
    this.ambushTrial = trialOrder ? new AmbushTrial(this, trialOrder) : null;
    this.meta = new Meta(0, !!trialOrder); this.pickups = []; this.spots = []; this.talked = new Set();
    this.playerName = '旅人'; this.hoodIdx = 0; this.posT = 0;
    this.dayTime = 0.28; this.isNight = false; this.campfires = []; this.prisms = []; this.interior = null; this.photoMode = false;
    this.recallT = 0; this.sailing = null; this.lastTown = -1; this.waypoint = null; this.mapPin = null; this.worldBoxes = [];
    this.zoneStates = new Map(); this.camZoom = 1.0; this.camYaw = 0.62; this.camPunch = 0; this.exitCooldown = 0; this.groundZones = []; this.physProps = []; this.mount = null; this.beams = []; this._fadedMats = new Map(); this.combo = { count: 0, timer: 0 }; this.glideTrails = []; this.sheep = []; this.shrineBuffs = { fury: 0, frost: 0, gold: 0, sheep: 0 }; this.tide = createTideState(); this.autopilot = createAutopilotState();
    this.dev = { on: false, god: false, noCd: false, fastMove: false };
    this.runStats = { synergyProcs: 0, partsBroken: 0, campfires: 0, healsDone: 0, dmgMitigated: 0 };
    this.puzzleIcd = new Map();
    this.onAutoKill = (d) => onAutopilotKill(this, d);
    this.toggleAutopilot = (m) => toggleAutopilot(this, m);
    this.dbg = trialOrder ? null : installDebugger(this);
    this.bindInput();
    this.setupNet(); bindGuild(this);
    // title scene: a pretty room in the background
    this.player = this.makePlayer();
    this.loadRoom(0, null, true);
    if (trialOrder) { this.state = 'trial-ready'; return; }
    preloadNatureAssets(() => {
      if (this.state === 'title') this.loadRoom(0, null, true);
      else if (this.state === 'play' && !this.interior && !this.sailing) {
        if (this.depth === -1) this.enterTown();
        else if (this.depth === -2) this.enterHarbor();
      }
    });
  }

  // ---------------- input ----------------
  bindInput() {
    const CODE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift', KeyQ: 'q', KeyE: 'e', KeyC: 'c', KeyK: 'k', KeyR: 'r', KeyF: 'f', KeyI: 'i', KeyM: 'm', KeyO: 'o', KeyB: 'b', KeyP: 'p', KeyH: 'h', KeyG: 'g', KeyV: 'v', KeyZ: 'z', KeyX: 'x', Slash: '/', Tab: 'tab', Escape: 'escape', Enter: 'enter', KeyT: 't', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0' };
    const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
    addEventListener('keydown', e => {
      if (e.defaultPrevented || e.isComposing || this.ui.blocksGameKey?.(e)) return;
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a[href], summary')) return;
      if (this.ui.mapDialog?.open) {
        if (e.code === 'KeyM' || e.code === 'Escape') {
          e.preventDefault();
          if (!e.repeat) this.ui.mapDialog.close();
        }
        return;
      }
      if (this.ui.regionMapOpen && document.getElementById('regionMap')?.contains(document.activeElement)) {
        if (e.code === 'Tab' || (e.target.tagName === 'SELECT' && e.code !== 'Escape')) return;
        if (e.code === 'Escape') {
          this.ui.toggleRegionMap(this);
          e.preventDefault();
          return;
        }
      }
      if (this.raid && e.code === 'Escape') {
        if (this.ui.regionMapOpen) this.ui.toggleRegionMap(this);
        else this.net.send({ t: 'raidLeave' });
        return;
      }
      if (this.raid && e.code === 'Tab') {
        e.preventDefault();
        if (!e.repeat) this.ui.toggleRegionMap(this);
        return;
      }
      if (this.ambushTrial && (this.state !== 'play'
        || !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR'].includes(e.code))) return;
      if (this.state === 'title' && e.code !== 'Escape') return;
      if (typing()) {
        if (document.activeElement.id === 'chatIn' && (e.code === 'Escape' || e.code === 'Enter')) this.ui.chatKey?.(e);
        return;
      }
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
        if (k === 'g' && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen && !this.ui.codexOpen) { this.toggleMount(); return; }
        if (k === 'v' && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen && !this.ui.codexOpen) { if (isAutopilotActive(this)) toggleAutopilot(this, 'off', 'manual'); if (e.shiftKey) cycleUltimate(this); else castUltimate(this); return; }
        if (k === 'z' && !e.repeat && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen && !this.ui.codexOpen) {
          if (e.shiftKey) toggleAutopilot(this, this.autopilot.mode === 'full' ? 'assist' : 'full');
          else toggleAutopilot(this);
          return;
        }
        if (k === 'tab' && !this.ui.panelOpen && !this.ui.setOpen) { this.ui.toggleRegionMap?.(this); return; }
        if (k === 'k' && !this.ui.panelOpen && !this.ui.setOpen && !this.ui.invOpen) { this.ui.openPuzzle?.(); return; }
        if (k === ' ') {
          const now = performance.now(), dbl = now - (this.lastSpace || 0) < 280; this.lastSpace = now;
          if (this.player.air || this.player.climbing) this.tryJump();          // 空中/攀爬：維持原本行為（按住滑翔）
          else if (dbl) { this.lastSpace = 0; this.player.roll = 0; this.tryJump(); } // 連按兩下：取消翻滾、跳起（按住第二下＝滑翔）
          else this.tryRoll();                                                  // 單擊：翻滾
        }
        if (this.ambushTrial) {
          if (k === 'r') this.tryFlask();
          return;
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
        if (k === 'o' && !this.ui.setOpen && !this.ui.panelOpen && !this.ui.invOpen) this.ui.toggleSimRoster?.(this);
        if (k === 'escape') { if (this.ui.simInspectOpen) this.ui.closeSimInspect?.(); else if (this.ui.simRosterOpen) this.ui.closeSimRoster?.(); else if (this.ui.codexOpen) this.ui.closeCodex?.(); else if (this.photoMode) this.togglePhotoMode(); else if (this.ui.regionMapOpen) this.ui.toggleRegionMap?.(this); else if (this.ui.panelOpen) this.ui.closePanel(); else if (this.ui.setOpen) this.ui.closeSettings(); else if (this.ui.invOpen) this.ui.toggleInv(this); else this.ui.toggleSettings(); }
      } else if (this.state === 'boon' && ['1', '2', '3'].includes(k)) this.ui.pickBoonIndex(+k - 1);
    });
    addEventListener('keyup', e => { const k = CODE[e.code] ?? e.key.toLowerCase(); this.keys[k] = false; this.keys[e.key.toLowerCase()] = false; });
    const cv = this.pipe.renderer.domElement;
    addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    cv.addEventListener('mousedown', e => {
      this.audio.init(); window.focus(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (e.button === 0 && this.state === 'play' && this.hoveredWorld && ['remote', 'spot', 'drop', 'sheep'].includes(this.hoveredWorld.kind)) {
        const h = this.hoveredWorld;
        const nearHostile = h.kind === 'drop' && this.enemies.some(en => !en.dead && en.pos.distanceTo(this.player.pos) < 4.5);
        if (!nearHostile && (h.kind !== 'remote' || h.obj?.bot)) {
          this.interactTarget = { kind: h.kind, obj: h.obj, x: h.x, z: h.z };
          this.audio.sfx('ui');
          return;
        }
      }
      this.interactTarget = null;
      if (e.button === 0) this.mouse.l = true; if (e.button === 2) this.mouse.r = true; cv.classList.add('aiming');
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; if (!this.mouse.l && !this.mouse.r) cv.classList.remove('aiming'); });
    addEventListener('contextmenu', e => {
      if (!e.target.closest?.('input, textarea, [contenteditable]')) e.preventDefault();
    });
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
    if (this.player?.heroRig) this.player.heroRig.dispose();
    const m = buildPlayer(...HOODS[this.hoodIdx], undefined, this.character);
    m.root.scale.setScalar(1.25);
    this.scene.add(m.root);
    const look = normalizeCharacterLook(this.character);
    const heroRig = createModularHero(look, {
      scale: 0.88,
      toon: true,
      weapon: this.meta?.p?.weapon || 'staff',
      initialState: 'idle',
      onReady: () => { m.body.visible = false; },
    });
    m.root.add(heroRig.root);
    const p = {
      m, heroRig, combatT: 0, pos: new V3(), vel: new V3(), facing: 0, hp: 100, mana: 50, equip: { head: null, staff: null, body: null, cloak: null, hands: null, feet: null, charm: null, relic: null },
      boons: [], skills: { slam: false, wisp: false }, cds: { atk: 0, bolt: 0, roll: 0, slam: 0, wisp: 0 }, skillCds: [0, 0, 0, 0], hotbar: [],
      roll: 0, rollDir: new V3(), iframes: 0, flask: { charges: 1, max: 1, prog: 0 }, healOver: 0,
      statuses: { poison: 0, freeze: 0, chill: 0, burn: 0, shock: 0, overload: 0 }, statusTick: 0, castCombo: 0, castComboT: 0, prevVx: 0, prevVz: 0,
      y: 0, vy: 0, air: false, climbing: false, gliding: false, wall: false, stamina: 100, lastLow: new V3(), stepT: 0, swing: 0, swingT: 0, swingCount: 0, inputBuf: null, galeBuff: false, wisps: [], wispT: 0, walkT: 0, kills: 0, dmgDealt: 0, stats: {},
    };
    p.equip.staff = makeItem(mulberry32(5), 0, 0, 'staff');
    const hl = this.meta.heirloom; if (hl) p.equip[hl.slot] = hl;
    restoreGear(this, p);
    return p;
  }
  recalc() {
    const p = this.player;
    const profile = this.meta.p;
    const lv = Math.max(1, profile.level || 1);
    // 硬核循序開局數值（Lv.1 基礎 5 傷 / 62 HP / 35 MP，必須靠操作、鍛造與天賦逐步變強）
    const s = {
      baseDmg: 5 + Math.floor((lv - 1) * 1.05), dmgPct: 0, addFire: 0, atkSpd: 0,
      crit: 5 + Math.floor((lv - 1) * 0.35), critMult: 150,
      maxHp: 62 + (lv - 1) * 5, lifeOnHit: 0, moveSpd: 0, cdr: 0,
      mana: 35 + Math.floor((lv - 1) * 1.4), manaRegen: 0, area: 0, armor: 0, proj: 1, regen: 0, rollCdr: 0,
      resFire: 0, resIce: 0, resLightning: 0, resPoison: 0, allRes: 0,
    };
    const cls = CLASSES[this.character?.job ?? 0] || CLASSES[0];
    for (const [k, v] of Object.entries(cls.bonuses)) {
      // 衛士減傷隨等級循序成長（Lv.1 8% → Lv.15+ 15%）
      s[k] = (s[k] || 0) + (k === 'armor' ? Math.min(v, 8 + Math.floor(lv * 0.5)) : v);
    }
    const baseFlaskMax = lv >= 14 ? 3 : lv >= 5 ? 2 : 1;
    if (p.flask) p.flask.max = Math.max(baseFlaskMax, p.flask.max || 1);
    const sc = findSecondClass(profile.secondClass);
    if (sc) for (const [k, v] of Object.entries(sc.bonuses)) s[k] = (s[k] || 0) + v;
    if (p.m?.aura) { p.m.aura.visible = !!sc; if (sc && p.m.auraMat) p.m.auraMat.color.setHex(sc.aura); }
    if (this.tide && !this.tide._ultJobSynced) {
      this.tide.ultIndex = Math.max(0, Math.min(4, cls.id || 0));
      this.tide._ultJobSynced = true;
    }
    if (p.m?.pilotoAura) {
      p.m.root.remove(p.m.pilotoAura);
      p.m.pilotoAura.userData?.dispose?.();
      p.m.pilotoAura = null;
    }
    if (sc && this.vfx) {
      p.m.pilotoAura = this.vfx.createHeroAura(sc.auraTheme || cls.auraTheme || 'arcane', 1.85);
      p.m.root.add(p.m.pilotoAura);
    }
    const pz = ensurePuzzle(profile, cls.id);
    p.hotbar = computeBoard(pz.presets[pz.activePreset] || [], pz.partyGem?.id || null);
    showWeapon(p.m, profile.weapon);
    applyCosmetics(p.m, profile.cosmetics);
    this.applyCharacterLook();
    const attackName={staff:'杖',bow:'弓',blades:'刃',shield:'盾'}[profile.weapon] || '杖';
    const attackSlot=document.getElementById('sk-lmb');
    if (attackSlot) { const ic = attackSlot.querySelector('.ic'); if (ic) ic.textContent = attackName; attackSlot.title = attackName + '擊'; }
    // 硬核成長：接入「星燈聖殿永久天賦」「四維屬性配點」「裝備套裝」「怪物圖鑑精通」「冒險者階級」與「連殺狂熱」
    const tb = computeTalentBonuses(profile);
    const alloc = computeAllocatedBonuses(profile);
    const best = computeBestiaryBonuses(profile);
    for (const src of [tb, alloc, best.stats]) {
      for (const [k, v] of Object.entries(src || {})) {
        if (typeof v === 'number' && k in s) s[k] = (s[k] || 0) + v;
      }
    }
    if (this.tide?.sv) {
      const svb = computeSurvivorStatBonuses(this.tide.sv);
      if (svb.moveSpd) s.moveSpd += svb.moveSpd;
      if (svb.crit) s.crit += svb.crit;
    }
    if (profile.weapon === 'blades') s.atkSpd += 18;
    if (profile.weapon === 'shield') s.armor += 15;
    if (profile.gem) { s.addFire += 4; p.skills.slam = true; }
    if (profile.mealUntil > Date.now()) s.regen += Math.round(2 * (profile.mealBoost || 1));
    if ((profile.ferryBuffUntil || 0) > Date.now()) s.moveSpd += 10;
    const specials = new Set();
    for (const it of Object.values(p.equip)) if (it) {
      for (const m of [it.corruptImplicit, it.implicit, ...it.mods]) if (m) s[m.k] = (s[m.k] || 0) + m.v;
      if (it.special) specials.add(it.special);
    }
    p.souls = activeSouls(profile);
    for (const soulDef of Object.values(p.souls)) {
      const mult = soulTier(profile, soulDef.id).mult || 1;
      for (const [k, v] of Object.entries(soulDef.bonuses || {})) s[k] = (s[k] || 0) + Math.round(v * mult);
    }
    // Phase M7A：每週星穹塔四大主題實戰效果
    const setRes = computeSetBonuses(p.equip);
    p.activeSets = setRes.active;
    for (const [k, v] of Object.entries(setRes.stats || {})) s[k] = (s[k] || 0) + v;
    // MMORPG 全身強化共鳴（+3/+5/+7/+9）、公會聲望被動、AI 隊友羈絆被動
    const enhRes = computeEnhanceResonance(p.equip);
    p.enhanceResonance = enhRes;
    for (const [k, v] of Object.entries(enhRes.bonuses || {})) s[k] = (s[k] || 0) + v;
    const gRep = getGuildRepInfo(profile);
    if (gRep.dmgPct) s.dmgPct += gRep.dmgPct;
    if (gRep.maxHp) s.maxHp += gRep.maxHp;
    const compBond = computeCompanionBondBonuses(profile);
    for (const [k, v] of Object.entries(compBond || {})) if (k in s) s[k] = (s[k] || 0) + v;
    // 四大生活副職被動、裝備符文石加成、稱號收藏永久被動
    const lifeBon = computeLifeSkillBonuses(profile);
    for (const [k, v] of Object.entries(lifeBon || {})) if (k in s) s[k] = (s[k] || 0) + v;
    const runeRes = computeRuneBonuses(p.equip);
    p.runeBonuses = runeRes.stats;
    for (const [k, v] of Object.entries(runeRes.stats || {})) if (k in s) s[k] = (s[k] || 0) + v;
    syncUnlockedTitles(profile, { equip: p.equip });
    const titleBon = computeTitleBonuses(profile);
    s.dmgPct += titleBon.dmgPct;
    s.maxHp += titleBon.maxHp;
    // 裝備潛能詞綴（R→SR→SSR→UR）、無盡試煉秘境塔永久被動、3 人小隊陣型光環
    const potBon = computePotentialBonuses(p.equip).stats;
    for (const [k, v] of Object.entries(potBon || {})) if (k in s) s[k] = (s[k] || 0) + v;
    p.bossDmgPct = potBon.bossDmgPct || 0;
    const twBon = computeTowerBonuses(profile);
    s.dmgPct += twBon.dmgPct || 0;
    s.maxHp += twBon.maxHp || 0;
    const synRes = computePartySynergyBonuses(profile);
    p.partySynergy = synRes.synergy;
    for (const [k, v] of Object.entries(synRes.bonuses || {})) if (k in s) s[k] = (s[k] || 0) + v;
    // 四大元素抗性彙整（allRes 同步加成，高危 Lv.15+ 地圖帶有 -15% 深淵元素穿透，最高抗性上限 75%）
    const abyssPen = (this.field && (FIELDS[this.field]?.level || 1) >= 15) ? 15 : 0;
    for (const rk of ['resFire', 'resIce', 'resLightning', 'resPoison']) {
      s[rk] = Math.max(-30, Math.min(75, (s[rk] || 0) + (s.allRes || 0) - abyssPen));
    }
    const prevCp = p.combatPower || 0;
    p.combatPower = computeCombatPower(profile, s, p.equip);
    const advRank = computeAdventurerRank(profile, p.combatPower);
    p.advRank = advRank;
    if (advRank.bonusDmgPct) s.dmgPct += advRank.bonusDmgPct;
    if (prevCp > 0 && p.combatPower > prevCp + 8 && this.state === 'play') {
      this.ui?.toast(`⚔️ 戰力評分提升！${prevCp} → ${p.combatPower}（+${p.combatPower - prevCp} CP · ${advRank.rank}級）`, '#ffd85a');
    }
    if (p.m?.root) {
      const maxEnh = Math.max(0, ...Object.values(p.equip || {}).map(it => it?.enhance || 0));
      const gCol = enhanceGlowColor(maxEnh);
      if (gCol && !p.m._enhGlow) {
        p.m._enhGlow = new THREE.Mesh(
          new THREE.RingGeometry(0.52, 0.64, 24),
          new THREE.MeshBasicMaterial({ color: gCol, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
        );
        p.m._enhGlow.rotation.x = -Math.PI / 2;
        p.m._enhGlow.position.y = 0.06;
        p.m.root.add(p.m._enhGlow);
      }
      if (p.m._enhGlow) {
        p.m._enhGlow.visible = !!gCol;
        if (gCol) p.m._enhGlow.material.color.setHex(gCol);
      }
    }
    if (this.isWeeklySpire && !this.field) {
      const wId = getWeeklySpireInfo().theme.id;
      if (wId === 'sakura') { s.moveSpd += 18; s.atkSpd += 20; }
      else if (wId === 'ember') { s.dmgPct += 25; }
      else if (wId === 'low_grav') { s.crit += 20; }
      else if (wId === 'storm') { s.cdr += 15; }
    }
    // Phase M8A/M9：組隊或連線時自動啟動職業團隊軟分工光環
    if (this.party || this.net?.ok) {
      const role = getClassTeamRole(cls.id);
      for (const [k, v] of Object.entries(role.bonuses || {})) s[k] = (s[k] || 0) + v;
    }
    const B = id => p.boons.filter(b => b === id).length;
    s.maxHp += 30 * B('thick');
    s.proj += B('multi');
    s.moveSpd += 12 * B('swift'); s.atkSpd += 12 * B('swift');
    s.crit += 8 * B('sharp'); s.critMult += 30 * B('sharp');
    if (B('glass')) { s.dmgPct += 40; s.maxHp = Math.round(s.maxHp * 0.85); }
    // 自我審查修正：保留 Lv.1(1瓶) → Lv.5(2瓶) → Lv.14(3瓶) 循序藥瓶上限，不再被硬覆蓋回 3
    p.flask.max = baseFlaskMax + B('flask');
    p.flask.charges = Math.min(p.flask.charges, p.flask.max);
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
      enemies: this.enemies.filter(e => !e.dead && !e.rival && !e.expeditionId).map(e => ({
        type: e.type, x: e.pos.x, z: e.pos.z, hp: e.hp, maxHp: e.maxHp,
        elite: !!e.elite, spawnIndex: e.spawnIndex, level: e.level, legendary: !!e.legendary,
      })),
      respawns: (this.respawns || []).map(r => ({ ...r })),
      drops: this.drops.filter(d => d.kind === 'item').map(d => ({ x: d.g.position.x, z: d.g.position.z, item: d.item })),
      campfires: (this.campfires || []).map(c => ({ x: c.x, y: c.y, z: c.z })),
      hiddenSpots: (this.spots || []).map((s, i) => !s.expeditionId && s.mesh?.visible === false ? i : -1).filter(i => i >= 0),
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
      if (id === 1 && e.type === 'slime') e.meadowPounce = true;
    }
    for (const sd of st.drops || []) this.dropItem(sd.x, sd.z, sd.item, true);
    for (const cf of st.campfires || []) this.spawnCampfireAt(cf.x, cf.y, cf.z);
    for (const idx of st.hiddenSpots || []) if (this.spots[idx]?.mesh) this.spots[idx].mesh.visible = false;
    return true;
  }
  applyCharacterLook() {
    const p = this.player;
    if (p?.heroRig) p.heroRig.setLook(this.character, this.meta?.p?.weapon || 'staff');
  }
  enterField(id, fromDir = 'south') {
    if (!FIELDS[id]) return;
    if (this.waypoint?.id === id) this.waypoint = null;
    if (this.field && this.field !== id) this.saveFieldState();
    if (!this.field && this.depth >= 0 && !this.runEnded) this.bankRun(1);
    this.worldEvent = null; this.towerFloor = 0; this.field = id; this.originField = id; this.state = 'play';
    this.exitCooldown = 1.6;
    const restored = this.zoneStates.has(id);
    this.loadRoom(FIELDS[id].biome * 3, null, false, { fromDir });
    setupField(this, restored);
    if (restored) this.restoreFieldState(id);
    if (id === 12) {
      // 紅楓工坊谷：放養 4 隻蓬鬆小綿羊於工坊草地（致敬螢幕擷圖 5）
      for (let i = 0; i < 4; i++) {
        const sp = this.world.randomWalkable(this.rng, this.player.pos, 10 + i * 6);
        const sm = buildSheep();
        sm.position.set(sp.x, this.world.gh(sp.x, sp.z), sp.z);
        this.scene.add(sm);
        this.sheep.push({ mesh: sm, hx: sp.x, hz: sp.z, x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, f: i * 1.4, wait: 1 + i, hop: 0, ph: i * 1.9 });
      }
    }
    // 抵達新地圖後，將玩家放在「返回上一張地圖的傳送門」旁 4.8m 內側（並設冷卻防誤觸）
    const matchExit = this.exits.find(x =>
      (fromDir === 'north' && x.type === 'dungeon') ||
      (fromDir === 'east' && x.type === 'nextField') ||
      (fromDir === 'south' && (x.type === 'prevField' || x.type === 'town'))
    );
    if (matchExit) {
      const ang = Math.atan2(-matchExit.x, -matchExit.z);
      const sx = matchExit.x + Math.sin(ang) * 4.8, sz = matchExit.z + Math.cos(ang) * 4.8;
      if (this.world.isLand(sx, sz)) {
        this.player.pos.set(sx, this.world.gh(sx, sz), sz);
        this.player.y = this.player.pos.y;
        this.player.facing = ang;
        this.camPos.set(sx, 0, sz);
      }
    }
    if (!this.hotspots || Date.now() >= (this.hotspots.nextSwitchMs || 0)) this.hotspots = pickHotspots();
    const hs = getFieldHotspot(id, this.hotspots);
    if (hs) {
      this.ui.toast(`${hs.name} 進行中！本島享有「${hs.bonus}」`, '#ffd85a');
    }
    const dng = getFieldDanger(FIELDS[id].level, this.meta?.p?.level || 1);
    if (dng.redZone) {
      this.ui.toast(`🔴 越級警戒：${FIELDS[id].name}（建議 Lv.${FIELDS[id].level}）敵方減傷 45% · 傷害 ×1.5`, '#ff7a7a');
    }
    syncMeadowExpedition(this);
    if (id === 1) {
      const entrance = this.exits.find(exit => exit.type === 'dungeon');
      if (entrance) this.spots.push({ kind: 'meadowCave', label: '查看草原洞窟', x: entrance.x, z: entrance.z, top: 4.4 });
    }
    spawnSimAdventurers(this);
  }
  startMeadowCave(tier) {
    if (this.state !== 'play' || this.field !== 1 || this.nearSpot()?.kind !== 'meadowCave') return false;
    return this.startMeadowCaveDirect(tier);
  }
  startMeadowCaveDirect(tier) {
    const cave = enterMeadowCave(this.meta.p, tier);
    if (!cave) return false;
    this.meta.save();
    this.ui.closePanel();
    this.state = 'transition';
    this.audio.sfx('warp');
    this.ui.wipe(() => this.startRun({ cave }));
    return true;
  }

  startRun(opts = {}) {
    if (this.field) this.saveFieldState();
    this.originField = this.field || 1;
    this.field = 0; this.towerFloor = 0;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer();
    this.recalc(); this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.isWeeklySpire = !!opts.weeklySeed;
    this.runSeed = opts.weeklySeed
      ? opts.weeklySeed
      : (this.party ? [...this.party].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000000 : (Math.random() * 1e6) | 0) + (this.originField - 1) * 997;
    this.runStart = performance.now(); this.meta.runShards = 0; this.meta.p.runs++; this.meta.save(); this.runEnded = false;
    this.portalsLeft = opts.cave ? 1 : 6;
    this.runStats = { synergyProcs: 0, partsBroken: 0, campfires: 0, healsDone: 0, dmgMitigated: 0 };
    this.state = 'play';
    this.loadRoom(0, null, false, { cave: opts.cave });
    if (this.isWeeklySpire) {
      const ws = getWeeklySpireInfo();
      this.ui.toast(`🗼 進入本週無盡星穹塔（種子 #${ws.seed} · ${ws.theme.name}）`, '#c88cff');
    }
  }
  startTowerFloor(floor = 1) {
    if (this.field) this.saveFieldState();
    this.field = 0; this.isWeeklySpire = false;
    this.towerFloor = Math.max(1, Math.min(MAX_TOWER_FLOOR, Math.floor(floor)));
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer();
    this.recalc(); this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.runSeed = 88000 + this.towerFloor * 131;
    this.runStart = performance.now(); this.meta.runShards = 0; this.runEnded = false;
    this.portalsLeft = 3;
    this.state = 'play';
    this.loadRoom(Math.min(8, Math.floor((this.towerFloor - 1) / 5)), null);
  }
  enterTown(fromDir = null) {
    if (this.waypoint?.id === 0) this.waypoint = null;
    if (this.tide?.sv) {
      const cashed = cashOutSpoils(this.tide.sv, this.meta?.p);
      if (cashed.coins > 0 || cashed.shards > 0) {
        this.meta.save();
        this.ui?.toast(`💰 攜帶戰利品袋安全回城！+${cashed.coins} 金幣 · +${cashed.shards} 星砂`, '#ffd85a');
      }
    }
    this.draftPause = false;
    if (this.field) this.saveFieldState();
    if (this.state === 'play' && !this.field && this.depth >= 0 && this.runStart && !this.runEnded) this.bankRun(1);
    this.field = 0; this.towerFloor = 0; this.lastTown = -1; this.recallT = 0;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer(); this.recalc();
    this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.state = 'play'; this.player.m.root.visible = true;
    this.loadRoom(-1, null, false, { fromDir });
    const off = claimOfflineRewards(this.meta?.p);
    if (off) {
      this.meta.save();
      this.vfx?.spawnLifeSkillFx('offline', this.player.pos.x, this.player.y || 0, this.player.pos.z);
      this.ui?.toast(`🌙 離線修煉見聞（${off.hoursText}）：+🪙${off.coins} · +✨${off.xp}經驗 · +💎${off.shards}${off.cubes ? ` · +🎲${off.cubes}潛能魔方` : ''}`, '#ffd85a');
    }
  }
  enterHarbor(fromDir = null) {
    if (this.waypoint?.id === 100) this.waypoint = null;
    if (this.field) this.saveFieldState();
    if (this.state === 'play' && !this.field && this.depth >= 0 && this.runStart && !this.runEnded) this.bankRun(1);
    this.field = 0; this.lastTown = -2; this.recallT = 0;
    for (const e of this.enemies) this.scene.remove(e.m.root);
    this.scene.remove(this.player.m.root);
    this.player = this.makePlayer(); this.recalc();
    this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana;
    this.state = 'play'; this.player.m.root.visible = true;
    this.loadRoom(-2, null, false, { fromDir });
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
    const sx = 0, sz = 29.8;
    const tx = 0, tz = 48.0;
    boat.position.set(sx, -0.02, sz);
    this.scene.add(boat);
    this.sailing = { dest, t: 0, dur: 2.6, boat, sx, sz, tx, tz };
    this.audio.sfx('glide');
    this.ui.banner(dest === 'harbor' ? '⛵ 揚帆啟航 · 海風港鎮' : '⛵ 乘風返航 · 燈谷鎮', '從木造碼頭駛入深海波浪中…');
  }
  get zone() { if (this.field) return 'field:' + this.field; return this.state === 'title' ? 'title' : this.depth === -2 ? 'harbor' : this.depth < 0 ? 'town' : `run:${(!this.caveRun && this.party) || 'solo' + (this.net.id || '')}:${this.depth}`; }
  biomeFor(depth) { return depth >= 9 ? 3 : ((Math.floor(depth / 3) + (FIELDS[this.originField]?.biome || 0)) % 4); }
  loadRoom(depth, reward, title = false, extra = {}) {
    this.depth = depth; this.reward = reward; this.exitCooldown = 1.6;
    this.caveRun = extra.cave || null;
    const cave = this.caveRun && MEADOW_CAVE[this.caveRun.tier];
    const trial = this.ambushTrial?.active;
    const ambushRoom = trial || (title && this.ambushTrial);
    this.meadowLocations = null;
    this.mapPin = null; this.checkpoints = []; this.updrafts = [];
    resetTide(this);
    clearSimAdventurers(this);
    this.worldBoss = createWorldBossState();
    this.dynEvent = createDynEventState();
    if (isAutopilotActive(this)) toggleAutopilot(this, 'off', 'zone');
    if (this.autopilot?.wispMesh) { this.scene.remove(this.autopilot.wispMesh); this.autopilot.wispMesh = null; }
    this.camYaw = 0.62;
    const dropObj = (obj) => { if (obj) { this.scene.remove(obj); disposeObj3D(obj); } };
    if (this.interior) { dropObj(this.interior.group); this.interior = null; }
    if (this.sailing?.boat) { dropObj(this.sailing.boat); } this.sailing = null; this.recallT = 0;
    if (this.world?.group) this.world.group.visible = true;
    for (const cf of this.campfires || []) { dropObj(cf.grp); } this.campfires = [];
    for (const pr of this.prisms || []) { dropObj(pr.mesh); } this.prisms = [];
    for (const gz of this.groundZones || []) { dropObj(gz.mesh); } this.groundZones = [];
    for (const pp of this.physProps || []) { dropObj(pp.mesh); } this.physProps = [];
    for (const sh of this.sheep || []) { dropObj(sh.mesh); } this.sheep = [];
    for (const bm of this.beams || []) { dropObj(bm.mesh); } this.beams = [];
    this._fadedMats?.clear();
    this._lastHitMats = null;
    for (const e of this.enemies) dropObj(e.m.root);
    for (const a of [...this.projs, ...this.eprojs, ...this.decals, ...this.slashes, ...this.rings]) dropObj(a.mesh);
    for (const d of this.drops) dropObj(d.g);
    for (const k of this.pickups) dropObj(k.g); this.pickups = [];
    this.spots = []; this.worldBoxes = [];
    for (const x of this.exits) dropObj(x.g);
    for (const w of this.player.wisps) dropObj(w.mesh);
    this.player.wisps = [];
    this.enemies = []; this.projs = []; this.eprojs = []; this.decals = []; this.drops = []; this.exits = []; this.slashes = []; this.rings = [];
    this.vfx?.clear();
    this.fx.clear(); this.puffs.clear();
    const town = depth === -1, harbor = depth === -2, anyTown = town || harbor;
    if (this.townGroup) { dropObj(this.townGroup); this.townGroup = null; this.chimneys = null; }
    for (const b of this.bots) this.removeRemote(b); this.bots = [];
    this.dbg?.log?.(`[ZONE] 載入 ${this.zone}`);
    const bi = (title || anyTown) ? 0 : this.biomeFor(depth);
    const B = ambushRoom ? {
      ...BIOMES[0], name: '岔道伏擊', ground: 0xa4a8b3, sky: 0xe3e7ef, sun: 0xffffff,
      grade: [1, 1, 1], shaft: [0, 0, 0],
    } : cave ? {
      ...BIOMES[0], name: '草原洞窟',
      grass: 0x78796a, grassLight: 0x949486, grassDark: 0x5e625a, plateau: 0x737e78,
      sand: 0x85796c, sandWet: 0x625b58, dirt: 0xa28968,
      rock: 0x929a98, rockDark: 0x555c64,
      sky: 0x9daabb, ground: 0xc49e74,
      waterDeep: [0.08, 0.17, 0.22], waterShallow: [0.17, 0.35, 0.40], waterLine: [0.36, 0.55, 0.56],
    } : this.field ? fieldBiome(this.field) : harbor ? { ...BIOMES[0], name: '海風港鎮', ground: 0xe6d29a, sky: 0x9ed8ff, sun: 0xfff5d6 } : BIOMES[bi]; this.biome = B;
    this.boss = null; this.ui.bossBar(false);
    const weather = FIELDS[this.field]?.fog;
    this.scene.fog = cave ? new THREE.Fog(0x252c34, 34, 74) : weather ? new THREE.Fog(weather, 40, 118) : null;
    const boss = depth === 9 && !title && !this.field;
    const seed = cave ? AMBUSH_SEED : this.field ? 7201 + this.field * 319 : title ? 4242 : harbor ? 9002 : town ? 9001 : (this.runSeed || 1) + depth * 101;
    this.rng = mulberry32(seed + 77);
    const { spawn, exits } = ambushRoom
      ? this.world.generateAmbush(B, AMBUSH_START, this.ambushTrial.cover)
      : this.world.generate(seed, B, { boss, town: anyTown, raid: !!extra.raid, cave: !!cave, cardinalExits: !!this.field, blueprint: this.field ? FIELD_BLUEPRINTS[this.field] : null, size: FIELDS[this.field]?.size, exitCount: cave ? 1 : extra.raid ? 0 : this.field ? (FIELDS[this.field + 1] ? 3 : 2) : town ? 1 : harbor ? 0 : boss ? 0 : (depth === 0 ? 2 : (this.rng() < 0.5 ? 2 : 3)) });
    this.sun.color.set(B.sun); this.sun.intensity = B.sunI * 1.45;
    this.hemi.color.set(B.sky); this.hemi.groundColor.set(B.ground); this.hemi.intensity = B.ambient * 1.15;
    this.pipe.postMat.uniforms.uGrade.value.set(...B.grade);
    this.pipe.postMat.uniforms.uCloud.value = ambushRoom ? 0 : B.key === 'snow' ? 0.4 : (anyTown ? 0.45 : 1);
    this.pipe.postMat.uniforms.uShaft.value.set(...B.shaft);
    const p = this.player; p.sitting = null;
    if (town && extra.fromDir === 'north') { p.pos.set(0, 0, -13.0); p.facing = 0; }
    else if (anyTown && extra.fromDir === 'pier') { p.pos.set(0, 0.3, 23.2); p.facing = Math.PI; }
    else { p.pos.set(spawn.x, 0, harbor ? 8.5 : spawn.z); p.facing = Math.PI; }
    p.vel.set(0, 0, 0); p.roll = 0;
    this.camPos.set(p.pos.x, 0, p.pos.z);
    const types = ['item', 'boon', 'heal'];
    const pool = depth === 0 ? ['boon', 'item'] : types.slice().sort(() => this.rng() - 0.5);
    if (town) { this.makeExit(exits[0], 'run'); this.exits[0].on = true; this.buildTown(); spawnSimAdventurers(this); }
    else if (harbor) { this.buildHarbor(); spawnSimAdventurers(this); }
    else if (this.field) {
      this.makeExit(exits[0], 'dungeon'); this.exits[0].on = true;
      if (exits[1]) { this.makeExit(exits[1], this.field === 1 ? 'town' : 'prevField'); this.exits[1].on = true; }
      if (exits[2] && FIELDS[this.field + 1]) { this.makeExit(exits[2], 'nextField'); this.exits[2].on = true; }
    }
    else if (trial) {
      const cover = this.ambushTrial.cover;
      if (cover) this.worldBoxes.push(cover);
    } else if (cave) this.makeExit(exits[0], 'caveReturn');
    else if (this.towerFloor > 0 && !title && !anyTown) {
      if (exits[0]) this.makeExit(exits[0], this.towerFloor < MAX_TOWER_FLOOR ? 'nextTower' : 'town');
      if (exits[1]) this.makeExit(exits[1], 'town');
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
    } else if (cave) {
      this.waves = trial ? [cave.stages[1]] : cave.stages;
      this.waveIdx = this.caveRun.stage - 1;
      this.waveDelay = trial ? 0 : 1.2;
      this.cleared = false;
      this.fade = trial ? 0 : 1;
    } else if (this.field) { this.waveIdx = 0; this.cleared = true; this.fade = 1; } else if (this.towerFloor > 0 && !title) {
      const tSpec = towerFloorSpec(this.towerFloor);
      this.waves = tSpec.waves.map(w => ({ ...w }));
      this.waveIdx = -1; this.waveDelay = 1.0; this.cleared = false;
      this.ui.banner(tSpec.title, `血量 ×${tSpec.hpScale} · 傷害 ×${tSpec.dmgScale} · 通關永久全傷 +1.5%`);
      this.fade = 1;
    } else if (!title) {
      if (boss) this.waves = [{ boss: true }];
      else {
        const nW = depth === 0 ? 1 : 2 + (depth >= 5 ? 1 : 0);
        for (let w = 0; w < nW; w++) this.waves.push({ n: Math.round(3 + depth * 0.7 + w + (depth === 0 ? 0 : 1)) });
      }
      this.waveIdx = -1; this.waveDelay = 1.2; this.cleared = false;
      const atlas = computeAtlasSummary(ensureAtlas(this.meta.p));
      if (atlas.startShrine) {
        this.shrineBuffs.fury = Math.max(this.shrineBuffs.fury || 0, 30);
        this.shrineBuffs.gold = Math.max(this.shrineBuffs.gold || 0, 30);
        this.ui.toast('⚡ 雙重祭壇生效：狂怒與黃金祝福 30 秒！', '#ffd85a');
      }
      const stage = Math.floor(depth / 3) + 1, room = depth % 3 + 1;
      this.ui.banner(boss ? (atlas.twinBoss ? '雙王試煉 · 鹿王林地' : '古樹鹿王的林地') : B.name, boss ? '最終之戰' : `第 ${stage} 區 · 第 ${room} 間 · ${atlas.dangerLabel}`);
      this.fade = 1;
    } else { this.cleared = true; this.waveIdx = 0; }
    if (!trial && !anyTown && !title && !this.field) {
      buildDungeonScenery(this, { depth, boss, biome: B });
      if (!cave) {
        this.meta.event('depth', depth + 1);
        if (depth + 1 > this.meta.p.best.depth) { this.meta.p.best.depth = depth + 1; this.meta.save(); }
        this.placePickups();
      }
    }
    p.y = 0; p.vy = 0; p.air = false; p.climbing = false; p.stamina = 100; p.lastLow.set(p.pos.x, 0, p.pos.z);
    this.world.computeFlow(p.pos.x, p.pos.z);
    this.musicKey = title ? 'title' : anyTown ? 'town' : boss ? 'boss' : B.key; this.audio.setMusic(this.musicKey, 0);
  }

  makeExit(e, type) {
    const g = (type === 'dungeon' && this.field) ? buildDungeonLandmark(this.biome, this.field) : buildArch(this.biome);
    g.position.set(e.x, 0, e.z);
    const toC = Math.atan2(-e.x, -e.z); g.rotation.y = toC;
    const col = { item: 0xffd85a, boon: 0xc08cff, heal: 0xff6b6b, dungeon: 0xb399ec, run: 0x6fe0d0, town: 0x58c896, prevField: 0x58c896, nextField: 0x62e0a8, nextTower: 0xffcf4a, caveReturn: 0x58c896 }[type];
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
    if (this.ambushTrial?.active) {
      const layout = AMBUSH_LAYOUTS[this.ambushTrial.active.variant];
      for (const type of wv.enemies) {
        const enemy = this.spawnEnemy(type, type === 'boar' ? AMBUSH_BOAR : layout.thorn, false);
        if (type === 'boar') enemy.chargeRecoveryS = wv.boarChargeRecoveryS;
      }
      return;
    }
    if (this.caveRun) {
      this.ui.banner(wv.name, wv.hint);
      for (const type of wv.enemies) {
        const pos = this.world.randomWalkable(this.rng, p.pos, 6);
        const enemy = this.spawnEnemy(type, pos, false);
        if (type === 'boar') enemy.chargeRecoveryS = wv.boarChargeRecoveryS;
        if (type === 'slime') enemy.meadowPounce = true;
        if (!wv.champion) continue;
        enemy.expeditionName = wv.name;
        enemy.expeditionTier = this.caveRun.tier === 'elite' ? 2 : 1;
        enemy.maxHp = enemy.hp *= 2.2;
        enemy.dmg *= 0.82;
        enemy.m.root.scale.setScalar(1.55);
        enemy.r *= 1.55;
        initParts(enemy);
        this.boss = enemy;
        this.ui.bossBar(true, wv.name);
      }
      return;
    }
    const atlas = (!this.field && this.depth >= 0) ? computeAtlasSummary(ensureAtlas(this.meta.p)) : null;
    if (wv.boss) {
      const nBoss = atlas?.twinBoss ? 2 : 1;
      for (let i = 0; i < nBoss; i++) this.spawnEnemy('stag', this.world.randomWalkable(this.rng, p.pos, 9), false);
      return;
    }
    const d = this.depth;
    const pool = ['slime', 'slime', 'thorn'];
    if (d >= 1) pool.push('boar');
    if (d >= 2) pool.push('thorn');
    if (d >= 3) pool.push('moth', 'boar');
    if (d >= 6) pool.push('moth', 'golem');
    const densMul = atlas ? atlas.densityMult : 1;
    const cnt = Math.min(28, Math.round(wv.n * (this.meta.has('swarm') ? 1.4 : 1) * densMul));
    const eliteBonus = (this.meta.has('elite') ? 0.22 : 0) + (atlas?.corruptDropChance > 0 || (atlas?.soulDropMult || 1) > 1 ? 0.24 : 0);
    for (let i = 0; i < cnt; i++) {
      const t = pick(this.rng, pool);
      const pos = this.world.randomWalkable(this.rng, p.pos, 7);
      const elite = this.rng() < 0.06 + d * 0.025 + eliteBonus;
      // warning puff, then spawn
      this.vfx?.spawnEnemyCircle(pos.x, this.world.gh(pos.x, pos.z), pos.z, elite ? 'fire' : 'death', 0.75);
      this.addDecal('circle', pos.x, pos.z, 0.9, 0xfff2c0, 0.7, null, () => this.spawnEnemy(t, pos, elite), 2);
    }
  }

  spawnEnemy(type, pos, elite) {
    const d = this.field ? FIELDS[this.field].level / 2 : this.depth;
    const lv = this.caveRun ? MEADOW_CAVE[this.caveRun.tier].level : this.towerFloor > 0 ? Math.min(30, 3 + Math.floor(this.towerFloor * 0.6)) : this.field ? FIELDS[this.field].level : (1 + this.depth * 3);
    const difficulty = this.ambushTrial ? 'standard' : this.settings?.difficulty;
    const diff = DIFFICULTY_MODES[difficulty] || DIFFICULTY_MODES.standard;
    // 硬核高壓難度曲線（敵人血量 ×1.60、傷害 ×1.45、移速 ×1.12 — 必須閃避、走位與紮實養成！）
    const scale = (lv <= 5 ? (1 + (lv - 1) * 0.22) : (1.88 * Math.pow(1.095, lv - 5))) * diff.enemyHp * 1.60;
    const dmgScale = (lv <= 5 ? (1 + (lv - 1) * 0.18) : (1.72 * Math.pow(1.07, lv - 5))) * diff.enemyDmg * 1.45;
    const atlas = (!this.caveRun && !this.field && this.depth >= 0) ? computeAtlasSummary(ensureAtlas(this.meta.p)) : null;
    const DEF = {
      slime: { hp: 30, spd: 2.7, dmg: 9, r: 0.45, build: () => buildSlime(pick(this.rng, [0x7fc35a, 0x9bd06a, 0x6fb86a])) },
      thorn: { hp: 26, spd: 2.2, dmg: 10, r: 0.4, build: buildThorn },
      boar: { hp: 58, spd: 2.6, dmg: 16, r: 0.55, build: buildBoar },
      moth: { hp: 36, spd: 3.0, dmg: 14, r: 0.45, build: buildMoth },
      skyray: { hp: 44, spd: 3.4, dmg: 15, r: 0.55, flying: true, alt: 2.35, build: buildSkyRay },
      golem: { hp: 115, spd: 2.0, dmg: 22, r: 0.78, build: buildGolem },
      stag: { hp: 1100, spd: 2.4, dmg: 18, r: 1.2, build: buildStag },
    }[type];
    if (!this.caveRun && type !== 'stag') { if (this.meta.has('swift')) DEF.spd *= 1.25; if (this.meta.has('tough')) DEF.hp *= 1.5; }
    if (atlas) { DEF.hp *= atlas.enemyHpMult; DEF.dmg *= atlas.enemyDmgMult; DEF.spd *= atlas.enemySpdMult; }
    const m = DEF.build();
    const s = elite ? 1.35 : 1;
    m.root.scale.setScalar(s);
    this.scene.add(m.root);
    // v6 全 20 張野外地圖生態專屬低面 3D 怪物實模 ＋ 專屬巨型 Boss（FIELD_BOSS_SPEC）
    const bossSpec = (this.field && type === 'stag') ? FIELD_BOSS_SPEC[this.field] : null;
    if (bossSpec) {
      attachMonsterGlb(m, bossSpec.modelKey, {
        scale: bossSpec.scale,
        tint: bossSpec.tint,
        emissive: bossSpec.emissive,
        emissiveIntensity: 0.42,
        rotX: bossSpec.rotX || 0,
        yOffset: bossSpec.yOffset || 0,
      });
    } else if (this.field) {
      const isBossOrElite = elite || type === 'stag';
      const MAP_MON = {
        1:  () => (type === 'slime' && (isBossOrElite || Math.random() < 0.6)) ? ['plant_chewer', { scale: 1.05, emissive: 0x362e1e, emissiveIntensity: 0.30 }] : null,
        2:  () => [isBossOrElite ? 'werewolf' : 'spore', { scale: type === 'stag' ? 1.4 : isBossOrElite ? 1.18 : 1.08, emissive: isBossOrElite ? 0x3c5474 : 0x364a30, emissiveIntensity: 0.48 }],
        3:  () => [isBossOrElite ? 'specter' : 'spore', { scale: type === 'stag' ? 1.38 : 1.12, emissive: 0x345258, emissiveIntensity: 0.46 }],
        4:  () => (type === 'boar' || type === 'stag') ? ['golem_ice', { scale: type === 'stag' ? 1.45 : 1.08, emissive: 0x2c4862, emissiveIntensity: 0.38 }] : null,
        5:  () => [isBossOrElite ? 'scorpion_king' : 'golem_fire', { scale: type === 'stag' ? 1.4 : 1.12, emissive: 0x6a301a, emissiveIntensity: 0.48 }],
        6:  () => [isBossOrElite ? 'werewolf' : 'golem_earth', { scale: type === 'stag' ? 1.45 : 1.12, tint: 0xd8f0d4, emissive: isBossOrElite ? 0x3c5474 : 0x426646, emissiveIntensity: 0.54 }],
        7:  () => (type === 'skyray' || type === 'stag') ? [isBossOrElite ? 'flying_demon' : 'beholder', { scale: type === 'stag' ? 1.35 : 1.25, emissive: isBossOrElite ? 0x58366c : 0x5a3260, emissiveIntensity: 0.50 }] : null,
        8:  () => [isBossOrElite ? 'flying_demon' : 'crab_monster', { scale: type === 'stag' ? 1.38 : 1.2, emissive: 0x52362e, emissiveIntensity: 0.46 }],
        9:  () => [isBossOrElite ? 'specter' : 'chest_monster', { scale: type === 'stag' ? 1.35 : 1.18, emissive: 0x38506c, emissiveIntensity: 0.48 }],
        10: () => [isBossOrElite ? 'specter' : (Math.random() < 0.55 ? 'plant_chewer' : 'spore'), { scale: type === 'stag' ? 1.35 : 1.12, emissive: 0x5c364c, emissiveIntensity: 0.46 }],
        11: () => [isBossOrElite ? 'flying_demon' : 'beholder', { scale: type === 'stag' ? 1.4 : 1.22, emissive: 0x385276, emissiveIntensity: 0.48 }],
        12: () => [isBossOrElite ? 'black_knight' : 'golem_earth', { scale: type === 'stag' ? 1.4 : 1.15, tint: 0xe6e0d6, emissive: isBossOrElite ? 0x6c4232 : 0x4a6c4e, emissiveIntensity: 0.56 }],
        13: () => [isBossOrElite ? 'scorpion_king' : 'golem_fire', { scale: type === 'stag' ? 1.42 : 1.12, tint: 0xffd89c, emissive: 0x6a4420, emissiveIntensity: 0.44 }],
        14: () => [isBossOrElite ? 'scorpion_king' : 'black_knight', { scale: type === 'stag' ? 1.45 : 1.14, tint: 0xffe0a4, emissive: 0x725024, emissiveIntensity: 0.48 }],
        15: () => [isBossOrElite ? 'werewolf' : (Math.random() < 0.5 ? 'plant_chewer' : 'spore'), { scale: type === 'stag' ? 1.42 : 1.14, tint: 0xd4f6c8, emissive: 0x36643a, emissiveIntensity: 0.48 }],
        16: () => [isBossOrElite ? 'flying_demon' : 'specter', { scale: type === 'stag' ? 1.42 : 1.18, tint: 0xd8c8ff, emissive: 0x563c88, emissiveIntensity: 0.54 }],
        17: () => [isBossOrElite ? 'black_knight' : 'specter', { scale: type === 'stag' ? 1.46 : 1.18, tint: 0xe2d4ff, emissive: 0x624496, emissiveIntensity: 0.58 }],
        18: () => [isBossOrElite ? 'beholder' : 'crab_monster', { scale: type === 'stag' ? 1.42 : 1.18, tint: 0xb8f8ff, emissive: 0x267488, emissiveIntensity: 0.52 }],
        19: () => [isBossOrElite ? 'golem_ice' : 'chest_monster', { scale: type === 'stag' ? 1.42 : 1.15, tint: 0xe8f6ff, emissive: 0x3684b8, emissiveIntensity: 0.52 }],
        20: () => [isBossOrElite ? 'flying_demon' : 'beholder', { scale: type === 'stag' ? 1.46 : 1.24, tint: 0xf4c4ff, emissive: 0x7c3298, emissiveIntensity: 0.56 }],
      };
      const pickMon = MAP_MON[this.field]?.();
      if (pickMon) attachMonsterGlb(m, pickMon[0], pickMon[1]);
    } else if (!this.caveRun && this.depth >= 0 && type !== 'stag') {
      // 地城房內依生態自動掛上專屬低面實模怪物
      const bk = this.biome?.key || 'meadow';
      const DUN_MON = {
        meadow: () => elite ? ['werewolf', { scale: 1.15, emissive: 0x3c5474, emissiveIntensity: 0.46 }] : (type === 'thorn' ? ['spore', { scale: 1.05, emissive: 0x364a30, emissiveIntensity: 0.44 }] : ['plant_chewer', { scale: 1.05, emissive: 0x362e1e, emissiveIntensity: 0.32 }]),
        autumn: () => elite ? ['black_knight', { scale: 1.15, tint: 0xe6e0d6, emissive: 0x6c4232, emissiveIntensity: 0.54 }] : ['golem_earth', { scale: 1.05, tint: 0xd8f0d4, emissive: 0x426646, emissiveIntensity: 0.50 }],
        snow:   () => ['golem_ice', { scale: elite ? 1.2 : 1.02, emissive: 0x2c4862, emissiveIntensity: 0.40 }],
        ember:  () => elite ? ['scorpion_king', { scale: 1.18, emissive: 0x6a301a, emissiveIntensity: 0.48 }] : ['golem_fire', { scale: 1.05, emissive: 0x6a301a, emissiveIntensity: 0.46 }],
      };
      const pickDun = DUN_MON[bk]?.();
      if (pickDun) attachMonsterGlb(m, pickDun[0], pickDun[1]);
    }
    const random = this.ambushTrial ? this.rng : Math.random;
    const e = {
      type, m, pos: new V3(pos.x, 0, pos.z), vel: new V3(), knock: new V3(), facing: random() * 6,
      hp: DEF.hp * scale * (elite ? 2.8 : 1) * (type === 'stag' && !this.field ? 1 / scale : 1), dmg: DEF.dmg * dmgScale * (elite ? 1.35 : 1),
      spd: DEF.spd * 1.12 * (elite ? 1.18 : 1), r: DEF.r * s, flying: !!DEF.flying, alt: DEF.alt || 0, groundedT: 0,
      state: 'move', t: 0, cd: 1 + random() * 1.5, stun: 0, slow: 0, flash: 0, elite, ph: random() * 10,
      hitCd: 0,
    };
    e.maxHp = e.hp;
    initParts(e);
    if (elite) assignEliteAffixes(e, lv, this.tide?.waveStreak || 1);
    if (type === 'stag') {
      e.phase = 1; e.cd = 2; this.boss = e;
      if (bossSpec) {
        e.r *= 1.35;
        e.bossName = bossDisplayName(this.field) || bossSpec.name;
        this.ui.bossBar(true, e.bossName);
        const auraRing = new THREE.Mesh(
          new THREE.RingGeometry(1.55, 2.05, 24),
          new THREE.MeshBasicMaterial({ color: bossSpec.aura, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
        );
        auraRing.rotation.x = -Math.PI / 2; auraRing.position.y = 0.08; auraRing.userData.noNormal = true;
        m.root.add(auraRing);
      } else {
        this.ui.bossBar(true, bossDisplayName(6) || '古樹鹿王 · 歐爾德');
      }
    }
    if (elite) {
      if (type !== 'stag') {
        e.eliteMod = pick(this.rng, ELITE_MODS);
        e.eliteModCd = 2.4 + Math.random() * 1.4;
        if (e.eliteMod.id === 'haste') e.spd *= 1.32;
        if (e.eliteMod.status) e.statusAffinity = e.eliteMod.status;
      }
      const ringCol = e.eliteMod ? e.eliteMod.color : 0xffd85a;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 16), new THREE.MeshBasicMaterial({ color: ringCol, transparent: true, opacity: 0.85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.userData.noNormal = true; m.root.add(ring);
    }
    this.puffs.burst(e.pos.x, 0.3, e.pos.z, 8, { c: 0xffffff, s: 0.35, speed: 2, up: 1, g: -0.5, life: 0.7, grow: 1.5, drag: 3 });
    this.enemies.push(e);
    return e;
  }

  // ---------------- combat ----------------
  rollDamage(mult, fire = false) {
    const s = this.player.stats;
    const comboCrit = Math.min(22.5, (this.combo?.count || 0) * 1.5);
    const furyMul = (this.shrineBuffs?.fury || 0) > 0 ? 1.45 : 1;
    let dmg = (s.baseDmg + s.addFire) * (1 + s.dmgPct / 100) * mult * furyMul;
    const random = this.ambushTrial ? this.rng : Math.random;
    const crit = (this.player.perfectCritT || 0) > 0 || random() * 100 < (s.crit + comboCrit);
    if (crit) dmg *= s.critMult / 100;
    return { dmg: Math.round(dmg * (0.9 + random() * 0.2)), crit, fire };
  }
  hitEnemy(e, hit, kx = 0, kz = 0, opts = {}) {
    if (e.dead) return;
    const p = this.player;
    e.statuses = e.statuses || { poison: 0, freeze: 0, burn: 0, shock: 0 };
    let mult = 1;
    if (e.vuln > 0) mult *= 1.3;
    if (e.brokenWeakens?.has('armor')) mult *= 1.3;
    if (e.statuses.shock > 0) mult *= 1.25;
    if (e.wet > 0 && opts.shock) mult *= 1.2;
    if (p.statuses?.overload > 0) mult *= 1.25;
    if (p.realmRule?.id === 'lantern_glow' && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <= (p.realmRule.lightRadius || 12.5)) {
      mult *= (p.realmRule.dmgBonus || 1.25);
    }
    // Phase B1：越級風險機制（怪物高出玩家 ≥6 級時減傷 45%，防低等跨區白嫖）
    if ((e.level || 1) - (this.meta.p.level || 1) >= 6) mult *= 0.55;
    if ((e.type === 'stag' || e.isWorldBoss || e.isTideBoss) && (p.bossDmgPct || 0) > 0) mult *= (1 + p.bossDmgPct / 100);
    let dmg = Math.round(hit.dmg * mult);
    const isAimInterrupt = !opts.isDoT && e.type === 'thorn' && e.state === 'aim';
    if (isAimInterrupt) {
      e.state = 'rest';
      e.t = 0;
      e.chargeRecoveryS = 0.75;
      e.stun = Math.max(e.stun, 0.35);
      e.m.body.scale.set(1, 1, 1);
      this.ambushTrial?.event('thornInterrupt');
    }
    const isCounter = isAimInterrupt || (!opts.isDoT && e.state === 'rest' && e.t < (e.chargeRecoveryS || 0));
    if (isCounter) {
      dmg = Math.round(dmg * 1.5);
      hit = { ...hit, crit: true };
      this.hitstop = Math.max(this.hitstop, 0.065);
      this.shake = Math.max(this.shake, 0.28);
      this.audio.sfx('perfect');
      const cg = new THREE.RingGeometry(0.45, 0.78, 24); cg.rotateX(-Math.PI / 2);
      const cm = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide }));
      cm.position.set(e.pos.x, e.pos.y + 0.18, e.pos.z); cm.userData.noNormal = true; this.scene.add(cm);
      this.rings.push({ mesh: cm, t: 0, max: 0.24, radius: 2.3 });
    }
    if (!opts.isDoT && (this.tide?.microBuffs?.dice20 || 0) > 0 && Math.random() < 0.22) {
      dmg = Math.round(dmg * 2.2);
      this.hitstop = Math.max(this.hitstop, 0.05);
      this.shake = Math.max(this.shake, 0.28);
      this.ui.dmgNum(e.pos.x, e.pos.y + 2.1, e.pos.z, '🎲 TWENTY!', 'comic');
      this.audio.sfx('crit');
    }
    // 碎冰連攜：攻擊冰凍目標觸發 1.45 倍碎冰爆發＋頓幀震動與專屬碎冰音效
    if (e.statuses.freeze > 0 && !opts.isDoT) {
      dmg = Math.round(dmg * 1.45);
      e.statuses.freeze = 0;
      this.hitstop = Math.max(this.hitstop, 0.045);
      this.shake = Math.max(this.shake, 0.25);
      this.fx.burst(e.pos.x, e.pos.y + 0.7, e.pos.z, 16, { c: [0x9cf0ff, 0xffffff, 0x58b8e8], s: 0.14, speed: 6.8, up: 4.2, life: 0.48 });
      const sg = new THREE.RingGeometry(0.45, 0.78, 24); sg.rotateX(-Math.PI / 2);
      const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x8be9ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      sm.position.set(e.pos.x, e.pos.y + 0.2, e.pos.z); sm.userData.noNormal = true; this.scene.add(sm);
      this.rings.push({ mesh: sm, t: 0, max: 0.26, radius: 2.3 });
      this.audio.sfx('shatter');
    }
    if ((this.shrineBuffs?.frost || 0) > 0 && !opts.isDoT && e.type !== 'stag') {
      e.slow = Math.max(e.slow || 0, 2.2);
      if (Math.random() < 0.28) e.statuses.freeze = Math.max(e.statuses.freeze || 0, 1.8);
    }
    // 空中截擊與擊落機制：滯空攻擊對空中怪物造成 1.5 倍暴擊、擊落並開啟統一破綻窗口
    if (opts.aerial && e.flying && e.groundedT <= 0) {
      dmg = Math.round(dmg * 1.5);
      e.groundedT = 4.2;
      e.stun = Math.max(e.stun, 1.5);
      e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 2.2;
      p.vy = Math.max(p.vy, 7.8);
      p.stamina = Math.min(100, p.stamina + 40);
      this.audio.sfx('perfect');
      this.fx.burst(e.pos.x, e.pos.y + 0.6, e.pos.z, 14, { c: [0x7ae8ff, 0xffe480, 0xffffff], s: 0.14, speed: 6, up: 4, life: 0.5 });
      const ag = new THREE.RingGeometry(0.42, 0.72, 24); ag.rotateX(-Math.PI / 2);
      const am = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      am.position.set(e.pos.x, this.world.groundY(e.pos.x, e.pos.z) + 0.16, e.pos.z); am.userData.noNormal = true; this.scene.add(am);
      this.rings.push({ mesh: am, t: 0, max: 0.26, radius: 2.4 });
    }
    if (e.shieldT > 0 && !opts.isDoT) {
      dmg = Math.max(1, Math.round(dmg * 0.2));
      this.fx.burst(e.pos.x, e.pos.y + 0.9, e.pos.z, 8, { c: [0xdbeeff, 0xffffff, 0x8fb8d8], s: 0.11, speed: 4.5, up: 2.2, life: 0.28 });
      const bg = new THREE.RingGeometry(0.32, 0.5, 20); bg.rotateX(-Math.PI / 2);
      const bm = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xdbeeff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      bm.position.set(e.pos.x, e.pos.y + 0.2, e.pos.z); bm.userData.noNormal = true; this.scene.add(bm);
      this.rings.push({ mesh: bm, t: 0, max: 0.18, radius: 1.35 });
    } else if (e.isPhalanxShield && !opts.aerial && !opts.isDoT) {
      const toPlayerX = p.pos.x - e.pos.x, toPlayerZ = p.pos.z - e.pos.z;
      const frontDot = Math.sin(e.facing || 0) * toPlayerX + Math.cos(e.facing || 0) * toPlayerZ;
      if (frontDot > 0) dmg = Math.max(1, Math.round(dmg * 0.45));
    }
    if (!opts.isDoT && this.vfx) {
      const hitTheme = opts.shock ? 'thunder' : hit.fire ? 'fire' : opts.slow ? 'frost' : opts.poison ? 'poison' : (['holy', 'wind', 'bluefire', 'death', 'lotus'][this.character?.job ?? 0] || 'arcane');
      this.vfx.spawnHitImpact(e.pos.x, e.pos.y, e.pos.z, hitTheme, !!hit.crit);
    }
    // 異常狀態附加（冰凍、中毒、灼燒、感電；潮濕敵人受寒冰命中幾乎必凍）
    if (opts.slow && e.type !== 'stag') {
      e.slow = Math.max(e.slow || 0, opts.slow);
      const freezeChance = e.wet > 0 ? 0.85 : 0.42;
      if (Math.random() < freezeChance) { e.statuses.freeze = Math.max(e.statuses.freeze, e.wet > 0 ? 2.6 : 2.0); this.fx.burst(e.pos.x, e.pos.y + 0.6, e.pos.z, 8, { c: [0x8eeeff, 0xffffff], s: 0.12, speed: 3.5, up: 2, life: 0.4 }); }
    }
    if (hit.fire && !opts.isDoT && Math.random() < 0.45) e.statuses.burn = Math.max(e.statuses.burn, 3.6);
    if (opts.poison) e.statuses.poison = Math.max(e.statuses.poison, opts.poison);
    if (opts.shock) e.statuses.shock = Math.max(e.statuses.shock, opts.shock);
    if (this.meta?.p?.mentorOn && this.field) {
      const ms = mentorDamageScale(this.meta.p.level, FIELDS[this.field]?.level || 1, true);
      if (ms < 1) dmg = Math.max(1, Math.round(dmg * ms));
    }
    this.ambushTrial?.enemyHit(e, Math.min(dmg, e.hp), opts.isDoT);
    e.hp -= dmg; e.flash = 0.14;
    if (e.isWorldBoss) onWorldBossHit(this, e, dmg, true);
    if (!opts.isDoT) {
      // 加強打擊感：壓扁彈回（squash-and-stretch）、暴擊衝擊環、更強震動與頓幀
      e.squash = hit.crit ? 0.36 : 0.22;
      this.audio.sfx(hit.crit ? 'crit' : 'hit');
      const kb = e.type === 'stag' ? 0.15 : 1.18;
      e.knock.x += kx * kb; e.knock.z += kz * kb;
      if (hit.crit) {
        this.hitstop = Math.max(this.hitstop, 0.055);
        this.shake = Math.max(this.shake, 0.24);
        if (p.realmRule?.burstOnCrit && !opts.isTrigger) {
          this.shockRing(e.pos.x, e.pos.z, 3.8, { dmg: Math.round(dmg * 0.55), crit: false, fire: false }, 0xd85cff, 0.45, { isTrigger: true });
          this.fx.burst(e.pos.x, e.pos.y + 0.9, e.pos.z, 12, { c: [0xd85cff, 0x6ef8ff, 0xffffff], s: 0.12, speed: 5.5, up: 3.5, life: 0.45 });
        }
        const rg = new THREE.RingGeometry(0.4, 0.72, 18); rg.rotateX(-Math.PI / 2);
        const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe480, transparent: true, opacity: 0.9, depthWrite: false }));
        rm.position.set(e.pos.x, e.pos.y + 0.35, e.pos.z); rm.userData.noNormal = true; this.scene.add(rm);
        this.rings.push({ mesh: rm, t: 0, max: 0.22, radius: 1.9 });
      }
    }
    if (opts.stun && e.type !== 'stag') e.stun = Math.max(e.stun, opts.stun);
    p.dmgDealt += dmg;
    this.ui.dmgNum(e.pos.x, e.pos.y + 1.2 * e.m.root.scale.x + (e.type === 'stag' ? 2.5 : 0), e.pos.z, dmg, (hit.crit || opts.aerial) ? 'crit' : hit.fire ? 'fire' : opts.isDoT ? 'heal' : '');
    this.fx.burst(e.pos.x, e.pos.y + 0.6, e.pos.z, hit.crit ? 12 : opts.isDoT ? 3 : 6, { c: hit.fire ? [0xffb040, 0xff7030] : hit.crit ? [0xffe47a, 0xffffff, 0xff9a50] : [0xffffff, 0xfff2b0], s: hit.crit ? 0.13 : 0.1, speed: hit.crit ? 6.5 : 5, up: 3.5, life: 0.38 });
    if (p.stats.lifeOnHit && !opts.isDoT) this.heal(p.stats.lifeOnHit, false);
    if (opts.leech && !opts.isDoT) {
      p.leechBuffT = Math.max(p.leechBuffT || 0, 3.5);
      this.heal(opts.leech, true);
      this.fx.burst(p.pos.x, p.y + 0.8, p.pos.z, 6, { c: [0xff7a9a, 0x7fe08a], s: 0.09, speed: 2.4, up: 2.2, life: 0.35 });
    } else if (!opts.isDoT && !opts.isTrigger && (p.leechBuffT || 0) > 0) {
      this.heal(3, true);
    }
    if (opts.hitstop) this.hitstop = Math.max(this.hitstop, opts.hitstop);
    // 技能邏輯電路：命中觸發器 (CoH) 與暴擊觸發器 (CoC)，接通 Phase M4A 250ms 獨立 ICD 保護
    if (!opts.isDoT && !opts.isTrigger) {
      const trigIds = [...(opts.triggerOnHit || []), ...(hit.crit ? (opts.triggerOnCrit || []) : [])];
      if (trigIds.length) {
        const nowMs = this.time * 1000;
        const readyIds = trigIds.filter(tid => checkTriggerIcd(this.puzzleIcd, `${tid}:${hit.crit ? 'c' : 'h'}`, nowMs, hit.crit ? 250 : 350));
        if (readyIds.length) {
          const prevAim = this.aim.clone();
          this.aim.set(e.pos.x, e.pos.y, e.pos.z);
          for (const tid of readyIds) {
            this.execPuzzleSkill(tid, { multi: 0, echo: 0, area: 0, dmgMult: 0.72, fire: false, chain: 0, cdr: 0, frost: 0, leech: 0, shock: 0, split: false, orbit: false, triggerOnHit: [], triggerOnCrit: [] }, 0.72, true);
          }
          this.aim.copy(prevAim);
        }
      }
    }
    // 部位破壞與精準掉落：依據命中方位集中傷害特定部位，斬斷後弱化招式並必掉專屬神裝
    if (!opts.isDoT && e.parts?.length) {
      const hx = opts.hitPos ? opts.hitPos.x : p.pos.x, hz = opts.hitPos ? opts.hitPos.z : p.pos.z;
      const part = resolveHitPart(e, hx, hz);
      if (part) {
        const role = getClassTeamRole(this.character?.job ?? 0);
        const pr = damagePart(e, part, Math.round(dmg * (role.partBreakMult || 1)));
        if (pr.broken) {
          if (this.runStats) this.runStats.partsBroken++;
          if (e.m.parts?.[pr.part.id]) e.m.parts[pr.part.id].visible = false;
          this.hitstop = Math.max(this.hitstop, 0.1);
          this.shake = Math.max(this.shake, 0.58);
          this.camPunch = Math.max(this.camPunch || 0, 0.14);
          this.audio.sfx('partBreak');
          this.puffs.burst(e.pos.x, e.pos.y + 1.2, e.pos.z, 18, { c: [0xffe480, 0x7ae8ff, 0xffffff], s: 0.22, speed: 6, up: 5, life: 0.75 });
          this.ui.dmgNum(e.pos.x, e.pos.y + 2.2, e.pos.z, `✂️ ${pr.part.name}破壞!`, 'crit');
          // 部位破壞以破防虛弱為主，僅 6% 機率掉專屬裝備（不再每次破部位必噴神裝！）
          if (e.sporeGuardian || this.caveRun) {
            this.ui.toast(`${pr.part.name}已破壞 · ${pr.part.weakenDesc}`, '#ffd85a');
          } else if (pr.dropItem && Math.random() < 0.06) {
            this.ui.toast(`✂️ 斬斷 ${pr.part.icon} ${pr.part.name}！（${pr.part.weakenDesc}）幸運掉落專屬裝備！`, '#ffd85a');
            this.dropItem(e.pos.x + (Math.random() - 0.5) * 1.8, e.pos.z + (Math.random() - 0.5) * 1.8, pr.dropItem);
          } else {
            this.meta.p.coins = (this.meta.p.coins || 0) + 15;
            this.ui.toast(`✂️ 斬斷 ${pr.part.icon} ${pr.part.name}！（${pr.part.weakenDesc}）+🪙15`, '#ffd85a');
          }
        }
      }
    }
    // 環境元素連鎖反應：攻擊附帶火／冰／雷／水元素時，觸發周圍地表連鎖反應
    if (!opts.isDoT && !opts.isReaction) {
      const elem = inferElement({ fire: hit.fire, slow: opts.slow, frost: opts.frost, shock: opts.shock, water: opts.water });
      if (elem) this.applyElementAt(e.pos.x, e.pos.z, elem, 2.6);
    }
    // 月影飛蛾之魂（戰鬥槽）：攻擊命中於敵人腳下綻放月光爆裂印記
    if (!opts.isDoT && p.souls?.combat?.id === 'moth' && (this._mothSoulCd || 0) <= this.time) {
      this._mothSoulCd = this.time + 1.4;
      const mx = e.pos.x, mz = e.pos.z;
      this.addDecal('circle', mx, mz, 1.8, 0xc08cff, 0.55, null, () => {
        this.shockRing(mx, mz, 2.1, this.rollDamage(1.35, false), 0xc08cff, 0, { isTrigger: true });
      });
    }
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e) {
    if (e.dead) return;
    if (e.rival) { this.dueling=false; this.ui.toast('演武勝利'); }
    this.ambushTrial?.kill(e);
    e.dead = true; this.audio.sfx(e.type === 'stag' ? 'bossDie' : 'enemyDie');
    this.scene.remove(e.m.root);
    const col = { slime: [0x7fc35a, 0xb5e080], thorn: [0x8a5a3b, 0x6aa84a], boar: [0x9a6a4a, 0x5a3b2c], moth: [0xb48ae0, 0xffd27a], skyray: [0x58d4e8, 0xffe480], golem: [0x7b7874, 0x6ae8ff, 0x5f9a4a], stag: [0xffb050, 0xe8dcc8] }[e.type];
    this.puffs.burst(e.pos.x, 0.4, e.pos.z, e.type === 'stag' ? 40 : 12, { c: col, s: 0.24, speed: 4.5, up: 4.5, life: 0.8 });
    this.puffs.burst(e.pos.x, 0.3, e.pos.z, 6, { c: 0xffffff, s: 0.4, speed: 1.5, up: 1, g: -1, life: 0.8, grow: 1.4, drag: 3 });
    this.shake = Math.max(this.shake, e.type === 'stag' ? 1 : e.elite ? 0.42 : 0.22);
    if (e.elite || e.type === 'stag') this.camPunch = e.type === 'stag' ? 0.2 : 0.11;
    const p = this.player; p.kills++;
    onFlameKill(this, e);
    if (e.expeditionId && e.expeditionTier === meadowExpedition(this.meta.p).active?.tier) {
      completeMeadowObjective(this, e.expeditionId, e.brokenWeakens?.has('spores'));
      if (e.sporeGuardian) for (const zone of this.groundZones) {
        if (zone.sporeSource === e) zone.life = 0;
      }
    }
    // 清怪連擊系統（Kill-Streak Combo）：6 秒內連續擊殺疊加攻速、暴擊與掉寶率！
    this.combo = this.combo || { count: 0, timer: 0 };
    this.combo.count++; this.combo.timer = 6.0;
    if ([5, 10, 20, 30, 50].includes(this.combo.count)) {
      this.audio.sfx('perfect');
      this.fx.burst(p.pos.x, p.y + 1.0, p.pos.z, 16, { c: [0xffd85a, 0xff7a50, 0xffffff], s: 0.13, speed: 5, up: 3.5, life: 0.55 });
    }
    if (e.eliteMod?.id === 'molten') {
      const mx = e.pos.x, mz = e.pos.z, mdmg = e.dmg * 1.15;
      this.addDecal('circle', mx, mz, 2.8, 0xff6a30, 0.85, null, () => {
        this.audio.sfx('slam');
        this.puffs.burst(mx, 0.4, mz, 14, { c: [0xff6a30, 0xffd85a], s: 0.25, speed: 5, up: 4, life: 0.55 });
        if (Math.hypot(this.player.pos.x - mx, this.player.pos.z - mz) < 2.9) this.hurtPlayer(mdmg, new V3(mx, 0, mz), 'burn');
      });
    }
    if (this.caveRun) return;
    onEliteDeathAffix(this, e);
    const autoOn = isAutopilotActive(this);
    const sparkMul = manualSparkMult(this);
    this.onKillMeta(e); awardKill(this, e);
    if (!autoOn) onTideKill(this, e);
    // MMORPG 怪物圖鑑精通＋主線章節任務進度
    const bestUp = recordBestiaryKill(this.meta.p, e.type);
    if (bestUp) {
      this.meta.save(); this.recalc(); this.audio.sfx('classup');
      this.ui.toast(`📖 圖鑑精通升級！【${bestUp.def.icon} ${bestUp.def.name} Lv.${bestUp.rank}】永久屬性已生效！`, '#7fe08a');
    }
    const stEv = recordStoryEvent(this.meta.p, 'kill', 1)
      || (e.elite ? recordStoryEvent(this.meta.p, 'elite', 1) : null)
      || ((e.type === 'stag' || e.isTideBoss) ? recordStoryEvent(this.meta.p, 'boss', 1) : null);
    this.meta.p.bountyProg = this.meta.p.bountyProg || { kills: 0, gathers: 0, enhances: 0, eliteKills: 0, bossKills: 0 };
    this.meta.p.bountyProg.kills = (this.meta.p.bountyProg.kills || 0) + 1;
    if (e.elite) {
      this.meta.p.bountyProg.eliteKills = (this.meta.p.bountyProg.eliteKills || 0) + 1;
      this.meta.p.totalElites = (this.meta.p.totalElites || 0) + 1;
    }
    if (e.type === 'stag' || e.isTideBoss) this.meta.p.bountyProg.bossKills = (this.meta.p.bountyProg.bossKills || 0) + 1;
    if (e.isWorldBoss) onWorldBossDefeated(this, e);
    if (!autoOn) onPlayerHelpSimKill(this, e);
    if (e.isDynEvent) onDynEventEnemyKilled(this, e);
    if (!autoOn) {
      const runeDrop = rollRuneDrop(this.meta.p, !!e.elite, e.type === 'stag' || !!e.isTideBoss);
      if (runeDrop) {
        this.meta.save();
        this.ui.toast(`💠 獲得符文石：【${runeDrop.def.icon} ${runeDrop.def.name}】×${runeDrop.count}（鐵匠鋪鑲嵌）`, runeDrop.def.color);
      }
      const daRes = addDailyActivity(this.meta.p, e.elite ? 6 : 2);
      if (daRes?.newlyReady?.length) {
        this.ui.toast(`🎁 今日活躍度達 ${daRes.newlyReady[0].pt}！前往公會大廳領取【${daRes.newlyReady[0].name}】！`, '#ffd85a');
      }
      const newTitles = syncUnlockedTitles(this.meta.p, { equip: this.player.equip });
      if (newTitles.length) {
        this.meta.save(); this.recalc(); this.audio.sfx('classup');
        this.ui.toast(`🏷️ 解鎖新稱號：【${newTitles[0].icon} ${newTitles[0].name}】！（全傷 +1% · 生命 +5，按 I 佩戴）`, '#ffd85a');
      }
    }
    if (!autoOn && getPartyIds(this.meta.p).length > 0) {
      const bondUp = grantCompanionXp(this.meta.p, e.type === 'stag' ? 35 : e.elite ? 18 : 6);
      if (bondUp) {
        this.meta.save(); this.recalc(); this.audio.sfx('classup');
        this.ui.toast(`💖 隊友羈絆升級！【${bondUp.def?.icon || '👥'} ${bondUp.def?.name || '隊友'} Lv.${bondUp.lv}】戰力與被動提升！`, '#ff9be0');
      }
    }
    if (stEv?.justCompleted) {
      this.meta.save(); this.audio.sfx('ultReady');
      this.ui.toast(`📜 主線達成：【${stEv.def.title}】！點擊右側任務追蹤器領取獎勵！`, '#ffd85a');
    }
    if (!autoOn && this.meta.p.mentorOn && (e.elite || e.legendary) && this.field && (this.meta.p.level - (FIELDS[this.field]?.level || 1)) >= 4) {
      this.meta.p.mentorBadges = (this.meta.p.mentorBadges || 0) + 1;
      this.meta.save();
      this.ui.toast(`🏮 提燈導師暖心徽章 +1（累計 ${this.meta.p.mentorBadges}）`, '#ffd85a');
    }
    const atlas = (!this.field && this.depth >= 0) ? computeAtlasSummary(ensureAtlas(this.meta.p)) : null;
    // 「怪物即技能」吸收系統：限定手動戰鬥吸收靈魂卡
    const soulRes = autoOn ? null : rollSoulDrop(this.meta.p, e.type, e.elite, atlas ? atlas.soulDropMult : 1);
    if (soulRes?.granted && soulRes.isNew) {
      this.meta.save(); this.audio.sfx('classup');
      this.ui.toast(`👻 吸收新靈魂：${soulRes.def.icon} ${soulRes.def.name}！（按 I → 怪物靈魂 鑲嵌）`, '#d8a8ff');
    } else if (soulRes?.awakened) {
      this.meta.save(); this.audio.sfx('classup');
      this.ui.toast(`⭐ 靈魂覺醒！${soulRes.def.icon} ${soulRes.def.name} 升至 ${'★'.repeat(soulRes.tier)}（第 ${soulRes.tier} 階）`, '#ffd85a');
    }
    // 硬核補給收斂：藥瓶充能放慢（普通怪 0.08、精英 0.35），血球掉率降至 4%！
    p.flask.prog += (e.elite ? 0.35 : 0.08) * (this.meta.has('fortune') ? 0.5 : 1);
    while (p.flask.prog >= 1 && p.flask.charges < p.flask.max) { p.flask.prog -= 1; p.flask.charges++; }
    if (p.flask.charges >= p.flask.max) p.flask.prog = 0;
    if (this.has('feast')) this.heal(2 * p.boons.filter(b => b === 'feast').length, false);
    // 怪物專屬鍛造材料掉落（讓打怪永遠能累積製作強裝的素材，不受極低掉裝率影響！）
    if (!autoOn) {
      const mDrop = rollMonsterMatDrop(this.meta.p, e.type, !!e.elite, e.type === 'stag' || !!e.isTideBoss);
      if (mDrop) {
        this.meta.save();
        this.ui.toast(`${mDrop.def.icon} 獲得材料：${mDrop.def.name} ×${mDrop.count}`, mDrop.def.id === 'boss_heart' ? '#ff9a4a' : '#bfe8ff');
      }
    }
    // 技能寶石極稀掉落：精英 2.5%、首領 18%
    if (!autoOn && ((e.elite && Math.random() < 0.025) || (e.type === 'stag' && Math.random() < 0.18))) {
      const gPool = Object.keys(ALL_GEMS);
      const gid = gPool[(Math.random() * gPool.length) | 0];
      if (gid && addGemToBag(this.meta.p, gid)) {
        this.meta.save(); this.audio.sfx('drop3');
        this.ui.toast(`💎 極稀掉落！獲得技能拼圖寶石【${ALL_GEMS[gid].icon} ${ALL_GEMS[gid].name}】（按 K 鑲嵌）`, '#ffd85a');
      }
    }
    const r = Math.random();
    const comboDrop = Math.min(0.002, this.combo.count * 0.0001);
    const goldDrop = (this.shrineBuffs?.gold || 0) > 0 ? 0.005 : 0;
    const atlasDrop = atlas ? atlas.lootBonus * 0.006 : 0;
    const diffDrop = (DIFFICULTY_MODES[this.settings?.difficulty || 'standard']?.lootBonus || 0) * 0.006;
    const hsDropMul = (!autoOn && this.field && this.hotspots && getFieldHotspot(this.field, this.hotspots)?.kind === 'gold_tide') ? 1.25 : 1;
    // 經典 ARPG 掉寶金字塔：爛白裝（普通）容易掉落（拆星砂／開荒），藍裝稀少、金裝極難、傳奇橘裝超罕見！
    const baseDropChance = e.type === 'stag' ? 0.65 : e.elite ? 0.28 : (0.065 + comboDrop + goldDrop + atlasDrop + diffDrop) * hsDropMul;
    const dropChance = autoOn ? baseDropChance * AUTO_RATES.dropChanceMult : Math.min(1, baseDropChance * sparkMul);
    if (r < dropChance) {
      const rq = Math.random();
      let rolledR = 0;
      if (e.type === 'stag') {
        rolledR = rq < 0.10 ? 3 : rq < 0.70 ? 2 : 1; // 首領：10% 傳奇 / 60% 稀有 / 30% 魔法
      } else if (e.elite) {
        rolledR = rq < 0.005 ? 3 : rq < 0.06 ? 2 : rq < 0.26 ? 1 : 0; // 精英：74% 白裝 / 20% 藍 / 5.5% 金 / 0.5% 橘
      } else {
        rolledR = rq < 0.008 ? 2 : rq < 0.08 ? 1 : 0; // 普通怪：92% 爛白裝 / 7.2% 藍 / 0.8% 金 / 0% 橘
      }
      if (autoOn) rolledR = Math.min(AUTO_RATES.maxDropRarity, rolledR);
      const dropDepth = this.field ? Math.floor((this.meta.p.level || 1) / 5) : (this.depth + this.meta.dropBonus + (atlas?.dropTierBonus || 0));
      let it = makeItem(Math.random, dropDepth, rolledR);
      if (!this.field && !autoOn && atlas?.corruptDropChance > 0 && Math.random() < atlas.corruptDropChance) { const cr = corruptItem(it); if (cr.ok) it = cr.item; }
      this.dropItem(e.pos.x, e.pos.z, it);
    }
    if (Math.random() < 0.015) this.dropOrb(e.pos.x, e.pos.z);
    if (e.type === 'stag') {
      const moreBoss = this.enemies.some(o => !o.dead && o.type === 'stag');
      if (!moreBoss) {
        this.boss = null; this.ui.bossBar(false);
        if (!this.field && !this.towerFloor) { const seed = this.runSeed; setTimeout(() => { if (!this.field && !this.towerFloor && this.state === 'play' && this.depth === 9 && this.runSeed === seed) this.victory(); }, 2500); }
      }
    }
  }
  heal(v, show = true) {
    const p = this.player; const before = p.hp;
    p.hp = Math.min(p.stats.maxHp, p.hp + v);
    const gained = p.hp - before;
    if (gained > 0) {
      if (this.runStats) this.runStats.healsDone += gained;
      this.ambushTrial?.healed(gained);
    }
    if (show && gained > 0) this.ui.dmgNum(p.pos.x, 1.6, p.pos.z, `+${Math.round(gained)}`, 'heal');
  }
  hurtPlayer(dmg, src, statusKind = null, trialSource = null, trialAttack = null) {
    const p = this.player;
    if (this.dev?.on && this.dev?.god) return;
    if (p.roll > 0 && this.state === 'play' && this.depth >= 0) {
      if ((p.perfectDodgeCd || 0) <= 0) {
        // 極限閃避：簡約小字＋銀白殘影與雙層流風閃避動畫（取代青藍光環）
        p.perfectDodgeCd = 3.2;
        p.perfectCritT = 1.5;
        this.hitstop = Math.max(this.hitstop || 0, 0.08);
        this.shake = Math.max(this.shake || 0, 0.2);
        if (this.tide) this.tide.ultCharge = Math.min(100, (this.tide.ultCharge || 0) + 12);
        this.audio.sfx('perfect');
        this.ui.dmgNum(p.pos.x, p.y + 1.85, p.pos.z, '完美閃避', 'dodge');
        this.fx.burst(p.pos.x, p.y + 0.85, p.pos.z, 14, { c: [0xffffff, 0xfff3cf, 0xe4ddd0], s: 0.13, speed: 5.5, up: 2.6, life: 0.38 });
        // 3D 銀白殘影剪影（朝閃避方向拉長淡出）
        const ghost = new THREE.Group();
        const gMat = new THREE.MeshBasicMaterial({ color: 0xfff8e6, transparent: true, opacity: 0.62, depthWrite: false });
        const gBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.86, 10), gMat);
        gBody.position.y = 0.56; ghost.add(gBody);
        const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), gMat);
        gHead.position.y = 1.18; ghost.add(gHead);
        ghost.position.set(p.pos.x, p.y, p.pos.z); ghost.rotation.y = p.facing; ghost.userData.noNormal = true;
        this.scene.add(ghost);
        this.rings.push({
          mesh: ghost, t: 0, max: 0.36, radius: 1,
          onTick(k) {
            ghost.scale.set(1 - 0.18 * k, 1 + 0.14 * k, 1 + 0.55 * k);
            gMat.opacity = 0.62 * (1 - k) * (1 - k);
          },
        });
        // 雙層流風弧動畫
        const arcG = new THREE.RingGeometry(0.75, 0.94, 22, 1, 0, Math.PI * 1.15); arcG.rotateX(-Math.PI / 2);
        const arcMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
        const arcGrp = new THREE.Group();
        const a1 = new THREE.Mesh(arcG, arcMat); a1.position.y = 0.48;
        const a2 = new THREE.Mesh(arcG, arcMat); a2.position.y = 0.92; a2.rotation.y = Math.PI;
        arcGrp.add(a1, a2); arcGrp.position.set(p.pos.x, p.y, p.pos.z); arcGrp.userData.noNormal = true;
        this.scene.add(arcGrp);
        this.rings.push({
          mesh: arcGrp, t: 0, max: 0.28, radius: 1,
          onTick(k) {
            arcGrp.rotation.y = k * Math.PI * 1.6;
            const sc = 0.75 + k * 1.15;
            arcGrp.scale.set(sc, 1, sc);
            arcMat.opacity = 0.85 * (1 - k);
          },
        });
      }
      return;
    }
    if (p.iframes > 0 || this.state !== 'play' || this.depth < 0) return;
    const air = p.y - this.world.gh(p.pos.x, p.pos.z);
    if (air > 0.8 && !p.gliding) return;
    if (src && Math.abs(src.y - p.y) > 1.7 && air <= 0.8) return;
    if (this.recallT > 0) { this.recallT = 0; this.ui.toast('受到攻擊，回城中斷！', '#ff8a8a'); }
    this.audio.sfx('hurt');
    const shockMul = p.statuses?.shock > 0 ? 1.2 : 1;
    const fieldLv = this.field > 0 ? (FIELDS[this.field]?.level || 1) : 0;
    const dangerMul = (fieldLv > 0 && (fieldLv - (this.meta?.p?.level || 1)) >= 6) ? 1.5 : 1;
    const rawDmg = dmg * shockMul * dangerMul * (this.meta.has('fragile') ? 1.35 : 1);
    const resKey = statusKind === 'burn' ? 'resFire' : statusKind === 'freeze' ? 'resIce' : statusKind === 'shock' ? 'resLightning' : statusKind === 'poison' ? 'resPoison' : null;
    const elemRes = resKey ? (p.stats[resKey] || 0) : 0;
    const afterArmor = rawDmg * (1 - p.stats.armor / 100);
    dmg = Math.max(1, Math.round(afterArmor * (1 - elemRes / 100)));
    if (this.runStats) this.runStats.dmgMitigated += Math.max(0, Math.round(rawDmg - dmg));
    this.ambushTrial?.playerHit(Math.min(dmg, p.hp), trialSource, trialAttack);
    p.hp -= dmg; p.iframes = 0.35;
    if (src) onFlameHurt(this, dmg);               // Hollow hits burn Flame
    this.hurtFlash = 0.5; this.shake = Math.max(this.shake, 0.38); this.hitstop = 0.06;
    // 劇烈衝擊液體瓶（左右晃動＋水花四濺）
    const dirSign = src ? Math.sign(p.pos.x - src.x || 1) : 1;
    this.ui.hpVial?.impulse(dirSign * 2.4, 2.0);
    this.ui.mpVial?.impulse(dirSign * 1.4, 1.2);
    // 異常狀態感染（元素抗性愈高，異常感染率愈低！）
    const statusChance = Math.max(0.08, 0.48 * (1 - Math.max(0, elemRes) / 100));
    if (statusKind && p.statuses && Math.random() < statusChance) {
      if (statusKind === 'poison') { p.statuses.poison = Math.max(p.statuses.poison, 6); this.ui.toast('🧪 中毒！血瓶冒出黏稠毒泡', '#8cf07a'); }
      else if (statusKind === 'freeze') {
        if (p.statuses.chill > 0) { p.statuses.freeze = 1.0; p.statuses.chill = 0; this.ui.toast('❄️ 遭到冰凍！', '#8eeeff'); }
        else { p.statuses.chill = 4.5; this.ui.toast('🧊 寒霜緩速！', '#8eeeff'); }
      } else if (statusKind === 'burn') { p.statuses.burn = Math.max(p.statuses.burn, 4.5); this.ui.toast('🔥 陷入灼燒！', '#ff9a50'); }
      else if (statusKind === 'shock') { p.statuses.shock = Math.max(p.statuses.shock, 5.0); this.ui.toast('⚡ 陷入感電（易傷 +20%）！', '#c88cff'); }
    }
    this.ui.dmgNum(p.pos.x, 1.5, p.pos.z, dmg, 'hurt');
    this.fx.burst(p.pos.x, 0.6, p.pos.z, 10, { c: [0xff5a5a, 0xffffff], s: 0.11, speed: 4.5, life: 0.4 });
    if (this.has('bramble')) for (const e of this.enemies) if (!e.dead && e.pos.distanceTo(p.pos) < 2.5) this.hitEnemy(e, { dmg: 20, crit: false });
    if (src) { tmp3.subVectors(p.pos, src).setY(0).normalize(); p.vel.addScaledVector(tmp3, 6); }
    if (p.hp <= 0) { p.hp = 0; this.die(); }
    else { p.combatT = 5.0; p.heroRig?.play('getHit', { once: true, force: true, speed: 1.1 }); }
  }
  die() {
    if (this.state !== 'play') return;
    if (this.ambushTrial) { this.ambushTrial.finish('defeated'); return; }
    // 星燈聖殿永久天賦：每局原地復活並釋放清場黃金震波！
    if (this.tide?.sv && (this.tide.sv.revivesLeft || 0) > 0) {
      this.tide.sv.revivesLeft--;
      const p = this.player;
      p.hp = p.stats.maxHp; p.mana = p.stats.mana; p.iframes = 3.0;
      this.audio.sfx('revive');
      this.shake = Math.max(this.shake, 0.7);
      this.shockRing(p.pos.x, p.pos.z, 10.5, this.rollDamage(3.8, true), 0xffe87a, 1.4, { isTrigger: true });
      this.puffs.burst(p.pos.x, 0.9, p.pos.z, 28, { c: [0xffe87a, 0xffa83a, 0xffffff], s: 0.22, speed: 6.5, up: 4, life: 0.85 });
      this.ui.dmgNum(p.pos.x, p.y + 2.8, p.pos.z, '✨ 星燈復甦!', 'comic');
      this.ui.toast(`✨ 觸發【星燈復甦】原地滿血重戰！本局剩餘 ${this.tide.sv.revivesLeft} 次`, '#ffe87a');
      return;
    }
    // Phase M10A：6 門制副本重整機制（副本內尚有星門時消耗 1 道星門就地滿血復活）
    if (!this.field && this.depth >= 0 && (this.portalsLeft || 0) > 1) {
      this.portalsLeft--;
      const p = this.player;
      p.hp = p.stats.maxHp; p.mana = p.stats.mana; p.iframes = 2.5;
      this.audio.sfx('warp');
      this.puffs.burst(p.pos.x, 0.7, p.pos.z, 18, { c: [0x62e8ff, 0xffd85a, 0xffffff], s: 0.18, speed: 4.5, life: 0.7 });
      this.ui.toast(`🌀 消耗 1 道星門滿血重整！剩餘 ${this.portalsLeft}/6 道星門`, '#62e8ff');
      return;
    }
    const cave = this.caveRun;
    this.state = 'dead'; if (!this.field) this.bankRun(1);
    const lostSpoils = this.field && this.tide?.sv ? loseSpoilsOnDeath(this.tide.sv) : { lostCoins: 0, lostShards: 0 };
    const lost = cave ? 0 : leaveGrave(this); this.audio.sfx('dead'); this.audio.setMusic('title', 0);
    this.puffs.burst(this.player.pos.x, 0.5, this.player.pos.z, 20, { c: [0x2f8a7e, 0xd9543a, 0xffd36e], s: 0.2, speed: 4, life: 1 });
    this.player.m.root.visible = false;
    // Beaconfall Phase 2: die in a field -> wake at the nearest lit star lantern (no lit lantern: back to town as before)
    const respawn = !cave && this.field > 0 ? findRespawn(this) : null;
    setTimeout(() => {
      if (respawn && this.state === 'dead' && this.field > 0) {
        const spoilNote = (lostSpoils.lostCoins > 0 || lostSpoils.lostShards > 0)
          ? ` · 未結算戰利品袋遺失 50%（-${lostSpoils.lostCoins}金 / -${lostSpoils.lostShards}星砂）` : '';
        this.respawnAtLantern(respawn, lost, spoilNote);
        return;
      }
      this.enterTown();
      const spoilMsg = (lostSpoils.lostCoins > 0 || lostSpoils.lostShards > 0)
        ? ` · 未結算戰利品袋遺失 50%（-${lostSpoils.lostCoins}金 / -${lostSpoils.lostShards}星砂）`
        : '';
      if (cave) {
        this.ui.banner('在燈谷鎮甦醒', `已保留草原洞窟第 ${cave.stage + 1} 段進度，可一鍵續戰。`);
        this.ui.openPanel('caveRetry');
        return;
      }
      this.ui.banner('在燈谷鎮甦醒', (lost ? '墓碑保管了 ' + lost + ' 份素材 · ' + FIELDS[this.originField || 1].name : '裝備與星砂已保留') + spoilMsg);
    }, 900);
  }
  // Wake at a lit star lantern inside the current field. Enemies, loot and field state stay as they were.
  respawnAtLantern(rp, lostGoods = 0, spoilNote = '') {
    const p = this.player, R = FLAME_CFG.respawn;
    const ang = Math.atan2(p.pos.z - rp.z, p.pos.x - rp.x);
    let x = rp.x + Math.cos(ang) * R.offset, z = rp.z + Math.sin(ang) * R.offset;
    if (!this.world.isWalk(x, z)) { x = rp.x; z = rp.z; }
    const y = this.world.gh(x, z);
    p.pos.set(x, y, z); p.y = y; p.vel.set(0, 0, 0); p.vy = 0;
    p.air = p.climbing = p.gliding = false; p.roll = 0; p.sitting = null;
    p.lastLow?.set(x, y, z); this.camPos?.set?.(x, 0, z);
    if (p.statuses) for (const k in p.statuses) p.statuses[k] = 0;
    applyRespawnState(this);
    this.state = 'play'; p.m.root.visible = true;
    p.heroRig?.play('idle', { force: true });
    // push nearby enemies back so the player is not instantly chain-killed
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - x, dz = e.pos.z - z, d = Math.hypot(dx, dz);
      if (d < R.pushRadius) { const k = 8 / Math.max(d, 0.5); e.knock.x += dx * k * 0.3; e.knock.z += dz * k * 0.3; e.stun = Math.max(e.stun || 0, R.pushStun); }
    }
    refreshGraveSpot(this);
    this.audio.sfx('revive'); this.audio.setMusic(this.musicKey || 'town', this.enemies.length ? 1 : 0);
    this.puffs.burst(x, y + 0.6, z, 26, { c: [0xffe87a, 0xffa83a, 0xffffff], s: 0.2, speed: 5, up: 4.5, life: 0.8 });
    this.fx.burst(x, y + 1.2, z, 18, { c: [0x38d0ff, 0xffffff], s: 0.12, speed: 4, up: 3.5, life: 0.6 });
    this.fade = 0.6;
    this.ui.banner('在星燈旁甦醒', `${rp.name || 'Star Lantern'} · ` + (lostGoods ? '墓碑保管了 ' + lostGoods + ' 份素材（回原地取回）' : '裝備與星砂已保留') + spoilNote);
    this.meta.save();
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
    // 掉落物上方飄一張物品圖示（透明 PNG 看板），跟著寶石一起做重力彈跳
    let icon = null;
    const artId = resolveArtId(item);
    if (artId) {
      icon = new THREE.Sprite(dropIconMaterial(artId));
      icon.scale.set(0.8, 0.8, 1); icon.position.y = 1.2;
      icon.userData.noNormal = true; icon.userData.sharedMat = true; icon.userData.sharedGeo = true;
      g.add(icon);
    }
    g.position.set(x, this.world.groundY(x, z), z);
    this.scene.add(g);
    const a = Math.random() * 6.28;
    this.drops.push({ g, gem, icon, item, kind: 'item', vx: quiet ? 0 : Math.cos(a) * 2, vz: quiet ? 0 : Math.sin(a) * 2, vy: quiet ? 0 : 5, y: 0.5 });
    if (!quiet && item.rarity >= 2) {
      this.vfx?.spawnLootBeam(x, this.world.groundY(x, z), z, R.beam, item.rarity >= 3 ? 7.5 : 4.5);
      this.ui.toast(`${RARITY[item.rarity].name}物品掉落！`, R.color);
    }
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
    let best = null, bd = 3.0;
    for (const d of this.drops) if (d.kind === 'item') { const dd = Math.hypot(d.g.position.x - this.player.pos.x, d.g.position.z - this.player.pos.z); if (dd < bd && Math.abs(d.g.position.y - this.player.y) < 2.2) { bd = dd; best = d; } }
    return best;
  }
  disposeDrop(d) {
    if (!d?.g) return;
    this.scene.remove(d.g);
    d.g.traverse?.(o => {
      if (o.geometry && !o.userData?.sharedGeo) o.geometry.dispose?.();
      if (o.material && !o.userData?.sharedMat) o.material.dispose?.();
    });
  }
  tryPickup() {
    const p = this.player;
    const nearby = this.drops.filter(d => d.kind === 'item' && Math.hypot(d.g.position.x - p.pos.x, d.g.position.z - p.pos.z) < 3.2 && Math.abs(d.g.position.y - p.y) < 2.4);
    if (!nearby.length) return;
    this.audio.sfx('pickup');
    let equippedNames = [], bagCount = 0, bestUpgrade = 0, lastIt = null;
    for (const d of nearby) {
      const it = d.item; lastIt = it;
      this.disposeDrop(d);
      const idx = this.drops.indexOf(d); if (idx >= 0) this.drops.splice(idx, 1);
      const existing = p.equip[it.slot];
      const canWear = canEquipItem(it, this.meta?.p?.level || 1);
      if (!existing && canWear) {
        p.equip[it.slot] = it; rememberGear(this);
        const hpFrac = p.hp / p.stats.maxHp;
        this.recalc(); p.hp = Math.max(1, Math.round(hpFrac * p.stats.maxHp));
        equippedNames.push(it.name);
      } else {
        addGearToBag(this.meta.p, it); bagCount++;
        const diff = existing ? (itemScore(it) - itemScore(existing)) : 0;
        if (diff > bestUpgrade) bestUpgrade = diff;
      }
      this.fx.burst(p.pos.x, p.y + 0.8, p.pos.z, 10, { c: RARITY[it.rarity].beam, s: 0.1, speed: 3, up: 4, life: 0.55 });
    }
    if (bagCount > 0) this.meta.save();
    if (nearby.length === 1 && lastIt) {
      if (equippedNames.length) this.ui.toast(`裝備了 ${equippedNames[0]}`, RARITY[lastIt.rarity].color);
      else {
        const reqLv = itemReqLevel(lastIt);
        const cmpTag = !canEquipItem(lastIt, this.meta?.p?.level || 1)
          ? `（🔒 需 Lv.${reqLv} 穿戴，已收入背包）`
          : bestUpgrade > 0 ? ` ▲戰力+${bestUpgrade}（按 I 一鍵換裝）` : '（按 I 檢視）';
        this.ui.toast(`🎒 已收入背包：${lastIt.name}${cmpTag}`, bestUpgrade > 0 ? '#7fe08a' : RARITY[lastIt.rarity].color);
      }
    } else {
      const parts = [];
      if (equippedNames.length) parts.push(`自動裝備 ${equippedNames.length} 件`);
      if (bagCount) parts.push(`收入背包 ${bagCount} 件${bestUpgrade > 0 ? `（含戰力 ▲+${bestUpgrade} 強化！）` : ''}`);
      this.ui.toast(`🎒 範圍掃拾完成：${parts.join(' · ')}`, bestUpgrade > 0 ? '#7fe08a' : '#ffd85a');
    }
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

  queueMeadowStrike(enemy, x, z, radius, duration, damageMult) {
    enemy.state = 'meadow-strike';
    enemy.t = 0;
    const y = this.world.gh(x, z);
    const warning = this.addDecal('circle', x, z, radius, 0xff633b, duration, null, () => {
      if (enemy.dead || enemy.state !== 'meadow-strike') return;
      enemy.state = 'rest';
      enemy.t = 0;
      if (this.state !== 'play' || enemy.stun > 0 || enemy.statuses?.freeze > 0) return;
      if (enemy.meadowPounce) {
        enemy.chargeRecoveryS = 0.72;
        this.moveEntity(enemy.pos, x - enemy.pos.x, z - enemy.pos.z, enemy.r);
      } else if (enemy.expeditionName) {
        enemy.chargeRecoveryS = 0.95;
      }
      this.audio.sfx('slam');
      this.puffs.burst(x, y + 0.25, z, 8, { c: [0xffbe73, 0xffe8ac], s: 0.18, speed: 3.6, life: 0.45 });
      if (Math.abs(this.player.y - y) < 1.5 && Math.hypot(this.player.pos.x - x, this.player.pos.z - z) < radius) {
        this.hurtPlayer(enemy.dmg * damageMult, warning.mesh.position);
      }
    });
    warning.mesh.position.y = y + 0.16;
  }

  queueSporeBurst(enemy) {
    enemy.state = 'spore-burst';
    enemy.t = 0;
    enemy.sporeLast = true;
    const { x, z } = this.player.pos;
    const radius = enemy.brokenWeakens.has('spores') ? 1.55 : 2.85;
    const y = this.world.gh(x, z);
    const warning = this.addDecal('circle', x, z, radius, 0x82dc55, 1.2, null, () => {
      if (enemy.dead || this.state !== 'play' || enemy.stun > 0 || enemy.statuses?.freeze > 0) return;
      this.spawnGroundZone('poison', x, z, radius, 5.5, 0, {
        sporeSource: enemy, playerDamage: enemy.dmg * 0.42,
      });
    });
    warning.mesh.position.y = y + 0.17;
  }

  // ---------------- skills ----------------
  aimDir() {
    if (isAutopilotActive(this) && this.autopilot.aimVec) {
      return new V2(this.autopilot.aimVec.x, this.autopilot.aimVec.y);
    }
    const p = this.player;
    tmp2.set(this.aim.x - p.pos.x, this.aim.z - p.pos.z);
    if (tmp2.lengthSq() < 0.01) tmp2.set(Math.sin(p.facing), Math.cos(p.facing));
    const base = tmp2.normalize().clone();
    // 智慧柔順瞄準輔助：若滑鼠方向 20° 錐形內 12m 有活體敵人，輕微吸附確保爽快命中
    let best = null, bestScore = 0.94;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4 || d > 12) continue;
      const dot = (dx * base.x + dz * base.y) / d;
      if (dot > bestScore) { bestScore = dot; best = new V2(dx / d, dz / d); }
    }
    return best || base;
  }
  tryAttack() {
    const p = this.player;
    if (p.cds.atk > 0 || p.roll > 0) {
      p.inputBuf = { kind: 'attack', t: 0.12 };
      return;
    }
    const comboSpd = Math.min(18, (this.combo?.count || 0) * 1.2);
    const furySpd = (this.shrineBuffs?.fury || 0) > 0 ? 15 : 0;
    // 1.45 次/秒（41 幀間隔）搭配 0.78 單刀係數：維持總 DPS 平衡，讓 1.25 秒破綻內能流暢打出兩刀反擊
    const aps = 1.45 * (1 + (p.stats.atkSpd + comboSpd + furySpd) / 100);
    p.cds.atk = 1 / aps;
    this.ambushTrial?.event('attack');
    const dir = this.aimDir(); p.facing = Math.atan2(dir.x, dir.y);
    p.swing = 1; p.swingT = 0.18; p.swingCount++; this.audio.sfx('swing');
    if (p.souls?.combat?.id === 'thorn') {
      for (const ang of [-0.22, 0, 0.22]) {
        const td = dir.clone().rotateAround(new V2(), ang);
        this.fireProj(p.pos, td, { speed: 16, mult: 0.45, color: 0x8ad858, size: 0.11, life: 0.75, poison: 4.0, isTrigger: true });
      }
    }
    // 滑翔俯衝斬擊（Gliding Plunge Dive）：滑翔中按左鍵急速俯衝落地引發大範圍衝擊波
    if (p.gliding && this.meta.p.weapon !== 'bow' && !p.plunge) {
      p.plunge = true; p.vy = -19; p.gliding = false;
      this.audio.sfx('roll');
      this.fx.burst(p.pos.x, p.y + 0.5, p.pos.z, 10, { c: [0x7ae8ff, 0xffffff], s: 0.12, speed: 4, up: 1, life: 0.35 });
    }
    if (this.meta.p.weapon === 'bow') {
      onBasicHit(this, 'bow');
      this.fireProj(p.pos, dir, { speed: 21, mult: p.air ? 1.15 : .85, color: p.air ? 0x8ef0ff : 0xebd69f, size: .09, life: .85, airShot: p.air }); return;
    }
    const range = meleeReach(p);
    let mult = 0.78;
    if (p.galeBuff) { mult += 0.6; p.galeBuff = false; }
    let hitAny = false;
    const cover = this.ambushTrial?.cover;
    for (const e of this.enemies) {
      if (e.dead || hitsAmbushCover(cover, p.pos.x, p.y + 0.6, p.pos.z, e.pos.x, e.pos.z)) continue;
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
    if (hitAny) {
      onBasicHit(this, 'melee');
      this.shake = Math.max(this.shake, 0.12);
      this.gainClassRes(this.character?.job === 0 ? 18 : this.character?.job === 2 ? 22 : 1);
    }
    const comboStep = ((p.swingCount - 1) % 3) + 1;
    const job = this.character?.job ?? 0;
    this.makeSlash(p.pos, dir, range, comboStep);
    // Phase V3：五大職業普攻第 3 段專屬終結連招 VFX！
    if (comboStep === 3) {
      if (job === 0) {
        this.vfx?.spawnSummon('ground_slam', p.pos.x + dir.x * 1.4, p.y, p.pos.z + dir.y * 1.4, dir.x, dir.y, { theme: 'holy' });
        this.shockRing(p.pos.x + dir.x * 1.4, p.pos.z + dir.y * 1.4, 2.8, this.rollDamage(1.35), 0xffcf4a, 0.45, { isTrigger: true });
      } else if (job === 2) {
        this.vfx?.spawnDecal('mana_runes', p.pos.x + dir.x * 2.0, p.y, p.pos.z + dir.y * 2.0, { theme: 'bluefire', scaleStart: 1.0, scaleEnd: 3.4, dur: 0.45 });
        this.fireProj(p.pos, dir, { speed: 18, mult: 1.1, fire: true, color: 0x58d8ff, size: 0.2, life: 0.9, isTrigger: true });
      } else if (job === 3) {
        this.vfx?.spawnSlash(p.pos.x, p.y, p.pos.z, Math.atan2(dir.x, dir.y), { clean: true, theme: 'death', scale: range * 1.05, tilt: 0.45, dir: -1 });
        this.vfx?.spawnSlash(p.pos.x, p.y, p.pos.z, Math.atan2(dir.x, dir.y), { clean: true, theme: 'arcane', scale: range * 1.05, tilt: -0.45, dir: 1 });
      } else if (job === 4) {
        this.vfx?.spawnHitImpact(p.pos.x + dir.x * 1.6, p.y + 0.3, p.pos.z + dir.y * 1.6, 'lotus', true);
        this.shockRing(p.pos.x + dir.x * 1.6, p.pos.z + dir.y * 1.6, 2.6, this.rollDamage(1.25), 0xff8eb8, 0.3, { leech: 4, isTrigger: true });
      }
    }
    if (this.has('moon') && p.swingCount % 4 === 0) this.shockRing(p.pos.x, p.pos.z, 4.5 * (1 + p.stats.area / 100), this.rollDamage(0.8), 0xd8e0ff);
    if (p.specials.has('sweepWave')) this.fireProj(p.pos, dir, { speed: 13, mult: 0.8, pierce: 99, color: 0xfff2c0, size: 0.4, wave: true, life: 0.6 });
  }
  gainClassRes(amt = 1) {
    const p = this.player;
    const cls = CLASSES[this.character?.job ?? 0] || CLASSES[0];
    const m = cls.classMech;
    if (!m || !p) return;
    p.classRes = Math.min(m.max, (p.classRes || 0) + amt);
    if (p.classRes >= m.max) {
      p.classRes = 0;
      p.classBuffT = 6.0;
      const dir = this.aimDir();
      if (cls.id === 0) {
        this.vfx?.spawnDecal('holy_ring', p.pos.x, p.y, p.pos.z, { theme: 'holy', scaleStart: 1.2, scaleEnd: 4.2, dur: 1.0 });
        this.ui.toast('🛡️ 【堅壁戰意】滿層！展開聖光護盾 · 下招範圍 +30%', '#ffcf4a');
      } else if (cls.id === 1) {
        this.vfx?.spawnMesh('ring_wind', { x: p.pos.x, y: p.y + 0.8, z: p.pos.z, theme: 'wind', scaleStart: 1.2, scaleEnd: 2.2, dur: 0.9, spinY: 6 });
        this.ui.toast('🪶 【順風連羽】滿 5 層！疾風加速 · 下次技能必暴！', '#5ce0a8');
      } else if (cls.id === 2) {
        this.vfx?.spawnDecal('shock_ring', p.pos.x + dir.x * 2, p.y, p.pos.z + dir.y * 2, { theme: 'bluefire', scaleStart: 1.0, scaleEnd: 5.5, dur: 0.65 });
        this.shockRing(p.pos.x + dir.x * 2, p.pos.z + dir.y * 2, 4.4, this.rollDamage(1.8, true), 0x42b8ff, 0.5, { isTrigger: true });
        this.ui.toast('🔵 【雙焰共鳴】過載爆破！熾金與幽藍魂火交會！', '#42b8ff');
      } else if (cls.id === 3) {
        this.vfx?.spawnDecal('mana_runes', p.pos.x + dir.x * 2, p.y, p.pos.z + dir.y * 2, { theme: 'death', scaleStart: 1.2, scaleEnd: 4.8, dur: 0.7 });
        this.shockRing(p.pos.x + dir.x * 2, p.pos.z + dir.y * 2, 3.8, this.rollDamage(1.75), 0xb86cff, 0.4, { leech: 8, isTrigger: true });
        this.heal(p.stats.maxHp * 0.1, true); p.mana = Math.min(p.stats.mana, p.mana + 15);
        this.ui.toast('🌙 【暗影印記】引爆！汲血暗潮回復生命與法力！', '#c87aff');
      } else {
        this.vfx?.spawnSummon('lotus_burst', p.pos.x, p.y, p.pos.z, dir.x, dir.y, { theme: 'lotus' });
        this.heal(p.stats.maxHp * 0.14, true);
        this.ui.toast('🪷 【蓮華禪韻】綻放！全隊回復生命並獲得靈動加速！', '#ff8eb8');
      }
      this.audio.sfx('boon');
    }
  }
  makeSlash(pos, dir, range, comboStep = 1) {
    const job = this.character?.job ?? 0;
    const theme = ['holy', 'wind', 'bluefire', 'death', 'lotus'][job] || 'fire';
    const yaw = Math.atan2(dir.x, dir.y);
    if (this.vfx) {
      this.vfx.spawnSlash(pos.x, pos.y || 0, pos.z, yaw, {
        clean: job === 3 || job === 1,
        theme,
        scale: range * (comboStep === 3 ? 1.05 : 0.78),
        dir: comboStep % 2 ? 1 : -1,
        tilt: comboStep === 2 ? 0.25 : -0.18,
      });
    }
    for (let i = 0; i < 5; i++) {
      const a = yaw + (i - 2) * 0.4;
      const d = range * (0.7 + Math.random() * 0.28);
      this.fx.emit(pos.x + Math.sin(a) * d, (pos.y || 0) + 0.55, pos.z + Math.cos(a) * d, { c: 0xffe480, s: 0.08, vx: Math.sin(a) * 3, vz: Math.cos(a) * 3, vy: 1.5, life: 0.22 });
    }
  }
  spawnBeam(x1, y1, z1, x2, y2, z2, color = 0xffe07a) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return;
    const geo = new THREE.CylinderGeometry(0.06, 0.06, len, 5);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(dx / len, dy / len, dz / len));
    mesh.userData.noNormal = true;
    this.scene.add(mesh);
    this.beams.push({ mesh, t: 0.22, max: 0.22 });
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
      if (d < radius + e.r) {
        const k = 6 / Math.max(d, 0.3);
        const ringHit = hit.dmg ? { ...hit, dmg: Math.round(hit.dmg * (0.9 + Math.random() * 0.2)) } : hit;
        this.hitEnemy(e, ringHit, (e.pos.x - x) * k * 0.3, (e.pos.z - z) * k * 0.3, {
          stun, slow: opts.slow, leech: opts.leech,
          triggerOnHit: opts.triggerOnHit, triggerOnCrit: opts.triggerOnCrit,
          isTrigger: opts.isTrigger, isReaction: opts.isReaction,
        });
      }
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
    if ((p.skillCds[slotIdx] || 0) > 0 || p.roll > 0) {
      p.inputBuf = { kind: 'skill', slot: slotIdx, t: 0.12 };
      return;
    }
    const { def, mod } = sk;
    const manaCost = Math.round((def.mana || 0) * (mod.bluefire ? 0.75 : 1));
    if (manaCost && p.mana < manaCost) {
      if (!this._noManaT || this.time - this._noManaT > 1) { this.ui.toast('法力不足', '#7fb2ff'); this.ui.status?.noMana(); this._noManaT = this.time; }
      return;
    }
    if (manaCost) { p.mana -= manaCost; this.ui.mpVial?.impulse((Math.random() - 0.5) * 1.4, 1.3); }
    // 連續施放 3 次技能觸發「魔力過載／狂暴」：液體瓶劇烈沸騰頂起瓶塞，技能傷害 +25%！
    p.castCombo = (p.castComboT > 0 ? p.castCombo : 0) + 1; p.castComboT = 4.2;
    if (p.castCombo >= 3 && p.statuses && p.statuses.overload <= 0) {
      p.statuses.overload = 5.5;
      this.ui.toast('💢 魔力過載！液體沸騰頂開瓶塞（傷害 +25%）', '#ffd85a');
      this.ui.hpVial?.impulse(0, 1.8); this.ui.mpVial?.impulse(0, 2.2);
    }
    this.ambushTrial?.event('skill', { skill: def.id });
    p.skillCds[slotIdx] = Math.max(0.12, def.cd * (1 - p.stats.cdr / 100) * (1 - mod.cdr) * (p.statuses?.overload > 0 ? 0.8 : 1));
    const run = (echoScale = 1) => this.execPuzzleSkill(def.id, mod, echoScale);
    run(1);
    for (let i = 1; i <= mod.echo; i++) setTimeout(() => { if (this.state === 'play') run(0.65); }, i * 240);
  }
  execPuzzleSkill(id, mod, scale = 1, isTrigger = false) {
    const p = this.player, dir = this.aimDir();
    p.facing = Math.atan2(dir.x, dir.y);
    if (!isTrigger) {
      p.combatT = 5.0;
      p.heroRig?.play('skill', { once: true, force: true, speed: 1.15 });
      this.gainClassRes(this.character?.job === 0 ? 22 : this.character?.job === 2 ? 34 : 1);
    }
    const vfxTh = mod.vfxTheme || null;
    const pullVortex = (cx, cz, rad) => {
      if (!mod.vortex) return;
      this.vfx?.spawnDecal('shock_ring', cx, this.world.gh(cx, cz), cz, { theme: vfxTh || 'arcane', scaleStart: rad * 2.1, scaleEnd: 0.5, dur: 0.45, spinY: 4 });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = cx - e.pos.x, dz = cz - e.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.4 && d < rad * 1.55) { e.pos.x += (dx / d) * Math.min(2.4, d * 0.55); e.pos.z += (dz / d) * Math.min(2.4, d * 0.55); }
      }
    };
    const runeCol = { bolt: 0xffb347, slam: 0xffe3a0, wisp: 0xfff27a, rain: 0x6cb8ff, trap: 0x6fe06a, whirl: 0xff8ab0, mark: 0xd06cff, meteor: 0xff6a30, nova: 0x7ae8ff, prism: 0xffe07a, phantom: 0xb48ae0 }[id] || 0xffe07a;
    const rg = new THREE.RingGeometry(0.75, 1.0, 24); rg.rotateX(-Math.PI / 2);
    const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: runeCol, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    rm.position.set(p.pos.x, p.y + 0.14, p.pos.z); rm.userData.noNormal = true; this.scene.add(rm);
    this.rings.push({ mesh: rm, t: 0, max: 0.34, radius: 2.1 });
    this.fx.burst(p.pos.x, p.y + 0.4, p.pos.z, 8, { c: [runeCol, 0xffffff], s: 0.09, speed: 3.5, up: 2.5, life: 0.38 });
    this.meta.p.deeds = this.meta.p.deeds || {}; this.meta.p.deeds.casts = (this.meta.p.deeds.casts || 0) + 1;
    const slow = mod.frost ? 2.2 : 0, leech = mod.leech || 0;
    const areaMul = (1 + p.stats.area / 100) * (1 + mod.area);
    const dmgMul = mod.dmgMult * scale;
    const trigOpts = isTrigger ? { isTrigger: true } : { triggerOnHit: mod.triggerOnHit || [], triggerOnCrit: mod.triggerOnCrit || [] };
    if (id === 'bolt') {
      this.audio.sfx('bolt');
      const n = p.stats.proj + mod.multi, spread = 0.18;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * spread, d = dir.clone().rotateAround(new V2(), a);
        if (i < 3) this.vfx?.spawnMagicMissile(p.pos.x, p.y, p.pos.z, d.x, d.y, vfxTh || 'fire');
        this.fireProj(p.pos, d, { speed: 17, mult: 1.35 * dmgMul, fire: true, color: 0xffb347, size: 0.18, chain: (this.has('chain') ? 1 : 0) + mod.chain, split: !!(mod.split || p.specials.has('splitBolt')), orbit: !!mod.orbit, slow, leech, ...trigOpts });
      }
      p.swing = 1; p.swingT = 0.15;
    } else if (id === 'slam') {
      this.audio.sfx('slam');
      const R = 3.2 * areaMul * (this.has('quake') ? 1.35 : 1), cx = p.pos.x + dir.x * 1.2, cz = p.pos.z + dir.y * 1.2;
      this.vfx?.spawnSummon('ground_slam', cx, this.world.gh(cx, cz), cz, dir.x, dir.y, { theme: vfxTh || 'earth' });
      this.shockRing(cx, cz, R, this.rollDamage(2.2 * dmgMul, mod.fire), mod.fire ? 0xffa050 : 0xffe3a0, 1.1, { slow, leech, ...trigOpts });
      pullVortex(cx, cz, R);
      this.puffs.burst(cx, 0.2, cz, 16, { c: [this.biome.rock, this.biome.rockDark, this.biome.dirt], s: 0.25, speed: 5, up: 6, life: 0.8 });
      this.shake = 0.45; p.swing = 1; p.swingT = 0.28;
    } else if (id === 'wisp') {
      this.audio.sfx('wisp');
      this.vfx?.spawnSummon('totem', p.pos.x, p.y, p.pos.z, dir.x, dir.y, { theme: vfxTh || 'holy', heal: false, dur: 6.5 });
      for (const w of p.wisps) { this.scene.remove(w.mesh); disposeObj3D(w.mesh); } p.wisps = [];
      const n = 3 + mod.multi + (this.has('swarm') ? 3 : 0) + (p.specials.has('moreWisps') ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: mod.fire ? 0xff9a4a : 0xfff27a }));
        this.scene.add(mesh);
        p.wisps.push({ mesh, a: i / n * Math.PI * 2, cd: Math.random() * 0.4, mult: 0.48 * dmgMul, fire: mod.fire, slow, leech });
      }
      p.wispT = 7 + (this.has('swarm') ? 3 : 0);
    } else if (id === 'rain') {
      this.audio.sfx('bolt');
      const tx = this.aim.x, tz = this.aim.z, waves = 2 + Math.floor(mod.multi / 2), R = 2.8 * areaMul;
      this.vfx?.spawnSummon('arrows_rain', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'wind' });
      for (let w = 0; w < waves; w++) {
        this.addDecal('circle', tx + (Math.random() - 0.5) * 1.4, tz + (Math.random() - 0.5) * 1.4, R, mod.fire ? 0xff9a4a : 0x6cb8ff, 0.45 + w * 0.28, null, () => {
          this.shockRing(tx, tz, R, this.rollDamage(1.3 * dmgMul, mod.fire), mod.fire ? 0xffa850 : 0x8cd0ff, 0, { slow, leech, ...trigOpts });
          this.fx.burst(tx, 1.5, tz, 14, { c: [0xfff4d0, 0x6cb8ff], s: 0.12, speed: 4, up: -2, life: 0.45 });
        });
      }
      if (!this.applyElementAt(tx, tz, mod.fire ? 'fire' : 'water', R)) {
        this.spawnGroundZone(mod.fire ? 'magma' : 'water', tx, tz, R, 5.8, 0.65 * dmgMul, { color: mod.fire ? 0xff9a4a : 0x46b0e8, fire: mod.fire, slow, leech });
      }
      p.swing = 1; p.swingT = 0.2;
    } else if (id === 'trap') {
      this.audio.sfx('ui');
      const dist = Math.min(6, Math.hypot(this.aim.x - p.pos.x, this.aim.z - p.pos.z));
      const tx = p.pos.x + dir.x * dist, tz = p.pos.z + dir.y * dist;
      const R = 3.0 * areaMul;
      this.addDecal('circle', tx, tz, R, 0x6fe06a, 0.75, null, () => {
        this.audio.sfx('slam');
        this.vfx?.spawnSmokeBurst(tx, this.world.gh(tx, tz), tz, vfxTh || 'poison', R);
        this.vfx?.spawnPoisonWall(tx, this.world.gh(tx, tz), tz, Math.atan2(dir.x, dir.y), vfxTh || 'poison');
        this.shockRing(tx, tz, R, this.rollDamage(1.8 * dmgMul, mod.fire), 0x6fe06a, 0.4, { slow: Math.max(slow, 2.5), leech, ...trigOpts });
        this.spawnGroundZone('poison', tx, tz, R, 5.2, 0.55 * dmgMul, { color: 0x52c868, poison: 5.0, slow: 1.6 });
        this.puffs.burst(tx, 0.3, tz, 14, { c: [0x6fe06a, 0xa882e8], s: 0.24, speed: 4, up: 4, life: 0.65 });
      });
    } else if (id === 'whirl') {
      this.audio.sfx('swing');
      const R = 3.1 * areaMul;
      this.vfx?.spawnDecal('anime_shock', p.pos.x, p.y, p.pos.z, { theme: vfxTh || 'fire', scaleStart: 1.4, scaleEnd: R * 2.1, dur: 0.45, spinY: 6.0 });
      this.shockRing(p.pos.x, p.pos.z, R, this.rollDamage(1.9 * dmgMul, mod.fire), mod.fire ? 0xff7a50 : 0xff8ab0, 0, { slow, leech, ...trigOpts });
      this.makeSlash(p.pos, dir, R); this.makeSlash(p.pos, dir.clone().negate(), R);
      p.swing = 1; p.swingT = 0.25;
    } else if (id === 'mark') {
      this.audio.sfx('boon');
      const tx = this.aim.x, tz = this.aim.z, R = 3.2 * areaMul;
      this.vfx?.spawnArcanistCards(tx, this.world.gh(tx, tz), tz, vfxTh || 'arcane');
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
          this.vfx?.spawnFireTower(mx, this.world.gh(mx, mz), mz, vfxTh || 'fire');
          this.shockRing(mx, mz, R, this.rollDamage(2.2 * dmgMul, true), 0xff8c40, 0.7, { slow, leech, ...trigOpts });
          if (i === 0 && !this.applyElementAt(mx, mz, 'fire', R * 1.1)) this.spawnGroundZone('magma', mx, mz, R * 1.1, 5.0, 0.75 * dmgMul, { color: 0xff6a30, fire: true });
          this.fx.burst(mx, 0.8, mz, 22, { c: [0xff6a30, 0xffd85a, 0xffffff], s: 0.16, speed: 6, up: 6, life: 0.65 });
          this.puffs.burst(mx, 0.3, mz, 12, { c: [0xffa040, 0x5c3c2e], s: 0.3, speed: 4, up: 4, life: 0.8 });
          this.shake = Math.max(this.shake, 0.55);
        });
      }
      p.swing = 1; p.swingT = 0.3;
    } else if (id === 'nova') {
      this.audio.sfx('nova');
      const R = 4.6 * areaMul;
      this.vfx?.spawnSummon('ice_puffer', p.pos.x, p.y, p.pos.z, dir.x, dir.y, { theme: vfxTh || 'frost' });
      this.vfx?.spawnWaterShield(p.pos.x, p.y, p.pos.z, 2.2, vfxTh || 'frost');
      this.shockRing(p.pos.x, p.pos.z, R, this.rollDamage(2.0 * dmgMul, mod.fire), 0x7ae8ff, 0.6, { slow: Math.max(slow, 3.2), leech, ...trigOpts });
      pullVortex(p.pos.x, p.pos.z, R);
      if (!this.applyElementAt(p.pos.x, p.pos.z, 'frost', R)) {
        this.spawnGroundZone('ice', p.pos.x, p.pos.z, R * 0.9, 5.5, 0.45 * dmgMul, { color: 0x9cf0ff, slow: 2.4, slipStun: 1.1, healPlayer: true });
      }
      this.fx.burst(p.pos.x, p.y + 0.9, p.pos.z, 26, { c: [0x7ae8ff, 0xd8a8ff, 0xffffff], s: 0.14, speed: 6.5, up: 3, life: 0.65 });
      this.heal(p.stats.maxHp * 0.08, true);
      p.swing = 1; p.swingT = 0.25;
    } else if (id === 'prism') {
      this.audio.sfx('prism');
      const dist = Math.min(5, Math.hypot(this.aim.x - p.pos.x, this.aim.z - p.pos.z));
      const tx = p.pos.x + dir.x * dist, tz = p.pos.z + dir.y * dist, ty = this.world.gh(tx, tz);
      this.vfx?.spawnManaCrystal(tx, ty, tz, 8 + mod.multi, vfxTh || 'arcane');
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
      mesh.position.set(tx, ty + 1.2, tz); this.scene.add(mesh);
      this.prisms.push({ mesh, x: tx, y: ty + 1.2, z: tz, life: 8 + mod.multi, cd: 0.2, dmgMul, chain: mod.chain, slow, leech });
      this.fx.burst(tx, ty + 1.2, tz, 14, { c: [0xffe07a, 0x8ae8ff, 0xffffff], s: 0.12, speed: 4, up: 3, life: 0.5 });
      p.swing = 1; p.swingT = 0.2;
    } else if (id === 'phantom') {
      this.audio.sfx('roll');
      const ox = p.pos.x, oz = p.pos.z;
      this.vfx?.spawnShurikenFan(ox, p.y, oz, dir.x, dir.y, vfxTh || 'death');
      this.movePlayer(dir.x * 4.5, dir.y * 4.5);
      this.vfx?.spawnArcanistCards(p.pos.x, p.y, p.pos.z, vfxTh || 'death');
      p.iframes = Math.max(p.iframes, 0.65);
      const R = 3.4 * areaMul;
      this.shockRing(ox, oz, R, this.rollDamage(2.1 * dmgMul, mod.fire), 0xb48ae0, 0.4, { slow: Math.max(slow, 2.5), leech, ...trigOpts });
      this.makeSlash(p.pos, dir, 3.0 * areaMul);
      this.puffs.burst(ox, p.y + 0.5, oz, 16, { c: [0xb48ae0, 0x5c3e80, 0xffd27a], s: 0.24, speed: 4, up: 2, life: 0.7 });
      this.fx.burst(p.pos.x, p.y + 0.6, p.pos.z, 14, { c: [0xff7aa8, 0xb48ae0], s: 0.12, speed: 5, up: 2, life: 0.45 });
      p.swing = 1; p.swingT = 0.24;
    } else if (id === 'sakura') {
      this.audio.sfx('nova');
      const R = 4.4 * areaMul;
      this.vfx?.spawnSummon('lotus_burst', p.pos.x, p.y, p.pos.z, dir.x, dir.y, { theme: vfxTh || 'lotus' });
      this.shockRing(p.pos.x, p.pos.z, R, this.rollDamage(1.85 * dmgMul, mod.fire), 0xffa6c9, 0.25, { slow: Math.max(slow, 1.5), leech: leech + 3, ...trigOpts });
      pullVortex(p.pos.x, p.pos.z, R);
      this.spawnGroundZone('sakura', p.pos.x, p.pos.z, R * 0.95, 5.2, 0.52 * dmgMul, { color: 0xffa6c9, healPlayer: true, slow: 1.2 });
      this.fx.burst(p.pos.x, p.y + 1.0, p.pos.z, 28, { c: [0xffa6c9, 0xffd6e7, 0xffffff], s: 0.12, speed: 6, up: 4, life: 0.85 });
      p.swing = 1; p.swingT = 0.24;
    } else if (id === 'thunder') {
      this.audio.sfx('crit');
      this.vfx?.spawnMesh('magic_circle_star', { x: this.aim.x, y: this.world.gh(this.aim.x, this.aim.z) + 0.15, z: this.aim.z, theme: vfxTh || 'thunder', scaleStart: 0.9, scaleEnd: 1.9, dur: 0.7, spinY: 3.5 });
      const maxT = 3 + mod.multi + (mod.chain || 0);
      const targets = this.enemies.filter(e => !e.dead && Math.hypot(e.pos.x - this.aim.x, e.pos.z - this.aim.z) < 11 * areaMul).slice(0, maxT);
      if (!targets.length) {
        this.spawnBeam(this.aim.x, 9, this.aim.z, this.aim.x, 0.2, this.aim.z, 0x8ef0ff);
        this.shockRing(this.aim.x, this.aim.z, 2.8 * areaMul, this.rollDamage(2.0 * dmgMul, mod.fire), 0x8ef0ff, 0.4, { slow, leech, ...trigOpts });
      } else {
        let prev = null;
        targets.forEach(t => {
          this.spawnBeam(t.pos.x, t.pos.y + 9, t.pos.z, t.pos.x, t.pos.y + 0.5, t.pos.z, 0x8ef0ff);
          this.vfx?.spawnDecal('anime_shock', t.pos.x, t.pos.y, t.pos.z, { theme: vfxTh || 'thunder', scaleStart: 0.9, scaleEnd: 3.4, dur: 0.4 });
          if (prev) this.spawnBeam(prev.pos.x, prev.pos.y + 0.8, prev.pos.z, t.pos.x, t.pos.y + 0.8, t.pos.z, 0xc88cff);
          this.hitEnemy(t, this.rollDamage(2.1 * dmgMul, mod.fire), 0, 0, { stun: 0.35, shock: Math.max(5.0, mod.shock || 0), slow, leech, ...trigOpts });
          this.fx.burst(t.pos.x, t.pos.y + 0.9, t.pos.z, 12, { c: [0x8ef0ff, 0xffffff, 0xc88cff], s: 0.12, speed: 5, up: 3, life: 0.45 });
          prev = t;
        });
      }
      this.applyElementAt(this.aim.x, this.aim.z, 'shock', 3.4 * areaMul);
      this.shake = Math.max(this.shake, 0.32); p.swing = 1; p.swingT = 0.22;
    } else if (id === 'quakeg') {
      this.audio.sfx('slam');
      const R = 4.2 * areaMul, cx = p.pos.x + dir.x * 1.4, cz = p.pos.z + dir.y * 1.4;
      this.vfx?.spawnSummon('ground_slam', cx, this.world.gh(cx, cz), cz, dir.x, dir.y, { theme: vfxTh || 'earth' });
      this.shockRing(cx, cz, R, this.rollDamage(2.1 * dmgMul, mod.fire), 0x6ae8ff, 1.3, { slow, leech, ...trigOpts });
      pullVortex(cx, cz, R);
      this.puffs.burst(cx, 0.2, cz, 18, { c: [0x6ae8ff, 0x7b7874, 0xffffff], s: 0.28, speed: 5.5, up: 5, life: 0.75 });
      this.addDecal('circle', cx, cz, R * 1.2, 0x6ae8ff, 0.42, null, () => {
        this.audio.sfx('slam');
        this.shockRing(cx, cz, R * 1.2, this.rollDamage(1.9 * dmgMul, mod.fire), 0x7ae8ff, 1.0, { slow, leech, ...trigOpts });
        this.shake = Math.max(this.shake, 0.48);
      });
      p.swing = 1; p.swingT = 0.28;
    } else if (id === 'paladin_sword') {
      this.audio.sfx('slam');
      const tx = this.aim.x, tz = this.aim.z, R = 3.8 * areaMul;
      this.vfx?.spawnSummon('paladin_sword', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'holy' });
      this.shockRing(tx, tz, R, this.rollDamage(2.4 * dmgMul, mod.fire), 0xffe07a, 1.2, { slow, leech, ...trigOpts });
      pullVortex(tx, tz, R);
      this.shake = Math.max(this.shake, 0.48); p.swing = 1; p.swingT = 0.26;
    } else if (id === 'fire_whale') {
      this.audio.sfx('meteor');
      const tx = this.aim.x, tz = this.aim.z, R = 4.8 * areaMul;
      this.vfx?.spawnSummon('fire_whale', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'fire' });
      this.shockRing(tx, tz, R, this.rollDamage(2.9 * dmgMul, true), 0xff6a30, 1.1, { slow, leech, ...trigOpts });
      this.spawnGroundZone('magma', tx, tz, R * 0.9, 5.5, 0.85 * dmgMul, { color: 0xff6a30, fire: true });
      pullVortex(tx, tz, R);
      this.shake = Math.max(this.shake, 0.62); p.swing = 1; p.swingT = 0.3;
    } else if (id === 'thunder_phoenix') {
      this.audio.sfx('ultFort');
      const R = 3.4 * areaMul;
      this.vfx?.spawnSummon('thunder_phoenix', p.pos.x, p.y, p.pos.z, dir.x, dir.y, { theme: vfxTh || 'thunder' });
      for (let i = 1; i <= 3; i++) {
        const px = p.pos.x + dir.x * (i * 2.8), pz = p.pos.z + dir.y * (i * 2.8);
        this.shockRing(px, pz, R, this.rollDamage(1.85 * dmgMul, mod.fire), 0x7ae8ff, 0.5, { shock: 5.0, slow, leech, ...trigOpts });
        this.applyElementAt(px, pz, 'shock', R);
      }
      this.shake = Math.max(this.shake, 0.42); p.swing = 1; p.swingT = 0.25;
    } else if (id === 'dark_wolf') {
      this.audio.sfx('slam');
      const tx = this.aim.x, tz = this.aim.z, R = 4.2 * areaMul;
      this.vfx?.spawnSummon('wolf_head', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'death' });
      this.vfx?.spawnClawSlash(tx, this.world.gh(tx, tz), tz, Math.atan2(dir.x, dir.y), vfxTh || 'death');
      this.shockRing(tx, tz, R, this.rollDamage(2.7 * dmgMul, mod.fire), 0xb86cff, 0.8, { leech: leech + 5, slow, ...trigOpts });
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.pos.x - tx, e.pos.z - tz) < R + e.r) e.vuln = 6.0;
      pullVortex(tx, tz, R);
      this.shake = Math.max(this.shake, 0.45); p.swing = 1; p.swingT = 0.25;
    } else if (id === 'healing_tree') {
      this.audio.sfx('boon');
      const tx = p.pos.x + dir.x * 1.8, tz = p.pos.z + dir.y * 1.8, R = 4.6 * areaMul;
      this.vfx?.spawnSummon('healing_tree', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'lotus', dur: 6.5 });
      this.vfx?.spawnSummon('totem', tx + 1.4, this.world.gh(tx + 1.4, tz), tz, dir.x, dir.y, { theme: vfxTh || 'lotus', heal: true, dur: 6.5 });
      if (p.statuses) { p.statuses.poison = 0; p.statuses.burn = 0; }
      this.heal(p.stats.maxHp * 0.2, true);
      this.spawnGroundZone('sakura', tx, tz, R, 6.5, 0.45 * dmgMul, { color: 0x7fe08a, healPlayer: true, slow: 1.5 });
      p.swing = 1; p.swingT = 0.22;
    } else if (id === 'black_hole') {
      this.audio.sfx('warp');
      const tx = this.aim.x, tz = this.aim.z, R = 4.8 * areaMul;
      this.vfx?.spawnSummon('black_hole', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'arcane', dur: 3.6 });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = tx - e.pos.x, dz = tz - e.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.5 && d < R * 1.7) { e.pos.x += (dx / d) * Math.min(3.5, d * 0.72); e.pos.z += (dz / d) * Math.min(3.5, d * 0.72); }
      }
      this.shockRing(tx, tz, R, this.rollDamage(2.2 * dmgMul, mod.fire), 0x9c5ad8, 1.0, { slow: 2.5, leech, ...trigOpts });
      p.swing = 1; p.swingT = 0.26;
    } else if (id === 'blue_tornado') {
      this.audio.sfx('nova');
      const R = 3.8 * areaMul, tx = p.pos.x + dir.x * 2.6, tz = p.pos.z + dir.y * 2.6;
      this.vfx?.spawnSummon('tornado', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'bluefire', dur: 3.6 });
      this.shockRing(tx, tz, R, this.rollDamage(2.1 * dmgMul, true), 0x42b8ff, 0.7, { slow: 1.8, leech, ...trigOpts });
      this.applyElementAt(tx, tz, 'fire', R);
      pullVortex(tx, tz, R);
      p.swing = 1; p.swingT = 0.24;
    } else if (id === 'spear_cage') {
      this.audio.sfx('prism');
      const tx = this.aim.x, tz = this.aim.z, R = 3.6 * areaMul;
      this.vfx?.spawnSummon('spear_cage', tx, this.world.gh(tx, tz), tz, dir.x, dir.y, { theme: vfxTh || 'thunder', radius: R });
      this.vfx?.spawnElementalSpear(p.pos.x, p.y, p.pos.z, dir.x, dir.y, vfxTh || 'thunder');
      this.shockRing(tx, tz, R, this.rollDamage(2.3 * dmgMul, mod.fire), 0x7ae8ff, 1.5, { shock: 5.5, slow: 3.0, leech, ...trigOpts });
      p.swing = 1; p.swingT = 0.25;
    } else if (id === 'sword_beams') {
      this.audio.sfx('swing');
      const n = 3 + mod.multi, spread = 0.22;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * spread, d = dir.clone().rotateAround(new V2(), a);
        this.vfx?.spawnSlash(p.pos.x + d.x * 1.6, p.y, p.pos.z + d.y * 1.6, Math.atan2(d.x, d.y), { clean: true, theme: vfxTh || 'arcane', scale: 2.2 });
        this.fireProj(p.pos, d, { speed: 19, mult: 1.45 * dmgMul, fire: mod.fire, pierce: 6, wave: true, color: 0xff7aa8, size: 0.42, life: 0.75, slow, leech, ...trigOpts });
      }
      p.swing = 1; p.swingT = 0.22;
    } else if (id === 'candle_ward') {
      this.audio.sfx('wisp');
      const R = 3.4 * areaMul;
      this.vfx?.spawnSummon('candle_ward', p.pos.x, p.y, p.pos.z, dir.x, dir.y, { theme: vfxTh || 'bluefire', radius: R, dur: 6.0 });
      this.heal(p.stats.maxHp * 0.14, true);
      p.mana = Math.min(p.stats.mana, p.mana + 20);
      this.spawnGroundZone('magma', p.pos.x, p.pos.z, R, 6.0, 0.55 * dmgMul, { color: 0x42b8ff, fire: true, healPlayer: true });
      p.swing = 1; p.swingT = 0.22;
    }
    // 古樹鹿王之魂（戰鬥槽）：施放主動技能召喚 3 道古樹根鬚衝擊波向前穿刺
    if (!isTrigger && p.souls?.combat?.id === 'stag' && (this._stagSoulCd || 0) <= this.time) {
      this._stagSoulCd = this.time + 1.8;
      for (let i = 1; i <= 3; i++) {
        const rx = p.pos.x + dir.x * (i * 2.2), rz = p.pos.z + dir.y * (i * 2.2);
        this.addDecal('circle', rx, rz, 1.5, 0x6aa84a, 0.2 + i * 0.14, null, () => {
          this.shockRing(rx, rz, 1.8 * areaMul, this.rollDamage(1.15 * dmgMul, false), 0x6aa84a, 0.35, { isTrigger: true });
          this.puffs.burst(rx, 0.2, rz, 6, { c: [0x6e4a33, 0x6aa84a], s: 0.22, speed: 2.5, up: 4.5, life: 0.5 });
        });
      }
    }
  }
  tryBolt() {
    const p = this.player; if (p.cds.bolt > 0 || p.roll > 0) return;
    if (p.mana < 8) { if (!this._noManaT || this.time - this._noManaT > 1) { this.ui.toast('法力不足', '#7fb2ff'); this.ui.status?.noMana(); this._noManaT = this.time; } return; }
    this.ambushTrial?.event('skill', { skill: 'bolt' });
    this.audio.sfx('bolt'); p.mana -= 8; p.cds.bolt = 0.78 / (1 + p.stats.atkSpd / 200);
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
    // 自我審查優化：接通投射物上限過載折算（超過 16 枚時轉化為現存投射物過載傷害，避免畫質掉幀）
    const fold = foldExcessProjectiles(this.projs.length, 1);
    if (fold.spawnCount <= 0) {
      const last = this.projs[this.projs.length - 1];
      if (last) last.mult = Math.min(4.5, (last.mult || 1) * fold.overloadMult);
      return;
    }
    const geo = o.wave ? new THREE.BoxGeometry(1.6, 0.1, 0.3) : new THREE.IcosahedronGeometry(o.size, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.color, transparent: !!o.wave, opacity: 0.8 }));
    mesh.position.set(pos.x + dir.x * 0.5, (pos.y || 0) + 0.6, pos.z + dir.y * 0.5);
    if (o.wave) { mesh.rotation.y = Math.atan2(dir.x, dir.y); mesh.userData.noNormal = true; }
    this.scene.add(mesh);
    const extra = o.orbit ? { orbitAngle: Math.atan2(dir.y, dir.x), orbitR: 2.2, orbitClearT: 0.35, pierce: Math.max(o.pierce || 0, 99), life: Math.max(o.life || 1.1, 2.4) } : {};
    this.projs.push({ mesh, vx: dir.x * o.speed, vz: dir.y * o.speed, life: o.life || 1.1, ...o, ...extra, hit: new Set() });
  }
  tryRoll() {
    const p = this.player;
    if (p.air || p.climbing) return;
    if (p.cds.roll > 0 || p.roll > 0) {
      p.inputBuf = { kind: 'roll', t: 0.12 };
      return;
    }
    this.audio.sfx('roll');
    this.vfx?.spawnTwirlDash(p.pos.x, p.y, p.pos.z, 'wind');
    const mv = this.moveInput();
    if (mv.lengthSq() < 0.01) { const a = this.aimDir(); mv.set(a.x, a.y); }
    p.rollDir.set(mv.x, 0, mv.y).normalize();
    p.swingT = 0; p.roll = 0.28; p.cds.roll = 0.78 * (this.has('gale') ? 0.65 : 1) * (1 - (p.stats.rollCdr || 0) / 100) * (1 - p.stats.cdr / 100);
    if (this.ambushTrial) this.ambushTrial.roll(this.enemies.find(e => e.type === 'boar' && !e.dead));
    p.facing = Math.atan2(mv.x, mv.y);
    if (this.has('gale')) p.galeBuff = true;
    this.puffs.burst(p.pos.x, 0.15, p.pos.z, 5, { c: 0xf4ecd8, s: 0.25, speed: 1.5, up: 0.5, g: -0.5, life: 0.5, grow: 1, drag: 4 });
    if (p.specials.has('frostRoll')) {
      const d = this.addDecal('circle', p.pos.x, p.pos.z, 2.2, 0xbfe6ff, 2.0, null, null, 2);
      d.frost = true;
    }
    // 怪物靈魂（移動槽）模組：史萊姆毒池 / 野豬霸體衝鋒 / 巨像星晶震波
    const mSoul = p.souls?.mobility?.id;
    if (mSoul === 'slime') {
      this.spawnGroundZone('poison', p.pos.x, p.pos.z, 2.4, 4.0, 0.45, { color: 0x78d464, poison: 4.5, slow: 2.0 });
      this.fx.burst(p.pos.x, p.y + 0.3, p.pos.z, 10, { c: [0x78d464, 0xb5e080], s: 0.12, speed: 3.5, up: 2.5, life: 0.45 });
    } else if (mSoul === 'boar') {
      this.audio.sfx('slam');
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
        const proj = dx * p.rollDir.x + dz * p.rollDir.z;
        const perp = Math.abs(dx * p.rollDir.z - dz * p.rollDir.x);
        if (proj >= -0.6 && proj <= 4.6 && perp <= e.r + 1.15) {
          // 自我審查修正（MMO 防亂飛）：對精英與 Boss 改為原地暈眩＋破甲，不將王撞出隊友法陣
          const isHeavy = e.elite || e.legendary || e.type === 'stag';
          if (isHeavy) e.vuln = Math.max(e.vuln || 0, 3.5);
          this.hitEnemy(e, this.rollDamage(2.2), isHeavy ? 0 : p.rollDir.x * 8, isHeavy ? 0 : p.rollDir.z * 8, { stun: isHeavy ? 1.4 : 1.2, hitstop: 0.04, isTrigger: true });
        }
      }
      this.fx.burst(p.pos.x, p.y + 0.4, p.pos.z, 12, { c: [0xd87a4a, 0xffe480], s: 0.13, speed: 5, up: 2, life: 0.4 });
    } else if (mSoul === 'golem') {
      this.audio.sfx('slam');
      this.shockRing(p.pos.x, p.pos.z, 3.2, this.rollDamage(1.3), 0x6ae8ff, 1.1, { isTrigger: true });
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
    for (const w of p.wisps) { this.scene.remove(w.mesh); disposeObj3D(w.mesh); }
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
    this.ambushTrial?.event('flask');
    p.flask.charges--; p.healOver = 1.0; this.audio.sfx('flask');
    p.heroRig?.play('buff', { once: true, force: true });
    this.vfx?.spawnPeaceBlessing(p.pos.x, p.y, p.pos.z, 'lotus');
    p.healRate = p.stats.maxHp * 0.42 * (1 + 0.25 * p.boons.filter(b => b === 'flask').length);
    this.fx.burst(p.pos.x, 1, p.pos.z, 10, { c: [0xff7a8a, 0xffd0d8], s: 0.1, speed: 2, up: 3, life: 0.6, g: -1 });
  }
  takeBoon(b) {
    const p = this.player;
    p.boons.push(b.id); this.audio.sfx('boon');
    p.heroRig?.play('buff', { once: true, force: true });
    if (b.skill) p.skills[b.skill] = true;
    this.recalc();
    if (b.id === 'thick') p.hp = p.stats.maxHp;
    this.state = 'play';
    this.ui.toast(`獲得天賦：${b.name}`, '#c08cff');
    this.activateExits();
  }

  moveInput() {
    const k = this.keys; const v = new V2((k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0), (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0));
    if (this.touchInput && this.canUseTouchControls()) {
      v.x += this.touchInput.x;
      v.y += this.touchInput.z;
    }
    if (v.lengthSq() > 1) v.normalize();
    if (this.camYaw && v.lengthSq() > 0.001) {
      const c = Math.cos(this.camYaw), s = Math.sin(this.camYaw);
      const rx = v.x * c + v.y * s, ry = -v.x * s + v.y * c;
      v.set(rx, ry);
    }
    return v;
  }

  canUseTouchControls() {
    const ui = this.ui;
    return (this.state === 'play' || this.state === 'raid') && !this.sailing && !this.gatherActive && !this.photoMode
      && !ui.invOpen && !ui.panelOpen && !ui.setOpen && !ui.puzzleOpen && !ui.mapDialog?.open
      && !ui.codexOpen && !ui.simRosterOpen && !ui.simInspectOpen
      && document.activeElement?.id !== 'chatIn';
  }

  aimForTouch() {
    const { pos, facing } = this.player;
    let bestScore = 16;
    let target = null;
    for (const enemy of this.enemies) {
      if (enemy.dead || !enemy.m.root.visible) continue;
      const distance = Math.hypot(enemy.pos.x - pos.x, enemy.pos.z - pos.z);
      if (distance >= 16) continue;
      const openBonus = distance <= 7.5 && ((enemy.state === 'rest' && enemy.t < (enemy.chargeRecoveryS || 0)) || (enemy.type === 'thorn' && enemy.state === 'aim')) ? -3.2 : 0;
      const score = distance + openBonus;
      if (score >= bestScore) continue;
      bestScore = score;
      target = enemy;
    }
    if (target) this.aim.copy(target.pos);
    else this.aim.set(pos.x + Math.sin(facing) * 5, pos.y, pos.z + Math.cos(facing) * 5);
  }

  resolveBoxCollisions(pos, r, y = 0, isPlayer = false) {
    for (const b of this.worldBoxes || []) {
      if (isPlayer && b.enemiesOnly) continue;
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
    // 所有怪物皆可在全陸地（含高台與斜坡地形）自由上下移動
    const W = this.world;
    const nx = pos.x + dx;
    if (W.isLand(nx + Math.sign(dx) * r * 0.6, pos.z)) pos.x = nx;
    const nz = pos.z + dz;
    if (W.isLand(pos.x, nz + Math.sign(dz) * r * 0.6)) pos.z = nz;
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
    const hoverWater = !!this.mount?.def?.hoverWater;
    const ok = (cx, cz) => {
      if (!W.isLand(cx, cz)) {
        if (hoverWater && Math.abs(cx) < W.half - 2 && Math.abs(cz) < W.half - 2) return true;
        return false;
      }
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
    this.resolveBoxCollisions(pos, r, p.y, true);
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
      const glide = ((this.keys[' '] || (this.touchInput?.glide && this.canUseTouchControls())) && p.vy < 0 && p.stamina > 0 && p.roll <= 0);
      const gravMul = p.realmRule?.gravityMult || 1;
      p.vy -= 24 * gravMul * dt;
      if (glide) {
        if (!p.gliding0) this.audio.sfx('glide');
        p.vy = Math.max(p.vy, -1.6 * gravMul); p.stamina -= 10 * dt * this.meta.staminaK; p.gliding = true;
      }
      p.gliding0 = glide;
      // 雲翼飛鰩之魂（移動槽）：滯空時每 0.45 秒自動發射追蹤雷光羽翼
      if (p.souls?.mobility?.id === 'skyray' && (this._skyrayCd || 0) <= this.time) {
        let best = null, bd = 11;
        for (const e of this.enemies) if (!e.dead) { const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (d < bd) { bd = d; best = e; } }
        if (best) {
          this._skyrayCd = this.time + 0.45;
          const fd = new V2(best.pos.x - p.pos.x, best.pos.z - p.pos.z).normalize();
          this.fireProj(p.pos, fd, { speed: 18, mult: 0.75, color: 0x58d4f0, size: 0.11, homing: best, shock: 3.0, airShot: true, life: 1.0, isTrigger: true });
        }
      }
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
        } else if (vyBefore < -4) {
          this.audio.sfx('land');
          this.puffs.burst(p.pos.x, p.y + 0.1, p.pos.z, 6, { c: 0xf4ecd8, s: 0.25, speed: 2, up: 0.5, g: -0.3, life: 0.45, grow: 1, drag: 3 });
          if (p.souls?.mobility?.id === 'golem') this.shockRing(p.pos.x, p.pos.z, 3.0, this.rollDamage(1.2), 0x6ae8ff, 1.0, { isTrigger: true });
        }
      }
    }
    p.pos.y = p.y;
    if (p.y < -0.1 && !W.isLand(p.pos.x, p.pos.z)) { p.pos.x = p.lastLow.x; p.pos.z = p.lastLow.z; p.y = W.gh(p.pos.x, p.pos.z); }
  }
  toggleMount(forceOff = false) {
    if (!forceOff && (this.state !== 'play' || this.interior || this.sailing)) {
      this.ui.toast('此處無法召喚坐騎', '#ffe08a');
      return;
    }
    if (this.mount) {
      this.scene.remove(this.mount.mesh.root);
      disposeObj3D(this.mount.mesh.root);
      this.mount = null;
      if (!forceOff) { this.audio.sfx('sit'); this.ui.toast('已收起坐騎', '#e8dcc8'); }
      return;
    }
    if (forceOff) return;
    const def = activeMountDef(this.meta.p);
    if (!def) {
      this.ui.toast('🔒 尚未持有坐騎！達 Lv.10 且擊殺 60 隻魔物後，按 I → 造型坐騎 鍛造鞍具馴養「林間巨鹿」', '#ffd85a');
      return;
    }
    const mesh = buildMountMesh(def.id);
    mesh.root.position.set(this.player.pos.x, this.player.y, this.player.pos.z);
    this.scene.add(mesh.root);
    this.mount = { def, mesh };
    this.player.sitting = null;
    this.audio.sfx('boon');
    this.fx.burst(this.player.pos.x, this.player.y + 0.8, this.player.pos.z, 16, { c: [def.accent, 0xffffff], s: 0.13, speed: 4.5, up: 3, life: 0.55 });
    this.ui.toast(`${def.icon} 已召喚坐騎：${def.name}（${def.perk}）`, '#ffe480');
  }
  tryJump() {
    const p = this.player;
    if (p.climbing) { p.climbing = false; p.air = true; p.vy = 6.5; this.audio.sfx('jump'); return; }
    if (p.air || p.roll > 0) return;
    const skyMul = (p.souls?.mobility?.id === 'skyray' ? 1.3 : 1) * (p.realmRule?.jumpMult || 1) * (p.terrainFx?.jumpBonus || 1);
    p.air = true; p.vy = (8.2 + (this.mount?.def?.jumpBonus || 0)) * skyMul; this.audio.sfx('jump');
    this.puffs.burst(p.pos.x, p.y + 0.1, p.pos.z, 4, { c: p.realmRule?.id === 'low_gravity' ? 0x7ef8ff : 0xf4ecd8, s: 0.2, speed: 1.5, up: 0.3, g: -0.3, life: 0.35, grow: 1, drag: 3 });
  }


  // ---------------- meta：碎片、羽毛、貝殼、互動 ----------------
  onKillMeta(e) {
    const m = this.meta, d = this.depth;
    m.event('kill'); if (e.elite) m.event('elite'); if (e.type === 'stag') m.event('boss');
    m.p.kills++;
    let n = e.type === 'stag' ? 120 : e.elite ? 10 + d : (Math.random() < 0.4 ? 1 + (d >> 1) : 0);
    const atlas = (!this.field && this.depth >= 0) ? computeAtlasSummary(ensureAtlas(m.p)) : null;
    const repShardMul = 1 + (getGuildRepInfo(m.p).shardBonus || 0) / 100;
    const greedShardMul = 1 + (this.player?.runeBonuses?.shardBonus || 0) / 100;
    n = Math.round(n * m.shardMult * (atlas ? atlas.shardMult : 1) * repShardMul * greedShardMul);
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
    for (const sh of this.sheep || []) { const d = Math.hypot(sh.x - p.pos.x, sh.z - p.pos.z); if (d < Math.min(bd, 2.2)) { bd = d; best = { kind: 'pet_sheep', label: '🐑 撫摸蓬鬆小綿羊（獲得軟綿祝福）', x: sh.x, z: sh.z, top: 1.5, sheep: sh }; } }
    if (!this.interior) for (const r of this.remotes.values()) if (r.bot) { const d = Math.hypot(r.x - p.pos.x, r.z - p.pos.z); if (d < Math.min(bd, 2.2)) { bd = d; best = { kind: 'talk', label: r.name.replace(' (鎮民)', ''), x: r.x, z: r.z, top: 2.4, bot: r }; } }
    return best;
  }
  spawnGroundZone(kind, x, z, r, dur, dmgMul, opts = {}) {
    const def = SURFACE_DEFS[kind] || {};
    const y = this.world.gh(x, z) + 0.08;
    const col = opts.color ?? def.color ?? 0x7ae8ff;
    const op = opts.opacity ?? def.opacity ?? 0.42;
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.12, r, 24),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.userData.noNormal = true;
    this.scene.add(mesh);
    const zone = { kind, mesh, x, y, z, r, life: dur || def.dur || 5.5, maxLife: dur || def.dur || 5.5, tick: 0.25, dmgMul: dmgMul ?? def.dmgMul ?? 0.4, color: col, slipStun: def.slipStun || 0, blindVision: def.blindVision || 0, shock: def.shock || 0, poison: def.poison || 0, fire: !!def.fire, slow: def.slow || 0, ...opts };
    this.groundZones.push(zone);
    if (!this._elemTipShown && ['water', 'ice', 'poison'].includes(kind)) {
      this._elemTipShown = true;
      this.ui.toast('💡 環境連鎖提示：對積水／冰面／毒霧施放火或雷技能，可引發蒸汽、雷暴與劇毒爆燃！', '#9cf0ff');
    }
    return zone;
  }
  applyElementAt(x, z, element, radius = 2.6) {
    if (!element) return false;
    let reacted = false;
    for (const gz of this.groundZones || []) {
      if (gz.life <= 0) continue;
      if (Math.hypot(gz.x - x, gz.z - z) > gz.r + radius) continue;
      const rx = resolveSurfaceReaction(gz.kind, element);
      if (!rx) continue;
      reacted = true;
      const nextDef = SURFACE_DEFS[rx.nextKind] || {};
      gz.kind = rx.nextKind;
      if (gz.sporeSource && element === 'fire') gz.sporeSource = null;
      gz.r = Math.min(6.2, gz.r * (rx.radiusMult || 1));
      gz.life = gz.maxLife = nextDef.dur || 5.8;
      gz.color = rx.color;
      gz.dmgMul = Math.max(gz.dmgMul || 0.4, nextDef.dmgMul || 0.6);
      gz.slipStun = nextDef.slipStun || 0;
      gz.blindVision = nextDef.blindVision || 0;
      gz.shock = rx.shock || nextDef.shock || 0;
      gz.fire = !!(rx.fire || nextDef.fire);
      gz.slow = rx.slow || nextDef.slow || 0;
      gz.poison = 0;
      gz.mesh.material.color.setHex(rx.color);
      gz.mesh.scale.setScalar(rx.radiusMult || 1);
      this.audio.sfx('reaction');
      this.hitstop = Math.max(this.hitstop, 0.05);
      this.shake = Math.max(this.shake, 0.32);
      this.fx.burst(gz.x, gz.y + 0.8, gz.z, 22, { c: [rx.color, 0xffffff], s: 0.14, speed: 6, up: 4.5, life: 0.65 });
      this.ui.dmgNum(gz.x, gz.y + 2.0, gz.z, rx.label.split('！')[0] + '!', 'crit');
      if ((this._rxToastCd || 0) <= this.time) { this._rxToastCd = this.time + 1.2; this.ui.toast(rx.label, '#' + rx.color.toString(16).padStart(6, '0')); }
      if (rx.bonusDmgMult > 0) {
        this.shockRing(gz.x, gz.z, gz.r, this.rollDamage(rx.bonusDmgMult, !!rx.fire), rx.color, rx.stun || 0, { slow: rx.slow, isReaction: true, isTrigger: true });
      }
      if (rx.nextKind === 'electrified_steam' || rx.nextKind === 'electrified_water') {
        const shocked = this.enemies.filter(e => !e.dead && Math.hypot(e.pos.x - gz.x, e.pos.z - gz.z) < gz.r + e.r + 1.5);
        for (let i = 0; i < shocked.length; i++) {
          shocked[i].statuses = shocked[i].statuses || {}; shocked[i].statuses.shock = Math.max(shocked[i].statuses.shock || 0, rx.shock || 6);
          if (i > 0) this.spawnBeam(shocked[i - 1].pos.x, shocked[i - 1].pos.y + 0.8, shocked[i - 1].pos.z, shocked[i].pos.x, shocked[i].pos.y + 0.8, shocked[i].pos.z, rx.color);
        }
      }
    }
    // v5 藍圖特殊淺區地貌連鎖反應（冰湖融冰、熔岩急冷、淺水感電／結冰、毒沼爆燃）
    if (!reacted && this.field && this.world?.shallowAt) {
      const sk = this.world.shallowAt(x, z);
      const tfx = getTerrainEffect(sk);
      if (tfx?.surfaceBase) {
        const effEl = (tfx.surfaceBase === 'magma' && element === 'frost') ? 'water' : element;
        const rx = resolveSurfaceReaction(tfx.surfaceBase, effEl);
        if (rx) {
          this.spawnGroundZone(rx.nextKind, x, z, Math.max(2.6, radius), 6.0, rx.bonusDmgMult * 0.6, { color: rx.color });
          this.audio.sfx('reaction');
          this.fx.burst(x, this.world.gh(x, z) + 0.8, z, 20, { c: [rx.color, 0xffffff], s: 0.14, speed: 5.8, up: 4.2, life: 0.6 });
          this.ui.dmgNum(x, this.world.gh(x, z) + 1.9, z, `${tfx.icon} ${rx.label.split('！')[0]}!`, 'crit');
          if ((this._rxToastCd || 0) <= this.time) { this._rxToastCd = this.time + 1.2; this.ui.toast(`${tfx.icon} 地貌連鎖 · ${rx.label}`, '#' + rx.color.toString(16).padStart(6, '0')); }
          if (rx.bonusDmgMult > 0) this.shockRing(x, z, Math.max(2.8, radius), this.rollDamage(rx.bonusDmgMult * 0.85, !!rx.fire), rx.color, rx.stun || 0, { slow: rx.slow, isReaction: true, isTrigger: true });
          reacted = true;
        }
      }
    }
    // 下雨天氣自動淋濕地面：若無重疊區域，降雨中的冰／火／雷法術直接與雨濕地面反應！
    if (!reacted && this.weather?.isRaining && ['frost', 'fire', 'shock'].includes(element)) {
      const rx = resolveSurfaceReaction('water', element);
      if (rx) {
        this.spawnGroundZone(rx.nextKind, x, z, Math.max(2.4, radius), 5.8, rx.bonusDmgMult * 0.55, { color: rx.color });
        this.ui.dmgNum(x, this.world.gh(x, z) + 1.8, z, `🌧️ ${rx.label.split('！')[0]}!`, 'crit');
        if (rx.bonusDmgMult > 0) this.shockRing(x, z, Math.max(2.6, radius), this.rollDamage(rx.bonusDmgMult * 0.75, !!rx.fire), rx.color, rx.stun || 0, { slow: rx.slow, isReaction: true, isTrigger: true });
        reacted = true;
      }
    }
    if (reacted && this.runStats) this.runStats.synergyProcs++;
    return reacted;
  }
  tryInteract() {
    const s = this.nearSpot(); if (!s) return false;
    if (s.kind === 'meadowCave') {
      this.ui.openPanel('meadowCave');
      return true;
    }
    if (s.kind === 'expedition_lamp') {
      if (completeMeadowObjective(this, s.expeditionId)) {
        if (s.ignition) {
          this.spawnGroundZone('poison', s.x, s.z, 1.75, 1, 0.4);
          this.applyElementAt(s.x, s.z, 'fire', 0.25);
        }
        s.label = s.label.replace(/^(點亮|引燃)/, '已$1');
        s.light.material.color.setHex(0xffdf81);
        this.audio.sfx('wisp');
        this.fx.burst(s.x, s.top, s.z, 12, { c: [0xffd88a, 0xffffff], life: 0.6, speed: 3, up: 3 });
      }
      return true;
    }
    if (s.kind === 'pet_sheep') {
      const sh = s.sheep;
      if (sh) { sh.hop = 0.45; sh.wait = 3; }
      this.shrineBuffs = this.shrineBuffs || { fury: 0, frost: 0, gold: 0, sheep: 0 };
      this.shrineBuffs.sheep = 60;
      this.audio.sfx('emote');
      this.fx.burst(s.x, 1.1, s.z, 12, { c: [0xff9eb8, 0xffe480, 0xffffff], s: 0.11, speed: 3, up: 3.5, life: 0.65 });
      this.ui.toast('🐑 咩～小羊很開心！獲得 60 秒「軟綿祝福」（移速 +10% · 緩慢回復）', '#ffe49e');
      return true;
    }
    if (s.kind === 'sit') {
      const p = this.player;
      if (p.sitting) { p.sitting = null; this.audio.sfx('sit'); return true; }
      p.sitting = { x: s.x, z: s.z, y: this.world.gh(s.x, s.z), facing: s.facing ?? p.facing };
      p.pos.set(s.x, p.sitting.y, s.z); p.y = p.sitting.y; p.facing = p.sitting.facing; p.vel.set(0, 0, 0);
      this.audio.sfx('sit');
      this.ui.toast('🪑 已坐下休憩（持續回復生命與法力，按移動鍵起身）', '#ffe8a0');
      return true;
    }
    if (s.kind === 'well_drink') {
      this.player.flask.charges = this.player.flask.max;
      this.heal(this.player.stats.maxHp * 0.35, true);
      this.audio.sfx('splash');
      this.ui.toast('💧 汲取甘泉！蜜藥瓶已補滿並回復生命', '#7ae8ff');
      return true;
    }
    if (s.kind === 'fountain_wish') {
      if ((this.meta.p.coins || 0) < 1) { this.ui.toast('需要 1 枚金幣才能投幣許願', '#ffd85a'); return true; }
      this.meta.p.coins -= 1;
      const roll = Math.random();
      this.audio.sfx('wish');
      this.fx.burst(0, 1.5, -1, 18, { c: [0xffd85a, 0x7ae8ff, 0xffffff], s: 0.12, speed: 4, up: 4, life: 0.7 });
      if (roll < 0.45) { this.meta.p.shards += 6; this.ui.toast('🪙 許願成功！泉水回饋 ✦ 星砂 +6', '#ffe08a'); }
      else if (roll < 0.8) { this.player.hp = this.player.stats.maxHp; this.player.mana = this.player.stats.mana; this.ui.toast('🪙 許願成功！身心煥然一新（生命與法力全滿）', '#a8f0c0'); }
      else { this.player.statuses.overload = 8; this.ui.hpVial?.impulse(0, 1.8); this.ui.mpVial?.impulse(0, 2.0); this.ui.toast('🪙 泉神祝福！獲得 8 秒魔力過載！', '#c88cff'); }
      this.meta.save(); return true;
    }
    if (s.kind === 'ferry_harbor') { this.sailTo('harbor'); return true; }
    if (s.kind === 'ferry_town') { this.sailTo('town'); return true; }
    if (s.kind === 'open_stash') { this.audio.sfx('ui'); this.ui.openInvTab?.(this, 'stash'); return true; }
    if (s.kind === 'open_cosmetics') {
      this.audio.sfx('ui');
      if (this.ui.openWardrobe3D) this.ui.openWardrobe3D();
      else this.ui.openInvTab?.(this, 'cosmetics');
      return true;
    }
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
    if (s.kind === 'rekindle_lantern') return rekindleTide(this);
    if (this.field) return useFieldSpot(this, s);
    if (s.kind === 'talk') { const r = s.bot; this.say(r.id, r.lines[(Math.random() * r.lines.length) | 0]); r.tf = Math.atan2(this.player.pos.x - r.x, this.player.pos.z - r.z); r.wait = Math.max(r.wait, 4);
      if (!this.talked.has(r.id)) { this.talked.add(r.id); this.meta.event('talk'); } if (r.loreNpc) loreHook(this, { kind: 'talk', npc: r.loreNpc }); this.audio.sfx('ui'); return true; }
    this.audio.sfx('ui'); this.ui.openPanel(s.kind); return true;
  }
  enterInterior(kind) {
    this.mapPin = null;
    this.audio.sfx('door');
    this.savedTown = { pos: this.player.pos.clone(), spots: this.spots, simCount: getSimConfig(this).count };
    if (this.world.group) this.world.group.visible = false;
    if (this.townGroup) this.townGroup.visible = false;
    for (const x of this.exits) x.g.visible = false;
    for (const r of this.remotes.values()) { r.m.root.visible = false; r.tag.style.display = 'none'; r.bub.style.display = 'none'; }
    for (const adventurer of this._simAdvs || []) {
      adventurer.m.root.visible = false;
      if (adventurer.tag) adventurer.tag.style.display = 'none';
      if (adventurer.bub) adventurer.bub.style.opacity = 0;
    }
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
    this.mapPin = null;
    this.audio.sfx('door');
    this.scene.remove(this.interior.group); disposeObj3D(this.interior.group); this.interior = null;
    if (this.world.group) this.world.group.visible = true;
    if (this.townGroup) this.townGroup.visible = true;
    for (const x of this.exits) x.g.visible = true;
    for (const r of this.remotes.values()) { r.m.root.visible = true; r.tag.style.display = ''; r.bub.style.display = ''; }
    if (this.savedTown) {
      this.player.pos.copy(this.savedTown.pos);
      this.spots = this.savedTown.spots;
      if (this.savedTown.simCount !== getSimConfig(this).count) spawnSimAdventurers(this);
      this.savedTown = null;
    }
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
    this.meta.p.goods.wood -= 1;
    const p = this.player, x = p.pos.x + Math.sin(p.facing) * 1.4, z = p.pos.z + Math.cos(p.facing) * 1.4, y = this.world.gh(x, z);
    this.spawnCampfireAt(x, y, z);
    if (this.runStats) this.runStats.campfires++;
    this.audio.sfx('campfire');
    const hs = this.hotspots ? getFieldHotspot(this.field, this.hotspots) : null;
    if (hs?.kind === 'food_night') {
      this.meta.p.mealBoost = 1.5;
      this.meta.p.mealUntil = Math.max(this.meta.p.mealUntil || 0, Date.now()) + 450000;
      this.recalc();
      this.ui.toast('🍗 旅人美食夜市營火共食！料理回血 +50%（3/秒，持續 7.5 分鐘）', '#ffd85a');
    } else {
      this.ui.toast('🔥 已生起野外營火！靠近可持續回復生命與法力', '#ffb86a');
    }
    this.meta.save();
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
    // 南岸木造碼頭棧橋（由南岸 z=19 延伸入深海 z=27.6）＋ 渡船停泊於深水盡頭
    const pierData = buildWoodenPier(19.0, 27.6, 5.2); g.add(pierData.group);
    this.world.pierBounds.push(pierData.bounds);
    const ferry = buildFerryBoat(); ferry.position.set(0, -0.02, 29.8); g.add(ferry);
    const TL = TOWN_LAYOUT;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.75), toonMat({ color: 0x9a643a }));
    chest.position.set(TL.stash[0], this.world.gh(TL.stash[0], TL.stash[1]) + 0.38, TL.stash[1]); chest.rotation.y = Math.atan2(-TL.stash[0], -TL.stash[1]); chest.castShadow = true; g.add(chest);
    // 祭壇在東北石台上，衣櫃在旅人小屋門口
    const altar = add(buildAwakenAltar(), TL.altar[0], TL.altar[1], 0, 1.35); altar.position.y = 1.0;
    add(buildWardrobe(), TL.wardrobe[0], TL.wardrobe[1], Math.PI / 2, 0.75);
    this.worldBoxes.push(
      { x: TL.stash[0], z: TL.stash[1], hw: 0.65, hd: 0.45, h: 0 },
      { x: TL.wardrobe[0], z: TL.wardrobe[1], hw: 0.45, hd: 0.75, h: 0 },
      { x: TL.home[0], z: TL.home[1], hw: 1.7, hd: 1.7, h: 0 },
      { x: TL.altar[0], z: TL.altar[1], hw: 2.5, hd: 2.5, h: 0 },
    );
    // 可踢飛滾動的 3D 物理物件（彩色海灘球與酒桶）
    const mkProp = (kind, x, z, col) => {
      const geo = kind === 'ball' ? new THREE.SphereGeometry(0.36, 8, 6) : new THREE.CylinderGeometry(0.3, 0.28, 0.65, 8);
      const mesh = new THREE.Mesh(geo, toonMat({ color: col }));
      mesh.castShadow = true; mesh.receiveShadow = true;
      const y = this.world.gh(x, z) + 0.36;
      mesh.position.set(x, y, z); this.scene.add(mesh);
      this.physProps.push({ kind, mesh, x, y, z, vx: 0, vy: 0, vz: 0, r: 0.38 });
    };
    mkProp('ball', 2.4, 4.2, 0xff6b6b); mkProp('ball', -11.5, 15, 0x4cc9f0);
    mkProp('barrel', -8.8, -5.6, 0x9c663a); mkProp('barrel', 9.4, 2.2, 0x8a5832);
    // 城鎮草地漫步的蓬鬆小綿羊（致敬螢幕擷圖 5 風格，可按 F 撫摸獲得軟綿祝福）
    [[-12.8, 13.6], [-11, 15.4], [-13.2, 15.8], [-11.4, 13]].forEach(([sx, sz], idx) => {
      const sm = buildSheep();
      sm.position.set(sx, this.world.gh(sx, sz), sz);
      this.scene.add(sm);
      this.sheep.push({ mesh: sm, hx: sx, hz: sz, x: sx, z: sz, tx: sx, tz: sz, f: idx * 1.5, wait: 1 + idx, hop: 0, ph: idx * 2.1 });
    });
    this.spots.push(
      { kind: 'market', label: '工匠街拍賣行', x: TL.market[0], z: TL.market[1], top: 2.5 },
      { kind: 'enter_home', label: '推門進入旅人小屋（室內）', x: TL.home[0] + 2.3, z: TL.home[1], top: 2.5 },
      { kind: 'enter_tavern', label: '推門進入楓之酒館（室內）', x: TL.tavern[0] + 3.1, z: TL.tavern[1] + 0.8, top: 2.5 },
      { kind: 'guild', label: '燈谷公會大廳（加入公會／討伐）', x: TL.guild[0] + 3.0, z: TL.guild[1], top: 3.1 },
      { kind: 'ascend', label: '星燈覺醒祭壇（二轉職業覺醒）', x: TL.altar[0], z: TL.altar[1] + 2.9, top: 3.6 },
      { kind: 'ferry_harbor', label: '登船前往海風港鎮（南碼頭啟航）', x: 0, z: 26.2, top: 2.8 },
      { kind: 'open_stash', label: '燈谷公共倉庫（城鎮限定）', x: TL.stash[0], z: TL.stash[1], top: 2.2 },
      { kind: 'open_cosmetics', label: '造型衣櫃（更換外觀）', x: TL.wardrobe[0], z: TL.wardrobe[1], top: 2.3 },
    );
    this.updateHome();
    // offline villagers
    if (!this.net.url) this.spawnBots();
  }
  buildHarbor() {
    const hb = buildHarborTown(this);
    this.townGroup = hb.group; this.scene.add(hb.group);
    this.world.obstacles.push(...hb.obstacles);
    if (hb.pierBounds) this.world.pierBounds.push(hb.pierBounds);
    this.worldBoxes.push(...hb.boxes);
    this.spots = hb.spots;
    if (!this.net.url) {
      const harborBots = [
        ['老船長 浪花', 2, ['南碼頭渡船隨時啟航！', '北邊木牌通往三大新海域。'], [1.8, 22.5, 1.4], 'captain'],
        ['裁縫師 歐蕾', 4, ['來試試新草帽嗎？', '背飾造型立刻生效！'], [-7.2, 5.2, 1.5], 'cat'],
        ['倉管員 阿桶', 6, ['貴重裝備放這裡最安心。', '試著在背包裡撞擊合成！'], [7.2, -1.8, 1.4], 'smith'],
      ];
      harborBots.forEach(([name, col, lines0, home, arch], i) => {
        const id = 'hbot' + i;
        const lines = townLines(name) || lines0;
        const r = this.addRemote(id, name, col, arch);
        r.bot = true; r.lines = lines; r.home = home; r.x = r.tx = home[0]; r.z = r.tz = home[1]; r.wait = 1 + i;
        this.bots.push(id);
      });
    }
  }
  updateHome() {
    if (!this.townGroup) return;
    if (this.homeModel) this.townGroup.remove(this.homeModel);
    const rank = this.meta.p.home;
    const fb = buildCottage([0xc08850,0xe0553c,0x5aae60,0xffb840][rank] ?? 0xe0553c, 0xf6ebd0, 3.0 + rank * 0.3, 2.8 + rank * 0.2, rank >= 2 ? 2 : 1);
    const holder = new THREE.Group();
    holder.position.set(TOWN_LAYOUT.home[0], this.world.gh(TOWN_LAYOUT.home[0], TOWN_LAYOUT.home[1]), TOWN_LAYOUT.home[1]);
    holder.rotation.y = Math.PI / 2;
    this.townGroup.add(holder);
    const key = ['cottage', 'cottage_b', 'cottage_c', 'cottage_c'][rank] || 'cottage_c';
    attachLandmarkGlb(holder, key, fb, { scale: 0.92 + rank * 0.08, yOffset: -0.1, emissive: 0x3c342a, emissiveIntensity: 0.34 });
    this.homeModel = holder;
  }
  spawnBots() {
    const defs = [
      ['鐘錶匠 米糕', 1, ['今天適合遠行！', '北門地圖桌可設計終局副本！'], [-5.2, -2.5, 1.6], 'clockmaker'],
      ['草藥師 阿杏', 5, ['甜莓配蘋果酒能合出特調！', '中毒記得喝蘋果酒。'], [-6.4, 5.2, 1.5], 'cat'],
      ['守夜人 老燈', 3, ['雙燈照路，夜行小心。', '連放三招可觸發過載！'], [4.8, -7.8, 1.5], 'owl'],
      ['酒館主廚 楓', 4, ['蘋果酒剛釀好～', '進屋烤火最舒服。'], [-9, -7.6, 1.5], 'chef'],
      ['行腳商 豆豆', 2, ['背包裡能碰撞合成喔！', '倉庫箱在廣場東北角。'], [9.6, 6.4, 2], 'peddler'],
      ['鐵匠 石頭', 6, ['打冰凍怪會觸發碎冰！', '鐵匠鋪可直接腐化穿戴裝備！'], [11.2, -8.4, 1.2], 'smith'],
      ['碼頭舵手 小潮', 7, ['走到棧橋盡頭即可登船！', '海風很舒服吧？'], [1.5, 20.8, 1.2], 'captain'],
    ];
    // Beaconfall Phase 3: Captain Hale is the Order of the Wick contact for the first region quest.
    const hale = LORE_DATA.town.hale;
    defs.push([hale.name, 6, hale.lines, [3.8, -3.4, 1.2], 'captain', 'hale']);
    defs.forEach(([name, col, lines0, home, arch, loreNpc], i) => {
      const id = 'bot' + i;
      const lines = townLines(name) || lines0;
      const r = this.addRemote(id, name, col, arch); r.bot = true; r.lines = lines; if (loreNpc) r.loreNpc = loreNpc; r.home = home; r.x = r.tx = home[0]; r.z = r.tz = home[1]; r.wait = 4 + i * 2.5;
      this.bots.push(id);
    });
  }
  // ---------------- multiplayer ----------------
  setupNet() {
    const n = this.net;
    n.on('status', s => {
      if (s.ok) {
        for (const bot of this.bots) this.removeRemote(bot);
        this.bots = [];
        this.identifyGuild();
      } else {
        this.wallet = null; this.exitRaid?.();
        for (const [id, remote] of this.remotes) if (!remote.bot) this.removeRemote(id);
        document.getElementById('btnZoneShards').classList.add('hide');
        this.ui.refreshShardPanel?.();
        if (s.reason === 'closed' || s.reason === 'error') {
          if (this.depth === -1 && !this.bots.length) this.spawnBots();
        }
      }
      this.ui.netStatus(s);
      this.ui.setOnline(n.online);
    });
    n.on('welcome', m => {
      if (m.hotspots) this.hotspots = m.hotspots;
      if (m.features) this.features = { ...DEFAULT_FEATURE_FLAGS, ...m.features };
      document.getElementById('btnZoneShards').classList.toggle('hide', !n.zoneShards);
      for (const h of m.history || []) if (!isMutedUser(this.meta.p, h.name)) this.ui.addChat(h.name, h.text, false, h.zone);
      this.ui.addChat('', `已連線，你的編號 #${m.id}`, true);
    });
    n.on('shard', m => {
      if (m.id !== null && (typeof m.id !== 'string' || typeof m.zone !== 'string')) return;
      const previous = n.shard;
      n.shard = m.id ? { id: m.id, zone: m.zone, number: Number(m.id.split('#').at(-1)), count: null } : null;
      n.shardListing = null;
      for (const [id, remote] of this.remotes) if (!remote.bot) this.removeRemote(id);
      document.getElementById('chatLog').replaceChildren();
      for (const h of m.history || []) if (!isMutedUser(this.meta.p, h.name)) this.ui.addChat(h.name, h.text, false, h.zone);
      if (n.shard && previous?.zone === m.zone && previous.id !== m.id) this.ui.toast(`已切換至 ${n.shard.number} 線`, '#ffd85a');
      this.ui.setOnline(n.online);
      this.ui.refreshShardPanel?.(true);
    });
    n.on('shards', m => {
      if (m.zone !== (n.shard?.zone ?? null) || !Array.isArray(m.lines)) return;
      const lines = m.lines.filter(line => line && typeof line.id === 'string'
        && Number.isSafeInteger(line.number) && Number.isSafeInteger(line.count) && Number.isSafeInteger(line.capacity));
      n.shardListing = { ...m, lines };
      this.ui.refreshShardPanel?.();
    });
    n.on('tide_sync', m => {
      if (n.zoneShards && (m.shard !== n.shard?.id || m.zone !== this.zone)) return;
      if (this.tide && typeof m.heat === 'number') {
        this.tide.heat = m.heat;
        this.tide.phase = m.phase ?? this.tide.phase;
      }
    });
    n.on('online', m => this.ui.setOnline(m.n));
    n.on('sys', m => this.ui.addChat('', m.text, true));
    n.on('chat', m => {
      if (isMutedUser(this.meta.p, m.name)) return;
      this.ui.addChat(m.name, m.text, false, m.zone); this.audio.sfx('chat');
      if (m.id === n.id) this.say('me', m.text); else if (this.remotes.has(m.id)) this.say(m.id, m.text);
    });
    n.on('emote', m => { if (this.remotes.has(m.id)) this.say(m.id, EMOTES[m.e % EMOTES.length]); });
    n.on('gone', m => this.removeRemote(m.id));
    n.on('snap', m => {
      if (this.raid || (n.zoneShards && (m.shard !== n.shard?.id || m.zone !== this.zone))) return;
      if (n.shard && n.shard.count !== m.count) {
        n.shard.count = m.count;
        this.ui.setOnline(n.online);
      }
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
  addRemote(id, name, col, archetype = 'villager') {
    const hood = HOODS[col % HOODS.length]; const m = buildNPC(archetype, hood[0], hood[1], 0xf0d070);
    m.root.scale.setScalar(1.25); this.scene.add(m.root);
    const jobIdx = Math.abs(col || 0) % CHAR_CATALOG.classPresets.length;
    const npcLook = { ...CHAR_CATALOG.classPresets[jobIdx], hairStyle: Math.abs((col || 0) * 3) % 5, skinTone: Math.abs(col || 0) % 3, eyeColor: Math.abs((col || 0) * 2) % 4 };
    const heroRig = createModularHero(npcLook, {
      scale: 0.84,
      toon: true,
      initialState: 'idle',
      onReady: () => { m.body.visible = false; },
    });
    m.root.add(heroRig.root);
    const tag = document.createElement('div'); tag.className = 'ptag'; tag.textContent = name;
    const bub = document.createElement('div'); bub.className = 'pbub';
    document.getElementById('tags').append(tag, bub);
    const r = { id, name, col, m, heroRig, tag, bub, x: 0, y: 0, z: 0, f: 0, tx: 0, ty: 0, tz: 0, tf: 0, a: 0, walkT: 0, say: 0, init: false };
    this.remotes.set(id, r); return r;
  }
  removeRemote(id) {
    const r = this.remotes.get(id); if (!r) return;
    r.heroRig?.dispose?.();
    this.scene.remove(r.m.root);
    // 自我審查修正：遠端玩家離線時釋放其幾何體與材質，防止多人進出城鎮累積 GPU 記憶體洩漏
    r.m.root.traverse?.(o => {
      if (o.geometry && !o.userData?.sharedGeo) o.geometry.dispose?.();
      if (o.material && !o.userData?.sharedMat) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material.dispose?.();
      }
    });
    r.tag.remove(); r.bub.remove(); this.remotes.delete(id);
  }
  boardPublicFerry(fieldId = null) {
    const sch = getFerrySchedule(Date.now(), this.hotspots);
    const destId = fieldId || sch.destFieldId || 1;
    if (!FIELDS[destId]) return;
    this.meta.p.ferryBuffUntil = Date.now() + FERRY_BUFF_MS;
    this.meta.save();
    this.enterField(destId);
    this.recalc();
    this.audio.sfx('warp');
    this.ui.toast(`⛵ 搭乘公共星舟抵達「${FIELDS[destId].name}」！獲得 15 分鐘「同舟共濟」移速 +10% · 經驗 +10%`, '#ffd85a');
  }
  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); }
  say(id, text) {
    if (id === 'me') { this.mySay = { text, t: 4.5 }; return; }
    const r = this.remotes.get(id); if (!r) return; r.bub.textContent = text; r.say = 4.5;
  }
  sendChat(text) {
    const cmd = parseChatCommand(text);
    if (cmd.kind === 'empty') return;
    if (cmd.kind === 'mute') {
      if (muteUser(this.meta.p, cmd.target)) { this.meta.save(); this.ui.addChat('', `🔇 已將「${cmd.target}」加入靜音名單（輸入 /unmute ${cmd.target} 解除）`, true); }
      return;
    }
    if (cmd.kind === 'unmute') {
      if (unmuteUser(this.meta.p, cmd.target)) { this.meta.save(); this.ui.addChat('', `🔊 已解除「${cmd.target}」的靜音`, true); }
      return;
    }
    const prefix = cmd.channel === 'party' ? '[小隊] ' : cmd.channel === 'guild' ? '[公會] ' : '';
    const out = prefix + cmd.text;
    if (!cmd.text) return;
    if (this.net.ok) this.net.send({ t: 'chat', channel: cmd.channel, text: out });
    else { this.ui.addChat(this.playerName, out, false, 'town'); this.say('me', out); }
  }
  emote(i) {
    this.audio.sfx('emote'); const e = EMOTES[i % EMOTES.length];
    this.say('me', e); this.net.send({ t: 'emote', e: i });
    reactSimToPlayerEmote(this, e);
  }
  updateNet(dt) {
    const p = this.player, n = this.net;
    this.posT -= dt;
    if (this.posT <= 0 && this.state !== 'title') {
      this.posT = 0.1;
      const a = p.roll > 0 ? 5 : p.climbing ? 3 : p.gliding ? 4 : p.air ? 2 : p.walkT > 0 ? 1 : 0;
      n.send({ t: 'pos', zone: this.zone, party: this.caveRun ? '' : this.party, x: p.pos.x, y: p.y, z: p.pos.z, f: p.facing, a });
    }
    if (this.zone !== this._lastZone) { this._lastZone = this.zone; for (const [id, rm] of [...this.remotes]) if (!rm.bot && !String(id).startsWith('bot')) this.removeRemote(id); }   // keep NPC bots (field NPCs used to vanish here)
    for (const r of this.remotes.values()) {
      if (r.bot) {
        r.wait -= dt;
        if (Math.hypot(r.tx - r.x, r.tz - r.z) < 0.4) {
          r.a = 0;
          if (r.wait <= 0) { r.wait = 8 + Math.random() * 10; const hm = r.home || [0, 2, 8], a = Math.random() * 6.28, d = (r.home ? 0.3 : 3) + Math.random() * hm[2]; r.tx = hm[0] + Math.cos(a) * d; r.tz = hm[1] + Math.sin(a) * d * 0.8; if (Math.random() < 0.08) this.say(r.id, r.lines[(Math.random() * r.lines.length) | 0]); }
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
      if (r.heroRig?.ready) {
        r.heroRig.play(r.a === 1 ? 'walk' : 'idle');
        r.heroRig.update(dt);
      }
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
    // own label + bubble（頭頂顯示佩戴稱號）
    const me = document.getElementById('myTag'), mb = document.getElementById('myBub');
    if (me) {
      const tTxt = getActiveTitleText(this.meta?.p);
      me.textContent = tTxt ? `[${tTxt}] ${this.playerName}` : this.playerName;
      const [sx, sy] = this.ui.screenPos(p.pos.x, p.y + 2.0, p.pos.z);
      me.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-100%)`; me.style.display = this.state === 'title' ? 'none' : 'block';
      if (this.mySay) { this.mySay.t -= dt; mb.textContent = this.mySay.text; mb.style.transform = `translate(${sx}px, ${sy - 22}px) translate(-50%,-100%)`; mb.style.opacity = this.mySay.t > 0 ? 1 : 0; }
    }
  }

  // ---------------- update ----------------
  update(dt) {
    if (this.state === 'trial-ready' || this.state === 'trial-result') return;
    const touch = this.touchInput;
    if (touch && (touch.attack || touch.glide || touch.x || touch.z) && !this.canUseTouchControls()) this.clearTouchInput();
    if (this.raid) { updateRaid(this,dt); return; }
    if (this.ui.mapDialog?.open || this.draftPause) return;
    this.time += dt;
    if (this.meta.p.mealUntil && this.meta.p.mealUntil <= Date.now()) { this.meta.p.mealUntil=0; this.meta.p.mealBoost=1; this.recalc(); this.meta.save(); }
    if (this.meta.p.ferryBuffUntil && this.meta.p.ferryBuffUntil <= Date.now()) { this.meta.p.ferryBuffUntil=0; this.recalc(); this.meta.save(); }
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
        this.ui.wipe(() => s.dest === 'harbor' ? this.enterHarbor('pier') : this.enterTown('pier'));
      }
      this.animatePlayer(dt); this.updateCamera(dt); this.fx.update(dt); this.puffs.update(dt); this.vfx?.update(dt, this.camera); this.ui.update(this);
      return;
    }

    if (this.state === 'play') {
      this.exitCooldown = Math.max(0, (this.exitCooldown || 0) - dt);
      for (const k in p.cds) p.cds[k] = Math.max(0, p.cds[k] - dt);
      for (let i = 0; i < 4; i++) p.skillCds[i] = Math.max(0, (p.skillCds[i] || 0) - dt);
      if (this.dev?.on) {
        if (this.dev.god) p.hp = S.maxHp;
        if (this.dev.noCd) {
          p.mana = S.mana; p.stamina = 100;
          for (const k in p.cds) p.cds[k] = 0;
          for (let i = 0; i < 4; i++) p.skillCds[i] = 0;
          if (this.tide) this.tide.ultCharge = 100;
        }
      }
      p.iframes = Math.max(0, p.iframes - dt);
      p.perfectDodgeCd = Math.max(0, (p.perfectDodgeCd || 0) - dt);
      p.perfectCritT = Math.max(0, (p.perfectCritT || 0) - dt);
      p.leechBuffT = Math.max(0, (p.leechBuffT || 0) - dt);
      const dimRegen = this.flameRt?.fx?.regenMul ?? 1;            // Flame: Dimming lowers natural regen
      p.mana = Math.min(S.mana, p.mana + dt * 7 * (1 + (S.manaRegen || 0) / 100) * dimRegen);
      if (S.regen) this.heal(S.regen * dt * dimRegen, false);
      if (p.specials.has('mossRegen')) this.heal(S.maxHp * 0.02 * dt * dimRegen, false);
      if (p.healOver > 0) { p.healOver -= dt; this.heal(p.healRate * dt, false); }
      if (!this.ui.invOpen && !this.ui.setOpen && !this.ui.panelOpen && !this.ui.puzzleOpen) {
        if (p.inputBuf) {
          p.inputBuf.t -= dt;
          if (p.inputBuf.t <= 0) {
            p.inputBuf = null;
          } else if (p.inputBuf.kind === 'roll' && p.cds.roll <= 0 && p.roll <= 0 && !p.air && !p.climbing) {
            p.inputBuf = null; this.tryRoll();
          } else if (p.inputBuf.kind === 'attack' && p.cds.atk <= 0 && p.roll <= 0) {
            p.inputBuf = null; this.tryAttack();
          } else if (p.inputBuf.kind === 'skill' && (p.skillCds[p.inputBuf.slot] || 0) <= 0 && p.roll <= 0) {
            const slot = p.inputBuf.slot; p.inputBuf = null; this.castHotbar(slot);
          }
        }
        if (this.mouse.l) this.tryAttack();
        if (touch?.attack) { this.aimForTouch(); this.tryAttack(); }
        const kb = this.settings?.keybinds;
        if (this.mouse.r && (this.ambushTrial || !kb || kb.sk0 === 'rmb')) this.castHotbar(0);
      }
      // movement (3D: walk, sprint, jump, climb walls, glide) + 🏮 提燈自動巡遊 + 點擊懸停物件自動走近互動
      const mv = this.moveInput();
      if (this.ambushTrial?.active && !this.ambushTrial.active.moved && mv.lengthSq() > 0.02) {
        this.ambushTrial.active.moved = true;
        this.ambushTrial.event('move');
      }
      if (mv.lengthSq() > 0.02 || p.roll > 0 || p.swingT > 0) this.interactTarget = null;
      if (this.interactTarget && mv.lengthSq() <= 0.02) {
        const it = this.interactTarget;
        const tx = it.kind === 'remote' ? it.obj.x : it.kind === 'sheep' ? it.obj.x : it.kind === 'drop' ? it.obj.g.position.x : it.x;
        const tz = it.kind === 'remote' ? it.obj.z : it.kind === 'sheep' ? it.obj.z : it.kind === 'drop' ? it.obj.g.position.z : it.z;
        const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
        if (d <= 2.2) {
          this.interactTarget = null;
          if (it.kind === 'drop') this.tryPickup();
          else this.tryInteract();
        } else if (d > 32) {
          this.interactTarget = null;
        } else {
          mv.set(dx / d, dz / d);
        }
      }
      const autoMv = tickAutopilot(this, dt, mv);
      if (autoMv) mv.set(autoMv.x, autoMv.y);
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
      // 玩家異常狀態倒數與持續效果（中毒、冰凍、緩速、灼燒、感電、過載）
      if (p.statuses) {
        const st = p.statuses;
        p.castComboT = Math.max(0, (p.castComboT || 0) - dt);
        if (p.castComboT <= 0) p.castCombo = 0;
        for (const k of ['poison', 'freeze', 'chill', 'burn', 'shock', 'overload']) st[k] = Math.max(0, (st[k] || 0) - dt);
        if (st.poison > 0 || st.burn > 0) {
          p.statusTick = (p.statusTick || 0) + dt;
          if (p.statusTick >= 1.0) {
            p.statusTick = 0;
            const dot = Math.max(2, Math.round(S.maxHp * (st.poison > 0 ? 0.03 : 0.035)));
            p.hp = Math.max(1, p.hp - dot);
            this.ui.dmgNum(p.pos.x, p.y + 1.5, p.pos.z, dot, st.poison > 0 ? 'heal' : 'fire');
            this.fx.burst(p.pos.x, p.y + 0.8, p.pos.z, 5, { c: st.poison > 0 ? [0x6fe06a, 0xa86ae0] : [0xff7a30, 0xffd25a], s: 0.1, speed: 2, up: 2, life: 0.45 });
          }
        }
      }
      updateFieldTerrainFx(this, dt);
      updateRealmRule(this, dt, this.field ? FIELDS[this.field]?.realmRule : null);
      updateFlame(this, dt); syncLightRings(this, dt);
      p.sprinting = false;
      const frozen = (p.statuses?.freeze || 0) > 0;
      const mountDef = this.mount?.def || null;
      const chillMul = (!mountDef?.immuneChill && (p.statuses?.chill || 0) > 0) ? 0.65 : 1;
      if (p.sitting) {
        if (mv.lengthSq() > 0.05 || p.roll > 0 || p.swingT > 0) { p.sitting = null; this.audio.sfx('sit'); }
        else {
          p.vel.set(0, 0, 0); p.walkT = 0;
          this.heal(S.maxHp * 0.05 * dt, false);
          p.mana = Math.min(S.mana, p.mana + dt * 14);
        }
      }
      if (frozen) {
        p.vel.multiplyScalar(0.75);
      } else if (p.sitting) {
        // seated resting
      } else if (p.roll > 0) {
        p.roll -= dt;
        this.movePlayer(p.rollDir.x * 13 * dt, p.rollDir.z * 13 * dt);
        if (Math.random() < 0.5) this.puffs.emit(p.pos.x, p.y + 0.1, p.pos.z, { c: 0xf4ecd8, s: 0.18, g: -0.4, life: 0.4, grow: 1 });
      } else {
        const attacking = p.swingT > 0;
        const canSprint = !!(this.keys.shift && mv.lengthSq() > 0.01 && !p.air && !p.climbing && !attacking && (mountDef || p.stamina > 2));
        if (canSprint) { p.sprinting = true; if (!mountDef) p.stamina = Math.max(0, p.stamina - 16 * dt * this.meta.staminaK); }
        const mountSpd = mountDef ? mountDef.speedMult : 1;
        const buffSpd = ((this.shrineBuffs?.fury || 0) > 0 ? 1.2 : 1) * ((this.shrineBuffs?.sheep || 0) > 0 ? 1.1 : 1);
        const glideSpd = p.gliding ? (p.souls?.mobility?.id === 'skyray' ? 1.95 : 1.35) : 1;
        const terrainSpd = (p.terrainFx ? (p.terrainFx.speedMult || 1) : 1) * (p.realmRule?.speedMult || 1) * (this.flameRt?.fx?.speedMul ?? 1);
        const devSpd = (this.dev?.on && this.dev?.fastMove) ? 2.2 : 1;
        const f = chillMul * mountSpd * buffSpd * terrainSpd * devSpd * (attacking ? 0.55 : 1) * (p.climbing ? 0.22 : 1) * glideSpd * (canSprint ? 1.25 : 1);
        if (mountDef?.ramKnockback && mv.lengthSq() > 0.2) {
          for (const e of this.enemies) if (!e.dead && e.type !== 'stag' && e.pos.distanceTo(p.pos) < e.r + 1.0) {
            const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
            e.knock.x += (dx / d) * 6; e.knock.z += (dz / d) * 6;
          }
        }
        const accel = p.air ? 6 : (p.terrainFx?.accelRate || 14);
        p.vel.x = lerp(p.vel.x, mv.x * spd * f, 1 - Math.exp(-dt * accel));
        p.vel.z = lerp(p.vel.z, mv.y * spd * f, 1 - Math.exp(-dt * accel));
        this.movePlayer(p.vel.x * dt, p.vel.z * dt);
        if (mv.lengthSq() > 0.01 && !attacking) p.facing = angleLerp(p.facing, Math.atan2(mv.x, mv.y), 1 - Math.exp(-dt * 14));
        if (mv.lengthSq() > 0.01 && !p.air && !p.climbing) {
          const stride = canSprint ? 15 : 11;
          p.walkT += dt * stride; p.stepT += dt * stride;
          if (p.stepT > Math.PI) { p.stepT -= Math.PI; this.audio.sfx(canSprint ? 'sprintStep' : 'step'); }
          if (Math.random() < dt * (canSprint ? 10 : 4)) this.puffs.emit(p.pos.x, p.y + 0.05, p.pos.z, { c: 0xf4ecd8, s: canSprint ? 0.16 : 0.12, g: -0.3, life: 0.35, grow: 1 });
        } else p.walkT = 0;
      }
      // 2D 流體物理瓶慣性連動：衝刺急停或急轉彎時液體跟著左右劇烈晃動
      const accX = (p.vel.x - (p.prevVx || 0)) / Math.max(dt, 0.016);
      const accZ = (p.vel.z - (p.prevVz || 0)) / Math.max(dt, 0.016);
      if (Math.hypot(accX, accZ) > 12) {
        const impX = clamp(accX * 0.025, -1.6, 1.6), impY = clamp(Math.abs(accZ) * 0.014, 0, 1.0);
        this.ui.hpVial?.impulse(impX, impY); this.ui.mpVial?.impulse(impX * 0.8, impY * 0.7);
      }
      p.prevVx = p.vel.x; p.prevVz = p.vel.z;
      // 樹木碰撞與攻擊互動落葉效果
      if (!this.interior && this.world.trees?.length && (mv.lengthSq() > 0.01 || p.swingT > 0)) {
        const reach = p.swingT > 0 ? 3.2 : 1.15;
        for (const tr of this.world.trees) {
          if (this.time - (tr.rustleT || 0) < 0.7) continue;
          if (Math.hypot(p.pos.x - tr.x, p.pos.z - tr.z) < tr.r + reach) {
            tr.rustleT = this.time;
            this.fx.burst(tr.x, tr.y + 2.1, tr.z, p.swingT > 0 ? 9 : 4, { c: [tr.leafCol, 0xffe480], s: 0.11, speed: 2.2, up: 0.8, g: 2.2, life: 1.1 });
          }
        }
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
        if (p.wispT <= 0) { for (const w of p.wisps) { this.scene.remove(w.mesh); disposeObj3D(w.mesh); } p.wisps = []; }
      }
      if (this.field) { tickField(this, dt); tickTide(this, dt); tickWorldBoss(this, dt); tickDynamicEvent(this, dt); }
      if (getPartyIds(this.meta?.p).length > 0 && !(this._companionMeshes?.length) && this.depth >= 0) spawnCompanion3D(this);
      tickCompanion3D(this, dt);
      tickSimAdventurers(this, dt);
      // 離線活生生 MMO 世界頻道模擬（每 52 秒浮現一條真實感冒險者對話）
      if (!this.net?.ok && this.state === 'play') {
        this._wChatCd = (this._wChatCd ?? 25) - dt;
        if (this._wChatCd <= 0) {
          this._wChatCd = 52 + Math.random() * 25;
          const line = WORLD_CHAT_LINES[(Math.random() * WORLD_CHAT_LINES.length) | 0];
          this.ui?.chat?.(line);
        }
      }
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
        if (pr.life <= 0) { this.scene.remove(pr.mesh); disposeObj3D(pr.mesh); }
      }
      this.prisms = this.prisms.filter(pr => pr.life > 0);
      // waves
      if (!this.cleared) {
        const alive = this.enemies.some(e => !e.dead) || this.decals.some(d => d.onDone);
        if (!alive) {
          this.waveDelay -= dt;
          if (this.waveDelay <= 0) {
            if (this.caveRun && this.waveIdx === this.caveRun.stage && this.waveIdx < this.waves.length - 1) {
              advanceMeadowCave(this.meta.p, this.caveRun, this.waveIdx);
              this.meta.save();
              this.heal(p.stats.maxHp * 0.25);
              p.flask.charges = Math.min(p.flask.max, p.flask.charges + 1);
            }
            this.waveIdx++;
            if (this.waveIdx < this.waves.length) { this.spawnWave(); this.waveDelay = 0.8; }
            else this.roomCleared();
          }
        }
      }
      // exits
      if (!this.interior) for (const x of this.exits) if (x.on && !(this.field === 1 && x.type === 'dungeon') && Math.hypot(p.pos.x - x.x, p.pos.z - x.z) < 1.3) { this.goExit(x); break; }
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
    this.updateOcclusion(dt);
    this.updateHover();
    this.fx.update(dt); this.puffs.update(dt); this.vfx?.update(dt, this.camera);
    this.updateNet(dt);
    this.ui.update(this);
  }

  ensureHoverRings() {
    if (!this._hoverRing) {
      const geo = new THREE.RingGeometry(0.72, 0.96, 28);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      this._hoverRing = new THREE.Mesh(geo, mat);
      this._hoverRing.userData.noNormal = true;
      this._hoverRing.renderOrder = 3;
      this._hoverRing.visible = false;
      this.scene.add(this._hoverRing);
    }
    if (!this._skillPreviewRing) {
      const geo = new THREE.RingGeometry(0.92, 1.0, 36);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false });
      this._skillPreviewRing = new THREE.Mesh(geo, mat);
      this._skillPreviewRing.userData.noNormal = true;
      this._skillPreviewRing.renderOrder = 3;
      this._skillPreviewRing.visible = false;
      this.scene.add(this._skillPreviewRing);
    }
  }

  updateHover() {
    const cv = this.pipe?.renderer?.domElement;
    const badge = document.getElementById('hoverBadge');
    if (!cv) return;
    if (badge) badge.classList.remove('show');
    this.ensureHoverRings();
    const p = this.player;

    if (this.state === 'play' && this.hoverSkillSlot >= 0 && p?.hotbar?.[this.hoverSkillSlot]) {
      const sk = p.hotbar[this.hoverSkillSlot];
      const baseR = { slam: 3.2, whirl: 3.1, nova: 4.6, sakura: 4.4, quakeg: 4.2, rain: 2.8, trap: 3.0, meteor: 2.7, thunder: 6.5, paladin_sword: 3.8, fire_whale: 4.8, dark_wolf: 4.2, healing_tree: 4.6, black_hole: 4.8, blue_tornado: 3.8, spear_cage: 3.6, candle_ward: 3.4 }[sk.def.id] || 4.0;
      const rad = baseR * (1 + (p.stats?.area || 0) / 100) * (1 + (sk.mod?.area || 0));
      const pulse = 1 + Math.sin(this.time * 6) * 0.03;
      this._skillPreviewRing.visible = true;
      this._skillPreviewRing.position.set(p.pos.x, p.y + 0.14, p.pos.z);
      this._skillPreviewRing.scale.setScalar(rad * pulse);
      this._skillPreviewRing.material.color.set(sk.def.color || '#7ae8ff');
    } else if (this._skillPreviewRing) {
      this._skillPreviewRing.visible = false;
    }

    if (this.state !== 'play' || this.ui.invOpen || this.ui.setOpen || this.ui.panelOpen || this.ui.puzzleOpen || this.ui.mapDialog?.open || this.ui.codexOpen || this.ui.hover?.isUiActive?.()) {
      cv.classList.remove('hover-enemy', 'hover-interact', 'hover-npc');
      this.hoveredWorld = null;
      this.hoveredDrop = null;
      this._hoverRing.visible = false;
      this.ui.hover?.hideWorld?.();
      return;
    }

    const ax = this.aim.x, az = this.aim.z;
    let hit = null;
    for (const e of this.enemies) {
      if (e.dead || e.m?.root?.visible === false) continue;
      if (Math.hypot(e.pos.x - ax, e.pos.z - az) < (e.r || 0.6) + 0.85) {
        hit = { kind: 'enemy', obj: e, x: e.pos.x, z: e.pos.z, r: Math.max(0.85, (e.r || 0.6) * 1.45), color: e.elite || e.type === 'stag' ? 0xffcf4a : 0xff5a5a };
        break;
      }
    }
    if (!hit) {
      for (const r of this.remotes.values()) {
        if (r.m?.root?.visible === false) continue;
        if (Math.hypot(r.x - ax, r.z - az) < 1.2) {
          hit = { kind: 'remote', obj: r, x: r.x, z: r.z, r: 0.95, color: r.bot ? 0x7fe08a : 0x7ae8ff };
          if (r.bot && r.a === 0) r.tf = Math.atan2(p.pos.x - r.x, p.pos.z - r.z);
          break;
        }
      }
    }
    if (!hit) {
      for (const d of this.drops) {
        if (Math.hypot(d.g.position.x - ax, d.g.position.z - az) < 1.1) {
          if (d.kind === 'item') hit = { kind: 'drop', obj: d, x: d.g.position.x, z: d.g.position.z, r: 0.85, color: RARITY[d.item.rarity]?.beam || 0xffd85a };
          else if (d.kind === 'orb') hit = { kind: 'orb', obj: d, x: d.g.position.x, z: d.g.position.z, r: 0.65, color: 0xff5a6a };
          break;
        }
      }
    }
    if (!hit) {
      for (const s of this.spots) {
        if (s.mesh?.visible === false) continue;
        if (Math.hypot(s.x - ax, s.z - az) < 1.45) {
          hit = { kind: 'spot', obj: s, x: s.x, z: s.z, r: 1.15, color: 0xffd85a };
          break;
        }
      }
    }
    if (!hit && !this.interior) {
      for (const x of this.exits) {
        if (Math.hypot(x.x - ax, x.z - az) < 1.9) {
          hit = { kind: 'exit', obj: x, x: x.x, z: x.z, r: 1.65, color: 0x62e8ff };
          break;
        }
      }
    }
    if (!hit) {
      for (const sh of this.sheep || []) {
        if (Math.hypot(sh.x - ax, sh.z - az) < 1.15) {
          hit = { kind: 'sheep', obj: sh, x: sh.x, z: sh.z, r: 0.85, color: 0xffe49e };
          break;
        }
      }
    }
    if (!hit) {
      for (const pk of this.pickups || []) {
        if (Math.hypot(pk.x - ax, pk.z - az) < 1.1) { hit = { kind: 'pickup', obj: pk, x: pk.x, z: pk.z, r: 0.75, color: pk.kind === 'feather' ? 0xffd23a : 0xffb8c8 }; break; }
      }
    }
    if (!hit) {
      for (const cf of this.campfires || []) {
        if (Math.hypot(cf.x - ax, cf.z - az) < 1.2) { hit = { kind: 'campfire', obj: cf, x: cf.x, z: cf.z, r: 1.0, color: 0xffa83a }; break; }
      }
    }
    if (!hit) {
      for (const pr of this.prisms || []) {
        if (Math.hypot(pr.x - ax, pr.z - az) < 1.1) { hit = { kind: 'prism', obj: pr, x: pr.x, z: pr.z, r: 0.9, color: 0xffe07a }; break; }
      }
    }
    if (!hit) {
      for (const pp of this.physProps || []) {
        if (Math.hypot(pp.x - ax, pp.z - az) < 0.95) { hit = { kind: 'prop', obj: pp, x: pp.x, z: pp.z, r: 0.7, color: 0x7ae8ff }; break; }
      }
    }
    if (!hit && this._companionMesh?.visible) {
      const cp = this._companionMesh.position;
      if (Math.hypot(cp.x - ax, cp.z - az) < 1.0) hit = { kind: 'companion', obj: this._companionMesh, x: cp.x, z: cp.z, r: 0.75, color: 0xffd85a };
    }
    if (!hit) {
      for (const gz of this.groundZones || []) {
        if (gz.life > 0 && Math.hypot(gz.x - ax, gz.z - az) < gz.r) {
          hit = { kind: 'zone', obj: gz, x: gz.x, z: gz.z, r: gz.r * 0.92, color: gz.color || 0x7ae8ff };
          break;
        }
      }
    }

    const newObj = hit?.obj || null;
    if (newObj !== this._lastHoverObj) {
      this._lastHoverObj = newObj;
      if (newObj) {
        this.audio?.sfx?.('hover');
        if (hit.kind === 'sheep') {
          if (hit.obj.hop <= 0) hit.obj.hop = 0.34;
          this.audio?.sfx?.('emote');
          this.fx.burst(hit.x, this.world.gh(hit.x, hit.z) + 1.0, hit.z, 5, { c: [0xff9eb8, 0xffe480, 0xffffff], s: 0.09, speed: 2.2, up: 2.8, life: 0.55 });
        } else if (hit.kind === 'remote' && hit.obj.bot) {
          const r = hit.obj;
          r.tf = Math.atan2(p.pos.x - r.x, p.pos.z - r.z);
          if (r.say <= 0 && Math.random() < 0.45 && r.lines?.length) {
            this.say(r.id, r.lines[(Math.random() * r.lines.length) | 0]);
          }
        } else if (hit.kind === 'prop') {
          const pp = hit.obj;
          pp.vx += (Math.random() - 0.5) * 3.5;
          pp.vz += (Math.random() - 0.5) * 3.5;
          pp.vy = Math.max(pp.vy, pp.kind === 'ball' ? 2.4 : 1.1);
          this.audio?.sfx?.('kick');
        } else if (hit.kind === 'companion' && this._companionMesh) {
          this._companionMesh.rotation.y += Math.PI * 0.8;
          this.fx.burst(hit.x, this._companionMesh.position.y + 0.6, hit.z, 6, { c: [0xffd85a, 0x7ae8ff, 0xffffff], s: 0.09, speed: 2.4, up: 2.5, life: 0.5 });
        }
      }
    }

    this.hoveredWorld = hit;
    this.hoveredDrop = hit?.kind === 'drop' ? hit.obj : null;
    cv.classList.toggle('hover-enemy', hit?.kind === 'enemy');
    cv.classList.toggle('hover-npc', hit?.kind === 'remote');
    cv.classList.toggle('hover-interact', !!hit && hit.kind !== 'enemy' && hit.kind !== 'remote' && hit.kind !== 'zone');

    if (hit) {
      const ry = this.interior ? 0.08 : (this.world.isLand(hit.x, hit.z) ? this.world.gh(hit.x, hit.z) : 0) + 0.1;
      const pulse = 1 + Math.sin(this.time * 7) * 0.06;
      this._hoverRing.visible = true;
      this._hoverRing.position.set(hit.x, ry, hit.z);
      this._hoverRing.scale.setScalar((hit.r || 1) * pulse);
      this._hoverRing.material.color.setHex(hit.color || 0xffcf4a);
      if (hit.kind === 'drop') {
        const ti = tierInfo(hit.obj.item.tier || 1);
        this.ui.hover?.showWorld?.({ kind: 'spot', obj: { label: `[${ti.tag}] ${hit.obj.item.name}（右側檢視對比 · 點擊拾取）`, x: hit.x, z: hit.z } }, this.mouse.x, this.mouse.y);
      } else {
        this.ui.hover?.showWorld?.(hit, this.mouse.x, this.mouse.y);
      }
    } else {
      this._hoverRing.visible = false;
      this.ui.hover?.hideWorld?.();
    }
  }

  roomCleared() {
    this.cleared = true;
    if (this.ambushTrial) { this.ambushTrial.finish('cleared'); return; }
    const p = this.player;
    if (this.caveRun) {
      const tier = this.caveRun.tier;
      const result = advanceMeadowCave(this.meta.p, this.caveRun, this.waveIdx - 1);
      if (result?.complete) {
        grantExperience(this, result.xp);
        this.bankRun(1);
        this.boss = null;
        this.ui.bossBar(false);
        this.lastCaveClear = { ...result, tier };
        this.ui.banner(result.firstClear ? '草原洞窟首通' : '草原洞窟通關',
          `經驗 +${result.xp} · 金幣 +${result.coins} · 狂豬利牙與荊棘硬木各 +${result.materials}`);
        const seed = this.runSeed;
        setTimeout(() => {
          if (this.state === 'play' && this.caveRun && this.runSeed === seed && !this.ui.panelOpen) this.ui.openPanel('caveClear');
        }, 900);
      }
      this.activateExits();
      return;
    }
    if (this.towerFloor > 0) {
      const res = claimTowerFloorClear(this.meta.p, this.towerFloor);
      this.vfx?.spawnKiAscension(p.pos.x, p.y || 0, p.pos.z, 'holy');
      this.meta.save(); this.recalc(); this.audio.sfx('classup');
      const r = res.reward;
      this.ui.toast(`🗼 通關試煉之塔 ${this.towerFloor}F${res.firstClear ? '（首通大獎！）' : ''}：+🪙${r.coins} · +💎${r.shards}${r.cubes ? ` · +🎲${r.cubes}潛能魔方` : ''}${r.charms ? ` · +🛡️${r.charms}保護符` : ''}`, '#ffd85a');
      this.activateExits();
      return;
    }
    this.ui.toast('區域已淨化 ✦', '#fff2c0');
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
    if (this.state !== 'play' || this.exitCooldown > 0) return;
    if (x.type === 'caveReturn') { this.state = 'transition'; this.ui.wipe(() => this.enterField(1, 'north')); return; }
    if (x.type === 'dungeon' && this.field === 1) { this.ui.openPanel('meadowCave'); return; }
    if (x.type === 'nextTower') {
      const nf = Math.min(MAX_TOWER_FLOOR, (this.towerFloor || 1) + 1);
      this.state = 'transition'; this.audio.sfx('warp');
      this.ui.wipe(() => this.startTowerFloor(nf));
      return;
    }
    if (x.type === 'town') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.lastTown === -2 ? this.enterHarbor() : this.enterTown('north')); return; }
    if (x.type === 'prevField') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.enterField(this.field - 1, 'east')); return; }
    if (x.type === 'nextField') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.enterField(this.field + 1, 'south')); return; }
    if (x.type === 'dungeon') {
      if (this.meta.p.keys < 1) {
        if (!this.keyHint || this.time > this.keyHint) { this.ui.toast('需要鑰石 · 擊敗精英可取得'); this.keyHint = this.time + 3; } return;
      }
      this.meta.p.keys--; this.meta.save();
    }
    if (x.type === 'run') { this.state = 'transition'; this.ui.wipe(() => this.enterField(1, 'south')); return; }
    if (x.type === 'dungeon') { this.state = 'transition'; this.audio.sfx('warp'); this.ui.wipe(() => this.startRun()); return; }
    this.state = 'transition'; this.audio.sfx('warp');
    this.ui.wipe(() => { this.state = 'play'; this.loadRoom(this.depth + 1, x.type); });
  }

  updateEnemies(baseDt) {
    const p = this.player, W = this.world;
    const playing = this.state === 'play';
    const cullSq = this.field ? 48 * 48 : 99999;
    for (const e of this.enemies) {
      if (e.dead) continue;
      let dt = baseDt;
      // 遠距魔物距離剔除（Distance Culling）：超大野外地圖上 >48m 外的魔物暫停 AI 與渲染，大幅提升 FPS
      const rdx = p.pos.x - e.pos.x, rdz = p.pos.z - e.pos.z;
      const distSq = rdx * rdx + rdz * rdz;
      if (distSq > cullSq && !e.legendary && e.type !== 'stag') {
        if (e.m?.root) e.m.root.visible = false;
        continue;
      }
      if (e.m?.root && !e.m.root.visible) e.m.root.visible = true;
      // Phase M4D：遠距實體 LOD 降頻（28m–48m 採 15Hz 更新並關閉陰影，40+ 同屏穩跑 60 FPS）
      if (distSq > 28 * 28 && !e.legendary && e.type !== 'stag') {
        e._lodTick = ((e._lodTick || 0) + 1) & 3;
        if (e._lodTick !== 0) continue;
        dt = Math.min(0.16, dt * 4);
      }
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.stun = Math.max(0, e.stun - dt); e.hitCd = Math.max(0, e.hitCd - dt);
      e.slow = Math.max(0, e.slow - dt); e.vuln = Math.max(0, (e.vuln || 0) - dt);
      e.blinded = Math.max(0, (e.blinded || 0) - dt); e._slipCd = Math.max(0, (e._slipCd || 0) - dt);
      e.squash = Math.max(0, (e.squash || 0) - dt * 2.2);
      // 怪物異常狀態結算（冰凍定身、中毒／灼燒 DoT、感電易傷）
      e.statuses = e.statuses || { poison: 0, freeze: 0, burn: 0, shock: 0 };
      const est = e.statuses;
      for (const k of ['poison', 'freeze', 'burn', 'shock']) est[k] = Math.max(0, (est[k] || 0) - dt);
      if (est.poison > 0 || est.burn > 0) {
        e.dotT = (e.dotT || 0) + dt;
        if (e.dotT >= 0.85) {
          e.dotT = 0;
          const dotDmg = Math.max(3, Math.round(e.maxHp * (est.poison > 0 ? 0.045 : 0.055)));
          this.hitEnemy(e, { dmg: dotDmg, crit: false, fire: est.burn > 0 }, 0, 0, { isDoT: true });
          if (e.dead) continue;
        }
      }
      const dist = Math.sqrt(distSq);
      const invD = dist > 1e-4 ? 1 / dist : 0;
      const dirP = _dirP.set(rdx * invD, rdz * invD);
      let mvx = 0, mvz = 0;
      const spd = est.freeze > 0 ? 0 : e.spd * (e.slow > 0 ? 0.45 : 1);
      // knockback
      if (e.knock.lengthSq() > 0.01) { this.moveEntity(e.pos, e.knock.x * dt, e.knock.z * dt, e.r); e.knock.multiplyScalar(Math.exp(-dt * 9)); }
      const follow = (s = 1) => {
        if (dist > 1.5 && W.flowDir(e.pos.x, e.pos.z, _flowV)) { mvx = _flowV.x * spd * s; mvz = _flowV.y * spd * s; }
        else { mvx = dirP.x * spd * s; mvz = dirP.y * spd * s; }
      };
      if (playing && e.affixes?.length) tickEliteAffixes(this, e, dt, dist);
      // 多階段 Boss 戰機制檢定（65% Phase 2 召喚／場地技、30% Phase 3 熾炎狂暴）
      if (playing && (e.type === 'stag' || e.isTideBoss) && e.maxHp > 0) {
        const hpRatio = e.hp / e.maxHp;
        if (!e._bossP2 && hpRatio <= 0.65) {
          e._bossP2 = true;
          e.spd *= 1.12;
          this.audio.sfx('tideHorn');
          this.vfx?.spawnWarning(e.pos.x, e.pos.y || 0, e.pos.z, 1.35, 4.2, 'fire');
          this.ui.dmgNum(e.pos.x, this.world.gh(e.pos.x, e.pos.z) + 2.8, e.pos.z, '⚠️ PHASE 2!', 'comic');
          this.ui.toast(`🔥 ${e.bossName || '首領'} 進入第二階段！場地威脅升級，擊破弱點可大幅破防！`, '#ff8a3a');
          this.spawnGroundZone('magma', p.pos.x, p.pos.z, 3.6, 5.5, 0.35, { color: 0xff6a30, fire: true });
        } else if (!e._bossP3 && hpRatio <= 0.30) {
          e._bossP3 = true;
          e.spd *= 1.2;
          e.dmg = Math.round(e.dmg * 1.25);
          this.audio.sfx('tideHorn');
          this.vfx?.spawnMaliceRift(e.pos.x, e.pos.y || 0, e.pos.z, 'death');
          this.shake = Math.max(this.shake, 0.55);
          this.ui.dmgNum(e.pos.x, this.world.gh(e.pos.x, e.pos.z) + 3.0, e.pos.z, '🔥 ENRAGE!', 'comic');
          this.ui.toast(`☠️ ${e.bossName || '首領'} 進入【熾炎狂暴】！攻速與傷害大增！`, '#ff4858');
        }
        if (e._bossP3) e.cd -= dt * 0.35;
      }
      if (playing && e.eliteMod && e.stun <= 0 && dist < 13) {
        if (e.eliteMod.id === 'haste') e.cd -= dt * 0.35;
        else {
          e.eliteModCd = (e.eliteModCd || 2.5) - dt;
          if (e.eliteModCd <= 0) {
            if (e.eliteMod.id === 'molten') {
              e.eliteModCd = 3.2;
              this.spawnGroundZone('magma', e.pos.x, e.pos.z, 1.9, 4.0, 0.25, { color: 0xff6a30, fire: true });
            } else if (e.eliteMod.id === 'frost') {
              e.eliteModCd = 4.8;
              this.spawnGroundZone('ice', e.pos.x, e.pos.z, 2.5, 4.2, 0.2, { color: 0x7ae8ff, slow: 2.0 });
            } else if (e.eliteMod.id === 'storm') {
              e.eliteModCd = 4.6;
              const sx = e.pos.x, sz = e.pos.z, sdmg = e.dmg * 0.9;
              this.addDecal('circle', sx, sz, 2.6, 0xc88cff, 0.85, null, () => {
                this.applyElementAt(sx, sz, 'shock', 2.8);
                this.fx.burst(sx, 0.8, sz, 12, { c: [0xc88cff, 0xffffff], s: 0.12, speed: 5, up: 3, life: 0.4 });
                if (Math.hypot(p.pos.x - sx, p.pos.z - sz) < 2.7) this.hurtPlayer(sdmg, new V3(sx, 0, sz), 'shock');
              });
            }
          }
        }
      }
      if (e.stun > 0 || !playing || (this.field && dist > (e.tideAggro ? 32 : e.legendary ? 14 : 18))) {
        // idle
      } else if (e.type === 'slime') {
        if (!e.meadowPounce || e.state === 'move') {
          follow(0.6 + 0.6 * Math.max(0, Math.sin(e.t * 6 + e.ph)));
          if (e.meadowPounce) {
            e.cd -= dt;
            const nearbyPounce = e.cd <= 0 && dist < 4.3 && this.enemies.some(other =>
              other !== e && other.meadowPounce && !other.dead && other.state === 'meadow-strike' && other.pos.distanceToSquared(e.pos) < 36);
            if (e.cd <= 0 && dist < 4.3 && !nearbyPounce) {
              const reach = Math.min(2.8, dist);
              this.queueMeadowStrike(e, e.pos.x + dirP.x * reach, e.pos.z + dirP.y * reach, 1.45, 0.85, 1);
              mvx = mvz = 0;
            }
          }
        } else if (e.state === 'rest' && e.t >= (e.chargeRecoveryS ?? 0.62)) {
          e.state = 'move'; e.cd = 1.45 + e.ph * 0.08;
        }
        e.m.body.position.y = e.state === 'meadow-strike' ? Math.sin(Math.min(1, e.t / 0.85) * Math.PI) * 0.64 : (e.state === 'rest' ? 0 : Math.abs(Math.sin(e.t * 6 + e.ph)) * 0.25);
        const sq = 1 + Math.sin(e.t * 12 + e.ph) * 0.08;
        e.m.body.scale.set(sq, 2 - sq, sq);
      } else if (e.type === 'thorn') {
        e.cd -= dt;
        if (e.state === 'move') {
          if (dist > 8) follow(); else if (dist < 4.5) { mvx = -dirP.x * spd; mvz = -dirP.y * spd; }
          else { mvx = -dirP.y * spd * 0.4 * Math.sign(Math.sin(e.ph)); mvz = dirP.x * spd * 0.4 * Math.sign(Math.sin(e.ph)); }
          if (e.cd <= 0 && dist < 12) {
            if (e.expeditionName && !e.rootCastLast) {
              e.rootCastLast = true;
              this.queueMeadowStrike(e, p.pos.x, p.pos.z, 2.65, 1.1, 1.15);
              mvx = mvz = 0;
            } else { e.state = 'aim'; e.t = 0; this.audio.sfx('hover'); }
          }
        } else if (e.state === 'aim') {
          const s = 1 + Math.sin(e.t * 40) * 0.08; e.m.body.scale.set(s, s, s);
          e.flash = Math.max(e.flash, 0.05);
          if (e.t > (e.expeditionName ? 0.85 : 0.55)) {
            e.rootCastLast = false;
            const n = e.elite || e.expeditionName ? 3 : 1;
            for (let i = 0; i < n; i++) {
              const d = dirP.clone().rotateAround(new V2(), (i - (n - 1) / 2) * 0.3);
              this.fireEnemyProj(e.pos, d, 8.5, e.dmg, 0x9bd85a);
            }
            e.state = 'move'; e.cd = 2.0 + (this.ambushTrial ? this.rng() : Math.random()); e.m.body.scale.set(1, 1, 1);
          }
        } else if (e.state === 'rest' && e.t >= (e.chargeRecoveryS ?? 0.9)) {
          e.state = 'move'; e.cd = 0.9;
        }
      } else if (e.type === 'boar') {
        e.cd -= dt;
        if (e.state === 'move') {
          follow(0.8);
          const stomp = e.expeditionName && dist < 4.8 && (!e.meadowStompUsed
            || ((e.expeditionTier === 2 || e.hp < e.maxHp * 0.5) && e.lastMeadowMove !== 'stomp'));
          if (e.cd <= 0 && stomp) {
            e.meadowStompUsed = true; e.lastMeadowMove = 'stomp';
            mvx = mvz = 0;
            this.queueMeadowStrike(e, e.pos.x, e.pos.z, e.expeditionTier === 2 ? 3.8 : 3.2, 1.05, 1.1);
          } else if (dist < 7.5 && e.cd <= 0) {
            if (e.expeditionName) e.lastMeadowMove = 'charge';
            e.state = 'wind'; e.t = 0; e.cdir = dirP.clone();
            this.ambushTrial?.beginCharge(e, p);
            e.dec = this.addDecal('rect', e.pos.x, e.pos.z, { w: 1.2 * e.m.root.scale.x, l: 6.4 }, 0xff5040, 0.75, Math.atan2(e.cdir.x, e.cdir.y));
            if (e.expeditionName) e.dec.mesh.position.y = this.world.gh(e.pos.x, e.pos.z) + 0.16;
          }
        } else if (e.state === 'wind') {
          e.m.body.position.x = Math.sin(e.t * 60) * 0.05;
          if (e.t > 0.75) { e.state = 'charge'; e.t = 0; }
        } else if (e.state === 'charge') {
          const x = e.pos.x, z = e.pos.z;
          const progress = Math.min(1, e.t / 0.6);
          const chargeSpd = 12.6 * (1 - 0.7 * progress * progress);
          const step = chargeSpd * dt;
          this.moveEntity(e.pos, e.cdir.x * step, e.cdir.y * step, e.r);
          if (Math.random() < (progress > 0.65 ? 0.85 : 0.6)) this.puffs.emit(e.pos.x, 0.1, e.pos.z, { c: 0xf4ecd8, s: progress > 0.65 ? 0.3 : 0.25, g: -0.3, life: 0.42, grow: 1 });
          // A shorter simulation step should not be mistaken for hitting an obstacle.
          const blocked = step > 0 && Math.hypot(e.pos.x - x, e.pos.z - z) < step * 0.1;
          const ended = e.t >= 0.6 || blocked;
          if (ended) { e.state = 'rest'; e.t = 0; }
          const trialCharge = e.ambushCharge;
          if (dist < e.r + 0.5) {
            if (trialCharge && p.roll > 0) trialCharge.rollContact = true;
            const hp = p.hp;
            this.hurtPlayer(e.dmg * (e.brokenWeakens?.has('charge') ? 0.65 : 1), e.pos, null, 'boar', 'charge');
            if (trialCharge && p.hp < hp) trialCharge.hit = true;
          }
          if (ended && this.ambushTrial) this.ambushTrial.endCharge(e, p, meleeReach(p), blocked);
        } else if (e.state === 'rest') {
          if (Math.random() < dt * 6.5) {
            this.puffs.emit(e.pos.x + Math.sin(e.facing) * 0.65, (e.pos.y || 0) + 0.42, e.pos.z + Math.cos(e.facing) * 0.65, { c: 0xf2ede0, s: 0.18, speed: 0.9, up: 0.8, g: -0.4, life: 0.45, grow: 1.1 });
          }
          if (e.t >= (e.chargeRecoveryS ?? 0.9)) { e.state = 'move'; e.cd = 1.5 + (this.ambushTrial ? this.rng() : Math.random()) * 1.5; }
        }
        if (e.state !== 'wind') e.m.body.position.x = 0;
        if (e.state === 'move' || e.state === 'wind') e.facing = angleLerp(e.facing, Math.atan2(dirP.x, dirP.y), 1 - Math.exp(-dt * 8));
        else if (e.state === 'charge') e.facing = Math.atan2(e.cdir.x, e.cdir.y);
      } else if (e.type === 'moth') {
        e.cd -= dt;
        if (e.state === 'rest') {
          if (e.t >= (e.chargeRecoveryS ?? 0.75)) { e.state = 'move'; }
        } else {
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
            e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 0.75;
          }
        }
        e.m.body.position.y = (e.state === 'rest' ? 0.52 : 0.9) + Math.sin(e.t * 3 + e.ph) * 0.15;
        const fl = Math.sin(e.t * (e.state === 'rest' ? 8 : 22)) * (e.state === 'rest' ? 0.25 : 0.6);
        e.m.wings[0].rotation.z = fl; e.m.wings[1].rotation.z = -fl;
      } else if (e.type === 'skyray') {
        e.groundedT = Math.max(0, (e.groundedT || 0) - dt);
        e.cd -= dt;
        if (e.state === 'rest') {
          const restDur = e.chargeRecoveryS || 0.70;
          if (e.t > restDur) { e.state = 'move'; e.t = 0; e.chargeRecoveryS = 0; }
        } else if (e.groundedT <= 0) {
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
            e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 0.70;
          }
        }
        const slowWing = e.groundedT > 0 || e.state === 'rest';
        const fl = Math.sin(e.t * (slowWing ? 4.5 : 11)) * (slowWing ? 0.16 : 0.45);
        if (e.m.wings) { e.m.wings[0].rotation.z = fl; e.m.wings[1].rotation.z = -fl; }
      } else if (e.type === 'golem') {
        e.cd -= dt;
        if (e.state === 'move') {
          follow(0.75);
          e.m.body.position.y = Math.abs(Math.sin(e.t * 4.5 + e.ph)) * 0.1;
          if (e.sporeGuardian && dist < 10 && e.cd <= 0 && (!e.sporeLast || dist >= 4.5)) {
            e.facing = Math.atan2(dirP.x, dirP.y);
            mvx = mvz = 0;
            this.queueSporeBurst(e);
          } else if (dist < (e.blinded > 0 ? 2.8 : 4.5) && e.cd <= 0) {
            e.sporeLast = false;
            e.state = 'slam'; e.t = 0;
            const slamR = e.brokenWeakens?.has('slam') ? 2.35 : 3.6;
            this.addDecal('circle', e.pos.x, e.pos.z, slamR, 0x6ae8ff, 0.85, null, () => {
              if (e.dead) return;
              this.audio.sfx('slam');
              this.puffs.burst(e.pos.x, 0.3, e.pos.z, 14, { c: [0x6ae8ff, 0x8a8680], s: 0.32, speed: 4.5, up: 3, life: 0.65 });
              if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < slamR + 0.2) this.hurtPlayer(e.dmg * 1.25, e.pos, 'shock');
            });
          }
        } else if (e.state === 'spore-burst') {
          if (e.t > 1.8) { e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 0.85; }
        } else if (e.state === 'slam') {
          e.m.body.position.y = Math.sin(Math.min(1, e.t / 0.85) * Math.PI) * 0.45;
          if (e.t > 1.05) { e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 0.85; }
        } else if (e.state === 'rest' && e.t >= (e.chargeRecoveryS ?? 0.85)) {
          e.state = 'move'; e.cd = e.sporeGuardian ? 1.35 : 2.2 + Math.random();
        }
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
      if (playing && e.type !== 'boar' && !e.meadowPounce && dist < e.r + 0.45 && e.hitCd <= 0 && e.stun <= 0) {
        if (e.flying && e.groundedT <= 0 && p.air && p.y > e.pos.y - 0.5) {
          this.hitEnemy(e, this.rollDamage(1.4), 0, 0, { aerial: true, hitstop: 0.04 });
          e.hitCd = 0.6;
        } else if (!e.flying || e.groundedT > 0 || Math.abs(p.y - e.pos.y) < 1.1) {
          this.hurtPlayer(e.dmg * (e.type === 'stag' ? 0.8 : 1), e.pos,
            e.statusAffinity || (e.type === 'slime' ? 'poison' : null), e.type, 'contact');
          e.hitCd = 0.8;
          if (hasAffix(e, 'vampiric') && e.hp < e.maxHp) {
            const healAmt = Math.max(4, Math.round(e.maxHp * 0.08));
            e.hp = Math.min(e.maxHp, e.hp + healAmt);
            this.ui.dmgNum(e.pos.x, e.pos.y + 1.5, e.pos.z, `🩸+${healAmt}`, 'heal');
          }
        }
      }
      // visuals（怪物平滑爬坡貼合地形高度＋受擊壓扁彈回＋異常狀態色彩提示）
      const flyH = (e.flying && e.groundedT <= 0) ? (e.alt + Math.sin(e.t * 3.2 + e.ph) * 0.25) : 0;
      const targetY = W.gh(e.pos.x, e.pos.z) + flyH;
      e.pos.y = lerp(e.pos.y || targetY, targetY, 1 - Math.exp(-dt * 16));
      e.m.root.position.set(e.pos.x, e.pos.y, e.pos.z);
      if (e.m.shadowRing) e.m.shadowRing.position.y = -flyH + 0.06;
      e.m.root.rotation.y = e.facing;
      const inThornAim = e.type === 'thorn' && e.state === 'aim';
      if (inThornAim) {
        const aimDur = e.expeditionName ? 0.85 : 0.55;
        const aimRem = Math.max(0, 1 - e.t / aimDur);
        if (!e.m.aimRing) {
          const ag = new THREE.RingGeometry(0.84, 1.0, 24); ag.rotateX(-Math.PI / 2);
          e.m.aimRing = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xff4d5a, transparent: true, opacity: 0.84, side: THREE.DoubleSide, depthWrite: false }));
          e.m.aimRing.position.y = 0.09; e.m.aimRing.userData.noNormal = true; e.m.aimRing.renderOrder = 3;
          e.m.root.add(e.m.aimRing);
        }
        e.m.aimRing.visible = true;
        e.m.aimRing.scale.setScalar(0.35 + 1.0 * aimRem);
        e.m.aimRing.material.opacity = 0.42 + 0.48 * (1 - aimRem);
      } else if (e.m.aimRing) {
        e.m.aimRing.visible = false;
      }
      const recDur = e.chargeRecoveryS || 0;
      const inRestOpening = e.state === 'rest' && recDur > 0 && e.t < recDur;
      let restRollZ = 0;
      if (inRestOpening) {
        const rem = Math.max(0, 1 - e.t / recDur);
        const ease = Math.min(1, e.t / 0.12) * Math.min(1, (recDur - e.t) / 0.2);
        if (e.type === 'boar') {
          e.m.body.rotation.x = 0.42 * ease;
          restRollZ = Math.sin(e.t * 15) * 0.11 * ease;
          const pant = Math.sin(e.t * 14) * 0.10;
          if (e.squash > 0) e.m.body.scale.set(1 + e.squash * 0.7, 1 - e.squash * 0.55, 1 + e.squash * 0.7);
          else e.m.body.scale.set(1 + pant, 1 - pant * 0.85, 1 + pant);
        } else if (e.type === 'slime') {
          if (e.squash > 0) e.m.body.scale.set(1 + e.squash * 0.7, 1 - e.squash * 0.55, 1 + e.squash * 0.7);
          else {
            const flat = 1.38 - 0.18 * (1 - rem);
            const hgt = 0.50 + 0.20 * (1 - rem);
            e.m.body.scale.set(flat, hgt, flat);
          }
        } else if (e.type === 'thorn') {
          e.m.body.rotation.x = -0.34 * ease;
          restRollZ = Math.sin(e.t * 14) * 0.12 * ease;
          if (e.squash > 0) e.m.body.scale.set(1 + e.squash * 0.7, 1 - e.squash * 0.55, 1 + e.squash * 0.7);
        } else if (e.type === 'golem' || e.type === 'stag') {
          e.m.body.rotation.x = 0.30 * ease;
          restRollZ = Math.sin(e.t * 10) * 0.06 * ease;
          if (e.squash > 0) e.m.body.scale.set(1 + e.squash * 0.7, 1 - e.squash * 0.55, 1 + e.squash * 0.7);
        } else if (e.type === 'moth' || e.type === 'skyray') {
          restRollZ = Math.sin(e.t * 10) * 0.22 * ease;
          if (e.squash > 0) e.m.body.scale.set(1 + e.squash * 0.7, 1 - e.squash * 0.55, 1 + e.squash * 0.7);
        }
        if (!e.m.restStars) {
          const grp = new THREE.Group();
          const sSize = e.type === 'stag' ? 0.19 : e.type === 'golem' ? 0.15 : 0.125;
          const sRad = e.type === 'stag' ? 1.05 : e.type === 'golem' ? 0.76 : 0.54;
          const sY = e.type === 'stag' ? 3.25 : e.type === 'golem' ? 2.15 : e.type === 'thorn' ? 1.75 : e.type === 'slime' ? 1.15 : 1.48;
          const sGeo = new THREE.OctahedronGeometry(sSize, 0);
          const sMat = new THREE.MeshBasicMaterial({ color: 0xffdf54, transparent: true, opacity: 0.95 });
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const st = new THREE.Mesh(sGeo, sMat);
            st.position.set(Math.cos(a) * sRad, 0, Math.sin(a) * sRad);
            st.scale.set(1, 1.35, 1);
            st.userData.noNormal = true;
            grp.add(st);
          }
          grp.position.y = sY;
          grp.rotation.z = 0.14;
          grp.userData.noNormal = true;
          grp.userData.mat = sMat;
          e.m.root.add(grp);
          e.m.restStars = grp;
        }
        e.m.restStars.visible = true;
        e.m.restStars.rotation.y += dt * (2.6 + 4.8 * rem);
        const starSc = 0.52 + 0.56 * rem;
        e.m.restStars.scale.setScalar(starSc);
        e.m.restStars.userData.mat.opacity = Math.min(1, 0.35 + 0.75 * rem);
        for (let i = 0; i < e.m.restStars.children.length; i++) {
          const st = e.m.restStars.children[i];
          st.rotation.y += dt * 5.2;
          st.position.y = Math.sin(this.time * 7 + i * 2.1) * 0.08;
        }
      } else {
        if (e.type === 'boar' || e.type === 'thorn' || e.type === 'golem' || e.type === 'stag') e.m.body.rotation.x = 0;
        if (e.m.restStars) e.m.restStars.visible = false;
        if (e.squash > 0) e.m.body.scale.set(1 + e.squash * 0.7, 1 - e.squash * 0.55, 1 + e.squash * 0.7);
        else if (e.type !== 'slime' && e.state !== 'aim') e.m.body.scale.set(1, 1, 1);
      }
      const fl = e.flash > 0 ? 1 : 0;
      if (fl) e.m.mat.emissive.setRGB(0.95, 0.9, 0.85);
      else if (est.freeze > 0) e.m.mat.emissive.setRGB(0.18, 0.52, 0.78);
      else if (est.poison > 0) e.m.mat.emissive.setRGB(0.18, 0.52, 0.22);
      else if (est.burn > 0) e.m.mat.emissive.setRGB(0.65, 0.22, 0.08);
      else if (est.shock > 0) e.m.mat.emissive.setRGB(0.45, 0.25, 0.72);
      else if (inRestOpening) { const gp = 0.6 + Math.sin(e.t * 14) * 0.4; e.m.mat.emissive.setRGB(0.28 * gp, 0.20 * gp, 0.04 * gp); }
      else e.m.mat.emissive.setRGB(0, 0, 0);
      e.m.body.rotation.z = e.stun > 0 ? Math.sin(this.time * 20) * 0.1 : restRollZ;
    }
    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.boss) this.ui.bossBar(!this.field || this.boss.pos.distanceTo(p.pos)<10, null, this.boss.hp / this.boss.maxHp, this.boss.parts);
  }

  updateBoss(e, dt, dist, dirP, follow, setMv) {
    const p = this.player;
    e.cd -= dt;
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) { e.phase = 2; this.ui.toast('鹿王憤怒了！', '#ff9a4a'); this.shake = 0.8; e.spd *= 1.25; }
    const fast = (e.phase === 2 ? 0.75 : 1) * (e.brokenWeakens?.has('charge') ? 1.3 : 1);
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
        const chSpd = e.brokenWeakens?.has('charge') ? 11 : 16;
        this.moveEntity(e.pos, e.cdir.x * chSpd * dt, e.cdir.y * chSpd * dt, 1);
        if (Math.random() < 0.8) this.puffs.emit(e.pos.x + (Math.random() - 0.5), 0.1, e.pos.z, { c: 0xf4ecd8, s: 0.4, g: -0.3, life: 0.5, grow: 1 });
        if (dist < 1.8) this.hurtPlayer(e.dmg * 1.3, e.pos);
        if (e.t > 0.85 || b.distanceTo(e.pos) < 0.01) { this.shake = 0.4; e.charges = (e.charges || 0) + 1; if (e.charges < (e.phase === 2 ? 3 : 2)) { e.step = 0; e.t = 0; } else { e.charges = 0; e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 1.15; } }
      }
    } else if (e.state === 'burst') {
      e.flash = Math.max(e.flash, Math.sin(e.t * 30) > 0 ? 0.03 : 0);
      if (e.t > 0.7 * fast && e.step < (e.phase === 2 ? 3 : 2)) {
        e.t = 0.2; e.step++;
        const n = e.brokenWeakens?.has('burst') ? 7 : 14, off = e.step * 0.2;
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
      if (e.t > 1.4) { e.state = 'rest'; e.t = 0; e.chargeRecoveryS = 1.15; }
    } else if (e.state === 'rest') {
      if (e.t >= (e.chargeRecoveryS ?? 1.15)) { e.state = 'move'; e.cd = 1.2 * fast; }
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
    const sporePools = this.field === 3 ? this.groundZones.filter(zone => zone.sporeSource && zone.life > 0) : [];
    const cover = this.ambushTrial?.cover;
    for (const pr of this.projs) {
      const { x: fromX, z: fromZ } = pr.mesh.position;
      if (pr.orbit) {
        pr.orbitAngle = (pr.orbitAngle || 0) + dt * 5.2;
        const r = pr.orbitR || 2.2;
        pr.mesh.position.set(p.pos.x + Math.cos(pr.orbitAngle) * r, p.y + 0.7, p.pos.z + Math.sin(pr.orbitAngle) * r);
        pr.vx = -Math.sin(pr.orbitAngle) * 12; pr.vz = Math.cos(pr.orbitAngle) * 12;
        pr.orbitClearT = (pr.orbitClearT || 0.35) - dt;
        if (pr.orbitClearT <= 0) { pr.orbitClearT = 0.35; pr.hit.clear(); }
        pr.life -= dt;
      } else {
        if (pr.homing && !pr.homing.dead) {
          const d = new V2(pr.homing.pos.x - pr.mesh.position.x, pr.homing.pos.z - pr.mesh.position.z).normalize();
          const sp = Math.hypot(pr.vx, pr.vz);
          pr.vx = lerp(pr.vx, d.x * sp, 1 - Math.exp(-dt * 8)); pr.vz = lerp(pr.vz, d.y * sp, 1 - Math.exp(-dt * 8));
        }
        pr.mesh.position.x += pr.vx * dt; pr.mesh.position.z += pr.vz * dt; pr.life -= dt;
      }
      pr.mesh.rotation.x += dt * 10; if (!pr.wave) pr.mesh.rotation.y += dt * 7;
      if (pr.fire && Math.random() < 0.7) this.fx.emit(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, { c: Math.random() < 0.5 ? 0xffd27a : 0xff7a30, s: 0.09, g: -1, life: 0.25 });
      if (pr.fire && sporePools.length) {
        const { x, y, z } = pr.mesh.position;
        if (sporePools.some(zone => zone.sporeSource && Math.abs(y - zone.y) < 3 &&
          Math.hypot(x - zone.x, z - zone.z) < zone.r)) this.applyElementAt(x, z, 'fire', 0);
      }
      const { x, y, z } = pr.mesh.position;
      const blocked = hitsAmbushCover(cover, fromX, y, fromZ, x, z);
      if (blocked) pr.life = 0;
      for (const e of blocked ? [] : this.enemies) {
        if (e.dead || pr.hit.has(e)) continue;
        const d = Math.hypot(e.pos.x - pr.mesh.position.x, e.pos.z - pr.mesh.position.z);
        const vTol = e.flying ? 3.8 : 2.4;
        if (d < e.r + (pr.wave ? 0.8 : 0.25) && Math.abs(pr.mesh.position.y - (e.pos.y + 0.6)) < vTol) {
          pr.hit.add(e);
          const n = new V2(pr.vx, pr.vz).normalize();
          this.hitEnemy(e, this.rollDamage(pr.mult, pr.fire), n.x * 3, n.y * 3, { hitPos: pr.mesh.position, hitstop: 0.02, slow: pr.slow, leech: pr.leech, poison: pr.poison, shock: pr.shock, aerial: !!pr.airShot, triggerOnHit: pr.triggerOnHit, triggerOnCrit: pr.triggerOnCrit, isTrigger: pr.isTrigger });
          if (pr.split) {
            for (let i = 0; i < 3; i++) { const a = Math.atan2(n.y, n.x) + (i - 1) * 0.7; this.fireProj(pr.mesh.position, new V2(Math.cos(a), Math.sin(a)), { speed: 12, mult: 0.45, fire: true, color: 0xffd27a, size: 0.1, life: 0.5, hit0: e, isTrigger: true }); }
            this.projs[this.projs.length - 1].hit?.add(e);
          }
          if (pr.chain > 0) {
            let best = null, bd = 7;
            for (const o of this.enemies) if (!o.dead && !pr.hit.has(o)) { const dd = o.pos.distanceTo(e.pos); if (dd < bd) { bd = dd; best = o; } }
            if (best) { pr.chain--; this.spawnBeam(e.pos.x, e.pos.y + 0.7, e.pos.z, best.pos.x, best.pos.y + 0.7, best.pos.z, pr.color || 0xffe07a); const nd = new V2(best.pos.x - e.pos.x, best.pos.z - e.pos.z).normalize(); const sp = Math.hypot(pr.vx, pr.vz); pr.vx = nd.x * sp; pr.vz = nd.y * sp; pr.life = 0.8; continue; }
          }
          if ((pr.pierce || 0) <= 0) { pr.life = 0; break; } else pr.pierce--;
        }
      }
      if (pr.hit0) { pr.hit.add(pr.hit0); pr.hit0 = null; }
      if (!pr.wave && !pr.orbit && this.world.groundY(pr.mesh.position.x, pr.mesh.position.z) > pr.mesh.position.y - 0.05) pr.life = 0;
      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        pr.mesh.geometry?.dispose?.(); pr.mesh.material?.dispose?.();
        if (pr.fire) this.fx.burst(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, 5, { c: [0xffd27a, 0xff7a30], s: 0.08, speed: 3, up: 2, life: 0.3 });
      }
    }
    this.projs = this.projs.filter(pr => pr.life > 0);
    for (const pr of this.eprojs) {
      const { x: fromX, z: fromZ } = pr.mesh.position;
      pr.mesh.position.x += pr.vx * dt; pr.mesh.position.z += pr.vz * dt; pr.life -= dt;
      const { x, y, z } = pr.mesh.position;
      const blocked = hitsAmbushCover(cover, fromX, y, fromZ, x, z);
      if (blocked) {
        pr.life = 0;
        this.ambushTrial.event('coverBlocked', { enemy: 'thorn' });
        this.audio.sfx('kick');
        this.puffs.burst(x, y, z, 6, { c: [0xd8dde6, 0x9bd85a], s: 0.16, speed: 3.2, up: 1.6, life: 0.35 });
        const bg = new THREE.RingGeometry(0.18, 0.32, 16); bg.rotateX(-Math.PI / 2);
        const bm = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
        bm.position.set(x, y, z); bm.userData.noNormal = true; this.scene.add(bm);
        this.rings.push({ mesh: bm, t: 0, max: 0.18, radius: 0.85 });
      }
      pr.mesh.rotation.y += dt * 8;
      if (!blocked && this.state === 'play' && Math.hypot(p.pos.x - pr.mesh.position.x, p.pos.z - pr.mesh.position.z) < 0.45 && Math.abs(pr.mesh.position.y - (p.y + 0.6)) < 1.3) {
        if (p.roll <= 0 && p.iframes <= 0) { this.hurtPlayer(pr.dmg, pr.mesh.position, null, 'thorn', 'projectile'); pr.life = 0; }
      }
      if (this.world.groundY(pr.mesh.position.x, pr.mesh.position.z) > pr.mesh.position.y - 0.1) pr.life = 0; // hit cliffs
      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        const cHex = pr.mesh.material?.color?.getHex?.() ?? 0xffd27a;
        pr.mesh.geometry?.dispose?.(); pr.mesh.material?.dispose?.();
        this.fx.burst(pr.mesh.position.x, 0.6, pr.mesh.position.z, 4, { c: cHex, s: 0.08, speed: 2, life: 0.3 });
      }
    }
    this.eprojs = this.eprojs.filter(pr => pr.life > 0);
  }

  updateMisc(dt) {
    const p = this.player;
    for (const d of this.decals) {
      d.t += dt; d.mat.uniforms.uProg.value = Math.min(1, d.t / d.dur);
      if (d.frost) { d.mat.uniforms.uAlpha.value = 1 - d.t / d.dur; for (const e of this.enemies) if (e.pos.distanceTo(d.mesh.position) < 2.4) e.slow = 0.5; }
      if (d.t >= d.dur) { this.scene.remove(d.mesh); d.mesh.geometry?.dispose?.(); d.mat.dispose(); if (d.onDone) d.onDone(); d.dead = true; }
    }
    this.decals = this.decals.filter(d => !d.dead);
    for (const s of this.slashes) { s.t -= dt; s.mesh.material.opacity = Math.max(0, s.t / s.max) * 0.85; s.mesh.scale.setScalar(1 + (1 - s.t / s.max) * 0.15); if (s.t <= 0) { this.scene.remove(s.mesh); s.mesh.geometry?.dispose?.(); s.mesh.material?.dispose?.(); } }
    this.slashes = this.slashes.filter(s => s.t > 0);
    for (const r of this.rings) { r.t += dt; const k = Math.min(1, r.t / r.max); if (r.onTick) r.onTick(k, dt); else { r.mesh.scale.setScalar(Math.max(0.01, k * r.radius)); r.mesh.material.opacity = 0.9 * (1 - k); } if (k >= 1) { this.scene.remove(r.mesh); if (r.mesh.isGroup) r.mesh.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); else { r.mesh.geometry?.dispose?.(); r.mesh.material?.dispose?.(); } } }
    this.rings = this.rings.filter(r => r.t < r.max);
    for (const bm of this.beams || []) { bm.t -= dt; bm.mesh.material.opacity = Math.max(0, bm.t / bm.max); if (bm.t <= 0) { this.scene.remove(bm.mesh); bm.mesh.geometry?.dispose?.(); bm.mesh.material?.dispose?.(); } }
    this.beams = (this.beams || []).filter(bm => bm.t > 0);
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
      if (d.icon) d.icon.position.y = d.gem.position.y + 0.8;
      if (d.kind === 'orb' && this.state === 'play') {
        const dx = p.pos.x - d.g.position.x, dz = p.pos.z - d.g.position.z, dist = Math.hypot(dx, dz);
        if (dist < 7.5 && d.vy === 0 && Math.abs(d.g.position.y - p.y) < 2.5) { d.g.position.x += dx / dist * dt * 13; d.g.position.z += dz / dist * dt * 13; }
        if (dist < 0.9 && Math.abs(d.g.position.y - p.y) < 2.0) { this.audio.sfx('orb'); this.heal(p.stats.maxHp * 0.14); d.taken = true; this.disposeDrop(d); }
      }
    }
    this.drops = this.drops.filter(d => !d.taken);
    // 連擊與祝福石碑／軟綿祝福倒數＋巡遊小綿羊＋晴日飛舞蝴蝶＋海面浮標微幅起伏
    if (this.combo?.timer > 0) { this.combo.timer -= dt; if (this.combo.timer <= 0) { this.combo.count = 0; this.combo.timer = 0; } }
    if (this.shrineBuffs) {
      for (const k of ['fury', 'frost', 'gold', 'sheep']) this.shrineBuffs[k] = Math.max(0, (this.shrineBuffs[k] || 0) - dt);
      if (this.shrineBuffs.sheep > 0 && this.state === 'play') {
        this.heal(p.stats.maxHp * 0.015 * dt, false);
        p.mana = Math.min(p.stats.mana, p.mana + dt * 3);
      }
    }
    for (const sh of this.sheep || []) {
      sh.wait -= dt; sh.hop = Math.max(0, sh.hop - dt);
      const dx = sh.tx - sh.x, dz = sh.tz - sh.z, d = Math.hypot(dx, dz);
      if (d < 0.25) {
        if (sh.wait <= 0) { sh.wait = 3 + Math.random() * 5; const a = Math.random() * 6.28, rr = 1.2 + Math.random() * 2.8; const nx = sh.hx + Math.cos(a) * rr, nz = sh.hz + Math.sin(a) * rr; if (this.world.isWalk(nx, nz)) { sh.tx = nx; sh.tz = nz; } }
      } else {
        sh.x += (dx / d) * 1.25 * dt; sh.z += (dz / d) * 1.25 * dt;
        sh.f = angleLerp(sh.f, Math.atan2(dx, dz), 1 - Math.exp(-dt * 8));
      }
      const hopY = sh.hop > 0 ? Math.sin((sh.hop / 0.45) * Math.PI) * 0.55 : (d >= 0.25 ? Math.abs(Math.sin(this.time * 8 + sh.ph)) * 0.12 : 0);
      sh.mesh.position.set(sh.x, this.world.gh(sh.x, sh.z) + hopY, sh.z);
      sh.mesh.rotation.y = sh.f;
    }
    if (this.state === 'play' && !this.interior && !this.isNight && Math.random() < dt * 2.4) {
      this.fx.emit(p.pos.x + (Math.random() - 0.5) * 16, p.y + 0.8 + Math.random() * 1.6, p.pos.z + (Math.random() - 0.5) * 16, { c: [0xffe46a, 0xffa8d8, 0x8ef0ff, 0xffffff], s: 0.08, vx: (Math.random() - 0.5) * 1.4, vz: (Math.random() - 0.5) * 1.4, vy: 0.35, g: -0.1, life: 2.2 });
    }
    if (this.state === 'play' && this.field === 10 && Math.random() < dt * 11) {
      this.fx.emit(p.pos.x + (Math.random() - 0.5) * 20, p.y + 4.8 + Math.random() * 2.5, p.pos.z + (Math.random() - 0.5) * 20, { c: [0xffa6c9, 0xffd6e7, 0xffffff], s: 0.09, vx: 1.1, vz: 0.6, vy: -1.1, g: 0.25, life: 3.4 });
    }
    for (const b of this.world?.buoys || []) {
      b.mesh.position.y = b.y0 + Math.sin(this.time * 2.2 + b.ph) * 0.08;
      b.mesh.rotation.z = Math.sin(this.time * 1.6 + b.ph) * 0.09;
    }
    if (this.state === 'play' && (p.gliding || (this.mount && p.walkT > 0))) {
      const rx = Math.cos(p.facing) * 0.52, rz = -Math.sin(p.facing) * 0.52;
      if (Math.random() < dt * (p.gliding ? 32 : 16)) {
        this.fx.emit(p.pos.x + rx, p.y + (p.gliding ? 0.95 : 0.65), p.pos.z + rz, { c: 0xffffff, s: 0.075, g: 0, life: 0.42 });
        this.fx.emit(p.pos.x - rx, p.y + (p.gliding ? 0.95 : 0.65), p.pos.z - rz, { c: 0xffffff, s: 0.075, g: 0, life: 0.42 });
      }
    }
    // 持續性元素地表區域（積水、冰面滑倒、蒸汽遮蔽視線、雷暴感電、毒霧、熔岩）
    if (this.state === 'play' && this.weather?.isRaining && !this.interior) {
      this._rainPuddleT = (this._rainPuddleT || 4) - dt;
      if (this._rainPuddleT <= 0 && (this.groundZones || []).filter(z => z.kind === 'water').length < 3) {
        this._rainPuddleT = 6.5;
        const rx = p.pos.x + (Math.random() - 0.5) * 12, rz = p.pos.z + (Math.random() - 0.5) * 12;
        if (this.world.isLand(rx, rz)) this.spawnGroundZone('water', rx, rz, 2.5, 11, 0.12);
      }
    }
    for (const gz of this.groundZones || []) {
      gz.life -= dt;
      if (gz.life <= 0) {
        this.scene.remove(gz.mesh);
        gz.mesh.geometry?.dispose?.();
        gz.mesh.material?.dispose?.();
        continue;
      }
      gz.tick -= dt;
      gz.mesh.rotation.z += dt * 0.8;
      gz.mesh.material.opacity = (SURFACE_DEFS[gz.kind]?.opacity || 0.38) * Math.min(1, gz.life / 1.2) * (0.85 + Math.sin(this.time * 6) * 0.15);
      if (Math.random() < dt * (gz.kind.includes('steam') ? 14 : 8)) {
        const a = Math.random() * 6.28, rr = Math.random() * gz.r;
        const px = gz.x + Math.cos(a) * rr, pz = gz.z + Math.sin(a) * rr;
        const isSteam = gz.kind.includes('steam');
        this.fx.emit(px, gz.kind === 'rain' ? gz.y + 3.2 : gz.y + (isSteam ? 0.8 : 0.2), pz, { c: gz.color || 0x7ae8ff, s: isSteam ? 0.22 : 0.1, g: gz.kind === 'rain' ? 14 : -1.5, up: gz.kind === 'rain' ? -4 : isSteam ? 2.2 : 1.4, life: isSteam ? 0.75 : 0.45 });
      }
      if (gz.tick <= 0) {
        gz.tick = 0.65;
        if (gz.sporeSource) {
          if (Math.hypot(p.pos.x - gz.x, p.pos.z - gz.z) < gz.r) this.hurtPlayer(gz.playerDamage, gz.mesh.position, 'poison');
        }
        let prevShockE = null;
        for (const e of gz.sporeSource ? [] : this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.pos.x - gz.x, e.pos.z - gz.z) < gz.r + e.r) {
            if (gz.blindVision) e.blinded = Math.max(e.blinded || 0, 1.0);
            if (gz.slipStun && e.type !== 'stag' && !e.flying && (e._slipCd || 0) <= 0) {
              e._slipCd = 2.8; e.stun = Math.max(e.stun, gz.slipStun);
              e.knock.x += (Math.random() - 0.5) * 4; e.knock.z += (Math.random() - 0.5) * 4;
              this.fx.burst(e.pos.x, e.pos.y + 0.5, e.pos.z, 8, { c: [0x9cf0ff, 0xffffff], s: 0.11, speed: 3.6, up: 2.2, life: 0.3 });
            }
            if ((gz.kind === 'electrified_water' || gz.kind === 'electrified_steam') && prevShockE) {
              this.spawnBeam(prevShockE.pos.x, prevShockE.pos.y + 0.7, prevShockE.pos.z, e.pos.x, e.pos.y + 0.7, e.pos.z, gz.color || 0xc88cff);
            }
            if (gz.kind === 'electrified_water' || gz.kind === 'electrified_steam') prevShockE = e;
            this.hitEnemy(e, this.rollDamage(gz.dmgMul, !!gz.fire), 0, 0, { isDoT: true, slow: gz.slow, poison: gz.poison, shock: gz.shock, leech: gz.leech });
          }
        }
        if (gz.healPlayer && this.state === 'play' && Math.hypot(p.pos.x - gz.x, p.pos.z - gz.z) < gz.r) {
          this.heal(p.stats.maxHp * 0.035, true);
        }
      }
    }
    this.groundZones = (this.groundZones || []).filter(gz => gz.life > 0);
    // 城鎮可踢飛滾動 3D 物理物件（海灘球與酒桶）
    for (const pp of this.physProps || []) {
      const dx = pp.x - p.pos.x, dz = pp.z - p.pos.z, d = Math.hypot(dx, dz);
      const kickR = p.swingT > 0 ? 1.55 : (pp.r + 0.45);
      if (this.state === 'play' && d < kickR && d > 0.01) {
        const power = p.swingT > 0 ? 9.5 : Math.max(4.5, Math.hypot(p.vel.x, p.vel.z) * 1.45);
        pp.vx = (dx / d) * power; pp.vz = (dz / d) * power;
        pp.vy = Math.max(pp.vy, pp.kind === 'ball' ? 4.4 : 2.2);
        if (!pp.kickCd || this.time > pp.kickCd) { pp.kickCd = this.time + 0.22; this.audio.sfx('kick'); }
      }
      pp.vy -= 18 * dt;
      pp.x += pp.vx * dt; pp.z += pp.vz * dt; pp.y += pp.vy * dt;
      const gh = this.world.isLand(pp.x, pp.z) ? this.world.gh(pp.x, pp.z) : 0;
      const floorY = gh + (pp.kind === 'ball' ? 0.36 : 0.32);
      if (pp.y < floorY) { pp.y = floorY; pp.vy = Math.abs(pp.vy) > 1.2 ? -pp.vy * (pp.kind === 'ball' ? 0.58 : 0.25) : 0; }
      if (!this.world.isLand(pp.x, pp.z)) { pp.x -= pp.vx * dt * 2; pp.z -= pp.vz * dt * 2; pp.vx *= -0.7; pp.vz *= -0.7; }
      for (const o of this.world.obstacles) {
        const ox = pp.x - o.x, oz = pp.z - o.z, od = Math.hypot(ox, oz), m = o.r + pp.r;
        if (od < m && od > 0.01) { pp.x = o.x + ox / od * m; pp.z = o.z + oz / od * m; pp.vx *= -0.65; pp.vz *= -0.65; }
      }
      const drag = Math.exp(-dt * (pp.kind === 'ball' ? 1.6 : 3.2));
      pp.vx *= drag; pp.vz *= drag;
      pp.mesh.position.set(pp.x, pp.y, pp.z);
      pp.mesh.rotation.x += pp.vz * dt * 1.8;
      pp.mesh.rotation.z -= pp.vx * dt * 1.8;
    }
    // exits
    for (const x of this.exits) {
      x.disc.material.uniforms.uT.value = this.time;
      x.disc.material.uniforms.uOn.value = lerp(x.disc.material.uniforms.uOn.value, x.on ? 1 : 0, 1 - Math.exp(-dt * 3));
      x.icon.position.y = 3.6 + Math.sin(this.time * 2) * 0.15; x.icon.rotation.y += dt * 1.5;
      x.icon.visible = x.on;
    }
    // water & motes（僅下雨或玩家涉水踩踏時才出現圓形水波）
    if (this.world.waterMat) {
      const wu = this.world.waterMat.uniforms;
      wu.uTime.value = this.time;
      wu.uWater.value = this.settings.water ? 1 : 0;
      if (wu.uRain) wu.uRain.value = this.weather?.isRaining ? 1 : 0;
      if (wu.uRipple && p.y <= 0.14 && !p.air && (Math.hypot(p.vel.x, p.vel.z) > 0.6) && this.time - (this._lastSplashT || -9) > 0.85) {
        this._lastSplashT = this.time;
        wu.uRipple.value.set(p.pos.x, p.pos.z, this.time, 1.0);
      }
    }
    windU.uTime.value = this.time;
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
    const seatY = this.mount ? this.mount.mesh.seatY : 0;
    const mBob = this.mount ? (this.mount.def.id === 'manta' ? Math.sin(this.time * 4.5) * 0.14 : (p.walkT > 0 ? Math.abs(Math.sin(p.walkT)) * 0.1 : 0)) : 0;
    m.root.position.set(p.pos.x, p.y + seatY + mBob, p.pos.z);
    m.root.rotation.y = p.facing;
    if (this.mount) {
      const mt = this.mount.mesh;
      mt.root.position.set(p.pos.x, p.y + (this.mount.def.id === 'manta' ? mBob : 0), p.pos.z);
      mt.root.rotation.y = p.facing;
      const stride = p.walkT > 0 ? Math.sin(p.walkT * 1.15) : 0;
      mt.legs.forEach((lg, idx) => { lg.rotation.x = stride * (idx % 2 ? 0.55 : -0.55); });
      mt.wings.forEach((wg, idx) => { wg.rotation.z = Math.sin(this.time * 7) * 0.28 * (idx === 0 ? 1 : -1); });
      if (p.walkT > 0 && Math.random() < dt * 10) {
        this.fx.emit(p.pos.x, p.y + 0.25, p.pos.z, { c: this.mount.def.accent, s: 0.09, g: -0.5, up: 0.8, life: 0.45 });
      }
    }
    const moving = p.walkT > 0 && !p.air;
    const sw = Math.sin(p.walkT);
    m.legL.position.z = moving ? sw * (p.sprinting ? 0.17 : 0.12) : 0; m.legR.position.z = moving ? -sw * (p.sprinting ? 0.17 : 0.12) : 0;
    m.body.position.y = moving ? Math.abs(Math.sin(p.walkT)) * (p.sprinting ? 0.09 : 0.06) : Math.sin(this.time * 2) * 0.015;
    m.body.rotation.x = moving ? (p.sprinting ? 0.24 : 0.12) : 0;
    m.head.rotation.z = moving ? Math.sin(p.walkT) * 0.05 : 0;
    if (p.sitting) { m.body.position.y = -0.18; m.legL.position.z = 0.16; m.legR.position.z = 0.16; m.body.rotation.x = -0.12; }
    else if (p.roll > 0) { m.body.rotation.x = (1 - p.roll / 0.3) * Math.PI * 2; m.body.position.y = 0.25; }
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
    // Phase C5：驅動 Modular Cute Fantasy 真實骨骼動畫狀態機
    if (p.heroRig?.ready) {
      if (p.swingT > 0) p.combatT = 5.0;
      else if (p.combatT > 0) p.combatT = Math.max(0, p.combatT - dt);
      if (this.state === 'dead') {
        p.heroRig.play('death', { once: true });
      } else if (this.gatherActive) {
        p.heroRig.play('gather');
      } else if (p.swingT > 0.14) {
        p.heroRig.play(moving ? 'runAttack' : 'attack', { once: true, speed: 1.25 });
      } else if (p.air) {
        p.heroRig.play(p.vy > 1.5 ? 'jump' : 'fall');
      } else if (moving) {
        // Phase C6：戰鬥瞄準移動時依移動與面朝夾角自動切換方向跑姿（RunBack / RunL / RunR / Run / Walk）
        let moveState = p.sprinting ? 'run' : 'walk';
        if (p.combatT > 0) {
          const vLen = Math.hypot(p.vel.x, p.vel.z);
          if (vLen > 0.4) {
            const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
            const fwd = (p.vel.x * fx + p.vel.z * fz) / vLen;
            const side = (p.vel.x * fz - p.vel.z * fx) / vLen;
            if (fwd < -0.55) moveState = 'runBack';
            else if (Math.abs(side) > 0.68 && fwd < 0.5) moveState = side > 0 ? 'runL' : 'runR';
          }
        }
        p.heroRig.play(moveState, { speed: p.sprinting ? 1.2 : 1.05 });
      } else {
        p.heroRig.play(p.combatT > 0 ? 'combatIdle' : 'idle');
      }
      p.heroRig.root.rotation.x = p.roll > 0 ? (1 - p.roll / 0.3) * Math.PI * 2 : p.gliding ? 0.38 : 0;
      p.heroRig.root.position.y = p.sitting ? -0.16 : 0;
      p.heroRig.update(dt);
    }
    // 人物被遮擋時顯示暖金透視剪影（僅在鏡頭→玩家射線實際命中高於腰部的遮擋物時顯示）
    if (m.xray) {
      m.xray.visible = !!(this._playerOccluded && !this.interior && this.state === 'play');
    }
    // 零文字汲血光環視覺指示（3.5s 普攻汲血期間於腳下顯示微光脈衝圓環）
    if ((p.leechBuffT || 0) > 0 && this.state === 'play') {
      if (!m.leechRing) {
        const lg = new THREE.RingGeometry(0.62, 0.74, 24); lg.rotateX(-Math.PI / 2);
        m.leechRing = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xff6a8a, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
        m.leechRing.position.y = 0.08; m.leechRing.userData.noNormal = true; m.leechRing.renderOrder = 3;
        m.root.add(m.leechRing);
      }
      const lr = Math.min(1, p.leechBuffT / 3.5);
      m.leechRing.visible = true;
      m.leechRing.scale.setScalar(0.88 + 0.16 * lr + Math.sin(this.time * 12) * 0.04);
      m.leechRing.material.opacity = 0.25 + 0.45 * lr;
    } else if (m.leechRing) {
      m.leechRing.visible = false;
    }
    if ((p.perfectCritT || 0) > 0 && this.state === 'play') {
      if (!m.critVfx) {
        const wg = new THREE.RingGeometry(0.58, 0.69, 18, 1, 0, Math.PI * 0.65); wg.rotateX(-Math.PI / 2);
        const wMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
        const grp = new THREE.Group();
        const w1 = new THREE.Mesh(wg, wMat); w1.position.y = 0.72;
        const w2 = new THREE.Mesh(wg, wMat); w2.position.y = 1.02; w2.rotation.y = Math.PI;
        grp.add(w1, w2); grp.userData.noNormal = true; grp.userData.mat = wMat;
        m.root.add(grp); m.critVfx = grp;
      }
      const cr = Math.min(1, p.perfectCritT / 1.5);
      m.critVfx.visible = true;
      m.critVfx.rotation.y += dt * 7.5;
      m.critVfx.scale.setScalar(0.88 + 0.18 * cr);
      m.critVfx.userData.mat.opacity = 0.2 + 0.55 * cr;
    } else if (m.critVfx) {
      m.critVfx.visible = false;
    }
    // blink when invulnerable（陣亡時若已載入骨骼角色則保留可見以播放完整倒地動畫）
    m.root.visible = (this.state !== 'dead' || !!p.heroRig?.ready) && !(p.iframes > 0 && Math.floor(this.time * 20) % 2 === 0);
    m.lantern.material.color.setHex(Math.sin(this.time * 9) > 0.8 ? 0xffe9a0 : 0xffd36e);
  }

  updateCamera(dt) {
    const p = this.player;
    let tx = p.pos.x, tz = p.pos.z;
    if (this.state === 'title') { tx = Math.sin(this.time * 0.08) * 6; tz = Math.cos(this.time * 0.06) * 4; }
    // 鎖定最佳立體斜角鏡頭（camYaw = 0.62，無需 Z/X 手動調整，畫面層次與景深最佳）
    this.camYaw = 0.62;
    this.camPos.x = lerp(this.camPos.x, tx, 1 - Math.exp(-dt * 6.5));
    this.camPos.z = lerp(this.camPos.z, tz, 1 - Math.exp(-dt * 6.5));
    this.camY = lerp(this.camY || 0, this.state === 'title' ? 0 : p.y * 0.85, 1 - Math.exp(-dt * 4));
    this.shake = Math.max(0, this.shake - dt * 3.8);
    const s = this.shake * this.shake * 0.18 * (this.settings.shake ? 1 : 0);
    const preset = [
      { yK: 0.68, zK: 0.73, fov: 34 }, // 0: 關閉（標準視角）
      { yK: 0.52, zK: 0.85, fov: 38 }, // 1: 開啟（原低仰角視角）
    ][this.settings?.camAngle ? 1 : 0];
    if (Math.abs(this.camera.fov - preset.fov) > 0.1) {
      this.camera.fov = lerp(this.camera.fov, preset.fov, 1 - Math.exp(-dt * 6));
      this.camera.updateProjectionMatrix();
    }
    this.camPunch = Math.max(0, (this.camPunch || 0) - dt * 0.65);
    const punch = this.settings.shake ? (this.camPunch || 0) * 0.4 : 0;
    const trialDist = this.ambushTrial && this.camera.aspect < 0.8 ? 47 : 0;
    const baseDist = this.camDistOverride || trialDist || (this.interior ? 17 : this.photoMode ? 18 : this.state === 'title' ? 40 : 37);
    const dist = baseDist * (this.interior ? 1 : (this.camZoom || 1)) * (1 + (this.tide?.zoomBonus || 0)) * (1 - punch);
    const yaw = this.state === 'title' ? 0.45 : (this.camYaw ?? 0.62);
    const horiz = dist * preset.zK;
    this.camera.position.set(
      this.camPos.x + Math.sin(yaw) * horiz + (Math.random() - 0.5) * s,
      this.camY + dist * preset.yK,
      this.camPos.z + Math.cos(yaw) * horiz + (Math.random() - 0.5) * s,
    );
    this.camera.lookAt(this.camPos.x, this.camY + (preset.fov >= 34 ? 0.5 : 0), this.camPos.z);
    this.sun.position.set(this.camPos.x - 12, 26, this.camPos.z + 8);
    this.sun.target.position.set(this.camPos.x, 0, this.camPos.z);
  }

  // 大型建築／巨樹／拱門遮擋人物視野時，透過鏡頭→玩家射線自動半透明透視（節流每 3 幀射線，降低 67% CPU 負荷）
  updateOcclusion(dt) {
    if (this.state !== 'play' || this.interior) { this._playerOccluded = false; return; }
    this._occFrame = (this._occFrame || 0) + 1;
    let hitMats = this._lastHitMats || new Set();
    if (this._occFrame % 3 === 1) {
      hitMats = new Set();
      const targets = [...(this.world?.occludables || []), ...(this.exits || []).map(x => x.g)];
      if (this.townGroup) targets.push(this.townGroup);
      if (targets.length) {
        const p = this.player;
        const camP = this.camera.position;
        const offsets = [[0, 1.0, 0], [-0.45, 0.9, 0], [0.45, 0.9, 0]];
        for (const [ox, oy, oz] of offsets) {
          tmp3.set(p.pos.x + ox - camP.x, p.y + oy - camP.y, p.pos.z + oz - camP.z);
          const maxDist = tmp3.length() - 0.5;
          if (maxDist <= 0.5) continue;
          tmp3.normalize();
          this.ray.set(camP, tmp3);
          this.ray.far = maxDist;
          const hits = this.ray.intersectObjects(targets, true);
          for (const h of hits) {
            const m = h.object;
            if (!m.isMesh || m.userData?.noNormal || h.point.y <= p.y + 0.35) continue;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) if (mat && 'opacity' in mat) hitMats.add(mat);
          }
        }
        this.ray.far = Infinity;
      }
      this._lastHitMats = hitMats;
      this._playerOccluded = hitMats.size > 0;
    }
    for (const mat of hitMats) {
      if (!this._fadedMats.has(mat)) this._fadedMats.set(mat, { origTrans: mat.transparent, origDepth: mat.depthWrite });
      mat.transparent = true; mat.depthWrite = false;
      mat.opacity = lerp(mat.opacity ?? 1, 0.24, 1 - Math.exp(-dt * 14));
    }
    for (const [mat, orig] of [...this._fadedMats.entries()]) {
      if (hitMats.has(mat)) continue;
      mat.opacity = lerp(mat.opacity ?? 1, 1, 1 - Math.exp(-dt * 12));
      if (mat.opacity > 0.98) {
        mat.opacity = 1; mat.transparent = orig.origTrans; mat.depthWrite = orig.origDepth;
        this._fadedMats.delete(mat);
      }
    }
  }
  triggerTideDemo(stage) { triggerTideDemo(this, stage); }
}
