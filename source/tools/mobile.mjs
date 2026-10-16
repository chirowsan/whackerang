import { launch, sleep } from './lib.mjs';
const W = +(process.argv[2] || 915), H = +(process.argv[3] || 330), tag = process.argv[4] || 'm';
const { browser, page, logs, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(3500);
console.log(logs.filter((l) => l.includes('Boomerang')));
await page.screenshot({ path: `shots/${tag}-menu.png` });
const tapSel = async (txt) => { const r = await page.evaluate((txt) => { const b = [...document.querySelectorAll('#ui button')].find((x) => x.textContent.includes(txt)); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, txt); if (!r) { console.log('no btn', txt); return false; } await page.touchscreen.tap(r[0], r[1]); await sleep(500); return true; };
await tapSel('Play'); await sleep(400); await page.screenshot({ path: `shots/${tag}-setup.png` });
await tapSel('START'); await sleep(600);
await page.evaluate(() => { const o = __bg.app.gameEvent.bind(__bg.app); window.__cnt = {}; __bg.app.gameEvent = (n, d) => { __cnt[n] = (__cnt[n] || 0) + 1; o(n, d); }; });
// wait for fight
for (let i = 0; i < 40; i++) { const st = await page.evaluate(() => __bg.app.game.state); if (st === 'play') break; await sleep(500); }
console.log('state', await page.evaluate(() => ({ st: __bg.app.game.state, touch: __bg.Input.touch.enabled, q: __bg.gfx.quality, dpr: __bg.gfx.dprCur, w: __bg.gfx.w, h: __bg.gfx.h, shadow: __bg.gfx.sun.castShadow, bloom: __bg.gfx.useBloom, rot: getComputedStyle(document.getElementById('rotate')).display, touchOff: document.getElementById('touch').className })));
await page.evaluate(() => __bg.resetProf());
// joystick: left zone
const j = await page.touchscreen.touchStart(120, 250); await sleep(200); await j.move(190, 230); await sleep(500);
const a = await page.touchscreen.touchStart(700, 200); await sleep(150); await a.move(640, 150); await sleep(300); await page.screenshot({ path: `shots/${tag}-aim.png` });
console.log('touch state', await page.evaluate(() => ({ ...__bg.Input.touch })));
await a.end(); await sleep(400);
// quick tap auto-aim
await page.touchscreen.tap(700, 200); await sleep(400);
// dash button
const db = await page.evaluate(() => { const r = document.getElementById('btnDash').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await page.touchscreen.tap(db[0], db[1]); await sleep(300);
const df = await page.evaluate(() => { const r = document.getElementById('btnDef').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await page.touchscreen.tap(df[0], df[1]); await sleep(300);
await j.end();
await sleep(4000);
await page.screenshot({ path: `shots/${tag}-play.png` });
const out = await page.evaluate(() => { const p = __bg.prof; return { cnt: __cnt, frames: p.frames, avgFrameMs: +(p.sum / p.frames).toFixed(1), maxMs: +p.max.toFixed(0), jsMs: +(p.sim / p.frames).toFixed(2), renderCpuMs: +(p.rend / p.frames).toFixed(2), over34: p.over, dpr: __bg.gfx.dprCur, quality: __bg.gfx.quality, st: __bg.app.game.state, tris: __bg.gfx.renderer.info.render.triangles, calls: __bg.gfx.renderer.info.render.calls }; });
console.log(JSON.stringify(out)); console.log('errors', errors);
await browser.close();
