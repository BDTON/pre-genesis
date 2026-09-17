// Title screen: live world diorama, patron picker, difficulty and entry buttons.
import {ctx, ui, $, $$, esc} from './context.js';
import * as g from './game.js';
import {engine} from './game.js';
import {crest} from './icons.js';
import {fold, plural} from './text.js';
import {hasSave} from './storage.js';
import {savePreferences} from './settings.js';

const SHOWCASE_SEED = 7;
let showcaseTimer = 0;

function traitOf(f) {
  return engine.factionTrait?.(f.id) || f.trait || null;
}

// Chips sit under a tradition heading, so the second line names the patron or the realm.
function subtitle(f) {
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

export function renderPatronList() {
  const groups = new Map();
  for (const f of g.FACTIONS) {
    if (!groups.has(f.tradition)) groups.set(f.tradition, []);
    groups.get(f.tradition).push(f);
  }
  const sorted = [...groups].sort((a, b) => a[0].localeCompare(b[0]));
  $('#patron-list').innerHTML = sorted.map(([tradition, list]) => `<section class="patron-group" data-tradition="${esc(tradition)}">
      <h3>${esc(tradition)}</h3>
      <div class="patron-chips">${list.map(f => `<button type="button" class="patron-chip" data-faction="${esc(f.id)}" data-search="${esc(searchText(f))}" aria-pressed="false" tabindex="-1">
        ${crest(f.id)}<span><strong>${esc(f.leader)}</strong><small>${esc(subtitle(f))}</small></span>
      </button>`).join('')}</div>
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
  $('#patron-detail').innerHTML = `${crest(f.id, 'crest crest-large')}
    <div class="patron-detail-text">
      <h2>${esc(f.leader)}</h2>
      <p class="patron-realm">${esc([f.name, f.capital].filter(Boolean).join(' · '))}</p>
      ${trait ? `<p><strong>${esc(trait.name)}.</strong> ${esc(trait.summary)}</p>` : ''}
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
  const saved = hasSave();
  $('#resume-game').hidden = !saved;
  // Without Continue, Play online takes the whole row.
  $('#friends-button').style.gridColumn = saved ? '' : '1 / -1';
  ui.renderRoomBar?.();
  if (ctx.world && typeof ctx.world.setShowcase !== 'function') ctx.world.setLabels?.(false);
  renderDifficulty();
  selectFaction(ctx.chosenFaction, {scroll: true, showcase: false});
  updateShowcase();
  $('#start-game')?.focus({preventScroll: true});
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
  renderPatronList();
  const saved = ctx.preferences.faction;
  ctx.chosenFaction = g.FACTIONS.some(f => f.id === saved) ? saved : g.defaultFactionId();
  $('#patron-search').addEventListener('input', e => filterPatrons(e.target.value));
  $('#patron-list').addEventListener('keydown', moveChipFocus);
  $('#difficulty').addEventListener('change', e => { if (e.target.name === 'difficulty') setDifficulty(e.target.value); });
  $('#start-game').addEventListener('click', () => ui.startNew());
  $('#resume-game').addEventListener('click', () => ui.resumeSave());
  $('#title-settings').addEventListener('click', () => ui.showMenu('display'));
  $('#read-lore').addEventListener('click', () => ui.showCodex(ctx.chosenFaction));
}

Object.assign(ui, {showTitle, selectFaction, updateShowcase, renderDifficulty});
