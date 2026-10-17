import { build } from 'esbuild';
import fs from 'fs';
const alias = { three: new URL('./vendor/three/three.module.js', import.meta.url).pathname };
await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', outfile: 'bb.bundle.js', alias, minify: process.argv.includes('--min'), legalComments: 'none', define: { __BUILD__: JSON.stringify(process.env.BUILD || ('v1.0-' + new Date().toISOString().slice(0,16).replace(/[-:T]/g,''))) }, target: ['chrome90'], sourcemap: false });
const js = fs.readFileSync('bb.bundle.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('assets/font.css', 'utf8') + fs.readFileSync('style.css', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<!--STYLE-->[\s\S]*<!--\/STYLE-->/, () => `<style>\n${css}\n</style>`).replace(/<!--SCRIPT-->[\s\S]*<!--\/SCRIPT-->/, () => `<script>\n${js}\n</script>`);
fs.writeFileSync('BoomerangBrawl.html', html);
console.log('built', (js.length / 1024).toFixed(0) + 'KB js', (html.length / 1024).toFixed(0) + 'KB html');
// ---- PWA dist (web) and Capacitor www (native shell)
const BUILDTAG = process.env.BUILD || 'dev';
if (process.argv.includes('--dist')) {
  fs.rmSync('dist', { recursive: true, force: true }); fs.mkdirSync('dist/screenshots', { recursive: true }); fs.mkdirSync('dist/splash', { recursive: true });
  fs.copyFileSync('BoomerangBrawl.html', 'dist/index.html');
  fs.writeFileSync('dist/sw.js', fs.readFileSync('pwa/sw.template.js', 'utf8').replace(/__BUILD__/g, BUILDTAG));
  for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) fs.copyFileSync('pwa/' + f, 'dist/' + f);
  for (const f of fs.readdirSync('pwa/splash')) fs.copyFileSync('pwa/splash/' + f, 'dist/splash/' + f);
  for (const f of fs.readdirSync('pwa/screenshots')) fs.copyFileSync('pwa/screenshots/' + f, 'dist/screenshots/' + f);
  console.log('dist ready', BUILDTAG);
}
if (process.argv.includes('--app')) {
  fs.mkdirSync('mobile/www', { recursive: true }); fs.copyFileSync('BoomerangBrawl.html', 'mobile/www/index.html'); fs.copyFileSync('pwa/icon-192.png', 'mobile/www/icon-192.png'); console.log('mobile/www ready', BUILDTAG);
}
