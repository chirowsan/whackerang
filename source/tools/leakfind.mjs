// find which geometries/textures are uploaded but never disposed across restarts (dev build). usage: node tools/leakfind.mjs [arena]
import { launch, sleep } from './lib.mjs';
const arena = process.argv[2] || 'haunted';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true });
await page.goto('file:///workspace/boomerang-brawl/Whackerang.html'); await sleep(2500);
await page.evaluate(() => {
  const T = __bg.THREE; window.__G = new Set(); window.__X = new Set();
  const gp = T.BufferGeometry.prototype, ga = gp.addEventListener; gp.addEventListener = function (t, f) { if (t === 'dispose' && f && f.name === 'onGeometryDispose') { __G.add(this); } return ga.call(this, t, f); };
  const tp = T.Texture.prototype, ta = tp.addEventListener; tp.addEventListener = function (t, f) { if (t === 'dispose' && f && f.name === 'onTextureDispose') { __X.add(this); } return ta.call(this, t, f); };
  const gd = gp.dispose; gp.dispose = function () { __G.delete(this); return gd.call(this); }; const td = tp.dispose; tp.dispose = function () { __X.delete(this); return td.call(this); };
  window.__live = () => { const sg = new Set(), sx = new Set(); __bg.gfx.scene.traverse((o) => { if (o.geometry) sg.add(o.geometry); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { for (const k in m) if (m[k] && m[k].isTexture) sx.add(m[k]); if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) sx.add(v); } } }); return [sg, sx]; };
  window.__rep = () => { const [sg, sx] = __live(); const out = { geo: {}, tex: {} }; for (const g of __G) if (!sg.has(g)) { const k = g.type + ':' + (g.attributes.position ? g.attributes.position.count : 0); out.geo[k] = (out.geo[k] || 0) + 1; } for (const x of __X) if (!sx.has(x)) { const k = (x.isCanvasTexture ? 'canvas' : x.isDataTexture ? 'data' : x.isRenderTargetTexture ? 'rt' : x.isCompressedTexture ? 'cmp' : 'tex') + ':' + (x.image && x.image.width) + 'x' + (x.image && x.image.height) + ':' + (x.name || '') + ':' + (x.image && x.image.constructor && x.image.constructor.name); out.tex[k] = (out.tex[k] || 0) + 1; } return out; };
});
await page.evaluate((a) => { const s = __bg.S(); s.tutorialDone = true; s.setup.arena = a; s.setup.size = 'large'; s.setup.traps = 'some'; s.setup.bots = 3; __bg.app.startMode('classic'); }, arena); await sleep(2500);
const r0 = await page.evaluate(() => ({ mem: { g: __bg.gfx.renderer.info.memory.geometries, t: __bg.gfx.renderer.info.memory.textures }, rep: __rep() }));
for (let i = 0; i < 3; i++) { await page.evaluate(() => __bg.app.restartRound()); await sleep(2500); }
const r1 = await page.evaluate(() => ({ mem: { g: __bg.gfx.renderer.info.memory.geometries, t: __bg.gfx.renderer.info.memory.textures }, rep: __rep() }));
console.log('before', JSON.stringify(r0.mem), 'after 3 restarts', JSON.stringify(r1.mem)); console.log('orphan geo (type:verts) before', JSON.stringify(r0.rep.geo)); console.log('orphan geo after', JSON.stringify(r1.rep.geo)); console.log('orphan tex before', JSON.stringify(r0.rep.tex)); console.log('orphan tex after', JSON.stringify(r1.rep.tex)); console.log(errors.slice(0, 2)); await browser.close();
