// Pure city-planning rules shared by UI previews and the authoritative simulation.
export const CITY_FOCUSES = ['balanced', 'food', 'production', 'gold'];
export const DISTRICT_KINDS = ['campus', 'market', 'sanctuary', 'forge'];
export const DISTRICT_YIELD = { campus: 'science', market: 'gold', sanctuary: 'culture', forge: 'production' };

const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const distance = (a, b) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
const ordinal = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Lookups by id and by ring are cached per tile list (views and saves replace the list).
const INDEX = new WeakMap();
function indexOf(tiles) {
  let index = INDEX.get(tiles);
  if (!index || index.byId.size !== tiles.length) {
    index = { byId: new Map(tiles.map(t => [t.id, t])), rings: new Map() };
    INDEX.set(tiles, index);
  }
  return index;
}
function tileById(state, id) {
  const tile = indexOf(state.tiles).byId.get(id);
  if (tile && tile.id !== id) { INDEX.delete(state.tiles); return indexOf(state.tiles).byId.get(id); }
  return tile;
}
// Tiles within `radius` hexes of a centre tile, centre included.
function tilesAround(state, center, radius) {
  const index = indexOf(state.tiles), key = `${center.id}/${radius}`;
  let list = index.rings.get(key);
  if (!list) {
    list = [];
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        const tile = index.byId.get(`${center.q + q},${center.r + r}`);
        if (tile) list.push(tile);
      }
    }
    index.rings.set(key, list);
  }
  return list;
}
function adjacentTiles(state, center) {
  const byId = indexOf(state.tiles).byId;
  return DIRECTIONS.map(([q, r]) => byId.get(`${center.q + q},${center.r + r}`)).filter(Boolean);
}

export const districtLimit = population => Math.min(4, 1 + Math.floor((population - 1) / 3));
export const workRadius = city => city.population >= 4 ? 2 : 1;

export function tileYields(faction, tile) {
  let food = tile.terrain === 'grass' ? 2 : tile.terrain === 'forest' ? 1 : 0;
  let production = tile.terrain === 'hills' ? 2 : ['forest', 'waste'].includes(tile.terrain) ? 1 : 0;
  let gold = tile.river ? 1 : 0;
  if (['wheat', 'fish'].includes(tile.resource)) food += 2;
  if (['iron', 'timber'].includes(tile.resource)) production++;
  if (['gems', 'horses'].includes(tile.resource)) gold += 2;
  if (tile.improvement === 'farm') food += faction.techs.includes('agriculture') ? 3 : 2;
  if (['mine', 'lumbermill'].includes(tile.improvement)) production += 2;
  return { food, production, gold };
}

export function districtAt(state, tileId) {
  for (const city of state.cities) {
    const sites = city.districtTiles;
    if (!sites) continue;
    for (const kind in sites) if (sites[kind] === tileId) return { city, kind };
  }
  return null;
}

export function reservedDistrictAt(state, tileId, ignoreCityId = null) {
  return state.cities.find(c => c.id !== ignoreCityId && c.queuedDistrictTileId === tileId && DISTRICT_KINDS.includes(c.queue)) || null;
}

export function cityWorkPlan(state, city, yieldFn = tileYields) {
  const center = tileById(state, city.tileId), faction = state.factions.find(f => f.id === city.faction);
  const forbidden = new Set(state.cities.flatMap(c => [c.tileId, ...Object.values(c.districtTiles || {}), ...(c.queuedDistrictTileId ? [c.queuedDistrictTileId] : [])]));
  const cities = state.cities.filter(c => c.faction === city.faction).map(c => ({ city: c, tile: tileById(state, c.tileId) }));
  const focus = CITY_FOCUSES.includes(city.focus) ? city.focus : 'balanced';
  // A tile belongs to the nearest friendly city that can reach it; ties go to the lower city id.
  const worksHere = t => {
    let nearest = null, gap = Infinity;
    for (const x of cities) {
      const d = distance(t, x.tile);
      if (d > workRadius(x.city)) continue;
      if (d < gap || d === gap && ordinal(x.city.id, nearest.city.id) < 0) { nearest = x; gap = d; }
    }
    return nearest?.city.id === city.id;
  };
  const candidates = tilesAround(state, center, workRadius(city))
    .filter(t => t.owner === city.faction && !forbidden.has(t.id) && worksHere(t))
    .map(tile => ({ tile, yields: yieldFn(faction, tile) }));
  const score = y => (y.food + y.production + y.gold) + (focus === 'balanced' ? 0 : 3 * y[focus]);
  candidates.sort((a, b) => score(b.yields) - score(a.yields) || ordinal(a.tile.id, b.tile.id));
  const worked = candidates.slice(0, city.population);
  const yields = { food: 0, production: 0, gold: 0 };
  for (const x of worked) for (const key of ['food', 'production', 'gold']) yields[key] += x.yields[key];
  return { focus, workedTiles: worked.map(x => x.tile), availableTiles: candidates.map(x => x.tile), yields };
}

export function districtAdjacency(state, tileId, kind) {
  const center = tileById(state, tileId);
  if (!center) return 0;
  const near = adjacentTiles(state, center);
  const count = test => near.filter(test).length;
  if (kind === 'campus') return count(t => t.terrain === 'mountain') + Math.floor(count(t => t.terrain === 'forest') / 2);
  if (kind === 'market') return count(t => t.river || t.resource);
  if (kind === 'sanctuary') return Math.floor(count(t => t.terrain === 'forest') / 2);
  if (kind === 'forge') return count(t => t.terrain === 'hills' || t.improvement === 'mine');
  return 0;
}

export function districtOptions(state, city, kind) {
  if (!DISTRICT_KINDS.includes(kind) || city.districts.includes(kind) || city.districts.length >= districtLimit(city.population)) return [];
  const center = tileById(state, city.tileId);
  return tilesAround(state, center, 2)
    .filter(t => t.owner === city.faction
      && !['water', 'mountain'].includes(t.terrain)
      && !t.improvement
      && !t.resource
      && !state.cities.some(c => c.tileId === t.id)
      && !districtAt(state, t.id)
      && !reservedDistrictAt(state, t.id, city.id))
    .map(t => ({ ...t, adjacency: districtAdjacency(state, t.id, kind), yieldName: DISTRICT_YIELD[kind] }))
    .sort((a, b) => b.adjacency - a.adjacency || ordinal(a.id, b.id));
}
