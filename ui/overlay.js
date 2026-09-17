// Dialog, toast and focus management.
import {ctx, ui, $, esc} from './context.js';
import {button} from './markup.js';

let returnFocus = null;
let toastTimer = 0;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Tell the renderer when the map is hidden so it can stop drawing frames.
export function setMapCovered(covered) {
  covered = !!covered;
  if (ctx.mapCovered === covered) return;
  ctx.mapCovered = covered;
  document.documentElement.dataset.mapCovered = String(covered);
  const world = ctx.world;
  if (!world) return;
  if (typeof world.setPaused === 'function') world.setPaused(covered);
  else if (typeof world.setCovered === 'function') world.setCovered(covered);
  else if (!covered) world.requestRender?.();
}

// A dialog covers the map on phones (full-height sheet) and whenever the
// dialog is larger than most of the viewport.
function dialogCoversMap() {
  const dialog = $('#modal');
  if (!dialog?.open) return false;
  const rect = dialog.getBoundingClientRect();
  return rect.width * rect.height >= innerWidth * innerHeight * 0.6;
}

export function refreshCoverage() {
  setMapCovered(dialogCoversMap());
}

// In play the toast clears the guidance line and the phone strip below it, so it
// never covers either.
function placeToast(el) {
  if (document.body.dataset.screen !== 'game') { el.style.top = ''; return; }
  let bottom = 0;
  for (const selector of ['#coach', '#realm-toggle']) {
    const anchor = $(selector);
    if (anchor?.getClientRects().length) bottom = Math.max(bottom, anchor.getBoundingClientRect().bottom);
  }
  el.style.top = bottom ? `${Math.round(bottom + 8)}px` : '';
}

export function toast(text, {tone = ''} = {}) {
  const message = String(text ?? '').trim();
  if (!message) return;
  const el = $('#toast');
  el.textContent = message;
  el.dataset.tone = tone;
  placeToast(el);
  el.classList.add('show');
  if ($('#modal').open) {
    let feedback = $('#modal-feedback');
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.id = 'modal-feedback';
      feedback.className = 'dialog-feedback';
      feedback.setAttribute('role', 'status');
      $('#modal-body').prepend(feedback);
    }
    feedback.textContent = message;
    feedback.dataset.tone = tone;
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), Math.max(3500, Math.min(9000, message.length * 70)));
}

export function isModalOpen() {
  return !!$('#modal')?.open;
}

// kind tags the dialog for styling and for the room panel logic.
export function modal(html, {kind = 'panel', size = '', focus = ''} = {}) {
  const dialog = $('#modal');
  const body = $('#modal-body');
  if (!dialog.open) returnFocus = document.activeElement;
  body.dataset.roomPanel = 'false';
  dialog.dataset.kind = kind;
  dialog.dataset.size = size;
  body.innerHTML = html;
  const heading = body.querySelector('h2');
  if (heading) {
    heading.id = 'dialog-title';
    dialog.setAttribute('aria-labelledby', 'dialog-title');
  }
  ctx.world?.keys?.clear?.();
  ui.syncOrderControls?.();
  if (!dialog.open) dialog.showModal();
  const target = (focus && body.querySelector(focus)) || body.querySelector('[autofocus]') || body.querySelector(FOCUSABLE) || $('#modal-close');
  target?.focus({preventScroll: true});
  body.scrollTop = 0;
  requestAnimationFrame(refreshCoverage);
}

export function closeModal() {
  const dialog = $('#modal');
  const wasOpen = dialog.open;
  if (wasOpen) dialog.close();
  if (wasOpen) {
    const target = returnFocus;
    if (target?.isConnected && !target.disabled && target.getClientRects().length && !target.closest('[inert]')) target.focus({preventScroll: true});
    else if ($('#welcome').hidden) ctx.world?.renderer?.domElement?.focus({preventScroll: true});
    else $('#start-game')?.focus({preventScroll: true});
  }
  returnFocus = null;
  refreshCoverage();
}

// A styled confirmation dialog. Resolves true only on the confirm button.
export function confirmDialog({title, text = '', confirm, cancel = 'Cancel', danger = false}) {
  return new Promise(resolve => {
    modal(`<header class="dialog-head illuminated"><h2>${esc(title)}</h2>${text ? `<p class="dialog-sub">${esc(text)}</p>` : ''}</header>
      <div class="dialog-actions">
        ${button(confirm, {kind: danger ? 'danger' : 'primary', data: {confirmDialog: 'yes'}})}
        ${button(cancel, {kind: 'secondary', data: {confirmDialog: 'no'}})}
      </div>`, {kind: 'confirm', size: 'small'});
    const dialog = $('#modal');
    const finish = value => {
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('close', onClose);
      resolve(value);
    };
    const onClick = event => {
      const choice = event.target.closest('[data-confirm-dialog]')?.dataset.confirmDialog;
      if (!choice) return;
      event.stopPropagation();
      closeModal();
      finish(choice === 'yes');
    };
    const onClose = () => finish(false);
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('close', onClose, {once: true});
  });
}

export function installOverlay() {
  const dialog = $('#modal');
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
  $('#modal-close').addEventListener('click', closeModal);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal();
  });
  // showModal() already keeps Tab inside the dialog and makes the page inert.
  addEventListener('resize', () => requestAnimationFrame(refreshCoverage));
  Object.assign(ui, {toast, modal, closeModal, confirmDialog, isModalOpen, setMapCovered, refreshCoverage});
}
