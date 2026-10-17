import { launch, sleep } from './lib.mjs';
const url = process.argv[2];
for (const [w, h, lh, name] of [[915, 412, false, 'r-915'], [915, 412, true, 'left-915'], [740, 340, false, 'r-740'], [844, 390, true, 'left-844']]) {
  const { browser, page, errors } = await launch({ w, h, dpr: 2.6, mobile: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
  await page.evaluateOnNewDocument((lh) => { localStorage.setItem('boomerangbrawl.save.v1', JSON.stringify({ settings: { leftHanded: lh } })); }, lh);
  await page.goto(url, { waitUntil: 'load' }); await sleep(2500);
  await page.evaluate(() => { __bg.gfx.noAdapt = true; const s = __bg.S(); s.setup.arena = 'rooftop'; s.setup.bots = 3; __bg.app.startMatch(); }); await sleep(4500);
  const r = await page.evaluate(() => { const g = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { dash: g('#btnDash'), defl: g('#btnDef'), aim: g('#aimbase'), joy: g('#joybase'), pause: g('#btnPause'), reserve: [__bg.gfx.reserveL, __bg.gfx.reserveR] }; });
  console.log(name, JSON.stringify(r), errors.length ? errors : '');
  await page.screenshot({ path: `shots/v13/layout-${name}.png` }); await browser.close();
}
