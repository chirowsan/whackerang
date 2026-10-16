// DOM UI: menu, setup, fighters, settings, HUD, dialogs.
import { S, save, resetSave } from './save.js';
import { HEROES, HATS, ARENAS, POWERUPS, PLAYER_COLORS } from './data.js';
import { sfx, applyVolumes } from './audio.js';
import { setQuality, gfx } from './gfx.js';
import { Input } from './input.js';
import { portrait } from './portraits.js';

export const $ = (s, r = document) => r.querySelector(s);
export function h(tag, cls, kids, attrs) {
  const e = document.createElement(tag); if (cls) e.className = cls;
  if (attrs) for (const k in attrs) { if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
  if (kids !== undefined && kids !== null) { if (typeof kids === 'string') e.innerHTML = kids; else (Array.isArray(kids) ? kids : [kids]).forEach((k) => k && e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k)); }
  return e;
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const crown = (cls = '') => `<svg class="crown ${cls}" viewBox="0 0 24 24"><path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11z" fill="#ffd23c" stroke="#8a5200" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const ARENA_SW = { dojo: 'linear-gradient(135deg,#d7edb0,#a77d52)', rooftop: 'linear-gradient(135deg,#252a5c,#ff2bd6)', jungle: 'linear-gradient(135deg,#8ea46a,#ff7a1a)', ice: 'linear-gradient(135deg,#d6f3ff,#6aa6d6)', random: 'linear-gradient(135deg,#ffd23c,#ff5a8a,#4fd1ff)' };

const PUD = {"extra": "Carry +1 boomerang (up to 3)", "triple": "Next throws fan out in 3", "giant": "Giant boomerang: bigger hit, smashes crates", "fire": "Explodes on hit or bounce", "homing": "Boomerang curves to the nearest rival", "shield": "Absorbs one hit", "speed": "Run 40% faster"};
export const UI = {
  app: null, root: null, cur: null, focusEl: null, hudCache: null,
  init(app) {
    this.app = app; this.root = $('#ui'); this.hudRoot = $('#hud'); this.bannerRoot = $('#banner');
    document.addEventListener('pointerdown', () => { Input.lastUsed = 'touch-or-mouse'; }, true);
    Input.onAnyKey = (e) => this.onKey(e);
  },
  clear() { this.root.innerHTML = ''; this.cur = null; this.focusEl = null; },
  show(name, props) { this.clear(); this.cur = name; const el = this[name](props || {}); this.root.appendChild(el); this.setFocus(this.navList()[0] || null); return el; },
  toast(msg, ms = 1800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), ms); },
  banner(b1, b2, color) { const b = this.bannerRoot; b.innerHTML = ''; const d = h('div', 'b1', b1); if (color) d.style.color = color; b.appendChild(d); if (b2) b.appendChild(h('div', 'b2', b2)); clearTimeout(this._bt); this._bt = setTimeout(() => (b.innerHTML = ''), 1400); },
  navList() { return [...this.root.querySelectorAll('[data-nav]')].filter((e) => e.offsetParent !== null && !e.disabled); },
  setFocus(e) { if (this.focusEl) this.focusEl.classList.remove('focus'); this.focusEl = e; if (e) { e.classList.add('focus'); e.scrollIntoView && e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } },
  navMove(dx, dy) {
    const list = this.navList(); if (!list.length) return; if (!this.focusEl || !list.includes(this.focusEl)) { this.setFocus(list[0]); return; }
    const r0 = this.focusEl.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2; let best = null, bs = 1e9;
    for (const e of list) { if (e === this.focusEl) continue; const r = e.getBoundingClientRect(), x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy; const along = x * dx + y * dy; if (along <= 2) continue; const perp = Math.abs(x * dy) + Math.abs(y * dx); const sc = along + perp * 2.2; if (sc < bs) { bs = sc; best = e; } }
    if (best) { this.setFocus(best); sfx('click'); }
  },
  activate() { if (this.focusEl) this.focusEl.click(); },
  back() { const b = this.root.querySelector('[data-back]'); if (b) b.click(); },
  onKey(e) {
    if (!this.cur) return; const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') this.navMove(-1, 0); else if (k === 'ArrowRight' || k === 'KeyD') this.navMove(1, 0); else if (k === 'ArrowUp' || k === 'KeyW') this.navMove(0, -1); else if (k === 'ArrowDown' || k === 'KeyS') this.navMove(0, 1);
    else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { this.activate(); e.preventDefault(); } else if (k === 'Backspace') this.back();
  },
  padMenu(p) { if (!this.cur) return; if (p.left) this.navMove(-1, 0); if (p.right) this.navMove(1, 0); if (p.up) this.navMove(0, -1); if (p.down) this.navMove(0, 1); if (p.ok) this.activate(); if (p.back) this.back(); },
  btn(label, cls, fn, extra = {}) { const b = h('button', 'btn ' + (cls || ''), label, { 'data-nav': 1, ...extra }); b.addEventListener('click', (e) => { sfx(cls && cls.includes('back') ? 'back' : 'click'); fn(e); }); b.addEventListener('pointerenter', () => this.setFocus(b)); return b; },
  backBtn(fn) { return this.btn('◀ Back', 'small back', fn, { 'data-back': 1 }); },
  coinChip() { return h('div', 'chip', `<span class="coin"></span><span id="coinval">${S().coins}</span>`); },
  heroById(id) { return HEROES.find((x) => x.id === id) || HEROES[0]; },
  pic(hero, hat) { return portrait(hero, hat || S().hats[hero.id] || 'none'); },

  // ============ screens ============
  menu() {
    const a = this.app, s = S(), hero = this.heroById(s.hero);
    const el = h('div', 'screen', null, { id: 'menu' }); const left = h('div', 'left');
    left.appendChild(h('div', '', `<div class="title">BOOMERANG<br>BRAWL</div><div class="sub" style="margin-top:.5em">Throw · Catch · Last one standing</div>`));
    left.appendChild(this.btn('▶ Play', 'primary', () => this.show('setup')));
    const g = h('div', 'menu-grid');
    g.appendChild(this.btn('Fighters', 'gold', () => this.show('heroes', { mode: 'pick', ret: 'menu' })));
    g.appendChild(this.btn('How to play', '', () => this.show('howto')));
    g.appendChild(this.btn('Settings', '', () => this.show('settings', { ret: 'menu' })));
    g.appendChild(this.btn('⛶ Full', '', () => a.toggleFullscreen()));
    left.appendChild(g); el.appendChild(left);
    const tr = h('div', 'corner tr'); tr.appendChild(this.coinChip()); el.appendChild(tr);
    const bl = h('div', 'corner bl'); bl.appendChild(h('div', 'chip', `<img src="${this.pic(hero)}" style="width:${2.6}em;height:${2.6}em;border-radius:50%;background:rgba(255,255,255,.12)"><span>${hero.name}</span>`)); el.appendChild(bl);
    return el;
  },
  setup() {
    const s = S(), v = s.setup; const el = h('div', 'screen page'); const hd = h('header');
    hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'Brawl Setup')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const grid = h('div', 'panel vs-grid scroll');
    const segr = (label, key, opts) => { const r = h('div', 'row', `<span>${label}</span>`); const sg = h('div', 'seg'); opts.forEach(([val, t]) => { const b = h('button', v[key] === val ? 'on' : '', t, { 'data-nav': 1 }); b.addEventListener('click', () => { v[key] = val; save(); sfx('click'); [...sg.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); }); sg.appendChild(b); }); r.appendChild(sg); grid.appendChild(r); };
    const touch = this.app.isTouchDevice();
    segr('Players', 'players', touch ? [[1, '1 Player']] : [[1, '1 Player'], [2, '2 Local']]);
    segr('Bots', 'bots', [[1, '1'], [2, '2'], [3, '3']]);
    segr('Bot skill', 'diff', [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']]);
    segr('First to', 'rounds', [[1, '1 win'], [2, '2 wins'], [3, '3 wins'], [5, '5 wins']]);
    const ar = h('div', 'row', '<span>Arena</span>'); const ao = h('div', 'arena-opt');
    [{ id: 'random', name: 'Random' }, ...ARENAS].forEach((A) => { const b = h('button', v.arena === A.id ? 'on' : '', `<i style="background:${ARENA_SW[A.id]}"></i>${A.name.replace(' ', '<br>')}`, { 'data-nav': 1 }); b.addEventListener('click', () => { v.arena = A.id; save(); sfx('click'); [...ao.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); }); ao.appendChild(b); });
    ar.appendChild(ao); ar.style.gridColumn = '1 / -1'; grid.appendChild(ar);
    const hero = this.heroById(s.hero), hero2 = this.heroById(s.hero2);
    const hr = h('div', 'row', `<span>P1: <b>${hero.name}</b></span>`); hr.appendChild(this.btn('Change', 'small', () => this.show('heroes', { mode: 'pick', ret: 'setup' }))); grid.appendChild(hr);
    if (!touch && v.players === 2) { const h2 = h('div', 'row', `<span>P2: <b>${hero2.name}</b></span>`); h2.appendChild(this.btn('Change', 'small', () => this.show('heroes', { mode: 'pick2', ret: 'setup' }))); grid.appendChild(h2); }
    grid.appendChild(h('div', '', 'Hit anyone with a boomerang to KO. Sudden death shrinks the arena. +10 coins per round won.', { style: 'grid-column:1/-1;color:var(--dim);font-size:calc(var(--u)*.95);font-weight:700' }));
    el.appendChild(grid);
    const go = this.btn('▶ START BRAWL', 'primary', () => this.app.startMatch()); go.style.alignSelf = 'flex-end'; el.appendChild(go);
    return el;
  },
  heroes(p) {
    const s = S(); const key = p.mode === 'pick2' ? 'hero2' : 'hero'; let sel = s[key]; const el = h('div', 'screen page'); const hd = h('header');
    hd.appendChild(this.backBtn(() => { save(); this.show(p.ret || 'menu'); })); hd.appendChild(h('h2', '', p.mode === 'pick2' ? 'Player 2 Fighter' : 'Choose Fighter')); hd.appendChild(this.coinChip()); el.appendChild(hd);
    const body = h('div', 'body'); const list = h('div', 'hero-list scroll'); const det = h('div', 'panel hero-detail scroll'); body.appendChild(list); body.appendChild(det); el.appendChild(body);
    const owned = (hh) => s.unlockedHeroes.includes(hh.id);
    const render = () => {
      list.innerHTML = '';
      HEROES.forEach((hh) => {
        const c = h('div', 'hero-card' + (sel === hh.id ? ' sel' : ''), `<img src="${this.pic(hh)}"><div class="nm">${hh.name}</div>`, { 'data-nav': 1, style: `--hc:${hex(hh.color)}` });
        if (!owned(hh)) c.appendChild(h('div', 'lock', `🔒<span style="display:flex;align-items:center;gap:.3em"><span class="coin"></span>${hh.cost}</span>`));
        c.addEventListener('click', () => { sel = hh.id; sfx('click'); render(); }); c.addEventListener('pointerenter', () => this.setFocus(c)); list.appendChild(c);
      });
      const hh = this.heroById(sel); det.innerHTML = '';
      det.appendChild(h('h3', '', hh.name)); det.appendChild(h('div', '', hh.blurb, { style: 'color:var(--dim);font-weight:700;font-size:calc(var(--u)*1)' }));
      det.appendChild(h('div', 'perk', '★ ' + hh.perk));
      const hats = h('div', 'hats'); const cur = s.hats[hh.id] || 'none';
      HATS.forEach((ht) => { const has = s.unlockedHats.includes(ht.id); const b = h('button', 'hat' + (cur === ht.id ? ' on' : '') + (has ? '' : ' lk'), `${ht.name}${has ? '' : `<small><span class="coin"></span>${ht.cost}</small>`}`, { 'data-nav': 1 });
        b.addEventListener('click', () => { if (!owned(hh)) { sfx('deny'); this.toast('Unlock the fighter first'); return; } if (!has) { if (s.coins >= ht.cost) { s.coins -= ht.cost; s.unlockedHats.push(ht.id); sfx('buy'); $('#coinval').textContent = s.coins; } else { sfx('deny'); this.toast('Not enough coins - win some rounds!'); return; } } s.hats[hh.id] = ht.id; save(); sfx('click'); render(); });
        hats.appendChild(b); });
      det.appendChild(h('div', '', 'Hats', { style: 'font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:calc(var(--u)*.85);color:var(--dim)' })); det.appendChild(hats);
      const act = owned(hh) ? this.btn(s[key] === hh.id ? '✓ Selected' : 'Select', 'primary', () => { s[key] = hh.id; save(); render(); sfx('click'); }) : this.btn(`Unlock · ${hh.cost}`, s.coins >= hh.cost ? 'gold' : 'locked', () => { if (s.coins >= hh.cost) { s.coins -= hh.cost; s.unlockedHeroes.push(hh.id); save(); sfx('buy'); render(); $('#coinval').textContent = s.coins; } else { sfx('deny'); this.toast('Not enough coins - win some rounds!'); } });
      det.appendChild(act);
    };
    render(); return el;
  },
  settings(p) {
    const s = S().settings; const el = h('div', 'screen page'); const hd = h('header');
    hd.appendChild(this.backBtn(() => { save(); if (p.ret === 'pause') this.show('pause'); else this.show(p.ret || 'menu'); })); hd.appendChild(h('h2', '', 'Settings')); el.appendChild(hd);
    const grid = h('div', 'panel set-grid scroll');
    const slider = (label, key, apply) => { const r = h('div', 'row', `<span>${label}</span>`); const i = h('input', '', null, { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] }); i.addEventListener('input', () => { s[key] = +i.value; apply && apply(); }); i.addEventListener('change', () => { save(); sfx('click'); }); r.appendChild(i); grid.appendChild(r); return i; };
    const toggle = (label, key, apply) => { const r = h('div', 'row', `<span>${label}</span>`); const t = h('button', 'tog' + (s[key] ? ' on' : ''), null, { 'data-nav': 1 }); t.addEventListener('click', () => { s[key] = !s[key]; t.classList.toggle('on', s[key]); save(); sfx('click'); apply && apply(); }); r.appendChild(t); grid.appendChild(r); };
    const segr = (label, key, opts, apply) => { const r = h('div', 'row', `<span>${label}</span>`); const sg = h('div', 'seg'); opts.forEach(([v, t]) => { const b = h('button', s[key] === v ? 'on' : '', t, { 'data-nav': 1 }); b.addEventListener('click', () => { s[key] = v; [...sg.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); save(); sfx('click'); apply && apply(); }); sg.appendChild(b); }); r.appendChild(sg); grid.appendChild(r); };
    slider('Music', 'music', applyVolumes); slider('Sound FX', 'sfx', applyVolumes);
    toggle('Screen shake', 'shake'); toggle('Hit-stop freeze', 'hitstop'); toggle('Vibration', 'vibrate'); toggle('Aim assist', 'aimAssist');
    segr('Graphics', 'quality', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Med'], ['low', 'Low']], () => setQuality(s.quality));
    toggle('Bloom glow', 'bloom', () => setQuality(s.quality));
    segr('Touch controls', 'touch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], () => this.app.applyTouch());
    toggle('Left-handed layout', 'leftHanded', () => this.app.applyTouch());
    slider('Control size', 'ctrlScale', () => this.app.applyTouch()); const cs = grid.lastChild.querySelector('input'); cs.min = 0.7; cs.max = 1.5; cs.step = 0.05;
    const rr = h('div', 'row', '<span>Progress</span>'); rr.appendChild(this.btn('Reset save', 'small', () => { if (confirm('Erase coins, unlocks and settings?')) { resetSave(); this.app.reloadSettings(); this.show('settings', p); } })); grid.appendChild(rr);
    const fr = h('div', 'row', '<span>Display</span>'); fr.appendChild(this.btn('Fullscreen', 'small', () => this.app.toggleFullscreen())); grid.appendChild(fr);
    const hr = h('div', 'row', '<span>Install</span>'); hr.appendChild(h('span', '', 'Chrome ⋮ → <b>Add to Home screen</b> for a full-screen app', { style: 'font-size:calc(var(--u)*.9);opacity:.8;text-align:right' })); grid.appendChild(hr);
    const br = h('div', 'row', '<span>Build</span>'); br.appendChild(h('span', '', this.app.BUILD + ' · ' + gfx.quality + ' ' + gfx.dpr + 'x', { style: 'font-size:calc(var(--u)*.9);opacity:.8' })); grid.appendChild(br);
    el.appendChild(grid); return el;
  },
  howto() {
    const el = h('div', 'screen page'); const hd = h('header'); hd.appendChild(this.backBtn(() => this.show('menu'))); hd.appendChild(h('h2', '', 'How to play')); el.appendChild(hd);
    const pn = h('div', 'panel howto scroll');
    pn.innerHTML = `<div><h4>Goal</h4><p>Throw your boomerang to knock out rivals. <b>One hit = KO.</b> Your boomerang flies a curve, bounces off walls and crates, then <b>returns to you</b> — walk into it to catch it and reload. Last fighter standing wins the round; first to the target wins the match. After 48s the arena crumbles in!</p>
      <h4 style="margin-top:.8em">Controls</h4><ul><li><b>Touch:</b> left stick = move · right side: <b>drag &amp; release</b> to aim-throw (hold to charge), <b>quick tap</b> = auto-aim throw · ▶▶ dash · 🛡 deflect</li><li><b>Keyboard P1:</b> <span class="kbd">WASD</span> move · mouse aim + click (or <span class="kbd">F</span> to throw) · <span class="kbd">Space</span> dash · <span class="kbd">E</span>/right-click deflect</li><li><b>P2:</b> <span class="kbd">Arrows</span> · <span class="kbd">Enter</span> throw · <span class="kbd">RShift</span> dash · <span class="kbd">/</span> deflect</li><li><b>Gamepad:</b> left stick move · right stick aim &amp; release · A dash · X deflect</li></ul></div>
      <div><h4>Power-ups</h4><div class="legend">${Object.entries(POWERUPS).map(([k, v]) => `<div><i class="pudot" style="background:${hex(v.color)}"></i> <span><b>${v.name}</b> <small>${PUD[k]}</small></span></div>`).join('')}</div>
      <p style="margin-top:.7em"><b>Dash</b> makes you briefly invulnerable and shoves crates. <b>Deflect</b> (timing!) bounces a boomerang back at its thrower. <b>Charge</b> a throw for a longer, faster arc. Watch the floor: spikes, lava, conveyors and cracking tiles.</p></div>`;
    el.appendChild(pn); return el;
  },
  pause() {
    const a = this.app; const el = h('div', 'screen center'); const d = h('div', 'panel dialog'); d.appendChild(h('h2', '', 'Paused'));
    const b = h('div', 'btns', null, { style: 'flex-direction:column;align-items:stretch;width:100%' });
    b.appendChild(this.btn('▶ Resume', 'primary', () => a.resume())); b.appendChild(this.btn('↻ Restart round', '', () => a.restartRound())); b.appendChild(this.btn('Settings', '', () => this.show('settings', { ret: 'pause' })));
    b.appendChild(this.btn('⛶ Fullscreen', '', () => a.toggleFullscreen())); b.appendChild(this.btn('Quit to menu', 'hot', () => a.quitToMenu()));
    d.appendChild(b); el.appendChild(d); return el;
  },
  roundEnd(p) {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog wide'); const w = p.winner;
    d.appendChild(h('h2', '', w ? `${w.name} wins the round!` : 'Draw!'));
    const tbl = h('div', 'score');
    p.players.forEach((q) => { tbl.appendChild(h('div', 'srow' + (w && w.name === q.name ? ' win' : ''), `<img src="${q.img}"><b style="color:${hex(q.color)}">${q.name}</b><span class="pips">${Array.from({ length: p.need }, (_, i) => (i < q.wins ? crown('on') : '<i class="cp"></i>')).join('')}</span>`)); });
    d.appendChild(tbl); d.appendChild(h('div', '', `+${p.coins} coins`, { style: 'color:#ffd23c;font-weight:900' }));
    const b = h('div', 'btns'); b.appendChild(this.btn('Next round ▶', 'primary', () => this.app.nextRound())); b.appendChild(this.btn('Menu', '', () => this.app.quitToMenu())); d.appendChild(b); el.appendChild(d); return el;
  },
  matchEnd(p) {
    const el = h('div', 'screen center'); const d = h('div', 'panel dialog wide' + (p.humanWon ? '' : ' lose')); const w = p.winner;
    d.appendChild(h('div', 'bigcrown', `${crown('big')}<img src="${p.img}">`)); d.appendChild(h('h2', '', `${w.name} wins the match!`));
    const tbl = h('div', 'score'); p.players.forEach((q) => tbl.appendChild(h('div', 'srow' + (w.name === q.name ? ' win' : ''), `<img src="${q.img}"><b style="color:${hex(q.color)}">${q.name}</b><span class="pips">${Array.from({ length: p.need }, (_, i) => (i < q.wins ? crown('on') : '<i class="cp"></i>')).join('')}</span>`))); d.appendChild(tbl);
    d.appendChild(h('div', '', `+${p.coins} coins · total ${S().coins}`, { style: 'color:#ffd23c;font-weight:900' }));
    const b = h('div', 'btns'); b.appendChild(this.btn('Rematch ▶', 'primary', () => this.app.startMatch())); b.appendChild(this.btn('Menu', '', () => this.app.quitToMenu())); d.appendChild(b); el.appendChild(d); return el;
  },
  // ============ HUD ============
  hudStart(game) {
    const r = this.hudRoot; r.innerHTML = ''; this.hudCache = {}; if (!game || game.mode === 'attract') return;
    const top = h('div', 'top'); const l = h('div', 'grp', null, { id: 'h-pl' }); const c = h('div', 'lvlname', '', { id: 'h-name' }); const rr = h('div', 'grp');
    rr.appendChild(h('div', 'chip', '', { id: 'h-time' })); const pb = h('button', 'btn small pbtn', '❚❚', { id: 'h-pause' }); pb.addEventListener('click', () => this.app.pause()); rr.appendChild(pb);
    top.appendChild(l); top.appendChild(c); top.appendChild(rr); r.appendChild(top);
  },
  hudSet(id, html) { const c = this.hudCache; if (!c) return; if (c[id] !== html) { c[id] = html; const e = document.getElementById(id); if (e) e.innerHTML = html; } },
  hudUpdate(game) {
    if (!game || game.mode === 'attract' || !this.hudCache) return;
    this.hudSet('h-pl', game.fighters.map((q) => `<div class="pchip ${q.alive ? '' : 'dead'}" style="--pc:${hex(q.color)}"><img src="${this.pic(q.hero, q.def.hat)}"><span>${q.name}</span><span class="w">${q.wins ? '♛'.repeat(q.wins) : ''}</span><span class="am">${'●'.repeat(Math.max(0, q.ammo))}${'○'.repeat(Math.max(0, q.maxAmmo - q.ammo))}</span></div>`).join(''));
    this.hudSet('h-name', game.sudden ? '<span style="color:#ff5a5a">SUDDEN DEATH</span>' : `Round ${game.round}`);
    this.hudSet('h-time', game.sudden ? '☠' : fmtTime(Math.max(0, 48 - game.playTime)));
  },
};
