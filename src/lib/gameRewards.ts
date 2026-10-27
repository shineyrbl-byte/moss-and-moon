// Café rewards: finish today's five puzzles seven days running and you earn a stamp on your loyalty card
// (one for every seven days of the run). It needs an account with a phone number, since cards go by phone.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { streakWithFreeze } from "./gameOrders";
import { playedMap } from "./gamesStore";
import { fiveDays } from "./todaysFive";
import type { Customer } from "./account";

export const DAYS_PER_STAMP = 7;
const daysAgo = (today: string, n: number) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return toDateStr(d); };

export function rewardStatus(customer: Customer | null, voter: unknown, now = new Date()) {
  const today = toDateStr(now);
  const { streak, frozen } = streakWithFreeze(fiveDays(playedMap(customer?.id ?? null, voter)), today);
  const earned = Math.floor(streak / DAYS_PER_STAMP);
  // Stamps already claimed during this run (it started about streak + frozen days ago)
  const runStart = daysAgo(today, streak + frozen.length);
  const claimed = customer ? (db.prepare("SELECT COUNT(*) AS n FROM game_rewards WHERE customer_id = ? AND claimed_on >= ?").get(customer.id, runStart) as { n: number }).n : 0;
  return { streak, earned, claimed, ready: Math.max(0, earned - claimed), nextIn: DAYS_PER_STAMP - (streak % DAYS_PER_STAMP), signedIn: !!customer, hasPhone: !!customer?.phone };
}
export function claimReward(customer: Customer | null, voter: unknown, now = new Date()) {
  if (!customer) return { error: "Sign in to collect stamps." };
  if (!customer.phone) return { error: "Add your phone number to your account first: stamp cards go by phone." };
  const s = rewardStatus(customer, voter, now);
  if (s.ready < 1) return { error: `Keep going: ${s.nextIn} more day${s.nextIn === 1 ? "" : "s"} of today's five for the next stamp.` };
  db.prepare("INSERT INTO game_rewards (customer_id, claimed_on, streak) VALUES (?, ?, ?)").run(customer.id, toDateStr(now), s.streak);
  db.prepare(`INSERT INTO loyalty (phone, name, stamps) VALUES (?, ?, 1) ON CONFLICT(phone) DO UPDATE SET stamps = stamps + 1`).run(customer.phone, customer.name ?? "");
  const card = db.prepare("SELECT stamps FROM loyalty WHERE phone = ?").get(customer.phone) as { stamps: number };
  return { ...rewardStatus(customer, voter, now), stamps: card.stamps };
}
