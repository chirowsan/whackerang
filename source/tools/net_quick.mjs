import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const turn = await startTurn(); const relay = await startRelay(9101); const T = await openN(2, { relay: relay.url });
const [A, B] = T.pages;
const r = await ev(A, async () => { const n = __bg.net; return await n.host(); }); console.log('host', JSON.stringify(r));
await ev(B, (c) => { __bg.net.join(c).catch((e) => console.log('joinerr', e.message)); }, r.code);
const ok = await waitFor(async () => (await ev(B, () => __bg.net.phase)) === 'lobby', 15000); console.log('guest lobby', ok);
console.log(JSON.stringify(await ev(A, () => __bg.net.lobby.players.map((p) => [p.slot, p.name, p.hero, p.conn]))));
await ev(B, () => __bg.net.setReady(true)); await sleep(500);
console.log('canStart', await ev(A, () => __bg.net.canStart()));
await ev(A, () => { __bg.net.setSetting('mode', 'classic'); __bg.net.startMatch(); }); await sleep(6000);
console.log('A', await ev(A, () => JSON.stringify(__bg.net.stats()).slice(0, 400)));
console.log('B', await ev(B, () => JSON.stringify(__bg.net.stats()).slice(0, 600)));
await sleep(8000);
for (const p of [A, B]) { console.log('errors', p.i, p.errors.slice(0, 5)); }
console.log(await ev(B, () => { const g = __bg.app.game; return g.fighters.map((f) => [f.x.toFixed(1), f.z.toFixed(1), f.alive, f.isBot]).join(' | ') + ' state=' + g.state; }));
console.log(await ev(A, () => { const g = __bg.app.game; return g.fighters.map((f) => [f.x.toFixed(1), f.z.toFixed(1), f.alive, f.isBot]).join(' | ') + ' state=' + g.state; }));
await T.close(); relay.stop(); turn.stop();
