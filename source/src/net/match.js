// v4.6 Auto match: a free, anonymous queue on the Cloudflare Worker (WebSocket /m). The server pairs players who search at the same time and
// tells the first one to host; everything after that is the normal room flow (WebRTC / relay). See docs/MATCHMAKING.md.
// States: idle | connecting | searching | found | hosting | joining | joined | offline
// v4.6.2: this object is the single authority for the Auto match handoff. The host waits generously for every matched player (and longer
// while one is still mid-handshake); a guest only counts as 'joined' once the host has welcomed it, retries once through the relay,
// and if it still can't get in it says so and searches again with a fresh timer (it never quietly starts a bots match alone).
import { Net } from './net.js';
import { relayBase } from './relay.js';
import { netCfg } from './rtc.js';
import { ONLINE_MODES, PRESET_NAMES, normCode, validCode } from './proto.js';
import { S } from '../save.js';
import { STORE } from '../flags.js';

const now = () => Date.now();
// v4.6.3: a lone player gets bots after 30 s (was 120 s); anyone who searches later is sent straight into that room (lobby or running match, taking over a bot)
export const FILL_DEFAULT = 30, FILL_MAX = 120, MM_V = 2, RETRY_MAX = 4, HOST_WAIT_MS = 45000, HOST_PEND_MS = 15000, FULL_PAUSE_MS = 1500, UNCONFIRMED_MS = 15000, JOIN_TRIES = 2;
const why = { 'reject:locked': 'That match had already started.', 'reject:full': 'That room was full.', 'no-room': 'Could not reach the other player\u2019s room.', nat: 'Your network blocked the connection.', 'no-signal': 'The room service could not be reached.', host: 'The other player could not open a room.', slow: 'The room took too long to open.', alone: 'Could not reach the other players.', left: 'The host left.', lost: 'Lost the connection to the room.' };
export const failText = (c) => (why[c] || 'Could not join the room.') + ' Searching again...';
export const Match = {
  state: 'idle', mode: 'classic', n: 1, expect: 0, t0: 0, deadline: 0, bots: 0, note: '', ws: null, hb: 0, tries: 0, onChange: null, ui: null, app: null, _w: 0, _seq: 0, role: '', code: '', lastErr: '', okGot: false, openSent: false, joinTry: 0, hostLeft: 0, diag: [], names: [], late: false, retries: 0, room: null,
  get active() { return this.state !== 'idle' && this.state !== 'offline'; },
  available() { return typeof WebSocket !== 'undefined' && !!relayBase(); },
  // search length in seconds: 120 by default; tests/live checks can shorten it with window.__bbNet.mmFill or ?mmfill= (the server clamps to 5..120 s)
  fillSec() { let v = Number(netCfg().mmFill); try { const q = STORE ? null : new URLSearchParams(location.search).get('mmfill'); if (q) v = Number(q); } catch (e) {} return Number.isFinite(v) && v > 0 ? Math.max(5, Math.min(FILL_MAX, v)) : FILL_DEFAULT; },
  emit() { this.onChange && this.onChange(this.state); },
  set(st, note) { this.state = st; if (note !== undefined) this.note = note; this.emit(); },
  tx(o) { try { this.ws && this.ws.readyState === 1 && this.ws.send(JSON.stringify(o)); } catch (e) {} },
  // strangers only ever see a preset (friendly, filtered) name, never free text
  anonName() { const n = S().settings.onlineName; return PRESET_NAMES.includes(n) ? n : PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)]; },
  clearName() { Net.forceName = null; },
  start(mode, o = {}) {
    this.close(); this._seq++; this.avoid = o.avoid || []; this.late = false; this.lateMatch = false; this.names = []; if (!o.retry) this.retries = 0; this.role = ''; this.code = ''; this.okGot = false; this.openSent = false; this.joinTry = 0; this.hostLeft = 0; this.mode = ONLINE_MODES.includes(mode) ? mode : 'classic'; this.n = 1; this.expect = 0; this.bots = 0; this.note = ''; this.tries = o.tries || 0;
    if (!o.keepName || !Net.forceName) Net.forceName = this.anonName();
    const fill = o.fill || this.fillSec(); if (!o.keep) { this.t0 = now(); this.deadline = this.t0 + fill * 1000; }
    this.log('search'); this.set('connecting'); this.connect(Math.max(5, Math.ceil((this.deadline - now()) / 1000)));
  },
  connect(fillS) {
    const seq = this._seq; let ws, opened = false;
    // v4.6.3: could not reach the queue: retry by itself (2, 4, 6, 8 s) with the reason + diagnostic code on screen, only then show the offline screen
    const bail = (why) => { if (seq !== this._seq) return; this.log('mm-bail', why); if (!opened || this.state === 'connecting') { this.closeWs(); this.lastErr = why || 'unreachable';
      if (this.retries < RETRY_MAX) { this.retries++; const w = 2 * this.retries; this.set('connecting', `Connection problem (code ${this.dcode()}). Retrying in ${w}s... (${this.retries}/${RETRY_MAX})`); setTimeout(() => { if (seq === this._seq) { const n = this.note; this.start(this.mode, { keepName: true, retry: true }); this.note = n; this.emit(); } }, w * 1000); }
      else this.set('offline', why || 'unreachable'); } };
    try { ws = new WebSocket(relayBase() + '/m'); } catch (e) { return bail('unreachable'); }
    this.ws = ws; const tm = setTimeout(() => { if (!opened) bail('timeout'); }, 7000);
    ws.onopen = () => { opened = true; clearTimeout(tm); if (seq !== this._seq) return; this.log('mm-open'); ws.send(JSON.stringify({ t: 'q', mode: this.mode, fill: fillS, v: MM_V, cid: Net.cid, nm: Net.forceName || '', skip: this.avoid || [] })); this.hb = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 20000); this.set('searching'); };
    ws.onerror = () => { clearTimeout(tm); bail('unreachable'); };
    ws.onmessage = (ev) => { if (seq !== this._seq || typeof ev.data !== 'string' || ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.msg(m); };
    ws.onclose = (e) => { clearTimeout(tm); clearInterval(this.hb); if (seq !== this._seq || ws !== this.ws) return; this.ws = null; this.log('mm-close', (e && e.code) + ' ' + this.state);
      if (this.state === 'searching' || this.state === 'found') { // dropped while waiting: one quiet retry with the time that is left, then offline
        if (this.tries < 2 && now() < this.deadline - 3000) { this.tries++; setTimeout(() => { if (seq === this._seq && (this.state === 'searching' || this.state === 'found')) this.start(this.mode, { keep: true, keepName: true, tries: this.tries, fill: 1 }); }, 800); } else this.set('offline', 'dropped'); }
      else if (this.room) { this.log('room-ws', e && e.code); this.room = null; } // the open-room beacon dropped: the room keeps working, it just takes no more late players
      else if (this.state === 'hosting') { // the server closes the host's queue socket right after 'ok'; any other close means the handoff broke
        if (this.okGot) return; this.log('mm-closed', this.openSent ? 'after-open' : 'before-open');
        if (!this.openSent) { if (Net.active && !this.opening) return this.requeue(seq, 'slow'); } // server gave up waiting (the guests were already put back in the queue)
        else this.unconfirmed = true; } // 'open' was sent but not confirmed: the guests may still come; watch() gives up if nobody arrives
      };
  },
  msg(m) {
    if (m.t === 'st') { this.n = Math.max(1, Math.min(4, m.n | 0)); if (Array.isArray(m.names)) this.names = m.names.slice(0, 4).map((x) => String(x || '').slice(0, 16)); if (m.fillIn >= 0) this.deadline = now() + m.fillIn; if (this.state !== 'found') this.set('searching'); }
    if (m.t !== 'st') this.log('mm', m.t);
    if (m.t === 'found') { this.n = m.n | 0; this.late = !!m.late; if (Array.isArray(m.names)) this.names = m.names.slice(0, 4).map((x) => String(x || '').slice(0, 16)); this.set('found', m.late ? 'Found a room with a free seat! Joining...' : 'Match found!'); }
    else if (m.t === 'inc') { this.log('inc', m.nm || ''); this.incAt = now(); if (this.state === 'hosting') this.expect = Math.min(3, this.expect + 1); }
    else if (m.t === 'requeue') { this.log('requeue'); this.set('searching', 'The other player could not open the room. Finding another match...'); this.dropRoom(); }
    else if (m.t === 'ok') { this.okGot = true; this.log('ok'); }
    else if (m.t === 'host') { if (ONLINE_MODES.includes(m.mode)) this.mode = m.mode; this.becomeHost(String(m.code || ''), m.expect | 0); } // one queue for all modes: the host's pick (sent back by the server) decides
    else if (m.t === 'go') { this.late = this.late || !!m.late; this.lateMatch = m.ph === 'match'; this.becomeGuest(String(m.code || '')); }
    else if (m.t === 'err') this.set('offline', m.r || 'error');
  },
  dropRoom() { if (Net.active) { try { Net.leave(); } catch (e) {} } },
  async becomeHost(code, expect) {
    const seq = this._seq; this.expect = expect; this.role = 'host'; this.code = code; this.unconfirmed = false; this.log('host', code + ' expect ' + expect); this.set('hosting', 'Match found! Opening the room...');
    this.opening = true; let r = null;
    try { if (!validCode(normCode(code))) throw new Error('code'); r = await Net.host({ code }); } catch (e) { this.opening = false; if (seq === this._seq) { this.tx({ t: 'fail' }); if (Net.active) try { Net.leave(); } catch (x) {} this.lastErr = 'host'; this.log('host-fail', e && e.message); this.set('searching', 'Could not open the room. Searching again...'); } return; }
    this.opening = false;
    if (seq !== this._seq) { try { Net.leave(); } catch (e) {} return; }
    if (!r || !r.signal) { this.tx({ t: 'fail' }); return this.requeue(seq, 'host'); } // no room service: the guests could never find this room
    if (!this.ws || this.ws.readyState !== 1) return this.requeue(seq, 'slow'); // the server already gave up on this room and re-queued the guests
    if (Net.H) Net.H.auto = true; // an Auto room: late players may take over a bot even after the match started
    Net.setSetting('mode', this.mode); this.tx({ t: 'open' }); this.openSent = true; this.openedAt = now(); this.log('open'); this.ui && this.ui.afterRoom(); this.watch(seq); this.beacon(seq, Net.code);
  },
  // host: start when every matched player is in (short pause), or after HOST_WAIT_MS; empty seats are filled by bots (the room's normal bot fill)
  watch(seq) {
    clearInterval(this._w); let fullAt = 0; this.pendSeen = 0;
    this._w = setInterval(() => {
      if (seq !== this._seq) return clearInterval(this._w);
      if (!Net.isHost) { clearInterval(this._w); this.set('idle'); this.clearName(); return; }
      if (Net.phase !== 'lobby') { if (Net.phase === 'match') clearInterval(this._w); return; }
      const hum = Net.H.slots.filter((p) => p && p.conn).length; const want = 1 + this.expect; const waited = now() - this.openedAt;
      if (Net.H.pend.size && !this.pendSeen) this.pendSeen = now(); // someone is mid-handshake: give them extra time (once)
      const limit = Math.max(HOST_WAIT_MS + (this.pendSeen ? HOST_PEND_MS : 0), this.incAt ? this.incAt - this.openedAt + 20000 : 0); // a late player on the way gets 20 s
      if (this.unconfirmed && hum <= 1 && waited > UNCONFIRMED_MS) { clearInterval(this._w); return this.requeue(seq, 'alone'); }
      if (hum >= want && !fullAt) fullAt = now(); if (hum < want) fullAt = 0;
      const full = hum >= want && fullAt && now() - fullAt > (this.expect ? FULL_PAUSE_MS : 600); const late = waited > limit;
      this.hostLeft = Math.max(0, Math.ceil((limit - waited) / 1000)); const miss = want - hum;
      const st = miss <= 0 ? 'Everyone is here! Starting...' : `Waiting for ${miss} more player${miss > 1 ? 's' : ''}... bots fill in ${this.hostLeft}s (or tap START)`;
      if (Net.status !== st) Net.setStatus(st); // updated in place: no lobby re-render (v4.6.1 re-rendered the lobby 4x a second here = the flicker)
      if ((full || late) && Net.canStart()) { clearInterval(this._w); this.bots = Math.max(0, 4 - hum); this.log('start', hum + ' humans ' + this.bots + ' bots' + (late ? ' (timeout)' : '')); this.set('idle'); if (this.bots) this.ui && this.ui.botsToast(this.bots); Net.startMatch(); }
    }, 250);
  },
  // v4.6.3 host: keep the queue socket open while this Auto room lives and report how many seats a late player could take (server sends them here)
  beacon(seq, code) {
    clearInterval(this._b); if (!this.ws || this.ws.readyState !== 1) return; this.room = { code, last: '', at: 0 }; const t0 = now();
    const ws = this.ws; this.ws = null; this.roomWs = ws; // the room socket is no longer the search socket (a new search must not close it by accident)
    ws.onclose = () => { clearInterval(this._b); if (this.roomWs === ws) { this.roomWs = null; this.room = null; this.log('room-ws', 'closed'); } };
    ws.onmessage = (ev) => { if (typeof ev.data !== 'string' || ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'inc') this.msg(m); };
    const hb = setInterval(() => { if (ws.readyState === 1) try { ws.send('ping'); } catch (e) {} else clearInterval(hb); }, 20000);
    this._b = setInterval(() => {
      const gone = !Net.isHost || Net.code !== code || now() - t0 > 19 * 60000;
      if (gone) { clearInterval(this._b); clearInterval(hb); this.endRoom(ws); return; }
      const s = Net.autoSeats(); const k = s.free + s.ph;
      if (k !== this.room.last || now() - this.room.at > 15000) { this.room.last = k; this.room.at = now(); try { ws.send(JSON.stringify({ t: 'seats', free: s.free, ph: s.ph, ack: 0 })); } catch (e) {} }
    }, 1000);
  },
  endRoom(ws) { ws = ws || this.roomWs; clearInterval(this._b); this.room = null; if (this.roomWs === ws) this.roomWs = null; if (!ws) return; ws.onclose = ws.onmessage = null; try { if (ws.readyState === 1) { ws.send(JSON.stringify({ t: 'closed' })); ws.close(1000); } } catch (e) {} },
  async becomeGuest(code, attempt = 0) {
    const seq = this._seq; this.role = 'guest'; this.code = code; this.joinTry = attempt; this.log('join', code + (attempt ? ' retry via relay' : '')); this.closeWs();
    this.set('joining', attempt ? 'Still connecting... trying the relay again' : this.lateMatch ? 'Joining a match in progress...' : 'Match found! Joining the room...');
    if (!validCode(normCode(code))) return this.joinFailed(seq, 'no-room');
    this.ui && this.ui.afterGo();
    try { await Net.join(normCode(code), { auto: true, relayFirst: attempt > 0 }); } catch (e) { this.joinFailed(seq, e && e.message); }
  },
  // a guest is 'joined' only once the host has welcomed it into the room (Net.phase 'lobby')
  welcomed() { if (this.state === 'joining' && Net.isGuest && Net.phase === 'lobby') { this.log('welcome', Net.conType); this.set('joined', ''); return true; } return false; },
  joinFailed(seq, code) {
    if (seq !== this._seq) return; this.lastErr = code || 'error'; this.log('join-fail', this.lastErr);
    if (Net.active) { try { Net.leave(); } catch (e) {} }
    const fatal = code === 'reject:version' || code === 'reject:full' || code === 'reject:locked' || code === 'no-webrtc';
    if (!fatal && this.joinTry + 1 < JOIN_TRIES && relayBase()) { this.note = 'Still connecting...'; this.emit(); const c = this.code, t = this.joinTry + 1; setTimeout(() => { if (seq === this._seq) this.becomeGuest(c, t); }, 700); return; }
    this.requeue(seq, code);
  },
  // the app calls this for every Net error; returns true when Auto match handled it (re-search instead of showing an error screen)
  netError(err, wasJoin) {
    if (this.state !== 'joining' && this.state !== 'joined') return false;
    const started = (Net.stat && Net.stat.snaps > 0) || Net.phase === 'match' || Net.phase === 'results'; if (started || (err && (err.code === 'reject:version'))) return false;
    const c = err && err.code; this.lastErr = c === 'ended' ? (err.canRejoin ? 'lost' : 'left') : c;
    if (c === 'ended' && err.canRejoin) { this.state = 'joining'; return this.joinFailed(this._seq, 'lost'), true; } // link dropped in the lobby (flaky direct path): try again through the relay
    if (this.state === 'joined' || c === 'ended') this.requeue(this._seq, 'left'); else this.joinFailed(this._seq, c); return true;
  },
  // the handoff failed for good: leave any room, tell the player why, and search again with a fresh timer (never a silent solo match)
  requeue(seq, code) {
    if (seq !== this._seq) return; this.lastErr = code || this.lastErr; this.log('requeue-self', code); clearInterval(this._w); if (Net.active) { try { Net.leave(); } catch (e) {} }
    const avoid = (this.code ? [...(this.avoid || []), this.code] : this.avoid || []).slice(-3); // v4.6.3: never be sent back into a room we just failed to reach
    this.start(this.mode, { keepName: true, tries: 0, avoid }); this.note = failText(code); this.emit();
  },
  syncNet() { this.welcomed(); if (this.state === 'joined' && Net.phase === 'match') { this.state = 'idle'; this.log('match'); } }, // the match began: the room flow owns everything from here
  // anonymous diagnostics for the lobby "connection details" panel: no names, ids or addresses
  // v4.6.3: a short code the player can read out when something goes wrong: version-state-players-lastError-link, e.g. 463-S2-TO-R
  dcode() { const st = { idle: 'I', connecting: 'C', searching: 'S', found: 'F', hosting: 'H', joining: 'J', joined: 'D', offline: 'O' }[this.state] || 'X';
    const e = { unreachable: 'UR', timeout: 'TO', dropped: 'DR', host: 'HF', slow: 'SL', alone: 'AL', left: 'LF', lost: 'LO', 'no-room': 'NR', nat: 'NT', 'no-signal': 'NS', 'reject:locked': 'LK', 'reject:full': 'FL', 'reject:version': 'VR', mode: 'MD', error: 'ER', nowebrtc: 'NW', 'no-webrtc': 'NW' }[this.lastErr] || (this.lastErr ? 'E' + String(this.lastErr).slice(0, 2).toUpperCase() : 'OK');
    const via = { relay: 'R', direct: 'D', mixed: 'M' }[Net.conType] || '-'; return `463-${st}${this.n | 0}-${e}-${via}${this.joinTry ? 'r' : ''}${this.retries ? 'x' + this.retries : ''}`; },
  log(ev, d) { this.diag.push({ t: now(), ev, d: d === undefined ? '' : String(d).slice(0, 40) }); if (this.diag.length > 24) this.diag.shift(); },
  closeWs() { clearInterval(this.hb); const w = this.ws; this.ws = null; if (w) { w.onclose = w.onerror = w.onmessage = null; if (w.readyState === 1) try { w.send(JSON.stringify({ t: 'bye' })); } catch (e) {} try { w.close(1000); } catch (e) {} } },
  close() { clearInterval(this._w); this.closeWs(); },
  // leaving the room (Cancel, Back, a new search) also closes its open-room beacon

  cancel() { this._seq++; this.close(); this.endRoom(); this.dropRoom(); this.clearName(); this.state = 'idle'; this.note = ''; this.emit(); },
  // seconds helpers for the UI
  elapsed() { return Math.max(0, Math.floor((now() - this.t0) / 1000)); }, fillLeft() { return Math.max(0, Math.ceil((this.deadline - now()) / 1000)); },
};
