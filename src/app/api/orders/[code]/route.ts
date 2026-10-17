import { db } from "@/lib/db";
import { ORDER_STEPS } from "@/lib/cafe";
import { isAdmin, unauthorized } from "@/lib/auth";
import { orderReadyEmail, sendLater } from "@/lib/email";

type Ctx = { params: Promise<{ code: string }> };

// Anyone with the code can see the order status (phone and email are hidden)
export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const row = db
    .prepare(
      `SELECT code, name, pickup, note, lines, subtotal, discount, total, promo, status, created_at,
              pay_method, pay_status, giftcard_used, happy_hour
       FROM orders WHERE code = ?`
    )
    .get(code.toUpperCase()) as Record<string, unknown> | undefined;
  if (!row) return Response.json({ error: "We couldn't find that order." }, { status: 404 });

  // Rough wait: orders ahead of this one × 3 minutes
  const ahead = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('received','brewing') AND id < (SELECT id FROM orders WHERE code = ?)")
    .get(code.toUpperCase()) as { n: number };
  return Response.json({ ...row, lines: JSON.parse(String(row.lines)), ahead: ahead.n });
}

// Staff: move an order to the next status
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { code } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!ORDER_STEPS.includes(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  const r = db.prepare("UPDATE orders SET status = ? WHERE code = ?").run(status, code.toUpperCase());
  if (!r.changes) return Response.json({ error: "Order not found." }, { status: 404 });

  if (status === "ready") {
    const o = db.prepare("SELECT code, name, email FROM orders WHERE code = ?").get(code.toUpperCase()) as { code: string; name: string; email: string | null };
    if (o.email) sendLater(o.email, ...orderReadyEmail(o));
  }
  // Collected + paying at the counter = paid
  if (status === "collected") db.prepare("UPDATE orders SET pay_status = 'paid' WHERE code = ? AND pay_status = 'unpaid'").run(code.toUpperCase());
  return Response.json({ ok: true });
}
