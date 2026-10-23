// deterministic screenshots (seeded Math.random, stepped frames) for before/after visual comparison. usage: node tools/vis45.mjs <url> <outdir>
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const url = process.argv[2], out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto(url); await sleep(2500);
for (const a of ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted']) {
  for (const phase of ['first', 'afterRestarts']) {
    await page.evaluate((a, phase) => { let s = 12345; window.__seed = () => { s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
      const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = a; S.setup.size = 'large'; S.setup.traps = 'some'; S.setup.bots = 3; S.setup.diff = 2;
      __seed(); __bg.app.startMode('classic'); __bg.app.paused = true;
      if (phase === 'afterRestarts') { for (let i = 0; i < 3; i++) { __bg.step(5); __seed(); __bg.app.restartRound(); __bg.app.paused = true; } }
      __bg.step(240); __bg.renderNow(); }, a, phase);
    await sleep(900); await page.evaluate(() => { const c = document.getElementById('countdown'); if (c) c.className = ''; const e = document.getElementById('edgewarn'); if (e) e.className = ''; }); await sleep(300);
    await page.screenshot({ path: `${out}/${a}-${phase}.png` });
  }
}
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
