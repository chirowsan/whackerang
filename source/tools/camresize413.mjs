// t397u: default phone fit recomputes on orientation/resize (landscape -> other phone size -> portrait -> landscape), and desktop stays unchanged
import { wk, sleep } from './wklib.mjs';
const [html, E] = process.argv.slice(2); let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + ' ' + JSON.stringify(x)); };
const { browser, page } = await wk({ viewport: { width: 750, height: 340 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, {}, E); await page.goto('file://' + html); await sleep(2500);
await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.settings.camera = 'close'; S.setup.arena = 'space'; S.setup.size = 'large'; S.setup.bots = 3; __bg.app.startMode('classic'); const g = __bg.app.game; __bg.app.paused = true; let k = 0; while (g.state !== 'play' && k++ < 3000) __bg.step(1); __bg.app.paused = false; });
const rd = () => page.evaluate(() => { const f = __bg.gfx.follow || {}; return { w: innerWidth, h: innerHeight, fitK: f.fitK, pxu: f.visW && +(innerWidth / f.visW).toFixed(1) }; });
const seq = [[750, 340], [667, 375], [340, 750], [814, 380], [1280, 720]]; const out = [];
for (const [w, h] of seq) { await page.setViewportSize({ width: w, height: h }); await sleep(900); out.push(await rd()); }
ok('phone landscape sizes get a whole-arena fit (fitK>1) with >=21 px/unit', [0, 1, 3].every((i) => out[i].fitK > 1 && out[i].pxu >= 20.9), out);
ok('portrait and desktop-size windows keep the old framing (fitK 1)', out[2].fitK === 1 && out[4].fitK === 1, [out[2], out[4]]);
await browser.close(); console.log(`${E} ${pass}/${pass + fail} passed`);
