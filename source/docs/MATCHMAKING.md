# Auto match (v4.6)

Tap **Auto match** (Online menu, above Create room / Join room). The game finds other people who are searching at the same moment; if it takes too long, bots fill the empty seats. Free tier only: one extra Durable Object class in the existing `whackerang-relay` Worker (see `docs/CLOUDFLARE.md`).

## What the player sees
1. Online menu > gold **Auto match** button, with a mode chip row (Classic, Team, ... remembered in Settings storage) and a privacy line.
2. Search screen: radar animation, **Players found n/4**, **Searching: m:ss**, **Starting with bots in m:ss**, **Cancel**, and **Play vs bots now** (skip the wait).
3. Match found: a short "found" state, then the normal room: host-authoritative, direct WebRTC first, automatic relay fallback, 3-2-1-GO countdown. A toast says "N bots joined" when the host filled seats with bots.
4. If the matchmaker can't be reached (offline, blocked, daily free limit hit, browser without WebRTC): "Can't reach Auto match" with **Play vs bots now**, **Try again**, **Back**. Create / Join room still work.
5. Settings > "Auto match (online with other players)" switches the feature off (button then hidden / disabled).

## Rules (server: `server/cf-relay/matchplan.js`, pure function `planQueue`)
Queue key = mode only (no region/language: the player base is small; splitting it would only lengthen waits).
* 4 or more waiting: the oldest 4 start **at once**.
* 2 or 3 waiting: start at the earlier of the first personal deadline and **25 s after the second player joined** (grace so a third/fourth can still arrive).
* 1 waiting: after the fill deadline (**default 120 s**) the player starts alone and the host fills the room with bots (3 bots; a 2-player match gets 2 bots; etc.).
* The oldest searcher becomes **host**; the server makes a random 5-consonant room code and gives it to the host first. The host opens the room and says `open`; only then are the guests given the code (they never see a code that is not live).
* Host never opens within 10 s, fails, or leaves before the match: the group is re-queued, the next-oldest becomes host, and re-queued players re-form immediately (no second 25 s grace). Guests whose join fails or whose host leaves before the match go back to searching with the time that is left.
* Cancel / closing the tab / losing connection removes the entry immediately (a socket is the queue entry). Entries with no heartbeat for 75 s are pruned (client pings every 20 s).

## Protocol (WebSocket `wss://whackerang-relay.chirowsan-backyard.workers.dev/m`, JSON text)
Client to server: `{t:'q',mode,fill,v:1}` (join queue; `fill` = max wait seconds, clamped 5..120), `{t:'open'}` (host: room is open), `{t:'fail'}` (host/guest could not connect), `{t:'bye'}` (cancel). Plain text `ping` every 20 s.
Server to client: `{t:'st',n,fillIn}` (players found, ms until bots), `{t:'host',code,expect}` (you are host; `expect` = other humans), `{t:'found',n}`, `{t:'go',code}` (guest: join this room), `{t:'requeue'}`, `{t:'ok'}`, `{t:'err',r}`.

## Abuse limits and privacy
* Origin allowlist (same as the relay: the GitHub Pages site, Capacitor/localhost); WebSocket only (plain GET gets 426); no CORS data.
* Max 300 sockets in the queue (503), max 4 per IP (429), 30 messages per 10 s per socket (close 4029), messages <= 300 chars and text only (1003), a socket that sends no queue request within 10 s is closed (4008), unknown modes rejected (4400).
* **No personal data**: the queue entry is only {mode, enqueue time, random anonymous id, state}. The IP is reduced to a salted 6-byte hash used only to cap sockets per address, kept in the socket's memory attachment, never stored or logged. No names are sent to the matchmaker: in an Auto match room strangers only see a **preset name** (the player's custom name is never shown to strangers), no free-text chat exists in the game, and the rooms are the same host-validated rooms as before.
* Nothing is persisted (no storage writes); if the object restarts the queue is simply empty and clients re-search once or show the offline message.

## Free-tier request budget
See "Auto match budget" in `docs/CLOUDFLARE.md`: ~6-7 requests per 2-minute search, about 14,000 searches/day inside the 100,000/day pool shared with rooms and with `backyard-private-rooms`. One global Durable Object handles every queue; its CPU per message is tiny (a loop over at most 300 sockets).

## Test hooks
`?mmfill=8` or `window.__bbNet.mmFill = 8` shortens the bot-fill deadline (clamped 5..120 s) so tests and live checks don't wait 2 minutes. `window.__bbNet.rly` points at a local worker; `forceRelay` skips direct WebRTC.

## Tests
* `tools/mm_do_test.mjs`: queue logic + the real Durable Object (local `wrangler dev --local`, or `MM_URL=wss://.../m MM_LIVE=1` for the deployed one).
* `tools/net_match.mjs`: real browsers (puppeteer) click the Auto match button: **solo** (bots at the short deadline, 1 human + 3 bots), **pair** (2 humans + 2 bots, same on both screens), **cancel**, **four** (4 humans, 0 bots, no wait), **rematch** (host leaves, guest re-searches), **offline** (unreachable service -> message -> play vs bots).
* Results are in `docs/PROGRESS-v46.md`.

## Not verified
* **Direct WebRTC** between browsers: this box's Chrome policy disables WebRTC UDP, so every e2e run used the relay-forced path (`forceRelay`). The Auto match -> room hand-off is the same code path, but a real internet peer-to-peer match after Auto match was not run here.
* Real concurrent strangers: only scripted browsers on one machine. Wait times with real players, the 25 s grace and the 120 s deadline were tested with shortened deadlines; the full 120 s default was not waited out end to end.
* Per-IP cap on the deployed Worker (the box's egress IP rotates per connection); verified on the local runtime only.
* A local-runtime quirk: a server-initiated close of a socket that never sent any frame does not finish locally; real clients always send the queue request at once, and the deployed Worker was not checked for this case.
* Free-tier numbers are calculations, not dashboard measurements.
