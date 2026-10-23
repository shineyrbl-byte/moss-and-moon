// "Your year at Moss & Moon": a page of your last 12 months, any time you like
// (the anniversary email sends a short version once a year).
import "server-only";
import { db } from "./db";
import { yearInCoffee } from "./anniversary";
import { badgesFor } from "./badgeStore";
import { passportFor } from "./passport";
import { triviaBest } from "./triviaStore";
import type { QuoteLine } from "./pricing";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function yearFor(c: { id: number; email: string; name: string | null; phone: string | null }) {
  const created = (db.prepare("SELECT created_at FROM customers WHERE id = ?").get(c.id) as { created_at: string }).created_at;
  const y = yearInCoffee({ ...c, created_at: created });
  const orders = db.prepare("SELECT lines, created_at FROM orders WHERE (customer_id = ? OR lower(email) = lower(?)) AND created_at >= datetime('now','localtime','-365 days') AND status != 'cancelled' AND sim = 0").all(c.id, c.email) as { lines: string; created_at: string }[];
  const items = new Map<string, number>();
  const months = new Map<number, number>();
  for (const o of orders) {
    for (const l of JSON.parse(o.lines) as QuoteLine[]) items.set(l.name, (items.get(l.name) ?? 0) + l.qty);
    const m = Number(o.created_at.slice(5, 7)) - 1;
    months.set(m, (months.get(m) ?? 0) + 1);
  }
  const top = [...items].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, times]) => ({ name, times }));
  const busiest = [...months].sort((a, b) => b[1] - a[1])[0];
  const b = badgesFor(c);
  const one = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  return {
    name: c.name?.split(" ")[0] ?? null,
    since: created.slice(0, 10),
    visits: y.visits, cups: y.cups, spent: y.spent, when: y.when,
    top, tried: items.size,
    busiestMonth: busiest ? { month: MONTHS[busiest[0]], visits: busiest[1] } : null,
    bestStreak: b.streak.best,
    badges: b.badges.filter((x) => x.earned).length, badgesTotal: b.badges.length,
    stamps: passportFor(c.id).done,
    bingos: one("SELECT COUNT(*) AS n FROM bingo_claims WHERE customer_id = ?", c.id),
    triviaBest: triviaBest(c.id),
    caffeine: one("SELECT COALESCE(SUM(caffeine), 0) AS n FROM coffee_diary WHERE customer_id = ? AND created_at >= datetime('now','localtime','-365 days')", c.id),
    forward: one("SELECT COUNT(*) AS n FROM drink_gifts WHERE from_email = ? AND paid = 1 AND forward = 1", c.email),
  };
}
