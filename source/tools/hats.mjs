import fs from 'fs';
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 900, h: 600 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const hats = ['band', 'party', 'top', 'halo', 'flower', 'shades'];
const out = await page.evaluate((hats) => __bg.HEROES.map((h) => hats.map((ht) => __bg.snap(h, ht, { size: 220, rot: -0.25, expr: 'neutral' }))), hats);
const p2 = await browser.newPage(); await p2.setViewport({ width: 220 * hats.length, height: 220 * out.length });
await p2.setContent(`<body style="margin:0;background:#7aa0e0">${out.map((r) => `<div style="display:flex">${r.map((u) => `<img src="${u}" width=220 height=220>`).join('')}</div>`).join('')}</body>`); await p2.screenshot({ path: 'shots/hats.png' });
console.log(errors); await browser.close();
