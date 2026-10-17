import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, loadCatalog } from './server.mjs';
import { signStripe, verifyStripeSignature } from './lib.mjs';

const SECRET = 'whsec_test_123';
async function boot() {
  const { server, ledger, store } = createServer({ dataFile: null, env: { DEV_MODE: '1', PLAY_VERIFY: 'mock', STRIPE_WEBHOOK_SECRET: SECRET }, catalog: loadCatalog() });
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token, headers = {}) => { const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  return { server, ledger, store, call, close: () => server.close() };
}

test('accounts, earn rules, caps and idempotency', async () => {
  const t = await boot(); const cat = loadCatalog();
  const acc = (await t.call('POST', '/v1/accounts')).body; assert.ok(acc.token.startsWith('wk_'));
  assert.equal((await t.call('GET', '/v1/me')).status, 401);
  assert.equal((await t.call('GET', '/v1/me', undefined, acc.token)).body.gold, 0);
  let r = await t.call('POST', '/v1/earn', { event: 'win', ref: 'match-0001' }, acc.token); assert.equal(r.body.gold, 30);
  r = await t.call('POST', '/v1/earn', { event: 'win', ref: 'match-0001' }, acc.token); assert.equal(r.body.gold, 30); assert.equal(r.body.duplicate, true); // replay is a no-op
  assert.equal((await t.call('POST', '/v1/earn', { event: 'jackpot', ref: 'abcdefg' }, acc.token)).status, 400);
  assert.equal((await t.call('POST', '/v1/earn', { event: 'level', ref: 'lvl-000002', amount: 999999 }, acc.token)).status, 400); // client cannot name its own price
  for (let i = 0; i < 19; i++) await t.call('POST', '/v1/earn', { event: 'win', ref: 'm-' + i + '-xxxx' }, acc.token);
  assert.equal((await t.call('POST', '/v1/earn', { event: 'win', ref: 'm-over-xxxx' }, acc.token)).status, 429); // per-day cap
  assert.equal(t.ledger.verifyChain(acc.accountId).ok, true);
  t.close();
});

test('spend: price comes from the server catalog, no negative balance, no double buy', async () => {
  const t = await boot(); const acc = (await t.call('POST', '/v1/accounts')).body;
  assert.equal((await t.call('POST', '/v1/spend', { itemId: 'skins:gold' }, acc.token)).status, 402);
  for (let i = 0; i < 10; i++) await t.call('POST', '/v1/earn', { event: 'win', ref: 'w-' + i + '-xxxx' }, acc.token); // 300 gold
  let r = await t.call('POST', '/v1/spend', { itemId: 'skins:gold' }, acc.token); assert.equal(r.status, 200); assert.equal(r.body.gold, 100); assert.ok(r.body.entitlements.includes('skins:gold'));
  assert.equal((await t.call('POST', '/v1/spend', { itemId: 'skins:gold' }, acc.token)).status, 409);
  assert.equal((await t.call('POST', '/v1/spend', { itemId: 'skins:nope' }, acc.token)).status, 400);
  t.close();
});

test('google play verification (mock verifier) credits once per purchase token', async () => {
  const t = await boot(); const acc = (await t.call('POST', '/v1/accounts')).body; const sku = 'whackerang.gold.500';
  assert.equal((await t.call('POST', '/v1/play/verify', { productId: sku, purchaseToken: 'forged-token-1' }, acc.token)).status, 402);
  let r = await t.call('POST', '/v1/play/verify', { productId: sku, purchaseToken: 'TEST-token-aaaaaaaa' }, acc.token); assert.equal(r.status, 200); assert.equal(r.body.credited, 750); // 500 + 50% first-purchase bonus
  r = await t.call('POST', '/v1/play/verify', { productId: sku, purchaseToken: 'TEST-token-aaaaaaaa' }, acc.token); assert.equal(r.body.duplicate, true); assert.equal(r.body.gold, 750);
  r = await t.call('POST', '/v1/play/verify', { productId: sku, purchaseToken: 'TEST-token-bbbbbbbb' }, acc.token); assert.equal(r.body.credited, 500); // bonus only the first time
  assert.equal((await t.call('POST', '/v1/play/verify', { productId: sku, packageName: 'evil.app', purchaseToken: 'TEST-x-cccccccc' }, acc.token)).status, 400);
  t.close();
});

test('stripe webhook: valid signature credits, bad/old signature rejected, replay is idempotent', async () => {
  const t = await boot(); const acc = (await t.call('POST', '/v1/accounts')).body; const sku = 'whackerang.gold.2800';
  const ev = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', client_reference_id: acc.accountId, metadata: { sku } } } });
  assert.equal((await t.call('POST', '/v1/stripe/webhook', ev, null, { 'stripe-signature': 't=1,v1=deadbeef' })).status, 400);
  assert.equal((await t.call('POST', '/v1/stripe/webhook', ev, null, { 'stripe-signature': signStripe(ev, 'wrong-secret') })).status, 400);
  assert.equal((await t.call('POST', '/v1/stripe/webhook', ev, null, { 'stripe-signature': signStripe(ev, SECRET, Math.floor(Date.now() / 1000) - 3600) })).status, 400); // too old
  assert.equal((await t.call('POST', '/v1/stripe/webhook', ev, null, { 'stripe-signature': signStripe(ev, SECRET) })).status, 200);
  assert.equal((await t.call('POST', '/v1/stripe/webhook', ev, null, { 'stripe-signature': signStripe(ev, SECRET) })).status, 200);
  assert.equal((await t.call('GET', '/v1/me', undefined, acc.token)).body.gold, 4200); // 2800 * 1.5 once
  assert.equal(verifyStripeSignature(ev, signStripe(ev, SECRET), SECRET), true);
  t.close();
});

test('ledger is tamper-evident: editing a saved balance is detected', async () => {
  const t = await boot(); const acc = (await t.call('POST', '/v1/accounts')).body;
  await t.call('POST', '/v1/earn', { event: 'win', ref: 'tamper-0001' }, acc.token); await t.call('POST', '/v1/earn', { event: 'play', ref: 'tamper-0002' }, acc.token);
  assert.equal((await t.call('GET', '/v1/me/ledger/verify', undefined, acc.token)).body.ok, true);
  t.store.db.ledger[acc.accountId][1].delta = 5000; t.store.db.ledger[acc.accountId][1].balance = 5030; // simulate someone editing the database
  const v = (await t.call('GET', '/v1/me/ledger/verify', undefined, acc.token)).body; assert.equal(v.ok, false); assert.equal(v.badSeq, 2);
  t.close();
});

test('dev mock purchase is disabled when DEV_MODE=0', async () => {
  const { server } = createServer({ dataFile: null, env: { DEV_MODE: '0' }, catalog: loadCatalog() }); await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  const a = await (await fetch(base + '/v1/accounts', { method: 'POST' })).json(); const r = await fetch(base + '/v1/dev/mock-purchase', { method: 'POST', headers: { authorization: 'Bearer ' + a.token }, body: '{"sku":"whackerang.gold.500"}' }); assert.equal(r.status, 404); server.close();
});
