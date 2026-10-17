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
  const t = Input.touch; t.hud = { charge: 0, dash: 0, defl: 0, ammo: 1 };
  const NS = 'http://www.w3.org/2000/svg';
  const ticks = (() => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, c = i % 2 === 0, r0 = c ? 45 : 47, r1 = 52; s += `<line x1="${(60 + Math.sin(a) * r0).toFixed(1)}" y1="${(60 - Math.cos(a) * r0).toFixed(1)}" x2="${(60 + Math.sin(a) * r1).toFixed(1)}" y2="${(60 - Math.cos(a) * r1).toFixed(1)}" stroke-width="${c ? 3.2 : 1.8}" stroke-linecap="round" opacity="${c ? .75 : .4}"/>`; } return s; })();
  const stick = (id, cls, knobId, extra, inner) => `<div id="${id}" class="stick ${cls}"><svg viewBox="0 0 120 120" class="ring"><defs><radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset=".5" stop-color="#0a0820" stop-opacity=".1"/><stop offset=".82" stop-color="currentColor" stop-opacity=".05"/><stop offset="1" stop-color="currentColor" stop-opacity=".5"/></radialGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="currentColor" stop-opacity=".8"/><stop offset="1" stop-color="currentColor" stop-opacity=".45"/></linearGradient></defs><circle cx="60" cy="60" r="58" fill="rgba(12,8,36,.38)"/><circle cx="60" cy="60" r="58" fill="url(#${id}g)"/><circle cx="60" cy="60" r="56.5" fill="none" stroke="url(#${id}s)" stroke-width="3"/><circle cx="60" cy="60" r="41" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="1.5"/><g stroke="#fff">${ticks}</g>${extra}</svg><div id="${knobId}" class="nub">${inner || ''}</div></div>`;
  const boom = '<svg viewBox="0 0 48 48" class="boom"><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#3a1600" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#ffcf3a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 28C14 19 18 15.5 24 15.5" fill="none" stroke="#fff6c0" stroke-width="2.2" stroke-linecap="round"/><circle cx="8.5" cy="33" r="2.4" fill="#ff7a3a"/><circle cx="39.5" cy="33" r="2.4" fill="#ff7a3a"/></svg>';
  const CH = 2 * Math.PI * 62;
  const chargeSvg = `<circle cx="60" cy="60" r="62" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5" class="chtrack"/><circle id="chg" cx="60" cy="60" r="62" fill="none" stroke="url(#chgrad)" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="${CH.toFixed(1)}" stroke-dashoffset="${CH.toFixed(1)}" transform="rotate(-90 60 60)"/><defs><linearGradient id="chgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe45a"/><stop offset=".6" stop-color="#ff9a2e"/><stop offset="1" stop-color="#ff3b3b"/></linearGradient></defs>`;
  const sh = 'stroke="#1a1030" stroke-width="3" stroke-linejoin="round" paint-order="stroke"';
  const icoDash = `<svg viewBox="0 0 48 48" class="ico"><g stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".85"><path d="M4 17h7M2 24h9M4 31h7"/></g><path d="M15 11l13 13-13 13-5.5-5.5L17 24l-7.5-7.5z" fill="#fff" ${sh}/><path d="M29 11l13 13-13 13-5.5-5.5L31 24l-7.5-7.5z" fill="#fff" ${sh}/></svg>`;
  const icoDef = `<svg viewBox="0 0 48 48" class="ico"><path d="M24 4.5l15 5.5v13c0 10-6.5 17.2-15 20.5C15.5 40.2 9 33 9 23V10z" fill="#fff" ${sh}/><path d="M24 10.500l9.500 3.500v9c0 6.800-4 11.800-9.500 14.400C18.500 34.800 14.5 29.800 14.500 23v-9z" fill="currentColor"/><path d="M29 20.500h-8.500a4.500 4.500 0 0 0 0 9H26" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M28.500 15.800l5.200 4.700-5.200 4.700z" fill="#fff"/></svg>`;
  const cdBtn = (id, cls, ico) => `<button id="${id}" class="tbtn ${cls}" aria-label="${id === 'btnDash' ? 'Dash' : 'Deflect'}"><span class="face"></span>${ico}<span class="sw"></span></button>`;
  root.innerHTML = `<div id="joyzone"></div><div id="aimzone"></div>${stick('joybase', 'joy', 'joyknob', '')}${stick('aimbase', 'aim', 'aimknob', chargeSvg, boom)}<div id="tbtns">${cdBtn('btnDef', 'small', icoDef)}${cdBtn('btnDash', 'big', icoDash)}</div><button id="btnPause" class="tpause" aria-label="Pause"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6"/></svg></button>`;
  const q = (s) => root.querySelector(s); const jz = q('#joyzone'), az = q('#aimzone'), jb = q('#joybase'), jk = q('#joyknob'), ab = q('#aimbase'), ak = q('#aimknob'), chg = q('#chg'), boomEl = q('#aimknob .boom'), bDash = q('#btnDash'), bDef = q('#btnDef');
  // safe-area probe
  const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe);
  const safe = () => { const c = getComputedStyle(probe); return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 }; };
  let B = 116, R = 42, D = 88, F = 72, sa = safe();
  const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  // sizes + layout (CSS vars drive the DOM; returns horizontal space the controls need so the camera can keep the arena clear)
  const layout = () => {
    const st = S().settings, sc = st.ctrlScale || 1, left = !!st.leftHanded, w = window.innerWidth, h = window.innerHeight; sa = safe();
    B = Math.min(118 * sc, h * 0.4); R = B * 0.36; D = Math.min(84 * sc, h * 0.33); F = D * 0.84;
    const sl = Math.max(sa.l, 0), sr = Math.max(sa.r, 0), sb = Math.max(sa.b, 0), mar = Math.max(12, w * 0.015), gp = 7 * sc;
    // Thumb cluster, bottom corner of the throwing hand: boomerang (aim) stick in the corner, DASH to its left, DEFLECT up-left on the arc.
    const ax = w - sr - mar - B / 2, ay = h - sb - 12 - B / 2;
    const arc = (deg, r) => [ax + Math.cos(deg * Math.PI / 180) * r, ay - Math.sin(deg * Math.PI / 180) * r];
    let [dx, dy] = arc(184, B / 2 + D / 2 + gp); dy = Math.min(dy, h - sb - 6 - D / 2);
    let [fx, fy] = arc(122, B / 2 + F / 2 + gp); fy = Math.max(fy, h * 0.3);
    const X = (x) => (left ? w - x : x);
    const rs = document.documentElement.style; rs.setProperty('--sb', B + 'px'); rs.setProperty('--bd', D + 'px'); rs.setProperty('--bf', F + 'px');
    rs.setProperty('--dx', X(dx) + 'px'); rs.setProperty('--dy', dy + 'px'); rs.setProperty('--fx', X(fx) + 'px'); rs.setProperty('--fy', fy + 'px');
    rs.setProperty('--sail', sa.l + 'px'); rs.setProperty('--sair', sa.r + 'px'); rs.setProperty('--saib', sa.b + 'px'); rs.setProperty('--sait', sa.t + 'px');
    const joyW = mar + B + 10, clW = (w - dx + D / 2) - 22; // arena may tuck slightly under the dash button's outer edge
    const bx = sl + mar + B / 2, by = ay;
    t.pos = { joy: [left ? w - sr - mar - B / 2 : bx, by], aim: [X(ax), ay] };
    return { L: left ? clW : joyW + sl, R: left ? joyW + sr : clW };
  };
  t.layout = layout;
  const rest = () => { const p = t.pos || (layout(), t.pos); place(jb, p.joy[0], p.joy[1]); place(ab, p.aim[0], p.aim[1]); jk.style.transform = ak.style.transform = 'translate(-50%,-50%)'; boomEl.style.transform = 'rotate(0deg)'; };
  t.reset = () => { if (jId === null && aId === null) { layout(); rest(); } t.mx = t.mz = 0; };
  let jId = null, aId = null, jcx = 0, jcy = 0, acx = 0, acy = 0, aT0 = 0, aDragged = false;
  const vib = (ms) => { if (!S().settings.vibrate) return; try { const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; if (H && H.impact) { H.impact({ style: ms > 20 ? 'MEDIUM' : 'LIGHT' }); return; } if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  jz.addEventListener('pointerdown', (e) => { if (jId !== null) return; jId = e.pointerId; jz.setPointerCapture(e.pointerId); Input.lastUsed = 'touch'; jcx = e.clientX; jcy = e.clientY; place(jb, jcx, jcy); jb.classList.add('active'); mv(e); });
  const mv = (e) => { let vx = e.clientX - jcx, vy = e.clientY - jcy; const d = Math.hypot(vx, vy); if (d > R) { vx = vx / d * R; vy = vy / d * R; } jk.style.transform = `translate(calc(-50% + ${vx * 0.76}px), calc(-50% + ${vy * 0.76}px))`; const m = Math.min(1, Math.hypot(vx, vy) / R); if (m < 0.18) { t.mx = 0; t.mz = 0; } else { const k = Math.min(1, (m - 0.12) / 0.6); t.mx = vx / Math.max(1e-3, Math.hypot(vx, vy)) * k; t.mz = vy / Math.max(1e-3, Math.hypot(vx, vy)) * k; } };
  jz.addEventListener('pointermove', (e) => { if (e.pointerId === jId) mv(e); });
  const jend = (e) => { if (e.pointerId !== jId) return; jId = null; t.mx = 0; t.mz = 0; jb.classList.remove('active'); rest(); };
  jz.addEventListener('pointerup', jend); jz.addEventListener('pointercancel', jend); jz.addEventListener('lostpointercapture', jend);
  // aim stick: drag = aim, release = throw, quick tap = auto-aim throw
  const SIN = 0.82; // approx. vertical foreshortening of tilted camera
  az.addEventListener('pointerdown', (e) => { if (aId !== null) return; aId = e.pointerId; az.setPointerCapture(e.pointerId); Input.lastUsed = 'touch'; acx = e.clientX; acy = e.clientY; place(ab, acx, acy); ab.classList.add('active'); aT0 = performance.now(); aDragged = false; t.fire = true; t.aimX = 0; t.aimZ = 0; });
  az.addEventListener('pointermove', (e) => { if (e.pointerId !== aId) return; let vx = e.clientX - acx, vy = e.clientY - acy; const d = Math.hypot(vx, vy); const sx = d > R ? vx / d * R : vx, sy = d > R ? vy / d * R : vy; ak.style.transform = `translate(calc(-50% + ${sx * 0.7}px), calc(-50% + ${sy * 0.7}px))`;
    if (d > 18) { aDragged = true; const wx = vx, wz = vy / SIN; const l = Math.hypot(wx, wz); t.aimX = wx / l; t.aimZ = wz / l; boomEl.style.transform = `rotate(${(Math.atan2(vx, -vy) * 57.2958).toFixed(0)}deg)`; } else if (aDragged && d < 10) { aDragged = false; t.aimX = 0; t.aimZ = 0; } });
  const aend = (e) => { if (e.pointerId !== aId) return; aId = null; ab.classList.remove('active'); rest();
    const quick = !aDragged && performance.now() - aT0 < 260; t.fire = false; if (quick) { t.fireQ = 2; } else { t.fireQ = 1; } /* keep last aim for the release tick */ setTimeout(() => { if (!t.fire) { t.aimX = 0; t.aimZ = 0; } }, 60); if (t.hud.ammo > 0) vib(quick ? 8 : 14); };
  az.addEventListener('pointerup', aend); az.addEventListener('pointercancel', (e) => { if (e.pointerId === aId) { aId = null; t.fire = false; t.aimX = t.aimZ = 0; ab.classList.remove('active'); rest(); } }); az.addEventListener('lostpointercapture', (e) => { if (e.pointerId === aId) aend(e); });
  const btn = (el, key, hk, ms) => { el.addEventListener('pointerdown', (e) => { t[key] = true; Input.lastUsed = 'touch'; el.classList.add('down'); if (t.hud[hk] <= 0) vib(ms); e.preventDefault(); }); const up = () => el.classList.remove('down'); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); };
  btn(bDash, 'dash', 'dash', 10); btn(bDef, 'deflect', 'defl', 6);
  q('#btnPause').addEventListener('pointerdown', (e) => { Input.onPause && Input.onPause(); e.preventDefault(); });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  // per-frame visual sync (cooldown sweeps, charge ring, ammo). Purely cosmetic: never touches input state.
  const last = { charge: -1, dash: -1, defl: -1, ammo: -1, full: false };
  const sweep = (el, key, v) => { const r = Math.round(v * 100) / 100; if (r === last[key]) return; if (last[key] > 0 && r === 0) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); } last[key] = r; el.style.setProperty('--r', r); el.classList.toggle('cool', r > 0); };
  bDash.addEventListener('animationend', () => bDash.classList.remove('ready')); bDef.addEventListener('animationend', () => bDef.classList.remove('ready'));
  t.sync = (h) => {
    const d = h || { charge: 0, dash: 0, defl: 0, ammo: 1 }; t.hud = d;
    const c = Math.round(d.charge * 50) / 50; if (c !== last.charge) { last.charge = c; chg.style.strokeDashoffset = (CH * (1 - c)).toFixed(1); const full = c >= 1; if (full !== last.full) { last.full = full; ab.classList.toggle('full', full); if (full) vib(16); } ab.classList.toggle('charging', c > 0); }
    sweep(bDash, 'dash', d.dash); sweep(bDef, 'defl', d.defl);
    if (d.ammo !== last.ammo) { last.ammo = d.ammo; ab.classList.toggle('empty', d.ammo <= 0); }
  };
  layout(); rest(); window.addEventListener('resize', () => { if (jId === null && aId === null) { layout(); rest(); } }, { passive: true });
}
