import { launch, sleep } from './lib.mjs';
const [file, out, W = 915, H = 412, cam = 'close'] = [process.argv[2], process.argv[3], +process.argv[4] || 915, +process.argv[5] || 412, process.argv[6] || 'close'];
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.goto('file://' + file); await sleep(2500);
await page.evaluate((cam) => { const s = __bg.S(); s.tutorialDone = true; s.settings.camera = cam; s.settings.quality = 'sharp'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 2; __bg.app.quickPlay(); }, cam);
await sleep(4200); await page.evaluate(() => __bg.autoplay(2));
for (let i = 0; i < 5; i++) { await sleep(1800); await page.screenshot({ path: `${out}-${cam}-${i}.png` }); }
console.log('errors', errors.slice(0, 5)); await browser.close();
