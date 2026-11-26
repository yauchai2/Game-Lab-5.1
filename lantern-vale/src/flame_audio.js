// Beaconfall lamp audio: turns Flame events (flame.js onFlame) into synthesized cues. No DOM, no THREE, no state of its own.
// Tune the cues in audio.js (sfx names below); thresholds here only decide *which* events are worth a sound.
import { onFlame } from './flame.js';

export const FLAME_AUDIO_RULES = {
  gainMin: 3,      // below this a gain is a basic hit; silent (it happens many times a second)
  spendMin: 10,    // ultimates (20) and boss moves cue; Hollow hits (4% of max) do not
};

let wired = null;
/** Subscribe once. Safe to call again with the same audio object (hot reload, tests). */
export function wireFlameAudio(audio) {
  if (!audio || wired === audio) return;
  wired?.off?.forEach(fn => fn());
  const R = FLAME_AUDIO_RULES, play = (name, v) => { try { audio.sfx(name, v); } catch (e) { /* audio must never break a frame */ } };
  const off = [
    onFlame('gain', e => { if (e.amount >= R.gainMin) play('flameGain', Math.min(1, e.amount / 25)); }),
    onFlame('spend', e => { if (e.amount >= R.spendMin) play('flameSpend'); }),
    onFlame('empty', () => play('flameOut')),
    onFlame('dim', e => { if (e.to > e.from) play('dimIn', e.to); else if (e.to < e.from) play('dimOut'); }),
    onFlame('enterLight', () => play('enterLight')),
    onFlame('leaveLight', () => play('leaveLight')),
    onFlame('respawn', () => play('lanternRespawn')),
  ];
  wired = audio; wired.off = off;
}
