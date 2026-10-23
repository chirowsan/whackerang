// Play listing captures of online play against the LIVE matchmaker/relay (v4.6.1 web build served on localhost). Two real clients.
import http from 'node:http'; import fs from 'node:fs'; import { openN, ev, sleep, waitFor } from './netlib.mjs';
const FILE = process.argv[2] || '/tmp/web461.html'; const OUT = process.env.OUT || '/workspace/out/v4.6.1-results/raw'; fs.mkdirSync(OUT, { recursive: true });
const RLY = 'wss://whackerang-relay.chirowsan-backyard.workers.dev'; const PORT = 8350 + (process.pid % 40);
const srv = http.createServer((q, r) => { if (q.url.split('?')[0] !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(FILE)); }).listen(PORT);
const T = await openN(2, { relay: undefined, rly: RLY, url: `http://localhost:${PORT}/`, w: +process.env.W || 960, h: +process.env.H || 480, dpr: 2, mobile: true, extra: { mmFill: 45, forceRelay: true } });
const [A, B] = T.pages; const click = (p, id) => ev(p, (id) => { const e = document.getElementById(id); if (e) { e.click(); return true; } return false; }, id);
const shot = (p, n) => p.page.screenshot({ path: `${OUT}/${n}.png` });
for (const p of T.pages) await ev(p, () => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; });
await ev(A, () => __bg.UI.show('netMenu')); await sleep(1200); await shot(A, 'net-menu');
console.log('auto A', await click(A, 'net-auto')); await sleep(3000); await shot(A, 'net-search1');
await ev(B, () => __bg.UI.show('netMenu')); await sleep(500); console.log('auto B', await click(B, 'net-auto'));
await sleep(2500); await shot(A, 'net-search2');
await waitFor(async () => ev(A, () => __bg.net.phase === 'lobby'), 60000); await sleep(1500); await shot(A, 'net-lobby'); await shot(B, 'net-lobbyB');
// start the matched game if a start button exists (host), else wait for auto-start
await sleep(1000); const host = (await ev(A, () => __bg.net.isHost)) ? A : B; console.log('start', await click(host, 'net-start'));
for (let i = 0; i < 10; i++) { await sleep(700); await shot(A, `net-game-${i}`); }
console.log('state', JSON.stringify(await ev(A, () => ({ ph: __bg.net.phase, cur: __bg.UI.cur, n: __bg.app.game ? __bg.app.game.fighters.length : 0 }))));
console.log('errors', JSON.stringify(T.pages.flatMap((p) => p.errors).filter((e) => !/REQFAIL|favicon|Failed to load/.test(e)).slice(0, 4)));
await T.close(); srv.close(); process.exit(0);
