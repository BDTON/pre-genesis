import { FACTIONS, TECHS, CIVICS, POLICIES, PRODUCTIONS } from './engine.js';
import {TRAIT_RULESET} from './faction-traits.js';
import {CITY_FOCUSES,DISTRICT_KINDS,districtLimit} from './city-planning.js';

const factionCatalog = new Set(FACTIONS.map(f => f.id));
const techs = new Set(TECHS.map(t => t.id));
const civics = new Set(CIVICS.map(c => c.id));
const policies = new Set(POLICIES.map(p => p.id));
const productions = new Set(PRODUCTIONS.map(p => p.id));
const buildings = new Set(PRODUCTIONS.filter(p => ['building', 'wonder'].includes(p.kind)).map(p => p.id));
const districts = new Set(PRODUCTIONS.filter(p => p.kind === 'district').map(p => p.id));
const unitKinds = new Set(['hero', ...PRODUCTIONS.filter(p => p.kind === 'unit').map(p => p.id)]);
const terrains = new Set(['grass', 'forest', 'hills', 'waste', 'water', 'mountain']);
const resources = new Set(['wheat', 'fish', 'iron', 'timber', 'gems', 'horses']);
const improvements = new Set(['farm', 'mine', 'lumbermill']);
const relations = new Set(['peace', 'war']);
const victoryTypes = new Set(['fellowship', 'domination', 'conquest', 'economic', 'cultural']);
const maxCounter = Number.MAX_SAFE_INTEGER - 1;

function invalid(path, reason) { throw new Error(`Cannot load campaign: ${path} ${reason}.`); }
function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'must be an object');
}
function array(value, path) { if (!Array.isArray(value)) invalid(path, 'must be a list'); }
function integer(value, path, min = 0, max = maxCounter) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(path, `must be a whole number from ${min} to ${max}`);
}
function member(value, allowed, path, nullable = false) {
  if (!(nullable && value === null) && !allowed.has(value)) invalid(path, 'contains an unknown value');
}
function boolean(value, path) { if (typeof value !== 'boolean') invalid(path, 'must be true or false'); }
function optionalBoolean(value, path) { if (value !== undefined) boolean(value, path); }
function string(value, path, max = 500) {
  if (typeof value !== 'string' || !value.length || value.length > max) invalid(path, `must contain 1–${max} characters`);
}
function uniqueMembers(value, allowed, path) {
  array(value, path);
  const seen = new Set();
  for (let i = 0; i < value.length; i++) {
    member(value[i], allowed, `${path}[${i}]`);
    if (seen.has(value[i])) invalid(path, `contains duplicate ${value[i]}`);
    seen.add(value[i]);
  }
}

// Validate before reading field values, including unknown extension fields. This
// accepts JSON data only and never evaluates an accessor or merges unsafe keys.
function jsonData(value) {
  const stack = [{ value, path: 'save', depth: 0 }], seen = new WeakSet();
  while (stack.length) {
    const item = stack.pop(), v = item.value;
    if (v === null || ['string', 'boolean'].includes(typeof v)) continue;
    if (typeof v === 'number') { if (!Number.isFinite(v)) invalid(item.path, 'must be finite'); continue; }
    if (typeof v !== 'object') invalid(item.path, 'must contain JSON data only');
    if (seen.has(v)) invalid(item.path, 'contains a repeated or circular object');
    seen.add(v);
    if (item.depth > 64) invalid(item.path, 'is nested too deeply');
    const prototype = Object.getPrototypeOf(v);
    if (prototype !== (Array.isArray(v) ? Array.prototype : Object.prototype) && prototype !== null) invalid(item.path, 'must be a plain JSON object');
    const keys = Reflect.ownKeys(v);
    if (Array.isArray(v) && (keys.length !== v.length + 1 || keys.some(key => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= v.length)))) invalid(item.path, 'must be a dense JSON list');
    for (const key of keys) {
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid(item.path, 'contains an unsafe property');
      const descriptor = Object.getOwnPropertyDescriptor(v, key);
      if (!Object.hasOwn(descriptor, 'value')) invalid(item.path, 'contains an accessor');
      stack.push({ value: descriptor.value, path: `${item.path}.${key}`, depth: item.depth + 1 });
    }
  }
}

/** Validate a parsed save without changing it or the current campaign.
 * Returns the original save only after every check passes. Call this before
 * assigning application state, rendering, or writing to browser storage.
 */
export function validateCampaignSave(v) {
  jsonData(v); record(v, 'save');
  if (v.version !== 1) invalid('version', 'is unsupported (expected version 1)');
  if (v.ruleset !== undefined && v.ruleset !== TRAIT_RULESET) invalid('ruleset','is unsupported');
  integer(v.turn, 'turn', 1);
  if (typeof v.seed !== 'number' || !Number.isFinite(v.seed)) invalid('seed', 'must be a finite number');
  integer(v.rngState, 'rngState', 0, 0xffffffff);
  integer(v.nextId, 'nextId', 1);
  for (const name of ['tiles', 'factions', 'cities', 'units', 'log']) array(v[name], name);
  if (v.tiles.length !== 217) invalid('tiles', 'must contain the complete 217-hex map');
  if (v.factions.length !== 4) invalid('factions', 'must contain four campaign realms exactly once');
  const factions = new Set();
  v.factions.forEach((f, i) => {
    record(f, `factions[${i}]`); member(f.id, factionCatalog, `factions[${i}].id`);
    if (factions.has(f.id)) invalid(`factions[${i}]`, `duplicates realm ${f.id}`);
    factions.add(f.id);
  });
  member(v.player, factions, 'player');
  if (v.humanFactions !== undefined) {
    uniqueMembers(v.humanFactions, factions, 'humanFactions');
    if (v.humanFactions.length < 1 || v.humanFactions.length > 4) invalid('humanFactions', 'must contain 1–4 active realm IDs');
  }

  const tileById = new Map();
  v.tiles.forEach((t, i) => {
    const path = `tiles[${i}]`; record(t, path);
    integer(t.q, `${path}.q`, -8, 8); integer(t.r, `${path}.r`, -8, 8);
    if (Math.abs(t.q + t.r) > 8 || t.id !== `${t.q},${t.r}`) invalid(path, 'has an invalid hex coordinate or tile ID');
    if (tileById.has(t.id)) invalid(path, `duplicates tile ${t.id}`);
    tileById.set(t.id, t);
    member(t.terrain, terrains, `${path}.terrain`);
    member(t.resource, resources, `${path}.resource`, true);
    member(t.owner, factions, `${path}.owner`, true);
    member(t.improvement, improvements, `${path}.improvement`, true);
    boolean(t.visible, `${path}.visible`); boolean(t.explored, `${path}.explored`); boolean(t.river, `${path}.river`);
    if (t.visible && !t.explored) invalid(path, 'cannot be visible but unexplored');
    const suitableTerrain = { farm: ['grass', 'waste'], mine: ['hills'], lumbermill: ['forest'] };
    if (t.improvement && !suitableTerrain[t.improvement].includes(t.terrain)) invalid(`${path}.improvement`, 'does not match its terrain');
  });
  // The unique coordinates above, in this radius and count, prove completeness.
  const factionById = new Map();
  v.factions.forEach((f, i) => {
    const path = `factions[${i}]`; record(f, path); member(f.id, factions, `${path}.id`);
    if (factionById.has(f.id)) invalid(path, `duplicates realm ${f.id}`);
    factionById.set(f.id, f);
    for (const field of ['gold', 'science', 'culture', 'scienceProgress', 'cultureProgress']) integer(f[field], `${path}.${field}`);
    integer(f.goldIncome, `${path}.goldIncome`, -maxCounter);
    uniqueMembers(f.techs, techs, `${path}.techs`); uniqueMembers(f.civics, civics, `${path}.civics`);
    member(f.research, techs, `${path}.research`, true); member(f.civic, civics, `${path}.civic`, true);
    member(f.policy, policies, `${path}.policy`);
    record(f.relations, `${path}.relations`);
    const others = [...factions].filter(id => id !== f.id);
    if (Object.keys(f.relations).length !== others.length || others.some(id => !Object.hasOwn(f.relations, id))) invalid(`${path}.relations`, 'must include each other realm exactly once');
    for (const id of others) member(f.relations[id], relations, `${path}.relations.${id}`);
  });
  for (const f of v.factions) for (const [id, status] of Object.entries(f.relations)) {
    if (factionById.get(id).relations[f.id] !== status) invalid(`relations.${f.id}.${id}`, 'must agree in both directions');
  }

  const entityIds = new Set(), occupiedCities = new Set(), capitals = new Set();
  let greatestId = 0;
  function entity(e, path, prefix) {
    record(e, path); string(e.id, `${path}.id`, 40);
    const match = new RegExp(`^${prefix}-([1-9][0-9]*)$`).exec(e.id);
    if (!match || !Number.isSafeInteger(Number(match[1]))) invalid(`${path}.id`, `must be a valid ${prefix} ID`);
    if (entityIds.has(e.id)) invalid(path, `duplicates entity ${e.id}`);
    entityIds.add(e.id); greatestId = Math.max(greatestId, Number(match[1]));
    string(e.name, `${path}.name`); member(e.faction, factions, `${path}.faction`);
    const tile = tileById.get(e.tileId);
    if (!tile || ['water', 'mountain'].includes(tile.terrain)) invalid(`${path}.tileId`, 'must reference a passable map tile');
    integer(e.maxHp, `${path}.maxHp`, 1, 1000); integer(e.hp, `${path}.hp`, 1, e.maxHp);
    return tile;
  }
  v.cities.forEach((c, i) => {
    const path = `cities[${i}]`, tile = entity(c, path, 'city');
    if (occupiedCities.has(c.tileId)) invalid(path, 'shares a tile with another city');
    occupiedCities.add(c.tileId);
    if (tile.owner !== c.faction) invalid(`${path}.faction`, 'must match its city tile owner');
    integer(c.population, `${path}.population`, 1, 12);
    integer(c.food, `${path}.food`); integer(c.production, `${path}.production`);
    member(c.queue, productions, `${path}.queue`, true);
    uniqueMembers(c.buildings, buildings, `${path}.buildings`); uniqueMembers(c.districts, districts, `${path}.districts`);
    member(c.capitalOf, factions, `${path}.capitalOf`, true);
    if (c.capitalOf) {
      if (capitals.has(c.capitalOf)) invalid(path, `duplicates the original capital of ${c.capitalOf}`);
      capitals.add(c.capitalOf);
    }
  });
  if (capitals.size !== factions.size) invalid('cities', 'must retain one original capital for every realm');
  if(v.ruleset===TRAIT_RULESET){
    const usedDistrictTiles=new Set();
    for(const [i,c]of v.cities.entries()){
      const path=`cities[${i}]`;member(c.focus,new Set(CITY_FOCUSES),`${path}.focus`);record(c.districtTiles,`${path}.districtTiles`);
      if(Object.keys(c.districtTiles).length!==c.districts.length||c.districts.some(kind=>!Object.hasOwn(c.districtTiles,kind)))invalid(`${path}.districtTiles`,'must locate each completed district exactly once');
      for(const [kind,tileId]of Object.entries(c.districtTiles)){
        if(!DISTRICT_KINDS.includes(kind))invalid(`${path}.districtTiles`,'contains an unknown district');
        checkDistrictTile(c,tileId,`${path}.districtTiles.${kind}`);
      }
      if(DISTRICT_KINDS.includes(c.queue)){
        if(c.districts.length>=districtLimit(c.population))invalid(`${path}.queue`,'exceeds the population district capacity');
        checkDistrictTile(c,c.queuedDistrictTileId,`${path}.queuedDistrictTileId`);
      }else if(c.queuedDistrictTileId!==null)invalid(`${path}.queuedDistrictTileId`,'must be null when no district is queued');
    }
    function checkDistrictTile(city,id,path){
      const t=tileById.get(id),center=tileById.get(city.tileId);
      if(!t||['water','mountain'].includes(t.terrain)||t.owner!==city.faction||t.improvement||t.resource||occupiedCities.has(id)||usedDistrictTiles.has(id))invalid(path,'must reference an exclusive empty owned land tile');
      if(Math.max(Math.abs(t.q-center.q),Math.abs(t.r-center.r),Math.abs(t.q+t.r-center.q-center.r))>2)invalid(path,'must be within two hexes of the city');
      usedDistrictTiles.add(id);
    }
  }
  const heroFactions = new Set();
  v.units.forEach((u, i) => {
    const path = `units[${i}]`; entity(u, path, 'unit'); member(u.kind, unitKinds, `${path}.kind`);
    // Leave room for catalog balance changes and temporary power bonuses.
    integer(u.maxMoves, `${path}.maxMoves`, 1, 20);
    integer(u.moves, `${path}.moves`, 0, 20);
    integer(u.strength, `${path}.strength`, 0, 10000); integer(u.xp, `${path}.xp`);
    integer(u.charges, `${path}.charges`, u.kind === 'builder' ? 1 : 0, u.kind === 'builder' ? 100 : 0);
    integer(u.cooldown, `${path}.cooldown`, 0, 100); integer(u.bonusStrength, `${path}.bonusStrength`, 0, 10000); integer(u.buffTurns, `${path}.buffTurns`, 0, 100);
    optionalBoolean(u.acted, `${path}.acted`); optionalBoolean(u.healing, `${path}.healing`);
    if (u.armySize !== undefined && ![1, 3].includes(u.armySize)) invalid(`${path}.armySize`, 'must be 1 or 3 when present');
    if (u.armySize === 3 && !['warrior', 'archer', 'rider'].includes(u.kind)) invalid(`${path}.armySize`, 'is only supported for military battalions');
    if (u.kind === 'hero') {
      if (heroFactions.has(u.faction)) invalid(path, 'duplicates a realm’s champion');
      heroFactions.add(u.faction);
    }
  });
  if (v.nextId <= greatestId) invalid('nextId', 'must be greater than all saved entity IDs');

  v.log.forEach((entry, i) => {
    const path = `log[${i}]`; record(entry, path); integer(entry.turn, `${path}.turn`, 1, v.turn); string(entry.text, `${path}.text`, 5000);
  });
  if (v.visionBursts !== undefined) {
    array(v.visionBursts, 'visionBursts');
    v.visionBursts.forEach((burst, i) => {
      const path = `visionBursts[${i}]`; record(burst, path);
      if (!tileById.has(burst.tileId)) invalid(`${path}.tileId`, 'must reference a map tile');
      integer(burst.radius, `${path}.radius`, 0, 8); integer(burst.expiresTurn, `${path}.expiresTurn`, 1, Math.min(maxCounter, v.turn + 2));
    });
  }
  member(v.winner, factions, 'winner', true); member(v.victoryType, victoryTypes, 'victoryType', true);
  if ((v.winner === null) !== (v.victoryType === null)) invalid('winner/victoryType', 'must either both be set or both be null');
  const victoryProject = { economic: 'world_exchange', cultural: 'hall_of_nations' }[v.victoryType];
  if (victoryProject && !v.cities.some(c => c.faction === v.winner && c.buildings.includes(victoryProject))) invalid('victoryType', 'requires the winning realm’s completed victory project');
  return v;
}
