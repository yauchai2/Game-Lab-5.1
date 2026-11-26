// Procedural audio (WebAudio): zero downloads, zero licensing. Cozy chiptune-ish music + synthesized SFX.
// Music recipes live in music_themes.js (per-region themes, Ember Tide layers, Dimming filter); direction doc: docs/beaconfall/AUDIO.md.
import { THEMES, effectiveTheme, DIM_FILTER_HZ, DIM_DRONE_VOL } from './music_themes.js';
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null; this.muted = false; this.musicVol = 0.5; this.sfxVol = 0.8; this.masterVol = 0.9;
    this.mode = null; this.nextMode = null; this.tide = 0; this.dim = 0; this.intensity = 0; this.step = 0; this.nextT = 0; this.timer = null; this.last = {};
    try { this.muted = localStorage.getItem('lv_mute') === '1'; } catch (e) { /* ignore */ }
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.masterVol;
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.5;
    // musicBus -> musicFade (mode crossfades) -> dimFilter (Dimming darkens the same music) -> master
    this.musicFade = this.ctx.createGain(); this.musicFade.gain.value = 1;
    this.dimFilter = this.ctx.createBiquadFilter(); this.dimFilter.type = 'lowpass'; this.dimFilter.frequency.value = DIM_FILTER_HZ[0]; this.dimFilter.Q.value = 0.4;
    this.musicBus.connect(this.musicFade); this.musicFade.connect(this.dimFilter); this.dimFilter.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxVol * 0.6; this.sfxBus.connect(this.master);
    // simple reverb-ish delay for music
    this.delay = this.ctx.createDelay(); this.delay.delayTime.value = 0.28;
    const fb = this.ctx.createGain(); fb.gain.value = 0.3; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(this.musicBus);
    // noise buffer
    const len = this.ctx.sampleRate; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // continuous beds: wind (Whisperwood, Rimewind) and the cold pedal that fades in with Dimming stacks
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
    const wsrc = this.ctx.createBufferSource(); wsrc.buffer = buf; wsrc.loop = true;
    const wbp = this.ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 700; wbp.Q.value = 0.6;
    wsrc.connect(wbp); wbp.connect(this.windGain); this.windGain.connect(this.musicBus); wsrc.start();
    this.dimDrone = this.ctx.createGain(); this.dimDrone.gain.value = 0; this.dimDrone.connect(this.musicBus);
    this.dimOscs = [0, 1.4].map(off => { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(33) + off; o.connect(this.dimDrone); o.start(); return o; });
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
    if (this.pending) { const pm = this.pending; this.pending = null; this.setMusic(...pm); }
  }
  setVolumes(master, music, sfx) {
    this.masterVol = master; this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : master; this.musicBus.gain.value = music * 0.5; this.sfxBus.gain.value = sfx * 0.6;
  }
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('lv_mute', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVol;
    return this.muted;
  }
  /** mode = theme key (see music_themes.js). opts.tide = Ember Tide phase (-1 Calm Ebb, 0..3). Safe to call every frame. */
  setMusic(mode, intensity = 0, opts = {}) {
    if (!this.ctx) { this.pending = [mode, intensity, opts]; return; }
    this.intensity = intensity; this.tide = opts.tide || 0;
    if (mode === this.mode) { if (this.nextMode) this.cancelFade(); return; }
    if (mode === this.nextMode) return;
    if (!this.mode) { this.applyMode(mode, 0.6); return; }
    // different theme: fade the old one out, then start the new one from its first bar
    this.nextMode = mode;
    const g = this.musicFade.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setTargetAtTime(0.0001, now, 0.09);
    clearTimeout(this._fadeT);
    this._fadeT = setTimeout(() => { const m = this.nextMode; this.nextMode = null; if (m) this.applyMode(m, 1.1); }, 380);
  }
  cancelFade() {
    clearTimeout(this._fadeT); this.nextMode = null;
    const g = this.musicFade.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setTargetAtTime(1, now, 0.25);
  }
  applyMode(mode, fadeIn) {
    this.mode = mode; this.step = 0; this.chordIdx = 0;
    const T = THEMES[mode] || THEMES.meadow, now = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(T.wind ? 0.05 : 0, now, 0.6);
    for (const o of this.dimOscs) o.frequency.setTargetAtTime(mtof(T.root - 24) + (o === this.dimOscs[1] ? 1.4 : 0), now, 0.3);
    const g = this.musicFade.gain; g.cancelScheduledValues(now); g.setValueAtTime(0.0001, now); g.linearRampToValueAtTime(1, now + fadeIn);
  }
  /** Dimming stacks 0..3: the same music loses its highs and a cold pedal beats underneath. */
  setDim(stacks = 0) {
    const d = Math.max(0, Math.min(3, stacks | 0));
    if (d === this.dim || !this.ctx) { this.dim = d; return; }
    this.dim = d; const now = this.ctx.currentTime;
    this.dimFilter.frequency.setTargetAtTime(DIM_FILTER_HZ[d], now, 0.7);
    this.dimDrone.gain.setTargetAtTime(DIM_DRONE_VOL[d], now, 1.2);
  }
  // ---------- music scheduler ----------
  schedule() {
    if (!this.ctx || !this.mode || this.muted) { if (this.ctx) this.nextT = Math.max(this.nextT, this.ctx.currentTime); return; }
    while (this.nextT < this.ctx.currentTime + 0.25) {
      const S = effectiveTheme(this.mode, this.tide);
      const spb = 60 / S.bpm / 2; // eighth note
      this.playStep(S, this.nextT, spb);
      this.nextT += spb; this.step++;
    }
  }
  note(type, freq, t, dur, vol, bus = this.musicBus, send = 0) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); if (send) { const s = this.ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(this.delay); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, vol, hp, bus = this.sfxBus, lpf = 0) {
    const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = lpf ? 'lowpass' : 'highpass'; f.frequency.value = lpf || hp;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
  }
  sweep(type, f0, f1, t, dur, vol, bus = this.musicBus) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  /** Slow detuned swell (the Elderwood "choir" and the title pad). */
  swell(freq, t, dur, vol) {
    for (const cents of [-7, 0, 7]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq; o.detune.value = cents;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol / 3, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.musicBus); const s = this.ctx.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.delay);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }
  bellNote(freq, t, dur, vol) {
    this.note('sine', freq, t, dur, vol, this.musicBus, 0.55);
    this.note('sine', freq * 2.76, t, dur * 0.35, vol * 0.22, this.musicBus, 0.3);
  }
  percStep(S, inBar, t, fight) {
    let mode = S.perc || 'none';
    if (mode === 'none' && fight) mode = 'light';
    const bus = this.musicBus;
    switch (mode) {
      case 'light':
        if (fight) { if (inBar % 4 === 0) this.noise(t, 0.12, 0.35, 0, bus, 160); if (inBar % 4 === 2) this.noise(t, 0.05, 0.12, 6000, bus); }
        else if (inBar % 4 === 2) this.noise(t, 0.04, 0.05, 7000, bus);
        break;
      case 'wood': // Whisperwood: soft knocks
        if (inBar % 4 === 0) this.sweep('sine', 360, 240, t, 0.07, 0.09);
        else if (inBar % 8 === 6) this.sweep('sine', 480, 320, t, 0.06, 0.06);
        if (fight && inBar % 4 === 2) this.noise(t, 0.05, 0.12, 6000, bus);
        break;
      case 'hand': // Sandveil, Lost Vines: dum and tek
        if (inBar === 0 || inBar === 6 || inBar === 10) { this.sweep('sine', 150, 80, t, 0.14, 0.2); this.noise(t, 0.05, 0.1, 0, bus, 400); }
        if (inBar === 3 || inBar === 11 || inBar === 14) this.noise(t, 0.04, 0.14, 4500, bus);
        break;
      case 'taiko': // Cinderreach, bosses, Surge/Apex: deep drum
        if (inBar === 0 || inBar === 8) { this.sweep('sine', 120, 42, t, 0.32, 0.38); this.noise(t, 0.12, 0.3, 0, bus, 200); }
        if (inBar === 12 || (fight && inBar === 4)) { this.sweep('sine', 150, 60, t, 0.2, 0.22); }
        if (inBar % 2 === 1 && (fight || S.war)) this.noise(t, 0.03, 0.06, 8000, bus);
        break;
      case 'pulse': // Blackout, Hive Dark: machine tick
        if (inBar % 2 === 0) this.noise(t, 0.025, 0.07, 7000, bus);
        if (inBar === 0 || inBar === 8) this.sweep('square', 110, 80, t, 0.1, 0.07);
        break;
      default: break;
    }
  }
  playStep(S, t, spb) {
    const bar = Math.floor(this.step / 16), inBar = this.step % 16;
    const prog = S.prog || [0, 3, 4, 2, 0, 4, 3, 1]; // scale-degree roots per bar
    const deg = prog[bar % prog.length];
    const sc = S.steps, n = sc.length;
    const degNote = (d, oct = 0) => S.root + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + oct);
    const fight = this.intensity > 0.3, boss = this.mode === 'boss';
    const leadType = S.lead || (S.wave === 'sawtooth' ? 'square' : 'triangle');
    // ---- pad / bass at bar start ----
    if (inBar === 0) {
      if (S.choir) {
        for (const off of [0, 2, 4]) this.swell(mtof(degNote(deg + off, -1)), t, spb * 16, 0.13);
      } else {
        for (const off of [0, 2, 4]) this.note(S.wave === 'sawtooth' ? 'triangle' : 'sine', mtof(degNote(deg + off, -1)), t, spb * 15, 0.10, this.musicBus, 0.25);
      }
      this.note('triangle', mtof(degNote(deg, -2)), t, spb * 7, 0.17);
      if (S.drone) this.note('sine', mtof(S.root + 12 * S.drone.oct), t, spb * 16.5, S.drone.vol);
      if (S.war >= 2) this.note('sawtooth', mtof(degNote(deg, -2)), t, spb * 3, 0.07); // Apex: brass stab on the bar
    }
    if (inBar === 8 && !S.choir) this.note('triangle', mtof(degNote(deg + 2, -2)), t, spb * 6, 0.13);
    if (S.heartbeat && (inBar === 0 || inBar === 2)) this.sweep('sine', 90, 45, t, 0.18, inBar === 0 ? 0.3 : 0.2);
    // ---- fixed motif (title) ----
    if (S.motif) {
      const mb = bar % S.motifBars;
      for (const m of S.motif) if (m.bar === mb && m.at === inBar) this.bellNote(mtof(degNote(m.deg, m.oct ?? 0)), t, spb * m.len, 0.11);
    } else {
      // ---- lead ----
      const pat = S.pat;
      if (inBar % 2 === 0 || fight) {
        const idx = pat[(inBar >> 1) % pat.length] + (inBar % 4 === 3 ? 1 : 0);
        const open = (Math.sin(this.step * 0.37 + bar) * 0.5 + 0.5) < S.density;
        if (boss || fight || open) {
          const f = mtof(degNote(deg + idx, S.leadOct ?? 1));
          const v = (S.warm ? 0.06 : 0.075) + this.intensity * 0.03;
          if (S.bell) this.bellNote(f, t, spb * 5, v * 0.9);
          else if (S.pluck) this.note(leadType, f, t, spb * 0.9, v * 1.1, this.musicBus, 0.3);
          else this.note(S.warm ? 'sine' : leadType, f, t, spb * 1.8, v, this.musicBus, 0.35);
        }
      }
    }
    // ---- colour ----
    if (S.bubbles && Math.random() < 0.1) this.note('sine', mtof(S.root + 24 + sc[(Math.random() * n) | 0]), t, 0.12, 0.05, this.musicBus, 0.4);
    // ---- percussion ----
    this.percStep(S, inBar, t, fight || boss);
    if (S.war >= 1 && (inBar === 6 || inBar === 10 || (S.war >= 2 && inBar === 14))) this.sweep('sine', 100, 50, t, 0.16, 0.2); // war toms
  }
  // ---------- SFX ----------
  tone(type, f0, f1, dur, vol, delay = 0) {
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  sfx(name, v = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const lim = { hit: 0.04, step: 0.18, enemyDie: 0.05, crit: 0.05, hover: 0.075, flameGain: 0.4, flameSpend: 0.25, enterLight: 1.2, leaveLight: 1.2, dimIn: 0.6, dimOut: 0.6 }[name]; // rate limit
    if (lim && this.last[name] && now - this.last[name] < lim) return; this.last[name] = now;
    const t = now;
    switch (name) {
      case 'swing': this.noise(t, 0.14, 0.5, 1800); this.tone('triangle', 420, 160, 0.12, 0.12); break;
      case 'bolt': this.tone('square', 700, 180, 0.2, 0.1); this.noise(t, 0.1, 0.2, 3000); break;
      case 'hit': this.tone('square', 220, 90, 0.08, 0.14); this.noise(t, 0.06, 0.3, 1200); break;
      case 'crit': this.tone('square', 520, 880, 0.12, 0.14); this.tone('triangle', 1040, 1560, 0.15, 0.1, 0.04); this.noise(t, 0.08, 0.3, 2000); break;
      case 'enemyDie': this.tone('triangle', 360, 70, 0.28, 0.18); this.noise(t, 0.2, 0.3, 600); break;
      case 'bossDie': for (let i = 0; i < 6; i++) { this.tone('sawtooth', 300 - i * 30, 40, 0.5, 0.14, i * 0.12); this.noise(t + i * 0.12, 0.3, 0.4, 0, this.sfxBus, 900); } break;
      case 'hurt': this.tone('sawtooth', 300, 80, 0.25, 0.2); this.noise(t, 0.15, 0.35, 0, this.sfxBus, 1200); break;
      case 'roll': this.noise(t, 0.28, 0.35, 900); this.tone('sine', 300, 600, 0.22, 0.06); break;
      case 'jump': this.tone('square', 260, 520, 0.14, 0.09); break;
      case 'land': this.noise(t, 0.09, 0.4, 0, this.sfxBus, 500); this.tone('sine', 120, 60, 0.1, 0.12); break;
      case 'glide': this.noise(t, 0.4, 0.07, 2500); break;
      case 'climb': this.tone('triangle', 200 + Math.random() * 60, 150, 0.06, 0.07); break;
      case 'step': {
        const pitch = 135 + Math.random() * 45;
        this.noise(t, 0.045, 0.16 * v, 0, this.sfxBus, 950);
        this.tone('triangle', pitch, pitch * 0.55, 0.04, 0.08 * v);
        break;
      }
      case 'sprintStep': {
        const pitch = 185 + Math.random() * 55;
        this.noise(t, 0.055, 0.24 * v, 0, this.sfxBus, 1450);
        this.tone('triangle', pitch, pitch * 0.5, 0.045, 0.11 * v);
        break;
      }
      case 'sit': this.tone('triangle', 180, 120, 0.11, 0.1); this.noise(t + 0.03, 0.05, 0.09, 0, this.sfxBus, 500); break;
      case 'kick': this.tone('sine', 160, 65, 0.1, 0.16); this.noise(t, 0.06, 0.22, 0, this.sfxBus, 750); break;
      case 'synth': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f * 1.03, 0.28, 0.11, i * 0.045)); break;
      case 'wish': [880, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, 0.32, 0.09, i * 0.07)); this.noise(t, 0.12, 0.14, 0, this.sfxBus, 1800); break;
      case 'slam': this.tone('sawtooth', 160, 35, 0.5, 0.25); this.noise(t, 0.4, 0.5, 0, this.sfxBus, 800); break;
      case 'wisp': for (let i = 0; i < 4; i++) this.tone('sine', 880 + i * 220, 1200 + i * 220, 0.3, 0.06, i * 0.06); break;
      case 'flask': this.tone('sine', 300, 500, 0.12, 0.12); this.tone('sine', 400, 650, 0.14, 0.1, 0.1); this.noise(t + 0.2, 0.1, 0.15, 0, this.sfxBus, 900); break;
      case 'orb': this.tone('triangle', 660, 990, 0.1, 0.1); break;
      case 'pickup': this.tone('square', 520, 520, 0.07, 0.1); this.tone('square', 780, 780, 0.1, 0.1, 0.07); break;
      case 'drop0': this.tone('triangle', 600, 400, 0.12, 0.1); break;
      case 'drop1': this.tone('triangle', 700, 500, 0.15, 0.12); this.tone('triangle', 1000, 800, 0.2, 0.1, 0.08); break;
      case 'drop2': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.12, i * 0.07)); break;
      case 'drop3': [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.tone('square', f, f, 0.3, 0.09, i * 0.07)); break;
      case 'boon': [523, 659, 784].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.5, 0.12, i * 0.09)); break;
      case 'exit': [440, 554, 659, 880].forEach((f, i) => this.tone('sine', f, f, 0.4, 0.09, i * 0.08)); break;
      case 'warp': this.tone('sine', 200, 1200, 0.5, 0.12); this.noise(t, 0.5, 0.2, 2000); break;
      case 'ui': this.tone('square', 600, 800, 0.05, 0.07); break;
      case 'hover': this.tone('triangle', 520 + Math.random() * 55, 680, 0.032, 0.026); break;
      case 'chat': this.tone('sine', 900, 900, 0.06, 0.07); this.tone('sine', 1200, 1200, 0.08, 0.06, 0.06); break;
      case 'emote': this.tone('triangle', 500, 900, 0.15, 0.1); break;
      case 'warn': this.tone('square', 330, 330, 0.07, 0.07); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, i * 0.14)); break;
      case 'dead': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.5, 0.14, i * 0.22)); break;
      case 'roar': this.tone('sawtooth', 120, 60, 0.8, 0.22); this.noise(t, 0.7, 0.4, 0, this.sfxBus, 700); break;
      case 'updraft': this.noise(t, 0.55, 0.28, 1200); this.tone('sine', 280, 740, 0.45, 0.1); break;
      case 'ring': [587, 740, 880, 1175].forEach((f, i) => this.tone('triangle', f, f * 1.02, 0.28, 0.11, i * 0.055)); break;
      case 'chop': this.noise(t, 0.09, 0.38, 800); this.tone('triangle', 240, 110, 0.1, 0.14); break;
      case 'mine': this.tone('square', 920, 480, 0.09, 0.11); this.noise(t, 0.08, 0.25, 2400); break;
      case 'splash': this.noise(t, 0.24, 0.32, 0, this.sfxBus, 1400); this.tone('sine', 420, 680, 0.16, 0.08); break;
      case 'perfect': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.12, i * 0.05)); break;
      case 'door': this.tone('triangle', 190, 130, 0.16, 0.14); this.noise(t + 0.05, 0.1, 0.16, 0, this.sfxBus, 600); break;
      case 'classup': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.55, 0.14, i * 0.09)); break;
      case 'meteor': this.tone('sawtooth', 320, 48, 0.65, 0.22); this.noise(t + 0.2, 0.45, 0.45, 0, this.sfxBus, 650); break;
      case 'nova': this.tone('sine', 960, 320, 0.45, 0.14); this.noise(t, 0.35, 0.28, 2800); break;
      case 'prism': [784, 1047, 1319].forEach((f, i) => this.tone('sine', f, f * 1.15, 0.35, 0.1, i * 0.06)); break;
      case 'campfire': this.noise(t, 0.32, 0.24, 0, this.sfxBus, 900); this.tone('triangle', 220, 340, 0.22, 0.08); break;
      case 'photo': this.noise(t, 0.05, 0.3, 2500); this.tone('square', 1100, 720, 0.06, 0.07); break;
      case 'partBreak':
        this.noise(t, 0.22, 0.55, 0, this.sfxBus, 1400);
        this.tone('sawtooth', 260, 58, 0.28, 0.22);
        [587, 880, 1175].forEach((f, i) => this.tone('triangle', f, f * 1.04, 0.26, 0.12, 0.06 + i * 0.055));
        break;
      case 'shatter':
        this.noise(t, 0.16, 0.48, 3200);
        [1480, 1975, 2349].forEach((f, i) => this.tone('sine', f, f * 0.72, 0.14, 0.1, i * 0.025));
        break;
      case 'reaction':
        this.noise(t, 0.26, 0.42, 1600);
        this.tone('triangle', 340, 860, 0.22, 0.14);
        this.tone('sine', 680, 1320, 0.24, 0.1, 0.05);
        break;
      case 'corruptGod':
        [392, 523, 659, 988, 1319].forEach((f, i) => this.tone('triangle', f, f * 1.02, 0.45, 0.13, i * 0.07));
        this.noise(t + 0.1, 0.35, 0.22, 2400);
        break;
      case 'corruptBrick':
        this.noise(t, 0.3, 0.5, 0, this.sfxBus, 900);
        [240, 185, 130].forEach((f, i) => this.tone('sawtooth', f, f * 0.7, 0.25, 0.15, i * 0.07));
        break;
      case 'tideHorn':
        this.tone('sawtooth', 165, 220, 0.45, 0.16);
        this.tone('triangle', 220, 330, 0.55, 0.14, 0.12);
        this.noise(t + 0.05, 0.35, 0.22, 0, this.sfxBus, 900);
        break;
      case 'ultReady':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f * 1.04, 0.28, 0.13, i * 0.055));
        break;
      case 'ultFort':
        this.noise(t, 0.28, 0.45, 0, this.sfxBus, 700);
        [180, 240, 320].forEach((f, i) => this.tone('square', f, f * 0.65, 0.18, 0.14, i * 0.05));
        break;
      case 'ultHound':
        this.tone('sawtooth', 260, 420, 0.14, 0.16);
        this.tone('sawtooth', 320, 180, 0.22, 0.16, 0.14);
        this.noise(t + 0.05, 0.28, 0.28, 1200);
        break;
      case 'ultDaybreak':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('sine', f, f * 1.02, 0.55, 0.13, i * 0.05));
        this.noise(t + 0.1, 0.45, 0.25, 2200);
        break;
      case 'xpGem': {
        const now = performance.now();
        if (this._xpLastT && (now - this._xpLastT) < 550) this._xpStep = Math.min(11, (this._xpStep || 0) + 1);
        else this._xpStep = 0;
        this._xpLastT = now;
        const penta = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349];
        const f = penta[this._xpStep % penta.length];
        this.tone('sine', f, f * 1.12, 0.09, 0.075);
        break;
      }
      case 'jackpotTick':
        this.tone('triangle', 640 + Math.random() * 240, 880, 0.055, 0.09);
        break;
      case 'jackpotWin':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone('triangle', f, f * 1.03, 0.34, 0.13, i * 0.055));
        break;
      case 'evolve':
        [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone('sawtooth', f, f * 1.02, 0.42, 0.11, i * 0.048));
        this.noise(t + 0.08, 0.45, 0.22, 2600);
        break;
      case 'revive':
        [330, 440, 554, 659, 880].forEach((f, i) => this.tone('sine', f, f * 1.04, 0.5, 0.14, i * 0.06));
        break;
      case 'curseShrine':
        [240, 196, 165, 130].forEach((f, i) => this.tone('sawtooth', f, f * 0.92, 0.32, 0.12, i * 0.07));
        break;
      case 'lullCalm':
        [523, 659, 784, 659].forEach((f, i) => this.tone('sine', f, f, 0.48, 0.1, i * 0.11));
        break;
      // ---- Beaconfall lamp cues (Flame / light / Dimming); see docs/beaconfall/AUDIO.md ----
      case 'flameGain': this.tone('sine', 880 * (0.9 + v * 0.1), 1175, 0.16, 0.05); this.tone('sine', 1320, 1568, 0.12, 0.03, 0.05); break;
      case 'flameSpend': this.tone('sine', 560, 240, 0.32, 0.09); this.noise(t, 0.18, 0.12, 0, this.sfxBus, 1100); break;
      case 'flameOut': this.tone('triangle', 330, 96, 0.7, 0.13); this.noise(t + 0.05, 0.4, 0.12, 0, this.sfxBus, 500); this.tone('sine', 196, 130, 0.9, 0.06, 0.12); break;
      case 'dimIn': { // darkness deepens: lower and more dissonant each stack (v = new stack 1..3)
        const base = 150 / (1 + 0.18 * v);
        this.tone('sine', base, base * 0.72, 0.8, 0.15); this.tone('triangle', base * 1.414, base * 1.3, 0.7, 0.05, 0.05);
        this.noise(t, 0.4, 0.1, 0, this.sfxBus, 420 / v); break;
      }
      case 'dimOut': [392, 523, 659].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.4, 0.07, i * 0.07)); break;
      case 'enterLight': [392, 494, 587, 784].forEach((f, i) => this.tone('sine', f, f, 0.7, 0.06, i * 0.09)); this.noise(t, 0.3, 0.05, 0, this.sfxBus, 1600); break;
      case 'leaveLight': [494, 392].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.3, 0.045, i * 0.1)); break;
      case 'lanternLit': [659, 880, 1175, 1568].forEach((f, i) => { this.tone('sine', f, f, 0.95, 0.09, i * 0.09); this.tone('sine', f * 2.76, f * 2.76, 0.25, 0.02, i * 0.09); }); this.noise(t, 0.25, 0.1, 5000); break;
      case 'lanternRespawn': [262, 330, 392, 523, 659].forEach((f, i) => this.tone('sine', f, f * 1.02, 0.9, 0.1, i * 0.08)); this.noise(t, 0.5, 0.08, 0, this.sfxBus, 1200); break;
      case 'apexStart': // Ember Tide Apex: low brass hit + noise swell
        this.tone('sawtooth', 98, 49, 1.1, 0.2); this.tone('sawtooth', 147, 73, 0.9, 0.12, 0.04);
        [196, 247, 294].forEach(f => this.tone('sawtooth', f, f * 0.98, 0.7, 0.07, 0.1));
        this.noise(t, 0.9, 0.3, 0, this.sfxBus, 900); break;
      default: break;
    }
  }
}
