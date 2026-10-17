import { launch, sleep } from './lib.mjs';
const { browser, page, errors, logs } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2500);
const snap = async (n) => { await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v20/${n}.png` }); };
await page.evaluate(() => { __bg.S().tutorialDone = true; });
await snap('00-menu');
for (const mode of (process.argv[2] || 'classic,team,survival,koth,bomb').split(',')) {
  await page.evaluate((mode) => { const s = __bg.S(); s.setup.bots = 3; s.setup.diff = 1; __bg.app.startMode(mode); }, mode);
  await sleep(300);
  const r = await page.evaluate(() => { const g = __bg.app.game; for (let i = 0; i < 900; i++) { __bg.step(1); } return { state: g.state, t: g.playTime.toFixed(1), alive: g.fighters.filter((f) => f.alive).length, n: g.fighters.length, ms: g.mstate() && JSON.stringify(g.mstate(), (k, v) => (v && v.hero ? v.name : v)) }; });
  console.log(mode, JSON.stringify(r));
  await page.evaluate(() => __bg.renderNow()); await snap('mode-' + mode);
}
console.log('errors', errors.slice(0, 8)); await browser.close();
