import { arcadeBoard, isArcadeGame, submitArcade } from "@/lib/arcadeStore";
import { limited, tooMany } from "@/lib/rateLimit";

const bad = () => Response.json({ error: "Which game?" }, { status: 400 });

// This week's best (?game=higherlower|merge&voter=)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, game = q.get("game");
  if (!isArcadeGame(game)) return bad();
  return Response.json(arcadeBoard(game, q.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// { game, score, name, voter }
export async function POST(req: Request) {
  if (limited(req, "arcade", 60, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  if (!isArcadeGame(b.game)) return bad();
  const r = submitArcade(b.game, b);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
