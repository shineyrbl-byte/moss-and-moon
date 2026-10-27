import { TOURNAMENT_GAMES, createTournament, joinTournament, tournamentView } from "@/lib/tournaments";
import { limited, tooMany } from "@/lib/rateLimit";

// ?code=&voter= · ?games (the puzzles you can pick)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.has("games")) return Response.json({ games: TOURNAMENT_GAMES });
  const r = tournamentView(q.get("code"), q.get("voter"));
  return Response.json(r, { status: "error" in r ? 404 : 200, headers: { "Cache-Control": "no-store" } });
}
// { create: true, name, game, start, voter, playerName } · { join: code, voter, name }
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (limited(req, b.create ? "tournament-new" : "tournament", b.create ? 20 : 120, 3600_000)) return tooMany();
  const r = b.create ? createTournament(b) : joinTournament(b.join, b.voter, b.name);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
