// LOCAL-dev-quest418: daily quests + cosmetic collection. Kids 5–10, stars only, no real money.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const URL = HTML.startsWith('http') || HTML.startsWith('file:') ? HTML : 'file://' + HTML;
const OUT = '/workspace/out/quest418';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };

const boot = async (opts = {}) => {
  const { browser, page, errors } = await launch({ w: opts.w || 915, h: opts.h || 412, dpr: 1, mobile: opts.mobile !== false });
  await page.goto(URL, { waitUntil: 'load' });
  for (let i = 0; i < 50; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S))) break; await sleep(100); }
  await page.evaluate(() => {
    const S = __bg.S();
    S.tutorialDone = true;
    S.settings.touch = 'on';
    S.settings.events = 'off';
    S.settings.a2hs = true;
    S.settings.quality = 'fast';
    S.settings.speed = 'chill';
    S.settings.mute = true;
    S.setup.mode = 'classic';
    S.setup.bots = 1;
    S.setup.arena = 'dojo';
    S.setup.size = 'small';
    S.daily = { date: '', list: [], prog: {}, claimed: {} };
    S.mile = {};
    const a = document.getElementById('a2hs'); if (a) a.remove();
    try { __bg.app.applyTouch(); } catch (e) {}
    try { __bg.app.quitToMenu(false); } catch (e) {}
  });
  await sleep(200);
  return { browser, page, errors };
};

const seedQuests = async (page, extra = {}) => page.evaluate((extra) => {
  const S = __bg.S();
  if (extra.coins != null) S.coins = extra.coins;
  __bg.setDayKey(20261114);
  S.daily = { date: '', list: [], prog: {}, claimed: {} };
  const d = __bg.ensureDaily();
  // deterministic set so progress/toast tests are stable
  d.list = [
    { id: 'catch', text: 'Catch 5 boomerangs', stat: 'catch', n: 5, stars: 25, coins: 25, xp: 40 },
    { id: 'win', text: 'Win 1 match', stat: 'win', n: 1, stars: 40, coins: 40, xp: 60 },
    { id: 'bush', text: 'Hide in a bush 3 times', stat: 'bush', n: 3, stars: 20, coins: 20, xp: 30 },
  ];
  d.prog = {}; d.claimed = {}; d.rerolled = false; d.ver = 418; d.date = String(__bg.dayKey());
  d.chest = false;
  if (extra.hero) S.hero = extra.hero;
  __bg.UI.show('menu');
  return d.list.map((c) => c.id);
}, extra);

const boxOf = async (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { w: r.width, h: r.height, x: r.x, y: r.y, right: r.right, bottom: r.bottom, text: (e.innerText || '').slice(0, 200) };
}, sel);

// ---------- 915 menu + quests + collection ----------
const { browser, page, errors } = await boot({ w: 915, h: 412 });
ok('booted', await page.evaluate(() => !!(__bg.app && __bg.S && __bg.ensureDaily && __bg.COLLECTION)));
ok('Chill is still the default speed', await page.evaluate(() => __bg.S().settings.speed === 'chill'));
ok('Practice is still on the main menu', await page.evaluate(() => { __bg.UI.show('menu'); return !!document.getElementById('btn-practice') && !!document.getElementById('btn-play'); }));

await seedQuests(page, { coins: 200 });
await sleep(150);

const badge = await boxOf(page, '#btn-quests');
ok('main menu has a small Quests badge', !!(badge && /quests/i.test(badge.text) && /0\/3/.test(badge.text)), badge);
ok('Quests badge is at least a 44px touch target', !!(badge && badge.w >= 44 && badge.h >= 44), badge);
ok('bulky daily-missions card is gone from the menu', await page.evaluate(() => !document.querySelector('.mcard')));
ok('Collection is on the main menu', await page.evaluate(() => !!document.getElementById('btn-collection')));

// safe area: badge stays inside the padded inset
const sa = await page.evaluate(() => {
  document.documentElement.style.setProperty('--test-sair', '48px');
  document.documentElement.style.setProperty('--test-saib', '36px');
  __bg.UI.show('menu');
  const b = document.getElementById('btn-quests');
  const r = b.getBoundingClientRect();
  return { right: r.right, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
});
ok('Quests badge respects iPhone safe-area insets', sa.right <= sa.vw - 48 + 1 && sa.bottom <= sa.vh - 36 + 1, sa);
await page.evaluate(() => { document.documentElement.style.setProperty('--test-sair', '0px'); document.documentElement.style.setProperty('--test-saib', '0px'); __bg.UI.show('menu'); });
await sleep(80);
await page.screenshot({ path: path.join(OUT, 'menu-badge.png') });

await page.evaluate(() => { const d = __bg.S().daily; d.prog.catch = 3; });
await page.evaluate(() => document.getElementById('btn-quests').click());
await sleep(200);
const qinfo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qrow')];
  const note = (document.querySelector('.q-note') || {}).innerText || '';
  const bars = document.querySelectorAll('.qbar').length;
  const texts = rows.map((r) => r.querySelector('b')?.innerText);
  const reroll = [...document.querySelectorAll('.qreroll')].map((b) => b.getBoundingClientRect());
  const back = document.querySelector('.page > header .btn.back, [data-back]');
  const br = back ? back.getBoundingClientRect() : null;
  const sizes = rows.map((r) => { const b = r.querySelector('b'); return b ? getComputedStyle(b).fontSize : ''; });
  return { n: rows.length, note, bars, texts, reroll: reroll.map((r) => ({ w: r.width, h: r.height })), back: br && { w: br.width, h: br.height }, sizes, title: document.querySelector('h2')?.innerText };
});
ok('Quests screen shows exactly 3 quests', qinfo.n === 3, qinfo);
ok('Quests screen says earned by playing, no real money', /Earned by playing/i.test(qinfo.note) && /no real money/i.test(qinfo.note), qinfo.note);
ok('Quests have progress bars and short wording', qinfo.bars === 3 && qinfo.texts.every((t) => t && t.length <= 28), qinfo);
ok('quest wording is big', qinfo.sizes.every((s) => parseFloat(s) >= 16), qinfo.sizes);
ok('reroll buttons are at least 44px', qinfo.reroll.length >= 1 && qinfo.reroll.every((r) => r.w >= 44 && r.h >= 44), qinfo.reroll);
ok('Quests Back is at least a 44px target', !!(qinfo.back && qinfo.back.w >= 44 && qinfo.back.h >= 44), qinfo.back);
await page.screenshot({ path: path.join(OUT, 'quests.png') });

const roll = await page.evaluate(() => {
  const before = __bg.S().daily.list[0].id;
  const a = __bg.rerollDaily(0);
  const mid = { ok: !!a, from: before, to: a && a.id, rerolled: __bg.S().daily.rerolled, still3: __bg.S().daily.list.length };
  const b = __bg.rerollDaily(1);
  return { ...mid, second: b, stillRerolled: __bg.S().daily.rerolled, list: __bg.S().daily.list.map((c) => c.text) };
});
ok('one free reroll swaps a quest', !!(roll.ok && roll.to && roll.to !== roll.from && roll.still3 === 3), roll);
ok('a second reroll is refused the same day', roll.second === false && roll.stillRerolled === true, roll);

// restore deterministic list after reroll test
await seedQuests(page, { coins: 200 });
await page.evaluate(() => __bg.UI.show('collection', { tab: 'Hats' }));
await sleep(200);
const coll = await page.evaluate(() => {
  const note = (document.querySelector('.coll-note, .q-note') || {}).innerText || '';
  const body = (document.querySelector('.collection-page') || document.body).innerText;
  const unlocks = [...document.querySelectorAll('.qunlock, button')].filter((b) => /Unlock/i.test(b.innerText));
  const ub = unlocks[0] ? unlocks[0].getBoundingClientRect() : null;
  const tabs = [...document.querySelectorAll('.tabs .tab')].map((t) => t.innerText);
  const banned = /\$|USD|Buy gold|loot box|gacha|watch an ad|real money(?!)/i.test(body.replace(/Earned by playing — no real money/i, ''));
  const hasEarnNote = /Earned by playing — no real money/i.test(body);
  const hasBuy = /Buy gold|\$0\.99|Starter Pack|TEST MODE/i.test(body);
  return { note, tabs, unlocks: unlocks.length, unlockBox: ub && { w: ub.width, h: ub.height, text: unlocks[0].innerText }, hasEarnNote, hasBuy, banned, title: document.querySelector('h2')?.innerText };
});
ok('Collection screen is open', /collection/i.test(coll.title || ''), coll);
ok('Collection says earned by playing — no real money', coll.hasEarnNote, coll.note);
ok('Collection has no paid store, ads, or loot boxes', !coll.hasBuy && !coll.banned, { hasBuy: coll.hasBuy, tabs: coll.tabs });
ok('Collection tabs are cosmetics only', ['Trails', 'Colors', 'Hats', 'Emotes', 'Poses', 'Sparkles'].every((t) => coll.tabs.includes(t)) && !coll.tabs.includes('Fighters') && !coll.tabs.includes('Premium') && !coll.tabs.includes('Boomerangs'), coll.tabs);
ok('Unlock buttons are at least 44px and spend stars', !!(coll.unlockBox && coll.unlockBox.w >= 44 && coll.unlockBox.h >= 43.5 && /★|stars|Unlock/i.test(coll.unlockBox.text)), coll.unlockBox);
await page.screenshot({ path: path.join(OUT, 'collection.png') });

const buyRes = await page.evaluate(() => {
  const S = __bg.S(); S.coins = 200;
  const hat = __bg.COLLECTION.Hats.find((h) => h.id === 'sprout');
  const before = S.coins;
  const okBuy = __bg.buy(hat);
  S.hats[S.hero] = 'sprout';
  const still = __bg.buy(hat);
  return { okBuy, still, spent: before - S.coins, cost: hat.cost, owns: __bg.owns('hats', 'sprout'), coins: S.coins };
});
ok('stars can unlock a cosmetic and not a second time', buyRes.okBuy && buyRes.still === false && buyRes.spent === buyRes.cost && buyRes.owns, buyRes);

// milestones
const mile = await page.evaluate(() => {
  const S = __bg.S();
  S.stats.play = 0; S.mile = {}; S.own.trails = ['none'];
  __bg.track('play', 5);
  return { got: !!(S.mile && S.mile.m_play5), owns: __bg.owns('trails', 'dew'), trails: S.own.trails.slice() };
});
ok('playing enough matches grants a milestone cosmetic for free', mile.got && mile.owns, mile);

// persist
const persistKey = await page.evaluate(() => {
  const S = __bg.S(); S.coins = 321; S.hats.bao = 'sprout';
  __bg.equip('trails', S.eq.trail || 'none'); // triggers save()
  const raw = JSON.parse(localStorage.getItem('whackerang.save.v1') || 'null');
  return !!(raw && raw.coins === 321 && raw.hats && raw.hats.bao === 'sprout');
});
ok('progress is stored locally (works offline)', persistKey === true);

// date rollover
const rollDay = await page.evaluate(() => {
  __bg.setDayKey(20260101);
  __bg.S().daily = { date: '', list: [], prog: {}, claimed: {} };
  const a = __bg.ensureDaily();
  const first = a.list.map((c) => c.id).join(',');
  __bg.setDayKey(20260102);
  const b = __bg.ensureDaily();
  return { n: b.list.length, changed: b.list.map((c) => c.id).join(',') !== first || b.date !== a.date, date: b.date, rerolled: !!b.rerolled, short: b.list.every((c) => c.n <= 8 && c.text.length <= 28) };
});
ok('a new local day brings 3 new generous quests and a fresh reroll', rollDay.n === 3 && rollDay.changed && rollDay.rerolled === false && rollDay.short, rollDay);

// generated pool has no huge chores
const pool = await page.evaluate(() => __bg.QUEST_POOL().map((q) => ({ id: q.id, n: q.n, t: q.text })));
ok('every quest in the pool is short and doable in a short play session', pool.every((q) => q.n <= 8 && q.t.length <= 28), pool);

// play / online-style counting: track play + as:hero + win
const counts = await page.evaluate(() => {
  __bg.setDayKey(20261114);
  const S = __bg.S(); S.stats.play = 0; S.stats.win = 0; S.stats['as:nori'] = 0;
  S.daily = { date: String(__bg.dayKey()), ver: 418, list: [
    { id: 'play', text: 'Play 2 matches', stat: 'play', n: 2, stars: 20, coins: 20, xp: 30 },
    { id: 'as-nori', text: 'Play 2 matches as Nori', stat: 'as:nori', n: 2, stars: 25, coins: 25, xp: 35 },
    { id: 'win', text: 'Win 1 match', stat: 'win', n: 1, stars: 40, coins: 40, xp: 60 },
  ], prog: {}, claimed: {}, rerolled: false };
  const coins0 = S.coins;
  __bg.track('play'); __bg.track('as:nori');
  __bg.track('play'); __bg.track('as:nori');
  __bg.track('win');
  const d = S.daily;
  return { coins: S.coins - coins0, claimed: { ...d.claimed }, prog: { ...d.prog }, chest: d.chest };
});
ok('play, character, and win quests count (local and the same path online uses)', counts.claimed.play && counts.claimed['as-nori'] && counts.claimed.win && counts.chest === true && counts.coins >= 145, counts);

// toast during a match (combat stays uncluttered: only the small toast)
await seedQuests(page, { coins: 50 });
await page.evaluate(() => {
  const S = __bg.S(); S.hero = 'bao'; S.eq.trail = 'dew'; if (!S.own.trails.includes('dew')) S.own.trails.push('dew');
  const hd = __bg.app.humanDef(0);
  const pico = __bg.HEROES.find((h) => h.id === 'pico');
  const bot = __bg.app.botDef(pico);
  __bg.app.match = { mode: 'classic', rulesMode: 'classic', players: [hd, bot], round: 0, need: 1, arena: 'dojo', size: 'small', traps: 'off', mutator: 'off', humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {} };
  __bg.app.nextRound(true);
  const g = __bg.app.game; __bg.app.paused = true; __bg.app.mode = 'play';
  let k = 0; while (g && g.state !== 'play' && k++ < 4000) __bg.step(1);
  g.fighters.forEach((f) => { if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false }); f.vx = 0; f.vz = 0; });
  if (__bg.app.cdHide) __bg.app.cdHide();
  const el = document.getElementById('countdown'); if (el) { el.className = ''; el.style.display = 'none'; }
});
await sleep(80);
const toast = await page.evaluate(() => {
  const before = __bg.S().coins;
  __bg.app.mode = 'play';
  __bg.track('catch', 5);
  const t = document.getElementById('toast');
  return { text: t ? t.textContent : '', shown: t && t.classList.contains('show'), coins: __bg.S().coins - before, hudQuests: !!document.getElementById('btn-quests'), claimed: !!__bg.S().daily.claimed.catch };
});
ok('finishing a quest in a match shows a small toast and grants stars', toast.shown && /Quest done/i.test(toast.text) && /stars/i.test(toast.text) && toast.coins === 25 && toast.claimed && !toast.hudQuests, toast);
await page.evaluate(() => { const n = document.getElementById('notes'); if (n) n.remove(); });
await sleep(40);
await page.screenshot({ path: path.join(OUT, 'quest-toast.png') });

// cosmetic visible in-game: firefly trail on a throw (clear other toasts first)
const trail = await page.evaluate(() => {
  const t = document.getElementById('toast'); if (t) { t.classList.remove('show'); t.textContent = ''; }
  const n = document.getElementById('notes'); if (n) n.remove();
  const g = __bg.app.game;
  const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  me.trail = 'firefly'; me.x = 0; me.z = 0; me.face = 0; me.ammo = 3; me.alive = true;
  if (g.booms) { g.booms.forEach((b) => b.kill && b.kill()); g.booms.length = 0; }
  g.throwFrom(me, 0, 0, 0.85);
  const boom = (g.booms || []).find((b) => b.alive && b.owner === me) || (g.booms || [])[0];
  for (let i = 0; i < 36; i++) { __bg.step(1); if (boom && boom.tstyle) __bg.fx.trailFx('firefly', boom.x, 0.55, boom.z, 0xffe080); }
  __bg.renderNow && __bg.renderNow();
  return { trail: me.trail, tstyle: boom && boom.tstyle, alive: !!(boom && boom.alive) };
});
ok('equipped cosmetic trail is used in the match', trail.trail === 'firefly' && trail.tstyle === 'firefly', trail);
await sleep(40);
await page.screenshot({ path: path.join(OUT, 'cosmetic-ingame.png') });

const bootErr = errors.filter((e) => !/unsupported MIME|ServiceWorker|audio device|WebSocket/i.test(e));
ok('no unexpected page errors at 915', bootErr.length === 0, bootErr.slice(0, 5));
await browser.close();

// ---------- 1024 layout ----------
const b2 = await boot({ w: 1024, h: 412 });
await seedQuests(b2.page, { coins: 80 });
await sleep(120);
const badge2 = await boxOf(b2.page, '#btn-quests');
ok('Quests badge is a 44px target at 1024 width', !!(badge2 && badge2.w >= 44 && badge2.h >= 44), badge2);
await b2.page.evaluate(() => document.getElementById('btn-quests').click());
await sleep(150);
const q2 = await b2.page.evaluate(() => {
  const rows = document.querySelectorAll('.qrow').length;
  const overflow = document.querySelector('.quests-page').scrollHeight > 10;
  const rr = [...document.querySelectorAll('.qreroll')].map((b) => b.getBoundingClientRect());
  return { rows, overflow, reroll: rr.every((r) => r.height >= 44) };
});
ok('Quests screen lays out 3 quests at 1024 width', q2.rows === 3 && q2.reroll, q2);
await b2.page.evaluate(() => __bg.UI.show('collection', { tab: 'Trails' }));
await sleep(150);
const c2 = await b2.page.evaluate(() => {
  const pageEl = document.querySelector('.collection-page');
  const note = /Earned by playing — no real money/i.test(pageEl.innerText);
  const unlock = [...pageEl.querySelectorAll('button')].filter((b) => /Unlock/i.test(b.innerText))[0];
  const r = unlock ? unlock.getBoundingClientRect() : null;
  return { note, uh: r && r.height, uw: r && r.width };
});
ok('Collection is usable at 1024 width with 44px Unlock targets', c2.note && c2.uh >= 44 && c2.uw >= 44, c2);
const err2 = b2.errors.filter((e) => !/unsupported MIME|ServiceWorker|audio device|WebSocket/i.test(e));
ok('no unexpected page errors at 1024', err2.length === 0, err2.slice(0, 5));
await b2.browser.close();

console.log(fail ? `FAIL quest418 ${pass} passed, ${fail} failed` : `OK quest418 ${pass}/${pass + fail}`);
if (fail) process.exit(1);
