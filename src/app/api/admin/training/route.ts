import { db } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { STATIONS, trainingMatrix } from "@/lib/training";

// Everyone: who's trained on what
export async function GET() {
  const me = await currentStaff();
  if (!me) return unauthorized();
  return Response.json({ stations: STATIONS, team: trainingMatrix(), me: me.id });
}

// Owner: sign someone off on a station, or undo it ({ staffId, station, trained })
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const me = (await currentStaff())!;
  const b = await req.json().catch(() => null);
  if (!STATIONS.some((s) => s.id === b?.station) || !db.prepare("SELECT 1 FROM staff WHERE id = ?").get(Number(b?.staffId))) return Response.json({ error: "Not found." }, { status: 404 });
  if (b.trained) db.prepare("INSERT OR REPLACE INTO training (staff_id, station, signed_by) VALUES (?, ?, ?)").run(Number(b.staffId), b.station, me.name);
  else db.prepare("DELETE FROM training WHERE staff_id = ? AND station = ?").run(Number(b.staffId), b.station);
  return Response.json({ ok: true, team: trainingMatrix() });
}
