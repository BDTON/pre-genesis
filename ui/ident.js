// BEM Studios ident, shown once per launch before the title.
//
// Ported from the studio's own ident (RogueLikeRogueLike, DevSplash.cs, 12 Sep):
// black ink is poured into a bar on a silver field, the bar turns into the
// peacock band, a lamp strikes on the wordmark, and the band underlines it.
//
//   0.42s  the stream reaches the bar, off centre, and the splash throws
//   1.60s  the bar is full; the surface is still sloshing
//   1.80s  the ink becomes the band on one frame, not a crossfade
//   2.02s  the lamp strikes: the filament kicks, dips, then holds
//   3.30s  the fold to black; 3.70s the title takes over
//
// Drawn on a canvas in a fixed 2400 x 1400 design space, scaled to fit, so the
// shot composes the same on a phone and a desktop. Developer brand only; no
// game art appears here, and its palette is the studio's, not the game's.
import {ctx, ui, $} from './context.js';

const POUR_AT = 0.42;
const FULL_AT = 1.60;
const TURN_AT = 1.80;
const LAMP_AT = 2.02;
const DUR = 3.70;
const STILL_MS = 1200;
const SEEN_KEY = 'pregenesis-ident-seen';

const SILVER = [0xe9, 0xed, 0xf2];
const PAPER = [0xf9, 0xfb, 0xfd];
const INK = '#0b0d10';
const WORD = '#14171b';

// The band, measured off the studio's live site: violet, blue, teal, green, gold
// and back to violet so the loop closes. Half the gradient shows at a time and
// one whole gradient width drifts past every eleven seconds, dead linear.
const BAND = [['#7C3AED', 0], ['#1D4ED8', 0.22], ['#0D9488', 0.45], ['#059669', 0.63], ['#E0A92E', 0.82], ['#7C3AED', 1]];
const BAND_SECONDS = 11;

const BAR_W = 1100;
const BAR_H = 30;
const BAR_Y = -96;
const POUR_X = -235;   // the lip the ink leaves
const HIT_X = -129;    // where it lands: a pour has a lean, so the shot is never symmetric
const CELLS = 44;
const DROPS = 16;
const STREAM = 18;

const clamp01 = v => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

// Deterministic randomness, so every launch pours the same way.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two tones that do not divide into each other, so the waver never loops.
const wobble = (t, freq, seed) => Math.sin(t * freq + seed * 1.7) * 0.62 + Math.sin(t * freq * 1.618 + seed * 2.3) * 0.38;

function buildScene() {
  const r = rng(12092026);
  const range = (a, b) => a + (b - a) * r();
  const nearRun = Math.abs(-BAR_W / 2 - HIT_X);
  const farRun = Math.abs(BAR_W / 2 - HIT_X);
  // The ink arrives one column at a time: each on its own clock and depth,
  // deep where it landed and thin at the ends, and only then level.
  const cells = [];
  for (let i = 0; i < CELLS; i++) {
    const x = -BAR_W / 2 + BAR_W * (i + 0.5) / CELLS;
    const near = x < HIT_X;
    const d = Math.abs(x - HIT_X) / (near ? nearRun : farRun);
    cells.push({x, at: POUR_AT + d * (near ? 0.52 : 0.74) + range(-0.035, 0.035), deep: lerp(1.34, 0.72, d) + range(-0.06, 0.06)});
  }
  // The crown throws hard and the running stream only dribbles.
  const drops = [];
  for (let i = 0; i < DROPS; i++) {
    const born = Math.pow(i / (DROPS - 1), 1.6) * 0.62;
    const force = 1 - born / 0.62 * 0.72;
    const a = range(0.18, Math.PI - 0.18);
    drops.push({
      at: born,
      vx: Math.cos(a) * range(180, 620) * force,
      vy: Math.sin(a) * range(700, 1624) * force,
      size: range(17, 36) * (0.6 + force * 0.4),
    });
  }
  // The crown the impact throws up around the bar: a ring of uneven points,
  // lopsided toward the side the ink ran downhill.
  const crown = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.14 + 0.72 * i / 4);
    crown.push({a, reach: range(0.6, 1.0) * (Math.cos(a) > 0 ? 1.12 : 0.88)});
  }
  return {cells, drops, crown};
}

function reducedMotion() {
  const setting = ctx.preferences?.motion;
  if (setting === 'reduced') return true;
  if (setting === 'full') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Once per launch. A reload in the same tab goes straight to the title.
function alreadySeen() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function remember() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: it plays again next launch */ }
}

function makeRenderer(canvas) {
  const scene = buildScene();
  const g = canvas.getContext('2d');
  let W = 0, H = 0, s = 1, dpr = 1;
  let band = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // Fit the bar and the lamp's reach, never so large the word crowds the frame.
    s = Math.min(W / 1400, H / 900, 0.85);
    band = null;
  }

  // Two copies of the band side by side, each twice the bar's width, so the
  // bar shows half a band and can drift one whole band width without a seam.
  // Drawn as hard-edged colour blocks to honour the no-gradient contract.
  function bandImage() {
    if (band) return band;
    const w = Math.max(4, Math.round(BAR_W * 4 * s * dpr));
    band = document.createElement('canvas');
    band.width = w;
    band.height = 1;
    const b = band.getContext('2d');
    const half = w / 2;
    const segs = BAND.length - 1;
    for (let i = 0; i < segs; i++) {
      const c0 = BAND[i][0], c1 = BAND[i + 1][0];
      const a0 = BAND[i][1], a1 = BAND[i + 1][1];
      b.fillStyle = c0;
      b.fillRect(Math.round(a0 * half), 0, Math.max(1, Math.round((a1 - a0) * half)), 1);
      b.fillStyle = c1;
      b.fillRect(Math.round(half + a0 * half), 0, Math.max(1, Math.round((a1 - a0) * half)), 1);
    }
    return band;
  }

  const X = x => W / 2 + x * s;
  const Y = y => H / 2 - y * s;

  function draw(t) {
    const turned = t >= TURN_AT;
    const fold = clamp01((t - (DUR - 0.40)) / 0.40);
    const k = 1 - fold;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = `rgb(${SILVER.map(c => Math.round(c * k)).join(',')})`;
    g.fillRect(0, 0, W, H);

    // The fold shrinks the whole card a touch as it goes dark.
    g.translate(W / 2, H / 2);
    const zoom = 1 - fold * 0.04;
    g.scale(zoom, zoom);
    g.translate(-W / 2, -H / 2);

    // ---- the lamp: a filament kicks, dips, then holds ----
    let warm = 0;
    if (t >= LAMP_AT) {
      const u = clamp01((t - LAMP_AT) / 0.42);
      warm = u < 0.18 ? u / 0.18 * 0.75
        : u < 0.26 ? 0.75 - (u - 0.18) / 0.08 * 0.3
        : 0.45 + smooth((u - 0.26) / 0.74) * 0.55;
      const rx = (1150 + warm * 56) * s, ry = (420 + warm * 20) * s;
      g.save();
      g.translate(X(73), Y(BAR_Y + 80));   // the pool centres on the word and its band
      g.scale(rx, ry);
      // Pool of light, drawn as concentric translucent ellipses (no gradient).
      const [pr, pg, pb] = PAPER;
      const a = warm * 0.95 * k;
      g.fillStyle = `rgba(${pr},${pg},${pb},${a})`;
      g.beginPath();
      g.arc(0, 0, 0.72, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(${pr},${pg},${pb},${a * 0.55})`;
      g.beginPath();
      g.arc(0, 0, 0.86, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(${pr},${pg},${pb},${a * 0.18})`;
      g.beginPath();
      g.arc(0, 0, 1, 0, Math.PI * 2);
      g.fill();
      g.restore();

      // Nothing of the wordmark exists until the lamp finds it. The band
      // underlines the word, so the word is set to the band's width and sits
      // on it; an underline that overshoots its word is a rule, not an underline.
      // Sentence case: the studio brand stays the studio's, but the all-caps
      // form would trip the contract's UI-text gate.
      const WORDMARK = 'Bem Studios';
      const family = '"PreGenesis Display", "PreGenesis Text", serif';
      g.font = `600 100px ${family}`;
      const size = 100 * (BAR_W * s) / Math.max(1, g.measureText(WORDMARK).width);
      g.font = `600 ${size.toFixed(1)}px ${family}`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      const baseline = Y(BAR_Y + BAR_H / 2) - size * 0.28;
      const off = size * 0.035;
      g.fillStyle = `rgba(0,0,0,${0.13 * warm * k})`;
      g.fillText(WORDMARK, X(0) + off, baseline + off * 0.6);
      g.globalAlpha = clamp01(warm * 1.3) * k;
      g.fillStyle = WORD;
      g.fillText(WORDMARK, X(0), baseline);
      g.globalAlpha = 1;
    }

    g.fillStyle = INK;

    // ---- the stain the pour left, under everything, gone when the ink turns ----
    let stainA = clamp01((t - POUR_AT) / 0.16);
    if (turned) stainA *= clamp01(1 - (t - TURN_AT) / 0.18);
    if (stainA > 0) {
      // The crown rises fast and sinks back, leaving a low, lopsided splash.
      const up = clamp01((t - POUR_AT) / 0.12) * (1 - 0.8 * clamp01((t - POUR_AT - 0.12) / 0.55));
      const cx = X(HIT_X), cy = Y(BAR_Y + BAR_H / 2);
      const r = 130 * s;
      g.globalAlpha = stainA * 0.92 * k;
      g.beginPath();
      g.moveTo(cx - r, cy);
      // A few soft lobes of thrown ink, taller on the downhill side.
      for (const p of scene.crown) {
        const px = cx - Math.cos(p.a) * r;
        const h = 46 * s * p.reach * up;
        const lobe = 22 * s;
        g.bezierCurveTo(px - lobe, cy - h * 0.2, px - lobe * 0.5, cy - h, px, cy - h);
        g.bezierCurveTo(px + lobe * 0.5, cy - h, px + lobe, cy - h * 0.2, px + lobe * 1.2, cy);
      }
      g.lineTo(cx + r, cy);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }

    // ---- the bar fills one column at a time, from where the ink hit ----
    if (!turned) {
      const settle = Math.min(0.17, Math.max(0, 0.17 - (t - FULL_AT) * 0.36));
      const cw = BAR_W / CELLS + 1.6;
      for (const c of scene.cells) {
        const age = t - c.at;
        if (age <= 0) continue;
        const rise = clamp01(age / 0.15);
        const level = lerp(c.deep, 1, clamp01((age - 0.15) / 0.42));
        // A travelling wave keyed to the column, so the slosh moves along the bar.
        const phase = (c.x - HIT_X) / 129;
        const h = BAR_H * rise * Math.max(0.04, level + Math.sin(t * 17 - phase) * settle);
        g.fillRect(X(c.x - cw / 2), Y(BAR_Y - BAR_H / 2 + h), cw * s, h * s);
      }
      if (t >= POUR_AT) {
        const sw = clamp01((t - POUR_AT) / 0.22) * 207 * (1 - clamp01((t - POUR_AT - 0.5) / 0.5));
        if (sw > 1) {
          g.globalAlpha = 0.7;
          g.fillRect(X(HIT_X - sw / 2), Y(BAR_Y - BAR_H / 2 + 8.5), sw * s, 17 * s);
          g.globalAlpha = 1;
        }
      }
    }

    // ---- what the splash threw: it lands, splats and stays on the card ----
    const dropA = turned ? clamp01(1 - (t - TURN_AT) / 0.18) : 1;
    if (dropA > 0) {
      g.globalAlpha = dropA * k;
      for (const d of scene.drops) {
        const age = t - POUR_AT - d.at;
        if (age <= 0) continue;
        let y = BAR_Y + d.vy * age - 4760 * age * age;
        const landed = y <= BAR_Y;
        if (landed) y = BAR_Y;
        const rx = (landed ? d.size * 1.9 : d.size) / 2 * s;
        const ry = (landed ? d.size * 0.55 : d.size) / 2 * s;
        g.beginPath();
        g.ellipse(X(HIT_X + d.vx * age), Y(y), rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // ---- the stream falls from off the top of the frame and drains from the top ----
    // Drawn as one tapered ribbon through the stream's samples, so it reads as
    // a column of liquid rather than a stack of blocks.
    const fall = clamp01(t / POUR_AT);
    const gone = clamp01((t - (POUR_AT + 0.40)) / 0.48);
    const left = [], right = [];
    for (let i = 0; i < STREAM; i++) {
      const lead = i / STREAM;
      if (lead > 1 - gone) continue;
      // It is falling, not sliding, so the head accelerates.
      const u = clamp01(fall * 1.18 - lead * 0.20);
      const y = Math.max(BAR_Y + BAR_H / 2, lerp(760, BAR_Y, u * u));
      // The waver travels down the stream: the lip's motion arrives later below.
      const lag = t - (1 - lead) * 0.16;
      // Neighbouring samples share a phase that drifts slowly along the stream,
      // so it bends as one column instead of zig-zagging.
      const sway = wobble(lag, 3.1, i * 0.21) * (4 + i * 0.5);
      const x = lerp(POUR_X, HIT_X, u * u) + sway;
      const half = (30 - i * 0.55 + wobble(lag * 1.7, 5.3, i * 0.23 + 40) * 2.4) / 2;
      left.push([X(x - half), Y(y)]);
      right.push([X(x + half), Y(y)]);
    }
    if (left.length > 1) {
      g.beginPath();
      g.moveTo(left[0][0], left[0][1]);
      for (const [px, py] of left) g.lineTo(px, py);
      for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
      g.closePath();
      g.fill();
    }

    // ---- the ink becomes the band on one frame, and drifts ----
    if (turned) {
      const img = bandImage();
      const gradientWidth = img.width / 2;
      const drift = ((0.45 + (t - TURN_AT) / BAND_SECONDS) % 1) * gradientWidth;
      g.globalAlpha = clamp01((t - TURN_AT) / 0.10) * k;
      g.imageSmoothingEnabled = true;
      g.drawImage(img, drift, 0, gradientWidth / 2, 1, X(-BAR_W / 2), Y(BAR_Y + BAR_H / 2), BAR_W * s, BAR_H * s);
      g.globalAlpha = 1;
    }
  }

  return {resize, draw};
}

let finished = false;

export function playIdent(done) {
  const root = $('#ident');
  const canvas = $('#ident-canvas');
  // QA: ?ident-frame=<seconds> holds that single frame until a click or key.
  const inspect = Number.parseFloat(new URLSearchParams(location.search).get('ident-frame'));
  const inspecting = Number.isFinite(inspect);
  if (!root || !canvas || (alreadySeen() && !inspecting)) { done(); return; }

  // The silver field shows at once; the pour waits for the type.
  root.hidden = false;
  // Canvas text does not wait for web fonts: without this the wordmark can be
  // set in a system serif. Wait for the custom face, capped so a slow network
  // never holds the launch, then start.
  const fontReady = document.fonts?.load
    ? Promise.race([document.fonts.load('600 100px "PreGenesis Display"'), new Promise(r => setTimeout(r, 1500))])
    : Promise.resolve();
  fontReady.catch(() => {}).then(() => begin());

  function begin() {

  const still = reducedMotion();
  const renderer = makeRenderer(canvas);
  let raf = 0;
  let timer = 0;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    window.removeEventListener('resize', onResize);
    root.removeEventListener('click', finish);
    document.removeEventListener('keydown', onKey);
    const audio = $('#ident-audio');
    if (audio) { audio.pause(); audio.currentTime = 0; }
    root.classList.add('is-leaving');
    setTimeout(() => { root.hidden = true; root.classList.remove('is-leaving'); }, 320);
    remember();
    done();
  };
  const onKey = event => {
    if (['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) { event.preventDefault(); finish(); }
  };
  const heldFrame = inspecting ? Math.min(Math.max(inspect, 0), DUR) : LAMP_AT + 0.6;
  const onResize = () => { renderer.resize(); if (still || inspecting) renderer.draw(heldFrame); };

  root.hidden = false;
  renderer.resize();
  root.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  $('#ident-skip')?.focus({preventScroll: true});

  if (inspecting) {
    renderer.draw(heldFrame);
    return;
  }

  if (still) {
    // Reduced motion: the finished frame (lamp on, band under the word), held.
    renderer.draw(LAMP_AT + 0.6);
    timer = setTimeout(finish, STILL_MS);
    return;
  }

  // The studio's own sting. Browsers block sound before a gesture; when they do,
  // the ident plays silent rather than waiting.
  if (ctx.preferences?.music !== false) {
    const audio = $('#ident-audio');
    if (audio) { audio.volume = 0.8; audio.play().catch(() => {}); }
  }

  // The wall clock guard: the first frames after a load carry the whole load's
  // delta, so they are skipped and every step is clamped. A device that hitches
  // shows the ident, never a black hold, and a stalled clock still ends.
  let t = 0, wall = 0, frames = 0, last = performance.now();
  const tick = now => {
    const dt = (now - last) / 1000;
    last = now;
    frames++;
    if (frames > 2) { wall += Math.min(dt, 0.5); t += Math.min(dt, 0.1); }
    renderer.draw(Math.min(t, DUR));
    if (t >= DUR || wall > DUR + 2.5) { finish(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  }
}

Object.assign(ui, {playIdent});
