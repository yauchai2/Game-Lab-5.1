// Event routing for the samples in game/assets/audio/effects.mp3.
export const WEAPON_CUES = { staff: 'staffSwing', bow: 'bowRelease', blades: 'bladeSwipe', shield: 'shieldBash' };

export const FOOTSTEPS = {
  grass: ['leaf1', 'leaf2'], stone: ['stone1', 'stone2'], wood: ['wood1', 'wood2', 'wood3'],
  sand: ['gravel', 'sand'], water: ['water1', 'water2'], ice: ['ice1', 'ice2'],
  mud: ['mud', 'mud2'], hoof: ['hoof1', 'hoof2'],
};

export const CAST_ACCENTS = {
  holy: ['light'], wind: ['windCast'], fire: ['fire'], bluefire: ['fire2'],
  frost: ['iceCast'], thunder: ['thunder'], death: ['shadow'], lotus: ['heal'], arcane: ['magic'],
};

// [mix level, sample choices]. Short UI clicks sit below combat and danger cues.
export const SFX = {
  swing: [0.58, 'swing1'], staffSwing: [0.62, 'swing1', 'swing2'], bowRelease: [0.67, 'bow'],
  bladeSwipe: [0.64, 'blade1', 'blade2'], shieldBash: [0.71, 'shield'],
  hit: [0.58, 'hit', 'hit2'], crit: [0.80, 'crit'], hurt: [0.76, 'hurt'],
  enemyWind: [0.83, 'growl'], enemyRelease: [0.87, 'impact'], enemyCast: [0.76, 'shadow'],
  enemyDie: [0.55, 'death'], bossDie: [0.86, 'roar'], roar: [0.80, 'roar'],
  roll: [0.6, 'cloth1', 'cloth2'], jump: [0.58, 'jump'], land: [0.50, 'land'],
  climb: [0.43, 'gravel', 'stone2'], glide: [0.44, 'swing2'], updraft: [0.68, 'windCast'],
  step: [0.42, 'leaf1', 'leaf2'], sprintStep: [0.59, 'leaf1', 'leaf2'],
  mountOn: [0.64, 'mount'], mountOff: [0.49, 'cloth1'], sit: [0.37, 'cloth2'],
  kick: [0.68, 'hit'], splash: [0.64, 'splash'], ferry: [0.63, 'ferry'],
  rustle: [0.42, 'leaf2'], campfire: [0.50, 'fire2'], wish: [0.6, 'bell'],
  chop: [0.66, 'chop'], mine: [0.64, 'mine'], forge: [0.75, 'hammer'],
  gatherReady: [0.36, 'ui'], gatherMiss: [0.40, 'switchOff'], door: [0.53, 'door'],
  ui: [0.31, 'ui'], hover: [0.18, 'hover'], interact: [0.44, 'interact'], photo: [0.46, 'shutter'],
  chat: [0.35, 'bell'], emote: [0.42, 'click'], warn: [0.65, 'warn'],
  bagRustle: [0.5, 'cloth2'], equip: [0.59, 'equip'], pickup: [0.59, 'coin'],
  drop0: [0.30, 'coin'], drop1: [0.43, 'gem'], drop2: [0.63, 'treasure'], drop3: [0.73, 'reward'],
  xpGem: [0.38, 'gem', 'bell'], orb: [0.47, 'heal'], flask: [0.57, 'flask'],
  bolt: [0.63, 'fire'], slam: [0.79, 'impact'], wisp: [0.52, 'light'],
  meteor: [0.83, 'thunder'], nova: [0.72, 'iceCast'], prism: [0.61, 'prism'],
  perfect: [0.73, 'treasure'],
  partBreak: [0.78, 'break'], shatter: [0.72, 'ice2'], reaction: [0.65, 'magic'],
  corruptGod: [0.70, 'reward'], corruptBrick: [0.67, 'break'],
  ultReady: [0.56, 'treasure'], ultFort: [0.83, 'shield'], ultHound: [0.82, 'roar'], ultDaybreak: [0.82, 'prism'],
  tideHorn: [0.76, 'horn'], apexStart: [0.85, 'roar'], lullCalm: [0.57, 'heal'],
  boon: [0.60, 'treasure'], exit: [0.58, 'reward'], warp: [0.63, 'windCast'],
  win: [0.81, 'victory'], dead: [0.67, 'defeat'], revive: [0.63, 'heal'],
  classup: [0.73, 'reward'], synth: [0.63, 'prism'], evolve: [0.74, 'victory'],
  jackpotTick: [0.36, 'click'], jackpotWin: [0.75, 'victory'], curseShrine: [0.69, 'shadow'], ring: [0.65, 'bell'],
  flameGain: [0.39, 'bell'], flameSpend: [0.58, 'fire2'], flameOut: [0.70, 'defeat'],
  dimIn: [0.63, 'shadow'], dimOut: [0.53, 'heal'], enterLight: [0.54, 'light'], leaveLight: [0.42, 'switchOff'],
  lanternLit: [0.71, 'treasure'], lanternRespawn: [0.64, 'mount'],
};
