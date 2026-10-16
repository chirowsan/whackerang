import { launch } from './lib.mjs'; import fs from 'fs';
const { browser, page } = await launch({ w: 600, h: 600 });
await page.setContent('<canvas id=c></canvas>');
for (const sz of [192, 512]) {
  const url = await page.evaluate((sz) => { const c = document.getElementById('c'); c.width = c.height = sz; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, sz, sz); g.addColorStop(0, '#3a1f7a'); g.addColorStop(1, '#1b1033'); x.fillStyle = g; x.fillRect(0, 0, sz, sz);
    x.save(); x.translate(sz / 2, sz / 2); const k = sz / 512; x.scale(k, k); x.lineCap = 'round'; x.lineJoin = 'round';
    const path = () => { x.beginPath(); x.moveTo(-175, -95); x.quadraticCurveTo(-120, 120, 0, 105); x.quadraticCurveTo(120, 120, 175, -95); };
    x.strokeStyle = '#4a1d00'; x.lineWidth = 104; path(); x.stroke(); x.strokeStyle = '#ffd23c'; x.lineWidth = 78; path(); x.stroke(); x.strokeStyle = '#fff3b0'; x.lineWidth = 18; x.save(); x.translate(-6, -14); path(); x.stroke(); x.restore();
    x.fillStyle = '#ff7a3a'; x.beginPath(); x.arc(-150, -80, 20, 0, 7); x.fill(); x.beginPath(); x.arc(150, -80, 20, 0, 7); x.fill(); x.restore();
    x.fillStyle = '#fff'; x.font = '900 ' + sz * 0.11 + 'px system-ui'; x.textAlign = 'center'; x.fillText('BRAWL', sz / 2, sz * 0.93); return c.toDataURL('image/png'); }, sz);
  fs.writeFileSync(`icon-${sz}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
