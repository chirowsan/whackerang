import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(1500);
const res = await page.evaluate(async () => {
  const bg = __bg; bg.app.paused = true; bg.app.mode = 'menu'; const out = {};
  for (const diff of [0, 1, 2]) for (const arena of ['dojo', 'rooftop', 'jungle', 'ice']) {
    const stats = { rounds: 0, dur: [], draws: 0, kinds: {}, throws: 0, catches: 0, parries: 0, pickups: 0, timeouts: 0 };
    for (let r = 0; r < 4; r++) {
      let done = false; const ev = (n, d) => { if (n === 'throw') stats.throws++; else if (n === 'catch') stats.catches++; else if (n === 'parry') stats.parries++; else if (n === 'pickup') stats.pickups++; else if (n === 'ko') stats.kinds[d.f.deathKind || d.kind] = (stats.kinds[d.f.deathKind || d.kind] || 0) + 1; else if (n === 'roundEnd') { done = true; if (!d.winner) stats.draws++; } };
      const hs = bg.HEROES.slice().sort(() => Math.random() - 0.5).slice(0, 4);
      const g = new bg.Game({ mode: 'attract', arenaId: arena, intro: 0.1, input: bg.Input, onEvent: ev, players: hs.map((h, i) => ({ hero: h, hat: 'none', ctrl: 'bot', slot: i, diff, name: h.name })) });
      let t = 0; while (!done && t < 60 * 120) { g.update(1 / 60); t++; } if (!done) stats.timeouts++; stats.dur.push(Math.round(t / 60)); stats.rounds++; g.dispose();
    }
    out[`d${diff}-${arena}`] = { ...stats, dur: stats.dur.join(',') };
  }
  return out;
});
for (const k in res) console.log(k, JSON.stringify(res[k]));
console.log('errors', errors); await browser.close();
