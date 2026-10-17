// Builds server/catalog.json from the game's own data so client and server prices cannot drift apart.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const out = path.join(root, 'server', 'data', '_catalog_bundle.mjs'); fs.mkdirSync(path.dirname(out), { recursive: true });
await build({ stdin: { contents: "export * from '../../src/data.js'; export { PACKS, STARTER, FIRST_BUY_BONUS } from '../../src/purchase.js';", resolveDir: path.join(root, 'server', 'data') }, bundle: true, format: 'esm', platform: 'node', outfile: out, external: ['three'], logLevel: 'error', define: { 'import.meta.env': '{}' }, banner: { js: 'globalThis.localStorage = { getItem() {}, setItem() {} };' } });
const m = await import(pathToFileURL(out).href);
const items = {}; const add = (cat, obj) => { for (const [id, v] of Object.entries(obj)) if (v.cost) items[`${cat}:${id}`] = { cat, id, cost: v.cost, premium: !!v.premium }; };
add('types', m.BOOM_TYPES); add('trails', m.TRAILS); add('skins', m.SKINS); add('emotes', m.EMOTES); for (const h of m.HATS) if (h.cost) items[`hats:${h.id}`] = { cat: 'hats', id: h.id, cost: h.cost, premium: !!h.premium }; for (const h of m.HEROES) if (h.cost) items[`heroes:${h.id}`] = { cat: 'heroes', id: h.id, cost: h.cost };
const packs = {}; for (const p of [...m.PACKS, m.STARTER]) packs[p.sku] = { id: p.id, name: p.name, price: p.price, gold: p.gold, oneTime: !!p.oneTime, items: (p.items || []).map((i) => `${i.cat}:${i.id}`) };
fs.writeFileSync(path.join(root, 'server', 'catalog.json'), JSON.stringify({ packageName: 'com.chirow.whackerang', firstBuyBonus: m.FIRST_BUY_BONUS, items, packs }, null, 1)); fs.rmSync(out); console.log('catalog:', Object.keys(items).length, 'items,', Object.keys(packs).length, 'packs');
