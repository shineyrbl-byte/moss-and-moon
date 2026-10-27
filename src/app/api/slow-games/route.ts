import { createSlowGame, joinSlowGame, moveSlowGame, slowAlerts, slowGame } from "@/lib/slowGamesStore";
import { limited, tooMany } from "@/lib/rateLimit";

// A slow game (?id=&token=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, r = slowGame(q.get("id"), q.get("token"));
  return Response.json(r, { status: "error" in r ? 404 : 200, headers: { "Cache-Control": "no-store" } });
}

// { kind, name } to start one, { id, join: true, name } to take the other seat, { id, token, move } to play,
// or { id, token, subscription } to get a push when it's your turn (subscription: null turns it off)
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (limited(req, b.kind ? "slow-new" : "slow", b.kind ? 30 : 300, 3600_000)) return tooMany();
  const r = b.kind ? createSlowGame(b) : b.join ? joinSlowGame(b) : "subscription" in b ? slowAlerts(b) : moveSlowGame(b);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
