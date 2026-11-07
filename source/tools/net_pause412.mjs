// t393u: ONLINE MATCH menu with REAL CDP touches on a 1024x473 phone, host + guest over the LOCAL relay.
// usage: node tools/net_pause412.mjs [relay=ws://localhost:8799] [html]
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = process.argv[2] || 'ws://localhost:8799'; const HTML = process.argv[3] || '/workspace/boomerang-brawl/Whackerang.html';
const PORT = 8500 + (process.pid % 40); const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url.startsWith('/g') ? fs.readFileSync(HTML) : ''); }).listen(PORT);
const sig = await startRelay(9175); let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 400) : '')); };
const T = await openN(2, { relay: sig.url, rly: RLY, url: `http://localhost:${PORT}/g`, w: 1024, h: 473, mobile: true, extra: { forceRelay: true } });
try { const [H, G] = T.pages; const P = T.pages.map((p) => p.page);
  for (const p of T.pages) await ev(p, () => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.touch = 'on'; __bg.app.applyTouch(); });
  const h = await ev(H, async () => await __bg.net.host()); await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code); ok('lobby', await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 45000));
  await ev(H, () => { __bg.net.setSetting('mode', 'classic'); __bg.net.setSetting('size', 'small'); __bg.net.setSetting('bots', 0); }); await ev(G, () => __bg.net.setReady(true)); await sleep(1500); await ev(H, () => __bg.net.startMatch());
  ok('both playing', await waitFor(async () => (await Promise.all([H, G].map((p) => ev(p, () => __bg.app.game && __bg.app.game.state)))).every((s) => s === 'play'), 30000, 200));
  const tapSel = async (pg, sel) => { const r = await pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const top = document.elementFromPoint(x, y); return { x, y, top: top ? (top.id || top.className || top.tagName) : null, hit: !!top && (top === e || e.contains(top)) }; }, sel); if (r) await pg.touchscreen.tap(r.x, r.y); await sleep(500); return r; };
  for (const [L, pg, p] of [['guest', P[1], G], ['host', P[0], H]]) {
    for (let k = 0; k < 2; k++) { // open / close twice (repeated reopen)
      const o = await tapSel(pg, '#btnPause'); const cur = await ev(p, () => __bg.UI.cur); ok(`${L}: touch pause button opens ONLINE MATCH (${k + 1})`, cur === 'netPause', { o, cur });
      const t0 = await ev(p, () => __bg.app.game.playTime); await sleep(600); const t1 = await ev(p, () => __bg.app.game.playTime); ok(`${L}: match keeps running while the menu is open`, t1 > t0, { t0, t1 });
      const bk = await tapSel(pg, '#ui .netpause .btn.primary'); const st = await ev(p, () => ({ cur: __bg.UI.cur, touchOn: !document.getElementById('touch').classList.contains('off') }));
      ok(`${L}: real touch on "Back to the game" hits the button and closes the menu, controls back`, bk && bk.hit && st.cur === null && st.touchOn, { bk, st });
    }
  }
  // fullscreen: the button must receive the touch (the API itself is browser-dependent; headless only shows the call)
  await tapSel(P[1], '#btnPause'); await ev(G, () => { window.__fs = 0; const a = __bg.app; const o = a.toggleFullscreen.bind(a); a.toggleFullscreen = () => { window.__fs++; try { o(); } catch (e) {} }; });
  const fb = await tapSel(P[1], '#ui .netpause .btn:not(.primary):not(.hot)'); ok('guest: real touch on Fullscreen reaches its handler', fb && fb.hit && (await ev(G, () => window.__fs)) === 1, { fb, n: await ev(G, () => window.__fs) });
  const lv = await tapSel(P[1], '#net-pause-leave'); await sleep(1500); const gs = await ev(G, () => ({ cur: __bg.UI.cur, active: !!__bg.net.active, mode: __bg.app.mode }));
  ok('guest: real touch on Leave match disconnects and returns to the menu', lv && lv.hit && !gs.active && gs.mode === 'menu' && gs.cur === 'menu', { lv, gs });
} finally { await T.browser.close(); srv.close(); sig.stop(); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
