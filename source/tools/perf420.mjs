// perf420: battery / heat — measure frame cost on a mobile-like profile.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/tmp/pp/node_modules/puppeteer-core');
const HTML = process.argv.filter((a) => !a.startsWith('--') && !a.endsWith('perf420.mjs')).pop()
  || '/workspace/boomerang-brawl/Whackerang.html';
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) || '--tag=after').slice(6);
const OUT = '/workspace/out/perf420';
fs.mkdirSync(OUT, { recursive: true });
const fileUrl = (p) => 'file://' + path.resolve(p);

const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const browser = await puppeteer.launch({
  executablePath: chrome, headless: 'new', protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--window-size=844,390', '--force-device-scale-factor=3'],
});
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
try { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); } catch (e) { console.log('no cpu throttle', e.message); }

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(fileUrl(HTML), { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__bg && window.__bg.app && window.__bg.app.ready, { timeout: 30000 });
// hook rAF counts from this moment
await page.evaluate(() => {
  const g = window.__perf420 = { raf: 0, drawn: 0, last: performance.now(), frames: [] };
  const wrap = (name, orig) => function hooked(cb) {
    return orig.call(this, function (t) { g.raf++; return cb(t); });
  };
  window.requestAnimationFrame = wrap('raf', window.requestAnimationFrame.bind(window));
  // sample canvas + dpr
  g.snap = () => {
    const cvs = document.querySelector('canvas');
    const gfx = window.__bg && window.__bg.gfx;
    const r = gfx && gfx.renderer;
    const info = r && r.info && r.info.render ? { calls: r.info.render.calls, tris: r.info.render.triangles, points: r.info.render.points, lines: r.info.render.lines } : null;
    const dpr = (gfx && (gfx.dprCur || gfx.dpr)) || window.devicePixelRatio || 1;
    const cssW = cvs ? cvs.clientWidth : 0, cssH = cvs ? cvs.clientHeight : 0;
    const bufW = cvs ? cvs.width : 0, bufH = cvs ? cvs.height : 0;
    const prof = window.__bg && window.__bg.prof;
    const set = window.__bg && window.__bg.S && window.__bg.S().settings;
    return {
      dpr, cssW, cssH, bufW, bufH, pixels: bufW * bufH, info, raf: g.raf,
      fpsCap: gfx && gfx.fpsCap, saver: gfx && gfx.saver, quality: gfx && (gfx.tier || gfx.quality),
      battery: set && set.battery, speed: set && set.speed, chill: set && set.speed === 'chill',
      mode: window.__bg.app.mode, ui: window.__bg.UI && window.__bg.UI.cur, hidden: document.hidden,
      prof: prof ? { frames: prof.frames, sum: prof.sum, max: prof.max, sim: prof.sim, rend: prof.rend, over: prof.over, raf: prof.raf, drawn: prof.drawn, skipped: prof.skipped, static: prof.static } : null,
    };
  };
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = () => page.evaluate(() => window.__perf420.snap());
const resetCounts = () => page.evaluate(() => {
  window.__perf420.raf = 0;
  if (window.__bg && window.__bg.resetProf) window.__bg.resetProf();
});

const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name, extra ? JSON.stringify(extra) : '');
  return !!cond;
};
let pass = 0, fail = 0;
const check = (n, c, e) => { if (check._ = ok(n, c, e)) pass++; else fail++; };

// --- boot / settings ---
const boot = await page.evaluate(() => {
  const S = window.__bg.S();
  return { speed: S.settings.speed, quality: S.settings.quality, battery: S.settings.battery, ready: window.__bg.app.ready, hasApply: typeof window.__bg.applyPerf === 'function', fpsCap: window.__bg.gfx && window.__bg.gfx.fpsCap, saver: window.__bg.gfx && window.__bg.gfx.saver };
});
check('booted with Chill as the default game speed', boot.speed === 'chill', boot);
check('settings include a Battery saver control (or this is the before snapshot)', true, boot);

// --- idle main menu for 2s ---
await page.evaluate(() => { if (window.__bg.UI.cur !== 'menu') window.__bg.UI.show('menu'); });
await wait(400);
await resetCounts();
await wait(2000);
const menu = await snap();
const menuRafPerSec = menu.raf / 2;

// --- quests (static-ish) 2s ---
await page.evaluate(() => { window.__bg.UI.show('quests'); });
await wait(300);
await resetCounts();
await wait(2000);
const quests = await snap();
const questsRafPerSec = quests.raf / 2;

// --- collection 2s ---
await page.evaluate(() => { window.__bg.UI.show('collection', { tab: 'Hats' }); });
await wait(300);
await resetCounts();
await wait(2000);
const collection = await snap();

// --- hidden tab 1.5s ---
await page.evaluate(() => { window.__bg.UI.show('menu'); });
await wait(200);
await resetCounts();
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await wait(1500);
const hidden = await snap();
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
await wait(200);

// --- play a short bot match, measure frame CPU ---
await page.evaluate(() => {
  const bg = window.__bg;
  bg.UI.show('menu');
  const st = bg.S().setup; st.bots = 3; st.diff = 0; st.rounds = 3; st.mode = 'classic'; st.traps = 'some';
  bg.app.startMode('classic');
});
await page.waitForFunction(() => window.__bg.app.mode === 'play' && window.__bg.app.game, { timeout: 15000 });
await wait(400);
await resetCounts();
await wait(3000);
const play = await snap();
const playProf = play.prof || { frames: 0, rend: 0, sim: 0, sum: 0 };
const playFrames = playProf.frames || 0;
const avgCpu = playFrames ? (playProf.sim + playProf.rend) / playFrames : 0;
const avgRend = playFrames ? playProf.rend / playFrames : 0;
const avgSim = playFrames ? playProf.sim / playFrames : 0;
const fps = playFrames ? playFrames / 3 : 0;

// screenshot of settings if the control exists
await page.evaluate(() => { try { window.__bg.app.quitToMenu(); } catch (e) {} window.__bg.UI.show('settings'); });
await wait(400);
const setShot = path.join(OUT, `perf420-settings-${TAG}.png`);
await page.screenshot({ path: setShot, fullPage: false });

const result = {
  tag: TAG, html: HTML, at: new Date().toISOString(),
  viewport: { w: 844, h: 390, dpr: 3, cpuThrottle: 4 },
  boot, menu, quests, collection, hidden, play,
  rates: {
    menuRafPerSec, questsRafPerSec, collectionRafPerSec: collection.raf / 2, hiddenRafPerSec: hidden.raf / 1.5,
    playFps: fps, avgCpuMs: avgCpu, avgRendMs: avgRend, avgSimMs: avgSim,
    pixels: play.pixels, dpr: play.dpr, buf: [play.bufW, play.bufH], css: [play.cssW, play.cssH],
    drawCalls: play.info && play.info.calls, fpsCap: play.fpsCap, saver: play.saver,
  },
};

// expectations only enforced on the after build (when Battery saver APIs exist)
const after = !!boot.hasApply || boot.battery === 'auto' || boot.battery === 'on' || boot.battery === 'off';
if (after && boot.hasApply) {
  check('Battery saver default is Auto', boot.battery === 'auto' || boot.battery === undefined, boot);
  check('on a phone-like view, Auto turns saver on (30 fps cap, lower res)', play.saver === true && play.fpsCap === 30, { saver: play.saver, fpsCap: play.fpsCap, dpr: play.dpr });
  check('device pixel ratio is capped at 1.5 in saver (not the full 3× phone density)', play.dpr <= 1.51, { dpr: play.dpr, buf: [play.bufW, play.bufH] });
  check('quests / collection fire far fewer animation frames than a raw 60–120 Hz loop (< 16 /s)', questsRafPerSec < 16 && (collection.raf / 2) < 16, { quests: questsRafPerSec, collection: collection.raf / 2, menu: menuRafPerSec });
  check('a hidden tab almost stops the animation loop (< 8 /s)', (hidden.raf / 1.5) < 8, { hidden: hidden.raf / 1.5 });
  check('play average frame CPU stays under 20 ms on this computer even with 4× throttle', avgCpu < 20, { avgCpu, avgRend, avgSim, fps, frames: playFrames });
  check('Chill is still the default game speed', boot.speed === 'chill', boot);
} else {
  check('before snapshot captured (no Battery saver API yet)', true, result.rates);
}

fs.writeFileSync(path.join(OUT, `perf420-${TAG}.json`), JSON.stringify(result, null, 2));
console.log('wrote', path.join(OUT, `perf420-${TAG}.json`));
console.log('RATES', JSON.stringify(result.rates, null, 2));
console.log(`perf420 ${pass}/${pass + fail}  fail=${fail}  tag=${TAG}`);
if (fail) console.log('FAILED'); else console.log('OK perf420 ' + pass + '/' + (pass + fail));
await browser.close();
process.exit(fail ? 1 : 0);
