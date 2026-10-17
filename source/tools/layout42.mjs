// Layout check: arena (projected floor) coverage of the viewport in play on phone sizes + screenshots.
// usage: node tools/layout42.mjs [outdir] [html]
import { launch, sleep } from './lib.mjs';
const OUT = (process.argv[2] || 'shots/v42/layout') + '/'; const HTML = process.argv[3] || 'file:///workspace/boomerang-brawl/Whackerang.html';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const sizes = [[915, 412], [740, 340], [640, 320]]; const res = [];
for (const [w, h] of sizes) {
  const { browser, page, errors } = await launch({ w, h, dpr: 1, mobile: true });
  await page.goto(HTML); await sleep(2500);
  for (const [arena, size] of [['dojo', 'small'], ['volcano', 'small'], ['jungle', 'large']]) {
    await page.evaluate((a, z) => { const s = __bg.S(); s.tutorialDone = true; s.setup.arena = a; s.setup.size = z; s.setup.bots = 2; s.setup.traps = 'some'; __bg.app.startMode('classic'); }, arena, size); await sleep(500);
    await page.evaluate(() => { __bg.step(200); __bg.app.paused = false; }); await sleep(300);
    const m = await page.evaluate(() => {
      const [HX, HZ] = __bg.hxz(); const W = innerWidth, H = innerHeight;
      const cov = () => { // area of projected floor quad clipped to the viewport / viewport area (Sutherland-Hodgman)
        let poly = [[-HX, -HZ], [HX, -HZ], [HX, HZ], [-HX, HZ]].map(([x, z]) => { const p = __bg.toScreen(x, 0, z); return [p[0] * W, p[1] * H]; });
        const clip = (pl, inside, inter) => { const out = []; for (let i = 0; i < pl.length; i++) { const A = pl[i], B = pl[(i + 1) % pl.length]; const ia = inside(A), ib = inside(B); if (ia) out.push(A); if (ia !== ib) out.push(inter(A, B)); } return out; };
        poly = clip(poly, (p) => p[0] >= 0, (A, B) => { const t = (0 - A[0]) / (B[0] - A[0]); return [0, A[1] + t * (B[1] - A[1])]; });
        poly = clip(poly, (p) => p[0] <= W, (A, B) => { const t = (W - A[0]) / (B[0] - A[0]); return [W, A[1] + t * (B[1] - A[1])]; });
        poly = clip(poly, (p) => p[1] >= 0, (A, B) => { const t = (0 - A[1]) / (B[1] - A[1]); return [A[0] + t * (B[0] - A[0]), 0]; });
        poly = clip(poly, (p) => p[1] <= H, (A, B) => { const t = (H - A[1]) / (B[1] - A[1]); return [A[0] + t * (B[0] - A[0]), H]; });
        let a = 0; for (let i = 0; i < poly.length; i++) { const [xa, ya] = poly[i], [xb, yb] = poly[(i + 1) % poly.length]; a += xa * yb - xb * ya; } return Math.abs(a / 2) / (W * H);
      };
      const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot); const out = {};
      const settle = () => { for (let i = 0; i < 300; i++) { if (__bg.gfx.follow) __bg.app.camFollow(1 / 60); } __bg.camNow(); };
      me.inv = 1e9; g.fighters.forEach((f) => { if (f !== me) { f.x = 0; f.z = 0; } });
      me.x = 0; me.z = 0; settle(); out.center = +cov().toFixed(3);
      me.x = -HX + 2; me.z = HZ - 2; settle(); out.cornerNW = +cov().toFixed(3);
      me.x = HX - 2; me.z = -HZ + 2; settle(); out.cornerSE = +cov().toFixed(3);
      me.x = 0; me.z = 0; settle(); g.fighters.forEach((f) => { f.hp = f.maxHp || f.hp; });
      const quadFrac = out.center, bboxFrac = Math.min(out.cornerNW, out.cornerSE);
      const rect = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; }).filter(Boolean);
      return { W, H, cov: out, follow: !!__bg.gfx.follow, sticks: rect('.stick'), btns: rect('#tbtns .tb, #tbtns button, #tbtns > *'), top: rect('#hud .top > *'), state: __bg.app.game && __bg.app.game.state };
    });
    m.arena = arena; res.push(m); await page.screenshot({ path: `${OUT}${w}x${h}-${arena}.png` });
  }
  console.log(JSON.stringify({ w, h, errors })); await browser.close();
}
console.log(JSON.stringify(res.map((r) => ({ v: `${r.W}x${r.H}`, a: r.arena, cov: r.cov, follow: r.follow })), null, 0));
fs.writeFileSync(OUT + 'metrics.json', JSON.stringify(res, null, 1));
// assertions: arena (projected floor, clipped to viewport) covers >= 85% of the viewport at phone sizes, centre and worst corner
let bad = 0; for (const r of res) { const m = Math.min(r.cov.center, r.cov.cornerNW, r.cov.cornerSE); const ok = m >= 0.85; if (!ok) bad++; console.log((ok ? 'PASS' : 'FAIL') + ` arena coverage ${r.W}x${r.H} ${r.arena}: min ${m}`); }
console.log(JSON.stringify({ summary: { pass: res.length - bad, fail: bad } })); process.exit(bad ? 1 : 0);
