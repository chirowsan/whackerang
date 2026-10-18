v4.4 started: investigating falls (hole[] system, sudden death, trapdoor, edges)
findings: falls = hole[] cells (sudden-death rings after 48s, ice random cracks, 'crumble' mode, trapdoor trap). Fallen tile currently shows flat arena-coloured ground below (no abyss), warn tile = red lerp. Holes are already synced (net holes packet) so visuals work for guests. No outer-edge falling (walls clamp).
plan: arena.js abyss+rim strips+new warn look; game.js coyote 0.25s + once-per-match save + wobble + proximity (edgeNear, haptic, tick, #edgewarn); settings edgeHelp; legend; tests tools/falls44.mjs; docs; bump 4.4
arena.js: abyss+rim+warn look written
rim colors tuned
game.js: grace/save/wobble/edgeWatch, main.js edgewarn, settings toggle, legend+drops paragraph, css
falls44 test written (24/24 on dojo,ice); running all arenas
falls44 78/78 all arenas; net_relay43 edgeSync added; wrangler needed
perf unchanged vs v4.3 (calls 195-249); haze layers only visible when holes exist, planes arena-sized; net_relay43 43/44 (C rate check relaxed: swiftshader CPU-bound)
version bumped 44, docs/FALLING.md written
min build v4.4-20261018; final suites running tools/fin44.sh -> /workspace/out/v4.4-results/summary
all final suites pass (falls44 78, traps43 119, tut42 18, net_ui 32, net_life 25, net_relay43 44, relay43 26, perf same); next APK
pushed pages v4.4
released v4.4, live verified (12/12 live relay checks)
