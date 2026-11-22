// Procedural audio (WebAudio): zero downloads, zero licensing. Cozy chiptune-ish music + synthesized SFX.
const SCALES = {
  meadow: { root: 57, steps: [0, 2, 4, 7, 9], bpm: 92, wave: 'triangle' },   // A major pentatonic
  autumn: { root: 55, steps: [0, 3, 5, 7, 10], bpm: 84, wave: 'triangle' },  // G minor pentatonic
  snow:   { root: 62, steps: [0, 2, 4, 7, 9], bpm: 70, wave: 'sine' },
  ember:  { root: 52, steps: [0, 3, 5, 7, 10], bpm: 100, wave: 'sawtooth' },
  town:   { root: 60, steps: [0, 2, 4, 7, 9], bpm: 98, wave: 'triangle' },
  boss:   { root: 50, steps: [0, 3, 5, 6, 7, 10], bpm: 128, wave: 'sawtooth' },
  title:  { root: 57, steps: [0, 2, 4, 7, 9], bpm: 78, wave: 'sine' },
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null; this.muted = false; this.musicVol = 0.5; this.sfxVol = 0.8; this.masterVol = 0.9;
    this.mode = null; this.intensity = 0; this.step = 0; this.nextT = 0; this.timer = null; this.last = {};
    try { this.muted = localStorage.getItem('lv_mute') === '1'; } catch (e) { /* ignore */ }
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.masterVol;
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.5; this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxVol * 0.6; this.sfxBus.connect(this.master);
    // simple reverb-ish delay for music
    this.delay = this.ctx.createDelay(); this.delay.delayTime.value = 0.28;
    const fb = this.ctx.createGain(); fb.gain.value = 0.3; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(this.musicBus);
    // noise buffer
    const len = this.ctx.sampleRate; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
    if (this.pending) this.setMusic(...this.pending);
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
  setMusic(mode, intensity = 0) {
    if (!this.ctx) { this.pending = [mode, intensity]; return; }
    if (mode !== this.mode) { this.mode = mode; this.step = 0; this.chordIdx = 0; }
    this.intensity = intensity;
  }
  // ---------- music scheduler ----------
  schedule() {
    if (!this.ctx || !this.mode || this.muted) { if (this.ctx) this.nextT = Math.max(this.nextT, this.ctx.currentTime); return; }
    const S = SCALES[this.mode] || SCALES.meadow;
    const spb = 60 / S.bpm / 2; // eighth note
    while (this.nextT < this.ctx.currentTime + 0.25) {
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
  playStep(S, t, spb) {
    const bar = Math.floor(this.step / 16), inBar = this.step % 16;
    const prog = [0, 3, 4, 2, 0, 4, 3, 1]; // scale-degree roots per bar
    const deg = prog[bar % prog.length];
    const sc = S.steps, n = sc.length;
    const degNote = (d, oct = 0) => S.root + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + oct);
    const calm = 1 - Math.min(1, this.intensity);
    // pad chord at bar start
    if (inBar === 0) {
      for (const off of [0, 2, 4]) this.note(S.wave === 'sawtooth' ? 'triangle' : 'sine', mtof(degNote(deg + off, -1)), t, spb * 15, 0.10, this.musicBus, 0.25);
      this.note('triangle', mtof(degNote(deg, -2)), t, spb * 7, 0.17);
    }
    if (inBar === 8) this.note('triangle', mtof(degNote(deg + 2, -2)), t, spb * 6, 0.13);
    // arpeggio / melody
    const pat = [0, 2, 1, 3, 2, 4, 3, 2];
    if (inBar % 2 === 0 || this.intensity > 0.4) {
      const idx = pat[(inBar >> 1) % pat.length] + (inBar % 4 === 3 ? 1 : 0);
      const gate = this.mode === 'boss' || this.intensity > 0.4 ? 1 : (Math.sin(this.step * 0.37 + bar) > -0.2 ? 1 : 0);
      if (gate) this.note(S.wave === 'sawtooth' ? 'square' : 'triangle', mtof(degNote(deg + idx, 1)), t, spb * 1.8, 0.075 + this.intensity * 0.03, this.musicBus, 0.35);
    }
    // percussion (combat / boss / town light)
    if (this.intensity > 0.3 || this.mode === 'boss') {
      if (inBar % 4 === 0) this.noise(t, 0.12, 0.35, 0, this.musicBus, 160);
      if (inBar % 4 === 2) this.noise(t, 0.05, 0.12, 6000, this.musicBus);
      if (this.mode === 'boss' && inBar % 2 === 1) this.noise(t, 0.03, 0.06, 8000, this.musicBus);
    } else if (this.mode === 'town' && inBar % 4 === 2) this.noise(t, 0.04, 0.05, 7000, this.musicBus);
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
    const lim = { hit: 0.04, step: 0.18, enemyDie: 0.05, crit: 0.05 }[name]; // rate limit
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
      case 'step': this.noise(t, 0.04, 0.12 * v, 0, this.sfxBus, 700); break;
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
      case 'chat': this.tone('sine', 900, 900, 0.06, 0.07); this.tone('sine', 1200, 1200, 0.08, 0.06, 0.06); break;
      case 'emote': this.tone('triangle', 500, 900, 0.15, 0.1); break;
      case 'warn': this.tone('square', 330, 330, 0.07, 0.07); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, i * 0.14)); break;
      case 'dead': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.5, 0.14, i * 0.22)); break;
      case 'roar': this.tone('sawtooth', 120, 60, 0.8, 0.22); this.noise(t, 0.7, 0.4, 0, this.sfxBus, 700); break;
      default: break;
    }
  }
}
