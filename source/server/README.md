# Whackerang gold-ledger server (local prototype)

**Status: runs on your own computer only. It is NOT deployed anywhere and nothing in the game talks to it yet.**
It shows how gold should work once real money is involved: the *server* owns the gold balance, the game only asks.

```bash
cd server
npm run catalog   # rebuild catalog.json from the game's own prices (needs esbuild from the parent folder)
npm test          # 6 tests: accounts, earn caps, spend, Google Play verify (mock), Stripe webhook signatures, tamper detection
npm start         # http://127.0.0.1:8787  (binds to loopback only)
```
No dependencies (Node 20+). Data is a JSON file in `server/data/` (git-ignored). For production swap it for Postgres.

## Endpoints
| Method + path | What it does |
|---|---|
| `POST /v1/accounts` | Anonymous account. No name / email / birthday is collected. Returns `{accountId, token}`; only a hash of the token is stored. |
| `GET /v1/me` | Gold balance + owned items. `Authorization: Bearer <token>` |
| `GET /v1/me/ledger`, `/v1/me/ledger/verify` | Last 100 entries; verify the hash chain. |
| `POST /v1/earn {event, ref, amount?}` | Free gold. The **server** decides what each event is worth (`EARN_RULES`), daily limits per event and a daily cap. `ref` makes it idempotent. |
| `POST /v1/spend {itemId}` | Buys a cosmetic. Price comes from `catalog.json`, never from the client. Refuses negative balances and double buys. |
| `POST /v1/play/verify {productId, purchaseToken}` | Verifies a Google Play purchase with the Play Developer API, credits gold **once per token**, then acknowledges. `PLAY_VERIFY=mock` (dev) accepts only tokens starting `TEST-`. |
| `POST /v1/stripe/checkout {sku}` | Creates a Stripe Checkout Session (needs `STRIPE_SECRET_KEY`; dev mode returns a fake URL). |
| `POST /v1/stripe/webhook` | Verifies `Stripe-Signature` (HMAC-SHA256, 5 min tolerance) on the raw body and credits gold on `checkout.session.completed`. Idempotent per session. |
| `POST /v1/dev/mock-purchase` | DEV ONLY (`DEV_MODE` must not be `0`). Lets the TEST MODE client sync a fake purchase. |

## Environment
`DEV_MODE=0` turns off dev routes · `PLAY_VERIFY=mock|real` · `GOOGLE_SERVICE_ACCOUNT_JSON` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `WEB_URL` · `CORS_ORIGIN` · `PORT`.
**Never commit secrets.** Keep them in the host's secret manager.

## Honest limits
* A game running on a phone can lie about match results. The server therefore *caps* what free gold can be earned (per event and per day); it cannot prove a match really happened. For a stronger guarantee you need server-run matches, which this game does not have.
* Paid gold is different: it is only ever credited after Google or Stripe confirms the payment to the server.
* See `../docs/LEDGER-SPEC.md` for the full design and `../docs/PAYMENTS.md` for wiring the client.
