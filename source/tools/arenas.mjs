import { launch, sleep } from './lib.mjs';
const { browser, page, logs, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
for (const a of ['dojo', 'rooftop', 'jungle', 'ice']) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.bots = 3; __bg.app.startMatch(); }, a);
  await sleep(500);
  await page.evaluate(() => __bg.step(60 * 4)); await sleep(300);
  await page.evaluate(() => __bg.step(60 * 3)); await sleep(500);
  await page.screenshot({ path: `shots/arena-${a}.png` });
}
console.log('errors', errors);
await browser.close();
