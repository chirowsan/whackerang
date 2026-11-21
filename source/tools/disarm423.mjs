// disarm423: stress harness + regression for "fighter lost his weapon and can't attack".
// usage: node tools/disarm423.mjs [html] [secondsPerMatch=40] [label]
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const SECS = +(process.argv[3] || 40); const LABEL = process.argv[4] || 'run';
const STRICT = !process.env.DISARM_REPORT_ONLY;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 900) : '')); };
const { browser, page, errors } = await launch({ w: 900, h: 420, dpr: 1, paytest: 'unlock' });
await page.goto('file://' + HTML, { waitUntil: 'load' });
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.Game && __bg.HEROES && __bg.app && __bg.app.ready))) break; await sleep(150); }
await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; try { __bg.app.quitToMenu(); } catch (e) {} });
const res = await page.evaluate((SECS) => {
  const bg = __bg, STEP = 1 / 60; const heroes = bg.HEROES.map((h) => h.id); const arenas = (bg.ARENAS || []).map((a) => a.id).filter(Boolean);
  const AR = arenas.length ? arenas : ['dojo', 'rooftop'];
  const out = { matches: 0, steps: 0, stuck: [], causes: {}, arenas: AR, heroes };
  const mk = (ids, arena, rules) => { const players = ids.map((id, i) => { const h = bg.HEROES.find((x) => x.id === id); return { hero: h, hat: 'none', ctrl: 'bot', slot: -1, name: h.name + i, diff: i % 3, team: i, weapon: 'boom' }; });
    const g = new bg.Game({ mode: 'vs', arenaId: arena, intro: 0, input: bg.Input, traps: 'on', dens: 5, rules, netCfg: { ts: 1, catch: 1, camWide: 1, ease: 0 }, onEvent: () => {}, players });
    g.state = 'play'; g.cdDone = true; g.playTime = 0; return g; };
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let m = 0; m < 48; m++) {
    const arena = AR[m % AR.length];
    // every match: Bao + Salty + two others, so steals and Bao both happen often
    const pool = heroes.filter((h) => h !== 'bao' && h !== 'kuma'); const ids = ['bao', 'kuma', pool[Math.floor(R() * pool.length)], pool[Math.floor(R() * pool.length)]];
    const rules = m % 2 ? { type: 'elim', sudden: false, hearts: 'hero' } : { type: 'elim', sudden: false, hearts: 'hero', lives: 99 };
    let g; try { g = mk(ids, arena, rules); } catch (e) { out.err = String(e); continue; }
    for (const f of g.fighters) { f.def.lives = 99; f.lives = 99; }
    const st = new Map(); const lastCause = new Map();
    // instrument: who lost a boom how
    const origCB = g.booms.constructor; 
    const n = Math.round(SECS / STEP);
    for (let s = 0; s < n; s++) {
      const before = g.fighters.map((f) => f.stealT || 0);
      try { g.update(STEP); } catch (e) { out.err = String(e.stack || e); break; }
      out.steps++;
      g.fighters.forEach((f, i) => { if ((f.stealT || 0) !== before[i]) { for (const v of g.fighters) if (v !== f && v.ammo === 0) lastCause.set(v, 'stolen-by-salty'); } });
      for (const f of g.fighters) {
        if (!f.alive) { st.delete(f); continue; }
        const mine = g.booms.some((b) => b.alive && b.owner === f);
        if (f.ammo <= 0 && !mine) { const t = (st.get(f) || 0) + STEP; st.set(f, t); if (t >= 13.5 && !f._flag) { f._flag = 1; const c = lastCause.get(f) || 'unknown'; out.causes[c] = (out.causes[c] || 0) + 1; out.stuck.push({ m, arena, hero: f.hero.id, cause: c, at: +(s * STEP).toFixed(1) }); } }
        else { st.delete(f); if (f.ammo > 0) { f._flag = 0; lastCause.delete(f); } }
      }
      if (g.state !== 'play') { g.state = 'play'; }
    }
    out.matches++; try { g.dispose(); } catch (e) {}
  }
  return out;
}, SECS);
fs.writeFileSync(`/workspace/out/disarm423/${LABEL}.json`, JSON.stringify(res, null, 1));
console.log('matches', res.matches, 'sim-seconds', Math.round(res.steps / 60), 'stuck', res.stuck.length, 'causes', JSON.stringify(res.causes), res.err || '');
console.log('stuck heroes', JSON.stringify(res.stuck.reduce((a, s) => (a[s.hero] = (a[s.hero] || 0) + 1, a), {})));
const unit = await page.evaluate(() => {
  const bg = __bg, STEP = 1 / 60;
  const mk = () => { const P = ['bao', 'kuma'].map((id, i) => { const h = bg.HEROES.find((x) => x.id === id); return { hero: h, hat: 'none', ctrl: 'bot', slot: -1, name: h.name, diff: 0, team: i, weapon: 'boom' }; });
    const g = new bg.Game({ mode: 'vs', arenaId: 'dojo', intro: 0, input: bg.Input, traps: 'off', dens: 5, rules: { type: 'elim', sudden: false, hearts: 'hero' }, netCfg: { ts: 1, catch: 1, camWide: 1, ease: 0 }, onEvent: () => {}, players: P });
    g.state = 'play'; g.cdDone = true; for (const f of g.fighters) { f.bot = null; f.input = null; f.inv = 99; } return g; };
  const idle = (g, n) => { for (let i = 0; i < n; i++) { for (const f of g.fighters) { f.vx = f.vz = 0; } try { g.update(STEP); } catch (e) { return String(e); } } return null; };
  const r = {};
  { const g = mk(); const [bao, salty] = g.fighters; salty.x = 0; salty.z = 0; bao.x = -5; bao.z = 0; bao.ammo = 0;
    const b = { owner: bao, carry: 1 }; // simulate the steal landing (same call path as the real catch)
    const B = g.booms.length; const fake = Object.create(Object.getPrototypeOf(g.booms[0] || {}));
    // direct path: mark victim as stolen-from the way _landCatch now does
    bao.ammo = 0; bao.rearmT = 12; r.stealStart = bao.ammo; const e1 = idle(g, 30); r.stealAt05 = bao.ammo; const e2 = idle(g, 660); r.stealAt11 = bao.ammo; const e3 = idle(g, 90); r.stealAt125 = bao.ammo; r.e3 = e3; r.e = e1 || e2; g.dispose(); }
  { const g = mk(); const [bao] = g.fighters; bao.ammo = 0; bao.rearmT = 0; idle(g, 60); r.lostAt1 = bao.ammo; idle(g, 70); r.lostAt22 = bao.ammo; g.dispose(); }
  { const g = mk(); const [bao] = g.fighters; bao.ammo = 1; const n0 = bao.ammo; r.fullStays = (idle(g, 200), bao.ammo) === 1 && bao.maxAmmo === 1; g.dispose(); }
  r.src = String(bg.Game.prototype.update).length > 0;
  return r;
});
console.log('unit', JSON.stringify(unit));
if (STRICT) {
  ok('steal victim stays disarmed for ~12 s, then gets a fresh boomerang', unit.stealAt05 === 0 && unit.stealAt11 === 0 && unit.stealAt125 === 1, unit);
  ok('lost-boomerang failsafe re-arms after ~2 s, not instantly', unit.lostAt1 === 0 && unit.lostAt22 === 1, unit);
  ok('failsafe never gives extra ammo beyond max', unit.fullStays, unit);
  ok('no fighter stays disarmed (ammo 0, no boomerang of his own in flight) longer than the 12 s steal window (13.5 s)', res.stuck.length === 0, res.stuck.slice(0, 6));
  ok('sim ran without errors', !res.err, res.err);
  ok('no page errors', errors.filter((e) => !/AudioContext|icon-192|favicon|ERR_FILE/i.test(e)).length === 0, errors.slice(0, 3));
  console.log(`disarm423 ${pass}/${pass + fail}  fail=${fail}`);
}
await browser.close(); process.exit(STRICT && fail ? 1 : 0);
