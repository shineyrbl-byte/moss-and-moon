import { db, makeCode, cleanPhone, cleanText, cleanEmail } from "@/lib/db";
import { quote } from "@/lib/pricing";
import { HOURS, STAMPS_FOR_REWARD } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";
import { orderPlacedEmail, sendLater } from "@/lib/email";

// Place an order
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const name = cleanText(body.name, 40);
  const phone = cleanPhone(body.phone);
  const email = cleanEmail(body.email);
  const note = cleanText(body.note, 200);
  const pickup = String(body.pickup ?? "asap");
  const payMethod = body.payMethod === "online" ? "online" : "counter";
  if (!name) return Response.json({ error: "Please tell us your name." }, { status: 400 });
  if (phone.length !== 10) return Response.json({ error: "Please enter a 10-digit phone number." }, { status: 400 });
  if (body.email && !email) return Response.json({ error: "That email doesn't look right." }, { status: 400 });

  if (pickup !== "asap") {
    const m = /^(\d{2}):(\d{2})$/.exec(pickup);
    const [open, close] = HOURS[new Date().getDay()];
    const mins = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    if (!m || mins < open * 60 || mins > close * 60 - 15 || mins < now)
      return Response.json({ error: "Please pick a pickup time during today's opening hours." }, { status: 400 });
  }

  const raw = Array.isArray(body.lines) ? body.lines.slice(0, 30) : [];
  const soldOut = new Set((db.prepare("SELECT item_id FROM sold_out").all() as { item_id: string }[]).map((r) => r.item_id));
  if (raw.some((l: { itemId: string }) => soldOut.has(l.itemId)))
    return Response.json({ error: "Sorry, something in your tray just sold out. Please remove it." }, { status: 409 });

  // Gift card (optional)
  let gift: { code: string; balance: number } | undefined;
  if (body.giftCard) {
    gift = db.prepare("SELECT code, balance FROM giftcards WHERE code = ? AND paid = 1").get(String(body.giftCard).trim().toUpperCase()) as typeof gift;
    if (!gift) return Response.json({ error: "We couldn't find that gift card." }, { status: 400 });
  }

  const card = db.prepare("SELECT stamps FROM loyalty WHERE phone = ?").get(phone) as { stamps: number } | undefined;
  const hasReward = (card?.stamps ?? 0) >= STAMPS_FOR_REWARD;
  const q = quote(raw, body.promo, hasReward, { giftBalance: gift?.balance ?? 0 });
  if (!q.lines.length) return Response.json({ error: "Your tray is empty." }, { status: 400 });

  // Fully covered by a gift card = already paid
  const payStatus = q.due === 0 ? "paid" : payMethod === "online" ? "pending" : "unpaid";
  const code = makeCode("MM");
  db.prepare(
    `INSERT INTO orders (code, name, phone, email, pickup, note, lines, subtotal, discount, total, promo,
       pay_method, pay_status, giftcard_code, giftcard_used, happy_hour)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    code, name, phone, email || null, pickup, note, JSON.stringify(q.lines), q.subtotal,
    q.happyDiscount + q.promoDiscount + q.loyaltyDiscount, q.total, q.promoCode,
    q.due === 0 && q.giftUsed > 0 ? "giftcard" : payMethod, payStatus, gift?.code ?? null, q.giftUsed, q.happyHour ? 1 : 0
  );
  if (gift && q.giftUsed) db.prepare("UPDATE giftcards SET balance = balance - ? WHERE code = ?").run(q.giftUsed, gift.code);

  // Loyalty: one stamp per order. Using a reward spends 10 stamps.
  const usedReward = q.loyaltyDiscount > 0;
  db.prepare(
    `INSERT INTO loyalty (phone, name, stamps, rewards_used) VALUES (?, ?, 1, 0)
     ON CONFLICT(phone) DO UPDATE SET name = excluded.name,
       stamps = stamps + 1 - ?, rewards_used = rewards_used + ?`
  ).run(phone, name, usedReward ? STAMPS_FOR_REWARD : 0, usedReward ? 1 : 0);

  // Online orders get their email after payment goes through
  if (email && payStatus !== "pending")
    sendLater(email, ...orderPlacedEmail({ code, name, lines: q.lines, total: q.due, pickup, paid: payStatus === "paid" }));

  return Response.json({ code, total: q.total, due: q.due, usedReward, needsPayment: payStatus === "pending" });
}

// Staff: list recent orders (?active=1 for the queue, ?format=csv to download)
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const params = new URL(req.url).searchParams;
  const active = params.get("active") === "1";

  if (params.get("format") === "csv") {
    const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all() as Record<string, unknown>[];
    const cols = ["code", "created_at", "name", "phone", "email", "pickup", "status", "pay_method", "pay_status", "subtotal", "discount", "giftcard_used", "total", "promo"];
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
