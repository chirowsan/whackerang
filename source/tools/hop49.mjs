// v4.9 regression: fighter jump height (hopY) is initialised, so with Traps Off (and the tutorial) every rendered fighter keeps finite, visible
// matrices through a real simulation; with traps on, jump pads still lift fighters and land them back at 0. usage: node tools/hop49.mjs [html]
import { launch, sleep } from './lib.mjs';
const url = 'file://' + (process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); };
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true }); await page.goto(url); await sleep(2500);
const check = () => page.evaluate(() => { const g = __bg.app.game; let bad = 0, hid = 0, frames = 0, minY = 9, maxY = -9; const fin = (a) => a.every(Number.isFinite);
  for (let q = 0; q < 360; q++) { __bg.step(1); g.fighters.forEach((f) => { f.lives = 9; }); if (q % 30 === 0) __bg.renderNow(); for (const f of g.fighters) { if (!f.alive) continue; const r = f.model.root; r.updateMatrixWorld(true); frames++; if (!fin(r.matrixWorld.elements) || !Number.isFinite(f.hopY)) bad++; if (!r.visible) hid++; minY = Math.min(minY, r.position.y); maxY = Math.max(maxY, r.position.y); } }
  return { trapsOn: g.traps.on, mode: g.mode, n: g.fighters.length, frames, bad, hid, minY: +minY.toFixed(3), maxY: +maxY.toFixed(3), hop0: g.fighters.map((f) => f.hopY) }; });
// 1) Traps Off match (seeded)
const off = await page.evaluate(() => { let s = 31337; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = 'dojo'; S.setup.size = 'small'; S.setup.traps = 'off'; S.setup.bots = 3; S.setup.diff = 1; __bg.app.startMode('classic'); __bg.app.paused = true; __bg.autoplay(1); const g = __bg.app.game; return { on: g.traps.on, hop: g.fighters.map((f) => f.hopY) }; });
ok('Traps Off: fighters start with jump height 0 (initialised, no trap tick needed)', off.on === false && off.hop.every((h) => h === 0), off);
const r1 = await check(); ok('Traps Off: 360 simulated frames, every rendered fighter matrix finite and visible, standing on the floor', r1.frames > 0 && r1.bad === 0 && r1.hid === 0 && r1.minY >= -0.3 && r1.maxY < 1.5, r1);
// 2) tutorial (Traps Off by design)
const tu = await page.evaluate(() => { let s = 4242; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; __bg.app.startTutorial(); __bg.app.paused = true; const g = __bg.app.game; g.state = 'play'; g.introT = 0; return { mode: g.mode, on: g.traps.on, tut: !!(__bg.app.match && __bg.app.match.tutorial) }; });
const r2 = await check(); ok('Tutorial: traps off, fighters stay finite + visible through simulation', tu.tut && tu.on === false && r2.frames > 0 && r2.bad === 0 && r2.hid === 0 && r2.minY >= -0.3, { tu, r2 });
// 3) traps on: a jump pad still launches (hopY > 0 mid-air) and lands back at exactly 0
const j = await page.evaluate(() => { let s = 777; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const app = __bg.app; const players = [0, 1].map((i) => ({ hero: __bg.HEROES[i], hat: 'none', ctrl: i ? 'bot' : 'human', slot: i ? -1 : 0, name: 'P' + i, diff: 1 }));
  app.setGame({ mode: 'vs', arenaId: 'dojo', players, round: 1, rules: { type: 'elim', sudden: false }, size: 'large', traps: 'some', trapSet: [['jump', 'r2']], netSeed: 5 }); app.paused = true; const g = app.game; g.state = 'play'; g.introT = 0;
  const pad = g.traps.list.find((t) => t.type === 'jump'); if (!pad) return { pad: false }; const f = g.fighters[0]; g.fighters[1].bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }); g.input = { read: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) };
  f.x = pad.x; f.z = pad.z; let maxH = 0, air = false, fin = true; for (let q = 0; q < 120; q++) { g.update(1 / 60); if (f.airT > 0) air = true; maxH = Math.max(maxH, f.hopY); f.model.root.updateMatrixWorld(true); if (!f.model.root.matrixWorld.elements.every(Number.isFinite)) fin = false; }
  return { pad: true, air, maxH: +maxH.toFixed(3), end: f.hopY, airT: f.airT, fin }; });
ok('Traps on: jump pad still lifts the fighter (hopY > 0.5 mid-air) and lands at hopY 0, matrices finite', j.pad && j.air && j.maxH > 0.5 && j.end === 0 && j.fin, j);
const errs = errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)); ok('no page errors', !errs.length, errs.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
