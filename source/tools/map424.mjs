// map424: Lotus Pond — calm map, shallow water slows you, stay on the pads. Local only.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/fm424';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };

async function boot(w, h) {
  const { browser, page, errors } = await launch({ w, h, dpr: 2, mobile: true, paytest: 'unlock' });
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
  await page.goto((HTML.startsWith('file:') || HTML.startsWith('http') ? HTML : 'file://' + HTML), { waitUntil: 'load' });
  for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.ARENAS))) break; await sleep(100); }
  return { browser, page, errors };
}

const { browser, page, errors } = await boot(915, 412);
const meta = await page.evaluate(() => {
  const A = __bg.ARENAS.find((a) => a.id === 'pond');
  const S = __bg.S();
  return {
    n: __bg.ARENAS.length, ids: __bg.ARENAS.map((a) => a.id),
    name: A && A.name, blurb: A && A.blurb, hazard: A && A.hazard,
    free: __bg.isArenaFree ? __bg.isArenaFree('pond') : true,
    speed: S.settings.speed, battery: S.settings.battery, diff: S.setup.diff,
  };
});
ok('Lotus Pond is in the arena list', meta.ids.includes('pond') && meta.name === 'Lotus Pond', meta);
ok('blurb tells kids the one idea: water slows you', !!(meta.blurb && /water/i.test(meta.blurb) && /slow/i.test(meta.blurb)), meta.blurb);
ok('pond is a free map', meta.free === true, meta);
ok('defaults stay Chill, Battery saver Auto, Easy bots', meta.speed === 'chill' && meta.battery === 'auto' && (meta.diff === 0 || meta.diff === 'easy' || meta.diff === undefined), meta);

await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; __bg.UI.show('setup'); });
await sleep(250);
const setup = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.arena-opt button, [data-arena]')].map((b) => ({ id: b.getAttribute('data-arena'), t: (b.innerText || '').replace(/\s+/g, ' ') }));
  const pond = btns.find((b) => b.id === 'pond');
  return { n: btns.length, pond, ids: btns.map((b) => b.id) };
});
ok('setup screen lists Lotus Pond', !!(setup.pond && /Lotus|Pond/i.test(setup.pond.t || 'Lotus Pond')), setup);

// layout + water slow, official dens 5
await page.evaluate(() => {
  const S = __bg.S(); S.hero = 'puff'; S.tutorialDone = true; S.setup.mode = 'classic'; S.setup.arena = 'pond'; S.setup.size = 'large'; S.setup.bots = 1; S.setup.diff = 0; S.setup.traps = 'off'; S.settings.events = 'off';
  __bg.app.startMode('classic');
});
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(__bg.app.game && __bg.app.game.state === 'play' && __bg.app.game.fighters && __bg.app.game.fighters.length))) break; await sleep(100); }

const layout = await page.evaluate(() => {
  const g = __bg.app.game; const T = { WATER: 6, LAVA: 4, SPIKE: 3, CONV: 5, PILLAR: 1, CRATE: 2 };
  const t = g.layout.t; const counts = { water: 0, lava: 0, spike: 0, conv: 0, floor: 0, solid: 0 };
  const spawnsBusy = [];
  for (let k = 0; k < t.length; k++) {
    if (t[k] === T.WATER) counts.water++;
    else if (t[k] === T.LAVA) counts.lava++;
    else if (t[k] === T.SPIKE) counts.spike++;
    else if (t[k] === T.CONV) counts.conv++;
    else if (t[k] === T.PILLAR || t[k] === T.CRATE) counts.solid++;
    else counts.floor++;
  }
  // find a water cell and a dry floor cell not solid
  let wet = null, dry = null;
  const AW = t.length > 300 ? 28 : 20; // fallback; use helpers
  const hz = __bg.hxz ? __bg.hxz() : [10, 6];
  const HX = hz[0], HZ = hz[1];
  const ci = (x) => Math.floor(x + HX), cj = (z) => Math.floor(z + HZ);
  // walk cells via cx/cz from fighters' game
  for (let k = 0; k < t.length; k++) {
    const i = k % g.layout.w, j = (k / g.layout.w) | 0;
    const x = (i + 0.5) - g.layout.w / 2, z = (j + 0.5) - g.layout.h / 2;
    if (t[k] === T.WATER && !wet) wet = { x, z, k };
    if (t[k] === 0 && !g.sol[k] && !dry) dry = { x, z, k };
  }
  return { id: g.arenaId, w: g.layout.w, h: g.layout.h, dens: g.dens, counts, wet, dry, theme: !!(g.view && g.view.th) };
});
ok('match is on Lotus Pond', layout.id === 'pond', layout);
ok('calm layout has shallow water and no lava/spikes/conveyors', layout.counts.water >= 8 && layout.counts.lava === 0 && layout.counts.spike === 0 && layout.counts.conv === 0, layout.counts);
ok('pond still has dry paths and some cover', layout.counts.floor >= 20 && layout.dry && layout.wet, layout);

const slow = await page.evaluate((layout) => {
  const g = __bg.app.game; const me = g.fighters[0];
  for (const f of g.fighters) { f.inv = 99; f.vx = 0; f.vz = 0; if (f !== me && f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }); }
  const wasBot = me.isBot; const oldBot = me.bot;
  me.isBot = true; me.stunT = 0; me.frozenT = 0; me.chillT = 0; me.inv = 99;
  me.bot = { update: () => me._inp || { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false } };
  const measure = (spot) => {
    me.x = spot.x; me.z = spot.z; me.vx = 0; me.vz = 0; me.dashT = 0; me.charging = false; me.stunT = 0;
    g.resolve(me, 0.4);
    me._inp = { mx: 1, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
    let dist = 0; const x0 = me.x, z0 = me.z;
    for (let i = 0; i < 45; i++) { g.update(1 / 60); dist = Math.hypot(me.x - x0, me.z - z0); }
    const wk = me.waterK; const cell = g.cellType(me.x, me.z);
    me._inp = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
    return { dist, waterK: wk, x: me.x, z: me.z, cell };
  };
  const dry = measure(layout.dry);
  const wet = measure(layout.wet);
  me.isBot = wasBot; me.bot = oldBot; me._inp = null;
  return { dry, wet };
}, layout);
ok('water marks the fighter as slowed (waterK 0.68)', Math.abs((slow.wet.waterK || 0) - 0.68) < 0.02, slow.wet);
ok('walking in water is clearly slower than on a pad/path', slow.wet.dist < slow.dry.dist * 0.85 && slow.dry.dist > 0.8, slow);

const cam = await page.evaluate(() => {
  const g = __bg.app.game;
  if (__bg.camNow) __bg.camNow();
  const visW = (g && g.cam && (g.cam.visW || g.cam.w)) || (typeof __bg !== 'undefined' && __bg.gfx && __bg.gfx.follow && (__bg.gfx.follow.visW || __bg.gfx.follow.w));
  const cam = __bg.gfx && __bg.gfx.cam;
  const fov = cam && cam.fov; const asp = cam && (cam.aspect);
  // reuse controls412 idea: visible width in world units
  let worldW = null;
  try {
    const c = __bg.gfx.cam; const d = Math.hypot(c.position.x - 0, c.position.z - (c.position && 0));
    // from updateGfx follow
    worldW = window.__visW || null;
  } catch (e) {}
  const f = __bg.gfx && __bg.gfx.follow;
  return { visW: f && (f.visW || f.viewW || f.width), fov, asp, keys: f ? Object.keys(f).slice(0, 20) : [] };
});
// screenshot 915
await sleep(200);
await page.screenshot({ path: OUT + '/pond-915.png' });
ok('wrote Lotus Pond screenshot at 915', fs.existsSync(OUT + '/pond-915.png'));

const noisy = (errors || []).filter((e) => !/AudioContext|font|favicon|icon-192|ERR_FILE_NOT_FOUND|REQFAIL|audio device/i.test(e));
ok('no unexpected page errors at 915', noisy.length === 0, noisy.slice(0, 4));
await browser.close();

// 1024-wide shot + camera
const b2 = await boot(1024, 473);
await b2.page.evaluate(() => {
  const S = __bg.S(); S.hero = 'puff'; S.tutorialDone = true; S.setup.mode = 'classic'; S.setup.arena = 'pond'; S.setup.size = 'large'; S.setup.bots = 1; S.setup.diff = 0; S.setup.traps = 'off'; S.setup.mutator = 'off'; S.settings.events = 'off';
  __bg.app.startMode('classic');
});
for (let i = 0; i < 80; i++) { if (await b2.page.evaluate(() => !!(__bg.app.game && __bg.app.game.state === 'play'))) break; await sleep(100); }
await b2.page.evaluate(() => { const g = __bg.app.game; for (const f of g.fighters) { f.inv = 99; if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }); } });
await sleep(250);
await b2.page.screenshot({ path: OUT + '/pond-1024.png' });
ok('wrote Lotus Pond screenshot at 1024', fs.existsSync(OUT + '/pond-1024.png'));
const cam2 = await b2.page.evaluate(() => {
  const f = __bg.gfx && __bg.gfx.follow;
  return { visW: f && (f.visW || f.viewW), aspect: innerWidth / innerHeight, w: innerWidth, h: innerHeight };
});
ok('1024-wide view is a landscape phone frame', cam2.w >= 1000 && cam2.aspect > 1.5, cam2);
const noisy2 = (b2.errors || []).filter((e) => !/AudioContext|font|favicon|icon-192|ERR_FILE_NOT_FOUND|REQFAIL|audio device/i.test(e));
ok('no unexpected page errors at 1024', noisy2.length === 0, noisy2.slice(0, 4));
await b2.browser.close();

console.log(`map424 ${pass}/${pass + fail}  fail=${fail}`);
if (fail) process.exit(1);
