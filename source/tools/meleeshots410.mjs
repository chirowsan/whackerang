// v4.10 melee stills: real two-fighter swing (wind-up / contact frame / recovery) with the equipped weapon. usage: node tools/meleeshots410.mjs <outdir> [w h mobile weapon arena]
import fs from 'fs'; import { launch, sleep } from './lib.mjs';
const [out, W = '915', H = '412', MOB = '1', WPN = 'boom', AR = 'dojo'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { browser, page, errors } = await launch({ w: +W, h: +H, dpr: 1, mobile: MOB === '1' }); await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(({ WPN, AR }) => { let sd = 99; Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = AR; S.setup.size = 'small'; S.setup.traps = 'off'; S.setup.bots = 1; S.hero = WPN.includes('_') ? WPN.split('_')[0] : 'bao'; if (!S.unlockedHeroes.includes(S.hero)) S.unlockedHeroes.push(S.hero); S.loadout = [{ [S.hero]: WPN }, {}]; /* v4.11 per-character */
  __bg.app.startMode('classic'); __bg.app.paused = true; const g = __bg.app.game; let k = 0; while (g.state !== 'play' && k++ < 2000) __bg.step(1);
  const [a, b] = g.fighters; b.bot = { update: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) }; b.hp = b.maxHp = 3;
  const c = g.safeCell({ x: 0, z: 0, _self: a }, false); const cx = c ? (c[0] !== undefined ? c[0] : c.x) : 0, cz = c ? (c[1] !== undefined ? c[1] : c.z) : 0; a.x = cx - 0.55; a.z = cz; b.x = cx + 0.75; b.z = cz + 0.15; a.vx = a.vz = b.vx = b.vz = 0; g.playTime = 5;
  for (let i = 0; i < 20; i++) { a.x = cx - 0.55; a.z = cz; b.x = cx + 0.75; b.z = cz + 0.15; __bg.step(1); } a.startSlash(Math.atan2(b.x - a.x, b.z - a.z)); window.__sw = { a, b, g };
}, { WPN, AR });
const M = await page.evaluate(() => __bg.weapons.WEAPONS[__bg.app.game.fighters[0].wpn].melee);
const frames = [['1-windup', M.wind * 0.7], ['2-contact', M.wind + M.act * 0.5], ['3-recovery', M.wind + M.act + M.rec * 0.45]];
for (const [nm, t] of frames) { const info = await page.evaluate((t) => { const { a, b, g } = __sw; let k = 0; while (a.slT >= 0 && a.slT < t && k++ < 200) __bg.step(1); a.slV = a.slT; if (g.vis) g.vis(0); __bg.camNow(); __bg.renderNow(); return { slT: +a.slT.toFixed(3), hp: b.hp, arc: !!(a.model.slArc && a.model.slArc.visible), held: !!(a.model.held && a.model.held.visible) }; }, t);
  await sleep(150); await page.evaluate(() => { for (const id of ['countdown', 'edgewarn']) { const c = document.getElementById(id); if (c) c.className = ''; } __bg.renderNow(); }); await page.screenshot({ path: `${out}/${WPN}-${nm}-${W}x${H}.png` }); console.log(WPN, nm, JSON.stringify(info)); }
console.log('errors', JSON.stringify(errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)).slice(0, 3))); await browser.close();
