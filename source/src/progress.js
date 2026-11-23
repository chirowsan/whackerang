// XP / levels, daily quests, achievements, shop catalog. All local, no accounts.
import { S, save } from './save.js';
import { ledgerAdd } from './economy.js';
import { HATS, BOOM_TYPES, TRAILS, SKINS, EMOTES, HEROES, ACHIEVEMENTS, POSES, SPARKLES } from './data.js';

export const xpNeed = (lv) => 70 + lv * 40;
export const levelInfo = () => { let xp = S().xp, lv = 1; while (xp >= xpNeed(lv)) { xp -= xpNeed(lv); lv++; } return { level: lv, cur: xp, need: xpNeed(lv) }; };
// free unlocks on level-up (items can also be bought in the shop)
export const LEVEL_REWARDS = { 2: { trails: 'spark' }, 3: { types: 'razor' }, 4: { emotes: 'haha' }, 5: { types: 'frost' }, 6: { skins: 'mint' }, 7: { trails: 'leaf' }, 8: { types: 'chain' }, 10: { types: 'boom' }, 12: { skins: 'candy' }, 14: { types: 'phantom' }, 16: { trails: 'neon' }, 9: { hats: 'cat' }, 11: { trails: 'bubble' }, 13: { hats: 'propeller' }, 15: { skins: 'sunset' }, 18: { hats: 'cowboy' }, 20: { trails: 'star' } };
const NAMES = { types: (id) => BOOM_TYPES[id].name + ' boomerang', trails: (id) => TRAILS[id].name + ' trail', skins: (id) => SKINS[id].name + ' skin', emotes: (id) => EMOTES[id].text + ' emote', hats: (id) => HATS.find((h) => h.id === id).name, poses: (id) => POSES[id].name + ' pose', sparkles: (id) => SPARKLES[id].name };
let notify = (msg, kind) => {}; export const setNotifier = (fn) => { notify = fn; };
let onQuest = () => {}; export const setQuestNotifier = (fn) => { onQuest = fn; };

export function addCoins(n, reason = 'play') { const s = S(); s.coins += n; if (n > 0) { s.totalCoins = (s.totalCoins || 0) + n; ledgerAdd(n, reason, 'earn'); } }
export function addXp(n) {
  const s = S(), before = levelInfo().level; s.xp += Math.round(n); const after = levelInfo().level; const ups = [];
  for (let lv = before + 1; lv <= after; lv++) {
    const coins = 40 + lv * 10; addCoins(coins, 'level'); const up = { level: lv, coins, unlock: null };
    const r = LEVEL_REWARDS[lv]; if (r) { const k = Object.keys(r)[0], id = r[k]; if (grantItem(k, id)) up.unlock = NAMES[k](id); }
    ups.push(up); notify(`LEVEL ${lv}!  +${coins} gold` + (up.unlock ? ' · unlocked ' + up.unlock : ''), 'level');
  }
  s.stats.level = Math.max(s.stats.level || 1, after); checkAch(); checkMiles(); save(); return ups;
}

export function grantItem(k, id) {
  const s = S();
  if (k === 'hats') { if (!s.unlockedHats.includes(id)) { s.unlockedHats.push(id); return true; } return false; }
  if (!s.own[k]) s.own[k] = [];
  if (!s.own[k].includes(id)) { s.own[k].push(id); return true; }
  return false;
}

// ---------- achievements ----------
export function checkAch() {
  const s = S();
  for (const a of ACHIEVEMENTS) { if (s.ach[a.id]) continue; if ((s.stats[a.stat] || 0) >= a.n) { s.ach[a.id] = Date.now(); addCoins(a.coins, 'achievement'); notify(`ACHIEVEMENT: ${a.name}  +${a.coins} gold`, 'ach'); } }
}

// ---------- daily quests (quest418) ----------
// Short, generous, doable in about 10–15 minutes. Stars are the same soft currency as coins.
const BASE_QUESTS = [
  { id: 'catch', text: 'Catch 5 boomerangs', stat: 'catch', n: 5, stars: 25, xp: 40 },
  { id: 'win', text: 'Win 1 match', stat: 'win', n: 1, stars: 40, xp: 60 },
  { id: 'bush', text: 'Hide in a bush 3 times', stat: 'bush', n: 3, stars: 20, xp: 30 },
  { id: 'ult', text: 'Use your Special 3 times', stat: 'ult', n: 3, stars: 25, xp: 40 },
  { id: 'play', text: 'Play 2 matches', stat: 'play', n: 2, stars: 20, xp: 30 },
  { id: 'throw', text: 'Throw 8 boomerangs', stat: 'throw', n: 8, stars: 20, xp: 30 },
  { id: 'dash', text: 'Dash 6 times', stat: 'dash', n: 6, stars: 15, xp: 25 },
  { id: 'ko', text: 'KO 3 rivals', stat: 'ko', n: 3, stars: 30, xp: 40 },
];
const heroQuests = () => HEROES.filter((h) => !h.cost).map((h) => ({ id: 'as-' + h.id, text: 'Play 2 matches as ' + h.name, stat: 'as:' + h.id, n: 2, stars: 25, xp: 35 }));
export const QUEST_POOL = () => BASE_QUESTS.concat(heroQuests());
const packQuest = (p) => ({ id: p.id, text: p.text, stat: p.stat, n: p.n, stars: p.stars, coins: p.stars, xp: p.xp });

const DAILY_VER = 418;
let _dayOverride = null;
export const setDayKey = (k) => { _dayOverride = k == null ? null : Number(k); };
export const dayKey = () => { if (_dayOverride != null) return _dayOverride; const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function pickList(key, avoid = []) {
  const r = rng(key >>> 0); const pool = QUEST_POOL().filter((p) => !avoid.includes(p.id));
  const list = []; let hasHero = avoid.some((id) => String(id).startsWith('as-'));
  const bag = pool.slice();
  while (list.length < 3 && bag.length) {
    const p = bag.splice(Math.floor(r() * bag.length), 1)[0];
    if (String(p.stat).startsWith('as:') && hasHero) continue;
    if (String(p.stat).startsWith('as:')) hasHero = true;
    list.push(packQuest(p));
  }
  return list;
}

export function ensureDaily() {
  const s = S(), key = String(dayKey());
  if (s.daily && s.daily.date === key && s.daily.list && s.daily.list.length && s.daily.ver === DAILY_VER) return s.daily;
  const list = pickList(dayKey());
  s.daily = { date: key, ver: DAILY_VER, list, prog: {}, claimed: {}, rerolled: false }; save(); return s.daily;
}
export const CHEST_GOLD = 60;
export function chestState() { const d = ensureDaily(); const all = d.list.length > 0 && d.list.every((c) => d.claimed[c.id]); return all ? (d.chest ? 'claimed' : 'ready') : 'locked'; }
export function claimChest() { const d = ensureDaily(); if (chestState() !== 'ready') return false; d.chest = true; addCoins(CHEST_GOLD, 'daily-chest'); addXp(50); save(); return true; }
export function dailySnapshot() { const d = ensureDaily(); const o = {}; for (const c of d.list) o[c.id] = d.prog[c.id] || 0; return o; }
export function dailyReadyCount() { const d = ensureDaily(); return d.list.filter((c) => !d.claimed[c.id] && Math.min(c.n, d.prog[c.id] || 0) >= c.n).length + (chestState() === 'ready' ? 1 : 0); }
export function dailyProgress(c) { const d = ensureDaily(); return Math.min(c.n, d.prog[c.id] || 0); }
export function dailyDoneCount() { const d = ensureDaily(); return d.list.filter((c) => d.claimed[c.id] || dailyProgress(c) >= c.n).length; }
export function canReroll() { return !ensureDaily().rerolled; }
export function rewardOf(c) { return (c && (c.stars != null ? c.stars : c.coins)) || 0; }

export function claimDaily(i) { const d = ensureDaily(), c = d.list[i]; if (!c || d.claimed[c.id] || dailyProgress(c) < c.n) return false; d.claimed[c.id] = true; addCoins(rewardOf(c), 'daily'); addXp(c.xp); const st = S(); st.stats = st.stats || {}; st.stats.dailies = (st.stats.dailies || 0) + 1; save(); try { if (typeof globalThis !== 'undefined' && globalThis.__bg && __bg.checkLookUnlocks) __bg.checkLookUnlocks(); } catch (e) {} return true; }

export function rerollDaily(i) {
  const d = ensureDaily(); if (d.rerolled) return false;
  const cur = d.list[i]; if (!cur || d.claimed[cur.id]) return false;
  const avoid = d.list.map((c) => c.id);
  const next = pickList(dayKey() * 17 + (i + 1) * 97 + 13, avoid)[0];
  if (!next || next.id === cur.id) {
    const leftover = QUEST_POOL().filter((p) => !avoid.includes(p.id));
    if (!leftover.length) return false;
    const pick = leftover[Math.floor(rng(dayKey() + i + 9)() * leftover.length)];
    d.list[i] = packQuest(pick);
  } else d.list[i] = next;
  delete d.prog[cur.id]; d.rerolled = true; save(); return d.list[i];
}

function autoClaimQuests() {
  const d = ensureDaily(); const got = [];
  d.list.forEach((c, i) => { if (!d.claimed[c.id] && dailyProgress(c) >= c.n) { if (claimDaily(i)) got.push(c); } });
  if (got.length && chestState() === 'ready') { claimChest(); got.push({ id: 'chest', text: 'All 3 quests done!', stars: CHEST_GOLD, all: true }); }
  return got;
}

// ---------- play milestones (cosmetics granted just by playing) ----------
export const MILESTONES = [
  { id: 'm_play5', text: 'Play 5 matches', stat: 'play', n: 5, give: { trails: 'dew' } },
  { id: 'm_catch20', text: 'Catch 20 boomerangs', stat: 'catch', n: 20, give: { hats: 'sprout' } },
  { id: 'm_win3', text: 'Win 3 matches', stat: 'win', n: 3, give: { emotes: 'yay' } },
  { id: 'm_bush10', text: 'Hide in a bush 10 times', stat: 'bush', n: 10, give: { sparkles: 'firefly' } },
  { id: 'm_play15', text: 'Play 15 matches', stat: 'play', n: 15, give: { poses: 'spin' } },
  { id: 'm_ult10', text: 'Use Special 10 times', stat: 'ult', n: 10, give: { trails: 'firefly' } },
];
export function mileProgress(m) { return Math.min(m.n, S().stats[m.stat] || 0); }
export function checkMiles() {
  const s = S(); s.mile = s.mile || {}; const got = [];
  for (const m of MILESTONES) {
    if (s.mile[m.id]) continue;
    if ((s.stats[m.stat] || 0) >= m.n) {
      s.mile[m.id] = Date.now();
      const k = Object.keys(m.give)[0], id = m.give[k];
      const name = NAMES[k] ? NAMES[k](id) : id;
      grantItem(k, id); got.push({ ...m, unlock: name });
      notify('Unlocked ' + name + '!', 'level');
    }
  }
  if (got.length) save();
  return got;
}

// ---------- stat tracking ----------
export function track(stat, n = 1) {
  const s = S(); const a = ACHIEVEMENTS.find((q) => q.stat === stat && q.max);
  if (stat === 'wave' || a) s.stats[stat] = Math.max(s.stats[stat] || 0, n); else s.stats[stat] = (s.stats[stat] || 0) + n;
  const d = ensureDaily();
  for (const c of d.list) {
    if (c.stat === stat) d.prog[c.id] = (d.prog[c.id] || 0) + n;
    else if (c.stat === 'wavebest' && stat === 'wave') d.prog[c.id] = Math.max(d.prog[c.id] || 0, n);
  }
  const just = autoClaimQuests();
  checkAch(); checkMiles(); save();
  if (just.length) {
    const last = just[just.length - 1];
    const msg = last.all ? (`All 3 quests done!  +${last.stars} stars`) : (`Quest done! ${last.text}  +${rewardOf(last)} stars`);
    onQuest({ quest: last, msg, all: !!last.all, list: just });
  }
  return just;
}

// ---------- shop ----------
const np = (o) => Object.entries(o).filter(([, v]) => v.cost && !v.premium);
export const SHOP = {
  Boomerangs: Object.entries(BOOM_TYPES).filter(([, v]) => v.cost).map(([id, v]) => ({ cat: 'types', id, name: v.name, desc: v.desc, cost: v.cost, color: v.color })),
  Skins: np(SKINS).map(([id, v]) => ({ cat: 'skins', id, name: v.name, cost: v.cost, color: v.arm })),
  Trails: np(TRAILS).map(([id, v]) => ({ cat: 'trails', id, name: v.name, cost: v.cost, color: v.color, rainbow: v.rainbow })),
  Hats: HATS.filter((h) => h.cost && !h.premium).map((h) => ({ cat: 'hats', id: h.id, name: h.name, cost: h.cost })),
  Emotes: Object.entries(EMOTES).filter(([, v]) => v.cost && !v.premium).map(([id, v]) => ({ cat: 'emotes', id, name: v.text, cost: v.cost, color: v.color })),
  Fighters: HEROES.filter((h) => h.cost).map((h) => ({ cat: 'heroes', id: h.id, name: h.name, cost: h.cost, hero: h })),
  Premium: [
    ...Object.entries(SKINS).filter(([, v]) => v.premium).map(([id, v]) => ({ cat: 'skins', id, name: v.name + ' skin', cost: v.cost, color: v.arm })),
    ...Object.entries(TRAILS).filter(([, v]) => v.premium).map(([id, v]) => ({ cat: 'trails', id, name: v.name + ' trail', cost: v.cost, color: v.color, rainbow: v.rainbow })),
    ...HATS.filter((h) => h.premium).map((h) => ({ cat: 'hats', id: h.id, name: h.name + ' hat', cost: h.cost })),
    ...Object.entries(EMOTES).filter(([, v]) => v.premium).map(([id, v]) => ({ cat: 'emotes', id, name: v.text, cost: v.cost, color: v.color })),
  ],
};

// Cosmetics only. Premium catalog items are earnable with stars (no real money).
export function starCost(it) {
  if (!it) return 0;
  if (it.stars != null) return it.stars;
  return it.cost || 0;
}
function playCost(v) {
  const raw = v.cost || 0;
  if (v.premium) return Math.min(400, 240 + Math.round(raw / 20) * 5);
  return raw;
}
const entry = (cat, id, v, extra = {}) => { const stars = playCost({ ...v, ...extra }); return { cat, id, name: v.name || v.text, desc: v.desc || '', cost: stars, stars, color: v.color || v.arm || 0xffffff, rainbow: v.rainbow, premium: !!v.premium, ...extra }; };
export const COLLECTION = {
  Trails: Object.entries(TRAILS).filter(([id, v]) => id === 'none' || v.cost).map(([id, v]) => entry('trails', id, v)),
  Colors: Object.entries(SKINS).filter(([id, v]) => id === 'default' || v.cost).map(([id, v]) => entry('skins', id, { ...v, name: v.name })),
  Hats: HATS.filter((h) => h.id === 'none' || h.cost).map((h) => entry('hats', h.id, h)),
  Emotes: Object.entries(EMOTES).map(([id, v]) => entry('emotes', id, v)),
  Poses: Object.entries(POSES).map(([id, v]) => entry('poses', id, v)),
  Sparkles: Object.entries(SPARKLES).map(([id, v]) => entry('sparkles', id, v)),
};

export function owns(cat, id) { const s = S(); if (cat === 'hats') return s.unlockedHats.includes(id); if (cat === 'heroes') return s.unlockedHeroes.includes(id); if (!s.own[cat]) s.own[cat] = []; return s.own[cat].includes(id); }
export function buy(item) {
  const s = S(); const cost = starCost(item); if (owns(item.cat, item.id) || s.coins < cost) return false; s.coins -= cost; ledgerAdd(-cost, 'shop:' + item.cat + ':' + item.id, 'spend');
  if (item.cat === 'hats') s.unlockedHats.push(item.id); else if (item.cat === 'heroes') s.unlockedHeroes.push(item.id); else { if (!s.own[item.cat]) s.own[item.cat] = []; s.own[item.cat].push(item.id); } save(); return true;
}
export function equip(cat, id) { const s = S(); const k = { types: 'type', trails: 'trail', skins: 'skin', poses: 'pose', sparkles: 'sparkle' }[cat]; if (k) { s.eq[k] = id; save(); } }
export function toggleEmote(id) { const s = S(), e = s.eq.emotes; const i = e.indexOf(id); if (i >= 0) { if (e.length > 1) e.splice(i, 1); } else { if (e.length >= 4) e.shift(); e.push(id); } save(); }
