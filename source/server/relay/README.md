# Whackerang signaling relay (optional, free to self-host)

A ~40-line WebSocket server that speaks the same wire protocol as the free public PeerJS broker
(`OPEN / OFFER / ANSWER / CANDIDATE / LEAVE / EXPIRE / ID-TAKEN / HEARTBEAT`).
It only introduces two browsers to each other (it passes along WebRTC connection details).
**It never sees gameplay data** - gameplay is peer-to-peer (host <-> guests) over WebRTC DataChannels.

The game uses the public PeerJS broker (`wss://0.peerjs.com/peerjs?key=peerjs`) by default, so you do NOT need this
for v4.0 to work. Deploy it only if the public broker is ever down, blocked, or you want to be independent of it.

## Run it

    cd server/relay
    npm install
    PORT=9000 ORIGINS=https://chirowsan.github.io node relay.mjs     # ORIGINS empty = accept any origin
    curl localhost:9000/healthz                                      # -> "ok <connected clients>"

Limits built in: 16 KB max message, 30 messages/s per socket, 2000 clients (MAX_CLIENTS), 45 s idle timeout,
only the 5 PeerJS signaling message types are forwarded, ids must match `[A-Za-z0-9_-]{4,64}`.

## Point the game at it

* One device (testing): in the browser console `localStorage.setItem('whk.relay','wss://YOUR-HOST/peerjs?key=peerjs')`
* Everyone: change `DEFAULT_RELAY` in `src/net/proto.js` and rebuild.

Browsers on an https page need `wss://` (TLS). Put the relay behind any TLS terminator (Caddy, nginx, a tunnel, a PaaS).

## Free hosting options (none needs a credit card in principle, but all need an account - not created by us)

* **Cloudflare Workers + Durable Objects** (free plan): a Worker accepts the WebSocket and forwards to a Durable Object
  that holds the `id -> socket` map (same logic as `relay.mjs`, ~60 lines). Needs a free Cloudflare account. Free-plan
  limits change - check the current Cloudflare docs before relying on it. Not done here (no sign-up was made).
* Any always-on free VM / container host (Fly.io, Render, Koyeb, Oracle Cloud free tier ...): many require a card
  for verification and free tiers change; read the terms first.
* A computer at home with a Cloudflare Tunnel / port forward.

## TURN (relay for strict NATs) is a different thing

Signaling is cheap. **TURN relays the actual game traffic** (about 5-10 kB/s per player here), which costs bandwidth, so there is
no reliable free public TURN. The game ships the PeerJS project's community TURN credentials as a best-effort extra. If you
ever need a dependable one: run `coturn` on any VPS with a public IP, then
`localStorage.setItem('whk.ice', JSON.stringify([{urls:'stun:stun.l.google.com:19302'},{urls:'turn:YOUR-IP:3478',username:'u',credential:'p'}]))`
(or edit `ICE_DEFAULT` in `src/net/proto.js`). Cloudflare Calls TURN / Metered / Twilio have free tiers but need accounts and keys.
