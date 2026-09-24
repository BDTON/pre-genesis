/* Pre-Genesis: a deterministic, dependency-free strategy simulation.
 * Every player command passes through performAction. Save a game with
 * JSON.stringify(state) and restore it with JSON.parse; no class instances are used.
 */
import { FACTIONS, HERO_POWERS, campaignRoster } from './factions.js';
import { TRAIT_RULESET, usesFactionTraits, traitCityYields, traitCombatBonus, traitMovementCost, traitHealingBonus, traitVisionBonus } from './faction-traits.js';
import { CITY_FOCUSES, DISTRICT_KINDS, DISTRICT_YIELD, cityWorkPlan, districtOptions, districtAdjacency, districtAt, reservedDistrictAt } from './city-planning.js';
export { TRAIT_RULESET, factionTrait, traitSummary } from './faction-traits.js';
export { FACTIONS, HERO_POWERS, VISUAL_STYLES, campaignRoster } from './factions.js';

export const LEGACY_RULESET = 'legacy-v1';

export const WORLD = Object.freeze({
  name: 'Oikoumene',
  description: 'The inhabited world, all the lands where people live.',
  source: 'Luke 2:1; Acts 17:6 (Greek text: oikoumene)',
});

// Hesiod's five ages. A realm enters the next age as it learns technologies.
export const ERAS = Object.freeze([
  { name: 'Golden Age', techs: 0, description: 'The first people lived like gods, free from toil and grief.', source: 'Hesiod, Works and Days 109–126' },
  { name: 'Silver Age', techs: 2, description: 'A lesser people who would not honour the gods.', source: 'Hesiod, Works and Days 127–142' },
  { name: 'Bronze Age', techs: 4, description: 'A people of bronze arms and bronze houses who loved war.', source: 'Hesiod, Works and Days 143–155' },
  { name: 'Age of Heroes', techs: 6, description: 'The demigods who fought at Thebes and Troy.', source: 'Hesiod, Works and Days 156–173' },
  { name: 'Iron Age', techs: 8, description: 'The present age of labour and sorrow.', source: 'Hesiod, Works and Days 174–201' },
]);

export function getEra(state, factionId = state.player) {
  const known = getFaction(state, factionId)?.techs.length ?? 0;
  let index = 0;
  while (index + 1 < ERAS.length && known >= ERAS[index + 1].techs) index++;
  const era = ERAS[index], next = ERAS[index + 1];
  return { index, name: era.name, description: era.description, source: era.source, techs: known, nextAt: next ? next.techs : null };
}

// Rival realms apply aiYield to production, science and culture and settle up
// to aiCities cities. aiWar sets when a rival may declare war on a human realm.
export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: 'guided', name: 'Guided', description: 'Rivals work at 72% and never start wars.', aiYield: 0.72, aiCities: 4, aiWar: null }),
  Object.freeze({ id: 'standard', name: 'Standard', description: 'Rivals work at 82% and may start late wars.', aiYield: 0.82, aiCities: 4, aiWar: Object.freeze({ fromTurn: 70, ratio: 2 }) }),
  Object.freeze({ id: 'hard', name: 'Hard', description: 'Rivals work at full strength and start wars sooner.', aiYield: 1, aiCities: 4, aiWar: Object.freeze({ fromTurn: 45, ratio: 1.5 }) }),
]);
export const DIFFICULTY_YIELD = Object.freeze(Object.fromEntries(DIFFICULTIES.map(d => [d.id, d.aiYield])));
export const DEFAULT_DIFFICULTY = 'standard';
// Saves written before difficulty existed played at full rival strength.
const SAVED_DIFFICULTY = 'hard';
const difficultyOf = state => DIFFICULTIES.find(d => d.id === (state.difficulty ?? SAVED_DIFFICULTY)) || DIFFICULTIES[2];

export const TECHS = [
  { id: 'agriculture', name: 'Wheat of Triptolemus', cost: 50, requires: [], description: 'Demeter’s grain for all the earth: farms yield 1 more food.', source: 'Apollodorus, Library 1.5.2; Homeric Hymn to Demeter 153, 474–476' },
  { id: 'pottery', name: 'Pithos of Ganymede', cost: 55, requires: [], description: 'Ganymede’s amphora: unlocks the Trade Post and lets cities store 6 more food.', source: 'Homer, Iliad 20.230–235; funerary pithoi, Crete' },
  { id: 'writing', name: 'Writing of Thoth', cost: 60, requires: [], description: 'Thoth’s gift of letters: unlocks the House of Life.', source: 'Plato, Phaedrus 274c–275b' },
  { id: 'masonry', name: 'Craft of Ptah', cost: 65, requires: [], description: 'The maker god’s stonework: unlocks Cyclopean Walls and mines.', source: 'Memphite Theology, Shabaka Stone (British Museum EA 498)' },
  { id: 'astronomy', name: 'Watch-tower of Bel', cost: 80, requires: ['writing'], description: 'The Babylonian ziggurat’s star-watchers: cities on hills produce 1 more science.', source: 'Eratosthenes, quoted by Strabo 1.1.6; BM tablets WA 28178' },
  { id: 'irrigation', name: 'Cedar Channel of Sennacherib', cost: 90, requires: ['agriculture', 'masonry'], description: 'The great aqueduct: cities adjacent to rivers produce 2 more food.', source: 'Luckenbill, The Annals of Sennacherib (OIP 2) 80–91' },
  { id: 'riding', name: 'Bridle of Athena', cost: 95, requires: ['agriculture'], description: 'The golden bridle that tamed Pegasus: unlocks Horsemen.', source: 'Pindar, Olympian 13.63–86' },
  { id: 'sailing', name: 'Argo of the Argonauts', cost: 110, requires: ['pottery'], description: 'The first ship of legend: cities on coasts produce 1 more gold.', source: 'Apollonius Rhodius, Argonautica 1.524–527' },
  { id: 'metalworking', name: 'Craft of Tubal-cain', cost: 130, requires: ['masonry'], description: 'The first smith of bronze and iron: unlocks the Forge of Hephaestus and gives soldiers 4 strength.', source: 'Genesis 4:22' },
  { id: 'calendar', name: 'Calendar of Nabu', cost: 150, requires: ['astronomy'], description: 'The Babylonian year-count: every city produces 1 more science.', source: 'Ptolemy, Almagest III.1; Babylonian Mul.Apin tablets (BM 32312)' },
  { id: 'mathematics', name: 'Theorem of Thales', cost: 175, requires: ['astronomy', 'writing'], description: 'The first philosopher-mathematician: cities gain 1 more science per adjacent mountain.', source: 'Proclus, Commentary on the First Book of Euclid 65.3–65' },
  { id: 'medicine', name: 'Staff of Asclepius', cost: 200, requires: ['mathematics', 'writing'], description: 'The healer’s serpent-staff: every unit heals 4 more on home soil.', source: 'Homeric Hymn to Asclepius 1–5; Pindar, Pythian 3.5–58' },
  { id: 'music', name: 'Lyre of Orpheus', cost: 220, requires: ['medicine'], description: 'The enchanter’s lyre: every city produces 1 more culture.', source: 'Apollodorus, Library 1.3.2; Diodorus Siculus 4.25.4' },
  { id: 'engineering', name: 'Art of Daedalus', cost: 240, requires: ['metalworking', 'writing'], description: 'The master builder’s skill: every city gains 2 production.', source: 'Diodorus Siculus, Library 4.76–77' },
  { id: 'fire', name: 'Fire of Prometheus', cost: 270, requires: ['engineering'], description: 'Fire carried to mortals in a fennel stalk: every city gains 1 production and 1 culture.', source: 'Hesiod, Theogony 565–569; Works and Days 50–52' },
  { id: 'alphabet', name: 'Phoenician Letters', cost: 290, requires: ['writing'], description: 'The traders of Tyre spread their alphabet: civics research 20% faster.', source: 'Herodotus, Histories 5.58; Kilamuwa Inscription (KAI 24)' },
  { id: 'navigation', name: 'Stars of Astarte', cost: 320, requires: ['sailing', 'astronomy'], description: 'Phoenician celestial navigation: cities on coasts produce 1 more gold.', source: 'Lucan, Pharsalia 3.193–228; Periplus of Pseudo-Skylax 1' },
  { id: 'law_code', name: 'Code of Hammurabi', cost: 360, requires: ['writing', 'masonry'], description: 'The stele of laws: every city gains 1 culture and 1 gold.', source: 'Code of Hammurabi, prologue (BM ANE 91028)' },
  { id: 'siegecraft', name: 'Helepolis of Demetrius', cost: 410, requires: ['engineering', 'metalworking'], description: 'The siege tower of Poliorcetes: siege units gain 6 strength against cities.', source: 'Vitruvius, De Architectura 10.22.14; Plutarch, Demetrius 21.3' },
  { id: 'tablet_of_destinies', name: 'Tablet of Destinies', cost: 480, requires: ['engineering'], description: 'The tablet Marduk took from Kingu: unlocks Etemenanki.', source: 'Enuma Elish I 157; IV 121–122' },
];

export const CIVICS = [
  { id: 'tradition', name: 'The Me', cost: 45, requires: [], description: 'The decrees of civilization Inanna brought to Uruk: unlocks the Sanctuary and Bezalel’s Workshop.', source: 'Inana and Enki (ETCSL 1.3.1)' },
  { id: 'military', name: 'Einherjar', cost: 70, requires: [], description: 'Odin’s chosen warriors: unlocks the Myrmidons policy.', source: 'Grímnismál 18–23; Snorri, Gylfaginning 38–41' },
  { id: 'monuments', name: 'Pyramids of Giza', cost: 95, requires: ['tradition'], description: 'The eternal tombs: every city produces 1 more culture per adjacent desert.', source: 'Herodotus, Histories 2.124; Pyramid Inscriptions, Lepsius 2.415' },
  { id: 'statesmanship', name: 'Sceptre of the Pharaoh', cost: 110, requires: ['tradition'], description: 'The double crown: unlocks the Granaries policy and lets capital cities produce 1 more gold.', source: 'Tefnakht Stela (Cairo CG 20692); Manetho, Aegyptiaca fr. 4' },
  { id: 'trade', name: 'Ships of Tarshish', cost: 120, requires: ['tradition'], description: 'Solomon’s trading fleet: unlocks the Agora and the Treaty with Hiram.', source: '1 Kings 10:22' },
  { id: 'lorekeepers', name: 'Seven Sages', cost: 140, requires: ['tradition'], description: 'The apkallu who taught the arts: unlocks the Tablet House policy.', source: 'Berossus, Babyloniaca F1; Uruk List of Kings and Sages (W 20030,7)' },
  { id: 'phalanx', name: 'Sarissa of Macedon', cost: 200, requires: ['military'], description: 'The pike-phalanx of Pella: pikemen gain 8 strength and cost 10 more gold each.', source: 'Polybius 18.29; Asclepiodotus, Tactics 3.4' },
  { id: 'code_of_laws', name: 'Twelve Tables', cost: 210, requires: ['statesmanship'], description: 'Roman law set in bronze: every city produces 1 more gold and 1 more culture.', source: 'Cicero, De Oratore 1.43.193; Livy 3.34' },
  { id: 'cosmology', name: 'Cave of the Seven Veils', cost: 320, requires: ['lorekeepers', 'monuments'], description: 'The mysteries of Eleusis: every city produces 1 more culture and 1 more science.', source: 'Homeric Hymn to Demeter 480–482; Pausanias 1.38.7' },
  { id: 'alliances', name: 'Amphictyony', cost: 360, requires: ['trade', 'lorekeepers'], description: 'A sacred league of peoples: needed for Etemenanki and the Temple of Apollo at Delphi.', source: 'Pausanias, Description of Greece 10.8.1–5' },
];

export const POLICIES = [
  { id: 'stewardship', name: 'Joseph’s Granaries', requires: [], description: 'Grain stored in the years of plenty: +2 food in every city.', source: 'Genesis 41:47–57' },
  { id: 'craftsmen', name: 'Bezalel’s Workshop', requires: ['tradition'], description: 'Skilled hands for holy work: +2 production and −1 food in every city.', source: 'Exodus 31:1–5; 35:30–35' },
  { id: 'war_council', name: 'Myrmidons', requires: ['military'], description: 'Achilles’ disciplined host: +1 production in every city and +4 strength for soldiers.', source: 'Homer, Iliad 16.155–220' },
  { id: 'merchants', name: 'Treaty with Hiram', requires: ['trade'], description: 'Cedar from Tyre traded for grain and oil: +4 gold in every city.', source: '1 Kings 5:1–12' },
  { id: 'lorekeepers', name: 'Tablet House', requires: ['lorekeepers'], description: 'The scribal school: +3 science and −1 gold in every city.', source: 'Schooldays (ETCSL 5.1.1)' },
];

export const PRODUCTIONS = [
  { id: 'warrior', name: 'Spearmen', armyName: 'Spear Host', cost: 24, kind: 'unit', description: 'Sturdy foot soldiers: strength 28, movement 2.', source: 'Acts 23:23' },
  { id: 'archer', name: 'Archers', armyName: 'Archer Host', cost: 30, kind: 'unit', description: 'Ranged soldiers: strength 24, attack from 2 hexes away.', source: '1 Chronicles 8:40' },
  { id: 'rider', name: 'Horsemen', armyName: 'Horse Host', cost: 42, kind: 'unit', requires: ['riding'], description: 'Fast riders: strength 36, movement 3.', source: 'Exodus 14:9' },
  { id: 'settler', name: 'Settlers', cost: 44, kind: 'unit', description: 'Found a new city at least 3 hexes from any other.', source: 'Genesis 11:2' },
  { id: 'builder', name: 'Builders', cost: 26, kind: 'unit', description: 'Three charges to build farms, mines and lumber mills on your land.', source: 'Nehemiah 4:18' },
  { id: 'granary', name: 'Storehouse', cost: 32, kind: 'building', description: 'Tithes brought into the storehouse: +3 food.', source: 'Malachi 3:10' },
  { id: 'barracks', name: 'Armoury', cost: 35, kind: 'building', description: 'A tower hung with shields: +1 production, and soldiers trained here gain 4 strength.', source: 'Nehemiah 3:19; Song of Solomon 4:4' },
  { id: 'walls', name: 'Cyclopean Walls', cost: 40, kind: 'building', requires: ['masonry'], description: 'Walls said to be built by the Cyclopes: +60 city health and a stronger defence.', source: 'Pausanias, Description of Greece 2.25.8' },
  { id: 'campus', name: 'House of Life', plural: 'Houses of Life', cost: 48, kind: 'district', requires: ['writing'], description: 'Egypt’s temple school: +3 science, +1 per adjacent mountain and per 2 adjacent forests.', source: 'A. H. Gardiner, “The House of Life”, JEA 24 (1938)' },
  { id: 'market', name: 'Agora', plural: 'Agoras', cost: 42, kind: 'district', civicRequires: ['trade'], description: 'The market and meeting place: +4 gold, +1 per adjacent river or resource.', source: 'Pausanias, Description of Greece 1.15.1' },
  { id: 'sanctuary', name: 'Sanctuary', plural: 'Sanctuaries', cost: 44, kind: 'district', civicRequires: ['tradition'], description: 'A holy place: +3 culture, +1 per 2 adjacent forests.', source: 'Exodus 25:8' },
  { id: 'forge', name: 'Forge of Hephaestus', plural: 'Forges of Hephaestus', cost: 50, kind: 'district', requires: ['metalworking'], description: 'The smith god’s workshop: +3 production, +1 per adjacent hill or mine.', source: 'Homer, Iliad 18.369–617' },
  { id: 'etemenanki', name: 'Etemenanki', cost: 480, kind: 'wonder', requires: ['tablet_of_destinies'], civicRequires: ['alliances'], description: 'The temple-tower of Babylon: finish it to win.', source: 'Herodotus, Histories 1.181; Esagila Tablet (Louvre AO 6555)' },
  { id: 'world_exchange', name: 'Temple of Solomon', cost: 480, kind: 'wonder', requires: ['engineering'], civicRequires: ['trade'], description: 'Solomon’s gold-lined temple: needs 3 Agoras and 3,500 gold to win.', source: '1 Kings 6:21–22; 10:14–22' },
  { id: 'hall_of_nations', name: 'Temple of Apollo at Delphi', cost: 480, kind: 'wonder', civicRequires: ['alliances'], description: 'Apollo’s oracle for all peoples: needs 3 Sanctuaries and 30 culture a turn to win.', source: 'Homeric Hymn to Apollo 285–299; Pausanias 10.5.9–13' },
];

// Economic and cultural projects wait, finished, until their goals are met.
export const VICTORY_GOALS = [
  { id: 'economic', name: 'Temple of Solomon victory', projectId: 'world_exchange', production: 480, goldRequired: 3500, district: 'market', districtRequired: 3, cultureRequired: 0, requires: ['engineering'], civicRequires: ['trade'] },
  { id: 'cultural', name: 'Delphi victory', projectId: 'hall_of_nations', production: 480, goldRequired: 0, district: 'sanctuary', districtRequired: 3, cultureRequired: 30, requires: [], civicRequires: ['alliances'] },
];

// Every victoryType a campaign can end with.
export const VICTORIES = Object.freeze([
  { id: 'etemenanki', name: 'Etemenanki victory', description: 'Learn the Tablet of Destinies, adopt the Amphictyony, then build Etemenanki.', source: 'Herodotus, Histories 1.181' },
  { id: 'economic', name: 'Temple of Solomon victory', description: 'Build 3 Agoras, hold 3,500 gold, then build the Temple of Solomon.', source: '1 Kings 6–7; 10:14–22' },
  { id: 'cultural', name: 'Delphi victory', description: 'Build 3 Sanctuaries, reach 30 culture a turn, then build the Temple of Apollo at Delphi.', source: 'Homeric Hymn to Apollo 285–299' },
  { id: 'domination', name: 'Conquest of the capitals', description: 'Hold every original capital, including your own.', source: 'Plain description' },
  { id: 'conquest', name: 'Fall of the realm', description: 'A realm that loses its last city is out of the campaign.', source: 'Plain description' },
]);

export function victoryProgress(state, factionId = state.player) {
  const faction = getFaction(state, factionId);
  if (!faction) return [];
  const cities = state.cities.filter(c => c.faction === factionId);
  const currentCulture = cities.reduce((sum, c) => sum + cityYields(state, c).culture, 0);
  return VICTORY_GOALS.map(goal => {
    const currentGold = faction.gold;
    const currentDistricts = cities.filter(c => c.districts.includes(goal.district)).length;
    const unlocked = ownsRequirements(faction, goal);
    const ready = unlocked && currentGold >= goal.goldRequired && currentDistricts >= goal.districtRequired && currentCulture >= goal.cultureRequired;
    return { ...goal, currentGold, currentDistricts, currentCulture, unlocked, ready, completed: cities.some(c => c.buildings.includes(goal.projectId)) };
  });
}

const VICTORY_PROJECTS = new Set(PRODUCTIONS.filter(p => p.kind === 'wonder').map(p => p.id));
const MAP_RADIUS = 8;
const UNIT_DATA = { hero: [120, 2, 44], warrior: [100, 2, 28], archer: [80, 2, 24], rider: [100, 3, 36], settler: [60, 2, 0], builder: [60, 2, 0] };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MILITARY = new Set(['hero', 'warrior', 'archer', 'rider']);
const BATTALIONS = ['warrior', 'archer', 'rider'];
const LAND = new Set(['grass', 'forest', 'hills', 'waste']);
const MAX_LOG = 70;
const CITY_HP = 120, CAPITAL_HP = 200, WALLS_HP = 60, CITY_REGEN = 12;
const GIFT_GOLD = 25, TREATY_TURNS = 10, WAR_WARNING_TURNS = 3;
const STARTING_GOLD = 50;

export function distance(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
}

// Tile lookups are hot. The index belongs to one tile list and is rebuilt when
// the list is replaced or a tile object in it is swapped out.
const TILE_INDEX = new WeakMap();
function tileIndex(state) {
  let index = TILE_INDEX.get(state.tiles);
  if (!index || index.byId.size !== state.tiles.length) {
    index = { byId: new Map(state.tiles.map(t => [t.id, t])), around: new Map() };
    TILE_INDEX.set(state.tiles, index);
  }
  return index;
}
export function getTile(state, id) {
  const index = tileIndex(state), tile = index.byId.get(id);
  if (!tile || tile.id === id) return tile;
  TILE_INDEX.delete(state.tiles);
  return tileIndex(state).byId.get(id);
}
export function getFaction(state, id) { return state.factions.find(f => f.id === id); }
export function neighbors(state, id) {
  const index = tileIndex(state);
  let list = index.around.get(id);
  if (!list) {
    const t = getTile(state, id);
    if (!t) return [];
    list = DIRECTIONS.map(([q, r]) => index.byId.get(`${t.q + q},${t.r + r}`)).filter(Boolean);
    index.around.set(id, list);
  }
  return list.slice();
}

function rand(state) {
  state.rngState = ((state.rngState || 1) * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}
function nextId(state, prefix) { return `${prefix}-${state.nextId++}`; }
function passable(tile) { return Boolean(tile) && tile.terrain !== 'water' && tile.terrain !== 'mountain'; }
function military(unit) { return MILITARY.has(unit.kind); }
function log(state, text) {
  state.log.unshift({ turn: state.turn, text });
  state.log = state.log.slice(0, MAX_LOG);
}
function narrate(state, tileId, faction, text) {
  if (faction === state.player || getTile(state, tileId)?.visible) log(state, text);
}
function atWar(state, a, b) { return a !== b && getFaction(state, a)?.relations[b] === 'war'; }
// In a shared campaign the roster owns control; state.player only selects a view.
function humanControlled(state, factionId) { return state.humanFactions?.includes(factionId) ?? (factionId === state.player); }
function ownsRequirements(faction, item) {
  return (item.requires || []).every(t => faction.techs.includes(t)) && (item.civicRequires || []).every(c => faction.civics.includes(c));
}
function realmName(factionId) { return FACTIONS.find(f => f.id === factionId)?.name || factionId; }
function productionOf(id) { return PRODUCTIONS.find(p => p.id === id); }
function formatNumber(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function romanNumeral(n) {
  const numerals = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let text = '';
  for (const [value, symbol] of numerals) while (n >= value) { text += symbol; n -= value; }
  return text;
}

/** A fresh 32-bit campaign seed. */
export function randomSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] || 1;
}

// ---------------------------------------------------------------------------
// Seeded map generation
// ---------------------------------------------------------------------------

function mapHash(key, a, b, c) {
  let h = (key ^ Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
function seededRandom(key) {
  let value = key >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise(key, channel, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const sx = (x - x0) * (x - x0) * (3 - 2 * (x - x0));
  const sy = (y - y0) * (y - y0) * (3 - 2 * (y - y0));
  const corner = (i, j) => mapHash(key, x0 + i, y0 + j, channel) / 4294967296;
  const top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * sx;
  const bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * sx;
  return top + (bottom - top) * sy;
}
function fractalNoise(key, channel, x, y, scale) {
  let total = 0, weight = 0, amplitude = 1, frequency = 1 / scale;
  for (let octave = 0; octave < 3; octave++) {
    total += amplitude * valueNoise(key, channel + octave * 17, x * frequency + octave * 31.7, y * frequency - octave * 12.3);
    weight += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return total / weight;
}
const ringOf = t => Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(t.q + t.r));
const planeX = t => t.q + t.r / 2;
const planeY = t => t.r * Math.sqrt(3) / 2;
const byScore = score => (a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1);

function mapNeighbors(byId, t) {
  return DIRECTIONS.map(([q, r]) => byId.get(`${t.q + q},${t.r + r}`)).filter(Boolean);
}
function within(tiles, center, radius) { return tiles.filter(t => distance(t, center) <= radius); }

function landComponents(tiles, byId) {
  const seen = new Set(), components = [];
  for (const start of tiles) {
    if (!LAND.has(start.terrain) || seen.has(start.id)) continue;
    const component = [start];
    seen.add(start.id);
    for (let i = 0; i < component.length; i++) {
      for (const next of mapNeighbors(byId, component[i])) {
        if (LAND.has(next.terrain) && !seen.has(next.id)) { seen.add(next.id); component.push(next); }
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

// Every land tile must be reachable: tiny pockets are filled, larger ones get a pass.
function connectLand(tiles, byId) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const [main, ...others] = landComponents(tiles, byId);
    if (!others.length) return;
    const pocket = others[others.length - 1];
    if (pocket.length <= 3) {
      for (const t of pocket) {
        t.terrain = mapNeighbors(byId, t).some(n => n.terrain === 'water') ? 'water' : 'mountain';
        t.river = false;
        t.resource = null;
      }
      continue;
    }
    const mainIds = new Set(main.map(t => t.id)), pocketIds = new Set(pocket.map(t => t.id));
    const previous = new Map(), queue = [...pocket];
    let reached = null;
    for (let i = 0; i < queue.length && !reached; i++) {
      for (const next of mapNeighbors(byId, queue[i])) {
        if (previous.has(next.id) || pocketIds.has(next.id)) continue;
        previous.set(next.id, queue[i]);
        if (mainIds.has(next.id)) { reached = next; break; }
        if (!LAND.has(next.terrain)) queue.push(next);
      }
    }
    for (let step = reached && previous.get(reached.id); step && !pocketIds.has(step.id); step = previous.get(step.id)) {
      step.terrain = step.terrain === 'mountain' ? 'hills' : 'grass';
      step.resource = null;
    }
  }
}

function breakMountainRanges(tiles, byId, largest = 4) {
  const seen = new Set();
  for (const start of tiles) {
    if (start.terrain !== 'mountain' || seen.has(start.id)) continue;
    const range = [start];
    seen.add(start.id);
    for (let i = 0; i < range.length; i++) {
      for (const next of mapNeighbors(byId, range[i])) {
        if (next.terrain === 'mountain' && !seen.has(next.id)) { seen.add(next.id); range.push(next); }
      }
    }
    for (const t of range.slice(largest)) t.terrain = 'hills';
  }
}

function carveRivers(tiles, byId, elevation, random) {
  const sources = tiles
    .filter(t => LAND.has(t.terrain) && ringOf(t) <= 6 && mapNeighbors(byId, t).some(n => n.terrain === 'mountain' || n.terrain === 'hills'))
    .sort(byScore(t => elevation.get(t.id) + random() * 0.15));
  const chosen = [];
  for (const source of sources) {
    if (chosen.length === 3) break;
    if (chosen.some(other => distance(other, source) < 5)) continue;
    const course = [source], visited = new Set([source.id]);
    let current = source, outlet = false;
    while (course.length < 10) {
      const options = mapNeighbors(byId, current).filter(n => !visited.has(n.id) && n.terrain !== 'mountain');
      if (!options.length) break;
      if (options.some(n => n.terrain === 'water') || ringOf(current) === MAP_RADIUS) { outlet = true; break; }
      current = options.sort((a, b) => elevation.get(a.id) - elevation.get(b.id) || (a.id < b.id ? -1 : 1))[0];
      visited.add(current.id);
      course.push(current);
    }
    if (course.length < 4 || !outlet && ringOf(current) < MAP_RADIUS - 1) continue;
    chosen.push(source);
    for (const t of course) t.river = true;
  }
}

function scatterResources(tiles, random) {
  for (const t of tiles) {
    const roll = random();
    t.resource = null;
    if (t.terrain === 'water') t.resource = roll < 0.25 ? 'fish' : null;
    else if (t.terrain === 'mountain') t.resource = null;
    else if (roll < 0.15) t.resource = t.terrain === 'hills' || t.terrain === 'waste' ? 'iron' : t.terrain === 'forest' ? 'timber' : 'wheat';
    else if (roll > 0.91) t.resource = t.terrain === 'grass' ? 'horses' : 'gems';
  }
}

// Good starts have open land nearby and room to settle further out.
function landValue(tiles, center) {
  let value = 0;
  for (const t of tiles) {
    const gap = distance(t, center);
    if (gap <= 2) value += (LAND.has(t.terrain) ? 2 : 0) + (t.terrain === 'grass' ? 1 : 0) + (t.river ? 0.5 : 0);
    else if (gap <= 4 && LAND.has(t.terrain)) value += 0.5;
  }
  return value;
}

function mapTileValue(t) {
  const food = (t.terrain === 'grass' ? 2 : t.terrain === 'forest' ? 1 : 0) + (t.resource === 'wheat' || t.resource === 'fish' ? 2 : 0);
  const production = (t.terrain === 'hills' ? 2 : t.terrain === 'forest' || t.terrain === 'waste' ? 1 : 0) + (t.resource === 'iron' || t.resource === 'timber' ? 1 : 0);
  const gold = (t.river ? 1 : 0) + (t.resource === 'gems' || t.resource === 'horses' ? 2 : 0);
  return food + production + gold;
}
// The yield of the six best tiles a new capital can work.
function startValue(tiles, center) {
  return tiles.filter(t => t.id !== center.id && distance(t, center) <= 2).map(mapTileValue).sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0);
}
// Rivers make some starts richer; the poorer starts receive extra gems.
function balanceStarts(tiles, centers) {
  for (let pass = 0; pass < 8; pass++) {
    const values = centers.map(c => startValue(tiles, c)), best = Math.max(...values);
    const poorest = values.indexOf(Math.min(...values));
    if (best - values[poorest] <= 1) return;
    const center = centers[poorest];
    const spot = tiles
      .filter(t => distance(t, center) === 2 && !t.resource && ['hills', 'forest', 'waste'].includes(t.terrain))
      .sort(byScore(mapTileValue))[0];
    if (!spot) return;
    spot.resource = 'gems';
  }
}

// Start slots sit evenly around the centre, far enough apart that their work
// areas and nearby settling land do not overlap. Several rotations are tried
// and the most widely spaced arrangement wins.
function pickStartSlots(tiles, byId, count, random) {
  const first = random() * Math.PI * 2;
  let best = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const slots = placeSlots(tiles, byId, count, first + attempt * Math.PI / (3 * count));
    let spacing = Infinity;
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) spacing = Math.min(spacing, distance(slots[i], slots[j]));
    const value = slots.reduce((sum, t) => sum + landValue(tiles, t), 0);
    if (!best || spacing > best.spacing || spacing === best.spacing && value > best.value) best = { slots, spacing, value };
    if (spacing >= { 2: 9, 3: 8, 4: 7 }[count]) break;
  }
  return best.slots;
}

function placeSlots(tiles, byId, count, turn) {
  const spacing = { 2: 9, 3: 8, 4: 7 }[count], radius = 5.2;
  const candidates = tiles.filter(t => LAND.has(t.terrain) && ringOf(t) >= 3 && ringOf(t) <= 6);
  const slots = [];
  for (let k = 0; k < count; k++) {
    const angle = turn + k * 2 * Math.PI / count;
    const x = radius * Math.cos(angle), y = radius * Math.sin(angle);
    const offset = t => Math.hypot(planeX(t) - x, planeY(t) - y);
    let pick = null;
    for (let need = spacing; !pick && need >= 5; need--) {
      pick = candidates
        .filter(t => offset(t) <= 2.6 && slots.every(s => distance(s, t) >= need))
        .sort(byScore(t => landValue(tiles, t) - 3 * offset(t)))[0] || null;
    }
    if (!pick) {
      const r = Math.round(y / (Math.sqrt(3) / 2)), q = Math.round(x - r / 2);
      pick = byId.get(`${q},${r}`) || tiles.filter(t => ringOf(t) <= 6).sort(byScore(t => -offset(t)))[0];
    }
    slots.push(pick);
  }
  return slots;
}

// Every start gets the same basic shape: open land, two hills, a forest, a
// wheat field beside the capital, iron nearby and one luxury.
function prepareStart(tiles, center, random) {
  const ring1 = tiles.filter(t => distance(t, center) === 1);
  const ring2 = tiles.filter(t => distance(t, center) === 2);
  const shuffled = list => list.map(t => [mapHash(Math.floor(random() * 4294967296), t.q, t.r, 7), t]).sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  Object.assign(center, { terrain: 'grass', resource: null, improvement: null });
  for (const t of ring1) {
    if (t.terrain === 'water' || t.terrain === 'waste') t.terrain = 'grass';
    if (t.terrain === 'mountain') t.terrain = 'hills';
  }
  const rough = shuffled(ring1.filter(t => t.terrain !== 'grass'));
  while (ring1.filter(t => t.terrain === 'grass').length < 3) rough.pop().terrain = 'grass';
  const count = terrain => ring2.filter(t => t.terrain === terrain).length;
  for (const t of shuffled(ring2.filter(t => t.terrain === 'water')).slice(2)) t.terrain = 'grass';
  for (const t of shuffled(ring2.filter(t => t.terrain === 'mountain')).slice(1)) t.terrain = 'hills';
  for (const t of shuffled(ring2.filter(t => t.terrain === 'waste')).slice(1)) t.terrain = 'grass';
  // Open ground is reshaped first; forest only when no open ground is left.
  const open = () => [...shuffled(ring2.filter(t => t.terrain === 'grass' || t.terrain === 'waste')), ...shuffled(ring2.filter(t => t.terrain === 'forest')).slice(1)];
  for (const t of open().slice(0, Math.max(0, 2 - count('hills')))) t.terrain = 'hills';
  for (const t of open().slice(0, Math.max(0, 1 - count('forest')))) t.terrain = 'forest';
  for (const t of [center, ...ring1, ...ring2]) t.resource = null;
  const place = (list, resource) => { const t = shuffled(list)[0]; if (t) t.resource = resource; };
  place(ring1.filter(t => t.terrain === 'grass'), 'wheat');
  place(ring2.filter(t => t.terrain === 'hills'), 'iron');
  place(ring2.filter(t => t.terrain === 'grass' && !t.resource), 'horses');
  place(ring2.filter(t => t.terrain === 'water'), 'fish');
}

/**
 * Build the 217-hex world for a seed and 2–4 start slots.
 * Returns { tiles, slots } where slots are tile ids in realm order.
 */
export function generateMap(seed, realmCount = 4) {
  if (!Number.isInteger(realmCount) || realmCount < 2 || realmCount > 4) throw Error('A map needs two to four start slots.');
  const key = mapHash((Number(seed) >>> 0) || 42, 0x5eed, realmCount, 1);
  const random = seededRandom(key);
  const tiles = [], byId = new Map();
  for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
    for (let r = -MAP_RADIUS; r <= MAP_RADIUS; r++) {
      if (Math.abs(q + r) > MAP_RADIUS) continue;
      const tile = { id: `${q},${r}`, q, r, terrain: 'grass', resource: null, owner: null, explored: false, visible: false, improvement: null, river: false };
      tiles.push(tile);
      byId.set(tile.id, tile);
    }
  }
  const elevation = new Map(), rugged = new Map(), moisture = new Map();
  for (const t of tiles) {
    const x = planeX(t), y = planeY(t), edge = ringOf(t) / MAP_RADIUS;
    elevation.set(t.id, fractalNoise(key, 1, x, y, 5) - 0.5 * edge ** 3);
    rugged.set(t.id, 1 - Math.abs(2 * fractalNoise(key, 101, x, y, 3.5) - 1));
    moisture.set(t.id, fractalNoise(key, 201, x, y, 4));
  }
  const total = tiles.length;
  const low = [...tiles].sort((a, b) => elevation.get(a.id) - elevation.get(b.id) || (a.id < b.id ? -1 : 1));
  for (const t of low.slice(0, Math.round(total * 0.13))) t.terrain = 'water';
  const high = tiles.filter(t => t.terrain !== 'water').sort(byScore(t => 0.65 * rugged.get(t.id) + 0.35 * elevation.get(t.id)));
  const mountains = Math.round(total * 0.06), hills = Math.round(total * 0.14);
  high.slice(0, mountains).forEach(t => { t.terrain = 'mountain'; });
  high.slice(mountains, mountains + hills).forEach(t => { t.terrain = 'hills'; });
  const open = tiles.filter(t => t.terrain === 'grass').sort(byScore(t => moisture.get(t.id)));
  open.slice(0, Math.round(open.length * 0.3)).forEach(t => { t.terrain = 'forest'; });
  open.slice(open.length - Math.round(open.length * 0.12)).forEach(t => { t.terrain = 'waste'; });
  breakMountainRanges(tiles, byId);
  carveRivers(tiles, byId, elevation, random);
  connectLand(tiles, byId);
  scatterResources(tiles, random);
  const slots = pickStartSlots(tiles, byId, realmCount, random);
  for (const center of slots) prepareStart(tiles, center, random);
  balanceStarts(tiles, slots);
  connectLand(tiles, byId);
  return { tiles, slots: slots.map(t => t.id) };
}

// ---------------------------------------------------------------------------
// Units, cities and campaign setup
// ---------------------------------------------------------------------------

function makeUnit(state, faction, kind, tileId) {
  const [hp, movement, strength] = UNIT_DATA[kind];
  const info = FACTIONS.find(f => f.id === faction);
  const bonus = usesFactionTraits(state) ? {} : info.gameplay.unitBonuses[kind] || {};
  const unit = {
    id: nextId(state, 'unit'),
    name: kind === 'hero' ? info.leader : productionOf(kind).name,
    kind, faction, tileId, hp, maxHp: hp,
    moves: movement + (bonus.moves || 0),
    maxMoves: movement + (bonus.moves || 0),
    strength: strength + (bonus.strength || 0),
    xp: 0,
    charges: kind === 'builder' ? 3 + (bonus.charges || 0) : 0,
    cooldown: 0, bonusStrength: 0, buffTurns: 0,
  };
  unit.armySize = 1;
  state.units.push(unit);
  return unit;
}

function claimTerritory(state, city) {
  const center = getTile(state, city.tileId), radius = city.population >= 4 ? 2 : 1;
  for (const t of state.tiles) {
    if (distance(center, t) <= radius && (!t.owner || t.id === city.tileId)) t.owner = city.faction;
  }
}

// City names follow the realm's list; when it runs out the list repeats with a numeral.
function nextCityName(state, info) {
  const used = new Set(state.cities.map(c => c.name));
  const names = info.cityNames?.length ? info.cityNames : [info.capital];
  for (let round = 1; ; round++) {
    for (const base of names) {
      const name = round === 1 ? base : `${base} ${romanNumeral(round)}`;
      if (!used.has(name)) return name;
    }
  }
}

function makeCity(state, faction, tileId, capitalOf = null) {
  const info = FACTIONS.find(f => f.id === faction);
  const name = capitalOf ? info.capital : nextCityName(state, info);
  const hp = capitalOf ? CAPITAL_HP : CITY_HP;
  const city = { id: nextId(state, 'city'), name, faction, tileId, population: 2, hp, maxHp: hp, food: 0, production: 0, queue: 'granary', buildings: [], districts: [], capitalOf };
  if (usesFactionTraits(state)) {
    city.focus = 'balanced';
    city.districtTiles = {};
    city.queuedDistrictTileId = null;
  }
  state.cities.push(city);
  claimTerritory(state, city);
  return city;
}

export function createGame(factionId = 'michael', seed = 42, { ruleset = TRAIT_RULESET, roster, difficulty = DEFAULT_DIFFICULTY } = {}) {
  if (![TRAIT_RULESET, LEGACY_RULESET].includes(ruleset)) throw Error('Unknown campaign ruleset.');
  if (!DIFFICULTIES.some(d => d.id === difficulty)) throw Error('Unknown difficulty.');
  if (!FACTIONS.some(f => f.id === factionId)) factionId = 'michael';
  seed = Number.isFinite(Number(seed)) ? Number(seed) : 42;
  if (roster !== undefined && (ruleset !== TRAIT_RULESET || !Array.isArray(roster) || roster.length < 2 || roster.length > 4
    || new Set(roster).size !== roster.length || !roster.includes(factionId) || roster.some(id => !FACTIONS.some(f => f.id === id)))) {
    throw Error('A shared campaign roster must list two to four distinct realms, including its player, under the current ruleset.');
  }
  const realms = roster === undefined ? campaignRoster(factionId, seed) : roster.map(id => FACTIONS.find(f => f.id === id));
  const { tiles, slots } = generateMap(seed, realms.length);
  const state = {
    version: 1, seed, rngState: (seed >>> 0) || 42, nextId: 1, turn: 1, player: factionId, difficulty,
    factions: [], tiles, cities: [], units: [], log: [], winner: null, victoryType: null,
  };
  if (ruleset === TRAIT_RULESET) state.ruleset = ruleset;
  for (const info of realms) {
    state.factions.push({
      id: info.id, gold: STARTING_GOLD, science: 0, culture: 0, techs: [], civics: [],
      research: 'writing', civic: 'tradition', scienceProgress: 0, cultureProgress: 0, policy: 'stewardship',
      relations: Object.fromEntries(realms.filter(f => f.id !== info.id).map(f => [f.id, 'peace'])),
      treaties: {},
    });
  }
  for (const [index, info] of realms.entries()) {
    const tileId = slots[index];
    makeCity(state, info.id, tileId, info.id);
    makeUnit(state, info.id, 'hero', tileId);
    makeUnit(state, info.id, 'settler', tileId);
    const builderSpot = neighbors(state, tileId).find(t => passable(t) && t.owner === info.id);
    makeUnit(state, info.id, 'builder', builderSpot?.id || tileId);
  }
  updateVision(state);
  refreshEconomy(state);
  log(state, `The Golden Age begins. Lead ${realmName(factionId)}: take every capital or raise Etemenanki.`);
  log(state, 'Move your Settlers to a marked site and found a city.');
  return state;
}

export function updateVision(state) {
  const sources = [
    ...state.units.filter(u => u.faction === state.player).map(u => ({ tile: getTile(state, u.tileId), range: (u.kind === 'hero' ? 3 : 2) + traitVisionBonus(state, u) })),
    ...state.cities.filter(c => c.faction === state.player).map(c => ({ tile: getTile(state, c.tileId), range: 3 })),
  ];
  for (const burst of state.visionBursts || []) {
    if (burst.expiresTurn > state.turn) sources.push({ tile: getTile(state, burst.tileId), range: burst.radius });
  }
  for (const tile of state.tiles) {
    tile.visible = tile.owner === state.player || sources.some(s => distance(s.tile, tile) <= s.range);
    if (tile.visible) tile.explored = true;
  }
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

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
  const total = { food: 3, production: 4, gold: 2 + city.population, science: 2 + city.population, culture: 2 + Math.floor(city.population / 3) };
  if (usesFactionTraits(state)) {
    const plan = cityWorkPlan(state, city, tileYield);
    for (const key of ['food', 'production', 'gold']) total[key] += plan.yields[key];
  } else {
    const workable = state.tiles
      .filter(t => t.owner === city.faction && t.id !== city.tileId && distance(t, center) <= (city.population >= 4 ? 2 : 1))
      .map(t => tileYield(faction, t))
      .sort((a, b) => (b.food + b.production + b.gold) - (a.food + a.production + a.gold));
    for (const y of workable.slice(0, city.population)) {
      total.food += y.food;
      total.production += y.production;
      total.gold += y.gold;
    }
  }
  if (city.buildings.includes('granary')) total.food += 3;
  if (city.buildings.includes('barracks')) total.production++;
  for (const kind of DISTRICT_KINDS) {
    if (!city.districts.includes(kind)) continue;
    const site = usesFactionTraits(state) ? city.districtTiles?.[kind] || city.tileId : city.tileId;
    total[DISTRICT_YIELD[kind]] += (kind === 'market' ? 4 : 3) + districtAdjacency(state, site, kind);
  }
  const realmYields = usesFactionTraits(state) ? traitCityYields(state, city) : FACTIONS.find(f => f.id === city.faction).gameplay.cityYields;
  for (const [key, amount] of Object.entries(realmYields)) total[key] += amount;
  if (faction.techs.includes('engineering')) total.production += 2;
  if (faction.techs.includes('fire')) { total.production++; total.culture++; }
  if (faction.policy === 'stewardship') total.food += 2;
  if (faction.policy === 'craftsmen') { total.production += 2; total.food--; }
  if (faction.policy === 'war_council') total.production++;
  if (faction.policy === 'merchants') total.gold += 4;
  if (faction.policy === 'lorekeepers') { total.science += 3; total.gold--; }
  total.food = Math.max(1, total.food - city.population); // Net food after population upkeep.
  if (!humanControlled(state, city.faction)) scaleRivalYields(state, city, total);
  return total;
}

// Rival output is scaled by difficulty. Rounding uses a fixed per-city, per-turn
// offset from the golden-ratio sequence, so small yields average out to exactly
// the scaled amount instead of always rounding down.
const SCALED_YIELDS = ['production', 'science', 'culture'];
function scaleRivalYields(state, city, total) {
  const factor = difficultyOf(state).aiYield;
  if (factor === 1) return;
  const serial = Number(String(city.id).split('-').at(-1)) || 0;
  SCALED_YIELDS.forEach((key, i) => {
    const offset = (state.turn * 0.6180339887 + serial * 0.7548776662 + i * 0.5698402910) % 1;
    total[key] = Math.max(0, Math.floor(total[key] * factor + offset));
  });
}

function militaryUpkeep(state, factionId) {
  return state.units.filter(u => u.faction === factionId && military(u)).length;
}

function refreshEconomy(state) {
  for (const faction of state.factions) {
    const incomes = state.cities.filter(c => c.faction === faction.id).map(c => cityYields(state, c));
    faction.science = incomes.reduce((sum, y) => sum + y.science, 0);
    faction.culture = incomes.reduce((sum, y) => sum + y.culture, 0);
    faction.goldIncome = incomes.reduce((sum, y) => sum + y.gold, 0) - militaryUpkeep(state, faction.id);
  }
}

export function availableProduction(state, city) {
  const faction = getFaction(state, city.faction);
  return PRODUCTIONS.filter(p => ownsRequirements(faction, p)
    && !city.buildings.includes(p.id)
    && !city.districts.includes(p.id)
    && !(p.kind === 'wonder' && state.cities.some(c => c.buildings.includes(p.id)))
    && (!usesFactionTraits(state) || p.kind !== 'district' || districtOptions(state, city, p.id).length > 0));
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function movementCost(state, unit, tile) {
  return traitMovementCost(state, unit, tile, tile.terrain === 'forest' || tile.terrain === 'hills' ? 2 : 1);
}
function foreignOccupied(state, faction) {
  const blocked = new Set();
  for (const c of state.cities) if (c.faction !== faction) blocked.add(c.tileId);
  for (const u of state.units) if (u.faction !== faction) blocked.add(u.tileId);
  return blocked;
}
function canEnter(state, unit, tile, playerFog = true, blocked = null) {
  if (!passable(tile) || playerFog && unit.faction === state.player && !tile.visible) return false;
  if (blocked) return !blocked.has(tile.id);
  if (state.cities.some(c => c.tileId === tile.id && c.faction !== unit.faction)) return false;
  return !state.units.some(u => u.id !== unit.id && u.tileId === tile.id && u.faction !== unit.faction);
}

// A small binary heap keeps path searches fast on long campaigns.
class PathQueue {
  items = [];
  sequence = 0;
  get size() { return this.items.length; }
  #before(a, b) { return a.cost < b.cost || a.cost === b.cost && a.order < b.order; }
  push(id, cost) {
    const items = this.items;
    items.push({ id, cost, order: this.sequence++ });
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.#before(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  pop() {
    const items = this.items, top = items[0], last = items.pop();
    if (items.length) {
      items[0] = last;
      for (let i = 0; ;) {
        const left = 2 * i + 1, right = left + 1;
        let best = i;
        if (left < items.length && this.#before(items[left], items[best])) best = left;
        if (right < items.length && this.#before(items[right], items[best])) best = right;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return top;
  }
}

function paths(state, unit, limit = unit.moves, playerFog = true) {
  const blocked = foreignOccupied(state, unit.faction);
  const costs = new Map([[unit.tileId, 0]]), previous = new Map(), queue = new PathQueue();
  queue.push(unit.tileId, 0);
  while (queue.size) {
    const { id: current, cost: base } = queue.pop();
    if (base > costs.get(current)) continue;
    for (const tile of neighbors(state, current)) {
      if (!canEnter(state, unit, tile, playerFog, blocked)) continue;
      const cost = base + movementCost(state, unit, tile);
      if (cost > limit || costs.has(tile.id) && costs.get(tile.id) <= cost) continue;
      costs.set(tile.id, cost);
      previous.set(tile.id, current);
      queue.push(tile.id, cost);
    }
  }
  return { costs, previous };
}

export function reachableTiles(state, unitId) {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.faction !== state.player) return [];
  return [...paths(state, unit).costs.keys()].filter(id => id !== unit.tileId);
}

function moveUnit(state, unit, tileId, playerFog = true) {
  if (unit.tileId === tileId) return { ok: false, message: 'This unit is already there.' };
  const { costs } = paths(state, unit, unit.moves, playerFog);
  if (!costs.has(tileId)) return { ok: false, message: 'That tile is blocked or out of reach.' };
  unit.moves -= costs.get(tileId);
  unit.tileId = tileId;
  unit.acted = true;
  return { ok: true, message: `${unit.name} moved.` };
}

// ---------------------------------------------------------------------------
// Armies and combat
// ---------------------------------------------------------------------------

function armyReady(unit) {
  return BATTALIONS.includes(unit.kind) && (unit.armySize ?? 1) === 1 && unit.hp === unit.maxHp && unit.moves === unit.maxMoves && !unit.acted;
}
function formArmy(state, unit) {
  // Two units of the same kind, on the same tile, at full health and movement,
  // join into a single host. The maximum stack size is two (CIVREV-shaped
  // rules: small stacks, big decisions). One host with armySize=2 still moves
  // and fights as one unit; the merger is reversible only by losing units.
  const failure = { ok: false, message: 'A host needs 2 unhurt units of one kind on one tile, both with full movement.' };
  if (!armyReady(unit)) return failure;
  const others = state.units
    .filter(u => u.id !== unit.id && u.faction === unit.faction && u.tileId === unit.tileId && u.kind === unit.kind && armyReady(u))
    .slice(0, 1);
  if (others.length !== 1) return failure;
  unit.strength += others[0].strength;
  unit.armySize = 2;
  unit.name = productionOf(unit.kind).armyName;
  unit.moves = 0;
  unit.acted = true;
  unit.healing = false;
  state.units = state.units.filter(u => u !== others[0]);
  narrate(state, unit.tileId, unit.faction, `A new ${unit.name} formed.`);
  return { ok: true, message: `${unit.name} formed. It can move next turn.` };
}

export function combatStrength(state, unit) {
  // A redacted room view includes the observed total for visible opponents.
  // Full simulation states always calculate their own strength, even if an
  // imported unit happens to contain this presentation-only field.
  if (state.rngState === undefined && unit.faction !== state.player && Number.isSafeInteger(unit.observedCombatStrength) && unit.observedCombatStrength >= 0) return unit.observedCombatStrength;
  const f = getFaction(state, unit.faction);
  return unit.strength
    + (unit.bonusStrength || 0)
    + (f.techs.includes('metalworking') ? 4 : 0)
    + (f.policy === 'war_council' ? 4 : 0)
    + Math.min(10, Math.floor(unit.xp / 20) * 2)
    + traitCombatBonus(state, unit);
}

// Larger cities, walls and a realm's own capital all hold out longer.
function cityDefence(city) {
  return 30 + 3 * city.population + (city.buildings.includes('walls') ? 12 : 0) + (city.capitalOf === city.faction ? 12 : 0);
}

function heroPower(state, hero) {
  if (hero.kind !== 'hero' || hero.moves < 1) return { ok: false, message: 'Select your champion with movement left.' };
  if (hero.cooldown > 0) return { ok: false, message: `This power is ready in ${hero.cooldown} ${hero.cooldown === 1 ? 'turn' : 'turns'}.` };
  const source = getTile(state, hero.tileId);
  const allies = state.units.filter(u => u.faction === hero.faction && distance(source, getTile(state, u.tileId)) <= 2);
  const powerKind = FACTIONS.find(f => f.id === hero.faction).gameplay.heroPower;
  hero.moves--;
  hero.acted = true;
  hero.cooldown = 4;
  if (powerKind === 'aegis') {
    for (const ally of allies) { ally.hp = Math.min(ally.maxHp, ally.hp + 24); ally.bonusStrength = military(ally) ? 6 : 0; ally.buffTurns = 2; }
  }
  if (powerKind === 'charge') {
    for (const ally of allies) { ally.moves += 2; ally.bonusStrength = military(ally) ? 4 : 0; ally.buffTurns = 2; }
  }
  if (powerKind === 'counsel') {
    for (const ally of allies) ally.hp = Math.min(ally.maxHp, ally.hp + 30);
    if (hero.faction === state.player) {
      state.visionBursts ||= [];
      state.visionBursts.push({ tileId: hero.tileId, radius: 5, expiresTurn: state.turn + 2 });
    }
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
  // A stack's best defender protects weaker units; equal strengths use the
  // persistent numeric unit ID so saves and array reordering cannot alter combat.
  const defenders = units.filter(military).sort((a, b) => combatStrength(state, b) - combatStrength(state, a) || Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));
  return defenders[0] || units[0] || state.cities.find(c => c.tileId === tileId && c.faction !== attacker.faction);
}

function forecast(state, attackerId, tileId) {
  const attacker = state.units.find(u => u.id === attackerId), tile = getTile(state, tileId);
  if (!attacker || !tile || !military(attacker) || attacker.faction === state.player && !tile.visible) return null;
  const target = combatTarget(state, attacker, tileId);
  if (!target) return null;
  const isCity = !target.kind, ranged = attacker.kind === 'archer', range = ranged ? 2 : 1;
  const defense = isCity ? cityDefence(target) : Math.max(10, combatStrength(state, target));
  const terrainDefense = ['hills', 'forest'].includes(tile.terrain) ? 4 : 0;
  const attack = combatStrength(state, attacker);
  const damage = Math.max(12, Math.min(65, Math.round(30 * Math.exp((attack - defense - terrainDefense) / 45))));
  const retaliation = ranged || !isCity && !military(target) ? 0 : Math.max(8, Math.round(22 * Math.exp((defense - attack) / 55)));
  const gap = distance(getTile(state, attacker.tileId), tile);
  const hostile = atWar(state, attacker.faction, target.faction);
  const canAttack = attacker.moves > 0 && hostile && gap <= range;
  const reason = canAttack ? ''
    : !hostile ? `Declare war on ${realmName(target.faction)} first.`
      : gap > range ? (ranged ? 'Move within 2 hexes to attack.' : 'Move next to the target to attack.')
        : 'No movement left. Attack next turn.';
  const kills = damage >= target.hp, attackerDies = retaliation >= attacker.hp;
  return {
    damage, retaliation, targetName: target.name, targetHp: target.hp, targetId: target.id, isCity, canAttack,
    reason, targetFaction: target.faction, targetMaxHp: target.maxHp, attackerHp: attacker.hp, attackerMaxHp: attacker.maxHp,
    attack, defense, terrainDefense, ranged, range, distance: gap,
    kills, attackerDies, captures: isCity && kills && !ranged && !attackerDies,
  };
}

export function previewCombat(state, unitId, tileId) {
  const f = forecast(state, unitId, tileId);
  return f && { damage: f.damage, retaliation: f.retaliation, targetName: f.targetName, targetHp: f.targetHp, targetId: f.targetId, isCity: f.isCity, canAttack: f.canAttack };
}

/**
 * The full damage forecast for one attack, or null when nothing visible can be attacked there.
 * Fields: canAttack, reason, damage, retaliation, kills, captures, attackerDies, target* and attacker*.
 */
export function combatForecast(state, attackerId, targetTileId) {
  return forecast(state, attackerId, targetTileId);
}

function captureCity(state, city, faction) {
  const previous = city.faction, center = getTile(state, city.tileId);
  city.faction = faction;
  city.hp = Math.round(city.maxHp * 0.55);
  city.population = Math.max(1, city.population - 1);
  city.production = 0;
  city.queue = 'warrior';
  if (usesFactionTraits(state)) {
    city.queuedDistrictTileId = null;
    for (const tileId of Object.values(city.districtTiles || {})) getTile(state, tileId).owner = faction;
  }
  const keepsTile = t => !usesFactionTraits(state)
    || (!districtAt(state, t.id) || districtAt(state, t.id).city.id === city.id)
    && (!reservedDistrictAt(state, t.id) || reservedDistrictAt(state, t.id).id === city.id);
  for (const t of state.tiles) {
    if (distance(t, center) <= 1 && t.owner === previous && keepsTile(t)) t.owner = faction;
  }
  getTile(state, city.tileId).owner = faction;
  state.units = state.units.filter(u => !(u.tileId === city.tileId && u.faction !== faction));
  narrate(state, city.tileId, faction, `${realmName(faction)} took ${city.name}.`);
}

function attackUnit(state, unit, tileId) {
  if (!military(unit)) return { ok: false, message: 'Civilians cannot attack.' };
  const preview = forecast(state, unit.id, tileId);
  if (!preview) return { ok: false, message: 'There is no visible enemy there.' };
  if (!preview.canAttack) return { ok: false, message: preview.reason };
  const target = combatTarget(state, unit, tileId);
  unit.moves = 0;
  unit.acted = true;
  unit.xp += 8;
  target.hp -= preview.damage;
  unit.hp -= preview.retaliation;
  if (target.hp <= 0) {
    if (preview.isCity) {
      if (unit.kind === 'archer' || unit.hp <= 0) {
        target.hp = 1;
        narrate(state, tileId, unit.faction, `${target.name} has no defence left. Spearmen, Horsemen or a champion can take it.`);
      } else {
        captureCity(state, target, unit.faction);
        unit.tileId = tileId;
        unit.xp += 15;
      }
    } else {
      state.units = state.units.filter(u => u.id !== target.id);
      narrate(state, tileId, unit.faction, `${unit.name} defeated ${target.name}.`);
      const stillHeld = state.cities.some(c => c.tileId === tileId && c.faction !== unit.faction) || state.units.some(u => u.tileId === tileId && u.faction !== unit.faction);
      if (unit.kind !== 'archer' && !stillHeld) unit.tileId = tileId;
    }
  } else {
    narrate(state, tileId, unit.faction, `${unit.name} struck ${target.name} for ${preview.damage} damage${preview.retaliation ? ` and took ${preview.retaliation}` : ''}.`);
  }
  if (unit.hp <= 0) {
    state.units = state.units.filter(u => u.id !== unit.id);
    narrate(state, tileId, unit.faction, `${unit.name} fell in battle.`);
  }
  return { ok: true, message: `Dealt ${preview.damage} damage${preview.retaliation ? `, took ${preview.retaliation}` : ''}.` };
}

// ---------------------------------------------------------------------------
// Cities, builders and production
// ---------------------------------------------------------------------------

function canFound(state, unit, tile) {
  return passable(tile)
    && (!tile.owner || tile.owner === unit.faction)
    && (!usesFactionTraits(state) || !districtAt(state, tile.id) && !reservedDistrictAt(state, tile.id))
    && !state.cities.some(c => distance(getTile(state, c.tileId), tile) < 3)
    && !state.units.some(u => u.tileId === tile.id && u.faction !== unit.faction);
}

/** Visible tiles where this Settlers unit could found a city (tile ids). */
export function foundableTiles(state, unitId) {
  const unit = state.units.find(u => u.id === unitId);
  if (unit?.kind !== 'settler') return [];
  return state.tiles.filter(t => (t.visible || unit.faction !== state.player) && canFound(state, unit, t)).map(t => t.id);
}

function foundCity(state, unit) {
  if (unit.kind !== 'settler') return { ok: false, message: 'Only Settlers can found a city.' };
  if (unit.moves < 1) return { ok: false, message: 'Settlers need 1 movement left to found a city. Found it next turn.' };
  if (!canFound(state, unit, getTile(state, unit.tileId))) return { ok: false, message: 'Found cities on open land 3 or more hexes from any city, outside foreign borders.' };
  const city = makeCity(state, unit.faction, unit.tileId);
  state.units = state.units.filter(u => u.id !== unit.id);
  narrate(state, city.tileId, city.faction, `${city.name} was founded.`);
  return { ok: true, message: `${city.name} was founded.` };
}

function buildImprovement(state, unit, improvement) {
  if (unit.kind !== 'builder' || unit.moves < 1 || unit.charges < 1) return { ok: false, message: 'Select Builders with movement and charges left.' };
  const tile = getTile(state, unit.tileId), faction = getFaction(state, unit.faction);
  if (usesFactionTraits(state) && (districtAt(state, tile.id) || reservedDistrictAt(state, tile.id))) return { ok: false, message: 'This tile is kept for a district.' };
  if (tile.owner !== unit.faction || state.cities.some(c => c.tileId === tile.id)) return { ok: false, message: 'Build on your own land, not on a city.' };
  if (tile.improvement) return { ok: false, message: 'This tile is already improved.' };
  if (improvement === 'farm' && !['grass', 'waste'].includes(tile.terrain)) return { ok: false, message: 'Farms need grassland or wilderness.' };
  if (improvement === 'mine' && (tile.terrain !== 'hills' || !faction.techs.includes('masonry'))) return { ok: false, message: 'Mines need hills and the Craft of Ptah.' };
  if (improvement === 'lumbermill' && tile.terrain !== 'forest') return { ok: false, message: 'Lumber mills need forest.' };
  if (!['farm', 'mine', 'lumbermill'].includes(improvement)) return { ok: false, message: 'Choose a farm, mine or lumber mill.' };
  tile.improvement = improvement;
  unit.charges--;
  unit.moves = 0;
  unit.acted = true;
  if (!unit.charges) state.units = state.units.filter(u => u.id !== unit.id);
  const label = { farm: 'Farm', mine: 'Mine', lumbermill: 'Lumber mill' }[improvement];
  narrate(state, tile.id, unit.faction, `${label} built.`);
  return { ok: true, message: `${label} built.` };
}

function spawnForCity(state, city, kind) {
  const candidate = { id: 'pending', faction: city.faction, kind };
  const center = getTile(state, city.tileId);
  const tiles = [center, ...neighbors(state, city.tileId), ...state.tiles.filter(t => distance(t, center) === 2)];
  const tile = tiles.find(t => t.owner === city.faction && canEnter(state, candidate, t, false));
  if (!tile) return false;
  const unit = makeUnit(state, city.faction, kind, tile.id);
  if (city.buildings.includes('barracks') && military(unit)) unit.strength += 4;
  return true;
}

function chooseProduction(state, city) {
  const options = availableProduction(state, city).map(p => p.id), faction = getFaction(state, city.faction);
  const ownUnits = state.units.filter(u => u.faction === city.faction), ownCities = state.cities.filter(c => c.faction === city.faction);
  const soldiers = ownUnits.filter(military).length;
  const center = getTile(state, city.tileId);
  // One wonder city per realm: its best producer.
  if (options.includes('etemenanki') && !ownCities.some(c => c.id !== city.id && c.queue === 'etemenanki')) {
    const output = cityYields(state, city).production;
    if (ownCities.every(c => c.id === city.id || cityYields(state, c).production <= output)) return 'etemenanki';
  }
  const danger = state.units.some(u => military(u) && atWar(state, city.faction, u.faction) && distance(getTile(state, u.tileId), center) <= 6);
  if (danger && soldiers < ownCities.length * 3 + 2) return options.includes('walls') ? 'walls' : options.includes('rider') ? 'rider' : 'warrior';
  if (state.factions.some(f => atWar(state, city.faction, f.id)) && soldiers < ownCities.length * 2 + 1) return options.includes('rider') ? 'rider' : 'archer';
  if (options.includes('granary')) return 'granary';
  const settling = ownUnits.some(u => u.kind === 'settler') || ownCities.some(c => c.id !== city.id && c.queue === 'settler');
  if (ownCities.length < difficultyOf(state).aiCities && !settling) return 'settler';
  for (const id of ['campus', 'sanctuary', 'forge']) if (options.includes(id)) return id;
  if (soldiers < Math.min(10, ownCities.length * 3)) return options.includes('rider') ? 'rider' : 'archer';
  for (const id of ['market', 'walls', 'barracks']) if (options.includes(id)) return id;
  const unimproved = state.tiles.some(t => t.owner === city.faction && !t.improvement && ['grass', 'forest', 'hills'].includes(t.terrain));
  if (!ownUnits.some(u => u.kind === 'builder') && unimproved) return 'builder';
  // A poor treasury cannot pay more soldiers; the city stores its output instead.
  return faction.goldIncome <= 1 ? null : 'archer';
}

function setCityQueue(state, city, productionId, tileId = null) {
  const previous = city.queue;
  city.queue = productionId;
  if (usesFactionTraits(state)) {
    city.queuedDistrictTileId = DISTRICT_KINDS.includes(productionId) ? tileId || districtOptions(state, city, productionId)[0]?.id || null : null;
  }
  // A victory project is public news, like the start of a wonder race.
  if (productionId && productionId !== previous && VICTORY_PROJECTS.has(productionId) && city.faction !== state.player) {
    log(state, `${realmName(city.faction)} has begun ${productionOf(productionId).name} in ${city.name}.`);
  }
}

function goalNeeds(goal) {
  const district = productionOf(goal.district);
  const needs = [{ label: district.plural, current: goal.currentDistricts, required: goal.districtRequired }];
  if (goal.goldRequired) needs.push({ label: 'gold', current: goal.currentGold, required: goal.goldRequired });
  if (goal.cultureRequired) needs.push({ label: 'culture a turn', current: goal.currentCulture, required: goal.cultureRequired });
  return needs;
}

/**
 * Progress of a city's queued wonder. Null unless the city is building one.
 * waiting is true when the wonder is finished but its victory goals are not met.
 */
export function victoryProjectStatus(state, city) {
  const item = city && PRODUCTIONS.find(p => p.id === city.queue && p.kind === 'wonder');
  if (!item) return null;
  const goal = victoryProgress(state, city.faction).find(g => g.projectId === item.id);
  const needs = goal ? goalNeeds(goal) : [];
  const finished = city.production >= item.cost, ready = goal ? goal.ready : true;
  const waiting = finished && !ready;
  const text = waiting ? `Waiting: ${needs.map(n => `${formatNumber(n.current)}/${formatNumber(n.required)} ${n.label}`).join(' · ')}` : '';
  return { projectId: item.id, name: item.name, progress: Math.min(city.production, item.cost), cost: item.cost, finished, ready, waiting, needs, text };
}

/** Wonders other realms are building, most advanced first. */
export function rivalProjects(state, viewer = state.player) {
  return state.cities
    .filter(c => c.faction !== viewer && VICTORY_PROJECTS.has(c.queue))
    .map(c => {
      const item = productionOf(c.queue);
      return { factionId: c.faction, realm: realmName(c.faction), cityId: c.id, city: c.name, projectId: item.id, name: item.name, progress: Math.min(c.production, item.cost), cost: item.cost };
    })
    .sort((a, b) => b.progress / b.cost - a.progress / a.cost || (a.cityId < b.cityId ? -1 : 1));
}

function heldProjectMessage(city, item, goal) {
  const needs = goalNeeds(goal).map(n => `${formatNumber(n.required)} ${n.label}`);
  return `${city.name} finished ${item.name}. It completes when you have ${needs.join(' and ')}.`;
}

function processCity(state, city) {
  const yields = cityYields(state, city);
  const human = humanControlled(state, city.faction);
  city.food += yields.food;
  const growth = 16 + city.population * 9;
  if (city.food >= growth && city.population < 12) {
    city.food -= growth;
    city.population++;
    claimTerritory(state, city);
    narrate(state, city.tileId, city.faction, `${city.name} grew to population ${city.population}.`);
  }
  city.hp = Math.min(city.maxHp, city.hp + CITY_REGEN);
  const options = availableProduction(state, city);
  let item = city.queue ? options.find(p => p.id === city.queue) : null;
  if (city.queue && !item) {
    const lost = productionOf(city.queue);
    setCityQueue(state, city, usesFactionTraits(state) && human ? null : chooseProduction(state, city));
    if (city.faction === state.player && !city.queue) log(state, `${city.name} can no longer build ${lost.name}. Choose another project.`);
    item = null;
  }
  if (item && usesFactionTraits(state) && item.kind === 'district' && !districtOptions(state, city, item.id).some(t => t.id === city.queuedDistrictTileId)) {
    setCityQueue(state, city, null);
    narrate(state, city.tileId, city.faction, `${city.name} lost its district site. Choose another.`);
    item = null;
  }
  const before = city.production;
  if (!item) {
    // Output is stored for the next order, up to the largest ordinary project on offer.
    const store = Math.max(0, ...options.filter(p => p.kind !== 'wonder').map(p => p.cost));
    city.production = Math.min(before + yields.production, Math.max(before, store));
    return;
  }
  city.production += yields.production;
  if (city.production < item.cost) return;
  const victory = victoryProgress(state, city.faction).find(goal => goal.projectId === item.id);
  if (victory && !victory.ready) {
    city.production = item.cost;
    if (before < item.cost && city.faction === state.player) log(state, heldProjectMessage(city, item, victory));
    return;
  }
  if (item.kind === 'unit' && !spawnForCity(state, city, item.id)) {
    city.production = item.cost;
    if (before < item.cost && city.faction === state.player) log(state, `${city.name} has no free tile for new ${item.name}.`);
    return;
  }
  city.production -= item.cost;
  if (item.kind === 'building' || item.kind === 'wonder') city.buildings.push(item.id);
  if (item.kind === 'district') {
    city.districts.push(item.id);
    if (usesFactionTraits(state)) {
      city.districtTiles ||= {};
      city.districtTiles[item.id] = city.queuedDistrictTileId;
    }
  }
  if (item.id === 'walls') { city.maxHp += WALLS_HP; city.hp += WALLS_HP; }
  narrate(state, city.tileId, city.faction, `${city.name} completed ${item.name}.`);
  const next = !human ? chooseProduction(state, city) : item.kind === 'unit' ? item.id : usesFactionTraits(state) ? null : chooseProduction(state, city);
  setCityQueue(state, city, next);
  if (item.id === 'etemenanki') {
    state.winner = city.faction;
    state.victoryType = 'etemenanki';
    log(state, `${realmName(city.faction)} raised Etemenanki and won.`);
  }
  if (victory) {
    getFaction(state, city.faction).gold -= victory.goldRequired;
    state.winner = city.faction;
    state.victoryType = victory.id;
    log(state, `${realmName(city.faction)} completed the ${item.name} and won.`);
  }
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

// Rivals study toward Etemenanki; humans who leave a choice open continue in list order.
const RIVAL_TECH_ORDER = ['writing', 'masonry', 'agriculture', 'metalworking', 'engineering', 'tablet_of_destinies', 'riding', 'fire'];
const RIVAL_CIVIC_ORDER = ['tradition', 'trade', 'lorekeepers', 'alliances', 'military'];
const STUDY_TRACKS = [
  { list: TECHS, rivalOrder: RIVAL_TECH_ORDER, completed: 'techs', current: 'research', progress: 'scienceProgress', income: 'science', done: 'Learned' },
  { list: CIVICS, rivalOrder: RIVAL_CIVIC_ORDER, completed: 'civics', current: 'civic', progress: 'cultureProgress', income: 'culture', done: 'Adopted' },
];

function nextResearch(faction, list, completedField, order = null) {
  const known = faction[completedField];
  const candidates = order ? order.map(id => list.find(item => item.id === id)) : list;
  return candidates.find(item => !known.includes(item.id) && item.requires.every(id => known.includes(id)))?.id || null;
}

function processResearch(state, faction) {
  // Solo players choose each study; shared rooms continue in list order at
  // round end so an unchosen study never wastes a turn.
  const human = humanControlled(state, faction.id), manual = usesFactionTraits(state) && human;
  for (const track of STUDY_TRACKS) {
    const order = human ? null : track.rivalOrder;
    const next = nextResearch(faction, track.list, track.completed, order);
    if (!faction[track.current] && (!manual || state.humanFactions)) faction[track.current] = next;
    if (!faction[track.current]) {
      if (next) faction[track.progress] += faction[track.income];
      continue;
    }
    faction[track.progress] += faction[track.income];
    const item = track.list.find(t => t.id === faction[track.current]);
    if (faction[track.progress] < item.cost) continue;
    faction[track.progress] -= item.cost;
    faction[track.completed].push(item.id);
    if (faction.id === state.player) log(state, `${track.done} ${item.name}.`);
    faction[track.current] = manual ? null : nextResearch(faction, track.list, track.completed, order);
  }
}

// ---------------------------------------------------------------------------
// Diplomacy
// ---------------------------------------------------------------------------

/** The turn a treaty between two realms holds until (0 when free to change). */
export function treatyUntil(state, otherId, factionId = state.player) {
  const until = getFaction(state, factionId)?.treaties?.[otherId] ?? 0;
  return until > state.turn ? until : 0;
}

function setRelation(state, a, b, relation) {
  a.relations[b.id] = b.relations[a.id] = relation;
  (a.treaties ||= {})[b.id] = (b.treaties ||= {})[a.id] = state.turn + TREATY_TURNS;
}

function militaryPower(state, factionId) {
  return state.units.filter(u => u.faction === factionId && military(u)).reduce((sum, u) => sum + combatStrength(state, u), 0);
}

// Rivals may turn on a weaker human neighbour late in the game. They warn
// three turns ahead, and only one rival fights a given human at a time.
function aiDiplomacy(state, faction) {
  const rule = difficultyOf(state).aiWar;
  if (!rule || state.turn < rule.fromTurn - WAR_WARNING_TURNS) return;
  const ownCities = state.cities.filter(c => c.faction === faction.id);
  if (!ownCities.length || Object.values(faction.relations).includes('war')) { delete faction.warPlan; return; }
  const power = militaryPower(state, faction.id);
  const eligible = other => other.id !== faction.id
    && humanControlled(state, other.id)
    && faction.relations[other.id] === 'peace'
    && !treatyUntil(state, other.id, faction.id)
    && !state.factions.some(f => f.id !== faction.id && (f.relations[other.id] === 'war' || f.warPlan?.target === other.id))
    && state.cities.some(c => c.faction === other.id && ownCities.some(own => distance(getTile(state, c.tileId), getTile(state, own.tileId)) <= 8))
    && power >= 120 && power >= rule.ratio * militaryPower(state, other.id);
  const plan = faction.warPlan;
  if (plan) {
    const target = getFaction(state, plan.target);
    if (!target || !eligible(target)) { delete faction.warPlan; return; }
    if (state.turn < plan.turn) return;
    delete faction.warPlan;
    setRelation(state, faction, target, 'war');
    log(state, `${realmName(faction.id)} declared war on ${realmName(target.id)}.`);
    return;
  }
  const target = state.factions.filter(eligible).sort((a, b) => militaryPower(state, a.id) - militaryPower(state, b.id))[0];
  if (!target) return;
  faction.warPlan = { target: target.id, turn: Math.max(state.turn + WAR_WARNING_TURNS, rule.fromTurn) };
  if (target.id === state.player) log(state, `${realmName(faction.id)} is massing troops near your border.`);
}

// ---------------------------------------------------------------------------
// Rival turns
// ---------------------------------------------------------------------------

function goToward(state, unit, destination, route = null) {
  if (!destination || !unit.moves) return;
  // Route around mountains and occupied passes, even if the first step points away.
  // Enemy cities are blocked destinations: the closest reachable approach is used.
  const { costs, previous } = route || paths(state, unit, 500, false);
  let approach = null, best = Infinity;
  for (const [id, cost] of costs) {
    const score = distance(getTile(state, id), destination) * 1000 + cost;
    if (score < best) { best = score; approach = id; }
  }
  if (!approach || approach === unit.tileId) return;
  const steps = [];
  for (let step = approach; step && step !== unit.tileId; step = previous.get(step)) steps.unshift(step);
  const reachable = steps.filter(id => costs.get(id) <= unit.moves);
  if (reachable.length) moveUnit(state, unit, reachable[reachable.length - 1], false);
}

function moveSettler(state, unit, tile) {
  if (canFound(state, unit, tile)) { foundCity(state, unit); return; }
  const route = paths(state, unit, 500, false);
  const sites = state.tiles.filter(t => route.costs.has(t.id) && canFound(state, unit, t));
  const score = t => route.costs.get(t.id) + (t.terrain === 'waste' ? 2 : 0);
  sites.sort((a, b) => score(a) - score(b) || (a.id < b.id ? -1 : 1));
  goToward(state, unit, sites[0], route);
  if (unit.moves && canFound(state, unit, getTile(state, unit.tileId))) foundCity(state, unit);
}

function moveBuilder(state, unit, tile, faction) {
  const id = faction.id;
  const improvable = t => !t.improvement
    && t.owner === id
    && !state.cities.some(c => c.tileId === t.id)
    && (!usesFactionTraits(state) || !districtAt(state, t.id) && !reservedDistrictAt(state, t.id))
    && (['grass', 'waste', 'forest'].includes(t.terrain) || t.terrain === 'hills' && faction.techs.includes('masonry'));
  const kind = t => t.terrain === 'forest' ? 'lumbermill' : t.terrain === 'hills' ? 'mine' : 'farm';
  if (improvable(tile)) { buildImprovement(state, unit, kind(tile)); return; }
  const targets = state.tiles.filter(improvable).sort((a, b) => distance(a, tile) - distance(b, tile));
  goToward(state, unit, targets[0]);
}

function aiTurn(state, faction) {
  const id = faction.id;
  if (!state.cities.some(c => c.faction === id) && !state.units.some(u => u.faction === id)) return;
  aiDiplomacy(state, faction);
  const cities = state.cities.filter(c => c.faction === id);
  for (const city of cities) {
    if (!city.queue) setCityQueue(state, city, chooseProduction(state, city));
    if (usesFactionTraits(state)) city.focus = VICTORY_PROJECTS.has(city.queue) ? 'production' : 'balanced';
  }
  const raisingWonder = cities.some(c => VICTORY_PROJECTS.has(c.queue));
  faction.policy = raisingWonder && faction.civics.includes('tradition') ? 'craftsmen'
    : faction.civics.includes('lorekeepers') ? 'lorekeepers'
      : faction.civics.includes('military') ? 'war_council' : 'stewardship';
  for (const unit of [...state.units.filter(u => u.faction === id)]) {
    if (state.units.includes(unit) && armyReady(unit)) formArmy(state, unit);
  }
  for (const unit of [...state.units.filter(u => u.faction === id)]) {
    if (!state.units.includes(unit) || !unit.moves) continue;
    const tile = getTile(state, unit.tileId);
    if (unit.kind === 'hero' && !unit.cooldown && state.units.some(u => atWar(state, id, u.faction) && distance(tile, getTile(state, u.tileId)) <= 2)) heroPower(state, unit);
    if (unit.kind === 'settler') { moveSettler(state, unit, tile); continue; }
    if (unit.kind === 'builder') { moveBuilder(state, unit, tile, faction); continue; }
    if (unit.hp < unit.maxHp * 0.4) { unit.healing = true; unit.moves = 0; continue; }
    const targets = [...state.units.filter(u => atWar(state, id, u.faction)), ...state.cities.filter(c => atWar(state, id, c.faction))];
    const attackable = targets.filter(t => distance(getTile(state, t.tileId), tile) <= (unit.kind === 'archer' ? 2 : 1));
    attackable.sort((a, b) => (a.hp + (!a.kind ? 100 : 0)) - (b.hp + (!b.kind ? 100 : 0)));
    if (attackable.length) { attackUnit(state, unit, attackable[0].tileId); continue; }
    const enemies = targets.filter(t => !t.kind || military(t));
    enemies.sort((a, b) => distance(tile, getTile(state, a.tileId)) - distance(tile, getTile(state, b.tileId)));
    const closest = enemies[0];
    if (closest && (unit.kind !== 'hero' || state.turn > 12 || distance(tile, getTile(state, closest.tileId)) <= 4)) {
      goToward(state, unit, getTile(state, closest.tileId));
    } else if (unit.kind !== 'hero' && state.cities.some(c => c.faction === id)) {
      const frontier = state.tiles.filter(t => t.owner === id && passable(t));
      goToward(state, unit, frontier[Math.floor(rand(state) * frontier.length)]);
    }
  }
}

// ---------------------------------------------------------------------------
// Turn flow and victory
// ---------------------------------------------------------------------------

function checkVictory(state) {
  if (state.winner) return;
  for (const f of state.factions) {
    if (state.factions.every(original => state.cities.some(c => c.capitalOf === original.id && c.faction === f.id))) {
      state.winner = f.id;
      state.victoryType = 'domination';
      log(state, `${realmName(f.id)} holds every capital of the ${WORLD.name}.`);
      return;
    }
  }
  const playerRemains = state.cities.some(c => c.faction === state.player) || state.units.some(u => u.faction === state.player && u.kind === 'settler');
  if (!state.humanFactions && !playerRemains) {
    const capitalOwner = state.cities.find(c => c.capitalOf === state.player)?.faction;
    const cityCount = id => state.cities.filter(c => c.faction === id).length;
    const victor = getFaction(state, capitalOwner) || state.factions.filter(f => f.id !== state.player).sort((a, b) => cityCount(b.id) - cityCount(a.id))[0];
    state.winner = victor.id;
    state.victoryType = 'conquest';
    log(state, 'Your last city has fallen. The campaign is over.');
  }
}

function collectGold(state, faction) {
  faction.gold += faction.goldIncome;
  if (faction.gold >= 0) return;
  // An empty treasury cannot pay its soldiers: the weakest one leaves.
  const weakest = state.units
    .filter(u => u.faction === faction.id && military(u) && u.kind !== 'hero')
    .sort((a, b) => a.strength - b.strength || (a.id < b.id ? -1 : 1))[0];
  if (weakest) {
    state.units = state.units.filter(u => u !== weakest);
    narrate(state, weakest.tileId, faction.id, `${weakest.name} disbanded: the treasury is empty.`);
  }
  faction.gold = 0;
}

function endTurn(state) {
  // Humans act first, then each rival. Production and research resolve together.
  for (const faction of state.factions) if (!humanControlled(state, faction.id)) aiTurn(state, faction);
  refreshEconomy(state);
  for (const faction of state.factions) {
    collectGold(state, faction);
    processResearch(state, faction);
  }
  for (const city of [...state.cities]) {
    processCity(state, city);
    if (state.winner) break;
  }
  for (const unit of state.units) {
    const onOwnLand = getTile(state, unit.tileId).owner === unit.faction;
    if (unit.healing || !unit.acted) unit.hp = Math.min(unit.maxHp, unit.hp + (onOwnLand ? 18 : 10) + traitHealingBonus(state, unit));
    unit.moves = unit.maxMoves;
    unit.acted = false;
    unit.healing = false;
    unit.cooldown = Math.max(0, (unit.cooldown || 0) - 1);
    unit.buffTurns = Math.max(0, (unit.buffTurns || 0) - 1);
    if (!unit.buffTurns) unit.bonusStrength = 0;
  }
  state.turn++;
  updateVision(state);
  refreshEconomy(state);
  checkVictory(state);
  return { ok: true, message: state.winner ? 'The campaign is over.' : `Turn ${state.turn} begins.` };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function diplomacy(state, faction, action) {
  const other = getFaction(state, action.factionId);
  if (!other || other.id === state.player) return { ok: false, message: 'Choose another realm.' };
  const name = realmName(other.id), relation = faction.relations[other.id], until = treatyUntil(state, other.id);
  if (action.action === 'gift') {
    if (faction.gold < GIFT_GOLD) return { ok: false, message: `A gift costs ${GIFT_GOLD} gold.` };
    if (relation === 'war' && until) return { ok: false, message: `Your treaty with ${name} holds until turn ${until}.` };
    faction.gold -= GIFT_GOLD;
    other.gold += GIFT_GOLD;
    if (relation !== 'war') return { ok: true, message: `Sent ${GIFT_GOLD} gold to ${name}.` };
    setRelation(state, faction, other, 'peace');
    return { ok: true, message: `${name} accepted ${GIFT_GOLD} gold and made peace.` };
  }
  if (action.action !== 'war' && action.action !== 'peace') return { ok: false, message: 'Choose peace, war or a gift.' };
  if (relation === action.action) return { ok: false, message: `You are already at ${relation} with ${name}.` };
  if (until) return { ok: false, message: `Your treaty with ${name} holds until turn ${until}.` };
  setRelation(state, faction, other, action.action);
  delete other.warPlan;
  return { ok: true, message: action.action === 'war' ? `War declared on ${name}.` : `Peace made with ${name}.` };
}

const UNIT_COMMANDS = ['MOVE', 'ATTACK', 'FOUND_CITY', 'BUILD', 'HEAL', 'HERO_POWER', 'FORM_ARMY'];

function unitCommand(state, unit, action) {
  switch (action.type) {
    case 'MOVE': return moveUnit(state, unit, action.tileId);
    case 'ATTACK': return attackUnit(state, unit, action.tileId);
    case 'FOUND_CITY': return foundCity(state, unit);
    case 'BUILD': return buildImprovement(state, unit, action.improvement);
    case 'HERO_POWER': return heroPower(state, unit);
    case 'FORM_ARMY': return formArmy(state, unit);
    case 'HEAL':
      if (!unit.moves) return { ok: false, message: 'This unit has already acted.' };
      unit.healing = true;
      unit.moves = 0;
      return { ok: true, message: `${unit.name} will rest and heal.` };
  }
  return null;
}

export function performAction(state, action) {
  if (!state || !action || typeof action.type !== 'string') return { ok: false, message: 'Invalid command.' };
  if (state.winner) return { ok: false, message: 'The campaign is over. Start a new one to play again.' };
  const faction = getFaction(state, state.player);
  let result;
  if (UNIT_COMMANDS.includes(action.type)) {
    const unit = state.units.find(u => u.id === action.unitId);
    if (!unit || unit.faction !== state.player) return { ok: false, message: 'Select one of your units.' };
    result = unitCommand(state, unit, action);
  } else if (action.type === 'SET_CITY_FOCUS') {
    const city = state.cities.find(c => c.id === action.cityId);
    if (!usesFactionTraits(state) || !city || city.faction !== state.player || !CITY_FOCUSES.includes(action.focus)) return { ok: false, message: 'Choose one of your cities and a valid focus.' };
    city.focus = action.focus;
    result = { ok: true, message: `${city.name} now favours ${action.focus === 'balanced' ? 'balanced yields' : action.focus}.` };
  } else if (action.type === 'SET_PRODUCTION') {
    const city = state.cities.find(c => c.id === action.cityId);
    if (!city || city.faction !== state.player) return { ok: false, message: 'Select one of your cities.' };
    const item = availableProduction(state, city).find(p => p.id === action.productionId);
    if (!item) return { ok: false, message: 'Not available yet. Check its requirements.' };
    if (usesFactionTraits(state) && item.kind === 'district' && !districtOptions(state, city, item.id).some(t => t.id === action.tileId)) return { ok: false, message: 'Choose a free tile you own for this district.' };
    setCityQueue(state, city, item.id, action.tileId);
    result = { ok: true, message: `${city.name} is building ${item.name}.` };
  } else if (action.type === 'SET_RESEARCH' || action.type === 'SET_CIVIC') {
    const tech = action.type === 'SET_RESEARCH', list = tech ? TECHS : CIVICS, completed = tech ? faction.techs : faction.civics;
    const item = list.find(t => t.id === (tech ? action.techId : action.civicId));
    if (!item || completed.includes(item.id) || !item.requires.every(id => completed.includes(id))) return { ok: false, message: 'Already known, or its prerequisites are missing.' };
    faction[tech ? 'research' : 'civic'] = item.id;
    result = { ok: true, message: `${tech ? 'Studying' : 'Pursuing'} ${item.name}.` };
  } else if (action.type === 'SET_POLICY') {
    const policy = POLICIES.find(p => p.id === action.policyId);
    if (!policy || !policy.requires.every(c => faction.civics.includes(c))) return { ok: false, message: 'Adopt the required civic first.' };
    faction.policy = policy.id;
    result = { ok: true, message: `${policy.name} is now in force.` };
  } else if (action.type === 'DIPLOMACY') {
    result = diplomacy(state, faction, action);
    if (result.ok) log(state, result.message);
  } else if (action.type === 'END_TURN') {
    return endTurn(state);
  } else {
    return { ok: false, message: 'Unknown command.' };
  }
  if (result?.ok) {
    updateVision(state);
    refreshEconomy(state);
    checkVictory(state);
  }
  return result || { ok: false, message: 'The command could not be completed.' };
}
