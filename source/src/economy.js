// Gold economy: earn rules, daily login streak, bonus placeholder, local ledger mirror, parental gate.
// The authoritative ledger lives on the server (server/); this module keeps a local mirror for offline play.
import { S, save } from './save.js';

export const EARN = {
  win: 30, play: 8, ko: 5, catchStar: 15, firstClear: 60, level: (lv) => 40 + lv * 10, bossRushBoss: 20, bossRushClear: 60, bonus: 25, bonusPerDay: 3,
  streak: [20, 30, 40, 50, 60, 80, 120],
};
const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

export function ledgerAdd(delta, reason, src, ref) {
  const s = S(); s.ledger = s.ledger || []; s.ledger.push({ t: Date.now(), d: delta, r: reason, src, ref: ref || null, bal: s.coins }); if (s.ledger.length > 80) s.ledger.splice(0, s.ledger.length - 80);
  if (src === 'earn' && delta > 0) { const e = earnToday(); e.total += delta; e.by[reason] = (e.by[reason] || 0) + delta; }
}
export function earnToday() { const s = S(); const k = String(dayKey()); if (!s.earnDay || s.earnDay.date !== k) s.earnDay = { date: k, total: 0, by: {}, bonus: 0 }; return s.earnDay; }

// ---- daily login streak (no penalty for missing a day beyond restarting the ladder)
export function streakInfo() {
  const s = S(); const st = s.streak || { last: 0, n: 0 }; const today = dayKey(); const claimedToday = st.last === today;
  const alive = st.last === yesterdayKey() || claimedToday; const n = alive ? st.n : 0; const next = claimedToday ? n : n + 1; const idx = Math.min(EARN.streak.length, next) - 1;
  return { n, claimedToday, next, reward: EARN.streak[idx], ladder: EARN.streak };
}
export function claimStreak() {
  const s = S(); const info = streakInfo(); if (info.claimedToday) return 0; s.streak = { last: dayKey(), n: info.next }; s.coins += info.reward; ledgerAdd(info.reward, 'streak', 'earn'); s.totalCoins = (s.totalCoins || 0) + info.reward; save(); return info.reward;
}
// ---- rewarded-style bonus PLACEHOLDER (no ad is shown; wire to a kid-safe rewarded ad SDK only after review)
export function bonusLeft() { return Math.max(0, EARN.bonusPerDay - earnToday().bonus); }
export function claimBonus() { if (bonusLeft() <= 0) return 0; const s = S(); earnToday().bonus++; s.coins += EARN.bonus; s.totalCoins = (s.totalCoins || 0) + EARN.bonus; ledgerAdd(EARN.bonus, 'bonus', 'earn'); save(); return EARN.bonus; }

// ---- parental gate placeholder: a grown-up question before the Buy tab. Not a substitute for a certified COPPA flow.
let gateOk = 0;
export const gatePassed = () => Date.now() < gateOk;
export function gateQuestion() { const a = 12 + Math.floor(Math.random() * 40), b = 11 + Math.floor(Math.random() * 30); const ans = a + b; const opts = new Set([ans]); while (opts.size < 4) opts.add(ans + [-10, -3, 3, 10, 7, -7][Math.floor(Math.random() * 6)]); return { text: `Ask a grown-up: what is ${a} + ${b}?`, ans, opts: [...opts].sort(() => Math.random() - 0.5) }; }
export function gatePass() { gateOk = Date.now() + 10 * 60 * 1000; }
