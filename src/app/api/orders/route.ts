import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { isAdmin, unauthorized, ownerGate } from "@/lib/auth";
import { paidShares } from "@/lib/orderMoney";
import { placeOrder } from "@/lib/orders";
import { guestKey, vipKeys } from "@/lib/guests";
import { limited, tooMany } from "@/lib/rateLimit";

// Place an order (pickup, table or delivery)
export async function POST(req: Request) {
  if (limited(req, "orders", 60, 600000)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  // The self-order kiosk: a tablet signed in as staff. Orders there belong to nobody's account.
  if (body.kiosk) {
    if (!(await isAdmin())) return Response.json({ error: "Kiosk mode needs the tablet to be signed in as staff." }, { status: 401 });
    return placeOrder({ ...body, payMethod: "counter", delivery: undefined, table: undefined, pickup: "asap", giftCard: undefined }, null as never, { kiosk: true });
  }
  return placeOrder(body, await currentCustomer());
}

// Staff: list recent orders (?active=1 for the queue, ?format=csv to download)
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const params = new URL(req.url).searchParams;
  const active = params.get("active") === "1";

  if (params.get("format") === "csv") {
    {
    const gate = await ownerGate();
    if (gate) return gate;
  }
    const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all() as Record<string, unknown>[];
    const cols = ["code", "created_at", "name", "phone", "email", "pickup", "table_no", "delivery_address", "status", "pay_method", "pay_status", "subtotal", "discount", "total", "credit_used", "giftcard_used", "delivery_fee", "tip", "promo", "perks"];
    // A leading = + - @ would make Excel/Sheets run it as a formula, so prefix those with '
    const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const items = (r: Record<string, unknown>) => (JSON.parse(String(r.lines)) as { qty: number; name: string }[]).map((l) => `${l.qty}x ${l.name}`).join("; ");
    const csv = [[...cols, "items"].join(","), ...rows.map((r) => [...cols.map((c) => cell(r[c])), cell(items(r))].join(","))].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="moss-and-moon-orders.csv"` } });
  }

  const rows = db
    .prepare(`SELECT * FROM orders ${active ? "WHERE status != 'collected'" : ""} ORDER BY id DESC LIMIT 100`)
    .all() as Record<string, unknown>[];
  const vips = vipKeys();
  return Response.json(
    rows.map((r) => ({
      ...r,
      lines: JSON.parse(String(r.lines)),
      paid_shares: paidShares(String(r.code)),
      vip: vips.has(guestKey(r as { customer_id: number | null; phone: string; email: string | null }) ?? ""),
    }))
  );
}
