import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { isAdmin, unauthorized, ownerGate } from "@/lib/auth";
import { paidShares } from "@/lib/orderMoney";
import { placeOrder } from "@/lib/orders";

// Place an order (pickup, table or delivery)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
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
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const items = (r: Record<string, unknown>) => (JSON.parse(String(r.lines)) as { qty: number; name: string }[]).map((l) => `${l.qty}x ${l.name}`).join("; ");
    const csv = [[...cols, "items"].join(","), ...rows.map((r) => [...cols.map((c) => cell(r[c])), cell(items(r))].join(","))].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="moss-and-moon-orders.csv"` } });
  }

  const rows = db
    .prepare(`SELECT * FROM orders ${active ? "WHERE status != 'collected'" : ""} ORDER BY id DESC LIMIT 100`)
    .all() as Record<string, unknown>[];
  return Response.json(rows.map((r) => ({ ...r, lines: JSON.parse(String(r.lines)), paid_shares: paidShares(String(r.code)) })));
}
