// v4.6.3 repro: raw matchmaker clients against the LIVE worker (protocol of v4.6.2 clients). Scenarios show how humans end up apart.
import { createRequire } from 'module'; const WS = createRequire('/tmp/pp/')('ws');
const URL_ = process.env.MM_URL || 'wss://whackerang-relay.chirowsan-backyard.workers.dev/m'; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mk = (name) => new Promise((res, rej) => { const ws = new WS(URL_, { headers: { Origin: 'https://chirowsan.github.io' } }); const c = { name, ws, ev: [], t0: Date.now() };
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()); } catch (e) { return; } m.at = ((Date.now() - T0) / 1000).toFixed(1); c.ev.push(m); });
  ws.on('close', (code) => { c.closed = code; }); ws.on('open', () => res(c)); ws.on('error', rej);
  c.q = (mode = 'classic', fill = 120) => ws.send(JSON.stringify({ t: 'q', mode, fill, v: 1 })); c.get = (t) => c.ev.find((e) => e.t === t); });
let T0 = Date.now();
const auto = (c) => { c.ws.on('message', (d) => { try { const m = JSON.parse(d.toString()); if (m.t === 'host') setTimeout(() => c.ws.send('{"t":"open"}'), 800); } catch (e) {} }); };
const sum = (cs) => cs.map((c) => `${c.name}:${c.get('host') ? 'HOST(' + c.get('host').code + ',expect ' + c.get('host').expect + ')@' + c.get('host').at : c.get('go') ? 'GUEST(' + c.get('go').code + ')@' + c.get('go').at : 'none'}`).join('  ');
const sc = process.argv[2] || 'all';
async function run(label, steps, wait) { T0 = Date.now(); const cs = []; for (const [at, name, mode, fill] of steps) { const d = at * 1000 - (Date.now() - T0); if (d > 0) await sleep(d); const c = await mk(name); auto(c); c.q(mode, fill); cs.push(c); } await sleep(wait * 1000 - (Date.now() - T0)); const codes = new Set(cs.map((c) => (c.get('host') || c.get('go') || {}).code).filter(Boolean)); console.log(label.padEnd(34), '| rooms', codes.size, '|', sum(cs)); cs.forEach((c) => { try { c.ws.close(); } catch (e) {} }); return codes.size; }
if (sc === 'all' || sc === 'mode') await run('A classic + B team (mode split)', [[0, 'A', 'classic', 20], [1, 'B', 'team', 20]], 26);
if (sc === 'all' || sc === 'late') await run('A,B at 0s; C at 9s (fill 8)', [[0, 'A', 'classic', 8], [0.3, 'B', 'classic', 8], [9, 'C', 'classic', 8]], 20);
if (sc === 'all' || sc === 'late25') await run('A,B at 0s; C at 27s (default fill)', [[0, 'A', 'classic', 120], [0.3, 'B', 'classic', 120], [27, 'C', 'classic', 120]], 30);
if (sc === 'all' || sc === 'pair') await run('A,B at 0s default fill', [[0, 'A', 'classic', 120], [0.2, 'B', 'classic', 120]], 28);
process.exit(0);
