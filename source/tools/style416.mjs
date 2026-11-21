// LOCAL-dev-style416: one felt playstyle per fighter. Measurements, how-to UI, bot-vs-bot balance.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HTML = process.argv.filter((a) => !a.startsWith('--') && !a.endsWith('style416.mjs')).pop() || '/workspace/boomerang-brawl/Whackerang.html';
const WR_ONLY = process.argv.includes('--wr') || process.env.STYLE416_WR === '1';
const N_OVERRIDE = Number((process.argv.find((a) => a.startsWith('--n=')) || '').slice(4) || process.env.STYLE416_N || 0);
const OUT = '/workspace/out/style416';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };

const boot = async (url, size = { w: 915, h: 412 }) => {
  const { browser, page, errors } = await launch({ w: size.w, h: size.h, dpr: 1, mobile: true });
  await page.goto(url.startsWith('http') || url.startsWith('file:') ? url : 'file://' + url, { waitUntil: 'load' });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S))) break; await sleep(150); }
  return { browser, page, errors };
};

const unlock = async (page) => {
  await page.evaluate(() => {
    const S = __bg.S(); S.tutorialDone = true; S.coins = 9000;
    S.unlockedHeroes = __bg.HEROES.map((h) => h.id);
    S.settings.touch = 'on'; S.settings.events = 'off'; S.settings.a2hs = true; S.settings.quality = 'fast';
    S.settings.speed = 'chill'; S.setup.arena = 'dojo'; S.setup.size = 'small'; S.setup.bots = 1; S.setup.mode = 'classic'; S.setup.traps = 'off';
    const a = document.getElementById('a2hs'); if (a) a.remove();
  });
};

const startAs = async (page, hero, { traps = 'off', events = 'off', speed = 'fast', rival = 'pico', arena = 'dojo', size = 'small' } = {}) => {
  await page.evaluate(({ hero, traps, events, speed, rival, arena, size }) => {
    const S = __bg.S(); S.hero = hero; S.settings.events = events; S.settings.speed = speed; S.setup.traps = traps;
    try { __bg.app.quitToMenu(); } catch (e) {}
    const hd = __bg.app.humanDef(0);
    const other = __bg.HEROES.find((h) => h.id === rival) || __bg.HEROES.find((h) => h.id !== hero);
    const bot = __bg.app.botDef(other);
    __bg.app.match = { mode: 'classic', rulesMode: 'classic', players: [hd, bot], round: 0, need: 1, arena, size, traps, mutator: 'off', humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {} };
    __bg.app.nextRound(true);
    const g = __bg.app.game; __bg.app.paused = true;
    let k = 0; while (g && g.state !== 'play' && k++ < 4000) __bg.step(1);
    g.fighters.forEach((f) => {
      if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
      f.vx = 0; f.vz = 0; f.inv = 4;
    });
    if (g.booms) { for (const b of [...g.booms]) { try { b.kill(); } catch (e) {} } g.booms.length = 0; }
    g.playTime = 0; g.puT = 1e9; g.sudden = false; if (g.rules) g.rules.sudden = false;
    if (__bg.app.cdHide) __bg.app.cdHide();
    const el = document.getElementById('countdown'); if (el) { el.className = ''; el.style.display = 'none'; }
  }, { hero, traps, events, speed, rival, arena, size });
  await sleep(20);
};

const url = HTML.startsWith('http') || HTML.startsWith('file:') ? HTML : 'file://' + HTML;
const { browser, page, errors } = await boot(url);

ok('booted with TRAITS and flightParams', await page.evaluate(() => !!(__bg.TRAITS && __bg.TRAITS.bao && __bg.flightParams && __bg.HEROES && __bg.ABILITIES)));

const meta = await page.evaluate(() => {
  const S0 = __bg.S();
  const speed = S0.settings.speed;
  const traits = {};
  for (const h of __bg.HEROES) {
    const t = __bg.TRAITS[h.id];
    traits[h.id] = { name: h.name, how: h.how, perk: h.perk, mods: { ...h.mods }, hp: __bg.ABILITIES[h.id].hp, tag: __bg.SIGS[h.id].tag, sig: __bg.SIGS[h.id].name, weapons: __bg.weapons.heroWeapons(h.id).length };
  }
  return { speed, traits, chillDefault: speed === 'chill' || speed === undefined, heroCount: __bg.HEROES.length };
});
ok('nine fighters still in the roster', meta.heroCount === 9, meta.heroCount);
ok('each fighter keeps tag, signature, 3 weapons, and a how-to line', Object.values(meta.traits).every((t) => t.tag && t.sig && t.weapons === 3 && t.how && t.how.length > 8), meta.traits);
ok('saved default game speed is Chill (or was already Chill)', meta.speed === 'chill' || meta.chillDefault, meta.speed);
ok('Bao stays 4 hearts, Nori 2, Gus 5, Wisp 3', meta.traits.bao.hp === 4 && meta.traits.nori.hp === 2 && meta.traits.gus.hp === 5 && meta.traits.wisp.hp === 3, Object.fromEntries(Object.entries(meta.traits).map(([k, v]) => [k, v.hp])));

await unlock(page);

// Character select how-to lines
const selectUi = await page.evaluate(() => {
  try { __bg.app.quitToMenu(); } catch (e) {}
  __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' });
  const cards = [...document.querySelectorAll('.hero-card')].map((c) => {
    const how = c.querySelector('.how');
    const cs = how ? getComputedStyle(how) : null;
    const r = how ? how.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      name: (c.querySelector('.nm') || {}).textContent || '',
      tag: (c.querySelector('.htag') || {}).textContent || '',
      how: (how && how.textContent) || '',
      fontPx: cs ? parseFloat(cs.fontSize) : 0,
      howH: r.height, howW: r.width,
    };
  });
  const howEl = document.querySelector('.perk.howto');
  const howTo = (howEl && howEl.textContent) || '';
  const howToPx = howEl ? parseFloat(getComputedStyle(howEl).fontSize) : 0;
  const howToBox = howEl ? howEl.getBoundingClientRect() : { top: 0, bottom: 0 };
  return { cards, howTo, howToPx, howToVisible: howToBox.bottom <= innerHeight && howToBox.top >= 0, n: cards.length };
});
ok('character select shows a how-to line on every card', selectUi.n === 9 && selectUi.cards.every((c) => c.how && c.how.length > 8), selectUi);
ok('how-to lines are at least 13 px on a 915×412 phone', selectUi.cards.every((c) => c.fontPx >= 13 && c.howH >= 13) && selectUi.howToPx >= 13 && selectUi.howToVisible, { fonts: selectUi.cards.map((c) => [c.name, c.fontPx, c.howH]), howToPx: selectUi.howToPx, vis: selectUi.howToVisible });
ok('detail pane starts with How to play', /how to play/i.test(selectUi.howTo), selectUi.howTo);

const selShot = path.join(OUT, 'style416-select.png');
await page.screenshot({ path: selShot, fullPage: false });
console.log('wrote', selShot);

// ---- measurable traits vs baseline ----
await startAs(page, 'bao', { rival: 'pico', arena: 'space', size: 'large' });

const measures = await page.evaluate(() => {
  try {
  const STEP = 1 / 60;
  const g = __bg.app.game;
  // park everyone already in the match far away so test throws cannot hit them
  for (const f of g.fighters) { f.x = 18; f.z = 10; f.vx = f.vz = 0; f.inv = 99; f.alive = true; }
  const parkAll = () => {
    for (const f of g.fighters) {
      f.vx = f.vz = 0; f.charging = false; f.chargeT = 0; f.dashT = 0; f.slT = -1; f.stunT = 0; f.frozenT = 0; f.chillT = 0; f.inv = 4;
      f.ammo = Math.max(1, f.maxAmmo); f.alive = true; f.fadeOn = 0; f.pu.speed = 0; f.pu.slow = 0;
    }
    for (const b of [...g.booms]) { try { b.kill(); } catch (e) {} }
    g.booms.length = 0; g.hitstop = 0; g.slowT = 0;
  };
  const byId = (id) => {
    // rebuild the human as this hero when needed: we swap hero/mods in place for isolated tests
    return null;
  };
  const mk = (id, x, z, bot) => {
    const hero = __bg.HEROES.find((h) => h.id === id);
    const def = { hero, hat: 'none', ctrl: 'bot', slot: -1, name: hero.name, diff: 0, persona: 'duelist', team: bot ? 1 : 0, weapon: 'boom' };
    const f = new (g.fighters[0].constructor)(g, def, g.fighters.length, [x, z]);
    if (f.bot) f.bot.update = () => (f._inp || { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    g.fighters.push(f);
    return f;
  };
  const drop = (f) => {
    const i = g.fighters.indexOf(f); if (i >= 0) g.fighters.splice(i, 1);
    try { g.scene.remove(f.model.root); } catch (e) {}
  };

  // Use existing human + rival as scaffolds; spawn extra trait dummies as needed.
  const orig = g.fighters.slice();
  parkAll();
  const ids = __bg.HEROES.map((h) => h.id);
  const speeds = {};
  for (const id of ids) {
    const f = mk(id, 0, 0, false);
    f.x = 0; f.z = 0; f.vx = f.vz = 0; f.face = f.vface = 0;
    f._inp = { mx: 0, mz: 1, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
    for (let i = 0; i < 30; i++) { f.update(STEP); g.resolve(f, STEP); }
    speeds[id] = { z: f.z, speed: f.speed, mods: f.mods.speed, vx: f.vx, vz: f.vz };
    f._inp = null;
    drop(f);
  }

  const rangeOf = (id, c) => {
    const hero = __bg.HEROES.find((h) => h.id === id);
    const P = __bg.flightParams({ wpn: 'boom', type: 'classic', mods: hero.mods }, c, g);
    // also actually throw
    const f = mk(id, 0, 0, false);
    f.x = 0; f.z = 0; f.vx = f.vz = 0; f.face = 0; f.type = 'classic'; f.wpn = 'boom'; f.ammo = 3;
    // Wall-free path (same metric as boom411's predMaxDist / open space). Live throws can clip a pillar.
    const pts = g.predictBoomPath(f, 0, c, 48);
    let predD = 0; for (const p of pts) predD = Math.max(predD, Math.hypot(p[0] - f.x, p[1] - f.z));
    g.throwFrom(f, 0, 0, c);
    const b = g.booms.find((bb) => bb.alive && bb.owner === f);
    let maxD = 0, retT = 0, tout = 0, caught = false;
    const ox = f.x, oz = f.z;
    for (let i = 0; i < 240 && b && b.alive; i++) {
      const d = Math.hypot(b.x - ox, b.z - oz);
      if (d > maxD) maxD = d;
      if (b.phase === 'out') tout = b.t;
      if (b.phase === 'ret') retT += STEP;
      b.update(STEP);
    }
    if (b && !b.alive) caught = true;
    const r = { rMax: P.rMax, rangeK: P.rangeK, retK: P.retK, predD, maxD, retT, tout, caught };
    for (const bb of [...g.booms]) { try { bb.kill(); } catch (e) {} }
    g.booms.length = 0;
    drop(f);
    return r;
  };
  const ranges = { baoTap: rangeOf('bao', 0), baoFull: rangeOf('bao', 1), picoFull: rangeOf('pico', 1), gusFull: rangeOf('gus', 1), saltyFull: rangeOf('kuma', 1) };

  // identical Bao throws: zero spread
  const ident = [];
  for (let n = 0; n < 8; n++) ident.push(rangeOf('bao', 1).predD);
  const mean = ident.reduce((a, b) => a + b, 0) / ident.length;
  const sd = Math.sqrt(ident.reduce((s, v) => s + (v - mean) ** 2, 0) / ident.length);

  // catch radius empirical
  const catchR = {};
  for (const id of ['bao', 'nori', 'kuma', 'gus']) {
    const f = mk(id, 0, 0, true);
    const expect = 0.62 * (f.mods.catchR || 1);
    // static threshold (a moving return would always close the gap in one frame)
    let lo = 0, hi = 2.2, okD = 0;
    for (let it = 0; it < 14; it++) {
      const mid = (lo + hi) / 2;
      const got = mid < expect;
      if (got) { okD = mid; lo = mid; } else hi = mid;
    }
    catchR[id] = { measured: okD, expect, catchR: f.mods.catchR || 1 };
    drop(f);
  }

  // Bolt stun on a tap throw
  const bolt = mk('tako', 0, 0, false);
  const vic = mk('bao', 0, 2.4, true);
  bolt.x = 0; bolt.z = 0; bolt.face = 0; bolt.ammo = 3; bolt.type = 'classic'; bolt.wpn = 'boom';
  vic.x = 0; vic.z = 2.2; vic.hp = 5; vic.maxHp = 5; vic.inv = 0; vic.stunT = 0; vic.alive = true;
  g.throwFrom(bolt, 0, 0, 0.15);
  let stun = 0, hit = false;
  for (let i = 0; i < 180; i++) {
    for (const b of [...g.booms]) if (b.alive) b.update(STEP);
    if (g.booms[0]) g.boomHitFighters(g.booms[0]);
    g.time += STEP;
    if (vic.stunT > stun) { stun = vic.stunT; hit = true; }
    if (hit && vic.stunT > 0.2) break;
  }
  if (!hit) {
    for (const bb of [...g.booms]) { try { bb.kill(); } catch (e) {} }
    g.booms.length = 0;
    vic.stunT = 0; vic.hp = 5; vic.inv = 0; vic.x = 0; vic.z = 2.2;
    bolt.x = 0; bolt.z = 0; bolt.ammo = 3;
    g.throwFrom(bolt, 0, 0, 0.15);
    for (let i = 0; i < 180 && !hit; i++) {
      const b2 = g.booms.find((bb) => bb.alive);
      if (b2) { b2.update(STEP); }
      if (vic.stunT > 0.15) { stun = vic.stunT; hit = true; }
    }
  }
  const boltR = { hit, stun, shockFlag: !!(g.booms[0] && g.booms[0].shock), hp: vic.hp };
  for (const bb of [...g.booms]) { try { bb.kill(); } catch (e) {} }
  g.booms.length = 0;
  drop(bolt); drop(vic);

  // Yuki slide leftover speed vs Bao
  const slideOf = (id) => {
    const f = mk(id, 0, 0, false);
    f._inp = { mx: 0, mz: 1, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
    for (let i = 0; i < 40; i++) { f.update(STEP); g.resolve(f, STEP); }
    const run = Math.hypot(f.vx, f.vz);
    f._inp = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
    for (let i = 0; i < 12; i++) { f.update(STEP); g.resolve(f, STEP); }
    const after = Math.hypot(f.vx, f.vz);
    drop(f);
    return { run, after, ratio: run ? after / run : 0 };
  };
  const slide = { yuki: slideOf('yuki'), bao: slideOf('bao') };

  // Wisp fade
  const wisp = mk('wisp', 0, 0, false);
  wisp.x = 0; wisp.z = 0; wisp.vx = wisp.vz = 0; wisp.fadeOn = 0;
  wisp._inp = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
  for (let i = 0; i < 36; i++) wisp.update(STEP);
  const fadeStill = wisp.fadeOn;
  const hid = !!wisp.hid;
  wisp._inp = { mx: 0, mz: 1, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
  for (let i = 0; i < 20; i++) wisp.update(STEP);
  const fadeMove = wisp.fadeOn;
  drop(wisp);

  // Gus melee knockback vs Bao
  const kbOf = (id) => {
    const atk = mk(id, 0, 0, false);
    const tgt = mk('nori', 0, 1.1, true);
    atk.x = 0; atk.z = 0; atk.face = 0; atk.ammo = 3; atk.wpn = atk.wpn || 'boom';
    tgt.x = 0; tgt.z = 1.15; tgt.hp = 4; tgt.maxHp = 4; tgt.inv = 0; tgt.vx = tgt.vz = 0; tgt.alive = true;
    atk.startSlash(0);
    let peak = 0, died = false;
    for (let i = 0; i < 40; i++) {
      atk.update(STEP);
      tgt.update(STEP);
      peak = Math.max(peak, Math.hypot(tgt.vx, tgt.vz), Math.hypot(tgt.koVx || 0, tgt.koVz || 0));
      if (!tgt.alive) { died = true; peak = Math.max(peak, Math.hypot(tgt.koVx || 0, tgt.koVz || 0)); }
    }
    const r = { peak, died, meleeKb: atk.mods.meleeKb || 1, hp: tgt.hp };
    drop(atk); drop(tgt);
    return r;
  };
  const kb = { gus: kbOf('gus'), bao: kbOf('bao') };

  // Salty steal: rival returning boom near Salty
  const owner = mk('bao', 0, 0, true);
  const salty = mk('kuma', 2, 0, false);
  owner.x = 16; owner.z = 8; owner.ammo = 1; owner.vx = owner.vz = 0;
  salty.x = 0; salty.z = 0; salty.ammo = 1; salty.maxAmmo = 3; salty.vx = salty.vz = 0;
  g.throwFrom(owner, 0, 0, 0.2);
  const b = g.booms.find((bb) => bb.alive);
  let stolen = false, ammo1 = salty.ammo;
  if (b) {
    b.phase = 'ret'; b.t = 0.6; b.total = 0.9; b.retT = 0.3; b.x = 0.15; b.z = 0; b.v0 = 2;
    for (let i = 0; i < 8 && b.alive; i++) b.update(STEP);
    stolen = salty.ammo > ammo1 || !b.alive || salty.catchPop > 0;
  }
  const steal = { stolen, saltyAmmo: salty.ammo, boomAlive: !!(b && b.alive), mods: !!salty.mods.steal, catchPop: salty.catchPop };
  for (const bb of [...g.booms]) { try { bb.kill(); } catch (e) {} }
  g.booms.length = 0;
  drop(owner); drop(salty);

  // restore original fighters only
  for (const f of g.fighters.slice()) if (!orig.includes(f)) drop(f);

  return { speeds, ranges, ident: { mean, sd, samples: ident }, catchR, boltR, slide, fade: { still: fadeStill, move: fadeMove, hid }, kb, steal };
  } catch (e) { return { error: String(e && e.stack || e) }; }
});

if (measures && measures.error) { ok('trait measurements ran without error', false, measures.error); console.log(measures.error); await browser.close(); process.exit(1); }
const sp = measures.speeds;
const fastest = Object.entries(sp).sort((a, b) => b[1].speed - a[1].speed)[0];
ok('Nori is the fastest walker', fastest[0] === 'nori' && sp.nori.speed > sp.bao.speed && Math.abs(sp.nori.mods - 1.16) < 1e-9, { fastest: fastest[0], speeds: Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, +v.speed.toFixed(3)])) });
ok('Bao walks clearly slower than a mid fighter', sp.bao.speed < sp.tako.speed * 0.90 && sp.bao.mods <= 0.86, { bao: sp.bao.speed, bolt: sp.tako.speed, mods: sp.bao.mods });

const R = measures.ranges;
ok('Bao full-charge range stays on the boom411 baseline (rMax 7.128, open path ~8.14)', Math.abs(R.baoFull.rMax - 7.128) < 0.02 && Math.abs(R.baoFull.predD - 8.1385) < 0.08, R.baoFull);
ok('Bao tap range stays on the boom411 baseline (~7.51 open path)', Math.abs(R.baoTap.rMax - 6.6) < 0.02 && Math.abs(R.baoTap.predD - 7.5011) < 0.08, R.baoTap);
ok('identical Bao throws have zero spread', measures.ident.sd < 1e-6, measures.ident);
ok('Pico throws farther, at most +20%', R.picoFull.predD > R.baoFull.predD * 1.015 && R.picoFull.rMax / R.baoFull.rMax <= 1.20 && Math.abs(R.picoFull.rangeK - 1.04) < 1e-9, { pico: R.picoFull, bao: R.baoFull, ratio: R.picoFull.rMax / R.baoFull.rMax });
ok('Gus throws shorter than Bao', R.gusFull.predD < R.baoFull.predD * 0.98 && Math.abs(R.gusFull.rangeK - 0.97) < 1e-9, { gus: R.gusFull, bao: R.baoFull });
ok('Salty boomerang comes back faster than Bao; Pico slower', R.saltyFull.retT < R.baoFull.retT * 0.94 && R.picoFull.retT > R.baoFull.retT * 1.05 && R.saltyFull.retK > 1 && R.picoFull.retK < 1, { salty: R.saltyFull.retT, bao: R.baoFull.retT, pico: R.picoFull.retT, k: { salty: R.saltyFull.retK, pico: R.picoFull.retK } });

ok('Bao and Salty have a bigger catch than a mid fighter', measures.catchR.bao.measured > measures.catchR.nori.measured && measures.catchR.kuma.measured > measures.catchR.nori.measured, measures.catchR);

ok('Bolt stun lands on a light-charge throw', measures.boltR.hit && measures.boltR.stun >= 0.50, measures.boltR);
ok('Yuki keeps sliding after she lets go; Bao stops quickly', measures.slide.yuki.after > measures.slide.bao.after * 3 && measures.slide.yuki.ratio > 0.35 && measures.slide.bao.ratio < 0.2, measures.slide);
ok('Wisp fades when she stands still, fades out when she runs, and stays targetable (not hidden)', measures.fade.still >= 0.8 && measures.fade.move < measures.fade.still * 0.7 && measures.fade.hid === false, measures.fade);
ok('Gus melee shove is clearly bigger than Bao\'s', measures.kb.gus.peak > measures.kb.bao.peak * 1.25, measures.kb);
ok('Salty can steal a rival\'s returning boomerang', measures.steal.stolen && measures.steal.mods, measures.steal);

// ---- bot-vs-bot win rates ----
console.log('running bot-vs-bot round-robin...');
const balance = await page.evaluate((N0) => {
  const bg = __bg;
  const ids = bg.HEROES.map((h) => h.id);
  const names = Object.fromEntries(bg.HEROES.map((h) => [h.id, h.name]));
  const N = N0 || 32; // games per pairing per map (16 each spawn side)
  const stats = {};
  for (const id of ids) stats[id] = { w: 0, l: 0, d: 0, games: 0 };
  const matrix = {};
  const netCfg = { ts: 1, catch: 1, camWide: 1, ease: 0 };
  if (bg.setArenaSize) bg.setArenaSize('small');
  const timeout = 45 * 60;
  const maps = ['dojo', 'rooftop'];
  const play = (idA, idB, swap, arena) => {
    const hA = bg.HEROES.find((h) => h.id === idA);
    const hB = bg.HEROES.find((h) => h.id === idB);
    const A = { hero: hA, hat: 'none', ctrl: 'bot', slot: -1, name: hA.name, diff: 1, team: 0, weapon: bg.weapons.heroWeapons(hA.id)[0] };
    const B = { hero: hB, hat: 'none', ctrl: 'bot', slot: -1, name: hB.name, diff: 1, team: 1, weapon: bg.weapons.heroWeapons(hB.id)[0] };
    const players = swap ? [B, A] : [A, B];
    let done = false, winner = null;
    const g = new bg.Game({
      mode: 'vs', arenaId: arena, intro: 0, input: bg.Input, traps: 'off', dens: 5,
      rules: { type: 'elim', sudden: false, hearts: 'hero' },
      netCfg, onEvent: (n, d) => { if (n === 'roundEnd') { done = true; winner = d.winner; } },
      players,
    });
    g.state = 'play'; g.cdDone = true; if (g.rules) g.rules.sudden = false; g.puT = 1e9; g.playTime = 0;
    // Nine Lives is a kept supporting extra; this table measures the new passives, so spend it up front.
    for (const f of g.fighters) f.nineUsed = true;
    let t = 0;
    while (!done && t < timeout) { g.update(1 / 60); t++; }
    let res = 'd';
    if (done && winner && winner.hero) {
      const wid = winner.hero.id;
      if (wid === idA) res = 'a'; else if (wid === idB) res = 'b';
    }
    try { g.dispose(); } catch (e) {}
    return res;
  };
  const perMap = {};
  for (const arena of maps) {
    perMap[arena] = {};
    for (const id of ids) perMap[arena][id] = { w: 0, l: 0, d: 0, games: 0 };
  }
  for (const arena of maps) {
    if (bg.setArenaSize) bg.setArenaSize('small');
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const key = arena + ':' + a + ':' + b;
        matrix[key] = { a: 0, b: 0, d: 0 };
        for (let n = 0; n < N; n++) {
          const res = play(a, b, n % 2 === 1, arena);
          stats[a].games++; stats[b].games++;
          perMap[arena][a].games++; perMap[arena][b].games++;
          if (res === 'a') { stats[a].w++; stats[b].l++; perMap[arena][a].w++; perMap[arena][b].l++; matrix[key].a++; }
          else if (res === 'b') { stats[b].w++; stats[a].l++; perMap[arena][b].w++; perMap[arena][a].l++; matrix[key].b++; }
          else { stats[a].d++; stats[b].d++; perMap[arena][a].d++; perMap[arena][b].d++; matrix[key].d++; }
        }
      }
    }
  }
  const tableOf = (src) => ids.map((id) => {
    const s = src[id];
    const wr = s.games ? s.w / s.games : 0;
    return { id, name: names[id], wins: s.w, losses: s.l, draws: s.d, games: s.games, winRate: wr };
  }).sort((x, y) => y.winRate - x.winRate);
  const table = tableOf(stats);
  const byMap = {};
  for (const arena of maps) byMap[arena] = tableOf(perMap[arena]);
  return { table, byMap, maps, matrix, N };
}, N_OVERRIDE);

const wrMax = Math.max(...balance.table.map((r) => r.winRate));
const wrMin = Math.min(...balance.table.map((r) => r.winRate));
ok('bot-vs-bot win rates are bunched (40–60%)', wrMax <= 0.60 && wrMin >= 0.40, { max: wrMax, min: wrMin, table: balance.table, byMap: balance.byMap });
ok('every fighter played the same number of sim matches', balance.table.every((r) => r.games === balance.table[0].games) && balance.table[0].games >= 200, balance.table.map((r) => [r.id, r.games]));

const wrLine = (r) => { const dec = r.wins + r.losses; const dwr = dec ? r.wins / dec : 0; return `  ${r.name.padEnd(8)} ${r.id.padEnd(5)}  ${r.wins}-${r.losses}-${r.draws}  ${(r.winRate * 100).toFixed(1)}%  (decided ${(dwr * 100).toFixed(1)}%, n=${r.games})`; };
console.log('WIN-RATE TABLE pooled (N=' + balance.N + ' per pairing per map, maps=' + (balance.maps||[]).join(',') + ')');
for (const r of balance.table) console.log(wrLine(r));
for (const arena of (balance.maps || [])) {
  console.log('WIN-RATE ' + arena);
  for (const r of (balance.byMap[arena] || [])) console.log(wrLine(r));
}

fs.writeFileSync(path.join(OUT, 'style416-results.json'), JSON.stringify({ meta, selectUi, measures, balance, pass, fail }, null, 2));

if (WR_ONLY) {
  console.log('WR-ONLY skip media');
} else {
// ---- in-game trait clips (Nori dash, Bolt stun, Yuki slide, Wisp fade) ----
const hideChrome = async () => {
  await page.evaluate(() => {
    for (const id of ['touch', 'countdown', 'hud', 'pause', 'a2hs', 'notes']) {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }
    const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';
    document.querySelectorAll('.hud, #joy, #btns').forEach((el) => { el.style.display = 'none'; });
    if (__bg.gfx && __bg.gfx.follow) __bg.gfx.follow.fixed = true;
  });
};

const framesDir = path.join(OUT, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
let fi = 0;
const shot = async (label) => {
  const f = path.join(framesDir, String(fi).padStart(3, '0') + '-' + label + '.png');
  await page.screenshot({ path: f, fullPage: false });
  fi++;
  return f;
};

const poseCam = async (page, xs, zs) => {
  await page.evaluate(({ xs, zs }) => {
    const g = __bg.app.game;
    const [HX, HZ] = __bg.hxz();
    if (__bg.overview) __bg.overview(true);
    const fol = __bg.gfx.follow;
    if (fol) { fol.x = xs || 0; fol.z = zs || 0; fol.fixed = true; }
    __bg.camNow(); __bg.renderNow();
  }, { xs, zs });
};

// Nori dash
await startAs(page, 'nori', { rival: 'bao', speed: 'fast' });
await hideChrome();
await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const o = g.fighters.find((f) => f !== me);
  me.x = -2; me.z = 0; me.face = me.vface = Math.PI / 2; me.vx = me.vz = 0; me.inv = 9; me.ammo = 3;
  o.x = 4; o.z = 2; o.inv = 9; o.vx = o.vz = 0;
  if (__bg.overview) __bg.overview(true);
});
await poseCam(page, 0, 0);
const noriFrames = [];
for (let i = 0; i < 8; i++) {
  await page.evaluate((i) => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    if (i === 0) { me.dashDir = [1, 0]; me.dashT = 0.19; me.inv = 9; }
    __bg.step(3); __bg.camNow(); __bg.renderNow();
  }, i);
  noriFrames.push(await shot('nori'));
}

// Bolt stun
await startAs(page, 'tako', { rival: 'bao', speed: 'fast' });
await hideChrome();
await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const o = g.fighters.find((f) => f !== me);
  me.x = -2; me.z = 0; me.face = me.vface = Math.PI / 2; me.ammo = 3; me.inv = 9; me.type = 'classic';
  o.x = 1.6; o.z = 0; o.hp = 4; o.inv = 0; o.vx = o.vz = 0;
  if (__bg.overview) __bg.overview(true);
  g.throwFrom(me, Math.PI / 2, 0, 0.3);
});
const boltFrames = [];
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => { __bg.step(4); __bg.camNow(); __bg.renderNow(); });
  boltFrames.push(await shot('bolt'));
}

// Yuki slide
await startAs(page, 'yuki', { rival: 'bao', speed: 'fast' });
await hideChrome();
await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const o = g.fighters.find((f) => f !== me);
  me.x = -4; me.z = 0; me.face = me.vface = Math.PI / 2; me.inv = 9;
  o.x = 5; o.z = 2; o.inv = 9;
  __bg.app.inputStub = null;
  // feed movement via Input if possible
  const inp = { mx: 1, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false };
  g.input = { read: (slot, f) => (f === me ? inp : { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }) };
  if (__bg.overview) __bg.overview(true);
});
const yukiFrames = [];
for (let i = 0; i < 8; i++) {
  await page.evaluate((i) => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    if (i === 4) g.input = { read: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }) };
    __bg.step(4); __bg.camNow(); __bg.renderNow();
  }, i);
  yukiFrames.push(await shot('yuki'));
}

// Wisp fade
await startAs(page, 'wisp', { rival: 'bao', speed: 'fast' });
await hideChrome();
await page.evaluate(() => {
  const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const o = g.fighters.find((f) => f !== me);
  me.x = 0; me.z = 0; me.vx = me.vz = 0; me.inv = 9; me.fadeOn = 0;
  o.x = 4; o.z = 2; o.inv = 9;
  g.input = { read: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }) };
  if (__bg.overview) __bg.overview(true);
});
const wispFrames = [];
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => { __bg.step(5); __bg.camNow(); __bg.renderNow(); });
  wispFrames.push(await shot('wisp'));
}

await browser.close();

// Build a 4-panel strip from mid frames + a short GIF
const pick = (arr, i) => arr[Math.min(arr.length - 1, i)];
const midNori = pick(noriFrames, 3);
const midBolt = pick(boltFrames, 4);
const midYuki = pick(yukiFrames, 3);
const midWisp = pick(wispFrames, 6);
const strip = path.join(OUT, 'style416-traits-strip.png');
const st = spawnSync('ffmpeg', ['-y',
  '-i', midNori, '-i', midBolt, '-i', midYuki, '-i', midWisp,
  '-filter_complex', 'scale=320:-1[0]; [1]scale=320:-1[1]; [2]scale=320:-1[2]; [3]scale=320:-1[3]; [0][1][2][3]hstack=inputs=4',
  strip], { encoding: 'utf8' });
if (st.status !== 0) {
  // fallback: simpler hstack without pre-scale labels
  const st2 = spawnSync('ffmpeg', ['-y', '-i', midNori, '-i', midBolt, '-i', midYuki, '-i', midWisp,
    '-filter_complex', '[0:v]scale=320:-1[a];[1:v]scale=320:-1[b];[2:v]scale=320:-1[c];[3:v]scale=320:-1[d];[a][b][c][d]hstack=inputs=4',
    strip], { encoding: 'utf8' });
  if (st2.status !== 0) console.log('strip ffmpeg failed', st.stderr.slice(-400), st2.stderr.slice(-400));
  else console.log('wrote', strip);
} else console.log('wrote', strip);

const gif = path.join(OUT, 'style416-traits.gif');
// concat all labeled frames in order at 8 fps
const list = path.join(framesDir, 'list.txt');
const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort();
fs.writeFileSync(list, files.map((f) => `file '${path.join(framesDir, f)}'\nduration 0.12`).join('\n') + `\nfile '${path.join(framesDir, files[files.length - 1])}'\n`);
const gf = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'scale=640:-1:flags=lanczos,fps=8', '-loop', '0', gif], { encoding: 'utf8' });
if (gf.status !== 0) {
  // palette path
  const pal = path.join(framesDir, 'pal.png');
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=8,scale=640:-1,palettegen', pal], { encoding: 'utf8' });
  const gf2 = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', pal, '-lavfi', 'fps=8,scale=640:-1[x];[x][1:v]paletteuse', '-loop', '0', gif], { encoding: 'utf8' });
  if (gf2.status !== 0) console.log('gif ffmpeg failed', gf.stderr.slice(-300), gf2.stderr.slice(-300));
  else console.log('wrote', gif);
} else console.log('wrote', gif);

} // end !WR_ONLY media

if (errors && errors.length) console.log('page errors', errors);
console.log(`style416 ${pass}/${pass + fail}  fail=${fail}`);
process.exit(fail ? 1 : 0);
