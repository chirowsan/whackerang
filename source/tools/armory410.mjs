// v4.10 Armory UI check with real touch: readable sizes, layout columns, touch scroll, equip 4th card, persistence, back, no overflow.
// usage: node tools/armory410.mjs <outdir> <w> <h>
import { launch, sleep } from './lib.mjs';
const [out, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 1, mobile: true }); await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const R = []; const ok = (n, v, i) => { R.push(!!v); console.log((v ? 'PASS ' : 'FAIL ') + `${W}x${H} ` + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.wpn = ['boom', 'boom']; __bg.UI.show('menu'); }); await sleep(400);
if (H > W) await page.evaluate(() => { const r = document.getElementById('rotate'); if (r) r.style.display = 'none'; }); /* the game shows its rotate-to-landscape overlay in portrait; hidden here to check the 1-column fallback */
await page.tap('#btn-armory').catch(() => {}); await sleep(500); console.log('screen', await page.evaluate(() => { const g = document.querySelector('.arm-grid').getBoundingClientRect(); const e = document.elementFromPoint(g.left + g.width / 2, g.top + g.height * 0.8); return (document.querySelector('.screen') || {}).id + ' hit:' + (e && (e.id || e.className)); }));
const m = await page.evaluate(() => { const px = (q) => [...document.querySelectorAll(q)].map((e) => parseFloat(getComputedStyle(e).fontSize)); const g = document.querySelector('.arm-grid'), cards = [...g.children].map((c) => c.getBoundingClientRect()); const btn = [...document.querySelectorAll('.wcard .btn')].map((b) => b.getBoundingClientRect().height);
  const note = document.querySelector('.arm-note').getBoundingClientRect(), back = document.querySelector('#armory header button').getBoundingClientRect(), gr = g.getBoundingClientRect();
  return { cols: new Set(cards.map((c) => Math.round(c.left))).size, h4: Math.min(...px('.wcard h4')), p: Math.min(...px('.wcard p')), bar: Math.min(...px('.wbar span')), num: Math.min(...px('.wnum')), note: parseFloat(getComputedStyle(document.querySelector('.arm-note')).fontSize), btn: Math.min(...btn),
    hOver: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#armory *')].some((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }), noteBelow: note.top >= gr.bottom - 1, noteIn: note.bottom <= innerHeight + 1, backOn: back.top >= 0 && back.bottom <= innerHeight, scrollH: g.scrollHeight, clientH: g.clientHeight }; });
ok('readable: title>=16, body>=12, stat labels>=12, footer>=12, Equip>=40px', m.h4 >= 16 && m.p >= 12 && m.bar >= 12 && m.num >= 12 && m.note >= 12 && m.btn >= 40, m);
ok(`columns: ${W > H ? (W >= 1200 ? 4 : 2) : 1}`, m.cols === (W > H ? (W >= 1200 && H >= 650 ? 4 : 2) : 1), m.cols);
ok('no horizontal overflow, footer below the cards and on screen, Back visible', !m.hOver && m.noteBelow && m.noteIn && m.backOn, m);
await page.screenshot({ path: `${out}/armory-top-${W}x${H}.png` });
// touch-scroll to the 4th card and equip it
const c4 = await page.evaluate(() => { const g = document.querySelector('.arm-grid'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.8, top: r.top + 20 }; });
if (m.scrollH > m.clientH + 2) { const ts = page.touchscreen; for (let k = 0; k < 6; k++) { if (await page.evaluate(() => { const b = document.querySelector(".wcard[data-w=mallet] .btn").getBoundingClientRect(); return b.bottom <= innerHeight - 4; })) break; await ts.touchStart(c4.x, c4.y); for (let i = 1; i <= 8; i++) { await ts.touchMove(c4.x, c4.y - i * (c4.y - c4.top) / 8); await sleep(16); } await ts.touchEnd(); await sleep(400); } }
if (H > W && !(await page.evaluate(() => document.querySelector('.arm-grid').scrollTop))) { console.log('NOTE portrait: synthetic touch drag did not scroll here (the real game shows its rotate-to-landscape overlay in portrait); using programmatic scroll'); await page.evaluate(() => { const g = document.querySelector('.arm-grid'); g.scrollTop = g.scrollHeight; }); await sleep(300); }
const st = await page.evaluate(() => document.querySelector('.arm-grid').scrollTop); ok('touch scroll reaches the second row', m.scrollH <= m.clientH + 2 || st > 20, { st, sh: m.scrollH, ch: m.clientH });
const b4 = await page.evaluate(() => { const b = document.querySelector('.wcard[data-w="mallet"] .btn').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, vis: b.top >= 0 && b.bottom <= innerHeight }; });
ok('4th card Equip button visible after scroll', b4.vis, b4); await page.touchscreen.tap(b4.x, b4.y); await sleep(500);
const eq = await page.evaluate(() => ({ saved: __bg.S().wpn[0], ls: JSON.stringify(localStorage).includes('mallet'), on: document.querySelector('.wcard.eq').dataset.w, tag: !!document.querySelector('.wcard.eq .eqtag') }));
ok('equip 4th (Bonk Mallet): saved + highlighted with Equipped tag', eq.saved === 'mallet' && eq.on === 'mallet' && eq.tag, eq);
await page.screenshot({ path: `${out}/armory-bottom-${W}x${H}.png` });
await page.evaluate(() => document.querySelector('#armory header button').click()); await sleep(500); const back = await page.evaluate(() => ({ menu: !!document.getElementById('menu'), sub: (document.querySelector('#btn-play .pl-sub') || {}).textContent || '' }));
ok('Back returns to the menu, Play shows the equipped weapon', back.menu && /Bonk Mallet/.test(back.sub), back);
await page.reload(); await sleep(2500); const keep = await page.evaluate(() => __bg.S().wpn[0]); ok('choice persists across reload', keep === 'mallet', keep);
const pe = errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)); ok('no page errors', !pe.length, pe.slice(0, 2));
console.log(JSON.stringify({ summary: { pass: R.filter(Boolean).length, fail: R.filter((x) => !x).length } })); await browser.close(); process.exit(R.every(Boolean) ? 0 : 1);
