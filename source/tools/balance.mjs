import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(1500);
const res = await page.evaluate(async () => {
  const bg = __bg; bg.app.paused = true; bg.app.mode = 'menu'; const out = {};
  const run = (diffs, N, arenas) => { const wins = diffs.map(() => 0); let draws = 0, tot = 0;
    for (let r = 0; r < N; r++) { let done = false, w = null; const hs = bg.HEROES.slice(0, 4).sort(() => Math.random() - 0.5); const arena = arenas[r % arenas.length];
      const g = new bg.Game({ mode: 'attract', arenaId: arena, intro: 0.1, input: bg.Input, onEvent: (n, d) => { if (n === 'roundEnd') { done = true; w = d.winner; } }, players: hs.map((h, i) => ({ hero: h, hat: 'none', ctrl: 'bot', slot: i, diff: diffs[i], name: h.name })) });
      let t = 0; while (!done && t < 7200) { g.update(1 / 60); t++; } if (w) wins[w.idx]++; else draws++; tot++; g.dispose(); }
    return { wins, draws, tot }; };
  out.hardVs3easy = run([2, 0, 0, 0], 48, ['dojo', 'rooftop', 'jungle', 'ice']);
  out.normalVs3easy = run([1, 0, 0, 0], 48, ['dojo', 'rooftop', 'jungle', 'ice']);
  out.hardVs3normal = run([2, 1, 1, 1], 48, ['dojo', 'rooftop', 'jungle', 'ice']);
  out.hard4 = run([2, 2, 2, 2], 24, ['dojo', 'jungle']);
  return out; });
console.log(JSON.stringify(res, null, 1)); console.log(errors); await browser.close();
