// WebAudio synthesized SFX + file loops for menu/battle (procedural fallback).
import { S } from './save.js';
import { TRIM, MTRIM } from './audiotrim.js';
let ctx = null, master, sfxBus, sfxVol, musBus, musVol, duckG, noiseBuf, delay, delayM, trimNodes = {}, satNode = null;
let enabled = true;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Builds the mixer graph on any (real or offline) context: sfx -> sfxVol -> master; music -> musBus(trim) -> musVol -> duck -> master; master -> [compressor] -> out
function setup(c, comp) {
  ctx = c; trimNodes = {};
  master = ctx.createGain(); master.gain.value = 0.8;
  sfxVol = ctx.createGain(); sfxBus = sfxVol; musBus = ctx.createGain(); musVol = ctx.createGain(); duckG = ctx.createGain();
  const sat = ctx.createWaveShaper(); { const n = 2048, cv = new Float32Array(n), k = 1.5, nn = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / nn; } sat.curve = cv; sat.oversample = audioSaver ? 'none' : '2x'; } satNode = sat;
  sfxVol.connect(sat); sat.connect(master); musBus.connect(musVol); musVol.connect(duckG); duckG.connect(master);
  if (comp) { const k = ctx.createDynamicsCompressor(); k.threshold.value = -14; k.ratio.value = 5; k.attack.value = 0.004; k.release.value = 0.2; master.connect(k); k.connect(ctx.destination); } else master.connect(ctx.destination);
  const mkDelay = (dest) => { const d = ctx.createDelay(1); d.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400; d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(dest); return d; };
  delay = mkDelay(sfxVol); delayM = mkDelay(musBus);
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) { const n = ctx.sampleRate * 1.5; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
}
export function initAudio() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    setup(new AC(), true); applyVolumes(); startScheduler(); kickFileMusic();
  } catch (e) { enabled = false; console.warn('audio init failed', e); }
}
export function applyVolumes() {
  if (!ctx || !sfxVol) return; const s = S().settings;
  const m = s.mute ? 0 : 1, mo = s.musicOn === false ? 0 : 1, so = s.sfxOn === false ? 0 : 1;
  const mv = s.master === undefined ? 1 : s.master;
  const sv = s.sfx === undefined ? 0.85 : s.sfx, musv = s.music === undefined ? 0.6 : s.music;
  master.gain.value = 0.8 * mv; sfxVol.gain.value = sv * m * so; musVol.gain.value = musv * 0.6 * m * mo;
}
let schedId = 0, audioSaver = false;
export function setAudioSaver(on) {
  const v = !!on; if (v === audioSaver) return; audioSaver = v;
  if (schedId) { clearInterval(schedId); schedId = 0; if (ctx) startScheduler(); }
  if (satNode) satNode.oversample = audioSaver ? 'none' : '2x';
}
export function audioState() {
  return {
    hasCtx: !!ctx, state: ctx ? ctx.state : 'none', music: curName, saver: !!audioSaver,
    schedMs: audioSaver ? 80 : 30, duck: duckG ? +duckG.gain.value.toFixed(3) : 1, lastDuck,
    sfxVol: sfxVol ? +sfxVol.gain.value.toFixed(3) : 0, musVol: musVol ? +musVol.gain.value.toFixed(3) : 0,
    master: master ? +master.gain.value.toFixed(3) : 0,
    musicKind: fileSrc ? 'file' : (cur ? 'synth' : (curName ? 'pending' : null)),
    filesReady: !!(filePcm.menu && filePcm.battle), fileErr: fileErr || null,
  };
}
export function suspendAudio() {
  if (schedId) { clearInterval(schedId); schedId = 0; }
  if (ctx && ctx.state === 'running') { try { const p = ctx.suspend(); p && p.catch && p.catch(() => {}); } catch (e) {} }
}
export function resumeAudio() {
  if (ctx && ctx.state !== 'running') { try { const p = ctx.resume(); p && p.catch && p.catch(() => {}); } catch (e) {} }
  if (ctx) { if (cur) startScheduler(); if (curName && MUSIC_FILES[curName] && !fileSrc) kickFileMusic(); }
}

function env(g, t, a, d, peak, sus = 0) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
}
function tone(f, t, dur, type = 'square', vol = 0.2, o = {}) {
  if (!ctx) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), t + dur);
  if (o.det) osc.detune.value = o.det;
  let last = osc;
  if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); fl.Q.value = o.q || 1; osc.connect(fl); last = fl; }
  last.connect(g); g.connect(o.bus || sfxBus);
  if (o.send && !audioSaver) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(o.bus === musBus ? delayM : delay); }
  env(g, t, o.a || 0.005, dur, vol * curGain);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(t, dur, vol = 0.3, o = {}) {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1500, t);
  if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur); f.Q.value = o.q || 0.7;
  const g = ctx.createGain(); src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
  env(g, t, o.a || 0.003, dur, vol * curGain);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

const lastPlay = {};
export const AU = { mute: false };
const DUCK = { hit: 0.45, ko: 0.5, koStinger: 0.4, explode: 0.4, ult: 0.45, hurt: 0.55, shatter: 0.6, fanfare: 0.5, win: 0.5, lose: 0.5 };
let curGain = 1, lastDuck = 1;
export const sfxTap = { fn: null };
export function sfx(name, p = 1) {
  if (sfxTap.fn) sfxTap.fn(name, p);
  if (!ctx || !enabled || AU.mute) return;
  const t = ctx.currentTime;
  if (lastPlay[name] && t - lastPlay[name] < 0.03) return; lastPlay[name] = t;
  if (DUCK[name]) { lastDuck = DUCK[name]; duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(DUCK[name], t); duckG.gain.linearRampToValueAtTime(1, t + 0.45); } else lastDuck = 1;
  curGain = TRIM_OVR ? (TRIM_OVR[name] || 1) : TRIM_OFF ? 1 : (TRIM[name] || 1);
  try { sfxInner(name, p, t); } finally { curGain = 1; }
}
let TRIM_OFF = false, TRIM_OVR = null;
function sfxInner(name, p, t) {
  const r = 0.92 + Math.random() * 0.16;
  switch (name) {
    case 'throw': { const c = Math.min(1, Math.max(0, p)); noise(t, 0.22 + c * 0.16, 0.42 + c * 0.16, { type: 'bandpass', f: (380 + c * 220) * r, fTo: 3200 + c * 1600, q: 1.8 }); tone((210 + c * 140) * r, t, 0.2, 'sine', 0.3, { to: 880 + c * 280 }); tone(1900 * r, t + 0.012, 0.06, 'triangle', 0.1, { to: 3200 }); tone(90, t, 0.08, 'sine', 0.12 + c * 0.08, { to: 50 }); break; }
    case 'charge': tone(200 + p * 500, t, 0.06, 'sine', 0.05); break;
    case 'whoosh': noise(t, 0.22, 0.22, { type: 'bandpass', f: 700, fTo: 2400, q: 1.6 }); tone(320, t, 0.16, 'sine', 0.08, { to: 140 }); break;
    case 'catch': { const k = Math.min(4, Math.max(0, Math.round(p) - 1));
      // feel414: a short wooden "clack" then a bright rising ping
      noise(t, 0.016, 0.42, { type: 'bandpass', f: 2400, fTo: 1400, q: 5 }); tone(2100, t, 0.028, 'square', 0.22, { to: 800, lp: 6000 });
      tone(mtof(81 + k * 2), t + 0.025, 0.07, 'triangle', 0.2, { lp: 5200 }); tone(mtof(88 + k * 2), t + 0.065, 0.16, 'triangle', 0.16, { lp: 4500, send: 0.22 }); tone(mtof(100 + k * 2), t + 0.1, 0.14, 'sine', 0.09, { send: 0.3 }); tone(220, t, 0.07, 'sine', 0.32, { to: 70 }); break; }
    case 'bounce': tone(520 * r, t, 0.1, 'triangle', 0.22, { to: 300 }); noise(t, 0.04, 0.15, { type: 'bandpass', f: 1800, q: 2 }); break;
    case 'hit': noise(t, 0.03, 0.55, { type: 'highpass', f: 5000 }); noise(t, 0.08, 0.62, { f: 1400, fTo: 180, q: 1.3 }); tone(180 * r, t, 0.18, 'sine', 0.95, { to: 42 }); tone(520 * r, t, 0.06, 'triangle', 0.28, { to: 140, lp: 2400 }); tone(1100, t, 0.035, 'square', 0.12, { to: 220, lp: 2800 }); break;
    case 'hurt': tone(330, t, 0.4, 'sawtooth', 0.2, { to: 70, lp: 1400, lpTo: 180 }); tone(110, t, 0.35, 'sine', 0.55, { to: 40 }); noise(t, 0.18, 0.35, { f: 900, fTo: 120 }); break;
    case 'koStinger': tone(mtof(55), t, 0.9, 'sawtooth', 0.18, { to: mtof(43), lp: 1800, lpTo: 200 }); [0, 7, 12].forEach((x, i) => tone(mtof(79 + x), t + 0.12 + i * 0.07, 0.3, 'square', 0.12, { lp: 3500, send: 0.5 })); noise(t, 0.5, 0.35, { f: 5000, fTo: 200 }); break;
    case 'slowmo': tone(900, t, 0.9, 'sine', 0.14, { to: 120, send: 0.5 }); noise(t, 0.8, 0.18, { type: 'bandpass', f: 2400, fTo: 160, q: 1.4 }); break;
    case 'fanfare': { const seq = [[0, 0], [0, 0.12], [0, 0.24], [4, 0.4], [7, 0.62], [12, 0.8]]; seq.forEach(([x, d], i) => { tone(mtof(72 + x), t + d, i === 5 ? 0.7 : 0.16, 'square', 0.15, { lp: 4200, send: 0.35 }); tone(mtof(60 + x), t + d, i === 5 ? 0.7 : 0.16, 'triangle', 0.14); }); noise(t + 0.8, 0.5, 0.18, { type: 'highpass', f: 6000 }); break; }
    case 'coin': { const k = Math.min(8, Math.max(0, Math.round(p))); tone(mtof(88 + k), t, 0.05, 'square', 0.09, { lp: 6000 }); tone(mtof(95 + k), t + 0.04, 0.09, 'square', 0.08, { lp: 6000 }); break; }
    case 'missionDone': [0, 4, 7, 12, 16].forEach((x, i) => tone(mtof(76 + x), t + i * 0.06, 0.2, 'triangle', 0.17, { send: 0.45 })); tone(mtof(52), t, 0.5, 'sine', 0.2); break;
    case 'magnet': tone(300, t, 0.3, 'sine', 0.14, { to: 900, send: 0.3 }); tone(600, t + 0.05, 0.2, 'triangle', 0.1, { to: 1500 }); break;
    case 'bubble': tone(500, t, 0.35, 'sine', 0.14, { to: 150, send: 0.5 }); tone(1000, t, 0.25, 'triangle', 0.08, { to: 300 }); break;
    case 'combo': { const k = Math.min(5, Math.max(1, Math.round(p))); [0, 4, 7, 12].slice(0, 2 + Math.min(2, k)).forEach((x, i) => tone(mtof(72 + x + k * 2), t + i * 0.05, 0.18, 'square', 0.13, { lp: 4500, send: 0.4 })); break; }
    case 'tickup': tone(mtof(84 + Math.min(12, Math.round(p))), t, 0.03, 'square', 0.05, { lp: 5000 }); break;
    case 'whoosh2': noise(t, 0.35, 0.22, { type: 'bandpass', f: 400, fTo: 3200, q: 2 }); break;
    case 'ko': noise(t, 0.08, 0.5, { type: 'highpass', f: 2800 }); tone(240, t, 0.12, 'sine', 0.55, { to: 70 }); tone(740, t, 0.1, 'triangle', 0.28, { to: 180, lp: 2600 }); tone(620, t + 0.06, 0.5, 'triangle', 0.22, { to: 80, lp: 1800, lpTo: 200 }); tone(1480, t + 0.02, 0.18, 'sine', 0.1, { to: 280 }); break;
    case 'dash': noise(t, 0.14, 0.38, { type: 'bandpass', f: 1800, fTo: 400, q: 1.2 }); tone(480, t, 0.11, 'sine', 0.16, { to: 130 }); tone(120, t, 0.08, 'sine', 0.14, { to: 60 }); break;
    case 'deflect': tone(1400, t, 0.25, 'triangle', 0.3, { to: 2400, send: 0.3 }); noise(t, 0.08, 0.3, { type: 'highpass', f: 4000 }); break;
    case 'deflectfail': tone(300, t, 0.08, 'square', 0.06, { to: 200 }); break;
    case 'pickup': { const b = 72 + Math.floor(Math.random() * 3); [0, 4, 7, 12].forEach((s, i) => tone(mtof(b + s), t + i * 0.05, 0.12, 'square', 0.13, { lp: 4000 })); break; }
    case 'spawn': tone(mtof(88), t, 0.12, 'sine', 0.1, { send: 0.3 }); break;
    case 'crate': noise(t, 0.2, 0.5, { f: 1500, fTo: 200 }); tone(120, t, 0.12, 'square', 0.2, { to: 60 }); break;
    case 'push': noise(t, 0.12, 0.25, { f: 400, fTo: 150 }); break;
    case 'explode': noise(t, 0.6, 0.9, { f: 3200 * r, fTo: 120, q: 0.9 }); tone(120 * r, t, 0.5, 'sine', 0.9, { to: 28 }); break;
    case 'edgetick': tone(1700, t, 0.045, 'square', 0.05); break;
    case 'edgesave': tone(520, t, 0.12, 'sine', 0.2, { to: 1040 }); tone(1040, t + 0.1, 0.2, 'triangle', 0.16, { to: 1560 }); break;
    case 'fall': tone(800, t, 0.7, 'sine', 0.25, { to: 80 }); break;
    case 'sizzle': noise(t, 0.4, 0.3, { type: 'highpass', f: 3000 }); tone(300, t, 0.4, 'sawtooth', 0.15, { to: 60, lp: 1200 }); break;
    case 'spike': tone(1200, t, 0.05, 'square', 0.1, { to: 600 }); noise(t, 0.05, 0.2, { type: 'highpass', f: 5000 }); break;
    case 'warn': tone(1500, t, 0.05, 'square', 0.04); break;
    case 'rumble': noise(t, 0.4, 0.3, { f: 200, fTo: 60 }); break;
    case 'shieldpop': noise(t, 0.12, 0.32, { type: 'highpass', f: 3500 }); tone(1560, t, 0.08, 'sine', 0.22); tone(1240, t, 0.22, 'triangle', 0.26, { to: 280, send: 0.25 }); tone(780, t + 0.04, 0.16, 'sine', 0.12, { to: 220 }); break;
    case 'click': tone(1640, t, 0.025, 'triangle', 0.1, { lp: 5000 }); tone(980, t, 0.04, 'sine', 0.06, { to: 600 }); break;
    case 'back': tone(700, t, 0.05, 'square', 0.08); tone(480, t + 0.04, 0.06, 'square', 0.07); break;
    case 'deny': tone(130, t, 0.18, 'square', 0.15, { lp: 600 }); break;
    case 'buy': [0, 4, 7, 12].forEach((s, i) => tone(mtof(72 + s), t + i * 0.06, 0.16, 'square', 0.14)); break;
    case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone(mtof(67 + s), t + i * 0.1, 0.25, 'square', 0.16, { lp: 3500, send: 0.3 })); break;
    case 'round': [0, 7, 12].forEach((s, i) => tone(mtof(72 + s), t + i * 0.09, 0.22, 'triangle', 0.2, { send: 0.3 })); break;
    case 'lose': [7, 3, 0, -5].forEach((s, i) => tone(mtof(60 + s), t + i * 0.2, 0.4, 'sawtooth', 0.16, { lp: 1500 })); break;
    case 'beep': tone(660, t, 0.16, 'square', 0.17); tone(330, t, 0.16, 'triangle', 0.1); break;
    case 'go': tone(1320, t, 0.5, 'square', 0.18, { send: 0.3 }); tone(1760, t, 0.5, 'triangle', 0.14); tone(660, t, 0.5, 'triangle', 0.1); break;
    case 'freeze': noise(t, 0.35, 0.35, { type: 'highpass', f: 5000, fTo: 9000 }); [0, 7, 12, 19].forEach((x, i) => tone(mtof(88 + x), t + i * 0.04, 0.25, 'sine', 0.12, { send: 0.5 })); break;
    case 'shatter': noise(t, 0.3, 0.7, { type: 'highpass', f: 3500, fTo: 9000 }); tone(2400 * r, t, 0.2, 'triangle', 0.25, { to: 500 }); tone(110, t, 0.2, 'sine', 0.5, { to: 45 }); break;
    case 'chain': tone(900 * r, t, 0.08, 'square', 0.14, { to: 1800 }); tone(1800, t + 0.06, 0.08, 'square', 0.1, { to: 900 }); break;
    case 'bumper': tone(300, t, 0.14, 'sine', 0.4, { to: 900 }); tone(1100, t + 0.04, 0.1, 'square', 0.1, { to: 1700 }); break;
    case 'meteorwarn': tone(1700, t, 0.5, 'sawtooth', 0.07, { to: 400, lp: 2500 }); noise(t, 0.5, 0.18, { type: 'bandpass', f: 1500, fTo: 300, q: 2 }); break;
    case 'wind': noise(t, 1.4, 0.35, { type: 'bandpass', f: 500, fTo: 1400, q: 1.2, a: 0.6 }); break;
    case 'tag': tone(220, t, 0.18, 'sawtooth', 0.22, { to: 110, lp: 1200 }); tone(880, t, 0.1, 'square', 0.13, { to: 440 }); noise(t, 0.12, 0.3, { type: 'bandpass', f: 1200 }); break;
    case 'tick': tone(1800, t, 0.03, 'square', 0.1); break;
    case 'zone': [0, 7].forEach((x, i) => tone(mtof(67 + x), t + i * 0.08, 0.2, 'triangle', 0.16, { send: 0.3 })); break;
    case 'zonepoint': tone(mtof(88), t, 0.07, 'triangle', 0.1); break;
    case 'ult': noise(t, 0.6, 0.55, { f: 6000, fTo: 200, q: 1 }); [0, 7, 12, 19, 24].forEach((x, i) => tone(mtof(60 + x), t + i * 0.05, 0.4, 'sawtooth', 0.13, { lp: 3500, send: 0.4 })); tone(70, t, 0.5, 'sine', 0.7, { to: 35 }); break;
    case 'ultready': [0, 4, 7, 12, 16].forEach((x, i) => tone(mtof(81 + x), t + i * 0.05, 0.16, 'triangle', 0.12, { send: 0.35, lp: 5000 })); tone(mtof(93), t + 0.22, 0.22, 'sine', 0.08, { send: 0.4 }); break;
    case 'emote': tone(mtof(84), t, 0.07, 'square', 0.1); tone(mtof(91), t + 0.06, 0.09, 'square', 0.1); break;
    case 'levelup': [0, 4, 7, 12, 16, 19].forEach((x, i) => tone(mtof(72 + x), t + i * 0.07, 0.22, 'square', 0.14, { lp: 4000, send: 0.4 })); break;
    case 'ach': [0, 7, 12].forEach((x, i) => tone(mtof(76 + x), t + i * 0.08, 0.2, 'triangle', 0.18, { send: 0.4 })); break;
    case 'announce': tone(mtof(64), t, 0.1, 'square', 0.12); tone(mtof(71), t + 0.08, 0.2, 'square', 0.12); break;
    case 'gust': noise(t, 0.5, 0.42, { type: 'bandpass', f: 380, fTo: 2600, q: 0.7 }); noise(t, 0.32, 0.2, { type: 'highpass', f: 1800, fTo: 5200 }); tone(390, t, 0.42, 'sine', 0.22, { to: 160, lp: 1400 }); tone(860, t + 0.05, 0.3, 'triangle', 0.1, { to: 480, send: 0.2 }); tone(180, t, 0.2, 'sine', 0.12, { to: 70 }); break;
    case 'trophy': [0, 4, 7, 12, 16, 19, 24].forEach((x, i) => tone(mtof(72 + x), t + i * 0.055, 0.22, 'triangle', 0.13, { lp: 4200, send: 0.35 })); tone(mtof(96), t + 0.34, 0.35, 'sine', 0.1, { send: 0.4 }); break;
    case 'ult_bao': tone(180, t, 0.28, 'sine', 0.45, { to: 70 }); tone(mtof(67), t, 0.2, 'triangle', 0.16, { send: 0.2 }); tone(mtof(74), t + 0.08, 0.22, 'triangle', 0.14); break;
    case 'ult_nori': noise(t, 0.28, 0.28, { type: 'bandpass', f: 900, fTo: 300, q: 1 }); tone(980, t, 0.12, 'sine', 0.12, { to: 220 }); break;
    case 'ult_tako': [0, 3, 7].forEach((x, i) => tone(mtof(79 + x), t + i * 0.04, 0.12, 'square', 0.12, { lp: 4000 })); noise(t, 0.08, 0.22, { type: 'highpass', f: 4000 }); break;
    case 'ult_kuma': tone(mtof(62), t, 0.16, 'triangle', 0.2, { to: mtof(69) }); tone(mtof(74), t + 0.1, 0.2, 'triangle', 0.16, { to: mtof(62), send: 0.25 }); tone(90, t, 0.22, 'sine', 0.28, { to: 50 }); break;
    case 'ult_pico': tone(mtof(84), t, 0.18, 'sine', 0.14, { send: 0.3 }); tone(mtof(91), t + 0.08, 0.2, 'sine', 0.12); noise(t, 0.1, 0.12, { type: 'highpass', f: 5000 }); break;
    case 'ult_yuki': tone(mtof(88), t, 0.28, 'sine', 0.14, { to: mtof(81), send: 0.4 }); tone(mtof(95), t + 0.05, 0.22, 'triangle', 0.1); noise(t, 0.16, 0.12, { type: 'bandpass', f: 6000, fTo: 2000, q: 3 }); break;
    case 'ult_gus': tone(110, t, 0.22, 'sine', 0.55, { to: 45 }); noise(t, 0.1, 0.3, { f: 600, fTo: 150 }); tone(mtof(55), t, 0.16, 'triangle', 0.18); break;
    case 'ult_wisp': tone(mtof(76), t, 0.3, 'sine', 0.12, { to: mtof(88), send: 0.45 }); tone(mtof(83), t + 0.08, 0.28, 'triangle', 0.1); noise(t, 0.22, 0.12, { type: 'bandpass', f: 3000, q: 2 }); break;
    default: if (String(name).startsWith('ult_')) { noise(t, 0.5, 0.4, { f: 5000, fTo: 200, q: 1 }); [0, 7, 12].forEach((x, i) => tone(mtof(60 + x), t + i * 0.05, 0.35, 'triangle', 0.12, { lp: 3000, send: 0.3 })); } break;
  }
}

// ---------------- Music ----------------
const M = [0, 3, 7], MJ = [0, 4, 7];
const TRACKS = {
  // sound425: original kids theme — a bouncy C-major hook (not a copy of any known tune). Menu is calm; battle is the same hook, a little livelier.
  menu: { bpm: 96, root: 48, chords: [[0, MJ], [2, M], [5, MJ], [0, MJ]], bass: '1.......5.......', arp: '0.2.4.2.0.2.3.0.', lead: '2.4.5.4.2.1.0.2.', kick: 'x...............', snare: '................', hat: '..x...x...x...x.', bw: 'sine', aw: 'sine', soft: 1 },
  battle: { bpm: 114, root: 48, chords: [[0, MJ], [2, M], [5, MJ], [7, MJ]], bass: '1.....5.1.....8.', arp: '0.2.4.2.0.2.3.4.', lead: '2.4.5.4.2.1.0.2.', kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bw: 'triangle', aw: 'sine' },
  dojo: { bpm: 112, root: 45, chords: [[0, M], [-2, MJ], [-4, MJ], [-5, MJ]], bass: '1.......5.......', arp: '0.2.1.3.0.2.1.0.', kick: 'x.......x.....x.', snare: '........x.......', hat: '..x...x...x...x.', bw: 'sine', aw: 'triangle' },
  rooftop: { bpm: 132, root: 40, chords: [[0, M], [0, M], [-4, MJ], [-2, MJ]], bass: '1.1.1.1.1.1.8.1.', arp: '0123012301230123', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bw: 'sawtooth', aw: 'square' },
  jungle: { bpm: 120, root: 43, chords: [[0, M], [-4, MJ], [-2, MJ], [-5, MJ]], bass: '1..1..5.1..1..8.', arp: '0.21.30.2.13.20.1', kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', bw: 'triangle', aw: 'sine' },
  ice: { bpm: 104, root: 47, chords: [[0, M], [-4, MJ], [3, MJ], [-2, MJ]], bass: '1.......5.......', arp: '0.1.2.3.2.1.0.1.', kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bw: 'sine', aw: 'triangle' },
  pond: { bpm: 100, root: 48, chords: [[0, MJ], [-5, MJ], [-3, M], [-7, MJ]], bass: '1.......5.......', arp: '0.2.1.3.0.2.1.0.', kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bw: 'sine', aw: 'triangle' },
  volcano: { bpm: 126, root: 38, chords: [[0, M], [1, MJ], [-2, M], [-4, MJ]], bass: '1.1.1.5.1.1.8.5.', arp: '0.2.3.2.0.2.3.5.', kick: 'x..xx...x..xx...', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', bw: 'sawtooth', aw: 'square' },
  pirate: { bpm: 118, root: 45, chords: [[0, M], [-2, MJ], [-4, MJ], [-2, MJ]], bass: '1..5..1..5..8.5.', arp: '0.2.4.2.0.2.4.2.', kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bw: 'triangle', aw: 'square' },
  space: { bpm: 128, root: 41, chords: [[0, M], [-3, MJ], [-5, MJ], [-7, M]], bass: '1...1...5...1.8.', arp: '0.3.5.3.0.3.5.7.', kick: 'x...x...x...x...', snare: '........x.......', hat: '..x.x.x...x.x.xx', bw: 'sine', aw: 'sawtooth' },
  haunted: { bpm: 100, root: 43, chords: [[0, M], [1, MJ], [0, M], [-2, M]], bass: '1.......5...1...', arp: '0.2.1.2.3.2.1.0.', kick: 'x.......x.......', snare: '............x...', hat: '..x...x...x...x.', bw: 'triangle', aw: 'sine' },
  boss: { bpm: 144, root: 38, chords: [[0, M], [-2, MJ], [-4, MJ], [-5, M]], bass: '1.1.1.8.1.1.5.8.', arp: '0.2.1.3.0.2.3.1.', kick: 'x..xx..xx..xx.x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bw: 'sawtooth', aw: 'sawtooth' },
  bomb: { bpm: 140, root: 41, chords: [[0, M], [1, M], [0, M], [-2, MJ]], bass: '1.1.1.1.1.1.8.8.', arp: '0.1.2.1.0.1.2.3.', kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bw: 'square', aw: 'square' },
  koth: { bpm: 124, root: 43, chords: [[0, MJ], [-3, M], [-5, MJ], [-7, MJ]], bass: '1.1.5.1.1.1.8.5.', arp: '0.12.3.21.0.12.3.2', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bw: 'triangle', aw: 'square' },
  win: { bpm: 120, root: 48, chords: [[0, MJ], [-5, MJ], [-3, M], [-7, MJ]], bass: '1...5...1...5...', arp: '0123201302310213', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bw: 'triangle', aw: 'square' },
};
let cur = null, curName = null, step = 0, nextT = 0, tempoMul = 1, musicOn = true, inten = 0;
export function setIntensity(x) { inten = x; }
export const MUSIC_FILES = { menu: 'music/menu.ogg', battle: 'music/battle.ogg' };
export const MUSIC_CREDITS = [
  { track: 'menu', title: 'Happy Clappy Loop', author: 'OwlishMedia', license: 'CC0 1.0', url: 'https://opengameart.org/content/happy-clappy-loop' },
  { track: 'battle', title: "Children's Game Music 2 - Adventure", author: 'heartade', license: 'CC0 1.0', url: 'https://opengameart.org/content/childrens-game-music-2-adventure' },
];
let filePcm = {}, fileSrc = null, fileLoad = null, fileErr = null;
function trackUrl(rel) { try { return new URL(rel, (typeof document !== 'undefined' && document.baseURI) || './').href; } catch (e) { return rel; } }
function stopFileMusic() { if (fileSrc) { try { fileSrc.stop(); } catch (e) {} try { fileSrc.disconnect(); } catch (e) {} fileSrc = null; } }
function storePcm(name, buf) {
  const ch = []; for (let i = 0; i < buf.numberOfChannels; i++) ch.push(buf.getChannelData(i).slice());
  filePcm[name] = { sr: buf.sampleRate, ch };
}
function bufferOn(ctx, name) {
  const p = filePcm[name]; if (!p) return null;
  const b = ctx.createBuffer(p.ch.length, p.ch[0].length, p.sr);
  p.ch.forEach((c, i) => b.copyToChannel(c, i));
  return b;
}
function startFileMusic(name) {
  if (!ctx || !musBus || !filePcm[name]) return false;
  stopFileMusic();
  const buf = bufferOn(ctx, name); if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = buf.duration;
  src.connect(musBus);
  musBus.gain.value = (MTRIM[name] || 1);
  try { src.start(0); } catch (e) { return false; }
  fileSrc = src;
  src.onended = () => { if (fileSrc === src) fileSrc = null; };
  return true;
}
function kickFileMusic() {
  if (!ctx) return;
  const want = curName;
  if (!want || !MUSIC_FILES[want]) return;
  if (filePcm[want]) { startFileMusic(want); return; }
  loadFileMusic().then(() => { if (curName === want) startFileMusic(want); }).catch(() => {});
}
function loadFileMusic() {
  if (fileLoad) return fileLoad;
  fileLoad = (async () => {
    const AC = ctx;
    const jobs = Object.entries(MUSIC_FILES).map(async ([name, rel]) => {
      const r = await fetch(trackUrl(rel));
      if (!r.ok) throw new Error('music ' + name + ' ' + r.status);
      const arr = await r.arrayBuffer();
      const buf = await AC.decodeAudioData(arr.slice(0));
      storePcm(name, buf);
    });
    try { await Promise.all(jobs); fileErr = null; }
    catch (e) { fileErr = String(e && e.message || e); fileLoad = null; throw e; }
  })();
  return fileLoad;
}
export function music(name) {
  if (name === curName) return;
  curName = name; step = 0;
  if (!name) { cur = null; stopFileMusic(); stopScheduler(); return; }
  if (MUSIC_FILES[name]) {
    cur = null; stopScheduler();
    if (ctx) {
      if (filePcm[name]) startFileMusic(name);
      else {
        // Load only after a context exists (first tap). Fall back to the old synth if the file cannot be fetched.
        kickFileMusic();
        loadFileMusic().catch(() => {
          if (curName !== name) return;
          cur = TRACKS[name] || TRACKS.dojo;
          if (musBus) musBus.gain.value = (MTRIM[name] || 1);
          startScheduler();
        });
      }
    }
    return;
  }
  stopFileMusic();
  cur = TRACKS[name] || TRACKS.dojo;
  if (ctx) { nextT = ctx.currentTime + 0.1; if (musBus) musBus.gain.value = (MTRIM[name] || 1); startScheduler(); }
}
export function setTempo(m) { tempoMul = m; }
export function musicName() { return curName; }
function stopScheduler() { if (schedId) { clearInterval(schedId); schedId = 0; } }
function startScheduler() { if (schedId || !ctx || !cur) return; nextT = ctx.currentTime + 0.1; schedId = setInterval(sched, audioSaver ? 80 : 30); }
function sched() {
  if (!ctx || ctx.state !== 'running' || !cur) { if (ctx && cur && nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05; return; }
  while (nextT < ctx.currentTime + 0.14) musicStep(cur);
}
function musicStep(tr) {
  const sd = 60 / (tr.bpm * tempoMul) / 4, s = step % 16, bar = Math.floor(step / 16) % tr.chords.length, t = nextT;
  const [cr, ct] = tr.chords[bar]; const root = tr.root + cr; const bc = tr.bass[s];
  const send = audioSaver ? 0 : 0.32;
  // soft mix: warm bass, gentle plucked arp, quiet drums. sound425 lead hook on menu/battle.
  if (bc && bc !== '.') { const off = bc === '5' ? 7 : bc === '8' ? 12 : 0; tone(mtof(root + off), t, sd * 1.8, tr.bw === 'square' || tr.bw === 'sawtooth' ? 'triangle' : tr.bw, tr.soft ? 0.24 : 0.3, { lp: 650, lpTo: 200, bus: musBus }); }
  const ac = tr.arp[s];
  if (ac && ac !== '.' && ac !== ' ') { const k = +ac; const note = root + 24 + ct[k % 3] + (k >= 3 ? 12 : 0); tone(mtof(note), t, sd * 1.4, tr.aw === 'sawtooth' ? 'triangle' : tr.aw, tr.soft ? 0.06 : 0.08, { lp: 2400, lpTo: 800, send, bus: musBus }); }
  if (tr.lead && tr.lead[s] && tr.lead[s] !== '.') {
    const deg = [0, 2, 4, 7, 9, 12, 14, 16][+tr.lead[s] % 8];
    tone(mtof(root + 24 + deg), t, sd * 2.2, 'sine', tr.soft ? 0.09 : 0.11, { lp: 3200, lpTo: 900, send: send * 0.8, bus: musBus, a: 0.01 });
  }
  if (tr.kick[s] === 'x') tone(140, t, 0.15, 'sine', tr.soft ? 0.32 : 0.48, { to: 42, bus: musBus });
  if (tr.snare[s] === 'x') { noise(t, 0.1, 0.16, { type: 'bandpass', f: 1800, q: 0.8, bus: musBus }); tone(190, t, 0.07, 'triangle', 0.1, { to: 120, bus: musBus }); }
  if (tr.hat[s] === 'x') noise(t, 0.03, tr.soft ? 0.035 : 0.05, { type: 'highpass', f: 7500, bus: musBus });
  if (!audioSaver) {
    if (inten > 0.4 && s % 2 === 1) noise(t, 0.03, 0.04 * inten, { type: 'highpass', f: 8000, bus: musBus });
    if (inten > 0.55 && (s === 6 || s === 14)) tone(mtof(root + 12 + ct[1]), t, sd * 2, 'triangle', 0.06, { lp: 2200, send, bus: musBus });
    if (inten > 0.8 && s % 4 === 2) tone(mtof(root + 36 + ct[(s / 2) % 3]), t, sd * 1.2, 'triangle', 0.04, { lp: 4000, send, bus: musBus });
    if (inten > 0.9 && s % 8 === 0) tone(mtof(root - 12), t, sd * 6, 'triangle', 0.12, { lp: 500, bus: musBus });
    if (s === 0 && bar % 2 === 0) tone(mtof(root + 12 + ct[2]), t, sd * 14, 'triangle', 0.05, { send: send * 0.6, bus: musBus, a: 0.3 });
    if ((tr === TRACKS.ice || tr === TRACKS.haunted || tr === TRACKS.space) && s % 4 === 0) tone(mtof(root + 36 + ct[(s / 4) % 3]), t, sd * 3, 'sine', 0.07, { send: send * 1.4, bus: musBus });
  }
  nextT += sd; step++;
}

// ---------------- Loudness measurement (used by tools/v33audio.mjs; offline, nothing is audible) ----------------
export const SFX_NAMES = ["throw", "charge", "whoosh", "catch", "bounce", "hit", "hurt", "koStinger", "slowmo", "fanfare", "coin", "missionDone", "magnet", "bubble", "combo", "tickup", "whoosh2", "ko", "dash", "deflect", "deflectfail", "pickup", "spawn", "crate", "push", "explode", "fall", "sizzle", "spike", "warn", "rumble", "shieldpop", "click", "back", "deny", "buy", "win", "round", "lose", "beep", "go", "freeze", "shatter", "chain", "bumper", "meteorwarn", "wind", "tag", "tick", "zone", "zonepoint", "ult", "ultready", "emote", "levelup", "ach", "announce", "gust", "trophy", "ult_bao", "ult_nori", "ult_tako", "ult_kuma", "ult_pico", "ult_yuki", "ult_gus", "ult_wisp"];
export const TRACK_NAMES = () => Object.keys(TRACKS);
async function offline(seconds, sr, fn) {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; const saved = { ctx, master, sfxBus, sfxVol, musBus, musVol, duckG, delay, delayM, trimNodes };
  const oc = new OC(1, Math.ceil(seconds * sr), sr); setup(oc, false); sfxVol.gain.value = 1; musVol.gain.value = 1;
  try { fn(oc); const buf = await oc.startRendering(); return buf.getChannelData(0); } finally { ({ ctx, master, sfxBus, sfxVol, musBus, musVol, duckG, delay, delayM, trimNodes } = saved); }
}
function stats(d, sr) { // peak dBFS and loudest 250 ms RMS dBFS
  let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
  const w = Math.floor(sr * 0.25); let best = 0; for (let i = 0; i + w <= d.length; i += w >> 1) { let e = 0; for (let j = 0; j < w; j++) e += d[i + j] * d[i + j]; best = Math.max(best, e / w); }
  return { peak: 20 * Math.log10(pk + 1e-9), rms: 10 * Math.log10(best + 1e-12) };
}
export async function renderSfxSequence(steps, sr = 44100) {
  // steps: [{ name, t, p }] scheduled on an OfflineAudioContext. Returns Float32Array.
  const dur = (steps.length ? Math.max(...steps.map((s) => s.t)) : 0) + 0.7;
  const prevEn = enabled, prevMute = AU.mute; enabled = true; AU.mute = false;
  try {
    return await offline(dur, sr, () => {
      for (const st of steps) { for (const k in lastPlay) delete lastPlay[k]; const t0 = st.t || 0; const p = st.p == null ? 1 : st.p; const n = st.name; if (DUCK[n]) { duckG.gain.setValueAtTime(DUCK[n], t0); duckG.gain.linearRampToValueAtTime(1, t0 + 0.4); } curGain = TRIM_OFF ? 1 : (TRIM[n] || 1); try { sfxInner(n, p, t0); } finally { curGain = 1; } }
    });
  } finally { enabled = prevEn; AU.mute = prevMute; }
}
export async function measureSfx(names, trims = null, reps = 3) {
  const sr = 32000, out = {}; const names2 = names || SFX_NAMES; const prevOvr = TRIM_OVR; TRIM_OVR = trims; const prevEn = enabled; enabled = true; const prevMute = AU.mute; AU.mute = false;
  try { for (const n of names2) { let worst = null; for (let k = 0; k < reps; k++) { for (const p of [0.2, 1, 3]) { for (const key in lastPlay) delete lastPlay[key]; const d = await offline(2.6, sr, () => { sfx(n, p); }); const st = stats(d, sr); if (!worst || st.rms > worst.rms) worst = st; if (!worst.peak || st.peak > worst.peak) worst.peak = st.peak; } } out[n] = worst; } } finally { TRIM_OVR = prevOvr; enabled = prevEn; AU.mute = prevMute; }
  return out;
}
export async function measureMusic(trims = null, level = 0) {
  const sr = 32000, out = {}; const sc = { cur, curName, step, nextT, inten, tempoMul };
  try { for (const n of Object.keys(TRACKS)) { inten = level; tempoMul = 1; const d = await offline(14, sr, () => { cur = TRACKS[n]; step = 0; nextT = 0.05; musBus.gain.value = trims ? (trims[n] || 1) : (MTRIM[n] || 1); while (nextT < 13.5) musicStep(cur); }); out[n] = stats(d, sr); } } finally { ({ cur, curName, step, nextT, inten, tempoMul } = sc); }
  return out;
}

export async function renderMusicClip(name, seconds = 30, sr = 44100) {
  const prevEn = enabled, prevMute = AU.mute; enabled = true; AU.mute = false;
  const sc = { cur, curName, step, nextT, inten, tempoMul };
  try {
    if (MUSIC_FILES[name]) {
      if (!filePcm[name] && ctx) { try { await loadFileMusic(); } catch (e) {} }
      if (filePcm[name]) {
        return await offline(seconds, sr, (oc) => {
          musBus.gain.value = (MTRIM[name] || 1); musVol.gain.value = 1; sfxVol.gain.value = 1;
          const buf = bufferOn(oc, name); const src = oc.createBufferSource();
          src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = buf.duration;
          src.connect(musBus); src.start(0);
        });
      }
    }
    const tr = TRACKS[name] || TRACKS.menu;
    return await offline(seconds, sr, () => {
      inten = 0; tempoMul = 1; cur = tr; curName = name; step = 0; nextT = 0.05;
      musBus.gain.value = (MTRIM[name] || 1); musVol.gain.value = 1; sfxVol.gain.value = 1;
      while (nextT < seconds - 0.15) musicStep(cur);
    });
  } finally { enabled = prevEn; AU.mute = prevMute; ({ cur, curName, step, nextT, inten, tempoMul } = sc); }
}
