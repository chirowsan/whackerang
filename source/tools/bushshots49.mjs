// v4.9 bushes screenshots: per-arena bush layout + same scene from the hider's view vs an opponent's view + attack reveal. usage: node tools/bushshots49.mjs <outdir> [w h]
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const [out, W = '915', H = '412'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: +W, h: +H, dpr: 1, mobile: +W < 1000 }); await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const clean = () => page.evaluate(() => { for (const id of ['countdown', 'edgewarn']) { const c = document.getElementById(id); if (c) c.className = ''; } document.querySelectorAll('.popup,.pop').forEach((e) => e.remove()); });
const setup = (a, size) => page.evaluate(({ a, size }) => { let s = 4242; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = a; S.setup.size = size; S.setup.traps = 'some'; S.setup.bots = 3; S.setup.diff = 1;
  __bg.app.startMode('classic'); __bg.app.paused = true; const g = __bg.app.game; g.state = 'play'; g.introT = 0; g.cdDone = true; g.onEvent('cdclear');
  const [HX, HZ] = __bg.hxz(); const AW = HX * 2, B = g.layout.bush; let spot = null; for (let k = 0; k < B.length; k++) { if (B[k] && B[k + 1] && B[k + AW] && B[k + AW + 1]) { const i = k % AW, j = (k / AW) | 0; const x = i - HX + 1, z = j - HZ + 1; if (!spot || x < spot[0] - 0.1 && Math.abs(z) <= Math.abs(spot[1]) + 2) spot = [x, z]; } }
  const still = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }); g.fighters.forEach((f) => { if (f.bot) f.bot.update = still; f.lives = 9; }); g.input = { read: still };
  const [Y, A, Bf, C] = g.fighters; Y.x = spot[0]; Y.z = spot[1]; A.x = spot[0] + 4.2; A.z = spot[1] * 0.4; Bf.x = spot[0] + 5.5; Bf.z = spot[1] * 0.4 + 1.6; C.x = spot[0] + 3.2; C.z = spot[1] * 0.4 - 2.2; g.fighters.forEach((f) => { f.face = Math.atan2(Y.x - f.x, Y.z - f.z); f.vface = f.face; });
  Y.face = Y.vface = Math.PI / 2; for (let q = 0; q < 30; q++) __bg.step(1); window.__spot = spot; return { spot, hid: Y.hid, bushN: g.bushN }; }, { a, size });
const shot = async (name) => { await page.evaluate(() => { __bg.app.game.vis(0); __bg.renderNow(); }); await clean(); await sleep(250); await page.screenshot({ path: `${out}/${name}.png` }); };
for (const a of (process.env.ARENAS || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',')) {
  const size = process.env.SIZE || 'large'; const info = await setup(a, size);
  await shot(`${a}-${size}-hider-view-${W}x${H}`);
  const v2 = await page.evaluate(() => { const g = __bg.app.game; g.viewIdx = 1; g.vis(0); const Y = g.fighters[0]; return { shown: Y.model.root.visible }; }); await shot(`${a}-${size}-opponent-view-${W}x${H}`);
  const v3 = await page.evaluate(() => { const g = __bg.app.game; const Y = g.fighters[0]; Y.ammo = 1; Y.throwCd = 0; g.throwFrom(Y, Math.PI / 2, true, 0.6); for (let q = 0; q < 8; q++) __bg.step(1); g.vis(0); return { shown: Y.model.root.visible, hid: Y.hid, rev: +(Y.revealT || 0).toFixed(2), booms: g.booms.length }; }); await shot(`${a}-${size}-opponent-view-attack-reveal-${W}x${H}`);
  await page.evaluate(() => { const g = __bg.app.game; g.viewIdx = undefined; }); console.log(a, JSON.stringify({ info, v2, v3 }));
}
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
