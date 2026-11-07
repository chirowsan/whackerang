// v4.9 before/after: deterministic seeded shots. usage: node tools/vis49.mjs <url> <outdir> [w h mobile] [size]
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const [url, out, W = '915', H = '412', MOB = '1', SIZE = 'large'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: +W, h: +H, dpr: 1, mobile: MOB === '1' });
await page.goto(url); await sleep(2500);
for (const a of (process.env.ARENAS || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',')) {
  await page.evaluate((a, SIZE) => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = a; S.setup.size = SIZE; S.setup.traps = 'some'; S.setup.bots = 3; S.setup.diff = 2;
    __bg.app.startMode('classic'); __bg.app.paused = true; __bg.step(240); __bg.renderNow(); }, a, SIZE);
  await sleep(900); await page.evaluate(() => { for (const id of ['countdown', 'edgewarn']) { const c = document.getElementById(id); if (c) c.className = ''; } }); await sleep(300);
  await page.screenshot({ path: `${out}/${a}-${SIZE}-${W}x${H}.png` });
}
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
