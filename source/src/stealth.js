// v4.9 bushes: concealment rules (host / offline authoritative; guests get the outcome in the snapshot tail).
// A fighter whose whole footprint stands on bush cells is hidden from opponents. Attacking (throw, parry, ult) or taking a hit reveals for REVEAL s,
// an opponent within DETECT units sees them anyway, and stepping out restores visibility at once. No damage, speed, collision or invulnerability change.
import { THREE } from './gfx.js';
import { ci, cj, inb, idx } from './util.js';
import { toScreen } from './gfx.js';
// perspective pushes the tall YOU label sideways near the screen edge: nudge it back inside the viewport (above the same fighter)
export function keepMarkOn(m) {
  const r = m.root, mk = m.mark; if (!mk.userData.big) return; mk.position.x = 0; mk.position.z = 0; r.updateMatrixWorld(true); const p = new THREE.Vector3(); mk.getWorldPosition(p); const [sx] = toScreen(p.x, p.y + 0.7, p.z); const [ax] = toScreen(p.x + 1, p.y + 0.7, p.z); const per = ax - sx; if (!(Math.abs(per) > 1e-4)) return;
  const lo = 0.07, hi = 0.93; let dx = 0; if (sx < lo) dx = (lo - sx) / per; else if (sx > hi) dx = (hi - sx) / per; if (!dx) return; const a = -r.rotation.y, s = r.scale.x || 1; mk.position.x = (dx * Math.cos(a)) / s; mk.position.z = (-dx * Math.sin(a)) / s;
}
export const STEALTH = { reveal: 1.5, hurt: 1.5, detect: 1.8, foot: 0.3 };
export const stealthOn = (g) => !!(g && g.layout && g.layout.bush && g.bushN > 0);
export function inBush(g, x, z, r = STEALTH.foot) {
  const B = g.layout.bush; if (!B) return false;
  for (const [a, b] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) { const i = ci(x + a), j = cj(z + b); if (!inb(i, j) || !B[idx(i, j)]) return false; }
  return true;
}
export const reveal = (f, t) => { if (f) { f.revealT = Math.max(f.revealT || 0, t); f.hid = false; } }; // immediate (also during hit-stop frames)
// host / offline tick: f.hid (in cover and not revealed), f.seen = bitmask of teams that can still see a hidden fighter (detection range)
export function stealthTick(g, dt) {
  if (!stealthOn(g)) return;
  for (const f of g.fighters) {
    f.revealT = Math.max(0, (f.revealT || 0) - dt);
    const can = f.alive && !f.show && !f.boss && !f.hasBomb && !f.carry && g.state !== 'intro';
    f.bushIn = can && inBush(g, f.x, f.z); f.hid = f.bushIn && f.revealT <= 0; f.seen = 0;
    if (f.hid) for (const o of g.fighters) if (o.alive && o.team !== f.team && Math.hypot(o.x - f.x, o.z - f.z) < STEALTH.detect) f.seen |= 1 << (o.team & 7);
  }
}
// can a member of team T see fighter f (targeting, aim assist, bots, homing, HUD)?
export const canSee = (g, T, f) => !f.hid || f.team === T || ((f.seen >> (T & 7)) & 1) === 1 || T > 7 || T < 0;
// local screen viewers: teams of the humans playing on THIS device (guest: its own fighter). null = spectator (sees all)
export function viewTeams(g) {
  if (g.mode === 'attract') return null;
  if (g.viewIdx !== undefined && g.viewIdx !== null) { const f = g.fighters[g.viewIdx]; return f ? [f.team] : null; }
  const loc = g.fighters.filter((f) => (!f.isBot || f.autoHuman) && !(g.net && f.def.slot !== 0)); return loc.length ? [...new Set(loc.map((f) => f.team))] : null;
}
// shown on this screen? hidden only when every local viewer is an opponent that cannot see it
export function shownHere(g, f) { if (!f.hid) return true; const vt = viewTeams(g); if (!vt) return true; return vt.some((T) => canSee(g, T, f)); }
export const allyHidden = (g, f) => { if (!f.hid) return false; const vt = viewTeams(g); return !!vt && vt.includes(f.team); };
// per-frame visuals: opponents in cover vanish (model, ring, marker, shadow); you / teammates in cover are drawn faint
export function stealthVis(g) {
  if (!stealthOn(g)) return;
  for (const f of g.fighters) {
    const m = f.model; if (!m) continue; const show = !f.alive || shownHere(g, f); m.root.visible = show || !!f.show;
    ghost(m, f.alive && f.hid && allyHidden(g, f) ? GHOST.body : 1);
  }
}
// own / allied fighter in cover: translucent body, the ink outline turns into a soft light rim, and the team ring / YOU ring / marker draw over the foliage
export const GHOST = { body: 0.6, rim: 0xeef4ff, rimA: 0.75 };
function ghost(m, k) {
  if ((m._gk || 1) === k) return; m._gk = k; const on = k < 1;
  if (!m._gm) { m._gm = []; m.body.traverse((o) => { if (!o.material || o.isSprite) return; const arr = Array.isArray(o.material) ? o.material : [o.material]; const cl = arr.map((x) => { const c = x.clone(); c.onBeforeCompile = x.onBeforeCompile; c.customProgramCacheKey = x.customProgramCacheKey; /* keep the outline shell's thickness shader (clone() drops it -> a solid dark copy of the body) */ c.userData = { ...x.userData, o0: x.opacity, t0: x.transparent, c0: x.color ? x.color.getHex() : null, ol: x.side === THREE.BackSide }; return c; }); o.material = Array.isArray(o.material) ? cl : cl[0]; m._gm.push(...cl); }); }
  for (const c of m._gm) { const u = c.userData; c.transparent = on ? true : u.t0; c.depthWrite = !on; if (u.ol) { if (c.color) c.color.setHex(on ? GHOST.rim : u.c0); c.opacity = on ? GHOST.rimA : u.o0; } else c.opacity = (u.o0 === undefined ? 1 : u.o0) * (on ? GHOST.body : 1); c.needsUpdate = true; }
  for (const r of [m.ring, m.youRing]) if (r) { r.material.depthTest = !on; r.renderOrder = on ? 7 : 0; r.children.forEach((q) => { q.material.depthTest = !on; q.renderOrder = on ? 6 : 0; }); }
}
// bush placement cleanup once traps exist: no bush on or next to a trap, switch, pad or its danger area (keeps telegraphs readable)
export function bushClean(g) {
  const B = g.layout.bush; if (!B) { g.bushN = 0; return; } const tr = g.traps; let n = 0;
  const pts = []; if (tr && tr.list) for (const t of tr.list) { pts.push([t.x, t.z]); for (const p of t.pads || []) pts.push([p.x, p.z]); if (t.ex !== undefined) pts.push([t.ex, t.ez]); }
  if (tr && tr.sw) for (const s of tr.sw) pts.push([s.x, s.z]);
  for (let k = 0; k < B.length; k++) { if (!B[k]) continue; const i = k % g.layout.w, j = (k / g.layout.w) | 0, x = i - g.layout.w / 2 + 0.5, z = j - g.layout.h / 2 + 0.5;
    if (g.layout.t[k] !== 0 || pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.6) || (tr && tr.danger && tr.danger(x, z) > 0)) B[k] = 0; else n++; }
  g.bushN = n;
}
