// v4.3: Cloudflare relay transport. Same interface as rtc.js Link (send(kind,data) / onrel / onfast / onopen / onclose / close / stat), carried over ONE WebSocket per player.
// Wire format: see server/cf-relay/worker.js. kind byte 0 = reliable JSON control, 1 = fast binary.
import { netCfg } from './rtc.js';
import { STORE } from '../flags.js';
export const RELAY_URL = 'wss://whackerang-relay.chirowsan-backyard.workers.dev';
export const relayBase = () => { if (STORE) return RELAY_URL; const c = netCfg(); try { const q = new URLSearchParams(location.search); if (q.get('norelay') === '1') localStorage.setItem('whk.rly', 'off'); else if (q.get('norelay') === '0') localStorage.removeItem('whk.rly'); } catch (e) {} if (c.rly !== undefined) return c.rly || ''; try { const u = localStorage.getItem('whk.rly'); if (u === 'off') return ''; if (u && /^wss?:\/\//.test(u)) return u.replace(/\/$/, ''); } catch (e) {} return RELAY_URL; };
export const relayOn = () => !!relayBase();
const te = new TextEncoder(), td = new TextDecoder();

export class RelayConn {
  constructor(code, role) { this.code = code; this.role = role; this.ws = null; this.gid = 0; this.ready = false; this.onbin = null; this.onctl = null; this.onclose = null; this.closed = false; this.hb = 0; this.errCode = null; }
  connect(timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      let done = false; const fail = (e) => { if (done) return; done = true; clearTimeout(tm); try { this.ws && this.ws.close(); } catch (x) {} reject(e instanceof Error ? e : new Error(String(e))); };
      const tm = setTimeout(() => fail(new Error('timeout')), timeoutMs);
      let ws; try { ws = new WebSocket(`${relayBase()}/r/${this.code}?role=${this.role}`); } catch (e) { return fail(new Error('unreachable')); }
      ws.binaryType = 'arraybuffer'; this.ws = ws;
      ws.onerror = () => fail(new Error('unreachable'));
      ws.onclose = () => { clearInterval(this.hb); this.ready = false; if (!done) fail(new Error(this.errCode || 'unreachable')); else if (!this.closed && this.onclose) this.onclose(); };
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          if (ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (!done) { if (m.t === 'ready') { done = true; clearTimeout(tm); this.ready = true; this.gid = m.g | 0; this.hb = setInterval(() => { try { ws.send('ping'); } catch (e) {} }, 20000); resolve(this.gid); } else if (m.t === 'err') { this.errCode = m.r; fail(new Error(m.r)); } return; }
          this.onctl && this.onctl(m); return;
        }
        this.onbin && this.onbin(new Uint8Array(ev.data));
      };
    });
  }
  sendRaw(u8) { const ws = this.ws; if (!this.ready || !ws || ws.readyState !== 1) return false; try { ws.send(u8); return true; } catch (e) { return false; } }
  backlog() { return this.ws ? this.ws.bufferedAmount : 0; }
  close() { this.closed = true; this.ready = false; clearInterval(this.hb); try { this.ws && this.ws.close(); } catch (e) {} }
}
const toBytes = (data) => (typeof data === 'string' ? te.encode(data) : new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data));

// guest side: talks only to the host through the relay
export class RelayGuestLink {
  constructor(conn, o = {}) {
    this.o = o; this.conn = conn; this.relay = true; this.up = true; this.dead = false; this.stat = { tx: 0, rx: 0, txN: 0, rxN: 0, drop: 0 };
    conn.onbin = (u) => { if (u.length < 1) return; const kind = u[0]; const pl = u.subarray(1); this.stat.rx += pl.length; this.stat.rxN++; if (kind === 0) this.o.onrel && this.o.onrel(td.decode(pl)); else this.o.onfast && this.o.onfast(pl.buffer.slice(pl.byteOffset, pl.byteOffset + pl.byteLength)); };
    conn.onctl = (m) => { if (m.t === 'hostgone') this.lost('hostgone'); };
    conn.onclose = () => this.lost('relay-closed');
  }
  send(kind, data) {
    if (this.dead) return false; const fast = kind === 'fast'; if (fast && this.conn.backlog() > 48000) { this.stat.drop++; return false; }
    const pl = toBytes(data); const out = new Uint8Array(pl.length + 1); out[0] = fast ? 1 : 0; out.set(pl, 1); this.stat.tx += pl.length; this.stat.txN++; return this.conn.sendRaw(out);
  }
  lost(why) { if (this.dead) return; this.dead = true; this.o.onclose && this.o.onclose(why); }
  close() { this.dead = true; this.conn.close(); }
}

// host side: one connection, many guests (gid 1..3). Per-guest links share it; broadcasts go out as ONE frame with a guest bitmask.
export class RelayHub {
  constructor(code) { this.conn = new RelayConn(code, 'host'); this.links = new Map(); this.onjoin = null; this.onclose = null; this.stat = { tx: 0, txN: 0 }; this.dropped = false; }
  async connect(ms) {
    await this.conn.connect(ms);
    this.conn.onctl = (m) => { if (m.t === 'join') this.onjoin && this.onjoin(m.g | 0); else if (m.t === 'leave') { const l = this.links.get(m.g | 0); if (l) { this.links.delete(m.g | 0); l.lost('leave'); } } };
    this.conn.onbin = (u) => { if (u.length < 2) return; const l = this.links.get(u[0]); if (l) l.recv(u[1], u.subarray(2)); };
    this.conn.onclose = () => { this.dropped = true; for (const l of [...this.links.values()]) l.lost('relay-closed'); this.links.clear(); this.onclose && this.onclose(); };
  }
  link(gid, o) { const old = this.links.get(gid); if (old) old.lost('replaced'); const l = new RelayHostLink(this, gid, o); this.links.set(gid, l); return l; }
  sendMask(mask, kind, data) {
    if (!mask) return false; const fast = kind === 'fast'; if (fast && this.conn.backlog() > 96000) return false;
    const pl = toBytes(data); const out = new Uint8Array(pl.length + 2); out[0] = mask; out[1] = fast ? 1 : 0; out.set(pl, 2); this.stat.tx += pl.length; this.stat.txN++;
    for (const l of this.links.values()) if (mask & (1 << l.gid)) { l.stat.tx += pl.length; l.stat.txN++; }
    return this.conn.sendRaw(out);
  }
  close() { this.conn.close(); }
}
export class RelayHostLink {
  constructor(hub, gid, o) { this.hub = hub; this.gid = gid; this.o = o; this.relay = true; this.up = true; this.dead = false; this.stat = { tx: 0, rx: 0, txN: 0, rxN: 0, drop: 0 }; }
  recv(kind, pl) { if (this.dead) return; this.stat.rx += pl.length; this.stat.rxN++; if (kind === 0) this.o.onrel && this.o.onrel(td.decode(pl)); else this.o.onfast && this.o.onfast(pl.buffer.slice(pl.byteOffset, pl.byteOffset + pl.byteLength)); }
  send(kind, data) { if (this.dead) return false; return this.hub.sendMask(1 << this.gid, kind, data); }
  lost(why) { if (this.dead) return; this.dead = true; this.o.onclose && this.o.onclose(why); }
  close() { this.dead = true; if (this.hub.links.get(this.gid) === this) this.hub.links.delete(this.gid); }
}
