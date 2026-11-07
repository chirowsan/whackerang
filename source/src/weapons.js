// v4.10 Armory: the boomerang plus three original returning weapons. Every weapon deals one normal heart (throw or swing);
// they differ only in flight speed / hit size / curve and in the close-range swing's reach / arc / timing. All numbers live here.
// Throw: v = flight speed, hitR = hit-radius factor, tout = how long it flies out, curve = how hard it bends, cd = extra pause after a throw (s).
// Swing (melee): arc = full cone in degrees, reach = world units past the body edge, wind = wind-up, act = active hit frames,
//   rec = recovery (no move-cancel into another swing), cd = time from swing start until the next swing.
// v4.11: weapons are per character. Each fighter has its own three themed weapons (no shared list); 'boom' is only the base
// boomerang used by bosses / minions and boomerang-only rooms. form = mesh + icon family; pat = swing pattern:
//   arc (cone), poke (narrow long thrust), lunge (steps forward hard during the wind-up), spin (full 360, short reach).
// fx (throw) / mfx (swing): home = gentle homing turn rate (rad/s), pierce = passes through rivals, stun / chill = seconds on a hit.
// Every hit is still exactly one normal heart.
const M = (arc, reach, wind, act, rec, cd, pat = 'arc') => ({ arc, reach, wind, act, rec, cd, pat });
const T = (v, hitR, tout, curve, cd = 0) => ({ v, hitR, tout, curve, cd });
const D = (name, form, col, blurb, t, m, fx = {}, mfx = {}) => ({ name, form, icon: form, col, blurb, ...t, melee: m, fx, mfx });
export const WEAPONS = {
  boom: D('Boomerang', 'boom', 0xffd060, 'Balanced all-rounder.', T(1, 1, 1, 1), M(100, 1.3, 0.12, 0.08, 0.22, 0.42)),
  // Bao, Panda Chef (4 hearts, regenerates): kitchen tools, slow and sturdy
  bao_wok: D('Iron Wok', 'pan', 0x55565f, 'Huge flat sweep and a big, slow throw.', T(0.82, 1.3, 0.9, 0.7, 0.15), M(150, 1.3, 0.16, 0.1, 0.28, 0.56)),
  bao_cleaver: D('Cleaver', 'blade', 0xd8dde6, 'Straight, fast chop: narrow but long.', T(1.15, 0.75, 0.85, 0.5), M(50, 1.5, 0.1, 0.07, 0.2, 0.4, 'poke')),
  bao_pin: D('Rolling Pin', 'mallet', 0xd9a066, 'Rolls forward: a lunging bonk.', T(0.9, 1.1, 1, 0.9), M(90, 1.15, 0.14, 0.09, 0.26, 0.5, 'lunge')),
  // Nori, Ninja Fox (2 hearts, long dodge): quick and sneaky
  nori_shuriken: D('Shuriken', 'star', 0xa6b0c4, 'Fastest, straightest throw. Tiny, very quick slash.', T(1.3, 0.65, 0.8, 0.35), M(60, 1.0, 0.06, 0.06, 0.14, 0.28)),
  nori_kama: D('Kama', 'hook', 0xd8283c, 'Big hooking curve and a broad sickle sweep.', T(0.95, 1, 1.15, 1.7), M(140, 1.2, 0.12, 0.09, 0.22, 0.44)),
  nori_tanto: D('Tanto', 'blade', 0x2b2b3a, 'Short throw. Dash-stab lunge.', T(1.1, 0.7, 0.7, 0.8), M(60, 1.1, 0.08, 0.07, 0.2, 0.36, 'lunge')),
  // Bolt, Tiny Robot (charged throws stun): gadgets
  tako_wrench: D('Wrench', 'wrench', 0xb8c4d0, 'Heavy clonk that briefly stuns. Slow recovery.', T(0.85, 1.2, 0.95, 0.8, 0.15), M(100, 1.4, 0.18, 0.1, 0.3, 0.6), {}, { stun: 0.3 }),
  tako_magnet: D('Magnet Disc', 'disc', 0xff4a4a, 'Throw gently homes in on the nearest rival.', T(0.9, 0.9, 1.05, 0.6), M(80, 1.1, 0.1, 0.08, 0.2, 0.4), { home: 1.6 }),
  tako_drone: D('Rotor Drone', 'boom', 0x59c2ff, 'Long looping flight. Spinning 360 swing.', T(1.05, 1, 1.2, 1.3), M(360, 0.95, 0.12, 0.12, 0.26, 0.58, 'spin')),
  // Salty, Cat Pirate (nine lives): ship gear
  kuma_anchor: D('Anchor', 'anchor', 0x5a6478, 'Heavy spin around you. Slow, short throw.', T(0.78, 1.4, 0.85, 0.6, 0.25), M(360, 1.25, 0.22, 0.12, 0.32, 0.7, 'spin')),
  kuma_hook: D('Hook Hand', 'hook', 0xe8b23a, 'Wide hooking curve, broad swipe.', T(0.95, 1.05, 1.1, 1.5), M(120, 1.3, 0.13, 0.09, 0.24, 0.46)),
  kuma_cutlass: D('Cutlass', 'blade', 0xe8e0c8, 'Boarding lunge with a curved blade.', T(1.1, 0.8, 0.9, 0.9), M(80, 1.25, 0.1, 0.08, 0.22, 0.42, 'lunge')),
  // Pico, Lizard Monk (long reach): calm, precise
  pico_staff: D('Bo Staff', 'staff', 0x9a6a3a, 'Longest poke in the game. Straight throw.', T(1, 0.9, 1.1, 0.5), M(40, 1.85, 0.14, 0.09, 0.26, 0.5, 'poke')),
  pico_chakram: D('Chakram', 'ring', 0xff9a2e, 'Throw pierces through rivals.', T(1, 0.85, 1.05, 1.1), M(90, 1.1, 0.1, 0.08, 0.22, 0.42), { pierce: 1 }),
  pico_jade: D('Jade Boomerang', 'boom', 0x5fd16b, 'Calm boomerang that drifts toward rivals.', T(0.95, 1, 1, 1), M(100, 1.2, 0.12, 0.08, 0.22, 0.44), { home: 1.0 }),
  // Yuki, Penguin Samurai (hits chill): blades and ice
  yuki_katana: D('Katana', 'blade', 0xe8f4ff, 'Fast, clean cut with good reach.', T(1.15, 0.7, 0.9, 0.6), M(90, 1.45, 0.09, 0.07, 0.2, 0.38)),
  yuki_icicle: D('Icicle', 'icicle', 0x9ad8ff, 'Fast spike that pierces. Narrow poke.', T(1.25, 0.7, 0.8, 0.3), M(45, 1.35, 0.1, 0.07, 0.2, 0.4, 'poke'), { pierce: 1 }),
  yuki_snow: D('Snow Disc', 'disc', 0xeaf6ff, 'Wide sliding curve. Spinning skate swing.', T(0.9, 1.15, 1.15, 1.6), M(360, 0.95, 0.1, 0.1, 0.24, 0.52, 'spin')),
  // Gus, Hippo Wrestler (heavyweight): gym gear
  gus_dumbbell: D('Dumbbell', 'bell', 0x6a6a7a, 'Charging lunge that stuns. Very slow.', T(0.75, 1.4, 0.9, 0.7, 0.25), M(110, 1.3, 0.2, 0.1, 0.32, 0.66, 'lunge'), {}, { stun: 0.3 }),
  gus_belt: D('Title Belt', 'ring', 0xffc23a, 'Spin-whip all around. Curving throw.', T(0.95, 1.1, 1, 1.2), M(360, 1.15, 0.14, 0.12, 0.28, 0.6, 'spin')),
  gus_kettle: D('Kettlebell', 'orb', 0x3a3a44, 'Short heavy throw that stuns.', T(0.8, 1.25, 0.7, 0.4, 0.2), M(100, 1.2, 0.16, 0.09, 0.26, 0.54), { stun: 0.35 }),
  // Wisp, Ghost Apprentice (hovers): spooky lights
  wisp_lantern: D('Lantern', 'orb', 0x6ff0ff, 'Slow ghost light that homes in.', T(0.85, 1, 1.2, 0.8), M(90, 1.1, 0.12, 0.08, 0.22, 0.44), { home: 2.0 }),
  wisp_sickle: D('Spirit Sickle', 'hook', 0xc8b8ff, 'Strongest curve. Quick wide reap.', T(1.05, 0.85, 1.1, 1.8), M(130, 1.2, 0.1, 0.08, 0.2, 0.4)),
  wisp_will: D('Will-o-Ring', 'ring', 0x8ffcff, 'Fast straight ring. Spin swing.', T(1.25, 0.8, 0.9, 0.4), M(360, 1.0, 0.1, 0.1, 0.24, 0.5, 'spin')),
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const HERO_WPN = { bao: ['bao_wok', 'bao_cleaver', 'bao_pin'], nori: ['nori_shuriken', 'nori_kama', 'nori_tanto'], tako: ['tako_wrench', 'tako_magnet', 'tako_drone'], kuma: ['kuma_anchor', 'kuma_hook', 'kuma_cutlass'],
  pico: ['pico_staff', 'pico_chakram', 'pico_jade'], yuki: ['yuki_katana', 'yuki_icicle', 'yuki_snow'], gus: ['gus_dumbbell', 'gus_belt', 'gus_kettle'], wisp: ['wisp_lantern', 'wisp_sickle', 'wisp_will'] };
export const heroWeapons = (hero) => HERO_WPN[hero] || ['boom'];
export const wpnOf = (id) => (WEAPONS[id] ? id : 'boom'); // unknown / missing ids fall back to the base boomerang
// character-legal weapon: anything not in this hero's own list (other hero's weapon, v4.10 global id, junk) -> the hero's first weapon
export const wpnFor = (hero, id) => { const L = heroWeapons(hero); return L.includes(id) ? id : L[0]; };
// v4.10 global ids -> the same family inside a hero's own list (one-time save migration)
const OLDFORM = { boom: 'boom', disc: 'disc', hook: 'hook', mallet: 'mallet' };
export const migrateOld = (hero, old) => { const L = heroWeapons(hero); const f = OLDFORM[old]; return (f && L.find((id) => WEAPONS[id].form === f)) || L[0]; };
// wire: weapon as 0 = base boomerang, 1..3 = index in the owner's own list (fits the v4.10 4-bit slot)
export const wpnCode = (hero, id) => { const i = heroWeapons(hero).indexOf(id); return i >= 0 && HERO_WPN[hero] ? i + 1 : 0; };
export const wpnDecode = (hero, c) => (c > 0 && HERO_WPN[hero] && HERO_WPN[hero][c - 1]) || 'boom';
export const W = (id) => WEAPONS[wpnOf(id)];
export const PAT_LABEL = { arc: 'Sweep', poke: 'Thrust', lunge: 'Lunge', spin: 'Spin 360' };
// relative 1-5 bars for the Armory card (derived, never hand-typed twice)
export function weaponBars(id) {
  const w = W(id), m = w.melee, r = (v, lo, hi) => Math.max(1, Math.min(5, Math.round(1 + 4 * (v - lo) / (hi - lo))));
  return [['Throw speed', r(w.v, 0.75, 1.3)], ['Hit size', r(w.hitR, 0.65, 1.4)], ['Curve', r(w.curve, 0.3, 1.8)], ['Swing reach', r(m.reach, 0.95, 1.85)], ['Swing speed', r(1 / m.cd, 1 / 0.7, 1 / 0.28)]];
}
// icons (inner SVG, viewBox 0 0 48 48): touch aim knob, Armory cards, setup row. The boomerang one is the original HUD icon.
const IC = {
  boom: (c) => `<path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#2a1a0a" stroke-width="11" stroke-linecap="round"/><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`,
  disc: (c) => `<ellipse cx="24" cy="25" rx="17" ry="11" fill="${c}" stroke="#06283a" stroke-width="4"/><ellipse cx="24" cy="25" rx="12" ry="7" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/><ellipse cx="24" cy="25" rx="5" ry="3" fill="#06283a"/>`,
  hook: (c) => `<path d="M33 12A14 14 0 1 0 37 31" fill="none" stroke="#2a1450" stroke-width="11" stroke-linecap="round"/><path d="M33 12A14 14 0 1 0 37 31" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M31 8l6 3-5 4z M40 29l-1 7-5-4z" fill="#f4f0e6" stroke="#2a1450" stroke-width="1.5"/>`,
  mallet: (c) => `<path d="M14 38L28 20" stroke="#3a2210" stroke-width="8" stroke-linecap="round"/><path d="M14 38L28 20" stroke="#b07a3a" stroke-width="4.5" stroke-linecap="round"/><rect x="20" y="6" width="22" height="15" rx="4" transform="rotate(38 31 13.5)" fill="${c}" stroke="#4a1a08" stroke-width="3.5"/>`,
  pan: (c) => `<path d="M30 30L44 42" stroke="#2a1a0a" stroke-width="7" stroke-linecap="round"/><circle cx="20" cy="20" r="15" fill="${c}" stroke="#111" stroke-width="3.5"/><circle cx="20" cy="20" r="9" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/>`,
  blade: (c) => `<path d="M10 40L34 8l5 4L16 42z" fill="${c}" stroke="#1a1a24" stroke-width="3" stroke-linejoin="round"/><path d="M8 38l8 6" stroke="#5a3a1a" stroke-width="6" stroke-linecap="round"/>`,
  star: (c) => `<path d="M24 4l5 15 15 5-15 5-5 15-5-15-15-5 15-5z" fill="${c}" stroke="#1a1a24" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="24" r="3.5" fill="#1a1a24"/>`,
  wrench: (c) => `<path d="M14 36L30 20" stroke="#1a1a24" stroke-width="9" stroke-linecap="round"/><path d="M14 36L30 20" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M28 10a9 9 0 1 0 10 10l-6-1-3-3z" fill="${c}" stroke="#1a1a24" stroke-width="3" stroke-linejoin="round"/>`,
  anchor: (c) => `<path d="M24 8v30M14 16h20M8 28c2 10 10 12 16 12s14-2 16-12" fill="none" stroke="#1a1a24" stroke-width="8" stroke-linecap="round"/><path d="M24 8v30M14 16h20M8 28c2 10 10 12 16 12s14-2 16-12" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/><circle cx="24" cy="7" r="4" fill="none" stroke="${c}" stroke-width="3"/>`,
  staff: (c) => `<path d="M8 40L40 8" stroke="#1a1a24" stroke-width="8" stroke-linecap="round"/><path d="M8 40L40 8" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/><path d="M12 36l3 3M33 15l-3-3" stroke="#ffd060" stroke-width="5"/>`,
  ring: (c) => `<circle cx="24" cy="24" r="15" fill="none" stroke="#1a1a24" stroke-width="10"/><circle cx="24" cy="24" r="15" fill="none" stroke="${c}" stroke-width="6"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6" stroke="#1a1a24" stroke-width="3"/>`,
  icicle: (c) => `<path d="M16 6h16l-8 38z" fill="${c}" stroke="#123" stroke-width="3" stroke-linejoin="round"/><path d="M21 9l3 22" stroke="#fff" stroke-width="2" opacity=".8"/>`,
  orb: (c) => `<path d="M24 4v6" stroke="#1a1a24" stroke-width="4"/><circle cx="24" cy="27" r="15" fill="${c}" stroke="#1a1a24" stroke-width="3.5"/><circle cx="19" cy="22" r="4" fill="#fff" opacity=".6"/>`,
  bell: (c) => `<path d="M14 24h20" stroke="#1a1a24" stroke-width="7" stroke-linecap="round"/><rect x="5" y="12" width="10" height="24" rx="3" fill="${c}" stroke="#1a1a24" stroke-width="3"/><rect x="33" y="12" width="10" height="24" rx="3" fill="${c}" stroke="#1a1a24" stroke-width="3"/>`,
};
const hexc = (n) => '#' + n.toString(16).padStart(6, '0');
const BOOM0 = '<path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#3a1600" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 33C10 17 17 11 24 11s14 6 16 22" fill="none" stroke="#ffcf3a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 28C14 19 18 15.5 24 15.5" fill="none" stroke="#fff6c0" stroke-width="2.2" stroke-linecap="round"/><circle cx="8.5" cy="33" r="2.4" fill="#ff7a3a"/><circle cx="39.5" cy="33" r="2.4" fill="#ff7a3a"/>'; // the original HUD boomerang icon (base boomerang only)
export const WICON = new Proxy({}, { get: (_, id) => { if (wpnOf(id) === 'boom') return BOOM0; const w = W(id); return (IC[w.form] || IC.boom)(hexc(w.col)); } });
export const wpnSvg = (id, cls = 'wsv') => `<svg viewBox="0 0 48 48" class="${cls}">${WICON[wpnOf(id)]}</svg>`;
