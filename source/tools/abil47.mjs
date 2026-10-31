// v4.7b: per-hero health + unique abilities (offline sim). Online sync is covered by net_soak47 (hp/maxHp host vs guest).
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== '' ? ' ' + JSON.stringify(x) : '')); };
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(1500);
const HP = { bao: 4, nori: 2, tako: 3, kuma: 3, pico: 3, yuki: 3, gus: 5, wisp: 2 };
const start = (hero, o = {}) => page.evaluate(async (hero, o) => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.setup.arena = 'dojo'; s.setup.size = 'large'; s.setup.traps = 'off'; s.setup.bots = 1; s.setup.diff = 1; s.hero = hero; if (!s.unlocked) s.unlocked = []; if (Array.isArray(s.unlocked) && !s.unlocked.includes(hero)) s.unlocked.push(hero); if (Array.isArray(s.ownedHeroes) && !s.ownedHeroes.includes(hero)) s.ownedHeroes.push(hero);
  __bg.app.startMode(o.mode || 'classic'); await new Promise((q) => setTimeout(q, 300)); const g = __bg.app.game; __bg.step(200); g.state = 'play'; const f = g.fighters[0], b = g.fighters[1]; b.stunT = 1e9; b.isBot = true; b.bot = null; b.inv = 0;
  window.T = { g, f, b, st: (n) => { for (let i = 0; i < n; i++) { __bg.step(1); if (g.state !== 'play') g.state = 'play'; } } }; return { abil: f.abil, hp: f.hp, max: f.maxHp, hud: document.querySelectorAll('#h-pl .hearts')[0] ? document.querySelectorAll('#h-pl .hearts')[0].children.length : -1 }; }, hero, o);
for (const id of Object.keys(HP)) { const r = await start(id); ok(`${id}: starts with ${HP[id]} hearts (own ability set)`, r.abil === id && r.hp === HP[id] && r.max === HP[id], r); }
// Bao regen
await start('bao'); let r = await page.evaluate(() => { const { f, b, st } = T; f.inv = 0; f.die(b, 'boom', 1, 0); const h1 = f.hp; st(Math.round(4 / (1 / 60 * 0.62))); const h2 = f.hp; st(Math.round(5 / (1 / 60 * 0.62))); return [h1, h2, f.hp, f.maxHp]; });
ok('Bao Comfort Food: loses a heart, regains it after 8 s without a hit (capped at max)', r[0] === 3 && r[1] === 3 && r[2] === 4, r);
// Nori dash i-frames
await start('nori'); r = await page.evaluate(() => { const { f, st } = T; f.inv = 0; f.dashCd = 0; f.dashT = 0; f.stunT = 0; const inp = { mx: 1, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: true, deflect: false, ult: false }; const bk = f.bot; f.bot = { update: () => inp }; st(1); f.bot = bk; const nori = f.inv; T.b.bot = { update: () => inp }; T.b.stunT = 0; T.b.inv = 0; T.b.dashCd = 0; st(1); return [nori, T.b.inv]; });
ok('Nori Smoke Dodge: a dash gives ~0.45 s invulnerability (others 0.22)', r[0] > 0.4 && r[1] > 0.15 && r[1] < 0.25, r);
// Bolt shock
await start('tako'); r = await page.evaluate(() => { const { g, f, b } = T; b.inv = 0; b.stunT = 0; b.x = f.x + 1.5; b.z = f.z; g.throwFrom(f, Math.atan2(b.x - f.x, b.z - f.z), true, 1); const bm = g.booms[g.booms.length - 1]; const s = bm.shock; bm.x = b.x; bm.z = b.z; g.boomHitFighters(bm); return [s, b.hp, b.stunT]; });
ok('Bolt Static Throw: a full-charge throw stuns the target it hits', r[0] === true && r[2] >= 0.5, r);
// Salty nine lives
await start('kuma'); r = await page.evaluate(() => { const { f, b } = T; const o = []; for (let i = 0; i < 5; i++) { f.inv = 0; f.die(b, 'boom', 1, 0); o.push([f.alive, f.hp]); } return o; });
ok('Salty Nine Lives: survives the KO once with 1 heart, then the next KO is real', r[1][1] === 1 && r[2][0] && r[2][1] === 1 && !r[3][0], r);
// Pico long tongue
await start('pico'); r = await page.evaluate(() => { const { g, f, st } = T; g.spawnPowerupAt(f.x + 1.6, f.z); const n0 = g.powerups.length; st(2); return [n0, g.powerups.length]; });
ok('Pico Long Tongue: grabs a power-up 1.6 away', r[0] >= 1 && r[1] === r[0] - 1, r);
// Yuki frostbite
await start('yuki'); r = await page.evaluate(() => { const { g, f, b } = T; b.inv = 0; b.stunT = 0; b.x = f.x + 1.5; b.z = f.z; g.throwFrom(f, Math.atan2(b.x - f.x, b.z - f.z), true, 0.3); const bm = g.booms[g.booms.length - 1]; bm.x = b.x; bm.z = b.z; const s0 = b.speed; g.boomHitFighters(bm); b.stunT = 0; b.charging = false; return [b.chillT, b.speed / (s0 || 1)]; });
ok('Yuki Frostbite: a hit chills the target to half speed', r[0] > 1 && Math.abs(r[1] - 0.5) < 0.05, r);
// Gus heavyweight
await start('gus'); r = await page.evaluate(() => { const { f, b } = T; f.inv = 0; f.die(b, 'boom', 1, 0); const k = Math.hypot(f.vx, f.vz); return [k, f.mods.speed]; });
ok('Gus Heavyweight: half knockback, slightly slower walk', Math.abs(r[0] - 4.5) < 0.01 && r[1] < 1, r);
// Wisp hover
await start('wisp'); r = await page.evaluate(() => { const { g, f, st } = T; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2); const k = Math.floor(f.z + hz) * W + Math.floor(f.x + hx); f.inv = 0; g.edgeSaves[f.idx] = 1; /* free once-per-match save already used */ f.x = Math.floor(f.x + hx) - hx + 0.5; f.z = Math.floor(f.z + hz) - hz + 0.5; g.hole[k] = -1; const h0 = f.hp; st(Math.round(0.7 / (1 / 60 * 0.62))); const mid = [f.hp, f.alive, f.edgeT]; st(Math.round(0.6 / (1 / 60 * 0.62))); g.hole[k] = 0; return { h0, mid, end: [f.hp, f.alive] }; });
ok('Wisp Hover: still floating 0.7 s over a hole, then falls (loses a heart, rescued)', r.mid[0] === r.h0 && r.mid[1] && r.end[0] === r.h0 - 1 && r.end[1], r);
// HUD shows own hearts
r = await start('gus'); ok('HUD shows Gus\'s 5 hearts', r.hud === 5 || r.hud >= 5, r);
// select screen
r = await page.evaluate(async () => { __bg.app.toMenu && __bg.app.toMenu(); __bg.UI.show('heroes'); await new Promise((q) => setTimeout(q, 400)); const t = document.body.innerText; return { comfort: /Heavyweight/.test(t) && /5 hearts/.test(t), hearts: /hearts/.test(t) }; });
ok('hero select lists health and ability', r.comfort && r.hearts, r);
const errs = errors.filter((e) => !/favicon/.test(e)); ok('no console errors', errs.length === 0, errs.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
