// Bot brain: dodge incoming boomerangs, keep distance, aim with imperfect accuracy, avoid hazards.
import { AW, AH, HX, HZ, clamp, ci, cj, idx, inb, angDiff, rr } from './util.js';
import { T } from './arena.js';

const CURVE = 0.95;
const P = [ // easy, medium, hard
  { react: 0.34, err: 0.38, dodge: 0.4, deflect: 0.08, cd: 1.6, think: 0.22, range: 8.5, lead: 0 },
  { react: 0.24, err: 0.2, dodge: 0.66, deflect: 0.2, cd: 1.0, think: 0.17, range: 10, lead: 0.3 }, // Medium (default) - softened in v3.1
  { react: 0.07, err: 0.055, dodge: 0.96, deflect: 0.6, cd: 0.45, think: 0.09, range: 12.5, lead: 1 },
];
const OUT = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false };
const PM = { // persona tuning: range, err, deflect+, dash chance, pref distance, cd mult, pickup radius, charge
  defender: { range: 1, err: 1, def: 0.28, dash: 0.5, pref: 1.15, cd: 1.0, pu: 9, ch: 1 },
  trickster: { range: 1, err: 1.1, def: 0.05, dash: 0.95, pref: 0.95, cd: 0.9, pu: 10, ch: 0.6 },
  sniper: { range: 1.3, err: 0.6, def: 0.1, dash: 0.5, pref: 1.5, cd: 1.1, pu: 8, ch: 2 },
  aggressor: { range: 0.9, err: 1.2, def: 0.05, dash: 0.7, pref: 0.65, cd: 0.6, pu: 7, ch: 0.5 },
  collector: { range: 1, err: 1, def: 0.1, dash: 0.6, pref: 1.05, cd: 1.0, pu: 16, ch: 1 },
  duelist: { range: 1.05, err: 0.8, def: 0.15, dash: 0.6, pref: 1.0, cd: 0.85, pu: 9, ch: 1.2 },
  boss: { range: 1.1, err: 0.7, def: 0.0, dash: 0.0, pref: 0.8, cd: 0.7, pu: 0, ch: 1.4 },
};

export class Bot {
  constructor(g, f, diff, persona) {
    this.g = g; this.f = f; this.pm = PM[persona] || PM.duelist; this.persona = persona; const base = P[Math.max(0, Math.min(2, diff))]; this.d = { ...base, range: base.range * this.pm.range, err: base.err * this.pm.err, deflect: Math.min(0.85, base.deflect + this.pm.def * (diff + 1) / 2), cd: base.cd * this.pm.cd }; this.thinkT = Math.random() * 0.2; this.dir = [0, 0]; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 1; this.threatT = 0; this.holdT = 0; this.holding = false; this.aim = [0, 0];
    this.throwWait = 0.5 + Math.random() * 0.8; this.pendDash = 0; this.sideLock = 0; this.target = null; this.goalPU = null; this.out = { ...OUT };
  }
  predict(b, T, steps, f) {
    // returns time of first dangerous approach within T seconds, or -1
    let x = b.x, z = b.z, th = b.th, t = b.t, ph = b.phase, rt = b.retT; const h = T / steps; const o = b.owner;
    for (let s = 1; s <= steps; s++) {
      let sp;
      if (ph === 'out') { t += h; const k = t / b.tout; sp = b.v0 * (1 - 0.68 * Math.min(1, k)); th += b.w * h * (1 - 0.3 * k); if (t >= b.tout) { ph = 'ret'; rt = 0; } }
      else { rt += h; sp = 8 + 15 * Math.min(1, rt / 0.8); if (o.alive) { const a = Math.atan2(o.x - x, o.z - z); const rate = 5.5 + rt * 7; th += clamp(angDiff(th, a), -rate * h, rate * h); } }
      x += Math.sin(th) * sp * h; z += Math.cos(th) * sp * h;
      if (Math.hypot(f.x - x, f.z - z) < b.hitR + 0.4 + 0.35) return s * h;
    }
    return -1;
  }
  los(a, b) {
    const g = this.g; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); const n = Math.ceil(d / 0.45);
    for (let i = 1; i < n; i++) { const x = a.x + dx * i / n, z = a.z + dz * i / n; if (g.solid(ci(x), cj(z))) return false; }
    return true;
  }
  cellDanger(x, z) {
    const b = this.cd0(x, z); if (b >= 8) return b;
    const m = 0.45; return Math.max(b, (this.cd0(x + m, z) >= 8 || this.cd0(x - m, z) >= 8 || this.cd0(x, z + m) >= 8 || this.cd0(x, z - m) >= 8) ? 7 : 0);
  }
  cd0(x, z) {
    const g = this.g; const i = ci(x), j = cj(z); if (!inb(i, j)) return 9; const k = idx(i, j);
    if (g.sol[k]) return 6; if (g.hole[k] !== 0) return 8; const t = g.layout.t[k]; if (t === T.LAVA) return 9; if (t === T.SPIKE) return (g.spk[k] > 0.2 || g.spkWarn[k] || (g.playTime + g.spkPh[k]) % 4.2 > 1.8) ? 8 : 2;
    if (g.sudden) { const ring = Math.min(i, j, AW - 1 - i, AH - 1 - j); if (ring <= g.suddenRing + 1) return 5; }
    const td = g.traps ? g.traps.danger(x, z) : 0;
    return Math.max(td, t === T.CONV ? 0.8 : 0);
  }
  update(dt) {
    const g = this.g, f = this.f, d = this.d, o = this.out;
    o.fire = false; o.dash = false; o.deflect = false; o.ult = false; o.aimX = 0; o.aimZ = 0;
    if (g.state === 'intro') { o.mx = 0; o.mz = 0; return o; }
    this.throwWait -= dt; this.strafeT -= dt; this.sideLock -= dt;
    // ---- threats (every tick, cheap)
    let threat = null, tHit = 9;
    for (const b of g.booms) { if (b.owner === f || b.owner.team === f.team || !b.alive || b.fade > 0) continue; const th = this.predict(b, 0.55, 5, f); if (th >= 0 && th < tHit) { tHit = th; threat = b; } }
    if (threat && threat !== this.lastThreat) { this.lastThreat = threat; this.dodgeRoll = Math.random() < d.dodge; this.defRoll = Math.random() < d.deflect; this.dashRoll = Math.random() < this.pm.dash; }
    if (threat) { this.threatT += dt; } else this.threatT = Math.max(0, this.threatT - dt * 2);
    let evade = null;
    if (threat && this.threatT > d.react) {
      // perpendicular to boomerang heading, away from its path
      const bx = Math.sin(threat.th), bz = Math.cos(threat.th); let px = -bz, pz = bx; const rel = (f.x - threat.x) * px + (f.z - threat.z) * pz; if (rel < 0) { px = -px; pz = -pz; }
      if (this.sideLock <= 0) { // check that side is safe, otherwise flip
        const safeA = this.cellDanger(f.x + px * 1.2, f.z + pz * 1.2), safeB = this.cellDanger(f.x - px * 1.2, f.z - pz * 1.2); if (safeA > 4 && safeB < safeA) { px = -px; pz = -pz; } this.sideLock = 0.4; this.side = [px, pz]; }
      evade = this.side || [px, pz];
      if (this.dodgeRoll && this.dashRoll && tHit < 0.3 && f.dashCd <= 0) { o.dash = true; o.mx = evade[0]; o.mz = evade[1]; return this.finish(o); }
      if (this.defRoll && tHit < 0.2 && f.deflectCd <= 0 && f.dashT <= 0) { o.deflect = true; }
      if (!this.dodgeRoll) evade = null;
    }
    // ---- ultimate
    if (f.ult >= 100 && g.state === 'play' && !f.boss) { this.ultT = (this.ultT || 0) - dt; if (this.ultT <= 0) { this.ultT = 0.6; const tgt = this.target; if (tgt && tgt.alive && Math.hypot(tgt.x - f.x, tgt.z - f.z) < 9 && Math.random() < 0.5) o.ult = true; } }
    // ---- decisions
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = d.think * (0.8 + Math.random() * 0.4); this.think(); }
    // ---- aiming/throwing
    const tg = this.target;
    if (this.holding) {
      this.holdT -= dt; o.fire = this.holdT > 0; o.aimX = this.aim[0]; o.aimZ = this.aim[1];
      if (this.holdT <= 0 || !f.alive || f.ammo <= 0) { this.holding = false; o.fire = false; this.throwWait = d.cd * (0.7 + Math.random() * 0.8); }
    } else if (f.ammo > 0 && tg && tg.alive && this.throwWait <= 0 && f.throwCd <= 0 && f.dashT <= 0 && !evade) {
      const dist = Math.hypot(tg.x - f.x, tg.z - f.z);
      if (dist < d.range && this.los(f, tg)) {
        // lead the target a bit on higher difficulties
        let tx = tg.x + tg.vx * 0.25 * d.lead, tz = tg.z + tg.vz * 0.25 * d.lead; const a0 = Math.atan2(tx - f.x, tz - f.z); const ft = Math.min(0.9, dist / 11);
        const a = a0 - 0.5 * CURVE * ft * 0.9 + (Math.random() - 0.5) * 2 * d.err * (1 + dist / 12);
        this.aim = [Math.sin(a), Math.cos(a)]; this.holding = true; this.holdT = dist > 7 ? clamp((dist - 5.5) / 9, 0.05, 0.55) * this.pm.ch / f.mods.charge : 0.05; o.fire = true; o.aimX = this.aim[0]; o.aimZ = this.aim[1];
      }
    }
    // ---- movement
    let dx = this.dir[0], dz = this.dir[1];
    if (evade) { dx = evade[0]; dz = evade[1]; }
    // hazard-aware steering: choose among 12 directions
    const l = Math.hypot(dx, dz);
    if (l > 0.05 || evade) {
      let best = null, bs = -1e9; const wantA = Math.atan2(dx, dz);
      for (let n = 0; n < 12; n++) {
        const a = n / 12 * Math.PI * 2; const sx = Math.sin(a), sz = Math.cos(a);
        let pen = this.cellDanger(f.x + sx * 0.8, f.z + sz * 0.8) + this.cellDanger(f.x + sx * 1.7, f.z + sz * 1.7) * 0.6; if (this.cellDanger(f.x + sx * 0.5, f.z + sz * 0.5) >= 6) pen += 6;
        const sc = Math.cos(angDiff(wantA, a)) * 3 - pen; if (sc > bs) { bs = sc; best = [sx, sz]; }
      }
      o.mx = best[0]; o.mz = best[1];
    } else { o.mx = 0; o.mz = 0; }
    // momentum guard: if current velocity will carry us onto a killer tile within ~0.3s, steer away from it
    { const vl = Math.hypot(f.vx, f.vz); if (vl > 1 && !(f.dashT > 0)) { const px = f.x + f.vx * 0.34, pz = f.z + f.vz * 0.34; if (this.cellDanger(px, pz) >= 8 || this.cellDanger(f.x + f.vx * 0.17, f.z + f.vz * 0.17) >= 8) { let b2 = null, s2 = -1e9; for (let n = 0; n < 12; n++) { const a = n / 12 * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a); const hit = this.cellDanger(f.x + sx * 0.6 + f.vx * 0.15, f.z + sz * 0.6 + f.vz * 0.15) >= 8 || this.cellDanger(f.x + sx * 1.1, f.z + sz * 1.1) >= 8; const sc = -(sx * f.vx + sz * f.vz) / vl - (hit ? 5 : 0) + (sx * o.mx + sz * o.mz) * 0.3; if (sc > s2) { s2 = sc; b2 = [sx, sz]; } } if (b2) { o.mx = b2[0]; o.mz = b2[1]; } } } }
    // never stand on a doomed/dangerous tile
    if (this.cellDanger(f.x, f.z) >= 5 && !evade) { let best = null, bs = 1e9; for (let n = 0; n < 12; n++) { const a = n / 12 * Math.PI * 2; const dd = this.cellDanger(f.x + Math.sin(a) * 1.4, f.z + Math.cos(a) * 1.4); if (dd < bs) { bs = dd; best = [Math.sin(a), Math.cos(a)]; } } if (best) { o.mx = best[0]; o.mz = best[1]; if (f.dashCd <= 0 && this.cellDanger(f.x, f.z) >= 8 && Math.random() < 0.3) o.dash = true; } }
    if (this.holding) { o.mx *= 0.5; o.mz *= 0.5; }
    return this.finish(o);
  }
  pathBad(dx, dz) { const f = this.f; for (let s = 0.7; s <= 3.1; s += 0.7) { if (this.cellDanger(f.x + dx * s, f.z + dz * s) >= 8) return true; } return false; }
  finish(o) {
    if (o.dash) {
      let dx = o.mx, dz = o.mz; if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(this.f.face); dz = Math.cos(this.f.face); }
      if (this.pathBad(dx, dz)) { let best = null, bd = 9; const w = Math.atan2(dx, dz); for (let n = 0; n < 12; n++) { const a = n / 12 * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a); if (this.pathBad(sx, sz)) continue; const d = Math.abs(angDiff(w, a)); if (d < bd) { bd = d; best = [sx, sz]; } }
        if (best) { o.mx = best[0]; o.mz = best[1]; } else o.dash = false; }
    }
    return o;
  }
  think() {
    const g = this.g, f = this.f, d = this.d;
    const R = g.rules; let tg = null, bd = 1e9;
    for (const e of g.fighters) { if (!e.alive || !g.isFoe(f, e)) continue; let dist = Math.hypot(e.x - f.x, e.z - f.z); if (R.type === 'koth' && g.zone && Math.hypot(e.x - g.zone.x, e.z - g.zone.z) < 2.6) dist *= 0.6; if (R.type === 'bomb' && g.mst.holder === e && f !== g.mst.holder) dist *= 0.5; if (dist < bd) { bd = dist; tg = e; } }
    if (R.type === 'bomb') { const hd = g.mst.holder; if (hd === f) { tg = null; bd = 1e9; for (const e of g.fighters) { if (e === f || !e.alive || e.tagImmune > 0) continue; const dist = Math.hypot(e.x - f.x, e.z - f.z); if (dist < bd) { bd = dist; tg = e; } } } }
    this.target = tg; let gx = 0, gz = 0;
    // power-up goal
    let pu = null, pd = 1e9; for (const p of g.powerups) { const dist = Math.hypot(p.x - f.x, p.z - f.z); if (dist < pd && dist < this.pm.pu) { pd = dist; pu = p; } }
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 0.8 + Math.random() * 1.6; }
    const ob = g.objective ? g.objective(f) : null;
    if (ob && (ob.force || !tg || bd > (ob.yield || 3.2))) { gx = ob.x - f.x; gz = ob.z - f.z; const od = Math.hypot(gx, gz); if (od < 0.5) { gx = 0; gz = 0; } if (tg && !ob.force && bd < 7) { gx += -(tg.z - f.z) / (bd || 1) * this.strafe * 0.3; } }
    else if (pu && (!tg || bd > 3.2)) { gx = pu.x - f.x; gz = pu.z - f.z; }
    else if (tg) {
      const dx = tg.x - f.x, dz = tg.z - f.z, dist = bd || 1; const ux = dx / dist, uz = dz / dist; let pref = (f.ammo > 0 ? 6.2 : 8.5) * this.pm.pref; if (R.type === 'bomb') pref = g.mst.holder === f ? 3.5 : 9; if (f.boss) pref = 4.6;
      let k = clamp((dist - pref) / 3, -1, 1); gx = ux * k; gz = uz * k;
      gx += -uz * this.strafe * 0.8; gz += ux * this.strafe * 0.8;
      if (f.ammo > 0 && !this.los(f, tg)) { gx += ux * 0.8; gz += uz * 0.8; }
      if (f.ammo === 0 && dist > 5) { gx *= 0.2; gz *= 0.2; }
      // wall repulsion
      gx += clamp(-f.x / HX, -1, 1) * 0.25 * Math.max(0, Math.abs(f.x) / HX - 0.6) * 4; gz += clamp(-f.z / HZ, -1, 1) * 0.25 * Math.max(0, Math.abs(f.z) / HZ - 0.6) * 4;
      if (R.type === 'koth' && g.zone) { const zx = g.zone.x - f.x, zz = g.zone.z - f.z, zd = Math.hypot(zx, zz); if (zd > 1.6 && (bd > 3 || zd < 4.5)) { gx = zx / zd * 0.95; gz = zz / zd * 0.95; } else if (zd <= 1.6) { gx *= 0.25; gz *= 0.25; gx += -uz * this.strafe * 0.4; gz += ux * this.strafe * 0.4; } }
      // keep clear of returning boomerangs' lane: stand still near owner path if waiting for catch
      for (const b of g.booms) if (b.owner === f && b.phase === 'ret') { gx += (b.x - f.x) * 0.15; gz += (b.z - f.z) * 0.15; }
    }
    const l = Math.hypot(gx, gz); if (l > 0.01) { const s = Math.min(1, l); this.dir = [gx / l * s, gz / l * s]; } else this.dir = [0, 0];
  }
}
