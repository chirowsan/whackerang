// Whackerang room relay: Cloudflare Worker + one SQLite-backed Durable Object per room code (free plan).
// It only forwards opaque binary frames between ONE host and up to 3 guests. It never parses, stores or logs game data.
// Wire format (all game data is binary; control messages from the server are small JSON text frames):
//   guest -> relay : [kind u8][payload...]                  -> host receives [gid u8][kind u8][payload...]
//   host  -> relay : [mask u8][kind u8][payload...]         -> every guest whose bit (1<<gid) is set receives [kind u8][payload...]
//   kind 0 = reliable/ordered control (UTF-8 JSON), kind 1 = fast game traffic (binary).  gid 1..3.
//   relay -> host  (text) {"t":"join","g":1} / {"t":"leave","g":1}      relay -> guest (text) {"t":"ready","g":1} | {"t":"err","r":"nohost|full|taken|origin"} | {"t":"hostgone"}
//   clients -> relay (text) "ping" is answered "pong" by the runtime (WebSocketAutoResponse) without waking the object.
import { DurableObject } from 'cloudflare:workers';
import { CFG, MODES, clampFill, planQueue, makeMatchCode } from './matchplan.js';

const ORIGINS = new Set(['https://chirowsan.github.io', 'capacitor://localhost', 'https://localhost', 'http://localhost']);
const CODE = /^[A-Z]{4,5}$/;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/; // the app's own device (Capacitor https://localhost) and local development ports
const MAX_GUESTS = 3;
const MAX_BYTES = 16 * 1024;           // per frame
const HOST_RATE = 160, GUEST_RATE = 90; // frames per second (token bucket, 1 s burst)
const IDLE_ALONE_MS = 15 * 60 * 1000;   // host waiting in a lobby with nobody else
const IDLE_BUSY_MS = 45 * 1000;         // guests connected but no data at all
const hdr = (o) => ({ 'access-control-allow-origin': o || '*', 'cache-control': 'no-store' });

// ---- v4.6 Auto match: WebSocket /m -> ONE global Matchmaker object. The queue is the set of open sockets (their attachments); nothing is persisted.
async function matchEntry(req, env) {
  if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
  const origin = req.headers.get('Origin');
  if (!origin || !(ORIGINS.has(origin) || LOCAL.test(origin))) return new Response('forbidden origin', { status: 403 });
  // a short salted hash of the IP, only used to cap sockets per address; it lives in the socket attachment (memory) and is never logged or stored
  const ip = req.headers.get('CF-Connecting-IP') || ''; const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('whk46|' + ip)));
  const ipk = Array.from(d.slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
  const h = new Headers(req.headers); h.set('x-ipk', ipk);
  return env.MATCH.get(env.MATCH.idFromName('q1')).fetch(new Request(req, { headers: h }));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/healthz') return new Response('ok', { headers: { 'content-type': 'text/plain', ...hdr() } });
    if (url.pathname === '/m') return matchEntry(req, env); // v4.6 Auto match queue
    const m = /^\/r\/([A-Za-z]{4,5})$/.exec(url.pathname);
    if (!m) return new Response('not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const origin = req.headers.get('Origin');
    if (!origin || !(ORIGINS.has(origin) || LOCAL.test(origin))) return new Response('forbidden origin', { status: 403 });
    const code = m[1].toUpperCase(); if (!CODE.test(code)) return new Response('bad code', { status: 400 });
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    return stub.fetch(new Request(req.url, { headers: { Upgrade: 'websocket', 'x-role': role } }));
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.buckets = new WeakMap(); this.lastData = Date.now();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  socks() { return this.ctx.getWebSockets(); }
  att(ws) { try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; } }
  async fetch(req) {
    const role = req.headers.get('x-role') === 'host' ? 'host' : 'guest';
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    const all = this.socks(); const host = all.find((w) => this.att(w).role === 'host'); const guests = all.filter((w) => this.att(w).role === 'guest');
    let err = null, gid = 0;
    if (role === 'host') { if (host) err = 'taken'; }
    else if (!host) err = 'nohost';
    else { for (let g = 1; g <= MAX_GUESTS; g++) if (!guests.some((w) => this.att(w).gid === g)) { gid = g; break; } if (!gid) err = 'full'; }
    this.ctx.acceptWebSocket(server);
    if (err) { server.serializeAttachment({ role: 'rejected' }); server.send(JSON.stringify({ t: 'err', r: err })); server.close(4000 + (err === 'taken' ? 1 : err === 'nohost' ? 2 : 3), err); return new Response(null, { status: 101, webSocket: client }); }
    server.serializeAttachment({ role, gid });
    this.lastData = Date.now();
    if (role === 'guest') { server.send(JSON.stringify({ t: 'ready', g: gid })); try { host.send(JSON.stringify({ t: 'join', g: gid })); } catch (e) {} }
    else server.send(JSON.stringify({ t: 'ready', g: 0 }));
    await this.scheduleAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }
  take(ws, rate) { // token bucket: refill rate per second, burst = rate
    const t = Date.now(); let b = this.buckets.get(ws); if (!b) { b = { n: rate, t }; this.buckets.set(ws, b); }
    b.n = Math.min(rate, b.n + (t - b.t) * rate / 1000); b.t = t; if (b.n < 1) { b.bad = (b.bad || 0) + 1; return b.bad > 300 ? 'kick' : false; } b.n--; return true;
  }
  webSocketMessage(ws, msg) {
    if (typeof msg === 'string' || !msg || msg.byteLength < 2 || msg.byteLength > MAX_BYTES) return; // data is binary only; oversized / text frames are dropped
    const a = this.att(ws); if (a.role !== 'host' && a.role !== 'guest') return;
    const ok = this.take(ws, a.role === 'host' ? HOST_RATE : GUEST_RATE); if (ok === 'kick') { try { ws.close(4010, 'rate'); } catch (e) {} return; } if (!ok) return;
    this.lastData = Date.now(); const u = new Uint8Array(msg);
    if (a.role === 'guest') {
      const host = this.socks().find((w) => this.att(w).role === 'host'); if (!host) return;
      const out = new Uint8Array(u.length + 1); out[0] = a.gid; out.set(u, 1); try { host.send(out); } catch (e) {}
    } else {
      const mask = u[0]; const out = u.subarray(1); if (!mask) return;
      for (const w of this.socks()) { const g = this.att(w); if (g.role === 'guest' && (mask & (1 << g.gid))) { try { w.send(out); } catch (e) {} } }
    }
  }
  webSocketClose(ws, code, reason) { this.gone(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {} }
  webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    const a = this.att(ws);
    if (a.role === 'guest') { const host = this.socks().find((w) => w !== ws && this.att(w).role === 'host'); if (host) try { host.send(JSON.stringify({ t: 'leave', g: a.gid })); } catch (e) {} }
    else if (a.role === 'host') { for (const w of this.socks()) if (w !== ws && this.att(w).role === 'guest') { try { w.send(JSON.stringify({ t: 'hostgone' })); w.close(4004, 'hostgone'); } catch (e) {} } }
  }
  async scheduleAlarm() { const cur = await this.ctx.storage.getAlarm(); if (!cur) await this.ctx.storage.setAlarm(Date.now() + 30000); }
  async alarm() {
    const live = this.socks().filter((w) => ['host', 'guest'].includes(this.att(w).role)); if (!live.length) return; // nothing left: no more alarms, the object goes away
    const guests = live.filter((w) => this.att(w).role === 'guest').length; const idle = Date.now() - this.lastData;
    if (idle > (guests ? IDLE_BUSY_MS : IDLE_ALONE_MS)) { for (const w of live) { try { w.close(4005, 'idle'); } catch (e) {} } return; }
    await this.ctx.storage.setAlarm(Date.now() + 30000);
  }
}

// ---- v4.6 Auto match queue.
// c->s (JSON text)  {"t":"q","mode":"classic","fill":120,"v":1}  join the queue (fill = seconds until bots fill the room; 5..120)
//                   {"t":"open"} (host: my room is open)  {"t":"fail"} (host: could not open)  {"t":"bye"} (cancel)
// s->c              {"t":"st","n":2,"fillIn":23000}  queue status   {"t":"host","code":"BKTQL","expect":1}  you host    {"t":"found","n":2}  a match formed (guests)
//                   {"t":"go","code":"BKTQL"}  guests: join this room now   {"t":"requeue"}  the host failed, you are searching again   {"t":"ok"}  host: released   {"t":"err","r":"..."}
// "ping" text frames are answered "pong" by the runtime (no wake-up); clients send one every ~20 s and an entry with no ping for 75 s is dropped as stale.
export class Matchmaker extends DurableObject {
  constructor(ctx, env) { super(ctx, env); ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); this.dirty = new Set(); }
  open() { return this.ctx.getWebSockets().filter((w) => w.readyState === 1); }
  att(ws) { try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; } }
  put(ws, a) { try { ws.serializeAttachment(a); } catch (e) {} }
  tx(ws, o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }
  kill(ws, code, why) { try { ws.close(code, why); } catch (e) {} }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const live = this.open(); const ipk = req.headers.get('x-ipk') || '';
    if (live.length >= CFG.MAX_SOCKETS) return new Response('busy', { status: 503 });
    if (ipk && live.filter((w) => this.att(w).ipk === ipk).length >= CFG.PER_IP) return new Response('too many', { status: 429 });
    const pair = new WebSocketPair(); this.ctx.acceptWebSocket(pair[1]);
    this.put(pair[1], { st: 'new', t0: Date.now(), ipk, rc: 0, rw: Date.now() });
    await this.tick();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws, msg) {
    const now = Date.now(); let a = this.att(ws);
    if (now - (a.rw || 0) > 10000) { a.rw = now; a.rc = 0; } if (++a.rc > 30) return this.kill(ws, 4029, 'rate'); this.put(ws, a);
    if (typeof msg !== 'string' || msg.length > 300) return this.kill(ws, 1003, 'bad');
    let m; try { m = JSON.parse(msg); } catch (e) { return this.kill(ws, 1003, 'bad'); }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'q') {
      if (a.st !== 'new') return;
      if (!MODES.includes(m.mode)) { this.tx(ws, { t: 'err', r: 'mode' }); return this.kill(ws, 4400, 'mode'); }
      a = { ...a, st: 'wait', mode: m.mode, t: now, fill: clampFill(m.fill), id: crypto.randomUUID().slice(0, 8) }; this.put(ws, a); this.dirty.add(a.mode);
    } else if (m.t === 'open' && a.st === 'hostp') {
      for (const w of this.open()) { const b = this.att(w); if (w !== ws && b.gid === a.gid && b.st === 'guestp') { this.tx(w, { t: 'go', code: a.code }); this.put(w, { ...b, st: 'done' }); this.kill(w, 1000, 'matched'); } }
      this.tx(ws, { t: 'ok' }); this.put(ws, { ...a, st: 'done' }); this.kill(ws, 1000, 'matched');
    } else if (m.t === 'fail' && a.st === 'hostp') { this.abort(a.gid, ws); }
    else if (m.t === 'bye') { this.gone(ws); this.kill(ws, 1000, 'bye'); }
    await this.tick();
  }
  async webSocketClose(ws, code) { this.kill(ws, code && code !== 1005 && code !== 1006 ? code : 1000, 'bye'); this.gone(ws); await this.tick(); }
  async webSocketError(ws) { this.gone(ws); await this.tick(); }
  gone(ws) { const a = this.att(ws); if (a.st === 'wait') this.dirty.add(a.mode); if (a.st === 'hostp') this.abort(a.gid, ws); this.put(ws, { ...a, st: 'done' }); }
  // the chosen host failed/left before opening its room: everyone else goes back to searching with their original queue time (so they re-match at once)
  abort(gid, hostWs) {
    for (const w of this.open()) { const b = this.att(w); if (b.gid !== gid) continue;
      if (w === hostWs) { this.put(w, { ...b, st: 'done' }); this.kill(w, 1000, 'failed'); }
      else if (b.st === 'guestp') { const { gid: _g, code: _c, ...r } = b; this.put(w, { ...r, st: 'wait', u: 1 }); this.tx(w, { t: 'requeue' }); this.dirty.add(b.mode); } }
  }
  async alarm() { await this.tick(); }
  async tick() {
    const now = Date.now(); let next = null; const wake = (t) => { if (next === null || t < next) next = t; };
    for (let guard = 0; guard < 8; guard++) { // matching can expose a new match (queue > 4); abort/prune can requeue
      let again = false; const live = this.open(); const byMode = {};
      for (const w of live) {
        const a = this.att(w); if (a.st === 'done') continue;
        const ts = this.ctx.getWebSocketAutoResponseTimestamp(w); const last = Math.max(a.t0 || 0, ts ? ts.getTime() : 0);
        if (a.st === 'new') { if (now - a.t0 >= CFG.NEW_MS - 50) this.kill(w, 4008, 'noq'); else wake(a.t0 + CFG.NEW_MS); continue; }
        if (now - last > CFG.STALE_MS) { if (a.st === 'hostp') this.abort(a.gid, w); this.put(w, { ...a, st: 'done' }); this.kill(w, 4009, 'stale'); if (a.mode) this.dirty.add(a.mode); again = true; continue; }
        if (a.st === 'hostp') { if (now > a.hostBy) { this.abort(a.gid, w); again = true; } else wake(a.hostBy); continue; }
        if (a.st === 'wait') (byMode[a.mode] = byMode[a.mode] || []).push({ w, id: a.id, t: a.t, fill: a.fill, u: a.u });
        if (a.st === 'wait' || a.st === 'guestp') wake(now + CFG.TICK_MS);
      }
      for (const mode of Object.keys(byMode)) {
        const es = byMode[mode]; const p = planQueue(es, now);
        if (p.take) {
          const mem = p.take.map((id) => es.find((e) => e.id === id).w); const gid = crypto.randomUUID().slice(0, 8);
          const code = makeMatchCode((n) => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; });
          mem.forEach((w, i) => { const b = this.att(w); if (i === 0) { this.put(w, { ...b, st: 'hostp', gid, code, hostBy: now + CFG.HOST_OPEN_MS }); this.tx(w, { t: 'host', code, expect: mem.length - 1 }); wake(now + CFG.HOST_OPEN_MS); } else { this.put(w, { ...b, st: 'guestp', gid, code }); this.tx(w, { t: 'found', n: mem.length }); } });
          this.dirty.add(mode); again = true;
        } else if (p.startAt) { wake(p.startAt); if (this.dirty.has(mode)) for (const e of es) this.tx(e.w, { t: 'st', n: p.n, fillIn: Math.max(0, p.startAt - now) }); }
      }
      this.dirty.clear(); if (!again) break;
    }
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, now + 200));
  }
}
