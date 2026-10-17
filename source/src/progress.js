// XP / levels, daily challenges, achievements, shop catalog. All local, no accounts.
import { S, save } from './save.js';
import { ledgerAdd } from './economy.js';
import { HATS, BOOM_TYPES, TRAILS, SKINS, EMOTES, HEROES, ACHIEVEMENTS } from './data.js';

export const xpNeed = (lv) => 70 + lv * 40;
export const levelInfo = () => { let xp = S().xp, lv = 1; while (xp >= xpNeed(lv)) { xp -= xpNeed(lv); lv++; } return { level: lv, cur: xp, need: xpNeed(lv) }; };
// free unlocks on level-up (items can also be bought in the shop)
export const LEVEL_REWARDS = { 2: { trails: 'spark' }, 3: { types: 'razor' }, 4: { emotes: 'haha' }, 5: { types: 'frost' }, 6: { skins: 'mint' }, 7: { trails: 'leaf' }, 8: { types: 'chain' }, 10: { types: 'boom' }, 12: { skins: 'candy' }, 14: { types: 'phantom' }, 16: { trails: 'neon' }, 9: { hats: 'cat' }, 11: { trails: 'bubble' }, 13: { hats: 'propeller' }, 15: { skins: 'sunset' }, 18: { hats: 'cowboy' }, 20: { trails: 'star' } };
const NAMES = { types: (id) => BOOM_TYPES[id].name + ' boomerang', trails: (id) => TRAILS[id].name + ' trail', skins: (id) => SKINS[id].name + ' skin', emotes: (id) => EMOTES[id].text + ' emote', hats: (id) => HATS.find((h) => h.id === id).name };
let notify = (msg, kind) => {}; export const setNotifier = (fn) => { notify = fn; };

export function addCoins(n, reason = 'play') { const s = S(); s.coins += n; if (n > 0) { s.totalCoins = (s.totalCoins || 0) + n; ledgerAdd(n, reason, 'earn'); } }
export function addXp(n) {
  const s = S(), before = levelInfo().level; s.xp += Math.round(n); const after = levelInfo().level; const ups = [];
  for (let lv = before + 1; lv <= after; lv++) {
    const coins = 40 + lv * 10; addCoins(coins, 'level'); const up = { level: lv, coins, unlock: null };
    const r = LEVEL_REWARDS[lv]; if (r) { const k = Object.keys(r)[0], id = r[k]; if (k === 'hats') { if (!s.unlockedHats.includes(id)) { s.unlockedHats.push(id); up.unlock = NAMES[k](id); } } else if (!s.own[k].includes(id)) { s.own[k].push(id); up.unlock = NAMES[k](id); } }
    ups.push(up); notify(`LEVEL ${lv}!  +${coins} gold` + (up.unlock ? ' · unlocked ' + up.unlock : ''), 'level');
  }
  s.stats.level = Math.max(s.stats.level || 1, after); checkAch(); save(); return ups;
}

// ---------- achievements ----------
export function checkAch() {
  const s = S();
  for (const a of ACHIEVEMENTS) { if (s.ach[a.id]) continue; if ((s.stats[a.stat] || 0) >= a.n) { s.ach[a.id] = Date.now(); addCoins(a.coins, 'achievement'); notify(`ACHIEVEMENT: ${a.name}  +${a.coins} gold`, 'ach'); } }
}
// ---------- daily challenges ----------
const POOL = [
  { id: 'ko', text: 'KO {n} rivals', stat: 'ko', n: [6, 12], xp: 60, coins: 40 },
  { id: 'catch', text: 'Catch {n} boomerangs', stat: 'catch', n: [8, 16], xp: 50, coins: 30 },
  { id: 'deflect', text: 'Parry {n} boomerangs', stat: 'deflect', n: [3, 6], xp: 70, coins: 45 },
  { id: 'win', text: 'Win {n} matches', stat: 'win', n: [1, 2], xp: 90, coins: 60 },
  { id: 'play', text: 'Play {n} matches', stat: 'play', n: [2, 4], xp: 40, coins: 30 },
  { id: 'dash', text: 'Dash {n} times', stat: 'dash', n: [15, 30], xp: 40, coins: 25 },
  { id: 'ult', text: 'Use {n} ultimates', stat: 'ult', n: [2, 4], xp: 70, coins: 40 },
  { id: 'wave', text: 'Reach wave {n} in Survival', stat: 'wavebest', n: [3, 6], xp: 80, coins: 55 },
  { id: 'pickup', text: 'Grab {n} power-ups', stat: 'pickup', n: [3, 6], xp: 50, coins: 35 },
  { id: 'shatter', text: 'Shatter {n} frozen rivals', stat: 'shatter', n: [1, 3], xp: 80, coins: 50 },
];
const dayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function ensureDaily() {
  const s = S(), key = String(dayKey()); if (s.daily.date === key && s.daily.list.length) return s.daily;
  const r = rng(dayKey()), pool = POOL.slice(); const list = [];
  for (let i = 0; i < 3; i++) { const p = pool.splice(Math.floor(r() * pool.length), 1)[0]; const hard = i === 2; const n = Math.round(p.n[0] + (p.n[1] - p.n[0]) * (hard ? 1 : r() * 0.6)); list.push({ id: p.id, text: p.text.replace('{n}', n), stat: p.stat, n, xp: Math.round(p.xp * (hard ? 1.6 : 1)), coins: Math.round(p.coins * (hard ? 1.6 : 1)) }); }
  s.daily = { date: key, list, prog: {}, claimed: {} }; save(); return s.daily;
}
export const CHEST_GOLD = 60;
export function chestState() { const d = ensureDaily(); const all = d.list.length > 0 && d.list.every((c) => d.claimed[c.id]); return all ? (d.chest ? 'claimed' : 'ready') : 'locked'; }
export function claimChest() { const d = ensureDaily(); if (chestState() !== 'ready') return false; d.chest = true; addCoins(CHEST_GOLD, 'daily-chest'); addXp(50); save(); return true; }
export function dailySnapshot() { const d = ensureDaily(); const o = {}; for (const c of d.list) o[c.id] = d.prog[c.id] || 0; return o; }
export function dailyReadyCount() { const d = ensureDaily(); return d.list.filter((c) => !d.claimed[c.id] && Math.min(c.n, d.prog[c.id] || 0) >= c.n).length + (chestState() === 'ready' ? 1 : 0); }
export function dailyProgress(c) { const d = ensureDaily(); return Math.min(c.n, d.prog[c.id] || 0); }
export function claimDaily(i) { const d = ensureDaily(), c = d.list[i]; if (!c || d.claimed[c.id] || dailyProgress(c) < c.n) return false; d.claimed[c.id] = true; addCoins(c.coins, 'daily'); addXp(c.xp); save(); return true; }
// ---------- stat tracking ----------
export function track(stat, n = 1) {
  const s = S(); const a = ACHIEVEMENTS.find((q) => q.stat === stat && q.max);
  if (stat === 'wave' || a) s.stats[stat] = Math.max(s.stats[stat] || 0, n); else s.stats[stat] = (s.stats[stat] || 0) + n;
  const d = ensureDaily(); for (const c of d.list) { if (c.stat === stat) d.prog[c.id] = (d.prog[c.id] || 0) + n; else if (c.stat === 'wavebest' && stat === 'wave') d.prog[c.id] = Math.max(d.prog[c.id] || 0, n); }
  checkAch();
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
export function owns(cat, id) { const s = S(); if (cat === 'hats') return s.unlockedHats.includes(id); if (cat === 'heroes') return s.unlockedHeroes.includes(id); return s.own[cat].includes(id); }
export function buy(item) {
  const s = S(); if (owns(item.cat, item.id) || s.coins < item.cost) return false; s.coins -= item.cost; ledgerAdd(-item.cost, 'shop:' + item.cat + ':' + item.id, 'spend');
  if (item.cat === 'hats') s.unlockedHats.push(item.id); else if (item.cat === 'heroes') s.unlockedHeroes.push(item.id); else s.own[item.cat].push(item.id); save(); return true;
}
export function equip(cat, id) { const s = S(); const k = { types: 'type', trails: 'trail', skins: 'skin' }[cat]; if (k) { s.eq[k] = id; save(); } }
export function toggleEmote(id) { const s = S(), e = s.eq.emotes; const i = e.indexOf(id); if (i >= 0) { if (e.length > 1) e.splice(i, 1); } else { if (e.length >= 4) e.shift(); e.push(id); } save(); }
