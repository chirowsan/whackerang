// Purchase provider abstraction. TEST MODE ONLY: the Mock provider grants gold for free.
// Real providers are documented stubs (see docs/PAYMENTS.md). Nothing here ever charges real money.
import { S, save } from './save.js';
import { ledgerAdd } from './economy.js';

// Gold packs. Prices are USD list prices for the future Play / Stripe SKUs (not charged in test mode).
export const PACKS = [
  { id: 'gold_500', name: 'Pocketful', price: 0.99, gold: 500, bonus: 0, icon: '👛', sku: 'whackerang.gold.500' },
  { id: 'gold_2800', name: 'Pouch', price: 4.99, gold: 2800, bonus: 12, icon: '💰', sku: 'whackerang.gold.2800' },
  { id: 'gold_6000', name: 'Chest', price: 9.99, gold: 6000, bonus: 20, icon: '🧰', sku: 'whackerang.gold.6000' },
  { id: 'gold_13000', name: 'Vault', price: 19.99, gold: 13000, bonus: 30, icon: '🏦', sku: 'whackerang.gold.13000' },
];
export const STARTER = { id: 'starter', name: 'Starter Pack', price: 2.99, gold: 2000, icon: '🎁', sku: 'whackerang.starter', oneTime: true, items: [{ cat: 'trails', id: 'cosmic' }, { cat: 'skins', id: 'aurora' }] };
export const FIRST_BUY_BONUS = 0.5; // +50% gold on your very first purchase (one time)

export const packTotal = (p, first) => Math.round(p.gold * (first ? 1 + FIRST_BUY_BONUS : 1));
export const isFirstPurchase = () => !(S().purchases || []).length;
export const fmtPrice = (p) => '$' + p.price.toFixed(2);

function grantItems(items) { const s = S(); for (const it of items || []) { if (!s.own[it.cat].includes(it.id)) s.own[it.cat].push(it.id); } }
// Called by a provider once a purchase is confirmed (by the server in production, locally in TEST MODE).
export function grantPurchase(pack, orderId, providerId) {
  const s = S(); const first = isFirstPurchase(); const gold = packTotal(pack, first);
  s.coins += gold; s.purchases = s.purchases || []; s.purchases.push({ order: orderId, pack: pack.id, gold, t: Date.now(), provider: providerId });
  if (pack.oneTime) { s.starterBought = true; grantItems(pack.items); }
  ledgerAdd(gold, 'purchase:' + pack.id, 'buy', orderId); save(); return { gold, first };
}

class MockProvider {
  id = 'mock'; label = 'TEST MODE'; real = false;
  available() { return true; }
  async purchase(pack) { await new Promise((r) => setTimeout(r, 450)); const orderId = 'TEST-' + Date.now().toString(36); const r = grantPurchase(pack, orderId, 'mock'); return { ok: true, orderId, ...r }; }
}
// ---- documented stubs: wire these up when the store accounts exist ----
class GooglePlayProvider {
  id = 'google_play'; label = 'Google Play'; real = true;
  available() { return typeof window !== 'undefined' && !!window.CdvPurchase && /android/i.test(navigator.userAgent); }
  async purchase(pack) {
    // 1. CdvPurchase.store.order(offer) with the product id == pack.sku (consumable)
    // 2. on "approved": POST {purchaseToken, productId} to <server>/v1/play/verify (server calls Google Play Developer API purchases.products.get,
    //    credits the ledger once, then acknowledges/consumes). 3. only after the server replies ok: finish() the transaction.
    throw new Error('Google Play Billing is not enabled yet. See docs/PAYMENTS.md');
  }
}
class StripeProvider {
  id = 'stripe'; label = 'Card (Stripe)'; real = true;
  available() { return false; }
  async purchase(pack) {
    // POST <server>/v1/stripe/checkout {sku} -> {url}; redirect to Stripe Checkout; the Stripe webhook (checkout.session.completed)
    // credits the ledger server-side. The client only polls /v1/me/gold afterwards.
    throw new Error('Stripe Checkout is not enabled yet. See docs/PAYMENTS.md');
  }
}
export const PROVIDERS = { mock: new MockProvider(), google_play: new GooglePlayProvider(), stripe: new StripeProvider() };
export const TEST_MODE = true; // flip to false only when a real provider + server are live
export function getProvider() { if (TEST_MODE) return PROVIDERS.mock; return PROVIDERS.google_play.available() ? PROVIDERS.google_play : PROVIDERS.stripe.available() ? PROVIDERS.stripe : PROVIDERS.mock; }
