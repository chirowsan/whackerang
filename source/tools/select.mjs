import { launch, sleep } from './lib.mjs';
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 720), tag = process.argv[4] || 'sel', mob = process.argv[5] === 'm'; const only = process.argv[6];
const { browser, page, errors } = await launch({ w: W, h: H, dpr: mob ? 2 : 1, mobile: mob });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const ids = await page.evaluate(() => __bg.HEROES.map((h) => h.id));
for (const id of ids) { if (only && only !== id) continue; await page.evaluate((id) => { const s = __bg.S(); s.coins = 900; s.unlockedHeroes = __bg.HEROES.map((h) => h.id); s.hero = id; __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' }); }, id); await sleep(500); await page.screenshot({ path: `shots/${tag}-${id}.png` }); }
console.log(errors); await browser.close();
