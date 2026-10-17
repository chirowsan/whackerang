// Per-theme arena dressing: ground, props, lights, water/lava/neon, and a baked-look floor pattern. Static things live under view.root (merged on Sharp/Fast); animated bits live under view.dyn.
import { THREE, gfx, toon, mesh, glowSprite, glowTexture, softTex, RIM } from './gfx.js';
const mergeGeometries = (gs) => { let n = 0; for (const g of gs) n += g.attributes.position.count; const out = new THREE.BufferGeometry(); for (const name of Object.keys(gs[0].attributes)) { const sz = gs[0].attributes[name].itemSize, arr = new Float32Array(n * sz); let o = 0; for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); } return out; };
import { AW, AH, HX, HZ, cx, cz, idx, mulberry32 } from './util.js';
import { fx } from './fx.js';

const BOXG = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 10), CONE = new THREE.ConeGeometry(1, 1, 6), SPH = new THREE.SphereGeometry(1, 10, 8);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const cv = (w, h, fn, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };

// merged unlit/vertex-coloured batch (windows, neon strips, flames): one draw call, bloom-friendly colours > 1
class Batch {
  constructor() { this.g = []; }
  add(geo, color, pos, scale = [1, 1, 1], rot = [0, 0, 0], k = 1) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale)); g.applyMatrix4(_m); const c = new THREE.Color(color); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); this.g.push(g); return this; }
  build(parent, o = {}) { if (!this.g.length) return null; const geo = mergeGeometries(this.g); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: o.fog !== false, transparent: !!o.opacity, opacity: o.opacity || 1, depthWrite: !o.opacity, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; if (parent) parent.add(m); return m; }
}
const tm = (c, o) => toon(c, o);
const box = (p, c, pos, sc, o = {}) => mesh(BOXG, tm(c), p, { pos, scale: sc, rot: o.rot, outline: o.ol, cast: o.cast !== false });
const cyl = (p, c, pos, r, h, o = {}) => mesh(CYL, tm(c), p, { pos, scale: [r, h, r], rot: o.rot, outline: o.ol, cast: o.cast !== false });
const cone = (p, c, pos, r, h, o = {}) => mesh(CONE, tm(c), p, { pos, scale: [r, h, r], rot: o.rot, outline: o.ol, cast: o.cast !== false });
const sph = (p, c, pos, r, o = {}) => mesh(SPH, tm(c, o.mat), p, { pos, scale: o.sc || [r, r, r], outline: o.ol, cast: o.cast !== false });

// ground frame around the arena with a rectangular hole
function groundFrame(view, tex, repeat, y = -0.3) {
  const sh = new THREE.Shape(); const W = 70, D = 55; sh.moveTo(-W, -D); sh.lineTo(W, -D); sh.lineTo(W, D); sh.lineTo(-W, D); sh.closePath();
  const hole = new THREE.Path(); const hx = HX + 1, hz = HZ + 1; hole.moveTo(-hx, -hz); hole.lineTo(-hx, hz); hole.lineTo(hx, hz); hole.lineTo(hx, -hz); hole.closePath(); sh.holes.push(hole);
  const geo = new THREE.ShapeGeometry(sh); tex.repeat.set(1 / repeat, 1 / repeat);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = false; view.root.add(m); return m;
}
// reusable props
function lantern(view, x, z, s = 1, col = 0xffb347) { const R = view.root; box(R, 0x8a8a98, [x, 0.12 * s, z], [0.5 * s, 0.24 * s, 0.5 * s]); cyl(R, 0x9a9aa8, [x, 0.55 * s, z], 0.13 * s, 0.7 * s); box(R, 0xb4b4c0, [x, 1.0 * s, z], [0.46 * s, 0.4 * s, 0.46 * s]); view.glow.add(BOXG, col, [x, 1.0 * s, z], [0.3 * s, 0.26 * s, 0.3 * s], [0, 0, 0], 2.2); cone(R, 0x7a7a88, [x, 1.38 * s, z], 0.4 * s, 0.3 * s); view.pools.push([x, z, 2.2 * s, col]); }
function pine(view, x, z, s = 1, snow = false) { const R = view.root; cyl(R, 0x6b4a2e, [x, 0.4 * s, z], 0.14 * s, 0.8 * s, { ol: 0.025 }); for (let i = 0; i < 3; i++) { cone(R, 0x2f8a52, [x, (0.9 + i * 0.6) * s, z], (1.0 - i * 0.26) * s, 1.0 * s, { ol: 0.025 }); if (snow) cone(R, 0xf2fbff, [x, (1.12 + i * 0.6) * s, z], (0.78 - i * 0.22) * s, 0.55 * s); } }
function palm(view, x, z, s = 1) { const R = view.root; cyl(R, 0x7a5a38, [x, 0.9 * s, z], 0.16 * s, 1.8 * s, { rot: [0, 0, 0.12], ol: 0.025 }); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(R, [0x2f9a54, 0x3fb064][i % 2], [x + Math.cos(a) * 0.55 * s + 0.2 * s, 1.85 * s, z + Math.sin(a) * 0.55 * s], [1.1 * s, 0.07, 0.34 * s], { rot: [0, -a, -0.35] }); } }
function bush(view, x, z, s = 1, c = 0x3fb064) { sph(view.root, c, [x, 0.25 * s, z], 0.7 * s, { sc: [0.8 * s, 0.5 * s, 0.8 * s], ol: 0.02 }); }
function crystal(view, x, z, s = 1, c = 0x9fdcff) { const g = new THREE.Group(); g.position.set(x, 0, z); view.root.add(g); for (let i = 0; i < 4; i++) { const h = (0.8 + (i * 37 % 10) / 10) * s; const m = mesh(CONE, new THREE.MeshToonMaterial({ color: c, gradientMap: toon(0).gradientMap, transparent: true, opacity: 0.88 }), g, { pos: [Math.sin(i * 2.1) * 0.5 * s, h / 2 - 0.1, Math.cos(i * 2.1) * 0.5 * s], scale: [0.3 * s, h, 0.3 * s], rot: [Math.sin(i) * 0.25, 0, Math.cos(i) * 0.25] }); m.castShadow = false; } }

const BUILD = {
  dojo(view, rd) {
    const R = view.root, D = view.dyn;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#8fc16c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { x.fillStyle = `hsla(${88 + rd() * 30},45%,${42 + rd() * 22}%,.5)`; x.fillRect(rd() * w, rd() * h, 2, 4 + rd() * 5); } for (let i = 0; i < 18; i++) { x.fillStyle = ['#fff', '#ffd6e6', '#fff3a0'][i % 3]; x.beginPath(); x.arc(rd() * w, rd() * h, 2.2, 0, 7); x.fill(); } }, true), 14);
    // raked-sand/gravel path ring + stepping stones
    const pathM = tm(0xe8d9b0); for (const [x, z, sx, sz] of [[0, -HZ - 2.4, AW + 5, 1.7], [0, HZ + 2.4, AW + 5, 1.7], [-HX - 2.4, 0, 1.7, AH + 3], [HX + 2.4, 0, 1.7, AH + 3]]) mesh(BOXG, pathM, R, { pos: [x, -0.28, z], scale: [sx, 0.04, sz], cast: false });
    for (let i = 0; i < 9; i++) cyl(R, 0xb9b3a0, [-20 + i * 5 + rd(), -0.25, -HZ - 4.4 + rd() * 0.8], 0.45, 0.08, { cast: false });
    // cherry trees ring, with petals piles
    const trees = gfx.quality === 'low' ? 9 : 13;
    for (let k = 0; k < trees; k++) { const a = (k / trees) * Math.PI * 2 + 0.3, x = Math.cos(a) * (17 + rd() * 4), z = Math.sin(a) * (11.5 + rd() * 3); const g = new THREE.Group(); g.position.set(x, -0.3, z); R.add(g); const h = 1.7 + rd() * 1.4; cyl(g, 0x7a4f32, [0, h / 2, 0], 0.18, h, { ol: 0.03 }); for (let i = 0; i < 4; i++) sph(g, [0xffa6c9, 0xffc2dc, 0xff8fbc, 0xffd0e4][i], [(rd() - 0.5) * 1.2, h + 0.2 + rd() * 0.7, (rd() - 0.5) * 1.2], 0.8 + rd() * 0.5, { ol: 0.03 }); }
    // torii gate at the back
    const tg = new THREE.Group(); tg.position.set(-2, -0.3, -HZ - 5.2); R.add(tg); const red = 0xd8383a; cyl(tg, red, [-2.2, 1.7, 0], 0.22, 3.4, { ol: 0.03 }); cyl(tg, red, [2.2, 1.7, 0], 0.22, 3.4, { ol: 0.03 }); box(tg, red, [0, 3.2, 0], [6.4, 0.34, 0.4], { ol: 0.03 }); box(tg, 0x2a2030, [0, 3.62, 0], [7.2, 0.22, 0.5]); box(tg, red, [0, 2.6, 0], [4.4, 0.2, 0.28]);
    // stone lanterns
    for (const [x, z] of [[-HX - 1.8, -HZ - 1.4], [HX + 1.8, -HZ - 1.4], [-HX - 1.8, HZ + 1.4], [HX + 1.8, HZ + 1.4], [-4, -HZ - 3.3], [0, HZ + 3.2]]) lantern(view, x, z);
    // bamboo groves
    for (let k = 0; k < 16; k++) { const side = k % 2 ? 1 : -1; const x = side * (HX + 4 + rd() * 5), z = -10 + rd() * 20; const h = 3 + rd() * 2.2; cyl(R, 0x7ac26a, [x, h / 2, z], 0.1, h, { cast: false }); for (let n = 1; n < 4; n++) cyl(R, 0x5ea052, [x, n * h / 4, z], 0.12, 0.07, { cast: false }); }
    // pond with animated water + koi
    const wt = cv(256, 256, (x, w, h) => { x.fillStyle = '#5fc4f2'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 3; for (let i = 0; i < 9; i++) { x.beginPath(); const y = i * 30 + 10; x.moveTo(0, y); for (let xx = 0; xx <= 256; xx += 16) x.lineTo(xx, y + Math.sin(xx / 20 + i) * 6); x.stroke(); } }, true); wt.repeat.set(2, 2);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), new THREE.MeshBasicMaterial({ map: wt })); pond.rotation.x = -Math.PI / 2; pond.position.set(-15.5, -0.2, 8.6); R.add(pond); cyl(R, 0xb9b3a0, [-15.5, -0.28, 8.6], 3.5, 0.1, { cast: false });
    const koi = []; for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: [0xff7a3a, 0xffffff, 0xff9a5a][i] })); k.scale.set(0.2, 0.06, 0.4); D.add(k); koi.push(k); }
    view.anim.push((t) => { wt.offset.x = t * 0.03; wt.offset.y = t * 0.02; koi.forEach((k, i) => { const a = t * (0.5 + i * 0.12) + i * 2; k.position.set(-15.5 + Math.cos(a) * (1.6 + i * 0.3), -0.15, 8.6 + Math.sin(a) * (1.4 + i * 0.3)); k.rotation.y = -a; }); });
    // banners on the rim corners (sway)
    const banners = []; for (const [x, z] of [[-HX - 0.5, -HZ - 0.5], [HX + 0.5, -HZ - 0.5], [-HX - 0.5, HZ + 0.5], [HX + 0.5, HZ + 0.5]]) { cyl(R, 0x5a3a22, [x, 1.5, z], 0.07, 3, { cast: false }); const b = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.7, 1, 4), new THREE.MeshBasicMaterial({ map: cv(64, 128, (c, w, h) => { c.fillStyle = '#d8383a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffe9a0'; c.lineWidth = 5; c.beginPath(); c.arc(32, 44, 14, 0, 7); c.stroke(); c.fillStyle = '#ffe9a0'; c.fillRect(22, 78, 20, 6); }), side: THREE.DoubleSide, fog: false })); b.position.set(x + 0.4, 2.2, z); D.add(b); banners.push(b); }
    view.anim.push((t) => banners.forEach((b, i) => { b.rotation.y = Math.sin(t * 1.6 + i) * 0.25; }));
    // drifting cloud sea under the arena (parallax: 2 layers)
    this.clouds(view, 0xffffff, [-3.2, -5.4], 0.5);
    view.rim = 0xffd8a8;
  },
  rooftop(view, rd) {
    const R = view.root, D = view.dyn;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#161a44'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,229,255,.18)'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); } for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.02 + rd() * 0.04})`; x.fillRect(rd() * w, rd() * h, 20 + rd() * 30, 20 + rd() * 30); } }, true), 10);
    // city skyline below: layered towers w/ batched window lights
    const wb = view.glow; const cols = [0x00e5ff, 0xff2bd6, 0xffe066, 0xff8a3a];
    const towers = gfx.quality === 'low' ? 26 : 38;
    for (let k = 0; k < towers; k++) { const a = rd() * 6.28, rx = 14 + rd() * 14, rz = 10 + rd() * 8; const x = Math.cos(a) * rx * 1.15, z = Math.sin(a) * rz * 1.2; if (Math.abs(x) < HX + 3 && Math.abs(z) < HZ + 3) continue; const h = 3 + rd() * 9, w = 1.6 + rd() * 2.2, d = 1.6 + rd() * 2; box(R, [0x1a1f55, 0x232a6a, 0x151a48][k % 3], [x, h / 2 - 3.2, z], [w, h, d], { cast: false }); for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (rd() < 0.7) wb.add(BOXG, cols[Math.floor(rd() * 4)], [x - w / 2 + (c + 0.5) * w / 3, h - 3.2 - 0.6 - r * 0.7, z + d / 2 + 0.01], [w / 4, 0.28, 0.02], [0, 0, 0], 1.1); }
    // rooftop clutter: AC units, vents, pipes, water tower, antennas
    for (const [x, z, s] of [[-14, -8.5, 1], [14.5, -9, 1.2], [-15, 9, 1], [15, 8.5, 1], [0, -10.8, 1.3], [-8, 10.6, 1]]) { box(R, 0x4a5290, [x, 0.35 * s, z], [1.5 * s, 0.7 * s, 1.1 * s], { ol: 0.03 }); cyl(R, 0x2a2f66, [x + 0.3 * s, 0.76 * s, z], 0.32 * s, 0.1 * s); wb.add(BOXG, 0x00e5ff, [x - 0.76 * s, 0.4 * s, z], [0.02, 0.1, 0.5 * s], [0, 0, 0], 1.4); }
    const wt = new THREE.Group(); wt.position.set(17, -0.3, -3); R.add(wt); for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) cyl(wt, 0x3a3f7a, [a, 1, b], 0.07, 2.2); cyl(wt, 0x5a4a8a, [0, 2.7, 0], 0.85, 1.1, { ol: 0.03 }); cone(wt, 0x2a2f66, [0, 3.5, 0], 0.95, 0.5);
    // neon signs with text
    const sign = (txt, col, x, y, z, ry, w = 5, h = 1.4) => { const t = cv(512, 128, (c, W, H) => { c.fillStyle = 'rgba(8,6,30,.9)'; c.fillRect(0, 0, W, H); c.strokeStyle = col; c.lineWidth = 8; c.strokeRect(6, 6, W - 12, H - 12); c.fillStyle = col; c.font = '900 76px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 18; c.fillText(txt, W / 2, H / 2 + 4); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, fog: false })); m.position.set(x, y, z); m.rotation.y = ry; R.add(m); cyl(R, 0x2a2f66, [x - w * 0.4, y / 2 - 0.2, z], 0.06, y); cyl(R, 0x2a2f66, [x + w * 0.4, y / 2 - 0.2, z], 0.06, y); return m; };
    sign('BOOM RAMEN', '#ff2bd6', -9, 2.1, -HZ - 3.2, 0); sign('ARCADE', '#00e5ff', 9.5, 2.0, -HZ - 3.4, 0, 4, 1.2); sign('NO PARKING', '#ffe066', 0, 1.6, HZ + 3.6, 0, 4.2, 1.1);
    // blinking antennas + sweeping searchlights
    const blink = []; for (const [x, z] of [[-17, -6], [18, 6], [-12, -10]]) { cyl(R, 0x3a3f7a, [x, 2, z], 0.05, 4.2); const g = glowSprite(0xff3030, 0.9, 1); g.position.set(x, 4.2, z); D.add(g); blink.push(g); }
    const beams = []; for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(1.1, 22, 14, 1, true), new THREE.MeshBasicMaterial({ color: i ? 0xff2bd6 : 0x00e5ff, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })); b.position.set(i ? 15 : -15, 8, i ? -11 : 11); D.add(b); beams.push(b); }
    view.anim.push((t) => { blink.forEach((g, i) => { g.material.opacity = Math.sin(t * 3 + i * 2) > 0.2 ? 1 : 0.15; }); beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.5 + i * 3) * 0.55; b.rotation.x = Math.cos(t * 0.37 + i) * 0.35; }); });
    // steam vents
    view.steam = [[-12.5, -7.5], [13, 8.8], [-1, -10.5]]; view.anim.push((t, dt) => { for (const [x, z] of view.steam) if (Math.random() < dt * 3) fx.glow.spawn(x, 0.3, z, (Math.random() - 0.5) * 0.3, 1.2, 0, 0.35, 1.6, 0x6a6fb0, 0, 0.5, 0, 1.5); });
    // light rain streaks (cheap)
    view.anim.push((t, dt) => { if (gfx.density > 0.7 && Math.random() < dt * 14) fx.glow.spawn((Math.random() - 0.5) * 36, 9, (Math.random() - 0.5) * 22, 0.4, -16, 0, 0.035, 0.6, 0x9fb0ff); });
    view.rim = 0x6fe8ff;
  },
  jungle(view, rd) {
    const R = view.root, D = view.dyn;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#4d7f4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `hsla(${95 + rd() * 40},45%,${22 + rd() * 20}%,.55)`; x.beginPath(); x.ellipse(rd() * w, rd() * h, 2 + rd() * 5, 1 + rd() * 3, rd() * 3, 0, 7); x.fill(); } for (let i = 0; i < 14; i++) { x.fillStyle = '#7a6a48'; x.beginPath(); x.ellipse(rd() * w, rd() * h, 6 + rd() * 8, 4 + rd() * 5, rd() * 3, 0, 7); x.fill(); } }, true), 12);
    // dense foliage ring
    const n = gfx.quality === 'low' ? 16 : 24;
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + rd() * 0.2, x = Math.cos(a) * (15.5 + rd() * 5), z = Math.sin(a) * (10.5 + rd() * 3.5); const g = new THREE.Group(); g.position.set(x, -0.3, z); R.add(g); const h = 2.4 + rd() * 2.4; cyl(g, 0x6b4a2e, [0, h / 2, 0], 0.26, h, { ol: 0.03 }); for (let i = 0; i < 3; i++) sph(g, [0x2f9a54, 0x3fb064, 0x278a4a][i], [(rd() - 0.5) * 1.2, h + 0.2 + rd() * 0.6, (rd() - 0.5) * 1.2], 1.0 + rd() * 0.6, { sc: [1, 0.8, 1], ol: 0.03 }); }
    for (let k = 0; k < 8; k++) palm(view, (k % 2 ? 1 : -1) * (12.5 + rd() * 3), -9 + k * 2.6, 0.9 + rd() * 0.5);
    for (let k = 0; k < 20; k++) { const a = rd() * 6.28; const x = Math.cos(a) * (12.5 + rd() * 7), z = Math.sin(a) * (8.5 + rd() * 4); if (Math.abs(x) < HX + 1.5 && Math.abs(z) < HZ + 1.5) continue; bush(view, x, z, 0.8 + rd() * 0.7, [0x3fb064, 0x2f9a54, 0x56c070][k % 3]); }
    // ruined temple steps + idols with glowing eyes
    for (let i = 0; i < 4; i++) box(R, [0x8a8f78, 0x7d8a68][i % 2], [0, -0.12 + i * 0.18, -HZ - 3 - i * 0.7], [8 - i * 1.2, 0.38, 1.6], { ol: 0.03 }); box(R, 0x8a8f78, [0, 1.6, -HZ - 5.4], [3, 2.8, 1.2], { ol: 0.03 }); view.glow.add(BOXG, 0x6aff9a, [-0.7, 2.2, -HZ - 4.78], [0.4, 0.2, 0.05], [0, 0, 0], 2.4).add(BOXG, 0x6aff9a, [0.7, 2.2, -HZ - 4.78], [0.4, 0.2, 0.05], [0, 0, 0], 2.4);
    for (const [x, z] of [[-HX - 2, -2], [HX + 2, 3]]) { box(R, 0x8a8f78, [x, 0.7, z], [0.9, 1.4, 0.9], { ol: 0.03 }); box(R, 0x7d8a68, [x, 1.6, z], [0.7, 0.5, 0.7]); view.glow.add(BOXG, 0x6aff9a, [x, 1.62, z + 0.36], [0.4, 0.14, 0.04], [0, 0, 0], 2.4); }
    // torches with flickering flames
    const flames = []; for (const [x, z] of [[-HX - 1.6, -HZ - 1.3], [HX + 1.6, -HZ - 1.3], [-HX - 1.6, HZ + 1.3], [HX + 1.6, HZ + 1.3]]) { cyl(R, 0x6b4a2e, [x, 0.8, z], 0.08, 1.6); const f = glowSprite(0xffa030, 1.3, 0.95); f.position.set(x, 1.75, z); D.add(f); flames.push(f); view.pools.push([x, z, 2.6, 0xffa030]); }
    // river with animated water (left) + waterfall
    const wt = cv(256, 256, (x, w, h) => { x.fillStyle = '#2fa3a0'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(200,255,240,.5)'; x.lineWidth = 4; for (let i = 0; i < 10; i++) { x.beginPath(); const xx = i * 26 + 8; x.moveTo(xx, 0); for (let y = 0; y <= 256; y += 16) x.lineTo(xx + Math.sin(y / 18 + i) * 6, y); x.stroke(); } }, true); wt.repeat.set(1, 4);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 40), new THREE.MeshBasicMaterial({ map: wt })); river.rotation.x = -Math.PI / 2; river.position.set(-HX - 5.6, -0.22, 0); R.add(river);
    for (let i = 0; i < 6; i++) sph(R, 0x8a8f78, [-HX - 4 + (i % 2) * 3.4, -0.1, -8 + i * 3.2], 0.5, { sc: [0.7, 0.35, 0.6] });
    view.anim.push((t) => { wt.offset.y = -t * 0.18; flames.forEach((f, i) => { const s = 1.3 + Math.sin(t * 17 + i * 2) * 0.12 + Math.sin(t * 29 + i) * 0.08; f.scale.setScalar(s); }); });
    // glowing mushrooms + hanging vines
    for (let k = 0; k < 10; k++) { const a = rd() * 6.28, x = Math.cos(a) * (12 + rd() * 5), z = Math.sin(a) * (8 + rd() * 3); if (Math.abs(x) < HX + 1.2 && Math.abs(z) < HZ + 1.2) continue; cyl(R, 0xe8e0c8, [x, 0.15, z], 0.05, 0.3, { cast: false }); view.glow.add(SPH, [0x6aff9a, 0xff7ad9, 0x6adfff][k % 3], [x, 0.34, z], [0.2, 0.1, 0.2], [0, 0, 0], 1.8); }
    this.clouds(view, 0x9fe8c0, [-1.2], 0.25);
    view.rim = 0xc8ff9a;
  },
  ice(view, rd) {
    const R = view.root, D = view.dyn;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#9fcbe9'; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${150 + rd() * 60},${200 + rd() * 40},255,${0.12 + rd() * 0.2})`; x.beginPath(); x.ellipse(rd() * w, rd() * h, 3 + rd() * 14, 2 + rd() * 8, rd() * 3, 0, 7); x.fill(); } for (let i = 0; i < 120; i++) { x.fillStyle = '#fff'; x.fillRect(rd() * w, rd() * h, 2, 2); } }, true), 14);
    // snowy pines, ice crystals, drifts, igloo, snowmen
    const n = gfx.quality === 'low' ? 11 : 17;
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + rd() * 0.25, x = Math.cos(a) * (16 + rd() * 5), z = Math.sin(a) * (11 + rd() * 3.5); pine(view, x, z, 1 + rd() * 0.7, true); }
    for (let k = 0; k < 7; k++) { const a = rd() * 6.28, x = Math.cos(a) * (13 + rd() * 6), z = Math.sin(a) * (9 + rd() * 3.5); if (Math.abs(x) < HX + 1.6 && Math.abs(z) < HZ + 1.6) continue; crystal(view, x, z, 0.8 + rd() * 0.8, [0x9fdcff, 0xb6e8ff, 0xcfc3ff][k % 3]); }
    for (let k = 0; k < 10; k++) { const a = rd() * 6.28, x = Math.cos(a) * (12.5 + rd() * 8), z = Math.sin(a) * (8.5 + rd() * 4); if (Math.abs(x) < HX + 1.4 && Math.abs(z) < HZ + 1.4) continue; sph(R, 0xf4fbff, [x, 0, z], 1, { sc: [1.6 + rd(), 0.5 + rd() * 0.3, 1.2 + rd()] }); }
    sph(R, 0xeaf6ff, [-15.5, -0.3, -8.5], 2, { sc: [2.2, 1.7, 2.2], ol: 0.03 }); box(R, 0x6aa6d6, [-15.5, 0.2, -6.5], [0.9, 0.9, 0.9]);
    for (const [x, z] of [[14.5, 8.8], [-13.5, 9.5]]) { sph(R, 0xffffff, [x, 0.35, z], 0.55, { ol: 0.03 }); sph(R, 0xffffff, [x, 1.0, z], 0.42, { ol: 0.03 }); sph(R, 0xffffff, [x, 1.5, z], 0.3, { ol: 0.03 }); cone(R, 0xff8a3a, [x, 1.5, z + 0.3], 0.07, 0.35, { rot: [Math.PI / 2, 0, 0] }); box(R, 0xe8503a, [x, 1.2, z], [0.5, 0.12, 0.5]); view.glow.add(SPH, 0x14142a, [x - 0.1, 1.55, z + 0.25], [0.04, 0.04, 0.04], [0, 0, 0], 1).add(SPH, 0x14142a, [x + 0.1, 1.55, z + 0.25], [0.04, 0.04, 0.04], [0, 0, 0], 1); }
    // aurora ribbons far behind (additive gradient planes, gentle sway)
    const au = cv(256, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(0.5, 'rgba(120,255,200,.8)'); g.addColorStop(1, 'rgba(120,160,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, true); au.repeat.set(2, 1);
    const ribbons = []; for (let i = 0; i < (gfx.quality === 'low' ? 1 : 2); i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 7, 12, 1), new THREE.MeshBasicMaterial({ map: au, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: i ? 0xb78cff : 0x7dffcf })); m.position.set(0, 5 + i * 1.6, -HZ - 9 - i * 3); m.rotation.x = -0.2; D.add(m); ribbons.push(m); }
    view.anim.push((t) => { au.offset.x = t * 0.012; ribbons.forEach((m, i) => { m.material.opacity = 0.26 + Math.sin(t * 0.7 + i * 2) * 0.08; const p = m.geometry.attributes.position; for (let v = 0; v < p.count; v++) p.setY(v, (v < 13 ? 3.5 : -3.5) + Math.sin(p.getX(v) * 0.25 + t * 0.9 + i) * 0.9); p.needsUpdate = true; }); });
    // glinting frozen lake near the corner
    const lake = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ color: 0x8fd0f8 })); lake.rotation.x = -Math.PI / 2; lake.position.set(14.5, -0.22, -8.8); R.add(lake);
    this.clouds(view, 0xe6f4ff, [-2.8], 0.28);
    view.rim = 0xbfe6ff;
  },
  clouds(view, color, ys, op) {
    const tex = cv(256, 256, (x, w, h) => { const rd = mulberry32(5); for (let i = 0; i < 26; i++) { const px = rd() * w, py = rd() * h, r = 18 + rd() * 34; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } }, true); tex.repeat.set(3, 2);
    if (gfx.quality === 'low') ys = ys.slice(0, 1);
    ys.forEach((y, i) => { const t2 = tex.clone(); t2.needsUpdate = true; t2.repeat.set(3 - i * 0.5, 2); const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshBasicMaterial({ map: t2, color, transparent: true, opacity: op, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; view.dyn.add(m); view.anim.push((t) => { t2.offset.x = t * 0.006 * (i + 1); t2.offset.y = t * 0.003 * (i + 1); }); });
  },
};

// ---------- baked-look floor pattern (emblem, edge shading, light pool, AO under pillars, scuffs) ----------
export function floorPattern(view, id, layout, rd) {
  const W = 1024, H = Math.round(1024 * AH / AW), px = W / AW;
  const t = cv(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    // center light pool (baked gradient lighting)
    let g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(255,255,255,.20)'); g.addColorStop(0.55, 'rgba(255,255,255,.04)'); g.addColorStop(1, 'rgba(0,0,0,.30)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // edge darkening
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 36], [0, H, 0, H - 36], [0, 0, 36, 0], [W, 0, W - 36, 0]]) { const e = x.createLinearGradient(x0, y0, x1, y1); e.addColorStop(0, 'rgba(0,0,0,.34)'); e.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = e; x.fillRect(0, 0, W, H); }
    x.save(); x.translate(W / 2, H / 2);
    const ring = (r, c, w, a = 1) => { x.strokeStyle = c; x.lineWidth = w; x.globalAlpha = a; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); x.globalAlpha = 1; };
    if (id === 'dojo') { ring(px * 2.7, '#f6f1d8', 7, 0.75); ring(px * 2.3, '#f6f1d8', 3, 0.6); x.strokeStyle = '#f6f1d8'; x.globalAlpha = 0.75; x.lineWidth = 9; x.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * 2.094; x.beginPath(); x.arc(Math.cos(a) * px * 0.9, Math.sin(a) * px * 0.9, px * 1.1, a + 0.4, a + 2.6); x.stroke(); } x.globalAlpha = 1; }
    else if (id === 'rooftop') { ring(px * 2.8, '#00e5ff', 8, 0.65); ring(px * 2.2, '#ff2bd6', 5, 0.55); x.strokeStyle = '#00e5ff'; x.globalAlpha = 0.5; x.lineWidth = 6; for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * Math.PI / 2); x.beginPath(); x.moveTo(px * 0.7, 0); x.lineTo(px * 2.1, 0); x.moveTo(px * 1.6, -px * 0.25); x.lineTo(px * 2.1, 0); x.lineTo(px * 1.6, px * 0.25); x.stroke(); x.restore(); } x.globalAlpha = 1; }
    else if (id === 'jungle') { ring(px * 2.7, '#3d5a36', 10, 0.55); ring(px * 2.0, '#3d5a36', 4, 0.5); x.fillStyle = '#3d5a36'; x.globalAlpha = 0.5; for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.fillRect(px * 2.0, -4, px * 0.7, 8); x.restore(); } x.globalAlpha = 1; }
    else { ring(px * 2.7, '#ffffff', 8, 0.85); ring(px * 2.2, '#9fdcff', 4, 0.6); x.strokeStyle = '#ffffff'; x.globalAlpha = 0.8; x.lineWidth = 6; x.lineCap = 'round'; for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(px * 0.4, 0); x.lineTo(px * 2.0, 0); x.moveTo(px * 1.4, 0); x.lineTo(px * 1.8, px * 0.35); x.moveTo(px * 1.4, 0); x.lineTo(px * 1.8, -px * 0.35); x.stroke(); x.restore(); } x.globalAlpha = 1; }
    x.restore();
    // corner marks + spawn pads
    for (const [i, j] of [[2, 2], [17, 9], [17, 2], [2, 9]]) { const X = (i + 0.5) * px, Y = (j + 0.5) * px; x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 4; x.beginPath(); x.arc(X, Y, px * 0.42, 0, 7); x.stroke(); x.globalAlpha = 0.18; x.fillStyle = '#fff'; x.fill(); x.globalAlpha = 1; }
    // scuffs / dirt / cracks
    for (let i = 0; i < 90; i++) { const X = rd() * W, Y = rd() * H; const a = id === 'ice' ? 0.12 : 0.1; x.fillStyle = id === 'ice' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; x.beginPath(); x.ellipse(X, Y, 6 + rd() * 22, 2 + rd() * 8, rd() * 3, 0, 7); x.fill(); }
    if (id === 'ice' || id === 'jungle') { x.strokeStyle = id === 'ice' ? 'rgba(150,200,255,.5)' : 'rgba(30,50,30,.35)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { let X = rd() * W, Y = rd() * H; x.beginPath(); x.moveTo(X, Y); for (let s = 0; s < 5; s++) { X += (rd() - 0.5) * 60; Y += (rd() - 0.5) * 60; x.lineTo(X, Y); } x.stroke(); } }
    // soft AO under pillars + rim wall shadow
    for (let k = 0; k < AW * AH; k++) { if (layout.t[k] !== 1) continue; const X = ((k % AW) + 0.5) * px, Y = (Math.floor(k / AW) + 0.5) * px; const gr = x.createRadialGradient(X, Y, px * 0.2, X, Y, px * 0.95); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(X - px, Y - px, px * 2, px * 2); }
  });
  t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function patchFloor(mat, tex) {
  const prev = mat.onBeforeCompile; const u = { value: tex };
  mat.onBeforeCompile = (sh, r) => {
    prev && prev(sh, r); sh.uniforms.uPat = u;
    sh.vertexShader = 'varying vec2 vPatUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n vec4 pw = modelMatrix * instanceMatrix * vec4(position, 1.0); vPatUv = vec2((pw.x + ${HX.toFixed(1)}) / ${AW.toFixed(1)}, 1.0 - (pw.z + ${HZ.toFixed(1)}) / ${AH.toFixed(1)});`);
    sh.fragmentShader = 'uniform sampler2D uPat; varying vec2 vPatUv;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n { vec4 pt = texture2D(uPat, vPatUv); float lum = dot(pt.rgb, vec3(0.333)); diffuseColor.rgb = mix(diffuseColor.rgb, pt.rgb, pt.a * 0.55) ; diffuseColor.rgb *= 1.0; }');
  };
  mat.customProgramCacheKey = () => 'rimtoon-floorpat'; mat.needsUpdate = true;
}
export function buildScenery(view, id, layout) {
  const rd = mulberry32(11 + id.length * 31); view.dyn = new THREE.Group(); view.scene.add(view.dyn); view.anim = []; view.pools = []; view.glow = new Batch();
  (BUILD[id] || BUILD.dojo).call(BUILD, view, rd);
  // lantern/torch light pools (soft additive discs on the ground)
  if (view.pools.length) { const b = new Batch(); const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2); for (const [x, z, r, c] of view.pools) b.add(pg, c, [x, -0.27, z], [r * 2, 1, r * 2], [0, 0, 0], 0.35); const m = b.build(view.root, { add: true }); if (m) { m.material.map = softTex(); m.material.vertexColors = true; m.material.needsUpdate = true; const uv = new Float32Array(m.geometry.attributes.position.count * 2); for (let i = 0; i < uv.length / 12; i++) uv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], i * 12); m.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.renderOrder = 1; } }
  const gm = view.glow.build(view.root); if (gm) gm.userData.keep = true;
  return floorPattern(view, id, layout, rd);
}
export function updateScenery(view, t, dt) { for (const f of view.anim) f(t, dt); }
