// Online session: room codes, lobby, host-authoritative match flow, guest mirror, disconnect handling, validation and rate limits.
// Topology: star. The host's device runs the only real simulation; guests send inputs and render snapshots.
import { PROTO, MAX_PLAYERS, ID_PREFIX, GUEST_PREFIX, makeCode, normCode, validCode, rid, safeName, shareLink, ONLINE_MODES, TEAM_MODES, LOBBY_EMOJI } from './proto.js';
import { Signal, Link, rtcSupported, relayUrl, netCfg } from './rtc.js';
import { RelayHub, RelayConn, RelayGuestLink, relayOn } from './relay.js';
import { BinWriter, BinReader, enc, dec } from './bin.js';
import { PK, STEP, FxRecorder, GuestWorld, encodeFast, encodeCrates, encodeHoles, encodeItems, encodeTraps, slowSig } from './world.js';
import { HEROES, HATS, ARENAS, MODES, TRAILS, SKINS, EMOTES, PERSONAS, PLAYER_COLORS } from '../data.js';
import { S, save, SPEEDS } from '../save.js';
import { Input } from '../input.js';
import { Bot } from '../ai.js';
import { fx } from '../fx.js';
import { sfx } from '../audio.js';
import { todayMutator } from '../mutators.js';
import { track, addCoins, addXp, levelInfo } from '../progress.js';
import { shuffle, pick, CD_LEN } from '../util.js';

const SNAP_N = 3;                    // sim steps per snapshot: 3 -> 20 Hz
const SNAP_N_RELAY = 5;              // v4.3 low-bandwidth mode when anybody is on the relay: 12 Hz (guests also send inputs at 15 Hz)
const DIRECT_MS = 5500;              // v4.3: how long a guest tries a direct WebRTC link before falling back to the relay
export const ONLINE_COIN_CAP = 60, ONLINE_XP_CAP = 100, ONLINE_DAY_CAP = 300, ONLINE_MIN_TIME = 25;
const IN_MAX = 64;                   // fast packet max bytes accepted from a guest
const now = () => performance.now();
const tag = (nm) => { nm = String(nm || 'P'); const w = nm.split(' ')[0]; return (nm.length <= 9 ? nm : w).toUpperCase(); };
const hexOk = (id, list) => list.includes(id);

export const Net = {
  app: null, UI: null, active: false, role: null, code: '', phase: 'idle', status: '', error: null, signalOk: false,
  lobby: { players: [], settings: null }, mySlot: 0, cid: rid(12), pings: {}, rtt: 0, rttMax: 0,
  onUpdate: null, onEmote: null, onError: null, onStatus: null, msgs: [], notes: [],
  H: null, G: null, input: null, world: null, stat: { snaps: 0, snapBytes: 0, t0: 0, rate: 0, kbpsDown: 0, kbpsUp: 0 }, wasInRoom: false,

  init(app, UI) { this.app = app; this.UI = UI; },
  get isHost() { return this.active && this.role === 'host'; },
  get isGuest() { return this.active && this.role === 'guest'; },
  emit() { this.onUpdate && this.onUpdate(); },
  setStatus(s) { this.status = s; this.onStatus && this.onStatus(s); },
  me() { return this.lobby.players.find((p) => p.slot === this.mySlot) || null; },
  profile() { const s = S(); const hero = HEROES.some((h) => h.id === s.hero) ? s.hero : 'bao'; return { name: s.settings.onlineName || null, hero, hat: s.hats[hero] || 'none', skin: s.eq.skin, trail: s.eq.trail }; },
  defaultSettings() { return { mode: 'classic', arena: 'random', size: 'small', traps: 'some', events: 'some', speed: 'chill', rounds: 3, bots: true, diff: 1, mutator: 'off' }; },

  // ================================================================== HOST
  async host(opts = {}) {
    if (this.active) return; if (!rtcSupported()) throw new Error('no-webrtc');
    this.reset(); this.active = true; this.role = 'host'; this.phase = 'lobby'; this.app.net = this; this.error = null;
    const pr = this.profile(); const name = safeName(pr.name);
    const H = this.H = { sig: null, peers: new Map(), pend: new Map(), slots: [null, null, null, null], settings: this.defaultSettings(), tick: 0, seq: 0, snapN: 0, rec: new FxRecorder(), ids: { bid: 0, pid: 0, cid: 0 }, sigSeq: { crates: 0, holes: 0, items: 0, traps: 0 }, sigLast: {}, fxPrev: null, fxSeq: 0, curCfg: null, kosTotal: {}, closed: false, rematch: new Set(), timers: [] };
    const me = { pid: 'host', slot: 0, cid: this.cid, name, ...pr, ready: true, team: 0, ping: 0, isHost: true, conn: true };
    H.slots[0] = me; H.peers.set('host', me); this.mySlot = 0;
    // make a room code on the signaling server (retry if taken); if the broker is unreachable the room still works through manual codes
    let ok = false, lastErr = null; const useRly = relayOn() && !opts.noRelay && !(netCfg().noRelayHost);
    const bindSig = (sig) => { H.sig = sig; sig.onmsg = (m) => this.hostSignal(m); sig.onclose = () => { H.sig = null; if (!H.closed) { this.signalOk = !!H.rly; this.setStatus(H.rly ? '' : 'Room link service dropped: friends already here stay connected. Reopen the lobby to invite more.'); this.emit(); } }; };
    const bindRly = (hub) => { H.rly = hub; hub.onjoin = (g) => this.hostRelayJoin(g); hub.onclose = () => { H.rly = null; if (!H.closed) { this.signalOk = !!H.sig; this.emit(); } }; };
    for (let i = 0; i < 6 && !ok; i++) {
      const code = opts.code || makeCode(); const sig = new Signal(ID_PREFIX + code, opts.relay); const hub = useRly ? new RelayHub(code) : null;
      let sOk = false, rOk = false, taken = false, sDone = false, rDone = !hub; const late = { sig: false, rly: false };
      sig.connect().then(() => { sOk = true; if (late.sig && !H.closed && this.code === code) bindSig(sig); }).catch((e) => { lastErr = e; if (e.message === 'id-taken') taken = true; }).finally(() => { sDone = true; });
      if (hub) hub.connect(6500).then(() => { rOk = true; if (late.rly && !H.closed && this.code === code) bindRly(hub); }).catch((e) => { if (e.message === 'taken') taken = true; }).finally(() => { rDone = true; });
      const t0 = now(); while (!(sDone && rDone) && !taken && !((sOk || rOk) && now() - t0 > 1800)) await new Promise((r) => setTimeout(r, 40));
      if (taken || !(sOk || rOk)) { sig.close(); hub && hub.close(); if (!taken || opts.code) break; continue; }
      ok = true; this.code = code; if (sOk) bindSig(sig); else late.sig = true; if (hub) { if (rOk) bindRly(hub); else late.rly = true; }
    }
    this.signalOk = ok; if (!ok) { this.code = 'MANUAL'; this.error = null; this.setStatus('Relay unreachable: share codes manually (see "Add friend by code")'); }
    this.syncLobby(); this.hostTimers(); this.emit();
    return { code: this.code, signal: ok, err: lastErr && lastErr.message };
  },
  hostTimers() {
    const H = this.H;
    H.timers.push(setInterval(() => { if (!this.isHost) return; const t = now(); for (const p of [...H.peers.values()]) { if (p.isHost || !p.link) continue; if (p.conn && t - p.lastRx > 6500) this.dropPeer(p, 'timeout'); else if (p.conn) { const w = new BinWriter(8); w.u8(PK.PING).u32(Math.round(t) >>> 0); p.link.send('fast', w.out()); } } this.pingTable(); }, 1000));
  },
  pingTable() { const H = this.H; const t = {}; for (const p of H.peers.values()) if (p.conn) t[p.slot] = p.isHost ? 0 : Math.round(p.ping); this.pings = t; if (this.phase !== 'lobby' || true) this.sendAll({ t: 'pings', p: t }); },
  // v4.3: a guest arrived through the Cloudflare relay (it could not, or did not, connect directly)
  hostRelayJoin(g) {
    const H = this.H; if (!H || H.closed || !H.rly) return; const pid = 'rl-' + g + '-' + rid(4);
    const rec = { pid, link: null, conn: false, lastRx: now(), acc: null, manual: false, relay: true };
    rec.link = H.rly.link(g, { onrel: (d) => this.hostRel(rec, d), onfast: (d) => this.hostFast(rec, d), onclose: (why) => { H.pend.delete(pid); this.dropPeer(rec, why); } });
    rec.opened = true; H.pend.set(pid, rec); setTimeout(() => { if (!rec.conn && H.pend.get(pid) === rec) { H.pend.delete(pid); rec.link.close(); } }, 15000);
  },
  fanout(kind, data, pred) { // one frame per relay room (bitmask of guests), one send per direct link
    const H = this.H; if (!H) return; let mask = 0;
    for (const p of H.peers.values()) { if (p.isHost || !p.conn || !p.link || (pred && !pred(p))) continue; if (p.link.relay) mask |= 1 << p.link.gid; else p.link.send(kind, data); }
    if (mask && H.rly) H.rly.sendMask(mask, kind, data);
  },
  relayPeers() { const H = this.H; if (!H) return false; for (const p of H.peers.values()) if (p.conn && p.link && p.link.relay) return true; return false; },
  get conType() { // 'direct' | 'relay' | 'mixed' | '' (host alone)
    if (this.G) return this.G.via || ''; const H = this.H; if (!H) return ''; let d = 0, r = 0; for (const p of H.peers.values()) { if (p.isHost || !p.conn || !p.link) continue; if (p.link.relay) r++; else d++; } return r && d ? 'mixed' : r ? 'relay' : d ? 'direct' : '';
  },
  hostSignal(m) {
    const H = this.H; if (!H || H.closed) return; const src = m.src;
    if (m.type === 'OFFER') {
      const joined = [...H.peers.values()].filter((p) => !p.isHost && p.conn).length; const pending = H.pend.size;
      if (!src || H.pend.has(src) || (H.peers.has(src) && H.peers.get(src).conn)) return;
      if (pending > 6) return; this.hostAccept(src, m.payload, (type, payload) => H.sig.send(type, src, payload));
    } else if (m.type === 'CANDIDATE') { const c = H.pend.get(src) || H.peers.get(src); if (c && c.acc) c.acc.cand(m.payload); }
    else if (m.type === 'LEAVE') { const c = H.peers.get(src); if (c && !c.conn) { H.pend.delete(src); } }
  },
  // shared by signaling and manual (copy/paste) joins. 'reply' sends answer/candidates back to the guest.
  hostAccept(pid, payload, reply, manual) {
    const H = this.H; if (!payload || !payload.sdp) return null;
    const rec = { pid, link: null, conn: false, lastRx: now(), acc: null, manual: !!manual }; H.pend.set(pid, rec);
    const queue = []; let haveRemote = false;
    rec.acc = { cand: (c) => { if (!c || !c.candidate) return; if (haveRemote && rec.link) rec.link.addCandidate(c.candidate || c); else queue.push(c.candidate || c); } };
    const link = rec.link = new Link({
      onice: (c) => { if (!manual) reply('CANDIDATE', { candidate: c, cid: payload.cid }); },
      onrel: (d) => this.hostRel(rec, d), onfast: (d) => this.hostFast(rec, d),
      onopen: () => { rec.opened = true; rec.lastRx = now(); },
      onclose: (why) => { H.pend.delete(pid); this.dropPeer(rec, why); },
    });
    setTimeout(() => { if (!rec.opened && H.pend.get(pid) === rec) { H.pend.delete(pid); link.close(); } }, 25000);
    return (async () => {
      try { const ans = await link.acceptOffer(payload.sdp); haveRemote = true; for (const c of queue) await link.addCandidate(c); if (!manual) reply('ANSWER', { sdp: ans, cid: payload.cid }); return ans; }
      catch (e) { H.pend.delete(pid); link.close(); return null; }
    })();
  },
  async hostManualOffer(desc) { // host side of the copy/paste flow: returns the answer description once ICE gathered
    const H = this.H; const pid = 'm-' + rid(6); const p = this.hostAccept(pid, { sdp: desc, cid: pid }, null, true); const ans = await p; const rec = H.pend.get(pid); if (!ans || !rec) return null; await rec.link.gathered(); return rec.link.pc.localDescription ? { type: rec.link.pc.localDescription.type, sdp: rec.link.pc.localDescription.sdp } : ans;
  },
  // ---- host: reliable (JSON) messages from a guest
  hostRel(p, d) {
    const H = this.H; if (typeof d !== 'string' || d.length > 2048) return; p.lastRx = now();
    p.tok = Math.min(40, (p.tok === undefined ? 40 : p.tok) + (now() - (p.tokT || now())) * 0.02); p.tokT = now(); if (p.tok < 1) { p.spam = (p.spam || 0) + 1; if (p.spam > 120) this.kick(p, 'spam'); return; } p.tok--;
    let m; try { m = JSON.parse(d); } catch (e) { return; } if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello') return this.hostHello(p, m);
    if (!p.conn) return; // everything else needs a seated player
    switch (m.t) {
      case 'ready': p.ready = !!m.r; this.syncLobby(); break;
      case 'prof': if (this.phase === 'lobby') { const from = p.autoFrom, to = p.autoTo; this.applyProfile(p, m); if (from && m.hero === from) { p.hero = to; p.hat = 'none'; } else p.autoFrom = null; this.syncLobby(); } break;
      case 'team': if (this.phase === 'lobby') { p.team = m.v === 1 ? 1 : 0; this.balanceTeams(); this.syncLobby(); } break;
      case 'emo': { const t = now(); if (t - (p.emoT || 0) < 900) break; p.emoT = t; const e = (m.e | 0); if (e >= 0 && e < LOBBY_EMOJI.length) { this.sendAll({ t: 'emo', s: p.slot, e }); this.onEmote && this.onEmote(p.slot, e); } break; }
      case 'emote': this.hostEmote(p, String(m.id || '')); break;
      case 'rematch': if (this.phase === 'results') { H.rematch.add(p.slot); this.syncLobby(); this.maybeRematch(); } break;
      case 'bye': this.dropPeer(p, 'left'); break;
    }
  },
  hostHello(p, m) {
    const H = this.H; if (p.conn || p.hello) return; p.hello = true;
    const send = (o) => p.link.send('rel', JSON.stringify(o));
    if (m.proto !== PROTO) { send({ t: 'reject', r: 'version' }); setTimeout(() => p.link.close(), 300); return; }
    const cid = String(m.cid || '').replace(/[^a-z0-9]/gi, '').slice(0, 16) || rid(10); p.cid = cid;
    // rejoin? same client id as a seat that dropped during the match
    let seat = H.slots.find((q, i) => i > 0 && q && q.cid === cid && !q.conn);
    if (seat && this.phase !== 'idle') { Object.assign(p, { slot: seat.slot, name: seat.name, hero: seat.hero, hat: seat.hat, skin: seat.skin, trail: seat.trail, team: seat.team, ready: seat.ready }); p.rejoin = true; H.slots[seat.slot] = p; H.peers.delete(seat.pid); }
    else {
      if (this.phase === 'match') { send({ t: 'reject', r: 'locked' }); setTimeout(() => p.link.close(), 300); return; }
      const free = [1, 2, 3].find((i) => !H.slots[i] || (!H.slots[i].conn && this.phase === 'lobby')); if (!free) { send({ t: 'reject', r: 'full' }); setTimeout(() => p.link.close(), 300); return; }
      p.slot = free; p.ready = true; p.team = 1; this.applyProfile(p, m); this.pickFreeHero(p); H.slots[free] = p;
    }
    p.conn = true; p.ping = 0; p.rq = { q: [], cur: { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, assist: true, touchy: false }, edges: { dash: false, deflect: false, ult: false }, last: 0, ack: 0, stall: 0, nrx: 0, tpkt: 0 };
    H.peers.set(p.pid, p); H.pend.delete(p.pid); this.balanceTeams();
    send({ t: 'welcome', slot: p.slot, code: this.code, proto: PROTO, rejoin: !!p.rejoin }); this.syncLobby();
    this.note(`${p.name} ${p.rejoin ? 'is back' : 'joined'}`);
    if (p.rejoin && this.phase === 'match') this.hostRejoin(p);
  },
  pickFreeHero(p) { // v4.1: two phones with the same fighter would look identical; give a late joiner a free default fighter instead
    const H = this.H; const taken = new Set(H.slots.filter((q) => q && q !== p && q.conn).map((q) => q.hero)); if (!taken.has(p.hero)) return;
    const free = ['bao', 'nori', 'tako', 'kuma'].find((id) => !taken.has(id)); if (free) { p.autoFrom = p.hero; p.autoTo = free; p.hero = free; p.hat = 'none'; }
  },
  applyProfile(p, m) {
    p.name = safeName(m.name); p.hero = HEROES.some((h) => h.id === m.hero) ? m.hero : 'bao'; p.hat = hexOk(m.hat, HATS.map((h) => h.id)) ? m.hat : 'none'; p.skin = SKINS[m.skin] ? m.skin : 'default'; p.trail = TRAILS[m.trail] ? m.trail : 'none';
  },
  note(t) { this.notes.push({ t, at: now() }); if (this.notes.length > 4) this.notes.shift(); this.onNote && this.onNote(t); },
  balanceTeams() { const H = this.H; if (!H) return; const hs = H.slots.filter((p) => p && p.conn); for (const t of [0, 1]) { let mem = hs.filter((p) => p.team === t); while (mem.length > 2) { const x = mem.pop(); x.team = 1 - t; } } },
  kick(p, why) { if (!p || p.isHost) return; try { p.link && p.link.send('rel', JSON.stringify({ t: 'kick', r: why })); } catch (e) {} setTimeout(() => this.dropPeer(p, 'kicked'), 120); },
  dropPeer(p, why) {
    const H = this.H; if (!H || H.closed || !p || p.isHost) return; const wasConn = p.conn; p.conn = false; H.pend.delete(p.pid); try { p.link && p.link.close(); } catch (e) {}
    if (!wasConn) return; this.note(`${p.name} left`);
    if (this.phase === 'lobby' || this.phase === 'results') { if (H.slots[p.slot] === p) H.slots[p.slot] = null; H.peers.delete(p.pid); H.rematch.delete(p.slot); }
    else { this.botTakeover(p); } // match in progress: keep the seat for a rejoin, a bot plays meanwhile
    this.syncLobby(); this.emit();
  },
  botTakeover(p) {
    const g = this.app.game, m = this.app.match; if (!g || !m) return; const def = m.players.find((d) => d.ctrl !== 'bot' && d.slot === p.slot); if (!def) return;
    def.ctrl = 'bot'; def.diff = Math.max(0, Math.min(2, this.H.settings.diff)); def.persona = PERSONAS[def.hero.id]; const f = g.fighters.find((q) => q.def === def); if (f) { f.isBot = true; f.def.ctrl = 'bot'; f.bot = new Bot(g, f, def.diff, def.persona); f.netIn = null; if (f.model.setMarker) f.model.setMarker(f.color, tag(p.name), false); }
    this.sendAll({ t: 'evt', n: 'botin', s: p.slot, name: p.name });
  },
  hostRejoin(p) {
    const g = this.app.game, m = this.app.match; if (!g || !m) return; const def = m.players.find((d) => d.slot === p.slot && d.cid === p.cid); if (!def) return;
    def.ctrl = 'human'; const f = g.fighters.find((q) => q.def === def); if (f) { f.isBot = false; f.bot = null; if (f.model.setMarker) f.model.setMarker(f.color, p.slot === 0 ? 'YOU' : tag(p.name), p.slot === 0); }
    this.sendTo(p, this.roundMsg()); this.resendSlow(true);
  },
  hostEmote(p, id) {
    const g = this.app.game; if (!g || this.phase !== 'match' || !EMOTES[id]) return; const f = g.fighters.find((q) => !q.isBot && q.def.slot === p.slot); if (!f || !f.alive || f.emoteT > 0) return;
    f.emoteT = 1.4; sfx('emote'); fx.popup(EMOTES[id].text, f.x, f.z, 'pop-emote', 2.3);
  },
  // ---- host: fast channel (inputs / pings)
  hostFast(p, d) {
    if (!(d instanceof ArrayBuffer) || d.byteLength > IN_MAX || d.byteLength < 1) return; p.lastRx = now(); const type = new Uint8Array(d, 0, 1)[0];
    if (type === PK.PONG) { try { const r = new BinReader(d); r.u8(); const t = r.u32(); const rtt = (now() >>> 0) - t; if (rtt >= 0 && rtt < 5000) p.ping = p.ping ? p.ping * 0.6 + rtt * 0.4 : rtt; } catch (e) {} return; }
    if (type === PK.PING) { const w = new BinWriter(8); const r = new BinReader(d); r.u8(); w.u8(PK.PONG).u32(r.u32()); p.link.send('fast', w.out()); return; }
    if (type !== PK.INPUT || !p.rq) return;
    try {
      const r = new BinReader(d); r.u8(); const n = Math.min(8, r.u8()); const tick = r.u32(); const rq = p.rq; const fr = [];
      if (r.left < n * 5) return;
      for (let i = 0; i < n; i++) fr.push({ tick: tick - i, mx: r.i8() / 127, mz: r.i8() / 127, ax: r.i8() / 127, az: r.i8() / 127, fl: r.u8() });
      // abuse guard: at most ~75 frames/s on average
      rq.tpkt += 1; const t = now(); rq.win = rq.win || t; rq.wn = (rq.wn || 0); if (t - rq.win > 2000) { rq.win = t; rq.wn = 0; }
      for (let i = n - 1; i >= 0; i--) { const f = fr[i]; if (f.tick <= rq.last && !(rq.last - f.tick > 1000)) continue; if (rq.wn > 170) continue; rq.wn++; rq.last = f.tick; rq.q.push(f); }
      if (rq.q.length > 10) { const drop = rq.q.splice(0, rq.q.length - 6); for (const f of drop) { if (f.fl & 2) rq.edges.dash = true; if (f.fl & 4) rq.edges.deflect = true; if (f.fl & 8) rq.edges.ult = true; } }
    } catch (e) { /* malformed packets are ignored */ }
  },
  // input source for the host's Game: slot 0 = local controls, other slots = validated network input
  makeInput() {
    const net = this;
    return { read(slot, f) {
      if (slot === 0) return Input.read(0, f);
      const p = net.H && net.H.slots[slot]; const o = net._o || (net._o = {}); const out = o[slot] || (o[slot] = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false });
      if (!p || !p.rq || !p.conn) { out.mx = out.mz = out.aimX = out.aimZ = 0; out.fire = out.dash = out.deflect = out.ult = false; return out; }
      const c = p.rq.cur, e = p.rq.edges; let mx = c.mx, mz = c.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } let ax = c.aimX, az = c.aimZ; const al = Math.hypot(ax, az); if (al > 1e-3) { ax /= al; az /= al; } else { ax = az = 0; }
      out.mx = mx; out.mz = mz; out.aimX = ax; out.aimZ = az; out.fire = c.fire; out.dash = e.dash; out.deflect = e.deflect; out.ult = e.ult; e.dash = e.deflect = e.ult = false;
      if (f) f.netIn = { assist: c.assist, touchy: c.touchy };
      return out;
    } };
  },
  // called by main loop before each sim step: take one buffered guest input frame per fighter
  beforeStep() {
    const H = this.H; if (!H) return; const g = this.app.game;
    for (const p of H.peers.values()) {
      if (p.isHost || !p.rq || !p.conn) continue; const rq = p.rq; let n = rq.q.length > 4 ? 2 : 1;
      if (!rq.q.length) { rq.stall++; if (rq.stall > 24) { rq.cur.mx = 0; rq.cur.mz = 0; } continue; } rq.stall = 0;
      while (n-- > 0 && rq.q.length) { const f = rq.q.shift(); rq.cur.mx = f.mx; rq.cur.mz = f.mz; rq.cur.aimX = f.ax; rq.cur.aimZ = f.az; rq.cur.fire = !!(f.fl & 1); rq.cur.assist = !!(f.fl & 16); rq.cur.touchy = !!(f.fl & 32); if (f.fl & 2) rq.edges.dash = true; if (f.fl & 4) rq.edges.deflect = true; if (f.fl & 8) rq.edges.ult = true; rq.ack = f.tick; }
      if (g && g.state === 'intro') rq.edges.dash = rq.edges.deflect = rq.edges.ult = false;
    }
  },
  afterStep() {
    const H = this.H; if (!H || this.phase !== 'match') return; const g = this.app.game; if (!g || g.mode === 'attract') return; H.tick++; this.stat.steps++;
    const SN = this.relayPeers() ? SNAP_N_RELAY : SNAP_N; if (++H.snapN % SN !== 0) return;
    const acks = {}; for (const p of H.peers.values()) if (!p.isHost && p.conn && p.rq) acks[p.slot] = p.rq.ack;
    const batch = H.rec.take(); const cur = batch.length ? { s: ++H.fxSeq & 0xffff, t: H.tick, l: batch.map(([n, a]) => [n, Array.isArray(a) ? a.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)) : a]) } : null;
    const bs = []; if (H.fxPrev) bs.push(H.fxPrev); if (cur) bs.push(cur); H.fxPrev = cur;
    const ev = g.events; const wind = ev && ev.windOn && g.wind ? { k: ev.windK, dx: ev.windDir[0], dz: ev.windDir[1] } : null;
    const st = { seq: ++H.seq & 0xffff, tick: H.tick, acks, fxList: bs.length ? bs : null, wind, bid: H.ids.bid, pid: H.ids.pid, cid: H.ids.cid };
    const buf = encodeFast(g, st); H.ids.bid = st.bid; H.ids.pid = st.pid; H.ids.cid = st.cid;
    this.stat.snaps++; this.stat.snapBytes += buf.byteLength; let sent = 0;
    this.fanout('fast', buf, (p) => p.joinedMatch);
    // slow state: only when it changed, plus a periodic refresh (covers packet loss)
    const per = H.snapN % (SN * 8) === 0;
    for (const k of ['crates', 'holes', 'items', 'traps']) { const sig = slowSig[k](g); if (sig !== H.sigLast[k] || per) { H.sigLast[k] = sig; this.sendSlow(k, g); } }
    if (this.stat.t0 === 0) this.stat.t0 = now();
  },
  sendSlow(k, g, only) {
    const H = this.H; const seq = ++H.sigSeq[k] & 0xffff; let buf; if (k === 'crates') buf = encodeCrates(g, seq); else if (k === 'holes') buf = encodeHoles(g, seq); else if (k === 'items') buf = encodeItems(g, seq, H.ids); else buf = encodeTraps(g, seq);
    this.fanout('fast', buf, (p) => p.joinedMatch && (!only || only === p));
  },
  resendSlow(all) { const g = this.app.game; if (!g || !this.H) return; for (const k of ['crates', 'holes', 'items', 'traps']) this.sendSlow(k, g); },
  // ---- host: lobby state
  syncLobby() {
    const H = this.H; if (!H) return; const players = H.slots.filter((p) => p).map((p) => ({ slot: p.slot, name: p.name, hero: p.hero, hat: p.hat, skin: p.skin, trail: p.trail, ready: !!p.ready, team: p.team | 0, host: !!p.isHost, conn: !!p.conn, ping: Math.round(p.ping || 0), rematch: H.rematch.has(p.slot) }));
    this.lobby = { players, settings: H.settings, phase: this.phase, code: this.code };
    this.sendAll({ t: 'lobby', ...this.lobby }); this.emit();
  },
  setSetting(k, v) {
    if (!this.isHost || this.phase !== 'lobby') return; const s = this.H.settings; if (!(k in s)) return;
    if (k === 'mode' && !ONLINE_MODES.includes(v)) return; if (k === 'speed' && !SPEEDS[v]) return; s[k] = v;
    this.syncLobby(); // v4.1: guests are auto-ready, settings changes do not un-ready them
  },
  setMine(upd) { // my own profile / ready / team
    const pr = this.profile();
    if (this.isHost) { const me = this.H.slots[0]; Object.assign(me, pr, { name: safeName(pr.name) }); if (upd && upd.team !== undefined) me.team = upd.team; this.balanceTeams(); this.syncLobby(); }
    else if (this.isGuest) { this.gSend({ t: 'prof', ...pr }); if (upd && upd.team !== undefined) this.gSend({ t: 'team', v: upd.team }); }
  },
  setReady(r) { if (this.isGuest) this.gSend({ t: 'ready', r: !!r }); },
  lobbyEmoji(e) { if (this.isHost) { this.sendAll({ t: 'emo', s: 0, e }); this.onEmote && this.onEmote(0, e); } else if (this.isGuest) this.gSend({ t: 'emo', e }); },
  canStart() { const H = this.H; if (!this.isHost || this.phase !== 'lobby') return false; const hum = H.slots.filter((p) => p && p.conn); if (hum.some((p) => !p.isHost && !p.ready)) return false; const need = H.settings.mode === 'bomb' ? 3 : 2; return hum.length >= 2 || H.settings.bots; },
  // ---- host: building and running a match
  buildDefs() {
    const H = this.H, s = H.settings; const hum = H.slots.filter((p) => p && p.conn).sort((a, b) => a.slot - b.slot); const teamy = TEAM_MODES.includes(s.mode);
    const defs = []; const HERO = (id) => HEROES.find((h) => h.id === id) || HEROES[0];
    const base = (p) => ({ hero: p.hero, hat: p.hat, skin: p.skin, trail: p.trail, type: 'classic', ctrl: 'human', slot: p.slot, name: p.name, wins: 0, diff: 1, cid: p.cid });
    let list = hum.map((p) => ({ ...base(p), team: teamy ? p.team : undefined }));
    const used = new Set(list.map((d) => d.hero)); const pool = shuffle(HEROES.filter((h) => !used.has(h.id)).map((h) => h.id));
    const bot = (extra = {}) => { const hid = pool.shift() || pick(HEROES).id; return { hero: hid, hat: Math.random() < 0.5 ? pick(HATS).id : 'none', ctrl: 'bot', slot: -1, name: HERO(hid).name, diff: s.diff, persona: PERSONAS[hid], wins: 0, type: 'classic', ...extra }; };
    if (teamy) {
      const t0 = list.filter((d) => d.team === 0), t1 = list.filter((d) => d.team === 1);
      if (s.bots) { while (t0.length < 2) t0.push(bot({ team: 0 })); while (t1.length < 2) t1.push(bot({ team: 1 })); } else if (!t0.length || !t1.length) { const src = t0.length ? t0 : t1; const lone = !t0.length; if (!t0.length) t0.push(bot({ team: 0 })); if (!t1.length) t1.push(bot({ team: 1 })); }
      const cols = [[0x4fd1ff, 0x9fe8ff], [0xff5a8a, 0xff9ab8]]; [t0, t1].forEach((t, ti) => t.forEach((d, i) => { d.team = ti; d.color = cols[ti][i % 2]; }));
      list = [...t0, ...t1]; list.forEach((d) => { if (['ctf', 'ball'].includes(s.mode)) d.lives = 99; });
    } else {
      const minTotal = s.mode === 'bomb' ? 3 : 2; const target = s.bots ? 4 : Math.max(minTotal, list.length); while (list.length < target) list.push(bot());
      list.forEach((d, i) => { d.color = PLAYER_COLORS[i % 4]; if (['koth', 'coins'].includes(s.mode)) d.lives = 99; });
    }
    return list;
  },
  hydrate(defs, mySlot) { return defs.map((d) => { const o = { ...d, hero: HEROES.find((h) => h.id === d.hero) || HEROES[0] }; if (o.ctrl !== 'bot' && mySlot !== undefined) { o.slot = d.slot === mySlot ? 0 : d.slot === 0 ? mySlot : d.slot; } return o; }); },
  startMatch() {
    const H = this.H; if (!this.isHost || this.phase === 'match') return false; const s = H.settings; const app = this.app;
    const defs = this.buildDefs(); this.defsRaw = defs; const mut = s.mutator === 'daily' ? todayMutator().id : 'off';
    const size = (MODES[s.mode] && MODES[s.mode].size) || s.size; const need = ['classic', 'team', 'crumble'].includes(s.mode) ? s.rounds : 1;
    this.phase = 'match'; H.rematch.clear(); H.kosTotal = {}; for (const p of H.peers.values()) { p.ready = true; p.joinedMatch = !p.isHost && p.conn; }
    H.rec.start(); app.net = this; this.input = this.makeInput();
    app.match = { mode: s.mode, rulesMode: s.mode, players: this.hydrate(defs, 0), round: 0, need, arena: s.arena, size, traps: s.traps, trapSet: s.mode === 'ball' ? [['bumper', 'q4'], ['jump', 'r2']] : null, mutator: mut, humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {}, online: true, events: s.events };
    S().played++; save();
    this.syncLobby(); app.nextRound(true); return true;
  },
  // app.nextRound (host) asks us to complete the Game options; we also announce the round to guests
  hostGameOpts(o) { const s = this.H.settings; // v4.5: the host's countdown is a 3 s real-time count after a pre-roll that grows with the worst peer ping, so slow links still see the 3 before it starts
    let worst = 0; for (const p of this.H.peers.values()) if (!p.isHost && p.conn) worst = Math.max(worst, p.ping || 0);
    const pre = Math.min(1.2, Math.max(0.45, 0.45 + worst / 1000)); return { ...o, intro: CD_LEN + pre, input: this.input, netSeed: ((Math.random() * 0x7fffffff) | 1), netCfg: SPEEDS[s.speed] || SPEEDS.chill, net: this }; },
  roundMsg() {
    const m = this.app.match, g = this.app.game, o = this.curOpts;
    return { t: 'round', mode: m.mode, round: m.round, need: m.need, arena: g.arenaId, size: m.size, traps: m.traps, trapSet: m.trapSet, mutator: m.mutator, rules: m.curRules, seed: o.netSeed, speed: this.H.settings.speed, goIn: Math.max(0, g.introT), players: m.players.map((d) => ({ hero: d.hero.id, hat: d.hat, skin: d.skin, trail: d.trail, type: d.type, ctrl: d.ctrl, slot: d.slot, name: d.name, team: d.team, color: d.color, lives: d.lives, diff: d.diff, persona: d.persona, wins: d.wins || 0, cid: d.cid })) };
  },
  onGameCreated(g, opts) {
    this.curOpts = opts;
    if (this.isHost) {
      const m = this.app.match; const H = this.H; H.tick = 0; H.snapN = 0; H.fxPrev = null; H.sigLast = {};
      g.netRec = (n, x, z) => H.rec.push(n, [x, z]);
      for (const f of g.fighters) { if (!f.isBot && f.model.setMarker) f.model.setMarker(f.color, f.def.slot === 0 ? 'YOU' : tag(H.slots[f.def.slot] ? H.slots[f.def.slot].name : 'P'), f.def.slot === 0); }
      this.phase = 'match'; for (const p of H.peers.values()) if (!p.isHost && p.conn) p.joinedMatch = true;
      this.sendAll(this.roundMsg()); setTimeout(() => this.resendSlow(), 300);
    }
  },
  relayEvent(n, d) {
    const g = this.app.game; if (!this.isHost || !g) return; if (n === 'roundEnd' || n === 'countdown' || n === 'go' || n === 'cdclear') return; const ix = (f) => (f ? g.fighters.indexOf(f) : -1);
    const m = { t: 'evt', n, f: ix(d && d.f), k: ix(d && d.killer), from: ix(d && d.from), kind: d && d.kind, w: ix(d && d.winner), wt: d && d.winTeam, draw: d && d.draw, team: d && d.team, num: d && d.n, name: d && d.name };
    this.sendAll(m);
  },
  // host: round / match end
  hostRoundEnd(d) {
    const app = this.app, m = app.match, g = app.game, H = this.H; if (!m || !g) return;
    g.fighters.forEach((f, i) => { H.kosTotal[i] = (H.kosTotal[i] || 0) + (f.kos || 0); });
    const multi = ['classic', 'team', 'crumble'].includes(m.mode);
    if (multi) {
      if (d.winTeam >= 0) m.players.forEach((p, i) => { const t = p.team === undefined ? i : p.team; if (t === d.winTeam) p.wins++; });
      const champ = m.players.find((p) => p.wins >= m.need);
      if (!champ) { const wins = m.players.map((p) => p.wins); this.sendAll({ t: 'rend', winTeam: d.winTeam, w: d.winner ? g.fighters.indexOf(d.winner) : -1, wins, draw: d.winTeam < 0 }); this.roundEndLocal(d, wins); const to = setTimeout(() => { if (this.phase === 'match' && this.isHost) app.nextRound(); }, 3600); H.timers.push(to); return; }
      return this.matchEnd(m.players.indexOf(champ) >= 0 ? (champ.team === undefined ? m.players.indexOf(champ) : champ.team) : -1, d);
    }
    this.matchEnd(d.winTeam, d);
  },
  roundEndLocal(d, wins) { const g = this.app.game; this.app.net_roundEnd({ winTeam: d.winTeam, w: d.winner ? g.fighters.indexOf(d.winner) : -1, wins, draw: d.winTeam < 0 }); },
  matchEnd(winTeam, d) {
    const app = this.app, m = app.match, g = app.game, H = this.H; const type = g.rules.type;
    const res = { t: 'mend', mode: m.mode, winTeam, time: Math.round(g.playTime), draw: winTeam < 0, players: m.players.map((p, i) => ({ i, slot: p.slot, name: p.name, team: p.team === undefined ? i : p.team, wins: p.wins || 0, bot: p.ctrl === 'bot' && !(H.slots[p.slot] && H.slots[p.slot].cid === p.cid), kos: Math.min(99, H.kosTotal[i] || 0), score: Math.round(g.fighters[i] ? g.fighters[i].score || 0 : 0) })), x: {} };
    if (type === 'koth') res.x.scores = [0, 1, 2, 3].map((t) => Math.round(g.mst.scores[t] || 0)); if (g.m2 && g.m2.scores) res.x.scores = [g.m2.scores[0] | 0, g.m2.scores[1] | 0];
    this.phase = 'results'; H.rematch.clear(); this.lastResult = res; this.sendAll(res); this.syncLobby(); this.finishLocal(res); this.app.net_matchEnd(res);
  },
  maybeRematch() {
    const H = this.H; if (!this.isHost || this.phase !== 'results') return; const hum = H.slots.filter((p) => p && p.conn); if (hum.length && hum.every((p) => H.rematch.has(p.slot))) { this.startMatch(); }
  },
  rematch() { if (this.isHost) { this.H.rematch.add(0); this.syncLobby(); this.maybeRematch(); } else if (this.isGuest) { this.gSend({ t: 'rematch' }); this.lobby.players.forEach((p) => { if (p.slot === this.mySlot) p.rematch = true; }); this.emit(); } },
  startNow() { if (this.isHost && this.phase === 'results') this.startMatch(); },
  toLobby() { if (!this.isHost) return; this.phase = 'lobby'; this.H.rematch.clear(); for (const p of this.H.peers.values()) if (!p.isHost) p.ready = true; this.H.rec.stop(); this.sendAll({ t: 'tolobby' }); this.syncLobby(); this.app.netToLobby(); },
  // result -> local rewards (same code path for host and guests; only host-sent, clamped numbers are trusted)
  finishLocal(res) {
    const s = S(); const mySlot = this.mySlot; const me = res.players.find((p) => p.slot === mySlot && !p.bot) || null; if (!me) return;
    const won = res.winTeam >= 0 && me.team === res.winTeam; const kos = Math.max(0, Math.min(12, me.kos | 0)); const time = Math.max(0, res.time | 0); const mode = String(res.mode);
    let coins = 0, xp = 5, rows = [];
    if (time >= ONLINE_MIN_TIME) {
      coins = (won ? 30 : 8) + kos * 5; xp = 18 + (won ? 40 : 0) + kos * 8;
      if (mode === 'koth' && won) coins += 25; if ((mode === 'ctf' || mode === 'ball') && won) coins += 15; if (mode === 'coins') coins += Math.min(40, Math.round(Math.max(0, Math.min(60, me.score | 0)) * 0.8));
    }
    coins = Math.min(coins, ONLINE_COIN_CAP); xp = Math.min(xp, ONLINE_XP_CAP);
    const o = s.online = s.online || { day: '', gold: 0 }; const day = new Date().toDateString(); if (o.day !== day) { o.day = day; o.gold = 0; } const room = Math.max(0, ONLINE_DAY_CAP - o.gold); const capped = coins > room; coins = Math.min(coins, room); o.gold += coins;
    s.played++; track('play'); if (won) { s.wins++; track('win'); if (mode === 'team') track('teamwin'); if (mode === 'koth') track('kothwin'); if (mode === 'bomb') track('bombwin'); if (['ctf', 'coins', 'ball', 'crumble'].includes(mode)) track(mode + 'win'); }
    if (coins > 0) addCoins(coins, 'online'); const ups = addXp(xp); save();
    this.reward = { won, coins, xp, kos, capped, time, ups }; return this.reward;
  },
  sendAll(o) { const H = this.H; if (!H) return; this.fanout('rel', JSON.stringify(o)); },
  sendTo(p, o) { if (p && p.link) p.link.send('rel', JSON.stringify(o)); },

  // ================================================================== GUEST
  async join(codeIn, opts = {}) {
    if (this.active) return; if (!rtcSupported()) throw new Error('no-webrtc'); const code = normCode(codeIn); if (!validCode(code)) throw new Error('bad-code');
    this.reset(); this.lastCode = code; this.last = code; this.active = true; this.role = 'guest'; this.phase = 'joining'; this.code = code; this.app.net = this; this.error = null; this.setStatus('Connecting to the room service...');
    const G = this.G = { sig: null, link: null, welcomed: false, closed: false, tm: [], via: 'direct', canRelay: relayOn() && !opts.noRelay }; const gid = GUEST_PREFIX + rid(10);
    if (netCfg().forceRelay && G.canRelay) { this.guestRelay(); return; }
    try {
      const sig = G.sig = new Signal(gid, opts.relay); await sig.connect();
      this.setStatus(`Looking for room ${code}...`);
      const link = G.link = this.makeGuestLink(); const offer = await link.createOffer(); const cid = rid(6); G.conn = cid; const queue = []; G.cand = (c) => { if (G.haveAns) link.addCandidate(c); else queue.push(c); };
      link.o.onice = (c) => sig.send('CANDIDATE', ID_PREFIX + code, { candidate: c, cid });
      let answered = false;
      sig.onmsg = (m) => { if (G.closed) return; if (m.type === 'ANSWER' && m.payload && m.payload.cid === cid) { answered = true; link.setAnswer(m.payload.sdp).then(() => { G.haveAns = true; queue.forEach((c) => link.addCandidate(c)); queue.length = 0; this.setStatus('Room found. Connecting directly to the host...'); }); } else if (m.type === 'CANDIDATE' && m.payload && m.payload.cid === cid) G.cand(m.payload.candidate); else if (m.type === 'EXPIRE' || m.type === 'LEAVE') { if (!answered) this.dfail('no-room'); } };
      sig.send('OFFER', ID_PREFIX + code, { sdp: offer, cid, proto: PROTO });
      G.tm.push(setTimeout(() => { if (!answered && !G.closed) this.dfail('no-room'); }, G.canRelay ? DIRECT_MS : 9000));
      G.tm.push(setTimeout(() => { if (!G.welcomed && !G.closed && answered) this.dfail('nat'); }, G.canRelay ? DIRECT_MS : 24000));
    } catch (e) { this.dfail(e.message === 'signaling-unavailable' || e.message === 'signaling-timeout' ? 'no-signal' : 'error', e); }
  },
  // v4.3: a failed direct attempt falls back to the Cloudflare relay with the same code (no extra steps for the player)
  dfail(code, err) { const G = this.G; if (G && !G.closed && !G.welcomed && G.via === 'direct' && G.canRelay && !G.relayTried && !G.manual) return this.guestRelay(); this.fail(code, err); },
  guestRelay() {
    const G = this.G; if (!G || G.closed || G.relayTried) return; G.relayTried = true; G.via = 'relay'; const code = this.code;
    try { G.link && G.link.close(); } catch (e) {} try { G.sig && G.sig.close(); } catch (e) {} G.link = null; G.sig = null; G.tm.forEach((t) => { clearTimeout(t); clearInterval(t); }); G.tm = [];
    this.setStatus('Direct link blocked or slow. Connecting through the relay...'); const conn = G.rconn = new RelayConn(code, 'guest');
    conn.connect(7000).then(() => {
      if (G.closed) { conn.close(); return; }
      const link = G.link = new RelayGuestLink(conn, { onrel: (d) => this.guestRel(d), onfast: (d) => this.guestFast(d), onclose: (why) => { if (G.closed) return; if (!G.welcomed) this.fail('no-room'); else this.lost('conn'); } });
      this.setStatus('Relay connected. Joining the room...'); this.guestHello(); G.tm.push(setTimeout(() => { if (!G.welcomed && !G.closed) this.fail('no-room'); }, 9000));
    }).catch((e) => { if (G.closed) return; this.fail(e.message === 'nohost' ? 'no-room' : e.message === 'full' ? 'reject:full' : 'no-signal', e); });
  },
  makeGuestLink() {
    const G = this.G; const link = new Link({
      onrel: (d) => this.guestRel(d), onfast: (d) => this.guestFast(d),
      onopen: () => { this.guestHello(); }, onclose: (why) => { if (G.closed) return; if (!G.welcomed) this.dfail(why === 'ice-failed' ? 'nat' : 'no-room'); else this.lost('conn'); },
    }); return link;
  },
  async joinManual(offerOnly) { // guest side of the copy/paste flow, step 1: produce the offer code
    if (this.active) return null; this.reset(); this.active = true; this.role = 'guest'; this.phase = 'joining'; this.code = 'MANUAL'; this.app.net = this; this.error = null;
    const G = this.G = { sig: null, link: null, welcomed: false, closed: false, tm: [] }; const link = G.link = this.makeGuestLink(); G.manual = true;
    await link.createOffer(); await link.gathered(); G.tm.push(setTimeout(() => { if (!G.welcomed && !G.closed) this.fail('nat'); }, 120000));
    const d = link.pc.localDescription; return { type: d.type, sdp: d.sdp };
  },
  async joinManualAnswer(desc) { const G = this.G; if (!G || !G.link) return; await G.link.setAnswer(desc); this.setStatus('Connecting directly to the host...'); },
  guestHello() { const pr = this.profile(); this.G.link.send('rel', JSON.stringify({ t: 'hello', proto: (window.__bbNet && window.__bbNet.proto) || PROTO, cid: this.cid, ...pr })); },
  gSend(o) { const G = this.G; if (G && G.link) G.link.send('rel', JSON.stringify(o)); },
  guestRel(d) {
    if (typeof d !== 'string' || d.length > 20000) return; let m; try { m = JSON.parse(d); } catch (e) { return; } if (!m || typeof m.t !== 'string') return; const G = this.G; if (!G) return; G.lastRx = now();
    const app = this.app;
    switch (m.t) {
      case 'welcome': G.welcomed = true; this.mySlot = m.slot | 0; this.phase = 'lobby'; this.wasInRoom = true; this.code = m.code || this.code; this.setStatus(''); this.startGuestTimers(); if (m.rejoin) this.note('Reconnected'); this.emit(); break;
      case 'reject': this.fail('reject:' + m.r); break;
      case 'lobby': this.lobby = { players: m.players, settings: m.settings, phase: m.phase, code: m.code }; if (m.phase === 'results' && this.phase === 'match') this.phase = 'results'; this.emit(); break;
      case 'pings': this.pings = m.p || {}; break;
      case 'emo': this.onEmote && this.onEmote(m.s, m.e); break;
      case 'round': this.guestRound(m); break;
      case 'evt': this.guestEvent(m); break;
      case 'rend': app.net_roundEnd && app.net_roundEnd(m); break;
      case 'mend': this.phase = 'results'; this.lastResult = m; this.finishLocal(m); app.net_matchEnd && app.net_matchEnd(m); break;
      case 'tolobby': this.phase = 'lobby'; app.netToLobby(); this.emit(); break;
      case 'kick': this.end(m.r === 'spam' ? 'You were removed from the room (too many messages).' : 'The host removed you from the room.'); break;
      case 'closed': this.end('The host closed the room.'); break;
    }
  },
  startGuestTimers() {
    const G = this.G; G.tm.push(setInterval(() => { if (!this.isGuest || G.closed) return; const t = now(); if (G.lastRx && t - Math.max(G.lastRx, G.lastFast || 0) > 6000) { this.lost('timeout'); return; } const w = new BinWriter(8); w.u8(PK.PING).u32(Math.round(t) >>> 0); G.link.send('fast', w.out()); }, 1000));
  },
  guestFast(d) {
    if (!(d instanceof ArrayBuffer) || d.byteLength < 1) return; const G = this.G; if (!G) return; G.lastFast = now(); G.lastRx = G.lastFast; const type = new Uint8Array(d, 0, 1)[0];
    if (type === PK.PONG) { const r = new BinReader(d); r.u8(); const rtt = (now() >>> 0) - r.u32(); if (rtt >= 0 && rtt < 5000) { this.rtt = this.rtt ? this.rtt * 0.6 + rtt * 0.4 : rtt; this.rttMax = Math.max(this.rttMax * 0.99, rtt); } return; }
    if (type === PK.PING) { const w = new BinWriter(8); const r = new BinReader(d); r.u8(); w.u8(PK.PONG).u32(r.u32()); G.link.send('fast', w.out()); return; }
    this.stat.snaps += type === PK.SNAP ? 1 : 0; this.stat.snapBytes += d.byteLength;
    if (this.world) this.world.onPacket(d, now());
  },
  guestRound(m) {
    // the host announces every round: build the identical Game from its config
    const app = this.app; const defs = (m.players || []).map((d) => ({ ...d }));
    const cfg = { ...m, players: this.hydrate(defs, this.mySlot) };
    this.phase = 'match'; this.guestCfg = cfg; app.netStartGuestRound(cfg); this.emit();
  },
  onGuestGame(g, cfg) {
    const localIdx = g.fighters.findIndex((f) => !f.isBot && f.def.slot === 0);
    this.world = new GuestWorld(g, { slotOf: null, localIdx, mySlot: this.mySlot, speed: cfg.speed, send: (buf) => { this.G && this.G.link && this.G.link.send('fast', buf); } });
    if (this.G && this.G.link && this.G.link.relay) { this.world.sendEvery = 4; this.world.relay = true; }
    this.world.rttOf = () => this.rtt || 0; g.guestUpdate = (dt) => this.world.update(dt);
    for (const f of g.fighters) { if (!f.isBot && f.model.setMarker) { const own = f.def.slot === 0; const pl = this.lobby.players.find((p) => p.slot === (own ? this.mySlot : (f.def.slot === this.mySlot ? 0 : f.def.slot))); f.model.setMarker(f.color, own ? 'YOU' : tag((cfg.players[g.fighters.indexOf(f)] || {}).name), own); } }
  },
  // v4.5: the host says how long until GO (seconds, at send time); the guest turns that into a local deadline minus half the round trip, so all countdowns end together (direct or relay)
  goAtFor(c) { const rtt = Math.min(1200, Math.max(0, this.rtt || 0)); return performance.now() + Math.max(0, (c.goIn === undefined ? CD_LEN : c.goIn) * 1000 - rtt / 2); },
  guestEvent(m) {
    if (m.n === 'countdown' || m.n === 'go') return; // guests run their own synced countdown
    const g = this.app.game; if (!g) return; const F = (i) => (i >= 0 ? g.fighters[i] : null);
    if (m.n === 'botin') { this.note(`${m.name} left: a bot takes over`); this.UI.toast(`${m.name} left. A bot takes over.`, 2200); return; }
    this.app.gameEvent(m.n, { f: F(m.f), killer: F(m.k), from: F(m.from), kind: m.kind, winner: F(m.w), winTeam: m.wt, draw: m.draw, team: m.team, n: m.num, name: m.name });
  },
  fail(code, err) { if (!this.active || this.phase === 'ended') return; this.error = { code, msg: err && err.message }; const wasJoin = this.phase === 'joining'; this.teardown(); this.onError && this.onError(this.error, wasJoin); },
  lost(why) { if (!this.active) return; const inMatch = this.phase === 'match' || this.phase === 'results'; this.end(inMatch ? 'Lost connection to the host.' : 'Lost connection to the room.', true); },
  // ================================================================== common teardown
  end(msg, canRejoin) { if (!this.active) return; this.teardown(); this.error = { code: 'ended', msg, canRejoin: !!canRejoin && this.role === 'guest' }; this.onError && this.onError(this.error, false); },
  leave() { // user-initiated: say goodbye first, close the links a moment later so the message gets out
    if (!this.active) return; let d = 0; try { if (this.isGuest) { this.gSend({ t: 'bye' }); d = 250; } else if (this.isHost) { this.sendAll({ t: 'closed' }); d = 250; } } catch (e) {} this.teardown(d); this.error = null;
  },
  teardown(delay = 0) {
    const wasActive = this.active; this.active = false; const H = this.H, G = this.G; this.phase = 'ended';
    const later = (fn) => { if (delay) setTimeout(fn, delay); else fn(); };
    if (H) { H.closed = true; H.timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); H.rec.stop(); later(() => { for (const p of H.peers.values()) { try { p.link && p.link.close(); } catch (e) {} } for (const p of H.pend.values()) { try { p.link && p.link.close(); } catch (e) {} } try { H.sig && H.sig.close(); } catch (e) {} try { H.rly && H.rly.close(); } catch (e) {} }); }
    if (G) { G.closed = true; G.tm.forEach((t) => { clearInterval(t); clearTimeout(t); }); later(() => { try { G.link && G.link.close(); } catch (e) {} try { G.sig && G.sig.close(); } catch (e) {} try { G.rconn && G.rconn.close(); } catch (e) {} }); }
    if (this.app) { this.app.net = null; const g = this.app.game; if (g) { g.guestUpdate = null; g.netRec = null; } }
    this.H = null; this.G = null; this.world = null; this.input = null;
    if (wasActive && this.app && this.app.netClosed) this.app.netClosed();
  },
  reset() { this.lobby = { players: [], settings: null }; this.pings = {}; this.rtt = 0; this.rttMax = 0; this.reward = null; this.lastResult = null; this.stat = { snaps: 0, snapBytes: 0, t0: 0, steps: 0 }; this.error = null; this.notes = []; this.status = ''; this.phase = 'idle'; },
  // diagnostics (used by tests and the ?netdebug overlay)
  stats() {
    const links = []; const add = (l, name) => { if (l) links.push({ name, ...l.stat }); };
    if (this.H) for (const p of this.H.peers.values()) if (p.link) add(p.link, p.name); if (this.G) add(this.G.link, 'host');
    return { role: this.role, phase: this.phase, rtt: Math.round(this.rtt), links, world: this.world ? { ...this.world.stats, interp: this.world.interp, jit: this.world.jit, buf: this.world.buf.length } : null, snaps: this.stat.snaps, snapBytes: this.stat.snapBytes, steps: this.stat.steps };
  },
};
