import { launch, sleep } from './lib.mjs';
const a = process.argv[2] || 'rooftop'; const n = +(process.argv[3] || 300);
const { browser, page, logs, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.bots = 3; __bg.app.startMatch(); }, a);
await sleep(1500);
for (let i = 0; i < 3; i++) { await page.screenshot({ path: `shots/one-${i}.png` }); await sleep(1000); console.log(await page.evaluate(() => ({ s: __bg.app.game.state, pt: __bg.app.game.playTime, f: __bg.prof.frames }))); }
console.log('errors', errors, logs.slice(-5));
await browser.close();
