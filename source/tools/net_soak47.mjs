// v4.7 online soak: host + N-1 guests, one browser per client (SPLIT), guests forced onto the WebSocket relay (no WebRTC policy bypass).
// Every human client random-walks / dashes / throws via its own keyboard state; bots fill the rest. Loops map sizes x modes for MIN wall-minutes.
// Host: hooks Fighter.die (zero tolerance: fall on solid floor, fall while hearts left). Host + guests sampled ~2/s: NaN, off-map, alive below floor
// on a floor cell, maxHp != 3, hp out of range; guest hp vs host hp drift (persisting mismatch) ; guest HUD shows hearts; console errors.
const HPX = { bao: 4, nori: 2, tako: 3, kuma: 3, pico: 3, yuki: 3, gus: 5, wisp: 2 }; // v4.7b per-hero hearts
import http from 'node:http'; import fs from 'node:fs';
import { startTurn, startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = process.env.RLY || 'ws://localhost:8799'; const N = +(process.env.N || 3); const MIN = +(process.env.MIN || 20);
const SIZES = (process.env.SIZES || 'small,large,huge').split(','); const MODES = (process.env.MODES || 'classic,crumble,team,koth').split(',');
const PORT = 8240 + (process.pid % 50); const FILE = process.env.HTML || '/workspace/boomerang-brawl/Whackerang.html';
const srv = http.createServer((q, r) => { if (q.url !== '/') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(FILE)); }).listen(PORT);
const URL_ = `http://localhost:${PORT}/`; const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const turn = { stop: async () => {} }; // v4.7: no local TURN; stock WebRTC policy, everyone on the relay
const sig = await startRelay(9130 + (process.pid % 20));
const T = []; for (let i = 0; i < N; i++) T.push(await openN(1, { relay: sig.url, rly: RLY, url: URL_, w: 480, h: 270, stockRtc: true, ice: [] }));
const P = T.map((t) => t.pages[0]); const [H, ...G] = P;
const CH = { fails: [], tot: { samples: 0, deaths: 0, falls: 0, bad: 0, fwh: 0, hurts: 0, nan: 0, oob: 0, sink: 0, maxhp: 0, hprange: 0, drift: 0, hudMiss: 0, matches: 0, rounds: 0, perSize: {} } };
let nF = 0; const fail = (k, d) => { if (nF++ < 6) console.log('FAILNOW', k, JSON.stringify(d)); if (CH.fails.length < 40) CH.fails.push([k, d]); };
const INSTALL = () => { if (window.__ks) return; window.__ks = 1; const I = __bg.Input; let t = 0, held = [];
  setInterval(() => { const g = __bg.app.game; if (!g || g.state !== 'play') { held.forEach((k) => I.keys.delete(k)); held = []; return; } t -= 0.1; if (t <= 0) { t = 0.3 + Math.random() * 0.9; held.forEach((k) => I.keys.delete(k)); held = []; const D = [['KeyW'], ['KeyS'], ['KeyA'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']]; held = D[Math.floor(Math.random() * D.length)].slice(); held.forEach((k) => I.keys.add(k)); }
    if (Math.random() < 0.08) { I.keys.add('Space'); I.edge.add('Space'); setTimeout(() => I.keys.delete('Space'), 60); } if (Math.random() < 0.08) { I.keys.add('KeyF'); I.edge.add('KeyF'); setTimeout(() => I.keys.delete('KeyF'), 120); } }, 100); };
const HOOK = () => { window.HK = { deaths: 0, falls: 0, bad: 0, fwh: 0, hurts: 0, ex: [] }; const hook = () => { const g = __bg.app.game; if (!g || !g.fighters[0]) return; const fp = Object.getPrototypeOf(g.fighters[0]); if (fp._hk) return; fp._hk = 1; const od = fp.die;
  fp.die = function (killer, kind, ...a) { const g2 = __bg.app.game; const hp0 = this.hp, al = this.alive; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); const i = Math.floor(this.x + hx), j = Math.floor(this.z + hz); const hole = g2 && i >= 0 && j >= 0 && i < W && j < Math.round(hz * 2) ? g2.hole[j * W + i] : 'oob'; const r = od.call(this, killer, kind, ...a);
    if (al && !this.alive) { HK.deaths++; if (kind === 'fall') { HK.falls++; if (!(hole === -1 || hole > 0)) { HK.bad++; HK.ex.push(['fall-on-floor', hole, this.x, this.z]); } if (hp0 > 1 && !this.boss) { HK.fwh++; HK.ex.push(['fall-with-hearts', hp0]); } } } else if (al && this.alive && this.hp < hp0) HK.hurts++; return r; }; }; setInterval(hook, 200); };
const SAMPLE = () => { const g = __bg.app.game; if (!g || !g.fighters) return null; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); const out = { st: g.state, f: [], hud: (document.querySelectorAll('#h-pl .hearts').length) };
  for (const f of g.fighters) { const i = Math.floor(f.x + hx), j = Math.floor(f.z + hz); const k = j * W + i; out.f.push({ x: f.x, y: f.y || 0, z: f.z, a: !!f.alive, hp: f.hp, mh: f.maxHp, hid: f.hero && f.hero.id, boss: !!f.boss, cell: (i >= 0 && j >= 0 && i < W) ? g.hole[k] : 'oob', sol: g.sol ? g.sol[k] : 0, hx, hz, fall: !!(f.falling || f.fallT > 0) }); } return out; };
try {
  for (const p of P) { await ev(p, INSTALL); } await ev(H, HOOK);
  const h = await ev(H, async () => await __bg.net.host()); log('room', h && h.code); if (!h || !h.code) throw new Error('no room');
  for (const g of G) { await ev(g, (x) => Object.assign(window.__bbNet, x), { forceRelay: true }); await ev(g, (c) => { __bg.net.join(c).catch(() => {}); }, h.code); if (!(await waitFor(async () => (await ev(g, () => __bg.net.phase)) === 'lobby', 40000))) throw new Error('guest did not reach lobby'); }
  const via = []; for (const g of G) via.push(await ev(g, () => (__bg.net.G && (__bg.net.G.relay || __bg.net.G.viaRelay || __bg.net.G.mode)) || JSON.stringify(Object.keys(__bg.net.G || {})).slice(0, 200))); log('guest transport', JSON.stringify(via));
  const end = Date.now() + MIN * 60000; let it = 0; let drift = new Map();
  while (Date.now() < end) {
    const size = SIZES[it % SIZES.length], mode = MODES[Math.floor(it / SIZES.length) % MODES.length]; it++;
    await ev(H, (o) => { const n = __bg.net; if (n.phase !== 'lobby') n.toLobby(); n.setSetting('size', o.size); n.setSetting('mode', o.mode); n.setSetting('traps', 'wild'); n.setSetting('events', 'wild'); n.setSetting('rounds', 3); n.setSetting('bots', true); }, { size, mode });
    await sleep(800); for (const g of G) await ev(g, () => __bg.net.setReady(true)); await sleep(1200);
    await ev(H, () => __bg.net.startMatch()); CH.tot.matches++; const ps = CH.tot.perSize[size] = CH.tot.perSize[size] || { matches: 0, samples: 0, secs: 0 }; ps.matches++; const t0 = Date.now(); log('match', it, size, mode);
    let lastSt = ''; while (Date.now() - t0 < 240000 && Date.now() < end) {
      const ph = await ev(H, () => __bg.net.phase); if (ph !== 'match') break;
      const S = await Promise.all(P.map((p) => ev(p, SAMPLE).catch((e) => ({ err: String(e) }))));
      const hs = S[0]; if (hs && hs.st !== lastSt) { if (hs.st === 'play') CH.tot.rounds++; lastSt = hs.st; }
      S.forEach((s, ci) => { if (!s || s.err || !s.f) return; CH.tot.samples++; ps.samples++; s.f.forEach((f, fi) => {
        if (!Number.isFinite(f.x) || !Number.isFinite(f.z)) { CH.tot.nan++; fail('nan', { ci, fi }); return; }
        if (f.a && (Math.abs(f.x) > f.hx + 0.05 || Math.abs(f.z) > f.hz + 0.05)) { CH.tot.oob++; fail('oob', { ci, fi, x: f.x, z: f.z, hx: f.hx, hz: f.hz, st: s.st, h: hs && hs.f && hs.f[fi] && [hs.f[fi].x, hs.f[fi].z, hs.f[fi].hx, hs.f[fi].a, hs.st], f }); }
        if (f.a && !f.fall && f.y < -0.35 && f.cell === 0 && !f.sol) { CH.tot.sink++; fail('below-floor', { ci, fi, y: f.y, size }); }
        if (!f.boss && f.mh !== HPX[f.hid]) { CH.tot.maxhp++; fail('maxHp', { ci, fi, mh: f.mh, hid: f.hid, mode }); }
        if (f.a && (f.hp < 1 || f.hp > (HPX[f.hid] || 3)) && !f.boss) { CH.tot.hprange++; fail('hp-range', { ci, fi, hp: f.hp }); } });
        if (ci > 0 && s.st === 'play' && hs && hs.st === 'play') { s.f.forEach((f, fi) => { const hf = hs.f[fi]; const k = ci + ':' + fi; if (hf && (hf.hid !== f.hid || hf.mh !== f.mh)) { CH.tot.maxhp++; fail('hero/maxHp mismatch host vs guest', { ci, fi, g: [f.hid, f.mh], h: [hf.hid, hf.mh] }); } if (hf && f.a && hf.a && f.hp !== hf.hp) { const n = (drift.get(k) || 0) + 1; drift.set(k, n); if (n === 4) { CH.tot.drift++; fail('hp-drift', { ci, fi, g: f.hp, h: hf.hp }); } } else drift.set(k, 0); }); if (s.hud < 1) { CH.tot.hudMiss++; } } });
      await sleep(450);
    }
    ps.secs += Math.round((Date.now() - t0) / 1000);
    const hk = await ev(H, () => ({ ...HK, ex: HK.ex.slice(0, 5) })); log('after match', JSON.stringify({ hk, rounds: CH.tot.rounds, samples: CH.tot.samples, fails: CH.fails.length }));
    if (await ev(H, () => __bg.net.phase) === 'match') { await ev(H, () => { __bg.net.matchEnd && __bg.net.matchEnd(-1, { winTeam: -1 }); }).catch(() => {}); await sleep(1500); }
    const lost = []; for (const [i, g] of G.entries()) { const gp = await ev(g, () => __bg.net.phase); if (!/lobby|results|match/.test(gp)) lost.push([i + 1, gp]); } if (lost.length) { fail('guest-left', lost); log('guest lost', JSON.stringify(lost)); break; }
  }
  const hk = await ev(H, () => ({ ...HK })); Object.assign(CH.tot, { deaths: hk.deaths, falls: hk.falls, bad: hk.bad, fwh: hk.fwh, hurts: hk.hurts }); if (hk.ex.length) fail('host-ex', hk.ex.slice(0, 5));
} catch (e) { fail('exception', String(e && e.stack || e).slice(0, 300)); }
const errs = P.flatMap((p, i) => p.errors.filter((e) => !/favicon|Failed to load resource|ERR_CONNECTION_REFUSED|WebSocket connection|REQFAIL ws:|REQFAIL wss:/.test(e)).map((e) => i + ': ' + e.slice(0, 200)));
const t = CH.tot; const bad = t.bad + t.fwh + t.nan + t.oob + t.sink + t.maxhp + t.hprange + t.drift + errs.length + CH.fails.filter((f) => /exception|guest-left/.test(f[0])).length;
console.log('TOTALS', JSON.stringify(t)); if (CH.fails.length) console.log('FAILS', JSON.stringify(CH.fails.slice(0, 20))); if (errs.length) console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
console.log(`${bad ? 'FAIL' : 'PASS'} online soak N=${N} relay ${RLY}: ${t.matches} matches, ${t.rounds} rounds, ${t.samples} client samples, ${t.deaths} KOs (${t.falls} last-heart falls into real holes), ${t.hurts} hearts lost; 0-tolerance: fall-on-floor ${t.bad}, fall-with-hearts ${t.fwh}, NaN ${t.nan}, off-map ${t.oob}, below-floor ${t.sink}, maxHp-mismatch ${t.maxhp}, hp-range ${t.hprange}, hp-drift ${t.drift}, console errors ${errs.length}; guest HUD-without-hearts samples ${t.hudMiss}`);
console.log(JSON.stringify({ summary: { fail: bad } }));
for (const x of T) await x.close().catch(() => {}); await turn.stop(); sig.stop(); srv.close(); process.exit(bad ? 1 : 0);
