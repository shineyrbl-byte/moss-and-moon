import { db } from "@/lib/db";
import { ORDER_STEPS } from "@/lib/cafe";
import { currentStaff } from "@/lib/auth";
import { setOrderStatus } from "@/lib/orderFlow";
import { paidShares } from "@/lib/orderMoney";
import { limited, tooMany } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

// Anyone with the code can see the order status (phone and email are hidden)
export async function GET(req: Request, { params }: Ctx) {
  if (limited(req, "order-lookup", 600, 600000)) return tooMany();
  const { code } = await params;
  const row = db
    .prepare(
      `SELECT code, name, pickup, note, lines, subtotal, discount, total, promo, status, created_at,
              pay_method, pay_status, giftcard_used, happy_hour, table_no,
              tip, credit_used, delivery_fee, delivery_address, split_count, perks, group_code,
              refund_amount, refunded_at, branch, arrived_at, arrived_note
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
  const staff = await currentStaff();
  if (!staff) return Response.json({ error: "Please log in as staff." }, { status: 401 });
  const { code } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!ORDER_STEPS.includes(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  if (!setOrderStatus(code.toUpperCase(), status, staff.id)) return Response.json({ error: "Order not found." }, { status: 404 });
  return Response.json({ ok: true });
}
