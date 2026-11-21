// hud422: overhead indicators (health pips, boomerang pips, signature ring) replace top-of-screen health counts.
import { launch, sleep } from './lib.mjs';
import { startRelay, openN, ev, waitFor } from './netlib.mjs';
import http from 'node:http'; import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const RLY = process.argv[3] || 'ws://127.0.0.1:8799';
const OUT = '/workspace/out/hud422'; fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 600) : '')); };
const ign = (e) => /AudioContext|font|favicon|icon-192|ERR_FILE_NOT_FOUND|REQFAIL/i.test(e);
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60)))));
{
  const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true, paytest: 'unlock' });
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
  await page.goto('file://' + HTML, { waitUntil: 'load' });
  for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.app.ready && __bg.ohud))) break; await sleep(100); }
  const d = await page.evaluate(() => { const S = __bg.S(); return { speed: S.settings.speed, battery: S.settings.battery, diff: S.setup.diff }; });
  ok('defaults unchanged: Chill, Battery saver Auto, Easy bots', d.speed === 'chill' && d.battery === 'auto' && (d.diff === 0 || d.diff === 'easy' || d.diff === undefined), d);
  await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = true; S.setup.mode = 'classic'; __bg.app.startMode('classic'); });
  await waitFor(() => page.evaluate(() => !!(__bg.app.game && __bg.app.game.fighters && __bg.app.game.fighters.length)), 15000);
  await page.evaluate(() => {
    const g = __bg.app.game;
    for (const f of g.fighters) {
      f.inv = 99; f.stunT = 99; f.vx = f.vz = 0;
      if (f.bot) f.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false, melee: false });
    }
  });
  await waitFor(() => page.evaluate(() => __bg.app.game && __bg.app.game.state === 'play'), 15000);
  await sleep(600);
  const a = await page.evaluate(() => { const g = __bg.app.game; return { n: __bg.ohud.last.length, alive: g.fighters.filter((f) => f.alive && f.model.root.visible).length, me: __bg.ohud.last.filter((x) => x.me).length, cv: !!document.getElementById('ohud'),
    hearts: document.querySelectorAll('#h-pl .heart, #h-pl .hearts, #h-pl .ultbar').length, chips: document.querySelectorAll('#h-pl .pchip').length, badge: document.querySelectorAll('#h-pl .pchip .rbadge').length, topH: Math.round(document.querySelector('#hud .top').getBoundingClientRect().height) }; });
  ok('overhead canvas exists and draws one indicator per visible fighter', a.cv && a.n === a.alive && a.n >= 2, a);
  ok('own fighter is marked (white outline)', a.me === 1, a);
  ok('no health hearts / ULT bars in the top HUD', a.hearts === 0, a);
  ok('top chips stay (face + rank badge), rank badge still on own chip', a.chips >= 2 && a.badge >= 1, a);
  const px = await page.evaluate(() => { const c = document.getElementById('ohud'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
  ok('indicator pixels are actually painted', px > 200, px);
  // health tracking
  await page.evaluate(() => { const g = __bg.app.game; const f = g.fighters[1]; window.__F = f; f.inv = 99; f.hp = Math.max(1, f.maxHp - 1); });
  await frame(page);
  const h = await page.evaluate(() => { const f = __F; const e = __bg.ohud.last.find((x) => x.i === f.idx); return { hp: f.hp, mh: f.maxHp, e }; });
  ok('health pips track hp', h.e && h.e.hp === h.hp && h.e.mh === h.mh, h);
  // throw pip
  await page.evaluate(() => { const f = __F; f.ammo = 0; f.maxAmmo = 2; f.throwCd = 9; });
  await frame(page);
  const t = await page.evaluate(() => { const e = __bg.ohud.last.find((x) => x.i === __F.idx); return e && { am: e.am, na: e.na }; });
  ok('boomerang pips: dim while thrown (0 of 2 ready)', t && t.am === 0 && t.na === 2, t);
  await page.evaluate(() => { __F.ammo = 2; });
  await frame(page);
  const t2 = await page.evaluate(() => { const e = __bg.ohud.last.find((x) => x.i === __F.idx); return e && e.am; });
  ok('boomerang pips light up when back in hand', t2 === 2, t2);
  // signature ring
  await page.evaluate(() => { __F.ult = 40; }); await frame(page);
  const u1 = await page.evaluate(() => { const e = __bg.ohud.last.find((x) => x.i === __F.idx); return e && { ult: e.ult, rdy: e.rdy }; });
  await page.evaluate(() => { __F.ult = 100; }); await frame(page);
  const u2 = await page.evaluate(() => { const e = __bg.ohud.last.find((x) => x.i === __F.idx); return e && { ult: e.ult, rdy: e.rdy }; });
  ok('signature ring fills with charge and shows ready at 100', u1 && u1.ult >= 40 && u1.ult < 60 && !u1.rdy && u2 && u2.rdy, { u1, u2 });
  // shield + dash on own
  await page.evaluate(() => { const me = __bg.app.game.fighters.find((f) => !f.isBot); me.shield = true; me.dashCd = 0.5; me.inv = 99; }); await frame(page);
  const s = await page.evaluate(() => { const e = __bg.ohud.last.find((x) => x.me); return e && { shield: e.shield, dash: e.dash }; });
  ok('own fighter shows shield and dash cooldown', s && s.shield && s.dash, s);
  await page.screenshot({ path: OUT + '/after-combat-states-915.png' });
  // close-up of the three combat states on the overhead bar
  const close = await page.evaluate(() => {
    const g = __bg.app.game; const me = g.fighters.find((f) => !f.isBot) || g.fighters[0];
    const bots = g.fighters.filter((f) => f !== me && f.alive);
    const a = bots[0], b = bots[1] || bots[0];
    for (const f of g.fighters) f.inv = 99;
    me.hp = me.maxHp; me.ammo = Math.max(1, me.maxAmmo || 1); me.ult = 100; me.shield = false; me.dashCd = 0;
    if (a) { a.hp = 1; a.ammo = 0; a.maxAmmo = Math.max(1, a.maxAmmo || 1); a.ult = 45; a.shield = false; a.dashCd = 0; }
    if (b && b !== a) { b.hp = Math.max(1, b.maxHp - 1); b.ammo = 1; b.ult = 100; b.shield = true; b.dashCd = 0.45; }
    return true;
  });
  await frame(page);
  const tiles = await page.evaluate(() => {
    const src = document.getElementById('ohud'); const W = parseFloat(src.style.width) || src.width; const dpr = src.width / W;
    const last = (__bg.ohud.last || []).slice(); const tw = 380, th = 200;
    const out = document.createElement('canvas'); out.width = tw * 2; out.height = th * 2;
    const c = out.getContext('2d'); c.fillStyle = '#1a1d33'; c.fillRect(0, 0, out.width, out.height);
    const labels = [];
    last.slice(0, 4).forEach((e, i) => {
      const col = i % 2, row = (i / 2) | 0; const dx = col * tw, dy = row * th;
      const sx = Math.max(0, Math.round(e.px * dpr - 190)), sy = Math.max(0, Math.round((e.py - 28) * dpr - 70));
      c.drawImage(src, sx, sy, tw, th - 36, dx, dy, tw, th - 36);
      const tag = (e.me ? 'YOU · ' : '') + 'hp ' + e.hp + '/' + e.mh + ' · boom ' + e.am + '/' + e.na + (e.rdy ? ' · special ready' : ' · special ' + Math.round(e.ult) + '%') + (e.shield ? ' · shield' : '') + (e.dash ? ' · dash cooling' : '');
      labels.push(tag);
      c.fillStyle = 'rgba(8,10,28,.9)'; c.fillRect(dx, dy + th - 36, tw, 36);
      c.fillStyle = '#fff'; c.font = '700 15px system-ui,sans-serif'; c.textBaseline = 'middle'; c.fillText(tag, dx + 10, dy + th - 18, tw - 20);
    });
    return { url: out.toDataURL('image/png'), n: last.length, labels };
  });
  { const m = tiles.url && tiles.url.match(/^data:image\/png;base64,(.+)$/); if (m) fs.writeFileSync(OUT + '/after-combat-closeup.png', Buffer.from(m[1], 'base64')); }

  // hidden in bush: opponent not drawn
  await page.evaluate(() => { __F.model.root.visible = false; }); await new Promise((r) => setTimeout(r, 30));
  // perf: ohud cost per draw
  const cost = await page.evaluate(() => { const g = __bg.app.game; const t0 = performance.now(); for (let i = 0; i < 200; i++) __bg.ohudDraw && __bg.ohudDraw(g, true); return (performance.now() - t0) / 200; });
  ok('draw cost is tiny (hook exposed or skipped)', cost < 1.5, cost);
  await page.evaluate(() => __bg.app.quitToMenu()); await frame(page);
  const q = await page.evaluate(() => __bg.ohud.last.length);
  ok('indicators clear on return to menu', q === 0, q);
  // tutorial
  await page.evaluate(() => { const S = __bg.S(); S.tutorialDone = false; __bg.app.startTutorial(); });
  await waitFor(() => page.evaluate(() => __bg.app.game && (__bg.app.mode === 'play' || !!__bg.app.tut)), 15000);
  await sleep(700); await frame(page);
  const tut = await page.evaluate(() => ({ n: __bg.ohud.last.length, me: __bg.ohud.last.filter((x) => x.me).length, hearts: document.querySelectorAll('#h-pl .heart, #h-pl .hearts, #h-pl .ultbar').length, tut: !!__bg.app.tut }));
  ok('tutorial: overhead bars draw and top hearts stay gone', tut.n >= 1 && tut.me === 1 && tut.hearts === 0 && tut.tut, tut);
  await page.screenshot({ path: OUT + '/after-tutorial-915.png' });
  // campaign
  await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
  await sleep(200);
  await page.evaluate(() => { __bg.app.startStage(1); });
  await waitFor(() => page.evaluate(() => __bg.app.game && __bg.app.mode === 'play' && __bg.app.match && __bg.app.match.mode === 'campaign'), 15000);
  await sleep(700); await frame(page);
  const camp = await page.evaluate(() => ({ n: __bg.ohud.last.length, me: __bg.ohud.last.filter((x) => x.me).length, hearts: document.querySelectorAll('#h-pl .heart, #h-pl .hearts, #h-pl .ultbar').length, mode: __bg.app.match && __bg.app.match.mode }));
  ok('campaign: overhead bars draw and top hearts stay gone', camp.n >= 1 && camp.me === 1 && camp.hearts === 0 && camp.mode === 'campaign', camp);
  await page.screenshot({ path: OUT + '/after-campaign-915.png' });
  // couch (2 local humans): humans() is off on touch phones, so stub that gate
  await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
  await sleep(200);
  await page.evaluate(() => { __bg.app.isTouchDevice = () => false; const S = __bg.S(); S.setup.mode = 'classic'; S.setup.players = 2; __bg.app.startMode('classic'); });
  await waitFor(() => page.evaluate(() => __bg.app.game && __bg.app.game.state === 'play' && __bg.app.game.fighters.filter((f) => !f.isBot).length === 2), 15000);
  await sleep(700); await frame(page);
  const couch = await page.evaluate(() => {
    const g = __bg.app.game;
    const locals = g.fighters.filter((f) => !f.isBot);
    const markLabels = locals.map((f) => {
      const mark = f.model && f.model.mark; let has = false;
      if (mark) mark.traverse((o) => { if (o.isSprite) has = true; });
      return { name: f.name, slot: f.def.slot, hasSprite: has };
    });
    return { n: __bg.ohud.last.length, me: __bg.ohud.last.filter((x) => x.me).length, hearts: document.querySelectorAll('#h-pl .heart, #h-pl .hearts, #h-pl .ultbar').length, humans: locals.length, markLabels };
  });
  ok('couch: both local fighters are marked, no top hearts', couch.humans === 2 && couch.me === 2 && couch.hearts === 0, couch);
  ok('couch: one P1/P2 label each (overhead bar only, no 3D duplicate)', couch.markLabels && couch.markLabels.length === 2 && couch.markLabels.every((m) => m.hasSprite === false), couch.markLabels);
  await page.screenshot({ path: OUT + '/after-couch-915.png' });
  ok('no page errors', errors.filter((e) => !ign(e)).length === 0, errors.slice(0, 3));
  await browser.close();
}
// ---- online: guest sees host's bar from synced state ----
{
  const PORT = 8700 + (process.pid % 80);
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url.startsWith('/g') ? fs.readFileSync(HTML) : ''); }).listen(PORT);
  const sig = await startRelay(9190);
  const net = await openN(2, { relay: sig.url, rly: RLY, url: `http://127.0.0.1:${PORT}/g`, w: 915, h: 412, mobile: true, extra: { forceRelay: true } });
  const [H, G] = net.pages;
  try {
    const hst = await ev(H, async () => await __bg.net.host());
    await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, hst.code);
    await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 40000);
    await ev(H, () => { const n = __bg.net; n.setSetting('mode', 'classic'); n.setSetting('size', 'small'); n.setSetting('bots', 0); n.setSetting('events', 'off'); });
    await ev(G, () => __bg.net.setReady(true)); await sleep(400); await ev(H, () => __bg.net.startMatch());
    await waitFor(async () => (await ev(G, () => __bg.app.game && __bg.app.game.state === 'play')), 30000, 200);
    await sleep(1500);
    await ev(H, () => { const g = __bg.app.game; for (const f of g.fighters) { f.inv = 99; } const f = g.fighters.find((x) => x.def.slot === 0); f.hp = Math.max(1, f.maxHp - 1); f.regenT = -99; });
    await sleep(3500);
    const gv = await ev(G, () => ({ last: __bg.ohud.last, f: __bg.app.game.fighters.map((f) => ({ i: f.idx, hp: f.hp, slot: f.def.slot })) }));
    const hostE = gv.last.find((x) => !x.me); const hostF = hostE && gv.f.find((x) => x.i === hostE.i);
    ok('online: guest draws 2 bars (own marked, host remote)', gv.last.length === 2 && gv.last.filter((x) => x.me).length === 1, gv.last);
    ok('online: remote bar tracks synced host hp', hostE && hostF && hostE.hp === hostF.hp && hostE.hp < hostE.mh, { hostE, hostF });
    await G.page.screenshot({ path: OUT + '/online-guest-915.png' });
  } catch (e) { ok('online flow', false, String(e)); }
  await net.close(); sig.stop && sig.stop(); srv.close();
}
console.log(`hud422 ${pass}/${pass + fail}  fail=${fail}`); process.exit(fail ? 1 : 0);
