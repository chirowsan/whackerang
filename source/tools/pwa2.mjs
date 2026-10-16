import { execSync } from 'child_process';
import { launch, sleep } from './lib.mjs';
const { browser, page, errors, logs } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
// iOS emulation: hint appears, no install button crash
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
await page.goto('http://127.0.0.1:8123/', { waitUntil: 'load' }); await sleep(5500);
console.log('ios hint', await page.evaluate(() => !!document.getElementById('a2hs')), 'installBtn', await page.evaluate(() => [...document.querySelectorAll('#ui button')].some((b) => /Add to Home/.test(b.textContent))));
await page.screenshot({ path: 'shots/pwa-ios-hint.png' });
await page.evaluate(() => document.getElementById('a2hs') && document.getElementById('a2hs').click()); await sleep(500);
await page.screenshot({ path: 'shots/pwa-ios-menu.png' });
console.log('audio', await page.evaluate(() => 'AudioContext' in window || 'webkitAudioContext' in window));
// SW update flow: rebuild with a new tag, reload, old cache must be deleted
const before = await page.evaluate(async () => (await caches.keys()));
console.log('caches before', before, 'errors', errors);
await browser.close();
