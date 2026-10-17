// Online (v4.0) screens: menu, join, lobby, manual code exchange, errors, results, in-match menu, ping chip.
import { UI, h, $ } from './ui.js';
import { S, save } from './save.js';
import { HEROES, MODES, ARENAS, EMOTES } from './data.js';
import { sfx } from './audio.js';
import { Net, ONLINE_COIN_CAP, ONLINE_DAY_CAP } from './net/net.js';
import { packCode, unpackCode, rtcSupported } from './net/rtc.js';
import { normCode, validCode, shareLink, safeName, cleanName, randomPreset, ONLINE_MODES, TEAM_MODES, LOBBY_EMOJI, CODE_LEN } from './net/proto.js';
import { todayMutator } from './mutators.js';
import { portrait } from './portraits.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ARENA_SW = { dojo: 'linear-gradient(135deg,#d7edb0,#a77d52)', rooftop: 'linear-gradient(135deg,#252a5c,#ff2bd6)', jungle: 'linear-gradient(135deg,#8ea46a,#ff7a1a)', ice: 'linear-gradient(135deg,#d6f3ff,#6aa6d6)', random: 'linear-gradient(135deg,#ffd23c,#ff5a8a,#4fd1ff)' };
const PRIVACY = 'Friends only: you share a short room code. No chat, no voice, no strangers. Online play sends only game inputs and game state to the friends in your room (the host\u2019s device runs the match). Nothing is stored on a server.';

export const ERR = {
  'no-signal': ['Can\u2019t reach the room service', 'The free room-code service could not be reached from this network (it may be blocked or offline). You can still play by swapping codes by hand: use \u201CConnect without server\u201D. Or try another network.'],
  'no-room': ['Room not found', 'No open room has that code. Check the 5 letters and ask the host to keep their lobby open, then try again.'],
  nat: ['Couldn\u2019t connect directly', 'Your network and the host\u2019s network could not make a direct link. Strict mobile or school/office networks sometimes block this, and a relay (TURN) isn\u2019t free. Try: switch Wi-Fi \u2194 mobile data, use a phone hotspot, or let another friend host.'],
  'reject:version': ['Different game version', 'Your game and the host\u2019s game are different versions. Reload the page (or update the app) and try again.'],
  'reject:full': ['Room is full', 'This room already has 4 players.'],
  'reject:locked': ['Match in progress', 'A match is already running in that room. Ask the host to open the lobby, then join again.'],
  'bad-code': ['Check the code', 'Room codes have 5 letters (no vowels), like BKTQM.'],
  'no-webrtc': ['Online play isn\u2019t supported here', 'This browser doesn\u2019t support WebRTC. Try Chrome on Android or desktop.'],
  error: ['Something went wrong', 'The connection could not be set up. Please try again.'],
  ended: ['Room closed', ''],
};

let notes = null; // transient messages shown in the lobby

const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { try { const ta = h('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (x) { return false; } } };
const shareRoom = async () => { const url = shareLink(Net.code); try { if (navigator.share) { await navigator.share({ title: 'Whackerang', text: `Join my Whackerang room ${Net.code}`, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } UI.toast((await copyText(url)) ? 'Link copied! Send it to your friends.' : url, 2400); };
const bars = (ms) => { const n = ms <= 0 ? 4 : ms < 60 ? 4 : ms < 110 ? 3 : ms < 190 ? 2 : 1; return `<span class="pbars q${n}" title="${Math.round(ms)} ms"><i></i><i></i><i></i><i></i></span>`; };
const nameRow = (el) => {
  const st = S().settings; if (!st.onlineName) { st.onlineName = randomPreset(); save(); }
  const r = h('div', 'row nm', '<span>Your name</span>'); const w = h('div', 'nmw');
  const inp = h('input', 'nm-in', null, { type: 'text', maxlength: 10, value: st.onlineName, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': 'Your name', id: 'net-name' });
  const commit = () => { const v = safeName(inp.value); st.onlineName = v; inp.value = v; save(); }; inp.addEventListener('change', commit); inp.addEventListener('blur', commit);
  const dice = UI.btn('🎲', 'small sq', () => { st.onlineName = randomPreset(); inp.value = st.onlineName; save(); }); dice.title = 'Random name'; w.appendChild(inp); w.appendChild(dice); r.appendChild(w); return { row: r, commit };
};

// -------- progress / connecting
const startHost = async () => {
  if (!rtcSupported()) return UI.show('netMsg', { err: { code: 'no-webrtc' } });
  UI.show('netConnect', { title: 'Opening your room...' });
  try { await Net.host(); UI.show('netLobby'); } catch (e) { UI.show('netMsg', { err: { code: e.message === 'no-webrtc' ? 'no-webrtc' : 'error' } }); }
};
const startJoin = async (raw) => {
  const code = normCode(raw); if (!validCode(code)) { sfx('deny'); return UI.toast(`Room codes have ${CODE_LEN} letters`, 1800); }
  if (!rtcSupported()) return UI.show('netMsg', { err: { code: 'no-webrtc' } });
  UI.show('netConnect', { title: `Joining room ${code}...` });
  try { await Net.join(code); } catch (e) { UI.show('netMsg', { err: { code: e.message === 'bad-code' ? 'bad-code' : 'error' }, wasJoin: true }); }
};

Object.assign(UI, {
  netMenu(p) {
    const a = this.app; const el = h('div', 'screen page netscr'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Play online')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const pn = h('div', 'panel net-panel scroll'); const nm = nameRow(); pn.appendChild(nm.row);
    const cr = h('div', 'net-actions');
    cr.appendChild(this.btn('<b>Create room</b><small>You host, friends join with a code</small>', 'primary big netbtn', () => { nm.commit(); startHost(); }, { id: 'net-create' }));
    const jr = h('div', 'net-join'); const inp = h('input', 'code-in', null, { type: 'text', maxlength: 9, placeholder: 'ROOM CODE', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', id: 'net-code', 'aria-label': 'Room code', inputmode: 'text' });
    inp.addEventListener('input', () => { const c = normCode(inp.value); inp.value = c; go.classList.toggle('locked', !validCode(c)); }); inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); });
    const go = this.btn('Join ▶', 'primary netgo locked', () => { nm.commit(); startJoin(inp.value); }, { id: 'net-join' });
    jr.appendChild(inp); jr.appendChild(go); cr.appendChild(jr); pn.appendChild(cr);
    const alt = h('div', 'net-alt'); alt.appendChild(this.btn('Connect without server (swap codes)', 'small', () => this.show('netManual', {}), { id: 'net-manual' })); pn.appendChild(alt);
    pn.appendChild(h('div', 'net-priv', '🔒 ' + esc(PRIVACY))); el.appendChild(pn);
    if (p && p.auto) { const c = normCode(p.auto); inp.value = c; setTimeout(() => { if (UI.cur === 'netMenu') startJoin(c); }, 120); }
    return el;
  },
  netConnect(p) {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog net-conn'); d.appendChild(h('h2', '', esc(p.title || 'Connecting...'))); d.appendChild(h('div', 'spin')); d.appendChild(h('div', 'net-st', esc(Net.status || ''), { id: 'net-status' }));
    d.appendChild(this.btn('Cancel', 'back', () => { Net.leave(); this.show('netMenu'); }, { 'data-back': 1 })); el.appendChild(d); return el;
  },
  netMsg(p) {
    const e = p.err || { code: 'error' }; const [t, m] = ERR[e.code] || ERR.error; const el = h('div', 'screen center'); const d = h('div', 'panel dialog net-msg');
    d.appendChild(h('h2', '', esc(e.code === 'ended' ? (e.msg || 'Room closed') : t))); if (e.code !== 'ended' && (m || e.msg)) d.appendChild(h('p', 'net-m', esc(m))); else if (e.code === 'ended') d.appendChild(h('p', 'net-m', 'You\u2019re back at the menu. Your gold and XP are safe.'));
    const b = h('div', 'btns');
    if (e.canRejoin && Net.last) b.appendChild(this.btn('Rejoin room', 'primary', () => startJoin(Net.last)));
    if (e.code === 'no-signal') b.appendChild(this.btn('Connect without server', 'primary', () => this.show('netManual', {})));
    if (p.wasJoin && e.code !== 'bad-code' && e.code !== 'reject:version' && e.code !== 'no-webrtc') b.appendChild(this.btn('Try again', e.code === 'no-signal' ? '' : 'primary', () => (Net.lastCode ? startJoin(Net.lastCode) : this.show('netMenu'))));
    b.appendChild(this.btn('Online menu', '', () => this.show('netMenu'))); b.appendChild(this.btn('Main menu', 'back', () => this.show('menu'), { 'data-back': 1 })); d.appendChild(b); el.appendChild(d); return el;
  },
  // ---- lobby
  netLobby() {
    const a = this.app, s = S(); const isHost = Net.isHost; const L = Net.lobby; const me = Net.me(); const set = L.settings || Net.defaultSettings();
    const key = [s.hero, s.hats[s.hero], s.eq.skin, s.eq.trail, s.settings.onlineName].join('|'); if (Net._pk !== key) { Net._pk = key; if (me) setTimeout(() => Net.active && Net.setMine(), 0); }
    const el = h('div', 'screen page netscr netlobby'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('netLeave'))); hd.appendChild(h('h2', '', 'Lobby')); 
    const cc = h('div', 'codechip'); cc.innerHTML = `<small>ROOM CODE</small><b id="lobby-code">${esc(Net.code)}</b>`; hd.appendChild(cc);
    if (Net.code !== 'MANUAL') { hd.appendChild(this.btn('📤 Share link', 'small gold', () => shareRoom(), { id: 'net-share' })); hd.appendChild(this.btn('Copy code', 'small', async () => { UI.toast((await copyText(Net.code)) ? 'Code copied' : Net.code, 1400); })); }
    else if (isHost) hd.appendChild(h('div', 'chip dimc', 'No room service: add friends by code'));
    el.appendChild(hd);
    const body = h('div', 'netbody'); const left = h('div', 'panel netplayers'); const right = h('div', 'panel netset scroll');
    // players
    const teamy = TEAM_MODES.includes(set.mode); const list = h('div', 'plist');
    for (let sl = 0; sl < 4; sl++) {
      const p = L.players.find((q) => q.slot === sl && q.conn !== false); const row = h('div', 'prow' + (p ? '' : ' empty') + (p && p.slot === Net.mySlot ? ' me' : ''), null, { 'data-slot': sl });
      if (p) {
        const hero = HEROES.find((x) => x.id === p.hero) || HEROES[0]; row.appendChild(h('img', 'pimg', null, { src: portrait(hero, p.hat || 'none'), alt: hero.name }));
        const info = h('div', 'pinfo', `<b>${esc(p.name)}</b><small>${esc(hero.name)}${p.host ? ' · HOST' : ''}</small>`); row.appendChild(info);
        if (teamy) { const tb = h('button', 'tmb t' + p.team, p.team === 0 ? 'CYAN' : 'PINK', { 'data-nav': 1 }); if (p.slot === Net.mySlot) tb.addEventListener('click', () => { sfx('click'); Net.setMine({ team: 1 - p.team }); }); else tb.disabled = true; row.appendChild(tb); }
        const st = h('div', 'pst', ''); st.innerHTML = (p.host ? '<span class="rdy on">★</span>' : `<span class="rdy ${p.ready ? 'on' : ''}">${p.ready ? '✓ READY' : '...'}</span>`) + `<span class="pg" data-ping="${p.slot}">${bars(p.host ? 0 : p.ping)}</span>`; row.appendChild(st);
        if (isHost && !p.host) { const kb = h('button', 'kick', '✕', { title: 'Remove player', 'data-nav': 1 }); kb.addEventListener('click', () => { sfx('click'); const pe = Net.H.slots[p.slot]; Net.kick(pe, 'kicked'); }); row.appendChild(kb); }
        row.appendChild(h('div', 'ebub', '', { id: 'eb' + sl }));
      } else row.appendChild(h('div', 'pinfo', '<b>Open slot</b><small>' + (set.bots ? 'A bot will play here' : 'Waiting for a friend') + '</small>'));
      list.appendChild(row);
    }
    left.appendChild(list);
    const em = h('div', 'emorow'); LOBBY_EMOJI.forEach((e, i) => { const b = h('button', 'emo', e, { 'data-nav': 1, 'aria-label': 'emote ' + (i + 1) }); b.addEventListener('click', () => { Net.lobbyEmoji(i); sfx('click'); }); em.appendChild(b); }); left.appendChild(em);
    if (isHost && Net.code !== 'MANUAL' || isHost) left.appendChild(this.btn('➕ Add friend by code', 'small', () => this.show('netManual', { host: true }), { id: 'net-addman' }));
    const nt = h('div', 'net-notes', '', { id: 'net-notes' }); left.appendChild(nt); if (Net.status) nt.textContent = Net.status;
    // settings
    right.appendChild(h('h4', '', isHost ? 'Match settings' : 'Match settings (host picks)'));
    const segN = (label, k, opts) => { const r = h('div', 'row', `<span>${label}</span>`); const sg = h('div', 'seg'); opts.forEach(([val, t]) => { const b = h('button', set[k] === val ? 'on' : '', t, { 'data-nav': 1 }); if (isHost) b.addEventListener('click', () => { sfx('click'); Net.setSetting(k, val); }); else b.disabled = true; sg.appendChild(b); }); r.appendChild(sg); return r; };
    const mr = h('div', 'row', '<span>Mode</span>'); const ms = h('div', 'modechips'); ONLINE_MODES.forEach((m) => { const M = MODES[m]; const b = h('button', 'mchip' + (set.mode === m ? ' on' : ''), `${M.icon} ${M.name}`, { 'data-nav': 1, 'data-mode': m }); if (isHost) b.addEventListener('click', () => { sfx('click'); Net.setSetting('mode', m); }); else b.disabled = true; ms.appendChild(b); }); mr.appendChild(ms); mr.style.cssText = 'flex-direction:column;align-items:stretch'; right.appendChild(mr);
    right.appendChild(h('div', 'note-line', MODES[set.mode].blurb.replace('You and a bot partner vs two bots.', 'Two teams of two.').replace(' 2v2 with a bot partner.', ' Two teams of two.')));
    right.appendChild(segN('Game speed', 'speed', [['chill', 'Chill'], ['normal', 'Normal'], ['fast', 'Fast']]));
    if (['classic', 'team', 'crumble'].includes(set.mode)) right.appendChild(segN('First to', 'rounds', [[1, '1'], [2, '2'], [3, '3'], [5, '5']]));
    right.appendChild(segN('Empty slots', 'bots', [[true, 'Bots'], [false, 'None']]));
    if (set.bots) right.appendChild(segN('Bot skill', 'diff', [[0, 'Easy'], [1, 'Medium'], [2, 'Hard']]));
    if (!MODES[set.mode].size) right.appendChild(segN('Map size', 'size', [['small', 'Small'], ['large', 'Large']]));
    if (!MODES[set.mode].noTraps) right.appendChild(segN('Traps', 'traps', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]));
    right.appendChild(segN('Arena events', 'events', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]));
    right.appendChild(segN('Daily twist', 'mutator', [['off', 'Off'], ['daily', todayMutator().name]]));
    { const ar = h('div', 'row', '<span>Arena</span>'); const ao = h('div', 'arena-opt'); [{ id: 'random', name: 'Random' }, ...ARENAS].forEach((A) => { const b = h('button', set.arena === A.id ? 'on' : '', `<i style="background:${ARENA_SW[A.id] || ARENA_SW.random}"></i>${A.name.replace(' ', '<br>')}`, { 'data-nav': 1 }); if (isHost) b.addEventListener('click', () => { sfx('click'); Net.setSetting('arena', A.id); }); else b.disabled = true; ao.appendChild(b); }); ar.appendChild(ao); ar.style.cssText = 'flex-direction:column;align-items:stretch'; right.appendChild(ar); }
    right.appendChild(h('div', 'net-priv', '🔒 ' + esc(PRIVACY)));
    body.appendChild(left); body.appendChild(right); el.appendChild(body); setTimeout(() => { for (const k in emoRecent) if (performance.now() - emoRecent[k].t < 1500) flash(+k, emoRecent[k].e); }, 0);
    // footer
    const ft = h('div', 'netfoot'); const hero = this.heroById(s.hero);
    ft.appendChild(this.btn(`Fighter: <b>${esc(hero.name)}</b> · Change`, 'small', () => this.show('heroes', { mode: 'pick', ret: 'netLobby' }), { id: 'net-hero' }));
    if (isHost) { const can = Net.canStart(); const st = this.btn('▶ START', 'primary' + (can ? '' : ' locked'), () => { if (!Net.canStart()) { sfx('deny'); return UI.toast('Waiting for everyone to press Ready', 1800); } Net.startMatch(); }, { id: 'net-start' }); ft.appendChild(st); }
    else { const rd = me && me.ready; ft.appendChild(this.btn(rd ? '✓ Ready (tap to undo)' : 'Ready!', rd ? 'gold' : 'primary', () => Net.setReady(!rd), { id: 'net-ready' })); }
    ft.appendChild(this.btn('Leave', 'hot small', () => this.show('netLeave'), { id: 'net-leave' })); el.appendChild(ft); return el;
  },
  netLeave() {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog'); d.appendChild(h('h2', '', Net.isHost ? 'Close the room?' : 'Leave the room?')); d.appendChild(h('p', 'net-m', Net.isHost ? 'You are the host. Leaving closes the room for everyone.' : 'You can rejoin with the code while the host keeps the room open.'));
    const b = h('div', 'btns'); b.appendChild(this.btn(Net.isHost ? 'Close room' : 'Leave', 'hot', () => { this.app.quitToMenu(); }, { id: 'net-leave-ok' })); b.appendChild(this.btn('Stay', 'primary', () => this.show(Net.active ? (Net.phase === 'results' ? 'netResults' : 'netLobby') : 'menu'), { 'data-back': 1 })); d.appendChild(b); el.appendChild(d); return el;
  },
  netPause() {
    const el = h('div', 'screen center netpause'); const d = h('div', 'panel dialog'); d.appendChild(h('h2', '', 'Online match')); d.appendChild(h('p', 'net-m', 'The match keeps going while this menu is open.'));
    const b = h('div', 'btns', null, { style: 'flex-direction:column;align-items:stretch;width:100%' }); b.appendChild(this.btn('▶ Back to the game', 'primary', () => this.app.resume())); b.appendChild(this.btn('⛶ Fullscreen', '', () => this.app.toggleFullscreen())); b.appendChild(this.btn(Net.isHost ? 'Close room & quit' : 'Leave match', 'hot', () => this.app.quitToMenu(), { id: 'net-pause-leave' })); d.appendChild(b); el.appendChild(d); return el;
  },
  // ---- manual (zero-server) code swap
  netManual(p) {
    const el = h('div', 'screen page netscr netmanual'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show(Net.active && Net.isHost ? 'netLobby' : 'netMenu'))); hd.appendChild(h('h2', '', 'Connect without a server')); el.appendChild(hd);
    const pn = h('div', 'panel net-panel scroll'); const host = !!(p && p.host && Net.isHost);
    const box = (label, ro, id) => { const w = h('div', 'cbox'); w.appendChild(h('label', '', label)); const t = h('textarea', '', null, { rows: 3, id, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', ...(ro ? { readonly: 'readonly' } : { placeholder: 'Paste here' }) }); t.addEventListener('keydown', (e) => e.stopPropagation()); w.appendChild(t); return { w, t }; };
    const stat = h('div', 'net-st', '', { id: 'man-status' }); const setSt = (t) => { stat.textContent = t; };
    if (host) {
      pn.appendChild(h('p', 'net-m', 'Friend: tap \u201CConnect without server\u201D, then \u201CI\u2019m joining\u201D, and send you their code. Paste it here, then send them the reply code.'));
      const inb = box('1. Paste your friend\u2019s code', false, 'man-in'); const outb = box('2. Send this reply code back', true, 'man-out'); const go = this.btn('Make reply code', 'primary', async () => {
        try { setSt('Working...'); const { desc, kind } = await unpackCode(inb.t.value); if (kind !== 'offer') throw new Error('bad-code'); const ans = await Net.hostManualOffer(desc); if (!ans) throw new Error('fail'); outb.t.value = await packCode('answer', ans); outb.t.select(); setSt('Now send the reply code to your friend. They paste it and tap Connect.'); } catch (e) { setSt('That code doesn\u2019t look right. Ask your friend for a fresh one.'); }
      }, { id: 'man-make' });
      pn.appendChild(inb.w); pn.appendChild(go); pn.appendChild(outb.w); pn.appendChild(this.btn('Copy reply code', 'small', async () => UI.toast((await copyText(outb.t.value)) ? 'Copied' : 'Select and copy it', 1400)));
    } else {
      pn.appendChild(h('p', 'net-m', 'No internet room service needed. You and the host swap two codes (by message, or reading them out). Both of you must be online.'));
      const outb = box('1. Send this code to the host', true, 'man-out'); const inb = box('2. Paste the host\u2019s reply code', false, 'man-in');
      const mk = this.btn('I\u2019m joining: make my code', 'primary', async () => { try { setSt('Making code...'); const d = await Net.joinManual(); outb.t.value = await packCode('offer', d); outb.t.select(); setSt('Send the code to the host, then paste their reply below.'); } catch (e) { setSt('Could not create a code on this device.'); } }, { id: 'man-make' });
      const cn = this.btn('Connect', 'primary', async () => { try { const { desc, kind } = await unpackCode(inb.t.value); if (kind !== 'answer') throw new Error('bad'); setSt('Connecting...'); await Net.joinManualAnswer(desc); } catch (e) { setSt('That reply code doesn\u2019t look right.'); } }, { id: 'man-connect' });
      pn.appendChild(mk); pn.appendChild(outb.w); pn.appendChild(this.btn('Copy my code', 'small', async () => UI.toast((await copyText(outb.t.value)) ? 'Copied' : 'Select and copy it', 1400))); pn.appendChild(inb.w); pn.appendChild(cn);
    }
    pn.appendChild(stat); pn.appendChild(h('div', 'net-priv', '🔒 Codes only contain connection details (your network address is visible to the friend you swap with, like any video call).')); el.appendChild(pn); return el;
  },
  // ---- results
  netResults() {
    const R = Net.lastResult; if (!R) return h('div', 'screen center');
    const rw = Net.reward || { won: false, coins: 0, xp: 0, kos: 0 }; const mine = R.players.find((q) => q.slot === Net.mySlot && !q.bot); const won = rw.won; const draw = R.winTeam < 0;
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog results r2 netres' + (won ? ' won' : ' lose'));
    d.appendChild(h('h2', 'rtitle', draw ? 'Draw!' : won ? 'Victory!' : 'Defeat'));
    const tbl = h('div', 'score'); const pl = Net.lobby.players;
    R.players.forEach((q) => { const lp = pl.find((x) => x.slot === q.slot && !q.bot); const hero = HEROES.find((x) => x.id === (lp ? lp.hero : null)); const wt = R.winTeam >= 0 && q.team === R.winTeam; tbl.appendChild(h('div', 'srow' + (wt ? ' win' : ''), `<b>${esc(q.name)}${q.bot ? ' <small>(bot)</small>' : ''}</b><span class="pips">KOs ${q.kos}${R.mode === 'classic' || R.mode === 'team' || R.mode === 'crumble' ? ' · wins ' + q.wins : ''}${R.mode === 'coins' ? ' · coins ' + q.score : ''}</span>`)); });
    d.appendChild(tbl);
    const gr = h('div', 'netrew', `<span class="coin big"></span><b>+${rw.coins}</b> gold <i>·</i> <b>+${rw.xp}</b> XP${rw.capped ? ' <small>(daily online cap reached)</small>' : ''}`); d.appendChild(gr);
    d.appendChild(h('small', 'dimc', `Online gold is capped (${ONLINE_COIN_CAP} per match, ${ONLINE_DAY_CAP} per day) so friends can\u2019t farm it.`));
    const votes = Net.lobby.players.filter((x) => x.rematch).length, tot = Net.lobby.players.filter((x) => x.conn !== false).length; const b = h('div', 'btns rb');
    const iVoted = Net.lobby.players.some((x) => x.slot === Net.mySlot && x.rematch);
    b.appendChild(this.btn(iVoted ? `Waiting... ${votes}/${tot}` : `↻ Rematch ${votes ? votes + '/' + tot : ''}`, iVoted ? 'gold' : 'primary', () => { Net.rematch(); sfx('click'); }, { id: 'net-rematch' }));
    if (Net.isHost) { if (votes > 0) b.appendChild(this.btn('Start now', 'small', () => Net.startNow())); b.appendChild(this.btn('Back to lobby', '', () => Net.toLobby(), { id: 'net-tolobby' })); } else b.appendChild(h('small', 'dimc', 'Host can return everyone to the lobby'));
    b.appendChild(this.btn('Leave', 'hot small', () => this.show('netLeave'), { id: 'net-res-leave' })); d.appendChild(b); el.appendChild(d); return el;
  },
});

// -------- live updates
const emoRecent = {};
const flash = (slot, e) => { emoRecent[slot] = { e, t: performance.now() }; const b = document.getElementById('eb' + slot); if (!b) return; b.textContent = LOBBY_EMOJI[e] || ''; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
Net.onEmote = (slot, e) => { if (UI.cur === 'netLobby') flash(slot, e); };
Net.onStatus = (t) => { const e = document.getElementById('net-status') || document.getElementById('net-notes'); if (e) e.textContent = t || ''; const m = document.getElementById('man-status'); if (m && t) m.textContent = t; };
Net.onNote = (t) => { const e = document.getElementById('net-notes'); if (e) e.textContent = t; };
Net.onUpdate = () => {
  const cur = UI.cur; if (!Net.active) return;
  if (Net.phase === 'lobby' && (cur === 'netConnect' || cur === 'netManual' || (cur === 'netMenu'))) { UI.show('netLobby'); return; }
  if (cur === 'netLobby' && Net.phase === 'lobby') { const sc = document.querySelector('.netset'); const t = sc ? sc.scrollTop : 0; UI.show('netLobby'); const n = document.querySelector('.netset'); if (n) n.scrollTop = t; }
  else if (cur === 'netLobby' && (Net.phase === 'results')) UI.show('netResults');
  else if (cur === 'netResults') UI.show('netResults');
};
// lobby ping chips are refreshed in place (no re-render)
setInterval(() => { if (!Net.active) return; if (UI.cur === 'netLobby') { document.querySelectorAll('[data-ping]').forEach((e) => { const sl = +e.dataset.ping; const p = Net.lobby.players.find((q) => q.slot === sl); const ms = Net.pings && Net.pings[sl] !== undefined ? Net.pings[sl] : (p ? p.ping : 0); e.innerHTML = bars(p && p.host ? 0 : ms); }); } }, 1000);
// in-match ping chip
const origHud = UI.hudUpdate;
UI.hudUpdate = function (game) {
  origHud.call(this, game);
  let c = document.getElementById('netping');
  if (Net.active && game && game.mode !== 'attract') {
    if (!c) { c = h('div', '', '', { id: 'netping' }); const hud = document.getElementById('hud'); hud && hud.appendChild(c); }
    const ms = Net.isGuest ? Net.rtt : Math.max(0, ...Object.values(Net.pings || { 0: 0 }));
    const lab = Net.isGuest ? `${Math.round(Net.rtt)} ms` : (Object.keys(Net.pings || {}).length > 1 ? `${Math.round(ms)} ms (worst)` : 'host');
    const q = ms < 60 ? 4 : ms < 110 ? 3 : ms < 190 ? 2 : 1; const html = `${bars(Net.isHost && !Object.keys(Net.pings || {}).length ? 0 : ms)}<span>${esc(Net.isHost ? 'HOST' : 'PING')} ${lab}</span>`; if (c.dataset.h !== html) { c.dataset.h = html; c.innerHTML = html; }
  } else if (c) c.remove();
};
