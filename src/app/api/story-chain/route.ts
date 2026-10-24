import { isAdmin, unauthorized } from "@/lib/auth";
import { addChainLine, chainForStaff, chainState, latestChainLine, reviewChainLine } from "@/lib/storyChainStore";
import { limited, tooMany } from "@/lib/rateLimit";
import { alertOwner } from "@/lib/push";

// The story so far (?voter=), ?board=1 for the newest line, ?all=1 for staff (lines waiting)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("all") === "1") {
    if (!(await isAdmin())) return unauthorized();
    return Response.json({ lines: chainForStaff() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (q.get("board") === "1") return Response.json(latestChainLine(), { headers: { "Cache-Control": "no-store" } });
  return Response.json(chainState(q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { text, name?, voter }
export async function POST(req: Request) {
  if (limited(req, "story-chain", 10, 3600_000)) return tooMany();
  const r = addChainLine((await req.json().catch(() => null)) ?? {});
  if (!("error" in r)) alertOwner("review", "📜 A new line for the story chain", "Have a read so the story can carry on", "/admin#Notices");
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: { id, approve }
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = reviewChainLine(Number(b.id), !!b.approve);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
