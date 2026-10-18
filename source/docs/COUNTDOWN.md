# Countdown (v4.5): 3-2-1-GO at the start of every round

## What the player sees
- A short **title card** (round / mode / arena, in a dark pill near the top) for about 0.45 s, then a big **3, 2, 1** in the middle of the screen (each number pops in, about 40% of the screen height, white with a dark outline so it reads on every arena), then a gold **GO!**.
- Sound: a beep per number (660 Hz square + low triangle), a higher two-tone chime on GO (1320 + 1760 Hz).
- Haptics (Settings > Vibration on): 18 ms tick per number, 55 ms on GO (Capacitor Haptics on the Android app, `navigator.vibrate` on the web).
- The number sits mid-screen, the title card above it, the HUD (top bar, scores, buttons) and the touch controls (bottom corners) stay clear; the Edge help overlay cannot show during the countdown (it is only evaluated in play).
- Reduced-motion users get the number without the pop animation.

## What is locked until GO (`Game.state === 'intro'`)
- No movement, throw, dash, deflect, ultimate: inputs are never read in `intro` (human, bots, online guests). Bots do not think.
- Traps, hazards, spikes, ice cracks, sudden death, mode timers, power-up timer, arena events, KOTH/bomb/survival rules: all run only in `play`, so their clocks start at 0 at GO.
- **Invulnerable**: `Fighter.die()` refuses while `intro` (so even a scripted/forced hit cannot kill).
- You can still look: the camera and animations run.

## Timing rules
- 3 s of numbers, **real time**: Game Speed (Chill/Normal/Fast) scales the simulation but not the countdown. The host/offline countdown is `introT`, which also follows the wall clock (`goWall`): if frames are slow (first-frame shader compile, a hitch) the count still ends on time. Pausing pushes the deadline back so it does not jump on resume.
- `CD_LEN = 3.0`, `CD_PRE = 0.45` (src/util.js). Online host: pre-roll = `0.45 + worst peer ping`, capped at 1.2 s, so a slow link still sees the "3".
- **Tutorial / Training**: short version (0.9 s, no numbers, just "GO!"). Attract (menu background) has none.
- Runs for every mode, offline vs bots, **restart round**, **rematch**, next round, stages, online rounds.

## Online (host-authoritative)
- The host creates the Game with `intro = 3 + pre-roll` and the `round` message carries `goIn` (seconds until GO at send time).
- The guest turns it into a local deadline `goAt = now + goIn - rtt/2` (rtt = its smoothed ping to the host, direct or relay) **before** building its own arena, so build time never delays GO.
- While the guest is in the countdown, every snapshot (fast channel) carries the host's remaining `introT`; the guest re-aims `goAt` at `now + introT - rtt/2` (smoothed 35%), so the slow-channel delivery of the `round` message can not skew it.
- Guests run their own countdown (overlay, beeps, haptics) from `goAt`; the host's `countdown`/`go` events are **not** relayed (no duplicates). If the host's snapshots already say `play` while the guest still thinks more than 0.4 s remain, the guest clears its overlay (never stuck).
- Host inputs from guests are ignored during `intro` (existing rule, edges cleared too), and guest-side prediction does not move during `intro`.
- Measured (headless, two real browsers, same clock): guest GO vs host GO +27..37 ms direct and relay, -72 ms with a simulated 150 ms round trip. Real networks add their own jitter; expect roughly +-half the RTT variation.

## Tests
- `tools/cd45.mjs` (36 checks): timeline 3/2/1/GO in all three Game Speeds (180 frames from 3 to GO), locks (inputs hammered: no movement, no throws, clocks frozen, invulnerable, no holes), after-GO movement/damage, overlay readability and no HUD overlap, haptics, restart + rematch, every mode, tutorial short version, no console errors; screenshots in `v4.5-shots/`.
- `tools/net_cd45.mjs` (30 checks): direct, direct + simulated delay, relay: host/guest event order, one set of events, GO skew, locks on both views, overlay on the guest, second round counts down again.
- Existing suites were re-run on the new build: falls44, smoke31, touch31, v33test, traps43, tut42, net_ui, net_life, net_relay43, relay43, layout42, perf.
