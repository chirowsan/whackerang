// map427: Cedar Creek — calm map, shallow water slows you, three slow logs you can ride.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/batch427';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };

async function boot(w, h) {
  const { browser, page, errors } = await launch({ w, h, dpr: 2, mobile: true, paytest: 'unlock' });
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
  await page.goto((HTML.startsWith('file:') || HTML.startsWith('http') ? HTML : 'file://' + HTML), { waitUntil: 'load' });
  for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.ARENAS))) break; await sleep(100); }
  return { browser, page, errors };
}

const { browser, page, errors } = await boot(915, 412);
const meta = await page.evaluate(() => {
  const A = __bg.ARENAS.find((a) => a.id === 'creek');
  const S = __bg.S();
  return {
    n: __bg.ARENAS.length, ids: __bg.ARENAS.map((a) => a.id),
    name: A && A.name, blurb: A && A.blurb, hazard: A && A.hazard,
    free: __bg.isArenaFree ? __bg.isArenaFree('creek') : true,
    speed: S.settings.speed, battery: S.settings.battery, diff: S.setup.diff,
  };
});
ok('Cedar Creek is in the arena list', meta.ids.includes('creek') && meta.name === 'Cedar Creek', meta);
ok('blurb tells kids about logs and slow water', !!(meta.blurb && /log/i.test(meta.blurb) && /water/i.test(meta.blurb)), meta.blurb);
ok('hazard is logs and the map is free', meta.hazard === 'logs' && meta.free === true, meta);
ok('defaults stay Chill, Battery saver Auto, Easy bots', meta.speed === 'chill' && meta.battery === 'auto' && (meta.diff === 0 || meta.diff === 'easy' || meta.diff === undefined), meta);

await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.unlockedArenas = __bg.ARENAS.map((a) => a.id); __bg.UI.show('setup', { mode: 'classic' }); });
await sleep(300);
const setup = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#ui button')].map((b) => ({ id: b.getAttribute('data-arena'), t: (b.innerText || '').replace(/\s+/g, ' ').trim() }));
  const creek = btns.find((b) => b.id === 'creek' || /Cedar|Creek/i.test(b.t));
  return { n: btns.length, creek, ids: btns.map((b) => b.id).filter(Boolean) };
});
ok('setup screen lists Cedar Creek', !!(setup.creek && /Cedar|Creek/i.test(setup.creek.t || 'Cedar Creek')), setup);

await page.evaluate(() => {
  const S = __bg.S(); S.hero = 'bram'; S.tutorialDone = true; S.setup.mode = 'classic'; S.setup.arena = 'creek'; S.setup.size = 'large'; S.setup.bots = 1; S.setup.diff = 0; S.setup.traps = 'off'; S.settings.events = 'off'; S.settings.battery = 'auto';
  __bg.app.startMode('classic');
  const g = __bg.app.game; __bg.app.paused = true;
  let k = 0; while (g.state !== 'play' && k++ < 4000) __bg.step(1);
});
await sleep(80);
const layout = await page.evaluate(() => {
  const g = __bg.app.game;
  const T = 6; // WATER
  let water = 0; for (const v of g.layout.t) if (v === T) water++;
  const logs = (g.logs || []).map((L) => ({ x: L.x, z: L.z, speed: L.speed }));
  g.time = 1.0; g.tickLogs(0); const a = g.logs.map((L) => L.x);
  g.time = 2.2; g.tickLogs(0); const b = g.logs.map((L) => L.x);
  const moved = a.some((x, i) => Math.abs(x - b[i]) > 0.25);
  const me = g.fighters.find((f) => !f.isBot && f.def.slot === 0);
  const L = g.logs[1] || g.logs[0];
  if (me && L) { me.x = L.x; me.z = L.z; }
  const ride = me && g.rideLog(me);
  return { id: g.arenaId, water, nLogs: logs.length, moved, ride: !!(ride && Math.abs(ride.vx) > 0.4), battery: __bg.S().settings.battery, meshes: !!(g.view && g.view.logMeshes && g.view.logMeshes.length === 3) };
});
ok('match is on Cedar Creek', layout.id === 'creek', layout);
ok('the creek has a water band and exactly 3 logs', layout.water >= 8 && layout.nLogs === 3 && layout.meshes, layout);
ok('logs drift over time and you can ride one', layout.moved && layout.ride, layout);
ok('Battery saver stays Auto on this map', layout.battery === 'auto', layout);

await page.evaluate(() => { const g = __bg.app.game; if (g.view && g.view.root) { /* camera already following */ } __bg.renderNow(); });
await sleep(80);
await page.screenshot({ path: OUT + '/cedar-creek-915.png' });
ok('wrote Cedar Creek screenshot', fs.existsSync(OUT + '/cedar-creek-915.png'));

const pe = errors.filter((e) => !/REQFAIL|ERR_FILE|font|favicon|AudioContext|sw failed/i.test(e));
ok('no page errors', !pe.length, pe.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } }));
await browser.close();
process.exit(fail ? 1 : 0);
