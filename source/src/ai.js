import { canSee } from './stealth.js';
// style416: a faded Wisp is hard for bots to track at range (humans can still see the faint ghost).
// Do not change stealth canSee. Close up, bots still notice her.
function fadedFrom(f, e) {
  if (!e || !e.alive || !e.mods || !e.mods.fade) return false;
  if ((e.fadeOn || 0) < 0.35) return false;
  if ((e.revealT || 0) > 0 || e.charging || e.dashT > 0 || e.throwT > 0.25 || e.slT >= 0 || (e.hurtT || 0) > 0) return false;
  return Math.hypot(e.x - f.x, e.z - f.z) > 2.5;
}
// Bot brain: play like each fighter, lead with human-like error, dodge, catch, use cover, retreat when low.
import { AW, AH, HX, HZ, clamp, ci, cj, cx, cz, idx, inb, angDiff, rr } from './util.js';
import { T } from './arena.js';
import { POISON, inPoison, poisonRect } from './poison.js';

const CURVE = 0.95;
const BOOM_SPD = 11; // typical outbound speed, used only for a rough lead (never perfect)
// Easy / Normal / Hard. Easy is the default for Chill and new players. Hard is sharp but not an aimbot.
export const BOT_DIFFS = [
  { id: 'easy', name: 'Easy', react: 0.38, err: 0.42, dodge: 0.36, deflect: 0.08, cd: 1.7, think: 0.24, range: 8.2, lead: 0.28, aggr: 0.55, mistake: 0.22 },
  { id: 'normal', name: 'Normal', react: 0.22, err: 0.18, dodge: 0.68, deflect: 0.22, cd: 1.0, think: 0.16, range: 10, lead: 0.72, aggr: 0.85, mistake: 0.06 },
  { id: 'hard', name: 'Hard', react: 0.10, err: 0.08, dodge: 0.88, deflect: 0.42, cd: 0.55, think: 0.10, range: 11.6, lead: 1.0, aggr: 1.0, mistake: 0 },
];
const P = BOT_DIFFS;
const OUT = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false };
const PM = { // persona tuning: range, err, deflect+, dash chance, pref distance, cd mult, pickup radius, charge
  defender: { range: 1, err: 1, def: 0.28, dash: 0.5, pref: 1.15, cd: 1.0, pu: 9, ch: 1 },
  trickster: { range: 1, err: 1.1, def: 0.05, dash: 0.95, pref: 0.95, cd: 0.9, pu: 10, ch: 0.6 },
  sniper: { range: 1.25, err: 0.75, def: 0.1, dash: 0.5, pref: 1.2, cd: 0.92, pu: 8, ch: 1.35 },
  aggressor: { range: 0.95, err: 1.2, def: 0.05, dash: 0.4, pref: 1.0, cd: 1.0, pu: 7, ch: 0.55 },
  collector: { range: 1, err: 1, def: 0.1, dash: 0.6, pref: 1.05, cd: 1.0, pu: 16, ch: 1 },
  duelist: { range: 1.05, err: 0.8, def: 0.15, dash: 0.6, pref: 1.0, cd: 0.85, pu: 9, ch: 1.2 },
  boss: { range: 1.1, err: 0.7, def: 0.0, dash: 0.0, pref: 0.8, cd: 0.7, pu: 0, ch: 1.4 },
};
// Per-fighter playstyles (bots419). Numbers tweak preferred range, catch hunger, retreat, bush use, melee eagerness, charge, in/out dashes.
export const BOT_STYLES = {
  bao:  { pref: 6.0, catch: 1.55, retreat: 0.45, bush: 0.28, melee: 0.85, charge: 1.0, dashIn: 0, dashOut: 0, ambush: 0, steal: 0, chillChase: 0 },
  nori: { pref: 5.6, catch: 1.05, retreat: 1.15, bush: 0.22, melee: 0.7, charge: 0.45, dashIn: 0.7, dashOut: 0.95, ambush: 0, steal: 0, chillChase: 0 },
  tako: { pref: 6.0, catch: 1.0, retreat: 1.0, bush: 0.18, melee: 0.7, charge: 0.12, dashIn: 0.2, dashOut: 0.2, ambush: 0, steal: 0, chillChase: 0 },
  kuma: { pref: 6.2, catch: 1.15, retreat: 0.95, bush: 0.2, melee: 0.8, charge: 0.7, dashIn: 0.12, dashOut: 0.15, ambush: 0, steal: 1, chillChase: 0 },
  pico: { pref: 6.9, catch: 1.28, retreat: 1.10, bush: 0.12, melee: 0.4, charge: 0.35, dashIn: 0, dashOut: 0.55, ambush: 0, steal: 0, chillChase: 0 },
  yuki: { pref: 6.4, catch: 1.05, retreat: 0.9, bush: 0.14, melee: 0.75, charge: 0.7, dashIn: 0.4, dashOut: 0.1, ambush: 0, steal: 0, chillChase: 1 },
  gus:  { pref: 5.8, catch: 1.05, retreat: 0.95, bush: 0.1, melee: 0.82, charge: 0.5, dashIn: 0.18, dashOut: 0.22, ambush: 0, steal: 0, chillChase: 0 },
  wisp: { pref: 5.0, catch: 1.2, retreat: 1.0, bush: 0.8, ambush: 1, melee: 0.6, charge: 0.4, dashIn: 0.85, dashOut: 0.3, steal: 0, chillChase: 0 },
  puff: { pref: 6.5, catch: 1.36, retreat: 0.9, bush: 0.16, melee: 0.55, charge: 0.38, dashIn: 0.35, dashOut: 0.7, ambush: 0, steal: 0, chillChase: 0 },
};

export class Bot {
  constructor(g, f, diff, persona) {
    this.g = g; this.f = f; this.pm = PM[persona] || PM.duelist; this.persona = persona;
    const di = Math.max(0, Math.min(2, diff | 0)); this.diff = di;
    const base = P[di];
    this.d = { ...base, range: base.range * this.pm.range, err: base.err * this.pm.err, deflect: Math.min(0.85, base.deflect + this.pm.def * (di + 1) / 2), cd: base.cd * this.pm.cd };
    if (f.mods && f.mods.stun) { this.d.err *= 0.6; this.d.dodge = Math.min(1, (this.d.dodge || 0.66) * 1.2); this.d.cd *= 0.85; }
    const hid = (f.hero && f.hero.id) || '';
    this.sty = BOT_STYLES[hid] || BOT_STYLES.bao; this.hid = hid;
    if (hid === 'gus') { this.d.err *= 1.14; this.d.react *= 1.08; this.d.cd *= 1.08; }
    if (hid === 'bao') { this.d.dodge = Math.min(0.94, this.d.dodge * 1.28); this.d.err *= 0.84; this.d.cd *= 0.84; }
    if (hid === 'kuma') { this.d.err *= 1.55; this.d.cd *= 1.4; this.d.lead *= 0.35; this.d.react *= 1.3; this.d.dodge = Math.max(0.2, this.d.dodge * 0.8); }
    if (hid === 'pico') { this.d.dodge = Math.min(0.94, this.d.dodge * 1.40); this.d.err *= 0.80; this.d.cd *= 0.78; }
    if (hid === 'nori') { this.d.dodge = Math.min(0.94, this.d.dodge * 1.3); this.d.err *= 0.85; this.d.react *= 0.88; this.d.cd *= 0.88; }
    if (hid === 'wisp') { this.d.dodge = Math.min(0.94, this.d.dodge * 1.3); this.d.err *= 0.82; this.d.react *= 0.85; this.d.cd *= 0.88; }
    if (hid === 'yuki') { this.d.dodge = Math.min(0.94, this.d.dodge * 1.12); this.d.err *= 0.9; this.d.react *= 0.92; }
    this.thinkT = Math.random() * 0.2; this.dir = [0, 0]; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 1; this.threatT = 0; this.holdT = 0; this.holding = false; this.aim = [0, 0];
    this.throwWait = 0.5 + Math.random() * 0.8; this.pendDash = 0; this.sideLock = 0; this.target = null; this.goalPU = null; this.out = { ...OUT };
    this._sx = f.x; this._sz = f.z; this._stuck = 0; this._nori = 'in';
    this.st = { dodge: 0, throw: 0, lead: 0, catchSeek: 0, bushSeek: 0, retreat: 0, special: 0, melee: 0, mistake: 0, stuck: 0, dashIn: 0, dashOut: 0 };
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
    { const pr = poisonRect(g); if (pr) { const dp = Math.max(Math.abs(x) - pr.sx, Math.abs(z) - pr.sz) + POISON.botMargin; if (dp > 0) return Math.min(7.5, 5 + dp * 0.4); } } // v4.8 poison: danger grows with depth, so bots flee toward the middle
    const td = g.traps ? g.traps.danger(x, z) : 0;
    return Math.max(td, t === T.CONV ? 0.8 : t === T.WATER ? 1.4 : 0);
  }
  nearestBush(maxD) {
    const g = this.g, f = this.f, B = g.layout && g.layout.bush; if (!B) return null;
    if (this._bush && g.time - this._bushT < 0.35) return this._bush;
    let best = null, bd2 = maxD * maxD;
    for (let k = 0; k < B.length; k++) if (B[k]) {
      const x = cx(k % AW), z = cz((k / AW) | 0); const dd = (x - f.x) * (x - f.x) + (z - f.z) * (z - f.z);
      if (dd < bd2 && this.cellDanger(x, z) < 5) { bd2 = dd; best = [x, z]; }
    }
    this._bush = best; this._bushT = g.time || 0; return best;
  }
  lowHp() {
    const f = this.f; if (!f || !f.alive) return false;
    return f.hp <= 1 || (f.maxHp >= 4 && f.hp <= Math.ceil(f.maxHp * 0.4));
  }
  wantSpecial(dist, threat, hurt) {
    const f = this.f, d = this.d, id = this.hid; if (f.ult < 100 || f.boss) return false;
    if (d.mistake && Math.random() < d.mistake * 0.5) { this.st.mistake++; return false; }
    const eager = 0.55 + 0.45 * (d.aggr || 0.8);
    if (id === 'bao') return f.hp < f.maxHp || !!(threat && f.hp >= f.maxHp);
    if (id === 'nori') return !!(threat || hurt || (dist < 4.2 && Math.random() < eager));
    if (id === 'tako') return dist < 3.5 && Math.random() < eager;
    if (id === 'kuma') return dist > 3.2 && dist < 5.0 && Math.random() < eager * 0.18;
    if (id === 'pico') return !!(threat || hurt);
    if (id === 'yuki') return dist > 1.6 && dist < 6.5 && Math.random() < eager;
    if (id === 'gus') return dist < 2.4 && Math.random() < eager * 0.4;
    if (id === 'wisp') return dist < 4.0 && (f.fadeOn || 0) < 0.45 && Math.random() < Math.min(1, eager * 1.1);
    if (id === 'puff') {
      const nearIncoming = (this.g.booms || []).some((b) => b.alive && b.owner !== f && !(b.owner && b.owner.team === f.team) && Math.hypot(b.x - f.x, b.z - f.z) < 4.6);
      return !!(nearIncoming && Math.random() < eager) || (dist < 3.8 && Math.random() < eager * 0.55);
    }
    return dist < 8 && Math.random() < 0.7 * eager;
  }
  update(dt) {
    const g = this.g, f = this.f, d = this.d, o = this.out, sty = this.sty;
    this._dt = dt; o.fire = false; o.dash = false; o.deflect = false; o.ult = false; o.melee = false; o.aimX = 0; o.aimZ = 0;
    if (g.state === 'intro') { o.mx = 0; o.mz = 0; return o; }
    this.throwWait -= dt; this.strafeT -= dt; this.sideLock -= dt; if (this._gusBack) this._gusBack = Math.max(0, this._gusBack - dt);
    // stuck check (skip while lurking in a bush / fading on purpose)
    const hiding = !!(f.bushIn) || (f.fadeOn || 0) > 0.55;
    if (Math.hypot(f.x - this._sx, f.z - this._sz) < 0.28) this._stuck += dt; else { this._stuck = 0; this._sx = f.x; this._sz = f.z; }
    if (this._stuck > 1.9 && !hiding) { this._stuck = 0; this.st.stuck++; this.dir = [Math.sin(Math.random() * 6.28), Math.cos(Math.random() * 6.28)]; if (f.dashCd <= 0 && Math.random() < 0.45) { o.dash = true; o.mx = this.dir[0]; o.mz = this.dir[1]; return this.finish(o); } }
    // ---- threats (every tick, cheap)
    let threat = null, tHit = 9;
    for (const b of g.booms) { if (b.owner === f || b.owner.team === f.team || !b.alive || b.fade > 0) continue; const th = this.predict(b, 0.55, 5, f); if (th >= 0 && th < tHit) { tHit = th; threat = b; } }
    if (threat && threat !== this.lastThreat) {
      this.lastThreat = threat;
      const miss = d.mistake && Math.random() < d.mistake;
      if (miss) this.st.mistake++;
      this.dodgeRoll = !miss && Math.random() < d.dodge;
      this.defRoll = !miss && Math.random() < d.deflect;
      this.dashRoll = Math.random() < (this.hid === 'nori' ? 0.9 : this.pm.dash);
    }
    if (threat) { this.threatT += dt; } else this.threatT = Math.max(0, this.threatT - dt * 2);
    let evade = null;
    if (threat && this.threatT > d.react) {
      // perpendicular to boomerang heading, away from its path
      const bx = Math.sin(threat.th), bz = Math.cos(threat.th); let px = -bz, pz = bx; const rel = (f.x - threat.x) * px + (f.z - threat.z) * pz; if (rel < 0) { px = -px; pz = -pz; }
      if (this.sideLock <= 0) { // check that side is safe, otherwise flip
        const safeA = this.cellDanger(f.x + px * 1.2, f.z + pz * 1.2), safeB = this.cellDanger(f.x - px * 1.2, f.z - pz * 1.2); if (safeA > 4 && safeB < safeA) { px = -px; pz = -pz; } this.sideLock = 0.4; this.side = [px, pz]; }
      evade = this.side || [px, pz];
      if (this.dodgeRoll && this.dashRoll && tHit < 0.3 && f.dashCd <= 0) { o.dash = true; o.mx = evade[0]; o.mz = evade[1]; if (this._dodgedFor !== threat) { this.st.dodge++; this._dodgedFor = threat; } return this.finish(o); }
      if (this.defRoll && tHit < 0.2 && f.deflectCd <= 0 && f.dashT <= 0) { o.deflect = true; }
      if (!this.dodgeRoll) evade = null;
      else if (this._dodgedFor !== threat) { this.st.dodge++; this._dodgedFor = threat; }
    }
    // ---- special (signature). Check after we know threat / distance.
    if (f.ult >= 100 && g.state === 'play' && !f.boss) {
      this.ultT = (this.ultT || 0) - dt;
      if (this.ultT <= 0) {
        this.ultT = 0.32;
        const tgt = this.target; const dist = tgt && tgt.alive ? Math.hypot(tgt.x - f.x, tgt.z - f.z) : 99;
        if (this.wantSpecial(dist, !!threat, this.lowHp())) { o.ult = true; this.st.special++; }
      }
    }
    // ---- decisions
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = d.think * (0.8 + Math.random() * 0.4); this.think(); }
    // ---- aiming/throwing
    if (this.target && !canSee(g, f.team, this.target)) this.target = null; // v4.9 bushes: a rival that slipped into cover is lost until it reveals itself / is found
    const tg = this.target;
    if (this.holding) {
      this.holdT -= dt; o.fire = this.holdT > 0; o.aimX = this.aim[0]; o.aimZ = this.aim[1];
      if (this.holdT <= 0 || !f.alive || f.ammo <= 0) { this.holding = false; o.fire = false; this.throwWait = d.cd * ((f.mods && f.mods.stun) || (this.target && this.target.chillT > 0) ? 0.4 : 0.7) * (0.7 + Math.random() * 0.8); }
    } else if (f.ammo > 0 && tg && tg.alive && this.throwWait <= 0 && f.throwCd <= 0 && f.dashT <= 0 && !evade) {
      const dist = Math.hypot(tg.x - f.x, tg.z - f.z);
      const rangeMul = (f.mods && f.mods.range) || 1;
      const ghost = fadedFrom(f, tg);
      // Gus only holds ammo for a shove when he is already in melee range; throw on the way in
      if (f.mods && f.mods.meleeKb > 1 && dist < 1.5) { /* hold for shove */ }
      else if (ghost && Math.random() < 0.8) { this.throwWait = 0.18 + Math.random() * 0.28; } // hesitate / lose aim on a faded Wisp
      else if (d.mistake && Math.random() < d.mistake * 0.45) { this.st.mistake++; this.throwWait = 0.25 + Math.random() * 0.5; } // Easy: a visible pause before the throw
      else if (dist < d.range * rangeMul && this.los(f, tg)) {
        // don't lob a catch straight at a steal fighter who is standing in the way
        let pirate = false;
        for (const e of g.fighters) {
          if (!e.alive || e === f || e === tg || !(e.mods && e.mods.steal)) continue;
          const ed = Math.hypot(e.x - f.x, e.z - f.z);
          if (ed < 4.2 && canSee(g, f.team, e)) { const along = ((e.x - f.x) * (tg.x - f.x) + (e.z - f.z) * (tg.z - f.z)) / (dist || 1); if (along > 0.3) pirate = true; }
        }
        if (pirate) { this.throwWait = 0.2 + Math.random() * 0.35; }
        else {
        // lead a moving target by travel time, then add human-like angle error (no aimbot)
        const tL = Math.min(0.55, dist / BOOM_SPD) * (d.lead || 0);
        let tx = tg.x + (tg.vx || 0) * tL, tz = tg.z + (tg.vz || 0) * tL;
        if (tL > 0.04 && (Math.abs(tg.vx) + Math.abs(tg.vz)) > 0.4) this.st.lead++;
        if (ghost) { tx = (this._lastGhostX ?? tx); tz = (this._lastGhostZ ?? tz); }
        else { this._lastGhostX = tg.x; this._lastGhostZ = tg.z; }
        const a0 = Math.atan2(tx - f.x, tz - f.z); const ft = Math.min(0.9, dist / 11);
        const errMul = ghost ? 3.2 : 1;
        const a = a0 - 0.5 * CURVE * ft * 0.9 + (Math.random() - 0.5) * 2 * d.err * errMul * (1 + dist / 12);
        this.aim = [Math.sin(a), Math.cos(a)]; this.holding = true;
        const wantCharge = !(f.mods && f.mods.stun) && dist > 6; /* Bolt always taps so the zap lands first */
        const ch = (this.pm.ch || 1) * (sty.charge || 1) / Math.max(0.5, f.mods.charge || 1);
        this.holdT = wantCharge ? clamp((dist - 4.5) / 10, 0.05, f.mods.stun ? 0.28 : 0.55) * ch : 0.05; o.fire = true; o.aimX = this.aim[0]; o.aimZ = this.aim[1]; this.st.throw++;
        if (this.hid === 'nori') this._nori = 'out';
        if (this.hid === 'yuki' && (tg.chillT || 0) <= 0) this._yukiThrown = true;
        }
      }
    }
    if (this.target && (this.target.stunT || 0) > 0.05) this.throwWait = Math.min(this.throwWait, 0.02);
    // Playstyle dashes: Nori in/out, Gus close, Wisp ambush after a fade, Yuki chase a chilled rival
    if (!evade && f.dashCd <= 0 && f.dashT <= 0 && Math.random() < 0.12 * (0.5 + 0.5 * (d.aggr || 0.8))) {
      const dd = tg && tg.alive ? Math.hypot(tg.x - f.x, tg.z - f.z) : 99;
      if (this.hid === 'nori') {
        if ((this._nori === 'out' || f.hp <= 1) && dd < 4.6) { o.dash = true; o.mx = f.x - (tg ? tg.x : f.x); o.mz = f.z - (tg ? tg.z : f.z); this._nori = 'in'; this.st.dashOut++; return this.finish(o); }
        if (this._nori === 'in' && f.hp > 1 && tg && dd > 5.2 && dd < 10 && !((tg.mods && tg.mods.meleeKb > 1) || (tg.maxHp >= 5))) { o.dash = true; o.mx = tg.x - f.x; o.mz = tg.z - f.z; this._nori = 'out'; this.st.dashIn++; return this.finish(o); }
      }
      const tank = !!(tg && ((tg.mods && tg.mods.meleeKb > 1) || (tg.maxHp >= 5)));
      if (tank && this.lowHp() && dd < 4.2 && this.hid !== 'gus' && f.dashCd <= 0) {
        o.dash = true; o.mx = f.x - tg.x; o.mz = f.z - tg.z; this.st.dashOut++; return this.finish(o);
      }
      if (sty.dashIn && tg && tg.alive && !tank && dd > 1.6 && dd < 5.4 && (this.hid !== 'wisp' || (f.fadeOn || 0) > 0.55)) {
        o.dash = true; o.mx = tg.x - f.x; o.mz = tg.z - f.z; this.st.dashIn++; return this.finish(o);
      }
    }
    // style416 leftover: Nori still pokes if the in/out cycle didn't fire this frame
    if (!evade && this.hid === 'nori' && f.dashCd <= 0 && f.dashT <= 0 && Math.random() < 0.04) {
      const dsh = this.target && this.target.alive ? [this.target.x - f.x, this.target.z - f.z] : this.dir;
      if (Math.hypot(dsh[0], dsh[1]) > 0.4) { o.dash = true; o.mx = dsh[0]; o.mz = dsh[1]; this.st.dashIn++; return this.finish(o); }
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
    // v4.8: in (or right next to) the poison -> head for the middle, steering around holes / walls
    if (inPoison(g, f.x, f.z, POISON.botMargin) && (!evade || inPoison(g, f.x, f.z, -1.5))) { const d = this.poisonPath(); if (d) { o.mx = d[0]; o.mz = d[1]; } }
    if (this.holding) { o.mx *= 0.5; o.mz *= 0.5; }
    return this.finish(o);
  }
  // v4.8: shortest walkable route (BFS over floor cells, around walls / holes / lava / spikes) to the safe area
  poisonPath() {
    const g = this.g, f = this.f, pr = poisonRect(g); if (!pr) return null; const si = ci(f.x), sj = cj(f.z); if (!inb(si, sj)) return [-Math.sign(f.x) || 0, -Math.sign(f.z) || 0];
    const sk = idx(si, sj); if (this._pp && this._ppK === sk && g.time - this._ppT < 0.3) return this._pp; this._ppK = sk; this._ppT = g.time;
    const N = AW * AH; const prev = this._ppPrev && this._ppPrev.length === N ? this._ppPrev : (this._ppPrev = new Int32Array(N)); prev.fill(-2);
    const m = Math.max(0.3, Math.min(POISON.botMargin, Math.min(pr.sx, pr.sz) - 0.6)); const q = [sk]; prev[sk] = -1; let goal = -1;
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % AW, j = (k / AW) | 0; if (!inPoison(g, cx(i), cz(j), m)) { goal = k; break; }
      for (let n = 0; n < 4; n++) { const ni = i + (n === 0 ? 1 : n === 1 ? -1 : 0), nj = j + (n === 2 ? 1 : n === 3 ? -1 : 0); if (!inb(ni, nj)) continue; const nk = idx(ni, nj); if (prev[nk] !== -2) continue; const t = g.layout.t[nk]; if (g.sol[nk] || g.hole[nk] !== 0 || t === T.LAVA || t === T.SPIKE) continue; prev[nk] = k; q.push(nk); } }
    if (goal < 0) { const l = Math.hypot(f.x, f.z) || 1; return (this._pp = [-f.x / l, -f.z / l]); }
    const path = []; for (let k = goal; prev[k] !== -1; k = prev[k]) path.push(k);
    let tk = path.length ? path[path.length - 1] : goal; if (path.length > 1 && Math.hypot(cx(tk % AW) - f.x, cz((tk / AW) | 0) - f.z) < 0.35) tk = path[path.length - 2];
    if (!path.length) tk = goal; const dx = cx(tk % AW) - f.x, dz = cz((tk / AW) | 0) - f.z, l = Math.hypot(dx, dz);
    if (l < 0.05) { const l2 = Math.hypot(f.x, f.z) || 1; return (this._pp = [-f.x / l2, -f.z / l2]); } return (this._pp = [dx / l, dz / l]);
  }
  pathBad(dx, dz) { const f = this.f; for (let s = 0.7; s <= 3.1; s += 0.7) { if (this.cellDanger(f.x + dx * s, f.z + dz * s) >= 8) return true; } return false; }
  finish(o) {
    if (o.dash) {
      let dx = o.mx, dz = o.mz; if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(this.f.face); dz = Math.cos(this.f.face); }
      if (this.pathBad(dx, dz)) { let best = null, bd = 9; const w = Math.atan2(dx, dz); for (let n = 0; n < 12; n++) { const a = n / 12 * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a); if (this.pathBad(sx, sz)) continue; const d = Math.abs(angDiff(w, a)); if (d < bd) { bd = d; best = [sx, sz]; } }
        if (best) { o.mx = best[0]; o.mz = best[1]; } else o.dash = false; }
    }
    // v4.10 melee: swing only at a rival this bot can SEE (slashTarget skips hidden bush rivals) already inside reach, after a human-like reaction delay; same cooldown as players
    { const g = this.g, f = this.f; if (g.melee && g.state === 'play' && f.canSlash()) { const tg = f.slashTarget(0); if (tg) { const slMul = ((f.mods && f.mods.meleeKb > 1) ? 0.55 : 1) / Math.max(0.5, this.sty.melee || 1); this.slWait = (this.slWait === undefined || this.slWait < 0 ? this.d.react * slMul : this.slWait) - (this._dt || 1 / 60); if (this.slWait <= 0) { o.melee = true; o.fire = false; this.slWait = -1; this.holding = false; this.st.melee++; if (this.hid === 'gus') this._gusBack = 0.8; } } else this.slWait = -1; } }
    return o;
  }
  think() {
    const g = this.g, f = this.f, d = this.d, sty = this.sty;
    const R = g.rules; let tg = null, bd = 1e9;
    for (const e of g.fighters) { if (!e.alive || !g.isFoe(f, e) || !canSee(g, f.team, e)) continue; let dist = Math.hypot(e.x - f.x, e.z - f.z); if (R.type === 'koth' && g.zone && Math.hypot(e.x - g.zone.x, e.z - g.zone.z) < 2.6) dist *= 0.6; if (R.type === 'bomb' && g.mst.holder === e && f !== g.mst.holder) dist *= 0.5; if (dist < bd) { bd = dist; tg = e; } }
    if (R.type === 'bomb') { const hd = g.mst.holder; if (hd === f) { tg = null; bd = 1e9; for (const e of g.fighters) { if (e === f || !e.alive || e.tagImmune > 0 || !canSee(g, f.team, e)) continue; const dist = Math.hypot(e.x - f.x, e.z - f.z); if (dist < bd) { bd = dist; tg = e; } } } }
    this.target = tg; let gx = 0, gz = 0;
    // power-up goal
    let pu = null, pd = 1e9; const puR = this.pm.pu * ((f.mods && f.mods.steal) || sty.steal ? 1.45 : 1); for (const p of g.powerups) { const dist = Math.hypot(p.x - f.x, p.z - f.z); if (dist < pd && dist < puR) { pd = dist; pu = p; } }
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 0.8 + Math.random() * 1.6; }
    const ob = g.objective ? g.objective(f) : null;
    const tp = (g.traps && g.traps.botPlan && Math.random() < 0.7) ? g.traps.botPlan(f) : null;
    const hurt = this.lowHp();
    const bush = ((sty.bush || 0) > 0.2 || hurt) ? this.nearestBush(hurt ? 10 : 7) : null;
    if (ob && (ob.force || !tg || bd > (ob.yield || 3.2))) { gx = ob.x - f.x; gz = ob.z - f.z; const od = Math.hypot(gx, gz); if (od < 0.5) { gx = 0; gz = 0; } if (tg && !ob.force && bd < 7) { gx += -(tg.z - f.z) / (bd || 1) * this.strafe * 0.3; } }
    else if (tp && (!tg || bd > 2.6) && !hurt) { gx = tp.x - f.x; gz = tp.z - f.z; }
    else if (pu && (!tg || bd > 3.2) && !hurt) { gx = pu.x - f.x; gz = pu.z - f.z; }
    else if (tg) {
      const dx = tg.x - f.x, dz = tg.z - f.z, dist = bd || 1; const ux = dx / dist, uz = dz / dist;
      let pref = (f.ammo > 0 ? sty.pref : sty.pref + 2.2) * this.pm.pref * (0.5 + 0.5 * ((f.mods && f.mods.range) || 1));
      pref *= 1 + (1 - (d.aggr || 0.8)) * 0.28; // Easy stays a little farther
      if (R.type === 'bomb') pref = g.mst.holder === f ? 3.5 : 9; if (f.boss) pref = 4.6;
      if (f.mods && f.mods.meleeKb > 1) pref = Math.min(pref, 4.2);
      if (f.mods && f.mods.catchR > 1.15 && f.ammo === 0) pref = Math.min(pref, 5.2);
      if (tg && (tg.chillT || 0) > 0.15 && sty.chillChase) pref = 3.6; // Yuki: throw to chill, then chase
      else if (tg && (tg.chillT || 0) > 0.15) pref = 5.0;
      if (tg && (tg.stunT || 0) > 0.05) pref = Math.min(pref, 4.4);
      if (tg && ((tg.mods && tg.mods.range) || 1) > 1 && f.ammo > 0) pref = Math.max(pref, 6.5); // joust a sniper, don't walk into the first throw
      if (tg && ((tg.mods && tg.mods.meleeKb > 1) || (tg.maxHp >= 5)) && this.hid !== 'gus') pref = Math.max(pref, 6.3); // keep out of the wrestler's shove
      if (hurt) { pref += 2.4 * (sty.retreat || 1); this.st.retreat++; }
      if (this._gusBack > 0 && tg) pref = Math.max(pref, 5.4);
      let k = clamp((dist - pref) / 3, -1, 1); gx = ux * k; gz = uz * k;
      gx += -uz * this.strafe * 0.8; gz += ux * this.strafe * 0.8;
      if (f.ammo > 0 && !this.los(f, tg)) { gx += ux * 0.8; gz += uz * 0.8; }
      if (f.ammo === 0 && dist > 5) { gx *= 0.2; gz *= 0.2; }
      // wall repulsion
      gx += clamp(-f.x / HX, -1, 1) * 0.25 * Math.max(0, Math.abs(f.x) / HX - 0.6) * 4; gz += clamp(-f.z / HZ, -1, 1) * 0.25 * Math.max(0, Math.abs(f.z) / HZ - 0.6) * 4;
      if (R.type === 'koth' && g.zone) { const zx = g.zone.x - f.x, zz = g.zone.z - f.z, zd = Math.hypot(zx, zz); if (zd > 1.6 && (bd > 3 || zd < 4.5)) { gx = zx / zd * 0.95; gz = zz / zd * 0.95; } else if (zd <= 1.6) { gx *= 0.25; gz *= 0.25; gx += -uz * this.strafe * 0.4; gz += ux * this.strafe * 0.4; } }
    }
    // Catch own returns (Bao especially). Easy can forget sometimes — a kid-readable miss.
    let catching = false;
    for (const b of g.booms) if (b.owner === f && b.alive && b.phase === 'ret') {
      if (d.mistake && Math.random() < d.mistake * 0.4) { this.st.mistake++; continue; }
      const w = 0.22 * (sty.catch || 1) * (f.mods && f.mods.catchR > 1.15 ? 1.35 : 1);
      gx += (b.x - f.x) * w; gz += (b.z - f.z) * w; catching = true; this.st.catchSeek++;
    }
    if (sty.steal || (f.mods && f.mods.steal)) { for (const b of g.booms) { if (b.owner === f || !b.alive || b.phase !== 'ret') continue; const dd = Math.hypot(b.x - f.x, b.z - f.z); if (dd < 0.9) { gx += (b.x - f.x) * 0.2; gz += (b.z - f.z) * 0.2; this.st.catchSeek++; } } }
    // Bushes and cover: Wisp lurks then ambushes; anyone low on hearts can duck in; others wander in sometimes
    if (!pu && !catching) {
      const hidden = !!(f.bushIn) || (f.fadeOn || 0) > 0.7;
      if (sty.ambush) {
        this._hunt = Math.max(0, (this._hunt || 0) - 1);
        if (hidden) this._wispHide = (this._wispHide || 0) + 1;
        else { if ((this._wispHide || 0) > 2 && tg) this._hunt = 8; this._wispHide = 0; }
        const tank = !!(tg && ((tg.mods && tg.mods.meleeKb > 1) || (tg.maxHp >= 5)));
        if (this._hunt > 0 && tg) {
          // lurk-and-poke: close to mid range, then fade again (do not dive a ready rival)
          if (bd < (tank ? 5.0 : 3.4)) { gx = f.x - tg.x; gz = f.z - tg.z; } else { gx = tg.x - f.x; gz = tg.z - f.z; }
        } else if (this._wispHide > 3 && tg) { gx = tg.x - f.x; gz = tg.z - f.z; this._hunt = 8; }
        else if ((!tg || bd > 4.8 || hurt) && !hidden && bush) { gx = bush[0] - f.x; gz = bush[1] - f.z; this.st.bushSeek++; }
        else if (hidden && this._wispHide <= 3 && (!tg || bd > 3.8)) { gx *= 0.12; gz *= 0.12; }
      } else if (bush && (hurt || ((sty.bush || 0) > 0.25 && (!tg || bd > 6) && Math.random() < sty.bush * 0.35))) {
        gx = bush[0] - f.x; gz = bush[1] - f.z; this.st.bushSeek++;
      }
    }
    if (f.mods && f.mods.slide && !catching) { // Yuki keeps a little drift so the slide stays visible, but stands to catch
      if (Math.hypot(gx, gz) < 0.15 && f.ammo > 0) { gx += this.strafe * 0.45; gz += 0.2; }
    }
    // Easy: sometimes wander the wrong way for a beat
    if (d.mistake && Math.random() < d.mistake * 0.2) { this.st.mistake++; gx += (Math.random() - 0.5) * 1.2; gz += (Math.random() - 0.5) * 1.2; }
    const l = Math.hypot(gx, gz); if (l > 0.01) { const s = Math.min(1, l); this.dir = [gx / l * s, gz / l * s]; } else this.dir = [0, 0];
  }
}
