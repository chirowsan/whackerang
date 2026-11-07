// t397u C/B: cross-ENGINE online match: host engine vs guest engine (webkit = Playwright WebKit engine with iPhone emulation, NOT real iOS;
// chromium = Chrome with Android-phone viewport). Local signaling relay; mode 'relay' (forceRelay over local wrangler relay) or 'direct' (local STUN, real WebRTC).
// usage: node tools/xnet413.mjs <hostEngine> <guestEngine> <relay|direct> [html] [menu]
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, startTurn, sleep, waitFor } from './netlib.mjs'; import { wk } from './wklib.mjs';
const [HE, GE, MODE, HTML0, MENU] = process.argv.slice(2); const HTML = HTML0 || '/workspace/boomerang-brawl/Whackerang.html';
const PORT = 8540 + (process.pid % 40); const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url.startsWith('/g') ? fs.readFileSync(HTML) : ''); }).listen(PORT);
const sig = await startRelay(9190 + (process.pid % 7)); const turn = MODE === 'direct' ? await startTurn() : null;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };
const DEV = { webkit: 'iPhone 14 landscape', chromium: { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' } };
const S = []; const names = ['Zippy Fox', 'Mighty Mango'];
try {
  for (const [i, E] of [HE, GE].entries()) { const s = await wk(DEV[E], {}, E); s.E = E;
    await s.page.addInitScript((cfg) => { window.__bbNet = { relay: cfg.relay, rly: cfg.rly, ...(cfg.extra || {}), ice: [{ urls: 'stun:127.0.0.1:3478' }] }; try { if (!localStorage.getItem('whackerang.save.v1')) localStorage.setItem('whackerang.save.v1', JSON.stringify({ tutorialDone: true, coins: 100, settings: { quality: 'fast', onlineName: cfg.name, noAutoPause: true, touch: 'on', events: 'off' } })); } catch (e) {} },
      { relay: sig.url, rly: MODE !== 'direct' ? 'ws://localhost:8799' : '', extra: MODE === 'relay' ? { forceRelay: true } : {}, name: names[i] });
    await s.page.goto(`http://localhost:${PORT}/g`); await sleep(2500); S.push(s); }
  const [H, G] = S; const ev = (s, fn, a) => s.page.evaluate(fn, a);
  const h = await ev(H, async () => { try { return await __bg.net.host(); } catch (e) { return { err: String(e && e.stack || e) }; } }); ok(`${HE} hosts a room`, h && h.code, h);
  if (process.env.SUSPEND) { // simulate iOS backgrounding the host page: its signaling + relay sockets are closed by the OS, then the page comes back
    const r = await ev(H, async () => { const H = __bg.net.H; const ws = [H.sig && H.sig.ws, H.rly && H.rly.conn && H.rly.conn.ws]; ws.forEach((w) => { try { w && w.close(); } catch (e) {} }); await new Promise((r) => setTimeout(r, 2500)); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); await new Promise((r) => setTimeout(r, 3500)); return { closed: ws.map((w) => !!w), sig: !!__bg.net.H.sig, rly: !!__bg.net.H.rly, st: __bg.net.status || '' }; });
    console.log('SUSPEND', JSON.stringify(r)); }
  await ev(G, (c) => { window.__je = null; __bg.net.join(c).catch((e) => { window.__je = String(e && e.message || e); }); }, h.code);
  const lob = await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 45000); const gd = await ev(G, () => ({ phase: __bg.net.phase, je: window.__je, diag: __bg.net.diag ? __bg.net.diag() : null }));
  ok(`${GE} guest joins ${HE} host (lobby)`, !!lob, gd);
  if (lob) { await ev(H, () => { __bg.net.setSetting('mode', 'classic'); __bg.net.setSetting('size', 'small'); __bg.net.setSetting('bots', 0); }); await ev(G, () => __bg.net.setReady(true)); await sleep(1500); await ev(H, () => __bg.net.startMatch());
    ok('both playing', await waitFor(async () => (await Promise.all([H, G].map((p) => ev(p, () => __bg.app.game && __bg.app.game.state)))).every((s) => s === 'play'), 30000, 200));
    if (MENU) for (const [L, s] of [['host ' + HE, H], ['guest ' + GE, G]]) {
      const tap = async (sel) => { const b = await s.page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); return { x, y, top: t && (t.id || t.className) + '', hit: !!t && (t === e || e.contains(t)) }; }, sel); if (b) await s.page.touchscreen.tap(b.x, b.y); await sleep(500); return b; };
      await s.page.evaluate(() => { document.getElementById('a2hs') && document.getElementById('a2hs').remove(); window.__ev = []; const tg = (e) => (e.target && (e.target.id || (e.target.className && e.target.className.baseVal !== undefined ? 'svg' : e.target.className))) + ''; for (const n of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click']) document.addEventListener(n, (e) => window.__ev.push(n + ':' + tg(e) + ':' + Math.round(performance.now())), true); const U = __bg.UI; for (const f of ['show', 'clear']) { const o = U[f].bind(U); U[f] = (...a) => { window.__ev.push(f + ':' + (a[0] || '') + ':' + Math.round(performance.now()) + ':' + (new Error().stack.split('\n').slice(1, 4).join('<').replace(/\s+/g, ' ').slice(0, 300))); return o(...a); }; } });
      for (let k = 0; k < 2; k++) { const o = await tap('#btnPause'); const cur = await ev(s, () => __bg.UI.cur); ok(`${L}: real touch opens ONLINE MATCH (${k + 1})`, cur === 'netPause', { o, cur, ev: await s.page.evaluate(() => window.__ev.splice(0)) });
        const bk = await tap('#ui .netpause .btn.primary'); const st = await ev(s, () => ({ cur: __bg.UI.cur, on: !document.getElementById('touch').classList.contains('off') })); ok(`${L}: real touch on Back closes menu, controls back (${k + 1})`, bk && st.cur === null && st.on, { bk, st }); }
    }
  }
  if (MENU && lob) { const s = G; const tp = async (sel) => { const b = await s.page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); if (b) await s.page.touchscreen.tap(b.x, b.y); await sleep(600); return b; };
    await tp('#btnPause'); const fb = await tp('#ui .netpause .btn:not(.primary):not(.hot)'); const af = await ev(s, () => ({ cur: __bg.UI.cur, mode: __bg.app.mode, active: !!__bg.net.active, playing: __bg.app.game && __bg.app.game.state }));
    ok(`guest ${GE}: Fullscreen button tap (unsupported/fallback ok) keeps the match alive`, fb && af.active && af.mode === 'play', af);
    if (af.cur !== 'netPause') await tp('#btnPause'); const lv = await tp('#net-pause-leave'); await sleep(1500); const gs = await ev(s, () => ({ cur: __bg.UI.cur, active: !!__bg.net.active, mode: __bg.app.mode }));
    ok(`guest ${GE}: real touch on Leave match returns to the menu`, lv && !gs.active && gs.mode === 'menu', gs); }
  for (const s of S) console.log('LOG', s.E, JSON.stringify(s.errors.slice(0, 4)), s.logs.filter((l) => /net|rtc|ice|sdp|warn|error/i.test(l)).slice(-12).join(' | ').slice(0, 1500));
} finally { for (const s of S) await s.browser.close(); srv.close(); sig.stop(); turn && turn.stop(); }
console.log(`${HE}->${GE} ${MODE}: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
