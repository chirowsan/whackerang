# Payments: how to wire real purchases later (nothing is live)

The game today uses `src/purchase.js` with `TEST_MODE = true` and the **Mock provider**: a "purchase" just adds gold and is labelled TEST MODE everywhere. No real money moves, nothing is filed or bought.

## The abstraction
```
getProvider() -> { id, label, available(), purchase(pack) -> {ok, orderId, gold} }
```
Providers: `MockProvider` (works), `GooglePlayProvider` (stub), `StripeProvider` (stub). The UI only calls `getProvider().purchase(pack)`.

## Google Play Billing (Android app, consumable gold packs)
1. Create the 4 packs + starter as **managed (in-app) products** with the SKUs in `purchase.js` (`whackerang.gold.500` ...). Mark them consumable by consuming after crediting.
2. Add a Capacitor-compatible plugin. Options: **cordova-plugin-purchase** (free, popular, works in Capacitor), **@capgo/native-purchases**, or **RevenueCat** (`@revenuecat/purchases-capacitor`; free until a revenue threshold, handles receipts for you, adds a vendor).
3. In `GooglePlayProvider.purchase`: order the SKU -> on `approved`, POST `{productId, purchaseToken}` to `/v1/play/verify` -> when the server answers `ok`, call `finish()` (consumes + acknowledges). Never credit gold on the device.
4. Server: create a Google Cloud service account, grant it access in Play Console (Users and permissions -> API access), put its JSON in `GOOGLE_SERVICE_ACCOUNT_JSON`, set `PLAY_VERIFY=real`.
5. Test with license testers and the Play Console test cards before launch. Add Real-time developer notifications (RTDN) to catch refunds.
6. Play rules: digital goods on Android must use Play Billing. Apps in the Families program have extra restrictions (no deceptive purchase prompts, parental gate for purchases).

## Stripe Checkout (web / PWA)
1. Create a Stripe account, products optional (the server sends `price_data`).
2. `StripeProvider.purchase`: POST `/v1/stripe/checkout {sku}` -> redirect to the returned URL -> after return, poll `/v1/me`.
3. Configure a webhook endpoint -> `POST /v1/stripe/webhook`, subscribe to `checkout.session.completed`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Do not ship the Stripe checkout inside the Play-distributed APK (Play requires Play Billing for in-app digital goods); keep it for the web version only.

## iOS (later)
Digital goods must use Apple In-App Purchase (StoreKit). Same server pattern: send the transaction to a server endpoint that verifies with the App Store Server API, then credit the ledger. Not built yet.

## Before turning TEST_MODE off
Server deployed behind HTTPS, secrets in a secret manager, parental gate reviewed, privacy policy + terms published, store listing declarations (in-app purchases, Families/COPPA) completed, refund flow tested. See LAUNCH-CHECKLIST.md.
