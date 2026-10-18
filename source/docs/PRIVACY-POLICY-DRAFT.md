# Whackerang Privacy Policy (DRAFT TEMPLATE)

> **Generic draft, not legal advice.** Replace the [BRACKETS], review with a lawyer before publishing, and update if the app starts collecting more.

_Last updated: [DATE]_ · _Owner/publisher: [FULL NAME or COMPANY], [ADDRESS], [CONTACT EMAIL]_

## The short version
Whackerang does not ask for your name, email, birthday, location, contacts or photos. We do not show ads, we do not use analytics, and we do not sell data.

## What is stored on your device
Your progress (level, gold, unlocked items, settings, scores) is saved **on your device only** (in the app/browser storage). Clearing app data or the browser's site data deletes it. We cannot see it or recover it.

## What we collect
Nothing about you. [If you later turn on the online gold ledger: an anonymous account id and a gold/purchase history linked to it, so purchases can be restored. No name or email is needed.]

## Purchases
[Only once real purchases are enabled.] Payments are handled by Google Play or Apple or Stripe. We never see your card number. We receive a confirmation (order id, product) so we can add gold to your account. In TEST MODE nothing is charged.

## Children
Whackerang is [intended for players 13 and older / for a general audience including children]. We do not knowingly collect personal information from children. Purchases are protected by a grown-up check. If you believe a child gave us personal information, contact [EMAIL] and we will delete it.

## Online play (v4.0)
Online play is optional and only between friends who share a 5-letter room code or link. There is no chat, no voice, no public matchmaking and no account. Your display name is a preset or a short filtered name, and is shown only to the people in your room. During a match your device exchanges game inputs/state directly with the other players' devices (peer-to-peer), so **the other players in the room can technically see your IP address**, as in any peer-to-peer game. To set up the connection the game contacts a free public connection broker (PeerJS cloud, `0.peerjs.com`) and public STUN servers (Google, Cloudflare) and, as a best-effort fallback, the PeerJS community TURN relay; those services see your IP address and the room code while connecting, and we do not control their logs. From v4.3, if a direct connection cannot be made, the game automatically sends the same game data through a small WebSocket relay we run on Cloudflare's free Workers plan (`whackerang-relay.chirowsan-backyard.workers.dev`). The relay only forwards opaque frames between the players of one room, keeps nothing and logs no content; Cloudflare, as host, sees the connecting IP address, the room code and traffic volume. Nothing about online matches is stored by us. [Review this section before publishing, especially for children's audiences.]

## Third parties
The web version is hosted on GitHub Pages (GitHub may log IP addresses as any web host does: see GitHub's privacy statement). The Android app has no third-party SDKs that collect data. [List any added later.]

## Your choices
Delete the app or clear its data to remove everything stored on your device. [If server accounts exist: email [EMAIL] with your account id to delete it.]

## Changes
We will update this page and its date when the policy changes.

## Contact
[EMAIL]
