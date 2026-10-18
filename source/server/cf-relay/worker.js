// Whackerang room relay: Cloudflare Worker + one SQLite-backed Durable Object per room code (free plan).
// It only forwards opaque binary frames between ONE host and up to 3 guests. It never parses, stores or logs game data.
// Wire format (all game data is binary; control messages from the server are small JSON text frames):
//   guest -> relay : [kind u8][payload...]                  -> host receives [gid u8][kind u8][payload...]
//   host  -> relay : [mask u8][kind u8][payload...]         -> every guest whose bit (1<<gid) is set receives [kind u8][payload...]
//   kind 0 = reliable/ordered control (UTF-8 JSON), kind 1 = fast game traffic (binary).  gid 1..3.
//   relay -> host  (text) {"t":"join","g":1} / {"t":"leave","g":1}      relay -> guest (text) {"t":"ready","g":1} | {"t":"err","r":"nohost|full|taken|origin"} | {"t":"hostgone"}
//   clients -> relay (text) "ping" is answered "pong" by the runtime (WebSocketAutoResponse) without waking the object.
import { DurableObject } from 'cloudflare:workers';

const ORIGINS = new Set(['https://chirowsan.github.io', 'capacitor://localhost', 'https://localhost', 'http://localhost']);
const CODE = /^[A-Z]{4,5}$/;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/; // the app's own device (Capacitor https://localhost) and local development ports
const MAX_GUESTS = 3;
const MAX_BYTES = 16 * 1024;           // per frame
const HOST_RATE = 160, GUEST_RATE = 90; // frames per second (token bucket, 1 s burst)
const IDLE_ALONE_MS = 15 * 60 * 1000;   // host waiting in a lobby with nobody else
const IDLE_BUSY_MS = 45 * 1000;         // guests connected but no data at all
const hdr = (o) => ({ 'access-control-allow-origin': o || '*', 'cache-control': 'no-store' });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/healthz') return new Response('ok', { headers: { 'content-type': 'text/plain', ...hdr() } });
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
