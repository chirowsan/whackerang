import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
const r = await page.evaluate(() => { const bg = __bg, K = bg.Input.keys; const s = bg.S(); s.setup = { ...s.setup, players: 2, bots: 0, rounds: 3 }; bg.app.startMatch(); bg.app.paused = true; bg.step(200);
  const g = bg.app.game; const out = { n: g.fighters.length, names: g.fighters.map((f) => f.name + ':' + f.isBot), solo: bg.Input.solo };
  const thr = [0, 0]; const o = g.onEvent; g.onEvent = (n, d) => { if (n === 'throw') thr[d.f.idx]++; o(n, d); };
  const [a, b] = g.fighters; const x0 = [a.x, b.x]; K.add('KeyD'); K.add('ArrowLeft'); bg.step(30); K.delete('KeyD'); K.delete('ArrowLeft'); out.moved = [+(a.x - x0[0]).toFixed(2), +(b.x - x0[1]).toFixed(2)];
  K.add('KeyF'); bg.step(8); K.delete('KeyF'); bg.step(5); K.add('Enter'); bg.step(8); K.delete('Enter'); bg.step(5); out.throws = thr; return out; });
console.log(JSON.stringify(r)); console.log(errors); await browser.close();
