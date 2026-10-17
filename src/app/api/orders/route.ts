import { db, makeCode, cleanPhone, cleanText, cleanEmail } from "@/lib/db";
import { DELIVERY, REFERRAL_CREDIT, quote, rupees } from "@/lib/pricing";
import { HOURS, STAMPS_FOR_REWARD, TABLE_COUNT, toDateStr } from "@/lib/cafe";
import { perksFor } from "@/lib/perks";
import { checkStock, consumeStock } from "@/lib/stock";
import { menuLookup } from "@/lib/menuStore";
import { currentCustomer } from "@/lib/account";
import { publish } from "@/lib/live";
import { isAdmin, unauthorized } from "@/lib/auth";
import { orderPlacedEmail, referralRewardEmail, sendLater } from "@/lib/email";

// Place an order (pickup, table or delivery)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const name = cleanText(body.name, 40);
  const phone = cleanPhone(body.phone);
  const email = cleanEmail(body.email);
  const note = cleanText(body.note, 200);
  const tableNo = Math.floor(Number(body.table));
  const table = tableNo >= 1 && tableNo <= TABLE_COUNT ? tableNo : null;
  const delivery = !table && body.delivery ? cleanText(body.delivery.address, 200) : "";
  const pickup = table ? "table" : delivery ? "delivery" : String(body.pickup ?? "asap");
  const payMethod = body.payMethod === "online" ? "online" : "counter";
  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  // Phone is optional when ordering from a table (it's only needed for the stamp card)
  if (phone.length !== 10 && !(table && !phone)) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  if (body.email && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });
  if (body.delivery && !table && delivery.length < 10) return Response.json({ error: "Please add your full delivery address." }, { status: 400 });

  const [open, close] = HOURS[new Date().getDay()];
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  if (delivery && !(nowMins >= open * 60 && nowMins < close * 60 - 30))
    return Response.json({ error: "Delivery runs during opening hours (until 30 min before closing)." }, { status: 400 });
  if (!["asap", "table", "delivery"].includes(pickup)) {
    const m = /^(\d{2}):(\d{2})$/.exec(pickup);
    const mins = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
    if (!m || mins < open * 60 || mins > close * 60 - 15 || mins < nowMins)
      return Response.json({ error: "Please pick a pickup time during today's opening hours." }, { status: 400 });
  }

  const raw = Array.isArray(body.lines) ? body.lines.slice(0, 30) : [];
  const me = await currentCustomer();
  const find = menuLookup();
  if (raw.some((l: { itemId: string }) => find(l.itemId)?.soldOut))
    return Response.json({ error: "Sorry, something in your tray just sold out. Please remove it." }, { status: 409 });

  // Gift card (optional)
  let gift: { code: string; balance: number } | undefined;
  if (body.giftCard) {
    gift = db.prepare("SELECT code, balance FROM giftcards WHERE code = ? AND paid = 1").get(String(body.giftCard).trim().toUpperCase()) as typeof gift;
    if (!gift) return Response.json({ error: "We couldn't find that gift card." }, { status: 400 });
  }

  const card = phone ? (db.prepare("SELECT stamps FROM loyalty WHERE phone = ?").get(phone) as { stamps: number } | undefined) : undefined;
  const hasReward = (card?.stamps ?? 0) >= STAMPS_FOR_REWARD;
  const perks = perksFor(me);
  const tipAmount = body.tipAmount !== undefined && body.tipAmount !== null && body.tipAmount !== "" ? Number(body.tipAmount) : undefined;
  const q = quote(raw, find, body.promo, hasReward, {
    giftBalance: gift?.balance ?? 0,
    credit: perks.credit,
    birthdayTreat: perks.birthdayTreat && body.useBirthday !== false,
    passDrink: perks.passDrink && body.usePass !== false,
    tipPercent: Number(body.tipPercent) || 0,
    tipAmount: Number.isFinite(tipAmount) ? tipAmount : undefined,
    delivery: !!delivery,
  });
  if (!q.lines.length) return Response.json({ error: "Your tray is empty." }, { status: 400 });
  if (delivery && q.total < DELIVERY.minOrder) return Response.json({ error: `Delivery needs an order of at least ${rupees(DELIVERY.minOrder)}.` }, { status: 400 });

  const stock = checkStock(q.lines);
  if (stock) return Response.json({ error: `Sorry, we've just run out of ${stock} for that. Please pick something else.` }, { status: 409 });

  // Fully covered by credit / gift card = already paid
  const payStatus = q.due === 0 ? "paid" : payMethod === "online" ? "pending" : "unpaid";
  const usedPerks = [q.passDiscount && "pass", q.birthdayDiscount && "birthday", q.loyaltyDiscount && "stamps", q.creditUsed && "credit"].filter(Boolean).join(",");
  const code = makeCode("MM");
  db.prepare(
    `INSERT INTO orders (code, name, phone, email, pickup, note, lines, subtotal, discount, total, promo,
       pay_method, pay_status, giftcard_code, giftcard_used, happy_hour, table_no, customer_id,
       tip, credit_used, delivery_fee, delivery_address, perks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    code, name, phone, email || null, pickup, note, JSON.stringify(q.lines), q.subtotal,
    q.subtotal - q.total, q.total, q.promoCode,
    q.due === 0 && q.giftUsed + q.creditUsed > 0 ? "giftcard" : payMethod, payStatus, gift?.code ?? null, q.giftUsed, q.happyHour ? 1 : 0, table, me?.id ?? null,
    q.tip, q.creditUsed, q.deliveryFee, delivery || null, usedPerks || null
  );
  if (gift && q.giftUsed) db.prepare("UPDATE giftcards SET balance = balance - ? WHERE code = ?").run(q.giftUsed, gift.code);
  consumeStock(q.lines);

  if (me) {
    if (q.creditUsed) db.prepare("UPDATE customers SET credit = credit - ? WHERE id = ?").run(q.creditUsed, me.id);
    if (q.birthdayDiscount) db.prepare("UPDATE customers SET birthday_treat_year = ? WHERE id = ?").run(new Date().getFullYear(), me.id);
    if (q.passDiscount) db.prepare("INSERT OR IGNORE INTO pass_uses (customer_id, day, order_code) VALUES (?, ?, ?)").run(me.id, toDateStr(new Date()), code);
    rewardReferrer(me);
  }

  // Loyalty: one stamp per order. Using a reward spends 10 stamps.
  const usedReward = q.loyaltyDiscount > 0;
  if (phone) db.prepare(
    `INSERT INTO loyalty (phone, name, stamps, rewards_used) VALUES (?, ?, 1, 0)
     ON CONFLICT(phone) DO UPDATE SET name = excluded.name,
       stamps = stamps + 1 - ?, rewards_used = rewards_used + ?`
  ).run(phone, name, usedReward ? STAMPS_FOR_REWARD : 0, usedReward ? 1 : 0);

  // Online orders get their email after payment goes through
  if (email && payStatus !== "pending")
    sendLater(email, ...orderPlacedEmail({ code, name, lines: q.lines, total: q.due, pickup, paid: payStatus === "paid" }));

  publish({ type: "order", code, action: "new" });
  return Response.json({ code, total: q.total, due: q.due, usedReward, perks: usedPerks, needsPayment: payStatus === "pending" });
}

/** A friend who invited this guest gets their credit when the guest's first order lands */
function rewardReferrer(me: { id: number; referred_by: number | null }) {
  if (!me.referred_by) return;
  const n = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?").get(me.id) as { n: number }).n;
  if (n !== 1) return;
  db.prepare("UPDATE customers SET credit = credit + ? WHERE id = ?").run(REFERRAL_CREDIT, me.referred_by);
  const friend = db.prepare("SELECT email FROM customers WHERE id = ?").get(me.referred_by) as { email: string } | undefined;
  if (friend) sendLater(friend.email, ...referralRewardEmail());
}

// Staff: list recent orders (?active=1 for the queue, ?format=csv to download)
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const params = new URL(req.url).searchParams;
  const active = params.get("active") === "1";

  if (params.get("format") === "csv") {
    const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all() as Record<string, unknown>[];
    const cols = ["code", "created_at", "name", "phone", "email", "pickup", "table_no", "delivery_address", "status", "pay_method", "pay_status", "subtotal", "discount", "total", "credit_used", "giftcard_used", "delivery_fee", "tip", "promo", "perks"];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const items = (r: Record<string, unknown>) => (JSON.parse(String(r.lines)) as { qty: number; name: string }[]).map((l) => `${l.qty}x ${l.name}`).join("; ");
    const csv = [[...cols, "items"].join(","), ...rows.map((r) => [...cols.map((c) => cell(r[c])), cell(items(r))].join(","))].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="moss-and-moon-orders.csv"` } });
  }

  const rows = db
    .prepare(`SELECT * FROM orders ${active ? "WHERE status != 'collected'" : ""} ORDER BY id DESC LIMIT 100`)
    .all() as Record<string, unknown>[];
  return Response.json(rows.map((r) => ({ ...r, lines: JSON.parse(String(r.lines)) })));
}
