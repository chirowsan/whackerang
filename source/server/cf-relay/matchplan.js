// v4.6 Auto match: pure queue logic (no Cloudflare APIs) so it can be unit-tested in plain Node. Used by the Matchmaker Durable Object in worker.js.
export const CFG = {
  FILL_MS: 120000,     // default: bots fill the empty seats after at most this long
  FILL_MIN: 5000,      // a client may ask for a shorter deadline (test hook / "play now"), never below this
  GRACE_MS: 25000,     // with 2+ players waiting, start this long after the SECOND player joined (instead of waiting for the full deadline)
  FULL: 4,             // a full room starts immediately
  HOST_OPEN_MS: 10000, // the chosen host must confirm its room is open within this time
  NEW_MS: 10000,       // a socket must send its queue request within this time
  STALE_MS: 75000,     // no heartbeat (client pings every 20 s) for this long = dead entry
  MAX_SOCKETS: 300, PER_IP: 4, TICK_MS: 30000,
};
export const MODES = ['classic', 'team', 'ctf', 'coins', 'ball', 'koth', 'bomb', 'crumble'];
export const clampFill = (v) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0) return CFG.FILL_MS; return Math.max(CFG.FILL_MIN, Math.min(CFG.FILL_MS, Math.round(n * 1000))); };
// entries: waiting players of ONE mode: {id, t (queue time ms), fill (personal deadline length ms), u (re-queued after a failed host)}. Returns {take: ids (oldest first) or null, startAt: ms when this group would start, n}
export function planQueue(entries, now, cfg = CFG) {
  const w = entries.slice().sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); const n = w.length;
  if (!n) return { take: null, startAt: null, n: 0 };
  if (n >= cfg.FULL) return { take: w.slice(0, cfg.FULL).map((e) => e.id), startAt: now, n, why: 'full' };
  let startAt = Math.min(...w.map((e) => e.t + e.fill)); let why = 'deadline';
  if (n >= 2 && w[1].t + cfg.GRACE_MS < startAt) { startAt = w[1].t + cfg.GRACE_MS; why = 'grace'; }
  if (n >= 2 && w.some((e) => e.u) && now < startAt) { startAt = now; why = 'requeue'; } // a group broken by a failed host re-forms at once (a lone player keeps searching)
  if (now >= startAt) return { take: w.map((e) => e.id), startAt, n, why };
  return { take: null, startAt, n, why };
}
const ALPHA = 'BCDFGHJKLMNPQRSTVWXZ';
export const makeMatchCode = (rnd) => { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[rnd(ALPHA.length)]; return s; };
