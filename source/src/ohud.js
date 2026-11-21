// hud422: overhead indicators drawn above each fighter (original design).
// Health pips, boomerang-ready pips, signature (ULT) ring, and dash/shield for your own fighter.
// One 2D canvas over the 3D view; drawn after each rendered frame. Cheap: a few rects/arcs per fighter.
import { THREE, gfx, saverActive } from './gfx.js';
import { shownHere } from './stealth.js';

const _v = new THREE.Vector3();
let cv = null, cx = null, cw = 0, ch = 0, dpr = 1, drawn = false;
const hexs = {}; const hx = (c) => hexs[c] || (hexs[c] = '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6));
const readyAt = new WeakMap();
export const ohud = { on: true, last: [] };

function ensure() {
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'ohud'; cv.setAttribute('aria-hidden', 'true'); const hud = document.getElementById('hud'); (hud && hud.parentNode ? hud.parentNode : document.body).insertBefore(cv, hud || null); cx = cv.getContext('2d'); }
  const W = gfx.w || innerWidth, H = gfx.h || innerHeight; const d = Math.min(saverActive && saverActive() ? 1.25 : 2, window.devicePixelRatio || 1);
  if (W !== cw || H !== ch || d !== dpr) { cw = W; ch = H; dpr = d; cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
}
export function ohudClear() { if (cx && drawn) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); } drawn = false; ohud.last = []; }
const isLocal = (g, f) => (!f.isBot || f.autoHuman) && !(g.net && f.def.slot !== 0);
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

export function ohudDraw(g, playing) {
  if (!g || g.mode === 'attract' || !playing || !ohud.on || !gfx.camera) { if (drawn) ohudClear(); return; }
  ensure(); const c = cx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(dpr, 0, 0, dpr, 0, 0); drawn = true;
  const locals = g.fighters.filter((f) => !f.boss && isLocal(g, f)); const solo = locals.length === 1; const now = performance.now() / 1000; const out = [];
  const u = Math.max(0.95, Math.min(1.3, Math.min(cw, ch * 2) / 900)); // phone-size scale
  for (const f of g.fighters) {
    if (f.boss || !f.alive || !f.model || !f.model.root || !f.model.root.visible || !shownHere(g, f)) continue;
    _v.set(f.x, 1.85 * (f.bs || 1) + (f.hopY || 0), f.z).project(gfx.camera);
    if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1 || _v.y < -1.1 || _v.y > 1.2) continue;
    const px = (_v.x * 0.5 + 0.5) * cw, py = (-_v.y * 0.5 + 0.5) * ch - 6 * u; const me = !f.boss && isLocal(g, f);
    const col = hx(f.color || 0xffffff); const mh = Math.max(1, f.maxHp || 1), hp = Math.max(0, Math.min(mh, f.hp || 0));
    const bw = (me ? 40 : 34) * u, bh = (me ? 7 : 6) * u, x0 = px - bw / 2, y0 = py - bh;
    const ghost = (f.fadeOn || 0) > 0.05 ? 1 - 0.55 * Math.min(1, f.fadeOn) : 1; c.globalAlpha = ghost;
    // frame + health pips
    rr(c, x0 - 1.5, y0 - 1.5, bw + 3, bh + 3, 3 * u); c.fillStyle = 'rgba(8,10,28,.78)'; c.fill();
    if (me) { c.lineWidth = 1.5; c.strokeStyle = '#ffffff'; c.stroke(); }
    if (f.shield) { c.lineWidth = 2; c.strokeStyle = '#7ad8ff'; rr(c, x0 - 3.5, y0 - 3.5, bw + 7, bh + 7, 4 * u); c.stroke(); }
    const gap = 1.5, sw = (bw - gap * (mh - 1)) / mh;
    for (let i = 0; i < mh; i++) { c.fillStyle = i < hp ? (hp === 1 && mh > 1 ? '#ff6a5a' : col) : 'rgba(255,255,255,.14)'; c.fillRect(x0 + i * (sw + gap), y0, sw, bh); }
    if (f.hitFlash > 0) { c.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, f.hitFlash * 3).toFixed(2) + ')'; c.fillRect(x0, y0, bw, bh); }
    const lives = f.lives, l0 = f.def && f.def.lives; if (l0 > 1 && l0 < 90) { c.font = `900 ${Math.round(9 * u)}px system-ui,sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('\u00d7' + Math.max(0, lives), x0 + bw + 4, y0 + bh / 2); }
    // label: YOU / P1.. for locals, small name for others
    c.font = `800 ${Math.round((me ? 10 : 9) * u)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    const lab = me ? (solo ? '' : 'P' + ((f.def.slot || 0) + 1)) : ''; /* names already float above fighters; solo: the game's own YOU marker already flags you; the bar gets a white outline */
    if (lab) { c.lineWidth = 3; c.strokeStyle = 'rgba(6,8,24,.85)'; c.strokeText(lab, px, y0 - 3); c.fillStyle = me ? '#fff' : 'rgba(255,255,255,.82)'; c.fillText(lab, px, y0 - 3); }
    // row under bar: boomerang pips (lit = ready in hand, dim = thrown) + signature ring
    const yr = y0 + bh + 6 * u, na = Math.max(1, Math.min(4, f.maxAmmo || 1)), am = Math.max(0, Math.min(na, f.ammo || 0)); const pr = 2.6 * u;
    const ult = Math.max(0, Math.min(100, f.ult || 0)), rdy = ult >= 100; const rx = x0 + bw - 4 * u;
    for (let i = 0; i < na; i++) { const ax = x0 + 3 * u + i * (pr * 2 + 2.5); c.beginPath(); c.arc(ax, yr, pr, 0, 6.283); if (i < am) { c.fillStyle = '#ffd24a'; c.fill(); } else { c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,210,74,.55)'; c.stroke(); } }
    if (!f.hero && !f.def.hero) { out.push({ i: f.idx, px, py, hp, mh, am, na, ult, me }); c.globalAlpha = 1; continue; }
    let pulse = 0; if (rdy) { let t = readyAt.get(f); if (t === undefined) { t = now; readyAt.set(f, t); } pulse = Math.max(0, 1 - (now - t) / 1.2); } else readyAt.delete(f);
    const R = 4.2 * u * (1 + pulse * 0.35); c.beginPath(); c.arc(rx, yr, R, 0, 6.283); c.fillStyle = 'rgba(8,10,28,.8)'; c.fill();
    c.lineWidth = 2 * u; c.strokeStyle = rdy ? '#b38cff' : 'rgba(179,140,255,.85)'; c.beginPath(); c.arc(rx, yr, R - u, -1.5708, -1.5708 + 6.283 * ult / 100); c.stroke();
    if (rdy) { c.fillStyle = '#e6dbff'; c.beginPath(); c.arc(rx, yr, 1.6 * u, 0, 6.283); c.fill(); if (pulse > 0) { c.globalAlpha = ghost * pulse; c.lineWidth = 1.5; c.strokeStyle = '#d9c8ff'; c.beginPath(); c.arc(rx, yr, R + 3 * u * (1 - pulse) + 1, 0, 6.283); c.stroke(); c.globalAlpha = ghost; } }
    // own fighter: thin dash cooldown line under the row
    if (me && f.dashCd > 0) { const mx = 0.95 * ((f.mods && f.mods.dashCd) || 1); const k = 1 - Math.min(1, f.dashCd / mx); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0, yr + 5 * u, bw, 1.5 * u); c.fillStyle = '#9ff0ff'; c.fillRect(x0, yr + 5 * u, bw * k, 1.5 * u); }
    c.globalAlpha = 1; out.push({ i: f.idx, px, py, hp, mh, am, na, ult, rdy, me, shield: !!f.shield, dash: f.dashCd > 0 });
  }
  ohud.last = out;
}
