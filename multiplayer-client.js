// Browser and phone client for shared campaigns (see multiplayer-server.js).
export const PUBLIC_ORIGIN = 'https://pre-genesis.online';
export const API_ORIGIN = 'https://api.pre-genesis.online';

const SEAT_KEY = 'pregenesis-online-seat-v1';
const LEGACY_SEAT_KEY = 'crowns-online-seat-v1';
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])$/;
const ROOM_CODE = /^[A-Z2-9]{8}$/;
const SEAT_TOKEN = /^[a-f0-9]{64}$/;
const REQUEST_TIMEOUT_MS = 15_000;
// Longer than the server's 25 s hold, so a held request is never cut short.
const LONG_POLL_TIMEOUT_MS = 40_000;
// Minimum pause after an update before asking for the next one, so a burst of
// opponent orders renders a few times a second at most.
const UPDATE_GAP_MS = 400;

export const ROOM_MESSAGES = Object.freeze({
  offline: 'Can’t reach the room server; check your connection.',
  timeout: 'The room server took too long to answer.',
  unavailable: 'The room server is unavailable right now.',
  ended: 'That room has ended or your seat was released.',
  stale: 'The map changed first; send your order again.',
  code: 'Room codes have 8 letters and numbers.',
  busy: 'Your last order is still being confirmed.',
  reconnecting: 'Orders resume when the connection returns.',
  waitTurn: 'Wait for your turn; you can still look around.',
});

/**
 * Where room requests go: the phone app's configured origin, then the page's
 * <meta name="pregenesis-api">, then the same origin for a local development
 * server, then the public API. Never taken from the URL, so room tokens only
 * reach a host the game itself names.
 */
export function getApiBase() {
  const native = globalThis.PREGENESIS_NATIVE?.apiOrigin;
  if (native) return native.trim().replace(/\/+$/, '');
  // A locally served copy talks to its own dev server, even though index.html names production.
  if (LOCAL_HOST.test(globalThis.location?.hostname || '')) return '';
  const configured = globalThis.document?.querySelector?.('meta[name="pregenesis-api"]')?.content;
  return (configured || API_ORIGIN).trim().replace(/\/+$/, '');
}

export const normalizeRoomCode = code => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const roomError = (message, status) => Object.assign(new Error(message), { status });
const isHidden = () => !!globalThis.document?.hidden;
const validSeat = seat => !!seat && ROOM_CODE.test(seat.code) && SEAT_TOKEN.test(seat.token || '');

// Seats live in sessionStorage (this tab) and localStorage (this device).
// Seats saved under the old key are still read; new writes use the new key.
function seatStores() {
  const stores = [];
  for (const name of ['sessionStorage', 'localStorage']) {
    try { if (globalThis[name]) stores.push(globalThis[name]); } catch { /* storage blocked */ }
  }
  return stores;
}
function readSeat() {
  for (const store of seatStores()) {
    for (const key of [SEAT_KEY, LEGACY_SEAT_KEY]) {
      try {
        const raw = store.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch { /* unreadable entry */ }
    }
  }
  return null;
}
function writeSeat(seat) {
  for (const store of seatStores()) {
    try {
      store.setItem(SEAT_KEY, JSON.stringify(seat));
      store.removeItem(LEGACY_SEAT_KEY);
    } catch { /* storage full or blocked */ }
  }
}
function clearSeat() {
  for (const store of seatStores()) {
    for (const key of [SEAT_KEY, LEGACY_SEAT_KEY]) {
      try { store.removeItem(key); } catch { /* storage blocked */ }
    }
  }
}
function inviteBase() {
  const configured = globalThis.PREGENESIS_NATIVE?.publicOrigin;
  if (configured) return configured;
  // Rooms on a local development server exist only there.
  if (getApiBase() === '' && /^https?:$/.test(globalThis.location?.protocol || '')) return globalThis.location.href;
  return PUBLIC_ORIGIN;
}

export class FriendSession {
  constructor({ onSnapshot, onError, onConnection, onBusy, updateGapMs = UPDATE_GAP_MS } = {}) {
    this.onSnapshot = onSnapshot;
    this.onError = onError;
    this.onConnection = onConnection;
    this.onBusy = onBusy;
    this.updateGapMs = updateGapMs;
    this.credentials = null;
    this.snapshot = null;
    this.busy = false;
    this.timer = null;
    this.lastRevision = -1;
    this.connectionStatus = 'offline';
    this.generation = 0;
    this.failures = 0;
    this.polling = false;
    // True once the server has answered "unchanged" (204), i.e. it supports X-Room-Since.
    this.holdsPolls = false;
    globalThis.document?.addEventListener?.('visibilitychange', () => this.handleVisibility());
  }

  get connected() { return !!this.credentials; }

  get myTurn() {
    return this.connectionStatus === 'connected'
      && this.snapshot?.room?.status === 'active'
      && this.snapshot.room.activePlayerId === this.snapshot.you.id;
  }

  async request(path, body, { timeout = REQUEST_TIMEOUT_MS, headers = {} } = {}) {
    const init = {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...headers,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.credentials ? { Authorization: `Bearer ${this.credentials.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    };
    let response;
    try {
      response = await fetch(`${getApiBase()}/api/rooms${path}`, init);
    } catch (error) {
      // A CORS refusal looks exactly like a network failure to the page.
      throw roomError(error?.name === 'TimeoutError' ? ROOM_MESSAGES.timeout : ROOM_MESSAGES.offline, 0);
    }
    if (response.status === 204) return null;
    let data = null;
    try { data = await response.json(); } catch { /* a proxy error page or a cut connection */ }
    if (!data || typeof data !== 'object') throw roomError(ROOM_MESSAGES.unavailable, response.status);
    if (!response.ok) {
      if (response.status === 409 && this.credentials) this.schedule(0);
      throw roomError(data.error || ROOM_MESSAGES.unavailable, response.status);
    }
    return data;
  }

  setBusy(value) {
    this.busy = value;
    this.onBusy?.(value);
  }

  setConnection(status) {
    this.connectionStatus = status;
    this.onConnection?.(status);
  }

  accept(data) {
    if (data.room.revision < this.lastRevision) return;
    this.failures = 0;
    this.snapshot = data;
    this.lastRevision = data.room.revision;
    this.setConnection('connected');
    this.onSnapshot?.(data);
  }

  // Seats this device in a room the server just created or joined.
  enter(data) {
    this.disconnect(false);
    this.credentials = { code: data.room.code, token: data.token };
    writeSeat(this.credentials);
    this.accept(data);
    this.schedule();
  }

  async create(name, faction, seed) {
    this.enter(await this.request('', { name, faction, seed }));
  }

  async join(code, name, faction) {
    const clean = normalizeRoomCode(code);
    if (!ROOM_CODE.test(clean)) throw roomError(ROOM_MESSAGES.code, 400);
    this.enter(await this.request(`/${clean}/join`, { name, ...(faction ? { faction } : {}) }));
  }

  savedRoomCode() {
    const seat = readSeat();
    return validSeat(seat) ? seat.code : null;
  }

  forget() { clearSeat(); }

  // Reconnects to the seat saved on this device. Resolves false when none is saved.
  async resume() {
    const seat = readSeat();
    if (!validSeat(seat)) {
      clearSeat();
      return false;
    }
    this.disconnect(false);
    this.credentials = { code: seat.code, token: seat.token };
    writeSeat(this.credentials);
    try {
      await this.poll(true);
    } catch (error) {
      const ended = [401, 404].includes(error.status);
      this.disconnect(ended);
      throw ended ? roomError(ROOM_MESSAGES.ended, error.status) : error;
    }
    if (this.snapshot?.you?.away) await this.back().catch(error => this.onError?.(error.message));
    return this.connected;
  }

  async command(name, body) {
    const generation = this.generation;
    this.setBusy(true);
    try {
      const data = await this.request(`/${this.credentials.code}/${name}`, body);
      if (generation === this.generation) this.accept(data);
      return data;
    } finally {
      if (generation === this.generation) this.setBusy(false);
    }
  }

  async start() {
    if (!this.credentials || this.busy) return;
    await this.command('start', { revision: this.snapshot.room.revision });
  }

  // Ends "away": the server skips an away seat's turns until its player is back.
  async back() {
    if (!this.credentials || this.busy) return;
    await this.command('back', {});
  }

  // Asks the server to settle an expired turn now instead of at the next poll.
  async skip() {
    if (!this.credentials) return;
    const generation = this.generation;
    const data = await this.request(`/${this.credentials.code}`);
    if (generation === this.generation && data && data.room.revision > this.lastRevision) this.accept(data);
  }

  perform(action) {
    if (this.busy) {
      this.onError?.(ROOM_MESSAGES.busy);
      return { ok: false };
    }
    if (!this.myTurn) {
      this.onError?.(this.connectionStatus === 'reconnecting' ? ROOM_MESSAGES.reconnecting : ROOM_MESSAGES.waitTurn);
      return { ok: false };
    }
    const generation = this.generation;
    this.setBusy(true);
    this.request(`/${this.credentials.code}/action`, { action, revision: this.snapshot.room.revision })
      .then(data => {
        if (generation === this.generation) this.accept({ ...data, confirmedAction: action.type });
      })
      .catch(error => {
        if (generation !== this.generation) return;
        if ([401, 404].includes(error.status)) {
          this.disconnect(true);
          this.onError?.(ROOM_MESSAGES.ended);
        } else {
          this.onError?.(error.status === 409 ? ROOM_MESSAGES.stale : error.message);
        }
      })
      .finally(() => {
        if (generation !== this.generation) return;
        this.setBusy(false);
        this.schedule();
      });
    return { ok: false, pending: true };
  }

  schedule(delay) {
    clearTimeout(this.timer);
    if (!this.connected) return;
    const backoff = Math.min(30_000, 2000 * 2 ** (this.failures - 1));
    const wait = delay ?? (this.failures ? backoff : isHidden() ? 15_000 : 250);
    this.timer = setTimeout(() => this.poll(), wait);
  }

  // Single-flight long-poll: the running request schedules its successor. The URL
  // never changes (the revision travels in headers), which keeps the browser's
  // CORS preflight cache warm.
  async poll(force = false) {
    if (!this.credentials) return;
    if (this.busy) {
      this.schedule(1000);
      return;
    }
    if (this.polling) return;
    this.polling = true;
    const generation = this.generation;
    const since = !force && this.lastRevision >= 0;
    const live = since && !isHidden();
    const started = Date.now();
    let delay;
    try {
      const headers = since ? { 'X-Room-Since': String(this.lastRevision), ...(live ? { 'X-Room-Wait': '1' } : {}) } : {};
      const data = await this.request(`/${this.credentials.code}`, undefined, {
        timeout: live ? LONG_POLL_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
        headers,
      });
      if (generation !== this.generation) return;
      if (data === null) this.holdsPolls = true;
      const changed = !!data && (force || data.room.revision > this.lastRevision);
      if (changed) this.accept(data);
      else if (this.connectionStatus !== 'connected') {
        this.failures = 0;
        this.setConnection('connected');
      }
      if (data) {
        // An unchanged 200 is our own order waking the poll, or a host without X-Room-Since.
        delay = changed ? this.updateGapMs : this.holdsPolls ? 250 : 2000;
      } else if (live && Date.now() - started < 5000) {
        delay = 2000; // the host answered without holding the request
      }
    } catch (error) {
      if (generation !== this.generation) return;
      if ([401, 404].includes(error.status) && !force) {
        this.disconnect(true);
        this.onError?.(ROOM_MESSAGES.ended);
        return;
      }
      this.failures++;
      this.setConnection('reconnecting');
      if (force) throw error;
    } finally {
      if (generation === this.generation) {
        this.polling = false;
        if (this.connected) this.schedule(delay);
      }
    }
  }

  handleVisibility() {
    if (isHidden() || !this.connected) return;
    if (this.snapshot?.you?.away && !this.busy) this.back().catch(error => this.onError?.(error.message));
    else if (!this.polling) this.schedule(0);
  }

  async leave() {
    if (this.credentials) {
      // Current servers ignore the revision; older hosts still require it.
      const body = this.snapshot ? { revision: this.snapshot.room.revision } : {};
      try {
        await this.request(`/${this.credentials.code}/leave`, body);
      } catch (error) {
        if (![401, 404].includes(error.status)) throw error;
      }
    }
    this.disconnect(true);
  }

  disconnect(forget = false) {
    this.generation++;
    clearTimeout(this.timer);
    this.credentials = null;
    this.snapshot = null;
    this.lastRevision = -1;
    this.failures = 0;
    this.polling = false;
    this.setBusy(false);
    if (forget) clearSeat();
    this.setConnection('offline');
  }

  inviteURL() {
    if (!this.credentials) return '';
    const url = new URL('./', inviteBase());
    url.hash = `room=${this.credentials.code}`;
    return url.href;
  }
}
