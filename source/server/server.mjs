// Local-only HTTP API. `node server.mjs` -> http://127.0.0.1:8787 . Binds to loopback; NOT deployed.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Store, Ledger, httpErr, verifyStripeSignature, verifyPlayPurchase, EARN_RULES, rid } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export function loadCatalog() { return JSON.parse(fs.readFileSync(path.join(here, 'catalog.json'), 'utf8')); }

export function createServer({ dataFile = path.join(here, 'data', 'db.json'), env = process.env, catalog = loadCatalog() } = {}) {
  const store = new Store(dataFile), ledger = new Ledger(store, catalog); const DEV = env.DEV_MODE !== '0';
  const hits = new Map(); // tiny rate limiter: 120 req/min per ip
  const limited = (ip) => { const now = Date.now(), w = (hits.get(ip) || []).filter((t) => now - t < 60000); w.push(now); hits.set(ip, w); return w.length > 120; };
  const read = (req, max = 64 * 1024) => new Promise((res, rej) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > max) { rej(httpErr(413, 'body too large')); req.destroy(); } }); req.on('end', () => res(b)); req.on('error', rej); });
  const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': env.CORS_ORIGIN || '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' }); res.end(JSON.stringify(obj)); };
  const auth = (req) => { const h = req.headers.authorization || ''; const a = ledger.authenticate(h.startsWith('Bearer ') ? h.slice(7) : ''); if (!a) throw httpErr(401, 'bad token'); return a; };
  const view = (a) => ({ accountId: a.id, gold: ledger.balance(a.id), entitlements: a.entitlements, flags: a.flags });

  const routes = {
    'POST /v1/accounts': async (req, res) => { // anonymous account: no name, email or birthday is collected (COPPA-friendly)
      send(res, 201, ledger.createAccount()); },
    'GET /v1/me': async (req, res) => send(res, 200, view(auth(req))),
    'GET /v1/me/ledger': async (req, res) => { const a = auth(req); send(res, 200, { balance: ledger.balance(a.id), entries: ledger.entries(a.id).slice(-100) }); },
    'GET /v1/me/ledger/verify': async (req, res) => send(res, 200, ledger.verifyChain(auth(req).id)),
    'GET /v1/catalog': async (req, res) => send(res, 200, catalog),
    'GET /v1/earn/rules': async (req, res) => send(res, 200, EARN_RULES),
    'POST /v1/earn': async (req, res) => { const a = auth(req); const b = JSON.parse((await read(req)) || '{}'); const r = ledger.earn(a.id, b); send(res, 200, { ...view(a), duplicate: r.duplicate, delta: r.entry.delta }); },
    'POST /v1/spend': async (req, res) => { const a = auth(req); const b = JSON.parse((await read(req)) || '{}'); const r = ledger.spend(a.id, b); send(res, 200, { ...view(a), duplicate: r.duplicate }); },
    // Google Play: the app sends the purchase token it received from Play Billing; we verify it with Google, credit once, then acknowledge.
    'POST /v1/play/verify': async (req, res) => {
      const a = auth(req); const b = JSON.parse((await read(req)) || '{}'); const pack = catalog.packs[b.productId]; if (!pack) throw httpErr(400, 'unknown productId');
      const pkg = b.packageName || catalog.packageName; if (pkg !== catalog.packageName) throw httpErr(400, 'wrong package');
      const v = await verifyPlayPurchase({ packageName: pkg, productId: b.productId, purchaseToken: b.purchaseToken }, env);
      const r = ledger.creditPurchase(a.id, { sku: b.productId, orderId: 'play:' + v.orderId + ':' + b.purchaseToken.slice(-10), provider: 'google_play' }); if (!r.duplicate && v.ack) await v.ack().catch(() => {});
      send(res, 200, { ...view(a), credited: r.duplicate ? 0 : r.gold, duplicate: r.duplicate });
    },
    // Stripe Checkout (web). Real mode creates a Checkout Session; dev mode returns a fake URL.
    'POST /v1/stripe/checkout': async (req, res) => {
      const a = auth(req); const b = JSON.parse((await read(req)) || '{}'); const pack = catalog.packs[b.sku]; if (!pack) throw httpErr(400, 'unknown sku');
      if (!env.STRIPE_SECRET_KEY) { if (!DEV) throw httpErr(503, 'stripe not configured'); return send(res, 200, { url: 'http://127.0.0.1/dev-checkout?sku=' + b.sku, dev: true }); }
      const p = new URLSearchParams({ mode: 'payment', client_reference_id: a.id, 'metadata[sku]': b.sku, 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(Math.round(pack.price * 100)), 'line_items[0][price_data][product_data][name]': 'Whackerang ' + pack.name, success_url: (env.WEB_URL || 'http://127.0.0.1') + '/?paid=1', cancel_url: (env.WEB_URL || 'http://127.0.0.1') + '/' });
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' }, body: p }); if (!r.ok) throw httpErr(502, 'stripe error'); send(res, 200, { url: (await r.json()).url });
    },
    // Stripe webhook: signature is verified against the RAW body. Credit happens only here, never from the browser.
    'POST /v1/stripe/webhook': async (req, res) => {
      const raw = await read(req, 256 * 1024); if (!verifyStripeSignature(raw, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)) throw httpErr(400, 'bad signature');
      const ev = JSON.parse(raw); if (ev.type === 'checkout.session.completed' && ev.data.object.payment_status === 'paid') { const o = ev.data.object; const a = ledger.account(o.client_reference_id); if (!a) throw httpErr(404, 'unknown account'); ledger.creditPurchase(a.id, { sku: o.metadata.sku, orderId: o.id, provider: 'stripe' }); }
      send(res, 200, { received: true });
    },
    // DEV ONLY: lets the test-mode client sync a fake purchase. Disabled unless DEV_MODE (default on locally).
    'POST /v1/dev/mock-purchase': async (req, res) => { if (!DEV) throw httpErr(404, 'not found'); const a = auth(req); const b = JSON.parse((await read(req)) || '{}'); const r = ledger.creditPurchase(a.id, { sku: b.sku, orderId: 'mock:' + (b.orderId || rid(6)), provider: 'mock' }); send(res, 200, { ...view(a), credited: r.duplicate ? 0 : r.gold }); },
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') return send(res, 204, {}); const ip = req.socket.remoteAddress; if (limited(ip)) throw httpErr(429, 'slow down');
      const key = req.method + ' ' + req.url.split('?')[0]; const h = routes[key]; if (!h) throw httpErr(404, 'not found'); await h(req, res);
    } catch (e) { send(res, e.status || (e instanceof SyntaxError ? 400 : 500), { error: e.status ? e.message : e instanceof SyntaxError ? 'bad json' : 'server error' }); if (!e.status && !(e instanceof SyntaxError)) console.error(e); }
  });
  return { server, store, ledger };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.env.PORT || 8787); const { server } = createServer(); server.listen(port, '127.0.0.1', () => console.log(`Whackerang ledger server (LOCAL DEV, not deployed) on http://127.0.0.1:${port}  DEV_MODE=${process.env.DEV_MODE !== '0'}`));
}
