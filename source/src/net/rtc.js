// WebRTC plumbing: a signaling client (PeerJS-cloud wire protocol, also spoken by server/relay.mjs), a 2-channel data link, and the
// zero-server manual code exchange. No third-party libraries; all browsers' built-in RTCPeerConnection.
import { ICE_DEFAULT, DEFAULT_RELAY } from './proto.js';

export const netCfg = () => (typeof window !== 'undefined' && window.__bbNet) || {};
export const iceServers = () => { const c = netCfg(); if (c.ice) return c.ice; try { const j = JSON.parse(localStorage.getItem('whk.ice') || 'null'); if (Array.isArray(j) && j.length) return j; } catch (e) {} return ICE_DEFAULT; };
export const relayUrl = () => { const c = netCfg(); if (c.relay) return c.relay; try { const u = localStorage.getItem('whk.relay'); if (u && /^wss?:\/\//.test(u)) return u; } catch (e) {} return DEFAULT_RELAY; };
export const rtcSupported = () => typeof RTCPeerConnection !== 'undefined';

// ---------------------------------------------------------------- test hook: simulated latency / jitter / loss (only active when a test sets window.__bbNetShim)
const shimOf = () => (typeof window !== 'undefined' && window.__bbNetShim) || null;

// ---------------------------------------------------------------- signaling (PeerJS-cloud protocol: OPEN / OFFER / ANSWER / CANDIDATE / LEAVE / EXPIRE / ID-TAKEN / HEARTBEAT)
export class Signal {
  constructor(id, url) { this.id = id; this.url = url || relayUrl(); this.ws = null; this.open = false; this.onmsg = null; this.onclose = null; this.token = Math.random().toString(36).slice(2); this.hb = 0; this.closed = false; }
  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let done = false; const fail = (e) => { if (done) return; done = true; clearTimeout(tm); try { this.ws && this.ws.close(); } catch (x) {} reject(e instanceof Error ? e : new Error(String(e))); };
      const tm = setTimeout(() => fail(new Error('signaling-timeout')), timeoutMs);
      let ws; try { const sep = this.url.includes('?') ? '&' : '?'; ws = new WebSocket(`${this.url}${sep}id=${encodeURIComponent(this.id)}&token=${this.token}`); } catch (e) { return fail(new Error('signaling-unavailable')); }
      this.ws = ws;
      ws.onerror = () => fail(new Error('signaling-unavailable'));
      ws.onclose = () => { this.open = false; clearInterval(this.hb); if (!done) fail(new Error('signaling-unavailable')); else if (!this.closed && this.onclose) this.onclose(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!done) { if (m.type === 'OPEN') { done = true; clearTimeout(tm); this.open = true; this.hb = setInterval(() => { try { ws.send('{"type":"HEARTBEAT"}'); } catch (e) {} }, 5000); resolve(); } else if (m.type === 'ID-TAKEN') fail(new Error('id-taken')); else if (m.type === 'INVALID-KEY' || m.type === 'ERROR') fail(new Error('signaling-error')); return; }
        if (this.onmsg) this.onmsg(m);
      };
    });
  }
  send(type, dst, payload) {
    if (!this.open) return false;
    // The live PeerJS broker closes the sender unless OFFER/ANSWER/CANDIDATE payloads have the official PeerJS shape (type 'data' + connectionId, and label/reliable/serialization on OFFER). Our own fields (cid, proto) ride along.
    if (payload && (type === 'OFFER' || type === 'ANSWER' || type === 'CANDIDATE')) { const cn = 'dc_' + (payload.cid || ''); payload = { ...payload, type: 'data', connectionId: cn }; if (type === 'OFFER') { payload.label = cn; payload.reliable = false; payload.serialization = 'binary'; } }
    try { this.ws.send(JSON.stringify({ type, dst, payload })); return true; } catch (e) { return false; }
  }
  close() { this.closed = true; this.open = false; clearInterval(this.hb); try { this.ws && this.ws.close(); } catch (e) {} }
}

// ---------------------------------------------------------------- data link: ordered reliable 'rel' (JSON control) + unordered unreliable 'fast' (binary game traffic)
export class Link {
  constructor(o = {}) {
    this.o = o; this.pc = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 0, iceTransportPolicy: netCfg().icePolicy === 'relay' ? 'relay' : 'all' }); this.up = false; this.dead = false; this.stat = { tx: 0, rx: 0, txN: 0, rxN: 0, drop: 0 }; this.pend = []; this.relTail = 0; this.cand = [];
    this.rel = this.pc.createDataChannel('rel', { negotiated: true, id: 1, ordered: true });
    this.fast = this.pc.createDataChannel('fast', { negotiated: true, id: 2, ordered: false, maxRetransmits: 0 });
    this.fast.binaryType = this.rel.binaryType = 'arraybuffer';
    let nOpen = 0; const opened = () => { if (++nOpen === 2 && !this.up) { this.up = true; this.o.onopen && this.o.onopen(); } };
    this.rel.onopen = opened; this.fast.onopen = opened;
    const closed = () => this.lost('channel-closed');
    this.rel.onclose = closed; this.fast.onclose = closed;
    this.rel.onmessage = (e) => { this.stat.rx += (typeof e.data === 'string' ? e.data.length : e.data.byteLength); this.stat.rxN++; this.o.onrel && this.o.onrel(e.data); };
    this.fast.onmessage = (e) => { this.stat.rx += e.data.byteLength || 0; this.stat.rxN++; this.o.onfast && this.o.onfast(e.data); };
    this.pc.onicecandidate = (e) => { if (e.candidate) { this.cand.push(e.candidate.toJSON()); this.o.onice && this.o.onice(e.candidate.toJSON()); } };
    this.pc.oniceconnectionstatechange = () => { const s = this.pc.iceConnectionState; this.o.onstate && this.o.onstate(s); if (s === 'failed') this.lost('ice-failed'); };
    this.pc.onconnectionstatechange = () => { if (this.pc.connectionState === 'failed') this.lost('ice-failed'); };
  }
  async createOffer() { const d = await this.pc.createOffer(); await this.pc.setLocalDescription(d); return { type: d.type, sdp: d.sdp }; }
  async acceptOffer(off) { await this.pc.setRemoteDescription(off); const a = await this.pc.createAnswer(); await this.pc.setLocalDescription(a); return { type: a.type, sdp: a.sdp }; }
  async setAnswer(ans) { await this.pc.setRemoteDescription(ans); }
  async addCandidate(c) { try { await this.pc.addIceCandidate(c); } catch (e) { /* late/duplicate candidates are harmless */ } }
  gathered(ms = 4500) { return new Promise((res) => { if (this.pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, ms); this.pc.addEventListener('icegatheringstatechange', () => { if (this.pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }
  lost(why) { if (this.dead) return; this.dead = true; this.o.onclose && this.o.onclose(why); }
  // kind: 'rel' (string / small json) or 'fast' (ArrayBuffer). Optional test shim: delay + jitter + loss.
  send(kind, data) {
    const ch = kind === 'fast' ? this.fast : this.rel; if (this.dead || ch.readyState !== 'open') return false;
    const sh = shimOf(); const n = typeof data === 'string' ? data.length : data.byteLength;
    if (kind === 'fast' && ch.bufferedAmount > 48000) { this.stat.drop++; return false; }
    this.stat.tx += n; this.stat.txN++;
    if (!sh) { try { ch.send(data); } catch (e) { return false; } return true; }
    const loss = sh.loss || 0; const base = (sh.delay || 0) / 2, jit = (sh.jitter || 0);
    if (kind === 'fast') { if (Math.random() < loss) { this.stat.drop++; return true; } const d = Math.max(0, base + (Math.random() * 2 - 1) * jit); setTimeout(() => { try { if (ch.readyState === 'open') ch.send(data); } catch (e) {} }, d); }
    else { // reliable: a loss shows up as a retransmission delay, order is preserved
      let d = Math.max(0, base + (Math.random() * 2 - 1) * jit); if (Math.random() < loss) d += (sh.delay || 40) * 2 + 20; const at = Math.max(performance.now() + d, this.relTail + 0.01); this.relTail = at;
      setTimeout(() => { try { if (ch.readyState === 'open') ch.send(data); } catch (e) {} }, at - performance.now());
    }
    return true;
  }
  close() { this.dead = true; try { this.rel.close(); this.fast.close(); this.pc.close(); } catch (e) {} }
}

// ---------------------------------------------------------------- manual (zero-server) code exchange
const b64u = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (t) => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function pipe(u8, T) { const cs = new T('deflate-raw'); const w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
export async function packCode(kind, desc, cands) {
  // keep only the useful bits of the SDP; the receiving browser rebuilds the rest
  const o = JSON.stringify({ v: 1, k: kind, t: desc.type, s: desc.sdp });
  const raw = new TextEncoder().encode(o); let body, z = 0;
  if (typeof CompressionStream !== 'undefined') { try { body = await pipe(raw, CompressionStream); z = 1; } catch (e) { body = raw; } } else body = raw;
  return 'WK' + (z ? 'z' : 'r') + '.' + b64u(body);
}
export async function unpackCode(txt) {
  const t = String(txt || '').trim().replace(/\s+/g, ''); const m = /^WK([zr])\.([A-Za-z0-9_-]+)$/.exec(t); if (!m) throw new Error('bad-code');
  let u = unb64u(m[2]); if (m[1] === 'z') { if (typeof DecompressionStream === 'undefined') throw new Error('bad-code'); u = await pipe(u, DecompressionStream); }
  const o = JSON.parse(new TextDecoder().decode(u)); if (o.v !== 1 || !o.s || !o.t) throw new Error('bad-code'); return { kind: o.k, desc: { type: o.t, sdp: o.s } };
}
