import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.coins = 1234; __bg.app.reloadSettings(); __bg.app.quitToMenu(false); });
await sleep(1000);
const shot = async (n) => { await sleep(500); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v30/${n}.png` }); console.log(n); };
await page.evaluate(() => __bg.UI.show('goldstore', { tab: 'buy' })); await sleep(300);
// pass the gate by clicking the right answer
await page.evaluate(() => { const q = document.querySelector('.gate, .gs-gate'); });
const ok = await page.evaluate(() => { const bs = [...document.querySelectorAll('button')]; return bs.map((b) => b.textContent).slice(0, 12); }); console.log(ok);
await shot('r6-store-gate');
await page.evaluate(() => __bg.UI.show('howto')); await shot('r6-howto');
await page.evaluate(() => { document.querySelector('.howto').scrollTop = 99999; }); await shot('r6-howto-end');
console.log('errors', errors.slice(0, 6)); await browser.close();
