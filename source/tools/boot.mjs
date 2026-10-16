import { launch, sleep } from './lib.mjs';
const { browser, page, logs, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(3500);
await page.screenshot({ path: 'shots/01-menu.png' });
console.log('errors', errors, 'logs', logs.slice(0, 8));
const info = await page.evaluate(() => ({ mode: __bg.app.mode, ui: __bg.UI.cur, q: __bg.gfx.quality, f: __bg.prof.frames }));
console.log(info);
await browser.close();
