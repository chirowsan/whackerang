// PWA + native-shell glue: installability, offline SW, wake lock, orientation/fullscreen, iOS quirks.
import { S, save } from './save.js';

export const IS_APP = typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const ua = navigator.userAgent || '';
export const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true || IS_APP;
const web = /^https?:$/.test(location.protocol) && !IS_APP;

export const pwa = { deferred: null, installed: false, offlineReady: false, onChange: null };
const changed = () => pwa.onChange && pwa.onChange();

// ---- head links (manifest/icons) -- injected only on the web build
export function initHead() {
  if (!web) return;
  const add = (rel, href, extra = {}) => { const l = document.createElement('link'); l.rel = rel; l.href = href; Object.assign(l, extra); document.head.appendChild(l); return l; };
  add('manifest', 'manifest.webmanifest'); add('icon', 'icon-192.png', { type: 'image/png' }); add('apple-touch-icon', 'apple-touch-icon.png');
  const splash = [[2796, 1290, 3, 932, 430], [2556, 1179, 3, 852, 393], [2532, 1170, 3, 844, 390], [2688, 1242, 3, 896, 414], [2436, 1125, 3, 812, 375], [1792, 828, 2, 896, 414], [2388, 1668, 2, 1194, 834], [2732, 2048, 2, 1366, 1024]];
  for (const [w, h, r, cw, ch] of splash) { const l = add('apple-touch-startup-image', `splash/splash-${w}x${h}.png`); l.media = `(device-width: ${ch}px) and (device-height: ${cw}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: landscape)`; }
}

// ---- service worker (offline) with update handling
export function initSW(app, UI) {
  if (!web || !('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller; let controlled = hadController, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; } // first install claim: nothing to refresh
    if (reloading) return;
    if (app.mode === 'menu' && !app.paused) { reloading = true; location.reload(); } else UI.toast('Update installed - restart the game to play the new version', 5000);
  });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'offline-ready' && !pwa.offlineReady) { pwa.offlineReady = true; if (!hadController) UI.toast('Ready to play offline \u2713', 2600); } });
  const reg = () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => { pwa.reg = r; r.update().catch(() => {}); if (navigator.serviceWorker.controller) pwa.offlineReady = true; }).catch((e) => console.warn('sw failed', e));
  if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pwa.reg) pwa.reg.update().catch(() => {}); });
}

// ---- install prompt (Android/desktop Chromium) + iOS hint
export function initInstall(UI) {
  if (IS_APP) return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pwa.deferred = e; changed(); });
  window.addEventListener('appinstalled', () => { pwa.deferred = null; pwa.installed = true; changed(); UI.toast('Installed! Launch Whackerang from your home screen'); });
}
export const canInstall = () => !IS_APP && !isStandalone() && !pwa.installed && (!!pwa.deferred || IS_IOS);
export async function promptInstall(UI) {
  if (pwa.deferred) { const d = pwa.deferred; pwa.deferred = null; changed(); try { await d.prompt(); await d.userChoice; } catch (e) {} return; }
  if (IS_IOS) { showIosHint(); return; }
  UI.toast('Use your browser menu \u22EE \u2192 Install app / Add to Home screen', 4200);
}
export function showIosHint() {
  if (document.getElementById('a2hs')) return;
  const d = document.createElement('div'); d.id = 'a2hs';
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  d.innerHTML = `<div class="card"><b>Install Whackerang</b><ol><li>${safari ? 'Tap' : 'Open this page in <b>Safari</b>, then tap'} <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#8ff6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg> <b>Share</b></li><li>Choose <b>Add to Home Screen</b></li><li>Launch it from your home screen for full-screen play</li></ol><button>Got it</button></div>`;
  d.addEventListener('click', () => d.remove()); document.body.appendChild(d);
}

// ---- wake lock
let wl = null;
async function lockScreen() { try { if ('wakeLock' in navigator && !document.hidden && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { wl = null; } }
export function initWakeLock() {
  if (IS_APP) return; // native shell uses FLAG_KEEP_SCREEN_ON
  const go = () => lockScreen();
  ['pointerdown', 'touchend', 'keydown'].forEach((e) => window.addEventListener(e, go, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) lockScreen(); });
}

// ---- orientation + fullscreen
export function lockLandscape() { try { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }
export function initFullscreenFirstTap(app) {
  if (IS_APP || IS_IOS) { if (isStandalone()) lockLandscape(); return; }
  if (isStandalone()) { const f = () => { lockLandscape(); }; window.addEventListener('pointerup', f, { once: true }); return; }
  if (!matchMedia('(pointer:coarse)').matches) return;
  const first = () => {
    window.removeEventListener('pointerup', first, true);
    if (S().settings.autoFs === false) return;
    const d = document, el = d.documentElement; if (d.fullscreenElement || d.webkitFullscreenElement) return;
    const f = el.requestFullscreen || el.webkitRequestFullscreen;
    if (f) { try { const r = f.call(el, { navigationUI: 'hide' }); const lock = () => lockLandscape(); r && r.then ? r.then(lock).catch(() => {}) : lock(); } catch (e) {} }
  };
  window.addEventListener('pointerup', first, true);
}

// ---- touch hardening (no pull-to-refresh / zoom / callouts)
export function initHardening() {
  const ok = (t) => t && t.closest && t.closest('.scroll, input, textarea, select');
  document.addEventListener('touchmove', (e) => { if (e.cancelable && !ok(e.target)) e.preventDefault(); }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => { if (!ok(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
}

// ---- iOS audio: keep WebAudio alive (unlock on touchend, 'interrupted' state, mute-switch bypass)
let silent = null;
export function iosAudioKick() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (!IS_IOS || silent) return;
  try {
    const sr = 8000, n = 800, b = new ArrayBuffer(44 + n * 2), v = new DataView(b); const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = ''; new Uint8Array(b).forEach((c) => { bin += String.fromCharCode(c); });
    silent = new Audio('data:audio/wav;base64,' + btoa(bin)); silent.loop = true; silent.volume = 0.01; silent.setAttribute('playsinline', ''); const p = silent.play(); p && p.catch && p.catch(() => { silent = null; });
  } catch (e) { silent = null; }
}
