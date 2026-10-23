import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('https://chirowsan.github.io/whackerang/'); await sleep(4000);
const r = await page.evaluate(async () => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; window.__e = []; __bg.app.startMode('classic'); const g = __bg.app.game; const o = g.onEvent; g.onEvent = (n, d) => { window.__e.push(n + (d && d.n !== undefined ? d.n : '') + '@' + Math.round(performance.now())); o(n, d); }; const t0 = performance.now(); const seen = []; const h = g.fighters.find((f) => !f.isBot && f.def.slot === 0); const x0 = h.x;
  await new Promise((res) => { const iv = setInterval(() => { const n = document.querySelector('#countdown .cdnum'); seen.push((n ? n.textContent : '') + '|' + g.state); if (g.state === 'play' || performance.now() - t0 > 9000) { clearInterval(iv); res(); } }, 100); });
  return { ev: window.__e, st: g.state, moved: Math.hypot(h.x - x0, 0), elapsed: Math.round(performance.now() - t0), seen: [...new Set(seen)].join(' ') }; });
console.log(JSON.stringify(r)); await page.screenshot({ path: '/workspace/out/v4.5-shots/live-after-go.png' });
const ev = r.ev.join(','); const ok = /countdown4.*countdown3.*countdown2.*countdown1.*go/.test(ev) && r.st === 'play' && r.elapsed > 3000 && r.elapsed < 5500 && r.moved < 0.05;
console.log(ok ? 'PASS live countdown' : 'FAIL live countdown', 'errors', JSON.stringify(errors.slice(0, 3))); await browser.close(); process.exit(ok && !errors.length ? 0 : 1);
