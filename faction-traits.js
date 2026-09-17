// Realm traits. Each trait is named with a canonical epithet or phrase of its patron, cited in
// `loreBasis`; the conditions and numbers are game rules, not religious claims.
export const TRAIT_RULESET = 'mythic-traits-v1';
const city = (yields, when = {}, count = null, cap = 1) => ({yields, when, count, cap});
const combat = (amount, when = {}) => ({amount, when});
const trait = (name, summary, weakness, loreBasis, cityRules = [], combatRules = [], movement = null, healing = null) =>
  ({name, summary, weakness, loreBasis, cityRules, combatRules, movement, healing});

// Display names follow engine.js: walls = Cyclopean Walls, granary = Storehouse,
// barracks = Armoury, campus = House of Life, market = Agora, forge = Forge of Hephaestus,
// warrior = Spearmen, archer = Archers, rider = Horsemen, hero = the champion's own name.
export const FACTION_TRAITS = Object.freeze({
  michael: trait('The Great Prince',
    'Cities with Cyclopean Walls gain +2 culture. Spearmen and Michael gain +5 strength on friendly city tiles.',
    'The bonuses need walls and a city tile; strength in the open field is ordinary.',
    'Daniel 12:1 calls Michael the great prince who stands for his people.',
    [city({culture: 2}, {building: 'walls'})],
    [combat(5, {kinds: ['warrior', 'hero'], friendlyCity: true})]),
  ra: trait('Journey of the Barque',
    'Cities beside rivers gain +2 food. Horsemen gain +4 strength on open grassland.',
    'Dry cities, and Horsemen on rough ground, gain nothing.',
    'Book of the Dead chapter 15 hymns Ra as he crosses the sky in his barque each day.',
    [city({food: 2}, {river: true})],
    [combat(4, {kinds: ['rider'], terrain: 'grass'})]),
  athena: trait('Athena Polias',
    'A House of Life adds +2 production when the city has an Armoury. Spearmen gain +4 strength beside Athena.',
    'Needs two buildings and a close formation.',
    'Pausanias 1.26.6 describes the holiest image of Athena on the Acropolis, where she was worshipped as Polias, guardian of the city.',
    [city({production: 2}, {district: 'campus', building: 'barracks'})],
    [combat(4, {kinds: ['warrior'], nearHero: true})]),
  thor: trait('Warden of Midgard',
    'A Forge of Hephaestus beside hills adds +2 production. Thor gains +5 strength on hills.',
    'Flat land, and cities without a forge, gain nothing.',
    'Völuspá 56 calls Thor the warden of Midgard as he goes to meet the world serpent.',
    [city({production: 2}, {district: 'forge', adjacent: 'hills'})],
    [combat(5, {kinds: ['hero'], terrain: 'hills'})]),
  zeus: trait('Zeus Herkeios',
    'A Sanctuary beside mountains adds +2 culture. Zeus gains +4 strength in your own territory.',
    'Zeus gains no strength outside your borders.',
    'Odyssey 22.334–335 names the altar of Zeus Herkeios, guardian of the courtyard.',
    [city({culture: 2}, {district: 'sanctuary', adjacent: 'mountain'})],
    [combat(4, {kinds: ['hero'], ownLand: true})]),
  vishnu: trait('Narayana',
    'Cities at peace gain +1 food and +1 culture. Units resting in your territory heal 6 extra health.',
    'War removes the city bonus; the extra healing needs rest at home.',
    'Manusmriti 1.10 names him Narayana, whose resting place is the waters.',
    [city({food: 1, culture: 1}, {peace: true})], [], null,
    {amount: 6, when: {ownLand: true}}),
  poseidon: trait('Poseidon Hippios',
    'Coastal cities gain +2 gold. Horsemen cross hills for 1 movement.',
    'Inland cities gain nothing; Horsemen still cannot cross water or mountains.',
    'Pausanias 8.10.2 describes the sanctuary of Poseidon Hippios, lord of horses, near Mantinea.',
    [city({gold: 2}, {adjacent: 'water'})], [],
    {kinds: ['rider'], terrain: 'hills'}, null),
  demeter: trait('Demeter Chloe',
    'Each farm nearby adds +1 food, up to +3. Cities training Settlers lose 1 production.',
    'Needs farms, and new Settlers take longer.',
    'Pausanias 1.22.3 records the sanctuary of Demeter Chloe, of the green shoots, at Athens.',
    [city({food: 1}, {}, 'farm', 3), city({production: -1}, {queue: 'settler'})]),
  inanna: trait('Lady of All the Me',
    'A Sanctuary adds +2 gold while at peace. Inanna gains +5 strength in foreign territory.',
    'War stops the gold; at home her strength is ordinary.',
    'Enheduanna’s hymn The exaltation of Inana (ETCSL 4.07.2) opens by hailing her as lady of all the divine powers.',
    [city({gold: 2}, {district: 'sanctuary', peace: true})],
    [combat(5, {kinds: ['hero'], foreignLand: true})]),
  artemis: trait('Artemis Agrotera',
    'Cities gain +1 food per untouched forest beside them, up to +2. Archers cross forests for 1 movement.',
    'Lumber mills remove the food; open ground gives no movement edge.',
    'Pausanias 1.19.6 records the temple of Artemis Agrotera, the Huntress, at Agrae.',
    [city({food: 1}, {}, 'untouchedForest', 2)], [],
    {kinds: ['archer'], terrain: 'forest'}),
  shiva: trait('Nataraja',
    'Cities with a Forge of Hephaestus gain +2 culture but lose 1 food. Shiva gains +6 strength below half health.',
    'Forges slow growth, and the strength needs a wounded Shiva.',
    'The Chola Nataraja bronzes show Shiva as lord of the dance within a ring of fire (The Met, 39328).',
    [city({culture: 2, food: -1}, {district: 'forge'})],
    [combat(6, {kinds: ['hero'], wounded: true})]),
  oshun: trait('Yeye Osun',
    'River cities with a Sanctuary gain +2 food and +1 gold.',
    'Needs a river and a Sanctuary; dry cities gain nothing.',
    'Devotees hail Osun as Yeye, mother, of the river and its grove at Osogbo (Murphy and Sanford 2001).',
    [city({food: 2, gold: 1}, {river: true, district: 'sanctuary'})]),
  ogun: trait('Ogun Onire',
    'Each mine you own adds +1 production per city, up to +2. Builders cross forests for 1 movement.',
    'Needs the Craft of Ptah and mines; Builders cannot defend themselves.',
    'Ogun’s praise poetry hails him as Onire, lord of Ire (S. Barnes, Africa’s Ogun, 1997).',
    [city({production: 1}, {}, 'mine', 2)], [],
    {kinds: ['builder'], terrain: 'forest'}),
  hermes: trait('Hermes Agoraios',
    'An Agora adds +1 gold per kind of resource beside the city, up to +3. Settlers cross hills for 1 movement.',
    'An Agora with no resources nearby gains nothing; fast Settlers still need escorts.',
    'Pausanias 1.15.1 records the bronze Hermes Agoraios, of the marketplace, at Athens.',
    [city({gold: 1}, {district: 'market'}, 'resourceKinds', 3)], [],
    {kinds: ['settler'], terrain: 'hills'}),
  brahma: trait('Chaturmukha',
    'Cities of population 3 or less gain +2 production. Cities with four districts gain +2 science.',
    'The early bonus ends at population 4; the late one needs all four districts.',
    'Hindu sculpture shows Brahma as Chaturmukha, the four-faced (The Met, 38265).',
    [city({production: 2}, {small: true}), city({science: 2}, {districtCount: 4})]),
  dagda: trait('Ollathair',
    'A Storehouse adds +2 food. A Sanctuary adds +1 culture in a city with an Agora.',
    'Both bonuses need buildings; there is no military advantage.',
    'Irish texts call the Dagda Eochaid Ollathair, the great father (Lebor Gabála Érenn).',
    [city({food: 2}, {building: 'granary'}), city({culture: 1}, {district: 'sanctuary', otherDistrict: 'market'})]),
  susanoo: trait('Yakumo Tatsu',
    'Susanoo gains +5 strength on river tiles. River cities gain +2 culture while at peace.',
    'Away from rivers his strength is ordinary; war stops the culture.',
    'Kojiki 1.20: at Suga, Susanoo sings “Yakumo tatsu”, remembered as the first waka.',
    [city({culture: 2}, {river: true, peace: true})],
    [combat(5, {kinds: ['hero'], river: true})]),
  inari: trait('Uka-no-Mitama',
    'Each farm you own adds +1 gold, up to +2 per city. An Agora on a river adds +1 food.',
    'Needs improved land. The foxes are Inari’s messengers, not Inari.',
    'Fushimi Inari Taisha enshrines Uka-no-Mitama, the spirit of rice, as its principal kami.',
    [city({gold: 1}, {}, 'farm', 2), city({food: 1}, {river: true, district: 'market'})]),
  enki: trait('Nudimmud',
    'A House of Life on a river adds +3 science but costs 1 gold.',
    'Needs a river and a district that costs gold every turn.',
    'The first Sumerian temple hymn names Enki as Nudimmud, lord of Eridu (ETCSL 4.80.1).',
    [city({science: 3, gold: -1}, {river: true, district: 'campus'})]),
  lugh: trait('Lámfhada',
    'Cities gain +1 production for each pair of different districts, up to +2. Lugh gains +4 strength beside Builders.',
    'Needs varied districts, and keeping Builders near battle is risky.',
    'Irish tradition names him Lug Lámfhota, Lugh of the long arm (Lebor Gabála Érenn).',
    [city({production: 1}, {}, 'districtPairs', 2)],
    [combat(4, {kinds: ['hero'], nearBuilder: true})]),
  saraswati: trait('Vagdevi',
    'A House of Life adds +2 culture. A Sanctuary adds +1 science when the city has a House of Life.',
    'Both need a House of Life; there is no combat bonus.',
    'Vedic Brahmana texts identify Saraswati with Vak, sacred speech.',
    [city({culture: 2}, {district: 'campus'}), city({science: 1}, {district: 'campus', otherDistrict: 'sanctuary'})]),
  amaterasu: trait('Ōhirume',
    'Cities at peace with a Storehouse gain +2 production. Amaterasu gains +3 strength at full health.',
    'War or wounds switch off the matching bonus.',
    'The Nihon Shoki names the sun goddess Ōhirume-no-muchi (book 1).',
    [city({production: 2}, {peace: true, building: 'granary'})],
    [combat(3, {kinds: ['hero'], fullHealth: true})]),
  quetzalcoatl: trait('Tonacatepetl',
    'A House of Life adds +1 science per farm you own, up to +2. Settlers cross forests for 1 movement.',
    'The science needs farmland; Settlers have no combat strength.',
    'In the Leyenda de los Soles, Quetzalcoatl as an ant carries maize out of Tonacatepetl, the mountain of sustenance.',
    [city({science: 1}, {district: 'campus'}, 'farm', 2)], [],
    {kinds: ['settler'], terrain: 'forest'}),
  osiris: trait('Wennefer',
    'A Storehouse on a river adds +3 food. Osiris heals 4 extra health when resting below half health.',
    'Needs a river and a Storehouse; healing cannot bring back a fallen unit.',
    'Book of the Dead hymns hail Osiris as Wennefer, the perfect one.',
    [city({food: 3}, {river: true, building: 'granary'})], [], null,
    {amount: 4, when: {kinds: ['hero'], wounded: true}}),
  isis: trait('Weret-Hekau',
    'Cities where Isis stands gain +2 science. Units resting beside Isis heal 5 extra health.',
    'Keeping Isis at home limits scouting; units away from her heal normally.',
    'Egyptian texts call Isis Weret-Hekau, great of magic; in the Turin papyrus she learns Ra’s secret name.',
    [city({science: 2}, {heroPresent: true})], [], null,
    {amount: 5, when: {nearHero: true}}),
  horus: trait('Harsiese',
    'The original capital gains +2 production while it has an Armoury. Horsemen gain +4 strength in your own territory.',
    'The production is for the first capital only; Horsemen abroad gain nothing.',
    'In the Contendings of Horus and Seth, Horus son of Isis wins the throne of his father.',
    [city({production: 2}, {capital: true, building: 'barracks'})],
    [combat(4, {kinds: ['rider'], ownLand: true})]),
  lakshmi: trait('Shri',
    'Cities with a Storehouse and an Agora gain +2 gold and +1 food.',
    'Needs two buildings and gives no early military edge.',
    'The Shri Sukta invokes Lakshmi as Shri, radiant prosperity.',
    [city({gold: 2, food: 1}, {building: 'granary', district: 'market'})]),
  marduk: trait('The Fifty Names',
    'Cities with Cyclopean Walls gain +1 production per district, up to +3, but lose 1 gold.',
    'Walls and districts are costly, and every walled city pays upkeep.',
    'Enuma Elish VI–VII: the gods proclaim the fifty names of Marduk.',
    [city({production: 1}, {building: 'walls'}, 'districts', 3), city({gold: -1}, {building: 'walls'})]),
  thoth: trait('Lord of Sacred Words',
    'A House of Life adds +1 science per civic you know, up to +3, and costs 1 gold.',
    'The science needs civics and steady gold.',
    'Egyptian texts call Thoth lord of the god’s words, the hieroglyphs.',
    [city({science: 1}, {district: 'campus'}, 'civics', 3), city({gold: -1}, {district: 'campus'})]),
  durga: trait('Chandika',
    'Durga gains +6 strength in your territory below half health. A Sanctuary with an Armoury adds +2 culture.',
    'The strength needs a wounded Durga; campaigns abroad gain nothing.',
    'The Devi Mahatmya often names the goddess Chandika, the fierce one.',
    [city({culture: 2}, {district: 'sanctuary', building: 'barracks'})],
    [combat(6, {kinds: ['hero'], ownLand: true, wounded: true})]),
  viracocha: trait('Pachayachachic',
    'Cities training Builders gain +3 production. Builders cross hills for 1 movement.',
    'The production helps Builders only; armies and wonders build at the normal speed.',
    'Cristóbal de Molina records his title Pachayachachic, teacher of the world.',
    [city({production: 3}, {queue: 'builder'})], [],
    {kinds: ['builder'], terrain: 'hills'}),
  nezha: trait('Third Prince',
    'Nezha crosses hills for 1 movement and gains +4 strength on unclaimed land.',
    'Claimed land removes the strength; forests still slow him.',
    'Taiwanese temple processions honour Nezha as the Third Prince, Santaizi.',
    [],
    [combat(4, {kinds: ['hero'], neutralLand: true})],
    {kinds: ['hero'], terrain: 'hills'}),
  shango: trait('Oba Koso',
    'Shango gains +5 strength beside your Spearmen. Cities with an Armoury gain +2 culture during war.',
    'Needs Spearmen nearby; the culture ends with the war.',
    'The praise “Oba koso”, the king did not hang, recalls his deification at Koso (S. Johnson, 1921).',
    [city({culture: 2}, {building: 'barracks', war: true})],
    [combat(5, {kinds: ['hero'], nearGuard: true})]),
  tlaloc: trait('Tlaloc Tlamacazqui',
    'River cities gain +1 food per hill beside them, up to +3, but lose 1 production.',
    'Water feeds growth at the cost of industry; flat riverbanks gain less.',
    'The Florentine Codex calls the rain god Tlaloc tlamacazqui, the provider (book 1, chapter 4).',
    [city({food: 1}, {river: true}, 'hills', 3), city({production: -1}, {river: true})]),
  odin: trait('Allfather',
    'Odin sees one hex farther. A House of Life adds +2 science while at war.',
    'The science needs a war; farther sight does not open impassable ground.',
    'Gylfaginning 9 calls Odin Allfather, father of gods and men.',
    [city({science: 2}, {district: 'campus', war: true})]),
  freyja: trait('Vanadís',
    'Agoras add +2 culture. Archers gain +4 strength below half health.',
    'Wounded Archers are fragile, and the culture needs an Agora.',
    'Gylfaginning 35 names Freyja Vanadís, goddess of the Vanir.',
    [city({culture: 2}, {district: 'market'})],
    [combat(4, {kinds: ['archer'], wounded: true})]),
  freyr: trait('Yngvi-Freyr',
    'Cities at peace gain +1 food per untouched forest beside them, up to +3.',
    'War or lumber mills remove the food; peace gives no strength.',
    'Ynglinga saga 10 says Freyr, also called Yngvi, ruled in years of peace and plenty.',
    [city({food: 1}, {peace: true}, 'untouchedForest', 3)]),
  maui: trait('Māui-tikitiki-a-Taranga',
    'Coastal cities training Builders or Settlers gain +2 production. Māui crosses forests for 1 movement.',
    'The coastal bonus is for Builders and Settlers only; water stays impassable.',
    'Māori tradition names him for the topknot of his mother Taranga, in which he was wrapped (G. Grey, 1855).',
    [city({production: 2}, {adjacent: 'water', civilianQueue: true})], [],
    {kinds: ['hero'], terrain: 'forest'}),
  kukulkan: trait('Feathered Serpent',
    'A House of Life beside mountains adds +2 culture. Archers gain +4 strength on hills.',
    'Needs highlands and a House of Life; lowland Archers are ordinary.',
    'Kukulkan means feathered serpent in Yucatec Maya (INAH glossary of Maya gods).',
    [city({culture: 2}, {district: 'campus', adjacent: 'mountain'})],
    [combat(4, {kinds: ['archer'], terrain: 'hills'})]),
  guanyin: trait('Hearer of Cries',
    'Cities at peace with a Sanctuary gain +2 food. Resting Builders and Settlers heal 6 extra health.',
    'War removes the food; there is no strength bonus.',
    'Lotus Sutra chapter 25: Guanyin perceives the cries of the world and answers them.',
    [city({food: 2}, {district: 'sanctuary', peace: true})], [], null,
    {amount: 6, when: {kinds: ['builder', 'settler']}}),
  brigid: trait('Three Brigits',
    'Cities with a Forge of Hephaestus and a Sanctuary gain +2 science. Resting Builders heal 6 extra health.',
    'The science needs two districts; Builders cannot fight.',
    'Cormac’s Glossary names three Brigits: of poetry, of healing and of smithcraft.',
    [city({science: 2}, {district: 'forge', otherDistrict: 'sanctuary'})], [], null,
    {amount: 6, when: {kinds: ['builder']}}),
  tangaroa: trait('Father of Fish',
    'A coastal Agora adds +1 gold per water tile beside the city, up to +3.',
    'Needs a coast and an Agora; inland cities gain nothing.',
    'Māori genealogy makes Tangaroa the ancestor of fish through his son Punga (Te Ara).',
    [city({gold: 1}, {district: 'market'}, 'water', 3)]),
  skadi: trait('Daughter of Þjazi',
    'Archers cross hills for 1 movement. Cities beside mountains gain +2 food with an Armoury.',
    'The food needs a highland city with an Armoury; forests still slow Archers.',
    'Gylfaginning 23: Skadi, daughter of the giant Þjazi, keeps her father’s home at Þrymheimr.',
    [city({food: 2}, {adjacent: 'mountain', building: 'barracks'})], [],
    {kinds: ['archer'], terrain: 'hills'}),
  gabriel: trait('In the Presence of God',
    'Settlers see one hex farther. Cities of population 3 or less gain +2 culture while at peace.',
    'Growth past population 3, or war, ends the culture; Settlers need protection.',
    'Luke 1:19: “I am Gabriel, that stand in the presence of God.”',
    [city({culture: 2}, {small: true, peace: true})]),
  moses: trait('Forty Years',
    'Settlers cross hills for 1 movement. Cities beside wilderness gain +2 food.',
    'The food favours hard land over rich grassland.',
    'Deuteronomy 8:2 recalls the forty years in the wilderness.',
    [city({food: 2}, {adjacent: 'waste'})], [],
    {kinds: ['settler'], terrain: 'hills'}),
  huitzilopochtli: trait('Left-Hand Hummingbird',
    'Cities training Settlers gain +2 production during war. Spearmen gain +4 strength on unclaimed land.',
    'Settlers sent out in wartime need escorts; claimed land removes the strength.',
    'His name joins huitzilin, hummingbird, with opochtli, the left hand, which the Mexica linked with the south.',
    [city({production: 2}, {queue: 'settler', war: true})],
    [combat(4, {kinds: ['warrior'], neutralLand: true})]),
  itzamna: trait('Inventor of Letters',
    'Cities with a House of Life and a Sanctuary gain +2 science and +1 culture.',
    'Needs two districts and gives no military edge.',
    'Colonial Yucatec tradition (López de Cogolludo, 1688) credits Itzamna with inventing the Maya letters.',
    [city({science: 2, culture: 1}, {district: 'campus', otherDistrict: 'sanctuary'})]),
  inti: trait('Punchao',
    'Each farm near the city that lies beside a hill adds +1 culture, up to +3 per city.',
    'Needs well-placed farms; flat fields add nothing.',
    'Cristóbal de Molina describes Punchao, the golden image of the day-sun in Cuzco.',
    [city({culture: 1}, {}, 'terraceFarm', 3)]),
  perun: trait('Perun on the Hill',
    'Spearmen gain +5 strength in your own forests. A Sanctuary beside forest adds +2 gold while at peace.',
    'Needs woodland, and war stops the gold.',
    'Primary Chronicle, year 980: Volodymyr sets up Perun on the hill outside his palace in Kyiv.',
    [city({gold: 2}, {district: 'sanctuary', adjacent: 'forest', peace: true})],
    [combat(5, {kinds: ['warrior'], terrain: 'forest', ownLand: true})]),
  esther: trait('For Such a Time',
    'The original capital gains +3 culture during war. Builders and Settlers resting in your territory heal 4 extra health.',
    'The culture is for one city in wartime only; Builders and Settlers still cannot attack.',
    'Esther 4:14: “who knoweth whether thou art come to the kingdom for such a time as this?”',
    [city({culture: 3}, {capital: true, war: true})], [], null,
    {amount: 4, when: {kinds: ['settler', 'builder'], ownLand: true}}),
});

export const factionTrait = id => FACTION_TRAITS[id] || null;
export const traitSummary = id => factionTrait(id)?.summary || '';
export const usesFactionTraits = state => state.ruleset === TRAIT_RULESET;

const military = new Set(['hero', 'warrior', 'archer', 'rider']);
const distance = (a, b) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
const tileOf = (s, id) => s.tiles.find(t => t.id === id);

function cityContext(s, c) {
  const center = tileOf(s, c.tileId);
  const adjacent = s.tiles.filter(t => distance(t, center) === 1);
  return {
    center,
    adjacent,
    near: s.tiles.filter(t => t.owner === c.faction && t.id !== center.id && distance(t, center) <= 2),
    faction: s.factions.find(f => f.id === c.faction),
  };
}

function cityMatches(s, c, x, w) {
  const war = Object.values(x.faction.relations).includes('war');
  return (!w.district || c.districts.includes(w.district))
    && (!w.otherDistrict || c.districts.includes(w.otherDistrict))
    && (!w.building || c.buildings.includes(w.building))
    && (!w.river || x.center.river || x.adjacent.some(t => t.river))
    && (!w.adjacent || x.adjacent.some(t => t.terrain === w.adjacent))
    && (!w.peace || !war)
    && (!w.war || war)
    && (!w.small || c.population <= 3)
    && (!w.districtCount || c.districts.length >= w.districtCount)
    && (!w.capital || c.capitalOf === c.faction)
    && (!w.queue || c.queue === w.queue)
    && (!w.civilianQueue || ['builder', 'settler'].includes(c.queue))
    && (!w.heroPresent || s.units.some(u => u.faction === c.faction && u.kind === 'hero' && u.tileId === c.tileId));
}

function countCity(s, c, x, count) {
  if (!count) return 1;
  if (['farm', 'mine'].includes(count)) return x.near.filter(t => t.improvement === count).length;
  if (count === 'untouchedForest') return x.adjacent.filter(t => t.terrain === 'forest' && !t.improvement).length;
  if (count === 'resourceKinds') return new Set(x.adjacent.map(t => t.resource).filter(Boolean)).size;
  if (count === 'districtPairs') return Math.floor(new Set(c.districts).size / 2);
  if (count === 'districts') return new Set(c.districts).size;
  if (count === 'civics') return x.faction.civics.length;
  if (count === 'terraceFarm') {
    return x.near.filter(t => t.improvement === 'farm' && s.tiles.some(n => n.terrain === 'hills' && distance(t, n) === 1)).length;
  }
  return x.adjacent.filter(t => t.terrain === count).length;
}

export function traitCityYields(s, c) {
  const result = {food: 0, production: 0, gold: 0, science: 0, culture: 0};
  if (!usesFactionTraits(s)) return result;
  const x = cityContext(s, c);
  for (const rule of factionTrait(c.faction)?.cityRules || []) {
    if (!cityMatches(s, c, x, rule.when)) continue;
    for (const [key, value] of Object.entries(rule.yields)) result[key] += value * Math.min(rule.cap, countCity(s, c, x, rule.count));
  }
  return result;
}

function unitMatches(s, u, w) {
  const tile = tileOf(s, u.tileId);
  if (!tile) return false;
  const near = kind => s.units.some(a => a.id !== u.id && a.faction === u.faction && a.kind === kind && distance(tile, tileOf(s, a.tileId)) <= 1);
  return (!w.kinds || w.kinds.includes(u.kind))
    && (!w.terrain || tile.terrain === w.terrain)
    && (!w.river || tile.river)
    && (!w.ownLand || tile.owner === u.faction)
    && (!w.foreignLand || tile.owner && tile.owner !== u.faction)
    && (!w.neutralLand || !tile.owner)
    && (!w.wounded || u.hp * 2 < u.maxHp)
    && (!w.fullHealth || u.hp === u.maxHp)
    && (!w.friendlyCity || s.cities.some(c => c.faction === u.faction && c.tileId === u.tileId))
    && (!w.nearHero || near('hero'))
    && (!w.nearBuilder || near('builder'))
    && (!w.nearGuard || near('warrior'));
}

export function traitCombatBonus(s, u) {
  if (!usesFactionTraits(s) || !military.has(u.kind)) return 0;
  const rules = factionTrait(u.faction)?.combatRules || [];
  return Math.min(6, rules.reduce((n, r) => n + (unitMatches(s, u, r.when) ? r.amount : 0), 0));
}

export function traitMovementCost(s, u, tile, ordinary) {
  const m = usesFactionTraits(s) && factionTrait(u.faction)?.movement;
  return m && m.kinds.includes(u.kind) && tile.terrain === m.terrain ? 1 : ordinary;
}

export function traitHealingBonus(s, u) {
  const h = usesFactionTraits(s) && factionTrait(u.faction)?.healing;
  return h && unitMatches(s, u, h.when) ? Math.min(6, h.amount) : 0;
}

export function traitVisionBonus(s, u) {
  if (!usesFactionTraits(s)) return 0;
  return (u.faction === 'odin' && u.kind === 'hero') || (u.faction === 'gabriel' && u.kind === 'settler') ? 1 : 0;
}
