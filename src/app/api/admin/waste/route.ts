import { db } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { bakePlan, logWaste } from "@/lib/waste";
import { parseDate, toDateStr } from "@/lib/cafe";

// Staff: today's waste, the last 14 days, and tomorrow's bake plan
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  const today = toDateStr(new Date());
  const entries = db.prepare("SELECT id, day, item_name, qty, reason, cost, created_at FROM waste WHERE day = ? ORDER BY id DESC").all(today);
  const history = db.prepare("SELECT day, SUM(qty) AS qty, ROUND(SUM(cost)) AS cost FROM waste WHERE day >= ? GROUP BY day ORDER BY day").all(toDateStr(new Date(Date.now() - 13 * 86_400_000)));
  const tomorrow = new Date(Date.now() + 86_400_000);
  return Response.json({ today, entries, history, plan: bakePlan(tomorrow), planFor: toDateStr(tomorrow) });
}

// Staff: log leftovers ({ entries: [{ itemId, qty, reason }], day? })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const day = typeof b?.day === "string" && parseDate(b.day) ? b.day : toDateStr(new Date());
  const n = logWaste(day, Array.isArray(b?.entries) ? b.entries.slice(0, 50) : [], me.id || null);
  if (!n) return Response.json({ error: "Nothing to log. Add how many were left." }, { status: 400 });
  return Response.json({ ok: true, logged: n });
}

// Staff: undo an entry from today
export async function DELETE(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const b = await req.json().catch(() => null);
  const r = db.prepare("DELETE FROM waste WHERE id = ? AND day = ?").run(Number(b?.id), toDateStr(new Date()));
  if (!r.changes) return Response.json({ error: "Only today's entries can be removed." }, { status: 404 });
  return Response.json({ ok: true });
}
