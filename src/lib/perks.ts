// Guest perks: coffee pass, birthday treat, invite-a-friend credit.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import type { Customer } from "./account";
import { tierFor, type TierId } from "./tiers";

/** The guest's coffee pass if one is active today */
export function activePass(customerId: number) {
  const today = toDateStr(new Date());
  return db.prepare("SELECT id, starts, ends FROM passes WHERE customer_id = ? AND paid = 1 AND starts <= ? AND ends >= ? ORDER BY ends DESC LIMIT 1").get(customerId, today, today) as
    | { id: number; starts: string; ends: string }
    | undefined;
}

export function passUsedToday(customerId: number) {
  return !!db.prepare("SELECT 1 FROM pass_uses WHERE customer_id = ? AND day = ?").get(customerId, toDateStr(new Date()));
}

/** Birthday week = 3 days either side of the birthday, once a year */
export function birthdayTreatAvailable(c: Customer, now = new Date()) {
  if (!c.birthday || c.birthday_treat_year === now.getFullYear()) return false;
  const [m, d] = c.birthday.split("-").map(Number);
  for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const bday = new Date(year, m - 1, d);
    if (Math.abs(bday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) <= 3 * 86_400_000) return true;
  }
  return false;
}

/** What perks this signed-in guest can use right now */
/** Visits (orders) in the last year, for loyalty tiers */
export const yearVisits = (customerId: number) =>
  (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND created_at >= datetime('now','localtime','-365 days')").get(customerId) as { n: number }).n;

export function perksFor(c: Customer | null) {
  if (!c) return { credit: 0, birthdayTreat: false, passDrink: false, pass: null as ReturnType<typeof activePass> | null, tier: "bronze" as TierId, tierInfo: tierFor(0), student: false, studentUntil: null as string | null };
  const pass = activePass(c.id) ?? null;
  const tierInfo = tierFor(yearVisits(c.id));
  return { credit: c.credit, birthdayTreat: birthdayTreatAvailable(c), passDrink: !!pass && !passUsedToday(c.id), pass, tier: tierInfo.id, tierInfo, student: !!c.student_until && c.student_until >= toDateStr(new Date()), studentUntil: c.student_until ?? null };
}
