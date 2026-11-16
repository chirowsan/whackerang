// trophy421 — kid-safe Trophy Road and per-fighter mastery.
// Trophies only go up. Losses never subtract trophies or drop a rank.
// No global leaderboard, no strangers' names. Rewards are looks, titles and
// stars — never paid fighters or maps (pay421 stays meaningful).
import { S, save } from './save.js';
import { HEROES } from './data.js';
import { addCoins, grantItem, dayKey } from './progress.js';

export const TROPHY_DAY_CAP = 80;

export const RANKS = [
  { id: 'new', name: 'Newcomer', short: 'New', tier: 'new', mark: '', need: 0, color: '#8ea0c8', title: null, reward: null },
  { id: 'b1', name: 'Bronze I', short: 'Bronze I', tier: 'bronze', mark: 'I', need: 20, color: '#c47a4a', title: null, reward: { stars: 20 } },
  { id: 'b2', name: 'Bronze II', short: 'Bronze II', tier: 'bronze', mark: 'II', need: 50, color: '#c47a4a', title: null, reward: { stars: 25, emotes: 'hi' } },
  { id: 'b3', name: 'Bronze III', short: 'Bronze III', tier: 'bronze', mark: 'III', need: 90, color: '#c47a4a', title: 'Boomer Buddy', reward: { stars: 30, sparkles: 'twinkle' } },
  { id: 's1', name: 'Silver I', short: 'Silver I', tier: 'silver', mark: 'I', need: 140, color: '#c5d0e6', title: null, reward: { stars: 40, trails: 'frost' } },
  { id: 's2', name: 'Silver II', short: 'Silver II', tier: 'silver', mark: 'II', need: 200, color: '#c5d0e6', title: null, reward: { stars: 45, hats: 'flower' } },
  { id: 's3', name: 'Silver III', short: 'Silver III', tier: 'silver', mark: 'III', need: 280, color: '#c5d0e6', title: 'Arena Ace', reward: { stars: 50, poses: 'hop' } },
  { id: 'g1', name: 'Gold I', short: 'Gold I', tier: 'gold', mark: 'I', need: 380, color: '#ffd23c', title: null, reward: { stars: 60, skins: 'gold' } },
  { id: 'g2', name: 'Gold II', short: 'Gold II', tier: 'gold', mark: 'II', need: 500, color: '#ffd23c', title: null, reward: { stars: 70, trails: 'heart' } },
  { id: 'g3', name: 'Gold III', short: 'Gold III', tier: 'gold', mark: 'III', need: 650, color: '#ffd23c', title: 'Gold Whacker', reward: { stars: 80, hats: 'halo' } },
  { id: 'star', name: 'Star', short: 'Star', tier: 'star', mark: '★', need: 850, color: '#ffe066', title: 'Whack Star', reward: { stars: 120, hats: 'crown' } },
];

export const MASTERY_NEED = [0, 2, 5, 9, 14, 20, 27, 35, 44, 55]; // level 1..10
export const MASTERY_MAX = 10;
export const MASTERY_REWARDS = { 3: { stars: 15 }, 5: { stars: 25 }, 7: { stars: 40 }, 10: { stars: 60 } };

const REWARD_NAMES = {
  stars: (n) => n + ' stars',
  emotes: (id) => ({ hi: 'Hi! emote', yay: 'Yay! emote', thanks: 'Thanks! emote' }[id] || (id + ' emote')),
  sparkles: (id) => ({ twinkle: 'Twinkle sparkle', petals: 'Petals sparkle', firefly: 'Fireflies sparkle' }[id] || (id + ' sparkle')),
  trails: (id) => ({ frost: 'Frostbite trail', heart: 'Hearts trail', leaf: 'Leafy trail' }[id] || (id + ' trail')),
  hats: (id) => ({ flower: 'Flower hat', halo: 'Halo', crown: 'Crown', sprout: 'Sprout' }[id] || (id + ' hat')),
  poses: (id) => ({ hop: 'Victory hop', spin: 'Spin pose', bow: 'Friendly bow' }[id] || (id + ' pose')),
  skins: (id) => ({ gold: 'Gilded color', mint: 'Minty color' }[id] || (id + ' color')),
  title: (t) => 'Title: ' + t,
};

export function rankByTrophies(n) {
  let r = RANKS[0];
  for (const x of RANKS) if (n >= x.need) r = x;
  return r;
}
export function rankById(id) { return RANKS.find((r) => r.id === id) || RANKS[0]; }
export function nextRank(id) {
  const i = RANKS.findIndex((r) => r.id === id);
  return i >= 0 && i < RANKS.length - 1 ? RANKS[i + 1] : null;
}

export function masteryLevel(plays) {
  let lv = 1;
  for (let i = 0; i < MASTERY_NEED.length; i++) if ((plays || 0) >= MASTERY_NEED[i]) lv = i + 1;
  return Math.min(MASTERY_MAX, lv);
}

function blankTrophy() {
  const mastery = {};
  for (const h of HEROES) mastery[h.id] = { plays: 0, lv: 1, claimed: [1] };
  return { mig: 421, n: 0, day: '', dayN: 0, easyN: 0, easyW: 0, rank: 'new', title: '', claimed: ['new'], mastery, welcome: false };
}

function rollover(t) {
  const key = String(dayKey());
  if (t.day !== key) { t.day = key; t.dayN = 0; t.easyN = 0; t.easyW = 0; }
}

function applyRewards(reward, into) {
  if (!reward) return;
  if (reward.stars) { addCoins(reward.stars, 'trophy'); into.push(REWARD_NAMES.stars(reward.stars)); }
  for (const k of ['emotes', 'sparkles', 'trails', 'hats', 'poses', 'skins']) {
    if (!reward[k]) continue;
    const name = REWARD_NAMES[k](reward[k]);
    if (grantItem(k, reward[k])) into.push(name);
    else { addCoins(15, 'trophy-owned'); into.push('+15 stars (already had ' + name + ')'); }
  }
  if (reward.title) { S().trophy.title = reward.title; into.push(REWARD_NAMES.title(reward.title)); }
}

function claimRanks(t, intoUps) {
  const now = rankByTrophies(t.n);
  t.claimed = t.claimed || ['new'];
  const ups = [];
  for (const r of RANKS) {
    if (r.need > t.n) break;
    if (t.claimed.includes(r.id)) continue;
    t.claimed.push(r.id);
    const got = [];
    if (r.title) { t.title = r.title; got.push(REWARD_NAMES.title(r.title)); }
    applyRewards(r.reward, got);
    ups.push({ rank: r, rewards: got });
    intoUps && intoUps.push({ rank: r, rewards: got });
  }
  t.rank = now.id;
  if (now.title) t.title = now.title;
  return ups;
}

export function ensureTrophy() {
  const s = S();
  if (!s.trophy || s.trophy.mig !== 421) {
    const t = blankTrophy();
    const prev = s.trophy && typeof s.trophy === 'object' ? s.trophy : null;
    if (prev && typeof prev.n === 'number') t.n = Math.max(0, prev.n | 0);
    else {
      const wins = Math.max(0, (s.wins || 0), (s.stats && s.stats.win) || 0);
      const played = Math.max(0, s.played || 0, (s.stats && s.stats.play) || 0);
      const losses = Math.max(0, played - wins);
      // Fair baseline from past play: not as generous as a Hard online win, never a rank drop later.
      t.n = wins * 6 + losses * 2;
    }
    if (prev && prev.mastery) t.mastery = { ...t.mastery, ...prev.mastery };
    for (const h of HEROES) {
      const plays = Math.max(t.mastery[h.id] && t.mastery[h.id].plays || 0, s.stats && s.stats['as:' + h.id] || 0);
      const lv = masteryLevel(plays);
      t.mastery[h.id] = { plays, lv, claimed: (t.mastery[h.id] && t.mastery[h.id].claimed) || [1] };
    }
    s.trophy = t;
    const ups = [];
    claimRanks(t, ups);
    // Mastery cosmetic/star rewards from historical plays: grant, but no celebration spam.
    for (const h of HEROES) claimMastery(t, h.id, true);
    t.welcome = t.n > 0;
    save();
  }
  rollover(s.trophy);
  return s.trophy;
}

function claimMastery(t, heroId, quiet) {
  const m = t.mastery[heroId] || (t.mastery[heroId] = { plays: 0, lv: 1, claimed: [1] });
  m.lv = masteryLevel(m.plays);
  m.claimed = m.claimed || [1];
  const ups = [];
  for (let lv = 2; lv <= m.lv; lv++) {
    if (m.claimed.includes(lv)) continue;
    m.claimed.push(lv);
    const r = MASTERY_REWARDS[lv];
    const got = [];
    if (r) applyRewards(r, got);
    if (lv === 10) {
      const hero = (HEROES.find((h) => h.id === heroId) || { name: heroId }).name;
      const title = hero + ' Master';
      if (!t.title) t.title = title;
      got.push('Master badge');
    }
    ups.push({ heroId, lv, rewards: got });
  }
  return quiet ? [] : ups;
}

export function planAward(ctx = {}) {
  // Pure preview of how many trophies a match would give right now (after rollover).
  const t = ensureTrophy();
  rollover(t);
  if (ctx.tutorial) return { raw: 0, gained: 0, reason: 'tutorial', capLeft: Math.max(0, TROPHY_DAY_CAP - t.dayN), capHit: false };
  let play = 2, winB = 6, reason = 'bots-normal';
  if (ctx.online || ctx.couch) { play = 3; winB = 9; reason = ctx.online ? 'online' : 'couch'; }
  else if (ctx.campaign) { play = 2; winB = 7; reason = 'campaign'; }
  else if ((ctx.diff | 0) >= 2) { play = 2; winB = 8; reason = 'bots-hard'; }
  else if ((ctx.diff | 0) === 1) { play = 2; winB = 6; reason = 'bots-normal'; }
  else {
    // Easy bots: encouraging at first, then quickly shrinks so kids can't farm a rank overnight.
    const n = t.easyN, w = t.easyW;
    if (n >= 10) { play = 0; winB = 0; reason = 'easy-cap'; }
    else if (n >= 6) { play = 1; winB = 0; reason = 'easy-low'; }
    else if (w >= 3 && ctx.won) { play = 1; winB = 1; reason = 'easy-dim'; }
    else { play = 1; winB = 3; reason = 'easy'; }
  }
  const raw = Math.max(0, play + (ctx.won ? winB : 0));
  const capLeft = Math.max(0, TROPHY_DAY_CAP - t.dayN);
  const gained = Math.min(raw, capLeft);
  return { raw, gained, reason, capLeft, capHit: raw > 0 && gained < raw };
}

export function awardMatchTrophies(ctx = {}) {
  const t = ensureTrophy();
  rollover(t);
  const plan = planAward(ctx);
  if (ctx.tutorial) return { gained: 0, capHit: false, n: t.n, rank: rankById(t.rank), prevRank: rankById(t.rank), rankUps: [], rewards: [], masteryUps: [], reason: 'tutorial', dayN: t.dayN };
  const prevRank = rankById(t.rank);
  const easy = !ctx.online && !ctx.couch && !ctx.campaign && (ctx.diff | 0) === 0;
  if (easy) { t.easyN++; if (ctx.won) t.easyW++; }
  t.n += plan.gained;
  t.dayN += plan.gained;
  const rankUps = [];
  claimRanks(t, rankUps);
  let masteryUps = [];
  const heroId = ctx.heroId;
  if (heroId && t.mastery[heroId]) {
    t.mastery[heroId].plays = (t.mastery[heroId].plays || 0) + 1;
    masteryUps = claimMastery(t, heroId, false);
  }
  save();
  return {
    gained: plan.gained, raw: plan.raw, capHit: plan.capHit, reason: plan.reason,
    n: t.n, dayN: t.dayN, capLeft: Math.max(0, TROPHY_DAY_CAP - t.dayN),
    rank: rankById(t.rank), prevRank, rankUps, masteryUps,
    rewards: rankUps.flatMap((u) => u.rewards),
  };
}

export function currentRank() { return rankById(ensureTrophy().rank); }
export function trophyCount() { return ensureTrophy().n; }
export function myRankId() { return ensureTrophy().rank; }
export function myTitle() { return ensureTrophy().title || ''; }
export function masteryOf(id) {
  const t = ensureTrophy();
  const m = t.mastery[id] || { plays: 0, lv: 1 };
  const lv = masteryLevel(m.plays);
  const next = lv >= MASTERY_MAX ? null : MASTERY_NEED[lv];
  return { plays: m.plays || 0, lv, next, need: next == null ? m.plays : next };
}

// SVG medal. Original simple badge: rimmed disc with a mark, not copied from any game.
export function rankBadgeHtml(rank, size = 28) {
  const r = typeof rank === 'string' ? rankById(rank) : (rank || RANKS[0]);
  const c = r.color;
  const s = Math.max(16, size | 0);
  const mark = r.tier === 'star' ? '★' : (r.mark || '');
  const font = r.tier === 'star' ? s * 0.52 : (mark.length > 2 ? s * 0.32 : s * 0.38);
  return `<span class="rbadge r-${r.tier}" data-rank="${r.id}" title="${r.name}" style="width:${s}px;height:${s}px">` +
    `<svg viewBox="0 0 32 32" width="${s}" height="${s}" aria-hidden="true">` +
    `<circle cx="16" cy="16" r="14" fill="${c}" stroke="#1a1430" stroke-width="2"/>` +
    `<circle cx="16" cy="16" r="10.5" fill="#fff6e8" fill-opacity="0.45" stroke="#fff8" stroke-width="1.6"/>` +
    (r.tier === 'new' ? `<path d="M16 8c2 3 3 5 3 8 0 2-1 4-3 6-2-2-3-4-3-6 0-3 1-5 3-8z" fill="#dff5c8"/>` : '') +
    `</svg>` +
    (mark ? `<em style="font-size:${font}px">${mark}</em>` : '') +
    `</span>`;
}

// Test helpers (STORE-off hooks). grantTrophies ignores the daily cap when force is true.
export function grantTrophies(n, opts = {}) {
  const t = ensureTrophy();
  const prev = rankById(t.rank);
  const add = Math.max(0, n | 0);
  if (!opts.force) {
    rollover(t);
    const room = Math.max(0, TROPHY_DAY_CAP - t.dayN);
    const g = Math.min(add, room);
    t.n += g; t.dayN += g;
  } else t.n += add;
  const rankUps = [];
  claimRanks(t, rankUps);
  save();
  return { n: t.n, rank: rankById(t.rank), prevRank: prev, rankUps };
}

export function setTrophyDay(key) {
  const t = ensureTrophy();
  t.day = key == null ? '' : String(key);
  if (key != null) { t.dayN = 0; t.easyN = 0; t.easyW = 0; }
  save();
  return t;
}
