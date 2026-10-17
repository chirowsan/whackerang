// Measured speed bench. Usage: node tools/bench31.mjs <html path> <label> [speed]
// All numbers are per REAL second (game stepped at 60Hz fixed steps, like the live loop).
import { launch, sleep } from './lib.mjs';
const [file, label, speed] = [process.argv[2], process.argv[3], process.argv[4]];
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file://' + file); await sleep(2500);
const res = await page.evaluate((speed) => {
  const bg = __bg, app = bg.app, S = bg.S(); const out = {};
  S.tutorialDone = true; S.settings.quality = 'fast'; S.settings.events = 'off'; S.settings.aimAssist = false; S.settings.shake = false; if (speed) S.settings.speed = speed;
  const NO = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false });
  const setup = (arena, size, traps, bots = 1) => {
    S.setup.arena = arena; S.setup.size = size; S.setup.traps = traps; S.setup.bots = bots; S.setup.diff = 1; S.setup.rounds = 5; S.setup.mutator = 'off'; app.startMode('classic');
    const g = app.game; for (let i = 0; i < 400 && g.state !== 'play'; i++) g.update(1 / 60); return g;
  };
  const park = (g) => { g.fighters.forEach((f, i) => { if (i) { f.bot.update = NO; f.x = i % 2 ? 14 : -14; f.z = i < 2 ? -8 : 8; f.inv = 1e9; f.vx = f.vz = 0; } }); };
  const clearRow = (g) => { for (let j = 0; j < g.layout.t.length / g.layout.t.length; j++); const H = Math.round(g.layout.t.length / (g.layout.w || 1)); return 0; };
  const findRow = (g, c0, c1) => { const AWc = g.layout.t.length / (g.layout.t.length > 400 ? (g.layout.t.length === 640 ? 20 : g.layout.t.length === 416 ? 16 : 12) : 12); const AHc = g.layout.t.length / AWc; for (let jj = 0; jj < AHc; jj++) { const j = Math.round(AHc / 2 + (jj % 2 ? 1 : -1) * Math.ceil(jj / 2)); if (j < 1 || j >= AHc - 1) continue; let ok = true; for (let i = c0; i < c1; i++) if (g.sol[j * AWc + i] || g.layout.t[j * AWc + i] !== 0) { ok = false; break; } if (ok) return [j, AHc]; } return null; };
  const setupRow = (arena, size, traps) => { for (let k = 0; k < 30; k++) { const g = setup(arena, size, traps); park(g); const r = findRow(g, 1, 24); if (r) return [g, r[0] - r[1] / 2 + 0.5]; } throw new Error('no clear row'); };
  // ---- 1. player walk speed (huge open arena, no traps)
  { const [g, zz] = setupRow('dojo', 'huge', 'off'); const f = g.fighters[0];
    const row = 1;
    out.rowFound = row; g.__row = row; f.x = -13; f.z = zz; f.vx = f.vz = 0; let inp = { ...NO(), mx: 1 }; g.input = { read: () => inp };
    const log = []; let px = f.x; for (let i = 0; i < 150; i++) { g.update(1 / 60); log.push([f.x, (f.x - px) * 60]); px = f.x; }
    out.walkPeak = +Math.max(...log.map((l) => l[1])).toFixed(2); out.walkMeasured = +((log[149][0] - log[89][0]) / 1.0).toFixed(2); // units over the last real second
    const t90 = log.findIndex((l) => l[1] >= 0.9 * out.walkPeak); out.walkT90 = +(t90 / 60).toFixed(3);
    // ---- 2. dash
    f.vx = f.vz = 0; f.x = -13; f.dashCd = 0; f.dashT = 0; f.inv = 0; inp = { ...NO(), mx: 1, dash: true }; let x0 = f.x, steps = 0, pk = 0, dashing = false;
    g.update(1 / 60); inp = { ...NO(), mx: 1 }; for (let i = 0; i < 90; i++) { if (f.dashT > 0) { dashing = true; steps++; pk = Math.max(pk, (f.x - (f.__px || f.x)) * 60); } else if (dashing) break; f.__px = f.x; g.update(1 / 60); }
    out.dashDist = +(f.x - x0).toFixed(2); out.dashSecs = +(steps / 60).toFixed(3); out.dashPeak = +pk.toFixed(2);
    f.dashCd = 0; f.dashT = 0; inp = { ...NO(), mx: 1, dash: true }; g.update(1 / 60); inp = NO(); let c = 0; while (f.dashCd > 0 && c < 600) { g.update(1 / 60); c++; } out.dashCooldownSecs = +(c / 60).toFixed(2);
    // ---- 3. boomerang flights (thrower stands still, aim right along clear row)
    g.sol.fill(0); g.layout.t.fill(0); g.crateHp.fill(0); f.z = 0;
    const fl = (ch) => { f.x = -13; f.z = 0; f.vx = f.vz = 0; f.dashCd = 0; f.ammo = 1; g.booms.forEach((b) => b.kill()); g.booms.length = 0; inp = NO(); g.update(1 / 60); g.throwFrom(f, Math.PI / 2, true, ch); const b = g.booms[0]; const sp = []; let t = 0, outT = 0, maxD = 0, prev = [b.x, b.z], caught = -1;
      for (let i = 0; i < 60 * 14; i++) { g.update(1 / 60); t++; if (b.alive) { sp.push(Math.hypot(b.x - prev[0], b.z - prev[1]) * 60); prev = [b.x, b.z]; maxD = Math.max(maxD, Math.hypot(b.x - f.x, b.z - f.z)); if (b.phase === 'ret' && !outT) outT = t; } else { caught = t; break; } }
      const mx = Math.max(...sp), outS = sp.slice(0, outT || sp.length), retS = sp.slice(outT || 0); const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
      return { peak: +mx.toFixed(1), avgOut: +avg(outS).toFixed(1), avgRet: +avg(retS).toFixed(1), peakRet: +Math.max(...retS).toFixed(1), outSecs: +(outT / 60).toFixed(2), totalSecs: +(caught / 60).toFixed(2), maxDist: +maxD.toFixed(1), x: b.x }; };
    out.boomTap = fl(0); out.boomFull = fl(1); delete out.boomTap.x; delete out.boomFull.x;
    out.catchRadius = +(0.62 * f.mods.catchR * (g.cfg ? g.cfg.catch : 1)).toFixed(2);
    f.z = 0; g.booms.length = 0;
    // ---- 6. screen speed on a large map: scale px/unit near the player and fighter px/s
  }
  // ---- 4. bot movement speed (AI running vs a parked human)
  { const tr = []; for (let trial = 0; trial < 12; trial++) { const g = setup('dojo', 'large', 'off', 1); const h = g.fighters[0]; h.inv = 1e9; g.input = { read: NO }; const b = g.fighters[1]; b.bot = new bg.Bot(g, b, 1, 'duelist'); if (!trial) { out.botReact = +b.bot.d.react.toFixed(3); out.botThrowCd = +b.bot.d.cd.toFixed(2); out.botErr = +b.bot.d.err.toFixed(3); out.botDodge = b.bot.d.dodge; }
      const sp = []; let thr = 0, prev = [b.x, b.z], am = b.ammo, steps = 0; for (let i = 0; i < 60 * 40 && g.state === 'play'; i++) { g.update(1 / 60); steps++; h.alive = true; const s = Math.hypot(b.x - prev[0], b.z - prev[1]) * 60; prev = [b.x, b.z]; if (b.dashT <= 0) sp.push(s); if (b.ammo < am) thr++; am = b.ammo; }
      sp.sort((x, y) => x - y); const mv = sp.filter((x) => x > 0.5); tr.push({ mean: mv.reduce((x, y) => x + y, 0) / mv.length, p90: sp[Math.floor(sp.length * 0.97)], thr: thr / (steps / 3600), secs: steps / 60 }); }
    const av = (k) => +(tr.reduce((x, y) => x + y[k], 0) / tr.length).toFixed(2); out.botMovingAvgSpeed = av('mean'); out.botTopSpeed97pct = av('p90'); out.botThrowsPerMin = av('thr'); out.botSecsSampled = av('secs'); }
  // ---- 5. traps / pace (dojo spike pits)
  { const g = setup('dojo', 'small', 'off', 1); g.fighters.forEach((f) => { f.inv = 1e9; f.alive = true; }); g.fighters[0].bot = null; g.input = { read: NO }; g.fighters[1].bot.update = NO;
    const sp = g.view.spikes[0]; const k = sp.j * 20 + sp.i; let warnOn = -1, warnLen = 0, upOn = -1; const starts = []; let wasW = 0, wasU = 0; const T0 = 0;
    for (let i = 0; i < 60 * 40; i++) { g.update(1 / 60); const w = g.spkWarn[k], u = g.spk[k] > 0.6 ? 1 : 0; if (w && !wasW) starts.push(i); if (w) warnLen++; wasW = w; }
    out.spikePeriodSecs = starts.length > 1 ? +((starts[starts.length - 1] - starts[0]) / (starts.length - 1) / 60).toFixed(2) : null; out.spikeWarnSecs = starts.length ? +(warnLen / starts.length / 60).toFixed(2) : null; }
  { const g = setup('dojo', 'small', 'off', 1); g.fighters.forEach((f) => { f.inv = 1e9; }); g.input = { read: NO }; g.fighters[1].bot.update = NO; let t = 0; while (!g.sudden && t < 60 * 200) { g.update(1 / 60); t++; } out.suddenDeathAtSecs = +(t / 60).toFixed(1); }
  // ---- screen speed: camera on huge map, player running right
  { const [g, zz] = setupRow('dojo', 'huge', 'off'); const f = g.fighters[0]; f.x = -13; f.z = zz; let inp = { ...NO(), mx: 1 }; g.input = { read: () => inp }; for (let i = 0; i < 60 * 3; i++) { g.update(1 / 60); if (bg.gfx.follow) app.camFollow(1 / 60); } bg.camNow();
    const pr = (x, z) => { const v = new bg.THREE.Vector3(x, 0.5, z).project(bg.gfx.camera); return [(v.x + 1) / 2 * 915, (1 - v.y) / 2 * 412]; };
    const a0 = pr(f.x, f.z), w0 = pr(f.x, f.z + 1); const pxu = Math.hypot(w0[0] - a0[0], w0[1] - a0[1]); // px per world unit (depth direction)
    const aX = pr(f.x + 1, f.z); const pxX = Math.hypot(aX[0] - a0[0], aX[1] - a0[1]);
    const ref0 = pr(0, 0); const f0 = [f.x, f.z]; let camDist0 = bg.gfx.camDist; for (let i = 0; i < 60; i++) { g.update(1 / 60); app.camFollow(1 / 60); } bg.camNow(); const ref1 = pr(0, 0); const f1 = pr(f.x, f.z);
    out.pxPerUnit = +pxX.toFixed(1); out.camDist = +bg.gfx.camDist.toFixed(2); out.worldScrollPxPerSec = +Math.hypot(ref1[0] - ref0[0], ref1[1] - ref0[1]).toFixed(0); out.fighterScreenPxPerSecRelWorld = +(Math.hypot(f.x - f0[0], f.z - f0[1]) * pxX).toFixed(0); }
  out.catchRadius = out.catchRadius; out.speedSetting = S.settings.speed || '(none in v3.0)'; out.build = app.BUILD;
  return out;
}, speed);
console.log(label, JSON.stringify(res, null, 1)); console.log('errors', errors.slice(0, 5)); await browser.close();
