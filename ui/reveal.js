// The campaign-start reveal: one held moment that names the realm before play.
// It is decorative, so it stays out of the accessibility tree; the same line is
// announced by the toast. A tap, click or key clears it early.
import {ctx, $, esc} from './context.js';
import {portrait} from './portraits.js';

const HOLD = 1700;
const FADE = 320;

let timers = [];
let dismiss = null;
let done = null;

const reduced = () => document.documentElement.dataset.reducedMotion === 'true';

function clearTimers() {
  for (const id of timers) clearTimeout(id);
  timers = [];
}

export function endReveal() {
  const el = $('#reveal');
  if (!el || el.hidden) return;
  clearTimers();
  if (dismiss) { removeEventListener('pointerdown', dismiss, true); removeEventListener('keydown', dismiss, true); dismiss = null; }
  el.dataset.phase = 'out';
  const after = done;
  done = null;
  timers.push(setTimeout(() => {
    el.hidden = true;
    el.innerHTML = '';
    el.dataset.phase = '';
    after?.();
  }, reduced() ? 0 : FADE));
}

// `meta` is the faction record; `capital` and `era` come from the fresh campaign.
export function revealCampaign(meta, {capital = '', era = '', onDone = null} = {}) {
  const el = $('#reveal');
  if (!el || !meta) return false;
  clearTimers();
  done = onDone;
  el.innerHTML = `<div class="reveal-band">
      <span class="plate">${portrait(meta.id, {size: 'xl', gold: true, eager: true})}</span>
      <div class="reveal-text">
        <p class="reveal-kicker">${esc([meta.tradition, era].filter(Boolean).join(' · '))}</p>
        <h2 class="reveal-name">${esc(meta.name || meta.leader)}</h2>
        <p class="reveal-line">${esc([meta.leader, capital].filter(Boolean).join(' · '))}</p>
      </div>
    </div>`;
  el.hidden = false;
  el.dataset.phase = 'in';
  dismiss = () => endReveal();
  addEventListener('pointerdown', dismiss, true);
  addEventListener('keydown', dismiss, true);
  timers.push(setTimeout(endReveal, reduced() ? HOLD / 2 : HOLD));
  // The renderer keeps drawing behind the band, so nothing has to be repainted.
  ctx.world?.requestRender?.();
  return true;
}
