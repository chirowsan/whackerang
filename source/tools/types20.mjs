import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 0; });
const run = (type, wall) => page.evaluate((type, wall) => {
  __bg.app.startMode('classic'); __bg.step(240); const g = __bg.app.game;
  g.sol.fill(0); g.crateHp.fill(0); const F = g.fighters; const me = F[0];
  F.forEach((f) => { f.bot = null; f.isBot = false; f.frozenT = 0; f.inv = 0; f.shield = false; });
  me.type = type; me.baseType = type; me.x = -7; me.z = 0.5; me.vx = me.vz = 0;
  const [a, b, c] = [F[1], F[2], F[3]];
  if (type === 'razor') { a.x = -4; a.z = 0.5; b.x = -2.5; b.z = 0.5; c.x = 6; c.z = -5; }
  else if (type === 'chain') { a.x = -4; a.z = 0.5; b.x = -4; b.z = 4; c.x = 6; c.z = -5; }
  else if (type === 'boom') { a.x = -4; a.z = 0.5; b.x = -4; b.z = 1.8; c.x = 6; c.z = -5; }
  else if (type === 'phantom' || wall) { a.x = -2; a.z = 0.5; b.x = 6; b.z = -5; c.x = 6; c.z = 5; if (type === 'phantom') g.sol[6 * 20 + 6] = 1; if (type === 'classic') g.sol[6 * 20 + 6] = 1; }
  else { a.x = -4; a.z = 0.5; b.x = 6; b.z = -5; c.x = 6; c.z = 5; }
  F.forEach((f) => { f.vx = f.vz = 0; });
  g.throwFrom(me, Math.PI / 2, null, 0.2); __bg.step(70);
  const r = (f) => (f.alive ? 'alive' : 'dead') + (f.frozenT > 0 ? `+frozen${f.frozenT.toFixed(1)}` : '');
  return `${type}${wall ? '(wall)' : ''}: A=${r(a)} B=${r(b)} C=${r(c)}`;
}, type, wall);
for (const t of ['classic', 'razor', 'frost', 'chain', 'boom', 'phantom']) console.log(await run(t, false));
console.log(await run('classic', true));
console.log('errors', errors.slice(0, 6)); await browser.close();
