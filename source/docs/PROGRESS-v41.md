# v4.1 progress
- started: simplify online UI + trap/portal clarity
- v4.1 online UI rewritten (netMenu/netJoin/netLobby + Options overlay), 4-letter codes, auto-ready, free-hero pick; net_ui.mjs rewritten; running
- net_ui 32/32 on new flow (new tests: 2 buttons, 4-letter, join boxes/focus/auto-join, wrong code error, options, auto-ready, link join)
- net_life 25/25 (code length 4, polling instead of fixed sleeps); starting trap audit: before shots
- traps.js: shared hazard language (stripe frame+badge+glow, tr.haz), new upright blue/violet numbered portals, green/yellow jump pad, fence/switch recoloured off purple/blue; verifying shots
- version bump 4.1.0/41, README + MULTIPLAYER updated; running final suites on release build
- final suites on release build v4.1: net_life 25/25, net_ui 32/32, net_broker ok, smoke31 0 fail, touch31/v33test 0 errors; building APK/AAB
- v4.1 shipped: Pages f506fc6 live, release v4.1 (apk/aab/debug verified 200 + identical), /workspace/out copies + source zip 15.9MB
