// v4.1: close-up of each trap type (caught in its pre-activation warning where it has one) for the lineup montage.
import { launch, sleep } from './lib.mjs';
import fs from 'fs';
const OUT = process.env.OUT || '/workspace/boomerang-brawl/shots/v41/close/'; fs.mkdirSync(OUT, { recursive: true });
const arenas = ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted'];
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: false });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.quality = 'fast'; s.settings.touch = 'off'; s.settings.camera = 'close'; __bg.app.reloadSettings(); });
const done = new Set();
for (const a of arenas) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'wild'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a); await sleep(400);
  let types = [];
  for (let tryN = 0; tryN < 8; tryN++) { types = await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; }); __bg.step(200); return [...new Set(g.traps.list.map((t) => t.type))]; }); if (a !== 'jungle' || types.includes('pit') || done.has('pit')) break; await page.evaluate((a) => { __bg.app.startMode('classic'); }, a); await sleep(300); }
  for (const ty of types) {
    if (done.has(ty)) continue; done.add(ty);
    await page.evaluate((ty) => {
      const g = __bg.app.game; __bg.app.paused = false; const me = g.fighters.find((f) => !f.isBot); const bots = g.fighters.filter((f) => f !== me);
      const tr = g.traps.list.find((t) => t.type === ty); window.__tr = tr; bots.forEach((b) => { b.x = 40; b.z = 40; });
      let n = 0; if (tr.haz) while (n < 500 && tr.haz.lvl() !== 1) { __bg.step(1); n++; }
      window.__pos = () => { me.x = tr.x + (ty === 'tele' ? 1.5 : 0); me.z = tr.z + (ty === 'tele' ? 2.2 : 3.0); me.vx = me.vz = 0; }; window.__pos(); window.__hold = setInterval(window.__pos, 16);
    }, ty);
    await sleep(900);
    await page.evaluate(() => { clearInterval(window.__hold); __bg.app.paused = true; }); await sleep(500);
    await page.screenshot({ path: OUT + ty + '.png' }); await page.evaluate(() => { __bg.app.paused = false; });
  }
}
if (true) { // pit rarely finds room in the stock sets: place one by hand so its look can be checked
  await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'jungle'; s.setup.size = 'large'; s.setup.traps = 'some'; __bg.app.startMode('classic'); }); await sleep(400);
  const made = await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; }); __bg.step(200); let m = null; for (const l of ['c','r2','q4','x2','row']) { try { m = g.traps.mk_pit(l, {}); } catch (e) {} if (m) break; } return !!m; });
  if (made) { done.add('pit'); await page.evaluate(() => { const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot); g.fighters.filter((f) => f !== me).forEach((b) => { b.x = 40; b.z = 40; }); const tr = g.traps.list.find((t) => t.type === 'pit'); window.__tr = tr; let n = 0; while (n < 500 && tr.haz.lvl() !== 1) { __bg.step(1); n++; } window.__pos = () => { me.x = tr.x; me.z = tr.z + 3.0; me.vx = me.vz = 0; }; window.__pos(); window.__hold = setInterval(window.__pos, 16); }); await sleep(900); await page.evaluate(() => { clearInterval(window.__hold); __bg.app.paused = true; }); await sleep(500); await page.screenshot({ path: OUT + 'pit.png' }); }
}
console.log(JSON.stringify({ shot: [...done], errors: errors.filter((e) => !/favicon/.test(e)) }));
await browser.close();
