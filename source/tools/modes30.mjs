import { launch, sleep } from './lib.mjs';
const modes = (process.argv[2] || 'ctf,coins,ball,crumble,bossrush').split(','); const arena = process.argv[3] || 'dojo'; const secs = +(process.argv[4] || 12); const q = process.argv[5] || 'sharp';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate((q) => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = q; s.settings.events = 'some'; __bg.app.reloadSettings(); }, q);
for (const mode of modes) {
  await page.evaluate((mode, arena) => { const s = __bg.S(); s.setup.arena = arena; s.setup.size = 'large'; s.setup.traps = 'some'; s.setup.bots = 3; s.setup.diff = 1; s.setup.mutator = 'off'; __bg.app.startMode(mode); }, mode, arena);
  await sleep(500);
  await page.evaluate((secs) => { __bg.autoplay(1); __bg.step(secs * 60); __bg.renderNow(); __bg.renderNow(); }, secs); await sleep(300);
  await page.evaluate(() => { __bg.app.hudT = 0; __bg.UI.hudUpdate(__bg.app.game); });
  await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v30/mode-${mode}-${arena}.png` }); console.log(mode);
}
console.log('errors', errors.slice(0, 6)); await browser.close();
