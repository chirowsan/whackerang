// Procedural cartoon face atlases: 4x2 frames of 160x128 per hero. Frames: neutral, blink, happy, angry, scared, ko, shout, smug.
import { THREE } from './gfx.js';

export const FRAMES = { neutral: 0, blink: 1, happy: 2, angry: 3, scared: 4, ko: 5, shout: 6, smug: 7 };
const CW = 160, CH = 128, INK = '#1a1530';
const hexs = (c) => '#' + c.toString(16).padStart(6, '0');
const cache = {};

function drawFrame(x, ox, oy, st, name) {
  x.save(); x.translate(ox, oy); x.beginPath(); x.rect(0, 0, CW, CH); x.clip();
  const cx = 80, ey = st.ey, ex = st.ex, er = st.er, lid = hexs(st.lid), ink = INK, led = st.eye === 'led';
  x.lineCap = 'round'; x.lineJoin = 'round';
  if (st.base) st.base(x, name, cx);
  const mode = name === 'smug' ? 'smug' : name === 'angry' ? 'angry' : name === 'scared' ? 'scared' : 'open';
  const col = led ? hexs(st.led) : ink;
  const eyes = [-1, 1];
  if (name === 'blink') { for (const s of eyes) { x.strokeStyle = col; x.lineWidth = 6; x.beginPath(); x.moveTo(cx + s * ex - er * 0.8, ey + 2); x.quadraticCurveTo(cx + s * ex, ey + er * 0.5, cx + s * ex + er * 0.8, ey + 2); x.stroke(); } }
  else if (name === 'happy') { for (const s of eyes) { x.strokeStyle = col; x.lineWidth = 7; x.beginPath(); x.moveTo(cx + s * ex - er * 0.85, ey + er * 0.35); x.quadraticCurveTo(cx + s * ex, ey - er * 0.95, cx + s * ex + er * 0.85, ey + er * 0.35); x.stroke(); } }
  else if (name === 'shout') { x.strokeStyle = col; x.lineWidth = 7; for (const s of eyes) { const ox2 = cx + s * ex; x.beginPath(); x.moveTo(ox2 - s * er * 0.85, ey - er * 0.7); x.lineTo(ox2 + s * er * 0.75, ey + er * 0.05); x.lineTo(ox2 - s * er * 0.85, ey + er * 0.7); x.stroke(); } }
  else if (name === 'ko') { x.strokeStyle = led ? hexs(st.led) : ink; x.lineWidth = 7; for (const s of eyes) { const ox2 = cx + s * ex, d = er * 0.7; x.beginPath(); x.moveTo(ox2 - d, ey - d); x.lineTo(ox2 + d, ey + d); x.moveTo(ox2 + d, ey - d); x.lineTo(ox2 - d, ey + d); x.stroke(); } }
  else { for (const s of eyes) eyeOpen(x, cx + s * ex, ey, er, mode, s, st); }
  // brows
  if (st.brow && (name === 'angry' || name === 'scared' || name === 'neutral' || name === 'smug')) {
    x.strokeStyle = hexs(st.brow); x.lineWidth = name === 'angry' ? 8 : 5;
    for (const s of eyes) { const ox2 = cx + s * ex, o = ox2 + s * er * 1.15, i = ox2 - s * er * 1.0; let oy2, iy;
      if (name === 'angry') { oy2 = ey - er * 1.5; iy = ey - er * 0.7; } else if (name === 'scared') { oy2 = ey - er * 1.25; iy = ey - er * 1.9; } else if (name === 'smug') { oy2 = ey - er * 1.35; iy = ey - er * 1.1; } else { oy2 = ey - er * 1.55; iy = ey - er * 1.6; if (!st.alwaysBrow) continue; }
      if (name === 'smug' && s === 1) { oy2 -= er * 0.5; }
      x.beginPath(); x.moveTo(o, oy2); x.lineTo(i, iy); x.stroke(); }
  }
  mouth(x, name, cx, st);
  if (st.cheek) { x.fillStyle = 'rgba(' + st.cheek + ',.55)'; for (const s of eyes) { x.beginPath(); x.ellipse(cx + s * (ex + er * 1.25), ey + er * 1.2, er * 0.55, er * 0.34, 0, 0, 7); x.fill(); } }
  if (st.extra) st.extra(x, name, cx);
  if (name === 'scared') { x.fillStyle = '#8fe3ff'; x.strokeStyle = ink; x.lineWidth = 3; const sx = cx + ex + er * 1.6, sy = ey - er * 1.9; x.beginPath(); x.moveTo(sx, sy - 14); x.quadraticCurveTo(sx + 12, sy + 4, sx, sy + 9); x.quadraticCurveTo(sx - 12, sy + 4, sx, sy - 14); x.fill(); x.stroke(); }
  x.restore();
}

function eyeOpen(x, px, py, r, mode, side, st) {
  const ink = INK;
  if (st.eye === 'led') {
    const c = hexs(st.led); const w = r * 1.1, h = mode === 'scared' ? r * 1.5 : mode === 'smug' ? r * 0.65 : mode === 'angry' ? r * 1.1 : r * 1.35;
    x.fillStyle = c; x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; rr(x, px - w, py - h * (mode === 'smug' ? 0.2 : 1), w * 2, h * (mode === 'smug' ? 1.2 : 2), 6); x.fill();
    if (mode === 'angry') { x.fillStyle = hexs(st.bg); x.beginPath(); x.moveTo(px - side * w * 1.4, py - h * 1.1); x.lineTo(px + side * w * 1.4, py - h * 1.1); x.lineTo(px - side * w * 1.4, py - h * 0.1); x.fill(); x.beginPath(); x.moveTo(px + side * w * 1.4, py - h * 1.1); x.lineTo(px + side * w * 1.4, py - h * 0.35); x.lineTo(px - side * w * 1.4, py - h * 1.1); x.fill(); }
    if (mode === 'scared') { x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, r * 0.3, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(px - w * 0.45, py - h * 0.45, r * 0.22, 0, 7); x.fill();
    return;
  }
  const lidc = hexs(st.lid);
  const rw = r * (mode === 'scared' ? 1.2 : 1), rh = r * (st.eye === 'slit' ? 0.82 : 1.12) * (mode === 'scared' ? 1.2 : 1);
  x.fillStyle = hexs(st.sclera === undefined ? 0xffffff : st.sclera); x.strokeStyle = ink; x.lineWidth = 3.5;
  x.beginPath(); x.ellipse(px, py, rw, rh, 0, 0, 7); x.fill(); x.stroke();
  const pr = r * (mode === 'scared' ? 0.36 : mode === 'angry' ? 0.58 : 0.66);
  const lx = mode === 'scared' ? 0 : -side * r * 0.1, ly = mode === 'scared' ? 0 : r * 0.1;
  x.save(); x.beginPath(); x.ellipse(px, py, rw - 1, rh - 1, 0, 0, 7); x.clip();
  if (st.eye === 'lizard') { x.fillStyle = '#ffd23c'; x.beginPath(); x.ellipse(px + lx, py + ly, rw * 0.92, rh * 0.92, 0, 0, 7); x.fill(); x.fillStyle = ink; x.beginPath(); x.ellipse(px + lx, py + ly, pr * 0.42, rh * 0.85, 0, 0, 7); x.fill(); }
  else if (st.eye === 'slit') { x.fillStyle = '#ffc531'; x.beginPath(); x.ellipse(px + lx, py + ly, pr * 1.05, rh * 0.92, 0, 0, 7); x.fill(); x.fillStyle = ink; x.beginPath(); x.ellipse(px + lx, py + ly, pr * 0.4, rh * 0.8, 0, 0, 7); x.fill(); }
  else { x.fillStyle = st.iris ? hexs(st.iris) : ink; x.beginPath(); x.arc(px + lx, py + ly, pr, 0, 7); x.fill(); if (st.iris) { x.fillStyle = ink; x.beginPath(); x.arc(px + lx, py + ly, pr * 0.55, 0, 7); x.fill(); } }
  // highlights
  x.fillStyle = '#fff'; x.beginPath(); x.arc(px + lx - pr * 0.38, py + ly - pr * 0.42, Math.max(3, pr * 0.34), 0, 7); x.fill(); x.beginPath(); x.arc(px + lx + pr * 0.35, py + ly + pr * 0.4, Math.max(1.8, pr * 0.16), 0, 7); x.fill();
  // lids
  if (mode === 'angry') { x.fillStyle = lidc; x.beginPath(); x.moveTo(px + side * rw * 1.3, py - rh * 1.3); x.lineTo(px - side * rw * 1.3, py - rh * 1.3); x.lineTo(px - side * rw * 1.3, py - rh * 0.15); x.lineTo(px + side * rw * 1.3, py - rh * 0.95); x.closePath(); x.fill(); }
  if (mode === 'smug') { x.fillStyle = lidc; x.fillRect(px - rw - 2, py - rh - 2, rw * 2 + 4, rh * 1.05); x.strokeStyle = ink; x.lineWidth = 4; x.beginPath(); x.moveTo(px - rw, py - rh * 0.05); x.lineTo(px + rw, py - rh * 0.05); x.stroke(); }
  x.restore();
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

function mouth(x, name, cx, st) {
  const my = st.my; const ink = INK; x.strokeStyle = st.eye === 'led' ? hexs(st.led) : ink; x.lineWidth = 4.5; x.fillStyle = ink;
  const style = st.mouth;
  if (style === 'none' && name !== 'ko' && name !== 'shout' && name !== 'happy') return;
  const open = (w, h, tongue = true) => { x.fillStyle = st.eye === 'led' ? hexs(st.led) : '#3a0f2c'; x.beginPath(); x.moveTo(cx - w, my - h * 0.2); x.quadraticCurveTo(cx, my + h * 1.6, cx + w, my - h * 0.2); x.quadraticCurveTo(cx, my - h * 0.5, cx - w, my - h * 0.2); x.fill(); x.stroke(); if (tongue && st.eye !== 'led') { x.fillStyle = '#ff7a9a'; x.beginPath(); x.ellipse(cx, my + h * 0.55, w * 0.4, h * 0.3, 0, 0, 7); x.fill(); } };
  if (st.eye === 'led') {
    x.lineWidth = 5;
    if (name === 'happy') { x.beginPath(); x.moveTo(cx - 16, my - 4); x.quadraticCurveTo(cx, my + 16, cx + 16, my - 4); x.stroke(); }
    else if (name === 'shout') { rr(x, cx - 12, my - 8, 24, 20, 6); x.fillStyle = hexs(st.led); x.fill(); }
    else if (name === 'angry') { x.beginPath(); x.moveTo(cx - 18, my + 4); for (let i = 0; i < 5; i++) x.lineTo(cx - 18 + i * 9 + 4.5, my + (i % 2 ? 4 : -4)); x.stroke(); }
    else if (name === 'scared') { x.beginPath(); x.moveTo(cx - 16, my + 4); x.lineTo(cx - 8, my - 3); x.lineTo(cx, my + 4); x.lineTo(cx + 8, my - 3); x.lineTo(cx + 16, my + 4); x.stroke(); }
    else if (name === 'ko') { x.beginPath(); x.moveTo(cx - 14, my); x.lineTo(cx + 14, my); x.stroke(); }
    else { x.beginPath(); x.moveTo(cx - 12, my); x.lineTo(cx + 12, my); x.stroke(); }
    return;
  }
  switch (name) {
    case 'happy': open(st.mw * 1.3, 15); break;
    case 'shout': x.fillStyle = '#3a0f2c'; x.beginPath(); x.ellipse(cx, my + 4, st.mw * 0.85, 15, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#ff7a9a'; x.beginPath(); x.ellipse(cx, my + 12, st.mw * 0.5, 7, 0, 0, 7); x.fill(); break;
    case 'angry': x.fillStyle = '#fff'; x.beginPath(); x.moveTo(cx - st.mw, my - 2); x.lineTo(cx + st.mw, my - 2); x.lineTo(cx + st.mw * 0.8, my + 10); x.lineTo(cx - st.mw * 0.8, my + 10); x.closePath(); x.fill(); x.stroke(); x.lineWidth = 2.5; x.beginPath(); for (let i = -1; i <= 1; i++) { x.moveTo(cx + i * st.mw * 0.45, my - 2); x.lineTo(cx + i * st.mw * 0.4, my + 10); } x.stroke(); break;
    case 'scared': x.beginPath(); x.moveTo(cx - st.mw, my + 5); for (let i = 0; i < 5; i++) x.lineTo(cx - st.mw + (i + 1) * st.mw * 0.4, my + (i % 2 ? 5 : -2)); x.stroke(); break;
    case 'ko': x.beginPath(); x.moveTo(cx - st.mw, my); x.quadraticCurveTo(cx - st.mw * 0.3, my + 8, cx, my); x.quadraticCurveTo(cx + st.mw * 0.3, my - 8, cx + st.mw, my); x.stroke(); x.fillStyle = '#ff7a9a'; x.strokeStyle = ink; x.lineWidth = 3; x.beginPath(); x.ellipse(cx + st.mw * 0.4, my + 10, 6, 11, 0, 0, 7); x.fill(); x.stroke(); break;
    case 'smug': x.beginPath(); x.moveTo(cx - st.mw * 0.7, my + 2); x.quadraticCurveTo(cx + st.mw * 0.2, my + 10, cx + st.mw * 0.9, my - 6); x.stroke(); break;
    default:
      if (style === 'w') { x.beginPath(); x.moveTo(cx - st.mw, my - 2); x.quadraticCurveTo(cx - st.mw * 0.5, my + 8, cx, my - 1); x.quadraticCurveTo(cx + st.mw * 0.5, my + 8, cx + st.mw, my - 2); x.stroke(); }
      else if (style === 'flat') { x.beginPath(); x.moveTo(cx - st.mw, my); x.lineTo(cx + st.mw, my); x.stroke(); }
      else { x.beginPath(); x.moveTo(cx - st.mw, my - 2); x.quadraticCurveTo(cx, my + 9, cx + st.mw, my - 2); x.stroke(); }
  }
}

// styles per face id
const STY = {
  panda: { eye: 'round', ex: 30, ey: 56, er: 14, lid: 0x2b2b3a, brow: null, mouth: 'smile', my: 98, mw: 11, cheek: '255,150,160', sclera: 0xffffff,
    base(x, n, cx) { x.fillStyle = '#2b2b3a'; for (const s of [-1, 1]) { x.save(); x.translate(cx + s * 31, 58); x.rotate(s * 0.55); x.beginPath(); x.ellipse(0, 0, 21, 29, 0, 0, 7); x.fill(); x.restore(); } x.fillStyle = INK; x.beginPath(); x.ellipse(cx, 78, 9, 6.5, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx - 2.5, 76, 3, 1.8, 0, 0, 7); x.fill(); },
    },
  fox: { eye: 'slit', ex: 34, ey: 62, er: 14, lid: 0xff8a2e, brow: 0x2a2a3c, alwaysBrow: false, mouth: 'smile', my: 100, mw: 9, cheek: '255,120,100',
    base(x, n, cx) { x.fillStyle = '#2a2a3c'; x.beginPath(); x.moveTo(cx - 62, 50); x.quadraticCurveTo(cx, 36, cx + 62, 50); x.lineTo(cx + 56, 80); x.quadraticCurveTo(cx, 68, cx - 56, 80); x.closePath(); x.fill(); x.fillStyle = '#2a2a3c'; x.beginPath(); x.ellipse(cx, 86, 6, 4.5, 0, 0, 7); x.fill(); },
    extra() {} },
  robot: { eye: 'led', ex: 31, ey: 56, er: 13, lid: 0x0e1a2c, bg: 0x0e1a2c, led: 0x5cf0ff, brow: null, mouth: 'led', my: 94, mw: 12,
    base(x, n, cx) { x.fillStyle = '#0e1a2c'; x.strokeStyle = '#9fb2c8'; x.lineWidth = 4; rr(x, 8, 12, 144, 104, 24); x.fill(); x.stroke(); } },
  pirate: { eye: 'round', ex: 31, ey: 58, er: 14, lid: 0x7d8fc4, brow: 0x2a3a66, mouth: 'w', my: 92, mw: 12, cheek: '255,130,150',
    base(x, n, cx) { x.fillStyle = INK; x.beginPath(); x.ellipse(cx, 80, 6.5, 5, 0, 0, 7); x.fill(); },
    extra(x, n, cx) { // eyepatch over viewer-left eye + strap + whiskers
      x.strokeStyle = '#111'; x.lineWidth = 4; x.beginPath(); x.moveTo(8, 34); x.lineTo(cx - 31, 58); x.lineTo(cx + 62, 30); x.stroke();
      x.fillStyle = '#16121f'; x.strokeStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.ellipse(cx - 31, 58, 21, 18, -0.2, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(40,40,70,.8)'; x.lineWidth = 2.5; for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { x.beginPath(); x.moveTo(cx + s * 38, 88 + k * 3); x.lineTo(cx + s * 66, 82 + k * 10); x.stroke(); }
    } },
  monk: { eye: 'lizard', ex: 31, ey: 60, er: 13, lid: 0x4fb85a, brow: 0x2f7a3a, mouth: 'smile', my: 98, mw: 22, cheek: null,
    base(x, n, cx) { x.fillStyle = '#ffd23c'; for (const dx of [-14, 0, 14]) { x.beginPath(); x.arc(cx + dx, 22 + (dx === 0 ? -2 : 3), 4.2, 0, 7); x.fill(); } x.fillStyle = '#2f7a3a'; for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * 6, 82, 2.4, 0, 7); x.fill(); } } },
  peng: { eye: 'round', ex: 27, ey: 58, er: 12.5, lid: 0xffffff, brow: 0x1a1530, alwaysBrow: true, mouth: 'none', my: 100, mw: 10, cheek: '255,130,140',
    base(x, n, cx) { x.fillStyle = '#f4faff'; x.beginPath(); x.moveTo(cx, 44); x.bezierCurveTo(cx - 20, 16, cx - 68, 30, cx - 62, 64); x.bezierCurveTo(cx - 58, 100, cx - 20, 112, cx, 104); x.bezierCurveTo(cx + 20, 112, cx + 58, 100, cx + 62, 64); x.bezierCurveTo(cx + 68, 30, cx + 20, 16, cx, 44); x.fill(); } },
};

export function faceTexture(id) {
  if (cache[id]) return cache[id];
  const st = STY[id]; const c = document.createElement('canvas'); c.width = CW * 4; c.height = CH * 2; const x = c.getContext('2d');
  const names = ['neutral', 'blink', 'happy', 'angry', 'scared', 'ko', 'shout', 'smug'];
  names.forEach((n, i) => drawFrame(x, (i % 4) * CW, Math.floor(i / 4) * CH, st, n));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  cache[id] = { canvas: c, tex: t }; return cache[id];
}
export function faceInstanceTexture(id) {
  const b = faceTexture(id); const t = b.tex.clone(); t.needsUpdate = true; t.repeat.set(0.25, 0.5); setFrame(t, 'neutral'); return t;
}
export function setFrame(t, name) { const i = FRAMES[name] || 0; t.offset.set((i % 4) * 0.25, 1 - 0.5 * (Math.floor(i / 4) + 1)); }
export const faceDebugCanvas = (id) => faceTexture(id).canvas;
