import { isAdmin, ownerGate, unauthorized } from "@/lib/auth";
import { addThought, clubStatus, reviewThought, setPick, shelfBooks, thoughtsForStaff } from "@/lib/bookClub";
import { limited, tooMany } from "@/lib/rateLimit";

// This month's book, its meet-up and guests' thoughts. Staff: ?staff=1 adds the books and thoughts waiting for a look.
export async function GET(req: Request) {
  const s = clubStatus();
  if (new URL(req.url).searchParams.get("staff") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ ...s, books: shelfBooks(), waiting: thoughtsForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(s, { headers: { "Cache-Control": "no-store" } });
}

// Guests: { name, stars, text } about this month's book (shown once staff approve it)
export async function POST(req: Request) {
  if (limited(req, "book-thought", 3, 3600_000)) return tooMany();
  const r = addThought((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: { month, bookId, date?, time? }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = setPick((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewThought(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
