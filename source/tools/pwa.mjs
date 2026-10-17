import fs from 'fs';
import { launch, sleep } from './lib.mjs';
const URL = process.argv[2] || 'http://127.0.0.1:8123/'; const shots = process.argv.includes('--shots');
const { browser, page, errors, logs } = await launch({ w: 1280, h: 720 });
const R = {};
await page.goto(URL, { waitUntil: 'load' }); await sleep(4000);
if (shots) { await page.screenshot({ path: 'pwa/screenshots/menu.png' }); await page.evaluate(() => { __bg.S().setup.arena = 'dojo'; __bg.app.startMatch(); }); await sleep(6000); await page.screenshot({ path: 'pwa/screenshots/play.png' }); await browser.close(); process.exit(0); }
R.build = logs.find((l) => l.includes('Whackerang v')) || '';
R.manifestLink = await page.evaluate(() => document.querySelector('link[rel=manifest]') && document.querySelector('link[rel=manifest]').href);
R.appleIcon = await page.evaluate(() => !!document.querySelector('link[rel=apple-touch-icon]'));
R.splashLinks = await page.evaluate(() => document.querySelectorAll('link[rel=apple-touch-startup-image]').length);
const man = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); return r.json(); });
R.manifest = { display: man.display, orientation: man.orientation, icons: man.icons.map((i) => i.sizes + ':' + i.purpose), id: man.id, start: man.start_url };
await page.evaluate(() => navigator.serviceWorker.ready); await sleep(1500);
R.sw = await page.evaluate(async () => ({ controller: !!navigator.serviceWorker.controller, scope: (await navigator.serviceWorker.getRegistration()).scope, caches: await caches.keys() }));
if (!R.sw.controller) { await page.reload({ waitUntil: 'load' }); await sleep(2500); R.sw.controller = await page.evaluate(() => !!navigator.serviceWorker.controller); }
R.cached = await page.evaluate(async () => { const k = (await caches.keys())[0]; const c = await caches.open(k); return (await c.keys()).map((r) => new URL(r.url).pathname); });
// installability: manifest icons reachable
R.iconsOk = await page.evaluate(async () => { const out = {}; for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'splash/splash-2532x1170.png', 'screenshots/menu.png']) { const r = await fetch(f); out[f] = r.status; } return out; });
// offline
await page.setOfflineMode(true); await page.reload({ waitUntil: 'load' }).catch((e) => { R.offlineErr = e.message; }); await sleep(3500);
R.offline = await page.evaluate(() => ({ title: document.title, hasGame: !!window.__bg, ui: window.__bg && __bg.UI.cur, mode: window.__bg && __bg.app.mode }));
await page.setOfflineMode(false);
// synthetic install prompt -> menu button
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await sleep(800); R.installBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#ui button')].find((x) => /Install/.test(x.textContent)); if (b) b.click(); return !!b && !!window.__prompted; });
// hardening
R.hard = await page.evaluate(() => { const cs = getComputedStyle(document.body); const ev = new Event('contextmenu', { cancelable: true }); document.body.dispatchEvent(ev); const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g); return { overscroll: cs.overscrollBehaviorY, userSelect: cs.userSelect, callout: cs.webkitTouchCallout, ctxPrevented: ev.defaultPrevented, gesturePrevented: g.defaultPrevented, wakeLockApi: 'wakeLock' in navigator, orientationLock: !!(screen.orientation && screen.orientation.lock) }; });
console.log(JSON.stringify(R, null, 1)); console.log('errors', errors);
await browser.close();
