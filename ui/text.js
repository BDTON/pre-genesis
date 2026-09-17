// Player-facing copy that is not game data. Names of realms, champions, techs,
// civics, buildings and wonders always come from the engine and faction data.

export const TERRAIN = Object.freeze({
  grass: 'Grassland',
  forest: 'Forest',
  hills: 'Hills',
  mountain: 'Mountains',
  water: 'Water',
  waste: 'Wilderness',
});

export const RESOURCES = Object.freeze({
  wheat: 'Wheat',
  fish: 'Fish',
  iron: 'Iron',
  timber: 'Timber',
  gems: 'Gems',
  horses: 'Horses',
});

export const IMPROVEMENTS = Object.freeze({
  farm: 'Farm',
  mine: 'Mine',
  lumbermill: 'Lumber mill',
});

export const KIND_GROUPS = Object.freeze([
  ['unit', 'Units'],
  ['building', 'Buildings'],
  ['district', 'Districts'],
  ['wonder', 'Wonders'],
]);

export const YIELDS = Object.freeze({
  food: 'Food',
  production: 'Production',
  gold: 'Gold',
  science: 'Science',
  culture: 'Culture',
});

export const FOCUS_LABELS = Object.freeze({
  balanced: 'Balanced',
  food: 'Growth',
  production: 'Production',
  gold: 'Gold',
});

export const DIFFICULTY_TEXT = Object.freeze({
  guided: ['Guided', 'Gentler rivals for a first game.'],
  standard: ['Standard', 'Rivals play at near full strength.'],
  hard: ['Hard', 'Rivals play at full strength.'],
});

export const SOURCE_KINDS = Object.freeze({
  primary: 'Primary text',
  museum: 'Museum',
  scholarship: 'Scholarship',
  tradition: 'Tradition',
});

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const capitalize = text => {
  const value = String(text ?? '');
  return value ? value[0].toUpperCase() + value.slice(1) : value;
};

// Accent- and quote-insensitive search: typing "a" also finds "ā".
export const fold = text => String(text ?? '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .replace(/[’‘]/g, "'")
  .toLocaleLowerCase();

export const formatNumber = n => Math.floor(Number(n) || 0).toLocaleString('en-US');

export const signed = n => {
  const value = Math.round(Number(n) || 0);
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
};

export const clock = ms => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export const GRAPHICS_ERROR = 'This device can’t draw the 3D map. Update your browser or turn on hardware acceleration.';
