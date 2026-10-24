// v4.6.2 Auto match handoff probe: two real browsers, NOT forced to the relay (direct WebRTC first; this box's Chrome policy blocks UDP, like a strict carrier NAT).
// Records every Match/UI/Net state transition on both clients. usage: node tools/net_handoff.mjs [html] ; env RLY (matchmaker+relay base, default live), FILL (mmFill seconds, '' = default), SHIM='{"delay":300,"jitter":100}', SIG (PeerJS signaling url, default live)
import http from 'node:http'; import fs from 'node:fs'; import { openN, ev, sleep, waitFor } from './netlib.mjs';
const FILE = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html'; const RLY = process.env.RLY || 'wss://whackerang-relay.chirowsan-backyard.workers.dev';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
const PORT = 8400 + (process.pid % 50);
const srv = http.createServer((q, r) => { if (q.url.split('?')[0] !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(FILE)); }).listen(PORT);
// SIGHANG=1: a PeerJS signaling server that accepts the TCP connection and never answers (a stalled carrier proxy / captive network)
import net from 'node:net'; let SIG = process.env.SIG; if (process.env.SIGHANG) { const hp = 8460 + (process.pid % 30); net.createServer((s) => { s.on('error', () => {}); }).listen(hp); SIG = `ws://127.0.0.1:${hp}/peerjs?key=peerjs`; }
const extra = {}; if (process.env.FILL) extra.mmFill = +process.env.FILL;
// DROP=host: the client told to host closes its matchmaker socket at once (lost signal mid-handoff) ; DROP=open: it closes right after sending 'open' (never sees 'ok')
const DROP = process.env.DROP || '';
const pre = (i, DROP) => {
  window.__anim = 0; window.__redraw = 0; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('screen')) { if (n.classList.contains('still')) window.__redraw++; else window.__anim++; } }).observe(document, { childList: true, subtree: true });
  if (!DROP) return; const W = window.WebSocket; let done = false;
  window.WebSocket = function (u, p) { const ws = new W(u, p); if (!/\/m$/.test(String(u)) || done) return ws;
    const send = ws.send.bind(ws); ws.send = (d) => { send(d); if (DROP === 'open' && !done && /"t":"open"/.test(d)) { done = true; setTimeout(() => ws.close(), 0); } };
    ws.addEventListener('message', (e) => { if (DROP === 'host' && !done && /"t":"host"/.test(e.data)) { done = true; setTimeout(() => ws.close(), 0); } }); return ws; };
  window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
};
const T = await openN(2, { relay: SIG || undefined, rly: RLY, ice: ICE, url: `http://localhost:${PORT}/`, w: 640, h: 360, extra, shim: process.env.SHIM ? JSON.parse(process.env.SHIM) : undefined, wsLag: process.env.LAG ? JSON.parse(process.env.LAG) : undefined, pre: [pre, DROP] });
const t0 = Date.now(); const tl = [[], []];
const snap = (p) => ev(p, () => { const b = window.__bg; const n = b.net; return { ms: b.Match.state, cur: b.UI.cur, ph: n.phase, role: n.active ? n.role : '-', via: n.active ? n.conType : '', st: (n.status || '').slice(0, 50), note: (b.Match.note || '').slice(0, 40), ft: b.app.game && b.app.mode !== 'menu' ? b.app.game.fighters.map((f) => (f.isBot ? 'b' : 'h')).join('') : '' }; }).catch((e) => ({ err: String(e).slice(0, 80) }));
let stop = false; const rec = (async () => { const last = ['', '']; while (!stop) { for (let i = 0; i < 2; i++) { const s = await snap(T.pages[i]); const k = JSON.stringify(s); if (k !== last[i]) { last[i] = k; tl[i].push({ t: ((Date.now() - t0) / 1000).toFixed(1), ...s }); } } await sleep(100); } })();
const click = (p, id) => ev(p, (id) => { const e = document.getElementById(id); if (e) { e.click(); return true; } return false; }, id);
const [A, B] = T.pages; await ev(A, () => __bg.UI.show('netMenu')); await ev(B, () => __bg.UI.show('netMenu')); await sleep(400);
await click(A, 'net-auto'); await sleep(+(process.env.GAP || 1500)); await click(B, 'net-auto');
const both = await waitFor(async () => { const a = await snap(A), b = await snap(B); return a.ph === 'match' && b.ph === 'match' && a.ft && b.ft; }, +(process.env.WAIT || 90000), 300);
await sleep(2500); stop = true; await rec;
const fa = await snap(A), fb = await snap(B); const hum = (s) => (s.ft || '').split('').filter((c) => c === 'h').length;
for (let i = 0; i < 2; i++) { console.log(`--- client ${'AB'[i]} transitions (${tl[i].length})`); for (const e of tl[i]) console.log(JSON.stringify(e)); }
const scr = tl.map((l) => l.map((e) => e.cur).filter((c, i, a) => i === 0 || c !== a[i - 1]));
console.log('screens A:', scr[0].join(' > ')); console.log('screens B:', scr[1].join(' > '));
const anim = []; for (const p of T.pages) anim.push(await ev(p, () => ({ anim: window.__anim, redraw: window.__redraw, diag: window.__bg.Match.diag.map((e) => e.ev + (e.d ? ':' + e.d : '')).join(' | ') })).catch(() => ({})));
for (let i = 0; i < 2; i++) console.log(`diag ${'AB'[i]}:`, anim[i].diag);
const res = { both: !!both, anim: anim.map((a) => a.anim), redraw: anim.map((a) => a.redraw), screens: scr.map((x) => x.length), humansA: hum(fa), humansB: hum(fb), roles: [fa.role, fb.role], via: [fa.via, fb.via], secs: ((Date.now() - t0) / 1000).toFixed(1) };
console.log('RESULT', JSON.stringify(res));
console.log('errors', JSON.stringify(T.pages.flatMap((p) => p.errors).filter((e) => !/REQFAIL|favicon|Failed to load|WebSocket/.test(e)).slice(0, 5)));
await T.close(); srv.close(); process.exit(res.both && res.anim.every((n, i) => n <= res.screens[i] + 1) && res.humansA === 2 && res.humansB === 2 && res.roles.includes('host') && res.roles.includes('guest') ? 0 : 1);
