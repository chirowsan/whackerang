// v4.3 live check: two real browsers on the DEPLOYED site (https://chirowsan.github.io/whackerang/) + the DEPLOYED Worker. Guest forces the relay path (no direct attempt); also a second run with direct blocked (icePolicy=relay) to see the automatic fallback.
import { openN, ev, sleep, waitFor } from './netlib.mjs';
const URL_ = process.argv[2] || 'https://chirowsan.github.io/whackerang/'; const OUT = '/workspace/out/v4.3-shots/';
const R = []; const ok = (n, v, i) => { R.push({ n, pass: !!v }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
async function run(name, guestExtra, shotName) {
  console.log('--- ' + name);
  const T = await openN(2, { url: URL_, rly: undefined, w: 915, h: 412, mobile: true }); // rly '' default is overridden below: use the built-in live relay
  const [H, G] = T.pages;
  try {
    for (const p of T.pages) await ev(p, () => { delete window.__bbNet.rly; delete window.__bbNet.relay; delete window.__bbNet.ice; });
    await ev(G, (x) => Object.assign(window.__bbNet, x), guestExtra);
    const h = await ev(H, async () => await __bg.net.host()); ok(name + ': host created room', h && h.code, h);
    const t0 = Date.now(); await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code);
    const lobby = await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 40000, 250); const dt = Date.now() - t0;
    ok(name + ': guest joined lobby', lobby, dt); const ct = await ev(G, () => __bg.net.conType); ok(name + ': guest connection is relay', ct === 'relay', ct);
    await ev(G, () => { __bg.UI.show('netLobby'); }); await ev(H, () => { __bg.UI.show('netLobby'); }); await sleep(900);
    await G.page.screenshot({ path: OUT + shotName + '-guest-lobby.png' });
    await ev(G, () => __bg.net.setReady(true)); await sleep(600); await ev(H, () => { __bg.net.setSetting('mode', 'classic'); __bg.net.startMatch(); });
    await sleep(9000); const sg = await ev(G, () => __bg.net.stats()); ok(name + ': guest gets snapshots over the live relay', sg.snaps > 30, sg.snaps);
    ok(name + ': in-match state on both', (await ev(G, () => !!__bg.app.game && __bg.app.game.fighters.length >= 2)) && (await ev(H, () => !!__bg.app.game && __bg.app.game.fighters.length >= 2)));
    await G.page.screenshot({ path: OUT + shotName + '-guest-match.png' });
    const errs = T.pages.flatMap((p) => p.errors.filter((e) => !/favicon|0\.peerjs|peerjs|ERR_CONNECTION|WebSocket connection to 'wss:\/\/0\.peerjs/.test(e)));
    ok(name + ': no console errors (PeerJS broker noise excluded)', errs.length === 0, errs.slice(0, 3));
    console.log('peerjs-related console lines:', T.pages.flatMap((p) => p.errors.filter((e) => /peerjs/.test(e))).length);
  } finally { await T.close(); }
}
await run('live forced relay', { forceRelay: true }, 'live-relay');
await run('live direct blocked -> fallback', { icePolicy: 'relay' }, 'live-fallback');
const f = R.filter((r) => !r.pass); console.log(JSON.stringify({ summary: { pass: R.length - f.length, fail: f.length }, failed: f.map((x) => x.n) })); process.exit(f.length ? 1 : 0);
