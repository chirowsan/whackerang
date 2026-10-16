import { launch, sleep } from './lib.mjs';
const { browser, page, errors, logs } = await launch({ w: 1280, h: 720 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2500);
await page.evaluate(() => { __bg.S().setup.arena = 'ice'; __bg.app.startMatch(); }); await sleep(800); await page.evaluate(() => __bg.step(60 * 4)); await sleep(300);
await page.evaluate(() => __bg.app.pause());
for (let i = 0; i < 4; i++) { await sleep(700); console.log(await page.evaluate(() => ({ lost: __bg.gfx.renderer.getContext().isContextLost(), paused: __bg.app.paused, fr: __bg.prof.frames, nan: __bg.gfx.camera.position.toArray(), bloom: __bg.gfx.useBloom }))); await page.screenshot({ path: `shots/blank-${i}.png` }); }
console.log(errors, logs.slice(-5)); await browser.close();
