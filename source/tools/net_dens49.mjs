// v4.9: host and guest build the IDENTICAL calmer map (crates/pillars/lava + trap list) from the host's seed and dens flag; a dens-1 (v4.8-style) host stays identical too.
// Direct WebRTC over the local signaling relay (no game relay). usage: node tools/net_dens49.mjs [html]
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, startTurn, openN, ev, sleep, waitFor } from './netlib.mjs';
const PORT = 8350 + (process.pid % 40);
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html')); }).listen(PORT);
const sig = await startRelay(9124); const turn = await startTurn(); let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 400) : '')); };
const snap = () => { const g = __bg.app.game; let h = 0, n = 0; for (let k = 0; k < g.layout.t.length; k++) { h = (h * 31 + g.layout.t[k]) | 0; if (g.sol[k]) n++; } return { dens: g.dens, arena: g.arenaId, h, solid: n, traps: g.traps.list.map((t) => t.type + '@' + t.x.toFixed(2) + ',' + t.z.toFixed(2)).join(' '), sw: g.traps.sw.length }; };
for (const dens of (process.env.DENS || '2,1').split(',').map(Number)) {
  const T = await openN(2, { relay: sig.url, url: `http://localhost:${PORT}/`, w: 640, h: 360 });
  try { const [H, G] = T.pages;
    for (const p of T.pages) await ev(p, () => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; });
    if (dens === 1) await ev(H, () => { window.__bbDens = 1; });
    const h = await ev(H, async () => await __bg.net.host()); await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code);
    const inL = await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 45000); ok(`dens${dens}: guest in lobby`, inL); if (!inL) { console.log('G logs', T.pages[1].logs.slice(-12).join('\n')); console.log('H logs', T.pages[0].logs.slice(-6).join('\n')); break; }
    for (const arena of ['dojo', 'jungle', 'pirate']) {
      await ev(H, (a) => { __bg.net.setSetting('mode', 'classic'); __bg.net.setSetting('arena', a); __bg.net.setSetting('size', 'large'); __bg.net.setSetting('traps', 'some'); }, arena); await ev(G, () => __bg.net.setReady(true)); await sleep(1200);
      if (arena === 'dojo') await ev(H, () => __bg.net.startMatch());
      const up = await waitFor(async () => { const a = await ev(H, () => __bg.app.game && __bg.app.game.arenaId + __bg.app.game.state), b = await ev(G, () => __bg.app.game && __bg.app.game.arenaId + __bg.app.game.state); return a && a === b && /play$/.test(a); }, 30000, 200);
      const [a, b] = [await ev(H, snap), await ev(G, snap)];
      ok(`dens${dens} ${a.arena}: guest layout + traps identical to host (dens ${a.dens}/${b.dens}, solid ${a.solid}, traps ${a.traps.split(' ').length})`, up && a.dens === dens && b.dens === dens && a.h === b.h && a.traps === b.traps && a.sw === b.sw, { a, b });
      break; // one round per dens is enough (arena of the round = host random/selection)
    }
    const errs = T.pages.flatMap((p) => p.errors.filter((e) => !/REQFAIL|ERR_FILE|favicon|icon/.test(e)));
    ok(`dens${dens}: no page errors`, errs.length === 0, errs.slice(0, 3));
  } finally { await T.browser.close(); }
}
console.log(`${pass}/${pass + fail} passed`); srv.close(); sig.stop(); turn.stop(); process.exit(fail ? 1 : 0);
