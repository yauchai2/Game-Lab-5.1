// Layered contact sounds. Frequencies and tails describe the material underfoot.
const CONTACT = {
  grass: { low: 132, texture: 1750, tail: 0.062, grit: 0.11 },
  stone: { low: 205, texture: 1060, tail: 0.048, grit: 0.11 },
  wood:  { low: 168, texture: 670,  tail: 0.082, grit: 0.09 },
  sand:  { low: 105, texture: 1350, tail: 0.095, grit: 0.12 },
  water: { low: 310, texture: 2200, tail: 0.105, grit: 0.17 },
  ice:   { low: 260, texture: 2900, tail: 0.084, grit: 0.13 },
  mud:   { low: 90,  texture: 410,  tail: 0.110, grit: 0.15 },
};

export function playContact(audio, surface, strength, hoof) {
  const { low, texture, tail, grit } = CONTACT[surface] || CONTACT.grass;
  const t = audio.ctx.currentTime;
  const pitch = low * (0.90 + Math.random() * 0.20);
  audio.noise(t, tail, grit * strength, texture, audio.sfxBus, 0, 'bandpass');
  audio.tone(hoof || surface === 'wood' ? 'triangle' : 'sine', pitch, pitch * 0.62, tail * 0.8, strength * 0.09);
  if (hoof || surface === 'water' || surface === 'ice') {
    audio.noise(t + 0.028, tail * 0.74, grit * strength * 0.54, texture * 1.4, audio.sfxBus, 0, 'bandpass');
  }
}

export const WEAPON_CUES = { staff: 'staffSwing', bow: 'bowRelease', blades: 'bladeSwipe', shield: 'shieldBash' };

// Small casting accents sit underneath the stronger impact/release sound of each skill.
export const CAST_ACCENTS = {
  holy:     ['sine', 493, 988, 0.15, 0.046],
  wind:     ['triangle', 295, 660, 0.12, 0.052],
  fire:     ['triangle', 174, 392, 0.14, 0.065],
  bluefire: ['sine', 262, 588, 0.16, 0.061],
  frost:    ['sine', 1480, 1175, 0.15, 0.042],
  thunder:  ['triangle', 526, 132, 0.12, 0.062],
  death:    ['triangle', 196, 82, 0.19, 0.055],
  lotus:    ['sine', 587, 880, 0.21, 0.055],
  arcane:   ['sine', 392, 784, 0.18, 0.050],
};
