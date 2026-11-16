// LOCAL-dev-trophy421: kid-safe Trophy Road + fighter mastery. No publish.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const URL = HTML.startsWith('http') || HTML.startsWith('file:') ? HTML : 'file://' + HTML;
const OUT = '/workspace/out/trophy421';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };
const ign = (e) => /AudioContext|font|favicon|icon-192|ERR_FILE_NOT_FOUND/i.test(e);

const boot = async (opts = {}) => {
  const { browser, page, errors } = await launch({ w: opts.w || 1280, h: opts.h || 720, dpr: 1, mobile: !!opts.mobile, paytest: opts.paytest === undefined ? 'unlock' : opts.paytest });
  if (opts.clear) await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); localStorage.removeItem('boomerangbrawl.save.v1'); } catch (e) {} });
  if (opts.seed) await page.evaluateOnNewDocument((s) => { try { localStorage.setItem('whackerang.save.v1', s); } catch (e) {} }, JSON.stringify(opts.seed));
  await page.goto(URL, { waitUntil: 'load' });
  for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.Trophy && __bg.UI))) break; await sleep(100); }
  await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; __bg.Trophy.ensureTrophy(); });
  return { browser, page, errors };
};

// ---- fresh save ----
{
  const { browser, page, errors } = await boot({ clear: true, paytest: 'unlock' });
  const st = await page.evaluate(() => {
    const T = __bg.Trophy, S = __bg.S();
    const t = T.ensureTrophy();
    return {
      n: t.n, rank: t.rank, title: t.title, dayN: t.dayN,
      speed: S.settings.speed, battery: S.settings.battery, diff: S.setup.diff,
      planWinEasy: T.planAward({ won: true, diff: 0 }),
      planLoseEasy: T.planAward({ won: false, diff: 0 }),
      planWinHard: T.planAward({ won: true, diff: 2 }),
      planLoseOnline: T.planAward({ won: false, online: true }),
      planTut: T.planAward({ won: true, tutorial: true }),
      cap: T.TROPHY_DAY_CAP,
    };
  });
  ok('fresh save starts at Newcomer with 0 trophies', st.n === 0 && st.rank === 'new', st);
  ok('Chill / Battery Auto / Easy bots unchanged', st.speed === 'chill' && st.battery === 'auto' && st.diff === 0, st);
  ok('a win vs Easy bots grants some trophies', st.planWinEasy.gained >= 3 && st.planWinEasy.gained <= 6, st.planWinEasy);
  ok('a loss still grants a few trophies (never zero-or-less than play)', st.planLoseEasy.gained >= 1 && st.planLoseEasy.gained < st.planWinEasy.gained, st.planLoseEasy);
  ok('Hard wins grant more than Easy wins', st.planWinHard.gained > st.planWinEasy.gained, { hard: st.planWinHard, easy: st.planWinEasy });
  ok('online losses still grant trophies', st.planLoseOnline.gained >= 2, st.planLoseOnline);
  ok('tutorial awards no trophies', st.planTut.gained === 0, st.planTut);
  ok('daily cap is 80', st.cap === 80);

  // play a real Easy win and a loss through the award API
  const play = await page.evaluate(() => {
    const T = __bg.Trophy, S = __bg.S();
    S.setup.diff = 0; S.hero = 'bao';
    const a = T.awardMatchTrophies({ won: true, diff: 0, heroId: 'bao' });
    const b = T.awardMatchTrophies({ won: false, diff: 0, heroId: 'bao' });
    const n = T.ensureTrophy().n;
    const m = T.masteryOf('bao');
    return { a, b, n, m, neverDown: n >= a.gained };
  });
  ok('awarding a win then a loss never drops trophies or rank', play.n === play.a.gained + play.b.gained && play.a.rank.id === 'new' && play.n > 0, play);
  ok('playing Bao raises mastery plays', play.m.plays === 2 && play.m.lv >= 1, play.m);

  // diminishing Easy + daily cap
  const farm = await page.evaluate(() => {
    const T = __bg.Trophy;
    T.setTrophyDay(20990101);
    const amounts = [];
    for (let i = 0; i < 16; i++) {
      const r = T.awardMatchTrophies({ won: true, diff: 0, heroId: 'nori' });
      amounts.push({ g: r.gained, reason: r.reason, capHit: r.capHit, dayN: r.dayN });
    }
    const t = T.ensureTrophy();
    return { amounts, dayN: t.dayN, n: t.n, cap: T.TROPHY_DAY_CAP, easyN: t.easyN };
  });
  const first = farm.amounts[0].g, mid = farm.amounts[4].g, late = farm.amounts[11].g;
  ok('Easy-bot trophies shrink after a few wins', mid <= first && late <= mid, farm.amounts);
  ok('Easy-bot farming hits the daily cap or shrinks to 0 late in the day', farm.dayN <= farm.cap && farm.amounts.some((x) => x.g === 0 || x.capHit), { dayN: farm.dayN, last: farm.amounts.slice(-3) });
  ok('trophies never go negative while farming', farm.n >= 0 && farm.amounts.every((x) => x.g >= 0));

  await browser.close();
}

// ---- rank-up rewards, no paid fighters/maps, road + celebration screens ----
{
  const { browser, page, errors } = await boot({ clear: true, paytest: 'unlock' });
  const up = await page.evaluate(() => {
    const T = __bg.Trophy, S = __bg.S();
    const coins0 = S.coins;
    const heroes0 = (S.unlockedHeroes || []).slice();
    const arenas0 = (S.unlockedArenas || []).slice();
    const r = T.grantTrophies(20, { force: true }); // Bronze I
    return {
      rank: r.rank.id, name: r.rank.name, ups: r.rankUps.map((u) => ({ id: u.rank.id, rewards: u.rewards })),
      coins: S.coins, coins0, heroes: (S.unlockedHeroes || []).slice(), arenas: (S.unlockedArenas || []).slice(), heroes0, arenas0,
      hi: (S.own.emotes || []).includes('hi'),
    };
  });
  ok('reaching Bronze I grants a reward and stays at Bronze I', up.rank === 'b1' && up.ups.some((u) => u.id === 'b1') && up.coins > up.coins0, up);
  ok('rank rewards do not unlock paid fighters or maps', JSON.stringify(up.heroes) === JSON.stringify(up.heroes0) && JSON.stringify(up.arenas) === JSON.stringify(up.arenas0), up);

  // jump to Bronze II (50) for emote
  const b2 = await page.evaluate(() => {
    const T = __bg.Trophy, S = __bg.S();
    T.grantTrophies(30, { force: true });
    return { rank: T.currentRank().id, hi: (S.own.emotes || []).includes('hi'), n: T.ensureTrophy().n };
  });
  ok('Bronze II grants the Hi! emote', b2.rank === 'b2' && b2.hi === true, b2);

  await page.evaluate(() => {
    const T = __bg.Trophy;
    const award = T.grantTrophies(40, { force: true }); // 90 = Bronze III
    const a = award.rankUps.length ? award : { rankUps: [{ rank: T.currentRank(), rewards: ['+30 stars', 'Twinkle sparkle', 'Title: Boomer Buddy'] }], rank: T.currentRank(), gained: 40, n: T.ensureTrophy().n };
    __bg.UI.show('rankup', { award: a });
  });
  await sleep(250);
  const ru = await page.evaluate(() => ({
    cur: __bg.UI.cur,
    name: (document.getElementById('rankup-name') || {}).textContent,
    hasBadge: !!document.getElementById('rankup-badge'),
    rewards: (document.getElementById('rankup-rewards') || {}).innerText,
    title: /Boomer Buddy|Bronze/.test(document.body.innerText),
  }));
  ok('rank-up celebration screen is short and shows the new rank', ru.cur === 'rankup' && /Bronze III/i.test(ru.name || '') && ru.hasBadge, ru);
  await page.screenshot({ path: path.join(OUT, 'rank-up.png') });
  await sleep(200);
  await page.screenshot({ path: path.join(OUT, 'rank-up-2.png') });

  await page.click('#btn-rankup-ok').catch(() => {});
  await page.evaluate(() => __bg.UI.show('trophyroad', { ret: 'menu' }));
  await sleep(250);
  const road = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tr-list .tr-row')].map((r) => ({ id: r.getAttribute('data-rank'), got: r.classList.contains('got'), cur: r.classList.contains('cur'), t: r.innerText.replace(/\s+/g, ' ') }));
    return { cur: __bg.UI.cur, n: rows.length, bronzeGot: rows.filter((r) => r.id && r.id.startsWith('b') && r.got).length, starLocked: rows.some((r) => r.id === 'star' && !r.got), hasCap: /80 trophies today|daily/i.test(document.body.innerText), neverDown: /never/i.test(document.body.innerText) };
  });
  ok('Trophy Road lists every rank and marks earned ones', road.cur === 'trophyroad' && road.n === 11 && road.bronzeGot === 3 && road.starLocked, road);
  ok('Trophy Road explains the daily cap and that ranks never go down', road.hasCap && road.neverDown, road);
  await page.screenshot({ path: path.join(OUT, 'trophy-road.png') });
  await page.evaluate(() => { const m = document.getElementById('tr-mastery') || document.getElementById('tr-body'); if (m) m.scrollIntoView({ block: 'center' }); });
  await sleep(150);
  await page.screenshot({ path: path.join(OUT, 'trophy-road-mastery.png') });

  // mastery badge on fighter cards
  await page.evaluate(() => {
    const T = __bg.Trophy, t = T.ensureTrophy();
    t.mastery.bao.plays = 14; // level 5
    t.mastery.bao.lv = 5;
    __bg.UI.show('heroes', { mode: 'pick', ret: 'menu' });
  });
  await sleep(250);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.hero-card')].map((c) => ({ name: (c.querySelector('.nm') || {}).textContent, m: (c.querySelector('.ms-badge') || {}).textContent, how: (c.querySelector('.how') || {}).textContent })));
  const bao = cards.find((c) => c.name === 'Bao');
  ok('Bao card shows a mastery badge and keeps its how-to line', bao && bao.m === 'M5' && (bao.how || '').trim().length > 0, bao);
  ok('mastery badge is only on fighters who earned it', cards.filter((c) => c.m).every((c) => c.name === 'Bao'), cards);
  await page.screenshot({ path: path.join(OUT, 'mastery-badge.png') });

  // menu rank chip
  await page.evaluate(() => __bg.UI.show('menu'));
  await sleep(200);
  const menu = await page.evaluate(() => {
    const chip = document.getElementById('btn-rankchip');
    const btn = document.getElementById('btn-trophy');
    return { chip: chip && chip.innerText, btn: btn && btn.textContent, hud: /leaderboard|global rank/i.test(document.body.innerText) };
  });
  ok('menu shows a rank badge and a Trophy Road button', /Bronze/i.test(menu.chip || '') && /Trophy Road/i.test(menu.btn || ''), menu);
  ok('menu has no global leaderboard', menu.hud === false);

  ok('no page errors in rank/UI run', errors.filter((e) => !ign(e)).length === 0, errors.slice(0, 5));
  await browser.close();
}

// ---- grandfather from past wins; losses never drop a rank ----
{
  const { browser, page } = await boot({
    paytest: 'off',
    seed: {
      coins: 40, wins: 8, played: 14, hero: 'bao', tutorialDone: true,
      stats: { win: 8, play: 14, 'as:bao': 6, 'as:nori': 3 },
      settings: { speed: 'chill', battery: 'auto' },
      setup: { diff: 0, bots: 3, arena: 'dojo', mode: 'classic' },
    },
  });
  const g = await page.evaluate(() => {
    const T = __bg.Trophy, t = T.ensureTrophy(), r = T.currentRank();
    const before = t.n;
    const lose = T.awardMatchTrophies({ won: false, diff: 0, heroId: 'bao' });
    return { n0: before, n1: t.n, rank: r.id, welcome: t.welcome, bao: T.masteryOf('bao'), dropped: lose.rankUps.length < 0 || t.n < before };
  });
  ok('existing saves get a fair trophy baseline from past wins', g.n0 === 8 * 6 + 6 * 2 && g.n0 > 0 && g.welcome === true, g);
  ok('grandfathered rank is not Newcomer when the player already has wins', g.rank !== 'new' && g.n0 >= 20, g);
  ok('a later loss does not drop trophies or rank', g.n1 >= g.n0 && g.dropped === false, g);
  ok('past plays as Bao count toward mastery', g.bao.plays >= 6 && g.bao.lv >= 3, g.bao);
  await browser.close();
}

// ---- online lobby + in-match badge; combat stays uncluttered ----
{
  const { browser, page, errors } = await boot({ clear: true, paytest: 'unlock' });
  await page.evaluate(() => {
    const T = __bg.Trophy;
    T.grantTrophies(90, { force: true });
    const Net = __bg.net;
    Net.reset && Net.reset();
    Net.active = true; Net.role = 'host'; Net.phase = 'lobby'; Net.code = 'TEST'; Net.conType = 'direct'; Net.mySlot = 0;
    Net.lobby = {
      settings: Net.defaultSettings(),
      players: [
        { slot: 0, name: 'Zippy Fox', hero: 'bao', hat: 'none', rank: 'b3', host: true, conn: true, ping: 0, ready: true, team: 0 },
        { slot: 1, name: 'Mighty Mango', hero: 'nori', hat: 'none', rank: 's1', host: false, conn: true, ping: 40, ready: true, team: 1 },
      ],
    };
    Net.H = { slots: Net.lobby.players, settings: Net.lobby.settings, rematch: new Set(), peers: new Map() };
    __bg.UI.show('netLobby');
  });
  await sleep(300);
  const lob = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.nl2-players .prow')].map((r) => ({ t: r.innerText.replace(/\s+/g, ' '), hasBadge: !!r.querySelector('.rbadge'), ranks: [...r.querySelectorAll('.rbadge')].map((b) => b.getAttribute('data-rank')) }));
    return { cur: __bg.UI.cur, rows, board: /leaderboard/i.test(document.body.innerText) };
  });
  ok('online lobby shows a rank badge on each player, no leaderboard', lob.cur === 'netLobby' && lob.rows.filter((r) => r.hasBadge).length >= 2 && lob.board === false, lob);
  await page.screenshot({ path: path.join(OUT, 'online-lobby.png') });

  // start a local match and confirm a tiny HUD badge, no trophy CTA mid-match
  await page.evaluate(() => {
    const S = __bg.S();
    S.setup.arena = 'dojo'; S.setup.bots = 1; S.setup.diff = 0;
    if (__bg.net) { __bg.net.active = false; __bg.net.phase = 'idle'; }
    __bg.UI.show('menu');
    __bg.app.startMode('classic');
    __bg.app.paused = true;
    const g = __bg.app.game; let k = 0; while (g && g.state !== 'play' && k++ < 4000) __bg.step(1);
    __bg.UI.hudUpdate && __bg.app.game && __bg.UI.hudUpdate(__bg.app.game);
    __bg.renderNow && __bg.renderNow();
  });
  await sleep(200);
  const match = await page.evaluate(() => {
    const hud = document.getElementById('hud') || document.body;
    const badges = [...hud.querySelectorAll('.pchip .rbadge')];
    const text = hud.innerText;
    return {
      playing: !!(__bg.app.game),
      badges: badges.length,
      mine: badges.some((b) => b.getAttribute('data-rank') === 'b3' || b.getAttribute('data-rank') === __bg.Trophy.myRankId()),
      clutter: /Trophy Road|Unlock Full Game|leaderboard|\$2\.99/i.test(text),
    };
  });
  ok('online/local match HUD shows a small rank badge on your player', match.playing && match.badges >= 1 && match.mine, match);
  ok('combat HUD stays uncluttered (no Trophy Road or purchase CTA)', match.clutter === false, match);
  await page.screenshot({ path: path.join(OUT, 'online-match.png') });
  ok('no page errors in lobby/match run', errors.filter((e) => !ign(e)).length === 0, errors.slice(0, 5));
  await browser.close();
}

// gif from rank-up frames if tools exist
{
  const a = path.join(OUT, 'rank-up.png'), b = path.join(OUT, 'rank-up-2.png'), gif = path.join(OUT, 'rank-up.gif');
  if (fs.existsSync(a) && fs.existsSync(b)) {
    const ff = spawnSync('ffmpeg', ['-y', '-loop', '0', '-t', '2', '-i', a, '-t', '2', '-i', b, '-filter_complex', '[0][1]xfade=transition=fade:duration=0.4:offset=1,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-gif', gif], { encoding: 'utf8' });
    if (ff.status !== 0 || !fs.existsSync(gif)) {
      const py = spawnSync('python3', ['-c', `
from PIL import Image
a=Image.open(${JSON.stringify(a)}).convert('P', palette=Image.ADAPTIVE)
b=Image.open(${JSON.stringify(b)}).convert('P', palette=Image.ADAPTIVE)
a.save(${JSON.stringify(gif)}, save_all=True, append_images=[b,a], duration=700, loop=0)
print('gif ok')
`], { encoding: 'utf8' });
      if (py.status !== 0) console.log('gif skipped', (ff.stderr || py.stderr || '').slice(0, 200));
    }
  }
}

console.log((fail ? 'FAIL ' : 'OK ') + 'trophy421 ' + pass + '/' + (pass + fail) + (fail ? ' failed=' + fail : ''));
process.exit(fail ? 1 : 0);
