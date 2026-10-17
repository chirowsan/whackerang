const KEY = 'whackerang.save.v1', OLDKEY = 'boomerangbrawl.save.v1';
const defaults = () => ({
  coins: 0, hero: 'bao', hero2: 'nori', hats: { bao: 'none' }, unlockedHats: ['none'], unlockedHeroes: ['bao', 'nori', 'tako', 'kuma'], wins: 0, played: 0, kos: 0,
  settings: { sfx: 0.85, music: 0.5, shake: true, vibrate: true, quality: 'sharp', touch: 'auto', leftHanded: false, ctrlScale: 1, aimAssist: true, bloom: true, hitstop: true, a2hs: false, autoFs: true, events: 'some', flash: true, mute: false },
  setup: { bots: 3, diff: 1, arena: 'random', players: 1, rounds: 3, mode: 'classic', size: 'small', traps: 'some', mutator: 'off' },
  // v2.0
  xp: 0, totalCoins: 0, tutorialDone: false,
  own: { types: ['classic'], trails: ['none'], skins: ['default'], emotes: ['gg', 'nice', 'oops', 'wow'] },
  eq: { type: 'classic', trail: 'none', skin: 'default', emotes: ['gg', 'nice', 'oops', 'wow'] },
  stats: { ko: 0, catch: 0, deflect: 0, win: 0, play: 0, wave: 0, kothwin: 0, bombwin: 0, teamwin: 0, boss: 0, shatter: 0, chainko: 0, ult: 0, stars: 0, level: 1, throw: 0, dash: 0 },
  ach: {}, daily: { date: '', list: [], prog: {}, claimed: {} },
  camp: { stars: [], best: {} }, best: { survival: 0, koth: 0 },
});
const migQ = (q) => (q === 'sharp' || q === 'balanced' || q === 'fast' ? q : q === 'low' ? 'fast' : q === 'medium' || q === 'high' ? 'balanced' : 'sharp');
let data = defaults();
const merge = (d, o) => { // shallow-per-key merge for the nested v2 objects so old saves gain new keys
  const r = { ...d, ...o };
  for (const k of ['hats', 'settings', 'setup', 'own', 'eq', 'stats', 'ach', 'daily', 'camp', 'best']) r[k] = { ...d[k], ...((o && o[k]) || {}) };
  if (typeof r.settings.events !== 'string') r.settings.events = 'some';
  r.settings.quality = migQ((o && o.settings || {}).quality); if (!Array.isArray(r.eq.emotes)) r.eq.emotes = d.eq.emotes;
  for (const k of Object.keys(d.own)) if (!Array.isArray(r.own[k])) r.own[k] = d.own[k];
  return r;
};
export function loadSave() {
  try { const raw = localStorage.getItem(KEY) || localStorage.getItem(OLDKEY); if (raw) data = merge(defaults(), JSON.parse(raw)); } catch (e) { data = defaults(); }
  return data;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
export const S = () => data;
export function resetSave() { data = defaults(); save(); return data; }
