// Solo campaign storage. New keys use the pregenesis- prefix; saves written by
// earlier releases under crowns- keys are still read.
import * as saveValidation from '../save-validation.js';
import {ctx, storage} from './context.js';

export const SAVE_KEY = 'pregenesis-save-v3';
export const LEGACY_SAVE_KEYS = Object.freeze(['crowns-of-the-sundering-v2']);
export const SEAT_KEYS = Object.freeze(['pregenesis-online-seat-v1', 'crowns-online-seat-v1']);

function readRaw(keys) {
  const store = storage();
  if (!store) return null;
  for (const key of keys) {
    try {
      const raw = store.getItem(key);
      if (raw) return raw;
    } catch { return null; }
  }
  return null;
}

export const hasSave = () => !!readRaw([SAVE_KEY, ...LEGACY_SAVE_KEYS]);

// Old saves are migrated (faction and wonder id renames) before validation.
export function validateSave(data) {
  const migrate = saveValidation.migrateCampaignSave || saveValidation.migrateSave;
  const migrated = typeof migrate === 'function' ? (migrate(data) ?? data) : data;
  return saveValidation.validateCampaignSave(migrated);
}

export function loadSave() {
  const raw = readRaw([SAVE_KEY, ...LEGACY_SAVE_KEYS]);
  if (!raw) return null;
  return validateSave(JSON.parse(raw));
}

// Room snapshots are fog-redacted and must never overwrite the solo save.
export const isRoomState = state => !!state?.humanFactions || state?.rngState === undefined;

export function writeSave(state) {
  if (!ctx.started || ctx.multiplayer?.connected || isRoomState(state)) return false;
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function friendlyLoadError(error) {
  console.warn('Save could not be loaded:', error);
  if (error?.message === 'too-large') return 'That file is too large to be a save.';
  return 'This save can’t be loaded. It may be damaged or from another game.';
}

export function savedSeatCode() {
  const fromClient = ctx.multiplayer?.savedRoomCode?.();
  if (typeof fromClient === 'string' || fromClient === null) return fromClient || null;
  const raw = readRaw(SEAT_KEYS);
  if (!raw) return null;
  try {
    const code = JSON.parse(raw)?.code;
    return /^[A-Z0-9]{6,12}$/.test(code) ? code : null;
  } catch { return null; }
}

export function exportFileName(state, leader) {
  const slug = String(leader || state.player)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
  return `pre-genesis-${slug}-turn-${state.turn}.json`;
}
