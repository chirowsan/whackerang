# Server-authoritative gold ledger: spec

Goal: the number of gold a player has can only change through the server, and every change can be explained.

## Rules
1. **Accounts** are anonymous (`acc_...` + secret token). No personal data. A parent-linked account (email) is a later, separate, opt-in feature.
2. **Ledger** is append-only per account. Each entry: `seq, t, delta, balance, kind (earn|spend|buy), reason, ref, prev, hash`. `hash = sha256(prev | seq | t | delta | balance | kind | reason | ref)` so editing or deleting any row breaks the chain (`GET /v1/me/ledger/verify`).
3. **Balance = last entry's balance.** It can never go below 0. Entries are never edited; refunds are new negative entries.
4. **Idempotency:** every earn, spend and purchase carries a unique `ref` (match id, purchase token, Stripe session id). Replays return the original result and change nothing.
5. **Earned gold:** the client reports an *event* (win, ko, level...). The server decides the amount from `EARN_RULES`, enforces per-event daily limits and a total daily free-gold cap (3,000). Bounded events (level, daily, achievement) accept an amount only inside a min/max range.
6. **Spent gold:** the client names an item; the server looks up the price in the catalog, debits, and records the entitlement. One purchase per item.
7. **Bought gold:** credited only by (a) `POST /v1/play/verify` after the Google Play Developer API confirms the purchase token, or (b) the Stripe webhook after signature verification. Never from a client claim. First-purchase bonus and one-time packs are enforced here.
8. **Receipt replay protection:** the credit `ref` includes the provider order id/token; a second submission is a no-op.
9. **Offline play:** the app keeps a local mirror (`save.ledger`) so the game works offline, and syncs events when online. On conflict the server balance wins; the app shows the server number. Locally edited saves therefore cannot make paid gold.
10. **Refunds / chargebacks:** a negative `buy` entry with `reason: refund:<ref>`; if that would make the balance negative, the account is flagged `debt` and spending is blocked until it recovers.
11. **Auditing:** nightly job runs `verifyChain` for every account and alerts on any break; store `ref`s for 7 years for tax purposes.
12. **Privacy:** tokens are stored hashed; logs must not contain tokens or purchase tokens.

## Threats this stops / does not stop
Stops: editing localStorage to add gold, replaying a receipt, forged receipts, forged webhooks, negative balances, client-chosen prices, double-spending.
Does not stop: a modified client *claiming* wins (limited by caps), or a stolen account token (rotate via a re-login flow when real accounts exist).

Reference implementation: `server/lib.mjs`, tests in `server/test.mjs`.
