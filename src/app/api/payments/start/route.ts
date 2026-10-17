import { db } from "@/lib/db";
import { startPayment } from "@/lib/payments";

// Begin paying for an order or gift card. The amount always comes from the database.
export async function POST(req: Request) {
  const { kind, code } = await req.json().catch(() => ({}));
  const c = String(code ?? "").toUpperCase();

  let amount = 0;
  let label = "";
  if (kind === "order") {
    const o = db.prepare("SELECT name, total, giftcard_used, pay_status FROM orders WHERE code = ?").get(c) as
      | { name: string; total: number; giftcard_used: number; pay_status: string }
      | undefined;
    if (!o) return Response.json({ error: "Order not found." }, { status: 404 });
    if (o.pay_status === "paid") return Response.json({ error: "This order is already paid ✿" }, { status: 409 });
    db.prepare("UPDATE orders SET pay_method = 'online', pay_status = 'pending' WHERE code = ?").run(c);
    amount = o.total - o.giftcard_used;
    label = `Order ${c}`;
  } else if (kind === "giftcard") {
    const g = db.prepare("SELECT amount, paid FROM giftcards WHERE code = ?").get(c) as { amount: number; paid: number } | undefined;
    if (!g) return Response.json({ error: "Gift card not found." }, { status: 404 });
    if (g.paid) return Response.json({ error: "This gift card is already paid ✿" }, { status: 409 });
    amount = g.amount;
    label = "Gift card";
  } else {
    return Response.json({ error: "Unknown payment." }, { status: 400 });
  }

  try {
    const p = await startPayment(amount, c);
    return Response.json({ ...p, label, code: c, kind });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Payments are having a moment. Please try again, or pay at the counter." }, { status: 502 });
  }
}
