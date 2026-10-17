// Arena events (meteors, wind gusts, bumpers) + shared ground-marker visuals (warn discs, KOTH zone).
import { THREE, gfx, toon, glowMat } from './gfx.js';
import { AW, AH, HX, HZ, cx, cz, ci, cj, idx, inb, clamp, rr, pick } from './util.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { shake } from './gfx.js';

const DISC = new THREE.CircleGeometry(1, 40), RINGG = new THREE.RingGeometry(0.9, 1, 48);

export class Marker {
  constructor(scene, color, r, fill = 0.22) {
    this.g = new THREE.Group(); this.g.position.y = 0.03; scene.add(this.g); this.scene = scene; this.r = r;
    this.fill = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fill * 1.5, depthWrite: false })); this.fill.rotation.x = -Math.PI / 2;
    this.edge = new THREE.Mesh(RINGG, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })); this.edge.rotation.x = -Math.PI / 2;
    this.g.add(this.fill, this.edge); this.g.scale.setScalar(r); this.base = fill * 1.5;
  }
  set(x, z) { this.g.position.x = x; this.g.position.z = z; }
  color(c) { this.fill.material.color.set(c); this.edge.material.color.set(c); }
  pulse(t, a = 0.12, rate = 6) { const k = 0.5 + 0.5 * Math.sin(t * rate); this.fill.material.opacity = this.base + a * k; this.edge.material.opacity = 0.6 + 0.4 * k; }
  dispose() { this.scene.remove(this.g); this.fill.material.dispose(); this.edge.material.dispose(); }
}

export class ArenaEvents {
  constructor(g, enabled) {
    this.g = g; this.kinds = enabled ? (g.rules.events || []) : []; this.t = 0; this.meteors = []; this.bumpers = []; this.windT = 0; this.windNext = 9 + Math.random() * 5; this.metNext = 5 + Math.random() * 2; this.windDir = [1, 0]; this.windK = 0; this.windOn = false; this.root = new THREE.Group(); g.scene.add(this.root);
    if (this.has('bumper')) this.buildBumpers();
    this.freq = g.rules.eventFreq || 1;
  }
  has(k) { return this.kinds.includes(k); }
  buildBumpers() {
    const g = this.g, L = g.layout; const cands = [[9, 3], [10, 8], [9, 8], [10, 3], [7, 6], [12, 5]]; let n = 0;
    for (const [i, j] of cands) {
      if (n >= 2) break; const k = idx(i, j); if (L.t[k] !== 0 || g.sol[k]) continue;
      const grp = new THREE.Group(); grp.position.set(cx(i), 0, cz(j)); this.root.add(grp);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.35, 20), toon(0xff4f9a)); base.position.y = 0.17; grp.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 20), glowMat(0xffd23c, 1.0)); top.position.y = 0.42; grp.add(top);
      const ring = new THREE.Mesh(RINGG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.scale.setScalar(0.9); grp.add(ring);
      this.bumpers.push({ x: cx(i), z: cz(j), grp, top, ring, hot: 0 }); n++;
    }
  }
  // ---- fighters / boomerangs vs bumpers
  bumpFighter(f) {
    for (const b of this.bumpers) {
      const dx = f.x - b.x, dz = f.z - b.z, d = Math.hypot(dx, dz); if (d < 0.55 + 0.4 && d > 0.001) { const nx = dx / d, nz = dz / d; f.vx = nx * 13; f.vz = nz * 13; f.x = b.x + nx * 0.96; f.z = b.z + nz * 0.96; this.pop(b); }
    }
  }
  bumpBoom(bm) {
    for (const b of this.bumpers) {
      const dx = bm.x - b.x, dz = bm.z - b.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 0.001) { const nx = dx / d, nz = dz / d; const vx = Math.sin(bm.th), vz = Math.cos(bm.th); const dp = vx * nx + vz * nz; if (dp < 0) { bm.th = Math.atan2(vx - 2 * dp * nx, vz - 2 * dp * nz); } bm.x = b.x + nx * 0.72; bm.z = b.z + nz * 0.72; this.pop(b); return true; }
    }
    return false;
  }
  pop(b) { if (b.hot > 0.2) return; b.hot = 0.3; sfx('bumper'); fx.ring(b.x, 0.3, b.z, 0xff9ad0, 2.2, 0.3); fx.sparks(b.x, 0.5, b.z, 8, [0xffd23c, 0xff9ad0], { speed: 4, life: 0.3 }); shake(0.04); }
  // ---- per-frame
  idle(dt) { this.t += dt; this.visual(dt); }
  update(dt) {
    this.t += dt; const g = this.g;
    if (this.has('meteor') && this.t > this.metNext) { this.metNext = this.t + (5.5 + Math.random() * 3.5) / this.freq; this.spawnMeteor(); if (this.t > 40 && Math.random() < 0.5) this.spawnMeteor(); }
    if (this.has('wind')) {
      if (!this.windOn && this.t > this.windNext) { this.windOn = true; this.windT = 5.5; const d = pick([[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7]]); this.windDir = d; sfx('wind'); g.onEvent('wind', { dir: d }); }
      if (this.windOn) { this.windT -= dt; this.windK = clamp(Math.min(this.windT, 5.5 - this.windT + 0.0) * 1.5, 0, 1); if (this.windT <= 0) { this.windOn = false; this.windNext = this.t + (11 + Math.random() * 6) / this.freq; this.windK = 0; } }
      const k = this.windOn ? this.windK : 0; g.wind = k > 0.01 ? [this.windDir[0] * 2.4 * k, this.windDir[1] * 2.4 * k] : null;
      if (this.windOn && Math.random() < 0.9) { const x = rr(-HX, HX), z = rr(-HZ, HZ), sp = 14; fx.glow.spawn(x - this.windDir[0] * 3, 0.4 + Math.random() * 1.5, z - this.windDir[1] * 3, this.windDir[0] * sp, 0, this.windDir[1] * sp, 0.05, 0.45, 0xffffff, 0, 0, 0, 3); }
    }
    this.updateMeteors(dt);
    this.visual(dt);
  }
  updateMeteors(dt) {
    const g = this.g;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.t += dt; const k = Math.min(1, m.t / m.warn);
      m.mk.pulse(this.t, 0.25, 14); m.mk.g.scale.setScalar(m.r * (0.55 + 0.45 * k)); m.body.position.y = 0.4 + (1 - k * k) * 13; m.body.scale.setScalar(0.5 + k * 0.35); m.body.rotation.x += dt * 6;
      if (Math.random() < 0.6) fx.glow.spawn(m.x, m.body.position.y, m.z, (Math.random() - 0.5), 1.5, (Math.random() - 0.5), 0.22, 0.4, Math.random() < 0.5 ? 0xff7a1a : 0xffd060, 0, 0, 0, -0.5);
      if (m.t >= m.warn) { this.impact(m); m.mk.dispose(); this.root.remove(m.body); this.meteors.splice(i, 1); }
    }
  }
  visual(dt) { for (const b of this.bumpers) { b.hot = Math.max(0, b.hot - dt); const s = 1 + b.hot * 1.2; b.top.scale.set(s, 1 + b.hot, s); b.ring.material.opacity = 0.3 + 0.2 * Math.sin(this.t * 5) + b.hot * 2; } }
  spawnMeteor(px, pz) {
    const g = this.g; let x, z; const alive = g.fighters.filter((f) => f.alive && !f.boss);
    if (px !== undefined) { x = px; z = pz; } else if (alive.length && Math.random() < 0.6) { const f = pick(alive); x = clamp(f.x + f.vx * 0.6, -HX + 1, HX - 1); z = clamp(f.z + f.vz * 0.6, -HZ + 1, HZ - 1); } else { x = rr(-HX + 1.5, HX - 1.5); z = rr(-HZ + 1.5, HZ - 1.5); }
    const mk = new Marker(g.scene, 0xff4f3a, 1.5, 0.25); mk.set(x, z);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), glowMat(0xff7a1a, 1.8)); body.position.set(x, 13, z); this.root.add(body);
    this.meteors.push({ x, z, t: 0, warn: 1.5, r: 1.5, mk, body }); sfx('meteorwarn'); if (g.netRec) g.netRec('meteor', x, z);
  }
  impact(m) {
    const g = this.g; sfx('explode'); shake(0.35); fx.flash('#ffb070', 0.18, 180); fx.shockwave(m.x, m.z, 0xff9a40, 4.5); fx.sparks(m.x, 0.5, m.z, 30, [0xffd060, 0xff7a20], { speed: 8, up: 3, life: 0.7 }); fx.burst(m.x, 0.4, m.z, 14, [0x4a3a38, 0x6a5a58, 0xff7a20], { speed: 5, up: 4, size: 0.16 }); fx.scorch(m.x, m.z, 3, 0x000000, 0.55, 12); fx.puff(m.x, 0.4, m.z, 8, 0xff9a40, 0.6);
    for (const f of g.fighters) { if (!f.alive || Math.hypot(f.x - m.x, f.z - m.z) > m.r) continue; if (f.inv > 0 || f.dashT > 0) continue; if (f.shield) { f.shield = false; f.inv = 0.7; sfx('shieldpop'); continue; } f.die(null, 'meteor', f.x - m.x, f.z - m.z); }
    for (let j = cj(m.z - m.r); j <= cj(m.z + m.r); j++) for (let i = ci(m.x - m.r); i <= ci(m.x + m.r); i++) { if (!inb(i, j)) continue; const k = idx(i, j); if (g.crateHp[k] > 0 && Math.hypot(cx(i) - m.x, cz(j) - m.z) < m.r) g.breakCrate(k, true); }
  }
  dispose() { this.g.wind = null; for (const m of this.meteors) m.mk.dispose(); this.g.scene.remove(this.root); }
}
