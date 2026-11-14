// LOCAL-dev-feel414: local-only cosmetic game feel (shake, hit-stop, squash, vibration).
// Never sent over the network. Respects Settings + prefers-reduced-motion.
import { S } from './save.js';
import { shake, punch, gfx, prefersReducedMotion } from './gfx.js';
import { fx } from './fx.js';

export const FEEL = {
  TRAUMA_CAP: 0.65,     // max camera trauma (about 8–10 px of shake on a phone)
  PUNCH_CAP: 0.22,      // max directional camera kick, world units
  SHAKE: { throw: 0.03, catch: 0.08, hit: 0.22, melee: 0.16, parry: 0.14, shield: 0.10, special: 0.12, ko: 0.28, dash: 0.04, explode: 0.35 },
  PUNCH: { hit: 0.22, melee: 0.18, ko: 0.22, parry: 0.12, shield: 0.08 },
  HITSTOP: { hit: 0.055, melee: 0.05, parry: 0.06, ko: 0.10, explode: 0.07 }, // seconds (hit ≈ 55 ms, KO ≈ 100 ms)
  VIBE: {
    throw: 8,
    catch: [8, 30, 18],
    hit: 18,
    hurt: 28,
    melee: 16,
    parry: 12,
    shield: 14,
    special: 22,
    ko: [25, 50, 40],
  },
  SQUASH: {
    hit: { sx: 1.16, sy: 0.82, dur: 0.16 },
    catch: { sx: 0.90, sy: 1.16, dur: 0.18 },
    special: { sx: 1.10, sy: 1.10, dur: 0.14 },
    shield: { sx: 1.12, sy: 0.90, dur: 0.12 },
  },
};

export const feelLog = [];
export let lastFeel = null;
let vibeImpl = null;
export function setVibeImpl(fn) { vibeImpl = fn; }
export function clearFeelLog() { feelLog.length = 0; lastFeel = null; }
export function getLastFeel() { return lastFeel; }

export function canVibrate() {
  try {
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H && (H.impact || H.vibrate)) return 'haptics';
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return 'vibrate';
  } catch (e) {}
  return '';
}

export function vibe(pattern) {
  if (!S().settings.vibrate) return false;
  if (!pattern || (Array.isArray(pattern) && !pattern.length) || pattern === 0) return false;
  if (vibeImpl) { try { vibeImpl(pattern); } catch (e) {} return true; }
  const kind = canVibrate();
  try {
    if (kind === 'haptics') {
      const H = window.Capacitor.Plugins.Haptics;
      const max = Array.isArray(pattern) ? Math.max(...pattern.filter((_, i) => i % 2 === 0)) : +pattern;
      const style = max >= 30 ? 'HEAVY' : max >= 16 ? 'MEDIUM' : 'LIGHT';
      if (H.impact) H.impact({ style });
      else if (H.vibrate) H.vibrate();
      return true;
    }
    if (kind === 'vibrate') { navigator.vibrate(pattern); return true; }
  } catch (e) {}
  return false;
}

function isLocal(f) { return !!(f && !f.isBot && f.def && f.def.slot === 0); }
function involvesLocal(o) { return isLocal(o.f) || isLocal(o.killer); }

export function squash(f, kind) {
  if (!f) return null;
  const s = FEEL.SQUASH[kind]; if (!s) return null;
  const reduced = prefersReducedMotion();
  f.squashSx = reduced ? 1 + (s.sx - 1) * 0.35 : s.sx;
  f.squashSy = reduced ? 1 + (s.sy - 1) * 0.35 : s.sy;
  f.squashT = s.dur; f.squashDur = s.dur;
  return { sx: f.squashSx, sy: f.squashSy, dur: s.dur };
}

export function applySquash(f, dt) {
  if (!f || !(f.squashT > 0) || !f.model || !f.model.root) return;
  const dur = f.squashDur || 0.16;
  const p = Math.max(0, f.squashT / dur); // 1 at start → 0
  const e = p * p; // snaps back quickly
  const r = f.model.root;
  r.scale.x *= 1 + (f.squashSx - 1) * e;
  r.scale.z *= 1 + (f.squashSx - 1) * e;
  r.scale.y *= 1 + (f.squashSy - 1) * e;
  f.squashT -= dt;
  if (f.squashT <= 0) { f.squashT = 0; }
}

export function feel(kind, o = {}) {
  const g = o.game;
  const reduced = prefersReducedMotion();
  const ev = { kind, reduced, shake: 0, punch: 0, hitstop: 0, vibe: null, vibrated: false, squash: null, iosSparkle: false };
  const sh = FEEL.SHAKE[kind] || 0;
  const pu = FEEL.PUNCH[kind] || 0;
  const hs = FEEL.HITSTOP[kind] || 0;
  let vb = FEEL.VIBE[kind];
  const local = involvesLocal(o) || !!o.force;

  if (sh && !reduced) { shake(sh); ev.shake = sh; }
  if (pu && !reduced) {
    const dx = o.dx, dz = o.dz;
    if (dx != null && dz != null) punch(dx, dz, pu);
    else if (o.f && o.killer) punch(o.f.x - o.killer.x, o.f.z - o.killer.z, pu);
    ev.punch = pu;
  }
  if (hs && g && S().settings.hitstop) { g.hitstop = Math.max(g.hitstop || 0, hs); ev.hitstop = hs; }
  if (kind === 'hit') {
    if (isLocal(o.f)) vb = FEEL.VIBE.hurt;
    else if (isLocal(o.killer)) vb = FEEL.VIBE.hit;
    else vb = null;
  }
  if (vb && (local || kind === 'hit')) {
    ev.vibe = vb;
    ev.vibrated = vibe(vb);
    if (!ev.vibrated && o.f && o.f.alive && fx && fx.star) {
      // iPhone Safari has no vibration: a tiny sparkle stands in
      fx.star(o.f.x, 0.9, o.f.z, 0xfff4c0, 1.6, 0.22);
      ev.iosSparkle = true;
    }
  }
  if (FEEL.SQUASH[kind] && o.f) ev.squash = squash(o.f, kind);
  if (kind === 'catch' && o.f && fx && fx.star) fx.star(o.f.x, 0.85, o.f.z, 0xfff6c8, 2.0, 0.24);

  // Cap stacking so a messy fight never turns the camera chaotic
  if (gfx.trauma > FEEL.TRAUMA_CAP) gfx.trauma = FEEL.TRAUMA_CAP;
  const plen = Math.hypot(gfx.kx || 0, gfx.kz || 0);
  if (plen > FEEL.PUNCH_CAP) { const k = FEEL.PUNCH_CAP / plen; gfx.kx *= k; gfx.kz *= k; }

  lastFeel = ev;
  feelLog.push(ev); if (feelLog.length > 48) feelLog.shift();
  return ev;
}

// Test helper: peak screen-pixel shake at trauma cap on a 915-wide phone with ~24 world-units in view.
export function shakePxAtCap(viewWpx = 915, visW = 24) {
  const tr = FEEL.TRAUMA_CAP * FEEL.TRAUMA_CAP;
  const world = 0.4 * tr + FEEL.PUNCH_CAP;
  return +(world * (viewWpx / visW)).toFixed(1);
}
