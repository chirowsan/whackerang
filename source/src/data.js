// Fighters, hats, arenas, power-ups. All original.
export const HEROES = [
  { id: 'bao', name: 'Bao', color: 0xffd9a0, accent: 0x6fbf5a, shape: 'bun', blurb: 'A steamy dumpling with a leafy cap.', perk: 'Balanced', mods: {}, cost: 0 },
  { id: 'nori', name: 'Nori', color: 0x3a3d5c, accent: 0xff7ac8, shape: 'cat', blurb: 'A sneaky ink-black cat.', perk: 'Quick dash (-25% cooldown)', mods: { dashCd: 0.75 }, cost: 0 },
  { id: 'tako', name: 'Tako', color: 0xb36bff, accent: 0xffe066, shape: 'octo', blurb: 'An eight-legged show-off.', perk: 'Fast charge-up', mods: { charge: 1.5 }, cost: 0 },
  { id: 'kuma', name: 'Kuma', color: 0xb9773e, accent: 0xff5a4f, shape: 'bear', blurb: 'A cuddly bear with huge mitts.', perk: 'Big catch radius', mods: { catchR: 1.35 }, cost: 0 },
  { id: 'pico', name: 'Pico', color: 0x4fd18b, accent: 0xfff0a0, shape: 'frog', blurb: 'A bouncy swamp hopper.', perk: 'Power-ups last 40% longer', mods: { puDur: 1.4 }, cost: 300 },
  { id: 'yuki', name: 'Yuki', color: 0xeaf6ff, accent: 0xff9a2e, shape: 'peng', blurb: 'A waddling ice-slider.', perk: 'Faster walking (+8%)', mods: { speed: 1.08 }, cost: 450 },
];
export const HATS = [
  { id: 'none', name: 'No hat', cost: 0 },
  { id: 'band', name: 'Headband', cost: 40 },
  { id: 'party', name: 'Party hat', cost: 60 },
  { id: 'top', name: 'Top hat', cost: 90 },
  { id: 'halo', name: 'Halo', cost: 120 },
  { id: 'flower', name: 'Flower', cost: 80 },
  { id: 'shades', name: 'Shades', cost: 100 },
];
export const ARENAS = [
  { id: 'dojo', name: 'Dojo Garden', blurb: 'Crates, lanterns & pop-up spikes', hazard: 'spikes' },
  { id: 'rooftop', name: 'Neon Rooftop', blurb: 'Conveyor belts & crates', hazard: 'conveyor' },
  { id: 'jungle', name: 'Jungle Ruins', blurb: 'Pillars & bubbling lava', hazard: 'lava' },
  { id: 'ice', name: 'Ice Dock', blurb: 'Slippery floor & cracking ice', hazard: 'crack' },
];
export const POWERUPS = {
  extra: { name: 'Extra Boomerang', color: 0x4fd1ff, short: '+1' },
  triple: { name: 'Triple Throw', color: 0xff7ad9, short: 'x3' },
  giant: { name: 'Giant', color: 0xffb02e, short: 'XL' },
  fire: { name: 'Blast', color: 0xff5a2e, short: 'FX' },
  homing: { name: 'Homing', color: 0xb26bff, short: 'HM' },
  shield: { name: 'Shield', color: 0x6fffb0, short: 'SH' },
  speed: { name: 'Speed', color: 0xfff04a, short: 'SP' },
};
export const PLAYER_COLORS = [0xffd23c, 0xff5a8a, 0x4fd1ff, 0x7dff6a];
