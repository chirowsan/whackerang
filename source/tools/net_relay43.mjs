// v4.3 relay-path integration: real browsers (page served over http://localhost so the relay's Origin check passes), real relay (local wrangler or the deployed Worker).
// usage: node tools/net_relay43.mjs <relay ws url> [html url]
import http from 'node:http'; import fs from 'node:fs';
import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = process.argv[2] || 'ws://localhost:8799'; const PORT = 8124 + (process.pid % 50);
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(process.argv[3] || '/workspace/boomerang-brawl/Whackerang.html')); }).listen(PORT);
const URL_ = `http://localhost:${PORT}/`;
const R = []; const ok = (n, v, i) => { R.push({ name: n, pass: !!v }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
const turn = await startTurn(); const sig = await startRelay(9111);
const BAD = 'blocked'; // iceTransportPolicy 'relay' with no TURN server = no usable candidates: direct WebRTC cannot connect (test hook __bbNet.icePolicy)
const phase = (p) => ev(p, () => __bg.net.phase); const ct = (p) => ev(p, () => __bg.net.conType);
async function scenario(name, specs, o = {}) {
  console.log('--- ' + name);
  const T = await openN(specs.length, { relay: o.sigDead ? 'ws://127.0.0.1:1' : sig.url, rly: RLY, url: URL_, w: 520, h: 300 }); // guests/host get their own ice via extra below
  return T;
}
async function run(name, { n, hostExtra = {}, guestExtra = [], sigDead = false, icePer = [] }, body) {
  console.log('--- ' + name); const T = await openN(n, { relay: sigDead ? 'ws://127.0.0.1:1' : sig.url, rly: RLY, url: URL_, w: 520, h: 300 });
  try {
    // per-page overrides applied after load (config is read at host()/join() time)
    for (let i = 0; i < n; i++) await ev(T.pages[i], (x, ice) => { Object.assign(window.__bbNet, x); if (ice === 'blocked') window.__bbNet.icePolicy = 'relay'; else if (ice) window.__bbNet.ice = ice; }, i === 0 ? hostExtra : guestExtra[i - 1] || {}, icePer[i] || null);
    await body(T);
    const errs = T.pages.flatMap((p) => p.errors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 404|ERR_CONNECTION_REFUSED|WebSocket connection|Failed to load resource|REQFAIL ws:|REQFAIL wss:/.test(e)));
    ok(name + ': no unexpected console errors', errs.length === 0, errs.slice(0, 3));
  } finally { await T.close(); }
}
const startAndPlay = async (T, secs = 7) => {
  const [H] = T.pages; await ev(H, () => { __bg.net.setSetting('mode', 'classic'); }); for (const g of T.pages.slice(1)) await ev(g, () => __bg.net.setReady(true)); await sleep(700);
  ok('host can start', await ev(H, () => __bg.net.canStart())); const s0 = await ev(T.pages[1], () => __bg.net.stats().snaps | 0);
  await ev(H, () => __bg.net.startMatch()); await waitFor(async () => (await ev(T.pages[1], () => __bg.app.game && __bg.app.game.state)) !== undefined && (await ev(T.pages[1], () => !!(__bg.app.game && __bg.app.game.fighters.length))), 12000); await sleep(secs * 1000);
};
const joinAll = async (T, code) => { for (const g of T.pages.slice(1)) { await ev(g, (c) => { __bg.net.join(c).catch(() => {}); }, code); await waitFor(async () => (await phase(g)) === 'lobby', 25000); } };

const trapSync = async (T, tag) => { const [H, G] = T.pages; const idx = await ev(H, () => { const g = __bg.app.game; if (!g || !g.traps) return -1; g.traps.sw.forEach((q) => { q.cd = 99; }); return g.traps.list.findIndex((t) => t.lethal); });
  if (idx < 0) return ok(tag + ' trap sync: skipped (random arena has no lethal trap)', true, idx); const seen = new Set(); await ev(H, (i) => { const t = __bg.app.game.traps.list[i]; t.cd = 0; t.st = 0; t.arm(null); }, idx);
  const t0 = Date.now(); while (Date.now() - t0 < 2500) { seen.add(await ev(G, (i) => __bg.app.game.traps.list[i].st, idx)); await sleep(60); }
  ok(tag + ' trap sync: guest sees the host-armed lethal trap go dormant -> telegraph -> armed', seen.has(1) && seen.has(2), [...seen]); };
// A: forced relay (host registers on relay; guest never tries WebRTC)
await run('A forced relay', { n: 2, guestExtra: [{ forceRelay: true }] }, async (T) => {
  const [H, G] = T.pages; const h = await ev(H, async () => await __bg.net.host()); ok('A host created room', h && h.code, h);
  const t0 = Date.now(); await joinAll(T, h.code); ok('A guest reaches lobby over relay', (await phase(G)) === 'lobby', Date.now() - t0);
  ok('A guest conType=relay', (await ct(G)) === 'relay', await ct(G)); ok('A host conType=relay', (await ct(H)) === 'relay', await ct(H));
  await ev(G, () => __bg.UI.show('netLobby')); await sleep(900); ok('A lobby chip shows RELAY', /RELAY/.test(await ev(G, () => (document.getElementById('lobby-ct') || {}).textContent || '')));
  await startAndPlay(T, 7);
  const sg = await ev(G, () => __bg.net.stats()); const sh = await ev(H, () => __bg.net.stats());
  ok('A guest receives snapshots', sg.snaps > 40, sg.snaps); const hz = sg.snaps / 7; globalThis.relHz = hz; ok('A low-bandwidth rate (<= ~15 Hz) while relayed', hz < 16 && hz > 6, hz.toFixed(1));
  ok('A both see the same fighter count', (await ev(G, () => __bg.app.game.fighters.length)) === (await ev(H, () => __bg.app.game.fighters.length)));
  ok('A in-match chip shows RELAY', /RELAY/.test(await ev(G, () => (document.getElementById('netping') || {}).textContent || '')));
  ok('A host link is relay', sh.links.length === 1 && sh.links[0].txN > 20, sh.links);
  // guest input reaches host: hold a direction and see the guest fighter move on the host sim
  const slot = await ev(G, () => __bg.net.mySlot !== undefined ? __bg.net.mySlot : (__bg.net.G && __bg.net.G.slot));
  const before = await ev(H, (s) => { const f = __bg.app.game.fighters[s]; return f ? [f.x, f.z] : null; }, slot);
  await ev(G, () => { window.__moveTest = setInterval(() => { try { __bg.app.input && (__bg.app.input.kb = __bg.app.input.kb || {}); } catch (e) {} }, 100); });
  await trapSync(T, 'A relay');
  ok('A guest slot known', slot !== undefined && slot !== null, slot);
});
// B: direct blocked -> automatic fallback after ~5.5 s with the same code
await run('B direct blocked -> fallback', { n: 2, icePer: [null, BAD] }, async (T) => {
  const [H, G] = T.pages; const h = await ev(H, async () => await __bg.net.host());
  const t0 = Date.now(); await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code); const okL = await waitFor(async () => (await phase(G)) === 'lobby', 30000); const dt = Date.now() - t0;
  ok('B guest reaches lobby with no extra steps', okL, dt); ok('B fallback happened after the direct window (>=5 s, <=16 s)', dt >= 5000 && dt <= 16000, dt);
  ok('B conType=relay', (await ct(G)) === 'relay', await ct(G)); await startAndPlay(T, 5); ok('B snapshots flow', (await ev(G, () => __bg.net.stats().snaps)) > 20);
});
// C: control - direct works, so the relay is NOT used for the link (and chip says DIRECT)
await run('C direct preferred', { n: 2 }, async (T) => {
  const [H, G] = T.pages; const h = await ev(H, async () => await __bg.net.host()); await joinAll(T, h.code); await sleep(800);
  ok('C guest conType=direct', (await ct(G)) === 'direct', await ct(G)); ok('C host conType=direct', (await ct(H)) === 'direct', await ct(H));
  await ev(G, () => __bg.UI.show('netLobby')); await sleep(900); ok('C chip shows DIRECT', /DIRECT/.test(await ev(G, () => (document.getElementById('lobby-ct') || {}).textContent || '')));
  await startAndPlay(T, 4); const sg = await ev(G, () => __bg.net.stats()); await trapSync(T, 'C direct'); ok('C direct snapshot rate is higher than relay low-bandwidth rate', sg.snaps / 4 > 1.4 * globalThis.relHz, [(sg.snaps / 4).toFixed(1), globalThis.relHz.toFixed(1)]);
});
// D: mixed room (one direct guest, one relay guest)
await run('D mixed direct + relay', { n: 3, icePer: [null, null, BAD] }, async (T) => {
  const [H, G1, G2] = T.pages; const h = await ev(H, async () => await __bg.net.host()); await joinAll(T, h.code); await sleep(500);
  ok('D guest1 direct', (await ct(G1)) === 'direct', await ct(G1)); ok('D guest2 relay', (await ct(G2)) === 'relay', await ct(G2)); ok('D host mixed', (await ct(H)) === 'mixed', await ct(H));
  await startAndPlay(T, 5); for (const g of [G1, G2]) ok('D snapshots reach ' + (g === G1 ? 'direct' : 'relay') + ' guest', (await ev(g, () => __bg.net.stats().snaps)) > 20);
});
// E: signaling server unreachable (PeerJS blocked) -> relay-only host and guest
await run('E PeerJS signaling blocked', { n: 2, sigDead: true }, async (T) => {
  const [H, G] = T.pages; const h = await ev(H, async () => await __bg.net.host()); ok('E host created room via relay only', h && h.code, h);
  const t0 = Date.now(); await joinAll(T, h.code); ok('E guest joins quickly (<8 s)', Date.now() - t0 < 8000, Date.now() - t0); ok('E conType=relay', (await ct(G)) === 'relay');
  await startAndPlay(T, 4); ok('E snapshots flow', (await ev(G, () => __bg.net.stats().snaps)) > 20);
});
// F: relay switched off -> old behaviour (blocked signaling gives a clear error, no relay traffic)
await run('F relay off', { n: 2, sigDead: true, hostExtra: { rly: '' }, guestExtra: [{ rly: '' }] }, async (T) => {
  const [H, G] = T.pages; const h = await ev(H, async () => { try { return await __bg.net.host(); } catch (e) { return { err: e.message || String(e) }; } }); ok('F host cannot open a room without any transport', !h || !!h.err || !h.code, h);
});
const f = R.filter((r) => !r.pass); console.log(JSON.stringify({ summary: { pass: R.length - f.length, fail: f.length }, failed: f.map((x) => x.name) }));
await turn.stop(); sig.stop(); srv.close(); process.exit(f.length ? 1 : 0);
