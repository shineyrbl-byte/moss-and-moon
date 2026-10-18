import { db, cleanText } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";

const open = () => db.prepare("SELECT id, text, staff_name, created_at FROM handover_notes WHERE done_at IS NULL AND created_at >= datetime('now','localtime','-3 days') ORDER BY id DESC LIMIT 20").all();

// Staff: notes left for the next shift that nobody has dealt with yet
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json(open());
}

// Staff: leave a note ({ text })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const text = cleanText(b?.text, 200);
  if (!text) return Response.json({ error: "Write the note first." }, { status: 400 });
  db.prepare("INSERT INTO handover_notes (text, staff_name) VALUES (?, ?)").run(text, me.name);
  return Response.json(open());
}

// Staff: mark one as dealt with ({ id })
export async function PATCH(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  db.prepare("UPDATE handover_notes SET done_at = datetime('now','localtime'), done_by = ? WHERE id = ? AND done_at IS NULL").run(me.name, Number(b?.id));
  return Response.json(open());
}
