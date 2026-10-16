// Fighters, hats, arenas, power-ups. All original.
export const HEROES = [
  { id: 'bao', name: 'Bao', title: 'Panda Chef', color: 0xf3eee2, accent: 0xe8503a, trail: 0xff7a5a, shape: 'panda', blurb: 'A round panda chef who cooks up chaos.', quip: '"Order up! Extra spicy."', perk: 'Balanced', mods: {}, cost: 0, cam: [0.76, 4.0] },
  { id: 'nori', name: 'Nori', title: 'Ninja Fox', color: 0xff8a2e, accent: 0xd8283c, trail: 0xff4a5a, shape: 'fox', blurb: 'A tall, tail-swishing shadow with a red scarf.', quip: '"You never saw me. Nobody does."', perk: 'Quick dash (-25% cooldown)', mods: { dashCd: 0.75 }, cost: 0, cam: [0.86, 4.2] },
  { id: 'tako', name: 'Bolt', title: 'Tiny Robot', color: 0x59c2ff, accent: 0xffb02e, trail: 0x5cf0ff, shape: 'robot', blurb: 'A pocket-sized bot with a big battery.', quip: '"Calculating... yep, you\'re toast."', perk: 'Fast charge-up', mods: { charge: 1.5 }, cost: 0, cam: [0.62, 2.9] },
  { id: 'kuma', name: 'Salty', title: 'Cat Pirate', color: 0x7d8fc4, accent: 0xe8b23a, trail: 0xffd060, shape: 'pirate', blurb: 'One eye, one hook, nine lives (give or take).', quip: '"Arr! Yer boomerang be mine now!"', perk: 'Big catch radius', mods: { catchR: 1.35 }, cost: 0, cam: [0.72, 3.9] },
  { id: 'pico', name: 'Pico', title: 'Lizard Monk', color: 0x5fd16b, accent: 0xff9a2e, trail: 0x9dff7a, shape: 'monk', blurb: 'Calm, green and suspiciously fast with a tongue.', quip: '"Inner peace. Outer boomerang."', perk: 'Power-ups last 40% longer', mods: { puDur: 1.4 }, cost: 300, cam: [0.7, 3.9] },
  { id: 'yuki', name: 'Yuki', title: 'Penguin Samurai', color: 0x2b3a67, accent: 0xb5342a, trail: 0x9ad8ff, shape: 'peng', blurb: 'A waddling ice-slider with a very sharp helmet.', quip: '"Honor first. Snacks second."', perk: 'Faster walking (+8%)', mods: { speed: 1.08 }, cost: 450, cam: [0.74, 3.8] },
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
