// v4.9 hero / hazard focus crops (same seed + frame for before/after). A switch is fired so a lethal trap shows its telegraph, then active state.
// usage: node tools/focus49.mjs <url> <outdir>
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: 1280, h: 720, dpr: 2, mobile: false }); await page.goto(url); await sleep(2500);
for (const a of ['dojo', 'space', 'volcano', 'jungle']) {
  const r = await page.evaluate((a) => { let s = 777; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = a; S.setup.size = 'large'; S.setup.traps = 'some'; S.setup.bots = 3; S.setup.diff = 0;
    __bg.app.startMode('classic'); __bg.app.paused = true; __bg.step(240); const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; f.bot = null; f.isBot = false; });
    const sw = g.traps.sw.find((q) => q.targets && q.targets.some((t) => t.lethal)); const t = sw && sw.targets.find((t) => t.lethal);
    // park heroes near the trap so hero-vs-ground contrast and the hazard are in one crop
    const cx = t ? t.x : 0, cz = t ? t.z : 0; g.fighters.forEach((f, i) => { const c = g.safeCell({ x: cx + [-2.4, 2.4, -1.2, 1.2][i], z: cz + [1.6, 1.6, -1.8, -1.8][i], _self: f }, false); if (c) { f.x = c[0] !== undefined ? c[0] : c.x; f.z = c[1] !== undefined ? c[1] : c.z; } f.vx = f.vz = 0; });
    if (sw) g.traps.fire(sw, g.fighters[0]); __bg.step(8); __bg.renderNow(); const q = __bg.toScreen(cx, 0, cz); const p = { x: q[0] * 1280, y: q[1] * 720 }; return { has: !!t, type: t && t.type, st: t && t.st, p };
  }, a);
  const clip = { x: Math.max(0, Math.min(1280 - 640, r.p.x - 320)), y: Math.max(0, Math.min(720 - 400, r.p.y - 200)), width: 640, height: 400 };
  await sleep(500); await page.evaluate(() => { for (const id of ['countdown', 'edgewarn']) { const c = document.getElementById(id); if (c) c.className = ''; } }); await page.screenshot({ path: `${out}/${a}-telegraph.png`, clip });
  await page.evaluate(() => { __bg.step(40); __bg.renderNow(); }); await sleep(300); await page.screenshot({ path: `${out}/${a}-active.png`, clip });
  console.log(a, JSON.stringify(r));
}
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
