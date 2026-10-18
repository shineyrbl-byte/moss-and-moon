import { db, cleanText } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { parseDate, toDateStr } from "@/lib/cafe";
import { MAX_SUBS, SUB_EVERY, addDays, beanItems, describeSub, type BeanSub } from "@/lib/beanSubs";
import { DELIVERY } from "@/lib/pricing";

const signIn = () => Response.json({ error: "Please sign in to subscribe." }, { status: 401 });
const own = (id: unknown, customerId: number) => db.prepare("SELECT * FROM bean_subs WHERE id = ? AND customer_id = ? AND status != 'cancelled'").get(Number(id), customerId) as BeanSub | undefined;

// Your subscriptions, and the beans you can subscribe to
export async function GET() {
  const me = await currentCustomer();
  if (!me) return signIn();
  const subs = db.prepare("SELECT * FROM bean_subs WHERE customer_id = ? AND status != 'cancelled' ORDER BY id").all(me.id) as BeanSub[];
  return Response.json({
    subs: subs.map((s) => ({ ...s, ...describeSub(s) })),
    beans: beanItems().map((m) => ({ id: m.id, name: m.name, price: m.price, variants: m.variants ?? [] })),
    deliveryFee: DELIVERY.fee, freeOver: DELIVERY.freeOver,
  });
}

// Start one: { itemId, variant, qty, every: 14|28, method, address?, start? }
export async function POST(req: Request) {
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  const count = (db.prepare("SELECT COUNT(*) AS n FROM bean_subs WHERE customer_id = ? AND status != 'cancelled'").get(me.id) as { n: number }).n;
  if (count >= MAX_SUBS) return Response.json({ error: `You can have up to ${MAX_SUBS} subscriptions.` }, { status: 409 });
  const item = beanItems().find((m) => m.id === b?.itemId);
  if (!item) return Response.json({ error: "Pick a coffee to subscribe to." }, { status: 400 });
  const variant = item.variants?.length ? (item.variants.find((v) => v.id === b?.variant)?.id ?? item.variants[0].id) : null;
  const qty = Math.min(3, Math.max(1, Math.floor(Number(b?.qty) || 1)));
  const every = Number(b?.every);
  if (!(SUB_EVERY as readonly number[]).includes(every)) return Response.json({ error: "Choose every 2 or every 4 weeks." }, { status: 400 });
  const method = b?.method === "delivery" ? "delivery" : "pickup";
  const address = cleanText(b?.address, 200);
  if (method === "delivery" && address.length < 10) return Response.json({ error: "Please add your full delivery address." }, { status: 400 });
  if (!me.phone) return Response.json({ error: "Add your phone number to your account first, so we can reach you." }, { status: 400 });
  const today = toDateStr(new Date());
  const start = typeof b?.start === "string" && parseDate(b.start) && b.start >= today && b.start <= addDays(today, 60) ? b.start : today;
  const r = db.prepare("INSERT INTO bean_subs (customer_id, item_id, variant, qty, every_days, method, address, next_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(me.id, item.id, variant, qty, every, method, method === "delivery" ? address : null, start);
  return Response.json({ ok: true, id: Number(r.lastInsertRowid), next: start });
}

// { id, action: "pause" | "resume" | "skip" | "cancel" }
export async function PATCH(req: Request) {
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  const s = own(b?.id, me.id);
  if (!s) return Response.json({ error: "Not found." }, { status: 404 });
  const today = toDateStr(new Date());
  const set = (sql: string, ...v: (string | number)[]) => db.prepare(`UPDATE bean_subs SET ${sql} WHERE id = ?`).run(...v, s.id);
  if (b?.action === "pause") set("status = 'paused'");
  else if (b?.action === "resume") set("status = 'active', next_date = ?", s.next_date < today ? addDays(today, 1) : s.next_date);
  else if (b?.action === "skip") set("next_date = ?", addDays(s.next_date < today ? today : s.next_date, s.every_days));
  else if (b?.action === "cancel") set("status = 'cancelled'");
  else return Response.json({ error: "Unknown action." }, { status: 400 });
  return Response.json({ ok: true, sub: { ...(db.prepare("SELECT * FROM bean_subs WHERE id = ?").get(s.id) as BeanSub) } });
}
