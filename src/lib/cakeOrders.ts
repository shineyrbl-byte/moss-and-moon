import "server-only";
import { db } from "./db";
import { sendLater } from "./email";
import { rupees } from "./pricing";

export type CakeOrder = { code: string; item_id: string; cake_name: string; size: string; size_label: string; message: string | null; pickup_date: string; pickup_time: string; name: string; phone: string; email: string; note: string | null; price: number; status: string; created_at: string };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const getCake = (code: string) => (db.prepare("SELECT * FROM cake_orders WHERE code = ?").get(code.toUpperCase()) as CakeOrder | undefined) ?? null;
export const cakesOn = (date: string) => (db.prepare("SELECT COUNT(*) AS n FROM cake_orders WHERE pickup_date = ? AND status IN ('paid','ready')").get(date) as { n: number }).n;

export function cakePaid(code: string, ref: string | null) {
  if (db.prepare("UPDATE cake_orders SET status = 'paid', payment_ref = ? WHERE code = ? AND status = 'unpaid'").run(ref, code).changes === 0) return;
  const c = getCake(code)!;
  const when = new Date(`${c.pickup_date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  sendLater(c.email, `Your ${c.cake_name} is booked for ${when} 🎂`, `<p>Thank you, ${esc(c.name)}! We'll bake your <b>${esc(c.cake_name)}</b> (${esc(c.size_label)}) fresh for <b>${esc(when)} at ${c.pickup_time}</b>.</p>${c.message ? `<p>On top: <b>“${esc(c.message)}”</b></p>` : ""}<p><b>${rupees(c.price)} paid.</b> Show code <b style="font-family:monospace">${c.code}</b> when you collect it.</p>`);
}
