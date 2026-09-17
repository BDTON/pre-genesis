// The fifty playable realms of Pre-Genesis. Every realm, capital, city, power and emblem name
// comes from the patron's own scripture, myth or sacred geography, and each one carries a
// citation in `sources`. Numbers and alliances are game rules; docs/FACTIONS.md explains them.
import {factionTrait} from './faction-traits.js';

// The four shared art styles, each named after the realm that introduced it.
// Native builds store a style by its index here, so never reorder this list.
export const VISUAL_STYLES = Object.freeze(['michael', 'ra', 'athena', 'thor', 'ancient-of-days']);

// Each art style also selects the champion's power effect.
const STYLE_POWERS = {michael: 'aegis', ra: 'charge', athena: 'counsel', thor: 'strike', 'ancient-of-days': 'judgement'};

const UNIT_LABELS = {warrior: 'Spearmen', archer: 'Archers', rider: 'Horsemen', settler: 'Settlers', builder: 'Builders'};

// Identity sources: [url, label, one-line summary of what the source says about the patron].
const IDENTITY_SOURCES = {
  greek: ['https://www.gutenberg.org/cache/epub/348/pg348-images.html', 'Hesiod, Theogony; Homeric Hymns, translated by H. G. Evelyn-White'],
  egypt: ['https://egyptianmuseum.org/deities-overview', 'Rosicrucian Egyptian Museum: Deities in Ancient Egypt'],
  norse: ['https://www.gutenberg.org/files/18947/18947-h/18947-h.htm', 'Snorri Sturluson, The Younger Edda, translated by Rasmus B. Anderson'],
  michael: ['https://www.biblegateway.com/passage/?search=Revelation+12&version=KJV', 'Revelation 12:7–9',
    'Revelation portrays Michael leading angels in battle against the dragon.'],
  gabriel: ['https://bible.usccb.org/bible/luke/1', 'Luke 1:19, 26–38',
    'Luke names Gabriel as the angel who announces the birth of Jesus to Mary.'],
  moses: ['https://bible.usccb.org/bible/deuteronomy/31', 'Deuteronomy 31:1–8, 14–15',
    'Deuteronomy depicts Moses commissioning Joshua before Israel enters the promised land.'],
  esther: ['https://bible.usccb.org/bible/esther/4', 'Esther 4; Greek additions C and D',
    'Esther risks an uninvited audience with the king to plead for her people.'],
  vishnu: ['https://www.metmuseum.org/art/collection/search/38530', 'The Metropolitan Museum of Art: Vishnu with Lakshmi and Sarasvati',
    'Vishnu is a Hindu deity associated with preserving cosmic order.'],
  shiva: ['https://www.metmuseum.org/essays/recognizing-the-gods', 'The Metropolitan Museum of Art: Recognizing the Gods',
    'Shiva’s identifying attributes in Hindu art include a third eye and a trident.'],
  brahma: ['https://www.metmuseum.org/art/collection/search/38265', 'The Metropolitan Museum of Art: Brahma',
    'Brahma is a Hindu creator deity, often represented with four faces.'],
  durga: ['https://www.metmuseum.org/essays/recognizing-the-gods', 'The Metropolitan Museum of Art: Recognizing the Gods',
    'Durga is represented in Hindu art defeating the buffalo demon.'],
  lakshmi: ['https://www.metmuseum.org/art/collection/search/38530', 'The Metropolitan Museum of Art: Vishnu with Lakshmi and Sarasvati',
    'Lakshmi appears beside Vishnu in this Hindu sculpture, carrying a lotus.'],
  saraswati: ['https://www.metmuseum.org/art/collection/search/38530', 'The Metropolitan Museum of Art: Vishnu with Lakshmi and Sarasvati',
    'Saraswati, spelled Sarasvati in this museum record, carries a vina in this Hindu sculpture.'],
  amaterasu: ['https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9440', 'Kokugakuin University: Encyclopedia of Shinto, Amaterasu',
    'Amaterasu is a sun kami; the cave episode explains the withdrawal and return of her light.'],
  susanoo: ['https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9152', 'Kokugakuin University: Encyclopedia of Shinto, Susanoo',
    'Susanoo defeats the serpent Yamata no Orochi in accounts preserved in Japanese chronicles.'],
  inari: ['https://inari.jp/en/saijin/', 'Fushimi Inari Taisha: Enshrined Deity',
    'Fushimi Inari Taisha connects Inari’s name and divine protection with rice and abundance.'],
  shango: ['https://www.britishmuseum.org/collection/object/E_Af1952-07-134', 'British Museum: Shango ceremonial baton',
    'Shango is a Yoruba thunder deity associated with the ose ceremonial baton.'],
  ogun: ['https://www.metmuseum.org/ko/essays/the-age-of-iron-in-west-africa', 'The Metropolitan Museum of Art: The Age of Iron in West Africa',
    'Ogun is a Yoruba deity associated with iron, roads and warriors.'],
  oshun: ['https://whc.unesco.org/en/list/1118', 'UNESCO World Heritage Centre: Osun-Osogbo Sacred Grove',
    'Osun, also spelled Oshun, is the river and fertility divinity associated with the Osun-Osogbo grove.'],
  brigid: ['https://celt.ucc.ie/published/T300010.html', 'University College Cork, CELT: Cath Maige Tuired',
    'Brigid appears as Bríg, daughter of the Dagda, in the Irish tale Cath Maige Tuired.'],
  lugh: ['https://celt.ucc.ie/published/T300010.html', 'University College Cork, CELT: Cath Maige Tuired',
    'Lugh, spelled Lug in this translation, leads the Tuatha Dé in Cath Maige Tuired.'],
  dagda: ['https://celt.ucc.ie/published/T300010.html', 'University College Cork, CELT: Cath Maige Tuired',
    'The Dagda is a powerful member of the Tuatha Dé in Cath Maige Tuired.'],
  inanna: ['https://oracc.museum.upenn.edu/amgg/listofdeities/inanaitar/', 'ORACC: Ancient Mesopotamian Gods and Goddesses, Inana/Ishtar',
    'Inanna, also written Inana, is associated with love, warfare and the planet Venus.'],
  enki: ['https://oracc.museum.upenn.edu/amgg/listofdeities/enki/', 'ORACC: Ancient Mesopotamian Gods and Goddesses, Enki/Ea',
    'Enki, known as Ea in Akkadian, is associated with wisdom, incantations and subterranean waters.'],
  marduk: ['https://oracc.museum.upenn.edu/amgg/Listofdeities/Marduk/index.html', 'ORACC: Ancient Mesopotamian Gods and Goddesses, Marduk',
    'Marduk is the patron deity of Babylon and became a leading Mesopotamian god.'],
  quetzalcoatl: ['https://www.britishmuseum.org/collection/term/BIOG230422', 'British Museum: Quetzalcoatl',
    'Quetzalcoatl is the Nahuatl name of the Feathered Serpent deity.'],
  tlaloc: ['https://www.loc.gov/item/2021667846/', 'Library of Congress: Sahagún, Florentine Codex, Book I, The Gods',
    'Book I of the Florentine Codex describes Tlaloc as the god who gives and withholds rain.'],
  huitzilopochtli: ['https://www.loc.gov/item/2021667848/', 'Library of Congress: Sahagún, Florentine Codex, Book III, The Origin of the Gods',
    'Book III of the Florentine Codex tells of Huitzilopochtli’s birth at Coatepec.'],
  kukulkan: ['https://mna.inah.gob.mx/images/agenda/archivo/GLOSARIO-DIOSES-MAYAS-LSM.pdf', 'Mexico, INAH National Museum of Anthropology: Mayan Gods glossary',
    'Kukulkan is identified as a feathered serpent and deity of knowledge in the INAH glossary.'],
  itzamna: ['https://www.metmuseum.org/it/exhibitions/gods-divinity-maya-art/visiting-guide', 'The Metropolitan Museum of Art: Lives of the Gods, Itzamnaaj',
    'Itzamnaaj is a deity named in colonial Yucatán; reading the associated ancient name glyph remains uncertain.'],
  inti: ['https://archive.org/details/royalcommentarie00vega', 'Garcilaso de la Vega, Royal Commentaries of Peru (1609), translated by Paul Rycaut',
    'Garcilaso describes the Sun as the chief god of the Incas and its gold-plated temple in Cuzco.'],
  viracocha: ['https://www.gutenberg.org/ebooks/20218', 'Pedro Sarmiento de Gamboa, History of the Incas (1572), translated by Clements Markham',
    'Sarmiento records Andean accounts of Viracocha making the peoples of the world at Tiahuanaco.'],
  maui: ['https://www.tepapa.govt.nz/digital-museum/explore-digital-museum/crustaceans-aotearoa-new-zealand-and-south-pacific/panenehu', 'Museum of New Zealand Te Papa Tongarewa: Panenehu Shows Koura to Tangaroa',
    'Te Papa records Māori stories of Māui pulling up the great fish and confronting Tuna.'],
  tangaroa: ['https://collections.tepapa.govt.nz/object/235625', 'Museum of New Zealand Te Papa Tongarewa: Tangaroa',
    'On some Cook Islands, Tangaroa was revered as a principal deity of the sea and creation.'],
  guanyin: ['https://asia.si.edu/education/educator-resources/teaching-china-with-the-smithsonian/explore-by-object/standing-figure-of-guanyin-as-buddha/', 'Smithsonian National Museum of Asian Art: Standing Figure of Guanyin',
    'Guanyin is the bodhisattva of compassion in Chinese Buddhism.'],
  nezha: ['https://www.britishmuseum.org/collection/object/A_2018-3005-42?selectedImageId=1613582316', 'British Museum: Nezha',
    'Nezha is a protective figure in Chinese religion, depicted as a youth with supernatural attributes.'],
  perun: ['https://pages.uoregon.edu/kimball/chronicle.htm', 'University of Oregon: excerpts from the Russian Primary Chronicle',
    'The Primary Chronicle names Perun among the gods invoked in the oaths of Oleg’s men.'],
};

function identityLore(sourceKey, leader) {
  const summary = IDENTITY_SOURCES[sourceKey][2];
  if (summary) return summary;
  if (sourceKey === 'greek') return `${leader} is attested in Hesiod’s Theogony or the Homeric Hymns.`;
  if (sourceKey === 'egypt') return `${leader} is included in the Rosicrucian Egyptian Museum’s guide to ancient Egyptian deities.`;
  return `${leader} appears in Snorri Sturluson’s Prose Edda; spellings vary across translations.`;
}

// The champion takes the singular verb; unit groups take the plural.
export const factionBonusDescription = (city, units, champion = 'The champion') => [
  ...Object.entries(city).map(([key, value]) => `+${value} ${key} per city`),
  ...Object.entries(units).flatMap(([kind, stats]) => Object.entries(stats).map(([key, value]) => {
    const stat = key === 'moves' ? 'movement' : key === 'charges' ? `build charge${value === 1 ? '' : 's'}` : key;
    return kind === 'hero' ? `${champion} gains +${value} ${stat}` : `${UNIT_LABELS[kind]} gain +${value} ${stat}`;
  })),
].join('; ') + '.';

// Roster buttons show the champion; a shared patron is added so the four realms of God differ.
export const factionLabel = faction => faction.patron && faction.patron !== faction.leader
  ? `${faction.leader} · ${faction.patron}`
  : faction.leader;

// realm() takes one entry per faction. Named fields are [name, citation] pairs:
//   realm      [name, citation]            capital [name, citation]
//   cities     [[names in founding order], citation]
//   power      [name, what the object or deed is, citation]
//   emblem     [name, what the crest shows, citation]
function realm(entry) {
  const {id, leader, patron = leader, tradition, visualStyle, color, cityYields, unitBonuses, sourceKey = id, description} = entry;
  const [sourceUrl, sourceLabel] = IDENTITY_SOURCES[sourceKey];
  const [name, nameSource] = entry.realm;
  const [capital, capitalSource] = entry.capital;
  const [cityNames, citySource] = entry.cities;
  const [powerName, powerLore, powerSource] = entry.power;
  const [emblemName, emblemNote, emblemSource] = entry.emblem;
  const faction = {
    id, name, leader, patron, tradition, capital, visualStyle, color, description,
    bonus: factionBonusDescription(cityYields, unitBonuses, leader),
    trait: factionTrait(id),
    gameplay: {cityYields, unitBonuses, heroPower: STYLE_POWERS[visualStyle]},
    powerName, powerLore,
    emblem: {name: emblemName, source: emblemSource},
    sourceKey, sourceUrl, sourceLabel,
    lore: identityLore(sourceKey, leader),
    imagery: emblemNote,
    cityNames: [...cityNames],
    sources: {
      leader: sourceLabel,
      name: nameSource,
      capital: capitalSource,
      cityNames: citySource,
      powerName: powerSource,
      emblem: emblemSource,
    },
  };
  faction.label = factionLabel(faction);
  return faction;
}

export const FACTIONS = [
  // Native builds identify realms by their position in this list; never reorder it.
  realm({
    id: 'michael', leader: 'Michael', patron: 'God', tradition: 'Christian', visualStyle: 'michael', color: '#94D2FF',
    cityYields: {gold: 2, production: 1}, unitBonuses: {},
    realm: ['Heavenly Host', 'Luke 2:13; Revelation 12:7 (KJV)'],
    capital: ['New Jerusalem', 'Revelation 21:2 (KJV)'],
    cities: [['Ephesus', 'Smyrna', 'Pergamos', 'Thyatira', 'Sardis', 'Philadelphia', 'Laodicea'],
      'Revelation 1:11 (KJV): the seven churches, in the order named'],
    power: ['War in Heaven', 'Michael and his angels fight the dragon and cast it out of heaven.', 'Revelation 12:7–9'],
    emblem: ['Sword and scales', 'Sword and scales, the attributes later Christian art gives Michael; Revelation itself names only the battle.',
      'Revelation 12:7; later Christian art of the archangel'],
    description: 'The seven churches of Revelation under the archangel who fought the dragon.',
  }),
  realm({
    id: 'ra', leader: 'Ra', tradition: 'Egyptian', visualStyle: 'ra', color: '#F7BE89', sourceKey: 'egypt',
    cityYields: {food: 1}, unitBonuses: {rider: {moves: 1, strength: 6}},
    realm: ['Kemet', 'Egyptian km.t, “the Black Land” (Erman and Grapow, Wörterbuch V 126)'],
    capital: ['Heliopolis', 'Genesis 41:45 (On); Herodotus 2.3'],
    cities: [['Memphis', 'Thebes', 'Hermonthis', 'Bubastis', 'Leontopolis', 'Sakhebu'],
      'Herodotus 2.3, 2.59–60, 2.99; Strabo 17.1.19, 17.1.47; Papyrus Westcar 9.9–11 (Sakhebu)'],
    power: ['Day-Barque of Ra', 'Ra crosses the sky each day in his barque and drives back the serpent Apophis.', 'Book of the Dead, chapters 15 and 100'],
    emblem: ['Sun disk on the barque', 'The sun disk riding the day-barque, as on Egyptian solar vignettes.',
      'Book of the Dead, chapter 15; British Museum ostracon EA 29509'],
    description: 'The Black Land of Egypt, ruled from the sun city of Heliopolis.',
  }),
  realm({
    id: 'athena', leader: 'Athena', tradition: 'Greek', visualStyle: 'athena', color: '#92DEB5', sourceKey: 'greek',
    cityYields: {science: 2}, unitBonuses: {archer: {strength: 5}},
    realm: ['Attica', 'Apollodorus, Library 3.14.1; Herodotus 8.55'],
    capital: ['Athens', 'Apollodorus, Library 3.14.1 (Athena wins the city)'],
    cities: [['Lindos', 'Tegea', 'Alalcomenae', 'Ilion', 'Pellene', 'Coronea'],
      'Herodotus 2.182; Pausanias 8.45.4, 9.33.5, 7.27.2, 9.34.1; Iliad 6.297'],
    power: ['Guise of Mentor', 'Athena takes the likeness of Mentor to counsel Telemachus and stand beside Odysseus.', 'Odyssey 2.267–268; 22.205–206'],
    emblem: ['Owl and olive', 'The owl and olive sprig of Athenian silver coinage.', 'Athenian tetradrachm, about 430 BCE (University of Colorado)'],
    description: 'Attica and the Greek cities that kept temples of Athena.',
  }),
  realm({
    id: 'thor', leader: 'Thor', tradition: 'Norse', visualStyle: 'thor', color: '#C25E53', sourceKey: 'norse',
    cityYields: {production: 2}, unitBonuses: {warrior: {strength: 4}},
    realm: ['Þrúðvangar', 'Gylfaginning 21; Grímnismál 4 (Þrúðheimr)'],
    capital: ['Bilskírnir', 'Gylfaginning 21; Grímnismál 24'],
    cities: [['Mæren', 'Hlaðir', 'Þórsnes', 'Himinbjörg', 'Glitnir', 'Landviði'],
      'Heimskringla, Hákonar saga góða 14–18 (Mæren, Hlaðir); Eyrbyggja saga 4 (Þórsnes); Grímnismál 13, 15, 17'],
    power: ['Mjölnir', 'Dwarven smiths forge the hammer that never misses and returns to Thor’s hand.', 'Skáldskaparmál 35; Gylfaginning 21'],
    emblem: ['Mjölnir', 'A hammer pendant of the kind worn in the Viking Age.', 'British Museum, Room 41 guide: Thor’s hammer pendant'],
    description: 'Thor’s Fields of Strength and the northern places of his worship.',
  }),
  realm({
    id: 'moses', leader: 'Moses', patron: 'God', tradition: 'Hebrew Bible', visualStyle: 'ancient-of-days', color: '#B0C9FF',
    cityYields: {food: 1, culture: 1}, unitBonuses: {settler: {moves: 1}},
    realm: ['Twelve Tribes', 'Exodus 24:4'],
    capital: ['Kadesh', 'Deuteronomy 1:46'],
    cities: [['Gilgal', 'Shiloh', 'Shechem', 'Hebron', 'Bethel', 'Kirjath-jearim'],
      'Joshua 4:19, 18:1, 24:1, 14:13, 18:22, 18:14 (KJV)'],
    power: ['Pillar of Cloud', 'God goes before Israel by day in a pillar of cloud and by night in a pillar of fire.', 'Exodus 13:21–22'],
    emblem: ['Tablets of the covenant', 'The two tablets of stone written on both sides.', 'Exodus 32:15–16; 34:1'],
    description: 'The tribes of Israel, from the wilderness camp at Kadesh into Canaan.',
  }),
];

function powerDescription(faction) {
  const name = faction.leader;
  switch (faction.gameplay.heroPower) {
    case 'aegis': return `${name} heals friendly units within 2 hexes by 24 and gives military units +6 strength for 2 turns.`;
    case 'charge': return `${name} gives friendly units within 2 hexes +2 movement this turn and military units +4 strength for 2 turns.`;
    case 'counsel': return `${name} heals friendly units within 2 hexes by 30 and reveals the land within 5 hexes for 2 turns.`;
    case 'strike': return `${name} deals 25 damage to enemy units and 20 to enemy cities within 2 hexes. It cannot capture a city.`;
    case 'judgement': return `${name} freezes all enemy units within 3 hexes for 2 turns and deals 15 damage to the strongest unit.`;
  }
}
export const HERO_POWERS = FACTIONS.map(f => ({
  factionId: f.id,
  name: f.powerName,
  cooldown: 4,
  description: powerDescription(f),
  lore: f.powerLore,
  source: f.sources.powerName,
}));

// Opponent selection uses a private RNG so the map RNG stays unchanged.
// Fisher–Yates supplies three distinct, seed-dependent opponents for every realm.
export function campaignRoster(factionId, seed) {
  const player = FACTIONS.find(f => f.id === factionId);
  if (!player) return campaignRoster('michael', seed);
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
