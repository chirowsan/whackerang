// Whackerang brand art: renders master SVG layers at 1024 and writes PNGs to assets/brand/
import { launch } from './lib.mjs'; import fs from 'fs';
const star = (cx, cy, ro, ri, n, rot = 0) => { let p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? ri : ro; p.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1)); } return p.join(' '); };
const rays = (() => { let s = ''; for (let i = 0; i < 16; i++) { const a0 = i * Math.PI / 8, a1 = a0 + Math.PI / 16; s += `<polygon points="512,512 ${512 + Math.cos(a0) * 900},${512 + Math.sin(a0) * 900} ${512 + Math.cos(a1) * 900},${512 + Math.sin(a1) * 900}" fill="rgba(255,255,255,.07)"/>`; } return s; })();
const BG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><radialGradient id="g" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#7a35e0"/><stop offset=".55" stop-color="#3d1a8a"/><stop offset="1" stop-color="#150a33"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>${rays}</svg>`;
const FG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ffd23c"/><stop offset="1" stop-color="#ff9a1f"/></linearGradient></defs>
<g stroke-linejoin="round" stroke-linecap="round">
<polygon points="${star(512, 530, 300, 168, 10, -0.3)}" fill="#ff5a2e" stroke="#3b0f00" stroke-width="22"/>
<polygon points="${star(512, 530, 232, 130, 10, -0.3)}" fill="#ffd23c" stroke="#3b0f00" stroke-width="14"/>
<polygon points="${star(512, 530, 150, 84, 10, -0.3)}" fill="#fff8d8"/>
<path d="M 250 330 Q 300 760 512 720 Q 724 760 774 330" fill="none" stroke="#3b0f00" stroke-width="170"/>
<path d="M 250 330 Q 300 760 512 720 Q 724 760 774 330" fill="none" stroke="url(#y)" stroke-width="128"/>
<path d="M 262 350 Q 312 706 500 676" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="22"/>
<circle cx="250" cy="330" r="46" fill="#ff5a2e" stroke="#3b0f00" stroke-width="16"/><circle cx="774" cy="330" r="46" fill="#ff5a2e" stroke="#3b0f00" stroke-width="16"/>
<g fill="#3b0f00"><ellipse cx="452" cy="652" rx="22" ry="30"/><ellipse cx="572" cy="652" rx="22" ry="30"/></g><g fill="#fff"><circle cx="460" cy="640" r="9"/><circle cx="580" cy="640" r="9"/></g>
<path d="M 470 712 Q 512 746 554 712" fill="none" stroke="#3b0f00" stroke-width="14"/>
</g>
<g fill="#fff" stroke="#3b0f00" stroke-width="8"><polygon points="${star(790, 250, 46, 14, 4, 0)}"/><polygon points="${star(236, 560, 34, 11, 4, 0)}"/><polygon points="${star(820, 600, 28, 9, 4, 0)}"/></g></svg>`;
const { browser, page } = await launch({ w: 1024, h: 1024 });
const shot = async (svg, file, transparent) => { await page.setContent(`<body style="margin:0;background:${transparent ? 'transparent' : '#000'}"><div style="width:1024px;height:1024px">${svg}</div></body>`); await page.screenshot({ path: file, omitBackground: !!transparent, clip: { x: 0, y: 0, width: 1024, height: 1024 } }); };
await shot(BG, 'assets/brand/bg.png'); await shot(FG, 'assets/brand/fg.png', true);
await browser.close(); console.log('ok');
