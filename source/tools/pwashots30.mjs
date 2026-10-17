import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 1280, h: 720, dpr: 1 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(3000);
await page.evaluate(() => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'sharp'; s.settings.events = 'some'; __bg.app.reloadSettings(); __bg.app.quitToMenu(false); }); await sleep(2500);
await page.screenshot({ path: '/workspace/boomerang-brawl/pwa/screenshots/menu.png' });
await page.evaluate(() => { const s = __bg.S(); s.setup.arena = 'volcano'; s.setup.size = 'large'; s.setup.traps = 'some'; s.setup.bots = 3; s.setup.diff = 1; s.setup.mutator = 'off'; __bg.app.startMode('classic'); }); await sleep(600);
await page.evaluate(() => { __bg.autoplay(1); __bg.step(420); __bg.renderNow(); __bg.renderNow(); }); await sleep(400);
await page.screenshot({ path: '/workspace/boomerang-brawl/pwa/screenshots/play.png' }); console.log('errors', errors.slice(0, 4)); await browser.close();
