// Daily twists: the same one for everyone on a given date.
export const MUTATORS = [
  { id: 'lowgrav', name: 'Low Gravity', icon: '🌙', desc: 'Floaty! Slidey moves, long dashes, big hops.', grav: true },
  { id: 'giant', name: 'Giant Boomerangs', icon: '🪃', desc: 'Every boomerang is huge and smashes crates.', giant: true },
  { id: 'rubber', name: 'Rubber Walls', icon: '🏀', desc: 'Everything bounces off the walls, faster each time.', rubber: true },
];
export function dateKey(d = new Date()) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
export function todayMutator() { const k = dateKey(); const h = (k * 2654435761 >>> 0) % MUTATORS.length; return MUTATORS[h]; }
export function resolveMutator(setting) { if (!setting || setting === 'off') return null; if (setting === 'daily') return todayMutator(); return MUTATORS.find((m) => m.id === setting) || null; }
