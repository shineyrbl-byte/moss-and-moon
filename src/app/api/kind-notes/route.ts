import { isAdmin, unauthorized } from "@/lib/auth";
import { kindNoteCounts, notesForStaff, reviewNote, swapNote } from "@/lib/kindNoteStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// How many notes have gone round (?all=1 for staff: every note, waiting ones first)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ notes: notesForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(kindNoteCounts(), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { text, voter } leave a note, get one back
export async function POST(req: Request) {
  if (limited(req, "kind-note", 5, 3600_000)) return tooMany();
  const r = swapNote((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "💌 A new note for a stranger", "Have a read before it's passed on", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewNote(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
