import { db } from "@/lib/db";
import { paidShares } from "@/lib/orderMoney";
import { publish } from "@/lib/live";

// Split an unpaid order between 2–8 people (anyone with the order link can do this)
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const { count } = await req.json().catch(() => ({}));
  const n = Math.floor(Number(count));
  if (!(n >= 1 && n <= 8)) return Response.json({ error: "Split between 2 and 8 people." }, { status: 400 });
  const o = db.prepare("SELECT pay_status FROM orders WHERE code = ?").get(code) as { pay_status: string } | undefined;
  if (!o) return Response.json({ error: "Order not found." }, { status: 404 });
  if (o.pay_status === "paid") return Response.json({ error: "This order is already paid ✿" }, { status: 409 });
  if (paidShares(code) > 0) return Response.json({ error: "Someone has already paid a share, so the split can't change now." }, { status: 409 });
  db.prepare("UPDATE orders SET split_count = ? WHERE code = ?").run(n === 1 ? null : n, code);
  publish({ type: "order", code, action: "status" });
  return Response.json({ ok: true });
}
