# v4.9 (local, unreleased): calmer maps + fewer traps (owner t383u)

### Fri Nov 6 PST: request
"Maps are a little too crowded and hard to see. Make the graphics a lot better, and reduce the number of traps." Local only. Nothing gets pushed, published or built into an APK without the owner's OK.

### Fri Nov 6 PST: done locally (build tag v4.9.0-dev; versionCode/versionName still 52 / 4.8.0)
- New density flag `dens` (2 = v4.9, 1 = v4.8). Game takes it from `o.dens` (default 2). The host's 'round' message now carries `dens`, and netStartGuestRound uses `c.dens || 1`, so a v4.9 guest builds the same map as a v4.8 host. No PROTO bump.
- arena.js genLayout(id, seed, dens): at dens 2 the scattered randQuad clutter is cut to crates x0.5, extra pillars x0.5, lava x0.6 and spikes x0.6. The fixed space grid goes from every 3rd cell to every 4th. The signature fixed pillars are kept.
- traps.js: at dens 2 with no explicit trapSet (ball mode keeps its own set), mirrored q4 groups become r2 pairs, each trap kind appears once, and the map-size repeats are dropped. The arena keeps its first 2 kinds on small, 3 on large and 4 on huge (+1 on wild). Only switches whose kind survives are kept. Trap spacing is x1.15 and the spawn pad +1.0 u on large/huge.
- Visuals: quieter floor checker (A/B 45% toward the mid colour, -4% saturation, less per-tile noise), floor pattern art 0.55 -> 0.30, a soft centre light with a darker rim, contact AO under obstacles 0.46 -> 0.58, and lava embers 1.2/s -> 0.45/s per tile.
- Trap counts (avg per arena, 5 seeds, tools/trapcount49.mjs):
- small/some: avg 4.1 -> 2.8 per arena; dojo 2.4->2, rooftop 4.8->4, jungle 3->3, ice 5.2->2, volcano 5->3, pirate 2.8->2, space 7.2->4, haunted 2.4->2
- large/some: avg 9.2 -> 4.5 per arena; dojo 6.2->4, rooftop 10.8->5, jungle 6->4.8, ice 10->4.4, volcano 12.8->5.6, pirate 6.6->3, space 14->6.8, haunted 7.2->2.8
- huge/some: avg 16.4 -> 7.9 per arena; dojo 13->7, rooftop 17.6->10.4, jungle 14.2->7, ice 16->6, volcano 23->7, pirate 12.4->7, space 21->11, haunted 14->8
- small/wild avg 4.9 -> 3.4 ; solid cells 31.4 -> 22.7
- large/wild avg 10.0 -> 4.9 ; solid cells 47.0 -> 31.8
- huge/wild avg 19.2 -> 7.9 ; solid cells 61.2 -> 42.6
- Tests: tools/dens49.mjs 79/79 (new: host==guest parity at dens 2, v4.8-host fallback parity, spawn clearance, trap count <=60% (small <=70%), solid cells -20%); tools/traps43.mjs 0 FAIL x3 (one flaky saw-coverage fail at spacing 1.35 led to the 1.15 tune); poison48 57/57; abil47 19/19; hearts47 31/31.
- Not run: real WebRTC net tests. The box gathers no WebRTC candidates (net_quick: guest stuck 'joining' on the untouched v4.8 build too), and the local wrangler relay on :8799 is not running and was not started.
- Shots: /workspace/out/v4.9/{before,after}/ and cmp-*-phone.png / cmp-*-desktop.png. Patch: /workspace/out/v4.9/v4.9-visual-traps.patch

### Fri Nov 6 PST: pass 2, real art/readability + mixed-version safety (local, build v4.9.0-dev, not released)
- Root-cause fix for the "dark floating smudges": the floor shader bakes AW/AH, but every map size shared one program cache key ('rimtoon-floorpat'), so a program from another size was reused and the baked contact shadows / floor art landed off the obstacles. The key is now per size, and the AO strength from pass 1 now sits under the crates and pillars.
- Root-cause fix for the "giant yellow props": switch cylinders were built without a z scale (a 1 u deep oval, 0.5 u tall). They are now low, round floor plates. The trigger radius is the same (0.6 fighter / 0.75 boomerang) and they have no collider. Parked crusher plates (y=11, at camera height) are now hidden until they drop.
- Themed floor materials (scenery.js tileTex, a grey-centred seamless 2x2-cell detail map multiplied in the floor shader): dojo warm wood boards (palette changed from the green check), pirate deck planks with nails, jungle mossy earth with grass flecks, space bevelled metal panels with rivets, rooftop tar tiles, ice frosted slabs with hairline cracks, volcano basalt flagstones, haunted cobbles. The checker is now only a hint (80% toward the mid colour).
- Hazards: idle stripe frames 1.0 -> 0.5 (dormant lethal 0.42 -> 0.30), telegraph blink and active state unchanged (loud). One calmer chevron per conveyor tile instead of two bright ones. Boulder lanes at dens 2: 2 on large+ (was 3), 1 below.
- Heroes: thin dark halo outside the team ring plus a firmer blob shadow (0.62 -> 0.74). Models, abilities and hearts are untouched.
- Compatibility (no PROTO bump): the guest hello carries dens:2. The host builds each round with roomDens() = 1 if any connected guest lacks it (the whole room plays the v4.8 layout), else 2. A v4.8 client joining or rejoining while a dens-2 round runs gets reject:version (the old client shows "Different game version"), so maps are never silently different. v4.8 hosts send no dens, so v4.9 guests use 1.
- Ball mode: trapSet fixed at bumper q4 + jump r2 (10 trap objects incl. sub-parts per arena, all non-lethal, empty layout). Left unchanged on purpose because it is ball gameplay, not clutter.
- Tests: dens49 84/84 (adds handshake checks on the real net object), traps43 97/0 x2, poison48 57/57, abil47 19/19, hearts47 31/31. Real two-browser runs over a LOCAL wrangler dev relay (127.0.0.1:8799, workerd emulator, no account, stopped afterwards): net_poison48 10/10 on both the new build and vanilla v4.8, net_match 26/0, net_mixed49 13/13 (new<->new dens 2 identical; new host + v4.8 guest -> dens 1, identical; v4.8 host + new guest -> identical; v4.8 guest mid dens-2 round -> reject:version, never enters). Direct WebRTC still gets no candidates on this box, so these all ran over the relay path.
- Shots: /workspace/out/v4.9/after2/, cmp2-*-phone.png, cmp2-*-desktop.png, cmp2-focus-telegraph.png, cmp2-focus-active.png (focus-before/ focus-after/). Patches: v4.9-full.patch (vs src-before), v4.9-pass2-only.patch (vs src-pass1).

### Fri Nov 6 16:25 PST: pass 3 started (owner t384u: "Still very chaotic", pass-2 shots rejected, NOT approved)
- Goal: a fundamentally calm default map. Fighters read first, then attacks, then a rare hazard. Budget ~1-2 hazard encounters on small, 2-3 on large, 3-4 on huge (environmental lava/spikes/conveyors count). Cover goes in a few clusters. No full-width stripe or arrow carpets, quieter ambient FX and pickups, a clear own-player marker.
- New layout capability dens 3 (pass-2 dev builds = 2, v4.8 = 1). The room plays the lowest capability, and mid-round joins below the round's level are rejected. Backups: /workspace/out/v4.9/src-pass2 + pass2.html.

### Fri Nov 6 ~17:40 PST: pass 3 done locally (build v4.9.0-dev; nothing pushed or published; NOT approved)
- Calm layout (genLayout dens 3): no scattered crates/pillars, no conveyor loops, lanes, spikes or jungle lava. One mirrored L of cover per quadrant (pillar + 2 crates), plus a small pair near the side walls on huge. Volcano keeps 2 lava patches as its signature.
- Calm traps (CALM table): small = one signature pair, large = pair + one centre trap, huge = two pairs. Volcano's lava counts, so its traps start at large. Mirrored and seeded, and lethal kinds still get switches. 'wild' keeps the pass-2 mayhem set on the calm layout.
- Hazard encounters per arena, default (traps + lava/spike/conveyor patches, jump/tele excluded; tools/trapcount49.mjs, 5 seeds):
  small 6.97 (v4.8) / 5.33 (pass 2) -> 2.00 (max 2); large 13.35 / 8.47 -> 3.00 (max 3); huge 22.40 / 12.90 -> 4.00 (max 4).
  Solid blockers per arena: small 31.4 / 22.8 -> 8.7; large 47.0 / 31.7 -> 17.3; huge 61.2 / 42.8 -> 18.3.
- FX/props: ambient particles 9/s -> 2.2/s, lava embers 0.45 -> 0.15, dash trail 0.7 -> 0.3 chance, pickups ~30% smaller and lower with half the glow, switch plate rings 0.9 -> 0.6 at lower alpha, dormant/idle stripe frames 0.18/0.28, goo 0.78 -> 0.5 alpha, floor emblem 0.3 -> 0.18. Own player gets a white ring plus the team ring; enemies keep their team ring only. Attack and hit cues are unchanged.
- Capability: hello dens 3. roomDens = the lowest connected guest capability (3 calm, 2 pass-2 dev, 1 v4.8). Joining mid-round below the running level -> reject:version.
- Tests: dens49 132/132 (per-arena encounter caps 2/3/4, >=1 hazard, blockers -55% vs v4.8, dens 3/2/1 parity, handshake), traps43 (wild) 99/0, traps49calm 74 PASS + 1 expected "boulder kind not used by calm" line, poison48 57/57, abil47 19/19, hearts47 31/31. LOCAL wrangler relay only (stopped afterwards): net_poison48 10/10, net_match 26/0, net_mixed49 16/16 (calm<->calm dens 3; pass-2 guest -> room dens 2; v4.8 guest -> dens 1; v4.8 host -> dens 1; v4.8 guest mid calm round -> rejected). The online runs predate the final visual-only tweaks (switch ring, goo alpha, emblem).
- Shots: /workspace/out/v4.9/cmp3-<arena>-phone.png, cmp3-<arena>-desktop.png (top pass 2, bottom pass 3), cmp3-{dojo,space,volcano,jungle}-combat-phone.png, cmp3-{dojo,space}-combat-desktop.png. Raw: p2/, after3/. Patches: v4.9-full-pass3.patch, v4.9-pass3-only.patch. Backups: src-before, src-pass1, src-pass2 (+ pass2.html, before.html).
- Remaining: the boomerang trails and hit puffs in combat are still busy (attack cues, kept on purpose). Dormant pit/trapdoor decals still show orange target crosshairs. Not checked on a real phone, and direct WebRTC is still unavailable on the box (relay path only).
### Fri Nov 6 ~16:45 PST: QA cleanup (test-only, local)
- tools/traps49calm.mjs: the boulder "kind seen" check is now an explicit SKIP (N/A: calm layouts have no boulder lanes). Hammer and fence are still asserted, and every active-trap assertion is unchanged.
- Results: traps49calm 76 pass / 0 fail / 1 skip. traps43 (wild/legacy, boulders present) 107 pass / 0 fail, including 5 boulder assertions. dens49 132/132: the 2/3/4 encounter caps pass for all 8 arenas on small, large and huge.
- Local rebuild with node build.mjs. No graphics or gameplay edits, no version bump, nothing pushed or deployed.

### Fri Nov 6 16:55 PST: bushes/stealth started (pt385u). Backups: out/v4.9/src-pass3, pass3.html, tools-pass3. Local only.
### Fri Nov 6 ~17:50 PST: bushes / stealth done locally (pt385u). NOT approved; no push, deploy or version bump. bb-pages, APK, dist and public untouched.
- Rules (src/stealth.js):
  - Concealment: a fighter whose whole footprint (centre plus 4 corners at 0.3 u) stands on bush cells is hidden from opponents.
  - Reveal for 1.5 s (game time): throwing, parrying, using the ULT, or being hit, frozen or stunned by a ULT. Reveals take effect at once, even during hit-stop.
  - Discovery: an opponent within 1.8 u sees you.
  - Leaving the bush, a KO, or carrying the bomb or flag ends concealment at once.
  - No damage bonus, invulnerability, collision or slowdown. Boomerangs, explosions and AoE still hit hidden fighters.
  - Targeting: aim assist, homing and chain retargeting skip hidden rivals. Bots never pick a hidden target and drop one that slips into cover; a throw a bot already aimed still flies.
  - On the opponent's screen: no model, ring, marker, shadow, minimap dot, edge arrow or camera framing.
  - On your own and teammates' screens: body drawn at 45% opacity, with the ring and YOU marker kept. No new text or particles. Footstep dust, dash trail and the Bao regen popup are suppressed while hidden.
  - HUD hearts and names are unchanged (they don't reveal position). Couch play with several local humans: a fighter is hidden on screen only if hidden from every local viewer's team.
- Layout (genLayout dens 4 = calm + bushes):
  - Small: two 2x4 side-wall flank pockets (16 cells). Large/huge add a 2x2 pocket behind each cover L, against the top/bottom wall (up to 32 cells).
  - Placement: 4-way mirrored, never central, kept clear of spawns, off solids and hazards.
  - Traps avoid bush cells, and bushClean drops any bush cell within 1.6 u of a trap, switch or pad, or in a danger area.
  - No bushes in Boomerang Ball (a hidden carrier or goalie would be unfair) or in attract mode.
  - Art: 4 low instanced toon clumps per cell plus a soft dark ground patch, themed colours. No shadows cast, no animation or sparkle.
- Online:
  - Capability: hello dens 4; roomDens = the lowest connected guest (4 bushes, 3 calm-only pass-3, 2 pass-2, 1 v4.8). A mixed room falls back to that layout with no bush mechanic. A guest below the running round's level is rejected mid-round with reject:version.
  - Host authority: the host decides concealment and sends it in a snapshot tail (0xB5 tag) only in bush rooms. Guests draw that state from their own fighter's point of view.
- Tests:
  - Offline: bush49 85/0 (layout per size x arena, determinism, mirroring, clearances, caps 2/3/4 kept, cover pre-trap identical to calm, no bushes on dens 3 or Ball; mechanics: enter, exit, edge, throw/hit reveal and rehide, nearby discovery, self/opponent view, minimap, aim assist, bots, blind-fire hit, KO, snapshot tail).
  - Offline: dens49 157/157 (+25: bush parity, calm-only parity, pass-3 mid-round reject), traps49calm 73/0/1 skip, traps43 97/0, poison48 57/57, abil47 19/19, hearts47 31/31.
  - Trap suite variance: the calm/legacy trap suites start unseeded rounds, so their per-trap check counts vary run to run (e.g. a large rooftop/space centre trap sometimes fails placement in dens 3 as well).
  - LOCAL wrangler relay (stopped afterwards): net_mixed49 25/25 (A bush room identical incl. bushes, host hides -> vanishes on guest, throw -> reappears; F pass-3 guest -> dens 3 with no bushes; E pass-2; B and D v4.8; C v4.8 and pass-3 guests mid bush round rejected), net_poison48 10/10, net_match 26/0.
- Shots: out/v4.9/bush/
  - <arena>-{large,small}-{hider-view,opponent-view,opponent-view-attack-reveal}-915x412.png
  - trio-<arena>-<size>.png
  - layouts-{large,small}.png
- Patches and backups:
  - Patches: out/v4.9/v4.9-bush-only.patch, v4.9-bush-tools.patch.
  - Backups: src-pass3, tools-pass3, pass3.html.
- Limits:
  - Guests still receive hidden fighters' positions (only rendering hides them), so a modified client could cheat.
  - Bushes in the right-flank pocket on small maps sit under the touch buttons.
  - Not checked on a real phone, and no desktop bush shots.
  - Sounds are global, not positional, so throw and hit sounds still play.
### Fri Nov 6 ~17:35 PST: bush self-readability QA (local only; no push or version bump). Stealth values and enemy rules unchanged.
- Dark ghost cause: Material.clone() dropped the outline shell's thickness shader (onBeforeCompile), so each black outline became a full-size dark copy of the body. Fix: keep the shader. While hidden, the outline turns soft light (0xeef4ff at 0.75 alpha) and the body sits at 60% opacity (GHOST in stealth.js).
- Own ring hidden by foliage: while you (or a teammate) are hidden, the team ring and YOU ring draw over the bush (depthTest off).
- YOU label clipped: perspective pushes the tall label sideways near the screen edge. keepMarkOn nudges the own marker back inside 7-93% of the screen width, above the same fighter. This applies always, not just in bushes.
- Controls overlap: with touch controls on, foliage that projects under the bottom-left or bottom-right control corners is pressed flat (22% height; ground patch kept). Gameplay bush cells are unchanged.
- Tests: bush49 89/0 (+4: readable ghost materials, rings over foliage + marker, marker on-screen at the side wall, flattening under controls; enemy still fully hidden). dens49 157/157, poison48 57/57, abil47 19/19, hearts47 31/31, traps49calm 73/0/1 skip, traps43 91/0 (unseeded counts vary).
- Relay not re-run: render-only change, wire state unchanged.
- Shots: out/v4.9/bush-final/ (dojo and space: large and small phone 915x412, large desktop 1280x720, with trios).
- Found, not fixed: with Traps = Off (the tutorial too), Traps.fighterTick returns early and fighter.hopY is never set, which can give NaN model positions. It predates v4.9.
### Fri Nov 6 ~17:25 PST: hopY fix (local only; no push or version bump)
- Fix (src/game.js):
  - Fighter constructor sets `this.hopY = 0`.
  - The render now uses `(f.hopY || 0)`.
  - Trap jump physics is unchanged: traps.js still drives hopY while airborne. Guests still copy hopY from snapshots.
- Removed the bush49 test-only hopY workaround.
- New tools/hop49.mjs, 5/0. Checks: Traps Off seeded 4-fighter match (360 frames, every fighter matrix finite and visible, on the floor), the tutorial (same), traps-on jump pad (hopY peaks 1.5 and lands at 0, finite).
  - Against the old pass3.html the same test fails 3 checks (hopY undefined), confirming it catches the bug.
- Other suites: bush49 89/0, poison48 57/57, abil47 19/19, hearts47 31/31, dens49 157/157. Build ok.

### Fri Nov 6 18:10 PST: v4.9.0 release started (pt386u approval). Inspecting bb-pages.
- 19:02 PST resumed after interrupt; tests: core suites green, tut42 fixed(escape dir) 18/0 x3, net_poison48 10/10 rerun, net_mixed49 ghost expectation updated 0.45->0.6, net_ui/net_life/net_relay43 known WebRTC baselines (fail on v4.8 too)
- 19:08 net_mixed49 25/25, net_cd45 30/0 (rerun quiet), relay stopped
- 19:05 PST pushed bb-pages 38a4f90
- 19:06 PST pushed bb-pages 0139a3d
- 19:18 PST release v4.9.0 created with 4 assets, live site verified v4.9.0-20261106 (sha256 30a1f166...). DONE
### Fri Nov 06 21:45 PST: melee slash work started (pt388u). Baseline backup /workspace/out/v4.10/base (v4.9 published 0139a3d). LOCAL ONLY, no publish.
### Fri Nov 6 21:46 PST: checkpoint (melee + new weapon-shop scope, pt388u + t389u/t390u). LOCAL ONLY
- Backup: /workspace/out/v4.10/base (src, tools, docs, README, build.mjs, v49.html). No source edits yet.
- Melee design (chosen): params in one object (per-weapon later): arc ~100 deg, reach 1.3 u, wind-up 0.12 s, active 0.08 s, recovery 0.22 s, cd 0.42 s, 1 heart, once per target per swing, needs ammo>0 (held boomerang).
- Capability: dens 5 = melee (layout uses >=, so 5 builds like 4). roomDens base 5, clamp 5; v4.9 host clamps guests to 4 -> melee off; mixed rooms fall back to v4.9 behaviour. Mid-round lower-dens join -> existing reject:version.
- Net: guest input byte bits 64 (explicit melee) and 128 (contextual tap) are free; host edges like dash. Guest visuals via host event 'slash' in fxList.
- Controls: touch quick-tap = slash only if a visible foe is in reach+front cone and a boomerang is held, else old auto-aim throw; drag-release always throws. Keys: P1 G, P2 ?, SOLO B; pad LT(6).
- Weapon shop: pre-match loadout in the existing gold store, alternatives to boomerang, no real money; detailed brief pending.
- 21:53 PST melee core + weapons table + net plumbing done; tools/melee410.mjs 25/0. Next: Armory UI, touch tap test, net tests, screenshots.
- 21:58 PST Armory UI + touch tap/drag (touchmelee410 8/0) + stills done. Next: net tests vs published v4.9.
- 22:02 PST net_melee410 22/22 vs PUBLISHED v4.9.0 page (local relay). dens49 updated: 181/181 (adds dens5==dens4 map checks).
- 22:37 PST resumed; fin410 still running (net_cd45); killed stale net_ui/net_life helpers 203070 203077 203727
- 22:49 PST suite done: net_cd45 30/0 + bush49 89/0 on rerun (first net_cd45 crashed after stale-helper kill); relay stopped
- 22:50 PST DONE local: patch /workspace/out/v4.10/v4.10-melee-armory.patch, shots /workspace/out/v4.10/shots, build Whackerang.html BUILD v4.10-dev-20261106 (local only, no version bump/publish)
- 2026-11-06 v4.10-dev (local): Armory polish — 2/1/4-col responsive grid, px text floors, 44px Equip, ✓ Equipped tag, scroll kept on equip; armory410 9/0 x3, touchmelee410 rerun. Unpublished.
- 2026-11-06 v4.10-dev (local): touchmelee410 made deterministic (fixed-dt stepping, seeded RNG, frozen bot, explicit state, real CDP touches, warm-page gate, failure diagnostics). Causes: old 'hidden' case was not hidden (no bush; d 1.0 < detect 1.8) and raced a 5 ms pin; throw-instead-of-swing = touchend delayed >340 ms on a cold page (correct long-press). No game code change. 8/8 runs 11/0.
- 2026-11-07 v4.10-dev (local, unpublished): per-character weapons (8 heroes x 3 own weapons, patterns arc/poke/lunge/spin, homing/pierce/stun effects), per-slot per-character loadout + v4.10 migration, character-strip Armory, host validation by hero, per-owner wire code (no capability bump). loadout411 18/0, armory411 11/0 x3, touchmelee410 5x 11/0, melee410 46/0, bush49 89/0, dens49 181/181, net_melee410 25/25, net_mixed49 25/25 (local relay, stopped).
### Sat Nov 7 2026 PST: v4.10.0 release (pt392u approval), versionCode 54, build v4.10.0-20261107
- Scope: melee swing + per-character Armory (8 heroes x 3 exclusive weapons = 24), per-slot per-character saves with v4.10-dev/v4.9 migration, host-validated picks, per-owner wire weapon code (dens 5; v4.9 rooms fall back to boomerang-only, v4.9 mid-round join rejected).
- Release-build tests: loadout411 18/0, melee410 46/0, bush49 89/0, dens49 181/181, hop49 5/0, tut42 18/0, traps49calm 73/0 (1 skip), armory411 915x412 11/0, touchmelee410 3 fresh runs 11/0 each; local relay (stopped): net_melee410 25/25 (incl. published v4.9.0 fallback + mid-round reject), net_mixed49 25/25.
- Not run this release: net_ui / net_life / net_relay43 (known direct-WebRTC baseline failures on this box, also on v4.8), net_cd45, net_poison48, leak45, full fin suite. No real-phone or direct P2P testing. Balance first pass (stuns 0.3-0.35 s < every stunning weapon's swing cooldown; post-hit 1.4 s invulnerability -> no stun lock).
- APK/AAB signed with the existing key (cert SHA-256 6e59e14a...ab35d8de, same as v4.9.0).
- 08:23 PST: pushed bb-pages fe21de6, Pages run 42390925683 success, live index sha256 7df0a056... v4.10.0-20261107, release v4.10.0 with 4 assets (all 200, hashes match). DONE
- 2026-11-07 local (unpublished): t393u online menu touch fix, t394u phone camera +15% + fullscreen on Play, t395u control labels. net_pause412 16/16 (before 8/16), controls412 9/0 x2.
- t395u fix 2026-11-07 09:50: labels moved to #tlabs overlay (SHIELD/DASH/SPECIAL/DRAG: THROW/TAP NEAR: MELEE, 12px, opacity 1, charcoal pill); controls412 10/0 x2, touchmelee 11/0, net_pause412 16/16; calm frozen shots calm-{before,after}-*.png
- Sat Nov 07 10:42 PST v4.10.1/code55 release (pt396u): mobile412 fix set only. Tests on release build: controls412 10/0 x2, touchmelee 11/0 x3, melee 46/0, loadout 18/0, bush 89/0, armory 11/0, tut 18/0, net_pause412 16/16, net_melee 25/25, left-handed labels on-screen/no-overlap at 1024/915/740. Fullscreen real-Android unverified.
