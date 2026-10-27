import { ownerGate } from "@/lib/auth";
import { gamesReport } from "@/lib/gamesReport";
import { setHidden } from "@/lib/gameVisibility";
import { DAILY_GAMES } from "@/lib/gamesStore";
import { ANY_TIME } from "@/lib/gameCatalog";

// Owner: the games dashboard (?days=7|30|90)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const d = Number(new URL(req.url).searchParams.get("days"));
  return Response.json(gamesReport([7, 30, 90].includes(d) ? d : 30), { headers: { "Cache-Control": "no-store" } });
}

// Owner: { id, hide: true|false } hides a game from the lists (its page keeps working; nothing is deleted)
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (![...DAILY_GAMES, ...ANY_TIME].some((g) => g.id === b.id)) return Response.json({ error: "Pick a game." }, { status: 400 });
  const r = setHidden(b.id, b.hide === true);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
