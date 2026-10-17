- started v4.2 (full-screen layout, hands-on tutorial, graphics polish). baseline = v4.1 source at /tmp/v41_src (snapshot)
- step1a: new fill camera (gfx.js fitCamera closeOn), controls smaller/semi-transparent, layout42 tool; tuning
- step2a: tutorial rewritten (main.js tutTick/tutAdv/tutSpawnPit, ui2 tutorialShow/Ghost, CSS); needs test+shots
- tutorial works end-to-end with real touches; tools/tut42.mjs
- perf baseline running (v4.1 html at /tmp/v41_src, v4.2 layout-only at /tmp/v42_layout.html) logs /tmp/suite/perf41.log perf42a.log
- graphics: baked AO floor texture, crate tops, star fx, rim .5, soft PCF; shots42 tool running; perf baseline v4.1: calls 275/291/306/348 rendCpu 10.3/10.5/13/9.9ms (sharp 4x)
- perf v4.2 (sharp 4x): calls 242/225/204/191, rendCpu 7.5/9.1/7.3/6.6ms, tris 48k/24k/34k/37k = no regression vs v4.1. smoke31,v33test,net_ui 32/32 pass; touch31 aim point fixed (690,150); net_life 3 flakes to rerun alone
- net_life failures were a test race (A/B slot order); joins now serialized
net_life 25/25 after serialized joins; seenVer 4.2; version bump done
final min build v4.2 built; suites running -> /tmp/suite/f42
final suites: layout 9/9, tut 18/18, smoke31/touch31/v33 0 fail, net_life 25/25, net_ui 32/32 (1st run 1 flaky fail on ?room share-link, rerun clean). perf done
apk build started
shots done (catch step screenshot sometimes dark in harness only; real render ok)
README v4.2 done; staging pages
