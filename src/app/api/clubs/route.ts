import { clubView, createClub, joinClub, leaveClub } from "@/lib/clubs";
import { limited, tooMany } from "@/lib/rateLimit";

// ?voter=: your club and the weekly club board
export async function GET(req: Request) {
  return Response.json(clubView(new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
// { voter, create: name, name } · { voter, join: code, name } · { voter, leave: true }
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (limited(req, b.create ? "clubs-new" : "clubs", b.create ? 10 : 60, 3600_000)) return tooMany();
  const r = b.create ? createClub(b.voter, b.create, b.name) : b.join ? joinClub(b.voter, b.join, b.name) : b.leave ? leaveClub(b.voter) : { error: "What would you like to do?" };
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
