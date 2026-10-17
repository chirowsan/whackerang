// Boomerang ribbon trail: a flat triangle strip following the last N positions, additive + vertex-faded. One tiny mesh per boomerang.
import { THREE } from './gfx.js';
const N = 24;
const _c = new THREE.Color(), _W = new THREE.Color(1, 1, 1);
export class Ribbon {
  constructor(scene, color, width = 0.3, rainbow = false) {
    this.scene = scene; this.w = width; this.rainbow = rainbow; this.col = new THREE.Color(color); this.pts = []; this.live = true; this.fadeT = 0.4; this.done = false;
    const geo = new THREE.BufferGeometry(); this.pos = new Float32Array(N * 2 * 3); this.cols = new Float32Array(N * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(this.cols, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh); this.t = 0;
  }
  push(x, y, z) { const p = this.pts; const l = p[p.length - 1]; if (l && Math.abs(l[0] - x) + Math.abs(l[2] - z) < 0.02 && this.live) return; p.push([x, y, z]); if (p.length > N) p.shift(); }
  tick(dt) {
    this.t += dt; if (!this.live) { this.fadeT -= dt; if (this.fadeT <= 0) { this.dispose(); return; } if (this.pts.length > 1 && this.t > 0.02) { this.pts.shift(); this.t = 0; } }
    const p = this.pts, n = p.length; if (n < 2) { this.mesh.visible = false; return; } this.mesh.visible = true;
    const P = this.pos, C = this.cols;
    for (let i = 0; i < N; i++) {
      const k = Math.min(n - 1, Math.max(0, i - (N - n))); const pt = p[k]; const a = p[Math.max(0, k - 1)], b = p[Math.min(n - 1, k + 1)];
      let dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const u = i / (N - 1); // 0 tail .. 1 head
      const w = this.w * (0.08 + 0.92 * Math.pow(u, 0.6)) * (this.live ? 1 : Math.max(0, this.fadeT / 0.4));
      P.set([pt[0] - dz * w, pt[1], pt[2] + dx * w, pt[0] + dz * w, pt[1], pt[2] - dx * w], i * 6);
      const al = Math.pow(u, 1.4) * 1.05; if (this.rainbow) _c.setHSL((u * 0.9 + (performance.now() / 900)) % 1, 0.9, 0.62); else _c.copy(this.col); _c.lerp(_W, Math.pow(u, 7) * 0.6);
      C.set([_c.r * al, _c.g * al, _c.b * al, _c.r * al, _c.g * al, _c.b * al], i * 6);
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
  release() { this.live = false; }
  dispose() { if (this.done) return; this.done = true; this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
