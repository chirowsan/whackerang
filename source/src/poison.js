// v4.8 shrinking poison: at POISON.startAt seconds of round play time (the HUD clock) poison starts at the rim and
// slowly closes toward the middle, then holds a small safe rectangle. Pure function of (playTime, arena size), so
// online guests draw exactly the host's zone from the synced clock; only the host applies damage.
import { HX, HZ, clamp } from './util.js';
import { THREE } from './gfx.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';

// ---- tuning (seconds are round play time, i.e. the HUD clock; game-speed scaling applies like every other timer)
export const POISON = {
  startAt: 120,   // poison appears at the rim at 2:00
  warn: 10,       // warning banner / rim pulse / HUD countdown this long before startAt
  shrink: 75,     // seconds to close from the full arena to the final safe area (linear), then it holds
  minFrac: 0.2,   // final safe half-size as a fraction of the arena half-size ...
  minHX: 2.5,     // ... but never smaller than this (world units = tiles) across
  minHZ: 2.0,     // ... and this deep  -> Small 5x4 tiles, Large 5.2x4, Huge 6.4x4
  tick: 2.0,      // one heart lost per this many seconds spent in poison (invulnerability pauses the tick)
  botMargin: 1.0, // bots start heading inward this far before the boundary
  spawnMargin: 0.7, // respawns / rescues land at least this far inside the safe area
};
const MODES_ON = new Set(['elim', 'bomb', 'koth']);
const P = (g) => (g.rules && g.rules.poisonCfg) || POISON; // the host copies POISON into the round rules, so guests use the host's tuning
export function poisonCfg(g) { return P(g); }
export function poisonAllowed(rules, o = {}) { return !!rules && MODES_ON.has(rules.type || 'elim') && !o.boss && !o.tutorial; }
export function poisonOn(g) { return !!(g.rules && g.rules.poison) && g.mode !== 'attract'; }
// safe half-extents {sx, sz, k} once poison has started, else null
export function poisonRect(g, t = g.playTime) {
  if (!poisonOn(g) || !(t >= P(g).startAt)) return null;
  const k = clamp((t - P(g).startAt) / P(g).shrink, 0, 1);
  const fx_ = Math.min(HX, Math.max(P(g).minHX, HX * P(g).minFrac)), fz = Math.min(HZ, Math.max(P(g).minHZ, HZ * P(g).minFrac));
  return { sx: HX + (fx_ - HX) * k, sz: HZ + (fz - HZ) * k, k };
}
export function inPoison(g, x, z, margin = 0, t) { const r = poisonRect(g, t); if (!r) return false; return Math.abs(x) > r.sx - margin || Math.abs(z) > r.sz - margin; }
export function poisonPhase(g) { if (!poisonOn(g)) return 'off'; const t = g.playTime; if (t >= P(g).startAt) return (t - P(g).startAt) >= P(g).shrink ? 'hold' : 'closing'; if (t >= P(g).startAt - P(g).warn) return 'warn'; return 'pre'; }

// host only: damage ticks
export function poisonTick(g, dt) {
  if (g.state !== 'play' || !poisonRect(g)) { for (const f of g.fighters) f.poisonT = 0; return; }
  if (g.rules.type === 'koth' && g.zone && !g.poisonZoneDone) { g.poisonZoneDone = true; if (Math.hypot(g.zone.x, g.zone.z) > 1.5 && g.moveZone) g.moveZone(false); } // KotH: pull the hill to the middle when poison starts
  for (const f of g.fighters) {
    if (!f.alive || f.boss || f.minion) { f.poisonT = 0; continue; }
    if (!inPoison(g, f.x, f.z)) { f.poisonT = Math.max(0, (f.poisonT || 0) - dt * 2); continue; }
    f.poisonT = (f.poisonT || 0) + dt;
    if (f.poisonT >= P(g).tick) { if (f.inv > 0) { f.poisonT = P(g).tick; continue; } f.poisonT = 0; f.poisonHits = (f.poisonHits || 0) + 1; f.die(null, 'poison', 0, 0); }
  }
}

// host + guest: visuals, banners, HUD state (local, from the synced clock)
export class PoisonView {
  constructor(g) {
    this.g = g; this.ph = 'pre'; this.lastBeep = 99; const grp = this.grp = new THREE.Group(); grp.visible = false; grp.name = 'poison';
    const geo = this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.hazeMat = new THREE.MeshBasicMaterial({ color: 0x8a3cff, transparent: true, opacity: 0.32, depthWrite: false });
    this.edgeMat = new THREE.MeshBasicMaterial({ color: 0xb6ff3c, transparent: true, opacity: 0.9, depthWrite: false });
    this.haze = []; this.edge = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, this.hazeMat); m.renderOrder = 5; grp.add(m); this.haze.push(m); const e = new THREE.Mesh(geo, this.edgeMat); e.renderOrder = 6; grp.add(e); this.edge.push(e); }
    g.scene.add(grp);
  }
  dispose() { this.g.scene.remove(this.grp); this.geo.dispose(); this.hazeMat.dispose(); this.edgeMat.dispose(); }
  update(dt) {
    const g = this.g, t = g.playTime, ph = poisonPhase(g);
    if (ph !== this.ph) {
      if (ph === 'warn' && this.ph === 'pre') { g.onEvent('poisonWarn'); sfx('warn'); }
      if (ph === 'closing' && (this.ph === 'pre' || this.ph === 'warn')) { g.onEvent('poison'); sfx('rumble'); }
      if (ph === 'hold' && this.ph === 'closing') g.onEvent('poisonHold');
      this.ph = ph;
    }
    if (ph === 'warn') { const s = Math.ceil(P(g).startAt - t); if (s <= 3 && s < this.lastBeep) { this.lastBeep = s; sfx('warn'); } }
    if (ph === 'off' || ph === 'pre') { this.grp.visible = false; return; }
    this.grp.visible = true; const r = poisonRect(g) || { sx: HX, sz: HZ, k: 0 }; const X = HX + 1.5, Z = HZ + 1.5, H = 1.3, now = g.time;
    // haze walls: left, right (full depth) and top, bottom (between them)
    const bandX = Math.max(0.001, X - r.sx), bandZ = Math.max(0.001, Z - r.sz); const on = ph !== 'warn';
    const hz = this.haze; hz.forEach((m) => { m.visible = on; });
    hz[0].scale.set(bandX, H, Z * 2); hz[0].position.set(-(r.sx + bandX / 2), H / 2, 0);
    hz[1].scale.set(bandX, H, Z * 2); hz[1].position.set(r.sx + bandX / 2, H / 2, 0);
    hz[2].scale.set(r.sx * 2, H, bandZ); hz[2].position.set(0, H / 2, -(r.sz + bandZ / 2));
    hz[3].scale.set(r.sx * 2, H, bandZ); hz[3].position.set(0, H / 2, r.sz + bandZ / 2);
    this.hazeMat.opacity = 0.26 + Math.sin(now * 2.2) * 0.05;
    // boundary line (during the warning it pulses at the rim)
    const w = 0.14, eh = 0.1, e = this.edge;
    e[0].scale.set(w, eh, r.sz * 2 + w); e[0].position.set(-r.sx, eh / 2 + 0.02, 0);
    e[1].scale.set(w, eh, r.sz * 2 + w); e[1].position.set(r.sx, eh / 2 + 0.02, 0);
    e[2].scale.set(r.sx * 2 + w, eh, w); e[2].position.set(0, eh / 2 + 0.02, -r.sz);
    e[3].scale.set(r.sx * 2 + w, eh, w); e[3].position.set(0, eh / 2 + 0.02, r.sz);
    this.edgeMat.opacity = ph === 'warn' ? 0.45 + 0.45 * Math.abs(Math.sin(now * 6)) : 0.7 + Math.sin(now * 4) * 0.2;
    // bubbles in the band and on anyone standing in poison
    if (on && fx.glow && Math.random() < dt * 10) { const side = Math.floor(Math.random() * 4); let x, z; if (side < 2) { x = (side ? 1 : -1) * (r.sx + Math.random() * Math.max(0, HX - r.sx)); z = (Math.random() * 2 - 1) * HZ; } else { x = (Math.random() * 2 - 1) * r.sx; z = (side === 3 ? 1 : -1) * (r.sz + Math.random() * Math.max(0, HZ - r.sz)); } fx.glow.spawn(x, 0.2, z, 0, 0.9, 0, 0.12, 1.1, 0x9dff3c, 0); }
    if (on && fx.glow) for (const f of g.fighters) if (f.alive && !f.boss && inPoison(g, f.x, f.z) && Math.random() < dt * 14) fx.glow.spawn(f.x + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.6, f.z + (Math.random() - 0.5) * 0.6, 0, 1.2, 0, 0.1, 0.7, 0x9dff3c, 0);
  }
}
// HUD text for the timer slot (null = keep the normal timer)
export function poisonHud(g) {
  const ph = poisonPhase(g); if (ph === 'off') return null; const t = g.playTime;
  if (ph === 'warn') return '\u2623 ' + Math.ceil(P(g).startAt - t) + 's';
  if (ph === 'closing') return '\u2623 CLOSING';
  if (ph === 'hold') return '\u2623 ZONE';
  if (g.sudden) { const r = Math.max(0, Math.ceil(P(g).startAt - t)); return '\u2620 \u2623' + Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0'); } // sudden death: count down to the poison
  return null;
}
