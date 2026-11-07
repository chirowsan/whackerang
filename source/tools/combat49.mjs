// v4.9 busy 4-fighter combat frame, same seed/frame for any build. usage: node tools/combat49.mjs <url> <outdir> [w h mobile]
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const [url, out, W = '915', H = '412', MOB = '1'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: +W, h: +H, dpr: 1, mobile: MOB === '1' }); await page.goto(url); await sleep(2500);
for (const a of (process.env.ARENAS || 'dojo,space,volcano,jungle').split(',')) {
  const info = await page.evaluate((a) => { let s = 4242; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = a; S.setup.size = 'large'; S.setup.traps = 'some'; S.setup.bots = 3; S.setup.diff = 2;
    __bg.app.startMode('classic'); __bg.app.paused = true; __bg.autoplay(2); const g = __bg.app.game; g.fighters.forEach((f) => { f.lives = 99; });
    // pull everyone toward the middle so the frame is a real 4-way scrap
    __bg.step(200); g.fighters.forEach((f, i) => { const c = g.safeCell({ x: [-1.5, 1.5, -1.5, 1.5][i], z: [-1.2, -1.2, 1.2, 1.2][i], _self: f }, false); if (c) { f.x = c[0] !== undefined ? c[0] : c.x; f.z = c[1] !== undefined ? c[1] : c.z; } });
    let best = 0; for (let k = 0; k < 40; k++) { __bg.step(6); g.fighters.forEach((f) => { f.lives = 99; f.hp = Math.max(f.hp, 2); }); if (g.booms.length >= 3) { best = g.booms.length; break; } }
    __bg.renderNow(); return { booms: g.booms.length, alive: g.fighters.filter((f) => f.alive).length, state: g.state }; }, a);
  await sleep(600); await page.evaluate(() => { for (const id of ['countdown', 'edgewarn']) { const c = document.getElementById(id); if (c) c.className = ''; } }); await sleep(200);
  await page.screenshot({ path: `${out}/${a}-combat-${W}x${H}.png` }); console.log(a, JSON.stringify(info));
}
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
