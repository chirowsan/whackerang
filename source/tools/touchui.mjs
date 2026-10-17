import { launch, sleep } from './lib.mjs';
const W = +(process.argv[2] || 915), H = +(process.argv[3] || 330), tag = process.argv[4] || 'tc', opt = process.argv[5] || '';
const { browser, page, errors, logs } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(3000);
if (opt.includes('left')) await page.evaluate(() => { __bg.S().settings.leftHanded = true; });
if (opt.includes('big')) await page.evaluate(() => { __bg.S().settings.ctrlScale = 1.4; });
if (opt.includes('small')) await page.evaluate(() => { __bg.S().settings.ctrlScale = 0.75; });
await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 0; __bg.app.startMatch(); });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => __bg.app.game.state) === 'play') break; await sleep(400); }
// keep human alive/safe for the shots
await page.evaluate(() => { const g = __bg.app.game; g.fighters.forEach((f) => { if (f.isBot) { f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false }); } }); __bg.app.applyTouch(); });
const c = (id) => page.evaluate((id) => { const r = document.querySelector(id).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width]; }, id);
await sleep(600); await page.screenshot({ path: `shots/${tag}-1-idle.png` });
console.log('layout', JSON.stringify(await page.evaluate(() => { const r = (id) => { const b = document.querySelector(id).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { joy: r('#joybase'), aim: r('#aimbase'), dash: r('#btnDash'), def: r('#btnDef'), pause: r('#btnPause'), reserve: [Math.round(__bg.gfx.reserveL), Math.round(__bg.gfx.reserveR)] }; })));
// pressed: hold dash
const [dx, dy] = await c('#btnDash'); const hd = await page.touchscreen.touchStart(dx, dy); await sleep(250); await page.screenshot({ path: `shots/${tag}-2-pressed-dash.png` }); await hd.end();
await sleep(150); await page.screenshot({ path: `shots/${tag}-3-cooldown-dash.png` });
const [fx, fy] = await c('#btnDef'); const hf = await page.touchscreen.touchStart(fx, fy); await sleep(200); await page.screenshot({ path: `shots/${tag}-4-pressed-deflect.png` }); await hf.end(); await sleep(200); await page.screenshot({ path: `shots/${tag}-5-cooldown-both.png` });
await sleep(1200);
// joystick active + aim charging
const lh = opt.includes('left'); const jx = lh ? W - 120 : 110, ax = lh ? 140 : W - 200;
const j = await page.touchscreen.touchStart(jx, H - 100); await sleep(100); await j.move(jx + (lh ? -34 : 34), H - 118); await sleep(150);
const a = await page.touchscreen.touchStart(ax, H * 0.45); await sleep(200); await a.move(ax + (lh ? 40 : -40), H * 0.45 - 30); await sleep(500); await page.screenshot({ path: `shots/${tag}-6-charging.png` });
await sleep(1500); await page.screenshot({ path: `shots/${tag}-7-charged-full.png` });
console.log('hud', JSON.stringify(await page.evaluate(() => __bg.Input.touch.hud)));
await a.end(); await j.end(); await sleep(300); await page.screenshot({ path: `shots/${tag}-8-after-throw.png` });
console.log('errors', errors);
await browser.close();
