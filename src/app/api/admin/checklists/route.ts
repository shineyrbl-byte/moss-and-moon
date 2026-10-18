import { db } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { toDateStr } from "@/lib/cafe";
import { FRIDGE_MAX, LISTS, checklistHistory, dayChecklists } from "@/lib/checklists";

// Staff: today's checklists
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  const day = toDateStr(new Date());
  return Response.json({ day, lists: dayChecklists(day), history: checklistHistory(), fridgeMax: FRIDGE_MAX });
}

// Staff: tick or untick ({ itemId, done, value? }) for today
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const day = toDateStr(new Date());
  const item = db.prepare("SELECT id, kind FROM checklist_items WHERE id = ? AND active = 1").get(Number(b?.itemId)) as { id: number; kind: string } | undefined;
  if (!item) return Response.json({ error: "Not found." }, { status: 404 });
  if (!b?.done) {
    db.prepare("DELETE FROM checklist_ticks WHERE day = ? AND item_id = ?").run(day, item.id);
    return Response.json({ ok: true, lists: dayChecklists(day) });
  }
  let value: number | null = null;
  if (item.kind === "temp") {
    value = Number(b.value);
    if (!Number.isFinite(value) || value < -30 || value > 40) return Response.json({ error: "Enter the temperature in °C." }, { status: 400 });
  }
  db.prepare("INSERT INTO checklist_ticks (day, item_id, staff_name, value) VALUES (?, ?, ?, ?) ON CONFLICT(day, item_id) DO UPDATE SET staff_name = excluded.staff_name, value = excluded.value, done_at = datetime('now','localtime')").run(day, item.id, me.name, value);
  return Response.json({ ok: true, lists: dayChecklists(day), warn: value !== null && value > FRIDGE_MAX });
}

// Owner: add a task ({ list, text, kind }) or remove one ({ removeId })
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (b?.removeId) db.prepare("UPDATE checklist_items SET active = 0 WHERE id = ?").run(Number(b.removeId));
  else {
    const list = LISTS.some((l) => l.id === b?.list) ? b.list : null;
    const text = String(b?.text ?? "").trim().slice(0, 140);
    if (!list || !text) return Response.json({ error: "Pick a list and describe the task." }, { status: 400 });
    const max = (db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM checklist_items").get() as { m: number }).m;
    db.prepare("INSERT INTO checklist_items (list, text, kind, sort) VALUES (?, ?, ?, ?)").run(list, text, b?.kind === "temp" ? "temp" : "tick", max + 1);
  }
  return Response.json({ ok: true, lists: dayChecklists(toDateStr(new Date())) });
}
