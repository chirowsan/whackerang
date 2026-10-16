import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(1500);
console.log(await page.evaluate(() => { const bg = __bg; bg.app.paused = true; bg.app.mode = 'menu'; let res = null;
  for (let r = 0; r < 30 && !res; r++) { const hs = bg.HEROES.slice().sort(() => Math.random() - 0.5).slice(0, 4); let done = false; const hist = hs.map(() => []);
    const g = new bg.Game({ mode: 'attract', arenaId: 'jungle', intro: 0.1, input: bg.Input, onEvent: (n, d) => { if (n === 'roundEnd') done = true; if (n === 'ko' && d.kind === 'lava' && !res) res = hist[d.f.idx].slice(-14); }, players: hs.map((h, i) => ({ hero: h, hat: 'none', ctrl: 'bot', slot: i, diff: 2, name: h.name })) });
    g.fighters.forEach((f, i) => { const ou = f.bot.update.bind(f.bot); f.bot.update = (dt) => { const o = ou(dt); hist[i].push([+f.x.toFixed(2), +f.z.toFixed(2), +f.vx.toFixed(1), +f.vz.toFixed(1), +o.mx.toFixed(2), +o.mz.toFixed(2), o.dash ? 'D' : '', f.dashT > 0 ? 'd' : '', f.pu.speed > 0 ? 'S' : ''].join(' ')); return o; }; });
    let t = 0; while (!done && t < 7200) { g.update(1 / 60); t++; } g.dispose(); } return res ? res.join('\n') : 'none'; }));
await browser.close();
