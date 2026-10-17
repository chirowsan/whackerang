// UI flow test with real clicks on a phone-sized viewport (915x412, touch): menu -> Create room -> share link auto-join -> ready -> start -> results -> rematch -> lobby -> leave. Saves screenshots.
import { startTurn, startRelay, openN, ev, sleep, waitFor, HTML } from './netlib.mjs';
const turn = await startTurn(); const relay = await startRelay(+(process.env.PORT || 9180)); const OUT = '/workspace/boomerang-brawl/shots/v40/';
const T = await openN(2, { relay: relay.url, w: 915, h: 412, mobile: true }); const [A, B] = T.pages; const R = []; const ok = (n, v, i) => { R.push({ n, pass: !!v, i }); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
const clickText = (p, t) => ev(p, (t) => { const b = [...document.querySelectorAll('#ui .btn, #ui button')].find((e) => e.innerText && e.innerText.toLowerCase().includes(t.toLowerCase()) && e.offsetParent); if (b) { b.click(); return true; } return false; }, t);
const clickId = (p, id) => ev(p, (id) => { const e = document.getElementById(id); if (e) { e.click(); return true; } return false; }, id);
const has = (p, t) => ev(p, (t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), t);
ok('main menu has Play online', await has(A, 'Play online'));
await clickText(A, 'Play online'); await sleep(500); ok('online menu shows create/join + privacy note', (await has(A, 'Create room')) && (await has(A, 'No chat')) && (await has(A, 'Join')));
await A.page.screenshot({ path: OUT + 'ui-online-menu.png' });
await clickId(A, 'net-create'); await waitFor(() => has(A, 'ROOM CODE'), 15000); await sleep(400);
const code = await ev(A, () => document.getElementById('lobby-code').textContent); ok('lobby shows a 5-letter room code', /^[BCDFGHJKLMNPQRSTVWXZ]{5}$/.test(code), code);
// join screen shot on B: type the code (not yet submitted)
await clickText(B, 'Play online'); await sleep(400); await B.page.type('#net-code', code.toLowerCase()); await sleep(300); ok('join code field normalises to upper-case', (await ev(B, () => document.getElementById('net-code').value)) === code);
await B.page.screenshot({ path: OUT + 'ui-join.png' });
// join through the share link (?room=CODE auto-joins)
await B.page.goto(HTML + '?room=' + code); await waitFor(() => has(B, 'ROOM CODE'), 25000); await sleep(600);
ok('share link ?room=CODE auto-joins the lobby', await has(B, 'ROOM CODE'));
ok('host lobby lists 2 players', (await ev(A, () => document.querySelectorAll('.prow:not(.empty)').length)) === 2);
await ev(A, () => __bg.net.setSetting('rounds', 1)); await sleep(300);
// emotes
await ev(B, () => document.querySelectorAll('.emorow .emo')[3].click()); await sleep(500); { const t1 = await ev(A, () => ({ cur: __bg.ui ? 0 : 0, all: [...document.querySelectorAll('.ebub')].map((x) => x.id + ':' + x.textContent), rows: document.querySelectorAll('.prow').length })); console.log('EMODBG', JSON.stringify(t1)); ok('lobby emote shows on the host screen', (await ev(A, () => document.getElementById('eb1').textContent)) === '🔥'); }
ok('START is locked until guests ready', await ev(A, () => document.getElementById('net-start').classList.contains('locked')));
await clickId(B, 'net-ready'); await sleep(700); ok('START unlocks after ready', !(await ev(A, () => document.getElementById('net-start').classList.contains('locked'))));
await A.page.screenshot({ path: OUT + 'ui-lobby.png' }); await B.page.screenshot({ path: OUT + 'ui-lobby-guest.png' });
// team mode UI
await ev(A, () => __bg.net.setSetting('mode', 'ctf')); await sleep(500); ok('team mode shows team buttons in lobby', (await ev(A, () => document.querySelectorAll('.tmb').length)) === 2); await ev(A, () => __bg.net.setSetting('mode', 'classic')); await sleep(300);
await clickId(B, 'net-ready'); await sleep(300); if (!(await ev(B, () => __bg.net.me().ready))) await clickId(B, 'net-ready'); await sleep(500);
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
await clickId(A, 'net-tolobby'); await sleep(1800); ok('host returns everyone to the lobby', (await has(A, 'ROOM CODE')) && (await has(B, 'ROOM CODE')));
// leave via UI
await clickId(B, 'net-leave'); await sleep(300); await clickId(B, 'net-leave-ok'); await sleep(1200); ok('guest leaves: back to main menu', await has(B, 'Play online')); ok('host sees the guest leave', (await ev(A, () => __bg.net.lobby.players.length)) === 1);
await clickId(A, 'net-leave'); await sleep(300); await clickId(A, 'net-leave-ok'); await sleep(800); ok('host closes room: back to main menu', await has(A, 'Play online'));
ok('single-player still starts after online', await ev(A, () => { try { __bg.app.quickPlay(); return __bg.app.mode === 'play' && !__bg.app.net; } catch (e) { return String(e); } }));
ok('no console errors', T.pages.every((p) => p.errors.filter((e) => !/favicon/.test(e)).length === 0), T.pages.map((p) => p.errors.slice(0, 3)));
console.log(JSON.stringify({ summary: { pass: R.filter((r) => r.pass).length, fail: R.filter((r) => !r.pass).length } }));
await T.close(); relay.stop(); turn.stop();
