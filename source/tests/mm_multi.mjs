// v4.6.3 multi-client Auto match harness: N real game clients (headless Chromium, the real built game) press Auto match against the LIVE (or local) worker.
// env: N (clients, default 2), AT="0,1.5,..." start offsets in s (default all 0), MODES="classic,team" (per-client Auto-match chip, cycles), FILL (mmFill s, '' = game default),
//      RELAY="0,1" per-client forceRelay (default 0: direct WebRTC first; this box blocks UDP so direct always fails -> relay fallback), WAIT (s, default 100),
//      RLY (worker base), HTML (built file), OLD="1" per-client index list using OLD_HTML (old-client compat), CANCEL="i@s" client i cancels at s and re-presses 1 s later.
// PASS: every client reaches a running match; clients sharing a room see the same humans/bots line-up; guests receive snapshots; total humans placed = N; rooms = ceil(N/4).
import http from 'node:http'; import fs from 'node:fs'; import { openN, ev, sleep, waitFor } from '../tools/netlib.mjs';
const N = +(process.env.N || 2); const AT = (process.env.AT || '').split(',').filter(Boolean).map(Number); const MODES = (process.env.MODES || 'classic').split(',');
const RELAY = (process.env.RELAY || '').split(',').map((x) => x === '1'); const OLD = new Set((process.env.OLD || '').split(',').filter(Boolean).map(Number));
const FILE = process.env.HTML || '/workspace/boomerang-brawl/Whackerang.html'; const OLD_FILE = process.env.OLD_HTML || '/workspace/out/v4.6.3/old462.html';
const RLY = process.env.RLY || 'wss://whackerang-relay.chirowsan-backyard.workers.dev'; const WAIT = +(process.env.WAIT || 100) * 1000;
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const PORT = 8500 + (process.pid % 400);
const srv = http.createServer((q, r) => { const p = q.url.split('?')[0]; if (p !== '/' && p !== '/old') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(p === '/old' ? OLD_FILE : FILE)); }).listen(PORT);
const extra = {}; if (process.env.FILL) extra.mmFill = +process.env.FILL;
const pre = (i, relayFlags) => { if (relayFlags[i]) window.__bbNet.forceRelay = true; };
const T = await openN(0, {}); // browser only
const pages = []; const extraT = [];
{ const o = { relay: undefined, rly: RLY, ice: ICE, extra, w: 480, h: 270 };
  // open N contexts in the same browser (re-implementing openN's per-page part so each can load old/new html)
  // SPLIT=1: one browser (own software-GPU process) per client; six SwiftShader games in one GPU process can starve a page for minutes on this box

  for (let i = 0; i < N; i++) {
    let browser = T.browser; if (process.env.SPLIT === '1' && i > 0) { const T2 = await openN(0, {}); extraT.push(T2); browser = T2.browser; }
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: o.w, height: o.h });
    await page.evaluateOnNewDocument((cfg) => { window.__bbNet = { rly: cfg.rly, ...(cfg.extra || {}), ice: cfg.ice }; try { localStorage.setItem('whackerang.save.v1', JSON.stringify({ tutorialDone: true, coins: 100, settings: { quality: 'fast', onlineName: cfg.name, noAutoPause: true, autoMode: cfg.mode } })); } catch (e) {} }, { rly: o.rly, extra: o.extra, ice: o.ice, name: ['Zippy Fox', 'Mighty Mango', 'Captain Boom', 'Sneaky Newt', 'Turbo Taco', 'Happy Hippo', 'Lucky Pear', 'Brave Bean'][i % 8], mode: MODES[i % MODES.length] });
    await page.evaluateOnNewDocument(pre, i, RELAY);
    await page.goto(`http://localhost:${PORT}/${OLD.has(i) ? 'old' : ''}`); pages.push({ page, errors, i });
  }
  await sleep(2500);
}
const t0 = Date.now(); const sec = () => ((Date.now() - t0) / 1000).toFixed(1);
const snap = (p) => ev(p, () => { const b = window.__bg; const n = b.net; const g = b.app.game; return { ms: b.Match.state, cur: b.UI.cur, ph: n.phase, role: n.active ? n.role : '-', code: n.active ? n.code : '', via: n.active ? n.conType : '', snaps: n.stat ? n.stat.snaps : 0, ft: g && b.app.mode !== 'menu' ? g.fighters.map((f) => (f.isBot ? 'b' : 'h')).join('') : '', names: g && b.app.mode !== 'menu' ? g.fighters.map((f) => (f.isBot ? 'bot' : f.def.name)).sort().join('|') : '', note: (b.Match.note || '').slice(0, 60), diagc: (b.Match.dcode ? b.Match.dcode() : ''), ver: b.app.BUILD }; }).catch((e) => ({ err: String(e).slice(0, 80) }));
const tl = pages.map(() => []); let stop = false;
const rec = (async () => { const last = pages.map(() => ''); while (!stop) { for (const p of pages) { const s = await snap(p); const k = JSON.stringify({ ...s, snaps: s.snaps > 0 }); if (k !== last[p.i]) { last[p.i] = k; tl[p.i].push({ t: sec(), ...s }); } } await sleep(250); } })();
for (const p of pages) await ev(p, () => __bg.UI.show('netMenu'));
const press = (p) => ev(p, () => { const e = document.getElementById('net-auto'); if (e) { e.click(); return true; } return false; });
const order = pages.map((p) => ({ p, at: (AT.length ? AT[p.i % AT.length] : 0) * 1000 })).sort((a, b) => a.at - b.at);
const cancel = process.env.CANCEL ? process.env.CANCEL.split('@').map(Number) : null;
(async () => { for (const o of order) { const d = o.at - (Date.now() - t0); if (d > 0) await sleep(d); await press(o.p); } })();
if (cancel) (async () => { await sleep(cancel[1] * 1000); const p = pages[cancel[0]]; await ev(p, () => { const b = document.getElementById('net-search-cancel') || [...document.querySelectorAll('button')].find((x) => /Cancel/.test(x.textContent)); b && b.click(); }); await sleep(1000); await ev(p, () => __bg.UI.show('netMenu')); await sleep(300); await press(p); })();
const done = await waitFor(async () => { const s = await Promise.all(pages.map(snap)); return s.every((x) => x.ph === 'match' && x.ft && (x.role === 'host' || x.snaps > 5)) ? s : null; }, WAIT, 500);
await sleep(3000); stop = true; await rec;
const fin = await Promise.all(pages.map(snap));
const rooms = {}; fin.forEach((s, i) => { (rooms[s.code || 'none' + i] = rooms[s.code || 'none' + i] || []).push(i); });
let ok = !!done; const why = [];
if (!done) why.push('not all in a running match');
let humans = 0;
for (const [code, mem] of Object.entries(rooms)) { const ss = mem.map((i) => fin[i]); const h = ss[0].ft.split('').filter((c) => c === 'h').length; humans += mem.length;
  if (!ss.every((s) => s.ft === ss[0].ft && s.names === ss[0].names)) { ok = false; why.push(`room ${code}: line-up differs ${ss.map((s) => s.ft + '/' + s.names).join(' vs ')}`); }
  if (h !== mem.length) { ok = false; why.push(`room ${code}: ${h} humans on screen but ${mem.length} clients`); }
  if (ss.filter((s) => s.role === 'host').length !== 1) { ok = false; why.push(`room ${code}: hosts=${ss.filter((s) => s.role === 'host').length}`); } }
const nRooms = Object.keys(rooms).length; if (nRooms !== Math.ceil(N / 4)) { ok = false; why.push(`rooms ${nRooms} expected ${Math.ceil(N / 4)}`); }
if (process.env.VERBOSE || !ok) for (const p of pages) { console.log(`--- client ${p.i}${OLD.has(p.i) ? ' (old)' : ''} at ${AT.length ? AT[p.i % AT.length] : 0}s mode ${MODES[p.i % MODES.length]}`); for (const e of tl[p.i]) console.log(' ', JSON.stringify(e)); const d = await ev(p, () => __bg.Match.diag.map((e) => e.ev + (e.d ? ':' + e.d : '')).join(' | ')).catch(() => ''); console.log('  diag:', d); if (p.errors.length) console.log('  errors:', p.errors.slice(0, 4).join(' || ').slice(0, 400)); }
console.log('RESULT', JSON.stringify({ ok, N, at: AT, secs: sec(), rooms: Object.fromEntries(Object.entries(rooms).map(([c, m]) => [c, m.map((i) => fin[i].role[0] + i + ':' + fin[i].ft + ':' + fin[i].via)])), why }));
for (const x of extraT) await x.close().catch(() => {}); await T.close(); srv.close(); process.exit(ok ? 0 : 1);
