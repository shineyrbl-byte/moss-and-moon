import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { REFERRAL_CREDIT } from "@/lib/pricing";

// New guests can enter a friend's invite code once, before their first order
export async function POST(req: Request) {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const { code } = await req.json().catch(() => ({}));
  const c = String(code ?? "").trim().toUpperCase();
  if (me.referred_by) return Response.json({ error: "You've already used an invite code ✿" }, { status: 409 });
  const orders = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?").get(me.id) as { n: number }).n;
  if (orders > 0) return Response.json({ error: "Invite codes are for brand-new guests." }, { status: 409 });
  const friend = db.prepare("SELECT id FROM customers WHERE referral_code = ?").get(c) as { id: number } | undefined;
  if (!friend) return Response.json({ error: "We couldn't find that invite code." }, { status: 404 });
  if (friend.id === me.id) return Response.json({ error: "Nice try — that's your own code 😄" }, { status: 400 });
  db.prepare("UPDATE customers SET referred_by = ?, credit = credit + ? WHERE id = ?").run(friend.id, REFERRAL_CREDIT, me.id);
  return Response.json({ ok: true, credit: REFERRAL_CREDIT });
}
