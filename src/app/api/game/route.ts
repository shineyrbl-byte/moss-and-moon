import { leaderboard, saveScore } from "@/lib/game";
import { limited, tooMany } from "@/lib/rateLimit";

export async function GET() {
  return Response.json(leaderboard());
}

// Save a finished round ({ name, score, served })
export async function POST(req: Request) {
  if (limited(req, "game", 20, 3600_000)) return tooMany();
  const r = saveScore((await req.json().catch(() => null)) ?? {});
  if ("error" in r) return Response.json(r, { status: 400 });
  return Response.json({ ...r, ...leaderboard() });
}
