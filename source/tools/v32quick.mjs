import { launch, sleep } from './lib.mjs';
const file = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html'; const out = process.argv[3] || 'shots/v32/q'; const W = +(process.argv[4] || 915), H = +(process.argv[5] || 412);
const { browser, page, errors } = await launch({ w: W, h: H, dpr: 2, mobile: true });
await page.goto('file://' + file); await sleep(2500);
await page.screenshot({ path: `${out}-menu.png` });
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.setup.arena = 'dojo'; s.setup.bots = 3; s.setup.diff = 1; __bg.app.quickPlay(); });
await sleep(5600); await page.screenshot({ path: `${out}-play.png` });
// force a catch + powerups visual
await page.evaluate(() => { const g = __bg.app.game; g.spawnPowerupAt(g.fighters[0].x + 2, g.fighters[0].z, 'magnet'); g.spawnPowerupAt(g.fighters[0].x - 2, g.fighters[0].z + 1, 'slow'); });
await sleep(2500); await page.screenshot({ path: `${out}-play2.png` });
console.log('errors', errors.slice(0, 8)); await browser.close();
