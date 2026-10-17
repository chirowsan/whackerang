import { launch, sleep } from './lib.mjs';
const tier = process.argv[2] || 'sharp', rate = +(process.argv[3] || 4), url = process.argv[4] || 'file:///workspace/boomerang-brawl/Whackerang.html', old = process.argv[5] === 'old';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2.6, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto(url); await sleep(3000);
await page.evaluate((t) => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = t; s.settings.events = 'some'; if (__bg.gfx.noAdapt !== undefined || true) __bg.gfx.noAdapt = false; __bg.setQuality && __bg.setQuality(t); }, tier);
await sleep(500);
for (const [a, z] of [['dojo', 'small'], ['volcano', 'large'], ['space', 'huge'], ['haunted', 'large']]) {
  await page.evaluate((z) => { window.__z = z; }, z); await page.evaluate((a, old) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = window.__z; s.setup.traps = 'some'; s.setup.bots = 3; s.setup.diff = 2; old ? __bg.app.startMatch() : __bg.app.startMode('classic'); }, a, old);
  await sleep(4500); await page.evaluate(() => __bg.resetProf()); await sleep(7000);
  console.log(tier, a, z, JSON.stringify(await page.evaluate(() => { const p = __bg.prof, r = __bg.gfx.renderer.info; return { frames: p.frames, avgMs: +(p.sum / p.frames).toFixed(1), maxMs: +p.max.toFixed(0), jsMs: +(p.sim / p.frames).toFixed(2), rendCpuMs: +(p.rend / p.frames).toFixed(2), over34: p.over, dpr: +__bg.gfx.dprCur.toFixed(2), calls: r.render.calls, tris: r.render.triangles }; })));
}
console.log('errors', errors.slice(0, 5)); await browser.close();
