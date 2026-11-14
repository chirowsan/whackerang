// LOCAL-dev-feel414: punchy but calm hits/catches — caps, toggles, no errors, frame time OK.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 500) : '')); };

const boot = async (url) => {
  const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
  await page.goto(url.startsWith('http') || url.startsWith('file:') ? url : 'file://' + url, { waitUntil: 'load' });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.feel))) break; await sleep(150); }
  await page.evaluate(() => {
    const S = __bg.S(); S.tutorialDone = true; S.coins = 5000;
    S.unlockedHeroes = __bg.HEROES.map((h) => h.id);
    S.settings.touch = 'on'; S.settings.events = 'off'; S.settings.a2hs = true; S.settings.quality = 'fast'; S.settings.speed = 'chill';
    S.settings.vibrate = true; S.settings.hitstop = true; S.settings.shake = true; S.settings.shakeLvl = 'full';
    S.setup.arena = 'dojo'; S.setup.size = 'small'; S.setup.bots = 1; S.setup.mode = 'classic';
    const a = document.getElementById('a2hs'); if (a) a.remove();
  });
  return { browser, page, errors };
};

const startMatch = async (page) => {
  await page.evaluate(() => {
    const S = __bg.S(); S.hero = 'bao'; S.settings.events = 'off';
    try { __bg.app.quitToMenu(); } catch (e) {}
    // Pin the rival to Pico so a random Salty bot cannot eat the test KO with Nine Lives.
    const hd = __bg.app.humanDef(0);
    const pico = __bg.HEROES.find((h) => h.id === 'pico');
    const bot = __bg.app.botDef(pico);
    __bg.app.match = { mode: 'classic', rulesMode: 'classic', players: [hd, bot], round: 0, need: 1, arena: 'dojo', size: 'small', traps: 'off', mutator: 'off', humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {} };
    __bg.app.nextRound(true);
    const g = __bg.app.game; __bg.app.paused = true;
    let k = 0; while (g && g.state !== 'play' && k++ < 4000) __bg.step(1);
    g.fighters.forEach((f) => {
      if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
      f.vx = 0; f.vz = 0; f.inv = 4;
    });
    if (g.booms) g.booms.length = 0;
    if (__bg.app.cdHide) __bg.app.cdHide();
    const el = document.getElementById('countdown'); if (el) { el.className = ''; el.style.display = 'none'; }
  });
  await sleep(30);
};

const { browser, page, errors } = await boot(HTML);
ok('booted with feel API', await page.evaluate(() => !!(__bg.feel && __bg.FEEL && __bg.setVibeImpl && __bg.clearFeelLog && __bg.shakePxAtCap)));

const nums = await page.evaluate(() => {
  const F = __bg.FEEL;
  return {
    traumaCap: F.TRAUMA_CAP, punchCap: F.PUNCH_CAP,
    hitStop: F.HITSTOP.hit, koStop: F.HITSTOP.ko,
    hitShake: F.SHAKE.hit, catchShake: F.SHAKE.catch, koShake: F.SHAKE.ko, throwShake: F.SHAKE.throw,
    px: __bg.shakePxAtCap(915, 24),
  };
});
ok('hit-stop is a few frames (40–70 ms hit, 80–120 ms KO)', nums.hitStop >= 0.04 && nums.hitStop <= 0.07 && nums.koStop >= 0.08 && nums.koStop <= 0.12, nums);
ok('shake amounts are calmer than the old 0.4 hit / 0.6 KO', nums.hitShake <= 0.25 && nums.koShake <= 0.35 && nums.catchShake <= 0.12, nums);
ok('peak camera travel at cap stays under ~16 px on a phone', nums.px > 0 && nums.px < 16, nums);

await startMatch(page);

const evs = await page.evaluate(() => {
  const vibes = [];
  __bg.setVibeImpl((p) => { vibes.push(p); });
  __bg.clearFeelLog();
  const g = __bg.app.game;
  const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  const o = g.fighters.find((f) => f !== me && f.alive) || g.fighters[1];
  me.x = 0; me.z = 0; me.face = 0; me.hp = me.maxHp; me.inv = 0; me.shield = false; me.ult = 100; me.ammo = 3;
  o.x = 0; o.z = 1.7; o.face = Math.PI; o.hp = Math.max(2, o.maxHp); o.inv = 0; o.shield = false; o.alive = true;
  g.resolve(me, 0.4); g.resolve(o, 0.4);

  const t0 = __bg.gfx.trauma;
  g.throwFrom(me, 0, 0, 0.5);
  const afterThrow = __bg.feelLog.slice();

  const boom = (g.booms || []).find((b) => b.alive && b.owner === me) || (g.booms || [])[0];
  if (boom && boom.caught) boom.caught();
  const afterCatch = __bg.feelLog.slice();

  o.die(me, 'boom', 0, -1);
  const afterHit = __bg.feelLog.slice();

  o.hp = 1; o.alive = true; o.inv = 0; o.nineUsed = true; o.shield = false; o.x = 0; o.z = 1.7;
  o.die(me, 'boom', 0, -1);
  const afterKo = __bg.feelLog.slice();

  me.ult = 100; g.useUlt(me);
  const afterSpecial = __bg.feelLog.slice();

  me.shield = true;
  __bg.feel('shield', { f: me, killer: o, game: g });
  __bg.feel('parry', { f: me, killer: o, game: g });
  __bg.feel('melee', { f: o, killer: me, game: g, force: true });

  // cap stacking: lots of hits must not blow past the trauma / punch caps
  __bg.gfx.trauma = 0; __bg.gfx.kx = 0; __bg.gfx.kz = 0;
  for (let i = 0; i < 12; i++) __bg.feel('hit', { f: o, killer: me, game: g, force: true });
  const cap = { trauma: +__bg.gfx.trauma.toFixed(4), punch: +Math.hypot(__bg.gfx.kx, __bg.gfx.kz).toFixed(4), T: __bg.FEEL.TRAUMA_CAP, P: __bg.FEEL.PUNCH_CAP };

  const kinds = __bg.feelLog.map((e) => e.kind);
  const by = {};
  for (const e of __bg.feelLog) by[e.kind] = e;
  return {
    kinds, vibes,
    throw: by.throw, catch: by.catch, hit: by.hit, ko: by.ko, special: by.special, shield: by.shield, parry: by.parry, melee: by.melee,
    catchPop: me.catchPop, squashCatch: me.squashSy, squashHitKind: (by.hit && by.hit.squash) || null,
    hitstopAtKo: g.hitstop, cap,
    trauma0: t0,
    nThrow: afterThrow.length, nCatch: afterCatch.length, nHit: afterHit.length, nKo: afterKo.length, nSpec: afterSpecial.length,
  };
});

ok('throw feel fires', evs.kinds.includes('throw') && evs.throw && evs.throw.shake > 0, evs.throw);
ok('catch feel fires with stretch squash and a clack sparkle path', evs.kinds.includes('catch') && evs.catch && evs.catch.squash && evs.catch.squash.sy > 1 && evs.catchPop > 0, { catch: evs.catch, pop: evs.catchPop, sy: evs.squashCatch });
ok('hit feel fires with squash, short hit-stop and a vibe', evs.kinds.includes('hit') && evs.hit.hitstop >= 0.04 && evs.hit.hitstop <= 0.07 && evs.hit.squash && evs.hit.vibe, evs.hit);
ok('KO feel fires with a stronger but still capped shake and ~100 ms hit-stop', evs.kinds.includes('ko') && evs.ko.hitstop >= 0.08 && evs.ko.hitstop <= 0.12 && evs.ko.shake <= 0.35, evs.ko);
ok('Special, shield, parry and melee all trigger feel', ['special', 'shield', 'parry', 'melee'].every((k) => evs.kinds.includes(k)), evs.kinds);
ok('trauma and punch stay at their caps when many hits stack', evs.cap.trauma <= evs.cap.T + 1e-6 && evs.cap.punch <= evs.cap.P + 1e-6, evs.cap);
ok('combat vibration patterns were recorded', evs.vibes.length >= 4, evs.vibes);

// toggles
const toggles = await page.evaluate(() => {
  const g = __bg.app.game;
  const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  const o = g.fighters.find((f) => f !== me) || me;
  const out = {};

  __bg.setVibeImpl((p) => { out._v = p; });
  const S = __bg.S();
  S.settings.vibrate = false;
  __bg.clearFeelLog(); out._v = null;
  __bg.feel('hit', { f: me, killer: o, game: g, force: true });
  out.vibeOff = { vibrated: __bg.lastFeel.vibrated, called: out._v != null };

  S.settings.vibrate = true;
  S.settings.shakeLvl = 'off'; S.settings.shake = false;
  const t0 = __bg.gfx.trauma;
  __bg.feel('ko', { f: o, killer: me, game: g, force: true });
  out.shakeOff = { added: +(__bg.gfx.trauma - t0).toFixed(4), shakeField: __bg.lastFeel.shake };

  S.settings.shakeLvl = 'full'; S.settings.shake = true;
  S.settings.hitstop = false;
  g.hitstop = 0;
  __bg.feel('hit', { f: o, killer: me, game: g, force: true });
  out.hitstopOff = { hs: g.hitstop, ev: __bg.lastFeel.hitstop };

  S.settings.hitstop = true;
  // prefers-reduced-motion: no shake / punch, squash is milder
  const realMM = window.matchMedia;
  window.matchMedia = (q) => ({ matches: String(q).includes('prefers-reduced-motion: reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
  __bg.gfx.trauma = 0; __bg.gfx.kx = 0; __bg.gfx.kz = 0;
  __bg.feel('hit', { f: o, killer: me, game: g, force: true });
  out.reduced = { trauma: __bg.gfx.trauma, punch: Math.hypot(__bg.gfx.kx, __bg.gfx.kz), reduced: __bg.lastFeel.reduced, sx: __bg.lastFeel.squash && __bg.lastFeel.squash.sx, fullSx: __bg.FEEL.SQUASH.hit.sx };
  window.matchMedia = realMM;

  // iPhone stand-in: no vibrate API → sparkle flag
  __bg.setVibeImpl(null);
  const nv = navigator.vibrate; try { navigator.vibrate = undefined; } catch (e) {}
  const cap = window.Capacitor; try { window.Capacitor = undefined; } catch (e) {}
  __bg.feel('catch', { f: me, game: g, force: true });
  out.ios = { sparkle: !!__bg.lastFeel.iosSparkle, vibrated: __bg.lastFeel.vibrated, can: __bg.canVibrate() };
  try { navigator.vibrate = nv; } catch (e) {}
  try { window.Capacitor = cap; } catch (e) {}
  S.settings.vibrate = true; S.settings.shakeLvl = 'full'; S.settings.hitstop = true;
  return out;
});
ok('Vibration toggle off blocks vibe', toggles.vibeOff && toggles.vibeOff.vibrated === false && toggles.vibeOff.called === false, toggles.vibeOff);
ok('Screen shake Off adds no trauma', toggles.shakeOff && toggles.shakeOff.added === 0, toggles.shakeOff);
ok('Hit-stop toggle off leaves the sim running', toggles.hitstopOff && toggles.hitstopOff.hs === 0 && toggles.hitstopOff.ev === 0, toggles.hitstopOff);
ok('prefers-reduced-motion turns shake off and softens squash', toggles.reduced && toggles.reduced.reduced === true && toggles.reduced.trauma === 0 && toggles.reduced.punch === 0 && toggles.reduced.sx < toggles.reduced.fullSx, toggles.reduced);
ok('iPhone without vibrate gets a tiny sparkle instead', toggles.ios && toggles.ios.sparkle === true && toggles.ios.vibrated === false, toggles.ios);

// volume is still respected (sfx path reads AU / settings — just confirm settings keys and no throw)
const vol = await page.evaluate(() => {
  const s = __bg.S().settings;
  return { sfx: s.sfx, master: s.master, mute: s.mute, vibrateDefault: s.vibrate };
});
ok('existing volume settings still present (sfx, master, mute)', vol.sfx != null && vol.master != null, vol);

// frame time: 45 stepped+rendered frames should stay reasonable on a phone-sized view
const perf = await page.evaluate(() => {
  __bg.resetProf();
  const times = [];
  for (let i = 0; i < 45; i++) {
    const t0 = performance.now();
    __bg.step(1);
    __bg.renderNow();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mid = times[Math.floor(times.length / 2)];
  const last = __bg.gfx.lastRender || 0;
  return { mid: +mid.toFixed(2), p90: +times[Math.floor(times.length * 0.9)].toFixed(2), last: +last.toFixed(2), n: times.length };
});
ok('frame time stays OK (median under 50 ms in this test harness)', perf.mid < 50 && perf.p90 < 90, perf);

const pageErrors = errors.filter((e) => !/favicon|AudioContext|user gesture|vibrate/i.test(String(e)));
ok('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5));

// Vibration toggle still in Settings
const settingsUi = await page.evaluate(() => {
  __bg.UI.show('settings');
  const labels = [...document.querySelectorAll('#panel label, #panel .row, #panel div, #panel span, #panel button')].map((e) => (e.childNodes[0] && e.childNodes[0].textContent) || e.textContent || '').map((s) => s.trim());
  const hasVibe = labels.some((s) => /^Vibration$/.test(s)) || !!document.body.innerText.match(/Vibration/);
  return { hasVibe, textHas: /Vibration/.test(document.body.innerText) };
});
ok('Settings still has a Vibration toggle (on by default)', settingsUi.hasVibe || settingsUi.textHas, settingsUi);

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
