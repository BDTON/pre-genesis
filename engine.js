/* Crowns of the Sundering — deterministic, dependency-free strategy simulation.
 * All public player commands pass through performAction. Save a game with
 * JSON.stringify(state), and restore with JSON.parse: no class instances needed.
 */
import { FACTIONS, HERO_POWERS, campaignRoster } from './factions.js';
import { TRAIT_RULESET, usesFactionTraits, traitCityYields, traitCombatBonus, traitMovementCost, traitHealingBonus, traitVisionBonus } from './faction-traits.js';
import {CITY_FOCUSES,DISTRICT_KINDS,DISTRICT_YIELD,cityWorkPlan,districtOptions,districtAdjacency,districtAt,reservedDistrictAt} from './city-planning.js';
export { TRAIT_RULESET, factionTrait, traitSummary } from './faction-traits.js';
export { FACTIONS, HERO_POWERS, LEGACY_FACTION_IDS, campaignRoster } from './factions.js';

export const TECHS = [
  { id: 'agriculture', name: 'Husbandry', cost: 20, requires: [], description: 'Improve the harvest. Farms produce an additional food.' },
  { id: 'writing', name: 'Scribes', cost: 25, requires: [], description: 'Unlock Lore Quarters for science and terrain bonuses.' },
  { id: 'masonry', name: 'Stonecraft', cost: 28, requires: [], description: 'Unlock walls, mines, and the craft of lasting cities.' },
  { id: 'riding', name: 'Mounted Warfare', cost: 35, requires: ['agriculture'], description: 'Unlock swift riders to control the open country.' },
  { id: 'metalworking', name: 'Alloy Forging', cost: 42, requires: ['masonry'], description: 'Unlock Forge Quarters. All armies gain +4 strength.' },
  { id: 'engineering', name: 'Civil Engineering', cost: 58, requires: ['metalworking', 'writing'], description: 'Improve workshops: every city gains +2 production.' },
  { id: 'ring_lore', name: 'Aether Studies', cost: 100, requires: ['engineering'], description: 'Unlock the Concord Spire wonder. Complete it with the Grand Concord civic to win a Concord victory.' },
];

export const CIVICS = [
  { id: 'tradition', name: 'Founding Charters', cost: 22, requires: [], description: 'Unlock the Craftsmen policy and Sanctuary district.' },
  { id: 'military', name: 'Warrior Oaths', cost: 30, requires: [], description: 'Unlock the War Council policy: stronger armies and faster mustering.' },
  { id: 'trade', name: 'Trade Roads', cost: 38, requires: ['tradition'], description: 'Unlock Trade Quarters and the Merchant Guilds policy.' },
  { id: 'lorekeepers', name: 'Keepers of Knowledge', cost: 45, requires: ['tradition'], description: 'Unlock the Lorekeepers policy, increasing scientific study.' },
  { id: 'alliances', name: 'The Grand Concord', cost: 80, requires: ['trade', 'lorekeepers'], description: 'Unite the peoples beneath one cause; required to complete the Concord Spire.' },
];

export const POLICIES = [
  { id: 'stewardship', name: 'Stewardship', requires: [], description: '+2 food in every city.' },
  { id: 'craftsmen', name: 'Craftsmen', requires: ['tradition'], description: '+2 production and −1 food in every city.' },
  { id: 'war_council', name: 'War Council', requires: ['military'], description: '+1 production in every city and +4 combat strength.' },
  { id: 'merchants', name: 'Merchant Guilds', requires: ['trade'], description: '+4 gold in every city.' },
  { id: 'lorekeepers', name: 'Lorekeepers', requires: ['lorekeepers'], description: '+3 science and −1 gold in every city.' },
];

export const PRODUCTIONS = [
  { id: 'warrior', name: 'Guard Battalion', cost: 24, kind: 'unit', description: 'A resilient melee battalion. Strength 28; movement 2.' },
  { id: 'archer', name: 'Archer Battalion', cost: 30, kind: 'unit', description: 'A ranged battalion. Strength 24; attacks up to 2 hexes away.' },
  { id: 'rider', name: 'Rider Battalion', cost: 42, kind: 'unit', requires: ['riding'], description: 'Fast cavalry. Strength 36; movement 3.' },
  { id: 'settler', name: 'Settlers', cost: 44, kind: 'unit', description: 'Found another city at least 3 hexes from any existing city.' },
  { id: 'builder', name: 'Builders', cost: 26, kind: 'unit', description: 'Three charges to build farms, mines, and lumber mills in your territory.' },
  { id: 'granary', name: 'Storehouses', cost: 32, kind: 'building', description: '+3 food. Helps the city grow.' },
  { id: 'barracks', name: 'Guard Hall', cost: 35, kind: 'building', description: '+1 production; units trained here gain +4 strength.' },
  { id: 'walls', name: 'City Walls', cost: 40, kind: 'building', requires: ['masonry'], description: '+60 city health and stronger city defenses.' },
  { id: 'campus', name: 'Lore Quarter', cost: 48, kind: 'district', requires: ['writing'], description: '+3 science; +1 per adjacent mountain and +1 per 2 adjacent forests.' },
  { id: 'market', name: 'Trade Quarter', cost: 42, kind: 'district', civicRequires: ['trade'], description: '+4 gold; +1 for every adjacent river or resource tile.' },
  { id: 'sanctuary', name: 'Sanctuary', cost: 44, kind: 'district', civicRequires: ['tradition'], description: '+3 culture; +1 per 2 adjacent forests.' },
  { id: 'forge', name: 'Forge Quarter', cost: 50, kind: 'district', requires: ['metalworking'], description: '+3 production; +1 for every adjacent hill or mine.' },
  { id: 'fellowship', name: 'Concord Spire', cost: 180, kind: 'wonder', requires: ['ring_lore'], civicRequires: ['alliances'], description: 'Complete this wonder to earn a Concord victory.' },
  { id: 'world_exchange', name: 'World Exchange', cost: 220, kind: 'wonder', requires: ['engineering'], civicRequires: ['trade'], description: 'Economic victory project. Complete with 3 Trade Quarters and 1,000 gold; the gold funds the Exchange. Finished construction waits until these goals are met.' },
  { id: 'hall_of_nations', name: 'Hall of Nations', cost: 220, kind: 'wonder', civicRequires: ['alliances'], description: 'Cultural victory project. Complete with 3 Sanctuaries and 30 culture per turn. Finished construction waits until these goals are met.' },
];

export const VICTORY_GOALS = [
  { id: 'economic', name: 'Economic Victory', projectId: 'world_exchange', production: 220, goldRequired: 1000, district: 'market', districtRequired: 3, cultureRequired: 0, requires: ['engineering'], civicRequires: ['trade'] },
  { id: 'cultural', name: 'Cultural Victory', projectId: 'hall_of_nations', production: 220, goldRequired: 0, district: 'sanctuary', districtRequired: 3, cultureRequired: 30, requires: [], civicRequires: ['alliances'] },
];
export function victoryProgress(state, factionId = state.player) {
  const faction = getFaction(state, factionId); if (!faction) return [];
  const cities = state.cities.filter(c => c.faction === factionId), currentCulture = cities.reduce((sum, c) => sum + cityYields(state, c).culture, 0);
  return VICTORY_GOALS.map(goal => {
    const currentGold = faction.gold, currentDistricts = cities.filter(c => c.districts.includes(goal.district)).length, unlocked = ownsRequirements(faction, goal);
    return { ...goal, currentGold, currentDistricts, currentCulture, unlocked, ready: unlocked && currentGold >= goal.goldRequired && currentDistricts >= goal.districtRequired && currentCulture >= goal.cultureRequired, completed: cities.some(c => c.buildings.includes(goal.projectId)) };
  });
}

const START_SLOTS = [[-2, 3], [-3, 0], [-4, -3], [5, 2]];
const UNIT_DATA = { hero: [120, 2, 44], warrior: [100, 2, 28], archer: [80, 2, 24], rider: [100, 3, 36], settler: [60, 2, 0], builder: [60, 2, 0] };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MILITARY = new Set(['hero', 'warrior', 'archer', 'rider']);
const MAX_LOG = 70;

export function distance(a, b) { return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)); }
export function getTile(state, id) { return state.tiles.find(t => t.id === id); }
export function getFaction(state, id) { return state.factions.find(f => f.id === id); }
export function neighbors(state, id) {
  const t = getTile(state, id); if (!t) return [];
  return DIRECTIONS.map(([q, r]) => getTile(state, `${t.q + q},${t.r + r}`)).filter(Boolean);
}
function rand(state) { state.rngState = ((state.rngState || 1) * 1664525 + 1013904223) >>> 0; return state.rngState / 4294967296; }
function nextId(state, prefix) { return `${prefix}-${state.nextId++}`; }
function passable(tile) { return tile && tile.terrain !== 'water' && tile.terrain !== 'mountain'; }
function military(unit) { return MILITARY.has(unit.kind); }
function log(state, text) { state.log.unshift({ turn: state.turn, text }); state.log = state.log.slice(0, MAX_LOG); }
function narrate(state, tileId, faction, text) { if (faction === state.player || getTile(state, tileId)?.visible) log(state, text); }
function atWar(state, a, b) { return a !== b && getFaction(state, a)?.relations[b] === 'war'; }
// In a shared campaign the roster owns control; state.player only selects a view.
function humanControlled(state, factionId) { return state.humanFactions?.includes(factionId) ?? (factionId === state.player); }
function ownsRequirements(faction, item) { return (item.requires || []).every(t => faction.techs.includes(t)) && (item.civicRequires || []).every(c => faction.civics.includes(c)); }

function makeUnit(state, faction, kind, tileId) {
  const [hp, movement, strength] = UNIT_DATA[kind];
  const info = FACTIONS.find(f => f.id === faction), bonus = usesFactionTraits(state) ? {} : info.gameplay.unitBonuses[kind] || {};
  const unit = { id: nextId(state, 'unit'), name: kind === 'hero' ? info.leader : PRODUCTIONS.find(p => p.id === kind).name, kind, faction, tileId, hp, maxHp: hp, moves: movement + (bonus.moves || 0), maxMoves: movement + (bonus.moves || 0), strength: strength + (bonus.strength || 0), xp: 0, charges: kind === 'builder' ? 3 + (bonus.charges || 0) : 0, cooldown: 0, bonusStrength: 0, buffTurns: 0 };
  unit.armySize = 1; state.units.push(unit); return unit;
}

function claimTerritory(state, city) {
  const center = getTile(state, city.tileId), radius = city.population >= 4 ? 2 : 1;
  state.tiles.forEach(t => { if (distance(center, t) <= radius && (!t.owner || t.id === city.tileId)) t.owner = city.faction; });
}

function makeCity(state, faction, tileId, capitalOf = null) {
  const count = state.cities.filter(c => c.faction === faction).length;
  const info = FACTIONS.find(f => f.id === faction);
  const name = capitalOf ? info.capital : (info.cityNames[Math.max(0, count - 1)] || `${info.name} ${count + 1}`);
  const city = { id: nextId(state, 'city'), name, faction, tileId, population: 2, hp: 120, maxHp: 120, food: 0, production: 0, queue: 'granary', buildings: [], districts: [], capitalOf };
  if(usesFactionTraits(state)){city.focus='balanced';city.districtTiles={};city.queuedDistrictTileId=null;}
  state.cities.push(city); claimTerritory(state, city); return city;
}

export function createGame(factionId = 'gondor', seed = 42, {ruleset = TRAIT_RULESET, roster} = {}) {
  if (![TRAIT_RULESET,'legacy-v1'].includes(ruleset)) throw Error('Unknown campaign ruleset.');
  if (!FACTIONS.some(f => f.id === factionId)) factionId = 'gondor';
  if (roster !== undefined && (ruleset !== TRAIT_RULESET || !Array.isArray(roster) || roster.length !== START_SLOTS.length || new Set(roster).size !== START_SLOTS.length || !roster.includes(factionId) || roster.some(id => !FACTIONS.some(f => f.id === id)))) throw Error('A shared campaign roster must contain four distinct recognized factions, including its player, under the current ruleset.');
  const activeFactions = roster === undefined ? campaignRoster(factionId, seed) : roster.map(id => FACTIONS.find(f => f.id === id));
  const state = { version: 1, seed, rngState: Number(seed) >>> 0 || 42, nextId: 1, turn: 1, player: factionId, factions: [], tiles: [], cities: [], units: [], log: [], winner: null, victoryType: null };
  if (ruleset === TRAIT_RULESET) state.ruleset = ruleset;
  for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
    if (Math.abs(q + r) > 8) continue;
    const roll = rand(state), east = q >= 3 && r >= -1;
    let terrain = east ? (roll < .25 ? 'hills' : 'waste') : roll < .2 ? 'forest' : roll < .34 ? 'hills' : 'grass';
    if (q <= -6 && r >= 1 || r >= 6 && q < 0) terrain = 'water';
    if (q === 1 && r >= -4 && r <= 1 && r !== -1) terrain = 'mountain';
    if (q >= -6 && q <= -3 && r <= -2 && terrain !== 'water') terrain = roll < .7 ? 'forest' : 'grass';
    if (q >= -5 && q <= -1 && r >= -1 && r <= 2) terrain = roll < .15 ? 'hills' : 'grass';
    const resourceRoll = rand(state);
    const resource = terrain === 'water' ? resourceRoll < .25 ? 'fish' : null : terrain === 'mountain' ? null : resourceRoll < .15 ? (terrain === 'hills' || terrain === 'waste' ? 'iron' : terrain === 'forest' ? 'timber' : 'wheat') : resourceRoll > .91 ? (terrain === 'grass' ? 'horses' : 'gems') : null;
    state.tiles.push({ id: `${q},${r}`, q, r, terrain, resource, owner: null, explored: false, visible: false, improvement: null, river: q === 0 && r >= -3 && r <= 5 });
  }
  for (const info of activeFactions) {
    state.factions.push({ id: info.id, gold: 50, science: 0, culture: 0, techs: [], civics: [], research: 'writing', civic: 'tradition', scienceProgress: 0, cultureProgress: 0, policy: 'stewardship', relations: Object.fromEntries(activeFactions.filter(f => f.id !== info.id).map(f => [f.id, info.id === 'mordor' || f.id === 'mordor' ? 'war' : 'peace'])) });
  }
  for (const [index, info] of activeFactions.entries()) {
    const [q, r] = START_SLOTS[index], tileId = `${q},${r}`;
    const start = getTile(state, tileId); start.terrain = info.id === 'mordor' ? 'waste' : 'grass'; start.resource = null;
    neighbors(state, tileId).forEach(t => { if (!passable(t)) t.terrain = info.id === 'mordor' ? 'hills' : 'grass'; });
    makeCity(state, info.id, tileId, info.id);
    makeUnit(state, info.id, 'hero', tileId);
    makeUnit(state, info.id, 'settler', tileId);
    const builderSpot = neighbors(state, tileId).find(t => passable(t) && t.owner === info.id);
    makeUnit(state, info.id, 'builder', builderSpot?.id || tileId);
  }
  updateVision(state); refreshEconomy(state);
  log(state, `The Age of Sundering awaits. Lead ${FACTIONS.find(f => f.id === factionId).name} to dominion, or unite the realm through the Concord Spire.`);
  log(state, 'Select your hero to explore. Found a second city with your settlers; improve your lands with builders.');
  return state;
}

export function updateVision(state) {
  const sources = [...state.units.filter(u => u.faction === state.player).map(u => ({ tile: getTile(state, u.tileId), range: (u.kind === 'hero' ? 3 : 2) + traitVisionBonus(state,u) })), ...state.cities.filter(c => c.faction === state.player).map(c => ({ tile: getTile(state, c.tileId), range: 3 }))];
  for (const burst of state.visionBursts || []) if (burst.expiresTurn > state.turn) sources.push({ tile: getTile(state, burst.tileId), range: burst.radius });
  for (const tile of state.tiles) { tile.visible = tile.owner === state.player || sources.some(s => distance(s.tile, tile) <= s.range); if (tile.visible) tile.explored = true; }
}

function tileYield(faction, tile) {
  let food = tile.terrain === 'grass' ? 2 : tile.terrain === 'forest' ? 1 : 0;
  let production = tile.terrain === 'hills' ? 2 : ['forest', 'waste'].includes(tile.terrain) ? 1 : 0;
  let gold = tile.river ? 1 : 0;
  if (tile.resource === 'wheat' || tile.resource === 'fish') food += 2;
  if (tile.resource === 'iron' || tile.resource === 'timber') production++;
  if (tile.resource === 'gems' || tile.resource === 'horses') gold += 2;
  if (tile.improvement === 'farm') food += faction.techs.includes('agriculture') ? 3 : 2;
  if (tile.improvement === 'mine' || tile.improvement === 'lumbermill') production += 2;
  return { food, production, gold };
}

export function cityYields(state, city) {
  const faction = getFaction(state, city.faction), center = getTile(state, city.tileId);
  const workable = state.tiles.filter(t => t.owner === city.faction && t.id !== city.tileId && distance(t, center) <= (city.population >= 4 ? 2 : 1)).map(t => tileYield(faction, t));
  workable.sort((a, b) => (b.food + b.production + b.gold) - (a.food + a.production + a.gold));
  const yieldTotal = { food: 3, production: 4, gold: 2 + city.population, science: 2 + city.population, culture: 2 + Math.floor(city.population / 3) };
  if(usesFactionTraits(state)){const plan=cityWorkPlan(state,city,tileYield);for(const key of ['food','production','gold'])yieldTotal[key]+=plan.yields[key];}
  else workable.slice(0, city.population).forEach(y => { yieldTotal.food += y.food; yieldTotal.production += y.production; yieldTotal.gold += y.gold; });
  const adjacent = neighbors(state, city.tileId);
  if (city.buildings.includes('granary')) yieldTotal.food += 3;
  if (city.buildings.includes('barracks')) yieldTotal.production++;
  for(const kind of DISTRICT_KINDS)if(city.districts.includes(kind)){
    const site=usesFactionTraits(state)?city.districtTiles?.[kind]||city.tileId:city.tileId;
    yieldTotal[DISTRICT_YIELD[kind]]+=(kind==='market'?4:3)+districtAdjacency(state,site,kind);
  }
  const factionYields = usesFactionTraits(state) ? traitCityYields(state,city) : FACTIONS.find(f => f.id === city.faction).gameplay.cityYields;
  for (const [yieldName, amount] of Object.entries(factionYields)) yieldTotal[yieldName] += amount;
  if (faction.techs.includes('engineering')) yieldTotal.production += 2;
  if (faction.policy === 'stewardship') yieldTotal.food += 2;
  if (faction.policy === 'craftsmen') { yieldTotal.production += 2; yieldTotal.food--; }
  if (faction.policy === 'war_council') yieldTotal.production++;
  if (faction.policy === 'merchants') yieldTotal.gold += 4;
  if (faction.policy === 'lorekeepers') { yieldTotal.science += 3; yieldTotal.gold--; }
  yieldTotal.food = Math.max(1, yieldTotal.food - city.population); // Net food after population upkeep.
  return yieldTotal;
}

function refreshEconomy(state) {
  for (const faction of state.factions) {
    const incomes = state.cities.filter(c => c.faction === faction.id).map(c => cityYields(state, c));
    faction.science = incomes.reduce((sum, y) => sum + y.science, 0);
    faction.culture = incomes.reduce((sum, y) => sum + y.culture, 0);
    faction.goldIncome = incomes.reduce((sum, y) => sum + y.gold, 0) - state.units.filter(u => u.faction === faction.id && military(u)).length;
  }
}

export function availableProduction(state, city) {
  const faction = getFaction(state, city.faction);
  return PRODUCTIONS.filter(p => ownsRequirements(faction, p) && !city.buildings.includes(p.id) && !city.districts.includes(p.id) && !(p.kind === 'wonder' && state.cities.some(c => c.buildings.includes(p.id))) && (!usesFactionTraits(state)||p.kind!=='district'||districtOptions(state,city,p.id).length>0));
}

function movementCost(state, unit, tile) { return traitMovementCost(state,unit,tile,tile.terrain === 'forest' || tile.terrain === 'hills' ? 2 : 1); }
function canEnter(state, unit, tile, playerFog = true) {
  if (!passable(tile) || playerFog && unit.faction === state.player && !tile.visible) return false;
  if (state.cities.some(c => c.tileId === tile.id && c.faction !== unit.faction)) return false;
  if (state.units.some(u => u.id !== unit.id && u.tileId === tile.id && u.faction !== unit.faction)) return false;
  return true;
}
function paths(state, unit, limit = unit.moves, playerFog = true) {
  const costs = new Map([[unit.tileId, 0]]), previous = new Map(), frontier = [unit.tileId];
  while (frontier.length) {
    frontier.sort((a, b) => costs.get(a) - costs.get(b)); const current = frontier.shift();
    for (const tile of neighbors(state, current)) {
      if (!canEnter(state, unit, tile, playerFog)) continue;
      const cost = costs.get(current) + movementCost(state, unit, tile);
      if (cost > limit || costs.has(tile.id) && costs.get(tile.id) <= cost) continue;
      costs.set(tile.id, cost); previous.set(tile.id, current); frontier.push(tile.id);
    }
  }
  return { costs, previous };
}
export function reachableTiles(state, unitId) {
  const unit = state.units.find(u => u.id === unitId); if (!unit || unit.faction !== state.player) return [];
  return [...paths(state, unit).costs.keys()].filter(id => id !== unit.tileId);
}
function moveUnit(state, unit, tileId, playerFog = true) {
  if (unit.tileId === tileId) return { ok: false, message: 'This company is already there.' };
  const { costs } = paths(state, unit, unit.moves, playerFog);
  if (!costs.has(tileId)) return { ok: false, message: 'That tile is blocked or beyond your remaining movement.' };
  unit.moves -= costs.get(tileId); unit.tileId = tileId; unit.acted = true;
  return { ok: true, message: `${unit.name} moved.` };
}

function armyReady(unit) {
  return ['warrior', 'archer', 'rider'].includes(unit.kind) && (unit.armySize ?? 1) === 1 && unit.hp === unit.maxHp && unit.moves === unit.maxMoves && !unit.acted;
}
function formArmy(state, unit) {
  const failure = { ok: false, message: 'An army needs three matching friendly battalions on one tile, each at full health and movement and not yet acted.' };
  if (!armyReady(unit)) return failure;
  const others = state.units.filter(u => u.id !== unit.id && u.faction === unit.faction && u.tileId === unit.tileId && u.kind === unit.kind && armyReady(u)).slice(0, 2);
  if (others.length !== 2) return failure;
  unit.strength += others.reduce((sum, u) => sum + u.strength, 0);
  unit.armySize = 3; unit.name = PRODUCTIONS.find(p => p.id === unit.kind).name.replace('Battalion', 'Army');
  unit.moves = 0; unit.acted = true; unit.healing = false;
  state.units = state.units.filter(u => !others.includes(u));
  narrate(state, unit.tileId, unit.faction, `${unit.name} formed from three battalions.`);
  return { ok: true, message: `${unit.name} formed. It can move next turn.` };
}

export function combatStrength(state, unit) {
  // A redacted room view includes the observed total for visible opponents.
  // Full simulation states always calculate their own strength, even if an
  // imported unit happens to contain this presentation-only field.
  if (state.rngState === undefined && unit.faction !== state.player && Number.isSafeInteger(unit.observedCombatStrength) && unit.observedCombatStrength >= 0) return unit.observedCombatStrength;
  const f = getFaction(state, unit.faction);
  return unit.strength + (unit.bonusStrength || 0) + (f.techs.includes('metalworking') ? 4 : 0) + (f.policy === 'war_council' ? 4 : 0) + Math.min(10, Math.floor(unit.xp / 20) * 2) + traitCombatBonus(state,unit);
}

function heroPower(state, hero) {
  if (hero.kind !== 'hero' || hero.moves < 1) return { ok: false, message: 'Choose your hero with movement remaining.' };
  if (hero.cooldown > 0) return { ok: false, message: `This power will be ready in ${hero.cooldown} turns.` };
  const source = getTile(state, hero.tileId), allies = state.units.filter(u => u.faction === hero.faction && distance(source, getTile(state, u.tileId)) <= 2);
  const powerKind = FACTIONS.find(f => f.id === hero.faction).gameplay.heroPower;
  hero.moves--; hero.acted = true; hero.cooldown = 4;
  if (powerKind === 'aegis') for (const ally of allies) { ally.hp = Math.min(ally.maxHp, ally.hp + 24); ally.bonusStrength = military(ally) ? 6 : 0; ally.buffTurns = 2; }
  if (powerKind === 'charge') for (const ally of allies) { ally.moves += 2; ally.bonusStrength = military(ally) ? 4 : 0; ally.buffTurns = 2; }
  if (powerKind === 'counsel') {
    for (const ally of allies) ally.hp = Math.min(ally.maxHp, ally.hp + 30);
    if (hero.faction === state.player) { state.visionBursts ||= []; state.visionBursts.push({ tileId: hero.tileId, radius: 5, expiresTurn: state.turn + 2 }); }
  }
  if (powerKind === 'strike') {
    for (const target of state.units.filter(u => atWar(state, hero.faction, u.faction) && distance(source, getTile(state, u.tileId)) <= 2)) target.hp -= 25;
    state.units = state.units.filter(u => u.hp > 0);
    for (const target of state.cities.filter(c => atWar(state, hero.faction, c.faction) && distance(source, getTile(state, c.tileId)) <= 2)) target.hp = Math.max(1, target.hp - 20);
  }
  const power = HERO_POWERS.find(p => p.factionId === hero.faction);
  narrate(state, hero.tileId, hero.faction, `${hero.name} used ${power.name}.`);
  return { ok: true, message: `${power.name} used.` };
}
function combatTarget(state, attacker, tileId) {
  const units = state.units.filter(u => u.tileId === tileId && u.faction !== attacker.faction);
  // A stack's best defender protects weaker companies; equal strengths use the
  // persistent numeric unit ID so saves and array reordering cannot alter combat.
  const defenders = units.filter(military).sort((a, b) => combatStrength(state, b) - combatStrength(state, a) || Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));
  return defenders[0] || units[0] || state.cities.find(c => c.tileId === tileId && c.faction !== attacker.faction);
}
export function previewCombat(state, unitId, tileId) {
  const attacker = state.units.find(u => u.id === unitId), tile = getTile(state, tileId);
  if (!attacker || !tile || !military(attacker) || attacker.faction === state.player && !tile.visible) return null;
  const target = combatTarget(state, attacker, tileId); if (!target) return null;
  const isCity = !target.kind, ranged = attacker.kind === 'archer';
  const defense = isCity ? 32 + (target.buildings.includes('walls') ? 10 : 0) : Math.max(10, combatStrength(state, target));
  const terrainDefense = ['hills', 'forest'].includes(tile.terrain) ? 4 : 0;
  const attack = combatStrength(state, attacker);
  const damage = Math.max(12, Math.min(65, Math.round(30 * Math.exp((attack - defense - terrainDefense) / 45))));
  const retaliation = ranged || !isCity && !military(target) ? 0 : Math.max(8, Math.round(22 * Math.exp((defense - attack) / 55)));
  return { damage, retaliation, targetName: target.name, targetHp: target.hp, targetId: target.id, isCity, canAttack: attacker.moves > 0 && atWar(state, attacker.faction, target.faction) && distance(getTile(state, attacker.tileId), tile) <= (ranged ? 2 : 1) };
}

function captureCity(state, city, faction) {
  const previous = city.faction, center = getTile(state, city.tileId);
  city.faction = faction; city.hp = Math.round(city.maxHp * .55); city.population = Math.max(1, city.population - 1); city.production = 0; city.queue = 'warrior';
  if(usesFactionTraits(state)){city.queuedDistrictTileId=null;for(const tileId of Object.values(city.districtTiles||{}))getTile(state,tileId).owner=faction;}
  state.tiles.filter(t => distance(t, center) <= 1 && t.owner === previous && (!usesFactionTraits(state)||(!districtAt(state,t.id)||districtAt(state,t.id).city.id===city.id)&&(!reservedDistrictAt(state,t.id)||reservedDistrictAt(state,t.id).id===city.id))).forEach(t => { t.owner = faction; });
  getTile(state, city.tileId).owner = faction;
  state.units = state.units.filter(u => !(u.tileId === city.tileId && u.faction !== faction));
  narrate(state, city.tileId, faction, `${city.name} has fallen to ${FACTIONS.find(f => f.id === faction).name}!`);
}

function attackUnit(state, unit, tileId) {
  if (!military(unit)) return { ok: false, message: 'Civilian companies cannot attack.' };
  const preview = previewCombat(state, unit.id, tileId); if (!preview) return { ok: false, message: 'There is no visible enemy target there.' };
  if (!preview.canAttack) return { ok: false, message: 'Declare war, move within attack range, and keep at least one movement point.' };
  const target = combatTarget(state, unit, tileId);
  unit.moves = 0; unit.acted = true; unit.xp += 8;
  target.hp -= preview.damage; unit.hp -= preview.retaliation;
  if (target.hp <= 0) {
    if (preview.isCity) {
      if (unit.kind === 'archer' || unit.hp <= 0) { target.hp = 1; narrate(state, tileId, unit.faction, `${target.name} is broken. A surviving melee company must claim the city.`); }
      else { captureCity(state, target, unit.faction); unit.tileId = tileId; unit.xp += 15; }
    } else {
      state.units = state.units.filter(u => u.id !== target.id);
      narrate(state, tileId, unit.faction, `${unit.name} defeated ${target.name}.`);
      if (unit.kind !== 'archer' && !state.cities.some(c => c.tileId === tileId && c.faction !== unit.faction) && !state.units.some(u => u.tileId === tileId && u.faction !== unit.faction)) unit.tileId = tileId;
    }
  } else narrate(state, tileId, unit.faction, `${unit.name} struck ${target.name} for ${preview.damage} damage${preview.retaliation ? `, taking ${preview.retaliation} in return` : ''}.`);
  if (unit.hp <= 0) { state.units = state.units.filter(u => u.id !== unit.id); narrate(state, tileId, unit.faction, `${unit.name} fell in battle.`); }
  return { ok: true, message: `${preview.damage} damage dealt${preview.retaliation ? ` · ${preview.retaliation} received` : ''}.` };
}

function canFound(state, unit, tile) {
  return passable(tile) && (!tile.owner || tile.owner === unit.faction) && (!usesFactionTraits(state)||!districtAt(state,tile.id)&&!reservedDistrictAt(state,tile.id)) && !state.cities.some(c => distance(getTile(state, c.tileId), tile) < 3) && !state.units.some(u => u.tileId === tile.id && u.faction !== unit.faction);
}
function foundCity(state, unit) {
  if (unit.kind !== 'settler' || unit.moves < 1) return { ok: false, message: 'Choose settlers with movement remaining.' };
  if (!canFound(state, unit, getTile(state, unit.tileId))) return { ok: false, message: 'Settle on open land at least 3 hexes from every city, outside another realm’s territory.' };
  const city = makeCity(state, unit.faction, unit.tileId);
  state.units = state.units.filter(u => u.id !== unit.id);
  narrate(state, city.tileId, city.faction, `${city.name} has been founded.`);
  return { ok: true, message: `${city.name} has been founded.` };
}

function buildImprovement(state, unit, improvement) {
  if (unit.kind !== 'builder' || unit.moves < 1 || unit.charges < 1) return { ok: false, message: 'Choose builders with movement and charges remaining.' };
  const tile = getTile(state, unit.tileId), faction = getFaction(state, unit.faction);
  if(usesFactionTraits(state)&&(districtAt(state,tile.id)||reservedDistrictAt(state,tile.id)))return {ok:false,message:'This tile is reserved for a city district.'};
  if (tile.owner !== unit.faction || state.cities.some(c => c.tileId === tile.id)) return { ok: false, message: 'Build on one of your land tiles outside a city center.' };
  if (tile.improvement) return { ok: false, message: 'This tile already has an improvement.' };
  if (improvement === 'farm' && !['grass', 'waste'].includes(tile.terrain)) return { ok: false, message: 'Farms require grassland or waste.' };
  if (improvement === 'mine' && (tile.terrain !== 'hills' || !faction.techs.includes('masonry'))) return { ok: false, message: 'Mines require hills and Stonecraft.' };
  if (improvement === 'lumbermill' && tile.terrain !== 'forest') return { ok: false, message: 'Lumber mills require a forest.' };
  if (!['farm', 'mine', 'lumbermill'].includes(improvement)) return { ok: false, message: 'Choose a farm, mine, or lumber mill.' };
  tile.improvement = improvement; unit.charges--; unit.moves = 0; unit.acted = true;
  if (!unit.charges) state.units = state.units.filter(u => u.id !== unit.id);
  narrate(state, tile.id, unit.faction, `${improvement === 'lumbermill' ? 'Lumber mill' : improvement[0].toUpperCase() + improvement.slice(1)} completed.`);
  return { ok: true, message: 'The improvement is complete.' };
}

function spawnForCity(state, city, kind) {
  const candidate = { id: 'pending', faction: city.faction, kind };
  const tiles = [getTile(state, city.tileId), ...neighbors(state, city.tileId), ...state.tiles.filter(t => distance(t, getTile(state, city.tileId)) === 2)];
  const tile = tiles.find(t => t.owner === city.faction && canEnter(state, candidate, t, false));
  if (!tile) return false;
  const unit = makeUnit(state, city.faction, kind, tile.id);
  if (city.buildings.includes('barracks') && military(unit)) unit.strength += 4;
  return true;
}

function chooseProduction(state, city) {
  const options = availableProduction(state, city).map(p => p.id), faction = getFaction(state, city.faction);
  const ownUnits = state.units.filter(u => u.faction === city.faction), ownCities = state.cities.filter(c => c.faction === city.faction);
  if (options.includes('fellowship')) return 'fellowship';
  const danger = state.units.some(u => military(u) && atWar(state, city.faction, u.faction) && distance(getTile(state, u.tileId), getTile(state, city.tileId)) <= 3);
  if (danger && ownUnits.filter(military).length < ownCities.length * 3 + 2) return options.includes('rider') ? 'rider' : 'warrior';
  if (options.includes('granary')) return 'granary';
  if (options.includes('campus')) return 'campus';
  if (options.includes('sanctuary')) return 'sanctuary';
  if (options.includes('forge')) return 'forge';
  if (ownCities.length < 3 && !ownUnits.some(u => u.kind === 'settler')) return 'settler';
  if (ownUnits.filter(military).length < Math.min(10, ownCities.length * 3)) return options.includes('rider') ? 'rider' : 'archer';
  if (options.includes('market')) return 'market';
  if (options.includes('walls')) return 'walls';
  if (options.includes('barracks')) return 'barracks';
  if (!ownUnits.some(u => u.kind === 'builder') && state.tiles.some(t => t.owner === city.faction && !t.improvement && ['grass', 'forest', 'hills'].includes(t.terrain))) return 'builder';
  return faction.gold < 0 ? null : 'archer';
}

function setCityQueue(state,city,productionId,tileId=null){
  city.queue=productionId;
  if(usesFactionTraits(state))city.queuedDistrictTileId=DISTRICT_KINDS.includes(productionId)?tileId||districtOptions(state,city,productionId)[0]?.id||null:null;
}

function processCity(state, city) {
  const yields = cityYields(state, city);
  city.food += yields.food;
  const growth = 16 + city.population * 9;
  if (city.food >= growth && city.population < 12) { city.food -= growth; city.population++; claimTerritory(state, city); narrate(state, city.tileId, city.faction, `${city.name} grew to population ${city.population}.`); }
  city.hp = Math.min(city.maxHp, city.hp + 5);
  if (!city.queue) return;
  const item = availableProduction(state, city).find(p => p.id === city.queue);
  if (!item) { setCityQueue(state,city,usesFactionTraits(state)&&humanControlled(state,city.faction)?null:chooseProduction(state, city)); return; }
  if(usesFactionTraits(state)&&item.kind==='district'){
    const sites=districtOptions(state,city,item.id);
    if(!sites.some(t=>t.id===city.queuedDistrictTileId)){setCityQueue(state,city,null);narrate(state,city.tileId,city.faction,`${city.name}'s district site is no longer available. Choose a new site.`);return;}
  }
  city.production += yields.production;
  if (city.production < item.cost) return;
  const victory = victoryProgress(state, city.faction).find(goal => goal.projectId === item.id);
  if (victory && !victory.ready) { city.production = item.cost; return; }
  if (item.kind === 'unit' && !spawnForCity(state, city, item.id)) { city.production = item.cost; return; }
  city.production -= item.cost;
  if (item.kind === 'building' || item.kind === 'wonder') city.buildings.push(item.id);
  if (item.kind === 'district') {city.districts.push(item.id);if(usesFactionTraits(state)){city.districtTiles||={};city.districtTiles[item.id]=city.queuedDistrictTileId;}}
  if (item.id === 'walls') { city.maxHp += 60; city.hp += 60; }
  narrate(state, city.tileId, city.faction, `${city.name} completed ${item.name}.`);
  setCityQueue(state,city,humanControlled(state,city.faction)?(item.kind==='unit'?item.id:usesFactionTraits(state)?null:chooseProduction(state,city)):chooseProduction(state,city));
  if (item.id === 'fellowship') { state.winner = city.faction; state.victoryType = 'fellowship'; log(state, `${FACTIONS.find(f => f.id === city.faction).name} completed the Concord Spire and won a Concord victory.`); }
  if (victory) { getFaction(state, city.faction).gold -= victory.goldRequired; state.winner = city.faction; state.victoryType = victory.id; log(state, `${FACTIONS.find(f => f.id === city.faction).name} completed ${item.name} and won an ${victory.id === 'economic' ? 'economic' : 'inspiring cultural'} victory.`); }
}

function nextResearch(faction, list, completedField) {
  return list.find(item => !faction[completedField].includes(item.id) && item.requires.every(id => faction[completedField].includes(id)))?.id || null;
}
function processResearch(state, faction) {
  const chooseManually=usesFactionTraits(state)&&humanControlled(state,faction.id);
  for (const data of [{ list: TECHS, completed: 'techs', current: 'research', progress: 'scienceProgress', income: 'science' }, { list: CIVICS, completed: 'civics', current: 'civic', progress: 'cultureProgress', income: 'culture' }]) {
    if (!faction[data.current]&&!chooseManually) faction[data.current] = nextResearch(faction, data.list, data.completed);
    if (!faction[data.current]) continue;
    faction[data.progress] += faction[data.income];
    const item = data.list.find(t => t.id === faction[data.current]);
    if (faction[data.progress] >= item.cost) {
      faction[data.progress] -= item.cost; faction[data.completed].push(item.id);
      if (faction.id === state.player) log(state, `${data.completed === 'techs' ? 'Discovery' : 'Civic completed'}: ${item.name}.`);
      faction[data.current] = chooseManually?null:nextResearch(faction, data.list, data.completed);
    }
  }
}

function goToward(state, unit, destination) {
  if (!destination || !unit.moves) return;
  // Route around mountains and occupied passes, even if the first step points away.
  // Enemy cities are blocked destinations: the closest reachable approach is used.
  const { costs, previous } = paths(state, unit, 500, false);
  const candidates = [...costs.keys()].map(id => getTile(state, id));
  candidates.sort((a, b) => distance(a, destination) - distance(b, destination) || costs.get(a.id) - costs.get(b.id));
  const approach = candidates[0]; if (!approach || approach.id === unit.tileId) return;
  const route = []; let step = approach.id;
  while (step && step !== unit.tileId) { route.unshift(step); step = previous.get(step); }
  const reachable = route.filter(id => costs.get(id) <= unit.moves);
  if (reachable.length) moveUnit(state, unit, reachable[reachable.length - 1], false);
}

function aiTurn(state, faction) {
  const id = faction.id;
  if (!state.cities.some(c => c.faction === id) && !state.units.some(u => u.faction === id)) return;
  faction.policy = faction.civics.includes('lorekeepers') ? 'lorekeepers' : faction.civics.includes('military') ? 'war_council' : 'stewardship';
  for (const city of state.cities.filter(c => c.faction === id)) { if (!city.queue) setCityQueue(state,city,chooseProduction(state, city)); }
  for (const unit of [...state.units.filter(u => u.faction === id)]) if (state.units.includes(unit) && armyReady(unit)) formArmy(state, unit);
  for (const unit of [...state.units.filter(u => u.faction === id)]) {
    if (!state.units.includes(unit) || !unit.moves) continue;
    const tile = getTile(state, unit.tileId);
    if (unit.kind === 'hero' && !unit.cooldown && state.units.some(u => atWar(state, id, u.faction) && distance(tile, getTile(state, u.tileId)) <= 2)) heroPower(state, unit);
    if (unit.kind === 'settler') {
      if (canFound(state, unit, tile)) { foundCity(state, unit); continue; }
      const sites = state.tiles.filter(t => canFound(state, unit, t));
      sites.sort((a, b) => distance(a, tile) - distance(b, tile) + (a.terrain === 'waste' ? 2 : 0) - (b.terrain === 'waste' ? 2 : 0));
      goToward(state, unit, sites[0]); if (unit.moves && canFound(state, unit, getTile(state, unit.tileId))) foundCity(state, unit);
      continue;
    }
    if (unit.kind === 'builder') {
      const improve = t => !t.improvement && t.owner === id && !state.cities.some(c => c.tileId === t.id) && (!usesFactionTraits(state)||!districtAt(state,t.id)&&!reservedDistrictAt(state,t.id)) && (['grass', 'waste', 'forest'].includes(t.terrain) || t.terrain === 'hills' && faction.techs.includes('masonry'));
      if (improve(tile)) buildImprovement(state, unit, tile.terrain === 'forest' ? 'lumbermill' : tile.terrain === 'hills' ? 'mine' : 'farm');
      else { const targets = state.tiles.filter(improve).sort((a, b) => distance(a, tile) - distance(b, tile)); goToward(state, unit, targets[0]); }
      continue;
    }
    if (unit.hp < unit.maxHp * .4) { unit.healing = true; unit.moves = 0; continue; }
    const targets = [...state.units.filter(u => atWar(state, id, u.faction)), ...state.cities.filter(c => atWar(state, id, c.faction))];
    const attackable = targets.filter(t => distance(getTile(state, t.tileId), tile) <= (unit.kind === 'archer' ? 2 : 1));
    attackable.sort((a, b) => (a.hp + (!a.kind ? 100 : 0)) - (b.hp + (!b.kind ? 100 : 0)));
    if (attackable.length) { attackUnit(state, unit, attackable[0].tileId); continue; }
    const cities = state.cities.filter(c => c.faction === id), enemies = targets.filter(t => !t.kind || military(t));
    enemies.sort((a, b) => distance(tile, getTile(state, a.tileId)) - distance(tile, getTile(state, b.tileId)));
    const closest = enemies[0];
    if (closest && (id === 'mordor' || unit.kind !== 'hero' || state.turn > 12 || distance(tile, getTile(state, closest.tileId)) <= 4)) goToward(state, unit, getTile(state, closest.tileId));
    else if (cities.length) { const frontier = state.tiles.filter(t => t.owner === id && passable(t)); if (unit.kind !== 'hero') goToward(state, unit, frontier[Math.floor(rand(state) * frontier.length)]); }
  }
}

function checkVictory(state) {
  if (state.winner) return;
  for (const f of state.factions) {
    if (state.factions.every(original => state.cities.some(c => c.capitalOf === original.id && c.faction === f.id))) { state.winner = f.id; state.victoryType = 'domination'; log(state, `${FACTIONS.find(info => info.id === f.id).name} holds every capital. Dominion over Aurevale is complete.`); return; }
  }
  if (!state.humanFactions && !state.cities.some(c => c.faction === state.player) && !state.units.some(u => u.faction === state.player && u.kind === 'settler')) {
    const capitalOwner = state.cities.find(c => c.capitalOf === state.player)?.faction;
    const victor = getFaction(state, capitalOwner) || [...state.factions].filter(f => f.id !== state.player).sort((a, b) => state.cities.filter(c => c.faction === b.id).length - state.cities.filter(c => c.faction === a.id).length)[0];
    state.winner = victor.id; state.victoryType = 'conquest'; log(state, 'Your last city has fallen. The campaign has ended.');
  }
}

function endTurn(state) {
  // Player acts first, then each other realm. Production and research resolve together.
  for (const faction of state.factions) { if (!humanControlled(state, faction.id)) aiTurn(state, faction); }
  refreshEconomy(state);
  for (const faction of state.factions) { faction.gold = Math.max(0, faction.gold + faction.goldIncome); processResearch(state, faction); }
  for (const city of [...state.cities]) { processCity(state, city); if (state.winner) break; }
  for (const unit of state.units) {
    const onOwnLand = getTile(state, unit.tileId).owner === unit.faction;
    if (unit.healing || !unit.acted) unit.hp = Math.min(unit.maxHp, unit.hp + (onOwnLand ? 18 : 10) + traitHealingBonus(state,unit));
    unit.moves = unit.maxMoves; unit.acted = false; unit.healing = false;
    unit.cooldown = Math.max(0, (unit.cooldown || 0) - 1);
    unit.buffTurns = Math.max(0, (unit.buffTurns || 0) - 1); if (!unit.buffTurns) unit.bonusStrength = 0;
  }
  state.turn++; updateVision(state); refreshEconomy(state); checkVictory(state);
  return { ok: true, message: state.winner ? 'The campaign has ended.' : `Turn ${state.turn} · Movement and production refreshed.` };
}

export function performAction(state, action) {
  if (!state || !action || typeof action.type !== 'string') return { ok: false, message: 'Invalid command.' };
  if (state.winner) return { ok: false, message: 'This age is complete. Begin a new realm to play again.' };
  const faction = getFaction(state, state.player);
  let result;
  if (['MOVE', 'ATTACK', 'FOUND_CITY', 'BUILD', 'HEAL', 'HERO_POWER', 'FORM_ARMY'].includes(action.type)) {
    const unit = state.units.find(u => u.id === action.unitId);
    if (!unit || unit.faction !== state.player) return { ok: false, message: 'Choose one of your own companies.' };
    if (action.type === 'MOVE') result = moveUnit(state, unit, action.tileId);
    if (action.type === 'ATTACK') result = attackUnit(state, unit, action.tileId);
    if (action.type === 'FOUND_CITY') result = foundCity(state, unit);
    if (action.type === 'BUILD') result = buildImprovement(state, unit, action.improvement);
    if (action.type === 'HERO_POWER') result = heroPower(state, unit);
    if (action.type === 'FORM_ARMY') result = formArmy(state, unit);
    if (action.type === 'HEAL') {
      if (!unit.moves) return { ok: false, message: 'This company has already acted.' };
      unit.healing = true; unit.moves = 0; result = { ok: true, message: `${unit.name} will rest and recover at the end of this turn.` };
    }
  } else if (action.type === 'SET_CITY_FOCUS') {
    const city=state.cities.find(c=>c.id===action.cityId);
    if(!usesFactionTraits(state)||!city||city.faction!==state.player||!CITY_FOCUSES.includes(action.focus))return {ok:false,message:'Choose one of your cities and a valid work focus.'};
    city.focus=action.focus;result={ok:true,message:`${city.name} now prioritizes ${action.focus==='balanced'?'balanced yields':action.focus}.`};
  } else if (action.type === 'SET_PRODUCTION') {
    const city = state.cities.find(c => c.id === action.cityId);
    if (!city || city.faction !== state.player) return { ok: false, message: 'Choose one of your own cities.' };
    const item = availableProduction(state, city).find(p => p.id === action.productionId);
    if (!item) return { ok: false, message: 'That project is unavailable. Check its technology and civic requirements.' };
    if(usesFactionTraits(state)&&item.kind==='district'&&!districtOptions(state,city,item.id).some(t=>t.id===action.tileId))return {ok:false,message:'Choose an available owned tile for this district.'};
    setCityQueue(state,city,item.id,action.tileId); result = { ok: true, message: `${city.name} is now producing ${item.name}.` };
  } else if (action.type === 'SET_RESEARCH' || action.type === 'SET_CIVIC') {
    const tech = action.type === 'SET_RESEARCH', list = tech ? TECHS : CIVICS, completed = tech ? faction.techs : faction.civics;
    const item = list.find(t => t.id === (tech ? action.techId : action.civicId));
    if (!item || completed.includes(item.id) || !item.requires.every(id => completed.includes(id))) return { ok: false, message: 'That study is completed or its prerequisites are not yet known.' };
    faction[tech ? 'research' : 'civic'] = item.id; result = { ok: true, message: `Your scholars are studying ${item.name}.` };
  } else if (action.type === 'SET_POLICY') {
    const policy = POLICIES.find(p => p.id === action.policyId);
    if (!policy || !policy.requires.every(c => faction.civics.includes(c))) return { ok: false, message: 'Complete the required civic to enact that policy.' };
    faction.policy = policy.id; result = { ok: true, message: `${policy.name} is now the law of your realm.` };
  } else if (action.type === 'DIPLOMACY') {
    const other = getFaction(state, action.factionId);
    if (!other || other.id === state.player) return { ok: false, message: 'Choose another realm.' };
    if (action.action === 'gift') {
      if (faction.gold < 25) return { ok: false, message: 'A diplomatic gift costs 25 gold.' };
      faction.gold -= 25; other.gold += 25;
      faction.relations[other.id] = other.relations[faction.id] = 'peace';
      result = { ok: true, message: `A gift of 25 gold has secured peace with ${FACTIONS.find(f => f.id === other.id).name}.` };
    } else if (action.action === 'war' || action.action === 'peace') {
      if (action.action === 'peace' && (other.id === 'mordor' || faction.id === 'mordor') && faction.relations[other.id] === 'war') return { ok: false, message: 'Stormforged requires tribute for a truce. Send 25 gold.' };
      faction.relations[other.id] = other.relations[faction.id] = action.action;
      result = { ok: true, message: `${action.action === 'war' ? 'War declared against' : 'Peace agreed with'} ${FACTIONS.find(f => f.id === other.id).name}.` };
    } else return { ok: false, message: 'Choose peace, war, or a diplomatic gift.' };
    log(state, result.message);
  } else if (action.type === 'END_TURN') return endTurn(state);
  else return { ok: false, message: 'Unknown command.' };
  if (result?.ok) { updateVision(state); refreshEconomy(state); checkVictory(state); }
  return result || { ok: false, message: 'The command could not be completed.' };
}
