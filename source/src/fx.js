import { THREE, gfx, toon } from './gfx.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

class Particles {
  constructor(scene, geo, mat, cap) {
    this.cap = cap; this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.px = new Float32Array(cap * 3); this.pv = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.size = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.spin = new Float32Array(cap); this.rot = new Float32Array(cap); this.grow = new Float32Array(cap);
    this.next = 0; this.hi = 0; scene.add(this.mesh);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO);
  }
  spawn(x, y, z, vx, vy, vz, size, life, color, grav = 0, drag = 0, spin = 0, grow = 0) {
    const i = this.next; this.next = (this.next + 1) % this.cap; if (i + 1 > this.hi) { this.hi = i + 1; this.mesh.count = this.hi; this.mesh.visible = true; }
    const b = i * 3; this.px[b] = x; this.px[b + 1] = y; this.px[b + 2] = z; this.pv[b] = vx; this.pv[b + 1] = vy; this.pv[b + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grav[i] = grav; this.drag[i] = drag; this.spin[i] = spin; this.rot[i] = Math.random() * 6; this.grow[i] = grow;
    _c.set(color); this.mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b); this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let hi = 0;
    for (let i = 0; i < this.hi; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; const b = i * 3;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, ZERO); continue; }
      hi = i + 1;
      this.pv[b + 1] -= this.grav[i] * dt; const dr = 1 - Math.min(1, this.drag[i] * dt);
      this.pv[b] *= dr; this.pv[b + 2] *= dr; if (this.drag[i]) this.pv[b + 1] *= dr;
      this.px[b] += this.pv[b] * dt; this.px[b + 1] += this.pv[b + 1] * dt; this.px[b + 2] += this.pv[b + 2] * dt;
      if (this.grav[i] > 0 && this.px[b + 1] < 0.05) { this.px[b + 1] = 0.05; this.pv[b + 1] *= -0.35; this.pv[b] *= 0.7; this.pv[b + 2] *= 0.7; }
      const k = this.life[i] / this.max[i]; const sc = this.size[i] * (this.grow[i] ? (1 + (1 - k) * this.grow[i]) * Math.min(1, k * 3) : Math.min(1, k * 2.2));
      this.rot[i] += this.spin[i] * dt; _e.set(this.rot[i], this.rot[i] * 0.7, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(this.px[b], this.px[b + 1], this.px[b + 2]), _q, _s.set(sc, sc, sc)); this.mesh.setMatrixAt(i, _m);
    }
    this.hi = hi; this.mesh.count = hi; this.mesh.visible = hi > 0; this.mesh.instanceMatrix.needsUpdate = hi > 0;
  }
  clear() { this.life.fill(0); this.hi = 0; this.mesh.count = 0; this.mesh.visible = false; }
}

export const fx = {
  time: 0, amb: null, ambAcc: 0,
  init(scene) {
    this.scene = scene;
    this.debris = new Particles(scene, new THREE.BoxGeometry(1, 1, 1), toon(0xffffff), 500);
    this.debris.mesh.castShadow = true;
    this.glow = new Particles(scene, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }), 700);
    this.rings = []; const rg = new THREE.RingGeometry(0.82, 1, 36);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData = { t: 0, life: 1, max: 1 }; scene.add(m); this.rings.push(m); }
    this.popRoot = document.getElementById('popups');
  },
  clear() { this.debris.clear(); this.glow.clear(); for (const r of this.rings) r.visible = false; if (this.popRoot) this.popRoot.innerHTML = ''; },
  burst(x, y, z, n, color, o = {}) {
    n = Math.ceil(n * gfx.density); const sp = o.speed || 4, up = o.up === undefined ? 3 : o.up;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * sp; this.debris.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, Math.cos(a) * r, up * (0.4 + Math.random()), Math.sin(a) * r, (o.size || 0.13) * (0.6 + Math.random() * 0.8), (o.life || 0.9) * (0.6 + Math.random() * 0.8), Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color, 14, 0.4, 8 + Math.random() * 8); }
  },
  sparks(x, y, z, n, color, o = {}) {
    n = Math.ceil(n * gfx.density); const sp = o.speed || 5;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u) * sp * (0.4 + Math.random() * 0.8); this.glow.spawn(x, y, z, Math.cos(a) * r, u * sp * 0.8 + (o.up || 0), Math.sin(a) * r, (o.size || 0.1) * (0.5 + Math.random()), (o.life || 0.6) * (0.5 + Math.random() * 0.8), Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color, 0, 2.5, 0, -0.5); }
  },
  puff(x, y, z, n, color, size = 0.3) { n = Math.ceil(n * gfx.density); color = _c.set(color).multiplyScalar(0.42).getHex(); size *= 0.8; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; this.glow.spawn(x + Math.cos(a) * 0.2, y, z + Math.sin(a) * 0.2, Math.cos(a) * 1.3, 0.6 + Math.random(), Math.sin(a) * 1.3, size * (0.7 + Math.random() * 0.6), 0.5 + Math.random() * 0.3, color, 0, 3, 0, 0.8); } },
  trail(x, y, z, color, size) { this.glow.spawn(x, y, z, 0, 0.1, 0, size, 0.28, color, 0, 0, 0, -0.3); },
  ring(x, y, z, color, size = 3, life = 0.4) { const r = this.rings.find((q) => !q.visible) || this.rings[0]; r.visible = true; r.position.set(x, y, z); r.material.color.set(color); r.userData = { t: life, life, max: size }; },
  popup(text, x, z, cls = '', y = 1.3) {
    if (!this.popRoot) return;
    const v = new THREE.Vector3(x, y, z).project(gfx.camera); const px = (v.x * 0.5 + 0.5) * gfx.w, py = (-v.y * 0.5 + 0.5) * gfx.h;
    const d = document.createElement('div'); d.className = 'popup ' + cls; d.textContent = text; d.style.left = px + 'px'; d.style.top = py + 'px';
    this.popRoot.appendChild(d); if (!this.popKeep) setTimeout(() => d.remove(), 1200);
  },
  update(dt) {
    this.time += dt; const t = this.time;
    this.debris.update(dt); this.glow.update(dt);
    for (const r of this.rings) { const u = r.userData; if (!r.visible) continue; u.t -= dt; if (u.t <= 0) { r.visible = false; continue; } const k = 1 - u.t / u.life; r.scale.setScalar(0.3 + k * u.max); r.material.opacity = (1 - k) * 0.8; }
    if (this.amb) {
      this.ambAcc += dt * 9 * gfx.density;
      while (this.ambAcc > 1) {
        this.ambAcc -= 1; const x = (Math.random() - 0.5) * 30, z = (Math.random() - 0.5) * 18;
        if (this.amb === 'ice') this.glow.spawn(x, 8, z, (Math.random() - 0.5) * 0.4, -1.2 - Math.random() * 0.6, 0.2, 0.05 + Math.random() * 0.05, 6, 0xdff6ff);
        else if (this.amb === 'dojo') this.glow.spawn(x, 5, z, 0.6 + Math.random() * 0.6, -0.8 - Math.random() * 0.5, 0.2, 0.06 + Math.random() * 0.04, 7, 0xffb7d5, 0, 0, 3);
        else if (this.amb === 'jungle') this.glow.spawn(x, 0.2, z, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 0.05 + Math.random() * 0.04, 5, 0xc8ff6a);
        else this.glow.spawn(x, 0.1, z, (Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.8, 0, 0.04 + Math.random() * 0.04, 4.5, Math.random() < 0.5 ? 0x00e5ff : 0xff2bd6);
      }
    }
  },
};
