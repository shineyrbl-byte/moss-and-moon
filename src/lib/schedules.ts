// Scheduled orders: "my oat latte every weekday at 8:30". Each one is placed by
// itself 15 minutes before pickup, to pay at the counter, for signed-in guests.
import "server-only";
import { db } from "./db";
import { HOURS, toDateStr } from "./cafe";
import { placeOrder } from "./orders";
import { sendEmail } from "./email";
import { menuLookup } from "./menuStore";
import { describeOptions, type Options } from "./pricing";

export const MAX_SCHEDULES = 5;
export const LEAD_MINUTES = 15;
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ScheduleRow = {
  id: number; customer_id: number; name: string; phone: string; lines: string; days: string; time: string;
  active: number; skip_date: string | null; last_date: string | null; last_order: string | null; created_at: string;
};

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Is this pickup time inside opening hours on every chosen day? Returns the first problem day, or null */
export function badDay(days: number[], time: string) {
  for (const d of days) {
    const [open, close] = HOURS[d];
    if (mins(time) < open * 60 + LEAD_MINUTES || mins(time) > close * 60 - 15) return DAY_NAMES[d];
  }
  return null;
}

/** The next date this schedule will place an order */
export function nextRun(s: Pick<ScheduleRow, "days" | "time" | "skip_date" | "last_date" | "active">, now = new Date()) {
  if (!s.active) return null;
  const days = s.days.split(",").map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const ds = toDateStr(d);
    if (!days.includes(d.getDay()) || ds === s.skip_date || ds === s.last_date) continue;
    if (i === 0 && now.getHours() * 60 + now.getMinutes() > mins(s.time) - LEAD_MINUTES) continue;
    return ds;
  }
  return null;
}

export function describe(s: ScheduleRow) {
  const find = menuLookup();
  return (JSON.parse(s.lines) as { itemId: string; opts: Options; qty: number }[])
    .map((l) => {
      const item = find(l.itemId);
      return item ? `${l.qty} × ${item.name}${describeOptions(item, l.opts) ? ` (${describeOptions(item, l.opts)})` : ""}` : null;
    })
    .filter(Boolean)
    .join(", ");
}

/** Called every minute */
export async function scheduleTick(now = new Date()) {
  const today = toDateStr(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const rows = db.prepare("SELECT * FROM schedules WHERE active = 1 AND (last_date IS NULL OR last_date != ?)").all(today) as ScheduleRow[];
  for (const s of rows) {
    if (!s.days.split(",").map(Number).includes(now.getDay()) || s.skip_date === today) continue;
    const due = mins(s.time) - LEAD_MINUTES;
    if (nowMins < due || nowMins > mins(s.time)) continue; // only in the 15 minutes before pickup
    db.prepare("UPDATE schedules SET last_date = ? WHERE id = ?").run(today, s.id);
    const c = db.prepare("SELECT * FROM customers WHERE id = ?").get(s.customer_id) as { id: number; email: string; referred_by: number | null } | undefined;
    if (!c) continue;
    const res = await placeOrder(
      { name: s.name, phone: s.phone, email: c.email, pickup: s.time, payMethod: "counter", note: "🔁 Regular order", lines: JSON.parse(s.lines) },
      c as never
    );
    const d = await res.json();
    if (res.ok) db.prepare("UPDATE schedules SET last_order = ? WHERE id = ?").run(d.code, s.id);
    else
      await sendEmail(
        c.email,
        "We couldn't place your regular order today",
        `<p>Hi ${s.name}, your regular order (${describe(s)}) for ${s.time} didn't go through: <b>${String(d.error ?? "something went wrong")}</b></p><p>Pop in and we'll sort you out, or order on the site ✿</p>`
      );
  }
}
