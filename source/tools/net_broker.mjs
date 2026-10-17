// Two browsers (host + guest) through the REAL public PeerJS broker (wss://0.peerjs.com) for signaling; the data path uses a local STUN (127.0.0.1:3478) because this box gathers no usable host candidates. Needs internet. Prints host code, guest phase (expect "lobby") and lobby player count (expect 2).
import { createRequire } from 'module'; const require = createRequire('/tmp/pp/'); const puppeteer = require('/tmp/pp/node_modules/puppeteer-core');
import { startTurn } from './netlib.mjs';
const turn = await startTurn();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns', '--force-webrtc-ip-handling-policy=default_public_and_private_interfaces'] });
const mk = async () => { const p = await b.createIncognitoBrowserContext().then((c) => c.newPage()); await p.evaluateOnNewDocument(() => { window.__bbNet = { ice: [{ urls: 'stun:127.0.0.1:3478' }] }; }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); await p.setViewport({ width: 915, height: 412 }); await p.goto('file:///workspace/boomerang-brawl/Whackerang.html'); return { p, errs }; };
const A = await mk(), B = await mk(); await sleep(3000);
const host = await A.p.evaluate(async () => { const r = await __bg.net.host(); return { code: r.code, signal: r.signal }; }); console.log('host', JSON.stringify(host));
await B.p.evaluate((c) => { __bg.net.join(c).catch(() => {}); }, host.code);
for (let i = 0; i < 40; i++) { await sleep(1000); const ph = await B.p.evaluate(() => __bg.net.phase); if (ph === 'lobby' || ph === 'ended') break; }
console.log('guest', await B.p.evaluate(() => [__bg.net.phase, JSON.stringify(__bg.net.error)]), 'hostPlayers', await A.p.evaluate(() => __bg.net.lobby.players.length), 'errs', JSON.stringify([A.errs, B.errs]));
await b.close(); turn.stop(); process.exit(0);
