import { dailyBoard, isDailyGame, submitDaily } from "@/lib/dailyScores";
import { limited, tooMany } from "@/lib/rateLimit";

const bad = () => Response.json({ error: "Which game?" }, { status: 400 });

// Today's quickest (?game=wordsearch|sudoku&mode=&voter=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const game = q.get("game");
  if (!isDailyGame(game)) return bad();
  return Response.json(dailyBoard(game, q.get("mode"), q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { game, mode, ms, name, voter }
export async function POST(req: Request) {
  if (limited(req, "daily-score", 60, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  if (!isDailyGame(b.game)) return bad();
  const r = submitDaily(b.game, b);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
