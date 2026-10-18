// "Order for tomorrow": saved tonight, sent to the kitchen by itself 15 minutes before pickup
import "server-only";
import { db, makeCode, cleanEmail, cleanPhone, cleanText } from "./db";
import { hoursOn, parseDate, toDateStr, findBranch } from "./cafe";
import { menuLookup } from "./menuStore";
import { cleanOptions, combosAt, combosConfig, describeOptions, quote, rupees } from "./pricing";
import { placeOrder, type OrderInput } from "./orders";
import { sendEmail, sendLater } from "./email";
import type { Customer } from "./account";

export const LATER_LEAD = 15;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const SITE = () => process.env.SITE_URL || "http://localhost:3000";
export const tomorrow = () => toDateStr(new Date(Date.now() + 86_400_000));

export function saveLater(body: OrderInput, me: Customer | null) {
  const date = String(body.pickupDate ?? "");
  const time = String(body.pickup ?? "");
  const branch = findBranch(typeof body.branch === "string" ? body.branch : null);
  if (date !== tomorrow()) return { error: "You can order ahead for tomorrow." };
  const h = hoursOn(parseDate(date)!, branch.id);
  if (!h) return { error: "We're closed tomorrow. See you the day after ☕" };
  if (!/^\d{2}:\d{2}$/.test(time) || mins(time) < h[0] * 60 + LATER_LEAD || mins(time) > h[1] * 60 - 15) return { error: "Pick a pickup time during tomorrow's opening hours." };
  const name = cleanText(body.name, 40), phone = cleanPhone(body.phone), email = cleanEmail(body.email);
  if (!name || phone.length !== 10) return { error: "Please add your name and a 10-digit phone." };
  if (body.email && !email) return { error: "That email doesn't look right." };
  const find = menuLookup();
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 30).map((l: { itemId?: string; opts?: unknown; qty?: number }) => {
    const item = find(String(l.itemId));
    const qty = Math.floor(Number(l.qty));
    return item && item.cat !== "shop" && qty >= 1 && qty <= 20 ? { itemId: item.id, opts: cleanOptions(item, l.opts), qty } : null;
  }).filter(Boolean) as { itemId: string; opts: ReturnType<typeof cleanOptions>; qty: number }[];
  if (!lines.length) return { error: "Your tray is empty." };
  const q = quote(lines, find, null, false, { combos: combosAt(combosConfig(), new Date(`${date}T${time}:00`)), ownCup: !!body.ownCup });
  const summary = lines.map((l) => { const it = find(l.itemId)!; const d = describeOptions(it, l.opts); return `${l.qty} × ${it.name}${d ? ` (${d})` : ""}`; }).join(", ");
  const code = makeCode("LT", 6);
  const saved = { name, phone, email: email || undefined, pickup: time, payMethod: "counter", branch: branch.id, note: cleanText(body.note, 180), lines, promo: body.promo, tipPercent: body.tipPercent, ownCup: !!body.ownCup };
  db.prepare("INSERT INTO later_orders (code, body, customer_id, name, email, pickup_date, pickup_time, summary, estimate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(code, JSON.stringify(saved), me?.id ?? null, name, email || null, date, time, summary, q.total);
  if (email) sendLater(email, `Saved for tomorrow at ${time} ✿`, `<p>Hi ${esc(name)}, your order is saved for <b>tomorrow at ${time}</b>:</p><p>${esc(summary)}</p><p>About <b>${rupees(q.total)}</b>, paid at the counter. We start making it 15 minutes before.</p><p><a href="${SITE()}/later/${code}">Change of plans? Cancel it here</a> any time before then.</p>`);
  return { code, estimate: q.total, summary, date, time };
}

/** Called every 20 seconds: send today's saved orders to the kitchen 15 minutes before pickup */
export async function laterTick(now = new Date()) {
  const today = toDateStr(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const due = db.prepare("SELECT * FROM later_orders WHERE status = 'saved' AND pickup_date <= ?").all(today) as { code: string; body: string; customer_id: number | null; name: string; email: string | null; pickup_date: string; pickup_time: string; summary: string }[];
  for (const o of due) {
    const late = o.pickup_date < today || nowMins > mins(o.pickup_time) + 60;
    if (!late && nowMins < mins(o.pickup_time) - LATER_LEAD) continue;
    if (db.prepare("UPDATE later_orders SET status = 'placing' WHERE code = ? AND status = 'saved'").run(o.code).changes === 0) continue;
    if (late) { db.prepare("UPDATE later_orders SET status = 'missed' WHERE code = ?").run(o.code); continue; }
    const body = JSON.parse(o.body);
    const me = o.customer_id ? (db.prepare("SELECT * FROM customers WHERE id = ?").get(o.customer_id) as Customer | undefined) ?? null : null;
    const res = await placeOrder({ ...body, pickup: mins(o.pickup_time) > nowMins ? o.pickup_time : "asap", note: ["📅 Ordered yesterday", body.note].filter(Boolean).join(" · ") }, me as Customer);
    const d = await res.json().catch(() => ({}));
    if (res.ok) db.prepare("UPDATE later_orders SET status = 'placed', order_code = ? WHERE code = ?").run(d.code, o.code);
    else {
      db.prepare("UPDATE later_orders SET status = 'failed' WHERE code = ?").run(o.code);
      if (o.email) await sendEmail(o.email, "We couldn't start your saved order", `<p>Hi ${esc(o.name)}, your order for ${o.pickup_time} (${esc(o.summary)}) didn't go through: <b>${esc(String(d.error ?? "something went wrong"))}</b>. Pop in and we'll sort you out ✿</p>`);
    }
  }
}
