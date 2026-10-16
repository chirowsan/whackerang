import { THREE } from './gfx.js';
import { HEROES } from './data.js';
import { buildFighter } from './models.js';

let r = null, scene = null, cam = null; const cache = {};
function init() {
  try { r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { r = false; return; }
  r.setSize(256, 256, false); r.setPixelRatio(1); r.setClearColor(0x000000, 0);
  scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7fb0, 1.15));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-2, 4, 3); scene.add(d);
  const rim = new THREE.DirectionalLight(0x88ccff, 1.1); rim.position.set(3, 2, -3); scene.add(rim);
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
}
// o: { rot, expr, size, st, dist, y }
export function snap(hero, hat = 'none', o = {}) {
  if (r === null) init(); if (!r) return '';
  const size = o.size || 256; if (r.domElement.width !== size) r.setSize(size, size, false);
  const m = buildFighter(hero, hat, 0xffffff); m.ring.visible = false; m.blob.visible = false; m.root.rotation.y = o.rot === undefined ? -0.35 : o.rot; scene.add(m.root);
  const st = { move: 0, t: 0.6, dash: 0, charge: 0, throwT: 0, expr: o.expr === null ? undefined : (o.expr || 'happy'), ...(o.st || {}) }; m.update(0.016, st);
  const [cy, cd] = hero.cam || [0.7, 3.4]; cam.position.set(0.5 * (o.dist || cd) / 3.4 + 0.2, (o.y === undefined ? cy + 0.45 : o.y), (o.dist || cd)); cam.lookAt(0, cy, 0);
  r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); window.__last = m; scene.remove(m.root); return url;
}
export function portrait(hero, hat = 'none', o = {}) {
  const key = hero.id + '_' + hat + '_' + (o.big ? 'b' : 's'); if (cache[key]) return cache[key];
  const url = snap(hero, hat, { size: o.big ? 256 : 176, expr: o.big ? 'happy' : 'neutral', dist: o.big ? (hero.cam ? hero.cam[1] : 3.4) * 0.84 : undefined }); if (url) cache[key] = url; return url;
}
export function makePortraits() { for (const h of HEROES) portrait(h, 'none'); }
