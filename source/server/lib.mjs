// Whackerang gold-ledger server: core logic (no dependencies, Node 20+).
// LOCAL PROTOTYPE. It is NOT deployed anywhere. See server/README.md and docs/LEDGER-SPEC.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const rid = (n = 12) => crypto.randomBytes(n).toString('base64url');

// ---- earn rules: the server decides what each kind of event is worth and how much per day. Clients only report events.
export const EARN_RULES = {
  win: { amount: 30, perDay: 20 }, play: { amount: 8, perDay: 40 }, ko: { amount: 5, perDay: 120 },
  level: { amount: null, perDay: 30, min: 50, max: 400 },      // amount reported, bounded
  daily: { amount: null, perDay: 3, min: 20, max: 100 },       // challenge claim (3 per day)
  achievement: { amount: null, perDay: 6, min: 20, max: 300 },
  streak: { amount: null, perDay: 1, min: 20, max: 120 },
  bonus: { amount: 25, perDay: 3 },                            // rewarded-bonus placeholder
  star: { amount: 15, perDay: 60 }, firstclear: { amount: 60, perDay: 12 },
  bossrush: { amount: null, perDay: 6, min: 20, max: 120 },
};
export const DAILY_EARN_CAP = 3000; // hard ceiling on free gold per account per day (generous but bounded)

export class Store {
  constructor(file) { this.file = file; this.db = { accounts: {}, ledger: {}, receipts: {}, events: {}, counters: {} }; if (file && fs.existsSync(file)) this.db = JSON.parse(fs.readFileSync(file, 'utf8')); }
  save() { if (!this.file) return; fs.mkdirSync(path.dirname(this.file), { recursive: true }); const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.db)); fs.renameSync(tmp, this.file); }
}

export class Ledger {
  constructor(store, catalog) { this.s = store; this.catalog = catalog; }
  account(id) { return this.s.db.accounts[id]; }
  createAccount() {
    const id = 'acc_' + rid(9), token = 'wk_' + rid(24); this.s.db.accounts[id] = { id, tokenHash: sha256(token), createdAt: Date.now(), entitlements: [], flags: {} }; this.s.db.ledger[id] = []; this.s.save(); return { accountId: id, token };
  }
  authenticate(token) { if (!token) return null; const h = sha256(token); return Object.values(this.s.db.accounts).find((a) => crypto.timingSafeEqual(Buffer.from(a.tokenHash), Buffer.from(h))) || null; }
  entries(id) { return this.s.db.ledger[id] || []; }
  balance(id) { const e = this.entries(id); return e.length ? e[e.length - 1].balance : 0; }
  // Append-only, hash-chained. `ref` makes every credit/debit idempotent.
  append(id, { delta, kind, reason, ref, meta }) {
    const list = this.s.db.ledger[id]; if (!list) throw httpErr(404, 'no such account');
    if (ref) { const dup = list.find((e) => e.ref === ref); if (dup) return { entry: dup, duplicate: true }; }
    const prev = list.length ? list[list.length - 1] : null; const balance = (prev ? prev.balance : 0) + delta; if (balance < 0) throw httpErr(402, 'insufficient gold');
    const e = { seq: list.length + 1, t: Date.now(), delta, balance, kind, reason, ref: ref || null, meta: meta || null, prev: prev ? prev.hash : 'GENESIS' };
    e.hash = sha256(e.prev + '|' + e.seq + '|' + e.t + '|' + e.delta + '|' + e.balance + '|' + e.kind + '|' + e.reason + '|' + (e.ref || '')); list.push(e); this.s.save(); return { entry: e, duplicate: false };
  }
  verifyChain(id) { let prev = 'GENESIS', bal = 0; for (const e of this.entries(id)) { bal += e.delta; const h = sha256(prev + '|' + e.seq + '|' + e.t + '|' + e.delta + '|' + e.balance + '|' + e.kind + '|' + e.reason + '|' + (e.ref || '')); if (e.prev !== prev || e.hash !== h || e.balance !== bal) return { ok: false, badSeq: e.seq }; prev = e.hash; } return { ok: true, entries: this.entries(id).length, balance: bal }; }
  dayKey(t = Date.now()) { return new Date(t).toISOString().slice(0, 10); }
  earnedToday(id, reason) { const k = this.dayKey(); return this.entries(id).filter((e) => e.kind === 'earn' && this.dayKey(e.t) === k && (!reason || e.reason === reason)); }
  earn(id, { event, ref, amount }) {
    const rule = EARN_RULES[event]; if (!rule) throw httpErr(400, 'unknown earn event'); if (!ref || String(ref).length < 6) throw httpErr(400, 'ref (idempotency key) required');
    let amt = rule.amount; if (amt === null) { amt = Math.round(+amount); if (!(amt >= rule.min && amt <= rule.max)) throw httpErr(400, `amount out of range for ${event}`); }
    const dup = this.entries(id).find((e) => e.ref === 'earn:' + ref); if (dup) return { entry: dup, duplicate: true };
    const today = this.earnedToday(id); if (today.filter((e) => e.reason === event).length >= rule.perDay) throw httpErr(429, `daily limit reached for ${event}`);
    const total = today.reduce((a, e) => a + e.delta, 0); if (total + amt > DAILY_EARN_CAP) throw httpErr(429, 'daily free-gold cap reached');
    return this.append(id, { delta: amt, kind: 'earn', reason: event, ref: 'earn:' + ref });
  }
  spend(id, { itemId, ref }) {
    const item = this.catalog.items[itemId]; if (!item) throw httpErr(400, 'unknown item'); const a = this.account(id);
    if (a.entitlements.includes(itemId)) throw httpErr(409, 'already owned');
    const r = this.append(id, { delta: -item.cost, kind: 'spend', reason: 'item:' + itemId, ref: 'spend:' + (ref || itemId) }); if (!r.duplicate) { a.entitlements.push(itemId); this.s.save(); } return r;
  }
  // Called ONLY after a payment provider has been verified server-side.
  creditPurchase(id, { sku, orderId, provider }) {
    const pack = this.catalog.packs[sku]; if (!pack) throw httpErr(400, 'unknown sku'); const a = this.account(id);
    const first = !this.entries(id).some((e) => e.kind === 'buy'); let gold = pack.gold; if (first && pack.firstBonus !== false) gold = Math.round(gold * (1 + this.catalog.firstBuyBonus));
    if (pack.oneTime && a.flags['bought:' + sku]) throw httpErr(409, 'one-time pack already bought');
    const r = this.append(id, { delta: gold, kind: 'buy', reason: 'pack:' + sku, ref: provider + ':' + orderId, meta: { provider, sku } });
    if (!r.duplicate) { if (pack.oneTime) { a.flags['bought:' + sku] = true; for (const it of pack.items || []) if (!a.entitlements.includes(it)) a.entitlements.push(it); } this.s.save(); } return { ...r, gold };
  }
}
export function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

// ---- Stripe webhook signature verification (scheme v1: HMAC-SHA256 of `${t}.${rawBody}`)
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false; const parts = Object.fromEntries(header.split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const t = +parts.t; if (!t || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const exp = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'); const got = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return got.some((g) => g.length === exp.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(exp)));
}
export function signStripe(rawBody, secret, t = Math.floor(Date.now() / 1000)) { return `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`; }

// ---- Google Play verification. Real mode uses a service account (env GOOGLE_SERVICE_ACCOUNT_JSON) against androidpublisher v3.
export async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000); const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  if (!r.ok) throw httpErr(502, 'google auth failed'); return (await r.json()).access_token;
}
export async function verifyPlayPurchase({ packageName, productId, purchaseToken }, env = process.env) {
  if (env.PLAY_VERIFY === 'mock' || !env.GOOGLE_SERVICE_ACCOUNT_JSON) { // DEV ONLY
    if (!String(purchaseToken).startsWith('TEST-')) throw httpErr(402, 'mock verifier only accepts TEST- tokens'); return { orderId: 'GPA.TEST.' + sha256(purchaseToken).slice(0, 12), purchaseState: 0, consumptionState: 0, mock: true };
  }
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON); const tok = await googleAccessToken(sa); const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const r = await fetch(base, { headers: { authorization: 'Bearer ' + tok } }); if (!r.ok) throw httpErr(402, 'purchase not found at Google'); const p = await r.json();
  if (p.purchaseState !== 0) throw httpErr(402, 'purchase not completed'); return { orderId: p.orderId, purchaseState: p.purchaseState, consumptionState: p.consumptionState, ack: async () => fetch(base + ':acknowledge', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: '{}' }) };
}
