# Boomerang Brawl

An original party brawler: throw a curving boomerang, catch it when it comes back, knock out your rivals in one hit, and be the last fighter standing. 1 human + 1–3 bots, or 2-player local on desktop. Mobile-first touch controls (landscape), runs fully offline as a single HTML file.

**Play:** https://chirowsan.github.io/boomerang-brawl/

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

## Build
```
npm i            # esbuild only; three r160 is vendored
BUILD=v1.0 node build.mjs --min   # -> BoomerangBrawl.html (single file)
```
Source in `src/` (game.js sim, ai.js bots, arena.js, models.js, gfx.js, fx.js, audio.js, input.js, ui.js, main.js). Headless Puppeteer test scripts live in `tools/`.

## Source layout
`source/` holds the unbundled sources (`src/`, `style.css`, `index.template.html`, `build.mjs`) and the headless Puppeteer test scripts (`tools/`). The build expects three.js r160 vendored at `vendor/three/three.module.js` (npm `three@0.160.0`, copy `build/three.module.js` + `examples/jsm`).

## v1.1
- New touch controls: SVG joystick/aim stick with charge ring, glossy dash/deflect buttons with cooldown sweeps, haptics, safe-area aware, polished pause button and HUD chips.
- New fighters: panda chef Bao, ninja fox Nori, tiny robot Bolt, cat pirate Salty, lizard monk Pico, penguin samurai Yuki - expressive faces (blink/angry/happy/scared/KO), accessories, squash & stretch, idle quirks, victory pose, per-fighter boomerang skins, select-screen portraits with quips.
