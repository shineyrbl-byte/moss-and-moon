// Daily cash-up: what the counter should have taken vs what staff counted
import "server-only";
import { alertOwner } from "./push";
import { db } from "./db";
import { orderDue } from "./pricing";

export type Cashup = { day: string; float_start: number; cash: number; upi: number; card: number; expected: number; note: string | null; staff_name: string | null; created_at: string };

/** Money the counter should hold for a day: counter orders collected that day, minus counter refunds */
export function expectedTakings(day: string) {
  const rows = db.prepare(
    "SELECT total, giftcard_used, credit_used, tip, delivery_fee, refund_amount FROM orders WHERE pay_method = 'counter' AND pay_status IN ('paid','refunded') AND date(COALESCE(collected_at, created_at)) = ?",
  ).all(day) as (Parameters<typeof orderDue>[0] & { refund_amount: number })[];
  const takings = rows.reduce((s, r) => s + orderDue(r) - (r.refund_amount ?? 0), 0);
  const unpaid = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE pay_method = 'counter' AND pay_status = 'unpaid' AND status != 'cancelled' AND date(created_at) = ?").get(day) as { n: number }).n;
  return { expected: Math.round(takings), orders: rows.length, unpaid };
}

/** Counted minus expected (positive = over, negative = short) */
export const difference = (c: Pick<Cashup, "float_start" | "cash" | "upi" | "card" | "expected">) => Math.round(c.cash - c.float_start + c.upi + c.card - c.expected);

export function getCashup(day: string) {
  return (db.prepare("SELECT * FROM cashups WHERE day = ?").get(day) as Cashup | undefined) ?? null;
}

export function saveCashup(day: string, v: { float: number; cash: number; upi: number; card: number; note: string }, staff: { id: number; name: string }) {
  const { expected } = expectedTakings(day);
  db.prepare(
    `INSERT INTO cashups (day, float_start, cash, upi, card, expected, note, staff_id, staff_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET float_start = excluded.float_start, cash = excluded.cash, upi = excluded.upi, card = excluded.card, expected = excluded.expected, note = excluded.note, staff_id = excluded.staff_id, staff_name = excluded.staff_name, created_at = datetime('now','localtime')`,
  ).run(day, v.float, v.cash, v.upi, v.card, expected, v.note || null, staff.id || null, staff.name);
  const c = getCashup(day)!;
  const diff = difference(c);
  if (Math.abs(diff) >= 50) alertOwner("cashup", `Cash-up ${diff > 0 ? "over" : "short"} by ₹${Math.abs(diff)}`, `${staff.name}${v.note ? `: ${v.note}` : ""}`, "/admin#Cash-up");
  return c;
}
