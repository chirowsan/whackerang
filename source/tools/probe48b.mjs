// v4.8 probe: host relay frame rate (relay token bucket: host 160 frames/s, cumulative 300 drops => kick)
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = 'ws://localhost:8799'; const SIZE = process.env.SIZE || 'large'; const SECS = +(process.env.SECS || 90); const PSTART = +(process.env.PSTART || 14);
const PORT = 8350 + (process.pid % 40); const FILE = '/workspace/boomerang-brawl/Whackerang.html';
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(FILE)); }).listen(PORT);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const sig = await startRelay(9180 + (process.pid % 15));
const T = []; for (let i = 0; i < 3; i++) T.push(await openN(1, { relay: sig.url, rly: RLY, url: `http://localhost:${PORT}/`, w: 480, h: 270, stockRtc: true, ice: [] }));
const [H, ...G] = T.map((t) => t.pages[0]);
try {
  await ev(H, () => { const o = WebSocket.prototype.send; window.__wsc = { n: 0, bins: [], big: 0 }; let cur = 0, t0 = performance.now(); WebSocket.prototype.send = function (d) { const t = performance.now(); const s = Math.floor((t - t0) / 1000); if (s !== cur) { __wsc.bins.push([cur, __wsc.n]); __wsc.n = 0; cur = s; } if (typeof d !== 'string') __wsc.n++; return o.call(this, d); }; });
  const h = await ev(H, async () => await __bg.net.host()); log('room', h && h.code);
  for (const g of G) { await ev(g, (x) => Object.assign(window.__bbNet, x), { forceRelay: true }); await ev(g, (c) => { __bg.net.join(c).catch(() => {}); }, h.code); await waitFor(async () => (await ev(g, () => __bg.net.phase)) === 'lobby', 40000); }
  await ev(H, (o) => { const n = __bg.net; n.setSetting('size', o.size); n.setSetting('mode', 'classic'); n.setSetting('traps', 'wild'); n.setSetting('events', 'wild'); n.setSetting('rounds', 3); n.setSetting('bots', true); }, { size: SIZE });
  await sleep(800); for (const g of G) await ev(g, () => __bg.net.setReady(true)); await sleep(1200);
  await ev(H, (c) => Object.assign(__bg.POISON, c), { startAt: PSTART, warn: 4, shrink: 18 }); await ev(H, () => __bg.net.startMatch());
  await ev(H, () => { __wsc.bins = []; window.__gap = { mx: 0, at: 0 }; let lt = performance.now(); setInterval(() => { const t = performance.now(); if (t - lt > __gap.mx) { __gap.mx = t - lt; __gap.at = __bg.app.game.playTime; __gap.st = __bg.app.game.state; } lt = t; }, 100); });
  for (let s = 0; s < SECS; s += 10) { await sleep(10000); const r = await ev(H, () => { const b = __wsc.bins.splice(0); return { mx: Math.max(0, ...b.map((x) => x[1])), avg: b.length ? b.reduce((a, x) => a + x[1], 0) / b.length : 0, over: b.filter((x) => x[1] > 160).length, gap: Math.round(__gap.mx), gat: __gap.at && __gap.at.toFixed(1), gst: __gap.st, st: __bg.app.game.state, pt: __bg.app.game.playTime | 0 }; }); log(JSON.stringify(r), JSON.stringify(await Promise.all(G.map((g) => ev(g, () => __bg.net.phase))))); }
  log('guests', JSON.stringify(await Promise.all(G.map((g) => ev(g, () => __bg.net.phase)))));
} catch (e) { log('EXC', e && e.stack); }
for (const t of T) await t.close().catch(() => {}); srv.close(); sig.stop(); process.exit(0);
