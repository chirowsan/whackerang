import { THREE, gfx, initGfx, setQuality, resize, fitCamera, updateGfx, render, adaptRes, isCoarse, shake } from './gfx.js';
import { S, save, loadSave } from './save.js';
import { HEROES, HATS, ARENAS, PLAYER_COLORS } from './data.js';
import { initAudio, resumeAudio, applyVolumes, sfx, music, AU } from './audio.js';
import { Input, initInput, initTouch } from './input.js';
import { fx } from './fx.js';
import { Game } from './game.js';
import { UI, $ } from './ui.js';
import { buildFighter, buildBoomerang } from './models.js';
import { makePortraits, portrait, snap } from './portraits.js';
import { faceDebugCanvas } from './faces.js';
import { pick, shuffle } from './util.js';
import { initHead, initSW, initInstall, initWakeLock, initFullscreenFirstTap, initHardening, iosAudioKick, IS_IOS, IS_APP, isStandalone, showIosHint, pwa } from './pwa.js';

const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const STEP = 1 / 60;
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
  setGame(opts) {
    if (this.game) { this.game.dispose(); this.game = null; }
    this.game = new Game({ ...opts, input: Input, onEvent: (n, d) => this.gameEvent(n, d) }); this.acc = 0;
    fitCamera(opts.mode === 'attract' ? 'menu' : 'play'); UI.hudStart(this.game);
    AU.mute = opts.mode === 'attract';
  },
  startAttract() {
    const ids = shuffle(HEROES.map((h) => h)).slice(0, 4); const players = ids.map((h, i) => ({ hero: h, hat: pick(HATS).id, ctrl: 'bot', slot: i, diff: 1, name: h.name }));
    const A = pick(ARENAS); this.mode = 'menu'; this.setGame({ mode: 'attract', arenaId: A.id, players, intro: 0.6 }); music('menu');
    this.applyTouch();
  },
  humans() { const st = S().setup; return st.players === 2 && !this.isTouchDevice() ? 2 : 1; },
  startMatch() {
    const s = S(), st = s.setup, nh = this.humans(); const nb = Math.min(st.bots, 4 - nh);
    const used = new Set(); const players = [];
    const mk = (hero, ctrl, slot, name) => { used.add(hero.id); players.push({ hero, hat: ctrl === 'human' ? (s.hats[hero.id] || 'none') : (Math.random() < 0.5 ? pick(HATS).id : 'none'), ctrl, slot, diff: st.diff, name, wins: 0 }); };
    const h1 = HEROES.find((h) => h.id === s.hero) || HEROES[0]; mk(h1, 'human', 0, nh === 2 ? 'P1 ' + h1.name : h1.name);
    if (nh === 2) { let h2 = HEROES.find((h) => h.id === s.hero2) || HEROES[1]; if (h2.id === h1.id) h2 = HEROES.find((h) => h.id !== h1.id); mk(h2, 'human', 1, 'P2 ' + h2.name); }
    const pool = shuffle(HEROES.filter((h) => !used.has(h.id))); for (let i = 0; i < nb; i++) { const hh = pool[i % pool.length]; mk(hh, 'bot', 0, hh.name); }
    this.match = { players, round: 0, need: st.rounds, arena: st.arena, humanWins: 0 };
    s.played++; save(); this.nextRound(true);
  },
  nextRound(first) {
    const m = this.match; m.round++; UI.clear(); this.paused = false;
    const aid = m.arena === 'random' ? pick(ARENAS.filter((a) => a.id !== m.last || ARENAS.length < 2)).id : m.arena; m.last = aid;
    this.mode = 'play'; this.setGame({ mode: 'vs', arenaId: aid, players: m.players, round: m.round }); music(aid); AU.mute = false; Input.flush(); this.applyTouch(); this.simT = 0;
  },
  restartRound() { const m = this.match; if (!m) return; m.round--; this.nextRound(); },
  pause() { if (this.mode !== 'play' || this.paused || !this.game || this.game.state === 'matchEnd') return; this.paused = true; this.applyTouch(); UI.show('pause'); sfx('click'); },
  resume() { if (!this.paused) return; this.paused = false; UI.clear(); Input.flush(); this.applyTouch(); },
  quitToMenu() { this.paused = false; this.mode = 'menu'; this.match = null; UI.clear(); UI.hudStart(null); this.startAttract(); UI.show('menu'); this.applyTouch(); },
  gameEvent(n, d) {
    if (n === 'countdown') { if (this.mode !== 'play') return; const m = this.match; if (d.n === 3) UI.banner('ROUND ' + m.round, ARENAS.find((a) => a.id === this.game.arenaId).name + ' · first to ' + m.need); else if (d.n > 0) UI.banner(String(d.n)); }
    else if (n === 'go') { if (this.mode === 'play') UI.banner('FIGHT!', null, '#ffd23c'); }
    else if (n === 'ko') { if (this.mode !== 'play') return; const f = d.f; if (!f.isBot && navigator.vibrate && S().settings.vibrate) navigator.vibrate(f.deathKind === 'boom' ? 60 : 30); if (d.killer && d.killer !== f && d.killer.alive !== undefined) d.killer.kos++; S().kos++; }
    else if (n === 'lastKO') { if (this.mode === 'play') { UI.banner('K.O.!', d.winner ? d.winner.name + ' stands!' : 'Nobody stands...', '#ff7a5a'); } }
    else if (n === 'sudden') { if (this.mode === 'play') { UI.banner('SUDDEN DEATH!', 'The arena crumbles!', '#ff5a5a'); } }
    else if (n === 'roundEnd') {
      if (this.mode !== 'play') { if (this.game && this.game.mode === 'attract') setTimeout(() => { if (this.mode === 'menu' && this.game && this.game.mode === 'attract') this.startAttractKeep(); }, 400); return; }
      const m = this.match, w = d.winner; let coins = 0;
      if (w) { const def = m.players.find((p) => p.name === w.name); def.wins++; if (def.ctrl === 'human') { coins += 10; m.humanWins++; } }
      const humanAlive = this.game.fighters.some((f) => !f.isBot && f.alive); if (!w) coins += 2;
      S().coins += coins; m.coins = (m.coins || 0) + coins;
      const info = m.players.map((p) => ({ name: p.name, wins: p.wins, color: PLAYER_COLORS[m.players.indexOf(p)], img: portrait(p.hero, p.hat) }));
      const champ = m.players.find((p) => p.wins >= m.need);
      if (champ) {
        const human = champ.ctrl === 'human'; const bonus = human ? 30 : 8; S().coins += bonus; m.coins += bonus; if (human) S().wins++; save(); music('win'); sfx('win'); this.mode = 'matchEnd';
        UI.show('matchEnd', { winner: champ, players: info, need: m.need, humanWon: human, coins: m.coins, img: portrait(champ.hero, champ.hat) });
        this.applyTouch();
      } else { save(); sfx('round'); this.mode = 'play'; UI.show('roundEnd', { winner: w ? { name: w.name } : null, players: info, need: m.need, coins }); this.paused = true; this.applyTouch(); }
    }
  },
  startAttractKeep() { this.startAttract(); },
};

// ---------- boot ----------
function boot() {
  loadSave(); const canvas = $('#c');
  if (!initGfx(canvas)) { $('#loading').innerHTML = '<div class="errbox">WebGL is not available on this device/browser.</div>'; return; }
  fx.init(gfx.scene); applyVolumes();
  initInput(canvas); initTouch($('#touch'));
  UI.init(app); makePortraits();
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
  resize(); app.startAttract(); UI.show('menu'); app.applyTouch();
  initHead(); initHardening(); initWakeLock(); initFullscreenFirstTap(app); initInstall(UI); initSW(app, UI); pwa.onChange = () => { if (UI.cur === 'menu') UI.show('menu'); };
  $('#loading').remove(); app.ready = true;
  if (IS_IOS && !isStandalone() && !IS_APP && !S().settings.a2hs) { setTimeout(() => { if (app.mode === 'menu') { showIosHint(); S().settings.a2hs = true; save(); } }, 2600); }
  console.log('Boomerang Brawl', BUILD, gfx.quality, 'dpr', gfx.dprCur);
  // loop
  let last = performance.now(), fAcc = 0, fN = 0;
  const prof = { frames: 0, sum: 0, max: 0, sim: 0, rend: 0, over: 0 }; 
  const frame = (now) => {
    requestAnimationFrame(frame); let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
    const t0 = performance.now(); app.frames++;
    if (app.game && (!app.paused || app.mode === 'menu')) { app.acc += dt; let n = 0; while (app.acc >= STEP && n < 4) { app.game.update(STEP); app.acc -= STEP; n++; } if (app.acc > STEP * 4) app.acc = 0; }
    const dts = app.paused ? 0 : dt; fx.update(dts); gfx.time = (gfx.time || 0) + dt; updateGfx(dt, gfx.time);
    if (!app.game || app.mode === 'menu' || app.paused || true) { const p = Input.menuPoll(); if (UI.cur) UI.padMenu(p); else if (app.mode === 'play' && p.back && false) app.pause(); }
    if (app.mode !== 'play' || app.paused) Input.edge.clear();
    app.hudT -= dt; if (app.hudT <= 0 && app.game) { app.hudT = 0.1; UI.hudUpdate(app.game); }
    if (Input.touch.enabled && Input.touch.sync) { const th = app.touchF && app.touchF.g === app.game ? app.touchF.f : (app.touchF = { g: app.game, f: app.game && app.mode === 'play' ? app.game.fighters.find((x) => !x.isBot && x.def.slot === 0) : null }).f; if (th && app.mode === 'play') Input.touch.sync({ charge: th.alive && th.charging ? Math.min(1, th.chargeT / 0.7) : 0, dash: th.dashCd > 0 ? Math.min(1, th.dashCd / (0.95 * th.mods.dashCd)) : 0, defl: th.deflectCd > 0 ? Math.min(1, th.deflectCd / 0.85) : 0, ammo: th.alive ? th.ammo : 1 }); else Input.touch.sync(null); }
    const t1 = performance.now(); render(); const t2 = performance.now();
    prof.frames++; prof.sum += dt * 1000; prof.max = Math.max(prof.max, dt * 1000); prof.sim += t1 - t0; prof.rend += t2 - t1; if (dt > 0.034) prof.over++;
    adaptRes(dt * 1000);
  };
  requestAnimationFrame(frame);
  window.__bg = { buildBoomerang, camNow() { updateGfx(0, gfx.time || 0); }, buildFighter, faceAtlas: (id) => faceDebugCanvas(id).toDataURL(), snap, Game, HEROES, ARENAS, app, UI, S, Input, gfx, fx, prof, THREE, step(n = 1) { for (let i = 0; i < n; i++) app.game && app.game.update(STEP); }, renderNow() { fx.update(0); render(); }, resetProf() { prof.frames = prof.sum = prof.max = prof.sim = prof.rend = prof.over = 0; } };
}
try { boot(); } catch (e) { console.error(e); const l = $('#loading'); if (l) l.innerHTML = '<div class="errbox">Startup error: ' + e.message + '</div>'; }
