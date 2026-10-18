# Falling (v4.4): how a player can fall, and how it is shown

## Every way to fall (audited)
The only floor that can disappear is a tile in the `hole[]` grid (arena walls clamp players, there are no open outer edges, no moving platforms). A tile gets a hole from:
1. **Sudden death** (after 48 s, if the mode allows it): four shrinking rings, each ring warns for 1.0-2.6 s.
2. **Ice arena cracks**: two random tiles every 7-11 s, 1.5 s warning.
3. **Crumble mode**: tiles near players, 0.65-1.15 s warning.
4. **Trapdoor trap** (lethal, player-activated since v4.3): 0.4 s warning after it is armed.
`hole > 0` = warning (timer), `hole < 0` = gone. A fighter standing on a gone tile falls (`die(..., 'fall')`). Dashing and jump pads make you safe. Lava and spike tiles are separate hazards.

## What the player sees (all arenas, same look)
* **Abyss, never floor-coloured:** the old per-arena flat "void" plane (green on dojo, blue on ice, ...) is gone. Under every arena there is a near-black bottom plane and, whenever a hole exists, three translucent violet haze layers (a depth gradient), so a missing tile always reads as a drop.
* **Glowing cyan rim on every ledge:** bright rim line + soft cyan glow on the floor side + a dark cliff shadow on the void side. One colour everywhere: **cyan edge = drop** (red = deadly trap, yellow = annoying trap).
* **Warning tile:** a cracking tile shakes and blinks near-black <-> saturated cyan with a fast-flashing cyan outline. It no longer tints toward red or floor colours.
* **Proximity warning (Edge help):** within about one tile of a drop the rim pulses faster and brighter, a cyan glow frames the screen with a small `EDGE` chip, a short audio tick plays (faster the closer you are) and phones vibrate briefly (if Vibration is on).
* **Wobble:** standing on nothing makes the fighter wobble and sink with dust, before the fall.

## Rules (Edge help, Settings, default ON)
* **Ledge grace 0.25 s** (game time): step back onto floor and nothing happens.
* **Free save:** the first fall of each fighter in a match is forgiven once: it is put on the nearest safe floor tile (no hole neighbours, no trap danger, nobody standing there), stunned 0.8 s (the time penalty) and shielded for 1.8 s, with a `SAVED! ONCE PER MATCH` popup. The record lives on the match object, so it survives rounds. Bots get the same one save. After that falling is fatal.
* **Edge help off** restores the v4.3 behaviour exactly: instant fall, no save, no warnings.
* Online: the host's sim decides grace and saves, using the host's Edge help setting. Holes were already synced (fallen bitmap + warning timers), so the rim/abyss render identically on guests; the wobble and the proximity warning are computed locally on each device from the synced holes and positions (a guest with Edge help off sees no warnings).

## Tests
`tools/falls44.mjs` (all 8 arenas, 78 checks): rim strips, warning rim, abyss layers, rim removal, proximity, wobble, grace, free save, second fall fatal, step-off cancel, Edge help off, per-match record, overlay. `tools/net_relay43.mjs` checks that a guest sees the same drop and that the host saves a guest. Screenshots: `tools/shots44.mjs`, `tools/shots44b.mjs`.
