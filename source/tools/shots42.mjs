// play screenshots for before/after: node tools/shots42.mjs <html> <outdir> [w h dpr]
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const [html, out, W = '915', H = '412', DPR = '2'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: +W, h: +H, dpr: +DPR, mobile: true });
await page.goto(html); await sleep(2500);
for (const [a, z] of [['dojo', 'small'], ['volcano', 'small'], ['haunted', 'small'], ['jungle', 'small'], ['space', 'small']]) {
  await page.evaluate((a, z) => { const s = __bg.S(); s.tutorialDone = true; s.setup.arena = a; s.setup.size = z; s.setup.bots = 2; s.setup.traps = 'some'; s.settings.events = 'off'; __bg.app.startMode('classic'); }, a, z); await sleep(600);
  await page.evaluate(() => { __bg.step(230); __bg.app.paused = false; const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; }); const me = g.fighters.find((f) => !f.isBot); const bs = g.fighters.filter((f) => f !== me); me.x = -3; me.z = 1; bs[0].x = 2; bs[0].z = -1; if (bs[1]) { bs[1].x = 5; bs[1].z = 2.5; } }); await sleep(2800);
  // a catch/impact moment for effects shot is separate; plain play shot here
  await page.screenshot({ path: `${out}/${a}.png` });
}
// effects shot: force an impact + catch burst + star at the player
await page.evaluate(() => { const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot); if (!__bg.fx.star) { console.log('nostar'); } __bg.fx.impact(me.x + 2, me.z, 0xff5a3a, 1, 0, 1.4); __bg.fx.catchBurst(me.x, me.z, me.color, 3); __bg.fx.star && __bg.fx.star(me.x - 2, 0.8, me.z, 0x9ff0ff, 3.4, 0.5); }); await sleep(90);
await page.screenshot({ path: `${out}/fx.png` });
console.log('errors', JSON.stringify(errors.filter((e) => !/icon-|ERR_FILE_NOT_FOUND/.test(e)))); await browser.close();
