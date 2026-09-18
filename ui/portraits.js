// Leader portraits, rendered from the game's own figure models
// (tools/figures/render.py, 512px, on the lapis ground the frames use).
// The realm emblem is drawn underneath and stays visible when a realm has no
// figure yet, so nothing is ever blank and nothing shifts while images load.
import {esc} from './context.js';

export const PORTRAIT_DIR = 'assets/figures/portraits/';
export const EMBLEM_DIR = 'assets/emblems/';

const SIZES = new Set(['sm', 'md', 'lg', 'xl']);

export const portraitSrc = id => `${PORTRAIT_DIR}${id}.webp`;
export const emblemSrc = id => `${EMBLEM_DIR}${id}.svg`;

// Realms whose leader has a built figure, and so a rendered portrait. The rest
// of the roster shows its emblem until its figure is modelled, and asks for no
// image that does not exist. tools/figures/recipes holds the built list.
export const FIGURE_IDS = Object.freeze(['michael', 'ra', 'athena', 'thor', 'moses']);
export const PATRON_FIGURE_IDS = Object.freeze(['ancient-of-days']);
export const hasPortrait = id => FIGURE_IDS.includes(id) || PATRON_FIGURE_IDS.includes(id);

// `gold` frames the portrait in gold leaf: the player, the winner, the chosen
// patron. `eager` is for a portrait that is on screen the moment it is written.
export function portrait(factionId, {size = 'md', gold = false, eager = false, extraClass = ''} = {}) {
  const id = esc(factionId ?? '');
  const scale = SIZES.has(size) ? size : 'md';
  const classes = ['portrait', `portrait-${scale}`, gold ? 'portrait-gold' : '', extraClass].filter(Boolean).join(' ');
  const load = eager ? 'eager' : 'lazy';
  const face = hasPortrait(factionId)
    ? `<img class="portrait-face" src="${portraitSrc(id)}" alt="" width="512" height="512" loading="${load}" decoding="async">`
    : '';
  return `<span class="${classes}" data-portrait="${id}">
    <img class="portrait-mark" src="${emblemSrc(id)}" alt="" loading="${load}" decoding="async">
    ${face}
  </span>`;
}

// One capture-phase listener covers every portrait, including markup written later.
// `load` does not bubble, so it is caught on the way down.
function onLoad(event) {
  const img = event.target;
  if (img?.classList?.contains?.('portrait-face')) img.closest('.portrait')?.classList.add('is-rendered');
}

if (typeof document !== 'undefined') document.addEventListener('load', onLoad, true);
