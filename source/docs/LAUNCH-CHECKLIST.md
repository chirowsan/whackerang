# Whackerang launch checklist (plain language)

**Nothing on this list has been done. No trademark has been filed, no store account opened, no money spent.** Prices and rules below were checked in October 2026 and change over time, so re-check the linked official pages before paying.

## 0. The short version (order that saves money)
1. Search for conflicts (free) -> 2. decide on the name -> 3. file the trademark -> 4. open the Google Play account -> 5. write the privacy policy -> 6. run the 14-day closed test -> 7. publish. Do the kids/COPPA decision (section 5) *before* you build store listings: it changes everything else.

## 1. Trademark: WHACKERANG (USA)
* Where: USPTO online application (the old "TEAS Plus/Standard" forms were replaced in Jan 2025 by one **base application**).
* Cost: **$350 per class**. A video game app belongs in **Class 9** (downloadable game software) and, if you also offer online/hosted play, **Class 41** (entertainment services). Both = **$700**. Extra fees ($100-$200 per class) apply if the application is incomplete or uses free-form wording, so pick wording from the USPTO's ID Manual.
* **Knockout search first (free):** USPTO Trademark Search, Google Play, App Store, itch.io, Steam, Google, and "whackerang"/"whack-a-rang" spelling variants. Known to check: *a July 2026 Class 9 application of unknown owner that looked similar*. Open it, read the owner, goods and status. If the wording is close and the goods overlap, talk to a lawyer **before** filing.
* Filing basis: if the game is not yet sold under the name in stores, file **"intent to use" (1(b))**; it costs extra fees later to prove use. If you already sell/distribute under the name across state lines, file "use in commerce" (1(a)).
* Expect 8-14 months to a decision, an office action (a questions letter) is common. A trademark attorney for a clearance opinion + filing is typically a few hundred to a couple of thousand dollars. Optional but sensible for a name you will invest in.
* Do not use the (R) symbol until registered; **TM** is fine now.
* Also check: domain name, social handles, and that "Whackerang" is not too close to other "-rang" game names.

## 2. Google Play (Android)
* Developer account: **$25 one-time**. Verification needs ID, and a phone; an organization account also needs a D-U-N-S number (free but slow).
* **Personal accounts created after 13 Nov 2023 must run a closed test: at least 12 testers opted in for 14 continuous days** before you may apply for production. Start recruiting friends/family early. Organization accounts are exempt.
* Create the app in Play Console, complete: app access, ads declaration (this build has **no ads**), content rating (IARC questionnaire), target audience, data safety form, news/health/financial declarations.
* **Play App Signing:** enroll when creating the first release. You sign uploads with your *upload key* (the existing keystore `bb-release.jks` can serve, but keep a backup in two places and never commit it); Google holds the real app-signing key.
* **Upload an AAB** (Android App Bundle), not an APK. `mobile/build-android.sh` builds the APK; for the bundle run `./gradlew bundleRelease` in `mobile/android` (the release attaches the AAB when it could be built).
* New package id is **com.chirow.whackerang**. Existing installs of **com.chirow.boomerangbrawl** are a different app: saves and progress do not carry over automatically. (The in-browser PWA does migrate the old save.)
* Store listing: title, short description (80 chars), full description, 512x512 icon, 1024x500 feature graphic, 2-8 phone screenshots (see `shots/v30/`), privacy-policy URL.
* If you sell gold packs: create in-app products, use Play Billing, complete the in-app-purchase declaration. See PAYMENTS.md.

## 3. Apple (iOS), later
* Apple Developer Program **$99/year**; needs a Mac with Xcode to build the Capacitor iOS project (`mobile/ios`).
* In-app purchases must use Apple IAP. Privacy "nutrition label" and age rating questionnaire required. TestFlight beta first.

## 4. Business basics (do before real money)
* Decide the legal seller: you personally (sole proprietor) or an LLC. Accounts, trademark and bank should all be the same name.
* **Payments profile + tax:** Google Play/Apple will ask for a tax form (US individuals: W-9) and a bank account for payouts. They collect/remit sales tax in most places; you still report income. Talk to an accountant once there is revenue.
* Keep records of every sale and refund for 7 years (the server ledger does this for gold).

## 5. Kids, COPPA and age rating (the big decision)
* The game is cartoon, with no blood, chat, ads, or accounts, so it appeals to kids. **If the game is "directed to children under 13" or you choose "Designed for Families" in Play, US COPPA and Google's Families Policy apply**: no behavioural ads, no collecting personal data without verifiable parental consent, parental gate before purchases, only Families-certified ad SDKs, extra review.
* Simplest safe path: **target audience 13+ (or "all ages but not primarily children") and collect no personal data**. Still design as if kids are playing.
* Whackerang today: stores saves on the device only, no analytics, no ads, no chat, no account. The prototype server uses anonymous ids only.
* Age rating (IARC): expect "Everyone 10+" for cartoon violence (boomerangs knocking cartoon characters off a platform). Answer honestly; in-app purchases are declared.
* The parental gate in the Gold Store is a **placeholder question**. Google/Apple may require a specific gate style for kids' apps.
* If in doubt about COPPA, a short consult with a lawyer is cheaper than an FTC problem.

## 6. Privacy policy and terms
* Drafts: `PRIVACY-POLICY-DRAFT.md`, `TERMS-DRAFT.md`. **They are generic templates, not legal advice.** Fill in the real owner name, contact email and address, then have a lawyer read them before launch if you collect any data or sell gold.
* Host them at public URLs (GitHub Pages works: `https://chirowsan.github.io/whackerang/privacy.html`), then paste the URL into Play Console and in-app.
* Add a working support email.

## 7. Before turning on real purchases
Deployed server (HTTPS), secrets in a secret manager, TEST MODE off, refund path tested, Play license testers used, parental gate reviewed, terms say gold has no cash value, store declarations match what the app does.

## 8. Rough budget
| Item | Cost |
|---|---|
| Google Play developer account | $25 once |
| Trademark, Class 9 | $350 |
| Trademark, Class 9 + 41 | $700 |
| Apple Developer Program | $99 / year |
| Lawyer (optional) | quote it |
| Server hosting (only when selling gold) | $0-10 / month small |
| Everything in the game today | $0 |

## 9. Release hygiene
* Bump `versionCode`/`versionName` for every upload. Never reuse a versionCode.
* Keep the keystore + password outside the repo (`~/dev/keys/`), backed up twice. Losing the *upload* key can be fixed through Play support when App Signing is on; losing the *signing* key for a self-signed APK cannot.
* Test the exact AAB on a real phone with an internal test track before production.
