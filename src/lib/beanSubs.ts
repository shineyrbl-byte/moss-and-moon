// Bean subscriptions: a bag of coffee every 2 or 4 weeks, for pickup or delivery,
// paid when it's handed over. Each one is placed as a normal order on the day.
import "server-only";
import { db } from "./db";
import { hoursOn, parseDate, toDateStr } from "./cafe";
import { getMenu, menuLookup } from "./menuStore";
import { placeOrder } from "./orders";
import { sendEmail } from "./email";
import { rupees, unitPrice } from "./pricing";

export const SUB_EVERY = [14, 28] as const;
export const MAX_SUBS = 3;
export type BeanSub = {
  id: number; customer_id: number; item_id: string; variant: string | null; qty: number; every_days: number;
  method: "pickup" | "delivery"; address: string | null; next_date: string; status: "active" | "paused" | "cancelled"; last_order: string | null;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export const addDays = (day: string, n: number) => toDateStr(new Date(parseDate(day)!.getTime() + n * 86_400_000));

/** Shop items that can be subscribed to: bags of beans */
export const beanItems = () => getMenu({ includeHidden: false }).filter((m) => m.cat === "shop" && /beans/.test(m.id));

export function describeSub(s: BeanSub) {
  const item = menuLookup()(s.item_id);
  const v = item?.variants?.find((x) => x.id === s.variant);
  const price = item ? unitPrice(item, { variant: s.variant ?? undefined }) * s.qty : 0;
  return { name: item?.name ?? "Coffee beans", grind: v?.label ?? null, price, label: `${s.qty} × ${item?.name ?? "beans"}${v ? ` (${v.label})` : ""}` };
}

/** Called every 10 minutes: place today's subscription orders, from an hour after opening */
export async function subsTick(now = new Date()) {
  const today = toDateStr(now);
  const h = hoursOn(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const due = db.prepare("SELECT * FROM bean_subs WHERE status = 'active' AND next_date <= ?").all(today) as BeanSub[];
  for (const s of due) {
    if (!h) { // closed today: try again tomorrow
      db.prepare("UPDATE bean_subs SET next_date = ? WHERE id = ?").run(addDays(today, 1), s.id);
      continue;
    }
    if (nowMins < h[0] * 60 + 60 || nowMins > h[1] * 60 - 60) continue;
    // Move the date first so a slow order can't be placed twice
    if (db.prepare("UPDATE bean_subs SET next_date = ? WHERE id = ? AND next_date = ?").run(addDays(today, s.every_days), s.id, s.next_date).changes === 0) continue;
    const c = db.prepare("SELECT * FROM customers WHERE id = ?").get(s.customer_id) as { id: number; email: string; name: string | null; phone: string | null } | undefined;
    if (!c) continue;
    const d = describeSub(s);
    const res = await placeOrder(
      {
        name: c.name || "Coffee club", phone: c.phone ?? "", email: c.email, payMethod: "counter",
        note: `☕ Bean subscription (every ${s.every_days / 7} weeks)`,
        lines: [{ itemId: s.item_id, opts: { variant: s.variant ?? undefined }, qty: s.qty }],
        ...(s.method === "delivery" && s.address ? { delivery: { address: s.address } } : { pickup: "asap" }),
      },
      c as never,
    );
    const out = await res.json().catch(() => ({}));
    if (res.ok) db.prepare("UPDATE bean_subs SET last_order = ? WHERE id = ?").run(out.code, s.id);
    else await sendEmail(c.email, "Your coffee beans couldn't be packed today", `<p>Hi ${esc(c.name ?? "there")}, we tried to set aside your ${esc(d.label)} but couldn't: <b>${esc(String(out.error ?? "something went wrong"))}</b>.</p><p>Your next bag is due ${esc(addDays(today, s.every_days))}. Pop in or reply to this email and we'll sort you out ✿</p>`);
  }
}

export const subPrice = (s: BeanSub) => rupees(describeSub(s).price);
