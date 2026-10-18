import { db } from "@/lib/db";
import { saveSubscription, vapidKeys } from "@/lib/push";
import { limited, tooMany } from "@/lib/rateLimit";

// The public key browsers need to subscribe
export async function GET() {
  return Response.json({ publicKey: vapidKeys().publicKey });
}

// "Notify me when my order is ready"
export async function POST(req: Request) {
  if (limited(req, "push", 30, 600000)) return tooMany();
  const { code, subscription } = await req.json().catch(() => ({}));
  const c = String(code ?? "").toUpperCase();
  const ok = subscription && typeof subscription.endpoint === "string" && /^https:\/\//.test(subscription.endpoint) && subscription.keys?.p256dh && subscription.keys?.auth;
  if (!ok) return Response.json({ error: "That notification setup didn't work." }, { status: 400 });
  if (!db.prepare("SELECT 1 FROM orders WHERE code = ?").get(c)) return Response.json({ error: "Order not found." }, { status: 404 });
  saveSubscription(c, { endpoint: subscription.endpoint, keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) } });
  return Response.json({ ok: true });
}
