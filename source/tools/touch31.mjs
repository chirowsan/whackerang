// Real touch events via CDP on a Samsung-like landscape viewport (915x412 @2x). Checks stick curve/smoothing, tap auto-aim, wide aim cone, dash countdown.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
const cdp = await page.createCDPSession();
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'fast'; s.settings.events = 'off'; s.settings.touch = 'on'; s.setup.arena = 'dojo'; s.setup.size = 'large'; s.setup.traps = 'off'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.reloadSettings(); __bg.app.startMode('classic'); });
await sleep(500);
await page.evaluate(() => { const g = __bg.app.game; const u = g.update.bind(g); g.update = (dt) => { if (window.__man) u(dt); }; window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 400); window.__upd = g.update; window.__man = true; for (let i = 0; i < 260; i++) __bg.step(1); window.__man = false; });
const stepN = (n) => page.evaluate((n) => { window.__man = true; for (let i = 0; i < n; i++) __bg.step(1); window.__man = false; }, n);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const R = {};
// make the world quiet & open
await page.evaluate(() => { const g = __bg.app.game; g.sol.fill(0); g.layout.t.fill(0); g.crateHp.fill(0); const b = g.fighters[1]; b.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }); b.inv = 1e9; const f = g.fighters[0]; f.inv = 1e9; f.x = -6; f.z = 0; b.x = 6; b.z = 0; });
const hud = () => page.evaluate(() => { const t = __bg.Input.touch; const f = __bg.app.game.fighters[0]; return { mx: +t.mx.toFixed(2), tx: +t.tx.toFixed(2), x: +f.x.toFixed(2), z: +f.z.toFixed(2), sp: +Math.hypot(f.vx, f.vz).toFixed(2), state: __bg.app.game.state, alive: f.alive, same: __bg.app.game.update === window.__upd, enabled: t.enabled, pt: +__bg.app.game.playTime.toFixed(1) }; });
console.log('hud0', await hud());
// helpers: wait until a page condition holds (events from CDP arrive asynchronously)
const until = (fn, arg) => page.waitForFunction(fn, { timeout: 8000, polling: 30 }, arg);
const settleTx = async () => { let prev = null, same = 0; for (let i = 0; i < 60 && same < 3; i++) { await sleep(40); const v = await page.evaluate(() => __bg.Input.touch.tx.toFixed(3) + ',' + __bg.Input.touch.tz.toFixed(3)); same = v === prev ? same + 1 : 0; prev = v; } };
const stick = [90, 330]; const rad = await page.evaluate(() => { const b = document.getElementById('joybase').getBoundingClientRect(); return b.width * 0.36; }); R.stickRadiusPx = +rad.toFixed(1);
await touch('touchStart', [stick]); await until(() => document.getElementById('joybase').classList.contains('active')); const curve = [];
for (const frac of [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 1.0]) { await touch('touchMove', [[stick[0] + rad * frac, stick[1]]]); await settleTx(); await stepN(27); const h = await hud(); curve.push([frac, h.tx, h.mx]); }
R.curve_frac_target_smoothed = curve;
await touch('touchEnd', []); await until(() => __bg.Input.touch.tx === 0); await stepN(30);
await touch('touchStart', [stick]); await until(() => document.getElementById('joybase').classList.contains('active')); await touch('touchMove', [[stick[0] + rad, stick[1]]]); await until(() => __bg.Input.touch.tx > 0.99); const ramp = []; for (let i = 0; i < 8; i++) { await stepN(2); ramp.push((await hud()).mx); } R.ramp_mx_every_2frames_33ms = ramp; await touch('touchEnd', []); await until(() => __bg.Input.touch.tx === 0); const rel = []; for (let i = 0; i < 6; i++) { await stepN(2); rel.push((await hud()).mx); } R.release_mx_every_33ms = rel; await stepN(30);
R.afterRelease = await hud();
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v31/touch-play.png' });
// ---- throws: tap auto-aim + angled drags
const heading = () => page.evaluate(() => { const g = __bg.app.game; const b = g.booms[0]; const f = g.fighters[0]; const e = g.fighters[1]; if (!b) return null; const toE = Math.atan2(e.x - f.x, e.z - f.z); return { th: +b.th.toFixed(3), toEnemy: +toE.toFixed(3), diffDeg: +(Math.abs(b.th - toE) * 57.3).toFixed(1) }; });
const reset = async () => { await page.evaluate(() => { const g = __bg.app.game; const f = g.fighters[0]; f.x = -6; f.z = 0; f.vx = f.vz = 0; g.fighters[1].x = 6; g.fighters[1].z = 0; f.ammo = 1; f.alive = true; f.inv = 1e9; f.throwCd = 0; g.booms.forEach((b) => b.kill()); g.booms.length = 0; }); await stepN(3); };
await reset(); const aimPt = [690, 150];
await touch('touchStart', [aimPt]); await until(() => __bg.Input.touch.fire === true); await stepN(5); await touch('touchEnd', []); await until(() => __bg.Input.touch.fire === false); await stepN(3); R.tapThrow = await heading(); await reset();
const drag = async (deg) => { const a = deg * Math.PI / 180; await touch('touchStart', [aimPt]); await until(() => __bg.Input.touch.fire === true); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[aimPt[0] + Math.cos(a) * 9 * i, aimPt[1] + Math.sin(a) * 9 * i * 0.82]]); await sleep(40); } await until(() => Math.hypot(__bg.Input.touch.aimX, __bg.Input.touch.aimZ) > 0.5); await sleep(120); await stepN(6); await touch('touchEnd', []); await until(() => __bg.Input.touch.fire === false); await stepN(3); const h = await heading(); const aimA = await page.evaluate(() => 0); await reset(); return h; };
// screen-right = world +x. Enemy is straight right of the player. Drag directions are measured from that line.
for (const deg of [10, 20, 30, 45]) R['dragOff' + deg + 'deg_assistON'] = await drag(deg);
await page.evaluate(() => { __bg.S().settings.aimAssist = false; });
for (const deg of [20]) R['dragOff' + deg + 'deg_assistOFF'] = await drag(deg);
await page.evaluate(() => { __bg.S().settings.aimAssist = true; });
// ---- dash button + countdown label
const dashBtn = await page.evaluate(() => { const r = document.getElementById('btnDash').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width]; }); R.dashBtnPx = +dashBtn[2].toFixed(0);
const aimBase = await page.evaluate(() => { const r = document.getElementById('aimbase').getBoundingClientRect(); return +r.width.toFixed(0); }); R.aimPadPx = aimBase;
await touch('touchStart', [[dashBtn[0], dashBtn[1]]]); await until(() => __bg.Input.touch.dash === true); await stepN(8); await touch('touchEnd', []); await sleep(220); await page.evaluate(() => __bg.app.game.fighters[0]); await sleep(900);
R.dash = await page.evaluate(() => ({ dashT: __bg.app.game.fighters[0].dashT, cd: +__bg.app.game.fighters[0].dashCd.toFixed(2), label: document.querySelector('#btnDash .cdn').textContent }));
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v31/touch-dash-cooldown.png' });
await stepN(60 * 2.6); await sleep(900); R.dashAfter = await page.evaluate(() => ({ cd: __bg.app.game.fighters[0].dashCd, label: document.querySelector('#btnDash .cdn').textContent }));
console.log(JSON.stringify(R, null, 1)); console.log('errors', errors.filter((e) => !/icon-192|ERR_FILE_NOT_FOUND/.test(e)).slice(0, 6)); await browser.close();
