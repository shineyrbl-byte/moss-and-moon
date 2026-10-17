import { db } from "@/lib/db";
import { verifyPayment } from "@/lib/payments";
import { giftCardEmail, orderPlacedEmail, sendLater } from "@/lib/email";
import type { QuoteLine } from "@/lib/pricing";

// Confirm a payment went through, then mark the order / gift card as paid.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").toUpperCase();
  const v = verifyPayment(body);
  if (!v.ok) return Response.json({ error: "We couldn't confirm that payment." }, { status: 400 });

  if (body.kind === "order") {
    const r = db.prepare("UPDATE orders SET pay_status = 'paid', payment_ref = ? WHERE code = ? AND pay_status != 'paid'").run(v.ref, code);
    if (r.changes) {
      const o = db.prepare("SELECT code, name, email, lines, total, giftcard_used, pickup FROM orders WHERE code = ?").get(code) as {
        code: string; name: string; email: string | null; lines: string; total: number; giftcard_used: number; pickup: string;
      };
      if (o.email)
        sendLater(o.email, ...orderPlacedEmail({ code, name: o.name, lines: JSON.parse(o.lines) as QuoteLine[], total: o.total - o.giftcard_used, pickup: o.pickup, paid: true }));
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

  return Response.json({ error: "Unknown payment." }, { status: 400 });
}
