// v4.9 bushes / stealth: layout, fairness, mechanics, visibility, targeting, bots, projectiles. usage: node tools/bush49.mjs [html]
import { launch, sleep } from './lib.mjs';
const url = 'file://' + (process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? ' ' + JSON.stringify(x).slice(0, 400) : '')); };
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true }); await page.goto(url); await sleep(2500);
const L = await page.evaluate(() => {
  const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; const app = __bg.app; const out = [];
  const players = [0, 1, 2, 3].map((i) => ({ hero: __bg.HEROES[i], hat: 'none', ctrl: i ? 'bot' : 'human', slot: i ? -1 : 0, name: 'P' + i, diff: 1 }));
  const mk = (arena, size, extra, dens) => { window.__bbDens = dens; try { app.setGame({ mode: 'vs', arenaId: arena, players, round: 1, rules: { type: 'elim' }, size, traps: 'some', netSeed: 777, ...extra }); } finally { window.__bbDens = undefined; } app.paused = true; return app.game; };
  for (const size of ['small', 'large', 'huge']) for (const arena of ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted']) {
    const g = mk(arena, size, {}); const [HX, HZ] = __bg.hxz(); const AW = HX * 2, AH = HZ * 2; const B = g.layout.bush || []; let h = 0, n = 0, sym = true, bad = [], central = 0, nearSp = 0, nearTrap = 0;
    const isH = (k) => [3, 4, 5].includes(g.layout.t[k]); let env = 0; const seen = new Uint8Array(AW * AH);
    for (let k = 0; k < AW * AH; k++) { if (isH(k) && !seen[k]) { env++; const st = [k]; seen[k] = 1; while (st.length) { const q = st.pop(), i = q % AW, j = (q / AW) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= AW || jj >= AH) continue; const r2 = jj * AW + ii; if (isH(r2) && !seen[r2]) { seen[r2] = 1; st.push(r2); } } } } }
    for (let k = 0; k < AW * AH; k++) { h = (h * 31 + (B[k] || 0)) | 0; if (!B[k]) continue; n++; const i = k % AW, j = (k / AW) | 0, x = i - HX + 0.5, z = j - HZ + 0.5;
      if (!B[(AH - 1 - j) * AW + (AW - 1 - i)]) sym = false; if (g.layout.t[k] !== 0 || g.sol[k]) bad.push(k); if (Math.abs(x) < HX * 0.4 && Math.abs(z) < HZ * 0.4) central++;
      if (g.fighters.some((f) => Math.hypot(f.x - x, f.z - z) < 1.9)) nearSp++;
      if (g.traps.list.some((t) => Math.hypot(t.x - x, t.z - z) < 1.5) || g.traps.sw.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) nearTrap++; }
    const sol = g.layout.sol0, trS = g.traps.list.map((t) => t.type + t.x.toFixed(2)).join(); const enc = env + g.traps.list.filter((t) => t.type !== 'jump' && t.type !== 'tele').length;
    const gg = mk(arena, size, { dens: 4 }); let h2 = 0; for (let k = 0; k < AW * AH; k++) h2 = (h2 * 31 + ((gg.layout.bush || [])[k] || 0)) | 0; const tr2 = gg.traps.list.map((t) => t.type + t.x.toFixed(2)).join();
    const g3 = mk(arena, size, { dens: 3 }); const sol3 = g3.layout.sol0; const b3 = g3.bushN || 0;
    const gb = mk(arena, size, { rules: { type: 'ball' } }); const bb = gb.bushN || 0;
    out.push({ size, arena, dens: g.dens, n, bushN: g.bushN, h, h2, tr: trS === tr2, sym, bad: bad.length, central, nearSp, nearTrap, enc, sol, sol3, b3, bb, pockets: 0, im: !!(g.view.bushIm && g.view.bushIm.count) });
  }
  return out;
});
const cap = { small: 2, large: 3, huge: 4 }, maxB = { small: 16, large: 32, huge: 32 };
for (const r of L) {
  ok(`${r.size} ${r.arena}: default build is the bush layout (dens 4) with ${r.n} bush cells (1..${maxB[r.size]}) drawn`, r.dens === 4 && r.n > 0 && r.n <= maxB[r.size] && r.n === r.bushN && r.im, r);
  ok(`${r.size} ${r.arena}: bushes seeded/deterministic (guest dens 4 == host), point-mirrored, off solids/hazards, not central, not on spawns, clear of traps/switches`, r.h === r.h2 && r.tr && r.sym && !r.bad && !r.central && !r.nearSp && !r.nearTrap, r);
  ok(`${r.size} ${r.arena}: calm caps kept (${r.enc} <= ${cap[r.size]} hazards, >=1) and cover unchanged vs calm (${r.sol} == ${r.sol3}); dens 3 and Ball have no bushes`, r.enc <= cap[r.size] && r.enc >= 1 && r.sol === r.sol3 && r.b3 === 0 && r.bb === 0, r);
}
// ---------------- mechanics (small dojo, 3 fighters: you (team 0), bot X (1), bot Y (2))
const M = await page.evaluate(() => {
  const app = __bg.app; const R = {};
  const players = [0, 1, 2].map((i) => ({ hero: __bg.HEROES[i], hat: 'none', ctrl: i ? 'bot' : 'human', slot: i ? -1 : 0, name: 'P' + i, diff: 2 }));
  app.setGame({ mode: 'vs', arenaId: 'dojo', players, round: 1, rules: { type: 'elim', sudden: false }, size: 'small', traps: 'off', netSeed: 99 }); app.paused = true; const g = app.game; g.state = 'play'; g.introT = 0; g.cdDone = true;
  const [HX, HZ] = __bg.hxz(); const AW = HX * 2; const B = g.layout.bush; const cells = []; for (let k = 0; k < B.length; k++) if (B[k]) cells.push(k);
  // a bush cell whose 3 neighbours make a 2x2 block -> its shared corner is a fully-covered standing spot
  let spot = null; for (const k of cells) { const i = k % AW, j = (k / AW) | 0; if (B[k + 1] && B[k + AW] && B[k + AW + 1]) { spot = [i - HX + 1, j - HZ + 1]; break; } }
  const [H, X, Y] = g.fighters; const st = (n = 1) => { n = Math.ceil(n / ((g.cfg && g.cfg.ts) || 1)); /* n = game-time frames (Game Speed scales the sim) */ for (let q = 0; q < n; q++) { g.fighters.forEach((f) => { f.lives = 9; }); g.update(1 / 60); } };
  const place = (f, x, z) => { f.x = x; f.z = z; f.vx = f.vz = 0; };
  const freeze = () => { for (const f of [X, Y]) { f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }); } };
  const bots = { x: X.bot.update, y: Y.bot.update }; freeze(); H.netIn = null;
  g.input = { read: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) };
  place(X, -spot[0], -spot[1]); place(Y, -spot[0], spot[1] > 0 ? -spot[1] + 0.0 : spot[1]); place(Y, spot[0] * -1, -spot[1] * -1 + 0); place(Y, 0, 0); place(H, spot[0], spot[1]); st(2);
  R.spot = spot; R.inHid = H.hid; R.xSees = __bg.app.game && g.fighters && (function () { return null; })();
  const SM = __bg.stealth; R.api = !!SM;
  R.canX = SM.canSee(g, X.team, H); R.canSelf = SM.canSee(g, H.team, H);
  g.vis(0); R.selfShown = H.model.root.visible; R.selfGhost = H.model._gk;
  { const m = H.model, gm = m._gm || []; const ol = gm.filter((c) => c.userData.ol), bd = gm.filter((c) => !c.userData.ol); R.mat = { ol: ol.length, olLight: ol.every((c) => c.color.getHex() === 0xeef4ff && Math.abs(c.opacity - 0.75) < 1e-6 && typeof c.onBeforeCompile === 'function' && c.onBeforeCompile === (c.userData && c.onBeforeCompile)), olShader: ol.every((c) => c.onBeforeCompile && c.onBeforeCompile.toString().includes('thick')), body: bd.length && bd.every((c) => c.transparent && c.opacity <= 0.61 && c.opacity >= 0.3), ringTop: !m.ring.material.depthTest && (!m.youRing || !m.youRing.material.depthTest), ringA: m.ring.material.opacity, mark: !!(m.mark && m.mark.visible && m.mark.userData.big) };
    __bg.renderNow(); const p = new __bg.THREE.Vector3(); m.mark.updateMatrixWorld(true); m.mark.getWorldPosition(p); const sc = __bg.toScreen(p.x, p.y + 0.7, p.z), bodyS = __bg.toScreen(H.x, 0.6, H.z); R.markScr = [+sc[0].toFixed(3), +sc[1].toFixed(3)]; R.mp = [p.x, p.y, p.z, m.mark.position.x, m.mark.position.z, JSON.stringify(m.mark.matrixWorld.elements.slice(12)), JSON.stringify(m.root.matrixWorld.elements.slice(12)), m.root.scale.x, m.mark.position.y]; R.bodyScr = [+bodyS[0].toFixed(3), +bodyS[1].toFixed(3)]; }
  { const vw = g.view; const t0 = __bg.gfx.touchCtl; __bg.gfx.touchCtl = () => true; for (let q = 0; q < 40; q++) vw.bushUnderHud(1 / 30); R.flatMin = Math.min(...vw.bushK); __bg.gfx.touchCtl = () => false; for (let q = 0; q < 60; q++) vw.bushUnderHud(1 / 30); R.flatOff = Math.min(...vw.bushK); __bg.gfx.touchCtl = t0; R.bushStill = g.layout.bush.reduce((a, b) => a + b, 0) === g.bushN; }
  // opponent's view: pretend this screen belongs to X
  g.viewIdx = 1; g.vis(0); R.oppShown = H.model.root.visible; R.oppParts = H.model.root.visible || false; /* ring, YOU ring, marker, shadow are children of root */ R.oppMinimap = SM.shownHere(g, H); g.viewIdx = undefined; g.vis(0);
  // aim assist from X cannot lock a hidden H; nearest-visible enemy for X skips H
  X.netIn = { assist: true, touchy: true }; const base = Math.atan2(H.x - X.x, H.z - X.z) + 0.3; R.assistAng = g.pickAim(X, base, false); R.assistBase = base; R.nearVis = (g.nearestEnemy(X, X.x, X.z, 1e9, null, true) || {}).name; X.netIn = null;
  // bots: X thinks -> must not target H (Y is visible)
  X.bot.update = bots.x; X.bot.think(); R.botT = X.bot.target ? X.bot.target.name : null; X.bot.target = H; X.bot.thinkT = 9; X.bot.update(1 / 60); R.botDrop = X.bot.target === H; freeze();
  // throw reveals ~1.5 s, then rehide
  H.ammo = 1; H.throwCd = 0; g.throwFrom(H, 0, true, 0.2); st(1); R.thrHid = H.hid; R.revT = +H.revealT.toFixed(2); st(60); R.thr1s = H.hid; st(40); R.thr17 = H.hid; for (const b of [...g.booms]) b.kill(); g.booms.length = 0; H.ammo = 1;
  // damage reveals
  H.hp = 3; H.maxHp = 3; H.inv = 0; H.die(X, 'boom', 1, 0); place(H, spot[0], spot[1]); st(1); R.hurtHid = H.hid; R.hurtRev = H.revealT > 1; H.inv = 0; st(100); R.hurtRehid = H.hid;
  // nearby discovery: X steps within 1.5 u, Y stays far
  place(X, spot[0] + 1.4, spot[1]); st(1); R.detX = SM.canSee(g, X.team, H); R.detY = SM.canSee(g, Y.team, H); place(X, -spot[0], -spot[1]); st(1); R.detGone = SM.canSee(g, X.team, H);
  // leaving restores at once; half-in does not hide
  place(H, spot[0] + (spot[0] < 0 ? 1.6 : -1.6), spot[1]); st(1); R.outHid = H.hid; place(H, spot[0], spot[1]); st(1); R.backHid = H.hid;
  // partial footprint: stand so the body pokes 0.15 past the pocket edge
  { const i0 = Math.floor(spot[0] + HX), j0 = Math.floor(spot[1] + HZ); let ex = null; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let i = i0, j = j0; while (B[j * AW + i]) { i += di; j += dj; } const bx = di ? (di > 0 ? i - HX : i + 1 - HX) : spot[0], bz = dj ? (dj > 0 ? j - HZ : j + 1 - HZ) : spot[1]; ex = [bx - di * 0.15, bz - dj * 0.15]; break; } place(H, ex[0], ex[1]); st(1); R.edgeHid = H.hid; place(H, spot[0], spot[1]); st(1); }
  // a blind-fired boomerang still hits a hidden fighter (no aim lock; explicit direction)
  H.hp = 3; H.inv = 0; R.preHit = H.hid; place(X, spot[0] + (spot[0] < 0 ? 4 : -4), spot[1]); X.ammo = 1; X.throwCd = 0; const a = Math.atan2(H.x - X.x, H.z - X.z); g.throwFrom(X, a, true, 0.0); const bm = g.booms[g.booms.length - 1]; bm.w = 0; let hit = false; for (let q = 0; q < 90 && !hit; q++) { H.x = spot[0]; H.z = spot[1]; st(1); if (H.hp < 3) hit = true; } R.blindHit = hit; R.hitRev = H.revealT > 0;
  // death clears, team change counts as ally
  H.inv = 0; H.hp = 1; H.lives = 2; H.die(X, 'boom', 1, 0); st(1); R.deadHid = H.hid; R.deadShown = H.model.root.visible;
  // wire: the host's concealment outcome rides in the snapshot tail and decodes per fighter
  H.lives = 5; H.alive = true; H.respawnT = 0; H.hp = 3; H.revealT = 0; H.model.root.scale.setScalar(1); g.hitstop = 0; place(X, -spot[0], -spot[1]); for (let q = 0; q < 30; q++) { place(H, spot[0], spot[1]); st(1); } const W = __bg.wire; const buf = W.encodeFast(g, { seq: 1, tick: 1, acks: {}, fxList: [], wind: null, bid: 0 }); const D = W.decodeFast(buf); W.decodeFastRest(D, 'elim', false); R.wire = D.st ? D.st.map((s) => s[0] & 1) : null; R.wireHost = g.fighters.map((f) => (f.hid ? 1 : 0));
  return R;
});
ok('standing fully inside a 2x2 bush pocket conceals you (host tick)', M.inHid === true, M);
ok('a hidden fighter is invisible to opponents (whole root: model, team ring, YOU ring, marker, shadow), and not not on their minimap / edge arrows / camera', M.canX === false && M.oppShown === false && M.oppMinimap === false, M);
ok('you still see yourself in cover (translucent body 60%, own ring/marker kept)', M.canSelf === true && M.selfShown === true && M.selfGhost === 0.6, M);
ok('hidden self is readable, not a dark blob: outline shells keep their thickness shader and turn soft light (0xeef4ff @ 0.75); body 30-60% opaque', M.mat.ol > 0 && M.mat.olShader && M.mat.body && M.mat.olLight === true, M.mat);
ok('own team ring + YOU ring draw over the foliage while hidden; YOU marker shown', M.mat.ringTop && M.mat.ringA > 0.9 && M.mat.mark, M.mat);
ok('YOU marker stays inside the viewport above the fighter even at the map edge (pocket at the side wall)', M.markScr[0] >= 0.06 && M.markScr[0] <= 0.94 && M.markScr[1] >= 0 && M.markScr[1] < M.bodyScr[1] && Math.abs(M.markScr[0] - M.bodyScr[0]) < 0.12, { mark: M.markScr, body: M.bodyScr });
ok('foliage under the touch-control corners is pressed flat (gameplay bush unchanged), and springs back without touch controls', M.flatMin <= 0.25 && M.flatOff === 1 && M.bushStill, { min: M.flatMin, off: M.flatOff });
ok('aim assist / homing target search never locks onto a concealed rival', Math.abs(M.assistAng - M.assistBase) < 1e-6 && M.nearVis !== 'P0', M);
ok('bots do not acquire hidden targets and drop one that slipped into cover', M.botT !== 'P0' && M.botDrop === false, M);
ok('throwing reveals for 1.5 s, then you are hidden again (still in the bush)', M.thrHid === false && M.revT >= 1.4 && M.thr1s === false && M.thr17 === true, M);
ok('taking a hit reveals for ~1.5 s, then rehides', M.hurtHid === false && M.hurtRev && M.hurtRehid === true, M);
ok('an opponent within 1.8 u discovers you; others still cannot; discovery ends when they leave', M.detX === true && M.detY === false && M.detGone === false, M);
ok('leaving the bush restores visibility at once; stepping back in rehides', M.outHid === false && M.backHid === true, M);
ok('a body poking past the edge is not concealed', M.edgeHid === false, M);
ok('a blind-fired boomerang still damages a hidden fighter (and the hit reveals them)', M.preHit === true && M.blindHit === true && M.hitRev, M);
ok('snapshot tail carries host concealment per fighter (guest renders the host decision)', JSON.stringify(M.wire) === JSON.stringify(M.wireHost) && M.wireHost[0] === 1, { w: M.wire, h: M.wireHost, dead: M.deadHid });
ok('KO clears concealment (dead fighters are never "hidden")', M.deadHid === false, M);
console.log('errors', JSON.stringify(errors.slice(0, 3)));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
