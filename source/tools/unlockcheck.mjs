// v4.13.0 check: Bramble + Cedar Creek are free; pay421 must be absent; gold locks remain; Chill/Auto/Easy stay the defaults.
import { launch, sleep } from './lib.mjs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const url = HTML.startsWith('file:') || HTML.startsWith('http') ? HTML : 'file://' + HTML;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };

const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
await page.goto(url, { waitUntil: 'load' });
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.UI))) break; await sleep(100); }

const meta = await page.evaluate(() => {
  const S = __bg.S();
  const heroes = __bg.HEROES.map((h) => ({ id: h.id, name: h.name, cost: h.cost }));
  const arenas = __bg.ARENAS.map((a) => ({ id: a.id, name: a.name }));
  const html = document.documentElement.innerText || '';
  return {
    build: (typeof __BUILD__ !== 'undefined' ? __BUILD__ : (window.__BUILD__ || null)),
    store: typeof __bg.STORE === 'boolean' ? __bg.STORE : undefined,
    heroCount: heroes.length,
    heroes,
    unlocked: (S.unlockedHeroes || []).slice(),
    arenas,
    arenaIds: arenas.map((a) => a.id),
    speed: S.settings.speed,
    battery: S.settings.battery,
    diff: S.setup.diff,
    textHasFullGame: /Unlock Full Game|Restore Purchases|\$2\.99|full_unlock/i.test(html + document.body.innerHTML),
    payHook: !!localStorage.getItem('whackerang.pay.test'),
  };
});

ok('build tag is present or a v4.13 dev build', !meta.build || /v4\.13|dev|v1\.0/i.test(String(meta.build)), meta.build);
ok('STORE flag is off (no IAP / pay421)', meta.store === false || meta.store === undefined, meta.store);
ok('no Full Game / Restore Purchases / $2.99 copy in the first screen', !meta.textHasFullGame && !meta.payHook, { textHasFullGame: meta.textHasFullGame, payHook: meta.payHook });
ok('ten fighters in the roster including Puff and Bramble', meta.heroCount === 10 && meta.heroes.some((h) => h.id === 'puff') && meta.heroes.some((h) => h.id === 'bram'), meta.heroes.map((h) => h.id));
const puff = meta.heroes.find((h) => h.id === 'puff');
const bram = meta.heroes.find((h) => h.id === 'bram');
const freeIds = ['bao', 'nori', 'tako', 'kuma', 'puff', 'bram'];
const goldIds = ['pico', 'yuki', 'gus', 'wisp'];
ok('Puff and Bramble cost 0 gold', puff && bram && (puff.cost === 0 || puff.cost == null) && (bram.cost === 0 || bram.cost == null), { puff, bram });
ok('new-player unlocked list includes the free six and not the gold four',
  freeIds.every((id) => meta.unlocked.includes(id)) && goldIds.every((id) => !meta.unlocked.includes(id)),
  { unlocked: meta.unlocked });
ok('Pico, Yuki, Gus, and Wisp still have a gold cost',
  goldIds.every((id) => { const h = meta.heroes.find((x) => x.id === id); return h && h.cost > 0; }),
  meta.heroes.filter((h) => goldIds.includes(h.id)));
ok('Lotus Pond and Cedar Creek are in the arena list', meta.arenaIds.includes('pond') && meta.arenaIds.includes('creek'), meta.arenas);
ok('saved default game speed is Chill', meta.speed === 'chill', meta.speed);
ok('Battery saver default is Auto', meta.battery === 'auto', meta.battery);
ok('new-player default bot skill is Easy (0)', meta.diff === 0 || meta.diff === 'easy', meta.diff);

await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' }); });
await sleep(400);
const heroUi = await page.evaluate(() => {
  const text = document.getElementById('ui')?.innerText || '';
  const html = document.getElementById('ui')?.innerHTML || '';
  const goldLocked = ['Pico', 'Yuki', 'Gus', 'Wisp'].filter((n) => new RegExp(n + '[\\s\\S]{0,160}🔒', 'i').test(text));
  return {
    text,
    hasPuff: /Puff/i.test(text),
    hasBram: /Bramble/i.test(text),
    hasFullGame: /Unlock Full Game|Restore Purchases|\$2\.99/i.test(text + html),
    puffLocked: /Puff[\s\S]{0,200}🔒/i.test(text),
    bramLocked: /Bramble[\s\S]{0,200}🔒/i.test(text),
    goldLocked,
  };
});
ok('character select lists Puff and Bramble', heroUi.hasPuff && heroUi.hasBram, heroUi.text.slice(0, 400));
ok('Puff and Bramble are not behind a lock', !heroUi.puffLocked && !heroUi.bramLocked, { puffLocked: heroUi.puffLocked, bramLocked: heroUi.bramLocked });
ok('Pico, Yuki, Gus, and Wisp still use gold locks, not Full Game IAP',
  heroUi.goldLocked.length === 4 && !heroUi.hasFullGame,
  { goldLocked: heroUi.goldLocked, hasFullGame: heroUi.hasFullGame });

await page.evaluate(() => { __bg.UI.show('setup', { mode: 'classic' }); });
await sleep(400);
const arenaUi = await page.evaluate(() => {
  const box = document.querySelector('#ui');
  const text = box?.innerText || '';
  const btns = [...document.querySelectorAll('#ui button')].map((b) => ({
    t: (b.innerText || '').replace(/\s+/g, ' ').trim(),
    locked: b.classList.contains('locked') || b.classList.contains('lock') || b.disabled,
  }));
  const arenaBtns = btns.filter((b) => /Dojo|Rooftop|Jungle|Ice|Volcano|Pirate|Space|Haunted|Lotus|Pond|Cedar|Creek|Random/i.test(b.t));
  return { text: text.slice(0, 800), arenaBtns, hasPond: /Lotus\s+Pond/i.test(text), hasCreek: /Cedar\s+Creek/i.test(text), hasFullGame: /Unlock Full Game|Restore Purchases|\$2\.99/i.test(text) };
});
ok('setup lists Lotus Pond and Cedar Creek', arenaUi.hasPond && arenaUi.hasCreek, arenaUi.arenaBtns);
ok('listed maps including Pond, Creek and Random are free (none locked)',
  arenaUi.arenaBtns.some((b) => /Lotus|Pond/i.test(b.t)) && arenaUi.arenaBtns.some((b) => /Cedar|Creek/i.test(b.t)) && arenaUi.arenaBtns.some((b) => /Random/i.test(b.t)) && arenaUi.arenaBtns.every((b) => !b.locked) && !arenaUi.hasFullGame,
  arenaUi.arenaBtns);

const pe = errors.filter((e) => !/REQFAIL|ERR_FILE|font|favicon|AudioContext|sw failed/i.test(e));
ok('no page errors', !pe.length, pe.slice(0, 3));

console.log(JSON.stringify({ summary: { pass, fail } }));
await browser.close();
process.exit(fail ? 1 : 0);
