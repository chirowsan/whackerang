# Whackerang

An original party brawler: throw a curving boomerang, catch it when it comes back, knock out your rivals in one hit, and be the last fighter standing. 1 human + 1–3 bots, or 2-player local on desktop. Mobile-first touch controls (landscape), runs fully offline as a single HTML file.

**Play:** https://chirowsan.github.io/whackerang/

**Install on phone:** Android: open the link in Chrome > Install app (or download the APK from the GitHub Releases page). iPhone/iPad: open in Safari > Share > Add to Home Screen. Details and native builds: [`mobile/README.md`](mobile/README.md).

## Controls
| | Move | Throw | Dash (i-frames) | Deflect |
|---|---|---|---|---|
| Touch | left stick | right side: drag to aim, release to throw (hold = charge); quick tap = auto-aim | ▶▶ button | shield button |
| Keyboard P1 | WASD | mouse aim + click, or F | Space | E / right-click |
| Keyboard P2 | arrows | Enter | Right Shift | / |
| Gamepad | left stick | right stick aim + release (RT/R1) | A | X / B / LB |

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
`docs/ECONOMY.md` (earn rates, packs) · `docs/PAYMENTS.md` · `docs/LEDGER-SPEC.md` · `docs/LAUNCH-CHECKLIST.md` (trademark, Play, Apple, COPPA, tax) · `docs/PRIVACY-POLICY-DRAFT.md` · `docs/TERMS-DRAFT.md` · `server/README.md`.

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
