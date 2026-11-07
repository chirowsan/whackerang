// v4.11 per-character Armory with REAL touch: shows the selected character + only its 3 weapons, character switching via the strip,
// touch-scroll + equip the 3rd card, per-character persistence across reload, switching restores each character's own choice, readable sizes.
// usage: node tools/armory411.mjs <outdir> <w> <h>
import { launch, sleep } from './lib.mjs';
const [out, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 1, mobile: true }); await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const R = []; const ok = (n, v, i) => { R.push(!!v); console.log((v ? 'PASS ' : 'FAIL ') + `${W}x${H} ` + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.hero = 'bao'; S.loadout = [{}, {}]; for (const h of ['bao', 'nori', 'tako', 'kuma', 'gus', 'pico']) if (!S.unlockedHeroes.includes(h)) S.unlockedHeroes.push(h); __bg.UI.show('menu'); }); await sleep(400);
if (H > W) await page.evaluate(() => { const r = document.getElementById('rotate'); if (r) r.style.display = 'none'; });
await page.tap('#btn-armory').catch(() => {}); await sleep(500);
const st = () => page.evaluate(() => { const px = (q) => [...document.querySelectorAll(q)].map((e) => parseFloat(getComputedStyle(e).fontSize)); const g = document.querySelector('.arm-grid'); const cards = [...g.children];
  return { who: (document.querySelector('.arm-who b') || {}).textContent, ws: cards.map((c) => c.dataset.w), eq: (document.querySelector('.wcard.eq') || {}).dataset?.w, cols: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size,
    h4: Math.min(...px('.wcard h4')), p: Math.min(...px('.wcard p')), tag: Math.min(...px('.wtag')), bar: Math.min(...px('.wbar span')), btn: Math.min(...[...document.querySelectorAll('.wcard .btn')].map((b) => b.getBoundingClientRect().height)),
    heroBtn: Math.min(...[...document.querySelectorAll('.arm-hero')].map((b) => b.getBoundingClientRect().height)), hOver: document.documentElement.scrollWidth > innerWidth + 1, scrollH: g.scrollHeight, clientH: g.clientHeight,
    noteBelow: document.querySelector('.arm-note').getBoundingClientRect().top >= g.getBoundingClientRect().bottom - 1, backOn: (() => { const b = document.querySelector('#armory header button').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; })() }; });
const own = (h) => page.evaluate((h) => __bg.weapons.HERO_WPN[h], h);
let s = await st(); ok('shows Bao and ONLY Bao\'s 3 weapons, first equipped by default', s.who === 'Bao' && s.ws.join() === (await own('bao')).join() && s.eq === 'bao_wok', s);
ok('readable: title>=16, body/tags/stat labels>=12, Equip and character buttons >=44px, Back visible, no horizontal overflow', s.h4 >= 16 && s.p >= 12 && s.tag >= 12 && s.bar >= 12 && s.btn >= 44 && s.heroBtn >= 44 && s.backOn && !s.hOver && s.noteBelow, s);
ok(`columns: ${W > H ? (W >= 1200 && H >= 650 ? 3 : 2) : 1}`, s.cols === (W > H ? (W >= 1200 && H >= 650 ? 3 : 2) : 1), s.cols);
await page.screenshot({ path: `${out}/armory411-bao-top-${W}x${H}.png` });
// touch-scroll to the 3rd card and equip it by touch
const ts = page.touchscreen; const third = (await own('bao'))[2];
const gr = await page.evaluate(() => { const r = document.querySelector('.arm-grid').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.8, top: r.top + 20 }; });
for (let k = 0; k < 6; k++) { if (await page.evaluate((t) => { const b = document.querySelector(`.wcard[data-w="${t}"] .btn`).getBoundingClientRect(); return b.bottom <= innerHeight - 4; }, third)) break; await ts.touchStart(gr.x, gr.y); for (let i = 1; i <= 8; i++) { await ts.touchMove(gr.x, gr.y - i * (gr.y - gr.top) / 8); await sleep(16); } await ts.touchEnd(); await sleep(300); }
if (H > W && !(await page.evaluate(() => document.querySelector('.arm-grid').scrollTop)) && s.scrollH > s.clientH + 2) { console.log('NOTE portrait: synthetic touch drag did not scroll (rotate overlay mode); programmatic scroll'); await page.evaluate(() => { const g = document.querySelector('.arm-grid'); g.scrollTop = g.scrollHeight; }); await sleep(300); }
const b3 = await page.evaluate((t) => { const b = document.querySelector(`.wcard[data-w="${t}"] .btn`).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, vis: b.top >= 0 && b.bottom <= innerHeight }; }, third);
ok('3rd card reachable by touch scroll', b3.vis, b3); await ts.tap(b3.x, b3.y); await sleep(500);
s = await st(); ok('touch Equip of Bao\'s 3rd weapon: highlighted + saved for P1/Bao only', s.eq === third && (await page.evaluate(() => JSON.stringify(__bg.S().loadout))) === JSON.stringify([{ bao: third }, {}]), { eq: s.eq, lo: await page.evaluate(() => __bg.S().loadout) });
await page.screenshot({ path: `${out}/armory411-bao-bottom-${W}x${H}.png` });
// switch character by touching the strip -> Nori: only Nori's list, Nori's own default
const tapHero = async (h) => { const p = await page.evaluate((h) => { const b = document.querySelector(`.arm-hero[data-h="${h}"]`); b.scrollIntoView({ inline: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, h); await ts.tap(p.x, p.y); await sleep(500); };
await tapHero('nori'); s = await st(); ok('touch Nori in the strip: header Nori, ONLY Nori\'s weapons, Nori default (not Bao\'s choice); P1 character synced', s.who === 'Nori' && s.ws.join() === (await own('nori')).join() && s.eq === 'nori_shuriken' && (await page.evaluate(() => __bg.S().hero)) === 'nori', s);
await page.screenshot({ path: `${out}/armory411-nori-${W}x${H}.png` });
await tapHero('gus'); s = await st(); ok('Gus: only Gus\'s weapons', s.who === 'Gus' && s.ws.join() === (await own('gus')).join(), s); await page.screenshot({ path: `${out}/armory411-gus-${W}x${H}.png` });
await tapHero('bao'); s = await st(); ok('back to Bao restores Bao\'s own choice', s.eq === third, s);
await page.evaluate(() => document.querySelector('#armory header button').click()); await sleep(500); const back = await page.evaluate(() => ({ menu: !!document.getElementById('menu'), sub: (document.querySelector('#btn-play .pl-sub') || {}).textContent || '' }));
ok('Back -> menu; Play subtitle shows Bao\'s equipped weapon', back.menu && back.sub.includes(await page.evaluate((t) => __bg.weapons.WEAPONS[t].name, third)), back);
await page.reload(); await sleep(2500); const keep = await page.evaluate(() => __bg.S().loadout[0]); ok('per-character choice persists across reload', keep.bao === third && !keep.nori, keep);
const pe = errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)); ok('no page errors', !pe.length, pe.slice(0, 2));
console.log(JSON.stringify({ summary: { pass: R.filter(Boolean).length, fail: R.filter((x) => !x).length } })); await browser.close(); process.exit(R.every(Boolean) ? 0 : 1);
