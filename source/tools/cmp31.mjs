import { launch, sleep } from './lib.mjs';
for (const [file, tag, speed] of [['/workspace/bb-bench/Whackerang-v3.0.html', 'v30', null], ['/workspace/boomerang-brawl/Whackerang.html', 'v31-chill', 'chill']]) {
  const { browser, page } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
  await page.goto('file://' + file); await sleep(2500);
  await page.evaluate((speed) => { const s = __bg.S(); s.tutorialDone = true; s.settings.quality = 'fast'; s.settings.touch = 'on'; if (speed) s.settings.speed = speed; s.setup.arena = 'dojo'; s.setup.size = 'huge'; s.setup.traps = 'some'; s.setup.bots = 3; __bg.app.startMode('classic');
    const g = __bg.app.game; g.fighters.forEach((f, i) => { if (i) { f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }); } f.inv = 1e9; });
    for (let i = 0; i < 400; i++) { g.update(1 / 60); __bg.app.camFollow(1 / 60); } }, speed);
  await sleep(600); await page.screenshot({ path: `/workspace/boomerang-brawl/shots/v31/cmp-huge-${tag}.png` }); await browser.close();
}
