// Shared UI state and a small function registry.
// Modules register their entry points on `ui` so they can call each other
// without circular live-binding problems at import time.

export const ctx = {
  state: null,
  started: false,
  selectedTileId: null,
  selectedUnitId: null,
  tab: 'cities',
  chosenFaction: null,
  chosenDifficulty: null,
  moveMode: false,
  labels: true,
  districtPlacement: null,
  pendingAttack: null,
  world: null,
  worldFailed: false,
  multiplayer: null,
  preferences: null,
  roomRequestPending: false,
  hintDismissed: false,
  lastSelectionKey: '',
  mapCovered: false,
};

export const ui = {};

export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];

const ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

export const coarsePointer = () => globalThis.matchMedia?.('(pointer:coarse)').matches ?? false;
export const finePointer = () => globalThis.matchMedia?.('(pointer:fine)').matches ?? true;
// "Tap" on touch screens, "Click" with a mouse.
export const tapWord = () => coarsePointer() ? 'Tap' : 'Click';
export const tapWordLower = () => tapWord().toLowerCase();

export const gamepadConnected = () => {
  try { return [...(navigator.getGamepads?.() || [])].some(Boolean); } catch { return false; }
};

export function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
