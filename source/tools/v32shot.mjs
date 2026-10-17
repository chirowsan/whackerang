// v3.2 screenshot helper. usage: node tools/v32shot.mjs <html> <outprefix> [scenario]
import { launch, sleep } from './lib.mjs';
const [file, prefix, scen] = [process.argv[2], process.argv[3], process.argv[4] || 'basic'];
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
await page.goto('file://' + file); await sleep(2500);
await page.screenshot({ path: `${prefix}-menu.png` });
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 1; __bg.app.startMode('classic'); });
await sleep(5200); await page.screenshot({ path: `${prefix}-play.png` });
await sleep(3000); await page.screenshot({ path: `${prefix}-play2.png` });
for (const [id, p, n] of [['modes', {}, 'modes'], ['settings', { ret: 'menu' }, 'settings'], ['shop', { tab: 'Hats' }, 'shop'], ['profile', {}, 'profile'], ['goldstore', { tab: 'earn' }, 'gold'], ['howto', {}, 'howto']]) { await page.evaluate((id, p) => { __bg.app.quitToMenu(false); __bg.UI.show(id, p); }, id, p); await sleep(700); await page.screenshot({ path: `${prefix}-${n}.png` }); }
console.log('errors', errors.slice(0, 5)); await browser.close();
