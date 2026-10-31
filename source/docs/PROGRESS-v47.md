# v4.7.0 progress (3 hearts, default map size, no fall-through)
- 22:18 PDT: start. Owner [pt364u]: 3 hearts before die; default map medium/large; no more falling through the floor.

## Investigation (done)
- Fall paths found: (a) crumble tiles / sudden-death rings / ice cracks / trapdoor trap ('fall', opens hole=-1 under you) -> one-hit fall KO after 0.25 s grace (0 s if Edge help off); (b) the fall test is center-cell only, so standing just over half a tile past a ledge drops you; (c) respawn falls back to the original spawn cell even if it is a hole now (crumble/sudden) -> respawn-into-death; spawnEnemy falls back to [0,0] unchecked; (d) portal trap exit / bumper pop can place you on a hole; (e) KO 'launched' spin-out animation sinks the body to y=-1.2 (host + guest) = looks like falling through the floor; (f) guest: when a trapdoor closes the guest keeps hole=-1 (net/world.js HOLES apply only clears >0) -> floor shown as a hole on the guest; (g) no NaN/out-of-bounds/inside-solid rescue.
- Hearts: Fighter.hp exists (bosses); only boom/shatter/meteor/slam took hp. Snapshot already carries hp (u8), lives, inv flag. Round msg carries rules -> put rules.hearts there (old hosts send none -> guest shows 1, compatible both ways, PROTO unchanged).
- Map size: ids are small 20x12 / large 26x16 / huge 32x20. Pick **large** (the middle = "medium"). Default + one-time migration for players who never touched the size control (new setup.sizeSet flag).

## Fri Oct 30 22:27 PDT - core edits done
- Hearts: modes.js HEARTS=3 -> rules.hearts; Fighter hp/maxHp; die() costs a heart (1.4 s inv, knockback; hazards rescue); HUD hearts + xlives (ui2.js); guest hurt feedback (net/world.js).
- Falls: moveSub sub-steps (host + guest), ledge assist (3.5 u/s), guard() NaN/OOB/in-solid rescue, safe spawn/respawn/minion spawn, KO spin-out no longer sinks, guest trapdoor close restores floor.
- Map size: default 'large' (save.js + one-time sizeMig 47 for never-chosen sizes, sizeSet flag on tap; net.js defaultSettings; main.js fallbacks).
- Fixed two self-inflicted '//' comments that swallowed one-liner code (ui2.js HUD, net/world.js koAnim, rules.js x3, game.js koAnim). node --check all OK; build OK.

## Fri Oct 30 22:36 PDT - tests
- Box had lost node_modules, /workspace/out and /tmp/pp (puppeteer-core): reinstalled with npm ci (root + mobile) and npm i puppeteer-core in /tmp/pp; restarted local wrangler dev on 127.0.0.1:8799 (local only).
- Fixed save.js migration (defaults' sizeMig masked the old save's missing flag; now reads o.setup).
- Removed duplicate guest hurt feedback (relayed 'hurt' evt already does it).
- tools/hearts47.mjs: 31/31 PASS (size default + migration + user choice kept; 3 hearts players/bots; inv; HUD hearts; respawn refills; hole->heart+rescue on all sizes; last heart = real fall; inv=free rescue; rim assist; 90 u/s knockback x800 frames no wall/off-map on 3 sizes; NaN/off-map rescue; 192 spawns on safe floor (3 sizes x 8 arenas, wild traps); respawn on holed arena).
- tools/soak47.mjs written (all-bot, wild traps/events, 10 modes, 3 sizes); 60 sim-min/size running.

## 2026-10-30 22:45 PDT chaos soak + portal + version + docs
- CHAOS=2 MIN=20 soak (2 random walkers/dashers + bots, 10 modes, wild traps). v4.7: PASS on all sizes, 0 fall-on-floor/off-map/NaN/in-wall/fall-with-hearts. Fall KOs that happened only on the last heart: small 1, large 1, huge 0 (falls with hearts left all became heart + rescue; rescues 77/40/60). v4.6.3 baseline at the same settings: 2/6/0 fall KOs, each a one-hit death.
- traps.js: the portal waits rather than teleporting onto an unsafe exit. match.js dcode prefix is 470-.
- versionCode 51 / 4.7.0. README "What's new in v4.7"; docs/FALLING.md v4.7 section.
- Next: rebuild, hearts47, fin47 suite.

## 2026-10-30 22:59 PDT suite (tools/fin47.sh → /workspace/out/v4.7/fin)
- PASS: hearts47, cd45, smoke31, touch31, v33test, leak45, layout42, relay43_local, net_match.
- Known baseline failures (WebRTC blocked on this box): net_ui, net_life, net_relay43.
- falls44 and traps43 failed only because they assumed one-hit KOs. Fix: set hp=1 (last heart) in those checks. The Edge-help-off check now expects the 0.12 s anti-tunnel grace.
- tut42 (known flaky) and net_cd45 (direct scenario: host missed countdown3 under load; relay passed) are being re-run in /workspace/out/v4.7/fin2.
- New tools/net_soak47.mjs: an online soak, one browser per client, guests on forceRelay over the local wrangler relay.

## Fri Oct 30 23:12 PDT - tests written
- Box had lost node_modules, /workspace/out and /tmp/pp (puppeteer-core) - reinstalled (npm ci root + mobile, /tmp/pp puppeteer-core); local wrangler dev restarted on 127.0.0.1:8799 (local only, nothing deployed).
- Removed double hurt feedback on guests (relayed 'hurt' event already does it). Ledge assist made dt-based (3.5 u/s). Wobble dip no longer applied to dead bodies.
- tools/hearts47.mjs: 31/31 PASS (size default+migration, hearts/inv/HUD, bots, respawn, falls on 3 sizes, free rescue when invulnerable, rim assist, 90 u/s knockback no tunneling, NaN/OOB rescue, 192 spawns all safe on 3 sizes x 8 arenas wild traps, respawn on holed arena).
- tools/soak47.mjs written (bot soak, checks fall-on-floor / oob / in-solid / nan / sink).

## Fri Oct 30 23:18 PDT — suite + soak in progress
- fin47: hearts47, cd45, smoke31, touch31, v33test, traps43, tut42 and leak45 PASS. falls44 had 1 fail (the Edge-help-off fall took longer than 12 frames under chill time scale with the 0.12 s grace); the test now waits 24 frames, rerun → falls44b.log.
- Bot soak (soak47) on small: 21 arena/mode combos so far, 0 fallOnFloor/oob/inSolid/nan/sink.
- Online soak harness made WebRTC-policy-clean: netlib openN gets an `stockRtc` option (no mDNS or IP-handling flag overrides) and net_soak47 uses it with ice: [] and no local TURN. Guests forceRelay over the local whackerang relay (ws://localhost:8799).

## Fri Oct 30 23:31 PDT — NEW DIRECTION (owner, via parent)
"Instead of 3 hits, each character will have their own abilities and health." The uniform 3-heart rule is replaced with per-character health (HUD shows each character's own hearts) plus one distinct ability per character. It has to sync online. Default map Large and the fall-through fixes stay.

## Fri Oct 30 23:37 PDT — per-hero health + abilities implemented
- data.js ABILITIES and heroHp(). modes.js HEARTS='hero'. Fighter.abil.
- Bao 4♥ Comfort Food (+1♥ after 8 s with no hit). Nori 2♥ Smoke Dodge (0.45 s dash i-frames, others 0.22). Bolt 3♥ Static Throw (full-charge hit stuns 0.6 s). Salty 3♥ Nine Lives (once per round a KO leaves 1♥). Pico 3♥ Long Tongue (power-up pickup radius 2 vs 0.8). Yuki 3♥ Frostbite (hits chill to half speed for 1.5 s, synced via the goo flag). Gus 5♥ Heavyweight (half knockback, -8% walk, synced via mods). Wisp 2♥ Hover (1 s over holes before dropping).
- Hero cards show ♥ per hero. The details and lobby heroLine show hearts + ability. The HUD already draws maxHp hearts.
- Online: guests build fighters from curRules (hearts:'hero') + hero ids, so maxHp matches. Snapshots carry hp. Abilities are host-authoritative. Speed effects ride existing synced mods/flags.
- tools/abil47.mjs 19/19 PASS. hearts47 updated (generic checks on a neutral 3♥ fighter) 31/31 PASS. falls44 78/78.
- Found a pre-existing slow geometry leak (~20 geos per match, same slope in v4.6.3), which made the 2-hour single-page soak run out of RAM. Not fixed in this release (risk). The soak now runs one browser per size.
- Rerunning: fin47 → out/v4.7/fin2, bot soak per size → out/v4.7/soak2.

### Fri Oct 30 23:45 PDT — test fixes after per-hero hearts
- traps43/falls44: fighters forced to 1 heart now also get abil=null (Salty's Nine Lives was saving them). hearts47 huge: knockback loop keeps hp 99 so a spike can't KO mid-check. Rerun: hearts47, traps43, falls44 all EXIT 0.
- soak47 'sink' check counted a genuine last-heart fall into a real hole (deathKind 'fall', small/team/ice) as a fail. Fixed the check to skip fall/lava KOs (badFall still catches falls on solid floor). Small needs a rerun.
- README "What's new" now lists each hero's hearts and ability.

### Sat Oct 31 00:14 PDT — online fix: guests drew rivals past the rim
- net_soak47 (3 browsers, relay) found guests showing a remote fighter up to 1.4 tiles outside the map for a moment, while the host had it on the edge. Dead-reckoning extrapolation of a fighter moving into the wall caused it. world.js applyFighter now clamps remote alive positions to the arena (±HX/HZ − 0.4). The 2-min check is now PASS with off-map 0. Full 20-min soak and small bot-soak rerun started.

### Sat Oct 31 00:21 PDT — resumed after interruption
- Box check: wrangler local relay is up on 127.0.0.1:8799. The 20-min online soak (match 3 huge, 0 fails so far) and the small bot-soak rerun (0 bad so far) are both still running. Letting them finish.

### Sat Oct 31 00:25 PDT — bot soak done, APK build started
- Bot soak (12 s per combo, a separate browser per size, 32 combos per size = 8 arenas × classic/crumble/koth/team): small 788k frames, large 903k, huge 836k. Totals: 532 rounds, 2453 KOs, 6617 hearts lost, 1439 rescues, 13 last-heart falls into real holes. 0 fallOnFloor, 0 off-map, 0 inside-solid, 0 NaN, 0 sink. PASS on all three.
- Started tools/apk47.sh (BUILD v4.7.0-20261031).

### Sat Oct 31 00:35 PDT — online soak PASS, APK signed, final test pass started
- net_soak47, 3 browsers (1 host and 2 guests over the local relay ws://localhost:8799), about 20 min: 6 matches (small/large/huge × classic/crumble), 18 rounds, 7194 client samples, 52 KOs, 138 hearts lost. 0 for NaN, off-map, below-floor, maxHp mismatch, hp-range and console errors.
- APK/AAB built: versionCode 51 / 4.7.0, BUILD v4.7.0-20261031. Signer SHA-256 is 6e59e14a…35d8de on both the APK (v2+v3) and the AAB. Web dist was rebuilt with --min --dist --app.
- Final reruns are running into out/v4.7/final.
