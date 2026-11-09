// Core simulation: fighters, boomerangs, crates, hazards, power-ups, rounds.
import { THREE, gfx, shake, pulseFov, punch, disposeTree } from './gfx.js';
const TFX = (id) => (TRAILS[id] || TRAILS.none).fx;
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { S, speedCfg } from './save.js';
import { AW, AH, HX, HZ, clamp, ci, cj, cx, cz, idx, inb, rr, angDiff, pick, shuffle, mulberry32, CD_LEN, CD_PRE } from './util.js';
import { HEROES, POWERUPS, PLAYER_COLORS, BOOM_TYPES, TRAILS, heroHp } from './data.js';
import { ArenaEvents } from './events.js';
import { POISON, poisonOn, poisonTick, inPoison, poisonRect, PoisonView } from './poison.js';
import { installRules } from './rules.js';
import { installRules2 } from './rules2.js';
import { buildFighter, buildBoomerang, buildWeapon, buildPowerup } from './models.js';
import { W, wpnOf, wpnFor, WEAPON_IDS } from './weapons.js';
import { ArenaView, genLayout, T, spawns } from './arena.js';
import { Bot } from './ai.js';
import { Input } from './input.js';
import { Traps } from './traps.js';
import { keepMarkOn, STEALTH, stealthOn, stealthTick, stealthVis, canSee, reveal, bushClean } from './stealth.js';

export const FR = 0.4, SPEED = 5.3, CURVE = 0.95, SUDDEN_AT = 48;
const dirx = (a) => Math.sin(a), dirz = (a) => Math.cos(a);
const NOINP = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false };

class Fighter {
  constructor(g, def, slotIdx, spawn) {
    this.g = g; this.def = def; this.hero = def.hero; this.idx = slotIdx; this.name = def.name; this.color = def.color || PLAYER_COLORS[slotIdx % 4]; this.isBot = def.ctrl === 'bot';
    this.x = spawn[0]; this.z = spawn[1]; this.vx = 0; this.vz = 0; this.ex = 0; this.ez = 0; this.face = spawn[0] < 0 ? Math.PI / 2 : -Math.PI / 2; this.vface = this.face;
    this.alive = true; this.deadT = 0; this.mods = { speed: 1, dashCd: 1, charge: 1, catchR: 1, puDur: 1, ...(this.hero.mods || {}) };
    this.maxAmmo = 1; this.ammo = 1; this.charging = false; this.chargeT = 0; this.prevFire = false; this.lastAim = [0, 0]; this.throwCd = 0; this.throwT = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = [0, 1]; this.deflectT = 0; this.deflectCd = 0; this.inv = 0; this.shield = false;
    this.pu = { triple: 0, giant: 0, fire: 0, homing: 0, speed: 0, magnet: 0, slow: 0 }; this.slowK = 1; this.hurtT = 0; this.catchChain = 0; this.lastCatchT = -99; this.magT = 0; this.move = 0; this.kos = 0; this.pushed = false; this.fallT = 0; this.deathKind = ''; this.koVx = 0; this.koVz = 0; this.air = 0; this.hopY = 0; /* v4.9: jump height defaults to 0 (Traps Off never runs the trap jump tick) */ this.spawnT = 0;
    this.model = buildFighter(this.hero, def.hat || 'none', this.color); g.scene.add(this.model.root);
    this.bot = this.isBot ? new Bot(g, this, def.diff === undefined ? 1 : def.diff, def.persona) : null;
    this.wins = def.wins || 0; this.tmr = Math.random() * 10;
    // v2 state
    this.team = def.team === undefined ? slotIdx : def.team; this.spawn = spawn; this.bs = def.scale || 1; this.boss = !!def.boss; this.abil = def.boss || def.minion || !this.hero ? null : this.hero.id; /* v4.7: per-hero passive ability */ const H0 = g.rules && g.rules.hearts; this.hp = this.maxHp = def.hp || (def.boss || def.minion ? 1 : Math.max(1, Math.min(9, H0 === 'hero' ? heroHp(this.abil) : (H0 | 0) || 1))); this.lives = def.lives || 1;
    this.baseType = def.type || 'classic'; this.type = this.baseType; this.typeT = 0; this.skin = def.skin || 'default'; this.trail = def.trail || 'none'; this.ult = def.ult0 || 0; this.ultT = 0; this.ultKind = '';
    this.frozenT = 0; this.stunT = 0; this.tagImmune = 0; this.tagCd = 0; this.respawnT = 0; this.catchPop = 0; this.happyT = 0; this.hitFlash = 0; this.emoteT = 0; this.score = 0; this.dmgTaken = 0;
    if (this.bs !== 1) this.model.root.scale.setScalar(this.bs);
    // v4.10 Armory + melee: weapon is fixed for the whole match (chosen pre-match); rooms without the capability are boomerang-only
    this.wpn = g.melee && !def.boss && !def.minion ? wpnFor(def.hero && def.hero.id || def.hero, def.weapon) : 'boom'; /* v4.11: only this character's own weapons */ this.slT = -1; this.slV = -1; this.slAng = 0; this.slCd = 0; this.slHit = new Set(); this.fireLock = false;
    if (g.melee && this.model.armR) { const hm = buildWeapon(this.wpn, this.color, this.hero, this.skin, 'classic', true); hm.scale.setScalar(this.wpn === 'boom' ? 0.8 : 0.82); hm.position.set(0.05, -0.24, 0.1); this.model.armR.add(hm); this.model.held = hm; }
    const hum = !this.isBot; const nh = g.nHumans || 1; if (this.model.setMarker) this.model.setMarker(this.color, hum ? (nh > 1 ? 'P' + (this.def.slot + 1) : 'YOU') : null, hum);
  }
  get speed() { return SPEED * this.mods.speed * (this.pu.speed > 0 ? 1.4 : 1) * (this.charging ? 0.62 : 1) * (this.ultKind === 'nori' && this.ultT > 0 ? 1.7 : 1) * (this.boss ? 0.82 : 1) * (this.hasBomb ? 1.12 : 1) * (this.gooT > 0 || this.chillT > 0 ? 0.5 : 1) * (this.carry ? 0.88 : 1) * (this.slowK || 1); }
  update(dt) {
    const g = this.g; this.tmr += dt; if (this.show) return;
    if (!this.alive) { this.deadT += dt; this.koAnim(dt); if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) g.respawn(this); } return; }
    this.spawnT = Math.min(1, this.spawnT + dt * 3);
    for (const k in this.pu) if (this.pu[k] > 0) this.pu[k] = Math.max(0, this.pu[k] - dt);
    this.hurtT = Math.max(0, this.hurtT - dt * 3); this.slowK = 1; for (const o of g.fighters) { if (o !== this && o.alive && o.pu.slow > 0 && o.team !== this.team && Math.hypot(o.x - this.x, o.z - this.z) < 4.6) { this.slowK = 0.6; break; } }
    if (this.pu.magnet > 0) { for (const p of g.powerups) { const dx = this.x - p.x, dz = this.z - p.z, d = Math.hypot(dx, dz); if (d < 7 && d > 0.3) { p.x += dx / d * 7 * dt; p.z += dz / d * 7 * dt; p.mesh.position.x = p.x; p.mesh.position.z = p.z; } } this.magT -= dt; if (this.magT <= 0) { this.magT = 0.09; const a = Math.random() * 6.28; fx.glow.spawn(this.x + Math.cos(a) * 2.6, 0.5, this.z + Math.sin(a) * 2.6, -Math.cos(a) * 9, 0.2, -Math.sin(a) * 9, 0.1, 0.28, 0xff6a7a, 0, 0, 0, -0.5); } }
    if (this.chillT > 0) this.chillT -= dt; if (this.abil === 'bao' && this.alive && this.hp < this.maxHp) { this.regenT = (this.regenT || 0) + dt; if (this.regenT >= 8) { this.regenT = 0; this.hp++; if (!this.hid) { fx.popup('+\u2665 YUM!', this.x, this.z, 'pop-catch', 1.6); sfx('pickup'); } } } /* v4.7 abilities: Yuki chill wears off, Bao regen */
    this.emoteT = Math.max(0, this.emoteT - dt); this.frozenT = Math.max(0, this.frozenT - dt); this.stunT = Math.max(0, this.stunT - dt); this.tagImmune -= dt; this.tagCd -= dt; this.hitFlash = Math.max(0, this.hitFlash - dt); if (this.typeT > 0) { this.typeT -= dt; if (this.typeT <= 0) this.type = this.baseType; } if (this.ultT > 0) { this.ultT -= dt; if (this.ultT <= 0) g.endUlt(this); } if (g.state === 'play') this.ult = Math.min(100, this.ult + dt * (this.boss ? 0 : 1.4));
    this.dashCd -= dt; this.deflectCd -= dt; this.throwCd -= dt; this.throwT = Math.max(0, this.throwT - dt * 4); this.inv = Math.max(0, this.inv - dt); this.deflectT = Math.max(0, this.deflectT - dt);
    let inp = NOINP;
    if (g.state === 'play' || g.state === 'roundEnd') inp = this.bot ? this.bot.update(dt) : (g.input ? g.input.read(this.def.slot, this) : NOINP);
    if (this.frozenT > 0 || this.stunT > 0) { inp = NOINP; this.charging = false; this.chargeT = 0; }
    if (this.dizzyT > 0 && inp !== NOINP && (inp.aimX !== 0 || inp.aimZ !== 0)) inp = { ...inp, aimX: -inp.aimX, aimZ: -inp.aimZ }; // v4.3 dizzy: aim is reversed for a moment
    if (inp.ult && this.ult >= 100 && this.alive && g.state === 'play') g.useUlt(this);
    // --- dash
    if (g.melee) this.meleeTick(dt, inp); // v4.10 close-range swing (before dash/parry so a swing in progress blocks them)
    if (inp.dash && this.dashCd <= 0 && this.dashT <= 0 && this.slT < 0) {
      let dx = inp.mx, dz = inp.mz; if (Math.hypot(dx, dz) < 0.2) { dx = dirx(this.face); dz = dirz(this.face); } const l = Math.hypot(dx, dz) || 1;
      this.dashDir = [dx / l, dz / l]; this.dashT = (g.mut && g.mut.grav ? 0.24 : 0.17); this.dashCd = 0.95 * this.mods.dashCd; this.inv = Math.max(this.inv, this.abil === 'nori' ? 0.45 : 0.22); this.pushed = false; this.charging = false; this.chargeT = 0; this.vface = this.face = Math.atan2(dx, dz);
      sfx('dash'); fx.puff(this.x, 0.15, this.z, 6, 0xffffff, 0.3); shake(0.06); g.onEvent('dash', { f: this });
    }
    // --- deflect
    if (inp.deflect && this.deflectCd <= 0 && this.dashT <= 0 && this.slT < 0) { this.deflectT = 0.3; this.deflectCd = 0.85; this.charging = false; this.chargeT = 0; sfx('deflectfail'); }
    if (this.frozenT > 0) { this.vx *= 0.8; this.vz *= 0.8; }
    // --- movement
    const hz = g.cellType(this.x, this.z); const ice = g.arenaId === 'ice' || this.iceT > 0;
    if (this.dashT > 0) {
      this.dashT -= dt; const sp = 17; this.vx = this.dashDir[0] * sp; this.vz = this.dashDir[1] * sp;
      if (this.dashT <= 0) { this.vx *= 0.35; this.vz *= 0.35; }
      if (!this.hid && Math.random() < 0.3) fx.glow.spawn(this.x, 0.3, this.z, 0, 0.2, 0, 0.16, 0.25, Math.random() < 0.5 ? this.hero.trail : this.color, 0, 0, 0, -0.2);
    } else {
      const sp = this.speed; const tx = inp.mx * sp, tz = inp.mz * sp; const acc = (ice ? 4.5 : 38) * (g.mut && g.mut.grav ? 0.45 : 1) * dt; const stopping = (inp.mx === 0 && inp.mz === 0);
      const a2 = stopping ? (ice ? 1.6 : 34) * dt : acc;
      this.vx += clamp(tx - this.vx, -a2, a2); this.vz += clamp(tz - this.vz, -a2, a2);
    }
    if (this.slT >= 0 && this.dashT <= 0) { const M = W(this.wpn).melee; if (this.slT < M.wind + M.act) { const lv = M.pat === 'lunge' ? 6 : 2.2; this.vx = dirx(this.slAng) * lv; this.vz = dirz(this.slAng) * lv; } else { this.vx *= 0.5; this.vz *= 0.5; } } // v4.10 swing: short forward lunge through the hit frames, then a slowed recovery
    // conveyor
    this.ex = 0; this.ez = 0; if (hz === T.CONV) { const k = idx(ci(this.x), cj(this.z)); this.ex = g.layout.dx[k] * 2.6; this.ez = g.layout.dz[k] * 2.6; }
    if (g.wind) { const wk = this.dashT > 0 ? 0.3 : 1; this.ex += g.wind[0] * wk; this.ez += g.wind[1] * wk; }
    if (g.events) g.events.bumpFighter(this);
    g.traps.fighterTick(this, dt);
    g.moveSub(this, (this.vx + this.ex) * dt, (this.vz + this.ez) * dt, FR); // v4.7: sub-stepped (max 0.2 cell) so dashes / knockback / bumper pops never tunnel
    if (this.dashT > 0 && !this.pushed) g.tryPush(this);
    this.stepT = (this.stepT || 0) - dt; if (this.move > 0.6 && this.dashT <= 0 && this.stepT <= 0 && !this.hid) { this.stepT = 0.13; fx.glow.spawn(this.x - dirx(this.vface) * 0.15, 0.08, this.z - dirz(this.vface) * 0.15, (Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4, 0.09, 0.32, this.hero.trail, 0, 0, 0, -0.25); }
    const sp2 = Math.hypot(this.vx, this.vz); this.move += ((sp2 > 0.5 ? Math.min(1, sp2 / 5) : 0) - this.move) * Math.min(1, dt * 12);
    // --- aiming / throwing
    const aiming = inp.aimX !== 0 || inp.aimZ !== 0;
    if (this.charging && !inp.fire && this.prevFire) { /* handled below */ }
    if (!inp.fire) this.fireLock = false; // v4.10: a tap that became a swing must be released before it can start a throw
    if (inp.fire && !this.charging && !this.fireLock && this.slT < 0 && this.ammo > 0 && this.throwCd <= 0 && this.dashT <= 0 && this.deflectT <= 0) { this.charging = true; this.chargeT = 0; this.lastAim = [0, 0]; }
    if (this.charging) {
      this.chargeT += dt * this.mods.charge; if (aiming) { this.lastAim = [inp.aimX, inp.aimZ]; this.face = Math.atan2(inp.aimX, inp.aimZ); }
      if (Math.floor(this.chargeT * 12) !== Math.floor((this.chargeT - dt * this.mods.charge) * 12) && this.chargeT < 0.8) sfx('charge', Math.min(1, this.chargeT));
      if (!inp.fire) { if (!(inp.tap && g.melee && this.tapSlash())) this.release(); } // v4.10: a quick tap next to a visible rival swings instead of throwing
    }
    this.prevFire = inp.fire;
    // face
    if (this.slT >= 0) this.face = this.slAng; else if (!this.charging) { if (this.dashT <= 0 && Math.hypot(inp.mx, inp.mz) > 0.2) this.face = Math.atan2(inp.mx, inp.mz); else if (aiming) this.face = Math.atan2(inp.aimX, inp.aimZ); }
    this.vface += angDiff(this.vface, this.face) * Math.min(1, dt * 18);
    // --- hazards
    if (this.dashT <= 0 && !(this.airT > 0)) {
      const t = g.cellType(this.x, this.z); const k = idx(ci(this.x), cj(this.z));
      if (g.hole[k] < 0 && !g.ledge(this, dt)) { this.edgeT = (this.edgeT || 0) + dt; if (this.edgeT >= (this.abil === 'wisp' ? Math.max(1, g.edgeGrace) : g.edgeGrace)) g.fallResolve(this); } // v4.4: ledge grace, v4.7: ledge assist + heart-costing rescue (see fallResolve)
      else if ((this.edgeT = 0, t === T.LAVA)) this.die(null, 'lava', 0, 0);
      else if (t === T.SPIKE && g.spk[k] > 0.6) this.die(null, 'spike', 0, 0);
    } else this.edgeT = 0;
    g.guard(this); // v4.7 safety net: NaN / out of bounds / stuck inside a pillar or crate -> back onto the nearest safe floor, free
  }
  // ---- v4.10 melee: a short swing with the weapon in hand. Only while it is held (not out flying), never while dashing / parrying / stunned / frozen.
  canSlash() { const g = this.g; return g.melee && g.state === 'play' && this.alive && !this.show && this.ammo > 0 && this.slT < 0 && this.slCd <= 0 && this.dashT <= 0 && this.deflectT <= 0 && this.frozenT <= 0 && this.stunT <= 0; }
  meleeReachTo(o) { return FR * this.bs + W(this.wpn).melee.reach + FR * 0.9 * o.bs; }
  // nearest rival this fighter can SEE (hidden bush rivals are never auto-targeted) inside swing reach (+ small slack) with no wall in between
  slashTarget(slack = 0.25) { const g = this.g; let best = null, bd = 1e9; for (const o of g.fighters) { if (!o.alive || !g.isFoe(this, o) || !canSee(g, this.team, o)) continue; const d = Math.hypot(o.x - this.x, o.z - this.z); if (d > this.meleeReachTo(o) + slack || !g.clearLine(this.x, this.z, o.x, o.z)) continue; if (d < bd) { bd = d; best = o; } } return best; }
  tapSlash() { if (!this.canSlash()) return false; const o = this.slashTarget(); if (!o) return false; this.startSlash(Math.atan2(o.x - this.x, o.z - this.z)); return true; }
  startSlash(ang) {
    const g = this.g, M = W(this.wpn).melee; this.slT = 0; this.slV = 0; this.slAng = ang; this.face = this.vface = ang; this.slHit.clear(); this.slCd = M.cd; this.charging = false; this.chargeT = 0; this.fireLock = true;
    reveal(this, STEALTH.reveal); sfx('dash'); if (g.netRec2) g.netRec2('slash', [g.fighters.indexOf(this), Math.round(ang * 100) / 100]); g.onEvent('slash', { f: this });
  }
  meleeTick(dt, inp) {
    this.slCd -= dt; const M = W(this.wpn).melee;
    if (this.slT >= 0) { const t0 = this.slT; this.slT += dt; if (this.slT >= M.wind && t0 < M.wind + M.act) this.g.slashHits(this, M); if (this.slT >= M.wind + M.act + M.rec) this.slT = -1; }
    if (inp.melee && this.canSlash()) { // explicit swing: aim stick / move dir if set, else face the nearest visible rival in reach (t401u phone MELEE button)
      let a = this.face; if (inp.aimX || inp.aimZ) a = Math.atan2(inp.aimX, inp.aimZ); else if (Math.hypot(inp.mx, inp.mz) > 0.2) a = Math.atan2(inp.mx, inp.mz);
      const o = this.slashTarget(0.35); if (o) { const ta = Math.atan2(o.x - this.x, o.z - this.z); if (!(inp.aimX || inp.aimZ) || Math.abs(angDiff(a, ta)) < 1.2) a = ta; } this.startSlash(a);
    }
  }
  release() {
    const g = this.g; this.charging = false; let c = clamp(this.chargeT / 0.7, 0, 1); this.chargeT = 0; if (this.ultKind === 'tako' && this.ultT > 0) c = 1;
    if (this.ammo <= 0) return;
    const explicit = Math.hypot(this.lastAim[0], this.lastAim[1]) > 0.2; const base = explicit ? Math.atan2(this.lastAim[0], this.lastAim[1]) : this.face;
    g.throwFrom(this, base, explicit, c);
  }
  koAnim(dt) {
    const m = this.model, t = this.deadT;
    if (this.deathKind === 'shatter') { m.root.scale.setScalar(0.0001); }
    else if (this.deathKind === 'fall') { this.air -= dt * (4 + t * 14); m.root.scale.setScalar(Math.max(0, 1 - t * 1.3)); m.body.rotation.y += dt * 8; }
    else if (this.deathKind === 'lava' || this.deathKind === 'spike' || this.deathKind === 'fire' || this.deathKind === 'zap' || this.deathKind === 'laser') { m.root.scale.setScalar(Math.max(0, 1 - Math.max(0, t - 0.35) * 2)); this.air = Math.max(0, 0.5 * Math.sin(Math.min(t * 5, 3.1))); m.body.rotation.y += dt * 14; }
    else { // launched spin-out
      this.x += this.koVx * dt; this.z += this.koVz * dt; this.koVx *= 0.985; this.koVz *= 0.985; this.air = Math.max(0, 2.4 * t * (1 - t * 0.9) * 2.2); /* v4.7: was max(-1.2, ...) = the body sank through the floor */ if (t > 1.0) { m.root.scale.setScalar(Math.max(0, 1 - (t - 1.0) * 2)); }
      m.body.rotation.y += dt * 18; m.body.rotation.x = Math.min(1.4, t * 3);
      if (this.x < -HX + 0.3 || this.x > HX - 0.3) { this.koVx *= -0.6; this.x = clamp(this.x, -HX + 0.3, HX - 0.3); } if (this.z < -HZ + 0.3 || this.z > HZ - 0.3) { this.koVz *= -0.6; this.z = clamp(this.z, -HZ + 0.3, HZ - 0.3); }
    }
  }
  // returns true when the fighter actually died (bosses / multi-hp fighters just lose hp)
  die(killer, kind, kx, kz) {
    if (!this.alive) return false; const g = this.g;
    if (g.state === 'intro' && g.mode !== 'attract') return false; // v4.5: invulnerable during the countdown
    const hazard = kind === 'fall' || kind === 'lava' || kind === 'spike' || kind === 'poison'; // v4.8 poison: like spikes (no teleport, no knockback)
    if (hazard && this.inv > 0 && !this.boss) { if (kind !== 'spike' && kind !== 'poison') g.rescue(this, false); return false; } // v4.7: invulnerable (just hit / respawned / saved) -> rescued for free, never a death
    if (this.hp > 1) {
      if (this.inv > 0 && !hazard) return false; // v4.7: brief invulnerability after losing a heart
      reveal(this, STEALTH.hurt); this.hp--; this.regenT = 0; this.inv = this.boss ? 1.0 : 1.4; this.hitFlash = 0.5; this.frozenT = 0; this.dmgTaken++; this.charging = false; this.chargeT = 0;
      if (hazard || kind === 'bomb') { this.vx = this.vz = 0; if (kind !== 'spike' && kind !== 'bomb' && kind !== 'poison') g.rescue(this, true); } else { const l = Math.hypot(kx, kz) || 1; const kb = this.abil === 'gus' ? 4.5 : 9; this.vx = kx / l * kb; this.vz = kz / l * kb; }
      g.onHurt(this, killer, kind); return false;
    }
    if (this.abil === 'kuma' && !this.nineUsed && !(this.inv > 0 && !hazard)) { this.nineUsed = true; reveal(this, STEALTH.hurt); this.inv = 1.6; this.hitFlash = 0.5; this.frozenT = 0; this.dmgTaken++; this.charging = false; this.chargeT = 0; this.vx = this.vz = 0; if (kind === 'fall' || kind === 'lava') g.rescue(this, true); fx.popup('NINE LIVES!', this.x, this.z, 'pop-gold', 2); g.onHurt(this, killer, kind); return false; } /* v4.7 Salty: once per round a KO leaves him on 1 heart */
    this.alive = false; this.hid = false; this.seen = 0; this.revealT = 0; this.deadT = 0; this.deathKind = kind; this.charging = false; this.frozenT = 0; this.stunT = 0; this.model.aim.visible = false; this.model.bubble.visible = false; this.model.deflect.visible = false; this.dmgTaken++;
    if (this.ultT > 0) g.endUlt(this);
    const l = Math.hypot(kx, kz) || 1; this.koVx = kx / l * 9; this.koVz = kz / l * 9;
    this.lives--; this.respawnT = this.lives > 0 ? g.respawnDelay(this) : 0;
    g.onKO(this, killer, kind); return true;
  }
  freezeFor(t) { reveal(this, STEALTH.hurt); this.frozenT = t; this.charging = false; this.chargeT = 0; this.vx = this.vz = 0; sfx('freeze'); fx.burst(this.x, 0.6, this.z, 10, [0xcff4ff, 0x8fdcff], { speed: 3, up: 3, size: 0.1 }); fx.ring(this.x, 0.2, this.z, 0x9ff0ff, 2.4, 0.35); }
  giveAmmo() { this.ammo = Math.min(this.maxAmmo, this.ammo + 1); }
}

const TYPEFX = { classic: {}, razor: { pierce: 1, v: 1.06 }, frost: { freeze: 1, v: 0.96 }, chain: { chain: 2, v: 1.0 }, boom: { fire: 1, v: 1.0 }, phantom: { ghost: 1, v: 0.92 } };
class Boom {
  constructor(g, owner, x, z, ang, c, o) {
    this.g = g; this.owner = owner; this.x = x; this.z = z; this.th = ang; this.t = 0; this.phase = 'out'; this.alive = true; this.carry = o.carry; this.bounces = 0; this.total = 0;
    this.type = o.type || 'classic'; const T = TYPEFX[this.type] || {}; this.pierce = !!T.pierce; this.freeze = !!T.freeze; this.chains = T.chain || 0; this.ghost = !!T.ghost; this.hit = new Set(); this.chainHits = 0;
    this.giant = o.giant; this.fire = o.fire || !!T.fire; this.homing = o.homing; this.hitR = o.giant ? 0.85 : 0.3; this.v0 = (13 + 8 * c) * (T.v || 1); this.shock = owner.abil === 'tako' && c >= 0.9; /* v4.7 Bolt: full-charge throws stun */ this.tout = (0.8 + 0.7 * c) * (g.mut && g.mut.grav ? 1.25 : 1); this.retT = 0; this.w = CURVE * (1 - 0.35 * c); this.spin = 0; this.fade = 0;
    this.wpn = wpnOf(o.wpn || owner.wpn); { const WP = W(this.wpn); this.v0 *= WP.v; this.hitR *= WP.hitR; this.tout *= WP.tout; this.w *= clamp(WP.curve, 0.5, 1.35); /* t404u: keep weapon identity, clamp extreme curves for readable paths */ const X = WP.fx || {}; this.homeK = X.home || 0; if (X.pierce) this.pierce = true; this.wstun = X.stun || 0; this.wchill = X.chill || 0; } // v4.10 Armory: per-weapon flight
    this.mesh = buildWeapon(this.wpn, owner.color, owner.hero, owner.skin, this.type); this.mesh.scale.setScalar(o.giant ? 2.3 : 1); g.scene.add(this.mesh); this.reflected = 0;
    const tr = TRAILS[owner.trail] || TRAILS.none; const rcol = owner.trail !== 'none' ? tr.color : (this.type !== 'classic' ? BOOM_TYPES[this.type].color : owner.color);
    this.ribbon = fx.ribbon(rcol, o.giant ? 0.62 : 0.36, !!tr.rainbow && owner.trail !== 'none'); this.rcol = rcol; this.tstyle = tr.fx || null;
  }
  update(dt) {
    const g = this.g, o = this.owner; this.total += dt; this.spin += dt * 19;
    if (this.fade > 0) { this.fade -= dt * 4; if (this.fade <= 0) this.kill(); return; }
    // sub-step for tunnelling safety
    const n = 2; let zk = 1; for (const q of g.fighters) { if (q.alive && q.pu.slow > 0 && q.team !== o.team && Math.hypot(q.x - this.x, q.z - this.z) < 4.6) { zk = 0.55; break; } } const h = dt * zk / n; const mg = o.pu.magnet > 0;
    for (let s = 0; s < n && this.alive; s++) {
      let speed;
      if (this.phase === 'out') {
        this.t += h; const k = this.t / this.tout; speed = this.v0 * (1 - 0.68 * Math.min(1, k)); this.th += this.w * h * (1 - 0.3 * k);
        if (this.homing || this.homeK) { const tg = g.nearestEnemy(this.owner, this.x, this.z, 1e9, null, true); if (tg) { const a = Math.atan2(tg.x - this.x, tg.z - this.z); const k = this.homing ? 3.4 : this.homeK; this.th += clamp(angDiff(this.th, a), -k * h, k * h); } }
        if (this.t >= this.tout) { this.phase = 'ret'; this.retT = 0; }
      } else {
        this.retT += h; speed = 8 + 15 * Math.min(1, this.retT / 0.8); const E = o.isBot ? 0 : g.cfg.ease; if (E > 0) { const dd = Math.hypot(o.x - this.x, o.z - this.z); if (dd < 4) speed *= 1 - E * 0.5 * (1 - dd / 4); }
        if (!o.alive) { this.fade = 1; return; }
        const a = Math.atan2(o.x - this.x, o.z - this.z); const rate = (5.5 + this.retT * 7) * (1 + (o.isBot ? 0 : g.cfg.ease) * 0.6) * (mg ? 1.5 : 1); this.th += clamp(angDiff(this.th, a), -rate * h, rate * h);
      }
      this.x += dirx(this.th) * speed * h; this.z += dirz(this.th) * speed * h;
      if (g.wind) { this.x += g.wind[0] * 0.5 * h; this.z += g.wind[1] * 0.5 * h; }
      g.boomCollide(this);
      if (!this.alive) return;
      // catch
      if (o.alive && (this.phase === 'ret' || this.t > 0.22) && Math.hypot(o.x - this.x, o.z - this.z) < 0.62 * o.mods.catchR * (o.isBot ? 1 : g.cfg.catch) * (mg ? 1.5 : 1) + (this.giant ? 0.3 : 0) && this.total > 0.25) { this.caught(); return; }
      g.boomHitFighters(this);
      if (!this.alive) return;
    }
    if (this.total > 7) { this.caught(true); return; }
    fx.trail(this.x, 0.5, this.z, this.owner.color, this.giant ? 0.22 : 0.1); /* t404u: faint consistent flight trail */
  }
  caught(quiet) {
    const o = this.owner; if (o.alive && this.carry) o.giveAmmo(); this.kill();
    if (!quiet && o.alive) { const g = this.g; o.catchChain = g.time - o.lastCatchT < 3.2 ? o.catchChain + 1 : 1; o.lastCatchT = g.time; sfx('catch', o.catchChain); fx.catchBurst(o.x, o.z, o.color, o.catchChain); if (!o.isBot) { shake(0.05); if (o.catchChain >= 2) fx.popup('CATCH x' + o.catchChain, o.x, o.z, 'pop-gold', 1.9); else fx.popup('CAUGHT!', o.x, o.z, 'pop-catch', 1.7); } o.throwT = 0.5; o.catchPop = 0.2; o.happyT = 1.0; this.g.gainUlt(o, 9); this.g.onEvent('catch', { f: o }); }
  }
  kill() { if (!this.alive) return; this.alive = false; this.g.scene.remove(this.mesh); this.ribbon.release(); }
  vis(dt) {
    const m = this.mesh; m.position.set(this.x, 0.5 + Math.sin(this.total * 20) * 0.02, this.z); m.userData.inner.rotation.y = this.spin;
    if (this.alive) this.ribbon.push(this.x, 0.5, this.z);
    if (this.fade > 0) m.scale.setScalar((this.giant ? 2.3 : 1) * Math.max(0, this.fade));
    m.userData.glow.material.opacity = this.fire ? 0.9 : 0.5;
    if (this.alive && this.tstyle) fx.trailFx(this.tstyle, this.x, 0.5, this.z, this.rcol);
    if (this.fire && Math.random() < 0.6) fx.glow.spawn(this.x, 0.5, this.z, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), 0.2, 0.35, Math.random() < 0.5 ? 0xff7a1a : 0xffd060, 0, 0, 0, -0.3);
    if (this.type === 'frost' && Math.random() < 0.4) fx.glow.spawn(this.x, 0.5, this.z, (Math.random() - 0.5) * 1.5, 0.3, (Math.random() - 0.5) * 1.5, 0.08, 0.5, 0xcff4ff, 0, 0, 0, -0.2);
  }
}

export class Game {
  constructor(o) {
    this.mode = o.mode || 'vs'; this.onEvent = o.onEvent || (() => {}); this.input = o.input; this.scene = gfx.scene; this._base = new Set(gfx.scene.children); this.arenaId = o.arenaId; this.round = o.round || 1;
    this.rules = { type: 'elim', sudden: true, ...(o.rules || {}) }; this.wind = null;
    this.dens = o.dens || (typeof window !== "undefined" && window.__bbDens) || 5; /* v4.9 calmer maps: 1 = v4.8 layout/trap density (old hosts), 2 = v4.9 */ this.melee = this.dens >= 5 && o.mode !== 'attract'; /* v4.10: dens 5 = melee swing + Armory weapons (older rooms: boomerang-only, no swing) */ this.layout = genLayout(this.arenaId, o.netSeed, this.dens); if (o.mode === 'attract' || (o.rules && o.rules.type === 'ball')) { this.layout.bush = null; /* v4.9: no bushes in Boomerang Ball (a hidden ball carrier / goalie would be unfair) */ this.layout.t.fill(0); this.layout.dx.fill(0); this.layout.dz.fill(0); } this.layout.sol0 = this.layout.t.reduce((a, v) => a + (v === T.PILLAR || v === T.CRATE ? 1 : 0), 0); this.view = new ArenaView(this.scene, this.arenaId, this.layout); fx.amb = this.view.th.ambient; fx.clear();
    const nrnd = o.netSeed != null ? mulberry32((o.netSeed ^ 0x5eed) >>> 0) : Math.random; this.netCfg = o.netCfg || null; this.net = o.net || null;
    this.edgeHelp = o.edgeHelp !== undefined ? !!o.edgeHelp : S().settings.edgeHelp !== false; this.edgeSaves = o.edgeSaves || {}; this.edgeGrace = this.edgeHelp ? 0.25 : 0.12; this.edgeNear = 0; this.edgeTickT = 0;
    this.hole = new Float32Array(AW * AH); this.spk = new Float32Array(AW * AH); this.spkWarn = new Uint8Array(AW * AH); this.spkPh = new Float32Array(AW * AH);
    this.crateHp = new Uint8Array(AW * AH); this.sol = new Uint8Array(AW * AH);
    for (let k = 0; k < AW * AH; k++) { const t = this.layout.t[k]; if (t === T.CRATE) this.crateHp[k] = 2; this.sol[k] = (t === T.PILLAR || t === T.CRATE) ? 1 : 0; this.spkPh[k] = nrnd() * 4.2; }
    this.fighters = []; this.booms = []; this.powerups = []; this.pushes = [];
    this.mut = o.mutator || null; { const _mr = Math.random; if (o.netSeed != null) Math.random = mulberry32((o.netSeed ^ 0x7a9) >>> 0); try { this.traps = new Traps(this, o.traps || 'some', this.arenaId, { none: o.noTraps, set: o.trapSet, rubber: !!(this.mut && this.mut.rubber), dens: this.dens }); } finally { Math.random = _mr; } }
    bushClean(this); if (this.bushN) this.view.buildBushes(this.layout.bush);
    const n = o.players.length; this.nHumans = o.players.filter((p) => p.ctrl !== 'bot').length || 1; const order = this.rules.teams && n === 4 ? [0, 3, 1, 2] : n === 1 ? [0] : n === 2 ? [0, 1] : n === 3 ? [0, 1, 3] : [0, 1, 2, 3];
    o.players.forEach((d, i) => { const sp = spawns()[order[i]]; let p = [cx(sp[0]), cz(sp[1])]; if (!this.safeAt(p[0], p[1], true)) p = this.safeCell({ x: p[0], z: p[1] }, true) || p; this.fighters.push(new Fighter(this, d, i, p)); }); // v4.7: spawn always on solid floor
    this.nPlayers = n; this.time = 0; this.state = 'intro'; this.cdShort = !!o.cdShort; this.goAt = o.goAt || 0; this.introT = o.intro === undefined ? (this.cdShort ? 0.9 : CD_PRE + CD_LEN) : o.intro; this.lastCount = 9; this.cdDone = this.mode === 'attract'; this.poisonView = poisonOn(this) ? new PoisonView(this) : null; this.goWall = performance.now() + this.introT * 1000; this._pw = 0; this.endT = 0; this.hitstop = 0; this.slowT = 0; this.cfg = this.netCfg || speedCfg();
    this.puT = 3.5; this.suddenRing = -1; this.suddenT = 0; this.sudden = false; this.crackT = 8; this.result = null; this.koFlash = 0; this.playTime = 0; this.winner = null; this.winTeam = -1;
    this.events = new ArenaEvents(this, o.events !== false && this.mode !== 'attract'); this.initRules();
  }
  dispose() {
    if (this.poisonView) { this.poisonView.dispose(); this.poisonView = null; }
    if (this._base) for (const c of [...this.scene.children]) if (!this._base.has(c)) disposeTree(c); // v4.5.1: free this round's GPU memory (was leaking ~60 geometries + 6 textures per round)
    for (const f of this.fighters) this.scene.remove(f.model.root); for (const b of this.booms) { this.scene.remove(b.mesh); b.ribbon.dispose(); } for (const p of this.powerups) this.scene.remove(p.mesh);
    this.events.dispose(); this.traps.dispose(); this.disposeRules(); this.view.dispose(); this.booms.length = 0; fx.clear();
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
    if (this.mut && this.mut.rubber) { if (f.x < -HX + r || f.x > HX - r) { f.vx *= -1.15; } if (f.z < -HZ + r || f.z > HZ - r) { f.vz *= -1.15; } }
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
    const mesh = this.view.crates.get(k); this.view.crates.delete(k); this.view.crates.set(k2, mesh); this.view.aoWait = 0.6; this.pushes.push({ mesh, t: 0, x0: mesh.position.x, z0: mesh.position.z, x1: cx(ti2), z1: cz(tj2) });
    f.dashT = Math.min(f.dashT, 0.04); sfx('push'); fx.puff(cx(i), 0.2, cz(j), 6, 0xffffff, 0.3); shake(0.1);
  }
  breakCrate(k, byFire) {
    if (this.crateHp[k] === 0) return; const i = k % AW, j = Math.floor(k / AW); this.crateHp[k] = 0; this.sol[k] = 0; this.layout.t[k] = T.FLOOR; this.view.breakCrate(k);
    const x = cx(i), z = cz(j); fx.burst(x, 0.5, z, 12, [0xc98a4a, 0x7a4a22, 0xe0b070], { speed: 4, up: 4, size: 0.14 }); fx.puff(x, 0.3, z, 5, 0xffffff, 0.35); sfx('crate'); shake(0.12);
    if (Math.random() < 0.2 && this.powerups.length < 4) this.spawnPowerupAt(x, z);
  }
  // -------- throwing
  // v4.10: thin swing arc on the floor, drawn ONLY during the real hit frames, exactly the cone + reach the sim tests (no big rings)
  slashArcVis(f, m, r) {
    const M = W(f.wpn).melee; if (!m.slArc) { const R1 = FR * f.bs + M.reach, R0 = Math.max(FR + 0.1, R1 - 0.38), half = M.arc * Math.PI / 360; const ring = new THREE.Mesh(new THREE.RingGeometry(R0, R1, 18, 1, -Math.PI / 2 - half, half * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; const gr = new THREE.Group(); gr.position.y = 0.12; gr.add(ring); r.add(gr); m.slArc = gr; m.slArcM = ring.material; ring.material.color.set(f.color).lerp(new THREE.Color(0xffffff), 0.55); }
    const t = f.slV, on = f.alive && t >= M.wind - 0.02 && t <= M.wind + M.act + 0.08; m.slArc.visible = on;
    if (on) { m.slArc.rotation.y = f.slAng - r.rotation.y; m.slArc.scale.setScalar(1 / (r.scale.x || 1)); m.slArcM.opacity = t <= M.wind + M.act ? 0.72 : 0.72 * (1 - (t - M.wind - M.act) / 0.08); }
  }
  isFoe(a, b) { return a !== b && a.team !== b.team; }
  clearLine(x0, z0, x1, z1) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.2)); for (let k = 1; k < n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; if (this.solid(Math.floor(x + HX), Math.floor(z + HZ))) return false; } return true; } // v4.10: walls / pillars / crates block a swing
  // v4.10 melee hit frames: every rival inside the cone + reach with a clear line is hit at most once per swing; same parry / dodge / shield / freeze / team rules as a boomerang
  slashHits(f, M) {
    const half = M.arc * Math.PI / 360;
    for (const o of this.fighters) {
      if (!o.alive || !this.isFoe(f, o) || f.slHit.has(o)) continue; const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz); if (d > f.meleeReachTo(o)) continue;
      if (d > 0.05 && Math.abs(angDiff(f.slAng, Math.atan2(dx, dz))) > half + Math.atan2(FR * o.bs, d)) continue; if (!this.clearLine(f.x, f.z, o.x, o.z)) continue;
      f.slHit.add(o); const kx = dx / (d || 1), kz = dz / (d || 1);
      if (o.deflectT > 0) { reveal(o, STEALTH.reveal); o.deflectT = 0; f.slT = -1; f.slCd = Math.max(f.slCd, 0.6); f.vx = -kx * 6; f.vz = -kz * 6; sfx('deflect'); fx.sparks((f.x + o.x) / 2, 0.6, (f.z + o.z) / 2, 10, [0xffffff, 0x9ff0ff], { speed: 4, life: 0.3 }); fx.popup('PARRY!', o.x, o.z, 'pop-cyan'); this.hitstop = 0.05; this.gainUlt(o, 20); this.onEvent('parry', { f: o }); return; } // swing blocked: attacker bounced back, no stun
      if (o.inv > 0 || o.dashT > 0) continue; // dodge i-frames / post-hit blink: the swing whiffs
      if (this.rules.stunOnly) { if (o.stunT > 0) continue; o.stunT = 1.0; o.charging = false; o.chargeT = 0; o.vx = kx * 6; o.vz = kz * 6; sfx('hit'); fx.sparks(o.x, 0.7, o.z, 8, [0xffffff, f.color], { speed: 4, life: 0.3 }); fx.popup('BONK!', o.x, o.z, 'pop-cyan'); continue; } // Ball: non-lethal like the boomerang, never re-stuns a stunned player
      if (this.rules.type === 'bomb') { this.bombHit({ owner: f }, o); continue; }
      if (o.frozenT > 0) { sfx('shatter'); this.onEvent('shatter', { f: o, killer: f }); o.frozenT = 0; if (o.die(f, 'shatter', kx, kz)) f.kos++; this.gainUlt(f, 30); continue; }
      if (o.shield) { reveal(o, STEALTH.hurt); o.shield = false; o.inv = 0.7; sfx('shieldpop'); fx.sparks(o.x, 0.6, o.z, 10, [0x6fffb0, 0xffffff], { speed: 4, life: 0.4 }); fx.popup('SHIELD!', o.x, o.z, 'pop-cyan', 1.8); this.onEvent('shieldpop', { f: o }); continue; }
      sfx('hit'); fx.sparks(o.x - kx * 0.3, 0.7, o.z - kz * 0.3, 8, [0xffffff, f.color], { speed: 4.5, life: 0.25, size: 0.08 }); this.hitstop = Math.max(this.hitstop || 0, 0.04);
      const died = o.die(f, 'boom', kx, kz); if (died) f.kos++; else if (o.alive) { if (f.abil === 'yuki') o.chillT = 1.5; const MX = W(f.wpn).mfx || {}; if (MX.stun) o.stunT = Math.max(o.stunT, MX.stun); } this.gainUlt(f, died ? 30 : 15); this.onEvent('slashhit', { f, o });
    }
  }
  nearestEnemy(f, x, z, maxD, excl, seen) { let best = null, bd = maxD; for (const o of this.fighters) { if (!o.alive || !this.isFoe(f, o) || (excl && excl.has(o)) || (seen && !canSee(this, f.team, o))) continue; const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; best = o; } } return best; }
  // t404u: simulate the real out-and-back path (no walls) so the aim preview matches flight
  predictBoomPath(f, ang, c, n = 14) {
    const WP = W(f.wpn); const curveK = clamp(WP.curve, 0.5, 1.35);
    let v0 = (13 + 8 * c) * (WP.v || 1), tout = (0.8 + 0.7 * c) * (WP.tout || 1), w = CURVE * (1 - 0.35 * c) * curveK;
    let x = f.x + dirx(ang) * 0.6 * f.bs, z = f.z + dirz(ang) * 0.6 * f.bs, th = ang, t = 0, phase = 'out', retT = 0;
    const raw = [[x, z]], h = 1 / 40, homeK = (WP.fx && WP.fx.home) || 0;
    for (let i = 0; i < 160; i++) {
      let speed;
      if (phase === 'out') {
        t += h; const k = t / tout; speed = v0 * (1 - 0.68 * Math.min(1, k)); th += w * h * (1 - 0.3 * k);
        if (homeK) { const tg = this.nearestEnemy(f, x, z, 1e9, null, true); if (tg) { const a = Math.atan2(tg.x - x, tg.z - z); th += clamp(angDiff(th, a), -homeK * h, homeK * h); } }
        if (t >= tout) { phase = 'ret'; retT = 0; }
      } else {
        retT += h; speed = 8 + 15 * Math.min(1, retT / 0.8);
        const a = Math.atan2(f.x - x, f.z - z); const rate = 5.5 + retT * 7; th += clamp(angDiff(th, a), -rate * h, rate * h);
        if (Math.hypot(f.x - x, f.z - z) < 0.65 && retT > 0.12) { raw.push([x, z]); break; }
      }
      x += dirx(th) * speed * h; z += dirz(th) * speed * h; raw.push([x, z]);
    }
    const pts = []; for (let i = 0; i < n; i++) { const u = n === 1 ? 0 : i / (n - 1); const j = Math.min(raw.length - 1, Math.round(u * (raw.length - 1))); pts.push(raw[j]); }
    return pts;
  }
  pickAim(f, base, explicit) {
    // t404u: assist only gently and only when a target is near the aim line; never hard-swap launch toward a far-off rival
    const assist = f.isBot ? false : (f.netIn ? f.netIn.assist : S().settings.aimAssist); if (!assist) return base;
    const touchy = f.netIn ? f.netIn.touchy : Input.lastUsed === 'touch';
    let tg = null, bs = 1e9;
    if (explicit) {
      const lim = touchy ? 0.22 : 0.18; // ~12.5° touch / ~10° pad-mouse (was 0.6 / 0.25)
      for (const o of this.fighters) {
        if (!o.alive || !this.isFoe(f, o) || !canSee(this, f.team, o)) continue;
        const a = Math.atan2(o.x - f.x, o.z - f.z), d = Math.abs(angDiff(base, a)), dist = Math.hypot(o.x - f.x, o.z - f.z);
        if (d > lim) continue; const sc = d * 2.5 + dist * 0.01; if (sc < bs) { bs = sc; tg = o; }
      }
      if (!tg) return base;
      const a = Math.atan2(tg.x - f.x, tg.z - f.z); const diff = angDiff(base, a);
      const maxNudge = touchy ? 0.12 : 0.10; // soft pull only — launch stays near the drag direction
      return base + clamp(diff, -maxNudge, maxNudge);
    }
    // quick-tap auto-aim: nearest visible foe in a forward cone (not behind you)
    const lim = 0.95; // ~54° (was 1.5 then whole-arena nearest)
    for (const o of this.fighters) {
      if (!o.alive || !this.isFoe(f, o) || !canSee(this, f.team, o)) continue;
      const a = Math.atan2(o.x - f.x, o.z - f.z), d = Math.abs(angDiff(base, a)), dist = Math.hypot(o.x - f.x, o.z - f.z);
      if (d > lim) continue; const sc = dist + d * 1.5; if (sc < bs) { bs = sc; tg = o; }
    }
    if (!tg) return base;
    const dist = Math.hypot(tg.x - f.x, tg.z - f.z); const a = Math.atan2(tg.x - f.x, tg.z - f.z);
    const ft = Math.min(0.7, dist / 11); const curveK = clamp(W(f.wpn).curve, 0.5, 1.35);
    return a - 0.5 * CURVE * curveK * ft * 0.7; // milder curve lead than v4.10.3
  }
  throwFrom(f, base, explicit, c) {
    const ang = f.isBot ? base : this.pickAim(f, base, explicit); f.face = ang; f.vface = ang;
    const tri = f.pu.triple > 0; const angs = tri ? [ang - 0.3, ang, ang + 0.3] : [ang];
    angs.forEach((a, i) => this.booms.push(new Boom(this, f, f.x + dirx(a) * 0.6 * f.bs, f.z + dirz(a) * 0.6 * f.bs, a, c, { carry: i === 0 ? 1 : 0, giant: f.pu.giant > 0 || !!(this.mut && this.mut.giant), fire: f.pu.fire > 0, homing: f.pu.homing > 0, type: f.type })));
    reveal(f, STEALTH.reveal); f.ammo--; f.throwCd = (f.type === 'boom' ? 0.55 : 0.16) + W(f.wpn).cd; f.throwT = 1; sfx('throw', c); shake(0.04 + c * 0.05); fx.ring(f.x + dirx(ang) * 0.7, 0.45, f.z + dirz(ang) * 0.7, f.color, 1.1 + c * 0.9, 0.2); fx.puff(f.x + dirx(ang) * 0.6, 0.5, f.z + dirz(ang) * 0.6, 3, 0xffffff, 0.2);
    this.onEvent('throw', { f });
  }
  boomCollide(b) {
    const r = b.giant ? 0.5 : 0.26; let hit = false, nx = 0, nz = 0;
    const i0 = ci(b.x - r), i1 = ci(b.x + r), j0 = cj(b.z - r), j1 = cj(b.z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (b.ghost || !this.solid(i, j)) continue; if (b.pierce && this.crateHp[idx(i, j)] > 0) { this.breakCrate(idx(i, j)); continue; } const minx = i - HX, minz = j - HZ; const px = clamp(b.x, minx, minx + 1), pz = clamp(b.z, minz, minz + 1); let dx = b.x - px, dz = b.z - pz; const d = Math.hypot(dx, dz);
      if (d < r) { if (d > 1e-5) { dx /= d; dz /= d; } else { dx = b.x < minx + 0.5 ? -1 : 1; dz = 0; } b.x += dx * (r - d); b.z += dz * (r - d); nx += dx; nz += dz; hit = true; const k = idx(i, j); if (this.crateHp[k] > 0) { if (b.giant || b.fire) this.breakCrate(k); else { this.crateHp[k]--; if (this.crateHp[k] === 0) { this.crateHp[k] = 1; this.breakCrate(k); } else { sfx('crate'); fx.burst(cx(i), 0.6, cz(j), 4, 0xc98a4a, { speed: 3, size: 0.1 }); const m = this.view.crates.get(k); if (m) m.scale.set(0.9, 1.1, 0.9); } } } }
    }
    if (b.x < -HX + r) { b.x = -HX + r; nx += 1; hit = true; } else if (b.x > HX - r) { b.x = HX - r; nx -= 1; hit = true; }
    if (b.z < -HZ + r) { b.z = -HZ + r; nz += 1; hit = true; } else if (b.z > HZ - r) { b.z = HZ - r; nz -= 1; hit = true; }
    if ((this.events && this.events.bumpBoom(b)) || this.traps.bumpBoom(b)) { b.bounces++; if (b.phase === 'out') b.t += 0.05; }
    if (hit) {
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; let vx = dirx(b.th), vz = dirz(b.th); const dp = vx * nx + vz * nz; if (dp < 0) { vx -= 2 * dp * nx; vz -= 2 * dp * nz; b.th = Math.atan2(vx, vz); }
      b.bounces++; if (this.mut && this.mut.rubber) { b.v0 = Math.min(b.v0 * 1.1, 34); if (b.phase === 'out') b.t -= 0.12; } if (b.phase === 'out') b.t += 0.06; sfx('bounce'); fx.sparks(b.x, 0.5, b.z, 5, [0xffffff, b.owner.color], { speed: 3, life: 0.3, size: 0.08 }); shake(0.03);
      if (b.fire) { this.explode(b.x, b.z, b.owner); b.caught(true); return; }
      if (b.bounces > (this.mut && this.mut.rubber ? 14 : 7) && b.phase === 'out') b.phase = 'ret';
    }
  }
  boomHitFighters(b) {
    const own = b.owner;
    for (const f of this.fighters) {
      if (!f.alive || f === own || f.team === own.team) continue; if (b.hit.has(f)) continue; const d = Math.hypot(f.x - b.x, f.z - b.z);
      if (f.deflectT > 0 && d < 1.2 + (b.giant ? 0.5 : 0)) { this.reflect(b, f); return; }
      if (d < b.hitR + FR * 0.92 * f.bs) {
        if (f.inv > 0 || f.dashT > 0) continue;
        if (this.rules.stunOnly) { f.stunT = 1.4; f.charging = false; f.chargeT = 0; f.vx = Math.sin(b.th) * 7; f.vz = Math.cos(b.th) * 7; b.hit.add(f); sfx('hit'); fx.sparks(f.x, 0.7, f.z, 10, [0xffffff, own.color], { speed: 5, life: 0.4 }); fx.popup('BONK!', f.x, f.z, 'pop-cyan'); shake(0.12); if (b.phase === 'out') { b.phase = 'ret'; b.retT = 0; } return; }
        if (this.rules.type === 'bomb') { this.bombHit(b, f); b.hit.add(f); if (b.phase === 'out') { b.phase = 'ret'; b.retT = 0; } return; }
        if (f.frozenT > 0) { fx.burst(f.x, 0.6, f.z, 18, [0xcff4ff, 0x8fdcff, 0xffffff], { speed: 6, up: 4, size: 0.12 }); sfx('shatter'); this.onEvent('shatter', { f, killer: own }); f.frozenT = 0; const died = f.die(own, 'shatter', Math.sin(b.th), Math.cos(b.th)); if (died) own.kos++; this.gainUlt(own, 30); b.hit.add(f); if (!b.pierce && b.phase === 'out') { b.phase = 'ret'; b.retT = 0; } return; }
        if (f.shield) { reveal(f, STEALTH.hurt); f.shield = false; f.inv = 0.7; sfx('shieldpop'); fx.ring(f.x, 0.3, f.z, 0x6fffb0, 2.2, 0.35); fx.sparks(f.x, 0.6, f.z, 14, [0x6fffb0, 0xffffff], { speed: 5, life: 0.5 }); shake(0.15); f.hurtT = 0.6; fx.popup('SHIELD!', f.x, f.z, 'pop-cyan', 1.8); if (!f.isBot) fx.hurt(0.5); b.th += Math.PI; if (b.phase === 'out') b.t += 0.25; /* t404u: deterministic shield bounce */ this.onEvent('shieldpop', { f }); continue; }
        if (b.fire) { this.explode(b.x, b.z, own); b.caught(true); return; }
        b.hit.add(f);
        if (b.freeze) { reveal(f, STEALTH.hurt); f.freezeFor(2.6); this.gainUlt(own, 18); this.onEvent('freeze', { f, killer: own }); if (b.phase === 'out') { b.phase = 'ret'; b.retT = 0; } return; }
        const died = f.die(own, 'boom', Math.sin(b.th), Math.cos(b.th)); if (died) own.kos++; else if (f.alive) { if (b.shock) f.stunT = Math.max(f.stunT, 0.6); if (b.wstun) f.stunT = Math.max(f.stunT, b.wstun); if (b.wchill) f.chillT = Math.max(f.chillT || 0, b.wchill); if (own.abil === 'yuki') f.chillT = 1.5; } this.gainUlt(own, died ? 30 : 15); punch(Math.sin(b.th), Math.cos(b.th), 0.35);
        if (b.pierce) continue;
        if (b.chains > 0) { const nx = this.nearestEnemy(own, b.x, b.z, 7.5, b.hit, true); if (nx) { b.chains--; b.chainHits++; b.th = Math.atan2(nx.x - b.x, nx.z - b.z); b.phase = 'out'; b.t = Math.min(b.t, b.tout * 0.45); b.v0 = Math.max(b.v0, 17); fx.sparks(b.x, 0.6, b.z, 14, [0xffd060, 0xffffff], { speed: 6, life: 0.3 }); sfx('chain'); if (b.chainHits >= 2 && died) this.onEvent('chainko', { f: own }); return; } }
        if (b.phase === 'out') { b.phase = 'ret'; b.retT = 0; } return;
      }
    }
  }
  reflect(b, f) {
    const o = b.owner; if (b.carry && o.alive) o.giveAmmo();
    b.owner = f; b.carry = 0; b.th = Math.atan2(o.x - b.x, o.z - b.z); b.phase = 'out'; /* t404u: deterministic reflect */ b.t = b.tout * 0.15; b.v0 = Math.max(b.v0, 15) * 1.1; b.reflected++; b.total = 0.3; b.hit.clear();
    reveal(f, STEALTH.reveal); f.deflectT = 0; sfx('deflect'); shake(0.2); fx.ring(b.x, 0.5, b.z, 0xffffff, 2.4, 0.3); fx.star(b.x, 0.6, b.z, 0x9ff0ff, 3.4, 0.32); fx.shockwave(b.x, b.z, 0x9ff0ff, 3); fx.sparks(b.x, 0.5, b.z, 18, [0xffffff, 0xfff1a0], { speed: 6, life: 0.4 }); fx.popup('PARRY!', f.x, f.z, 'pop-cyan'); this.hitstop = 0.06; fx.flash('#bff6ff', 0.18, 140); this.gainUlt(f, 20);
    b.ribbon.release(); b.ribbon = fx.ribbon(f.color, b.giant ? 0.55 : 0.3, false);
    b.mesh.removeFromParent(); b.mesh = buildWeapon(b.wpn, f.color, f.hero, f.skin, b.type); b.mesh.scale.setScalar(b.giant ? 2.3 : 1); this.scene.add(b.mesh); this.onEvent('parry', { f });
  }
  explode(x, z, owner, rad = 2.3) {
    sfx('explode'); shake(0.55); pulseFov(0.6); this.hitstop = Math.max(this.hitstop, 0.07); fx.flash('#ffd9a0', 0.3, 220); punch(0, 1, 0.25);
    fx.shockwave(x, z, 0xffb060, rad * 2.3); fx.sparks(x, 0.6, z, 36, [0xffd060, 0xff7a20, 0xfff0b0], { speed: 8, up: 2.5, life: 0.7 }); fx.burst(x, 0.5, z, 10, [0x333344, 0x555566], { speed: 3, up: 3, size: 0.12 });
    fx.puff(x, 0.4, z, 10, 0xff9a40, 0.7); fx.scorch(x, z, rad * 1.6, 0x000000, 0.5);
    for (const f of this.fighters) { if (!f.alive || (owner && (f === owner || f.team === owner.team))) continue; if (Math.hypot(f.x - x, f.z - z) < rad) { if (f.inv > 0 || f.dashT > 0) continue; if (f.shield) { f.shield = false; f.inv = 0.7; sfx('shieldpop'); continue; } const died = f.die(owner, 'boom', f.x - x, f.z - z); if (owner && died) { owner.kos++; this.gainUlt(owner, 30); } } }
    for (let j = cj(z - rad); j <= cj(z + rad); j++) for (let i = ci(x - rad); i <= ci(x + rad); i++) { if (!inb(i, j)) continue; if (Math.hypot(cx(i) - x, cz(j) - z) < rad) { const k = idx(i, j); if (this.crateHp[k] > 0) this.breakCrate(k, true); } }
  }
  onKO(f, killer, kind) {
    if (this.modeKO) this.modeKO(f, killer, kind);
    const slow = S().settings.hitstop; if (slow) this.hitstop = kind === 'boom' || kind === 'shatter' ? 0.13 : 0.1;
    const col = f.color; const big = f.boss ? 2.4 : 1; fx.sparks(f.x, 0.6, f.z, Math.round(28 * big), [col, 0xffffff, f.hero.color], { speed: 7, life: 0.7 }); fx.shockwave(f.x, f.z, col, 4 * big); fx.burst(f.x, 0.6, f.z, 10, [f.hero.color, f.hero.accent], { speed: 4, up: 4, size: 0.14 });
    if (kind !== 'fall' && kind !== 'saw' && kind !== 'hammer') fx.scorch(f.x, f.z, 1.8 * big, 0x000000, 0.35);
    shake(kind === 'boom' ? 0.6 : 0.3); pulseFov(0.5); if (kind === 'boom' || kind === 'meteor') fx.flash('#ffffff', 0.32, 170);
    if (killer && kind === 'boom') fx.impact(f.x, f.z, killer.color, f.x - killer.x, f.z - killer.z, f.boss ? 2 : 1.35);
    if (!f.isBot && f.def.slot === 0) { fx.hurt(kind === 'boom' ? 1 : 0.8); sfx('hurt'); f.hurtT = 1; }
    if (killer) punch(f.x - killer.x, f.z - killer.z, 0.45);
    if (kind === 'boom') { sfx('hit'); sfx('ko'); const w = pick(['BONK!', 'KO!', 'POW!', 'BOOM!', 'THWACK!']); fx.popup(w, f.x, f.z, 'pop-hit'); }
    else if (kind === 'shatter') { sfx('hit'); fx.popup('SHATTERED!', f.x, f.z, 'pop-cyan'); }
    else if (kind === 'meteor') { sfx('hit'); fx.popup('METEORED!', f.x, f.z, 'pop-hit'); }
    else if (kind === 'bomb') { fx.popup('KABOOM!', f.x, f.z, 'pop-hit'); }
    else if (kind === 'slam') { sfx('hit'); fx.popup('SMASHED!', f.x, f.z, 'pop-hit'); }
    else if (kind === 'saw') { sfx('hit'); fx.popup('SLICED!', f.x, f.z, 'pop-hit'); } else if (kind === 'hammer') { sfx('hit'); sfx('ko'); fx.popup('SMASHED!', f.x, f.z, 'pop-hit'); } else if (kind === 'boulder') { sfx('hit'); fx.popup('FLATTENED!', f.x, f.z, 'pop-hit'); } else if (kind === 'crush') { sfx('hit'); fx.popup('SQUISHED!', f.x, f.z, 'pop-hit'); }
    else if (kind === 'fire') { sfx('sizzle'); fx.popup('TOASTED!', f.x, f.z, 'pop-hit'); fx.sparks(f.x, 0.4, f.z, 20, [0xff7a1a, 0xffd060], { speed: 5, up: 4 }); } else if (kind === 'zap') { sfx('hit'); fx.popup('ZAPPED!', f.x, f.z, 'pop-cyan'); fx.sparks(f.x, 0.6, f.z, 20, [0xa08aff, 0xffffff], { speed: 6, up: 3 }); } else if (kind === 'laser') { sfx('hit'); fx.popup('ZAPPED!', f.x, f.z, 'pop-hit'); }
    else if (kind === 'poison') { sfx('sizzle'); fx.popup('\u2623 POISONED!', f.x, f.z, 'pop-hit'); fx.sparks(f.x, 0.6, f.z, 20, [0x9dff3c, 0xb36bff], { speed: 4, up: 4 }); }
    else if (kind === 'fall') { sfx('fall'); fx.popup('WHOOPS!', f.x, f.z, 'pop-cyan'); } else if (kind === 'lava') { sfx('sizzle'); fx.popup('SIZZLE!', f.x, f.z, 'pop-hit'); fx.sparks(f.x, 0.4, f.z, 20, [0xff7a1a, 0xffd060], { speed: 5, up: 4 }); } else { sfx('hit'); sfx('ko'); fx.popup('OUCH!', f.x, f.z, 'pop-hit'); }
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
    const d = (kind === 'slow' ? 7 : 9) * f.mods.puDur; sfx('pickup'); if (kind === 'magnet') sfx('magnet'); else if (kind === 'slow') sfx('bubble'); fx.ring(f.x, 0.2, f.z, POWERUPS[kind].color, 2.6, 0.4); fx.sparks(f.x, 0.7, f.z, 14, [POWERUPS[kind].color, 0xffffff], { speed: 4, life: 0.5 }); fx.popup(POWERUPS[kind].name.toUpperCase(), f.x, f.z, 'pop-pu', 1.9); if (kind === 'slow') fx.ring(f.x, 0.1, f.z, 0x5aa8ff, 9.2, 0.6);
    switch (kind) { case 'extra': f.maxAmmo = Math.min(3, f.maxAmmo + 1); f.ammo = Math.min(f.maxAmmo, f.ammo + 1); break; case 'shield': f.shield = true; break; case 'rune': { const t = pick(['razor', 'frost', 'chain', 'boom', 'phantom']); f.type = t; f.typeT = 16; fx.popup(BOOM_TYPES[t].name.toUpperCase() + ' BOOMERANG', f.x, f.z, 'pop-pu', 2.4); break; } default: f.pu[kind] = d; }
    this.onEvent('pickup', { f, kind });
  }
  // -------- v4.4 falling: ledge grace, one free save per match, proximity warning
  safeCell(f, strictTraps) {
    let best = null, bd = 1e9; const self = f._self || f;
    const pz = !!poisonRect(this); // v4.8: while poison is on, first look inside the safe area (passes 0-2; pass 2 may stand close to others), then anywhere (3-4)
    for (let p0 = pz ? 0 : 3; p0 < 5 && !best; p0++) for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) { const pass = p0 === 2 ? 1 : p0 > 2 ? p0 - 1 : p0;
      const k = idx(i, j); if (this.hole[k] !== 0 || this.sol[k] || this.layout.t[k] !== T.FLOOR) continue; const x = cx(i), z = cz(j);
      if (this.traps && this.traps.danger(x, z) > 0) continue; if (p0 !== 2 && this.fighters && this.fighters.some((o) => o !== self && o.alive && Math.hypot(o.x - x, o.z - z) < 1.1)) continue;
      if (pass < 2 && inPoison(this, x, z, POISON.spawnMargin)) continue;
      if ((pass & 1) === 0) { let bad = false; for (let dj = -1; dj <= 1 && !bad; dj++) for (let di = -1; di <= 1; di++) { if (inb(i + di, j + dj) && (this.hole[idx(i + di, j + dj)] !== 0 || this.sol[idx(i + di, j + dj)] && !di && !dj)) { bad = true; break; } } if (bad) continue; }
      const d = Math.hypot(x - f.x, z - f.z); if (d < bd) { bd = d; best = [x, z]; }
    }
    return best;
  }
  fallResolve(f) {
    if (this.edgeHelp && this.mode !== 'attract' && !this.edgeSaves[f.idx]) {
      const c = this.safeCell(f);
      if (c) {
        this.edgeSaves[f.idx] = 1; const ox = f.x, oz = f.z; f.x = c[0]; f.z = c[1]; f.vx = f.vz = 0; f.ex = f.ez = 0; f.edgeT = 0; f.charging = false; f.chargeT = 0; f.dashT = 0;
        f.inv = Math.max(f.inv, 1.8); f.stunT = Math.max(f.stunT, 0.8); f.hitFlash = 0.4; f.savedFall = true;
        fx.ring(ox, 0.1, oz, 0x8ff6ff, 2.4, 0.4); fx.ring(c[0], 0.1, c[1], 0x8ff6ff, 2.8, 0.5); fx.sparks(c[0], 0.6, c[1], 14, [0x8ff6ff, 0xffffff], { speed: 4, life: 0.5 }); fx.popup('SAVED! ONCE PER MATCH', c[0], c[1], 'pop-cyan', 1.9); sfx('edgesave');
        return;
      }
    }
    f.die(null, 'fall', 0, 0); // v4.7: with hearts left this costs one heart and rescues to safe floor (Fighter.die -> rescue); only the last heart is a fall KO
  }
  // -------- v4.7 safety net
  safeAt(x, z, strict) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false; const i = ci(x), j = cj(z); if (!inb(i, j)) return false; const k = idx(i, j);
    if (this.hole[k] !== 0 || this.sol[k] || this.layout.t[k] === T.LAVA || this.layout.t[k] === T.SPIKE || this.layout.t[k] === T.PILLAR || this.layout.t[k] === T.CRATE) return false;
    if (strict) { if (this.traps && this.traps.danger && this.traps.danger(x, z) > 0) return false; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inb(i + di, j + dj) && this.hole[idx(i + di, j + dj)] < 0) return false; }
    return true;
  }
  rescue(f, hurt) {
    const ox = f.x, oz = f.z; const c = this.safeCell({ x: Number.isFinite(f.x) ? f.x : 0, z: Number.isFinite(f.z) ? f.z : 0, idx: f.idx, _self: f }) || this.anyFloor();
    if (!c) return false; f.x = c[0]; f.z = c[1]; f.vx = f.vz = 0; f.ex = f.ez = 0; f.edgeT = 0; f.dashT = 0; f.airT = 0; f.charging = false; f.chargeT = 0; f.inv = Math.max(f.inv, hurt ? 1.4 : 1.0); f.rescues = (f.rescues || 0) + 1;
    if (f.model && this.mode !== 'attract') { if (Number.isFinite(ox) && Number.isFinite(oz)) fx.ring(ox, 0.1, oz, 0x8ff6ff, 2.2, 0.35); fx.ring(c[0], 0.1, c[1], 0x8ff6ff, 2.6, 0.45); fx.sparks(c[0], 0.6, c[1], 10, [0x8ff6ff, 0xffffff], { speed: 4, life: 0.45 }); }
    this.onEvent('rescue', { f, hurt }); return true;
  }
  anyFloor() { for (let r = 0; r < Math.max(AW, AH); r++) for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) { if (Math.max(Math.abs(i - (AW >> 1)), Math.abs(j - (AH >> 1))) !== r) continue; const k = idx(i, j); if (this.hole[k] === 0 && !this.sol[k] && this.layout.t[k] !== T.LAVA) return [cx(i), cz(j)]; } return null; }
  // ledge assist: when the centre is over a hole but a solid floor tile is within reach of the fighter's feet, slide onto it instead of falling
  ledge(f, dt = 1 / 60) { // v4.7: rim assist - body still mostly on floor -> eased back (3.5 u/s, weaker than walking, so you can still step off on purpose)
    const r = 0.3; let bx = 0, bz = 0, bd = 9;
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) { const x = f.x + dx, z = f.z + dz, i = ci(x), j = cj(z); if (!inb(i, j)) continue; const k = idx(i, j); if (this.hole[k] < 0 || this.sol[k] || this.layout.t[k] === T.LAVA) continue; const d = Math.hypot(dx, dz); if (d < bd) { bd = d; bx = dx; bz = dz; } }
    if (bd > 1) return false; const m = Math.min(1, 3.5 * dt / bd); f.x += bx * m; f.z += bz * m; return true;
  }
  moveSub(f, dx, dz, r) {
    const n = Math.min(12, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2))); for (let s = 0; s < n; s++) { f.x += dx / n; f.z += dz / n; this.resolve(f, r); }
  }
  guard(f) {
    if (!f.alive) return; const bad = !Number.isFinite(f.x) || !Number.isFinite(f.z) || Math.abs(f.x) > HX + 0.01 || Math.abs(f.z) > HZ + 0.01 || (inb(ci(f.x), cj(f.z)) && this.sol[idx(ci(f.x), cj(f.z))] && !f.boss);
    if (!bad) return; if (!Number.isFinite(f.vx) || !Number.isFinite(f.vz)) { f.vx = f.vz = 0; } this.guardN = (this.guardN || 0) + 1; this.rescue(f, false);
  }
  localHuman() { return this.fighters.find((x) => !x.isBot && x.def && x.def.slot === 0); }
  edgeWatch(dt) {
    const f = this.localHuman(); let near = 0;
    if (f && f.alive && !f.show && this.mode !== 'attract' && this.edgeHelp && this.state !== 'intro') {
      const c0 = ci(f.x), r0 = cj(f.z); let best = 9;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i = c0 + di, j = r0 + dj; if (!inb(i, j) || this.hole[idx(i, j)] === 0) continue; const x0 = cx(i) - 0.5, z0 = cz(j) - 0.5; const d = Math.hypot(Math.max(x0 - f.x, 0, f.x - x0 - 1), Math.max(z0 - f.z, 0, f.z - z0 - 1)); if (d < best) best = d; }
      near = best < 1.15 ? clamp(1 - best / 1.15, 0, 1) : 0;
    }
    const prev = this.edgeNear; this.edgeNear += (near - this.edgeNear) * Math.min(1, dt * 12); if (this.view) this.view.edgeBoost = this.edgeNear;
    this.edgeTickT -= dt;
    if (near > 0.2 && this.edgeTickT <= 0) { this.edgeTickT = 0.55 - 0.3 * near; sfx('edgetick'); if ((prev < 0.2 || near > 0.6) && S().settings.vibrate && navigator.vibrate && !(this.net && this.net.isGuest === undefined && false)) { try { navigator.vibrate(prev < 0.2 ? 18 : 8); } catch (e) {} } }
  }
  // -------- hazards
  updateHazards(dt) {
    const L = this.layout;
    for (const s of this.view.spikes) { const k = idx(s.i, s.j); const ph = (this.playTime + this.spkPh[k]) % 4.2; let tgt = 0; this.spkWarn[k] = 0; if (ph > 3.2) tgt = 1; else if (ph > 2.4) this.spkWarn[k] = 1; this.spk[k] += (tgt - this.spk[k]) * Math.min(1, dt * (tgt ? 30 : 10)); if (tgt === 1 && ph - dt <= 3.2) sfx('spike'); }
    for (let k = 0; k < AW * AH; k++) {
      const h = this.hole[k]; if (h > 0) { this.hole[k] = h - dt; if (this.hole[k] <= 0) { this.hole[k] = -1; const i = k % AW, j = Math.floor(k / AW); if (this.crateHp[k]) { this.crateHp[k] = 0; this.sol[k] = 0; this.view.breakCrate(k); } const p = this.view.pillars.get(k); if (p) { this.view.pillars.delete(k); this.view.root.remove(p); this.sol[k] = 0; this.layout.t[k] = T.FLOOR; } fx.puff(cx(i), 0, cz(j), 4, 0xffffff, 0.3); } }
    }
    for (const l of this.view.lavas) if (Math.random() < dt * 0.15) fx.glow.spawn(cx(l.i) + (Math.random() - 0.5) * 0.7, 0.2, cz(l.j) + (Math.random() - 0.5) * 0.7, 0, 1.2, 0, 0.1, 0.6, 0xffa030, 2.5);
    // pushed crates tween
    for (let n = this.pushes.length - 1; n >= 0; n--) { const p = this.pushes[n]; p.t += dt / 0.16; const k = Math.min(1, p.t); p.mesh.position.x = p.x0 + (p.x1 - p.x0) * k; p.mesh.position.z = p.z0 + (p.z1 - p.z0) * k; if (p.t >= 1) this.pushes.splice(n, 1); }
    // cracking ice
    if (this.arenaId === 'ice' && this.state === 'play') { this.crackT -= dt; if (this.crackT <= 0) { this.crackT = 7 + Math.random() * 4; for (let n = 0; n < 2; n++) this.crackRandom(); } }
    // sudden death: shrinking rings
    if (this.rules.sudden && this.state === 'play' && this.playTime > SUDDEN_AT) {
      if (!this.sudden) { this.sudden = true; this.onEvent('sudden'); sfx('rumble'); }
      this.suddenT -= dt; if (this.suddenT <= 0 && this.suddenRing < 4) { this.suddenRing++; this.suddenT = 4.2; for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) { if (Math.min(i, j, AW - 1 - i, AH - 1 - j) === this.suddenRing) { const k = idx(i, j); if (this.hole[k] === 0) this.hole[k] = 1.0 + Math.random() * 1.6; } } sfx('rumble'); shake(0.2); }
    }
  }
  crackRandom() { for (let t = 0; t < 20; t++) { const i = Math.floor(Math.random() * AW), j = Math.floor(Math.random() * AH), k = idx(i, j); if (this.hole[k] !== 0 || spawns().some(([a, b]) => Math.abs(a - i) < 2 && Math.abs(b - j) < 2)) continue; this.hole[k] = 1.5; sfx('warn'); return; } }
  celebrate() {
    const w = this.winner; if (this.mode === 'attract' || this.rules.type === 'survival' && !w) return;
    if (w && w.alive) { const q = (w.hero.quip || '').replace(/"/g, ''); if (q) fx.popup(q, w.x, w.z, 'pop-quip', 2.7); w.happyT = 3; fx.shockwave(w.x, w.z, w.color, 5); if (!w.isBot || w.team === 0) { sfx('fanfare'); fx.flash('#fff3b0', 0.22, 300); } }
    sfx('koStinger'); sfx('slowmo');
  }
  // -------- main update
  // v4.5 countdown: one clock (seconds until GO). Host/offline: introT (real time, ignores Game Speed). Guests: local deadline goAt set from the host's start message (minus half the round trip), so every screen hits GO together.
  // n = 4 during the short pre-roll (title card), 3,2,1 for exactly 3 s, then GO. Fighters are locked and invulnerable while state === 'intro'.
  cdTick(rem) {
    if (this.mode === 'attract' || this.cdDone) return;
    const n = rem > CD_LEN ? 4 : Math.max(0, Math.ceil(rem - 1e-6));
    if (this.cdShort) { if (rem <= 0) { this.cdDone = true; sfx('go'); this.onEvent('go'); } return; }
    if (n !== this.lastCount && n > 0) { this.lastCount = n; if (n <= 3) sfx('beep'); this.onEvent('countdown', { n }); }
    if (rem <= 0) { this.cdDone = true; sfx('go'); this.onEvent('go'); }
  }
  cdGuest() {
    const rem = (this.goAt - performance.now()) / 1000;
    if (this.state === 'play' && rem > 0.4) { this.goAt = 0; this.onEvent('cdclear'); return; } // the host is already playing (late join / clock error): never leave the overlay up
    this.cdTick(rem); if (rem <= 0) { this.goAt = 0; if (this.input && this.input.flush) this.input.flush(); }
  }
  update(dt) {
    if (this.guestUpdate) { if (this.goAt) this.cdGuest(); this.guestUpdate(dt); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; this.vis(dt); return; }
    if (this.slowT > 0) { this.slowT -= dt; dt *= 0.4; if (this.mode !== 'attract') gfx.fovHold = 1; } else if (gfx.fovHold && this.mode !== 'attract') gfx.fovHold = 0;
    // v3.1 Game Speed: one global time scale for the whole simulation (the 3-2-1 intro and the round-end pause stay real-time)
    const cfg = this.cfg = this.netCfg || speedCfg(); const rdt = dt; if (this.state !== 'intro' && this.mode !== 'attract') dt *= cfg.ts; else if (this.mode === 'attract') dt *= Math.max(cfg.ts, 0.7);
    this.time += dt;
    if (this.state !== 'intro' && !this.cdDone) { this.cdDone = true; this.onEvent('cdclear'); } // state forced to play (tests / skip): never leave the overlay up
    if (this.state === 'intro') {
      // the countdown is real time: with slow frames (first-frame shader compile, a hitch) it follows the wall clock (goWall) so online guests, who count from the host's start time, still end together. Paused time is added back to goWall by main.js.
      this.introT -= rdt; if (this.live) { const wr = (this.goWall - performance.now()) / 1000; if (wr < this.introT) this.introT = wr; } // never later than the wall-clock deadline (slow frames / first-frame hitch); guests count from the same moment
      this.cdTick(this.introT);
      if (this.introT <= 0) { this.state = 'play'; this.onRulesGo(); if (this.input && this.input.flush && this.mode !== 'attract') this.input.flush(); } // taps made during the countdown must not fire at GO
    } else if (this.state === 'play' || this.state === 'roundEnd') {
      if (this.state === 'play') { this.playTime += dt; this.puT -= dt; if (this.puT <= 0) { this.puT = (this.rules.puEvery || 6) + Math.random() * 3; if (this.powerups.length < 3) this.spawnPowerup(); } }
      if (this.state === 'roundEnd') { if (!this.celebrated) { this.celebrated = true; this.celebrate(); } this.fwT = (this.fwT || 0) - rdt; if (this.fwT <= 0 && this.endT < 2.2 && this.winner && this.winner.alive) { this.fwT = 0.34; fx.firework(this.winner.x, this.winner.z, [this.winner.color, 0xffd23c, 0xffffff]); }
        this.endT += rdt; if (this.endT > 2.3 && !this.result) { this.result = 'done'; this.onEvent('roundEnd', { winner: this.winner, winTeam: this.winTeam }); } }
    }
    for (const f of this.fighters) f.update(dt);
    stealthTick(this, dt);
    for (let i = this.booms.length - 1; i >= 0; i--) { const b = this.booms[i]; if (this.state !== 'intro') b.update(dt); if (!b.alive) this.booms.splice(i, 1); }
    for (let i = this.powerups.length - 1; i >= 0; i--) { const p = this.powerups[i]; p.t += dt; for (const f of this.fighters) { if (f.alive && !f.boss && Math.hypot(f.x - p.x, f.z - p.z) < (f.abil === 'pico' ? 2 : 0.8)) { this.applyPowerup(f, p.kind); this.scene.remove(p.mesh); this.powerups.splice(i, 1); break; } } }
    this.traps.update(dt); this.updateHazards(dt);
    if (this.state === 'play') { this.events.update(dt); this.updateRules(dt); poisonTick(this, dt); } else this.events.idle(dt);
    this.vis(dt);
  }
  vis(dt) {
    const t = this.time; this.edgeWatch(dt);
    for (const f of this.fighters) {
      const m = f.model, r = m.root; r.position.set(f.x, f.alive ? (f.hopY || 0) + (this.mut && this.mut.grav ? 0.18 + Math.sin(t * 2.2 + f.idx) * 0.1 : 0) : Math.max(f.air, -3), f.z); r.rotation.y = f.vface + (f.stunT > 0 ? Math.sin(t * 30) * 0.25 : 0);
      if (!f.alive) { r.position.y = f.air > -3 ? f.air : -3; if (f.deathKind === 'boom') r.position.y = Math.max(0, f.air); }
      { const hk = idx(ci(f.x), cj(f.z)); const onVoid = f.alive && !f.show && this.hole[hk] < 0 && !(f.dashT > 0) && !(f.airT > 0); const w0 = f.wobK || 0; f.wobK = onVoid ? Math.min(1, w0 + dt * 10) : Math.max(0, w0 - dt * 8);
        if (f.wobK > 0) { r.rotation.z = Math.sin(t * 46) * 0.34 * f.wobK; r.rotation.x = Math.cos(t * 39) * 0.2 * f.wobK; if (f.alive) r.position.y -= 0.12 * f.wobK; if (onVoid && Math.random() < dt * 24) fx.sparks(f.x, 0.15, f.z, 1, [0xffffff, 0x8ff6ff], { speed: 1.6, life: 0.3, size: 0.07 }); } else if (w0 > 0) { r.rotation.z = 0; r.rotation.x = 0; } }
      const spawnK = f.spawnT; if (f.alive) r.scale.setScalar(f.bs * (gfx.heroZoom || 1) * (0.7 + 0.3 * Math.min(1, spawnK * 1.2) + (f.catchPop > 0 ? f.catchPop * 0.6 : 0)) * (f.ultKind === 'bao' && f.ultT > 0 ? 1.25 : 1)); if (f.catchPop > 0) f.catchPop -= dt;
      let scared = 0; if (f.alive) for (const b of this.booms) { if (b.owner !== f && b.alive && Math.abs(b.x - f.x) < 3.2 && Math.abs(b.z - f.z) < 3.2) { scared = 1; break; } }
      if (f.happyT > 0) f.happyT -= dt;
      if (f.slV >= 0) { const M = W(f.wpn).melee; f.slV += dt; if (f.slV > M.wind + M.act + M.rec || !f.alive) f.slV = -1; } // v4.10 swing animation clock (host: started with the sim swing; guest: started by the host's 'slash' event)
      if (m.held) m.held.visible = f.alive && f.ammo > 0 && !f.show;
      if (this.melee) this.slashArcVis(f, m, r);
      m.update(dt, { slash: f.slV >= 0 && f.alive ? { t: f.slV, M: W(f.wpn).melee } : null, move: f.alive ? f.move : 0, t: f.tmr, dash: f.dashT > 0 ? f.dashT / 0.17 : 0, charge: f.charging ? Math.min(1, f.chargeT / 0.7) : 0, throwT: f.throwT, dead: !f.alive, deflect: f.deflectT, air: f.alive ? 0 : 0, win: (f.show && f.show.win) || (this.state === 'roundEnd' && f.alive && (this.winTeam >= 0 ? f.team === this.winTeam : this.winner === f)), scared, happy: f.happyT > 0 ? 1 : 0, catchPop: f.catchPop > 0 ? f.catchPop : 0, hurt: Math.min(1, f.hitFlash * 2 + f.hurtT + (f.stunT > 0 ? 0.6 : 0)), emote: f.emoteT > 0 ? 1 : 0 });
      if (m.mark) { m.mark.visible = f.alive && !f.show && this.mode !== 'attract'; if (m.mark.visible) { m.mark.position.y = m.mark.userData.y0 + Math.sin(t * 4.5 + f.idx) * 0.07; keepMarkOn(m); } }
      if (m.tbub) { m.tbub.visible = f.alive && f.pu.slow > 0; if (m.tbub.visible) { m.tbub.rotation.z = t * 0.6; m.tbub.material.opacity = 0.35 + Math.sin(t * 5) * 0.12; } }
      m.bubble.visible = f.shield && f.alive; if (f.shield) m.bubble.scale.setScalar(1 + Math.sin(t * 6) * 0.03);
      m.deflect.visible = f.deflectT > 0 && f.alive; if (f.deflectT > 0) { m.deflect.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); m.deflect.scale.setScalar(1 + (0.3 - f.deflectT) * 2); m.deflect.material.opacity = f.deflectT / 0.3; }
      // aim arrow
      const showAim = f.charging && !f.isBot && f.alive; m.aim.visible = showAim;
      if (showAim) {
        // t404u: preview the actual curved out-and-back route (same sim as flight), original dots styling
        const c = Math.min(1, f.chargeT / 0.7); const explicit = Math.hypot(f.lastAim[0], f.lastAim[1]) > 0.2;
        const base = explicit ? Math.atan2(f.lastAim[0], f.lastAim[1]) : f.face; const ang = this.pickAim(f, base, explicit);
        const pts = this.predictBoomPath(f, ang, c, m.aimDots.length); const cf = Math.cos(f.vface), sf = Math.sin(f.vface);
        m.aim.rotation.y = 0; const col = c > 0.95 ? 0xff7a3a : 0xffffff;
        m.aimDots.forEach((d, i) => {
          const [px, pz] = pts[i] || pts[pts.length - 1]; const dx = px - f.x, dz = pz - f.z;
          const lx = dx * cf - dz * sf, lz = dx * sf + dz * cf; d.position.set(lx, 0.06, lz);
          const u = i / Math.max(1, m.aimDots.length - 1); d.scale.setScalar(0.55 + u * 0.55); d.material.color.setHex(col);
          d.material.opacity = 0.35 + 0.5 * (1 - Math.abs(u - 0.45)); // faint mid-return, clearer outbound
        });
        { const [px, pz] = pts[pts.length - 1]; const dx = px - f.x, dz = pz - f.z; m.aimTip.position.set(dx * cf - dz * sf, 0.06, dx * sf + dz * cf); m.aimTip.material.color.setHex(col); }
      }
      if (f.frozenT > 0 && f.alive) { if (!m.ice) { m.ice = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.3), new THREE.MeshBasicMaterial({ color: 0xaee8ff, transparent: true, opacity: 0.5, depthWrite: false })); m.ice.position.y = 0.75; m.root.add(m.ice); } m.ice.visible = true; m.ice.scale.setScalar(1 + Math.sin(t * 8) * 0.01); } else if (m.ice) m.ice.visible = false;
      m.ring.material.opacity = f.alive ? 0.95 : 0.2;
      m.blob.visible = f.alive && !gfx.sun.castShadow;
    }
    for (const b of this.booms) b.vis(dt);
    for (const p of this.powerups) { p.mesh.position.y = 0.05 + Math.sin(p.t * 3) * 0.06; p.mesh.userData.sp.scale.setScalar(0.68 + Math.sin(p.t * 6) * 0.03); }
    stealthVis(this); this.traps.vis(dt); if (this.vis2) this.vis2(); if (this.poisonView) this.poisonView.update(dt); this.view.update(dt, this.time, this);
  }
}
installRules(Game, { Boom, Fighter }); installRules2(Game);
export { Boom, Fighter };
