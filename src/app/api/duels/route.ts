import { duelOptions, duels, startDuel } from "@/lib/duels";
import { limited, tooMany } from "@/lib/rateLimit";

// ?voter=: your duels today, your record, and the puzzles you could duel on
export async function GET(req: Request) {
  const voter = new URL(req.url).searchParams.get("voter");
  return Response.json({ ...duels(voter), options: duelOptions(voter) }, { headers: { "Cache-Control": "no-store" } });
}
// { voter, game }: start a duel on today's puzzle
export async function POST(req: Request) {
  if (limited(req, "duels", 40, 3600_000)) return tooMany();
  const b = ((await req.json().catch(() => null)) ?? {}) as { voter?: unknown; game?: unknown };
  const r = startDuel(b.voter, b.game);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
