import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2.6, mobile: true });
await page.goto(process.argv[2], { waitUntil: 'load' }); await sleep(2500);
await page.evaluate(() => { __bg.gfx.noAdapt = true; const s = __bg.S(); s.setup.arena = 'dojo'; s.setup.bots = 1; __bg.app.startMatch(); }); await sleep(5000);
const c = await page.evaluate(() => { const b = document.querySelector('#aimbase').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
const n0 = await page.evaluate(() => __bg.app.game.booms.length);
await page.touchscreen.touchStart(c[0], c[1]); await sleep(100); await page.touchscreen.touchMove(c[0] - 50, c[1] - 20); await sleep(150);
const aim = await page.evaluate(() => [__bg.Input.touch.aimX, __bg.Input.touch.aimZ, __bg.Input.touch.fire]);
await page.touchscreen.touchEnd(); await sleep(400);
const n1 = await page.evaluate(() => __bg.app.game.booms.length);
// dash + deflect buttons
const d = await page.evaluate(() => { const b = document.querySelector('#btnDash').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
await page.touchscreen.tap(d[0], d[1]); await sleep(150);
const cd = await page.evaluate(() => __bg.app.game.fighters[0].dashCd);
console.log({ n0, n1, aim, dashCd: cd }, 'errors', errors); await browser.close();
