import { db } from "@/lib/db";

type P = { params: Promise<{ code: string }> };
type Row = { code: string; name: string; pickup_date: string; pickup_time: string; summary: string; estimate: number; status: string; order_code: string | null };
const get = (code: string) => db.prepare("SELECT code, name, pickup_date, pickup_time, summary, estimate, status, order_code FROM later_orders WHERE code = ?").get(code.toUpperCase()) as Row | undefined;

// A saved order (the code is the secret: 1 billion possibilities)
export async function GET(_req: Request, { params }: P) {
  const o = get((await params).code);
  if (!o) return Response.json({ error: "We couldn't find that order." }, { status: 404 });
  return Response.json(o);
}

// Cancel it, before it goes to the kitchen
export async function DELETE(_req: Request, { params }: P) {
  const o = get((await params).code);
  if (!o) return Response.json({ error: "Not found." }, { status: 404 });
  if (db.prepare("UPDATE later_orders SET status = 'cancelled' WHERE code = ? AND status = 'saved'").run(o.code).changes === 0) return Response.json({ error: "It's already being made, sorry!" }, { status: 409 });
  return Response.json({ ok: true });
}
