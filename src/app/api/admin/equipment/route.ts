import { db, cleanText } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { equipmentList, equipmentLog, logEquipment } from "@/lib/equipment";

// Staff: what's due, and the recent log
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json({ items: equipmentList(), log: equipmentLog() });
}

// Staff: mark a service done or log a repair ({ id, kind, note?, cost? })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const kind = b?.kind === "repair" ? "repair" : "service";
  const cost = Number(b?.cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) return Response.json({ error: "Cost should be a number." }, { status: 400 });
  if (kind === "repair" && !String(b?.note ?? "").trim()) return Response.json({ error: "Say what was fixed." }, { status: 400 });
  if (!logEquipment(Number(b?.id), kind, cleanText(b?.note, 140), Math.round(cost), me.name)) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true, items: equipmentList(), log: equipmentLog() });
}

// Owner: add a reminder ({ name, task, everyDays }) or remove one ({ removeId })
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  if (b?.removeId) db.prepare("UPDATE equipment SET active = 0 WHERE id = ?").run(Number(b.removeId));
  else {
    const name = cleanText(b?.name, 40), task = cleanText(b?.task, 80), every = Math.round(Number(b?.everyDays));
    if (!name || !task || !(every >= 1 && every <= 730)) return Response.json({ error: "Add the machine, the job, and how often (in days)." }, { status: 400 });
    db.prepare("INSERT INTO equipment (name, task, every_days, last_done) VALUES (?, ?, ?, date('now','localtime'))").run(name, task, every);
  }
  return Response.json({ ok: true, items: equipmentList(), log: equipmentLog() });
}
