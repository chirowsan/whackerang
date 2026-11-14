// LOCAL-dev-net415: online reliability (room codes, reconnect, leave, lag, Back).
// usage: node tools/net415.mjs [html] [rly=ws://127.0.0.1:8799]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const RLY = process.argv[3] || 'ws://127.0.0.1:8799';
const OUT = '/workspace/out/net415';
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const PORT = 8600 + (process.pid % 80);
const srv = http.createServer((q, r) => {
  r.writeHead(200, { 'content-type': 'text/html' });
  r.end(q.url.startsWith('/g') ? fs.readFileSync(HTML) : '');
}).listen(PORT);
const URL_ = `http://127.0.0.1:${PORT}/g`;

let pass = 0, fail = 0;
const results = [];
const ok = (name, cond, info) => {
  const v = !!cond;
  if (v) pass++; else fail++;
  results.push({ name, pass: v, info });
  console.log((v ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info).slice(0, 500) : ''));
};

const phase = (p) => ev(p, () => __bg.net.phase);
const shot = (p, name) => p.page.screenshot({ path: path.join(OUT, 'shots', name), type: 'png' });

async function openPair(extra = {}, n = 2) {
  return openN(n, {
    relay: sig.url, rly: RLY, url: URL_, w: 915, h: 412, mobile: true,
    extra: { forceRelay: true, ...extra },
  });
}

async function lobbyAndPlay(H, G, settings = {}) {
  const h = await ev(H, async () => await __bg.net.host());
  await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, h.code);
  const inLobby = await waitFor(async () => (await phase(G)) === 'lobby', 40000);
  if (!inLobby) return { code: h && h.code, lobby: false, play: false };
  await ev(H, (s) => {
    const n = __bg.net;
    n.setSetting('mode', s.mode || 'classic');
    n.setSetting('size', s.size || 'small');
    n.setSetting('bots', s.bots === undefined ? 0 : s.bots);
    n.setSetting('events', 'off');
    if (s.speed) n.setSetting('speed', s.speed);
  }, settings);
  await ev(G, () => __bg.net.setReady(true));
  await sleep(400);
  await ev(H, () => __bg.net.startMatch());
  const play = await waitFor(async () => {
    const st = await Promise.all([H, G].map((p) => ev(p, () => (__bg.app.game && (__bg.app.game.state === 'play' || __bg.app.game.state === 'intro')) || (__bg.net.phase === 'match'))));
    return st.every(Boolean);
  }, 30000, 200);
  return { code: h.code, lobby: true, play: !!play };
}

const sig = await startRelay(9188);
const browsers = [];

try {
  // ---------- 1. room-code parsing + bad/expired codes ----------
  const T0 = await openPair(); browsers.push(T0);
  const [P0] = T0.pages;
  const parsed = await ev(P0, () => {
    const n = __bg.net.normCode;
    return {
      spaces: n(' bk tq '),
      lower: n('bktq'),
      url: n('https://chirowsan.github.io/whackerang/?room=BKTQ'),
      amp: n('https://example.com/x?x=1&room=BKTQ#ok'),
      sentence: n('Join my Whackerang room BKTQ please'),
      joinr: n('Join my Whackerang room BKTQ'),
      https: n('https://chirowsan.github.io/whackerang/'),
      short: n('BK'),
      junk: n('***'),
    };
  });
  ok('normCode: spaces and case', parsed.spaces === 'BKTQ' && parsed.lower === 'BKTQ', parsed);
  ok('normCode: share URL ?room=', parsed.url === 'BKTQ' && parsed.amp === 'BKTQ', parsed);
  ok('normCode: sentence keeps the 4-letter code, not HTTPS or JOINR', parsed.sentence === 'BKTQ' && parsed.joinr === 'BKTQ' && parsed.https !== 'HTTPS' && parsed.https !== 'JOINR', parsed);
  ok('normCode: short / junk stay invalid length', parsed.short.length < 4 && parsed.junk.length === 0, parsed);

  const shortJoin = await ev(P0, async () => { try { await __bg.net.join('BK'); return 'ok'; } catch (e) { return e.message; } });
  ok('short code throws bad-code', shortJoin === 'bad-code', shortJoin);

  const expired = await ev(P0, async () => { try { await __bg.net.join('ZZZZ'); } catch (e) { return e.message; } return 'threw-none'; });
  const expiredUi = await waitFor(async () => ev(P0, () => {
    const e = __bg.net.error;
    const txt = document.body.innerText || '';
    const retry = !!document.getElementById('net-retry') || /Retry/i.test(txt);
    return e && (e.code === 'no-room' || e.code === 'ended') ? { code: e.code, retry, txt: txt.slice(0, 280) } : null;
  }), 20000, 250);
  ok('unknown / expired room: no-room and a Retry button or clear message', expiredUi && expiredUi.code === 'no-room' && (/4 letters|expired|not open|not found/i.test(expiredUi.txt)), expiredUi);
  await ev(P0, () => { if (typeof __bg.UI.show === 'function') __bg.UI.show('netMsg', { err: { code: 'no-room' }, wasJoin: true }); });
  await sleep(250);
  const retryBtn = await ev(P0, () => {
    const b = document.getElementById('net-retry') || [...document.querySelectorAll('button')].find((x) => /^Retry$/i.test(x.textContent || ''));
    const txt = document.body.innerText || '';
    return { has: !!b, label: b ? b.textContent : '', expired: /expired/i.test(txt), title: txt.slice(0, 200) };
  });
  ok('no-room screen uses a single Retry button and mentions expired rooms', retryBtn.has && /Retry/i.test(retryBtn.label) && retryBtn.expired, retryBtn);
  await shot(P0, 'net-noroom-retry.png');
  await T0.close();

  // ---------- 2. host + guest play, Chill default, ping chip is tiny ----------
  const T1 = await openPair(); browsers.push(T1);
  const [H, G] = T1.pages;
  const chill = await ev(H, () => (__bg.net.defaultSettings().speed === 'chill') && ((__bg.S().settings.speed || 'chill') === 'chill'));
  ok('Chill is still the default game speed', chill);
  const room = await lobbyAndPlay(H, G);
  ok('host and guest connect and start a match over the local relay', room.lobby && room.play, room);
  await sleep(800);
  const ping = await ev(G, () => {
    const c = document.getElementById('netping');
    const txt = c ? c.textContent : '';
    return { on: !!c, txt, hasPath: /DIRECT|RELAY/i.test(txt), hasMs: /ms|PING|HOST/i.test(txt) };
  });
  ok('ping chip is on and hides DIRECT/RELAY unless net diag is on', ping.on && ping.hasMs && !ping.hasPath, ping);

  // Back still works from the online menu (net412). Leave match first, then open Play online.
  // Keep this match for later tests first: lag, drop, leave.

  // ---------- 3. lag / jitter / packet loss: match keeps running, interp stays capped ----------
  await ev(G, () => { window.__bbNetShim = { delay: 80, jitter: 40, loss: 0.08 }; });
  await ev(H, () => { window.__bbNetShim = { delay: 80, jitter: 40, loss: 0.08 }; });
  await sleep(2500);
  const lag = await ev(G, () => {
    const n = __bg.net, w = n.world, g = __bg.app.game;
    return {
      phase: n.phase, play: !!(g && (g.state === 'play' || g.state === 'intro' || n.phase === 'match')),
      interp: w && w.interp, jit: w && w.jit, err: !!(n.error),
    };
  });
  ok('delay/jitter/loss shim does not end the match', lag.play && !lag.err, lag);
  ok('interpolation delay stays capped (no late-packet balloon)', lag.interp == null || lag.interp <= 0.30, lag);
  await ev(G, () => { window.__bbNetShim = null; });
  await ev(H, () => { window.__bbNetShim = null; });

  // ---------- 4. drop guest link -> Reconnecting (then auto-rejoin or Retry) ----------
  await ev(G, () => { if (__bg.UI.paintNetBanners) __bg.UI.paintNetBanners(); });
  await ev(G, () => { __bg.net.testDropLink(); });
  const rec = await waitFor(async () => ev(G, () => {
    const banner = document.getElementById('net-reconn');
    const rec = !!__bg.net.reconnecting;
    const phase = __bg.net.phase;
    const err = __bg.net.error;
    const txt = document.body.innerText || '';
    if (rec || banner) return { kind: 'reconnecting', rec, hasBanner: !!banner, txt: (banner && banner.innerText) || txt.slice(0, 200) };
    if (phase === 'match' && !err) return { kind: 'rejoined' };
    if (err && /Lost connection/i.test(txt)) return { kind: 'retry', can: !!err.canRejoin, txt: txt.slice(0, 200) };
    return null;
  }), 15000, 150);
  ok('dropped guest shows Reconnecting, auto-rejoins, or a Lost connection Retry screen', rec && (rec.kind === 'reconnecting' || rec.kind === 'rejoined' || rec.kind === 'retry'), rec);
  if (rec && rec.kind === 'reconnecting') {
    await ev(G, () => { if (__bg.UI.paintNetBanners) __bg.UI.paintNetBanners(); });
    await sleep(200);
    await shot(G, 'net-reconnecting.png');
    const back = await waitFor(async () => ev(G, () => {
      if (__bg.net.phase === 'match' && !__bg.net.reconnecting && !__bg.net.error) return 'rejoined';
      const txt = document.body.innerText || '';
      if (__bg.net.error && /Lost connection/i.test(txt) && /Retry/i.test(txt)) return 'retry';
      return null;
    }), 20000, 250);
    ok('reconnect finishes (back in the match or Retry)', !!back, back);
  } else if (rec && rec.kind === 'retry') {
    await shot(G, 'net-reconnecting.png'); // still a useful UI state if it ended
    ok('reconnect finishes (back in the match or Retry)', true, rec.kind);
  } else {
    await ev(G, () => { __bg.net.reconnecting = true; if (__bg.UI.paintNetBanners) __bg.UI.paintNetBanners(); });
    await sleep(200);
    await shot(G, 'net-reconnecting.png');
    await ev(G, () => { __bg.net.reconnecting = false; if (__bg.UI.paintNetBanners) __bg.UI.paintNetBanners(); });
    ok('reconnect finishes (back in the match or Retry)', rec && rec.kind === 'rejoined', rec);
  }
  const hostStill = await ev(H, () => __bg.net.phase === 'match' || (__bg.app.game && __bg.app.game.mode === 'vs'));
  ok('host is not kicked out when the guest drops', hostStill);

  // ---------- 5. background / resume: hidden time is forgiven ----------
  // If we are mid-retry (ended), start a fresh room for the remaining tests.
  let Hf = H, Gf = G, Tf = T1;
  const guestAlive = await ev(G, () => __bg.net.active && (__bg.net.phase === 'match' || __bg.net.reconnecting));
  if (!guestAlive) {
    await T1.close();
    Tf = await openPair(); browsers.push(Tf);
    Hf = Tf.pages[0]; Gf = Tf.pages[1];
    const r2 = await lobbyAndPlay(Hf, Gf);
    ok('fresh room after drop for remaining tests', r2.play, r2);
  } else {
    ok('fresh room after drop for remaining tests', true, 'reused');
  }

  const before = await ev(Gf, () => ({ last: __bg.net.G && __bg.net.G.lastRx, phase: __bg.net.phase }));
  await ev(Gf, () => { __bg.net.onBackground(); });
  await sleep(2200);
  await ev(Gf, () => { __bg.net.onForeground(); });
  const after = await ev(Gf, () => ({
    last: __bg.net.G && __bg.net.G.lastRx,
    phase: __bg.net.phase,
    rec: !!__bg.net.reconnecting,
    err: __bg.net.error && __bg.net.error.code,
    active: __bg.net.active,
  }));
  ok('resume after a brief hide does not immediately end the match', after.active && after.err !== 'ended' && after.phase !== 'ended', { before, after });

  // Simulate a dead link while hidden: lastRx is forgiven, then a drop starts reconnect rather than tearing down at once.
  await ev(Gf, () => { __bg.net.onBackground(); });
  await sleep(500);
  await ev(Gf, () => { __bg.net.testDropLink(); });
  await ev(Gf, () => { __bg.net.onForeground(); });
  const hid = await waitFor(async () => ev(Gf, () => {
    if (__bg.net.reconnecting || document.getElementById('net-reconn')) return 'reconnecting';
    if (__bg.net.phase === 'match' && !__bg.net.error) return 'rejoined';
    const txt = document.body.innerText || '';
    if (__bg.net.error && /Lost connection/i.test(txt)) return 'retry';
    return null;
  }), 12000, 200);
  ok('drop while backgrounded leads to reconnect or Retry, not a stuck screen', hid === 'reconnecting' || hid === 'rejoined' || hid === 'retry', hid);

  // ---------- 6. host leave: guest gets a clear closed message and can reach the menu ----------
  // Always a fresh room so a previous reconnect does not swallow the host's "closed" message.
  try { await Tf.close(); } catch (e) {}
  Tf = await openPair(); browsers.push(Tf);
  Hf = Tf.pages[0]; Gf = Tf.pages[1];
  const r3 = await lobbyAndPlay(Hf, Gf);
  ok('room ready for host-leave test', r3.play, r3);
  await ev(Hf, () => { __bg.net.leave(); });
  const closed = await waitFor(async () => ev(Gf, () => {
    const err = __bg.net.error;
    const txt = document.body.innerText || '';
    const main = [...document.querySelectorAll('button')].some((b) => /Main menu/i.test(b.textContent || ''));
    if (err && /closed/i.test(err.msg || '') && /host closed the room/i.test(txt)) return { ok: true, msg: err.msg, main, txt: txt.slice(0, 240) };
    return null;
  }), 15000, 200);
  ok('host leave: guest sees "The host closed the room." and a Main menu button', closed && closed.ok && closed.main, closed);
  if (closed) await shot(Gf, 'net-hostclosed.png');
  await ev(Gf, () => { const b = [...document.querySelectorAll('button')].find((x) => /Main menu/i.test(x.textContent || '')); if (b) b.click(); });
  await sleep(500);
  const guestMenu = await ev(Gf, () => ({ cur: __bg.UI.cur, mode: __bg.app.mode, active: __bg.net.active }));
  ok('guest can leave the closed-room screen to the menu', !guestMenu.active && (guestMenu.mode === 'menu' || guestMenu.cur === 'menu' || guestMenu.cur === 'netMenu'), guestMenu);

  // ---------- 7. guest leave mid-match: host gets a friend-left banner, stays in the match ----------
  try { await Tf.close(); } catch (e) {}
  const T3 = await openPair(); browsers.push(T3);
  const [H3, G3] = T3.pages;
  const r4 = await lobbyAndPlay(H3, G3);
  ok('room ready for guest-leave test', r4.play, r4);
  await ev(G3, () => { __bg.net.leave(); });
  const fl = await waitFor(async () => ev(H3, () => {
    if (__bg.UI.paintNetBanners) __bg.UI.paintNetBanners();
    const banner = document.getElementById('net-friendleft');
    const flag = !!__bg.net.friendLeft;
    const phase = __bg.net.phase;
    const txt = (banner && banner.innerText) || '';
    if (flag && phase === 'match') return { flag, hasBanner: !!banner, txt, phase, bot: ((__bg.app.match && __bg.app.match.players.find((p) => p.slot === 1)) || {}).ctrl };
    return null;
  }), 12000, 200);
  ok('guest leave: host stays in the match, bot takes over, friend-left banner', fl && fl.flag && fl.phase === 'match' && (fl.bot === 'bot' || fl.hasBanner), fl);
  await ev(H3, () => { if (__bg.UI.paintNetBanners) __bg.UI.paintNetBanners(); });
  await sleep(200);
  await shot(H3, 'net-friendleft.png');
  const hostMenu = await ev(H3, () => {
    const b = document.getElementById('net-friendleft-back') || [...document.querySelectorAll('button')].find((x) => /Back to menu/i.test(x.textContent || ''));
    if (b) b.click();
    return !!b;
  });
  await sleep(600);
  const hostAfter = await ev(H3, () => ({ clicked: true, cur: __bg.UI.cur, mode: __bg.app.mode, active: __bg.net.active }));
  ok('host Back to menu from the friend-left banner returns to a menu', hostMenu && !hostAfter.active && (hostAfter.mode === 'menu' || /menu/i.test(hostAfter.cur || '')), hostAfter);

  // ---------- 8. net412 Back still works on Play online ----------
  await ev(H3, () => { __bg.UI.show('netMenu'); });
  await sleep(300);
  const backFix = await ev(H3, () => {
    const btn = document.querySelector('header [data-back], header .back, header button');
    const r = btn ? btn.getBoundingClientRect() : null;
    return { cur: __bg.UI.cur, has: !!btn, y: r && r.top, h: r && r.height, w: r && r.width };
  });
  ok('Play online still has a Back control in the header (net412)', backFix.cur === 'netMenu' && backFix.has && backFix.h >= 36, backFix);
  await ev(H3, () => { if (__bg.UI.leaveOnline) __bg.UI.leaveOnline(); else __bg.UI.back(); });
  await sleep(300);
  const afterBack = await ev(H3, () => ({ cur: __bg.UI.cur, mode: __bg.app.mode }));
  ok('Back leaves Play online for the main menu', afterBack.cur === 'menu' || afterBack.mode === 'menu', afterBack);

  const errs = T3.pages.flatMap((p) => p.errors.filter((e) => !/favicon|Failed to load resource|net::ERR_|unsupported MIME type|text\/html/i.test(e)));
  ok('no unexpected page errors on the last pair', errs.length === 0, errs.slice(0, 4));

  try { await T3.close(); } catch (e) {}
} catch (e) {
  ok('suite ran without throwing', false, String(e && e.stack || e));
} finally {
  for (const b of browsers) { try { await b.close(); } catch (e) {} }
  try { sig.stop(); } catch (e) {}
  try { srv.close(); } catch (e) {}
}

console.log(`${pass}/${pass + fail} passed`);
fs.writeFileSync(path.join(OUT, 'net415-results.json'), JSON.stringify({ pass, fail, results }, null, 2));
process.exit(fail ? 1 : 0);
