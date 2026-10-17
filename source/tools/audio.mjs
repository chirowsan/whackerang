import { launch, sleep } from './lib.mjs';
const { browser, page, errors, logs } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(1500);
await page.mouse.click(300, 200); await sleep(500);
const r = await page.evaluate(async () => { const m = await import('data:text/javascript,export default 1').catch(() => null); return typeof AudioContext; });
console.log(r, await page.evaluate(() => { const ac = new AudioContext(); return ac.state; }));
// trigger all sfx via game events through UI clicks & a fast match
await page.evaluate(() => { const bg = __bg; const s = bg.S(); s.setup.bots = 3; bg.app.startMatch(); bg.step(60 * 20); });
await sleep(1000);
console.log('errors', errors, logs.filter((l) => l.includes('audio')));
await browser.close();
