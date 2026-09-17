// Pre-Genesis browser client: wires the renderer, the HUD modules and input.
import {ctx, ui, $} from './ui/context.js';
import * as worldModule from './world.js';
import * as g from './ui/game.js';
import {installOverlay, closeModal, toast} from './ui/overlay.js';
import './ui/actions.js';
import './ui/dialogs.js';
import './ui/codex.js';
import {minimapPoint, MINIMAP, installDrawer, isDrawerLayout} from './ui/hud.js';
import {loadPreferences, applyPreferences, handleSettingsChange} from './ui/settings.js';
import {installTitle} from './ui/title.js';
import {createSession, openInvite, roomCommand} from './ui/lobby.js';
import {installAudio, toggleMusic} from './ui/audio.js';
import {installInput, dismissHint} from './ui/input.js';
import {isRoomState} from './ui/storage.js';
import {TERRAIN, RESOURCES, GRAPHICS_ERROR} from './ui/text.js';

ctx.preferences = loadPreferences();
ctx.multiplayer = createSession();
installOverlay();

function hover(id) {
  const info = $('#hover-info');
  const t = ctx.started && ctx.state ? g.tile(typeof id === 'string' ? id : id?.id) : null;
  if (!t) { info.classList.remove('show'); return; }
  const unit = g.selectedUnit();
  const preview = unit && t.visible ? g.forecast(unit, t.id) : null;
  let text;
  if (preview?.canAttack) text = `${preview.targetName}: deal ${preview.damage}, take ${preview.retaliation}`;
  else if (t.explored) text = [TERRAIN[t.terrain], t.resource && RESOURCES[t.resource], t.visible && t.owner && g.factionMeta(t.owner).name].filter(Boolean).join(' · ');
  else text = 'Unexplored';
  info.textContent = text;
  info.classList.add('show');
}

function startWorld() {
  try {
    const {WorldView} = worldModule;
    if (typeof WorldView !== 'function') throw Error('world.js has no WorldView');
    ctx.world = new WorldView($('#world'), {
      onTileClick: id => ui.selectTile(typeof id === 'string' ? id : id?.id),
      onUnitClick: id => {
        if (!ctx.started) return;
        const unit = ctx.state.units.find(x => x.id === id);
        if (!unit) return;
        if (unit.faction === ctx.state.player) ui.selectUnit(id);
        else ui.selectTile(unit.tileId);
      },
      onTileHover: hover,
    });
    if (!ctx.world.renderer) throw Error('WebGL unavailable');
  } catch (error) {
    console.warn('3D map unavailable:', error);
    ctx.world = null;
    ctx.worldFailed = true;
    $('#world').innerHTML = `<div class="world-error" role="alert"><h2>Map unavailable</h2><p>${GRAPHICS_ERROR}</p></div>`;
    for (const id of ['#start-game', '#resume-game']) $(id).disabled = true;
    $('#title-note').hidden = false;
    $('#title-note').textContent = GRAPHICS_ERROR;
  }
}

function handleAct(act, event) {
  const unit = g.selectedUnit();
  if (act === 'move') {
    // Keyboard and controller activation opens the destination list; touch and mouse use the map.
    if (event.detail === 0) ui.showOrders();
    else { ctx.moveMode = !ctx.moveMode; ui.render(); }
  }
  if (act === 'orders') ui.showOrders();
  if (act === 'next') { closeModal(); ui.nextUnit(); }
  if (act === 'army' && unit) ui.action({type: 'FORM_ARMY', unitId: unit.id});
  if (act === 'heal' && unit) ui.action({type: 'HEAL', unitId: unit.id});
  if (act === 'power' && unit) ui.action({type: 'HERO_POWER', unitId: unit.id});
  if (act === 'found' && unit) ui.action({type: 'FOUND_CITY', unitId: unit.id});
  if (act === 'build') ui.showBuild();
  if (act === 'production') ui.showProduction();
  if (act === 'city-details') ui.showCity();
  if (act === 'attack' && unit && ctx.pendingAttack) ui.attack(unit, ctx.pendingAttack);
  if (act === 'cancel-attack') { ctx.pendingAttack = null; ui.render(); }
}

document.addEventListener('click', event => {
  const b = event.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.tab) { ui.setTab(d.tab); return; }
  if (d.closeRealm) { ui.toggleRealm(false); return; }
  if (d.openTab) {
    if (d.coachSeen) ctx.coachSawDiplomacy = true;
    closeModal();
    ui.setTab(d.openTab);
    return;
  }
  if (d.city) {
    ui.selectCity(d.city);
    if (isDrawerLayout()) ui.toggleRealm(false);
    return;
  }
  if (d.selectUnit !== undefined) {
    if (d.selectUnit) ui.selectUnit(d.selectUnit, {focus: d.focus === 'true'});
    else { ctx.selectedUnitId = null; ctx.moveMode = false; ui.render(); }
    return;
  }
  if (d.decision) { const decision = g.pendingDecision(); if (decision) ui.openDecision(decision); return; }
  if (d.faction && b.classList.contains('patron-chip')) { ui.selectFaction(d.faction, {scroll: false}); return; }
  if (d.codexMore) { ui.showCodex(d.codexMore, {full: true}); return; }
  if (d.friends) { ui.showLobby(); return; }
  if (d.roomAction) { roomCommand(d.roomAction); return; }
  if (d.menuSection) { ui.showMenu(d.menuSection); return; }
  if (d.resetBindings) { ui.resetBindings(); return; }
  if (d.act) { handleAct(d.act, event); return; }
  ui.handleGameClick(b);
});

document.addEventListener('change', event => {
  const el = event.target;
  if (ui.handleCodexChange(el)) return;
  handleSettingsChange(el);
});

function wireStaticControls() {
  $('#end-turn').addEventListener('click', ui.requestEndTurn);
  $('#help').addEventListener('click', () => ui.showHelp());
  $('#codex').addEventListener('click', () => ui.showCodex());
  $('#menu').addEventListener('click', () => ui.showMenu());
  $('#chronicle').addEventListener('click', () => ui.showHistory());
  $('#goals').addEventListener('click', () => ui.showGoals());
  $('#realm-toggle').addEventListener('click', () => ui.toggleRealm());
  $('#sound').addEventListener('click', toggleMusic);
  $('#zoom-in').addEventListener('click', () => { ctx.world?.zoom(1); dismissHint(); });
  $('#zoom-out').addEventListener('click', () => { ctx.world?.zoom(-1); dismissHint(); });
  $('#home').addEventListener('click', () => ctx.world?.focus(g.ownCities()[0]?.tileId || ctx.selectedTileId));
  const labels = $('#labels');
  labels.setAttribute('aria-pressed', String(ctx.labels));
  labels.addEventListener('click', () => {
    ctx.labels = !ctx.labels;
    ctx.world?.setLabels(ctx.labels);
    labels.setAttribute('aria-pressed', String(ctx.labels));
    toast(ctx.labels ? 'Labels shown.' : 'Labels hidden.');
  });
  $('#friends-button').addEventListener('click', () => ui.showLobby());
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    await ui.importSaveFile(file);
  });
  $('#minimap').addEventListener('click', e => {
    if (!ctx.started) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) * MINIMAP.width / r.width;
    const y = (e.clientY - r.top) * MINIMAP.height / r.height;
    let best = null;
    let bestDistance = Infinity;
    for (const t of ctx.state.tiles) {
      const p = minimapPoint(t);
      const dist = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dist < bestDistance) { best = t; bestDistance = dist; }
    }
    if (!best) return;
    ctx.selectedUnitId = null;
    ui.selectTile(best.id);
    ctx.world?.focus(best.id);
  });
}

// The service-worker update waits until the solo campaign is safely stored.
addEventListener('pre-genesis:before-update', event => {
  if (ctx.multiplayer.busy || ctx.roomRequestPending) {
    event.preventDefault();
    toast('Wait for the room to finish, then update.');
    return;
  }
  if (ctx.started && !ctx.multiplayer.connected && !isRoomState(ctx.state) && !ui.save()) {
    event.preventDefault();
    toast('Export your save before updating.', {tone: 'warning'});
  }
});

matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
  if (ctx.preferences.motion === 'system') applyPreferences();
});

if (g.WORLD_NAME) {
  $('#world').setAttribute('aria-label', `Map of the ${g.WORLD_NAME}`);
  $('#minimap').setAttribute('aria-label', `Overview of the ${g.WORLD_NAME}`);
}
startWorld();
wireStaticControls();
installTitle();
installInput();
installDrawer();
installAudio();
applyPreferences();
ui.showTitle();
openInvite();
