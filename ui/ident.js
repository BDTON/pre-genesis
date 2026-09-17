// BEM Studios ident, shown once per launch before the title.
//
// One motion, as the studio's own ident is drawn: the dark fan rises, the light
// comes on through it, the wordmark ignites, it breathes once, and it hands the
// room to the title. Developer brand only; no game art appears here.
import {ctx, ui, $} from './context.js';

const RUN_MS = 3600;
const STILL_MS = 1200;
const SEEN_KEY = 'pregenesis-ident-seen';

let finished = false;

function reducedMotion() {
  const setting = ctx.preferences?.motion;
  if (setting === 'reduced') return true;
  if (setting === 'full') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The ident plays once per launch. A reload inside the same tab session goes
// straight to the title so testing and quick restarts are not slowed down.
function alreadySeen() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function remember() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: play it again next launch */ }
}

export function playIdent(done) {
  const root = $('#ident');
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    root?.removeEventListener('click', finish);
    document.removeEventListener('keydown', onKey);
    const audio = $('#ident-audio');
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (root) {
      root.classList.add('is-leaving');
      setTimeout(() => { root.hidden = true; root.classList.remove('is-leaving', 'is-playing', 'is-still'); }, 320);
    }
    remember();
    done();
  };
  const onKey = event => {
    if (['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) { event.preventDefault(); finish(); }
  };

  if (!root || alreadySeen()) { done(); return; }

  const still = reducedMotion();
  root.hidden = false;
  root.classList.add(still ? 'is-still' : 'is-playing');
  root.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  $('#ident-skip')?.focus({preventScroll: true});

  // The studio's own recording. Browsers block sound before a gesture; when it
  // is blocked the ident simply plays silent rather than waiting for it.
  if (!still && ctx.preferences?.music !== false) {
    const audio = $('#ident-audio');
    if (audio) {
      audio.volume = 0.8;
      audio.play().catch(() => {});
    }
  }

  const timer = setTimeout(finish, still ? STILL_MS : RUN_MS);
}

Object.assign(ui, {playIdent});
