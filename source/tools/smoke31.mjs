// v3.1 smoke: every mode x speed (autoplay), 12 campaign stages, tutorial, UI screens + speed setting persistence/migration. No console errors allowed.
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const out = [];
// ---- migration: old v3.0 save with no speed key -> Chill
const mig = await page.evaluate(() => { localStorage.setItem('whackerang.save.v1', JSON.stringify({ coins: 77, settings: { sfx: 0.5, aimAssist: false, quality: 'balanced' }, setup: { diff: 2 } })); __bg.app.reloadSettings(); const s = __bg.S(); const r1 = [s.settings.speed, s.settings.aimAssist, s.settings.speedMig, s.coins, s.setup.diff]; s.settings.speed = 'fast'; __bg.app.reloadSettings(); const r2 = __bg.S().settings.speed; return { migrated: r1, afterSaveFastReload: r2, stored: JSON.parse(localStorage.getItem('whackerang.save.v1')).settings.speed }; });
console.log('migration', JSON.stringify(mig));
await page.evaluate(() => { localStorage.setItem('whackerang.save.v1', JSON.stringify({ coins: 77, tutorialDone: true, settings: { quality: 'fast', events: 'wild' } })); __bg.app.reloadSettings(); });
const runMode = (mode, speed, arena, size, secs) => page.evaluate((mode, speed, arena, size, secs) => {
  try { const s = __bg.S(); s.settings.speed = speed; s.settings.events = 'wild'; s.setup.arena = arena; s.setup.size = size; s.setup.traps = 'wild'; s.setup.bots = 3; s.setup.diff = 1; s.setup.rounds = 1; s.setup.mutator = 'off';
    __bg.app.startMode(mode); __bg.autoplay(1); const g = __bg.app.game; for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); if (__bg.gfx.follow) __bg.app.camFollow(1 / 60); if (g.result) break; }
    return `${mode} ${speed} ${arena}/${size}: state=${g.state} playT=${g.playTime.toFixed(0)}s ts=${g.cfg.ts} alive=${g.fighters.filter((f) => f.alive).length}/${g.fighters.length} kos=${g.fighters.map((f) => f.kos).join(',')} traps=${g.traps.list.length}`;
  } catch (e) { return 'ERR ' + mode + ' ' + e.stack.slice(0, 400); } }, mode, speed, arena, size, secs);
const modes = ['classic', 'team', 'survival', 'koth', 'bomb', 'ctf', 'coins', 'ball', 'crumble', 'bossrush'];
const arenas = ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted']; let n = 0;
for (const speed of ['chill', 'normal', 'fast']) for (const mode of modes) { const r = await runMode(mode, speed, arenas[n % 8], ['small', 'large', 'huge'][n % 3], speed === 'chill' ? 70 : 40); n++; console.log(r); out.push(r); }
// campaign
for (let st = 1; st <= 12; st++) { const r = await page.evaluate((st) => { try { __bg.S().settings.speed = 'chill'; __bg.app.startStage(st); __bg.autoplay(1); const g = __bg.app.game; for (let i = 0; i < 40 * 60; i++) { g.update(1 / 60); if (__bg.gfx.follow) __bg.app.camFollow(1 / 60); if (g.result) break; } return `stage ${st} ${g.arenaId} state=${g.state} t=${g.playTime.toFixed(0)}`; } catch (e) { return 'ERR stage ' + st + ' ' + e.stack.slice(0, 300); } }, st); console.log(r); out.push(r); }
// tutorial
console.log(await page.evaluate(() => { try { __bg.app.startTutorial(); const g = __bg.app.game; for (let i = 0; i < 12 * 60; i++) g.update(1 / 60); return 'tutorial ok state=' + g.state; } catch (e) { return 'ERR tutorial ' + e.stack.slice(0, 300); } }));
// UI screens
await page.evaluate(() => { __bg.app.quitToMenu(false); }); await sleep(800);
for (const [id, p] of [['menu', {}], ['modes', {}], ['setup', { mode: 'classic' }], ['setup', { mode: 'survival' }], ['setup', { mode: 'ctf' }], ['settings', { ret: 'menu' }], ['howto', {}], ['campaign', {}], ['stageInfo', { n: 1 }], ['shop', { tab: 'Boomerangs' }], ['profile', {}], ['heroes', { mode: 'pick', ret: 'menu' }], ['goldstore', { tab: 'earn' }]]) {
  const r = await page.evaluate((id, p) => { try { __bg.UI.show(id, p); const t = document.body.innerText; return [id, t.includes('Game speed'), t.includes('Easy') && t.includes('Medium'), t.includes('Normal') && false]; } catch (e) { return [id, 'ERR ' + e.message]; } }, id, p); console.log('ui', JSON.stringify(r)); await sleep(150);
}
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v31/ui-goldstore.png' });
await page.evaluate(() => __bg.UI.show('setup', { mode: 'classic' })); await sleep(500); await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v31/ui-setup.png' });
await page.evaluate(() => __bg.UI.show('settings', { ret: 'menu' })); await sleep(500); await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v31/ui-settings.png' });
await page.evaluate(() => __bg.UI.show('howto', {})); await sleep(500); await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v31/ui-howto.png' });
const bad = out.filter((r) => r.startsWith('ERR')); const real = errors.filter((e) => !/icon-192|ERR_FILE_NOT_FOUND/.test(e));
console.log('RESULT: failures', bad.length, 'console/page errors', real.length, real.slice(0, 8)); await browser.close();
