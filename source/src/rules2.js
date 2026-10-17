// v3 modes: Capture the Flag, Coin Rush, Boomerang Ball, Crumbling Floor, Boss Rush. Mixed into Game.
import { THREE, gfx, toon, glowMat, shake } from './gfx.js';
import { AW, AH, HX, HZ, cx, cz, ci, cj, idx, inb, clamp, pick, rr, shuffle, arenaScale } from './util.js';
import { HEROES, PERSONAS } from './data.js';
import { T } from './arena.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { Marker } from './events.js';

export const MODE2 = ['ctf', 'coins', 'ball', 'bossrush'];
export const BOSSES = [
  { h: 'yuki', name: 'Shogun Yuki-Zero', hp: 5, scale: 1.7, type: 'frost', color: 0x6ad8ff },
  { h: 'kuma', name: 'Kuma the Crusher', hp: 6, scale: 1.8, type: 'boom', color: 0xff8a3a },
  { h: 'nori', name: 'Nori Nightblade', hp: 7, scale: 1.7, type: 'phantom', color: 0xa07aff },
];
const GEO = { cyl: new THREE.CylinderGeometry(1, 1, 1, 12), box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 16, 12), ico: new THREE.IcosahedronGeometry(1, 1) };

export function installRules2(Game) {
  const P = Game.prototype;
  const freeCell = (g, i, j) => inb(i, j) && !g.sol[idx(i, j)] && g.layout.t[idx(i, j)] === T.FLOOR && g.hole[idx(i, j)] === 0;
  const freeAt = (g, x0, z0) => { for (let d = 0; d < 6; d++) for (const s of d ? [1, -1] : [1]) { const z = z0 + s * d; if (freeCell(g, ci(x0), cj(z))) return [x0, z]; } return [x0, z0]; };

  P.initMode2 = function () {
    const r = this.rules, m = this.m2 = { t: 0, scores: {}, target: 0 };
    if (r.type === 'ctf') {
      m.target = r.ctfTarget || 3; m.limit = r.timeLimit || 160; m.flags = [];
      [0, 1].forEach((team) => {
        const [bx, bz] = freeAt(this, (team ? 1 : -1) * (HX - 2.5), 0); const col = this.teamColor(team); const g = new THREE.Group(); g.position.set(bx, 0, bz); this.scene.add(g);
        const pole = new THREE.Mesh(GEO.cyl, toon(0xe8e8f0)); pole.scale.set(0.06, 2.2, 0.06); pole.position.y = 1.1; const cloth = new THREE.Mesh(GEO.box, glowMat(col, 0.55)); cloth.scale.set(0.95, 0.6, 0.05); cloth.position.set(0.5, 1.9, 0); g.add(pole, cloth);
        const mk = new Marker(this.scene, col, 1.5, 0.18); mk.set(bx, bz); m.flags.push({ team, home: [bx, bz], x: bx, z: bz, carrier: null, dropT: 0, g, cloth, mk, atHome: true }); m.scores[team] = 0;
      });
    } else if (r.type === 'coins') {
      m.coins = []; m.target = r.coinTarget || 40; m.limit = r.timeLimit || 100; m.spawnT = 0.2; this.fighters.forEach((f) => { f.score = 0; }); m.max = Math.round(12 * (AW * AH) / 240 + 6);
      m.cm = toon(0xffc83a); m.gm = glowMat(0x5ad8ff, 0.8);
    } else if (r.type === 'ball') {
      m.target = r.ballTarget || 3; m.limit = r.timeLimit || 130; m.scores = { 0: 0, 1: 0 }; const [, sz] = arenaScale(); m.gh = 2.6 * sz; m.goalT = 0;
      const ball = new THREE.Group(); const b = new THREE.Mesh(GEO.sph, toon(0xffffff)); b.scale.setScalar(0.62); const pat = new THREE.Mesh(GEO.ico, toon(0x2a2a3a)); pat.scale.setScalar(0.64); pat.material.wireframe = true; ball.add(b, pat); this.scene.add(ball);
      m.ball = { x: 0, z: 0, vx: 0, vz: 0, g: ball, spin: pat, hide: 0 }; m.goals = [];
      [0, 1].forEach((team) => { const side = team ? 1 : -1; const col = this.teamColor(team); const gx = side * (HX - 0.15); const g = new THREE.Group(); g.position.set(gx, 0, 0); this.scene.add(g);
        const pm = toon(0xf0f0f8); [-1, 1].forEach((s) => { const p = new THREE.Mesh(GEO.cyl, pm); p.scale.set(0.14, 1.5, 0.14); p.position.set(0, 0.75, s * m.gh); g.add(p); }); const bar = new THREE.Mesh(GEO.box, pm); bar.scale.set(0.14, 0.14, m.gh * 2); bar.position.y = 1.5; g.add(bar);
        const pad = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false })); pad.scale.set(1.6, 0.02, m.gh * 2); pad.position.set(-side * 0.8, 0.03, 0); g.add(pad); m.goals.push({ team, g, pad }); });
    } else if (r.type === 'bossrush') { m.n = 0; m.delay = 2.0; m.total = BOSSES.length; m.done = false; }
    if (r.crumble) { m.cT = 5; m.tiles = 0; for (let k = 0; k < AW * AH; k++) if (this.layout.t[k] !== T.LAVA) m.tiles++; }
  };
  P.disposeMode2 = function () {
    const m = this.m2; if (!m) return;
    (m.flags || []).forEach((f) => { this.scene.remove(f.g); f.mk.dispose(); }); (m.coins || []).forEach((c) => this.scene.remove(c.mesh));
    if (m.ball) this.scene.remove(m.ball.g); (m.goals || []).forEach((g) => this.scene.remove(g.g));
  };
  P.respawnSpot2 = function (f) {
    const r = this.rules; if (r.type === 'ctf') { const fl = this.m2.flags[f.team ? 1 : 0]; return freeAt(this, fl.home[0] + (f.team ? -1.6 : 1.6), fl.home[1] + rr(-2, 2)); }
    if (r.type === 'ball') return freeAt(this, (f.team ? 1 : -1) * rr(3, HX * 0.6), rr(-HZ * 0.5, HZ * 0.5));
    return null;
  };
  // ---- per frame
  P.updateMode2 = function (dt) {
    const r = this.rules, m = this.m2; if (!m) return; m.t += dt;
    if (r.crumble) this.updateCrumble(dt);
    if (r.type === 'ctf') this.updateCtf(dt); else if (r.type === 'coins') this.updateCoins(dt); else if (r.type === 'ball') this.updateBall(dt); else if (r.type === 'bossrush') this.updateRush(dt);
  };
  P.updateCrumble = function (dt) {
    const m = this.m2; m.cT -= dt; if (m.cT > 0 || this.state !== 'play') return; m.cT = Math.max(0.28, 1.5 - this.playTime * 0.017);
    const alive = this.fighters.filter((f) => f.alive); const pickCell = () => {
      for (let n = 0; n < 40; n++) { let i, j; if (alive.length && Math.random() < 0.55) { const f = pick(alive); i = ci(f.x + rr(-3, 3)); j = cj(f.z + rr(-3, 3)); } else { i = Math.floor(Math.random() * AW); j = Math.floor(Math.random() * AH); } if (inb(i, j) && this.hole[idx(i, j)] === 0 && this.layout.t[idx(i, j)] !== T.LAVA) return [i, j]; } return null; };
    const c = pickCell(); if (!c) return; const sz = this.playTime > 40 ? 2 : Math.random() < 0.4 ? 2 : 1;
    for (let a = 0; a < sz; a++) for (let b = 0; b < sz; b++) { const i = c[0] + a, j = c[1] + b; if (inb(i, j) && this.hole[idx(i, j)] === 0 && this.layout.t[idx(i, j)] !== T.LAVA) { this.hole[idx(i, j)] = 1.15 - Math.min(0.5, this.playTime * 0.006); m.tiles--; } }
    sfx('warn');
  };
  P.flagPos = function (fl) { return fl.carrier && fl.carrier.alive ? [fl.carrier.x, fl.carrier.z] : [fl.x, fl.z]; };
  P.updateCtf = function (dt) {
    const m = this.m2;
    for (const fl of m.flags) {
      if (fl.carrier && !fl.carrier.alive) { fl.x = fl.carrier.x; fl.z = fl.carrier.z; const c = fl.carrier; c.carry = null; fl.carrier = null; fl.dropT = 0; fl.atHome = false; }
      if (!fl.carrier && !fl.atHome) { fl.dropT += dt; if (fl.dropT > 12) this.flagHome(fl, true); }
      for (const f of this.fighters) {
        if (!f.alive || f.boss || f.show || fl.carrier) continue; if (Math.hypot(f.x - fl.x, f.z - fl.z) > 0.95) continue;
        if (f.team !== fl.team && !f.carry) { fl.carrier = f; f.carry = fl; fl.atHome = false; sfx('zone'); fx.popup('FLAG TAKEN!', f.x, f.z, 'pop-pu', 2); fx.ring(f.x, 0.2, f.z, this.teamColor(fl.team), 3, 0.4); this.onEvent('flagTaken', { f }); }
        else if (f.team === fl.team && !fl.atHome) { this.flagHome(fl, false); fx.popup('FLAG RETURNED!', f.x, f.z, 'pop-cyan', 2); }
      }
    }
    for (const fl of m.flags) {
      const c = fl.carrier; if (!c) continue; const own = m.flags[c.team ? 1 : 0];
      if (own.atHome && Math.hypot(c.x - own.home[0], c.z - own.home[1]) < 1.6) {
        m.scores[c.team]++; c.carry = null; fl.carrier = null; this.flagHome(fl, false, true); sfx('win'); fx.confetti(c.x, c.z, 40); fx.popup('CAPTURE!', c.x, c.z, 'pop-hit', 2.4); shake(0.3); this.onEvent('capture', { f: c });
        if (m.scores[c.team] >= m.target) { this.finish(c.team, c); return; }
      }
    }
    if (m.t > m.limit && this.state === 'play') { const a = m.scores[0], b = m.scores[1]; this.finish(a === b ? -1 : a > b ? 0 : 1, null); }
  };
  P.flagHome = function (fl, auto, quiet) { fl.carrier && (fl.carrier.carry = null); fl.carrier = null; fl.x = fl.home[0]; fl.z = fl.home[1]; fl.atHome = true; fl.dropT = 0; if (!quiet) sfx('spawn'); };
  P.updateCoins = function (dt) {
    const m = this.m2; m.spawnT -= dt;
    if (m.spawnT <= 0 && m.coins.length < m.max) { m.spawnT = 0.55; for (let n = 0; n < 12; n++) { const i = 1 + Math.floor(Math.random() * (AW - 2)), j = 1 + Math.floor(Math.random() * (AH - 2)); if (freeCell(this, i, j) && this.traps.danger(cx(i), cz(j)) < 5) { this.spawnCoin(cx(i), cz(j), Math.random() < 0.1 ? 5 : 1); break; } } }
    for (let n = m.coins.length - 1; n >= 0; n--) {
      const c = m.coins[n]; c.t += dt; if (c.vx) { c.x += c.vx * dt; c.z += c.vz * dt; c.vx *= 0.92; c.vz *= 0.92; c.x = clamp(c.x, -HX + 0.6, HX - 0.6); c.z = clamp(c.z, -HZ + 0.6, HZ - 0.6); }
      if (c.life) { c.life -= dt; if (c.life < 0) { this.scene.remove(c.mesh); m.coins.splice(n, 1); continue; } }
      for (const f of this.fighters) { if (!f.alive || f.boss || Math.hypot(f.x - c.x, f.z - c.z) > 0.85) continue; f.score += c.v; this.scene.remove(c.mesh); m.coins.splice(n, 1); sfx('pickup'); fx.sparks(c.x, 0.6, c.z, 5, [0xffd23c, 0xffffff], { speed: 3, life: 0.35, size: 0.07 }); if (c.v > 1) fx.popup('+' + c.v, c.x, c.z, 'pop-pu'); if (f.score >= m.target) { this.finish(f.team, f); return; } break; }
    }
    if (m.t > m.limit && this.state === 'play') { const best = this.fighters.slice().sort((a, b) => b.score - a.score); const tie = best.length > 1 && best[0].score === best[1].score; this.finish(tie ? -1 : best[0].team, tie ? null : best[0]); }
  };
  P.spawnCoin = function (x, z, v, vx = 0, vz = 0) {
    const m = this.m2; const mesh = new THREE.Mesh(GEO.cyl, v > 1 ? m.gm : m.cm); mesh.scale.set(v > 1 ? 0.34 : 0.28, 0.07, v > 1 ? 0.34 : 0.28); mesh.rotation.x = Math.PI / 2; mesh.position.set(x, 0.55, z); this.scene.add(mesh); m.coins.push({ x, z, v, mesh, t: Math.random() * 6, vx, vz, life: vx ? 14 : 0 });
  };
  P.updateBall = function (dt) {
    const m = this.m2, b = m.ball; if (b.hide > 0) { b.hide -= dt; if (b.hide <= 0) { b.x = 0; b.z = 0; b.vx = b.vz = 0; b.g.visible = true; sfx('spawn'); fx.ring(0, 0.1, 0, 0xffffff, 3, 0.5); } return this.ballCheckEnd(); }
    b.x += b.vx * dt; b.z += b.vz * dt; const fr = Math.pow(0.4, dt); b.vx *= fr; b.vz *= fr; const R = 0.6;
    const inMouthZ = Math.abs(b.z) < m.gh;
    if (b.z < -HZ + R) { b.z = -HZ + R; b.vz = Math.abs(b.vz) * 0.85; } else if (b.z > HZ - R) { b.z = HZ - R; b.vz = -Math.abs(b.vz) * 0.85; }
    if (b.x < -HX + R && !inMouthZ) { b.x = -HX + R; b.vx = Math.abs(b.vx) * 0.85; } else if (b.x > HX - R && !inMouthZ) { b.x = HX - R; b.vx = -Math.abs(b.vx) * 0.85; }
    if (b.x < -HX + 0.3 && inMouthZ) return this.goal(1); if (b.x > HX - 0.3 && inMouthZ) return this.goal(0);
    for (const f of this.fighters) {
      if (!f.alive || f.show) continue; const dx = b.x - f.x, dz = b.z - f.z, d = Math.hypot(dx, dz), rr2 = R + 0.42 * f.bs; if (d < rr2 && d > 0.001) {
        const nx = dx / d, nz = dz / d; b.x = f.x + nx * rr2; b.z = f.z + nz * rr2; const sp = Math.hypot(f.vx + f.ex, f.vz + f.ez); const k = f.dashT > 0 ? 17 : 3.5 + sp * 1.25; const cur = b.vx * nx + b.vz * nz; if (cur < k) { b.vx += nx * (k - cur); b.vz += nz * (k - cur); } if (f.dashT > 0 || sp > 4) { sfx('bounce'); fx.sparks(b.x, 0.5, b.z, 4, [0xffffff, f.color], { speed: 3, life: 0.25, size: 0.07 }); }
      }
    }
    for (const bm of this.booms) { if (!bm.alive || bm.ballT > 0) continue; if (Math.hypot(bm.x - b.x, bm.z - b.z) < 0.95) { const vx = Math.sin(bm.th), vz = Math.cos(bm.th); b.vx += vx * 13; b.vz += vz * 13; bm.ballT = 1; sfx('hit'); fx.ring(b.x, 0.4, b.z, bm.owner.color, 2, 0.3); shake(0.1); } } for (const bm of this.booms) if (bm.ballT > 0) bm.ballT -= dt;
    const sp = Math.hypot(b.vx, b.vz); if (sp > 20) { b.vx *= 20 / sp; b.vz *= 20 / sp; }
    this.ballCheckEnd();
  };
  P.ballCheckEnd = function () { const m = this.m2; if (m.t > m.limit && this.state === 'play') { const a = m.scores[0], c = m.scores[1]; this.finish(a === c ? -1 : a > c ? 0 : 1, null); } };
  P.goal = function (team) {
    const m = this.m2, b = m.ball; m.scores[team]++; b.hide = 1.8; b.g.visible = false; sfx('win'); shake(0.4); fx.flash('#ffffff', 0.25, 200); fx.confetti(b.x, b.z, 50); fx.shockwave(b.x, b.z, this.teamColor(team), 6); this.onEvent('goal', { team, scores: m.scores });
    if (m.scores[team] >= m.target) this.finish(team, this.fighters.find((f) => f.team === team) || null);
  };
  P.updateRush = function (dt) {
    const m = this.m2; if (this.state !== 'play') return;
    const humans = this.fighters.filter((f) => f.team === 0 && (f.alive || f.respawnT > 0)); if (!humans.length) { this.mst.lost = true; this.finish(1, null); return; }
    const boss = this.fighters.find((f) => f.boss && f.alive);
    if (!boss) {
      if (m.n >= m.total) { if (!m.done) { m.done = true; this.finish(0, humans[0]); } return; }
      m.delay -= dt; if (m.delay <= 0) {
        const b = BOSSES[m.n]; m.n++; m.delay = 3; const hero = HEROES.find((h) => h.id === b.h) || HEROES[0];
        this.spawnEnemy({ hero, name: b.name, diff: 1, persona: 'boss', team: 1, color: b.color, hat: 'none', lives: 1, hp: b.hp, scale: b.scale, boss: true, type: b.type });
        for (const f of this.fighters) if (f.team === 0 && f.alive) { f.inv = Math.max(f.inv, 1.5); f.ammo = f.maxAmmo; } for (const f of this.fighters) if (f.team === 0 && !f.alive && f.lives < 2 && f.def.lives) { f.lives = 2; f.respawnT = 0.6; }
        sfx('rumble'); shake(0.4); this.onEvent('boss', { n: m.n, name: b.name });
      }
    }
  };
  // ---- hooks
  P.modeKO = function (f, killer, kind) {
    const r = this.rules, m = this.m2; if (!m) return;
    if (f.carry) { const fl = f.carry; fl.x = f.x; fl.z = f.z; fl.carrier = null; fl.dropT = 0; fl.atHome = false; f.carry = null; sfx('tag'); fx.popup('FLAG DROPPED', f.x, f.z, 'pop-hit', 1.9); }
    if (r.type === 'coins' && f.score > 0) { const n = Math.min(8, Math.ceil(f.score * 0.4)); f.score -= n; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 4; this.spawnCoin(f.x, f.z, 1, Math.sin(a) * s, Math.cos(a) * s); } }
  };
  P.objective = function (f) {
    const r = this.rules, m = this.m2; if (!m || !f.alive) return null;
    if (r.type === 'ctf') {
      const ef = m.flags[f.team ? 0 : 1], of = m.flags[f.team ? 1 : 0]; const mates = this.fighters.filter((o) => o.team === f.team && o.isBot); const defender = mates.length > 1 && mates.indexOf(f) % 2 === 1 && !f.carry;
      if (f.carry) return { x: of.home[0], z: of.home[1], yield: 1.5, force: true };
      if (!of.atHome && !of.carrier) return { x: of.x, z: of.z, yield: 3 };
      if (ef.carrier && ef.carrier.alive && (defender || Math.hypot(ef.carrier.x - f.x, ef.carrier.z - f.z) < 9)) return { x: ef.carrier.x, z: ef.carrier.z, yield: 99, force: true };
      if (defender) return { x: of.home[0] + (f.team ? -2.5 : 2.5), z: of.home[1], yield: 4.5 };
      return { x: ef.x, z: ef.z, yield: 3.5 };
    }
    if (r.type === 'coins') { let best = null, bd = 1e9; for (const c of m.coins) { const d = Math.hypot(c.x - f.x, c.z - f.z) - (c.v > 1 ? 3 : 0); if (d < bd) { bd = d; best = c; } } return best ? { x: best.x, z: best.z, yield: 2.6 } : null; }
    if (r.type === 'ball') {
      const b = m.ball; if (!b.g.visible) return null; const gx = (f.team ? -1 : 1) * HX, gz = 0; const ux = gx - b.x, uz = gz - b.z, ul = Math.hypot(ux, uz) || 1; const px = b.x - ux / ul * 1.0, pz = b.z - uz / ul * 1.0; const d = Math.hypot(px - f.x, pz - f.z);
      const defend = this.fighters.filter((o) => o.team === f.team && o.isBot).indexOf(f) === 1 && Math.abs(b.x - (f.team ? 1 : -1) * HX) > HX * 0.9; if (defend) return { x: (f.team ? 1 : -1) * (HX - 3.5), z: clamp(b.z * 0.6, -m.gh, m.gh), yield: 99, force: true };
      return d > 0.8 ? { x: px, z: pz, yield: 99, force: true } : { x: b.x, z: b.z, yield: 99, force: true };
    }
    if (r.crumble) { let best = null, bs = -1e9; for (let n = 0; n < 10; n++) { const x = rr(-HX + 2, HX - 2), z = rr(-HZ + 2, HZ - 2); const i = ci(x), j = cj(z); if (!freeCell(this, i, j) || this.traps.danger(x, z) > 4) continue; const edge = Math.min(HX - Math.abs(x), HZ - Math.abs(z)); const s = edge * 0.6 - Math.hypot(x - f.x, z - f.z) * 0.2; if (s > bs) { bs = s; best = [x, z]; } } return best && Math.min(HX - Math.abs(f.x), HZ - Math.abs(f.z)) < 3 ? { x: best[0], z: best[1], yield: 3 } : null; }
    return null;
  };
  P.camFocus = function () {
    const m = this.m2; if (!m) return []; const r = this.rules; if (r.type === 'ball') return m.ball.g.visible ? [[m.ball.x, m.ball.z]] : []; if (r.type === 'bossrush') return this.fighters.filter((f) => f.boss && f.alive).map((f) => [f.x, f.z]);
    return [];
  };
  P.camPoints = function () { const m = this.m2; if (!m) return []; const r = this.rules; if (r.type === 'ctf') return m.flags.map((fl) => { const p = this.flagPos(fl); return [p[0], p[1], '#' + this.teamColor(fl.team).toString(16).padStart(6, '0')]; }); if (r.type === 'ball' && m.ball.g.visible) return [[m.ball.x, m.ball.z, '#ffffff']]; if (r.type === 'coins') return m.coins.filter((c) => c.v > 1).map((c) => [c.x, c.z, '#5ad8ff']); return []; };
  P.mstate2 = function () {
    const m = this.m2, r = this.rules, o = {}; if (!m) return o;
    if (r.type === 'ctf') { o.scores = m.scores; o.target = m.target; o.left = Math.max(0, m.limit - m.t); o.carry = m.flags.map((f) => !!f.carrier); }
    else if (r.type === 'coins') { o.coinRows = this.fighters.slice(0, this.nPlayers).map((f) => ({ name: f.name, color: f.color, score: f.score || 0 })); o.target = m.target; o.left = Math.max(0, m.limit - m.t); }
    else if (r.type === 'ball') { o.scores = m.scores; o.target = m.target; o.left = Math.max(0, m.limit - m.t); }
    else if (r.type === 'bossrush') { o.rush = { n: Math.max(1, m.n), total: m.total }; }
    if (r.crumble) o.floor = Math.max(0, Math.round(m.tiles / (AW * AH) * 100));
    return o;
  };
  // visuals (called each frame)
  P.vis2 = function () {
    const m = this.m2; if (!m) return; const t = this.time;
    if (m.flags) for (const fl of m.flags) { const p = this.flagPos(fl); fl.g.position.set(p[0], fl.carrier && fl.carrier.alive ? 1.55 : 0, p[1]); fl.g.scale.setScalar(fl.carrier ? 0.7 : 1); fl.cloth.rotation.y = Math.sin(t * 6) * 0.25; fl.cloth.scale.y = 0.6 + Math.sin(t * 8) * 0.05; fl.mk.pulse(t, 0.12, 4); if (fl.carrier) fl.mk.set(p[0], p[1]); else fl.mk.set(fl.x, fl.z); }
    if (m.coins) for (const c of m.coins) { c.mesh.position.set(c.x, 0.5 + Math.sin(c.t * 4) * 0.08, c.z); c.mesh.rotation.z = c.t * 4; }
    if (m.ball) { const b = m.ball; b.g.position.set(b.x, 0.62, b.z); const sp = Math.hypot(b.vx, b.vz); b.spin.rotation.x += b.vz * 0.03; b.spin.rotation.z -= b.vx * 0.03; }
  };
}
