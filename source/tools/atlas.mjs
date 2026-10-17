import fs from 'fs';
import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 900, h: 600 });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2000);
const id = process.argv[2] || 'panda';
const url = await page.evaluate((id) => __bg.faceAtlas(id), id);
fs.writeFileSync(`shots/atlas-${id}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(errors); await browser.close();
