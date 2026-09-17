// Player commands: every order goes through action(), which applies it to the
// solo engine or sends it to the room, then refreshes the HUD and the save.
import {ctx, ui, $, coarsePointer} from './context.js';
import * as g from './game.js';
import {engine} from './game.js';
import {writeSave, validateSave, friendlyLoadError, exportFileName, loadSave} from './storage.js';
import {toast, modal, closeModal, confirmDialog} from './overlay.js';
import {plural, signed} from './text.js';
import {button, dialogHead} from './markup.js';
import {revealCampaign, endReveal} from './reveal.js';

const FEEDBACK = {
  SET_RESEARCH: 'Research set.',
  SET_CIVIC: 'Civic set.',
  SET_POLICY: 'Policy adopted.',
  SET_CITY_FOCUS: 'Focus changed.',
  SET_PRODUCTION: 'Build set.',
  MOVE: 'Unit moved.',
  ATTACK: 'Attack made. See History.',
  HEAL: 'Resting this turn.',
  HERO_POWER: 'Power used.',
  FOUND_CITY: 'City founded.',
  BUILD: 'Tile improved.',
  FORM_ARMY: 'Army formed.',
  DIPLOMACY: 'Diplomacy done.',
  END_TURN: 'Turn ended.',
};

export function setSaveStatus(text) {
  const el = $('#save-status');
  if (el) el.textContent = text;
}

export function activePlayerName() {
  const room = ctx.multiplayer?.snapshot?.room;
  return room?.players?.find(p => p.id === room.activePlayerId)?.name || 'Another player';
}

export function orderBlockReason() {
  const mp = ctx.multiplayer, s = ctx.state;
  if (!s) return '';
  if (mp?.connected && mp.snapshot?.room?.status === 'waiting') return 'Waiting for players.';
  if (s.winner) return 'Game over.';
  if (g.isEliminated()) return 'Your faction has fallen.';
  if (!mp?.connected) return '';
  if (mp.busy) return 'Sending…';
  if (mp.connectionStatus !== 'connected') return 'Reconnecting…';
  if (!mp.myTurn) return `${activePlayerName()}’s turn.`;
  return '';
}

export function save() {
  if (!ctx.started) return false;
  const mp = ctx.multiplayer;
  if (mp?.connected) {
    setSaveStatus(mp.busy ? 'Sending…' : mp.connectionStatus !== 'connected' ? 'Offline' : 'Online');
    return !mp.busy;
  }
  const ok = writeSave(ctx.state);
  setSaveStatus(ok ? 'Saved' : 'Not saved');
  return ok;
}

// Snapshot of what the player owns, used to report what rivals did during the turn.
export function holdings(state = ctx.state) {
  if (!state) return null;
  const me = state.player;
  return {
    turn: state.turn,
    units: new Map(state.units.filter(u => u.faction === me).map(u => [u.id, {name: u.name, hp: u.hp, kind: u.kind}])),
    cities: new Map(state.cities.filter(c => c.faction === me).map(c => [c.id, {name: c.name, hp: c.hp}])),
    wars: new Set(Object.entries(state.factions.find(f => f.id === me)?.relations || {}).filter(([, r]) => (typeof r === 'string' ? r : r?.status) === 'war').map(([id]) => id)),
    gold: state.factions.find(f => f.id === me)?.gold ?? 0,
  };
}

export function turnEvents(before, state = ctx.state) {
  if (!before || !state) return [];
  const events = [];
  const me = state.player;
  for (const [id, city] of before.cities) {
    const now = state.cities.find(c => c.id === id);
    if (now && now.faction !== me) events.push(`${g.factionMeta(now.faction).leader} took ${city.name}.`);
    else if (now && now.hp < city.hp) events.push(`${city.name} was attacked (−${city.hp - now.hp}).`);
  }
  for (const [id, unit] of before.units) {
    const now = state.units.find(u => u.id === id);
    if (!now && unit.kind !== 'settler' && unit.kind !== 'builder') events.push(`${unit.name} was lost.`);
    else if (now && now.hp < unit.hp) events.push(`${unit.name} was attacked (−${unit.hp - now.hp}).`);
  }
  const relations = state.factions.find(f => f.id === me)?.relations || {};
  for (const [id, r] of Object.entries(relations)) {
    if ((typeof r === 'string' ? r : r?.status) === 'war' && !before.wars.has(id)) events.push(`${g.factionMeta(id).leader} is at war with you.`);
  }
  return events;
}

export function turnSummary(before) {
  const f = g.own();
  const parts = [`Turn ${ctx.state.turn}`];
  if (before && f) parts.push(`${signed(f.gold - before.gold)} gold`);
  parts.push(`${plural(g.readyUnits().length, 'unit')} ready`);
  return parts.join(' · ');
}

export function reportTurn(before) {
  const events = turnEvents(before);
  const summary = turnSummary(before);
  if (!events.length) { toast(summary); return; }
  // One event plus either the turn summary or a pointer to History: two sentences at most.
  const tail = events.length > 1 ? `${plural(events.length - 1, 'more event')} in History.` : `${summary}.`;
  toast(`${events[0]} ${tail}`, {tone: 'warning'});
  const f = g.own();
  if (f && f.goldIncome < 0) setTimeout(() => toast('Gold income is negative.', {tone: 'warning'}), 4000);
}

export function recordWin() {
  if (ctx.state?.winner !== ctx.state?.player) return;
  const prefs = ctx.preferences;
  if (!prefs || prefs.hasWon) return;
  prefs.hasWon = true;
  ui.savePreferences?.();
}

export function action(command) {
  if (ctx.multiplayer?.connected) return ctx.multiplayer.perform(command);
  const before = command.type === 'END_TURN' ? holdings() : null;
  const result = engine.performAction(ctx.state, command);
  if (result.ok) {
    ui.sfx?.(command.type === 'END_TURN' ? 'turn' : command.type === 'ATTACK' ? 'attack' : 'order');
    if (!g.selectedUnit()) ctx.selectedUnitId = null;
    ctx.pendingAttack = null;
    ui.render();
    const saved = save();
    if (command.type === 'END_TURN' && !ctx.state.winner) reportTurn(before);
    else if (saved) toast(result.message || FEEDBACK[command.type] || 'Done.');
    else toast('Not saved. Use Menu, then Export.', {tone: 'warning'});
    if (ctx.state.winner) {
      recordWin();
      ui.showVictory();
    } else if (g.isEliminated()) ui.showEliminated?.();
  } else {
    toast(result.message || 'Not available.', {tone: 'warning'});
  }
  return result;
}

export const feedbackFor = type => FEEDBACK[type] || 'Done.';

function hostileAt(tileId) {
  const s = ctx.state;
  return s.units.some(e => e.tileId === tileId && e.faction !== s.player && g.relation(e.faction) === 'war')
    || s.cities.some(c => c.tileId === tileId && c.faction !== s.player && g.relation(c.faction) === 'war');
}

export function attack(unit, tileId) {
  const result = action({type: 'ATTACK', unitId: unit.id, tileId});
  if (result.ok) {
    ctx.selectedTileId = g.selectedUnit()?.tileId || tileId;
    ui.render();
  }
  return result;
}

export function selectTile(id) {
  if (!ctx.started || !id) return;
  const s = ctx.state;
  if (ctx.districtPlacement) {
    const city = s.cities.find(c => c.id === ctx.districtPlacement.cityId);
    const option = city && ui.districtOptions(city, ctx.districtPlacement.kind).find(t => t.id === id);
    if (!option) { toast('Pick an outlined tile.'); return; }
    queueProduction(city.id, ctx.districtPlacement.kind, id);
    return;
  }
  const target = g.tile(id);
  if (!target) return;
  const unit = g.selectedUnit();
  if (unit && id !== ctx.selectedTileId) {
    if (target.visible && hostileAt(id)) {
      const preview = g.forecast(unit, id);
      if (preview?.canAttack) {
        if (coarsePointer() && ctx.pendingAttack !== id) {
          ctx.pendingAttack = id;
          ui.render();
          toast(`${preview.targetName}: deal ${preview.damage}, take ${preview.retaliation}. Tap again to attack.`);
          return;
        }
        attack(unit, id);
        return;
      }
      if (unit.strength > 0) {
        toast(preview?.reason || (unit.moves > 0 ? 'Too far to attack. Move closer.' : 'No moves left this turn.'));
        return;
      }
    }
    if (g.reachable(unit).includes(id)) {
      if (action({type: 'MOVE', unitId: unit.id, tileId: id}).ok) {
        ctx.selectedTileId = g.selectedUnit()?.tileId || id;
        ctx.moveMode = false;
        ui.render();
      }
      return;
    }
    const ownPiece = s.units.some(u => u.tileId === id && u.faction === s.player)
      || s.cities.some(c => c.tileId === id && c.faction === s.player);
    const step = !ownPiece && target.explored !== false && unit.moves > 0 ? g.stepToward(unit, id) : null;
    if (step) {
      if (action({type: 'MOVE', unitId: unit.id, tileId: step}).ok) {
        ctx.selectedTileId = g.selectedUnit()?.tileId || step;
        ctx.moveMode = false;
        ui.render();
        toast('On the way. Click the tile again next turn.');
      }
      return;
    }
    if (ctx.moveMode) { toast('Too far. Pick a lit tile.'); return; }
  }
  ctx.selectedTileId = id;
  ctx.pendingAttack = null;
  const city = s.cities.find(c => c.tileId === id && c.faction === s.player);
  ctx.selectedUnitId = city ? null : s.units.find(u => u.tileId === id && u.faction === s.player)?.id || null;
  ctx.moveMode = false;
  ui.render();
}

export function selectUnit(id, {focus = false} = {}) {
  const unit = ctx.state.units.find(u => u.id === id);
  if (!unit || unit.faction !== ctx.state.player) return;
  ctx.selectedUnitId = unit.id;
  ctx.selectedTileId = unit.tileId;
  ctx.moveMode = false;
  ctx.pendingAttack = null;
  if (focus) ctx.world?.focus(unit.tileId);
  ui.render();
}

export function selectCity(id, {focus = true} = {}) {
  const city = ctx.state.cities.find(c => c.id === id);
  if (!city) return;
  ctx.selectedTileId = city.tileId;
  ctx.selectedUnitId = null;
  ctx.moveMode = false;
  ctx.pendingAttack = null;
  if (focus) ctx.world?.focus(city.tileId);
  ui.render();
}

// Only units that still have orders to give are cycled.
export function nextUnit() {
  const list = g.readyUnits();
  if (!list.length) { toast('All units have moved.'); return; }
  const current = list.findIndex(u => u.id === ctx.selectedUnitId);
  selectUnit(list[(current + 1) % list.length].id, {focus: true});
}

export function queueProduction(cityId, productionId, tileId) {
  const city = ctx.state.cities.find(c => c.id === cityId);
  if (!city || city.faction !== ctx.state.player) return;
  const item = g.production(productionId);
  if (ctx.state.ruleset === g.TRAIT_RULESET && item?.kind === 'district' && !tileId) {
    ui.showDistrictPlacement(city, item);
    return;
  }
  const result = action({type: 'SET_PRODUCTION', cityId, productionId, ...(tileId ? {tileId} : {})});
  if (result.ok) {
    ctx.districtPlacement = null;
    closeModal();
    ui.render();
  }
}

export function openDecision(decision) {
  ctx.districtPlacement = null;
  if (decision.city) {
    selectCity(decision.city.id);
    ui.showProduction();
  } else ui.openPanel(decision.panel);
}

export function requestEndTurn() {
  const blocked = orderBlockReason();
  if (blocked) { toast(blocked); return; }
  const decision = g.pendingDecision();
  if (decision) { openDecision(decision); return; }
  ctx.moveMode = false;
  ctx.districtPlacement = null;
  ctx.pendingAttack = null;
  if (!ctx.preferences.confirmTurn) { action({type: 'END_TURN'}); return; }
  const ready = g.readyUnits().length;
  modal(`${dialogHead(`End turn ${ctx.state.turn}?`, ready ? `${plural(ready, 'unit')} can still move.` : 'All units have moved.')}
    <div class="dialog-actions">
      ${button('End turn', {kind: 'primary', icon: 'arrow-right', data: {confirmTurn: 'true'}})}
      ${button('Cancel', {data: {closeDialog: 'true'}})}
    </div>`, {kind: 'confirm', size: 'small'});
}

export function enterGame() {
  const s = ctx.state;
  ctx.started = true;
  ctx.moveMode = false;
  ctx.pendingAttack = null;
  ctx.districtPlacement = null;
  ctx.selectedUnitId = null;
  ctx.selectedTileId = g.ownCities()[0]?.tileId || g.ownUnits()[0]?.tileId || s.tiles[0]?.id;
  ctx.hintDismissed = false;
  if (typeof ctx.world?.setShowcase === 'function') ctx.world.setShowcase(null);
  else ctx.world?.setLabels?.(ctx.labels);
  document.body.dataset.screen = 'game';
  $('#welcome').hidden = true;
  $('#game').hidden = false;
  $('#game').inert = false;
  closeModal();
  ui.render();
  ctx.world?.focus(ctx.selectedTileId);
  ctx.world?.renderer?.domElement?.focus?.({preventScroll: true});
}

export function begin(loaded = null) {
  ctx.multiplayer?.disconnect();
  ctx.state = loaded || g.newCampaign(ctx.chosenFaction, ctx.chosenDifficulty);
  enterGame();
  save();
  if (loaded) toast('Campaign loaded.');
  else {
    const meta = g.factionMeta(ctx.state.player);
    const capital = g.ownCities()[0]?.name;
    const line = capital ? `${meta.leader} rules from ${capital}.` : 'Campaign started.';
    // The reveal says it on screen first; the toast repeats it for screen readers.
    if (!revealCampaign(meta, {capital, era: g.era()?.name, onDone: () => toast(line)})) toast(line);
  }
}

// Title buttons: a room seat held from the lobby is released before solo play starts.
export async function startNew() {
  if (!(await leaveRoomIfNeeded())) return;
  begin();
}

export async function resumeSave() {
  let loaded;
  try {
    loaded = loadSave();
  } catch (error) {
    toast(friendlyLoadError(error), {tone: 'warning'});
    return;
  }
  if (!loaded) { toast('No saved campaign on this device.'); return; }
  if (!(await leaveRoomIfNeeded())) return;
  begin(loaded);
}

export async function importSaveFile(file) {
  try {
    if (!file) return;
    if (file.size > 3e6) throw Error('too-large');
    const loaded = validateSave(JSON.parse(await file.text()));
    if (!(await leaveRoomIfNeeded())) return;
    begin(loaded);
  } catch (error) {
    toast(friendlyLoadError(error), {tone: 'warning'});
  }
}

export async function exportSave() {
  if (ctx.multiplayer?.connected) { toast('Online games are saved in the room.'); return; }
  const filename = exportFileName(ctx.state, g.factionMeta(ctx.state.player).leader);
  const json = JSON.stringify(ctx.state, null, 2);
  try {
    const native = globalThis.PREGENESIS_NATIVE;
    if (native?.exportSave) {
      const shared = await native.exportSave(filename, json);
      toast(shared ? 'Save shared.' : 'Export cancelled.');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Save exported.');
  } catch {
    toast('Export failed. Your game is still open.', {tone: 'warning'});
  }
}

// Leaving a room releases the seat on the server so the others are not stuck.
export async function leaveRoomIfNeeded() {
  const mp = ctx.multiplayer;
  if (!mp?.connected) return true;
  const code = mp.credentials?.code || mp.snapshot?.room?.code || '';
  const active = mp.snapshot?.room?.status === 'active';
  if (active) {
    const ok = await confirmDialog({title: `Leave room ${code}?`, text: 'The game will play your faction.', confirm: 'Leave room', danger: true});
    if (!ok) return false;
  }
  try { await mp.leave(); } catch { mp.disconnect(true); }
  ui.renderRoomBar?.();
  return true;
}

export async function returnToTitle() {
  if (!(await leaveRoomIfNeeded())) return;
  endReveal();
  closeModal();
  ui.showTitle();
}

Object.assign(ui, {action, selectTile, selectUnit, selectCity, nextUnit, queueProduction, requestEndTurn, begin, startNew, enterGame, save, orderBlockReason, exportSave, returnToTitle, resumeSave, importSaveFile, openDecision, reportTurn, holdings, turnEvents, attack});
