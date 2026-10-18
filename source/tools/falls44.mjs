// v4.4 falling: ledge grace, one free save per match, wobble, proximity warning, rim/abyss visuals on every arena, Edge help off = old behaviour.
import { launch, sleep } from './lib.mjs';
const arenas = (process.argv[2] || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',');
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; __bg.app.reloadSettings(); });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== '' ? ' ' + JSON.stringify(x) : '')); };
const start = (a, help = true) => page.evaluate(async (a, help) => { const s = __bg.S(); s.settings.edgeHelp = help; s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'off'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); await new Promise((r) => setTimeout(r, 300)); const g = __bg.app.game; __bg.step(200); g.state = 'play'; g.fighters.forEach((f) => { f.lives = 99; }); const b = g.fighters[1]; b.stunT = 1e9; b.isBot = true; b.x = 99; b.inv = 1e9; return { grace: g.edgeGrace, help: g.edgeHelp }; }, a, help);
// helpers inside the page
const H = `window.T = { g: () => __bg.app.game, cell: (i, j) => { const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); return { k: j * W + i, x: i - hx + 0.5, z: j - hz + 0.5, W, H: Math.round(hz * 2) }; }, st: (n) => { const g = __bg.app.game; for (let i = 0; i < n; i++) { __bg.step(1); if (g.state !== 'play') g.state = 'play'; } } };`;
await page.evaluate(H);
for (const a of arenas) {
  const r = await start(a); ok(`${a}: Edge help defaults on (grace 0.25)`, r.help && Math.abs(r.grace - 0.25) < 1e-6, r);
  // find a plain floor cell with free neighbours near the middle
  const t1 = await page.evaluate(() => {
    const g = T.g(), f = g.fighters[0]; const c0 = T.cell(0, 0); const W = c0.W, Hh = c0.H; let pick = null;
    for (let j = 2; j < Hh - 3 && !pick; j++) for (let i = 4; i < W - 4 && !pick; i++) { let okc = true; for (let dj = 0; dj <= 0; dj++) for (let di = -3; di <= 3; di++) { const k = (j + dj) * W + i + di; if (g.sol[k] || g.layout.t[k] !== 0 || g.hole[k] !== 0) okc = false; } if (okc) pick = [i, j]; }
    if (!pick) return { none: true };
    const [i, j] = pick; const c = T.cell(i, j); window.PK = pick;
    // 1) rim + abyss
    const holes = [T.cell(i + 2, j).k, T.cell(i + 3, j).k];
    holes.forEach((k) => { g.hole[k] = -1; }); g.hole[T.cell(i - 3, j).k] = 30; T.st(3);
    const v = g.view; const out = { rim: v.rimCore.count, warn: v.rimWarn.count, shade: v.rimShade.count, abyss: v.root.children.filter((o) => o.position && o.position.y < -0.5 && o.geometry && o.geometry.type === 'PlaneGeometry').length };
    holes.forEach((k) => { g.hole[k] = 0; }); g.hole[T.cell(i - 3, j).k] = 0; T.st(2); out.rimAfter = v.rimCore.count; out.warnAfter = v.rimWarn.count; return out;
  });
  if (t1.none) { ok(`${a}: has a clear 7x1 floor strip`, false); continue; }
  ok(`${a}: glowing rim strips drawn on every ledge`, t1.rim > 0 && t1.shade > 0, t1); ok(`${a}: warning tile has its own flashing rim`, t1.warn > 0, t1.warn); ok(`${a}: abyss layers below the floor (>=5)`, t1.abyss >= 5, t1.abyss); ok(`${a}: rim removed when floor is restored`, t1.rimAfter === 0 && t1.warnAfter === 0, [t1.rimAfter, t1.warnAfter]);
  // 2) proximity + wobble + grace + save + second fall
  const t2 = await page.evaluate(() => {
    const g = T.g(), f = g.fighters[0]; const [i, j] = window.PK; const hc = T.cell(i + 2, j); const o = {};
    g.hole[hc.k] = -1; f.alive = true; f.inv = 0; f.stunT = 0; f.x = hc.x - 0.5 - 0.55; f.z = hc.z; f.vx = f.vz = 0; o.pos0 = [f.x, f.z]; T.st(40); o.near = g.edgeNear; o.boost = g.view.edgeBoost; o.alive0 = f.alive;
    f.x = T.cell(i - 3, j).x; f.z = T.cell(i - 3, j).z; T.st(60); o.far = g.edgeNear; // far from the hole
    // step onto the hole: grace
    f.x = hc.x; f.z = hc.z; f.vx = f.vz = 0; T.st(9); o.aliveGrace = f.alive; o.wob = f.wobK; o.edgeT = f.edgeT; o.savesBefore = Object.keys(g.edgeSaves).length;
    let fr = 9; while (fr < 90 && f.x === hc.x && f.z === hc.z) { T.st(1); fr++; } o.frames = fr; T.st(2); o.saved = f.alive && !!g.edgeSaves[f.idx]; o.moved = Math.hypot(f.x - hc.x, f.z - hc.z); o.inv = f.inv; o.stun = f.stunT; o.onHole = g.hole[idx0(f)] < 0;
    // second fall in same match is real
    T.st(100); f.stunT = 0; f.inv = 0; f.x = hc.x; f.z = hc.z; T.st(9); o.aliveGrace2 = f.alive; T.st(40); o.dead2 = !f.alive; o.kind = f.deathKind;
    return o; function idx0(f) { const c = T.cell(0, 0); return Math.floor(f.z + c.H / 2) * c.W + Math.floor(f.x + c.W / 2); }
  });
  ok(`${a}: edge glow strengthens near a drop, none far away`, t2.near > 0.3 && t2.boost > 0.3 && t2.far < 0.05, [t2.near, t2.far]);
  ok(`${a}: standing on nothing wobbles first and is still alive after ~0.15 s`, t2.aliveGrace && t2.wob > 0.5, [t2.aliveGrace, t2.wob, t2.edgeT]);
  ok(`${a}: first fall is saved: put back on safe floor, stunned, shielded`, t2.saved && t2.frames >= 14 && t2.frames <= 40 && t2.moved > 0.6 && !t2.onHole && t2.inv > 1 && t2.stun > 0.2 && t2.stun <= 0.9, t2);
  ok(`${a}: second fall in the same match is fatal (after grace)`, t2.aliveGrace2 && t2.dead2 && t2.kind === 'fall', [t2.aliveGrace2, t2.dead2, t2.kind]);
}
// recover inside the grace window keeps the one free save
await start('dojo'); const t3 = await page.evaluate(() => { const fc = () => { const g = T.g(); const c0 = T.cell(0, 0); for (let j = 3; j < c0.H - 3; j++) for (let i = 6; i < c0.W - 6; i++) { let ok2 = true; for (let di = -3; di <= 3; di++) { const k = j * c0.W + i + di; if (g.sol[k] || g.layout.t[k] !== 0) ok2 = false; } if (ok2) return [i, j]; } return [8, 5]; }; const g = T.g(), f = g.fighters[0]; const [pi, pj] = fc(); const c = T.cell(pi, pj); g.hole[c.k] = -1; f.alive = true; f.x = c.x; f.z = c.z; f.stunT = 0; f.vx = f.vz = 0; T.st(8); const mid = f.alive; const e1 = f.edgeT; f.x = T.cell(pi + 2, pj).x; T.st(40); return { mid, e1, alive: f.alive, saves: Object.keys(g.edgeSaves).length, edgeT: f.edgeT }; });
ok('stepping off within the grace window cancels the fall and keeps the free save', t3.mid && t3.alive && t3.saves === 0 && t3.edgeT === 0, t3);
// Edge help off = old behaviour (instant, no save)
await start('dojo', false); const t4 = await page.evaluate(() => { const fc = () => { const g = T.g(); const c0 = T.cell(0, 0); for (let j = 3; j < c0.H - 3; j++) for (let i = 6; i < c0.W - 6; i++) { let ok2 = true; for (let di = -3; di <= 3; di++) { const k = j * c0.W + i + di; if (g.sol[k] || g.layout.t[k] !== 0) ok2 = false; } if (ok2) return [i, j]; } return [8, 5]; }; const g = T.g(), f = g.fighters[0]; const [pi, pj] = fc(); const c = T.cell(pi, pj); g.hole[c.k] = -1; f.alive = true; f.x = c.x; f.z = c.z; f.inv = 0; T.st(3); return { dead: !f.alive, grace: g.edgeGrace, near: g.edgeNear }; });
ok('Edge help off: instant fall, no save, no warning', t4.dead && t4.grace === 0 && t4.near === 0, t4);
// the free save is per match (shared across rounds)
await start('dojo'); const t5 = await page.evaluate(() => { const app = __bg.app; const g = app.game; return { same: app.match.edgeSaves === g.edgeSaves }; });
ok('free-save record lives on the match object (survives rounds)', t5.same);
// HUD: warning overlay + settings toggle
await start('ice'); const t6 = await page.evaluate(async () => { const fc = () => { const g = T.g(); const c0 = T.cell(0, 0); for (let j = 3; j < c0.H - 3; j++) for (let i = 6; i < c0.W - 6; i++) { let ok2 = true; for (let di = -3; di <= 3; di++) { const k = j * c0.W + i + di; if (g.sol[k] || g.layout.t[k] !== 0) ok2 = false; } if (ok2) return [i, j]; } return [8, 5]; }; const g = T.g(), f = g.fighters[0]; const [pi, pj] = fc(); const c = T.cell(pi, pj); g.hole[c.k] = 30; f.alive = true; f.x = c.x - 0.8; f.z = c.z; f.vx = f.vz = 0; T.st(40); await new Promise((r) => setTimeout(r, 400)); const e = document.getElementById('edgewarn'); return { has: !!e, on: !!e && e.classList.contains('on'), txt: e && e.textContent, tog: [...document.querySelectorAll('*')].length > 0, def: __bg.S().settings.edgeHelp }; });
ok('screen-edge warning overlay turns on near a drop', t6.has && t6.on, t6); ok('Edge help setting exists, default on', t6.def === true);
ok('no console errors', errors.filter((e) => !/favicon/.test(e)).length === 0, errors.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
