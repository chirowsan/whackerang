import { THREE, gfx, toon, glowMat, basic, mesh, glowSprite } from './gfx.js';
import { POWERUPS } from './data.js';

const G = {};
const geo = (k, f) => G[k] || (G[k] = f());
const SPH = (r, w = 20, h = 14) => geo('s' + r + w + h, () => new THREE.SphereGeometry(r, w, h));
const BOX = (x, y, z) => geo('b' + x + y + z, () => new THREE.BoxGeometry(x, y, z));
const CYL = (a, b, h, s = 16) => geo('c' + a + b + h + s, () => new THREE.CylinderGeometry(a, b, h, s));
const CONE = (r, h, s = 12) => geo('n' + r + h + s, () => new THREE.ConeGeometry(r, h, s));
const CAP = (r, l, a = 4, b = 12) => geo('p' + r + l + a + b, () => new THREE.CapsuleGeometry(r, l, a, b));
const TOR = (r, t, a = 8, b = 20) => geo('t' + r + t + a + b, () => new THREE.TorusGeometry(r, t, a, b));
const OL = 0.03;
const WHITE = () => geo('wm', () => toon(0xffffff));
const DARK = () => geo('dm', () => toon(0x1a1530));
const mat = (c) => geo('m' + c, () => toon(c));

function eye(parent, x, y, z, s = 1) {
  const e = new THREE.Group(); e.position.set(x, y, z); parent.add(e);
  mesh(SPH(0.095 * s, 12, 10), WHITE(), e, { cast: false });
  const p = mesh(SPH(0.058 * s, 10, 8), DARK(), e, { pos: [0, -0.005, 0.055 * s], cast: false });
  const sh = mesh(SPH(0.02 * s, 6, 5), basic(0xffffff), p, { pos: [0.02, 0.025, 0.04], cast: false });
  e.userData.pupil = p; return e;
}

// returns { root, body, update(dt, st), ... }; local +z is forward.
export function buildFighter(h, hat = 'none', teamColor = 0xffffff) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const m = { root, body, hero: h, eyes: [], parts: {} };
  const main = mat(h.color), acc = mat(h.accent), belly = mat(0xffffff);
  const g = 'hero';
  const O = (extra) => ({ outline: OL, grp: g, ...extra });
  // feet
  const foot = (x) => { const f = mesh(SPH(0.11, 10, 8), acc, root, O({ pos: [x, 0.1, 0.08], scale: [1, 0.7, 1.35] })); return f; };
  m.feet = [foot(-0.19), foot(0.19)];
  let headY = 1.0, eyeY = 0.58, eyeZ = 0.36, eyeX = 0.17, es = 1.0;
  switch (h.shape) {
    case 'bun': {
      mesh(SPH(0.43, 26, 18), main, body, O({ pos: [0, 0.52, 0], scale: [1.08, 0.92, 1.0] }));
      for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; mesh(CAP(0.03, 0.26, 3, 6), mat(0xf0c07a), body, { pos: [Math.sin(a) * 0.3, 0.86, Math.cos(a) * 0.3 - 0.02], rot: [0.5, a, 0], cast: false }); }
      const leaf = mesh(SPH(0.2, 12, 8), acc, body, O({ pos: [0.05, 0.98, 0.0], scale: [1.4, 0.35, 0.9], rot: [0, 0, 0.35] })); m.parts.leaf = leaf;
      headY = 1.0; eyeY = 0.56; eyeZ = 0.4; eyeX = 0.17;
      mesh(SPH(0.05, 8, 6), mat(0xff9a9a), body, { pos: [-0.28, 0.45, 0.33], scale: [1, 0.6, 0.5], cast: false }); mesh(SPH(0.05, 8, 6), mat(0xff9a9a), body, { pos: [0.28, 0.45, 0.33], scale: [1, 0.6, 0.5], cast: false });
      break; }
    case 'cat': {
      mesh(CAP(0.3, 0.2, 6, 14), main, body, O({ pos: [0, 0.52, 0], scale: [1.12, 1, 1] }));
      for (const s of [-1, 1]) { mesh(CONE(0.13, 0.28, 4), main, body, O({ pos: [s * 0.22, 1.02, 0.0], rot: [0, 0, -s * 0.25] })); mesh(CONE(0.07, 0.16, 4), acc, body, { pos: [s * 0.22, 1.0, 0.05], rot: [0, 0, -s * 0.25], cast: false }); }
      const tail = new THREE.Group(); tail.position.set(0, 0.3, -0.3); body.add(tail); mesh(CAP(0.055, 0.34, 3, 8), main, tail, O({ pos: [0, 0.2, -0.1], rot: [-0.9, 0, 0] })); m.parts.tail = tail;
      mesh(SPH(0.045, 8, 6), acc, body, { pos: [0, 0.5, 0.41], cast: false });
      headY = 1.05; eyeY = 0.62; eyeZ = 0.33; eyeX = 0.15;
      break; }
    case 'octo': {
      mesh(SPH(0.4, 22, 16), main, body, O({ pos: [0, 0.58, 0], scale: [1, 1.08, 1] }));
      mesh(CYL(0.4, 0.42, 0.3, 18), main, body, O({ pos: [0, 0.3, 0] }));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const t = mesh(SPH(0.11, 8, 6), main, body, O({ pos: [Math.cos(a) * 0.33, 0.15, Math.sin(a) * 0.33], scale: [1, 0.8, 1] })); (m.parts.tent || (m.parts.tent = [])).push(t); }
      for (let i = 0; i < 3; i++) mesh(SPH(0.05, 6, 5), acc, body, { pos: [-0.15 + i * 0.15, 0.95 - Math.abs(i - 1) * 0.04, 0.2], cast: false });
      headY = 1.05; eyeY = 0.62; eyeZ = 0.35; eyeX = 0.16;
      break; }
    case 'bear': {
      mesh(SPH(0.42, 24, 16), main, body, O({ pos: [0, 0.5, 0], scale: [1.1, 0.88, 1.0] }));
      for (const s of [-1, 1]) { mesh(SPH(0.14, 12, 10), main, body, O({ pos: [s * 0.3, 0.9, -0.02] })); mesh(SPH(0.08, 8, 6), acc, body, { pos: [s * 0.3, 0.9, 0.08], cast: false }); }
      mesh(SPH(0.16, 14, 10), mat(0xe8c28e), body, O({ pos: [0, 0.42, 0.34], scale: [1.1, 0.8, 0.8] })); mesh(SPH(0.05, 8, 6), DARK(), body, { pos: [0, 0.47, 0.46], scale: [1.3, 0.9, 1], cast: false });
      headY = 1.05; eyeY = 0.62; eyeZ = 0.33; eyeX = 0.17; es = 0.9;
      break; }
    case 'frog': {
      mesh(SPH(0.43, 24, 16), main, body, O({ pos: [0, 0.45, 0], scale: [1.14, 0.84, 1.0] }));
      mesh(SPH(0.3, 16, 12), mat(0xcaffd8), body, O({ pos: [0, 0.34, 0.2], scale: [1, 0.8, 0.8] }));
      for (const s of [-1, 1]) { mesh(SPH(0.16, 12, 10), main, body, O({ pos: [s * 0.2, 0.85, 0.14] })); }
      for (let i = 0; i < 3; i++) mesh(CONE(0.05, 0.12, 6), acc, body, { pos: [0, 0.78 - i * 0.12, -0.34 + i * 0.01], rot: [-0.7 - i * 0.1, 0, 0], cast: false });
      headY = 0.95; eyeY = 0.86; eyeZ = 0.25; eyeX = 0.2; es = 1.15;
      break; }
    case 'peng': default: {
      mesh(CAP(0.3, 0.26, 6, 14), mat(0x2a3a66), body, O({ pos: [0, 0.54, -0.03], scale: [1.12, 1, 1] }));
      mesh(CAP(0.27, 0.2, 6, 14), main, body, O({ pos: [0, 0.5, 0.1], scale: [1.0, 1, 0.8] }));
      mesh(CONE(0.07, 0.17, 8), acc, body, { pos: [0, 0.64, 0.41], rot: [Math.PI / 2, 0, 0], cast: false });
      mesh(SPH(0.05, 8, 6), mat(0xff9a9a), body, { pos: [-0.2, 0.55, 0.34], scale: [1, 0.6, 0.5], cast: false }); mesh(SPH(0.05, 8, 6), mat(0xff9a9a), body, { pos: [0.2, 0.55, 0.34], scale: [1, 0.6, 0.5], cast: false });
      headY = 1.1; eyeY = 0.7; eyeZ = 0.3; eyeX = 0.14;
      break; }
  }
  m.eyes.push(eye(body, -eyeX, eyeY, eyeZ, es), eye(body, eyeX, eyeY, eyeZ, es));
  // arms (right arm = throwing arm)
  const arm = (s) => { const a = new THREE.Group(); a.position.set(s * 0.42, 0.55, 0.04); body.add(a); mesh(SPH(0.1, 10, 8), h.shape === 'peng' ? mat(0x2a3a66) : main, a, O({ pos: [s * 0.03, -0.06, 0] })); return a; };
  m.armL = arm(-1); m.armR = arm(1);
  // team ring
  const ring = new THREE.Mesh(geo('ring', () => new THREE.RingGeometry(0.5, 0.64, 28)), new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; root.add(ring); m.ring = ring;
  // blob shadow (visible on low where real shadows are off)
  const blob = new THREE.Mesh(geo('blob', () => new THREE.CircleGeometry(0.5, 16)), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; root.add(blob); m.blob = blob;
  // shield bubble
  const bub = new THREE.Mesh(SPH(0.78, 18, 12), new THREE.MeshBasicMaterial({ color: 0x6fffb0, transparent: true, opacity: 0.28, depthWrite: false })); bub.position.y = 0.55; bub.visible = false; root.add(bub); m.bubble = bub;
  // deflect arc
  const df = new THREE.Mesh(geo('df', () => new THREE.RingGeometry(0.82, 1.06, 28, 1, -1.0, 2.0)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  df.rotation.x = -Math.PI / 2; df.position.y = 0.5; df.visible = false; root.add(df); m.deflect = df;
  // aim arrow (shown while charging)
  const aim = new THREE.Group(); aim.visible = false; root.add(aim); m.aim = aim;
  const tip = new THREE.Mesh(geo('aimtip', () => new THREE.ConeGeometry(0.2, 0.42, 3)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); tip.rotation.x = Math.PI / 2; tip.rotation.z = 0; tip.position.set(0, 0.06, 0); aim.add(tip);
  const dots = []; for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(geo('aimdot', () => new THREE.CircleGeometry(0.11, 8)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); d.rotation.x = -Math.PI / 2; d.position.y = 0.06; aim.add(d); dots.push(d); }
  m.aimTip = tip; m.aimDots = dots;
  // hat
  const hatG = new THREE.Group(); hatG.position.set(0, headY, 0); body.add(hatG); m.hatNode = hatG; m.headY = headY;
  addHat(m, hat, eyeY, eyeZ, eyeX);
  { let first = true; root.traverse((o) => { if (o.userData && o.userData.ol === 'hero') { if (first) first = false; else { o.userData.ol = 'hero2'; o.visible = gfx.outlinesAll; } } }); }
  m.setHat = (id) => { while (hatG.children.length) hatG.remove(hatG.children[0]); if (m.shades) { body.remove(m.shades); m.shades = null; } addHat(m, id, eyeY, eyeZ, eyeX); };
  // per-frame animation: st = {move (0..1), t, face, dash, charge, throwT, dead, deadT, spin}
  m.update = (dt, st) => {
    const t = st.t; const bob = Math.sin(t * 14) * 0.05 * st.move; const idle = Math.sin(t * 2.4) * 0.012;
    body.position.y = Math.abs(bob) + idle + (st.air || 0); body.rotation.set(0, 0, Math.sin(t * 14) * 0.07 * st.move);
    let sq = 1; if (st.dash > 0) { sq = 0.72; body.rotation.x = 0.9 * st.dash; body.scale.set(1.15, sq, 1.15); } else { body.scale.set(1 + (1 - Math.min(1, st.charge || 0)) * 0 + (st.charge || 0) * 0.08, 1 - (st.charge || 0) * 0.14 + idle, 1 + (st.charge || 0) * 0.08); }
    if (st.dash > 0) body.position.y += 0.1;
    m.feet[0].position.z = 0.08 + Math.sin(t * 14) * 0.12 * st.move; m.feet[1].position.z = 0.08 - Math.sin(t * 14) * 0.12 * st.move;
    // arms
    const th = st.throwT > 0 ? st.throwT : 0;
    m.armR.rotation.set(-(st.charge || 0) * 1.6 - th * 3.2, 0, -0.35 - (st.charge || 0) * 0.5);
    m.armL.rotation.set(Math.sin(t * 14) * 0.5 * st.move, 0, 0.35);
    if (st.deflect > 0) { m.armL.rotation.set(-1.4, 0, 0.1); m.armR.rotation.set(-1.4, 0, -0.1); }
    if (m.parts.tail) m.parts.tail.rotation.x = Math.sin(t * 5) * 0.2 + st.move * 0.4;
    if (m.parts.tent) m.parts.tent.forEach((p, i) => { p.position.y = 0.15 + Math.sin(t * 8 + i) * 0.03 * (0.4 + st.move); });
    if (m.parts.leaf) m.parts.leaf.rotation.z = 0.35 + Math.sin(t * 3) * 0.1 + st.move * 0.3;
    for (const e of m.eyes) { const bl = (Math.floor(t * 0.7 + (e === m.eyes[0] ? 0 : 0)) % 4 === 0 && (t * 0.7) % 1 > 0.94) ? 0.1 : 1; e.scale.y = st.dead ? 1.2 : bl; }
  };
  return m;
}

function addHat(m, id, eyeY, eyeZ, eyeX) {
  const hg = m.hatNode; const body = m.body;
  switch (id) {
    case 'band': { const b = mesh(TOR(0.4, 0.045, 8, 24), mat(0xff3b3b), hg, { pos: [0, -0.22, 0], rot: [Math.PI / 2, 0, 0], outline: 0.02, grp: 'hero' }); const k1 = mesh(CAP(0.03, 0.2, 3, 6), mat(0xff3b3b), hg, { pos: [-0.26, -0.3, -0.34], rot: [0.6, 0, 0.5], cast: false }); mesh(CAP(0.03, 0.18, 3, 6), mat(0xff3b3b), hg, { pos: [-0.2, -0.32, -0.38], rot: [0.9, 0, -0.2], cast: false }); break; }
    case 'party': { mesh(CONE(0.2, 0.46, 12), mat(0xff5ad8), hg, { pos: [0, 0.08, 0], outline: 0.02, grp: 'hero' }); mesh(SPH(0.07, 8, 6), glowMat(0xfff04a, 0.6), hg, { pos: [0, 0.34, 0], cast: false }); mesh(TOR(0.15, 0.025, 6, 16), mat(0xffee66), hg, { pos: [0, -0.04, 0], rot: [Math.PI / 2, 0, 0], cast: false }); break; }
    case 'top': { mesh(CYL(0.3, 0.3, 0.05, 20), mat(0x222233), hg, { pos: [0, -0.05, 0], outline: 0.02, grp: 'hero' }); mesh(CYL(0.19, 0.2, 0.32, 18), mat(0x222233), hg, { pos: [0, 0.14, 0], outline: 0.02, grp: 'hero' }); mesh(CYL(0.205, 0.205, 0.07, 18), mat(0xff3b6b), hg, { pos: [0, 0.05, 0], cast: false }); break; }
    case 'halo': { mesh(TOR(0.22, 0.035, 8, 24), glowMat(0xffe066, 1.2), hg, { pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, 0], cast: false }); break; }
    case 'flower': { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mesh(SPH(0.07, 8, 6), mat(0xff7ac8), hg, { pos: [0.12 + Math.cos(a) * 0.09, 0.02, Math.sin(a) * 0.09], cast: false }); } mesh(SPH(0.06, 8, 6), mat(0xffe066), hg, { pos: [0.12, 0.02, 0], cast: false }); break; }
    case 'shades': { const sh = new THREE.Group(); sh.position.set(0, eyeY, eyeZ + 0.075); body.add(sh); mesh(BOX(0.12, 0.09, 0.04), mat(0x111122), sh, { pos: [-eyeX, 0, 0.02], cast: false }); mesh(BOX(0.12, 0.09, 0.04), mat(0x111122), sh, { pos: [eyeX, 0, 0.02], cast: false }); mesh(BOX(0.2, 0.025, 0.03), mat(0x111122), sh, { pos: [0, 0.02, 0.02], cast: false }); m.shades = sh; break; }
  }
}

// ---------- boomerang ----------
export function buildBoomerang(color) {
  const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  const c = toon(color), a = toon(0xffffff);
  for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.rotation.y = s * 0.78; inner.add(arm); mesh(CAP(0.095, 0.42, 3, 8), c, arm, { pos: [0, 0, 0.26], rot: [Math.PI / 2, 0, 0], outline: 0.025, grp: 'other' }); mesh(SPH(0.07, 8, 6), a, arm, { pos: [0, 0.07, 0.34], cast: false }); }
  mesh(SPH(0.13, 10, 8), c, inner, { pos: [0, 0, 0.0], outline: 0.025, grp: 'other' });
  const glow = glowSprite(color, 1.1, 0.5); glow.position.y = 0.15; g.add(glow);
  g.userData = { inner, glow }; return g;
}
export function buildCrate(theme) {
  const g = new THREE.Group();
  const col = { dojo: 0xc98a4a, rooftop: 0x6a7ad0, jungle: 0xa5835a, ice: 0xa9e4ff }[theme] || 0xc98a4a, bar = { dojo: 0x7a4a22, rooftop: 0x2b3470, jungle: 0x5d7a3a, ice: 0x5aa4d8 }[theme] || 0x7a4a22;
  mesh(BOX(0.9, 0.9, 0.9), toon(col), g, { pos: [0, 0.45, 0], outline: 0.025, recv: true });
  for (const s of [-1, 1]) { mesh(BOX(0.95, 0.12, 0.95), toon(bar), g, { pos: [0, 0.45 + s * 0.3, 0], cast: false }); }
  mesh(BOX(0.12, 0.95, 0.95), toon(bar), g, { pos: [0, 0.45, 0], cast: false });
  return g;
}
const iconTex = {};
function powerIcon(kind) {
  if (iconTex[kind]) return iconTex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const col = '#' + POWERUPS[kind].color.toString(16).padStart(6, '0');
  x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.strokeStyle = '#1a1530'; x.lineWidth = 6; x.lineJoin = 'round'; x.lineCap = 'round';
  const P = (pts, close = true) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); if (close) x.closePath(); x.stroke(); x.fill(); };
  switch (kind) {
    case 'extra': x.font = '900 52px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText('+1', 64, 68); x.fillText('+1', 64, 68); break;
    case 'triple': for (const a of [-0.5, 0, 0.5]) { x.save(); x.translate(64, 76); x.rotate(a); P([[-6, 0], [6, 0], [4, -40], [-4, -40]]); x.restore(); } break;
    case 'giant': P([[64, 28], [96, 52], [96, 82], [64, 100], [32, 82], [32, 52]]); break;
    case 'fire': P([[64, 24], [86, 56], [84, 90], [64, 102], [44, 90], [42, 60], [54, 70]]); break;
    case 'homing': x.beginPath(); x.arc(64, 64, 26, 0, 7); x.stroke(); x.beginPath(); x.moveTo(64, 26); x.lineTo(64, 102); x.moveTo(26, 64); x.lineTo(102, 64); x.stroke(); break;
    case 'shield': P([[64, 24], [96, 36], [92, 72], [64, 102], [36, 72], [32, 36]]); break;
    case 'speed': P([[34, 36], [64, 64], [34, 92], [50, 92], [80, 64], [50, 36]]); P([[62, 36], [92, 64], [62, 92], [78, 92], [108, 64], [78, 36]]); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; iconTex[kind] = t; return t;
}
export function buildPowerup(kind) {
  const g = new THREE.Group(); const col = POWERUPS[kind].color;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerIcon(kind), transparent: true })); sp.scale.set(0.95, 0.95, 1); sp.position.y = 0.85; g.add(sp);
  const glow = glowSprite(col, 1.9, 0.55); glow.position.y = 0.85; g.add(glow);
  const base = new THREE.Mesh(CYL(0.34, 0.4, 0.1, 16), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 })); base.position.y = 0.06; g.add(base);
  g.userData = { sp, glow }; return g;
}
