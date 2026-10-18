// v4.5 online countdown: host-authoritative start time, guest countdown ends together with the host's (direct, direct+simulated 150 ms each way, relay). Also: guests get exactly one set of events (no duplicate relayed countdown), lock during countdown, second round counts down again.
import http from 'node:http'; import fs from 'node:fs';
import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = process.argv[2] || 'ws://localhost:8799'; const PORT = 8190 + (process.pid % 50);
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(process.argv[3] || '/workspace/boomerang-brawl/Whackerang.html')); }).listen(PORT);
const URL_ = `http://localhost:${PORT}/`;
const R = []; const ok = (n, v, i) => { R.push({ name: n, pass: !!v }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
const turn = await startTurn(); const sig = await startRelay(9112);
const HOOK = () => { window.__dbg = []; if (__bg.net.roundMsg) { const rm = __bg.net.roundMsg.bind(__bg.net); __bg.net.roundMsg = () => { const m = rm(); window.__dbg.push({ send: Date.now(), goIn: m.goIn }); return m; }; } const gf = __bg.net.goAtFor.bind(__bg.net); __bg.net.goAtFor = (c) => { const r = gf(c); window.__dbg.push({ recv: Date.now(), goIn: c.goIn, rtt: __bg.net.rtt, goAtIn: r - performance.now() }); return r; }; window.__cd = []; const a = __bg.app; const o = a.gameEvent.bind(a); a.gameEvent = (n, d) => { if (n === 'countdown' || n === 'go' || n === 'cdclear') window.__cd.push({ n, c: d && d.n, t: Date.now() }); return o(n, d); }; };
async function scenario(name, { shim = null, guestExtra = {}, icePer = [] }) {
  console.log('--- ' + name); const T = await openN(2, { relay: sig.url, rly: RLY, url: URL_, w: 520, h: 300, shim });
  try {
    const [H, G] = T.pages;
    await ev(G, (x) => Object.assign(window.__bbNet, x), guestExtra);
    for (const p of T.pages) await ev(p, HOOK);
    const h = await ev(H, async () => await __bg.net.host()); ok(name + ': room created', h && h.code, h);
    await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code); await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 30000);
    await ev(H, () => __bg.net.setSetting('mode', 'classic')); await ev(G, () => __bg.net.setReady(true)); await sleep(1500);
    await sleep(2500); const rtt = await ev(G, () => __bg.net.rtt); // let pings settle so the guest knows its round trip
    // movement lock: record both human fighters at the first frame and again right before GO
    await ev(H, () => __bg.net.startMatch());
    await waitFor(async () => (await ev(G, () => __bg.app.game && __bg.app.game.state)) !== undefined && (await ev(G, () => (window.__cd || []).length)) > 0, 20000, 50);
    const lock = {}; for (const [k, p] of [['H', H], ['G', G]]) lock[k] = await ev(p, () => { const g = __bg.app.game; return { st: g.state, pos: g.fighters.map((f) => [f.x, f.z]) }; });
    await waitFor(async () => (await ev(G, () => (window.__cd || []).some((e) => e.c === 2))), 8000, 30); const mid = {}; for (const [k, p] of [['H', H], ['G', G]]) mid[k] = await ev(p, () => { const g = __bg.app.game; return { st: g.state, pos: g.fighters.map((f) => [f.x, f.z]), ov: document.getElementById('countdown').className, txt: document.querySelector('#countdown .cdnum').textContent }; });
    if (name === 'relay') { fs.mkdirSync('/workspace/out/v4.5-shots', { recursive: true }); await ev(G, () => { document.querySelectorAll('#countdown .cdnum').forEach((n) => n.getAnimations().forEach((a) => { a.pause(); a.currentTime = 380; })); const c = document.getElementById('countdown'); c.style.opacity = '0.999'; }); await sleep(700); await G.page.screenshot({ path: '/workspace/out/v4.5-shots/online-guest-relay-countdown.png' }); await ev(H, () => { document.querySelectorAll('#countdown .cdnum').forEach((n) => n.getAnimations().forEach((a) => { a.pause(); a.currentTime = 380; })); }); await H.page.screenshot({ path: '/workspace/out/v4.5-shots/online-host-countdown.png' }); }
    await waitFor(async () => (await ev(G, () => (window.__cd || []).some((e) => e.n === 'go'))) && (await ev(H, () => (window.__cd || []).some((e) => e.n === 'go'))), 10000, 50);
    const L = {}; for (const [k, p] of [['H', H], ['G', G]]) L[k] = await ev(p, () => window.__cd.slice());
    const seq = (l) => l.map((e) => e.n + (e.c !== undefined ? e.c : '')).join(',');
    ok(name + ': host events 4,3,2,1,GO once each', seq(L.H).startsWith('countdown4,countdown3,countdown2,countdown1,go') && L.H.filter((e) => e.n === 'go').length === 1, seq(L.H));
    ok(name + ': guest events 3,2,1,GO exactly once each (no duplicates from relayed host events)', /^(cdclear,)?(countdown4,)?(countdown3,)?countdown2,countdown1,go/.test(seq(L.G)) && L.G.filter((e) => e.n === 'go').length === 1 && L.G.filter((e) => e.n === 'countdown' && e.c === 2).length === 1, seq(L.G));
    const tg = (l, n, c) => (l.find((e) => e.n === n && (c === undefined || e.c === c)) || {}).t; const dGo = tg(L.G, 'go') - tg(L.H, 'go'), d1 = tg(L.G, 'countdown', 1) - tg(L.H, 'countdown', 1), d2 = tg(L.G, 'countdown', 2) - tg(L.H, 'countdown', 2);
    ok(name + ': guest GO within 350 ms of host GO (rtt ' + Math.round(rtt) + ' ms)', Math.abs(dGo) <= 350, { dGo, d1, d2, rtt: Math.round(rtt) }); globalThis.skew = globalThis.skew || []; globalThis.skew.push([name, dGo, Math.round(rtt)]);
    const span = (l) => tg(l, 'go') - tg(l, 'countdown', 3); ok(name + ': 3 -> GO is ~3 s on the host (a guest that built its arena late sees a shorter count, never a longer one)', span(L.H) <= 3300 && span(L.H) >= 1500 && (isNaN(span(L.G)) || (span(L.G) <= 3500 && span(L.G) >= 1500)), { host: span(L.H), guest: span(L.G) });
    const moved = (a, b) => Math.max(...a.pos.map((p, i) => Math.hypot(p[0] - b.pos[i][0], p[1] - b.pos[i][1])));
    ok(name + ': nobody moves during the countdown (host + guest views)', mid.H.st === 'intro' && moved(lock.H, mid.H) < 0.05 && moved(lock.G, mid.G) < 0.3, { H: moved(lock.H, mid.H), G: moved(lock.G, mid.G), hs: mid.H.st, gs: mid.G.st });
    ok(name + ': overlay shows a number on the guest mid-countdown', /^[123]$/.test(mid.G.txt) && mid.G.ov === 'on', mid.G);
    await sleep(2500); const after = await ev(G, () => ({ s: __bg.app.game.state, ov: document.getElementById('countdown').className })); ok(name + ': after GO guest is in play and the overlay is gone', after.s === 'play' && after.ov === '', after);
    // second round (what the host does after a round ends): countdown again on both
    await ev(H, () => { window.__cd.length = 0; }); await ev(G, () => { window.__cd.length = 0; });
    await ev(H, () => __bg.app.nextRound()); await sleep(5200);
    const L2 = {}; for (const [k, p] of [['H', H], ['G', G]]) L2[k] = await ev(p, () => window.__cd.map((e) => e.n + (e.c !== undefined ? e.c : '')).join(','));
    ok(name + ': round 2 counts down again on host and guest', /countdown3,countdown2,countdown1,go/.test(L2.H) && /countdown2,countdown1,go/.test(L2.G), L2);
    console.log('DBG', JSON.stringify([await ev(H, () => window.__dbg), await ev(G, () => window.__dbg)]));
    const errs = T.pages.flatMap((p) => p.errors.filter((e) => !/favicon|Failed to load resource|ERR_CONNECTION_REFUSED|WebSocket connection|REQFAIL ws:|REQFAIL wss:/.test(e))); ok(name + ': no unexpected console errors', errs.length === 0, errs.slice(0, 3));
  } finally { await T.close(); }
}
if (!process.env.ONLY || process.env.ONLY === 'direct') await scenario('direct', {});
if (!process.env.ONLY || process.env.ONLY === 'shim') await scenario('direct +150ms each way', { shim: { delay: 150, jitter: 25, loss: 0 } });
if (!process.env.ONLY || process.env.ONLY === 'relay') await scenario('relay', { guestExtra: { forceRelay: true } });
console.log('SKEW', JSON.stringify(globalThis.skew));
for (const p of []) {}
const f = R.filter((r) => !r.pass); console.log(JSON.stringify({ summary: { pass: R.length - f.length, fail: f.length }, failed: f.map((x) => x.name) }));
await turn.stop(); sig.stop(); srv.close(); process.exit(f.length ? 1 : 0);
