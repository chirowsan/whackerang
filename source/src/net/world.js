// Host -> guest world replication: binary snapshots (fast channel), slow-changing state packets, fx/sfx replay, interpolation and
// light client-side prediction for the guest's own fighter. The host runs the one and only real simulation.
import { BinWriter, BinReader, enc, dec } from './bin.js';
import { HEROES, BOOM_TYPES } from '../data.js';
import { AW, AH, HX, HZ, clamp, ci, cj, idx, cx, cz, angDiff } from '../util.js';
import { T } from '../arena.js';
import { fx } from '../fx.js';
import { sfx, sfxTap } from '../audio.js';
import { buildPowerup } from '../models.js';
import { Boom, SPEED } from '../game.js';
import { gfx, shake, THREE } from '../gfx.js';
import { S } from '../save.js';
import { Input } from '../input.js';
import { Marker } from '../events.js';

export const STEP = 1 / 60;
const TAU = Math.PI * 2;
export const PK = { INPUT: 1, SNAP: 2, PING: 3, PONG: 4, CRATES: 5, HOLES: 6, ITEMS: 7, TRAPS: 8 };
const BT = Object.keys(BOOM_TYPES), PUK = ['triple', 'giant', 'fire', 'homing', 'speed', 'magnet', 'slow'];
const DK = ['', 'boom', 'shatter', 'meteor', 'slam', 'fall', 'lava', 'spike', 'fire', 'zap', 'laser', 'saw', 'hammer', 'boulder', 'crush', 'bomb', 'boulder'];
const ULTK = ['', ...HEROES.map((h) => h.id)];
const TRAP_F = ['st', 'forced', 'left', 'timer', 'boost', 'hold', 'a', 'bx', 'py', 'cd'];
const FX_OK = new Set(['flash', 'scorch', 'shockwave', 'confetti', 'burst', 'sparks', 'puff', 'impact', 'catchBurst', 'firework', 'ring', 'popup']);
const SFX_SKIP = new Set(['hurt', 'ultready', 'combo', 'fanfare', 'win', 'lose', 'click', 'back', 'beep', 'go', 'round', 'deny', 'missionDone', 'koStinger', 'slowmo']);
const normA = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };
const lerpA = (a, b, t) => a + angDiff(a, b) * t;

// ================================================================ HOST: recorder for visual effects (fx.* and sfx calls) so guests replay them
export class FxRecorder {
  constructor() { this.buf = []; this.depth = 0; this.orig = {}; this.on = false; }
  start() {
    if (this.on) return; this.on = true; const self = this;
    for (const k of FX_OK) { const o = fx[k]; if (typeof o !== 'function') continue; this.orig[k] = o; fx[k] = function (...a) { if (self.depth === 0 && self.buf.length < 60) self.buf.push([k, a]); self.depth++; try { return o.apply(this, a); } finally { self.depth--; } }; }
    sfxTap.fn = (n, p) => { if (!SFX_SKIP.has(n) && this.buf.length < 60) this.buf.push(['sfx', [n, p]]); };
  }
  stop() { if (!this.on) return; this.on = false; for (const k in this.orig) fx[k] = this.orig[k]; this.orig = {}; sfxTap.fn = null; this.buf.length = 0; }
  push(name, args) { if (this.on && this.buf.length < 60) this.buf.push([name, args]); }
  take() { const b = this.buf; this.buf = []; return b; }
}
const roundArgs = (a) => a.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : Array.isArray(v) ? roundArgs(v) : v));

// ================================================================ HOST: encoders
export function encodeFast(g, st) {
  // st: { seq, tick, acks:{slot:tick}, fxList:[{s,t,l}], wind, bid }
  const w = new BinWriter(1024); const m2 = g.m2, mst = g.mst, r = g.rules.type;
  const fxJson = st.fxList && st.fxList.length ? enc.encode(JSON.stringify(st.fxList)) : null;
  w.u8(PK.SNAP).u16(st.seq).u32(st.tick);
  const sidx = g.state === 'intro' ? 0 : g.state === 'play' ? 1 : 2;
  w.u8(sidx | (g.sudden ? 4 : 0) | (st.wind ? 8 : 0) | (fxJson ? 16 : 0));
  w.f32(g.playTime).f32(Math.max(0, g.introT)).f32(g.traps.t || 0).i8(g.winTeam).i8(g.winner ? g.fighters.indexOf(g.winner) : -1);
  w.u8(g.fighters.length);
  for (let i = 0; i < g.fighters.length; i++) {
    const f = g.fighters[i];
    const fl = (f.alive ? 1 : 0) | (f.charging ? 2 : 0) | (f.shield ? 4 : 0) | (f.hasBomb ? 8 : 0) | (f.dashT > 0 ? 16 : 0) | (f.deflectT > 0 ? 32 : 0) | (f.frozenT > 0 ? 64 : 0) | (f.stunT > 0 ? 128 : 0) | (f.inv > 0 ? 256 : 0) | (f.emoteT > 0 ? 512 : 0) | (f.carry ? 1024 : 0) | (f.respawnT > 0 ? 2048 : 0) | (f.slowK < 1 ? 4096 : 0) | (f.gooT > 0 ? 8192 : 0) | (f.airT > 0 ? 16384 : 0) | (f.isBot ? 32768 : 0);
    w.u8(i).q16(f.x, 1000).q16(f.z, 1000).q16(f.vx + (f.ex || 0), 100).q16(f.vz + (f.ez || 0), 100).u16(fl).u8(Math.round(normA(f.face) / TAU * 255));
    w.u8((Math.min(15, f.ammo) | (Math.min(15, f.maxAmmo) << 4))).u8(Math.round(f.ult)).u8(f.hp).u8(Math.min(255, Math.max(0, f.lives))).q8(Math.min(1, f.chargeT / 0.7), 255).q8(Math.max(0, f.dashCd), 100).q8(Math.max(0, f.deflectCd), 100);
    for (const k of PUK) w.q8(Math.max(0, f.pu[k] || 0), 10);
    w.q8(Math.max(0, f.typeT), 10).u8(Math.max(0, BT.indexOf(f.type))).u8(Math.max(0, ULTK.indexOf(f.ultKind))).u8(Math.max(0, DK.indexOf(f.deathKind))).i16(Math.round(f.score || 0)).u8(Math.min(255, f.kos || 0)).q8(Math.max(0, f.ultT), 10).u8(Math.max(0, f.airT > 0 ? Math.round(f.hopY * 50) : 0));
  }
  // boomerangs
  const bs = g.booms.filter((b) => b.alive); w.u8(Math.min(60, bs.length));
  for (let i = 0; i < Math.min(60, bs.length); i++) { const b = bs[i]; if (!b.nid) b.nid = ++st.bid; w.u16(b.nid).u8(g.fighters.indexOf(b.owner)).q16(b.x, 1000).q16(b.z, 1000).q16(((b.th + Math.PI) % TAU + TAU) % TAU - Math.PI, 10000).u8((b.phase === 'ret' ? 1 : 0) | (b.giant ? 2 : 0) | (b.fire ? 4 : 0) | (b.ghost ? 8 : 0) | (b.pierce ? 16 : 0) | (b.homing ? 32 : 0) | (b.fade > 0 ? 64 : 0)).u8(Math.max(0, BT.indexOf(b.type))); }
  // mode state
  if (r === 'koth') { const z = g.zone; for (let t = 0; t < 4; t++) w.f32(mst.scores[t] || 0); w.q16(z.x, 1000).q16(z.z, 1000).f32(z.t).i8(z.owner).u8(z.contested ? 1 : 0); }
  else if (r === 'bomb') { w.i8(mst.holder ? g.fighters.indexOf(mst.holder) : -1).f32(mst.fuse || 0).f32(mst.fuseMax || 12); }
  if (m2) {
    w.f32(m2.t);
    if (r === 'ctf') { w.u8(m2.scores[0]).u8(m2.scores[1]); for (const fl of m2.flags) w.i8(fl.carrier ? g.fighters.indexOf(fl.carrier) : -1).q16(fl.x, 1000).q16(fl.z, 1000).u8(fl.atHome ? 1 : 0); }
    else if (r === 'ball') { const b = m2.ball; w.u8(m2.scores[0]).u8(m2.scores[1]).q16(b.x, 1000).q16(b.z, 1000).q16(b.vx, 100).q16(b.vz, 100).q8(Math.max(0, b.hide), 50); }
    if (g.rules.crumble) w.u16(Math.max(0, m2.tiles));
  }
  // acks (per remote human slot) for client-side prediction reconciliation
  const ak = Object.keys(st.acks); w.u8(ak.length); for (const s of ak) w.u8(+s).u32(st.acks[s]);
  if (st.wind) w.u8(Math.round(st.wind.k * 100)).qi8(st.wind.dx, 40).qi8(st.wind.dz, 40);
  if (fxJson) { w.u16(fxJson.length).bytes(fxJson); }
  return w.out();
}
export function encodeCrates(g, seq) { const w = new BinWriter(256); w.u8(PK.CRATES).u16(seq); const L = []; for (let k = 0; k < AW * AH; k++) if (g.crateHp[k] > 0) L.push(k | (g.crateHp[k] === 1 ? 0x8000 : 0)); w.u16(L.length); for (const v of L) w.u16(v); return w.out(); }
export function encodeHoles(g, seq) {
  const w = new BinWriter(256); w.u8(PK.HOLES).u16(seq); const n = AW * AH, bits = new Uint8Array(Math.ceil(n / 8)); const col = [];
  for (let k = 0; k < n; k++) { const h = g.hole[k]; if (h < 0) bits[k >> 3] |= 1 << (k & 7); else if (h > 0) col.push([k, h]); }
  w.bytes(bits); w.u8(Math.min(255, col.length)); for (const [k, h] of col.slice(0, 255)) w.u16(k).q8(h, 60); return w.out();
}
export function encodeItems(g, seq, st) {
  const w = new BinWriter(256); w.u8(PK.ITEMS).u16(seq); const P = g.powerups.slice(0, 20); w.u8(P.length);
  for (const p of P) { if (!p.nid) p.nid = ++st.pid; w.u16(p.nid).u8(0).u8(pk(p.kind)).q16(p.x, 1000).q16(p.z, 1000); }
  const C = g.m2 && g.m2.coins ? g.m2.coins.slice(0, 80) : []; w.u8(C.length);
  for (const c of C) { if (!c.nid) c.nid = ++st.cid; w.u16(c.nid).q16(c.x, 1000).q16(c.z, 1000).u8(c.v); }
  return w.out();
}
import { POWERUPS } from '../data.js';
const PU_ALL = Object.keys(POWERUPS); const pk = (k) => Math.max(0, PU_ALL.indexOf(k));
export function encodeTraps(g, seq) {
  const w = new BinWriter(256); w.u8(PK.TRAPS).u16(seq); const L = g.traps.list; w.u8(Math.min(255, L.length));
  for (const t of L) { let mask = 0; const vals = []; for (let i = 0; i < TRAP_F.length; i++) { const v = t[TRAP_F[i]]; if (typeof v === 'number' && isFinite(v)) { mask |= 1 << i; vals.push(v); } } w.u16(mask); for (const v of vals) w.f32(v); }
  const S2 = g.traps.sw; w.u8(S2.length); for (const s of S2) w.f32(s.cd); return w.out();
}
export const slowSig = {
  crates: (g) => { let h = 0; for (let k = 0; k < AW * AH; k++) if (g.crateHp[k]) h = (h * 31 + k * 3 + g.crateHp[k]) | 0; return h; },
  holes: (g) => { let h = 0; for (let k = 0; k < AW * AH; k++) { const v = g.hole[k]; if (v !== 0) h = (h * 31 + k * 3 + (v < 0 ? 1 : 2)) | 0; } return h; },
  items: (g) => { let h = g.powerups.length; for (const p of g.powerups) h = (h * 31 + Math.round(p.x * 10) + Math.round(p.z * 10) * 7) | 0; if (g.m2 && g.m2.coins) { h = (h * 31 + g.m2.coins.length) | 0; for (const c of g.m2.coins) if (c.vx) h = (h * 31 + Math.round(c.x * 5)) | 0; } return h; },
  traps: (g) => { let h = 0; for (const t of g.traps.list) h = (h * 31 + (t.st | 0) * 3 + (t.forced > 0 ? 1 : 0) + (t.boost > 0 ? 2 : 0)) | 0; for (const s of g.traps.sw) h = (h * 31 + (s.cd > 0 ? 1 : 0)) | 0; return h; },
};

// ================================================================ GUEST: decoders
export function decodeFast(buf) {
  const r = new BinReader(buf); r.u8(); const S = { seq: r.u16(), tick: r.u32() }; const fl = r.u8(); S.state = fl & 3; S.sudden = !!(fl & 4); S.hasWind = !!(fl & 8); S.hasFx = !!(fl & 16);
  S.playTime = r.f32(); S.introT = r.f32(); S.trapsT = r.f32(); S.winTeam = r.i8(); S.winIdx = r.i8();
  const nf = r.u8(); S.f = [];
  for (let n = 0; n < nf; n++) {
    const o = { i: r.u8(), x: r.i16() / 1000, z: r.i16() / 1000, vx: r.i16() / 100, vz: r.i16() / 100, fl: r.u16(), face: r.u8() / 255 * TAU }; const a = r.u8(); o.ammo = a & 15; o.maxAmmo = a >> 4; o.ult = r.u8(); o.hp = r.u8(); o.lives = r.u8(); o.chargeT = r.u8() / 255 * 0.7; o.dashCd = r.u8() / 100; o.deflectCd = r.u8() / 100;
    o.pu = {}; for (const k of PUK) o.pu[k] = r.u8() / 10; o.typeT = r.u8() / 10; o.type = BT[r.u8()] || 'classic'; o.ultKind = ULTK[r.u8()] || ''; o.dk = DK[r.u8()] || 'boom'; o.score = r.i16(); o.kos = r.u8(); o.ultT = r.u8() / 10; o.hopY = r.u8() / 50; S.f.push(o);
  }
  const nb = r.u8(); S.b = [];
  for (let n = 0; n < nb; n++) { const o = { id: r.u16(), own: r.u8(), x: r.i16() / 1000, z: r.i16() / 1000, th: r.i16() / 10000 }; const fl2 = r.u8(); o.ret = !!(fl2 & 1); o.giant = !!(fl2 & 2); o.fire = !!(fl2 & 4); o.ghost = !!(fl2 & 8); o.pierce = !!(fl2 & 16); o.homing = !!(fl2 & 32); o.fade = !!(fl2 & 64); o.type = BT[r.u8()] || 'classic'; S.b.push(o); }
  S.rest = r; return S;
}
// second stage: needs the rules type (guest knows it) - parses the mode block, acks, wind, fx
export function decodeFastRest(S, type, crumble) {
  const r = S.rest, m = {};
  if (type === 'koth') { m.scores = [r.f32(), r.f32(), r.f32(), r.f32()]; m.zx = r.i16() / 1000; m.zz = r.i16() / 1000; m.zt = r.f32(); m.owner = r.i8(); m.contested = !!r.u8(); }
  else if (type === 'bomb') { m.holder = r.i8(); m.fuse = r.f32(); m.fuseMax = r.f32(); }
  if (type === 'ctf' || type === 'coins' || type === 'ball' || crumble) {
    m.t = r.f32();
    if (type === 'ctf') { m.scores = [r.u8(), r.u8()]; m.flags = [0, 1].map(() => ({ carrier: r.i8(), x: r.i16() / 1000, z: r.i16() / 1000, atHome: !!r.u8() })); }
    else if (type === 'ball') { m.scores = [r.u8(), r.u8()]; m.ball = { x: r.i16() / 1000, z: r.i16() / 1000, vx: r.i16() / 100, vz: r.i16() / 100, hide: r.u8() / 50 }; }
    if (crumble) m.tiles = r.u16();
  }
  S.m = m; S.acks = {}; const na = r.u8(); for (let i = 0; i < na; i++) { const s = r.u8(); S.acks[s] = r.u32(); }
  if (S.hasWind) S.wind = { k: r.u8() / 100, dx: r.i8() / 40, dz: r.i8() / 40 };
  if (S.hasFx) { const n = r.u16(); try { S.fx = JSON.parse(dec.decode(r.bytes(n))); } catch (e) { S.fx = []; } }
  delete S.rest; return S;
}

// ================================================================ GUEST: world model
export class GuestWorld {
  constructor(g, o) {
    this.g = g; this.slotOf = o.slotOf; this.localIdx = o.localIdx; this.mySlot = o.mySlot; this.send = o.send; this.onEvent = o.onEvent; this.type = g.rules.type; this.crumble = !!g.rules.crumble;
    this.buf = []; this.off = null; this.offs = []; this.interp = 0.1; this.lastSeq = -1; this.tk = 0; this.hist = []; this.ackTick = 0; this.lastAck = 0; this.inFrames = []; this.fxSeen = new Set(); this.fxQ = []; this.lastRecv = performance.now();
    this.booms = new Map(); this.pus = new Map(); this.coinMap = new Map(); this.me = null; this.disp = null; this.suppress = {}; this.holeT = new Float32Array(AW * AH); this.sendAcc = 0; this.stats = { snaps: 0, late: 0, starved: 0, errs: 0, corr: 0, maxErr: 0 };
    this.jit = 0; this.lastArrive = 0; this.hostSpeed = o.speed; this.wind = null; this.windAcc = 0; this.pseq = { crates: -1, holes: -1, items: -1, traps: -1 };
    const f0 = g.fighters[this.localIdx]; this.lf = f0;
    for (const f of g.fighters) { f.hopY = 0; f.die = () => false; f.deadT = 0; f.alive = true; f.spawnT = 1; f._wasAlive = true; f.pu = { triple: 0, giant: 0, fire: 0, homing: 0, speed: 0, magnet: 0, slow: 0 }; }
    // the guest never simulates gameplay: crate breaks are visual only (no random power-up drops), explosions cannot hurt
    g.breakCrate = (k) => { if (g.crateHp[k] === 0) return; g.crateHp[k] = 0; g.sol[k] = 0; g.layout.t[k] = T.FLOOR; g.view.breakCrate(k); };
    g.gainUlt = () => {}; g.spawnPowerup = () => {}; g.respawn = () => {}; g.onKO = () => {};
    g.netRecMeteor = (x, z) => g.events.spawnMeteor(x, z);
  }
  // ---------------- incoming
  onPacket(buf, now) {
    const type = new Uint8Array(buf, 0, 1)[0];
    if (type === PK.SNAP) {
      let S; try { S = decodeFast(buf); decodeFastRest(S, this.type, this.crumble); } catch (e) { this.stats.errs++; return; }
      this.lastRecv = now; if (this.buf.length && S.tick <= this.buf[this.buf.length - 1].tick) { if (this.buf.some((x) => x.tick === S.tick)) return; this.stats.late++; }
      S.at = now; this.stats.snaps++;
      const ht = S.tick * STEP * 1000; const o = now - ht; this.offs.push(o); if (this.offs.length > 120) this.offs.shift(); let mn = Infinity; for (const v of this.offs) if (v < mn) mn = v; this.off = this.off === null ? mn : this.off + (mn - this.off) * 0.1;
      // jitter estimate (RFC3550 style) drives the interpolation delay
      const ia = now - this.lastArrive; this.lastArrive = now; const dv = Math.abs((o - (this._lastO || o))); this._lastO = o; this.jit += (dv - this.jit) / 16;
      this.buf.push(S); this.buf.sort((a, b) => a.tick - b.tick); while (this.buf.length > 40) this.buf.shift();
      if (S.fx) for (const b of S.fx) { if (this.fxSeen.has(b.s)) continue; this.fxSeen.add(b.s); if (this.fxSeen.size > 24) this.fxSeen.delete(this.fxSeen.values().next().value); this.fxQ.push({ t: b.t * STEP, list: b.l }); }
      this.newest = S; this.reconcile(S);
    } else if (type === PK.CRATES || type === PK.HOLES || type === PK.ITEMS || type === PK.TRAPS) {
      try { this.slow(type, buf); } catch (e) { this.stats.errs++; }
    }
  }
  slow(type, buf) {
    const r = new BinReader(buf); r.u8(); const seq = r.u16(); const g = this.g; const nm = { [PK.CRATES]: 'crates', [PK.HOLES]: 'holes', [PK.ITEMS]: 'items', [PK.TRAPS]: 'traps' }[type];
    if (this.pseq[nm] >= 0 && ((seq - this.pseq[nm]) & 0xffff) > 0x8000) return; this.pseq[nm] = seq;
    if (type === PK.CRATES) { const n = r.u16(); const keep = new Map(); for (let i = 0; i < n; i++) { const v = r.u16(); keep.set(v & 0x7fff, (v & 0x8000) ? 1 : 2); } this.netCrates(keep); }
    else if (type === PK.HOLES) {
      const nb = Math.ceil(AW * AH / 8); const bits = r.bytes(nb); const nc = r.u8(); const col = new Map(); for (let i = 0; i < nc; i++) { const k = r.u16(); col.set(k, r.u8() / 60); }
      for (let k = 0; k < AW * AH; k++) { const gone = !!(bits[k >> 3] & (1 << (k & 7))); if (gone) { if (g.hole[k] >= 0) this.holeGone(k); } else if (col.has(k)) { if (g.hole[k] <= 0) g.hole[k] = Math.max(0.05, col.get(k)); } else if (g.hole[k] > 0) g.hole[k] = 0; }
    } else if (type === PK.ITEMS) {
      const np = r.u8(); const seen = new Set(); for (let i = 0; i < np; i++) { const id = r.u16(); r.u8(); const kind = PU_ALL[r.u8()] || 'extra'; const x = r.i16() / 1000, z = r.i16() / 1000; seen.add(id); if (!this.pus.has(id)) { const mesh = buildPowerup(kind); mesh.position.set(x, 0, z); g.scene.add(mesh); const p = { x, z, kind, mesh, t: 0, nid: id }; g.powerups.push(p); this.pus.set(id, p); } else { const p = this.pus.get(id); p.x = x; p.z = z; p.mesh.position.x = x; p.mesh.position.z = z; } }
      for (const [id, p] of [...this.pus]) if (!seen.has(id)) { g.scene.remove(p.mesh); const i = g.powerups.indexOf(p); if (i >= 0) g.powerups.splice(i, 1); this.pus.delete(id); }
      const nc = r.u8(); const m = g.m2; if (m && m.coins) { const cs = new Set(); for (let i = 0; i < nc; i++) { const id = r.u16(), x = r.i16() / 1000, z = r.i16() / 1000, v = r.u8(); cs.add(id); let c = this.coinMap.get(id); if (!c) { g.spawnCoin(x, z, v); c = m.coins[m.coins.length - 1]; c.nid = id; this.coinMap.set(id, c); } else { c.x = x; c.z = z; } c.vx = 0; c.vz = 0; c.life = 0; }
        for (const [id, c] of [...this.coinMap]) if (!cs.has(id)) { g.scene.remove(c.mesh); const i = m.coins.indexOf(c); if (i >= 0) m.coins.splice(i, 1); this.coinMap.delete(id); } }
    } else if (type === PK.TRAPS) {
      const n = r.u8(); const L = g.traps.list; for (let i = 0; i < n; i++) { const mask = r.u16(); const t = L[i]; for (let b = 0; b < TRAP_F.length; b++) if (mask & (1 << b)) { const v = r.f32(); if (t && typeof t[TRAP_F[b]] === 'number') t[TRAP_F[b]] = v; } }
      const ns = r.u8(); for (let i = 0; i < ns; i++) { const cd = r.f32(); if (g.traps.sw[i]) g.traps.sw[i].cd = cd; }
    }
  }
  holeGone(k) {
    const g = this.g; g.hole[k] = -1; const i = k % AW, j = Math.floor(k / AW);
    if (g.crateHp[k]) { g.crateHp[k] = 0; g.sol[k] = 0; g.view.breakCrate(k); } const p = g.view.pillars.get(k); if (p) { g.view.pillars.delete(k); g.view.root.remove(p); g.sol[k] = 0; g.layout.t[k] = T.FLOOR; }
    fx.puff(cx(i), 0, cz(j), 4, 0xffffff, 0.3);
  }
  netCrates(keep) {
    const g = this.g; const removed = [], added = [];
    for (let k = 0; k < AW * AH; k++) { const has = g.crateHp[k] > 0, want = keep.get(k) || 0; if (has && !want) removed.push(k); else if (!has && want) added.push(k); else if (has && want && g.crateHp[k] !== want) { g.crateHp[k] = want; } }
    for (const k of added) { const nb = removed.findIndex((q) => Math.abs((q % AW) - (k % AW)) + Math.abs(Math.floor(q / AW) - Math.floor(k / AW)) === 1); if (nb >= 0) { const q = removed.splice(nb, 1)[0]; g.crateHp[k] = keep.get(k); g.crateHp[q] = 0; g.sol[k] = 1; g.sol[q] = 0; g.layout.t[q] = T.FLOOR; g.layout.t[k] = T.CRATE; const mesh = g.view.crates.get(q); g.view.crates.delete(q); if (mesh) { g.view.crates.set(k, mesh); g.pushes.push({ mesh, t: 0, x0: mesh.position.x, z0: mesh.position.z, x1: cx(k % AW), z1: cz(Math.floor(k / AW)) }); } } }
    for (const k of removed) g.breakCrate(k);
  }
  // ---------------- own-fighter reconciliation (replay unacked inputs on top of the host state)
  reconcile(S) {
    const lf = this.lf, hf = S.f[this.localIdx]; if (!hf) return; const ack = S.acks[this.mySlot]; if (ack !== undefined) { this.ackTick = ack; while (this.hist.length && this.hist[0].tick <= ack) this.hist.shift(); }
    const alive = !!(hf.fl & 1); const free = alive && !(hf.fl & (64 | 128 | 16384 | 2048)) && ack !== undefined;
    if (!free) { this.me = null; return; }
    const P = { x: hf.x, z: hf.z, vx: hf.vx, vz: hf.vz, dashT: (hf.fl & 16) ? 0.1 : 0, dashDir: this.me ? this.me.dashDir : [Math.sin(hf.face), Math.cos(hf.face)], dashCd: hf.dashCd, face: hf.face };
    for (const h of this.hist) this.step(P, h.inp, hf);
    if (this.disp) { const err = Math.hypot(P.x - this.disp.x, P.z - this.disp.z); this.stats.maxErr = Math.max(this.stats.maxErr, err); this.stats.corr += err; if (err > 2.5) { this.disp.x = P.x; this.disp.z = P.z; } }
    else this.disp = { x: P.x, z: P.z };
    this.me = P;
  }
  speedOf(hf) { const lf = this.lf; return SPEED * lf.mods.speed * ((hf.pu.speed > 0) ? 1.4 : 1) * ((hf.fl & 2) ? 0.62 : 1) * (hf.ultKind === 'nori' && hf.ultT > 0 ? 1.7 : 1) * (lf.boss ? 0.82 : 1) * ((hf.fl & 8) ? 1.12 : 1) * ((hf.fl & 8192) ? 0.5 : 1) * ((hf.fl & 1024) ? 0.88 : 1) * ((hf.fl & 4096) ? 0.6 : 1); }
  step(P, inp, hf) {
    const g = this.g, ts = g.cfg ? g.cfg.ts : 0.62, dt = STEP * ts, lf = this.lf;
    if (g.state === 'intro') return;
    if (inp.dash && P.dashCd <= 0 && P.dashT <= 0) { let dx = inp.mx, dz = inp.mz; if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(P.face); dz = Math.cos(P.face); } const l = Math.hypot(dx, dz) || 1; P.dashDir = [dx / l, dz / l]; P.dashT = g.mut && g.mut.grav ? 0.24 : 0.17; P.dashCd = 0.95 * lf.mods.dashCd; P.face = Math.atan2(dx, dz); }
    P.dashCd -= dt;
    const ice = g.arenaId === 'ice';
    if (P.dashT > 0) { P.dashT -= dt; P.vx = P.dashDir[0] * 17; P.vz = P.dashDir[1] * 17; if (P.dashT <= 0) { P.vx *= 0.35; P.vz *= 0.35; } }
    else { const sp = this.speedOf(hf); const tx = inp.mx * sp, tz = inp.mz * sp; const acc = (ice ? 4.5 : 38) * (g.mut && g.mut.grav ? 0.45 : 1) * dt; const stop = inp.mx === 0 && inp.mz === 0; const a2 = stop ? (ice ? 1.6 : 34) * dt : acc; P.vx += clamp(tx - P.vx, -a2, a2); P.vz += clamp(tz - P.vz, -a2, a2); }
    let ex = 0, ez = 0; if (g.cellType(P.x, P.z) === T.CONV) { const k = idx(ci(P.x), cj(P.z)); ex = g.layout.dx[k] * 2.6; ez = g.layout.dz[k] * 2.6; }
    P.x += (P.vx + ex) * dt; P.z += (P.vz + ez) * dt; this.resolve(P, 0.4);
    if (P.dashT <= 0 && Math.hypot(inp.mx, inp.mz) > 0.2) P.face = Math.atan2(inp.mx, inp.mz); else if (inp.aimX || inp.aimZ) P.face = Math.atan2(inp.aimX, inp.aimZ);
  }
  resolve(P, r) {
    const g = this.g;
    for (let it = 0; it < 2; it++) { const i0 = ci(P.x - r), i1 = ci(P.x + r), j0 = cj(P.z - r), j1 = cj(P.z + r);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (!g.solid(i, j)) continue; const minx = i - HX, minz = j - HZ; const px = clamp(P.x, minx, minx + 1), pz = clamp(P.z, minz, minz + 1); const dx = P.x - px, dz = P.z - pz; const d = Math.hypot(dx, dz); if (d < r) { if (d > 1e-5) { P.x += dx / d * (r - d); P.z += dz / d * (r - d); } else P.x += (P.x < minx + 0.5 ? -1 : 1) * r; } } }
    P.x = clamp(P.x, -HX + r, HX - r); P.z = clamp(P.z, -HZ + r, HZ - r);
  }
  // ---------------- per sim step (called by Game.update on the guest)
  update(dt) {
    const g = this.g, now = performance.now(); g.time += dt; const lf = this.lf;
    // 1. read local input every step, remember it for prediction, send redundantly at 30 Hz
    const raw = Input.read(0, lf); const inp = { mx: raw.mx, mz: raw.mz, aimX: raw.aimX, aimZ: raw.aimZ, fire: !!raw.fire, dash: !!raw.dash, deflect: !!raw.deflect, ult: !!raw.ult };
    if (g.state === 'intro') { inp.dash = inp.deflect = inp.ult = false; }
    const m = Math.hypot(inp.mx, inp.mz); if (m > 1) { inp.mx /= m; inp.mz /= m; }
    this.tk++; this.hist.push({ tick: this.tk, inp }); if (this.hist.length > 90) this.hist.shift();
    this.inFrames.push({ tick: this.tk, inp }); if (this.inFrames.length > 6) this.inFrames.shift();
    if (++this.sendAcc >= (this.sendEvery || 2)) { this.sendAcc = 0; this.sendInput(); }
    const hostNow = this.off === null ? 0 : (now - this.off) / 1000;
    // 2. predicted own fighter
    const ns = this.newest; const hfN = ns ? ns.f[this.localIdx] : null;
    if (this.me && hfN) { this.step(this.me, inp, hfN); const k = 1 - Math.exp(-dt * 16); if (!this.disp) this.disp = { x: this.me.x, z: this.me.z }; this.disp.x += (this.me.x - this.disp.x) * k; this.disp.z += (this.me.z - this.disp.z) * k; }
    // local throw feedback (sound + animation) the moment the throw is released; the replayed host copy of that sound is muted
    if (hfN && lf.alive) { const was = this._fire; if (was && !inp.fire && hfN.ammo > 0 && !this.busy(hfN)) { lf.throwT = 1; sfx('throw', Math.min(1, lf.chargeT / 0.7)); this.suppress.throw = now + 280; } this._fire = inp.fire && hfN.ammo > 0; }
    // 3. world interpolation at (hostNow - delay)
    if (this.off !== null && this.buf.length) {
      const lo = this.relay ? 0.17 : 0.085; const delay = clamp(lo + this.jit / 1000 * 2.2, lo, 0.3); this.interp += (delay - this.interp) * 0.05; const rt = hostNow - this.interp;
      this.applyAt(rt, dt);
      while (this.fxQ.length && this.fxQ[0].t <= rt) this.playFx(this.fxQ.shift().list);
      if (this.fxQ.length > 12) this.playFx(this.fxQ.shift().list);
    }
    // 4. purely visual world upkeep
    this.visuals(dt, now);
    g.vis(dt);
  }
  busy(hf) { return !!(hf.fl & (16 | 64 | 128)); }
  sendInput() {
    const w = new BinWriter(48); const n = this.inFrames.length; w.u8(PK.INPUT).u8(n).u32(this.tk);
    for (let i = n - 1; i >= 0; i--) { const { inp } = this.inFrames[i]; w.qi8(inp.mx, 127).qi8(inp.mz, 127).qi8(inp.aimX, 127).qi8(inp.aimZ, 127).u8((inp.fire ? 1 : 0) | (inp.dash ? 2 : 0) | (inp.deflect ? 4 : 0) | (inp.ult ? 8 : 0) | (S().settings.aimAssist ? 16 : 0) | (Input.lastUsed === 'touch' ? 32 : 0)); }
    this.send(w.out());
  }
  applyAt(rt, dt) {
    const g = this.g, B = this.buf; let a = null, b = null;
    for (let i = B.length - 1; i >= 0; i--) { if (B[i].tick * STEP <= rt) { a = B[i]; b = B[i + 1] || null; break; } }
    if (!a) { a = B[0]; b = null; this.stats.starved++; }
    let al = 0; if (b) al = clamp((rt - a.tick * STEP) / Math.max(1e-4, (b.tick - a.tick) * STEP), 0, 1); else if (a !== B[B.length - 1]) al = 0;
    const lead = b || a; const S = al >= 0.5 && b ? b : a; // discrete state from the nearer snapshot
    // extrapolate briefly when starved
    const ex = !b ? Math.min(0.12, Math.max(0, rt - a.tick * STEP)) : 0;
    g.playTime = S.playTime + (S.state === 1 ? (rt - S.tick * STEP) * (g.cfg ? g.cfg.ts : 1) : 0);
    g.state = ['intro', 'play', 'roundEnd'][S.state]; g.sudden = S.sudden; g.introT = S.introT; g.winTeam = S.winTeam; g.winner = S.winIdx >= 0 ? g.fighters[S.winIdx] : null; if (g.state === 'roundEnd') g.celebrated = true;
    if (Math.abs(g.traps.t - S.trapsT) > 0.2) g.traps.t = S.trapsT;
    for (const fs of S.f) {
      const f = g.fighters[fs.i]; if (!f) continue; const fa = a.f[fs.i], fb = b ? b.f[fs.i] : null; let x, z;
      if (fa && fb) { const far = Math.hypot(fb.x - fa.x, fb.z - fa.z) > 3; x = far ? (al >= 0.5 ? fb.x : fa.x) : fa.x + (fb.x - fa.x) * al; z = far ? (al >= 0.5 ? fb.z : fa.z) : fa.z + (fb.z - fa.z) * al; f.face = lerpA(fa.face, fb.face, al); }
      else { const s0 = fa || fs; x = s0.x + s0.vx * ex; z = s0.z + s0.vz * ex; f.face = s0.face; }
      const own = fs.i === this.localIdx;
      this.applyFighter(f, fs, x, z, dt, own);
    }
    // boomerangs (id-matched; interpolated)
    const seen = new Set(); const bB = new Map(); if (b) for (const q of b.b) bB.set(q.id, q); const aB = new Map(); for (const q of a.b) aB.set(q.id, q);
    const src = (b && al >= 0.5) ? b.b : a.b;
    for (const q of src) {
      seen.add(q.id); let bm = this.booms.get(q.id); const qa = aB.get(q.id), qb = bB.get(q.id); let x = q.x, z = q.z, th = q.th;
      if (qa && qb) { x = qa.x + (qb.x - qa.x) * al; z = qa.z + (qb.z - qa.z) * al; th = qa.th + angDiff(qa.th, qb.th) * al; }
      const owner = g.fighters[q.own] || g.fighters[0];
      if (!bm || bm.owner !== owner) { if (bm) { bm.kill(); const i = g.booms.indexOf(bm); if (i >= 0) g.booms.splice(i, 1); } bm = new Boom(g, owner, x, z, th, 0.5, { carry: 0, type: q.type, giant: q.giant, fire: q.fire, homing: q.homing }); bm.nid = q.id; this.booms.set(q.id, bm); g.booms.push(bm); }
      bm.x = x; bm.z = z; bm.th = th; bm.phase = q.ret ? 'ret' : 'out'; bm.fire = q.fire; bm.fade = q.fade ? 0.5 : 0; bm.spin += dt * 19; bm.total += dt;
    }
    for (const [id, bm] of [...this.booms]) if (!seen.has(id)) { bm.kill(); const i = g.booms.indexOf(bm); if (i >= 0) g.booms.splice(i, 1); this.booms.delete(id); }
    this.applyMode(a, b, al, S, dt);
    // wind particles (visual only)
    if (S.wind && S.wind.k > 0.02) { this.windAcc += dt * 60; while (this.windAcc > 1) { this.windAcc -= 1; if (Math.random() < 0.9) { const x = (Math.random() * 2 - 1) * HX, z = (Math.random() * 2 - 1) * HZ, sp = 14; fx.glow.spawn(x - S.wind.dx * 3, 0.4 + Math.random() * 1.5, z - S.wind.dz * 3, S.wind.dx * sp, 0, S.wind.dz * sp, 0.05, 0.45, 0xffffff, 0, 0, 0, 3); } } }
  }
  applyFighter(f, s, x, z, dt, own) {
    const g = this.g, fl = s.fl, alive = !!(fl & 1), m = f.model;
    if (alive && !f._wasAlive) { f.alive = true; f.deadT = 0; f.air = 0; f.spawnT = 0; f.deathKind = ''; m.body.rotation.set(0, 0, 0); m.root.scale.setScalar(f.bs); f.hurtT = 0; if (own) this.disp = null; }
    if (!alive && f._wasAlive) {
      f.alive = false; f.deadT = 0; f.deathKind = s.dk; f.charging = false; m.aim.visible = false; m.bubble.visible = false; m.deflect.visible = false; const l = Math.hypot(s.vx, s.vz) || 1; f.koVx = s.vx / l * 9; f.koVz = s.vz / l * 9; f.hurtT = 1;
      if (own) { fx.hurt(s.dk === 'boom' ? 1 : 0.8); sfx('hurt'); if (navigator.vibrate && S().settings.vibrate) navigator.vibrate(s.dk === 'boom' ? 60 : 30); this.me = null; }
    }
    f._wasAlive = alive; f.alive = alive;
    if (!alive) { f.x = x; f.z = z; f.deadT += dt; this.koAnim(f, dt); f.respawnT = (fl & 2048) ? 1 : 0; this.copyStats(f, s); return; }
    if (own && this.me && this.disp && !(fl & (64 | 128 | 16384 | 2048))) { f.x = this.disp.x; f.z = this.disp.z; } else { f.x = x; f.z = z; if (own) this.disp = null; }
    const pa = f.ammo; this.copyStats(f, s);
    if (s.ammo < pa && !own) f.throwT = 1; if (s.ammo > pa) { f.happyT = 1.0; f.catchPop = 0.2; }
    f.vx = s.vx; f.vz = s.vz; f.dashT = (fl & 16) ? 0.1 : 0; f.deflectT = (fl & 32) ? 0.2 : 0; f.frozenT = (fl & 64) ? 1 : 0; f.stunT = (fl & 128) ? 1 : 0; f.inv = (fl & 256) ? 1 : 0; f.emoteT = (fl & 512) ? 1 : 0; f.shield = !!(fl & 4); f.hasBomb = !!(fl & 8); f.airT = (fl & 16384) ? 0.1 : 0; f.hopY = s.hopY;
    if (own) { const inp = this.hist.length ? this.hist[this.hist.length - 1].inp : null; f.charging = !!(inp && inp.fire && s.ammo > 0 && !(fl & (16 | 64 | 128))); if (f.charging) { f.chargeT = Math.min(1.2, (f.chargeT || 0) + dt * f.mods.charge); if (inp.aimX || inp.aimZ) { f.lastAim = [inp.aimX, inp.aimZ]; f.face = Math.atan2(inp.aimX, inp.aimZ); } else if (this.me) f.face = this.me.face; } else { f.chargeT = 0; if (this.me) f.face = this.me.face; } }
    else { f.charging = !!(fl & 2); f.chargeT = s.chargeT; }
    f.spawnT = Math.min(1, f.spawnT + dt * 3); f.throwT = Math.max(0, f.throwT - dt * 4); f.hurtT = Math.max(0, f.hurtT - dt * 3); f.tmr += dt;
    const sp2 = Math.hypot(f.vx, f.vz); f.move += ((sp2 > 0.5 ? Math.min(1, sp2 / 5) : 0) - f.move) * Math.min(1, dt * 12);
    f.vface += angDiff(f.vface, f.face) * Math.min(1, dt * (own ? 22 : 18));
    f.alive = true;
  }
  copyStats(f, s) { f.ammo = s.ammo; f.maxAmmo = s.maxAmmo; f.ult = s.ult; f.hp = s.hp; f.lives = s.lives; f.dashCd = s.dashCd; f.deflectCd = s.deflectCd; for (const k in s.pu) f.pu[k] = s.pu[k]; f.typeT = s.typeT; f.type = s.type; f.ultKind = s.ultKind; f.ultT = s.ultT; f.score = s.score; f.kos = s.kos; }
  koAnim(f, dt) {
    const m = f.model, t = f.deadT;
    if (f.deathKind === 'shatter') m.root.scale.setScalar(0.0001);
    else if (f.deathKind === 'fall') { f.air -= dt * (4 + t * 14); m.root.scale.setScalar(Math.max(0, 1 - t * 1.3)); m.body.rotation.y += dt * 8; }
    else if (['lava', 'spike', 'fire', 'zap', 'laser'].includes(f.deathKind)) { m.root.scale.setScalar(Math.max(0, 1 - Math.max(0, t - 0.35) * 2)); f.air = Math.max(0, 0.5 * Math.sin(Math.min(t * 5, 3.1))); m.body.rotation.y += dt * 14; }
    else { f.air = Math.max(-1.2, 2.4 * t * (1 - t * 0.9) * 2.2); if (t > 1.0) m.root.scale.setScalar(Math.max(0, 1 - (t - 1.0) * 2)); m.body.rotation.y += dt * 18; m.body.rotation.x = Math.min(1.4, t * 3); }
  }
  applyMode(a, b, al, S, dt) {
    const g = this.g, m = S.m, type = this.type, mst = g.mst, m2 = g.m2;
    if (type === 'koth') { mst.scores = { 0: m.scores[0], 1: m.scores[1], 2: m.scores[2], 3: m.scores[3] }; const z = g.zone; z.x = m.zx; z.z = m.zz; z.t = m.zt; z.owner = m.owner; z.contested = m.contested; }
    else if (type === 'bomb') { mst.holder = m.holder >= 0 ? g.fighters[m.holder] : null; mst.fuse = m.fuse; mst.fuseMax = m.fuseMax; }
    if (m2 && m.t !== undefined) m2.t = m.t;
    if (type === 'ctf') { m2.scores[0] = m.scores[0]; m2.scores[1] = m.scores[1]; m.flags.forEach((fl, i) => { const F = m2.flags[i]; F.atHome = fl.atHome; F.x = fl.x; F.z = fl.z; F.carrier = fl.carrier >= 0 ? g.fighters[fl.carrier] : null; }); for (const f of g.fighters) f.carry = null; for (const F of m2.flags) if (F.carrier) F.carrier.carry = F; }
    else if (type === 'ball') { m2.scores[0] = m.scores[0]; m2.scores[1] = m.scores[1]; const bl = m2.ball; const pb = a.m.ball, nb = b && b.m.ball; let x = m.ball.x, z = m.ball.z; if (pb && nb) { x = pb.x + (nb.x - pb.x) * al; z = pb.z + (nb.z - pb.z) * al; } bl.x = x; bl.z = z; bl.vx = m.ball.vx; bl.vz = m.ball.vz; bl.hide = m.ball.hide; bl.g.visible = bl.hide <= 0; }
    if (this.crumble && m.tiles !== undefined) m2.tiles = m.tiles;
  }
  // visual-only upkeep that the host's sim would normally do
  visuals(dt, now) {
    const g = this.g; const t = g.playTime;
    for (const s of g.view.spikes) { const k = idx(s.i, s.j); const ph = (t + g.spkPh[k]) % 4.2; let tgt = 0; g.spkWarn[k] = 0; if (ph > 3.2) tgt = 1; else if (ph > 2.4) g.spkWarn[k] = 1; g.spk[k] += (tgt - g.spk[k]) * Math.min(1, dt * (tgt ? 30 : 10)); }
    for (let k = 0; k < AW * AH; k++) { const h = g.hole[k]; if (h > 0) { g.hole[k] = h - dt * (g.cfg ? g.cfg.ts : 1) * (g.state === 'play' ? 1 : 0); if (g.hole[k] <= 0) this.holeGone(k); } }
    for (const l of g.view.lavas) if (Math.random() < dt * 1.2) fx.glow.spawn(cx(l.i) + (Math.random() - 0.5) * 0.7, 0.2, cz(l.j) + (Math.random() - 0.5) * 0.7, 0, 1.2, 0, 0.1, 0.6, 0xffa030, 2.5);
    for (let n = g.pushes.length - 1; n >= 0; n--) { const p = g.pushes[n]; p.t += dt / 0.16; const k = Math.min(1, p.t); p.mesh.position.x = p.x0 + (p.x1 - p.x0) * k; p.mesh.position.z = p.z0 + (p.z1 - p.z0) * k; if (p.t >= 1) g.pushes.splice(n, 1); }
    // traps animate locally from the host-synced clock; switches/kills stay host-side
    const tr = g.traps; if (tr.on) { if (g.state === 'play') tr.t += dt * (g.cfg ? g.cfg.ts : 1); for (const q of tr.list) { q.g_T = tr.t; if (g.state === 'play') q.update(dt * (g.cfg ? g.cfg.ts : 1), tr.t); } }
    g.events.updateMeteors(dt * (g.cfg ? g.cfg.ts : 1)); g.events.t += dt; g.events.visual(dt);
    // bomb tag visuals
    if (this.type === 'bomb') { const m = g.mst, h = m.holder, mesh = g.bombMesh; if (!h || !h.alive) { mesh.visible = false; g.bombMk.g.visible = false; } else { const k = clamp(m.fuse / m.fuseMax, 0, 1); mesh.visible = true; mesh.position.set(h.x, 2.05 * h.bs + Math.sin(g.time * 8) * 0.06, h.z); const pulse = m.fuse < 4 ? (Math.sin(g.time * (8 + (4 - m.fuse) * 5)) > 0 ? 1 : 0) : 0; const mt = mesh.userData.body.material; mt.emissive = mt.emissive || new THREE.Color(); mt.emissive.setRGB(pulse * 0.9, 0, 0); mesh.scale.setScalar(1 + pulse * 0.2 + (1 - k) * 0.15); g.bombMk.g.visible = true; g.bombMk.set(h.x, h.z); g.bombMk.pulse(g.time, 0.2, 6 + (1 - k) * 18); } }
    if (this.type === 'koth') { const z = g.zone; z.mk.set(z.x, z.z); const col = z.contested ? 0xff9a2e : z.owner >= 0 ? g.teamColor(z.owner) : 0xffffff; z.mk.color(col); z.mk.pulse(g.time, z.owner >= 0 ? 0.18 : 0.08, z.contested ? 14 : 5); }
  }
  playFx(list) {
    const g = this.g;
    for (const [name, a] of list) {
      try {
        if (name === 'sfx') { if (a[0] === 'throw' && this.suppress.throw > performance.now()) continue; sfx(a[0], a[1]); }
        else if (name === 'meteor') g.events.spawnMeteor(a[0], a[1]);
        else if (name === 'popup' && a[0] === 'YOU HAVE IT!') fx.popup('BOMB!', a[1], a[2], a[3], a[4]);
        else if (fx[name]) fx[name](...a);
      } catch (e) { this.stats.errs++; }
    }
  }
}
