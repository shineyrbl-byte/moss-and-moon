import { currentStaff, ownerGate, unauthorized } from "@/lib/auth";
import { addNote, deleteNote, notesFor } from "@/lib/teamNotes";
import { limited, tooMany } from "@/lib/rateLimit";

// Staff: notes for you (owners see them all)
export async function GET() {
  const s = await currentStaff();
  if (!s) return unauthorized();
  return Response.json({ notes: notesFor(s), all: s.role === "owner" }, { headers: { "Cache-Control": "no-store" } });
}

// Guests: { staffId, name?, text }
export async function POST(req: Request) {
  if (limited(req, "team-note", 5, 3600_000)) return tooMany();
  const r = addNote((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: ?id=
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const ok = deleteNote(Number(new URL(req.url).searchParams.get("id")));
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
