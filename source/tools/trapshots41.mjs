// v4.1 trap/portal lineup: per arena overview screenshot with every trap type visible (wild traps, large map), plus a list of the trap types present.
import { launch, sleep } from './lib.mjs';
const OUT = process.env.OUT || '/workspace/boomerang-brawl/shots/v41/traps/';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const arenas = (process.argv[2] || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',');
const { browser, page, errors } = await launch({ w: 1100, h: 620, dpr: 1, mobile: false });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.camera = 'wide'; s.settings.quality = 'fast'; s.settings.touch = 'off'; __bg.app.reloadSettings(); });
const info = {};
for (const a of arenas) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'wild'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a);
  await sleep(400);
  const types = await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; }); __bg.overview(true); __bg.step(220); return [...new Set(g.traps.list.map((t) => t.type))]; });
  await sleep(500);
  for (const k of ['a', 'b']) { await page.evaluate(() => { __bg.step(k0()); function k0() { return 70; } }); await sleep(250); await page.screenshot({ path: `${OUT}${a}-${k}.png` }); }
  info[a] = types;
}
console.log(JSON.stringify({ info, errors: errors.filter((e) => !/favicon/.test(e)) }));
await browser.close();
