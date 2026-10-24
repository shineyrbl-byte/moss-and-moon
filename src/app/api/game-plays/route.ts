import { isAdmin, unauthorized } from "@/lib/auth";
import { gameBoard, logPlay, removePlay, scoreboard } from "@/lib/gamePlays";
import { limited, tooMany } from "@/lib/rateLimit";

// Most played this month and the latest wins; ?game= for one game's champions
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("game");
  if (id) {
    const b = gameBoard(id);
    return b ? Response.json(b, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "We couldn't find that game." }, { status: 404 });
  }
  return Response.json(scoreboard(), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { game, winner, players, voter }
export async function POST(req: Request) {
  if (limited(req, "game-play", 20, 3600_000)) return tooMany();
  const r = logPlay((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Staff: remove a result (?id=)
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const ok = removePlay(Number(new URL(req.url).searchParams.get("id")));
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
