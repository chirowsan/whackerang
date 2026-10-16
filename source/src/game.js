// Core simulation: fighters, boomerangs, crates, hazards, power-ups, rounds.
import { THREE, gfx, shake, pulseFov } from './gfx.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { S } from './save.js';
import { AW, AH, HX, HZ, clamp, ci, cj, cx, cz, idx, inb, rr, angDiff, pick, shuffle } from './util.js';
import { HEROES, POWERUPS, PLAYER_COLORS } from './data.js';
import { buildFighter, buildBoomerang, buildPowerup } from './models.js';
import { ArenaView, genLayout, T, SPAWNS } from './arena.js';
import { Bot } from './ai.js';

export const FR = 0.4, SPEED = 5.3, CURVE = 0.95, SUDDEN_AT = 48;
const dirx = (a) => Math.sin(a), dirz = (a) => Math.cos(a);
const NOINP = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false };

class Fighter {
  constructor(g, def, slotIdx, spawn) {
    this.g = g; this.def = def; this.hero = def.hero; this.idx = slotIdx; this.name = def.name; this.color = PLAYER_COLORS[slotIdx]; this.isBot = def.ctrl === 'bot';
    this.x = spawn[0]; this.z = spawn[1]; this.vx = 0; this.vz = 0; this.ex = 0; this.ez = 0; this.face = spawn[0] < 0 ? Math.PI / 2 : -Math.PI / 2; this.vface = this.face;
    this.alive = true; this.deadT = 0; this.mods = { speed: 1, dashCd: 1, charge: 1, catchR: 1, puDur: 1, ...(this.hero.mods || {}) };
    this.maxAmmo = 1; this.ammo = 1; this.charging = false; this.chargeT = 0; this.prevFire = false; this.lastAim = [0, 0]; this.throwCd = 0; this.throwT = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = [0, 1]; this.deflectT = 0; this.deflectCd = 0; this.inv = 0; this.shield = false;
    this.pu = { triple: 0, giant: 0, fire: 0, homing: 0, speed: 0 }; this.move = 0; this.kos = 0; this.pushed = false; this.fallT = 0; this.deathKind = ''; this.koVx = 0; this.koVz = 0; this.air = 0; this.spawnT = 0;
    this.model = buildFighter(this.hero, def.hat || 'none', this.color); g.scene.add(this.model.root);
    this.bot = this.isBot ? new Bot(g, this, def.diff === undefined ? 1 : def.diff) : null;
    this.wins = def.wins || 0; this.tmr = Math.random() * 10;
  }
  get speed() { return SPEED * this.mods.speed * (this.pu.speed > 0 ? 1.4 : 1) * (this.charging ? 0.62 : 1); }
  update(dt) {
    const g = this.g; this.tmr += dt;
    if (!this.alive) { this.deadT += dt; this.koAnim(dt); return; }
    this.spawnT = Math.min(1, this.spawnT + dt * 3);
    for (const k in this.pu) if (this.pu[k] > 0) this.pu[k] = Math.max(0, this.pu[k] - dt);
    this.dashCd -= dt; this.deflectCd -= dt; this.throwCd -= dt; this.throwT = Math.max(0, this.throwT - dt * 4); this.inv = Math.max(0, this.inv - dt); this.deflectT = Math.max(0, this.deflectT - dt);
    let inp = NOINP;
    if (g.state === 'play' || g.state === 'roundEnd') inp = this.bot ? this.bot.update(dt) : (g.input ? g.input.read(this.def.slot, this) : NOINP);
    if (g.state === 'roundEnd' && !this.bot && false) inp = NOINP;
    // --- dash
    if (inp.dash && this.dashCd <= 0 && this.dashT <= 0) {
      let dx = inp.mx, dz = inp.mz; if (Math.hypot(dx, dz) < 0.2) { dx = dirx(this.face); dz = dirz(this.face); } const l = Math.hypot(dx, dz) || 1;
      this.dashDir = [dx / l, dz / l]; this.dashT = 0.17; this.dashCd = 0.95 * this.mods.dashCd; this.inv = 0.22; this.pushed = false; this.charging = false; this.chargeT = 0; this.vface = this.face = Math.atan2(dx, dz);
      sfx('dash'); fx.puff(this.x, 0.15, this.z, 6, 0xffffff, 0.3); shake(0.06);
    }
    // --- deflect
    if (inp.deflect && this.deflectCd <= 0 && this.dashT <= 0) { this.deflectT = 0.3; this.deflectCd = 0.85; this.charging = false; this.chargeT = 0; sfx('deflectfail'); }
    // --- movement
    const hz = g.cellType(this.x, this.z); const ice = g.arenaId === 'ice';
    if (this.dashT > 0) {
      this.dashT -= dt; const sp = 17; this.vx = this.dashDir[0] * sp; this.vz = this.dashDir[1] * sp;
      if (this.dashT <= 0) { this.vx *= 0.35; this.vz *= 0.35; }
      if (Math.random() < 0.7) fx.glow.spawn(this.x, 0.3, this.z, 0, 0.2, 0, 0.2, 0.3, Math.random() < 0.5 ? this.hero.trail : this.color, 0, 0, 0, -0.2);
    } else {
      const sp = this.speed; const tx = inp.mx * sp, tz = inp.mz * sp; const acc = (ice ? 4.5 : 38) * dt; const stopping = (inp.mx === 0 && inp.mz === 0);
      const a2 = stopping ? (ice ? 1.6 : 34) * dt : acc;
      this.vx += clamp(tx - this.vx, -a2, a2); this.vz += clamp(tz - this.vz, -a2, a2);
    }
    // conveyor
    this.ex = 0; this.ez = 0; if (hz === T.CONV) { const k = idx(ci(this.x), cj(this.z)); this.ex = g.layout.dx[k] * 2.6; this.ez = g.layout.dz[k] * 2.6; }
    this.x += (this.vx + this.ex) * dt; this.z += (this.vz + this.ez) * dt; g.resolve(this, FR);
    if (this.dashT > 0 && !this.pushed) g.tryPush(this);
    this.stepT = (this.stepT || 0) - dt; if (this.move > 0.6 && this.dashT <= 0 && this.stepT <= 0) { this.stepT = 0.13; fx.glow.spawn(this.x - dirx(this.vface) * 0.15, 0.08, this.z - dirz(this.vface) * 0.15, (Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4, 0.09, 0.32, this.hero.trail, 0, 0, 0, -0.25); }
    const sp2 = Math.hypot(this.vx, this.vz); this.move += ((sp2 > 0.5 ? Math.min(1, sp2 / 5) : 0) - this.move) * Math.min(1, dt * 12);
    // --- aiming / throwing
    const aiming = inp.aimX !== 0 || inp.aimZ !== 0;
    if (this.charging && !inp.fire && this.prevFire) { /* handled below */ }
    if (inp.fire && !this.charging && this.ammo > 0 && this.throwCd <= 0 && this.dashT <= 0 && this.deflectT <= 0) { this.charging = true; this.chargeT = 0; this.lastAim = [0, 0]; }
    if (this.charging) {
      this.chargeT += dt * this.mods.charge; if (aiming) { this.lastAim = [inp.aimX, inp.aimZ]; this.face = Math.atan2(inp.aimX, inp.aimZ); }
      if (Math.floor(this.chargeT * 12) !== Math.floor((this.chargeT - dt * this.mods.charge) * 12) && this.chargeT < 0.8) sfx('charge', Math.min(1, this.chargeT));
      if (!inp.fire) { this.release(); }
    }
    this.prevFire = inp.fire;
    // face
    if (!this.charging) { if (this.dashT <= 0 && Math.hypot(inp.mx, inp.mz) > 0.2) this.face = Math.atan2(inp.mx, inp.mz); else if (aiming) this.face = Math.atan2(inp.aimX, inp.aimZ); }
    this.vface += angDiff(this.vface, this.face) * Math.min(1, dt * 18);
    // --- hazards
    if (this.dashT <= 0) {
      const t = g.cellType(this.x, this.z); const k = idx(ci(this.x), cj(this.z));
      if (g.hole[k] < 0) this.die(null, 'fall', 0, 0);
      else if (t === T.LAVA) this.die(null, 'lava', 0, 0);
      else if (t === T.SPIKE && g.spk[k] > 0.6) this.die(null, 'spike', 0, 0);
    }
  }
  release() {
    const g = this.g; this.charging = false; const c = clamp(this.chargeT / 0.7, 0, 1); this.chargeT = 0;
    if (this.ammo <= 0) return;
    const explicit = Math.hypot(this.lastAim[0], this.lastAim[1]) > 0.2; const base = explicit ? Math.atan2(this.lastAim[0], this.lastAim[1]) : this.face;
    g.throwFrom(this, base, explicit, c);
  }
  koAnim(dt) {
    const m = this.model, t = this.deadT;
    if (this.deathKind === 'fall') { this.air -= dt * (4 + t * 14); m.root.scale.setScalar(Math.max(0, 1 - t * 1.3)); m.body.rotation.y += dt * 8; }
    else if (this.deathKind === 'lava' || this.deathKind === 'spike') { m.root.scale.setScalar(Math.max(0, 1 - Math.max(0, t - 0.35) * 2)); this.air = Math.max(0, 0.5 * Math.sin(Math.min(t * 5, 3.1))); m.body.rotation.y += dt * 14; }
    else { // launched spin-out
      this.x += this.koVx * dt; this.z += this.koVz * dt; this.koVx *= 0.985; this.koVz *= 0.985; this.air = Math.max(-1.2, 2.4 * t * (1 - t * 0.9) * 2.2 - 0.0); if (t > 1.0) { m.root.scale.setScalar(Math.max(0, 1 - (t - 1.0) * 2)); }
      m.body.rotation.y += dt * 18; m.body.rotation.x = Math.min(1.4, t * 3);
      if (this.x < -HX + 0.3 || this.x > HX - 0.3) { this.koVx *= -0.6; this.x = clamp(this.x, -HX + 0.3, HX - 0.3); } if (this.z < -HZ + 0.3 || this.z > HZ - 0.3) { this.koVz *= -0.6; this.z = clamp(this.z, -HZ + 0.3, HZ - 0.3); }
    }
  }
  die(killer, kind, kx, kz) {
    if (!this.alive) return; const g = this.g;
    this.alive = false; this.deadT = 0; this.deathKind = kind; this.charging = false; this.model.aim.visible = false; this.model.bubble.visible = false; this.model.deflect.visible = false;
    const l = Math.hypot(kx, kz) || 1; this.koVx = kx / l * 9; this.koVz = kz / l * 9;
    g.onKO(this, killer, kind);
  }
  giveAmmo() { this.ammo = Math.min(this.maxAmmo, this.ammo + 1); }
}

class Boom {
  constructor(g, owner, x, z, ang, c, o) {
    this.g = g; this.owner = owner; this.x = x; this.z = z; this.th = ang; this.t = 0; this.phase = 'out'; this.alive = true; this.carry = o.carry; this.bounces = 0; this.total = 0;
    this.giant = o.giant; this.fire = o.fire; this.homing = o.homing; this.hitR = o.giant ? 0.85 : 0.3; this.v0 = 13 + 8 * c; this.tout = 0.8 + 0.7 * c; this.retT = 0; this.w = CURVE * (1 - 0.35 * c); this.spin = 0; this.fade = 0;
    this.mesh = buildBoomerang(owner.color, owner.hero); this.mesh.scale.setScalar(o.giant ? 2.3 : 1); g.scene.add(this.mesh); this.reflected = 0;
  }
  update(dt) {
    const g = this.g, o = this.owner; this.total += dt; this.spin += dt * 19;
    if (this.fade > 0) { this.fade -= dt * 4; if (this.fade <= 0) this.kill(); return; }
    // sub-step for tunnelling safety
    const n = 2, h = dt / n;
    for (let s = 0; s < n && this.alive; s++) {
      let speed;
      if (this.phase === 'out') {
        this.t += h; const k = this.t / this.tout; speed = this.v0 * (1 - 0.68 * Math.min(1, k)); this.th += this.w * h * (1 - 0.3 * k);
        if (this.homing) { const tg = g.nearestEnemy(this.owner, this.x, this.z, 1e9); if (tg) { const a = Math.atan2(tg.x - this.x, tg.z - this.z); this.th += clamp(angDiff(this.th, a), -3.4 * h, 3.4 * h); } }
        if (this.t >= this.tout) { this.phase = 'ret'; this.retT = 0; }
      } else {
        this.retT += h; speed = 8 + 15 * Math.min(1, this.retT / 0.8);
        if (!o.alive) { this.fade = 1; return; }
        const a = Math.atan2(o.x - this.x, o.z - this.z); const rate = 5.5 + this.retT * 7; this.th += clamp(angDiff(this.th, a), -rate * h, rate * h);
      }
      this.x += dirx(this.th) * speed * h; this.z += dirz(this.th) * speed * h;
      g.boomCollide(this);
      if (!this.alive) return;
      // catch
      if (o.alive && (this.phase === 'ret' || this.t > 0.22) && Math.hypot(o.x - this.x, o.z - this.z) < 0.62 * o.mods.catchR + (this.giant ? 0.3 : 0) && this.total > 0.25) { this.caught(); return; }
      g.boomHitFighters(this);
      if (!this.alive) return;
    }
    if (this.total > 7) { this.caught(true); return; }
    if (Math.random() < 0.9) fx.trail(this.x, 0.5, this.z, this.owner.color, this.giant ? 0.34 : 0.17);
  }
  caught(quiet) {
    const o = this.owner; if (o.alive && this.carry) o.giveAmmo(); this.kill();
    if (!quiet && o.alive) { sfx('catch'); fx.sparks(o.x, 0.6, o.z, 8, [o.color, 0xffffff], { speed: 3, life: 0.4, size: 0.09 }); fx.ring(o.x, 0.1, o.z, 0xffffff, 1.6, 0.3); o.throwT = 0.5; o.catchPop = 0.2; o.happyT = 1.0; this.g.onEvent('catch', { f: o }); }
  }
  kill() { if (!this.alive) return; this.alive = false; this.g.scene.remove(this.mesh); }
  vis(dt) {
    const m = this.mesh; m.position.set(this.x, 0.5 + Math.sin(this.total * 20) * 0.02, this.z); m.userData.inner.rotation.y = this.spin;
    if (this.fade > 0) m.scale.setScalar((this.giant ? 2.3 : 1) * Math.max(0, this.fade));
    m.userData.glow.material.opacity = this.fire ? 0.9 : 0.5;
    if (this.fire && Math.random() < 0.8) fx.glow.spawn(this.x, 0.5, this.z, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), 0.2, 0.35, Math.random() < 0.5 ? 0xff7a1a : 0xffd060, 0, 0, 0, -0.3);
  }
}

export class Game {
  constructor(o) {
    this.mode = o.mode || 'vs'; this.onEvent = o.onEvent || (() => {}); this.input = o.input; this.scene = gfx.scene; this.arenaId = o.arenaId; this.round = o.round || 1;
    this.layout = genLayout(this.arenaId); this.view = new ArenaView(this.scene, this.arenaId, this.layout); fx.amb = this.view.th.ambient; fx.clear();
    this.hole = new Float32Array(AW * AH); this.spk = new Float32Array(AW * AH); this.spkWarn = new Uint8Array(AW * AH); this.spkPh = new Float32Array(AW * AH);
    this.crateHp = new Uint8Array(AW * AH); this.sol = new Uint8Array(AW * AH);
    for (let k = 0; k < AW * AH; k++) { const t = this.layout.t[k]; if (t === T.CRATE) this.crateHp[k] = 2; this.sol[k] = (t === T.PILLAR || t === T.CRATE) ? 1 : 0; this.spkPh[k] = Math.random() * 4.2; }
    this.fighters = []; this.booms = []; this.powerups = []; this.pushes = [];
    const order = o.players.length === 2 ? [0, 1] : [0, 1, 2, 3];
    o.players.forEach((d, i) => { const sp = SPAWNS[order[i]]; this.fighters.push(new Fighter(this, d, i, [cx(sp[0]), cz(sp[1])])); });
    this.time = 0; this.state = 'intro'; this.introT = o.intro === undefined ? 3.2 : o.intro; this.lastCount = 0; this.endT = 0; this.hitstop = 0; this.timeScale = 1; this.slowT = 0;
    this.puT = 3.5; this.suddenRing = -1; this.suddenT = 0; this.sudden = false; this.crackT = 8; this.result = null; this.koFlash = 0; this.playTime = 0;
    fx.init && 0;
  }
  dispose() {
    for (const f of this.fighters) this.scene.remove(f.model.root); for (const b of this.booms) this.scene.remove(b.mesh); for (const p of this.powerups) this.scene.remove(p.mesh);
    this.view.dispose(); this.booms.length = 0; fx.clear();
  }
  // -------- grid helpers
  cellType(x, z) { const i = ci(x), j = cj(z); return inb(i, j) ? this.layout.t[idx(i, j)] : 0; }
  solid(i, j) { return inb(i, j) && this.sol[idx(i, j)] === 1; }
  // circle vs solid cells + bounds
  resolve(f, r) {
    for (let it = 0; it < 2; it++) {
      const i0 = ci(f.x - r), i1 = ci(f.x + r), j0 = cj(f.z - r), j1 = cj(f.z + r);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!this.solid(i, j)) continue; const minx = i - HX, minz = j - HZ; const px = clamp(f.x, minx, minx + 1), pz = clamp(f.z, minz, minz + 1); let dx = f.x - px, dz = f.z - pz; const d = Math.hypot(dx, dz);
        if (d < r) { if (d > 1e-5) { f.x += dx / d * (r - d); f.z += dz / d * (r - d); } else { f.x += (f.x < minx + 0.5 ? -1 : 1) * r; } }
      }
    }
    f.x = clamp(f.x, -HX + r, HX - r); f.z = clamp(f.z, -HZ + r, HZ - r);
    // fighter separation
    for (const o of this.fighters) { if (o === f || !o.alive || !f.alive) continue; const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz); if (d < r * 1.7 && d > 1e-4) { const p = (r * 1.7 - d) * 0.5; f.x += dx / d * p; f.z += dz / d * p; } }
  }
  tryPush(f) {
    const nx = f.x + f.dashDir[0] * 0.75, nz = f.z + f.dashDir[1] * 0.75; const i = ci(nx), j = cj(nz); const k = idx(i, j);
    if (!inb(i, j) || this.crateHp[k] === 0) return; f.pushed = true;
    const ti = i + Math.round(f.dashDir[0]), tj = j + Math.round(f.dashDir[1]); const dxi = Math.abs(f.dashDir[0]) > Math.abs(f.dashDir[1]) ? Math.sign(f.dashDir[0]) : 0, dzi = dxi ? 0 : Math.sign(f.dashDir[1]);
    const ti2 = i + dxi, tj2 = j + dzi; const k2 = idx(ti2, tj2);
    if (!inb(ti2, tj2) || this.sol[k2] || this.hole[k2] !== 0 || this.layout.t[k2] === T.LAVA || this.layout.t[k2] === T.SPIKE || this.fighters.some((o) => o.alive && ci(o.x) === ti2 && cj(o.z) === tj2)) { sfx('bounce'); return; }
    this.crateHp[k2] = this.crateHp[k]; this.crateHp[k] = 0; this.sol[k2] = 1; this.sol[k] = 0; this.layout.t[k] = T.FLOOR; this.layout.t[k2] = T.CRATE;
    const mesh = this.view.crates.get(k); this.view.crates.delete(k); this.view.crates.set(k2, mesh); this.pushes.push({ mesh, t: 0, x0: mesh.position.x, z0: mesh.position.z, x1: cx(ti2), z1: cz(tj2) });
    f.dashT = Math.min(f.dashT, 0.04); sfx('push'); fx.puff(cx(i), 0.2, cz(j), 6, 0xffffff, 0.3); shake(0.1);
  }
  breakCrate(k, byFire) {
    if (this.crateHp[k] === 0) return; const i = k % AW, j = Math.floor(k / AW); this.crateHp[k] = 0; this.sol[k] = 0; this.layout.t[k] = T.FLOOR; this.view.breakCrate(k);
    const x = cx(i), z = cz(j); fx.burst(x, 0.5, z, 12, [0xc98a4a, 0x7a4a22, 0xe0b070], { speed: 4, up: 4, size: 0.14 }); fx.puff(x, 0.3, z, 5, 0xffffff, 0.35); sfx('crate'); shake(0.12);
    if (Math.random() < 0.2 && this.powerups.length < 4) this.spawnPowerupAt(x, z);
  }
  // -------- throwing
  nearestEnemy(f, x, z, maxD) { let best = null, bd = maxD; for (const o of this.fighters) { if (o === f || !o.alive) continue; const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; best = o; } } return best; }
  pickAim(f, base, explicit) {
    const assist = f.isBot ? false : S().settings.aimAssist; let tg = null;
    if (assist) {
      let bs = 1e9;
      for (const o of this.fighters) { if (o === f || !o.alive) continue; const a = Math.atan2(o.x - f.x, o.z - f.z), d = Math.abs(angDiff(base, a)), dist = Math.hypot(o.x - f.x, o.z - f.z); const lim = explicit ? 0.22 : 1.3; if (d > lim) continue; const sc = d + dist * 0.02; if (sc < bs) { bs = sc; tg = o; } }
      if (!tg && !explicit) tg = this.nearestEnemy(f, f.x, f.z, 1e9);
    }
    if (!tg) return base;
    const dist = Math.hypot(tg.x - f.x, tg.z - f.z); const a = Math.atan2(tg.x - f.x, tg.z - f.z); const ft = Math.min(0.9, dist / 11); return a - 0.5 * CURVE * ft * 0.9;
  }
  throwFrom(f, base, explicit, c) {
    const ang = f.isBot ? base : this.pickAim(f, base, explicit); f.face = ang; f.vface = ang;
    const tri = f.pu.triple > 0; const angs = tri ? [ang - 0.3, ang, ang + 0.3] : [ang];
    angs.forEach((a, i) => this.booms.push(new Boom(this, f, f.x + dirx(a) * 0.6, f.z + dirz(a) * 0.6, a, c, { carry: i === 0 ? 1 : 0, giant: f.pu.giant > 0, fire: f.pu.fire > 0, homing: f.pu.homing > 0 })));
    f.ammo--; f.throwCd = 0.16; f.throwT = 1; sfx('throw'); shake(0.04 + c * 0.05); fx.puff(f.x + dirx(ang) * 0.6, 0.5, f.z + dirz(ang) * 0.6, 3, 0xffffff, 0.2);
    this.onEvent('throw', { f });
  }
  boomCollide(b) {
    const r = b.giant ? 0.5 : 0.26; let hit = false, nx = 0, nz = 0;
    const i0 = ci(b.x - r), i1 = ci(b.x + r), j0 = cj(b.z - r), j1 = cj(b.z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!this.solid(i, j)) continue; const minx = i - HX, minz = j - HZ; const px = clamp(b.x, minx, minx + 1), pz = clamp(b.z, minz, minz + 1); let dx = b.x - px, dz = b.z - pz; const d = Math.hypot(dx, dz);
      if (d < r) { if (d > 1e-5) { dx /= d; dz /= d; } else { dx = b.x < minx + 0.5 ? -1 : 1; dz = 0; } b.x += dx * (r - d); b.z += dz * (r - d); nx += dx; nz += dz; hit = true; const k = idx(i, j); if (this.crateHp[k] > 0) { if (b.giant || b.fire) this.breakCrate(k); else { this.crateHp[k]--; if (this.crateHp[k] === 0) { this.crateHp[k] = 1; this.breakCrate(k); } else { sfx('crate'); fx.burst(cx(i), 0.6, cz(j), 4, 0xc98a4a, { speed: 3, size: 0.1 }); const m = this.view.crates.get(k); if (m) m.scale.set(0.9, 1.1, 0.9); } } } }
    }
    if (b.x < -HX + r) { b.x = -HX + r; nx += 1; hit = true; } else if (b.x > HX - r) { b.x = HX - r; nx -= 1; hit = true; }
    if (b.z < -HZ + r) { b.z = -HZ + r; nz += 1; hit = true; } else if (b.z > HZ - r) { b.z = HZ - r; nz -= 1; hit = true; }
    if (hit) {
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; let vx = dirx(b.th), vz = dirz(b.th); const dp = vx * nx + vz * nz; if (dp < 0) { vx -= 2 * dp * nx; vz -= 2 * dp * nz; b.th = Math.atan2(vx, vz); }
      b.bounces++; if (b.phase === 'out') b.t += 0.06; sfx('bounce'); fx.sparks(b.x, 0.5, b.z, 5, [0xffffff, b.owner.color], { speed: 3, life: 0.3, size: 0.08 }); shake(0.03);
      if (b.fire) { this.explode(b.x, b.z, b.owner); b.caught(true); return; }
      if (b.bounces > 7 && b.phase === 'out') b.phase = 'ret';
    }
  }
  boomHitFighters(b) {
    for (const f of this.fighters) {
      if (!f.alive || f === b.owner) continue; const d = Math.hypot(f.x - b.x, f.z - b.z);
      // deflect bubble
      if (f.deflectT > 0 && d < 1.2 + (b.giant ? 0.5 : 0)) { this.reflect(b, f); return; }
      if (d < b.hitR + FR * 0.92) {
        if (f.inv > 0 || f.dashT > 0) continue;
        if (f.shield) { f.shield = false; f.inv = 0.7; sfx('shieldpop'); fx.ring(f.x, 0.3, f.z, 0x6fffb0, 2.2, 0.35); fx.sparks(f.x, 0.6, f.z, 14, [0x6fffb0, 0xffffff], { speed: 5, life: 0.5 }); shake(0.15); b.th += Math.PI + (Math.random() - 0.5) * 0.6; if (b.phase === 'out') b.t += 0.25; this.onEvent('shieldpop', { f }); continue; }
        if (b.fire) { this.explode(b.x, b.z, b.owner); b.caught(true); return; }
        f.die(b.owner, 'boom', Math.sin(b.th), Math.cos(b.th)); b.owner.kos++;
        // boomerang keeps flying (returns) after a kill
        if (b.phase === 'out') { b.phase = 'ret'; b.retT = 0; } return;
      }
    }
  }
  reflect(b, f) {
    const o = b.owner; if (b.carry && o.alive) o.giveAmmo();
    b.owner = f; b.carry = 0; b.th = Math.atan2(o.x - b.x, o.z - b.z) + (Math.random() - 0.5) * 0.15; b.phase = 'out'; b.t = b.tout * 0.15; b.v0 = Math.max(b.v0, 15) * 1.1; b.reflected++; b.total = 0.3; b.hitR *= 1.0;
    f.deflectT = 0; sfx('deflect'); shake(0.2); fx.ring(b.x, 0.5, b.z, 0xffffff, 2.4, 0.3); fx.sparks(b.x, 0.5, b.z, 18, [0xffffff, 0xfff1a0], { speed: 6, life: 0.4 }); fx.popup('PARRY!', f.x, f.z, 'pop-cyan'); this.hitstop = 0.06;
    b.mesh.removeFromParent(); b.mesh = buildBoomerang(f.color, f.hero); b.mesh.scale.setScalar(b.giant ? 2.3 : 1); this.scene.add(b.mesh); this.onEvent('parry', { f });
  }
  explode(x, z, owner) {
    sfx('explode'); shake(0.55); pulseFov(0.6); this.hitstop = Math.max(this.hitstop, 0.07);
    fx.ring(x, 0.2, z, 0xffb060, 5.2, 0.45); fx.sparks(x, 0.6, z, 36, [0xffd060, 0xff7a20, 0xfff0b0], { speed: 8, up: 2.5, life: 0.7 }); fx.burst(x, 0.5, z, 10, [0x333344, 0x555566], { speed: 3, up: 3, size: 0.12 });
    fx.puff(x, 0.4, z, 10, 0xff9a40, 0.7);
    for (const f of this.fighters) { if (!f.alive || f === owner) continue; if (Math.hypot(f.x - x, f.z - z) < 2.3) { if (f.inv > 0 || f.dashT > 0) continue; if (f.shield) { f.shield = false; f.inv = 0.7; sfx('shieldpop'); continue; } f.die(owner, 'boom', f.x - x, f.z - z); owner.kos++; } }
    for (let j = cj(z - 2.3); j <= cj(z + 2.3); j++) for (let i = ci(x - 2.3); i <= ci(x + 2.3); i++) { if (!inb(i, j)) continue; if (Math.hypot(cx(i) - x, cz(j) - z) < 2.3) { const k = idx(i, j); if (this.crateHp[k] > 0) this.breakCrate(k, true); } }
  }
  onKO(f, killer, kind) {
    const slow = S().settings.hitstop; if (slow) this.hitstop = 0.11;
    const col = f.color; fx.sparks(f.x, 0.6, f.z, 28, [col, 0xffffff, f.hero.color], { speed: 7, life: 0.7 }); fx.ring(f.x, 0.3, f.z, col, 3.4, 0.4); fx.burst(f.x, 0.6, f.z, 10, [f.hero.color, f.hero.accent], { speed: 4, up: 4, size: 0.14 });
    shake(kind === 'boom' ? 0.6 : 0.3); pulseFov(0.5);
    if (kind === 'boom') { sfx('hit'); sfx('ko'); const w = pick(['BONK!', 'KO!', 'POW!', 'BOOM!', 'THWACK!']); fx.popup(w, f.x, f.z, 'pop-hit'); }
    else if (kind === 'fall') { sfx('fall'); fx.popup('WHOOPS!', f.x, f.z, 'pop-cyan'); } else if (kind === 'lava') { sfx('sizzle'); fx.popup('SIZZLE!', f.x, f.z, 'pop-hit'); fx.sparks(f.x, 0.4, f.z, 20, [0xff7a1a, 0xffd060], { speed: 5, up: 4 }); } else { sfx('spike'); sfx('ko'); fx.popup('OUCH!', f.x, f.z, 'pop-hit'); }
    if (killer && killer.alive) killer.happyT = 1.3;
    this.onEvent('ko', { f, killer, kind });
  }
  // -------- power-ups
  spawnPowerupAt(x, z, kind) {
    kind = kind || pick(Object.keys(POWERUPS)); const mesh = buildPowerup(kind); mesh.position.set(x, 0, z); this.scene.add(mesh); this.powerups.push({ x, z, kind, mesh, t: 0 }); sfx('spawn'); fx.ring(x, 0.1, z, POWERUPS[kind].color, 1.8, 0.4); fx.sparks(x, 0.7, z, 8, POWERUPS[kind].color, { speed: 2.5, life: 0.5 });
  }
  spawnPowerup() {
    for (let tries = 0; tries < 30; tries++) {
      const i = 1 + Math.floor(Math.random() * (AW - 2)), j = 1 + Math.floor(Math.random() * (AH - 2)), k = idx(i, j);
      if (this.sol[k] || this.layout.t[k] !== T.FLOOR || this.hole[k] !== 0) continue; const x = cx(i), z = cz(j);
      if (this.fighters.some((f) => f.alive && Math.hypot(f.x - x, f.z - z) < 1.6) || this.powerups.some((p) => Math.hypot(p.x - x, p.z - z) < 2)) continue;
      this.spawnPowerupAt(x, z); return;
    }
  }
  applyPowerup(f, kind) {
    const d = 9 * f.mods.puDur; sfx('pickup'); fx.ring(f.x, 0.2, f.z, POWERUPS[kind].color, 2.6, 0.4); fx.sparks(f.x, 0.7, f.z, 14, [POWERUPS[kind].color, 0xffffff], { speed: 4, life: 0.5 }); fx.popup(POWERUPS[kind].name.toUpperCase(), f.x, f.z, 'pop-pu', 1.9);
    switch (kind) { case 'extra': f.maxAmmo = Math.min(3, f.maxAmmo + 1); f.ammo = Math.min(f.maxAmmo, f.ammo + 1); break; case 'shield': f.shield = true; break; default: f.pu[kind] = d; }
    this.onEvent('pickup', { f, kind });
  }
  // -------- hazards
  updateHazards(dt) {
    const L = this.layout;
    for (const s of this.view.spikes) { const k = idx(s.i, s.j); const ph = (this.playTime + this.spkPh[k]) % 4.2; let tgt = 0; this.spkWarn[k] = 0; if (ph > 3.2) tgt = 1; else if (ph > 2.4) this.spkWarn[k] = 1; this.spk[k] += (tgt - this.spk[k]) * Math.min(1, dt * (tgt ? 30 : 10)); if (tgt === 1 && ph - dt <= 3.2) sfx('spike'); }
    for (let k = 0; k < AW * AH; k++) {
      const h = this.hole[k]; if (h > 0) { this.hole[k] = h - dt; if (this.hole[k] <= 0) { this.hole[k] = -1; const i = k % AW, j = Math.floor(k / AW); if (this.crateHp[k]) { this.crateHp[k] = 0; this.sol[k] = 0; this.view.breakCrate(k); } const p = this.view.pillars.get(k); if (p) { this.view.pillars.delete(k); this.view.root.remove(p); this.sol[k] = 0; this.layout.t[k] = T.FLOOR; } fx.puff(cx(i), 0, cz(j), 4, 0xffffff, 0.3); } }
    }
    for (const l of this.view.lavas) if (Math.random() < dt * 1.2) fx.glow.spawn(cx(l.i) + (Math.random() - 0.5) * 0.7, 0.2, cz(l.j) + (Math.random() - 0.5) * 0.7, 0, 1.2, 0, 0.1, 0.6, 0xffa030, 2.5);
    // pushed crates tween
    for (let n = this.pushes.length - 1; n >= 0; n--) { const p = this.pushes[n]; p.t += dt / 0.16; const k = Math.min(1, p.t); p.mesh.position.x = p.x0 + (p.x1 - p.x0) * k; p.mesh.position.z = p.z0 + (p.z1 - p.z0) * k; if (p.t >= 1) this.pushes.splice(n, 1); }
    // cracking ice
    if (this.arenaId === 'ice' && this.state === 'play') { this.crackT -= dt; if (this.crackT <= 0) { this.crackT = 7 + Math.random() * 4; for (let n = 0; n < 2; n++) this.crackRandom(); } }
    // sudden death: shrinking rings
    if (this.state === 'play' && this.playTime > SUDDEN_AT) {
      if (!this.sudden) { this.sudden = true; this.onEvent('sudden'); sfx('rumble'); }
      this.suddenT -= dt; if (this.suddenT <= 0 && this.suddenRing < 4) { this.suddenRing++; this.suddenT = 4.2; for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) { if (Math.min(i, j, AW - 1 - i, AH - 1 - j) === this.suddenRing) { const k = idx(i, j); if (this.hole[k] === 0) this.hole[k] = 1.0 + Math.random() * 1.6; } } sfx('rumble'); shake(0.2); }
    }
  }
  crackRandom() { for (let t = 0; t < 20; t++) { const i = Math.floor(Math.random() * AW), j = Math.floor(Math.random() * AH), k = idx(i, j); if (this.hole[k] !== 0 || SPAWNS.some(([a, b]) => Math.abs(a - i) < 2 && Math.abs(b - j) < 2)) continue; this.hole[k] = 1.5; sfx('warn'); return; } }
  // -------- main update
  update(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; this.vis(dt); return; }
    if (this.slowT > 0) { this.slowT -= dt; dt *= 0.4; }
    this.time += dt;
    if (this.state === 'intro') {
      this.introT -= dt; const c = Math.ceil(this.introT);
      if (c !== this.lastCount) { this.lastCount = c; if (c <= 3 && c > 0 && this.mode !== 'attract') sfx('beep'); this.onEvent('countdown', { n: c }); }
      if (this.introT <= 0) { this.state = 'play'; if (this.mode !== 'attract') sfx('go'); this.onEvent('go'); }
    } else if (this.state === 'play' || this.state === 'roundEnd') {
      if (this.state === 'play') { this.playTime += dt; this.puT -= dt; if (this.puT <= 0) { this.puT = 6 + Math.random() * 3; if (this.powerups.length < 3) this.spawnPowerup(); } }
      if (this.state === 'roundEnd') { this.endT += dt; if (this.endT > 2.3 && !this.result) { this.result = 'done'; this.onEvent('roundEnd', { winner: this.winner }); } }
    }
    for (const f of this.fighters) f.update(dt);
    for (let i = this.booms.length - 1; i >= 0; i--) { const b = this.booms[i]; if (this.state !== 'intro') b.update(dt); if (!b.alive) this.booms.splice(i, 1); }
    // power-up pickup
    for (let i = this.powerups.length - 1; i >= 0; i--) { const p = this.powerups[i]; p.t += dt; for (const f of this.fighters) { if (f.alive && Math.hypot(f.x - p.x, f.z - p.z) < 0.8) { this.applyPowerup(f, p.kind); this.scene.remove(p.mesh); this.powerups.splice(i, 1); break; } } }
    this.updateHazards(dt);
    if (this.state === 'play') {
      const alive = this.fighters.filter((f) => f.alive);
      if (alive.length <= 1 && this.fighters.length > 1) { this.state = 'roundEnd'; this.endT = 0; this.winner = alive[0] || null; this.slowT = 1.0; this.onEvent('lastKO', { winner: this.winner }); }
    }
    this.vis(dt);
  }
  vis(dt) {
    const t = this.time;
    for (const f of this.fighters) {
      const m = f.model, r = m.root; r.position.set(f.x, f.alive ? 0 : Math.max(f.air, -3), f.z); r.rotation.y = f.vface;
      if (!f.alive) { r.position.y = f.air > -3 ? f.air : -3; if (f.deathKind === 'boom') r.position.y = Math.max(0, f.air); }
      const spawnK = f.spawnT; if (f.alive) r.scale.setScalar(0.7 + 0.3 * Math.min(1, spawnK * 1.2) + (f.catchPop > 0 ? f.catchPop * 0.6 : 0)); if (f.catchPop > 0) f.catchPop -= dt;
      let scared = 0; if (f.alive) for (const b of this.booms) { if (b.owner !== f && b.alive && Math.abs(b.x - f.x) < 3.2 && Math.abs(b.z - f.z) < 3.2) { scared = 1; break; } }
      if (f.happyT > 0) f.happyT -= dt;
      m.update(dt, { move: f.alive ? f.move : 0, t: f.tmr, dash: f.dashT > 0 ? f.dashT / 0.17 : 0, charge: f.charging ? Math.min(1, f.chargeT / 0.7) : 0, throwT: f.throwT, dead: !f.alive, deflect: f.deflectT, air: f.alive ? 0 : 0, win: this.state === 'roundEnd' && this.winner === f && f.alive, scared, happy: f.happyT > 0 ? 1 : 0, catchPop: f.catchPop > 0 ? f.catchPop : 0 });
      m.bubble.visible = f.shield && f.alive; if (f.shield) m.bubble.scale.setScalar(1 + Math.sin(t * 6) * 0.03);
      m.deflect.visible = f.deflectT > 0 && f.alive; if (f.deflectT > 0) { m.deflect.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); m.deflect.scale.setScalar(1 + (0.3 - f.deflectT) * 2); m.deflect.material.opacity = f.deflectT / 0.3; }
      // aim arrow
      const showAim = f.charging && !f.isBot && f.alive; m.aim.visible = showAim;
      if (showAim) { const c = Math.min(1, f.chargeT / 0.7); const len = 3 + c * 8; const a = Math.hypot(f.lastAim[0], f.lastAim[1]) > 0.2 ? Math.atan2(f.lastAim[0], f.lastAim[1]) : f.face; m.aim.rotation.y = a - f.vface;
        m.aimDots.forEach((d, i) => { d.position.set(0, 0.06, 0.9 + i * len / 9); d.scale.setScalar(0.6 + (i / 9) * 0.6); d.material.color.setHex(c > 0.95 ? 0xff7a3a : 0xffffff); }); m.aimTip.position.set(0, 0.06, 0.9 + len + 0.2); m.aimTip.material.color.setHex(c > 0.95 ? 0xff7a3a : 0xffffff); }
      m.ring.material.opacity = f.alive ? 0.95 : 0.2;
      m.blob.visible = f.alive && !gfx.sun.castShadow;
    }
    for (const b of this.booms) b.vis(dt);
    for (const p of this.powerups) { p.mesh.position.y = 0.25 + Math.sin(p.t * 3) * 0.12; p.mesh.userData.sp.scale.setScalar(0.95 + Math.sin(p.t * 6) * 0.05); }
    this.view.update(dt, this.time, this);
  }
}
