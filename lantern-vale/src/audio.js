// Playback of packaged source recordings. Web Audio handles mixing and filtering.
import { CAST_ACCENTS, FOOTSTEPS, SFX } from './action_audio.js';
import clips from './audio_clips.json';
import { DIM_FILTER_HZ, musicTrackFor } from './music_themes.js';

const MUSIC_DIR = 'assets/audio/music/';
const holdGain = (gain, now) => {
  if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
  else {
    const value = gain.value;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(value, now);
  }
};
const SFX_LIMIT = 20;
const CUE_INTERVAL = {
  hit: 0.045, crit: 0.06, enemyDie: 0.09, hover: 0.09, enemyWind: 0.14,
  enemyRelease: 0.10, enemyCast: 0.13, rustle: 0.2, flameGain: 0.4, flameSpend: 0.25,
  enterLight: 1.2, leaveLight: 1.2, dimIn: 0.6, dimOut: 0.6, xpGem: 0.045,
};
const choose = list => list[Math.floor(Math.random() * list.length)];

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterVol = 0.9;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.dim = 0;
    this.tide = 0;
    this.last = Object.create(null);
    this.voices = 0;
    try { this.muted = localStorage.getItem('lv_mute') === '1'; } catch {}
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      if (this.localMusic?.paused) this.localMusic.play().catch(() => {});
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    this.ctx = new Context();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.dimFilter = this.ctx.createBiquadFilter();
    this.dimFilter.type = 'lowpass';
    this.dimFilter.frequency.value = DIM_FILTER_HZ[this.dim];
    this.dimFilter.Q.value = 0.4;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 4;
    this.musicBus.connect(this.dimFilter).connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(limiter).connect(this.ctx.destination);
    this.setVolumes(this.masterVol, this.musicVol, this.sfxVol);
    this.ctx.resume().catch(() => {});
    const bytes = Uint8Array.from(atob(__LV_EFFECTS_B64__), c => c.charCodeAt(0));
    this.effectsReady = this.ctx.decodeAudioData(bytes.buffer).then(buffer => {
      this.effects = buffer;
      this.startGlide();
    }).catch(error => console.warn('Beaconfall audio effects could not be decoded', error));
    if (this.mode) this.selectTrack();
  }

  setVolumes(master, music, sfx) {
    this.masterVol = master; this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : master;
    this.musicBus.gain.value = music * 0.72;
    this.sfxBus.gain.value = sfx * 0.85;
    if (this.localMusic) this.localMusic.volume = this.muted ? 0 : master * music * 0.72;
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('lv_mute', this.muted ? '1' : '0'); } catch {}
    this.setVolumes(this.masterVol, this.musicVol, this.sfxVol);
    return this.muted;
  }

  setMusic(mode, intensity = 0, { tide = 0 } = {}) {
    this.mode = mode;
    this.tide = tide;
    if (this.ctx) this.selectTrack();
  }

  selectTrack() {
    const track = musicTrackFor(this.mode, this.tide);
    if (this.trackRequest?.track === track || this.failedTrack === track) return;
    this.failedTrack = null;
    this.trackRequest?.controller.abort();
    this.trackRequest = null;
    if (this.trackName === track) return;

    const url = MUSIC_DIR + track + '.mp3';
    if (location.protocol === 'file:') {
      this.localMusic?.pause();
      this.localMusic = new window.Audio(url);
      this.localMusic.loop = true;
      this.localMusic.volume = this.muted ? 0 : this.masterVol * this.musicVol * 0.72;
      this.localMusic.play().catch(() => {});
      this.trackName = track;
      return;
    }

    const controller = new AbortController();
    const request = { track, controller };
    this.trackRequest = request;
    fetch(url, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    }).then(bytes => {
      if (!controller.signal.aborted) return this.ctx.decodeAudioData(bytes);
    }).then(buffer => {
      if (this.trackRequest !== request) return;
      const t = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain).connect(this.musicBus);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + 0.52);
      source.start(t);
      if (this.music) {
        const old = this.music;
        holdGain(old.gain.gain, t);
        old.gain.gain.linearRampToValueAtTime(0, t + 0.36);
        old.source.stop(t + 0.38);
      }
      this.music = { source, gain };
      this.trackName = track;
      this.trackRequest = null;
    }).catch(error => {
      if (this.trackRequest !== request) return;
      this.trackRequest = null;
      this.failedTrack = track;
      console.warn(`Beaconfall music track ${track} could not be played`, error);
    });
  }

  setDim(value) {
    const dim = Math.max(0, Math.min(3, value | 0));
    if (dim === this.dim) return;
    this.dim = dim;
    this.dimFilter?.frequency.setTargetAtTime(DIM_FILTER_HZ[dim], this.ctx.currentTime, 0.45);
  }

  setGlide(active) {
    if (this.glideActive === active) return;
    this.glideActive = active;
    if (active) this.startGlide();
    else if (this.glide) {
      const { source, gain } = this.glide;
      const time = this.ctx.currentTime;
      holdGain(gain.gain, time);
      gain.gain.linearRampToValueAtTime(0, time + 0.15);
      source.stop(time + 0.17);
      this.glide = null;
    }
  }

  startGlide() {
    if (!this.glideActive || !this.effects || this.glide) return;
    const [start, length] = clips.windLoop;
    const time = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = this.effects;
    source.loop = true;
    source.loopStart = start;
    source.loopEnd = start + length;
    source.connect(gain).connect(this.sfxBus);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.22);
    source.start(time, start);
    this.glide = { source, gain };
  }

  playClip(name, volume, rate = 1) {
    if (!this.ctx || this.muted || this.sfxVol <= 0) return;
    if (!this.effects) {
      const requestedAt = performance.now();
      this.effectsReady?.then(() => {
        if (this.effects && performance.now() - requestedAt < 230) this.playClip(name, volume, rate);
      });
      return;
    }
    if (this.ctx.state !== 'running' || this.voices >= SFX_LIMIT) return;
    const clip = clips[name];
    if (!clip) return;
    const [start, length] = clip;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = this.effects;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain).connect(this.sfxBus);
    this.voices++;
    source.onended = () => { this.voices--; source.disconnect(); gain.disconnect(); };
    source.start(this.ctx.currentTime, start, length);
  }

  contact(surface, strength = 0.7, hoof = false) {
    const variants = FOOTSTEPS[hoof ? 'hoof' : surface] || FOOTSTEPS.grass;
    this.playClip(choose(variants), strength * 0.7, 0.94 + Math.random() * 0.12);
  }

  castAccent(theme) {
    const variants = CAST_ACCENTS[theme] || CAST_ACCENTS.arcane;
    this.playClip(choose(variants), 0.22);
  }

  sfx(name, strength = 1) {
    const cue = SFX[name];
    if (!cue || !this.ctx || this.muted || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const interval = CUE_INTERVAL[name];
    if (interval && now - (this.last[name] ?? -Infinity) < interval) return;
    this.last[name] = now;
    const [volume, ...variants] = cue;
    this.playClip(choose(variants), volume * Math.max(0.1, Math.min(strength, 1.4)));
  }
}
