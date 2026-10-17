// Arena traps: telegraphed, symmetric, usable as weapons through switches.
// Every trap: { type, update(dt), vis(t), hits(f)->kind|null, danger(x,z)->0..8, arm(owner) }
import { THREE, gfx, toon, glowMat, shake } from './gfx.js';
import { AW, AH, HX, HZ, cx, cz, ci, cj, idx, inb, clamp, rr, pick, shuffle } from './util.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { T, spawns } from './arena.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 8), disc: new THREE.CircleGeometry(1, 28),
  ring: new THREE.RingGeometry(0.86, 1, 40), sph: new THREE.SphereGeometry(1, 12, 9), ico: new THREE.IcosahedronGeometry(1, 1), plane: new THREE.PlaneGeometry(1, 1),
  saw: new THREE.CylinderGeometry(1, 1, 1, 12), teeth: new THREE.CylinderGeometry(1.22, 0.9, 1, 6),
};
const NEAR = (x, z, r) => { const t = gfx.camTarget; return Math.hypot(x - t.x, z - t.z) < (gfx.follow ? 15 : 40) + r; };
const warnS = (x, z, n = 'warn') => { if (NEAR(x, z, 0)) sfx(n); };


// ---------- v4.1 visual language: ONE look for everything harmful, a totally different look for portals, a friendly look for pads
// HARM  = red/orange, diagonal red-black warning stripes, a red badge decal (skull / spikes / flame / bolt / saw), a pulsing red ring.
// PORTAL = upright blue / violet swirl inside a glowing ring, paired colour + number (1 blue, 2 violet). Nothing harmful uses blue or violet.
// PAD   = friendly green + yellow with up-chevrons.
const TX = {};
const mkCanvas = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
const asTex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
export const HAZ_RED = 0xff2a1a, HAZ_ORANGE = 0xff8a1a;
const drawBadge = (x, kind) => {
  x.clearRect(0, 0, 128, 128); x.lineJoin = 'round'; x.lineCap = 'round';
  x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fillStyle = '#6d0610'; x.fill(); x.lineWidth = 9; x.strokeStyle = '#ff3b22'; x.stroke(); x.beginPath(); x.arc(64, 64, 49, 0, 7); x.lineWidth = 3; x.strokeStyle = '#ffd0a0'; x.stroke();
  if (kind === 'skull') { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(64, 56, 27, 25, 0, 0, 7); x.fill(); x.fillRect(48, 70, 32, 20); x.fillStyle = '#6d0610'; x.beginPath(); x.arc(53, 58, 8, 0, 7); x.arc(75, 58, 8, 0, 7); x.fill(); x.beginPath(); x.moveTo(64, 64); x.lineTo(59, 75); x.lineTo(69, 75); x.fill(); x.fillRect(56, 80, 3, 10); x.fillRect(63, 80, 3, 10); x.fillRect(70, 80, 3, 10); }
  else if (kind === 'spikes') { x.fillStyle = '#fff'; for (const cxp of [36, 64, 92]) { x.beginPath(); x.moveTo(cxp - 14, 94); x.lineTo(cxp, 34); x.lineTo(cxp + 14, 94); x.closePath(); x.fill(); } x.fillStyle = '#ffd23c'; x.fillRect(22, 92, 84, 8); }
  else if (kind === 'flame') { x.fillStyle = '#ffd23c'; x.beginPath(); x.moveTo(64, 20); x.bezierCurveTo(90, 48, 96, 62, 90, 80); x.bezierCurveTo(86, 98, 42, 98, 38, 80); x.bezierCurveTo(34, 64, 50, 56, 52, 42); x.bezierCurveTo(58, 50, 60, 52, 62, 54); x.bezierCurveTo(66, 44, 64, 32, 64, 20); x.fill(); x.fillStyle = '#ff7a1a'; x.beginPath(); x.moveTo(64, 52); x.bezierCurveTo(78, 66, 80, 76, 74, 86); x.bezierCurveTo(70, 94, 54, 94, 52, 84); x.bezierCurveTo(50, 74, 62, 68, 64, 52); x.fill(); }
  else if (kind === 'bolt') { x.fillStyle = '#ffe14a'; x.beginPath(); x.moveTo(72, 14); x.lineTo(40, 70); x.lineTo(60, 70); x.lineTo(52, 114); x.lineTo(90, 52); x.lineTo(68, 52); x.closePath(); x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); }
  else if (kind === 'saw') { x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 36 : 46; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.closePath(); x.fill(); x.fillStyle = '#6d0610'; x.beginPath(); x.arc(64, 64, 14, 0, 7); x.fill(); }
};
const badgeTex = (kind) => TX['b' + kind] || (TX['b' + kind] = asTex(mkCanvas(128, 128, (x) => drawBadge(x, kind))));
const stripeTex = () => TX.stripe || (TX.stripe = asTex(mkCanvas(64, 64, (x) => { x.fillStyle = '#240606'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#ff2a1a'; for (let i = -1; i < 3; i++) { x.beginPath(); x.moveTo(i * 32, 64); x.lineTo(i * 32 + 16, 64); x.lineTo(i * 32 + 16 + 64, 0); x.lineTo(i * 32 + 64, 0); x.closePath(); x.fill(); } }), true));
const PORTAL_COLS = [{ c: 0x3f86ff, css: '#3f86ff', lt: '#bcd8ff', n: '1' }, { c: 0xb046ff, css: '#b046ff', lt: '#ecc8ff', n: '2' }];
const portalTex = (i) => TX['p' + i] || (TX['p' + i] = asTex(mkCanvas(256, 256, (x) => {
  const P = PORTAL_COLS[i]; x.clearRect(0, 0, 256, 256); const g = x.createRadialGradient(128, 128, 6, 128, 128, 120); g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, P.lt); g.addColorStop(0.55, P.css); g.addColorStop(1, '#10063a'); x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fillStyle = g; x.fill();
  x.save(); x.beginPath(); x.arc(128, 128, 120, 0, 7); x.clip(); x.lineCap = 'round'; for (let arm = 0; arm < 3; arm++) { x.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = arm * 2.094 + t * 7.2, r = 14 + t * 108; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.lineWidth = 15; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke(); x.lineWidth = 6; x.strokeStyle = 'rgba(16,6,58,.55)'; x.stroke(); } x.restore();
  x.beginPath(); x.arc(128, 128, 30, 0, 7); x.fillStyle = 'rgba(8,4,40,.85)'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#fff'; x.font = '900 44px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(P.n, 128, 132);
})));
const padTex = () => TX.pad || (TX.pad = asTex(mkCanvas(128, 128, (x) => {
  x.clearRect(0, 0, 128, 128); x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fillStyle = '#3fbf3a'; x.fill(); x.lineWidth = 9; x.strokeStyle = '#fff25a'; x.stroke(); x.lineCap = 'round'; x.lineJoin = 'round';
  for (const [y, w] of [[88, 1], [66, 1], [44, 1]]) { x.beginPath(); x.moveTo(34, y); x.lineTo(64, y - 22); x.lineTo(94, y); x.lineWidth = 11; x.strokeStyle = '#1d6a1a'; x.stroke(); x.lineWidth = 6; x.strokeStyle = '#fff25a'; x.stroke(); }
})));
// small pictures for the How-to-play legend (data URLs)
export const legendImages = () => ({ hazard: badgeTex('skull').image.toDataURL(), spikes: badgeTex('spikes').image.toDataURL(), flame: badgeTex('flame').image.toDataURL(), portal1: portalTex(0).image.toDataURL(), portal2: portalTex(1).image.toDataURL(), pad: padTex().image.toDataURL() });
// hazard decals are attached to traps through tr.haz = { ring, glow, badge, lvl() } and animated in Traps.vis
const plane = (tex, w, d, x, y, z, parent, opt = {}) => { const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: opt.opacity === undefined ? 1 : opt.opacity, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }); const o = new THREE.Mesh(G.plane, m); o.rotation.x = -Math.PI / 2; o.scale.set(w, d, 1); o.position.set(x, y, z); (parent).add(o); o.renderOrder = 2; return o; };
const stripeFrame = (parent, w, d, th, y = 0.035) => { // four striped bars around a w x d rectangle centred on the parent origin
  const mats = []; const bar = (bw, bd, x, z) => { const t = stripeTex().clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(Math.max(bw, bd) / th / 2)), 1); if (bw < bd) t.rotation = Math.PI / 2; const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); const o = new THREE.Mesh(G.plane, m); o.rotation.x = -Math.PI / 2; o.scale.set(bw, bd, 1); o.position.set(x, y, z); parent.add(o); mats.push(m); };
  bar(w + th, th, 0, -d / 2); bar(w + th, th, 0, d / 2); bar(th, d - th, -w / 2, 0); bar(th, d - th, w / 2, 0); return mats;
};

export const TRAP_INFO = {
  pit: { name: 'Spike pit', tip: 'Flashes red, then spikes pop up.' },
  saw: { name: 'Saw blade', tip: 'Sweeps along its rail. Dash through or time it.' },
  hammer: { name: 'Swing hammer', tip: 'Deadly when it is fast. Slip past at the ends of the swing.' },
  laser: { name: 'Laser grid', tip: 'Thin red line = about to fire. Dash dodges it.' },
  trapdoor: { name: 'Trapdoor', tip: 'Striped floor drops away after a flash.' },
  tele: { name: 'Teleport pad', tip: 'Stand on it to zip to its twin.' },
  jump: { name: 'Jump pad', tip: 'Hop over hazards. You are safe from floor traps in the air.' },
  bumper: { name: 'Bumper', tip: 'Boing! Bounces fighters and boomerangs.' },
  goo: { name: 'Sticky goo', tip: 'Slows you down.' },
  fire: { name: 'Fire jet', tip: 'Warning flame, then a long burst.' },
  fence: { name: 'Electric fence', tip: 'Switch it on to zap rivals!' },
  boulder: { name: 'Rolling boulder', tip: 'Watch the glowing lane.' },
  crusher: { name: 'Spike ceiling', tip: 'A red shadow shows where it lands.' },
  ice: { name: 'Ice patch', tip: 'Slippery!' },
  switch: { name: 'Switch', tip: 'Hit it with a boomerang to fire the linked trap at your rivals.' },
};

// per-arena trap sets: [type, layout, opts]. layout: c=centre, r2=rotational pair, q4=four mirrored, row=full-width lane pair
const SETS = {
  dojo: [['hammer', 'r2'], ['saw', 'r2', { len: 7 }], ['jump', 'r2'], ['crusher', 'c'], ['switch', 'r2', { link: 'crusher' }]],
  rooftop: [['laser', 'x2', { axis: 'z' }], ['saw', 'r2', { len: 8 }], ['tele', 'q4'], ['jump', 'r2'], ['switch', 'r2', { link: 'laser' }]],
  jungle: [['boulder', 'row'], ['goo', 'r2'], ['pit', 'q4'], ['switch', 'r2', { link: 'boulder' }]],
  ice: [['crusher', 'r2'], ['saw', 'r2', { len: 8 }], ['bumper', 'q4'], ['switch', 'r2', { link: 'crusher' }]],
  volcano: [['fire', 'q4'], ['boulder', 'row'], ['jump', 'q4'], ['switch', 'r2', { link: 'fire' }], ['fire', 'r2']],
  pirate: [['trapdoor', 'r2'], ['hammer', 'r2'], ['tele', 'r2'], ['bumper', 'r2'], ['switch', 'r2', { link: 'hammer' }]],
  space: [['laser', 'x2', { axis: 'z' }], ['jump', 'q4'], ['tele', 'q4'], ['fence', 'r2'], ['switch', 'r2', { link: 'fence' }]],
  haunted: [['fence', 'r2'], ['goo', 'q4'], ['crusher', 'r2'], ['trapdoor', 'r2'], ['switch', 'r2', { link: 'fence' }]],
};
const RACE_SET = [['saw', 'r2', { len: 6 }], ['pit', 'q4'], ['hammer', 'r2'], ['fire', 'q4'], ['laser', 'x2', { axis: 'z' }], ['jump', 'r2']];

export class Traps {
  constructor(g, level, arenaId, o = {}) {
    this.g = g; this.level = level || 'some'; this.list = []; this.sw = []; this.t = 0; this.scene = g.scene; this.root = new THREE.Group(); this.scene.add(this.root); this.mats = []; this.owner = null;
    this.speed = this.level === 'wild' ? 1.3 : 1; this.on = this.level !== 'off' && g.mode !== 'attract' && !o.none;
    this.rubber = !!o.rubber;
    if (!this.on) return;
    const sizeK = AW >= 32 ? 2 : AW >= 26 ? 1.5 : 1; let set = (o.set || SETS[arenaId] || SETS.dojo).slice();
    // scale by map size (repeat the non-switch entries) and by 'wild'
    const base = set.filter((e) => e[0] !== 'switch'), sws = set.filter((e) => e[0] === 'switch');
    let extra = []; if (sizeK > 1) for (let i = 0; i < Math.round(base.length * (sizeK - 1)); i++) extra.push(base[i % base.length]);
    if (this.level === 'wild') for (let i = 0; i < Math.ceil(base.length / 2); i++) extra.push(base[(i * 2 + 1) % base.length]);
    if (AW <= 20 && this.level === 'some') set = base.filter((e) => ['switch'].indexOf(e[0]) < 0).slice(0, 3).concat(sws.slice(0, 1)); else set = base.concat(extra, sws);
    this.occ = []; this.build(set);
  }
  // ---------- placement helpers
  mat(c, glow) { const m = glow ? glowMat(c, glow) : toon(c); this.mats.push(m); return m; }
  add(geo, m, x, y, z, sx = 1, sy = 1, sz = 1, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); (parent || this.root).add(o); return o; }
  free(x, z, rad) {
    const g = this.g; const n = 1; const orad = rad; rad = Math.min(rad, 2.2);
    for (let j = cj(z) - n; j <= cj(z) + n; j++) for (let i = ci(x) - n; i <= ci(x) + n; i++) {
      if (!inb(i, j)) return false; if (AW <= 20 && i !== ci(x) && j !== cj(z)) continue; const k = idx(i, j); const t = g.layout.t[k]; if ((g.sol[k] && !g.crateHp[k]) || t === T.LAVA || t === T.SPIKE || t === T.CONV || g.hole[k] !== 0) return false;
    }
    for (const sp of spawns()) if (Math.hypot(cx(sp[0]) - x, cz(sp[1]) - z) < (AW <= 20 ? 2.7 : 3.6) + rad * (AW <= 20 ? 0.25 : 0.5)) return false;
    for (const o of this.occ) if (Math.hypot(o[0] - x, o[1] - z) < (o[2] + rad) * (AW <= 20 ? 0.6 : 0.75)) return false;
    return true;
  }
  clear(x, z, rad) { const g = this.g; const n = Math.ceil(Math.min(rad, 2)); for (let j = cj(z) - n; j <= cj(z) + n; j++) for (let i = ci(x) - n; i <= ci(x) + n; i++) { if (!inb(i, j)) continue; const k = idx(i, j); if (g.crateHp[k]) { g.crateHp[k] = 0; g.sol[k] = 0; g.layout.t[k] = T.FLOOR; g.view.breakCrate(k); } } }
  // choose positions for a layout; returns array of [x,z,group]
  spots(layout, rad, opt = {}) {
    const small = AW <= 20; const mx = HX - (opt.edge || (small ? 1.6 : 2.2)), mz = HZ - (opt.edge || (small ? 1.4 : 2.2)); const tries = 300;
    const snap = (v) => (opt.snap === 'cell' ? Math.round(v - 0.5) + 0.5 : opt.snap === 'int' ? Math.round(v) : v);
    for (let a = 0; a < tries; a++) {
      let x, z;
      if (layout === 'c') { x = 0; z = 0; if (a > 4) { x = rr(-2, 2); z = rr(-1.5, 1.5); } }
      else if (layout === 'x2') { x = rr(2.5, mx); z = 0; }
      else { x = -rr(opt.min || 2, mx); z = -rr(opt.minz || 1.5, mz); }
      x = snap(x); z = snap(z);
      let pts;
      if (layout === 'c') pts = [[x, z]]; else if (layout === 'x2') pts = [[x, 0], [-x, 0]]; else if (layout === 'r2') pts = [[x, z], [-x, -z]]; else pts = [[x, z], [-x, z], [x, -z], [-x, -z]];
      if (pts.every((p) => this.free(p[0], p[1], rad))) { pts.forEach((p) => { this.occ.push([p[0], p[1], rad]); this.clear(p[0], p[1], rad); }); return pts; }
    }
    return null;
  }
  build(set) {
    const g = this.g; this.groups = {};
    for (const [type, layout, o = {}] of set) {
      const fn = this['mk_' + type]; if (!fn) continue;
      const made = fn.call(this, layout, o); if (made) { (this.groups[type] = this.groups[type] || []).push(...made); }
    }
    // switches link to the nearest trap of their kind
    for (const s of this.sw) { const tl = (this.groups[s.link] || []).slice(); if (tl.length) { tl.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z)); s.targets = tl.slice(0, 2); const c = s.color; s.targets.forEach((t) => t.linkRing && t.linkRing(c)); } }
    this.list.forEach((t) => t.init && t.init());
  }
  reg(t) { this.list.push(t); return t; }
  // v4.1 shared hazard decal set: striped warning frame + red badge + pulsing red glow. lvl() -> 0 idle, 1 warning, 2 active
  hazard(tr, parent, w, d, o = {}) {
    const y = o.y || 0.034; const H = { frame: o.noFrame ? [] : stripeFrame(parent, w, d, o.th || 0.3, y), badge: null, glow: null, ring: null, lvl: o.lvl || (() => 0), bs: o.bs || Math.min(w, d) * 0.55 };
    if (o.kind) H.badge = plane(badgeTex(o.kind), H.bs, H.bs, o.bx || 0, y + 0.004, o.bz || 0, parent);
    const gm = new THREE.MeshBasicMaterial({ color: HAZ_RED, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }); const gl = new THREE.Mesh(G.plane, gm); gl.rotation.x = -Math.PI / 2; gl.scale.set(w, d, 1); gl.position.set(0, y - 0.006, 0); parent.add(gl); H.glow = gl; if (o.noGlow) gl.visible = false;
    if (o.ring) { const rm = new THREE.MeshBasicMaterial({ color: HAZ_RED, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }); const r = new THREE.Mesh(G.ring, rm); r.rotation.x = -Math.PI / 2; r.scale.set(o.ring, o.ring, 1); r.position.set(0, y + 0.002, 0); parent.add(r); H.ring = r; }
    tr.haz = H; return H;
  }
  hazVis(tr, t) {
    const H = tr.haz; if (!H) return; const L = H.lvl(); const blink = Math.sin(t * 18) > 0;
    H.glow.material.opacity = L === 2 ? 0.42 + Math.sin(t * 30) * 0.12 : L === 1 ? (blink ? 0.5 : 0.12) : 0.07 + 0.05 * Math.sin(t * 3);
    if (H.badge) { const k = L === 1 ? 1 + (blink ? 0.22 : 0) : L === 2 ? 1.1 : 1 + 0.04 * Math.sin(t * 3); H.badge.scale.set(H.bs * k, H.bs * k, 1); }
    if (H.ring) { H.ring.material.opacity = L === 2 ? 0.95 : L === 1 ? (blink ? 0.95 : 0.3) : 0.3 + 0.2 * Math.sin(t * 3); }
    for (const m of H.frame) m.opacity = L === 1 ? (blink ? 1 : 0.55) : 1;
  }
  // ---------- trap constructors (each returns array of trap objects)
  lamp(x, z, y = 1.2, parent) { const post = this.add(G.cyl, this.mat(0x30323c), x, y / 2, z, 0.06, y, 0.06, parent); const m = this.mat(0xff3030, 0.1); const l = this.add(G.sph, m, x, y + 0.1, z, 0.15, 0.15, 0.15, parent); return { post, l, m, set(on, hot) { this.m.emissiveIntensity = on ? (hot ? 3.2 : 1.8) : 0.05; this.m.color.setHex(on ? (hot ? 0xff2020 : 0xffb030) : 0x552020); this.m.emissive.setHex(on ? (hot ? 0xff2020 : 0xffb030) : 0x330000); } }; }
  mk_pit(layout, o) {
    const ps = this.spots(layout, 1.4, { snap: 'int', min: 2.5 }); if (!ps) return null; const out = [];
    ps.forEach(([x, z], n) => {
      const grp = new THREE.Group(); grp.position.set(x, 0, z); this.root.add(grp);
      this.add(G.box, this.mat(0x1a1420), 0, 0.018, 0, 2, 0.04, 2, grp); const fr = this.mat(0xff6a1a, 0.6);
      [[-1, 0, 2.1, 0.1], [1, 0, 2.1, 0.1], [0, -1, 0.1, 2.1], [0, 1, 0.1, 2.1]].forEach(([a, b, w, d]) => this.add(G.box, fr, a, 0.04, b, w === 0.1 ? 0.1 : 2.1, 0.05, d === 0.1 ? 0.1 : 2.1, grp));
      const cones = new THREE.Group(); grp.add(cones); const sm = this.mat(0xcfd6e6);
      for (let a = -0.5; a <= 0.5; a += 1) for (let b = -0.5; b <= 0.5; b += 1) this.add(G.cone, sm, a * 0.9, 0.35, b * 0.9, 0.3, 0.7, 0.3, cones);
      const lp = this.lamp(x - 1.15, z - 1.15, 0.7);
      const tr = { type: 'pit', x, z, ph: (n * 1.7 + rr(0, 1)) , P: 4.6 / this.speed, up: 0, warn: false, lp, cones, fr,
        update(dt, T) { const c = (T + this.ph) % this.P, w0 = this.P - 2.2, u0 = this.P - 1.2; const w = c > w0 && c < u0, u = c >= u0; if (w && !this.warn) warnS(x, z); if (u && !this.up) { warnS(x, z, 'spike'); fx.puff(x, 0.2, z, 5, 0xffffff, 0.3); } this.warn = w; this.up = u; },
        vis(t) { const c = this.up ? 1 : this.warn ? 0.12 + Math.abs(Math.sin(t * 22)) * 0.08 : 0; this.cones.position.y = -0.8 + c * 0.8 + (this.up ? 0 : 0); this.fr.emissive.setHex(this.up ? 0xff2020 : this.warn && Math.sin(t * 24) > 0 ? 0xff2020 : 0xff6a1a); lp.set(this.warn || this.up, this.up || this.warn); },
        hits(f) { return this.up && Math.abs(f.x - x) < 1.0 && Math.abs(f.z - z) < 1.0 ? 'spike' : null; },
        danger(px, pz) { const c = (this.g_T + this.ph) % this.P; return Math.abs(px - x) < 1.35 && Math.abs(pz - z) < 1.35 && c > this.P - 2.5 ? 8 : 0; } };
      this.hazard(tr, grp, 2.5, 2.5, { kind: 'spikes', bs: 1.5, lvl: () => (tr.up ? 2 : tr.warn ? 1 : 0), th: 0.34 });
      out.push(this.reg(tr));
    }); return out;
  }
  mk_saw(layout, o) {
    const len = o.len || 7; const out = []; const ps = this.spots(layout === 'c' ? 'c' : 'r2', 1.0, { snap: 'cell', min: len / 2 + 1, edge: 1.8 }); if (!ps) return null;
    ps.forEach(([x0, z], n) => {
      // rail centred on x (clamped), moving along x
      const half = Math.min(len / 2, HX - 1.6); const cxm = clamp(x0 * 0.2, -2, 2) * (n ? -1 : 1);
      this.add(G.box, this.mat(0x2a2d3a), cxm, 0.02, z, half * 2 + 1, 0.04, 0.22); this.add(G.box, this.mat(0xff9a1a, 0.5), cxm - half - 0.4, 0.05, z, 0.25, 0.1, 0.4); this.add(G.box, this.mat(0xff9a1a, 0.5), cxm + half + 0.4, 0.05, z, 0.25, 0.1, 0.4);
      const blade = new THREE.Group(); blade.position.set(cxm, 0.55, z); this.root.add(blade); const spin = new THREE.Group(); blade.add(spin);
      this.add(G.teeth, this.mat(0xb8c0d0), 0, 0, 0, 0.62, 0.07, 0.62, spin); this.add(G.saw, this.mat(0xe8eefc), 0, 0.03, 0, 0.58, 0.06, 0.58, spin); this.add(G.cyl, this.mat(0xff3a3a, 1), 0, 0.07, 0, 0.18, 0.08, 0.18, spin);
      this.add(G.box, this.mat(0x2a2d3a), 0, -0.3, 0, 0.3, 0.55, 0.3, blade);
      const tr = { type: 'saw', x: cxm, z, half, ph: n * Math.PI + rr(0, 1), w: 0.9 * this.speed, blade, spin, bx: cxm, cxm,
        pos(T) { return this.cxm + Math.sin(T * this.w + this.ph) * this.half; },
        update(dt, T) { this.bx = this.pos(T); },
        vis(t) { this.blade.position.x = this.bx; this.spin.rotation.y = t * 22; if (Math.random() < 0.15 * (gfx.density || 1)) fx.sparks(this.bx, 0.4, z, 2, [0xffd060, 0xffffff], { speed: 2.5, life: 0.25, size: 0.06 }); },
        hits(f) { return Math.hypot(f.x - this.bx, f.z - z) < 0.88 ? 'saw' : null; },
        danger(px, pz) { if (Math.abs(pz - z) > 1.3) return 0; const a = this.pos(this.g_T), b = this.pos(this.g_T + 0.4); return Math.abs(px - a) < 1.5 || Math.abs(px - b) < 1.4 || (px > Math.min(a, b) && px < Math.max(a, b)) ? 8 : 0; } };
      { const hg = new THREE.Group(); hg.position.set(cxm, 0, z); this.root.add(hg); this.hazard(tr, hg, half * 2 + 1.4, 1.5, { kind: 'saw', bs: 0.95, bx: -half - 1.15, th: 0.28, lvl: () => 0 }); plane(badgeTex('saw'), 0.95, 0.95, half + 1.15, 0.04, 0, hg); }
      out.push(this.reg(tr));
    }); return out;
  }
  mk_hammer(layout, o) {
    const ps = this.spots(layout, 2.6, { min: 3, edge: 3 }); if (!ps) return null; const out = []; const L = 2.4;
    ps.forEach(([x, z], n) => {
      const pivot = new THREE.Group(); pivot.position.set(x, 0, z); this.root.add(pivot);
      this.add(G.cyl, this.mat(0x4a4036), 0, 0.5, 0, 0.35, 1.0, 0.35, pivot); this.add(G.cyl, this.mat(0xd9a441), 0, 1.05, 0, 0.45, 0.1, 0.45, pivot);
      const arm = new THREE.Group(); arm.position.y = 0.85; pivot.add(arm); this.add(G.box, this.mat(0x8a5a2a), 0, 0, L / 2, 0.18, 0.18, L, arm);
      const head = this.add(G.box, this.mat(0x6a6f80), 0, 0, L + 0.1, 0.9, 0.85, 1.0, arm); this.add(G.box, this.mat(0xff4a4a, 0.5), 0, 0, L + 0.1, 0.94, 0.12, 1.04, arm);
      const sweep = this.add(G.ring, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }), x, 0.025, z, L + 0.5, 1, L + 0.5); sweep.rotation.x = -Math.PI / 2;
      const tr = { type: 'hammer', x, z, armG: arm, L, boost: 0, a: n * Math.PI, ph: n * Math.PI, w: 1.7 * this.speed, th: 0, v: 0, hx: x, hz: z, lastS: 0,
        arm(owner) { this.boost = 5; this.owner = owner || null; warnS(x, z, 'warn'); },
        update(dt, T) { if (this.boost > 0) { this.boost -= dt; if (this.boost <= 0) this.owner = null; } this.a += dt * this.w * (this.boost > 0 ? 1.9 : 1); const a = this.a; this.th = Math.sin(a) * 2.3; this.v = Math.cos(a) * 2.3 * this.w; const ang = this.th + (n ? Math.PI : 0); this.hx = x + Math.sin(ang) * (L + 0.1); this.hz = z + Math.cos(ang) * (L + 0.1); this.rot = ang; const s = Math.sign(this.v); if (Math.abs(Math.cos(a)) < 0.12 && s !== this.lastS && NEAR(x, z, 3)) { this.lastS = s; sfx('push'); } },
        vis() { this.armG.rotation.y = this.rot || 0; },
        hits(f) { return Math.abs(this.v) * L > 3.4 && Math.hypot(f.x - this.hx, f.z - this.hz) < 0.95 ? 'hammer' : null; },
        danger(px, pz) { return Math.hypot(px - x, pz - z) < L + 0.8 && Math.hypot(px - x, pz - z) > 0.8 ? 6 : 0; } };
      { const hg = new THREE.Group(); hg.position.set(x, 0, z); this.root.add(hg); this.hazard(tr, hg, 1.5, 1.5, { kind: 'skull', bs: 1.1, noFrame: true, noGlow: true, ring: L + 0.55, lvl: () => 1 }); }
      tr.kdir = () => [Math.sign(tr.v) * Math.cos(tr.rot || 0), -Math.sign(tr.v) * Math.sin(tr.rot || 0)]; out.push(this.reg(tr));
    }); return out;
  }
  mk_laser(layout, o) {
    if (this.groups.laser) return null;
    // find columns (x) with the fewest obstacles, mirrored pairs, alternating phase
    const g = this.g; const cols = []; for (let i = 3; i < AW - 3; i++) { let n = 0; for (let j = 0; j < AH; j++) if (g.sol[idx(i, j)]) n++; cols.push([i, n]); }
    const axis = o.axis || 'z'; const out = [];
    const nBeams = AW >= 32 ? 3 : 2; const xs = []; cols.sort((a, b) => a[1] - b[1] || Math.abs(a[0] - AW / 2) - Math.abs(b[0] - AW / 2));
    for (const [i] of cols) { const x = cx(i); if (xs.every((v) => Math.abs(v - x) > 3.2) && Math.abs(x) > 1) { xs.push(x); if (xs.length >= nBeams * 2) break; } }
    xs.forEach((x, n) => {
      const len = HZ * 2; const em = this.mat(0x30323c); [-1, 1].forEach((s) => { this.add(G.box, em, x, 0.6, s * (HZ + 0.1), 0.5, 1.2, 0.5); this.add(G.sph, this.mat(0xff3030, 1.5), x, 0.9, s * (HZ - 0.2), 0.16, 0.16, 0.16); });
      const bm = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }); const beam = this.add(G.box, bm, x, 0.55, 0, 0.3, 0.12, len); const strip = this.add(G.box, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.12, depthWrite: false }), x, 0.02, 0, 0.9, 0.01, len);
      const tr = { type: 'laser', x, z: 0, beam, bm, strip, ph: (n % 2) * 3.1 + Math.floor(n / 2) * 0.7, P: 6.0 / this.speed, st: 0, forced: 0,
        update(dt, T) { let st; if (this.forced > 0) { this.forced -= dt; st = this.forced > 1.0 ? 1 : this.forced > 0 ? 2 : 0; } else { const c = (T + this.ph) % this.P; st = c > this.P - 1.1 ? 2 : c > this.P - 2.3 ? 1 : 0; } if (st === 1 && this.st === 0) warnS(x, 0); if (st === 2 && this.st !== 2) warnS(x, 0, 'zonepoint'); this.st = st; },
        arm() { if (this.forced <= 0) this.forced = 2.6; },
        vis(t) { this.bm.opacity = this.st === 2 ? 0.95 : this.st === 1 ? (Math.sin(t * 40) > 0 ? 0.55 : 0.1) : 0; this.beam.scale.x = this.st === 2 ? 0.34 : 0.05; this.strip.material.opacity = this.st ? 0.4 : 0.1; },
        hits(f) { return this.st === 2 && Math.abs(f.x - x) < 0.42 ? 'laser' : null; }, danger(px) { return this.st && Math.abs(px - x) < 0.9 ? 8 : 0; } };
      { const hg = new THREE.Group(); hg.position.set(x, 0, 0); this.root.add(hg); this.hazard(tr, hg, 1.0, len, { kind: 'skull', bs: 1.0, bz: len / 2 - 1.3, th: 0.26, lvl: () => tr.st }); plane(badgeTex('skull'), 1.0, 1.0, 0, 0.04, -len / 2 + 1.3, hg); }
      out.push(this.reg(tr));
    }); return out;
  }
  mk_trapdoor(layout, o) {
    const ps = this.spots(layout, 1.6, { snap: 'int', min: 3, edge: 3 }); if (!ps) return null; const out = []; const g = this.g;
    ps.forEach(([x, z], n) => {
      const cells = [[x - 0.5, z - 0.5], [x + 0.5, z - 0.5], [x - 0.5, z + 0.5], [x + 0.5, z + 0.5]].map(([a, b]) => idx(ci(a), cj(b)));
      const ov = new THREE.Group(); ov.position.set(x, 0.0, z); this.root.add(ov); const stripe = this.mat(0xff3a1a, 0.55), dark = this.mat(0x2a0a0a);
      this.add(G.box, dark, 0, 0.02, 0, 1.96, 0.04, 1.96, ov); for (let s = -3; s <= 3; s++) { const b = this.add(G.box, stripe, s * 0.3, 0.05, 0, 0.12, 0.03, 2.4, ov); b.rotation.y = 0.7; b.scale.z = Math.min(2.6, 2.8 - Math.abs(s) * 0.3); }
      const lp = this.lamp(x + 1.2, z + 1.2, 0.7); const hg = new THREE.Group(); hg.position.set(x, 0, z); this.root.add(hg); const abyss = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: 0x1a0006 })); abyss.rotation.x = -Math.PI / 2; abyss.scale.set(2.0, 2.0, 1); abyss.position.y = -0.6; abyss.visible = false; hg.add(abyss);
      const tr = { type: 'trapdoor', x, z, ph: n * 3.0 + rr(0, 1), P: 7.5 / this.speed, st: 0, ov, lp, cells,
        update(dt, T) { const c = (T + this.ph) % this.P; // timeline: closed .. warn(1.0) .. open(2.2) .. closed
          const w0 = this.P - 3.4, o0 = this.P - 2.4, o1 = this.P; let s = 0; if (c > w0 && c <= o0) s = 1; else if (c > o0) s = 2; if (s !== this.st) { if (s === 1) warnS(x, z); if (s === 2) { warnS(x, z, 'fall'); } if (s === 0) { /* close */ } this.st = s; }
          for (const k of this.cells) { if (g.sudden && g.hole[k] !== 0 && this.st === 0) continue; if (this.st === 1) g.hole[k] = 0.4; else if (this.st === 2) { if (g.hole[k] >= 0) g.hole[k] = -1; } else if (g.hole[k] < 0 || g.hole[k] > 0) { if (!g.sudden || this.closed) g.hole[k] = 0; } } },
        vis(t) { this.ov.visible = this.st !== 2; abyss.visible = this.st === 2; if (this.haz && this.haz.badge) this.haz.badge.visible = this.st !== 2; lp.set(this.st > 0, this.st > 0); stripe.emissiveIntensity = this.st === 1 ? 1 + Math.sin(t * 28) * 0.8 : 0.55; },
        hits() { return null; }, danger(px, pz) { return this.st && Math.abs(px - x) < 1.25 && Math.abs(pz - z) < 1.25 ? 8 : (Math.abs(px - x) < 1.25 && Math.abs(pz - z) < 1.25 && ((this.g_T + this.ph) % this.P) > this.P - 4.4 ? 5 : 0); } };
      this.hazard(tr, hg, 2.5, 2.5, { kind: 'skull', bs: 1.5, th: 0.34, lvl: () => tr.st });
      out.push(this.reg(tr));
    }); return out;
  }
  mk_tele(layout, o) {
    const ps = this.spots(layout === 'q4' ? 'q4' : 'r2', 0.9, { min: 2.5, edge: 2 }); if (!ps) return null; const out = [];
    // pairs: r2 -> (0,1); q4 -> (0,3) and (1,2) (diagonals). Pair 1 = BLUE "1", pair 2 = VIOLET "2".
    const pairs = ps.length === 2 ? [[0, 1]] : [[0, 3], [1, 2]];
    pairs.forEach((pr, pi) => {
      const PC = PORTAL_COLS[pi % 2], col = PC.c; const pads = pr.map((i) => ps[i]).map(([x, z]) => {
        const grp = new THREE.Group(); grp.position.set(x, 0, z); this.root.add(grp);
        this.add(G.cyl, this.mat(0x120a38), 0, 0.04, 0, 1.0, 0.08, 1.0, grp);
        const r = this.add(G.ring, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, side: THREE.DoubleSide }), 0, 0.1, 0, 0.98, 1, 0.98, grp); r.rotation.x = -Math.PI / 2;
        const core = plane(portalTex(pi % 2), 1.9, 1.9, 0, 0.11, 0, grp, { opacity: 0.85 }); // swirl on the floor (reads from straight above)
        // upright portal: glowing ring frame + swirling disc, tilted toward the camera
        const up = new THREE.Group(); up.position.set(0, 1.05, 0.05); up.rotation.x = -0.28; grp.add(up);
        const tor = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 28), new THREE.MeshBasicMaterial({ color: col })); tor.scale.set(1.15, 1.5, 1); up.add(tor);
        const disc = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: portalTex(pi % 2), transparent: true, depthWrite: false, side: THREE.DoubleSide })); disc.scale.set(1.25, 1.7, 1); up.add(disc);
        return { x, z, grp, r, core, up, disc, tor };
      });
      const tr = { type: 'tele', x: pads[0].x, z: pads[0].z, pads, col, update(dt) { }, vis(t) { pads.forEach((p, i) => { p.core.rotation.z = t * (i ? -1.6 : 1.6); p.disc.rotation.z = t * (i ? 1.2 : -1.2); p.up.position.y = 1.05 + Math.sin(t * 2 + i) * 0.05; p.tor.material.color.setHex(col); p.r.material.opacity = 0.7 + 0.3 * Math.sin(t * 4 + i); if (Math.random() < 0.18) fx.glow.spawn(p.x + rr(-0.4, 0.4), 0.1, p.z + rr(-0.4, 0.4), 0, 1.6, 0, 0.1, 0.7, col, 0, 0, 0, -0.1); }); },
        hits() { return null; }, danger() { return 0; },
        fighter(f, dt, g) { if (f.tpCd > 0) return; for (let i = 0; i < 2; i++) { const p = pads[i], q = pads[1 - i]; if (Math.hypot(f.x - p.x, f.z - p.z) < 0.7) { f.tpT = (f.tpT || 0) + dt; if (f.tpT > 0.28) { f.tpT = 0; f.tpCd = 1.6; fx.ring(p.x, 0.2, p.z, col, 2.2, 0.35); fx.burst(p.x, 0.5, p.z, 10, [col, 0xffffff], { speed: 3, up: 3, size: 0.1 }); f.x = q.x; f.z = q.z; f.vx *= 0.3; f.vz *= 0.3; fx.ring(q.x, 0.2, q.z, col, 2.6, 0.4); fx.burst(q.x, 0.5, q.z, 14, [col, 0xffffff], { speed: 4, up: 3, size: 0.1 }); if (NEAR(q.x, q.z, 3)) sfx('spawn'); } return; } } f.tpT = 0; } };
      out.push(this.reg(tr));
    }); return out;
  }
  mk_jump(layout, o) {
    const ps = this.spots(layout, 0.9, { min: 2.5, edge: 2 }); if (!ps) return null; const out = [];
    ps.forEach(([x, z], n) => {
      const ang = Math.atan2(-x, -z) + (Math.abs(x) < 0.5 ? Math.PI / 2 : 0); const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ang; this.root.add(grp);
      this.add(G.cyl, this.mat(0x1d5a1a), 0, 0.05, 0, 0.95, 0.1, 0.95, grp); const pm = this.mat(0x4fe04a, 0.9); const pad = this.add(G.cyl, pm, 0, 0.12, 0, 0.78, 0.07, 0.78, grp);
      { const pp = plane(padTex(), 1.5, 1.5, 0, 0.165, 0, grp); pp.rotation.z = Math.PI; }
      const tr = { type: 'jump', x, z, ang, pad, cd: 0, update(dt) { this.cd -= dt; }, vis(t) { const k = 1 + Math.max(0, this.cd + 0.4) * 0.3 * 0 + Math.sin(t * 6 + n) * 0.04; this.pad.scale.set(0.78 * k, 0.07, 0.78 * k); },
        hits() { return null; }, danger() { return 0; },
        fighter(f, dt, g) { if (f.airT > 0 || f.alive === false) return; if (Math.hypot(f.x - x, f.z - z) < 0.6) { const dx = Math.sin(ang), dz = Math.cos(ang); f.airT = 0.62; f.airMax = 0.62; f.hopV = [dx * 8.2, dz * 8.2]; fx.ring(x, 0.2, z, 0x7dff6a, 2.4, 0.35); fx.puff(x, 0.2, z, 6, 0xffffff, 0.3); if (NEAR(x, z, 3)) sfx('bumper'); } } };
      out.push(this.reg(tr));
    }); return out;
  }
  mk_bumper(layout, o) {
    const ps = this.spots(layout, 1.0, { min: 2.5, edge: 2 }); if (!ps) return null; const out = [];
    ps.forEach(([x, z], n) => {
      const grp = new THREE.Group(); grp.position.set(x, 0, z); this.root.add(grp); this.add(G.cyl, this.mat(0x2a2d3a), 0, 0.15, 0, 0.62, 0.3, 0.62, grp); const top = this.add(G.cyl, this.mat(0xff5aa0, 0.9), 0, 0.45, 0, 0.5, 0.35, 0.5, grp); this.add(G.cyl, this.mat(0xffe36a, 1.2), 0, 0.66, 0, 0.3, 0.06, 0.3, grp);
      const tr = { type: 'bumper', x, z, hot: 0, top, update(dt) { this.hot = Math.max(0, this.hot - dt); }, vis() { const k = 1 + this.hot * 0.9; this.top.scale.set(0.5 * k, 0.35, 0.5 * k); },
        hits() { return null; }, danger() { return 0; },
        pop() { if (this.hot > 0.2) return; this.hot = 0.3; if (NEAR(x, z, 2)) sfx('bumper'); fx.ring(x, 0.3, z, 0xff9ad0, 2.2, 0.3); fx.sparks(x, 0.5, z, 8, [0xffd23c, 0xff9ad0], { speed: 4, life: 0.3 }); },
        fighter(f) { const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz); if (d < 0.95 && d > 0.001) { const nx = dx / d, nz = dz / d; f.vx = nx * 12; f.vz = nz * 12; f.x = x + nx * 0.96; f.z = z + nz * 0.96; this.pop(); } },
        boom(b) { const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001) { const nx = dx / d, nz = dz / d; const vx = Math.sin(b.th), vz = Math.cos(b.th); const dp = vx * nx + vz * nz; if (dp < 0) b.th = Math.atan2(vx - 2 * dp * nx, vz - 2 * dp * nz); b.x = x + nx * 0.82; b.z = z + nz * 0.82; this.pop(); return true; } return false; } };
      out.push(this.reg(tr));
    }); return out;
  }
  mk_goo(layout, o) {
    const ps = this.spots(layout, 1.6, { min: 2.5, edge: 2.2 }); if (!ps) return null; const out = [];
    ps.forEach(([x, z], n) => {
      const gm = new THREE.MeshToonMaterial({ color: 0x6aff4a, transparent: true, opacity: 0.78, gradientMap: null }); this.mats.push(gm); const grp = new THREE.Group(); grp.position.set(x, 0.02, z); this.root.add(grp);
      for (let a = 0; a < 6; a++) { const r = a ? rr(0.5, 0.9) : 1.45; const m = this.add(G.disc, gm, a ? rr(-0.9, 0.9) : 0, 0.004 * a, a ? rr(-0.8, 0.8) : 0, r, 1, r, grp); m.rotation.x = -Math.PI / 2; }
      const bub = []; for (let a = 0; a < 3; a++) { const b = this.add(G.sph, this.mat(0xc0ffa0, 0.6), rr(-0.8, 0.8), 0.1, rr(-0.7, 0.7), 0.16, 0.16, 0.16, grp); bub.push([b, rr(0, 6)]); }
      const tr = { type: 'goo', x, z, bub, update() { }, vis(t) { this.bub.forEach(([b, p]) => { const k = (t * 0.6 + p) % 1; b.scale.setScalar(0.05 + Math.sin(k * Math.PI) * 0.2); }); },
        hits() { return null; }, danger(px, pz) { return Math.hypot(px - x, pz - z) < 1.5 ? 2.4 : 0; }, fighter(f) { if (Math.hypot(f.x - x, f.z - z) < 1.45 * 0.96) f.gooT = 0.12; } };
      out.push(this.reg(tr));
    }); return out;
  }
  mk_ice(layout, o) {
    const ps = this.spots(layout, 1.6, { min: 2, edge: 2 }); if (!ps) return null; const out = [];
    ps.forEach(([x, z]) => {
      const m = new THREE.MeshBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.5, depthWrite: false }); this.mats.push(m); const p = this.add(G.disc, m, x, 0.022, z, 1.8, 1, 1.4); p.rotation.x = -Math.PI / 2;
      out.push(this.reg({ type: 'ice', x, z, update() { }, vis() { }, hits() { return null; }, danger() { return 0; }, fighter(f) { if (Math.hypot((f.x - x) / 1.8, (f.z - z) / 1.4) < 1) f.iceT = 0.12; } }));
    }); return out;
  }
  mk_fire(layout, o) {
    const ps = this.spots(layout, 1.0, { min: HX - 3.2, edge: 1.2 }) || this.spots(layout, 1.0, { min: 3, edge: 1.5 }); if (!ps) return null; const out = []; const L = 3.8;
    ps.forEach(([x, z], n) => {
      // face inwards along the longer axis
      const ang = Math.abs(x) > HX - 4 ? (x < 0 ? Math.PI / 2 : -Math.PI / 2) : (z < 0 ? 0 : Math.PI); const dx = Math.sin(ang), dz = Math.cos(ang);
      const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ang; this.root.add(grp);
      this.add(G.box, this.mat(0x2a2d3a), 0, 0.2, 0, 0.9, 0.4, 0.8, grp); this.add(G.cyl, this.mat(0xff7a1a, 0.9), 0, 0.42, 0.1, 0.28, 0.1, 0.28, grp);
      const fm = new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }); const fl = this.add(G.cone, fm, 0, 0.5, L / 2 + 0.3, 0.6, L, 0.6, grp); fl.rotation.x = Math.PI / 2; fl.position.z = L / 2 + 0.4;
      const lane = this.add(G.box, new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.0, depthWrite: false }), 0, 0.02, L / 2 + 0.4, 1.0, 0.01, L, grp);
      const lp = this.lamp(x + dz * 0.8, z - dx * 0.8, 0.6);
      const tr = { type: 'fire', x, z, dx, dz, fl, fm, lane, lp, ph: n * 1.3 + rr(0, 2), P: 5.6 / this.speed, st: 0, forced: -1, L,
        update(dt, T) { let c = (T + this.ph) % this.P; if (this.forced > 0) { this.forced -= dt; c = this.P - 2.0 + (1.4 - this.forced > 0 ? 1.4 - this.forced : 0); if (this.forced <= 0) this.forced = -1; } const st = c > this.P - 1.15 ? 2 : c > this.P - 2.15 ? 1 : 0; if (st === 1 && this.st === 0) warnS(x, z); if (st === 2 && this.st !== 2) warnS(x, z, 'sizzle'); this.st = st; },
        arm() { this.forced = 2.4; },
        vis(t) { const on = this.st === 2; this.fm.opacity = on ? 0.85 : this.st === 1 ? (Math.sin(t * 30) > 0 ? 0.25 : 0) : 0; this.fl.scale.set(on ? 0.6 + Math.sin(t * 40) * 0.08 : 0.25, on ? L : L * 0.35, on ? 0.6 : 0.25); this.fl.position.z = (on ? L : L * 0.35) / 2 + 0.4; this.lane.material.opacity = this.st === 1 ? 0.28 + Math.sin(t * 20) * 0.1 : on ? 0.35 : 0; lp.set(this.st > 0, this.st > 0);
          if (on && NEAR(x, z, 3)) { for (let i = 0; i < 2; i++) fx.glow.spawn(x + dx * (0.6 + Math.random() * L), 0.4 + Math.random() * 0.6, z + dz * (0.6 + Math.random() * L), rr(-0.3, 0.3), 1.2, rr(-0.3, 0.3), 0.18, 0.4, Math.random() < 0.5 ? 0xff7a1a : 0xffd060, 0, 0, 0, -0.4); } },
        hits(f) { if (this.st !== 2) return null; const ax = f.x - x, az = f.z - z; const along = ax * dx + az * dz, perp = Math.abs(ax * dz - az * dx); return along > 0.2 && along < L + 0.5 && perp < 0.75 ? 'fire' : null; },
        danger(px, pz) { if (!this.st && ((this.g_T + this.ph) % this.P) < this.P - 2.8) return 0; const ax = px - x, az = pz - z; const along = ax * dx + az * dz, perp = Math.abs(ax * dz - az * dx); return along > 0 && along < L + 0.6 && perp < 1.0 ? 8 : 0; },
        linkRing(c) { const r = this.add(G.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), 0, 0.03, 0, 0.9, 1, 0.9, grp); r.rotation.x = -Math.PI / 2; }, add: (...a) => (this.add(...a)) };
      tr.add = (geo, m, px, py, pz, sx, sy, sz, par) => this.add(geo, m, px, py, pz, sx, sy, sz, par || grp);
      { const hg = new THREE.Group(); hg.position.set(0, 0, L / 2 + 0.4); grp.add(hg); this.hazard(tr, hg, 1.35, L + 0.3, { kind: 'flame', bs: 1.0, th: 0.28, lvl: () => tr.st }); }
      out.push(this.reg(tr));
    }); return out;
  }
  mk_fence(layout, o) {
    const ps = this.spots(layout, 2.4, { min: 3.5, edge: 2.6, snap: 'cell' }); if (!ps) return null; const out = []; const half = 2.4;
    ps.forEach(([x, z], n) => {
      const vert = (n + (this.groups.fence ? 1 : 0)) % 2 === 1; const ex = vert ? 0 : half, ez = vert ? half : 0; const pm = this.mat(0x3a3c4c), om = this.mat(0xff3a1a, 0.3);
      [-1, 1].forEach((s) => { this.add(G.cyl, pm, x + ex * s, 0.55, z + ez * s, 0.18, 1.1, 0.18); this.add(G.sph, om, x + ex * s, 1.2, z + ez * s, 0.26, 0.26, 0.26); });
      const am = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); const arc = this.add(G.box, am, x, 0.8, z, vert ? 0.1 : half * 2, 0.7, vert ? half * 2 : 0.1);
      const strip = this.add(G.box, new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0.18, depthWrite: false }), x, 0.02, z, vert ? 0.6 : half * 2, 0.01, vert ? half * 2 : 0.6);
      const tr = { type: 'fence', x, z, ex, ez, half, arc, am, om, strip, st: 0, timer: rr(5, 9) / this.speed, left: 0, owner: null, sw: null,
        update(dt, T) { if (this.st === 0) { this.timer -= dt; if (this.timer <= 0) this.arm(null, true); } else if (this.st === 1) { this.left -= dt; if (this.left <= 0) { this.st = 2; this.left = 4.5; warnS(x, z, 'zonepoint'); } } else if (this.st === 2) { this.left -= dt; if (this.left <= 0) { this.st = 0; this.timer = rr(10, 15) / (this.sp || 1); this.owner = null; } } },
        arm(owner, auto) { if (this.st !== 0) return; this.st = 1; this.left = 1.0; this.owner = owner || null; warnS(x, z, 'warn'); },
        vis(t) { const on = this.st === 2; this.am.opacity = on ? 0.75 + Math.sin(t * 50) * 0.2 : this.st === 1 ? (Math.sin(t * 36) > 0 ? 0.4 : 0) : 0; this.arc.scale.y = on ? 0.6 + Math.sin(t * 60) * 0.2 : 0.2; this.om.emissiveIntensity = on ? 2.4 : this.st === 1 ? 1.4 : 0.3; this.strip.material.opacity = on ? 0.45 : this.st === 1 ? 0.3 : 0.12; if (on && Math.random() < 0.5 && NEAR(x, z, 3)) fx.sparks(x + rr(-1, 1) * ex + rr(-0.2, 0.2), 0.7, z + rr(-1, 1) * ez, 1, [0xffd23c, 0xffffff], { speed: 2, life: 0.2, size: 0.07 }); },
        hits(f) { if (this.st !== 2) return null; const dx = Math.abs(f.x - x) - ex, dz2 = Math.abs(f.z - z) - ez; const d = Math.hypot(Math.max(0, dx), Math.max(0, dz2)); return d < 0.62 ? 'zap' : null; },
        danger(px, pz) { if (this.st === 0 && this.timer > 2.5) return 0; const dx = Math.abs(px - x) - ex, dz2 = Math.abs(pz - z) - ez; return Math.hypot(Math.max(0, dx), Math.max(0, dz2)) < 1.0 ? 8 : 0; },
        linkRing(c) { const r = this.add(G.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), x, 0.03, z, 0.7, 1, 0.7); r.rotation.x = -Math.PI / 2; }, add: (...a) => this.add(...a), sp: this.speed };
      { const hg = new THREE.Group(); hg.position.set(x, 0, z); this.root.add(hg); this.hazard(tr, hg, vert ? 0.9 : half * 2 + 0.9, vert ? half * 2 + 0.9 : 0.9, { kind: 'bolt', bs: 0.8, th: 0.26, lvl: () => tr.st }); }
      tr.owner = null; out.push(this.reg(tr));
    }); return out;
  }
  mk_boulder(layout, o) {
    if (this.groups.boulder) return null;
    // lanes: rows of cells with the fewest solids
    const g = this.g; const rows = []; for (let j = 2; j < AH - 2; j++) { let n = 0; for (let i = 0; i < AW; i++) if (g.sol[idx(i, j)] || g.layout.t[idx(i, j)] === T.LAVA) n++; rows.push([j, n]); }
    rows.sort((a, b) => a[1] - b[1]); const lanes = []; const nl = AH >= 20 ? 3 : AH >= 16 ? 2 : 1;
    for (const [j] of rows) { const z = cz(j); if (lanes.every((l) => Math.abs(l - z) > 3.2) && Math.abs(z) > 0.5) { lanes.push(z); if (lanes.length >= nl) break; } }
    const out = [];
    lanes.forEach((z, n) => {
      const dir = n % 2 ? -1 : 1; const x0 = -dir * (HX - 0.2);
      const lm = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false }); const lane = this.add(G.box, lm, 0, 0.022, z, HX * 2, 0.01, 1.8);
      const body = new THREE.Group(); body.visible = false; this.root.add(body); const rock = this.add(G.ico, this.mat(0x8a7a6a), 0, 0.9, 0, 0.95, 0.95, 0.95, body); const pat = this.add(G.ico, this.mat(0x5a4e44), 0.2, 1.1, 0.5, 0.45, 0.45, 0.45, body);
      const lp = this.lamp(x0 - dir * 0.4, z - 1.2, 1.1);
      const tr = { type: 'boulder', x: 0, z, dir, x0, lane, lm, body, rock, bx: x0, st: 0, left: rr(7, 11) / this.speed, lp, rot: 0,
        update(dt, T) { if (this.st === 0) { this.left -= dt; if (this.left <= 0) this.arm(null); } else if (this.st === 1) { this.left -= dt; if (this.left <= 0) { this.st = 2; this.bx = this.x0; this.bodyOn = true; } } else { const sp = 9 * (this.sp || 1); this.bx += this.dir * sp * dt; this.rot += dt * sp / 0.95;
          const gg = this.gref; for (let j2 = cj(z - 0.8); j2 <= cj(z + 0.8); j2++) { const i2 = ci(this.bx + this.dir * 0.9); if (!inb(i2, j2)) continue; const k = idx(i2, j2); if (gg.crateHp[k] > 0) gg.breakCrate(k); else if (gg.sol[k]) { this.end(true); return; } }
          if (Math.abs(this.bx) > HX + 1.5) this.end(false); } },
        arm(owner) { if (this.st !== 0) return; this.st = 1; this.left = 1.7; this.owner = owner || null; warnS(this.x0, z, 'rumble'); shake(0.12); },
        end(crash) { if (crash) { fx.burst(this.bx, 0.6, z, 16, [0x8a7a6a, 0x5a4e44], { speed: 5, up: 4, size: 0.2 }); shake(0.3); if (NEAR(this.bx, z, 3)) sfx('explode'); } this.st = 0; this.left = rr(9, 14) / (this.sp || 1); this.bodyOn = false; this.owner = null; },
        vis(t) { this.lm.opacity = this.st === 1 ? 0.18 + Math.abs(Math.sin(t * 14)) * 0.22 : this.st === 2 ? 0.1 : 0; this.body.visible = !!this.bodyOn && this.st === 2; this.body.position.set(this.bx, 0, z); this.rock.rotation.set(0, 0, -this.dir * this.rot); lp.set(this.st === 1, this.st === 1); if (this.st === 2 && Math.random() < 0.5) fx.puff(this.bx - this.dir * 0.6, 0.2, z + rr(-0.5, 0.5), 1, 0xcfc0a0, 0.25); },
        hits(f) { return this.st === 2 && Math.hypot(f.x - this.bx, f.z - z) < 1.15 ? 'boulder' : null; },
        danger(px, pz) { if (this.st === 0 && this.left > 3) return 0; return Math.abs(pz - z) < 1.35 && (this.st !== 2 || (px - this.bx) * this.dir > -0.6) ? 8 : 0; },
        linkRing(c) { const r = this.add(G.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), x0 - dir * 0.4, 0.03, z, 0.7, 1, 0.7); r.rotation.x = -Math.PI / 2; }, add: (...a) => this.add(...a), sp: this.speed, gref: this.g };
      { const hg = new THREE.Group(); hg.position.set(0, 0, z); this.root.add(hg); this.hazard(tr, hg, HX * 2 - 0.6, 1.9, { kind: 'skull', bs: 1.2, bx: x0 + dir * 1.1, th: 0.27, lvl: () => tr.st }); }
      tr.kdir = () => [tr.dir, 0]; out.push(this.reg(tr));
    }); return out;
  }
  mk_crusher(layout, o) {
    const ps = this.spots(layout, 2.2, { snap: 'cell', min: 2.5, edge: 2.6 }); if (!ps) return null; const out = []; const h = 1.5;
    ps.forEach(([x, z], n) => {
      const sh = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false }); const shadow = this.add(G.box, sh, x, 0.024, z, h * 2, 0.01, h * 2);
      const edge = this.add(G.ring, new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), x, 0.03, z, h * 1.45, 1, h * 1.45); edge.rotation.x = -Math.PI / 2;
      const plate = new THREE.Group(); plate.position.set(x, 11, z); this.root.add(plate); this.add(G.box, this.mat(0x4a4e60), 0, 0.2, 0, h * 2, 0.4, h * 2, plate); this.add(G.box, this.mat(0xffc02a, 0.5), 0, 0.42, 0, h * 2.02, 0.06, 0.4, plate);
      const sp = this.mat(0xd9dfef); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.add(G.cone, sp, a * 0.95, -0.35, b * 0.95, 0.3, 0.7, 0.3, plate); c.rotation.x = Math.PI; }
      const lp = this.lamp(x - h - 0.4, z - h - 0.4, 0.8);
      const tr = { type: 'crusher', x, z, h, shadow, sh, edge, plate, lp, st: 0, ph: n * 3 + rr(0, 2), left: rr(5, 9) / this.speed, py: 11, hold: 0, owner: null, sp: this.speed,
        update(dt) { if (this.st === 0) { this.left -= dt; if (this.left <= 0) this.arm(null); } else if (this.st === 1) { this.left -= dt; this.py += (4.5 - this.py) * Math.min(1, dt * 3); if (this.left <= 0) { this.st = 2; this.hold = 0.9; this.py = 0.1; warnS(x, z, 'explode'); shake(0.45); fx.puff(x, 0.3, z, 14, 0xffffff, 0.6); fx.shockwave(x, z, 0xffb060, 4); this.landed = true; } } else if (this.st === 2) { this.hold -= dt; if (this.hold <= 0) { this.st = 3; this.landed = false; } } else { this.py += dt * 7; if (this.py >= 11) { this.py = 11; this.st = 0; this.left = rr(9, 14) / this.sp; this.owner = null; } } },
        arm(owner) { if (this.st !== 0) return; this.st = 1; this.left = 1.4; this.py = 11; this.owner = owner || null; warnS(x, z, 'warn'); },
        vis(t) { this.plate.position.y = this.py; this.sh.opacity = this.st === 1 ? 0.18 + (1.4 - this.left) * 0.2 + Math.abs(Math.sin(t * 18)) * 0.1 : this.st === 2 ? 0.45 : 0; this.edge.material.opacity = this.st === 1 ? 0.6 : 0; lp.set(this.st === 1, this.st === 1); },
        hits(f) { return this.st === 2 && this.landed !== undefined && Math.abs(f.x - x) < h + 0.15 && Math.abs(f.z - z) < h + 0.15 ? 'crush' : null; },
        danger(px, pz) { if (this.st === 0 && this.left > 3.2) return 0; return Math.abs(px - x) < h + 0.5 && Math.abs(pz - z) < h + 0.5 ? (this.st === 0 ? 4 : 8) : 0; },
        linkRing(c) { const r = this.add(G.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), x, 0.04, z, 0.8, 1, 0.8); r.rotation.x = -Math.PI / 2; }, add: (...a) => this.add(...a) };
      { const hg = new THREE.Group(); hg.position.set(x, 0, z); this.root.add(hg); this.hazard(tr, hg, h * 2 + 0.5, h * 2 + 0.5, { kind: 'skull', bs: 1.7, th: 0.34, lvl: () => (tr.st === 1 ? 1 : tr.st === 2 ? 2 : 0) }); }
      out.push(this.reg(tr));
    }); return out;
  }
  mk_switch(layout, o) {
    const ps = this.spots(layout === 'c' ? 'c' : 'r2', 0.8, { min: 3, edge: 1.8 }); if (!ps) return null; const cols = [0xffd23c, 0xffffff, 0xffa030]; const color = cols[this.sw.length % 3];
    ps.forEach(([x, z], n) => {
      const base = this.add(G.cyl, this.mat(0x2a2d3a), x, 0.18, z, 0.6, 0.36); const bm = this.mat(color, 1.2); const cap = this.add(G.cyl, bm, x, 0.42, z, 0.4, 0.14);
      const ring = this.add(G.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }), x, 0.03, z, 0.9, 1, 0.9); ring.rotation.x = -Math.PI / 2;
      this.sw.push({ x, z, link: o.link, color, cap, bm, ring, cd: 0, targets: [] });
    }); return [];
  }
  // ---------- runtime
  all() { return this.list; }
  tickSwitches(dt) {
    const g = this.g;
    for (const s of this.sw) {
      s.cd -= dt; if (s.cd > 0 || !s.targets.length) continue;
      let by = null; for (const b of g.booms) if (b.alive && Math.hypot(b.x - s.x, b.z - s.z) < 0.75) { by = b.owner; break; }
      if (!by) for (const f of g.fighters) if (f.alive && !f.show && f.airT <= 0 && Math.hypot(f.x - s.x, f.z - s.z) < 0.6) { by = f; break; }
      if (by) { s.cd = 9; this.fire(s, by); }
    }
  }
  fire(s, by) {
    sfx('zone'); fx.ring(s.x, 0.3, s.z, s.color, 2.6, 0.4); fx.sparks(s.x, 0.5, s.z, 10, [s.color, 0xffffff], { speed: 4, life: 0.4 }); fx.popup('SWITCH!', s.x, s.z, 'pop-cyan');
    for (const t of s.targets) if (t.arm) t.arm(by);
    this.g.onEvent('switch', { f: by });
  }
  update(dt) {
    if (!this.on) return; const g = this.g;
    if (g.state === 'play') { this.t += dt; this.T = this.t; }
    for (const t of this.list) t.g_T = this.t;
    if (g.state === 'play') {
      for (const t of this.list) t.update(dt, this.t);
      this.tickSwitches(dt);
      for (const f of g.fighters) {
        if (!f.alive || f.show || f.boss || f.inv > 0 || f.dashT > 0 || f.airT > 0) continue;
        for (const t of this.list) { const k = t.hits(f); if (k) { this.kill(f, k, t); break; } }
      }
    }
  }
  kill(f, kind, t) {
    const g = this.g; const o = t.owner || null; let d = t.kdir ? t.kdir() : [f.x - t.x, f.z - t.z];
    const killer = o && o !== f && o.team !== f.team && o.alive !== undefined ? o : null; const died = f.die(killer, kind, d[0], d[1]); if (died && killer) { killer.kos++; g.gainUlt && g.gainUlt(killer, 25); }
  }
  danger(x, z) { if (!this.on) return 0; let m = 0; for (const t of this.list) { const d = t.danger(x, z); if (d > m) { m = d; if (m >= 8) break; } } return m; }
  fighterTick(f, dt) {
    if (!this.on) return; f.gooT = Math.max(0, (f.gooT || 0) - dt); f.iceT = Math.max(0, (f.iceT || 0) - dt); f.tpCd = (f.tpCd || 0) - dt;
    if (f.airT > 0) { f.airT -= dt; f.ex += f.hopV[0]; f.ez += f.hopV[1]; f.hopY = Math.sin(Math.PI * (1 - Math.max(0, f.airT) / f.airMax)) * 1.5; if (f.airT <= 0) { f.hopY = 0; fx.puff(f.x, 0.1, f.z, 4, 0xffffff, 0.25); } } else f.hopY = 0;
    if (!f.alive) return;
    for (const t of this.list) if (t.fighter) t.fighter(f, dt, this.g);
  }
  bumpBoom(b) { if (!this.on) return false; for (const t of this.list) if (t.boom && t.boom(b)) return true; return false; }
  onIce(f) { return f.iceT > 0; }
  vis(dt) {
    if (!this.on) return; const t = this.g.time;
    for (const tr of this.list) { tr.vis(t); if (tr.haz) this.hazVis(tr, t); }
    for (const s of this.sw) { const r = s.cd > 0 ? 0.25 : 1; s.bm.emissiveIntensity = s.cd > 0 ? 0.15 : 1.0 + Math.sin(t * 5) * 0.4; s.cap.position.y = s.cd > 0 ? 0.36 : 0.43; s.ring.material.opacity = s.cd > 0 ? 0.25 : 0.55 + Math.sin(t * 5) * 0.3; }
  }
  describe() { const names = new Set(this.list.map((t) => t.type)); if (this.sw.length) names.add('switch'); return [...names].map((n) => TRAP_INFO[n]).filter(Boolean); }
  dispose() { this.scene.remove(this.root); this.mats.forEach((m) => m.dispose()); this.root.traverse((o) => { if (o.material && o.material.dispose && !this.mats.includes(o.material)) o.material.dispose(); }); this.list.length = 0; }
}
export { RACE_SET };
