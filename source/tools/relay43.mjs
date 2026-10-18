// Relay protocol test with real WebSocket clients. Usage: node tools/relay43.mjs <wss://host> [--slow]   (default http://localhost:8799 = wrangler dev of server/cf-relay)
import { createRequire } from 'module'; const require = createRequire('/tmp/pp/'); const WebSocket = require('/tmp/pp/node_modules/ws');
const BASE = (process.argv[2] || 'ws://localhost:8799').replace(/\/$/, ''); const SLOW = process.argv.includes('--slow'); const ORIGIN = 'https://chirowsan.github.io';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); };
const code = () => { const a = 'BCDFGHJKLMNPQRSTVWXZ'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
function cli(room, role, origin = ORIGIN) {
  const ws = new WebSocket(`${BASE}/r/${room}?role=${role}`, origin ? { headers: { Origin: origin } } : {}); const c = { ws, ctl: [], bin: [], closed: null, open: false, err: null };
  ws.binaryType = 'nodebuffer'; ws.on('open', () => { c.open = true; }); ws.on('message', (d, isBin) => { if (isBin) c.bin.push(Buffer.from(d)); else c.ctl.push(d.toString()); }); ws.on('close', (code, r) => { c.closed = code; }); ws.on('error', (e) => { c.err = String(e.message || e); });
  c.wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(15); } return false; };
  c.json = () => c.ctl.map((s) => { try { return JSON.parse(s); } catch (e) { return s; } });
  return c;
}
const get = async (url) => { const r = await fetch(url, { headers: {} }); return r.status; };
const http = BASE.replace(/^ws/, 'http');
ok('healthz answers ok', (await get(http + '/healthz')) === 200);
// ---- origin rules
{ const a = cli(code(), 'host', null); await a.wait(() => a.err || a.open); ok('no Origin header is refused', !!a.err && !a.open, a.err); const b = cli(code(), 'host', 'https://evil.example'); await b.wait(() => b.err || b.open); ok('foreign Origin is refused', !!b.err && !b.open, b.err); const b2 = cli(code(), 'host', 'https://localhost.evil.example'); await b2.wait(() => b2.err || b2.open); ok('look-alike Origin is refused', !!b2.err && !b2.open, b2.err);
  for (const o of ['https://chirowsan.github.io', 'capacitor://localhost', 'https://localhost', 'http://localhost', 'http://localhost:8123']) { const c = cli(code(), 'host', o); await c.wait(() => c.open || c.err); ok('allowed origin ' + o, c.open && !c.err, c.err); c.ws.close(); } }
// ---- room life
const R = code(); const H = cli(R, 'host'); await H.wait(() => H.json().some((m) => m.t === 'ready')); ok('host gets ready', H.json().some((m) => m.t === 'ready' && m.g === 0));
const H2 = cli(R, 'host'); await H2.wait(() => H2.closed !== null); ok('second host is rejected (taken)', H2.json().some((m) => m.r === 'taken'), JSON.stringify(H2.json()));
const none = cli(code(), 'guest'); await none.wait(() => none.closed !== null); ok('guest to a room without a host: nohost', none.json().some((m) => m.r === 'nohost'));
const G1 = cli(R, 'guest'), G2 = cli(R, 'guest'); await G1.wait(() => G1.json().some((m) => m.t === 'ready')); await G2.wait(() => G2.json().some((m) => m.t === 'ready'));
const gid = (c) => (c.json().find((m) => m.t === 'ready') || {}).g; ok('guests get gids 1 and 2', gid(G1) === 1 && gid(G2) === 2, [gid(G1), gid(G2)].join());
await H.wait(() => H.json().filter((m) => m.t === 'join').length >= 2); ok('host is told about both joins', H.json().filter((m) => m.t === 'join').map((m) => m.g).join() === '1,2');
const G3 = cli(R, 'guest'); await G3.wait(() => G3.json().some((m) => m.t === 'ready')); const G4 = cli(R, 'guest'); await G4.wait(() => G4.closed !== null); ok('4th guest (5th client) is full', G4.json().some((m) => m.r === 'full'), JSON.stringify(G4.json()));
// ---- forwarding
G1.ws.send(Buffer.from([1, 9, 8, 7])); G2.ws.send(Buffer.from([0, 65, 66])); await H.wait(() => H.bin.length >= 2); const hb = H.bin.map((b) => [...b].join(','));
ok('guest frames reach the host prefixed with the guest id', hb.includes('1,1,9,8,7') && hb.includes('2,0,65,66'), JSON.stringify(hb));
H.ws.send(Buffer.from([0b0010, 1, 5, 5])); H.ws.send(Buffer.from([0b0110, 0, 1, 2, 3])); await G2.wait(() => G2.bin.length >= 1); await sleep(150);
ok('host mask 0b010 reaches only guest 1', G1.bin.map((b) => [...b].join(',')).includes('1,5,5') && !G2.bin.map((b) => [...b].join(',')).includes('1,5,5') && G3.bin.length === 0);
ok('host broadcast mask 0b110 reaches guests 1 and 2 (not 3)', G1.bin.map((b) => [...b].join(',')).includes('0,1,2,3') && G2.bin.map((b) => [...b].join(',')).includes('0,1,2,3') && G3.bin.length === 0);
// ---- limits
const before = H.bin.length; G1.ws.send(Buffer.alloc(16 * 1024 + 10, 1)); G1.ws.send('text frames are ignored'); await sleep(250); ok('oversized (>16 KB) and text frames are dropped', H.bin.length === before);
const b0 = H.bin.length; for (let i = 0; i < 400; i++) G2.ws.send(Buffer.from([1, i & 255])); await sleep(700); const got = H.bin.length - b0; ok('guest rate limit (~90/s): 400 frames in a burst are cut', got < 200 && got >= 20, 'delivered ' + got);
{ G3.ws.send('ping'); await G3.wait(() => G3.ctl.includes('pong'), 2000); ok('text "ping" answered "pong"', G3.ctl.includes('pong')); }
// ---- latency echo
{ const rtts = []; for (let i = 0; i < 25; i++) { const t0 = Date.now(); const n = G1.bin.length; G1.ws.send(Buffer.from([1, 77])); await H.wait(() => H.bin.some((b) => b[0] === 1 && b[2] === 77 && !b.seen && (b.seen = true)), 2000); H.ws.send(Buffer.from([0b0010, 1, 78])); await G1.wait(() => G1.bin.length > n && [...G1.bin[G1.bin.length - 1]].join() === '1,78', 2000); rtts.push(Date.now() - t0); await sleep(30); }
  rtts.sort((a, b) => a - b); ok('echo round trip guest->host->guest measured', rtts.length === 25, 'median ' + rtts[12] + ' ms, p90 ' + rtts[22] + ' ms'); }
// ---- reuse of a free gid, leave events
G2.ws.close(); await H.wait(() => H.json().some((m) => m.t === 'leave' && m.g === 2)); ok('host is told when a guest leaves', H.json().some((m) => m.t === 'leave' && m.g === 2));
const G5 = cli(R, 'guest'); await G5.wait(() => G5.json().some((m) => m.t === 'ready')); ok('freed guest id is reused', gid(G5) === 2, String(gid(G5)));
// ---- host leaves
H.ws.close(); await G1.wait(() => G1.json().some((m) => m.t === 'hostgone')); await G5.wait(() => G5.json().some((m) => m.t === 'hostgone')); ok('host leaving tells every guest (hostgone)', G1.json().some((m) => m.t === 'hostgone') && G5.json().some((m) => m.t === 'hostgone')); G1.ws.close(); G5.ws.close(); await sleep(300);
const H3 = cli(R, 'host'); await H3.wait(() => H3.json().some((m) => m.t === 'ready')); ok('the room code can be hosted again afterwards', H3.json().some((m) => m.t === 'ready')); H3.ws.close();
if (SLOW) { const R2 = code(); const h = cli(R2, 'host'); await h.wait(() => h.open); const g = cli(R2, 'guest'); await g.wait(() => g.json().some((m) => m.t === 'ready')); console.log('waiting for the idle timeout (guest connected, no data)...'); const ok2 = await h.wait(() => h.closed !== null, 110000); ok('idle room with a guest is closed after ~45-75 s', ok2 && h.closed === 4005, 'code ' + h.closed); }
console.log(JSON.stringify({ summary: { pass, fail } })); process.exit(fail ? 1 : 0);
