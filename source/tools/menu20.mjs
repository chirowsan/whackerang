import { launch, sleep } from './lib.mjs';
const tag = process.argv[2] || 'a';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2500);
await page.evaluate(() => { __bg.S().tutorialDone = true; });
await sleep(1500); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v20/menu-${tag}.png` });
await sleep(3000); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v20/menu-${tag}2.png` });
console.log('errors', errors.slice(0, 6)); await browser.close();
