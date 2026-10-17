// Game mode catalog, 12-stage campaign (3 bosses) and star evaluation.
import { HEROES, PERSONAS } from './data.js';

export const hero = (id) => HEROES.find((h) => h.id === id) || HEROES[0];
export const ENEMY_COLORS = [0xff5a8a, 0x4fd1ff, 0x7dff6a, 0xffa23c, 0xb78cff];

// Campaign stages. kind: elim | team | survival | koth | bomb | boss
export const STAGES = [
  { n: 1, name: 'Dojo Debut', arena: 'dojo', kind: 'elim', foes: [{ h: 'nori', d: 0 }], par: 60, tip: 'Hold to charge, release to throw. Catch it on the way back!' },
  { n: 2, name: 'Rooftop Rumble', arena: 'rooftop', kind: 'elim', foes: [{ h: 'tako', d: 0 }, { h: 'kuma', d: 0 }], par: 90, tip: 'Conveyor belts push you around. Use them!' },
  { n: 3, name: 'Hill Climb', arena: 'jungle', kind: 'koth', foes: [{ h: 'pico', d: 0 }, { h: 'yuki', d: 0 }], tip: 'Stand in the glowing zone alone to score.' },
  { n: 4, name: 'Boss: Iron Chef Bao', arena: 'dojo', kind: 'boss', boss: { h: 'bao', name: 'Iron Chef Bao', hp: 4, scale: 1.7, type: 'classic', color: 0xff6a3a }, events: [], tip: 'Dodge the red slam circle, then hit him from range.' },
  { n: 5, name: 'Frozen Waves', arena: 'ice', kind: 'survival', waves: 4, tip: 'Survive 4 waves. You have 3 lives.' },
  { n: 6, name: 'Tag Team', arena: 'rooftop', kind: 'team', ally: { h: 'nori', d: 1 }, foes: [{ h: 'kuma', d: 1 }, { h: 'tako', d: 1 }], par: 120, tip: 'Your partner cannot be hurt by your boomerangs.' },
  { n: 7, name: 'Hot Potato', arena: 'jungle', kind: 'bomb', foes: [{ h: 'bao', d: 1 }, { h: 'pico', d: 1 }, { h: 'yuki', d: 1 }], tip: 'Hit rivals to pass the bomb. Do not hold it at zero!' },
  { n: 8, name: 'Boss: Captain Cannon', arena: 'rooftop', kind: 'boss', boss: { h: 'kuma', name: 'Captain Cannon', hp: 5, scale: 1.7, type: 'boom', color: 0xffb02e }, events: ['bumper'], tip: 'His blast boomerangs explode. Keep moving!' },
  { n: 9, name: 'Summit Showdown', arena: 'ice', kind: 'koth', foes: [{ h: 'nori', d: 2 }, { h: 'kuma', d: 2 }, { h: 'tako', d: 2 }], events: ['wind'], tip: 'Wind gusts will push you off the zone.' },
  { n: 10, name: 'Meteor Jungle', arena: 'jungle', kind: 'survival', waves: 6, events: ['meteor'], tip: 'Watch for red warning circles!' },
  { n: 11, name: 'Outnumbered', arena: 'rooftop', kind: 'elim', foes: [{ h: 'yuki', d: 2 }, { h: 'nori', d: 2 }, { h: 'bao', d: 2 }], par: 150, tip: 'Three hard bots. Use your ultimate!' },
  { n: 12, name: 'Boss: Shogun Yuki-Zero', arena: 'ice', kind: 'boss', boss: { h: 'yuki', name: 'Shogun Yuki-Zero', hp: 6, scale: 1.8, type: 'frost', color: 0x6ad8ff }, events: ['meteor', 'wind'], tip: 'Frost boomerangs freeze you. Parry or dash!' },
];
for (const n of [1, 2, 3, 4, 8, 12]) STAGES[n - 1].traps = 'off'; // gentle ramp: no traps in the first stages, and none during boss fights (the boss is the hazard)
export const MAX_STARS = STAGES.length * 3;
export const KIND_MODE = { elim: 'classic', team: 'team', survival: 'survival', koth: 'koth', bomb: 'bomb', boss: 'classic' };

const pickEvents = (arena, level) => {
  if (level === 'off') return [];
  const base = { dojo: ['bumper', 'wind', 'meteor'], rooftop: ['bumper', 'meteor', 'wind'], jungle: ['meteor', 'wind', 'bumper'], ice: ['wind', 'meteor', 'bumper'], volcano: ['meteor', 'wind', 'bumper'], pirate: ['wind', 'bumper', 'meteor'], space: ['meteor', 'bumper', 'wind'], haunted: ['wind', 'meteor', 'bumper'] }[arena] || ['bumper', 'wind', 'meteor'];
  const n = level === 'wild' ? 2 : 1; const a = base.slice().sort(() => Math.random() - 0.5); return a.slice(0, n);
};

export function rulesFor(mode, o = {}) {
  const ev = o.events !== undefined ? o.events : pickEvents(o.arena || 'dojo', o.eventLevel || 'off');
  const r = { type: 'elim', sudden: true, events: ev, teams: false };
  if (mode === 'team') r.teams = true;
  else if (mode === 'survival') { r.type = 'survival'; r.sudden = false; r.puEvery = 5; if (o.waves) r.waves = o.waves; }
  else if (mode === 'koth') { r.type = 'koth'; r.sudden = false; r.kothTarget = 100; }
  else if (mode === 'bomb') { r.type = 'bomb'; r.sudden = false; r.puEvery = 7; }
  else if (mode === 'ctf') { r.type = 'ctf'; r.teams = true; r.sudden = false; r.puEvery = 7; }
  else if (mode === 'coins') { r.type = 'coins'; r.sudden = false; r.puEvery = 6; }
  else if (mode === 'ball') { r.type = 'ball'; r.teams = true; r.stunOnly = true; r.sudden = false; r.puEvery = 14; r.events = []; }
  else if (mode === 'crumble') { r.crumble = true; r.sudden = false; r.puEvery = 5; }
  else if (mode === 'bossrush') { r.type = 'bossrush'; r.sudden = false; r.puEvery = 6; }
  if (o.boss) { r.sudden = false; }
  return r;
}

// returns 0 (failed) .. 3
export function evalStars(stage, r) {
  if (!r.won) return 0;
  switch (stage.kind) {
    case 'elim': case 'team': return 1 + (r.deaths === 0 ? 1 : 0) + (r.deaths === 0 && r.time <= stage.par ? 1 : 0);
    case 'survival': return 1 + (r.deaths <= 1 ? 1 : 0) + (r.deaths === 0 ? 1 : 0);
    case 'koth': return 1 + (r.margin >= 20 ? 1 : 0) + (r.margin >= 40 ? 1 : 0);
    case 'bomb': return 1 + (r.passes >= 3 ? 1 : 0) + (r.passes >= 6 ? 1 : 0);
    case 'boss': return 1 + (r.deaths <= 1 ? 1 : 0) + (r.deaths === 0 ? 1 : 0);
  }
  return 1;
}
export function starHint(stage) {
  switch (stage.kind) {
    case 'elim': case 'team': return ['Win', 'Win without being KO\u2019d', 'Win without being KO\u2019d in under ' + stage.par + 's'];
    case 'survival': return ['Clear all ' + stage.waves + ' waves', 'Lose at most 1 life', 'Lose no lives'];
    case 'koth': return ['Win the hill', 'Win by 20+ points', 'Win by 40+ points'];
    case 'bomb': return ['Win', 'Pass the bomb 3+ times', 'Pass the bomb 6+ times'];
    case 'boss': return ['Defeat the boss', 'Lose at most 1 life', 'Lose no lives'];
  }
}
export function stageBlurb(stage) { return { elim: 'Last fighter standing', team: 'Team 2v2', survival: 'Survival \u00b7 ' + stage.waves + ' waves', koth: 'King of the Hill', bomb: 'Bomb Tag', boss: 'BOSS FIGHT' }[stage.kind]; }

// Build players list for a stage. human: {hero, hat, skin, trail, type, ...}
export function stageSetup(stage, humanDef) {
  const humanLives = stage.kind === 'boss' || stage.kind === 'survival' ? 3 : stage.kind === 'koth' ? 99 : stage.kind === 'bomb' ? 1 : 2;
  const players = [{ ...humanDef, ctrl: 'human', slot: 0, team: 0, lives: humanLives }];
  const mkBot = (f, team, color, extra = {}) => ({ hero: hero(f.h), ctrl: 'bot', slot: -1, name: hero(f.h).name, diff: f.d, persona: PERSONAS[f.h], team, color, hat: f.hat || 'none', lives: stage.kind === 'koth' ? 99 : 1, type: f.type || 'classic', wins: 0, ...extra });
  let rules;
  if (stage.kind === 'boss') {
    const b = stage.boss; players.push({ hero: hero(b.h), ctrl: 'bot', slot: -1, name: b.name, diff: 1, persona: 'boss', team: 1, color: b.color, hat: 'none', lives: 1, hp: b.hp, scale: b.scale, boss: true, type: b.type, wins: 0 });
    rules = rulesFor('classic', { events: stage.events || [], boss: true });
  } else if (stage.kind === 'survival') { rules = rulesFor('survival', { events: stage.events || [], waves: stage.waves }); }
  else if (stage.kind === 'team') { players.push(mkBot(stage.ally, 0, 0x9fe8ff)); stage.foes.forEach((f, i) => players.push(mkBot(f, 1, i ? 0xff9ab8 : 0xff5a8a))); rules = rulesFor('team', { events: stage.events || [] }); players[0].color = 0x4fd1ff; }
  else { stage.foes.forEach((f, i) => players.push(mkBot(f, i + 1, ENEMY_COLORS[i]))); rules = rulesFor(KIND_MODE[stage.kind], { events: stage.events || [] }); }
  return { players, rules };
}
