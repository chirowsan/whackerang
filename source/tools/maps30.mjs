import { launch, sleep } from './lib.mjs';
const q = process.argv[2] || 'sharp'; const arenas = (process.argv[3] || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(','); const sizes = (process.argv[4] || 'small,large,huge').split(',');
const OV = process.argv[5] === 'ov'; const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate((q) => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = q; s.settings.events = 'some'; __bg.app.reloadSettings(); }, q);
for (const a of arenas) for (const z of sizes) {
  await page.evaluate((a, z) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = z; s.setup.traps = 'some'; s.setup.bots = 3; s.setup.diff = 1; __bg.app.startMode('classic'); }, a, z);
  await sleep(400);
  const info = await page.evaluate((ov) => { __bg.overview(ov); __bg.step(ov ? 200 : 300); __bg.renderNow(); __bg.renderNow(); const r = __bg.gfx.renderer.info.render; const g = __bg.app.game; return { calls: r.calls, tris: r.triangles, traps: g.traps.list.map((t) => t.type).join(','), alive: g.fighters.filter((f) => f.alive).length }; }, OV);
  console.log(a, z, JSON.stringify(info)); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v30/map-${a}-${z}${OV ? '-ov' : ''}.png` });
}
console.log('errors', errors.slice(0, 6)); await browser.close();
