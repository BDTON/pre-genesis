// Traditional attributes inform original miniature designs; these are not portraits
// or canonical depictions. Lore sources live with each faction in factions.js.
//
// Odin carries a spear and wears the broad hat of his name Síðhöttr (Grímnismál 48);
// he pledged an eye at Mímir's well (Gylfaginning 15), so he wears no patch.
// Gabriel's lily comes from later Annunciation art, not from Luke 1.
const profiles = {
  michael: ['sword', 'halo', 'ivory'], ra: ['sun', 'falcon', 'ochre'], athena: ['spear', 'helmet', 'lapis'], thor: ['hammer', 'beard', 'copper'],
  zeus: ['bolt', 'beard', 'ivory'], vishnu: ['lotus', 'fourarms', 'lapis'], poseidon: ['trident', 'beard', 'teal'], demeter: ['grain', 'wreath', 'ochre'],
  inanna: ['star', 'horns', 'copper'], artemis: ['bow', 'crescent', 'silver'], shiva: ['trident', 'fourarms', 'silver'], oshun: ['fan', 'crown', 'ochre'],
  ogun: ['blade', 'helmet', 'green'], hermes: ['staff', 'wings', 'teal'], brahma: ['book', 'fourfaces', 'copper'], dagda: ['cauldron', 'beard', 'green'],
  susanoo: ['blade', 'knot', 'lapis'], inari: ['grain', 'knot', 'ivory'], enki: ['water', 'horns', 'teal'], lugh: ['spear', 'wreath', 'ochre'],
  saraswati: ['lute', 'lotus', 'ivory'], amaterasu: ['mirror', 'sun', 'copper'], quetzalcoatl: ['serpent', 'feathers', 'teal'],
  osiris: ['crook', 'atef', 'green'], isis: ['ankh', 'wings', 'lapis'], horus: ['spear', 'falcon', 'copper'], lakshmi: ['lotus', 'fourarms', 'rose'],
  marduk: ['staff', 'horns', 'ochre'], thoth: ['book', 'ibis', 'ivory'], durga: ['trident', 'fourarms', 'copper'], viracocha: ['staff', 'sun', 'ivory'],
  nezha: ['spear', 'wheels', 'rose'], shango: ['axe', 'crown', 'copper'], tlaloc: ['water', 'goggles', 'teal'],
  odin: ['spear', 'broadhat', 'lapis'], freyja: ['necklace', 'feathers', 'rose'], freyr: ['blade', 'wreath', 'green'], maui: ['hook', 'knot', 'copper'],
  kukulkan: ['serpent', 'feathers', 'green'], guanyin: ['vase', 'veil', 'ivory'], brigid: ['flame', 'wreath', 'copper'], tangaroa: ['wave', 'shell', 'teal'],
  skadi: ['bow', 'hood', 'silver'], gabriel: ['lily', 'wings', 'ivory'], moses: ['tablets', 'beard', 'ochre'], huitzilopochtli: ['serpent', 'feathers', 'lapis'],
  itzamna: ['book', 'feathers', 'ivory'], inti: ['sun', 'sun', 'ochre'], perun: ['axe', 'beard', 'green'], esther: ['scroll', 'crown', 'rose'],
};
const palette = {
  ivory: '#d6d2b5', ochre: '#c3a158', lapis: '#476c9c', copper: '#ac654c',
  teal: '#4d9590', silver: '#a9bec9', green: '#6f8b58', rose: '#af6f85',
};

export function artProfile(id) {
  const [attribute, head, pigment] = profiles[id] || ['staff', 'crown', 'ivory'];
  return {attribute, head, pigment, color: palette[pigment]};
}

// Capital architecture follows each realm's tradition, with a few realms whose own
// texts name a specific sanctuary:
// - Moses: the tabernacle and its linen court (Exodus 26–27).
// - Esther: the Persian palace court with marble pillars and white, green and blue hangings (Esther 1:5–6).
// - Perun: the wooden hill sanctuary at Peryn near Novgorod.
// - Guanyin and Nezha: the Chinese pagoda, a Buddhist stupa form.
// - Inti and Viracocha: Andean terraces and a walled sun temple (the Coricancha at Cusco).
// Shinto shrines follow shinmei-zukuri, as at Ise (Kokugakuin Encyclopedia of Shinto).
export const CAPITAL_STYLES = Object.freeze([
  'basilica', 'tabernacle', 'apadana', 'pylon', 'colonnade', 'longhouse', 'peryn', 'shrine',
  'ziggurat', 'mandir', 'pagoda', 'pyramid', 'terrace', 'grove', 'ringfort', 'marae',
]);

const STYLE_BY_ID = {
  moses: 'tabernacle', esther: 'apadana', perun: 'peryn', guanyin: 'pagoda', nezha: 'pagoda',
  inti: 'terrace', viracocha: 'terrace',
};
const STYLE_BY_TRADITION = [
  [/christ/i, 'basilica'],
  [/hebrew|biblical|israel/i, 'tabernacle'],
  [/egypt/i, 'pylon'],
  [/greek|roman/i, 'colonnade'],
  [/norse|germanic/i, 'longhouse'],
  [/slavic/i, 'peryn'],
  [/shinto|japan/i, 'shrine'],
  [/mesopotam|sumer|babylon|akkad/i, 'ziggurat'],
  [/hindu/i, 'mandir'],
  [/buddh|chinese|tao/i, 'pagoda'],
  [/andean|inca/i, 'terrace'],
  [/mexica|aztec|nahua|maya/i, 'pyramid'],
  [/yoruba/i, 'grove'],
  [/irish|celtic|gael/i, 'ringfort'],
  [/polynesian|maori|māori/i, 'marae'],
];
// The four shared art styles of factions.js, used only when a tradition is unknown.
const STYLE_BY_VISUAL = {michael: 'basilica', ra: 'pylon', athena: 'colonnade', thor: 'longhouse'};
// Residential miniatures around a capital.
const HOUSES = {
  basilica: 'gable', tabernacle: 'tent', apadana: 'flat', pylon: 'flat', colonnade: 'gable', longhouse: 'gable',
  peryn: 'gable', shrine: 'gable', ziggurat: 'flat', mandir: 'flat', pagoda: 'gable', pyramid: 'flat',
  terrace: 'flat', grove: 'round', ringfort: 'round', marae: 'gable',
};
// Wall colour of those houses: limestone, linen, sandstone, marble, timber, mud brick or fieldstone.
const HOUSE_WALLS = {
  basilica: '#d7d2ba', tabernacle: '#e3dccb', apadana: '#d8cdb4', pylon: '#d3b480', colonnade: '#e0dbc6',
  longhouse: '#9a846a', peryn: '#94795a', shrine: '#c4a57c', ziggurat: '#bf9a6e', mandir: '#d2b08a',
  pagoda: '#d9d0ba', pyramid: '#d3c7a8', terrace: '#aea58f', grove: '#b98d63', ringfort: '#b7a98c', marae: '#8e6e52',
};
// Mexica capitals pair two summit shrines, as on the Templo Mayor; Maya temples carry a roof comb.
const VARIANTS = {pyramid: faction => /maya/i.test(faction?.tradition || '') ? 'comb' : 'twin'};

export function architectureFor(faction) {
  const id = typeof faction === 'string' ? faction : faction?.id;
  const tradition = typeof faction === 'object' ? String(faction?.tradition || '') : '';
  const style = STYLE_BY_ID[id]
    || STYLE_BY_TRADITION.find(([pattern]) => pattern.test(tradition))?.[1]
    || STYLE_BY_VISUAL[faction?.visualStyle]
    || STYLE_BY_VISUAL[id]
    || 'basilica';
  return {style, variant: VARIANTS[style]?.(faction) || null, houses: HOUSES[style], walls: HOUSE_WALLS[style]};
}

export const EMBLEM_PATHS = {
  sword: 'M32 8 26 18v27h12V18ZM21 44h22M28 49v8h8v-8',
  bolt: 'M37 6 17 35h14l-4 23 21-31H34Z',
  trident: 'M32 7v49M19 12v15q0 8 13 8t13-8V12M15 18l4-7 4 7M41 18l4-7 4 7M28 13l4-7 4 7',
  lotus: 'M32 51C10 47 8 30 11 24q14 1 21 14Q38 25 53 24C56 40 46 50 32 51ZM32 40C20 27 25 14 32 9c8 8 13 18 0 31Z',
  sun: 'M32 17a15 15 0 1 0 0 30 15 15 0 1 0 0-30M32 5v7m0 40v7M5 32h7m40 0h7M13 13l6 6m26 26 6 6M13 51l6-6m26-26 6-6',
  spear: 'M32 56V25M32 7l7 15-7 7-7-7Z',
  hammer: 'M29 27v30h6V27M17 11h30v17H17Z',
  grain: 'M32 57V12M32 25q-15-2-13-14 12 1 13 14ZM32 37q15-2 13-14-12 1-13 14ZM32 47q-15-2-13-14 12 1 13 14Z',
  bow: 'M22 9q34 23 0 46l13-23ZM10 32h42m-7-6 7 6-7 6',
  star: 'M32 7 38 23 55 15 42 29 58 35 41 39 48 55 34 44 25 58 24 41 7 47 19 33 6 24 23 25Z',
  fan: 'M32 54V36M32 40 9 24Q32-3 55 24ZM32 36V12M32 36 19 19m13 17 13-17',
  blade: 'M18 54 42 12l7-4-1 9L24 58ZM17 42l17 9',
  staff: 'M32 58V24q-14-1-10-13 7-9 15-2 7 8-3 13M20 34h24',
  book: 'M32 18q-11-8-23-3v35q12-5 23 3 11-8 23-3V15q-12-5-23 3ZM32 18v35',
  cauldron: 'M13 26h38v13q-3 14-19 14T13 39ZM18 52l-3 6m31-6 3 6M22 12q-8 7 0 11m10-15q-8 7 0 12m10-8q-8 7 0 11',
  water: 'M8 24q8-10 16 0t16 0 16 0M8 37q8-10 16 0t16 0 16 0M8 50q8-10 16 0t16 0 16 0',
  lute: 'M41 7 27 30q-22-2-17 18 8 17 21 3 8-9 2-17L48 10ZM22 39l19-27',
  mirror: 'M32 9a17 17 0 1 0 0 34 17 17 0 1 0 0-34M29 43v14h6V43M24 20l9-6m-8 14 14-10',
  serpent: 'M15 51q35 9 30-14-2-11-20-7T19 12q10-9 26 3M43 10l10 7-12 5M15 51l-7-7m11 4-4-7',
  crook: 'M29 58V21q-14 1-13-10 3-10 13-5 7 3 7 12v40',
  ankh: 'M32 27C13 19 26 1 32 9c8-8 19 10 0 18ZM32 27v31M18 35h28',
  axe: 'M32 8v50M29 19Q16 10 10 18v20q12 8 19-2M35 19q13-9 19-1v20q-12 8-19-2',
  necklace: 'M10 13q-1 31 22 33 23-2 22-33M32 44l7 9-7 7-7-7Z',
  hook: 'M37 7v32q0 23-18 15-11-8 0-17l-2 11q14 8 14-11V7Z',
  vase: 'M23 8h18v6l-5 10q19 21 7 30H21q-12-9 7-30l-5-10ZM22 39h20',
  flame: 'M32 6q14 14 9 24l9-7q16 30-18 34Q3 56 13 33l7-9q-1 16 7 17Q18 24 32 6Z',
  wave: 'M9 51q6-15 19-18-8-22 8-24 18-1 19 16-9-8-15-1 17 8 17 27Z',
  lily: 'M32 58V26M32 26q-9-4-10-16 7 3 10 9 3-6 10-9-1 12-10 16ZM32 40q-8-6-15-3 5 7 15 6M32 46q8-6 15-3-5 7-15 6',
  trumpet: 'M10 40l27-16 13-15 7 13-20 5-24 18ZM21 35l6 13 9-5-6-13',
  tablets: 'M9 53V22q0-18 21-10v41ZM34 53V12q21-8 21 10v31ZM15 26h10m-10 9h10m-10 9h10m14-18h10m-10 9h10m-10 9h10',
  scroll: 'M17 15q-9-11-11 0t11 0h32v34q9 11 11 0T49 49H17ZM24 24h17m-17 9h17m-17 9h11',
};
