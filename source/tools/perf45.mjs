// v4.5.x perf phases: countdown/intro vs after GO, plus leak check across restarts. usage: node tools/perf45.mjs <url> [rate]
import { launch, sleep } from './lib.mjs';
const url = process.argv[2], rate = +(process.argv[3] || 4);
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2.6, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto(url); await sleep(3000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.settings.events = 'some'; __bg.gfx.noAdapt = false; __bg.setQuality('sharp'); }); await sleep(500);
const snap = () => page.evaluate(() => { const p = __bg.prof, r = __bg.gfx.renderer.info; return { frames: p.frames, avgMs: +(p.sum / Math.max(1, p.frames)).toFixed(1), jsMs: +(p.sim / Math.max(1, p.frames)).toFixed(2), rendCpuMs: +(p.rend / Math.max(1, p.frames)).toFixed(2), calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures, kids: __bg.gfx.scene.children.length, dom: document.getElementsByTagName('*').length }; });
for (const [a, z] of [['haunted', 'large'], ['dojo', 'small']].filter((x) => !process.env.ONLY || x[0] === process.env.ONLY)) {
  await page.evaluate((a, z) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = z; s.setup.traps = 'some'; s.setup.bots = 3; s.setup.diff = 2; __bg.app.startMode('classic'); window.__t0 = performance.now(); }, a, z);
  await sleep(700); await page.evaluate(() => __bg.resetProf()); await sleep(2300); const cd = await snap(); const st1 = await page.evaluate(() => __bg.app.game.state);
  for (let i = 0; i < 100 && (await page.evaluate(() => __bg.app.game.state)) !== 'play'; i++) await sleep(100); // align by game state, not wall time (v4.4's sim-time intro lasts longer in wall time on a throttled CPU)
  await sleep(2500); await page.evaluate(() => __bg.resetProf()); await sleep(7000); const play = await snap(); const st2 = await page.evaluate(() => __bg.app.game.state);
  console.log(JSON.stringify({ arena: a, countdown: { ...cd, state: st1 }, afterGO: { ...play, state: st2, playTime: await page.evaluate(() => +__bg.app.game.playTime.toFixed(1)) } }));
}
if (process.env.NOLEAK) { await browser.close(); process.exit(0); }
// leak check: restart 6 rounds on haunted, compare scene object / geometry / texture / DOM counts
await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'haunted'; s.setup.size = 'large'; __bg.app.startMode('classic'); }); await sleep(1500);
const L = []; for (let i = 0; i < 6; i++) { await page.evaluate(() => __bg.app.restartRound()); await sleep(1800); L.push(await page.evaluate(() => { const r = __bg.gfx.renderer.info; return { geos: r.memory.geometries, tex: r.memory.textures, kids: __bg.gfx.scene.children.length, dom: document.getElementsByTagName('*').length, parts: __bg.fx && __bg.fx.glow ? (__bg.fx.glow.count || 0) : 0 }; })); }
console.log('LEAK', JSON.stringify(L)); console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
