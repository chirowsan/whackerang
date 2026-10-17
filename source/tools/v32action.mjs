import { launch, sleep } from './lib.mjs';
const [file, out, N = 24] = [process.argv[2], process.argv[3], +process.argv[4] || 24];
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
await page.goto('file://' + file); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 2; __bg.app.quickPlay(); });
await sleep(4000); await page.evaluate(() => __bg.autoplay(2));
for (let i = 0; i < N; i++) { await page.screenshot({ path: `${out}-${String(i).padStart(2, '0')}.png`, clip: { x: 60, y: 40, width: 800, height: 340 } }); await sleep(150); }
console.log('errors', errors.slice(0, 5)); await browser.close();
