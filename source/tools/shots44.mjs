// v4.4 shots: every arena with a fallen patch + a warning tile (overview camera), plus a close shot of the proximity warning
import { launch, sleep } from './lib.mjs';
const OUT = process.env.OUT || '/workspace/out/v4.4-shots/'; import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const arenas = (process.argv[2] || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',');
const { browser, page, errors } = await launch({ w: 960, h: 540, dpr: 1, mobile: false });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.camera = 'wide'; s.settings.touch = 'off'; __bg.app.reloadSettings(); });
for (const a of arenas) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'some'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a); await sleep(400);
  await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; }); __bg.overview(true); __bg.step(200); g.state = 'play'; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2), H = Math.round(hz * 2); const free = (i, j) => { const k = j * W + i; return !g.sol[k] && g.layout.t[k] === 0; };
    let n = 0; for (let j = 2; j < H - 2 && n < 3; j++) for (let i = 3; i < W - 3 && n < 3; i++) { if (free(i, j) && free(i + 1, j) && free(i - 1, j) && free(i, j + 1) && free(i, j - 1) && (i + j) % 7 === 0) { n++; g.hole[j * W + i] = -1; g.hole[j * W + i + 1] = n === 2 ? 40 : -1; } }
    const f = g.fighters[0]; f.x = 99; __bg.step(70); });
  await sleep(300); await page.evaluate(() => __bg.step(2)); await sleep(300); await page.screenshot({ path: OUT + a + '-drop.png' });
}
console.log(JSON.stringify({ errors: errors.filter((e) => !/favicon/.test(e)) })); await browser.close();
