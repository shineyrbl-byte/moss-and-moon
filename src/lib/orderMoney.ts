// Money helpers for orders that are paid in several parts (split bills).
import "server-only";
import { db } from "./db";
import { orderDue } from "./pricing";

/** Money already paid towards an order in split shares */
export const paidShares = (code: string) =>
  (db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM order_payments WHERE order_code = ? AND status = 'paid'").get(code) as { s: number }).s;

export type MoneyRow = { total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number };

/** Still to pay = what's due minus shares already paid */
export const stillToPay = (code: string, o: MoneyRow) => Math.max(0, orderDue(o) - paidShares(code));


/** Pay for what I had: how many of each line are already paid (or being paid right now) */
export function claimedItems(code: string): Record<number, number> {
  const rows = db.prepare("SELECT items FROM order_payments WHERE order_code = ? AND items IS NOT NULL AND (status = 'paid' OR (status = 'pending' AND created_at >= datetime('now','localtime','-15 minutes')))").all(code) as { items: string }[];
  const out: Record<number, number> = {};
  for (const r of rows) for (const [i, n] of Object.entries(JSON.parse(r.items) as Record<string, number>)) out[Number(i)] = (out[Number(i)] ?? 0) + n;
  return out;
}

/** The share for some items: their part of the lines' value, applied to what's due (so discounts, tip and delivery are shared fairly) */
export function itemsShare(lines: { qty: number; total: number }[], pick: Record<number, number>, due: number) {
  const gross = lines.reduce((s, l) => s + l.total, 0) || 1;
  const part = Object.entries(pick).reduce((s, [i, n]) => s + (lines[Number(i)].total / lines[Number(i)].qty) * n, 0);
  return Math.round((part / gross) * due);
}
