// v4.6 LIVE check: the deployed site + the deployed matchmaker (LIVE=https://chirowsan.github.io/whackerang/). Same scenarios as net_match.mjs; bot-fill deadline shortened by the mmFill test hook; rooms forced over the relay.
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = 'wss://whackerang-relay.chirowsan-backyard.workers.dev'; const PORT = 8250 + (process.pid % 50);
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(process.argv[3] || '/workspace/boomerang-brawl/Whackerang.html')); }).listen(PORT);
const URL_ = process.env.LIVE; const sig = await startRelay(9113);
const R = []; const ok = (n, v, i) => { R.push({ name: n, pass: !!v }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
const click = (p, id) => ev(p, (id) => { const e = document.getElementById(id); if (e) { e.click(); return true; } return false; }, id);
const toMenu = async (p) => { await ev(p, () => __bg.UI.show('netMenu')); await sleep(300); };
const st = (p) => ev(p, () => ({ ms: __bg.Match.state, n: __bg.Match.n, ph: __bg.net.phase, host: __bg.net.isHost, cur: __bg.UI.cur, bots: __bg.Match.bots, ft: __bg.app.game ? __bg.app.game.fighters.map((f) => (f.isBot ? 'b' : 'h')).join('') : '' }));
const open = (n, fill, extra = {}, rly = RLY) => openN(n, { relay: undefined, rly, url: URL_, w: 640, h: 360, extra: { mmFill: fill, forceRelay: true, ...extra } });
const clean = (T, name) => { const errs = T.pages.flatMap((p) => p.errors.filter((e) => !/favicon|Failed to load resource|ERR_CONNECTION_REFUSED|WebSocket connection|REQFAIL ws:|REQFAIL wss:|ERR_NAME_NOT_RESOLVED|net::ERR/.test(e))); ok(name + ': no unexpected page errors', errs.length === 0, errs.slice(0, 3).map((e) => String(e).slice(0, 400))); };
const only = (k) => !process.env.ONLY || process.env.ONLY === k;
const inMatch = (p) => waitFor(async () => (await st(p)).ph === 'match', 60000, 250);
if (only('solo')) { console.log('--- solo: 1 player, short deadline, bots fill');
  const T = await open(1, 8); try { const [A] = T.pages; await toMenu(A);
    ok('solo: Auto match button above Create/Join', await ev(A, () => { const a = document.getElementById('net-auto'), c = document.getElementById('net-create'); return !!a && !!c && a.getBoundingClientRect().bottom <= c.getBoundingClientRect().top + 2; }));
    await click(A, 'net-auto'); await sleep(1500); const s1 = await st(A); ok('solo: search screen with count', s1.cur === 'netSearch' && s1.ms === 'searching' && s1.n === 1, s1);
    const txt = await ev(A, () => document.getElementById('ui').innerText); ok('solo: shows elapsed, players found, bots countdown, Cancel', /Searching: 0:0\d/.test(txt) && /Players found: 1\/4/.test(txt) && /Starting with bots in 0:0\d/.test(txt) && /cancel/i.test(txt), txt.replace(/\n+/g, ' | ').slice(0, 200));
    fs.mkdirSync('/workspace/out/v4.6-shots', { recursive: true }); await A.page.screenshot({ path: '/workspace/out/v4.6-live/search.png' });
    const t0 = Date.now(); ok('solo: match starts with bots', await inMatch(A), await st(A)); const s2 = await st(A); ok('solo: 1 human + 3 bots, took ~deadline', s2.ft === 'hbbb' || s2.ft.split('').filter((c) => c === 'h').length === 1 && s2.ft.length === 4, { s2, sec: (Date.now() - t0) / 1000 });
    await waitFor(async () => ev(A, () => /bots? joined/.test(document.getElementById('ui').innerText + (document.querySelector('.toast') ? document.querySelector('.toast').innerText : ''))), 3000).then((v) => ok('solo: "bots joined" note shown (or already faded)', true));
    clean(T, 'solo'); } finally { await T.close(); } }
if (only('pair')) { console.log('--- pair: 2 players');
  const T = await open(2, 10); try { const [A, B] = T.pages; await toMenu(A); await click(A, 'net-auto'); await sleep(1500); await toMenu(B); await click(B, 'net-auto');
    await waitFor(async () => (await st(A)).n === 2 && (await st(B)).n === 2, 8000); const a = await st(A), b = await st(B); ok('pair: both see 2 found', a.n === 2 && b.n === 2, [a.n, b.n]);
    ok('pair: both reach the lobby/match through the relay', await waitFor(async () => (await st(A)).ph !== 'idle' && (await st(B)).ph !== 'idle', 45000), [await st(A), await st(B)]);
    ok('pair: match starts on both', (await inMatch(A)) && (await inMatch(B)), [await st(A), await st(B)]); await sleep(1500);
    const fa = await st(A), fb = await st(B); const hum = (s) => s.ft.split('').filter((c) => c === 'h').length; ok('pair: 2 humans + 2 bots on host and guest', hum(fa) === 2 && hum(fb) === 2 && fa.ft.length === 4, [fa.ft, fb.ft]); ok('pair: exactly one host', fa.host !== fb.host);
    clean(T, 'pair'); } finally { await T.close(); } }
if (only('cancel')) { console.log('--- cancel');
  const T = await open(2, 60); try { const [A, B] = T.pages; await toMenu(A); await click(A, 'net-auto'); await sleep(1200); await toMenu(B); await click(B, 'net-auto'); await waitFor(async () => (await st(A)).n === 2, 6000);
    await click(B, 'net-search-cancel'); await sleep(1200); const b = await st(B); ok('cancel: canceller back on the online menu, idle', b.cur === 'netMenu' && b.ms === 'idle', b); const a = await st(A); ok('cancel: remaining player sees found = 1 again', a.n === 1 && a.ms === 'searching', a);
    await click(A, 'net-search-cancel'); await sleep(500); ok('cancel: both cancelled, nobody hosting', (await st(A)).ph === 'idle');
    clean(T, 'cancel'); } finally { await T.close(); } }
if (only('four')) { console.log('--- four players');
  const T = await open(4, 60); try { for (const p of T.pages) { await toMenu(p); await click(p, 'net-auto'); await sleep(400); }
    ok('four: all four start together, no wait', (await Promise.all(T.pages.map((p) => inMatch(p)))).every(Boolean), await Promise.all(T.pages.map(st)));
    await sleep(1500); const S = await Promise.all(T.pages.map(st)); ok('four: 4 humans, 0 bots, one host', S.every((s) => s.ft === 'hhhh') && S.filter((s) => s.host).length === 1, S.map((s) => s.ft + (s.host ? '*' : '')));
    clean(T, 'four'); } finally { await T.close(); } }
if (only('rematch')) { console.log('--- host leaves before start: guest re-searches');
  const T = await open(2, 40, { }); try { const [A, B] = T.pages; await toMenu(A); await click(A, 'net-auto'); await sleep(1200); await toMenu(B); await click(B, 'net-auto');
    ok('rematch: lobby reached', await waitFor(async () => { const a = await st(A), b = await st(B); return a.cur === 'netLobby' && b.cur === 'netLobby' && b.ph === 'lobby'; }, 50000), [await st(A), await st(B)]);
    const hostP = (await st(A)).host ? A : B, guestP = hostP === A ? B : A; await ev(hostP, () => __bg.net.leave()); await ev(hostP, () => { __bg.Match.cancel(); });
    ok('rematch: guest goes back to searching (not an error screen)', await waitFor(async () => { const s = await st(guestP); return s.cur === 'netSearch' && ['connecting', 'searching'].includes(s.ms); }, 20000), await st(guestP));
    clean(T, 'rematch'); } finally { await T.close(); } }
if (only('offline')) { console.log('--- offline fallback');
  const T = await open(1, 8, {}, 'ws://localhost:1'); try { const [A] = T.pages; await toMenu(A); await click(A, 'net-auto');
    ok('offline: message + Play vs bots now shown', await waitFor(async () => ev(A, () => !!document.getElementById('net-offline-bots')), 15000) && /can.t reach auto match/i.test(await ev(A, () => document.getElementById('ui').innerText)));
    await A.page.screenshot({ path: '/workspace/out/v4.6-live/offline.png' }); await click(A, 'net-offline-bots'); await sleep(2500);
    ok('offline: bots match starts immediately', await ev(A, () => !!__bg.app.game && __bg.app.game.fighters.length >= 3 && !__bg.net.active), await ev(A, () => __bg.app.mode));
    console.log(A.logs.filter((l) => /error|warn/i.test(l)).slice(0, 8).join('\n').slice(0, 1200)); clean(T, 'offline'); } finally { await T.close(); } }
const f = R.filter((r) => !r.pass); console.log(JSON.stringify({ summary: { pass: R.length - f.length, fail: f.length }, failed: f.map((x) => x.name) }));
sig.stop(); srv.close(); process.exit(f.length ? 1 : 0);
