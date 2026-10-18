// v4.4 close-up shots on a phone-sized viewport: proximity warning, wobble on the ledge (same scenario as the v4.3 "before" shots)
import { launch, sleep } from './lib.mjs';
const OUT = process.env.OUT || '/workspace/out/v4.4-shots/'; import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; __bg.app.reloadSettings(); });
for (const a of (process.argv[2] || 'dojo,ice,volcano,space').split(',')) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'off'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a); await sleep(400);
  await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 0; f.lives = 99; }); g.fighters[1].stunT = 1e9; g.fighters[1].x = 99; __bg.step(200); g.state = 'play'; const [hx, hz] = __bg.hxz(); const W = Math.round(hx * 2), H = Math.round(hz * 2); const ic = Math.floor(W / 2), jc = Math.floor(H / 2);
    for (let j = jc - 2; j <= jc + 1; j++) for (let i = ic - 3; i <= ic - 1; i++) g.hole[j * W + i] = -1; for (let j = jc - 2; j <= jc + 1; j++) for (let i = ic + 2; i <= ic + 3; i++) g.hole[j * W + i] = 400;
    const f = g.fighters[0]; f.alive = true; f.stunT = 0; f.x = ic - hx + 0.5 + 0.0; f.z = jc - hz + 0.5; f.vx = f.vz = 0; window.__c = [ic, jc, W, hx, hz];
    g.state = 'play'; for (let n = 0; n < 40; n++) { f.x = ic - hx + 0.5 + 0.05; f.z = jc - hz + 1.5 + 0.0; f.vx = f.vz = 0; __bg.step(1); g.state = 'play'; } });
  await sleep(500); await page.screenshot({ path: OUT + a + '-near-edge.png' });
  await page.evaluate(() => { const g = __bg.app.game; const f = g.fighters[0]; const [ic, jc, W, hx, hz] = window.__c; for (let n = 0; n < 7; n++) { f.x = ic - 1 - hx + 0.5; f.z = jc - 1 - hz + 0.5; f.vx = f.vz = 0; __bg.step(1); g.state = 'play'; } });
  await sleep(120); await page.screenshot({ path: OUT + a + '-wobble.png' });
}
console.log(JSON.stringify({ errors: errors.filter((e) => !/favicon/.test(e)) })); await browser.close();
