import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'wild'; });
const which = process.argv[2] || 'stages';
const run = async (label, startFn, maxTicks = 9000) => {
  await page.evaluate(startFn); await sleep(200);
  const r = await page.evaluate((maxTicks) => {
    const app = __bg.app; const g = app.game; __bg.autoplay(2); let tick = 0; let res = null; let rounds = 0;
    while (tick < maxTicks) { __bg.step(1); tick++; if (app.game !== g) break; if (app.mode === 'matchEnd') { res = __bg.app.lastResult; break; } if (app.mode === 'play' && app.paused) { __bg.app.nextRound(); rounds++; __bg.autoplay(2); } }
    const gg = app.game; return { tick, mode: app.mode, rounds, st: gg.state, t: +gg.playTime.toFixed(1), res: res && { won: res.won, stars: res.stars, xp: res.xp, coins: res.coins }, ms: JSON.stringify(gg.mstate(), (k, v) => (v && v.hero ? v.name : v)).slice(0, 160) };
  }, maxTicks);
  console.log(label, JSON.stringify(r));
};
if (which === 'stages') for (let n = 1; n <= 12; n++) await run('stage' + n, `__bg.app.startStage(${n})`);
else for (const m of ['classic', 'team', 'survival', 'koth', 'bomb']) await run(m, `{ const s = __bg.S(); s.setup.bots = 3; s.setup.diff = 1; s.setup.rounds = 2; __bg.app.startMode('${m}'); }`);
console.log('errors', errors.slice(0, 8)); await browser.close();
