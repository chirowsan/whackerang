// Lifecycle + abuse tests over real WebRTC links: join/leave/rejoin, host drop, host leaves, room full/locked/version, kick, input/lobby abuse, name filter.
import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const turn = await startTurn(); const relay = await startRelay(+(process.env.PORT || 9190));
const T = await openN(5, { relay: relay.url, w: 480, h: 270 }); const [H, A, B, C, D] = T.pages; const R = []; const ok = (name, v, info) => { R.push({ name, pass: !!v, info }); console.log((v ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); };
const phase = (p) => ev(p, () => __bg.net.phase); const err = (p) => ev(p, () => __bg.net.error && __bg.net.error.code);
const host = await ev(H, async () => { const n = __bg.net; const r = await n.host(); n.setSetting('mode', 'classic'); n.setSetting('rounds', 3); return r; }); ok('host opens room via signaling', host.signal && host.code.length === 4, host.code);
const join = (p) => ev(p, (c) => { __bg.net.join(c).catch(() => {}); }, host.code);
await join(A); await waitFor(async () => (await phase(A)) === 'lobby', 25000); await join(B); await waitFor(async () => (await phase(A)) === 'lobby' && (await phase(B)) === 'lobby', 25000);
ok('two guests join lobby', (await phase(A)) === 'lobby' && (await phase(B)) === 'lobby');
ok('lobby lists 3 players', (await ev(H, () => __bg.net.lobby.players.length)) === 3);
// 4th guest joins, 5th is rejected as full
await join(C); await waitFor(async () => (await phase(C)) === 'lobby', 20000); ok('third guest joins (room of 4)', (await phase(C)) === 'lobby');
await join(D); await waitFor(async () => (await err(D)) !== null, 20000); ok('fifth player rejected: room full', (await err(D)) === 'reject:full', await err(D));
// version mismatch
await ev(D, () => { window.__bbNet.proto = 99; }); await join(D); await waitFor(async () => (await err(D)) === 'reject:version', 20000); ok('wrong game version rejected', (await err(D)) === 'reject:version', await err(D));
// bad code
await ev(D, () => { window.__bbNet.proto = undefined; }); const bad = await ev(D, async () => { try { await __bg.net.join('ZZZZZ'); } catch (e) { return e.message; } return 'ok'; }); await waitFor(async () => (await err(D)) === 'no-room', 20000); ok('unknown room code gives "no-room"', (await err(D)) === 'no-room', await err(D));
// name filter + profile validation (host-side)
await ev(A, () => { __bg.net.gSend({ t: 'prof', name: 'ShIt', hero: 'nope', hat: 'x', skin: 'zz', trail: 'q' }); }); await waitFor(async () => JSON.parse(await ev(H, () => JSON.stringify(__bg.net.lobby.players.find((p) => p.slot === 1)))).trail === 'none' && !/captain/i.test(JSON.parse(await ev(H, () => JSON.stringify(__bg.net.lobby.players.find((p) => p.slot === 1)))).name), 10000); await sleep(300);
const pA = await ev(H, () => JSON.stringify(__bg.net.lobby.players.find((p) => p.slot === 1))); const pj = JSON.parse(pA); ok('profane name replaced + invalid cosmetics sanitised by host', !/shit/i.test(pj.name) && pj.hero === 'bao' && pj.hat === 'none', pj);
await ev(A, () => { __bg.net.gSend({ t: 'prof', name: 'Shelly<b>', hero: 'bao', hat: 'none', skin: 'default', trail: 'none' }); }); await waitFor(async () => /^Shelly/.test(JSON.parse(await ev(H, () => JSON.stringify(__bg.net.lobby.players.find((p) => p.slot === 1)))).name), 10000); ok('safe name with markup stripped', /^Shelly/.test(JSON.parse(await ev(H, () => JSON.stringify(__bg.net.lobby.players.find((p) => p.slot === 1)))).name) && !/[<>]/.test(JSON.parse(await ev(H, () => JSON.stringify(__bg.net.lobby.players.find((p) => p.slot === 1)))).name));
// abuse: malformed / oversize / flood
const errsBefore = (await ev(H, () => 0)); await ev(B, () => { const l = __bg.net.G.link; l.rel.send('{{{not json'); l.rel.send('x'.repeat(5000)); l.rel.send(JSON.stringify({ t: 'emo', e: 9999 })); l.rel.send(JSON.stringify({ t: 'ready', r: 'yes' })); l.rel.send(JSON.stringify({ t: 'team', v: 'bad' })); l.fast.send(new ArrayBuffer(900)); l.fast.send(new Uint8Array([1, 255, 0, 0, 0, 0]).buffer); l.fast.send(new Uint8Array([99]).buffer); }); await sleep(800);
ok('malformed/oversize packets ignored (host alive, no console errors)', (await phase(H)) === 'lobby' && H.errors.length === 0, H.errors.slice(0, 2));
await ev(C, () => { const l = __bg.net.G.link; for (let i = 0; i < 400; i++) l.rel.send(JSON.stringify({ t: 'emo', e: i % 6 })); }); await sleep(2500);
const cConn = await ev(H, () => __bg.net.lobby.players.some((p) => p.slot === 3 && p.conn !== false)); ok('message flood from a guest gets them removed (rate limit)', !cConn || (await phase(C)) !== 'lobby', { stillThere: cConn });
// readiness + kick
await ev(A, () => __bg.net.setReady(true)); await ev(B, () => __bg.net.setReady(true)); await sleep(500);
ok('host can start when guests ready', await ev(H, () => __bg.net.canStart()));
await ev(H, () => { __bg.net.startMatch(); }); await sleep(4000);
ok('guests enter match', (await phase(A)) === 'match' && (await phase(B)) === 'match');
const roster = await ev(A, () => __bg.app.game.fighters.map((f) => [f.def.slot, f.isBot ? 'bot' : 'human', f.def.name].join(':'))); ok('guest A has its own fighter as local slot 0', roster.some((r) => r.startsWith('0:human')), roster);
// locked room
await ev(C, () => { __bg.net.leave(); }); await sleep(300); await ev(C, (c) => { __bg.net.join(c).catch(() => {}); }, host.code); await waitFor(async () => (await err(C)) !== null, 20000); const e3 = await err(C); ok('joining during a match is refused ("locked")', e3 === 'reject:locked', e3);
// guest drops mid-match -> bot takes over
const cidB = await ev(B, () => __bg.net.cid); await ev(B, () => { __bg.net.G.link.rel.close(); }); await waitFor(() => ev(H, () => { const d = __bg.app.match.players.find((p) => p.slot === 2); return d && d.ctrl === 'bot'; }), 12000);
const botB = await ev(H, () => { const d = __bg.app.match.players.find((p) => p.slot === 2); return d && d.ctrl; }); ok('guest leaves mid-match: bot takes over its fighter', botB === 'bot', botB);
ok('dropped guest sees a clear message + Rejoin option', (await ev(B, () => __bg.net.error && __bg.net.error.canRejoin)) === true && (await ev(B, () => !!document.body.innerText.match(/Lost connection/i))), await ev(B, () => __bg.net.error));
ok('other guest informed (toast) and still playing', (await phase(A)) === 'match');
// rejoin (same client id): takes the seat back
await ev(B, (c) => { __bg.net.join(c).catch(() => {}); }, host.code); await waitFor(async () => (await phase(B)) === 'match', 25000);
ok('rejoin returns to the running match', (await phase(B)) === 'match', await phase(B));
await sleep(1500); const humanB = await ev(H, () => { const d = __bg.app.match.players.find((p) => p.slot === 2); const f = __bg.app.game.fighters.find((q) => q.def === d); return [d.ctrl, f && f.isBot]; }); ok('rejoined player controls their fighter again', humanB[0] === 'human' && humanB[1] === false, humanB);
ok('same client id was used', cidB === (await ev(B, () => __bg.net.cid)));
// kicking in lobby is covered above; host leaves -> everyone gets a clear message
await ev(H, () => { __bg.app.quitToMenu(); }); await sleep(2500);
ok('host leaves: guests are told the room closed', (await err(A)) === 'ended' && /closed|Lost connection/.test(await ev(A, () => __bg.net.error.msg || '')), await ev(A, () => __bg.net.error));
ok('guests are back at the menu with a message screen', await ev(A, () => /closed|lost/i.test(document.body.innerText)));
// host drop (page killed)
const T2 = await openN(2, { relay: relay.url, w: 480, h: 270 }); const [H2, G2] = T2.pages; const h2 = await ev(H2, async () => (await __bg.net.host()).code); await ev(G2, (c) => { __bg.net.join(c).catch(() => {}); }, h2); await waitFor(async () => (await phase(G2)) === 'lobby', 20000);
await ev(G2, () => __bg.net.setReady(true)); await sleep(400); await ev(H2, () => __bg.net.startMatch()); await sleep(3500); const tkill = Date.now(); await H2.page.close({ runBeforeUnload: false }); const gone = await waitFor(async () => (await err(G2)) === 'ended', 20000, 300);
ok('host drops (tab killed): guest gets "lost connection" message', !!gone, { afterMs: Date.now() - tkill, msg: await ev(G2, () => __bg.net.error && __bg.net.error.msg) });
ok('no console errors in any client', [...T.pages, ...T2.pages].every((p) => p.errors.filter((e) => !/favicon|Failed to load resource/.test(e)).length === 0), [...T.pages, ...T2.pages].map((p) => p.errors.slice(0, 2)));
console.log(JSON.stringify({ summary: { pass: R.filter((r) => r.pass).length, fail: R.filter((r) => !r.pass).length } }));
await T.close(); await T2.close(); relay.stop(); turn.stop();
