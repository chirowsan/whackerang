// Build flags (set by build.mjs from env): STORE=1 -> Play launch build (no paid-store/test-mode UI, no test hooks);
// KIDS=1 -> Kids mode (Auto match off by default, a grown-up must turn it on; online names are presets only).
export const STORE = typeof __STORE__ !== 'undefined' && !!__STORE__;
export const KIDS = typeof __KIDS__ !== 'undefined' && !!__KIDS__;
export const PRIVACY_URL = 'https://chirowsan.github.io/whackerang/privacy.html';
