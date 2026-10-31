// v4.8 soak (poison early: startAt/warn/shrink from env PSTART/PWARN/PSHRINK, default 14/4/18) — based on the v4.7 soak: bots-only matches on every map size x arena x mode with wild traps/events; checks no fighter ever leaves the floor illegally.
// usage: node tools/soak47.mjs [secondsPerCombo=40] [sizes] [modes]
import { launch, sleep } from './lib.mjs';
const SEC = +(process.argv[2] || 40), sizes = (process.argv[3] || 'small,large,huge').split(','), modes = (process.argv[4] || 'classic,crumble,koth,team,bomb').split(',');
const { browser, page, errors } = await launch({ w: 640, h: 360, dpr: 1 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(1500);
await page.evaluate((c) => Object.assign(__bg.POISON, c), { startAt: +(process.env.PSTART || 14), warn: +(process.env.PWARN || 4), shrink: +(process.env.PSHRINK || 18) });
const arenas = await page.evaluate(() => __bg.ARENAS.map((a) => a.id));
let tot = { frames: 0, deaths: 0, falls: 0, badFall: 0, oob: 0, inSolid: 0, nan: 0, rescues: 0, guard: 0, lava: 0, hurts: 0, rounds: 0, sink: 0, poison: 0, pzFrames: 0 }; const bad = [];
for (const size of sizes) for (const mode of modes) for (const arena of arenas) {
  const r = await page.evaluate(async (o) => {
    const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'wild'; s.setup.arena = o.arena; s.setup.size = o.size; s.setup.traps = 'wild'; s.setup.bots = 3; s.setup.diff = 2; s.setup.players = 1; s.setup.rounds = 5;
    const st = { frames: 0, deaths: 0, falls: 0, badFall: 0, oob: 0, inSolid: 0, nan: 0, rescues: 0, guard: 0, lava: 0, hurts: 0, rounds: 0, sink: 0, poison: 0, pzFrames: 0, ex: [] };
    const begin = async () => { __bg.app.startMode(o.mode); await new Promise((q) => setTimeout(q, 60)); const g = __bg.app.game; __bg.autoplay(2); st.rounds++;
      g.fighters.forEach((f) => { if (f._w47) return; f._w47 = 1; const d0 = f.die.bind(f); f.die = (k, kind, a, b) => { const wasAlive = f.alive, hp0 = f.hp; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); const kk = Math.floor(f.z + hz) * W + Math.floor(f.x + hx); const hole = g.hole[kk]; const res = d0(k, kind, a, b); if (wasAlive && !f.alive) { st.deaths++; if (kind === 'fall') { st.falls++; if (!(hole < 0) && !f.boss) { st.badFall++; if (st.ex.length < 4) st.ex.push(['fall-on-floor', o.arena, +f.x.toFixed(2), +f.z.toFixed(2), hole]); } } if (kind === 'lava') st.lava++; if (kind === 'poison') st.poison = (st.poison || 0) + 1; } else if (wasAlive && f.hp < hp0) st.hurts++; return res; }; }); return g; };
    let g = await begin(); const t0 = performance.now(); const resc0 = () => g.fighters.reduce((a, f) => a + (f.rescues || 0), 0);
    let lastResc = 0, lastGuard = 0;
    while (performance.now() - t0 < o.sec * 1000) {
      for (let i = 0; i < 30; i++) { __bg.step(1); st.frames++; if (g.poisonView && (g.poisonView.ph === 'closing' || g.poisonView.ph === 'hold')) st.pzFrames++; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2);
        for (const f of g.fighters) { if (!f.alive) { if (f.deathKind !== 'fall' && f.deathKind !== 'lava' && (f.air < -0.01 || (f.model && f.model.root.position.y < -0.05))) { st.sink++; if (st.ex.length < 4) st.ex.push(['sink', o.arena, f.deathKind, f.air, f.model && f.model.root.position.y]); } continue; } if (!Number.isFinite(f.x) || !Number.isFinite(f.z)) { st.nan++; continue; } if (Math.abs(f.x) > hx + 1e-3 || Math.abs(f.z) > hz + 1e-3) { st.oob++; if (st.ex.length < 4) st.ex.push(['oob', o.arena, f.x, f.z]); continue; } const k = Math.floor(f.z + hz) * W + Math.floor(f.x + hx); if (g.sol[k] && !f.boss && !(f.airT > 0)) { st.inSolid++; } }
        if (g.state === 'over' || g.state === 'roundEnd' || __bg.app.game !== g) break; }
      if (g.state === 'over' || g.state === 'roundEnd' || __bg.app.game !== g) { st.rescues += resc0(); st.guard += g.guardN || 0; g = await begin(); }
      await new Promise((q) => setTimeout(q, 0));
    }
    st.rescues += resc0(); st.guard += g.guardN || 0; __bg.app.toMenu ? __bg.app.toMenu() : 0; const R = __bg.gfx && __bg.gfx.renderer; st.mem = (R ? `geo ${R.info.memory.geometries} tex ${R.info.memory.textures} prog ${R.info.programs ? R.info.programs.length : '?'} ` : '') + `heap ${performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : '?'}MB`; return st;
  }, { size, mode, arena, sec: SEC });
  for (const k of Object.keys(tot)) tot[k] += r[k]; r.ex.forEach((e) => bad.push([size, mode, ...e]));
  console.log(`${size} ${mode} ${arena}: frames ${r.frames} rounds ${r.rounds} deaths ${r.deaths} falls ${r.falls} hurts ${r.hurts} poisonKO ${r.poison} pzFrames ${r.pzFrames} rescues ${r.rescues} guard ${r.guard} | BAD fallOnFloor ${r.badFall} oob ${r.oob} inSolid ${r.inSolid} nan ${r.nan} sink ${r.sink} | ${r.mem}`);
}
const fails = tot.badFall + tot.oob + tot.nan + tot.sink; const solidFrac = tot.inSolid / Math.max(1, tot.frames * 4);
console.log('TOTAL ' + JSON.stringify(tot)); console.log('examples ' + JSON.stringify(bad.slice(0, 10)));
const errs = errors.filter((e) => !/favicon/.test(e)); console.log('errors ' + errs.length + ' ' + JSON.stringify(errs.slice(0, 3)));
const ok = fails === 0 && solidFrac < 1e-4 && errs.length === 0; console.log((ok ? 'PASS' : 'FAIL') + ' soak48 ' + JSON.stringify({ fails, solidFrac }));
await browser.close(); process.exit(ok ? 0 : 1);
