// v4.6 Auto match: pure queue logic (no Cloudflare APIs) so it can be unit-tested in plain Node. Used by the Matchmaker Durable Object in worker.js.
export const CFG = {
  FILL_MS: 120000,     // default: bots fill the empty seats after at most this long
  FILL_MIN: 5000,      // a client may ask for a shorter deadline (test hook / "play now"), never below this
  GRACE_MS: 12000,     // v4.6.3: with 2+ players waiting, start ~12 s after the SECOND player joined (was 25 s) ...
  SETTLE_MS: 5000,     // ... but never sooner than 5 s after the LAST one joined (someone pressing right now is not cut off) ...
  GRACE_MAX: 22000,    // ... and never later than 22 s after the second one (a steady trickle of players cannot stall a group)
  FULL: 4,             // a full room starts immediately
  HOST_OPEN_MS: 25000, // the chosen host must confirm its room is open within this time
  NEW_MS: 10000,       // a socket must send its queue request within this time
  STALE_MS: 75000,     // no heartbeat (client pings every 20 s) for this long = dead entry
  MAX_SOCKETS: 300, PER_IP: 8, TICK_MS: 30000,
  ROOM_MS: 20 * 60000, // v4.6.3: an open Auto room (its host keeps the queue socket) can take late players for at most this long
  RES_MS: 25000,       // a seat handed to a late player stays reserved this long unless the host's seat report already counts it
};
export const MODES = ['classic', 'team', 'ctf', 'coins', 'ball', 'koth', 'bomb', 'crumble'];
export const clampFill = (v) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0) return CFG.FILL_MS; return Math.max(CFG.FILL_MIN, Math.min(CFG.FILL_MS, Math.round(n * 1000))); };
// v4.6.3: ONE queue for every mode (v4.6.2 split players by their Auto-match mode chip, so a 'classic' and a 'team' player never met).
// The group's host (the player who waited longest) decides the mode.
// entries: waiting players: {id, t (queue time ms), fill (personal deadline length ms), u (re-queued after a failed host)}. Returns {take: ids (oldest first) or null, startAt: ms when this group would start, n}
export function planQueue(entries, now, cfg = CFG) {
  const w = entries.slice().sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); const n = w.length;
  if (!n) return { take: null, startAt: null, n: 0 };
  if (n >= cfg.FULL) return { take: w.slice(0, cfg.FULL).map((e) => e.id), startAt: now, n, why: 'full' };
  let startAt = Math.min(...w.map((e) => e.t + e.fill)); let why = 'deadline';
  if (n >= 2) { const g = Math.min(Math.max(w[1].t + cfg.GRACE_MS, w[n - 1].t + cfg.SETTLE_MS), w[1].t + cfg.GRACE_MAX); if (g < startAt) { startAt = g; why = 'grace'; } }
  if (n >= 2 && w.some((e) => e.u) && now < startAt) { startAt = now; why = 'requeue'; } // a group broken by a failed host re-forms at once (a lone player keeps searching)
  if (now >= startAt) return { take: w.map((e) => e.id), startAt, n, why };
  return { take: null, startAt, n, why };
}
const ALPHA = 'BCDFGHJKLMNPQRSTVWXZ';
export const makeMatchCode = (rnd) => { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[rnd(ALPHA.length)]; return s; };
// v4.6.3: open Auto rooms that still have seats. rooms: [{id, free, ph ('lobby'|'match'), rt (opened at), res (reserved seats)}]; entry: {v}. Old (v1) clients only go to rooms
// still in the lobby; v2 clients may also drop into a running match, taking over a bot. The room opened earliest wins (fills rooms before making new ones).
export function pickRoom(rooms, entry, now, cfg = CFG) {
  const ok = rooms.filter((r) => !(entry.skip || []).includes(r.code) && r.free - (r.res || 0) > 0 && now - r.rt < cfg.ROOM_MS && (r.ph === 'lobby' || (r.ph === 'match' && (entry.v | 0) >= 2)));
  ok.sort((a, b) => (a.ph === 'lobby' ? 0 : 1) - (b.ph === 'lobby' ? 0 : 1) || a.rt - b.rt); return ok[0] || null;
}
export const cleanName = (s) => { s = String(s || ''); return /^[A-Za-z][A-Za-z ]{0,15}$/.test(s) ? s : ''; };
export const cleanCid = (s) => String(s || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
