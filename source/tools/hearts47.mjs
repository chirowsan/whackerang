// v4.7: hearts (per hero; generic checks on a neutral 3-heart fighter), invulnerability after a hit, safety net (no fall-through deaths), safe spawns, map size default.
import { launch, sleep } from './lib.mjs';
const URL = 'file:///workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== '' ? ' ' + JSON.stringify(x) : '')); };
// ---- map size default + migration
await page.goto(URL); await sleep(1500);
await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1500);
let r = await page.evaluate(() => ({ size: __bg.S().setup.size, net: __bg.net.defaultSettings().size }));
ok('fresh save: default map size is Large', r.size === 'large', r); ok('online lobby default map size is Large', r.net === 'large', r);
const old = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('whackerang.save.v1')); o.setup.size = 'small'; delete o.setup.sizeMig; delete o.setup.sizeSet; return JSON.stringify(o); });
await page.evaluateOnNewDocument((raw) => { if (!sessionStorage.getItem('t47')) { sessionStorage.setItem('t47', '1'); localStorage.setItem('whackerang.save.v1', raw); } }, old); await page.reload(); await sleep(1500);
r = await page.evaluate(() => ({ size: __bg.S().setup.size, mig: __bg.S().setup.sizeMig, stored: JSON.parse(localStorage.getItem('whackerang.save.v1')).setup.size }));
ok('old save with never-chosen Small -> Large (and saved)', r.size === 'large' && r.mig === 47 && r.stored === 'large', r);
await page.evaluate(() => { const s = __bg.S(); s.setup.size = 'small'; s.setup.sizeSet = true; localStorage.setItem('whackerang.save.v1', JSON.stringify(s)); }); await page.reload(); await sleep(1500);
r = await page.evaluate(() => __bg.S().setup.size); ok('a size the player picked is kept', r === 'small', r);
await page.evaluate(() => { const s = __bg.S(); s.setup.size = 'large'; delete s.setup.sizeSet; s.tutorialDone = true; s.settings.events = 'off'; localStorage.setItem('whackerang.save.v1', JSON.stringify(s)); }); await page.reload(); await sleep(1500);
await page.evaluate(() => { __bg.app.reloadSettings && __bg.app.reloadSettings(); });
r = await page.evaluate(async () => { __bg.UI.show ? 0 : 0; const s = __bg.S(); s.setup.mode = 'classic'; const ui = __bg.UI; ui.show('setup', { mode: 'classic' }); await new Promise((q) => setTimeout(q, 300)); const row = [...document.querySelectorAll('.row')].find((e) => /Map size/.test(e.textContent)); const b = row && [...row.querySelectorAll('button')].find((x) => x.textContent === 'Huge'); b && b.click(); const out = { size: s.setup.size, set: s.setup.sizeSet }; s.setup.size = 'large'; delete s.setup.sizeSet; return out; });
ok('tapping Map size remembers it as the player\'s choice', r.size === 'huge' && r.set === true, r);
// ---- helpers
const start = (o) => page.evaluate(async (o) => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = o.events || 'off'; s.setup.arena = o.arena || 'dojo'; s.setup.size = o.size || 'large'; s.setup.traps = o.traps || 'off'; s.setup.bots = o.bots || 1; s.setup.diff = 1; __bg.app.startMode(o.mode || 'classic'); await new Promise((q) => setTimeout(q, 300)); const g = __bg.app.game; __bg.step(200); g.state = 'play'; const hp = g.fighters.map((f) => [f.hp, f.maxHp, f.abil]); if (!o.keepHero) g.fighters.forEach((f) => { if (!f.boss) { f.abil = null; f.hp = f.maxHp = 3; } }); /* v4.7b: heroes now have their own hp/abilities; generic mechanics run on a neutral 3-heart fighter */ return { n: g.fighters.length, hp, size: __bg.app.match && __bg.app.match.size }; }, o);
await page.evaluate(() => { window.T = { g: () => __bg.app.game, st: (n) => { const g = __bg.app.game; for (let i = 0; i < n; i++) { __bg.step(1); if (g.state !== 'play') g.state = 'play'; } }, park: (b) => { b.stunT = 1e9; b.inv = 1e9; b.isBot = true; b.bot = null; } }; });
// ---- hearts
r = await start({}); { const HP = { bao: 4, nori: 2, tako: 3, kuma: 3, pico: 3, yuki: 3, gus: 5, wisp: 2 }; ok('classic: player and bots start with their hero\'s own hearts', r.hp.every((h) => h[0] === HP[h[2]] && h[1] === HP[h[2]]), r); } ok('classic match uses the Large map by default', r.size === 'large', r.size);
r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0], b = g.fighters[1]; T.park(b); f.inv = 0; f.edgeSaves = 0; const o = {}; f.die(b, 'boom', 1, 0); o.a = [f.alive, f.hp, +f.inv.toFixed(2)]; f.die(b, 'boom', 1, 0); o.b = [f.alive, f.hp]; T.st(30); return o; });
{ let hh; for (let w = 0; w < 10; w++) { await sleep(250); hh = await page.evaluate(() => { const c = document.querySelector('#h-pl .pchip'); const t = c ? c.innerHTML : ''; return { on: (t.match(/class="heart "/g) || []).length, off: (t.match(/class="heart off"/g) || []).length, hp: T.g().fighters[0].hp }; }); if (hh.on === 2) break; } r.on = hh.on; r.off = hh.off; r.hp = hh.hp; }
Object.assign(r, await page.evaluate(() => { const g = T.g(), f = g.fighters[0], b = g.fighters[1]; const o = {}; T.st(120); f.inv = 0; f.die(b, 'boom', 1, 0); o.c = [f.alive, f.hp]; T.st(120); f.inv = 0; f.die(b, 'boom', 1, 0); o.d = [f.alive, f.hp]; return o; }));
ok('1st hit: alive, 2 hearts left, ~1.4 s invulnerable', r.a[0] && r.a[1] === 2 && r.a[2] >= 1.3, r.a); ok('hit during invulnerability is ignored', r.b[0] && r.b[1] === 2, r.b);
ok('HUD shows 2 full + 1 empty heart', r.on === 2 && r.off === 1, [r.on, r.off, r.hp]); ok('2nd hit after inv -> 1 heart', r.c[0] && r.c[1] === 1, r.c); ok('3rd hit -> knocked out', !r.d[0], r.d);
// bots take 3 hits too
r = await start({}); r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0], b = g.fighters[1]; T.park(f); b.inv = 0; const o = []; for (let i = 0; i < 3; i++) { b.inv = 0; b.die(f, 'boom', 1, 0); o.push([b.alive, b.hp]); } return o; });
ok('bot: 3 hits to knock out', r[0][0] && r[1][0] && !r[2][0] && r[1][1] === 1, r);
// respawn restores hearts (KotH = respawns)
r = await start({ mode: 'koth', bots: 1 }); r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0], b = g.fighters[1]; T.park(b); const hp0 = f.hp; for (let i = 0; i < 3; i++) { f.inv = 0; f.die(b, 'boom', 1, 0); } const dead = !f.alive; T.st(600); return { hp0, dead, alive: f.alive, hp: f.hp, safe: g.safeAt(f.x, f.z, false) }; });
ok('respawn (KotH): hearts refilled, on safe floor', r.hp0 === 3 && r.dead && r.alive && r.hp === 3 && r.safe, r);
// ---- falls: hole under the player costs a heart and rescues; never on the last-free path
for (const size of ['small', 'large', 'huge']) {
  r = await start({ size, arena: 'dojo' }); r = await page.evaluate(() => {
    const g = T.g(), f = g.fighters[0], b = g.fighters[1]; T.park(b); g.edgeSaves[f.idx] = 1; // free save already used
    const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); const ci = Math.floor(f.x + hx), cj = Math.floor(f.z + hz); const o = { start: [f.x, f.z] };
    const dig = () => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = (Math.floor(f.z + hz) + dj) * W + Math.floor(f.x + hx) + di; if (!g.sol[k]) g.hole[k] = -1; } };
    f.inv = 0; dig(); T.st(60); o.a = [f.alive, f.hp, g.hole[Math.floor(f.z + hz) * W + Math.floor(f.x + hx)], g.safeAt(f.x, f.z, false), f.rescues];
    T.st(120); f.inv = 0; dig(); T.st(60); o.b = [f.alive, f.hp]; T.st(120); f.inv = 0; dig(); T.st(60); o.c = [f.alive, f.hp, f.deathKind];
    for (let k = 0; k < g.hole.length; k++) if (g.hole[k] < 0) g.hole[k] = 0; return o; });
  ok(`${size}: hole opens under you -> 1 heart lost, put back on safe floor`, r.a[0] && r.a[1] === 2 && r.a[3] && r.a[4] >= 1, r.a);
  ok(`${size}: 2nd fall -> 1 heart, 3rd -> real fall KO`, r.b[0] && r.b[1] === 1 && !r.c[0] && r.c[2] === 'fall', [r.b, r.c]);
}
// invulnerable + hole -> free rescue
r = await start({}); r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0]; T.park(g.fighters[1]); g.edgeSaves[f.idx] = 1; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); f.inv = 0.5; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = (Math.floor(f.z + hz) + dj) * W + Math.floor(f.x + hx) + di; if (!g.sol[k]) g.hole[k] = -1; } f.inv = 0.3; T.st(40); return [f.alive, f.hp, g.safeAt(f.x, f.z, false)]; });
ok('falling while invulnerable is a free rescue', r[0] && r[1] === 3 && r[2], r);
// rim assist: walking with half the body over a hole slides back
r = await start({}); r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0]; T.park(g.fighters[1]); const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); const i = Math.floor(f.x + hx), j = Math.floor(f.z + hz); const k = j * W + i + 1; if (g.sol[k]) return { skip: true }; g.hole[k] = -1; f.x = i + 1 - hx + 0.12; f.z = j - hz + 0.5; f.inv = 0; f.edgeT = 0; T.st(30); const o = { alive: f.alive, hp: f.hp, x: f.x - (i + 1 - hx) }; g.hole[k] = 0; return o; });
ok('rim assist: body barely over a hole is eased back onto the floor', r.skip || (r.alive && r.hp === 3 && r.x < 0), r);
// ---- tunneling + guard
for (const size of ['small', 'large', 'huge']) {
  r = await start({ size, arena: 'dojo' }); r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0]; T.park(g.fighters[1]); const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2), H = Math.round(hz * 2); let bad = 0, n = 0, oob = 0;
    for (let t = 0; t < 40; t++) { const a = t * 0.7; f.alive = true; f.hp = 99; f.inv = 0; f.stunT = 0; f.ex = Math.cos(a) * 90; f.ez = Math.sin(a) * 90; f.vx = Math.cos(a) * 40; f.vz = Math.sin(a) * 40; for (let s = 0; s < 20; s++) { __bg.step(1); g.state = 'play'; n++; const i = Math.floor(f.x + hx), j = Math.floor(f.z + hz); if (Math.abs(f.x) > hx || Math.abs(f.z) > hz) oob++; else if (g.sol[j * W + i]) bad++; } }
    const o = { bad, oob, n, alive: f.alive, kind: f.deathKind, hp: f.hp }; f.alive = true; f.hp = 3; f.inv = 0; f.x = NaN; __bg.step(1); o.nan = Number.isFinite(f.x) && g.safeAt(f.x, f.z, false); f.ex = f.ez = f.vx = f.vz = 0; f.x = 999; __bg.step(1); { const i = Math.floor(f.x + hx), j = Math.floor(f.z + hz); o.far = Math.abs(f.x) <= hx && Math.abs(f.z) <= hz && !g.sol[j * W + i] && g.hole[j * W + i] >= 0; o.farP = [f.x, f.z]; } let sk = -1; for (let k = 0; k < W * H; k++) if (g.sol[k] && !g.layout.t[k] && k % W > 1 && k % W < W - 2) { sk = k; break; } if (sk >= 0) { f.x = (sk % W) - hx + 0.5; f.z = Math.floor(sk / W) - hz + 0.5; __bg.step(2); o.solid = g.safeAt(f.x, f.z, false); } else o.solid = 'none'; o.guardN = g.guardN; return o; });
  ok(`${size}: 800 frames of 90 u/s knockback never ends inside a wall or off the map`, r.bad === 0 && r.oob === 0, r); ok(`${size}: NaN / off-map / inside-solid positions are rescued`, r.nan && r.far && r.solid !== false, r);
}
// ---- spawns: every size x arena x traps wild x several rounds, players + bots on safe floor
const arenas = await page.evaluate(() => __bg.ARENAS.map((a) => a.id));
let spBad = [], spN = 0;
for (const size of ['small', 'large', 'huge']) for (const arena of arenas) for (let rep = 0; rep < 2; rep++) {
  const q = await page.evaluate(async (o) => { const s = __bg.S(); s.setup.arena = o.arena; s.setup.size = o.size; s.setup.traps = 'wild'; s.setup.bots = 3; s.settings.events = 'wild'; __bg.app.startMode('classic'); await new Promise((q) => setTimeout(q, 120)); const g = __bg.app.game; return g.fighters.map((f) => [f.x, f.z, g.safeAt(f.x, f.z, false)]); }, { arena, size });
  spN += q.length; q.forEach((p) => { if (!p[2]) spBad.push([size, arena, p]); });
}
ok(`spawns on safe floor (${spN} fighters, 3 sizes x ${arenas.length} arenas, wild traps)`, spBad.length === 0, spBad.slice(0, 5));
// respawn when the arena is mostly holes
r = await start({ mode: 'koth', size: 'large' }); r = await page.evaluate(() => { const g = T.g(), f = g.fighters[0]; T.park(g.fighters[1]); for (let k = 0; k < g.hole.length; k++) if (!g.sol[k] && k % 7) g.hole[k] = -1; f.inv = 0; f.hp = 1; f.die(null, 'boom', 0, 0); let ok2 = true; for (let i = 0; i < 600; i++) { __bg.step(1); g.state = 'play'; if (f.alive && f.respawnSeen === undefined) { f.respawnSeen = 1; ok2 = g.safeAt(f.x, f.z, false); } } for (let k = 0; k < g.hole.length; k++) if (g.hole[k] < 0) g.hole[k] = 0; return { seen: f.respawnSeen, ok2 }; });
ok('respawn on a mostly-holed arena lands on real floor', r.seen === 1 && r.ok2, r);
ok('no console errors', errors.filter((e) => !/favicon/.test(e)).length === 0, errors.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
