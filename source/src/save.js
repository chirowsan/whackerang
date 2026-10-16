const KEY = 'boomerangbrawl.save.v1';
const defaults = () => ({
  coins: 0, hero: 'bao', hero2: 'nori', hats: { bao: 'none' }, unlockedHats: ['none'], unlockedHeroes: ['bao', 'nori', 'tako', 'kuma'], wins: 0, played: 0, kos: 0,
  settings: { sfx: 0.85, music: 0.5, shake: true, vibrate: true, quality: 'auto', touch: 'auto', leftHanded: false, ctrlScale: 1, aimAssist: true, bloom: true, hitstop: true, a2hs: false },
  setup: { bots: 3, diff: 1, arena: 'random', players: 1, rounds: 3 },
});
let data = defaults();
export function loadSave() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw), d = defaults(); data = { ...d, ...o, hats: { ...d.hats, ...(o.hats || {}) }, settings: { ...d.settings, ...(o.settings || {}) }, setup: { ...d.setup, ...(o.setup || {}) } }; } } catch (e) { data = defaults(); }
  return data;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
export const S = () => data;
export function resetSave() { data = defaults(); save(); return data; }
