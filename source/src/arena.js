// Arena layouts + visuals (4 original themes).
import { THREE, gfx, toon, glowMat, basic, mesh, glowSprite, mergeToon, RIM } from './gfx.js';
import { AW, AH, HX, HZ, cx, cz, idx, inb, rnd, shuffle, mulberry32, arenaScale } from './util.js';
import { buildCrate } from './models.js';
import { buildScenery, patchFloor, updateScenery } from './scenery.js';

export const T = { FLOOR: 0, PILLAR: 1, CRATE: 2, SPIKE: 3, LAVA: 4, CONV: 5 };
export const spawns = () => [[2, 2], [AW - 3, AH - 3], [AW - 3, 2], [2, AH - 3]]; // cells; order picks far-apart pairs for 2 players

export const THEMES = {
  dojo: { bg: 0xbfe3ff, fog: 0xd9eeff, a: 0xd7edb0, b: 0xc3e096, rim: 0x6b4a2e, rimTop: 0xa77d52, hemi: [0xffffff, 0x9fb4a0, 1.0], sun: 1.9, ambient: 'dojo' },
  rooftop: { bg: 0x0c0d2e, fog: 0x0c0d2e, a: 0x252a5c, b: 0x1d2150, rim: 0x151a40, rimTop: 0xff2bd6, hemi: [0x8aa0ff, 0x221a50, 0.9], sun: 1.0, ambient: 'rooftop' },
  jungle: { bg: 0x1e5a44, fog: 0x2a7a58, a: 0x8ea46a, b: 0x7c9459, rim: 0x5c6b46, rimTop: 0x93a56f, hemi: [0xe6ffd0, 0x44603a, 1.0], sun: 1.7, ambient: 'jungle' },
  volcano: { bg: 0x240a08, fog: 0x3a120c, a: 0x57444a, b: 0x463840, rim: 0x2a1a1a, rimTop: 0xff7a1a, hemi: [0xffb080, 0x401a10, 0.9], sun: 1.35, ambient: 'volcano' },
  pirate: { bg: 0x6fc8e8, fog: 0x9adcf0, a: 0xc29560, b: 0xae8250, rim: 0x6b4a2e, rimTop: 0xdcb26e, hemi: [0xfff4dc, 0x5aa0c0, 1.0], sun: 1.8, ambient: 'pirate' },
  space: { bg: 0x04061a, fog: 0x070a24, a: 0x44507a, b: 0x364166, rim: 0x1c2240, rimTop: 0x36e0ff, hemi: [0xa8c4ff, 0x151a40, 0.9], sun: 1.15, ambient: 'space' },
  haunted: { bg: 0x1a1030, fog: 0x2a1a45, a: 0x66567a, b: 0x54476a, rim: 0x2a2236, rimTop: 0x8a6aff, hemi: [0xc8b0ff, 0x20143a, 0.9], sun: 1.2, ambient: 'haunted' },
  ice: { bg: 0x9cc8ea, fog: 0xb2d6f0, a: 0xa6d6f2, b: 0x8cc4e6, rim: 0x6aa6d6, rimTop: 0xcdeaff, hemi: [0xf4faff, 0x6f9fd0, 0.95], sun: 1.55, ambient: 'ice' },
};

export function genLayout(id, seed) {
  const r = mulberry32(seed || (Math.random() * 1e9) | 0); const [kx, kz] = arenaScale(); const area = kx * kz, HW = AW / 2, HH = AH / 2;
  const t = new Uint8Array(AW * AH), dx = new Int8Array(AW * AH), dz = new Int8Array(AW * AH);
  const set = (i, j, v) => { if (i >= 0 && j >= 0 && i < AW && j < AH) t[idx(i, j)] = v; };
  const quad = (i, j, v) => { set(i, j, v); set(AW - 1 - i, j, v); set(i, AH - 1 - j, v); set(AW - 1 - i, AH - 1 - j, v); };
  const sp = spawns(); const nearSpawn = (i, j) => sp.some(([a, b]) => Math.abs(i - a) <= 1 && Math.abs(j - b) <= 1);
  const free = (i, j) => t[idx(i, j)] === 0 && !nearSpawn(i, j) && !nearSpawn(AW - 1 - i, j) && !nearSpawn(i, AH - 1 - j) && !nearSpawn(AW - 1 - i, AH - 1 - j);
  const randQuad = (n, v, filter) => { n = Math.round(n * area); let c = 0, tries = 0; while (c < n && tries++ < 400) { const i = Math.floor(r() * HW), j = Math.floor(r() * HH); if (!free(i, j) || (filter && !filter(i, j))) continue; quad(i, j, v); c++; } };
  const S = (i, j) => [Math.min(HW - 1, Math.round(i * kx)), Math.min(HH - 1, Math.round(j * kz))]; // scale a small-map quadrant cell
  const sq = (list, v) => list.forEach(([i, j]) => { const [a, b] = S(i, j); quad(a, b, v); });
  if (id === 'dojo') { sq([[5, 1], [6, 4], [3, 5]], T.PILLAR); randQuad(2, T.SPIKE); randQuad(7, T.CRATE); if (area > 1) randQuad(1.2, T.PILLAR); }
  else if (id === 'rooftop') {
    const jA = HH - 2, jB = HH + 1; for (let i = 3; i <= AW - 4; i++) { set(i, jA, T.CONV); dx[idx(i, jA)] = 1; set(i, jB, T.CONV); dx[idx(i, jB)] = -1; }
    sq([[5, 2], [8, 1]], T.PILLAR); randQuad(6, T.CRATE, (i, j) => Math.abs(j - jA) > 1 && Math.abs(j - jB) > 1); if (area > 1) randQuad(1.5, T.PILLAR, (i, j) => Math.abs(j - jA) > 1 && Math.abs(j - jB) > 1);
  } else if (id === 'jungle') { sq([[4, 1], [6, 3], [3, 4], [8, 1]], T.PILLAR); { const [a, b] = S(9, 5); quad(a, b, T.LAVA); quad(a - 1, b, T.LAVA); const [c, d] = S(6, 0); quad(c, d, T.LAVA); } randQuad(5, T.CRATE); if (area > 1) randQuad(1.5, T.LAVA); }
  else if (id === 'ice') { sq([[5, 2], [8, 4], [3, 5]], T.PILLAR); randQuad(8, T.CRATE); }
  else if (id === 'volcano') { sq([[4, 2], [7, 1], [6, 4]], T.PILLAR); for (let i = HW - 4; i < HW; i++) quad(i, Math.floor(HH / 2), T.LAVA); quad(HW - 1, HH - 1, T.LAVA); randQuad(2.5, T.LAVA); randQuad(4, T.CRATE); }
  else if (id === 'pirate') { sq([[5, 1], [8, 3]], T.PILLAR); randQuad(10, T.CRATE); randQuad(1.2, T.PILLAR); }
  else if (id === 'space') {
    // conveyor loop around a central block
    const i0 = Math.floor(AW * 0.3), i1 = AW - 1 - i0, j0 = Math.floor(AH * 0.3), j1 = AH - 1 - j0;
    for (let i = i0; i <= i1; i++) { set(i, j0, T.CONV); dx[idx(i, j0)] = 1; set(i, j1, T.CONV); dx[idx(i, j1)] = -1; }
    for (let j = j0 + 1; j < j1; j++) { set(i1, j, T.CONV); dz[idx(i1, j)] = 1; set(i0, j, T.CONV); dz[idx(i0, j)] = -1; }
    for (let j = j0 + 1; j < j1; j++) for (let i = i0 + 1; i < i1; i++) if ((i + j) % 3 === 0) set(i, j, T.PILLAR);
    randQuad(4, T.CRATE, (i, j) => i < i0 - 1 || j < j0 - 1); randQuad(1.5, T.PILLAR, (i, j) => i < i0 - 1 || j < j0 - 1);
  } else if (id === 'haunted') { sq([[3, 2], [6, 1], [5, 4], [8, 3]], T.PILLAR); randQuad(5, T.CRATE); randQuad(2, T.SPIKE); }
  else { sq([[5, 2], [8, 4], [3, 5]], T.PILLAR); randQuad(8, T.CRATE); }
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
    scene.background = new THREE.Color(this.th.bg); { const [kx, kz] = arenaScale(); const kk = Math.max(kx, kz); scene.fog = new THREE.Fog(this.th.fog, 38 * kk, 80 * kk * 1.2); }
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
    const voidM = new THREE.Mesh(new THREE.PlaneGeometry(90 * arenaScale()[0] * 1.2, 70 * arenaScale()[1] * 1.2), new THREE.MeshBasicMaterial({ color: { ice: 0x2a6aa8, jungle: 0x0a1a10, rooftop: 0x040414, volcano: 0x120302, pirate: 0x1a6a9a, space: 0x010208, haunted: 0x0a0618 }[this.id] || 0x6a8a6a })); voidM.rotation.x = -Math.PI / 2; voidM.position.y = -2.2; R.add(voidM);
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
    const pat = buildScenery(this, this.id, L); patchFloor(fm, pat); RIM.c.value.set(this.rim || 0x9ec0ff); { const vg = document.getElementById('vig'); if (vg) vg.style.setProperty('--vt', { dojo: '40,16,10', rooftop: '10,0,40', jungle: '0,24,8', ice: '10,30,70', volcano: '60,10,0', pirate: '0,30,50', space: '0,0,40', haunted: '30,0,50' }[this.id]); }
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
    else if (id === 'volcano') { mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.5, 6), toon(0x3a2a30), g, { pos: [0, 0.75, 0], outline: 0.03 }); mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 6), glowMat(0xff7a1a, 1.8), g, { pos: [0, 1.5, 0] }); mesh(BOXG, glowMat(0xff5a1a, 1.4), g, { pos: [0.1, 0.8, 0.4], scale: [0.12, 0.5, 0.05], cast: false }); }
    else if (id === 'pirate') { mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.7, 8), toon(0x7a5230), g, { pos: [0, 0.85, 0], outline: 0.03 }); mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 8), toon(0xdcb26e), g, { pos: [0, 1.5, 0] }); mesh(BOXG, toon(0xf0e6c8), g, { pos: [0.05, 1.1, 0.26], scale: [0.5, 0.45, 0.04], rot: [0, 0, 0.1] }); }
    else if (id === 'space') { mesh(BOXG, toon(0x4a5588), g, { pos: [0, 0.55, 0], scale: [0.85, 1.1, 0.85], outline: 0.03 }); mesh(BOXG, glowMat(0x36e0ff, 1.7), g, { pos: [0, 0.8, 0.43], scale: [0.6, 0.3, 0.03], cast: false }); mesh(BOXG, glowMat(0xff4fd8, 1.5), g, { pos: [0, 0.45, 0.43], scale: [0.4, 0.1, 0.03], cast: false }); mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10), toon(0x2a3060), g, { pos: [0, 1.25, 0] }); }
    else if (id === 'haunted') { mesh(BOXG, toon(0x6a6a7a), g, { pos: [0, 0.2, 0], scale: [0.8, 0.4, 0.5], outline: 0.03 }); mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 12, 1, false, 0, Math.PI), toon(0x8a8a9a), g, { pos: [0, 1.15, 0], rot: [Math.PI / 2, 0, 0], outline: 0.03 }); mesh(BOXG, toon(0x8a8a9a), g, { pos: [0, 0.75, 0], scale: [0.68, 0.8, 0.2], outline: 0.03 }); mesh(BOXG, glowMat(0x9a7aff, 1.3), g, { pos: [0, 0.8, 0.11], scale: [0.14, 0.4, 0.02], cast: false }); mesh(BOXG, glowMat(0x9a7aff, 1.3), g, { pos: [0, 0.9, 0.11], scale: [0.4, 0.12, 0.02], cast: false }); }
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
