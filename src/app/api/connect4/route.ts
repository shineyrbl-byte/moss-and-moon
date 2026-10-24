import { ownerGate } from "@/lib/auth";
import { connect4State, resetConnect4, voteConnect4 } from "@/lib/connect4Store";
import { limited, tooMany } from "@/lib/rateLimit";

// The game so far (?voter=)
export async function GET(req: Request) {
  return Response.json(connect4State(new URL(req.url).searchParams.get("voter")), { headers: { "Cache-Control": "no-store" } });
}

// Guests: { col, voter }
export async function POST(req: Request) {
  if (limited(req, "connect4", 60, 3600_000)) return tooMany();
  const r = voteConnect4((await req.json().catch(() => null)) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: start a fresh game
export async function DELETE() {
  const gate = await ownerGate();
  if (gate) return gate;
  resetConnect4();
  return Response.json(connect4State());
}
