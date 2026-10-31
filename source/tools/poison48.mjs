// v4.8: shrinking poison - modes, warning, shrink geometry per size, damage tick / inv / Nine Lives, spawns & respawns, bots, HUD, cleanup.
import { launch, sleep } from './lib.mjs';
const URL = 'file:///workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== '' ? ' ' + JSON.stringify(x) : '')); };
await page.goto(URL); await sleep(1500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; localStorage.setItem('whackerang.save.v1', JSON.stringify(s)); });
const start = (o) => page.evaluate(async (o) => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.speed = 'fast'; s.setup.arena = o.arena || 'dojo'; s.setup.size = o.size || 'large'; s.setup.traps = o.traps || 'off'; s.setup.bots = o.bots || 1; s.setup.diff = o.diff || 1;
  if (o.stage) __bg.app.startStage(o.stage); else if (o.tut) __bg.app.startTutorial(); else __bg.app.startMode(o.mode || 'classic'); await new Promise((q) => setTimeout(q, 300)); const g = __bg.app.game; __bg.step(200); g.state = 'play';
  if (!o.keepHero) g.fighters.forEach((f) => { if (!f.boss) { f.abil = null; f.hp = f.maxHp = 3; } });
  return { n: g.fighters.length, poison: !!g.rules.poison, view: !!g.poisonView, type: g.rules.type, cfg: !!g.rules.poisonCfg }; }, o);
await page.evaluate(() => { window.T = { g: () => __bg.app.game, st: (n) => { const g = __bg.app.game; for (let i = 0; i < n; i++) { __bg.step(1); if (g.state !== 'play') g.state = 'play'; } }, park: (b) => { b.stunT = 1e9; b.inv = 1e9; b.isBot = true; b.bot = null; },
  P: () => __bg.app.game.rules.poisonCfg || __bg.POISON,
  near: (g, x, z) => { for (let r = 0; r < 4; r += 0.5) for (let a = 0; a < 6.28; a += 0.5) { const px = Math.round(x + Math.cos(a) * r) + 0.5, pz = Math.round(z + Math.sin(a) * r) + 0.5; if (g.safeAt(px, pz, true)) return [px, pz]; } return null; },
  rimCell: (g) => { const [hx, hz] = __bg.hxz(); for (let i = 0; i < 40; i++) { const x = -hx + 0.5 + (i % 3), z = -2 + Math.floor(i / 3) * 0.5; if (g.safeAt(x, z, true)) return [x, z]; } return [-hx + 0.5, 0]; } }; });
const P0 = await page.evaluate(() => ({ ...__bg.POISON }));
ok('defaults: poison at 2:00, 10 s warning, gentle 2 s tick', P0.startAt === 120 && P0.warn === 10 && P0.tick === 2 && P0.shrink > 30, P0);
// ---- modes
for (const [mode, want] of [['classic', true], ['team', true], ['crumble', true], ['bomb', true], ['koth', true], ['ctf', false], ['ball', false], ['coins', false], ['survival', false], ['bossrush', false]]) {
  const r = await start({ mode, bots: mode === 'team' || mode === 'ctf' || mode === 'ball' ? 3 : 1 }); ok(`${mode}: poison ${want ? 'on' : 'off'}`, r.poison === want && r.view === want && (!want || r.cfg), r);
}
{ const r = await start({ stage: 4 }); ok('boss stage: poison off', !r.poison && !r.view, r); }
{ const r = await start({ tut: true }); ok('tutorial: poison off', !r.poison && !r.view, r); }
{ const r = await page.evaluate(() => { const g = T.g(); g.playTime = 500; T.st(30); return { hud: document.getElementById('h-time') ? document.getElementById('h-time').textContent : '', rect: null }; }); ok('tutorial: no poison HUD even late', !/\u2623/.test(r.hud), r); }
// ---- warning, events, HUD, geometry per size
for (const size of ['small', 'large', 'huge']) {
  await start({ size }); const r = await page.evaluate(() => { const g = T.g(), P = T.P(); const ev = []; const oe = g.onEvent; g.onEvent = (n, d) => { ev.push(n); return oe(n, d); }; T.park(g.fighters[1]); const f = g.fighters[0]; f.inv = 1e9; f.x = 0; f.z = 0;
    const [hx, hz] = __bg.hxz(); const o = { hx, hz };
    g.playTime = P.startAt - P.warn - 0.5; T.st(10); o.pre = { ev: [...ev], vis: g.poisonView.grp.visible };
    g.playTime = P.startAt - P.warn + 0.1; T.st(3); o.warn = { ev: [...ev], vis: g.poisonView.grp.visible, haze: g.poisonView.haze[0].visible, hud: (__bg.UI.hudUpdate(g), document.getElementById('h-time').textContent), ban: (document.querySelector('.banner') || {}).textContent || '' };
    g.playTime = P.startAt + 0.02; T.st(2); o.go = { ev: [...ev], r: g.poisonView && JSON.parse(JSON.stringify(__bg.poisonRect ? null : null)), vis: g.poisonView.grp.visible, haze: g.poisonView.haze[0].visible, hud: (__bg.UI.hudUpdate(g), document.getElementById('h-time').textContent) };
    const rect = (t) => { g.playTime = t; T.st(1); const e = g.poisonView.edge[1].position.x, ez = g.poisonView.edge[3].position.z; return [+e.toFixed(2), +ez.toFixed(2)]; };
    o.r0 = rect(P.startAt + 0.05); o.rh = rect(P.startAt + P.shrink / 2); o.rm = rect(P.startAt + P.shrink + 0.1); o.rl = rect(P.startAt + P.shrink + 60); o.ev = ev; __bg.UI.hudUpdate(g); o.hud = document.getElementById('h-time').textContent;
    return o; });
  const minX = Math.max(2.5, r.hx * 0.2), minZ = Math.max(2, r.hz * 0.2);
  ok(`${size}: nothing before the warning`, !r.pre.vis && !r.pre.ev.includes('poisonWarn'), r.pre);
  ok(`${size}: 10 s warning -> event + pulsing rim (no haze yet) + HUD countdown`, r.warn.ev.includes('poisonWarn') && r.warn.vis && !r.warn.haze && /\u2623 10s/.test(r.warn.hud), r.warn);
  ok(`${size}: at 2:00 poison event, haze on, HUD shows closing`, r.go.ev.includes('poison') && r.go.vis && r.go.haze && /CLOSING/.test(r.go.hud), r.go);
  ok(`${size}: starts at the rim`, Math.abs(r.r0[0] - r.hx) < 0.1 && Math.abs(r.r0[1] - r.hz) < 0.1, [r.r0, r.hx, r.hz]);
  ok(`${size}: halfway through the shrink it is halfway`, Math.abs(r.rh[0] - (r.hx + minX) / 2) < 0.1 && Math.abs(r.rh[1] - (r.hz + minZ) / 2) < 0.1, r.rh);
  ok(`${size}: ends at a small, non-zero safe rectangle and holds it`, Math.abs(r.rm[0] - minX) < 0.05 && Math.abs(r.rm[1] - minZ) < 0.05 && r.rl[0] === r.rm[0] && r.rl[1] === r.rm[1] && r.rm[0] >= 2.5 && r.rm[1] >= 2, [r.rm, r.rl, minX, minZ]);
  ok(`${size}: final-zone event`, r.ev.includes('poisonHold') && /ZONE/.test(r.hud), [r.ev, r.hud]);
}
// ---- damage tick
await start({}); { const r = await page.evaluate(() => { const g = T.g(), P = T.P(), f = g.fighters[0]; T.park(g.fighters[1]); g.rules.sudden = false; const c = T.rimCell(g); const o = { c };
  g.playTime = P.startAt + 15; f.inv = 0; f.x = c[0]; f.z = c[1]; const hold = (n) => { for (let i = 0; i < n; i++) { f.x = c[0]; f.z = c[1]; T.st(1); } };
  hold(60); o.s1 = [f.alive, f.hp]; hold(70); o.s2 = [f.alive, f.hp, +f.inv.toFixed(2)]; hold(126); o.s3 = [f.alive, f.hp]; hold(126); o.s4 = [f.alive, f.hp, f.deathKind]; return o; });
  ok('poison: no damage in the first second', r.s1[0] && r.s1[1] === 3, r.s1); ok('poison: 1 heart after ~2 s (+ brief inv)', r.s2[0] && r.s2[1] === 2 && r.s2[2] > 0, r.s2);
  ok('poison: another heart every ~2 s', r.s3[0] && r.s3[1] === 1, r.s3); ok('poison: last heart -> KO by poison', !r.s4[0] && r.s4[2] === 'poison', r.s4); }
await start({}); { const r = await page.evaluate(() => { const g = T.g(), P = T.P(), f = g.fighters[0]; T.park(g.fighters[1]); g.rules.sudden = false; const c = T.rimCell(g); g.playTime = P.startAt + 15; const o = {};
  f.inv = 1e9; for (let i = 0; i < 400; i++) { f.x = c[0]; f.z = c[1]; T.st(1); } o.inv = [f.alive, f.hp]; f.inv = 0; for (let i = 0; i < 300; i++) { f.x = 0.3; f.z = 0.2; T.st(1); } o.safe = [f.alive, f.hp, f.x, f.z];
  const b = g.fighters[1]; o.bot = null; return o; });
  ok('poison: invulnerability pauses the tick', r.inv[0] && r.inv[1] === 3, r.inv); ok('poison: no damage in the safe middle', r.safe[0] && r.safe[1] === 3, r.safe); }
await start({ keepHero: true }); { const r = await page.evaluate(() => { const g = T.g(), P = T.P(), f = g.fighters[0]; T.park(g.fighters[1]); g.rules.sudden = false; const c = T.rimCell(g); g.playTime = P.startAt + 15; f.abil = 'kuma'; f.nineUsed = false; f.hp = 1; f.inv = 0; const o = {};
  const hold = (n) => { for (let i = 0; i < n; i++) { f.x = c[0]; f.z = c[1]; T.st(1); } }; hold(130); o.a = [f.alive, f.hp, f.nineUsed]; hold(130); o.b = [f.alive, f.deathKind]; return o; });
  ok('Salty Nine Lives saves him from the first poison KO, the next tick KOs', r.a[0] && r.a[1] === 1 && r.a[2] && !r.b[0] && r.b[1] === 'poison', r); }
await start({ keepHero: true }); { const r = await page.evaluate(() => { const g = T.g(), P = T.P(), f = g.fighters[0]; T.park(g.fighters[1]); g.rules.sudden = false; const c = T.rimCell(g); g.playTime = P.startAt + 15; f.abil = null; f.hp = f.maxHp = 5; f.inv = 0; let n = 0, prev = 5, t = 0;
  for (let i = 0; i < 60 * 12 && f.alive; i++) { f.x = c[0]; f.z = c[1]; T.st(1); if (f.hp < prev) { n++; prev = f.hp; } t++; } return { n, t: +(t / 60).toFixed(1), alive: f.alive }; });
  ok('5-heart hero (Gus-size) lasts ~5 ticks (~10 s) in poison', !r.alive && r.t > 8.5 && r.t < 12.5, r); }
// ---- spawns / respawns / rescues
for (const size of ['small', 'large', 'huge']) {
  await start({ mode: 'koth', size, bots: 3 }); const r = await page.evaluate(() => { const g = T.g(), P = T.P(); g.mst.target = 1e9; g.playTime = P.startAt + P.shrink + 1; T.st(2); const [hx, hz] = __bg.hxz(); const f = g.fighters[0]; const o = { bad: 0, n: 0, zone: [g.zone.x, g.zone.z] };
    const sx = Math.max(2.5, hx * 0.2), sz = Math.max(2, hz * 0.2); const inP = (x, z) => Math.abs(x) > sx || Math.abs(z) > sz;
    for (let k = 0; k < 6; k++) { f.inv = 0; f.hp = 1; f.abil = null; f.x = 0; f.z = 0; f.die(null, 'boom', 1, 0); for (let i = 0; i < 400 && !f.alive; i++) { g.playTime = P.startAt + P.shrink + 1; T.st(1); } o.n++; if (!f.alive || inP(f.x, f.z) || !g.safeAt(f.x, f.z, false)) { o.bad++; o.why = [f.alive, inP(f.x, f.z), g.safeAt(f.x, f.z, false), f.x, f.z, f.respawnT]; } o.last = [+f.x.toFixed(2), +f.z.toFixed(2)]; }
    const c = g.safeCell({ x: -hx + 0.5, z: hz - 0.5 }, true); o.rescue = c && !inP(c[0], c[1]); o.zoneIn = !inP(g.zone.x, g.zone.z); return o; });
  ok(`${size}: KotH respawns land inside the safe area`, r.bad === 0 && r.n === 6, r); ok(`${size}: rescue / edge-save spot is inside the safe area`, r.rescue, r); ok(`${size}: KotH hill pulled to the middle`, r.zoneIn && Math.hypot(r.zone[0], r.zone[1]) < 1.5, r.zone);
}
// ---- bots flee to the middle
for (const size of ['small', 'large', 'huge']) {
  await start({ size, bots: 3, diff: 2, keepHero: true }); const r = await page.evaluate(() => { const g = T.g(), P = T.P(); __bg.autoplay && __bg.autoplay(2); g.playTime = P.startAt + P.shrink * 0.6; const [hx, hz] = __bg.hxz();
    g.fighters.forEach((f, i) => { f.hp = f.maxHp = 999; f.nineUsed = true; const a = [[-1, -1], [1, -1], [-1, 1], [1, 1]][i]; const c = T.near(g, a[0] * (hx - 1.5), a[1] * (hz - 1.5)); if (c) { f.x = c[0]; f.z = c[1]; } });
    let inS = 0, tot = 0; const inP = (f) => { const k = Math.min(1, (g.playTime - P.startAt) / P.shrink); const sx = hx + (Math.max(P.minHX, hx * P.minFrac) - hx) * k, sz = hz + (Math.max(P.minHZ, hz * P.minFrac) - hz) * k; return Math.abs(f.x) > sx || Math.abs(f.z) > sz; };
    const start0 = g.fighters.filter((f) => f.alive && inP(f)).length;
    for (let i = 0; i < 60 * 25; i++) { T.st(1); if (i > 60 * 8) for (const f of g.fighters) { if (!f.alive) continue; tot++; if (inP(f)) inS++; } }
    return { st: [g.state, g.rules.type, g.rules.sudden, g.fighters.map((f) => [f.hero && f.hero.id || f.heroId, +(f.spd || 0).toFixed(2), f.stunT | 0, !!f.bot, f.isBot])], start0, frac: +(inS / Math.max(1, tot)).toFixed(3), end: g.fighters.map((f) => [f.alive, +f.x.toFixed(1), +f.z.toFixed(1), inP(f), f.poisonHits || 0]) }; });
  ok(`${size}: bots (and autoplay) leave the poison and stay in the middle`, r.frac < 0.2 && r.end.filter((e) => e[0] && e[3]).length <= 2 && r.end.reduce((a, e) => a + e[4], 0) <= 8, r); // they still dodge boomerangs across the edge now and then
}
// ---- cleanup
{ const r = await page.evaluate(async () => { __bg.app.quitToMenu(); await new Promise((q) => setTimeout(q, 400)); const sc = __bg.gfx ? __bg.gfx.scene : null; let n = 0; if (sc) sc.traverse((o) => { if (o.name === 'poison') n++; }); return { n, sc: !!sc }; }); ok('poison meshes removed after the match', r.n === 0, r); }
ok('no page errors', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`); await browser.close(); process.exit(fail ? 1 : 0);
