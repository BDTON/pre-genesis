import {artProfile} from './art-direction.js';

// Original tabletop interpretations. Silhouettes and attributes are deliberately
// legible at map scale; these share a sculptural vocabulary, not borrowed models.
// Colour keys: '#rrggbb' is matte paint, 'bannerGold' is gilded metal, 'window'
// is lamplight and 'water' is a wet surface (see WorldView.surfaceFor).
const GOLD = 'bannerGold';

export function mythicChampion(b, id, y) {
  const p = artProfile(id), gold = GOLD, ivory = '#e4dcc4', dark = '#444c51';
  const add = (g, c, x, dy, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => b.add(g, c, x, y + dy, z, sx, sy, sz, rx, ry, rz);
  // Shallow armor relief stays inside the miniature's silhouette.
  add('box', '#c9ad69', 0, .102, -.083, .145, .147, .016);
  add('box', p.color, 0, .11, -.094, .112, .108, .012);
  add('box', ivory, 0, .115, -.103, .025, .077, .008);
  add('cylinder', gold, 0, .181, 0, .068, .025, .065);
  add('cylinder', dark, 0, -.022, 0, .117, .046, .101);
  add('box', gold, 0, -.02, -.103, .051, .04, .017);
  for (const side of [-1, 1]) {
    add('cone4', '#c9ad69', side * .109, .14, 0, .071, .061, .067, 0, Math.PI / 4);
    add('box', p.color, side * .104, .101, -.059, .052, .051, .014);
    add('cylinder', ivory, side * .143, .055, -.016, .024, .105, .025, 0, 0, side * .22);
    add('cylinder', '#c9ad69', side * .153, .012, -.016, .029, .04, .03, 0, 0, side * .22);
  }
  const shaft = (color = '#c9ad69') => {
    add('cylinder', color, .19, .15, 0, .017, .65, .017);
    add('cylinder', dark, .19, .057, 0, .023, .15, .023);
  };

  const head = p.head;
  if (['fourarms', 'fourfaces'].includes(head)) {
    for (const side of [-1, 1]) for (const tier of [0, 1]) {
      add('cylinder', p.color, side * .14, .12 - tier * .12, 0, .027, .25, .027, 0, 0, side * (1.1 + tier * .38));
      add('sphere', ivory, side * .255, .18 - tier * .17, 0, .035, .04, .035);
    }
    if (head === 'fourfaces') for (const side of [-1, 1]) add('sphere', '#bb9372', side * .067, .25, .025, .065, .075, .065);
  }
  if (['beard', 'broadhat'].includes(head)) {
    add('sphere', dark, 0, .30, .027, .09, .07, .085);
    add('cone', '#aea69a', 0, .18, -.067, .07, .16, .045, 0, 0, Math.PI);
  }
  if (head === 'broadhat') {
    // Síðhöttr: a wide-brimmed traveller's hat.
    add('disc', '#3f4a5c', 0, .35, .01, .15, .012, .15);
    add('cone', '#3f4a5c', 0, .40, .01, .075, .11, .075);
  }
  if (['crown', 'fourarms', 'fourfaces', 'lotus'].includes(head)) {
    add('cylinder', gold, 0, .33, 0, .084, .09, .084);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      add('cone', gold, Math.cos(a) * .07, .41, Math.sin(a) * .07, .025, .14, .025);
    }
  }
  if (['halo', 'sun', 'crescent'].includes(head)) {
    add('torus', gold, 0, .34, .09, .15, .15, .02);
    if (head === 'sun') for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      add('cone', gold, Math.sin(a) * .18, .34 + Math.cos(a) * .18, .09, .02, .095, .02, 0, 0, -a);
    }
  }
  if (['falcon', 'ibis'].includes(head)) {
    add('sphere', dark, 0, .26, 0, .082, .11, .08);
    add('cone', '#c9ad69', 0, .24, -.11, .032, head === 'ibis' ? .23 : .13, .025, -Math.PI / 2);
  }
  if (['feathers', 'wings', 'atef', 'horns'].includes(head)) for (const side of [-1, 1]) {
    const count = head === 'feathers' ? 5 : head === 'wings' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      add('leaf', i % 2 ? '#c9ad69' : p.color, side * (.065 + i * .031), .35 - i * .016, .02, .035, .21 + i * .012, .035, 0, 0, -side * (.25 + i * .21));
    }
  }
  if (head === 'helmet') {
    add('sphere', '#c9ad69', 0, .30, 0, .09, .08, .085);
    add('box', p.color, 0, .40, 0, .035, .12, .16);
  }
  if (head === 'veil' || head === 'hood') {
    add('sphere', head === 'veil' ? ivory : p.color, 0, .28, .025, .104, .13, .093);
    add('sphere', '#c7a984', 0, .25, -.048, .068, .082, .038);
    add('cone', p.color, 0, .10, .08, .19, .34, .095);
  }
  if (head === 'knot') {
    add('sphere', dark, 0, .30, .024, .088, .07, .086);
    add('sphere', dark, 0, .39, 0, .048, .05, .048);
  }
  if (head === 'goggles') for (const side of [-1, 1]) add('torus', gold, side * .037, .26, -.075, .039, .039, .012);
  if (head === 'shell') for (let i = 0; i < 5; i++) add('leaf', ivory, (i - 2) * .036, .34, .01, .035, .14, .025, 0, 0, (i - 2) * .22);
  if (head === 'wreath') for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    add('leaf', '#839b57', Math.sin(a) * .085, .31, Math.cos(a) * .08, .032, .045, .028, 0, 0, a);
  }
  if (head === 'wheels') for (const side of [-1, 1]) b.add('torus', gold, side * .13, .10, 0, .085, .085, .025, 0, Math.PI / 2);

  const attribute = p.attribute;
  if (['spear', 'staff', 'trident', 'axe', 'hammer', 'crook', 'ankh', 'water', 'wave', 'sun', 'star'].includes(attribute)) shaft();
  if (attribute === 'spear') add('cone', ivory, .19, .54, 0, .039, .18, .035);
  else if (attribute === 'staff') {
    add('torus', gold, .19, .49, 0, .085, .105, .024);
    add('cone', p.color, .19, .50, 0, .046, .13, .035);
  } else if (attribute === 'trident') {
    add('box', gold, .19, .43, 0, .22, .025, .027);
    for (const x of [.1, .19, .28]) add('cone', gold, x, .52, 0, .025, .20, .025);
  } else if (attribute === 'axe') {
    for (const side of [-1, 1]) add('leaf', ivory, .19 + side * .068, .43, 0, .09, .11, .025, 0, 0, side * .4);
  } else if (attribute === 'hammer') {
    add('box', ivory, .19, .46, 0, .21, .13, .10);
    add('box', gold, .19, .46, -.058, .047, .14, .014);
    for (const side of [-1, 1]) add('box', dark, .19 + side * .105, .46, 0, .021, .14, .11);
  } else if (['blade', 'sword'].includes(attribute)) {
    add('box', ivory, .19, .29, -.03, .039, .58, .017);
    add('box', gold, .19, .02, -.03, .14, .025, .029);
    add('cylinder', dark, .19, -.044, -.03, .021, .11, .021);
    add('cone4', gold, .19, -.111, -.03, .034, .04, .027, 0, Math.PI / 4);
  } else if (attribute === 'bolt') {
    for (let i = 0; i < 3; i++) add('box', gold, .18 + (i % 2) * .04, .39 - i * .13, -.03, .04, .20, .027, 0, 0, i % 2 ? -.6 : .6);
  } else if (['bow', 'hook', 'crook'].includes(attribute)) {
    add('torus', gold, .20, .17, 0, .11, .23, .035);
    add('box', ivory, .20, .17, 0, .009, .43, .01);
  } else if (['book', 'tablets', 'scroll'].includes(attribute)) {
    for (const side of [-1, 1]) {
      add('box', attribute === 'tablets' ? '#aaa38d' : ivory, side * .10, .06, -.13, .17, .23, .027, 0, side * .15);
      for (let i = 0; i < 3; i++) add('box', '#8c7b55', side * .10, .12 - i * .055, -.15, .10, .012, .008);
    }
  } else if (attribute === 'lily') {
    shaft('#6f8b58');
    for (let i = 0; i < 3; i++) add('leaf', '#f1ede0', .19 + (i - 1) * .03, .52, 0, .03, .08, .025, 0, 0, (i - 1) * .5);
  } else if (['lotus', 'grain', 'fan', 'flame'].includes(attribute)) {
    const color = attribute === 'flame' ? '#c87943' : attribute === 'grain' ? '#c9ad69' : ivory;
    for (let i = 0; i < 5; i++) add('leaf', color, .19 + (i - 2) * .035, .16 + Math.abs(i - 2) * .014, -.04, .038, .14, .03, 0, 0, -(i - 2) * .35);
  } else if (['vase', 'cauldron'].includes(attribute)) {
    add('sphere', p.color, .18, .08, -.10, .11, .12, .09);
    add('torus', gold, .18, .18, -.10, .07, .07, .019, Math.PI / 2);
  } else if (attribute === 'lute') {
    add('sphere', '#b58a52', .08, .04, -.14, .11, .13, .04);
    add('box', ivory, .13, .21, -.14, .037, .34, .023, 0, 0, -.3);
  } else if (attribute === 'serpent') {
    for (let i = 0; i < 6; i++) add('sphere', p.color, .18 + Math.sin(i * 1.2) * .045, .01 + i * .08, -.08, .046, .058, .04);
    add('cone', gold, .18, .49, -.14, .05, .12, .05, -Math.PI / 2);
  } else if (['mirror', 'sun', 'star', 'ankh', 'necklace'].includes(attribute)) {
    add('torus', gold, .19, .43, 0, .09, .09, .022);
    add('disc', ivory, .19, .43, .015, .065, .018, .065, Math.PI / 2);
  } else if (['water', 'wave'].includes(attribute)) {
    for (let i = 0; i < 3; i++) add('torus', '#91bbc5', .19, .43 - i * .09, 0, .08 + i * .02, .055, .022);
  }
  if (id === 'gabriel') for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    add('leaf', ivory, side * (.18 + i * .04), .20 - i * .025, .12, .055, .28, .035, 0, 0, -side * (.3 + i * .18));
  }
  if (['vishnu', 'shiva'].includes(id)) add('sphere', id === 'vishnu' ? '#779bb1' : '#b1bfc2', 0, .25, -.017, .077, .09, .068);
}

// Capitals. Each builder draws in the capital's local frame: the paved ground
// is about y .06, the facade faces +z, and the footprint stays inside |x|,|z| < .65
// so the population houses around the rim remain readable.
const steady = () => .5;

function plinth(b, color, width, depth, y = .1, height = .1, z = 0) {
  b.add('box', color, 0, y, z, width, height, depth);
}

// A flight of solid steps climbing from (x0, z0) at height y0 to (x1, z1) at y1.
function steps(b, color, [x0, z0, y0], [x1, z1, y1], width, count) {
  const dx = (x1 - x0) / count, dz = (z1 - z0) / count, rise = (y1 - y0) / count;
  const run = Math.hypot(dx, dz), angle = Math.atan2(dx, dz);
  for (let i = 0; i < count; i++) {
    const top = y0 + rise * (i + 1);
    b.add('box', color, x0 + dx * (i + .5), (y0 + top) / 2, z0 + dz * (i + .5), width, top - y0, run * 1.04, 0, angle);
  }
}

// Shinmei-zukuri hall: raised floor on posts, thatched gable roof, chigi and katsuogi.
function shrineHall(b, view, x, z, s) {
  const cypress = '#c9a97c', thatch = '#6b6453', post = '#a88a62';
  for (const dx of [-.24, 0, .24]) for (const dz of [-.14, .14]) {
    b.add('cylinder', post, x + dx * s, .06 + .1 * s, z + dz * s, .018 * s, .2 * s, .018 * s);
  }
  b.add('box', cypress, x, .06 + .21 * s, z, .60 * s, .035 * s, .36 * s);
  b.add('box', cypress, x, .06 + .33 * s, z, .50 * s, .21 * s, .27 * s);
  b.add('gable', thatch, x, .06 + .54 * s, z, .46 * s, .27 * s, .72 * s, 0, Math.PI / 2);
  b.add('box', cypress, x, .06 + .68 * s, z, .76 * s, .03 * s, .05 * s);
  for (let i = 0; i < 5; i++) {
    b.add('cylinder', cypress, x + (i - 2) * .12 * s, .06 + .71 * s, z, .02 * s, .13 * s, .02 * s, Math.PI / 2);
  }
  for (const side of [-1, 1]) for (const lean of [-1, 1]) {
    b.add('box', cypress, x + side * .37 * s, .06 + .72 * s, z + lean * .05 * s, .014 * s, .24 * s, .014 * s, lean * .55);
  }
  b.add('box', GOLD, x, .06 + .33 * s, z + .14 * s, .1 * s, .14 * s, .01 * s);
}

function shrine(b, view) {
  const gravel = '#dcd8ca', cypress = '#c9a97c', vermilion = '#b0442c', ink = '#2c2a28';
  b.add('box', gravel, 0, .07, -.06, 1.04, .03, .84);
  for (const side of [-1, 1]) b.add('box', cypress, side * .51, .12, -.08, .02, .08, .74);
  b.add('box', cypress, 0, .12, -.46, 1.02, .08, .02);
  shrineHall(b, view, 0, -.14, 1);
  for (const side of [-1, 1]) shrineHall(b, view, side * .36, -.37, .42);
  b.add('box', '#e6e1d3', 0, .075, .34, .16, .012, .46);
  b.add('box', cypress, 0, .15, .25, .18, .06, .1);
  // Torii at the approach.
  for (const side of [-1, 1]) b.add('cylinder', vermilion, side * .16, .29, .55, .018, .46, .018);
  b.add('box', vermilion, 0, .44, .55, .38, .024, .03);
  b.add('box', vermilion, 0, .515, .55, .46, .034, .045);
  b.add('box', ink, 0, .54, .55, .5, .016, .05);
  view.tree(b, .40, .06, .28, .52, 'pine', steady);
}

// Stepped mud-brick ziggurat with a blue-glazed summit shrine and triple stair (Ur, Babylon).
function ziggurat(b, view) {
  const brick = '#b8936a', light = '#caa97d', recess = '#9c7a55', glaze = '#3e6c98';
  const tiers = [[1.04, .9, .2, .16], [.76, .64, .17, .345], [.52, .44, .15, .505]];
  tiers.forEach(([width, depth, height, y], i) => b.add('box', i % 2 ? light : brick, 0, y, -.08, width, height, depth));
  for (let i = 0; i < 6; i++) b.add('box', recess, -.42 + i * .168, .16, .372, .035, .16, .01);
  b.add('box', glaze, 0, .66, -.08, .30, .16, .24);
  b.add('box', GOLD, 0, .745, -.08, .32, .025, .26);
  b.add('box', light, 0, .77, -.08, .34, .03, .28);
  for (const side of [-1, 1]) b.add('cone', GOLD, side * .1, .83, -.08, .02, .09, .02);
  steps(b, light, [0, .66, .06], [0, .37, .26], .13, 5);
  steps(b, light, [0, .37, .26], [0, .25, .43], .11, 3);
  for (const side of [-1, 1]) steps(b, light, [side * .46, .52, .06], [side * .16, .4, .26], .09, 4);
}

// Nagara temple: plinth, pillared mandapa and a curvilinear shikhara over the sanctum.
function mandir(b, view, f) {
  const stone = '#d2ab80', deep = '#bf946b', light = '#e2c6a2';
  plinth(b, deep, 1.0, .86, .1, .1, -.04);
  plinth(b, light, 1.04, .9, .165, .03, -.04);
  b.add('box', stone, 0, .27, .2, .44, .18, .3);
  for (const x of [-.2, -.07, .07, .2]) b.add('cylinder', light, x, .27, .36, .02, .18, .02);
  b.add('cone4', deep, 0, .41, .2, .30, .11, .26, 0, Math.PI / 4);
  b.add('cone4', stone, 0, .48, .2, .20, .10, .18, 0, Math.PI / 4);
  b.add('sphere', GOLD, 0, .545, .2, .03, .03, .03);
  b.add('box', stone, 0, .31, -.18, .40, .28, .38);
  const widths = [.40, .373, .323, .258, .182, .098];
  widths.forEach((width, i) => b.add('taper4', i % 2 ? stone : deep, 0, .5 + i * .11, -.18, width / 1.35, .12, width / 1.35, 0, Math.PI / 4));
  b.add('disc', light, 0, 1.13, -.18, .09, .035, .09);
  b.add('cone', GOLD, 0, 1.19, -.18, .025, .09, .025);
  for (const side of [-1, 1]) {
    [.15, .11, .07].forEach((width, i) => b.add('taper4', deep, side * .25, .5 + i * .09, -.18, width / 1.35, .1, width / 1.35, 0, Math.PI / 4));
  }
  b.add('box', light, 0, .13, .42, .16, .05, .12);
  view.banner(b, .40, .2, .32, f.cloth, .62);
}

// Chinese pagoda (a stupa form) with a lacquered side hall.
function pagoda(b, view) {
  const base = '#c9c5b5', wall = '#ddd4be', lacquer = '#8f3b2c', tile = '#46545a';
  plinth(b, base, .9, .78, .1, .08, -.05);
  b.add('box', '#e2ded2', 0, .15, .34, .9, .02, .02);
  for (let i = 0; i < 5; i++) {
    const size = .40 - i * .055, y = .14 + i * .17, x = -.1, z = -.12;
    b.add('box', wall, x, y + .065, z, size, .13, size);
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) b.add('box', lacquer, x + cx * size * .48, y + .065, z + cz * size * .48, .02, .13, .02);
    b.add('cone4', tile, x, y + .17, z, size * 1.08, .08, size * 1.08, 0, Math.PI / 4);
  }
  b.add('cylinder', GOLD, -.1, 1.08, -.12, .012, .26, .012);
  for (let i = 0; i < 3; i++) b.add('disc', GOLD, -.1, 1.0 + i * .06, -.12, .045 - i * .01, .012, .045 - i * .01);
  b.add('box', wall, .34, .23, .06, .26, .15, .22);
  for (const side of [-1, 1]) b.add('box', lacquer, .34 + side * .1, .23, .18, .025, .15, .025);
  b.add('cone4', tile, .34, .37, .06, .27, .12, .23, 0, Math.PI / 4);
  view.tree(b, .38, .06, -.34, .42, 'round', steady);
}

// Stepped pyramid: twin summit shrines (Mexica) or one temple with a roof comb (Maya).
function pyramid(b, view, f, variant) {
  const stone = '#d6caa9', stucco = '#e6ddc6', red = '#a24a35', blue = '#4c7ea4';
  for (let i = 0; i < 4; i++) {
    const width = 1.0 - i * .18, depth = .86 - i * .16, y = .135 + i * .15;
    b.add('box', i % 2 ? stucco : stone, 0, y, -.1, width, .15, depth);
    b.add('box', i % 2 ? red : '#b9ab88', 0, y + .045, -.1 + depth / 2 + .004, width * .92, .035, .01);
  }
  view.segment(b, [0, .07, .52], [0, .66, .08], .16, stucco, .05);
  for (const side of [-1, 1]) view.segment(b, [side * .1, .1, .52], [side * .1, .69, .08], .025, variant === 'twin' ? red : stone, .07);
  if (variant === 'twin') {
    for (const side of [-1, 1]) {
      const color = side < 0 ? blue : red;
      b.add('box', stucco, side * .12, .74, -.12, .19, .15, .2);
      b.add('box', color, side * .12, .74, -.015, .12, .1, .01);
      b.add('box', color, side * .12, .84, -.12, .21, .05, .22);
      b.add('cone4', color, side * .12, .92, -.12, .13, .1, .13, 0, Math.PI / 4);
    }
  } else {
    b.add('box', stucco, 0, .75, -.12, .34, .16, .24);
    b.add('box', '#3b3a36', 0, .73, .005, .08, .1, .01);
    b.add('box', red, 0, .85, -.12, .36, .04, .26);
    b.add('box', red, 0, .97, -.2, .28, .2, .03);
    for (const x of [-.08, 0, .08]) b.add('box', stucco, x, .98, -.185, .03, .07, .01);
  }
  view.banner(b, .44, .06, .3, f.cloth, .7);
}

// Andean terraces and a walled sun temple with gold plates (Coricancha).
function terrace(b, view) {
  const granite = '#aba38d', green = '#7a9656', thatch = '#a88d58';
  for (let i = 0; i < 3; i++) {
    const depth = .34 - i * .1, y = .1 + i * .08, z = -.3 - i * .06;
    b.add('box', granite, 0, y, z, 1.02 - i * .12, .08, depth);
    b.add('box', green, 0, y + .045, z, 1.0 - i * .12, .012, depth - .02);
  }
  b.add('taper4', granite, 0, .24, .12, .36, .26, .36, 0, Math.PI / 4);
  b.add('box', GOLD, 0, .33, .12, .41, .03, .41);
  b.add('cone4', thatch, 0, .47, .12, .36, .2, .36, 0, Math.PI / 4);
  b.add('box', '#3c3a35', 0, .19, .365, .07, .14, .02);
  b.add('box', granite, .38, .09, .34, .2, .06, .2);
  b.add('box', '#b9b19b', .38, .14, .34, .12, .05, .12);
  b.add('cylinder', '#7c6647', -.4, .3, .3, .014, .48, .014);
  b.add('disc', GOLD, -.4, .56, .3, .1, .02, .1, Math.PI / 2);
}

// Yoruba shrine compound with steep palm-thatch roofs in a sacred grove (Osun-Osogbo).
function grove(b, view) {
  const laterite = '#a9754f', mud = '#b98b61', thatch = '#8e7c4f', wood = '#5d4636';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    if (i === 2) continue;
    b.add('box', laterite, Math.cos(a) * .52, .12, Math.sin(a) * .52, .4, .11, .05, 0, Math.PI / 2 - a);
  }
  b.add('box', mud, 0, .18, -.08, .44, .2, .32);
  b.add('cone4', thatch, 0, .44, -.08, .40, .34, .34, 0, Math.PI / 4);
  for (const x of [-.2, -.07, .07, .2]) b.add('cylinder', wood, x, .17, .13, .016, .2, .016);
  b.add('box', mud, -.3, .15, -.3, .18, .14, .16);
  b.add('cone', thatch, -.3, .33, -.3, .16, .22, .16);
  b.add('box', laterite, .24, .07, .32, .26, .02, .16);
  b.add('box', 'water', .24, .08, .32, .22, .012, .12);
  b.add('box', '#d0b27a', -.14, .17, .28, .05, .2, .05);
  b.add('cone', GOLD, -.14, .3, .28, .03, .06, .03);
  view.tree(b, .40, .06, -.32, .56, 'round', steady);
  view.tree(b, -.44, .06, .16, .44, 'round', steady);
}

// Irish ring-fort with a roundhouse, a standing stone and a quartz-faced passage mound.
function ringfort(b, view) {
  const grass = '#6f8c53', quartz = '#e9e7de', wattle = '#b3a283', thatch = '#8a7851', stone = '#a9a592';
  b.add('hill', grass, -.3, .14, -.3, .44, .22, .38);
  for (let i = 0; i < 5; i++) {
    const a = .5 + i * .28;
    b.add('rock', quartz, -.3 + Math.cos(a) * .4, .08, -.3 + Math.sin(a) * .34, .045, .04, .035);
  }
  b.add('box', '#3f3d38', -.18, .1, .02, .05, .07, .02, 0, -.4);
  b.add('torus', '#7f9a5e', .16, .08, .08, .38, .38, .55, Math.PI / 2);
  b.add('cylinder', wattle, .16, .15, .08, .15, .14, .15);
  b.add('cone', thatch, .16, .33, .08, .19, .22, .19);
  b.add('cylinder', wattle, .3, .12, .22, .07, .09, .07);
  b.add('cone', thatch, .3, .22, .22, .09, .12, .09);
  b.add('box', stone, .3, .18, -.14, .05, .22, .05);
}

// Polynesian marae: open court, stepped stone ahu with uprights and a carved meeting house.
function marae(b, view) {
  const basalt = '#77726a', coral = '#d9d3c0', timber = '#6b4a33', roof = '#4f3d2e', ochre = '#8e3b26';
  b.add('box', coral, 0, .07, 0, .96, .03, .8);
  b.add('box', basalt, 0, .14, -.34, .8, .12, .18);
  b.add('box', basalt, 0, .25, -.34, .64, .1, .14);
  for (let i = 0; i < 5; i++) b.add('box', '#5f5b55', -.24 + i * .12, .38, -.34, .04, .16, .03);
  b.add('box', timber, .22, .16, .04, .3, .16, .42);
  b.add('gable', roof, .22, .33, .06, .4, .18, .5);
  for (const side of [-1, 1]) {
    b.add('box', timber, .22 + side * .15, .16, .27, .03, .16, .07);
    view.segment(b, [.22, .43, .31], [.22 + side * .21, .24, .31], .03, ochre, .03);
  }
  b.add('box', ochre, .22, .47, .31, .03, .07, .02);
  b.add('box', '#2f2a26', .22, .14, .26, .07, .11, .01);
  b.add('cylinder', timber, -.3, .22, .26, .03, .32, .03);
  b.add('box', ochre, -.3, .4, .26, .06, .06, .06);
}

// Wooden hill sanctuary of Perun: a mound with an oak idol, fire pits and a palisade.
function peryn(b, view) {
  const grass = '#77925a', oak = '#6e5236', dark = '#3d352c', shingle = '#5a4a3a';
  b.add('hill', grass, 0, .14, -.06, .56, .2, .5);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const x = Math.cos(a) * .48, z = -.06 + Math.sin(a) * .42;
    b.add('disc', dark, x, .075, z, .05, .02, .05);
    b.add('cone', 'window', x, .1, z, .018, .05, .018);
  }
  b.add('cylinder', oak, 0, .42, -.06, .03, .36, .03);
  b.add('box', oak, 0, .64, -.06, .07, .09, .07);
  b.add('box', GOLD, 0, .58, -.06, .075, .015, .075);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + i * Math.PI / 8;
    b.add('cylinder', oak, Math.cos(a) * .64, .14, -.06 + Math.sin(a) * .56, .016, .17, .016);
  }
  b.add('box', oak, -.36, .14, .3, .24, .14, .18);
  b.add('gable', shingle, -.36, .27, .3, .28, .12, .24, 0, Math.PI / 2);
}

// The tabernacle within its linen court; the entrance screen is blue, purple and scarlet (Exodus 26–27).
function tabernacle(b, view) {
  const linen = '#ece6d6', bronze = '#a8844f', sand = '#d9cba8', skins = '#6b5140';
  b.add('box', sand, 0, .065, -.02, .64, .02, 1.04);
  for (const side of [-1, 1]) {
    b.add('box', linen, side * .32, .14, -.02, .014, .15, 1.02);
    b.add('box', linen, side * .21, .14, .5, .22, .15, .014);
    for (let i = 0; i < 6; i++) b.add('cylinder', bronze, side * .32, .15, -.52 + i * .2, .012, .17, .012);
  }
  b.add('box', linen, 0, .14, -.53, .64, .15, .014);
  ['#3e5f8a', '#6b4a78', '#a33d33'].forEach((color, i) => b.add('box', color, (i - 1) * .065, .14, .5, .065, .15, .016));
  b.add('box', '#c9b48e', 0, .2, -.26, .22, .26, .42);
  b.add('gable', skins, 0, .4, -.26, .27, .14, .46);
  b.add('box', '#3e5f8a', 0, .19, -.045, .16, .22, .012);
  for (const side of [-1, 1]) b.add('cylinder', GOLD, side * .07, .19, -.04, .012, .24, .012);
  b.add('box', bronze, 0, .1, .26, .12, .07, .12);
  for (const x of [-.05, .05]) for (const z of [.21, .31]) b.add('cone', bronze, x, .15, z, .01, .03, .01);
  b.add('cylinder', bronze, .1, .09, .1, .03, .05, .03);
  b.add('disc', 'water', .1, .118, .1, .026, .006, .026);
}

// Persian columned hall on a raised terrace, hung with white, green and blue (Esther 1:5–6).
function apadana(b, view) {
  const stone = '#d8cdb4', dark = '#5d5a55', white = '#eee9dc';
  plinth(b, stone, 1.04, .9, .12, .14, -.06);
  for (const side of [-1, 1]) steps(b, '#cbbfa4', [side * .42, .5, .06], [side * .14, .43, .19], .12, 4);
  for (const x of [-.27, -.09, .09, .27]) for (const z of [-.27, -.06, .15]) {
    b.add('cylinder', white, x, .39, z, .022, .4, .022);
    b.add('box', dark, x, .59, z, .07, .035, .035);
  }
  b.add('box', stone, 0, .39, -.33, .7, .4, .04);
  b.add('box', stone, 0, .62, -.06, .7, .05, .54);
  b.add('box', dark, 0, .6, -.06, .73, .02, .57);
  [white, '#4f7d5e', '#3f5f8c'].forEach((color, i) => b.add('box', color, -.18 + i * .18, .5, .16, .15, .16, .008));
  for (const side of [-1, 1]) view.tree(b, side * .42, .19, .3, .42, 'pine', steady);
}

export const CAPITAL_BUILDERS = Object.freeze({
  shrine, ziggurat, mandir, pagoda, pyramid, terrace, grove, ringfort, marae, peryn, tabernacle, apadana,
});

// Returns false when the style belongs to the renderer's own four builders.
export function mythicCapital(view, b, architecture, f) {
  const build = CAPITAL_BUILDERS[architecture?.style];
  if (!build) return false;
  build(b, view, f, architecture.variant);
  return true;
}
