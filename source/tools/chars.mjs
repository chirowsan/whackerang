// Close-up contact sheets of every fighter: node tools/chars.mjs tag [expr list] 
import fs from 'fs';
import { launch, sleep } from './lib.mjs';
const tag = process.argv[2] || 'ch'; const exprs = (process.argv[3] || 'happy').split(',');
const { browser, page, errors } = await launch({ w: 900, h: 600 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(2500);
const out = await page.evaluate((exprs) => {
  const r = {}; const hs = __bg.HEROES;
  for (const h of hs) { r[h.id] = []; for (const [rot, ex] of [[-0.35, exprs[0]], [0.9, exprs[0]], [3.1, exprs[0]]]) r[h.id].push(__bg.snap(h, 'none', { size: 360, rot, expr: ex })); for (const ex of exprs.slice(1)) r[h.id].push(__bg.snap(h, 'none', { size: 360, rot: -0.2, expr: ex })); }
  return r; }, exprs);
const html = (rows) => `<html><body style="margin:0;background:#6a8fd0">${rows}</body></html>`;
const rows = Object.entries(out).map(([id, arr]) => `<div style="display:flex;height:360px">${arr.map((u) => `<img src="${u}" width=360 height=360 style="background:#7aa0e0;margin:0 1px">`).join('')}</div>`).join('');
const p2 = await browser.newPage(); await p2.setViewport({ width: 360 * Math.max(3, exprs.length + 2) + 10, height: 360 }); 
const ids = Object.keys(out);
for (let i = 0; i < ids.length; i++) { const arr = out[ids[i]]; await p2.setContent(`<body style="margin:0;background:#7aa0e0;display:flex">${arr.map((u) => `<img src="${u}" width=360 height=360>`).join('')}</body>`); await p2.setViewport({ width: 360 * arr.length, height: 360 }); await p2.screenshot({ path: `shots/${tag}-${ids[i]}.png` }); }
console.log('ok', ids.join(','), errors);
await browser.close();
