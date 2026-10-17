// Multiplayer test helpers: several isolated browser contexts on localhost + a local relay (server/relay/relay.mjs).
import { createRequire } from 'module'; const require = createRequire('/tmp/pp/'); const puppeteer = require('/tmp/pp/node_modules/puppeteer-core');
import { spawn } from 'child_process';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const HTML = 'file:///workspace/boomerang-brawl/Whackerang.html';
export async function startRelay(port = 9100) { const p = spawn('node', ['/workspace/boomerang-brawl/server/relay/relay.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' }); await sleep(700); return { port, url: `ws://127.0.0.1:${port}/peerjs?key=peerjs`, stop: () => p.kill() }; }
// Chrome on this box gathers no host candidates, so tests use a local STUN/TURN server (node-turn) on 127.0.0.1:3478: real RTCPeerConnection + DataChannels.
export async function startTurn() { const p = spawn('node', ['/workspace/boomerang-brawl/tools/netturn.mjs'], { stdio: 'ignore' }); await sleep(900); return { stop: () => p.kill() }; }
export const LOCAL_ICE = [{ urls: 'stun:127.0.0.1:3478' }];
export async function openN(n, o = {}) {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--disable-features=WebRtcHideLocalIpsWithMdns', '--force-webrtc-ip-handling-policy=default_public_and_private_interfaces', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=' + (o.w || 800) + ',' + (o.h || 450)] });
  const pages = [];
  for (let i = 0; i < n; i++) {
    const ctx = await browser.createIncognitoBrowserContext(); const page = await ctx.newPage(); const errors = [], logs = [];
    page.on('console', (m) => { const t = m.type(); const x = m.text(); logs.push(`[${t}] ${x}`); if (t === 'error') errors.push(x); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
    page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
    await page.setViewport({ width: o.w || 800, height: o.h || 450, deviceScaleFactor: 1, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await page.evaluateOnNewDocument((cfg) => { window.__bbNet = { relay: cfg.relay, ice: cfg.ice || [{ urls: 'stun:127.0.0.1:3478' }] }; if (cfg.shim) window.__bbNetShim = cfg.shim; try { if (!localStorage.getItem('whackerang.save.v1')) localStorage.setItem('whackerang.save.v1', JSON.stringify({ tutorialDone: true, coins: 100, settings: { quality: 'fast', onlineName: cfg.name, noAutoPause: true } })); } catch (e) {} }, { relay: o.relay, ice: o.ice, shim: o.shim, name: ['Zippy Fox', 'Mighty Mango', 'Captain Boom', 'Sneaky Newt'][i] });
    await page.goto(o.url || HTML); await sleep(1800); pages.push({ page, errors, logs, ctx, i });
  }
  return { browser, pages, close: () => browser.close() };
}
export const ev = (p, fn, ...a) => p.page.evaluate(fn, ...a);
export async function waitFor(fn, ms = 15000, step = 150) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
