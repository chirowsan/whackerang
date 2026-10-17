// Real touch events (CDP) on a large map: stick moves, drag-throw, dash button, store gate via tap. Then screenshot.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
const cdp = await page.createCDPSession();
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'fast'; s.settings.events = 'off'; s.setup.arena = 'pirate'; s.setup.size = 'large'; s.setup.traps = 'some'; s.setup.bots = 2; s.setup.diff = 0; __bg.app.reloadSettings(); __bg.app.startMode('classic'); });
await sleep(3500);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const pos = () => page.evaluate(() => { const f = __bg.app.game.fighters[0]; return [+f.x.toFixed(2), +f.z.toFixed(2), f.ammo, __bg.app.game.fighters[0].alive]; });
const p0 = await pos();
const stick = [75, 330];
await touch('touchStart', [stick]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[stick[0] + i * 6, stick[1]]]); await sleep(120); } await sleep(700); const p1 = await pos(); await touch('touchEnd', []);
console.log('move', p0, '->', p1, p1[0] > p0[0] + 0.5 ? 'OK' : 'FAIL');
const thrown = await page.evaluate(() => { window.__tb = 0; const g = __bg.app.game; return g.booms ? g.booms.length : -1; });
await touch('touchStart', [[840, 300]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[840 + i * 5, 300 - i * 8]]); await sleep(60); } await touch('touchEnd', []); await sleep(250);
const after = await page.evaluate(() => { const g = __bg.app.game; return [g.booms ? g.booms.length : -1, g.fighters[0].ammo]; }); console.log('throw booms before', thrown, 'after', after, after[1] < 1 || after[0] > thrown ? 'OK' : 'FAIL');
const d0 = await page.evaluate(() => __bg.app.game.fighters[0].dashT || 0); await touch('touchStart', [[735, 345]]); await touch('touchEnd', []); await sleep(80); const d1 = await page.evaluate(() => __bg.app.game.fighters[0].dashT || 0); console.log('dash', d0, d1, d1 > 0 ? 'OK' : 'FAIL');
await touch('touchStart', [[820, 255]]); await touch('touchEnd', []); await sleep(300);
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v30/r7-touch-play.png' });
// pause button via tap, then settings
await page.mouse.click(884, 28); await sleep(500); console.log('paused', await page.evaluate(() => __bg.app.paused));
console.log('errors', errors.slice(0, 6)); await browser.close();
