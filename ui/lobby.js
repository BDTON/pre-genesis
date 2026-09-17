// Online rooms: create/join form, lobby with seats, in-game room bar and turn clock.
import {ctx, ui, $, $$, esc} from './context.js';
import * as g from './game.js';
import * as client from '../multiplayer-client.js';
import {icon, crest} from './icons.js';
import {button, dialogHead} from './markup.js';
import {modal, closeModal, toast, isModalOpen} from './overlay.js';
import {clock} from './text.js';
import {savedSeatCode} from './storage.js';
import {feedbackFor, holdings, reportTurn, enterGame, leaveRoomIfNeeded, activePlayerName} from './actions.js';
import {savePreferences} from './settings.js';

const CODE_PATTERN = /^[A-Z2-9]{8}$/;
const MAX_SEATS = 4;
let countdownTimer = 0;
let serverOffset = 0;
let eliminatedShown = false;
let victoryShown = '';

export function apiHost() {
  const base = typeof client.getApiBase === 'function' ? client.getApiBase() : typeof client.apiBase === 'function' ? client.apiBase() : '';
  try { return base ? new URL(base).host : location.host; } catch { return ''; }
}

export const normalizeCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function turnDeadline(room) {
  if (!room || room.status !== 'active') return null;
  const direct = room.turnDeadline ?? room.deadline ?? room.turnEndsAt;
  if (Number.isFinite(direct)) return direct;
  if (Number.isFinite(room.turnStartedAt)) return room.turnStartedAt + (room.turnSeconds ?? 120) * 1000;
  return null;
}

function remaining(room) {
  const deadline = turnDeadline(room);
  return deadline === null ? null : deadline - (Date.now() + serverOffset);
}

function factionOptions(selectedId, {anyLabel = ''} = {}) {
  const groups = new Map();
  for (const f of g.FACTIONS) {
    if (!groups.has(f.tradition)) groups.set(f.tradition, []);
    groups.get(f.tradition).push(f);
  }
  return (anyLabel ? `<option value="" ${selectedId ? '' : 'selected'}>${esc(anyLabel)}</option>` : '')
    + [...groups].map(([tradition, list]) => `<optgroup label="${esc(tradition)}">${list.map(f =>
      `<option value="${esc(f.id)}" ${f.id === selectedId ? 'selected' : ''}>${esc(f.leader)}${f.patron && f.patron !== f.leader ? ` · ${esc(f.patron)}` : ''}</option>`).join('')}</optgroup>`).join('');
}

function seatList(room, you) {
  const current = room.activePlayerId;
  const left = remaining(room);
  const seats = room.players.map(p => {
    const f = g.factionMeta(p.faction);
    const badges = [p.id === you.id ? 'You' : '', p.id === room.hostId ? 'Host' : '', p.defeated ? 'Fallen' : p.away ? 'Away' : ''].filter(Boolean);
    const turn = room.status === 'active' && p.id === current;
    const ready = typeof p.ready === 'boolean' && room.status === 'waiting' ? (p.ready ? 'Ready' : 'Not ready') : '';
    return `<li class="seat${turn ? ' is-active' : ''}">
      ${crest(p.faction)}
      <span class="seat-text"><strong>${esc(p.name)}</strong><small>${esc(f.leader)}${ready ? ` · ${ready}` : ''}</small></span>
      ${badges.map(b => `<span class="badge">${b}</span>`).join('')}
      ${turn ? `<span class="badge badge-turn">${icon('timer')}<span data-countdown>${left === null ? 'Turn' : clock(left)}</span></span>` : ''}
    </li>`;
  });
  if (room.status === 'waiting') {
    for (let i = room.players.length; i < MAX_SEATS; i++) seats.push(`<li class="seat is-open">${icon('players')}<span class="seat-text"><strong>Open seat</strong><small>Played by the game</small></span></li>`);
  }
  return `<ul class="seats">${seats.join('')}</ul>`;
}

function roomView(snap) {
  const {room, you} = snap;
  const waiting = room.status === 'waiting';
  const finished = room.status === 'finished';
  const host = room.players.find(p => p.id === room.hostId);
  const invite = ctx.multiplayer.inviteURL();
  const canReady = typeof ctx.multiplayer.setReady === 'function' && typeof you.ready === 'boolean';
  const sub = waiting ? `${room.players.length} of ${MAX_SEATS} players; the game plays empty seats.`
    : finished ? 'Game over.' : 'Players take turns; the round ends after everyone moves.';
  let status = '';
  if (waiting) status = you.isHost ? (room.players.length < 2 ? 'Needs 2+ players to start.' : 'Start when everyone is in.') : `Waiting for ${host?.name || 'the host'} to start.`;
  else if (you.away) status = 'Your turns are skipped until you return.';
  else if (!finished) status = ctx.multiplayer.myTurn ? 'Your turn.' : `${activePlayerName()}’s turn.`;
  const canReturn = you.away && typeof ctx.multiplayer.back === 'function';
  const actions = [
    canReturn ? button('Resume turns', {icon: 'play', kind: 'primary', data: {roomAction: 'back'}}) : '',
    button('Copy link', {icon: 'link', data: {roomAction: 'copy'}}),
    waiting && canReady ? button(you.ready ? 'Not ready' : 'Ready', {icon: 'check', data: {roomAction: 'ready'}, pressed: !!you.ready}) : '',
    waiting && you.isHost ? button('Start', {icon: 'play', kind: 'primary', data: {roomAction: 'start'}, disabled: room.players.length < 2}) : '',
    !waiting ? button('Back to map', {icon: 'terrain', kind: canReturn ? 'secondary' : 'primary', data: {roomAction: 'return'}}) : '',
    button(waiting ? 'Leave' : 'Leave room', {icon: 'leave', kind: 'danger', data: {roomAction: 'leave'}}),
  ].join('');
  return `${dialogHead(`Room ${room.code}`, sub)}
    <div class="room-code"><span class="code" aria-label="Room code ${[...room.code].join(' ')}">${esc(room.code)}</span>
      <input class="invite" value="${esc(invite)}" readonly aria-label="Invite link"></div>
    ${seatList(room, you)}
    ${status ? `<p class="status-line" role="status">${esc(status)}</p>` : ''}
    <div class="dialog-actions wrap">${actions}</div>
    <p class="error-line" id="friend-error" role="alert"></p>`;
}

function formView({code = ''} = {}) {
  const saved = savedSeatCode();
  const name = ctx.preferences.playerName || '';
  return `${dialogHead('Play online', 'Create a room for 2–4 players, then share the link.')}
    <div class="form">
      <label class="field"><span class="field-label"><strong>Name</strong></span>
        <input id="friend-name" maxlength="32" autocomplete="nickname" placeholder="Your name" value="${esc(name)}"></label>
      <label class="field"><span class="field-label"><strong>Faction</strong></span>
        <select id="friend-faction">${factionOptions(ctx.chosenFaction)}</select></label>
      ${button('Create room', {icon: 'new', kind: 'primary', data: {roomAction: 'create'}})}
      <p class="divider"><span>or join</span></p>
      <label class="field"><span class="field-label"><strong>Room code</strong></span>
        <input id="friend-code" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD2345" value="${esc(code)}"></label>
      <label class="field"><span class="field-label"><strong>Your faction</strong></span>
        <select id="join-faction">${factionOptions('', {anyLabel: 'Any free faction'})}</select></label>
      ${button('Join', {icon: 'arrow-right', data: {roomAction: 'join'}})}
      ${saved ? button(`Rejoin ${saved}`, {icon: 'online', kind: 'ghost', data: {roomAction: 'resume'}}) : ''}
      <p class="error-line" id="friend-error" role="alert"></p>
    </div>`;
}

export function showLobby(options = {}) {
  const snap = ctx.multiplayer.snapshot;
  const connected = ctx.multiplayer.connected && snap;
  const focus = connected ? '[data-room-action="copy"]' : options.code ? '#friend-name' : '#friend-name';
  modal(connected ? roomView(snap) : formView(options), {kind: 'lobby', focus});
  $('#modal-body').dataset.roomPanel = connected ? (snap.room.status === 'waiting' ? 'lobby' : 'room') : 'lobby';
  syncRoomControls();
  syncCountdown();
}

export function syncRoomControls() {
  $$('[data-room-action]').forEach(b => {
    if (['copy', 'return'].includes(b.dataset.roomAction)) return;
    if (ctx.roomRequestPending && !b.disabled) { b.dataset.roomLocked = 'true'; b.disabled = true; }
    else if (!ctx.roomRequestPending && b.dataset.roomLocked) { b.disabled = false; delete b.dataset.roomLocked; }
  });
}

function setError(text, detail = '') {
  const target = $('#friend-error');
  if (target) {
    target.textContent = text;
    if (text && detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      target.append(document.createElement('br'), small);
    }
  } else if (text) toast(text, {tone: 'warning'});
}

// Errors without an HTTP status never reached the server; name the server to help.
function showRequestError(error) {
  const message = error?.message || 'Can’t reach the game server. Try again.';
  const host = apiHost();
  setError(message, !error?.status && host ? `Server: ${host}` : '');
}

async function copyInvite() {
  const url = ctx.multiplayer.inviteURL();
  try {
    if (globalThis.PREGENESIS_NATIVE?.copyText) await globalThis.PREGENESIS_NATIVE.copyText(url);
    else await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch {
    toast('Copy failed. Share the link above.');
    $('.room-code .invite')?.select();
  }
}

export async function roomCommand(command) {
  if (ctx.roomRequestPending) return;
  const mp = ctx.multiplayer;
  if (command === 'copy') { await copyInvite(); return; }
  if (command === 'return') { closeModal(); return; }
  ctx.roomRequestPending = true;
  syncRoomControls();
  setError('');
  try {
    if (command === 'create' || command === 'join') {
      const name = $('#friend-name').value.trim();
      if (!name) { setError('Enter your name.'); return; }
      ctx.preferences.playerName = name;
      savePreferences();
      if (command === 'create') {
        const faction = $('#friend-faction').value;
        await mp.create(name, faction, crypto.getRandomValues(new Uint32Array(1))[0] || 1);
      } else {
        const code = normalizeCode($('#friend-code').value);
        if (!CODE_PATTERN.test(code)) { setError('Room codes are 8 letters or digits.'); return; }
        await mp.join(code, name, $('#join-faction').value || undefined);
      }
    }
    if (command === 'resume' && !(await mp.resume())) setError('No saved room on this device.');
    if (command === 'start') await mp.start();
    if (command === 'ready') await mp.setReady?.(!mp.snapshot?.you?.ready);
    if (command === 'skip') await mp.skip?.();
    if (command === 'back') await mp.back?.();
    if (command === 'leave') {
      if (!(await leaveRoomIfNeeded())) return;
      eliminatedShown = false;
      document.title = 'Pre-Genesis';
      if (ctx.started) { closeModal(); ui.showTitle(); }
      else showLobby();
    }
  } catch (error) {
    showRequestError(error);
  } finally {
    ctx.roomRequestPending = false;
    syncRoomControls();
  }
}

// Called for every confirmed room snapshot.
export function onSnapshot(snap) {
  if (Number.isFinite(snap.serverTime ?? snap.now)) serverOffset = (snap.serverTime ?? snap.now) - Date.now();
  const body = $('#modal-body');
  const panel = isModalOpen() ? body.dataset.roomPanel : 'false';
  const inLobby = !ctx.started || !$('#welcome').hidden || panel === 'lobby';
  if (!snap.state) {
    if (isModalOpen() && panel !== 'false') showLobby();
    renderRoomBar();
    return;
  }
  const previousState = ctx.started && !inLobby ? ctx.state : null;
  const before = previousState ? holdings(previousState) : null;
  const previousUnit = ctx.selectedUnitId;
  const previousTile = ctx.selectedTileId;
  ctx.state = snap.state;
  if (inLobby) {
    enterGame();
  } else {
    ctx.selectedUnitId = ctx.state.units.some(u => u.id === previousUnit && u.faction === ctx.state.player) ? previousUnit : null;
    ctx.selectedTileId = g.selectedUnit()?.tileId || ctx.state.tiles.find(t => t.id === previousTile && t.explored)?.id || g.ownCities()[0]?.tileId || g.ownUnits()[0]?.tileId || ctx.state.tiles[0]?.id;
    if (snap.confirmedAction && isModalOpen() && panel === 'false') closeModal();
  }
  if (snap.confirmedAction === 'SET_PRODUCTION') ctx.districtPlacement = null;
  ui.render();
  if (isModalOpen() && panel === 'room') showLobby();
  if (before && ctx.state.turn > before.turn) reportTurn(before);
  else if (snap.confirmedAction) toast(snap.message || feedbackFor(snap.confirmedAction));
  else if (snap.message) toast(snap.message);
  // Each result is announced once; "View map" must stay closed on later snapshots.
  const resultKey = ctx.state.winner ? `${snap.room.code}:${ctx.state.winner}` : '';
  if (resultKey && resultKey !== victoryShown) { victoryShown = resultKey; ui.showVictory(); }
  else if (!resultKey && g.isEliminated() && !eliminatedShown) { eliminatedShown = true; ui.showEliminated(); }
  document.title = ctx.multiplayer.myTurn ? 'Your turn · Pre-Genesis' : 'Pre-Genesis';
}

export function renderRoomBar() {
  const bar = $('#room-bar');
  if (!bar) return;
  const mp = ctx.multiplayer;
  if (!mp?.connected || !mp.snapshot || !ctx.started) {
    bar.hidden = true;
    syncCountdown();
    return;
  }
  const {room} = mp.snapshot;
  bar.hidden = false;
  bar.dataset.status = mp.connectionStatus;
  const left = remaining(room);
  const status = mp.busy ? 'Sending…'
    : mp.connectionStatus !== 'connected' ? 'Reconnecting…'
    : room.status === 'waiting' ? 'Waiting for players'
    : room.status === 'finished' ? 'Game over'
    : mp.myTurn ? 'Your turn' : `${activePlayerName()}’s turn`;
  const away = left !== null && left < 0 && !mp.myTurn && typeof mp.skip === 'function';
  const markup = `${button(`Room ${room.code}`, {icon: 'players', kind: 'ghost', data: {friends: 'true'}})}
    <span class="room-status" role="status">${esc(status)}</span>
    ${left !== null && room.status === 'active' ? `<span class="room-clock">${icon('timer')}<span data-countdown>${clock(left)}</span></span>` : ''}
    ${away ? button('Skip turn', {icon: 'next', data: {roomAction: 'skip'}}) : ''}`;
  if (bar.dataset.html !== markup) {
    const focused = bar.contains(document.activeElement);
    bar.innerHTML = markup;
    bar.dataset.html = markup;
    if (focused) bar.querySelector('button')?.focus({preventScroll: true});
  }
  if (ctx.started) $('#save-status').textContent = mp.busy ? 'Sending…' : mp.connectionStatus !== 'connected' ? 'Offline' : 'Online';
  syncCountdown();
}

function tickCountdown() {
  const room = ctx.multiplayer?.snapshot?.room;
  const left = remaining(room);
  if (left === null) { syncCountdown(); return; }
  for (const el of $$('[data-countdown]')) el.textContent = clock(left);
  if (left < 0 && typeof ctx.multiplayer.skip === 'function') renderRoomBar();
}

function syncCountdown() {
  const needed = !!ctx.multiplayer?.connected && remaining(ctx.multiplayer.snapshot?.room) !== null;
  if (needed && !countdownTimer) countdownTimer = setInterval(tickCountdown, 1000);
  if (!needed && countdownTimer) { clearInterval(countdownTimer); countdownTimer = 0; }
}

export async function openInvite() {
  const match = /^#room=([A-Z2-9]{8})$/.exec(location.hash);
  if (!match) return false;
  const code = match[1];
  if (savedSeatCode() === code) {
    try { if (await ctx.multiplayer.resume()) return true; }
    catch (error) { toast(error?.message || 'Can’t reach the game server. Try again.', {tone: 'warning'}); }
  }
  showLobby({code});
  return true;
}

export function createSession() {
  return new client.FriendSession({
    onError: message => toast(message, {tone: 'warning'}),
    onBusy: () => { ui.refreshStatus?.(); renderRoomBar(); },
    onConnection: () => { ui.refreshStatus?.(); renderRoomBar(); },
    onSnapshot,
  });
}

Object.assign(ui, {showLobby, renderRoomBar, roomCommand, openInvite});
