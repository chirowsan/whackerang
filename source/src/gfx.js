import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { HX, HZ } from './util.js';
import { S, speedCfg } from './save.js';

export { THREE };
export const gfx = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, sun: null, hemi: null,
  trauma: 0, kx: 0, kz: 0, flashOn: true, w: 1, h: 1, dpr: 1, quality: 'high', qSetting: 'auto', ok: false, camBase: new THREE.Vector3(), camTarget: new THREE.Vector3(),
  density: 1, dprMax: 1, dprCur: 1, outlinesAll: true, camMode: 'play', useBloom: true, lastRender: 0, fovPulse: 0, tilt: 56, reserveL: 0, reserveR: 0,
};

let GRAD = null;
export function gradMap() {
  if (GRAD) return GRAD;
  GRAD = new THREE.DataTexture(new Uint8Array([80, 140, 205, 255]), 4, 1, THREE.RedFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true; return GRAD;
}
// Cheap rim light: fresnel term added to every toon material (shared uniforms, retinted per arena theme). No extra lights/passes.
export const RIM = { c: { value: new THREE.Color(0x9ec0ff) }, k: { value: 0.42 } };
export function addRim(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimC = RIM.c; sh.uniforms.rimK = RIM.k;
    sh.fragmentShader = 'uniform vec3 rimC; uniform float rimK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', 'float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);\n outgoingLight += rimC * rimF * rimK;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'rimtoon'; return m;
}
export function toon(color, o = {}) { return addRim(new THREE.MeshToonMaterial({ color, gradientMap: gradMap(), ...o })); }
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
  if (o.outline) { const ol = new THREE.Mesh(geo, outlineMat(o.outline)); ol.userData.ol = o.grp || 'other'; ol.userData.th = o.outline; ol.visible = gfx.outlinesAll || o.grp === 'hero'; m.add(ol); }
  if (parent) parent.add(m); return m;
}

// Merge static toon meshes under `root` into ONE vertex-coloured mesh (Low tier draw-call cut). Skips outlines, emissive, transparent, instanced and `exclude`d subtrees.
let _mergeMat = null;
export function mergeToon(root, exclude, opt = {}) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const items = [], ols = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.ol !== undefined || !o.visible) return;
    const mt = o.material; if (!mt || !mt.isMeshToonMaterial || mt.transparent || (mt.emissiveIntensity > 0 && mt.emissive && mt.emissive.getHex() !== 0)) return;
    if (exclude) { let p = o; while (p && p !== root) { if (exclude.has(p)) return; p = p.parent; } }
    items.push(o);
  });
  if (items.length < 2) return null;
  const toG = (o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); return g; };
  let n = 0; const geos = items.map((o) => { const g = toG(o); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let k = 0;
  geos.forEach((g, i) => { const c = items[i].material.color, cnt = g.attributes.position.count; pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); for (let v = 0; v < cnt; v++) { col[(k + v) * 3] = c.r; col[(k + v) * 3 + 1] = c.g; col[(k + v) * 3 + 2] = c.b; } k += cnt; g.dispose(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!_mergeMat) _mergeMat = addRim(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap() }));
  const m = new THREE.Mesh(geo, _mergeMat); m.castShadow = !!opt.cast; m.receiveShadow = false; m.matrixAutoUpdate = false;
  if (opt.ol) {
    const oi = items.filter((o) => o.children.some((c) => c.userData.ol !== undefined));
    if (oi.length) {
      let on = 0; const og = oi.map((o) => { const g = toG(o); on += g.attributes.position.count; return g; }); const op = new Float32Array(on * 3), onr = new Float32Array(on * 3); let q = 0;
      og.forEach((g) => { op.set(g.attributes.position.array, q * 3); onr.set(g.attributes.normal.array, q * 3); q += g.attributes.position.count; g.dispose(); });
      const ogeo = new THREE.BufferGeometry(); ogeo.setAttribute('position', new THREE.BufferAttribute(op, 3)); ogeo.setAttribute('normal', new THREE.BufferAttribute(onr, 3));
      const oc = oi[0].children.find((c) => c.userData.ol !== undefined); const om = new THREE.Mesh(ogeo, outlineMat(oc.userData.th || 0.03)); om.userData.ol = opt.grp || oc.userData.ol; om.userData.th = oc.userData.th; om.visible = gfx.outlinesAll || om.userData.ol === 'hero'; om.matrixAutoUpdate = false; om.frustumCulled = true; m.add(om);
    }
  }
  items.forEach((o) => o.removeFromParent()); root.add(m); return m;
}
export function glowTexture() {
  if (glowTexture.t) return glowTexture.t;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.scale(2, 2);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; glowTexture.t = t; return t;
}
let SOFT = null;
export function softTex() {
  if (SOFT) return SOFT; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SOFT = new THREE.CanvasTexture(c); SOFT.colorSpace = THREE.SRGBColorSpace; return SOFT;
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
  const cam = gfx.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
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
// Graphics tiers. sharp = crisp native-resolution, no shadows/post-fx (default); balanced = shadows + bloom; fast = reduced resolution for weak GPUs.
export const TIERS = {
  sharp: { eff: 'low', dprCap: 2.5, floor: 0.85, shadow: 0, bloom: false, density: 0.6, outlines: true, msaa: 0 },
  balanced: { eff: 'medium', dprCap: 2, floor: 0.85, shadow: 1024, bloom: true, density: 0.8, outlines: true, msaa: 4 },
  fast: { eff: 'low', dprCap: 1.25, floor: 0.6, shadow: 0, bloom: false, density: 0.5, outlines: false, msaa: 0 },
};
export const normQuality = (q) => (TIERS[q] ? q : q === 'low' ? 'fast' : q === 'medium' || q === 'high' ? 'balanced' : 'sharp');
export function setQuality(q0) {
  const q = normQuality(q0), T = TIERS[q];
  const prevShadow = gfx.quality ? gfx.quality !== 'low' : true;
  gfx.tier = q; gfx.quality = T.eff; gfx.qSetting = q; gfx.floor = T.floor;
  const r = gfx.renderer; if (!r) return;
  const dev = window.devicePixelRatio || 1;
  gfx.dprMax = Math.max(1, Math.min(dev, T.dprCap));
  gfx.dprCur = gfx.dprMax; gfx.dpr = gfx.dprCur; adaptAcc = 0; adaptN = 0; slowWin = 0;
  const low = !T.shadow;
  if (T.shadow && gfx.sun.shadow.mapSize.x !== T.shadow) { gfx.sun.shadow.mapSize.set(T.shadow, T.shadow); if (gfx.sun.shadow.map) { gfx.sun.shadow.map.dispose(); gfx.sun.shadow.map = null; } }
  r.shadowMap.enabled = !low; gfx.sun.castShadow = !low;
  gfx.useBloom = T.bloom && S().settings.bloom !== false;
  gfx.composer.renderTarget1.samples = T.msaa; gfx.composer.renderTarget2.samples = T.msaa;
  gfx.density = T.density;
  gfx.outlinesAll = T.outlines; document.body.classList.toggle('q-low', low);
  gfx.scene.traverse((o) => { if (o.isMesh && o.userData && o.userData.ol !== undefined) o.visible = gfx.outlinesAll || o.userData.ol === 'hero'; });
  if (prevShadow === low) gfx.scene.traverse((o) => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true)); });
  resize();
}
export const maxAniso = () => Math.min(8, gfx.renderer ? gfx.renderer.capabilities.getMaxAnisotropy() : 4);
// Adaptive resolution = last resort only: needs ~2.5 s of sustained slow frames twice in a row, never below floor x native cap.
let adaptAcc = 0, adaptN = 0, adaptCool = 0, slowWin = 0, slowHint = 0;
export function adaptRes(ms) {
  if (gfx.noAdapt || !gfx.renderer) return;
  adaptAcc += ms; adaptN++; adaptCool -= ms;
  if (adaptN < 90) return;
  const avg = adaptAcc / adaptN; adaptAcc = 0; adaptN = 0; let next = gfx.dprCur;
  const lo = Math.max(0.5, gfx.dprMax * gfx.floor);
  if (avg > 24) { slowWin++; if (slowWin >= 2) { next = Math.max(lo, gfx.dprCur - (avg > 34 ? 0.3 : 0.15)); adaptCool = 8000; slowWin = 0; } }
  else { slowWin = 0; if (avg < 15.5 && adaptCool <= 0 && gfx.dprCur < gfx.dprMax) { next = Math.min(gfx.dprMax, gfx.dprCur + 0.15); adaptCool = 8000; } }
  if (avg > 24 && next === gfx.dprCur && gfx.dprCur <= lo + 0.01 && gfx.tier !== 'fast') { slowHint++; if (slowHint === 4) window.dispatchEvent(new CustomEvent('bb-slow')); }
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
  gfx.renderer.setPixelRatio(gfx.dpr); gfx.renderer.setSize(w, h, false); // canvas CSS size comes from CSS (fixed, inset 0); buffer = css x dpr, 1:1 with device pixels
  gfx.composer.setPixelRatio(gfx.dpr); gfx.composer.setSize(w, h);
  const bs = gfx.quality === 'high' ? 0.5 : 0.35; gfx.bloom.resolution.set(w * gfx.dpr * bs, h * gfx.dpr * bs);
  gfx.camera.aspect = w / h; gfx.camera.updateProjectionMatrix();
  fitCamera();
}
const _v = new THREE.Vector3();
export function fitCamera(mode = gfx.camMode || 'play') {
  if (gfx.freeCam) return;
  const cam = gfx.camera; gfx.camMode = mode; cam.clearViewOffset(); const nearWant = mode === 'menu' ? 11.5 : 0.5; if (cam.near !== nearWant) { cam.near = nearWant; cam.updateProjectionMatrix(); }
  const ar = cam.aspect; const menu = mode === 'menu';
  if (menu) { // hero showcase framing: low, close, hero right of centre
    const tg = new THREE.Vector3(0.2, 1.5, 0.6); const wide = Math.min(1.35, Math.max(0.85, ar / 2.2));
    cam.position.set(-2.2, 3.5, 17.5 / Math.min(1.1, wide + 0.1)); cam.lookAt(tg); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    gfx.viewShift = 0; gfx.viewShiftX = 0.34; gfx.camBase.copy(cam.position); gfx.camTarget.copy(tg); gfx.camDist = cam.position.distanceTo(tg); gfx.follow = null;
    cam.setViewOffset(gfx.w, gfx.h, -(gfx.viewShiftX / 2) * gfx.w, 0, gfx.w, gfx.h); return;
  }
  const tdeg = ar > 2.6 ? 66 : ar > 2.2 ? 62 : ar > 1.9 ? 59 : gfx.tilt; const tilt = tdeg * Math.PI / 180;
  const hudPx = Math.min(60, Math.max(34, gfx.h * 0.11));
  const topM = Math.max(0.02, hudPx / gfx.h), botM = 0.03, sideM = 0.015;
  const yMax = 1 - topM * 2, yMin = -1 + botM * 2, xLim = Math.min(1 - sideM * 2, Math.max(0.35, 1 - (gfx.reserveL + gfx.reserveR) / gfx.w));
  const solve = (hxv, hzv) => {
    const pts = []; const hx = hxv + 0.9, hz = hzv + 0.9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([sx * hx, -0.1, sz * hz], [sx * hx, 1.4, sz * hz]);
    const tgt = new THREE.Vector3(0, 0, 0.2); let lo = 6, hi = 140;
    const proj = (d) => {
      cam.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d).add(tgt); cam.lookAt(tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      let a = 9, b = -9, c = 9, e = -9;
      for (const p of pts) { _v.set(p[0], p[1], p[2]).project(cam); a = Math.min(a, _v.x); b = Math.max(b, _v.x); c = Math.min(c, _v.y); e = Math.max(e, _v.y); }
      return [a, b, c, e];
    };
    for (let i = 0; i < 24; i++) { const d = (lo + hi) / 2; const [a, b, c, e] = proj(d); const fits = (b - a) <= xLim * 2 && (e - c) <= (yMax - yMin); if (fits) hi = d; else lo = d; }
    const d = hi; const [a, b, c, e] = proj(d); const cy = (c + e) / 2, cxx = (a + b) / 2;
    return { d, tgt, vs: (yMax + yMin) / 2 - cy, vsx: (gfx.reserveL - gfx.reserveR) / gfx.w - cxx };
  };
  const full = solve(HX, HZ); const small = (HX > 10.5 || HZ > 6.5) ? solve(10, 6) : full;
  const R = small; // view offsets are computed for the small-arena framing so HUD margins stay stable while following
  gfx.viewShift = R.vs; gfx.viewShiftX = R.vsx; gfx.tilt_ = tilt;
  gfx.follow = (HX > 10.5 || HZ > 6.5) ? { dMin: small.d * 0.98, dFull: full.d, cx: 0, cz: 0.2, d: small.d, init: false } : null;
  const cd = gfx.follow ? gfx.follow.d : full.d; cam.position.set(0, Math.sin(tilt) * cd, Math.cos(tilt) * cd).add(full.tgt); cam.lookAt(full.tgt);
  gfx.camBase.copy(cam.position); gfx.camTarget.copy(full.tgt); gfx.camDist = cd;
  cam.setViewOffset(gfx.w, gfx.h, -(gfx.viewShiftX / 2) * gfx.w, (gfx.viewShift / 2) * gfx.h, gfx.w, gfx.h);
}
// Follow camera for Large/Huge arenas: keeps humans (and nearby foes / objectives) in view, clamped for readability.
const _fb = { a: 0, b: 0, c: 0, d: 0 };
export function followCam(dt, points, humans) {
  const f = gfx.follow; if (!f || gfx.freeCam) return;
  const set = humans && humans.length ? humans : points; if (!set.length) return;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of set) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  // include other points (foes/objectives) only if close to the human box so we never zoom out to fit far-away things
  for (const p of points) { if (set.includes(p)) continue; const dx = Math.max(x0 - p[0], 0, p[0] - x1), dz = Math.max(z0 - p[1], 0, p[1] - z1); if (Math.hypot(dx, dz) < 7) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } }
  const bw = x1 - x0 + 7, bh = z1 - z0 + 6; const ratio = Math.max(bw / 21.8, bh / 13.8, 1);
  const cap = Math.min(f.dFull, f.dMin * 1.5);
  const cfg = speedCfg(); let want = Math.min(f.dFull, Math.min(cap, f.dMin * ratio) * cfg.camWide); let tx = (x0 + x1) / 2, tz = (z0 + z1) / 2 + 0.2; if (f.fixed) { want = f.dFull; tx = 0; tz = 0.2; }
  const lim = (v, h, vis) => Math.max(-h + vis * 0.35, Math.min(h - vis * 0.35, v)); const vis = want / f.dMin; tx = lim(tx, HX, 10 * vis); tz = lim(tz, HZ, 6 * vis);
  const sm = Math.sqrt(cfg.ts); const k = f.init ? 1 - Math.exp(-dt * 5 * sm) : 1; f.init = true; f.cx += (tx - f.cx) * k; f.cz += (tz - f.cz) * k; f.d += (want - f.d) * (1 - Math.exp(-dt * 2.6 * sm));
  const tilt = gfx.tilt_; gfx.camTarget.set(f.cx, 0, f.cz); gfx.camBase.set(f.cx, Math.sin(tilt) * f.d, Math.cos(tilt) * f.d + f.cz); gfx.camDist = f.d;
  const sun = gfx.sun; if (sun && sun.target) { sun.target.position.set(f.cx, 0, f.cz); sun.position.set(f.cx - 7, 15, f.cz + 8); }
}
// project a world point to screen fractions (0..1), returns [sx, sy, onScreen]
const _pv = new THREE.Vector3();
export function toScreen(x, y, z) { _pv.set(x, y, z).project(gfx.camera); return [(_pv.x + 1) / 2, (1 - _pv.y) / 2, _pv.z < 1 && _pv.x > -1 && _pv.x < 1 && _pv.y > -1 && _pv.y < 1]; }
export function shake(amount) { if (!S().settings.shake) amount *= 0.15; gfx.trauma = Math.min(1, gfx.trauma + amount); }
export function punch(dx, dz, a = 0.3) { const l = Math.hypot(dx, dz) || 1; gfx.kx += dx / l * a; gfx.kz += dz / l * a; }
export function pulseFov(a) { gfx.fovPulse = Math.max(gfx.fovPulse, a); }
export function updateGfx(dt, t) {
  const cam = gfx.camera;
  gfx.trauma = Math.max(0, gfx.trauma - dt * 1.8);
  const tr = gfx.trauma * gfx.trauma;
  gfx.kx *= Math.max(0, 1 - dt * 9); gfx.kz *= Math.max(0, 1 - dt * 9);
  cam.position.copy(gfx.camBase); cam.position.x += gfx.kx; cam.position.z += gfx.kz; cam.lookAt(gfx.camTarget);
  if (tr > 0.0005) { const s = t * 40; cam.position.x += (Math.sin(s * 1.1) + Math.sin(s * 2.3)) * 0.4 * tr; cam.position.y += Math.sin(s * 1.7 + 1) * 0.25 * tr; cam.position.z += (Math.sin(s * 1.3 + 2) + Math.sin(s * 3.1)) * 0.3 * tr; cam.rotation.z += Math.sin(s * 0.9) * 0.012 * tr; }
  gfx.fovPulse = Math.max(0, gfx.fovPulse - dt * 2.2);
  const fov = 30 - gfx.fovPulse * 1.5; if (Math.abs(cam.fov - fov) > 0.001) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
export function render() {
  if (!gfx.ok) return; const t0 = performance.now();
  if (gfx.useBloom) gfx.composer.render(); else gfx.renderer.render(gfx.scene, gfx.camera);
  gfx.lastRender = performance.now() - t0;
}
