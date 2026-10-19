// Table tabs: every round ordered from the same table goes on one running tab, paid together at the end
import "server-only";
import { db } from "./db";
import { orderDue } from "./pricing";
import { paidShares } from "./orderMoney";

/** A tab left open longer than this is treated as finished (a new group has sat down) */
const TAB_HOURS = 5;
type TabOrder = { code: string; name: string; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; pay_status: string; status: string; lines: string; created_at: string };

export function openTabFor(tableNo: number, branch = "main") {
  const t = db.prepare(`SELECT id FROM table_tabs WHERE table_no = ? AND branch = ? AND status = 'open' AND opened_at >= datetime('now','localtime', ?) ORDER BY id DESC LIMIT 1`).get(tableNo, branch, `-${TAB_HOURS} hours`) as { id: number } | undefined;
  if (t) return t.id;
  // Anything older for this table is closed off first
  db.prepare("UPDATE table_tabs SET status = 'closed', closed_at = datetime('now','localtime') WHERE table_no = ? AND branch = ? AND status = 'open'").run(tableNo, branch);
  return Number(db.prepare("INSERT INTO table_tabs (table_no, branch) VALUES (?, ?)").run(tableNo, branch).lastInsertRowid);
}

export const tabOfOrder = (code: string) => (db.prepare("SELECT tab_id FROM orders WHERE code = ?").get(code) as { tab_id: number | null } | undefined)?.tab_id ?? null;

export function tabSummary(tabId: number) {
  const tab = db.prepare("SELECT id, table_no, status, opened_at FROM table_tabs WHERE id = ?").get(tabId) as { id: number; table_no: number; status: string; opened_at: string } | undefined;
  if (!tab) return null;
  const orders = db.prepare("SELECT code, name, total, giftcard_used, credit_used, tip, delivery_fee, pay_status, status, lines, created_at FROM orders WHERE tab_id = ? AND status != 'cancelled' ORDER BY id").all(tabId) as TabOrder[];
  const rows = orders.map((o) => {
    const due = orderDue(o);
    const left = o.pay_status === "paid" || o.pay_status === "refunded" ? 0 : Math.max(0, due - paidShares(o.code));
    return { code: o.code, name: o.name, due, left, status: o.status, items: (JSON.parse(o.lines) as { qty: number; name: string }[]).map((l) => `${l.qty} × ${l.name}`).join(", "), at: o.created_at.slice(11, 16) };
  });
  return { ...tab, orders: rows, total: rows.reduce((s, r) => s + r.due, 0), left: rows.reduce((s, r) => s + r.left, 0) };
}

/** Everything still to pay on the tab, paid in one go */
export function payTab(tabId: number, method: "online" | "counter", ref: string | null) {
  const codes = (db.prepare("SELECT code FROM orders WHERE tab_id = ? AND pay_status NOT IN ('paid','refunded') AND status != 'cancelled'").all(tabId) as { code: string }[]).map((r) => r.code);
  const upd = db.prepare("UPDATE orders SET pay_status = 'paid', pay_method = ?, payment_ref = COALESCE(?, payment_ref) WHERE code = ? AND pay_status NOT IN ('paid','refunded')");
  for (const c of codes) upd.run(method, ref, c);
  db.prepare("UPDATE table_tabs SET status = 'paid', closed_at = datetime('now','localtime') WHERE id = ?").run(tabId);
  return codes;
}

/** Staff: open tabs with something on them */
export const openTabs = () =>
  (db.prepare(`SELECT id FROM table_tabs WHERE status = 'open' AND opened_at >= datetime('now','localtime', ?) ORDER BY table_no`).all(`-${TAB_HOURS} hours`) as { id: number }[])
    .map((t) => tabSummary(t.id)!)
    .filter((t) => t.orders.length);
