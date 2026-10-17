import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2.6, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
await page.goto(process.argv[2], { waitUntil: 'load' }); await sleep(3000);
await page.evaluate(() => { __bg.gfx.noAdapt = true; });
for (const q of ['sharp', 'balanced', 'fast']) {
  await page.evaluate((q) => { { const k = 'boomerangbrawl.save.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.settings = Object.assign(o.settings || {}, { quality: q }); localStorage.setItem(k, JSON.stringify(o)); } __bg.app.reloadSettings(); const s = __bg.S(); s.setup.arena = 'ice'; s.setup.bots = 3; s.setup.diff = 1; __bg.app.startMatch(); __bg.gfx.noAdapt = true; }, q);
  await sleep(5000); await page.evaluate(() => __bg.resetProf()); await sleep(5000);
  console.log(q, JSON.stringify(await page.evaluate(() => { const p = __bg.prof, r = __bg.gfx.renderer.info, c = __bg.gfx.renderer.domElement; return { canvas: [c.width, c.height], dpr: __bg.gfx.dprCur, avgFrameMs: +(p.sum / p.frames).toFixed(1), jsMs: +(p.sim / p.frames).toFixed(2), renderCpuMs: +(p.rend / p.frames).toFixed(2), calls: r.render.calls, tris: r.render.triangles, bloom: __bg.gfx.useBloom, shadow: __bg.gfx.renderer.shadowMap.enabled }; })));
  await page.screenshot({ path: `shots/v13/tier-${q}.png` });
}
console.log('errors', errors); await browser.close();
