import { db } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { EXPENSE_CATEGORIES, monthKey, monthPnl, pnlMonths, validMonth } from "@/lib/pnl";

// Owner: one month in full, plus the net result for the last 6 months
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const q = new URL(req.url).searchParams.get("month");
  const month = validMonth(q) ? q : monthKey(new Date());
  const trend = pnlMonths(6).map((m) => {
    const p = monthPnl(m);
    return { month: m, revenue: p.revenue, net: p.net };
  });
  return Response.json({ ...monthPnl(month), trend, categories: EXPENSE_CATEGORIES });
}

// Owner: add an expense ({ month, category, label, amount, recurring })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const month = validMonth(b?.month) ? b.month : monthKey(new Date());
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(b?.category) ? b.category : "other";
  const label = String(b?.label ?? "").trim().slice(0, 80) || category[0].toUpperCase() + category.slice(1);
  const amount = Number(b?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return Response.json({ error: "Enter an amount above zero." }, { status: 400 });
  const r = db.prepare("INSERT INTO expenses (month, category, label, amount, recurring) VALUES (?, ?, ?, ?, ?)").run(month, category, label, Math.round(amount * 100) / 100, b?.recurring ? 1 : 0);
  return Response.json({ ok: true, id: Number(r.lastInsertRowid) });
}

// Owner: remove an expense ({ id }); removing a repeating one stops it everywhere
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  db.prepare("DELETE FROM expenses WHERE id = ?").run(Number(b?.id));
  return Response.json({ ok: true });
}
