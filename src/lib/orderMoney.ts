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
