// WebAudio synthesized SFX + procedural music. No external assets.
import { S } from './save.js';
import { TRIM, MTRIM } from './audiotrim.js';
let ctx = null, master, sfxBus, sfxVol, musBus, musVol, duckG, noiseBuf, delay, delayM, trimNodes = {};
let enabled = true;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Builds the mixer graph on any (real or offline) context: sfx -> sfxVol -> master; music -> musBus(trim) -> musVol -> duck -> master; master -> [compressor] -> out
function setup(c, comp) {
  ctx = c; trimNodes = {};
  master = ctx.createGain(); master.gain.value = 0.8;
  sfxVol = ctx.createGain(); sfxBus = sfxVol; musBus = ctx.createGain(); musVol = ctx.createGain(); duckG = ctx.createGain();
  const sat = ctx.createWaveShaper(); { const n = 2048, cv = new Float32Array(n), k = 1.5, nn = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / nn; } sat.curve = cv; sat.oversample = '2x'; }
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
    setup(new AC(), true); applyVolumes(); startScheduler();
  } catch (e) { enabled = false; console.warn('audio init failed', e); }
}
export function applyVolumes() {
  if (!ctx || !sfxVol) return; const s = S().settings;
  const m = s.mute ? 0 : 1, mo = s.musicOn === false ? 0 : 1, mv = s.master === undefined ? 1 : s.master; master.gain.value = 0.8 * mv; sfxVol.gain.value = s.sfx * m; musVol.gain.value = s.music * 0.6 * m * mo;
}
export function resumeAudio() { if (ctx && ctx.state !== 'running') { try { const p = ctx.resume(); p && p.catch && p.catch(() => {}); } catch (e) {} } }

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
  if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(o.bus === musBus ? delayM : delay); }
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
let curGain = 1;
export const sfxTap = { fn: null };
export function sfx(name, p = 1) {
  if (sfxTap.fn) sfxTap.fn(name, p);
  if (!ctx || !enabled || AU.mute) return;
  const t = ctx.currentTime;
  if (lastPlay[name] && t - lastPlay[name] < 0.03) return; lastPlay[name] = t;
  if (DUCK[name]) { duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(DUCK[name], t); duckG.gain.linearRampToValueAtTime(1, t + 0.45); }
  curGain = TRIM_OVR ? (TRIM_OVR[name] || 1) : TRIM_OFF ? 1 : (TRIM[name] || 1);
  try { sfxInner(name, p, t); } finally { curGain = 1; }
}
let TRIM_OFF = false, TRIM_OVR = null;
function sfxInner(name, p, t) {
  const r = 0.92 + Math.random() * 0.16;
  switch (name) {
    case 'throw': { const c = Math.min(1, Math.max(0, p)); noise(t, 0.3 + c * 0.15, 0.34 + c * 0.14, { type: 'bandpass', f: (420 + c * 260) * r, fTo: 2800 + c * 1400, q: 2.6 }); tone((230 + c * 120) * r, t, 0.24, 'sine', 0.24, { to: 760 + c * 340 }); tone(1500 * r, t + 0.02, 0.07, 'triangle', 0.07, { to: 2600 }); break; }
    case 'charge': tone(200 + p * 500, t, 0.06, 'sine', 0.05); break;
    case 'whoosh': noise(t, 0.2, 0.12, { type: 'bandpass', f: 900, fTo: 1800, q: 3 }); break;
    case 'catch': { const k = Math.min(4, Math.max(0, Math.round(p) - 1)); tone(mtof(79 + k * 2), t, 0.07, 'square', 0.15, { lp: 5000 }); tone(mtof(86 + k * 2), t + 0.05, 0.16, 'square', 0.14, { lp: 4200, send: 0.25 }); tone(mtof(98 + k * 2), t + 0.09, 0.14, 'sine', 0.07, { send: 0.4 }); tone(180, t, 0.09, 'sine', 0.35, { to: 70 }); noise(t, 0.05, 0.22, { type: 'highpass', f: 3500 }); break; }
    case 'bounce': tone(520 * r, t, 0.1, 'triangle', 0.22, { to: 300 }); noise(t, 0.04, 0.15, { type: 'bandpass', f: 1800, q: 2 }); break;
    case 'hit': noise(t, 0.34, 0.75, { f: 3400, fTo: 140, q: 0.9 }); tone(170 * r, t, 0.34, 'sine', 0.9, { to: 38 }); tone(950, t, 0.09, 'square', 0.2, { to: 180 }); noise(t, 0.05, 0.5, { type: 'highpass', f: 5000 }); tone(mtof(64) * r, t + 0.02, 0.18, 'triangle', 0.18, { to: 90 }); break;
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
    case 'ko': tone(700, t, 0.6, 'sawtooth', 0.22, { to: 90, lp: 2200, lpTo: 200 }); tone(1400, t + 0.02, 0.35, 'triangle', 0.14, { to: 220 }); break;
    case 'dash': noise(t, 0.16, 0.3, { type: 'bandpass', f: 1500, fTo: 500, q: 1.5 }); tone(400, t, 0.12, 'sine', 0.12, { to: 160 }); break;
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
    case 'shieldpop': noise(t, 0.2, 0.4, { type: 'highpass', f: 3000 }); tone(1200, t, 0.25, 'triangle', 0.25, { to: 300 }); break;
    case 'click': tone(900, t, 0.04, 'square', 0.08); tone(1350, t + 0.025, 0.05, 'square', 0.06); break;
    case 'back': tone(700, t, 0.05, 'square', 0.08); tone(480, t + 0.04, 0.06, 'square', 0.07); break;
    case 'deny': tone(130, t, 0.18, 'square', 0.15, { lp: 600 }); break;
    case 'buy': [0, 4, 7, 12].forEach((s, i) => tone(mtof(72 + s), t + i * 0.06, 0.16, 'square', 0.14)); break;
    case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone(mtof(67 + s), t + i * 0.1, 0.25, 'square', 0.16, { lp: 3500, send: 0.3 })); break;
    case 'round': [0, 7, 12].forEach((s, i) => tone(mtof(72 + s), t + i * 0.09, 0.22, 'triangle', 0.2, { send: 0.3 })); break;
    case 'lose': [7, 3, 0, -5].forEach((s, i) => tone(mtof(60 + s), t + i * 0.2, 0.4, 'sawtooth', 0.16, { lp: 1500 })); break;
    case 'beep': tone(660, t, 0.12, 'square', 0.14); break;
    case 'go': tone(990, t, 0.4, 'square', 0.16, { send: 0.3 }); tone(1320, t, 0.4, 'triangle', 0.12); break;
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
    case 'ultready': [0, 4, 7, 12, 16].forEach((x, i) => tone(mtof(79 + x), t + i * 0.045, 0.14, 'square', 0.1, { send: 0.4 })); break;
    case 'emote': tone(mtof(84), t, 0.07, 'square', 0.1); tone(mtof(91), t + 0.06, 0.09, 'square', 0.1); break;
    case 'levelup': [0, 4, 7, 12, 16, 19].forEach((x, i) => tone(mtof(72 + x), t + i * 0.07, 0.22, 'square', 0.14, { lp: 4000, send: 0.4 })); break;
    case 'ach': [0, 7, 12].forEach((x, i) => tone(mtof(76 + x), t + i * 0.08, 0.2, 'triangle', 0.18, { send: 0.4 })); break;
    case 'announce': tone(mtof(64), t, 0.1, 'square', 0.12); tone(mtof(71), t + 0.08, 0.2, 'square', 0.12); break;
  }
}

// ---------------- Music ----------------
const M = [0, 3, 7], MJ = [0, 4, 7];
const TRACKS = {
  menu: { bpm: 108, root: 48, chords: [[0, MJ], [-3, M], [-7, MJ], [-5, MJ]], bass: '1.1.5.1.1.1.8.5.', arp: '0.12.3.21.0.12.3.2', kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', bw: 'triangle', aw: 'square' },
  dojo: { bpm: 112, root: 45, chords: [[0, M], [-2, MJ], [-4, MJ], [-5, MJ]], bass: '1.......5.......', arp: '0.2.1.3.0.2.1.0.', kick: 'x.......x.....x.', snare: '........x.......', hat: '..x...x...x...x.', bw: 'sine', aw: 'triangle' },
  rooftop: { bpm: 132, root: 40, chords: [[0, M], [0, M], [-4, MJ], [-2, MJ]], bass: '1.1.1.1.1.1.8.1.', arp: '0123012301230123', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bw: 'sawtooth', aw: 'square' },
  jungle: { bpm: 120, root: 43, chords: [[0, M], [-4, MJ], [-2, MJ], [-5, MJ]], bass: '1..1..5.1..1..8.', arp: '0.21.30.2.13.20.1', kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', bw: 'triangle', aw: 'sine' },
  ice: { bpm: 104, root: 47, chords: [[0, M], [-4, MJ], [3, MJ], [-2, MJ]], bass: '1.......5.......', arp: '0.1.2.3.2.1.0.1.', kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bw: 'sine', aw: 'triangle' },
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
export function music(name) {
  if (name === curName) return; curName = name; cur = name ? (TRACKS[name] || TRACKS.dojo) : null; step = 0; if (ctx) { nextT = ctx.currentTime + 0.1; if (musBus) musBus.gain.value = (name && MTRIM[name]) || 1; }
}
export function setTempo(m) { tempoMul = m; }
export function musicName() { return curName; }
function startScheduler() { nextT = ctx.currentTime + 0.1; setInterval(sched, 30); }
function sched() {
  if (!ctx || ctx.state !== 'running' || !cur) { if (ctx && cur && nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05; return; }
  while (nextT < ctx.currentTime + 0.14) musicStep(cur);
}
function musicStep(tr) {
  const sd = 60 / (tr.bpm * tempoMul) / 4, s = step % 16, bar = Math.floor(step / 16) % tr.chords.length, t = nextT;
  const [cr, ct] = tr.chords[bar]; const root = tr.root + cr; const bc = tr.bass[s];
  // soft mix: warm bass, gentle plucked arp, quiet drums (v3.3)
  if (bc && bc !== '.') { const off = bc === '5' ? 7 : bc === '8' ? 12 : 0; tone(mtof(root + off), t, sd * 1.8, tr.bw === 'square' || tr.bw === 'sawtooth' ? 'triangle' : tr.bw, 0.3, { lp: 650, lpTo: 200, bus: musBus }); }
  const ac = tr.arp[s];
  if (ac && ac !== '.' && ac !== ' ') { const k = +ac; const note = root + 24 + ct[k % 3] + (k >= 3 ? 12 : 0); tone(mtof(note), t, sd * 1.4, tr.aw === 'sawtooth' ? 'triangle' : tr.aw, 0.085, { lp: 2600, lpTo: 800, send: 0.38, bus: musBus }); }
  if (tr.kick[s] === 'x') tone(140, t, 0.15, 'sine', 0.5, { to: 42, bus: musBus });
  if (tr.snare[s] === 'x') { noise(t, 0.12, 0.2, { type: 'bandpass', f: 1800, q: 0.8, bus: musBus }); tone(190, t, 0.07, 'triangle', 0.12, { to: 120, bus: musBus }); }
  if (tr.hat[s] === 'x') noise(t, 0.035, 0.06, { type: 'highpass', f: 7500, bus: musBus });
  if (inten > 0.4 && s % 2 === 1) noise(t, 0.03, 0.05 * inten, { type: 'highpass', f: 8000, bus: musBus });
  if (inten > 0.55 && (s === 6 || s === 14)) tone(mtof(root + 12 + ct[1]), t, sd * 2, 'triangle', 0.07, { lp: 2200, send: 0.3, bus: musBus });
  if (inten > 0.8 && s % 4 === 2) tone(mtof(root + 36 + ct[(s / 2) % 3]), t, sd * 1.2, 'triangle', 0.045, { lp: 4000, send: 0.4, bus: musBus });
  if (inten > 0.9 && s % 8 === 0) tone(mtof(root - 12), t, sd * 6, 'triangle', 0.14, { lp: 500, bus: musBus });
  if (s === 0 && bar % 2 === 0) tone(mtof(root + 12 + ct[2]), t, sd * 14, 'triangle', 0.06, { send: 0.2, bus: musBus, a: 0.3 });
  if ((tr === TRACKS.ice || tr === TRACKS.haunted || tr === TRACKS.space) && s % 4 === 0) tone(mtof(root + 36 + ct[(s / 4) % 3]), t, sd * 3, 'sine', 0.08, { send: 0.6, bus: musBus });
  nextT += sd; step++;
}

// ---------------- Loudness measurement (used by tools/v33audio.mjs; offline, nothing is audible) ----------------
export const SFX_NAMES = ["throw", "charge", "whoosh", "catch", "bounce", "hit", "hurt", "koStinger", "slowmo", "fanfare", "coin", "missionDone", "magnet", "bubble", "combo", "tickup", "whoosh2", "ko", "dash", "deflect", "deflectfail", "pickup", "spawn", "crate", "push", "explode", "fall", "sizzle", "spike", "warn", "rumble", "shieldpop", "click", "back", "deny", "buy", "win", "round", "lose", "beep", "go", "freeze", "shatter", "chain", "bumper", "meteorwarn", "wind", "tag", "tick", "zone", "zonepoint", "ult", "ultready", "emote", "levelup", "ach", "announce"];
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
