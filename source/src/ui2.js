// v2.0 screens: menu, mode select, setup, campaign, shop, profile, results, HUD, tutorial, emotes.
import { UI, h, $ } from './ui.js';
import { S, save, resetSave } from './save.js';
import { HEROES, HATS, ARENAS, POWERUPS, PLAYER_COLORS, BOOM_TYPES, TRAILS, SKINS, EMOTES, ULTS, MODES, ACHIEVEMENTS, PERSONA_INFO } from './data.js';
import { STAGES, MAX_STARS, starHint, stageBlurb } from './modes.js';
import { levelInfo, xpNeed, ensureDaily, dailyProgress, claimDaily, SHOP, owns, buy, equip, toggleEmote, LEVEL_REWARDS } from './progress.js';
import { sfx, applyVolumes } from './audio.js';
import { setQuality, gfx } from './gfx.js';
import { portrait } from './portraits.js';
import { canInstall, promptInstall, IS_APP, IS_IOS } from './pwa.js';
import { Input } from './input.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const ARENA_SW = { dojo: 'linear-gradient(135deg,#d7edb0,#a77d52)', rooftop: 'linear-gradient(135deg,#252a5c,#ff2bd6)', jungle: 'linear-gradient(135deg,#8ea46a,#ff7a1a)', ice: 'linear-gradient(135deg,#d6f3ff,#6aa6d6)', random: 'linear-gradient(135deg,#ffd23c,#ff5a8a,#4fd1ff)' };
const crown = (cls = '') => `<svg class="crown ${cls}" viewBox="0 0 24 24"><path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11z" fill="#ffd23c" stroke="#8a5200" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const heart = (on) => `<svg class="heart ${on ? '' : 'off'}" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.800-8 11-8 11z" fill="#ff4a7a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const boomSvg = (c) => `<svg viewBox="0 0 48 48" class="bsv"><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#1a0a2a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const star = (on) => `<i class="star${on ? ' on' : ''}"></i>`;
const stars = (n, big) => `<span class="stars${big ? ' big' : ''}">${[0, 1, 2].map((i) => star(i < n)).join('')}</span>`;
const lvlChip = () => { const l = levelInfo(); return `<div class="lvchip"><b>LV ${l.level}</b><span class="xpbar"><i style="width:${Math.round(l.cur / l.need * 100)}%"></i></span></div>`; };
const campStars = () => (S().camp.stars || []).reduce((a, b) => a + (b || 0), 0);

Object.assign(UI, {
  notify(msg, kind) { this._nq = this._nq || []; this._nq.push({ msg, kind }); if (!this._nr) this._nextNote(); },
  _nextNote() { const n = (this._nq || []).shift(); if (!n) { this._nr = false; return; } this._nr = true; let r = $('#notes'); if (!r) { r = h('div', '', null, { id: 'notes' }); document.body.appendChild(r); } const e = h('div', 'note ' + (n.kind || ''), n.msg); r.appendChild(e); sfx(n.kind === 'level' ? 'levelup' : 'ach'); setTimeout(() => e.classList.add('out'), 2600); setTimeout(() => { e.remove(); this._nextNote(); }, 3000); },
  heroLine(hh) { return `<div class="perk">★ ${hh.perk}</div><div class="perk ult">⚡ <b>${ULTS[hh.id].name}</b> — ${ULTS[hh.id].desc}</div>`; },
  coinChip() { return h('div', 'chip', `<span class="coin"></span><span id="coinval">${S().coins}</span>`); },
  seg(label, obj, key, opts, onChange) { const r = h('div', 'row', `<span>${label}</span>`); const sg = h('div', 'seg'); opts.forEach(([val, t]) => { const b = h('button', obj[key] === val ? 'on' : '', t, { 'data-nav': 1 }); b.addEventListener('click', () => { obj[key] = val; save(); [...sg.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); sfx('click'); onChange && onChange(); }); sg.appendChild(b); }); r.appendChild(sg); return r; },

  // ================= menu =================
  menu() {
    const a = this.app, s = S(), hero = this.heroById(s.hero); const el = h('div', 'screen', null, { id: 'menu' }); const left = h('div', 'left');
    left.appendChild(h('div', '', `<div class="title">BOOMERANG<br>BRAWL</div><div class="sub" style="margin-top:.5em">Throw · Catch · Last one standing</div>`));
    left.appendChild(this.btn('▶ Play', 'primary big', () => (!s.tutorialDone ? this.show('tutintro') : this.show('modes'))));
    const g = h('div', 'menu-grid');
    const dailyReady = ensureDaily().list.some((c, i) => !ensureDaily().claimed[c.id] && dailyProgress(c) >= c.n);
    g.appendChild(this.btn('⭐ Campaign', 'gold', () => this.show('campaign')));
    g.appendChild(this.btn('🛒 Shop', '', () => this.show('shop', { tab: 'Boomerangs' })));
    g.appendChild(this.btn('Fighters', '', () => this.show('heroes', { mode: 'pick', ret: 'menu' })));
    const pb = this.btn('Profile' + (dailyReady ? ' <i class="dot"></i>' : ''), '', () => this.show('profile')); g.appendChild(pb);
    g.appendChild(this.btn('How to play', '', () => this.show('howto')));
    g.appendChild(this.btn('Settings', '', () => this.show('settings', { ret: 'menu' })));
    left.appendChild(g); el.appendChild(left);
    const tr = h('div', 'corner tr'); tr.appendChild(h('div', 'chip', lvlChip())); tr.appendChild(this.coinChip());
    const mu = h('button', 'btn small sq', S().settings.mute ? '🔇' : '🔊', { 'data-nav': 1 }); mu.addEventListener('click', () => { S().settings.mute = !S().settings.mute; applyVolumes(); save(); mu.textContent = S().settings.mute ? '🔇' : '🔊'; sfx('click'); }); tr.appendChild(mu); el.appendChild(tr);
    if (canInstall()) { const br = h('div', 'corner br'); br.appendChild(this.btn(IS_IOS ? '\u2B07 Add to Home Screen' : '\u2B07 Install app', 'gold small', () => promptInstall(this))); el.appendChild(br); }
    const bl = h('div', 'corner bl'); bl.appendChild(h('div', 'chip', `<span>${hero.name}</span><span class="dimc">${hero.title}</span>`)); el.appendChild(bl);
    return el;
  },
  tutintro() {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog'); d.appendChild(h('h2', '', 'Welcome!')); d.appendChild(h('p', 'lead', 'First time here? A 1-minute training match teaches you to throw, catch, dash and deflect.'));
    const b = h('div', 'btns'); b.appendChild(this.btn('▶ Start training', 'primary', () => this.app.startTutorial())); b.appendChild(this.btn('Skip', '', () => { S().tutorialDone = true; save(); this.show('modes'); })); d.appendChild(b); el.appendChild(d); return el;
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
    if (mode === 'classic') add(this.seg('Players', v, 'players', touch ? [[1, '1 Player']] : [[1, '1 Player'], [2, '2 Local']]));
    if (mode === 'classic') add(this.seg('Bots', v, 'bots', [[1, '1'], [2, '2'], [3, '3']]));
    if (mode === 'koth' || mode === 'bomb') add(this.seg('Bots', v, 'bots', [[mode === 'bomb' ? 2 : 1, mode === 'bomb' ? '2' : '1'], [2, mode === 'bomb' ? '2' : '2'], [3, '3']].filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i)));
    if (mode !== 'survival') add(this.seg('Bot skill', v, 'diff', [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']]));
    if (mode === 'classic' || mode === 'team') add(this.seg('First to', v, 'rounds', [[1, '1 win'], [2, '2 wins'], [3, '3 wins'], [5, '5 wins']]));
    add(this.seg('Arena events', s.settings, 'events', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]));
    const ar = h('div', 'row', '<span>Arena</span>'); const ao = h('div', 'arena-opt');
    [{ id: 'random', name: 'Random' }, ...ARENAS].forEach((A) => { const b = h('button', v.arena === A.id ? 'on' : '', `<i style="background:${ARENA_SW[A.id]}"></i>${A.name.replace(' ', '<br>')}`, { 'data-nav': 1 }); b.addEventListener('click', () => { v.arena = A.id; save(); [...ao.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); sfx('click'); }); ao.appendChild(b); });
    ar.appendChild(ao); ar.style.gridColumn = '1 / -1'; add(ar);
    // loadout
    const lr = h('div', 'row loadout', '<span>Boomerang</span>'); lr.style.gridColumn = '1 / -1'; const lt = h('div', 'ltypes'); const desc = h('div', 'ldesc', BOOM_TYPES[s.eq.type].desc);
    Object.entries(BOOM_TYPES).forEach(([id, t]) => { const has = owns('types', id); const b = h('button', 'ltype' + (s.eq.type === id ? ' on' : '') + (has ? '' : ' lk'), `${boomSvg(hex(t.color))}<span>${t.name}</span>${has ? '' : '<em>🔒</em>'}`, { 'data-nav': 1, style: `--tc:${hex(t.color)}` }); b.addEventListener('click', () => { if (!has) { sfx('deny'); this.toast(`Unlock ${t.name} in the Shop (${t.cost} coins) or by levelling up`); return; } equip('types', id); [...lt.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); desc.textContent = t.desc; sfx('click'); }); lt.appendChild(b); });
    lr.appendChild(lt); add(lr); const dr = h('div', '', '', { style: 'grid-column:1/-1' }); dr.appendChild(desc); add(dr);
    const hero = this.heroById(s.hero), hero2 = this.heroById(s.hero2);
    const hr = h('div', 'row', `<span>Fighter: <b>${hero.name}</b></span>`); hr.appendChild(this.btn('Change', 'small', () => this.show('heroes', { mode: 'pick', ret: 'setup', rp: { mode } }))); add(hr);
    if (mode === 'classic' && !touch && v.players === 2) { const h2 = h('div', 'row', `<span>P2: <b>${hero2.name}</b></span>`); h2.appendChild(this.btn('Change', 'small', () => this.show('heroes', { mode: 'pick2', ret: 'setup', rp: { mode } }))); add(h2); }
    add(h('div', 'note-line', { survival: 'Survive endless waves with 3 lives. Elite enemies appear every 5th wave.', koth: 'First to 100 points wins (4 pts/sec alone in the zone). KO\u2019d fighters respawn.', bomb: 'The holder of the bomb must hit a rival to pass it. Last one standing wins.', team: 'You + a bot partner (cyan) vs two bots (pink). Friendly fire is off.', classic: 'Hit anyone with a boomerang to KO. Sudden death shrinks the arena.' }[mode]));
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
    const b = h('div', 'btns'); b.appendChild(this.btn('▶ Start', 'primary', () => this.app.startStage(st.n))); b.appendChild(this.btn('Back', 'back', () => this.show('campaign'), { 'data-back': 1 })); d.appendChild(b); el.appendChild(d); return el;
  },
  // ================= shop =================
  shop(p) {
    const s = S(); const tab = p.tab || 'Boomerangs'; const el = h('div', 'screen page'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Shop')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const tabs = h('div', 'tabs'); Object.keys(SHOP).forEach((t) => { const b = h('button', 'tab' + (t === tab ? ' on' : ''), t, { 'data-nav': 1 }); b.addEventListener('click', () => { sfx('click'); this.show('shop', { tab: t }); }); tabs.appendChild(b); }); el.appendChild(tabs);
    const grid = h('div', 'shop-grid scroll');
    SHOP[tab].forEach((it) => {
      const own = owns(it.cat, it.id); const eqd = (it.cat === 'types' && s.eq.type === it.id) || (it.cat === 'skins' && s.eq.skin === it.id) || (it.cat === 'trails' && s.eq.trail === it.id) || (it.cat === 'emotes' && s.eq.emotes.includes(it.id)) || (it.cat === 'hats' && s.hats[s.hero] === it.id);
      let prev = ''; const col = it.color || 0xffffff;
      if (it.cat === 'types' || it.cat === 'skins') prev = `<div class="prev">${boomSvg(hex(col))}</div>`; else if (it.cat === 'trails') prev = `<div class="prev trailp" style="${it.rainbow ? 'background:linear-gradient(90deg,#f55,#fd5,#5f5,#5df,#a5f)' : `background:linear-gradient(90deg,transparent,${hex(col)})`}"></div>`; else if (it.cat === 'emotes') prev = `<div class="prev emo" style="color:${hex(col)}">${it.name}</div>`; else if (it.cat === 'heroes') prev = `<div class="prev"><img src="${portrait(it.hero, 'none')}"></div>`; else { const HE = { band: '🥋', party: '🥳', top: '🎩', halo: '😇', flower: '🌸', shades: '😎' }; prev = `<div class="prev hatp" style="font-size:calc(var(--u)*3.4)">${HE[it.id] || '🎩'}</div>`; }
      const c = h('div', 'card' + (eqd ? ' eq' : ''), `${prev}<h4>${it.cat === 'emotes' ? 'Emote' : it.name}</h4><p>${it.desc || ''}</p>`);
      let act;
      if (own) { if (it.cat === 'heroes') act = h('div', 'owned', '✓ Owned'); else act = this.btn(eqd ? '✓ Equipped' : 'Equip', eqd ? 'small gold' : 'small', () => { if (it.cat === 'emotes') toggleEmote(it.id); else if (it.cat === 'hats') { s.hats[s.hero] = it.id; save(); } else equip(it.cat, it.id); sfx('click'); this.show('shop', { tab }); }); }
      else act = this.btn(`<span class="coin"></span> ${it.cost}`, 'small ' + (s.coins >= it.cost ? 'primary' : 'locked'), () => { if (buy(it)) { sfx('buy'); if (it.cat !== 'hats' && it.cat !== 'heroes') equip(it.cat, it.id); this.show('shop', { tab }); } else { sfx('deny'); this.toast('Not enough coins - win matches and complete challenges!'); } });
      c.appendChild(act); grid.appendChild(c);
    });
    if (tab === 'Emotes') grid.appendChild(h('div', 'note-line', 'Equip up to 4 emotes. In a match press 1-4 or tap the chat button.', { style: 'grid-column:1/-1' }));
    el.appendChild(grid); return el;
  },
  // ================= profile =================
  profile() {
    const s = S(); const l = levelInfo(); const el = h('div', 'screen page'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Profile')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const body = h('div', 'body'); const left = h('div', 'panel prof-left scroll'); const right = h('div', 'panel prof-right scroll');
    const hero = this.heroById(s.hero);
    left.appendChild(h('div', 'lvbig', `<img src="${this.pic(hero)}"><div><b>Level ${l.level}</b><div class="xpbar big"><i style="width:${Math.round(l.cur / l.need * 100)}%"></i></div><small>${l.cur} / ${l.need} XP</small></div>`));
    const nx = Object.keys(LEVEL_REWARDS).map(Number).find((x) => x > l.level); if (nx) { const k = Object.keys(LEVEL_REWARDS[nx])[0]; left.appendChild(h('div', 'note-line', `Next reward at level ${nx}: ${LEVEL_REWARDS[nx][k]} (${k.slice(0, -1)})`)); }
    left.appendChild(h('h4', '', 'Daily challenges')); const d = ensureDaily();
    d.list.forEach((c, i) => { const pr = dailyProgress(c); const done = pr >= c.n, claimed = d.claimed[c.id]; const row = h('div', 'daily' + (done ? ' done' : ''), `<div><b>${c.text}</b><span class="xpbar"><i style="width:${Math.round(pr / c.n * 100)}%"></i></span><small>${pr}/${c.n} · +${c.coins} coins · +${c.xp} XP</small></div>`); row.appendChild(claimed ? h('span', 'owned', '✓') : this.btn('Claim', 'small ' + (done ? 'gold' : 'locked'), () => { if (claimDaily(i)) { sfx('buy'); this.show('profile'); } else sfx('deny'); })); left.appendChild(row); });
    left.appendChild(h('h4', '', 'Stats')); left.appendChild(h('div', 'stat-grid', [['KOs', s.stats.ko], ['Catches', s.stats.catch], ['Parries', s.stats.deflect], ['Wins', s.stats.win], ['Matches', s.played], ['Best wave', s.best.survival || 0], ['Stars', `${campStars()}/${MAX_STARS}`], ['Coins earned', s.totalCoins || 0]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')));
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
    const s = S(); const el = h('div', 'screen center'); const d = h('div', 'panel dialog results' + (p.won ? '' : ' lose'));
    const title = p.tutorial ? 'Training complete!' : p.stage ? (p.won ? 'Stage clear!' : 'Stage failed') : p.mode === 'survival' ? 'Game over' : (p.won ? 'Victory!' : 'Defeat');
    d.appendChild(h('h2', '', title));
    if (p.stage) { d.appendChild(h('div', 'sub', `Stage ${p.stage.n} · ${p.stage.name}`)); d.appendChild(h('div', 'rstars', stars(p.stars, true))); if (p.won && p.stars > p.prevStars) d.appendChild(h('div', 'newbest', p.firstClear ? 'FIRST CLEAR!' : 'NEW BEST!')); }
    else if (p.winnerName && p.mode !== 'survival') d.appendChild(h('div', 'sub', `${p.winnerName} ${p.winnerName === 'Your team' ? 'win' : p.winnerName === 'Rival team' ? 'win' : 'wins'} the match`));
    if (p.rows.length) d.appendChild(h('div', 'stat-line', p.rows.map(([k, v]) => `<div><span>${k}</span>${v}</div>`).join('')));
    // rewards + xp bar
    const l0 = p.lvBefore, l1 = p.lv; const lv0 = l0.level; const pct0 = Math.round(l0.cur / l0.need * 100), pct1 = l1.level > lv0 ? 100 : Math.round(l1.cur / l1.need * 100);
    const xr = h('div', 'xprow', `<b>LV ${lv0}</b><span class="xpbar big"><i style="width:${pct0}%"></i></span><span class="gain">+${p.xp} XP</span><span class="gain gold"><span class="coin"></span> +${p.coins}</span>`); d.appendChild(xr);
    requestAnimationFrame(() => requestAnimationFrame(() => { const i = xr.querySelector('.xpbar i'); if (i) i.style.width = pct1 + '%'; }));
    (p.ups || []).forEach((u) => d.appendChild(h('div', 'levelup', `LEVEL ${u.level}! +${u.coins} coins${u.unlock ? ' · unlocked ' + u.unlock : ''}`)));
    const b = h('div', 'btns');
    if (p.tutorial) { b.appendChild(this.btn('Play ▶', 'primary', () => this.app.quitToMenu(true))); }
    else { if (p.stage && p.won && p.stage.n < STAGES.length) b.appendChild(this.btn('Next stage ▶', 'primary', () => this.app.startStage(p.stage.n + 1))); b.appendChild(this.btn(p.stage ? (p.won ? '↻ Replay' : '↻ Retry') : 'Rematch ▶', p.stage && p.won ? '' : 'primary', () => this.app.rematch())); if (p.stage) b.appendChild(this.btn('Campaign', '', () => { this.app.quitToMenu(); this.show('campaign'); })); b.appendChild(this.btn('Menu', '', () => this.app.quitToMenu())); }
    d.appendChild(b); el.appendChild(d); return el;
  },
  introTitle(m, g) { if (!m) return ''; if (m.tutorial) return 'TRAINING'; if (m.stage) return 'STAGE ' + m.stage.n; return { classic: 'ROUND ' + m.round, team: 'ROUND ' + m.round, survival: 'SURVIVAL', koth: 'KING OF THE HILL', bomb: 'BOMB TAG' }[m.mode] || 'GET READY'; },
  introSub(m, g) { if (!m) return ''; if (m.tutorial) return 'Follow the tips!'; if (m.stage) return m.stage.name; const an = ARENAS.find((a) => a.id === g.arenaId).name; return (m.mode === 'classic' || m.mode === 'team') ? an + ' · first to ' + m.need : an; },
  // ================= HUD =================
  hudStart(game) {
    const r = this.hudRoot; r.innerHTML = ''; this.hudCache = {}; this.emoteClose(); this.tutorialHide(); if (!game || game.mode === 'attract') return; this.hudGame = game;
    const top = h('div', 'top'); const l = h('div', 'grp', null, { id: 'h-pl' }); const c = h('div', 'mid', '', { id: 'h-mid' }); const rr = h('div', 'grp');
    rr.appendChild(h('div', 'chip', '', { id: 'h-time' })); const pb = h('button', 'btn small pbtn', '❚❚', { id: 'h-pause' }); pb.addEventListener('click', () => this.app.pause()); rr.appendChild(pb);
    top.appendChild(l); top.appendChild(c); top.appendChild(rr); r.appendChild(top); r.appendChild(h('div', '', '', { id: 'bossbar' }));
  },
  hudUpdate(game) {
    if (!game || game.mode === 'attract' || !this.hudCache) return; const m = this.app.match; const ms = game.mstate(); const touch = Input.touch.enabled;
    const shown = game.fighters.slice(0, game.nPlayers);
    this.hudSet('h-pl', shown.map((q) => { const lives = q.def.lives || 1; const hearts = lives > 1 && lives < 90 ? `<span class="hearts">${Array.from({ length: Math.max(lives, q.lives) }, (_, i) => heart(i < q.lives)).join('')}</span>` : ''; const rdy = q.ult >= 100; return `<div class="pchip ${q.alive || q.respawnT > 0 ? '' : 'dead'}" style="--pc:${hex(q.color)}"><img src="${this.pic(q.hero, q.def.hat)}"><div class="pc-in"><span class="nm">${q.name}</span>${hearts}<span class="w">${crown().repeat(q.wins || 0)}</span><span class="ultbar ${rdy ? 'rdy' : ''}"><i style="width:${Math.round(q.ult)}%"></i></span></div>${!q.isBot && rdy && !touch ? '<span class="ultk">ULT [R]</span>' : ''}</div>`; }).join(''));
    let mid = ''; const rt = ms.type;
    if (m && m.tutorial) mid = 'Training'; else if (m && m.stage) mid = `<b>${m.stage.n}</b> ${m.stage.name.replace('Boss: ', '')}`; else if (game.sudden) mid = '<span style="color:#ff5a5a">SUDDEN DEATH</span>'; else mid = (rt === 'elim' ? `Round ${game.round}` : '');
    if (rt === 'koth') { const teams = [...new Set(game.fighters.slice(0, game.nPlayers).map((f) => f.team))]; mid = `<div class="koth">${teams.map((t) => `<div class="kb ${ms.owner === t ? 'own' : ''}" style="--pc:${hex(game.teamColor(t))}"><i style="width:${Math.min(100, (ms.scores[t] || 0) / ms.target * 100)}%"></i><b>${Math.floor(ms.scores[t] || 0)}</b></div>`).join('')}</div><div class="kz ${ms.contested ? 'c' : ''}">${ms.contested ? 'CONTESTED' : 'Hill moves in ' + Math.ceil(ms.zoneIn) + 's'}</div>`; }
    else if (rt === 'bomb') { const hd = ms.holder; mid = `<div class="bombbar"><span>💣 ${hd ? hd.name : '...'}</span><i style="width:${Math.round(ms.fuse / ms.fuseMax * 100)}%" class="${ms.fuse < 4 ? 'hot' : ''}"></i></div>`; }
    else if (rt === 'survival') mid = `<b>WAVE ${ms.wave}</b> · ${ms.left} left${game.rules.waves ? ' / ' + game.rules.waves : ''}`;
    this.hudSet('h-mid', mid);
    const tl = rt === 'koth' ? '' : (game.sudden ? '☠' : (game.rules.sudden ? fmtTime(Math.max(0, 48 - game.playTime)) : fmtTime(game.playTime)));
    this.hudSet('h-time', tl);
    const bb = $('#bossbar'); if (bb) { const b = ms.boss; this.hudSet('bossbar', b ? `<div class="bn">${b.name}</div><div class="bhp">${Array.from({ length: b.max }, (_, i) => `<i class="${i < b.hp ? 'on' : ''}"></i>`).join('')}</div>` : ''); }
  },
  hudSet(id, html) { const c = this.hudCache; if (!c) return; if (c[id] !== html) { c[id] = html; const e = document.getElementById(id); if (e) e.innerHTML = html; } },
  // ================= tutorial =================
  tutorialShow(t) {
    const touch = Input.touch.enabled; const steps = [
      [touch ? 'Drag the <b>left stick</b> to move' : 'Move with <kbd>W A S D</kbd> or arrow keys', 'Walk around for a second'],
      [touch ? 'Hold &amp; <b>drag the boomerang stick</b>, release to throw' : 'Aim with the <b>mouse</b>, hold <b>click</b> (or <kbd>F</kbd>) and release to throw', 'Hold longer = longer, faster throw. A quick tap auto-aims.'],
      ['It comes back! <b>Walk into it</b> to catch it', 'No boomerang? You cannot throw. Catch to reload.'],
      [touch ? 'Tap <b>DASH</b> to dodge' : 'Press <kbd>Space</kbd> to <b>dash</b>', 'Dashing makes you invulnerable for a moment'],
      [touch ? 'Tap <b>DEFLECT</b>' : 'Press <kbd>E</kbd> to <b>deflect</b>', 'Time it right to bounce boomerangs back at the thrower'],
      ['Now <b>KO the dummy!</b>', 'One hit knocks a rival out. Power-ups and your ultimate (<b>' + (touch ? '⚡ button' : 'R') + '</b>) help too.'],
    ];
    let c = $('#tut'); if (!c) { c = h('div', '', '', { id: 'tut' }); document.body.appendChild(c); }
    const s = steps[Math.min(t.step, steps.length - 1)]; c.className = 'show'; c.innerHTML = `<div class="tt">${s[0]}</div><div class="ts">${s[1]}</div><div class="td">${steps.map((_, i) => `<i class="${i < t.step ? 'done' : i === t.step ? 'cur' : ''}"></i>`).join('')}</div>`;
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
  const first = grid.firstChild; grid.insertBefore(tog('Mute all audio', 'mute', applyVolumes), first); grid.insertBefore(tog('Screen flashes', 'flash', () => { gfx.flashOn = !!s.flash; }), first);
  grid.insertBefore(this.seg('Arena events', s, 'events', [['off', 'Off'], ['some', 'Some'], ['wild', 'Wild']]), first);
  const tr = h('div', 'row', '<span>Training</span>'); tr.appendChild(this.btn('Replay tutorial', 'small', () => { if (p.ret === 'pause') this.app.quitToMenu(); this.app.startTutorial(); })); grid.appendChild(tr);
  return el;
};
UI.pause = ((orig) => function () { const el = orig.call(this); return el; })(UI.pause);
