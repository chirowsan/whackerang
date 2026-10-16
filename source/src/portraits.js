import { THREE } from './gfx.js';
import { HEROES } from './data.js';
import { buildFighter } from './models.js';

let r = null, scene = null, cam = null; const cache = {};
function init() {
  try { r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { r = false; return; }
  r.setSize(176, 176, false); r.setPixelRatio(1); r.setClearColor(0x000000, 0);
  scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7fb0, 1.15));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-2, 4, 3); scene.add(d);
  const rim = new THREE.DirectionalLight(0x88ccff, 1.1); rim.position.set(3, 2, -3); scene.add(rim);
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50); cam.position.set(0.8, 1.35, 3.2); cam.lookAt(0, 0.62, 0);
}
export function portrait(hero, hat = 'none') {
  const key = hero.id + '_' + hat; if (cache[key]) return cache[key];
  if (r === null) init(); if (!r) return '';
  const m = buildFighter(hero, hat, 0xffffff); m.ring.visible = false; m.blob.visible = false; m.root.rotation.y = -0.4; scene.add(m.root); m.update(0.016, { move: 0, t: 0.5, dash: 0, charge: 0, throwT: 0 });
  r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); scene.remove(m.root); cache[key] = url; return url;
}
export function makePortraits() { for (const h of HEROES) portrait(h, 'none'); }
