import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const turn = await startTurn(); const relay = await startRelay(9195); const T = await openN(2, { relay: relay.url, w: 480, h: 270 }); const [H, G] = T.pages;
const c = await ev(H, async () => (await __bg.net.host()).code); await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, c); await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 20000);
await ev(G, () => __bg.net.setReady(true)); await sleep(400); await ev(H, () => __bg.net.startMatch()); await sleep(3000);
await ev(H, () => __bg.app.quitToMenu()); await sleep(2500);
console.log(await ev(G, () => JSON.stringify({ cur: __bg.UI.cur, mode: __bg.app.mode, err: __bg.net.error, txt: document.querySelector('#ui').innerText.slice(0, 200) })));
console.log(G.errors, H.errors); await T.close(); relay.stop(); turn.stop();
