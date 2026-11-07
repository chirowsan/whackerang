// A) iPhone framing in the WebKit engine: viewport/canvas/camera numbers in the ACTIVE game (state play), plus screenshot.
// usage: node tools/ios_frame413.mjs <html> <out.png> [device]
import { wk, sleep } from './wklib.mjs';
const [html, out, dev = 'iPhone 14 landscape'] = process.argv.slice(2);
const { browser, page, errors, version } = await wk(dev); await page.goto('file://' + html); await sleep(3000);
const r = await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.settings.camera = 'close'; S.setup.arena = 'space'; S.setup.size = 'large'; S.setup.bots = 3; S.hero = 'kuma';
  const pre = { iw: innerWidth, ih: innerHeight, vv: visualViewport && [visualViewport.width, visualViewport.height], ua: navigator.userAgent.slice(0, 60), touch: __bg.app.isTouchDevice(), want: __bg.app.touchWanted(), mtp: navigator.maxTouchPoints, coarse: matchMedia('(pointer:coarse)').matches };
  __bg.app.startMode('classic'); __bg.app.paused = true; const g = __bg.app.game; let k = 0; while (g.state !== 'play' && k++ < 3000) __bg.step(1); for (let i = 0; i < 30; i++) __bg.step(1); __bg.app.paused = false; __bg.app.applyTouch();
  const gx = __bg.gfx || {}; const f = gx.follow || {}; return { ...pre, state: g.state, gw: gx.w, gh: gx.h, visW: f.visW && +f.visW.toFixed(2), d: f.d && +f.d.toFixed(2), touchOff: document.getElementById('touch').classList.contains('off'), canvas: [document.querySelector('canvas').clientWidth, document.querySelector('canvas').clientHeight] }; });
await page.evaluate(() => { const a = document.getElementById('a2hs'); if (a) a.remove(); }); await sleep(800); await page.screenshot({ path: out }); console.log(JSON.stringify({ dev, engine: 'webkit ' + version, ...r, errors: errors.slice(0, 3) })); await browser.close();
