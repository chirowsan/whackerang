import { launch, sleep } from './lib.mjs';
const arena = process.argv[2] || 'dojo';
const { browser, page, errors } = await launch({ w: 915, h: 330, dpr: 2, mobile: true });
await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2500);
await page.evaluate((a) => { const s = __bg.S(); s.setup.arena = a; s.setup.bots = 3; __bg.app.startMatch(); }, arena); await sleep(1500);
console.log(await page.evaluate(() => { const sc = __bg.gfx.scene; const out = []; let total = 0; const vis = (o) => { let n = 0; o.traverse((c) => { if ((c.isMesh || c.isSprite || c.isLine || c.isPoints) && c.visible) { let v = true, p = c.parent; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) n++; } }); return n; };
  sc.children.forEach((c, i) => { const n = vis(c); total += n; out.push(`${i} ${c.type} ${c.name || ''} ${c.isInstancedMesh ? 'inst' : ''} meshes=${n}`); }); __bg.renderNow(); const r = __bg.gfx.renderer.info.render; return out.join('\n') + `\ntotal=${total} calls=${r.calls} tris=${r.triangles}`; }));
await browser.close();
