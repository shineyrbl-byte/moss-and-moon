import { db } from "@/lib/db";
import { paymentMode, verifyPayment } from "@/lib/payments";
import { drinkGiftEmail, drinkGiftSentEmail, giftCardEmail, orderPlacedEmail, passEmail, sendLater, ticketEmail } from "@/lib/email";
import { EVENTS } from "@/lib/cafe";
import { orderDue, PASS, type QuoteLine } from "@/lib/pricing";
import { paidShares } from "@/lib/orderMoney";
import { publish } from "@/lib/live";
import { toDateStr } from "@/lib/cafe";
import { limited, tooMany } from "@/lib/rateLimit";

type OrderRow = { code: string; name: string; email: string | null; lines: string; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; pickup: string };

function orderPaid(code: string, ref: string | null) {
  const r = db.prepare("UPDATE orders SET pay_status = 'paid', payment_ref = COALESCE(?, payment_ref) WHERE code = ? AND pay_status != 'paid'").run(ref, code);
  if (!r.changes) return;
  publish({ type: "order", code, action: "paid" });
  const o = db.prepare("SELECT code, name, email, lines, total, giftcard_used, credit_used, tip, delivery_fee, pickup FROM orders WHERE code = ?").get(code) as OrderRow;
  if (o.email) sendLater(o.email, ...orderPlacedEmail({ code, name: o.name, lines: JSON.parse(o.lines) as QuoteLine[], total: orderDue(o), pickup: o.pickup, paid: true }));
}

// Confirm a payment went through, then mark the order / share / gift card / pass as paid.
export async function POST(req: Request) {
  if (limited(req, "pay-verify", 60, 600000)) return tooMany();
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").toUpperCase();
  const v = verifyPayment(body);
  if (!v.ok) return Response.json({ error: "We couldn't confirm that payment." }, { status: 400 });

  // Real payments: the Razorpay order must be the one we started for this exact thing, and used only once
  if (paymentMode() === "razorpay") {
    const intent = db.prepare("SELECT kind, code, share_id, used FROM payment_intents WHERE rzp_order_id = ?").get(String(body.razorpay_order_id)) as
      | { kind: string; code: string; share_id: number | null; used: number }
      | undefined;
    if (!intent || intent.kind !== body.kind || intent.code !== code || (intent.share_id !== null && intent.share_id !== Number(body.shareId ?? intent.share_id)))
      return Response.json({ error: "That payment doesn't match this order." }, { status: 400 });
    if (intent.used) return Response.json({ ok: true }); // already counted (e.g. a double tap)
    db.prepare("UPDATE payment_intents SET used = 1 WHERE rzp_order_id = ?").run(String(body.razorpay_order_id));
  }

  if (body.kind === "order") {
    orderPaid(code, v.ref);
    return Response.json({ ok: true });
  }

  if (body.kind === "share") {
    // Real payments are matched by Razorpay's order id; demo payments by the share id
    const share = (body.razorpay_order_id
      ? db.prepare("SELECT id, order_code FROM order_payments WHERE ref = ? AND status = 'pending'").get(String(body.razorpay_order_id))
      : db.prepare("SELECT id, order_code FROM order_payments WHERE id = ? AND status = 'pending'").get(Number(body.shareId))) as { id: number; order_code: string } | undefined;
    if (!share || share.order_code !== code) return Response.json({ error: "We couldn't match that payment." }, { status: 400 });
    db.prepare("UPDATE order_payments SET status = 'paid', ref = ? WHERE id = ?").run(v.ref, share.id);
    const o = db.prepare("SELECT total, giftcard_used, credit_used, tip, delivery_fee FROM orders WHERE code = ?").get(code) as OrderRow;
    if (paidShares(code) >= orderDue(o)) orderPaid(code, null);
    else publish({ type: "order", code, action: "paid" });
    return Response.json({ ok: true });
  }

  if (body.kind === "drinkgift") {
    const r = db.prepare("UPDATE drink_gifts SET paid = 1, payment_ref = ? WHERE code = ? AND paid = 0").run(v.ref, code);
    if (r.changes) {
      const g = db.prepare("SELECT code, item_name, from_name, from_email, to_name, to_email, message, expires FROM drink_gifts WHERE code = ?").get(code) as {
        code: string; item_name: string; from_name: string; from_email: string | null; to_name: string; to_email: string | null; message: string | null; expires: string;
      };
      if (g.to_email) sendLater(g.to_email, ...drinkGiftEmail(g));
      if (g.from_email) sendLater(g.from_email, ...drinkGiftSentEmail(g));
    }
    return Response.json({ ok: true });
  }

  if (body.kind === "ticket") {
    const r = db.prepare("UPDATE tickets SET paid = 1, payment_ref = ? WHERE code = ? AND paid = 0").run(v.ref, code);
    if (r.changes) {
      const t = db.prepare("SELECT code, event_id, name, email, qty FROM tickets WHERE code = ?").get(code) as { code: string; event_id: string; name: string; email: string; qty: number };
      const ev = EVENTS.find((e) => e.id === t.event_id);
      if (ev) sendLater(t.email, ...ticketEmail({ ...t, title: ev.title, date: ev.date, time: ev.time }));
    }
    return Response.json({ ok: true });
  }

  if (body.kind === "giftcard") {
    const r = db.prepare("UPDATE giftcards SET paid = 1, payment_ref = ? WHERE code = ? AND paid = 0").run(v.ref, code);
    if (r.changes) {
      const g = db.prepare("SELECT code, amount, from_name, to_name, to_email, message FROM giftcards WHERE code = ?").get(code) as {
        code: string; amount: number; from_name: string; to_name: string; to_email: string; message: string | null;
      };
      sendLater(g.to_email, ...giftCardEmail(g));
    }
    return Response.json({ ok: true });
  }

  if (body.kind === "pass") {
    const id = Number(code.replace("PASS-", ""));
    const p = db.prepare("SELECT customer_id FROM passes WHERE id = ? AND paid = 0").get(id) as { customer_id: number } | undefined;
    if (p) {
      // A new pass starts today, or the day after the current one ends
      const current = db.prepare("SELECT MAX(ends) AS e FROM passes WHERE customer_id = ? AND paid = 1").get(p.customer_id) as { e: string | null };
      const today = toDateStr(new Date());
      const start = current.e && current.e >= today ? new Date(new Date(current.e + "T00:00").getTime() + 86_400_000) : new Date();
      const end = new Date(start.getTime() + (PASS.days - 1) * 86_400_000);
      db.prepare("UPDATE passes SET paid = 1, payment_ref = ?, starts = ?, ends = ? WHERE id = ?").run(v.ref, toDateStr(start), toDateStr(end), id);
      const c = db.prepare("SELECT email FROM customers WHERE id = ?").get(p.customer_id) as { email: string };
      sendLater(c.email, ...passEmail({ ends: toDateStr(end) }));
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown payment." }, { status: 400 });
}
