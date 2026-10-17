import { THREE, gfx, toon, glowMat, basic, mesh, glowSprite, mergeToon, softTex } from './gfx.js';
import { POWERUPS, SKINS as SHOP_SKINS, BOOM_TYPES } from './data.js';
import { buildFighterBody, animateFighter } from './fighters.js';

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

// returns { root, body, update(dt, st), ... }; local +z is forward.
export function buildFighter(h, hat = 'none', teamColor = 0xffffff) {
  const m = buildFighterBody(h, teamColor); const { root, body } = m; const sp = m.spec;
  // team ring
  const ring = new THREE.Mesh(geo('ring', () => new THREE.RingGeometry(0.5, 0.64, 28)), new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; root.add(ring); m.ring = ring;
  // blob shadow (visible on low where real shadows are off), tinted by the hero colour
  const blob = new THREE.Mesh(geo('blob', () => new THREE.PlaneGeometry(1.25, 1.25)), new THREE.MeshBasicMaterial({ map: softTex(), color: new THREE.Color(h.color).multiplyScalar(0.12), transparent: true, opacity: 0.62, depthWrite: false }));
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
  // KO stars
  const stars = new THREE.Group(); stars.visible = false; stars.position.y = sp.hatY + 0.12; body.add(stars); m.stars = stars;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const sm = new THREE.Mesh(geo('star', () => new THREE.OctahedronGeometry(0.075)), new THREE.MeshBasicMaterial({ color: 0xffe14a })); sm.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34); stars.add(sm); }
  // hat
  const hatG = new THREE.Group(); hatG.position.set(0, sp.hatY, 0); hatG.scale.setScalar(sp.hs); body.add(hatG); m.hatNode = hatG; m.headY = sp.hatY;
  m.finish();
  addHat(m, hat, sp.shades);
  { let first = true; root.traverse((o) => { if (o.userData && o.userData.ol === 'hero') { if (first) first = false; else { o.userData.ol = 'hero2'; o.visible = gfx.outlinesAll; } } }); }
  m.setHat = (id) => { while (hatG.children.length) hatG.remove(hatG.children[0]); if (m.shades) { body.remove(m.shades); m.shades = null; } if (m.band) { body.remove(m.band); m.band = null; } addHat(m, id, sp.shades); };
  // per-frame animation: st = {move, t, dash, charge, throwT, dead, deflect, air, win, scared, happy, catchPop, expr}
  m.update = (dt, st) => animateFighter(m, dt, st);
  return m;
}

function addHat(m, id, sh0) {
  const eyeY = sh0.y, eyeZ = sh0.z, eyeX = sh0.x;
  const hg = m.hatNode; const body = m.body; const hd = m.spec.head;
  switch (id) {
    case 'band': { const bg = new THREE.Group(); body.add(bg); const rx = hd.plane ? 0.37 : hd.rx * 0.8 + 0.02, rz = hd.plane ? 0.28 : hd.rz * 0.8 + 0.02, y = hd.plane ? hd.y + 0.27 : hd.y + hd.ry * 0.6; bg.position.set(0, y, 0); bg.rotation.x = -0.12; m.band = bg;
      mesh(TOR(rx, 0.04, 8, 28), mat(0xff3b3b), bg, { rot: [Math.PI / 2, 0, 0], scale: [1, rz / rx, 1], outline: 0.02, grp: 'hero' }); mesh(CAP(0.03, 0.2, 3, 6), mat(0xff3b3b), bg, { pos: [-0.12, -0.08, -rz - 0.04], rot: [0.6, 0, 0.5], cast: false }); mesh(CAP(0.03, 0.18, 3, 6), mat(0xff3b3b), bg, { pos: [-0.04, -0.1, -rz - 0.06], rot: [0.9, 0, -0.2], cast: false }); break; }
    case 'party': { mesh(CONE(0.2, 0.46, 12), mat(0xff5ad8), hg, { pos: [0, 0.08, 0], outline: 0.02, grp: 'hero' }); mesh(SPH(0.07, 8, 6), glowMat(0xfff04a, 0.6), hg, { pos: [0, 0.34, 0], cast: false }); mesh(TOR(0.15, 0.025, 6, 16), mat(0xffee66), hg, { pos: [0, -0.04, 0], rot: [Math.PI / 2, 0, 0], cast: false }); break; }
    case 'top': { mesh(CYL(0.3, 0.3, 0.05, 20), mat(0x222233), hg, { pos: [0, -0.05, 0], outline: 0.02, grp: 'hero' }); mesh(CYL(0.19, 0.2, 0.32, 18), mat(0x222233), hg, { pos: [0, 0.14, 0], outline: 0.02, grp: 'hero' }); mesh(CYL(0.205, 0.205, 0.07, 18), mat(0xff3b6b), hg, { pos: [0, 0.05, 0], cast: false }); break; }
    case 'halo': { mesh(TOR(0.22, 0.035, 8, 24), glowMat(0xffe066, 1.2), hg, { pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, 0], cast: false }); break; }
    case 'flower': { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mesh(SPH(0.07, 8, 6), mat(0xff7ac8), hg, { pos: [0.12 + Math.cos(a) * 0.09, 0.02, Math.sin(a) * 0.09], cast: false }); } mesh(SPH(0.06, 8, 6), mat(0xffe066), hg, { pos: [0.12, 0.02, 0], cast: false }); break; }
    case 'shades': { const sh = new THREE.Group(); sh.position.set(0, eyeY, eyeZ); body.add(sh); mesh(BOX(0.12, 0.09, 0.04), mat(0x111122), sh, { pos: [-eyeX, 0, 0.02], cast: false }); mesh(BOX(0.12, 0.09, 0.04), mat(0x111122), sh, { pos: [eyeX, 0, 0.02], cast: false }); mesh(BOX(0.2, 0.025, 0.03), mat(0x111122), sh, { pos: [0, 0.02, 0.02], cast: false }); m.shades = sh; break; }
  }
}

// ---------- boomerang ----------
// per-hero boomerang skins: arm colour, tip colour, trim, glow colour, shape variant
const SKINS = {
  panda: { arm: 0x7ac143, tip: 0x2b2b3a, trim: 0x2f6a24, glow: 0x9dff6a, w: 0.095, kind: 'bamboo' },
  fox: { arm: 0xc9d3e0, tip: 0xd8283c, trim: 0x2a2a3c, glow: 0xff5a6a, w: 0.06, kind: 'blade' },
  robot: { arm: 0x59c2ff, tip: 0xffb02e, trim: 0x39465a, glow: 0x5cf0ff, w: 0.085, kind: 'gear' },
  pirate: { arm: 0x8a5a2b, tip: 0xe8b23a, trim: 0xe8b23a, glow: 0xffd060, w: 0.1, kind: 'skull' },
  monk: { arm: 0x4fe0a0, tip: 0xff9a2e, trim: 0xe8b23a, glow: 0x7dffc8, w: 0.1, kind: 'jade' },
  peng: { arm: 0xcfeeff, tip: 0x5ab8ff, trim: 0xf0b83a, glow: 0x9ad8ff, w: 0.055, kind: 'katana' },
};
export function buildBoomerang(color, hero, skin, type) {
  const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  const sk = { ...SKINS[hero ? faceKeyOf(hero) : 'panda'] }; const so = skin && SHOP_SKINS[skin]; if (so && so.arm) { sk.arm = so.arm; sk.tip = so.tip; sk.trim = so.trim; sk.glow = so.glow; }
  const tyd = type && type !== 'classic' ? BOOM_TYPES[type] : null; if (tyd) sk.glow = tyd.color; const c = toon(sk.arm), tp = toon(sk.tip), tr = toon(sk.trim);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.rotation.y = s * 0.78; inner.add(arm);
    const flat = sk.kind === 'blade' || sk.kind === 'katana';
    mesh(CAP(sk.w, 0.42, 3, 8), c, arm, { pos: [0, 0, 0.26], rot: [Math.PI / 2, 0, 0], scale: flat ? [1, 1, 0.45] : 1, outline: 0.025, grp: 'other' });
    mesh(SPH(sk.kind === 'blade' ? 0.06 : 0.075, 8, 6), tp, arm, { pos: [0, 0, 0.5], scale: sk.kind === 'blade' ? [0.7, 0.5, 1.5] : 1, cast: false });
    if (sk.kind === 'bamboo') for (const z of [0.18, 0.36]) mesh(TOR(sk.w + 0.005, 0.02, 5, 10), tr, arm, { pos: [0, 0, z], cast: false });
    if (sk.kind === 'skull' || sk.kind === 'jade') for (const z of [0.2, 0.38]) mesh(TOR(sk.w + 0.005, 0.022, 5, 10), tr, arm, { pos: [0, 0, z], cast: false });
    if (sk.kind === 'gear') { mesh(BOX(0.05, 0.16, 0.3), tp, arm, { pos: [0, 0.03, 0.27], cast: false }); }
    if (sk.kind === 'jade') for (const z of [0.12, 0.3]) mesh(SPH(0.04, 6, 5), tp, arm, { pos: [0, 0.1, z], cast: false });
  }
  const tc = toon(color);
  if (sk.kind === 'gear') { mesh(CYL(0.15, 0.15, 0.08, 8), tr, inner, { outline: 0.025, grp: 'other' }); mesh(CYL(0.19, 0.19, 0.035, 8), tp, inner, { cast: false }); }
  else if (sk.kind === 'katana') { mesh(CYL(0.14, 0.14, 0.04, 12), tr, inner, { outline: 0.025, grp: 'other' }); }
  else if (sk.kind === 'skull') { mesh(SPH(0.14, 10, 8), toon(0xf0ece0), inner, { outline: 0.025, grp: 'other' }); for (const x of [-0.05, 0.05]) mesh(SPH(0.03, 5, 4), toon(0x1a1530), inner, { pos: [x, 0.06, 0.1], cast: false }); }
  else mesh(SPH(0.13, 10, 8), c, inner, { outline: 0.025, grp: 'other' });
  mesh(SPH(0.065, 8, 6), tc, inner, { pos: [0, 0.1, 0], cast: false }); // team-coloured gem keeps ownership readable
  if (type === 'phantom') inner.traverse((o) => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) { o.material.transparent = true; o.material.opacity = 0.62; } }); else mergeToon(inner, null, { cast: false, ol: true, grp: 'other' });
  if (type === 'razor') for (const a of [0, 1.57, 3.14, 4.71]) mesh(CONE(0.045, 0.2, 4), toon(0xe8f8ff), inner, { pos: [Math.sin(a) * 0.17, 0.02, Math.cos(a) * 0.17], rot: [Math.PI / 2 * Math.cos(a), 0, -Math.PI / 2 * Math.sin(a)], cast: false });
  if (type === 'frost') for (const a of [0.5, 2.6, 4.7]) mesh(CONE(0.05, 0.22, 5), toon(0xbff0ff), inner, { pos: [Math.sin(a) * 0.15, 0.1, Math.cos(a) * 0.15], rot: [0, 0, 0], cast: false });
  const glow = glowSprite(sk.glow, tyd ? 1.5 : 1.1, tyd ? 0.65 : 0.5); glow.position.y = 0.15; g.add(glow);
  g.userData = { inner, glow }; return g;
}
const faceKeyOf = (h) => ({ bao: 'panda', nori: 'fox', tako: 'robot', kuma: 'pirate', pico: 'monk', yuki: 'peng' }[h.id] || 'panda');
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
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.scale(2, 2); const col = '#' + POWERUPS[kind].color.toString(16).padStart(6, '0');
  x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.strokeStyle = '#1a1530'; x.lineWidth = 6; x.lineJoin = 'round'; x.lineCap = 'round';
  const P = (pts, close = true) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); if (close) x.closePath(); x.stroke(); x.fill(); };
  switch (kind) {
    case 'extra': x.font = '900 52px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText('+1', 64, 68); x.fillText('+1', 64, 68); break;
    case 'triple': for (const a of [-0.5, 0, 0.5]) { x.save(); x.translate(64, 76); x.rotate(a); P([[-6, 0], [6, 0], [4, -40], [-4, -40]]); x.restore(); } break;
    case 'giant': P([[64, 28], [96, 52], [96, 82], [64, 100], [32, 82], [32, 52]]); break;
    case 'fire': P([[64, 24], [86, 56], [84, 90], [64, 102], [44, 90], [42, 60], [54, 70]]); break;
    case 'homing': x.beginPath(); x.arc(64, 64, 26, 0, 7); x.stroke(); x.beginPath(); x.moveTo(64, 26); x.lineTo(64, 102); x.moveTo(26, 64); x.lineTo(102, 64); x.stroke(); break;
    case 'rune': P([[30, 84], [64, 36], [98, 84], [80, 84], [64, 60], [48, 84]]); break;
    case 'shield': P([[64, 24], [96, 36], [92, 72], [64, 102], [36, 72], [32, 36]]); break;
    case 'speed': P([[34, 36], [64, 64], [34, 92], [50, 92], [80, 64], [50, 36]]); P([[62, 36], [92, 64], [62, 92], [78, 92], [108, 64], [78, 36]]); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; iconTex[kind] = t; return t;
}
export function buildPowerup(kind) {
  const g = new THREE.Group(); const col = POWERUPS[kind].color;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerIcon(kind), transparent: true })); sp.scale.set(0.95, 0.95, 1); sp.position.y = 0.85; g.add(sp);
  const glow = glowSprite(col, 1.9, 0.55); glow.position.y = 0.85; g.add(glow);
  const base = new THREE.Mesh(CYL(0.34, 0.4, 0.1, 16), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 })); base.position.y = 0.06; g.add(base);
  g.userData = { sp, glow }; return g;
}
