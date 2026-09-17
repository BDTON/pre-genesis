// Keyboard shortcuts, gamepad navigation and the Android back button.
import {ctx, ui, $} from './context.js';
import * as g from './game.js';
import {closeModal, isModalOpen} from './overlay.js';
import {TERRAIN} from './text.js';

function unitCommand(command) {
  const unit = g.selectedUnit();
  if (!unit) return;
  if (command === 'army') ui.action({type: 'FORM_ARMY', unitId: unit.id});
  if (command === 'rest') ui.action({type: 'HEAL', unitId: unit.id});
  if (command === 'found' && unit.kind === 'settler') ui.action({type: 'FOUND_CITY', unitId: unit.id});
  if (command === 'power' && unit.kind === 'hero') ui.action({type: 'HERO_POWER', unitId: unit.id});
}

function onKeyDown(e) {
  if (!ctx.started || !$('#welcome').hidden || isModalOpen() || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('input,select,textarea,button,a,summary,[contenteditable="true"]')) return;
  if (e.code === 'Escape') {
    ctx.moveMode = false;
    ctx.selectedUnitId = null;
    ctx.pendingAttack = null;
    ui.render();
    return;
  }
  if (['Equal', 'NumpadAdd'].includes(e.code)) { e.preventDefault(); ctx.world?.zoom(1); dismissHint(); return; }
  if (['Minus', 'NumpadSubtract'].includes(e.code)) { e.preventDefault(); ctx.world?.zoom(-1); dismissHint(); return; }
  const bindings = ctx.preferences.bindings;
  const command = Object.keys(bindings).find(k => bindings[k] === e.code);
  if (!command) return;
  e.preventDefault();
  if (command === 'nextUnit') ui.nextUnit();
  else if (command === 'endTurn') ui.requestEndTurn();
  else if (command === 'commands') ui.showCommands();
  else unitCommand(command);
}

export function dismissHint() {
  if (ctx.hintDismissed) return;
  ctx.hintDismissed = true;
  ui.renderHint?.();
}

// Android back: close the top-most layer before leaving the app.
function onBack(event) {
  if (isModalOpen()) { closeModal(); event.preventDefault(); return; }
  if ($('#realm-panel')?.classList.contains('expanded')) { ui.toggleRealm(false); event.preventDefault(); return; }
  if (ctx.started && (ctx.districtPlacement || ctx.moveMode || ctx.selectedUnitId || ctx.pendingAttack)) {
    ctx.districtPlacement = null;
    ctx.moveMode = false;
    ctx.selectedUnitId = null;
    ctx.pendingAttack = null;
    ui.render();
    event.preventDefault();
  }
}

// Gamepad polling runs only while a controller is connected.
let padFrame = 0;
let padPrevious = [];
let padTime = 0;
let cursorId = null;

function adjustSetting(el, direction) {
  if (el.tagName === 'SELECT') el.selectedIndex = (el.selectedIndex + direction + el.options.length) % el.options.length;
  else if (el.type === 'checkbox') el.checked = !el.checked;
  else if (el.type === 'range') el.value = String(Math.max(Number(el.min || 0), Math.min(Number(el.max || 100), Number(el.value) + direction * Number(el.step || 1))));
  el.dispatchEvent(new Event('change', {bubbles: true}));
}

function pollPad(now) {
  padFrame = 0;
  const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
  if (!pad) { padPrevious = []; return; }
  const pressed = i => pad.buttons[i]?.pressed && !padPrevious[i];
  const overlay = isModalOpen() || !$('#welcome').hidden;
  if (overlay) {
    const scope = isModalOpen() ? $('#modal') : $('#welcome');
    const controls = [...scope.querySelectorAll('button:not(:disabled),summary,a[href],select,input')].filter(b => !b.hidden && b.getClientRects().length);
    const current = document.activeElement;
    const i = controls.indexOf(current);
    const adjustable = current?.matches?.('select,input[type=checkbox],input[type=range],input[type=radio]');
    if (pressed(12) || (!adjustable && pressed(14))) controls[(i - 1 + controls.length) % controls.length]?.focus();
    if (pressed(13) || (!adjustable && pressed(15))) controls[(i + 1) % controls.length]?.focus();
    if (adjustable && (pressed(14) || pressed(15))) adjustSetting(current, pressed(14) ? -1 : 1);
    if (pressed(0)) {
      if (controls.includes(current)) { if (adjustable) adjustSetting(current, 1); else current.click(); }
      else controls[0]?.focus();
    }
    if (pressed(1) && isModalOpen()) closeModal();
  } else if (ctx.started) {
    if (now - padTime > 170) {
      let direction = null;
      if (pad.buttons[12]?.pressed) direction = [0, -1];
      if (pad.buttons[13]?.pressed) direction = [0, 1];
      if (pad.buttons[14]?.pressed) direction = [-1, 0];
      if (pad.buttons[15]?.pressed) direction = [1, 0];
      if (Math.abs(pad.axes[0]) > .5) direction = [Math.sign(pad.axes[0]), 0];
      if (Math.abs(pad.axes[1]) > .5) direction = [0, Math.sign(pad.axes[1])];
      if (direction) {
        const t = g.tile(cursorId || ctx.selectedTileId);
        const id = t && `${t.q + direction[0]},${t.r + direction[1]}`;
        const next = id && g.tile(id);
        if (next) {
          cursorId = id;
          ctx.world?.focus(id);
          const info = $('#hover-info');
          info.textContent = `${next.explored ? TERRAIN[next.terrain] : 'Unexplored'} · A: select`;
          info.classList.add('show');
        }
        padTime = now;
      }
    }
    const b = ctx.preferences.padBindings;
    if (pressed(0)) ui.selectTile(cursorId || ctx.selectedTileId);
    if (pressed(1)) { ctx.moveMode = false; ctx.selectedUnitId = null; ctx.pendingAttack = null; ui.render(); }
    if (pressed(b.nextUnit)) { ui.nextUnit(); cursorId = ctx.selectedTileId; }
    if (pressed(b.endTurn)) ui.requestEndTurn();
    if (pressed(b.zoomOut)) ctx.world?.zoom(-1);
    if (pressed(b.zoomIn)) ctx.world?.zoom(1);
    if (pressed(b.rest)) unitCommand('rest');
    if (pressed(b.context)) {
      const unit = g.selectedUnit();
      if (unit?.kind === 'hero') unitCommand('power');
      else if (unit?.kind === 'settler') unitCommand('found');
      else if (unit?.kind === 'builder') ui.showBuild();
    }
    if (pressed(b.commands)) ui.showCommands();
    if (pressed(b.menu)) ui.showMenu();
  }
  padPrevious = pad.buttons.map(x => x.pressed);
  padFrame = requestAnimationFrame(pollPad);
}

function startPad() {
  if (!padFrame) padFrame = requestAnimationFrame(pollPad);
  ui.renderHint?.();
}

export function installInput() {
  document.addEventListener('keydown', onKeyDown);
  addEventListener('pre-genesis:back', onBack);
  addEventListener('gamepadconnected', startPad);
  try { if ([...(navigator.getGamepads?.() || [])].some(Boolean)) startPad(); } catch { /* no gamepad API */ }
  const world = $('#world');
  world.addEventListener('wheel', dismissHint, {passive: true});
  world.addEventListener('pointermove', e => { if (e.buttons) dismissHint(); }, {passive: true});
}

Object.assign(ui, {dismissHint});
