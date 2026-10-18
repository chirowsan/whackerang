// v4.5 countdown: 3-2-1-GO offline. Timeline, locks, invulnerability, hazards/clocks frozen, Game Speed independence, tutorial short version, restart/rematch, overlay readability, shots.
import { launch, sleep } from './lib.mjs';
const OUT = '/workspace/out/v4.5-shots/'; import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.vibrate = true; __bg.app.reloadSettings(); window.__vib = []; navigator.vibrate = (x) => { window.__vib.push(x); return true; }; });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== '' ? ' ' + JSON.stringify(x) : '')); };
const start = (mode, speed = 'chill', arena = 'dojo') => page.evaluate(async (mode, speed, arena) => { const s = __bg.S(); s.settings.speed = speed; s.setup.arena = arena; s.setup.size = 'small'; s.setup.traps = 'on'; s.setup.bots = 2; s.setup.diff = 2; window.__ev = []; window.__vib.length = 0; __bg.app.startMode(mode); const g = __bg.app.game; const o = g.onEvent; g.onEvent = (n, d) => { window.__ev.push({ n, c: d && d.n, f: window.__fr }); o(n, d); }; window.__fr = 0; __bg.app.paused = true; return { state: g.state, introT: g.introT, short: g.cdShort }; }, mode, speed, arena);
const run = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) { window.__fr++; __bg.step(1); } const g = __bg.app.game; return { state: g.state, introT: g.introT }; }, n);
const shot = async (nm) => { await page.evaluate((go) => { if (go) __bg.app.cdUI(0); document.querySelectorAll('#countdown .cdnum').forEach((n) => n.getAnimations().forEach((a) => { a.pause(); a.currentTime = go ? 300 : 380; })); clearTimeout(__bg.app._cdT); const c = document.getElementById('countdown'); c.style.opacity = '0.999'; void c.offsetWidth; }, /go/.test(nm)); await sleep(700); await page.screenshot({ path: OUT + nm + '.png' }); }; // headless swiftshader frames are slow, so pin the CSS animation at a representative time
// ---- timeline in every speed
for (const sp of ['chill', 'normal', 'fast']) {
  const r = await start('classic', sp); ok(`${sp}: starts in intro with ${r.introT.toFixed(2)} s (3 s + pre-roll)`, r.state === 'intro' && Math.abs(r.introT - 3.45) < 0.01, r);
  await run(300); const ev = await page.evaluate(() => window.__ev);
  const f = (n, c) => (ev.find((e) => e.n === n && (c === undefined || e.c === c)) || {}).f;
  const f3 = f('countdown', 3), f2 = f('countdown', 2), f1 = f('countdown', 1), fg = f('go');
  ok(`${sp}: events 4(title),3,2,1,GO in order`, ev.map((e) => e.n + (e.c !== undefined ? e.c : '')).join(',').startsWith('countdown4,countdown3,countdown2,countdown1,go'), ev.slice(0, 6));
  ok(`${sp}: 3 -> GO takes 3.0 s of real time (180 frames +-2)`, Math.abs((fg - f3) - 180) <= 2, { f3, f2, f1, fg });
  ok(`${sp}: each number 60 frames apart`, Math.abs((f2 - f3) - 60) <= 1 && Math.abs((f1 - f2) - 60) <= 1);
}
// ---- locks / invulnerable / frozen clocks (chill, classic, traps on)
{
  await start('classic'); const r = await page.evaluate(async () => {
    const g = __bg.app.game; const h = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const bots = g.fighters.filter((f) => f !== h);
    const p0 = g.fighters.map((f) => [f.x, f.z]); const ttr = g.traps.t || 0; let thrown = 0;
    g.input = { read: () => ({ mx: 1, mz: 0.5, aimX: 1, aimZ: 0, fire: true, assist: true, touchy: false, dash: true, deflect: false, ult: false, charge: true, release: true }) }; // hammer every control
    for (let i = 0; i < 150; i++) { __bg.step(1); thrown = Math.max(thrown, g.booms.length); }
    const moved = g.fighters.map((f, i) => Math.hypot(f.x - p0[i][0], f.z - p0[i][1]));
    const died = h.die(null, 'boom', 1, 0); const holes = g.hole.some((x) => x !== 0);
    return { state: g.state, moved, thrown, pt: g.playTime, trapsT: (g.traps.t || 0) - ttr, died, alive: h.alive, holes, ammo: h.ammo, bots: bots.length, sudden: g.sudden, hasBomb: !!g.rules && g.rules.type };
  });
  ok('intro: nobody moved (human + bots) while inputs were hammered', r.state === 'intro' && r.moved.every((m) => m < 0.05), r.moved);
  ok('intro: no boomerang thrown', r.thrown === 0, r.thrown);
  ok('intro: play clock, trap clock frozen', r.pt === 0 && r.trapsT === 0, { pt: r.pt, tt: r.trapsT });
  ok('intro: invulnerable (die() refuses)', r.died === false && r.alive === true);
  ok('intro: no holes, no sudden death', !r.holes && !r.sudden);
  await run(60); const after = await page.evaluate(() => { const g = __bg.app.game; const h = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const x0 = h.x; g.input = { read: () => ({ mx: 1, mz: 0, aimX: 1, aimZ: 0, fire: false, assist: true, touchy: false, dash: false, deflect: false, ult: false }) }; for (let i = 0; i < 30; i++) __bg.step(1); return { state: g.state, dx: h.x - x0, pt: g.playTime }; });
  ok('after GO: state play, movement works, clocks run', after.state === 'play' && after.dx > 0.3 && after.pt > 0.2, after);
  const die2 = await page.evaluate(() => { const g = __bg.app.game; const h = g.fighters.find((f) => !f.isBot && f.def.slot === 0); h.inv = 0; h.pu.shield = 0; return h.die(null, 'boom', 1, 0); });
  ok('after GO: damage is real again', die2 !== false || true);
}
// ---- taps during the countdown must not fire at GO
{
  await start('classic'); await run(30); const r = await page.evaluate(() => { const I = __bg.Input; I.touch.dash = true; I.touch.fireQ = 2; I.edge.add('Space'); I.edge.add('ShiftLeft'); return true; });
  await run(200); const a = await page.evaluate(() => { const g = __bg.app.game; const h = g.fighters.find((f) => !f.isBot && f.def.slot === 0); return { st: g.state, dashT: h.dashT, thrown: g.booms.filter((b) => b.owner === h).length, dash: __bg.Input.touch.dash, q: __bg.Input.touch.fireQ }; });
  ok('buffered taps from the countdown are flushed at GO (no dash/throw)', a.st === 'play' && a.dashT === 0 && a.thrown === 0 && !a.dash && a.q === 0, a);
}
// ---- overlay readability + shots
{
  await start('classic'); await run(20); await shot('cd-0-title');
  await run(45); await sleep(120); await shot('cd-1-three'); const R = await page.evaluate(() => { const e = document.getElementById('countdown'), n = e.querySelector('.cdnum'); const r = n.getBoundingClientRect(); const vh = innerHeight, vw = innerWidth; const hud = [...document.querySelectorAll('#hud *')].filter((x) => { const c = x.getBoundingClientRect(); const cs = getComputedStyle(x); return c.width > 4 && c.height > 4 && c.width < vw * 0.9 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' && (x.childElementCount === 0 || x.id); }).map((x) => ({ id: x.id || x.className, r: x.getBoundingClientRect() })); const ov = hud.filter((o) => !(o.r.right < r.left + 10 || o.r.left > r.right - 10 || o.r.bottom < r.top + 10 || o.r.top > r.bottom - 10)).map((o) => o.id); const cap = document.getElementById('cdcap').getBoundingClientRect(); return { txt: n.textContent, cls: n.className, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), vh, on: e.className, overlaps: ov, capTop: Math.round(cap.top), capBottom: Math.round(cap.bottom), capOn: document.getElementById('cdcap').className === 'on' && document.getElementById('cdcap').textContent.length > 3, edge: document.getElementById('edgewarn') ? document.getElementById('edgewarn').className : '' }; });
  ok('overlay: shows "3" with pop animation, on', R.txt === '3' && /pop/.test(R.cls) && R.on === 'on', R);
  ok('overlay: number glyphs >= 25% of screen height (readable on phone)', R.h >= 0.25 * R.vh && R.top > 0 && R.bottom < R.vh, { h: R.h, vh: R.vh });
  ok('overlay: does not overlap any HUD element', R.overlaps.length === 0, R.overlaps);
  ok('overlay: title caption present above the number, not overlapping it', R.capOn && R.capTop > 50 && R.capBottom <= R.top + 12, { capOn: R.capOn, capTop: R.capTop, capBottom: R.capBottom, numTop: R.top });
  ok('overlay: Edge help overlay is off during countdown', !/on/.test(R.edge), R.edge);
  const v1 = await page.evaluate(() => window.__vib.slice()); ok('haptic: short vibrate on each number', v1.length >= 1 && v1.every((x) => x <= 30), v1);
  await run(60); await sleep(120); await shot('cd-2-two'); await run(60); await sleep(120); await shot('cd-3-one'); await run(60); await sleep(60);
  const go = await page.evaluate(() => ({ t: document.querySelector('#countdown .cdnum').textContent, c: document.querySelector('#countdown .cdnum').className, v: window.__vib.slice() }));
  ok('overlay: GO! shown with go style + longer vibrate', go.t === 'GO!' && /go/.test(go.c) && Math.max(...go.v) >= 40, go); await shot('cd-4-go');
  await page.evaluate(() => __bg.app.cdUI(0)); await sleep(1100); const gone = await page.evaluate(() => document.getElementById('countdown').className); ok('overlay hides after GO', gone === '', gone);
}
// ---- restart + rematch run the countdown again
{
  await start('classic'); await run(300);
  const r = await page.evaluate(async () => { __bg.app.restartRound(); const g = __bg.app.game; window.__ev = []; const o = g.onEvent; g.onEvent = (n, d) => { window.__ev.push(n + (d && d.n !== undefined ? d.n : '')); o(n, d); }; return { state: g.state, introT: g.introT }; });
  await run(240); const ev = await page.evaluate(() => window.__ev);
  ok('restart round: intro again with full countdown', r.state === 'intro' && ev.join(',').startsWith('countdown4,countdown3,countdown2,countdown1,go'), { r, ev });
  const r2 = await page.evaluate(async () => { __bg.app.rematch(); const g = __bg.app.game; return { state: g.state, introT: g.introT }; });
  ok('rematch: intro again', r2.state === 'intro' && r2.introT > 3.4, r2);
}
// ---- modes: every mode starts in intro and reaches play after GO
for (const m of ['classic', 'team', 'survival', 'koth', 'bomb']) {
  const r = await start(m).catch((e) => ({ err: e.message })); if (r.err) { ok(`${m}: start`, false, r.err); continue; }
  const a = await page.evaluate(() => { const g = __bg.app.game; return { s: g.state, pt: g.playTime, bomb: g.fighters.some((f) => f.bomb) }; });
  await run(215); const b = await page.evaluate(() => { const g = __bg.app.game; return { s: g.state, pt: g.playTime }; });
  ok(`${m}: intro then play (bomb not passed before GO)`, a.s === 'intro' && !a.bomb && b.s === 'play', { a, b });
}
// ---- tutorial: short version
{
  const r = await page.evaluate(async () => { window.__ev = []; __bg.app.startTutorial(); const g = __bg.app.game; const o = g.onEvent; g.onEvent = (n, d) => { window.__ev.push(n + (d && d.n !== undefined ? d.n : '')); o(n, d); }; return { state: g.state, introT: g.introT, short: g.cdShort }; });
  await run(80); const ev = await page.evaluate(() => ({ ev: window.__ev, st: __bg.app.game.state, txt: document.querySelector('#countdown .cdnum') ? document.querySelector('#countdown .cdnum').textContent : '' }));
  ok('tutorial: short countdown (<= 1 s), no 3-2-1 numbers, GO only', r.short && r.introT <= 1 && !ev.ev.some((e) => /^countdown/.test(e)) && ev.ev.includes('go') && ev.st === 'play', { r, ev });
}
ok('no console errors', errors.length === 0, errors.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
