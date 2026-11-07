// calm frozen comparison frame: same seed/map/positions, bots frozen, no traps/events/ults; only the build (camera framing) differs.
// usage: node tools/calmshot412.mjs <html> <out.png> <w> <h>
import { launch, sleep } from './lib.mjs';
const [html, out, W, H] = process.argv.slice(2);
const { browser, page } = await launch({ w: +W, h: +H, dpr: 1, mobile: true }); await page.goto('file://' + html); await sleep(2500);
const r = await page.evaluate(() => { let sd = 99; Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const S = __bg.S(); S.tutorialDone = true; S.settings.touch = 'on'; S.settings.events = 'off'; S.settings.camera = 'close'; S.setup.arena = 'space'; S.setup.size = 'large'; S.setup.traps = 'off'; S.setup.bots = 3; S.hero = 'kuma'; S.loadout = [{ kuma: 'kuma_anchor' }, {}];
  __bg.app.applyTouch(); __bg.app.startMode('classic'); __bg.app.paused = true; const g = __bg.app.game; let k = 0; while (g.state !== 'play' && k++ < 3000) __bg.step(1);
  const P = [[-3, 1.5], [3.5, -2], [5.5, 2.5], [-6.5, -2.5]]; g.fighters.forEach((f, i) => { f.bot = f.isBot ? { update: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) } : f.bot; f.x = P[i][0]; f.z = P[i][1]; f.vx = f.vz = 0; f.ult = 0; f.ultT = 0; });
  for (let i = 0; i < 30; i++) { g.fighters.forEach((f, j) => { f.x = P[j][0]; f.z = P[j][1]; }); __bg.step(1); } __bg.app.paused = false; __bg.app.applyTouch(); return [g.fighters.map((f) => f.hero.id), getComputedStyle(document.getElementById("touch")).display]; });
await sleep(700); await page.screenshot({ path: out }); console.log(JSON.stringify(r)); await browser.close();
