// Picking a table when booking, and food/drinks ordered ahead to be ready on arrival
import "server-only";
import { db } from "./db";
import { FLOOR, PREORDER_LEAD, TABLE_GAP, floorTable } from "./floor";
import { menuLookup } from "./menuStore";
import { cleanOptions, describeOptions, unitPrice, type Options } from "./pricing";
import { placeOrder } from "./orders";
import { sendEmail } from "./email";
import { hoursOn, toDateStr } from "./cafe";

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Tables already booked within 90 minutes of this time */
export function takenTables(date: string, time: string, exceptCode?: string) {
  const rows = db.prepare("SELECT code, time, table_no FROM bookings WHERE date = ? AND branch = 'main' AND table_no IS NOT NULL AND status IN ('confirmed','seated','pending')").all(date) as { code: string; time: string; table_no: number }[];
  return new Set(rows.filter((r) => r.code !== exceptCode && Math.abs(mins(r.time) - mins(time)) < TABLE_GAP).map((r) => r.table_no));
}

/** Every table with whether it's free at this time and fits the group */
export function tablesAt(date: string, time: string, guests: number) {
  const taken = takenTables(date, time);
  return FLOOR.map((t) => ({ ...t, free: !taken.has(t.no), fits: t.seats >= guests && (guests > 2 || t.seats <= 4) }));
}

export function checkTable(no: number, date: string, time: string, guests: number): string | null {
  const t = floorTable(no);
  if (!t) return "That table doesn't exist.";
  if (t.seats < guests) return `Table ${no} seats ${t.seats}. Pick a bigger one?`;
  if (takenTables(date, time).has(no)) return `Table ${no} is booked around then. Pick another, or let us choose.`;
  return null;
}

export type PreLine = { itemId: string; opts: Options; qty: number };

/** Clean up pre-order lines; returns the lines and a priced summary */
export function cleanPreorder(raw: unknown) {
  if (!Array.isArray(raw) || !raw.length) return { lines: [] as PreLine[], items: [] as string[], total: 0 };
  const find = menuLookup();
  const lines: PreLine[] = [];
  const items: string[] = [];
  let total = 0;
  for (const r of raw.slice(0, 12) as { itemId?: unknown; opts?: unknown; qty?: unknown }[]) {
    const item = find(String(r?.itemId ?? ""));
    if (!item || item.cat === "shop") continue;
    const qty = Math.min(10, Math.max(1, Math.floor(Number(r?.qty) || 1)));
    const opts = cleanOptions(item, r?.opts);
    lines.push({ itemId: item.id, opts, qty });
    const d = describeOptions(item, opts);
    items.push(`${qty} × ${item.name}${d ? ` (${d})` : ""}`);
    total += unitPrice(item, opts) * qty;
  }
  return { lines, items, total };
}

type Row = { code: string; name: string; phone: string; email: string | null; date: string; time: string; guests: number; table_no: number | null; preorder: string; branch: string };

/** Called every minute: send each pre-order to the kitchen 15 minutes before the booking */
export async function preorderTick(now = new Date()) {
  const today = toDateStr(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const rows = db.prepare("SELECT code, name, phone, email, date, time, guests, table_no, preorder, branch FROM bookings WHERE date = ? AND status IN ('confirmed','seated') AND preorder IS NOT NULL AND preorder_code IS NULL").all(today) as Row[];
  for (const b of rows) {
    if (!hoursOn(now, b.branch)) continue;
    const due = mins(b.time) - PREORDER_LEAD;
    if (nowMins < due) continue;
    if (nowMins > mins(b.time) + 60) { // the server was down: too late to make it now
      db.prepare("UPDATE bookings SET preorder_code = 'missed' WHERE code = ?").run(b.code);
      continue;
    }
    // Claim it first so two ticks can't both place it
    if (db.prepare("UPDATE bookings SET preorder_code = 'placing' WHERE code = ? AND preorder_code IS NULL").run(b.code).changes === 0) continue;
    const customer = b.email ? db.prepare("SELECT * FROM customers WHERE email = ?").get(b.email) : null;
    const res = await placeOrder(
      { name: b.name, phone: b.phone, email: b.email ?? undefined, table: b.table_no ?? undefined, pickup: mins(b.time) > nowMins ? b.time : "asap", branch: b.branch, payMethod: "counter", note: `📅 Pre-order for booking ${b.code} (${b.guests} at ${b.time})`, lines: JSON.parse(b.preorder) },
      (customer ?? null) as never,
    );
    const d = await res.json().catch(() => ({}));
    if (res.ok) db.prepare("UPDATE bookings SET preorder_code = ? WHERE code = ?").run(d.code, b.code);
    else {
      db.prepare("UPDATE bookings SET preorder_code = 'failed' WHERE code = ?").run(b.code);
      if (b.email) await sendEmail(b.email, "We couldn't prepare your pre-order", `<p>Hi ${esc(b.name)}, your table is still booked for ${esc(b.time)}, but your pre-order didn't go through: <b>${esc(String(d.error ?? "something went wrong"))}</b>. Order when you arrive and we'll be quick ✿</p>`);
    }
  }
}
