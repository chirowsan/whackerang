// Regression: tutorial, every campaign stage, mutators in every mode-ish combos, touch UI sanity. No console errors.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'fast'; s.settings.events = 'some'; __bg.app.reloadSettings(); });
const run = (label, start, secs = 25) => page.evaluate((label, start, secs) => {
  try { eval(start); __bg.autoplay(1); const g = __bg.app.game; for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); if (__bg.gfx.follow) __bg.app.camFollow(1 / 60); if (g.result) break; }
    const sz = g.traps ? g.traps.list.length : -1; return label + ' ok state=' + g.state + ' fighters=' + g.fighters.length + ' traps=' + sz + ' mut=' + (g.mut ? g.mut.id : '-'); } catch (e) { return label + ' ERR ' + e.stack.slice(0, 400); }
}, label, start, secs);
console.log(await run('tutorial', '__bg.app.startTutorial()', 12));
const nst = await page.evaluate(() => __bg.STAGES.length);
for (let n = 1; n <= nst; n++) console.log(await run('stage' + n, `__bg.app.startStage(${n})`, 20));
for (const m of ['lowgrav', 'giant', 'rubber']) for (const mode of ['classic', 'ctf', 'ball', 'coins', 'crumble', 'bossrush', 'survival']) console.log(await run(m + '/' + mode, `{const s=__bg.S(); s.setup.mutator='${m}'; s.setup.arena='dojo'; s.setup.size='large'; s.setup.traps='some'; s.setup.bots=3; s.setup.rounds=1; __bg.app.startMode('${mode}');}`, 20));
console.log('errors', errors.slice(0, 8)); await browser.close();
