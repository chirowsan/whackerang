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

## Features
- 4 arenas with their own hazards: Dojo Garden (pop-up spikes), Neon Rooftop (conveyor belts), Jungle Ruins (lava), Ice Dock (slippery floor + cracking tiles). Random option; sudden-death crumbling after 48 s.
- 6 fighters (Bao, Nori, Tako, Kuma + unlockable Pico, Yuki) with small perks; 7 unlockable hats; coins earned from rounds/matches.
- Curved boomerang that bounces off walls/crates/pillars and homes back to the thrower; catch to reload. Charge throw, dash/roll with invulnerability, timed deflect/parry, pushable + destructible crates.
- Power-ups: extra boomerang, triple throw, giant, blast (explosive), homing, shield, speed.
- Bots on Easy / Normal / Hard: read boomerang paths, dodge, dash, deflect, aim with error, avoid hazards.
- Best-of-N rounds (first to 1/2/3/5), score screen with crowns, match results.
- Juice: screen shake, hit-stop, slow-mo on last KO, KO spin-outs, particles, announcer text, procedural WebAudio SFX + music per arena.
- Mobile: fits visualViewport (no 100vh), Low/Auto quality default on phones with adaptive resolution, no post-processing on Low, fullscreen button, left-handed layout, control size.

## Mobile / PWA
- Installable PWA (`pwa/`): manifest (standalone, landscape, maskable icons, screenshots), versioned offline service worker (`bb-<build>` cache, auto-update), iOS meta + splash images, safe-area insets, pull-to-refresh/zoom/long-press blocked, screen wake lock, landscape lock + fullscreen on first tap, in-game Install button (Android `beforeinstallprompt`) and an iOS Add-to-Home-Screen hint, iOS audio unlock.
- Native: Capacitor 6 wrapper in `mobile/` (Android APK built; iOS Xcode project prepared, not built).
- `node build.mjs --min --dist` -> `dist/` (deployable PWA), `--app` -> `mobile/www/`.

## Build
```
npm i            # esbuild only; three r160 is vendored
BUILD=v1.0 node build.mjs --min   # -> BoomerangBrawl.html (single file)
```
Source in `src/` (game.js sim, ai.js bots, arena.js, models.js, gfx.js, fx.js, audio.js, input.js, ui.js, main.js). Headless Puppeteer test scripts live in `tools/`.
