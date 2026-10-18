import { db, cleanText } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { parseDate, toDateStr } from "@/lib/cafe";
import { batchStats, openBatches } from "@/lib/batches";

const payload = () => ({ batches: openBatches(), stats: batchStats() });

// Staff: open batches, soonest use-by first
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json(payload());
}

// Staff: log a batch ({ name, amount?, useBy })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 60);
  const useBy = String(b?.useBy ?? "");
  if (!name) return Response.json({ error: "What is it?" }, { status: 400 });
  if (!parseDate(useBy)) return Response.json({ error: "Add the use-by date." }, { status: 400 });
  if (useBy < toDateStr(new Date(Date.now() - 86_400_000))) return Response.json({ error: "That date has already passed. Throw it away instead." }, { status: 400 });
  db.prepare("INSERT INTO batches (name, amount, use_by, staff_name) VALUES (?, ?, ?, ?)").run(name, cleanText(b?.amount, 30) || null, useBy, me.name);
  return Response.json(payload());
}

// Staff: used up or thrown away ({ id, status: "used" | "thrown" })
export async function PATCH(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const b = await req.json().catch(() => null);
  const status = b?.status === "thrown" ? "thrown" : "used";
  db.prepare("UPDATE batches SET status = ?, closed_at = datetime('now','localtime') WHERE id = ? AND status = 'open'").run(status, Number(b?.id));
  return Response.json(payload());
}
