// The monthly report for the owner: last month at a glance (orders, takings, bookings, event tickets, reviews,
// games and guest posts), emailed on the 1st and viewable any time in Admin.
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { rupees, type QuoteLine } from "./pricing";
import { ownerEmail, ownerPref } from "./owner";
import { sendEmail } from "./email";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const nextMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
const prevMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };
export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const lastMonth = (now = new Date()) => prevMonth(monthOf(now));

function totals(m: string) {
  const from = `${m}-01`, to = `${nextMonth(m)}-01`;
  const orders = db.prepare("SELECT total, lines FROM orders WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'").all(from, to) as { total: number; lines: string }[];
  const dishes = new Map<string, number>();
  for (const o of orders) for (const l of JSON.parse(o.lines) as QuoteLine[]) dishes.set(l.name, (dishes.get(l.name) ?? 0) + l.qty);
  const one = <T,>(sql: string) => db.prepare(sql).get(from, to) as T;
  return {
    orders: orders.length, takings: orders.reduce((s, o) => s + o.total, 0),
    topDishes: [...dishes].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })),
    bookings: one<{ n: number; g: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(guests), 0) AS g FROM bookings WHERE date >= ? AND date < ? AND status != 'cancelled'"),
    tickets: one<{ n: number }>("SELECT COALESCE(SUM(qty), 0) AS n FROM tickets WHERE created_at >= ? AND created_at < ? AND (paid = 1 OR amount = 0)").n,
    reviews: one<{ n: number; avg: number | null }>("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE created_at >= ? AND created_at < ?"),
    puzzles: one<{ n: number; p: number }>("SELECT COUNT(*) AS n, COUNT(DISTINCT voter) AS p FROM daily_scores WHERE date >= ? AND date < ?"),
    photos: one<{ n: number }>("SELECT COUNT(*) AS n FROM guest_photos WHERE created_at >= ? AND created_at < ? AND status = 'approved'").n,
  };
}
/** A month's report, with the month before to compare */
export function monthlyReport(month: string) {
  const m = /^\d{4}-\d{2}$/.test(month) ? month : lastMonth();
  return { month: m, label: new Date(`${m}-15T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }), now: totals(m), before: totals(prevMonth(m)) };
}
const vs = (a: number, b: number) => (b ? ` <span style="color:#8a6a5c">(${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 100))}% on the month before)</span>` : "");
export function monthlyEmail(r: ReturnType<typeof monthlyReport>) {
  const { now: n, before: b } = r;
  const row = (label: string, value: string, cmp = "") => `<tr><td style="padding:4px 12px 4px 0;color:#8a6a5c">${label}</td><td style="padding:4px 0"><b>${value}</b>${cmp}</td></tr>`;
  return [`${r.label} at Moss & Moon 📅`, `<h3 style="font-family:Georgia,serif;font-weight:normal;margin:0 0 8px">${esc(r.label)} at a glance</h3>
    <table style="border-collapse:collapse;font-size:14px">
      ${row("Orders", String(n.orders), vs(n.orders, b.orders))}${row("Takings", rupees(n.takings), vs(n.takings, b.takings))}
      ${row("Table bookings", `${n.bookings.n} (${n.bookings.g} guests)`, vs(n.bookings.n, b.bookings.n))}${row("Event places", String(n.tickets))}
      ${row("Reviews", n.reviews.n ? `${n.reviews.n}, averaging ${(n.reviews.avg ?? 0).toFixed(1)} ★` : "none")}
      ${row("Daily puzzles saved", `${n.puzzles.n} by ${n.puzzles.p} players`, vs(n.puzzles.n, b.puzzles.n))}${row("Guest photos approved", String(n.photos))}
    </table>
    ${n.topDishes.length ? `<p style="margin:16px 0 4px"><b>Most ordered</b></p><ol style="margin:0;padding-left:20px">${n.topDishes.map((d) => `<li>${esc(d.name)} · ${d.qty}</li>`).join("")}</ol>` : ""}
    <p style="color:#8a6a5c;font-size:12px;margin-top:18px">Cancelled orders and bookings aren't counted. The full numbers are in Admin → Analytics.</p>`] as const;
}
/** On the 1st, from 9am: last month's report to the owner (once) */
export async function monthlyTick(now = new Date()) {
  if (now.getDate() !== 1 || now.getHours() < 9 || !ownerPref("daily_summary") || !ownerEmail()) return;
  const m = lastMonth(now);
  if (getSetting("monthly_sent") === m) return;
  setSetting("monthly_sent", m);
  await sendEmail(ownerEmail(), ...monthlyEmail(monthlyReport(m)));
}
