// Simulates the Capacitor native shell (window.Capacitor injected) against mobile/www to check the IS_APP path
import { launch, sleep } from './lib.mjs';
const { browser, page, errors, logs } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
await page.evaluateOnNewDocument(() => { window.__hap = []; window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { Haptics: { impact: (o) => window.__hap.push(o) } } }; });
await page.goto('http://127.0.0.1:8124/', { waitUntil: 'load' }); await sleep(5000);
console.log(await page.evaluate(async () => ({
  sw: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).length,
  manifestLink: !!document.querySelector('link[rel=manifest]'), a2hs: !!document.getElementById('a2hs'),
  installBtn: [...document.querySelectorAll('button')].some((b) => /home screen|install/i.test(b.textContent)),
  fullscreenEl: !!document.fullscreenElement, menu: window.__bg.app.mode })));
await page.screenshot({ path: 'shots/appshell-menu.png' });
// start a match with a touch tap on Play, then fire attack and check haptics
await page.evaluate(() => window.__bg.UI && 0);
const play = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /play/i.test(b.textContent)));
await play.asElement().tap(); await sleep(1500);
await page.screenshot({ path: 'shots/appshell-after-play.png' });
const sb = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /start brawl/i.test(b.textContent))); await sb.asElement().tap(); await sleep(6000);
console.log('mode in game', await page.evaluate(() => window.__bg.app.mode));
await page.screenshot({ path: 'shots/appshell-game.png' });
const bt = await page.evaluate(() => [...document.querySelectorAll('.tbtn,.tctl [data-act],[data-act]')].map((e) => e.className + ':' + e.dataset.act).slice(0, 8)); console.log('btns', bt);
for (const sel of ['.tbtn.big', '.tbtn.small']) { const b = await page.$(sel); if (b) { const r = await b.boundingBox(); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await sleep(400); } }
console.log('haptics so far', await page.evaluate(() => window.__hap.length), 'mode', await page.evaluate(() => window.__bg.app.mode));
console.log('errors', errors); await browser.close();
