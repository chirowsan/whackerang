// WebKit (Playwright WPE build) harness: this is the WebKit ENGINE with iPhone viewport/UA/touch emulation, NOT real iOS Safari/iPhone hardware.
import { createRequire } from 'module'; const require = createRequire('/tmp/pw/'); const pw = require('/tmp/pw/node_modules/playwright');
export const devices = pw.devices;
export async function wk(dev = 'iPhone 14 landscape', extra = {}, engine = 'webkit') {
  const browser = await pw[engine].launch(engine === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const d = typeof dev === 'string' ? { ...pw.devices[dev] } : dev; if (engine !== 'webkit') delete d.defaultBrowserType;
  const ctx = await browser.newContext({ ...d, ...extra }); const page = await ctx.newPage();
  // harness limit: this WPE build has no GStreamer media plugins and its web process CRASHES on new Audio() (the iOS-only silent mute-switch clip in pwa.js);
  // HTMLAudio is stubbed in the WebKit engine only. WebAudio stays real.
  if (engine === 'webkit') await page.addInitScript(() => { window.Audio = function () { return { play: () => Promise.resolve(), pause() {}, setAttribute() {}, loop: false, volume: 0 }; }; });
  const logs = [], errors = []; page.on('console', (m) => { logs.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '')));
  return { browser, ctx, page, logs, errors, version: browser.version() };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
