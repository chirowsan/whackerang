// restart leak check across arenas: counts must stay flat. usage: node tools/leak45.mjs <url> [restarts=12] [arenas]
import { launch, sleep } from './lib.mjs';
const url = process.argv[2], N = +(process.argv[3] || 12), arenas = (process.argv[4] || 'haunted,dojo,ice,volcano,space,pirate').split(',');
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto(url); await sleep(2500);
const cnt = () => page.evaluate(() => { const r = __bg.gfx.renderer.info.memory; return [r.geometries, r.textures, __bg.gfx.scene.children.length, document.getElementsByTagName('*').length]; });
const slope = (ys) => { const n = ys.length, mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n; let nu = 0, de = 0; ys.forEach((y, i) => { nu += (i - mx) * (y - my); de += (i - mx) ** 2; }); return +(nu / de).toFixed(2); };
const out = {};
for (const a of arenas) {
  await page.evaluate((a) => { const s = __bg.S(); s.tutorialDone = true; s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'some'; s.setup.bots = 3; s.setup.diff = 2; __bg.app.startMode('classic'); }, a); await sleep(1500);
  const rows = []; for (let i = 0; i < N; i++) { await page.evaluate(() => __bg.app.restartRound()); await sleep(1000); rows.push(await cnt()); }
  const col = (k) => rows.map((r) => r[k]); out[a] = { geos: [col(0)[0], col(0)[N - 1], 'slope/round ' + slope(col(0))], tex: [col(1)[0], col(1)[N - 1], 'slope ' + slope(col(1))], kids: [col(2)[0], col(2)[N - 1]], dom: [col(3)[0], col(3)[N - 1]] };
  console.log(a, JSON.stringify(out[a]));
}
// cross-arena switching (random arena each round)
await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'random'; __bg.app.startMode('classic'); }); await sleep(1200); const rows = []; for (let i = 0; i < N; i++) { await page.evaluate(() => __bg.app.nextRound()); await sleep(1000); rows.push(await cnt()); }
console.log('random-arena nextRound x' + N, 'geos', JSON.stringify(rows.map((r) => r[0])), 'tex', JSON.stringify(rows.map((r) => r[1])), 'kids', JSON.stringify(rows.map((r) => r[2])));
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
