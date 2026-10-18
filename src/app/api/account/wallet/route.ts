import { db } from "@/lib/db";
import { currentCustomer } from "@/lib/account";
import { WALLET_TOPUPS } from "@/lib/pricing";

// Start a top-up ({ amount: 500 | 1000 | 2000 }); pay it with kind "wallet", code "WALLET-<id>"
export async function POST(req: Request) {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const t = WALLET_TOPUPS.find((x) => x.amount === Number(b?.amount));
  if (!t) return Response.json({ error: "Pick a top-up amount." }, { status: 400 });
  // Tidy away old unpaid ones
  db.prepare("DELETE FROM wallet_topups WHERE customer_id = ? AND paid = 0 AND created_at < datetime('now','localtime','-1 day')").run(me.id);
  const r = db.prepare("INSERT INTO wallet_topups (customer_id, amount, bonus) VALUES (?, ?, ?)").run(me.id, t.amount, t.bonus);
  return Response.json({ code: `WALLET-${r.lastInsertRowid}`, ...t });
}

// Your balance and paid top-ups
export async function GET() {
  const me = await currentCustomer();
  if (!me) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const history = db.prepare("SELECT amount, bonus, created_at FROM wallet_topups WHERE customer_id = ? AND paid = 1 ORDER BY id DESC LIMIT 10").all(me.id);
  return Response.json({ balance: me.credit, topups: WALLET_TOPUPS, history });
}
