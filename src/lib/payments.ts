// Online payments through Razorpay (UPI, cards, wallets — works well in India).
// Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to switch it on.
// Without keys the site runs in "demo" mode: a pretend payment screen,
// clearly labelled, so you can show the full flow without real money.
import "server-only";
import crypto from "node:crypto";

export const paymentMode = () => (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? "razorpay" : "demo");

export type PaymentStart =
  | { mode: "demo"; amount: number }
  | { mode: "razorpay"; amount: number; keyId: string; orderId: string };

/** Ask Razorpay to open a payment for this amount (in rupees). */
export async function startPayment(amount: number, receipt: string): Promise<PaymentStart> {
  if (paymentMode() === "demo") return { mode: "demo", amount };
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt }),
  });
  if (!r.ok) throw new Error(`Razorpay error: ${await r.text()}`);
  const d = (await r.json()) as { id: string };
  return { mode: "razorpay", amount, keyId: process.env.RAZORPAY_KEY_ID!, orderId: d.id };
}

/**
 * Give money back for one payment (amount in rupees).
 * Demo payments (and anything paid before Razorpay was switched on) are refunded on paper only.
 */
export async function refundPayment(paymentRef: string, amount: number): Promise<{ ok: boolean; ref: string; error?: string }> {
  if (paymentMode() === "demo" || !paymentRef.startsWith("pay_")) return { ok: true, ref: `demo_refund_${Date.now()}` };
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentRef)}/refund`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amount * 100), speed: "normal" }),
  });
  const d = (await r.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
  if (!r.ok || !d.id) return { ok: false, ref: "", error: d.error?.description ?? "Razorpay didn't accept the refund." };
  return { ok: true, ref: d.id };
}

/** Check Razorpay's signature so nobody can fake a "paid" message. */
export function verifyPayment(p: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string; demo?: boolean }) {
  if (paymentMode() === "demo") return p.demo === true ? { ok: true, ref: `demo_${Date.now()}` } : { ok: false, ref: null };
  if (!p.razorpay_order_id || !p.razorpay_payment_id || !p.razorpay_signature) return { ok: false, ref: null };
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${p.razorpay_order_id}|${p.razorpay_payment_id}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(p.razorpay_signature));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, ref: ok ? p.razorpay_payment_id : null };
}
