import { launch, sleep } from './lib.mjs';
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 720), tag = process.argv[4] || 'ui', mob = process.argv[5] === 'm';
const { browser, page, errors } = await launch({ w: W, h: H, dpr: mob ? 2 : 1, mobile: mob });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const shot = async (n) => { await sleep(500); await page.screenshot({ path: `shots/${tag}-${n}.png` }); };
for (const [n, scr, p] of [['setup', 'setup'], ['heroes', 'heroes', { mode: 'pick', ret: 'menu' }], ['settings', 'settings', { ret: 'menu' }], ['howto', 'howto']]) { await page.evaluate((s, p) => { __bg.S().coins = 500; __bg.UI.show(s, p); }, scr, p); await shot(n); }
await page.evaluate(() => { __bg.S().setup.arena = 'ice'; __bg.app.startMatch(); }); await sleep(800); await page.evaluate(() => __bg.step(60 * 4)); await sleep(300);
await page.evaluate(() => __bg.app.pause()); await shot('pause');
await page.evaluate(() => { __bg.app.resume(); const a = __bg.app; a.gameEvent('roundEnd', { winner: a.game.fighters[1] }); }); await shot('roundend');
console.log(errors); await browser.close();
