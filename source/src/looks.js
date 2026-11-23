// Play-earned skins and win poses (batch427 / CAP-6). Looks only — they never change power.
// Unlocked by playing (matches, wins, trophies, dailies). No purchases, no loot boxes, no ads.
import { S, save } from './save.js';
import { HEROES, POSES } from './data.js';
let _note = null; export const setLookNotifier = (fn) => { _note = fn; };
const lookNote = (msg, kind) => { try { if (_note) _note(msg, kind); } catch (e) {} };

// Two extra colorways per fighter plus Classic. Names are original.
const ALTS = {
  bao:  [['honey', 'Honey Glaze', 0xffe0a0, 0xe8503a], ['night', 'Night Kitchen', 0x4a3a48, 0xffb02e]],
  nori: [['dusk', 'Dusk Scarf', 0x6a2a4a, 0xff8a2e], ['moss', 'Moss Shadow', 0x3a6a48, 0xd8283c]],
  tako: [['copper', 'Copper Bolt', 0xc47a3a, 0x59c2ff], ['mint', 'Mint Circuit', 0xb8ffe0, 0xffb02e]],
  kuma: [['sunset', 'Sunset Sail', 0xffb070, 0x7d8fc4], ['ink', 'Ink Tide', 0x2a3048, 0xe8b23a]],
  pico: [['sand', 'Sand Temple', 0xe8d5a0, 0x5fd16b], ['jade', 'Jade Dusk', 0x1e4a38, 0xff9a2e]],
  yuki: [['frost', 'Frost Cape', 0xeaf6ff, 0x4a6aaa], ['berry', 'Berry Helm', 0xc84a6a, 0x2b3a67]],
  gus:  [['gold', 'Gold Belt', 0xffe08a, 0xb9a4ea], ['plum', 'Plum Champ', 0x6a3a7a, 0xffc23a]],
  wisp: [['dawn', 'Dawn Wisp', 0xffe8c8, 0xff9ad0], ['night', 'Night Lantern', 0x2a3048, 0x6ff0ff]],
  puff: [['sky', 'Sky Fluff', 0xc8e8ff, 0xffe566], ['bloom', 'Bloom Puff', 0xffc0d8, 0x7eb3ff]],
  bram: [['autumn', 'Autumn Quills', 0xe8a058, 0x6a3a20], ['moss', 'Moss Coat', 0x6aaa5a, 0x3a5a28]],
};

export const HERO_SKINS = {};
for (const h of HEROES) {
  const list = [{ id: 'classic', name: 'Classic', color: h.color, accent: h.accent, earn: { kind: 'start' } }];
  for (const [id, name, color, accent] of (ALTS[h.id] || [])) {
    list.push({ id, name, color, accent, earn: list.length === 1 ? { kind: 'plays', n: 5, hero: h.id } : { kind: 'wins', n: 5 } });
  }
  HERO_SKINS[h.id] = list;
}

export const EARN_POSES = {
  cheer: { name: 'Big cheer', desc: 'Arms way up, a happy bounce.', earn: { kind: 'wins', n: 3 } },
  flex:  { name: 'Proud stretch', desc: 'A proud little stretch.', earn: { kind: 'trophies', n: 20 } },
  kick:  { name: 'Victory kick', desc: 'A playful kick and hop.', earn: { kind: 'plays', n: 8 } },
  dance: { name: 'Happy dance', desc: 'A tiny twirly dance.', earn: { kind: 'dailies', n: 5 } },
};

export function skinOf(hero, id) { return (HERO_SKINS[hero] || []).find((s) => s.id === id) || (HERO_SKINS[hero] || [])[0]; }
export function allPoseIds() { return [...Object.keys(POSES), ...Object.keys(EARN_POSES)]; }
export function poseInfo(id) { return EARN_POSES[id] || POSES[id] || POSES.wave; }

function key(hero, id) { return hero + ':' + id; }

export function ownHeroSkins() {
  const s = S(); if (!s.own.heroSkins) s.own.heroSkins = [];
  return s.own.heroSkins;
}
export function ownsHeroSkin(hero, id) {
  if (!id || id === 'classic') return true;
  return ownHeroSkins().includes(key(hero, id));
}
export function ownsPose(id) {
  if (!id || id === 'wave') return true;
  const s = S();
  return !!(s.own.poses && s.own.poses.includes(id));
}

export function equippedSkinId(hero) {
  const s = S(); const eq = (s.eq && s.eq.heroSkins) || {};
  const id = eq[hero] || 'classic';
  return ownsHeroSkin(hero, id) ? id : 'classic';
}
export function equipHeroSkin(hero, id) {
  if (!ownsHeroSkin(hero, id)) return false;
  const s = S(); if (!s.eq.heroSkins) s.eq.heroSkins = {};
  s.eq.heroSkins[hero] = id; save(); return true;
}
export function equipPose(id) {
  if (!ownsPose(id) && !(POSES[id] && (S().own.poses || []).includes(id)) && id !== 'wave') return false;
  S().eq.pose = id; save(); return true;
}

export function earnLabel(earn) {
  if (!earn || earn.kind === 'start') return 'Unlocked from the start';
  if (earn.kind === 'plays' && earn.hero) {
    const h = HEROES.find((x) => x.id === earn.hero);
    return 'Play ' + earn.n + ' matches as ' + (h ? h.name : 'this fighter');
  }
  if (earn.kind === 'plays') return 'Play ' + earn.n + ' matches';
  if (earn.kind === 'wins') return 'Win ' + earn.n + ' matches';
  if (earn.kind === 'trophies') return 'Earn ' + earn.n + ' trophies';
  if (earn.kind === 'dailies') return 'Finish ' + earn.n + ' daily quests';
  return 'Keep playing to unlock';
}

export function earnProgress(earn) {
  const s = S(); const st = s.stats || {};
  if (!earn || earn.kind === 'start') return { have: 1, need: 1, ok: true };
  if (earn.kind === 'plays' && earn.hero) {
    const n = (((s.trophy || {}).mastery || {})[earn.hero] || {}).plays || 0;
    return { have: n, need: earn.n, ok: n >= earn.n };
  }
  if (earn.kind === 'plays') return { have: s.played || 0, need: earn.n, ok: (s.played || 0) >= earn.n };
  if (earn.kind === 'wins') return { have: s.wins || 0, need: earn.n, ok: (s.wins || 0) >= earn.n };
  if (earn.kind === 'trophies') { const n = (s.trophy && s.trophy.n) || 0; return { have: n, need: earn.n, ok: n >= earn.n }; }
  if (earn.kind === 'dailies') { const n = st.dailies || 0; return { have: n, need: earn.n, ok: n >= earn.n }; }
  return { have: 0, need: 1, ok: false };
}

export function grantHeroSkin(hero, id, silent) {
  if (ownsHeroSkin(hero, id)) return false;
  ownHeroSkins().push(key(hero, id)); save();
  const sk = skinOf(hero, id); const h = HEROES.find((x) => x.id === hero);
  if (!silent) lookNote((h ? h.name : hero) + ': unlocked ' + (sk && sk.name) + ' look!', 'ach');
  return true;
}
export function grantPose(id, silent) {
  const s = S(); if (!s.own.poses) s.own.poses = ['wave'];
  if (s.own.poses.includes(id)) return false;
  s.own.poses.push(id); save();
  const name = (EARN_POSES[id] && EARN_POSES[id].name) || id;
  if (!silent) lookNote('New win pose: ' + name + '!', 'ach');
  return true;
}

export function checkLookUnlocks(silent) {
  const got = [];
  for (const h of HEROES) {
    for (const sk of (HERO_SKINS[h.id] || [])) {
      if (sk.earn && sk.earn.kind !== 'start' && earnProgress(sk.earn).ok) {
        if (grantHeroSkin(h.id, sk.id, true)) got.push((h.name + ': ' + sk.name));
      }
    }
  }
  for (const [id, p] of Object.entries(EARN_POSES)) {
    if (earnProgress(p.earn).ok && grantPose(id, true)) got.push(p.name);
  }
  if (!silent && got.length) lookNote('New looks: ' + got.join(', '), 'ach');
  return got;
}

export function tintedHero(h) {
  const sk = skinOf(h.id, equippedSkinId(h.id));
  if (!sk || sk.id === 'classic') return h;
  return { ...h, color: sk.color, accent: sk.accent, _skin: sk.id };
}

