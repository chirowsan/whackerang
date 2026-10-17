import fs from 'fs';
import { launch, sleep } from './lib.mjs';
const tag = process.argv[2] || 'po';
const { browser, page, errors } = await launch({ w: 900, h: 600 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
const P = [['win', { win: true, t: 0.45 }], ['charge', { charge: 1, move: 0.3, t: 1 }], ['throw', { throwT: 0.7, t: 1 }], ['dash', { dash: 0.8, move: 1, t: 1 }], ['ko', { dead: true, t: 0.2 }], ['run', { move: 1, t: 0.33 }]];
const out = await page.evaluate((P) => __bg.HEROES.map((h) => P.map(([n, st]) => __bg.snap(h, 'none', { size: 300, rot: n === 'run' || n === 'dash' ? 0.8 : -0.3, expr: null, st }))), P);
const p2 = await browser.newPage(); await p2.setViewport({ width: 300 * P.length, height: 300 });
for (let i = 0; i < out.length; i++) { await p2.setContent(`<body style="margin:0;background:#7aa0e0;display:flex">${out[i].map((u) => `<img src="${u}" width=300 height=300>`).join('')}</body>`); await p2.screenshot({ path: `shots/${tag}-${i}.png` }); }
console.log(errors); await browser.close();
