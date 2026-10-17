// Visual scenes for v3.2 (frozen game, manual stepping). usage: node tools/v32scenes.mjs <html> <outdir> [w h]
import { launch, sleep } from './lib.mjs';
const [file, out, W = 915, H = 412] = [process.argv[2], process.argv[3], +process.argv[4] || 915, +process.argv[5] || 412];
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.goto('file://' + file); await sleep(2500);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.settings.events = 'off'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 1; s.setup.traps = 'off'; __bg.app.quickPlay(); });
await sleep(500);
await page.evaluate(() => { const a = __bg.app; a.paused = true; const g = a.game; g.state = 'play'; g.introT = 0; const me = g.fighters.find((f) => !f.isBot); const bots = g.fighters.filter((f) => f !== me); window.__me = me; window.__bots = bots; me.x = -5; me.z = 0.5; bots[0].x = 1.5; bots[0].z = 0.5; bots[1].x = 6; bots[1].z = -3; bots[2].x = 6; bots[2].z = 3.5; for (const f of bots) { const o = f.bot.update.bind(f.bot); f.bot.update = (dt) => { const r = o(dt); r.mx = 0; r.mz = 0; r.fire = false; r.dash = false; r.deflect = false; r.ult = false; return r; }; } const ir = g.input.read.bind(g.input); g.input.read = (sl, f) => { const r = ir(sl, f); if (r) { r.mx = 0; r.mz = 0; r.fire = false; r.dash = false; } return r; }; for (const f of g.fighters) { f.vx = f.vz = 0; f.inv = 0; f.spawnT = 1; } __bg.camNow(); });
await page.evaluate(() => { const g = __bg.app.game; __bg.step(30); __bg.renderNow(); }); await sleep(300); await shot('s1-marker');
// throw -> flight
await page.evaluate(() => { const g = __bg.app.game; g.throwFrom(window.__me, Math.PI / 2, true, 0.8); __bg.step(8); __bg.renderNow(); }); await sleep(200); await shot('s2-flight');
// step until KO then stop at hitstop
const ko = await page.evaluate(() => { const g = __bg.app.game; let n = 0; while (window.__bots[0].alive && n < 400) { __bg.step(1); n++; } __bg.step(2); __bg.renderNow(); return [n, g.hitstop, window.__bots[0].alive]; }); console.log('ko', ko); await sleep(120); await shot('s3-impact');
await page.evaluate(() => { __bg.step(4); __bg.renderNow(); }); await sleep(100); await shot('s3b-impact');
// player gets hit: hurt flash
await page.evaluate(() => { const g = __bg.app.game; g.hitstop = 0; const me = window.__me; me.die(window.__bots[1], 'boom', 1, 0); __bg.step(3); __bg.renderNow(); }); await sleep(60); await shot('s4-hurt');
console.log('errors', errors.slice(0, 6)); await browser.close();
