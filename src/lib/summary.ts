// The nightly "how did today go?" email for the owner.
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { hoursOn, toDateStr } from "./cafe";
import { orderDue, rupees, type QuoteLine } from "./pricing";
import { ownerEmail, ownerPref } from "./owner";
import { sendEmail } from "./email";
import { difference, getCashup } from "./cashup";
import { checklistSummary } from "./checklists";
import { dueEquipment } from "./equipment";
import { batchAlerts } from "./batches";

type Day = { orders: number; revenue: number; tips: number };

function dayTotals(day: string): Day {
  const rows = db.prepare("SELECT total, giftcard_used, credit_used, tip, delivery_fee FROM orders WHERE date(created_at) = ?").all(day) as Parameters<typeof orderDue>[0][];
  return { orders: rows.length, revenue: rows.reduce((s, r) => s + r.total, 0), tips: rows.reduce((s, r) => s + (r.tip ?? 0), 0) };
}

export function buildSummary(date = new Date()) {
  const day = toDateStr(date);
  const lastWeek = toDateStr(new Date(date.getTime() - 7 * 86_400_000));
  const tomorrow = toDateStr(new Date(date.getTime() + 86_400_000));
  const t = dayTotals(day);
  const prev = dayTotals(lastWeek);

  const counts = new Map<string, number>();
  for (const r of db.prepare("SELECT lines FROM orders WHERE date(created_at) = ?").all(day) as { lines: string }[])
    for (const l of JSON.parse(r.lines) as QuoteLine[]) counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty);
  const best = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const reviews = db.prepare("SELECT name, rating, text FROM reviews WHERE date(created_at) = ? ORDER BY id DESC LIMIT 5").all(day) as { name: string; rating: number; text: string }[];
  const low = db.prepare("SELECT name, qty, unit FROM ingredients WHERE qty <= low_at ORDER BY qty / NULLIF(low_at, 0)").all() as { name: string; qty: number; unit: string }[];
  const book = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(guests), 0) AS g FROM bookings WHERE date = ? AND status != 'cancelled'").get(tomorrow) as { n: number; g: number };
  const tickets = db.prepare("SELECT COALESCE(SUM(qty), 0) AS n, COALESCE(SUM(amount), 0) AS a FROM tickets WHERE paid = 1 AND date(created_at) = ?").get(day) as { n: number; a: number };
  const waste = db.prepare("SELECT COALESCE(SUM(qty), 0) AS n, COALESCE(SUM(cost), 0) AS c FROM waste WHERE day = ?").get(day) as { n: number; c: number };
  const cash = getCashup(day);
  const checks = checklistSummary(day);
  const due = dueEquipment();
  const useBy = batchAlerts();
  const refunds = db.prepare("SELECT COALESCE(SUM(refund_amount), 0) AS a FROM orders WHERE date(refunded_at) = ?").get(day) as { a: number };

  const change = (now: number, before: number) => {
    if (!before) return "";
    const pct = Math.round(((now - before) / before) * 100);
    return ` <span style="color:${pct >= 0 ? "#5f6f4e" : "#a8455f"};font-size:13px">${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs last week</span>`;
  };
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const row = (label: string, value: string) => `<tr><td style="padding:6px 0;color:#8a6a5c">${label}</td><td style="text-align:right;padding:6px 0"><b>${value}</b></td></tr>`;
  const when = date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const html = `
    <p style="margin-top:0">Here's how ${when} went at Moss &amp; Moon.</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${row("Orders", `${t.orders}${change(t.orders, prev.orders)}`)}
      ${row("Sales", `${rupees(t.revenue)}${change(t.revenue, prev.revenue)}`)}
      ${row("Average order", t.orders ? rupees(Math.round(t.revenue / t.orders)) : "–")}
      ${row("Tips for the team", rupees(t.tips))}
      ${tickets.n ? row("Event tickets", `${tickets.n} · ${rupees(tickets.a)}`) : ""}
      ${refunds.a ? row("Refunds", `−${rupees(refunds.a)}`) : ""}
      ${waste.n ? row("Thrown away", `${waste.n} items · ${rupees(Math.round(waste.c))}`) : ""}
      ${row("Cash-up", cash ? (difference(cash) === 0 ? "matched ✓" : `<span style="color:${Math.abs(difference(cash)) > 50 ? "#a8455f" : "#3b2621"}">${difference(cash) > 0 ? "over" : "short"} by ${rupees(Math.abs(difference(cash)))}</span>`) : `<span style="color:#a8455f">not done</span>`)}
      ${checks.lists.map((l) => row(`${l.label} checklist`, l.done === l.total ? "all done ✓" : `<span style="color:#a8455f">${l.done} of ${l.total}</span>`)).join("")}
      ${checks.warm.length ? row("⚠️ Fridge too warm", checks.warm.map(esc).join("<br>")) : ""}
      ${useBy.expired.length ? row("⚠️ Past use-by", useBy.expired.map((b) => esc(b.name)).join(", ")) : ""}
      ${useBy.tomorrow.length ? row("📅 Use by tomorrow", useBy.tomorrow.map((b) => esc(b.name)).join(", ")) : ""}
      ${due.length ? row("🔧 Maintenance due", due.map((e) => esc(`${e.name}: ${e.task}`)).join("<br>")) : ""}
      ${row("Tomorrow's bookings", `${book.n} tables · ${book.g} guests`)}
    </table>
    <h3 style="font-family:Georgia,serif;font-weight:normal;margin:22px 0 6px">Best sellers</h3>
    ${best.length ? `<ol style="margin:0;padding-left:20px">${best.map(([n, q]) => `<li>${esc(n)} <span style="color:#8a6a5c">× ${q}</span></li>`).join("")}</ol>` : `<p style="color:#8a6a5c">No orders today.</p>`}
    ${low.length ? `<h3 style="font-family:Georgia,serif;font-weight:normal;margin:22px 0 6px">⚠️ Running low</h3><ul style="margin:0;padding-left:20px">${low.map((i) => `<li>${esc(i.name)}: ${Math.round(i.qty)} ${i.unit} left</li>`).join("")}</ul>` : ""}
    ${reviews.length ? `<h3 style="font-family:Georgia,serif;font-weight:normal;margin:22px 0 6px">New reviews</h3>${reviews.map((r) => `<p style="margin:6px 0">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} <b>${esc(r.name)}</b>: “${esc(r.text.slice(0, 140))}”</p>`).join("")}` : ""}`;

  return {
    subject: `Today at Moss & Moon: ${t.orders} orders, ${rupees(t.revenue)}`,
    html,
    data: { day, ...t, lastWeek: prev, best, reviews: reviews.length, low: low.map((l) => l.name), tomorrowBookings: book.n, cashup: cash ? difference(cash) : null },
  };
}

/** Send the summary (returns false if there's no owner email yet) */
export async function sendSummary(date = new Date()) {
  const to = ownerEmail();
  if (!to) return false;
  const s = buildSummary(date);
  await sendEmail(to, s.subject, s.html);
  return true;
}

/** Called every minute: sends once a day, 15 minutes after closing */
export async function summaryTick(now = new Date()) {
  if (!ownerPref("daily_summary") || !ownerEmail()) return;
  const today = toDateStr(now);
  if (getSetting("summary_sent") === today) return;
  const close = hoursOn(now)?.[1] ?? 20; // closed today: still send it in the evening
  if (now.getHours() * 60 + now.getMinutes() < close * 60 + 15) return;
  setSetting("summary_sent", today);
  await sendSummary(now);
}
