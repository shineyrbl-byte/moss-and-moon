import { db } from "@/lib/db";
import { startPayment } from "@/lib/payments";
import { orderDue } from "@/lib/pricing";
import { currentCustomer } from "@/lib/account";
import { paidShares } from "@/lib/orderMoney";
import { personShare } from "@/lib/groups";
import { cleanText } from "@/lib/db";

type OrderRow = { name: string; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; pay_status: string; split_count: number | null };


// Begin paying for an order, one share of a split bill, a gift card or a coffee pass.
// The amount always comes from the database, never from the browser.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { kind, code } = body;
  const c = String(code ?? "").toUpperCase();

  let amount = 0;
  let label = "";
  let shareId: number | undefined;

  if (kind === "order" || kind === "share") {
    const o = db.prepare("SELECT name, total, giftcard_used, credit_used, tip, delivery_fee, pay_status, split_count FROM orders WHERE code = ?").get(c) as OrderRow | undefined;
    if (!o) return Response.json({ error: "Order not found." }, { status: 404 });
    if (o.pay_status === "paid") return Response.json({ error: "This order is already paid ✿" }, { status: 409 });
    const left = orderDue(o) - paidShares(c);
    if (left <= 0) return Response.json({ error: "This order is already paid ✿" }, { status: 409 });
    const person = cleanText(body.person, 30);
    if (kind === "share" && person) {
      // Group order: pay exactly your own part
      const mine = personShare(c, person);
      if (mine === null) return Response.json({ error: "We couldn't find your part of this order." }, { status: 404 });
      if (mine <= 0) return Response.json({ error: "Your part is already paid ✿" }, { status: 409 });
      amount = Math.min(left, mine);
      shareId = Number(db.prepare("INSERT INTO order_payments (order_code, amount, person) VALUES (?, ?, ?)").run(c, amount, person).lastInsertRowid);
      label = `${person}'s part of ${c}`;
    } else if (kind === "share") {
      if (!o.split_count) return Response.json({ error: "Choose how many ways to split first." }, { status: 400 });
      amount = Math.min(left, Math.ceil(orderDue(o) / o.split_count));
      shareId = Number(db.prepare("INSERT INTO order_payments (order_code, amount) VALUES (?, ?)").run(c, amount).lastInsertRowid);
      label = `Your share of ${c}`;
    } else {
      db.prepare("UPDATE orders SET pay_method = 'online', pay_status = 'pending' WHERE code = ?").run(c);
      amount = left;
      label = `Order ${c}`;
    }
  } else if (kind === "giftcard") {
    const g = db.prepare("SELECT amount, paid FROM giftcards WHERE code = ?").get(c) as { amount: number; paid: number } | undefined;
    if (!g) return Response.json({ error: "Gift card not found." }, { status: 404 });
    if (g.paid) return Response.json({ error: "This gift card is already paid ✿" }, { status: 409 });
    amount = g.amount;
    label = "Gift card";
  } else if (kind === "pass") {
    const me = await currentCustomer();
    const p = db.prepare("SELECT id, customer_id, price, paid FROM passes WHERE id = ?").get(Number(c.replace("PASS-", ""))) as
      | { id: number; customer_id: number; price: number; paid: number }
      | undefined;
    if (!p || !me || p.customer_id !== me.id) return Response.json({ error: "Pass not found." }, { status: 404 });
    if (p.paid) return Response.json({ error: "This pass is already paid ✿" }, { status: 409 });
    amount = p.price;
    label = "Coffee Pass";
  } else {
    return Response.json({ error: "Unknown payment." }, { status: 400 });
  }

  try {
    const p = await startPayment(amount, shareId ? `${c}-S${shareId}` : c);
    if (shareId && p.mode === "razorpay") db.prepare("UPDATE order_payments SET ref = ? WHERE id = ?").run(p.orderId, shareId);
    return Response.json({ ...p, label, code: c, kind, shareId });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Payments are having a moment. Please try again, or pay at the counter." }, { status: 502 });
  }
}
