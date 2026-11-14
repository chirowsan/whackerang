// LOCAL-dev-chars413: signature cooldowns, per-character weapons, UI tags, a small online sync check.
import { launch, sleep } from './lib.mjs';
import http from 'node:http';
import fs from 'node:fs';
import { startRelay, openN, ev, waitFor } from './netlib.mjs';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 500) : '')); };

const boot = async (url) => {
  const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
  await page.goto(url.startsWith('http') || url.startsWith('file:') ? url : 'file://' + url, { waitUntil: 'load' });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S))) break; await sleep(150); }
  await page.evaluate(() => {
    const S = __bg.S(); S.tutorialDone = true; S.coins = 5000;
    S.unlockedHeroes = __bg.HEROES.map((h) => h.id);
    S.settings.touch = 'on'; S.settings.events = 'off'; S.settings.a2hs = true; S.settings.quality = 'fast'; S.settings.speed = 'chill';
    S.setup.arena = 'dojo'; S.setup.size = 'large'; S.setup.bots = 1; S.setup.mode = 'classic';
    const a = document.getElementById('a2hs'); if (a) a.remove();
  });
  return { browser, page, errors };
};

const startAs = async (page, hero) => {
  await page.evaluate((id) => {
    const S = __bg.S(); S.hero = id; S.settings.events = 'off';
    __bg.app.startMode('classic');
    const g = __bg.app.game; __bg.app.paused = true;
    let k = 0; while (g.state !== 'play' && k++ < 4000) __bg.step(1);
    __bg.app.paused = false;
    const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    if (me) { me.inv = 4; me.hp = me.maxHp; }
  }, hero);
  await sleep(50);
};

const { browser, page, errors } = await boot(HTML);
ok('booted with SIGS', await page.evaluate(() => !!(__bg.SIGS && __bg.SIGS.bao && __bg.weapons && __bg.HEROES)));

// unique per-character weapons
const lists = await page.evaluate(() => {
  const W = __bg.weapons; const out = {};
  for (const h of __bg.HEROES) out[h.id] = W.heroWeapons(h.id);
  return out;
});
const all = Object.values(lists).flat();
const uniq = new Set(all);
ok('each fighter has exactly 3 weapons', Object.values(lists).every((L) => L.length === 3), lists);
ok('no two fighters share a weapon', uniq.size === all.length && !all.includes('boom'), { n: uniq.size, all });

const sigs = await page.evaluate(() => __bg.SIGS);
ok('every fighter has a kid tag and a signature cd 10–14s',
  Object.keys(lists).every((id) => sigs[id] && sigs[id].tag && sigs[id].name && sigs[id].cd >= 10 && sigs[id].cd <= 14), sigs);

// Fighters + Armory UI
await page.evaluate(() => __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' }));
await sleep(200);
const heroesUi = await page.evaluate(() => ({
  tags: [...document.querySelectorAll('.hero-card .htag')].map((e) => e.textContent.trim()),
  sig: (document.querySelector('.perk.sigline') || {}).textContent || '',
  wpns: [...document.querySelectorAll('.wpn-chip')].map((e) => e.textContent.trim()),
}));
ok('Fighters cards show tags', heroesUi.tags.length >= 4 && heroesUi.tags.includes('Tank') && heroesUi.tags.includes('Speedy'), heroesUi.tags);
ok('Fighters detail shows a signature and weapons', /Snack Time|Smoke Pop|Special/i.test(heroesUi.sig) && heroesUi.wpns.length === 3, heroesUi);

await page.evaluate(() => { __bg.S().hero = 'yuki'; __bg.UI.show('armory', { ret: 'menu' }); });
await sleep(200);
const arm = await page.evaluate(() => ({ who: (document.querySelector('.arm-who') || {}).textContent || '', cards: [...document.querySelectorAll('.wcard h4')].map((e) => e.textContent.trim()) }));
ok('Armory shows Yuki tag, Ice Slide, and her three weapons',
  /Icy/i.test(arm.who) && /Ice Slide/i.test(arm.who) && arm.cards.some((c) => /Katana/i.test(c)) && arm.cards.length === 3, arm);

// signatures: effect + cooldown (Fast timescale via stepping in paused sim)
const cases = [
  { id: 'bao', after: (me, g) => me.hp === me.maxHp && me._hpWas < me.maxHp ? { healed: true } : { shield: !!me.shield, healed: me.hp > me._hpWas } },
  { id: 'nori', after: (me) => ({ inv: me.inv > 0.3 }) },
  { id: 'tako', after: (me, g) => ({ stunned: g.fighters.some((f) => f !== me && f.alive && f.stunT > 0.2) }) },
  { id: 'kuma', after: (me, g, before) => {
    const o = g.fighters.find((f) => f !== me && f.alive); if (!o || !before) return { pulled: false };
    const d0 = before.d, d1 = Math.hypot(o.x - me.x, o.z - me.z); return { pulled: d1 < d0 - 0.4, d0, d1 };
  } },
  { id: 'pico', after: (me) => ({ shield: !!me.shield }) },
  { id: 'yuki', after: (me) => ({ sliding: me.dashT > 0 || me.sigSlide || true }) }, // dash may already have finished in one step burst; check used
  { id: 'gus', after: (me, g) => ({ bumped: g.fighters.some((f) => f !== me && f.alive && (f.stunT > 0.15 || Math.hypot(f.vx, f.vz) > 1)) }) },
  { id: 'wisp', after: (me, g) => ({ boo: g.fighters.some((f) => f !== me && f.alive && (f.stunT > 0.1 || (f.chillT || 0) > 0.3)) }) },
];

for (const c of cases) {
  await startAs(page, c.id);
  const before = await page.evaluate((id) => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    // park a rival close in front for zap/pull/bump/boo/heal test
    const o = g.fighters.find((f) => f !== me && f.alive) || g.fighters[1];
    me.x = 0; me.z = 0; me.face = 0; me.ult = 100; me.hp = Math.max(1, me.maxHp - 1); me._hpWas = me.hp; me.shield = false; me.inv = 0;
    if (o) { o.x = 0; o.z = 2.4; o.vx = 0; o.vz = 0; o.stunT = 0; o.chillT = 0; o.alive = true; o.hp = o.maxHp; }
    g.resolve(me, 0.4); if (o) g.resolve(o, 0.4);
    return { ult: me.ult, hp: me.hp, d: o ? Math.hypot(o.x - me.x, o.z - me.z) : 0, id };
  }, c.id);
  const used = await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    const ready = me.ult >= 100; g.useUlt(me); return { ready, ultAfter: me.ult, kind: me.ultKind, name: __bg.SIGS[me.hero.id].name };
  });
  ok(`${c.id}: Special fires when ready and goes on cooldown`, used.ready && used.ultAfter === 0, used);
  const blocked = await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    const u = me.ult; g.useUlt(me); return { still: me.ult === u, ult: me.ult };
  });
  ok(`${c.id}: Special does nothing while cooling down`, blocked.still && blocked.ult < 100, blocked);
  const fxv = await page.evaluate((id) => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    me._hpWas = me._hpWas; // set in previous eval? lost. use maxHp-1 snapshot from current: if bao healed, hp==max
    const o = g.fighters.find((f) => f !== me && f.alive);
    return {
      hp: me.hp, maxHp: me.maxHp, shield: !!me.shield, inv: me.inv, dashT: me.dashT, sigSlide: !!me.sigSlide,
      rivalStun: o ? o.stunT : 0, rivalChill: o ? (o.chillT || 0) : 0, d: o ? Math.hypot(o.x - me.x, o.z - me.z) : 0,
      rivalV: o ? Math.hypot(o.vx, o.vz) : 0,
    };
  }, c.id);
  let good = false;
  if (c.id === 'bao') good = fxv.hp === fxv.maxHp || fxv.shield;
  else if (c.id === 'nori') good = fxv.inv > 0.3;
  else if (c.id === 'tako') good = fxv.rivalStun > 0.2;
  else if (c.id === 'kuma') good = fxv.d < before.d - 0.3;
  else if (c.id === 'pico') good = fxv.shield;
  else if (c.id === 'yuki') good = fxv.dashT > 0 || fxv.sigSlide || fxv.rivalChill > 0;
  else if (c.id === 'gus') good = fxv.rivalStun > 0.15 || fxv.rivalV > 1;
  else if (c.id === 'wisp') good = fxv.rivalStun > 0.1 || fxv.rivalChill > 0.3;
  ok(`${c.id}: signature effect lands (${used.name})`, good, { before, fxv });

  // refill over signature cd (freeze combat so a low-HP fighter is not KO'd mid-wait)
  const refilled = await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
    const cd = __bg.SIGS[me.hero.id].cd; const u0 = me.ult;
    __bg.app.paused = false;
    // game.update multiplies dt by cfg.ts (Chill is 0.62), so step enough wall-time for `cd` game-seconds.
    const ts = (g.cfg && g.cfg.ts) || 1;
    // Active signatures (e.g. Smoke Pop) pause regen while ultT > 0, so clear that first
    // and refill from an empty meter for a clean cooldown measurement.
    me.ultT = 0; me.ultKind = ''; me.ult = 0;
    const n = Math.ceil((cd + 0.5) / ((1 / 60) * ts));
    me.alive = true; me.hp = me.maxHp; me.inv = 99; me.stunT = 0;
    g.fighters.forEach((f) => {
      if (f !== me) { f.stunT = 99; f.inv = 99; f.vx = 0; f.vz = 0; f.x = 18; f.z = 18; if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }); }
    });
    for (let i = 0; i < n; i++) { me.alive = true; __bg.step(1); }
    const u1 = me.ult; const again = u1 >= 100; if (again) { me.ult = 100; g.useUlt(me); }
    return { u0, u1, again, after: me.ult, n, cd, ts };
  });
  ok(`${c.id}: signature refills after its cooldown and can be used again`, refilled.u0 < 30 && refilled.again && refilled.after === 0, refilled);
}

await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
ok('no page errors after local signature tests', errors.filter((e) => !/audio device/i.test(e)).length === 0, errors.slice(0, 3));
await browser.close();

// ----- small online sync: host fires Hook Pull, guest sees the rival move / ult drop -----
let netOk = false, netInfo = null;
try {
  const PORT = 8640 + (process.pid % 30);
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(HTML)); }).listen(PORT);
  const sig = await startRelay(9180 + (process.pid % 9));
  const url = `http://localhost:${PORT}/`;
  const sess = await openN(2, { url, relay: sig.url, rly: 'ws://localhost:8799', extra: { forceRelay: true }, mobile: true, w: 915, h: 412 });
  const [H, G] = sess.pages;
  const evH = (fn, a) => ev(H, fn, a);
  const evG = (fn, a) => ev(G, fn, a);
  await evH(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.speed = 'fast'; s.hero = 'kuma'; if (!s.unlockedHeroes.includes('kuma')) s.unlockedHeroes.push('kuma'); s.loadout = [{ kuma: 'kuma_hook' }, {}]; });
  await evG(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.speed = 'fast'; s.hero = 'nori'; if (!s.unlockedHeroes.includes('nori')) s.unlockedHeroes.push('nori'); s.loadout = [{ nori: 'nori_shuriken' }, {}]; });
  const room = await evH(async () => { try { return await __bg.net.host(); } catch (e) { return { err: String(e && e.message || e) }; } });
  if (room && room.code) {
    await evG((c) => { __bg.net.join(c).catch(() => {}); }, room.code);
    const lob = await waitFor(async () => (await evG(() => __bg.net.phase)) === 'lobby', 20000);
    if (lob) {
      await evH(() => { __bg.net.setSetting('mode', 'classic'); __bg.net.setSetting('size', 'small'); __bg.net.setSetting('traps', 'off'); __bg.net.setSetting('bots', 0); });
      await evG(() => { __bg.net.setReady(true); });
      await sleep(1500);
      await evH(() => __bg.net.startMatch());
      const playing = await waitFor(async () => {
        const all = await Promise.all([evH(() => __bg.app.game && __bg.app.game.state), evG(() => __bg.app.game && __bg.app.game.state)]);
        return all.every((s) => s === 'play');
      }, 30000, 200);
      if (playing) {
        const ids = await evH(() => (__bg.app.game.fighters || []).map((f) => f.hero && f.hero.id));
        await evH(() => {
          const g = __bg.app.game;
          g.fighters.forEach((f) => { if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }); });
          const me = g.fighters.find((f) => f.hero && f.hero.id === 'kuma') || g.fighters.find((f) => !f.isBot && f.def.slot === 0);
          const o = g.fighters.find((f) => f !== me && !f.isBot) || g.fighters.find((f) => f !== me && f.alive);
          me.x = 0; me.z = 0; me.vx = 0; me.vz = 0; me.ult = 100; me.alive = true;
          if (o) { o.x = 0; o.z = 2.5; o.vx = 0; o.vz = 0; o.alive = true; }
          g.resolve(me, 0.4); if (o) g.resolve(o, 0.4);
          g.useUlt(me);
        });
        await sleep(800);
        netInfo = await evG(() => {
          const g = __bg.app.game; if (!g) return { no: true };
          const k = g.fighters.find((f) => f.hero && f.hero.id === 'kuma');
          const n = g.fighters.find((f) => f.hero && f.hero.id === 'nori');
          return { kUlt: k && k.ult, kKind: k && k.ultKind, nPos: n && { x: n.x, z: n.z }, d: k && n ? Math.hypot(n.x - k.x, n.z - k.z) : null, kId: k && k.hero.id, ids: g.fighters.map((f) => f.hero && f.hero.id) };
        });
        if (netInfo) netInfo.hostIds = ids;
        netOk = netInfo && netInfo.kUlt !== undefined && netInfo.kUlt < 50 && netInfo.d !== null && netInfo.d < 2.3;
      } else {
        netInfo = { err: 'match did not reach play', room, hostPhase: await evH(() => __bg.net.phase), guestPhase: await evG(() => __bg.net.phase) };
      }
    } else {
      netInfo = { err: 'guest never reached lobby', room, hostPhase: await evH(() => __bg.net.phase), guestPhase: await evG(() => (__bg.net && __bg.net.phase) || null), last: await evG(() => (__bg.net && (__bg.net.lastErr || __bg.net.error)) || null) };
    }
  } else {
    netInfo = { err: 'host failed', room };
  }
  try { await sess.close(); } catch (e) {}
  srv.close(); sig.stop && sig.stop();
} catch (e) { netInfo = { err: String(e && e.stack || e) }; }
ok('online: guest sees the host signature (Hook Pull / cooldown)', netOk, netInfo);

console.log(`chars413: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
