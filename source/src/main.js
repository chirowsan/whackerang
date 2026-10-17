import { THREE, gfx, initGfx, setQuality, resize, fitCamera, followCam, updateGfx, render, adaptRes, isCoarse, shake, toon } from './gfx.js';
import { S, save, loadSave } from './save.js';
import { HEROES, HATS, ARENAS, MODES, PLAYER_COLORS, PERSONAS, EMOTES, ULTS, TRAILS } from './data.js';
import { STAGES, stageSetup, rulesFor, evalStars } from './modes.js';
import { track, addCoins, addXp, levelInfo, setNotifier, dailySnapshot, ensureDaily } from './progress.js';
import { initAudio, resumeAudio, applyVolumes, sfx, music, AU, setIntensity, setTempo } from './audio.js';
import { Input, initInput, initTouch } from './input.js';
import { Bot } from './ai.js';
import { fx } from './fx.js';
import { Game } from './game.js';
import { UI, $ } from './ui.js';
import './ui2.js';
import { buildFighter, buildBoomerang } from './models.js';
import { makePortraits, portrait, snap } from './portraits.js';
import { faceDebugCanvas } from './faces.js';
import { resolveMutator } from './mutators.js';
import { pick, shuffle, setArenaSize } from './util.js';
import { initHead, initSW, initInstall, initWakeLock, initFullscreenFirstTap, initHardening, iosAudioKick, IS_IOS, IS_APP, isStandalone, showIosHint, pwa } from './pwa.js';

const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const STEP = 1 / 60;
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const app = {
  BUILD, game: null, mode: 'menu', paused: false, acc: 0, simT: 0, hudT: 0, match: null, ready: false, frames: 0,
  isTouchDevice() { return isCoarse() || ('ontouchstart' in window && !matchMedia('(hover:hover)').matches); },
  touchWanted() { const t = S().settings.touch; return t === 'on' || (t === 'auto' && this.isTouchDevice()); },
  applyTouch() {
    const root = $('#touch'), st = S().settings; const want = this.touchWanted(); const inMatch = this.mode === 'play' && !this.paused;
    Input.touch.enabled = want; Input.solo = !(st && S().setup.players === 2 && this.mode === 'play');
    root.classList.toggle('off', !(want && inMatch)); root.classList.toggle('left', !!st.leftHanded);
    document.documentElement.style.setProperty('--cs', String(st.ctrlScale || 1)); document.body.classList.toggle('touch-on', want && inMatch);
    if (Input.touch.reset) Input.touch.reset();
    const inGame = this.mode === 'play' || this.mode === 'matchEnd'; const rv = want && inGame && Input.touch.layout ? Input.touch.layout() : { L: 0, R: 0 };
    if (rv.L !== gfx.reserveL || rv.R !== gfx.reserveR) { gfx.reserveL = rv.L; gfx.reserveR = rv.R; if (gfx.ok) fitCamera(this.mode === 'menu' ? 'menu' : 'play'); }
  },
  reloadSettings() { loadSave(); applyVolumes(); setQuality(S().settings.quality); this.applyTouch(); },
  toggleFullscreen() {
    const d = document, el = d.documentElement;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (!isFs) { const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) { const r = f.call(el, { navigationUI: 'hide' }); r && r.catch && r.catch(() => UI.toast('Fullscreen not available here - use Add to Home screen')); try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} } else UI.toast('Fullscreen not supported - use Add to Home screen'); }
      else { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
    } catch (e) { UI.toast('Fullscreen not available'); }
  },
  // ---------- game lifecycle ----------
  camFollow(dt) {
    const g = app.game; if (!g || g.mode === 'attract') return; const pts = [], hum = [];
    for (const f of g.fighters) { if (!f.alive) continue; const p = [f.x, f.z]; pts.push(p); if (!f.isBot) hum.push(p); }
    if (g.camPoints) for (const p of g.camPoints()) pts.push(p); if (g.camFocus) for (const p of g.camFocus()) { pts.push(p); if (hum.length) hum.push(p); }
    followCam(dt, pts, hum); UI.edgeUpdate(g);
  },
  setGame(opts) {
    if (this.showPed) { this.game && this.game.scene.remove(this.showPed.ped, this.showBoom.mesh); this.showPed = null; this.showBoom = null; }
    if (this.game) { this.game.dispose(); this.game = null; } gfx.fovHold = 0; document.body.classList.remove('slowmo'); setTempo(1);
    setArenaSize(opts.mode === 'attract' ? 'small' : (opts.size || 'small'));
    this.game = new Game({ ...opts, mutator: opts.mode === 'attract' ? null : resolveMutator(opts.mutator), input: Input, onEvent: (n, d) => this.gameEvent(n, d) }); this.acc = 0;
    fitCamera(opts.mode === 'attract' ? 'menu' : 'play'); UI.hudStart(this.game);
    AU.mute = opts.mode === 'attract';
  },
  startAttract() {
    const s = S(); const hd = this.humanDef(0); if (this.pv && this.pv.cat === 'hats') hd.hat = this.pv.id; const others = shuffle(HEROES.filter((h) => h.id !== hd.hero.id)).slice(0, 3);
    const players = [{ ...hd, ctrl: 'bot', diff: 1 }].concat(others.map((h, i) => ({ hero: h, hat: pick(HATS).id, ctrl: 'bot', slot: i + 1, diff: 1, name: h.name })));
    const A = this.showArena && (this.keepArena || Math.random() < 0.6) ? this.showArena : pick(ARENAS); this.showArena = A; this.mode = 'menu';
    this.setGame({ mode: 'attract', arenaId: A.id, players, intro: 0.2 }); music('menu'); this.showKey = this.showKeyNow();
    this.setupShowcase(); this.applyTouch();
  },
  showKeyNow() { const s = S(); return [s.hero, s.hats[s.hero], s.eq.skin, s.eq.trail, s.eq.type].join('|'); },
  setupShowcase() {
    const g = this.game, s = S(); if (!g) return; const POS = [[0.2, 1.2, 1.55], [-3.3, -1.1, 1.0], [4.0, -1.4, 1.05], [1.9, -3.4, 0.95]];
    g.fighters.forEach((f, i) => { f.show = { win: false }; f.spawnT = 1; f.x = POS[i][0]; f.z = POS[i][1]; f.bs = POS[i][2] * (i ? 1 : 1.3); f.vface = f.face = 0; f.model.ring.visible = false; f.alive = true; });
    const f0 = g.fighters[0]; const col = f0.hero.color;
    { const bb = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3(); [g.view.root, g.view.dyn].forEach((grp) => grp && grp.children.forEach((o) => { bb.setFromObject(o); if (bb.isEmpty()) return; bb.getSize(sz); bb.getCenter(c); if (sz.x < 28 && sz.z < 28 && c.z > 4.2) o.visible = false; })); }
    // pedestal
    const ped = new THREE.Group(); const m1 = toon(0x2a2f45); const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.34, 40), m1); base.position.y = 0.17; ped.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.4, 0.08, 40), toon(new THREE.Color(col).multiplyScalar(0.7))); top.position.y = 0.38; ped.add(top);
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.58, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.44; ped.add(glow);
    ped.position.set(f0.x, 0, f0.z); g.scene.add(ped); f0.model.root.position.y = 0.4; this.showPed = { ped, glow };
    this.showBoom = null; this.buildShowBoom();
  },
  // cosmetics preview (Shop): hat / skin / trail / boomerang type shown live on the menu showcase
  previewCosmetic(o) { this.pv = o || null; this.applyPreview(); },
  eqView() { const s = S(), o = this.pv || {}; return { hat: o.cat === 'hats' ? o.id : (s.hats[s.hero] || 'none'), skin: o.cat === 'skins' ? o.id : s.eq.skin, trail: o.cat === 'trails' ? o.id : s.eq.trail, type: o.cat === 'types' ? o.id : (s.eq.type || 'classic') }; },
  buildShowBoom() {
    const g = this.game; if (!g || !g.fighters[0]) return; const f0 = g.fighters[0], col = f0.hero.color, v = this.eqView(); const old = this.showBoom; if (old) { g.scene.remove(old.mesh); old.ribbon.release(); }
    const tr = TRAILS[v.trail] || TRAILS.none; const rc = v.trail !== 'none' ? tr.color : col; const bm = buildBoomerang(col, f0.hero, v.skin, v.type); g.scene.add(bm);
    this.showBoom = { mesh: bm, ribbon: fx.ribbon(rc, 0.34, !!tr.rainbow && v.trail !== 'none'), a: old ? old.a : 0, tstyle: v.trail !== 'none' ? tr.fx : null, rc };
  },
  applyPreview() { const g = this.game; if (!g || g.mode !== 'attract' || !this.showPed) return; const v = this.eqView(); const f0 = g.fighters[0]; if (f0.model.setHat) f0.model.setHat(v.hat); this.buildShowBoom(); },
  showcaseTick(dt) {
    const g = this.game; if (!g || g.mode !== 'attract' || !this.showPed) return; const t = (this.showT = (this.showT || 0) + dt);
    if (this.mode === 'menu' && this.showKey !== this.showKeyNow() && !this.showDirty) { this.showDirty = true; setTimeout(() => { this.showDirty = false; if (this.mode === 'menu' && this.game && this.game.mode === 'attract') { this.keepArena = true; this.startAttract(); this.keepArena = false; } }, 120); }
    const F = g.fighters; const f0 = F[0];
    f0.vface = Math.sin(t * 0.55) * 0.55; f0.show.win = (t % 7.5) > 5.6; F.forEach((f, i) => { if (i) { f.vface = Math.sin(t * 0.4 + i * 2) * 0.35 + (i === 1 ? 0.3 : -0.3); f.show.win = ((t + i * 2.3) % 9) > 7.6; } });
    f0.model.root.position.y = 0.4;
    const b = this.showBoom; b.a += dt * 2.1; const R = 2.15, a = b.a; const x = f0.x + Math.cos(a) * R, z = f0.z + Math.sin(a) * R * 0.75, y = 1.25 + Math.sin(a * 1.6) * 0.18;
    b.mesh.position.set(x, y, z); b.mesh.rotation.y = t * 17; b.mesh.scale.setScalar(1.35); b.ribbon.push(x, y, z); if (b.tstyle) fx.trailFx(b.tstyle, x, y, z, b.rc);
    const p = this.showPed; p.glow.material.opacity = 0.65 + Math.sin(t * 3) * 0.3; p.ped.rotation.y = t * 0.2;
  },
  humans() { const st = S().setup; return st.mode === 'classic' && st.players === 2 && !this.isTouchDevice() ? 2 : 1; },
  humanDef(slot) {
    const s = S(); const id = slot === 0 ? s.hero : s.hero2; let hero = HEROES.find((h) => h.id === id) || HEROES[slot];
    if (slot === 1) { const h1 = HEROES.find((h) => h.id === s.hero) || HEROES[0]; if (hero.id === h1.id) hero = HEROES.find((h) => h.id !== h1.id); }
    const d = { hero, hat: s.hats[hero.id] || 'none', ctrl: 'human', slot, name: slot === 1 ? 'P2 ' + hero.name : (this.humans() === 2 ? 'P1 ' + hero.name : hero.name), wins: 0, diff: 1 };
    if (slot === 0) { d.skin = s.eq.skin; d.trail = s.eq.trail; d.type = s.eq.type; }
    return d;
  },
  botDef(hero, o = {}) { return { hero, hat: Math.random() < 0.5 ? pick(HATS).id : 'none', ctrl: 'bot', slot: -1, name: hero.name, diff: S().setup.diff, persona: PERSONAS[hero.id], wins: 0, ...o }; },
  // ---- start a mode from the mode-select screen
  startMode(modeId) {
    const s = S(), st = s.setup; st.mode = modeId; const nh = this.humans(); const players = [this.humanDef(0)]; if (nh === 2) players.push(this.humanDef(1));
    const used = new Set(players.map((p) => p.hero.id)); const pool = () => shuffle(HEROES.filter((h) => !used.has(h.id)));
    let need = 1, rulesMode = modeId;
    if (modeId === 'classic') { const nb = Math.min(st.bots, 4 - nh); pool().slice(0, nb).forEach((hh) => players.push(this.botDef(hh))); need = st.rounds; }
    else if (modeId === 'team' || modeId === 'ctf' || modeId === 'ball') { const pl = pool(); players[0].team = 0; players[0].color = 0x4fd1ff; players.push(this.botDef(pl[0], { team: 0, color: 0x9fe8ff })); players.push(this.botDef(pl[1], { team: 1, color: 0xff5a8a })); players.push(this.botDef(pl[2], { team: 1, color: 0xff9ab8 })); need = modeId === 'team' ? st.rounds : 1; if (modeId !== 'team') players.forEach((p) => { p.lives = 99; }); }
    else if (modeId === 'bossrush') { players[0].team = 0; players[0].lives = 3; players[0].color = 0x4fd1ff; if (nh === 2) { players[1].team = 0; players[1].lives = 3; } else players.push(this.botDef(pool()[0], { team: 0, color: 0x9fe8ff, lives: 3, diff: Math.max(1, st.diff) })); }
    else if (modeId === 'crumble') { const nb = Math.min(st.bots, 4 - nh); pool().slice(0, nb).forEach((hh) => players.push(this.botDef(hh))); need = st.rounds; }
    else if (modeId === 'survival') { players[0].team = 0; players[0].lives = 3; }
    else { const nb = Math.max(modeId === 'bomb' ? 2 : 1, Math.min(st.bots, 4 - nh)); pool().slice(0, nb).forEach((hh) => players.push(this.botDef(hh))); if (modeId === 'koth' || modeId === 'coins') players.forEach((p) => (p.lives = 99)); }
    this.match = { mode: modeId, rulesMode, players, round: 0, need, arena: st.arena, size: (MODES[modeId] && MODES[modeId].size) || st.size || 'small', traps: st.traps, trapSet: modeId === 'ball' ? [['bumper', 'q4'], ['jump', 'r2']] : null, mutator: st.mutator, humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {} };
    s.played++; track('play'); save(); this.dailyBefore = dailySnapshot(); this.nextRound(true);
  },
  quickPlay() { const s = S(); const md = s.setup.mode; this.startMode(MODES[md] && md !== 'campaign' ? md : 'classic'); },
  startStage(n) {
    const stage = STAGES[n - 1]; const s = S(); const hd = this.humanDef(0); hd.name = hd.hero.name; const { players, rules } = stageSetup(stage, hd);
    this.match = { mode: 'campaign', stage, rules, players, round: 0, need: 1, arena: stage.arena, size: stage.size || 'small', traps: stage.traps || 'some', mutator: 'off', humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {} };
    s.played++; track('play'); save(); this.dailyBefore = dailySnapshot(); this.nextRound(true);
  },
  startTutorial() {
    const hd = this.humanDef(0); hd.name = hd.hero.name; hd.lives = 99; const dummy = this.botDef(pick(HEROES.filter((h) => h.id !== hd.hero.id)), { diff: 0, team: 1, persona: 'defender', lives: 1, name: 'Dummy' });
    this.match = { mode: 'tutorial', rules: { type: 'elim', sudden: false, events: [] }, players: [hd, dummy], round: 0, need: 1, arena: 'dojo', humanWins: 0, coins: 0, xp: 0, st: { deaths: 0, passes: 0, kos: 0 }, teamWins: {}, tutorial: true, traps: 'off', mutator: 'off', size: 'small' };
    this.tut = { step: 0, t: 0, moved: 0, done: [] }; this.nextRound(true);
  },
  nextRound(first) {
    const m = this.match; m.round++; UI.clear(); this.paused = false; this.resultShown = false;
    const aid = m.arena === 'random' ? pick(ARENAS.filter((a) => a.id !== m.last || ARENAS.length < 2)).id : m.arena; m.last = aid;
    const rules = m.rules ? { ...m.rules } : rulesFor(m.rulesMode || m.mode, { arena: aid, eventLevel: S().settings.events });
    if (m.mode === 'survival' || m.mode === 'koth' || m.mode === 'bomb' || m.mode === 'team' || m.mode === 'classic') { if (!m.rules) { const r2 = rulesFor(m.mode, { arena: aid, eventLevel: S().settings.events }); Object.assign(rules, r2); } }
    m.curRules = rules; this.mode = 'play';
    this.setGame({ mode: 'vs', arenaId: aid, players: m.players, round: m.round, rules, size: m.size, traps: m.traps, trapSet: m.trapSet, mutator: m.mutator }); music(m.stage && m.stage.kind === 'boss' || m.mode === 'bossrush' ? 'boss' : m.mode === 'bomb' ? 'bomb' : m.mode === 'koth' ? 'koth' : aid); setIntensity(0); AU.mute = false; Input.flush(); this.applyTouch(); this.simT = 0; this.touchF = null;
    if (m.tutorial) { this.tut = { step: 0, t: 0, moved: 0, ...(first ? {} : {}) }; const d = this.game.fighters[1]; if (d) d.stunT = 9999; UI.tutorialShow(this.tut); }
  },
  restartRound() { const m = this.match; if (!m) return; m.round--; if (m.mode !== 'classic' && m.mode !== 'team') { m.st = { deaths: 0, passes: 0, kos: 0 }; } this.nextRound(); },
  humanF() { const g = this.game; return g && g.fighters.find((x) => !x.isBot && x.def.slot === 0); },
  emote(id) {
    const f = this.humanF(), g = this.game; if (!f || !f.alive || this.mode !== 'play' || this.paused) return; if (f.emoteT > 0) return; const e = EMOTES[id] || EMOTES.gg; f.emoteT = 1.4; sfx('emote');
    fx.popup(e.text, f.x, f.z, 'pop-emote', 2.3); g.onEvent('emote', { f, id }); UI.emoteClose && UI.emoteClose();
  },
  gameEvent(n, d) {
    const m = this.match, g = this.game; if (this.tut) this.tutEvent(n, d); const human = d && d.f && !d.f.isBot;
    if (n === 'countdown') { if (this.mode !== 'play') return; if (d.n === 3) UI.banner(UI.introTitle(m, g), UI.introSub(m, g)); else if (d.n > 0) UI.banner(String(d.n)); }
    else if (n === 'go') { if (this.mode === 'play') UI.banner(m && m.mode === 'tutorial' ? 'GO!' : 'FIGHT!', null, '#ffd23c'); }
    else if (n === 'ko') {
      if (this.mode !== 'play') return; const f = d.f; if (!f.isBot && navigator.vibrate && S().settings.vibrate) navigator.vibrate(f.deathKind === 'boom' ? 60 : 30); S().kos++;
      if (m) { if (human) m.st.deaths++; if (d.killer && !d.killer.isBot && d.killer.team !== f.team) { m.st.kos++; track('ko'); if (['saw', 'hammer', 'boulder', 'crush', 'fire', 'zap', 'laser', 'spike'].includes(d.kind)) track('trapko'); } }
      if (f.boss) { UI.banner('BOSS DOWN!', f.name + ' is defeated', '#ffd23c'); }
      const k = d.killer; if (k && k !== f && k.alive && k.team !== f.team) { k.koChain = g.time - (k.lastKoT || -99) < 4.5 ? (k.koChain || 0) + 1 : 1; k.lastKoT = g.time; if (k.koChain >= 2 && !k.isBot) { sfx('combo', k.koChain); fx.popup(['', '', 'DOUBLE KO!', 'TRIPLE KO!', 'MEGA KO!'][Math.min(4, k.koChain)], k.x, k.z, 'pop-gold', 2.5); } }
    }
    else if (n === 'hurt') { if (human) { fx.hurt(0.7); sfx('hurt'); if (navigator.vibrate && S().settings.vibrate) navigator.vibrate(40); } }
    else if (n === 'pickup') { if (human) track('pickup'); }
    else if (n === 'throw') { if (human) track('throw'); }
    else if (n === 'dash') { if (human) track('dash'); }
    else if (n === 'catch') { if (human) track('catch'); }
    else if (n === 'parry') { if (human) track('deflect'); }
    else if (n === 'shatter') { if (d.killer && !d.killer.isBot) track('shatter'); }
    else if (n === 'chainko') { if (human) track('chainko'); }
    else if (n === 'ult') { if (human) track('ult'); if (d.f.isBot === false) UI.banner(ULTS[d.f.hero.id].name.toUpperCase(), null, '#ffe066'); }
    else if (n === 'bomb') { if (d.from && !d.from.isBot && m) m.st.passes++; if (d.f && !d.f.isBot) UI.toast('You have the bomb! Hit a rival to pass it!', 1800); }
    else if (n === 'wave') { UI.banner('WAVE ' + d.n, d.n % 5 === 0 ? 'Elite incoming!' : null, '#ff9a6a'); if (m) track('wave', d.n); }
    else if (n === 'wind') { UI.toast('Wind gust!', 1400); }
    else if (n === 'zoneMove') { UI.toast('The hill moved!', 1200); }
    else if (n === 'goal') { if (this.mode === 'play') UI.banner('GOAL!', d.team === 0 ? 'Cyan team scores' : 'Pink team scores', d.team === 0 ? '#4fd1ff' : '#ff5a8a'); }
    else if (n === 'capture') { if (this.mode === 'play') UI.banner('FLAG CAPTURED!', d.f.team === 0 ? 'Cyan team scores' : 'Pink team scores', d.f.team === 0 ? '#4fd1ff' : '#ff5a8a'); }
    else if (n === 'boss') { if (this.mode === 'play') UI.banner('BOSS ' + d.n + ' / 3', d.name, '#ff5a5a'); }
    else if (n === 'rage') { UI.banner('ENRAGED!', null, '#ff5a5a'); }
    else if (n === 'lastKO') { if (this.mode === 'play' && g.rules.type !== 'koth' && !(m && m.mode === 'survival')) UI.banner(d.draw ? 'DRAW' : (d.winTeam === 0 || (d.winner && !d.winner.isBot) ? 'K.O.!' : 'K.O.!'), d.winner ? d.winner.name + ' stands!' : 'Nobody stands...', '#ff7a5a'); if (m && m.tutorial) { /* handled in roundEnd */ } if (d.winner && d.winner.alive && !d.winner.isBot) { fx.confetti(d.winner.x, d.winner.z, 50); } }
    else if (n === 'sudden') { if (this.mode === 'play') UI.banner('SUDDEN DEATH!', 'The arena crumbles!', '#ff5a5a'); }
    else if (n === 'roundEnd') {
      if (this.mode !== 'play') { if (this.game && this.game.mode === 'attract') setTimeout(() => { if (this.mode === 'menu' && this.game && this.game.mode === 'attract') this.startAttractKeep(); }, 400); return; }
      this.onRoundEnd(d);
    }
  },
  onRoundEnd(d) {
    const m = this.match, g = this.game; const info = (win) => m.players.map((p, i) => ({ name: p.name, wins: p.wins, team: p.team === undefined ? i : p.team, color: p.color || PLAYER_COLORS[i % 4], img: portrait(p.hero, p.hat) }));
    const humanTeam = m.players[0].team === undefined ? 0 : m.players[0].team; const humanWon = d.winTeam === humanTeam && d.winTeam >= 0;
    const teamBased = !!g.rules.teams;
    if (m.mode === 'classic' || m.mode === 'team' || m.mode === 'crumble') {
      const w = d.winner; if (d.winTeam >= 0) { m.players.forEach((p, i) => { const t = p.team === undefined ? i : p.team; if (t === d.winTeam) p.wins++; }); if (humanWon) m.humanWins++; }
      const champ = m.players.find((p) => p.wins >= m.need);
      if (champ) { const cTeam = champ.team === undefined ? m.players.indexOf(champ) : champ.team; this.finishMatch({ won: cTeam === humanTeam, winnerName: teamBased ? (cTeam === humanTeam ? 'Your team' : 'Rival team') : champ.name, champ, info: info() }); }
      else { save(); sfx('round'); this.mode = 'play'; UI.show('roundEnd', { winner: w ? { name: teamBased ? (humanWon ? 'Your team' : 'Rival team') : w.name } : null, teamWin: teamBased ? (humanWon ? 'Your team' : 'Rival team') : null, players: info(), need: m.need, coins: 0, draw: d.winTeam < 0 }); this.paused = true; this.applyTouch(); }
      return;
    }
    // single-round modes
    const r = g.rules.type; let won = humanWon, extra = { info: info() };
    const stats = { time: g.playTime, deaths: m.st.deaths, passes: m.st.passes };
    if (r === 'koth') { const sc = g.mst.scores; const mine = sc[humanTeam] || 0; const others = Math.max(0, ...Object.keys(sc).filter((k) => +k !== humanTeam).map((k) => sc[k])); stats.margin = mine - others; extra.scoreMine = Math.round(mine); extra.scoreBest = Math.round(others); }
    if (r === 'ctf' || r === 'ball') { const sc = g.mst2 || g.m2.scores; extra.scoreMine = sc[humanTeam] || 0; extra.scoreBest = sc[1 - humanTeam] || 0; }
    if (r === 'coins') { const me = g.fighters.find((f) => !f.isBot); extra.scoreMine = me ? me.score : 0; extra.scoreBest = Math.max(0, ...g.fighters.filter((f) => f.isBot).map((f) => f.score || 0)); }
    if (r === 'bossrush') { extra.rush = g.m2.n; won = !g.mst.lost && g.m2.done; }
    if (r === 'survival') { stats.wave = g.mst.wave; extra.wave = g.mst.wave; extra.kills = m.st.kos; if (m.stage) won = !g.mst.lost; else won = false; }
    this.finishMatch({ won, stats, ...extra });
  },
  finishMatch(o) { UI.tutorialHide && UI.tutorialHide();
    const m = this.match, g = this.game, s = S(); if (this.resultShown) return; this.resultShown = true; const won = !!o.won; const st = { ...(o.stats || {}), won, deaths: m.st.deaths, passes: m.st.passes, time: g.playTime };
    let coins = won ? 30 : 8, xp = 18 + (won ? 40 : 0); coins += m.st.kos * 5; xp += m.st.kos * 8; let stars = 0, prevStars = 0, firstClear = false; const rows = [];
    const mode = m.mode; if (mode !== 'tutorial') { if (won) { s.wins++; track('win'); } }
    if (mode === 'team' && won) track('teamwin');
    if (mode === 'koth') { if (won) track('kothwin'); coins += won ? 25 : 0; rows.push(['Hill score', `${o.scoreMine} vs ${o.scoreBest}`]); if (!m.stage) s.best.koth = Math.max(s.best.koth || 0, Math.round(o.scoreMine || 0)); }
    if (mode === 'bomb' && won) track('bombwin'); if (['ctf', 'coins', 'ball', 'crumble', 'bossrush'].includes(mode) && won) track(mode + 'win');
    if (mode === 'ctf' || mode === 'ball') { coins += won ? 15 : 0; rows.push([mode === 'ctf' ? 'Captures' : 'Goals', `${o.scoreMine} vs ${o.scoreBest}`]); }
    if (mode === 'coins') { coins += Math.min(40, Math.round((o.scoreMine || 0) * 0.8)); rows.push(['Coins grabbed', `${o.scoreMine} vs ${o.scoreBest}`]); }
    if (mode === 'bossrush') { coins += (o.rush || 0) * 20 + (won ? 60 : 0); xp += (o.rush || 0) * 20; rows.push(['Bosses reached', `${o.rush || 0} / 3`]); }
    if (mode === 'crumble') rows.push(['Rounds won', String(m.humanWins)]);
    if (mode === 'survival') { const wv = o.wave || 0; coins += wv * 9; xp += wv * 14; rows.push(['Waves reached', String(wv)], ['Rivals KO\u2019d', String(m.st.kos)]); if (!m.stage) { s.best.survival = Math.max(s.best.survival || 0, wv); } track('wave', wv); }
    if (mode === 'classic' || mode === 'team') rows.push(['Rounds won', String(m.humanWins)]);
    if (mode === 'bomb') rows.push(['Bombs passed', String(m.st.passes)]);
    if (m.stage) { const stg = m.stage; stars = evalStars(stg, st); const cur = s.camp.stars[stg.n - 1] || 0; prevStars = cur; firstClear = won && cur === 0; if (stars > cur) { s.camp.stars[stg.n - 1] = stars; } if (stg.kind === 'boss' && won) { track('boss', 0); s.camp.bosses = s.camp.bosses || {}; if (!s.camp.bosses[stg.n]) { s.camp.bosses[stg.n] = 1; track('boss', 1); } } const tot = s.camp.stars.reduce((a, b) => a + (b || 0), 0); track('stars', tot); if (won) { coins += 15 * stars + (firstClear ? 60 : 0); xp += 12 * stars + (firstClear ? 50 : 0); } rows.push(['Time', fmtT(g.playTime)], ['Times KO\u2019d', String(m.st.deaths)]); }
    if (m.tutorial) { s.tutorialDone = true; coins = 40; xp = 60; rows.length = 0; rows.push(['Tutorial', 'Complete!']); }
    addCoins(coins, won ? 'win' : 'play'); const lvBefore = levelInfo(); const ups = addXp(xp); save(); music('win'); sfx(won ? 'win' : 'lose'); this.mode = 'matchEnd';
    if (won && g.winner && !g.winner.isBot) { fx.confetti(g.winner.x, g.winner.z, 80, 1.6); }
    const lv = levelInfo();
    const base = { won, mode, stage: m.stage || null, stars, prevStars, firstClear, rows, coins, xp, lvBefore, lv, ups, winnerName: o.winnerName, champ: o.champ, info: o.info, tutorial: !!m.tutorial };
    this.lastResult = base; setTimeout(() => { if (this.mode === 'matchEnd') { UI.show('matchEnd', base); this.applyTouch(); } }, 400);
  },
  rematch() { const m = this.match; if (!m) return; if (m.stage) this.startStage(m.stage.n); else if (m.mode === 'tutorial') this.startTutorial(); else this.startMode(m.mode); },
  pause() { if (this.mode !== 'play' || this.paused || !this.game || this.game.state === 'matchEnd') return; this.paused = true; this.applyTouch(); UI.show('pause'); sfx('click'); },
  resume() { if (!this.paused) return; this.paused = false; UI.clear(); Input.flush(); this.applyTouch(); },
  quitToMenu(play) { this.tut = null; UI.tutorialHide && UI.tutorialHide(); this.paused = false; this.mode = 'menu'; this.match = null; UI.clear(); UI.hudStart(null); this.startAttract(); UI.show(play ? 'modes' : 'menu'); this.applyTouch(); },
  startAttractKeep() { this.startAttract(); },
  // ---- tutorial
  skipTutorial() { const s = S(); s.tutorialDone = true; save(); this.tut = null; UI.tutorialHide && UI.tutorialHide(); this.quickPlay(); },
  tutEvent(n, d) { const t = this.tut; if (!t || !d || !d.f || d.f.isBot) return; if ((t.step === 1 && n === 'throw') || (t.step === 2 && n === 'catch') || (t.step === 3 && n === 'dash')) this.tutAdv(); },
  tutAdv() { const t = this.tut; t.step++; t.t = 0; sfx('pickup'); UI.tutorialShow(t); if (t.step === 5 && this.game) { const d = this.game.fighters[1]; if (d) d.stunT = 0; } },
  tutTick(dt) {
    const t = this.tut, m = this.match; if (!t || !m || !m.tutorial || this.mode !== 'play' || this.paused || !this.game || this.game.state !== 'play') return; const f = this.humanF(); if (!f) return;
    t.t += dt; if (t.step === 0) { if (Math.hypot(f.vx, f.vz) > 1.5) t.moved += dt; if (t.moved > 1.2) this.tutAdv(); } else if (t.step === 4 && f.deflectT > 0) this.tutAdv();
    if (t.step >= 1 && t.step <= 4 && f.ammo <= 0 && this.game.booms.length === 0) f.ammo = 1;
  },
};

// ---------- boot ----------
function boot() {
  loadSave(); const canvas = $('#c');
  if (!initGfx(canvas)) { $('#loading').innerHTML = '<div class="errbox">WebGL is not available on this device/browser.</div>'; return; }
  fx.init(gfx.scene); applyVolumes();
  initInput(canvas); initTouch($('#touch'));
  UI.init(app); makePortraits(); setNotifier((msg, kind) => UI.notify(msg, kind)); Input.onEmoteBtn = () => UI.emoteToggle();
  window.addEventListener('keydown', (e) => { if (app.mode === 'play' && !app.paused && /^Digit[1-4]$/.test(e.code)) app.emote(S().eq.emotes[+e.code.slice(5) - 1]); });
  Input.unproject = (x, y) => { const c = gfx.camera; c.updateMatrixWorld(); const rc = canvas.getBoundingClientRect(); const v = new THREE.Vector3(((x - rc.left) / rc.width) * 2 - 1, -((y - rc.top) / rc.height) * 2 + 1, 0.5).unproject(c); const o = c.position; const dy = v.y - o.y; if (Math.abs(dy) < 1e-4) return null; const k = -o.y / dy; if (k <= 0) return null; return [o.x + (v.x - o.x) * k, o.z + (v.z - o.z) * k]; };
  Input.onPause = () => { if (app.mode === 'play') { app.paused ? (UI.cur === 'pause' && app.resume()) : app.pause(); } };
  // resize wiring
  let rt = 0; const rz = () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { resize(); app.applyTouch(); }); };
  window.addEventListener('resize', rz); window.addEventListener('orientationchange', () => setTimeout(rz, 120)); document.addEventListener('fullscreenchange', () => setTimeout(rz, 80)); document.addEventListener('webkitfullscreenchange', () => setTimeout(rz, 80));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', rz); if (window.ResizeObserver) new ResizeObserver(rz).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.mode === 'play' && !app.paused) app.pause(); });
  window.addEventListener('blur', () => { if (app.mode === 'play' && !app.paused && !S().settings.noAutoPause) app.pause(); });
  const unlock = () => { initAudio(); resumeAudio(); iosAudioKick(); applyVolumes(); if (!app.musicOn) { app.musicOn = true; music(app.mode === 'play' && app.game ? app.game.arenaId : 'menu'); } };
  ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'touchend', 'click'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeAudio(); }); window.addEventListener('pageshow', () => resumeAudio()); window.addEventListener('focus', () => resumeAudio());
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  let slowToast = false; window.addEventListener('bb-slow', () => { if (!slowToast && app.mode === 'play') { slowToast = true; UI.toast('Running slow? Settings > Graphics > Fast', 4200); } });
  resize(); app.startAttract(); UI.show('menu'); app.applyTouch();
  initHead(); initHardening(); initWakeLock(); initFullscreenFirstTap(app); initInstall(UI); initSW(app, UI); pwa.onChange = () => { if (UI.cur === 'menu') UI.show('menu'); };
  $('#loading').remove(); app.ready = true;
  if (IS_IOS && !isStandalone() && !IS_APP && !S().settings.a2hs) { setTimeout(() => { if (app.mode === 'menu') { showIosHint(); S().settings.a2hs = true; save(); } }, 2600); }
  console.log('Whackerang', BUILD, gfx.quality, 'dpr', gfx.dprCur);
  // loop
  let last = performance.now(), fAcc = 0, fN = 0;
  const prof = { frames: 0, sum: 0, max: 0, sim: 0, rend: 0, over: 0 }; 
  const frame = (now) => {
    requestAnimationFrame(frame); let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
    const t0 = performance.now(); app.frames++;
    if (app.game && (!app.paused || app.mode === 'menu')) { app.acc += dt; let n = 0; while (app.acc >= STEP && n < 4) { app.game.update(STEP); app.acc -= STEP; n++; } if (app.acc > STEP * 4) app.acc = 0; }
    const dts = app.paused ? 0 : dt; fx.update(dts); app.showcaseTick(dt); gfx.time = (gfx.time || 0) + dt; if (app.game && app.mode === 'play' && gfx.follow) app.camFollow(dt); updateGfx(dt, gfx.time);
    if (!app.game || app.mode === 'menu' || app.paused || true) { const p = Input.menuPoll(); if (UI.cur) UI.padMenu(p); else if (app.mode === 'play' && p.back && false) app.pause(); }
    if (app.mode !== 'play' || app.paused) Input.edge.clear();
    { const sl = !!(app.game && app.game.slowT > 0 && app.mode === 'play'); if (sl !== app._sl) { app._sl = sl; document.body.classList.toggle('slowmo', sl); setTempo(sl ? 0.72 : 1); } }
    app.tutTick(dt); if (app.game && app.mode === 'play' && app.game.mode !== 'attract') { const g = app.game; const al = g.fighters.filter((f) => f.alive).length; setIntensity(g.state === 'play' ? Math.min(1, (g.sudden ? 0.7 : 0) + (al <= 2 ? 0.45 : 0.15) + Math.min(0.3, g.playTime / 120) + (g.rules.type === 'bomb' && g.mst.fuse < 4 ? 0.5 : 0)) : 0); } else setIntensity(0);
    app.hudT -= dt; if (app.hudT <= 0 && app.game) { app.hudT = 0.1; UI.hudUpdate(app.game); }
    if (Input.touch.enabled && Input.touch.sync) { const th = app.touchF && app.touchF.g === app.game ? app.touchF.f : (app.touchF = { g: app.game, f: app.game && app.mode === 'play' ? app.game.fighters.find((x) => !x.isBot && x.def.slot === 0) : null }).f; if (th && app.mode === 'play') Input.touch.sync({ charge: th.alive && th.charging ? Math.min(1, th.chargeT / 0.7) : 0, dash: th.dashCd > 0 ? Math.min(1, th.dashCd / (0.95 * th.mods.dashCd)) : 0, dashS: Math.max(0, th.dashCd) / (app.game.cfg ? app.game.cfg.ts : 1), defl: th.deflectCd > 0 ? Math.min(1, th.deflectCd / 0.85) : 0, deflS: Math.max(0, th.deflectCd) / (app.game.cfg ? app.game.cfg.ts : 1), ammo: th.alive ? th.ammo : 1, ult: th.alive ? th.ult / 100 : 0 }); else Input.touch.sync(null); }
    const t1 = performance.now(); render(); const t2 = performance.now();
    prof.frames++; prof.sum += dt * 1000; prof.max = Math.max(prof.max, dt * 1000); prof.sim += t1 - t0; prof.rend += t2 - t1; if (dt > 0.034) prof.over++;
    adaptRes(dt * 1000);
  };
  requestAnimationFrame(frame);
  window.__bg = { overview(on = true) { if (gfx.follow) gfx.follow.fixed = on; }, setQuality, UI, Bot, STAGES, autoplay(diff = 2) { const g = app.game; g.fighters.forEach((f) => { if (!f.isBot && f.def.slot === 0) { f.isBot = true; f.bot = new Bot(g, f, diff, 'duelist'); } }); }, buildBoomerang, camNow() { updateGfx(0, gfx.time || 0); }, buildFighter, faceAtlas: (id) => faceDebugCanvas(id).toDataURL(), snap, Game, HEROES, ARENAS, app, S, Input, sfx, initAudio, resumeAudio, AU, music, gfx, fx, prof, THREE, step(n = 1) { for (let i = 0; i < n; i++) { app.game && app.game.update(STEP); if (gfx.follow) app.camFollow(STEP); } }, renderNow() { fx.update(0); render(); }, resetProf() { prof.frames = prof.sum = prof.max = prof.sim = prof.rend = prof.over = 0; } };
}
try { boot(); } catch (e) { console.error(e); const l = $('#loading'); if (l) l.innerHTML = '<div class="errbox">Startup error: ' + e.message + '</div>'; }
