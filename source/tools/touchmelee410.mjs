// v4.10 touch melee, DETERMINISTIC: real CDP touches on the throw stick, but the sim is driven by the test with a fixed dt (the page's
// rAF loop is detached from game.update), Math.random is seeded, the rival bot is frozen, and inv/shield/parry/cooldowns are set explicitly.
// Stealth semantics: detect = 1.8 < boom swing reach (~2.06 + 0.25 slack), so a bush rival INSIDE 1.8 is correctly seen and swung at;
// the "hidden" case is a real bush rival at 2.1 (in reach, outside detection) and asserts hid && !canSee at input time.
// usage: node tools/touchmelee410.mjs [url]
import { launch, sleep } from './lib.mjs';
const url = process.argv[2] || 'file:///workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true }); await page.goto(url); await sleep(2500);
const R = []; const ok = async (n, v, i) => { R.push(!!v); let d = ''; if (!v) d = ' DIAG ' + JSON.stringify(await page.evaluate(() => window.__diag())); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '') + d); };
const setup = (bx, bush) => page.evaluate(({ bx, bush }) => {
  let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const S = __bg.S(); S.tutorialDone = true; S.settings.touch = 'on'; S.settings.events = 'off'; S.setup.arena = 'dojo'; S.setup.size = 'small'; S.setup.traps = 'off'; S.setup.bots = 1; S.hero = 'bao'; S.loadout = [{ bao: 'bao_wok' }, {}]; /* v4.11: per-character loadout; Iron Wok reach 1.3 = the old boomerang reach, so the stealth geometry below is unchanged */
  __bg.app.applyTouch(); __bg.app.startMode('classic'); const g = __bg.app.game; const [a, b] = g.fighters; const STEP = 1 / 60;
  const U = g.update.bind(g); g.update = () => {}; // detach the real-time loop; only __step advances the sim
  b.bot = { update: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) };
  window.__cnt = { slash: 0, throw: 0, slashAt: null }; const ss = a.startSlash.bind(a); a.startSlash = (x) => { __cnt.slash++; __cnt.slashAt = window.__snap(); ss(x); };
  const tf = g.throwFrom.bind(g); g.throwFrom = (f, ...r) => { if (f === a) { __cnt.throw++; __cnt.throwAt = window.__snap(); } tf(f, ...r); };
  const L = g.layout; if (L.bush) L.bush.fill(0); g.sol.fill(0);
  if (bush) { if (!L.bush) L.bush = new Uint8Array(L.w * L.h); for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) { const x = i - L.w / 2 + 0.5, z = j - L.h / 2 + 0.5; if (Math.abs(x - bx) <= 1.01 && Math.abs(z) <= 1.01 && L.t[j * L.w + i] === 0) L.bush[j * L.w + i] = 1; } g.bushN = L.bush.reduce((p, q) => p + q, 0); } else g.bushN = 0;
  const st = __bg.stealth; window.__snap = () => { const d = Math.hypot(b.x - a.x, b.z - a.z); return { a: [+a.x.toFixed(2), +a.z.toFixed(2)], b: [+b.x.toFixed(2), +b.z.toFixed(2)], d: +d.toFixed(3), reach: +a.meleeReachTo(b).toFixed(3), detect: st.STEALTH.detect, hid: !!b.hid, seen: b.seen, bushIn: !!b.bushIn, canSee: st.canSee(g, a.team, b), slT: +a.slT.toFixed(3), slCd: +a.slCd.toFixed(3), wind: __bg.weapons.WEAPONS[a.wpn].melee.wind, wpn: a.wpn, ammo: a.ammo, charging: a.charging, hp: b.hp, inv: +b.inv.toFixed(2), shield: b.shield, deflectT: b.deflectT, state: g.state }; };
  window.__trace = []; const IR = g.input.read.bind(g.input); g.input.read = (sl, f) => { const o = IR(sl, f); if (sl === 0 && __trace.length < 12) __trace.push([+performance.now().toFixed(0), o.fire ? 1 : 0, o.tap ? 1 : 0, f.charging ? 1 : 0, +f.throwCd.toFixed(2), f.fireLock ? 1 : 0]); return o; };
  window.__diag = () => ({ now: __snap(), cnt: __cnt, press: window.__press, trace: __trace /* [t, fire, tap, charging, throwCd, fireLock] per tick */ });
  window.__step = (n) => { for (let k = 0; k < n; k++) { if (g.state !== 'play') { U(STEP); continue; } U(STEP); } };
  for (let k = 0; k < 600 && g.state !== 'play'; k++) U(STEP); // countdown, fixed dt
  a.x = 0; a.z = 0; a.vx = a.vz = 0; a.face = 0; b.x = bx; b.z = 0; b.vx = b.vz = 0; b.hp = b.maxHp = 3; b.lives = 9;
  for (const f of [a, b]) { f.inv = 0; f.shield = false; f.deflectT = 0; f.dashT = 0; f.stunT = 0; f.frozenT = 0; f.revealT = 0; f.slCd = 0; f.slT = -1; f.throwCd = 0; f.charging = false; f.chargeT = 0; }
  window.__step(2); __cnt.slash = 0; __cnt.throw = 0; __trace.length = 0; return __snap();
}, { bx, bush });
const step = (n) => page.evaluate((n) => __step(n), n);
const aimC = () => page.evaluate(() => { const b = document.querySelector('#aimbase').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
const ts = page.touchscreen;
// quick-tap classification in input.js is wall-clock (< 340 ms, no drag). Stepping the sim between touchstart/end made the press last
// > 340 ms on a cold page (first scenario: shader warm-up), which is correctly a long press = throw. So: warm the renderer first, send the
// real touchstart/touchend back to back, measure the actual press length from the page's own touch events, and assert it was a quick tap.
// the page must be warm (shader compile on the first scenario delayed touchend by ~320+ ms -> input.js correctly saw a long press = throw)
const smooth = () => page.evaluate(() => new Promise((res) => { let last = performance.now(), good = 0, n = 0; const f = (t) => { const d = t - last; last = t; good = d < 40 ? good + 1 : 0; if (good >= 20 || ++n > 600) res({ good, n }); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
const tap = async () => { await smooth(); const c = await aimC(); await page.evaluate(() => { window.__press = null; const z = document.querySelector('#aimzone'); if (!window.__pl) { window.__pl = true; z.addEventListener('touchstart', () => { window.__ps = performance.now(); }, true); z.addEventListener('touchend', () => { window.__press = performance.now() - window.__ps; }, true); } });
  await ts.touchStart(c.x, c.y); await ts.touchEnd(); await step(45); const ms = await page.evaluate(() => window.__press); if (!(ms < 200)) await ok('precondition: tap was a quick press (< 200 ms, well under the 340 ms tap window)', false, { ms }); return ms; };
const drag = async (dx, dy) => { await smooth(); const c = await aimC(); await ts.touchStart(c.x, c.y); await step(3); for (let i = 1; i <= 5; i++) { await ts.touchMove(c.x + dx * i / 5, c.y + dy * i / 5); await step(3); } await step(10); await ts.touchEnd(); await step(45); };
const cnt = () => page.evaluate(() => ({ slash: __cnt.slash, throw: __cnt.throw, hp: __bg.app.game.fighters[1].hp }));
let s0, c;
s0 = await setup(1.0, false); await tap(); c = await cnt(); await ok('quick tap next to a visible rival = swing (no throw), exactly one heart', c.slash === 1 && c.throw === 0 && c.hp === 2, { ...c, pre: s0 });
s0 = await setup(6, false); await tap(); c = await cnt(); await ok('quick tap with no rival in reach = normal auto-aim throw', c.slash === 0 && c.throw === 1, c);
s0 = await setup(1.0, false); await drag(60, -10); c = await cnt(); await ok('drag + release next to a rival = deliberate throw, never a swing', c.slash === 0 && c.throw === 1, c);
s0 = await setup(2.1, true); await ok('precondition: bush rival at 2.1 is inside swing reach+slack but outside detection, hidden and NOT visible at input time', s0.bushIn && s0.hid && !s0.canSee && s0.d > s0.detect && s0.d <= s0.reach + 0.25, s0);
await tap(); c = await cnt(); await ok('quick tap with a HIDDEN rival in reach does not auto-swing (throws instead)', c.slash === 0 && c.throw === 1, c);
s0 = await setup(1.0, true); await ok('precondition: bush rival at 1.0 is inside detection range, so hidden-but-discovered (visible to the tapper)', s0.bushIn && s0.hid && s0.canSee && s0.d < s0.detect, s0);
await tap(); c = await cnt(); await ok('quick tap next to a DISCOVERED bush rival = swing, one heart', c.slash === 1 && c.throw === 0 && c.hp === 2, c);
s0 = await setup(1.0, false); await tap(); await drag(50, 0); c = await cnt(); await ok('swing does not lock the next deliberate throw', c.slash === 1 && c.throw === 1, c);
await ok('parry / dash / ult buttons still present', await page.evaluate(() => ['#btnDef', '#btnDash', '#btnUlt'].every((q) => { const e = document.querySelector(q); const r = e && e.getBoundingClientRect(); return r && r.width > 20; })));
await ok('throw stick shows the equipped weapon icon', await page.evaluate(() => { const S = __bg.S(); S.hero = 'bao'; S.loadout = [{ bao: 'bao_pin' }, {}]; __bg.app.startMode('classic'); return document.querySelector('#aimknob .boom').dataset.w === 'bao_pin'; }));
const pe = errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)); await ok('no page errors', !pe.length, pe.slice(0, 2));
const f = R.filter((x) => !x).length; console.log(JSON.stringify({ summary: { pass: R.length - f, fail: f } })); await browser.close(); process.exit(f ? 1 : 0);
