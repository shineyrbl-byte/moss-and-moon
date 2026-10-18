// Group orders: friends add their own drinks to one shared tray from their phones,
// then the host checks out once and everyone can pay their own part.
import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { cleanOptions, describeOptions, orderDue, unitPrice, type Options } from "./pricing";
import { menuLookup } from "./menuStore";
import type { MoneyRow } from "./orderMoney";

export const GROUP_MAX_ITEMS = 60;
export const GROUP_MAX_PEOPLE = 12;

type GroupRow = { code: string; host_name: string; host_token: string; status: "open" | "placed"; order_code: string | null; created_at: string };
type ItemRow = { id: number; person: string; item_id: string; opts: string; qty: number };

export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const newToken = () => crypto.randomBytes(18).toString("base64url");

export function getGroup(code: string) {
  return db.prepare("SELECT * FROM groups WHERE code = ?").get(code.toUpperCase()) as GroupRow | undefined;
}

export const isHost = (g: GroupRow, token: unknown) => typeof token === "string" && token.length > 10 && hashToken(token) === g.host_token;

/** Everyone's items, priced from the live menu, plus each person's share of the final bill */
export function groupSummary(code: string) {
  const g = getGroup(code);
  if (!g) return null;
  const find = menuLookup();
  const rows = db.prepare("SELECT id, person, item_id, opts, qty FROM group_items WHERE group_code = ? ORDER BY id").all(g.code) as ItemRow[];
  const people = new Map<string, { person: string; items: { id: number; itemId: string; opts: Options; name: string; note: string; qty: number; price: number }[]; subtotal: number }>();
  for (const r of rows) {
    const item = find(r.item_id);
    if (!item) continue;
    const opts = cleanOptions(item, JSON.parse(r.opts) as Options);
    const price = unitPrice(item, opts) * r.qty;
    const p = people.get(r.person) ?? { person: r.person, items: [], subtotal: 0 };
    p.items.push({ id: r.id, itemId: r.item_id, opts, name: item.name, note: describeOptions(item, opts), qty: r.qty, price });
    p.subtotal += price;
    people.set(r.person, p);
  }
  const list = [...people.values()];
  const subtotal = list.reduce((s, p) => s + p.subtotal, 0);

  // Once the order is placed, discounts, tips and delivery are shared in proportion to what each person ordered
  let order: (MoneyRow & { code: string; pay_status: string }) | undefined;
  let paidBy: Record<string, number> = {};
  if (g.order_code) {
    order = db.prepare("SELECT code, total, giftcard_used, credit_used, tip, delivery_fee, pay_status FROM orders WHERE code = ?").get(g.order_code) as typeof order;
    const paid = db.prepare("SELECT person, SUM(amount) AS s FROM order_payments WHERE order_code = ? AND status = 'paid' AND person IS NOT NULL GROUP BY person").all(g.order_code) as { person: string; s: number }[];
    paidBy = Object.fromEntries(paid.map((p) => [p.person, p.s]));
  }
  const due = order ? orderDue(order) : subtotal;
  const shares = list.map((p) => ({
    ...p,
    share: subtotal ? Math.ceil((due * p.subtotal) / subtotal) : 0,
    paid: paidBy[p.person] ?? 0,
  }));
  return {
    code: g.code,
    host: g.host_name,
    status: g.status,
    orderCode: g.order_code,
    orderPaid: order?.pay_status === "paid",
    createdAt: g.created_at,
    people: shares,
    subtotal,
    due,
    itemCount: rows.length,
  };
}

/** What one person still owes on a placed group order */
export function personShare(orderCode: string, person: string) {
  const g = db.prepare("SELECT code FROM groups WHERE order_code = ?").get(orderCode) as { code: string } | undefined;
  if (!g) return null;
  const s = groupSummary(g.code);
  const p = s?.people.find((x) => x.person === person);
  if (!p) return null;
  return Math.max(0, p.share - p.paid);
}
