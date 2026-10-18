// v4.3 traps: lethal ones are dormant until a player arms them (switch step / boomerang hit), 0.5 s telegraph, then lethal; non-lethal ones never kill; bots use switches.
import { launch, sleep } from './lib.mjs';
const arenas = (process.argv[2] || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',');
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; __bg.app.reloadSettings(); });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); };
const LETHAL = ['pit', 'saw', 'laser', 'trapdoor', 'fire', 'crusher'], SOFT = ['hammer', 'boulder', 'fence'];
const seenL = new Set(), seenS = new Set();
for (const a of arenas) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'wild'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a);
  await sleep(300);
  const r = await page.evaluate((LETHAL, SOFT) => {
    const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; f.bot = null; f.isBot = false; }); __bg.step(200); const S1 = () => { g.fighters.forEach((q) => { q.lives = 99; }); __bg.step(1); if (g.state !== 'play') g.state = 'play'; };
    const L = g.traps.list.filter((t) => LETHAL.includes(t.type)), N = g.traps.list.filter((t) => SOFT.includes(t.type)); const out = { types: L.map((t) => t.type), soft: N.map((t) => t.type), dormant: true, linked: true, tele: [], kills: [], boom: [], softKill: false, softEffect: [], unarmedHit: false };
    // 1) dormancy: 25 s of sim, lethal traps never leave st 0 and never report a hit
    for (let i = 0; i < 12 * 60; i++) { S1(); for (const t of L) if (t.st !== 0) out.dormant = false; }
    // 2) every lethal trap has a switch that targets it
    out.unl = []; for (const t of L) if (!g.traps.sw.some((s) => s.targets.includes(t))) { out.linked = false; out.unl.push(t.type); }
    const f = g.fighters[0], f2 = g.fighters[1]; f2.x = 99; f2.z = 99;
    const hitSpot = (t) => { for (let dx = -4; dx <= 4; dx += 0.25) for (let dz = -4; dz <= 4; dz += 0.25) { const p = { x: t.x + dx, z: t.z + dz, alive: true, inv: 0, dashT: 0, airT: 0, boss: false, team: -1, vx: 0, vz: 0 }; if (t.hits(p)) return [p.x, p.z]; } return null; };
    const settle = () => { g.traps.sw.forEach((s) => { s.cd = 0; }); for (let i = 0; i < 1800; i++) { S1(); if (L.every((t) => t.st === 0 && t.cd <= 0) && g.traps.sw.every((s) => s.cd <= 0)) break; } };
    for (const t of L) {
      settle(); const sw = g.traps.sw.find((s) => s.targets.includes(t)); if (!sw) continue;
      let frames = 0; for (let att = 0; att < 3 && t.st === 0; att++) { settle(); f.x = sw.x; f.z = sw.z; f.vx = f.vz = 0; f.alive = true; f.respawnT = 0; f.airT = 0; f.show = false; f.inv = 1e9; for (let k = 0; k < 30 && t.st === 0; k++) { f.vx = f.vz = 0; S1(); frames++; } } // retries: the harness parks the fighter off-map (-99), which kills it by 'fall' and leaves ice momentum; re-place it cleanly
      const armed = t.st === 1; const fa = [f.x, f.z, f.alive, f.airT, f.show, f.vx, f.vz, f.frozenT, f.respawnT].join(','); const T0 = g.traps.t; let w = 0; while (t.st === 1 && w < 240) { S1(); w++; } w = +(g.traps.t - T0).toFixed(2); f.x = 0; f.z = 0.01; f.x = -99;
      out.tele.push({ type: t.type, armed, warnS: w, active: t.st === 2, dbg: armed ? undefined : { sw: [sw.x, sw.z, sw.cd, sw.on, sw.rad, sw.r, sw.kind], tcd: t.cd, tst: t.st, f: fa, n: sw.targets.length, owner: !!t.owner } });
      // kill check while active
      const sp = hitSpot(t); if (sp && t.st === 2) { f2.x = sp[0]; f2.z = sp[1]; f2.inv = 0; f2.dashT = 0; f2.airT = 0; f2.alive = true; const gs0 = g.state; const gate = g.fighters.map((q) => [q === f2 ? 'F2' : q === f ? 'F' : 'o', q.alive, q.show, q.boss, q.inv, q.dashT, q.airT].join(',')); const pre = g.traps.list.map((q) => q.hits(f2) || '-').join(' '); g.traps.update(0); out.kills.push({ gate, pre, gs0, gs1: g.state, dk: f2.deathKind, type: t.type, died: !f2.alive, st: t.st, left: t.left, show: f2.show, boss: f2.boss, inv: f2.inv, dash: f2.dashT, air: f2.airT, p: [+f2.x.toFixed(2), +f2.z.toFixed(2)], sp, hit: t.hits(f2) }); f2.alive = true; f2.inv = 1e9; f2.x = 99; }
      else out.kills.push({ type: t.type, died: null, sp: !!sp, st: t.st });
      f.x = 80; settle();
    }
    // 3) boomerang hit on the trap itself arms it
    for (const t of L) { settle(); const sp = hitSpot(t) || [t.x, t.z]; const b = { alive: true, x: sp[0], z: sp[1], owner: f, th: 0 }; g.booms.push(b); g.traps.update(0.001); g.booms.splice(g.booms.indexOf(b), 1); out.boom.push({ type: t.type, armed: t.st === 1, owner: t.owner === f }); }
    settle();
    // 4) non-lethal: hits() never returns a kill; the fighter() effect stuns <= 0.5 s without killing
    for (const t of N) {
      if (t.hits && t.hits({ x: t.hx || t.x, z: t.hz || t.z, alive: true, inv: 0, dashT: 0, airT: 0, vx: 0, vz: 0 })) out.softKill = true;
      f2.alive = true; f2.inv = 0; f2.dashT = 0; f2.airT = 0; f2.stunT = 0; f2.dizzyT = 0; f2.gooT = 0; f2.hamCd = f2.bouCd = f2.fenCd = 0;
      if (t.type === 'hammer') { for (let i = 0; i < 400 && !(Math.abs(t.v) * t.L > 3.4); i++) S1(); f2.x = t.hx; f2.z = t.hz; }
      else if (t.type === 'boulder') { t.st = 2; t.bx = 0; t.bodyOn = true; f2.x = 0; f2.z = t.z; }
      else if (t.type === 'fence') { t.st = 2; t.left = 3; f2.x = t.x + (t.ex ? 0 : 0.2); f2.z = t.z + (t.ez ? 0 : 0.2); }
      g.traps.update(0); g.traps.fighterTick(f2, 0.016); out.softEffect.push({ type: t.type, alive: f2.alive, stun: +f2.stunT.toFixed(2), dizzy: +(f2.dizzyT || 0).toFixed(2) }); f2.inv = 1e9; f2.x = 99; f2.stunT = 0;
      if (t.type === 'boulder' || t.type === 'fence') { t.st = 0; t.bodyOn = false; }
    }
    out.state = g.state; return out;
  }, LETHAL, SOFT);
  r.types.forEach((t) => seenL.add(t)); r.soft.forEach((t) => seenS.add(t));
  ok(`${a}: lethal traps ${JSON.stringify(r.types)} stay dormant for 12 s`, r.dormant);
  ok(`${a}: every lethal trap has a linked switch`, r.linked, JSON.stringify(r.unl));
  for (const t of r.tele) ok(`${a}: ${t.type} switch arms it, ~0.5 s telegraph, then active`, t.armed && t.warnS >= 0.4 && t.warnS <= 0.75 && t.active, JSON.stringify(t));
  for (const k of r.kills) ok(`${a}: ${k.type} kills only when active`, k.died === true || (k.died === null && k.type === 'trapdoor'), JSON.stringify(k));
  for (const b of r.boom) ok(`${a}: boomerang hit arms ${b.type} (owner credited)`, b.armed && b.owner, JSON.stringify(b));
  ok(`${a}: non-lethal traps ${JSON.stringify(r.soft)} never kill on hits()`, !r.softKill);
  for (const e of r.softEffect) ok(`${a}: ${e.type} shoves/stuns (<=0.5s) without killing`, e.alive && e.stun <= 0.5 && (e.stun > 0 || e.dizzy > 0), JSON.stringify(e));
}
ok('lethal set covers pit/saw/laser/crusher/fire/trapdoor somewhere', ['saw', 'laser', 'crusher', 'fire', 'pit', 'trapdoor'].filter((t) => seenL.has(t)).length >= 5, JSON.stringify([...seenL]));
ok('non-lethal set seen: hammer, boulder, fence', ['hammer', 'boulder', 'fence'].every((t) => seenS.has(t)), JSON.stringify([...seenS]));
// bots use switches sensibly
await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'dojo'; s.setup.size = 'large'; s.setup.traps = 'wild'; s.setup.bots = 1; s.setup.diff = 1; __bg.app.startMode('classic'); }); await sleep(300);
let bot = null;
for (let attempt = 0; attempt < 6 && !(bot && bot.armed && bot.owner); attempt++) bot = await page.evaluate((attempt) => {
  const g = __bg.app.game; if (attempt === 0) __bg.step(200); const human = g.fighters.find((f) => !f.bot && !f.isBot) || g.fighters[0], bf = g.fighters.find((f) => f.bot); if (!bf) return { err: 'no bot' };
  g.traps.sw.forEach((s) => { s.cd = 0; }); g.traps.list.forEach((t) => { if (t.lethal) { t.st = 0; t.cd = 0; } });
  const cands = g.traps.list.filter((t) => t.lethal && g.traps.sw.some((s) => s.targets.includes(t))); const t = cands[attempt % cands.length];
  const sw = g.traps.sw.find((s) => s.targets.includes(t)); human.inv = 1e9; bf.inv = 1e9; human.x = t.x; human.z = t.z; human.vx = human.vz = 0; bf.alive = true;
  const offs = [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]; let o = offs.find((q) => Math.hypot(sw.x + q[0] - t.x, sw.z + q[1] - t.z) > 3.5 && g.traps.free(sw.x + q[0], sw.z + q[1], 0.3)) || offs[0]; bf.x = sw.x + o[0]; bf.z = sw.z + o[1];
  const realR = Math.random; Math.random = () => 0.1; let plan = g.traps.botPlan(bf); let armed = false, frames = 0;
  for (let i = 0; i < 6 * 60; i++) { human.x = t.x; human.z = t.z; __bg.step(1); if (g.state !== 'play') g.state = 'play'; frames++; if (t.st > 0) { armed = true; break; } } Math.random = realR;
  return { plan: !!plan, armed, frames, type: t.type, owner: t.owner === bf, attempt };
}, attempt);
ok('bot walks to a switch and arms a lethal trap with a foe standing in it', bot.armed && bot.owner, JSON.stringify(bot));
ok('no console errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
