import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(1500);
console.log(await page.evaluate(() => { const bg = __bg; bg.app.paused = true; bg.app.mode = 'menu'; const hs = bg.HEROES;
  const g = new bg.Game({ mode: 'attract', arenaId: 'rooftop', intro: 0.01, input: bg.Input, onEvent() {}, players: [0, 1].map((i) => ({ hero: hs[i], hat: 'none', ctrl: 'human', slot: 1, diff: 1, name: 'x' + i })) });
  const out = []; for (const row of [4, 7]) { const f = g.fighters[0]; f.x = 0; f.z = row - 6 + 0.5; f.alive = true; g.update(1 / 60); const x0 = f.x; for (let i = 0; i < 30; i++) g.update(1 / 60); out.push('row ' + row + ' z=' + f.z.toFixed(1) + ' dx=' + (f.x - x0).toFixed(2) + ' layout dx=' + g.layout.dx[row * 20 + 10]); } return out.join('\n'); }));
await browser.close();
