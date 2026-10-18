import { db, cleanText } from "@/lib/db";
import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { isTime, overlaps, weekDays, weekStart, type Shift } from "@/lib/rota";
import { parseDate, toDateStr } from "@/lib/cafe";

// Everyone on the team can see the rota (?week=YYYY-MM-DD, any day in the week)
export async function GET(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const q = new URL(req.url).searchParams.get("week");
  const monday = weekStart(q && parseDate(q) ? new Date(q + "T12:00") : new Date());
  const days = weekDays(monday);
  const shifts = db
    .prepare("SELECT s.id, s.staff_id, st.name, s.day, s.start, s.end, s.note FROM shifts s JOIN staff st ON st.id = s.staff_id WHERE s.day BETWEEN ? AND ? ORDER BY s.day, s.start")
    .all(days[0], days[6]) as Shift[];
  const team = db.prepare("SELECT id, name, role FROM staff WHERE active = 1 ORDER BY name").all();
  // Your next shift (from today on)
  const next = me.id
    ? (db.prepare("SELECT day, start, end FROM shifts WHERE staff_id = ? AND (day > ? OR (day = ? AND end > ?)) ORDER BY day, start LIMIT 1").get(
        me.id, toDateStr(new Date()), toDateStr(new Date()), new Date().toTimeString().slice(0, 5)
      ) ?? null)
    : null;
  return Response.json({ week: monday, days, shifts, team, me: me.id, next });
}

// Owner: add a shift
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const staffId = Number(b?.staffId);
  const day = typeof b?.day === "string" && parseDate(b.day) ? b.day : "";
  if (!db.prepare("SELECT 1 FROM staff WHERE id = ? AND active = 1").get(staffId)) return Response.json({ error: "Pick someone from the team." }, { status: 400 });
  if (!day) return Response.json({ error: "Pick a day." }, { status: 400 });
  if (!isTime(b?.start) || !isTime(b?.end) || b.end <= b.start) return Response.json({ error: "The shift needs to end after it starts." }, { status: 400 });
  const same = db.prepare("SELECT start, end FROM shifts WHERE staff_id = ? AND day = ?").all(staffId, day) as { start: string; end: string }[];
  if (same.some((s) => overlaps(s, { start: b.start, end: b.end }))) return Response.json({ error: "That overlaps another shift for them that day." }, { status: 409 });
  const r = db.prepare("INSERT INTO shifts (staff_id, day, start, end, note) VALUES (?, ?, ?, ?, ?)").run(staffId, day, b.start, b.end, cleanText(b.note, 60) || null);
  return Response.json({ ok: true, id: Number(r.lastInsertRowid) });
}

// Owner: remove a shift
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const r = db.prepare("DELETE FROM shifts WHERE id = ?").run(Number(b?.id));
  if (!r.changes) return Response.json({ error: "Shift not found." }, { status: 404 });
  return Response.json({ ok: true });
}
