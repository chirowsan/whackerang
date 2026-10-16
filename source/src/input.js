// Unified input: keyboard (+mouse aim), gamepads, touch (move stick, aim-throw stick, dash/deflect buttons).
import { S } from './save.js';

const P1 = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], fire: ['KeyF', 'KeyJ'], dash: ['Space', 'KeyK'], deflect: ['KeyE', 'KeyQ', 'KeyL'] };
const P2 = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], fire: ['Enter', 'NumpadEnter'], dash: ['ShiftRight', 'Numpad0'], deflect: ['Slash', 'ControlRight', 'NumpadDecimal'] };
const SOLO = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], fire: ['Enter', 'KeyZ'], dash: ['ShiftRight', 'KeyX'], deflect: ['Slash', 'KeyC'] };

export const Input = {
  keys: new Set(), edge: new Set(), solo: true, onPause: null, padConnected: false, lastUsed: 'kbd', unproject: null,
  mouse: { x: 0, y: 0, down: false, active: false, t: 0, edgeDeflect: false },
  touch: { enabled: false, mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, fireQ: 0, dash: false, deflect: false, aimShown: false, seen: false },
  pads: [{ prev: [] }, { prev: [] }], menuPrev: { up: 0, down: 0, left: 0, right: 0, ok: 0, back: 0 },
};
const OUTS = [{ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false }, { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false }];
const NONE = { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false };

export function initInput(canvas) {
  const prevent = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'];
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (prevent.includes(e.code)) e.preventDefault();
    Input.lastUsed = 'kbd'; if (!e.repeat) { Input.keys.add(e.code); Input.edge.add(e.code); if (e.code === 'Escape' || e.code === 'KeyP') Input.onPause && Input.onPause(); }
    Input.onAnyKey && Input.onAnyKey(e);
  });
  window.addEventListener('keyup', (e) => { Input.keys.delete(e.code); });
  window.addEventListener('blur', () => { Input.keys.clear(); Input.mouse.down = false; });
  const m = Input.mouse;
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { m.x = e.clientX; m.y = e.clientY; m.active = true; m.t = performance.now(); Input.lastUsed = 'mouse'; } }, { passive: true });
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; m.x = e.clientX; m.y = e.clientY; m.active = true; m.t = performance.now(); Input.lastUsed = 'mouse'; if (e.button === 0) m.down = true; else if (e.button === 2) m.edgeDeflect = true; }, { passive: true });
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) m.down = false; }, { passive: true });
  const chk = () => { const gps = navigator.getGamepads ? navigator.getGamepads() : []; Input.padConnected = Array.prototype.some.call(gps, (g) => g && g.connected); };
  window.addEventListener('gamepadconnected', () => { Input.lastUsed = 'pad'; chk(); }); window.addEventListener('gamepaddisconnected', chk); chk();
}
function maps(slot) { return slot === 0 ? (Input.solo ? [P1, SOLO] : [P1]) : [P2]; }
function held(ms, k) { for (const m of ms) for (const c of m[k]) if (Input.keys.has(c)) return true; return false; }
function pressed(ms, k) { let r = false; for (const m of ms) for (const c of m[k]) if (Input.edge.has(c)) { Input.edge.delete(c); r = true; } return r; }
function readPad(slot, o) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : []; const pads = []; for (const g of gps) if (g && g.connected) pads.push(g);
  const gp = pads[slot]; if (!gp) return false; const st = Input.pads[slot], b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
  let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0; if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
  const l = Math.hypot(ax, ay); if (l > 0.22) { o.mx = ax / Math.max(1, l); o.mz = ay / Math.max(1, l); Input.lastUsed = 'pad'; }
  const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0, rl = Math.hypot(rx, ry);
  if (rl > 0.4) { o.aimX = rx / rl; o.aimZ = ry / rl; o.fire = true; Input.lastUsed = 'pad'; }
  if (b(7) || b(5)) o.fire = true;
  if (b(0) && !st.prev[0]) o.dash = true; if ((b(2) && !st.prev[2]) || (b(1) && !st.prev[1]) || (b(4) && !st.prev[4])) o.deflect = true;
  if (b(9) && !st.prev[9]) Input.onPause && Input.onPause();
  st.prev = gp.buttons.map((x) => x.pressed); return true;
}
Input.read = function (slot, f) {
  const touchOn = slot === 0 && Input.touch.enabled;
  const ms = maps(slot); const o = OUTS[slot] || OUTS[0];
  o.mx = 0; o.mz = 0; o.aimX = 0; o.aimZ = 0; o.fire = false; o.dash = false; o.deflect = false;
  if (Input.keys.size || Input.edge.size) {
    let dx = 0, dz = 0; if (held(ms, 'left')) dx -= 1; if (held(ms, 'right')) dx += 1; if (held(ms, 'up')) dz -= 1; if (held(ms, 'down')) dz += 1;
    const l = Math.hypot(dx, dz); if (l > 0) { o.mx = dx / l; o.mz = dz / l; }
    o.fire = held(ms, 'fire'); o.dash = pressed(ms, 'dash'); o.deflect = pressed(ms, 'deflect');
  }
  if (slot === 0 && Input.mouse.active && Input.lastUsed === 'mouse' && Input.unproject && f && !touchOn) {
    const w = Input.unproject(Input.mouse.x, Input.mouse.y); if (w) { const dx = w[0] - f.x, dz = w[1] - f.z, l = Math.hypot(dx, dz); if (l > 0.35) { o.aimX = dx / l; o.aimZ = dz / l; } }
    if (Input.mouse.down) o.fire = true; if (Input.mouse.edgeDeflect) { o.deflect = true; Input.mouse.edgeDeflect = false; }
  }
  if (Input.padConnected) readPad(slot, o);
  if (touchOn) {
    const t = Input.touch; if (!o.mx && !o.mz) { o.mx = t.mx; o.mz = t.mz; }
    if (t.fire || t.fireQ > 0) { o.fire = true; if (t.aimX || t.aimZ) { o.aimX = t.aimX; o.aimZ = t.aimZ; } if (t.fireQ > 0 && !t.fire) t.fireQ--; }
    if (t.dash) { o.dash = true; t.dash = false; } if (t.deflect) { o.deflect = true; t.deflect = false; }
  }
  return o;
};
Input.flush = function () { Input.edge.clear(); const t = Input.touch; t.dash = false; t.deflect = false; t.fireQ = 0; Input.mouse.edgeDeflect = false; };
Input.menuPoll = function () {
  const gps = navigator.getGamepads ? navigator.getGamepads() : []; const out = {}; let up = 0, down = 0, left = 0, right = 0, ok = 0, back = 0;
  for (const g of gps) { if (!g || !g.connected) continue; const b = (i) => g.buttons[i] && g.buttons[i].pressed; const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    if (b(12) || ay < -0.6) up = 1; if (b(13) || ay > 0.6) down = 1; if (b(14) || ax < -0.6) left = 1; if (b(15) || ax > 0.6) right = 1; if (b(0) || b(9)) ok = 1; if (b(1) || b(8)) back = 1; }
  for (const k of Object.keys(Input.menuPrev)) { const v = { up, down, left, right, ok, back }[k]; out[k] = v && !Input.menuPrev[k]; Input.menuPrev[k] = v; }
  return out;
};

// ---------------- touch ----------------
export function initTouch(root) {
  const t = Input.touch;
  root.innerHTML = `
    <div id="joyzone"></div><div id="aimzone"></div>
    <div id="joybase"><div id="joyknob"></div></div><div id="aimbase"><div id="aimknob"></div></div>
    <div id="tbtns"><button id="btnDef" class="tbtn small" aria-label="Deflect"><svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z" fill="#fff" stroke="#1a1030" stroke-width="1.6" stroke-linejoin="round"/></svg></button><button id="btnDash" class="tbtn big" aria-label="Dash"><svg viewBox="0 0 24 24"><path d="M3 7l7 5-7 5V7zm9 0 7 5-7 5V7z" fill="#fff" stroke="#1a1030" stroke-width="1.6" stroke-linejoin="round"/></svg></button></div>
    <button id="btnPause" class="tpause" aria-label="Pause">❚❚</button>`;
  const q = (s) => root.querySelector(s); const jz = q('#joyzone'), az = q('#aimzone'), jb = q('#joybase'), jk = q('#joyknob'), ab = q('#aimbase'), ak = q('#aimknob');
  const R = 52; let jId = null, aId = null, jcx = 0, jcy = 0, acx = 0, acy = 0, aT0 = 0, aDragged = false;
  const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  const rest = () => { const sc = S().settings.ctrlScale || 1, left = S().settings.leftHanded, w = window.innerWidth, h = window.innerHeight; const bx = Math.max(90 * sc, w * 0.12), by = h - Math.max(86 * sc, h * 0.26); place(jb, left ? w - bx : bx, by); place(ab, left ? Math.max(bx + 20, w * 0.3) : w - Math.max(bx + 30, w * 0.3), by); jk.style.transform = ak.style.transform = 'translate(-50%,-50%)'; };
  t.reset = () => { if (jId === null && aId === null) rest(); t.mx = t.mz = 0; };
  jz.addEventListener('pointerdown', (e) => { if (jId !== null) return; jId = e.pointerId; jz.setPointerCapture(e.pointerId); Input.lastUsed = 'touch'; jcx = e.clientX; jcy = e.clientY; place(jb, jcx, jcy); jb.classList.add('active'); mv(e); });
  const mv = (e) => { let vx = e.clientX - jcx, vy = e.clientY - jcy; const d = Math.hypot(vx, vy); if (d > R) { vx = vx / d * R; vy = vy / d * R; } jk.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`; const m = Math.min(1, Math.hypot(vx, vy) / R); if (m < 0.18) { t.mx = 0; t.mz = 0; } else { const k = Math.min(1, (m - 0.12) / 0.6); t.mx = vx / Math.max(1e-3, Math.hypot(vx, vy)) * k; t.mz = vy / Math.max(1e-3, Math.hypot(vx, vy)) * k; } };
  jz.addEventListener('pointermove', (e) => { if (e.pointerId === jId) mv(e); });
  const jend = (e) => { if (e.pointerId !== jId) return; jId = null; t.mx = 0; t.mz = 0; jb.classList.remove('active'); rest(); };
  jz.addEventListener('pointerup', jend); jz.addEventListener('pointercancel', jend); jz.addEventListener('lostpointercapture', jend);
  // aim stick: drag = aim, release = throw, quick tap = auto-aim throw
  const SIN = 0.82; // approx. vertical foreshortening of tilted camera
  az.addEventListener('pointerdown', (e) => { if (aId !== null) return; aId = e.pointerId; az.setPointerCapture(e.pointerId); Input.lastUsed = 'touch'; acx = e.clientX; acy = e.clientY; place(ab, acx, acy); ab.classList.add('active'); aT0 = performance.now(); aDragged = false; t.fire = true; t.aimX = 0; t.aimZ = 0; });
  az.addEventListener('pointermove', (e) => { if (e.pointerId !== aId) return; let vx = e.clientX - acx, vy = e.clientY - acy; const d = Math.hypot(vx, vy); const sx = d > R ? vx / d * R : vx, sy = d > R ? vy / d * R : vy; ak.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
    if (d > 18) { aDragged = true; const wx = vx, wz = vy / SIN; const l = Math.hypot(wx, wz); t.aimX = wx / l; t.aimZ = wz / l; } else if (aDragged && d < 10) { aDragged = false; t.aimX = 0; t.aimZ = 0; } });
  const aend = (e) => { if (e.pointerId !== aId) return; aId = null; ab.classList.remove('active'); rest();
    const quick = !aDragged && performance.now() - aT0 < 260; t.fire = false; if (quick) { t.fireQ = 2; } else if (aDragged) { t.fireQ = 1; } else { t.fireQ = 1; } /* keep last aim for the release tick */ setTimeout(() => { if (!t.fire) { t.aimX = 0; t.aimZ = 0; } }, 60); };
  az.addEventListener('pointerup', aend); az.addEventListener('pointercancel', (e) => { if (e.pointerId === aId) { aId = null; t.fire = false; t.aimX = t.aimZ = 0; ab.classList.remove('active'); rest(); } }); az.addEventListener('lostpointercapture', (e) => { if (e.pointerId === aId) aend(e); });
  const btn = (id, key) => { const el = q(id); el.addEventListener('pointerdown', (e) => { t[key] = true; Input.lastUsed = 'touch'; el.classList.add('down'); if (key === 'dash' && navigator.vibrate && S().settings.vibrate) navigator.vibrate(6); e.preventDefault(); }); const up = () => el.classList.remove('down'); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); };
  btn('#btnDash', 'dash'); btn('#btnDef', 'deflect');
  q('#btnPause').addEventListener('pointerdown', (e) => { Input.onPause && Input.onPause(); e.preventDefault(); });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  rest(); window.addEventListener('resize', () => { if (jId === null && aId === null) rest(); }, { passive: true });
}
