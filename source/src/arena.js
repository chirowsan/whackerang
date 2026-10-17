// Arena layouts + visuals (4 original themes).
import { THREE, gfx, toon, glowMat, basic, mesh, glowSprite, mergeToon, RIM } from './gfx.js';
import { AW, AH, HX, HZ, cx, cz, idx, inb, rnd, shuffle, mulberry32 } from './util.js';
import { buildCrate } from './models.js';
import { buildScenery, patchFloor, updateScenery } from './scenery.js';

export const T = { FLOOR: 0, PILLAR: 1, CRATE: 2, SPIKE: 3, LAVA: 4, CONV: 5 };
export const SPAWNS = [[2, 2], [17, 9], [17, 2], [2, 9]]; // cells; order picks far-apart pairs for 2 players

export const THEMES = {
  dojo: { bg: 0xbfe3ff, fog: 0xd9eeff, a: 0xd7edb0, b: 0xc3e096, rim: 0x6b4a2e, rimTop: 0xa77d52, hemi: [0xffffff, 0x9fb4a0, 1.0], sun: 1.9, ambient: 'dojo' },
  rooftop: { bg: 0x0c0d2e, fog: 0x0c0d2e, a: 0x252a5c, b: 0x1d2150, rim: 0x151a40, rimTop: 0xff2bd6, hemi: [0x8aa0ff, 0x221a50, 0.9], sun: 1.0, ambient: 'rooftop' },
  jungle: { bg: 0x1e5a44, fog: 0x2a7a58, a: 0x8ea46a, b: 0x7c9459, rim: 0x5c6b46, rimTop: 0x93a56f, hemi: [0xe6ffd0, 0x44603a, 1.0], sun: 1.7, ambient: 'jungle' },
  ice: { bg: 0x9cc8ea, fog: 0xb2d6f0, a: 0xa6d6f2, b: 0x8cc4e6, rim: 0x6aa6d6, rimTop: 0xcdeaff, hemi: [0xf4faff, 0x6f9fd0, 0.95], sun: 1.55, ambient: 'ice' },
};

export function genLayout(id, seed) {
  const r = mulberry32(seed || (Math.random() * 1e9) | 0);
  const t = new Uint8Array(AW * AH), dx = new Int8Array(AW * AH), dz = new Int8Array(AW * AH);
  const set = (i, j, v) => { t[idx(i, j)] = v; };
  const quad = (i, j, v) => { set(i, j, v); set(AW - 1 - i, j, v); set(i, AH - 1 - j, v); set(AW - 1 - i, AH - 1 - j, v); };
  const nearSpawn = (i, j) => SPAWNS.some(([a, b]) => Math.abs(i - a) <= 1 && Math.abs(j - b) <= 1);
  const free = (i, j) => t[idx(i, j)] === 0 && !nearSpawn(i, j) && !nearSpawn(AW - 1 - i, j) && !nearSpawn(i, AH - 1 - j);
  const randQuad = (n, v, filter) => { let c = 0, tries = 0; while (c < n && tries++ < 200) { const i = Math.floor(r() * 10), j = Math.floor(r() * 6); if (!free(i, j) || (filter && !filter(i, j))) continue; quad(i, j, v); c++; } };
  if (id === 'dojo') {
    [[5, 1], [6, 4], [3, 5]].forEach(([i, j]) => quad(i, j, T.PILLAR)); randQuad(2, T.SPIKE); randQuad(7, T.CRATE);
  } else if (id === 'rooftop') {
    for (let i = 3; i <= 16; i++) { set(i, 4, T.CONV); dx[idx(i, 4)] = 1; set(i, 7, T.CONV); dx[idx(i, 7)] = -1; }
    [[5, 2], [8, 1]].forEach(([i, j]) => quad(i, j, T.PILLAR)); randQuad(6, T.CRATE, (i, j) => j !== 4 && j !== 3);
  } else if (id === 'jungle') {
    [[4, 1], [6, 3], [3, 4], [8, 1]].forEach(([i, j]) => quad(i, j, T.PILLAR)); quad(9, 5, T.LAVA); quad(8, 5, T.LAVA); quad(6, 0, T.LAVA); randQuad(5, T.CRATE);
  } else {
    [[5, 2], [8, 4], [3, 5]].forEach(([i, j]) => quad(i, j, T.PILLAR)); randQuad(8, T.CRATE);
  }
  return { id, t, dx, dz };
}

const BOXG = new THREE.BoxGeometry(1, 1, 1);
function chevronTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.scale(2, 2);
  x.fillStyle = '#10143a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#00e5ff'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round';
  for (const y of [18, 74]) { x.beginPath(); x.moveTo(28, y + 30); x.lineTo(64, y); x.lineTo(100, y + 30); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export class ArenaView {
  constructor(scene, id, layout) {
    this.scene = scene; this.id = id; this.L = layout; this.th = THEMES[id]; this.root = new THREE.Group(); scene.add(this.root);
    this.crates = new Map(); this.pillars = new Map(); this.spikes = []; this.lavas = []; this.convMats = []; this.fall = new Float32Array(AW * AH); this.fallV = new Float32Array(AW * AH); this.shakeT = new Float32Array(AW * AH);
    scene.background = new THREE.Color(this.th.bg); scene.fog = new THREE.Fog(this.th.fog, 38, 80);
    gfx.hemi.color.set(this.th.hemi[0]); gfx.hemi.groundColor.set(this.th.hemi[1]); gfx.hemi.intensity = this.th.hemi[2]; gfx.sun.intensity = this.th.sun;
    gfx.bloom.threshold = id === 'rooftop' ? 0.85 : 0.92; gfx.bloom.strength = id === 'rooftop' ? 0.42 : 0.3;
    this.build();
  }
  build() {
    const th = this.th, R = this.root, L = this.L;
    // floor tiles (instanced, animatable)
    const fm = toon(0xffffff, { }); const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.5, 0.98), fm, AW * AH); floor.receiveShadow = true;
    floor.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(AW * AH * 3), 3); floor.instanceColor.setUsage(THREE.DynamicDrawUsage); floor.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.floor = floor; this.cA = new THREE.Color(th.a); this.cB = new THREE.Color(th.b); this.cWarn = new THREE.Color(0xff5a4f);
    const m4 = new THREE.Matrix4(); const col = new THREE.Color();
    for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) { m4.makeTranslation(cx(i), -0.25, cz(j)); floor.setMatrixAt(idx(i, j), m4); col.copy((i + j) % 2 ? this.cA : this.cB); if (this.id === 'ice') col.offsetHSL(0, 0, ((i * 7 + j * 3) % 5) * 0.006); floor.setColorAt(idx(i, j), col); }
    R.add(floor);
    // void below
    const voidM = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshBasicMaterial({ color: this.id === 'ice' ? 0x2a6aa8 : this.id === 'jungle' ? 0x0a1a10 : this.id === 'rooftop' ? 0x040414 : 0x6a8a6a })); voidM.rotation.x = -Math.PI / 2; voidM.position.y = -2.2; R.add(voidM);
    // rim walls
    const rimM = toon(th.rim), topM = this.id === 'rooftop' ? glowMat(th.rimTop, 0.75) : toon(th.rimTop);
    const wall = (x, z, sx, sz) => { mesh(BOXG, rimM, R, { pos: [x, 0.3, z], scale: [sx, 0.8, sz], outline: 0.03, recv: true }); mesh(BOXG, topM, R, { pos: [x, 0.74, z], scale: [sx * 0.96, 0.1, sz * 0.96], cast: false }); };
    wall(0, -HZ - 0.5, AW + 2, 1); wall(0, HZ + 0.5, AW + 2, 1); wall(-HX - 0.5, 0, 1, AH); wall(HX + 0.5, 0, 1, AH);
    // cells
    for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) {
      const k = idx(i, j), v = L.t[k], x = cx(i), z = cz(j);
      if (v === T.PILLAR) this.pillar(x, z, k);
      else if (v === T.CRATE) this.addCrate(i, j);
      else if (v === T.SPIKE) this.addSpike(i, j);
      else if (v === T.LAVA) this.addLava(i, j);
      else if (v === T.CONV) this.addConv(i, j);
    }
    const pat = buildScenery(this, this.id, L); patchFloor(fm, pat); RIM.c.value.set(this.rim || 0x9ec0ff); { const vg = document.getElementById('vig'); if (vg) vg.style.setProperty('--vt', { dojo: '40,16,10', rooftop: '10,0,40', jungle: '0,24,8', ice: '10,30,70' }[this.id]); }
    if (gfx.quality === 'low') this.mergeLow();
  }
  mergeLow() {
    const ex = new Set([this.floor]); this.crates.forEach((g) => { ex.add(g); mergeToon(g); }); this.pillars.forEach((g) => { ex.add(g); mergeToon(g); });
    this.spikes.forEach((s) => ex.add(s.g)); this.lavas.forEach((l) => ex.add(l.glow.parent)); mergeToon(this.root, ex);
  }
  pillar(x, z, k) {
    const R = this.root, id = this.id; const g = new THREE.Group(); g.position.set(x, 0, z); R.add(g); this.pillars.set(k, g);
    if (id === 'dojo') { mesh(BOXG, toon(0x9a9aa6), g, { pos: [0, 0.18, 0], scale: [0.7, 0.36, 0.7], outline: 0.03 }); mesh(BOXG, toon(0xb4b4c0), g, { pos: [0, 0.6, 0], scale: [0.3, 0.5, 0.3], outline: 0.03 }); mesh(BOXG, glowMat(0xffd27a, 1.3), g, { pos: [0, 1.0, 0], scale: [0.5, 0.3, 0.5], outline: 0.03 }); mesh(new THREE.ConeGeometry(0.46, 0.3, 4), toon(0x7a4a2e), g, { pos: [0, 1.3, 0], rot: [0, Math.PI / 4, 0], outline: 0.03 }); }
    else if (id === 'rooftop') { mesh(BOXG, toon(0x444c8a), g, { pos: [0, 0.5, 0], scale: [0.85, 1.0, 0.85], outline: 0.03 }); mesh(BOXG, glowMat(0x00e5ff, 1.6), g, { pos: [0, 0.6, 0.43], scale: [0.6, 0.35, 0.03], cast: false }); mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 14), toon(0x2a2f66), g, { pos: [0, 1.06, 0], outline: 0.025 }); }
    else if (id === 'jungle') { mesh(new THREE.CylinderGeometry(0.4, 0.46, 1.5, 8), toon(0x8a8f78), g, { pos: [0, 0.75, 0], outline: 0.03 }); mesh(BOXG, glowMat(0x6aff9a, 1.2), g, { pos: [0, 0.95, 0.4], scale: [0.18, 0.4, 0.04], cast: false }); mesh(new THREE.SphereGeometry(0.3, 10, 8), toon(0x4f9a4a), g, { pos: [0.1, 1.55, 0], scale: [1.2, 0.7, 1.2] }); }
    else { mesh(new THREE.ConeGeometry(0.42, 1.3, 5), new THREE.MeshToonMaterial({ color: 0x8fd4ff, gradientMap: toon(0).gradientMap, transparent: true, opacity: 0.95 }), g, { pos: [0, 0.65, 0], outline: 0.03 }); mesh(new THREE.ConeGeometry(0.22, 0.8, 5), toon(0xc9efff), g, { pos: [0.3, 0.4, 0.2], rot: [0, 0, -0.4] }); }
  }
  addCrate(i, j) { const g = buildCrate(this.id); g.position.set(cx(i), 0, cz(j)); this.root.add(g); this.crates.set(idx(i, j), g); return g; }
  addSpike(i, j) {
    const g = new THREE.Group(); g.position.set(cx(i), 0.01, cz(j)); this.root.add(g);
    mesh(BOXG, toon(0x3a3340), g, { pos: [0, 0.02, 0], scale: [0.92, 0.05, 0.92], cast: false });
    const cones = new THREE.Group(); g.add(cones); const cm = toon(0xd8dde8);
    for (const [a, b] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26], [0, 0]]) mesh(new THREE.ConeGeometry(0.1, 0.6, 6), cm, cones, { pos: [a, 0.3, b], cast: false });
    this.spikes.push({ i, j, cones, g }); cones.position.y = -0.7;
  }
  addLava(i, j) {
    const g = new THREE.Group(); g.position.set(cx(i), 0, cz(j)); this.root.add(g);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 0.1) }); const p = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.1, 0.98), m); p.position.y = 0.0; g.add(p);
    const glow = glowSprite(0xff7a1a, 2.4, 0.35); glow.position.y = 0.4; g.add(glow);
    this.lavas.push({ i, j, m, glow, seed: Math.random() * 6 });
  }
  addConv(i, j) {
    const k = idx(i, j), dx = this.L.dx[k], dz = this.L.dz[k]; if (!this.convTex) this.convTex = chevronTex();
    const m = new THREE.MeshBasicMaterial({ map: this.convTex.clone() }); m.map.needsUpdate = true; m.map.repeat.set(1, 1);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), m); p.rotation.x = -Math.PI / 2; p.position.set(cx(i), 0.012, cz(j)); this.root.add(p);
    // plane's texture "up" is +v -> rotate so chevrons point along (dx,dz)
    p.rotation.z = Math.atan2(-dx, -dz); this.convMats.push({ m, dx, dz });
  }
  decor() {
    const R = this.root, id = this.id; const rd = mulberry32(7 + id.length * 13);
    const ring = (n, fn) => { for (let k = 0; k < n; k++) { const a = rd() * 6.28, rx = 15 + rd() * 6, rz = 10.5 + rd() * 4; fn(Math.cos(a) * rx, Math.sin(a) * rz, rd); } };
    const dk = gfx.quality === 'low' ? 0.55 : 1;
    if (id === 'dojo') {
      ring(Math.round(16 * dk), (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); R.add(g); const h = 1.6 + rd() * 1.5; mesh(new THREE.CylinderGeometry(0.15, 0.22, h, 6), toon(0x7a4f32), g, { pos: [0, h / 2, 0], outline: 0.03 }); for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.8 + rd() * 0.5, 12, 8), toon([0xffa6c9, 0xffc2dc, 0xff8fbc][i]), g, { pos: [(rd() - 0.5) * 0.9, h + 0.3 + rd() * 0.5, (rd() - 0.5) * 0.9], outline: 0.03 }); });
      for (let k = 0; k < Math.round(7 * dk); k++) { const x = -14 + k * 4.6, z = -HZ - 2.2; mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), toon(0x7ac26a), R, { pos: [x, 1.5, z], cast: false }); mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), toon(0x8ad07a), R, { pos: [x + 0.25, 1.7, z + 0.2], cast: false }); }
      // pond
      mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.05, 20), toon(0x6fc7ff), R, { pos: [-13.5, -0.1, 8.5], cast: false });
    } else if (id === 'rooftop') {
      ring(Math.round(22 * dk), (x, z) => { const h = 4 + rd() * 9; const w = 1.6 + rd() * 2; const g = new THREE.Group(); g.position.set(x * 1.15, 0, z * 1.25 - 1); R.add(g); g.position.y = -h * 0.5 - 2.4 + h; mesh(BOXG, toon(0x1a1f55), g, { pos: [0, -h / 2 + 0.01, 0], scale: [w, h, w], cast: false }); const wm = glowMat([0x00e5ff, 0xff2bd6, 0xffe066][Math.floor(rd() * 3)], 1.3); for (let r = 0; r < 4; r++) mesh(BOXG, wm, g, { pos: [0, -0.5 - r * 0.7, w / 2 + 0.01], scale: [w * 0.7, 0.14, 0.02], cast: false }); });
      const sign = mesh(BOXG, glowMat(0xff2bd6, 1.6), R, { pos: [0, 0.2, -HZ - 1.1], scale: [AW * 0.9, 0.08, 0.08], cast: false }); mesh(BOXG, glowMat(0x00e5ff, 1.6), R, { pos: [0, 0.2, HZ + 1.1], scale: [AW * 0.9, 0.08, 0.08], cast: false });
    } else if (id === 'jungle') {
      ring(Math.round(20 * dk), (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); R.add(g); const h = 2.4 + rd() * 2.4; mesh(new THREE.CylinderGeometry(0.22, 0.34, h, 7), toon(0x6b4a2e), g, { pos: [0, h / 2, 0], outline: 0.03 }); for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(1.0 + rd() * 0.6, 10, 8), toon([0x2f9a54, 0x3fb064, 0x278a4a][i]), g, { pos: [(rd() - 0.5) * 1.2, h + 0.2 + rd() * 0.6, (rd() - 0.5) * 1.2], scale: [1, 0.8, 1], outline: 0.03 }); });
      for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2), toon(0x7d8a68), R, { pos: [-9 + k * 6 + (k % 2), 0.1, -HZ - 1.8], rot: [0, 0.2 * k, 0], outline: 0.03 });
    } else {
      ring(Math.round(18 * dk), (x, z) => { const s = 1 + rd() * 1.8; mesh(new THREE.IcosahedronGeometry(s, 0), toon([0xe6f6ff, 0xcfeaff, 0xb4dcf5][Math.floor(rd() * 3)]), R, { pos: [x * 1.1, s * 0.25 - 0.3, z * 1.15], scale: [1.2, 0.7, 1.2], outline: 0.03 }); });
      for (let k = 0; k < 5; k++) mesh(new THREE.ConeGeometry(0.35, 1.8 + rd(), 5), toon(0x9fdcff), R, { pos: [-HX - 3 + k * 0.3, 0.8, -4 + k * 2.2], outline: 0.03 });
    }
  }
  breakCrate(k) { const g = this.crates.get(k); if (g) { this.root.remove(g); this.crates.delete(k); } }
  update(dt, t, game) {
    updateScenery(this, t, dt);
    const f = this.floor; let dirty = false; const m4 = this._m || (this._m = new THREE.Matrix4()), col = this._c || (this._c = new THREE.Color());
    if (game && game.hole) {
      for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) {
        const k = idx(i, j), h = game.hole[k];
        if (h === 0 && this.fall[k] === 0 && this.shakeT[k] === 0) continue;
        dirty = true;
        if (h > 0) { // warning: shake + red tint
          this.shakeT[k] = 1; const s = Math.sin(t * 60 + k) * 0.03; m4.makeTranslation(cx(i) + s, -0.25 + Math.abs(s) * 0.5, cz(j) - s); f.setMatrixAt(k, m4);
          col.copy((i + j) % 2 ? this.cA : this.cB).lerp(this.cWarn, 0.55 + 0.4 * Math.sin(t * 20)); f.setColorAt(k, col);
        } else if (h < 0) { // falling / fallen
          if (this.fallV[k] === 0) this.fallV[k] = 0.01; this.fallV[k] += dt * 22; this.fall[k] += this.fallV[k] * dt; const y = -0.25 - this.fall[k];
          if (y < -6) { m4.makeScale(0, 0, 0); } else { m4.makeTranslation(cx(i), y, cz(j)); }
          f.setMatrixAt(k, m4); this.shakeT[k] = 0;
          if (y < -6 && this.fall[k] > 5.9) { this.fall[k] = 6.1; }
        } else { // restored
          this.fall[k] = 0; this.fallV[k] = 0; this.shakeT[k] = 0; m4.makeTranslation(cx(i), -0.25, cz(j)); f.setMatrixAt(k, m4); col.copy((i + j) % 2 ? this.cA : this.cB); f.setColorAt(k, col);
        }
      }
      if (dirty) { f.instanceMatrix.needsUpdate = true; if (f.instanceColor) f.instanceColor.needsUpdate = true; }
    }
    for (const s of this.spikes) { const h = game && game.spk ? game.spk[idx(s.i, s.j)] : 0; s.cones.position.y = -0.7 + h * 0.7; if (game && game.spkWarn && game.spkWarn[idx(s.i, s.j)]) s.cones.position.y = -0.55 + Math.sin(t * 50) * 0.04; }
    for (const l of this.lavas) { const k = 0.85 + Math.sin(t * 2.2 + l.seed) * 0.15; l.m.color.setRGB(2.3 * k, 0.65 * k, 0.1); l.glow.material.opacity = 0.28 + 0.1 * Math.sin(t * 3 + l.seed); }
    for (const c of this.convMats) { const o = c.m.map.offset; o.y = (o.y - dt * 0.9) % 1; }
  }
  dispose() { this.scene.remove(this.root); if (this.dyn) this.scene.remove(this.dyn); this.scene.fog = null; this.root.traverse((o) => { if (o.geometry && o.geometry !== BOXG) o.geometry.dispose && 0; }); }
}
