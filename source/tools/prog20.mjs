import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
const ev = (f, ...a) => page.evaluate(f, ...a);
await ev(() => { const s = __bg.S(); s.tutorialDone = true; s.coins = 1000; });
// shop buy flow
for (const tab of ['Boomerangs', 'Skins', 'Trails', 'Hats', 'Emotes', 'Fighters']) {
  const r = await ev((tab) => { __bg.UI.show('shop', { tab }); const s = __bg.S(); const c0 = s.coins; const b = [...document.querySelectorAll('.shop-grid .card button')].find((x) => /coin|\d/.test(x.textContent) && !x.classList.contains('locked') && !/Equip|Owned/.test(x.textContent)); if (!b) return tab + ': no buyable'; b.click(); return `${tab}: coins ${c0} -> ${s.coins} eq=${JSON.stringify(s.eq)}`; }, tab);
  console.log(r);
}
// reload persistence
await ev(() => { __bg.S(); });
const before = await ev(() => JSON.stringify({ c: __bg.S().coins, eq: __bg.S().eq }));
await page.reload(); await sleep(2000);
const after = await ev(() => JSON.stringify({ c: __bg.S().coins, eq: __bg.S().eq }));
console.log('persist', before === after, after.slice(0, 120));
// daily claim + achievements via a won match
await ev(() => { const s = __bg.S(); s.tutorialDone = true; });
const daily = await ev(() => { const s = __bg.S(); __bg.UI.show('profile'); const cl = [...document.querySelectorAll('button')].filter((b) => /claim/i.test(b.textContent)); return { claimBtns: cl.length, daily: JSON.stringify(s.daily).slice(0, 160) }; });
console.log('daily', JSON.stringify(daily));
await ev(() => { __bg.S().setup.diff = 0; __bg.app.startStage(1); }); await sleep(3600);
await ev(() => { __bg.autoplay(3); __bg.step(60 * 80); }); await sleep(2500);
console.log(JSON.stringify(await ev(() => { const s = __bg.S(); return { mode: __bg.app.mode, res: __bg.app.lastResult && { won: __bg.app.lastResult.won, stars: __bg.app.lastResult.stars, xp: __bg.app.lastResult.xp, coins: __bg.app.lastResult.coins }, stars: s.camp.stars.slice(0, 3), ach: Object.keys(s.ach || {}).length, xp: s.xp, daily: JSON.stringify(s.daily && s.daily.prog) }; })));
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v20/ui-result-a.png' });
console.log('errors', errors.slice(0, 6)); await browser.close();
