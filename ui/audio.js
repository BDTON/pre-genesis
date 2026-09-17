// Procedural ambient music and short order sounds. Audio starts only after a
// user gesture and is suspended when muted or when the page is hidden.
import {ctx, ui, $} from './context.js';
import {icon} from './icons.js';
import {toast} from './overlay.js';

let audio = null;
let musicTimer = 0;
const CHORDS = [[130.81, 164.81, 196, 293.66], [110, 146.83, 174.61, 261.63], [98, 146.83, 196, 246.94], [130.81, 174.61, 220, 329.63]];
const SOUNDS = {order: [330, .05], turn: [164, .14], attack: [196, .09]};

function context() {
  if (!audio) {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  }
  return audio;
}

function tone(frequency, duration = .25, volume = .02) {
  if (!audio || audio.state !== 'running') return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume * ctx.preferences.volume, now + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(now + duration + .1);
}

function playChord() {
  clearTimeout(musicTimer);
  if (!ctx.preferences.music || document.hidden) return;
  const chord = CHORDS[Math.floor(Date.now() / 6500) % CHORDS.length];
  chord.forEach((f, i) => setTimeout(() => tone(f, 5, .008), i * 170));
  musicTimer = setTimeout(playChord, 6500);
}

async function wake() {
  const a = context();
  if (!a) return false;
  if (a.state !== 'running') { try { await a.resume(); } catch { return false; } }
  return a.state === 'running';
}

async function sleep() {
  clearTimeout(musicTimer);
  if (audio && audio.state === 'running') { try { await audio.suspend(); } catch { /* already closed */ } }
}

// Without music the audio thread only runs briefly around each sound.
let idleTimer = 0;
function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!ctx.preferences.music) sleep(); }, 1500);
}

export function sfx(kind) {
  if (!ctx.preferences.sfx) return;
  const [frequency, duration] = SOUNDS[kind] || SOUNDS.order;
  const play = () => { tone(frequency, duration); scheduleIdle(); };
  if (audio?.state === 'running') play();
  else wake().then(ok => ok && play());
}

export async function setMusic(on) {
  ctx.preferences.music = !!on;
  if (on) { if (await wake()) playChord(); }
  else await sleep();
  syncSoundButton();
}

export async function toggleMusic() {
  await setMusic(!ctx.preferences.music);
  ui.savePreferences?.();
  toast(ctx.preferences.music ? 'Music on.' : 'Music off.');
}

export function syncSoundButton() {
  const b = $('#sound');
  if (!b) return;
  const on = !!ctx.preferences.music;
  b.setAttribute('aria-pressed', String(on));
  const label = on ? 'Mute music' : 'Play music';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon(on ? 'sound-on' : 'sound-off');
}

export function installAudio() {
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) {
      clearTimeout(musicTimer);
      audio.suspend().catch(() => {});
    } else if (ctx.preferences.music) {
      audio.resume().then(playChord).catch(() => {});
    }
  });
  // Browsers only allow audio after a gesture; resume saved music on the first one.
  const resumeOnGesture = () => { if (ctx.preferences.music) setMusic(true); };
  addEventListener('pointerdown', resumeOnGesture, {once: true});
  addEventListener('keydown', resumeOnGesture, {once: true});
  syncSoundButton();
}

Object.assign(ui, {sfx, setMusic, toggleMusic, syncSoundButton});
