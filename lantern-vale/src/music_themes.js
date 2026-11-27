// Region routing for the licensed tracks in game/assets/audio/music.
export const MUSIC = {
  title: 'title',
  town: 'town',
  interior: 'town',
  meadow: 'meadow',
  autumn: 'woodland',
  mirefog: 'cave',
  snow: 'snow',
  ember: 'battle',
  elderwood: 'woodland',
  desert: 'meadow',
  jungle: 'woodland',
  gothic: 'night',
  deep_sea: 'cave',
  scifi: 'battle',
  alien: 'cave',
  night: 'night',
  boss: 'boss',
  finale: 'boss',
};

export const FIELD_THEME = { 1: 'meadow', 2: 'autumn', 3: 'mirefog', 4: 'snow', 5: 'ember', 6: 'elderwood' };
export const DIM_FILTER_HZ = [18000, 5200, 2600, 1200];

export function themeKeyFor({ title = false, town = false, boss = false, field = 0, biomeKey = 'meadow', interior = false, night = false } = {}) {
  if (interior) return 'interior';
  if (title) return 'title';
  if (town) return 'town';
  if (boss) return 'boss';
  if (night && field) return 'night';
  return FIELD_THEME[field] || (Object.hasOwn(MUSIC, biomeKey) ? biomeKey : 'meadow');
}

export function musicTrackFor(mode, tide = 0) {
  if (tide === 3 && !['title', 'town', 'interior', 'boss', 'finale', 'night'].includes(mode)) return 'battle';
  return Object.hasOwn(MUSIC, mode) ? MUSIC[mode] : MUSIC.meadow;
}
