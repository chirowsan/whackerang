import { launch, sleep } from './lib.mjs';
const arena = process.argv[2] || 'jungle'; const after = +(process.argv[3] || 6);
const { browser, page, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
const r = await page.evaluate(async (arena, after) => {
  const bg = __bg, app = bg.app; bg.fx.popKeep = true; let ko = null; const o = app.gameEvent.bind(app); app.gameEvent = (n, d) => { if (n === 'ko' && d.kind === 'boom' && !ko) ko = 1; o(n, d); };
  const s = bg.S(); s.setup = { ...s.setup, bots: 3, diff: 2, arena, rounds: 3 }; app.startMatch();
  let t = 0; while (!ko && t < 6000) { bg.step(1); t++; } 
  if (!ko) return 'no ko'; bg.step(after); app.paused = true; document.querySelectorAll('.popup').forEach((e) => { e.style.animationDelay = '-0.25s'; e.style.animationPlayState = 'paused'; }); bg.fx.update(0.0); bg.renderNow(); return 'ko at tick ' + t;
}, arena, after);
console.log(r, await page.evaluate(() => [...document.querySelectorAll('.popup')].map(e => e.textContent + '|' + e.className + '|' + getComputedStyle(e).opacity))); await sleep(300); await page.screenshot({ path: `shots/hit-${arena}.png` }); console.log(errors);
await browser.close();
