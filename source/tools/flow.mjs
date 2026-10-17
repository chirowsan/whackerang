import { launch, sleep } from './lib.mjs';
const { browser, page, logs, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
const res = await page.evaluate(async () => {
  const bg = __bg, app = bg.app, K = bg.Input.keys; const cnt = {}; const o = app.gameEvent.bind(app); app.gameEvent = (n, d) => { cnt[n] = (cnt[n] || 0) + 1; o(n, d); };
  const s = bg.S(); s.setup = { ...s.setup, bots: 1, diff: 0, arena: 'dojo', rounds: 2, players: 1 }; app.startMatch();
  const g0 = () => app.game; let log = []; let tick = 0;
  const hold = (k, on) => { on ? K.add(k) : K.delete(k); };
  const run = (n, fn) => { for (let i = 0; i < n; i++) { fn && fn(tick); bg.step(1); tick++; } };
  const bot = () => g0().fighters.find((f) => f.isBot), me = () => g0().fighters.find((f) => !f.isBot);
  let rounds = 0, guard = 0;
  while (guard++ < 40 && app.mode !== 'matchEnd') {
    if (UIcur() === 'roundEnd') { app.nextRound(); continue; }
    run(120, null); // intro
    for (let i = 0; i < 90 && g0().state === 'play'; i++) { // play chunks
      run(30, (t) => { const m = me(), b = bot(); if (!m || !b || !m.alive) { K.clear(); return; } const dx = b.x - m.x, dz = b.z - m.z; hold('KeyA', dx < -0.5 && t % 60 < 40); hold('KeyD', dx > 0.5 && t % 60 < 40); hold('KeyW', dz < -0.5); hold('KeyS', dz > 0.5); hold('KeyF', (t % 100) < 12); if (t % 140 === 0) bg.Input.edge.add('Space'); });
    }
    K.clear(); run(240, null);
    function UIcur() { return bg.UI.cur; }
    if (UIcur() === 'roundEnd') rounds++;
  }
  function UIcur() { return bg.UI.cur; }
  return { cnt, mode: app.mode, ui: bg.UI.cur, rounds, tick, coins: bg.S().coins, wins: app.match && app.match.players.map((p) => p.name + ':' + p.wins) };
});
console.log(JSON.stringify(res)); console.log('errors', errors);
await page.screenshot({ path: 'shots/flow-end.png' });
await browser.close();
