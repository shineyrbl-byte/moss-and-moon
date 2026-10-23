// Pay it forward: coffees guests have paid for, waiting for anyone who needs one.
// Staff hand them out at the counter, oldest first; it goes into the queue already paid.
import "server-only";
import { db } from "./db";
import { placeOrder } from "./orders";
import { toDateStr } from "./cafe";

const WAITING = "forward = 1 AND paid = 1 AND order_code IS NULL AND expires >= ?";

export function forwardCounts() {
  const today = toDateStr(new Date());
  const one = (sql: string, ...p: string[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  return {
    waiting: one(`SELECT COUNT(*) AS n FROM drink_gifts WHERE ${WAITING}`, today),
    given: one("SELECT COUNT(*) AS n FROM drink_gifts WHERE forward = 1 AND paid = 1 AND order_code IS NOT NULL AND order_code != 'claiming'"),
  };
}

/** Staff: hand out the oldest waiting coffee. Returns the new order's code. */
export async function giveForward(name: string): Promise<{ ok: true; orderCode: string; drink: string } | { error: string; status: number }> {
  const g = db.prepare(`SELECT code, item_id, item_name, opts FROM drink_gifts WHERE ${WAITING} ORDER BY expires, created_at LIMIT 1`).get(toDateStr(new Date())) as { code: string; item_id: string; item_name: string; opts: string } | undefined;
  if (!g) return { error: "No coffees waiting right now.", status: 404 };
  if (!db.prepare("UPDATE drink_gifts SET order_code = 'claiming' WHERE code = ? AND order_code IS NULL").run(g.code).changes) return { error: "Someone just handed that one out. Try again.", status: 409 };
  const res = await placeOrder(
    { name: name || "Pay it forward", phone: "", note: `☕ Paid forward ${g.code}`, lines: [{ itemId: g.item_id, opts: JSON.parse(g.opts), qty: 1 }] },
    null,
    { prepaid: { method: "drinkgift", ref: g.code } },
  );
  const d = await res.json();
  if (!res.ok) {
    db.prepare("UPDATE drink_gifts SET order_code = NULL WHERE code = ?").run(g.code);
    return { error: d.error ?? "Couldn't make the order.", status: res.status };
  }
  db.prepare("UPDATE drink_gifts SET order_code = ?, redeemed_at = datetime('now','localtime') WHERE code = ?").run(d.code, g.code);
  return { ok: true, orderCode: d.code, drink: g.item_name };
}
