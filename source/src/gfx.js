import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { HX, HZ } from './util.js';
import { S } from './save.js';

export { THREE };
export const gfx = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, sun: null, hemi: null,
  trauma: 0, w: 1, h: 1, dpr: 1, quality: 'high', qSetting: 'auto', ok: false, camBase: new THREE.Vector3(), camTarget: new THREE.Vector3(),
  density: 1, dprMax: 1, dprCur: 1, outlinesAll: true, camMode: 'play', useBloom: true, lastRender: 0, fovPulse: 0, tilt: 56,
};

let GRAD = null;
export function gradMap() {
  if (GRAD) return GRAD;
  GRAD = new THREE.DataTexture(new Uint8Array([80, 140, 205, 255]), 4, 1, THREE.RedFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true; return GRAD;
}
export function toon(color, o = {}) { return new THREE.MeshToonMaterial({ color, gradientMap: gradMap(), ...o }); }
export function glowMat(color, intensity = 2, o = {}) { return new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: intensity, gradientMap: gradMap(), ...o }); }
export function basic(color, o = {}) { return new THREE.MeshBasicMaterial({ color, ...o }); }

const outlineCache = new Map();
export function outlineMat(thick = 0.035, color = 0x120a1e) {
  const key = thick + '_' + color; if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.uniforms.thick = { value: thick }; sh.vertexShader = 'uniform float thick;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * thick;'); };
  m.customProgramCacheKey = () => 'ol' + thick;
  outlineCache.set(key, m); return m;
}
// grp: 'hero' outlines stay visible on Low; 'other' ones are hidden on Low
export function mesh(geo, mat, parent, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.pos) m.position.set(...o.pos); if (o.scale) { if (typeof o.scale === 'number') m.scale.setScalar(o.scale); else m.scale.set(...o.scale); }
  if (o.rot) m.rotation.set(...o.rot);
  m.castShadow = o.cast !== false; m.receiveShadow = !!o.recv;
  if (o.outline) { const ol = new THREE.Mesh(geo, outlineMat(o.outline)); ol.userData.ol = o.grp || 'other'; ol.visible = gfx.outlinesAll || o.grp === 'hero'; m.add(ol); }
  if (parent) parent.add(m); return m;
}

// Merge static toon meshes under `root` into ONE vertex-coloured mesh (Low tier draw-call cut). Skips outlines, emissive, transparent, instanced and `exclude`d subtrees.
let _mergeMat = null;
export function mergeToon(root, exclude) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const items = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.ol !== undefined || !o.visible) return;
    const mt = o.material; if (!mt || !mt.isMeshToonMaterial || mt.transparent || (mt.emissiveIntensity > 0 && mt.emissive && mt.emissive.getHex() !== 0)) return;
    if (exclude) { let p = o; while (p && p !== root) { if (exclude.has(p)) return; p = p.parent; } }
    items.push(o);
  });
  if (items.length < 2) return null;
  let n = 0; const geos = items.map((o) => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let k = 0;
  geos.forEach((g, i) => { const c = items[i].material.color, cnt = g.attributes.position.count; pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); for (let v = 0; v < cnt; v++) { col[(k + v) * 3] = c.r; col[(k + v) * 3 + 1] = c.g; col[(k + v) * 3 + 2] = c.b; } k += cnt; g.dispose(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!_mergeMat) _mergeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap() });
  const m = new THREE.Mesh(geo, _mergeMat); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false;
  items.forEach((o) => o.removeFromParent()); root.add(m); return m;
}
export function glowTexture() {
  if (glowTexture.t) return glowTexture.t;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; glowTexture.t = t; return t;
}
export function glowSprite(color, scale = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); return s;
}

export function initGfx(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }); } catch (e) { console.error('WebGL failed', e); return false; }
  gfx.renderer = renderer; gfx.ok = true;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.NoToneMapping;
  const scene = gfx.scene = new THREE.Scene();
  const cam = gfx.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 140);
  gfx.hemi = new THREE.HemisphereLight(0xffffff, 0x445577, 1.0); scene.add(gfx.hemi);
  const sun = gfx.sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-7, 15, 8); sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 42;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  gfx.composer = new EffectComposer(renderer, rt);
  gfx.composer.addPass(new RenderPass(scene, cam));
  gfx.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 0.92);
  gfx.composer.addPass(gfx.bloom); gfx.composer.addPass(new OutputPass());
  setQuality(S().settings.quality);
  return true;
}
export const isCoarse = () => matchMedia('(pointer:coarse)').matches;
export function setQuality(q) {
  const coarse = isCoarse();
  const eff = q === 'auto' ? (coarse ? 'low' : 'high') : q;
  const prevShadow = gfx.quality ? gfx.quality !== 'low' : true;
  gfx.quality = eff; gfx.qSetting = q;
  const r = gfx.renderer; if (!r) return;
  const dev = window.devicePixelRatio || 1;
  gfx.dprMax = Math.min(dev, coarse ? (eff === 'high' ? 1.5 : eff === 'medium' ? 1.25 : 1) : (eff === 'high' ? 2 : eff === 'medium' ? 1.5 : 1));
  gfx.dprCur = gfx.dprMax; gfx.dpr = gfx.dprCur;
  const low = eff === 'low';
  const smap = low ? 512 : eff === 'medium' ? 1024 : 2048;
  if (gfx.sun.shadow.mapSize.x !== smap) { gfx.sun.shadow.mapSize.set(smap, smap); if (gfx.sun.shadow.map) { gfx.sun.shadow.map.dispose(); gfx.sun.shadow.map = null; } }
  r.shadowMap.enabled = !low; gfx.sun.castShadow = !low;
  gfx.useBloom = !low && S().settings.bloom !== false;
  gfx.composer.renderTarget1.samples = eff === 'high' ? 4 : 0; gfx.composer.renderTarget2.samples = eff === 'high' ? 4 : 0;
  gfx.density = low ? 0.5 : eff === 'medium' ? 0.75 : 1;
  gfx.outlinesAll = !low;
  gfx.scene.traverse((o) => { if (o.isMesh && o.userData && o.userData.ol !== undefined) o.visible = gfx.outlinesAll || o.userData.ol === 'hero'; });
  if (prevShadow === low) gfx.scene.traverse((o) => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true)); });
  resize();
}
let adaptAcc = 0, adaptN = 0, adaptCool = 0;
export function adaptRes(ms) {
  if (gfx.qSetting !== 'auto' || !gfx.renderer) return;
  adaptAcc += ms; adaptN++; adaptCool -= ms;
  if (adaptN < 24) return;
  const avg = adaptAcc / adaptN; adaptAcc = 0; adaptN = 0; let next = gfx.dprCur;
  if (avg > 20) { next = Math.max(0.65, gfx.dprCur - (avg > 28 ? 0.2 : 0.1)); adaptCool = 4000; }
  else if (avg < 14.5 && adaptCool <= 0 && gfx.dprCur < gfx.dprMax) { next = Math.min(gfx.dprMax, gfx.dprCur + 0.1); adaptCool = 4000; }
  if (next !== gfx.dprCur) { gfx.dprCur = +next.toFixed(2); resize(); }
}
// canvas is position:fixed;inset:0 so its CSS box is what is really visible (never 100vh)
export function viewSize() {
  const c = gfx.renderer ? gfx.renderer.domElement : null; const vv = window.visualViewport;
  let w = c ? c.clientWidth : window.innerWidth, h = c ? c.clientHeight : window.innerHeight;
  if (!w || !h) { w = window.innerWidth; h = window.innerHeight; }
  if (vv) { if (vv.height > 50 && vv.height < h) h = vv.height; if (vv.width > 50 && vv.width < w) w = vv.width; }
  return [Math.max(2, Math.round(w)), Math.max(2, Math.round(h))];
}
export function resize() {
  if (!gfx.renderer) return;
  const [w, h] = viewSize(); gfx.w = w; gfx.h = h; gfx.dpr = gfx.dprCur;
  const root = document.documentElement.style;
  root.setProperty('--u', Math.min(22, Math.max(9, h * 0.0215)).toFixed(2) + 'px'); root.setProperty('--vh', h + 'px'); root.setProperty('--vw', w + 'px');
  gfx.renderer.setPixelRatio(gfx.dpr); gfx.renderer.setSize(w, h, false);
  gfx.composer.setPixelRatio(gfx.dpr); gfx.composer.setSize(w, h);
  const bs = gfx.quality === 'high' ? 0.5 : 0.35; gfx.bloom.resolution.set(w * gfx.dpr * bs, h * gfx.dpr * bs);
  gfx.camera.aspect = w / h; gfx.camera.updateProjectionMatrix();
  fitCamera();
}
const _v = new THREE.Vector3();
export function fitCamera(mode = gfx.camMode || 'play') {
  const cam = gfx.camera; gfx.camMode = mode; cam.clearViewOffset();
  const ar = cam.aspect; const menu = mode === 'menu';
  const tdeg = menu ? 52 : ar > 2.6 ? 66 : ar > 2.2 ? 62 : ar > 1.9 ? 59 : gfx.tilt; const tilt = tdeg * Math.PI / 180;
  const pts = []; const hx = HX + 0.9, hz = HZ + 0.9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([sx * hx, -0.1, sz * hz], [sx * hx, 1.4, sz * hz]);
  const hudPx = menu ? 4 : Math.min(60, Math.max(34, gfx.h * 0.11));
  const topM = Math.max(0.02, hudPx / gfx.h), botM = menu ? 0.02 : 0.03, sideM = 0.015;
  const yMax = 1 - topM * 2, yMin = -1 + botM * 2, xLim = menu ? 0.56 : 1 - sideM * 2;
  const tgt = new THREE.Vector3(0, 0, 0.2); let lo = 6, hi = 90;
  const proj = (d) => {
    cam.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d).add(tgt); cam.lookAt(tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let a = 9, b = -9, c = 9, e = -9;
    for (const p of pts) { _v.set(p[0], p[1], p[2]).project(cam); a = Math.min(a, _v.x); b = Math.max(b, _v.x); c = Math.min(c, _v.y); e = Math.max(e, _v.y); }
    return [a, b, c, e];
  };
  for (let i = 0; i < 22; i++) { const d = (lo + hi) / 2; const [a, b, c, e] = proj(d); const fits = (b - a) <= xLim * 2 && (e - c) <= (menu ? 1.5 : (yMax - yMin)); if (fits) hi = d; else lo = d; }
  const d = hi; const [a, b, c, e] = proj(d);
  const cy = (c + e) / 2, want = menu ? 0 : (yMax + yMin) / 2, cxx = (a + b) / 2;
  gfx.viewShift = want - cy; gfx.viewShiftX = (menu ? 0.43 : 0) - cxx;
  gfx.camBase.copy(cam.position); gfx.camTarget.copy(tgt); gfx.camDist = d;
  cam.setViewOffset(gfx.w, gfx.h, -(gfx.viewShiftX / 2) * gfx.w, (gfx.viewShift / 2) * gfx.h, gfx.w, gfx.h);
}
export function shake(amount) { if (!S().settings.shake) amount *= 0.15; gfx.trauma = Math.min(1, gfx.trauma + amount); }
export function pulseFov(a) { gfx.fovPulse = Math.max(gfx.fovPulse, a); }
export function updateGfx(dt, t) {
  const cam = gfx.camera;
  gfx.trauma = Math.max(0, gfx.trauma - dt * 1.8);
  const tr = gfx.trauma * gfx.trauma;
  cam.position.copy(gfx.camBase); cam.lookAt(gfx.camTarget);
  if (tr > 0.0005) { const s = t * 40; cam.position.x += (Math.sin(s * 1.1) + Math.sin(s * 2.3)) * 0.4 * tr; cam.position.y += Math.sin(s * 1.7 + 1) * 0.25 * tr; cam.position.z += (Math.sin(s * 1.3 + 2) + Math.sin(s * 3.1)) * 0.3 * tr; cam.rotation.z += Math.sin(s * 0.9) * 0.012 * tr; }
  gfx.fovPulse = Math.max(0, gfx.fovPulse - dt * 2.2);
  const fov = 30 - gfx.fovPulse * 1.5; if (Math.abs(cam.fov - fov) > 0.001) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
export function render() {
  if (!gfx.ok) return; const t0 = performance.now();
  if (gfx.useBloom) gfx.composer.render(); else gfx.renderer.render(gfx.scene, gfx.camera);
  gfx.lastRender = performance.now() - t0;
}
