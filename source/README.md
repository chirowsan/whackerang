# Boomerang Brawl

An original party brawler: throw a curving boomerang, catch it when it comes back, knock out your rivals in one hit, and be the last fighter standing. 1 human + 1–3 bots, or 2-player local on desktop. Mobile-first touch controls (landscape), runs fully offline as a single HTML file.

**Play:** https://chirowsan.github.io/boomerang-brawl/

**Install on phone:** Android: open the link in Chrome > Install app (or download the APK from the GitHub Releases page). iPhone/iPad: open in Safari > Share > Add to Home Screen. Details and native builds: [`mobile/README.md`](mobile/README.md).

## Controls
| | Move | Throw | Dash (i-frames) | Deflect |
|---|---|---|---|---|
| Touch | left stick | right side: drag to aim, release to throw (hold = charge); quick tap = auto-aim | ▶▶ button | shield button |
| Keyboard P1 | WASD | mouse aim + click, or F | Space | E / right-click |
| Keyboard P2 | arrows | Enter | Right Shift | / |
| Gamepad | left stick | right stick aim + release (RT/R1) | A | X / B / LB |

## Features (v2.0)
- **Modes:** Classic Rounds (1-3 bots or 2P local), Team 2v2, Survival (endless waves, 3 lives, elites), King of the Hill, Bomb Tag (hot potato with a fuse), and a 12-stage Campaign with 3 bosses and 1-3 star ratings.
- **Boomerang types:** Classic, Razor (pierces), Frost (freezes), Chain (jumps to a second rival), Blast (explodes), Phantom (passes through walls). Unlock in the Shop, pick in the pre-match loadout; a rune power-up gives a random type in-match.
- **Ultimates:** every fighter has a charging ult meter (Bao ring of boomerangs, Nori shadow step, Tako overcharge, Kuma volley, Pico bubble, Yuki blizzard).
- **Arena events:** meteors, wind gusts, bumpers (Off / Some / Wild).
- **Bots with personalities:** Defender, Trickster, Sniper, Aggressor, Collector, Duelist and boss brains.
- **Progression:** XP and levels with unlocks, seeded daily challenges, coin shop (boomerang types and skins, trails, hats, emotes, fighters), achievements, campaign stars. All stored locally.
- **Quick-chat emotes** (4 slots, keys 1-4 or the chat button), first-run tutorial (6 steps), mute and volume controls.
- **Art:** per-arena dressing (lanterns, trees, torii, neon signs, skyline, temple, river, igloo, aurora), baked-look patterned floors with light pools, rim lighting on fighters, soft contact shadows, ribbon boomerang trails, shockwave rings, screen flash, camera punch, hit-stop, KO confetti, animated 3D hero showcase on the main menu.
- **Phone friendly:** Sharp / Balanced / Fast graphics tiers; static scenery is merged into few draw calls; no heavy post on Sharp/Fast; adaptive resolution is a last resort.
- 4 arenas with hazards (spikes, conveyors, lava, ice), 6 fighters, power-ups (extra, triple, giant, blast, homing, shield, speed, rune), charge throw, dash i-frames, parry, pushable and destructible crates.

## Mobile / PWA
- Installable PWA (`pwa/`): manifest (standalone, landscape, maskable icons, screenshots), versioned offline service worker (`bb-<build>` cache, auto-update), iOS meta + splash images, safe-area insets, pull-to-refresh/zoom/long-press blocked, screen wake lock, landscape lock + fullscreen on first tap, in-game Install button (Android `beforeinstallprompt`) and an iOS Add-to-Home-Screen hint, iOS audio unlock.
- Native: Capacitor 6 wrapper in `mobile/` (Android APK built; iOS Xcode project prepared, not built).
- `node build.mjs --min --dist` -> `dist/` (deployable PWA), `--app` -> `mobile/www/`.

## Build
```
npm i            # esbuild only; three r160 is vendored
BUILD=v2.0 node build.mjs --min   # -> BoomerangBrawl.html (single file)
```
Source in `src/` (game.js sim, rules.js modes, events.js arena events, modes.js campaign, ai.js bots, scenery.js, arena.js, models.js, gfx.js, fx.js, audio.js, input.js, ui.js + ui2.js, progress.js, main.js). Headless Puppeteer test scripts live in `tools/`.
