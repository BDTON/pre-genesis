// Read-only helpers over the engine state. New engine APIs are feature-detected
// so the interface keeps working while the rules change underneath it.
import * as engine from '../engine.js';
import {ctx} from './context.js';
import {DIFFICULTY_TEXT, capitalize} from './text.js';

export {engine};
export const {FACTIONS, TECHS, CIVICS, POLICIES, PRODUCTIONS, HERO_POWERS} = engine;
export const VICTORY_GOALS = engine.VICTORY_GOALS || [];
export const TRAIT_RULESET = engine.TRAIT_RULESET;

const FALLBACK_FACTION = {name: '', leader: '', patron: '', tradition: '', capital: '', color: '#A9B4C8'};
export const factionMeta = id => FACTIONS.find(f => f.id === id) || {...FALLBACK_FACTION, id, name: String(id ?? ''), leader: String(id ?? '')};

export const defaultFactionId = () => FACTIONS[0]?.id;

export const state = () => ctx.state;
export const own = () => engine.getFaction(ctx.state, ctx.state.player);
export const ownCities = () => ctx.state.cities.filter(c => c.faction === ctx.state.player);
export const ownUnits = () => ctx.state.units.filter(u => u.faction === ctx.state.player);
export const selectedUnit = () => {
  const u = ctx.state.units.find(x => x.id === ctx.selectedUnitId);
  return u && u.faction === ctx.state.player ? u : null;
};
export const selectedCity = () => ctx.state.cities.find(c => c.tileId === ctx.selectedTileId) || null;
export const tile = id => engine.getTile(ctx.state, id);
export const queueId = city => typeof city.queue === 'string' ? city.queue : city.queue?.id || city.queue?.productionId || null;
export const production = id => PRODUCTIONS.find(p => p.id === id) || null;
export const techName = id => TECHS.find(t => t.id === id)?.name || '';
export const civicName = id => CIVICS.find(c => c.id === id)?.name || '';

export function relation(id) {
  const r = own()?.relations?.[id];
  return typeof r === 'string' ? r : r?.status || 'peace';
}

export const activeFactions = () => ctx.state.factions.map(f => factionMeta(f.id));
export const rivals = () => activeFactions().filter(f => f.id !== ctx.state.player);

export function totalYields() {
  const total = {food: 0, production: 0, gold: 0, science: 0, culture: 0};
  for (const city of ownCities()) {
    const y = engine.cityYields(ctx.state, city);
    for (const key of Object.keys(total)) total[key] += y[key] || 0;
  }
  return total;
}

export const population = () => ownCities().reduce((n, c) => n + c.population, 0);
export const readyUnits = () => ownUnits().filter(u => u.moves > 0 && !u.healing);
export const isEliminated = () => !!ctx.state?.eliminated?.includes?.(ctx.state.player);

export function era(s = ctx.state) {
  if (!s || typeof engine.getEra !== 'function') return null;
  try {
    const value = engine.getEra(s);
    if (typeof value === 'string') return {index: 0, name: value};
    return value?.name ? value : null;
  } catch { return null; }
}

export function difficulties() {
  const raw = engine.DIFFICULTIES;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([id, value]) => ({id, ...(value && typeof value === 'object' ? value : {})}));
  return list.map(item => {
    const id = typeof item === 'string' ? item : item.id;
    const text = DIFFICULTY_TEXT[id] || [capitalize(id), ''];
    return {
      id,
      name: (typeof item === 'object' && (item.name || item.label)) || text[0],
      description: (typeof item === 'object' && item.description) || text[1],
    };
  }).filter(d => d.id);
}

export function stateDifficulty(s = ctx.state) {
  const id = s?.difficulty;
  return difficulties().find(d => d.id === id) || null;
}

export function newCampaignWithSeed(factionId, seed, difficulty) {
  const options = difficulty ? {difficulty} : {};
  try { return engine.createGame(factionId, seed, options); }
  catch { return engine.createGame(factionId, seed); }
}

// Every new solo campaign gets its own random map.
export function newCampaign(factionId, difficulty) {
  const seed = typeof engine.randomSeed === 'function' ? engine.randomSeed() : crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  return newCampaignWithSeed(factionId, seed, difficulty);
}

export function foundableTileIds(unit) {
  if (!unit || unit.kind !== 'settler' || typeof engine.foundableTiles !== 'function') return null;
  try {
    return (engine.foundableTiles(ctx.state, unit.id) || []).map(t => typeof t === 'string' ? t : t?.id).filter(Boolean);
  } catch { return null; }
}

// One shape for combat previews regardless of which engine export provides it.
export function forecast(unit, tileId) {
  if (!unit) return null;
  const fn = typeof engine.combatForecast === 'function' ? engine.combatForecast : engine.previewCombat;
  let raw = null;
  try { raw = fn(ctx.state, unit.id, tileId); } catch { raw = null; }
  if (!raw) return null;
  return {
    canAttack: !!(raw.canAttack ?? raw.ok ?? raw.legal),
    damage: Math.round(raw.damage ?? raw.dealt ?? raw.defenderDamage ?? 0),
    retaliation: Math.round(raw.retaliation ?? raw.taken ?? raw.attackerDamage ?? 0),
    targetName: raw.targetName ?? raw.target?.name ?? '',
    targetHp: raw.targetHp ?? raw.target?.hp,
    kills: !!(raw.kills ?? raw.lethal ?? (raw.targetHp !== undefined && raw.damage >= raw.targetHp)),
    reason: raw.reason || raw.message || '',
  };
}

export function reachable(unit) {
  if (!unit || unit.moves <= 0) return [];
  try { return engine.reachableTiles(ctx.state, unit.id); } catch { return []; }
}

export function attackableTiles(unit) {
  if (!unit) return [];
  return ctx.state.tiles.filter(t => t.visible && forecast(unit, t.id)?.canAttack).map(t => t.id);
}

export function formArmyStatus(unit) {
  if (!['warrior', 'archer', 'rider'].includes(unit.kind) || unit.armySize === 3) return null;
  const fresh = u => u.hp === u.maxHp && u.moves === u.maxMoves && !u.acted && (u.armySize ?? 1) !== 3;
  const count = ownUnits().filter(x => x.tileId === unit.tileId && x.kind === unit.kind && fresh(x)).length;
  return {ready: fresh(unit) && count >= 3, count: Math.min(3, count)};
}

export function heroPower(unit) {
  return HERO_POWERS.find(p => p.factionId === unit?.faction) || null;
}

export function pendingDecision() {
  const s = ctx.state;
  if (!s || s.ruleset !== TRAIT_RULESET || s.winner || isEliminated()) return null;
  const city = ownCities().find(c => !queueId(c));
  if (city) return {kind: 'city', city, label: 'Pick build'};
  const f = own();
  const open = (list, done) => list.some(t => !f[done].includes(t.id) && (t.requires || []).every(id => f[done].includes(id)));
  if (!f.research && open(TECHS, 'techs')) return {kind: 'research', panel: 'research', label: 'Pick research'};
  if (!f.civic && open(CIVICS, 'civics')) return {kind: 'civic', panel: 'civics', label: 'Pick civic'};
  return null;
}

// Victory paths described entirely from engine data.
export function spireWonder() {
  const projects = new Set(VICTORY_GOALS.map(g => g.projectId));
  return PRODUCTIONS.find(p => p.kind === 'wonder' && !projects.has(p.id)) || null;
}

export const VICTORIES = engine.VICTORIES || [];
export const WORLD_NAME = engine.WORLD?.name || '';

export function victoryInfo(type) {
  return VICTORIES.find(v => v.id === type) || null;
}

export function victoryLabel(type) {
  if (!type) return 'Victory';
  const named = victoryInfo(type)?.name;
  if (named) return named;
  if (type === 'domination' || type === 'conquest') return 'Conquest';
  const goal = VICTORY_GOALS.find(g => g.id === type);
  const wonder = production(goal?.projectId) || production(type) || spireWonder();
  return wonder ? wonder.name : capitalize(type);
}

export function capitalsHeld(factionId = ctx.state.player) {
  const total = ctx.state.factions.length;
  const held = ctx.state.cities.filter(c => c.capitalOf && c.faction === factionId).length;
  return {held, total};
}

export function rivalProjects() {
  const wonders = new Set(PRODUCTIONS.filter(p => p.kind === 'wonder').map(p => p.id));
  return ctx.state.cities
    // Rival victory projects are public knowledge, like a wonder race.
    .filter(c => c.faction !== ctx.state.player && wonders.has(queueId(c)))
    .map(c => ({city: c, faction: factionMeta(c.faction), project: production(queueId(c))}))
    .filter(x => x.project);
}

export const turnsFor = (remaining, perTurn) => Math.max(1, Math.ceil(Math.max(0, remaining) / Math.max(1, perTurn)));
