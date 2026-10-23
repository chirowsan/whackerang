// v4.6 Auto match: a free, anonymous queue on the Cloudflare Worker (WebSocket /m). The server pairs players who search at the same time and
// tells the first one to host; everything after that is the normal room flow (WebRTC / relay). See docs/MATCHMAKING.md.
// States: idle | connecting | searching | found | hosting | joining | joined | offline
import { Net } from './net.js';
import { relayBase } from './relay.js';
import { netCfg } from './rtc.js';
import { ONLINE_MODES, PRESET_NAMES, normCode, validCode } from './proto.js';
import { S } from '../save.js';

const now = () => Date.now();
export const FILL_DEFAULT = 120, HOST_WAIT_MS = 12000, FULL_PAUSE_MS = 1500;
export const Match = {
  state: 'idle', mode: 'classic', n: 1, expect: 0, t0: 0, deadline: 0, bots: 0, note: '', ws: null, hb: 0, tries: 0, onChange: null, ui: null, app: null, _w: 0, _seq: 0,
  get active() { return this.state !== 'idle' && this.state !== 'offline'; },
  available() { return typeof WebSocket !== 'undefined' && !!relayBase(); },
  // search length in seconds: 120 by default; tests/live checks can shorten it with window.__bbNet.mmFill or ?mmfill= (the server clamps to 5..120 s)
  fillSec() { let v = Number(netCfg().mmFill); try { const q = new URLSearchParams(location.search).get('mmfill'); if (q) v = Number(q); } catch (e) {} return Number.isFinite(v) && v > 0 ? Math.max(5, Math.min(FILL_DEFAULT, v)) : FILL_DEFAULT; },
  emit() { this.onChange && this.onChange(this.state); },
  set(st, note) { this.state = st; if (note !== undefined) this.note = note; this.emit(); },
  tx(o) { try { this.ws && this.ws.readyState === 1 && this.ws.send(JSON.stringify(o)); } catch (e) {} },
  // strangers only ever see a preset (friendly, filtered) name, never free text
  anonName() { const n = S().settings.onlineName; return PRESET_NAMES.includes(n) ? n : PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)]; },
  clearName() { Net.forceName = null; },
  start(mode, o = {}) {
    this.close(); this._seq++; this.mode = ONLINE_MODES.includes(mode) ? mode : 'classic'; this.n = 1; this.expect = 0; this.bots = 0; this.note = ''; this.tries = o.tries || 0;
    if (!o.keepName || !Net.forceName) Net.forceName = this.anonName();
    const fill = o.fill || this.fillSec(); if (!o.keep) { this.t0 = now(); this.deadline = this.t0 + fill * 1000; }
    this.set('connecting'); this.connect(Math.max(5, Math.ceil((this.deadline - now()) / 1000)));
  },
  connect(fillS) {
    const seq = this._seq; let ws, opened = false;
    const bail = (why) => { if (seq !== this._seq) return; if (!opened || this.state === 'connecting') { this.closeWs(); this.set('offline', why || 'unreachable'); } };
    try { ws = new WebSocket(relayBase() + '/m'); } catch (e) { return bail('unreachable'); }
    this.ws = ws; const tm = setTimeout(() => { if (!opened) bail('timeout'); }, 7000);
    ws.onopen = () => { opened = true; clearTimeout(tm); if (seq !== this._seq) return; ws.send(JSON.stringify({ t: 'q', mode: this.mode, fill: fillS, v: 1 })); this.hb = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 20000); this.set('searching'); };
    ws.onerror = () => { clearTimeout(tm); bail('unreachable'); };
    ws.onmessage = (ev) => { if (seq !== this._seq || typeof ev.data !== 'string' || ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.msg(m); };
    ws.onclose = () => { clearTimeout(tm); clearInterval(this.hb); if (seq !== this._seq || ws !== this.ws) return; this.ws = null;
      if (this.state === 'searching' || this.state === 'found') { // dropped while waiting: one quiet retry with the time that is left, then offline
        if (this.tries < 2 && now() < this.deadline - 3000) { this.tries++; setTimeout(() => { if (seq === this._seq && (this.state === 'searching' || this.state === 'found')) this.start(this.mode, { keep: true, keepName: true, tries: this.tries, fill: 1 }); }, 800); } else this.set('offline', 'dropped'); }
      else if (this.state === 'hosting' && !Net.active) this.set('offline', 'dropped'); };
  },
  msg(m) {
    if (m.t === 'st') { this.n = Math.max(1, Math.min(4, m.n | 0)); if (m.fillIn >= 0) this.deadline = now() + m.fillIn; if (this.state !== 'found') this.set('searching'); }
    else if (m.t === 'found') { this.n = m.n | 0; this.set('found', 'Match found!'); }
    else if (m.t === 'requeue') { this.set('searching', 'The host left. Finding another match...'); this.dropRoom(); }
    else if (m.t === 'host') this.becomeHost(String(m.code || ''), m.expect | 0);
    else if (m.t === 'go') this.becomeGuest(String(m.code || ''));
    else if (m.t === 'err') this.set('offline', m.r || 'error');
  },
  dropRoom() { if (Net.active) { try { Net.leave(); } catch (e) {} } },
  async becomeHost(code, expect) {
    const seq = this._seq; this.expect = expect; this.role = 'host'; this.set('hosting', 'Match found! Opening the room...');
    try { if (!validCode(normCode(code))) throw new Error('code'); await Net.host({ code }); } catch (e) { if (seq === this._seq) { this.tx({ t: 'fail' }); if (Net.active) try { Net.leave(); } catch (x) {} this.set('searching', 'Could not open the room. Searching again...'); } return; }
    if (seq !== this._seq) { try { Net.leave(); } catch (e) {} return; }
    Net.setSetting('mode', this.mode); this.tx({ t: 'open' }); this.openedAt = now(); this.ui && this.ui.afterRoom(); this.watch(seq);
  },
  // host: start when every matched player is in (short pause), or after HOST_WAIT_MS; empty seats are filled by bots (the room's normal bot fill)
  watch(seq) {
    clearInterval(this._w); let fullAt = 0;
    this._w = setInterval(() => {
      if (seq !== this._seq) return clearInterval(this._w);
      if (!Net.isHost) { clearInterval(this._w); this.set('idle'); this.clearName(); return; }
      if (Net.phase !== 'lobby') { if (Net.phase === 'match') clearInterval(this._w); return; }
      const hum = Net.H.slots.filter((p) => p && p.conn).length; const want = 1 + this.expect;
      if (hum >= want && !fullAt) fullAt = now(); const full = hum >= want && now() - fullAt > (this.expect ? FULL_PAUSE_MS : 600); const late = now() - this.openedAt > HOST_WAIT_MS;
      Net.setStatus(hum >= want ? 'Everyone is here. Starting...' : `Waiting for players... ${hum}/${want}`); Net.emit();
      if ((full || late) && Net.canStart()) { clearInterval(this._w); this.bots = Math.max(0, 4 - hum); this.set('idle'); if (this.bots) this.ui && this.ui.botsToast(this.bots); Net.startMatch(); }
    }, 250);
  },
  async becomeGuest(code) {
    const seq = this._seq; this.role = 'guest'; this.set('joining', 'Match found! Joining...'); this.closeWs();
    if (!validCode(normCode(code))) return this.rejoinFailed(seq);
    this.ui && this.ui.afterGo();
    try { await Net.join(normCode(code)); if (seq === this._seq) this.set('joined'); } catch (e) { this.rejoinFailed(seq); }
  },
  // the app calls this for every Net error; returns true when Auto match handled it (re-search instead of showing an error screen)
  netError(err, wasJoin) {
    if (this.state !== 'joining' && this.state !== 'joined') return false;
    const started = (Net.stat && Net.stat.snaps > 0) || Net.phase === 'match' || Net.phase === 'results'; if (started || (err && (err.code === 'reject:version'))) return false;
    this.rejoinFailed(this._seq, 'The host left. Finding another match...'); return true;
  },
  rejoinFailed(seq, note) { if (seq !== this._seq) return; this.start(this.mode, { keep: true, keepName: true, tries: this.tries + 1, fill: 1 }); this.note = note || 'Could not join. Searching again...'; this.emit(); },
  syncNet() { if (this.state === 'joined' && Net.phase === 'match') this.state = 'idle'; }, // the match began: the room flow owns everything from here
  closeWs() { clearInterval(this.hb); const w = this.ws; this.ws = null; if (w) { w.onclose = w.onerror = w.onmessage = null; if (w.readyState === 1) try { w.send(JSON.stringify({ t: 'bye' })); } catch (e) {} try { w.close(1000); } catch (e) {} } },
  close() { clearInterval(this._w); this.closeWs(); },
  cancel() { this._seq++; this.close(); this.dropRoom(); this.clearName(); this.state = 'idle'; this.note = ''; this.emit(); },
  // seconds helpers for the UI
  elapsed() { return Math.max(0, Math.floor((now() - this.t0) / 1000)); }, fillLeft() { return Math.max(0, Math.ceil((this.deadline - now()) / 1000)); },
};
