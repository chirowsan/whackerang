// before/after sharpness + layout shots at DPR 2.6, 915x412. usage: node tools/sharp.mjs <url> <prefix> [quality]
import { launch, sleep } from './lib.mjs';
const [url, prefix, q] = [process.argv[2], process.argv[3], process.argv[4]];
const { browser, page, errors, logs } = await launch({ w: 915, h: 412, dpr: 2.6, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
await page.goto(url, { waitUntil: 'load' }); await sleep(3500);
if (q) { await page.evaluate((q) => { const s = __bg.S(); s.settings.quality = q; __bg.gfx && 0; __bg.app.reloadSettings(); }, q); }
await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'jungle'; s.setup.bots = 3; s.setup.diff = 1; __bg.app.startMatch(); });
await sleep(5500);
await page.screenshot({ path: `shots/v13/${prefix}-play.png` });
await page.evaluate(() => __bg.resetProf()); await sleep(6000);
console.log(JSON.stringify(await page.evaluate(() => { const p = __bg.prof, r = __bg.gfx.renderer.info, c = __bg.gfx.renderer.domElement; return { canvas: [c.width, c.height, c.clientWidth, c.clientHeight], dprCur: __bg.gfx.dprCur, q: __bg.gfx.quality, setting: __bg.gfx.qSetting, avgFrameMs: +(p.sum / p.frames).toFixed(1), renderCpuMs: +(p.rend / p.frames).toFixed(2), calls: r.render.calls, tris: r.render.triangles, devicePixelRatio }; })));
console.log('errors', errors); await browser.close();
