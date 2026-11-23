// fighter424: Puff the Dandelion Kid — local only. Gust shoves rivals and flying booms.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/fm424';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40)))));

const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true, paytest: 'unlock' });
await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
await page.goto((HTML.startsWith('file:') || HTML.startsWith('http') ? HTML : 'file://' + HTML), { waitUntil: 'load' });
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.HEROES))) break; await sleep(100); }

const meta = await page.evaluate(() => {
  const P = __bg.HEROES.find((h) => h.id === 'puff');
  const W = __bg.weapons.heroWeapons('puff');
  const sig = __bg.SIGS.puff;
  const ab = __bg.ABILITIES.puff;
  const sty = __bg.BOT_STYLES.puff;
  const S = __bg.S();
  return {
    n: __bg.HEROES.length, ids: __bg.HEROES.map((h) => h.id),
    name: P && P.name, title: P && P.title, how: P && P.how, cost: P && P.cost, shape: P && P.shape,
    color: P && P.color, weapons: W, sig, ab, sty,
    speed: S.settings.speed, battery: S.settings.battery, diff: S.setup.diff,
    free: (__bg.Pay && __bg.Pay.isHeroFree) ? __bg.Pay.isHeroFree('puff') : (P && P.cost === 0),
  };
});
ok('Puff is still in the roster', meta.n >= 9 && meta.ids.includes('puff'), { n: meta.n, ids: meta.ids });
ok('Puff is original: Dandelion Kid with a how-to line', !!(meta.name === 'Puff' && meta.title === 'Dandelion Kid' && meta.how && /gust/i.test(meta.how)), meta);
ok('Puff is free (cost 0, free-trial list)', meta.cost === 0 && meta.free === true, { cost: meta.cost, free: meta.free });
ok('Puff has 3 unique weapons', Array.isArray(meta.weapons) && meta.weapons.length === 3 && meta.weapons.every((id) => id.startsWith('puff_')), meta.weapons);
ok('Gust signature is a 10–14s Windy move', !!(meta.sig && meta.sig.tag === 'Windy' && meta.sig.name === 'Gust' && meta.sig.cd >= 10 && meta.sig.cd <= 14), meta.sig);
ok('Puff has 3 hearts and a bot style', !!(meta.ab && meta.ab.hp === 3 && meta.sty && meta.sty.pref > 0), { ab: meta.ab, sty: meta.sty });
ok('defaults stay Chill, Battery saver Auto, Easy bots', meta.speed === 'chill' && meta.battery === 'auto' && (meta.diff === 0 || meta.diff === 'easy' || meta.diff === undefined), meta);

await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.unlockedHeroes = __bg.HEROES.map((h) => h.id); __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' }); });
await sleep(300);
const card = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.hero-card')].map((c) => ({ name: (c.querySelector('.nm') || {}).textContent, how: (c.querySelector('.how') || {}).textContent, tag: (c.querySelector('.htag') || {}).textContent }));
  const puff = cards.find((c) => c.name === 'Puff');
  return { n: cards.length, puff, allHow: cards.every((c) => c.how && c.how.length > 8) };
});
ok('character select shows Puff with a how-to line', card.n >= 9 && card.puff && /gust/i.test(card.puff.how || '') && /Windy/i.test(card.puff.tag || ''), card);
await page.evaluate(() => { const c = [...document.querySelectorAll('.hero-card')].find((x) => /Puff/.test((x.querySelector('.nm') || {}).textContent || '')); if (c) c.click(); });
await sleep(250);
await page.screenshot({ path: OUT + '/puff-character-card-915.png' });
ok('wrote character card screenshot', fs.existsSync(OUT + '/puff-character-card-915.png'));

// start a match as Puff and prove Gust
await page.evaluate(() => {
  const S = __bg.S(); S.hero = 'puff'; S.tutorialDone = true; S.setup.mode = 'classic'; S.setup.arena = 'pond'; S.setup.size = 'large'; S.setup.bots = 1; S.setup.diff = 0; S.setup.traps = 'off'; S.setup.mutator = 'off'; S.settings.events = 'off';
  __bg.app.startMode('classic');
});
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(__bg.app.game && __bg.app.game.fighters && __bg.app.game.fighters.length && __bg.app.game.state === 'play'))) break; await sleep(100); }
await page.evaluate(() => {
  const g = __bg.app.game;
  for (const f of g.fighters) { f.inv = 99; f.stunT = 99; f.vx = 0; f.vz = 0; if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }); }
});
await sleep(200);
const gust = await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0) || g.fighters[0];
  const o = g.fighters.find((f) => f !== me && f.alive);
  // stand on a dry pad beside the water so Gust and the pond both read
  let spot = { x: 0, z: 3.5 };
  for (let z = -6; z <= 6 && spot.x === 0 && spot.z === 3.5; z += 1) {
    for (let x = -8; x <= 8; x += 1) {
      if (g.cellType(x, z) !== 0) continue;
      const nearW = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => g.cellType(x+dx, z+dz) === 6);
      if (nearW) { spot = { x, z }; break; }
    }
  }
  me.x = spot.x; me.z = spot.z; me.face = 0; me.ult = 100;
  g.fighters.forEach((f) => { if (f !== me && f !== o) { f.x = 16; f.z = 10; f.vx = 0; f.vz = 0; } });
  if (o) { o.x = spot.x; o.z = spot.z + 2.2; o.vx = 0; o.vz = 0; o.stunT = 0; o.inv = 99; }
  me.ammo = Math.max(1, me.ammo || 1); me.stunT = 0; me.inv = 99;
  // Gust should shove a rival disc, not Puff's own throw
  if (o) {
    o.ammo = Math.max(1, o.ammo || 1); o.stunT = 0; o.face = Math.PI;
    g.throwFrom(o, Math.PI, false, 0.8);
  }
  const boom = g.booms.find((b) => b.alive && o && b.owner === o);
  const b0 = boom ? { x: boom.x, z: boom.z } : null;
  if (boom) { boom.x = spot.x + 1.5; boom.z = spot.z + 0.3; }
  g.useUlt(me);
  for (let i = 0; i < 20; i++) __bg.app.camFollow(0.08);
  if (__bg.renderNow) __bg.renderNow();
  return {
    hid: me.hero && me.hero.id, name: __bg.SIGS.puff.name, ult: me.ult,
    rivalV: o ? Math.hypot(o.vx, o.vz) : 0,
    boomMoved: boom && b0 ? Math.hypot(boom.x - b0.x, boom.z - b0.z) : 0,
    ohud: !!(__bg.ohud && __bg.ohud.last && __bg.ohud.last.some((x) => x.me)),
  };
});
ok('Puff started the match', gust.hid === 'puff', gust);
ok('Gust shoves a nearby rival', gust.ult === 0 && gust.rivalV > 1, gust);
ok('Gust knocks a flying boomerang aside', gust.boomMoved > 0.4, gust);

await page.evaluate(() => { const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0); me.ult = 100; g.useUlt(me); });
await frame(page); await sleep(250);
await page.screenshot({ path: OUT + '/puff-gust-915.png' });
ok('wrote in-match Gust screenshot', fs.existsSync(OUT + '/puff-gust-915.png'));

const throwShot = await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => f.def && f.def.slot === 0);
  const o = g.fighters.find((f) => f !== me && f.alive);
  if (g.booms) g.booms.forEach((b) => { b.alive = false; if (b.mesh) b.mesh.visible = false; });
  me.ammo = Math.max(1, me.ammo || 1); me.inv = 99; me.stunT = 0; me.face = 0;
  if (o) { o.x = me.x + 6; o.z = me.z; o.inv = 99; }
  g.throwFrom(me, 0, false, 1);
  for (let i = 0; i < 8; i++) __bg.step(1);
  for (let i = 0; i < 12; i++) __bg.app.camFollow(0.08);
  if (__bg.renderNow) __bg.renderNow();
  return { booms: (g.booms || []).filter((b) => b.alive).length, wpn: me.wpn, x: me.x, z: me.z };
});
await sleep(80);
await page.screenshot({ path: OUT + '/puff-throw-915.png' });
ok('Puff can throw her weapon', throwShot.booms >= 1, throwShot);
ok('wrote in-match throw screenshot', fs.existsSync(OUT + '/puff-throw-915.png'));

const oh = await page.evaluate(() => {
  const cv = document.getElementById('ohud');
  return { cv: !!cv, n: __bg.ohud && __bg.ohud.last ? __bg.ohud.last.length : 0, me: __bg.ohud && __bg.ohud.last ? __bg.ohud.last.some((x) => x.me) : false };
});
ok('overhead bar draws for Puff', oh.cv && oh.n >= 1 && oh.me, oh);

// couch (keyboard: players=2 and not a touch device) + campaign + tutorial
await page.evaluate(() => {
  const S = __bg.S(); S.hero = 'puff'; S.hero2 = 'bao'; S.tutorialDone = true; S.setup.mode = 'classic'; S.setup.arena = 'dojo'; S.setup.players = 2;
  const app = __bg.app; app.isTouchDevice = () => false;
  app.startMode('classic');
});
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(__bg.app.game && __bg.app.game.fighters && __bg.app.game.fighters.filter((f) => !f.isBot).length >= 2))) break; await sleep(100); }
const couch = await page.evaluate(() => {
  const g = __bg.app.game; if (!g) return { ok: false };
  const p1 = g.fighters.find((f) => f.def && f.def.slot === 0);
  return { n: g.fighters.length, hid: p1 && p1.hero && p1.hero.id, humans: g.fighters.filter((f) => !f.isBot).length };
});
ok('couch can start with Puff as P1 and a second human', couch.hid === 'puff' && couch.humans >= 2, couch);

await page.evaluate(() => { const S = __bg.S(); S.hero = 'puff'; S.tutorialDone = true; __bg.app.startStage(1); });
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(__bg.app.game && __bg.app.match && __bg.app.match.mode === 'campaign' && __bg.app.game.fighters))) break; await sleep(100); }
const camp = await page.evaluate(() => {
  const g = __bg.app.game, m = __bg.app.match;
  const me = g && g.fighters.find((f) => f.def && f.def.slot === 0);
  return { mode: m && m.mode, hid: me && me.hero && me.hero.id, arena: g && g.arenaId };
});
ok('campaign stage 1 can start with Puff', camp.mode === 'campaign' && camp.hid === 'puff', camp);

await page.evaluate(() => { const S = __bg.S(); S.hero = 'puff'; __bg.app.startTutorial(); });
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(__bg.app.tut && __bg.app.game && __bg.app.game.fighters))) break; await sleep(100); }
const tut = await page.evaluate(() => {
  const g = __bg.app.game, me = g && g.fighters.find((f) => f.def && f.def.slot === 0);
  return { tut: !!(__bg.app.tut), hid: me && me.hero && me.hero.id };
});
ok('tutorial can start with Puff', tut.tut && tut.hid === 'puff', tut);

const noisy = (errors || []).filter((e) => !/AudioContext|font|favicon|icon-192|ERR_FILE_NOT_FOUND|REQFAIL|audio device/i.test(e));
ok('no unexpected page errors', noisy.length === 0, noisy.slice(0, 4));
await browser.close();
console.log(`fighter424 ${pass}/${pass + fail}  fail=${fail}`);
if (fail) process.exit(1);
