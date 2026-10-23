v4.5 started: studying game loop
step1: Game countdown clock (cdTick/cdGuest, CD_LEN 3s + pre 0.45), die() invulnerable in intro
step2: main.js overlay cdUI, net host intro/goIn + guest goAt, css, audio
step3: tools/cd45.mjs written (offline countdown test)
step4: overlay split into #countdown + #cdcap, fixed stale GO-hide timer bug; cd45 35 checks
step5: offline countdown shots ok (cd-0..4), cd45 36 checks pass
step6: offline suites falls44 smoke31 touch31 v33test traps43 tut42 pass on dev build
step7: tools/net_cd45.mjs written (online countdown sync test)
step8: host countdown follows wall clock (hitches), attract cdDone, pause reset
step9: guest goAt refined by snapshot introT (fast channel)
step10: fin45.sh (full suite) started in background -> /workspace/out/v4.5-results
step11: docs (COUNTDOWN.md, README, MULTIPLAYER), version bump 4.5/45, howto Countdown para, apk45.sh
step12: flush buffered input edges at GO
step13: net_cd45 (30), shots online-guest-relay-countdown.png; next final min build + final subset + apk
step14: final min build v4.5-20261018 built; fin45 full suite on min build started
step15: all final suites pass on min build; APK build started
step16: apk45 build finished (EXIT 0), verifying
step17: APK/AAB verified: versionCode 45, cert 6e59e14a, html identical to dist; copied to /workspace/out
step18: pages pushed v4.5, source zip built
step19: release v4.5 created, downloads verified, live site has v4.5 tag
step20: live checks pass (countdown + 12/12 live relay)
perf investigation started: A/B v4.4 vs v4.5 min builds (/tmp/v44_final.html, /tmp/v45_final.html), 3 alternating runs each
A/B perf30 3x each done: v4.5 rendCpu bimodal 21-30ms on volcano/space/dojo (v4.4 5-9), haunted similar, jsMs +~2; investigating phases (tools/perf45.mjs)
finding: countdown-phase cost equal; afterGO window differed because v4.4 sim-time intro lasts longer in wall time on throttled CPU (more action in v4.5 window). re-measuring aligned by state==play
aligned-by-state result: play-phase cost same in v4.4 and v4.5 on haunted (24-36 vs 25-32 ms), dojo noisy (16-24 vs 10-17); countdown phase equal (~5-7 ms). running 5 more dojo runs each
CONCLUSION: no real v4.5 regression. 5 alternating dojo runs each: play-phase rendCpu median v4.4 26.7 (15-30) vs v4.5 30.4 (15-35), overlapping; countdown phase v4.4 7.9 vs v4.5 6.9. Earlier gap was a measurement artifact (fixed wall-time window landed in countdown for v4.4 but in gameplay for v4.5). Separate pre-existing finding: geometries +~60 and textures +~6 per restarted round in BOTH builds (scene children flat at 41). Nothing shipped; v4.5 stays current.
v4.5.1 leak fix started
leak found: Game.dispose never freed GPU resources (arena dispose had '&& 0'), floor pattern+AO textures only in onBeforeCompile closure. Fix: gfx.disposeTree + Game._base diff, userData.tex. verifying with tools/leak45.mjs
leak verified flat on dev build (6 arenas x12 restarts: geos slope ~0-1.4/round vs 44-81 before; tex 0 vs 6-7)
pixel-diff bisect: material.dispose changed fog/particle look (117k px) -> removed; geo/inst/tex dispose within noise (~1.2k px baseline noise). rebuilding + full vis compare
resumed Oct 23: box intact, version bumped 46/4.5.1, min build v4.5.1-20261023 built (/tmp/v451_final.html)
min leak before captured (geos +41..81/round, tex +6/round); after run crashed on dojo (detached frame) -> rerun to check if reproducible
min leak after (v4.5.1): geos slope ~0 all 6 arenas, tex ~0; random arena x12 flat
visual compare min v4.5 vs v4.5.1 (8 arenas x first/afterRestarts): differences only particle/ember sprites (<=7k px, 0 in ice); no blank/garbled geometry or textures. suites running (fin451.sh)
suites on v4.5.1 min: cd45 falls44 smoke31 touch31 v33test traps43 tut42 leak45 layout42 net_cd45 relay43_local PASS. net_ui/net_life/net_relay43(direct parts) FAIL on this box: Chrome managed policy /etc/chromium/policies/managed/sand-webrtc.json (disable_non_proxied_udp) blocks all WebRTC UDP candidates; identical failure on the v4.5 build => environmental, not regression. Not circumventing policy. Relay-path checks (net_relay43 38 PASS) fine.
APK/AAB built+verified: versionCode 46 / 4.5.1, cert SHA-256 6e59e14a..., apksigner v1/v2/v3 OK, AAB jar verified. Pushing Pages.
v4.5.1 SHIPPED: Pages 14bf701, release v4.5.1, downloads cmp identical, live tag v4.5.1-20261023, live45 PASS
