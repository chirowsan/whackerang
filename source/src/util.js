// Arena size in cells (1 unit each). Live bindings: call setArenaSize() BEFORE building a Game.
export const SIZES = { small: { w: 20, h: 12, name: 'Small' }, large: { w: 26, h: 16, name: 'Large' }, huge: { w: 32, h: 20, name: 'Huge' } };
export let AW = 20, AH = 12, HX = 10, HZ = 6, ARENA_SIZE = 'small';
export function setArenaSize(id) { const z = SIZES[id] || SIZES.small; ARENA_SIZE = SIZES[id] ? id : 'small'; AW = z.w; AH = z.h; HX = AW / 2; HZ = AH / 2; }
export const arenaScale = () => [AW / 20, AH / 12];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = Math.random;
export const rr = (a, b) => a + Math.random() * (b - a);
export const ci = (x) => Math.floor(x + HX);      // world x -> cell i
export const cj = (z) => Math.floor(z + HZ);      // world z -> cell j
export const cx = (i) => i - HX + 0.5;            // cell i -> world x
export const cz = (j) => j - HZ + 0.5;
export const inb = (i, j) => i >= 0 && j >= 0 && i < AW && j < AH;
export const idx = (i, j) => j * AW + i;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
