// v4.8 probe: quick host+guest match transitions across sizes; logs round msg size and guest state after each start.
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = 'ws://localhost:8799'; const SIZES = (process.env.SIZES || 'small,large,huge,small,huge,large').split(',');
const PORT = 8300 + (process.pid % 50); const FILE = '/workspace/boomerang-brawl/Whackerang.html';
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(FILE)); }).listen(PORT);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const sig = await startRelay(9160 + (process.pid % 20));
const T = []; for (let i = 0; i < 2; i++) T.push(await openN(1, { relay: sig.url, rly: RLY, url: `http://localhost:${PORT}/`, w: 480, h: 270, stockRtc: true, ice: [] }));
const [H, g] = T.map((t) => t.pages[0]); let bad = 0;
try {
  const h = await ev(H, async () => await __bg.net.host()); log('room', h && h.code);
  await ev(g, (x) => Object.assign(window.__bbNet, x), { forceRelay: true }); await ev(g, (c) => { __bg.net.join(c).catch(() => {}); }, h.code);
  if (!(await waitFor(async () => (await ev(g, () => __bg.net.phase)) === 'lobby', 40000))) throw new Error('no lobby');
  for (const [i, size] of SIZES.entries()) {
    const mode = (process.env.MODES || 'classic,crumble,koth,bomb,team').split(',')[i % 5];
    await ev(H, (o) => { const n = __bg.net; if (n.phase !== 'lobby') n.toLobby(); n.setSetting('size', o.size); n.setSetting('mode', o.mode); n.setSetting('traps', 'wild'); n.setSetting('events', 'wild'); n.setSetting('rounds', 3); n.setSetting('bots', true); }, { size, mode });
    await sleep(800); await ev(g, () => __bg.net.setReady(true)); await sleep(1200);
    await ev(H, () => __bg.net.startMatch()); await sleep(6000);
    const hs = await ev(H, () => ({ ph: __bg.net.phase, len: JSON.stringify(__bg.net.roundMsg()).length, gm: __bg.app.game.mode, st: __bg.app.game.state }));
    const gs = await ev(g, () => ({ ph: __bg.net.phase, gm: __bg.app.game && __bg.app.game.mode, st: __bg.app.game && __bg.app.game.state, err: __bg.net.error, size: __bg.app.match && __bg.app.match.size }));
    const ok = gs.gm === 'vs' && gs.ph === 'match'; if (!ok) bad++; log(ok ? 'OK ' : 'BAD', size, mode, JSON.stringify(hs), JSON.stringify(gs));
    await ev(H, () => { __bg.net.matchEnd && __bg.net.matchEnd(-1, { winTeam: -1 }); }).catch(() => {}); await sleep(2500);
    const gp = await ev(g, () => ({ ph: __bg.net.phase, err: __bg.net.error })); log('  after end guest', JSON.stringify(gp)); if (gp.ph === 'ended') { bad++; break; }
  }
} catch (e) { bad++; log('EXC', e && e.stack); }
log(bad ? 'FAIL' : 'PASS', 'bad', bad); for (const t of T) await t.close().catch(() => {}); srv.close(); await sig.stop?.().catch?.(() => {}); process.exit(bad ? 1 : 0);
