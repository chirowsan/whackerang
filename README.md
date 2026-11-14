# Whackerang

An original party brawler: throw a curving boomerang, catch it when it comes back, knock out your rivals in one hit, and be the last fighter standing. 1 human + 1–3 bots, or 2-player local on desktop. Mobile-first touch controls (landscape), runs fully offline as a single HTML file.

**Play:** https://chirowsan.github.io/whackerang/

**Install on phone:** Android: open the link in Chrome > Install app (or download the APK from the GitHub Releases page). iPhone/iPad: open in Safari > Share > Add to Home Screen. Details and native builds: [`mobile/README.md`](mobile/README.md).

## Controls
| | Move | Throw | Dash (i-frames) | Deflect |
|---|---|---|---|---|
| Touch | left stick | throw stick: drag aim, release throw (tap = auto-aim); **Melee** button | ▶▶ Dash | Shield |
| Keyboard P1 | WASD | mouse aim + click, or F | Space | E / right-click |
| Keyboard P2 | arrows | Enter | Right Shift | / |
| Gamepad | left stick | right stick aim + release (RT/R1) | A | X / B / LB |

## What's new in v4.10.9 (iPhone Back on Play online)
- **Leave Play online on iPhone:** the Back button on the Play online screens is larger and sits clear of the notch and Safari's bar. It works while searching, connecting, entering a room code, or after an error, and it cancels any connection in progress. The phone's back gesture and Escape also return you to the main menu. Default Game speed is still Chill.

## What's new in v4.10.8 (shorter, steadier throws)
- **Shorter, steadier throws:** a full-charge boomerang now turns around about a third of the way across the arena instead of flying past the far wall. The path is the same every time you aim the same way; holding longer makes the shot faster, not much farther. Default Game speed is still Chill.

## What's new in v4.10.7 (lighter, snappier movement)
- **Lighter movement:** you get up to speed and stop almost immediately, and a reverse no longer coasts. Walking while you aim a throw stays close to full speed. The left stick responds sooner at a mid push. Default Game speed is still Chill.

## What's new in v4.10.6 (clearer aim guide + hide browser bar)
- **Clearer aim guide:** while you drag the throw stick you see a short, soft highlight with two small marks that hint the curve — not a full path, not faint dots, and not a big bright arrow. It only shows while you aim and disappears when you let go.
- **Hide the browser bar:** a fullscreen button sits next to Pause. On Android Chrome and desktop it hides the browser chrome; on iPhone it tells you how to Add to Home Screen for full-screen play. Aim accuracy is unchanged from v4.10.4.

## What's new in v4.10.5 (quieter aim guide)
- **Less intrusive aim guide:** while you drag the throw stick you only see a short, faint curved hint (about a third of the outbound path) — no full out-and-back dotted route. It fades in briefly and vanishes the instant you release; quick taps show nothing.
- **Aim accuracy unchanged:** throws still go where you aim (soft assist, forward-only tap auto-aim). Flight trail is a touch thinner so it clutters less.

## What's new in v4.10.4 (clearer boomerang aim)
- **Throws go where you aim:** on phones, aim assist only gently nudges toward a rival who is already near your aim line (about ±12°), and never swaps the throw toward someone off to the side. A quick tap still auto-aims, but only at rivals in front of you.
- **Curved path preview:** while you hold the throw stick, the dots show the real out-and-back curve your boomerang will take (same flight as the throw), not a straight line. A faint trail follows it in flight.
- **Predictable weapons:** each character's weapons keep their feel, with extreme curves slightly clamped so paths stay readable. Shield bounces and parries no longer add random spin.

## What's new in v4.10.3 (dedicated Melee button)
- **Dedicated Melee button on phones:** a new Melee control sits next to Dash; the throw stick is throw-only (drag to aim, release to throw; a quick tap is an auto-aim throw). Desktop keyboard/gamepad and online melee rules are unchanged.
- **Teach-once labels:** SHIELD / DASH / SPECIAL / MELEE / THROW fade after a few uses or after your first match (saved on the device). The buttons themselves always stay.
- **Clearer throw icon:** the throw stick shows the original boomerang icon (it no longer looks like a magnifying glass when Bao's Iron Wok is equipped).
- **Maps unchanged:** arena floors, props, bushes and traps match v4.10.2 exactly.

## What's new in v4.10.2 (iPhone / phone fixes)
- **Online menu on iPhone:** tapping the Pause button in an online match now keeps the menu open (Safari's follow-up tap no longer closed it straight away), so Back, Fullscreen and Leave can be reached.
- **Whole arena on phones:** in landscape on phone-sized screens the camera now fits the whole arena (or nearly) to the screen, both in the countdown and during play. Fighters keep a minimum size, so on Huge maps the camera still follows you. Portrait, tablets and desktop are unchanged.
- **Hosting after switching apps:** if a host's connection to the room service drops (for example after switching away to share the room code), the host now re-registers the same room code when it comes back, so friends can still join. This targets reports that an iPhone-hosted room could not be joined from Android; the exact cause is not confirmed on real phones yet.
- **Known limits:** tested in the WebKit engine and Chrome with phone-sized screens and real touch events, and over a local relay; not yet verified on real iPhones/Android phones or over direct peer-to-peer. iPhone Safari keeps its own toolbars; Add to Home Screen gives full-screen play.

## What's new in v4.10.1 (phone fixes)
- **Online menu on phones:** the in-match online menu (Pause button) now reacts to taps; the touch controls no longer sit on top of it. Online matches keep running while the menu is open (they never pause).
- **Wider phone camera:** on phone-sized landscape screens the close camera shows about 15% more of the arena. Tablets and desktop are unchanged.
- **Fullscreen on start:** on browsers that support it, pressing Play / START on a touch device asks for fullscreen. If you leave fullscreen it is not forced back. Not yet verified on a real Android phone.
- **Clearer touch labels:** high-contrast labels SHIELD, DASH, SPECIAL, and on the throw stick DRAG: THROW and TAP NEAR: MELEE. Labels never block touches; controls behave exactly as before.

## What's new in v4.10 (melee + character weapons)
- **Every fighter has their own 3 weapons (24 in all, none shared):** e.g. Bao's Iron Wok / Cleaver / Rolling Pin, Nori's Shuriken / Kama / Tanto, Gus's Dumbbell / Title Belt / Kettlebell. They differ in swing pattern (Sweep, Thrust, Lunge, Spin 360), reach, speed and recovery, and some throws home in, pierce or briefly stun. Every hit is still one heart. All weapons are free.
- **Melee swing:** tap the throw stick next to a visible rival to swing (drag + release always throws). Keys: G (P1), B (solo), Comma / Numpad 2 (P2), gamepad LT. Hidden rivals in bushes are not auto-targeted unless you are close enough to discover them.
- **Armory:** pick a character from the strip; only that character's weapons are shown. The choice is saved per character and per player (P1 / P2); old saves carry the previous pick over to the selected character.
- **Online:** rooms where everyone runs v4.10 get melee + character weapons (the host checks every pick). A room with an older v4.9 player plays the v4.9 boomerang-only rules; a v4.9 player cannot join a melee round already running.
- **Known limits:** balance is a first pass; not yet verified on a real phone or over direct peer-to-peer (tested in desktop browsers over a local relay).

## What's new in v4.9 (calmer maps, bushes)
- **Calmer, clearer maps.** Fewer walls and crates, and fewer traps: by default 2 / 3 / 4 hazards on Small / Large / Huge. Lethal traps stay dormant for the first seconds of a round. Each arena has a themed floor, shadows and switches are easier to read, and hit effects are quieter.
- **Bushes for hiding and surprise attacks.** Step into a bush and rivals lose sight of you, while you and your teammates see you faded. You show up again for **1.5 s** after you throw, parry, use your ULT or get hit, and anyone within **1.8 units** of you can spot you. Bushes under the touch controls are drawn flat so they never cover the buttons. Boomerang Ball has no bushes.
- **Online:** a room uses the new layout and bushes only when every player runs v4.9. A room with an older client falls back to the older layout with no bushes. Bush hiding only changes what the game draws: positions are still sent over the network, so this is not anti-cheat and a modified client could see hidden players.
- **Fix:** turning Traps Off (and the tutorial) no longer breaks the hop animation.

## What's new in v4.8 (shrinking poison zone)
- **At the 2:00 mark the poison closes in.** In Classic, Team, Crumble, Bomb tag and King of the Hill, purple poison starts at the rim of the arena and slowly creeps toward the middle, so a round can't stall forever.
  - **Warning:** 10 s before, a "☣ POISON IN 10s" banner appears, a warning sound plays with beeps at 3-2-1, and the rim glows green. The HUD timer counts down (during sudden death it shows ☠ ☣m:ss).
  - **The zone:** purple haze covers the poisoned band and a bright green line marks the edge. On Large and Huge the minimap shades the poison and outlines the safe area. A green vignette shows when you are standing in it.
  - **Shrinking:** the safe rectangle shrinks evenly over 75 s to a small final zone in the middle (20% of the arena, at least 5×4 tiles) and then holds that size.
  - **Damage:** standing in poison costs one heart every 2 s ("☣ ♥ N LEFT"). The normal blinking invulnerability applies, and each hero's hearts and abilities count (Nine Lives saves Salty once, and Gus lasts about 10 s). Stepping back into the safe zone lets your poison meter recover. A KO in the poison counts as "☣ POISONED!".
  - **Bots** take the shortest walkable route, around walls, holes and lava, to the safe zone, and avoid the poisoned edge.
  - **Spawns, respawns and edge rescues** always land inside the safe zone. In King of the Hill the hill moves to the middle when the poison starts.
  - **Where it's off:** the tutorial, boss stages, Boss rush, Survival waves, Capture the flag, Ball and Coins.
  - **Online:** it is host-authoritative. The host's tuning travels with the round rules, the zone is computed from the synced match clock, and only the host applies poison damage. Guests just render it.
- **Tuning:** every number lives in one object, `POISON` in `src/poison.js`: `startAt` 120 s, `warn` 10 s, `shrink` 75 s, `minFrac` 0.2, `minHX` 2.5, `minHZ` 2.0, `tick` 2.0 s, `botMargin` 1.0, `spawnMargin` 0.7. Times are in game time, the clock the HUD shows. At the default Chill speed that runs slower than wall time.

## What's new in v4.7 (hero health + abilities, bigger map, no more falling through the floor)
- **Every hero has their own health and a unique ability** (shown on the hero cards, in the hero details and in the HUD). This replaces the flat 3 hits:
  - **Bao** 4♥, *Comfort Food*: gets 1 heart back after 8 s without being hit.
  - **Nori** 2♥, *Smoke Dodge*: dashes make him untouchable for 0.45 s (others get 0.22 s).
  - **Bolt** 3♥, *Static Throw*: a fully charged throw also stuns whoever it hits for 0.6 s.
  - **Salty** 3♥, *Nine Lives*: once per round, a knockout leaves him on 1 heart instead.
  - **Pico** 3♥, *Long Tongue*: grabs power-ups from 2.5× farther away.
  - **Yuki** 3♥, *Frostbite*: her hits chill rivals to half speed for 1.5 s.
  - **Gus** 5♥, *Heavyweight*: the tankiest hero. He takes half knockback but walks 8% slower.
  - **Wisp** 2♥, *Hover*: floats over a hole for 1 s before dropping.

  A hit, a bomb, lava, spikes or a fall costs one heart and gives about 1.4 s of blinking invulnerability. You are knocked out when the last heart is gone, and hearts refill on respawn. It works the same online, because the host is authoritative and every guest sees each hero's hearts. Bosses keep their own HP, wave minions have 1 heart, and the tutorial stays at 1 heart.
- **Default map size is Large** (the middle of Small / Large / Huge). Saves whose size was never picked by the player switch to Large once. Tapping Map size remembers your choice. The online lobby also defaults to Large.
- **Safety net, no fall-through deaths:** movement is sub-stepped, so fast dashes, knockback and bumpers can't tunnel through walls. A rim assist eases you back when only part of your body is over a drop. Falling, or landing on lava, with hearts left costs one heart and puts you on the nearest safe floor. If you fall while invulnerable, you are put back for free. A guard puts any fighter that ends up off the map, NaN or inside a wall back on floor. Spawns, respawns and enemy spawns are always on solid floor. Portals wait instead of sending you onto a hole. The KO spin-out no longer sinks through the floor. A trapdoor that closes is floor again for online guests. See docs/FALLING.md.

## What's new in v4.6 (Auto match)
- **Auto match** (big gold button above Create room / Join room in the Online menu): tap it and the game pairs you with other players who are searching at the same time (per mode). A full room (4) starts at once; with 2+ players it starts about 25 s after the second joins. If nobody comes, bots fill the empty seats after at most 2 minutes. You see a search screen with the time, "Players found n/4", a Cancel button and "Play vs bots now". If the matchmaker can't be reached you get a clear message and can play against bots right away.
- Privacy: strangers only see a preset name (no custom name, no chat); the matchmaker only sees a random anonymous id while you search and keeps nothing afterwards; Settings has an "Auto match" switch. See `docs/MATCHMAKING.md`.

## What's new in v4.5.1 (memory fix)
- Fixed a GPU memory leak: every round/restart/rematch left the previous arena's geometry and textures allocated (about +60 geometries and +6 textures per round), so long sessions slowly got heavier. They are now released when a round ends. Min build, per round: geometries +41..81 -> ~0, textures +6..7 -> ~0 (details in docs/PROGRESS-v45.md). No gameplay or look change.

## What's new in v4.5 (3-2-1-GO countdown)
Every round now starts with a big **3-2-1-GO** (3 s real time, independent of Game Speed): numbers pop in with a beep, a higher chime and a stronger buzz on GO. Nobody can move, throw or use traps, no clock or hazard has started and nobody can be hurt until GO. Works for every mode, offline vs bots, restart/rematch and online (the host's start time is shared; guests end with the host within a fraction of a second). Training uses a short version. Details and tests: `docs/COUNTDOWN.md`.

## What's new in v4.4 (falling is clear and forgiving)
- **Every drop looks the same on every arena:** dark hazy abyss (no more floor-coloured "holes"), a glowing **cyan rim** on every ledge, cracking tiles that blink dark/cyan. Cyan edge = drop.
- **Edge help (Settings, on by default):** screen-edge glow + `EDGE` chip, a tick and a buzz as you near a drop, a wobble when you stand on nothing, **0.25 s ledge grace**, and your **first fall each match is forgiven once** (put back on safe floor, short stun and shield). After that falling is real. Off = old behaviour.
- Legend + How to play have a Drops section; details in `docs/FALLING.md`.

## What's new in v4.3 (online works on strict networks, friendlier traps)
- **Relay fallback for online play:** the game tries a direct phone-to-phone link for ~5.5 s, then automatically connects through a free Cloudflare Worker relay with the same room code (no extra steps). A small `DIRECT` / `RELAY` tag shows which one you are on; relayed rooms use a low-bandwidth mode. See `docs/MULTIPLAYER.md` and `docs/CLOUDFLARE.md` (resources, limits, free-plan estimate, how to delete or turn it off).
- **Traps are fair now:** the six **lethal** traps (spike pit, saw, laser grid, trapdoor, fire jet, spike ceiling) are dormant (dim, no red glow) until a player wakes them: step on a pressure plate, hit a switch, or hit the trap with a boomerang. They show a ~0.5 s warning, fire once, then go dormant again. They never run on timers. Bots wake them on purpose when it helps them.
- **Non-lethal traps** (orange/yellow stripes with a round icon, never red): swing hammer (shove + 0.5 s stun), static fence (dizzy: reversed aim + slow), rolling boulder (knock aside + dizzy), sticky goo (slow), ice (slide), bumper, jump pad, teleport pad.

## What's new in v4.2 (full-screen play, 40-second tutorial, nicer arenas)
- **The arena fills the screen:** on phone landscape the floor now covers ~87-100% of the viewport (was ~11-41%). The camera is tighter and follows you, the HUD is a thin strip, and the touch controls are smaller, semi-transparent (brighter when touched), tucked into the bottom corners. Off-screen rivals still get edge arrows. Settings > Camera > Wide restores the old zoomed-out view.
- **Hands-on tutorial (first run, 30-45 s):** MOVE, THROW, CATCH, DODGE (a real spike pit with a red warning), done. 1-3 words per step, a ghost thumb shows the gesture, each step advances only when you really do it, Skip is always visible. Replay it from How to play.
- **Graphics:** baked ambient occlusion on the floor (soft contact shadows around crates/walls, zero extra draw calls), tile variation on every arena, crates with lids/grooves/studs, stronger rim light, impact stars on hits and deflects, crisper HUD type. Sharp tier stays shadow-free; draw calls and render CPU are lower than v4.1.
- Tests: tools/layout42.mjs (arena coverage >= 85% at 915x412, 740x340, 640x320), tools/tut42.mjs (18 tutorial checks).
- Android versionCode 42 / versionName 4.2.0 (same signing key).

## What's new in v4.1 (easier online, clearer traps)
- **Online in two taps:** Play online shows just *Create room* and *Join room*. Create goes straight to a lobby with a huge 4-letter code, **Share** (native share sheet, or copy link) and **Start**. Defaults: Classic, Chill, Medium bots fill empty slots, heroes auto-picked, guests auto-ready. Mode, arena, speed, hero and emotes live behind a small **Options** button. Join shows four big boxes, opens the keyboard, and joins by itself on the 4th letter (clear error if the room isn't found). `?room=CODE` links still auto-join; old 5-letter codes still work.
- **Traps you can read at a glance:** every harmful trap now shares one look: red/orange stripes, a skull/spikes/flame badge, a ground decal, and a blinking warning before it fires. Teleporters are upright blue/violet swirling portals with a number (1/2) and are never red or striped. Jump pads are green/yellow with chevrons. A small legend is at the top of How to play.
- Android versionCode 41 / versionName 4.1.0 (same signing key).

## What's new in v4.0 (online play with friends)
- **Play online (2-4 players):** main menu > Play online > *Create room* (you get a 5-letter code and a share link `...?room=CODE`) or *Join with code*. Friends who open the link join automatically. No account, no chat, no voice, no public matchmaking.
- **Lobby:** player list with ping bars, hero pick, ready-up, host picks mode / arena / speed / rounds, bots fill empty slots, quick emotes (6 presets). Modes online: Classic, Team, Capture the Flag, Coin Rush, Boomerang Ball, King of the Hill, Bomb Tag, Crumble. Rematch and back-to-lobby after a match.
- **Under the hood:** peer-to-peer WebRTC, host-authoritative (guests send inputs, the host runs the only simulation, guests interpolate and predict their own fighter). Free signaling (PeerJS public broker) + public STUN; copy/paste connection codes as a no-server fallback. Details, limits and test results: `docs/MULTIPLAYER.md`. Optional self-hosted relay: `server/relay/`.
- Disconnects: a guest who drops is replaced by a bot (and gets control back if they rejoin); if the host leaves, everyone gets a clear message. Online wins earn normal coins/XP with a per-match and per-day cap. The gold shop stays in TEST MODE.
- Android versionCode 40 / versionName 4.0.0 (same signing key, updates v3.3 in place). Adds the normal `ACCESS_NETWORK_STATE` permission (no prompt).

## What's new in v3.3 (bigger, louder, cuter)
Chill stays the default speed, payments stay TEST MODE, nothing was removed.
- **Closer camera:** fighters read about 30% bigger on a phone. The camera now follows you on every map size (small maps included) and fighters are drawn slightly larger. Settings > **Camera**: Close (default) or Wide (the v3.2 full-arena view). Edge arrows now also point to rivals hidden behind the touch controls.
- **Two new fighters** (earn the gold, no pay-to-win): **Gus** the Hippo Wrestler (500 gold, heavy thrower, ult *Belly Flop*) and **Wisp** the Ghost Apprentice (650 gold, floaty and quick, ult *Spirit Pull*). Distinct silhouettes (a big-bellied hippo in trunks with a champion belt and a floating sheet-ghost with a flame wisp), their own faces and expressions.
- **Animation:** per-character victory dances for all 8 fighters (spin, backflip, robot dance, jig, levitate, flipper flap, belly stomp, ghost twirl), a body twist on throws, a stronger hit flinch.
- **Sound pass:** all 57 effects and 13 music tracks are loudness-matched by a script (`tools/v33audio.mjs`: offline render, short-term RMS per class, peak limit, soft limiter on the effects bus), softer background loop that ducks under big hits, Settings > **Background music** toggle + **Master** / Music / Sound FX volumes.
- **Menu fit:** the main menu and the daily-missions card fit short phones (640x320).
- Android versionCode 33 / versionName 3.3.0 (same signing key, updates v3.2 in place).

## What's new in v3.2 (polish & play)
A "game feel" release. Chill stays the default speed, payments stay TEST MODE, nothing was removed.
- **Juice:** harder-hitting impacts (flash, sparks, rings, hit-stop), camera shake with a Settings control (Off / Low / Full), slow-mo plus a zoom-in on the last KO, fireworks and a victory line for the winner, a red screen flash and buzz when *you* get hit, new throw / catch / hit / hurt / KO / fanfare sounds (WebAudio synth, mute still works), catch combos, longer glowing boomerang trails.
- **Readability:** a floating YOU / P1 / P2 arrow over your fighter, a ring on the floor under every boomerang in its owner's colour, bigger and clamped score pops, active power-up chips with timers under your name, no overlap with the touch controls on small landscape phones.
- **Power-ups:** new **Magnet** (pulls pick-ups, bigger catch circle, boomerang homes in) and **Time Bubble** (rivals and their boomerangs near you move slower). Both are tuned for Chill.
- **Cosmetics:** 5 new hats (cat ears, propeller cap, cowboy, wizard, viking), 4 new trails (bubbles, pixels, stardust, hearts) + premium Prism, 4 new boomerang skins + premium Void. The Shop has a live 3D preview and several items are free level rewards. Fighters flinch when hit and dance when you use an emote.
- **Progression:** Daily Missions (3 a day with gold + XP) on the main menu and in Profile, a Daily Chest when all 3 are done, an animated results screen (XP bar, gold count-up, mission progress) and a one-tap Play Again.
- **Quick start:** Play jumps straight into a Classic match (Chill, Medium bots). First time? A skippable 45-second training with highlighted controls. About 9 s from tap to playing on a first launch.
- Android versionCode 32 / versionName 3.2.0 (same signing key, updates v3.1 in place).

## What's new in v3.1 (calmer, easier to play)
Feedback from a phone player: "fun, but the controls are too hard and it is way too fast." v3.1 is a comfort release:
- **Game Speed setting: Chill / Normal / Fast** (Settings, match setup, campaign stage screen). **Default = Chill** for everyone, including existing saves (migrated once). Chill runs the whole simulation at 62% speed (about 38% slower): walking, dash, boomerang flight and return, bots, trap cycles and warnings, power-up timers and the round clock. Normal = 80%. Fast = the exact v3.0 pace. It is one global time scale, so every mode, arena, trap and campaign stage follows it.
- **Gentler touch stick:** small dead zone, soft response curve (a light push walks slowly, full speed only near the rim) and smoothing (about 0.1 s to reach full speed instead of snapping). Toggle "Smooth touch stick" in Settings.
- **Bigger, more forgiving throw pad:** larger boomerang pad and dash button; a quick tap is auto-aim at the nearest rival (more tolerant of finger wobble). **Aim assist** now snaps drags within about +/-34 degrees to a rival on touch (was +/-13) and can be turned off in Settings.
- **Easier catches:** larger catch radius and a gentle glide-in/stronger homing on the return (Chill +35%, Normal +18%).
- **Dash cooldown clarity:** the dash and deflect buttons show the remaining seconds.
- **Bots:** skill is Easy / Medium / Hard (Medium is the default and is softer than v3.0's "Normal": slower reactions, less accurate, throws less often).
- **Camera:** on Large/Huge maps the follow camera zooms out a little on Chill/Normal and eases more slowly, so scrolling feels slower too.
- Updated How-to-play. Android versionCode 31 / versionName 3.1.0.

## What's new in v3.0 (renamed from "Boomerang Brawl")
- **New name and icon:** Whackerang. The Android/iOS app id is now `com.chirow.whackerang`. Note: installs of the old `com.chirow.boomerangbrawl` app are a *separate app* with their own saves; the web version migrates the old browser save automatically.
- **Bigger maps:** Small 20x12, Large 26x16, Huge 32x20, chosen in match setup. A follow camera (zoom is clamped so phones stay readable), a minimap and edge arrows for off-screen rivals/objectives.
- **15 trap types** with warning lights and sounds: spike pits, saws on rails, swing hammers, laser grids, trapdoors, teleport pads, jump pads, bumpers, sticky goo, fire jets, electric fences, rolling boulders, spike ceilings, ice patches, plus switches that you fire with a boomerang to turn traps against rivals. Setting: Off / Some / Wild. Every arena has its own trap set.
- **4 new arenas:** Volcano Forge, Pirate Cove, Space Station, Haunted Manor (8 in total).
- **New modes:** Capture the Flag, Coin Rush, Boomerang Ball (stun-only football), Crumbling Floor, Boss Rush co-op (3 bosses). Plus **daily twists**: Low Gravity, Giant Boomerangs, Rubber Walls.
- **Gold Store (TEST MODE):** an *Earn free* tab (what you can still earn today) and a *Buy gold* tab behind a parental-gate placeholder. Purchases are mocked and say TEST MODE; no real money. Daily login streak and bonus placeholder. See `docs/ECONOMY.md`.
- **Payments groundwork:** purchase-provider abstraction (`src/purchase.js`) with Mock + documented Google Play / Stripe stubs, a local-only server prototype (`server/`, not deployed) with a tamper-evident gold ledger, and plain-language launch docs in `docs/`.

## Core features
- **Modes:** Classic Rounds (1-3 bots or 2P local), Team 2v2, Survival, King of the Hill, Bomb Tag, Capture the Flag, Coin Rush, Boomerang Ball, Crumbling Floor, Boss Rush, and a 12-stage Campaign with 3 bosses.
- **Boomerang types:** Classic, Razor (pierces), Frost (freezes), Chain (jumps to a second rival), Blast (explodes), Phantom (passes through walls). Every type is earnable for free by levelling up; gold only speeds it up.
- **Ultimates, parry, dash i-frames, charge throw, power-ups, pushable/destructible crates**, 6 fighters, bots with personalities (Defender, Trickster, Sniper, Aggressor, Collector, Duelist, bosses).
- **Progression:** XP/levels, seeded daily challenges, achievements, campaign stars, gold shop (cosmetics, premium cosmetics, fighters). All stored on the device. **No pay-to-win.**
- **Quick-chat emotes**, 6-step tutorial, mute/volume.
- **Phone friendly:** Sharp / Balanced / Fast graphics tiers; static scenery is merged into few draw calls; adaptive resolution is a last resort.

## Docs
`docs/ECONOMY.md` (earn rates, packs) · `docs/PAYMENTS.md` · `docs/LEDGER-SPEC.md` · `docs/LAUNCH-CHECKLIST.md` (trademark, Play, Apple, COPPA, tax) · `docs/FALLING.md` · `docs/MULTIPLAYER.md` · `docs/MATCHMAKING.md` · `docs/CLOUDFLARE.md` · `docs/PRIVACY-POLICY-DRAFT.md` · `docs/TERMS-DRAFT.md` · `server/README.md`.

## Mobile / PWA
- Installable PWA (`pwa/`): manifest (standalone, landscape, maskable icons, screenshots), versioned offline service worker (`whk-<build>` cache, auto-update), iOS meta + splash images, safe-area insets, pull-to-refresh/zoom/long-press blocked, screen wake lock, landscape lock + fullscreen on first tap, in-game Install button (Android `beforeinstallprompt`) and an iOS Add-to-Home-Screen hint, iOS audio unlock.
- Native: Capacitor 6 wrapper in `mobile/` (Android APK built; iOS Xcode project prepared, not built).
- `node build.mjs --min --dist` -> `dist/` (deployable PWA), `--app` -> `mobile/www/`.

## Build
```
npm i            # esbuild only; three r160 is vendored
BUILD=v3.0 node build.mjs --min   # -> Whackerang.html (single file)
```
Source in `src/` (game.js sim, rules.js modes, events.js arena events, modes.js campaign, ai.js bots, scenery.js, arena.js, models.js, gfx.js, fx.js, audio.js, input.js, ui.js + ui2.js, progress.js, main.js). Headless Puppeteer test scripts live in `tools/`.
