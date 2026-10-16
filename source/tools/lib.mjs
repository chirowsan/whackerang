import { createRequire } from 'module'; const require = createRequire('/tmp/pp/'); const puppeteer = require('/tmp/pp/node_modules/puppeteer-core');
export async function launch(opts = {}) {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--window-size=' + (opts.w || 1280) + ',' + (opts.h || 720)] });
  const page = await browser.newPage();
  const logs = []; const errors = [];
  page.on('console', (m) => { const t = m.type(); const txt = m.text(); logs.push(`[${t}] ${txt}`); if (t === 'error') errors.push(txt); });
  page.on('pageerror', (e) => { errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '')); });
  page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
  await page.setViewport({ width: opts.w || 1280, height: opts.h || 720, deviceScaleFactor: opts.dpr || 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  return { browser, page, logs, errors };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
