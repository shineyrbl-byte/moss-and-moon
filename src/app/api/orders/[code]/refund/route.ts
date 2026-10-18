import { db, cleanText } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { refundPayment } from "@/lib/payments";
import { orderDue, rupees } from "@/lib/pricing";
import { refundEmail, sendLater } from "@/lib/email";
import { publish } from "@/lib/live";

type Row = {
  code: string; name: string; email: string | null; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number;
  pay_method: string; pay_status: string; payment_ref: string | null; refund_amount: number;
};

/** Every online payment towards an order: the whole bill, or each person's share */
function payments(o: Row) {
  const shares = db.prepare("SELECT ref, amount FROM order_payments WHERE order_code = ? AND status = 'paid' AND ref IS NOT NULL").all(o.code) as { ref: string; amount: number }[];
  if (shares.length) return shares;
  if (o.pay_method === "online" && o.pay_status === "paid" && o.payment_ref) return [{ ref: o.payment_ref, amount: orderDue(o) }];
  return [];
}

// Owner: refund some or all of what was paid online
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const gate = await ownerGate();
  if (gate) return gate;
  const code = (await params).code.toUpperCase();
  const o = db.prepare("SELECT code, name, email, total, giftcard_used, credit_used, tip, delivery_fee, pay_method, pay_status, payment_ref, refund_amount FROM orders WHERE code = ?").get(code) as Row | undefined;
  if (!o) return Response.json({ error: "Order not found." }, { status: 404 });

  const pays = payments(o);
  const paidOnline = pays.reduce((s, p) => s + p.amount, 0);
  const refundable = paidOnline - o.refund_amount;
  if (!paidOnline) return Response.json({ error: "Nothing was paid online for this order. If they paid at the counter, refund them in cash." }, { status: 409 });
  if (refundable <= 0) return Response.json({ error: "This order has already been fully refunded." }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const amount = b?.amount === undefined || b.amount === "" ? refundable : Math.floor(Number(b.amount));
  if (!(amount >= 1 && amount <= refundable)) return Response.json({ error: `You can refund between ₹1 and ${rupees(refundable)}.` }, { status: 400 });
  const reason = cleanText(b?.reason, 120);

  // Spread the refund over the payments, newest first, skipping money already given back
  let already = o.refund_amount;
  let left = amount;
  const refs: string[] = [];
  for (const p of [...pays].reverse()) {
    const free = Math.max(0, p.amount - already);
    already = Math.max(0, already - p.amount);
    if (!free || !left) continue;
    const part = Math.min(free, left);
    const r = await refundPayment(p.ref, part);
    if (!r.ok) {
      if (refs.length) db.prepare("UPDATE orders SET refund_amount = refund_amount + ?, refunded_at = datetime('now','localtime') WHERE code = ?").run(amount - left, code);
      return Response.json({ error: r.error }, { status: 502 });
    }
    refs.push(r.ref);
    left -= part;
  }

  const full = amount === refundable;
  db.prepare(
    `UPDATE orders SET refund_amount = refund_amount + ?, refund_ref = ?, refunded_at = datetime('now','localtime')${full ? ", pay_status = 'refunded'" : ""} WHERE code = ?`
  ).run(amount, refs.join(","), code);
  if (o.email) sendLater(o.email, ...refundEmail({ code, name: o.name, amount, reason }));
  publish({ type: "order", code, action: "paid" });
  return Response.json({ ok: true, refunded: amount, left: refundable - amount });
}
