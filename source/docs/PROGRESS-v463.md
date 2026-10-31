11:55 start v4.6.3 investigation (owner: 2+ real players Auto match vs bots still fails). Reading docs.
12:05 read docs. Protocol repro (tests/repro_mm.mjs, live worker, raw v4.6.2-protocol clients):
 - pair same mode default fill: OK (host+guest at 25 s grace).
 - mode split: A classic + B team -> 2 separate rooms, each alone with bots (queue key = mode; Auto-match mode chip is remembered per device). FAILURE MODE 1.
 - late joiner: A,B at 0 s, C at 9 s/27 s -> C never joins A/B's room (closed once matched), sits alone then bots. FAILURE MODE 2.
 - global single DO: two parallel test runs got merged (expected; real strangers too).
- 12:40 PDT browser repro (v4.6.2 build, live worker): 2 real clients same mode over relay -> OK (41 s, both see 2 humans + 2 bots). Wrote tests/mm_multi.mjs (N browsers, staggered AT, per-client MODES, RELAY, OLD html, CANCEL). Saved v4.6.2 html as /workspace/out/v4.6.3/old462.html for compat tests. Running N=3 AT=0,4,9 repro.

## ~12:00 PDT — repro complete + server/client changes written
- Live v4.6.2 repro: pair OK (41s), N=3 staggered 0/4/9 OK, N=4 same moment OK (20s, hhhh), relay-only pair OK (39s).
- FAIL modes: (1) mode split (classic vs team) → two separate queues, both stuck searching >70s; (2) late joiner (AT=0,0,35) → first two matched, third alone searching >95s (server forgot rooms after `open`); (3) long grace/fill (25s/120s) looks like failure; (4) offline had no auto-retry/diagnostic code.
- Changes: matchplan.js (12s grace/5s settle/22s cap, pickRoom, cleanName/cid), worker.js Matchmaker (single queue, cid idempotency, room state via v2 host beacon `seats`, late `go`+`inc`), net.js (lateSeat replaces bot mid-match, humin evt), match.js (MM_V 2, auto-retry x4, beacon, dcode), netui.js (names, code, status).
- Local wrangler dev (8799) picked up new code; tools/mm_do_test.mjs 35/0 PASS.

## ~12:15 PDT — local browser runs (wrangler dev) + sync bug found
- tests/mm_v463.mjs (new v2 protocol test) local: 18/18 PASS. Version bumped: build.gradle 50/"4.6.3", mobile/package.json 4.6.3, BUILD v4.6.3-20261030 (/tmp/tag463).
- tests/mm_multi.mjs local: same2 OK 27s, mode split OK 26s (was FAIL), stag3 OK 29s, late3 first run OK (hhhb), second run FAIL: late joiner seated (hhhb on all screens) but got 0 snapshots.
- Root cause 5: host only marks peers `joinedMatch` (snapshot fan-out) at round start, so a late joiner / rejoiner was frozen until the next round. Fix: hostRejoin sets p.joinedMatch = true. Rebuilt.
- Prepared: tools/apk463.sh, tools/fin463.sh, /workspace/cf_deploy_463.js (no migrations block; same bindings).

## 12:21 PDT — Worker deployed
- whackerang-relay redeployed via Cloudflare MCP (PUT script, same bindings MATCH/ROOMS, migration tag stays v2, compat 2026-04-01). Modified 2026-10-30 19:21:53 UTC (12:21 PDT). No new resources. backyard-private-rooms untouched.
- Local mm_multi results: four (mixed modes, staggered) OK 24s, relay OK 26s, old v4.6.2 host + 2 new OK 28s, cancel+re-press OK 28s, six (2 rooms hhhh+hhbb) OK 42s. midmatch failed (old build without the joinedMatch fix); re-running.

## 12:27 PDT — local late-join fixed, live protocol green
- Local: late3b OK 47s (late player seated mid-lobby/match, gets snapshots), midmatchb OK 71s (joined at 60s, took over a bot). late4old (v4.6.2 host + late v4.6.3 player): late player got its own bot game after the 30 s fill (expected; old hosts can't advertise seats).
- Live: tests/mm_v463.mjs 3/3 runs 18/18. tools/mm_do_test.mjs live 34/35 (per-IP cap check is a known live-only skip; needs MM_LIVE=1, box egress rotates IPs).
- Docs: MATCHMAKING.md v4.6.3 section, CLOUDFLARE.md change log.
- Started live browser sequence (live1-seq.log): 14 scenarios incl. three 6-client runs.

## 12:42 PDT — live browser run 1: 13/14
- Live (v4.6.3 client + deployed worker): same2 26s, mode 26s, stag3 30s, late3 48s, midmatch 71s, four(mixed modes) 24s, relay 26s, old(v4.6.2 host) 29s, cancel 29s, late3b 46s, midmatchb 72s, six2 (all at once) 37s, six3 (relay-forced, staggered) 32s: PASS.
- six (0,0,1,2,4,8) FAIL: clients 0+1 froze ~110 s (their timers did not run; 'connecting' 112 s). Chrome's single SwiftShader GPU process was at 577% CPU on the 8-core box (load 8.3); the other 4 matched fine and the frozen host's guests re-queued and found the other room (requeue path works). Judged a harness artifact; added SPLIT=1 to mm_multi (one browser per client) and re-running six x4 (live2-seq.log).

## 12:43 PDT — skip list (dead-room loop guard)
- Root cause 6 (found while analysing the frozen-host run): a late joiner that fails to reach an advertised room (host frozen/backgrounded but its queue socket still alive) re-queued and could be offered the same room again until it went stale (75 s). Fix: client requeue sends q.skip = last ≤3 failed codes; server pickRoom never offers those. Old servers ignore the field.
- Local tests/mm_v463.mjs now 20/20 (2 skip checks). Client rebuild + worker redeploy pending until live2 sequence finishes.

## 14:09 PDT — RESUMED after interruption: finishing skip-list (rebuild + redeploy), short live re-check (SPLIT=1, ≤4 clients), regression, ship.

## 14:10 PDT — client rebuilt (skip list), worker redeployed (modified 21:09:56 UTC = 14:09 PDT, tag v2, same bindings, no new resources). live2 sequence before this: 6/6 PASS (4 six-client runs incl. 3 SPLIT, mode3, late3c).
- 14:15 PDT: mm_v463 after skip-list: local 20/20, live 20/20 (post-14:09 deploy). live3 SPLIT seq: same2 OK 26.5s, mode OK 26.6s, late3 OK 46.8s (late at 35s); four/relay/old/midmatch running.
- 14:20 PDT: live3 SPLIT seq 7/7 OK: same2 26.5s, mode 26.6s, late3 46.8s, four (4 modes) 24.9s hhhh, relay 26.2s, old(v4.6.2 host) 28.7s, midmatch (join at 60s, takes bot seat) 71.4s. Starting fin463.sh regressions.
- 14:36 PDT: fin463: cd45 falls44 smoke31 touch31 v33test traps43 leak45 layout42 net_cd45 relay43_local PASS; net_ui/net_life/net_relay43 fail = known direct-WebRTC-blocked baseline (same as v4.6/v4.6.2); net_match 25/26 (offline test waited 15 s, but v4.6.3 now auto-retries 2/4/6/8 s first -> raised to 40 s); tut42 15/18 (trap didn't fire in 9 s window, load ~8.5) -> rerunning both.
- 14:38 PDT: reruns: net_match offline 3/3 (net_match total 26/26), tut42 18/18 -> regressions green except known WebRTC-baseline trio. Starting APK/AAB build (tools/apk463.sh).
- 14:40 PDT: tools/apk463.sh: AAB signed, release APK signed. aapt: com.chirow.whackerang versionCode 50 / 4.6.3. Signer SHA-256 6e59e14a…35d8de on APK and AAB = same key as the v4.6.2 release APK.
- 14:44 PDT: web dist rebuilt after APK (BUILD=v4.6.3-20261030 --min --dist --app): Whackerang.html, dist/index.html, dist/sw.js carry the tag. MATCHMAKING.md: root cause (6) added, test counts updated.
- 14:45 PDT: packaging source zip (same file set as v4.6.2 + tests/, PROGRESS-v463, apk463/fin463), creating GitHub release v4.6.3, Pages deploy.
- 14:46 PDT: GitHub release v4.6.3 created (/usr/local/bin/gh): https://github.com/chirowsan/whackerang/releases/tag/v4.6.3 with Whackerang.apk, Whackerang.aab, Whackerang-debug.apk, whackerang-v4.6.3-source.zip. Tag was created on main at 6c2fe5f (before the Pages commit), the same way as v4.6.2.
- 14:47 PDT: Pages commit 96eb275 pushed (dist + source/ mirror). Pages build "built" at 96eb275. Live https://chirowsan.github.io/whackerang/ 200 with v4.6.3-20261030, and sw.js 200 with v4.6.3-20261030. DONE.
