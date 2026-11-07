// t397u camera fit metrics: arena-corner screen positions + visible fraction of arena width/depth at countdown vs active play, same seed/map.
// usage: node tools/camfit413.mjs <html> <engine webkit|chromium> <WxH> <size small|large|huge> [shotPrefix]
import { wk, sleep } from './wklib.mjs';
const [html, E, WH, SIZE, SHOT] = process.argv.slice(2); const [W, H] = WH.split('x').map(Number);
const dev = { viewport: { width: W, height: H }, isMobile: E === 'webkit' ? true : true, hasTouch: true, deviceScaleFactor: 1, userAgent: E === 'webkit' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' };
const { browser, page } = await wk(dev, {}, E); await page.goto('file://' + html); await sleep(2500);
const m = async (tag) => page.evaluate((tag) => { const [HX, HZ] = __bg.hxz(); const g = __bg.app.game; const N = 24; let xin = 0, tot = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const x = -HX + 2 * HX * i / N, z = -HZ + 2 * HZ * j / N; const s = __bg.toScreen(x, 0, z); tot++; if (s[0] >= 0 && s[0] <= 1 && s[1] >= 0.06 && s[1] <= 1) xin++; }
  const c = [[-HX, -HZ], [HX, -HZ], [-HX, HZ], [HX, HZ]].map(([x, z]) => __bg.toScreen(x, 0, z).slice(0, 2).map((v) => +v.toFixed(2)));
  const fi = g.fighters.map((f) => { const s = __bg.toScreen(f.x, 0.6, f.z); return s[0] >= 0 && s[0] <= 1 && s[1] >= 0 && s[1] <= 1; });
  const fo = __bg.gfx.follow || {}; return { tag, state: g.state, HX: +HX.toFixed(1), HZ: +HZ.toFixed(1), arenaVisible: +(xin / tot).toFixed(2), corners: c, fightersOn: fi.filter(Boolean).length + '/' + fi.length, d: +__bg.gfx.camDist.toFixed(1), dMin: fo.dMin && +fo.dMin.toFixed(1), pxPerUnit: fo.visW && +(innerWidth / fo.visW).toFixed(1), heroZoom: __bg.gfx.heroZoom }; }, tag);
await page.evaluate((SIZE) => { let sd = 4242; Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }; const S = __bg.S(); S.tutorialDone = true; S.settings.touch = 'on'; S.settings.events = 'off'; S.settings.camera = 'close'; S.setup.arena = 'space'; S.setup.size = SIZE; S.setup.traps = 'some'; S.setup.bots = 3; S.hero = 'kuma'; __bg.app.startMode('classic'); __bg.app.applyTouch(); const a = document.getElementById('a2hs'); a && a.remove(); }, SIZE);
await sleep(1400); const cd = await m('countdown'); if (SHOT) await page.screenshot({ path: SHOT + '-countdown.png' });
await page.evaluate(() => { const g = __bg.app.game; __bg.app.paused = true; let k = 0; while (g.state !== 'play' && k++ < 3000) __bg.step(1); for (let i = 0; i < 240; i++) __bg.step(1); __bg.app.paused = false; document.getElementById('a2hs') && document.getElementById('a2hs').remove(); });
await sleep(900); const pl = await m('play+4s'); if (SHOT) await page.screenshot({ path: SHOT + '-active.png' });
console.log(JSON.stringify({ E, WH, SIZE, cd, pl })); await browser.close();
