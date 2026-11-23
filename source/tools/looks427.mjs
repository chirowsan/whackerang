// looks427: play-earned skins and win poses. No purchases, no loot boxes, no ads.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/batch427';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };

const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true, paytest: 'unlock' });
await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
await page.goto((HTML.startsWith('file:') || HTML.startsWith('http') ? HTML : 'file://' + HTML), { waitUntil: 'load' });
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.looks))) break; await sleep(100); }

const meta = await page.evaluate(() => {
  const L = __bg.looks;
  const ids = Object.keys(L.HERO_SKINS);
  const per = ids.map((id) => ({ id, n: L.HERO_SKINS[id].length, names: L.HERO_SKINS[id].map((s) => s.name) }));
  return {
    nHeroes: ids.length, per, poses: Object.keys(L.EARN_POSES),
    classic: ids.every((id) => L.ownsHeroSkin(id, 'classic') && L.equippedSkinId(id) === 'classic'),
    menu: !!document.querySelector('#btn-looks'),
  };
});
ok('every fighter has Classic plus two play-earned colorways', meta.nHeroes === 10 && meta.per.every((p) => p.n === 3), meta.per);
ok('four play-earned win poses exist', meta.poses.length === 4 && meta.poses.includes('cheer') && meta.poses.includes('dance'), meta.poses);
ok('Classic is owned and equipped by default', meta.classic, meta);

await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; __bg.UI.show('menu'); });
await sleep(200);
await page.evaluate(() => { const b = document.getElementById('btn-looks'); if (b) b.click(); else __bg.UI.show('looks', { ret: 'menu' }); });
await sleep(300);
const ui = await page.evaluate(() => {
  const text = document.getElementById('ui')?.innerText || '';
  const html = document.getElementById('ui')?.innerHTML || '';
  return {
    cur: __bg.UI.cur,
    hasSkins: /Skins/i.test(text),
    hasPoses: /Win poses|poses/i.test(text),
    hasPrice: /\$\d|Unlock Full Game|watch an ad|Buy now/i.test(text),
    hasEarn: /Play |Win |trophies|daily/i.test(text),
    swatches: document.querySelectorAll('.look-swatch').length,
    locked: document.querySelectorAll('#looks .card.locked, .looks-grid .card.locked').length,
  };
});
ok('Looks picker opens with Skins and Win poses tabs', ui.cur === 'looks' && ui.hasSkins && ui.hasPoses, ui);
ok('picker explains how to earn and shows no prices, loot boxes, or ads', ui.hasEarn && !ui.hasPrice && ui.swatches >= 3, ui);
await page.screenshot({ path: OUT + '/looks-picker-915.png' });
ok('wrote Looks picker screenshot', fs.existsSync(OUT + '/looks-picker-915.png'));

const earn = await page.evaluate(() => {
  const L = __bg.looks; const S = __bg.S();
  S.played = 12; S.wins = 6; if (!S.trophy) S.trophy = { n: 0, mastery: {} };
  S.trophy.n = 25; S.trophy.mastery = S.trophy.mastery || {};
  S.trophy.mastery.bao = { plays: 8, lv: 1, claimed: [1] };
  S.stats = S.stats || {}; S.stats.dailies = 6;
  const got = L.checkLookUnlocks(true);
  const honey = L.ownsHeroSkin('bao', 'honey') && L.ownsHeroSkin('bao', 'night');
  const poses = ['cheer', 'flex', 'kick', 'dance'].every((id) => L.ownsPose(id));
  L.equipHeroSkin('bao', 'honey'); L.equipPose('cheer');
  return { got, honey, poses, eqSkin: L.equippedSkinId('bao'), eqPose: __bg.S().eq.pose, label: L.earnLabel({ kind: 'plays', n: 5, hero: 'bao' }) };
});
ok('playing unlocks skins and poses, then you can equip them', earn.honey && earn.poses && earn.eqSkin === 'honey' && earn.eqPose === 'cheer', earn);
ok('earn labels tell kids how to unlock, never a price', /Play 5 matches as Bao/i.test(earn.label), earn.label);

await page.evaluate(() => { __bg.UI.show('looks', { ret: 'menu', tab: 'poses' }); });
await sleep(250);
await page.screenshot({ path: OUT + '/looks-poses-915.png' });
ok('wrote win poses screenshot', fs.existsSync(OUT + '/looks-poses-915.png'));

const pe = errors.filter((e) => !/REQFAIL|ERR_FILE|font|favicon|AudioContext|sw failed/i.test(e));
ok('no page errors', !pe.length, pe.slice(0, 3));
console.log(JSON.stringify({ summary: { pass, fail } }));
await browser.close();
process.exit(fail ? 1 : 0);
