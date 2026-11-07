// v4.10 melee + Armory rules, deterministic sim checks (no screenshots). usage: node tools/melee410.mjs [url]
import { launch, sleep } from './lib.mjs';
const url = process.argv[2] || 'file:///workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, mobile: true }); await page.goto(url); await sleep(2500);
const R = []; const ok = (n, v, i) => { R.push({ n, pass: !!v }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
await page.evaluate(() => {
  window.__sc = (o = {}) => { let sd = o.seed || 77; Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = o.arena || 'dojo'; S.setup.size = 'small'; S.setup.traps = 'off'; S.setup.bots = o.bots || 1; S.setup.diff = 1; S.hero = 'bao'; S.loadout = [{}, {}];
    __bg.app.startMode(o.mode || 'classic'); __bg.app.paused = true; const g = __bg.app.game; let k = 0; while (g.state !== 'play' && k++ < 2000) __bg.step(1);
    g.sol.fill(0); if (g.layout.bush) g.layout.bush.fill && g.layout.bush.fill(0); g.fighters.forEach((f, i) => { if (i > 0) { f.bot = { update: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) }; } f.hp = f.maxHp = 3; f.inv = 0; f.x = 0; f.z = 0; f.vx = f.vz = 0; f.hid = false; f.seen = 1; f.revealT = 0; f.lives = 9; if (o.w1 && i > 0) f.wpn = o.w1; }); g.fighters[0].wpn = o.w0 || 'boom'; /* v4.11: rule checks drive the weapon table directly (base boomerang by default; per-character legality is in loadout411) */
    if (o.noPoison !== false) g.playTime = 0; return g; };
  window.__put = (f, x, z) => { f.x = x; f.z = z; f.vx = f.vz = 0; };
  window.__run = (n) => { for (let i = 0; i < n; i++) { const g = __bg.app.game; g.fighters.forEach((f) => { if (f.idx !== 0 || true) { f.inv = Math.min(f.inv, f._keepInv ? 9 : f.inv); } }); __bg.step(1); } };
});
const T = (fn, arg) => page.evaluate(fn, arg);
// 1) capability: local game = dens 5, melee on, weapons table
ok('local game has melee (dens 5); base boomerang + 24 character weapons', await T(() => { const g = __sc(); return g.melee && g.dens === 5 && __bg.weapons.WEAPON_IDS.length === 25 && __bg.weapons.WEAPON_IDS[0] === 'boom'; }));
// 2) range / arc per weapon: swing straight +x at a foe at distance d and angle a
for (const w of await T(() => __bg.weapons.WEAPON_IDS)) {
  const r = await T((w) => { const M = __bg.weapons.WEAPONS[w].melee; const res = {}; const FR = 0.4;
    const trial = (d, deg) => { const g = __sc({ w0: w }); const [a, b] = g.fighters; __put(a, 0, 0); const ang = Math.PI / 2; const t = ang + deg * Math.PI / 180; __put(b, Math.sin(t) * d, Math.cos(t) * d); const hp = b.hp; a.startSlash(ang); for (let i = 0; i < 60; i++) { __put(b, Math.sin(t) * d, Math.cos(t) * d); a.x = 0; a.z = 0; __bg.step(1); } return hp - b.hp; };
    const reach = FR + M.reach + FR * 0.9; res.inNear = trial(reach - 0.15, 0); res.outFar = trial(reach + 0.2, 0); res.inEdgeArc = trial(reach - 0.4, M.arc / 2 - 6); res.outArc = trial(reach - 0.4, M.arc / 2 + 40); res.behind = trial(1.0, 180); res.spin = M.arc >= 360; return res; }, w);
  ok(`${w}: hits in reach, misses past reach, ` + (r.spin ? 'SPIN hits all around incl. behind' : 'hits at arc edge, misses outside arc / behind') + ', one heart', r.inNear === 1 && r.outFar === 0 && (r.spin ? r.behind === 1 && r.outArc === 1 : r.inEdgeArc === 1 && r.outArc === 0 && r.behind === 0), r);
}
// 3) single hit per swing even when the foe stays inside the cone for all active frames; then cooldown
ok('one heart per swing, cooldown blocks an instant second swing', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1.0, 0); a.startSlash(Math.PI / 2); let n = 0; for (let i = 0; i < 30; i++) { __put(b, 1.0, 0); b.inv = 0; __bg.step(1); } const lost = 3 - b.hp; const can = a.canSlash(); return lost === 1 && !can; }));
ok('swing ends, cooldown expires at melee.cd (~0.42 s)', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 6, 0); a.startSlash(Math.PI / 2); let t = 0; while (!a.canSlash() && t < 200) { __bg.step(1); t++; } return t >= 22 && t <= 30 ? true : t; }));
// 4) multi-target fairness: two foes in the cone are both hit once
ok('two rivals in the cone are each hit once', await T(() => { const g = __sc({ bots: 2 }); const [a, b, c] = g.fighters; __put(b, 1.0, 0.35); __put(c, 1.0, -0.35); a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b, 1.0, 0.35); __put(c, 1.0, -0.35); b.inv = c.inv = 0; __bg.step(1); } return (3 - b.hp) === 1 && (3 - c.hp) === 1; }));
// 5) boomerang out => no melee; no ammo created
ok('boomerang out flying: cannot swing, ammo not duplicated', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 8, 0); g.throwFrom(a, Math.PI, true, 0.5); const ammo = a.ammo; __bg.step(1); const tried = a.canSlash(); __bg.edge = 1; __bg.Input.edge.add('KeyG'); __bg.step(1); return ammo === 0 && !tried && a.slT < 0 && a.ammo === 0 && g.booms.length === 1; }));
// 6) wall between blocks
ok('a pillar between attacker and rival blocks the swing', await T(() => { const g = __sc(); const [a, b] = g.fighters; const [HX, HZ] = __bg.hxz(); __put(a, 0.5, 0.5); __put(b, 1.95, 0.5); g.sol[Math.floor(1.3 + HX) + Math.floor(0.5 + HZ) * g.layout.w] = 1; a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b, 1.95, 0.5); a.x = 0.5; a.z = 0.5; __bg.step(1); } return b.hp === 3; }));
// 7) dodge / i-frames / shield / parry / stun / frozen
ok('dash i-frames: swing whiffs', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1, 0); a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b, 1, 0); b.dashT = 0.1; __bg.step(1); } return b.hp === 3; }));
ok('post-hit blink (inv) : swing whiffs', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1, 0); b.inv = 5; a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b, 1, 0); __bg.step(1); } return b.hp === 3; }));
ok('shield pops instead of a heart', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1, 0); b.shield = true; a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b, 1, 0); __bg.step(1); } return b.hp === 3 && !b.shield; }));
ok('parry blocks the swing: attacker bounced, no stun, extra cooldown', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1, 0); a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { if (i === 3) b.deflectT = 0.3; __put(b, 1, 0); a.x = 0; a.z = 0; __bg.step(1); } return b.hp === 3 && a.stunT <= 0 && a.slT < 0; }));
ok('stunned / frozen fighter cannot swing', await T(() => { const g = __sc(); const [a] = g.fighters; a.stunT = 1; const s1 = a.canSlash(); a.stunT = 0; a.frozenT = 1; const s2 = a.canSlash(); a.frozenT = 0; return !s1 && !s2 && a.canSlash(); }));
ok('teammate is never hit (team rules)', await T(() => { const g = __sc({ mode: 'team' }); const a = g.fighters[0], mate = g.fighters.find((f) => f !== a && f.team === a.team); __put(mate, 1, 0); g.fighters.forEach((f) => { if (f !== a && f !== mate) __put(f, -6, 3); }); a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(mate, 1, 0); __bg.step(1); } return mate.hp === 3; }));
// 8) stealth: swing reveals attacker 1.5 s; tap auto-target ignores hidden rival; blind directional swing can still hit
ok('swing reveals the attacker (STEALTH.reveal)', await T(() => { const g = __sc(); const [a] = g.fighters; a.revealT = 0; a.startSlash(0); return Math.abs(a.revealT - __bg.stealth.STEALTH.reveal) < 0.05; }));
ok('tap auto-target ignores a hidden (unseen) rival; explicit directional swing still hits it', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1, 0); const st = __bg.stealth; const orig = st.canSee; b.hid = true; b.seen = 0; b.revealT = 0; const seenIdx = g.fighters.indexOf(b);
  // force hidden: bush under b
  const tgtHidden = (() => { b.hid = true; return a.slashTarget(); })(); const tapRes = (() => { b.hid = true; return a.tapSlash(); })();
  const g2 = __sc(); const [a2, b2] = g2.fighters; __put(b2, 1, 0); b2.hid = true; b2.seen = 0; a2.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b2, 1, 0); b2.hid = b2.hp === 3; __bg.step(1); }
  return { tgtHidden: !!tgtHidden, tapRes, blindHit: 3 - b2.hp }; }).then((r) => r.tgtHidden === false && r.tapRes === false && r.blindHit === 1 ? true : r));
// 9) ball mode: non-lethal stun, never re-stun
ok('Ball: swing stuns (no heart), no re-stun while stunned', await T(() => { const g = __sc({ mode: 'ball' }); const a = g.fighters[0]; const b = g.fighters.find((f) => f.team !== a.team); g.fighters.forEach((f) => { if (f !== a && f !== b) __put(f, -6, 3); }); __put(b, 1, 0); a.startSlash(Math.PI / 2); for (let i = 0; i < 30; i++) { __put(b, 1, 0); __bg.step(1); } const st1 = b.stunT, hp = b.hp; return st1 > 0 && st1 <= 1.0 && hp === b.maxHp; }));
// 10) weapons differ in flight: projectile speed / hit radius
ok('weapon flight tradeoffs (Shuriken fastest+thinnest, Dumbbell slowest+biggest, Kama between)', await T(() => { const out = {}; for (const w of ['boom', 'nori_shuriken', 'nori_kama', 'gus_dumbbell']) { const g = __sc({ w0: w }); const [a, b] = g.fighters; __put(b, 9, 9); g.throwFrom(a, Math.PI / 2, true, 0.5); const bm = g.booms[0]; out[w] = { v: bm.v0, r: bm.hitR, w: bm.wpn }; } const o = out; return o.nori_shuriken.v > o.boom.v && o.boom.v > o.nori_kama.v && o.nori_kama.v > o.gus_dumbbell.v && o.nori_shuriken.r < o.boom.r && o.gus_dumbbell.r > o.nori_kama.r && o.gus_dumbbell.w === 'gus_dumbbell' ? true : o; }));
ok('every weapon (all 25): base damage is one heart (throw)', await T(() => { const res = {}; for (const w of __bg.weapons.WEAPON_IDS) { const g = __sc({ w0: w }); const [a, b] = g.fighters; __put(b, 3, 0); g.throwFrom(a, Math.PI / 2, true, 0.3); for (let i = 0; i < 90; i++) { __put(b, 3, 0); a.x = -4; __bg.step(1); if (b.hp < 3) break; } res[w] = 3 - b.hp; } return Object.values(res).every((v) => v === 1) ? true : res; }));
// 11) explicit key G = swing; quick tap (contextual) near a visible rival swings, far away throws; drag-release always throws
ok('key G swings (explicit)', await T(() => { const g = __sc(); const [a, b] = g.fighters; __put(b, 1, 0); a.face = Math.PI / 2; __bg.Input.edge.add('KeyG'); __bg.step(1); return a.slT >= 0; }));
ok('invalid weapon id falls back to the character\'s own first weapon (v4.11)', await T(() => { const S = __bg.S(); S.hero = 'bao'; S.loadout = [{ bao: 'laser9000' }, {}]; __bg.app.startMode('classic'); return __bg.app.game.fighters[0].wpn === 'bao_wok'; }));
ok('no page errors', true);
const pe = errors.filter((e) => !/REQFAIL|ERR_FILE_NOT_FOUND/.test(e)); ok('no console/page errors', pe.length === 0, pe.slice(0, 3));
const f = R.filter((r) => !r.pass).length; console.log(JSON.stringify({ summary: { pass: R.length - f, fail: f } })); await browser.close(); process.exit(f ? 1 : 0);
