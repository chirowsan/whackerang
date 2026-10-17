// Whackerang signaling relay: a tiny WebSocket server speaking the PeerJS-cloud wire protocol (OPEN / OFFER / ANSWER / CANDIDATE / LEAVE / EXPIRE / ID-TAKEN).
// It only introduces browsers to each other (exchanges WebRTC connection details). It never sees game data; gameplay goes peer-to-peer.
// Run:   npm install && node relay.mjs            (PORT=9000 by default)
// Point the game at it:  localStorage.setItem('whk.relay', 'wss://your-host/peerjs?key=peerjs')   (or build it in as DEFAULT_RELAY in src/net/proto.js)
import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 9000, MAX_CLIENTS = +process.env.MAX_CLIENTS || 2000, MAX_MSG = 16 * 1024, RATE = 30; // messages / second / socket
const ORIGINS = (process.env.ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean); // e.g. https://chirowsan.github.io (empty = any)
const clients = new Map(); // id -> ws
const server = http.createServer((req, res) => { if (req.url.startsWith('/healthz')) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok ' + clients.size); } else { res.writeHead(404); res.end(); } });
const wss = new WebSocketServer({ server, path: '/peerjs', maxPayload: MAX_MSG, verifyClient: (i) => !ORIGINS.length || !i.origin || ORIGINS.includes(i.origin) });
const TYPES = new Set(['OFFER', 'ANSWER', 'CANDIDATE', 'LEAVE', 'EXPIRE']);
wss.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x'); const id = (u.searchParams.get('id') || '').slice(0, 64); const token = u.searchParams.get('token') || '';
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id) || clients.size >= MAX_CLIENTS) { ws.close(); return; }
  if (clients.has(id)) { ws.send(JSON.stringify({ type: 'ID-TAKEN', payload: { msg: 'ID is taken' } })); ws.close(); return; }
  ws.id = id; ws.token = token; ws.win = Date.now(); ws.n = 0; ws.alive = Date.now(); clients.set(id, ws); ws.send(JSON.stringify({ type: 'OPEN' }));
  ws.on('message', (data) => {
    ws.alive = Date.now(); const t = Date.now(); if (t - ws.win > 1000) { ws.win = t; ws.n = 0; } if (++ws.n > RATE) return;
    let m; try { m = JSON.parse(data.toString()); } catch (e) { return; } if (!m || typeof m.type !== 'string') return; if (m.type === 'HEARTBEAT') return; if (!TYPES.has(m.type) || typeof m.dst !== 'string') return;
    const dst = clients.get(m.dst); if (!dst || dst.readyState !== 1) { ws.send(JSON.stringify({ type: 'EXPIRE', src: m.dst, dst: id })); return; }
    dst.send(JSON.stringify({ type: m.type, src: id, dst: m.dst, payload: m.payload }));
  });
  ws.on('close', () => { if (clients.get(id) === ws) clients.delete(id); });
  ws.on('error', () => {});
});
setInterval(() => { const t = Date.now(); for (const ws of clients.values()) if (t - ws.alive > 45000) ws.terminate(); }, 15000); // clients heartbeat every 5 s
server.listen(PORT, () => console.log(`whackerang relay on :${PORT}  (path /peerjs, health /healthz)`));
