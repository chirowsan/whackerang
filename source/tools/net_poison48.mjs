// v4.8 online poison: host-authoritative. Tuning travels in rules.poisonCfg, the zone comes from the synced match clock, damage is
// applied only on the host and the guest just renders it. usage: node tools/net_poison48.mjs [relay=ws://localhost:8799]
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = process.argv[2] || 'ws://localhost:8799'; const PORT = 8300 + (process.pid % 50);
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(process.argv[3] || '/workspace/boomerang-brawl/Whackerang.html')); }).listen(PORT);
const URL_ = `http://localhost:${PORT}/`; const sig = await startRelay(9114);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
const T = await openN(2, { relay: sig.url, rly: RLY, url: URL_, w: 640, h: 360, extra: { forceRelay: true } });
try {
  const [H, G] = T.pages;
  for (const p of T.pages) await ev(p, () => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.speed = 'fast'; });
  await ev(H, () => { __bg.POISON.tick = 1.5; __bg.POISON.minFrac = 0.25; }); // host-side tuning must reach the guest, whose own defaults stay 2.0 / 0.2
  const h = await ev(H, async () => await __bg.net.host()); ok('room created', h && h.code, h);
  await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code); ok('guest in lobby (relay)', await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 45000));
  await ev(H, () => { __bg.net.setSetting('mode', 'classic'); }); await ev(G, () => __bg.net.setReady(true)); await sleep(1500);
  await ev(H, () => __bg.net.startMatch());
  ok('both in play', await waitFor(async () => (await ev(H, () => __bg.app.game && __bg.app.game.state)) === 'play' && (await ev(G, () => __bg.app.game && __bg.app.game.state)) === 'play', 30000, 200));
  const cfg = await ev(G, () => { const g = __bg.app.game; return { cfg: g.rules.poisonCfg, own: { ...__bg.POISON }, view: !!g.poisonView, poison: g.rules.poison }; });
  ok('guest got the host tuning in rules.poisonCfg (tick 1.5 / minFrac 0.25) and builds the view', cfg.poison && cfg.view && cfg.cfg && cfg.cfg.tick === 1.5 && cfg.cfg.minFrac === 0.25 && cfg.own.tick === 2, cfg);
  // jump the host clock to the warning window, then into the closing phase; guests follow through the synced playTime
  await ev(H, () => { const g = __bg.app.game; g.rules.sudden = false; g.sudden = false; g.playTime = g.rules.poisonCfg.startAt - 5; });
  await sleep(1500); const w = await ev(G, () => { __bg.UI.hudUpdate(__bg.app.game); return { t: __bg.app.game.playTime, hud: (document.getElementById('h-time') || {}).textContent, ph: __bg.app.game.poisonView.ph }; });
  ok('guest sees the warning (HUD countdown)', /☣ \d+s/.test(w.hud || '') || w.ph === 'warn', w);
  await ev(H, () => { const g = __bg.app.game; g.playTime = g.rules.poisonCfg.startAt + 30; });
  // keep the guest's fighter on the rim (host side, the host is authoritative over positions and hearts)
  const gi = await ev(H, () => { const g = __bg.app.game; const i = g.fighters.findIndex((f, k) => k > 0 && !f.isBot); g.fighters.forEach((f) => { f.hp = f.maxHp = Math.max(f.maxHp, 3); f.abil = null; f.nineUsed = true; }); const [hx] = __bg.hxz(); window.__pin = setInterval(() => { const f = g.fighters[i]; if (f && f.alive) { const c = g.safeCell({ x: -hx + 0.5, z: 0, _self: f }, true); f.x = -hx + 0.5; f.z = 0.5; } }, 5); window.__hp0 = g.fighters[i].hp; return i; });
  ok('found the guest fighter on the host', gi > 0, gi);
  const hp0 = await ev(H, (i) => { window.__t0 = __bg.app.game.playTime; return __bg.app.game.fighters[i].hp; }, gi);
  await waitFor(async () => (await ev(H, () => __bg.app.game.playTime - window.__t0)) > 2, 30000, 100);
  const geo = await Promise.all([H, G].map((p) => ev(p, () => { const v = __bg.app.game.poisonView; return { vis: v.grp.visible, e: v.edge.map((m) => [+m.position.x.toFixed(2), +m.position.z.toFixed(2), +m.scale.x.toFixed(2), +m.scale.z.toFixed(2)]), t: __bg.app.game.playTime }; })));
  // the ring is a pure function of the match clock: any host/guest difference must be explained by the clock difference alone
  // (the guest extrapolates the clock between snapshots; a throttled headless host lags, so the clocks can differ by ~1-2 s here)
  const hx = await ev(G, () => __bg.hxz()[0]); const c0 = cfg.cfg, fin = Math.min(hx, Math.max(c0.minHX, hx * c0.minFrac)), slope = (hx - fin) / c0.shrink, dt = geo[1].t - geo[0].t;
  const resid = Math.abs((Math.abs(geo[0].e[0][0]) - Math.abs(geo[1].e[0][0])) - slope * dt), dmax = Math.max(...geo[0].e.flatMap((e, k) => e.map((v, j) => Math.abs(v - geo[1].e[k][j]))));
  ok('guest edge ring = host ring at the guest clock (residual < 0.08 u, clocks within 2.5 s)', geo[0].vis && geo[1].vis && resid < 0.08 && Math.abs(dt) < 2.5, { resid: +resid.toFixed(3), dt: +dt.toFixed(2), dmax, H: geo[0], G: geo[1] });
  await waitFor(async () => (await ev(H, () => __bg.app.game.playTime - window.__t0)) > 5.2, 40000, 100);
  const r = await ev(H, (i) => { clearInterval(window.__pin); const f = __bg.app.game.fighters[i]; return { hp: f.hp, hits: f.poisonHits || 0, alive: f.alive }; }, gi);
  await sleep(800); const rg = await ev(G, (i) => { const f = __bg.app.game.fighters[i]; return { hp: f.hp, hits: f.poisonHits || 0, alive: f.alive }; }, gi);
  ok('host takes hearts on the 1.5 s tick (3 hearts -> KO in ~5.2 game s)', r.hits >= 2 && r.hits <= 4 && !r.alive, { hp0, r });
  ok('guest shows the host-applied heart loss, without running its own ticks', (rg.hp < hp0 || !rg.alive) && rg.hits === 0, { hp0, rg });
  const errs = T.pages.flatMap((p) => p.errors.filter((e) => !/favicon|Failed to load resource|ERR_CONNECTION_REFUSED|WebSocket connection|REQFAIL|ERR_NAME_NOT_RESOLVED|net::ERR/.test(e))); ok('no page errors', errs.length === 0, errs.slice(0, 5));
} finally { await T.close(); sig.stop && sig.stop(); srv.close(); }
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
