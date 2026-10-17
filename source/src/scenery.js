// Per-theme arena dressing: ground, props, lights, water/lava/neon, and a baked-look floor pattern. Static things live under view.root (merged on Sharp/Fast); animated bits live under view.dyn.
import { THREE, gfx, toon, mesh, glowSprite, glowTexture, softTex, RIM } from './gfx.js';
const mergeGeometries = (gs) => { let n = 0; for (const g of gs) n += g.attributes.position.count; const out = new THREE.BufferGeometry(); for (const name of Object.keys(gs[0].attributes)) { const sz = gs[0].attributes[name].itemSize, arr = new Float32Array(n * sz); let o = 0; for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); } return out; };
import { AW, AH, HX, HZ, cx, cz, idx, mulberry32, arenaScale, setArenaSize, ARENA_SIZE } from './util.js';
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
  volcano(view, rd) {
    const R = view.root, D = view.dyn, wb = view.glow;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#2b1613'; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${60 + rd() * 40},${25 + rd() * 20},20,${0.3 + rd() * 0.4})`; x.fillRect(rd() * w, rd() * h, 2 + rd() * 9, 2 + rd() * 6); } x.strokeStyle = 'rgba(255,110,30,.55)'; x.lineWidth = 2; for (let i = 0; i < 16; i++) { let X = rd() * w, Y = rd() * h; x.beginPath(); x.moveTo(X, Y); for (let k = 0; k < 5; k++) { X += (rd() - 0.5) * 50; Y += (rd() - 0.5) * 50; x.lineTo(X, Y); } x.stroke(); } }, true), 12);
    // lava rivers on both sides (animated)
    const lt = cv(256, 256, (x, w, h) => { x.fillStyle = '#ff6a10'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = rd() < 0.5 ? '#ffc040' : '#c8340a'; x.beginPath(); x.ellipse(rd() * w, rd() * h, 8 + rd() * 26, 4 + rd() * 10, rd() * 3, 0, 7); x.fill(); } }, true); lt.repeat.set(1, 5);
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 46), new THREE.MeshBasicMaterial({ map: lt, color: new THREE.Color(1.5, 1.1, 0.9) })); m.rotation.x = -Math.PI / 2; m.position.set(sx * (HX + 6.6), -0.2, 0); R.add(m); view.pools.push([sx * (HX + 6.6), -3, 5, 0xff6a1a], [sx * (HX + 6.6), 4, 5, 0xff6a1a]); }
    view.anim.push((t) => { lt.offset.y = -t * 0.08; });
    // the volcano
    cone(R, 0x2a1a1c, [0, 6, -26], 11, 14, { ol: 0.02, cast: false }); const crater = glowSprite(0xff6a1a, 11, 0.9); crater.position.set(0, 13.2, -26); D.add(crater); view.anim.push((t) => { crater.material.opacity = 0.75 + Math.sin(t * 2) * 0.15; });
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; wb.add(BOXG, 0xff7a1a, [Math.sin(a) * 5, 8, -22 + Math.cos(a) * -1.5], [0.18, 7, 0.1], [0.2, 0, a * 0.5], 1.8); }
    // basalt columns, rocks, obsidian crystals
    for (let k = 0; k < 26; k++) { const a = rd() * 6.28, x = Math.cos(a) * (14 + rd() * 8), z = Math.sin(a) * (10 + rd() * 6); if (Math.abs(x) < HX + 2 && Math.abs(z) < HZ + 2) continue; if (Math.abs(x) > HX + 4.5 && Math.abs(x) < HX + 8.8) continue; const h = 1 + rd() * 2.4; cyl(R, 0x3a2a30, [x, h / 2, z], 0.4 + rd() * 0.3, h, { ol: 0.03 }); if (rd() < 0.4) wb.add(CYL, 0xff7a1a, [x, h + 0.02, z], [0.3, 0.04, 0.3], [0, 0, 0], 1.6); }
    for (let k = 0; k < 6; k++) crystal(view, (k < 3 ? -1 : 1) * (HX + 2.4 + rd() * 1.4), -8 + (k % 3) * 8 + rd() * 2, 1 + rd() * 0.6, 0x4a3a60);
    // forges with fire in the corners
    const fl = []; for (const [x, z] of [[-HX - 1.8, -HZ - 1.6], [HX + 1.8, -HZ - 1.6], [-HX - 1.8, HZ + 1.6], [HX + 1.8, HZ + 1.6]]) { box(R, 0x4a4048, [x, 0.4, z], [1.2, 0.8, 1.0], { ol: 0.03 }); box(R, 0x2a2430, [x, 0.95, z], [0.7, 0.2, 0.5], { ol: 0.03 }); cyl(R, 0x3a3038, [x + 0.3, 1.5, z - 0.2], 0.16, 1.2); const f = glowSprite(0xff8a2a, 1.5, 0.95); f.position.set(x, 1.3, z); D.add(f); fl.push(f); view.pools.push([x, z, 2.8, 0xff7a1a]); }
    view.anim.push((t) => fl.forEach((f, i) => f.scale.setScalar(1.5 + Math.sin(t * 16 + i * 2) * 0.15 + Math.sin(t * 27 + i) * 0.08)));
    this.clouds(view, 0xff7a4a, [-2.2], 0.22); view.rim = 0xff9a5a;
  },
  pirate(view, rd) {
    const R = view.root, D = view.dyn, wb = view.glow;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#e8d49a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${150 + rd() * 60},${120 + rd() * 50},${70 + rd() * 30},${0.25 + rd() * 0.3})`; x.fillRect(rd() * w, rd() * h, 1 + rd() * 3, 1 + rd() * 3); } }, true), 12);
    // sea strips with animated waves + foam
    const wt = cv(256, 256, (x, w, h) => { x.fillStyle = '#2fb4e8'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 4; for (let i = 0; i < 8; i++) { x.beginPath(); const yy = i * 34 + 10; x.moveTo(0, yy); for (let X = 0; X <= 256; X += 16) x.lineTo(X, yy + Math.sin(X / 20 + i) * 6); x.stroke(); } }, true); wt.repeat.set(5, 2);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(110, 26), new THREE.MeshBasicMaterial({ map: wt })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.15, HZ + 11.5); R.add(sea); const sea2 = sea.clone(); sea2.position.z = -HZ - 15; R.add(sea2);
    view.anim.push((t) => { wt.offset.x = t * 0.02; wt.offset.y = Math.sin(t * 0.6) * 0.02; });
    // pirate ship at the back
    const sh = new THREE.Group(); sh.position.set(-3, -0.3, -HZ - 9); R.add(sh); box(sh, 0x6b4426, [0, 1.0, 0], [9, 1.6, 3.2], { ol: 0.03 }); box(sh, 0x8a5a32, [0, 1.95, 0], [9.4, 0.3, 3.6], { ol: 0.03 }); box(sh, 0x7a4e2a, [4.6, 2.5, 0], [1.6, 1.2, 3], { ol: 0.03 }); for (const mx of [-2.2, 1.6]) { cyl(sh, 0x5a3a1a, [mx, 4.6, 0], 0.14, 5.4, { ol: 0.02 }); box(sh, 0xf6f1e0, [mx, 4.8, 0.2], [0.08, 2.6, 2.6], { cast: false }); box(sh, 0x5a3a1a, [mx, 6.0, 0], [0.08, 0.1, 3.0], { cast: false }); }
    box(sh, 0x1a1a22, [-1, 7.5, 0], [0.08, 0.7, 1.1], { cast: false }); wb.add(SPH, 0xffffff, [-1, 7.5, 0.05], [0.14, 0.14, 0.14], [0, 0, 0], 1.2); for (let i = 0; i < 4; i++) cyl(sh, 0x1a1a22, [-3 + i * 2, 2.3, 1.7], 0.18, 0.5, { rot: [Math.PI / 2, 0, 0] });
    // palms, barrels, treasure, cannons, lanterns, signs
    for (const [x, z, sc] of [[-16, -8, 1.3], [-18, 2, 1.1], [17, -9, 1.2], [18, 4, 1.4], [-14, 9, 1], [14, 10, 1.1], [3, -11, 1]]) palm(view, x, z, sc);
    for (let k = 0; k < 10; k++) { const side = k % 2 ? 1 : -1, x = side * (HX + 2 + rd() * 3), z = -HZ + rd() * 2 * HZ; cyl(R, 0x8a5a2e, [x, 0.4, z], 0.38, 0.8, { ol: 0.03 }); box(R, 0x4a2c14, [x, 0.3, z], [0.8, 0.06, 0.8], { cast: false }); box(R, 0x4a2c14, [x, 0.6, z], [0.8, 0.06, 0.8], { cast: false }); }
    box(R, 0x7a4a22, [HX + 3.4, 0.35, HZ - 1], [1.2, 0.7, 0.8], { ol: 0.03 }); box(R, 0xffc02a, [HX + 3.4, 0.78, HZ - 1], [1.1, 0.14, 0.7]); wb.add(SPH, 0xffd24a, [HX + 3.4, 0.9, HZ - 1], [0.5, 0.18, 0.4], [0, 0, 0], 1.8); view.pools.push([HX + 3.4, HZ - 1, 2, 0xffc02a]);
    for (const [x, z, r] of [[-HX - 2.2, -2, 0.5], [-HX - 2.2, 2.5, 0.5], [HX + 2.2, -2.5, -0.5], [HX + 2.2, 2, -0.5]]) { box(R, 0x6b4a2e, [x, 0.25, z], [0.9, 0.3, 0.5]); cyl(R, 0x22222a, [x + r * 0.5, 0.65, z], 0.2, 1.1, { rot: [0, 0, Math.PI / 2 * (r > 0 ? 1 : -1)], ol: 0.025 }); }
    for (const [x, z] of [[-HX - 1.6, -HZ - 1.4], [HX + 1.6, -HZ - 1.4], [-HX - 1.6, HZ + 1.4], [HX + 1.6, HZ + 1.4]]) lantern(view, x, z, 1, 0xffc060);
    this.clouds(view, 0xffffff, [-3], 0.2); view.rim = 0xffe0a0;
  },
  space(view, rd) {
    const R = view.root, D = view.dyn, wb = view.glow;
    // floating deck: smaller metal platform, void + stars below
    { const w = HX + 5, d = HZ + 5; const m = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.6, d * 2), toon(0x2a3156)); m.position.set(0, -0.62, 0); R.add(m); box(R, 0x1a2040, [0, -0.2, 0], [w * 2 + 0.6, 0.12, d * 2 + 0.6], { cast: false }); for (const sx of [-1, 1]) for (let i = -4; i <= 4; i++) wb.add(BOXG, 0x36e0ff, [sx * (w - 0.2) , -0.28, i * (d / 4.4)], [0.12, 0.05, 0.9], [0, 0, 0], 1.6); for (const sz of [-1, 1]) for (let i = -5; i <= 5; i++) wb.add(BOXG, 0xff4fd8, [i * (w / 5.4), -0.28, sz * (d - 0.2)], [0.9, 0.05, 0.12], [0, 0, 0], 1.4); }
    const sp = new THREE.BufferGeometry(); const N = 520, pos = new Float32Array(N * 3), col = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (rd() - 0.5) * 140; pos[i * 3 + 1] = -6 - rd() * 3; pos[i * 3 + 2] = (rd() - 0.5) * 100; const c = new THREE.Color().setHSL(rd() < 0.3 ? 0.58 : 0.1, 0.4, 0.7 + rd() * 0.3); col.set([c.r, c.g, c.b], i * 3); } sp.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sp.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(sp, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, fog: false, sizeAttenuation: true })); D.add(stars); view.anim.push((t) => { stars.position.x = Math.sin(t * 0.03) * 2; });
    // planet + ring below/behind
    const pl = new THREE.Mesh(new THREE.SphereGeometry(18, 28, 20), new THREE.MeshBasicMaterial({ map: cv(256, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff9a5a'); g.addColorStop(0.5, '#c8506a'); g.addColorStop(1, '#4a2a8a'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(255,255,255,${0.05 + rd() * 0.1})`; x.fillRect(0, rd() * h, w, 3 + rd() * 8); } }, true), fog: false })); pl.position.set(-14, -26, -36); D.add(pl); const rg = new THREE.Mesh(new THREE.RingGeometry(23, 30, 48), new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false })); rg.rotation.x = -1.2; rg.position.copy(pl.position); D.add(rg);
    // station props: antenna dishes, solar panels, beacon lights, crates
    for (const [x, z] of [[-HX - 3.4, -3], [HX + 3.4, 3], [-HX - 3.2, 5], [HX + 3.2, -5]]) { cyl(R, 0x3a4272, [x, 0.7, z], 0.12, 1.4); const d = cone(R, 0x8a96c8, [x, 1.6, z], 0.8, 0.5, { rot: [Math.PI, 0, 0.4], ol: 0.02 }); wb.add(SPH, 0xff4fd8, [x, 1.9, z], [0.1, 0.1, 0.1], [0, 0, 0], 2); }
    for (const sx of [-1, 1]) { box(R, 0x2a3060, [sx * (HX + 4.8), 0.6, 0], [0.2, 0.2, 6]); for (let i = -1; i <= 1; i++) { box(R, 0x3a58c8, [sx * (HX + 4.8), 0.9, i * 2.4], [2.2, 0.06, 2], { cast: false }); wb.add(BOXG, 0x66aaff, [sx * (HX + 4.8), 0.95, i * 2.4], [2.0, 0.02, 1.8], [0, 0, 0], 0.5); } }
    const beac = []; for (const [x, z] of [[-HX - 2, -HZ - 2], [HX + 2, -HZ - 2], [-HX - 2, HZ + 2], [HX + 2, HZ + 2]]) { cyl(R, 0x2a3060, [x, 0.5, z], 0.3, 1.0, { ol: 0.03 }); const g = glowSprite(0x36e0ff, 1.4, 0.9); g.position.set(x, 1.2, z); D.add(g); beac.push(g); view.pools.push([x, z, 2.4, 0x36e0ff]); }
    view.anim.push((t) => beac.forEach((g, i) => { g.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 2 + i)); }));
    view.rim = 0x9ab4ff;
  },
  haunted(view, rd) {
    const R = view.root, D = view.dyn, wb = view.glow;
    groundFrame(view, cv(256, 256, (x, w, h) => { x.fillStyle = '#2d2444'; x.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { x.fillStyle = `hsla(${255 + rd() * 30},30%,${16 + rd() * 14}%,.6)`; x.fillRect(rd() * w, rd() * h, 2 + rd() * 6, 2 + rd() * 8); } }, true), 12);
    // manor at the back
    const mn = new THREE.Group(); mn.position.set(2, -0.3, -HZ - 11); R.add(mn); box(mn, 0x3a3050, [0, 3, 0], [13, 6, 5], { ol: 0.03 }); box(mn, 0x4a3a66, [-4.5, 5.5, 0], [4, 7, 4.4], { ol: 0.03 }); cone(mn, 0x2a2040, [-4.5, 11.2, 0], 3.2, 4, { ol: 0.03 }); box(mn, 0x2a2040, [2, 6.6, 0], [13.4, 0.8, 5.4]); cone(mn, 0x2a2040, [2.5, 8.6, 0], 5.6, 2.6, { rot: [0, Math.PI / 4, 0] }); cyl(mn, 0x3a3050, [5, 9, 0], 0.5, 2.4);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) if (rd() < 0.75) wb.add(BOXG, rd() < 0.5 ? 0xffd070 : 0x9a7aff, [2 - 3.5 + c * 2.1 + (c > 1 ? 0.5 : 0), -0.3 + 1.3 + r * 1.7, -HZ - 11 + 2.55], [0.8, 1.0, 0.04], [0, 0, 0], 1.7); wb.add(BOXG, 0xffa030, [2 + 1, -0.3 + 1.2, -HZ - 11 + 2.56], [1.0, 2.0, 0.05], [0, 0, 0], 1.3);
    // moon + glow
    const moon = glowSprite(0xfff4c0, 14, 0.85); moon.position.set(12, 14, -34); D.add(moon); const moon2 = glowSprite(0xffffff, 4.2, 1); moon2.position.copy(moon.position); D.add(moon2);
    // dead trees, gravestones, iron fence, pumpkins, candles
    for (let k = 0; k < 14; k++) { const a = rd() * 6.28, x = Math.cos(a) * (15 + rd() * 6), z = Math.sin(a) * (10 + rd() * 5); if (Math.abs(x) < HX + 2 && Math.abs(z) < HZ + 2) continue; if (z < -HZ - 6 && Math.abs(x) < 10) continue; const h = 2.4 + rd() * 2; cyl(R, 0x2a2030, [x, h / 2, z], 0.2, h, { rot: [0, 0, (rd() - 0.5) * 0.2], ol: 0.025 }); for (let b = 0; b < 3; b++) cyl(R, 0x2a2030, [x + (b - 1) * 0.5, h * 0.8, z], 0.07, 1.4, { rot: [0, 0, (b - 1) * 0.9], cast: false }); }
    for (let k = 0; k < 16; k++) { const side = k % 2 ? 1 : -1, x = side * (HX + 2.5 + rd() * 5), z = -8 + rd() * 16; box(R, 0x7a7a8c, [x, 0.4, z], [0.6, 0.8, 0.18], { ol: 0.025, rot: [0, (rd() - 0.5) * 0.4, (rd() - 0.5) * 0.15] }); sph(R, 0x7a7a8c, [x, 0.8, z], 0.3, { sc: [0.3, 0.2, 0.09] }); }
    for (let i = -8; i <= 8; i++) { if (Math.abs(i) < 1) continue; cyl(R, 0x1a1626, [i * 2, 0.7, HZ + 3.2], 0.05, 1.4, { cast: false }); cone(R, 0x1a1626, [i * 2, 1.5, HZ + 3.2], 0.1, 0.25, { cast: false }); } box(R, 0x1a1626, [0, 1.0, HZ + 3.2], [32, 0.05, 0.05], { cast: false });
    for (const [x, z] of [[-HX - 2, HZ + 1.8], [HX + 2, HZ + 1.8], [-HX - 2.4, -3], [HX + 2.4, -4]]) { sph(R, 0xff8a1a, [x, 0.35, z], 0.45, { sc: [0.5, 0.38, 0.5], ol: 0.02 }); wb.add(SPH, 0xffd060, [x, 0.38, z + 0.2], [0.14, 0.12, 0.05], [0, 0, 0], 2.4); view.pools.push([x, z, 2.2, 0xff8a1a]); }
    const can = []; for (let i = 0; i < 9; i++) { const g = glowSprite(0xffe0a0, 0.55, 0.95); g.position.set((rd() - 0.5) * 36, 1.8 + rd() * 1.5, (rd() - 0.5) * 20); if (Math.abs(g.position.x) < HX + 1 && Math.abs(g.position.z) < HZ + 1) g.position.z += HZ + 3; D.add(g); can.push([g, rd() * 6]); }
    // ghosts
    const gh = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.4, depthWrite: false })); m.scale.set(1, 1.3, 1); D.add(m); gh.push(m); }
    view.anim.push((t) => { can.forEach(([g, p]) => { g.position.y += Math.sin(t * 1.3 + p) * 0.002; g.material.opacity = 0.7 + 0.3 * Math.sin(t * 7 + p); }); gh.forEach((m, i) => { const a = t * (0.25 + i * 0.07) + i * 2.1; m.position.set(Math.cos(a) * (HX + 7 + i * 2), 1.6 + Math.sin(t * 1.4 + i) * 0.3, Math.sin(a) * (HZ + 6 + i)); }); });
    this.clouds(view, 0xb8a8ff, [-1.4, -3.4], 0.2); view.rim = 0xb49aff;
  },
  clouds(view, color, ys, op) {
    const tex = cv(256, 256, (x, w, h) => { const rd = mulberry32(5); for (let i = 0; i < 26; i++) { const px = rd() * w, py = rd() * h, r = 18 + rd() * 34; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } }, true); tex.repeat.set(3, 2);
    if (gfx.quality === 'low') ys = ys.slice(0, 1);
    ys.forEach((y, i) => { const t2 = tex.clone(); t2.needsUpdate = true; t2.repeat.set(3 - i * 0.5, 2); const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshBasicMaterial({ map: t2, color, transparent: true, opacity: op, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; view.dyn.add(m); view.anim.push((t) => { t2.offset.x = t * 0.006 * (i + 1); t2.offset.y = t * 0.003 * (i + 1); }); });
  },
};

// ---------- baked-look floor pattern (emblem, edge shading, light pool, AO under pillars, scuffs) ----------
export function floorPattern(view, id, layout, rd) {
  const W = 1024, H = Math.round(1024 * AH / AW), px = W / AW, E = px * (AW / 20);
  const t = cv(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    // center light pool (baked gradient lighting)
    let g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(255,255,255,.20)'); g.addColorStop(0.55, 'rgba(255,255,255,.04)'); g.addColorStop(1, 'rgba(0,0,0,.30)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // edge darkening
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 36], [0, H, 0, H - 36], [0, 0, 36, 0], [W, 0, W - 36, 0]]) { const e = x.createLinearGradient(x0, y0, x1, y1); e.addColorStop(0, 'rgba(0,0,0,.34)'); e.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = e; x.fillRect(0, 0, W, H); }
    x.save(); x.translate(W / 2, H / 2);
    const ring = (r, c, w, a = 1) => { x.strokeStyle = c; x.lineWidth = w; x.globalAlpha = a; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); x.globalAlpha = 1; };
    if (id === 'dojo') { ring(E * 2.7, '#f6f1d8', 7, 0.75); ring(E * 2.3, '#f6f1d8', 3, 0.6); x.strokeStyle = '#f6f1d8'; x.globalAlpha = 0.75; x.lineWidth = 9; x.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * 2.094; x.beginPath(); x.arc(Math.cos(a) * E * 0.9, Math.sin(a) * E * 0.9, E * 1.1, a + 0.4, a + 2.6); x.stroke(); } x.globalAlpha = 1; }
    else if (id === 'rooftop') { ring(E * 2.8, '#00e5ff', 8, 0.65); ring(E * 2.2, '#ff2bd6', 5, 0.55); x.strokeStyle = '#00e5ff'; x.globalAlpha = 0.5; x.lineWidth = 6; for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * Math.PI / 2); x.beginPath(); x.moveTo(E * 0.7, 0); x.lineTo(E * 2.1, 0); x.moveTo(E * 1.6, -E * 0.25); x.lineTo(E * 2.1, 0); x.lineTo(E * 1.6, E * 0.25); x.stroke(); x.restore(); } x.globalAlpha = 1; }
    else if (id === 'jungle') { ring(E * 2.7, '#3d5a36', 10, 0.55); ring(E * 2.0, '#3d5a36', 4, 0.5); x.fillStyle = '#3d5a36'; x.globalAlpha = 0.5; for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.fillRect(E * 2.0, -4, E * 0.7, 8); x.restore(); } x.globalAlpha = 1; }
    else if (id === 'volcano') { ring(E * 2.8, '#ff7a1a', 9, 0.7); ring(E * 2.2, '#ffb347', 4, 0.6); x.strokeStyle = '#ff7a1a'; x.globalAlpha = 0.6; x.lineWidth = 6; x.lineCap = 'round'; for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.beginPath(); x.moveTo(E * 2.3, 0); x.lineTo(E * 2.8, 0); x.moveTo(E * 0.6, -E * 0.3); x.lineTo(E * 1.4, 0); x.lineTo(E * 0.6, E * 0.3); x.stroke(); x.restore(); } x.globalAlpha = 1; }
    else if (id === 'pirate') { ring(E * 2.7, '#5a3a1a', 8, 0.6); ring(E * 2.2, '#f4e3b0', 4, 0.6); x.fillStyle = '#5a3a1a'; x.globalAlpha = 0.65; for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * Math.PI / 2); x.beginPath(); x.moveTo(0, -E * 2.6); x.lineTo(E * 0.4, 0); x.lineTo(-E * 0.4, 0); x.closePath(); x.fill(); x.restore(); } x.globalAlpha = 1; }
    else if (id === 'space') { ring(E * 2.8, '#36e0ff', 6, 0.6); ring(E * 2.3, '#ff4fd8', 3, 0.5); ring(E * 1.4, '#36e0ff', 3, 0.5); x.strokeStyle = '#36e0ff'; x.globalAlpha = 0.5; x.lineWidth = 4; for (let i = 0; i < 12; i++) { x.save(); x.rotate(i * Math.PI / 6); x.beginPath(); x.moveTo(E * 2.3, 0); x.lineTo(E * 2.8, 0); x.stroke(); x.restore(); } x.globalAlpha = 1; }
    else if (id === 'haunted') { ring(E * 2.7, '#b49aff', 6, 0.55); ring(E * 1.9, '#b49aff', 3, 0.45); x.strokeStyle = '#b49aff'; x.globalAlpha = 0.5; x.lineWidth = 4; x.beginPath(); for (let i = 0; i < 6; i++) { const a2 = i * Math.PI * 4 / 5 - Math.PI / 2; const X2 = Math.cos(a2) * E * 1.9, Y2 = Math.sin(a2) * E * 1.9; i ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2); } x.stroke(); x.globalAlpha = 1; }
    else { ring(E * 2.7, '#ffffff', 8, 0.85); ring(E * 2.2, '#9fdcff', 4, 0.6); x.strokeStyle = '#ffffff'; x.globalAlpha = 0.8; x.lineWidth = 6; x.lineCap = 'round'; for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(E * 0.4, 0); x.lineTo(E * 2.0, 0); x.moveTo(E * 1.4, 0); x.lineTo(E * 1.8, E * 0.35); x.moveTo(E * 1.4, 0); x.lineTo(E * 1.8, -E * 0.35); x.stroke(); x.restore(); } x.globalAlpha = 1; }
    x.restore();
    // corner marks + spawn pads
    for (const [i, j] of [[2, 2], [AW - 3, AH - 3], [AW - 3, 2], [2, AH - 3]]) { const X = (i + 0.5) * px, Y = (j + 0.5) * px; x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 4; x.beginPath(); x.arc(X, Y, px * 0.42, 0, 7); x.stroke(); x.globalAlpha = 0.18; x.fillStyle = '#fff'; x.fill(); x.globalAlpha = 1; }
    // scuffs / dirt / cracks
    for (let i = 0; i < Math.round(90 * (AW * AH) / 240); i++) { const X = rd() * W, Y = rd() * H; const a = id === 'ice' ? 0.12 : 0.1; x.fillStyle = id === 'ice' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; x.beginPath(); x.ellipse(X, Y, 6 + rd() * 22, 2 + rd() * 8, rd() * 3, 0, 7); x.fill(); }
    if (id === 'ice' || id === 'jungle') { x.strokeStyle = id === 'ice' ? 'rgba(150,200,255,.5)' : 'rgba(30,50,30,.35)'; x.lineWidth = 2; for (let i = 0; i < Math.round(14 * (AW * AH) / 240); i++) { let X = rd() * W, Y = rd() * H; x.beginPath(); x.moveTo(X, Y); for (let s = 0; s < 5; s++) { X += (rd() - 0.5) * 60; Y += (rd() - 0.5) * 60; x.lineTo(X, Y); } x.stroke(); } }
    // soft AO under pillars + rim wall shadow
    for (let k = 0; k < AW * AH; k++) { if (layout.t[k] !== 1) continue; const X = ((k % AW) + 0.5) * px, Y = (Math.floor(k / AW) + 0.5) * px; const gr = x.createRadialGradient(X, Y, px * 0.2, X, Y, px * 0.95); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(X - px, Y - px, px * 2, px * 2); }
  });
  t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function patchFloor(mat, tex, ao) {
  const prev = mat.onBeforeCompile; const u = { value: tex }, ua = { value: ao };
  mat.onBeforeCompile = (sh, r) => {
    prev && prev(sh, r); sh.uniforms.uPat = u; sh.uniforms.uAO = ua;
    sh.vertexShader = 'varying vec2 vPatUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n vec4 pw = modelMatrix * instanceMatrix * vec4(position, 1.0); vPatUv = vec2((pw.x + ${HX.toFixed(1)}) / ${AW.toFixed(1)}, 1.0 - (pw.z + ${HZ.toFixed(1)}) / ${AH.toFixed(1)});`);
    sh.fragmentShader = 'uniform sampler2D uPat; uniform sampler2D uAO; varying vec2 vPatUv;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n { vec4 pt = texture2D(uPat, vPatUv); float lum = dot(pt.rgb, vec3(0.333)); diffuseColor.rgb = mix(diffuseColor.rgb, pt.rgb, pt.a * 0.55) ; diffuseColor.rgb *= 1.0 - texture2D(uAO, vPatUv).a * 0.46; }');
  };
  mat.customProgramCacheKey = () => 'rimtoon-floorpat'; mat.needsUpdate = true;
}
export function buildScenery(view, id, layout) {
  const rd = mulberry32(11 + id.length * 31); const [kx, kz] = arenaScale(); const big = kx > 1.01 || kz > 1.01;
  view.dyn = new THREE.Group(); view.scene.add(view.dyn); view.anim = []; view.pools = []; view.glow = new Batch();
  // props are authored for the Small (20x12) arena; build them in that context, then scale the whole group out to the real size
  const realRoot = view.root, scn = new THREE.Group(), dynScn = view.dyn; const sw = ARENA_SIZE; if (big) { view.root = scn; setArenaSize('small'); }
  (BUILD[id] || BUILD.dojo).call(BUILD, view, rd);
  if (view.pools.length) { const b = new Batch(); const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2); for (const [x, z, r, c] of view.pools) b.add(pg, c, [x, -0.27, z], [r * 2, 1, r * 2], [0, 0, 0], 0.35); const m = b.build(view.root, { add: true }); if (m) { m.material.map = softTex(); m.material.needsUpdate = true; m.renderOrder = 1; } }
  const gm = view.glow.build(view.root); if (gm) gm.userData.keep = true;
  if (big) { setArenaSize(sw); view.root = realRoot; const k = (kx + kz) / 2; scn.scale.set(kx, k, kz); realRoot.add(scn); dynScn.scale.set(kx, k, kz); }
  return floorPattern(view, id, layout, rd);
}
export function updateScenery(view, t, dt) { for (const f of view.anim) f(t, dt); }
