// v2.0 screens: menu, mode select, setup, campaign, shop, profile, results, HUD, tutorial, emotes.
import { UI, h, $ } from './ui.js';
import { S, save, resetSave } from './save.js';
import { HEROES, HATS, ARENAS, POWERUPS, PLAYER_COLORS, BOOM_TYPES, TRAILS, SKINS, EMOTES, ULTS, MODES, ACHIEVEMENTS, PERSONA_INFO } from './data.js';
import { EARN, earnToday, streakInfo, claimStreak, bonusLeft, claimBonus, gatePassed, gateQuestion, gatePass } from './economy.js';
import { PACKS, STARTER, FIRST_BUY_BONUS, isFirstPurchase, packTotal, fmtPrice, getProvider, TEST_MODE } from './purchase.js';
import { todayMutator, MUTATORS } from './mutators.js';
import { TRAP_INFO, legendImages } from './traps.js';
import { STAGES, MAX_STARS, starHint, stageBlurb } from './modes.js';
import { levelInfo, xpNeed, ensureDaily, dailyProgress, claimDaily, SHOP, owns, buy, equip, toggleEmote, LEVEL_REWARDS, chestState, claimChest, CHEST_GOLD, dailyReadyCount } from './progress.js';
import { sfx, applyVolumes } from './audio.js';
import { setQuality, gfx, toScreen, fitCamera } from './gfx.js';
import { AW, AH, HX, HZ } from './util.js';
import { portrait } from './portraits.js';
import { canInstall, promptInstall, IS_APP, IS_IOS } from './pwa.js';
import { Input } from './input.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const ARENA_SW = { dojo: 'linear-gradient(135deg,#d7edb0,#a77d52)', rooftop: 'linear-gradient(135deg,#252a5c,#ff2bd6)', jungle: 'linear-gradient(135deg,#8ea46a,#ff7a1a)', ice: 'linear-gradient(135deg,#d6f3ff,#6aa6d6)', volcano: 'linear-gradient(135deg,#57444a,#ff7a1a)', pirate: 'linear-gradient(135deg,#c29560,#2fb4e8)', space: 'linear-gradient(135deg,#44507a,#36e0ff)', haunted: 'linear-gradient(135deg,#66567a,#8a6aff)', random: 'linear-gradient(135deg,#ffd23c,#ff5a8a,#4fd1ff)' };
const crown = (cls = '') => `<svg class="crown ${cls}" viewBox="0 0 24 24"><path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11z" fill="#ffd23c" stroke="#8a5200" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const heart = (on) => `<svg class="heart ${on ? '' : 'off'}" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.800-8 11-8 11z" fill="#ff4a7a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const boomSvg = (c) => `<svg viewBox="0 0 48 48" class="bsv"><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#1a0a2a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const star = (on) => `<i class="star${on ? ' on' : ''}"></i>`;
const stars = (n, big) => `<span class="stars${big ? ' big' : ''}">${[0, 1, 2].map((i) => star(i < n)).join('')}</span>`;
const lvlChip = () => { const l = levelInfo(); return `<div class="lvchip"><b>LV ${l.level}</b><span class="xpbar"><i style="width:${Math.round(l.cur / l.need * 100)}%"></i></span></div>`; };
const fx_levelFlash = () => { const f = document.getElementById('flash'); if (f) { f.style.transition = 'none'; f.style.background = '#ffe680'; f.style.opacity = 0.3; void f.offsetWidth; f.style.transition = 'opacity 500ms ease-out'; f.style.opacity = 0; } };
const campStars = () => (S().camp.stars || []).reduce((a, b) => a + (b || 0), 0);

Object.assign(UI, {
  notify(msg, kind) { this._nq = this._nq || []; this._nq.push({ msg, kind }); if (!this._nr) this._nextNote(); },
  _nextNote() { const n = (this._nq || []).shift(); if (!n) { this._nr = false; return; } this._nr = true; let r = $('#notes'); if (!r) { r = h('div', '', null, { id: 'notes' }); document.body.appendChild(r); } const e = h('div', 'note ' + (n.kind || ''), n.msg); r.appendChild(e); sfx(n.kind === 'level' ? 'levelup' : 'ach'); setTimeout(() => e.classList.add('out'), 2600); setTimeout(() => { e.remove(); this._nextNote(); }, 3000); },
  heroLine(hh) { return `<div class="perk">★ ${hh.perk}</div><div class="perk ult">⚡ <b>${ULTS[hh.id].name}</b> — ${ULTS[hh.id].desc}</div>`; },
  coinChip() { const c = h('button', 'chip goldchip', `<span class="coin"></span><span id="coinval">${S().coins}</span><span class="plus">+</span>`, { 'data-nav': 1, title: 'Gold Store' }); c.addEventListener('click', () => { sfx('click'); this.show('goldstore', { tab: 'earn' }); }); return c; },
  // ================= Gold Store =================
  goldstore(p) {
    const s = S(); const tab = p.tab || 'earn'; const el = h('div', 'screen page gold-store'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show(p.ret || 'menu'))); hd.appendChild(h('h2', '', 'Gold Store')); hd.appendChild(h('div', 'chip', `<span class="coin"></span><span id="coinval">${s.coins}</span>`)); el.appendChild(hd);
    const tabs = h('div', 'tabs'); [['earn', 'Earn free'], ['buy', 'Buy gold']].forEach(([id, t]) => { const b = h('button', 'tab' + (id === tab ? ' on' : ''), t, { 'data-nav': 1 }); b.addEventListener('click', () => { sfx('click'); this.show('goldstore', { tab: id, ret: p.ret }); }); tabs.appendChild(b); }); el.appendChild(tabs);
    const body = h('div', 'gs-body scroll'); const again = () => this.show('goldstore', { tab, ret: p.ret });
    if (tab === 'earn') {
      const e = earnToday(); const st = streakInfo(); const d = ensureDaily();
      body.appendChild(h('div', 'gs-note', `Everything in Whackerang can be earned by playing. <b>Earned today: ${e.total} gold</b>`));
      // login streak
      const sc = h('div', 'gs-card', `<h4>Daily login streak</h4><div class="streak">${st.ladder.map((g, i) => `<span class="${i < st.n ? 'done' : ''}${i === st.next - 1 && !st.claimedToday ? ' now' : ''}"><b>Day ${i + 1}</b>${g}</span>`).join('')}</div>`);
      sc.appendChild(st.claimedToday ? h('div', 'owned', '✓ Claimed today — come back tomorrow!') : this.btn(`Claim +${st.reward} gold`, 'gold small', () => { if (claimStreak()) { sfx('buy'); again(); } })); body.appendChild(sc);
      // daily challenges
      const dc = h('div', 'gs-card', '<h4>Today\u2019s challenges</h4>'); d.list.forEach((c, i) => { const pr = dailyProgress(c); const done = pr >= c.n, claimed = d.claimed[c.id]; const row = h('div', 'daily' + (done ? ' done' : ''), `<div><b>${c.text}</b><span class="xpbar"><i style="width:${Math.round(pr / c.n * 100)}%"></i></span><small>${pr}/${c.n} · +${c.coins} gold</small></div>`); row.appendChild(claimed ? h('span', 'owned', '✓') : this.btn('Claim', 'small ' + (done ? 'gold' : 'locked'), () => { if (claimDaily(i)) { sfx('buy'); again(); } })); dc.appendChild(row); }); body.appendChild(dc);
      // bonus placeholder
      const bn = h('div', 'gs-card', `<h4>Bonus gold <span class="tag">placeholder</span></h4><small>A rewarded-bonus slot. No ad is shown in this version. ${bonusLeft()} of ${EARN.bonusPerDay} left today.</small>`); bn.appendChild(this.btn(bonusLeft() ? `Collect +${EARN.bonus} gold` : 'Come back tomorrow', 'small ' + (bonusLeft() ? 'gold' : 'locked'), () => { if (claimBonus()) { sfx('buy'); again(); } })); body.appendChild(bn);
      // play to earn
      body.appendChild(h('div', 'gs-card', `<h4>Earn by playing</h4><ul class="earnlist"><li><b>+${EARN.win}</b> win a match <i>(+${EARN.play} just for playing)</i></li><li><b>+${EARN.ko}</b> every KO</li><li><b>+${EARN.catchStar}</b> per campaign star, <b>+${EARN.firstClear}</b> first clear</li><li><b>+${EARN.bossRushBoss}</b> per Boss Rush boss, <b>+${EARN.bossRushClear}</b> for clearing it</li><li><b>+50…200</b> achievements · <b>+${EARN.level(5)}…</b> every level up</li></ul>`));
      const near = ACHIEVEMENTS.filter((a) => !s.ach[a.id]).map((a) => ({ a, f: Math.min(1, (s.stats[a.stat] || 0) / a.n) })).sort((x, y) => y.f - x.f).slice(0, 3);
      if (near.length) body.appendChild(h('div', 'gs-card', `<h4>Almost there</h4>${near.map(({ a, f }) => `<div class="daily"><div><b>${a.name}</b> <small>${a.desc} · +${a.coins} gold</small><span class="xpbar"><i style="width:${Math.round(f * 100)}%"></i></span></div></div>`).join('')}`));
    } else if (!gatePassed()) {
      const q = gateQuestion(); const g = h('div', 'gs-card gate', `<h4>🔒 Grown-ups only</h4><p>Buying gold needs a parent or guardian. ${q.text}</p>`); const row = h('div', 'gate-opts');
      q.opts.forEach((o) => { const b = this.btn(String(o), 'small', () => { if (o === q.ans) { gatePass(); sfx('buy'); again(); } else { sfx('deny'); this.toast('Not quite. Ask a grown-up to help.'); this.show('goldstore', { tab, ret: p.ret }); } }); row.appendChild(b); }); g.appendChild(row);
      g.appendChild(h('small', '', 'You can keep earning gold for free in the Earn free tab — nothing in the game needs a purchase.')); body.appendChild(g);
    } else {
      const prov = getProvider(); const first = isFirstPurchase();
      if (TEST_MODE) body.appendChild(h('div', 'gs-test', '<b>TEST MODE</b> — no real money is charged. These are fake purchases that just add gold so we can test the store.'));
      if (first) body.appendChild(h('div', 'gs-note', `First purchase bonus: <b>+${Math.round(FIRST_BUY_BONUS * 100)}% extra gold</b> on your first pack (one time).`));
      const grid = h('div', 'pack-grid'); const buyPack = async (pack) => { try { const r = await prov.purchase(pack); sfx('buy'); this.toast(`+${r.gold} gold added${TEST_MODE ? ' (TEST)' : ''}`); again(); } catch (err) { sfx('deny'); this.toast(String(err.message || err)); } };
      if (!s.starterBought) { const c = h('div', 'pack starter', `<div class="pi">${STARTER.icon}</div><h4>${STARTER.name}</h4><b class="pg">${packTotal(STARTER, first)} gold</b><small>+ Cosmic trail + Aurora skin</small><em>one-time offer</em>`); c.appendChild(this.btn(`${fmtPrice(STARTER)}${TEST_MODE ? ' · TEST' : ''}`, 'small primary', () => buyPack(STARTER))); grid.appendChild(c); }
      PACKS.forEach((pk) => { const c = h('div', 'pack', `<div class="pi">${pk.icon}</div><h4>${pk.name}</h4><b class="pg">${packTotal(pk, first)} gold</b>${pk.bonus ? `<span class="bonus">+${pk.bonus}% bonus</span>` : '<span class="bonus none"></span>'}${first ? `<small>incl. first-buy bonus</small>` : ''}`); c.appendChild(this.btn(`${fmtPrice(pk)}${TEST_MODE ? ' · TEST' : ''}`, 'small primary', () => buyPack(pk))); grid.appendChild(c); });
      body.appendChild(grid); body.appendChild(h('div', 'gs-note', 'Gold only buys cosmetics and shortcuts (skins, trails, hats, emotes, fighters). Power is never for sale: every boomerang type is unlocked by levelling up.'));
    }
    el.appendChild(body); return el;
  },
  seg(label, obj, key, opts, onChange) { const r = h('div', 'row', `<span>${label}</span>`); const sg = h('div', 'seg'); opts.forEach(([val, t]) => { const b = h('button', obj[key] === val ? 'on' : '', t, { 'data-nav': 1 }); b.addEventListener('click', () => { obj[key] = val; save(); [...sg.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); sfx('click'); onChange && onChange(); }); sg.appendChild(b); }); r.appendChild(sg); return r; },

  // ================= menu =================
  menu() {
    const a = this.app, s = S(), hero = this.heroById(s.hero); const el = h('div', 'screen', null, { id: 'menu' }); const left = h('div', 'left');
    left.appendChild(h('div', '', `<div class="title">WHACKERANG</div><div class="sub" style="margin-top:.5em">Throw · Catch · Last one standing</div>`));
    const md = MODES[s.setup.mode] && s.setup.mode !== 'campaign' ? s.setup.mode : 'classic'; const spd = { chill: 'Chill', normal: 'Normal', fast: 'Fast' }[s.settings.speed] || 'Chill';
    const sub = `${MODES[md].name} · ${spd}` + (md === 'classic' ? ` · ${s.setup.bots} bot${s.setup.bots > 1 ? 's' : ''}` : '');
    left.appendChild(this.btn(`<span>▶ Play</span><small class="pl-sub">${sub}</small>`, 'primary big playbtn', () => (!s.tutorialDone ? a.startTutorial() : a.quickPlay()), { id: 'btn-play' }));
    const g = h('div', 'menu-grid');
    const dailyReady = dailyReadyCount() > 0; const newSeen = s.settings.seenVer === '4.5';
    g.appendChild(this.btn('⭐ Campaign', 'gold', () => this.show('campaign')));
    g.appendChild(this.btn('🌐 Play online', 'gold', () => this.show('netMenu')));
    g.appendChild(this.btn('🎮 All modes', '', () => this.show('modes')));
    g.appendChild(this.btn('🛒 Shop', '', () => this.show('shop', { tab: 'Hats' })));
    g.appendChild(this.btn('Fighters', '', () => this.show('heroes', { mode: 'pick', ret: 'menu' })));
    g.appendChild(this.btn('Profile' + (dailyReady ? ' <i class="dot"></i>' : ''), '', () => this.show('profile')));
    g.appendChild(this.btn('Settings', '', () => this.show('settings', { ret: 'menu' })));
    g.appendChild(this.btn('How to play' + (newSeen ? '' : ' <i class="dot"></i>'), '', () => { s.settings.seenVer = '4.5'; save(); this.show('howto', { new: 1 }); }));
    left.appendChild(g); el.appendChild(left);
    const tr = h('div', 'corner tr'); tr.appendChild(h('div', 'chip', lvlChip())); tr.appendChild(this.coinChip());
    const mu = h('button', 'btn small sq', S().settings.mute ? '🔇' : '🔊', { 'data-nav': 1 }); mu.addEventListener('click', () => { S().settings.mute = !S().settings.mute; applyVolumes(); save(); mu.textContent = S().settings.mute ? '🔇' : '🔊'; sfx('click'); }); tr.appendChild(mu); el.appendChild(tr);
    if (canInstall()) { const br = h('div', 'corner tl'); br.appendChild(this.btn(IS_IOS ? '\u2B07 Add to Home Screen' : '\u2B07 Install app', 'gold small', () => promptInstall(this))); el.appendChild(br); }
    // daily missions card
    const d = ensureDaily(); const card = h('div', 'mcard'); card.appendChild(h('div', 'mh', `<b>Daily missions</b><span>${d.list.filter((c) => d.claimed[c.id]).length}/3</span>`));
    d.list.forEach((c, i) => { const pr = dailyProgress(c), done = pr >= c.n, cl = d.claimed[c.id]; const row = h('button', 'mrow' + (cl ? ' claimed' : done ? ' done' : ''), `<span class="mt">${c.text}</span><span class="mbar"><i style="width:${Math.round(pr / c.n * 100)}%"></i></span><span class="mg">${cl ? '✓' : done ? 'CLAIM' : '+' + c.coins}</span>`, { 'data-nav': 1 });
      row.addEventListener('click', () => { if (done && !cl && claimDaily(i)) { sfx('missionDone'); this.toast(`Mission complete! +${c.coins} gold, +${c.xp} XP`, 1600); this.show('menu'); } else { sfx('click'); this.show('profile'); } }); card.appendChild(row); });
    const cs = chestState(); if (cs !== 'locked') { const cr = h('button', 'mrow chest' + (cs === 'ready' ? ' done' : ' claimed'), `<span class="mt">Daily chest</span><span class="mg">${cs === 'ready' ? 'OPEN +' + CHEST_GOLD : '✓'}</span>`, { 'data-nav': 1 }); cr.addEventListener('click', () => { if (claimChest()) { sfx('missionDone'); this.toast(`Daily chest! +${CHEST_GOLD} gold`, 1600); this.show('menu'); } }); card.appendChild(cr); }
    el.appendChild(card);
    const bl = h('div', 'corner bl'); bl.appendChild(h('div', 'chip', `<span>${hero.name}</span><span class="dimc">${hero.title}</span>`)); el.appendChild(bl);
    return el;
  },
  tutintro() {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog'); d.appendChild(h('h2', '', 'Welcome to Whackerang!')); d.appendChild(h('p', 'lead', 'New here? A quick 45-second training teaches you to <b>throw</b>, <b>catch</b> and <b>dash</b>. Or jump straight in. The game starts on <b>Chill</b> speed with <b>Medium</b> bots.'));
    const b = h('div', 'btns'); b.appendChild(this.btn('▶ Quick training', 'primary', () => this.app.startTutorial())); b.appendChild(this.btn('Skip, just play', '', () => { S().tutorialDone = true; save(); this.app.quickPlay(); })); d.appendChild(b); el.appendChild(d); return el;
  },
  // ================= modes =================
  modes() {
    const el = h('div', 'screen page'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Choose a mode')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const grid = h('div', 'mode-grid');
    Object.entries(MODES).forEach(([id, m]) => {
      const touch = this.app.isTouchDevice();
      const c = h('button', 'mode-card', `<div class="mi" style="--mc:${m.color}">${m.icon}</div><div class="mn">${m.name}</div><div class="mb">${m.blurb}</div>${id === 'campaign' ? `<div class="mx">${stars(0)} ${campStars()}/${MAX_STARS} ★</div>` : id === 'survival' ? `<div class="mx">Best: wave ${S().best.survival || 0}</div>` : id === 'koth' ? `<div class="mx">Best: ${S().best.koth || 0} pts</div>` : ''}`, { 'data-nav': 1, style: `--mc:${m.color}` });
      c.addEventListener('click', () => { sfx('click'); if (id === 'campaign') this.show('campaign'); else this.show('setup', { mode: id }); });
      c.addEventListener('pointerenter', () => this.setFocus(c)); grid.appendChild(c);
    });
    el.appendChild(grid); return el;
  },
  // ================= setup =================
  setup(p) {
    const s = S(), v = s.setup, mode = p.mode || v.mode || 'classic'; v.mode = mode; const M = MODES[mode]; const el = h('div', 'screen page'); const hd = h('header');
    hd.appendChild(this.backBtn(() => this.show('modes'))); hd.appendChild(h('h2', '', M.name)); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const grid = h('div', 'panel vs-grid scroll'); const touch = this.app.isTouchDevice(); const add = (r) => grid.appendChild(r);
    add(this.seg('Game speed', s.settings, 'speed', [['chill', 'Chill'], ['normal', 'Normal'], ['fast', 'Fast']]));
    if (mode === 'coins' || mode === 'crumble') add(this.seg('Bots', v, 'bots', [[1, '1'], [2, '2'], [3, '3']]));
    if (mode === 'crumble') add(this.seg('First to', v, 'rounds', [[1, '1 win'], [2, '2 wins'], [3, '3 wins']]));
    if (mode === 'classic' && !touch) add(this.seg('Players', v, 'players', [[1, '1 Player'], [2, '2 Local']]));
    if (mode === 'classic') add(this.seg('Bots', v, 'bots', [[1, '1'], [2, '2'], [3, '3']]));
    if (mode === 'koth' || mode === 'bomb') add(this.seg('Bots', v, 'bots', [[mode === 'bomb' ? 2 : 1, mode === 'bomb' ? '2' : '1'], [2, mode === 'bomb' ? '2' : '2'], [3, '3']].filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i)));
    if (mode !== 'survival' && mode !== 'crumble' || mode === 'crumble') add(this.seg('Bot skill', v, 'diff', [[0, 'Easy'], [1, 'Medium'], [2, 'Hard']]));
    if (mode === 'classic' || mode === 'team') add(this.seg('First to', v, 'rounds', [[1, '1 win'], [2, '2 wins'], [3, '3 wins'], [5, '5 wins']]));
    add(this.seg('Arena events', s.settings, 'events', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]));
    if (!M.size) add(this.seg('Map size', v, 'size', [['small', 'Small'], ['large', 'Large'], ['huge', 'Huge']]));
    if (!M.noTraps) add(this.seg('Traps', v, 'traps', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]));
    add(this.seg('Daily twist', v, 'mutator', [['off', 'Off'], ['daily', 'Today: ' + todayMutator().name]]));
    const ar = h('div', 'row', '<span>Arena</span>'); const ao = h('div', 'arena-opt');
    [{ id: 'random', name: 'Random' }, ...ARENAS].forEach((A) => { const b = h('button', v.arena === A.id ? 'on' : '', `<i style="background:${ARENA_SW[A.id]}"></i>${A.name.replace(' ', '<br>')}`, { 'data-nav': 1 }); b.addEventListener('click', () => { v.arena = A.id; save(); [...ao.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); sfx('click'); }); ao.appendChild(b); });
    ar.appendChild(ao); ar.style.gridColumn = '1 / -1'; add(ar);
    // loadout
    const lr = h('div', 'row loadout', '<span>Boomerang</span>'); lr.style.gridColumn = '1 / -1'; const lt = h('div', 'ltypes'); const desc = h('div', 'ldesc', BOOM_TYPES[s.eq.type].desc);
    Object.entries(BOOM_TYPES).forEach(([id, t]) => { const has = owns('types', id); const b = h('button', 'ltype' + (s.eq.type === id ? ' on' : '') + (has ? '' : ' lk'), `${boomSvg(hex(t.color))}<span>${t.name}</span>${has ? '' : '<em>🔒</em>'}`, { 'data-nav': 1, style: `--tc:${hex(t.color)}` }); b.addEventListener('click', () => { if (!has) { sfx('deny'); this.toast(`Unlock ${t.name} in the Shop (${t.cost} gold) or by levelling up`); return; } equip('types', id); [...lt.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); desc.textContent = t.desc; sfx('click'); }); lt.appendChild(b); });
    lr.appendChild(lt); add(lr); const dr = h('div', '', '', { style: 'grid-column:1/-1' }); dr.appendChild(desc); add(dr);
    const hero = this.heroById(s.hero), hero2 = this.heroById(s.hero2);
    const hr = h('div', 'row', `<span>Fighter: <b>${hero.name}</b></span>`); hr.appendChild(this.btn('Change', 'small', () => this.show('heroes', { mode: 'pick', ret: 'setup', rp: { mode } }))); add(hr);
    if (mode === 'classic' && !touch && v.players === 2) { const h2 = h('div', 'row', `<span>P2: <b>${hero2.name}</b></span>`); h2.appendChild(this.btn('Change', 'small', () => this.show('heroes', { mode: 'pick2', ret: 'setup', rp: { mode } }))); add(h2); }
    add(h('div', 'note-line', { survival: 'Survive endless waves with 3 lives. Elite enemies appear every 5th wave.', koth: 'First to 100 points wins (4 pts/sec alone in the zone). KO\u2019d fighters respawn.', bomb: 'The holder of the bomb must hit a rival to pass it. Last one standing wins.', ctf: 'Grab the rival flag (pink or cyan) and carry it to your own base while YOUR flag is safe. Carriers are slower. Boomerangs KO, KOs respawn at base. First to 3 captures.', coins: 'Collect coins (blue gems are worth 5). KO a rival and they spill coins. First to 40 or most after 100s.', ball: 'Push the ball with your body, dash to kick it hard, or hit it with a boomerang. Boomerangs only stun here. First to 3 goals.', crumble: 'Tiles flash and drop. Keep moving, KO rivals, and be the last one standing.', bossrush: 'You and a bot buddy face three bosses in a row. You have 3 lives each. Dodge slams, parry and hit hard.', team: 'You + a bot partner (cyan) vs two bots (pink). Friendly fire is off.', classic: 'Hit anyone with a boomerang to KO. Sudden death shrinks the arena.' }[mode]));
    el.appendChild(grid);
    const go = this.btn('▶ START', 'primary', () => this.app.startMode(mode)); go.style.alignSelf = 'flex-end'; el.appendChild(go); return el;
  },
  // ================= campaign =================
  campaign() {
    const s = S(), cs = s.camp.stars; const el = h('div', 'screen page'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Campaign')); hd.appendChild(h('div', 'chip', `${stars(3)} ${campStars()} / ${MAX_STARS}`)); el.appendChild(hd);
    const grid = h('div', 'camp-grid');
    STAGES.forEach((st, i) => {
      const unlocked = i === 0 || (cs[i - 1] || 0) > 0; const got = cs[i] || 0; const boss = st.kind === 'boss';
      const c = h('button', 'stage' + (boss ? ' boss' : '') + (unlocked ? '' : ' lock'), `<div class="sn">${boss ? '👑' : st.n}</div><div class="st">${st.name.replace('Boss: ', '')}</div><div class="sk">${stageBlurb(st)}</div>${unlocked ? stars(got) : '<div class="lk">🔒</div>'}`, { 'data-nav': 1, style: `--sw:${ARENA_SW[st.arena]}` });
      c.addEventListener('click', () => { if (!unlocked) { sfx('deny'); this.toast('Clear the previous stage first'); return; } sfx('click'); this.show('stageInfo', { n: st.n }); }); c.addEventListener('pointerenter', () => this.setFocus(c)); grid.appendChild(c);
    });
    el.appendChild(grid); return el;
  },
  stageInfo(p) {
    const st = STAGES[p.n - 1], s = S(), got = s.camp.stars[p.n - 1] || 0; const el = h('div', 'screen center'); const d = h('div', 'panel dialog stage-info');
    d.appendChild(h('div', 'sub', `Stage ${st.n} · ${stageBlurb(st)}`)); d.appendChild(h('h2', '', st.name)); d.appendChild(h('div', 'tip', '💡 ' + st.tip));
    const hints = starHint(st); const sl = h('div', 'star-list'); hints.forEach((t, i) => sl.appendChild(h('div', i < got ? 'got' : '', `${stars(i + 1).replace(/class="star on"/g, 'class="star on"')} ${t}`))); d.appendChild(sl);
    if (st.boss) d.appendChild(h('div', 'bossline', `Boss: <b>${st.boss.name}</b> · ${st.boss.hp} HP`));
    d.appendChild(this.seg('Game speed', s.settings, 'speed', [['chill', 'Chill'], ['normal', 'Normal'], ['fast', 'Fast']]));
    const b = h('div', 'btns'); b.appendChild(this.btn('▶ Start', 'primary', () => this.app.startStage(st.n))); b.appendChild(this.btn('Back', 'back', () => this.show('campaign'), { 'data-back': 1 })); d.appendChild(b); el.appendChild(d); return el;
  },
  // ================= shop =================
  shop(p) {
    const s = S(); const tab = p.tab || 'Hats'; const el = h('div', 'screen page shop-split'); const hd = h('header'); hd.appendChild(this.backBtn(() => { this.app.previewCosmetic(null); this.show('menu'); })); hd.appendChild(h('h2', '', 'Shop')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const tabs = h('div', 'tabs'); Object.keys(SHOP).forEach((t) => { const b = h('button', 'tab' + (t === tab ? ' on' : ''), t, { 'data-nav': 1 }); b.addEventListener('click', () => { sfx('click'); this.app.previewCosmetic(null); this.show('shop', { tab: t }); }); tabs.appendChild(b); }); el.appendChild(tabs);
    const grid = h('div', 'shop-grid scroll'); const hero = this.heroById(s.hero); const cap = h('div', 'pv-cap', '<small>Tap an item to preview it on your fighter</small>');
    const setCap = (it) => { const own = owns(it.cat, it.id); cap.innerHTML = `<b>${it.cat === 'emotes' ? 'Emote ' + it.name : it.name}</b><small>${it.desc || (own ? 'Owned' : 'Preview')}</small>${own ? '' : `<span class="pvp"><span class="coin"></span> ${it.cost}</span>`}`; };
    SHOP[tab].forEach((it) => {
      const own = owns(it.cat, it.id); const eqd = (it.cat === 'types' && s.eq.type === it.id) || (it.cat === 'skins' && s.eq.skin === it.id) || (it.cat === 'trails' && s.eq.trail === it.id) || (it.cat === 'emotes' && s.eq.emotes.includes(it.id)) || (it.cat === 'hats' && s.hats[s.hero] === it.id);
      let prev = ''; const col = it.color || 0xffffff;
      if (it.cat === 'types' || it.cat === 'skins') prev = `<div class="prev">${boomSvg(hex(col))}</div>`; else if (it.cat === 'trails') prev = `<div class="prev trailp" style="${it.rainbow ? 'background:linear-gradient(90deg,#f55,#fd5,#5f5,#5df,#a5f)' : `background:linear-gradient(90deg,transparent,${hex(col)})`}"></div>`; else if (it.cat === 'emotes') prev = `<div class="prev emo" style="color:${hex(col)}">${it.name}</div>`; else if (it.cat === 'heroes') prev = `<div class="prev"><img src="${portrait(it.hero, 'none')}"></div>`; else prev = `<div class="prev hatp"><img src="${portrait(hero, it.id)}"></div>`;
      const c = h('div', 'card' + (eqd ? ' eq' : ''), `${prev}<h4>${it.cat === 'emotes' ? 'Emote' : it.name}</h4><p>${it.desc || ''}</p>`, { 'data-nav': 1 });
      c.addEventListener('click', (e) => { if (e.target.closest('button')) return; sfx('click'); [...grid.children].forEach((q) => q.classList.remove('pv')); c.classList.add('pv'); this.app.previewCosmetic(it.cat === 'hats' || it.cat === 'skins' || it.cat === 'trails' || it.cat === 'types' ? { cat: it.cat, id: it.id } : null); setCap(it); });
      let act;
      if (own) { if (it.cat === 'heroes') act = h('div', 'owned', '✓ Owned'); else act = this.btn(eqd ? '✓ Equipped' : 'Equip', eqd ? 'small gold' : 'small', () => { if (it.cat === 'emotes') toggleEmote(it.id); else if (it.cat === 'hats') { s.hats[s.hero] = it.id; save(); } else equip(it.cat, it.id); sfx('click'); this.app.previewCosmetic(null); this.show('shop', { tab }); }); }
      else act = this.btn(`<span class="coin"></span> ${it.cost}`, 'small ' + (s.coins >= it.cost ? 'primary' : 'locked'), () => { if (buy(it)) { sfx('buy'); if (it.cat !== 'hats' && it.cat !== 'heroes') equip(it.cat, it.id); else if (it.cat === 'hats') { s.hats[s.hero] = it.id; save(); } this.app.previewCosmetic(null); this.show('shop', { tab }); } else { sfx('deny'); this.toast('Not enough gold! Tap the gold counter to see free ways to earn more.'); } });
      c.appendChild(act); grid.appendChild(c);
    });
    if (tab === 'Emotes') grid.appendChild(h('div', 'note-line', 'Equip up to 4 emotes. In a match press 1-4 or tap the chat button.', { style: 'grid-column:1/-1' }));
    const body = h('div', 'shop-body'); body.appendChild(grid); body.appendChild(cap); el.appendChild(body); return el;
  },
  // ================= profile =================
  profile() {
    const s = S(); const l = levelInfo(); const el = h('div', 'screen page'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Profile')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const body = h('div', 'body'); const left = h('div', 'panel prof-left scroll'); const right = h('div', 'panel prof-right scroll');
    const hero = this.heroById(s.hero);
    left.appendChild(h('div', 'lvbig', `<img src="${this.pic(hero)}"><div><b>Level ${l.level}</b><div class="xpbar big"><i style="width:${Math.round(l.cur / l.need * 100)}%"></i></div><small>${l.cur} / ${l.need} XP</small></div>`));
    const nx = Object.keys(LEVEL_REWARDS).map(Number).find((x) => x > l.level); if (nx) { const k = Object.keys(LEVEL_REWARDS[nx])[0]; left.appendChild(h('div', 'note-line', `Next reward at level ${nx}: ${LEVEL_REWARDS[nx][k]} (${k.slice(0, -1)})`)); }
    left.appendChild(h('h4', '', 'Daily missions')); const d = ensureDaily();
    d.list.forEach((c, i) => { const pr = dailyProgress(c); const done = pr >= c.n, claimed = d.claimed[c.id]; const row = h('div', 'daily' + (done ? ' done' : ''), `<div><b>${c.text}</b><span class="xpbar"><i style="width:${Math.round(pr / c.n * 100)}%"></i></span><small>${pr}/${c.n} · +${c.coins} gold · +${c.xp} XP</small></div>`); row.appendChild(claimed ? h('span', 'owned', '✓') : this.btn('Claim', 'small ' + (done ? 'gold' : 'locked'), () => { if (claimDaily(i)) { sfx('buy'); this.show('profile'); } else sfx('deny'); })); left.appendChild(row); });
    { const cs = chestState(); const cr = h('div', 'daily' + (cs === 'ready' ? ' done' : ''), `<div><b>Daily chest</b><small>${cs === 'locked' ? 'Claim all 3 missions to unlock' : cs === 'ready' ? 'Unlocked!' : 'Opened today'} · +${CHEST_GOLD} gold + 50 XP</small></div>`); cr.appendChild(cs === 'claimed' ? h('span', 'owned', '✓') : this.btn('Open', 'small ' + (cs === 'ready' ? 'gold' : 'locked'), () => { if (claimChest()) { sfx('missionDone'); this.show('profile'); } else sfx('deny'); })); left.appendChild(cr); }
    left.appendChild(h('h4', '', 'Stats')); left.appendChild(h('div', 'stat-grid', [['KOs', s.stats.ko], ['Catches', s.stats.catch], ['Parries', s.stats.deflect], ['Wins', s.stats.win], ['Matches', s.played], ['Best wave', s.best.survival || 0], ['Stars', `${campStars()}/${MAX_STARS}`], ['Gold earned', s.totalCoins || 0]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')));
    right.appendChild(h('h4', '', `Achievements ${Object.keys(s.ach).length}/${ACHIEVEMENTS.length}`));
    ACHIEVEMENTS.forEach((a) => { const got = !!s.ach[a.id]; const pr = Math.min(a.n, s.stats[a.stat] || 0); right.appendChild(h('div', 'ach' + (got ? ' got' : ''), `<div class="ai">${got ? '🏆' : '🔒'}</div><div><b>${a.name}</b><small>${a.desc}</small>${got ? '' : `<span class="xpbar"><i style="width:${Math.round(pr / a.n * 100)}%"></i></span>`}</div><span class="ar">${got ? '✓' : '+' + a.coins}</span>`)); });
    body.appendChild(left); body.appendChild(right); el.appendChild(body); return el;
  },
  // ================= round end / results =================
  roundEnd(p) {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog wide'); const w = p.winner;
    d.appendChild(h('h2', '', w ? `${w.name} win${p.teamWin ? '' : 's'} the round!` : 'Draw!'));
    const tbl = h('div', 'score');
    p.players.forEach((q) => { tbl.appendChild(h('div', 'srow' + (w && !p.teamWin && w.name === q.name ? ' win' : ''), `<img src="${q.img}"><b style="color:${hex(q.color)}">${q.name}</b><span class="pips">${Array.from({ length: p.need }, (_, i) => (i < q.wins ? crown() : '<i class="pip"></i>')).join('')}</span>`)); });
    d.appendChild(tbl);
    const b = h('div', 'btns'); b.appendChild(this.btn('Next round ▶', 'primary', () => this.app.nextRound())); b.appendChild(this.btn('Menu', '', () => this.app.quitToMenu())); d.appendChild(b); el.appendChild(d); return el;
  },
  matchEnd(p) {
    const s = S(); const el = h('div', 'screen center'); const d = h('div', 'panel dialog results r2' + (p.won ? ' won' : ' lose'));
    const title = p.tutorial ? 'Training complete!' : p.stage ? (p.won ? 'Stage clear!' : 'Stage failed') : p.mode === 'survival' ? 'Game over' : (p.won ? 'Victory!' : 'Defeat');
    const left = h('div', 'rl'), right = h('div', 'rr');
    d.appendChild(h('h2', 'rtitle', title));
    if (p.stage) { left.appendChild(h('div', 'sub', `Stage ${p.stage.n} · ${p.stage.name}`)); left.appendChild(h('div', 'rstars', stars(p.stars, true))); if (p.won && p.stars > p.prevStars) left.appendChild(h('div', 'newbest', p.firstClear ? 'FIRST CLEAR!' : 'NEW BEST!')); }
    else if (p.winnerName && p.mode !== 'survival') left.appendChild(h('div', 'sub', `${p.winnerName} ${p.winnerName === 'Your team' ? 'win' : p.winnerName === 'Rival team' ? 'win' : 'wins'} the match`));
    if (p.rows.length) left.appendChild(h('div', 'stat-line rv', p.rows.map(([k, v]) => `<div><span>${k}</span>${v}</div>`).join('')));
    const l0 = p.lvBefore, l1 = p.lv; const lv0 = l0.level; const pct0 = Math.round(l0.cur / l0.need * 100), pct1 = l1.level > lv0 ? 100 : Math.round(l1.cur / l1.need * 100);
    const xr = h('div', 'xprow rv', `<b>LV ${lv0}</b><span class="xpbar big"><i style="width:${pct0}%"></i></span><span class="gain">+${p.xp} XP</span>`); left.appendChild(xr);
    const gr = h('div', 'goldrow rv', `<span class="coin big"></span><b class="cnt">0</b><span class="gl">gold earned</span>`); left.appendChild(gr);
    const lvlBox = h('div', 'lvbox'); left.appendChild(lvlBox);
    // missions panel
    const dly = ensureDaily(); const before = this.app.dailyBefore || {}; right.appendChild(h('h4', '', 'Daily missions'));
    const mrows = dly.list.map((c, i) => { const pr = dailyProgress(c), gain = pr - Math.min(c.n, before[c.id] || 0), done = pr >= c.n; const row = h('div', 'mres' + (done ? ' done' : '') + (dly.claimed[c.id] ? ' claimed' : ''), `<div class="mt">${c.text}${gain > 0 ? ` <em>+${gain}</em>` : ''}</div><span class="xpbar"><i style="width:${Math.round(Math.max(0, pr - gain) / c.n * 100)}%" data-to="${Math.round(pr / c.n * 100)}"></i></span><small>${pr}/${c.n} · +${c.coins} gold</small>`);
      const act = dly.claimed[c.id] ? h('span', 'owned', '✓') : this.btn('Claim', 'small ' + (done ? 'gold' : 'locked'), () => { if (claimDaily(i)) { sfx('missionDone'); this.show('matchEnd', { ...p, lv: levelInfo(), lvBefore: levelInfo(), ups: [], xp: 0, coins: 0, noAnim: 1 }); } else sfx('deny'); }); row.appendChild(act); right.appendChild(row); return row; });
    const cs = chestState(); if (cs === 'ready') { const cr = h('div', 'mres done chestrow', `<div class="mt">Daily chest unlocked!</div><small>+${CHEST_GOLD} gold & bonus XP</small>`); cr.appendChild(this.btn('Open', 'small gold', () => { if (claimChest()) { sfx('missionDone'); this.show('matchEnd', { ...p, lv: levelInfo(), lvBefore: levelInfo(), ups: [], xp: 0, coins: 0, noAnim: 1 }); } })); right.appendChild(cr); }
    d.appendChild(left); d.appendChild(right);
    const b = h('div', 'btns rb');
    if (p.tutorial) { b.appendChild(this.btn('Play ▶', 'primary', () => this.app.quickPlay())); b.appendChild(this.btn('Menu', '', () => this.app.quitToMenu())); }
    else { if (p.stage && p.won && p.stage.n < STAGES.length) b.appendChild(this.btn('Next stage ▶', 'primary', () => this.app.startStage(p.stage.n + 1))); b.appendChild(this.btn(p.stage ? (p.won ? '↻ Replay' : '↻ Retry') : '↻ Play again', p.stage && p.won ? '' : 'primary', () => this.app.rematch())); if (p.stage) b.appendChild(this.btn('Campaign', '', () => { this.app.quitToMenu(); this.show('campaign'); })); else b.appendChild(this.btn('Change mode', '', () => { this.app.quitToMenu(true); })); b.appendChild(this.btn('Menu', '', () => this.app.quitToMenu())); }
    d.appendChild(b); el.appendChild(d);
    // ---- reward reveal animation (skipped when re-rendered after a claim)
    const cnt = gr.querySelector('.cnt'); const ok = () => el.isConnected;
    if (p.noAnim) { cnt.textContent = '—'; gr.style.display = 'none'; xr.style.display = 'none'; el.querySelectorAll('.mres .xpbar i').forEach((i) => (i.style.width = i.dataset.to + '%')); }
    else {
      d.classList.add('reveal'); if (p.won) for (let i = 0; i < 26; i++) { const c = h('i', 'cf'); c.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 1.2}s;background:${['#ffd23c', '#ff5a8a', '#4fd1ff', '#7dff6a', '#b78cff'][i % 5]};--dr:${(Math.random() - 0.5) * 120}px`; d.appendChild(c); }
      setTimeout(() => { if (!ok()) return; const i = xr.querySelector('.xpbar i'); if (i) i.style.width = pct1 + '%'; sfx('whoosh2'); }, 450);
      setTimeout(() => { if (!ok()) return; const T = p.coins, t0 = performance.now(); let last = 0; const step = (now) => { if (!ok()) return; const k = Math.min(1, (now - t0) / 900); const v = Math.round(T * (1 - Math.pow(1 - k, 3))); cnt.textContent = '+' + v; if (v !== last && (now - (step.ls || 0) > 55)) { step.ls = now; sfx('tickup', Math.round(k * 12)); } last = v; if (k < 1) requestAnimationFrame(step); else { gr.classList.add('pop'); sfx('coin', 6); } }; requestAnimationFrame(step); }, 700);
      (p.ups || []).forEach((u, n) => setTimeout(() => { if (!ok()) return; lvlBox.appendChild(h('div', 'levelup big', `<b>LEVEL ${u.level}!</b><span>+${u.coins} gold${u.unlock ? ' · unlocked ' + u.unlock : ''}</span>`)); sfx('levelup'); fx_levelFlash(); }, 1300 + n * 700));
      setTimeout(() => { if (!ok()) return; el.querySelectorAll('.mres .xpbar i').forEach((i) => (i.style.width = i.dataset.to + '%')); if (mrows.some((r) => r.classList.contains('done') && !r.classList.contains('claimed'))) sfx('missionDone'); }, 1100);
    }
    return el;
  },
  introTitle(m, g) { if (!m) return ''; if (m.tutorial) return 'TRAINING'; if (m.stage) return 'STAGE ' + m.stage.n; return { classic: 'ROUND ' + m.round, team: 'ROUND ' + m.round, survival: 'SURVIVAL', koth: 'KING OF THE HILL', bomb: 'BOMB TAG', ctf: 'CAPTURE THE FLAG', coins: 'COIN RUSH', ball: 'BOOMERANG BALL', crumble: 'ROUND ' + m.round, bossrush: 'BOSS RUSH' }[m.mode] || 'GET READY'; },
  introSub(m, g) { if (!m) return ''; if (m.tutorial) return ''; if (m.stage) return m.stage.name; const an = ARENAS.find((a) => a.id === g.arenaId).name; return (m.mode === 'classic' || m.mode === 'team' || m.mode === 'crumble') ? an + ' · first to ' + m.need : m.mode === 'ctf' ? 'First to 3 captures' : m.mode === 'ball' ? 'First to 3 goals' : m.mode === 'coins' ? 'First to 40 coins' : m.mode === 'bossrush' ? 'Three bosses. Stay alive!' : an; },
  // ================= HUD =================
  hudStart(game) {
    const r = this.hudRoot; r.innerHTML = ''; this.hudCache = {}; this.emoteClose(); this.tutorialHide(); if (!game || game.mode === 'attract') return; this.hudGame = game;
    const top = h('div', 'top'); const l = h('div', 'grp', null, { id: 'h-pl' }); const c = h('div', 'mid', '', { id: 'h-mid' }); const rr = h('div', 'grp');
    rr.appendChild(h('div', 'chip', '', { id: 'h-time' })); const pb = h('button', 'btn small pbtn', '❚❚', { id: 'h-pause' }); pb.addEventListener('click', () => this.app.pause()); rr.appendChild(pb);
    top.appendChild(l); top.appendChild(c); top.appendChild(rr); r.appendChild(top); r.appendChild(h('div', '', '', { id: 'bossbar' })); r.appendChild(h('div', '', '', { id: 'h-pu' }));
    if (gfx.follow) { const cv = gfx.follow.big ? h('canvas', '', '', { id: 'minimap' }) : null; if (cv) { cv.width = 168; cv.height = Math.round(168 * AH / AW); r.appendChild(cv); } this.mm = cv; this.edgeEls = []; const ed = h('div', '', '', { id: 'edges' }); r.appendChild(ed); this.edgeBox = ed; } else { this.mm = null; this.edgeBox = null; }
  },
  // minimap (Large/Huge): arena, solids, hazards, fighters, camera window
  mapUpdate(game) {
    const cv = this.mm; if (!cv || !game) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height, sx = W / AW, sz = H / AH; c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(12,8,36,.72)'; c.fillRect(0, 0, W, H);
    for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) { const k = j * AW + i; const t = game.layout.t[k]; let col = null; if (game.hole[k] < 0) col = '#000'; else if (game.sol[k]) col = t === 2 ? '#b98a54' : '#7d86a8'; else if (t === 4) col = '#ff6a1a'; else if (t === 3) col = '#cfd6e6'; else if (t === 5) col = '#4ab0ff'; if (col) { c.fillStyle = col; c.fillRect(i * sx, j * sz, sx + 0.5, sz + 0.5); } }
    for (const t of game.traps.list) { if (t.type === 'tele' || t.type === 'jump' || t.type === 'goo' || t.type === 'bumper' || t.type === 'ice') { c.fillStyle = t.type === 'tele' ? '#7a8cff' : t.type === 'goo' ? '#6aff4a' : '#7dff6a'; const pts = t.pads || [t]; pts.forEach((p) => c.fillRect((p.x + HX) * sx - 2, (p.z + HZ) * sz - 2, 4, 4)); } else if (t.st >= 1 || t.up || t.warn) { c.fillStyle = '#ff3a3a'; c.fillRect((t.x + HX) * sx - 3, (t.z + HZ) * sz - 3, 6, 6); } }
    for (const q of game.fighters) { if (!q.alive) continue; c.fillStyle = hex(q.color); c.strokeStyle = '#fff'; c.lineWidth = q.isBot ? 1 : 2; c.beginPath(); c.arc((q.x + HX) * sx, (q.z + HZ) * sz, q.isBot ? 3.2 : 4.4, 0, 6.3); c.fill(); c.stroke(); }
    if (game.camPoints) for (const p of game.camPoints()) { c.fillStyle = p[2] || '#ffd23c'; c.fillRect((p[0] + HX) * sx - 3, (p[1] + HZ) * sz - 3, 6, 6); }
    const f = gfx.follow; if (f) { const vw = (f.fill ? f.visW : 22 * (f.k || 1)) * f.d / f.dMin, vh = (f.fill ? f.visH : 13 * (f.k || 1)) * f.d / f.dMin; c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5; c.strokeRect((f.cx + HX - vw / 2) * sx, (f.cz + HZ - vh / 2) * sz, vw * sx, vh * sz); }
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, W - 1, H - 1);
  },
  // arrows at the screen edge pointing to off-screen rivals
  edgeUpdate(game) {
    const box = this.edgeBox; if (!box || !game) return; if (this.app.match && this.app.match.tutorial) { this.edgeEls.forEach((e) => { e.style.display = 'none'; }); return; } const foes = game.fighters.filter((q) => q.alive && q.isBot); const me = game.fighters.find((q) => !q.isBot && q.alive);
    while (this.edgeEls.length < foes.length) { const e = h('div', 'edge', '<i></i>'); box.appendChild(e); this.edgeEls.push(e); }
    const W = gfx.w, H = gfx.h; const padX = 22, padT = 34, padB = 22;
    this.edgeEls.forEach((e, n) => {
      const q = foes[n]; if (!q) { e.style.display = 'none'; return; }
      const [px, py, on0] = toScreen(q.x, 0.5, q.z); const sl = Math.max(padX, gfx.reserveL || 0) / W, sr = 1 - Math.max(padX, gfx.reserveR || 0) / W; const on = on0 && px >= sl && px <= sr && py >= padT / H && py <= 1 - padB / H; if (on) { e.style.display = 'none'; return; }
      const sr2 = sr - 0.045, sl2 = sl + 0.02; const cx0 = (sl2 + sr2) / 2, cy0 = 0.5; let dx = px - cx0, dy = py - cy0; const ax = (sr2 - sl2) / 2, ay = (0.5 - padT / H); const k = Math.min(ax / Math.abs(dx || 1e-6), (0.5 - padB / H) / Math.abs(dy || 1e-6) * (dy > 0 ? 1 : 1), 1e6); let ex = cx0 + dx * Math.min(k, 1e6), ey = cy0 + dy * Math.min(k, 1e6);
      const kx = Math.abs(dx) > 1e-6 ? ax / Math.abs(dx) : 1e9, ky = Math.abs(dy) > 1e-6 ? (dy > 0 ? (0.5 - padB / H) : ay) / Math.abs(dy) : 1e9; const kk = Math.min(kx, ky); ex = cx0 + dx * kk; ey = cy0 + dy * kk;
      const near = me ? Math.hypot(q.x - me.x, q.z - me.z) : 20; e.style.display = 'block'; e.style.left = (ex * 100) + '%'; e.style.top = (ey * 100) + '%'; e.style.setProperty('--pc', hex(q.color)); e.style.setProperty('--rot', Math.atan2(dy, dx) + 'rad'); e.style.opacity = String(Math.max(0.45, Math.min(1, 1.3 - near / 26)));
    });
  },
  hudUpdate(game) {
    if (!game || game.mode === 'attract' || !this.hudCache) return; const m = this.app.match; const ms = game.mstate(); const touch = Input.touch.enabled;
    const shown = game.fighters.slice(0, game.nPlayers);
    this.hudSet('h-pl', shown.map((q) => { const lives = q.def.lives || 1; const hearts = lives > 1 && lives < 90 ? `<span class="hearts">${Array.from({ length: Math.max(lives, q.lives) }, (_, i) => heart(i < q.lives)).join('')}</span>` : ''; const rdy = q.ult >= 100; return `<div class="pchip ${q.alive || q.respawnT > 0 ? '' : 'dead'}" style="--pc:${hex(q.color)}"><img src="${this.pic(q.hero, q.def.hat)}"><div class="pc-in"><span class="nm">${q.name}</span>${hearts}<span class="w">${crown().repeat(q.wins || 0)}</span><span class="ultbar ${rdy ? 'rdy' : ''}"><i style="width:${Math.round(q.ult)}%"></i></span></div>${!q.isBot && rdy && !touch ? '<span class="ultk">ULT [R]</span>' : ''}</div>`; }).join(''));
    this.mapUpdate(game); let mid = ''; const rt = ms.type;
    if (m && m.tutorial) mid = ''; else if (m && m.stage) mid = `<b>${m.stage.n}</b> ${m.stage.name.replace('Boss: ', '')}`; else if (game.sudden) mid = '<span style="color:#ff5a5a">SUDDEN DEATH</span>'; else mid = (rt === 'elim' ? `Round ${game.round}` : '');
    if (rt === 'koth') { const teams = [...new Set(game.fighters.slice(0, game.nPlayers).map((f) => f.team))]; mid = `<div class="koth">${teams.map((t) => `<div class="kb ${ms.owner === t ? 'own' : ''}" style="--pc:${hex(game.teamColor(t))}"><i style="width:${Math.min(100, (ms.scores[t] || 0) / ms.target * 100)}%"></i><b>${Math.floor(ms.scores[t] || 0)}</b></div>`).join('')}</div><div class="kz ${ms.contested ? 'c' : ''}">${ms.contested ? 'CONTESTED' : 'Hill moves in ' + Math.ceil(ms.zoneIn) + 's'}</div>`; }
    else if (rt === 'bomb') { const hd = ms.holder; mid = `<div class="bombbar"><span>💣 ${hd ? hd.name : '...'}</span><i style="width:${Math.round(ms.fuse / ms.fuseMax * 100)}%" class="${ms.fuse < 4 ? 'hot' : ''}"></i></div>`; }
    else if (rt === 'ctf' || rt === 'ball') { mid = `<div class="koth sc2">${[0, 1].map((t) => `<div class="kb" style="--pc:${hex(game.teamColor(t))}"><i style="width:${Math.min(100, (ms.scores[t] || 0) / ms.target * 100)}%"></i><b>${ms.scores[t] || 0}</b></div>`).join('')}</div><div class="kz">${rt === 'ctf' ? '🚩 ' : '⚽ '}${fmtTime(ms.left)}${rt === 'ctf' && ms.carry.some((c) => c) ? ' · FLAG CARRIED' : ''}</div>`; }
    else if (rt === 'coins') { mid = `<div class="coinrow">${ms.coinRows.map((c) => `<span style="--pc:${hex(c.color)}">${c.score}</span>`).join('')}</div><div class="kz">🪙 first to ${ms.target} · ${fmtTime(ms.left)}</div>`; }
    else if (rt === 'bossrush') mid = `<b>BOSS ${ms.rush.n} / ${ms.rush.total}</b>`;
    else if (game.rules.crumble && ms.floor !== undefined) mid = `Round ${game.round} · <b>FLOOR ${ms.floor}%</b>`;
    else if (rt === 'survival') mid = `<b>WAVE ${ms.wave}</b> · ${ms.left} left${game.rules.waves ? ' / ' + game.rules.waves : ''}`;
    this.hudSet('h-mid', mid);
    { const me = game.fighters.find((q) => !q.isBot && q.def.slot === 0); let pu = ''; if (me && me.alive) { const ts = game.cfg ? game.cfg.ts : 1; for (const k in me.pu) { if (me.pu[k] > 0 && POWERUPS[k]) pu += `<span class="pui" style="--pc:${hex(POWERUPS[k].color)}"><i>${POWERUPS[k].short}</i><b>${Math.ceil(me.pu[k] / ts)}</b></span>`; } if (me.shield) pu += `<span class="pui" style="--pc:${hex(POWERUPS.shield.color)}"><i>SH</i></span>`; if (me.typeT > 0) pu += `<span class="pui" style="--pc:${hex(BOOM_TYPES[me.type].color)}"><i>${BOOM_TYPES[me.type].name.slice(0, 2).toUpperCase()}</i><b>${Math.ceil(me.typeT / ts)}</b></span>`; if (me.maxAmmo > 1) pu += `<span class="pui" style="--pc:${hex(POWERUPS.extra.color)}"><i>x${me.maxAmmo}</i></span>`; } this.hudSet('h-pu', pu); }
    const tl = rt === 'koth' ? '' : (game.sudden ? '☠' : (game.rules.sudden ? fmtTime(Math.max(0, 48 - game.playTime)) : fmtTime(game.playTime)));
    this.hudSet('h-time', tl);
    const bb = $('#bossbar'); if (bb) { const b = ms.boss; this.hudSet('bossbar', b ? `<div class="bn">${b.name}</div><div class="bhp">${Array.from({ length: b.max }, (_, i) => `<i class="${i < b.hp ? 'on' : ''}"></i>`).join('')}</div>` : ''); }
  },
  hudSet(id, html) { const c = this.hudCache; if (!c) return; if (c[id] !== html) { c[id] = html; const e = document.getElementById(id); if (e) e.innerHTML = html; } },
  // ================= tutorial =================
  tutorialShow(t) {
    const touch = Input.touch.enabled; const ICO = {
      move: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="none" stroke="#7fe8ff" stroke-width="3"/><circle cx="24" cy="24" r="8" fill="#7fe8ff"/><path d="M24 4l-5 7h10zM24 44l-5-7h10zM4 24l7-5v10zM44 24l-7-5v10z" fill="#fff"/></svg>',
      throw: '<svg viewBox="0 0 48 48"><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#3a1600" stroke-width="11" stroke-linecap="round"/><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#ffcf3a" stroke-width="7" stroke-linecap="round"/></svg>',
      catch: '<svg viewBox="0 0 48 48"><path d="M40 10C20 8 8 18 10 34" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/><path d="M6 30l4 8 7-6z" fill="#fff"/><circle cx="24" cy="26" r="9" fill="none" stroke="#ffe066" stroke-width="3"/><path d="M17 28c1-6 4-9 7-9s6 3 7 9" fill="none" stroke="#ffcf3a" stroke-width="4" stroke-linecap="round"/></svg>',
      dodge: '<svg viewBox="0 0 48 48"><path d="M24 4L3 42h42z" fill="#ff3b30" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M24 17v12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><circle cx="24" cy="35" r="2.8" fill="#fff"/></svg>',
      done: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#3ddc6a" stroke="#fff" stroke-width="3"/><path d="M13 25l8 8 15-17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
    const steps = [['move', 'MOVE'], ['throw', 'THROW'], ['catch', 'CATCH'], ['dodge', 'DODGE'], ['done', 'NICE!']];
    const keys = ['<span class="kc">W</span><span class="kc">A</span><span class="kc">S</span><span class="kc">D</span>', '<span class="kc w">CLICK</span>', '', '<span class="kc w">SPACE</span>', ''];
    let c = $('#tut'); if (!c) { c = h('div', '', '', { id: 'tut' }); document.body.appendChild(c); }
    const st = steps[Math.min(t.step, steps.length - 1)]; c.className = 'show s' + t.step + (touch ? ' touch' : '');
    c.innerHTML = `<div class="tt"><i class="ti">${ICO[st[0]]}</i><b>${st[1]}</b>${touch ? '' : `<span class="tk">${keys[t.step]}</span>`}</div><div class="td">${steps.slice(0, 4).map((_, i) => `<i class="${i < t.step ? 'done' : i === t.step ? 'cur' : ''}"></i>`).join('')}</div><button class="tskip" id="tskip" aria-label="Skip">SKIP <span>&#9654;</span></button><div class="ghost" id="ghost"><i></i><svg viewBox="0 0 40 48"><path d="M14 4c3 0 5 2 5 5v14l3-1c3-1 6 1 6 4l2-1c3-1 6 1 5 4 3-1 5 2 4 5l-2 12c-1 5-5 8-10 8H19c-4 0-7-2-9-5L3 31c-1-3 2-6 5-4l3 3V9c0-3 1-5 3-5z" fill="#fff" fill-opacity=".92" stroke="#7fe8ff" stroke-width="2" stroke-linejoin="round"/></svg></div>`;
    const sk = c.querySelector('#tskip'); if (sk) sk.addEventListener('click', (e) => { e.stopPropagation(); sfx('click'); this.app.skipTutorial(); });
    this.tutorialGhost();
  },
  tutorialGhost() { // park the ghost thumb on the control for this step (touch only)
    const c = $('#tut'), g = $('#ghost'); if (!c || !g || !this.app.tut) return; const t = this.app.tut; const touch = Input.touch.enabled;
    const target = [ 'joybase', 'aimbase', 'joybase', 'joybase', null ][Math.min(t.step, 4)]; const e = target && document.getElementById(target);
    if (!touch || !e) { g.style.display = 'none'; return; } const r = e.getBoundingClientRect(); g.style.display = 'block'; g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height / 2) + 'px'; g.style.setProperty('--gr', Math.round(r.width * 0.3) + 'px');
    g.className = 'ghost g' + t.step;
  },
  tutorialHide() { const c = $('#tut'); if (c) { c.className = ''; c.innerHTML = ''; } },
  // ================= emotes =================
  emoteToggle() { if ($('#emotes.show')) this.emoteClose(); else this.emoteOpen(); },
  emoteOpen() { let r = $('#emotes'); if (!r) { r = h('div', '', '', { id: 'emotes' }); document.body.appendChild(r); } r.className = 'show'; r.innerHTML = ''; S().eq.emotes.forEach((id, i) => { const e = EMOTES[id]; const b = h('button', 'emo-btn', e.text, { style: `--ec:${hex(e.color)}` }); b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.app.emote(id); }); r.appendChild(b); }); },
  emoteClose() { const r = $('#emotes'); if (r) { r.className = ''; r.innerHTML = ''; } },
});
// extend the existing pause/howto/heroes via small wrappers
const _heroes = UI.heroes;
UI.heroes = function (p) {
  const el = _heroes.call(this, p); const back = el.querySelector('[data-back]'); if (back && p.ret === 'setup') { const nb = back.cloneNode(true); nb.addEventListener('click', () => { sfx('back'); save(); this.show('setup', p.rp); }); back.replaceWith(nb); }
  const mo = new MutationObserver(() => { const perk = el.querySelector('.perk:not(.ult)'); if (perk && !el.querySelector('.perk.ult')) { const sel = [...el.querySelectorAll('.hero-card')].findIndex((c) => c.classList.contains('sel')); const hh = HEROES[sel >= 0 ? sel : 0]; perk.insertAdjacentHTML('afterend', `<div class="perk ult">⚡ <b>${ULTS[hh.id].name}</b> — ${ULTS[hh.id].desc}</div>`); } });
  mo.observe(el, { childList: true, subtree: true }); setTimeout(() => { const perk = el.querySelector('.perk:not(.ult)'); if (perk && !el.querySelector('.perk.ult')) { const sel = [...el.querySelectorAll('.hero-card')].findIndex((c) => c.classList.contains('sel')); const hh = HEROES[sel >= 0 ? sel : 0]; perk.insertAdjacentHTML('afterend', `<div class="perk ult">⚡ <b>${ULTS[hh.id].name}</b> — ${ULTS[hh.id].desc}</div>`); } }, 0); return el;
};
const _settings = UI.settings;
UI.settings = function (p) {
  const el = _settings.call(this, p); const grid = el.querySelector('.set-grid'); const s = S().settings;
  const tog = (label, key, fn) => { const r = h('div', 'row', `<span>${label}</span>`); const t = h('button', 'tog' + (s[key] ? ' on' : ''), null, { 'data-nav': 1 }); t.addEventListener('click', () => { s[key] = !s[key]; t.classList.toggle('on', !!s[key]); save(); fn && fn(); sfx('click'); }); r.appendChild(t); return r; };
  const first = grid.firstChild; grid.insertBefore(tog('Mute all audio', 'mute', applyVolumes), first);
  { const mr = h('div', 'row', '<span>Master volume</span>'); const mi = h('input', '', null, { type: 'range', min: 0, max: 1, step: 0.05, value: s.master }); mi.addEventListener('input', () => { s.master = +mi.value; applyVolumes(); }); mi.addEventListener('change', () => { save(); sfx('click'); }); mr.appendChild(mi); grid.insertBefore(mr, first); }
  grid.insertBefore(tog('Background music', 'musicOn', applyVolumes), first);
  grid.insertBefore(this.seg('Camera', s, 'camera', [['close', 'Close'], ['wide', 'Wide']], () => { save(); fitCamera(); }), first); grid.insertBefore(tog('Screen flashes', 'flash', () => { gfx.flashOn = !!s.flash; }), first);
  grid.insertBefore(this.seg('Arena events', s, 'events', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]), first);
  { const row = [...grid.children].find((r) => r.firstChild && r.firstChild.textContent === 'Screen shake'); const sg = this.seg('Screen shake', s, 'shakeLvl', [['off', 'Off'], ['low', 'Low'], ['full', 'Full']], () => { s.shake = s.shakeLvl !== 'off'; save(); }); if (row) row.replaceWith(sg); else grid.appendChild(sg); }
  const tr = h('div', 'row', '<span>Training</span>'); tr.appendChild(this.btn('Replay tutorial', 'small', () => { if (p.ret === 'pause') this.app.quitToMenu(); this.app.startTutorial(); })); grid.appendChild(tr);
  return el;
};

// How to play: extra pages for the v3 features (modes, trap guide, switches, map sizes, gold, daily twists)
const _howto = UI.howto;
UI.howto = function (p) {
  const el = _howto.call(this, p); const pn = el.querySelector('.howto'); if (!pn) return el;
  const mm = Object.entries(MODES).filter(([k]) => k !== 'campaign').map(([, v]) => `<li><b>${v.icon} ${v.name}</b> <small>${v.blurb}</small></li>`).join('');
  const tl = (k) => Object.entries(TRAP_INFO).filter(([, v]) => v.lethal === k).map(([, v]) => `<li><b>${v.name}</b> <small>${v.tip}</small></li>`).join('');
  const tt = `<li><b>DEADLY (red):</b></li>${tl(true)}<li><b>NOT deadly (yellow/colour):</b></li>${tl(false)}`;
  const mu = MUTATORS.map((m) => `<li><b>${m.icon} ${m.name}</b> <small>${m.desc}</small></li>`).join('');
  const LG = legendImages();
  const wn41 = h('div', 'hw-new', `<div class="hw-top"><button class="btn primary" id="hw-replay">&#9654; Replay tutorial</button></div>
    <div class="hw-legend"><div><img src="${LG.hazard}" alt="deadly"><b>DEADLY (red)</b><small>asleep until armed</small></div><div><span class="two"><img src="${LG.soft1}" alt="shove"><img src="${LG.soft2}" alt="dizzy"></span><b>ANNOYING (yellow)</b><small>never kills</small></div><div><span class="two"><img src="${LG.portal1}" alt="portal 1"><img src="${LG.portal2}" alt="portal 2"></span><b>PORTAL</b></div><div><img src="${LG.pad}" alt="jump pad"><b>JUMP PAD</b></div><div><span class="lg-drop" aria-label="drop"></span><b>DROP (cyan edge)</b><small>no floor: you fall</small></div></div>
    <div class="hw-keys"><span><i>&#128073;</i> Left thumb: <b>MOVE</b></span><span><i>&#129667;</i> Right thumb: <b>THROW</b> (drag to aim)</span><span><i>&#10148;</i> <b>DASH</b> / <b>DEFLECT</b> buttons</span></div>`);
  wn41.style.gridColumn = '1 / -1'; pn.insertBefore(wn41, pn.firstChild); if (p && p.new) setTimeout(() => { pn.scrollTop = 0; }, 0);
  { const rb = wn41.querySelector('#hw-replay'); rb.addEventListener('click', () => { sfx('click'); this.app.startTutorial(); }); }
  const x = h('div', '', `<div class="hw-more"><h4 style="margin-top:1em">Modes</h4><ul>${mm}</ul>
    <h4 style="margin-top:1em">Map sizes</h4><p>Pick <b>Small</b>, <b>Large</b> or <b>Huge</b> in match setup. On bigger maps the camera follows the action; the <b>minimap</b> (top right) and the <b>arrows</b> at the screen edge show where rivals and objectives are. A few modes pick the size for you.</p>
    <h4 style="margin-top:1em">Traps</h4><p><b>Red traps are deadly, but they sleep until a player wakes them:</b> step on a switch plate, hit a switch with your boomerang, or hit the trap itself. You get about half a second of flashing warning. <b>Yellow traps never kill</b>: they slow, shove, stun for half a second or make your aim go dizzy. Set traps to Off, Some or Wild in setup. Dashing and jump pads make you safe for a moment.</p><ul>${tt}</ul><h4 style="margin-top:1em">Countdown</h4><p>Every round starts with a big <b>3-2-1-GO</b> (always 3 seconds, whatever Game Speed you picked). While it counts you can look around the arena, but nobody can move, throw or use traps, the clocks have not started and nobody can be hurt. Online, the host\u2019s start time is shared so everyone\u2019s GO lands together. Training skips the long version.</p><h4 style="margin-top:1em">Drops</h4><p><b>A dark hole with a glowing cyan edge means no floor.</b> Cracking tiles blink dark and cyan just before they fall. When you get close to a drop the screen edge glows, the phone ticks and buzzes, and you wobble if you stand on nothing: step back within a quarter of a second and you are fine. With <b>Edge help</b> on (Settings) your first fall in a match is forgiven once: you are put back on safe floor, stunned for under a second, with a short shield. After that, falling is real.</p>
    <h4 style="margin-top:1em">Daily twist</h4><p>Setup has a <b>Daily twist</b> option: one of these every day.</p><ul>${mu}</ul>
    <h4 style="margin-top:1em">Online play</h4><p>Open <b>Play online</b>. <b>Create room</b> gives you a 5-letter code and a share link; friends choose <b>Join</b> and enter it (or open the link). Up to 4 players. Everyone picks a fighter and presses <b>Ready</b>; the host chooses the mode and starts. The match does not pause online. If your connection drops, a bot plays for you and you can rejoin. The ping chip in the corner shows your delay (green is good).</p>
    <p><b>Privacy:</b> online play shares only your game inputs and the game state with the friends in your room, plus the display name and fighter you choose. There is no chat, no voice and no way for strangers to find your room. The match runs on the host\u2019s device. Phones connect directly when they can; on strict networks the game automatically passes the same data through a small free relay server that only forwards it and stores nothing. A DIRECT or RELAY tag shows which one you are using.</p>
    <p><b>Can\u2019t connect?</b> Switch Wi-Fi and mobile data, use a phone hotspot, or let another friend host. As a last resort use <b>Connect without server</b> to swap two codes by hand.</p>
    <h4 style="margin-top:1em">Gold</h4><p>You <b>earn gold by playing</b> (wins, KOs, dailies, login streak, achievements). The Gold Store also has an optional <b>Buy gold</b> tab. It is in <b>TEST MODE</b>: nothing is charged. Gold buys looks and conveniences, never power.</p></div>`);
  x.style.gridColumn = '1 / -1'; pn.appendChild(x); return el;
};
UI.pause = ((orig) => function () { const el = orig.call(this); return el; })(UI.pause);
