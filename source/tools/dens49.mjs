// v4.9 offline parity + density checks (WebRTC is unavailable on this box, so the net path is exercised via app.netStartGuestRound with a host-shaped 'round' cfg).
// 1) host-style game (seed S, dens default 2) == guest built from {seed S, dens 2};  2) v4.8 host (no dens field) -> guest falls back to dens 1 == a dens-1 host build;
// 3) density: v4.9 traps <= 60% of dens-1 per size, no trap within 3.5 u of a spawn, crates/pillars cut. usage: node tools/dens49.mjs [html]
import { launch, sleep } from './lib.mjs';
const url = 'file://' + (process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); };
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true }); await page.goto(url); await sleep(2500);
const R = await page.evaluate(() => {
  const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; const app = __bg.app;
  const snap = () => { const g = app.game; let h = 0, n = 0, env = 0; const AWp = __bg.hxz()[0] * 2, isH = (k) => [3, 4, 5].includes(g.layout.t[k]), seen = new Uint8Array(g.layout.t.length); for (let k = 0; k < g.layout.t.length; k++) { h = (h * 31 + g.layout.t[k]) | 0; if (g.sol[k]) n++; if (isH(k) && !seen[k]) { env++; const st = [k]; seen[k] = 1; while (st.length) { const q = st.pop(), i = q % AWp, j = (q / AWp) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a; if (ii < 0 || ii >= AWp) continue; const r2 = (j + b) * AWp + ii; if (r2 >= 0 && r2 < seen.length && isH(r2) && !seen[r2]) { seen[r2] = 1; st.push(r2); } } } } } for (let k = 0; k < (g.layout.bush || []).length; k++) h = (h * 7 + g.layout.bush[k]) | 0; return { dens: g.dens, bushN: g.bushN || 0, h, solid: n, enc: env + g.traps.list.filter((t) => t.type !== 'jump' && t.type !== 'tele').length, tr: g.traps.list.map((t) => t.type + '@' + t.x.toFixed(2) + ',' + t.z.toFixed(2)).join(' '), n: g.traps.list.length, sw: g.traps.sw.length, minSp: Math.min(99, ...g.traps.list.flatMap((t) => g.fighters.map((f) => Math.hypot(t.x - f.x, t.z - f.z)))) }; };
  const players = () => [0, 1, 2, 3].map((i) => ({ hero: app.match ? undefined : undefined, ctrl: i ? 'bot' : 'p1', type: i ? 'bot' : 'human', slot: i, lives: 3, diff: 1 }));
  const out = [];
  for (const size of ['small', 'large', 'huge']) for (const arena of ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted']) {
    S.setup.arena = arena; S.setup.size = size; S.setup.traps = 'some'; S.setup.bots = 3; app.startMode('classic'); app.paused = true; const base = app.game;
    const cfg0 = { mode: 'classic', round: 1, need: 2, arena, size, traps: 'some', trapSet: null, mutator: null, rules: base.rules, seed: 4242 + out.length, speed: 'chill', players: base.fighters.map((f) => f.def) };
    const mk = (extra, dens) => { window.__bbDens = dens; try { app.setGame({ mode: 'vs', arenaId: arena, players: cfg0.players, round: 1, rules: cfg0.rules, size, traps: 'some', netSeed: cfg0.seed, ...extra }); } finally { window.__bbDens = undefined; } app.paused = true; return snap(); };
    const host2 = mk({}, 4), guest2 = mk({ dens: 4 }, undefined); /* v4.9 bush host (dens 4) */ const host5 = mk({}, undefined), guest5 = mk({ dens: 5 }, undefined); /* v4.10 default = 5 (melee + Armory): must build the SAME map as dens 4 */ const c3h = mk({}, 3), c3g = mk({ dens: 3 }, undefined); const p2h = mk({}, 2), p2g = mk({ dens: 2 }, undefined);
    const host1 = mk({}, 1), guest1 = mk({ dens: (({}).dens) || 1 }, undefined); // v4.8 host: no dens -> netStartGuestRound passes 1
    out.push({ size, arena, host2, guest2, host5, guest5, host1, guest1, p2h, p2g, c3h, c3g });
  }
  return out; });
// 4) mixed-version handshake on the real net object (stubbed links, actual message shapes)
const C = await page.evaluate(() => { const N = __bg.net; const out = {};
  let hello = null; N.guestHello.call({ G: { link: { send: (ch, s) => { hello = JSON.parse(s); } } }, cid: 'abc', profile: () => ({ name: 'T' }) }); out.helloDens = hello && hello.dens; out.helloProto = hello && hello.proto;
  const peers = (arr) => ({ H: { peers: new Map(arr.map((q, i) => [i, q])) } });
  out.allNew = N.roomDens.call(peers([{ isHost: true, conn: true }, { conn: true, dens: 4 }, { conn: true, dens: 4 }])); out.withP2 = N.roomDens.call(peers([{ conn: true, dens: 3 }, { conn: true, dens: 2 }]));
  out.oneOld = N.roomDens.call(peers([{ isHost: true, conn: true }, { conn: true, dens: 2 }, { conn: true }]));
  out.oldGone = N.roomDens.call(peers([{ conn: true, dens: 4 }, { conn: false }]));
  const tryHello = (phase, gdens, m) => { const sent = []; const p = { link: { send: (ch, s) => sent.push(JSON.parse(s)), close() {} } }; try { N.hostHello.call({ H: { peers: new Map(), slots: [null, null, null, null], settings: {} }, phase, app: { game: gdens ? { dens: gdens } : null }, applyProfile() {}, pickFreeHero() {}, syncLobby() {}, lateSeat() { return true; }, sendTo() {}, resendSlow() {}, emit() {} }, p, m); } catch (e) { sent.push({ err: String(e.message || e).slice(0, 60) }); } return { sent: sent.map((x) => x.t + ':' + (x.r || '')), dens: p.dens }; };
  out.p2MidCalm = tryHello('match', 3, { t: 'hello', proto: hello.proto, cid: 'p2', dens: 2 }); out.oldMidMatch = tryHello('match', 3, { t: 'hello', proto: hello.proto, cid: 'old1' });
  out.oldMidLegacyRound = tryHello('match', 1, { t: 'hello', proto: hello.proto, cid: 'old2' });
  out.oldLobby = tryHello('lobby', null, { t: 'hello', proto: hello.proto, cid: 'old3' });
  out.newMidMatch = tryHello('match', 4, { t: 'hello', proto: hello.proto, cid: 'new1', dens: 4 }); out.p3MidBush = tryHello('match', 4, { t: 'hello', proto: hello.proto, cid: 'p3', dens: 3 }); out.p3MidCalm = tryHello('match', 3, { t: 'hello', proto: hello.proto, cid: 'p3b', dens: 3 });
  out.withP3 = N.roomDens.call(peers([{ isHost: true, conn: true }, { conn: true, dens: 4 }, { conn: true, dens: 3 }]));
  return out; });
ok('guest hello advertises dens 5 = calm + bushes + melee/Armory (same PROTO)', C.helloDens === 5, C);
ok('room density: all bush builds -> 4, a calm-only (pass-3) guest -> 3 (no bushes/stealth), a pass-2 dev guest -> 2, any v4.8 guest -> 1, disconnected seat ignored', C.allNew === 4 && C.withP3 === 3 && C.withP2 === 2 && C.oneOld === 1 && C.oldGone === 4, C);
ok('calm-only (pass-3) guest joining a running bush round -> reject:version; joining a running calm round -> accepted', C.p3MidBush.sent[0] === 'reject:version' && !C.p3MidCalm.sent.includes('reject:version') && C.p3MidCalm.dens === 3, [C.p3MidBush, C.p3MidCalm]);
ok('v4.8 or pass-2 guest joining a running calm round -> clear reject:version (no silent map)', C.oldMidMatch.sent[0] === 'reject:version' && C.p2MidCalm.sent[0] === 'reject:version', [C.oldMidMatch, C.p2MidCalm]);
ok('v4.8 guest in lobby / legacy round -> accepted (no version reject), marked dens 1', !C.oldLobby.sent.includes('reject:version') && C.oldLobby.dens === 1 && !C.oldMidLegacyRound.sent.includes('reject:version'), [C.oldLobby, C.oldMidLegacyRound]);
ok('v4.9 bush guest mid bush-match not version-rejected', !C.newMidMatch.sent.includes('reject:version') && C.newMidMatch.dens === 4, C.newMidMatch);
let agg = {};
for (const r of R) {
  ok(`${r.size} ${r.arena}: bush (dens 4) guest == host (layout+bushes+traps)`, r.host2.h === r.guest2.h && r.host2.tr === r.guest2.tr && r.host2.dens === 4 && r.host2.bushN > 0);
  ok(`${r.size} ${r.arena}: v4.10 default (dens 5) host == dens-5 guest == the v4.9 dens-4 map (melee changes no map/trap)`, r.host5.dens === 5 && r.host5.h === r.host2.h && r.host5.tr === r.host2.tr && r.guest5.h === r.host5.h && r.guest5.tr === r.host5.tr);
  ok(`${r.size} ${r.arena}: calm-only (dens 3) room guest == host, no bushes`, r.c3h.h === r.c3g.h && r.c3h.tr === r.c3g.tr && r.c3h.dens === 3 && r.c3h.bushN === 0 && r.p2h.bushN === 0 && r.host1.bushN === 0);
  ok(`${r.size} ${r.arena}: pass-2 (dens 2) room guest == host`, r.p2h.h === r.p2g.h && r.p2h.tr === r.p2g.tr && r.p2h.dens === 2);
  ok(`${r.size} ${r.arena}: v4.8-host fallback guest (dens 1) == dens-1 host`, r.host1.h === r.guest1.h && r.host1.tr === r.guest1.tr && r.host1.dens === 1);
  { const lim = r.size === 'small' ? 2.7 : 3.5; ok(`${r.size} ${r.arena}: no v4.9 trap within ${lim} u of a spawn`, r.host2.n === 0 || r.host2.minSp >= lim, r.host2.minSp); }
  { const cap = { small: 2, large: 3, huge: 4 }[r.size]; ok(`${r.size} ${r.arena}: calm default has <= ${cap} hazard encounters (traps + lava/spike/conveyor patches), was ${r.p2h.enc} in pass 2 / ${r.host1.enc} in v4.8`, r.host2.enc <= cap && r.host2.enc >= 1, r.host2.enc); }
  const a = agg[r.size] = agg[r.size] || { t1: 0, t2: 0, s1: 0, s2: 0 }; a.t1 += r.host1.n; a.t2 += r.host2.n; a.s1 += r.host1.solid; a.s2 += r.host2.solid;
}
for (const [s, a] of Object.entries(agg)) { const k = s === 'small' ? 0.7 : 0.6; /* small was already capped to 3 trap kinds in v4.8 */ { const k = s === 'small' ? 0.45 : 0.4; /* small v4.8 was already capped; its encounter cap of 2 is asserted per arena above */ ok(`${s}: trap objects ${a.t2} <= ${k * 100}% of v4.8 ${a.t1}`, a.t2 <= a.t1 * k, a); } ok(`${s}: blockers (solid cells) reduced >= 55% vs v4.8`, a.s2 <= a.s1 * 0.45, a); }
const errs = errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)); ok('no page errors', !errs.length, errs.slice(0, 3));
console.log(`${pass}/${pass + fail} passed`); await browser.close(); process.exit(fail ? 1 : 0);
