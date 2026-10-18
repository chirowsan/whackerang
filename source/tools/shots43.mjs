// v4.3 screenshots: lethal traps dormant -> telegraph -> armed, soft traps, legend.
import { launch, sleep } from './lib.mjs';
const OUT = '/workspace/out/v4.3-shots/';
const { browser, page, errors } = await launch({ w: 1100, h: 620, dpr: 1, mobile: false });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.camera = 'wide'; s.settings.quality = 'fast'; s.settings.touch = 'off'; __bg.app.reloadSettings(); });
for (const a of (process.argv[2] || 'dojo,volcano,space').split(',')) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'wild'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a); await sleep(400);
  await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; f.x = 99; }); __bg.overview(true); __bg.step(200); }); await sleep(500);
  const shot = async (n) => { await page.evaluate(() => __bg.step(2)); await sleep(250); await page.screenshot({ path: `${OUT}${a}-${n}.png` }); };
  await shot('1-dormant');
  await page.evaluate(() => { const g = __bg.app.game; g.traps.list.forEach((t) => { if (t.lethal) t.arm(null); }); __bg.step(14); }); await shot('2-telegraph');
  await page.evaluate(() => { __bg.step(30); }); await shot('3-armed');
}
await page.evaluate(() => { __bg.app.game && __bg.app.toMenu && __bg.app.toMenu(); __bg.UI.show('howto', { new: 1 }); }); await sleep(600); await page.screenshot({ path: OUT + 'legend.png' });
console.log(JSON.stringify({ errors: errors.filter((e) => !/favicon/.test(e)) })); await browser.close();
