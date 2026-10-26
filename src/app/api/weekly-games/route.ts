import { isWeeklyGame, submitWeeklyGame, weeklyGameBoard } from "@/lib/weeklyGames";
import { limited, tooMany } from "@/lib/rateLimit";

const bad = () => Response.json({ error: "Which game?" }, { status: 400 });

// This week's board (?game=crossword&voter=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, game = q.get("game");
  if (!isWeeklyGame(game)) return bad();
  return Response.json(weeklyGameBoard(game, q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}
// { game, ms, name, voter }
export async function POST(req: Request) {
  if (limited(req, "weekly-game", 30, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  if (!isWeeklyGame(b.game)) return bad();
  const r = submitWeeklyGame(b.game, b);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
