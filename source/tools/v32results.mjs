import { launch, sleep } from './lib.mjs';
const [file, out, W = 915, H = 412] = [process.argv[2], process.argv[3], +process.argv[4] || 915, +process.argv[5] || 412];
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.goto('file://' + file); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 1; s.setup.rounds = 1; __bg.app.quickPlay(); });
await sleep(4800);
await page.evaluate(() => { const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot); for (const f of g.fighters) if (f !== me) f.die(me, 'boom', 1, 0); });
for (let i = 0; i < 6; i++) { await sleep(700); await page.screenshot({ path: `${out}-r${i}.png` }); }
await sleep(3000); await page.screenshot({ path: `${out}-rfinal.png` });
console.log('errors', errors.slice(0, 5)); await browser.close();
