import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(1500);
console.log(JSON.stringify(await page.evaluate(() => { const bg = __bg; bg.app.paused = true; bg.app.mode = 'menu'; const out = [];
  for (let r = 0; r < 24; r++) { const hs = bg.HEROES.slice().sort(() => Math.random() - 0.5).slice(0, 4); let done = false;
    const g = new bg.Game({ mode: 'attract', arenaId: 'jungle', intro: 0.1, input: bg.Input, onEvent: (n, d) => { if (n === 'roundEnd') done = true; if (n === 'ko' && d.kind === 'lava') { const f = d.f; out.push({ dash: +f.dashT.toFixed(2), vx: +f.vx.toFixed(1), vz: +f.vz.toFixed(1), x: +f.x.toFixed(1), z: +f.z.toFixed(1), inv: f.inv, charging: f.charging, pushed: f.pushed, ex: +f.ex.toFixed(1) }); } }, players: hs.map((h, i) => ({ hero: h, hat: 'none', ctrl: 'bot', slot: i, diff: 2, name: h.name })) });
    let t = 0; while (!done && t < 7200) { g.update(1 / 60); t++; } g.dispose(); } return out; })));
await browser.close();
