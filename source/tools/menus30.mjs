import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; __bg.app.reloadSettings(); });
const ids = await page.evaluate(() => __bg.ARENAS.map((a) => a.id)); console.log(ids);
for (const id of ids) {
  await page.evaluate((id) => { const A = __bg.ARENAS.find((a) => a.id === id); __bg.app.showArena = A; const r = Math.random; Math.random = () => 0.1; __bg.app.quitToMenu(false); Math.random = r; }, id);
  await sleep(1800); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v30/menu-${id}.png` });
}
console.log('errors', errors.slice(0, 5)); await browser.close();
