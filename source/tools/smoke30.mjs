import { launch, sleep } from './lib.mjs';
const modes = (process.argv[2] || 'classic,team,survival,koth,bomb,ctf,coins,ball,crumble,bossrush').split(','); const secs = +(process.argv[3] || 60); const sizeArg = process.argv[4] || 'auto'; const trapArg = process.argv[5] || 'wild';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'fast'; s.settings.events = 'wild'; __bg.app.reloadSettings(); });
let n = 0;
for (const mode of modes) {
  const arenas = ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted'];
  const arena = arenas[(n++) % arenas.length]; const size = sizeArg === 'auto' ? ['small', 'large', 'huge'][n % 3] : sizeArg;
  const res = await page.evaluate((mode, arena, size, secs, trapArg) => {
    try {
      const s = __bg.S(); s.setup.arena = arena; s.setup.size = size; s.setup.traps = trapArg; s.setup.bots = 3; s.setup.diff = 1; s.setup.rounds = 1; s.setup.mutator = 'off';
      __bg.app.startMode(mode); __bg.autoplay(1); let g = __bg.app.game; let t = 0; const info = [];
      for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); if (g.fighters) { if (__bg.gfx.follow) __bg.app.camFollow(1 / 60); } if (g.result) break; }
      const ms = g.mstate(); return JSON.stringify({ mode, arena, size, state: g.state, t: Math.round(g.playTime), alive: g.fighters.filter((f) => f.alive).length, n: g.fighters.length, ms: { scores: ms.scores, coinRows: ms.coinRows && ms.coinRows.map((c) => c.score), rush: ms.rush, floor: ms.floor }, kos: g.fighters.map((f) => f.kos), traps: g.traps.list.length });
    } catch (e) { return 'ERR ' + mode + ' ' + e.stack.slice(0, 500); }
  }, mode, arena, size, secs, trapArg);
  console.log(res);
}
console.log('errors', errors.slice(0, 6)); await browser.close();
