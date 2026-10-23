// UI flow test with real clicks on a phone-sized viewport (915x412, touch): menu -> Create room -> share link auto-join -> ready -> start -> results -> rematch -> lobby -> leave. Saves screenshots.
import { startTurn, startRelay, openN, ev, sleep, waitFor, HTML } from './netlib.mjs';
const turn = await startTurn(); const relay = await startRelay(+(process.env.PORT || 9180)); const OUT = '/workspace/boomerang-brawl/shots/v41/';
const T = await openN(2, { relay: relay.url, w: 915, h: 412, mobile: true }); const [A, B] = T.pages; const R = []; const ok = (n, v, i) => { R.push({ n, pass: !!v, i }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
const clickText = (p, t) => ev(p, (t) => { const b = [...document.querySelectorAll('#ui .btn, #ui button')].find((e) => e.innerText && e.innerText.toLowerCase().includes(t.toLowerCase()) && e.offsetParent); if (b) { b.click(); return true; } return false; }, t);
const clickId = (p, id) => ev(p, (id) => { const e = document.getElementById(id); if (e) { e.click(); return true; } return false; }, id);
const has = (p, t) => ev(p, (t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), t);
ok('main menu has Play online', await has(A, 'Play online'));
await clickText(A, 'Play online'); await sleep(500);
ok('online screen: Create room + Join room buttons and the v4.6 Auto match button, no inputs', (await ev(A, () => [...document.querySelectorAll('#ui .nm2-btn')].map((b) => b.innerText.replace(/\W+/g, ' ').trim().toLowerCase()).join('|'))).includes('create room') && (await ev(A, () => document.querySelectorAll('#ui .nm2-btn').length)) === 3 && !!(await ev(A, () => document.getElementById('net-auto'))) && (await ev(A, () => document.querySelectorAll('#ui input, #ui textarea').length)) === 0);
await A.page.screenshot({ path: OUT + 'ui-online-menu.png' });
await clickId(A, 'net-create'); await waitFor(() => has(A, 'FRIENDS TYPE THIS CODE'), 15000); await sleep(500);
const code = await ev(A, () => document.getElementById('lobby-code').textContent); ok('Create room goes straight to a lobby with a 4-letter code', /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(code), code);
ok('lobby has Share and Start, no advanced options visible', (await ev(A, () => !!document.getElementById('net-share') && !!document.getElementById('net-start'))) && !(await ev(A, () => { const e = document.querySelector('.nl2-ov'); return !!e && e.offsetParent !== null; })) && !(await has(A, 'Arena events')) || !(await ev(A, () => { const e = document.querySelector('.nl2-ov'); return e && getComputedStyle(e).display !== 'none'; })));
ok('defaults: Classic, Chill, Medium bots, bots fill', await ev(A, () => { const s = __bg.net.lobby.settings; return s.mode === 'classic' && s.speed === 'chill' && s.diff === 1 && s.bots === true; }));
ok('Start is enabled for a lone host (bots fill)', !(await ev(A, () => document.getElementById('net-start').classList.contains('locked'))));
const codeBox = await ev(A, () => { const r = document.getElementById('lobby-code').getBoundingClientRect(); return { h: r.height, w: r.width }; }); ok('code is huge (>= 50px tall letters)', codeBox.h >= 50, codeBox);
// guest: Join room screen with 4 boxes, keyboard focus, auto-join on the 4th letter
await clickText(B, 'Play online'); await sleep(400); await clickId(B, 'net-joinroom'); await sleep(700);
ok('join screen shows 4 boxes and the keyboard field is focused', (await ev(B, () => document.querySelectorAll('.nj2-box').length)) === 4 && (await ev(B, () => document.activeElement && document.activeElement.id === 'net-code')));
await B.page.keyboard.type('qx'); await sleep(200); await B.page.screenshot({ path: OUT + 'ui-join-typing.png' });
await B.page.keyboard.press('Backspace'); await B.page.keyboard.press('Backspace'); await sleep(100);
// wrong code first: clear error, stays on the join screen
const wrong = code === 'BBBB' ? 'CCCC' : 'BBBB'; await B.page.keyboard.type(wrong); await waitFor(() => has(B, 'Room not found'), 15000); await sleep(400);
ok('wrong code: clear "Room not found" error on the join screen', (await has(B, 'Room not found')) && (await ev(B, () => document.querySelectorAll('.nj2-box').length)) === 4); await B.page.screenshot({ path: OUT + 'ui-join-error.png' });
await ev(B, () => document.getElementById('net-code').focus()); await B.page.keyboard.type(code.toLowerCase()); await waitFor(() => has(B, 'Waiting for the host'), 25000); await sleep(600);
ok('4th letter auto-joins (no Join press), guest is in the lobby', await has(B, 'Waiting for the host'));
await B.page.screenshot({ path: OUT + 'ui-lobby-guest.png' }); await A.page.screenshot({ path: OUT + 'ui-lobby.png' });
ok('host lobby lists 2 players', (await ev(A, () => document.querySelectorAll('.prow:not(.empty)').length)) === 2);
ok('guest is auto-ready: host START not locked, no Ready button', !(await ev(A, () => document.getElementById('net-start').classList.contains('locked'))) && !(await ev(B, () => !!document.getElementById('net-ready'))));
ok('guest got a different fighter than the host', await ev(A, () => { const p = __bg.net.lobby.players; return p.length === 2 && p[0].hero !== p[1].hero; }));
await ev(A, () => __bg.net.setSetting('rounds', 1)); await sleep(300);
// options + emotes live behind the Options button
await clickId(B, 'net-options'); await sleep(400); ok('Options overlay opens with emotes + fighter', (await ev(B, () => document.querySelectorAll('.nl2-ov .emorow .emo').length)) === 6 && (await ev(B, () => !!document.getElementById('net-hero'))));
await ev(B, () => document.querySelectorAll('.emorow .emo')[3].click()); await sleep(500); { const t1 = await ev(A, () => [...document.querySelectorAll('.ebub')].map((x) => x.id + ':' + x.textContent)); console.log('EMODBG ' + JSON.stringify(t1)); ok('lobby emote shows on the host screen', t1.some((x) => /^eb1:.+/.test(x)), t1); }
await clickId(B, 'net-options-done'); await sleep(300);
await clickId(A, 'net-options'); await sleep(400); ok('host Options has mode/arena/speed', (await has(A, 'Game speed')) && (await has(A, 'Arena')) && (await has(A, 'Crumbling')));
await A.page.screenshot({ path: OUT + 'ui-options.png' });
await ev(A, () => __bg.net.setSetting('mode', 'ctf')); await sleep(500); ok('team mode shows team colours in the lobby', (await ev(A, () => document.body.innerText.includes('CYAN')))); await ev(A, () => __bg.net.setSetting('mode', 'classic')); await sleep(300);
await clickId(A, 'net-options-done'); await sleep(300);
await clickId(A, 'net-start'); await sleep(6000);
ok('both clients are in the match', (await ev(A, () => __bg.app.mode)) === 'play' && (await ev(B, () => __bg.app.mode)) === 'play');
ok('touch controls active on the phone viewport', await ev(B, () => !document.getElementById('touch').classList.contains('off')));
ok('ping chip visible in match', await has(B, 'PING'));
await A.page.screenshot({ path: OUT + 'ui-match-host.png' }); await B.page.screenshot({ path: OUT + 'ui-match-guest.png' });
// pause menu (match keeps running)
await ev(B, () => __bg.app.pause()); await sleep(300); ok('in-match menu: no pause online, offers leave', (await has(B, 'keeps going')) && !(await ev(B, () => __bg.app.paused))); await ev(B, () => __bg.app.pause()); await sleep(200);
// end the match: remove every rival of the host
await ev(A, () => { const g = __bg.app.game; g.fighters.forEach((f) => { if (f.def.slot !== 0) f.alive = false; }); }); await waitFor(() => has(B, 'Rematch'), 25000); await sleep(1200);
ok('results screen on both with rewards', (await has(A, 'gold')) && (await has(B, 'XP')) && (await has(B, 'capped')));
const hostWon = await ev(A, () => __bg.net.reward && __bg.net.reward.won), guestWon = await ev(B, () => __bg.net.reward && __bg.net.reward.won); ok('host won, guest lost (host-validated result)', hostWon === true && guestWon === false, { hostWon, guestWon });
const rw = await ev(A, () => __bg.net.reward); ok('online gold capped per match', rw.coins <= 60 && rw.xp <= 100, rw);
await A.page.screenshot({ path: OUT + 'ui-results.png' });
// rematch: both vote
await clickId(A, 'net-rematch'); await sleep(500); await clickId(B, 'net-rematch'); await waitFor(async () => (await ev(B, () => __bg.app.mode)) === 'play', 20000); await sleep(2500);
ok('rematch starts a new match when everybody votes', (await ev(A, () => __bg.app.mode)) === 'play' && (await ev(B, () => __bg.app.mode)) === 'play' && (await ev(B, () => __bg.net.phase)) === 'match');
await ev(A, () => { const g = __bg.app.game; g.fighters.forEach((f) => { if (f.def.slot !== 0) f.alive = false; }); }); await waitFor(() => has(A, 'Back to lobby'), 25000); await sleep(800);
await clickId(A, 'net-tolobby'); await sleep(1800); ok('host returns everyone to the lobby', (await has(A, 'FRIENDS TYPE THIS CODE')) && (await has(B, 'Waiting for the host')));
// leave via UI
await clickId(B, 'net-leave'); await sleep(300); await clickId(B, 'net-leave-ok'); await sleep(1200); ok('guest leaves: back to main menu', await has(B, 'Play online')); ok('host sees the guest leave', (await ev(A, () => __bg.net.lobby.players.length)) === 1);
await B.page.goto(HTML + '?room=' + code); await waitFor(() => has(B, 'Waiting for the host'), 25000); await sleep(500);
ok('share link ?room=CODE still auto-joins the lobby', (await has(B, 'Waiting for the host')) && (await ev(A, () => __bg.net.lobby.players.length)) === 2);
await clickId(A, 'net-leave'); await sleep(300); await clickId(A, 'net-leave-ok'); await sleep(800); ok('host closes room: back to main menu', await has(A, 'Play online'));
ok('single-player still starts after online', await ev(A, () => { try { __bg.app.quickPlay(); return __bg.app.mode === 'play' && !__bg.app.net; } catch (e) { return String(e); } }));
ok('no console errors', T.pages.every((p) => p.errors.filter((e) => !/favicon/.test(e)).length === 0), T.pages.map((p) => p.errors.slice(0, 3)));
console.log(JSON.stringify({ summary: { pass: R.filter((r) => r.pass).length, fail: R.filter((r) => !r.pass).length } }));
await T.close(); relay.stop(); turn.stop();
