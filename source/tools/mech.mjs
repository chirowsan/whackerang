import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
await page.evaluate(() => { const bg = __bg; bg.fx.popKeep = true; const s = bg.S(); s.setup = { ...s.setup, bots: 1, diff: 0, arena: 'rooftop', rounds: 3 }; bg.app.startMatch(); bg.app.paused = true; bg.step(200); const g = bg.app.game; const me = g.fighters[0], b = g.fighters[1]; b.bot = null; b.isBot = false; b.def = { ...b.def }; me.x = -4; me.z = 0; b.x = 6; b.z = 2.5; const T = bg.Input.touch; T.enabled = true; T.fire = true; T.aimX = 1; T.aimZ = 0.15; bg.step(25); bg.renderNow(); });
await sleep(400); await page.screenshot({ path: 'shots/mech-charge.png' });
await page.evaluate(() => { const bg = __bg, T = bg.Input.touch; T.fire = false; T.fireQ = 1; bg.step(2); T.aimX = T.aimZ = 0; bg.step(12); bg.renderNow(); });
await sleep(400); await page.screenshot({ path: 'shots/mech-throw.png' });
// deflect: give the other fighter a deflect when boomerang near
const r = await page.evaluate(() => { const bg = __bg, g = bg.app.game, T = bg.Input.touch; let out = []; const b = g.fighters[1]; for (let i = 0; i < 90; i++) { bg.step(1); const bm = g.booms[0]; if (bm && Math.hypot(bm.x - b.x, bm.z - b.z) < 2.2 && b.deflectCd <= 0 && b.deflectT <= 0) { b.deflectT = 0.3; b.deflectCd = .85; bg.step(3); out.push('deflect at ' + i); bg.renderNow(); break; } } return out.join() + ' booms=' + g.booms.length + ' alive=' + g.fighters.map((f) => f.alive).join(); });
console.log(r); await sleep(400); await page.screenshot({ path: 'shots/mech-deflect.png' });
console.log(errors); await browser.close();
