import { KIDS } from './flags.js';
import { wpnFor, migrateOld } from './weapons.js';
const KEY = 'whackerang.save.v1', OLDKEY = 'boomerangbrawl.save.v1';
const defaults = () => ({
  coins: 0, hero: 'bao', hero2: 'nori', hats: { bao: 'none' }, unlockedHats: ['none'], unlockedHeroes: ['bao', 'nori', 'tako', 'kuma'], wins: 0, played: 0, kos: 0,
  settings: { autoMatch: !KIDS, autoMode: 'classic', speed: 'chill', speedMig: 31, sfx: 0.85, music: 0.6, musicOn: true, master: 1, camera: 'close', shake: true, shakeLvl: 'full', vibrate: true, quality: 'sharp', touch: 'auto', leftHanded: false, ctrlScale: 1, aimAssist: true, bloom: true, hitstop: true, a2hs: false, autoFs: true, events: 'some', flash: true, mute: false, edgeHelp: true, netDiag: false },
  setup: { bots: 3, diff: 1, arena: 'random', players: 1, rounds: 3, mode: 'classic', size: 'large', sizeMig: 47, traps: 'some', mutator: 'off' },
  // v2.0
  xp: 0, totalCoins: 0, tutorialDone: false,
  own: { types: ['classic'], trails: ['none'], skins: ['default'], emotes: ['gg', 'nice', 'oops', 'wow'] },
  wpn: ['boom', 'boom'], // v4.10 Armory: equipped weapon per local player slot (P1, P2), validated on use
  loadout: [{}, {}], // v4.11: per local player slot, per character: { heroId: weaponId } (validated against that character's own list)
  eq: { type: 'classic', trail: 'none', skin: 'default', emotes: ['gg', 'nice', 'oops', 'wow'] },
  stats: { ko: 0, catch: 0, deflect: 0, win: 0, play: 0, wave: 0, kothwin: 0, bombwin: 0, teamwin: 0, boss: 0, shatter: 0, chainko: 0, ult: 0, stars: 0, level: 1, throw: 0, dash: 0 },
  ach: {}, daily: { date: '', list: [], prog: {}, claimed: {} },
  camp: { stars: [], best: {} }, best: { survival: 0, koth: 0 },
});
const migQ = (q) => (q === 'sharp' || q === 'balanced' || q === 'fast' ? q : q === 'low' ? 'fast' : q === 'medium' || q === 'high' ? 'balanced' : 'sharp');
// Game speed: a single global time scale applied to the whole simulation (players, dash, boomerangs, bots, traps, round timers).
// 'fast' is exactly the v3.0 pace. catch = boomerang catch-radius multiplier, camWide = follow-camera zoom-out on big maps.
export const SPEEDS = { chill: { name: 'Chill', ts: 0.62, catch: 1.35, camWide: 1.12, ease: 1 }, normal: { name: 'Normal', ts: 0.8, catch: 1.18, camWide: 1.05, ease: 0.6 }, fast: { name: 'Fast', ts: 1, catch: 1, camWide: 1, ease: 0 } };
let data = defaults();
const merge = (d, o) => { // shallow-per-key merge for the nested v2 objects so old saves gain new keys
  const r = { ...d, ...o };
  for (const k of ['hats', 'settings', 'setup', 'own', 'eq', 'stats', 'ach', 'daily', 'camp', 'best']) r[k] = { ...d[k], ...((o && o[k]) || {}) };
  if (typeof r.settings.events !== 'string') r.settings.events = 'some';
  // v3.1: one-time migration -> everyone starts on the calmer Chill speed with the wider aim assist (can be changed afterwards in Settings)
  if (!SPEEDS[r.settings.speed] || (o && o.settings ? o.settings.speedMig !== 31 : false)) { r.settings.speed = 'chill'; r.settings.aimAssist = true; }
  if (!['off', 'low', 'full'].includes(r.settings.shakeLvl)) r.settings.shakeLvl = r.settings.shake === false ? 'off' : 'full'; r.settings.shake = r.settings.shakeLvl !== 'off';
  if (typeof r.settings.musicOn !== 'boolean') r.settings.musicOn = true; if (typeof r.settings.master !== 'number') r.settings.master = 1; if (!['close', 'wide'].includes(r.settings.camera)) r.settings.camera = 'close';
  // v4.7: default map size is now Large (the middle size). One-time switch for saves whose size was never picked by the player (sizeSet is set when they tap Map size)
  { const os = (o && o.setup) || {}; if (!os.sizeSet && os.sizeMig !== 47) r.setup.size = 'large'; } r.setup.sizeMig = 47; if (!['small', 'large', 'huge'].includes(r.setup.size)) r.setup.size = 'large';
  r.settings.speedMig = 31; if (typeof r.settings.touchSmooth !== 'boolean') r.settings.touchSmooth = true;
  r.settings.quality = migQ((o && o.settings || {}).quality); if (!Array.isArray(r.eq.emotes)) r.eq.emotes = d.eq.emotes;
  for (const k of Object.keys(d.own)) if (!Array.isArray(r.own[k])) r.own[k] = d.own[k];
  // v4.11: one-time move from the v4.10 global P1/P2 weapon to the per-character loadout (only for the character each slot had selected)
  if (!o || !Array.isArray(o.loadout) || o.loadout.length !== 2) { r.loadout = [{}, {}]; const ow = (o && Array.isArray(o.wpn)) ? o.wpn : null; if (ow) { r.loadout[0][r.hero] = migrateOld(r.hero, ow[0]); r.loadout[1][r.hero2] = migrateOld(r.hero2, ow[1]); } }
  for (const L of r.loadout) { if (!L || typeof L !== 'object') continue; for (const h of Object.keys(L)) L[h] = wpnFor(h, L[h]); }
  return r;
};
export function loadSave() {
  try { const raw = localStorage.getItem(KEY) || localStorage.getItem(OLDKEY); if (raw) { const o = JSON.parse(raw); const mig = !o || !o.settings || o.settings.speedMig !== 31 || !o.setup || o.setup.sizeMig !== 47; data = merge(defaults(), o); if (mig) save(); } } catch (e) { data = defaults(); }
  return data;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
export const S = () => data;
// v4.11 per-character loadout (slot 0 = P1, 1 = P2). Always returns a weapon that belongs to that character.
export const getWpn = (slot, hero) => { const L = (data.loadout || [])[slot ? 1 : 0] || {}; return wpnFor(hero, L[hero]); };
export const setWpn = (slot, hero, id) => { if (!Array.isArray(data.loadout)) data.loadout = [{}, {}]; data.loadout[slot ? 1 : 0][hero] = wpnFor(hero, id); save(); };
export const speedCfg = () => SPEEDS[data.settings.speed] || SPEEDS.chill;
export function resetSave() { data = defaults(); save(); return data; }
