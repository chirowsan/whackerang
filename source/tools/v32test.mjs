// v3.2 feature tests: fresh-user touch flow timing, tutorial skip, every sfx, new powerups, missions/chest, cosmetics, shakeLvl
import { launch, sleep } from './lib.mjs';
const file = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
const R = {}; const tapEl = async (sel) => { const r = await page.evaluate((sel) => { const e = document.querySelector(sel) || [...document.querySelectorAll('button')].find((b) => b.textContent.includes(sel)); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, sel); if (!r) return false; await page.touchscreen.tap(r[0], r[1]); return true; };
await page.goto(file.startsWith('http') ? file : 'file://' + file); await sleep(2500);
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await sleep(2500);
// A: fresh user -> Play -> Skip, just play -> playing
let t0 = Date.now(); R.tapPlay = await tapEl('#btn-play'); await sleep(400); R.tapSkip = await tapEl('Skip, just play');
await page.waitForFunction(() => __bg.app.game && __bg.app.game.state === 'play' && __bg.app.mode === 'play', { timeout: 20000 }); R.startToPlayingMs = Date.now() - t0;
R.defaults = await page.evaluate(() => { const s = __bg.S(); return { speed: s.settings.speed, diff: s.setup.diff, mode: s.setup.mode, shake: s.settings.shakeLvl, bots: __bg.app.game.fighters.filter((f) => f.isBot).length }; });
// B: quit to menu, tutorial via touch with skip button
await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await sleep(2500);
await tapEl('#btn-play'); await sleep(400); R.tapTrain = await tapEl('Quick training'); await sleep(2500);
R.tutHud = await page.evaluate(() => ({ mode: __bg.app.mode, skipBtn: !!document.querySelector('#tskip'), hint: (document.querySelector('#tutcard, .tutcard') || {}).textContent || null }));
R.tapSkipTut = await tapEl('#tskip'); await sleep(2500); R.afterSkip = await page.evaluate(() => ({ mode: __bg.app.mode, done: __bg.S().tutorialDone, match: __bg.app.match && __bg.app.match.mode }));
// C: audio — every sfx must not throw
R.sfx = await page.evaluate(async () => { try { __bg.initAudio(); __bg.resumeAudio(); } catch (e) { return 'init ERR ' + e.message; } const names = ['throw','charge','whoosh','catch','bounce','hit','hurt','koStinger','slowmo','fanfare','coin','missionDone','magnet','bubble','combo','tickup','whoosh2','shieldpop','click','go','round','emote','pickup','win','lose','dash','deflect','ko']; const bad = []; let n = 0; for (const nm of names) { for (const p of [0, 1, 3]) { try { __bg.sfx(nm, p); n++; } catch (e) { bad.push(nm + ':' + e.message); } await new Promise((r) => setTimeout(r, 40)); } } return { n, bad }; });
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; });
// D: new powerups spawn + apply
R.pu = await page.evaluate(() => { try { const a = __bg.app; a.quitToMenu && a.quitToMenu(false); __bg.S().setup.arena = 'dojo'; a.quickPlay(); const g = a.game; g.state = 'play'; g.introT = 0; const me = g.fighters.find((f) => !f.isBot); const out = {}; for (const k of ['magnet', 'slow', 'shield', 'triple']) { g.spawnPowerupAt(me.x, me.z, k); for (let i = 0; i < 10; i++) g.update(1 / 60); out[k] = Object.keys(me.pu).filter((q) => me.pu[q] > 0).join('+') + ' shield:' + !!me.shield; } for (let i = 0; i < 600; i++) { g.update(1 / 60); } out.alive = g.fighters.filter((f) => f.alive).length; return out; } catch (e) { return 'ERR ' + e.stack.slice(0, 300); } });
// E: missions / chest / level rewards
R.prog = await page.evaluate(async () => { try { const m = await import('data:text/javascript,0').catch(() => 0); const s = __bg.S(); return { daily: JSON.stringify(s.daily || s.missions || null).slice(0, 200), keys: Object.keys(s).join(',') }; } catch (e) { return 'ERR ' + e.message; } });
console.log(JSON.stringify(R, null, 1)); console.log('errors', errors.slice(0, 6)); await browser.close();
