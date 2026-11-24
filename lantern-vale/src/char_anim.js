// Phase C2：骨骼動畫狀態機（支援 5 大職業獨立動畫組與平滑 CrossFade 過渡）
import * as THREE from 'three';

const STATE_ALIASES = {
  idle:       ['Idle', 'CombatIdle'],
  combatIdle: ['CombatIdle', 'Idle'],
  walk:       ['Walk', 'Run'],
  run:        ['Run', 'Walk'],
  jump:       ['Jump', 'Fall', 'Falling'],
  fall:       ['Falling', 'Fall', 'Jump'],
  attack:     ['Attack', 'attack', 'SkillAttack'],
  runAttack:  ['RunAttack', 'Attack', 'attack'],
  skill:      ['SkillAttack', 'CastEnd', 'Attack', 'attack'],
  cast:       ['CastingLoop', 'CastLoop', 'Buff'],
  buff:       ['Buff', 'SkillAttack', 'Idle'],
  block:      ['BlockingLoop', 'Blocking', 'CombatIdle'],
  gather:     ['Gathering', 'Attack', 'attack'],
  hit:        ['GetHit', 'CombatIdle'],
  death:      ['Death'],
};

const ONE_SHOT_STATES = new Set(['attack', 'runAttack', 'skill', 'buff', 'hit', 'death', 'jump']);

export class CharAnimator {
  constructor(root) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = new Map();
    this.actions = new Map();
    this.curState = null;
    this.curAction = null;
    this.lockTimer = 0;
    this.archetype = null;
  }

  setClips(clipList, archetype = 'fighter') {
    if (this.archetype === archetype && this.clips.size > 0) return;
    this.mixer.stopAllAction();
    this.clips.clear();
    this.actions.clear();
    this.curAction = null;
    this.curState = null;
    this.archetype = archetype;
    for (const clip of clipList || []) {
      this.clips.set(clip.name, clip);
    }
    this.play('idle', { force: true, fade: 0.01 });
  }

  _resolveClip(state) {
    const names = STATE_ALIASES[state] || [state];
    for (const n of names) {
      if (this.clips.has(n)) return this.clips.get(n);
    }
    return this.clips.values().next().value || null;
  }

  play(state, opts = {}) {
    if (!this.clips.size) return false;
    const isOneShot = opts.once ?? ONE_SHOT_STATES.has(state);
    if (!opts.force && this.lockTimer > 0 && !isOneShot && state !== 'death') return false;
    if (!opts.force && this.curState === state && !isOneShot) return true;

    const clip = this._resolveClip(state);
    if (!clip) return false;
    let next = this.actions.get(clip.name);
    if (!next) {
      next = this.mixer.clipAction(clip);
      this.actions.set(clip.name, next);
    }

    const fade = opts.fade ?? (isOneShot ? 0.08 : 0.16);
    const speed = opts.speed ?? 1.0;
    next.setEffectiveTimeScale(speed);
    next.setEffectiveWeight(1);

    if (isOneShot) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = state === 'death';
      next.reset();
      this.lockTimer = Math.max(0.18, (clip.duration / Math.max(0.4, speed)) * (opts.lockFrac ?? 0.72));
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }

    if (this.curAction && this.curAction !== next) {
      next.enabled = true;
      next.play();
      this.curAction.crossFadeTo(next, fade, false);
    } else {
      next.enabled = true;
      next.play();
    }
    this.curAction = next;
    this.curState = state;
    return true;
  }

  update(dt) {
    if (this.lockTimer > 0) this.lockTimer = Math.max(0, this.lockTimer - dt);
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.clips.clear();
  }
}
