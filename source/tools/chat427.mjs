// chat427: friend-room emoji chat. WebKit (iPhone sim) + Chromium (Android sim) join one room on the local free relay and exchange stickers. No free text.
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, startTurn, sleep, waitFor } from './netlib.mjs';
import { wk } from './wklib.mjs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/batch427';
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8560 + (process.pid % 40);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url.startsWith('/g') ? fs.readFileSync(HTML) : ''); }).listen(PORT);
const sig = await startRelay(9210 + (process.pid % 7));
const turn = await startTurn();
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };
const DEV = { webkit: 'iPhone 14 landscape', chromium: { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' } };
const S = []; const names = ['Zippy Fox', 'Mighty Mango'];
try {
  for (const [i, E] of ['chromium', 'webkit'].entries()) {
    const s = await wk(DEV[E], {}, E); s.E = E;
    await s.page.addInitScript((cfg) => {
      window.__bbNet = { relay: cfg.relay, rly: cfg.rly, ice: [{ urls: 'stun:127.0.0.1:3478' }], forceRelay: !!cfg.forceRelay };
      try { localStorage.setItem('whackerang.save.v1', JSON.stringify({ tutorialDone: true, coins: 100, settings: { quality: 'fast', onlineName: cfg.name, noAutoPause: true, touch: 'on', events: 'off', chatMute: false } })); } catch (e) {}
    }, { relay: sig.url, rly: process.env.BB_RLY || 'ws://127.0.0.1:8799', forceRelay: process.env.BB_FORCE_RELAY !== '0', name: names[i] });
    await s.page.goto(`http://127.0.0.1:${PORT}/g`); await sleep(2500); S.push(s);
  }
  const [H, G] = S;
  const ev = (s, fn, a) => s.page.evaluate(fn, a);
  const h = await ev(H, async () => { try { return await __bg.net.host(); } catch (e) { return { err: String(e && e.stack || e) }; } });
  ok('Chromium hosts a friend room', h && h.code, h);
  if (h && h.code) {
    await ev(G, (c) => { window.__je = null; __bg.net.join(c).catch((e) => { window.__je = String(e && e.message || e); }); }, h.code);
    const lob = await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 45000);
    ok('WebKit guest joins the friend room', !!lob, await ev(G, () => ({ phase: __bg.net.phase, je: window.__je, friend: !!(__bg.net.isFriendRoom && __bg.net.isFriendRoom()) })));
    if (lob) {
      await ev(H, () => { if (__bg.UI && __bg.UI.show) __bg.UI.show('netLobby'); });
      await ev(G, () => { if (__bg.UI && __bg.UI.show) __bg.UI.show('netLobby'); });
      await sleep(400);
      const pack = await ev(H, () => ({ n: (__bg.net && window) ? (document.querySelectorAll('#friend-chat-lobby .emo, .emorow .emo').length) : 0, friend: __bg.net.isFriendRoom(), mute: !!document.getElementById('chat-mute'), input: !!document.querySelector('#friend-chat-lobby input, #friend-chat-lobby textarea') }));
      ok('friend lobby has preset stickers, a mute control, and no free-text box', pack.friend && pack.n >= 8 && pack.mute && !pack.input, pack);
      await ev(H, () => __bg.net.lobbyEmoji(0));
      await ev(G, () => __bg.net.lobbyEmoji(6));
      const saw = await waitFor(async () => {
        const a = await ev(H, () => (__bg.net.chatLog || []).map((r) => r.e));
        const b = await ev(G, () => (__bg.net.chatLog || []).map((r) => r.e));
        return a.includes(0) && a.includes(6) && b.includes(0) && b.includes(6) ? { a, b } : null;
      }, 8000);
      ok('both clients exchange stickers (👍 and ❤️) in the log', !!(saw && saw.a.includes(0) && saw.b.includes(6)), saw);
      await ev(G, () => { const S = __bg.S(); S.settings.chatMute = true; });
      await ev(H, () => __bg.net.lobbyEmoji(3));
      await sleep(600);
      const muted = await ev(G, () => {
        const log = document.getElementById('lobby-fclog');
        const txt = (log && log.innerText) || '';
        return { mute: __bg.S().settings.chatMute, hasFire: /🔥/.test(txt), ownHeart: /❤️|❤/.test(txt) };
      });
      ok('mute hides incoming stickers but keeps your own', muted.mute && !muted.hasFire, muted);
      await H.page.screenshot({ path: OUT + '/emoji-chat-chromium-915.png' });
      await G.page.screenshot({ path: OUT + '/emoji-chat-webkit-915.png' });
      ok('wrote emoji chat screenshots', fs.existsSync(OUT + '/emoji-chat-chromium-915.png') && fs.existsSync(OUT + '/emoji-chat-webkit-915.png'));
    }
  }
} finally {
  for (const s of S) try { await s.browser.close(); } catch (e) {}
  srv.close(); sig.stop(); turn && turn.stop();
}
console.log(JSON.stringify({ summary: { pass, fail } }));
process.exit(fail ? 1 : 0);
