// Phase C2：骨骼動畫狀態機（支援 5 大職業獨立動畫組與平滑 CrossFade 過渡）
import * as THREE from 'three';

const STATE_ALIASES = {
  // 持武角色預設皆以 CombatIdle 作為自然持武待機（避免未持武 Idle/A-Pose 造成武器垂直懸空於身旁）
  idle:       ['CombatIdle', 'Idle'],
  combatIdle: ['CombatIdle', 'Idle'],
  walk:       ['Walk', 'Run'],
  run:        ['Run', 'Walk'],
  runBack:    ['Run', 'Walk'],
  runL:       ['Run', 'Walk'],
  runR:       ['Run', 'Walk'],
  jump:       ['Jump', 'Fall', 'Falling'],
  fall:       ['Falling', 'Fall', 'Jump'],
  attack:     ['Attack', 'attack', 'SkillAttack'],
  runAttack:  ['RunAttack', 'Attack', 'attack'],
  skill:      ['SkillAttack', 'CastEnd', 'Attack', 'attack'],
  cast:       ['CastingLoop', 'CastLoop', 'Buff'],
  buff:       ['Buff', 'SkillAttack', 'CombatIdle'],
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
    this._pose = null;
    this._returnPose = null;
    this._isOneShot = false;
    this._poseClock = 0;
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
    this._pose = null;
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
      // 永遠 clampWhenFinished=true，避免播完瞬間歸零成硬直 A-Pose 與武器垂直懸空！
      next.clampWhenFinished = true;
      next.reset();
      this.lockTimer = Math.max(0.18, (clip.duration / Math.max(0.4, speed)) * (opts.lockFrac ?? 0.72));
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    this._isOneShot = isOneShot;

    if (this.curAction && this.curAction !== next) {
      next.enabled = true;
      next.paused = false;
      next.play();
      this.curAction.crossFadeTo(next, fade, false);
    } else {
      next.enabled = true;
      next.paused = false;
      next.play();
    }
    this.curAction = next;
    this.curState = state;
    return true;
  }

  /**
   * Phase D1：定格英雄招牌展示 Pose（精準定位動畫關鍵幀＋極微幅呼吸擺動，不彈跳不歸零）
   */
  setShowcasePose(state, normTime = 0.45, breatheAmp = 0.008) {
    if (!this.clips.size) return false;
    const clip = this._resolveClip(state);
    if (!clip) return false;
    this.mixer.stopAllAction();
    let act = this.actions.get(clip.name);
    if (!act) {
      act = this.mixer.clipAction(clip);
      this.actions.set(clip.name, act);
    }
    const baseTime = Math.max(0.01, Math.min(clip.duration - 0.02, clip.duration * normTime));
    act.enabled = true;
    act.setEffectiveWeight(1);
    act.setEffectiveTimeScale(1);
    act.setLoop(THREE.LoopRepeat, Infinity);
    act.play();
    act.time = baseTime;
    act.paused = true;
    this.mixer.update(0);
    this.curAction = act;
    this.curState = state;
    this._isOneShot = false;
    this._pose = { act, baseTime, amp: breatheAmp, dur: clip.duration };
    this._returnPose = { state, normTime, breatheAmp };
    return true;
  }

  update(dt) {
    if (this._pose) {
      this._poseClock += dt;
      const t = Math.max(0.005, Math.min(this._pose.dur - 0.01, this._pose.baseTime + Math.sin(this._poseClock * 1.8) * this._pose.amp));
      this._pose.act.time = t;
      this.mixer.update(0);
      return;
    }
    if (this.lockTimer > 0) this.lockTimer = Math.max(0, this.lockTimer - dt);
    this.mixer.update(dt);
    // 單次動作（如攻擊／技能／歡呼）播畢後自動平滑接回展示 Pose 或自然持武待機，徹底杜絕硬直 A-Pose！
    if (this._isOneShot && this.curState !== 'death' && this.curAction) {
      const dur = this.curAction.getClip()?.duration || 0;
      if (dur > 0 && this.curAction.time >= dur - 0.03) {
        this._isOneShot = false;
        if (this._returnPose) {
          this.setShowcasePose(this._returnPose.state, this._returnPose.normTime, this._returnPose.breatheAmp);
        } else {
          this.play('combatIdle', { force: true, fade: 0.22 });
        }
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.clips.clear();
  }
}
