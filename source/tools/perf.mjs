import { launch, sleep } from './lib.mjs';
const W = +(process.argv[2] || 915), H = +(process.argv[3] || 330), rate = +(process.argv[4] || 4);
const { browser, page, errors, logs } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(3000);
for (const a of ['dojo', 'rooftop', 'jungle', 'ice']) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.bots = 3; s.setup.diff = 2; __bg.app.startMatch(); }, a);
  await sleep(4500); await page.evaluate(() => __bg.resetProf()); await sleep(7000);
  console.log(a, JSON.stringify(await page.evaluate(() => { const p = __bg.prof, r = __bg.gfx.renderer.info; return { frames: p.frames, avgFrameMs: +(p.sum / p.frames).toFixed(1), maxMs: +p.max.toFixed(0), jsMs: +(p.sim / p.frames).toFixed(2), renderCpuMs: +(p.rend / p.frames).toFixed(2), over34: p.over, dpr: __bg.gfx.dprCur, q: __bg.gfx.quality, calls: r.render.calls, tris: r.render.triangles, state: __bg.app.game.state, round: __bg.app.game.round }; })));
}
console.log('errors', errors); await browser.close();
