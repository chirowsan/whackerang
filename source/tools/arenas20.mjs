import { launch, sleep } from './lib.mjs';
const q = process.argv[2] || 'sharp'; const tag = process.argv[3] || 'a';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
await page.evaluate((q) => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = q; s.settings.events = 'wild'; __bg.app.reloadSettings(); }, q);
for (const a of ['dojo', 'rooftop', 'jungle', 'ice']) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.bots = 3; s.setup.diff = 1; __bg.app.startMode('classic'); }, a);
  await sleep(500);
  const info = await page.evaluate(() => { __bg.step(260); __bg.renderNow(); __bg.renderNow(); const r = __bg.gfx.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
  console.log(a, JSON.stringify(info)); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v20/arena-${a}-${tag}.png` });
}
console.log('errors', errors.slice(0, 6)); await browser.close();
