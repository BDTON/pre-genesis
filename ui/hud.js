// In-game HUD: top bar, realm drawer, selection sheet, coach line, minimap, turn corner.
import {ctx, ui, $, $$, esc, coarsePointer, gamepadConnected, tapWord, tapWordLower} from './context.js';
import * as g from './game.js';
import {engine} from './game.js';
import {districtOptions} from '../city-planning.js';
import {icon, unitIcon, crest} from './icons.js';
import {portrait} from './portraits.js';
import {button, meter, stat} from './markup.js';
import {TERRAIN, RESOURCES, IMPROVEMENTS, plural, signed, formatNumber} from './text.js';
import {orderBlockReason, activePlayerName} from './actions.js';

const ORDER_SELECTORS = '[data-city-focus],[data-research],[data-civic],[data-policy],[data-production],[data-build],[data-diplo],[data-order-tile],[data-confirm-turn],[data-act="move"],[data-act="army"],[data-act="heal"],[data-act="power"],[data-act="found"],[data-act="build"],[data-act="attack"]';

// Hints stay one sentence even when data text runs longer.
const firstSentence = text => (String(text || '').match(/^.*?[.!?](?=\s|$)/) || [String(text || '')])[0];

export const cityDistrictOptions = (city, kind) => districtOptions(ctx.state, city, kind);

function rememberControl() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  for (const key of ['id', 'data-act', 'data-select-unit', 'data-city', 'data-tab', 'data-open', 'data-diplo']) {
    if (el.hasAttribute(key)) return {el, selector: `[${key}="${CSS.escape(el.getAttribute(key))}"]`};
  }
  return {el};
}

function restoreControl(saved) {
  if (!saved || saved.el.isConnected) return;
  const replacement = saved.selector && document.querySelector(saved.selector);
  if (replacement && !replacement.disabled) replacement.focus({preventScroll: true});
  else if (!$('#modal').open) ctx.world?.renderer?.domElement?.focus?.({preventScroll: true});
}

export function render() {
  if (!ctx.started || !ctx.state) return;
  const s = ctx.state;
  if (ctx.districtPlacement && !s.cities.some(c => c.id === ctx.districtPlacement.cityId && c.faction === s.player)) ctx.districtPlacement = null;
  if (ctx.selectedUnitId && !g.selectedUnit()) ctx.selectedUnitId = null;
  const focus = rememberControl();
  renderTopBar();
  renderSidebar();
  renderSelection();
  renderCoach();
  renderMinimap();
  renderTurnCorner();
  renderHint();
  const unit = g.selectedUnit();
  const plannedCity = ctx.districtPlacement && s.cities.find(c => c.id === ctx.districtPlacement.cityId);
  const reachable = plannedCity ? cityDistrictOptions(plannedCity, ctx.districtPlacement.kind).map(t => t.id) : g.reachable(unit);
  const attackable = plannedCity ? [] : g.attackableTiles(unit);
  const foundable = unit?.kind === 'settler' ? g.foundableTileIds(unit) || [] : [];
  ctx.world?.update(s, {selectedTileId: ctx.selectedTileId, reachable, attackable, foundable, pendingAttack: ctx.pendingAttack});
  syncOrderControls();
  restoreControl(focus);
  ui.renderRoomBar?.();
  announceSelection();
}

function announceSelection() {
  const unit = g.selectedUnit();
  const city = g.selectedCity();
  const key = unit ? `u:${unit.id}` : city ? `c:${city.id}` : `t:${ctx.selectedTileId}`;
  if (key === ctx.lastSelectionKey) return;
  ctx.lastSelectionKey = key;
  const tile = g.tile(ctx.selectedTileId);
  const text = unit ? `${unit.name}, ${plural(unit.moves, 'move')} left.`
    : city ? `${city.name}, ${plural(city.population, 'person', 'people')}.`
    : tile?.explored ? `${TERRAIN[tile.terrain] || ''}.` : 'Unexplored.';
  $('#sr-status').textContent = text;
}

function renderTopBar() {
  const f = g.own();
  const y = g.totalYields();
  const era = g.era();
  const eraEl = $('#era');
  if (eraEl) {
    eraEl.hidden = !era;
    eraEl.textContent = era?.name || '';
    eraEl.title = era?.description ? `${era.description}${era.source ? ` (${era.source})` : ''}` : '';
  }
  const income = f.goldIncome ?? 0;
  const items = [
    ['gold', 'gold', formatNumber(f.gold), signed(income), 'Gold', `Gold ${formatNumber(f.gold)}, ${signed(income)} per turn`, income < 0],
    ['science', 'science', `+${y.science}`, '', 'Science', `Science ${y.science} per turn`, false],
    ['culture', 'culture', `+${y.culture}`, '', 'Culture', `Culture ${y.culture} per turn`, false],
    ['people', 'people', String(g.population()), '', 'People', `People ${g.population()}`, false],
  ];
  const html = items.map(([kind, iconName, value, gain, label, title, negative]) =>
    `<div class="resource" data-kind="${kind}" title="${esc(title)}" aria-label="${esc(title)}" role="img">
      ${icon(iconName)}<strong>${esc(value)}</strong>${gain ? `<small class="${negative ? 'negative' : ''}">${esc(gain)}</small>` : ''}<span class="resource-label">${label}</span>
    </div>`).join('');
  const bar = $('#resources');
  if (bar.dataset.html !== html) { bar.innerHTML = html; bar.dataset.html = html; }
}

function researchCard(kind) {
  const f = g.own();
  const isTech = kind === 'research';
  const list = isTech ? g.TECHS : g.CIVICS;
  const item = list.find(t => t.id === f[kind]);
  const progress = f[isTech ? 'scienceProgress' : 'cultureProgress'] || 0;
  const perTurn = g.totalYields()[isTech ? 'science' : 'culture'];
  const label = isTech ? 'Research' : 'Civic';
  return `<button type="button" class="card card-button" data-open="${isTech ? 'research' : 'civics'}">
    <span class="card-label">${icon(isTech ? 'research' : 'civic')}${label}${icon('chevron-right')}</span>
    <span class="card-title">${esc(item?.name || 'None')}</span>
    ${item ? meter(progress, item.cost, {label: `${label} progress`}) : ''}
    <span class="card-meta">${item ? `${Math.floor(progress)}/${item.cost} · ${plural(g.turnsFor(item.cost - progress, perTurn), 'turn')}` : isTech ? `${tapWord()} to pick research` : `${tapWord()} to pick a civic`}</span>
  </button>`;
}

function policyCard() {
  const policy = g.POLICIES.find(p => p.id === g.own().policy);
  return `<button type="button" class="card card-button" data-open="policies">
    <span class="card-label">${icon('policy')}Policy${icon('chevron-right')}</span>
    <span class="card-title">${esc(policy?.name || 'None')}</span>
    ${policy ? `<span class="card-meta">${esc(policy.description)}</span>` : `<span class="card-meta">${tapWord()} to adopt a policy</span>`}
  </button>`;
}

export function diplomacyActions(id) {
  const war = g.relation(id) === 'war';
  const gold = g.own().gold;
  const lock = treatyLock(id);
  return `<div class="row-actions">
    ${war ? button('Make peace', {icon: 'peace', data: {diplo: id, intent: 'peace'}, disabled: !!lock})
          : button('Declare war', {icon: 'war', kind: 'danger', data: {diplo: id, intent: 'war'}, disabled: !!lock})}
    ${button('Gift 25 gold', {icon: 'gift', data: {diplo: id, intent: 'gift'}, disabled: gold < 25, title: gold < 25 ? 'Needs 25 gold.' : ''})}
  </div>${lock ? `<p class="help-line">Treaty holds for ${plural(lock, 'more turn')}.</p>` : ''}`;
}

// Treaty locks are optional engine data; show them when present.
function treatyLock(id) {
  const s = ctx.state;
  const until = typeof engine.treatyUntil === 'function' ? engine.treatyUntil(s, id) : g.own()?.treaties?.[id];
  const left = Number(until) - s.turn;
  return Number.isFinite(left) && left > 0 ? left : 0;
}

export function diplomacyRows() {
  return g.rivals().map(f => {
    const war = g.relation(f.id) === 'war';
    // A rival planning war on the player warns a few turns ahead.
    const massing = !war && engine.getFaction(ctx.state, f.id)?.warPlan?.target === ctx.state.player;
    const status = war ? ['status-danger', 'war', 'At war'] : massing ? ['status-danger', 'warning', 'Massing troops'] : ['status-good', 'peace', 'At peace'];
    return `<div class="rival" data-faction-row="${esc(f.id)}">
      <div class="rival-head">${portrait(f.id, {size: 'sm'})}<div><strong>${esc(f.leader)}</strong><small>${esc(f.name)}</small></div>
        <span class="status ${status[0]}">${icon(status[1])}${status[2]}</span></div>
      ${diplomacyActions(f.id)}
    </div>`;
  }).join('');
}

function renderSidebar() {
  const m = g.factionMeta(ctx.state.player);
  const cities = g.ownCities();
  // On narrow screens the drawer covers its own toggle, so it carries a close button.
  const closeButton = isDrawerLayout()
    ? `<button type="button" class="icon-button" data-close-realm="true" aria-label="Close" title="Close" style="margin-left:auto">${icon('close')}</button>`
    : '';
  const identity = `${portrait(m.id, {size: 'md', gold: true})}<div><h2>${esc(m.name)}</h2><p>${esc(m.leader)} · ${plural(cities.length, 'city', 'cities')}</p></div>${closeButton}`;
  const identityEl = $('#realm-identity');
  // Rebuilt only on a change, so the portrait never blinks between renders.
  if (identityEl.dataset.html !== identity) { identityEl.innerHTML = identity; identityEl.dataset.html = identity; }
  $$('[data-tab]').forEach(b => {
    const active = b.dataset.tab === ctx.tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
    b.tabIndex = active ? 0 : -1;
  });
  let html = '';
  if (ctx.tab === 'cities') {
    html = cities.map(c => {
      const p = g.production(g.queueId(c));
      return `<button type="button" class="list-row" data-city="${esc(c.id)}">
        ${icon('city')}<span class="list-text"><strong>${esc(c.name)}</strong><small class="${p ? '' : 'warn'}">${esc(p?.name || 'No build set')}</small></span>
        <span class="list-value" title="People">${icon('people')}${c.population}</span>
      </button>`;
    }).join('') || '<p class="empty">No cities.</p>';
  } else if (ctx.tab === 'research') {
    html = researchCard('research') + researchCard('civic') + policyCard();
  } else {
    html = diplomacyRows() || '<p class="empty">No rivals left.</p>';
  }
  $('#sidebar-content').innerHTML = html;
}

function statsFor(unit) {
  const strength = unit.strength ? engine.combatStrength(ctx.state, unit) : null;
  return `<div class="stats">
    ${stat('health', `${unit.hp}/${unit.maxHp}`, 'Health')}
    ${strength !== null ? stat('strength', String(strength), 'Strength') : ''}
    ${stat('moves', `${unit.moves}/${unit.maxMoves}`, 'Moves')}
    ${unit.kind === 'hero' ? stat('xp', `${unit.xp || 0} XP`, 'Experience') : ''}
    ${unit.kind === 'builder' ? stat('charges', plural(unit.charges, 'charge'), 'Charges') : ''}
  </div>`;
}

function legalImprovements(unit) {
  const t = g.tile(unit.tileId);
  if (!t || t.owner !== ctx.state.player || t.improvement || ctx.state.cities.some(c => c.tileId === t.id)) return [];
  const f = g.own();
  const list = [];
  if (['grass', 'waste'].includes(t.terrain)) list.push('farm');
  if (t.terrain === 'hills' && f.techs.includes('masonry')) list.push('mine');
  if (t.terrain === 'forest') list.push('lumbermill');
  return list;
}

function unitSelection(unit) {
  const t = g.tile(unit.tileId);
  const power = unit.kind === 'hero' ? g.heroPower(unit) : null;
  const army = g.formArmyStatus(unit);
  const foundable = unit.kind === 'settler' ? g.foundableTileIds(unit) : null;
  const canFound = unit.kind === 'settler' && unit.moves > 0 && (foundable === null || foundable.includes(unit.tileId));
  const improvements = unit.kind === 'builder' ? legalImprovements(unit) : [];
  const kicker = unit.armySize === 3 ? 'Army' : unit.kind === 'hero' ? 'Hero' : unit.kind === 'builder' ? plural(unit.charges, 'charge') : '';
  const pending = ctx.pendingAttack ? g.forecast(unit, ctx.pendingAttack) : null;

  let help = unit.moves > 0 ? `${tapWord()} a lit tile to move.` : 'No moves left this turn.';
  if (unit.kind === 'settler') {
    help = unit.moves <= 0 ? (foundable?.includes(unit.tileId) ? 'Found the city here next turn.' : 'No moves left. Keep going next turn.')
      : foundable === null ? 'Found cities 3+ tiles from any other city.'
      : canFound ? `This site is free; ${tapWordLower()} Found city.` : 'Move to a marked site, then Found city.';
  }
  if (unit.kind === 'builder' && unit.moves > 0) help = improvements.length ? `${tapWord()} Improve to build here.` : 'Move to your own grassland, forest or hills.';
  if (power && unit.moves > 0) help = unit.cooldown > 0 ? `${power.name} is ready in ${plural(unit.cooldown, 'turn')}.` : `${power.name}: ${firstSentence(power.description)}`;
  if (army && !army.ready && unit.moves > 0) help = `Form army needs 3 unhurt, unmoved units of this type here (${army.count}/3).`;

  const actions = [
    button('Move', {icon: 'move', data: {act: 'move'}, disabled: unit.moves <= 0, pressed: ctx.moveMode}),
    power ? button('Use power', {icon: 'power', kind: 'primary', data: {act: 'power'}, disabled: unit.cooldown > 0 || unit.moves <= 0, title: power.name}) : '',
    army ? button('Form army', {icon: 'army', kind: 'primary', data: {act: 'army'}, disabled: !army.ready}) : '',
    unit.kind === 'settler' ? button('Found city', {icon: 'found', kind: 'primary', data: {act: 'found'}, disabled: !canFound}) : '',
    unit.kind === 'builder' ? button('Improve', {icon: 'improve', kind: 'primary', data: {act: 'build'}, disabled: unit.moves <= 0 || !improvements.length}) : '',
    button('Rest', {icon: 'rest', data: {act: 'heal'}, disabled: unit.moves <= 0}),
    button('Next unit', {icon: 'next', kind: 'ghost', data: {act: 'next'}}),
  ].join('');

  const attackPanel = pending?.canAttack ? `<div class="forecast" role="group" aria-label="Attack preview">
      <p><strong>Attack ${esc(pending.targetName)}</strong><span>Deal ${pending.damage} · Take ${pending.retaliation}</span></p>
      <div class="row-actions">${button('Attack', {icon: 'attack', kind: 'danger', data: {act: 'attack'}})}${button('Cancel', {data: {act: 'cancel-attack'}})}</div>
    </div>` : '';

  const badge = unit.kind === 'hero'
    ? portrait(unit.faction, {size: 'md', gold: true, extraClass: 'selection-portrait'})
    : `<div class="selection-emblem">${unitIcon(unit)}</div>`;
  return `<div class="selection-head">
      ${badge}
      <div class="selection-title">${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}<h2>${esc(unit.name)}</h2><p class="selection-sub">${esc(TERRAIN[t?.terrain] || '')}${unit.moves > 0 ? ` · ${plural(unit.moves, 'move')} left` : ' · No moves'}</p></div>
    </div>
    ${statsFor(unit)}
    ${meter(unit.hp, unit.maxHp, {label: 'Health', tone: unit.hp < unit.maxHp * .4 ? 'danger' : 'good'})}
    ${attackPanel}
    <div class="actions">${actions}</div>
    <p class="help-line">${esc(help)}</p>`;
}

export function waitingText(city, item) {
  if (!item || (city.production || 0) < item.cost) return '';
  const goal = g.VICTORY_GOALS.find(v => v.projectId === item.id);
  if (!goal) return '';
  const progress = engine.victoryProgress?.(ctx.state).find(v => v.projectId === item.id);
  if (!progress || progress.ready) return '';
  const district = g.production(goal.district)?.name || '';
  const parts = [`${district} ${progress.currentDistricts}/${goal.districtRequired}`];
  if (goal.goldRequired) parts.push(`Gold ${formatNumber(progress.currentGold)}/${formatNumber(goal.goldRequired)}`);
  if (goal.cultureRequired) parts.push(`Culture ${progress.currentCulture}/${goal.cultureRequired}`);
  return `Waiting: ${parts.join(' · ')}`;
}

function citySelection(city) {
  const ours = city.faction === ctx.state.player;
  const meta = g.factionMeta(city.faction);
  const head = `<div class="selection-head">
      <div class="selection-emblem">${crest(city.faction)}</div>
      <div class="selection-title"><p class="kicker">${esc(ours ? (city.capitalOf ? 'Capital city' : 'City') : meta.name)}</p><h2>${esc(city.name)}</h2>
      <p class="selection-sub">${plural(city.population, 'person', 'people')} · Defence ${city.hp}/${city.maxHp}</p></div>
    </div>`;
  if (!ours) {
    const war = g.relation(city.faction) === 'war';
    return `${head}<p class="help-line">${war ? 'Enemy city: attack it with a military unit.' : 'At peace with this faction; see Diplomacy.'}</p>
      <div class="actions">${button('Diplomacy', {icon: 'diplomacy', data: {openTab: 'diplomacy'}})}</div>`;
  }
  const y = engine.cityYields(ctx.state, city);
  const item = g.production(g.queueId(city));
  const waiting = waitingText(city, item);
  const yields = [['food', y.food, 'Food'], ['production', y.production, 'Production'], ['gold', y.gold, 'Gold'], ['science', y.science, 'Science'], ['culture', y.culture, 'Culture']]
    .map(([name, value, label]) => stat(name, signed(value), `${label} ${value} per turn`)).join('');
  const progressLine = item
    ? `${meter(city.production, item.cost, {label: 'Build progress'})}
      <p class="progress-line"><strong>${esc(item.name)}</strong><span>${esc(waiting || `${Math.floor(city.production)}/${item.cost} · ${plural(g.turnsFor(item.cost - city.production, y.production), 'turn')}`)}</span></p>`
    : '<p class="progress-line"><strong class="warn">No build set</strong><span>Pick one before ending the turn</span></p>';
  return `${head}
    <div class="stats yields">${yields}</div>
    ${progressLine}
    <div class="actions">
      ${button(item ? 'Change build' : 'Pick build', {icon: 'production', kind: item ? 'secondary' : 'primary', data: {act: 'production'}})}
      ${button('View city', {icon: 'city', data: {act: 'city-details'}})}
    </div>`;
}

function terrainSelection(t) {
  const explored = !!t?.explored;
  const owner = t?.visible && t?.owner ? g.factionMeta(t.owner).name : '';
  const details = explored ? [
    t.resource && RESOURCES[t.resource],
    t.visible && t.improvement && IMPROVEMENTS[t.improvement],
    t.river && 'River',
  ].filter(Boolean).join(' · ') || 'No improvement' : 'Move a unit nearby to see it.';
  const ready = g.readyUnits().length;
  return `<div class="selection-head">
      <div class="selection-emblem">${icon(explored ? 'terrain' : 'unexplored')}</div>
      <div class="selection-title">${owner ? `<p class="kicker">${esc(owner)}</p>` : ''}<h2>${esc(explored ? TERRAIN[t.terrain] || 'Land' : 'Unexplored')}</h2><p class="selection-sub">${esc(details)}</p></div>
    </div>
    <p class="help-line">Select a unit to move it.</p>
    ${ready ? `<div class="actions">${button('Next unit', {icon: 'next', data: {act: 'next'}})}</div>` : ''}`;
}

function renderSelection() {
  const s = ctx.state;
  const t = g.tile(ctx.selectedTileId);
  const unit = g.selectedUnit();
  const city = g.selectedCity();
  let html;
  let kind;
  if (unit) { html = unitSelection(unit); kind = 'unit'; }
  else if (city && (t?.visible || city.faction === s.player)) { html = citySelection(city); kind = city.faction === s.player ? 'city' : 'foreign'; }
  else { html = terrainSelection(t); kind = 'terrain'; }
  const here = s.units.filter(u => u.tileId === ctx.selectedTileId && u.faction === s.player);
  const ownCityHere = city?.faction === s.player;
  if (here.length > 1 || (here.length && ownCityHere)) {
    html += `<div class="unit-tabs" role="group" aria-label="On this tile">
      ${ownCityHere ? `<button type="button" class="chip" data-select-unit="" aria-pressed="${!unit}">${icon('city')}<span>City</span></button>` : ''}
      ${here.map(x => `<button type="button" class="chip" data-select-unit="${esc(x.id)}" aria-pressed="${x.id === unit?.id}">${unitIcon(x)}<span>${esc(x.name)}</span></button>`).join('')}
    </div>`;
  }
  const panel = $('#selection');
  panel.dataset.kind = kind;
  if (panel.dataset.html !== html) { panel.innerHTML = html; panel.dataset.html = html; }
}

// One-line coach. The first turns walk a new player through a campaign opening.
export function coachStep() {
  const s = ctx.state;
  const unit = g.selectedUnit();
  const city = g.selectedCity();
  if (ctx.districtPlacement) {
    const p = g.production(ctx.districtPlacement.kind);
    return {text: `${tapWord()} an outlined tile for ${p?.name || 'the district'}.`, action: ['Cancel', {data: {cancelPlacement: 'true'}}]};
  }
  if (s.winner) return {text: 'Game over.', action: ['New game', {icon: 'new', data: {menu: 'new'}}]};
  if (g.isEliminated()) return {text: 'Your faction has fallen.', action: null};
  const blocked = orderBlockReason();
  if (blocked) return {text: blocked, action: null};
  const decision = g.pendingDecision();
  if (decision?.city) return {text: `${decision.city.name}: pick what to build.`, action: ['Pick build', {icon: 'production', kind: 'primary', data: {decision: 'true'}}]};
  if (decision?.kind === 'research') return {text: 'Pick new research.', action: ['Pick research', {icon: 'research', kind: 'primary', data: {open: 'research'}}]};
  if (decision?.kind === 'civic') return {text: 'Pick a new civic.', action: ['Pick civic', {icon: 'civic', kind: 'primary', data: {open: 'civics'}}]};

  const guiding = s.turn <= 6 && !ctx.preferences?.tipsOff;
  if (unit) {
    if (unit.kind === 'settler') {
      const sites = g.foundableTileIds(unit);
      if (unit.moves <= 0) return {text: sites?.includes(unit.tileId) ? 'Found the city here next turn.' : 'No moves left. Keep going next turn.', action: null};
      if (!sites) return {text: 'Found cities 3+ tiles from any other city.', action: null};
      if (sites.includes(unit.tileId)) return {text: `${tapWord()} Found city to settle here.`, action: ['Found city', {icon: 'found', kind: 'primary', data: {act: 'found'}}]};
      return {text: `Move ${unit.name} to a marked site.`, action: null};
    }
    if (unit.kind === 'builder' && unit.moves > 0) return {text: `Move to grassland, then ${tapWordLower()} Improve.`, action: null};
    if (unit.moves > 0) return {text: ctx.pendingAttack ? `${tapWord()} the enemy again to attack.` : `${tapWord()} a lit tile to move.`, action: null};
    return {text: 'No moves left; pick another unit.', action: g.readyUnits().length ? ['Next unit', {icon: 'next', data: {act: 'next'}}] : null};
  }
  if (city?.faction === s.player && !guiding) {
    const building = g.production(g.queueId(city));
    return building
      ? {text: `${city.name} is building ${building.name}.`, action: ['Change build', {icon: 'production', data: {act: 'production'}}]}
      : {text: `${city.name}: pick what to build.`, action: ['Pick build', {icon: 'production', kind: 'primary', data: {act: 'production'}}]};
  }

  if (guiding) {
    const settler = g.ownUnits().find(u => u.kind === 'settler' && u.moves > 0);
    if (settler && g.ownCities().length < 2) return {text: `Found a second city with ${settler.name}.`, action: ['Select unit', {icon: 'settler', kind: 'primary', data: {selectUnit: settler.id, focus: 'true'}}]};
    const builder = g.ownUnits().find(u => u.kind === 'builder' && u.moves > 0);
    if (builder && !s.tiles.some(t => t.owner === s.player && t.improvement)) return {text: `Improve a tile with ${builder.name}.`, action: ['Select unit', {icon: 'builder', data: {selectUnit: builder.id, focus: 'true'}}]};
    const hero = g.ownUnits().find(u => u.kind === 'hero' && u.moves > 0);
    if (hero && s.turn <= 3) return {text: `Explore with ${hero.name}.`, action: ['Select hero', {icon: 'hero', data: {selectUnit: hero.id, focus: 'true'}}]};
    if (s.turn >= 3 && !ctx.coachSawDiplomacy) return {text: 'Check your rivals in Diplomacy.', action: ['Open Diplomacy', {icon: 'diplomacy', data: {openTab: 'diplomacy', coachSeen: 'true'}}]};
  }
  const rival = g.rivalProjects()[0];
  if (rival) return {text: `${rival.faction.leader} is building ${rival.project.name}.`, action: ['See goals', {icon: 'goals', data: {open: 'victory'}}]};
  const ready = g.readyUnits().length;
  if (ready) return {text: `${plural(ready, 'unit')} can still move.`, action: ['Next unit', {icon: 'next', data: {act: 'next'}}]};
  return {text: `All units have moved; ${tapWordLower()} End turn.`, action: ['See goals', {icon: 'goals', kind: 'ghost', data: {open: 'victory'}}]};
}

function renderCoach() {
  document.body.classList.toggle('placing-district', !!ctx.districtPlacement);
  const step = coachStep();
  const html = `<p>${esc(step.text)}</p>${step.action ? button(step.action[0], step.action[1]) : ''}`;
  const coach = $('#coach');
  // The generic end-of-turn prompt appears in turn 1 only; after that the
  // End turn button says it.
  const generic = /^All units have moved/.test(step.text);
  const show = !(generic && ctx.state.turn > 1);
  coach.hidden = !show;
  if (show && coach.dataset.html !== html) { coach.innerHTML = html; coach.dataset.html = html; }
}

// Room busy/connection changes only touch the status surfaces.
export function refreshStatus() {
  if (!ctx.started || !ctx.state) return;
  renderCoach();
  syncOrderControls();
}

function renderTurnCorner() {
  const s = ctx.state;
  $('#turn-number').textContent = `Turn ${s.turn}`;
}

export function renderHint() {
  const hint = $('#controls-hint');
  if (!hint) return;
  const show = ctx.started && ctx.state.turn <= 3 && !ctx.hintDismissed && !gamepadConnected();
  hint.hidden = !show;
  if (show) hint.textContent = coarsePointer() ? 'Drag to pan and pinch to zoom.' : 'Drag to pan and scroll to zoom.';
}

const MINIMAP_TERRAIN = {grass: '#5E7F5B', forest: '#35574A', hills: '#8C8466', mountain: '#B9BCC4', water: '#1E365F', waste: '#7A6A58'};
export const MINIMAP = {width: 240, height: 150, scale: 7.1, cx: 120, cy: 68};

export function minimapPoint(t) {
  return {x: MINIMAP.cx + Math.sqrt(3) * (t.q + t.r / 2) * MINIMAP.scale, y: MINIMAP.cy + t.r * 1.5 * MINIMAP.scale * .55};
}

export function renderMinimap() {
  const canvas = $('#minimap');
  if (!canvas || !canvas.getClientRects().length) return;
  const ctx2d = canvas.getContext('2d');
  const s = ctx.state;
  const {width, height, scale} = MINIMAP;
  ctx2d.clearRect(0, 0, width, height);
  for (const t of s.tiles) {
    const {x, y} = minimapPoint(t);
    ctx2d.beginPath();
    for (let n = 0; n < 6; n++) {
      const a = (60 * n - 30) * Math.PI / 180;
      const px = x + Math.cos(a) * scale * .92, py = y + Math.sin(a) * scale * .55 * .92;
      if (n) ctx2d.lineTo(px, py); else ctx2d.moveTo(px, py);
    }
    ctx2d.closePath();
    ctx2d.fillStyle = !t.explored ? '#172A4C' : t.visible && t.owner ? g.factionMeta(t.owner).color : MINIMAP_TERRAIN[t.terrain] || '#5E7F5B';
    ctx2d.globalAlpha = t.explored ? 1 : .8;
    ctx2d.fill();
    if (t.id === ctx.selectedTileId) {
      ctx2d.globalAlpha = 1;
      ctx2d.strokeStyle = '#C9A227';
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();
    }
  }
  ctx2d.globalAlpha = 1;
  for (const c of s.cities) {
    const t = g.tile(c.tileId);
    if (!t?.visible && c.faction !== s.player) continue;
    const {x, y} = minimapPoint(t);
    ctx2d.fillStyle = c.faction === s.player ? '#EFE7D6' : '#14110D';
    ctx2d.fillRect(x - 2, y - 2, 4, 4);
  }
}

export function syncOrderControls() {
  if (!ctx.state) return;
  const reason = orderBlockReason();
  $$(ORDER_SELECTORS).forEach(el => {
    if (reason && !el.disabled) { el.dataset.orderLocked = 'true'; el.disabled = true; }
    else if (!reason && el.dataset.orderLocked) { el.disabled = false; delete el.dataset.orderLocked; }
  });
  const end = $('#end-turn');
  if (end) {
    const decision = g.pendingDecision();
    const mp = ctx.multiplayer;
    end.disabled = !!reason;
    end.classList.toggle('needs-decision', !!decision);
    end.setAttribute('aria-busy', String(!!mp?.busy));
    const label = ctx.state.winner ? 'Game over' : mp?.busy ? 'Sending…' : mp?.connected && !mp.myTurn ? 'Waiting…' : decision?.label || 'End turn';
    end.querySelector('strong').textContent = label;
    end.title = reason || (decision ? decision.label : 'End turn');
  }
  // The coach line already shows the reason on the map; dialogs cover it, so they repeat it.
  for (const container of [$('#modal-body')]) {
    if (!container) continue;
    const isRoom = container.dataset.roomPanel && container.dataset.roomPanel !== 'false';
    const isResult = $('#modal')?.dataset.kind === 'result';
    let status = container.querySelector(':scope > .order-status');
    if (!reason || isRoom || isResult || !ctx.started) { status?.remove(); continue; }
    if (!status) {
      status = document.createElement('p');
      status.className = 'order-status';
      status.setAttribute('role', 'status');
      container.prepend(status);
    }
    status.textContent = reason;
  }
}

export const isDrawerLayout = () => !!globalThis.matchMedia?.('(max-width: 1100px)').matches;

export function setTab(name) {
  ctx.tab = name;
  const panel = $('#realm-panel');
  if (panel && !panel.classList.contains('expanded') && isDrawerLayout()) toggleRealm(true);
  renderSidebar();
  syncOrderControls();
}

export function toggleRealm(force) {
  const panel = $('#realm-panel');
  const open = panel.classList.toggle('expanded', force);
  $('#realm-toggle').setAttribute('aria-expanded', String(open));
  if (ctx.started) renderSidebar();
  if (open) panel.querySelector('[data-tab].active')?.focus({preventScroll: true});
  else if (panel.contains(document.activeElement)) $('#realm-toggle').focus({preventScroll: true});
  return open;
}

// The drawer closes on a tap outside it or on Escape; its tabs follow the arrow keys.
export function installDrawer() {
  $('#realm-panel .tabs')?.addEventListener('keydown', event => {
    const tabs = $$('#realm-panel [data-tab]');
    const index = tabs.findIndex(t => t.dataset.tab === ctx.tab);
    const step = {ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index}[event.key];
    if (step === undefined || index < 0) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setTab(next.dataset.tab);
    $(`#realm-panel [data-tab="${next.dataset.tab}"]`)?.focus();
  });
  document.addEventListener('pointerdown', event => {
    const panel = $('#realm-panel');
    if (!panel?.classList.contains('expanded') || !isDrawerLayout() || $('#modal').open) return;
    if (panel.contains(event.target) || $('#realm-toggle').contains(event.target)) return;
    toggleRealm(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || $('#modal').open) return;
    const panel = $('#realm-panel');
    if (panel?.classList.contains('expanded') && isDrawerLayout()) { event.preventDefault(); toggleRealm(false); }
  });
}

Object.assign(ui, {render, refreshStatus, renderMinimap, syncOrderControls, setTab, toggleRealm, districtOptions: cityDistrictOptions, renderHint, coachStep, waitingText, diplomacyRows, activePlayerName});
