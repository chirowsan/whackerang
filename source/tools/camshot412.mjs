// t394u camera framing, same seed / same active-gameplay moment. usage: node tools/camshot412.mjs <html> <out.png> <w> <h> [size]
import { launch, sleep } from './lib.mjs';
const [html, out, W, H, SIZE = 'large'] = process.argv.slice(2);
const { browser, page, errors } = await launch({ w: +W, h: +H, dpr: 1, mobile: +H < 600 }); await page.goto('file://' + html); await sleep(2500);
const r = await page.evaluate((SIZE) => { let sd = 4242; Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const S = __bg.S(); S.tutorialDone = true; S.settings.touch = +innerHeight < 600 ? 'on' : 'off'; S.settings.events = 'off'; S.settings.camera = 'close'; S.setup.arena = 'space'; S.setup.size = SIZE; S.setup.traps = 'some'; S.setup.bots = 3; S.setup.mode = 'classic'; S.hero = 'kuma';
  __bg.app.applyTouch(); __bg.app.startMode('classic'); __bg.app.paused = true; const g = __bg.app.game; let k = 0; while (g.state !== 'play' && k++ < 3000) __bg.step(1); for (let i = 0; i < 240; i++) __bg.step(1); __bg.app.paused = false;
  const tl = (x, z) => __bg.toScreen(x, 0, z); const [HX, HZ] = __bg.hxz(); const c = [tl(-HX, -HZ), tl(HX, -HZ), tl(-HX, HZ), tl(HX, HZ)];
  const fs = g.fighters.map((f) => { const p = __bg.toScreen(f.x, 0.6, f.z); return [+p[0].toFixed(2), +p[1].toFixed(2)]; });
  return { visFrac: +(Math.min(1, Math.max(...c.map((q) => q[0])) ) - Math.max(0, Math.min(...c.map((q) => q[0])))).toFixed(3), camDist: +__bg.gfx?.camDist?.toFixed?.(2) || null, fighters: fs, state: g.state }; }, SIZE);
await sleep(700); await page.screenshot({ path: out }); console.log(JSON.stringify(r)); await browser.close();
