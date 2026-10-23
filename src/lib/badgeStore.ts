// Gathers a signed-in guest's orders for their badges, and spots newly earned ones
import "server-only";
import { db } from "./db";
import { computeBadges, type BadgeOrder } from "./badges";
import { toDateStr } from "./cafe";
import { triviaBest } from "./triviaStore";
import type { QuoteLine } from "./pricing";

export function badgesFor(customer: { id: number; email: string }) {
  const rows = db.prepare("SELECT created_at, lines, tip, group_code FROM orders WHERE customer_id = ? ORDER BY id").all(customer.id) as { created_at: string; lines: string; tip: number; group_code: string | null }[];
  const orders: BadgeOrder[] = rows.map((r) => ({ created_at: r.created_at, lines: JSON.parse(r.lines) as QuoteLine[], tip: r.tip, hosted: !!r.group_code }));
  const one = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const extras = {
    reviews: one("SELECT COUNT(*) AS n FROM reviews r JOIN orders o ON o.code = r.order_code WHERE o.customer_id = ?", customer.id),
    tickets: one("SELECT COUNT(*) AS n FROM tickets WHERE email = ? AND paid = 1", customer.email),
    giftsSent: one("SELECT COUNT(*) AS n FROM drink_gifts WHERE from_email = ? AND paid = 1 AND forward = 0", customer.email),
    forwardGiven: one("SELECT COUNT(*) AS n FROM drink_gifts WHERE from_email = ? AND paid = 1 AND forward = 1", customer.email),
    triviaBest: triviaBest(customer.id),
  };
  return computeBadges(orders, extras, toDateStr(new Date()));
}

/** Badges earned since we last looked (and remember them) */
export function newBadges(customer: { id: number; email: string }) {
  const { badges } = badgesFor(customer);
  const row = db.prepare("SELECT badges FROM customers WHERE id = ?").get(customer.id) as { badges: string | null } | undefined;
  const seen = new Set<string>(JSON.parse(row?.badges ?? "[]"));
  const earned = badges.filter((b) => b.earned);
  db.prepare("UPDATE customers SET badges = ? WHERE id = ?").run(JSON.stringify(earned.map((b) => b.id)), customer.id);
  return earned.filter((b) => !seen.has(b.id)).map((b) => ({ id: b.id, icon: b.icon, name: b.name }));
}
