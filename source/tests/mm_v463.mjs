// v4.6.3 Matchmaker protocol v2 test: one queue across modes, 12 s grace, open Auto rooms keep a seat count, late players are sent straight in,
// same-tab (cid) re-search is idempotent, v1 (v4.6.2) clients still work. Run against local wrangler dev (default) or MM_URL=wss://.../m.
import { createRequire } from 'module';
const req = createRequire('/tmp/wr/'); const WS = req('ws');
const URL_ = process.env.MM_URL || 'ws://localhost:8799/m'; const ORIGIN = process.env.MM_ORIGIN || 'http://localhost:5173';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = () => Math.random().toString(36).slice(2, 10);
const mk = () => new Promise((res, rej) => {
  const ws = new WS(URL_, { headers: { Origin: ORIGIN } }); const c = { ws, ev: [], t0: Date.now() };
  ws.on('message', (d) => { try { const m = JSON.parse(d.toString()); m.at = Date.now() - c.t0; c.ev.push(m); } catch (e) {} });
  ws.on('close', (code) => { c.closed = code; }); ws.on('open', () => res(c)); ws.on('unexpected-response', (r, resp) => rej(new Error('HTTP ' + resp.statusCode))); ws.on('error', rej);
  c.send = (o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} }; c.all = (t) => c.ev.filter((e) => e.t === t); c.get = (t) => c.ev.find((e) => e.t === t); c.last = (t) => c.all(t).pop();
  c.q = (o = {}) => c.send({ t: 'q', mode: o.mode || 'classic', fill: o.fill || 60, v: o.v || 2, cid: o.cid === undefined ? rid() : o.cid, nm: o.nm || '' });
  c.wait = async (t, ms = 15000) => { const s = Date.now(); while (Date.now() - s < ms) { const e = c.get(t); if (e) return e; await sleep(50); } return null; };
  c.end = () => { try { ws.close(); } catch (e) {} };
});
const done = async (...cs) => { for (const c of cs) { if (c.closed === undefined && c.get('ok')) c.send({ t: 'closed' }); c.end(); } await sleep(400); };
try {
  // 1. two players in DIFFERENT modes share one queue; the host's mode wins; start ~12 s after the second
  { const a = await mk(); a.q({ mode: 'classic', nm: 'Ann' }); await sleep(500); const b = await mk(); b.q({ mode: 'team', nm: 'Bob' }); const tb = Date.now();
    await sleep(600); ok(a.last('st').n === 2 && b.last('st').n === 2, 'modes: classic + team players see each other (n=2)');
    ok((a.last('st').names || []).join() === 'Ann,Bob', 'names broadcast in queue order ' + JSON.stringify(a.last('st').names));
    const h = await a.wait('host', 16000); const dt = Date.now() - tb; ok(h && h.expect === 1 && h.mode === 'classic' && dt > 10500 && dt < 14500, 'grace: oldest hosts ~12 s after the second joined (' + dt + ' ms) ' + JSON.stringify(h));
    const f = await b.wait('found', 2000); ok(f && f.mode === 'classic', 'guest told the room mode');
    a.send({ t: 'open' }); const g = await b.wait('go', 3000); await sleep(300); ok(g && g.code === h.code && g.mode === 'classic', 'guest gets code + mode');
    ok(a.get('ok') && a.closed === undefined, 'v2 host keeps its socket open as the room beacon');
    // 2. late player joins the open lobby room
    a.send({ t: 'seats', free: 2, ph: 'lobby' }); await sleep(300);
    const c = await mk(); c.q({ nm: 'Cy' }); const gc = await c.wait('go', 3000); ok(gc && gc.code === h.code && gc.late === 1 && gc.ph === 'lobby', 'late: 3rd player sent straight into the open lobby ' + JSON.stringify(gc));
    const inc = await a.wait('inc', 1000); ok(inc && inc.nm === 'Cy' && inc.s === 1, 'late: host told a player is coming ' + JSON.stringify(inc));
    // 3. room in match with 1 free seat (one reserved now for Cy => no more until host reports)
    a.send({ t: 'seats', free: 1, ph: 'match', ack: 1 }); await sleep(300);
    const d = await mk(); d.q({ v: 1 }); await sleep(1500); ok(!d.get('go'), 'v1 (v4.6.2) searcher is NOT sent into a match already running');
    const e = await mk(); e.q({}); const ge = await e.wait('go', 3000); ok(ge && ge.code === h.code && ge.ph === 'match', 'v2 searcher takes over a bot mid-match ' + JSON.stringify(ge));
    const f2 = await mk(); f2.q({}); await sleep(1500); ok(!f2.get('go') && f2.last('st') && f2.last('st').n === 2, 'reserved seat not given twice: next player queues (n=2 with the v1 one)');
    // 4. full / closed rooms take nobody
    a.send({ t: 'seats', free: 0, ph: 'match', ack: 2 }); await sleep(300); ok(!f2.get('go') && !d.get('go'), 'full room takes nobody');
    a.send({ t: 'closed' }); await sleep(400); ok(a.closed === 1000, 'closed room releases the host socket');
    await done(a, b, c, d, e, f2); }
  // 5. idempotent join: same tab id searching twice replaces the old entry, keeps its place
  { const cid = rid(); const a = await mk(); a.q({ cid }); await sleep(300); const a2 = await mk(); a2.q({ cid }); await sleep(500);
    ok(a.closed === 4000 && a2.last('st').n === 1, 'cid: the older socket of the same tab is replaced, counted once (closed ' + a.closed + ')');
    const o = await mk(); o.q({}); await sleep(400); ok(a2.last('st').n === 2, 'cid: queue n=2 after another player'); await done(a2, o); }
  // 6. a v2 host that disappears (socket dies) -> its room is dropped, new players form a new match
  { const a = await mk(); a.q({ fill: 5 }); const h = await a.wait('host', 9000); a.send({ t: 'open' }); await sleep(300); a.send({ t: 'seats', free: 3, ph: 'lobby' }); await sleep(200); a.ws.terminate(); await sleep(600);
    const b = await mk(); b.q({ fill: 5 }); await sleep(1500); ok(h && !b.get('go'), 'dead room is not offered'); const hb = await b.wait('host', 8000); ok(hb && hb.code !== h.code, 'lone player hosts its own room with bots after its fill time'); await done(b); }
  // 6b. a searcher that just failed to reach a room (skip) is never sent back into it
  { const a = await mk(); a.q({ fill: 5 }); const h = await a.wait('host', 9000); a.send({ t: 'open' }); await sleep(300); a.send({ t: 'seats', free: 3, ph: 'lobby' }); await sleep(200);
    const b = await mk(); b.send({ t: 'q', mode: 'classic', fill: 60, v: 2, cid: rid(), skip: [h.code] }); await sleep(1500); ok(!b.get('go'), 'skip: room the player just failed is not offered again');
    const c = await mk(); c.q({}); const gc = await c.wait('go', 3000); ok(gc && gc.code === h.code, 'skip: others still get that room'); a.send({ t: 'closed' }); await done(a, b, c); }
  // 7. v1 host (v4.6.2) still closed after open; v1 + v2 pair together
  { const a = await mk(); a.q({ v: 1, fill: 6 }); await sleep(300); const b = await mk(); b.q({ fill: 6 });
    const h = await a.wait('host', 9000); a.send({ t: 'open' }); const g = await b.wait('go', 3000); await sleep(300); ok(h && g && g.code === h.code && a.closed === 1000, 'v1 host + v2 guest pair, v1 host released after open'); await done(a, b); }
} catch (e) { fail++; console.log('FAIL exception ' + e.stack); }
console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
