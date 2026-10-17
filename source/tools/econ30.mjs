import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; __bg.app.quitToMenu(false); __bg.UI.show('goldstore', { tab: 'buy' }); }); await sleep(600);
const txt = await page.evaluate(() => document.querySelector('.gate p').textContent); const m = txt.match(/(\d+) \+ (\d+)/); const ans = +m[1] + +m[2];
// wrong answer first
await page.evaluate((ans) => { [...document.querySelectorAll('.gate-opts button')].find((b) => +b.textContent !== ans).click(); }, ans); await sleep(500);
console.log('after wrong: gate still shown =', await page.evaluate(() => !!document.querySelector('.gate')));
const txt2 = await page.evaluate(() => document.querySelector('.gate p').textContent); const m2 = txt2.match(/(\d+) \+ (\d+)/); const ans2 = +m2[1] + +m2[2];
await page.evaluate((a) => { [...document.querySelectorAll('.gate-opts button')].find((b) => +b.textContent === a).click(); }, ans2); await sleep(600);
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v30/ui-store-buy.png' });
const before = await page.evaluate(() => __bg.S().coins);
await page.evaluate(() => { document.querySelectorAll('.pack button')[1].click(); }); await sleep(1200);
const r = await page.evaluate(() => { const s = __bg.S(); return { coins: s.coins, purchases: s.purchases, ledger: s.ledger.slice(-2), starter: !!s.starterBought, own: s.own.skins.concat(s.own.trails) }; });
console.log('before', before, JSON.stringify(r));
await page.evaluate(() => { document.querySelectorAll('.pack button')[2].click(); }); await sleep(1200);
console.log('second', await page.evaluate(() => JSON.stringify({ coins: __bg.S().coins, n: __bg.S().purchases.length })));
// earn flow: streak + bonus
await page.evaluate(() => __bg.UI.show('goldstore', { tab: 'earn' })); await sleep(500);
await page.evaluate(() => { [...document.querySelectorAll('.gs-card button')].find((b) => /Claim \+/.test(b.textContent)).click(); }); await sleep(600);
await page.evaluate(() => { [...document.querySelectorAll('.gs-card button')].find((b) => /Collect/.test(b.textContent)).click(); }); await sleep(600);
console.log('earn', await page.evaluate(() => JSON.stringify({ streak: __bg.S().streak, today: __bg.S().earnDay, coins: __bg.S().coins })));
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v30/ui-store-earn2.png' });
console.log('errors', errors.slice(0, 6)); await browser.close();
