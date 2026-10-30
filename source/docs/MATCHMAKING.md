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
* Host never opens within 25 s (10 s before v4.6.2), fails, or leaves before the match: the group is re-queued, the next-oldest becomes host, and re-queued players re-form immediately (no second 25 s grace). Guests whose join fails or whose host leaves before the match go back to searching with the time that is left.
* Cancel / closing the tab / losing connection removes the entry immediately (a socket is the queue entry). Entries with no heartbeat for 75 s are pruned (client pings every 20 s).

## Protocol (WebSocket `wss://whackerang-relay.chirowsan-backyard.workers.dev/m`, JSON text)
Client to server: `{t:'q',mode,fill,v:1}` (join queue; `fill` = max wait seconds, clamped 5..120), `{t:'open'}` (host: room is open), `{t:'fail'}` (host/guest could not connect), `{t:'bye'}` (cancel). Plain text `ping` every 20 s.
Server to client: `{t:'st',n,fillIn}` (players found, ms until bots), `{t:'host',code,expect}` (you are host; `expect` = other humans), `{t:'found',n}`, `{t:'go',code}` (guest: join this room), `{t:'requeue'}`, `{t:'ok'}`, `{t:'err',r}`.

## Abuse limits and privacy
* Origin allowlist (same as the relay: the GitHub Pages site, Capacitor/localhost); WebSocket only (plain GET gets 426); no CORS data.
* Max 300 sockets in the queue (503), max 8 open sockets per IP (429; 4 before v4.6.2 — raised so a family/school Wi-Fi with several phones and reconnects can't hit it), 30 messages per 10 s per socket (close 4029), messages <= 300 chars and text only (1003), a socket that sends no queue request within 10 s is closed (4008), unknown modes rejected (4400).
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

## v4.6.2 handoff (client: `src/net/match.js`, one state machine: connecting > searching > found > hosting | joining > joined)
* Host: opens the room, sends `open`, then **waits up to 45 s** (+15 s while a guest is mid-join) for the expected players before filling seats with bots (v4.6.1 started 12 s after opening, which shut out slow guests). The wait counts down on the lobby ("Waiting for 1 more player... bots fill in 32s (or tap START)"); the host can START early.
* If the matchmaker socket closes before `open` was sent, the host gives up the room and searches again; if it closes after `open` and nobody arrives within 15 s, likewise ("Could not reach the other players").
* Guest: stays on the search screen ("Joining the room...") until the host's welcome arrives, so the match screen never shows an unconfirmed room. Direct WebRTC first (shorter 4.5 s signaling wait in Auto match), relay fallback, 15 s welcome timer. A failed join or a link that drops in the lobby is retried once **through the relay**; if that fails too the player sees a clear reason (e.g. "That match had already started. Searching again...") and is put back in the queue with a fresh search instead of being dropped into a solo game.
* Same Wi-Fi / same public IP: nothing in the matchmaker or relay merges or replaces players by IP; identity is a random per-tab id. A rejoin with the same id retires the old seat first so nobody is counted twice.
* No flicker: the lobby status is updated in place (v4.6.1 rebuilt the whole lobby 4x a second, replaying its fade-in animation), and re-rendering the same screen skips the entrance animation.
* Connection details: Settings > "Online: show connection details", or long-press the room code in the lobby. Shows role, room code, path (direct/relay), auto-match state, players, phase, last error and the last few events. No names or IPs.
* Test: `tools/net_handoff.mjs` (two real browsers, not forced to relay; env LAG, SIGHANG, GAP, FILL, DROP=host|open, RLY=ws://127.0.0.1:8799 for local wrangler).

## v4.6.3: one queue, 12 s grace, late join into running Auto rooms
Fixes "still fails matching 2 or more people against bots". Root causes found by reproducing with 2–6 real clients (tests/mm_multi.mjs): (1) the queue was split per **mode**, and each device remembers its own chip, so two friends on different chips never met; (2) the server forgot a room as soon as the host opened it, so anyone searching a little later sat alone until the 120 s bot fill and then played a separate bot game; (3) long grace/fill (25 s / 120 s) looked like failure; (4) a dropped search ended on "Can't reach" with no retry; (5) a player who took a seat mid-match got no snapshots until the next round (frozen screen); (6) a late joiner whose join failed (e.g. frozen host) could be offered the same dead room again and again.
* **One queue for all modes** (the oldest searcher's mode is played; the others are told the mode). Rules in `planQueue`: 2–3 waiting start **12 s after the second** joined, extended so the newest arrival has at least 5 s, capped at 22 s after the second. Client default fill 30 s (was 120 s).
* **Open Auto rooms** (v2 hosts): after `open` the host keeps its queue socket (the "beacon") and reports `{t:'seats',free,ph:'lobby'|'match'}`; `{t:'closed'}` or socket loss removes the room. A room is offered for at most 20 min. A searcher is sent straight in (`found{late:1}` + `go{code,mode,late:1,ph}`) when a room has a free seat; the host gets `{t:'inc',s,nm}` and reserves the seat for 25 s. Mid-match, the late player takes over a bot (its fighter, team and score); everyone sees a toast. v1 (v4.6.2) searchers are only sent to rooms still in the lobby.
* **Skip list**: `q` may carry `skip:[codes]` (≤3); a player whose join failed is never offered that room again (a frozen host's beacon can't trap it).
* **Idempotent join**: `q` carries the per-tab random id `cid`; a second search from the same tab replaces the older socket (close 4000 'replaced') and keeps its queue place.
* Client: `q` = `{t:'q',mode,fill,v:2,cid,nm}`. Failed connect/handoff retries automatically (2/4/6/8 s) with "Retrying…" on screen, then the offline screen. Search/offline screens show **"With: names"** and a diagnostic code `463-<state><n>-<err>-<via>` (state letter I/C/S/F/H/J/D/O, n = players found, err = last error or OK, via D=direct R=relay).
* Relay fallback unchanged (direct WebRTC first, relay automatic); all browser tests run relay-only because the test box blocks WebRTC UDP.
* Compatibility: v4.6.2 clients (v1) still match with v4.6.3 clients in either role; a v1 host's room simply cannot take late players.
* Tests: `tests/mm_v463.mjs` (protocol, 20 checks), `tests/mm_multi.mjs` (N real clients in Chromium; env N, AT, MODES, RELAY, OLD, CANCEL, RLY, SPLIT=1 = one browser per client), `tools/mm_do_test.mjs` (updated rules).
