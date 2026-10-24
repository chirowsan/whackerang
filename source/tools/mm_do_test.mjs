// v4.6: Matchmaker Durable Object test against a local `wrangler dev --local` (default ws://localhost:8799) or MM_URL. Pure queue logic is also tested.
import { createRequire } from 'module';
const req = createRequire('/tmp/wr/'); const WS = req('ws');
import { planQueue, clampFill, CFG } from '../server/cf-relay/matchplan.js';
const URL_ = process.env.MM_URL || 'ws://localhost:8799/m'; const ORIGIN = 'http://localhost:5173';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ---- pure logic
{
  const E = (id, t, fill = 120000, u) => ({ id, t, fill, u });
  ok(planQueue([], 0).take === null, 'plan: empty');
  ok(planQueue([E('a', 0)], 119999).take === null && planQueue([E('a', 0)], 120000).take.length === 1, 'plan: lone player waits for the 120 s deadline then plays with bots');
  ok(planQueue([E('a', 0), E('b', 10000)], 34999).take === null && planQueue([E('a', 0), E('b', 10000)], 35000).take.length === 2, 'plan: 2 players start 25 s after the second joined');
  ok(planQueue([E('a', 0), E('b', 1), E('c', 2), E('d', 3), E('e', 4)], 5).take.join() === 'a,b,c,d', 'plan: 4 start at once, oldest first, the 5th stays');
  ok(planQueue([E('a', 0, 8000), E('b', 1000)], 8000).take.length === 2, 'plan: a shorter personal deadline wins over the grace');
  ok(planQueue([E('a', 0), E('b', 1, 120000, 1)], 2).take.length === 2 && planQueue([E('a', 0, 120000, 1)], 2).take === null, 'plan: re-queued group re-forms at once, a lone re-queued player keeps searching');
  ok(clampFill(1) === 5000 && clampFill(9999) === 120000 && clampFill(undefined) === 120000 && clampFill('x') === 120000 && clampFill(30) === 30000, 'clampFill bounds 5..120 s');
}
const mk = (o = {}) => new Promise((res, rej) => {
  const ws = new WS(URL_, { headers: { Origin: o.origin || ORIGIN } }); const c = { ws, ev: [], t0: Date.now() };
  ws.on('message', (d) => { try { const m = JSON.parse(d.toString()); m.at = Date.now() - c.t0; c.ev.push(m); } catch (e) {} });
  ws.on('close', (code) => { c.closed = code; c.closeAt = Date.now() - c.t0; }); ws.on('open', () => res(c)); ws.on('unexpected-response', (r, resp) => rej(new Error('HTTP ' + resp.statusCode))); ws.on('error', rej);
  c.send = (o2) => ws.send(JSON.stringify(o2)); c.get = (t) => c.ev.find((e) => e.t === t); c.has = (t) => !!c.get(t);
  c.q = (mode = 'classic', fill) => c.send({ t: 'q', mode, fill, v: 1 }); c.wait = async (t, ms = 15000) => { const s = Date.now(); while (Date.now() - s < ms) { if (c.has(t)) return c.get(t); await sleep(50); } return null; };
});
const bad = async (o) => { try { await mk(o); return 'open'; } catch (e) { return e.message; } };
try {
  ok((await bad({ origin: 'https://evil.example' })) === 'HTTP 403', 'origin check: foreign origin refused');
  const hz = await (await fetch(URL_.replace('ws', 'http').replace('/m', '/m'))).status; ok(hz === 426, 'plain GET /m refused (websocket only) -> ' + hz);
  // 1. lone player, short deadline
  { const a = await mk(); a.q('classic', 5); const st = await a.wait('st', 3000); ok(st && st.n === 1 && st.fillIn > 3500 && st.fillIn <= 5000, 'lone: status n=1 fillIn~5s ' + JSON.stringify(st));
    const h = await a.wait('host', 9000); ok(h && h.expect === 0 && /^[BCDFGHJKLMNPQRSTVWXZ]{5}$/.test(h.code) && h.at > 4500 && h.at < 7500, 'lone: becomes host with 0 guests at the deadline ' + JSON.stringify(h));
    a.send({ t: 'open' }); await sleep(500); ok(a.has('ok') && a.closed === 1000, 'lone: open acked and closed'); }
  // 2. two players pair (personal deadline 8 s < 25 s grace)
  { const a = await mk(); a.q('classic', 8); await sleep(1500); const b = await mk(); b.q('classic', 8);
    await sleep(500); ok(a.ev.filter((e) => e.t === 'st').pop().n === 2 && b.get('st').n === 2, 'pair: both see n=2');
    const h = await a.wait('host', 9000); const f = await b.wait('found', 3000); ok(h && h.expect === 1 && f && f.n === 2 && !b.has('host'), 'pair: oldest hosts, second is guest');
    await sleep(500); ok(!b.has('go'), 'pair: guest waits for the host to open'); a.send({ t: 'open' }); const g = await b.wait('go', 3000); ok(g && g.code === h.code, 'pair: guest gets the host code after open'); await sleep(300); ok(b.closed === 1000 && a.closed === 1000, 'pair: sockets released'); }
  // 3. four players: immediate
  { const P = []; for (let i = 0; i < 4; i++) { const p = await mk(); p.q('classic'); P.push(p); await sleep(60); }
    const h = await P[0].wait('host', 2000); ok(h && h.expect === 3 && h.at < 2000, 'four: room fills -> host at once, expect 3'); ok((await Promise.all([1, 2, 3].map((i) => P[i].wait('found', 1000)))).every((f) => f && f.n === 4), 'four: three guests found');
    // host fails -> guests requeue and re-form at once with a new host
    P[0].send({ t: 'fail' }); await sleep(700); ok(P[1].has('requeue') && P[2].has('requeue') && P[3].has('requeue'), 'host fail: guests told to search again');
    const h2 = P[1].get('host'); ok(h2 && h2.expect === 2 && h2.code !== h.code, 'host fail: group re-forms at once with the next-oldest as host ' + JSON.stringify(h2)); ok(P[0].closed === 1000, 'host fail: failed host removed');
    P[1].send({ t: 'open' }); const g = await P[2].wait('go', 2000); ok(g && g.code === h2.code && (await P[3].wait('go', 1000)), 'host fail: guests get the new room'); }
  // 4. cancel / disconnect updates the count; a different mode is a different queue
  { const a = await mk(); a.q('classic', 60); const b = await mk(); b.q('classic', 60); const c = await mk(); c.q('ctf', 60); await sleep(600);
    ok(a.ev.filter((e) => e.t === 'st').pop().n === 2 && c.get('st').n === 1, 'modes: classic n=2, ctf n=1 (separate queues)');
    b.send({ t: 'bye' }); await sleep(500); ok(a.ev.filter((e) => e.t === 'st').pop().n === 1, 'cancel: other player sees n=1');
    const b2 = await mk(); b2.q('classic', 60); await sleep(300); b2.ws.terminate(); await sleep(700); ok(a.ev.filter((e) => e.t === 'st').pop().n === 1, 'disconnect without bye: removed from the queue');
    a.ws.close(); c.ws.close(); await sleep(300); }
  // 5. host never opens its room -> 10 s timeout, guest re-queued
  { const a = await mk(); a.q('classic', 60); const b = await mk(); b.q('classic', 60); const c = await mk(); c.q('classic', 60); const d = await mk(); d.q('classic', 60);
    await a.wait('host', 2000); const t0 = Date.now(); await sleep(26500); ok(a.closed === 1000 && b.has('requeue') && b.has('host') && b.get('host').expect === 2, 'host timeout: unresponsive host dropped after ~25 s (v4.6.2), others re-formed (took ' + (b.get('host') ? b.get('host').at - 0 : '?') + ' ms)'); [b, c, d].forEach((x) => x.ws.close()); await sleep(300); }
  // 6. bad input
  { const a = await mk(); a.q('nonsense'); await sleep(500); ok(a.has('err') && a.closed === 4400, 'bad mode rejected'); const b = await mk(); b.ws.send('{{{'); await sleep(400); ok(b.closed === 1003, 'garbage closed');
    const c = await mk(); c.ws.send(JSON.stringify({ t: 'q', mode: 'classic', fill: 60, x: 'y'.repeat(400) })); await sleep(400); ok(c.closed === 1003, 'oversize message closed');
    const d = await mk(); d.send({ t: 'noop' }); await sleep(10600); ok(d.closed === 4008, 'no queue request within 10 s -> closed (a socket that never sends anything is not closed by local workerd; real clients always send q at once)'); }
  // 7. flood: rate limit, then per-IP cap
  { const a = await mk(); a.q('classic', 60); for (let i = 0; i < 40; i++) a.send({ t: 'noop' }); await sleep(600); ok(a.closed === 4029, 'rate limit closes a flooding socket'); }
  { const S = []; let refused = ''; for (let i = 0; i < 10; i++) { try { S.push(await mk()); } catch (e) { refused = e.message; } } if (process.env.MM_LIVE) console.log('SKIP per-IP cap on live (this box egresses via a rotating NAT pool, every connection has a different IP): ' + S.length + ' sockets'); else ok(S.length === 8 && refused === 'HTTP 429', 'per-IP cap: 8 sockets, then 429 (' + S.length + ', ' + refused + ')'); S.forEach((x) => x.ws.close()); await sleep(300); }
} catch (e) { fail++; console.log('FAIL exception ' + e.stack); }
console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
