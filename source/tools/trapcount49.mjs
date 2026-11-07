// v4.9: trap / obstacle density per arena & size (traps 'some' + 'wild'), 5 seeds each. usage: node tools/trapcount49.mjs <url> [json-out]
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const url = process.argv[2]; const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto(url); await sleep(2500);
const res = await page.evaluate(async () => { const out = {};
  for (const size of ['small', 'medium', 'large', 'huge']) for (const lvl of ['some', 'wild']) for (const a of ['dojo', 'rooftop', 'jungle', 'ice', 'volcano', 'pirate', 'space', 'haunted']) {
    let tr = 0, sw = 0, sol = 0, minSp = 99, minPair = 99, n = 0, env = 0, enc = 0;
    for (let seed = 1; seed <= 5; seed++) { let s = seed * 7919; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = a; S.setup.size = size; S.setup.traps = lvl; S.setup.bots = 3; __bg.app.startMode('classic'); __bg.app.paused = true;
      const g = __bg.app.game; const L = g.traps.list.filter((t) => t.type !== 'switch'); tr += L.length; sw += g.traps.sw.length;
      // environmental hazard patches (lava/spike/conveyor connected components) + threat traps (jump/tele pads are movement, not threats)
      const H = (k) => { const v = g.layout.t[k]; return v === 3 || v === 4 || v === 5; }; const seen = new Uint8Array(g.layout.t.length); let comps = 0; const AWp = __bg.hxz()[0] * 2;
      for (let k = 0; k < seen.length; k++) if (H(k) && !seen[k]) { comps++; const st = [k]; seen[k] = 1; while (st.length) { const q = st.pop(); const i = q % AWp, j = (q / AWp) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= AWp) continue; const r = jj * AWp + ii; if (r < seen.length && H(r) && !seen[r]) { seen[r] = 1; st.push(r); } } } }
      env += comps; enc += comps + L.filter((t) => t.type !== 'jump' && t.type !== 'tele').length; let c = 0; for (let k = 0; k < g.sol.length; k++) if (g.sol[k]) c++; sol += c; n++;
      const sp = (g.spawnPts || []); for (const t of L) { for (const f of g.fighters) minSp = Math.min(minSp, Math.hypot(t.x - f.x, t.z - f.z)); for (const u of L) if (u !== t) minPair = Math.min(minPair, Math.hypot(t.x - u.x, t.z - u.z)); } }
    out[`${size}/${lvl}/${a}`] = { traps: +(tr / n).toFixed(1), switches: +(sw / n).toFixed(1), solidCells: +(sol / n).toFixed(1), minTrapToSpawn: +minSp.toFixed(2), minTrapGap: +minPair.toFixed(2), envPatches: +(env / n).toFixed(1), encounters: +(enc / n).toFixed(1) }; }
  return out; });
const tot = {}; for (const [k, v] of Object.entries(res)) { const [s, l] = k.split('/'); const key = s + '/' + l; tot[key] = tot[key] || { traps: 0, solid: 0, minSp: 99, minGap: 99, enc: 0, encMax: 0 }; tot[key].traps += v.traps; tot[key].enc += v.encounters; tot[key].encMax = Math.max(tot[key].encMax, v.encounters); tot[key].solid += v.solidCells; tot[key].minSp = Math.min(tot[key].minSp, v.minTrapToSpawn); tot[key].minGap = Math.min(tot[key].minGap, v.minTrapGap); }
for (const [k, v] of Object.entries(tot)) console.log(k.padEnd(12), 'encounters/arena', (v.enc / 8).toFixed(2), 'max', v.encMax, 'traps/arena', (v.traps / 8).toFixed(2), 'solid/arena', (v.solid / 8).toFixed(1), 'minTrap→spawn', v.minSp.toFixed(2), 'minTrapGap', v.minGap.toFixed(2));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ res, tot }, null, 1));
console.log('errors', JSON.stringify(errors.slice(0, 3))); await browser.close();
