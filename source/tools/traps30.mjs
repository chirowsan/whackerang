// Per-trap behaviour: does it ever become lethal, is every lethal moment telegraphed (danger()>0 shortly before), and does fighterTick really kill?
import { launch, sleep } from './lib.mjs';
const arenas = (process.argv[2] || 'dojo,rooftop,jungle,ice,volcano,pirate,space,haunted').split(',');
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; __bg.app.reloadSettings(); });
const seen = {};
for (const a of arenas) {
  await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'wild'; s.setup.bots = 1; s.setup.diff = 0; __bg.app.startMode('classic'); }, a);
  await sleep(300);
  const res = await page.evaluate(() => {
    const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 1e9; f.bot = null; f.isBot = false; }); // nobody dies from the sim; we probe by hand
    __bg.step(200); // get through intro
    const out = []; const list = g.traps.list.filter((t) => t.type !== 'switch'); const n = list.length;
    const probe = () => ({ x: 0, z: 0, alive: true, inv: 0, dashT: 0, airT: 0, boss: false, team: -1, r: 0.4, vx: 0, vz: 0, ex: 0, ez: 0, stun: 0, frozen: 0, hp: 1 });
    const info = list.map((t) => ({ t, type: t.type, lethal: 0, tele: 0, untele: 0, killsOk: null, maxD: 0, hist: [] }));
    for (let step = 0; step < 60 * 22; step++) {
      __bg.step(1); const T = g.traps.t;
      for (const I of info) {
        const t = I.t; let hit = false, hx = 0, hz = 0;
        if (!t.hits) continue;
        for (let dx = -4; dx <= 4 && !hit; dx += 0.5) for (let dz = -4; dz <= 4 && !hit; dz += 0.5) { const p = probe(); p.x = t.x + dx; p.z = t.z + dz; if (t.hits(p)) { hit = true; hx = p.x; hz = p.z; } }
        const d = t.danger(t.x, t.z); I.maxD = Math.max(I.maxD, d);
        if (hit) { // record telegraph: was danger at that spot >0 in the last 0.6 s?
          const tele = I.hist.some((h) => T - h.T < 0.7 && h.d > 0); I.lethal++; if (tele) I.tele++; else I.untele++;
          if (I.killsOk === null) { const f = g.fighters[0]; const save = [f.x, f.z, f.inv, f.alive]; f.x = hx; f.z = hz; f.inv = 0; f.dashT = 0; f.airT = 0; g.traps.update(0); I.killsOk = !f.alive; f.alive = true; f.x = save[0]; f.z = save[1]; f.inv = 1e9; }
        }
        const dd = t.danger(hit ? hx : t.x, hit ? hz : t.z); I.hist.push({ T, d: dd }); if (I.hist.length > 60) I.hist.shift();
      }
    }
    return info.map((I) => ({ type: I.type, lethal: I.lethal, tele: I.tele, untele: I.untele, killsOk: I.killsOk, maxD: I.maxD }));
  });
  console.log(a, JSON.stringify(res.map((r) => `${r.type}:${r.lethal}${r.untele ? '!' + r.untele : ''}${r.killsOk === false ? ' NOKILL' : ''}`)));
  for (const r of res) { seen[r.type] = seen[r.type] || { lethal: 0, untele: 0, ok: null }; seen[r.type].lethal += r.lethal; seen[r.type].untele += r.untele; if (r.killsOk !== null) seen[r.type].ok = (seen[r.type].ok === null ? true : seen[r.type].ok) && r.killsOk; }
}
console.log(JSON.stringify(seen, null, 1)); console.log('errors', errors.slice(0, 6)); await browser.close();
