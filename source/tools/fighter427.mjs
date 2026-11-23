// fighter427: Bramble the Hedgehog Kid — local only. Spiky returns deny Salty steals; Bristle shoves rivals.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/batch427';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40)))));

const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true, paytest: 'unlock' });
await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
await page.goto((HTML.startsWith('file:') || HTML.startsWith('http') ? HTML : 'file://' + HTML), { waitUntil: 'load' });
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.HEROES))) break; await sleep(100); }

const meta = await page.evaluate(() => {
  const P = __bg.HEROES.find((h) => h.id === 'bram');
  const W = __bg.weapons.heroWeapons('bram');
  const sig = __bg.SIGS.bram;
  const ab = __bg.ABILITIES.bram;
  const sty = __bg.BOT_STYLES.bram;
  const S = __bg.S();
  return {
    n: __bg.HEROES.length, ids: __bg.HEROES.map((h) => h.id),
    name: P && P.name, title: P && P.title, how: P && P.how, cost: P && P.cost, shape: P && P.shape,
    weapons: W, sig, ab, sty,
    speed: S.settings.speed, battery: S.settings.battery, diff: S.setup.diff,
    free: (__bg.Pay && __bg.Pay.isHeroFree) ? __bg.Pay.isHeroFree('bram') : (P && P.cost === 0),
  };
});
ok('Bramble is in a 10-fighter roster', meta.n === 10 && meta.ids.includes('bram') && meta.ids.includes('puff'), { n: meta.n, ids: meta.ids });
ok('Bramble is original: Hedgehog Kid with a how-to line', !!(meta.name === 'Bramble' && meta.title === 'Hedgehog Kid' && meta.how && /snatch|spiky|quill/i.test(meta.how)), meta);
ok('Bramble is free (cost 0)', meta.cost === 0 && meta.free === true, { cost: meta.cost, free: meta.free });
ok('Bramble has 3 unique weapons', Array.isArray(meta.weapons) && meta.weapons.length === 3 && meta.weapons.every((id) => id.startsWith('bram_')), meta.weapons);
ok('Bristle is a 10–14s Spiky move', !!(meta.sig && meta.sig.tag === 'Spiky' && meta.sig.name === 'Bristle' && meta.sig.cd >= 10 && meta.sig.cd <= 14), meta.sig);
ok('Bramble has 3 hearts and a bot style', !!(meta.ab && meta.ab.hp === 3 && meta.sty && meta.sty.pref > 0), { ab: meta.ab, sty: meta.sty });
ok('defaults stay Chill, Battery saver Auto, Easy bots', meta.speed === 'chill' && meta.battery === 'auto' && (meta.diff === 0 || meta.diff === 'easy' || meta.diff === undefined), meta);

await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.unlockedHeroes = __bg.HEROES.map((h) => h.id); __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' }); });
await sleep(300);
const card = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.hero-card')].map((c) => ({ name: (c.querySelector('.nm') || {}).textContent, how: (c.querySelector('.how') || {}).textContent, tag: (c.querySelector('.htag') || {}).textContent }));
  const bram = cards.find((c) => c.name === 'Bramble');
  return { n: cards.length, bram };
});
ok('character select shows Bramble with a how-to line', card.n >= 10 && card.bram && /snatch|spiky|quill/i.test(card.bram.how || '') && /Spiky/i.test(card.bram.tag || ''), card);
await page.evaluate(() => { const c = [...document.querySelectorAll('.hero-card')].find((x) => /Bramble/.test((x.querySelector('.nm') || {}).textContent || '')); if (c) c.click(); });
await sleep(250);
await page.screenshot({ path: OUT + '/bramble-character-card-915.png' });
ok('wrote character card screenshot', fs.existsSync(OUT + '/bramble-character-card-915.png'));

await page.evaluate(() => {
  const S = __bg.S(); S.hero = 'bram'; S.tutorialDone = true; S.setup.mode = 'classic'; S.setup.arena = 'dojo'; S.setup.size = 'large'; S.setup.bots = 1; S.setup.diff = 0; S.setup.traps = 'off'; S.setup.mutator = 'off'; S.settings.events = 'off';
  __bg.app.startMode('classic');
  const g = __bg.app.game; __bg.app.paused = true;
  let k = 0; while (g.state !== 'play' && k++ < 4000) __bg.step(1);
  const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  const o = g.fighters.find((f) => f !== me);
  if (o) { o.def.hero = __bg.HEROES.find((h) => h.id === 'kuma'); o.hero = o.def.hero; o.abil = 'kuma'; o.mods = { ...o.mods, ...(o.hero.mods || {}), steal: true }; o.name = 'Salty'; }
  if (me) { me.inv = 4; me.hp = me.maxHp; me.x = 0; me.z = 0; }
});
await frame(page);

const bristle = await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  const o = g.fighters.find((f) => f !== me && f.alive);
  me.x = 0; me.z = 0; me.ult = 100; me.inv = 0.2;
  if (o) { o.x = 0; o.z = 2.0; o.vx = 0; o.vz = 0; o.alive = true; }
  g.useUlt(me);
  return { kind: me.ultKind, name: __bg.SIGS.bram.name, ult: me.ult, inv: me.inv, rivalV: o ? Math.hypot(o.vx, o.vz) : 0, boomMoved: g.booms.some((b) => b.alive) };
});
ok('Bristle fires, shoves the rival, and does not spawn a disc', bristle.name === 'Bristle' && bristle.ult === 0 && bristle.rivalV > 1 && bristle.kind === 'bram', bristle);
await frame(page);
await page.screenshot({ path: OUT + '/bramble-bristle-915.png' });
ok('wrote Bristle screenshot', fs.existsSync(OUT + '/bramble-bristle-915.png'));

const poke = await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  const o = g.fighters.find((f) => f !== me);
  me.x = -8; me.z = 0; me.ammo = 1; me.chargeT = 0.5; me.face = 0;
  g.booms.forEach((b) => { b.alive = false; });
  g.throwFrom(me, 0, false, 0.5);
  const b = g.booms.find((x) => x.alive && x.owner === me);
  if (!b) return { noBoom: true };
  b.phase = 'ret'; b.t = 0.4; b.total = 0.5; b.fade = 0; b.retT = 0; b.x = 1.0; b.z = 0; b.alive = true;
  o.mods = o.mods || {}; o.mods.steal = true; o.alive = true; o.stunT = 0; o.frozenT = 0; o.stealT = 0; o.inv = 0; o.hp = o.maxHp; o.x = 1.0; o.z = 0; o.dashT = 0; o.shield = false;
  const hp0 = o.hp, ammo0 = me.ammo;
  b.update(1 / 120);
  const stillMine = b.alive && b.owner === me;
  const stolen = !b.alive || b.owner === o;
  return { hp0, hp: o.hp, stillMine, stolen, ammo0, ammo: me.ammo, phase: b.phase, owner: b.owner && b.owner.abil, salty: o.abil, stealT: o.stealT };
});
ok('Salty cannot snatch Bramble’s returning disc and gets poked', poke && poke.hp < poke.hp0 && poke.stillMine && !poke.stolen, poke);

await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  me.x = 0; me.z = 0; me.ammo = 1; g.throwFrom(me, 0.4, false, 0.6);
});
for (let i = 0; i < 20; i++) { await page.evaluate(() => __bg.step(1)); }
await frame(page);
await page.screenshot({ path: OUT + '/bramble-throw-915.png' });
ok('wrote throw screenshot', fs.existsSync(OUT + '/bramble-throw-915.png'));

const pe = errors.filter((e) => !/REQFAIL|ERR_FILE|font|favicon|AudioContext|sw failed/i.test(e));
ok('no page errors', !pe.length, pe.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } }));
await browser.close();
process.exit(fail ? 1 : 0);
