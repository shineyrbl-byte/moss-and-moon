import { isAdmin, unauthorized } from "@/lib/auth";
import { addShout, reviewShout, shoutsForStaff, shoutsToday } from "@/lib/shoutStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// Today's shout-outs (?all=1 for staff: waiting and upcoming)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ shouts: shoutsForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ shouts: shoutsToday() }, { headers: { "Cache-Control": "no-store" } });
}

// Guests: { date, text, from? }
export async function POST(req: Request) {
  if (limited(req, "shoutout", 5, 3600_000)) return tooMany();
  const r = addShout((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "🎂 A shout-out for the TV board", "Have a look so it's ready for the day", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewShout(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
