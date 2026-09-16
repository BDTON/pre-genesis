// Original fantasy realms inspired by attested religious and mythological figures.
// Realm names, powers, affinities, statistics, and alliances are game fiction.
// Identity sources and the current art/power scope are documented in docs/FACTIONS.md.
import {factionTrait} from './faction-traits.js';
export const LEGACY_FACTION_IDS = Object.freeze(['gondor', 'rohan', 'elves', 'mordor']);

const STYLES = {
  gondor: { color: '#77b7e5', power: 'aegis' },
  rohan: { color: '#e6bd69', power: 'charge' },
  elves: { color: '#91b7cf', power: 'counsel' },
  mordor: { color: '#cc8c6a', power: 'strike' },
};
const UNIT_LABELS = { hero: 'Heroes', warrior: 'Guard battalions', archer: 'Archer battalions', rider: 'Rider battalions', settler: 'Settlers', builder: 'Builders' };
const SOURCES = {
  greek: ['https://www.gutenberg.org/cache/epub/348/pg348-images.html', 'Hesiod, Theogony; Homeric Hymns, translated by H. G. Evelyn-White'],
  egypt: ['https://egyptianmuseum.org/deities-overview', 'Rosicrucian Egyptian Museum: Deities in Ancient Egypt'],
  norse: ['https://www.gutenberg.org/files/18947/18947-h/18947-h.htm', 'Snorri Sturluson, The Younger Edda, translated by Rasmus B. Anderson'],
  michael: ['https://www.biblegateway.com/passage/?search=Revelation+12&version=KJV', 'Revelation 12:7–9'],
  gabriel: ['https://bible.usccb.org/bible/luke/1', 'Luke 1:19, 26–38'],
  'moses-joshua': ['https://bible.usccb.org/bible/deuteronomy/31', 'Deuteronomy 31:1–8, 14–15'],
  deborah: ['https://bible.usccb.org/bible/judges/4', 'Judges 4:4–10'],
  david: ['https://bible.usccb.org/bible/1samuel/17', '1 Samuel 17'],
  solomon: ['https://bible.usccb.org/bible/1kings/3', '1 Kings 3:5–28'],
  esther: ['https://bible.usccb.org/bible/esther/4', 'Esther 4; Greek additions C and D'],
  vishnu: ['https://www.metmuseum.org/art/collection/search/38530', 'The Metropolitan Museum of Art: Vishnu with Lakshmi and Sarasvati', 'Vishnu is a Hindu deity associated with preserving cosmic order.'],
  shiva: ['https://www.metmuseum.org/essays/recognizing-the-gods', 'The Metropolitan Museum of Art: Recognizing the Gods', 'Shiva’s identifying attributes in Hindu art include a third eye and a trident.'],
  brahma: ['https://www.metmuseum.org/art/collection/search/38265', 'The Metropolitan Museum of Art: Brahma', 'Brahma is a Hindu creator deity, often represented with four faces.'],
  durga: ['https://www.metmuseum.org/essays/recognizing-the-gods', 'The Metropolitan Museum of Art: Recognizing the Gods', 'Durga is represented in Hindu art defeating the buffalo demon.'],
  lakshmi: ['https://www.metmuseum.org/art/collection/search/38530', 'The Metropolitan Museum of Art: Vishnu with Lakshmi and Sarasvati', 'Lakshmi appears beside Vishnu in this Hindu sculpture, carrying a lotus.'],
  saraswati: ['https://www.metmuseum.org/art/collection/search/38530', 'The Metropolitan Museum of Art: Vishnu with Lakshmi and Sarasvati', 'Saraswati, spelled Sarasvati in this museum record, carries a vina in this Hindu sculpture.'],
  amaterasu: ['https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9440', 'Kokugakuin University: Encyclopedia of Shinto, Amaterasu', 'Amaterasu is a sun kami; the cave episode explains the withdrawal and return of her light.'],
  susanoo: ['https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9152', 'Kokugakuin University: Encyclopedia of Shinto, Susanoo', 'Susanoo defeats the serpent Yamata no Orochi in accounts preserved in Japanese chronicles.'],
  inari: ['https://inari.jp/en/saijin/', 'Fushimi Inari Taisha: Enshrined Deity', 'Fushimi Inari Taisha connects Inari’s name and divine protection with rice and abundance.'],
  shango: ['https://www.britishmuseum.org/collection/object/E_Af1952-07-134', 'British Museum: Shango ceremonial baton', 'Shango is a Yoruba thunder deity associated with the ose ceremonial baton.'],
  ogun: ['https://www.metmuseum.org/ko/essays/the-age-of-iron-in-west-africa', 'The Metropolitan Museum of Art: The Age of Iron in West Africa', 'Ogun is a Yoruba deity associated with iron, roads, and warriors.'],
  oshun: ['https://whc.unesco.org/en/list/1118', 'UNESCO World Heritage Centre: Osun-Osogbo Sacred Grove', 'Osun, also spelled Oshun, is the river and fertility divinity associated with the Osun-Osogbo grove.'],
  brigid: ['https://celt.ucc.ie/published/T300010.html', 'University College Cork, CELT: Cath Maige Tuired', 'Brigid appears as Bríg, daughter of the Dagda, in the Irish tale Cath Maige Tuired.'],
  lugh: ['https://celt.ucc.ie/published/T300010.html', 'University College Cork, CELT: Cath Maige Tuired', 'Lugh, spelled Lug in this translation, leads the Tuatha De in Cath Maige Tuired.'],
  dagda: ['https://celt.ucc.ie/published/T300010.html', 'University College Cork, CELT: Cath Maige Tuired', 'The Dagda is a powerful member of the Tuatha De in Cath Maige Tuired.'],
  inanna: ['https://oracc.museum.upenn.edu/amgg/listofdeities/inanaitar/', 'ORACC: Ancient Mesopotamian Gods and Goddesses, Inana/Ishtar', 'Inanna, also written Inana, is associated with love, warfare, and the planet Venus.'],
  enki: ['https://oracc.museum.upenn.edu/amgg/listofdeities/enki/', 'ORACC: Ancient Mesopotamian Gods and Goddesses, Enki/Ea', 'Enki, known as Ea in Akkadian, is associated with wisdom, incantations, and subterranean waters.'],
  marduk: ['https://oracc.museum.upenn.edu/amgg/Listofdeities/Marduk/index.html', 'ORACC: Ancient Mesopotamian Gods and Goddesses, Marduk', 'Marduk is the patron deity of Babylon and became a leading Mesopotamian god.'],
  quetzalcoatl: ['https://www.britishmuseum.org/collection/term/BIOG230422', 'British Museum: Quetzalcoatl', 'Quetzalcoatl is the Aztec name of the Feathered Serpent deity.'],
  tlaloc: ['https://www.metmuseum.org/art/collection/search/310692', 'The Metropolitan Museum of Art: Bell with Face (Tlaloc)', 'Tlaloc is a Mesoamerican rain deity represented with distinctive facial features.'],
  huitzilopochtli: ['https://www.metmuseum.org/art/collection/search/310692', 'The Metropolitan Museum of Art: Bell with Face (Tlaloc)', 'Huitzilopochtli is a Mexica patron deity associated with warriors and fire.'],
  kukulkan: ['https://mna.inah.gob.mx/images/agenda/archivo/GLOSARIO-DIOSES-MAYAS-LSM.pdf', 'Mexico, INAH National Museum of Anthropology: Mayan Gods glossary', 'Kukulkan is identified as a feathered serpent and deity of knowledge in the INAH glossary.'],
  itzamna: ['https://www.metmuseum.org/it/exhibitions/gods-divinity-maya-art/visiting-guide', 'The Metropolitan Museum of Art: Lives of the Gods, Itzamnaaj', 'Itzamnaaj is a deity named in colonial Yucatan; reading the associated ancient name glyph remains uncertain.'],
  inti: ['https://folkways-media.si.edu/docs/folkways/artwork/FW04542.pdf', 'Smithsonian Folkways: Music of the Incas, liner notes', 'Inti is identified as the sun in the Inca religious account summarized in these Smithsonian notes.'],
  viracocha: ['https://folkways-media.si.edu/docs/folkways/artwork/FW04542.pdf', 'Smithsonian Folkways: Music of the Incas, liner notes', 'Viracocha is identified as a creator in the Inca religious account summarized in these Smithsonian notes.'],
  maui: ['https://www.tepapa.govt.nz/digital-museum/explore-digital-museum/crustaceans-aotearoa-new-zealand-and-south-pacific/panenehu', 'Museum of New Zealand Te Papa Tongarewa: Panenehu Shows Koura to Tangaroa', 'Te Papa records Maori stories of Maui pulling up the great fish and confronting Tuna.'],
  tangaroa: ['https://collections.tepapa.govt.nz/object/235625', 'Museum of New Zealand Te Papa Tongarewa: Tangaroa', 'On some Cook Islands, Tangaroa was revered as a principal deity of the sea and creation.'],
  guanyin: ['https://asia.si.edu/education/educator-resources/teaching-china-with-the-smithsonian/explore-by-object/standing-figure-of-guanyin-as-buddha/', 'Smithsonian National Museum of Asian Art: Standing Figure of Guanyin', 'Guanyin is the bodhisattva of compassion in Chinese Buddhism.'],
  nezha: ['https://www.britishmuseum.org/collection/object/A_2018-3005-42?selectedImageId=1613582316', 'British Museum: Nezha', 'Nezha is a protective figure in Chinese religion, depicted as a youth with supernatural attributes.'],
  perun: ['https://pages.uoregon.edu/kimball/chronicle.htm', 'University of Oregon: excerpts from the Russian Primary Chronicle', 'The Primary Chronicle names Perun among the divinities invoked in the oaths of Oleg’s men.'],
};
const BIBLICAL_LORE = {
  michael: 'Revelation portrays Michael leading angels in battle against the dragon.',
  gabriel: 'Luke names Gabriel as the angel who announces Jesus’s birth to Mary.',
  moses: 'Deuteronomy depicts Moses commissioning Joshua before Israel enters the promised land.',
  joshua: 'Deuteronomy names Joshua as the leader who will succeed Moses.',
  deborah: 'Judges describes Deborah as a prophet and judge who summons Barak.',
  david: 'First Samuel recounts David confronting Goliath with a sling.',
  solomon: 'First Kings describes Solomon asking God for wisdom to judge his people.',
  esther: 'Esther describes the queen risking an uninvited audience with the king to plead for her people.',
};
export const factionBonusDescription = (city, units) => [
  ...Object.entries(city).map(([key, value]) => `+${value} ${key} per city`),
  ...Object.entries(units).flatMap(([kind, stats]) => Object.entries(stats).map(([key, value]) => `${UNIT_LABELS[kind]} gain +${value} ${key === 'moves' ? 'movement' : key === 'charges' ? `build charge${value === 1 ? '' : 's'}` : key}`)),
].join('; ') + '.';
function realm(id, name, leader, tradition, capital, visualStyle, cityYields, unitBonuses, powerName, sourceKey, description, options = {}) {
  const style = STYLES[visualStyle];
  const [sourceUrl, sourceLabel, sourceLore] = SOURCES[sourceKey];
  const lore = sourceLore || BIBLICAL_LORE[id === 'gondor' ? 'michael' : id] || (sourceKey === 'greek' ? `${leader} is attested in Hesiod’s Theogony or the Homeric Hymns.` : sourceKey === 'egypt' ? `${leader} is included in the Rosicrucian Egyptian Museum’s guide to ancient Egyptian deities.` : `${leader} appears in Snorri Sturluson’s Prose Edda; spellings vary across translations.`);
  return {
    id, name, leader, patron: options.patron || leader, tradition, capital, visualStyle,
    color: options.color || style.color, description,
    bonus: factionBonusDescription(cityYields, unitBonuses),
    trait: factionTrait(id),
    gameplay: { cityYields, unitBonuses, heroPower: style.power },
    powerName, sourceKey, sourceUrl, sourceLabel, lore,
    imagery: 'The realm’s crest, buildings, unit silhouettes, and power effects are original game interpretations using one of four shared art styles.',
    cityNames: options.cityNames || [`${capital} Vale`, `${capital} Reach`, `${capital} Gate`, `${capital} Shore`],
  };
}

export const FACTIONS = [
  // These four IDs and their exact rules remain compatible with native fixtures.
  realm('gondor', 'Radiant Covenant', 'Michael', 'Christianity', 'Highwatch', 'gondor', { gold: 2, production: 1 }, {}, 'Heaven’s Aegis', 'michael', 'Citadel builders led by Michael, the heavenly defender.', { patron: 'God', cityNames: ['Graceford', 'Brightshore', 'Longwatch', 'Silvergate'] }),
  realm('rohan', 'Solar Dynasty', 'Ra', 'Egyptian', 'Sunreach', 'rohan', { food: 1 }, { rider: { moves: 1, strength: 6 } }, 'Solar Charge', 'egypt', 'River cities and swift armies under the sun god Ra.', { cityNames: ['Dawnsands', 'Reedhaven', 'Aurum', 'Cairn Wells'] }),
  realm('elves', 'Aegis League', 'Athena', 'Greek', 'Thaleon', 'elves', { science: 2 }, { archer: { strength: 5 } }, 'Athena’s Counsel', 'greek', 'A league of scholars and soldiers under Athena.', { cityNames: ['Asteria', 'White Harbor', 'Hillcourt', 'Oliveport'] }),
  realm('mordor', 'Stormforged', 'Thor', 'Norse', 'Skeld', 'mordor', { production: 2 }, { warrior: { strength: 4 } }, 'Thunderstrike', 'norse', 'Northern forge cities under the thunder god Thor.', { cityNames: ['Stormhaven', 'Frostgate', 'Ironfjord', 'Ridgehold'] }),

  realm('zeus', 'Cloudcrown Dominion', 'Zeus', 'Greek', 'Astraport', 'mordor', { gold: 1, culture: 1 }, { hero: { strength: 4 } }, 'Skyfire', 'greek', 'Highland courts whose storm banners rally powerful heroes.'),
  realm("vishnu", "Lotusshield Covenant", "Vishnu", "Hindu", "Bluepetal", "gondor", {"culture":2}, {"warrior":{"strength":4}}, "Preserver’s Aegis", "vishnu", "Fortified cultural centers whose guards protect flourishing civic life."),
  realm('poseidon', 'Tidebound Compact', 'Poseidon', 'Greek', 'Saltspire', 'mordor', { gold: 3 }, { rider: { strength: 4 } }, 'Earthshaker', 'greek', 'Wealthy coastland courts that send cavalry across the mainland.'),
  realm('demeter', 'Amber Harvest', 'Demeter', 'Greek', 'Grainwake', 'gondor', { food: 2 }, { builder: { charges: 1 } }, 'Harvest Shelter', 'greek', 'Agrarian cities whose builders sustain a growing population.'),
  realm("inanna", "Eightstar Concord", "Inanna", "Mesopotamian", "Starbrick", "elves", {"science":1,"culture":1}, {"archer":{"strength":5}}, "Eightstar Counsel", "inanna", "Centers of learning and ceremony defended by skilled archer companies."),
  realm('artemis', 'Silverwood Wardens', 'Artemis', 'Greek', 'Hartmere', 'rohan', { food: 1, science: 1 }, { archer: { strength: 5 } }, 'Wild Hunt', 'greek', 'Woodland settlements protected by mobile archer companies.'),
  realm("shiva", "Ashdance Dominion", "Shiva", "Hindu", "Ashwheel", "mordor", {"production":1,"gold":1}, {"warrior":{"strength":4}}, "Dancing Flame", "shiva", "Workshop cities that prepare disciplined infantry for decisive advances."),
  realm("oshun", "Honeyriver Courts", "Oshun", "Yoruba", "Honeybend", "gondor", {"culture":2}, {"settler":{"moves":1}}, "River Embrace", "oshun", "Cultural courts whose traveling settlers found towns along new routes."),
  realm("ogun", "Ironpath Guilds", "Ogun", "Yoruba", "Anvilcross", "mordor", {"production":2}, {"builder":{"charges":1}}, "Ironfall", "ogun", "Workshop guilds whose dedicated builders transform the frontier."),
  realm('hermes', 'Wayfarer Syndic', 'Hermes', 'Greek', 'Roadmeet', 'rohan', { gold: 3 }, { settler: { moves: 1 } }, 'Winged Passage', 'greek', 'Trading settlements whose fast pioneers extend the road network.'),
  realm("brahma", "Fourfold Loom", "Brahma", "Hindu", "Threadhaven", "gondor", {"food":1,"production":1}, {"builder":{"charges":1}}, "Fourfold Shelter", "brahma", "Cities of field and workshop whose builders sustain new settlements."),
  realm("dagda", "Cauldronbough Pact", "Dagda", "Celtic", "Boughhall", "elves", {"food":1,"culture":1}, {"hero":{"strength":4}}, "Cauldron Renewal", "dagda", "Feasting halls whose harvests and culture sustain heroic households."),
  realm("susanoo", "Stormreed March", "Susanoo", "Shinto", "Stormreed", "mordor", {"gold":3}, {"warrior":{"strength":4}}, "Reedstorm", "susanoo", "Rich border towns whose infantry guard their treasuries and roads."),
  realm("inari", "Ricegate Union", "Inari", "Shinto", "Ricehaven", "elves", {"food":2}, {"settler":{"moves":1}}, "Harvest Counsel", "inari", "Productive farm cities whose swift settlers cultivate new valleys."),
  realm("enki", "Deepwater Scriptoria", "Enki", "Mesopotamian", "Reedscript", "elves", {"science":2}, {"hero":{"strength":4}}, "Deepwater Sight", "enki", "Cities of study whose learned champions explore the surrounding realm."),
  realm("lugh", "Manycraft Alliance", "Lugh", "Celtic", "Skillspire", "rohan", {"culture":2}, {"warrior":{"strength":4}}, "Manycraft Advance", "lugh", "Civic assemblies whose practiced infantry move beneath bright standards."),
  realm("saraswati", "Swanquill League", "Saraswati", "Hindu", "Quillmere", "elves", {"science":2}, {"builder":{"charges":1}}, "Swan’s Counsel", "saraswati", "Scholarly cities whose builders lay foundations for further learning."),
  realm("amaterasu", "Mirror Dawn Empire", "Amaterasu", "Shinto", "Mirrorcrest", "rohan", {"production":1,"science":1}, {"rider":{"strength":4}}, "Dawn Procession", "amaterasu", "Observatory cities that equip mounted companies for rapid advances."),
  realm("quetzalcoatl", "Quetzalwind League", "Quetzalcoatl", "Aztec", "Plumegate", "elves", {"science":1,"culture":1}, {"settler":{"moves":1}}, "Feathered Counsel", "quetzalcoatl", "Learned cultural cities whose settlers carry new ideas across the realm."),

  realm('osiris', 'Verdant Scepter', 'Osiris', 'Egyptian', 'Greenreed', 'gondor', { food: 2 }, { warrior: { strength: 4 } }, 'Reedward', 'egypt', 'Harvest kingdoms whose granaries support steadfast city guards.'),
  realm('isis', 'Veilwing Throne', 'Isis', 'Egyptian', 'Winghaven', 'gondor', { science: 1, culture: 1 }, { hero: { strength: 4 } }, 'Winged Shelter', 'egypt', 'Learned royal cities united around an enduring heroic household.'),
  realm('horus', 'Falconrise Kingdom', 'Horus', 'Egyptian', 'Kestrel Seat', 'rohan', { production: 1, culture: 1 }, { rider: { strength: 4 } }, 'Falcon Advance', 'egypt', 'Royal workshops that equip swift cavalry beneath falcon standards.'),
  realm("lakshmi", "Golden Lotus Courts", "Lakshmi", "Hindu", "Lotusgold", "gondor", {"gold":1,"culture":1}, {"builder":{"charges":1}}, "Lotus Shelter", "lakshmi", "Prosperous artistic courts whose builders turn wealth into improved lands."),
  realm("marduk", "Dragonbrick Crown", "Marduk", "Mesopotamian", "Brickspire", "gondor", {"production":1,"science":1}, {"warrior":{"strength":4}}, "Dragonward", "marduk", "Scholarly workshop towns that build and defend strong civic centers."),
  realm('thoth', 'Ibis Scriptoria', 'Thoth', 'Egyptian', 'Inkwell Reach', 'elves', { science: 2 }, { settler: { moves: 1 } }, 'Scribe’s Horizon', 'egypt', 'Scholarly cities whose travelers establish new centers of learning.'),
  realm("durga", "Lionbanner Shakti", "Durga", "Hindu", "Lioncrest", "mordor", {"food":1,"production":1}, {"warrior":{"strength":4}}, "Lionbanner Surge", "durga", "Harvest fortresses that provision strong infantry beneath lion banners."),
  realm("viracocha", "Firststone Commonwealth", "Viracocha", "Inca", "Firststone", "gondor", {"production":2}, {"builder":{"charges":1}}, "Founding Shelter", "viracocha", "Productive masonry cities sustained by tireless improvement crews."),
  realm("nezha", "Firewheel March", "Nezha", "Chinese", "Wheelgate", "rohan", {"culture":2}, {"archer":{"strength":5}}, "Firewheel Advance", "nezha", "Civic centers guarded by archer companies able to advance rapidly."),
  realm("shango", "Redaxe Thrones", "Shango", "Yoruba", "Redaxe Seat", "mordor", {"food":2}, {"hero":{"strength":4}}, "Thunderbeat", "shango", "Abundant farming realms that support mighty champions and their retinues."),
  realm("tlaloc", "Rainjade Houses", "Tlaloc", "Aztec", "Jadewell", "elves", {"culture":2}, {"builder":{"charges":1}}, "Rain Renewal", "tlaloc", "Ceremonial cities whose construction crews cultivate the surrounding land."),

  realm('odin', 'Ravenmark Jarldoms', 'Odin', 'Norse', 'Rookspire', 'elves', { science: 1, production: 1 }, { hero: { strength: 4 } }, 'Raven’s Sight', 'norse', 'Runic workshops and learned halls rally beneath a far-seeing champion.'),
  realm('freyja', 'Goldfeather Courts', 'Freyja', 'Norse', 'Glimmerhall', 'gondor', { gold: 1, culture: 1 }, { archer: { strength: 5 } }, 'Featherward', 'norse', 'Rich courts that support skilled archers and a protective retinue.'),
  realm('freyr', 'Summergrove Kin', 'Freyr', 'Norse', 'Sunbarrow', 'elves', { food: 2 }, { builder: { charges: 1 } }, 'Summer Renewal', 'norse', 'Growing harvest towns whose builders cultivate the frontier.'),
  realm("maui", "Hookstar Voyagers", "Māui", "Polynesian", "Hookhaven", "gondor", {"production":1,"culture":1}, {"warrior":{"strength":4}}, "Voyager’s Ward", "maui", "Workshop settlements whose civic bonds support reliable guard companies."),
  realm("kukulkan", "Plumescale Courts", "Kukulkan", "Maya", "Featherstone", "elves", {"production":1,"science":1}, {"archer":{"strength":5}}, "Plumed Horizon", "kukulkan", "Scholarly workshops whose archer guards watch the distant frontier."),
  realm("guanyin", "Lotus Mercy Assembly", "Guanyin", "Chinese", "Mercywell", "gondor", {"culture":2}, {"hero":{"strength":4}}, "Compassionate Shelter", "guanyin", "Cultural cities whose heroic guides protect neighboring communities."),
  realm("brigid", "Emberwell Kin", "Brigid", "Celtic", "Emberwell", "gondor", {"science":1,"culture":1}, {"builder":{"charges":1}}, "Kinship Ward", "brigid", "Learned civic houses supported by enduring crafts and careful builders."),
  realm("tangaroa", "Tideweave Confederacy", "Tangaroa", "Polynesian", "Shellharbor", "rohan", {"gold":3}, {"builder":{"charges":1}}, "Tidal Passage", "tangaroa", "Trading towns whose wealth funds an expanding network of improvements."),
  realm('skadi', 'Frostpeak Kin', 'Skadi', 'Norse', 'Snowhart', 'rohan', { food: 1, production: 1 }, { archer: { strength: 5 } }, 'Winter Hunt', 'norse', 'Hardy upland communities that field mobile bands of archers.'),

  realm('gabriel', 'Dawn Heralds', 'Gabriel', 'Christianity', 'Clarion', 'elves', { culture: 2 }, { settler: { moves: 1 } }, 'Herald’s Counsel', 'gabriel', 'An original realm of messengers and traveling settlers inspired by Gabriel.', { patron: 'God' }),
  realm('moses', 'Waystone Covenant', 'Moses', 'Biblical', 'Pathrest', 'gondor', { food: 1, culture: 1 }, { settler: { moves: 1 } }, 'Pilgrim Shelter', 'moses-joshua', 'An original pilgrim realm inspired by the biblical account of Moses.', { patron: 'God' }),
  realm("huitzilopochtli", "Hummingflame Dominion", "Huitzilopochtli", "Aztec", "Flamecrest", "rohan", {"production":1,"culture":1}, {"warrior":{"strength":4}}, "Hummingbird Advance", "huitzilopochtli", "Civic foundry towns that muster infantry for a rapid campaign."),
  realm("itzamna", "Skyglyph Assembly", "Itzamna", "Maya", "Glyphcourt", "gondor", {"science":1,"culture":1}, {"warrior":{"strength":4}}, "Skyward Aegis", "itzamna", "Centers of knowledge and civic ceremony protected by resolute guards."),
  realm("inti", "Goldterrace Crown", "Inti", "Inca", "Goldstep", "rohan", {"culture":2}, {"hero":{"strength":4}}, "Solar Procession", "inti", "Terraced cultural cities whose champions lead far-reaching expeditions."),
  realm("perun", "Oakvow Principate", "Perun", "Slavic", "Oakvow", "mordor", {"gold":1,"science":1}, {"builder":{"charges":1}}, "Oathstrike", "perun", "Prosperous centers of study whose builders strengthen frontier towns."),
  realm('esther', 'Myrtleveil Assembly', 'Esther', 'Biblical', 'Myrtlecourt', 'gondor', { gold: 1, culture: 1 }, { settler: { moves: 1 } }, 'Courageous Shelter', 'esther', 'An original protective assembly inspired by Esther’s biblical story.', { patron: 'God' }),
];

function powerDescription(faction) {
  const name = faction.leader;
  switch (faction.gameplay.heroPower) {
    case 'aegis': return `${name} heals friendly companies within 2 hexes by 24 and grants military companies +6 strength for 2 turns.`;
    case 'charge': return `${name} grants friendly companies within 2 hexes +2 movement this turn and military companies +4 strength for 2 turns.`;
    case 'counsel': return `${name} heals friendly companies within 2 hexes by 30 and reveals the land within 5 hexes for 2 turns.`;
    case 'strike': return `${name} deals 25 damage to enemy companies and 20 damage to enemy cities within 2 hexes. Cities cannot be captured by this power.`;
  }
}
export const HERO_POWERS = FACTIONS.map(f => ({ factionId: f.id, name: f.powerName, cooldown: 4, description: powerDescription(f) }));

// Opponent selection uses a private RNG so the map RNG and legacy fixtures stay
// unchanged. Fisher–Yates supplies three distinct, seed-dependent opponents.
export function campaignRoster(factionId, seed) {
  if (LEGACY_FACTION_IDS.includes(factionId)) return LEGACY_FACTION_IDS.map(id => FACTIONS.find(f => f.id === id));
  const player = FACTIONS.find(f => f.id === factionId);
  if (!player) return campaignRoster('gondor', seed);
  let random = (Number(seed) >>> 0 || 42) ^ 0x9e3779b9;
  for (const char of factionId) random = Math.imul(random ^ char.charCodeAt(0), 16777619) >>> 0;
  const opponents = FACTIONS.filter(f => f.id !== factionId);
  for (let i = opponents.length - 1; i > 0; i--) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(random / 4294967296 * (i + 1));
    [opponents[i], opponents[j]] = [opponents[j], opponents[i]];
  }
  return [player, ...opponents.slice(0, 3)];
}
