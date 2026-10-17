import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2000);
await page.evaluate(() => { __bg.S().tutorialDone = false; });
await page.evaluate(() => __bg.UI.show('tutintro')); await sleep(300);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => /start training/i.test(b.textContent)).click(); });
await sleep(4500);
const step = () => page.evaluate(() => __bg.app.tut && __bg.app.tut.step);
console.log('start step', await step());
await page.keyboard.down('KeyD'); await sleep(1800); await page.keyboard.up('KeyD'); console.log('after move', await step());
const log = [];
for (let i = 0; i < 70; i++) {
  const st = await page.evaluate(() => ({ step: __bg.app.tut && __bg.app.tut.step, mode: __bg.app.mode })); if (st.mode !== 'play') break; if (log[log.length - 1] !== st.step) log.push(st.step);
  if (st.step === 1 || st.step === 5) { await page.keyboard.down('KeyF'); await sleep(250); await page.keyboard.up('KeyF'); await sleep(800); }
  else if (st.step === 3) { await page.keyboard.down('Space'); await sleep(120); await page.keyboard.up('Space'); await sleep(500); }
  else if (st.step === 4) { await page.keyboard.down('KeyE'); await sleep(120); await page.keyboard.up('KeyE'); await sleep(500); }
  else await sleep(500);
}
console.log('steps seen', log.join(','));
await sleep(2500);
console.log(JSON.stringify(await page.evaluate(() => ({ mode: __bg.app.mode, tutDone: __bg.S().tutorialDone, tut: __bg.app.tut && __bg.app.tut.step, ui: __bg.UI.cur }))));
await page.screenshot({ path: '/workspace/boomerang-brawl/shots/v20/tut-end-a.png' });
console.log('errors', errors.slice(0, 6)); await browser.close();
