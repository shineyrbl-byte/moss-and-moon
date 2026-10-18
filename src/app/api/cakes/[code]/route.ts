import { db } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { getCake } from "@/lib/cakeOrders";

type P = { params: Promise<{ code: string }> };

// The guest's cake order
export async function GET(_req: Request, { params }: P) {
  const c = getCake((await params).code);
  if (!c) return Response.json({ error: "We couldn't find that cake order." }, { status: 404 });
  return Response.json({ code: c.code, cake: c.cake_name, size: c.size_label, message: c.message, date: c.pickup_date, time: c.pickup_time, name: c.name, price: c.price, status: c.status });
}

// Staff: ready / collected / cancelled ({ status })
export async function PATCH(req: Request, { params }: P) {
  if (!(await currentStaff())) return unauthorized();
  const c = getCake((await params).code);
  if (!c) return Response.json({ error: "Not found." }, { status: 404 });
  const b = await req.json().catch(() => null);
  if (!["ready", "collected", "cancelled"].includes(b?.status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  db.prepare("UPDATE cake_orders SET status = ? WHERE code = ?").run(b.status, c.code);
  return Response.json({ ok: true });
}
