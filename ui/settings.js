// Menu and settings: game actions, display, graphics quality, sound and controls.
import {ctx, ui, $, esc, finePointer, gamepadConnected, storage} from './context.js';
import * as prefsModule from '../preferences.js';
import * as g from './game.js';
import {crest} from './icons.js';
import {button, dialogHead} from './markup.js';
import {modal, toast} from './overlay.js';
import {plural} from './text.js';

const {DEFAULT_BINDINGS, ACTION_LABELS, BINDABLE_KEYS, DEFAULT_PAD_BINDINGS, PAD_ACTION_LABELS, PAD_BUTTON_LABELS} = prefsModule;

export const QUALITY_OPTIONS = [
  ['auto', 'Auto'],
  ['high', 'High'],
  ['balanced', 'Balanced'],
  ['low', 'Low'],
];

const SECTIONS = [
  ['game', 'Game', 'play'],
  ['display', 'Display', 'labels'],
  ['sound', 'Sound', 'sound-on'],
  ['controls', 'Controls', 'commands'],
  ['about', 'About', 'lore'],
];

export function savePreferences() {
  const store = storage();
  let saved = false;
  try { saved = !!store && prefsModule.savePreferences(store, ctx.preferences); } catch { saved = false; }
  return saved;
}

export function reducedMotion() {
  const p = ctx.preferences;
  return p.motion === 'reduced' || (p.motion === 'system' && !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Apply every preference to the document and the renderer.
export function applyPreferences() {
  const p = ctx.preferences;
  const root = document.documentElement;
  root.dataset.textSize = p.textSize;
  root.dataset.contrast = p.contrast;
  const reduced = reducedMotion();
  root.dataset.reducedMotion = String(reduced);
  const world = ctx.world;
  if (!world) return;
  world.setAccessibility?.({reducedMotion: reduced, highContrast: p.contrast === 'high'});
  if (typeof world.setQuality === 'function') {
    world.setQuality(p.quality || 'auto');
  } else if (world.renderer) {
    const quality = p.quality === 'auto' ? (globalThis.matchMedia?.('(pointer:coarse)').matches ? 'balanced' : 'high') : p.quality;
    world.renderer.setPixelRatio(quality === 'high' ? Math.min(devicePixelRatio || 1, 1.6) : quality === 'balanced' ? Math.min(devicePixelRatio || 1, 1.25) : 1);
    world.maxFps = quality === 'high' ? 0 : 30;
    world.resize?.();
  }
}

const selected = (a, b) => String(a) === String(b) ? 'selected' : '';

function selectField(key, label, detail, options) {
  return `<label class="field">
    <span class="field-label"><strong>${esc(label)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</span>
    <select data-setting="${key}">${options.map(([value, text]) => `<option value="${esc(value)}" ${selected(ctx.preferences[key], value)}>${esc(text)}</option>`).join('')}</select>
  </label>`;
}

function switchField(key, label, detail = '', invert = false) {
  const on = invert ? !ctx.preferences[key] : !!ctx.preferences[key];
  return `<label class="field field-switch">
    <span class="field-label"><strong>${esc(label)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</span>
    <input type="checkbox" role="switch" data-setting="${key}" ${invert ? 'data-invert="true"' : ''} ${on ? 'checked' : ''}>
  </label>`;
}

function gameSection() {
  if (!ctx.started) {
    return `<p class="note">Load a save file exported from another device.</p>
      <div class="dialog-actions">${button('Import save', {icon: 'import', data: {menu: 'import'}})}</div>`;
  }
  const s = ctx.state;
  const m = g.factionMeta(s.player);
  const online = ctx.multiplayer?.connected;
  const difficulty = g.stateDifficulty();
  const facts = [`Turn ${s.turn}`, plural(g.ownCities().length, 'city', 'cities'), plural(g.ownUnits().length, 'unit')];
  const extra = [difficulty?.name, !online && Number.isFinite(s.seed) ? `Map ${s.seed}` : ''].filter(Boolean).join(' · ');
  return `<div class="identity">${crest(m.id, 'crest crest-large')}<div><h3>${esc(m.name)}</h3><p>${esc(m.leader)} · ${esc(facts.join(' · '))}</p>${extra ? `<p class="note">${esc(extra)}</p>` : ''}</div></div>
    <div class="dialog-actions wrap">
      ${button('Resume', {icon: 'play', kind: 'primary', data: {closeDialog: 'true'}})}
      ${online ? '' : button('Save', {icon: 'save', data: {menu: 'save'}})}
      ${online ? '' : button('Export', {icon: 'export', data: {menu: 'export'}})}
      ${button('Import', {icon: 'import', data: {menu: 'import'}})}
      ${button('Leave game', {icon: 'leave', kind: 'danger', data: {menu: 'new'}})}
    </div>
    ${online ? '' : '<p class="note">Autosaves after every action.</p>'}`;
}

function displaySection() {
  return selectField('textSize', 'Text size', '', [['standard', 'Standard'], ['large', 'Large']])
    + selectField('contrast', 'Contrast', 'Stronger text and markers.', [['standard', 'Standard'], ['high', 'High']])
    + selectField('motion', 'Motion', 'Less camera and effect motion.', [['system', 'Device setting'], ['reduced', 'Reduced'], ['full', 'Full']])
    + selectField('quality', 'Graphics', 'Balanced and Low save battery.', QUALITY_OPTIONS);
}

function soundSection() {
  return switchField('music', 'Music')
    + switchField('sfx', 'Sound effects')
    + `<label class="field">
        <span class="field-label"><strong>Volume</strong><small>${Math.round(ctx.preferences.volume * 100)}%</small></span>
        <input type="range" min="0" max="1" step="0.05" value="${ctx.preferences.volume}" data-setting="volume">
      </label>`;
}

function controlsSection() {
  const p = ctx.preferences;
  let html = switchField('confirmTurn', 'Confirm end turn', 'Ask before ending a turn.')
    + switchField('tipsOff', 'Show tips', 'Guidance for the first turns.', true);
  if (finePointer()) {
    html += `<h3 class="section-title">Keyboard</h3><div class="binding-grid">${Object.entries(ACTION_LABELS).map(([id, label]) =>
      `<label class="field"><span class="field-label"><strong>${esc(label)}</strong></span><select data-keybind="${esc(id)}">${BINDABLE_KEYS.map(code => `<option value="${code}" ${selected(p.bindings[id], code)}>${code.slice(3)}</option>`).join('')}</select></label>`).join('')}</div>`;
  }
  if (gamepadConnected()) {
    html += `<h3 class="section-title">Controller</h3><p class="note">Assigning a used button swaps them.</p><div class="binding-grid">${Object.entries(PAD_ACTION_LABELS).map(([id, label]) =>
      `<label class="field"><span class="field-label"><strong>${esc(label)}</strong></span><select data-padbind="${esc(id)}">${Object.entries(PAD_BUTTON_LABELS).map(([code, name]) => `<option value="${code}" ${selected(p.padBindings[id], code)}>${esc(name)}</option>`).join('')}</select></label>`).join('')}</div>`;
  }
  if (finePointer() || gamepadConnected()) html += `<div class="dialog-actions">${button('Reset keys', {kind: 'ghost', data: {resetBindings: 'true'}})}</div>`;
  return html;
}

function aboutSection() {
  const version = document.querySelector('meta[name="pregenesis-version"]')?.content || '';
  return `<p><strong>Pre-Genesis</strong>${version ? ` ${esc(version)}` : ''}</p>
    <p class="note">Names and stories are cited in the Codex.</p>
    <ul class="plain-list">
      <li><strong>three.js</strong><span>MIT licence</span></li>
      <li><strong>PreGenesis type</strong><span>Made for this game</span></li>
    </ul>`;
}

export function showMenu(section = ctx.started ? 'game' : 'display') {
  const bodies = {game: gameSection, display: displaySection, sound: soundSection, controls: controlsSection, about: aboutSection};
  const body = (bodies[section] || displaySection)();
  const title = SECTIONS.find(([id]) => id === section)?.[1] || 'Settings';
  modal(`${dialogHead(ctx.started ? 'Menu' : 'Settings')}
    <div class="settings">
      <nav class="settings-nav" aria-label="Settings sections">
        ${SECTIONS.map(([id, label, iconName]) => button(label, {icon: iconName, kind: id === section ? 'primary' : 'ghost', data: {menuSection: id}, pressed: id === section})).join('')}
      </nav>
      <section class="settings-page" aria-label="${esc(title)}">${body}</section>
    </div>`, {kind: 'settings', focus: `[data-menu-section="${section}"]`});
}

export function handleSettingsChange(el) {
  const p = ctx.preferences;
  const key = el.dataset.setting;
  const binding = el.dataset.keybind;
  const padBinding = el.dataset.padbind;
  if (!key && !binding && !padBinding) return false;
  if (padBinding) {
    const next = Number(el.value);
    const old = p.padBindings[padBinding];
    const other = Object.keys(p.padBindings).find(k => k !== padBinding && p.padBindings[k] === next);
    if (other) p.padBindings[other] = old;
    p.padBindings[padBinding] = next;
    savePreferences();
    showMenu('controls');
    $(`[data-padbind="${padBinding}"]`)?.focus();
    toast('Controller updated.');
    return true;
  }
  if (binding) {
    const conflict = Object.keys(p.bindings).find(k => k !== binding && p.bindings[k] === el.value);
    if (conflict) {
      toast(`${el.value.slice(3)} is used for ${ACTION_LABELS[conflict].toLowerCase()}.`, {tone: 'warning'});
      el.value = p.bindings[binding];
      return true;
    }
    p.bindings[binding] = el.value;
  } else if (el.type === 'checkbox') {
    p[key] = el.dataset.invert ? !el.checked : el.checked;
  } else if (key === 'volume') {
    p.volume = Number(el.value);
    const small = el.closest('.field')?.querySelector('small');
    if (small) small.textContent = `${Math.round(p.volume * 100)}%`;
  } else {
    p[key] = el.value;
  }
  if (key === 'music') ui.setMusic?.(p.music);
  applyPreferences();
  if (!savePreferences()) toast('Applied. This browser could not keep it.');
  if (key === 'quality') toast('Graphics updated.');
  if (key === 'tipsOff') ui.render?.();
  return true;
}

export function resetBindings() {
  ctx.preferences.bindings = {...DEFAULT_BINDINGS};
  ctx.preferences.padBindings = {...DEFAULT_PAD_BINDINGS};
  savePreferences();
  showMenu('controls');
  $('[data-reset-bindings]')?.focus({preventScroll: true});
  toast('Keys reset.');
}

export function loadPreferences() {
  const store = storage();
  try { return prefsModule.loadPreferences(store); }
  catch { return prefsModule.loadPreferences(null); }
}

Object.assign(ui, {showMenu, applyPreferences, savePreferences, handleSettingsChange, resetBindings, reducedMotion});
