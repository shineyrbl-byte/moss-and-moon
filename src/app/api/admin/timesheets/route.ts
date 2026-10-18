import { db } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { weekReport } from "@/lib/timesheets";
import { weekStart } from "@/lib/rota";
import { parseDate } from "@/lib/cafe";

// Staff: a week's hours and tip shares (baristas see only their own row)
export async function GET(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const q = new URL(req.url).searchParams.get("week");
  const r = weekReport(weekStart(q && parseDate(q) ? new Date(q + "T12:00") : new Date()));
  if (me.role !== "owner") return Response.json({ ...r, people: r.people.filter((p) => p.id === me.id) });
  return Response.json(r);
}

// Owner: remove a wrong entry
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  db.prepare("DELETE FROM timesheets WHERE id = ?").run(Number(b?.id));
  return Response.json({ ok: true });
}
