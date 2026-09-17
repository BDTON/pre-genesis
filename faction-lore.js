// The codex dossier for every playable realm: the tradition's own sources (lore-*.js) plus a
// short note naming where the realm, capital and power names come from.
import {FACTIONS} from './factions.js';
import {LORE_BIBLICAL} from './lore-biblical.js';
import {LORE_CLASSICAL} from './lore-classical.js';
import {LORE_WORLD} from './lore-world.js';

const DOSSIERS = {...LORE_BIBLICAL, ...LORE_CLASSICAL, ...LORE_WORLD};

export const realmNote = faction => [
  `Realm: ${faction.name} — ${faction.sources.name}.`,
  `Capital: ${faction.capital} — ${faction.sources.capital}.`,
  `Power: ${faction.powerName} — ${faction.sources.powerName}.`,
].join(' ');

export const FACTION_LORE = Object.freeze(Object.fromEntries(FACTIONS.map(faction => [
  faction.id,
  Object.freeze({...DOSSIERS[faction.id], adaptation: realmNote(faction)}),
])));

export const LORE_REVIEW_DATE = '2026-09-17';
