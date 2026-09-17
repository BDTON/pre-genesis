// Every icon in the interface comes from the one SVG sprite (assets/icons.svg).
// Semantic names used by the UI map to sprite symbol ids from docs/rework/DESIGN.md.
import {esc} from './context.js';

export const SPRITE = 'assets/icons.svg';

export const ICONS = Object.freeze({
  codex: 'codex',
  'sound-on': 'sound-on',
  'sound-off': 'sound-off',
  help: 'help',
  menu: 'menu',
  settings: 'settings',
  realm: 'realm',
  history: 'history',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  capital: 'capital',
  labels: 'labels',
  close: 'close',
  'arrow-right': 'arrow-right',
  'chevron-right': 'chevron-right',
  'chevron-down': 'chevron-down',
  external: 'external',
  check: 'check',
  gold: 'gold',
  science: 'science',
  culture: 'culture',
  people: 'people',
  food: 'food',
  production: 'production',
  health: 'health',
  strength: 'strength',
  moves: 'moves',
  xp: 'xp',
  charges: 'charges',
  hero: 'hero',
  warrior: 'warrior',
  archer: 'archer',
  rider: 'rider',
  settler: 'settler',
  builder: 'builder',
  army: 'army',
  city: 'city',
  terrain: 'terrain',
  unexplored: 'unexplored',
  power: 'power',
  rest: 'rest',
  goals: 'goals',
  found: 'found',
  improve: 'improve',
  next: 'next',
  move: 'move',
  attack: 'attack',
  play: 'play',
  save: 'save',
  export: 'export',
  import: 'import',
  new: 'new',
  search: 'search',
  link: 'link',
  leave: 'leave',
  players: 'players',
  timer: 'timer',
  update: 'update',
  warning: 'warning',
  war: 'war',
  peace: 'peace',
  gift: 'gift',
  lore: 'lore',
  victory: 'victory',
  watch: 'watch',
  online: 'online',
  research: 'research',
  civic: 'civic',
  policy: 'policy',
  diplomacy: 'diplomacy',
  commands: 'commands',
});

export function iconId(name) {
  return ICONS[name] || name;
}

// Decorative by default; pass a label to expose the icon as an image.
export function icon(name, label = '') {
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon" ${a11y}><use href="${SPRITE}#${esc(iconId(name))}"></use></svg>`;
}

export const UNIT_ICON = Object.freeze({
  hero: 'hero',
  warrior: 'warrior',
  archer: 'archer',
  rider: 'rider',
  settler: 'settler',
  builder: 'builder',
});

export const unitIcon = unit => icon(unit?.armySize === 3 ? 'army' : UNIT_ICON[unit?.kind] || 'warrior');

export function crest(factionId, className = 'crest') {
  return `<img class="${className}" src="assets/emblems/${esc(factionId)}.svg" alt="" loading="lazy" decoding="async">`;
}
