// Game dialogs: research, policy, production, city, districts, improvements,
// orders, goals, history, help, commands, diplomacy and end-of-game.
import {ctx, ui, $, esc, finePointer, gamepadConnected, tapWord, tapWordLower} from './context.js';
import * as g from './game.js';
import {engine} from './game.js';
import {CITY_FOCUSES, cityWorkPlan, tileYields, districtLimit, districtAdjacency, DISTRICT_YIELD, districtAt, reservedDistrictAt} from '../city-planning.js';
import {icon, unitIcon, crest} from './icons.js';
import {button, meter, stat, dialogHead} from './markup.js';
import {modal, closeModal, toast} from './overlay.js';
import {TERRAIN, RESOURCES, IMPROVEMENTS, KIND_GROUPS, YIELDS, FOCUS_LABELS, plural, signed, formatNumber, capitalize} from './text.js';
import {action, save, exportSave} from './actions.js';

const doneMark = () => icon('check', 'Done');

export function showResearch(isCivic = false) {
  const f = g.own();
  const list = isCivic ? g.CIVICS : g.TECHS;
  const done = f[isCivic ? 'civics' : 'techs'];
  const current = f[isCivic ? 'civic' : 'research'];
  const perTurn = g.totalYields()[isCivic ? 'culture' : 'science'];
  const progress = f[isCivic ? 'cultureProgress' : 'scienceProgress'] || 0;
  const rank = t => done.includes(t.id) ? 2 : (t.requires || []).every(x => done.includes(x)) ? 0 : 1;
  const cards = [...list].sort((a, b) => rank(a) - rank(b)).map(t => {
    const complete = done.includes(t.id);
    const needs = (t.requires || []).filter(x => !done.includes(x)).map(x => list.find(z => z.id === x)?.name || x);
    const active = current === t.id;
    const meta = complete ? 'Done'
      : needs.length ? `Needs ${needs.join(', ')}`
      : active ? `In progress · ${plural(g.turnsFor(t.cost - progress, perTurn), 'turn')}`
      : `${t.cost} · ${plural(g.turnsFor(t.cost, perTurn), 'turn')}`;
    return `<button type="button" class="option${complete ? ' is-done' : ''}" data-${isCivic ? 'civic' : 'research'}="${esc(t.id)}" aria-pressed="${active}" ${complete || needs.length ? 'disabled' : ''}>
      <span class="option-title">${complete ? doneMark() : ''}${esc(t.name)}</span>
      <span class="option-text">${esc(t.description)}</span>
      <span class="option-meta">${esc(meta)}</span>
    </button>`;
  }).join('');
  modal(`${dialogHead(isCivic ? 'Civics' : 'Research', `${perTurn} ${isCivic ? 'culture' : 'science'} per turn`)}<div class="option-grid">${cards}</div>`, {kind: isCivic ? 'civics' : 'research'});
}

export function showPolicies() {
  const f = g.own();
  const cards = g.POLICIES.map(p => {
    const need = [].concat(p.requires || []);
    const missing = need.filter(x => !f.civics.includes(x));
    const active = f.policy === p.id;
    const meta = active ? 'Active' : missing.length ? `Needs ${missing.map(g.civicName).join(', ')}` : 'Adopt';
    return `<button type="button" class="option" data-policy="${esc(p.id)}" aria-pressed="${active}" ${missing.length ? 'disabled' : ''}>
      <span class="option-title">${active ? doneMark() : ''}${esc(p.name)}</span>
      <span class="option-text">${esc(p.description)}</span>
      <span class="option-meta">${esc(meta)}</span>
    </button>`;
  }).join('');
  modal(`${dialogHead('Policy', 'One policy at a time, for every city.')}<div class="option-grid">${cards}</div>`, {kind: 'policies'});
}

export function showProduction() {
  const city = g.selectedCity();
  if (!city || city.faction !== ctx.state.player) return;
  const modern = ctx.state.ruleset === g.TRAIT_RULESET;
  const y = engine.cityYields(ctx.state, city);
  const current = g.queueId(city);
  const goals = new Set(g.VICTORY_GOALS.map(v => v.projectId));
  const spire = g.spireWonder();
  const available = engine.availableProduction(ctx.state, city)
    .map(p => typeof p === 'string' ? g.production(p) : p).filter(Boolean)
    .sort((a, b) => Number(goals.has(b.id) || b.id === spire?.id) - Number(goals.has(a.id) || a.id === spire?.id));
  const groups = KIND_GROUPS.map(([kind, title]) => {
    const items = available.filter(p => p.kind === kind);
    if (!items.length) return '';
    const intro = kind === 'district' && modern ? `<p class="group-note">${city.districts.length} of ${districtLimit(city.population)} slots used</p>` : '';
    const cards = items.map(p => {
      const selected = current === p.id;
      const remaining = p.cost - (selected ? city.production : 0);
      const waiting = selected ? ui.waitingText(city, p) : '';
      const victory = goals.has(p.id) || p.id === spire?.id;
      const meta = waiting || `${plural(g.turnsFor(remaining, y.production), 'turn')}${p.kind === 'district' && modern ? ' · pick a tile' : ''}`;
      return `<button type="button" class="option" data-production="${esc(p.id)}" data-city-id="${esc(city.id)}" aria-pressed="${selected}">
        <span class="option-title">${victory ? icon('victory', 'Victory project') : ''}${esc(p.name)}</span>
        <span class="option-text">${esc(p.description)}</span>
        <span class="option-meta">${esc(meta)}</span>
      </button>`;
    }).join('');
    return `<section class="option-group"><h3>${title}</h3>${intro}<div class="option-grid">${cards}</div></section>`;
  }).join('');
  modal(`${dialogHead(city.name, `${signed(y.production)} production per turn`)}${groups || '<p class="empty">Nothing to build.</p>'}`, {kind: 'production', size: 'wide'});
}

export function showCity() {
  const city = g.selectedCity();
  if (!city || city.faction !== ctx.state.player) return;
  const modern = ctx.state.ruleset === g.TRAIT_RULESET;
  const plan = modern ? cityWorkPlan(ctx.state, city) : null;
  const y = engine.cityYields(ctx.state, city);
  const growth = 16 + city.population * 9;
  const focus = city.focus || 'balanced';
  const built = [...city.buildings, ...city.districts].map(id => ({id, name: g.production(id)?.name || capitalize(id)}));
  const ledger = `<dl class="ledger">
    <div><dt>People</dt><dd>${city.population}</dd></div>
    <div><dt>Growth</dt><dd>${Math.floor(city.food)}/${growth}</dd></div>
    <div><dt>Defence</dt><dd>${city.hp}/${city.maxHp}</dd></div>
  </dl>`;
  const focusRow = modern ? `<section class="dialog-section"><h3>Focus</h3><div class="segmented" role="group" aria-label="Focus">
    ${CITY_FOCUSES.map(f => button(FOCUS_LABELS[f] || capitalize(f), {kind: focus === f ? 'primary' : 'secondary', data: {cityFocus: f, cityId: city.id}, pressed: focus === f})).join('')}
  </div></section>` : '';
  const yields = Object.entries(y).map(([k, v]) => stat(k, `${signed(v)} ${YIELDS[k] || capitalize(k)}`, `${YIELDS[k] || k} per turn`)).join('');
  const worked = modern ? `<details class="disclosure"><summary>Worked tiles (${plan.workedTiles.length})</summary>
    <ul class="plain-list">${plan.workedTiles.map(t => {
      const ty = tileYields(g.own(), t);
      return `<li><strong>${esc(TERRAIN[t.terrain] || '')}</strong><span>${ty.food} food · ${ty.production} production · ${ty.gold} gold</span></li>`;
    }).join('')}</ul>
    <p class="note">More district slots at 4, 7 and 10 people.</p></details>` : '';
  const buildings = built.map(p => {
    const site = city.districtTiles?.[p.id];
    return `<li><strong>${esc(p.name)}</strong>${site ? `<span>${signed(districtAdjacency(ctx.state, site, p.id))} ${esc(YIELDS[DISTRICT_YIELD[p.id]] || '')} from nearby tiles</span>` : ''}</li>`;
  }).join('');
  modal(`${dialogHead(city.name, city.capitalOf ? 'Capital' : '')}${ledger}${focusRow}
    <section class="dialog-section"><h3>Per turn</h3><div class="stats yields">${yields}</div></section>
    ${worked}
    <section class="dialog-section"><h3>Buildings</h3>${buildings ? `<ul class="plain-list">${buildings}</ul>` : '<p class="empty">No buildings yet.</p>'}</section>
    <div class="dialog-actions">${button('Pick build', {icon: 'production', kind: 'primary', data: {act: 'production'}})}</div>`, {kind: 'city'});
}

export function showDistrictPlacement(city, item) {
  const choices = ui.districtOptions(city, item.id);
  ctx.districtPlacement = {cityId: city.id, kind: item.id};
  ctx.selectedUnitId = null;
  ctx.selectedTileId = city.tileId;
  ui.render();
  const yieldName = YIELDS[DISTRICT_YIELD[item.id]] || '';
  const rows = choices.map(t => `<button type="button" class="list-row" data-production="${esc(item.id)}" data-city-id="${esc(city.id)}" data-production-tile="${esc(t.id)}">
      ${icon('terrain')}<span class="list-text"><strong>${esc(TERRAIN[t.terrain] || '')}</strong><small>Replaces tile yield</small></span>
      <span class="list-value">${signed(t.adjacency)} ${esc(yieldName)}</span>
    </button>`).join('');
  modal(`${dialogHead(`Place ${item.name}`, `Each number is the tile’s extra ${yieldName.toLowerCase()} per turn.`)}
    <div class="dialog-actions">
      ${button('Use map', {icon: 'terrain', kind: 'primary', data: {placeOnMap: 'true'}})}
      ${button('Cancel', {data: {cancelPlacement: 'true'}})}
    </div>
    <div class="list">${rows || '<p class="empty">No free tile; grow the city first.</p>'}</div>`, {kind: 'districts'});
}

export function showBuild() {
  const unit = g.selectedUnit();
  const t = g.tile(unit?.tileId);
  if (!unit || !t) return;
  const modern = ctx.state.ruleset === g.TRAIT_RULESET;
  const reserved = modern && (districtAt(ctx.state, t.id) || reservedDistrictAt(ctx.state, t.id));
  const usable = t.owner === ctx.state.player && !t.improvement && !reserved && !ctx.state.cities.some(c => c.tileId === t.id) && unit.moves > 0;
  const mineTech = g.techName('masonry');
  const hasMineTech = g.own().techs.includes('masonry');
  const options = [
    ['farm', 'farm', '+2 food', `${TERRAIN.grass} or ${TERRAIN.waste.toLowerCase()}`, ['grass', 'waste'].includes(t.terrain), `Needs ${TERRAIN.grass.toLowerCase()} or ${TERRAIN.waste.toLowerCase()}`],
    ['mine', 'mine', '+2 production', `${TERRAIN.hills}${mineTech ? ` · needs ${mineTech}` : ''}`, t.terrain === 'hills' && hasMineTech, t.terrain === 'hills' ? `Needs ${mineTech}` : `Needs ${TERRAIN.hills.toLowerCase()}`],
    ['lumbermill', 'lumbermill', '+2 production', TERRAIN.forest, t.terrain === 'forest', `Needs ${TERRAIN.forest.toLowerCase()}`],
  ];
  const cards = options.map(([id, key, gain, where, legal, reason]) => {
    const status = !usable ? (reserved ? 'Tile saved for a district' : unit.moves <= 0 ? 'No moves left' : 'Move to your own empty tile') : legal ? 'Build here' : reason;
    return `<button type="button" class="option" data-build="${id}" ${usable && legal ? '' : 'disabled'}>
      <span class="option-title">${esc(IMPROVEMENTS[key])}</span>
      <span class="option-text">${esc(gain)} · ${esc(where)}</span>
      <span class="option-meta">${esc(status)}</span>
    </button>`;
  }).join('');
  modal(`${dialogHead('Improve tile', `${plural(unit.charges, 'charge')} left`)}<div class="option-grid">${cards}</div>`, {kind: 'build'});
}

export function showOrders() {
  const unit = g.selectedUnit();
  if (!unit) return;
  const origin = g.tile(unit.tileId);
  const distance = t => engine.distance ? engine.distance(origin, t) : (Math.abs(t.q - origin.q) + Math.abs(t.r - origin.r) + Math.abs(t.q + t.r - origin.q - origin.r)) / 2;
  const reachable = new Set(g.reachable(unit));
  const choices = ctx.state.tiles
    .map(t => ({t, preview: t.visible ? g.forecast(unit, t.id) : null}))
    .filter(({t, preview}) => reachable.has(t.id) || preview?.canAttack);
  // Settlers list legal city sites first; attacks come before plain moves.
  const sites = new Set(g.foundableTileIds(unit) || []);
  const rank = ({t, preview}) => preview?.canAttack ? 0 : sites.has(t.id) ? 1 : 2;
  choices.sort((a, b) => rank(a) - rank(b) || distance(a.t) - distance(b.t) || a.t.q - b.t.q || a.t.r - b.t.r);
  const rows = choices.map(({t, preview}) => {
    const attack = preview?.canAttack;
    const d = distance(t);
    const title = attack ? `Attack ${preview.targetName}` : TERRAIN[t.terrain] || 'Land';
    const small = [sites.has(t.id) && !attack ? 'City site' : '', plural(d, 'tile'), t.explored && t.resource ? RESOURCES[t.resource] : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="list-row${attack ? ' is-danger' : ''}" data-order-tile="${esc(t.id)}">
      ${icon(attack ? 'attack' : 'move')}<span class="list-text"><strong>${esc(title)}</strong><small>${esc(small)}</small></span>
      <span class="list-value">${attack ? `Deal ${preview.damage} · Take ${preview.retaliation}` : 'Move'}</span>
    </button>`;
  }).join('');
  modal(`${dialogHead(`Move ${unit.name}`, `Or ${tapWordLower()} a lit tile on the map.`)}<div class="list">${rows || '<p class="empty">No moves left.</p>'}</div>`, {kind: 'orders'});
}

function goalRow(title, text, progress, value = null, max = null) {
  return `<article class="goal">
    <header><h3>${esc(title)}</h3><span class="goal-progress">${esc(progress)}</span></header>
    <p>${esc(text)}</p>
    ${value !== null ? meter(value, max, {label: `${title} progress`}) : ''}
  </article>`;
}

export function showGoals() {
  const s = ctx.state;
  const f = g.own();
  const rows = [];
  const capitals = g.capitalsHeld();
  const conquest = g.victoryInfo('domination');
  rows.push(goalRow(conquest?.name || 'Conquest', conquest?.description || 'Hold every capital, including your own.', `${capitals.held}/${capitals.total} capitals`, capitals.held, capitals.total));
  const spire = g.spireWonder();
  if (spire) {
    const techs = [].concat(spire.requires || []);
    const civics = [].concat(spire.civicRequires || []);
    const steps = [...techs.map(id => f.techs.includes(id)), ...civics.map(id => f.civics.includes(id)), s.cities.some(c => c.faction === s.player && c.buildings.includes(spire.id))];
    const parts = [
      techs.length ? `Learn ${techs.map(g.techName).join(' and ')}` : '',
      civics.length ? `adopt ${civics.map(g.civicName).join(' and ')}` : '',
      `then build ${spire.name}`,
    ].filter(Boolean);
    const info = g.victoryInfo(spire.id);
    const doneSteps = steps.filter(Boolean).length;
    rows.push(goalRow(info?.name || spire.name, info?.description || `${capitalize(parts.join(', '))}.`, `${doneSteps}/${steps.length} steps`, doneSteps, steps.length));
  }
  const progress = engine.victoryProgress ? engine.victoryProgress(s) : [];
  for (const goal of progress) {
    const wonder = g.production(goal.projectId);
    const info = g.victoryInfo(goal.id);
    const district = g.production(goal.district)?.name || '';
    const needs = [`${district} in ${plural(goal.districtRequired, 'city', 'cities')}`];
    if (goal.goldRequired) needs.push(`${formatNumber(goal.goldRequired)} gold`);
    if (goal.cultureRequired) needs.push(`${goal.cultureRequired} culture per turn`);
    const status = [goal.unlocked ? '' : 'Locked', `${district} ${goal.currentDistricts}/${goal.districtRequired}`];
    if (goal.goldRequired) status.push(`Gold ${formatNumber(goal.currentGold)}/${formatNumber(goal.goldRequired)}`);
    if (goal.cultureRequired) status.push(`Culture ${goal.currentCulture}/${goal.cultureRequired}`);
    const fraction = (Math.min(1, goal.currentDistricts / goal.districtRequired) + Math.min(1, goal.goldRequired ? goal.currentGold / goal.goldRequired : goal.currentCulture / (goal.cultureRequired || 1))) / 2;
    const text = info?.description || `${capitalize(needs.join(' and '))}, then build ${wonder?.name || 'the wonder'}.`;
    rows.push(goalRow(info?.name || wonder?.name || capitalize(goal.id), text, status.filter(Boolean).join(' · '), fraction, 1));
  }
  const rivals = g.rivals().map(r => {
    const rf = engine.getFaction(s, r.id);
    const project = g.rivalProjects().find(x => x.faction.id === r.id);
    const line = project ? `Building ${project.project.name}: ${Math.floor(project.city.production || 0)}/${project.project.cost}` : 'No wonder under way';
    return `<li>${crest(r.id)}<span><strong>${esc(r.leader)}</strong><small>${plural(rf?.techs?.length || 0, 'tech')} · ${esc(line)}</small></span></li>`;
  }).join('');
  modal(`${dialogHead('Ways to win', g.WORLD_NAME)}<div class="goals">${rows.join('')}</div>
    <section class="dialog-section"><h3>Rivals</h3><ul class="plain-list rivals-list">${rivals}</ul></section>`, {kind: 'goals'});
}

export function showVictory() {
  const s = ctx.state;
  const won = s.winner === s.player;
  const winner = g.factionMeta(s.winner);
  const label = g.victoryLabel(s.victoryType);
  const line = won ? `${label}, turn ${s.turn}.`
    : s.victoryType === 'conquest' ? 'Your last city has fallen.'
    : `${winner.leader}: ${label}, turn ${s.turn}.`;
  modal(`<div class="result">${crest(s.winner, 'crest crest-hero')}
    <h2>${won ? 'Victory' : 'Defeat'}</h2><p class="dialog-sub">${esc(line)}</p></div>
    <div class="dialog-actions">
      ${button('New game', {icon: 'new', kind: 'primary', data: {menu: 'new'}})}
      ${button('View map', {icon: 'terrain', data: {closeDialog: 'true'}})}
      ${ctx.multiplayer?.connected ? '' : button('Export', {icon: 'export', data: {menu: 'export'}})}
    </div>`, {kind: 'result', size: 'small'});
}

export function showEliminated() {
  modal(`${dialogHead('Your faction has fallen', 'You can keep watching the room or leave it.')}
    <div class="dialog-actions">
      ${button('Keep watching', {icon: 'watch', kind: 'primary', data: {closeDialog: 'true'}})}
      ${button('Leave room', {icon: 'leave', kind: 'danger', data: {roomAction: 'leave'}})}
    </div>`, {kind: 'result', size: 'small'});
}

export function showHistory() {
  const entries = ctx.state.log.slice(0, 70);
  let lastTurn = null;
  const items = entries.map(e => {
    const heading = e.turn !== lastTurn ? `<h3 class="history-turn">Turn ${e.turn}</h3>` : '';
    lastTurn = e.turn;
    return `${heading}<p class="history-entry">${esc(e.text)}</p>`;
  }).join('');
  modal(`${dialogHead('History')}<div class="history">${items || '<p class="empty">Nothing yet.</p>'}</div>`, {kind: 'history'});
}

function keyName(code) {
  return String(code || '').replace(/^Key/, '').replace(/^Digit/, '');
}

export function showHelp() {
  const prefs = ctx.preferences;
  const bindings = prefs?.bindings || {};
  const showKeys = finePointer();
  const keys = showKeys ? `<details class="disclosure"><summary>Keyboard</summary><dl class="keys">
      <div><dt>W A S D</dt><dd>Pan the map</dd></div>
      <div><dt>+ / −</dt><dd>Zoom</dd></div>
      <div><dt>${esc(keyName(bindings.nextUnit))}</dt><dd>Next unit</dd></div>
      <div><dt>${esc(keyName(bindings.endTurn))}</dt><dd>End turn</dd></div>
      <div><dt>${esc(keyName(bindings.found))}</dt><dd>Found city</dd></div>
      <div><dt>${esc(keyName(bindings.power))}</dt><dd>Use power</dd></div>
      <div><dt>${esc(keyName(bindings.rest))}</dt><dd>Rest</dd></div>
      <div><dt>${esc(keyName(bindings.army))}</dt><dd>Form army</dd></div>
      <div><dt>${esc(keyName(bindings.commands))}</dt><dd>Commands</dd></div>
      <div><dt>Esc</dt><dd>Back</dd></div>
    </dl></details>` : '';
  const pad = gamepadConnected() ? `<details class="disclosure"><summary>Controller</summary><dl class="keys">
      <div><dt>D-pad</dt><dd>Move the cursor</dd></div>
      <div><dt>A</dt><dd>Select</dd></div>
      <div><dt>B</dt><dd>Back</dd></div>
      <div><dt>X</dt><dd>Next unit</dd></div>
      <div><dt>Y</dt><dd>End turn</dd></div>
    </dl></details>` : '';
  modal(`${dialogHead('How to play')}
    <ol class="steps">
      <li><strong>Move</strong><span>Select a unit, then ${tapWordLower()} a lit tile.</span></li>
      <li><strong>Build</strong><span>${tapWord()} your city and pick a build.</span></li>
      <li><strong>Grow</strong><span>Pick research and civics.</span></li>
      <li><strong>End turn</strong><span>Cities grow and units recover.</span></li>
    </ol>
    <details class="disclosure"><summary>Combat</summary><p>Declare war in Diplomacy. ${tapWord()} an enemy in range to see the damage, then attack.</p></details>
    <details class="disclosure"><summary>Armies</summary><p>Three unhurt units of one type on a tile can form an army.</p></details>
    <details class="disclosure"><summary>Winning</summary><p>Ways to win shows every path and your progress.</p></details>
    <details class="disclosure"><summary>Saving</summary><p>Solo games save after every action. Online games save in the room.</p></details>
    ${keys}${pad}
    <div class="dialog-actions">${button('See goals', {icon: 'goals', data: {open: 'victory'}})}</div>`, {kind: 'help'});
}

export function showDiplomacy() {
  modal(`${dialogHead('Diplomacy')}<div class="rivals">${ui.diplomacyRows() || '<p class="empty">No rivals left.</p>'}</div>`, {kind: 'diplomacy'});
}

export function showWarConfirm(id) {
  const f = g.factionMeta(id);
  modal(`${dialogHead(`Declare war on ${f.leader}?`, 'Their units can attack your cities next turn.')}
    <div class="dialog-actions">
      ${button('Declare war', {icon: 'war', kind: 'danger', data: {diplo: id, intent: 'war-confirmed'}})}
      ${button('Cancel', {data: {closeDialog: 'true'}})}
    </div>`, {kind: 'confirm', size: 'small'});
}

export function showCommands() {
  const unit = g.selectedUnit();
  const cities = g.ownCities().map(c => `<button type="button" class="list-row" data-pad-city="${esc(c.id)}">${icon('city')}<span class="list-text"><strong>${esc(c.name)}</strong><small>${esc(g.production(g.queueId(c))?.name || 'No build set')}</small></span></button>`).join('');
  const units = g.ownUnits().map(u => `<button type="button" class="list-row" data-pad-unit="${esc(u.id)}">${unitIcon(u)}<span class="list-text"><strong>${esc(u.name)}</strong><small>HP ${u.hp}/${u.maxHp} · ${plural(u.moves, 'move')}</small></span></button>`).join('');
  modal(`${dialogHead('Commands')}
    <div class="dialog-actions wrap">
      ${unit ? button('Move', {icon: 'move', kind: 'primary', data: {act: 'orders'}}) : ''}
      ${button('Research', {icon: 'research', data: {open: 'research'}})}
      ${button('Civics', {icon: 'civic', data: {open: 'civics'}})}
      ${button('Policy', {icon: 'policy', data: {open: 'policies'}})}
      ${button('Diplomacy', {icon: 'diplomacy', data: {open: 'diplomacy'}})}
    </div>
    <section class="dialog-section"><h3>Cities</h3><div class="list">${cities}</div></section>
    <section class="dialog-section"><h3>Units</h3><div class="list">${units}</div></section>`, {kind: 'commands'});
}

export function openPanel(name) {
  const panels = {
    research: () => showResearch(false),
    civics: () => showResearch(true),
    policies: showPolicies,
    victory: showGoals,
    goals: showGoals,
    codex: () => ui.showCodex(),
    diplomacy: showDiplomacy,
    history: showHistory,
    help: showHelp,
  };
  panels[name]?.();
}

// Buttons inside the HUD and dialogs.
export function handleGameClick(b) {
  const d = b.dataset;
  if (d.closeDialog) closeModal();
  if (d.open) openPanel(d.open);
  if (d.research && action({type: 'SET_RESEARCH', techId: d.research}).ok !== false && !ctx.multiplayer?.connected) closeModal();
  if (d.civic && action({type: 'SET_CIVIC', civicId: d.civic}).ok !== false && !ctx.multiplayer?.connected) closeModal();
  if (d.policy && action({type: 'SET_POLICY', policyId: d.policy}).ok !== false && !ctx.multiplayer?.connected) closeModal();
  if (d.production) ui.queueProduction(d.cityId, d.production, d.productionTile);
  if (d.cityFocus) {
    const result = action({type: 'SET_CITY_FOCUS', cityId: d.cityId, focus: d.cityFocus});
    if (result.ok && !ctx.multiplayer?.connected) showCity();
  }
  if (d.placeOnMap) closeModal();
  if (d.cancelPlacement) { ctx.districtPlacement = null; closeModal(); ui.render(); }
  if (d.build && action({type: 'BUILD', unitId: ctx.selectedUnitId, improvement: d.build}).ok) closeModal();
  if (d.diplo) {
    if (d.intent === 'war') { showWarConfirm(d.diplo); return; }
    const intent = d.intent === 'war-confirmed' ? 'war' : d.intent;
    const result = action({type: 'DIPLOMACY', factionId: d.diplo, action: intent});
    if (result.ok && $('#modal').open && $('#modal').dataset.kind !== 'diplomacy') closeModal();
    else if (result.ok && $('#modal').open) showDiplomacy();
  }
  if (d.orderTile) {
    closeModal();
    ui.selectTile(d.orderTile);
    ctx.world?.focus(ctx.selectedTileId);
  }
  if (d.confirmTurn) { closeModal(); action({type: 'END_TURN'}); }
  if (d.padCity) { ui.selectCity(d.padCity); showProduction(); }
  if (d.padUnit) { ui.selectUnit(d.padUnit, {focus: true}); closeModal(); }
  if (d.menu === 'save') {
    const saved = save();
    closeModal();
    toast(saved ? (ctx.multiplayer?.connected ? 'Saved in the room.' : 'Game saved.') : 'Save failed. Use Export.');
  }
  if (d.menu === 'export') exportSave();
  if (d.menu === 'import') $('#import-file').click();
  if (d.menu === 'new') ui.returnToTitle();
}

Object.assign(ui, {showResearch, showPolicies, showProduction, showCity, showDistrictPlacement, showBuild, showOrders, showGoals, showVictory, showEliminated, showHistory, showHelp, showDiplomacy, showCommands, openPanel, handleGameClick});
