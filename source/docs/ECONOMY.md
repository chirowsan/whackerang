# Whackerang economy (Gold)

One currency: **Gold**. Players can always earn it by playing. Buying gold is an optional shortcut. **No pay-to-win**: gold buys cosmetics and conveniences, never match-winning power.

## Earn rates (free, all generous on purpose)
| Source | Gold |
|---|---|
| Win a match | +30 |
| Play a match (win or lose) | +8 |
| Each KO | +5 (and +8 XP) |
| Survival | +9 per wave reached |
| King of the Hill win | +25 extra |
| Capture the Flag / Boomerang Ball win | +15 extra |
| Coin Rush | +0.8 per coin you grab, up to +40 |
| Boss Rush | +20 per boss reached, +60 extra for clearing all three |
| Campaign stage win | +15 per star earned, +60 the first time a stage is cleared |
| Daily challenges (3 new each day) | 25-60 each |
| Daily login streak (7-day ladder) | 20 / 30 / 40 / 50 / 60 / 80 / 120, then repeats. Miss a day and the ladder restarts at day 1; nothing is taken away. |
| Bonus gold (placeholder, no ad is shown) | +25, up to 3 per day |
| Level up | 40 + 10 x the new level |
| Achievements (35+) | 20-300 each |
| Tutorial | +40 once |

A typical 20-minute session earns roughly 250–400 gold. The most expensive boomerang types (Blast 450, Phantom 500) are one or two sessions away, and **every boomerang type is also unlocked for free by levelling up (Razor lv 3, Frost lv 5, Chain lv 8, Blast lv 10, Phantom lv 14).** Premium cosmetics (Crown hat, Cosmic and Comet trails, Aurora / Galaxy / Inferno skins) cost 800-1800 gold, about a week of casual play.

## What gold buys
Cosmetics (skins, trails, hats, emotes), extra fighters, boomerang types (also free via levels). Nothing that changes stats, speed, damage, hit-box or ammo is sold. Premium items are visual only.

## Optional gold packs (TEST MODE now; real prices only after store setup)
| Pack | Price | Gold | Bonus |
|---|---|---|---|
| Pocketful | $0.99 | 500 | - |
| Pouch | $4.99 | 2,800 | labelled +12% |
| Chest | $9.99 | 6,000 | labelled +20% |
| Vault | $19.99 | 13,000 | labelled +30% |
| Starter Pack (one time, only until bought) | $2.99 | 2,000 + Cosmic trail + Aurora skin | |

* **First-purchase bonus:** +50% gold on the very first purchase, whichever pack it is (one time only; the Starter Pack counts). The server applies it, not the client.
* No countdown timers, no "limited time" pressure, no loot boxes, no random paid rewards, no pop-ups that interrupt a match.
* **Kid-friendly / COPPA-aware:** the Buy tab sits behind a *parental gate* (a grown-up maths question). This is a placeholder: see LAUNCH-CHECKLIST.md before releasing to children.

## Where the rules live in code
`src/economy.js` (earn constants, streak, bonus, gate), `src/purchase.js` (packs + providers), `server/lib.mjs` (`EARN_RULES`, caps), `server/catalog.json` (generated prices).
