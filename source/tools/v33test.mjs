// v3.3 feature tests: every hero (models, win/throw/hurt/emote poses, ultimate), camera modes x map sizes, settings, audio toggles
import { launch, sleep } from './lib.mjs';
const file = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
const R = {};
await page.goto(file.startsWith('http') ? file : 'file://' + file); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'balanced'; });
R.heroes = await page.evaluate(() => __bg.HEROES.map((h) => h.id));
// A: every pose for every hero renders
R.poses = await page.evaluate(() => { const P = [{ win: true, t: 0.45 }, { win: true, t: 1.7 }, { charge: 1, move: 0.3, t: 1 }, { throwT: 0.7, t: 1 }, { dash: 0.8, move: 1, t: 1 }, { dead: true, t: 0.2 }, { hurt: 1, t: 0.5 }, { emote: 1, t: 0.7 }, { move: 1, t: 0.33 }]; let n = 0; const bad = []; for (const h of __bg.HEROES) for (const st of P) { try { const u = __bg.snap(h, 'none', { size: 96, rot: 0.3, expr: null, st }); if (!u || u.length < 500) bad.push(h.id + JSON.stringify(st)); n++; } catch (e) { bad.push(h.id + ' ' + e.message); } } return { n, bad }; });
// B: ultimate of every hero in a live match
R.ults = [];
for (const id of R.heroes) {
  R.ults.push(await page.evaluate((id) => { try { const s = __bg.S(); s.hero = id; s.setup.arena = 'dojo'; s.setup.bots = 3; __bg.app.quickPlay(); const g = __bg.app.game; g.state = 'play'; g.introT = 0; const me = g.fighters.find((f) => !f.isBot); me.ult = 100; g.useUlt(me); for (let i = 0; i < 360; i++) { g.update(1 / 60); } return id + ' ok alive=' + g.fighters.filter((f) => f.alive).length + ' ult=' + me.ultKind; } catch (e) { return id + ' ERR ' + e.stack.slice(0, 300); } }, id));
}
// C: camera modes x map sizes: sim 20s with autoplay, camera follow active/inactive, nothing throws
R.cam = [];
for (const cam of ['close', 'wide']) for (const size of ['small', 'large', 'huge']) {
  R.cam.push(await page.evaluate((cam, size) => { try { const s = __bg.S(); s.settings.camera = cam; s.setup.size = size; s.setup.arena = 'jungle'; s.setup.bots = 3; s.setup.traps = 'some'; __bg.app.startMode('classic'); __bg.autoplay(1); const g = __bg.app.game; let minD = 1e9, maxD = 0; for (let i = 0; i < 1200; i++) { g.update(1 / 60); if (__bg.gfx.follow) { __bg.app.camFollow(1 / 60); minD = Math.min(minD, __bg.gfx.follow.d); maxD = Math.max(maxD, __bg.gfx.follow.d); } if (g.result) break; } return `${cam}/${size} follow=${!!__bg.gfx.follow} k=${__bg.gfx.follow && __bg.gfx.follow.k} d=${minD.toFixed(1)}..${maxD.toFixed(1)} heroZoom=${__bg.gfx.heroZoom} mm=${!!document.querySelector('#minimap')}`; } catch (e) { return cam + size + ' ERR ' + e.stack.slice(0, 300); } }, cam, size));
}
// D: settings screen + audio toggles
R.settings = await page.evaluate(async () => { try { __bg.app.quitToMenu && __bg.app.quitToMenu(false); __bg.UI.show('settings', { ret: 'menu' }); await new Promise((r) => setTimeout(r, 400)); const labels = [...document.querySelectorAll('.set-grid .row > span')].map((e) => e.textContent); __bg.initAudio(); __bg.resumeAudio(); const s = __bg.S().settings; s.musicOn = false; s.master = 0.5; __bg.app.reloadSettings && 0; return { labels, musicOn: s.musicOn, master: s.master, camera: s.camera }; } catch (e) { return 'ERR ' + e.message; } });
// E: sfx every name still runs on the live context
R.sfx = await page.evaluate(async () => { const bad = []; let n = 0; for (const nm of __bg.SFX_NAMES) { for (const p of [0, 1, 3]) { try { __bg.sfx(nm, p); n++; } catch (e) { bad.push(nm + ':' + e.message); } } await new Promise((r) => setTimeout(r, 15)); } return { n, bad }; });
console.log(JSON.stringify(R, null, 1)); console.log('errors', errors.slice(0, 6)); await browser.close();
