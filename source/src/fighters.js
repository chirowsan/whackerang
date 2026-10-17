import { THREE, gfx, toon, glowMat, mesh, mergeToon } from './gfx.js';
import { faceInstanceTexture, setFrame } from './faces.js';

const G = {};
const geo = (k, f) => G[k] || (G[k] = f());
export const SPH = (r, w = 18, h = 12) => geo('s' + r + w + h, () => new THREE.SphereGeometry(r, w, h));
export const BOX = (x, y, z) => geo('b' + x + y + z, () => new THREE.BoxGeometry(x, y, z));
export const CYL = (a, b, h, s = 14) => geo('c' + a + b + h + s, () => new THREE.CylinderGeometry(a, b, h, s));
export const CONE = (r, h, s = 10) => geo('n' + r + h + s, () => new THREE.ConeGeometry(r, h, s));
export const CAP = (r, l, a = 4, b = 12) => geo('p' + r + l + a + b, () => new THREE.CapsuleGeometry(r, l, a, b));
export const TOR = (r, t, a = 8, b = 20, arc = Math.PI * 2) => geo('t' + r + t + a + b + arc, () => new THREE.TorusGeometry(r, t, a, b, arc));
export const DOME = (r, w = 18, h = 8) => geo('d' + r + w + h, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2));
export const RBOX = (w, h, d, r = 0.06) => geo('r' + w + h + d + r, () => {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4); const p = g.attributes.position, n = g.attributes.normal; const v = new THREE.Vector3(), c = new THREE.Vector3(), hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z))); v.sub(c).normalize(); p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
});
const OL = 0.03;
const MC = {}; const mat = (c) => MC[c] || (MC[c] = toon(c));
const INK = 0x1a1530;

// shared build helpers
export function makeCtx(root, body) {
  const S = new THREE.Group(); body.add(S); const fin = [S];
  const mk = (parent, g, col, o = {}) => mesh(g, mat(col), parent || S, { outline: OL, grp: 'hero', cast: true, ...o });
  const grp = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent || body).add(g); fin.push(g); return g; };
  const glow = (parent, g, col, i = 1.2, o = {}) => mesh(g, glowMat(col, i), parent, { cast: false, ...o });
  return { S, mk, grp, glow, fin, root, body };
}

// ----- hero specs: each returns { head, hatY, hs, shades, feet, arms, update } -----
const SPECS = {
  panda(c) {
    const { S, mk, grp } = c; const W = 0xf6f2e8, B = 0x2b2b3a;
    mk(S, SPH(0.43, 24, 16), W, { pos: [0, 0.42, 0], scale: [1.1, 0.88, 1.06] });                                                         // big round belly
    mk(S, TOR(0.27, 0.05, 6, 20), 0xe8503a, { pos: [0, 0.66, 0.06], rot: [Math.PI / 2 - 0.35, 0, 0], outline: 0.02 });                     // neckerchief
    mk(S, CONE(0.1, 0.17, 4), 0xe8503a, { pos: [0, 0.54, 0.27], rot: [Math.PI + 0.25, Math.PI / 4, 0], outline: 0.015 });
    for (const y of [0.4, 0.27]) mk(S, SPH(0.032, 8, 6), B, { pos: [0, y, 0.455 - (0.4 - y) * 0.1], outline: 0, cast: false });              // chef buttons
    mk(S, SPH(0.34, 22, 16), W, { pos: [0, 0.9, 0], scale: [1.18, 0.95, 1.0] });                                                          // head
    const ears = [-1, 1].map((s) => { const e = grp(s * 0.32, 1.12, -0.03); mk(e, SPH(0.12, 12, 8), B, { pos: [s * 0.02, 0.05, 0], scale: [1, 1, 0.75] }); return e; });
    const toque = grp(0, 1.16, 0); mk(toque, CYL(0.22, 0.2, 0.16, 16), 0xffffff, { pos: [0, 0.04, 0] }); for (const [x, y, z, r] of [[0, 0.3, 0, 0.2], [-0.15, 0.25, 0.02, 0.15], [0.15, 0.25, 0.02, 0.15], [0, 0.28, -0.12, 0.14]]) mk(toque, SPH(r, 14, 10), 0xfefefe, { pos: [x, y, z] });
    return { head: { y: 0.9, rx: 0.401, ry: 0.323, rz: 0.34, fw: 1.9, fh: 1.35, tc: 1.62 }, hatY: 1.56, hs: 1.05, shades: { y: 0.91, z: 0.355, x: 0.14 },
      arm: { x: 0.46, y: 0.5, z: 0.06, r: 0.13, col: B }, foot: { col: B, r: 0.12, x: 0.2 }, ears, ear: { rest: [0, 0, 0] },
      update(m, t, st, q) { toque.rotation.z = Math.sin(t * 3) * 0.04 + Math.sin(t * 14) * 0.09 * st.move; toque.position.y = 1.16 + Math.abs(Math.sin(t * 14)) * 0.02 * st.move; if (q > 0) { m.armL.rotation.set(-0.9 + Math.sin(q * 40) * 0.15, 0, -0.6); m.body.scale.y *= 1 + Math.sin(q * 40) * 0.02; toque.rotation.z += Math.sin(q * 20) * 0.1; } } };
  },
  fox(c) {
    const { S, mk, grp } = c; const O = 0xff8a2e, D = 0x2a2a3c, R = 0xd8283c;
    mk(S, SPH(0.27, 18, 14), O, { pos: [0, 0.74, 0], scale: [1, 1.05, 0.88] }); mk(S, SPH(0.22, 16, 12), O, { pos: [0, 0.44, 0], scale: [1, 1.0, 0.95] }); for (const s of [-1, 1]) mk(S, CAP(0.075, 0.1, 4, 8), D, { pos: [s * 0.11, 0.19, 0.02] });
    mk(S, SPH(0.2, 12, 10), 0xfff4e6, { pos: [0, 0.74, 0.14], scale: [0.8, 1.1, 0.5], outline: 0 });
    mk(S, TOR(0.255, 0.05, 6, 18), D, { pos: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    mk(S, BOX(0.09, 0.09, 0.03), 0xe6eaf2, { pos: [0, 0.4, 0.26], outline: 0, cast: false });
    mk(S, SPH(0.33, 22, 16), O, { pos: [0, 1.2, 0], scale: [1.15, 0.92, 1.0] });
    for (const s of [-1, 1]) mk(S, SPH(0.1, 10, 8), 0xfff4e6, { pos: [s * 0.33, 1.13, 0.07], scale: [0.8, 0.9, 1.1], outline: 0 });
    mk(S, SPH(0.036, 8, 6), D, { pos: [0, 1.15, 0.34], outline: 0, cast: false });
    mk(S, TOR(0.345, 0.04, 6, 24), D, { pos: [0, 1.35, -0.01], rot: [Math.PI / 2 - 0.12, 0, 0], outline: 0.02 });
    mk(S, BOX(0.15, 0.08, 0.025), 0xdfe6f2, { pos: [0, 1.33, 0.335], rot: [-0.12, 0, 0], outline: 0, cast: false });
    mk(S, TOR(0.2, 0.05, 6, 16), R, { pos: [0, 0.97, 0.0], rot: [Math.PI / 2 + 0.2, 0, 0], outline: 0.02 });
    const ears = [-1, 1].map((s) => { const e = grp(s * 0.22, 1.42, -0.02); mk(e, CONE(0.12, 0.38, 4), O, { pos: [0, 0.18, 0], rot: [0, 0.78, -s * 0.12], scale: [1, 1, 0.7] }); mk(e, CONE(0.065, 0.2, 4), 0xff9fb0, { pos: [0, 0.14, 0.04], rot: [0, 0.78, -s * 0.12], scale: [1, 1, 0.5], outline: 0, cast: false }); return e; });
    const scarf = grp(0, 0.93, -0.2); mk(scarf, BOX(0.12, 0.05, 0.5), R, { pos: [-0.05, 0, -0.25], rot: [0.15, 0.12, 0], outline: 0.02 }); mk(scarf, BOX(0.12, 0.05, 0.38), 0xb01c30, { pos: [0.07, -0.02, -0.2], rot: [0.35, -0.15, 0], outline: 0.02 });
    const tail = grp(0, 0.34, -0.2); mk(tail, SPH(0.17, 14, 10), O, { pos: [0, 0.1, -0.2], scale: [1, 1, 1.6] }); mk(tail, SPH(0.12, 12, 8), 0xfff4e6, { pos: [0, 0.2, -0.5], scale: [1, 1, 1.1] });
    return { head: { y: 1.2, rx: 0.38, ry: 0.304, rz: 0.33, fw: 1.85, fh: 1.3, tc: 1.62 }, hatY: 1.58, hs: 0.95, shades: { y: 1.19, z: 0.335, x: 0.145 },
      arm: { x: 0.31, y: 0.78, z: 0.04, r: 0.095, col: D }, foot: { col: D, r: 0.1 }, ears, tail, scarf,
      update(m, t, st, q) { tail.rotation.set(0.35 + Math.sin(t * 5) * 0.12 + st.move * 0.3, Math.sin(t * 2.3) * 0.28 + Math.sin(t * 9) * 0.1 * st.move + (q > 0 ? Math.sin(q * 25) * 0.7 : 0), 0); scarf.rotation.x = -0.1 - st.move * 0.5 - (st.dash > 0 ? 0.6 : 0) + Math.sin(t * 7) * 0.08; scarf.rotation.y = Math.sin(t * 3.5) * 0.12; if (q > 0) { ears.forEach((e, i) => { e.rotation.x = Math.sin(q * 30 + i * 2) * 0.35; }); } } };
  },
  robot(c) {
    const { S, mk, grp, glow } = c; const BL = 0x59c2ff, SIL = 0xdbe6f2, OR = 0xffb02e, GR = 0x8fa0b4;
    mk(S, RBOX(0.5, 0.34, 0.4, 0.09), BL, { pos: [0, 0.3, 0] });
    mk(S, RBOX(0.26, 0.07, 0.04, 0.02), OR, { pos: [0, 0.3, 0.2], outline: 0, cast: false });
    mk(S, CYL(0.07, 0.09, 0.07, 10), GR, { pos: [0, 0.5, 0], outline: 0 });
    mk(S, RBOX(0.74, 0.52, 0.54, 0.15), SIL, { pos: [0, 0.78, 0] });
    for (const s of [-1, 1]) { mk(S, CYL(0.075, 0.075, 0.1, 10), OR, { pos: [s * 0.39, 0.78, 0], rot: [0, 0, Math.PI / 2], outline: 0.02 }); }
    mk(S, CYL(0.012, 0.012, 0.2, 6), GR, { pos: [0, 1.12, 0], outline: 0, cast: false });
    const ant = grp(0, 1.22, 0); const bulb = glow(ant, SPH(0.065, 10, 8), OR, 1.6, { pos: [0, 0.03, 0] });
    for (const s of [-1, 1]) { const w = grp(s * 0.16, 0.09, 0.02); mk(w, CYL(0.1, 0.1, 0.13, 12), 0x39465a, { rot: [0, 0, Math.PI / 2], outline: 0.02 }); w.userData.wheel = 1; }
    return { head: { plane: true, y: 0.78, z: 0.275, w: 0.64, h: 0.51 }, hatY: 1.08, hs: 0.85, shades: { y: 0.81, z: 0.29, x: 0.124 }, ant, bulb,
      arm: { x: 0.33, y: 0.33, z: 0.02, r: 0.075, col: GR }, noFeet: true,
      update(m, t, st, q) { ant.rotation.z = Math.sin(t * 5) * 0.14 + Math.sin(t * 15) * 0.18 * st.move; ant.rotation.x = Math.sin(t * 4.1) * 0.08 - st.move * 0.15; bulb.scale.setScalar(1 + Math.sin(t * 6) * 0.18 + (st.charge || 0) * 0.5); if (q > 0) { m.body.position.y += Math.abs(Math.sin(q * 18)) * 0.06; m.armR.rotation.set(-2.4 + Math.sin(q * 30) * 0.35, 0, -0.5); } } };
  },
  pirate(c) {
    const { S, mk, grp } = c; const FUR = 0x7d8fc4, SH = 0xf0ece0, NV = 0x2a3a66, BK = 0x181422;
    mk(S, SPH(0.36, 20, 14), SH, { pos: [0, 0.42, 0], scale: [1.05, 1, 1] });
    for (const y of [0.3, 0.44, 0.58]) { const dy = y - 0.42, r = Math.sqrt(0.36 * 0.36 - dy * dy) * 1.05; mk(S, TOR(r + 0.004, 0.028, 6, 22), NV, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], outline: 0, cast: false }); }
    mk(S, TOR(0.3, 0.05, 6, 20), 0x7a1f2a, { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    mk(S, SPH(0.33, 22, 16), FUR, { pos: [0, 0.98, 0], scale: [1.18, 0.95, 1.0] });
    
    mk(S, DOME(0.27, 16, 7), BK, { pos: [0, 1.2, 0], scale: [1.15, 1.1, 1.05] }); mk(S, SPH(0.5, 18, 8), BK, { pos: [0, 1.17, 0], scale: [1.0, 0.1, 0.62] });
    for (const s of [-1, 1]) mk(S, SPH(0.2, 12, 8), BK, { pos: [s * 0.42, 1.25, 0], scale: [1, 0.3, 0.8], rot: [0, 0, s * 0.45] });
    mk(S, TOR(0.285, 0.022, 6, 16), 0xe8b23a, { pos: [0, 1.2, 0.0], rot: [Math.PI / 2, 0, 0], outline: 0, cast: false });
    mk(S, SPH(0.062, 8, 6), 0xffffff, { pos: [0, 1.28, 0.27], scale: [1, 1, 0.5], outline: 0, cast: false }); for (const s of [-1, 1]) mk(S, SPH(0.016, 5, 4), BK, { pos: [s * 0.024, 1.285, 0.298], outline: 0, cast: false });
    mk(S, CAP(0.025, 0.2, 3, 6), 0xd8283c, { pos: [0.2, 1.4, 0.0], rot: [0, 0, -0.9], outline: 0, cast: false });
    const ears = [-1, 1].map((s) => { const e = grp(s * 0.34, 1.12, -0.04); mk(e, CONE(0.1, 0.22, 4), FUR, { pos: [s * 0.04, 0.08, 0], rot: [0, 0.78, -s * 0.8], scale: [1, 1, 0.7] }); return e; });
    const tail = grp(0, 0.28, -0.32); mk(tail, CAP(0.06, 0.28, 3, 8), FUR, { pos: [0, 0.1, -0.1], rot: [-1.0, 0, 0] }); mk(tail, SPH(0.075, 8, 6), 0xf0f2ff, { pos: [0, 0.34, -0.3] });
    return { head: { y: 0.98, rx: 0.39, ry: 0.314, rz: 0.33, fw: 1.9, fh: 1.32, tc: 1.68 }, hatY: 1.4, hs: 1.0, shades: { y: 0.975, z: 0.335, x: 0.14 },
      arm: { x: 0.4, y: 0.5, z: 0.04, r: 0.1, col: FUR, hookR: true }, foot: { col: NV, r: 0.11, peg: 1 }, ears, tail,
      update(m, t, st, q) { tail.rotation.set(Math.sin(t * 3) * 0.2 + st.move * 0.3, Math.sin(t * 2) * 0.35, 0); if (q > 0) { m.armR.rotation.set(-1.8, Math.sin(q * 20) * 0.5, -0.4); m.body.rotation.z += Math.sin(q * 16) * 0.05; } } };
  },
  monk(c) {
    const { S, mk, grp } = c; const GRN = 0x5fd16b, ORG = 0xff9a2e;
    mk(S, CYL(0.27, 0.4, 0.58, 18), ORG, { pos: [0, 0.34, 0] });
    mk(S, SPH(0.3, 16, 12), ORG, { pos: [0, 0.62, 0], scale: [1.05, 0.7, 0.9] });
    mk(S, TOR(0.395, 0.04, 6, 24), 0xb5342a, { pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    mk(S, TOR(0.32, 0.05, 6, 22), 0xb5342a, { pos: [0, 0.44, 0], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    mk(S, SPH(0.3, 22, 16), GRN, { pos: [0, 1.0, 0.0], scale: [0.95, 0.8, 1.3] });
    mk(S, CONE(0.05, 0.13, 6), 0xffd23c, { pos: [0, 1.25, 0.08], rot: [-0.3, 0, 0], outline: 0, cast: false }); mk(S, CONE(0.05, 0.12, 6), 0xffd23c, { pos: [0, 1.22, -0.07], rot: [-0.55, 0, 0], outline: 0, cast: false }); mk(S, CONE(0.045, 0.1, 6), 0xffd23c, { pos: [0, 1.17, -0.22], rot: [-0.8, 0, 0], outline: 0, cast: false });
    for (let i = 0; i < 5; i++) { const a = -0.95 + i * 0.475; mk(S, CONE(0.085, 0.36, 5), i % 2 ? 0xffd23c : ORG, { pos: [Math.sin(a) * 0.3, 1.08 + Math.cos(a * 1.4) * 0.07, -0.2 - Math.cos(a) * 0.08], rot: [-0.7, a * 0.8, -a * 0.9], outline: 0.02 }); }
    for (let i = 0; i < 9; i++) { const u = (i - 4) / 4.2; mk(S, SPH(i === 4 ? 0.05 : 0.036, 6, 5), i === 4 ? 0xffe08a : 0x8a5a2b, { pos: [u * 0.2, 0.7 - 0.1 * (1 - u * u), 0.285 - u * u * 0.04], outline: 0, cast: false }); }
    const tail = grp(0, 0.2, -0.46); mk(tail, SPH(0.15, 12, 9), GRN, { pos: [0, 0, 0] }); mk(tail, SPH(0.11, 10, 8), GRN, { pos: [0, 0.02, -0.18] }); mk(tail, SPH(0.075, 8, 6), GRN, { pos: [0.05, 0.06, -0.34] }); mk(tail, SPH(0.05, 8, 6), 0xffd23c, { pos: [0.1, 0.11, -0.45] });
    const tongue = grp(0, 0.93, 0.42); mk(tongue, CAP(0.014, 0.12, 2, 5), 0xff5a7a, { pos: [0, 0, 0.07], rot: [Math.PI / 2, 0, 0], outline: 0, cast: false }); tongue.visible = false;
    return { head: { y: 1.0, rx: 0.285, ry: 0.24, rz: 0.39, fw: 1.55, fh: 1.4, tc: 1.62 }, hatY: 1.28, hs: 0.8, shades: { y: 1.0, z: 0.385, x: 0.085 },
      arm: { x: 0.36, y: 0.6, z: 0.05, r: 0.115, col: ORG, hand: GRN }, foot: { col: GRN, r: 0.1 }, tail, tongue,
      update(m, t, st, q) { tail.rotation.set(0.05 + st.move * 0.2, Math.sin(t * 2.4) * 0.35 + Math.sin(t * 10) * 0.12 * st.move, 0); if (q > 0) { const k = Math.sin(q * Math.PI); m.body.position.y += k * 0.16; m.body.scale.y *= 1 + k * 0.02; m.armL.rotation.set(-1.0, 0.5, -0.9); m.armR.rotation.set(-1.0, -0.5, 0.9); } tongue.visible = (q > 0 && Math.sin(q * 45) > 0.55) || m.expr === 'happy' && Math.sin(t * 9) > 0.7; tongue.scale.z = 0.4 + Math.abs(Math.sin(t * 22)) * 1.1; } };
  },
  peng(c) {
    const { S, mk, grp } = c; const NV = 0x2b3a67, WH = 0xf4faff, RD = 0xb5342a, GD = 0xf0b83a;
    mk(S, CAP(0.3, 0.26, 6, 14), NV, { pos: [0, 0.5, -0.02], scale: [1.1, 1, 0.98] });
    mk(S, CAP(0.26, 0.2, 6, 14), WH, { pos: [0, 0.47, 0.1], scale: [1.0, 1, 0.7], outline: 0 });
    mk(S, TOR(0.32, 0.05, 6, 22), RD, { pos: [0, 0.37, 0.0], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    mk(S, SPH(0.3, 22, 16), NV, { pos: [0, 0.98, 0], scale: [1.15, 0.95, 1.0] });
    mk(S, CONE(0.07, 0.17, 8), 0xff9a2e, { pos: [0, 0.9, 0.33], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    mk(S, DOME(0.33, 20, 8), RD, { pos: [0, 1.02, -0.01], scale: [1.2, 0.95, 1.1] }); mk(S, TOR(0.385, 0.03, 6, 24), GD, { pos: [0, 1.03, 0], rot: [Math.PI / 2 - 0.05, 0, 0], outline: 0, cast: false });
    mk(S, BOX(0.5, 0.16, 0.04), RD, { pos: [0, 0.92, -0.32], rot: [0.3, 0, 0], outline: 0.02 });
    for (const s of [-1, 1]) mk(S, TOR(0.17, 0.028, 6, 14, Math.PI * 0.95), GD, { pos: [s * 0.14, 1.27, 0.1], rot: [0.3, 0, s * 0.5 + (s > 0 ? 0 : Math.PI)], outline: 0, cast: false });
    mk(S, CYL(0.03, 0.03, 0.6, 8), 0x2a2a3c, { pos: [0.33, 0.42, -0.14], rot: [1.15, 0.35, -0.9], outline: 0.015 }); mk(S, CYL(0.036, 0.036, 0.15, 8), 0xe8d9a8, { pos: [0.5, 0.58, 0.04], rot: [1.15, 0.35, -0.9], outline: 0, cast: false }); mk(S, CYL(0.07, 0.07, 0.025, 10), GD, { pos: [0.4, 0.5, -0.06], rot: [1.15, 0.35, -0.9], outline: 0, cast: false });
    return { head: { y: 0.98, rx: 0.345, ry: 0.285, rz: 0.3, fw: 1.9, fh: 1.35, tc: 1.62 }, hatY: 1.34, hs: 0.95, shades: { y: 0.98, z: 0.3, x: 0.108 },
      arm: { x: 0.37, y: 0.62, z: 0.0, flip: 1, col: NV }, foot: { col: 0xff9a2e, r: 0.12, wide: 1 },
      update(m, t, st, q) { m.body.rotation.z += Math.sin(t * 14) * 0.07 * st.move; if (q > 0) { const f = Math.sin(q * 36) * 0.5; m.armL.rotation.set(0, 0, 0.9 + f); m.armR.rotation.set(0, 0, -0.9 - f); m.body.position.y += Math.abs(Math.sin(q * 18)) * 0.05; } } };
  },
};

const SK = { bao: 'panda', nori: 'fox', tako: 'robot', kuma: 'pirate', pico: 'monk', yuki: 'peng' };
export const faceKey = (h) => SK[h.id] || 'panda';

export function buildFighterBody(h, teamColor) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const c = makeCtx(root, body); const kind = faceKey(h);
  const sp = SPECS[kind](c); const m = { root, body, hero: h, eyes: [], parts: {}, spec: sp, expr: 'neutral', blinkT: 2 + Math.random() * 3, blinkK: 0, qNext: 3 + Math.random() * 4, qT: 0, ears: sp.ears || [], tail: sp.tail };
  // arms
  const a = sp.arm; const arm = (s) => {
    const g = new THREE.Group(); g.position.set(s * a.x, a.y, a.z); body.add(g); c.fin.push(g);
    if (a.flip) { c.mk(g, CAP(0.075, 0.2, 4, 8), a.col, { pos: [s * 0.06, -0.14, 0], rot: [0, 0, s * 0.18], scale: [0.55, 1, 1.05] }); }
    else { c.mk(g, SPH(a.r, 12, 9), a.col, { pos: [s * 0.03, -0.06, 0] }); if (a.hand) c.mk(g, SPH(a.r * 0.7, 10, 8), a.hand, { pos: [s * 0.04, -0.17, 0.02] }); }
    if (a.hookR && s === 1) { c.mk(g, CAP(0.03, 0.12, 3, 6), 0xd0d6e0, { pos: [0.05, -0.17, 0.03], rot: [0.3, 0, 0], outline: 0.015 }); c.mk(g, TOR(0.065, 0.02, 6, 12, Math.PI * 1.3), 0xd0d6e0, { pos: [0.05, -0.27, 0.07], rot: [0, Math.PI / 2, 0.3], outline: 0.012 }); }
    return g;
  };
  m.armL = arm(-1); m.armR = arm(1);
  // feet (root level)
  const fg = (s) => { const g = new THREE.Group(); g.position.set(s * (sp.foot && sp.foot.x || 0.19), 0.1, 0.08); root.add(g); c.fin.push(g);
    if (sp.noFeet) { g.position.set(s * 0.16, 0.1, 0.0); c.mk(g, CYL(0.1, 0.1, 0.13, 12), 0x39465a, { rot: [0, 0, Math.PI / 2] }); return g; }
    const f = sp.foot; if (f.peg && s === 1) { c.mk(g, CYL(0.055, 0.075, 0.2, 8), 0x8a5a2b, { pos: [0, 0.0, 0] }); c.mk(g, CYL(0.07, 0.07, 0.025, 8), 0x2a1a10, { pos: [0, -0.1, 0], outline: 0, cast: false }); }
    else c.mk(g, SPH(f.r, 10, 8), f.col, { scale: f.wide ? [1.2, 0.5, 1.8] : [1, 0.7, 1.35] }); return g; };
  m.feet = [fg(-1), fg(1)];
  if (sp.noFeet) { m.feet.forEach((g, i) => { g.position.x = (i ? 1 : -1) * 0.17; }); }
  // face
  const hd = sp.head; const faceMat = new THREE.MeshBasicMaterial({ map: faceInstanceTexture(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  let face;
  if (hd.plane) face = new THREE.Mesh(geo('fp' + hd.w + hd.h, () => new THREE.PlaneGeometry(hd.w, hd.h)), faceMat), face.position.set(0, hd.y, hd.z);
  else { face = new THREE.Mesh(geo('fs' + hd.fw + hd.fh + hd.tc, () => new THREE.SphereGeometry(1, 28, 18, Math.PI / 2 - hd.fw / 2, hd.fw, hd.tc - hd.fh / 2, hd.fh)), faceMat); face.position.set(0, hd.y, 0); face.scale.set(hd.rx * 1.012, hd.ry * 1.012, hd.rz * 1.012); }
  face.renderOrder = 2; body.add(face); m.face = face; m.faceTex = faceMat.map;
  // team ring / shadow / etc. created by caller
  m.finish = () => { for (const g of c.fin) mergeToon(g, null, { cast: true, ol: true, grp: 'hero' }); };
  m.ctx = c; return m;
}

export function animateFighter(m, dt, st) {
  const { body } = m, sp = m.spec, t = st.t, mv = st.move;
  // ---- expression
  let ex = 'neutral';
  if (st.expr) ex = st.expr; else if (st.dead) ex = 'ko'; else if (st.win) ex = 'happy'; else if (st.hurt > 0) ex = 'scared'; else if (st.emote > 0) ex = 'happy'; else if (st.dash > 0 || st.deflect > 0 || st.throwT > 0.55) ex = 'shout'; else if (st.charge > 0.2) ex = 'angry'; else if (st.scared > 0) ex = 'scared'; else if (st.happy > 0) ex = 'happy';
  m.blinkT -= dt; if (m.blinkT < -0.13) m.blinkT = 2 + Math.random() * 3.5;
  if (ex === 'neutral') { if (m.blinkT < 0) ex = 'blink'; else if (m.qT > 0 && mv < 0.1) ex = 'smug'; }
  if (ex !== m.expr) { m.expr = ex; setFrame(m.faceTex, ex); }
  // ---- idle personality quirks
  if (m.qT > 0) { m.qT -= dt; if (mv > 0.25 || st.dead || st.win || st.charge > 0) m.qT = 0; } else if (mv < 0.1 && !st.dead && !st.win && !(st.charge > 0)) { m.qNext -= dt; if (m.qNext <= 0) { m.qT = 1.3; m.qNext = 5 + Math.random() * 5; } }
  const q = m.qT > 0 ? 1 - m.qT / 1.3 : 0;
  // ---- squash & stretch
  const breath = Math.sin(t * 2.4), run = Math.sin(t * 14), cs = Math.cos(t * 28);
  let sx = 1 - breath * 0.012, sy = 1 + breath * 0.025, sz = sx;
  sy += cs * 0.045 * mv; sx -= cs * 0.03 * mv; sz -= cs * 0.03 * mv;
  let py = Math.abs(run) * 0.06 * mv + (st.air || 0); let rx = 0.1 * mv, rz = run * 0.07 * mv; let ry = 0;
  const ch = st.charge || 0; sy -= ch * 0.14; sx += ch * 0.08; sz += ch * 0.08; rx -= ch * 0.12;
  const th = st.throwT > 0 ? st.throwT : 0; if (th > 0 && !st.dead) { const k = Math.sin(Math.min(1, th) * Math.PI); sy += k * 0.16; sx -= k * 0.08; sz -= k * 0.08; rx += k * 0.2; }
  if (st.catchPop > 0) { const k = st.catchPop / 0.2; sy -= k * 0.14; sx += k * 0.12; sz += k * 0.12; }
  if (st.dash > 0) { sx = 0.86; sy = 0.78; sz = 1.32; rx = 0.9 * st.dash; py += 0.1; }
  // v3.2: hurt flinch (lean back, jitter) and emote dance (hop + sway)
  if (st.hurt > 0 && !st.dead) { const k = Math.min(1, st.hurt); rx -= k * 0.5; sy -= k * 0.14; sx += k * 0.1; sz += k * 0.1; rz += Math.sin(t * 55) * 0.14 * k; }
  if (st.emote > 0 && !st.dead && !st.win) { const hop = Math.abs(Math.sin(t * 8)); py += hop * 0.18; ry = Math.sin(t * 5) * 0.5; rz += Math.sin(t * 8) * 0.1; sy += (hop - 0.5) * 0.1; }
  const armsUp = st.win || (st.emote > 0 && !st.dead);
  if (st.win) { const hop = Math.abs(Math.sin(t * 6.5)); py += hop * 0.22; const land = 1 - hop; sy += (hop - 0.5) * 0.12 + 0.0; sx -= (hop - 0.5) * 0.08; sz = sx; ry = Math.sin(t * 3.2) * 0.45; rz = Math.sin(t * 6.5) * 0.08; rx = -0.05; }
  body.position.y = py;
  if (st.dead) { // funny spin-out: wobble squash, game drives the spin
    const w = Math.sin(t * 22); body.scale.set(1 + w * 0.12, 1 - w * 0.12, 1 + w * 0.12); body.position.y = 0;
  } else { body.rotation.set(rx, ry, rz); body.scale.set(sx, sy, sz); }
  // ---- feet
  const sw = run * 0.12 * mv; if (!sp.noFeet) { m.feet[0].position.z = 0.08 + sw; m.feet[1].position.z = 0.08 - sw; m.feet[0].position.y = 0.1 + Math.max(0, -run) * 0.05 * mv; m.feet[1].position.y = 0.1 + Math.max(0, run) * 0.05 * mv; if (st.win) { m.feet[0].position.y = m.feet[1].position.y = 0.1; } }
  else { m.feet[0].rotation.x = m.feet[1].rotation.x = t * 14 * mv; m.feet[0].position.z = m.feet[1].position.z = 0; }
  // ---- arms
  m.armR.rotation.set(-ch * 1.6 - th * 3.2, 0, -0.35 - ch * 0.5); m.armL.rotation.set(run * 0.5 * mv, 0, 0.35);
  if (st.deflect > 0) { m.armL.rotation.set(-1.4, 0, 0.1); m.armR.rotation.set(-1.4, 0, -0.1); }
  if (armsUp) { const w = Math.sin(t * (st.win ? 13 : 16)) * 0.25; m.armL.rotation.set(-2.7 + w, 0, 0.5); m.armR.rotation.set(-2.7 - w, 0, -0.5); }
  if (st.dead) { m.armL.rotation.set(Math.sin(t * 25) * 1.3 - 1.5, 0, 1.0); m.armR.rotation.set(Math.cos(t * 25) * 1.3 - 1.5, 0, -1.0); }
  // ---- ears: wiggle
  m.ears.forEach((e, i) => { const s = i ? 1 : -1; e.rotation.set(-0.3 * mv + Math.sin(t * 3 + i * 1.7) * 0.03 + (st.dead ? Math.sin(t * 20) * 0.4 : 0) + (ex === 'happy' ? Math.sin(t * 16 + i) * 0.18 : 0) + (ex === 'angry' ? -0.2 : 0) + (ex === 'scared' ? 0.35 : 0), 0, Math.sin(t * 2.2 + i * 2.3) * 0.05 + s * (ex === 'scared' ? -0.3 : 0)); });
  sp.update(m, t, st, q);
  if (m.stars) { m.stars.visible = !!st.dead; if (st.dead) m.stars.rotation.y = t * 9; }
}
