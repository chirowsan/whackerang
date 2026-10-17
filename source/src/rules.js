// Mode rules, ultimates, respawn, bomb tag, KOTH, survival waves and boss logic. Mixed into Game.
import { THREE, gfx, glowMat, toon, shake, pulseFov, punch } from './gfx.js';
import { AW, AH, HX, HZ, cx, cz, ci, cj, idx, inb, clamp, pick, rr, shuffle, arenaScale } from './util.js';
import { HEROES, PLAYER_COLORS, PERSONAS, BOOM_TYPES, ULTS, POWERUPS } from './data.js';
import { spawns, T } from './arena.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { Marker } from './events.js';

const ENEMY_RED = 0xff5a5a;
const TYPES = ['razor', 'frost', 'chain', 'boom', 'phantom'];

export function installRules(Game, { Boom, Fighter }) {
  const P = Game.prototype;

  P.initRules = function () {
    const r = this.rules; this.mst = { type: r.type, scores: {}, wave: 0, enemies: 0 }; this.bossMk = null;
    if (r.type === 'koth') { this.mst.scores = {}; this.mst.target = r.kothTarget || 100; this.zone = { mk: new Marker(this.scene, 0xffffff, 2.3, 0.2), x: 0, z: 0, t: 0, n: 0, owner: -1, contested: false }; this.moveZone(true); }
    if (r.type === 'bomb') { this.mst.holder = null; this.mst.fuse = 12; this.mst.fuseMax = 12; const m = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), toon(0x1c1c28)); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), toon(0x888899)); cap.position.y = 0.36; const spark = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc040 })); spark.position.set(0.1, 0.55, 0); m.add(body, cap, spark); m.userData = { body, spark }; m.visible = false; this.scene.add(m); this.bombMesh = m; this.bombMk = new Marker(this.scene, 0xff4040, 1.1, 0.25); this.bombMk.g.visible = false; }
    if (r.type === 'survival') { this.mst.wave = 0; this.mst.waveDelay = 2.5; this.mst.kills = 0; this.mst.starting = true; }
    this.slam = []; this.mst.bossSpawned = false;
    if (r.type === 'ctf' || r.type === 'coins' || r.type === 'ball' || r.type === 'bossrush' || r.crumble) this.initMode2();
  };
  P.disposeRules = function () { if (this.zone) this.zone.mk.dispose(); if (this.bombMesh) { this.scene.remove(this.bombMesh); this.bombMk.dispose(); } for (const s of this.slam || []) s.mk.dispose(); if (this.slamMk) this.slamMk.dispose(); if (this.disposeMode2) this.disposeMode2(); };
  P.onRulesGo = function () { if (this.rules.type === 'bomb') this.passBomb(null, pick(this.fighters.filter((f) => f.alive))); };
  P.respawnDelay = function (f) { return this.rules.type === 'survival' || this.rules.type === 'bossrush' ? 1.8 : this.rules.type === 'ball' ? 1.6 : 2.2; };

  P.respawn = function (f) {
    if (this.state !== 'play') { f.respawnT = 0.5; return; }
    const foes = this.fighters.filter((o) => o.alive && o.team !== f.team); let best = null, bd = -1;
    const [sk, sz] = arenaScale(); const spots = [...spawns().map(([i, j]) => [cx(i), cz(j)]), [0, 0], [-6 * sk, 0], [6 * sk, 0]];
    for (const [x, z] of spots) { const k = idx(ci(x), cj(z)); if (this.hole[k] !== 0 || this.layout.t[k] === T.LAVA || this.layout.t[k] === T.SPIKE || this.sol[k]) continue; const d = foes.length ? Math.min(...foes.map((o) => Math.hypot(o.x - x, o.z - z))) : 5 + Math.random(); if (d > bd) { bd = d; best = [x, z]; } }
    const sp2 = this.respawnSpot2 ? this.respawnSpot2(f) : null; if (sp2) best = sp2;
    best = best || [f.spawn[0], f.spawn[1]]; f.x = best[0]; f.z = best[1]; f.vx = f.vz = 0; f.alive = true; f.deadT = 0; f.air = 0; f.hp = f.maxHp; f.inv = 2.2; f.spawnT = 0; f.ammo = f.maxAmmo; f.charging = false; f.shield = false; f.frozenT = 0; f.stunT = 0; f.deathKind = '';
    const m = f.model; m.body.rotation.set(0, 0, 0); m.root.scale.setScalar(f.bs); m.root.position.set(f.x, 0, f.z); f.ult = Math.min(f.ult, 40);
    sfx('spawn'); fx.ring(f.x, 0.1, f.z, f.color, 2.8, 0.5); fx.sparks(f.x, 0.8, f.z, 16, [f.color, 0xffffff], { speed: 4, life: 0.6 });
    this.onEvent('respawn', { f });
  };

  // ---------------- ultimates
  P.gainUlt = function (f, n) { if (!f || f.boss || f.ultT > 0) return; const was = f.ult >= 100; f.ult = Math.min(100, f.ult + n); if (!was && f.ult >= 100) { this.onEvent('ultReady', { f }); if (!f.isBot) sfx('ultready'); } };
  P.useUlt = function (f) {
    const id = f.hero.id; f.ult = 0; f.ultKind = id; sfx('ult'); shake(0.35); pulseFov(0.5); fx.shockwave(f.x, f.z, f.color, 5); fx.flash('#ffffff', 0.2, 200); fx.popup(ULTS[id].name.toUpperCase() + '!', f.x, f.z, 'pop-ult', 2.0);
    const shoot = (ang, o) => this.booms.push(new Boom(this, f, f.x + Math.sin(ang) * 0.7, f.z + Math.cos(ang) * 0.7, ang, 0.8, { carry: 0, type: f.type, ...o }));
    if (id === 'bao') { for (let i = 0; i < 8; i++) shoot(i * Math.PI / 4 + f.face); f.ultT = 0.01; }
    else if (id === 'nori') { f.ultT = 3; f.inv = 3; f.dashCd = 0; fx.sparks(f.x, 0.6, f.z, 20, [0x222233, f.color], { speed: 5 }); }
    else if (id === 'tako') { f.ultT = 6; f._mx = f.maxAmmo; f.maxAmmo += 2; f.ammo = f.maxAmmo; f.pu.homing = 6; }
    else if (id === 'kuma') { const t = this.nearestEnemy(f, f.x, f.z, 99); const base = t ? Math.atan2(t.x - f.x, t.z - f.z) : f.face; for (const d of [-0.28, 0, 0.28]) shoot(base + d, { fire: true }); f.ultT = 0.01; }
    else if (id === 'pico') { f.shield = true; if (f.lives > 1) f.lives++; f.pu.speed = 6; f.ultT = 0.01; fx.sparks(f.x, 0.8, f.z, 20, [0x6fffb0, 0xffffff], { speed: 4 }); }
    else if (id === 'yuki') { for (const o of this.fighters) if (o.alive && o.team !== f.team && Math.hypot(o.x - f.x, o.z - f.z) < 8) { o.freezeFor(o.boss ? 1.0 : 2.4); } f.ultT = 0.01; fx.ring(f.x, 0.3, f.z, 0x9ff0ff, 9, 0.7); for (let i = 0; i < 30; i++) fx.glow.spawn(f.x, 0.3, f.z, Math.cos(i) * 8, 1, Math.sin(i) * 8, 0.12, 0.7, 0xcff4ff, 0, 1.5); }
    else if (id === 'gus') { f.shield = true; f.ultT = 0.01; fx.ring(f.x, 0.2, f.z, 0xffc23a, 10, 0.55); fx.sparks(f.x, 0.4, f.z, 28, [0xffd870, 0xffffff], { speed: 7 }); for (const o of this.fighters) { if (!o.alive || o.team === f.team) continue; const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz); if (d < 5.5) { o.stunT = o.boss ? 0.5 : 1.3; o.charging = false; o.chargeT = 0; const l = d || 1; o.vx = dx / l * 9; o.vz = dz / l * 9; fx.sparks(o.x, 0.7, o.z, 8, [0xffd870, 0xffffff], { speed: 4 }); } } }
    else if (id === 'wisp') { f.pu.magnet = 6; f.pu.slow = 6; f.ultT = 0.01; fx.ring(f.x, 0.3, f.z, 0x6ff0ff, 7, 0.6); fx.sparks(f.x, 0.8, f.z, 24, [0x6ff0ff, 0xffffff], { speed: 4 }); }
    this.onEvent('ult', { f });
  };
  P.endUlt = function (f) { if (f.ultKind === 'tako' && f._mx) { f.maxAmmo = f._mx; f.ammo = Math.min(f.ammo, f.maxAmmo); f._mx = 0; } f.ultKind = ''; f.ultT = 0; };

  // ---------------- hurt (multi-hp fighters)
  P.onHurt = function (f, killer, kind) {
    sfx('hit'); fx.sparks(f.x, 0.8, f.z, 16, [0xffffff, f.color], { speed: 6, life: 0.5 }); fx.shockwave(f.x, f.z, 0xffffff, 3.4); shake(0.4); punch(f.x - (killer ? killer.x : f.x), f.z - (killer ? killer.z : f.z), 0.4); this.hitstop = 0.1; fx.flash('#ffffff', 0.25, 150);
    fx.popup(f.boss ? 'HIT! ' + f.hp + ' LEFT' : 'OUCH!', f.x, f.z, 'pop-hit'); this.onEvent('hurt', { f, killer });
    if (f.boss && !f.rage && f.hp <= f.maxHp / 2) { f.rage = true; f.slamCd = Math.min(f.slamCd, 1.5); fx.popup('ENRAGED!', f.x, f.z, 'pop-hit', 2.3); this.spawnMinions(f, 2); this.onEvent('rage', { f }); }
  };
  P.spawnMinions = function (boss, n) { const hs = shuffle(HEROES.slice()); for (let i = 0; i < n; i++) this.spawnEnemy({ hero: hs[i % hs.length], diff: 1, team: boss.team, color: boss.color, lives: 1, type: pick(['classic', 'razor', 'chain']) }); };

  // ---------------- enemies (survival / boss minions)
  P.spawnEnemy = function (d) {
    const humans = this.fighters.filter((f) => f.team === 0 && f.alive); let best = null, bd = -1;
    const [sk, sz] = arenaScale(); const spots = [...spawns().map(([i, j]) => [cx(i), cz(j)]), [0, -4.5 * sz], [0, 4.5 * sz], [-8 * sk, 0], [8 * sk, 0]];
    for (const [x, z] of shuffle(spots)) { const k = idx(ci(x), cj(z)); if (this.hole[k] !== 0 || this.sol[k] || this.layout.t[k] !== T.FLOOR) continue; const dd = humans.length ? Math.min(...humans.map((o) => Math.hypot(o.x - x, o.z - z))) : 6; if (dd > bd) { bd = dd; best = [x, z]; } }
    best = best || [0, 0]; const hero = d.hero || pick(HEROES);
    const def = { ctrl: 'bot', hero, name: d.name || hero.name, persona: d.persona || PERSONAS[hero.id], slot: -1, ...d };
    const f = new Fighter(this, def, 4 + this.fighters.length, best); f.inv = 1.2; this.fighters.push(f); f.spawnT = 0;
    sfx('spawn'); fx.ring(best[0], 0.1, best[1], f.color, 3, 0.5); fx.sparks(best[0], 0.8, best[1], 14, [f.color, 0xffffff], { speed: 4 }); return f;
  };
  P.reapDead = function () {
    for (let i = this.fighters.length - 1; i >= 0; i--) { const f = this.fighters[i]; if (!f.alive && f.respawnT <= 0 && f.lives <= 0 && f.def.ctrl === 'bot' && f.def.slot === -1 && f.deadT > 2.4) { this.scene.remove(f.model.root); this.fighters.splice(i, 1); } }
  };
  P.spawnWave = function () {
    const w = ++this.mst.wave; const n = Math.min(6, 1 + Math.ceil(w * 0.7)); const diff = w < 3 ? 0 : w < 7 ? 1 : 2; const hs = shuffle(HEROES.slice());
    for (let i = 0; i < n; i++) { const elite = w % 5 === 0 && i === 0; this.spawnEnemy({ hero: hs[i % hs.length], diff, team: 1, color: elite ? 0xff9a2e : ENEMY_RED, lives: 1, hp: elite ? 2 : 1, scale: elite ? 1.3 : 1, type: w >= 3 && Math.random() < 0.35 + w * 0.03 ? pick(TYPES) : 'classic', name: elite ? 'ELITE' : undefined }); }
    this.onEvent('wave', { n: w }); if (this.powerups.length < 3) this.spawnPowerup();
  };

  // ---------------- King of the Hill
  P.moveZone = function (first) {
    const z = this.zone, cands = first ? [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]] : shuffle([[-6, 0], [6, 0], [0, -3], [0, 3], [-5, -3], [5, 3], [-5, 3], [5, -3], [0, 0]]); let pos = null;
    for (const c of cands) { if (!first && Math.hypot(c[0] - z.x, c[1] - z.z) < 3) continue; let bad = false; for (let j = cj(c[1] - 1.8); j <= cj(c[1] + 1.8) && !bad; j++) for (let i = ci(c[0] - 1.8); i <= ci(c[0] + 1.8); i++) { const t = this.layout.t[idx(i, j)]; if (t === T.LAVA || t === T.PILLAR || t === T.SPIKE) { bad = true; break; } } if (!bad) { pos = c; break; } }
    pos = pos || [0, 0]; z.x = pos[0]; z.z = pos[1]; z.mk.set(pos[0], pos[1]); z.t = 0; if (!first) { sfx('zone'); fx.ring(pos[0], 0.1, pos[1], 0xffffff, 5, 0.6); this.onEvent('zoneMove'); }
  };

  // ---------------- Bomb Tag
  P.passBomb = function (from, to) {
    const m = this.mst; if (!to) return; m.holder = to; if (from) from.hasBomb = false; to.hasBomb = true; to.tagImmune = 1.2; if (from) from.tagImmune = 1.2; to.stunT = 0;
    sfx('tag'); fx.shockwave(to.x, to.z, 0xff4040, 3.2); fx.sparks(to.x, 1.2, to.z, 14, [0xff4040, 0xffc040], { speed: 5 }); shake(0.2); fx.popup('YOU HAVE THE BOMB!'.replace('YOU HAVE THE BOMB!', to.isBot ? to.name + ' HAS IT!' : 'YOU HAVE IT!'), to.x, to.z, 'pop-hit', 2.0);
    this.onEvent('bomb', { f: to, from });
  };
  P.bombHit = function (b, f) {
    const m = this.mst, own = b.owner; fx.sparks(f.x, 0.7, f.z, 10, [0xffffff, own.color], { speed: 5, life: 0.4 }); sfx('hit');
    if (own === m.holder && f.tagImmune <= 0) { this.passBomb(own, f); this.hitstop = 0.08; }
    else if (own !== m.holder) { f.stunT = Math.max(f.stunT, f === m.holder ? 1.2 : 0.7); fx.popup('STUN!', f.x, f.z, 'pop-cyan'); }
  };
  P.explodeBomb = function () {
    const m = this.mst, h = m.holder; if (!h) return; this.explode(h.x, h.z, null, 2.6); h.hasBomb = false; m.holder = null; if (h.alive) { h.lives = 0; h.die(null, 'bomb', 0, -1); } fx.popup('KABOOM!', h.x, h.z, 'pop-hit', 2.0);
    const alive = this.fighters.filter((f) => f.alive); if (alive.length >= 2) { m.fuseMax = 6 + alive.length * 1.6; m.fuse = m.fuseMax; this.passBomb(null, pick(alive)); }
  };

  // ---------------- per-frame
  P.updateRules = function (dt) {
    const r = this.rules, m = this.mst; this.reapDead();
    // bosses: slam attack
    for (const f of this.fighters) {
      if (!f.boss || !f.alive) continue; f.slamCd = (f.slamCd === undefined ? 4 : f.slamCd) - dt;
      if (f.slamCd <= 0 && f.stunT <= 0 && f.frozenT <= 0) { f.slamCd = f.rage ? 4.5 : 6.5; f.slamT = 1.1; f.stunT = 1.1; if (!this.slamMk) this.slamMk = new Marker(this.scene, 0xff3030, 3.4, 0.3); this.slamMk.set(f.x, f.z); this.slamMk.g.visible = true; sfx('meteorwarn'); }
      if (f.slamT > 0) { f.slamT -= dt; this.slamMk.pulse(this.time, 0.25, 16); this.slamMk.set(f.x, f.z); if (f.slamT <= 0) { this.slamMk.g.visible = false; this.bossSlam(f); } }
    }
    // survival
    if (r.type === 'survival') {
      const foes = this.fighters.filter((f) => f.team === 1 && (f.alive || f.respawnT > 0)).length; m.enemies = foes;
      if (foes === 0 && r.waves && m.wave >= r.waves) { this.finish(0, null); return; }
      if (foes === 0) { m.waveDelay -= dt; if (m.waveDelay <= 0 && !m.pendingEnd) { this.spawnWave(); m.waveDelay = 3.2; } }
      else m.waveDelay = 3.2;
    }
    if (this.updateMode2) this.updateMode2(dt);
    // KOTH
    if (r.type === 'koth') this.updateKoth(dt);
    // bomb
    if (r.type === 'bomb') this.updateBomb(dt);
    this.checkEnd();
  };
  P.bossSlam = function (b) {
    const R = 3.4; sfx('explode'); shake(0.7); fx.flash('#ffffff', 0.25, 200); fx.shockwave(b.x, b.z, 0xff6a3a, R * 2.3); fx.sparks(b.x, 0.4, b.z, 36, [0xffd060, 0xff7a20], { speed: 9, up: 3 }); fx.scorch(b.x, b.z, R * 1.3, 0x000000, 0.5, 10); fx.burst(b.x, 0.3, b.z, 14, [0x888899, 0xaaaabb], { speed: 6, up: 3, size: 0.2 });
    for (const f of this.fighters) { if (!f.alive || f.team === b.team || f.inv > 0 || f.dashT > 0 || Math.hypot(f.x - b.x, f.z - b.z) > R) continue; if (f.shield) { f.shield = false; f.inv = 0.8; sfx('shieldpop'); continue; } f.die(b, 'slam', f.x - b.x, f.z - b.z); }
  };
  P.updateKoth = function (dt) {
    const z = this.zone, m = this.mst; z.t += dt; if (z.t > (this.rules.zoneMove || 22)) this.moveZone(false);
    const counts = {}; for (const f of this.fighters) if (f.alive && Math.hypot(f.x - z.x, f.z - z.z) < 2.3) counts[f.team] = (counts[f.team] || 0) + 1;
    const teams = Object.keys(counts); z.contested = teams.length > 1; z.owner = teams.length === 1 ? +teams[0] : -1;
    if (z.owner >= 0) { const was = m.scores[z.owner] || 0; m.scores[z.owner] = was + dt * (this.rules.kothRate || 4) * (this.rules.teams ? 1 : 1); if (Math.floor(m.scores[z.owner] / 25) !== Math.floor(was / 25)) sfx('zonepoint'); }
    const col = z.contested ? 0xff9a2e : z.owner >= 0 ? this.teamColor(z.owner) : 0xffffff; z.mk.color(col); z.mk.pulse(this.time, z.owner >= 0 ? 0.18 : 0.08, z.contested ? 14 : 5);
    if (z.t > (this.rules.zoneMove || 22) - 3) z.mk.edge.material.opacity = 0.3 + 0.7 * (Math.sin(this.time * 20) > 0 ? 1 : 0);
    const best = Object.entries(m.scores).sort((a, b) => b[1] - a[1])[0];
    if ((best && best[1] >= m.target) || (this.playTime > (this.rules.timeLimit || 170) && best)) { this.finish(+best[0], null); }
  };
  P.teamColor = function (team) { const f = this.fighters.find((o) => o.team === team); return f ? f.color : 0xffffff; };
  P.updateBomb = function (dt) {
    const m = this.mst, h = m.holder, mesh = this.bombMesh; if (!h || !h.alive) { mesh.visible = false; this.bombMk.g.visible = false; if (!h && this.state === 'play' && this.fighters.filter((f) => f.alive).length >= 2 && this.playTime > 0.5) { this.passBomb(null, pick(this.fighters.filter((f) => f.alive))); m.fuse = m.fuseMax; } else if (h && !h.alive) { m.holder = null; } return; }
    m.fuse -= dt; const k = clamp(m.fuse / m.fuseMax, 0, 1);
    mesh.visible = true; mesh.position.set(h.x, 2.05 * h.bs + Math.sin(this.time * 8) * 0.06, h.z); const pulse = m.fuse < 4 ? (Math.sin(this.time * (8 + (4 - m.fuse) * 5)) > 0 ? 1 : 0) : 0; mesh.userData.body.material.emissive = mesh.userData.body.material.emissive || new THREE.Color(); mesh.userData.body.material.emissive.setRGB(pulse * 0.9, 0, 0); mesh.scale.setScalar(1 + pulse * 0.2 + (1 - k) * 0.15);
    this.bombMk.g.visible = true; this.bombMk.set(h.x, h.z); this.bombMk.pulse(this.time, 0.2, 6 + (1 - k) * 18);
    if (Math.random() < 0.7) fx.glow.spawn(h.x + 0.1, 2.5 * h.bs, h.z, (Math.random() - 0.5), 1.4, (Math.random() - 0.5), 0.08, 0.35, 0xffc040);
    if (Math.floor(m.fuse * 2) !== Math.floor((m.fuse + dt) * 2) && m.fuse < 4) sfx('tick');
    if (m.fuse <= 0) this.explodeBomb();
  };

  // ---------------- end conditions
  P.finish = function (winTeam, winner) {
    if (this.state !== 'play') return; this.state = 'roundEnd'; this.endT = 0; this.winTeam = winTeam; this.winner = winner || this.fighters.find((f) => f.team === winTeam && f.alive) || null; this.slowT = this.mode === 'attract' ? 0 : 1.5;
    this.onEvent('lastKO', { winner: this.winner, winTeam, draw: winTeam < 0 });
  };
  P.checkEnd = function () {
    if (this.state !== 'play') return; const r = this.rules;
    if (r.type === 'koth' || r.type === 'ctf' || r.type === 'coins' || r.type === 'ball' || r.type === 'bossrush') return; // handled by their own update
    const live = this.fighters.filter((f) => f.alive || f.respawnT > 0);
    if (r.type === 'survival') { if (!live.some((f) => f.team === 0)) { this.mst.lost = true; this.finish(1, null); } return; }
    const teams = new Set(live.map((f) => f.team));
    if (teams.size <= 1 && this.fighters.length > 1) { const t = teams.size ? [...teams][0] : -1; this.finish(t, null); }
  };
  // snapshot for HUD / results
  P.mstate = function () {
    const m = this.mst, r = this.rules, o = { type: r.type };
    if (r.type === 'koth') { o.scores = m.scores; o.target = m.target; o.owner = this.zone.owner; o.contested = this.zone.contested; o.zoneIn = Math.max(0, (r.zoneMove || 22) - this.zone.t); }
    if (r.type === 'bomb') { o.holder = m.holder; o.fuse = Math.max(0, m.fuse || 0); o.fuseMax = m.fuseMax; }
    if (r.type === 'survival') { o.wave = m.wave; o.left = m.enemies; }
    Object.assign(o, this.mstate2());
    const boss = this.fighters.find((f) => f.boss); if (boss) { o.boss = { hp: boss.alive ? boss.hp : 0, max: boss.maxHp, name: boss.name }; }
    return o;
  };
}
