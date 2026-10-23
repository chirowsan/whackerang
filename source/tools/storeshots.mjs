// Play listing raw captures from the v4.6.1 web build (real game, no edits). Output: $OUT/<name>.png at 960x480 @2x = 1920x960.
import fs from 'node:fs'; import { launch, sleep } from './lib.mjs';
const FILE = process.argv[2] || '/tmp/web461.html'; const OUT = process.env.OUT || '/workspace/out/v4.6.1-results/raw'; fs.mkdirSync(OUT, { recursive: true });
const W = +process.env.W || 960, H = +process.env.H || 480;
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const fresh = async () => { await page.goto('file://' + FILE); await sleep(2500); await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; }); };
const only = (process.env.ONLY || 'menu,traps,cd,results,select').split(',');
if (only.includes('menu')) { await fresh(); await page.evaluate(() => __bg.UI.show('menu')); await sleep(1500); await shot('menu'); }
for (const [arena, tag] of [['volcano', 'traps1'], ['pirate', 'traps2'], ['space', 'traps3'], ['jungle', 'traps4']]) {
  if (!only.includes('traps')) break;
  await fresh(); await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'medium'; s.setup.traps = 'wild'; s.setup.bots = 3; s.setup.diff = 2; __bg.app.startMode('classic'); }, arena);
  await sleep(5500); await page.evaluate(() => __bg.autoplay(2));
  for (let i = 0; i < 5; i++) { await sleep(1600); await shot(`${tag}-${i}`); }
}
if (only.includes('cd')) {
  await fresh(); await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'dojo'; s.setup.size = 'medium'; s.setup.traps = 'on'; s.setup.bots = 3; s.setup.diff = 2; __bg.app.startMode('classic'); });
  for (let i = 0; i < 16; i++) { await sleep(250); await shot(`cd-${String(i).padStart(2, '0')}`); }
}
if (only.includes('results')) {
  await fresh(); await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'ice'; s.setup.bots = 3; s.setup.diff = 1; s.setup.rounds = 1; __bg.app.startMode('classic'); });
  await sleep(5500); await page.evaluate(() => __bg.autoplay(2)); await sleep(2500);
  await page.evaluate(() => { const g = __bg.app.game; const me = g.fighters.find((f) => f.autoHuman) || g.fighters[0]; for (const f of g.fighters) if (f !== me) f.die(me, 'boom', 1, 0); });
  for (let i = 0; i < 6; i++) { await sleep(900); await shot(`res-${i}`); }
  await sleep(3000); await shot('res-final');
}
if (only.includes('select')) { await fresh(); for (const sc of ['heroes', 'shop', 'campaign', 'modes', 'profile']) { const ok = await page.evaluate((sc) => { try { __bg.UI.show(sc); return true; } catch (e) { return String(e); } }, sc); await sleep(1200); await shot('ui-' + sc); console.log(sc, ok); } }
console.log('errors', JSON.stringify(errors.filter((e) => !/REQFAIL|icon-192|favicon/.test(e)).slice(0, 5))); await browser.close(); process.exit(0);
