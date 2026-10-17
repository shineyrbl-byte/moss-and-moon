import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { PASS } from "@/lib/pricing";

// Buy a Coffee Pass (signed-in guests). Payment happens next, via /api/payments/start.
export async function POST() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Please sign in to get a Coffee Pass." }, { status: 401 });
  const r = db.prepare("INSERT INTO passes (customer_id, starts, ends, price) VALUES (?, '', '', ?)").run(me.id, PASS.price);
  return Response.json({ code: `PASS-${r.lastInsertRowid}`, price: PASS.price });
}
