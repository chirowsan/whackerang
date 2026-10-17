import { launch, sleep } from './lib.mjs';
const tag = process.argv[2] || 'a';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.coins = 480; s.xp = 330; s.camp.stars = [3, 2, 1, 3]; });
const shot = async (n) => { await sleep(700); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v20/ui-${n}-${tag}.png` }); };
const show = (name, props) => page.evaluate((n, p) => __bg.UI.show(n, p), name, props || {});
await show('modes'); await shot('modes');
await page.evaluate(() => { __bg.S().setup.mode = 'koth'; }); await show('setup', { mode: 'koth' }); await shot('setup-koth');
await show('setup', { mode: 'classic' }); await shot('setup-classic');
await show('campaign'); await shot('campaign');
await show('stageInfo', { n: 4 }); await shot('stageinfo');
for (const tab of ['Boomerangs', 'Skins', 'Trails', 'Hats', 'Emotes', 'Fighters']) { await show('shop', { tab }); await shot('shop-' + tab); }
await show('profile'); await shot('profile');
await show('heroes', { mode: 'pick', ret: 'menu' }); await shot('heroes');
await show('settings', { ret: 'menu' }); await shot('settings');
await show('tutintro'); await shot('tutintro');
await show('howto'); await shot('howto');
console.log('errors', errors.slice(0, 6)); await browser.close();
