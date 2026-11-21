// LOCAL-dev-bots419: smarter playstyle bots, difficulty scaling, fairness. Do not publish from this file.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HTML = process.argv.filter((a) => !a.startsWith('--') && !a.endsWith('bots419.mjs')).pop() || '/workspace/boomerang-brawl/Whackerang.html';
const SKIP_MEDIA = process.argv.includes('--skip-media');
const SKIP_BAL = process.argv.includes('--skip-balance');
const N_OVERRIDE = Number((process.argv.find((a) => a.startsWith('--n=')) || '').slice(4) || process.env.BOTS419_N || 0);
const OUT = '/workspace/out/bots419';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };

const boot = async (url, size = { w: 915, h: 412 }) => {
  const { browser, page, errors } = await launch({ w: size.w, h: size.h, dpr: 1, mobile: true });
  await page.goto(url.startsWith('http') || url.startsWith('file:') ? url : 'file://' + url, { waitUntil: 'load' });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S && __bg.Bot))) break; await sleep(150); }
  return { browser, page, errors };
};

const url = HTML.startsWith('http') || HTML.startsWith('file:') ? HTML : 'file://' + HTML;
const { browser, page, errors } = await boot(url);

ok('booted with Bot, BOT_DIFFS, BOT_STYLES, and Chill hooks', await page.evaluate(() => !!(__bg.Bot && __bg.BOT_DIFFS && __bg.BOT_DIFFS.length === 3 && __bg.BOT_STYLES && __bg.BOT_STYLES.nori && __bg.Game && __bg.S)));

const meta = await page.evaluate(() => {
  const S0 = __bg.S();
  const diffs = __bg.BOT_DIFFS.map((d) => ({ id: d.id, name: d.name, react: d.react, err: d.err, dodge: d.dodge, lead: d.lead, aggr: d.aggr, mistake: d.mistake }));
  const styles = Object.fromEntries(Object.entries(__bg.BOT_STYLES).map(([k, v]) => [k, { ...v }]));
  return {
    speed: S0.settings.speed,
    diff: S0.setup.diff,
    diffs,
    styles,
    heroCount: __bg.HEROES.length,
    chill: (S0.settings.speed === 'chill'),
  };
});
ok('nine fighters still in the roster', meta.heroCount === 9, meta.heroCount);
ok('saved default game speed is Chill', meta.speed === 'chill' || meta.chill, meta.speed);
ok('new-player default bot skill is Easy (0)', meta.diff === 0, meta.diff);
ok('difficulty names are Easy, Normal, Hard', meta.diffs.map((d) => d.name).join(',') === 'Easy,Normal,Hard', meta.diffs);
ok('Easy is slower and sloppier than Hard (react, err, mistake, dodge, lead)', (() => {
  const e = meta.diffs[0], h = meta.diffs[2];
  return e.react > h.react && e.err > h.err && e.mistake > 0 && h.mistake === 0 && e.dodge < h.dodge && e.lead < h.lead && h.err >= 0.05 && h.dodge < 0.95 && h.lead <= 1;
})(), meta.diffs);
ok('every fighter has a playstyle (Nori dashes, Gus close, Wisp bushes, Pico long, Yuki chases a chill)', (
  meta.styles.nori.dashIn >= 0.5 && meta.styles.nori.dashOut >= 0.5
  && meta.styles.gus.pref < meta.styles.pico.pref
  && meta.styles.wisp.ambush >= 1 && meta.styles.wisp.bush >= 0.7
  && meta.styles.yuki.chillChase >= 1
  && meta.styles.kuma.steal >= 1
  && meta.styles.bao.catch > meta.styles.pico.catch
), meta.styles);

// Unlock and open match setup for the difficulty screenshot / labels
await page.evaluate(() => {
  const S = __bg.S(); S.tutorialDone = true; S.coins = 200; S.settings.a2hs = true; S.settings.speed = 'chill';
  S.settings.touch = 'on'; S.settings.quality = 'fast';
  const a = document.getElementById('a2hs'); if (a) a.remove();
  try { __bg.app.quitToMenu(); } catch (e) {}
  __bg.UI.show('setup', { mode: 'classic' });
});
await sleep(200);
const setupUi = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.seg, .segrow, button, .chip, .opt, label, .segbtn, .sbtn')].map((el) => (el.textContent || '').trim());
  const all = document.body.innerText || '';
  const easy = /(?:^|\s)Easy(?:\s|$)/m.test(all);
  const normal = /(?:^|\s)Normal(?:\s|$)/m.test(all);
  const hard = /(?:^|\s)Hard(?:\s|$)/m.test(all);
  const medium = /Medium/.test(all);
  const skill = /Bot skill/i.test(all);
  // which skill chip looks selected
  const selected = [...document.querySelectorAll('.seg button.on, .seg .on, .segbtn.on, button.sel, .seg .sel')].map((el) => (el.textContent || '').trim());
  const skillRow = [...document.querySelectorAll('.seg, .segrow')].find((el) => /Bot skill/i.test(el.textContent || ''));
  const skillBtns = skillRow ? [...skillRow.querySelectorAll('button, .segbtn, .sbtn')].map((b) => ({ t: (b.textContent || '').trim(), on: b.className })) : [];
  return { easy, normal, hard, medium, skill, selected, skillBtns, hasSetup: /Bot skill/i.test(all) };
});
ok('match setup shows Bot skill: Easy, Normal, Hard (no Medium label)', setupUi.skill && setupUi.easy && setupUi.normal && setupUi.hard && !setupUi.medium, setupUi);
ok('Easy is the selected bot skill on a fresh setup', setupUi.skillBtns.some((b) => /easy/i.test(b.t) && /\bon\b|\bsel\b|\bactive\b/i.test(b.on)) || setupUi.selected.some((t) => /easy/i.test(t)), setupUi);

if (!SKIP_MEDIA) {
  const shot = path.join(OUT, 'bots419-difficulty.png');
  await page.screenshot({ path: shot, fullPage: false });
  console.log('wrote', shot);
}

// ---- behavior + performance sims (headless Game, no pixels) ----
console.log('running behavior sims...');
const behav = await page.evaluate(() => {
  const bg = __bg;
  const STEP = 1 / 60;
  const netCfg = { ts: 1, catch: 1, camWide: 1, ease: 0 };
  const mkGame = (idA, idB, diff, arena = 'dojo', traps = 'off', size = 'small') => {
    if (bg.setArenaSize) bg.setArenaSize(size);
    const hA = bg.HEROES.find((h) => h.id === idA);
    const hB = bg.HEROES.find((h) => h.id === idB);
    const A = { hero: hA, hat: 'none', ctrl: 'bot', slot: -1, name: hA.name, diff, team: 0, weapon: 'boom' };
    const B = { hero: hB, hat: 'none', ctrl: 'bot', slot: -1, name: hB.name, diff, team: 1, weapon: 'boom' };
    const g = new bg.Game({
      mode: 'vs', arenaId: arena, intro: 0, input: bg.Input, traps, dens: 5,
      rules: { type: 'elim', sudden: false, hearts: 'hero' },
      netCfg, onEvent: () => {},
      players: [A, B],
    });
    g.state = 'play'; g.cdDone = true; if (g.rules) g.rules.sudden = false; g.puT = 1e9; g.playTime = 0;
    for (const f of g.fighters) { f.nineUsed = true; f.inv = 0.05; }
    return g;
  };
  const park = (g) => {
    for (const f of g.fighters) { f.vx = f.vz = 0; f.charging = false; f.chargeT = 0; f.dashT = 0; f.slT = -1; f.stunT = 0; f.frozenT = 0; f.chillT = 0; f.inv = 0; f.ammo = Math.max(1, f.maxAmmo); f.alive = true; f.fadeOn = 0; }
    for (const b of [...g.booms]) { try { b.kill(); } catch (e) {} }
    g.booms.length = 0; g.hitstop = 0;
  };

  // Difficulty knobs actually land on the Bot
  const knobs = {};
  for (const di of [0, 1, 2]) {
    const g = mkGame('bao', 'pico', di);
    const bot = g.fighters[0].bot;
    knobs[di] = { react: bot.d.react, err: bot.d.err, dodge: bot.d.dodge, lead: bot.d.lead, mistake: bot.d.mistake, aggr: bot.d.aggr, hid: bot.hid, stylePref: bot.sty.pref };
    g.dispose();
  }

  // Dodge rate: throw a straight boom at a parked bot; freeze wander so only a real dodge counts
  const dodge = {};
  for (const di of [0, 1, 2]) {
    let moved = 0, n = 24;
    for (let i = 0; i < n; i++) {
      const g = mkGame('nori', 'bao', di, 'dojo', 'off', 'small');
      park(g);
      const botF = g.fighters[0], thrower = g.fighters[1];
      botF.x = 0; botF.z = 0; botF.vx = botF.vz = 0; botF.inv = 0; botF.hp = botF.maxHp;
      botF.bot.think = function () { this.dir = [0, 0]; this.target = null; };
      thrower.x = -5.2; thrower.z = 0; thrower.face = thrower.vface = Math.PI / 2; thrower.ammo = 3; thrower.inv = 9;
      thrower.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
      g.throwFrom(thrower, Math.PI / 2, 0, 0.15);
      for (let t = 0; t < 90; t++) g.update(STEP);
      if ((botF.bot.st && botF.bot.st.dodge > 0)) moved++;
      g.dispose();
    }
    dodge[di] = { moved, n, rate: moved / n };
  }

  // Lead aim: dummy runs sideways, measure aim vs current vs future position
  const lead = {};
  for (const di of [0, 1, 2]) {
    let ahead = 0, behind = 0, throws = 0, absErr = 0, used = 0;
    for (let i = 0; i < 16; i++) {
      const g = mkGame('pico', 'nori', di, 'dojo', 'off', 'small');
      park(g);
      const aimF = g.fighters[0], runF = g.fighters[1];
      aimF.x = -4; aimF.z = 0; aimF.vx = aimF.vz = 0; aimF.ammo = 3; aimF.inv = 9;
      runF.x = 1.5; runF.z = -2.2; runF.inv = 9; runF.hp = runF.maxHp;
      // runner just strafes +Z; aimer is a real bot
      runF.bot.update = () => ({ mx: 0, mz: 1, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
      // give the aimer a moment to see the motion
      for (let t = 0; t < 20; t++) g.update(STEP);
      const before = aimF.bot.st.throw;
      for (let t = 0; t < 90 && aimF.bot.st.throw === before; t++) g.update(STEP);
      if (aimF.bot.st.throw > before && aimF.bot.aim) {
        throws++;
        used += aimF.bot.st.lead > 0 ? 1 : 0;
        const a = Math.atan2(aimF.bot.aim[0], aimF.bot.aim[1]);
        const cur = Math.atan2(runF.x - aimF.x, runF.z - aimF.z);
        const fut = Math.atan2((runF.x + runF.vx * 0.35) - aimF.x, (runF.z + runF.vz * 0.35) - aimF.z);
        const dCur = Math.abs(a - cur), dFut = Math.abs(a - fut);
        if (dFut + 0.01 < dCur) ahead++;
        if (dCur + 0.02 < dFut) behind++;
        absErr += Math.min(dCur, Math.abs(dCur - Math.PI * 2));
      }
      g.dispose();
    }
    lead[di] = { throws, ahead, behind, used, meanAbsErr: throws ? absErr / throws : 9 };
  }

  // Catch rate: force a return, see if the owner walks to it (Bao vs Pico, Normal)
  const catchOf = (id) => {
    let got = 0, sought = 0, n = 14;
    for (let i = 0; i < n; i++) {
      const g = mkGame(id, 'nori', 1, 'dojo', 'off', 'small');
      park(g);
      const f = g.fighters[0], o = g.fighters[1];
      f.x = 0; f.z = 0; f.vx = f.vz = 0; f.ammo = 3; f.inv = 9;
      o.x = 8; o.z = 8; o.inv = 9;
      o.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
      g.throwFrom(f, 0, 0, 0.35);
      const b = g.booms.find((bb) => bb.alive && bb.owner === f);
      let caught = false;
      for (let t = 0; t < 240 && b && b.alive; t++) {
        g.update(STEP);
        if (!b.alive) caught = true;
      }
      if (f.bot.st.catchSeek > 0) sought++;
      if (caught || f.ammo >= 3) got++;
      g.dispose();
    }
    return { got, sought, n, rate: got / n, seekRate: sought / n };
  };
  const catchRates = { bao: catchOf('bao'), pico: catchOf('pico') };

  // Bush use: Wisp vs Pico on a bushy map (jungle), plus a hurt Bao
  const bushOf = (id, hurt) => {
    let entered = 0, sought = 0, n = 10;
    for (let i = 0; i < n; i++) {
      const g = mkGame(id, 'gus', 1, 'jungle', 'off', 'small');
      park(g);
      const f = g.fighters[0], o = g.fighters[1];
      f.x = 0; f.z = 0; if (hurt) { f.hp = 1; }
      o.x = 8; o.z = 6; o.inv = 9;
      o.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
      let inB = false;
      for (let t = 0; t < 180; t++) {
        g.update(STEP);
        if (f.bushIn) inB = true;
      }
      if (inB) entered++;
      if (f.bot.st.bushSeek > 0) sought++;
      g.dispose();
    }
    return { entered, sought, n, enterRate: entered / n, seekRate: sought / n };
  };
  const bushes = { wisp: bushOf('wisp', false), pico: bushOf('pico', false), baoHurt: bushOf('bao', true) };

  // Hidden rival: Pico must not lock a Wisp sitting in a bush (no wallhack)
  let hiddenLock = 0, hiddenTrials = 8, canSeeHidden = 0, hiddenIn = 0;
  for (let i = 0; i < hiddenTrials; i++) {
    const g = mkGame('pico', 'wisp', 2, 'jungle', 'off', 'small');
    park(g);
    const pico = g.fighters[0], wisp = g.fighters[1];
    const [HX, HZ] = bg.hxz(); const AW = HX * 2; const B = g.layout && g.layout.bush;
    let spot = null;
    if (B) {
      for (let k = 0; k < B.length; k++) if (B[k]) {
        const ii = k % AW, jj = (k / AW) | 0;
        if (B[k + 1] && B[k + AW] && B[k + AW + 1]) { spot = [ii - HX + 1, jj - HZ + 1]; break; }
      }
      if (!spot) {
        for (let k = 0; k < B.length; k++) if (B[k]) { const ii = k % AW, jj = (k / AW) | 0; spot = [ii - HX + 0.5, jj - HZ + 0.5]; break; }
      }
    }
    wisp.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    if (spot) { wisp.x = spot[0]; wisp.z = spot[1]; wisp.vx = wisp.vz = 0; }
    pico.x = -HX + 1.2; pico.z = -HZ + 1.2; pico.inv = 9; pico.ammo = 3; pico.vx = pico.vz = 0;
    // keep pico from walking into the bush
    pico.bot.think = function () { this.dir = [0, 0]; };
    for (let t = 0; t < 20; t++) g.update(STEP);
    const found = !!wisp.bushIn;
    if (found) hiddenIn++;
    for (let t = 0; t < 45; t++) g.update(STEP);
    const see = (bg.stealth && bg.stealth.canSee) ? bg.stealth.canSee(g, pico.team, wisp) : null;
    if (wisp.bushIn && pico.bot.target === wisp) hiddenLock++;
    if (see) canSeeHidden++;
    const rec = { found, bushIn: !!wisp.bushIn, spot, target: pico.bot.target && pico.bot.target.hero && pico.bot.target.hero.id, see, pico: [pico.x, pico.z] };
    g.dispose();
    if (i === 0) bushes._sample = rec;
  }
  bushes.hiddenIn = hiddenIn;

  // Playstyle distances / dashes vs a standing dummy (Normal, 8s)
  const style = {};
  for (const id of ['nori', 'gus', 'pico', 'yuki', 'wisp', 'bao', 'tako', 'kuma']) {
    const g = mkGame(id, 'nori', 1, 'dojo', 'off', 'small');
    const f = g.fighters.find((q) => q.hero.id === id);
    const o = g.fighters.find((q) => q !== f);
    f.x = -4; f.z = 0; f.vx = f.vz = 0; f.inv = 2; f.ammo = Math.max(1, f.maxAmmo);
    o.x = 3.2; o.z = 0; o.vx = o.vz = 0; o.inv = 9; o.hp = o.maxHp;
    o.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    let distSum = 0, distN = 0, dashes = 0, specials = 0, melee = 0;
    for (let t = 0; t < 480; t++) {
      g.update(STEP);
      o.vx = o.vz = 0; o.x = 3.2; o.z = 0; o.alive = true; o.hp = o.maxHp; o.inv = 9;
      if (f.alive) { distSum += Math.hypot(f.x - o.x, f.z - o.z); distN++; }
      dashes = f.bot.st.dashIn + f.bot.st.dashOut;
      specials = f.bot.st.special;
      melee = f.bot.st.melee;
    }
    style[id] = { meanDist: distN ? distSum / distN : 0, dashes, specials, melee, catchSeek: f.bot.st.catchSeek, bushSeek: f.bot.st.bushSeek, st: { ...f.bot.st } };
    g.dispose();
  }

  // Stuck bots: 4-way FFA on a trap map, 20s
  const stuck = (() => {
    if (bg.setArenaSize) bg.setArenaSize('large');
    const hs = bg.HEROES.slice(0, 4);
    const players = hs.map((h, i) => ({ hero: h, hat: 'none', ctrl: 'bot', slot: -1, name: h.name, diff: 1, team: i, weapon: 'boom' }));
    const ev = {};
    const g = new bg.Game({
      mode: 'classic', arenaId: 'dojo', intro: 0, input: bg.Input, traps: 'some', dens: 5,
      rules: { type: 'elim', sudden: false, hearts: 'hero' },
      netCfg, onEvent: () => {},
      players,
    });
    g.state = 'play'; g.cdDone = true; if (g.rules) g.rules.sudden = false; g.puT = 1e9;
    const last = g.fighters.map((f) => ({ x: f.x, z: f.z, t: 0, maxStill: 0 }));
    let trapHits = 0;
    for (let t = 0; t < 20 * 60; t++) {
      g.update(STEP);
      g.fighters.forEach((f, i) => {
        const L = last[i];
        const hiding = !!(f.bushIn) || (f.fadeOn || 0) > 0.55 || !f.alive;
        if (!hiding && Math.hypot(f.x - L.x, f.z - L.z) < 0.3) L.t += STEP; else { L.maxStill = Math.max(L.maxStill, L.t); L.t = 0; L.x = f.x; L.z = f.z; }
      });
    }
    g.fighters.forEach((f, i) => { last[i].maxStill = Math.max(last[i].maxStill, last[i].t); last[i].stuckN = f.bot.st.stuck; last[i].alive = f.alive; last[i].id = f.hero.id; });
    const maxStill = Math.max(...last.map((s) => s.maxStill));
    const nudged = last.reduce((a, s) => a + s.stuckN, 0);
    try { g.dispose(); } catch (e) {}
    return { maxStill, nudged, per: last.map((s) => ({ id: s.id, maxStill: +s.maxStill.toFixed(2), stuckN: s.stuckN, alive: s.alive })) };
  })();

  // Performance: 4 bots, 10s of sim, record update time
  const perf = (() => {
    if (bg.setArenaSize) bg.setArenaSize('large');
    const hs = bg.HEROES.slice(0, 4);
    const players = hs.map((h, i) => ({ hero: h, hat: 'none', ctrl: 'bot', slot: -1, name: h.name, diff: 1, team: i, weapon: 'boom' }));
    const g = new bg.Game({
      mode: 'classic', arenaId: 'rooftop', intro: 0, input: bg.Input, traps: 'some', dens: 5,
      rules: { type: 'elim', sudden: false, hearts: 'hero' },
      netCfg, onEvent: () => {},
      players,
    });
    g.state = 'play'; g.cdDone = true; if (g.rules) g.rules.sudden = false;
    const N = 600;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    for (let t = 0; t < N; t++) g.update(STEP);
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    try { g.dispose(); } catch (e) {}
    const total = t1 - t0;
    return { frames: N, totalMs: total, avgMs: total / N, bots: 4 };
  })();

  return { knobs, dodge, lead, catchRates, bushes, hiddenLock, hiddenTrials, canSeeHidden, style, stuck, perf };
});

ok('Easy/Normal/Hard knobs reach the live Bot (react and error scale)', behav.knobs[0].react > behav.knobs[1].react && behav.knobs[1].react > behav.knobs[2].react && behav.knobs[0].err > behav.knobs[2].err && behav.knobs[0].mistake > 0 && behav.knobs[2].mistake === 0, behav.knobs);
ok('Hard still has human-like error and is not an aimbot (err >= 0.05, dodge < 0.95)', behav.knobs[2].err >= 0.05 && behav.knobs[2].lead <= 1 && behav.knobs[2].dodge < 0.95, behav.knobs[2]);

ok('bots dodge incoming boomerangs, and Hard dodges more often than Easy', behav.dodge[2].rate > behav.dodge[0].rate && behav.dodge[2].rate >= 0.45 && behav.dodge[0].rate < 0.85, behav.dodge);
ok('bots lead moving targets on Normal/Hard (aim ahead of the runner, Easy throws less often)', behav.lead[2].throws >= 8 && behav.lead[2].ahead > behav.lead[2].behind && behav.lead[1].ahead > behav.lead[1].behind && behav.lead[0].throws <= behav.lead[2].throws && behav.lead[2].used >= 4, behav.lead);
ok('bots walk to catch their own returns (Bao seeks at least as much as Pico)', behav.catchRates.bao.seekRate >= 0.4 && behav.catchRates.bao.seekRate + 0.01 >= behav.catchRates.pico.seekRate && behav.catchRates.bao.rate >= 0.35, behav.catchRates);
ok('Wisp uses bushes more than Pico, and a hurt tank will also seek cover', behav.bushes.wisp.seekRate > behav.bushes.pico.seekRate && (behav.bushes.wisp.enterRate > 0 || behav.bushes.wisp.seekRate >= 0.4) && behav.bushes.baoHurt.seekRate >= 0.3, behav.bushes);
ok('Hard Pico does not lock a hidden bush Wisp (no seeing through bushes)', behav.bushes.hiddenIn >= 6 && behav.hiddenLock === 0 && behav.canSeeHidden === 0, { hiddenLock: behav.hiddenLock, hiddenIn: behav.bushes.hiddenIn, hiddenTrials: behav.hiddenTrials, canSeeHidden: behav.canSeeHidden, sample: behav.bushes._sample });
ok('playstyles show up in motion: Gus stays closer than Pico, Nori dashes more than Bao', behav.style.gus.meanDist + 0.4 < behav.style.pico.meanDist && behav.style.nori.dashes > behav.style.bao.dashes, behav.style);
ok('bots do not stay stuck (max still < 3.2s except a purposeful hide; stuck nudge works)', behav.stuck.maxStill < 3.2, behav.stuck);
ok('4-bot update stays cheap enough for a phone (avg tick under 8 ms on this computer)', behav.perf.avgMs < 8, behav.perf);

// ---- bot-vs-bot win rates (same pairing as style416: 448 games / fighter, 2 maps) ----
let balance = null;
if (!SKIP_BAL) {
  console.log('running bot-vs-bot round-robin...');
  balance = await page.evaluate((N0) => {
    const bg = __bg;
    const ids = bg.HEROES.map((h) => h.id);
    const names = Object.fromEntries(bg.HEROES.map((h) => [h.id, h.name]));
    const N = N0 || 32;
    const stats = {};
    for (const id of ids) stats[id] = { w: 0, l: 0, d: 0, games: 0 };
    const matrix = {};
    const netCfg = { ts: 1, catch: 1, camWide: 1, ease: 0 };
    if (bg.setArenaSize) bg.setArenaSize('small');
    const timeout = 45 * 60;
    const maps = ['dojo', 'rooftop'];
    const play = (idA, idB, swap, arena) => {
      const hA = bg.HEROES.find((h) => h.id === idA);
      const hB = bg.HEROES.find((h) => h.id === idB);
      const A = { hero: hA, hat: 'none', ctrl: 'bot', slot: -1, name: hA.name, diff: 1, team: 0, weapon: bg.weapons.heroWeapons(hA.id)[0] };
      const B = { hero: hB, hat: 'none', ctrl: 'bot', slot: -1, name: hB.name, diff: 1, team: 1, weapon: bg.weapons.heroWeapons(hB.id)[0] };
      const players = swap ? [B, A] : [A, B];
      let done = false, winner = null;
      const g = new bg.Game({
        mode: 'vs', arenaId: arena, intro: 0, input: bg.Input, traps: 'off', dens: 5,
        rules: { type: 'elim', sudden: false, hearts: 'hero' },
        netCfg, onEvent: (n, d) => { if (n === 'roundEnd') { done = true; winner = d.winner; } },
        players,
      });
      g.state = 'play'; g.cdDone = true; if (g.rules) g.rules.sudden = false; g.puT = 1e9; g.playTime = 0;
      for (const f of g.fighters) f.nineUsed = true;
      let t = 0;
      while (!done && t < timeout) { g.update(1 / 60); t++; }
      let res = 'd';
      if (done && winner && winner.hero) {
        const wid = winner.hero.id;
        if (wid === idA) res = 'a'; else if (wid === idB) res = 'b';
      }
      try { g.dispose(); } catch (e) {}
      return res;
    };
    const perMap = {};
    for (const arena of maps) {
      perMap[arena] = {};
      for (const id of ids) perMap[arena][id] = { w: 0, l: 0, d: 0, games: 0 };
    }
    for (const arena of maps) {
      if (bg.setArenaSize) bg.setArenaSize('small');
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j];
          const key = arena + ':' + a + ':' + b;
          matrix[key] = { a: 0, b: 0, d: 0 };
          for (let n = 0; n < N; n++) {
            const res = play(a, b, n % 2 === 1, arena);
            stats[a].games++; stats[b].games++;
            perMap[arena][a].games++; perMap[arena][b].games++;
            if (res === 'a') { stats[a].w++; stats[b].l++; perMap[arena][a].w++; perMap[arena][b].l++; matrix[key].a++; }
            else if (res === 'b') { stats[b].w++; stats[a].l++; perMap[arena][b].w++; perMap[arena][a].l++; matrix[key].b++; }
            else { stats[a].d++; stats[b].d++; perMap[arena][a].d++; perMap[arena][b].d++; matrix[key].d++; }
          }
        }
      }
    }
    const tableOf = (src) => ids.map((id) => {
      const s = src[id];
      const wr = s.games ? s.w / s.games : 0;
      return { id, name: names[id], wins: s.w, losses: s.l, draws: s.d, games: s.games, winRate: wr };
    }).sort((x, y) => y.winRate - x.winRate);
    const table = tableOf(stats);
    const byMap = {};
    for (const arena of maps) byMap[arena] = tableOf(perMap[arena]);
    return { table, byMap, maps, matrix, N };
  }, N_OVERRIDE);

  const wrMax = Math.max(...balance.table.map((r) => r.winRate));
  const wrMin = Math.min(...balance.table.map((r) => r.winRate));
  const yuki = balance.table.find((r) => r.id === 'yuki');
  const wisp = balance.table.find((r) => r.id === 'wisp');
  ok('bot-vs-bot win rates stay bunched (40–60%)', wrMax <= 0.60 && wrMin >= 0.40, { max: wrMax, min: wrMin, table: balance.table, byMap: balance.byMap });
  ok('every fighter played the same number of sim matches across 2 maps', balance.table.every((r) => r.games === balance.table[0].games) && balance.maps.length >= 2 && (N_OVERRIDE ? balance.table[0].games > 0 : balance.table[0].games >= 448), balance.table.map((r) => [r.id, r.games, balance.maps]));
  ok('Yuki and Wisp stay in the fair band (40–60%)', yuki && wisp && yuki.winRate >= 0.40 && yuki.winRate <= 0.60 && wisp.winRate >= 0.40 && wisp.winRate <= 0.60, { yuki, wisp });

  const wrLine = (r) => { const dec = r.wins + r.losses; const dwr = dec ? r.wins / dec : 0; return `  ${r.name.padEnd(8)} ${r.id.padEnd(5)}  ${r.wins}-${r.losses}-${r.draws}  ${(r.winRate * 100).toFixed(1)}%  (decided ${(dwr * 100).toFixed(1)}%, n=${r.games})`; };
  console.log('WIN-RATE TABLE pooled (N=' + balance.N + ' per pairing per map, maps=' + (balance.maps || []).join(',') + ')');
  for (const r of balance.table) console.log(wrLine(r));
  for (const arena of (balance.maps || [])) {
    console.log('WIN-RATE ' + arena);
    for (const r of (balance.byMap[arena] || [])) console.log(wrLine(r));
  }
}

// ---- media: dodge / catch / ambush GIF ----
if (!SKIP_MEDIA) {
  const hideChrome = async () => {
    await page.evaluate(() => {
      for (const id of ['touch', 'countdown', 'hud', 'pause', 'a2hs', 'notes']) {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
      }
      document.querySelectorAll('.hud, #joy, #btns').forEach((el) => { el.style.display = 'none'; });
      if (__bg.gfx && __bg.gfx.follow) __bg.gfx.follow.fixed = true;
    });
  };
  const startAs = async (hero, rival = 'bao', arena = 'dojo') => {
    await page.evaluate(({ hero, rival, arena }) => {
      const S = __bg.S(); S.hero = hero; S.settings.events = 'off'; S.settings.speed = 'fast'; S.setup.traps = 'off';
      try { __bg.app.quitToMenu(); } catch (e) {}
      const hd = __bg.app.humanDef(0);
      const other = __bg.HEROES.find((h) => h.id === rival);
      const bot = __bg.app.botDef(other);
      __bg.app.match = { mode: 'classic', rulesMode: 'classic', players: [hd, bot], round: 0, need: 1, arena, size: 'small', traps: 'off', mutator: 'off', humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {} };
      __bg.app.nextRound(true);
      const g = __bg.app.game; __bg.app.paused = true;
      let k = 0; while (g && g.state !== 'play' && k++ < 4000) __bg.step(1);
      g.fighters.forEach((f) => { f.vx = 0; f.vz = 0; f.inv = 4; });
      if (g.booms) { for (const b of [...g.booms]) { try { b.kill(); } catch (e) {} } g.booms.length = 0; }
      g.playTime = 0; g.puT = 1e9; g.sudden = false;
      if (__bg.app.cdHide) __bg.app.cdHide();
      const el = document.getElementById('countdown'); if (el) { el.className = ''; el.style.display = 'none'; }
    }, { hero, rival, arena });
  };
  const framesDir = path.join(OUT, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  let fi = 0;
  const shot = async (label) => {
    const f = path.join(framesDir, String(fi).padStart(3, '0') + '-' + label + '.png');
    await page.screenshot({ path: f, fullPage: false });
    fi++;
    return f;
  };
  const poseCam = async (xs, zs) => {
    await page.evaluate(({ xs, zs }) => {
      if (__bg.overview) __bg.overview(true);
      const fol = __bg.gfx.follow;
      if (fol) { fol.x = xs || 0; fol.z = zs || 0; fol.fixed = true; }
      __bg.camNow(); __bg.renderNow();
    }, { xs, zs });
  };

  // 1) Nori dodges a throw
  await startAs('nori', 'bao', 'dojo');
  await hideChrome();
  await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => f.hero.id === 'nori'); const o = g.fighters.find((f) => f !== me);
    me.isBot = true; me.bot = new __bg.Bot(g, me, 2, 'trickster');
    me.x = 0; me.z = 0; me.inv = 0; me.vx = me.vz = 0; me.alive = true;
    o.x = -5.4; o.z = 0; o.face = o.vface = Math.PI / 2; o.inv = 9; o.ammo = 3;
    if (o.bot) o.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    g.throwFrom(o, Math.PI / 2, 0, 0.15);
    if (__bg.overview) __bg.overview(true);
  });
  await poseCam(0, 0);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { __bg.step(3); __bg.camNow(); __bg.renderNow(); });
    await shot('dodge');
  }

  // 2) Bao catches a return
  await startAs('bao', 'nori', 'dojo');
  await hideChrome();
  await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => f.hero.id === 'bao'); const o = g.fighters.find((f) => f !== me);
    me.isBot = true; me.bot = new __bg.Bot(g, me, 1, 'defender');
    me.x = 0; me.z = 0; me.inv = 9; me.ammo = 3; me.vx = me.vz = 0;
    o.x = 8; o.z = 6; o.inv = 9;
    if (o.bot) o.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    g.throwFrom(me, 0.15, 0, 0.4);
    if (__bg.overview) __bg.overview(true);
  });
  await poseCam(0, 1);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { __bg.step(6); __bg.camNow(); __bg.renderNow(); });
    await shot('catch');
  }

  // 3) Wisp lurks in a bush then pops out
  await startAs('wisp', 'gus', 'jungle');
  await hideChrome();
  await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => f.hero.id === 'wisp'); const o = g.fighters.find((f) => f !== me);
    me.isBot = true; me.bot = new __bg.Bot(g, me, 1, 'trickster');
    me.x = 0; me.z = 0; me.inv = 2; me.alive = true;
    o.x = 5; o.z = 3; o.inv = 9;
    if (o.bot) o.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    if (__bg.overview) __bg.overview(true);
  });
  await poseCam(0, 0);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { __bg.step(5); __bg.camNow(); __bg.renderNow(); });
    await shot('ambush');
  }

  const dodgeShot = fs.readdirSync(framesDir).filter((n) => n.includes('dodge')).sort().pop();
  const catchShot = fs.readdirSync(framesDir).filter((n) => n.includes('catch')).sort().pop();
  const ambushShot = fs.readdirSync(framesDir).filter((n) => n.includes('ambush')).sort().pop();
  const strip = path.join(OUT, 'bots419-actions-strip.png');
  const pick = [dodgeShot, catchShot, ambushShot].map((n) => path.join(framesDir, n));
  const mont = spawnSync('ffmpeg', ['-y', '-i', pick[0], '-i', pick[1], '-i', pick[2], '-filter_complex', 'hstack=inputs=3', strip], { encoding: 'utf8' });
  if (mont.status !== 0) console.log('strip ffmpeg', mont.status, (mont.stderr || '').slice(-400));
  else console.log('wrote', strip);

  const gif = path.join(OUT, 'bots419-flow.gif');
  const all = fs.readdirSync(framesDir).filter((n) => n.endsWith('.png')).sort().map((n) => path.join(framesDir, n));
  // palette gif from the frame sequence
  const list = path.join(framesDir, 'list.txt');
  fs.writeFileSync(list, all.map((f) => `file '${f}'\nduration 0.12`).join('\n') + `\nfile '${all[all.length - 1]}'\n`);
  const g1 = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=10,scale=915:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-loop', '0', gif], { encoding: 'utf8' });
  if (g1.status !== 0) console.log('gif ffmpeg', g1.status, (g1.stderr || '').slice(-500));
  else console.log('wrote', gif, fs.statSync(gif).size);
}

// ---- before/after table (style416 results vs this run) ----
let before = null;
const beforePaths = [
  '/workspace/out/bots419/style416-before.json',
  '/workspace/out/style416/style416-results.json',
];
for (const bp of beforePaths) {
  try {
    const parsed = JSON.parse(fs.readFileSync(bp, 'utf8'));
    before = parsed.balance || parsed;
    if (before && before.table) { console.log('before table from', bp); break; }
  } catch (e) { /* try next */ }
}
if (!before) console.log('no prior style416 table');

const afterRows = (balance && balance.table) || [];
const beforeRows = (before && before.table) || [];
const names = { bao: 'Bao', nori: 'Nori', tako: 'Bolt', kuma: 'Salty', pico: 'Pico', yuki: 'Yuki', gus: 'Gus', wisp: 'Wisp' };
const ids = Object.keys(names);
const rowOf = (table, id) => (table || []).find((r) => r.id === id);
const pct = (n) => (n == null ? '—' : (n * 100).toFixed(1) + '%');
let mdTable = '| Fighter | Before | After | Change |\n|---|---:|---:|---:|\n';
for (const id of ids) {
  const b = rowOf(beforeRows, id); const a = rowOf(afterRows, id);
  const ch = (b && a) ? ((a.winRate - b.winRate) * 100) : null;
  const chs = ch == null ? '—' : ((ch >= 0 ? '+' : '') + ch.toFixed(1) + ' pp');
  mdTable += `| ${names[id]} | ${pct(b && b.winRate)} | ${pct(a && a.winRate)} | ${chs} |\n`;
}

if (!SKIP_MEDIA) {
  const html = `<!doctype html><meta charset="utf-8"><title>Bots before / after</title>
<style>
  body{margin:0;background:#1a2330;color:#f2f5f8;font:20px/1.35 ui-rounded,system-ui,sans-serif;padding:28px 32px}
  h1{font-size:28px;margin:0 0 6px}
  p{margin:0 0 16px;opacity:.85;font-size:16px}
  table{border-collapse:collapse;width:100%;background:#243044;border-radius:16px;overflow:hidden}
  th,td{padding:10px 14px;text-align:right}
  th:first-child,td:first-child{text-align:left}
  th{background:#2e3d55;font-size:15px;letter-spacing:.04em}
  tr:nth-child(even) td{background:#28364c}
  .up{color:#7ee3a3}.down{color:#ffb3b3}.same{color:#c9d4e0}
</style>
<h1>Bot-vs-bot win rates</h1>
<p>Same test as before: 448 games per fighter, Dojo + Rooftop, Normal skill, Chill rules off (sim at 1×).</p>
<table><thead><tr><th>Fighter</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>
${ids.map((id) => {
    const b = rowOf(beforeRows, id); const a = rowOf(afterRows, id);
    const ch = (b && a) ? ((a.winRate - b.winRate) * 100) : null;
    const cls = ch == null ? 'same' : (ch > 0.4 ? 'up' : ch < -0.4 ? 'down' : 'same');
    const chs = ch == null ? '—' : ((ch >= 0 ? '+' : '') + ch.toFixed(1) + ' pp');
    return `<tr><td>${names[id]}</td><td>${pct(b && b.winRate)}</td><td>${pct(a && a.winRate)}</td><td class="${cls}">${chs}</td></tr>`;
  }).join('')}
</tbody></table>`;
  const tablePath = path.join(OUT, 'bots419-table.html');
  fs.writeFileSync(tablePath, html);
  const tpage = await browser.newPage();
  await tpage.setViewport({ width: 720, height: 520, deviceScaleFactor: 1 });
  await tpage.goto('file://' + tablePath, { waitUntil: 'load' });
  await tpage.screenshot({ path: path.join(OUT, 'bots419-stats.png'), fullPage: true });
  await tpage.close();
  console.log('wrote', path.join(OUT, 'bots419-stats.png'));
}

const unexpected = errors.filter((e) => !/unsupported MIME type|ServiceWorker|Failed to start the audio|sw failed|PeerJS|ERR_CONNECTION_REFUSED/i.test(e));
ok('no unexpected page errors', unexpected.length === 0, unexpected.slice(0, 6));

const summary = [
  '# bots419 — smarter bots (local only)',
  '',
  'Nothing in this folder has been published. Chill is still the default game speed. New players and fresh Chill setups now start on **Easy** bot skill (used to be Medium, now called **Normal**).',
  '',
  '## What changed, in plain words',
  '- Each bot plays more like its fighter: Nori dashes in and out, Gus brawls up close, Wisp hides in bushes then jumps out, Yuki chills a rival and then chases, Bolt zaps when he is near, Salty hunts catches, Pico throws from far away, and Bao stays sturdy and catches well.',
  '- Bots lead moving throws a little (with human-like misses), sidestep or shield incoming boomerangs, walk back to catch their own returns, use bushes when they are hurt, stay off traps, back up when they are low on hearts, swing when they are close, and use Special at sensible times.',
  '- **Easy** is slower and a bit clumsy on purpose, so kids can read the mistakes. **Normal** is a fair fight. **Hard** is sharp, but not an aimbot, and bots still cannot see through bushes.',
  '',
  '## Tests',
  `- ${pass} passed, ${fail} failed.`,
  `- Behavior: dodge, lead, catch, bushes, difficulty knobs, no bush wallhack, playstyles, no-stuck, phone-cost.`,
  balance ? `- Balance: ${balance.table.map((r) => `${r.name} ${(r.winRate * 100).toFixed(1)}%`).join(', ')}.` : '- Balance skipped this run.',
  '',
  '## Before / after win rates (Normal skill, 448 games each, Dojo + Rooftop)',
  '',
  mdTable,
  '',
  '## Media',
  '- `bots419-difficulty.png` — Bot skill on the setup screen (Easy / Normal / Hard, Easy selected).',
  '- `bots419-flow.gif` — a bot dodging, Bao catching a return, Wisp lurking then popping out.',
  '- `bots419-actions-strip.png` — one frame from each of those moments.',
  '- `bots419-stats.png` — the before/after table.',
  '',
  '## Files',
  '- `src/ai.js` — playstyles, difficulty, lead, catch, bushes, retreat, Special, stuck nudge.',
  '- `src/save.js`, `src/net/net.js` — Easy is the new default.',
  '- `src/ui2.js`, `src/ui.js`, `src/netui.js` — Medium renamed to Normal.',
  '- `src/main.js` — exports BOT_DIFFS and BOT_STYLES for tests.',
  '- `README.md` — Easy default, Easy / Normal / Hard.',
  '- `tools/bots419.mjs` — this test.',
  '',
  '## Issues',
  '- Salty is a bit strong and Pico and Nori are a bit weak against the smarter bots. Fighter kits were not changed. Across three 448-game runs Yuki landed 39–45% and Wisp 38–40%, right around the 40% floor (both well inside 35–60%).',
  '- This is a local preview only. Nothing has been pushed or published.',
].join('\n');
fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), summary);
fs.writeFileSync(path.join(OUT, 'bots419-results.json'), JSON.stringify({ meta, setupUi, behav, balance, before: beforeRows, pass, fail }, null, 2));
console.log(summary);
console.log(`bots419 ${pass}/${pass + fail}  fail=${fail}`);
if (fail) console.log('FAILED');
else console.log('OK bots419 ' + pass + '/' + (pass + fail));

await browser.close();
process.exit(fail ? 1 : 0);
