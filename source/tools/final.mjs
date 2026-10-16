import { launch, sleep } from './lib.mjs';
const file = process.argv[2] || 'file:///workspace/boomerang-brawl/BoomerangBrawl.html'; const pre = process.argv[3] || 'final';
const { browser, page, errors, logs } = await launch({ w: 1280, h: 720 });
await page.goto(file); await sleep(4000);
await page.screenshot({ path: `shots/${pre}-1-menu.png` });
for (const a of ['dojo', 'rooftop', 'jungle', 'ice']) {
  await page.evaluate((a) => { const bg = __bg; bg.fx.popKeep = true; const s = bg.S(); s.setup = { ...s.setup, bots: 3, diff: 2, arena: a, rounds: 3 }; bg.app.startMatch(); bg.app.paused = true; bg.step(60 * 3.4); bg.step(60 * 2.2); bg.renderNow(); }, a);
  await sleep(1500); await page.screenshot({ path: `shots/${pre}-2-${a}.png` });
}
// hit moment (jungle)
await page.evaluate(() => { const bg = __bg, app = bg.app; app.paused = false; app.quitToMenu(); });
await sleep(800);
const r = await page.evaluate(() => { const bg = __bg, app = bg.app; let ko = null; const o = app.gameEvent.bind(app); app.gameEvent = (n, d) => { if (n === 'ko' && d.kind === 'boom' && !ko) ko = 1; o(n, d); }; const s = bg.S(); s.setup = { ...s.setup, bots: 3, diff: 2, arena: 'jungle', rounds: 3 }; app.startMatch(); app.paused = true; let t = 0; while (!ko && t < 6000) { bg.step(1); t++; } bg.step(5); document.querySelectorAll('.popup').forEach((e) => { e.style.animationDelay = '-0.25s'; e.style.animationPlayState = 'paused'; }); bg.renderNow(); return t; });
await sleep(1500); await page.screenshot({ path: `shots/${pre}-3-hit.png` });
console.log('ko tick', r, 'errors', errors, logs.filter((l) => l.includes('Boomerang Brawl')));
await browser.close();
