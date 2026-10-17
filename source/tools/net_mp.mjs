// Multiplayer session test: N browsers (1 host + N-1 guests) over real WebRTC data channels (loopback via local STUN), autopilot input,
// optional simulated latency/jitter/loss. Reports desync metrics, console errors, snapshot rate and bandwidth per client.
import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const N = +(process.env.N || 2), MODE = process.env.MODE || 'classic', SECS = +(process.env.SECS || 60), DELAY = +(process.env.DELAY || 0), JITTER = +(process.env.JITTER || 0), LOSS = +(process.env.LOSS || 0), PORT = +(process.env.PORT || 9120);
const ARENA = process.env.ARENA || 'random', SPEED = process.env.SPEED || 'chill', SHOT = process.env.SHOT || '';
const turn = await startTurn(); const relay = await startRelay(PORT);
const T = await openN(N, { relay: relay.url, w: +(process.env.W || 480), h: +(process.env.H || 270), shim: DELAY || LOSS || JITTER ? { delay: DELAY, jitter: JITTER, loss: LOSS } : null });
const [H, ...G] = T.pages; const out = { N, MODE, SECS, DELAY, JITTER, LOSS };
// autopilot: replaces keyboard input on every page (host and guests alike)
const AUTOPILOT = () => {
  const I = __bg.Input; if (I.__orig) return; I.__orig = I.read; let t = 0, ph = Math.random() * 6, fireUntil = 0, nextFire = 1 + Math.random() * 2, dashAt = 2 + Math.random() * 3;
  I.read = (slot, f) => {
    const g = __bg.app.game; const o = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }; if (!g || !f || slot !== 0 || g.state !== 'play') return o; t += 1 / 60; ph += 1 / 60;
    let best = null, bd = 1e9; for (const e of g.fighters) { if (e === f || !e.alive || e.team === f.team) continue; const d = Math.hypot(e.x - f.x, e.z - f.z); if (d < bd) { bd = d; best = e; } }
    const a = Math.sin(ph * 0.9) * 3 + Math.cos(ph * 0.37) * 2; o.mx = Math.cos(a); o.mz = Math.sin(a); if (best && bd > 6) { o.mx = (best.x - f.x) / bd; o.mz = (best.z - f.z) / bd; }
    if (best) { o.aimX = (best.x - f.x) / bd; o.aimZ = (best.z - f.z) / bd; }
    if (t > nextFire) { fireUntil = t + 0.45; nextFire = t + 1.6 + Math.random() * 1.5; } o.fire = t < fireUntil; if (t > dashAt) { o.dash = true; dashAt = t + 3 + Math.random() * 3; } if (f.ult >= 100 && Math.random() < 0.02) o.ult = true; if (Math.random() < 0.01) o.deflect = true; return o;
  };
};
const host = await ev(H, async (mode, arena, speed) => { const n = __bg.net; const r = await n.host(); n.setSetting('mode', mode); n.setSetting('arena', arena); n.setSetting('speed', speed); n.setSetting('rounds', 2); return r; }, MODE, ARENA, SPEED);
out.code = host.code; out.signal = host.signal;
await Promise.all(G.map((p) => ev(p, (c) => { __bg.net.join(c).catch((e) => console.log('joinerr ' + e.message)); }, host.code)));
out.joined = !!(await waitFor(async () => (await Promise.all(G.map((p) => ev(p, () => __bg.net.phase)))).every((x) => x === 'lobby'), 25000));
if (!out.joined) { out.errors = T.pages.map((p) => p.errors); console.log(JSON.stringify(out, null, 1)); await T.close(); relay.stop(); turn.stop(); process.exit(1); }
await Promise.all(G.map((p) => ev(p, () => __bg.net.setReady(true)))); await sleep(600);
for (const p of T.pages) await ev(p, AUTOPILOT);
await ev(H, () => { const n = __bg.net; window.__hist = new Map(); const o = n.afterStep.bind(n); n.afterStep = function () { o(); const g = __bg.app.game, Hh = n.H; if (!g || !Hh || Hh.snapN % 3 !== 0) return; window.__hist.set(Hh.tick + ':' + g.round, g.fighters.map((f) => [f.x, f.z, f.alive ? 1 : 0, f.ammo, f.lives, Math.round(f.score || 0)])); if (window.__hist.size > 260) window.__hist.delete(window.__hist.keys().next().value); }; });
await ev(H, () => { __bg.net.startMatch(); }); await sleep(2500);
const samples = []; const t0 = Date.now(); let shot = false; const SC = T.pages.slice(1).map((_, i) => ({ guest: i + 1, snapsMatched: 0, fighterRecords: 0, mismatches: 0, maxPosErr: 0 }));
const snapCheck = async () => { const hist = await ev(H, () => [...window.__hist.entries()]); const hm = new Map(hist); for (let gi = 1; gi < T.pages.length; gi++) { const bufs = await ev(T.pages[gi], () => { const w = __bg.net.world; const g = __bg.app.game; return w ? { round: g.round, b: w.buf.map((S) => [S.tick, S.f.map((f) => [f.x, f.z, (f.fl & 1) ? 1 : 0, f.ammo, f.lives, f.score])]) } : null; }); const c = SC[gi - 1]; if (bufs) for (const [tick, fs] of bufs.b) { const hv = hm.get(tick + ':' + bufs.round); if (!hv) continue; c.snapsMatched++; fs.forEach((gf, k) => { c.fighterRecords++; const hf = hv[k]; const e = Math.hypot(gf[0] - hf[0], gf[1] - hf[1]); c.maxPosErr = Math.max(c.maxPosErr, e); if (e > 0.01 || gf[2] !== hf[2] || gf[3] !== hf[3] || gf[4] !== hf[4] || gf[5] !== hf[5]) c.mismatches++; }); } } };
let simS = 0;
while (simS < SECS && (Date.now() - t0) / 1000 < SECS * 5) {
  await sleep(1000); simS = ((await ev(H, () => __bg.net.stat.steps)) || 0) / 60;
  const snaps = await Promise.all(T.pages.map((p) => ev(p, () => { const g = __bg.app.game; if (!g) return null; const n = __bg.net; return { t: performance.now(), st: g.state, round: g.round, f: g.fighters.map((f) => [+f.x.toFixed(2), +f.z.toFixed(2), f.alive ? 1 : 0, f.ammo, f.lives, f.score || 0]), booms: g.booms.length, crates: [...g.crateHp].filter((v) => v > 0).length, holes: [...g.hole].filter((v) => v !== 0).length, pu: g.powerups.length, coins: g.m2 && g.m2.coins ? g.m2.coins.length : -1, sc: g.m2 && g.m2.scores ? JSON.stringify(g.m2.scores) : '', ph: n.phase, rtt: Math.round(n.rtt), ws: n.world ? n.world.stats : null }; })));
  samples.push(snaps); await snapCheck();
  if (SHOT && !shot && (Date.now() - t0) / 1000 > 8) { shot = true; for (let i = 0; i < T.pages.length; i++) await T.pages[i].page.screenshot({ path: `${SHOT}-${i}.png` }); }
}
// analysis: compare each guest's view to the host's (same wall second; guests lag by interpolation delay, so compare discrete state loosely)
let aliveMis = 0, cmp = 0, posErr = [], crateMis = 0, scoreMis = 0, phaseBad = 0, stateMis = 0; const streak = {}; let persist = { crates: 0, holes: 0, pu: 0, coins: 0, score: 0 };
for (let k = 0; k < samples.length; k++) { const h = samples[k][0]; if (!h) continue; for (let i = 1; i < samples[k].length; i++) { const g = samples[k][i]; if (!g) continue; for (const key of ['crates', 'holes', 'pu', 'coins']) { const id = key + i; const mis = h[key] !== g[key] && h.st === 'play' && g.st === 'play' && h.round === g.round; streak[id] = mis ? (streak[id] || 0) + 1 : 0; if (streak[id] === 4) persist[key]++; } } }
out.persistentMismatch = persist;
for (const s of samples) { const h = s[0]; if (!h) continue; for (let i = 1; i < s.length; i++) { const g = s[i]; if (!g) { phaseBad++; continue; } cmp++; if (g.ph !== 'match' && g.ph !== 'results') phaseBad++; if (g.st !== h.st) stateMis++; h.f.forEach((hf, k) => { const gf = g.f[k]; if (!gf) return; if (hf[2] !== gf[2]) aliveMis++; if (hf[2] && gf[2]) posErr.push(Math.hypot(hf[0] - gf[0], hf[1] - gf[1])); }); if (h.crates !== g.crates) crateMis++; if (h.sc !== g.sc) scoreMis++; } }
posErr.sort((a, b) => a - b); const q = (p) => +(posErr[Math.floor(posErr.length * p)] || 0).toFixed(2);
out.cmp = cmp; out.aliveMismatchSamples = aliveMis; out.stateMismatch = stateMis; out.crateMismatch = crateMis; out.scoreMismatch = scoreMis; out.phaseBad = phaseBad; out.posErr = { p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1) };
const fin = await Promise.all(T.pages.map((p) => ev(p, () => { const s = __bg.net.stats(); return { role: s.role, phase: s.phase, steps: s.steps, snaps: s.snaps, snapBytes: s.snapBytes, links: s.links, world: s.world, rtt: s.rtt }; })));
const secs = (Date.now() - t0) / 1000 + 2.5; out.wallSeconds = +secs.toFixed(0); const hostSteps = fin[0].steps || 1; out.hostSimSeconds = +(hostSteps / 60).toFixed(1); out.clients = fin.map((f, i) => ({ snapsPerSimSecond: +(f.snaps / (hostSteps / 60)).toFixed(1), kBPerSimSecDown: +(f.links.reduce((a, l) => a + l.rx, 0) / 1024 / (hostSteps / 60)).toFixed(2), kBPerSimSecUp: +(f.links.reduce((a, l) => a + l.tx, 0) / 1024 / (hostSteps / 60)).toFixed(2), i, role: f.role, phase: f.phase, rtt: f.rtt, snapRateHz: +(f.snaps / secs).toFixed(1), rxKBps: +(f.links.reduce((a, l) => a + l.rx, 0) / 1024 / secs).toFixed(2), txKBps: +(f.links.reduce((a, l) => a + l.tx, 0) / 1024 / secs).toFixed(2), world: f.world && { late: f.world.late, starved: f.world.starved, errs: f.world.errs, corr: f.world.corr, maxErr: f.world.maxErr, interpMs: Math.round(f.world.interp * 1000) } }));
out.snapCheck = SC.map((c) => ({ ...c, maxPosErr: +c.maxPosErr.toFixed(4) })); out.hostLinks = fin[0].links.length; out.errors = T.pages.map((p) => p.errors.filter((e) => !/favicon/.test(e)));
out.final = samples[samples.length - 1].map((s) => s && { st: s.st, f: s.f.map((f) => f.join(':')) });
console.log(JSON.stringify(out, null, 1));
await T.close(); relay.stop(); turn.stop();
