import { launch, sleep } from './lib.mjs';
const tag = process.argv[2] || 'a';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; });
const shot = async (n) => { await page.evaluate(() => { __bg.renderNow(); __bg.renderNow(); }); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v20/fx-${n}-${tag}.png` }); };
const ev = (f, ...a) => page.evaluate(f, ...a);
// a) ultimates
await ev(() => { const s = __bg.S(); s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 1; s.hero = 'bao'; __bg.app.startMode('classic'); __bg.step(230); });
await ev(() => { const g = __bg.app.game; g.fighters.forEach((f, i) => { f.isBot = false; f.bot = null; }); });
await ev(() => { const g = __bg.app.game; const f = g.fighters[0]; g.useUlt(f); __bg.step(14); }); await shot('ult-bao');
await ev(() => { const g = __bg.app.game; const f = g.fighters[1]; g.fighters[0].x = -3; g.fighters[0].z = 0; f.x = 1; f.z = 0; f.hero = f.hero; g.useUlt(g.fighters.find((q) => q.hero.id === 'yuki') || g.fighters[1]); __bg.step(10); }); await shot('ult-2');
await ev(() => { const g = __bg.app.game; g.fighters.forEach((f) => f.freezeFor(3)); __bg.step(6); }); await shot('frozen');
// b) meteors + wind + bumpers on rooftop
await ev(() => { const s = __bg.S(); s.setup.arena = 'jungle'; __bg.app.startStage(10); __bg.step(230); const g = __bg.app.game; g.events.metNext = 0; });
await ev(() => { __bg.step(40); }); await shot('meteor-warn');
await ev(() => { __bg.step(70); }); await shot('meteor-hit');
// c) boss
await ev(() => { __bg.app.startStage(4); __bg.step(230); const g = __bg.app.game; const b = g.fighters.find((f) => f.boss); b.slamCd = 0; g.fighters[0].x = b.x + 3; g.fighters[0].z = b.z; __bg.step(30); }); await shot('boss-slam-warn');
await ev(() => { __bg.step(50); }); await shot('boss-slam');
await ev(() => { __bg.app.startStage(12); __bg.step(300); }); await shot('boss3');
// d) koth / bomb / survival
await ev(() => { __bg.app.startStage(9); __bg.step(500); }); await shot('koth');
await ev(() => { __bg.app.startStage(7); __bg.step(420); }); await shot('bomb');
await ev(() => { __bg.app.startStage(5); __bg.step(420); }); await shot('survival');
await ev(() => { __bg.app.startStage(6); __bg.step(330); }); await shot('team');
console.log('errors', errors.slice(0, 8)); await browser.close();
