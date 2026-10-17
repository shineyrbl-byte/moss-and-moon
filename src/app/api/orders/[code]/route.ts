import { db } from "@/lib/db";
import { ORDER_STEPS } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";
import { orderReadyEmail, sendLater } from "@/lib/email";
import { notifyOrder } from "@/lib/push";
import { publish } from "@/lib/live";
import { paidShares } from "@/lib/orderMoney";

type Ctx = { params: Promise<{ code: string }> };

// Anyone with the code can see the order status (phone and email are hidden)
export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const row = db
    .prepare(
      `SELECT code, name, pickup, note, lines, subtotal, discount, total, promo, status, created_at,
              pay_method, pay_status, giftcard_used, happy_hour, table_no,
              tip, credit_used, delivery_fee, delivery_address, split_count, perks
       FROM orders WHERE code = ?`
    )
    .get(code.toUpperCase()) as Record<string, unknown> | undefined;
  if (!row) return Response.json({ error: "We couldn't find that order." }, { status: 404 });

  // Rough wait: orders ahead of this one × 3 minutes
  const ahead = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing') AND id < (SELECT id FROM orders WHERE code = ?)")
    .get(code.toUpperCase()) as { n: number };
  return Response.json({ ...row, lines: JSON.parse(String(row.lines)), ahead: ahead.n, paidShares: paidShares(code.toUpperCase()) });
}

// Staff: move an order to the next status
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { code } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!ORDER_STEPS.includes(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  const r = db.prepare("UPDATE orders SET status = ? WHERE code = ?").run(status, code.toUpperCase());
  if (!r.changes) return Response.json({ error: "Order not found." }, { status: 404 });
  publish({ type: "order", code: code.toUpperCase(), status, action: "status" });

  if (status === "ready") {
    db.prepare("UPDATE orders SET ready_at = datetime('now','localtime') WHERE code = ?").run(code.toUpperCase());
    const o = db.prepare("SELECT code, name, email, table_no FROM orders WHERE code = ?").get(code.toUpperCase()) as {
      code: string; name: string; email: string | null; table_no: number | null;
    };
    if (o.email) sendLater(o.email, ...orderReadyEmail(o));
    void notifyOrder(o.code, {
      title: o.table_no ? "Your order is on its way 🌸" : "Your order is ready 🌸",
      body: o.table_no ? `${o.code} — we're bringing it to table ${o.table_no} now.` : `${o.code} — come grab it from the pink counter.`,
      url: `/order/${o.code}`,
    });
  }
  // Collected + paying at the counter = paid
  if (status === "collected") db.prepare("UPDATE orders SET pay_status = 'paid' WHERE code = ? AND pay_status = 'unpaid'").run(code.toUpperCase());
  return Response.json({ ok: true });
}
