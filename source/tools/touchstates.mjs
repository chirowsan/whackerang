import { launch, sleep } from './lib.mjs';
const W = +(process.argv[2] || 915), H = +(process.argv[3] || 330), tag = process.argv[4] || 'ts', opt = process.argv[5] || '';
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(3000);
await page.evaluate((opt) => { const s = __bg.S(); if (opt.includes('left')) s.settings.leftHanded = true; if (opt.includes('big')) s.settings.ctrlScale = 1.4; if (opt.includes('small')) s.settings.ctrlScale = 0.75; s.setup.arena = 'jungle'; s.setup.bots = 3; __bg.app.startMatch(); }, opt);
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => __bg.app.game.state) === 'play') break; await sleep(400); }
await page.evaluate(() => { __bg.app.game.fighters.forEach((f) => { if (f.isBot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false }); }); __bg.app.applyTouch(); const T = __bg.Input.touch, o = T.sync; T.sync = (h) => o(window.__force || h); });
const force = async (f, n) => { await page.evaluate((f) => { window.__force = f; }, f); await sleep(700); await page.screenshot({ path: `shots/${tag}-${n}.png` }); };
await force({ charge: 0, dash: 0, defl: 0, ammo: 1 }, 'a-idle');
await force({ charge: 0, dash: 0.62, defl: 0.35, ammo: 1 }, 'b-cooldown');
await force({ charge: 0, dash: 0, defl: 0, ammo: 0 }, 'c-empty');
const lh = opt.includes('left'); const ax = lh ? 160 : W - 200;
const a = await page.touchscreen.touchStart(ax, H * 0.45); await sleep(150); await a.move(ax + (lh ? 36 : -36), H * 0.45 - 26);
await force({ charge: 0.55, dash: 0, defl: 0, ammo: 1 }, 'd-charge-mid'); await force({ charge: 1, dash: 0, defl: 0, ammo: 1 }, 'e-charge-full'); await a.end();
console.log(JSON.stringify(await page.evaluate(() => { const r = (id) => { const b = document.querySelector(id).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { joy: r('#joybase'), aim: r('#aimbase'), dash: r('#btnDash'), def: r('#btnDef'), pause: r('#btnPause'), reserve: [Math.round(__bg.gfx.reserveL), Math.round(__bg.gfx.reserveR)] }; })), errors);
await browser.close();
