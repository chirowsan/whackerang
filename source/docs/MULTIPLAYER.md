# Whackerang v4.0 - online multiplayer

Friends-only online play for 2-4 players. Everything is free: no server of ours, no accounts, nothing paid.

## What the player sees
Main menu > **Play online** > *Create room* (5-letter code + share link) or *Join with code*. Opening `https://chirowsan.github.io/whackerang/?room=CODE` auto-joins.
Lobby: player list with ping bars, hero pick, ready-up, host chooses mode / arena / speed (Chill default) / rounds, bots fill empty seats, 6 preset emotes.
Online modes: Classic, Team, Capture the Flag, Coin Rush, Boomerang Ball, King of the Hill, Bomb Tag, Crumble.
Not online: Campaign, Survival, Boss Rush (they depend on dynamic enemy waves). Boomerang type is forced to the classic boomerang online.
After a match: rematch (starts when every connected human, host included, votes) or back to lobby (host).

## Architecture
```
 guest ──rel (ordered JSON) + fast (unordered binary)──► HOST ◄── ... ── guest
        (two WebRTC DataChannels per link)               runs the ONLY simulation
 signaling only while connecting:  browser ⇄ PeerJS public broker (wss) ⇄ browser   (or copy/paste codes, or our own relay)
```
* **Star topology, host-authoritative.** The host runs the real game. Guests send inputs (5 bytes/frame, the last 6 frames repeated, 30 Hz) and render host snapshots.
* **Snapshots:** binary, 20 Hz (every 3rd 60 Hz sim step): fighters, boomerangs, mode state, per-slot input acks, plus a small effects/sfx tail (redundantly repeated so a lost packet does not lose a hit effect). Rarely-changing state (crates, holes, items, traps) is sent on change + a refresh every 24 steps.
* **Guest:** adaptive-delay interpolation (about 85-240 ms, jitter-based), host-clock offset estimate, own-fighter prediction (replays un-acked inputs, smooth correction), local throw sound for instant feedback.
* **Determinism where cheap:** arena layout and traps come from a shared `netSeed`. All gameplay randomness (spawns, crates, bots) stays host-only.
* **Channels:** `rel` (id 1, ordered, reliable) for lobby/control/results; `fast` (id 2, unordered, `maxRetransmits:0`) for inputs and snapshots, so loss never stalls the game.
* **Bots:** empty seats are bots. If a guest drops mid-match the bot takes over that fighter; if they rejoin with the same room link they get it back (seat is reserved by a per-session id).
* **Host leaves:** every guest sees "the host closed the room" and returns to the menu. Guest silent for 6.5 s -> host drops them; host silent for 6 s -> guest gives up.

## Safety (kids)
No free-text chat, no voice, no public matchmaking, no lobby browser: you can only join with a code/link. Names are picked from presets or typed, then filtered (letters/digits, short, profanity filter) by the **host** again on arrival. Emotes are 6 fixed icons.
Room codes are **5 consonants** (20^5 = 3.2 million) - deliberately a bit longer than 4 so codes can't be guessed by trying; vowels are excluded so codes never spell words. Rooms lock when a match starts.

## Host-side validation / abuse limits
* Hello must carry the same protocol version; unknown/oversized/malformed packets are dropped (JSON <= 2 KB, binary <= 64 B).
* Token-bucket rate limit on control messages; sustained spam (>120 over budget) kicks the sender. Input packets: window cap per 2 s, axes clamped, edge-triggered actions latched, per-slot jitter queue.
* Hero / hat / skin / trail ids are re-validated against the real lists.
* Guests never decide results: the host computes round/match results. Reward amounts are computed locally from the host-sent result with caps: **60 coins and 100 XP per match, 300 coins/day online**, and no coins for matches shorter than 25 s. Gold economy stays TEST MODE and is otherwise untouched (no purchases are possible online).

## Signaling options evaluated
| Option | Cost | Verdict |
|---|---|---|
| **PeerJS public broker** `wss://0.peerjs.com/peerjs` | free, no account | **Default.** Our own ~150-line client speaks its protocol (no library bundled). Best-effort public service, no SLA. Only the OPEN handshake was verified against the live broker from this box (see "Not verified"). |
| **Copy/paste codes** (`WKz.…`, offer/answer) | free, no server at all | **Built-in fallback** ("Can't connect? Use a code" in the online menu). Works when the broker is unreachable; clunky but needs nothing. Not trickle-ICE, so the code contains all candidates. |
| **Own WebSocket relay** `server/relay/relay.mjs` | free to run locally; hosting needs an account/machine | Included, tested locally (all tests below used it). Same protocol, so it's a drop-in replacement. |
| **Cloudflare Workers + Durable Objects relay** | free plan exists; needs a Cloudflare account | Best *optional* upgrade for independence from the PeerJS broker. **Not done - needs Chirow to create a free Cloudflare account.** |
| Other free brokers / Firebase / Supabase / ably | free tiers but accounts + keys | Rejected for now (sign-up). |

STUN (free, public, no account): `stun.l.google.com:19302`, `stun.cloudflare.com:3478`.
TURN: **not free** in any dependable form. The PeerJS project publishes community TURN credentials (`turn:eu-0/us-0.turn.peerjs.com:3478`); the game includes them as a best-effort extra, unverified and with no guarantee.

## NAT limits and what the player sees
Most home Wi-Fi and phone connections work with STUN only. **Symmetric NATs** (some carriers' CGNAT, some school/corporate/hotel networks) cannot hole-punch and need a TURN relay; without one the connection fails after about 25 s. The game then shows: *"Couldn't connect. Your network may be blocking direct connections…"* with these suggestions: try another network or a phone hotspot, let the friend with the better connection host, or use the copy/paste code. Honest summary: expect most friend pairs to connect; some pairs will not unless a TURN relay is added.

## Later: deploying a relay / TURN
See `server/relay/README.md`. Costs: signaling relay = free tier on several hosts (need account); TURN = bandwidth. Per player the game uses roughly 5-7 kB/s down and about 1 kB/s up (measured below), so a 4-player room via TURN is ~25 kB/s total through the relay, about 90 MB/hour. A small VPS with `coturn` (a few USD/month) handles dozens of rooms.
Configuration without rebuilding: `localStorage.whk.relay` (broker URL) and `localStorage.whk.ice` (JSON array of iceServers).

## Privacy
Peers in a room can see each other's IP addresses (inherent to peer-to-peer). The broker and STUN/TURN operators see the IP and room code while connecting. We store nothing. Also noted in the in-game How to play and in `docs/PRIVACY-POLICY-DRAFT.md`.

## Tests (tools/)
* `net_mp.mjs` - N headless Chrome pages (real `RTCPeerConnection` + DataChannels), one host and N-1 guests, scripted autopilot input; each guest snapshot is compared against the host's state history at that tick; persistent slow-state (crates/items) mismatches are tracked; counts console/page errors; measures snapshot rate and bandwidth.
* `net_life.mjs` - 25 lifecycle/abuse checks (room full, version mismatch, unknown room, name/cosmetic sanitising, malformed/oversize packets, flood kick, locked room, guest drop -> bot -> rejoin, host leaves, host tab killed).
* `net_ui.mjs` - real clicks on a 915x412 touch viewport: menu -> create -> share link auto-join -> emote -> ready -> start -> results -> rematch -> lobby -> leave -> single-player.
* Existing suites (`smoke31`, touch, bench) re-run; see results below.
Method details: see "How the tests were run" below.

## How the tests were run
* One Linux box (8 cores), headless Chrome via Puppeteer, one page per player, **real `RTCPeerConnection` + DataChannels over loopback** (a local STUN/TURN stand-in; own relay `server/relay/relay.mjs` for signaling). Autopilot input on every player; host `rounds=2`, speed Chill, 480x270 pages.
* "Latency / loss" runs add a shim in front of the data channels (one-way delay + jitter + random packet drop on `fast` and `rel`). This is a **simulation of bad networks, not a real network**.
* Matrix runs went one at a time, but the box was also running other work during the first pass; see the Ball note below.
* Raw results: `docs/netresults/` (`net_life.txt`, `net_ui.txt`, `smoke31.txt`, `touch31.txt`, `v33test.txt`, `matrix/*.json`).

## Results (v4.0 build)
| Suite | Result |
|---|---|
| `net_life.mjs` (lifecycle / abuse) | **25 / 25 pass** |
| `net_ui.mjs` (real clicks, 915x412 touch viewport) | **24 / 24 pass** |
| Both of the above re-run on the final minified release build `v4.0-20261017-1206` | **25 / 25 and 24 / 24** (`net_*_release_build.txt`) |
| `smoke31.mjs` (all modes x speeds, 12 campaign stages, tutorial, UI screens) | **0 failures, 0 console/page errors** |
| `touch31.mjs` (real CDP touch events) | pass, no errors |
| `v33test.mjs` (every hero, cameras, audio) | pass, no errors |
| Live PeerJS broker, OPEN handshake (re-checked today from this box) | `{"type":"OPEN"}` received |

### Network matrix (players, mode, simulated one-way delay / loss) - 0 console errors in every run
| Run | Sim s | Snaps/s guests get | Guest vs host snapshot compare | Notes |
|---|---|---|---|---|
| 2p Classic, clean | 63 | 20 | 0 / 9628 fighter records differ | 5.1 kB/s down per guest |
| 2p Coin Rush, 150 ms, 5% loss | 63 | 19.1 | 0 / 10080 | 7.4 kB/s down |
| 2p Classic, 200 ms, 10% loss | 62 | 18 | 12 / 9652 differ (max 10.8 units, i.e. a snapshot right at a round reset) | guest smoothing hides it; 22 of 62 once-per-second samples saw a fighter's alive flag differ from the host's, which is expected skew right after a KO with 200 ms delay + loss |
| 3p Team / Bomb Tag / Crumble, clean | 30-36 | 20 | 0 | |
| 3p Ball, clean (re-run) | 62 | 20 | 0 / 28768 | links stayed up, 0 score mismatches |
| 3p Ball, 100 ms, 5% loss (re-run alone) | 62 | 19 | 0 / 27824 | only 2 score-string samples differed (host shows a goal ~0.1-0.2 s before delayed guests) |
| 4p CTF, clean | 62 | 20 | 0 / 56628 | 10.5 kB/s down per guest, host up ~31.5 kB/s |
| 4p King of the Hill, 200 ms, 10% loss | 62 | 18 | 0 / 57948 | 8.6 kB/s down |

Bandwidth (measured): guest about 5-10 kB/s down and about 1 kB/s up; the host sends about 5 kB/s per guest.
No persistent crate/hole/item/coin mismatch (4+ consecutive seconds) in any run.

**The one odd first-pass run** (3p Ball, 100 ms, 5% loss: host links 0, 2 score mismatches, 2 bad phase samples): it took **604 s of wall time for 50.8 s of simulation** (normal is ~93 s), so the pages were starved for many seconds. The 6 s heartbeat timeout then dropped the guests, which is the designed behaviour. Re-running it alone gave a clean run (above), and a no-loss run was clean too. So: **CPU contention in the test harness, not a Ball desync.** The `scoreMismatch` of 2 that remains is interpolation-delay skew while sampling.

Honest caveat on the metric: the snapshot comparison is exact for fighter position/alive/ammo/lives/score at the same tick, but guests see the world about 85-240 ms late by design, so the loose "state at the same wall second" columns always show small skew.

## Not verified (read this before promising anything to players)
* **Real internet.** Every connection test was on one machine (loopback). No test crossed a real router, ISP, or the public internet, and no two different networks were used. Latency/loss are simulated.
* **Real phones.** Touch was tested with emulated touch events in desktop Chrome. No Android/iOS device was used to play online; mobile Safari/WebView WebRTC behaviour, battery, and background-tab throttling are unknown. (A backgrounded phone tab stops sending inputs and would hit the 6 s timeout.)
* **Full public-broker handshake.** Only the broker's OPEN message was checked against the live PeerJS broker. A complete two-browser introduction through it was not run (all matches used our own relay, same protocol). The broker is a free best-effort service with no SLA and may be down or rate-limited at any time.
* **Strict NAT / TURN.** Symmetric NAT / CGNAT / school or hotel networks were not tested. The community TURN servers listed in the code are unverified and may not accept the shared credentials; do not count on them. Without a working TURN, such pairs will see the "Couldn't connect" screen after about 25 s. The copy/paste code fallback still needs a direct path, so it does not fix strict NAT either.
* **Would an account be needed for reliability?** Probably yes, eventually, for anything beyond a few friends. Reliable play needs (a) a signaling host we control (a free Cloudflare Workers relay needs a free Cloudflare account; our `relay.mjs` needs any always-on machine) and (b) a TURN relay with real credentials (coturn on a small VPS, or a paid/free-tier TURN provider, all requiring an account). I did **not** sign up for anything; v4.0 ships with zero accounts, which is why reliability for strict-NAT players is best-effort.
* **More than 4 players, long sessions (> a few minutes), and many rooms at once** were not tested. Longest run: about 63 s of sim per run, 2 rounds.
* **Scale / abuse on the public internet:** the host-side limits are unit-tested locally (`net_life`), not attacked by a real hostile client.
* Android APK: built and signed, but online play inside the APK was not run on a device or emulator (the web build is what the tests drove).
