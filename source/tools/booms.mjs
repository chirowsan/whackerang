// In-arena close-ups: node tools/arenachars.mjs tag [arena] [W H]
import { launch, sleep } from './lib.mjs';
const tag = process.argv[2] || 'ac', arena = process.argv[3] || 'jungle', W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
const { browser, page, errors } = await launch({ w: W, h: H });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2500);
await page.evaluate((arena) => { const s = __bg.S(); s.setup.arena = arena; s.setup.bots = 3; __bg.app.startMatch(); }, arena);
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => __bg.app.game.state) === 'play') break; await sleep(300); }
await page.evaluate(() => {
  const a = __bg.app; a.paused = true; const g = a.game; g.fighters.forEach((f) => { f.model.root.visible = false; });
  window.__row = []; __bg.HEROES.forEach((h, i) => { const m = __bg.buildBoomerang([0xffd23c, 0xff5a8a, 0x4fd1ff, 0x7dff6a, 0xffd23c, 0xff5a8a][i], h); m.position.set(-3.75 + i * 1.5, 0.6, 0.5); m.scale.setScalar(1.8); m.rotation.x = 0.0; g.scene.add(m); window.__row.push(m); });
  const gf = __bg.gfx; gf.freeCam = true; gf.camera.clearViewOffset(); gf.camBase.set(0, 6, 8); gf.camTarget.set(0, 0.5, 0.5);
  document.querySelectorAll('#hud, .hud, #touch').forEach((e) => { e.style.display = 'none'; });
});
const poses = {
  idle: { move: 0, t: 1.1 }, idle2: { move: 0, t: 2.2, expr: 'smug' }, run: { move: 1, t: 0.31 }, run2: { move: 1, t: 0.52 }, charge: { move: 0.3, t: 1, charge: 0.9 }, throw: { move: 0, t: 1, throwT: 0.7 }, dash: { move: 1, t: 1, dash: 0.8 },
  win: { move: 0, t: 0.45, win: true }, scared: { move: 0, t: 1, scared: 1 }, ko: { move: 0, t: 0.2, dead: true }, catch: { move: 0, t: 1, catchPop: 0.2, happy: 1 },
};
console.log(await page.evaluate(() => JSON.stringify([__bg.gfx.camera.position.toArray(), __bg.gfx.camBase.toArray()])));
const only = process.argv[6] ? process.argv[6].split(',') : Object.keys(poses);
for (const k of ['a']) {
  await page.evaluate(() => { window.__row.forEach((m, i) => { m.userData.inner.rotation.y = 0.3 + i * 0.2; }); const gf = __bg.gfx; gf.camBase.set(0, 6, 8); gf.camTarget.set(0, 0.5, 0.5); __bg.camNow(); __bg.renderNow(); });
  await sleep(1200); await page.evaluate(() => { const gf = __bg.gfx; gf.camBase.set(0, 6, 8); gf.camTarget.set(0, 0.5, 0.5); __bg.camNow(); __bg.renderNow(); }); await sleep(1200); await page.screenshot({ captureBeyondViewport: false, path: `shots/${tag}-booms.png`, clip: { x: W * 0.05, y: H * 0.18, width: W * 0.9, height: H * 0.6 } });
}
console.log(errors); await browser.close();
