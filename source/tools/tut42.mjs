// v4.2 tutorial: real touches through every step (move, throw, catch, dodge, done), screenshots, skip button, first-run launch, replay button.
import { launch, sleep } from './lib.mjs'; import fs from 'fs';
const OUT = 'shots/v42/tut/'; fs.mkdirSync(OUT, { recursive: true });
const HTML = process.argv[2] || 'file:///workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x) : '')); c ? pass++ : fail++; };
const step = () => page.evaluate(() => (__bg.app.tut ? __bg.app.tut.step : -1));
const waitStep = async (n, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await step()) >= n) return true; await sleep(150); } return false; };
await page.goto(HTML); await sleep(2500);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = false; s.settings.touch = 'on'; });
// first run: Play launches the tutorial directly
await page.evaluate(() => __bg.app.applyTouch()); await sleep(300);
await page.click('#btn-play').catch(async () => { await page.evaluate(() => document.querySelector('#btn-play').click()); }); await sleep(800);
ok('Play on first run starts the tutorial (no wall of text)', await page.evaluate(() => !!(__bg.app.match && __bg.app.match.tutorial)));
for (let i = 0; i < 60 && !(await page.evaluate(() => __bg.app.game && __bg.app.game.state === 'play')); i++) await sleep(200); await sleep(500);
ok('step 0 shows MOVE with ghost on the left stick', await page.evaluate(() => { const t = document.querySelector('#tut'); const g = document.querySelector('#ghost'); const r = document.querySelector('#joybase').getBoundingClientRect(); const gr = g.getBoundingClientRect(); return t.classList.contains('show') && t.querySelector('.tt b').textContent === 'MOVE' && g.style.display === 'block' && Math.abs(gr.left - (r.left + r.width / 2)) < 30; }));
ok('skip button visible', await page.evaluate(() => { const b = document.querySelector('#tskip'); const r = b.getBoundingClientRect(); return r.width > 20 && r.bottom <= innerHeight && getComputedStyle(b).pointerEvents === 'auto'; }));
ok('no wandering arrows in tutorial', await page.evaluate(() => [...document.querySelectorAll('#edges .edge')].every((e) => e.style.display === 'none')));
await sleep(700); await page.screenshot({ path: OUT + '1-move.png' });
ok('standing still does not advance', (await step()) === 0);
// drag the left stick
const jz = { x: 90, y: 300 }; const ts = page.touchscreen;
await ts.touchStart(jz.x, jz.y); await sleep(100); await ts.touchMove(jz.x + 40, jz.y); for (let i = 0; i < 12; i++) { await sleep(150); await ts.touchMove(jz.x + 40, jz.y - (i % 2 ? 5 : 0)); if ((await step()) >= 1) break; }
ok('moving advances to step 1 (THROW)', (await step()) === 1); await ts.touchEnd(); await sleep(400);
ok('step 1 ghost sits on the aim stick', await page.evaluate(() => { const g = document.querySelector('#ghost').getBoundingClientRect(), r = document.querySelector('#aimbase').getBoundingClientRect(); return document.querySelector('#tut .tt b').textContent === 'THROW' && Math.abs(g.left - (r.left + r.width / 2)) < 30; }));
await page.screenshot({ path: OUT + '2-throw.png' });
// tap the aim stick area -> auto-aim throw
await ts.tap(700, 120); const adv2 = await waitStep(2, 3000); ok('throwing advances to step 2 (CATCH)', adv2);
await sleep(250); await page.screenshot({ path: OUT + '3-catch.png' }); await sleep(200); await page.screenshot({ path: OUT + '3-catch-b.png' });
ok('catching advances to step 3 (DODGE)', await waitStep(3, 9000));
await sleep(500); await page.screenshot({ path: OUT + '4-dodge.png' });
ok('a real spike trap exists with warning pulse', await page.evaluate(() => { const t = __bg.app.game.traps.list.find((x) => x.type === 'pit'); return !!t && !!t.haz; }));
// idle in the pit zone? step must NOT advance until the trap has fired and the player survived: step out immediately
await ts.touchStart(jz.x, jz.y); await sleep(80); await ts.touchMove(jz.x + 50, jz.y);
let fired = false; for (let i = 0; i < 60; i++) { await sleep(150); if (!fired) fired = await page.evaluate(() => !!__bg.app.tut.fired || __bg.app.tut.step >= 4); if ((await step()) >= 4) break; }
await ts.touchEnd();
ok('surviving the trap advances to DONE', (await step()) >= 4, { fired }); await sleep(400); await page.screenshot({ path: OUT + '5-done.png' });
await sleep(2400);
ok('finishes into the training-complete screen', await page.evaluate(() => __bg.app.mode === 'matchEnd'), await page.evaluate(() => __bg.app.mode));
function S_done() { return true; }
ok('tutorialDone saved', await page.evaluate(() => __bg.S().tutorialDone === true));
// replay from How to play
await page.evaluate(() => { __bg.app.quitToMenu(); }); await sleep(800);
await page.evaluate(() => __bg.UI.show('howto', {})); await sleep(600);
ok('How to play has a Replay tutorial button', await page.evaluate(() => !!document.querySelector('#hw-replay')));
await page.evaluate(() => document.querySelector('#hw-replay').click()); await sleep(900);
ok('replay launches the tutorial', await page.evaluate(() => !!(__bg.app.match && __bg.app.match.tutorial)));
await sleep(1500); await page.click('#tskip').catch(() => {}); await sleep(900);
ok('Skip leaves the tutorial and starts a match', await page.evaluate(() => __bg.app.tut === null && __bg.app.match && !__bg.app.match.tutorial));
ok('second launch of Play no longer shows the tutorial', await page.evaluate(() => { __bg.app.quitToMenu(); return true; }) && (await sleep(800), await page.evaluate(() => { document.querySelector('#btn-play').click(); return true; })) && (await sleep(900), await page.evaluate(() => !__bg.app.match.tutorial)));
ok('no console errors', errors.length === 0, errors.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } })); await browser.close(); process.exit(fail ? 1 : 0);
