// Title screen: live world diorama, patron picker, difficulty and entry buttons.
import {ctx, ui, $, $$, esc} from './context.js';
import * as g from './game.js';
import {engine} from './game.js';
import {portrait} from './portraits.js';
import {fold, plural} from './text.js';
import {hasSave} from './storage.js';
import {savePreferences} from './settings.js';

const SHOWCASE_SEED = 7;
let showcaseTimer = 0;

function traitOf(f) {
  return engine.factionTrait?.(f.id) || f.trait || null;
}

// Grouped chips sit under a tradition heading, so the second line names the
// patron or the realm; a flat list names the tradition itself.
function subtitle(f) {
  if (isFlat()) return f.tradition || f.name;
  return f.patron && f.patron !== f.leader ? f.patron : f.name;
}

// Scrolls only the patron list, never the page around it.
function revealChip(chip) {
  const list = $('#patron-list');
  if (!list || !chip || chip.hidden) return;
  const top = chip.offsetTop - list.offsetTop;
  if (top < list.scrollTop || top + chip.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTop = Math.max(0, top - (list.clientHeight - chip.offsetHeight) / 2);
  }
}

function searchText(f) {
  const trait = traitOf(f);
  return fold([f.leader, f.patron, f.tradition, f.name, f.capital, trait?.name, trait?.summary].join(' '));
}

// Tradition headings and the search box earn their place only once the roster
// outgrows a single glance; below that the five patrons read as one list.
const SEARCHABLE_FROM = 9;
const isFlat = () => g.FACTIONS.length < SEARCHABLE_FROM;

const chip = f => `<button type="button" class="patron-chip" data-faction="${esc(f.id)}" data-search="${esc(searchText(f))}" aria-pressed="false" tabindex="-1">
  ${portrait(f.id, {size: 'sm'})}<span><strong>${esc(f.leader)}</strong><small>${esc(subtitle(f))}</small></span>
</button>`;

export function renderPatronList() {
  const list = $('#patron-list');
  const field = $('#patron-search-field');
  if (field) field.hidden = isFlat();
  list.classList.toggle('is-flat', isFlat());
  list.closest('.patron-picker')?.classList.toggle('is-flat', isFlat());
  if (isFlat()) {
    list.innerHTML = `<section class="patron-group"><div class="patron-chips">${g.FACTIONS.map(chip).join('')}</div></section>`;
    return;
  }
  const groups = new Map();
  for (const f of g.FACTIONS) {
    if (!groups.has(f.tradition)) groups.set(f.tradition, []);
    groups.get(f.tradition).push(f);
  }
  const sorted = [...groups].sort((a, b) => a[0].localeCompare(b[0]));
  list.innerHTML = sorted.map(([tradition, items]) => `<section class="patron-group" data-tradition="${esc(tradition)}">
      <h3>${esc(tradition)}</h3>
      <div class="patron-chips">${items.map(chip).join('')}</div>
    </section>`).join('');
}

export function filterPatrons(query) {
  const q = fold(query.trim());
  let shown = 0;
  for (const group of $$('.patron-group')) {
    let groupShown = 0;
    for (const chip of group.querySelectorAll('.patron-chip')) {
      const match = !q || chip.dataset.search.includes(q);
      chip.hidden = !match;
      if (match) groupShown++;
    }
    group.hidden = !groupShown;
    shown += groupShown;
  }
  $('#patron-count').textContent = q ? (shown ? plural(shown, 'match', 'matches') : 'No match') : '';
  syncRovingFocus();
}

function syncRovingFocus() {
  const chips = $$('.patron-chip').filter(c => !c.hidden);
  const current = chips.find(c => c.dataset.faction === ctx.chosenFaction) || chips[0];
  for (const chip of $$('.patron-chip')) chip.tabIndex = chip === current ? 0 : -1;
}

export function selectFaction(id, {scroll = true, showcase = true} = {}) {
  const f = g.factionMeta(id);
  if (!g.FACTIONS.some(x => x.id === f.id)) return;
  ctx.chosenFaction = f.id;
  for (const chip of $$('.patron-chip')) {
    const on = chip.dataset.faction === f.id;
    chip.setAttribute('aria-pressed', String(on));
    chip.classList.toggle('selected', on);
    // Wait a frame so the list has its final height (styles and fonts may still be settling).
    if (on && scroll) requestAnimationFrame(() => revealChip(chip));
  }
  syncRovingFocus();
  const trait = traitOf(f);
  $('#patron-detail').innerHTML = `${portrait(f.id, {size: 'lg', gold: true, eager: true})}
    <div class="patron-detail-text">
      <p class="kicker">${esc(f.tradition)}</p>
      <h2>${esc(f.leader)}</h2>
      <p class="patron-realm">${esc([f.name, f.capital].filter(Boolean).join(' · '))}</p>
      ${trait ? `<p class="patron-trait"><strong>${esc(trait.name)}.</strong> ${esc(trait.summary)}</p>` : ''}
    </div>`;
  if (ctx.preferences.faction !== f.id) {
    ctx.preferences.faction = f.id;
    savePreferences();
  }
  if (showcase) scheduleShowcase();
}

export function renderDifficulty() {
  const list = g.difficulties();
  const box = $('#difficulty');
  box.hidden = !list.length;
  if (!list.length) { ctx.chosenDifficulty = null; return; }
  const preferred = ctx.preferences.difficulty;
  const fallback = ctx.preferences.hasWon ? 'standard' : 'guided';
  const chosen = list.find(d => d.id === ctx.chosenDifficulty) || list.find(d => d.id === preferred) || list.find(d => d.id === fallback) || list[0];
  ctx.chosenDifficulty = chosen.id;
  $('#difficulty-options').innerHTML = list.map(d => `<label class="segment">
      <input type="radio" name="difficulty" value="${esc(d.id)}" ${d.id === chosen.id ? 'checked' : ''}>
      <span>${esc(d.name)}</span>
    </label>`).join('');
  $('#difficulty-note').textContent = chosen.description || '';
}

export function setDifficulty(id) {
  ctx.chosenDifficulty = id;
  ctx.preferences.difficulty = id;
  savePreferences();
  renderDifficulty();
}

// The diorama uses its own fixed map, never the saved campaign. The last one is kept.
let lastDemo = null;
function demoState(factionId) {
  if (lastDemo?.player === factionId) return lastDemo;
  const demo = g.newCampaignWithSeed(factionId, SHOWCASE_SEED);
  for (const t of demo.tiles) { t.explored = true; t.visible = true; }
  lastDemo = demo;
  return demo;
}

function scheduleShowcase() {
  clearTimeout(showcaseTimer);
  showcaseTimer = setTimeout(updateShowcase, 120);
}

// The title background is the live 3D world, never a picture.
export function updateShowcase() {
  const world = ctx.world;
  if (!world || ctx.started || !ctx.chosenFaction) return;
  let demo;
  try { demo = demoState(ctx.chosenFaction); } catch (error) { console.warn(error); return; }
  const capital = demo.cities.find(c => c.capitalOf === ctx.chosenFaction && c.faction === ctx.chosenFaction) || demo.cities[0];
  if (typeof world.setShowcase === 'function') world.setShowcase(demo, capital?.tileId);
  else {
    world.setLabels?.(false);
    world.update(demo, {selectedTileId: null});
    if (capital) world.focus(capital.tileId);
  }
}

// The title asks one question at a time: first what to do, then who to play.
export function showTitleStep(step) {
  const welcome = $('#welcome');
  welcome.dataset.step = step;
  if (step === 'setup') {
    renderDifficulty();
    selectFaction(ctx.chosenFaction, {scroll: true, showcase: true});
    $('#patron-list')?.querySelector('.patron-chip.selected')?.focus({preventScroll: true});
  } else {
    $('#new-campaign')?.focus({preventScroll: true});
  }
}

export function showTitle() {
  ctx.started = false;
  ctx.districtPlacement = null;
  ctx.pendingAttack = null;
  ctx.moveMode = false;
  document.body.dataset.screen = 'title';
  document.title = 'Pre-Genesis';
  $('#game').inert = true;
  $('#game').hidden = true;
  $('#welcome').hidden = false;
  $('#welcome').dataset.step = 'title';
  const saved = hasSave();
  $('#resume-game').hidden = !saved;
  ui.renderRoomBar?.();
  if (ctx.world && typeof ctx.world.setShowcase !== 'function') ctx.world.setLabels?.(false);
  renderDifficulty();
  selectFaction(ctx.chosenFaction, {scroll: true, showcase: false});
  updateShowcase();
  $('#new-campaign')?.focus({preventScroll: true});
}

function moveChipFocus(event) {
  const keys = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -Infinity, End: Infinity};
  if (!(event.key in keys) || !event.target.matches('.patron-chip')) return;
  const chips = $$('.patron-chip').filter(c => !c.hidden);
  const index = chips.indexOf(event.target);
  const step = keys[event.key];
  const next = step === -Infinity ? chips[0] : step === Infinity ? chips.at(-1) : chips[(index + step + chips.length) % chips.length];
  if (!next) return;
  event.preventDefault();
  for (const chip of chips) chip.tabIndex = chip === next ? 0 : -1;
  next.focus();
  selectFaction(next.dataset.faction, {scroll: true});
}

export function installTitle() {
  const world = $('#title-world');
  if (world) world.textContent = g.WORLD_NAME || '';
  renderPatronList();
  const saved = ctx.preferences.faction;
  ctx.chosenFaction = g.FACTIONS.some(f => f.id === saved) ? saved : g.defaultFactionId();
  $('#patron-search').addEventListener('input', e => filterPatrons(e.target.value));
  $('#patron-list').addEventListener('keydown', moveChipFocus);
  $('#difficulty').addEventListener('change', e => { if (e.target.name === 'difficulty') setDifficulty(e.target.value); });
  $('#new-campaign').addEventListener('click', () => showTitleStep('setup'));
  $('#setup-back').addEventListener('click', () => showTitleStep('title'));
  $('#start-game').addEventListener('click', () => ui.startNew());
  $('#resume-game').addEventListener('click', () => ui.resumeSave());
  $('#title-settings').addEventListener('click', () => ui.showMenu('display'));
  $('#read-lore').addEventListener('click', () => ui.showCodex(ctx.chosenFaction));
}

Object.assign(ui, {showTitle, showTitleStep, selectFaction, updateShowcase, renderDifficulty});
